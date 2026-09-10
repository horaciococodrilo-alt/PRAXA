-- PRAXA — Ciclo de vida del contexto: inmutabilidad, invariantes y activación.

begin;

create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'duenio.a@praxa.test', 'x', now(), now(), now());

insert into public.companies (id, name, owner_id)
values ('c0a00000-0000-4000-8000-00000000000a', 'Empresa A',
        'aaaaaaaa-0000-4000-8000-000000000001');

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Borrador incompleto: guardar y retomar no exige integridad total
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.start_context_draft('1.0.0')$$,
  'start_context_draft crea un borrador vacío cuando no hay versión activa'
);

select is(
  (select version from public.company_context_versions where status = 'draft'),
  null,
  'Un borrador tiene version NULL'
);

select is(
  (select count(*)::int from public.company_context_versions where status = 'draft'),
  1,
  'Existe exactamente un borrador'
);

-- Idempotencia: volver a llamar devuelve el mismo borrador, no crea otro.
select is(
  (select id from public.start_context_draft('1.0.0')),
  (select id from public.company_context_versions where status = 'draft'),
  'start_context_draft es idempotente: devuelve el borrador existente'
);

select is(
  (select count(*)::int from public.company_context_versions where status = 'draft'),
  1,
  'Sigue habiendo un solo borrador tras la segunda llamada'
);

-- ---------------------------------------------------------------------------
-- La integridad se valida al activar, no al guardar
-- ---------------------------------------------------------------------------

-- has_defined_objective = true sin objetivos: se puede GUARDAR...
select lives_ok(
  $$update public.company_context_versions
       set has_defined_objective = true
     where status = 'draft'$$,
  'Un borrador puede quedar incompleto: guardar no exige objetivos'
);

-- ...pero no se puede ACTIVAR.
select throws_ok(
  $$select public.activate_context_draft(
      (select id from public.company_context_versions where status = 'draft'))$$,
  '23514',
  null,
  'Activar con objetivo declarado y cero objetivos: rechazado'
);

-- "sin objetivo definido" no puede convivir con objetivos.
update public.company_context_versions
   set has_defined_objective = false
 where status = 'draft';

-- Desde 0007 las listas se escriben por RPC, que es la vía que toma el cerrojo.
select public.replace_draft_objectives(
  (select id from public.company_context_versions where status = 'draft'),
  '[{"kind":"primary","title":"Objetivo contradictorio"}]'::jsonb);

select throws_ok(
  $$select public.activate_context_draft(
      (select id from public.company_context_versions where status = 'draft'))$$,
  '23514',
  null,
  'Activar con "sin objetivo definido" y objetivos cargados: rechazado'
);

-- Dos objetivos principales: lo frena el índice único, antes de llegar a activar.
select throws_ok(
  $$select public.replace_draft_objectives(
      (select id from public.company_context_versions where status = 'draft'),
      '[{"kind":"primary","title":"Uno"},{"kind":"primary","title":"Dos"}]'::jsonb)$$,
  '23505',
  null,
  'Dos objetivos principales en la misma versión: rechazado'
);

-- Sistemas duplicados dentro de la misma versión.
select public.replace_draft_systems(
  (select id from public.company_context_versions where status = 'draft'),
  '[{"system_key":"shopify"}]'::jsonb);

select throws_ok(
  $$select public.replace_draft_systems(
      (select id from public.company_context_versions where status = 'draft'),
      '[{"system_key":"shopify"},{"system_key":"shopify"}]'::jsonb)$$,
  '23505',
  null,
  'Sistema duplicado en la misma versión: rechazado'
);

-- ---------------------------------------------------------------------------
-- Activación
-- ---------------------------------------------------------------------------

update public.company_context_versions
   set has_defined_objective = true
 where status = 'draft';

select lives_ok(
  $$select public.activate_context_draft(
      (select id from public.company_context_versions where status = 'draft'))$$,
  'Activar un borrador coherente: aceptado'
);

select is(
  (select version from public.company_context_versions where status = 'active'),
  1,
  'La primera versión activa recibe el número 1'
);

select is(
  (select count(*)::int from public.company_context_versions where status = 'draft'),
  0,
  'Ya no queda ningún borrador tras activar'
);

-- Idempotencia de la activación.
select is(
  (select version from public.activate_context_draft(
     (select id from public.company_context_versions where status = 'active'))),
  1,
  'Activar una versión ya activa es idempotente y no la renumera'
);

-- ---------------------------------------------------------------------------
-- Una versión activa es inmutable
-- ---------------------------------------------------------------------------

select throws_ok(
  $$update public.company_context_versions
       set additional_context = 'editado en caliente'
     where status = 'active'$$,
  '42501',
  null,
  'Editar una versión activa: rechazado'
);

select throws_ok(
  $$delete from public.company_objectives
     where context_version_id =
       (select id from public.company_context_versions where status = 'active')$$,
  '42501',
  null,
  'Borrar objetivos directamente: sin privilegio'
);

select throws_ok(
  $$select public.replace_draft_objectives(
      (select id from public.company_context_versions where status = 'active'),
      '[{"kind":"primary","title":"Agregado tarde"}]'::jsonb)$$,
  '42501',
  null,
  'Editar los objetivos de una versión activa por RPC: rechazado'
);

-- ---------------------------------------------------------------------------
-- Editar clona: la versión vigente no se toca
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.start_context_draft('1.0.0')$$,
  'start_context_draft clona la versión activa a un borrador nuevo'
);

select is(
  (select count(*)::int from public.company_objectives
    where context_version_id =
      (select id from public.company_context_versions where status = 'draft')),
  1,
  'El clon arrastra los objetivos de la versión activa'
);

select is(
  (select count(*)::int from public.company_systems
    where context_version_id =
      (select id from public.company_context_versions where status = 'draft')),
  1,
  'El clon arrastra los sistemas de la versión activa'
);

-- Activar el clon reemplaza a la anterior, que queda como superseded.
select public.activate_context_draft(
  (select id from public.company_context_versions where status = 'draft'));

select results_eq(
  $$select version, status::text from public.company_context_versions
     order by version$$,
  $$values (1, 'superseded'), (2, 'active')$$,
  'Tras activar el clon: la v1 queda reemplazada y la v2 es la vigente'
);

select * from finish();
rollback;
