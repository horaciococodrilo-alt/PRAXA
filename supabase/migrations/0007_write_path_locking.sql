-- PRAXA 0007 — Una sola vía de escritura para el contexto, y un solo cerrojo
--
-- La 0006 puso el cerrojo consultivo dentro de replace_draft_objectives() y
-- replace_draft_systems(), pero `authenticated` conservaba INSERT/UPDATE/DELETE directos
-- sobre las tablas hijas y podía activar un borrador con un UPDATE directo. Esas vías no
-- pasaban por el cerrojo, así que la carrera seguía abierta:
--
--   T1  empieza a borrar objetivos de un borrador (sin confirmar todavía)
--   T2  activa ese borrador viendo los objetivos anteriores, y valida contra ellos
--   T1  confirma el borrado
--   =>  queda activo un contexto con contenido distinto del que se validó
--
-- POR QUÉ NO SE RESUELVE CON UN TRIGGER QUE TOME EL CERROJO
--
-- Un trigger FOR EACH ROW corre DESPUÉS de que la sentencia ya tomó el bloqueo de fila.
-- Tomar ahí el cerrojo consultivo invierte el orden de adquisición respecto de las RPC
-- (que lo toman antes de tocar filas) y abre un interbloqueo real: una transacción con
-- filas bloqueadas esperando el cerrojo, y otra con el cerrojo esperando esas filas.
--
-- ESTRATEGIA
--
-- Las vías que no se pueden proteger se cierran, y queda una sola que sí se protege:
--
--   1. Se revocan INSERT/UPDATE/DELETE directos sobre las tablas hijas. La aplicación
--      nunca los usó: solo lee esas tablas y escribe por RPC.
--   2. Las RPC de edición conservan la validación bajo RLS y delegan la escritura en
--      funciones privadas, que vuelven a verificar la pertenencia por su cuenta.
--   3. La activación por UPDATE directo queda prohibida: solo activate_context_draft()
--      puede hacer la transición borrador → activo.
--
-- ORDEN DE ADQUISICIÓN, ÚNICO PARA TODO EL SISTEMA
--
--   (1) cerrojo consultivo de la empresa   (2) bloqueos de fila
--
-- Todas las vías de escritura restantes lo respetan, así que no hay ciclos posibles.
-- Los UPDATE directos sobre `company_context_versions` (editar campos del borrador) NO
-- toman el cerrojo a propósito: operan sobre la MISMA fila que la activación, así que el
-- bloqueo de fila ya los serializa, y pedirles el cerrojo invertiría el orden.

-- ---------------------------------------------------------------------------
-- 1. El cerrojo, con nombre
-- ---------------------------------------------------------------------------

