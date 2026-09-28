-- PRAXA — Aislamiento del conector entre empresas (CA-19, CA-21; C-16, C-24, C-29).
--
-- Dos capas, probadas por separado:
--
--   1. Como `authenticated` de A: la política deja ver solo la conexión de A, y la falta
--      de privilegios hace fallar con 42501 (no en silencio) toda escritura y toda lectura
--      de intentos y credenciales.
--   2. Por `worker_api`, con el actor de A: cualquier referencia a una conexión o a una
--      empresa de B da PX001, salvo `purge_connection`, que devuelve `false` igual que con
--      un id inexistente (T-42). Las funciones se llaman como `postgres`, su dueño: el
--      privilegio del rol de C se prueba en 09.
--
-- A y B tienen conexión activa, credencial e intento. B tiene además una conexión
-- desconectada con credencial e intento `reauth`. C no tiene conexión viva (T-48: así el
-- choque de id no queda tapado por PX003).

begin;

create extension if not exists pgtap with schema extensions;
select plan(26);

-- Ejecuta una sentencia y devuelve lo que informa el error, o una fila de nulos.
create function pg_temp.error_of(p_sql text)
returns table (sqlstate text, message text, detail text, hint text)
language plpgsql
as $fn$
declare
  v_state   text;
  v_message text;
  v_detail  text;
  v_hint    text;
begin
  execute p_sql;
  return query select null::text, null::text, null::text, null::text;
exception when others then
  get stacked diagnostics v_state = returned_sqlstate, v_message = message_text,
                          v_detail = pg_exception_detail, v_hint = pg_exception_hint;
  return query select v_state, v_message, nullif(v_detail, ''), nullif(v_hint, '');
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Semilla (como postgres)
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('aaaaaaaa-0000-4000-8000-000000000081', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'aislamiento.a@praxa.test', 'x', now(), now(), now()),
  ('aaaaaaaa-0000-4000-8000-000000000082', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'aislamiento.b@praxa.test', 'x', now(), now(), now()),
  ('aaaaaaaa-0000-4000-8000-000000000083', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'aislamiento.c@praxa.test', 'x', now(), now(), now());

insert into public.companies (id, name, owner_id)
values
  ('c0a00000-0000-4000-8000-000000000081', 'Empresa A', 'aaaaaaaa-0000-4000-8000-000000000081'),
  ('c0a00000-0000-4000-8000-000000000082', 'Empresa B', 'aaaaaaaa-0000-4000-8000-000000000082'),
  ('c0a00000-0000-4000-8000-000000000083', 'Empresa C', 'aaaaaaaa-0000-4000-8000-000000000083');

insert into public.integration_connections
  (id, company_id, status, external_account_id, client_business_id, currency, timezone)
values
  ('cc000000-0000-4000-8000-000000000081', 'c0a00000-0000-4000-8000-000000000081',
   'active', 'cuenta_sintetica_0081', 'negocio_sintetico', 'USD', 'UTC'),
  ('cc000000-0000-4000-8000-000000000082', 'c0a00000-0000-4000-8000-000000000082',
   'active', 'cuenta_sintetica_0082', 'negocio_sintetico', 'USD', 'UTC');

insert into public.integration_connections
  (id, company_id, status, credential_generation, purge_requested_at)
values
  ('cc000000-0000-4000-8000-000000000182', 'c0a00000-0000-4000-8000-000000000082',
   'disconnected', 1, now());

insert into private.integration_credentials
  (connection_id, company_id, ciphertext, iv, auth_tag, key_version, token_type,
   issued_for_app_id, granted_scopes)
values
  ('cc000000-0000-4000-8000-000000000081', 'c0a00000-0000-4000-8000-000000000081',
   'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user',
   'app_sintetica', '{ads_read}'),
  ('cc000000-0000-4000-8000-000000000082', 'c0a00000-0000-4000-8000-000000000082',
   'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user',
   'app_sintetica', '{ads_read}'),
  ('cc000000-0000-4000-8000-000000000182', 'c0a00000-0000-4000-8000-000000000082',
   'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user',
   'app_sintetica', '{ads_read}');

insert into public.oauth_attempts
  (id, company_id, actor_user_id, purpose, expected_connection_id, expected_generation,
   state_hash, browser_binding_hash, return_path, expires_at)
values
  ('a7000000-0000-4000-8000-000000000081', 'c0a00000-0000-4000-8000-000000000081',
   'aaaaaaaa-0000-4000-8000-000000000081', 'reauth', 'cc000000-0000-4000-8000-000000000081', 0,
   repeat('8', 63) || '1', repeat('9', 63) || '1', '/app/integraciones',
   now() + interval '5 minutes'),
  ('a7000000-0000-4000-8000-000000000082', 'c0a00000-0000-4000-8000-000000000082',
   'aaaaaaaa-0000-4000-8000-000000000082', 'reauth', 'cc000000-0000-4000-8000-000000000082', 0,
   repeat('8', 63) || '2', repeat('9', 63) || '2', '/app/integraciones',
   now() + interval '5 minutes'),
  ('a7000000-0000-4000-8000-000000000182', 'c0a00000-0000-4000-8000-000000000082',
   'aaaaaaaa-0000-4000-8000-000000000082', 'reauth', 'cc000000-0000-4000-8000-000000000182', 0,
   repeat('8', 63) || '3', repeat('9', 63) || '3', '/app/integraciones',
   now() + interval '5 minutes');

