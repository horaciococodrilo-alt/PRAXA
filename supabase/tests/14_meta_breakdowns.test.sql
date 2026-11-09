-- PRAXA — Desgloses de Insights de Meta (0017): ACL, posesión, validación, cobertura, RLS y purga.
--
-- H-E1-202. Las funciones de `worker_api` se llaman como `postgres`, su dueño, igual que en 13.
-- Las lecturas públicas corren como `authenticated` con claims sintéticos.
--
-- Datos 100 % sintéticos: cuentas `act_` inventadas, sin montos reales.

begin;

create extension if not exists pgtap with schema extensions;
select plan(50);

-- ---------------------------------------------------------------------------
-- Helpers (pg_temp: desaparecen con el rollback)
-- ---------------------------------------------------------------------------

create function pg_temp.uid(n int) returns uuid language sql immutable
as $fn$ select format('aaaaaaaa-0000-4000-8000-%s', lpad((1400 + n)::text, 12, '0'))::uuid $fn$;

create function pg_temp.cid(n int) returns uuid language sql immutable
as $fn$ select format('c0a00000-0000-4000-8000-%s', lpad((1400 + n)::text, 12, '0'))::uuid $fn$;

create function pg_temp.kid(n int) returns uuid language sql immutable
as $fn$ select format('cc000000-0000-4000-8000-%s', lpad((1400 + n)::text, 12, '0'))::uuid $fn$;

create function pg_temp.rid(n int) returns uuid language sql immutable
as $fn$ select format('e0000000-0000-4000-8000-%s', lpad((1400 + n)::text, 12, '0'))::uuid $fn$;

create function pg_temp.sid(n int) returns uuid language sql immutable
as $fn$ select format('5b000000-0000-4000-8000-%s', lpad((1400 + n)::text, 12, '0'))::uuid $fn$;

create function pg_temp.tok(n int) returns text language sql immutable
as $fn$ select lpad(to_hex(n), 64, '0') $fn$;

create function pg_temp.acct(n int) returns text language sql immutable
as $fn$ select 'act_' || (9100000 + n)::text $fn$;

create function pg_temp.iso(p_at timestamptz) returns text language sql stable
as $fn$ select to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $fn$;

-- Empresa n con su conexión activa y su run r, con la cuenta ya publicada a nivel de cuenta y una campaña.
create function pg_temp.ready(n int, r int) returns void language plpgsql
as $fn$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (pg_temp.uid(n), '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', format('desgloses.%s@praxa.test', n), 'x', now(), now(), now());
  insert into public.companies (id, name, owner_id)
  values (pg_temp.cid(n), format('Empresa sintetica %s', n), pg_temp.uid(n));
  perform worker_api.create_pending_connection(
    pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(n), 'negocio_sintetico', 'AAAA',
    'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica',
    '{ads_read}', null);
  perform worker_api.confirm_connection(
    pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(n), pg_temp.acct(n), 'USD', 'UTC', true);
  perform worker_api.start_sync_run(pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(n), 0,
    pg_temp.rid(r), pg_temp.tok(r), current_date - 2, current_date,
    jsonb_build_object('lookbackDays', 3, 'maxWindowDays', 28, 'maxPagesPerLevel', 5, 'maxMetadataPages', 5,
      'maxEntities', 50, 'maxPayloadBytes', 500000, 'maxDurationMs', 20000, 'finalizationReserveMs', 40000,
      'leaseSeconds', 60, 'maxRetries', 2, 'retryDelayMs', 500));
  perform worker_api.publish_snapshot(pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(n), 0,
    pg_temp.rid(r), pg_temp.tok(r), format('5a000000-0000-4000-8000-%s', lpad((1400 + n)::text, 12, '0'))::uuid,
    'account', clock_timestamp(), 1, 10, jsonb_build_object(
      'entities', jsonb_build_array(jsonb_build_object('level', 'account', 'external_id', pg_temp.acct(n),
        'parent_external_id', null, 'name', 'Cuenta sintetica', 'effective_status', null, 'objective', null,
        'metadata_fetched_at', pg_temp.iso(clock_timestamp()),
        'attribution', '{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb)),
      'days', '[]'::jsonb));
end;
$fn$;

create function pg_temp.fila(p_ext text, p_primary text, p_secondary text default null, p_date date default current_date,
                             p_over jsonb default '{}')
returns jsonb language sql immutable
as $fn$ select jsonb_build_object('date', p_date::text, 'external_id', p_ext, 'segment_primary', p_primary,
  'segment_secondary', p_secondary, 'spend', '1.50', 'impressions', '10', 'clicks', null, 'inline_link_clicks', null,
  'ctr', null, 'cpc', null, 'cpm', null, 'actions', '[]'::jsonb) || p_over $fn$;

create function pg_temp.pub(n int, r int, s int, p_dimension text, p_rows jsonb, p_at timestamptz default clock_timestamp(),
                            p_level text default 'account', p_generation int default 0)
returns void language plpgsql
as $fn$
begin
  perform worker_api.publish_breakdown(pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(n), p_generation,
    pg_temp.rid(r), pg_temp.tok(r), pg_temp.sid(s), p_level, p_dimension, p_at, 1, 10,
    jsonb_build_object('rows', p_rows));
end;
$fn$;

create function pg_temp.state_of(p_sql text) returns text language plpgsql
as $fn$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end;
$fn$;

create function pg_temp.as_user(n int) returns void language plpgsql
as $fn$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$fn$;

create function pg_temp.as_admin() returns void language plpgsql
as $fn$
begin
  reset role;
  perform set_config('request.jwt.claims', null, true);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------

select is_empty(
  $$select t.tablename from pg_tables t
     where t.schemaname = 'public' and t.tablename like 'meta_breakdown_%'
       and not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                        where n.nspname = 'public' and c.relname = t.tablename
                          and c.relrowsecurity and c.relforcerowsecurity)$$,
  'ACL: las cuatro tablas tienen RLS forzada');

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and tablename like 'meta_breakdown_%'),
  4, 'ACL: cuatro tablas');

