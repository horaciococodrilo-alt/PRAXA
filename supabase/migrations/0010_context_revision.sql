-- PRAXA 0010 — Confirmación contra la revisión que el usuario efectivamente vio
--
-- EL PROBLEMA
--
-- `activate_context_draft()` recibía solo el id del borrador y activaba lo que hubiera en
-- ese momento. Con el mismo borrador abierto en dos pestañas:
--
--   pestaña A  guarda un objetivo distinto
--   pestaña B  confirma, mostrando todavía el contenido anterior
--   =>         se activa contenido que B nunca revisó
--
-- La interfaz avisaba del cambio, pero no bloqueaba, y el aviso se apoyaba en
-- `updated_at` de la fila de contexto: cambiar solo objetivos o sistemas no la toca, así
-- que ni siquiera se enteraba.
--
-- LA SOLUCIÓN
--
-- Una "revisión" que resume TODO el contexto relevante —la fila y sus dos listas— y que
-- la confirmación debe traer consigo. La comprobación ocurre **dentro de la misma
-- transacción que activa**, después de tomar el cerrojo, así que no hay ventana entre
-- comprobar y activar: cualquier escritura concurrente tuvo que soltar el cerrojo antes,
-- y su cambio queda reflejado en la revisión que se recalcula acá.
--
-- La revisión se CALCULA, no se guarda. Una columna habría que mantenerla sincronizada
-- con triggers en tres tablas, y cualquier camino que se olvidara de tocarla dejaría
-- pasar un conflicto en silencio. Calcularla no puede desincronizarse.
--
-- Nota: `replace_draft_*` borra y reinserta, así que los identificadores de las filas
-- hijas cambian y la revisión cambia con ellos aunque el contenido sea idéntico. Es
-- conservador a propósito: preferimos pedir una relectura de más que activar de menos.

-- ---------------------------------------------------------------------------
-- 1. La revisión
-- ---------------------------------------------------------------------------

create function private.compute_context_revision(p_version_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select md5(
    coalesce(
      (
        select v.id::text
          || '|' || v.status::text
          || '|' || coalesce(v.version::text, '')
          || '|' || v.context_schema_version
          || '|' || v.has_defined_objective::text
          || '|' || v.problems::text
          || '|' || v.constraints::text
          || '|' || coalesce(v.additional_context, '')
        from public.company_context_versions v
        where v.id = p_version_id
      ),
      ''
    )
    || '#objetivos#'
    || coalesce(
      (
        select string_agg(
          o.id::text
            || '|' || o.kind::text
            || '|' || o.title
            || '|' || coalesce(o.description, '')
            || '|' || coalesce(o.priority::text, '')
            || '|' || coalesce(o.horizon::text, '')
            || '|' || coalesce(o.indicator_name, '')
            || '|' || coalesce(o.target_value::text, '')
            || '|' || coalesce(o.target_unit, '')
            || '|' || o.position::text,
          ','
          order by o.id
        )
        from public.company_objectives o
        where o.context_version_id = p_version_id
      ),
      ''
    )
    || '#sistemas#'
    || coalesce(
      (
        select string_agg(
          s.id::text
            || '|' || s.system_key
            || '|' || coalesce(s.label, '')
            || '|' || coalesce(s.notes, ''),
          ','
          order by s.id
        )
        from public.company_systems s
        where s.context_version_id = p_version_id
      ),
      ''
    )
  );
$$;

revoke all on function private.compute_context_revision(uuid) from public, anon;
grant execute on function private.compute_context_revision(uuid) to authenticated;

-- Punto de lectura para la aplicación. SECURITY INVOKER: si el usuario no puede ver la
-- versión, la revisión que obtiene es la de un contexto vacío, no la ajena.
create function public.context_revision(p_version_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.compute_context_revision(p_version_id);
$$;

revoke all on function public.context_revision(uuid) from public, anon;
grant execute on function public.context_revision(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. La activación exige la revisión esperada
-- ---------------------------------------------------------------------------
--
-- Se reemplaza la firma de un solo argumento: dejarla habría dejado abierta una vía sin
-- comprobación de revisión.

drop function if exists public.activate_context_draft(uuid);

create function public.activate_context_draft(
  p_version_id uuid,
  p_expected_revision text
)
returns public.company_context_versions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_version  public.company_context_versions;
  v_revision text;
begin
  if v_uid is null then
    raise exception 'praxa: se requiere una sesión autenticada' using errcode = '42501';
  end if;

  if p_expected_revision is null or char_length(btrim(p_expected_revision)) = 0 then
    raise exception 'praxa: se requiere la revisión del contexto que se está confirmando'
      using errcode = '22023';
  end if;

  -- Bajo RLS. El id viene del navegador, pero no autoriza nada: si la versión es de otra
  -- empresa, sencillamente no se ve.
  select v.* into v_version
  from public.company_context_versions v
  where v.id = p_version_id;

  if not found then
    raise exception 'praxa: versión de contexto inexistente o ajena' using errcode = '42501';
  end if;

  if v_version.status = 'superseded' then
    raise exception 'praxa: no se puede activar una versión ya reemplazada' using errcode = '42501';
  end if;

  -- Idempotencia del reintento: si ya está activa, se devuelve tal cual. No se compara la
  -- revisión porque activar la cambia (status y version forman parte de ella), y un
  -- reintento legítimo traería la de antes de activar.
  if v_version.status = 'active' then
    return v_version;
  end if;

  -- (1) cerrojo, antes de tocar ninguna fila y antes de comprobar la revisión.
  perform private.lock_company(v_version.company_id);

  -- (2) relectura bajo cerrojo.
  select v.* into v_version
  from public.company_context_versions v
  where v.id = p_version_id;

  if v_version.status = 'active' then
    return v_version;
  end if;

  if v_version.status = 'superseded' then
    raise exception 'praxa: no se puede activar una versión ya reemplazada' using errcode = '42501';
  end if;

  -- (3) la revisión se calcula ACÁ, con el cerrojo tomado y en la misma transacción que
  -- va a activar. Cualquier escritura concurrente ya soltó el cerrojo y está reflejada.
  v_revision := private.compute_context_revision(v_version.id);

  if v_revision is distinct from p_expected_revision then
    raise exception
      'praxa: el borrador cambió desde que lo revisaste; volvé a cargarlo antes de confirmar'
      using errcode = '40001';
  end if;

  perform private.assert_context_coherent(v_version.id, v_version.has_defined_objective);

  update public.company_context_versions
     set status = 'superseded', superseded_at = now()
   where company_id = v_version.company_id and status = 'active';

  perform set_config('praxa.activating_version', v_version.id::text, true);

  update public.company_context_versions
     set status = 'active'
   where id = v_version.id
   returning * into v_version;

  perform set_config('praxa.activating_version', '', true);

  return v_version;
end;
$$;

revoke all on function public.activate_context_draft(uuid, text) from public, anon;
grant execute on function public.activate_context_draft(uuid, text) to authenticated;
