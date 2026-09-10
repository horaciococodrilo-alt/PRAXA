-- PRAXA 0006 — Integridad de la activación y de las filas hijas
--
-- Corrige tres agujeros detectados en revisión sobre las migraciones 0002 y 0005. Las
-- anteriores ya se aplicaron a proyectos reales, así que esto va como migración nueva.
--
-- El hilo común de los tres: las reglas vivían en las RPC, y `authenticated` también
-- tiene permiso de UPDATE directo sobre las tablas. Toda regla que solo esté en la RPC
-- es evitable llamando a la Data API. Acá se bajan al trigger, que corre en TODOS los
-- caminos de escritura.
--
--   1. Se podía pasar un borrador a activo con un UPDATE directo, salteando la
--      validación de coherencia de objetivos que hace activate_context_draft().
--   2. El trigger de las filas hijas solo miraba la versión DESTINO. Se podía mover un
--      objetivo desde una versión activa hacia un borrador: pasaba el control porque el
--      destino era editable, y la versión activa —que debe ser inmutable— perdía la fila.
--   3. replace_draft_objectives()/replace_draft_systems() no participaban del cerrojo de
--      activate_context_draft(), así que una edición podía confirmarse después de que la
--      activación ya hubiera validado, dejando activo un contenido nunca validado.

-- ---------------------------------------------------------------------------
-- 1. La coherencia del contexto pasa a ser una regla de la base
-- ---------------------------------------------------------------------------

