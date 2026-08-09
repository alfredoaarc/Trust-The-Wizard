# Modelo de datos

> Fase 0. Diseño pendiente de validación. El SQL es ilustrativo del esquema previsto,
> no las migraciones definitivas: esas nacen en la slice que estrena cada tabla.

## Principios

1. **Todo cuelga de una organización.** Un freelance es una organización de una
   persona. Esto evita tener dos caminos de permisos (personal y de equipo) que
   inevitablemente divergen.
2. **RLS activado en todas las tablas, sin excepción.** Ninguna tabla se queda con
   RLS desactivado "de momento". El rol de servicio (`service_role`) es el único que
   la esquiva, y solo lo usan las rutas de servidor de `apps/web` y `apps/jobs`.
3. **Postgres es la fuente de verdad.** KV es caché derivada. Si divergen, gana
   Postgres y se resincroniza ([ADR-0003](adr/0003-kv-cache-postgres-fuente-de-verdad.md)).
4. **Dinero y cumplimiento son inmutables.** Las tablas de facturación no admiten
   `UPDATE` ni `DELETE`, para nadie, tampoco para `service_role`.
5. **Los límites viven en datos, no en código**, para poder ajustar un plan sin
   desplegar.

## Tipos enumerados

```sql
create type org_role            as enum ('owner', 'admin', 'member');
create type site_status         as enum ('active', 'archived', 'suspended', 'deleted');
create type moderation_status   as enum ('clean', 'flagged', 'under_review', 'suspended');
create type version_source      as enum ('upload_zip', 'upload_file', 'api', 'mcp', 'rollback');
create type domain_status       as enum ('pending_dns', 'validating', 'issuing_ssl', 'active', 'failed');
create type tax_id_type         as enum ('nif', 'cif', 'nie', 'vat_eu', 'other');
create type tax_zone            as enum ('es_peninsula_baleares', 'es_canarias', 'es_ceuta',
                                         'es_melilla', 'eu', 'non_eu');
-- Regímenes de la matriz de facturacion.md §2.
create type tax_regime          as enum ('es_standard',        -- 21 % IVA, interior
                                         'eu_b2b_reverse',     -- 0 %, inversión sujeto pasivo
                                         'eu_b2c_oss',         -- IVA del país del cliente (OSS)
                                         'non_eu_out_of_scope',-- no sujeto
                                         'es_igic_ipsi');      -- Canarias/Ceuta/Melilla
create type invoice_status      as enum ('issued', 'rectified', 'void');
create type registry_kind       as enum ('alta', 'anulacion');
create type subscription_status as enum ('trialing','active','past_due','canceled','unpaid');
create type analytics_event_kind as enum ('pageview', 'scroll', 'heartbeat', 'exit');
create type moderation_action_kind as enum ('flag','suspend','unsuspend','warn','clear','delete');
```

## 1. Cuentas

`auth.users` de Supabase es la identidad. `profiles` la refleja para poder unir y
aplicar RLS sin tocar el esquema `auth`.

```sql
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  locale      text not null default 'es-ES',
  created_at  timestamptz not null default now()
);

create table organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            citext not null unique,
  is_personal     boolean not null default true,
  plan_code       text not null references plans(code) default 'free',
  -- Sitio que se conserva activo al degradar a gratuito (ADR-0007).
  primary_site_id uuid,                      -- FK diferida a sites
  created_at      timestamptz not null default now()
);

create table memberships (
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on memberships (user_id);
```

Al registrarse se crea la organización personal en el mismo trigger que crea el
`profile`, para que no exista nunca un usuario sin organización.

## 2. Sitios

