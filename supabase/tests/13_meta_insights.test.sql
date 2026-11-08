-- PRAXA — Insights de Meta (0016): ACL, posesión, snapshots, cobertura, precisión y purga.
--
-- M16c: T-01, T-03, T-05, T-06, T-10, T-11, T-14, T-15, T-24, T-31, T-36, T-37 y T-38.
-- La parte de T-25 sobre roles sintéticos vive en 09, donde está el catálogo exacto.
--
-- Las funciones de `worker_api` se llaman como `postgres`, su dueño: es el mismo cuerpo
-- SECURITY DEFINER que ejecuta el rol de C, cuyo privilegio se prueba en 09. Las lecturas
-- públicas corren como `authenticated` con claims sintéticos. Una empresa por escenario,
-- porque CA-18 admite una sola conexión viva por empresa.
--
-- Los fixtures históricos de reloj se preparan como administrador dentro del rollback: el
-- run nace por `start_sync_run` y después se le fija un `started_at` o un lease en el
-- pasado. `captured_before_day_end` siempre se calcula al publicar; nunca se inserta.
--
-- Datos 100 % sintéticos (CA-12): cuentas `act_` inventadas, sin montos reales.

begin;

create extension if not exists pgtap with schema extensions;
select plan(214);

-- ---------------------------------------------------------------------------
-- Helpers (pg_temp: desaparecen con el rollback)
-- ---------------------------------------------------------------------------

