-- 0003 — Planes, cuotas y facturación.
--
-- Las dos reglas duras de ADR-0004, y las dos se hacen cumplir en el esquema, no por
-- convención:
--
--   1. La numeración de facturas NO PUEDE TENER HUECOS. Un salto es un problema con
--      Hacienda, no un detalle estético.
--   2. Las facturas SON INMUTABLES una vez emitidas. Corregir significa emitir una
--      factura rectificativa que referencia a la original, nunca editar la existente.

create type tax_id_type         as enum ('nif', 'nie', 'cif', 'vat_eu', 'other');
create type tax_zone            as enum ('es_peninsula_baleares', 'es_canarias',
                                         'es_ceuta', 'es_melilla', 'eu', 'non_eu');
create type tax_regime          as enum ('es_standard', 'eu_b2b_reverse', 'eu_b2c_oss',
                                         'non_eu_out_of_scope', 'es_igic_ipsi');
create type invoice_status      as enum ('issued', 'rectified', 'void');
create type registry_kind       as enum ('alta', 'anulacion');
create type subscription_status as enum ('trialing','active','past_due','canceled','unpaid');

-- ── Planes y límites ──────────────────────────────────────────────────────────────

create table plans (
  code               text primary key,
  name               text not null,
  price_cents_month  integer not null check (price_cents_month >= 0),
  price_cents_year   integer not null check (price_cents_year >= 0),
  stripe_price_month text,
  stripe_price_year  text,
  is_public          boolean not null default true,
  sort_order         integer not null
);

-- Los límites viven en datos, no en código, para poder ajustar un plan sin desplegar.
-- `limit_value` nulo significa ILIMITADO, que no es lo mismo que 0 (no incluido).
create table plan_limits (
  plan_code   text not null references plans(code) on delete cascade,
  limit_key   text not null,
  limit_value bigint,
  primary key (plan_code, limit_key)
);

alter table organizations
  add constraint organizations_plan_fk foreign key (plan_code) references plans(code);

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

-- Una organización no puede tener dos suscripciones vivas a la vez.
create unique index subscriptions_one_active_per_org
  on subscriptions (org_id) where status in ('trialing','active','past_due');

create table usage_counters (
  org_id      uuid not null references organizations(id) on delete cascade,
  period      date not null,
  counter_key text not null,
  value       bigint not null default 0,
  primary key (org_id, period, counter_key)
);

-- ── Perfil fiscal ─────────────────────────────────────────────────────────────────

