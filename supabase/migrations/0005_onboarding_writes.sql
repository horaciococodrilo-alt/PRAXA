-- PRAXA 0005 — Escritura atómica de las listas del onboarding
--
-- Objetivos y sistemas se editan como listas completas. Hacerlo desde el cliente con un
-- DELETE seguido de un INSERT dejaría una ventana en la que un fallo entre ambos borra lo
-- que el usuario ya había cargado. Estas funciones hacen el reemplazo dentro de una sola
-- transacción.
--
-- Siguen siendo SECURITY INVOKER: operan bajo RLS, sin privilegios elevados. El
-- `company_id` se toma de la versión de contexto en la base, NUNCA del navegador.

create function public.replace_draft_objectives(p_version_id uuid, p_objectives jsonb)
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

  -- RLS decide si esta versión es visible. Si no lo es, no existe para este usuario.
  select v.company_id, v.status into v_company_id, v_status
  from public.company_context_versions v
  where v.id = p_version_id;

  if not found then
    raise exception 'praxa: versión de contexto inexistente o ajena' using errcode = '42501';
  end if;

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

create function public.replace_draft_systems(p_version_id uuid, p_systems jsonb)
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

  select v.company_id, v.status into v_company_id, v_status
  from public.company_context_versions v
  where v.id = p_version_id;

  if not found then
    raise exception 'praxa: versión de contexto inexistente o ajena' using errcode = '42501';
  end if;

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

revoke all on function public.replace_draft_objectives(uuid, jsonb) from public, anon;
revoke all on function public.replace_draft_systems(uuid, jsonb)    from public, anon;

grant execute on function public.replace_draft_objectives(uuid, jsonb) to authenticated;
grant execute on function public.replace_draft_systems(uuid, jsonb)    to authenticated;