create function pg_temp.uid(n int) returns uuid language sql immutable
as $fn$ select format('aaaaaaaa-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $fn$;

create function pg_temp.cid(n int) returns uuid language sql immutable
as $fn$ select format('c0a00000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $fn$;

create function pg_temp.kid(n int) returns uuid language sql immutable
as $fn$ select format('cc000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $fn$;

create function pg_temp.rid(n int) returns uuid language sql immutable
as $fn$ select format('e0000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $fn$;

create function pg_temp.sid(n int) returns uuid language sql immutable
as $fn$ select format('5a000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $fn$;

create function pg_temp.tok(n int) returns text language sql immutable
as $fn$ select lpad(to_hex(n), 64, '0') $fn$;

create function pg_temp.acct(n int) returns text language sql immutable
as $fn$ select 'act_' || (9000000 + n)::text $fn$;

create function pg_temp.iso(p_at timestamptz) returns text language sql stable
as $fn$ select to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $fn$;

-- Límites sintéticos coherentes: el lease sale de la fórmula de la spec.
create function pg_temp.limits(p_max_window int default 28) returns jsonb language sql immutable
as $fn$ select jsonb_build_object(
  'lookbackDays', least(28, p_max_window), 'maxWindowDays', p_max_window,
  'maxPagesPerLevel', 5, 'maxMetadataPages', 5, 'maxEntities', 50,
  'maxPayloadBytes', 500000, 'maxDurationMs', 20000, 'finalizationReserveMs', 40000,
  'leaseSeconds', 60, 'maxRetries', 2, 'retryDelayMs', 500) $fn$;

create function pg_temp.new_company(n int) returns void language plpgsql
as $fn$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (pg_temp.uid(n), '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', format('insights.%s@praxa.test', n), 'x', now(), now(), now());
  insert into public.companies (id, name, owner_id)
  values (pg_temp.cid(n), format('Empresa sintetica %s', n), pg_temp.uid(n));
end;
$fn$;

-- Empresa n con su conexión activa n, en la zona pedida.
create function pg_temp.active(n int, p_timezone text default 'UTC') returns void language plpgsql
as $fn$
begin
  perform pg_temp.new_company(n);
  perform worker_api.create_pending_connection(
    pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(n), 'negocio_sintetico', 'AAAA',
    'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica',
    '{ads_read}', null);
  perform worker_api.confirm_connection(
    pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(n), pg_temp.acct(n), 'USD', p_timezone, true);
end;
$fn$;

-- Run r de la conexión n, con el token de r y una ventana de tres días por defecto.
create function pg_temp.start(n int, r int, p_from date default current_date - 2,
                              p_to date default current_date, p_generation int default 0)
returns void language plpgsql
as $fn$
begin
  perform worker_api.start_sync_run(pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(n), p_generation,
    pg_temp.rid(r), pg_temp.tok(r), p_from, p_to, pg_temp.limits());
end;
$fn$;

-- Lleva el run al pasado, como fixture administrativo: conserva lease > started_at.
create function pg_temp.backdate(r int, p_started timestamptz) returns void language sql
as $fn$
  update public.meta_sync_runs set started_at = p_started,
         lease_expires_at = clock_timestamp() + interval '1 minute'
   where id = pg_temp.rid(r);
$fn$;

create function pg_temp.expire(r int) returns void language sql
as $fn$
  update public.meta_sync_runs set started_at = clock_timestamp() - interval '2 minutes',
         lease_expires_at = clock_timestamp() - interval '1 second'
   where id = pg_temp.rid(r);
$fn$;

create function pg_temp.unknown_attr() returns jsonb language sql immutable
as $fn$ select '{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb $fn$;

-- Metadata normalizada. Un reintento idéntico reutiliza el payload guardado en una tabla temporal.
create function pg_temp.ent(p_level text, p_ext text, p_parent text, p_name text default 'Nombre sintetico',
                            p_at text default null, p_attr jsonb default null,
                            p_objective text default null)
returns jsonb language sql
as $fn$ select jsonb_build_object('level', p_level, 'external_id', p_ext, 'parent_external_id', p_parent,
  'name', p_name, 'effective_status', 'ACTIVE', 'objective', p_objective,
  'metadata_fetched_at', coalesce(p_at, pg_temp.iso(clock_timestamp())), 'attribution', coalesce(p_attr, pg_temp.unknown_attr())) $fn$;

-- Fila normalizada: toda métrica no indicada viaja como null.
create function pg_temp.fila(p_level text, p_ext text, p_date date, p_metrics jsonb default '{}',
                             p_actions jsonb default '[]')
returns jsonb language sql immutable
as $fn$ select jsonb_build_object('date', p_date::text, 'level', p_level, 'external_id', p_ext,
  'spend', null, 'impressions', null, 'reach', null, 'clicks', null, 'inline_link_clicks', null,
  'ctr', null, 'cpc', null, 'cpm', null, 'frequency', null, 'actions', p_actions) || p_metrics $fn$;

create function pg_temp.pub(n int, r int, s int, p_level text, p_payload jsonb,
                            p_at timestamptz default clock_timestamp(), p_pages int default 1,
                            p_generation int default 0)
returns void language plpgsql
as $fn$
begin
  perform worker_api.publish_snapshot(pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(n), p_generation,
    pg_temp.rid(r), pg_temp.tok(r), pg_temp.sid(s), p_level, p_at, p_pages, 10, p_payload);
end;
$fn$;

-- Fallo de un nivel con payload vacío y razón own_error, salvo indicación.
create function pg_temp.fail(n int, r int, s int, p_level text, p_at timestamptz default clock_timestamp(),
                             p_payload jsonb default '{"entities":[],"days":[]}',
                             p_pages int default 1, p_validated int default 0,
                             p_reason text default 'own_error', p_class text default 'own_error',
                             p_message text default 'Fallo sintetico.', p_stop boolean default false,
                             p_generation int default 0)
returns void language plpgsql
as $fn$
begin
  perform worker_api.fail_sync_run(pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(n), p_generation,
    pg_temp.rid(r), pg_temp.tok(r), pg_temp.sid(s), p_level, p_at, p_pages, 10, p_payload,
    p_validated, p_reason, p_class, p_message, p_stop);
end;
$fn$;

-- SQLSTATE de una sentencia, o null si no falló. La subtransacción revierte su efecto.
create function pg_temp.state_of(p_sql text) returns text language plpgsql
as $fn$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end;
$fn$;

-- SQLSTATE, DETAIL y HINT, para comprobar que el error sale sin datos adjuntos.
create function pg_temp.error_of(p_sql text)
returns table (sqlstate text, detail text, hint text) language plpgsql
as $fn$
declare
  v_state text; v_detail text; v_hint text;
begin
  execute p_sql;
  return query select null::text, null::text, null::text;
exception when others then
  get stacked diagnostics v_state = returned_sqlstate, v_detail = pg_exception_detail, v_hint = pg_exception_hint;
  return query select v_state, nullif(v_detail, ''), nullif(v_hint, '');
end;
$fn$;

create function pg_temp.summary(n int) returns jsonb language sql stable
as $fn$ select meta_sync_summary from public.integration_connections where id = pg_temp.kid(n) $fn$;

create function pg_temp.run_status(r int) returns text language sql stable
as $fn$ select status from public.meta_sync_runs where id = pg_temp.rid(r) $fn$;

create function pg_temp.conn(n int) returns public.integration_connections language sql stable
as $fn$ select c from public.integration_connections c where c.id = pg_temp.kid(n) $fn$;

-- Entra como el usuario n o vuelve al administrador.
create function pg_temp.login(n int) returns void language plpgsql
as $fn$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$fn$;

-- Vuelve al administrador sin claims: la excepción de 0008 exige `auth.uid()` nulo.
create function pg_temp.logout() returns void language plpgsql
as $fn$
begin
  reset role;
  perform set_config('request.jwt.claims', null, true);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- T-01: tablas, RLS, ACL y aislamiento (C-01, C-02)
-- ---------------------------------------------------------------------------

select results_eq(
  $$select c.relname::text collate "default", c.relrowsecurity, c.relforcerowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname in ('meta_sync_runs', 'meta_entities', 'meta_insight_snapshots',
                         'meta_snapshot_entities', 'meta_snapshot_days', 'meta_snapshot_actions',
                         'meta_daily_coverage')
     order by 1$$,
  $$values ('meta_daily_coverage', true, true), ('meta_entities', true, true),
           ('meta_insight_snapshots', true, true), ('meta_snapshot_actions', true, true),
           ('meta_snapshot_days', true, true), ('meta_snapshot_entities', true, true),
           ('meta_sync_runs', true, true)$$,
  'T-01: las siete tablas existen con RLS habilitada y forzada');

create function pg_temp.new_table_privileges(p_role text)
returns table (table_name text, privilege text) language sql
as $fn$
  select t.name, p.name
    from unnest(array['public.meta_sync_runs', 'public.meta_entities', 'public.meta_insight_snapshots',
                      'public.meta_snapshot_entities', 'public.meta_snapshot_days',
                      'public.meta_snapshot_actions', 'public.meta_daily_coverage']) as t(name)
   cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p(name)
   where has_table_privilege(p_role, t.name, p.name)
   order by 1, 2
$fn$;

select is_empty($$select * from pg_temp.new_table_privileges('anon')$$,
  'T-01: anon no tiene privilegios sobre las tablas nuevas');
select results_eq($$select * from pg_temp.new_table_privileges('authenticated')$$,
  $$values ('public.meta_daily_coverage', 'SELECT')$$,
  'T-01: authenticated solo tiene SELECT sobre la cobertura');
select is_empty($$select * from pg_temp.new_table_privileges('praxa_integrations')$$,
  'T-01: el rol de C no tiene grants directos');
select is_empty($$select * from pg_temp.new_table_privileges('service_role')$$,
  'T-01: service_role no tiene privilegios sobre las tablas nuevas');

select results_eq(
  $$select p.tablename::text collate "default", p.cmd::text, p.roles::text[] collate "default"
      from pg_policies p
     where p.schemaname = 'public' and p.tablename like 'meta\_%' order by 1$$,
  $$values ('meta_daily_coverage', 'SELECT', array['authenticated'])$$,
  'T-01: la única política nueva es el SELECT de la cobertura');

select results_eq(
  $$select p.proname::text collate "default", p.prosecdef, p.provolatile::text,
           p.proconfig = array['search_path=""']
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('get_meta_daily_coverage', 'list_meta_entities', 'get_meta_sync_status')
     order by 1$$,
  $$values ('get_meta_daily_coverage', false, 's', true),
           ('get_meta_sync_status', false, 's', true),
           ('list_meta_entities', false, 's', true)$$,
  'T-01: las tres lecturas son INVOKER, STABLE y con search_path vacío');

select is_empty(
  $$select p.proname, r.name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     cross join unnest(array['anon', 'praxa_integrations', 'service_role']) as r(name)
     where n.nspname = 'public'
       and p.proname in ('get_meta_daily_coverage', 'list_meta_entities', 'get_meta_sync_status')
       and has_function_privilege(r.name, p.oid, 'EXECUTE')$$,
  'T-01: anon, el rol de C y service_role no ejecutan las lecturas');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_meta_daily_coverage', 'list_meta_entities', 'get_meta_sync_status')
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  3, 'T-01: authenticated ejecuta las tres lecturas');

-- Dos empresas con datos publicados: A ve lo suyo y B no ve nada de A.
select pg_temp.active(1);
select pg_temp.active(2);
select pg_temp.start(1, 1);
select pg_temp.pub(1, 1, 1, 'account', jsonb_build_object(
  'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(1), null)),
  'days', jsonb_build_array(pg_temp.fila('account', pg_temp.acct(1), current_date, '{"spend":"1.50"}'))));

select pg_temp.login(1);
select ok((select count(*) from public.meta_daily_coverage where connection_id = pg_temp.kid(1)) = 3,
  'T-01: el miembro lee la cobertura de los tres días de su conexión');
select throws_ok($$select 1 from public.meta_sync_runs$$, '42501', null, 'T-01: JWT no lee ejecuciones');
select throws_ok($$select 1 from public.meta_entities$$, '42501', null, 'T-01: JWT no lee entidades');
select throws_ok($$select 1 from public.meta_insight_snapshots$$, '42501', null, 'T-01: JWT no lee snapshots');
select throws_ok($$select 1 from public.meta_snapshot_entities$$, '42501', null, 'T-01: JWT no lee metadata');
select throws_ok($$select 1 from public.meta_snapshot_days$$, '42501', null, 'T-01: JWT no lee días');
select throws_ok($$select 1 from public.meta_snapshot_actions$$, '42501', null, 'T-01: JWT no lee acciones');
select throws_ok($$delete from public.meta_daily_coverage$$, '42501', null, 'T-01: JWT no borra cobertura');
select throws_ok($$update public.meta_daily_coverage set rows = '[]'$$, '42501', null, 'T-01: JWT no actualiza cobertura');
select pg_temp.logout();

select pg_temp.login(2);
select is_empty($$select 1 from public.meta_daily_coverage$$, 'T-01: B no lee la cobertura de A');
select is_empty(
  format($$select 1 from public.get_meta_daily_coverage(%L, 'account', current_date - 2, current_date)$$, pg_temp.kid(1)),
  'T-01: la lectura de la conexión de A da cero filas a B, sin calendario');
select is_empty(format($$select 1 from public.list_meta_entities(%L, 'account')$$, pg_temp.kid(1)),
  'T-01: B no lista las entidades de A');
select is_empty(format($$select 1 from public.get_meta_sync_status(%L)$$, pg_temp.kid(1)),
  'T-01: B no lee el estado de A');
select pg_temp.logout();

select pg_temp.login(1);
select is_empty(
  format($$select 1 from public.get_meta_daily_coverage(%L, 'account', current_date, current_date, %L)$$,
         pg_temp.kid(1), 'ffffffff-0000-4000-8000-000000000001'),
  'T-01: una referencia adulterada da cero filas');
select pg_temp.logout();

-- Las FK compuestas impiden cruzar empresas aun como administrador.
select is(pg_temp.state_of(format(
  $$insert into public.meta_entities (company_id, connection_id, level, external_id, parent_ref)
    values (%L, %L, 'campaign', '42', null)$$, pg_temp.cid(2), pg_temp.kid(1))),
  '23503', 'T-01: una entidad no puede cruzar empresa y conexión');
select is(pg_temp.state_of(format(
  $$insert into public.meta_sync_runs (id, company_id, connection_id, credential_generation, ownership_token,
      started_at, lease_expires_at, finished_at, window_from, window_to, status, limits)
    values (gen_random_uuid(), %L, %L, 0, %L, now(), now() + interval '1 minute', now(), current_date, current_date,
            'failed', %L)$$, pg_temp.cid(2), pg_temp.kid(1), pg_temp.tok(99), pg_temp.limits())),
  '23503', 'T-01: una ejecución no puede cruzar empresa y conexión');
select is(pg_temp.state_of(format(
  $$update public.integration_connections set current_sync_run_id = %L where id = %L$$,
  pg_temp.rid(1), pg_temp.kid(2))),
  '23503', 'T-01: el puntero solo puede apuntar a un run de la misma conexión');

-- Autorización antes que cualquier otra cosa: ajena = PX001 sin DETAIL ni HINT.
select results_eq(
  format($q$select * from pg_temp.error_of(%L)$q$, format(
    $$select * from worker_api.start_sync_run(%L, %L, %L, 0, %L, %L, current_date, current_date, %L)$$,
    pg_temp.uid(2), pg_temp.cid(2), pg_temp.kid(1), pg_temp.rid(90), pg_temp.tok(90), pg_temp.limits())),
  $$values ('PX001'::text, null::text, null::text)$$,
  'T-01: iniciar sobre una conexión ajena da PX001, sin DETAIL ni HINT');
select is(pg_temp.state_of(format(
  $$select * from worker_api.publish_snapshot(%L, %L, %L, 0, %L, %L, %L, 'account', clock_timestamp(), 1, 1, '{"entities":[],"days":[]}')$$,
  pg_temp.uid(2), pg_temp.cid(1), pg_temp.kid(1), pg_temp.rid(1), pg_temp.tok(1), pg_temp.sid(90))),
  'PX001', 'T-01: un actor que no es miembro no publica');
select is(pg_temp.state_of(format(
  $$select * from worker_api.record_connection_error(%L, %L, %L, 0, 'unknown', 'Fallo sintetico.')$$,
  pg_temp.uid(2), pg_temp.cid(2), pg_temp.kid(1))),
  'PX001', 'T-01: registrar un error en una conexión ajena da PX001');

-- ---------------------------------------------------------------------------
-- T-03: inicio único, reintento y recuperación (C-03)
-- ---------------------------------------------------------------------------

select pg_temp.active(3);
select pg_temp.start(3, 31);
create temp table lease_a as
  select lease_expires_at, started_at from public.meta_sync_runs where id = pg_temp.rid(31);

select is(pg_temp.state_of(format(
  $$select * from worker_api.start_sync_run(%L, %L, %L, 0, %L, %L, current_date - 2, current_date, %L)$$,
  pg_temp.uid(3), pg_temp.cid(3), pg_temp.kid(3), pg_temp.rid(32), pg_temp.tok(32), pg_temp.limits())),
  'PX009', 'T-03: B no inicia mientras A está vigente (PX009)');

select results_eq(
  format($$select r.run_id, r.lease_expires_at from worker_api.start_sync_run(%L, %L, %L, 0, %L, %L,
    current_date - 2, current_date, %L) r$$,
    pg_temp.uid(3), pg_temp.cid(3), pg_temp.kid(3), pg_temp.rid(31), pg_temp.tok(31), pg_temp.limits()),
  format($$select %L::uuid, lease_expires_at from lease_a$$, pg_temp.rid(31)),
  'T-03: el reintento exacto de A devuelve la fila y no renueva el lease');

select is(pg_temp.state_of(format(
  $$select * from worker_api.start_sync_run(%L, %L, %L, 0, %L, %L, current_date - 2, current_date, %L)$$,
  pg_temp.uid(3), pg_temp.cid(3), pg_temp.kid(3), pg_temp.rid(31), pg_temp.tok(32), pg_temp.limits())),
  'PX001', 'T-03: el mismo id con otro token no es un reintento');

select ok((pg_temp.conn(3)).current_sync_run_id = pg_temp.rid(31), 'T-03: el puntero queda en A');
select is((pg_temp.summary(3))->>'status', 'running', 'T-03: el resumen queda running');
select is((pg_temp.summary(3))->'levels'->'ad'->>'status', 'pending', 'T-03: los niveles quedan pending');

select pg_temp.expire(31);
select pg_temp.start(3, 32);
select is(pg_temp.run_status(31), 'superseded', 'T-03: B desplaza a A vencida');
select ok((pg_temp.conn(3)).current_sync_run_id = pg_temp.rid(32), 'T-03: el puntero pasa a B');
select ok((select finished_at is not null from public.meta_sync_runs where id = pg_temp.rid(31)),
  'T-03: A desplazada queda terminada');

-- A vigente con otra generación: una reautorización no espera a que venza el lease.
select pg_temp.active(4);
select pg_temp.start(4, 41);
update public.integration_connections set credential_generation = 1 where id = pg_temp.kid(4);
select pg_temp.start(4, 42, p_generation => 1);
select is(pg_temp.run_status(41), 'superseded', 'T-03: A vigente con generación anterior queda superseded al iniciar B');
select is(pg_temp.state_of(format(
  $$select pg_temp.pub(4, 41, 41, 'account', '{"entities":[],"days":[]}', clock_timestamp(), 1, 0)$$)),
  'PX006', 'T-03: A con generación anterior no escribe');

select is(pg_temp.state_of(format(
  $$select * from worker_api.start_sync_run(%L, %L, %L, 5, %L, %L, current_date, current_date, %L)$$,
  pg_temp.uid(4), pg_temp.cid(4), pg_temp.kid(4), pg_temp.rid(43), pg_temp.tok(43), pg_temp.limits())),
  'PX006', 'T-03: iniciar con otra generación da PX006');
select is(pg_temp.state_of(format(
  $$select * from worker_api.start_sync_run(%L, %L, %L, 1, %L, 'corto', current_date, current_date, %L)$$,
  pg_temp.uid(4), pg_temp.cid(4), pg_temp.kid(4), pg_temp.rid(43), pg_temp.limits())),
  '22023', 'T-03: un token que no es de 64 hex da 22023');
select is(pg_temp.state_of(format(
  $$select * from worker_api.start_sync_run(%L, %L, %L, 1, %L, %L, current_date - 40, current_date, %L)$$,
  pg_temp.uid(4), pg_temp.cid(4), pg_temp.kid(4), pg_temp.rid(43), pg_temp.tok(43), pg_temp.limits())),
  '22023', 'T-03: una ventana mayor que el máximo da 22023');
select is(pg_temp.state_of(format(
  $$select * from worker_api.start_sync_run(%L, %L, %L, 1, %L, %L, current_date, current_date, %L)$$,
  pg_temp.uid(4), pg_temp.cid(4), pg_temp.kid(4), pg_temp.rid(43), pg_temp.tok(43),
  pg_temp.limits() || '{"extra":1}')),
  '22023', 'T-03: límites con claves extra dan 22023');
select is(pg_temp.state_of(format(
  $$select * from worker_api.start_sync_run(%L, %L, %L, 1, %L, %L, current_date, current_date, %L)$$,
  pg_temp.uid(4), pg_temp.cid(4), pg_temp.kid(4), pg_temp.rid(43), pg_temp.tok(43),
  pg_temp.limits() || '{"leaseSeconds":61}')),
  '22023', 'T-03: un lease que no sigue la fórmula da 22023');

-- Solo una conexión activa puede iniciar.
select pg_temp.active(5);
update public.integration_connections
   set status = 'needs_reauth', last_error_class = 'authentication', last_error_message = 'Sintetico.'
 where id = pg_temp.kid(5);
select is(pg_temp.state_of(format(
  $$select * from worker_api.start_sync_run(%L, %L, %L, 0, %L, %L, current_date, current_date, %L)$$,
  pg_temp.uid(5), pg_temp.cid(5), pg_temp.kid(5), pg_temp.rid(51), pg_temp.tok(51), pg_temp.limits())),
  'PX004', 'T-03: una conexión en needs_reauth no inicia (PX004)');

-- ---------------------------------------------------------------------------
-- T-05: A vencida no publica, no falla ni pide reautorización (C-04, C-15)
-- ---------------------------------------------------------------------------

select pg_temp.active(6);
select pg_temp.start(6, 61);
select pg_temp.expire(61);
select is(pg_temp.state_of($$select pg_temp.pub(6, 61, 610, 'account', '{"entities":[],"days":[]}')$$),
  'PX010', 'T-05: A vencida antes de que exista B no publica (PX010)');
select pg_temp.start(6, 62);
select pg_temp.pub(6, 62, 620, 'account', '{"entities":[],"days":[]}');
create temp table summary_b as select pg_temp.summary(6) as s;

select is(pg_temp.state_of($$select pg_temp.pub(6, 61, 611, 'campaign', '{"entities":[],"days":[]}')$$),
  'PX010', 'T-05: A desplazada no publica');
select is(pg_temp.state_of($$select pg_temp.fail(6, 61, 612, 'campaign')$$),
  'PX010', 'T-05: A desplazada no falla');
select is(pg_temp.state_of($$select pg_temp.fail(6, 61, 613, 'campaign', p_reason => 'meta_error',
    p_class => 'authentication', p_stop => true)$$),
  'PX010', 'T-05: A desplazada no pide reautorización');
select is((pg_temp.conn(6)).status::text, 'active', 'T-05: la conexión sigue activa');
select is((pg_temp.conn(6)).last_error_class, null, 'T-05: A no escribe error en la conexión');
select ok(pg_temp.summary(6) = (select s from summary_b), 'T-05: A no cambia el resumen de B');
select is((select count(*)::int from public.meta_insight_snapshots where sync_run_id = pg_temp.rid(61)), 0,
  'T-05: A no deja snapshots');
select is(pg_temp.state_of(format(
  $$select * from worker_api.publish_snapshot(%L, %L, %L, 0, %L, %L, %L, 'campaign', clock_timestamp(), 1, 1, '{"entities":[],"days":[]}')$$,
  pg_temp.uid(6), pg_temp.cid(6), pg_temp.kid(6), pg_temp.rid(62), pg_temp.tok(99), pg_temp.sid(621))),
  'PX010', 'T-05: un token distinto no publica');

-- Reloj real después de los bloqueos: el lease se mira con clock_timestamp().
select pg_temp.active(7);
select pg_temp.start(7, 71);
update public.meta_sync_runs set started_at = clock_timestamp() - interval '2 minutes',
       lease_expires_at = clock_timestamp() + interval '1 second' where id = pg_temp.rid(71);
select pg_sleep(1.2);
select is(pg_temp.state_of($$select pg_temp.pub(7, 71, 710, 'account', '{"entities":[],"days":[]}')$$),
  'PX010', 'T-05: un lease vencido durante la transacción se detecta con el reloj real');

-- ---------------------------------------------------------------------------
-- T-06: atomicidad e idempotencia (C-05)
-- ---------------------------------------------------------------------------

select pg_temp.active(8);
select pg_temp.start(8, 81);
create temp table p8 as select jsonb_build_object(
  'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(8), null)),
  'days', jsonb_build_array(pg_temp.fila('account', pg_temp.acct(8), current_date, '{"spend":"2.00"}',
    '[{"action_type":"purchase","variant":"value","count":"1.5","value":"3.25"}]'))) as p,
  clock_timestamp() as ts;

select is(pg_temp.state_of(format(
  $$select pg_temp.pub(8, 81, 810, 'account', %L::jsonb, %L::timestamptz)$$,
  (select p from p8) || jsonb_build_object('days', jsonb_build_array(
     pg_temp.fila('account', pg_temp.acct(8), current_date, '{"spend":"2.00"}'),
     pg_temp.fila('account', pg_temp.acct(8), current_date, '{"spend":"mal"}'))), (select ts from p8))),
  '22023', 'T-06: una fila inválida rechaza la publicación');
select is((select count(*)::int from public.meta_insight_snapshots where sync_run_id = pg_temp.rid(81)), 0,
  'T-06: la publicación rechazada no deja snapshot');
select is((select count(*)::int from public.meta_daily_coverage where connection_id = pg_temp.kid(8)), 0,
  'T-06: la publicación rechazada no deja cobertura');
select is((select count(*)::int from public.meta_entities where connection_id = pg_temp.kid(8)), 0,
  'T-06: la publicación rechazada no deja entidades');

select pg_temp.pub(8, 81, 811, 'account', (select p from p8), (select ts from p8));
select is(pg_temp.state_of(format($$select pg_temp.pub(8, 81, 811, 'account', %L::jsonb, %L::timestamptz)$$,
  (select p from p8), (select ts from p8))),
  null, 'T-06: repetir el mismo snapshot no falla');
select is((select count(*)::int from public.meta_insight_snapshots where sync_run_id = pg_temp.rid(81)), 1,
  'T-06: repetir no duplica el snapshot');
select is((select count(*)::int from public.meta_snapshot_days where snapshot_id = pg_temp.sid(811)), 1,
  'T-06: repetir no duplica los días');
select is((select count(*)::int from public.meta_snapshot_actions where snapshot_id = pg_temp.sid(811)), 1,
  'T-06: repetir no duplica las acciones');
select is(pg_temp.state_of(format($$select pg_temp.pub(8, 81, 811, 'account', %L::jsonb, %L::timestamptz)$$,
  (select p from p8) || jsonb_build_object('days', jsonb_build_array(
     pg_temp.fila('account', pg_temp.acct(8), current_date, '{"spend":"9.00"}'))), (select ts from p8))),
  '22023', 'T-06: el mismo id con otro contenido se rechaza');
select is(pg_temp.state_of(format($$select pg_temp.pub(8, 81, 812, 'account', %L::jsonb, %L::timestamptz)$$,
  (select p from p8), (select ts from p8))),
  '22023', 'T-06: otro snapshot para el mismo nivel del run se rechaza');

-- ---------------------------------------------------------------------------
-- T-10: un completo nuevo reemplaza; el snapshot viejo permanece (C-07, C-08)
-- ---------------------------------------------------------------------------

select pg_temp.active(10);
select pg_temp.start(10, 101);
select pg_temp.pub(10, 101, 1010, 'account', jsonb_build_object(
  'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(10), null, 'Nombre viejo')),
  'days', jsonb_build_array(pg_temp.fila('account', pg_temp.acct(10), current_date - 1, '{"spend":"7.00"}'))));
select pg_temp.expire(101);
select pg_temp.start(10, 102);
select pg_temp.pub(10, 102, 1020, 'account', jsonb_build_object(
  'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(10), null, 'Nombre nuevo')),
  'days', '[]'::jsonb));

select is((select jsonb_array_length(rows) from public.meta_daily_coverage
            where connection_id = pg_temp.kid(10) and level = 'account' and date = current_date - 1), 0,
  'T-10: el snapshot nuevo sin fila elimina el valor vigente anterior');
select ok((select snapshot_id = pg_temp.sid(1020) from public.meta_daily_coverage
            where connection_id = pg_temp.kid(10) and level = 'account' and date = current_date - 1),
  'T-10: la cobertura apunta al snapshot nuevo');
select is((select spend::text from public.meta_snapshot_days where snapshot_id = pg_temp.sid(1010)), '7.00',
  'T-10: el snapshot viejo conserva su fila');
select is((select name from public.meta_snapshot_entities where snapshot_id = pg_temp.sid(1010)), 'Nombre viejo',
  'T-10: la metadata capturada no se reescribe');

select pg_temp.login(10);
select results_eq(
  format($$select presence, spend from public.get_meta_daily_coverage(%L, 'account', current_date - 1, current_date - 1)$$, pg_temp.kid(10)),
  $$values ('sin_fila_reportada'::text, null::text)$$,
  'T-10: el día cubierto sin fila se lee como sin_fila_reportada');
select pg_temp.logout();

-- Un fallo posterior no toca la cobertura vigente.
select pg_temp.expire(102);
select pg_temp.start(10, 103);
select pg_temp.fail(10, 103, 1030, 'account');
select ok((select snapshot_id = pg_temp.sid(1020) from public.meta_daily_coverage
            where connection_id = pg_temp.kid(10) and level = 'account' and date = current_date - 1),
  'T-10: un fallo posterior conserva la cobertura vigente');

-- ---------------------------------------------------------------------------
-- T-11: inmutabilidad; la purga y la cascada siguen permitidas (C-08, C-16)
-- ---------------------------------------------------------------------------

select is(pg_temp.state_of(format($$update public.meta_insight_snapshots set pages = 9 where id = %L$$, pg_temp.sid(811))),
  '55000', 'T-11: el snapshot no se actualiza');
select is(pg_temp.state_of(format($$update public.meta_snapshot_entities set name = 'x' where snapshot_id = %L$$, pg_temp.sid(811))),
  '55000', 'T-11: la metadata capturada no se actualiza');
select is(pg_temp.state_of(format($$update public.meta_snapshot_days set spend = 9 where snapshot_id = %L$$, pg_temp.sid(811))),
  '55000', 'T-11: el día no se actualiza');
select is(pg_temp.state_of(format($$update public.meta_snapshot_actions set count = 9 where snapshot_id = %L$$, pg_temp.sid(811))),
  '55000', 'T-11: la acción no se actualiza');

-- ---------------------------------------------------------------------------
-- T-14: el patrón decimal acepta y rechaza lo mismo que Zod (C-09, C-20)
-- ---------------------------------------------------------------------------

select pg_temp.active(14);

create function pg_temp.metric_state(p_metrics jsonb, p_actions jsonb default '[]') returns text language plpgsql
as $fn$
declare
  v_state text;
begin
  begin
    perform worker_api.start_sync_run(pg_temp.uid(14), pg_temp.cid(14), pg_temp.kid(14), 0,
      pg_temp.rid(141), pg_temp.tok(141), current_date, current_date, pg_temp.limits());
    perform worker_api.publish_snapshot(pg_temp.uid(14), pg_temp.cid(14), pg_temp.kid(14), 0,
      pg_temp.rid(141), pg_temp.tok(141), pg_temp.sid(141), 'account', clock_timestamp(), 1, 1,
      jsonb_build_object(
        'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(14), null)),
        'days', jsonb_build_array(pg_temp.fila('account', pg_temp.acct(14), current_date, p_metrics, p_actions))));
    raise exception 'sin_error' using errcode = 'PXOK0';
  exception when others then
    v_state := sqlstate;
  end;
  return nullif(v_state, 'PXOK0');
end;
$fn$;

select is(pg_temp.metric_state('{"spend":"0"}'), null, 'T-14: acepta 0');
select is(pg_temp.metric_state('{"spend":"12.34"}'), null, 'T-14: acepta 12.34');
select is(pg_temp.metric_state('{"spend":"00.50"}'), null, 'T-14: acepta 00.50');
select is(pg_temp.metric_state('{"impressions":"9007199254740993"}'), null, 'T-14: acepta un entero fuera de precisión de number');
select is(pg_temp.metric_state('{"spend":""}'), '22023', 'T-14: rechaza cadena vacía');
select is(pg_temp.metric_state('{"spend":"12x34"}'), '22023', 'T-14: rechaza 12x34');
select is(pg_temp.metric_state($${"spend":"12\\34"}$$), '22023', 'T-14: rechaza una barra intermedia');
select is(pg_temp.metric_state('{"spend":"1."}'), '22023', 'T-14: rechaza 1.');
select is(pg_temp.metric_state('{"spend":".5"}'), '22023', 'T-14: rechaza .5');
select is(pg_temp.metric_state('{"spend":"-1"}'), '22023', 'T-14: rechaza un signo');
select is(pg_temp.metric_state('{"spend":" 1"}'), '22023', 'T-14: rechaza un espacio');
select is(pg_temp.metric_state('{"spend":"1e5"}'), '22023', 'T-14: rechaza un exponente');
select is(pg_temp.metric_state('{"spend":"NaN"}'), '22023', 'T-14: rechaza NaN');
select is(pg_temp.metric_state('{"spend":"Infinity"}'), '22023', 'T-14: rechaza infinito');
select is(pg_temp.metric_state('{"spend":1.5}'), '22023', 'T-14: rechaza un número JSON');
select is(pg_temp.metric_state(jsonb_build_object('spend', repeat('1', 129))), '22023', 'T-14: rechaza más de 128 caracteres');
select is(pg_temp.metric_state('{"impressions":"1.5"}'), '22023', 'T-14: un conteo base no admite decimales');
select is(pg_temp.metric_state('{"impressions":"9223372036854775808"}'), '22023', 'T-14: un conteo base tiene que caber en bigint');
select is(pg_temp.metric_state('{}', '[{"action_type":"purchase","variant":"value","count":"1.5","value":null}]'), null,
  'T-14: una acción admite conteo fraccionario');
select is(pg_temp.metric_state('{}', '[{"action_type":"purchase","variant":"value","count":1,"value":null}]'), '22023',
  'T-14: una acción no admite números JSON');
select is(pg_temp.metric_state('{}', '[{"action_type":"purchase","variant":"value","count":null,"value":null}]'), '22023',
  'T-14: una acción sin conteo ni valor se rechaza');
select is(pg_temp.metric_state('{}', '[{"action_type":"con espacio","variant":"value","count":"1","value":null}]'), '22023',
  'T-14: un action_type fuera del contrato se rechaza');
select is(pg_temp.metric_state('{}', '[{"action_type":"purchase","variant":"7d click","count":"1","value":null}]'), '22023',
  'T-14: una variante fuera del contrato se rechaza');
select is(pg_temp.metric_state('{}', '[{"action_type":"purchase","variant":"value","count":"1","value":null,"x":1}]'), '22023',
  'T-14: una acción con claves extra se rechaza');
select is(pg_temp.metric_state('{}', '[{"action_type":"purchase","variant":"value","count":"1","value":null},{"action_type":"purchase","variant":"value","count":"2","value":null}]'), '22023',
  'T-14: una acción duplicada se rechaza');
select is(pg_temp.metric_state('{"extra":"1"}'), '22023', 'T-14: una fila con claves extra se rechaza');

-- ---------------------------------------------------------------------------
-- T-15: captura parcial persistida y día local con DST (C-10)
-- ---------------------------------------------------------------------------

select pg_temp.active(15, 'America/New_York');
select pg_temp.start(15, 151, date '2026-03-07', date '2026-03-08');
select pg_temp.backdate(151, timestamptz '2026-03-01 00:00:00+00');
-- El 8 de marzo tiene 23 horas: termina a las 04:00 UTC del 9. Sumar 24 horas al inicio
-- daría las 05:00 UTC y marcaría como parcial esta captura de las 04:30 UTC.
select pg_temp.pub(15, 151, 1510, 'account', jsonb_build_object(
  'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(15), null)),
  'days', jsonb_build_array(pg_temp.fila('account', pg_temp.acct(15), date '2026-03-08', '{"spend":"1"}'))),
  timestamptz '2026-03-09 04:30:00+00');
select is((select captured_before_day_end from public.meta_daily_coverage
            where connection_id = pg_temp.kid(15) and date = date '2026-03-08'), false,
  'T-15: DST, una captura posterior al fin local no es parcial');

select pg_temp.active(16, 'America/Argentina/Buenos_Aires');
select pg_temp.start(16, 161, date '2026-03-01', date '2026-03-03');
select pg_temp.backdate(161, timestamptz '2026-03-01 00:00:00+00');
-- Mediodía del 2 de marzo en Buenos Aires.
select pg_temp.pub(16, 161, 1610, 'account', jsonb_build_object(
  'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(16), null)),
  'days', jsonb_build_array(pg_temp.fila('account', pg_temp.acct(16), date '2026-03-02', '{"spend":"1"}'))),
  timestamptz '2026-03-02 15:00:00+00');

select pg_temp.login(16);
select results_eq(
  format($$select day, presence, captured_before_day_end, temporal_status
             from public.get_meta_daily_coverage(%L, 'account', date '2026-02-28', date '2026-03-03') order by day$$, pg_temp.kid(16)),
  $$values (date '2026-02-28', 'no_observado'::text, null::boolean, 'cerrado'::text),
           (date '2026-03-01', 'sin_fila_reportada', false, 'cerrado'),
           (date '2026-03-02', 'con_datos', true, 'cerrado'),
           (date '2026-03-03', 'sin_fila_reportada', true, 'cerrado')$$,
  'T-15: la captura de mediodía sigue parcial al consultarla después, y no observado queda sin flag');
select pg_temp.logout();

-- Hoy sigue abierto según la zona de la cuenta, separado del flag de captura.
select pg_temp.expire(161);
select pg_temp.start(16, 162, p_from => (now() at time zone 'America/Argentina/Buenos_Aires')::date,
                     p_to => (now() at time zone 'America/Argentina/Buenos_Aires')::date);
select pg_temp.pub(16, 162, 1620, 'account', '{"entities":[],"days":[]}');
select pg_temp.login(16);
select results_eq(
  format($$select temporal_status, captured_before_day_end from public.get_meta_daily_coverage(%L, 'account',
      (now() at time zone 'America/Argentina/Buenos_Aires')::date, (now() at time zone 'America/Argentina/Buenos_Aires')::date)$$, pg_temp.kid(16)),
  $$values ('abierto'::text, true)$$,
  'T-15: hoy está abierto y la captura es parcial');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- T-31: proyección pública cerrada, jerarquía y precisión (C-02, C-20)
-- ---------------------------------------------------------------------------

select pg_temp.active(31);
select pg_temp.start(31, 311);
create temp table p31 as select jsonb_build_object(
  'entities', jsonb_build_array(
    pg_temp.ent('account', pg_temp.acct(31), null),
    pg_temp.ent('campaign', '310000000000001', pg_temp.acct(31), 'Campana <b>', p_objective => 'OUTCOME_SALES'),
    pg_temp.ent('adset', '310000000000002', '310000000000001', p_attr => jsonb_build_object('known', true, 'report_time', 'impression',
      'unified', true, 'settings', jsonb_build_array(jsonb_build_object('adset_external_id', '310000000000002',
        'windows', '[{"event_type":"VIEW_THROUGH","days":1},{"event_type":"CLICK_THROUGH","days":7}]'::jsonb))))),
  'days', jsonb_build_array(pg_temp.fila('adset', '310000000000002', current_date,
    '{"spend":"123456789012345678901234567890.123456789","impressions":"9007199254740993","ctr":"0.100","reach":"0"}',
    '[{"action_type":"purchase","variant":"value","count":"1.50","value":"2.75"},{"action_type":"purchase","variant":"seven_day_click","count":null,"value":"1.10"}]'))) as p;

select pg_temp.pub(31, 311, 3110, 'adset', (select p from p31));

select pg_temp.login(31);
select results_eq(
  format($$select spend, impressions, reach, ctr, clicks, presence, name, currency, timezone
            from public.get_meta_daily_coverage(%L, 'adset', current_date, current_date) where presence = 'con_datos'$$, pg_temp.kid(31)),
  $$values ('123456789012345678901234567890.123456789'::text, '9007199254740993'::text, '0'::text, '0.100'::text,
            null::text, 'con_datos'::text, 'Nombre sintetico'::text, 'USD'::text, 'UTC'::text)$$,
  'T-31: SQL devuelve texto exacto, cero explícito y null separados');
select is(
  (select jsonb_agg(a order by a->>'variant') from public.get_meta_daily_coverage(pg_temp.kid(31), 'adset', current_date, current_date) c,
          jsonb_array_elements(c.actions) a where c.presence = 'con_datos'),
  '[{"action_type":"purchase","variant":"seven_day_click","count":null,"value":"1.10"},{"action_type":"purchase","variant":"value","count":"1.50","value":"2.75"}]'::jsonb,
  'T-31: las variantes se conservan separadas, con conteo y valor como texto');
select results_eq(
  format($$select name, objective, level from public.list_meta_entities(%L, 'campaign')$$, pg_temp.kid(31)),
  $$values ('Campana <b>'::text, 'OUTCOME_SALES'::text, 'campaign'::text)$$,
  'T-31: list_meta_entities devuelve la metadata capturada del nivel');
select is(
  (select count(*)::int from public.meta_daily_coverage c
    where c.connection_id = pg_temp.kid(31)
      and (c.entities::text like '%31000000000000%' or c.rows::text like '%31000000000000%'
           or c.entities::text like '%external_id%' or c.rows::text like '%external_id%'
           or c.entities::text like '%' || pg_temp.acct(31) || '%')), 0,
  'T-31: la proyección no contiene IDs externos');
select is(
  (select array_agg(distinct k order by k) from public.meta_daily_coverage c,
          jsonb_array_elements(c.entities) e, jsonb_object_keys(e) k where c.connection_id = pg_temp.kid(31)),
  array['attribution', 'effective_status', 'entity_ref', 'level', 'metadata_fetched_at', 'name', 'objective', 'parent_ref'],
  'T-31: la proyección de entidades tiene exactamente sus claves');
select is(
  (select array_agg(distinct k order by k) from public.meta_daily_coverage c,
          jsonb_array_elements(c.rows) e, jsonb_object_keys(e) k where c.connection_id = pg_temp.kid(31)),
  array['actions', 'attribution', 'clicks', 'cpc', 'cpm', 'ctr', 'entity_ref', 'frequency', 'impressions',
        'inline_link_clicks', 'reach', 'spend'],
  'T-31: la proyección de filas tiene exactamente sus claves');
select ok(
  (select (e->'attribution'->'settings'->0->>'adset_ref') ~ '^[0-9a-f-]{36}$'
     from public.meta_daily_coverage c, jsonb_array_elements(c.entities) e
    where c.connection_id = pg_temp.kid(31) and e->>'level' = 'adset' limit 1),
  'T-31: la atribución guarda una referencia opaca del conjunto');
select is(
  (select e->'attribution'->'settings'->0->'windows'
     from public.meta_daily_coverage c, jsonb_array_elements(c.entities) e
    where c.connection_id = pg_temp.kid(31) and e->>'level' = 'adset' limit 1),
  '[{"days":7,"event_type":"CLICK_THROUGH"},{"days":1,"event_type":"VIEW_THROUGH"}]'::jsonb,
  'T-31: las ventanas de atribución quedan en orden canónico');
select is(
  (select count(*)::int from public.get_meta_daily_coverage(pg_temp.kid(31), 'adset', current_date - 2, current_date)
    where presence = 'sin_fila_reportada'), 2,
  'T-31: una entidad del catálogo sin fila es sin_fila_reportada en los otros dos días');
select is(pg_temp.state_of(format($$select * from public.get_meta_daily_coverage(%L, 'adset', current_date, current_date - 1)$$, pg_temp.kid(31))),
  '22023', 'T-31: un rango invertido da 22023');
select is(pg_temp.state_of(format($$select * from public.get_meta_daily_coverage(%L, 'adset', current_date - 28, current_date)$$, pg_temp.kid(31))),
  '22023', 'T-31: un rango mayor que el máximo público da 22023');
select is(pg_temp.state_of(format($$select * from public.get_meta_daily_coverage(%L, 'otro', current_date, current_date)$$, pg_temp.kid(31))),
  '22023', 'T-31: un nivel fuera del catálogo da 22023');
select pg_temp.logout();

-- Jerarquía y estructura: todo se rechaza con 22023 y sin dejar rastro.
select pg_temp.expire(311);
select pg_temp.start(31, 312, p_from => current_date, p_to => current_date);

create function pg_temp.payload_state(p_level text, p_payload jsonb) returns text language plpgsql
as $fn$
declare
  v_state text;
begin
  begin
    perform worker_api.publish_snapshot(pg_temp.uid(31), pg_temp.cid(31), pg_temp.kid(31), 0,
      pg_temp.rid(312), pg_temp.tok(312), pg_temp.sid(3120), p_level, clock_timestamp(), 1, 1, p_payload);
    raise exception 'sin_error' using errcode = 'PXOK0';
  exception when others then
    v_state := sqlstate;
  end;
  return nullif(v_state, 'PXOK0');
end;
$fn$;

select is(pg_temp.payload_state('account', '{"entities":[]}'), '22023', 'T-31: un payload sin days se rechaza');
select is(pg_temp.payload_state('account', '{"entities":[],"days":[],"extra":1}'), '22023', 'T-31: un payload con claves extra se rechaza');
select is(pg_temp.payload_state('campaign', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('campaign', '77', pg_temp.acct(31))), 'days', '[]'::jsonb)),
  '22023', 'T-31: una campaña sin su raíz en el payload se rechaza');
select is(pg_temp.payload_state('adset', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(31), null),
      pg_temp.ent('adset', '78', pg_temp.acct(31))), 'days', '[]'::jsonb)),
  '22023', 'T-31: un conjunto colgado de la cuenta se rechaza');
