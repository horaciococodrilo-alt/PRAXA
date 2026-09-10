-- PRAXA 0009 — start_context_draft() vuelve a poder clonar
--
-- La 0007 revocó la escritura directa sobre las tablas hijas para que toda edición
-- pasara por las RPC con cerrojo. Pero `start_context_draft()` también escribe esas
-- tablas: al abrir un borrador sobre un contexto ya activo, copia sus objetivos y
-- sistemas. Al ser SECURITY INVOKER, se quedó sin privilegio y la función de "editar
-- contexto" habría fallado con `permission denied for table company_objectives`.
--
-- Se aplica el mismo patrón que en 0007: la RPC sigue siendo INVOKER y valida bajo RLS;
-- la escritura se delega en una función privada que vuelve a verificar la pertenencia.
--
-- Se aprovecha para que también tome el cerrojo de la empresa antes de tocar filas, con
-- el mismo orden que el resto: (1) cerrojo, (2) filas. Así abrir un borrador y activar
-- otro no se pisan.

create function private.clone_context_children(
  p_company_id uuid,
  p_from_version uuid,
  p_to_version uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_to_status public.context_status;
begin
  if not private.is_company_member(p_company_id) then
    raise exception 'praxa: la empresa no pertenece al usuario' using errcode = '42501';
  end if;

  -- Ambas versiones tienen que ser de esa empresa: nunca se clona entre empresas.
  if not exists (
    select 1 from public.company_context_versions v
    where v.id = p_from_version and v.company_id = p_company_id
  ) then
    raise exception 'praxa: versión de origen inexistente o de otra empresa'
      using errcode = '42501';
  end if;

  select v.status into v_to_status
  from public.company_context_versions v
  where v.id = p_to_version and v.company_id = p_company_id;

  if not found then
    raise exception 'praxa: versión de destino inexistente o de otra empresa'
      using errcode = '42501';
  end if;

  if v_to_status <> 'draft' then
    raise exception 'praxa: solo se puede clonar hacia un borrador' using errcode = '42501';
  end if;

  insert into public.company_objectives (
    company_id, context_version_id, kind, title, description,
    priority, horizon, indicator_name, target_value, target_unit, position
  )
  select o.company_id, p_to_version, o.kind, o.title, o.description,
         o.priority, o.horizon, o.indicator_name, o.target_value, o.target_unit, o.position
  from public.company_objectives o
  where o.context_version_id = p_from_version;

  insert into public.company_systems (company_id, context_version_id, system_key, label, notes)
  select s.company_id, p_to_version, s.system_key, s.label, s.notes
  from public.company_systems s
  where s.context_version_id = p_from_version;
end;
$$;

revoke all on function private.clone_context_children(uuid, uuid, uuid) from public, anon;
grant execute on function private.clone_context_children(uuid, uuid, uuid) to authenticated;

create or replace function public.start_context_draft(p_context_schema_version text)
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
    raise exception 'praxa: se requiere una sesión autenticada' using errcode = '42501';
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
    raise exception 'praxa: el usuario no pertenece a ninguna empresa' using errcode = '42501';
  end if;

  -- (1) cerrojo, antes de tocar filas. Mismo orden que las demás vías de escritura.
  perform private.lock_company(v_company_id);

  -- (2) relectura bajo cerrojo.
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
    select v.* into strict v_draft
    from public.company_context_versions v
    where v.company_id = v_company_id and v.status = 'draft';
    return v_draft;
  end;

  if v_active.id is not null then
    perform private.clone_context_children(v_company_id, v_active.id, v_draft.id);
  end if;

  return v_draft;
end;
$$;
