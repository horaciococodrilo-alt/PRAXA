-- PRAXA 0024 — Diagnóstico con sección de la tienda (M16e, etapa .5; spec §6, A-04, D-M16e-15)
--
-- Solo `diagnostic_reports` y su publicación. Un informe sin sección de tienda sigue siendo
-- versión 1 ('meta-diag-1'), igual que antes; uno con «Ventas de la tienda» es versión 2
-- ('meta-tn-diag-1') y apunta a la conexión de Tiendanube de la que salió la sección. Los
-- informes v1 ya guardados cumplen las reglas nuevas sin tocarlos.
--
-- MATRIZ (sin cambios de grants respecto de 0022):
--   public.diagnostic_reports            : SELECT authenticated (miembro; conexión de Meta active
--                                          o needs_reauth y, si es v2, también la de la tienda).
--                                          Sin escritura directa.
--   worker_api.publish_diagnostic(uuid,uuid,uuid,uuid,integer,jsonb,uuid)
--                                        : DEFINER, solo praxa_integrations. Reemplaza a la firma de
--                                          seis argumentos; el séptimo tiene default null, así que
--                                          la llamada de seis argumentos sigue resolviendo (v1).
--   private.diagnostic_reports_store_only: función de trigger, sin EXECUTE para nadie.
--
-- RETENCIÓN (nota «Enmienda D-M16e-15», §16 de la ruta). El informe sigue sin FK a la conexión
-- de Meta. El v2 tiene FK compuesta a la conexión de la tienda con ON DELETE CASCADE: la purga
-- al desconectar Tiendanube y `tn_privacy_store_redact` borran la fila de la conexión y el
-- informe cae con ella. `customer/redact` no lo toca: el informe solo tiene totales.
--
-- CATÁLOGO DE ERRORES: se reutilizan los existentes; no hay códigos nuevos.

-- ---------------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------------

alter table public.diagnostic_reports add column store_connection_id uuid;

alter table public.diagnostic_reports drop constraint diagnostic_reports_versions;
alter table public.diagnostic_reports
  add constraint diagnostic_reports_versions
    check ((schema_version = 1 and methodology_version = 'meta-diag-1' and store_connection_id is null)
        or (schema_version = 2 and methodology_version = 'meta-tn-diag-1' and store_connection_id is not null)),
  add constraint diagnostic_reports_store_connection_fkey
    foreign key (company_id, store_connection_id)
    references public.integration_connections (company_id, id) on delete cascade;

create index diagnostic_reports_store_connection_idx
  on public.diagnostic_reports (company_id, store_connection_id)
  where store_connection_id is not null;

-- La conexión de la sección tiene que ser de Tiendanube. Una de otra empresa ya la rechaza la
-- FK; acá se rechaza una conexión de la misma empresa con otro proveedor.
create function private.diagnostic_reports_store_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.store_connection_id is not null and exists (
    select 1 from public.integration_connections c
     where c.id = new.store_connection_id
       and c.company_id = new.company_id
       and c.provider::text <> 'tiendanube'
  ) then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;
  return new;
end;
$$;

revoke all on function private.diagnostic_reports_store_only()
  from public, anon, authenticated, service_role, praxa_integrations;

create trigger diagnostic_reports_store_only
  before insert or update of store_connection_id on public.diagnostic_reports
  for each row execute function private.diagnostic_reports_store_only();

-- La base, no solo la pantalla, oculta el v2 cuando la conexión de la tienda deja de estar
-- vigente, aunque Meta siga activa.
drop policy diagnostic_reports_select_member on public.diagnostic_reports;
create policy diagnostic_reports_select_member
  on public.diagnostic_reports for select to authenticated
  using (
    private.is_company_member(diagnostic_reports.company_id)
    and exists (
      select 1 from public.integration_connections c
       where c.id = diagnostic_reports.connection_id
         and c.company_id = diagnostic_reports.company_id
         and c.status in ('active', 'needs_reauth'))
    and (diagnostic_reports.store_connection_id is null or exists (
      select 1 from public.integration_connections t
       where t.id = diagnostic_reports.store_connection_id
         and t.company_id = diagnostic_reports.company_id
         and t.provider::text = 'tiendanube'
         and t.status in ('active', 'needs_reauth')))
  );

