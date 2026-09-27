-- PRAXA — Estructura y matriz de privilegios del conector (0012).
--
-- CA-14 a CA-17 y CA-20 a CA-22: qué existe, quién puede tocar qué y qué ejecuta cada
-- rol. Las aserciones corren como `postgres`: las funciones de pgTAP viven en
-- `extensions`, y `praxa_integrations` no tiene USAGE sobre ese esquema. El rol de C se
-- asume solo dentro de `pg_temp.sqlstate_as`, y la membresía que eso exige se concede
-- dentro de esta transacción y se revierte con el `rollback` final (H-S-02).
--
-- Las columnas de tipo `name` (colación "C") se convierten a `text` antes de compararlas
-- con literales, y se les fija `collate "default"`: si no, results_eq no puede elegir
-- colación (ver 03_privileges).

begin;

create extension if not exists pgtap with schema extensions;
select plan(49);

-- Ejecuta una sentencia con el rol pedido y devuelve el SQLSTATE del error, o null si no
-- hubo error. El bloque `exception` revierte la subtransacción, incluido el cambio de
-- rol; en el camino sin error, el rol se restablece a mano.
create function pg_temp.sqlstate_as(p_role text, p_sql text)
returns text
language plpgsql
as $fn$
begin
  execute format('set local role %I', p_role);
  execute p_sql;
  execute 'reset role';
  return null;
exception when others then
  return sqlstate;
end;
$fn$;

-- Llamada con argumentos nulos a cada función de worker_api, con su firma completa.
create function pg_temp.worker_api_calls()
returns table (name text, call text)
language sql
as $fn$
  select p.proname::text,
         format('select worker_api.%I(%s)', p.proname,
                coalesce((select string_agg(format('null::%s', t::regtype), ', ' order by ord)
                            from unnest(p.proargtypes::oid[]) with ordinality as u(t, ord)), ''))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'worker_api'
$fn$;

-- ---------------------------------------------------------------------------
-- Semilla (como postgres)
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('aaaaaaaa-0000-4000-8000-000000000301', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'privilegios.uno@praxa.test', 'x', now(), now(), now());

insert into public.companies (id, name, owner_id)
values ('c0a00000-0000-4000-8000-000000000301', 'Empresa de privilegios',
        'aaaaaaaa-0000-4000-8000-000000000301');

-- ---------------------------------------------------------------------------
-- T-04: esquema worker_api (C-04)
-- ---------------------------------------------------------------------------

select has_schema('worker_api', 'T-04: el esquema worker_api existe');

select ok(not has_schema_privilege('anon', 'worker_api', 'USAGE'),
  'T-04: anon no tiene USAGE sobre worker_api');
select ok(not has_schema_privilege('authenticated', 'worker_api', 'USAGE'),
  'T-04: authenticated no tiene USAGE sobre worker_api');
select ok(has_schema_privilege('praxa_integrations', 'worker_api', 'USAGE'),
  'T-04: praxa_integrations tiene USAGE sobre worker_api');

select is_empty(
  $$select 1 from pg_namespace n, aclexplode(n.nspacl) a
     where n.nspname = 'worker_api' and a.grantee = 0$$,
  'T-04: PUBLIC no figura en la ACL de worker_api');

-- ---------------------------------------------------------------------------
-- T-05: atributos del rol de C (C-05)
-- ---------------------------------------------------------------------------

select has_role('praxa_integrations', 'T-05: el rol praxa_integrations existe');

select results_eq(
  $$select r.rolcanlogin, r.rolbypassrls, r.rolinherit, r.rolsuper,
           r.rolcreaterole, r.rolcreatedb
      from pg_roles r where r.rolname = 'praxa_integrations'$$,
  $$values (true, false, false, false, false, false)$$,
  'T-05: LOGIN, NOBYPASSRLS, NOINHERIT, sin SUPERUSER, CREATEROLE ni CREATEDB');

-- ---------------------------------------------------------------------------
-- T-06: enums (C-06)
-- ---------------------------------------------------------------------------

select enum_has_labels('public', 'integration_provider', array['meta'],
  'T-06: integration_provider tiene exactamente meta');
select enum_has_labels('public', 'connection_status',
  array['pending_selection', 'active', 'needs_reauth', 'disconnected'],
  'T-06: connection_status tiene exactamente los cuatro estados');

-- ---------------------------------------------------------------------------
-- T-07: columnas, tipos y nulabilidad (C-07)
-- ---------------------------------------------------------------------------

select columns_are('public', 'oauth_attempts', array[
  'id', 'provider', 'company_id', 'actor_user_id', 'purpose', 'expected_connection_id',
  'expected_generation', 'state_hash', 'browser_binding_hash', 'return_path',
  'created_at', 'expires_at', 'consumed_at'],
  'T-07: columnas de oauth_attempts (K02)');

