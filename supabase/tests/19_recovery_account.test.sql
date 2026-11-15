-- PRAXA — ¿Un correo tiene cuenta? (H-E1-259, 0025). Datos sintéticos.
--
-- Riesgo aceptado por el usuario: «olvidé mi contraseña» avisa si el correo no tiene cuenta.
-- La función solo devuelve un booleano, la ejecuta solo el rol de C (el servidor) y no está
-- expuesta a anon ni a authenticated por la Data API.

begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create function pg_temp.sqlstate_as(p_role text, p_sql text) returns text language plpgsql as $f$
begin
  execute format('set local role %I', p_role);
  execute p_sql;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlstate;
end $f$;

create function pg_temp.sqlstate_of(p_sql text) returns text language plpgsql as $f$
begin execute p_sql; return null;
exception when others then return sqlstate;
end $f$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('aaaaaaaa-0000-4000-8000-000000000191', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'recupera.uno@praxa.test', 'x', now(), now(), now());

select has_function('worker_api', 'email_has_account', array['text'],
  'H-E1-259: worker_api.email_has_account(text) existe');
select results_eq(
  $$select p.prosecdef, p.proconfig = array['search_path=""'], pg_catalog.format_type(p.prorettype, null)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'worker_api' and p.proname = 'email_has_account'$$,
  $$values (true, true, 'boolean'::text)$$,
  'H-E1-259: SECURITY DEFINER, search_path vacío y solo un booleano');
select is_empty(
  $$select r.name from unnest(array['anon','authenticated','service_role','public']) r(name)
     where r.name <> 'public' and has_function_privilege(r.name, 'worker_api.email_has_account(text)', 'EXECUTE')$$,
  'H-E1-259: anon, authenticated y service_role no la ejecutan');
select ok(has_function_privilege('praxa_integrations', 'worker_api.email_has_account(text)', 'EXECUTE'),
  'H-E1-259: el rol de C la ejecuta');
select is(pg_temp.sqlstate_as('anon', $$select worker_api.email_has_account('recupera.uno@praxa.test')$$),
  '42501', 'H-E1-259: anon recibe 42501');

select is(worker_api.email_has_account('recupera.uno@praxa.test'), true,
  'H-E1-259: un correo con cuenta da true');
select is(worker_api.email_has_account('  Recupera.UNO@praxa.test '), true,
  'H-E1-259: sin distinguir mayúsculas ni espacios de los extremos');
select is(worker_api.email_has_account('nadie@praxa.test'), false,
  'H-E1-259: un correo sin cuenta da false');
select is(pg_temp.sqlstate_of($$select worker_api.email_has_account(null)$$), '22023',
  'H-E1-259: un correo nulo es argumento inválido');
select is(pg_temp.sqlstate_of($$select worker_api.email_has_account('sin-arroba')$$), '22023',
  'H-E1-259: un texto sin arroba es argumento inválido');
select is(pg_temp.sqlstate_of(format($$select worker_api.email_has_account(%L)$$,
  repeat('a', 320) || '@praxa.test')), '22023', 'H-E1-259: un correo de más de 320 caracteres es inválido');

select * from finish();
rollback;