select results_eq(
  $$select t.tablename::text collate "default", has_table_privilege('authenticated', format('public.%I', t.tablename), 'SELECT')
      from pg_tables t where t.schemaname = 'public' and t.tablename like 'meta_breakdown_%' order by 1$$,
  $$values ('meta_breakdown_coverage', true), ('meta_breakdown_rows', true),
           ('meta_breakdown_snapshots', false), ('meta_breakdown_status', true)$$,
  'ACL: authenticated lee filas, cobertura y estado; los snapshots quedan ocultos');

select is_empty(
  $$select t.tablename, p.privilege
      from pg_tables t
     cross join unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) as p(privilege)
     cross join unnest(array['authenticated', 'anon', 'service_role', 'praxa_integrations']) as r(role)
     where t.schemaname = 'public' and t.tablename like 'meta_breakdown_%'
       and has_table_privilege(r.role, format('public.%I', t.tablename), p.privilege)$$,
  'ACL: nadie escribe directo en las tablas');

select is_empty(
  $$select t.tablename, r.role
      from pg_tables t
     cross join unnest(array['anon', 'service_role', 'praxa_integrations']) as r(role)
     where t.schemaname = 'public' and t.tablename like 'meta_breakdown_%'
       and has_table_privilege(r.role, format('public.%I', t.tablename), 'SELECT')$$,
  'ACL: anon, service_role y el rol de C no leen las tablas');

select is(has_function_privilege('praxa_integrations',
  'worker_api.publish_breakdown(uuid, uuid, uuid, integer, uuid, text, uuid, text, text, timestamptz, integer, integer, jsonb)', 'EXECUTE'),
  true, 'ACL: el rol de C publica');
select is(has_function_privilege('authenticated',
  'worker_api.publish_breakdown(uuid, uuid, uuid, integer, uuid, text, uuid, text, text, timestamptz, integer, integer, jsonb)', 'EXECUTE'),
  false, 'ACL: authenticated no publica');
select is(has_function_privilege('praxa_integrations',
  'worker_api.record_breakdown_failure(uuid, uuid, uuid, integer, uuid, text, text, text, text, timestamptz)', 'EXECUTE'),
  true, 'ACL: el rol de C registra fallos');
select is(has_function_privilege('anon', 'public.get_meta_breakdown(uuid, text, text, date, date, uuid)', 'EXECUTE'),
  false, 'ACL: anon no lee');
select is(has_function_privilege('authenticated', 'public.get_meta_breakdown(uuid, text, text, date, date, uuid)', 'EXECUTE'),
  true, 'ACL: authenticated lee');

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_meta_breakdown'),
  false, 'ACL: la lectura es INVOKER');

select is_empty(
  $$select column_name from information_schema.columns
     where table_schema = 'public' and table_name like 'meta_breakdown_%'
       and table_name <> 'meta_breakdown_snapshots' and column_name in ('external_id', 'reach', 'frequency', 'ownership_token')$$,
  'Filas legibles sin IDs externos, alcance, frecuencia ni token');

-- ---------------------------------------------------------------------------
-- Publicación
-- ---------------------------------------------------------------------------

select pg_temp.ready(1, 1);

select lives_ok(
  format($$select pg_temp.pub(1, 1, 1, 'age_gender', %L::jsonb)$$, jsonb_build_array(
    pg_temp.fila(pg_temp.acct(1), '25-34', 'female', current_date,
      '{"actions":[{"action_type":"purchase","variant":"value","count":"2","value":null}]}'),
    pg_temp.fila(pg_temp.acct(1), '25-34', 'male'))),
  'Publicar: edad y género con acciones');

