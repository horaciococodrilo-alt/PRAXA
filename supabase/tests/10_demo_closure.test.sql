-- PRAXA — Procedimiento de cierre de una empresa (CA-67, CA-68, H-E1-06, H-E1-07).
--
-- El cierre borra primero la empresa y después el usuario, como `postgres` y sin claims,
-- igual que el SQL editor: es la excepción administrativa de 0008 (rol administrativo Y
-- `auth.uid()` nulo). `05_delete_carveout` ya prueba la cascada del contexto, pero sin
-- reportes; esta prueba agrega el reporte.
--
-- Parte 1 (H-E1-07). No toca ninguna tabla de integración, para que su resultado no se
-- pierda por el error de un objeto inexistente: `run-pgtap.mjs` descarta el archivo
-- entero ante un error SQL. La hipótesis era que el `on delete restrict` de
-- `reports_context_fkey` (0003) rompiera la cascada desde `companies`. La parte 1, corrida
-- sola antes de 0012, pasó: la hipótesis es falsa y 0012 no toca `reports`.
--
-- Parte 2 (CA-67, CA-68, H-E1-06). Agrega la integración y los Insights de M16c: el cierre
-- deja cero filas en las dieciséis tablas, y el usuario solo se puede borrar después de su
-- empresa.

begin;

create extension if not exists pgtap with schema extensions;
select plan(34);

-- ---------------------------------------------------------------------------
-- Parte 1: empresa con contexto activo y reporte, sin integración
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('aaaaaaaa-0000-4000-8000-000000000101', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'cierre.uno@praxa.test', 'x', now(), now(), now());

insert into public.companies (id, name, owner_id)
values ('c0a00000-0000-4000-8000-000000000101', 'Empresa de cierre 1',
        'aaaaaaaa-0000-4000-8000-000000000101');

insert into public.company_context_versions
  (id, company_id, context_schema_version, has_defined_objective, created_by)
values ('11110000-0000-4000-8000-000000000101', 'c0a00000-0000-4000-8000-000000000101',
        '1.0.0', true, 'aaaaaaaa-0000-4000-8000-000000000101');

insert into public.company_objectives (id, company_id, context_version_id, kind, title)
values ('0b1e0000-0000-4000-8000-000000000101', 'c0a00000-0000-4000-8000-000000000101',
        '11110000-0000-4000-8000-000000000101', 'primary', 'Objetivo de cierre 1');

insert into public.company_systems (company_id, context_version_id, system_key)
values ('c0a00000-0000-4000-8000-000000000101', '11110000-0000-4000-8000-000000000101',
        'sistema_sintetico');

-- Activación administrativa (0008): postgres sin claims.
update public.company_context_versions
   set status = 'active', version = 1, activated_at = now()
 where id = '11110000-0000-4000-8000-000000000101';

insert into public.reports (id, company_id, context_version_id, report_schema_version,
                            methodology_version)
values ('4e900000-0000-4000-8000-000000000101', 'c0a00000-0000-4000-8000-000000000101',
        '11110000-0000-4000-8000-000000000101', '1.0.0', '1.0.0');

-- La protección que tiene que sobrevivir a cualquier variante de la corrección: un
-- contexto con reportes no se borra, ni siquiera por la vía administrativa.
select throws_ok(
  $$delete from public.company_context_versions
     where id = '11110000-0000-4000-8000-000000000101'$$,
  '23503',
  null,
  'CIERRE 1: borrar un contexto que tiene un reporte falla por la FK'
);

select lives_ok(
  $$delete from public.companies where id = 'c0a00000-0000-4000-8000-000000000101'$$,
  'CIERRE 1: el borrado administrativo de la empresa con contexto activo y reporte procede'
);

select is(
  (select count(*)::int from public.companies
    where id = 'c0a00000-0000-4000-8000-000000000101'),
  0, 'CIERRE 1: cero filas en companies');

select is(
  (select count(*)::int from public.company_members
    where company_id = 'c0a00000-0000-4000-8000-000000000101'),
  0, 'CIERRE 1: cero filas en company_members');

select is(
  (select count(*)::int from public.company_context_versions
    where company_id = 'c0a00000-0000-4000-8000-000000000101'),
  0, 'CIERRE 1: cero filas en company_context_versions');

select is(
  (select count(*)::int from public.company_objectives
    where company_id = 'c0a00000-0000-4000-8000-000000000101'),
  0, 'CIERRE 1: cero filas en company_objectives');

select is(
  (select count(*)::int from public.company_systems
    where company_id = 'c0a00000-0000-4000-8000-000000000101'),
  0, 'CIERRE 1: cero filas en company_systems');

