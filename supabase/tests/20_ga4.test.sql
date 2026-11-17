-- M16f: enum, esquema y comportamiento GA4. Las aserciones de las etapas
-- siguientes se agregan antes de implementar cada comportamiento.

begin;

create extension if not exists pgtap with schema extensions;
select plan(68);

select enum_has_labels('public', 'integration_provider', array['meta', 'tiendanube', 'ga4'],
  'M16f-T-01: integration_provider admite exactamente los tres proveedores');

select has_table('private', 'ga4_sync_runs', 'M16f-T-01: ejecuciones privadas');
select has_table('private', 'ga4_item_keys', 'M16f-T-01: claves de item privadas');
select has_table('private', 'ga4_item_rows', 'M16f-T-01: filas de item privadas');
select has_table('private', 'ga4_campaign_rows', 'M16f-T-01: campañas privadas');
select has_table('public', 'ga4_sync_status', 'M16f-T-01: estado agregado');
select has_table('public', 'ga4_report_quality', 'M16f-T-01: calidad por informe y ventana');
select has_table('public', 'ga4_traffic_daily', 'M16f-T-01: tráfico diario');
select has_table('public', 'ga4_source_daily', 'M16f-T-01: fuentes diarias');
select has_table('public', 'ga4_funnel_daily', 'M16f-T-01: embudo diario');
select has_table('public', 'ga4_item_daily', 'M16f-T-01: items diarios');
select has_table('public', 'ga4_campaign_daily', 'M16f-T-01: campañas diarias');
select has_table('public', 'ga4_visitor_cohorts', 'M16f-T-01: cohortes de visitantes');

select ok(private.valid_provider_scopes('ga4', array['https://www.googleapis.com/auth/analytics.readonly']),
  'M16f-T-01: el scope GA4 exacto es válido');
select ok(not private.valid_provider_scopes('ga4', array['https://www.googleapis.com/auth/analytics.readonly', 'ads_read']),
  'M16f-T-01: un scope GA4 adicional se rechaza');
select ok(coalesce((select c.relrowsecurity and c.relforcerowsecurity from pg_class c
                     where c.oid = to_regclass('public.ga4_report_quality')), false),
  'M16f-T-01: calidad tiene RLS habilitada y forzada');
select ok(case when to_regclass('public.ga4_report_quality') is null then false
               else has_table_privilege('authenticated', 'public.ga4_report_quality', 'SELECT') end,
  'M16f-T-01: authenticated puede leer calidad bajo RLS');
select ok(case when to_regclass('public.ga4_report_quality') is null then false
               else not has_table_privilege('authenticated', 'public.ga4_report_quality', 'INSERT') end,
  'M16f-T-01: authenticated no puede escribir calidad');
select ok(case when to_regclass('public.ga4_report_quality') is null then false
               else not has_table_privilege('anon', 'public.ga4_report_quality', 'SELECT') end,
  'M16f-T-01: anon no puede leer calidad');
select ok(case when to_regclass('public.ga4_report_quality') is null then false
               else not has_table_privilege('service_role', 'public.ga4_report_quality', 'SELECT') end,
  'M16f-T-01: service_role no lee calidad directamente');
select ok(case when to_regclass('public.ga4_report_quality') is null then false
               else not has_table_privilege('praxa_integrations', 'public.ga4_report_quality', 'SELECT') end,
  'M16f-T-01: rol de C no lee calidad directamente');
select ok(case when to_regclass('private.ga4_item_keys') is null then false
               else not has_table_privilege('authenticated', 'private.ga4_item_keys', 'SELECT') end,
  'M16f-T-01: los IDs de ítem quedan privados');
select ok(case when to_regprocedure('worker_api.ga4_publish_report(uuid,uuid,uuid,integer,uuid,uuid,text,integer,date,date,jsonb,jsonb,jsonb)') is null then false
               else has_function_privilege('praxa_integrations',
                 'worker_api.ga4_publish_report(uuid,uuid,uuid,integer,uuid,uuid,text,integer,date,date,jsonb,jsonb,jsonb)', 'EXECUTE') end,
  'M16f-T-01: solo el rol acotado invoca la publicación');

create function pg_temp.state_of(p_sql text) returns text language plpgsql as $fn$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end;
$fn$;
create function pg_temp.state_as(p_role text, p_sql text) returns text language plpgsql as $fn$
begin
  execute format('set local role %I', p_role);
  execute p_sql;
  execute 'reset role';
  return null;