create table billing_profiles (
  org_id        uuid primary key references organizations(id) on delete cascade,
  legal_name    text not null,
  tax_id        text not null,
  tax_id_type   tax_id_type not null,
  is_business   boolean not null,
  address_line1 text not null,
  address_line2 text,
  postal_code   text not null,
  city          text not null,
  province      text,
  country_code  char(2) not null,

  -- Se resuelve al guardar el perfil y se congela. NO se deriva del país en cada
  -- consulta: Canarias, Ceuta y Melilla tienen país `ES` y están fuera del IVA
  -- (art. 3 Ley 37/1992). Derivarlo al vuelo es como se cuela el bug clásico.
  tax_zone      tax_zone not null,

  -- Prueba de diligencia debida: se guarda el resultado de VIES Y su fecha.
  vies_valid      boolean,
  vies_checked_at timestamptz,
  vies_request_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Numeración sin huecos ─────────────────────────────────────────────────────────

create table invoice_sequences (
  series      text primary key,
  next_number integer not null default 1 check (next_number >= 1)
);

create table invoices (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references organizations(id),
  series  text not null references invoice_sequences(series),
  number  integer not null,

  issued_at      timestamptz not null default now(),
  operation_date date not null,

  -- Emisor y destinatario congelados en el momento de emitir. Si el cliente cambia
  -- luego su razón social, la factura emitida NO cambia: se declaró con estos datos.
  issuer_snapshot   jsonb not null,
  customer_snapshot jsonb not null,

  tax_regime  tax_regime not null,
  base_cents  integer not null,
  vat_rate    numeric(5,2) not null,
  vat_cents   integer not null,
  total_cents integer not null,
  currency    char(3) not null default 'EUR',
  legal_mention text,

  status               invoice_status not null default 'issued',
  rectifies_invoice_id uuid references invoices(id),

  pdf_url           text,
  stripe_invoice_id text,
  created_at        timestamptz not null default now(),

  unique (series, number),
  -- La aritmética tiene que cuadrar en la propia fila. Una factura cuyo total no es
  -- base + cuota es un error que no puede llegar a existir, porque no se puede editar.
  constraint invoices_total_matches check (total_cents = base_cents + vat_cents)
);

create index invoices_org_idx on invoices (org_id, issued_at desc);

create table invoice_lines (
  id               uuid primary key default gen_random_uuid(),
  invoice_id       uuid not null references invoices(id) on delete restrict,
  position         integer not null,
  description      text not null,
  quantity         numeric(12,4) not null default 1,
  unit_price_cents integer not null,
  discount_cents   integer not null default 0,
  vat_rate         numeric(5,2) not null,
  unique (invoice_id, position)
);

-- Registro de facturación encadenado por huella. Verifactu no se activa todavía
-- (1 de enero de 2027 para sociedades), pero la estructura existe desde la primera
-- factura para que activarlo sea configuración y no una reescritura con facturas
-- vivas en producción. Ver ADR-0004 y docs/facturacion.md §4.
create table invoice_registry (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references invoices(id),
  kind          registry_kind not null,
  prev_hash     text,
  hash          text not null,
  payload       jsonb not null,
  qr_payload    text,
  aeat_status   text not null default 'pendiente',
  aeat_response jsonb,
  created_at    timestamptz not null default now(),
  unique (invoice_id, kind)
);

/*
 * Reserva el siguiente número de una serie.
 *
 * `UPDATE … RETURNING` toma el bloqueo de fila y LO MANTIENE HASTA EL COMMIT de la
 * transacción que llama. De ahí salen las dos garantías:
 *
 *   · Concurrencia: dos emisiones simultáneas se serializan en esta fila. La segunda
 *     espera a que la primera termine, así que no pueden obtener el mismo número.
 *   · Rollback: si la transacción falla después de reservar, el incremento vuelve
 *     atrás con ella y el número NO se pierde. Una secuencia de Postgres (`serial`)
 *     no daría esta garantía: las secuencias son deliberadamente no transaccionales y
 *     dejan huecos al hacer rollback. Por eso esto es una tabla y no una secuencia.
 *
 * Debe llamarse DENTRO de la misma transacción que inserta la factura.
 */
create or replace function next_invoice_number(p_series text)
returns integer language plpgsql as $$
declare n integer;
begin
  update invoice_sequences
     set next_number = next_number + 1
   where series = p_series
  returning next_number - 1 into n;

  if n is null then
    raise exception 'Serie de facturación inexistente: %', p_series;
  end if;

  return n;
end $$;

/*
 * Inmutabilidad, capa 2.
 *
 * La capa 1 es RLS, que solo concede SELECT. Pero RLS NO se aplica al rol de servicio,
 * y el rol de servicio es exactamente el que usaría un futuro script de «arreglar una
 * factura rápidamente». Estos triggers sí lo alcanzan.
 *
 * La técnica es comparar la fila entera menos las columnas que SÍ pueden cambiar:
 *
 *   to_jsonb(new) - 'status'  is distinct from  to_jsonb(old) - 'status'
 *
 * Así no hay que enumerar las treinta columnas protegidas —una columna nueva queda
 * protegida por defecto, que es el sentido correcto para fallar— y no hace falta
 * desactivar el trigger para nada.
 *
 * Se probó antes con `alter table … disable trigger` dentro de una función, y es una
 * mala idea por dos motivos que no se ven a simple vista: toma un bloqueo ACCESS
 * EXCLUSIVE sobre `invoices`, que bloquea a todo el mundo mientras dura; y desactivar
 * un trigger NO es local a la sesión, así que durante esa ventana CUALQUIER otra
 * sesión podría modificar facturas libremente. Es decir, la vía de escape abría un
 * agujero global. Esto no.
 */

/** Inmutabilidad total: ni update ni delete, sin excepciones. */
create or replace function forbid_mutation()
returns trigger language plpgsql as $$
begin
  raise exception
    'Las facturas son inmutables. Para corregir, emite una factura rectificativa.'
    using errcode = 'restrict_violation';
end $$;

/*
 * Facturas: solo puede cambiar `status`, y solo desde 'issued'.
 *
 * Es lo que permite marcar una factura como rectificada o anulada sin tocar un solo
 * importe. Los datos fiscales quedan tal y como se declararon.
 */
create or replace function invoices_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'Las facturas no se borran. Para anular una, emite una factura rectificativa.'
      using errcode = 'restrict_violation';
  end if;

  if to_jsonb(new) - 'status' is distinct from to_jsonb(old) - 'status' then
    raise exception
      'Las facturas son inmutables. Para corregir, emite una factura rectificativa.'
      using errcode = 'restrict_violation';
  end if;

  if not (old.status = 'issued' and new.status in ('rectified', 'void')) then
    raise exception
      'Una factura solo puede pasar de emitida a rectificada o anulada (intento: % → %).',
      old.status, new.status
      using errcode = 'restrict_violation';
  end if;

  return new;
end $$;

/** Registro: solo pueden cambiar los campos de respuesta de la AEAT. */
create or replace function invoice_registry_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'El registro de facturación es inmutable.'
      using errcode = 'restrict_violation';
  end if;

  if to_jsonb(new) - 'aeat_status' - 'aeat_response'
     is distinct from
     to_jsonb(old) - 'aeat_status' - 'aeat_response' then
    raise exception
      'El registro de facturación es inmutable: la cadena de huellas no se altera.'
      using errcode = 'restrict_violation';
  end if;

  return new;
end $$;

create trigger invoices_immutable
  before update or delete on invoices
  for each row execute function invoices_guard();

create trigger invoice_lines_immutable
  before update or delete on invoice_lines
  for each row execute function forbid_mutation();

create trigger invoice_registry_immutable
  before update or delete on invoice_registry
  for each row execute function invoice_registry_guard();

/*
 * Las dos mutaciones legítimas. Ya no necesitan ningún truco: son UPDATE normales que
 * los triggers de arriba dejan pasar porque solo tocan las columnas permitidas.
 *
 * Existen como funciones con nombre para que la intención quede escrita y para que
 * `grep` encuentre todos los sitios que cambian el estado de una factura.
 *
 * Fíjate en que `rectifies_invoice_id` NO se fija aquí: lo pone la propia
 * rectificativa al insertarse, porque en ese momento ya sabe a qué factura corrige.
 * Menos mutaciones es menos superficie.
 */
create or replace function mark_invoice_rectified(p_invoice uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update invoices set status = 'rectified' where id = p_invoice and status = 'issued';
  if not found then
    raise exception 'La factura % no existe o no está en estado emitida.', p_invoice;
  end if;
end $$;

create or replace function record_aeat_response(p_registry uuid, p_status text, p_response jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update invoice_registry
     set aeat_status = p_status, aeat_response = p_response
   where id = p_registry;
end $$;

-- ── RLS ───────────────────────────────────────────────────────────────────────────

alter table plans             enable row level security;
alter table plan_limits       enable row level security;
alter table subscriptions     enable row level security;
alter table usage_counters    enable row level security;
alter table billing_profiles  enable row level security;
alter table invoices          enable row level security;
alter table invoice_lines     enable row level security;
alter table invoice_sequences enable row level security;
alter table invoice_registry  enable row level security;

-- Planes y límites son públicos: la página de precios los lee sin sesión.
create policy plans_public on plans for select using (true);
create policy plan_limits_public on plan_limits for select using (true);

create policy subscriptions_select on subscriptions for select using (is_org_member(org_id));
create policy usage_counters_select on usage_counters for select using (is_org_member(org_id));

-- El perfil fiscal es de owner y admin, NO de cualquier miembro.
--
-- En una organización personal —que es la mayoría de nuestros clientes: freelances—
-- el domicilio fiscal es el domicilio particular del titular. Un colaborador invitado
-- para publicar una web no tiene por qué verlo, y no lo necesita para nada.
create policy billing_profiles_read on billing_profiles for select
  using (has_org_role(org_id, array['owner','admin']::org_role[]));
create policy billing_profiles_write on billing_profiles for all
  using (has_org_role(org_id, array['owner','admin']::org_role[]))
  with check (has_org_role(org_id, array['owner','admin']::org_role[]));

-- Inmutabilidad, capa 1: SOLO select. No hay política de insert, update ni delete, así
-- que ningún usuario autenticado puede escribir una factura por ninguna vía. Las emite
-- el rol de servicio.
create policy invoices_select on invoices for select using (is_org_member(org_id));
create policy invoice_lines_select on invoice_lines for select
  using (exists (select 1 from invoices i where i.id = invoice_id and is_org_member(i.org_id)));

-- `invoice_sequences` e `invoice_registry` no tienen ninguna política: con RLS activada
-- y sin políticas, nadie salvo el rol de servicio ve una sola fila. Es lo correcto —
-- son fontanería fiscal, no datos del cliente.