select is(
  (select count(*)::int from public.reports
    where company_id = 'c0a00000-0000-4000-8000-000000000101'),
  0, 'CIERRE 1: cero filas en reports');

-- ---------------------------------------------------------------------------
-- Parte 2: empresa con contexto, reporte e integración (CA-67, CA-68, H-E1-06)
-- ---------------------------------------------------------------------------
--
-- La conexión se siembra por worker_api, como `postgres` (su dueño): pendiente con
-- credencial, confirmada, y un intento `reauth` que la espera.

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('aaaaaaaa-0000-4000-8000-000000000102', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'cierre.dos@praxa.test', 'x', now(), now(), now());

insert into public.companies (id, name, owner_id)
values ('c0a00000-0000-4000-8000-000000000102', 'Empresa de cierre 2',
        'aaaaaaaa-0000-4000-8000-000000000102');

insert into public.company_context_versions
  (id, company_id, context_schema_version, has_defined_objective, created_by)
values ('11110000-0000-4000-8000-000000000102', 'c0a00000-0000-4000-8000-000000000102',
        '1.0.0', true, 'aaaaaaaa-0000-4000-8000-000000000102');

insert into public.company_objectives (id, company_id, context_version_id, kind, title)
values ('0b1e0000-0000-4000-8000-000000000102', 'c0a00000-0000-4000-8000-000000000102',
        '11110000-0000-4000-8000-000000000102', 'primary', 'Objetivo de cierre 2');

insert into public.company_systems (company_id, context_version_id, system_key)
values ('c0a00000-0000-4000-8000-000000000102', '11110000-0000-4000-8000-000000000102',
        'sistema_sintetico');

update public.company_context_versions
   set status = 'active', version = 1, activated_at = now()
 where id = '11110000-0000-4000-8000-000000000102';

insert into public.reports (id, company_id, context_version_id, report_schema_version,
                            methodology_version)
values ('4e900000-0000-4000-8000-000000000102', 'c0a00000-0000-4000-8000-000000000102',
        '11110000-0000-4000-8000-000000000102', '1.0.0', '1.0.0');

select 1 from worker_api.create_pending_connection(
  'aaaaaaaa-0000-4000-8000-000000000102', 'c0a00000-0000-4000-8000-000000000102',
  'cc000000-0000-4000-8000-000000000102', 'negocio_sintetico', 'AAAA', 'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica', '{ads_read}', null);

select 1 from worker_api.confirm_connection(
  'aaaaaaaa-0000-4000-8000-000000000102', 'c0a00000-0000-4000-8000-000000000102',
  'cc000000-0000-4000-8000-000000000102', 'act_90000102', 'USD', 'UTC', true);

-- M25a: un registro asociado, otro sin conexión y un arriendo efímero.
select 1 from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000102','c0a00000-0000-4000-8000-000000000102',
  'fa000000-0000-4000-8000-000000000102','cc000000-0000-4000-8000-000000000102',
  0,'Consulta sintética','{total}','answered',null,10,'modelo_sintetico',null);
select 1 from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000102','c0a00000-0000-4000-8000-000000000102',
  'fa000000-0000-4000-8000-000000000103',null,
  null,'Consulta sin conexión','{}','not_answered','connection_not_active',10,'modelo_sintetico',null);
select 1 from worker_api.begin_chat_turn(
  'aaaaaaaa-0000-4000-8000-000000000102','c0a00000-0000-4000-8000-000000000102',
  'eb000000-0000-4000-8000-000000000102',90);

select 1 from worker_api.create_oauth_attempt(
  'aaaaaaaa-0000-4000-8000-000000000102', 'c0a00000-0000-4000-8000-000000000102',
  'reauth', repeat('c', 64), repeat('d', 64), '/app/integraciones',
  now() + interval '5 minutes', 'cc000000-0000-4000-8000-000000000102');

-- Insights: una ejecución con su snapshot, entidad, metadata, día, acción y cobertura.
select 1 from worker_api.start_sync_run(
  'aaaaaaaa-0000-4000-8000-000000000102', 'c0a00000-0000-4000-8000-000000000102',
  'cc000000-0000-4000-8000-000000000102', 0, 'e0000000-0000-4000-8000-000000000102',
  repeat('e', 64), current_date, current_date,
  '{"lookbackDays":1,"maxWindowDays":1,"maxPagesPerLevel":1,"maxMetadataPages":1,"maxEntities":1,"maxPayloadBytes":100000,"maxDurationMs":1000,"finalizationReserveMs":1000,"leaseSeconds":2,"maxRetries":2,"retryDelayMs":500}');