create function private.lock_company(p_company_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_company_id is null then
    raise exception 'praxa: se requiere una empresa para tomar el cerrojo'
      using errcode = '22023';
  end if;

  -- Consultivo y de transacción: se libera solo al terminar, sin importar cómo termine.
  perform pg_advisory_xact_lock(hashtextextended(p_company_id::text, 0));
end;
$$;

revoke all on function private.lock_company(uuid) from public, anon;
grant execute on function private.lock_company(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Se cierran las vías de escritura directa a las tablas hijas
-- ---------------------------------------------------------------------------

revoke insert, update, delete on public.company_objectives from authenticated;
revoke insert, update, delete on public.company_systems    from authenticated;

-- Las políticas de escritura quedaban inertes al no haber privilegio; se eliminan para
-- que el modelo de acceso se lea sin ambigüedad. SELECT no se toca.
drop policy if exists company_objectives_insert_member on public.company_objectives;
drop policy if exists company_objectives_update_member on public.company_objectives;
drop policy if exists company_objectives_delete_member on public.company_objectives;

drop policy if exists company_systems_insert_member on public.company_systems;
drop policy if exists company_systems_update_member on public.company_systems;
drop policy if exists company_systems_delete_member on public.company_systems;

-- ---------------------------------------------------------------------------
-- 3. Escritura de las listas: privilegio acotado a funciones privadas
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER acá es inevitable: `authenticated` ya no puede escribir estas tablas.
-- El privilegio queda encerrado en `private`, que no está expuesto por la Data API, y
-- cada función vuelve a verificar la pertenencia con auth.uid() —que sigue siendo el
-- usuario final aunque el rol de ejecución cambie— y que la versión sea un borrador de
-- esa misma empresa.

create function private.write_draft_objectives(
  p_company_id uuid,
  p_version_id uuid,
  p_objectives jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.context_status;
begin
  if not private.is_company_member(p_company_id) then
    raise exception 'praxa: la empresa no pertenece al usuario' using errcode = '42501';
  end if;

  select v.status into v_status
  from public.company_context_versions v
  where v.id = p_version_id and v.company_id = p_company_id;

  if not found then
    raise exception 'praxa: versión de contexto inexistente o de otra empresa'
      using errcode = '42501';
  end if;

  if v_status <> 'draft' then
    raise exception 'praxa: solo se puede editar una versión en borrador'
      using errcode = '42501';
  end if;

  delete from public.company_objectives where context_version_id = p_version_id;

  insert into public.company_objectives (
    company_id, context_version_id, kind, title, description,
    priority, horizon, indicator_name, target_value, target_unit, position
  )
  select
    p_company_id,
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
end;
$$;

create function private.write_draft_systems(
  p_company_id uuid,
  p_version_id uuid,
  p_systems jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.context_status;
begin
  if not private.is_company_member(p_company_id) then
    raise exception 'praxa: la empresa no pertenece al usuario' using errcode = '42501';
  end if;

  select v.status into v_status
  from public.company_context_versions v
  where v.id = p_version_id and v.company_id = p_company_id;

  if not found then
    raise exception 'praxa: versión de contexto inexistente o de otra empresa'
      using errcode = '42501';
  end if;

  if v_status <> 'draft' then
    raise exception 'praxa: solo se puede editar una versión en borrador'
      using errcode = '42501';
  end if;

  delete from public.company_systems where context_version_id = p_version_id;

  insert into public.company_systems (company_id, context_version_id, system_key, label, notes)
  select
    p_company_id,
    p_version_id,
    btrim(s->>'system_key'),
    nullif(btrim(coalesce(s->>'label', '')), ''),
    nullif(btrim(coalesce(s->>'notes', '')), '')
  from jsonb_array_elements(p_systems) as s;
end;
$$;

revoke all on function private.write_draft_objectives(uuid, uuid, jsonb) from public, anon;
revoke all on function private.write_draft_systems(uuid, uuid, jsonb)    from public, anon;
grant execute on function private.write_draft_objectives(uuid, uuid, jsonb) to authenticated;
grant execute on function private.write_draft_systems(uuid, uuid, jsonb)    to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Las RPC: cerrojo primero, relectura bajo cerrojo, después escribir
-- ---------------------------------------------------------------------------

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

  -- Bajo RLS: si el usuario no puede ver esta versión, para él no existe.
  select v.company_id into v_company_id
  from public.company_context_versions v
  where v.id = p_version_id;

  if not found then
    raise exception 'praxa: versión de contexto inexistente o ajena' using errcode = '42501';
  end if;

  -- (1) cerrojo, antes de tocar ninguna fila.
  perform private.lock_company(v_company_id);

  -- (2) relectura: mientras esperábamos, el borrador pudo activarse.
  select v.status into v_status
  from public.company_context_versions v
  where v.id = p_version_id;

  if v_status <> 'draft' then
    raise exception 'praxa: solo se puede editar una versión en borrador' using errcode = '42501';
  end if;

  perform private.write_draft_objectives(v_company_id, p_version_id, p_objectives);

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

  perform private.lock_company(v_company_id);

  select v.status into v_status
  from public.company_context_versions v
  where v.id = p_version_id;

  if v_status <> 'draft' then
    raise exception 'praxa: solo se puede editar una versión en borrador' using errcode = '42501';
  end if;

  perform private.write_draft_systems(v_company_id, p_version_id, p_systems);

  return query
    select * from public.company_systems
    where context_version_id = p_version_id
    order by system_key;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. La activación, solo por su función
-- ---------------------------------------------------------------------------
--
-- Se usa una marca local de transacción que solo activate_context_draft() puede poner.
-- `set_config` vive en pg_catalog, que no está expuesto por la Data API, así que un
-- cliente no puede fijarla: no hay forma de simular la marca desde afuera.

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
      -- Solo la RPC deja la marca, y solo para esta versión.
      if coalesce(nullif(current_setting('praxa.activating_version', true), ''), '')
         is distinct from old.id::text then
        raise exception 'praxa: la activación solo puede hacerse con public.activate_context_draft()'
          using errcode = '42501';
      end if;

      select coalesce(max(v.version), 0) + 1
        into v_next
      from public.company_context_versions v
      where v.company_id = old.company_id
        and v.version is not null;

      new.version       := v_next;
      new.activated_at  := now();
      new.superseded_at := null;

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

create or replace function public.activate_context_draft(p_version_id uuid)
returns public.company_context_versions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_version public.company_context_versions;
begin
  if v_uid is null then
    raise exception 'praxa: se requiere una sesión autenticada' using errcode = '42501';
  end if;

  select v.* into v_version
  from public.company_context_versions v
  where v.id = p_version_id;

  if not found then
    raise exception 'praxa: versión de contexto inexistente o ajena' using errcode = '42501';
  end if;

  if v_version.status = 'superseded' then
    raise exception 'praxa: no se puede activar una versión ya reemplazada' using errcode = '42501';
  end if;

  if v_version.status = 'active' then
    return v_version;  -- idempotente
  end if;

  -- (1) cerrojo, antes de tocar ninguna fila. Mismo que toman las RPC de edición.
  perform private.lock_company(v_version.company_id);

  -- (2) relectura bajo cerrojo: pudo activarse mientras esperábamos.
  select v.* into v_version
  from public.company_context_versions v
  where v.id = p_version_id;

  if v_version.status = 'active' then
    return v_version;
  end if;

  if v_version.status = 'superseded' then
    raise exception 'praxa: no se puede activar una versión ya reemplazada' using errcode = '42501';
  end if;

  -- La coherencia la vuelve a exigir el trigger; esto da el error temprano y claro.
  perform private.assert_context_coherent(v_version.id, v_version.has_defined_objective);

  update public.company_context_versions
     set status = 'superseded', superseded_at = now()
   where company_id = v_version.company_id and status = 'active';

  -- Marca de transacción que habilita la transición en el trigger.
  perform set_config('praxa.activating_version', v_version.id::text, true);

  update public.company_context_versions
     set status = 'active'
   where id = v_version.id
   returning * into v_version;

  perform set_config('praxa.activating_version', '', true);

  return v_version;
end;
$$;
