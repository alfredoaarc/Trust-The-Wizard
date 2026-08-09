-- 0001 — Cuentas: perfiles, organizaciones y pertenencias.
--
-- Todo en Magic Upload cuelga de una organización. Un freelance es una organización de
-- una persona. Esto evita tener dos caminos de permisos —personal y de equipo— que
-- inevitablemente divergen y acaban con un agujero en el menos usado.
--
-- Supabase provee `auth.users`. `profiles` lo refleja para poder unir y aplicar RLS
-- sin tocar el esquema `auth`, que es de la plataforma.

create extension if not exists citext;
create extension if not exists pgcrypto;

create type org_role as enum ('owner', 'admin', 'member');

create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  locale     text not null default 'es-ES',
  created_at timestamptz not null default now()
);

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        citext not null unique,
  is_personal boolean not null default true,
  plan_code   text not null default 'free',
  -- Sitio que se conserva activo al degradar a gratuito (ADR-0007). La clave foránea
  -- se añade en 0002, cuando ya existe la tabla `sites`.
  primary_site_id uuid,
  created_at  timestamptz not null default now()
);

create table memberships (
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index memberships_user_idx on memberships (user_id);

-- ── Funciones auxiliares de RLS ───────────────────────────────────────────────────
--
-- `security definer` para que puedan leer `memberships` sin quedar sujetas a la
-- propia RLS de esa tabla, lo que provocaría una recursión infinita. Es el patrón
-- estándar en Supabase y es la razón por la que estas dos funciones existen en lugar
-- de escribir la subconsulta en cada política.
--
-- `stable` para que el planificador las evalúe una vez por consulta y no fila a fila.

create or replace function is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships where org_id = p_org and user_id = auth.uid()
  );
$$;

create or replace function has_org_role(p_org uuid, p_roles org_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
     where org_id = p_org and user_id = auth.uid() and role = any(p_roles)
  );
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────────

alter table profiles      enable row level security;
alter table organizations enable row level security;
alter table memberships   enable row level security;

create policy profiles_select_self on profiles for select
  using (id = auth.uid());
create policy profiles_update_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy orgs_select_member on organizations for select
  using (is_org_member(id));
create policy orgs_update_admin on organizations for update
  using (has_org_role(id, array['owner','admin']::org_role[]))
  with check (has_org_role(id, array['owner','admin']::org_role[]));
create policy orgs_delete_owner on organizations for delete
  using (has_org_role(id, array['owner']::org_role[]));

create policy memberships_select_member on memberships for select
  using (is_org_member(org_id));
create policy memberships_write_admin on memberships for all
  using (has_org_role(org_id, array['owner','admin']::org_role[]))
  with check (has_org_role(org_id, array['owner','admin']::org_role[]));

-- ── Alta de usuario ───────────────────────────────────────────────────────────────
--
-- El perfil y su organización personal se crean en la MISMA transacción que el
-- usuario. Nunca existe un usuario sin organización: si existiera, el panel tendría
-- que gestionar ese estado intermedio en cada pantalla, y una de ellas se olvidaría.

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_slug citext;
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');

  -- Slug a partir del correo, con sufijo aleatorio para evitar colisiones. No se
  -- muestra al usuario: es un identificador interno de la organización personal.
  v_slug := regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9]', '-', 'g')
            || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into organizations (name, slug, is_personal)
  values (coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
          v_slug, true)
  returning id into v_org;

  insert into memberships (org_id, user_id, role) values (v_org, new.id, 'owner');

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