-- ---------------------------------------------------------------------------
-- Capa 1: authenticated de A (C-29)
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000081","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$select id from public.integration_connections$$,
  $$values ('cc000000-0000-4000-8000-000000000081'::uuid)$$,
  'T-16: A ve solo su conexión');

select is_empty(
  $$select id from public.integration_connections
     where id in ('cc000000-0000-4000-8000-000000000082',
                  'cc000000-0000-4000-8000-000000000182')$$,
  'T-16: A filtrando por las conexiones de B obtiene cero filas');

select throws_ok(
  $$insert into public.integration_connections (company_id, status, pending_expires_at)
    values ('c0a00000-0000-4000-8000-000000000081', 'pending_selection', now() + interval '1 hour')$$,
  '42501', null, 'T-16: A no inserta conexiones (42501, no en silencio)');

select throws_ok(
  $$update public.integration_connections set credential_generation = 9
     where id = 'cc000000-0000-4000-8000-000000000082'$$,
  '42501', null, 'T-16: A no actualiza conexiones (42501)');

select throws_ok(
  $$delete from public.integration_connections
     where id = 'cc000000-0000-4000-8000-000000000082'$$,
  '42501', null, 'T-16: A no borra conexiones (42501)');

select throws_ok(
  $$select id from public.oauth_attempts$$,
  '42501', null, 'T-16: A no lee oauth_attempts (42501)');

select throws_ok(
  $$select connection_id from private.integration_credentials$$,
  '42501', null, 'T-16: A no lee integration_credentials (42501)');

reset role;
select set_config('request.jwt.claims', null, true);

-- ---------------------------------------------------------------------------
-- Capa 2: worker_api con el actor de A y una conexión de B (C-16)
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select * from worker_api.get_credential('aaaaaaaa-0000-4000-8000-000000000081',
      'c0a00000-0000-4000-8000-000000000081', 'cc000000-0000-4000-8000-000000000082')$$,
  'PX001', 'praxa: operación no autorizada', 'T-16: get_credential con conexión de B → PX001');

select throws_ok(
  $$select * from worker_api.confirm_connection('aaaaaaaa-0000-4000-8000-000000000081',
      'c0a00000-0000-4000-8000-000000000081', 'cc000000-0000-4000-8000-000000000082',
      'cuenta_sintetica_0099', 'USD', 'UTC', true)$$,
  'PX001', null, 'T-16: confirm_connection con conexión de B → PX001');

-- La conexión se autoriza antes que el intento: gana PX001 sobre PX002.
select throws_ok(
  $$select * from worker_api.replace_credential('aaaaaaaa-0000-4000-8000-000000000081',
      'c0a00000-0000-4000-8000-000000000081', 'cc000000-0000-4000-8000-000000000082',
      'a7000000-0000-4000-8000-000000000081', 'AAAA', 'AAAAAAAAAAAAAAAA',
      'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica', '{ads_read}', null)$$,
  'PX001', null, 'T-16: replace_credential con conexión de B → PX001 antes que el intento');

select throws_ok(
  $$select * from worker_api.mark_needs_reauth('aaaaaaaa-0000-4000-8000-000000000081',
      'c0a00000-0000-4000-8000-000000000081', 'cc000000-0000-4000-8000-000000000082',
      0, 'authentication', 'error sintetico')$$,
  'PX001', null, 'T-16: mark_needs_reauth con conexión de B → PX001');

select throws_ok(
  $$select * from worker_api.begin_disconnect('aaaaaaaa-0000-4000-8000-000000000081',
      'c0a00000-0000-4000-8000-000000000081', 'cc000000-0000-4000-8000-000000000082')$$,
  'PX001', null, 'T-16: begin_disconnect con conexión de B → PX001');

