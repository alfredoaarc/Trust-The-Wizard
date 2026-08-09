-- 0002 — Sitios, versiones, alias y dominios propios.
--
-- El modelo de versionado es el de ADR-0002: cada publicación escribe un prefijo nuevo
-- e inmutable en R2, y solo al final se mueve `sites.active_version_id`. Esa columna
-- ES el puntero atómico. Hasta que su UPDATE hace COMMIT, el visitante ve la versión
-- anterior íntegra.

create type site_status       as enum ('active', 'archived', 'suspended', 'deleted');
create type moderation_status as enum ('clean', 'flagged', 'under_review', 'suspended');
create type version_source    as enum ('upload_zip', 'upload_file', 'api', 'mcp', 'rollback');
create type domain_status     as enum ('pending_dns', 'validating', 'issuing_ssl', 'active', 'failed');

create table sites (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references organizations(id) on delete cascade,
  subdomain citext not null unique,
  name      text not null,

  -- El puntero atómico de ADR-0002. La clave foránea se añade tras crear
  -- `site_versions`, porque las dos tablas se referencian mutuamente.
  active_version_id uuid,

  -- Banderas de servido. Se replican tal cual al registro de KV que lee el Worker.
  noindex           boolean not null default false,
  spa_fallback      boolean not null default false,
  password_hash     text,
  password_branding jsonb not null default '{}'::jsonb,
  custom_404_path   text,

  ttl_expires_at timestamptz,
  ttl_warned_at  timestamptz,

  status            site_status not null default 'active',
  moderation_status moderation_status not null default 'clean',

  -- ADR-0007 — Degradación sin destrucción.
  --
  -- Al cancelar una suscripción NO se borra nada: el sitio principal sigue activo y el
  -- resto se archiva, recuperable durante 12 MESES. `purgeable_at` es la fecha a partir
  -- de la cual podría purgarse, y se calcula como archived_at + 12 meses.
  --
  -- Esto va a parecer una ineficiencia optimizable: alguien mirará el coste de R2 en
  -- sitios archivados y propondrá purgar a los 30 días. NO ES UN BUG. Es la decisión de
  -- marca que nos separa de una competencia cuyas peores reseñas dicen literalmente
  -- «¡TRAMPA!» por borrar el trabajo de sus clientes al cancelar. Cambiar este plazo es
  -- una decisión de product owner, nunca de refactor.
  archived_at  timestamptz,
  purgeable_at timestamptz,

  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sites_org_idx on sites (org_id) where status <> 'deleted';
create index sites_ttl_idx on sites (ttl_expires_at) where ttl_expires_at is not null;
create index sites_purge_idx on sites (purgeable_at) where purgeable_at is not null;

create table site_versions (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references sites(id) on delete cascade,
  r2_prefix  text not null,
  bytes      bigint not null check (bytes >= 0),
  file_count integer not null check (file_count >= 0),
  entry_file text not null default 'index.html',
  checksum   text not null,
  source     version_source not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index site_versions_site_idx on site_versions (site_id, created_at desc);

alter table sites
  add constraint sites_active_version_fk
  foreign key (active_version_id) references site_versions(id) on delete restrict;

alter table organizations
  add constraint organizations_primary_site_fk
  foreign key (primary_site_id) references sites(id) on delete set null;

-- Renombrar el enlace mantiene el antiguo redirigiendo 301 durante 30 días. El alias
-- ocupa el mismo espacio de nombres que `sites.subdomain`, así que nadie puede
-- registrar un enlace que todavía está redirigiendo.
create table site_aliases (
  subdomain  citext primary key,
  site_id    uuid not null references sites(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table custom_domains (
  id                 uuid primary key default gen_random_uuid(),
  site_id            uuid not null references sites(id) on delete cascade,
  hostname           citext not null unique,
  cf_hostname_id     text,
  status             domain_status not null default 'pending_dns',
  is_apex            boolean not null default false,
  detected_registrar text,
  last_checked_at    timestamptz,
  last_error         text,
  created_at         timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────────
--
-- `apps/serve` NO aparece aquí porque no toca Postgres: lee de KV (ADR-0003). Es lo
-- que hace que un panel caído no tumbe los sitios ya publicados.

alter table sites          enable row level security;
alter table site_versions  enable row level security;
alter table site_aliases   enable row level security;
alter table custom_domains enable row level security;

create policy sites_select on sites for select using (is_org_member(org_id));
create policy sites_insert on sites for insert with check (is_org_member(org_id));
create policy sites_update on sites for update
  using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy sites_delete on sites for delete
  using (has_org_role(org_id, array['owner','admin']::org_role[]));

-- Las versiones son historial: se leen, no se editan. Las escribe el rol de servicio
-- al publicar, y no se borran nunca desde la aplicación — eso es lo que hace posible
-- el rollback en un clic.
create policy site_versions_select on site_versions for select
  using (exists (select 1 from sites s where s.id = site_id and is_org_member(s.org_id)));

create policy site_aliases_select on site_aliases for select
  using (exists (select 1 from sites s where s.id = site_id and is_org_member(s.org_id)));

create policy custom_domains_select on custom_domains for select
  using (exists (select 1 from sites s where s.id = site_id and is_org_member(s.org_id)));
create policy custom_domains_write on custom_domains for all
  using (exists (select 1 from sites s
                  where s.id = site_id
                    and has_org_role(s.org_id, array['owner','admin']::org_role[])))
  with check (exists (select 1 from sites s
                       where s.id = site_id
                         and has_org_role(s.org_id, array['owner','admin']::org_role[])));

-- ── Archivado sin destrucción ─────────────────────────────────────────────────────

create or replace function archive_site(p_site uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update sites
     set status       = 'archived',
         archived_at  = now(),
         -- 12 meses. Ver el comentario largo sobre ADR-0007 en la tabla `sites`.
         purgeable_at = now() + interval '12 months',
         updated_at   = now()
   where id = p_site and status = 'active';
end $$;