```sql
create table sites (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  subdomain          citext not null unique,
  name               text not null,
  active_version_id  uuid references site_versions(id),   -- FK diferida
  -- Banderas de servido; se replican tal cual a KV.
  noindex            boolean not null default false,
  spa_fallback       boolean not null default false,
  password_hash      text,                                -- argon2id; null = sin contraseña
  password_branding  jsonb not null default '{}',         -- logo, color, texto de la agencia
  custom_404_path    text,
  ttl_expires_at     timestamptz,                         -- null = permanente
  ttl_warned_at      timestamptz,                         -- aviso 24 h antes; evita duplicar
  status             site_status not null default 'active',
  moderation_status  moderation_status not null default 'clean',
  archived_at        timestamptz,
  -- Fecha a partir de la cual un sitio archivado puede purgarse: archived_at + 12 meses.
  -- Ver ADR-0007. NO acortar sin decisión de producto.
  purgeable_at       timestamptz,
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on sites (org_id) where status <> 'deleted';
create index on sites (ttl_expires_at) where ttl_expires_at is not null;

create table site_versions (
  id          uuid primary key default gen_random_uuid(),   -- ULID codificado
  site_id     uuid not null references sites(id) on delete cascade,
  r2_prefix   text not null,               -- sites/{siteId}/{versionId}/
  bytes       bigint not null,
  file_count  integer not null,
  entry_file  text not null default 'index.html',
  checksum    text not null,               -- sha256 del manifiesto, para deduplicar
  source      version_source not null,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create index on site_versions (site_id, created_at desc);

-- Renombrar el enlace mantiene el antiguo redirigiendo 301 durante 30 días.
create table site_aliases (
  subdomain  citext primary key,
  site_id    uuid not null references sites(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table custom_domains (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid not null references sites(id) on delete cascade,
  hostname          citext not null unique,
  cf_hostname_id    text,                  -- id del Custom Hostname en Cloudflare
  status            domain_status not null default 'pending_dns',
  is_apex           boolean not null default false,
  detected_registrar text,                 -- para las instrucciones en español
  last_checked_at   timestamptz,
  last_error        text,                  -- estado honesto, no spinner infinito
  created_at        timestamptz not null default now()
);
```

**Subdominios reservados** viven en `blocked_patterns` (§6), no en una constante del
código, para poder añadir una marca suplantada sin desplegar.

## 3. Planes, cuotas y suscripciones

```sql
create table plans (
  code               text primary key,      -- free | basic | pro | agency
  name               text not null,
  price_cents_month  integer not null,      -- sin IVA; el mostrado se calcula
  price_cents_year   integer not null,
  stripe_price_month text,
  stripe_price_year  text,
  is_public          boolean not null default true,
  sort_order         integer not null
);

-- Los límites viven en BD para ajustarlos sin desplegar (§5.4 del brief).
-- limit_value = null significa ilimitado.
create table plan_limits (
  plan_code   text not null references plans(code) on delete cascade,
  limit_key   text not null,               -- active_sites | max_file_bytes | custom_domains
                                           -- password_sites | monthly_visits | api_rpm | ...
  limit_value bigint,
  primary key (plan_code, limit_key)
);

create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references organizations(id) on delete cascade,
  plan_code              text not null references plans(code),
  stripe_subscription_id text unique,
  status                 subscription_status not null,
  current_period_end     timestamptz,
  cancel_at              timestamptz,
  created_at             timestamptz not null default now()
);
create unique index on subscriptions (org_id) where status in ('trialing','active','past_due');

create table usage_counters (
  org_id      uuid not null references organizations(id) on delete cascade,
  period      date not null,               -- día o mes según la clave
  counter_key text not null,               -- publishes | visits | api_calls
  value       bigint not null default 0,
  primary key (org_id, period, counter_key)
);
```

Valores iniciales de `plan_limits` (del brief; los cuatro resaltados son decisiones
de producto, no parámetros):

| `limit_key` | free | basic | pro | agency |
|---|---|---|---|---|
| `active_sites` | 1 | **3** | 10 | `null` |
| `max_file_bytes` | **25 MB** | 100 MB | 500 MB | 2 GB |
| `daily_publishes` | **`null`** | `null` | `null` | `null` |
| `password_sites` | 1 | `null` | `null` | `null` |
| `custom_domains` | 0 | 1 | 5 | `null` |
| `analytics_per_visitor` | 0 | 1 (básica) | 1 | 1 + export |
| `white_label` | 0 | 0 | 0 | 1 |

## 4. Facturación

Detalle normativo en [`facturacion.md`](facturacion.md).

