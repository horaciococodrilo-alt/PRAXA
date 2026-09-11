-- PRAXA 0011 — El conflicto de revisión no es un error transitorio
--
-- La 0010 señalaba la revisión desactualizada con SQLSTATE 40001. Fue un error: la clase
-- 40 es `transaction_rollback` / `serialization_failure`, que por convención significa
-- "volvé a intentarlo, puede salir distinto". La infraestructura le hace caso: PostgREST
-- reintenta, y como la revisión sigue siendo la misma vuelve a fallar, en un bucle que
-- termina en `upstream request timeout` después de dos minutos.
--
-- Se vio solo probando a través de la pila real: por conexión SQL directa el rechazo
-- tardaba 171 ms, porque ahí no hay ninguna capa que reintente.
--
-- Un conflicto de revisión es lo contrario de transitorio: reintentarlo con la misma
-- revisión SIEMPRE debe fallar. La única salida es que el usuario recargue y vuelva a
-- mirar. Se usa `PT409`, la convención de PostgREST para fijar el estado HTTP: 409
-- Conflict, que no se reintenta y describe exactamente lo que pasó.

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

  select v.* into v_version
  from public.company_context_versions v
  where v.id = p_version_id;

  if v_version.status = 'active' then
    return v_version;
  end if;

  if v_version.status = 'superseded' then
    raise exception 'praxa: no se puede activar una versión ya reemplazada' using errcode = '42501';
  end if;

  -- Con el cerrojo tomado y en la misma transacción que va a activar: sin ventana.
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