select throws_ok(
  $$select * from worker_api.rewrap_credential('aaaaaaaa-0000-4000-8000-000000000081',
      'c0a00000-0000-4000-8000-000000000081', 'cc000000-0000-4000-8000-000000000082',
      0, 1, 'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 2)$$,
  'PX001', null, 'T-16: rewrap_credential con conexión de B → PX001');

select throws_ok(
  $$select * from worker_api.create_oauth_attempt('aaaaaaaa-0000-4000-8000-000000000081',
      'c0a00000-0000-4000-8000-000000000081', 'reauth', repeat('8', 63) || '4',
      repeat('9', 63) || '4', '/app/integraciones', now() + interval '5 minutes',
      'cc000000-0000-4000-8000-000000000082')$$,
  'PX001', null, 'T-16: create_oauth_attempt reauth con conexión de B → PX001');

-- T-42: purge_connection no revela si la conexión existe en otra empresa.
select is(
  worker_api.purge_connection('aaaaaaaa-0000-4000-8000-000000000081',
    'c0a00000-0000-4000-8000-000000000081', 'cc000000-0000-4000-8000-000000000182'),
  false, 'T-42: purge_connection con la conexión desconectada de B → false');

select is(
  worker_api.purge_connection('aaaaaaaa-0000-4000-8000-000000000081',
    'c0a00000-0000-4000-8000-000000000081', 'cc000000-0000-4000-8000-00000000dead'),
  false, 'T-42: purge_connection con un id inexistente → false, igual que con uno ajeno');

select results_eq(
  $$select c.status::text,
           (select count(*)::int from private.integration_credentials k
             where k.connection_id = c.id),
           (select count(*)::int from public.oauth_attempts a
             where a.expected_connection_id = c.id)
      from public.integration_connections c
     where c.id = 'cc000000-0000-4000-8000-000000000182'$$,
  $$values ('disconnected', 1, 1)$$,
  'T-42: la conexión de B sigue desconectada, con su credencial y su intento');

-- Empresa de B con el actor de A.
select throws_ok(
  $$select * from worker_api.create_oauth_attempt('aaaaaaaa-0000-4000-8000-000000000081',
      'c0a00000-0000-4000-8000-000000000082', 'initial', repeat('8', 63) || '5',
      repeat('9', 63) || '5', '/app/integraciones', now() + interval '5 minutes')$$,
  'PX001', null, 'T-16: create_oauth_attempt en la empresa de B → PX001');

select throws_ok(
  $$select * from worker_api.create_pending_connection('aaaaaaaa-0000-4000-8000-000000000081',
      'c0a00000-0000-4000-8000-000000000082', 'cc000000-0000-4000-8000-000000000281',
      'negocio_sintetico', 'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1,
      'system_user', 'app_sintetica', '{ads_read}', null)$$,
  'PX001', null, 'T-16: create_pending_connection en la empresa de B → PX001');

select throws_ok(
  $$select * from worker_api.list_pending_purges('aaaaaaaa-0000-4000-8000-000000000081',
      'c0a00000-0000-4000-8000-000000000082')$$,
  'PX001', null, 'T-16: list_pending_purges de la empresa de B → PX001');

select is_empty(
  $$select l.connection_id from worker_api.list_pending_purges(
      'aaaaaaaa-0000-4000-8000-000000000081', 'c0a00000-0000-4000-8000-000000000081') l
     where l.connection_id in ('cc000000-0000-4000-8000-000000000082',
                               'cc000000-0000-4000-8000-000000000182')$$,
  'T-16: list_pending_purges de A no devuelve filas de B');

select throws_ok(
  $$select * from worker_api.consume_oauth_attempt('aaaaaaaa-0000-4000-8000-000000000081',
      'c0a00000-0000-4000-8000-000000000082', repeat('8', 63) || '2', repeat('9', 63) || '2')$$,
  'PX001', null, 'T-16: consume_oauth_attempt con los hashes de B y actor no miembro → PX001');

select is(
  (select consumed_at from public.oauth_attempts
    where id = 'a7000000-0000-4000-8000-000000000082'),
  null, 'T-16: el intento de B sigue sin consumir');

-- ---------------------------------------------------------------------------
-- T-48: create_pending_connection con el id de una conexión ajena (C-16)
-- ---------------------------------------------------------------------------

select results_eq(
  $$select sqlstate, message, coalesce(detail, ''), coalesce(hint, '')
      from pg_temp.error_of($q$select * from worker_api.create_pending_connection(
        'aaaaaaaa-0000-4000-8000-000000000083', 'c0a00000-0000-4000-8000-000000000083',
        'cc000000-0000-4000-8000-000000000082', 'negocio_sintetico', 'AAAA',
        'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica',
        '{ads_read}', null)$q$)$$,
  $$values ('PX001', 'praxa: operación no autorizada', '', '')$$,
  'T-48: id de la conexión de B desde C → PX001, mensaje fijo, sin DETAIL ni HINT');

select results_eq(
  $$select c.company_id, c.status::text,
           (select count(*)::int from private.integration_credentials k
             where k.connection_id = c.id)
      from public.integration_connections c
     where c.id = 'cc000000-0000-4000-8000-000000000082'$$,
  $$values ('c0a00000-0000-4000-8000-000000000082'::uuid, 'active', 1)$$,
  'T-48: la conexión y la credencial de B quedan intactas');

select is(
  (select count(*)::int from public.integration_connections
    where company_id = 'c0a00000-0000-4000-8000-000000000083')
  + (select count(*)::int from private.integration_credentials
      where company_id = 'c0a00000-0000-4000-8000-000000000083'),
  0, 'T-48: C no tiene filas nuevas');

select * from finish();
rollback;
