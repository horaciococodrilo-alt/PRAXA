-- PRAXA 0015 — La activación toma el cerrojo de la fila del borrador antes de comprobar la revisión
--
-- H-E1-124. `activate_context_draft` toma el cerrojo consultivo de la empresa y recién después
-- calcula la revisión. Pero la edición DIRECTA de las columnas del borrador (`problems`,
-- `constraints`, `additional_context`) no toma ese cerrojo: solo bloquea la fila. La
-- intercalación peligrosa era:
--
--   T1  BEGIN, actualiza `additional_context` del borrador      ← sin confirmar
--   T2  BEGIN, activa: lee el borrador viejo, la revisión coincide con la esperada
--   T2  intenta marcar la versión como activa y espera la fila de T1
--   T1  COMMIT
--   T2  continúa sobre la fila nueva y activa contenido que el usuario no revisó
--
-- La corrección es bloquear la fila (`for update`) en la relectura posterior al cerrojo
-- consultivo y antes de calcular la revisión. Si T1 tiene la fila, T2 espera; cuando T1
-- confirma, PostgreSQL devuelve la versión nueva de la fila, la revisión calculada ya no
-- coincide con la esperada y la activación se rechaza con PT409.
--
-- El orden de los cerrojos es siempre el mismo (consultivo de la empresa y después fila), y
-- las escrituras que toman el cerrojo consultivo no esperan por la fila antes de tomarlo,
-- así que no se introduce ningún ciclo.
--
-- No cambia la firma, los privilegios ni los códigos de error de la 0011. No se edita la 0011:
-- esta migración la reemplaza con `create or replace`.

create or replace function public.activate_context_draft(
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

  select v.* into v_version
  from public.company_context_versions v
  where v.id = p_version_id;

  if not found then
    raise exception 'praxa: versión de contexto inexistente o ajena' using errcode = '42501';
  end if;

  if v_version.status = 'superseded' then
    raise exception 'praxa: no se puede activar una versión ya reemplazada' using errcode = '42501';
  end if;

  -- Idempotencia del reintento legítimo: activar cambia la revisión, así que un reintento
  -- traería la de antes. Se devuelve sin comparar.
  if v_version.status = 'active' then
    return v_version;
  end if;

  perform private.lock_company(v_version.company_id);

  -- Relectura con la fila bloqueada: una edición directa sin confirmar espera acá y, al
  -- confirmarse, esta lectura ya ve su contenido.
  select v.* into v_version
  from public.company_context_versions v
  where v.id = p_version_id
  for update;

  if v_version.status = 'active' then
    return v_version;
  end if;

  if v_version.status = 'superseded' then
    raise exception 'praxa: no se puede activar una versión ya reemplazada' using errcode = '42501';
  end if;

  -- Con el cerrojo de la empresa y el de la fila tomados, en la misma transacción que va a
  -- activar: sin ventana.
  v_revision := private.compute_context_revision(v_version.id);

  if v_revision is distinct from p_expected_revision then
    raise exception
      'praxa: el borrador cambió desde que lo revisaste; volvé a cargarlo antes de confirmar'
      using errcode = 'PT409';
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
