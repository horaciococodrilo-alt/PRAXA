-- PRAXA — Perfil de la empresa (0013): rubro, país y moneda.

begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'perfil.a@praxa.test', 'x', now(), now(), now()),
  ('bbbbbbbb-0000-4000-8000-0000000000b2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'perfil.b@praxa.test', 'x', now(), now(), now());

select has_column('public', 'companies', 'industry', 'companies tiene industry');
select has_column('public', 'companies', 'country', 'companies tiene country');
select has_column('public', 'companies', 'currency', 'companies tiene currency');

-- Dueño A crea su empresa: el perfil arranca vacío.
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select public.create_company_for_current_user('Tienda A');

select is(
  (select row(industry, country, currency)::text from public.companies),
  '(,,)',
  'Una empresa nueva no tiene rubro, país ni moneda'
);

update public.companies
   set industry = 'Indumentaria y calzado', country = 'Argentina', currency = 'Pesos';

select is(
  (select row(industry, country, currency)::text from public.companies),
  '("Indumentaria y calzado",Argentina,Pesos)',
  'El dueño completa el perfil de su empresa'
);

select throws_ok(
  $$ update public.companies set industry = '   ' $$,
  '23514',
  null,
  'Un rubro en blanco se rechaza'
);

-- Dueño B no ve ni modifica la empresa de A.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-0000000000b2","role":"authenticated"}', true);

update public.companies set industry = 'Otro';

select is(
  (select count(*)::int from public.companies),
  0,
  'Otro usuario no ve la empresa de A'
);

reset role;

select is(
  (select industry from public.companies where name = 'Tienda A'),
  'Indumentaria y calzado',
  'El UPDATE de otro usuario no modificó el perfil de A'
);

select ok(
  not has_column_privilege('anon', 'public.companies', 'industry', 'UPDATE'),
  'anon no puede modificar el rubro'
);

select * from finish();
rollback;