select is(pg_temp.payload_state('account', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(31), null),
      pg_temp.ent('account', pg_temp.acct(31), null)), 'days', '[]'::jsonb)),
  '22023', 'T-31: una entidad duplicada se rechaza');
select is(pg_temp.payload_state('account', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(31), null)),
    'days', jsonb_build_array(pg_temp.fila('account', '999', current_date)))),
  '22023', 'T-31: una fila de una entidad sin metadata se rechaza');
select is(pg_temp.payload_state('account', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(31), null)),
    'days', jsonb_build_array(pg_temp.fila('account', pg_temp.acct(31), current_date),
                              pg_temp.fila('account', pg_temp.acct(31), current_date)))),
  '22023', 'T-31: un día duplicado se rechaza');
select is(pg_temp.payload_state('account', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(31), null)),
    'days', jsonb_build_array(pg_temp.fila('account', pg_temp.acct(31), current_date - 5)))),
  '22023', 'T-31: una fecha fuera de la ventana se rechaza');
select is(pg_temp.payload_state('campaign', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(31), null),
      pg_temp.ent('campaign', '79', pg_temp.acct(31))),
    'days', jsonb_build_array(pg_temp.fila('account', pg_temp.acct(31), current_date)))),
  '22023', 'T-31: una fila de otro nivel se rechaza');