```sql
create table billing_profiles (
  org_id           uuid primary key references organizations(id) on delete cascade,
  legal_name       text not null,
  tax_id           text not null,          -- NIF/CIF/NIE/VAT-UE, normalizado
  tax_id_type      tax_id_type not null,
  is_business      boolean not null,
  address_line1    text not null,
  address_line2    text,
  postal_code      text not null,
  city             text not null,
  province         text,
  country_code     char(2) not null,       -- ISO 3166-1
  tax_zone         tax_zone not null,      -- derivado; Canarias/Ceuta/Melilla aparte
  -- Prueba de diligencia debida: guardamos el resultado Y su fecha.
  vies_valid       boolean,
  vies_checked_at  timestamptz,
  vies_request_id  text,                   -- identificador de consulta de la AEAT/CE
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Una fila por serie. El bloqueo de esta fila es lo que garantiza que no haya huecos.
create table invoice_sequences (
  series      text primary key,            -- p. ej. 'A2026', 'R2026' (rectificativas)
  next_number integer not null default 1
);

create table invoices (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id),
  series              text not null references invoice_sequences(series),
  number              integer not null,
  issued_at           timestamptz not null,
  operation_date      date not null,       -- si difiere de la de expedición (RD 1619/2012)
  -- Datos de emisor y destinatario congelados en el momento de emitir: si el cliente
  -- cambia luego su razón social, la factura emitida NO cambia.
  issuer_snapshot     jsonb not null,
  customer_snapshot   jsonb not null,
  tax_regime          tax_regime not null,
  base_cents          integer not null,
  vat_rate            numeric(5,2) not null,
  vat_cents           integer not null,
  total_cents         integer not null,
  currency            char(3) not null default 'EUR',
  legal_mention       text,                -- inversión del sujeto pasivo, no sujeción, etc.
  status              invoice_status not null default 'issued',
  rectifies_invoice_id uuid references invoices(id),
  pdf_url             text,
  stripe_invoice_id   text,
  created_at          timestamptz not null default now(),
  unique (series, number)
);

create table invoice_lines (
  id               uuid primary key default gen_random_uuid(),
  invoice_id       uuid not null references invoices(id) on delete restrict,
  position         integer not null,
  description      text not null,          -- en español
  quantity         numeric(12,4) not null default 1,
  unit_price_cents integer not null,       -- sin IVA
  discount_cents   integer not null default 0,
  vat_rate         numeric(5,2) not null,
  unique (invoice_id, position)
);

-- Registro de facturación encadenado. Verifactu no se activa todavía, pero la
-- estructura existe desde el día uno para que activarlo sea configuración.
-- Ver ADR-0004 y facturacion.md §4.
create table invoice_registry (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references invoices(id),
  kind          registry_kind not null,
  prev_hash     text,                      -- hash del registro anterior; null solo el primero
  hash          text not null,             -- huella del registro actual + prev_hash
  payload       jsonb not null,            -- campos del registro de alta/anulación
  qr_payload    text,                      -- hueco para el QR de la factura
  aeat_status   text,                      -- pendiente | enviado | aceptado | rechazado
  aeat_response jsonb,
  created_at    timestamptz not null default now(),
  unique (invoice_id, kind)
);
```

### Inmutabilidad, en dos capas

```sql
-- Capa 1: RLS solo concede SELECT (§7).
-- Capa 2: trigger que bloquea también a service_role.
create or replace function forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception
    'Las facturas son inmutables. Para corregir, emite una factura rectificativa.';
end $$;

create trigger invoices_immutable before update or delete on invoices
  for each row execute function forbid_mutation();
create trigger invoice_lines_immutable before update or delete on invoice_lines
  for each row execute function forbid_mutation();
create trigger invoice_registry_immutable before update or delete on invoice_registry
  for each row execute function forbid_mutation();
```

Excepción controlada: `invoices.status` pasa a `rectified` y `invoice_registry.aeat_*`
se actualiza al recibir respuesta de la AEAT. Se resuelve con una función
`security definer` acotada a esas columnas, no relajando el trigger.

### Numeración sin huecos