select results_eq(
  $$select a.attname::text collate "default", t.typname::text collate "default", a.attnotnull
      from pg_attribute a join pg_type t on t.oid = a.atttypid
     where a.attrelid = 'public.oauth_attempts'::regclass
       and a.attnum > 0 and not a.attisdropped
     order by a.attname$$,
  $$values ('actor_user_id', 'uuid', true),
           ('browser_binding_hash', 'text', true),
           ('company_id', 'uuid', true),
           ('consumed_at', 'timestamptz', false),
           ('created_at', 'timestamptz', true),
           ('expected_connection_id', 'uuid', false),
           ('expected_generation', 'int4', false),
           ('expires_at', 'timestamptz', true),
           ('id', 'uuid', true),
           ('provider', 'integration_provider', true),
           ('purpose', 'text', true),
           ('return_path', 'text', true),
           ('state_hash', 'text', true)$$,
  'T-07: tipos y nulabilidad de oauth_attempts');

select columns_are('public', 'integration_connections', array[
  'id', 'company_id', 'provider', 'status', 'external_account_id', 'client_business_id',
  'currency', 'timezone', 'credential_generation', 'pending_expires_at',
  'purge_requested_at', 'current_sync_run_id', 'last_error_class', 'last_error_message',
  'created_at', 'updated_at'],
  'T-07: columnas de integration_connections (K03)');

select results_eq(
  $$select a.attname::text collate "default", t.typname::text collate "default", a.attnotnull
      from pg_attribute a join pg_type t on t.oid = a.atttypid
     where a.attrelid = 'public.integration_connections'::regclass
       and a.attnum > 0 and not a.attisdropped
     order by a.attname$$,
  $$values ('client_business_id', 'text', false),
           ('company_id', 'uuid', true),
           ('created_at', 'timestamptz', true),
           ('credential_generation', 'int4', true),
           ('currency', 'text', false),
           ('current_sync_run_id', 'uuid', false),
           ('external_account_id', 'text', false),
           ('id', 'uuid', true),
           ('last_error_class', 'text', false),
           ('last_error_message', 'text', false),
           ('pending_expires_at', 'timestamptz', false),
           ('provider', 'integration_provider', true),
           ('purge_requested_at', 'timestamptz', false),
           ('status', 'connection_status', true),
           ('timezone', 'text', false),
           ('updated_at', 'timestamptz', true)$$,
  'T-07: tipos y nulabilidad de integration_connections');

select columns_are('private', 'integration_credentials', array[
  'connection_id', 'company_id', 'ciphertext', 'iv', 'auth_tag', 'key_version',
  'token_type', 'issued_for_app_id', 'granted_scopes', 'expires_at'],
  'T-07: columnas de integration_credentials (K04), sin texto plano');

select results_eq(
  $$select a.attname::text collate "default", t.typname::text collate "default", a.attnotnull
      from pg_attribute a join pg_type t on t.oid = a.atttypid
     where a.attrelid = 'private.integration_credentials'::regclass
       and a.attnum > 0 and not a.attisdropped
     order by a.attname$$,
  $$values ('auth_tag', 'text', true),
           ('ciphertext', 'text', true),
           ('company_id', 'uuid', true),
           ('connection_id', 'uuid', true),
           ('expires_at', 'timestamptz', false),
           ('granted_scopes', '_text', true),
           ('issued_for_app_id', 'text', true),
           ('iv', 'text', true),
           ('key_version', 'int4', true),
           ('token_type', 'text', true)$$,
  'T-07: tipos y nulabilidad de integration_credentials');

-- ---------------------------------------------------------------------------
-- T-08: RLS habilitada y forzada (C-08)
-- ---------------------------------------------------------------------------

select results_eq(
  $$select c.relname::text collate "default", c.relrowsecurity, c.relforcerowsecurity
      from pg_class c
     where c.oid in ('public.oauth_attempts'::regclass,
                     'public.integration_connections'::regclass,
                     'private.integration_credentials'::regclass)
     order by c.relname$$,
  $$values ('integration_connections', true, true),
           ('integration_credentials', true, true),
           ('oauth_attempts', true, true)$$,
  'T-08: las tres tablas con RLS habilitada y forzada');

-- ---------------------------------------------------------------------------
-- T-09: privilegios de tablas (C-09)
-- ---------------------------------------------------------------------------

-- Las tablas se reciben por parámetro: si el cuerpo nombrara la tabla de credenciales,
-- T-14 contaría este helper como una función que la menciona.
create temp table new_tables as
select unnest(array['public.oauth_attempts', 'public.integration_connections',
                    'private.integration_credentials']) as name;

