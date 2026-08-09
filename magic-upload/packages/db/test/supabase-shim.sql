-- Emulación mínima de lo que Supabase da por hecho.
--
-- **Esto NO se despliega.** Existe solo para poder ejecutar las migraciones contra un
-- PostgreSQL normal y probar las políticas RLS de verdad, en lugar de leerlas y
-- confiar en que dicen lo que parecen decir.
--
-- Reproduce tres cosas de Supabase:
--   · el esquema `auth` con su tabla `users`,
--   · `auth.uid()`, que lee el identificador del usuario del JWT de la petición, y
--   · los roles `anon`, `authenticated` y `service_role`.
--
-- En Supabase, `auth.uid()` lee `request.jwt.claims`, un ajuste de sesión que PostgREST
-- fija en cada petición. Aquí hacemos lo mismo, así que la definición es equivalente y
-- las políticas se comportan igual que en producción.

create schema if not exists auth;

create table if not exists auth.users (
  id                   uuid primary key default gen_random_uuid(),
  email                text unique,
  raw_user_meta_data   jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    -- `bypassrls` es la propiedad que hace este test interesante: el rol de servicio
    -- ESQUIVA las políticas RLS, igual que en Supabase. Por eso la inmutabilidad de
    -- las facturas no puede depender solo de RLS y necesita el trigger.
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public, auth to anon, authenticated, service_role;

-- En Supabase, `service_role` administra `auth.users`; el usuario autenticado solo lee.
-- Los tests dan de alta usuarios por esta vía para disparar el trigger de alta.
grant select on auth.users to authenticated;
grant select, insert, update, delete on auth.users to service_role;