```sql
create or replace function next_invoice_number(p_series text)
returns integer language plpgsql as $$
declare n integer;
begin
  -- UPDATE ... RETURNING toma el bloqueo de fila y lo mantiene hasta el COMMIT
  -- de la transacción que inserta la factura. Dos emisiones concurrentes se
  -- serializan; ninguna consume un número que luego se pierda por rollback.
  update invoice_sequences set next_number = next_number + 1
   where series = p_series returning next_number - 1 into n;
  if n is null then raise exception 'Serie de facturación inexistente: %', p_series; end if;
  return n;
end $$;
```

`next_invoice_number` **solo puede llamarse dentro de la transacción que inserta la
factura**. Si la transacción falla, el número vuelve atrás con ella y no se pierde.

## 5. Analítica

Dos niveles: la sesión de visitante (lo que vende) y los eventos (el detalle).

```sql
create table analytics_sessions (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  -- hash(IP + user-agent + sal rotada cada 24 h). La sal anterior no se conserva,
  -- así que pasadas 24 h la reidentificación es irreversible. ADR-0005.
  visitor_hash  text not null,
  salt_day      date not null,             -- qué sal generó el hash
  first_seen_at timestamptz not null,
  last_seen_at  timestamptz not null,
  visit_count   integer not null default 1,
  dwell_ms      bigint not null default 0,
  max_scroll_pct smallint not null default 0,
  country       char(2),
  city          text,                      -- aproximada, de la geo de Cloudflare
  device_type   text,
  browser       text,
  os            text,
  referrer_host text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,
  unique (site_id, visitor_hash, salt_day)
);
create index on analytics_sessions (site_id, last_seen_at desc);

create table analytics_events (
  id          bigserial primary key,
  session_id  uuid not null references analytics_sessions(id) on delete cascade,
  site_id     uuid not null references sites(id) on delete cascade,
  kind        analytics_event_kind not null,
  path        text not null,
  seq         integer not null,            -- orden de páginas vistas dentro de la sesión
  scroll_pct  smallint,
  dwell_ms    integer,
  occurred_at timestamptz not null
);
create index on analytics_events (site_id, occurred_at desc);
create index on analytics_events (session_id, seq);
```