-- ---------------------------------------------------------------------------
-- Forma persistida: v1 igual que en 0022; v2 suma `evidence.store`
-- ---------------------------------------------------------------------------

create or replace function private.meta_diagnostic_valid_report(
  p_report jsonb, p_window_to date, p_sync_finished_at timestamptz)
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce(
    private.meta_has_exact_keys(p_report, array['schema_version','methodology_version','window',
      'settings','sync_finished_at','evidence','output','web_sources','model_requested',
      'model_reported','usage'])
    and pg_catalog.octet_length(p_report::text) <= 1048576
    and ((p_report->'schema_version' = '1'::jsonb
          and p_report->>'methodology_version' = 'meta-diag-1'
          and private.meta_has_exact_keys(p_report->'evidence', array['items','totals','manifest']))
      or (p_report->'schema_version' = '2'::jsonb
          and p_report->>'methodology_version' = 'meta-tn-diag-1'
          and private.meta_has_exact_keys(p_report->'evidence', array['items','totals','manifest','store'])
          and pg_catalog.jsonb_typeof(p_report#>'{evidence,store}') = 'object'
          and p_report#>>'{evidence,store,source}' = 'tiendanube'))
    and private.meta_has_exact_keys(p_report->'window', array['from','to','prev_from','prev_to'])
    and private.meta_try_date(p_report#>>'{window,to}') = p_window_to
    and private.meta_try_date(p_report#>>'{window,from}') = p_window_to - 27
    and ((p_report#>'{window,prev_from}' = 'null'::jsonb and p_report#>'{window,prev_to}' = 'null'::jsonb)
      or (private.meta_try_date(p_report#>>'{window,prev_to}') = p_window_to - 28
          and private.meta_try_date(p_report#>>'{window,prev_from}') = p_window_to - 55))
    and private.meta_has_exact_keys(p_report->'settings', array['goal_kind','metric_ref'])
    and private.meta_diagnostic_valid_settings(p_report#>>'{settings,goal_kind}', p_report#>>'{settings,metric_ref}')
    and pg_catalog.jsonb_typeof(p_report->'sync_finished_at') = 'string'
    and private.meta_try_timestamptz(p_report->>'sync_finished_at') = p_sync_finished_at
    and pg_catalog.jsonb_typeof(p_report#>'{evidence,items}') = 'array'
    and pg_catalog.jsonb_typeof(p_report#>'{evidence,totals}') = 'object'
    and pg_catalog.jsonb_typeof(p_report#>'{evidence,manifest}') = 'object'
    and pg_catalog.jsonb_typeof(p_report->'output') = 'object'
    and pg_catalog.jsonb_typeof(p_report->'web_sources') = 'array'
    and pg_catalog.jsonb_typeof(p_report->'model_requested') = 'string'
    and pg_catalog.char_length(p_report->>'model_requested') between 1 and 128
    and (p_report->'model_reported' = 'null'::jsonb
      or (pg_catalog.jsonb_typeof(p_report->'model_reported') = 'string'
          and pg_catalog.char_length(p_report->>'model_reported') between 1 and 128))
    and private.meta_has_exact_keys(p_report->'usage', array['calls','batches','steps'])
    and private.meta_valid_int(p_report#>'{usage,calls}', 0)
    and private.meta_valid_int(p_report#>'{usage,batches}', 0)
    and pg_catalog.jsonb_typeof(p_report#>'{usage,steps}') = 'array',
    false)
$$;
revoke all on function private.meta_diagnostic_valid_report(jsonb,date,timestamptz)
  from public, anon, authenticated, service_role, praxa_integrations;

-- ---------------------------------------------------------------------------
-- Publicación: la misma de 0022 más la conexión de la tienda (nula para v1)
-- ---------------------------------------------------------------------------

drop function worker_api.publish_diagnostic(uuid,uuid,uuid,uuid,integer,jsonb);

create function worker_api.publish_diagnostic(
  p_actor_user_id uuid, p_company_id uuid, p_request_id uuid, p_connection_id uuid,
  p_expected_generation integer, p_report jsonb, p_store_connection_id uuid default null
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_connection public.integration_connections;
  v_connection_found boolean;
  v_store public.integration_connections;
  v_reservation private.meta_diagnostic_reservations;
  v_reservation_found boolean;
  v_now timestamptz;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);
  if p_request_id is null or p_connection_id is null or p_expected_generation is null or p_report is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  perform private.lock_company(p_company_id);
  if exists (select 1 from public.diagnostic_reports r
              where r.company_id = p_company_id and r.request_id = p_request_id) then
    return 'already_published';
  end if;
  select c.* into v_connection from public.integration_connections c
   where c.id = p_connection_id and c.company_id = p_company_id for update;
  v_connection_found := found;
  -- La tienda de la sección: de esta empresa, de Tiendanube y activa al publicar.
  if p_store_connection_id is not null then
    select c.* into v_store from public.integration_connections c
     where c.id = p_store_connection_id and c.company_id = p_company_id
       and c.provider::text = 'tiendanube' for update;
    if not found or v_store.status <> 'active' then
      return 'connection_changed';
    end if;
  end if;
  select r.* into v_reservation from private.meta_diagnostic_reservations r
   where r.company_id = p_company_id and r.request_id = p_request_id for update;
  v_reservation_found := found;
  v_now := pg_catalog.clock_timestamp();
  if not v_reservation_found or v_reservation.expires_at <= v_now
     or v_reservation.connection_id <> p_connection_id then
    return 'reservation_lost';
  end if;
  if not v_connection_found or v_connection.status <> 'active'
     or v_connection.credential_generation <> p_expected_generation
     or v_connection.credential_generation <> v_reservation.credential_generation then
    return 'connection_changed';
  end if;
  if v_connection.meta_sync_summary->>'status' is distinct from 'completed'
       and v_connection.meta_sync_summary->>'status' is distinct from 'partial'
     or (v_connection.meta_sync_summary->>'finished_at')::timestamptz
          is distinct from v_reservation.sync_finished_at then
    return 'sync_changed';
  end if;
  -- v2 si y solo si viene la tienda; la forma de cada versión la exige la función de validación.
  if not private.meta_diagnostic_valid_report(p_report,
       (v_connection.meta_sync_summary->>'window_to')::date, v_reservation.sync_finished_at)
     or (p_report->'schema_version' = '2'::jsonb) <> (p_store_connection_id is not null) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  -- Una sola transacción: borrar el anterior, insertar el nuevo y soltar la reserva.
  delete from public.diagnostic_reports r where r.company_id = p_company_id;
  insert into public.diagnostic_reports (company_id, connection_id, credential_generation, request_id,
    generated_at, window_from, window_to, prev_from, prev_to, sync_finished_at, schema_version,
    methodology_version, store_connection_id, settings, evidence, output, web_sources, model_requested,
    model_reported, usage)
  values (p_company_id, p_connection_id, v_connection.credential_generation, p_request_id, v_now,
    (p_report#>>'{window,from}')::date, (p_report#>>'{window,to}')::date,
    (p_report#>>'{window,prev_from}')::date, (p_report#>>'{window,prev_to}')::date,
    v_reservation.sync_finished_at, (p_report->>'schema_version')::integer, p_report->>'methodology_version',
    p_store_connection_id, p_report->'settings', p_report->'evidence', p_report->'output', p_report->'web_sources',
    p_report->>'model_requested', p_report->>'model_reported', p_report->'usage');
  delete from private.meta_diagnostic_reservations r where r.company_id = p_company_id;
  return 'published';
exception when integrity_constraint_violation then
  get stacked diagnostics v_constraint = constraint_name;
  perform private.raise_worker_integrity_error(v_constraint);
  return null;
end;
$$;

revoke all on function worker_api.publish_diagnostic(uuid,uuid,uuid,uuid,integer,jsonb,uuid)
  from public, anon, authenticated, service_role, praxa_integrations;
grant execute on function worker_api.publish_diagnostic(uuid,uuid,uuid,uuid,integer,jsonb,uuid)
  to praxa_integrations;