select is(pg_temp.payload_state('account', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(31), null, p_objective => 'OUTCOME_SALES')), 'days', '[]'::jsonb)),
  '22023', 'T-31: un objetivo fuera de campaña se rechaza');
select is(pg_temp.payload_state('account', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(31), null, repeat('n', 1025))), 'days', '[]'::jsonb)),
  '22023', 'T-31: un nombre de más de 1024 caracteres se rechaza');
select is(pg_temp.payload_state('account', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(31), null, p_attr =>
      '{"known":false,"report_time":"impression","unified":true,"settings":[{"adset_external_id":"1","windows":[]}]}'::jsonb)), 'days', '[]'::jsonb)),
  '22023', 'T-31: atribución desconocida con configuraciones inventadas se rechaza');
select is(pg_temp.payload_state('account', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(31), null, p_attr =>
      '{"known":true,"report_time":"conversion","unified":true,"settings":[{"adset_external_id":"1","windows":[{"event_type":"CLICK_THROUGH","days":7}]}]}'::jsonb)), 'days', '[]'::jsonb)),
  '22023', 'T-31: otro report_time se rechaza');
select is(pg_temp.payload_state('account', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(31), null, p_attr =>
      '{"known":true,"report_time":"impression","unified":true,"settings":[{"adset_external_id":"1","windows":[{"event_type":"CLICK_THROUGH","days":0}]}]}'::jsonb)), 'days', '[]'::jsonb)),
  '22023', 'T-31: una ventana de atribución no positiva se rechaza');