create function pg_temp.table_privileges(p_role text, p_tables text[])
returns table (table_name text, privilege text)
language sql
as $fn$
  select t.name, p.name
    from unnest(p_tables) as t(name)
   cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE',
                           'REFERENCES', 'TRIGGER']) as p(name)
   where has_table_privilege(p_role, t.name, p.name)
   order by 1, 2
$fn$;

select is_empty($$select * from pg_temp.table_privileges('anon', (select array_agg(name) from new_tables))$$,
  'T-09: anon no tiene ningún privilegio sobre las tres tablas');

select results_eq($$select * from pg_temp.table_privileges('authenticated', (select array_agg(name) from new_tables))$$,
  $$values ('public.integration_connections', 'SELECT')$$,
  'T-09: authenticated solo tiene SELECT sobre integration_connections');

select is_empty($$select * from pg_temp.table_privileges('praxa_integrations', (select array_agg(name) from new_tables))$$,
  'T-09: praxa_integrations no tiene ningún privilegio sobre las tres tablas');

select is_empty($$select * from pg_temp.table_privileges('service_role', (select array_agg(name) from new_tables))$$,
  'T-09: service_role no tiene ningún privilegio sobre las tres tablas (D-01)');

select ok(
  (select c.relacl is not null from pg_class c
    where c.oid = 'private.integration_credentials'::regclass),
  'T-09: la ACL de integration_credentials es explícita');

select is_empty(
  $$select a.grantee from pg_class c, aclexplode(c.relacl) a
     where c.oid = 'private.integration_credentials'::regclass
       and a.grantee <> c.relowner$$,
  'T-09: la ACL de integration_credentials no tiene más titular que el dueño');

-- ---------------------------------------------------------------------------
-- T-10: políticas (C-10)
-- ---------------------------------------------------------------------------

select results_eq(
  $$select p.cmd::text, p.roles::text[] collate "default"
      from pg_policies p
     where p.schemaname = 'public' and p.tablename = 'integration_connections'$$,
  $$values ('SELECT', array['authenticated'])$$,
  'T-10: integration_connections tiene una sola política, SELECT para authenticated');

select ok(
  (select p.qual like '%private.is_company_member(company_id)%'
     from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'integration_connections'),
  'T-10: la política usa private.is_company_member(company_id)');

select is_empty(
  $$select 1 from pg_policies p
     where p.schemaname = 'public' and p.tablename = 'oauth_attempts'$$,
  'T-10: oauth_attempts no tiene políticas');

select is_empty(
  $$select 1 from pg_policies p
     where p.schemaname = 'private' and p.tablename = 'integration_credentials'$$,
  'T-10: integration_credentials no tiene políticas');

-- ---------------------------------------------------------------------------
-- T-11: cascadas (C-13)
-- ---------------------------------------------------------------------------

select results_eq(
  $$select src.relname::text collate "default",
           (dst_ns.nspname::text || '.' || dst.relname::text) collate "default",
           c.confdeltype::text
      from pg_constraint c
      join pg_class src on src.oid = c.conrelid
      join pg_class dst on dst.oid = c.confrelid
      join pg_namespace dst_ns on dst_ns.oid = dst.relnamespace
     where c.contype = 'f'
       and c.conrelid in ('public.oauth_attempts'::regclass,
                          'public.integration_connections'::regclass,
                          'private.integration_credentials'::regclass)
     order by 1, 2$$,
  $$values ('integration_connections', 'public.companies', 'c'),
           ('integration_credentials', 'public.integration_connections', 'c'),
           ('oauth_attempts', 'auth.users', 'c'),
           ('oauth_attempts', 'public.companies', 'c'),
           ('oauth_attempts', 'public.integration_connections', 'c')$$,
  'T-11: todas las FK de las tres tablas son on delete cascade');

-- ---------------------------------------------------------------------------
-- T-12: las doce funciones de worker_api (C-15)
-- ---------------------------------------------------------------------------

select functions_are('worker_api', array[
  'create_oauth_attempt', 'consume_oauth_attempt', 'create_pending_connection',
  'get_credential', 'confirm_connection', 'replace_credential', 'mark_needs_reauth',
  'begin_disconnect', 'purge_connection', 'list_pending_purges',
  'count_credentials_by_key_version', 'rewrap_credential'],
  'T-12: worker_api tiene exactamente las doce funciones de II.4');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'worker_api'),
  12, 'T-12: doce funciones, sin sobrecargas');

select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'worker_api' and not p.prosecdef$$,
  'T-12: todas son SECURITY DEFINER');

select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'worker_api'
       and (p.proconfig is null or not ('search_path=""' = any (p.proconfig)))$$,
  'T-12: todas fijan search_path vacío');

-- Trampa 9: una ACL nula significa EXECUTE para PUBLIC.
select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'worker_api' and p.proacl is null$$,
  'T-12: ninguna tiene la ACL nula');

