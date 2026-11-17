-- PRAXA 0031 — Diagnóstico con sección «Tráfico del sitio» de GA4 (M16f §6; renumerada por
-- H-E1-262, H-E1-266 y H-E1-268)
--
-- Solo `diagnostic_reports` y su publicación. Los informes v1 ('meta-diag-1') y v2
-- ('meta-tn-diag-1') siguen igual y ahora exigen además `ga4_connection_id` nulo. Un informe con
-- la sección de GA4 es versión 3 ('meta-fuentes-diag-1'): apunta a la conexión de GA4 de la que
-- salió la sección y, si además lleva la sección de la tienda, a la de Tiendanube. Los informes
-- ya guardados cumplen las reglas nuevas sin tocarlos.
--
-- MATRIZ (sin grants nuevos sobre tablas):
--   public.diagnostic_reports            : SELECT authenticated (miembro; conexión de Meta active o
--                                          needs_reauth; si lleva tienda, también la tienda; si lleva
--                                          GA4, también GA4). Sin escritura directa.
--   worker_api.publish_diagnostic(uuid,uuid,uuid,uuid,integer,jsonb,uuid,uuid)
--                                        : DEFINER, solo praxa_integrations. Reemplaza a la firma de
--                                          siete argumentos, que se borra con sus grants; los dos
--                                          últimos tienen default null, así que las llamadas de seis
--                                          y siete argumentos siguen resolviendo (v1 y v2).
--   private.diagnostic_reports_ga4_only  : función de trigger, sin EXECUTE para nadie.
--
--   private.chat_valid_tool_names(text[]): misma firma y grants que 0018 (sin EXECUTE para nadie);
--                                          admite dígitos después del primer carácter (H-E1-269).
--
-- RETENCIÓN. El v3 tiene FK compuesta a la conexión de GA4 con ON DELETE CASCADE: la purga al
-- desconectar GA4 borra la fila de la conexión y el informe cae con ella (M16f-C-12, §7).
--
-- CATÁLOGO DE ERRORES: se reutilizan los existentes; no hay códigos nuevos.

-- ---------------------------------------------------------------------------
-- Registro del chat con GA4 (§6, CA-62 ampliado; H-E1-269). La regla de 0018 solo aceptaba
-- `[a-z_]`, y los nombres de las herramientas de GA4 (`ga4_*`) llevan un dígito: sin este
-- cambio, todo turno que usa GA4 se rechaza al registrarse. Solo se amplía el alfabeto; el
-- tope de 16 nombres, de 40 caracteres y de una dimensión no cambia, y todo nombre aceptado
-- antes se sigue aceptando, así que la restricción de la tabla no se recrea.
-- ---------------------------------------------------------------------------

create or replace function private.chat_valid_tool_names(p_names text[])
returns boolean language sql immutable security invoker set search_path = '' as $$
  select p_names is not null and coalesce(pg_catalog.array_ndims(p_names), 1) <= 1
    and pg_catalog.cardinality(p_names) <= 16
    and coalesce((select pg_catalog.bool_and(n is not null and n ~ '^[a-z_][a-z0-9_]{0,39}$')
                    from pg_catalog.unnest(p_names) n), true)
$$;
revoke all on function private.chat_valid_tool_names(text[])
  from public, anon, authenticated, service_role, praxa_integrations;

-- ---------------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------------

alter table public.diagnostic_reports add column ga4_connection_id uuid;

alter table public.diagnostic_reports drop constraint diagnostic_reports_versions;
alter table public.diagnostic_reports
  add constraint diagnostic_reports_versions
    check ((schema_version = 1 and methodology_version = 'meta-diag-1'
            and store_connection_id is null and ga4_connection_id is null)
        or (schema_version = 2 and methodology_version = 'meta-tn-diag-1'
            and store_connection_id is not null and ga4_connection_id is null)
        or (schema_version = 3 and methodology_version = 'meta-fuentes-diag-1'
            and ga4_connection_id is not null)),
  add constraint diagnostic_reports_ga4_connection_fkey
    foreign key (company_id, ga4_connection_id)
    references public.integration_connections (company_id, id) on delete cascade;

create index diagnostic_reports_ga4_connection_idx
  on public.diagnostic_reports (company_id, ga4_connection_id)
  where ga4_connection_id is not null;

-- La conexión de la sección tiene que ser de GA4. Una de otra empresa ya la rechaza la FK; acá
-- se rechaza una conexión de la misma empresa con otro proveedor.
create function private.diagnostic_reports_ga4_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ga4_connection_id is not null and exists (
    select 1 from public.integration_connections c
     where c.id = new.ga4_connection_id
       and c.company_id = new.company_id
       and c.provider::text <> 'ga4'
  ) then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;
  return new;
end;
$$;

revoke all on function private.diagnostic_reports_ga4_only()
  from public, anon, authenticated, service_role, praxa_integrations;

create trigger diagnostic_reports_ga4_only
  before insert or update of ga4_connection_id on public.diagnostic_reports
  for each row execute function private.diagnostic_reports_ga4_only();