select is(pg_temp.payload_state('account', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(31), null, p_at => '2020-99-99T00:00:00.000Z')), 'days', '[]'::jsonb)),
  '22023', 'T-31: un instante de metadata inválido se rechaza');
select is(pg_temp.payload_state('account', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(31), null)),
    'days', jsonb_build_array(pg_temp.fila('account', pg_temp.acct(31), current_date) || '{"date":"2020-99-99"}'))),
  '22023', 'T-31: una fecha imposible se rechaza');

-- ---------------------------------------------------------------------------
-- T-36: la raíz se compara exacta con la conexión (C-01, C-11, C-20)
-- ---------------------------------------------------------------------------

select is(pg_temp.payload_state('account', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', 'act_9999999', null)), 'days', '[]'::jsonb)),
  '22023', 'T-36: una raíz distinta de la conexión se rechaza');
select is(pg_temp.payload_state('account', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', replace(pg_temp.acct(31), 'act_', ''), null)), 'days', '[]'::jsonb)),
  '22023', 'T-36: SQL no normaliza: una raíz sin prefijo se rechaza');
select is(pg_temp.payload_state('account', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', 'act_' || pg_temp.acct(31), null)), 'days', '[]'::jsonb)),
  '22023', 'T-36: un prefijo duplicado se rechaza');
select is(pg_temp.payload_state('account', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', ' ' || pg_temp.acct(31), null)), 'days', '[]'::jsonb)),
  '22023', 'T-36: una raíz con espacios se rechaza');
select is(pg_temp.payload_state('adset', jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(31), null),
      pg_temp.ent('campaign', '80', pg_temp.acct(31)),
      pg_temp.ent('adset', pg_temp.acct(31), '80')), 'days', '[]'::jsonb)),
  '22023', 'T-36: usar el ID de la cuenta como conjunto se rechaza');
select is((pg_temp.conn(31)).external_account_id, pg_temp.acct(31), 'T-36: la conexión no cambia');

-- El prefijo más 60 dígitos es válido, aunque no sea un ID numérico de 32 caracteres.
select pg_temp.new_company(36);
select worker_api.create_pending_connection(pg_temp.uid(36), pg_temp.cid(36), pg_temp.kid(36), 'negocio_sintetico', 'AAAA',
  'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica', '{ads_read}', null);
select worker_api.confirm_connection(pg_temp.uid(36), pg_temp.cid(36), pg_temp.kid(36), 'act_' || repeat('7', 60), 'USD', 'UTC', true);
select pg_temp.start(36, 361);
select is(pg_temp.state_of(format($$select pg_temp.pub(36, 361, 3610, 'account', %L::jsonb)$$, jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', 'act_' || repeat('7', 60), null)), 'days', '[]'::jsonb))),
  null, 'T-36: act_ con 60 dígitos se publica');

-- ---------------------------------------------------------------------------
-- T-37: instante de captura acotado por SQL (C-10, C-11)
-- ---------------------------------------------------------------------------

select pg_temp.active(37);
select pg_temp.start(37, 371);
create temp table started_37 as select started_at from public.meta_sync_runs where id = pg_temp.rid(371);

select is(pg_temp.state_of(format($$select pg_temp.pub(37, 371, 3710, 'account', '{"entities":[],"days":[]}', %L::timestamptz)$$,
  (select started_at - interval '1 second' from started_37))),
  '22023', 'T-37: publish rechaza una captura anterior al run');
select is(pg_temp.state_of(format($$select pg_temp.pub(37, 371, 3710, 'account', '{"entities":[],"days":[]}', %L::timestamptz)$$,
  clock_timestamp() + interval '1 hour')),
  '22023', 'T-37: publish rechaza una captura futura, sin excepción');
select is((select count(*)::int from public.meta_daily_coverage where connection_id = pg_temp.kid(37)), 0,
  'T-37: el rechazo no deja cobertura');
select is(pg_temp.state_of(format($$select pg_temp.fail(37, 371, 3710, 'account', %L::timestamptz)$$,
  (select started_at - interval '1 second' from started_37))),
  '22023', 'T-37: fail rechaza una captura anterior al run');

-- Captura igual a started_at: el límite inferior incluye el extremo (reloj local atrasado).
select is(pg_temp.state_of(format($$select pg_temp.pub(37, 371, 3711, 'account', '{"entities":[],"days":[]}', %L::timestamptz)$$,
  (select started_at from started_37))),
  null, 'T-37: fetched_at igual a started_at se acepta');

-- Reloj del servidor adelantado: fail registra la hora de la base y conserva el instante pedido.
create temp table future_37 as select clock_timestamp() + interval '1 hour' as ts;
select pg_temp.fail(37, 371, 3712, 'campaign', (select ts from future_37), p_stop => true);
select ok((select fetched_at < (select ts from future_37) and fetched_at >= (select started_at from started_37)
             from public.meta_insight_snapshots where id = pg_temp.sid(3712)),
  'T-37: fail guarda la hora de la base con un instante futuro');
select is((select request_payload->>'fetched_at' from public.meta_insight_snapshots where id = pg_temp.sid(3712)),
  to_char((select ts from future_37) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'T-37: request_payload conserva el instante original');
select is(pg_temp.state_of(format($$select pg_temp.fail(37, 371, 3712, 'campaign', %L::timestamptz, p_stop => true)$$,
  (select ts from future_37))),
  null, 'T-37: el reintento idéntico del fallo no falla ni reescribe');
select is((select count(*)::int from public.meta_insight_snapshots where sync_run_id = pg_temp.rid(371)), 2,
  'T-37: el reintento no duplica el snapshot');
select is((select count(*)::int from public.meta_daily_coverage where snapshot_id = pg_temp.sid(3712)), 0,
  'T-37: el fallo no publica cobertura');
select is(pg_temp.run_status(371), 'partial', 'T-37: con stop_remaining y un nivel completo, el run termina partial');

-- ---------------------------------------------------------------------------
-- T-38: clasificación del snapshot y del run (C-05, C-06, C-14)
-- ---------------------------------------------------------------------------

select pg_temp.active(38);
select pg_temp.start(38, 381);
-- Contadores, razones y detención incoherentes: 22023, sin efecto.
select is(pg_temp.state_of($$select pg_temp.fail(38, 381, 3810, 'account', p_pages => 1, p_validated => 2)$$), '22023',
  'T-38: validated_pages mayor que pages se rechaza');
select is(pg_temp.state_of($$select pg_temp.fail(38, 381, 3810, 'account', p_validated => -1)$$), '22023',
  'T-38: validated_pages negativo se rechaza');
select is(pg_temp.state_of($$select pg_temp.fail(38, 381, 3810, 'account', p_reason => 'complete')$$), '22023',
  'T-38: complete no es una razón de fallo');
select is(pg_temp.state_of($$select pg_temp.fail(38, 381, 3810, 'account', p_reason => 'page_limit', p_class => 'rate_limit')$$), '22023',
  'T-38: una razón local exige clase own_error');
select is(pg_temp.state_of($$select pg_temp.fail(38, 381, 3810, 'account', p_reason => 'duration_limit', p_stop => false)$$), '22023',
  'T-38: duration_limit exige detener');
select is(pg_temp.state_of($$select pg_temp.fail(38, 381, 3810, 'account', p_reason => 'meta_error', p_class => 'rate_limit', p_stop => false)$$), '22023',
  'T-38: rate_limit exige detener');
select is(pg_temp.state_of($$select pg_temp.fail(38, 381, 3810, 'account', p_reason => 'meta_error', p_class => 'authentication', p_stop => false)$$), '22023',
  'T-38: una clase de reautorización exige detener');
select is(pg_temp.state_of(format($$select pg_temp.fail(38, 381, 3810, 'account', p_payload => %L::jsonb, p_validated => 0)$$,
  jsonb_build_object('entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(38), null)), 'days', '[]'::jsonb))), '22023',
  'T-38: un payload con datos sin páginas válidas se rechaza');
select is(pg_temp.state_of(format($$select pg_temp.fail(38, 381, 3810, 'account', p_message => %L)$$, '')), '22023',
  'T-38: un mensaje vacío se rechaza');

-- Cero páginas válidas: failed. Metadata válida y después error: incomplete, aun sin métricas.
select pg_temp.fail(38, 381, 3811, 'account', p_pages => 1, p_validated => 0);
select results_eq(
  format($$select result, complete, pages, validated_pages, failure_reason, error_class
             from public.meta_insight_snapshots where id = %L$$, pg_temp.sid(3811)),
  $$values ('failed'::text, false, 1, 0, 'own_error'::text, 'own_error'::text)$$,
  'T-38: cero páginas válidas producen failed');
select pg_temp.fail(38, 381, 3812, 'campaign', p_payload => jsonb_build_object(
    'entities', jsonb_build_array(pg_temp.ent('account', pg_temp.acct(38), null)), 'days', '[]'::jsonb),
  p_pages => 2, p_validated => 1, p_reason => 'page_limit');
select results_eq(
  format($$select result, complete, validated_pages from public.meta_insight_snapshots where id = %L$$, pg_temp.sid(3812)),
  $$values ('incomplete'::text, false, 1)$$,
  'T-38: una página válida vacía seguida de error produce incomplete');
select is((pg_temp.summary(38))->'levels'->'campaign'->>'reason', 'page_limit', 'T-38: el resumen conserva la razón');
select is((pg_temp.summary(38))->>'status', 'running', 'T-38: sin detener, el run sigue running');
select is((pg_temp.conn(38)).last_error_class, 'own_error', 'T-38: fail registra la clase en la conexión');
select is((pg_temp.conn(38)).last_error_message, 'Fallo sintetico.', 'T-38: fail registra el mensaje fijo');
select is((pg_temp.conn(38)).status::text, 'active', 'T-38: fail no cambia el estado');

-- Éxito vacío: complete, con los días del rango cubiertos.
select pg_temp.pub(38, 381, 3813, 'adset', '{"entities":[],"days":[]}');
select results_eq(
  format($$select result, complete, validated_pages, pages, failure_reason from public.meta_insight_snapshots where id = %L$$, pg_temp.sid(3813)),
  $$values ('complete'::text, true, 1, 1, null::text)$$,
  'T-38: un éxito vacío es complete');
select is((select count(*)::int from public.meta_daily_coverage where snapshot_id = pg_temp.sid(3813)), 3,
  'T-38: el éxito vacío cubre todos los días del rango');
select is((select count(*)::int from public.meta_daily_coverage where snapshot_id = pg_temp.sid(3811)), 0,
  'T-38: el fallo no cubre días');

-- Detener: rate_limit marca not_attempted sin snapshot y el run queda partial.
select pg_temp.fail(38, 381, 3814, 'ad', p_reason => 'meta_error', p_class => 'rate_limit',
  p_message => 'Meta limitó las llamadas.', p_stop => true);
select is(pg_temp.run_status(381), 'partial', 'T-38: los cuatro resultados con uno completo dan partial');
select is((pg_temp.summary(38))->>'status', 'partial', 'T-38: el resumen queda partial');
select is((pg_temp.conn(38)).last_error_class, 'rate_limit', 'T-38: queda el último fallo confirmado');

-- Detener con niveles sin intentar, sin ninguno completo: failed.
select pg_temp.active(39);
select pg_temp.start(39, 391);
select pg_temp.fail(39, 391, 3910, 'account', p_reason => 'duration_limit', p_stop => true);
select is(pg_temp.run_status(391), 'failed', 'T-38: detener sin niveles completos da failed');
select is((pg_temp.summary(39))->'levels'->'ad'->>'status', 'not_attempted', 'T-38: los no intentados quedan not_attempted');
select is((pg_temp.summary(39))->'levels'->'ad'->>'fetched_at', null, 'T-38: un no intentado no tiene captura');
select is((select count(*)::int from public.meta_insight_snapshots where sync_run_id = pg_temp.rid(391)), 1,
  'T-38: un nivel no intentado no tiene snapshot');
select is(pg_temp.state_of($$select pg_temp.pub(39, 391, 3911, 'campaign', '{"entities":[],"days":[]}')$$),
  'PX010', 'T-38: un run terminado no publica más');

-- Reautorización dentro de fail: efecto atómico y reintento idéntico.
select pg_temp.active(40);
select pg_temp.start(40, 401);
create temp table at_40 as select clock_timestamp() as ts;
select pg_temp.fail(40, 401, 4010, 'account', (select ts from at_40), p_reason => 'meta_error', p_class => 'authentication',
  p_message => 'Graph 190: Meta rechazó la credencial.', p_stop => true);
select results_eq(
  format($$select status::text, last_error_class, credential_generation from public.integration_connections where id = %L$$, pg_temp.kid(40)),
  $$values ('needs_reauth'::text, 'authentication'::text, 0)$$,
  'T-38: una clase de reautorización marca needs_reauth con posesión');
select is(pg_temp.run_status(401), 'failed', 'T-38: la reautorización termina el run');
select is(pg_temp.state_of(format($$select pg_temp.fail(40, 401, 4010, 'account', %L::timestamptz, p_reason => 'meta_error', p_class => 'authentication',
  p_message => 'Graph 190: Meta rechazó la credencial.', p_stop => true)$$, (select ts from at_40))), null,
  'T-38: el reintento idéntico de la reautorización se reconoce');
select is(pg_temp.state_of($$select pg_temp.pub(40, 401, 4011, 'campaign', '{"entities":[],"days":[]}')$$),
  'PX004', 'T-38: después de reautorización no se publica');

-- Limpieza del error: solo un run completed lo pone en null; partial lo conserva.
select pg_temp.active(41);
select pg_temp.start(41, 411);
select pg_temp.fail(41, 411, 4110, 'account');
select pg_temp.pub(41, 411, 4111, 'campaign', '{"entities":[],"days":[]}');
select pg_temp.pub(41, 411, 4112, 'adset', '{"entities":[],"days":[]}');
select pg_temp.pub(41, 411, 4113, 'ad', '{"entities":[],"days":[]}');
select is(pg_temp.run_status(411), 'partial', 'T-38: tres completos y un fallo dan partial');
select is((pg_temp.conn(41)).last_error_class, 'own_error', 'T-38: un run partial conserva el último error');
select pg_temp.start(41, 412);
select pg_temp.pub(41, 412, 4120, 'account', '{"entities":[],"days":[]}');
select pg_temp.pub(41, 412, 4121, 'campaign', '{"entities":[],"days":[]}');
select pg_temp.pub(41, 412, 4122, 'adset', '{"entities":[],"days":[]}');
select pg_temp.pub(41, 412, 4123, 'ad', '{"entities":[],"days":[]}');
select is(pg_temp.run_status(412), 'completed', 'T-38: cuatro completos dan completed');
select is((pg_temp.conn(41)).last_error_class, null, 'T-38: un run completed limpia la clase');
select is((pg_temp.conn(41)).last_error_message, null, 'T-38: un run completed limpia el mensaje');
select is((pg_temp.summary(41))->>'status', 'completed', 'T-38: el resumen queda completed');
select is((select count(*)::int from public.meta_insight_snapshots where sync_run_id = pg_temp.rid(412)), 4,
  'T-38: un run tiene como máximo cuatro snapshots');

-- ---------------------------------------------------------------------------
-- record_connection_error (C-14, T-21 en SQL)
-- ---------------------------------------------------------------------------

select pg_temp.active(42);
select results_eq(
  format($$select connection_id, status, credential_generation from worker_api.record_connection_error(%L, %L, %L, 0, 'unknown', 'Fallo sintetico.')$$,
    pg_temp.uid(42), pg_temp.cid(42), pg_temp.kid(42)),
  format($$values (%L::uuid, 'active'::text, 0)$$, pg_temp.kid(42)),
  'C-14: record_connection_error escribe y devuelve estado y generación');
select results_eq(
  format($$select status::text, last_error_class, last_error_message, credential_generation from public.integration_connections where id = %L$$, pg_temp.kid(42)),
  $$values ('active'::text, 'unknown'::text, 'Fallo sintetico.'::text, 0)$$,
  'C-14: persiste la clase y el mensaje sin cambiar estado ni generación');
select is(pg_temp.state_of(format($$select * from worker_api.record_connection_error(%L, %L, %L, 7, 'unknown', 'x')$$,
  pg_temp.uid(42), pg_temp.cid(42), pg_temp.kid(42))), 'PX006', 'C-14: una generación distinta da PX006');
select is(pg_temp.state_of(format($$select * from worker_api.record_connection_error(%L, %L, %L, 0, 'authentication', 'x')$$,
  pg_temp.uid(42), pg_temp.cid(42), pg_temp.kid(42))), '22023', 'C-14: una clase de reautorización no entra por acá');
select is(pg_temp.state_of(format($$select * from worker_api.record_connection_error(%L, %L, %L, 0, 'unknown', 'x')$$,
  pg_temp.uid(40), pg_temp.cid(40), pg_temp.kid(40))), 'PX004', 'C-14: sobre needs_reauth da PX004');
select is((pg_temp.conn(40)).last_error_class, 'authentication', 'C-14: needs_reauth conserva su error de autorización');

-- ---------------------------------------------------------------------------
-- T-35 en SQL: get_meta_sync_status (C-01, C-02, C-06)
-- ---------------------------------------------------------------------------

select pg_temp.active(43);
select pg_temp.login(43);
select results_eq(format($$select has_attempt, summary, effective_status, connection_changed from public.get_meta_sync_status(%L)$$, pg_temp.kid(43)),
  $$values (false, null::jsonb, 'never'::text, false)$$, 'T-35: sin intento devuelve never');
select pg_temp.logout();
select pg_temp.start(43, 431);
select pg_temp.login(43);
select results_eq(format($$select has_attempt, effective_status, connection_changed from public.get_meta_sync_status(%L)$$, pg_temp.kid(43)),
  $$values (true, 'running'::text, false)$$, 'T-35: un run vigente se lee running');
select pg_temp.logout();
select pg_temp.expire(431);
update public.integration_connections
   set meta_sync_summary = jsonb_set(meta_sync_summary, '{lease_expires_at}', to_jsonb(pg_temp.iso(clock_timestamp() - interval '1 hour')))
 where id = pg_temp.kid(43);
create temp table status_43 as select status from public.meta_sync_runs where id = pg_temp.rid(431);
select pg_temp.login(43);
select results_eq(format($$select effective_status from public.get_meta_sync_status(%L)$$, pg_temp.kid(43)),
  $$values ('expired'::text)$$, 'T-35: un lease vencido se deriva como expired');
select pg_temp.logout();
select is(pg_temp.run_status(431), (select status from status_43), 'T-35: la derivación no escribe');
update public.integration_connections set credential_generation = credential_generation + 1 where id = pg_temp.kid(43);
select pg_temp.login(43);
select results_eq(format($$select effective_status, connection_changed from public.get_meta_sync_status(%L)$$, pg_temp.kid(43)),
  $$values ('connection_changed'::text, true)$$, 'T-35: el cambio de conexión tiene prioridad sobre el vencimiento');
select pg_temp.logout();

-- Un primer fallo se lee sin cobertura previa.
select pg_temp.active(44);
select pg_temp.start(44, 441);
select pg_temp.fail(44, 441, 4410, 'account', p_stop => true);
select pg_temp.login(44);
select results_eq(format($$select effective_status, summary->'levels'->'account'->>'status', summary->'levels'->'campaign'->>'status' from public.get_meta_sync_status(%L)$$, pg_temp.kid(44)),
  $$values ('failed'::text, 'failed'::text, 'not_attempted'::text)$$, 'T-35: el primer fallo se lee en el resumen');
select is_empty(format($$select 1 from public.meta_daily_coverage where connection_id = %L$$, pg_temp.kid(44)),
  'T-35: el primer fallo no tiene cobertura');
select results_eq(format($$select presence from public.get_meta_daily_coverage(%L, 'account', current_date, current_date)$$, pg_temp.kid(44)),
  $$values ('no_observado'::text)$$, 'T-35: sin cobertura el día es no_observado');
select pg_temp.logout();

-- Needs_reauth lee; pending_selection y disconnected no.
select pg_temp.login(40);
select is((select count(*)::int from public.get_meta_sync_status(pg_temp.kid(40))), 1, 'T-35: needs_reauth lee su estado');
select pg_temp.logout();
select worker_api.begin_disconnect(pg_temp.uid(40), pg_temp.cid(40), pg_temp.kid(40));
select pg_temp.login(40);
select is_empty(format($$select 1 from public.get_meta_sync_status(%L)$$, pg_temp.kid(40)), 'T-35: disconnected no devuelve estado');
select is_empty(format($$select 1 from public.get_meta_daily_coverage(%L, 'account', current_date, current_date)$$, pg_temp.kid(40)),
  'T-35: disconnected no devuelve cobertura');
select pg_temp.logout();

select pg_temp.new_company(45);
select worker_api.create_pending_connection(pg_temp.uid(45), pg_temp.cid(45), pg_temp.kid(45), 'negocio_sintetico', 'AAAA',
  'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica', '{ads_read}', null);
select pg_temp.login(45);
select is_empty(format($$select 1 from public.get_meta_sync_status(%L)$$, pg_temp.kid(45)), 'T-35: pending_selection no devuelve estado');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- T-24: purga repetible con todas las tablas (C-16)
-- ---------------------------------------------------------------------------

select worker_api.begin_disconnect(pg_temp.uid(8), pg_temp.cid(8), pg_temp.kid(8));
select is(pg_temp.state_of($$select pg_temp.pub(8, 81, 899, 'campaign', '{"entities":[],"days":[]}')$$), 'PX004',
  'C-15: una desconexión impide publicar');
select is(worker_api.purge_connection(pg_temp.uid(8), pg_temp.cid(8), pg_temp.kid(8)), true, 'T-24: la purga borra');
select is(worker_api.purge_connection(pg_temp.uid(8), pg_temp.cid(8), pg_temp.kid(8)), false, 'T-24: repetir la purga devuelve false');
select is(
  (select count(*)::int from public.meta_sync_runs where connection_id = pg_temp.kid(8))
  + (select count(*)::int from public.meta_entities where connection_id = pg_temp.kid(8))
  + (select count(*)::int from public.meta_insight_snapshots where connection_id = pg_temp.kid(8))
  + (select count(*)::int from public.meta_snapshot_entities where connection_id = pg_temp.kid(8))
  + (select count(*)::int from public.meta_snapshot_days where connection_id = pg_temp.kid(8))
  + (select count(*)::int from public.meta_snapshot_actions where connection_id = pg_temp.kid(8))
  + (select count(*)::int from public.meta_daily_coverage where connection_id = pg_temp.kid(8)),
  0, 'T-24: la purga deja cero filas en las siete tablas');
select is((select count(*)::int from public.integration_connections where id = pg_temp.kid(8)), 0,
  'T-24: la purga borra la conexión');
select is(pg_temp.state_of(format($$select worker_api.purge_connection(%L, %L, %L)$$, pg_temp.uid(31), pg_temp.cid(31), pg_temp.kid(31))), 'PX004',
  'T-24: una conexión viva no se purga');

-- El borrado directo de un run apuntado sigue protegido por la FK.
select is(pg_temp.state_of(format($$delete from public.meta_sync_runs where id = %L$$, pg_temp.rid(412))), '23503',
  'T-24: un run apuntado no se borra sin anular antes el puntero');

select * from finish();
rollback;