select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
           aclexplode(p.proacl) a
     where n.nspname = 'worker_api' and a.grantee = 0$$,
  'T-12: PUBLIC no tiene EXECUTE sobre ninguna');

select is_empty(
  $$select p.proname, r.name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     cross join unnest(array['anon', 'authenticated', 'service_role']) as r(name)
     where n.nspname = 'worker_api' and has_function_privilege(r.name, p.oid, 'EXECUTE')$$,
  'T-12: anon, authenticated y service_role no tienen EXECUTE sobre ninguna');

select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'worker_api'
       and not has_function_privilege('praxa_integrations', p.oid, 'EXECUTE')$$,
  'T-12: praxa_integrations tiene EXECUTE sobre las doce');

select is(
  (select p.pronargs::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'worker_api' and p.proname = 'count_credentials_by_key_version'),
  0, 'T-12: count_credentials_by_key_version no recibe parámetros');

select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'worker_api'
       and p.proname <> 'count_credentials_by_key_version'
       and (p.pronargs < 2
            or p.proargnames[1] is distinct from 'p_actor_user_id'
            or p.proargnames[2] is distinct from 'p_company_id'
            or p.proargtypes[0] <> 'uuid'::regtype
            or p.proargtypes[1] <> 'uuid'::regtype)$$,
  'T-12: las otras once reciben p_actor_user_id y p_company_id primero');

-- Los helpers privados tampoco tienen EXECUTE para nadie más que su dueño (C-03).
select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
           aclexplode(p.proacl) a
     where n.nspname = 'private'
       and p.proname in ('assert_worker_actor', 'valid_granted_scopes')
       and a.grantee <> p.proowner$$,
  'T-12: assert_worker_actor y valid_granted_scopes sin EXECUTE para otros roles');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('assert_worker_actor', 'valid_granted_scopes')
      and p.proacl is not null and not p.prosecdef),
  2, 'T-12: los helpers privados son SECURITY INVOKER y tienen ACL explícita');

-- ---------------------------------------------------------------------------
-- T-13: ejecución efectiva por rol (C-30)
-- ---------------------------------------------------------------------------

grant praxa_integrations to current_user;

select is(
  pg_temp.sqlstate_as('praxa_integrations',
    $$select * from worker_api.list_pending_purges(
        'aaaaaaaa-0000-4000-8000-000000000301', 'c0a00000-0000-4000-8000-000000000301')$$),
  null, 'T-13: praxa_integrations ejecuta list_pending_purges');

select is(
  pg_temp.sqlstate_as('praxa_integrations',
    $$select * from worker_api.create_oauth_attempt(
        'aaaaaaaa-0000-4000-8000-000000000301', 'c0a00000-0000-4000-8000-000000000301',
        'initial', repeat('3', 64), repeat('4', 64), '/app/integraciones',
        now() + interval '5 minutes')$$),
  null, 'T-13: praxa_integrations ejecuta create_oauth_attempt');

select is(
  pg_temp.sqlstate_as('praxa_integrations',
    $$select * from worker_api.count_credentials_by_key_version()$$),
  null, 'T-13: praxa_integrations ejecuta count_credentials_by_key_version');

select is(
  pg_temp.sqlstate_as('praxa_integrations', $$select 1 from public.oauth_attempts$$),
  '42501', 'T-13: praxa_integrations no lee oauth_attempts');

select is(
  pg_temp.sqlstate_as('praxa_integrations', $$select 1 from public.integration_connections$$),
  '42501', 'T-13: praxa_integrations no lee integration_connections');

select is(
  pg_temp.sqlstate_as('praxa_integrations', $$select 1 from private.integration_credentials$$),
  '42501', 'T-13: praxa_integrations no lee integration_credentials');

select is(
  (select count(*)::int from pg_temp.worker_api_calls() c
    where pg_temp.sqlstate_as('authenticated', c.call) = '42501'),
  12, 'T-13: authenticated no ejecuta ninguna de las doce funciones (42501)');

select is(
  (select count(*)::int from pg_temp.worker_api_calls() c
    where pg_temp.sqlstate_as('anon', c.call) = '42501'),
  12, 'T-13: anon no ejecuta ninguna de las doce funciones (42501)');

-- ---------------------------------------------------------------------------
-- T-14: ninguna función fuera de worker_api toca credenciales (C-31)
-- ---------------------------------------------------------------------------

select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname <> 'worker_api' and p.prosrc like '%integration_credentials%'$$,
  'T-14: ninguna función fuera de worker_api menciona integration_credentials');

-- ---------------------------------------------------------------------------
-- T-15: el dueño de las funciones omite RLS (C-32)
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     join pg_roles r on r.oid = p.proowner
    where n.nspname = 'worker_api' and r.rolbypassrls),
  12, 'T-15: el dueño de las doce funciones tiene rolbypassrls');

select * from finish();
rollback;