-- La base, no solo la pantalla, oculta el v3 cuando la conexión de GA4 deja de estar vigente,
-- aunque Meta y la tienda sigan activas.
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
    and (diagnostic_reports.ga4_connection_id is null or exists (
      select 1 from public.integration_connections g
       where g.id = diagnostic_reports.ga4_connection_id
         and g.company_id = diagnostic_reports.company_id
         and g.provider::text = 'ga4'
         and g.status in ('active', 'needs_reauth')))
  );

-- ---------------------------------------------------------------------------
-- Forma persistida: v1 y v2 iguales que en 0024; v3 suma `evidence.ga4` y, opcionalmente,
-- `evidence.store`
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
          and p_report#>>'{evidence,store,source}' = 'tiendanube')
      or (p_report->'schema_version' = '3'::jsonb
          and p_report->>'methodology_version' = 'meta-fuentes-diag-1'
          and (private.meta_has_exact_keys(p_report->'evidence', array['items','totals','manifest','ga4'])
            or (private.meta_has_exact_keys(p_report->'evidence',
                  array['items','totals','manifest','store','ga4'])
                and pg_catalog.jsonb_typeof(p_report#>'{evidence,store}') = 'object'
                and p_report#>>'{evidence,store,source}' = 'tiendanube'))
          and pg_catalog.jsonb_typeof(p_report#>'{evidence,ga4}') = 'object'
          and p_report#>>'{evidence,ga4,source}' = 'ga4'))
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
-- Publicación: la misma de 0024 más la conexión de GA4 (nula para v1 y v2)
-- ---------------------------------------------------------------------------

drop function worker_api.publish_diagnostic(uuid,uuid,uuid,uuid,integer,jsonb,uuid);

create function worker_api.publish_diagnostic(
  p_actor_user_id uuid, p_company_id uuid, p_request_id uuid, p_connection_id uuid,
  p_expected_generation integer, p_report jsonb, p_store_connection_id uuid default null,
  p_ga4_connection_id uuid default null
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_connection public.integration_connections;
  v_connection_found boolean;
  v_store public.integration_connections;
  v_ga4 public.integration_connections;
  v_reservation private.meta_diagnostic_reservations;
  v_reservation_found boolean;
  v_now timestamptz;
  v_constraint text;
  v_version jsonb;
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
  -- GA4 de la sección: de esta empresa, de GA4 y activa al publicar.
  if p_ga4_connection_id is not null then
    select c.* into v_ga4 from public.integration_connections c
     where c.id = p_ga4_connection_id and c.company_id = p_company_id
       and c.provider::text = 'ga4' for update;
    if not found or v_ga4.status <> 'active' then
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
  -- v3 si y solo si viene GA4; si no, v2 si y solo si viene la tienda. En v3 la sección de la
  -- tienda va si y solo si viene su conexión. La forma de cada versión la exige la validación.
  v_version := p_report->'schema_version';
  if not private.meta_diagnostic_valid_report(p_report,
       (v_connection.meta_sync_summary->>'window_to')::date, v_reservation.sync_finished_at)
     or (v_version = '3'::jsonb) <> (p_ga4_connection_id is not null)
     or (v_version = '2'::jsonb) <> (p_ga4_connection_id is null and p_store_connection_id is not null)
     or (v_version = '3'::jsonb
         and (p_report->'evidence' ? 'store') <> (p_store_connection_id is not null)) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  -- Una sola transacción: borrar el anterior, insertar el nuevo y soltar la reserva.
  delete from public.diagnostic_reports r where r.company_id = p_company_id;
  insert into public.diagnostic_reports (company_id, connection_id, credential_generation, request_id,
    generated_at, window_from, window_to, prev_from, prev_to, sync_finished_at, schema_version,
    methodology_version, store_connection_id, ga4_connection_id, settings, evidence, output,
    web_sources, model_requested, model_reported, usage)
  values (p_company_id, p_connection_id, v_connection.credential_generation, p_request_id, v_now,
    (p_report#>>'{window,from}')::date, (p_report#>>'{window,to}')::date,
    (p_report#>>'{window,prev_from}')::date, (p_report#>>'{window,prev_to}')::date,
    v_reservation.sync_finished_at, (p_report->>'schema_version')::integer, p_report->>'methodology_version',
    p_store_connection_id, p_ga4_connection_id, p_report->'settings', p_report->'evidence',
    p_report->'output', p_report->'web_sources', p_report->>'model_requested',
    p_report->>'model_reported', p_report->'usage');
  delete from private.meta_diagnostic_reservations r where r.company_id = p_company_id;
  return 'published';
exception when integrity_constraint_violation then
  get stacked diagnostics v_constraint = constraint_name;
  perform private.raise_worker_integrity_error(v_constraint);
  return null;
end;
$$;

revoke all on function worker_api.publish_diagnostic(uuid,uuid,uuid,uuid,integer,jsonb,uuid,uuid)
  from public, anon, authenticated, service_role, praxa_integrations;
grant execute on function worker_api.publish_diagnostic(uuid,uuid,uuid,uuid,integer,jsonb,uuid,uuid)
  to praxa_integrations;