select 1 from worker_api.publish_snapshot(
  'aaaaaaaa-0000-4000-8000-000000000102', 'c0a00000-0000-4000-8000-000000000102',
  'cc000000-0000-4000-8000-000000000102', 0, 'e0000000-0000-4000-8000-000000000102',
  repeat('e', 64), '5a000000-0000-4000-8000-000000000102', 'account', clock_timestamp(), 1, 1,
  jsonb_build_object(
    'entities', jsonb_build_array(jsonb_build_object(
      'level', 'account', 'external_id', 'act_90000102', 'parent_external_id', null,
      'name', 'Cuenta sintetica', 'effective_status', null, 'objective', null,
      'metadata_fetched_at', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'attribution', '{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb)),
    'days', jsonb_build_array(jsonb_build_object(
      'date', current_date::text, 'level', 'account', 'external_id', 'act_90000102',
      'spend', '1.50', 'impressions', '10', 'reach', null, 'clicks', null, 'inline_link_clicks', null,
      'ctr', null, 'cpc', null, 'cpm', null, 'frequency', null,
      'actions', '[{"action_type":"purchase","variant":"value","count":"1","value":"2.50"}]'::jsonb))));

-- Desgloses: un snapshot con su fila, cobertura y estado (H-E1-202).
select 1 from worker_api.publish_breakdown(
  'aaaaaaaa-0000-4000-8000-000000000102', 'c0a00000-0000-4000-8000-000000000102',
  'cc000000-0000-4000-8000-000000000102', 0, 'e0000000-0000-4000-8000-000000000102',
  repeat('e', 64), '5b000000-0000-4000-8000-000000000102', 'account', 'country', clock_timestamp(), 1, 1,
  jsonb_build_object('rows', jsonb_build_array(jsonb_build_object(
    'date', current_date::text, 'external_id', 'act_90000102', 'segment_primary', 'AR', 'segment_secondary', null,
    'spend', '1.50', 'impressions', '10', 'clicks', null, 'inline_link_clicks', null,
    'ctr', null, 'cpc', null, 'cpm', null, 'actions', '[]'::jsonb))));

-- H-E1-06: el usuario no se puede borrar antes que su empresa.
select throws_ok(
  $$delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000102'$$,
  '23503',
  null,
  'CIERRE 2: borrar el usuario antes que la empresa falla'
);

select lives_ok(
  $$delete from public.companies where id = 'c0a00000-0000-4000-8000-000000000102'$$,
  'CIERRE 2: el borrado administrativo de la empresa con integración procede'
);

select is(
  (select count(*)::int from public.companies
    where id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en companies');
select is(
  (select count(*)::int from public.chat_query_records
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero registros del chat, incluso sin conexión');
select is(
  (select count(*)::int from private.chat_turn_leases
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero arriendos del chat');

select is(
  (select count(*)::int from public.company_members
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en company_members');

select is(
  (select count(*)::int from public.company_context_versions
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en company_context_versions');

select is(
  (select count(*)::int from public.company_objectives
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en company_objectives');

select is(
  (select count(*)::int from public.company_systems
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en company_systems');

select is(
  (select count(*)::int from public.reports
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en reports');

select is(
  (select count(*)::int from public.integration_connections
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en integration_connections');

select is(
  (select count(*)::int from public.oauth_attempts
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en oauth_attempts');

select is(
  (select count(*)::int from private.integration_credentials
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en integration_credentials');

select is(
  (select count(*)::int from public.meta_sync_runs
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en meta_sync_runs');

select is(
  (select count(*)::int from public.meta_entities
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en meta_entities');

select is(
  (select count(*)::int from public.meta_insight_snapshots
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en meta_insight_snapshots');

select is(
  (select count(*)::int from public.meta_snapshot_entities
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en meta_snapshot_entities');

select is(
  (select count(*)::int from public.meta_snapshot_days
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en meta_snapshot_days');

select is(
  (select count(*)::int from public.meta_snapshot_actions
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en meta_snapshot_actions');

select is(
  (select count(*)::int from public.meta_daily_coverage
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en meta_daily_coverage');

select is(
  (select count(*)::int from public.meta_breakdown_snapshots
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en meta_breakdown_snapshots');

select is(
  (select count(*)::int from public.meta_breakdown_rows
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en meta_breakdown_rows');

select is(
  (select count(*)::int from public.meta_breakdown_coverage
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en meta_breakdown_coverage');

select is(
  (select count(*)::int from public.meta_breakdown_status
    where company_id = 'c0a00000-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en meta_breakdown_status');

select lives_ok(
  $$delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000102'$$,
  'CIERRE 2: después de la empresa, el usuario se borra'
);

select is(
  (select count(*)::int from auth.users
    where id = 'aaaaaaaa-0000-4000-8000-000000000102'),
  0, 'CIERRE 2: cero filas en auth.users');

select * from finish();
rollback;