-- Antes vivía dentro de activate_context_draft(). Ahora es una función propia que el
-- trigger invoca en cada transición a `active`, venga de donde venga.
create function private.assert_context_coherent(
  p_version_id uuid,
  p_has_defined_objective boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total   integer;
  v_primary integer;
begin
  select count(*), count(*) filter (where o.kind = 'primary')
    into v_total, v_primary
  from public.company_objectives o
  where o.context_version_id = p_version_id;

  if p_has_defined_objective then
    if v_total < 1 then
      raise exception 'praxa: un contexto con objetivo definido requiere al menos un objetivo'
        using errcode = '23514';
    end if;
    if v_primary <> 1 then
      raise exception 'praxa: se requiere exactamente un objetivo principal (hay %)', v_primary
        using errcode = '23514';
    end if;
  elsif v_total <> 0 then
    raise exception 'praxa: "sin objetivo definido" no puede convivir con % objetivo(s)', v_total
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.assert_context_coherent(uuid, boolean) from public, anon;
grant execute on function private.assert_context_coherent(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. El trigger de versiones valida y numera la activación
-- ---------------------------------------------------------------------------

create or replace function private.enforce_context_version_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_next integer;
begin
  if tg_op = 'DELETE' then
    -- Excepción acotada al BORRADO administrativo fuera de banda: rol administrativo Y
    -- ningún usuario final detrás (`auth.uid()` nulo). Ver docs/SECURITY.md.
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

    if new.status = 'active' then
      -- La numeración y el sello NO se toman del llamador: se asignan acá. Así un UPDATE
      -- directo no puede elegir su propio número de versión ni fechar la activación.
      select coalesce(max(v.version), 0) + 1
        into v_next
      from public.company_context_versions v
      where v.company_id = old.company_id
        and v.version is not null;

      new.version      := v_next;
      new.activated_at := now();
      new.superseded_at := null;

      -- La validación que antes solo hacía la RPC. Ahora corre siempre.
      perform private.assert_context_coherent(old.id, new.has_defined_objective);
    end if;

    return new;
  end if;

  if old.status = 'active' then
    if new.status <> 'superseded' then
      raise exception 'praxa: una versión activa es inmutable; clonala a un borrador para editarla'
        using errcode = '42501';
    end if;

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

-- ---------------------------------------------------------------------------
-- 3. Las filas hijas se anclan a su versión y protegen origen y destino
-- ---------------------------------------------------------------------------

create or replace function private.enforce_child_parent_is_draft()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_parents uuid[];
  v_parent  uuid;
  v_status  public.context_status;
begin
  if tg_op = 'DELETE'
     and current_user in ('service_role', 'supabase_admin', 'postgres')
     and (select auth.uid()) is null then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- Reasignar una fila hija a otra versión permitía vaciar una versión activa
    -- (inmutable) pasando el control porque el DESTINO era un borrador.
    if new.context_version_id is distinct from old.context_version_id then
      raise exception 'praxa: una fila de contexto no se puede mover entre versiones'
        using errcode = '42501';
    end if;
    if new.company_id is distinct from old.company_id then
      raise exception 'praxa: una fila de contexto no se puede mover entre empresas'
        using errcode = '42501';
    end if;
  end if;

  -- Se comprueban TODAS las versiones involucradas, no solo la de destino.
  if tg_op = 'INSERT' then
    v_parents := array[new.context_version_id];
  elsif tg_op = 'DELETE' then
    v_parents := array[old.context_version_id];
  else
    v_parents := array[old.context_version_id, new.context_version_id];
  end if;

  foreach v_parent in array v_parents loop
    if v_parent is null then
      continue;
    end if;

    select v.status into v_status
    from public.company_context_versions v
    where v.id = v_parent;

    -- Padre ausente: estamos dentro de un borrado en cascada. Nada que proteger.
    if not found then
      continue;
    end if;

    if v_status <> 'draft' then
      raise exception 'praxa: la versión de contexto % no está en borrador y no admite cambios', v_parent
        using errcode = '42501';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Edición y activación comparten el mismo cerrojo
-- ---------------------------------------------------------------------------
--
-- `activate_context_draft` ya tomaba un lock consultivo por empresa. Las funciones de
-- edición no, así que podían intercalarse: la activación validaba, y la edición commiteaba
-- después sobre una versión ya activa. Ahora ambas toman el mismo cerrojo y releen el
-- estado una vez adquirido.

create or replace function public.replace_draft_objectives(p_version_id uuid, p_objectives jsonb)
returns setof public.company_objectives
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_status     public.context_status;
begin
  if (select auth.uid()) is null then
    raise exception 'praxa: se requiere una sesión autenticada' using errcode = '42501';
  end if;

  if p_objectives is null or jsonb_typeof(p_objectives) <> 'array' then
    raise exception 'praxa: se espera un arreglo de objetivos' using errcode = '22023';
  end if;

  select v.company_id into v_company_id
  from public.company_context_versions v
  where v.id = p_version_id;

  if not found then
    raise exception 'praxa: versión de contexto inexistente o ajena' using errcode = '42501';
  end if;

  -- Mismo cerrojo que activate_context_draft: serializa edición y confirmación.
  perform pg_advisory_xact_lock(hashtextextended(v_company_id::text, 0));

  -- Relectura bajo cerrojo: pudo activarse mientras esperábamos.
  select v.status into v_status
  from public.company_context_versions v
  where v.id = p_version_id;

  if v_status <> 'draft' then
    raise exception 'praxa: solo se puede editar una versión en borrador' using errcode = '42501';
  end if;

  delete from public.company_objectives where context_version_id = p_version_id;

  insert into public.company_objectives (
    company_id, context_version_id, kind, title, description,
    priority, horizon, indicator_name, target_value, target_unit, position
  )
  select
    v_company_id,
    p_version_id,
    coalesce(nullif(o->>'kind', ''), 'secondary')::public.objective_kind,
    btrim(o->>'title'),
    nullif(btrim(coalesce(o->>'description', '')), ''),
    nullif(o->>'priority', '')::public.objective_priority,
    nullif(o->>'horizon', '')::public.objective_horizon,
    nullif(btrim(coalesce(o->>'indicator_name', '')), ''),
    nullif(o->>'target_value', '')::numeric,
    nullif(btrim(coalesce(o->>'target_unit', '')), ''),
    coalesce(nullif(o->>'position', '')::integer, (ord - 1)::integer)
  from jsonb_array_elements(p_objectives) with ordinality as t(o, ord);

  return query
    select * from public.company_objectives
    where context_version_id = p_version_id
    order by position, created_at;
end;
$$;

create or replace function public.replace_draft_systems(p_version_id uuid, p_systems jsonb)
returns setof public.company_systems
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_status     public.context_status;
begin
  if (select auth.uid()) is null then
    raise exception 'praxa: se requiere una sesión autenticada' using errcode = '42501';
  end if;

  if p_systems is null or jsonb_typeof(p_systems) <> 'array' then
    raise exception 'praxa: se espera un arreglo de sistemas' using errcode = '22023';
  end if;

  select v.company_id into v_company_id
  from public.company_context_versions v
  where v.id = p_version_id;

  if not found then
    raise exception 'praxa: versión de contexto inexistente o ajena' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_company_id::text, 0));

  select v.status into v_status
  from public.company_context_versions v
  where v.id = p_version_id;

  if v_status <> 'draft' then
    raise exception 'praxa: solo se puede editar una versión en borrador' using errcode = '42501';
  end if;

  delete from public.company_systems where context_version_id = p_version_id;

  insert into public.company_systems (company_id, context_version_id, system_key, label, notes)
  select
    v_company_id,
    p_version_id,
    btrim(s->>'system_key'),
    nullif(btrim(coalesce(s->>'label', '')), ''),
    nullif(btrim(coalesce(s->>'notes', '')), '')
  from jsonb_array_elements(p_systems) as s;

  return query
    select * from public.company_systems
    where context_version_id = p_version_id
    order by system_key;
end;
$$;
