-- PRAXA — Alta de empresa: idempotencia y no escalada de permisos.

begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'duenio.a@praxa.test', 'x', now(), now(), now()),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'duenio.b@praxa.test', 'x', now(), now(), now());

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Alta idempotente
-- ---------------------------------------------------------------------------

select is(
  (select name from public.create_company_for_current_user('Mi Tienda')),
  'Mi Tienda',
  'create_company_for_current_user crea la empresa'
);

select is(
  (select count(*)::int from public.companies),
  1,
  'Se creó exactamente una empresa'
);

select is(
  (select owner_id from public.companies),
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
  'El dueño se deriva de auth.uid(), no de un parámetro del cliente'
);

select is(
  (select count(*)::int from public.company_members
    where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and role = 'owner'),
  1,
  'La membresía owner se creó en la misma transacción, por trigger'
);

-- Reintento con OTRO nombre: no duplica y no pisa el nombre original.
select is(
  (select name from public.create_company_for_current_user('Nombre Distinto')),
  'Mi Tienda',
  'Un reintento devuelve la empresa existente sin sobrescribir el nombre'
);

select is(
  (select count(*)::int from public.companies),
  1,
  'El reintento no duplicó la empresa'
);

select is(
  (select count(*)::int from public.company_members),
  1,
  'El reintento no duplicó la membresía'
);

-- ---------------------------------------------------------------------------
-- No se puede eludir la unicidad ni suplantar al dueño
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.companies (name, owner_id)
    values ('Segunda empresa', 'aaaaaaaa-0000-4000-8000-000000000001')$$,
  '23505',
  null,
  'Una cuenta no puede tener dos empresas en este MVP'
);

select throws_ok(
  $$insert into public.companies (name, owner_id)
    values ('A nombre de otro', 'bbbbbbbb-0000-4000-8000-000000000002')$$,
  '42501',
  null,
  'No se puede crear una empresa a nombre de otro usuario'
);

select throws_ok(
  $$update public.companies
       set owner_id = 'bbbbbbbb-0000-4000-8000-000000000002'
     where owner_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'No se puede transferir la propiedad de la empresa'
);

-- Renombrar sí está permitido para el dueño.
select lives_ok(
  $$update public.companies set name = 'Mi Tienda SRL'$$,
  'El dueño puede renombrar su empresa'
);

-- ---------------------------------------------------------------------------
-- Sin sesión
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', null, true);
set local role authenticated;

select throws_ok(
  $$select public.create_company_for_current_user('Sin identidad')$$,
  '42501',
  null,
  'Sin auth.uid() la RPC se rechaza explícitamente'
);

select * from finish();
rollback;