select is((select count(*)::int from public.meta_breakdown_rows where snapshot_id = pg_temp.sid(1)), 2, 'Publicar: dos filas');
select is((select count(*)::int from public.meta_breakdown_coverage where snapshot_id = pg_temp.sid(1)), 3, 'Publicar: cubre los tres días de la ventana');
select is((select spend::text from public.meta_breakdown_rows where snapshot_id = pg_temp.sid(1) limit 1), '1.50', 'Publicar: conserva los decimales');
select is((select last_result from public.meta_breakdown_status where connection_id = pg_temp.kid(1) and dimension = 'age_gender'),
  'complete', 'Publicar: registra el estado');

select is(pg_temp.state_of(format($$select pg_temp.pub(1, 1, 2, 'country', %L::jsonb)$$, jsonb_build_array(pg_temp.fila(pg_temp.acct(1), 'AR', 'x')))),
  '22023', 'Validar: país no admite segundo segmento');
select is(pg_temp.state_of(format($$select pg_temp.pub(1, 1, 2, 'age_gender', %L::jsonb)$$, jsonb_build_array(pg_temp.fila(pg_temp.acct(1), '25-34')))),
  '22023', 'Validar: edad y género exige los dos');
select is(pg_temp.state_of(format($$select pg_temp.pub(1, 1, 2, 'region', %L::jsonb)$$, jsonb_build_array(pg_temp.fila(pg_temp.acct(1), 'X', null, current_date,
    '{"actions":[{"action_type":"purchase","variant":"value","count":"1","value":null}]}')))),
  '22023', 'Validar: región no admite acciones');
select is(pg_temp.state_of(format($$select pg_temp.pub(1, 1, 2, 'country', %L::jsonb)$$, jsonb_build_array(pg_temp.fila(pg_temp.acct(1), E'a\nb')))),
  '22023', 'Validar: segmento con carácter de control');
select is(pg_temp.state_of(format($$select pg_temp.pub(1, 1, 2, 'country', %L::jsonb)$$, jsonb_build_array(pg_temp.fila(pg_temp.acct(1), 'AR', null, current_date - 30)))),
  '22023', 'Validar: fecha fuera de la ventana');
select is(pg_temp.state_of(format($$select pg_temp.pub(1, 1, 2, 'country', %L::jsonb)$$, jsonb_build_array(pg_temp.fila(pg_temp.acct(1), 'AR'), pg_temp.fila(pg_temp.acct(1), 'AR')))),
  '22023', 'Validar: fila repetida');
select is(pg_temp.state_of(format($$select pg_temp.pub(1, 1, 2, 'country', %L::jsonb)$$, jsonb_build_array(pg_temp.fila('act_999', 'AR')))),
  '22023', 'Validar: entidad que el nivel no publicó');
select is(pg_temp.state_of(format($$select pg_temp.pub(1, 1, 2, 'country', %L::jsonb)$$, jsonb_build_array(pg_temp.fila(pg_temp.acct(1), 'AR') || '{"reach":"1"}'))),
  '22023', 'Validar: clave fuera del contrato');
select is(pg_temp.state_of($$select pg_temp.pub(1, 1, 2, 'edad', '[]'::jsonb)$$), '22023', 'Validar: dimensión desconocida');
select is(pg_temp.state_of($$select pg_temp.pub(1, 1, 2, 'country', '[]'::jsonb, clock_timestamp(), 'ad')$$), '22023', 'Validar: nivel fuera de alcance');
select is((select count(*)::int from public.meta_breakdown_snapshots where id = pg_temp.sid(2)), 0, 'Validar: ningún rechazo dejó un snapshot');

-- Idempotencia: el reintento idéntico se reconoce; otro contenido con el mismo ID se rechaza.
create temporary table pg_temp.instante as select clock_timestamp() as at;
select lives_ok(
  format($$select pg_temp.pub(1, 1, 3, 'country', %L::jsonb, (select at from pg_temp.instante))$$, jsonb_build_array(pg_temp.fila(pg_temp.acct(1), 'AR'))),
  'Idempotencia: primera publicación');
select lives_ok(
  format($$select pg_temp.pub(1, 1, 3, 'country', %L::jsonb, (select at from pg_temp.instante))$$, jsonb_build_array(pg_temp.fila(pg_temp.acct(1), 'AR'))),
  'Idempotencia: el reintento idéntico pasa');
select is((select count(*)::int from public.meta_breakdown_rows where snapshot_id = pg_temp.sid(3)), 1, 'Idempotencia: no duplica');
select is(pg_temp.state_of(format($$select pg_temp.pub(1, 1, 3, 'country', %L::jsonb, (select at from pg_temp.instante))$$, jsonb_build_array(pg_temp.fila(pg_temp.acct(1), 'UY')))),
  '22023', 'Idempotencia: otro contenido con el mismo ID se rechaza');

