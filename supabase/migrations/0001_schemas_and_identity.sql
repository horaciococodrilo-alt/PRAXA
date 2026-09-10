-- PRAXA 0001 — Esquemas, identidad y empresa
--
-- Modelo de seguridad:
--   * `public`  : tablas del producto, expuestas por la Data API y protegidas por RLS.
--   * `private` : objetos internos (helpers y trigger functions). NO se expone por la
--                 Data API, por lo que nada de lo que vive aquí es invocable por HTTP.
--
-- `authenticated` recibe USAGE sobre `private` únicamente porque las expresiones de las
-- políticas RLS se evalúan con los privilegios del rol que consulta: sin USAGE + EXECUTE
-- la política no podría llamar a `private.is_company_member()`. La protección real es que
-- el esquema no está expuesto por la Data API (ver `db.schemas` en supabase/config.toml).

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references auth.users (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint companies_name_not_blank
    check (char_length(btrim(name)) between 1 and 200),

  -- LIMITACIÓN TEMPORAL DEL MVP: una cuenta administra una sola empresa.
  -- La plataforma aloja muchas empresas aisladas entre sí, pero en esta versión el
  -- dueño es el único administrador y no puede tener más de una.
  -- Reversión: eliminar esta restricción y habilitar altas en `company_members`.
  constraint companies_owner_unique unique (owner_id)
);

comment on constraint companies_owner_unique on public.companies is
  'MVP: una cuenta administra una sola empresa. Ver docs/SECURITY.md.';

create table public.company_members (
  company_id  uuid not null references public.companies (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'owner',
  created_at  timestamptz not null default now(),

  primary key (company_id, user_id),
  constraint company_members_role_check check (role in ('owner'))
);

create index company_members_user_id_idx on public.company_members (user_id);

-- ---------------------------------------------------------------------------
-- Helpers internos
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER es imprescindible acá: la función se usa dentro de las políticas de
-- `company_members`, y sin elevación consultaría esa misma tabla bajo su propia RLS,
-- produciendo recursión infinita.
create function private.is_company_member(p_company_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'praxa: se requiere una sesión autenticada'
      using errcode = '42501';
  end if;

  if p_company_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.company_members m
    where m.company_id = p_company_id
      and m.user_id = v_uid
  );
end;
$$;

-- SECURITY DEFINER es imprescindible acá: `authenticated` no tiene INSERT sobre
-- `company_members` (ni política que lo permita), y la membresía inicial debe crearse
-- en la misma transacción que la empresa.
create function private.handle_new_company()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.company_members (company_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (company_id, user_id) do nothing;
  return new;
end;
$$;

-- No necesita elevación: solo compara NEW con OLD.
create function private.forbid_company_identity_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id then
    raise exception 'praxa: la identidad de la empresa es inmutable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger companies_after_insert_membership
  after insert on public.companies
  for each row execute function private.handle_new_company();

create trigger companies_before_update_identity
  before update on public.companies
  for each row execute function private.forbid_company_identity_change();

create trigger companies_before_update_touch
  before update on public.companies
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.company_members enable row level security;

-- El dueño ve siempre su empresa (invariante que no depende de la fila de membresía) y
-- cualquier miembro ve la empresa a la que pertenece.
create policy companies_select_member
  on public.companies for select to authenticated
  using (owner_id = (select auth.uid()) or private.is_company_member(id));

-- Alta por RLS, no por SECURITY DEFINER: solo se admite crear una empresa propia.
create policy companies_insert_own
  on public.companies for insert to authenticated
  with check (owner_id = (select auth.uid()));

-- USING y WITH CHECK: no alcanza con poder ver la fila, la fila resultante también
-- tiene que seguir siendo propia.
create policy companies_update_owner
  on public.companies for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Sin política de DELETE: nadie borra empresas desde la aplicación.

-- Solo lectura. Sin políticas de INSERT/UPDATE/DELETE: ningún usuario puede otorgarse
-- ni modificar membresías, que es la vía natural de escalada de permisos.
create policy company_members_select_member
  on public.company_members for select to authenticated
  using (private.is_company_member(company_id));

-- ---------------------------------------------------------------------------
-- Punto de entrada expuesto
-- ---------------------------------------------------------------------------

-- SECURITY INVOKER: opera enteramente bajo RLS. No hay privilegios elevados acá.
-- Idempotente: un reintento devuelve la empresa existente y NO sobrescribe el nombre.
create function public.create_company_for_current_user(p_name text)
returns public.companies
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_company public.companies;
begin
  if v_uid is null then
    raise exception 'praxa: se requiere una sesión autenticada'
      using errcode = '42501';
  end if;

  if p_name is null or char_length(btrim(p_name)) = 0 then
    raise exception 'praxa: el nombre de la empresa es obligatorio'
      using errcode = '22023';
  end if;

  -- ON CONFLICT DO NOTHING sobre companies_owner_unique: ante un reintento o dos
  -- llamadas concurrentes, la segunda no inserta y tampoco pisa el nombre original.
  insert into public.companies (name, owner_id)
  values (btrim(p_name), v_uid)
  on conflict (owner_id) do nothing;

  -- Relectura deliberada en vez de RETURNING: el trigger AFTER INSERT que crea la
  -- membresía recién corrió al final de la sentencia anterior.
  select c.* into strict v_company
  from public.companies c
  where c.owner_id = v_uid;

  return v_company;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilegios (ver 0004_grants.sql para la matriz completa)
-- ---------------------------------------------------------------------------

revoke all on function private.is_company_member(uuid) from public;
revoke all on function private.is_company_member(uuid) from anon;
grant execute on function private.is_company_member(uuid) to authenticated;

revoke all on function private.handle_new_company() from public;
revoke all on function private.forbid_company_identity_change() from public;
revoke all on function private.touch_updated_at() from public;
grant execute on function private.forbid_company_identity_change() to authenticated;
grant execute on function private.touch_updated_at() to authenticated;