La vista que vende (*"tu cliente abrió la propuesta 3 veces, la última ayer a las
19:42, y llegó hasta el apartado de precios"*) se construye como vista materializada
por sitio, refrescada por `apps/jobs`, no como consulta ad hoc sobre `analytics_events`.

**Retención:** `TODO: verificar con asesor` el plazo. Propuesta de partida: eventos
crudos 14 meses, sesiones agregadas indefinidamente. Debe quedar en la política de
privacidad y en el DPA.

## 6. Moderación

```sql
create table ingest_scans (
  version_id  uuid primary key references site_versions(id) on delete cascade,
  score       smallint not null,           -- 0–100
  signals     jsonb not null,              -- qué heurística disparó y dónde
  verdict     text not null,               -- clean | review | block
  created_at  timestamptz not null default now()
);

create table abuse_reports (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid references sites(id) on delete set null,
  reported_host  text not null,            -- se conserva aunque el sitio se borre
  reporter_email text,                     -- opcional: la denuncia no exige identificarse
  reason         text not null,
  details        text,
  source         text not null,            -- public | internal | automated
  status         text not null default 'open',
  created_at     timestamptz not null default now()
);

-- Append-only. Registro de auditoría de toda acción de moderación.
create table moderation_actions (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid references sites(id) on delete set null,
  org_id     uuid references organizations(id) on delete set null,
  actor_id   uuid references profiles(id),  -- null = automático
  action     moderation_action_kind not null,
  reason     text not null,
  evidence   jsonb,
  created_at timestamptz not null default now()
);
create trigger moderation_actions_immutable before update or delete on moderation_actions
  for each row execute function forbid_mutation();

create table blocked_patterns (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,   -- reserved_subdomain | brand_lookalike | content_regex
                              -- | blocked_extension | url_denylist
  pattern    text not null,
  severity   smallint not null default 50,
  enabled    boolean not null default true,
  note       text,
  created_at timestamptz not null default now(),
  unique (kind, pattern)
);
```

## 7. API y MCP

```sql
create table api_keys (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  name         text not null,
  prefix       text not null unique,       -- visible en el panel: mu_live_a1b2…
  key_hash     text not null,              -- solo el hash; la clave se muestra una vez
  scopes       text[] not null default '{}',
  created_by   uuid references profiles(id),
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
```

La API REST está disponible **desde el plan gratuito** con rate limit, y el servidor
MCP en todos los planes. No es un diferenciador: es supervivencia.

## 8. Políticas RLS

Dos funciones auxiliares y un patrón repetido. `stable` y con `security definer` para
que el planificador no las evalúe fila a fila.

```sql
create or replace function is_org_member(p_org uuid)
returns boolean language sql stable security definer as $$
  select exists (select 1 from memberships
                  where org_id = p_org and user_id = auth.uid());
$$;

create or replace function has_org_role(p_org uuid, p_roles org_role[])
returns boolean language sql stable security definer as $$
  select exists (select 1 from memberships
                  where org_id = p_org and user_id = auth.uid() and role = any(p_roles));
$$;
```

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | uno mismo | trigger | uno mismo | — |
| `organizations` | miembro | usuario autenticado (se hace owner) | owner/admin | owner |
| `memberships` | miembro de la org | owner/admin | owner/admin | owner/admin |
| `sites` | miembro | miembro | miembro | owner/admin (borrado lógico) |
| `site_versions` | miembro del sitio | servicio | — | — |
| `site_aliases` | miembro | servicio | — | servicio |
| `custom_domains` | miembro | owner/admin | owner/admin | owner/admin |
| `plans`, `plan_limits` | **público** (para la web de precios) | — | — | — |
| `subscriptions` | miembro | servicio (webhook Stripe) | servicio | — |
| `billing_profiles` | miembro | owner/admin | owner/admin | — |
| `invoices`, `invoice_lines` | miembro | **servicio** | **nadie** | **nadie** |
| `invoice_sequences`, `invoice_registry` | — | servicio | nadie | nadie |
| `usage_counters` | miembro | servicio | servicio | — |
| `analytics_sessions`, `analytics_events` | miembro del sitio | servicio | — | servicio (retención) |
| `abuse_reports` | **staff** | **anónimo** (denuncia pública) | staff | — |
| `moderation_actions` | staff | servicio | nadie | nadie |
| `blocked_patterns`, `ingest_scans` | staff | staff | staff | staff |
| `api_keys` | miembro (sin `key_hash`) | owner/admin | owner/admin | owner/admin |

Ejemplo del patrón, sobre `sites`:

```sql
alter table sites enable row level security;

create policy sites_select on sites for select
  using (is_org_member(org_id));

create policy sites_insert on sites for insert
  with check (is_org_member(org_id));

create policy sites_update on sites for update
  using (is_org_member(org_id)) with check (is_org_member(org_id));

create policy sites_delete on sites for delete
  using (has_org_role(org_id, array['owner','admin']::org_role[]));
```

Notas:

- **`apps/serve` no aparece en esta tabla porque no toca Postgres.** Lee de KV. Es lo
  que hace que un panel caído no tumbe los sitios servidos.
- **El rol staff** se identifica por un claim del JWT (`app_metadata.staff = true`),
  no por pertenencia a una organización.
- `abuse_reports` admite `INSERT` anónimo con rate limit en el borde. Denunciar abuso
  no puede exigir cuenta.

## 9. Contrato del registro en KV

Lo que `apps/serve` necesita para responder, y nada más. Clave: `site:{host}`.

```jsonc
{
  "siteId": "…",
  "activeVersion": "01J…",          // → prefijo R2 sites/{siteId}/{versionId}/
  "entryFile": "index.html",
  "status": "active",               // active | suspended
  "noindex": false,
  "spaFallback": true,
  "ttlExpiresAt": null,             // epoch ms o null
  "passwordHash": null,             // argon2id, o null
  "passwordBranding": { "logoUrl": "…", "color": "#…" },
  "custom404": null,
  "orgId": "…",                     // solo para contabilizar cuota de visitas
  "visitQuota": 100000,             // null = ilimitado
  "planCode": "pro",
  "aliasOf": null,                  // si es un alias tras renombrar: 301 al canónico
  "syncedAt": 1770000000000
}
```

**No contiene ningún dato personal.** KV replica globalmente y por eso solo lleva
identificadores y banderas. Se reescribe en cada publicación y en cada cambio de
banderas, suspensión o cambio de plan.