select is(pg_temp.state_of($$update public.meta_breakdown_rows set spend = 2 where snapshot_id = pg_temp.sid(3)$$), '55000', 'Inmutable: filas');

-- ---------------------------------------------------------------------------
-- Posesión
-- ---------------------------------------------------------------------------

select is(pg_temp.state_of($$select worker_api.publish_breakdown(pg_temp.uid(1), pg_temp.cid(1), pg_temp.kid(1), 0, pg_temp.rid(1), pg_temp.tok(99),
    pg_temp.sid(4), 'account', 'region', clock_timestamp(), 1, 10, '{"rows":[]}'::jsonb)$$), 'PX010', 'Posesión: token ajeno');
select is(pg_temp.state_of($$select pg_temp.pub(1, 1, 4, 'region', '[]'::jsonb, clock_timestamp(), 'account', 7)$$), 'PX006', 'Posesión: generación vieja');

select pg_temp.ready(2, 2);
select is(pg_temp.state_of(format($$select worker_api.publish_breakdown(pg_temp.uid(1), pg_temp.cid(1), pg_temp.kid(2), 0, pg_temp.rid(2), pg_temp.tok(2),
    pg_temp.sid(4), 'account', 'region', clock_timestamp(), 1, 10, '{"rows":[]}'::jsonb)$$)), 'PX001', 'Posesión: conexión de otra empresa');

-- ---------------------------------------------------------------------------
-- Fallo: no toca la cobertura vigente
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select worker_api.record_breakdown_failure(pg_temp.uid(1), pg_temp.cid(1), pg_temp.kid(1), 0, pg_temp.rid(1), pg_temp.tok(1),
      'account', 'country', 'meta_error', clock_timestamp())$$,
  'Fallo: se registra');
select is((select last_reason from public.meta_breakdown_status where connection_id = pg_temp.kid(1) and dimension = 'country'),
  'meta_error', 'Fallo: queda el motivo');
select is((select count(*)::int from public.meta_breakdown_coverage where connection_id = pg_temp.kid(1) and dimension = 'country'),
  3, 'Fallo: conserva la cobertura anterior');
select is((select status from public.meta_sync_runs where id = pg_temp.rid(1)), 'running', 'Fallo: no cambia el estado del run');

-- ---------------------------------------------------------------------------
-- Lectura bajo RLS
-- ---------------------------------------------------------------------------

select pg_temp.as_user(1);
select results_eq(
  format($$select segment_primary, segment_secondary, spend from public.get_meta_breakdown(%L, 'account', 'age_gender', current_date, current_date)$$, pg_temp.kid(1)),
  $$values ('25-34'::text, 'female'::text, '1.50'::text), ('25-34', 'male', '1.50')$$,
  'Leer: filas propias, con métricas como texto');
select is(
  (select count(*)::int from public.get_meta_breakdown(pg_temp.kid(1), 'account', 'age_gender', current_date - 2, current_date - 1) where entity_ref is null),
  2, 'Leer: los días cubiertos sin filas se distinguen');
select pg_temp.as_admin();

select pg_temp.as_user(2);
select is((select count(*)::int from public.get_meta_breakdown(pg_temp.kid(1), 'account', 'age_gender', current_date - 2, current_date)),
  0, 'Aislar: otra empresa no lee filas');
select is((select count(*)::int from public.get_meta_breakdown_status(pg_temp.kid(1))), 0, 'Aislar: otra empresa no lee el estado');
select is(pg_temp.state_of(format($$select * from public.get_meta_breakdown(%L, 'account', 'age_gender', current_date - 100, current_date)$$, pg_temp.kid(2))),
  '22023', 'Leer: período mayor a 93 días');
select pg_temp.as_admin();

-- ---------------------------------------------------------------------------
-- Purga: alcanza las cuatro tablas por sus FK, sin reemplazar `purge_connection`
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select worker_api.begin_disconnect(pg_temp.uid(1), pg_temp.cid(1), pg_temp.kid(1));
    select worker_api.purge_connection(pg_temp.uid(1), pg_temp.cid(1), pg_temp.kid(1))$$,
  'Purga: desconectar y purgar con desgloses publicados');
select is((select count(*)::int from public.meta_breakdown_snapshots where connection_id = pg_temp.kid(1)), 0, 'Purga: cero snapshots');
select is((select count(*)::int from public.meta_breakdown_rows where connection_id = pg_temp.kid(1)), 0, 'Purga: cero filas');
select is((select count(*)::int from public.meta_breakdown_coverage where connection_id = pg_temp.kid(1)), 0, 'Purga: cero cobertura');
select is((select count(*)::int from public.meta_breakdown_status where connection_id = pg_temp.kid(1)), 0, 'Purga: cero estado');

select * from finish();
rollback;