exception when others then
  return sqlstate;
end;
$fn$;
create function pg_temp.login(p_user_id uuid) returns void language plpgsql as $fn$
begin
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', p_user_id), true);
  execute 'set local role authenticated';
end;
$fn$;
create function pg_temp.logout() returns void language plpgsql as $fn$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', null, true);
end;
$fn$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('aaaaaaaa-0000-4000-8000-000000002001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ga4.uno@praxa.test', 'x', now(), now(), now()),
  ('aaaaaaaa-0000-4000-8000-000000002002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ga4.dos@praxa.test', 'x', now(), now(), now());
insert into public.companies (id, name, owner_id) values
  ('c0a00000-0000-4000-8000-000000002001', 'Empresa GA4 uno', 'aaaaaaaa-0000-4000-8000-000000002001'),
  ('c0a00000-0000-4000-8000-000000002002', 'Empresa GA4 dos', 'aaaaaaaa-0000-4000-8000-000000002002');

select * from worker_api.create_pending_connection(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002001', 'meta', 'negocio_sintetico',
  'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user',
  'app_sintetica', array['ads_read'], null);
select * from worker_api.confirm_connection(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002001', 'act_999001', 'USD', 'UTC', true);
select * from worker_api.create_pending_connection(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002002', 'tiendanube', null,
  'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'store_app_token',
  '12345', array['read_orders', 'read_customers', 'read_products'], null);
select * from worker_api.confirm_connection(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002002', '777001', 'ARS', 'UTC', true);
select * from worker_api.create_pending_connection(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', 'ga4', null,
  'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'google_refresh_token',
  '123456789', array['https://www.googleapis.com/auth/analytics.readonly'], null);
select * from worker_api.confirm_connection(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', '123456789', 'USD', 'UTC', true);

select is((select count(*)::int from public.integration_connections
            where company_id = 'c0a00000-0000-4000-8000-000000002001'
              and status = 'active'), 3,
  'M16f-T-01: Meta, Tiendanube y GA4 coexisten en una empresa');

select is(pg_temp.state_of($call$select * from worker_api.create_pending_connection(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002004', 'ga4', null,
  'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'google_refresh_token',
  '123456789', array['https://www.googleapis.com/auth/analytics.readonly'], null)$call$),
  'PX003', 'M16f-T-01: segunda GA4 viva rechazada');
select is(pg_temp.state_of($call$select * from worker_api.create_pending_connection(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002004', 'ga4', null,
  'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'google_refresh_token',
  '123456789', array['ads_read'], null)$call$),
  '22023', 'M16f-T-01: otro scope rechazado antes de escribir');
select is(pg_temp.state_of($call$select * from worker_api.create_pending_connection(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002004', 'ga4', null,
  'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user',
  '123456789', array['https://www.googleapis.com/auth/analytics.readonly'], null)$call$),
  '22023', 'M16f-T-01: otro tipo de token rechazado');
select is(pg_temp.state_of($call$select * from worker_api.create_pending_connection(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002004', 'ga4', null,
  'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'google_refresh_token',
  '123.apps.googleusercontent.com', array['https://www.googleapis.com/auth/analytics.readonly'], null)$call$),
  '22023', 'M16f-T-01: issued_for_app_id con puntos rechazado');
select is(pg_temp.state_of($call$select * from worker_api.create_pending_connection(
  'aaaaaaaa-0000-4000-8000-000000002002', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002004', 'ga4', null,
  'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'google_refresh_token',
  '123456789', array['https://www.googleapis.com/auth/analytics.readonly'], null)$call$),
  'PX001', 'M16f-T-01: actor de otra empresa rechazado');

select is(worker_api.ga4_start_sync(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', 0,
  'd0000000-0000-4000-8000-000000002001', 'e0000000-0000-4000-8000-000000002001',
  now() + interval '4 minutes', 'backfill'), true,
  'M16f-T-01: inicia una ejecución GA4 con lease');
select is(worker_api.ga4_set_preflight(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', 0,
  'd0000000-0000-4000-8000-000000002001', 'e0000000-0000-4000-8000-000000002001',
  'Propiedad sintética', 'UTC', 'USD',
  '{"trafico":{"status":"disponible","reason":null},"cohortes":{"status":"disponible","reason":null},"embudo":{"status":"sin_instrumentacion","reason":"sin_eventos"},"productos":{"status":"sin_instrumentacion","reason":"sin_item_id"},"campanias":{"status":"sin_instrumentacion","reason":"sin_utm_id"}}',
  array['ga4_trafico_dia','ga4_trafico_fuente','ga4_cohortes']), true,
  'M16f-T-01: fija el catálogo base y el preflight');
select is(worker_api.ga4_publish_report(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', 0,
  'd0000000-0000-4000-8000-000000002001', 'e0000000-0000-4000-8000-000000002001',
  'ga4_trafico_dia', 1, '2026-10-01', '2026-10-07',
  '{"sampling_metadatas":[],"subject_to_thresholding":false,"data_loss_from_other_row":false,"data_truncation_reasons":[],"restricted_metrics":[],"currency_code":"USD","time_zone":"UTC"}',
  '[{"day":"2026-10-02","sessions":7,"active_users":6,"new_users":2,"provisional":false}]',
  '{"completed_reports":["ga4_trafico_dia"]}'), true,
  'M16f-T-01: publica tráfico y calidad en una transacción');
select is(worker_api.ga4_publish_report(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', 0,
  'd0000000-0000-4000-8000-000000002001', 'e0000000-0000-4000-8000-000000002001',
  'ga4_trafico_fuente', 1, '2026-10-01', '2026-10-07',
  '{"sampling_metadatas":[],"subject_to_thresholding":false,"data_loss_from_other_row":false,"data_truncation_reasons":[],"restricted_metrics":[],"currency_code":"USD","time_zone":"UTC"}',
  '[{"day":"2026-10-02","source":"facebook","medium":"paid","sessions":3}]',
  '{"completed_reports":["ga4_trafico_dia","ga4_trafico_fuente"]}'), true,
  'M16f-T-01: publica fuente y visitas desde Meta');
select is(worker_api.ga4_publish_report(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', 0,
  'd0000000-0000-4000-8000-000000002001', 'e0000000-0000-4000-8000-000000002001',
  'ga4_cohortes', 1, '2025-11-01', '2026-10-31',
  '{"sampling_metadatas":[],"subject_to_thresholding":false,"data_loss_from_other_row":false,"data_truncation_reasons":[],"restricted_metrics":[],"currency_code":"USD","time_zone":"UTC"}',
  '[]', '{"completed_reports":["ga4_trafico_dia","ga4_trafico_fuente","ga4_cohortes"]}'), true,
  'M16f-T-01: informe de cero filas conserva calidad');
select is(worker_api.ga4_finish_sync(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', 0,
  'd0000000-0000-4000-8000-000000002001', 'e0000000-0000-4000-8000-000000002001',
  '2026-10-01', '2026-10-07'), true,
  'M16f-T-01: cierra solo tras los informes base');
select results_eq(
  $$select sessions, meta_visits from public.get_ga4_traffic(
      'cc000000-0000-4000-8000-000000002003', '2026-10-01', '2026-10-07')$$,
  $$values (7::bigint, 3::bigint)$$,
  'M16f-T-01: el getter devuelve tráfico y visitas de Meta');
select is((select count(*)::int from public.ga4_report_quality), 3,
  'M16f-T-01: calidad de cada informe, incluso el vacío');
select results_eq(
  $$select cohort_month is null, quality is not null from public.get_ga4_cohorts(
      'cc000000-0000-4000-8000-000000002003', '2025-11-01', '2026-10-31')$$,
  $$values (true, true)$$,
  'M16f-T-01: getter de cero filas conserva la calidad sin inventar conteos');
select has_function('public', 'get_ga4_cohorts',
  array['uuid','date','date','date','integer','integer'],
  'M16f-T-07: getter de celdas recibe hoy local y margen provisional');
select results_eq(
  $$select cohort_month, month_offset, active is null, absence, quality is not null
      from public.get_ga4_cohorts('cc000000-0000-4000-8000-000000002003',
        '2026-10-01', '2026-10-01', '2026-10-15', 1, 3)
      where month_offset = 1$$,
  $$values ('2026-10-01'::date, 1, true, 'aun_no_disponible'::text, true)$$,
  'M16f-T-07: N futuro no se convierte en cero y conserva calidad');
insert into public.ga4_visitor_cohorts
  (company_id, connection_id, cohort_month, month_offset, cohort_size,
   active, size_hidden, active_hidden, provisional, quality_id)
select 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', '2026-01-01', 1, 5,
  null, false, true, false, q.quality_id
from public.ga4_report_quality q where q.report_id = 'ga4_cohortes'
  and q.connection_id = 'cc000000-0000-4000-8000-000000002003';
select results_eq(
  $$select cohort_size, active is null, retention is null, absence
      from public.get_ga4_cohorts('cc000000-0000-4000-8000-000000002003',
        '2026-01-01', '2026-01-01', '2026-04-01', 1, 3)
      where month_offset = 1$$,
  $$values (5::bigint, true, true, 'menos_de_5'::text)$$,
  'M16f-T-07: activos ocultos no producen retención');
update public.ga4_sync_status set time_zone = 'America/Argentina/Buenos_Aires'
 where connection_id = 'cc000000-0000-4000-8000-000000002003';
select results_eq(
  $$select traffic_quality->>'zona_distinta' from public.get_ga4_traffic(
      'cc000000-0000-4000-8000-000000002003', '2026-10-01', '2026-10-07')$$,
  $$values ('true'::text)$$,
  'M16f-T-06: calidad previa marca zona distinta');
update public.ga4_sync_status set time_zone = 'UTC'
 where connection_id = 'cc000000-0000-4000-8000-000000002003';
select is(pg_temp.state_of($call$select worker_api.ga4_publish_report(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', 0,
  'd0000000-0000-4000-8000-000000002001', 'e0000000-0000-4000-8000-000000002001',
  'ga4_trafico_dia', 1, '2026-10-01', '2026-10-07', '{}', '[]', '{}')$call$),
  'PX006', 'M16f-T-01: un lease cerrado no escribe');

-- H-E1-268: un proceso muerto no puede liberar su propio lease vencido.
select is(worker_api.ga4_start_sync(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', 0,
  'd0000000-0000-4000-8000-000000002011', 'e0000000-0000-4000-8000-000000002011',
  now() + interval '4 minutes', 'incremental'), true,
  'M16f-T-06: inicia un paso con lease vigente');
select is(pg_temp.state_of($call$select worker_api.ga4_start_sync(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', 0,
  'd0000000-0000-4000-8000-000000002012', 'e0000000-0000-4000-8000-000000002012',
  now() + interval '4 minutes', 'incremental')$call$), 'PX003',
  'M16f-T-06: un lease vigente impide un segundo paso');
update private.ga4_sync_runs set
  started_at = now() - interval '3 minutes',
  lease_expires_at = now() - interval '1 minute',
  target_reports = array['ga4_trafico_dia'],
  preflight = (select r.preflight from private.ga4_sync_runs r
               where r.id = 'd0000000-0000-4000-8000-000000002001'),
  checkpoint = '{"completed_reports":["ga4_trafico_dia"]}'
where id = 'd0000000-0000-4000-8000-000000002011';
select is(worker_api.ga4_start_sync(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', 0,
  'd0000000-0000-4000-8000-000000002012', 'e0000000-0000-4000-8000-000000002012',
  now() + interval '4 minutes', 'incremental'), true,
  'M16f-T-06: lease vencido permite reanudar');
select results_eq(
  $$select status, error_kind from private.ga4_sync_runs
    where id = 'd0000000-0000-4000-8000-000000002011'$$,
  $$values ('incomplete'::text, 'transitorio'::text)$$,
  'M16f-T-06: el paso vencido queda incompleto');
select results_eq(
  $$select target_reports, checkpoint, preflight from private.ga4_sync_runs
    where id = 'd0000000-0000-4000-8000-000000002012'$$,
  $$select target_reports, checkpoint, preflight from private.ga4_sync_runs
    where id = 'd0000000-0000-4000-8000-000000002011'$$,
  'M16f-T-06: preflight, objetivo y checkpoint sobreviven al reinicio');
update private.ga4_sync_runs set status = 'incomplete', finished_at = now()
 where id = 'd0000000-0000-4000-8000-000000002012';
update public.integration_connections set credential_generation = 1
 where id = 'cc000000-0000-4000-8000-000000002003';
select is(worker_api.ga4_start_sync(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', 1,
  'd0000000-0000-4000-8000-000000002013', 'e0000000-0000-4000-8000-000000002013',
  now() + interval '4 minutes', 'incremental'), true,
  'M16f-T-06: la generación nueva inicia sin heredar la anterior');
select results_eq(
  $$select target_reports, checkpoint, preflight from private.ga4_sync_runs
    where id = 'd0000000-0000-4000-8000-000000002013'$$,
  $$values ('{}'::text[], '{}'::jsonb, '{}'::jsonb)$$,
  'M16f-T-06: otra generación no hereda objetivo ni checkpoint');

select pg_temp.login('aaaaaaaa-0000-4000-8000-000000002001');
select is((select count(*)::int from public.ga4_report_quality), 3,
  'M16f-T-01: miembro lee la calidad de su GA4 activa');
select pg_temp.logout();
select pg_temp.login('aaaaaaaa-0000-4000-8000-000000002002');
select is((select count(*)::int from public.ga4_report_quality), 0,
  'M16f-T-01: otra empresa no lee la calidad');
select pg_temp.logout();
select is(pg_temp.state_as('anon',
  $$select * from public.get_ga4_sync_status('cc000000-0000-4000-8000-000000002003')$$),
  '42501', 'M16f-T-01: anon no ejecuta el getter');

-- M16f-T-08: el mapeo se decide solo al completar y usa todos los itemId guardados.
insert into private.tn_products (id, company_id, connection_id, external_product_id, name)
values ('b0000000-0000-4000-8000-000000002001',
  'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002002', '9001', 'Producto sintético');
insert into private.tn_product_variants
  (company_id, connection_id, product_id, external_variant_id)
select 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002002',
  'b0000000-0000-4000-8000-000000002001', (1000 + n)::text
from generate_series(1, 17) n;
insert into private.ga4_item_keys (company_id, connection_id, external_item_id)
select 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', (1000 + n)::text
from generate_series(1, 20) n;
insert into public.ga4_report_quality
  (quality_id, company_id, connection_id, report_id, report_version,
   window_from, window_to, fetched_at, row_count, currency_code, time_zone)
values
  ('f0000000-0000-4000-8000-000000002001',
   'c0a00000-0000-4000-8000-000000002001',
   'cc000000-0000-4000-8000-000000002003', 'ga4_productos', 1,
   '2026-10-01', '2026-10-07', now(), 20, 'USD', 'UTC'),
  ('f0000000-0000-4000-8000-000000002002',
   'c0a00000-0000-4000-8000-000000002001',
   'cc000000-0000-4000-8000-000000002003', 'ga4_campanias', 1,
   '2026-10-01', '2026-10-07', now(), 2, 'USD', 'UTC');
insert into public.ga4_item_daily
  (company_id, connection_id, day, item_ref, item_name, views,
   add_to_carts, purchases, quality_id)
select k.company_id, k.connection_id, '2026-10-02', k.item_ref,
  case when k.external_item_id in ('1018', '1019') then 'Mismo nombre' else 'Producto sintético' end,
  1, 0, 0, 'f0000000-0000-4000-8000-000000002001'
from private.ga4_item_keys k where k.connection_id = 'cc000000-0000-4000-8000-000000002003';
insert into public.meta_entities
  (entity_ref, company_id, connection_id, level, external_id)
values ('a0000000-0000-4000-8000-000000002001',
  'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002001', 'campaign', '42');
insert into private.ga4_campaign_rows
  (company_id, connection_id, day, external_campaign_id, sessions, quality_id)
values
  ('c0a00000-0000-4000-8000-000000002001',
   'cc000000-0000-4000-8000-000000002003', '2026-10-02', '42', 7,
   'f0000000-0000-4000-8000-000000002002'),
  ('c0a00000-0000-4000-8000-000000002001',
   'cc000000-0000-4000-8000-000000002003', '2026-10-02', '042', 3,
   'f0000000-0000-4000-8000-000000002002');
select is((select count(*)::integer from public.ga4_item_daily
    where connection_id = 'cc000000-0000-4000-8000-000000002003'
      and tn_product_key is not null), 0,
  'M16f-T-08: un paso incompleto no publica correspondencias');
update private.ga4_sync_runs set
  target_reports = array['ga4_trafico_dia', 'ga4_trafico_fuente', 'ga4_cohortes'],
  checkpoint = '{"completed_reports":["ga4_trafico_dia","ga4_trafico_fuente","ga4_cohortes"]}'
where id = 'd0000000-0000-4000-8000-000000002013';
select is(worker_api.ga4_finish_sync(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', 1,
  'd0000000-0000-4000-8000-000000002013', 'e0000000-0000-4000-8000-000000002013',
  '2026-10-01', '2026-10-07'), true,
  'M16f-T-08: completar recalcula los mapeos');
select is((select item_mapping_rule from public.ga4_sync_status
    where connection_id = 'cc000000-0000-4000-8000-000000002003'), 'variant',
  'M16f-T-08: 17 de 20 itemId coincidentes adoptan variante (85 %)');
select is((select count(*)::integer from public.ga4_item_daily
    where connection_id = 'cc000000-0000-4000-8000-000000002003'
      and tn_product_key = 'b0000000-0000-4000-8000-000000002001'), 17,
  'M16f-T-08: variantes distintas se resuelven al mismo producto');
select is((select count(distinct item_ref)::integer from public.get_ga4_items(
    'cc000000-0000-4000-8000-000000002003', '2026-10-02', '2026-10-02')
    where item_name = 'Mismo nombre'), 2,
  'M16f-T-08: nombres iguales no fusionan itemId sin mapeo');
select results_eq(
  $$select sessions, entity_ref is not null from public.get_ga4_campaigns(
    'cc000000-0000-4000-8000-000000002003', '2026-10-02', '2026-10-02')
    order by sessions$$,
  $$values (3::bigint, false), (7::bigint, true)$$,
  'M16f-T-08: utm_id exacto mapea y el parecido queda sin correspondencia');
delete from private.tn_product_variants where connection_id = 'cc000000-0000-4000-8000-000000002002'
  and external_variant_id in ('1015', '1016', '1017');
select is(worker_api.ga4_start_sync(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', 1,
  'd0000000-0000-4000-8000-000000002014', 'e0000000-0000-4000-8000-000000002014',
  now() + interval '4 minutes', 'incremental'), true,
  'M16f-T-08: una nueva sincronización vuelve a evaluar la regla');
update private.ga4_sync_runs set
  target_reports = array['ga4_trafico_dia', 'ga4_trafico_fuente', 'ga4_cohortes'],
  checkpoint = '{"completed_reports":["ga4_trafico_dia","ga4_trafico_fuente","ga4_cohortes"]}'
where id = 'd0000000-0000-4000-8000-000000002014';
select is(worker_api.ga4_finish_sync(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003', 1,
  'd0000000-0000-4000-8000-000000002014', 'e0000000-0000-4000-8000-000000002014',
  '2026-10-01', '2026-10-07'), true,
  'M16f-T-08: segunda sincronización completa');
select results_eq(
  $$select item_mapping_rule, (select count(*)::integer from public.ga4_item_daily d
      where d.connection_id = s.connection_id and d.tn_product_key is not null)
    from public.ga4_sync_status s where s.connection_id =
      'cc000000-0000-4000-8000-000000002003'$$,
  $$values (null::text, 0::integer)$$,
  'M16f-T-08: 70 % desactiva la regla y limpia los mapeos anteriores');

select * from worker_api.begin_disconnect(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003');
select is(worker_api.purge_connection(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003'), true,
  'M16f-T-01: purga GA4 terminada');
select is(worker_api.purge_connection(
  'aaaaaaaa-0000-4000-8000-000000002001', 'c0a00000-0000-4000-8000-000000002001',
  'cc000000-0000-4000-8000-000000002003'), false,
  'M16f-T-01: purga repetida idempotente');
select is((select count(*)::int from public.ga4_report_quality), 0,
  'M16f-T-01: purga elimina calidad');
select is((select count(*)::int from public.ga4_sync_status), 0,
  'M16f-T-01: purga elimina estado');
select is((select count(*)::int from public.integration_connections
            where company_id = 'c0a00000-0000-4000-8000-000000002001' and status = 'active'), 2,
  'M16f-T-01: Meta y Tiendanube permanecen activas');

select col_is_fk('public', 'diagnostic_reports', array['company_id', 'ga4_connection_id'],
  'M16f-T-09: el informe del diagnóstico referencia la conexión de GA4 (0031)');

select * from finish();
rollback;
