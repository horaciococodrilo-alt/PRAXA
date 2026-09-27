-- PRAXA — Ciclo de vida del conector: restricciones, transiciones, purga y errores.
--
-- CA-02c, CA-03, CA-07, CA-08, CA-18, CA-37, CA-37c, CA-38 y CA-38b. Las funciones de
-- `worker_api` se llaman como `postgres`, su dueño: es el mismo cuerpo SECURITY DEFINER
-- que ejecuta el rol de C, cuyo privilegio se prueba aparte en 09.
--
-- Una empresa sintética por escenario: la regla de una sola conexión viva por empresa
-- (CA-18) haría que los escenarios se pisaran entre sí. `now()` es fijo dentro de la
-- transacción del archivo, así que los bordes de tiempo son deterministas.
--
-- Datos 100 % sintéticos (CA-12): cuentas `cuenta_sintetica_…`, hashes de relleno y
-- material cifrado `AAAA`.

begin;

create extension if not exists pgtap with schema extensions;
select plan(146);

-- ---------------------------------------------------------------------------
-- Helpers (pg_temp: desaparecen con el rollback)
-- ---------------------------------------------------------------------------

create function pg_temp.uid(n int) returns uuid language sql immutable
as $fn$ select format('aaaaaaaa-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $fn$;

create function pg_temp.cid(n int) returns uuid language sql immutable
as $fn$ select format('c0a00000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $fn$;

create function pg_temp.kid(n int) returns uuid language sql immutable
as $fn$ select format('cc000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $fn$;

create function pg_temp.aid(n int) returns uuid language sql immutable
as $fn$ select format('a7000000-0000-4000-8000-%s', lpad(n::text, 12, '0'))::uuid $fn$;

-- SHA-256 de relleno: 64 caracteres hex en minúsculas.
create function pg_temp.h(n int) returns text language sql immutable
as $fn$ select lpad(to_hex(n), 64, '0') $fn$;

create function pg_temp.new_user(n int) returns void language plpgsql
as $fn$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (pg_temp.uid(n), '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', format('ciclo.%s@praxa.test', n), 'x', now(), now(), now());
end;
$fn$;

-- Usuario n, dueño y miembro de la empresa n.
create function pg_temp.new_company(n int) returns void language plpgsql
as $fn$
begin
  perform pg_temp.new_user(n);
  insert into public.companies (id, name, owner_id)
  values (pg_temp.cid(n), format('Empresa sintetica %s', n), pg_temp.uid(n));
end;
$fn$;

-- Conexión k pendiente en la empresa n, con su credencial.
create function pg_temp.pending(n int, k int) returns void language plpgsql
as $fn$
begin
  perform worker_api.create_pending_connection(
    pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(k), 'negocio_sintetico', 'AAAA',
    'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica',
    '{ads_read}', null);
end;
$fn$;

-- Conexión k activa en la empresa n, con la cuenta cuenta_sintetica_<k>.
create function pg_temp.active(n int, k int) returns void language plpgsql
as $fn$
begin
  perform pg_temp.pending(n, k);
  perform worker_api.confirm_connection(
    pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(k),
    'cuenta_sintetica_' || lpad(k::text, 4, '0'), 'USD', 'UTC', true);
end;
$fn$;

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

-- Ids de intentos creados por las funciones, para referirlos en las aserciones.
create temp table ids (name text primary key, id uuid not null);

-- ===========================================================================
-- T-17: restricciones de las tablas (C-11, C-12, C-14, C-38)
-- ===========================================================================

select pg_temp.new_company(201);

-- C-11: restricciones por estado de integration_connections.
select throws_ok(
  $$insert into public.integration_connections (id, company_id, status, purge_requested_at, external_account_id)
    values (gen_random_uuid(), pg_temp.cid(201), 'disconnected', now(), 'cuenta_sintetica_0001')$$,
  '23514', null, 'T-17: metadatos parciales → 23514');

select throws_ok(
  $$insert into public.integration_connections (id, company_id, status)
    values (gen_random_uuid(), pg_temp.cid(201), 'active')$$,
  '23514', null, 'T-17: active sin metadatos → 23514');

select throws_ok(
  $$insert into public.integration_connections (id, company_id, status)
    values (gen_random_uuid(), pg_temp.cid(201), 'pending_selection')$$,
  '23514', null, 'T-17: pendiente sin vencimiento → 23514');

select throws_ok(
  $$insert into public.integration_connections (id, company_id, status, pending_expires_at, purge_requested_at)
    values (gen_random_uuid(), pg_temp.cid(201), 'pending_selection', now() + interval '30 minutes', now())$$,
  '23514', null, 'T-17: marca de purga fuera de disconnected → 23514');

select throws_ok(
  $$insert into public.integration_connections (id, company_id, status, purge_requested_at, last_error_class)
    values (gen_random_uuid(), pg_temp.cid(201), 'disconnected', now(), 'unknown')$$,
  '23514', null, 'T-17: clase de error sin mensaje → 23514');

select throws_ok(
  $$insert into public.integration_connections
      (id, company_id, status, external_account_id, currency, timezone, last_error_class, last_error_message)
    values (gen_random_uuid(), pg_temp.cid(201), 'needs_reauth', 'cuenta_sintetica_0001', 'USD', 'UTC', 'unknown', 'error sintetico')$$,
  '23514', null, 'T-17: needs_reauth con clase unknown → 23514');

select throws_ok(
  $$insert into public.integration_connections
      (id, company_id, status, external_account_id, currency, timezone)
    values (gen_random_uuid(), pg_temp.cid(201), 'needs_reauth', 'cuenta_sintetica_0001', 'USD', 'UTC')$$,
  '23514', null, 'T-17: needs_reauth con clase y mensaje nulos → 23514');

select throws_ok(
  $$insert into public.integration_connections
      (id, company_id, status, purge_requested_at, last_error_class, last_error_message)
    values (gen_random_uuid(), pg_temp.cid(201), 'disconnected', now(), 'unknown', repeat('x', 501))$$,
  '23514', null, 'T-17: mensaje de 501 caracteres → 23514');

-- C-12: una sola conexión viva por empresa y cuenta única por empresa.
select lives_ok(
  $$insert into public.integration_connections (id, company_id, status, pending_expires_at)
    values (pg_temp.kid(201), pg_temp.cid(201), 'pending_selection', now() + interval '30 minutes')$$,
  'T-17: primera conexión viva');

select throws_ok(
  $$insert into public.integration_connections (id, company_id, status, pending_expires_at)
    values (gen_random_uuid(), pg_temp.cid(201), 'pending_selection', now() + interval '30 minutes')$$,
  '23505', null, 'T-17: segunda conexión viva en la misma empresa → 23505');

select lives_ok(
  $$insert into public.integration_connections
      (id, company_id, status, purge_requested_at, external_account_id, currency, timezone)
    values (gen_random_uuid(), pg_temp.cid(201), 'disconnected', now(), 'cuenta_sintetica_0201', 'USD', 'UTC')$$,
  'T-17: desconectada con cuenta');

select throws_ok(
  $$insert into public.integration_connections
      (id, company_id, status, purge_requested_at, external_account_id, currency, timezone)
    values (gen_random_uuid(), pg_temp.cid(201), 'disconnected', now(), 'cuenta_sintetica_0201', 'USD', 'UTC')$$,
  '23505', null, 'T-17: misma cuenta dos veces en la empresa → 23505');

-- C-14: intentos.
select throws_ok(
  $$insert into public.oauth_attempts (company_id, actor_user_id, purpose, state_hash,
      browser_binding_hash, return_path, expires_at)
    values (pg_temp.cid(201), pg_temp.uid(201), 'initial', upper(pg_temp.h(1701)),
      pg_temp.h(1702), '/app/integraciones', now() + interval '5 minutes')$$,
  '23514', null, 'T-17: state_hash que no es SHA-256 hex en minúsculas → 23514');

select throws_ok(
  $$insert into public.oauth_attempts (company_id, actor_user_id, purpose, state_hash,
      browser_binding_hash, return_path, expires_at)
    values (pg_temp.cid(201), pg_temp.uid(201), 'initial', pg_temp.h(1701),
      'abc', '/app/integraciones', now() + interval '5 minutes')$$,
  '23514', null, 'T-17: browser_binding_hash que no es SHA-256 → 23514');

select throws_ok(
  $$insert into public.oauth_attempts (company_id, actor_user_id, purpose, state_hash,
      browser_binding_hash, return_path, expires_at)
    values (pg_temp.cid(201), pg_temp.uid(201), 'other', pg_temp.h(1701),
      pg_temp.h(1702), '/app/integraciones', now() + interval '5 minutes')$$,
  '23514', null, 'T-17: propósito desconocido → 23514');

select throws_ok(
  $$insert into public.oauth_attempts (company_id, actor_user_id, purpose, expected_connection_id,
      state_hash, browser_binding_hash, return_path, expires_at)
    values (pg_temp.cid(201), pg_temp.uid(201), 'initial', pg_temp.kid(201), pg_temp.h(1701),
      pg_temp.h(1702), '/app/integraciones', now() + interval '5 minutes')$$,
  '23514', null, 'T-17: initial con conexión esperada → 23514');

select throws_ok(
  $$insert into public.oauth_attempts (company_id, actor_user_id, purpose, state_hash,
      browser_binding_hash, return_path, expires_at)
    values (pg_temp.cid(201), pg_temp.uid(201), 'reauth', pg_temp.h(1701),
      pg_temp.h(1702), '/app/integraciones', now() + interval '5 minutes')$$,
  '23514', null, 'T-17: reauth sin conexión ni generación esperadas → 23514');

select throws_ok(
  $$insert into public.oauth_attempts (company_id, actor_user_id, purpose, state_hash,
      browser_binding_hash, return_path, expires_at)
    values (pg_temp.cid(201), pg_temp.uid(201), 'initial', pg_temp.h(1701),
      pg_temp.h(1702), '/otra', now() + interval '5 minutes')$$,
  '23514', null, 'T-17: retorno fuera de la allowlist → 23514');

select throws_ok(
  $$insert into public.oauth_attempts (company_id, actor_user_id, purpose, state_hash,
      browser_binding_hash, return_path, expires_at)
    values (pg_temp.cid(201), pg_temp.uid(201), 'initial', pg_temp.h(1701),
      pg_temp.h(1702), '/app/integraciones', now() + interval '11 minutes')$$,
  '23514', null, 'T-17: vencimiento mayor a 10 minutos → 23514');

select throws_ok(
  $$insert into public.oauth_attempts (company_id, actor_user_id, purpose, state_hash,
      browser_binding_hash, return_path, expires_at)
    values (pg_temp.cid(201), pg_temp.uid(201), 'initial', pg_temp.h(1701),
      pg_temp.h(1702), '/app/integraciones', now())$$,
  '23514', null, 'T-17: vencimiento no posterior a la creación → 23514');

select lives_ok(
  $$insert into public.oauth_attempts (company_id, actor_user_id, purpose, state_hash,
      browser_binding_hash, return_path, expires_at)
    values (pg_temp.cid(201), pg_temp.uid(201), 'initial', pg_temp.h(1701),
      pg_temp.h(1702), '/app/integraciones', now() + interval '10 minutes')$$,
  'T-17: intento válido con el vencimiento máximo de 10 minutos');

select throws_ok(
  $$insert into public.oauth_attempts (company_id, actor_user_id, purpose, state_hash,
      browser_binding_hash, return_path, expires_at)
    values (pg_temp.cid(201), pg_temp.uid(201), 'initial', pg_temp.h(1701),
      pg_temp.h(1703), '/app/integraciones', now() + interval '5 minutes')$$,
  '23505', null, 'T-17: state_hash repetido → 23505');

-- C-38: credenciales, con las invariantes de K04.
create function pg_temp.credential_insert(p_ciphertext text, p_iv text, p_auth_tag text,
                                          p_scopes text, p_key_version int default 1,
                                          p_token_type text default 'system_user')
returns text language sql immutable
as $fn$
  select format(
    'insert into private.integration_credentials (connection_id, company_id, ciphertext, iv, '
    'auth_tag, key_version, token_type, issued_for_app_id, granted_scopes) '
    'values (pg_temp.kid(201), pg_temp.cid(201), %L, %L, %L, %s, %L, ''app_sintetica'', %L)',
    p_ciphertext, p_iv, p_auth_tag, p_key_version, p_token_type, p_scopes)
$fn$;

select throws_ok(
  pg_temp.credential_insert('AAAA', 'AAAAAAAAAAAAAA==', 'AAAAAAAAAAAAAAAAAAAAAA==', '{ads_read}'),
  '23514', null, 'T-17: IV de 10 bytes → 23514');

select throws_ok(
  pg_temp.credential_insert('AAAA', 'AAAAAAAAAAAAAAA=', 'AAAAAAAAAAAAAAAAAAAAAA==', '{ads_read}'),
  '23514', null, 'T-17: IV de 11 bytes → 23514');

select throws_ok(
  pg_temp.credential_insert('AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAA', '{ads_read}'),
  '23514', null, 'T-17: etiqueta de 15 bytes → 23514');

select throws_ok(
  pg_temp.credential_insert('', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', '{ads_read}'),
  '23514', null, 'T-17: ciphertext vacío → 23514');

select throws_ok(
  pg_temp.credential_insert('no-es-base64', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', '{ads_read}'),
  '23514', null, 'T-17: ciphertext que no es base64 → 23514');

select throws_ok(
  pg_temp.credential_insert('AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', '{ads_read,Ads-Read}'),
  '23514', null, 'T-17: permiso con forma inválida → 23514');

select throws_ok(
  pg_temp.credential_insert('AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', '{ads_read,ads_read}'),
  '23514', null, 'T-17: permiso repetido → 23514');

select throws_ok(
  pg_temp.credential_insert('AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', '{ads_read,NULL}'),
  '23514', null, 'T-17: permiso nulo → 23514');

select throws_ok(
  pg_temp.credential_insert('AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', '{business_management}'),
  '23514', null, 'T-17: permisos sin ads_read → 23514');

select throws_ok(
  pg_temp.credential_insert('AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', '{ads_read}', 0),
  '23514', null, 'T-17: key_version 0 → 23514');

select throws_ok(
  pg_temp.credential_insert('AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', '{ads_read}', 1, 'user'),
  '23514', null, 'T-17: token_type distinto de system_user → 23514');

select lives_ok(
  pg_temp.credential_insert('AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', '{ads_read,business_management}'),
  'T-17: control positivo: IV de 12 bytes, etiqueta de 16 y permisos válidos');

-- ===========================================================================
-- T-18: create_oauth_attempt (C-17)
-- ===========================================================================

select pg_temp.new_company(202);
select pg_temp.active(202, 202);
update public.integration_connections set credential_generation = 3 where id = pg_temp.kid(202);

select pg_temp.new_company(203);

select pg_temp.new_company(204);
select pg_temp.pending(204, 204);

select pg_temp.new_company(205);
select pg_temp.pending(205, 205);
select 1 from worker_api.begin_disconnect(pg_temp.uid(205), pg_temp.cid(205), pg_temp.kid(205));

select throws_ok(
  $$select * from worker_api.create_oauth_attempt(pg_temp.uid(202), pg_temp.cid(202),
      'initial', pg_temp.h(1801), pg_temp.h(1802), '/app/integraciones', now() + interval '5 minutes')$$,
  'PX003', 'praxa: la empresa ya tiene una conexión', 'T-18/T-31: initial con conexión viva → PX003');

select throws_ok(
  $$select * from worker_api.create_oauth_attempt(pg_temp.uid(203), pg_temp.cid(203),
      'initial', pg_temp.h(1801), pg_temp.h(1802), '/app/integraciones',
      now() + interval '5 minutes', pg_temp.kid(202))$$,
  '22023', 'praxa: argumento inválido', 'T-18: initial con conexión esperada → 22023');

select throws_ok(
  $$select * from worker_api.create_oauth_attempt(pg_temp.uid(203), pg_temp.cid(203),
      'reauth', pg_temp.h(1801), pg_temp.h(1802), '/app/integraciones', now() + interval '5 minutes')$$,
  '22023', null, 'T-18: reauth sin conexión esperada → 22023');

select throws_ok(
  $$select * from worker_api.create_oauth_attempt(pg_temp.uid(203), pg_temp.cid(203),
      'other', pg_temp.h(1801), pg_temp.h(1802), '/app/integraciones', now() + interval '5 minutes')$$,
  '22023', null, 'T-18: propósito desconocido → 22023');

select throws_ok(
  $$select * from worker_api.create_oauth_attempt(pg_temp.uid(203), pg_temp.cid(203),
      'initial', pg_temp.h(1801), pg_temp.h(1802), '/app/integraciones', now() + interval '11 minutes')$$,
  '22023', null, 'T-18: vencimiento a 11 minutos → 22023');

select throws_ok(
  $$select * from worker_api.create_oauth_attempt(pg_temp.uid(203), pg_temp.cid(203),
      'initial', pg_temp.h(1801), pg_temp.h(1802), '/app/integraciones', now() - interval '1 minute')$$,
  '22023', null, 'T-18: vencimiento en el pasado → 22023');

select results_eq(
  $$select purpose, created_at = now(), expires_at = now() + interval '10 minutes'
      from worker_api.create_oauth_attempt(pg_temp.uid(203), pg_temp.cid(203),
        'initial', pg_temp.h(1803), pg_temp.h(1804), '/app/integraciones',
        now() + interval '10 minutes')$$,
  $$values ('initial', true, true)$$,
  'T-18: initial sin conexión viva, con el vencimiento máximo, se crea');

-- Reintento (D-M06.1a-M06.2a-20): mismo state, actor, empresa y vinculación de navegador,
-- con el intento sin consumir y sin vencer, devuelve la fila ya creada en vez de chocar
-- con la unicidad de state_hash. T-46 (más abajo) confirma que otro browser_binding_hash
-- con el mismo state sigue dando 22023: no es un reintento de la misma llamada.
select results_eq(
  $$select attempt_id, purpose
      from worker_api.create_oauth_attempt(pg_temp.uid(203), pg_temp.cid(203),
        'initial', pg_temp.h(1803), pg_temp.h(1804), '/app/integraciones',
        now() + interval '10 minutes')$$,
  $$select id, purpose from public.oauth_attempts where state_hash = pg_temp.h(1803)$$,
  'T-18: el reintento con el mismo state y navegador devuelve la fila ya creada');

select is(
  (select count(*)::int from public.oauth_attempts where state_hash = pg_temp.h(1803)),
  1, 'T-18: el reintento no crea una fila duplicada');

select results_eq(
  $$select purpose, expected_connection_id, expected_generation
      from worker_api.create_oauth_attempt(pg_temp.uid(202), pg_temp.cid(202),
        'reauth', pg_temp.h(1805), pg_temp.h(1806), '/app/integraciones',
        now() + interval '5 minutes', pg_temp.kid(202))$$,
  $$values ('reauth', pg_temp.kid(202), 3)$$,
  'T-18: reauth sobre una activa guarda la conexión y la generación leída de la fila');

select throws_ok(
  $$select * from worker_api.create_oauth_attempt(pg_temp.uid(204), pg_temp.cid(204),
      'reauth', pg_temp.h(1807), pg_temp.h(1808), '/app/integraciones',
      now() + interval '5 minutes', pg_temp.kid(204))$$,
  'PX004', 'praxa: transición de estado no permitida',
  'T-18/T-31: reauth sobre una pendiente no vencida → PX004');

select throws_ok(
  $$select * from worker_api.create_oauth_attempt(pg_temp.uid(205), pg_temp.cid(205),
      'reauth', pg_temp.h(1807), pg_temp.h(1808), '/app/integraciones',
      now() + interval '5 minutes', pg_temp.kid(205))$$,
  'PX004', null, 'T-18: reauth sobre una desconectada → PX004');

-- ===========================================================================
-- T-19: consume_oauth_attempt (C-18)
-- ===========================================================================

select pg_temp.new_company(206);
select pg_temp.new_company(207);
select pg_temp.new_user(208);
-- El actor de 206 es también miembro de 207; el usuario 208 es miembro de 206.
insert into public.company_members (company_id, user_id, role)
values (pg_temp.cid(207), pg_temp.uid(206), 'owner'),
       (pg_temp.cid(206), pg_temp.uid(208), 'owner');

select 1 from worker_api.create_oauth_attempt(pg_temp.uid(206), pg_temp.cid(206),
  'initial', pg_temp.h(1901), pg_temp.h(1902), '/app/integraciones', now() + interval '5 minutes');

select results_eq(
  $$select purpose, return_path
      from worker_api.consume_oauth_attempt(pg_temp.uid(206), pg_temp.cid(206),
        pg_temp.h(1901), pg_temp.h(1902))$$,
  $$values ('initial', '/app/integraciones')$$,
  'T-19: el primer consumo devuelve el propósito');

select throws_ok(
  $$select * from worker_api.consume_oauth_attempt(pg_temp.uid(206), pg_temp.cid(206),
      pg_temp.h(1901), pg_temp.h(1902))$$,
  'PX002', 'praxa: la autorización no es válida o ya se usó',
  'T-19/T-31: el segundo consumo → PX002');

-- Sembrados después de la última llamada a create_oauth_attempt de 206, que los purgaría.
insert into public.oauth_attempts (company_id, actor_user_id, purpose, state_hash,
  browser_binding_hash, return_path, created_at, expires_at)
values
  (pg_temp.cid(206), pg_temp.uid(206), 'initial', pg_temp.h(1911), pg_temp.h(1912),
   '/app/integraciones', now() - interval '8 minutes', now() - interval '1 minute'),
  (pg_temp.cid(206), pg_temp.uid(206), 'initial', pg_temp.h(1921), pg_temp.h(1922),
   '/app/integraciones', now(), now() + interval '5 minutes');

select throws_ok(
  $$select * from worker_api.consume_oauth_attempt(pg_temp.uid(206), pg_temp.cid(206),
      pg_temp.h(1911), pg_temp.h(1912))$$,
  'PX002', null, 'T-19: intento vencido → PX002');

select throws_ok(
  $$select * from worker_api.consume_oauth_attempt(pg_temp.uid(208), pg_temp.cid(206),
      pg_temp.h(1921), pg_temp.h(1922))$$,
  'PX002', null, 'T-19: intento de otro actor de la misma empresa → PX002');

select throws_ok(
  $$select * from worker_api.consume_oauth_attempt(pg_temp.uid(206), pg_temp.cid(207),
      pg_temp.h(1921), pg_temp.h(1922))$$,
  'PX002', null, 'T-19: intento de otra empresa, con actor miembro de ambas → PX002');

select throws_ok(
  $$select * from worker_api.consume_oauth_attempt(pg_temp.uid(206), pg_temp.cid(206),
      pg_temp.h(1921), pg_temp.h(1999))$$,
  'PX002', null, 'T-19: otro hash de vinculación → PX002');

select throws_ok(
  $$select * from worker_api.consume_oauth_attempt(pg_temp.uid(206), pg_temp.cid(206),
      pg_temp.h(1998), pg_temp.h(1922))$$,
  'PX002', null, 'T-19: state desconocido → PX002');

select results_eq(
  $$select purpose
      from worker_api.consume_oauth_attempt(pg_temp.uid(206), pg_temp.cid(206),
        pg_temp.h(1921), pg_temp.h(1922))$$,
  $$values ('initial')$$,
  'T-19: los rechazos no consumieron el intento vigente');

-- ===========================================================================
-- T-20: create_pending_connection (C-19)
-- ===========================================================================

select pg_temp.new_company(209);

select results_eq(
  $$select connection_id, status, credential_generation
      from worker_api.create_pending_connection(pg_temp.uid(209), pg_temp.cid(209),
        pg_temp.kid(209), 'negocio_sintetico', 'AAAA', 'AAAAAAAAAAAAAAAA',
        'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica', '{ads_read}', null)$$,
  $$values (pg_temp.kid(209), 'pending_selection', 0)$$,
  'T-20: la pendiente se crea con generación 0');

select ok(
  (select c.pending_expires_at between now() + interval '29 minutes' and now() + interval '31 minutes'
     from public.integration_connections c where c.id = pg_temp.kid(209)),
  'T-20: pending_expires_at a 30 minutos');

select results_eq(
  $$select c.external_account_id, c.currency, c.timezone, c.client_business_id
      from public.integration_connections c where c.id = pg_temp.kid(209)$$,
  $$values (null::text, null::text, null::text, 'negocio_sintetico')$$,
  'T-20: metadatos nulos y negocio guardado');

select is(
  (select count(*)::int from private.integration_credentials k where k.connection_id = pg_temp.kid(209)),
  1, 'T-20: la credencial se guarda en la misma transacción');

select throws_ok(
  $$select * from worker_api.create_pending_connection(pg_temp.uid(209), pg_temp.cid(209),
      pg_temp.kid(1209), 'negocio_sintetico', 'AAAA', 'AAAAAAAAAAAAAAAA',
      'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica', '{ads_read}', null)$$,
  'PX003', null, 'T-20: segunda pendiente con una viva → PX003');

-- Reintento (D-M06.1a-M06.2a-11): la misma llamada, con el mismo id y el mismo material
-- cifrado, devuelve la fila sin crear otra.
select results_eq(
  $$select connection_id, status, credential_generation
      from worker_api.create_pending_connection(pg_temp.uid(209), pg_temp.cid(209),
        pg_temp.kid(209), 'negocio_sintetico', 'AAAA', 'AAAAAAAAAAAAAAAA',
        'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica', '{ads_read}', null)$$,
  $$values (pg_temp.kid(209), 'pending_selection', 0)$$,
  'T-20: el reintento idéntico devuelve la pendiente');

select results_eq(
  $$select (select count(*)::int from public.integration_connections where company_id = pg_temp.cid(209)),
           (select count(*)::int from private.integration_credentials where company_id = pg_temp.cid(209))$$,
  $$values (1, 1)$$,
  'T-20: el reintento no crea filas');

-- Material cifrado distinto (el servidor volvió a cifrar): es una operación nueva.
select throws_ok(
  $$select * from worker_api.create_pending_connection(pg_temp.uid(209), pg_temp.cid(209),
      pg_temp.kid(209), 'negocio_sintetico', 'BBBB', 'AAAAAAAAAAAAAAAA',
      'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica', '{ads_read}', null)$$,
  'PX003', null, 'T-20: mismo id con otro material cifrado → PX003');

-- Pendiente vencida (D-M06.1a-M06.2a-19): el reintento no puede devolver una fila que ya
-- venció como si la creación hubiera salido bien. Sin purga previa: sigue viva a los
-- efectos de la unicidad, así que el "reintento" tardío da PX003, igual que cualquier otra
-- llamada sobre una empresa que ya tiene una conexión.
select pg_temp.new_company(2091);
select 1 from worker_api.create_pending_connection(pg_temp.uid(2091), pg_temp.cid(2091),
  pg_temp.kid(2091), 'negocio_sintetico', 'AAAA', 'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica', '{ads_read}', null);
update public.integration_connections set pending_expires_at = now() - interval '1 minute'
 where id = pg_temp.kid(2091);

select throws_ok(
  $$select * from worker_api.create_pending_connection(pg_temp.uid(2091), pg_temp.cid(2091),
      pg_temp.kid(2091), 'negocio_sintetico', 'AAAA', 'AAAAAAAAAAAAAAAA',
      'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica', '{ads_read}', null)$$,
  'PX003', null, 'T-20: reintento idéntico sobre una pendiente vencida → PX003');

-- ===========================================================================
-- T-21: confirm_connection (C-20)
-- ===========================================================================

select pg_temp.new_company(210);
select pg_temp.pending(210, 210);
update public.integration_connections set pending_expires_at = now() - interval '1 minute'
 where id = pg_temp.kid(210);

select pg_temp.new_company(211);
select pg_temp.pending(211, 211);

select throws_ok(
  $$select * from worker_api.confirm_connection(pg_temp.uid(210), pg_temp.cid(210),
      pg_temp.kid(210), 'cuenta_sintetica_0210', 'USD', 'UTC', true)$$,
  'PX005', 'praxa: la conexión pendiente venció',
  'T-21/T-31: confirmar una pendiente vencida, sin purga → PX005');

select throws_ok(
  $$select * from worker_api.confirm_connection(pg_temp.uid(211), pg_temp.cid(211),
      pg_temp.kid(211), 'cuenta_sintetica_0211', 'USD', 'UTC', false)$$,
  '22023', null, 'T-21: probe fallido → 22023');

select throws_ok(
  $$select * from worker_api.confirm_connection(pg_temp.uid(211), pg_temp.cid(211),
      pg_temp.kid(211), 'cuenta_sintetica_0211', 'USD', 'Mars/Olympus', true)$$,
  '22023', null, 'T-21: zona inexistente → 22023');

select results_eq(
  $$select connection_id, status, credential_generation
      from worker_api.confirm_connection(pg_temp.uid(211), pg_temp.cid(211),
        pg_temp.kid(211), 'cuenta_sintetica_0211', 'ARS', 'America/Argentina/Buenos_Aires', true)$$,
  $$values (pg_temp.kid(211), 'active', 0)$$,
  'T-21: la confirmación válida deja active');

select results_eq(
  $$select c.external_account_id, c.currency, c.timezone,
           c.pending_expires_at is null, c.last_error_class is null
      from public.integration_connections c where c.id = pg_temp.kid(211)$$,
  $$values ('cuenta_sintetica_0211', 'ARS', 'America/Argentina/Buenos_Aires', true, true)$$,
  'T-21: la activa tiene los tres metadatos, sin vencimiento ni error');

-- Reintento (D-M06.1a-M06.2a-12): la misma confirmación ya aplicada devuelve la fila.
select results_eq(
  $$select connection_id, status, credential_generation
      from worker_api.confirm_connection(pg_temp.uid(211), pg_temp.cid(211),
        pg_temp.kid(211), 'cuenta_sintetica_0211', 'ARS', 'America/Argentina/Buenos_Aires', true)$$,
  $$values (pg_temp.kid(211), 'active', 0)$$,
  'T-21: el reintento idéntico devuelve la activa');

select throws_ok(
  $$select * from worker_api.confirm_connection(pg_temp.uid(211), pg_temp.cid(211),
      pg_temp.kid(211), 'cuenta_sintetica_0211', 'USD', 'America/Argentina/Buenos_Aires', true)$$,
  'PX004', null, 'T-21: reintento con otra moneda → PX004');

-- ===========================================================================
-- T-22: replace_credential (C-21)
-- ===========================================================================

select pg_temp.new_company(212);
select pg_temp.active(212, 212);
insert into public.integration_connections (id, company_id, status, purge_requested_at)
values (pg_temp.kid(1212), pg_temp.cid(212), 'disconnected', now());

insert into ids
select 'r1', attempt_id from worker_api.create_oauth_attempt(pg_temp.uid(212), pg_temp.cid(212),
  'reauth', pg_temp.h(2201), pg_temp.h(2202), '/app/integraciones',
  now() + interval '5 minutes', pg_temp.kid(212));
select 1 from worker_api.consume_oauth_attempt(pg_temp.uid(212), pg_temp.cid(212),
  pg_temp.h(2201), pg_temp.h(2202));
-- Otra reautorización cambió la credencial después de que se creó el intento r1.
update public.integration_connections set credential_generation = 1 where id = pg_temp.kid(212);

insert into ids
select 'r2', attempt_id from worker_api.create_oauth_attempt(pg_temp.uid(212), pg_temp.cid(212),
  'reauth', pg_temp.h(2211), pg_temp.h(2212), '/app/integraciones',
  now() + interval '5 minutes', pg_temp.kid(212));

insert into public.oauth_attempts (id, company_id, actor_user_id, purpose, expected_connection_id,
  expected_generation, state_hash, browser_binding_hash, return_path, expires_at, consumed_at)
values
  (pg_temp.aid(2221), pg_temp.cid(212), pg_temp.uid(212), 'initial', null, null,
   pg_temp.h(2221), pg_temp.h(2222), '/app/integraciones', now() + interval '5 minutes', now()),
  (pg_temp.aid(2231), pg_temp.cid(212), pg_temp.uid(212), 'reauth', pg_temp.kid(1212), 1,
   pg_temp.h(2231), pg_temp.h(2232), '/app/integraciones', now() + interval '5 minutes', now());

select throws_ok(
  $$select * from worker_api.replace_credential(pg_temp.uid(212), pg_temp.cid(212), pg_temp.kid(212),
      (select id from ids where name = 'r1'), 'BBBB', 'AAAAAAAAAAAAAAAA',
      'AAAAAAAAAAAAAAAAAAAAAA==', 2, 'system_user', 'app_sintetica', '{ads_read}', null)$$,
  'PX006', 'praxa: la credencial cambió; volvé a empezar',
  'T-22/T-31: generación vieja → PX006');

select throws_ok(
  $$select * from worker_api.replace_credential(pg_temp.uid(212), pg_temp.cid(212), pg_temp.kid(212),
      (select id from ids where name = 'r2'), 'BBBB', 'AAAAAAAAAAAAAAAA',
      'AAAAAAAAAAAAAAAAAAAAAA==', 2, 'system_user', 'app_sintetica', '{ads_read}', null)$$,
  'PX002', null, 'T-22: intento no consumido → PX002');

select throws_ok(
  $$select * from worker_api.replace_credential(pg_temp.uid(212), pg_temp.cid(212), pg_temp.kid(212),
      pg_temp.aid(2221), 'BBBB', 'AAAAAAAAAAAAAAAA',
      'AAAAAAAAAAAAAAAAAAAAAA==', 2, 'system_user', 'app_sintetica', '{ads_read}', null)$$,
  'PX002', null, 'T-22: intento initial → PX002');

select throws_ok(
  $$select * from worker_api.replace_credential(pg_temp.uid(212), pg_temp.cid(212), pg_temp.kid(212),
      pg_temp.aid(2231), 'BBBB', 'AAAAAAAAAAAAAAAA',
      'AAAAAAAAAAAAAAAAAAAAAA==', 2, 'system_user', 'app_sintetica', '{ads_read}', null)$$,
  'PX002', null, 'T-22: intento de otra conexión → PX002');

select 1 from worker_api.consume_oauth_attempt(pg_temp.uid(212), pg_temp.cid(212),
  pg_temp.h(2211), pg_temp.h(2212));
select 1 from worker_api.mark_needs_reauth(pg_temp.uid(212), pg_temp.cid(212), pg_temp.kid(212),
  1, 'permission', 'error sintetico');

select results_eq(
  $$select connection_id, status, credential_generation
      from worker_api.replace_credential(pg_temp.uid(212), pg_temp.cid(212), pg_temp.kid(212),
        (select id from ids where name = 'r2'), 'BBBB', 'AAAAAAAAAAAAAAAA',
        'AAAAAAAAAAAAAAAAAAAAAA==', 2, 'system_user', 'app_sintetica',
        '{ads_read,business_management}', null)$$,
  $$values (pg_temp.kid(212), 'active', 2)$$,
  'T-22: la reautorización válida desde needs_reauth incrementa la generación y deja active');

select results_eq(
  $$select c.status::text, c.last_error_class, c.last_error_message
      from public.integration_connections c where c.id = pg_temp.kid(212)$$,
  $$values ('active', null::text, null::text)$$,
  'T-22: el último error queda nulo');

select results_eq(
  $$select k.ciphertext, k.key_version, k.granted_scopes
      from private.integration_credentials k where k.connection_id = pg_temp.kid(212)$$,
  $$values ('BBBB', 2, '{ads_read,business_management}'::text[])$$,
  'T-22: la credencial se reemplazó (una sola fila)');

-- Reintento (D-M06.1a-M06.2a-20): el mismo intento r2, ya consumido y ya aplicado, con
-- exactamente el mismo material cifrado, devuelve la fila en vez de PX006. La generación
-- ya avanzó un paso más allá de lo que esperaba r2, precisamente porque este intento fue
-- el que la hizo avanzar.
select results_eq(
  $$select connection_id, status, credential_generation
      from worker_api.replace_credential(pg_temp.uid(212), pg_temp.cid(212), pg_temp.kid(212),
        (select id from ids where name = 'r2'), 'BBBB', 'AAAAAAAAAAAAAAAA',
        'AAAAAAAAAAAAAAAAAAAAAA==', 2, 'system_user', 'app_sintetica',
        '{ads_read,business_management}', null)$$,
  $$values (pg_temp.kid(212), 'active', 2)$$,
  'T-22: el reintento idéntico con r2 devuelve la fila ya aplicada');

select is(
  (select count(*)::int from private.integration_credentials where connection_id = pg_temp.kid(212)),
  1, 'T-22: el reintento no duplica la credencial');

-- Con otro material cifrado, el mismo intento consumido sigue dando PX006: no es un
-- reintento de la misma llamada, es otra escritura sobre un intento que ya se usó.
select throws_ok(
  $$select * from worker_api.replace_credential(pg_temp.uid(212), pg_temp.cid(212), pg_temp.kid(212),
      (select id from ids where name = 'r2'), 'CCCC', 'AAAAAAAAAAAAAAAA',
      'AAAAAAAAAAAAAAAAAAAAAA==', 3, 'system_user', 'app_sintetica',
      '{ads_read,business_management}', null)$$,
  'PX006', null, 'T-22: mismo intento con otro material cifrado → PX006, no es un reintento');

-- Después de una reautorización, repetir la confirmación original ya no es un reintento:
-- la generación dejó de ser la que dejó la confirmación (D-M06.1a-M06.2a-12).
select throws_ok(
  $$select * from worker_api.confirm_connection(pg_temp.uid(212), pg_temp.cid(212),
      pg_temp.kid(212), 'cuenta_sintetica_0212', 'USD', 'UTC', true)$$,
  'PX004', null, 'T-21: misma cuenta, moneda y zona con otra generación → PX004');

-- Intento reauth consumido hace más de 10 minutos (D-M06.1a-M06.2a-14): PX002 aunque la
-- purga de create_oauth_attempt no haya corrido. El consumido hace exactamente 10 minutos
-- todavía sirve.
select pg_temp.new_company(233);
select pg_temp.active(233, 233);

insert into public.oauth_attempts (id, company_id, actor_user_id, purpose, expected_connection_id,
  expected_generation, state_hash, browser_binding_hash, return_path, created_at, expires_at,
  consumed_at)
values
  (pg_temp.aid(2331), pg_temp.cid(233), pg_temp.uid(233), 'reauth', pg_temp.kid(233), 0,
   pg_temp.h(2331), pg_temp.h(2332), '/app/integraciones', now() - interval '20 minutes',
   now() - interval '12 minutes', now() - interval '11 minutes'),
  (pg_temp.aid(2333), pg_temp.cid(233), pg_temp.uid(233), 'reauth', pg_temp.kid(233), 0,
   pg_temp.h(2333), pg_temp.h(2334), '/app/integraciones', now() - interval '15 minutes',
   now() - interval '6 minutes', now() - interval '10 minutes');

select throws_ok(
  $$select * from worker_api.replace_credential(pg_temp.uid(233), pg_temp.cid(233), pg_temp.kid(233),
      pg_temp.aid(2331), 'BBBB', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 2,
      'system_user', 'app_sintetica', '{ads_read}', null)$$,
  'PX002', 'praxa: la autorización no es válida o ya se usó',
  'T-22: intento consumido hace 11 minutos → PX002');

select results_eq(
  $$select connection_id, status, credential_generation
      from worker_api.replace_credential(pg_temp.uid(233), pg_temp.cid(233), pg_temp.kid(233),
        pg_temp.aid(2333), 'BBBB', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 2,
        'system_user', 'app_sintetica', '{ads_read}', null)$$,
  $$values (pg_temp.kid(233), 'active', 1)$$,
  'T-22: intento consumido hace exactamente 10 minutos → válido');

-- ===========================================================================
-- T-23: mark_needs_reauth (C-22)
-- ===========================================================================

select pg_temp.new_company(213);
select pg_temp.active(213, 213);

select throws_ok(
  $$select * from worker_api.mark_needs_reauth(pg_temp.uid(213), pg_temp.cid(213), pg_temp.kid(213),
      0, 'unknown', 'error sintetico')$$,
  '22023', null, 'T-23: clase unknown → 22023');

select throws_ok(
  $$select * from worker_api.mark_needs_reauth(pg_temp.uid(213), pg_temp.cid(213), pg_temp.kid(213),
      5, 'authentication', 'error sintetico')$$,
  'PX006', null, 'T-23: generación distinta de la esperada → PX006');

select results_eq(
  $$select connection_id, status, credential_generation
      from worker_api.mark_needs_reauth(pg_temp.uid(213), pg_temp.cid(213), pg_temp.kid(213),
        0, 'authentication', 'error sintetico')$$,
  $$values (pg_temp.kid(213), 'needs_reauth', 0)$$,
  'T-23: active → needs_reauth con authentication');

select results_eq(
  $$select c.last_error_class, c.last_error_message
      from public.integration_connections c where c.id = pg_temp.kid(213)$$,
  $$values ('authentication', 'error sintetico')$$,
  'T-23: la clase y el mensaje quedan registrados');

-- Reintento (D-M06.1a-M06.2a-21): con la misma generación, la fila devuelve sin escribir.
-- El mensaje no se compara y se conserva el guardado.
select results_eq(
  $$select connection_id, status, credential_generation
      from worker_api.mark_needs_reauth(pg_temp.uid(213), pg_temp.cid(213), pg_temp.kid(213),
        0, 'authentication', 'otro error sintetico')$$,
  $$values (pg_temp.kid(213), 'needs_reauth', 0)$$,
  'T-23: el reintento con la misma generación y la misma clase devuelve la fila');

select results_eq(
  $$select c.last_error_class, c.last_error_message
      from public.integration_connections c where c.id = pg_temp.kid(213)$$,
  $$values ('authentication', 'error sintetico')$$,
  'T-23: el reintento conserva el mensaje guardado');

-- Con la misma generación, CUALQUIER clase de reauth cuenta como reintento
-- (D-M06.1a-M06.2a-21): dos workers pueden ver clases distintas para el mismo token y el
-- segundo no tiene que fallar con PX004. La clase y el mensaje guardados no cambian.
select results_eq(
  $$select connection_id, status, credential_generation
      from worker_api.mark_needs_reauth(pg_temp.uid(213), pg_temp.cid(213), pg_temp.kid(213),
        0, 'permission', 'otro error de otro worker')$$,
  $$values (pg_temp.kid(213), 'needs_reauth', 0)$$,
  'T-23: con la misma generación, otra clase de reauth también devuelve la fila');

select results_eq(
  $$select c.last_error_class, c.last_error_message
      from public.integration_connections c where c.id = pg_temp.kid(213)$$,
  $$values ('authentication', 'error sintetico')$$,
  'T-23: la clase y el mensaje guardados no cambian con la otra clase');

select throws_ok(
  $$select * from worker_api.mark_needs_reauth(pg_temp.uid(213), pg_temp.cid(213), pg_temp.kid(213),
      1, 'authentication', 'error sintetico')$$,
  'PX004', null, 'T-23: otra generación → PX004, sin importar la clase');

-- ===========================================================================
-- T-24: begin_disconnect (C-23)
-- ===========================================================================

select pg_temp.new_company(214);
select pg_temp.pending(214, 214);
select pg_temp.new_company(215);
select pg_temp.active(215, 215);
select pg_temp.new_company(216);
select pg_temp.active(216, 216);
select 1 from worker_api.mark_needs_reauth(pg_temp.uid(216), pg_temp.cid(216), pg_temp.kid(216),
  0, 'asset_access', 'error sintetico');

select results_eq(
  $$select status, credential_generation, purge_requested_at = now()
      from worker_api.begin_disconnect(pg_temp.uid(214), pg_temp.cid(214), pg_temp.kid(214))$$,
  $$values ('disconnected', 1, true)$$,
  'T-24: pendiente → disconnected, generación + 1 y marca de purga');

select results_eq(
  $$select c.external_account_id, c.currency, c.timezone
      from public.integration_connections c where c.id = pg_temp.kid(214)$$,
  $$values (null::text, null::text, null::text)$$,
  'T-24: desde pendiente queda sin metadatos, sin violar las restricciones');

select results_eq(
  $$select status, credential_generation, purge_requested_at = now()
      from worker_api.begin_disconnect(pg_temp.uid(214), pg_temp.cid(214), pg_temp.kid(214))$$,
  $$values ('disconnected', 1, true)$$,
  'T-24: repetirlo devuelve la fila sin cambios');

select results_eq(
  $$select b.status, b.credential_generation, c.external_account_id
      from worker_api.begin_disconnect(pg_temp.uid(215), pg_temp.cid(215), pg_temp.kid(215)) b
      join public.integration_connections c on c.id = b.connection_id$$,
  $$values ('disconnected', 1, 'cuenta_sintetica_0215')$$,
  'T-24: active → disconnected con los metadatos intactos');

select results_eq(
  $$select status, credential_generation, purge_requested_at is not null
      from worker_api.begin_disconnect(pg_temp.uid(216), pg_temp.cid(216), pg_temp.kid(216))$$,
  $$values ('disconnected', 1, true)$$,
  'T-24: needs_reauth → disconnected');

-- ===========================================================================
-- T-25: purge_connection (C-24)
-- ===========================================================================

select pg_temp.new_company(217);
select pg_temp.active(217, 217);
select 1 from worker_api.create_oauth_attempt(pg_temp.uid(217), pg_temp.cid(217),
  'reauth', pg_temp.h(2501), pg_temp.h(2502), '/app/integraciones',
  now() + interval '5 minutes', pg_temp.kid(217));

select throws_ok(
  $$select worker_api.purge_connection(pg_temp.uid(217), pg_temp.cid(217), pg_temp.kid(217))$$,
  'PX004', null, 'T-25: purgar una activa → PX004');

select 1 from worker_api.begin_disconnect(pg_temp.uid(217), pg_temp.cid(217), pg_temp.kid(217));

select is(
  worker_api.purge_connection(pg_temp.uid(217), pg_temp.cid(217), pg_temp.kid(217)),
  true, 'T-25: purgar una desconectada devuelve true');

select results_eq(
  $$select (select count(*)::int from public.integration_connections where id = pg_temp.kid(217)),
           (select count(*)::int from private.integration_credentials where connection_id = pg_temp.kid(217)),
           (select count(*)::int from public.oauth_attempts where company_id = pg_temp.cid(217))$$,
  $$values (0, 0, 0)$$,
  'T-25: no quedan conexión, credencial ni intentos que la esperaban');

select is(
  worker_api.purge_connection(pg_temp.uid(217), pg_temp.cid(217), pg_temp.kid(217)),
  false, 'T-25: repetir la purga devuelve false sin error');

-- ===========================================================================
-- T-26: list_pending_purges (C-25)
-- ===========================================================================

select pg_temp.new_company(218);
select pg_temp.pending(218, 2181);
select 1 from worker_api.begin_disconnect(pg_temp.uid(218), pg_temp.cid(218), pg_temp.kid(2181));
select pg_temp.pending(218, 2182);
update public.integration_connections set pending_expires_at = now() - interval '1 minute'
 where id = pg_temp.kid(2182);

select pg_temp.new_company(219);
select pg_temp.pending(219, 2191);
select 1 from worker_api.begin_disconnect(pg_temp.uid(219), pg_temp.cid(219), pg_temp.kid(2191));
select pg_temp.pending(219, 2192);
update public.integration_connections set pending_expires_at = now() - interval '1 minute'
 where id = pg_temp.kid(2192);

select results_eq(
  $$select connection_id, status, reason, has_credential
      from worker_api.list_pending_purges(pg_temp.uid(218), pg_temp.cid(218))
     order by reason$$,
  $$values (pg_temp.kid(2181), 'disconnected', 'disconnect_requested', true),
           (pg_temp.kid(2182), 'pending_selection', 'pending_expired', true)$$,
  'T-26: paso 1, la desconectada y la pendiente vencida de A');

select is_empty(
  $$select 1 from worker_api.list_pending_purges(pg_temp.uid(218), pg_temp.cid(218))
     where connection_id in (pg_temp.kid(2191), pg_temp.kid(2192))$$,
  'T-26: paso 1, ninguna fila de B');

select 1 from worker_api.begin_disconnect(pg_temp.uid(218), pg_temp.cid(218), pg_temp.kid(2182));
select worker_api.purge_connection(pg_temp.uid(218), pg_temp.cid(218), pg_temp.kid(2182));
select pg_temp.active(218, 2183);

select results_eq(
  $$select connection_id, status, reason, has_credential
      from worker_api.list_pending_purges(pg_temp.uid(218), pg_temp.cid(218))$$,
  $$values (pg_temp.kid(2181), 'disconnected', 'disconnect_requested', true)$$,
  'T-26: paso 2, solo la desconectada: ni la purgada ni la activa');

select is_empty(
  $$select 1 from worker_api.list_pending_purges(pg_temp.uid(218), pg_temp.cid(218))
     where connection_id in (pg_temp.kid(2191), pg_temp.kid(2192))$$,
  'T-26: paso 2, ninguna fila de B');

-- ===========================================================================
-- T-27: reconexión de la misma cuenta (C-26)
-- ===========================================================================

select pg_temp.new_company(220);
select pg_temp.pending(220, 2201);
select 1 from worker_api.confirm_connection(pg_temp.uid(220), pg_temp.cid(220), pg_temp.kid(2201),
  'cuenta_sintetica_2200', 'USD', 'UTC', true);
select 1 from worker_api.begin_disconnect(pg_temp.uid(220), pg_temp.cid(220), pg_temp.kid(2201));
select pg_temp.pending(220, 2202);

select throws_ok(
  $$select * from worker_api.confirm_connection(pg_temp.uid(220), pg_temp.cid(220), pg_temp.kid(2202),
      'cuenta_sintetica_2200', 'USD', 'UTC', true)$$,
  'PX007', 'praxa: la cuenta ya está vinculada',
  'T-27/T-31: la cuenta sigue en una desconectada sin purgar → PX007');

select is(
  worker_api.purge_connection(pg_temp.uid(220), pg_temp.cid(220), pg_temp.kid(2201)),
  true, 'T-27: se purga la desconectada');

select results_eq(
  $$select status from worker_api.confirm_connection(pg_temp.uid(220), pg_temp.cid(220),
      pg_temp.kid(2202), 'cuenta_sintetica_2200', 'USD', 'UTC', true)$$,
  $$values ('active')$$,
  'T-27: después de la purga, la misma cuenta se confirma');

select results_eq(
  $$select c.id, c.status::text from public.integration_connections c
     where c.company_id = pg_temp.cid(220)$$,
  $$values (pg_temp.kid(2202), 'active')$$,
  'T-27: la reconexión es una fila nueva');

-- ===========================================================================
-- T-28: rotación de claves (C-27)
-- ===========================================================================

select pg_temp.new_company(221);
select pg_temp.active(221, 221);
select pg_temp.new_company(222);
select 1 from worker_api.create_pending_connection(pg_temp.uid(222), pg_temp.cid(222),
  pg_temp.kid(222), 'negocio_sintetico', 'AAAA', 'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAA==', 2, 'system_user', 'app_sintetica', '{ads_read}', null);

select results_eq(
  $$select key_version, credential_count
      from worker_api.count_credentials_by_key_version() order by 1$$,
  $$select k.key_version, count(*) from private.integration_credentials k group by 1 order by 1$$,
  'T-28: los conteos son los de todas las empresas');

select ok(
  (select bool_and(credential_count >= 1) and count(*) >= 2
     from worker_api.count_credentials_by_key_version() where key_version in (1, 2)),
  'T-28: con credenciales de dos empresas, aparecen las versiones 1 y 2');

select is(
  (select p.proargnames from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'worker_api' and p.proname = 'count_credentials_by_key_version'),
  array['key_version', 'credential_count'],
  'T-28: devuelve solo key_version y credential_count');

create temp table kv_before as
select key_version, credential_count from worker_api.count_credentials_by_key_version();

select throws_ok(
  $$select * from worker_api.rewrap_credential(pg_temp.uid(221), pg_temp.cid(221), pg_temp.kid(221),
      0, 2, 'BBBB', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 2)$$,
  'PX008', 'praxa: la versión de clave cambió',
  'T-28/T-31: versión de clave esperada distinta de la guardada → PX008');

select throws_ok(
  $$select * from worker_api.rewrap_credential(pg_temp.uid(221), pg_temp.cid(221), pg_temp.kid(221),
      7, 1, 'BBBB', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 2)$$,
  'PX006', null, 'T-28: generación distinta → PX006');

select results_eq(
  $$select connection_id, key_version
      from worker_api.rewrap_credential(pg_temp.uid(221), pg_temp.cid(221), pg_temp.kid(221),
        0, 1, 'BBBB', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 2)$$,
  $$values (pg_temp.kid(221), 2)$$,
  'T-28: el recifrado cambia la versión de clave');

select results_eq(
  $$select coalesce((select credential_count from worker_api.count_credentials_by_key_version()
                      where key_version = 1), 0)
           - coalesce((select credential_count from kv_before where key_version = 1), 0),
           coalesce((select credential_count from worker_api.count_credentials_by_key_version()
                      where key_version = 2), 0)
           - coalesce((select credential_count from kv_before where key_version = 2), 0)$$,
  $$values (-1::bigint, 1::bigint)$$,
  'T-28: después de recifrar, una credencial pasa de la versión 1 a la 2');

select results_eq(
  $$select k.ciphertext, k.key_version, c.credential_generation
      from private.integration_credentials k
      join public.integration_connections c on c.id = k.connection_id
     where k.connection_id = pg_temp.kid(221)$$,
  $$values ('BBBB', 2, 0)$$,
  'T-28: cambia solo el material y la versión; la generación no');

-- Reintento (D-M06.1a-M06.2a-20): el mismo recifrado ya aplicado (misma versión esperada
-- y el mismo material nuevo) devuelve la fila en vez de PX008.
select results_eq(
  $$select connection_id, key_version
      from worker_api.rewrap_credential(pg_temp.uid(221), pg_temp.cid(221), pg_temp.kid(221),
        0, 1, 'BBBB', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 2)$$,
  $$values (pg_temp.kid(221), 2)$$,
  'T-28: el reintento idéntico devuelve la fila ya recifrada');

select throws_ok(
  $$select * from worker_api.rewrap_credential(pg_temp.uid(221), pg_temp.cid(221), pg_temp.kid(221),
      0, 1, 'DDDD', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 2)$$,
  'PX008', null, 'T-28: misma versión esperada con otro material → PX008, no es un reintento');

-- La versión nueva tiene que ser posterior a la guardada (D-M06.1a-M06.2a-15).
select throws_ok(
  $$select * from worker_api.rewrap_credential(pg_temp.uid(221), pg_temp.cid(221), pg_temp.kid(221),
      0, 2, 'CCCC', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 2)$$,
  '22023', 'praxa: argumento inválido', 'T-28: versión nueva igual a la guardada → 22023');

select throws_ok(
  $$select * from worker_api.rewrap_credential(pg_temp.uid(221), pg_temp.cid(221), pg_temp.kid(221),
      0, 2, 'CCCC', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1)$$,
  '22023', null, 'T-28: versión nueva menor que la guardada → 22023');

-- ===========================================================================
-- T-29: transiciones no declaradas (C-28)
-- ===========================================================================

select pg_temp.new_company(223);
select pg_temp.pending(223, 223);
select pg_temp.new_company(224);
select pg_temp.active(224, 224);
select 1 from worker_api.mark_needs_reauth(pg_temp.uid(224), pg_temp.cid(224), pg_temp.kid(224),
  0, 'user_action', 'error sintetico');
select pg_temp.new_company(225);
select pg_temp.active(225, 225);
select pg_temp.new_company(226);
select pg_temp.active(226, 226);
select 1 from worker_api.begin_disconnect(pg_temp.uid(226), pg_temp.cid(226), pg_temp.kid(226));
insert into public.oauth_attempts (id, company_id, actor_user_id, purpose, expected_connection_id,
  expected_generation, state_hash, browser_binding_hash, return_path, expires_at, consumed_at)
values (pg_temp.aid(2261), pg_temp.cid(226), pg_temp.uid(226), 'reauth', pg_temp.kid(226), 1,
        pg_temp.h(2261), pg_temp.h(2262), '/app/integraciones', now() + interval '5 minutes', now());

select throws_ok(
  $$select * from worker_api.mark_needs_reauth(pg_temp.uid(223), pg_temp.cid(223), pg_temp.kid(223),
      0, 'authentication', 'error sintetico')$$,
  'PX004', null, 'T-29: pending_selection → needs_reauth → PX004');

-- needs_reauth → needs_reauth con la MISMA generación ya no es una transición: es un
-- reintento (D-M06.1a-M06.2a-21), aunque la clase que llega ahora sea otra. Devuelve la
-- fila y conserva la clase y el mensaje originales.
select results_eq(
  $$select connection_id, status, credential_generation
      from worker_api.mark_needs_reauth(pg_temp.uid(224), pg_temp.cid(224), pg_temp.kid(224),
        0, 'authentication', 'otro error sintetico')$$,
  $$values (pg_temp.kid(224), 'needs_reauth', 0)$$,
  'T-29: needs_reauth → needs_reauth con la misma generación devuelve la fila');

select results_eq(
  $$select c.last_error_class, c.last_error_message
      from public.integration_connections c where c.id = pg_temp.kid(224)$$,
  $$values ('user_action', 'error sintetico')$$,
  'T-29: la clase y el mensaje originales no cambian con la otra clase');

select throws_ok(
  $$select * from worker_api.confirm_connection(pg_temp.uid(224), pg_temp.cid(224), pg_temp.kid(224),
      'cuenta_sintetica_0224', 'USD', 'UTC', true)$$,
  'PX004', null, 'T-29: needs_reauth → active por confirm_connection → PX004');

select throws_ok(
  $$select * from worker_api.confirm_connection(pg_temp.uid(225), pg_temp.cid(225), pg_temp.kid(225),
      'cuenta_sintetica_9225', 'USD', 'UTC', true)$$,
  'PX004', null, 'T-29: active → active por confirm_connection con otra cuenta → PX004');

select throws_ok(
  $$select * from worker_api.confirm_connection(pg_temp.uid(226), pg_temp.cid(226), pg_temp.kid(226),
      'cuenta_sintetica_0226', 'USD', 'UTC', true)$$,
  'PX004', null, 'T-29: disconnected → active por confirm_connection → PX004');

select throws_ok(
  $$select * from worker_api.replace_credential(pg_temp.uid(226), pg_temp.cid(226), pg_temp.kid(226),
      pg_temp.aid(2261), 'BBBB', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 2,
      'system_user', 'app_sintetica', '{ads_read}', null)$$,
  'PX004', null, 'T-29: disconnected → active por replace_credential → PX004');

select throws_ok(
  $$select * from worker_api.mark_needs_reauth(pg_temp.uid(226), pg_temp.cid(226), pg_temp.kid(226),
      1, 'authentication', 'error sintetico')$$,
  'PX004', null, 'T-29: disconnected → needs_reauth → PX004');

-- ===========================================================================
-- T-30: actor no miembro, actor nulo y empresa nula en las once funciones (C-16)
-- ===========================================================================

select pg_temp.new_company(227);
select pg_temp.active(227, 227);
select pg_temp.new_user(228);

create temp table unauthorized_calls as
with templates(fn, sql) as (
  values
    ('create_oauth_attempt', $t$select * from worker_api.create_oauth_attempt(%1$s, %2$s, 'initial', pg_temp.h(3001), pg_temp.h(3002), '/app/integraciones', now() + interval '5 minutes')$t$),
    ('consume_oauth_attempt', $t$select * from worker_api.consume_oauth_attempt(%1$s, %2$s, pg_temp.h(3001), pg_temp.h(3002))$t$),
    ('create_pending_connection', $t$select * from worker_api.create_pending_connection(%1$s, %2$s, pg_temp.kid(3003), 'negocio_sintetico', 'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica', '{ads_read}', null)$t$),
    ('get_credential', $t$select * from worker_api.get_credential(%1$s, %2$s, pg_temp.kid(227))$t$),
    ('confirm_connection', $t$select * from worker_api.confirm_connection(%1$s, %2$s, pg_temp.kid(227), 'cuenta_sintetica_0227', 'USD', 'UTC', true)$t$),
    ('replace_credential', $t$select * from worker_api.replace_credential(%1$s, %2$s, pg_temp.kid(227), pg_temp.aid(3004), 'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica', '{ads_read}', null)$t$),
    ('mark_needs_reauth', $t$select * from worker_api.mark_needs_reauth(%1$s, %2$s, pg_temp.kid(227), 0, 'authentication', 'error sintetico')$t$),
    ('begin_disconnect', $t$select * from worker_api.begin_disconnect(%1$s, %2$s, pg_temp.kid(227))$t$),
    ('purge_connection', $t$select worker_api.purge_connection(%1$s, %2$s, pg_temp.kid(227))$t$),
    ('list_pending_purges', $t$select * from worker_api.list_pending_purges(%1$s, %2$s)$t$),
    ('rewrap_credential', $t$select * from worker_api.rewrap_credential(%1$s, %2$s, pg_temp.kid(227), 0, 1, 'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 2)$t$)
),
actors(label, actor, company) as (
  values
    ('actor no miembro', 'pg_temp.uid(228)', 'pg_temp.cid(227)'),
    ('actor nulo', 'null::uuid', 'pg_temp.cid(227)'),
    ('empresa nula', 'pg_temp.uid(227)', 'null::uuid')
)
select t.fn || ' / ' || a.label as label,
       (select e.sqlstate from pg_temp.error_of(format(t.sql, a.actor, a.company)) e) as sqlstate
  from templates t cross join actors a;

select is_empty(
  $$select label, sqlstate from unauthorized_calls where sqlstate is distinct from 'PX001'$$,
  'T-30: ninguna llamada no autorizada da algo distinto de PX001');

select is(
  (select count(*)::int from unauthorized_calls where sqlstate = 'PX001'),
  33, 'T-30: las once funciones × tres casos dan PX001');

-- ===========================================================================
-- T-39: purga de intentos en create_oauth_attempt (C-37)
-- ===========================================================================

select pg_temp.new_company(229);
select pg_temp.active(229, 229);
select pg_temp.new_company(230);

insert into public.oauth_attempts (id, company_id, actor_user_id, purpose, state_hash,
  browser_binding_hash, return_path, created_at, expires_at, consumed_at)
values
  -- vencido sin consumir: se purga
  (pg_temp.aid(3901), pg_temp.cid(229), pg_temp.uid(229), 'initial', pg_temp.h(3901), pg_temp.h(3911),
   '/app/integraciones', now() - interval '15 minutes', now() - interval '5 minutes', null),
  -- consumido hace 11 minutos: se purga
  (pg_temp.aid(3902), pg_temp.cid(229), pg_temp.uid(229), 'initial', pg_temp.h(3902), pg_temp.h(3912),
   '/app/integraciones', now() - interval '20 minutes', now() - interval '12 minutes',
   now() - interval '11 minutes'),
  -- consumido hace exactamente 10 minutos: se conserva
  (pg_temp.aid(3903), pg_temp.cid(229), pg_temp.uid(229), 'initial', pg_temp.h(3903), pg_temp.h(3913),
   '/app/integraciones', now() - interval '15 minutes', now() - interval '6 minutes',
   now() - interval '10 minutes'),
  -- consumido hace 2 minutos y ya vencido: se conserva
  (pg_temp.aid(3904), pg_temp.cid(229), pg_temp.uid(229), 'initial', pg_temp.h(3904), pg_temp.h(3914),
   '/app/integraciones', now() - interval '11 minutes', now() - interval '1 minute',
   now() - interval '2 minutes'),
  -- vigente: se conserva
  (pg_temp.aid(3905), pg_temp.cid(229), pg_temp.uid(229), 'initial', pg_temp.h(3905), pg_temp.h(3915),
   '/app/integraciones', now() - interval '1 minute', now() + interval '5 minutes', null),
  -- vencido de otra empresa: no se toca
  (pg_temp.aid(3906), pg_temp.cid(230), pg_temp.uid(230), 'initial', pg_temp.h(3906), pg_temp.h(3916),
   '/app/integraciones', now() - interval '15 minutes', now() - interval '5 minutes', null);

select throws_ok(
  $$select * from worker_api.create_oauth_attempt(pg_temp.uid(229), pg_temp.cid(229),
      'initial', pg_temp.h(3921), pg_temp.h(3922), '/app/integraciones', now() + interval '5 minutes')$$,
  'PX003', null, 'T-39: una llamada que termina en PX003');

select is(
  (select count(*)::int from public.oauth_attempts where company_id = pg_temp.cid(229)),
  5, 'T-39: la llamada fallida no purgó nada');

select results_eq(
  $$select purpose from worker_api.create_oauth_attempt(pg_temp.uid(229), pg_temp.cid(229),
      'reauth', pg_temp.h(3923), pg_temp.h(3924), '/app/integraciones',
      now() + interval '5 minutes', pg_temp.kid(229))$$,
  $$values ('reauth')$$,
  'T-39: una llamada válida');

select results_eq(
  $$select id from public.oauth_attempts
     where company_id = pg_temp.cid(229) and id in (pg_temp.aid(3901), pg_temp.aid(3902),
       pg_temp.aid(3903), pg_temp.aid(3904), pg_temp.aid(3905))
     order by id$$,
  $$values (pg_temp.aid(3903)), (pg_temp.aid(3904)), (pg_temp.aid(3905))$$,
  'T-39: quedan el consumido hace 10 minutos, el consumido hace 2 y el vigente');

select is(
  (select count(*)::int from public.oauth_attempts where company_id = pg_temp.cid(229)),
  4, 'T-39: más el intento nuevo');

select is(
  (select count(*)::int from public.oauth_attempts where id = pg_temp.aid(3906)),
  1, 'T-39: el vencido de otra empresa sigue');

-- ===========================================================================
-- T-45 a T-47: errores sin DETAIL ni HINT (C-35)
-- ===========================================================================

select pg_temp.new_company(231);

select results_eq(
  $$select sqlstate, message, coalesce(detail, ''), coalesce(hint, '')
      from pg_temp.error_of($q$select * from worker_api.create_oauth_attempt(pg_temp.uid(231),
        pg_temp.cid(231), 'initial', null, pg_temp.h(4502), '/app/integraciones',
        now() + interval '5 minutes')$q$)$$,
  $$values ('22023', 'praxa: argumento inválido', '', '')$$,
  'T-45: p_state_hash nulo → 22023 fijo, sin DETAIL ni HINT');

select results_eq(
  $$select sqlstate, message, coalesce(detail, ''), coalesce(hint, '')
      from pg_temp.error_of($q$select * from worker_api.create_oauth_attempt(pg_temp.uid(231),
        pg_temp.cid(231), 'initial', pg_temp.h(4501), pg_temp.h(4502), '/app/integraciones',
        null)$q$)$$,
  $$values ('22023', 'praxa: argumento inválido', '', '')$$,
  'T-45: p_expires_at nulo → 22023 fijo, sin DETAIL ni HINT');

select results_eq(
  $$select sqlstate, message, coalesce(detail, ''), coalesce(hint, '')
      from pg_temp.error_of($q$select * from worker_api.create_pending_connection(pg_temp.uid(231),
        pg_temp.cid(231), pg_temp.kid(231), 'negocio_sintetico', null, 'AAAAAAAAAAAAAAAA',
        'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica', '{ads_read}', null)$q$)$$,
  $$values ('22023', 'praxa: argumento inválido', '', '')$$,
  'T-45: p_ciphertext nulo → 22023 fijo, sin DETAIL ni HINT');

select results_eq(
  $$select sqlstate, message, coalesce(detail, ''), coalesce(hint, '')
      from pg_temp.error_of($q$select * from worker_api.create_pending_connection(pg_temp.uid(231),
        pg_temp.cid(231), pg_temp.kid(231), null, 'AAAA', 'AAAAAAAAAAAAAAAA',
        'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica', '{ads_read}', null)$q$)$$,
  $$values ('22023', 'praxa: argumento inválido', '', '')$$,
  'T-45: p_client_business_id nulo → 22023 fijo, sin DETAIL ni HINT (A-01)');

select lives_ok(
  $$select * from worker_api.create_oauth_attempt(pg_temp.uid(231), pg_temp.cid(231),
      'initial', pg_temp.h(4601), pg_temp.h(4602), '/app/integraciones', now() + interval '5 minutes')$$,
  'T-46: primer intento con el state');

select results_eq(
  $$select sqlstate, message, coalesce(detail, ''), coalesce(hint, '')
      from pg_temp.error_of($q$select * from worker_api.create_oauth_attempt(pg_temp.uid(231),
        pg_temp.cid(231), 'initial', pg_temp.h(4601), pg_temp.h(4603), '/app/integraciones',
        now() + interval '5 minutes')$q$)$$,
  $$values ('22023', 'praxa: argumento inválido', '', '')$$,
  'T-46: state_hash repetido → 22023 fijo, sin DETAIL ni HINT');

select ok(
  (select position(pg_temp.h(4601) in coalesce(message, '') || coalesce(detail, '') || coalesce(hint, '')) = 0
     from pg_temp.error_of($q$select * from worker_api.create_oauth_attempt(pg_temp.uid(231),
       pg_temp.cid(231), 'initial', pg_temp.h(4601), pg_temp.h(4603), '/app/integraciones',
       now() + interval '5 minutes')$q$)),
  'T-46: el hash no aparece en ningún campo del error');

select pg_temp.new_company(232);
select pg_temp.pending(232, 232);
select 1 from worker_api.begin_disconnect(pg_temp.uid(232), pg_temp.cid(232), pg_temp.kid(232));

select results_eq(
  $$select sqlstate, message, coalesce(detail, ''), coalesce(hint, '')
      from pg_temp.error_of($q$select * from worker_api.create_pending_connection(pg_temp.uid(232),
        pg_temp.cid(232), pg_temp.kid(232), 'negocio_sintetico', 'AAAA', 'AAAAAAAAAAAAAAAA',
        'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica', '{ads_read}', null)$q$)$$,
  $$values ('PX001', 'praxa: operación no autorizada', '', '')$$,
  'T-47/T-31: id de una conexión propia existente → PX001 fijo, sin DETAIL ni HINT');

select is(
  (select count(*)::int from public.integration_connections where company_id = pg_temp.cid(232)),
  1, 'T-47: no se creó ninguna fila');

select * from finish();
rollback;
