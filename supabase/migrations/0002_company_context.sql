-- PRAXA 0002 — Contexto de empresa versionado (objetivos, sistemas, problemas, restricciones)
--
-- Ciclo de vida de una versión de contexto:
--
--     draft  (version IS NULL, editable)
--       │  activate_context_draft()
--       ▼
--     active (version > 0, inmutable)
--       │  activate_context_draft() de un draft posterior
--       ▼
--     superseded (version > 0, inmutable)
--
-- Editar un contexto ya activo NO lo modifica: `start_context_draft()` lo clona a un
-- nuevo borrador y solo el borrador es editable.
--
-- El borrador puede estar incompleto a propósito: el onboarding debe poder guardarse y
-- retomarse. La integridad completa se valida recién al activar.

create type public.context_status as enum ('draft', 'active', 'superseded');
create type public.objective_kind as enum ('primary', 'secondary');
create type public.objective_priority as enum ('high', 'medium', 'low');
create type public.objective_horizon as enum ('short', 'medium', 'long');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.company_context_versions (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies (id) on delete cascade,
  version                integer,
  status                 public.context_status not null default 'draft',
  context_schema_version text not null,

  -- "todavía no tengo un objetivo definido" se representa acá, explícitamente.
  -- No se inventan objetivos ni métricas ausentes.
  has_defined_objective  boolean not null default false,

  problems               jsonb not null default '[]'::jsonb,
  constraints            jsonb not null default '[]'::jsonb,
  additional_context     text,

  created_by             uuid not null references auth.users (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  activated_at           timestamptz,
  superseded_at          timestamptz,

  -- Necesario para las claves foráneas compuestas de las tablas hijas: impide que una
  -- fila hija apunte a una versión de OTRA empresa a nivel de integridad referencial.
  constraint company_context_versions_company_id_id_key unique (company_id, id),

  -- Numeración por empresa. Los borradores tienen version NULL y no compiten entre sí.
  constraint company_context_versions_company_version_key unique (company_id, version),

  constraint ccv_version_lifecycle check (
    (status = 'draft'      and version is null and activated_at is null  and superseded_at is null)
    or (status = 'active'      and version > 0    and activated_at is not null and superseded_at is null)
    or (status = 'superseded'  and version > 0    and activated_at is not null and superseded_at is not null)
  ),

  constraint ccv_problems_is_array    check (jsonb_typeof(problems) = 'array'),
  constraint ccv_constraints_is_array check (jsonb_typeof(constraints) = 'array')
);

-- A lo sumo un borrador y una versión activa por empresa. Son además la red de
-- seguridad real ante activaciones concurrentes.
create unique index ccv_one_draft_per_company
  on public.company_context_versions (company_id) where status = 'draft';

create unique index ccv_one_active_per_company
  on public.company_context_versions (company_id) where status = 'active';

create table public.company_objectives (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null,
  context_version_id uuid not null,
  kind               public.objective_kind not null default 'secondary',
  title              text not null,
  description        text,

  -- Prioridad y horizonte por objetivo.
  priority           public.objective_priority,
  horizon            public.objective_horizon,

  -- Indicador y meta SOLO si el usuario los conoce. Nullable a propósito.
  indicator_name     text,
  target_value       numeric,
  target_unit        text,

  position           integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint company_objectives_parent_fkey
    foreign key (company_id, context_version_id)
    references public.company_context_versions (company_id, id) on delete cascade,

  constraint company_objectives_title_not_blank
    check (char_length(btrim(title)) between 1 and 300),

  -- Una meta sin indicador no es interpretable.
  constraint company_objectives_target_needs_indicator
    check (target_value is null or indicator_name is not null)
);

-- A lo sumo un objetivo principal por versión. El "al menos uno" se valida al activar,
-- porque un borrador puede estar a medio completar.
create unique index company_objectives_one_primary_per_version
  on public.company_objectives (context_version_id) where kind = 'primary';

create index company_objectives_parent_idx
  on public.company_objectives (company_id, context_version_id);

create table public.company_systems (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null,
  context_version_id uuid not null,
  system_key         text not null,
  label              text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint company_systems_parent_fkey
    foreign key (company_id, context_version_id)
    references public.company_context_versions (company_id, id) on delete cascade,

  -- Sin sistemas duplicados dentro de la misma versión.
  constraint company_systems_unique_per_version unique (context_version_id, system_key),

  constraint company_systems_key_format
    check (system_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$')
);

create index company_systems_parent_idx
  on public.company_systems (company_id, context_version_id);

-- ---------------------------------------------------------------------------
-- Inmutabilidad
-- ---------------------------------------------------------------------------

create function private.enforce_context_version_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- Excepción acotada al BORRADO administrativo fuera de banda.
    --
    -- Sin ella sería imposible borrar una empresa (el borrado en cascada llega hasta
    -- acá) y por lo tanto imposible limpiar los datos de una prueba o atender un pedido
    -- de eliminación. Pero la condición NO es solo el rol: además exige que no haya
    -- ningún usuario final detrás de la operación (`auth.uid()` nulo).
    --
    -- Por qué importa: dentro de una función SECURITY DEFINER, `current_user` pasa a ser
    -- el dueño de la función (postgres), así que mirar solo el rol dejaría abierta una
    -- vía indirecta — un usuario normal invocando una función definer que borre. El
    -- claim `sub` del JWT, en cambio, sobrevive a ese cambio de rol: si hay una sesión
    -- de usuario, `auth.uid()` no es nulo y la excepción no aplica.
    --
    -- La inmutabilidad frente a UPDATE sigue siendo absoluta para todos los roles.
    if current_user in ('service_role', 'supabase_admin', 'postgres')
       and (select auth.uid()) is null then
      return old;
    end if;

    if old.status <> 'draft' then
      raise exception 'praxa: solo se puede eliminar una versión de contexto en borrador'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if new.id is distinct from old.id
     or new.company_id is distinct from old.company_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'praxa: identidad y procedencia de la versión son inmutables'
      using errcode = '42501';
  end if;

  if old.status = 'draft' then
    if new.status not in ('draft', 'active') then
      raise exception 'praxa: transición de estado inválida desde borrador'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if old.status = 'active' then
    if new.status <> 'superseded' then
      raise exception 'praxa: una versión activa es inmutable; clonala a un borrador para editarla'
        using errcode = '42501';
    end if;

    -- Al reemplazar solo pueden moverse status, superseded_at y updated_at.
    if (new.version, new.context_schema_version, new.has_defined_objective,
        new.problems, new.constraints, new.additional_context, new.activated_at)
       is distinct from
       (old.version, old.context_schema_version, old.has_defined_objective,
        old.problems, old.constraints, old.additional_context, old.activated_at) then
      raise exception 'praxa: al reemplazar una versión activa solo puede cambiar su estado'
        using errcode = '42501';
    end if;

    return new;
  end if;

  raise exception 'praxa: una versión reemplazada es inmutable'
    using errcode = '42501';
end;
$$;

-- Las filas hijas solo se pueden tocar mientras la versión padre está en borrador.
create function private.enforce_child_parent_is_draft()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_parent uuid := coalesce(new.context_version_id, old.context_version_id);
  v_status public.context_status;
begin
  -- Misma excepción acotada que arriba, con la misma doble condición: rol administrativo
  -- Y ningún usuario final detrás de la operación.
  if tg_op = 'DELETE'
     and current_user in ('service_role', 'supabase_admin', 'postgres')
     and (select auth.uid()) is null then
    return old;
  end if;

  select v.status into v_status
  from public.company_context_versions v
  where v.id = v_parent;

  -- Padre ausente: estamos dentro de un borrado en cascada. Nada que proteger.
  if not found then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if v_status <> 'draft' then
    raise exception 'praxa: la versión de contexto % no está en borrador y no admite cambios', v_parent
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger ccv_immutability
  before update or delete on public.company_context_versions
  for each row execute function private.enforce_context_version_immutability();

create trigger ccv_touch
  before update on public.company_context_versions
  for each row execute function private.touch_updated_at();

create trigger company_objectives_parent_draft
  before insert or update or delete on public.company_objectives
  for each row execute function private.enforce_child_parent_is_draft();

create trigger company_objectives_touch
  before update on public.company_objectives
  for each row execute function private.touch_updated_at();

create trigger company_systems_parent_draft
  before insert or update or delete on public.company_systems
  for each row execute function private.enforce_child_parent_is_draft();

create trigger company_systems_touch
  before update on public.company_systems
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.company_context_versions enable row level security;
alter table public.company_objectives       enable row level security;
alter table public.company_systems          enable row level security;

create policy ccv_select_member
  on public.company_context_versions for select to authenticated
  using (private.is_company_member(company_id));

-- Una versión solo nace como borrador, sin número, y a nombre de quien la crea.
create policy ccv_insert_member
  on public.company_context_versions for insert to authenticated
  with check (
    private.is_company_member(company_id)
    and created_by = (select auth.uid())
    and status = 'draft'
    and version is null
  );

-- WITH CHECK impide mover la fila a otra empresa o falsear su procedencia.
create policy ccv_update_member
  on public.company_context_versions for update to authenticated
  using (private.is_company_member(company_id))
  with check (
    private.is_company_member(company_id)
    and created_by = (select auth.uid())
  );

create policy ccv_delete_draft
  on public.company_context_versions for delete to authenticated
  using (private.is_company_member(company_id) and status = 'draft');

create policy company_objectives_select_member
  on public.company_objectives for select to authenticated
  using (private.is_company_member(company_id));

create policy company_objectives_insert_member
  on public.company_objectives for insert to authenticated
  with check (private.is_company_member(company_id));

create policy company_objectives_update_member
  on public.company_objectives for update to authenticated
  using (private.is_company_member(company_id))
  with check (private.is_company_member(company_id));

create policy company_objectives_delete_member
  on public.company_objectives for delete to authenticated
  using (private.is_company_member(company_id));

create policy company_systems_select_member
  on public.company_systems for select to authenticated
  using (private.is_company_member(company_id));

create policy company_systems_insert_member
  on public.company_systems for insert to authenticated
  with check (private.is_company_member(company_id));

create policy company_systems_update_member
  on public.company_systems for update to authenticated
  using (private.is_company_member(company_id))
  with check (private.is_company_member(company_id));

create policy company_systems_delete_member
  on public.company_systems for delete to authenticated
  using (private.is_company_member(company_id));

-- ---------------------------------------------------------------------------
-- Puntos de entrada expuestos (SECURITY INVOKER, operan bajo RLS)
-- ---------------------------------------------------------------------------

-- Devuelve el borrador vigente. Si no hay ninguno: clona la versión activa y sus hijos
-- cuando existe, o crea un borrador vacío cuando la empresa todavía no tiene contexto.
-- Idempotente y segura ante dos pestañas.
create function public.start_context_draft(p_context_schema_version text)
returns public.company_context_versions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_company_id uuid;
  v_draft      public.company_context_versions;
  v_active     public.company_context_versions;
begin
  if v_uid is null then
    raise exception 'praxa: se requiere una sesión autenticada'
      using errcode = '42501';
  end if;

  if p_context_schema_version is null or char_length(btrim(p_context_schema_version)) = 0 then
    raise exception 'praxa: se requiere la versión del esquema de contexto'
      using errcode = '22023';
  end if;

  select m.company_id into v_company_id
  from public.company_members m
  where m.user_id = v_uid
  limit 1;

  if v_company_id is null then
    raise exception 'praxa: el usuario no pertenece a ninguna empresa'
      using errcode = '42501';
  end if;

  select v.* into v_draft
  from public.company_context_versions v
  where v.company_id = v_company_id and v.status = 'draft';

  if found then
    return v_draft;
  end if;

  select v.* into v_active
  from public.company_context_versions v
  where v.company_id = v_company_id and v.status = 'active';

  begin
    insert into public.company_context_versions (
      company_id, context_schema_version, has_defined_objective,
      problems, constraints, additional_context, created_by
    )
    values (
      v_company_id,
      btrim(p_context_schema_version),
      coalesce(v_active.has_defined_objective, false),
      coalesce(v_active.problems, '[]'::jsonb),
      coalesce(v_active.constraints, '[]'::jsonb),
      v_active.additional_context,
      v_uid
    )
    returning * into v_draft;
  exception when unique_violation then
    -- Otra pestaña ganó la carrera contra ccv_one_draft_per_company.
    select v.* into strict v_draft
    from public.company_context_versions v
    where v.company_id = v_company_id and v.status = 'draft';
    return v_draft;
  end;

  if v_active.id is not null then
    insert into public.company_objectives (
      company_id, context_version_id, kind, title, description,
      priority, horizon, indicator_name, target_value, target_unit, position
    )
    select o.company_id, v_draft.id, o.kind, o.title, o.description,
           o.priority, o.horizon, o.indicator_name, o.target_value, o.target_unit, o.position
    from public.company_objectives o
    where o.context_version_id = v_active.id;

    insert into public.company_systems (
      company_id, context_version_id, system_key, label, notes
    )
    select s.company_id, v_draft.id, s.system_key, s.label, s.notes
    from public.company_systems s
    where s.context_version_id = v_active.id;
  end if;

  return v_draft;
end;
$$;

-- Activa un borrador de forma atómica e idempotente. Acá —y solo acá— se exige la
-- integridad completa del contexto.
create function public.activate_context_draft(p_version_id uuid)
returns public.company_context_versions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_version    public.company_context_versions;
  v_objectives integer;
  v_primary    integer;
  v_next       integer;
begin
  if v_uid is null then
    raise exception 'praxa: se requiere una sesión autenticada'
      using errcode = '42501';
  end if;

  select v.* into v_version
  from public.company_context_versions v
  where v.id = p_version_id;

  if not found then
    raise exception 'praxa: versión de contexto inexistente o ajena'
      using errcode = '42501';
  end if;

  if v_version.status = 'superseded' then
    raise exception 'praxa: no se puede activar una versión ya reemplazada'
      using errcode = '42501';
  end if;

  if v_version.status = 'active' then
    return v_version;  -- idempotente
  end if;

  -- Serializa activaciones concurrentes de la misma empresa. El respaldo real de
  -- corrección es ccv_one_active_per_company; este lock evita el error espurio.
  -- Se usa lock consultivo en vez de SELECT ... FOR UPDATE sobre `companies` para no
  -- acoplar la activación al privilegio de UPDATE sobre esa tabla.
  perform pg_advisory_xact_lock(hashtextextended(v_version.company_id::text, 0));

  -- Relectura bajo lock: otra transacción pudo activarlo mientras esperábamos.
  select v.* into v_version
  from public.company_context_versions v
  where v.id = p_version_id;

  if v_version.status = 'active' then
    return v_version;
  end if;

  select count(*), count(*) filter (where o.kind = 'primary')
    into v_objectives, v_primary
  from public.company_objectives o
  where o.context_version_id = v_version.id;

  if v_version.has_defined_objective then
    if v_objectives < 1 then
      raise exception 'praxa: un contexto con objetivo definido requiere al menos un objetivo'
        using errcode = '23514';
    end if;
    if v_primary <> 1 then
      raise exception 'praxa: se requiere exactamente un objetivo principal (hay %)', v_primary
        using errcode = '23514';
    end if;
  elsif v_objectives <> 0 then
    raise exception 'praxa: "sin objetivo definido" no puede convivir con % objetivo(s)', v_objectives
      using errcode = '23514';
  end if;

  update public.company_context_versions
     set status = 'superseded', superseded_at = now()
   where company_id = v_version.company_id and status = 'active';

  select coalesce(max(v.version), 0) + 1 into v_next
  from public.company_context_versions v
  where v.company_id = v_version.company_id;

  update public.company_context_versions
     set status = 'active', version = v_next, activated_at = now()
   where id = v_version.id
   returning * into v_version;

  return v_version;
end;
$$;
