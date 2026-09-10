-- PRAXA — Regresión de la migración 0006.
--
-- Cada bloque reproduce un agujero real que existía antes: las reglas vivían en las RPC,
-- y `authenticated` también tiene UPDATE directo sobre las tablas, así que bastaba con
-- llamar a la Data API para saltearlas. Todas las pruebas corren como usuario normal.

begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

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
-- 1. No se puede activar un borrador incoherente con un UPDATE directo
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.start_context_draft('1.0.0')$$,
  'se abre un borrador'
);

update public.company_context_versions
   set has_defined_objective = true
 where status = 'draft';

-- Sin objetivos cargados. La RPC lo rechazaba; el UPDATE directo lo permitía.
select throws_ok(
  $$update public.company_context_versions
       set status = 'active', version = 1, activated_at = now()
     where status = 'draft'$$,
  '23514',
  null,
  'UPDATE directo a activo con objetivo declarado y cero objetivos: rechazado'
);

select is(
  (select count(*)::int from public.company_context_versions where status = 'active'),
  0,
  'no quedó ninguna versión activa tras el intento'
);

-- El caso simétrico: "sin objetivo definido" con objetivos cargados.
update public.company_context_versions set has_defined_objective = false where status = 'draft';

insert into public.company_objectives (company_id, context_version_id, kind, title)
values ('c0a00000-0000-4000-8000-00000000000a',
        (select id from public.company_context_versions where status = 'draft'),
        'primary', 'Objetivo contradictorio');

select throws_ok(
  $$update public.company_context_versions
       set status = 'active', version = 1, activated_at = now()
     where status = 'draft'$$,
  '23514',
  null,
  'UPDATE directo a activo con "sin objetivo definido" y objetivos: rechazado'
);

-- ---------------------------------------------------------------------------
-- 2. La numeración y el sello los asigna la base, no el llamador
-- ---------------------------------------------------------------------------

update public.company_context_versions set has_defined_objective = true where status = 'draft';

-- El usuario pide version = 999; la base impone la que corresponde.
update public.company_context_versions
   set status = 'active', version = 999, activated_at = '2000-01-01'
 where status = 'draft';

select is(
  (select version from public.company_context_versions where status = 'active'),
  1,
  'la numeración la asigna la base, no el número que mandó el cliente'
);

select ok(
  (select activated_at from public.company_context_versions where status = 'active')
    > '2020-01-01'::timestamptz,
  'la fecha de activación la sella la base, no el cliente'
);

-- ---------------------------------------------------------------------------
-- 3. Una versión activa no puede perder filas hijas
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.start_context_draft('1.0.0')$$,
  'se abre un borrador nuevo clonando la versión activa'
);

-- El clon trae su propia copia del objetivo; se agrega un sistema para probar ambos.
insert into public.company_systems (company_id, context_version_id, system_key)
values ('c0a00000-0000-4000-8000-00000000000a',
        (select id from public.company_context_versions where status = 'draft'), 'shopify');

-- Mover un objetivo DESDE la versión activa HACIA el borrador: el destino es editable,
-- pero el origen es inmutable. Antes pasaba; ahora se rechaza.
select throws_ok(
  $$update public.company_objectives
       set context_version_id =
         (select id from public.company_context_versions where status = 'draft')
     where context_version_id =
         (select id from public.company_context_versions where status = 'active')$$,
  '42501',
  null,
  'mover un objetivo desde una versión activa hacia un borrador: rechazado'
);

select is(
  (select count(*)::int from public.company_objectives o
     join public.company_context_versions v on v.id = o.context_version_id
    where v.status = 'active'),
  1,
  'la versión activa conserva su objetivo'
);

select throws_ok(
  $$update public.company_systems
       set context_version_id =
         (select id from public.company_context_versions where status = 'active')
     where context_version_id =
         (select id from public.company_context_versions where status = 'draft')$$,
  '42501',
  null,
  'mover un sistema hacia una versión activa: rechazado'
);

-- Tampoco se puede reasignar entre borradores, ni cambiar de empresa.
select throws_ok(
  $$update public.company_objectives
       set company_id = '00000000-0000-4000-8000-000000000000'
     where context_version_id =
         (select id from public.company_context_versions where status = 'draft')$$,
  '42501',
  null,
  'cambiar la empresa de una fila hija: rechazado'
);

-- Editar el contenido de una fila hija de un borrador sigue permitido.
select lives_ok(
  $$update public.company_objectives
       set title = 'Objetivo editado'
     where context_version_id =
         (select id from public.company_context_versions where status = 'draft')$$,
  'editar una fila hija de un borrador sigue permitido'
);

-- Y borrar filas hijas de la versión activa sigue prohibido.
select throws_ok(
  $$delete from public.company_objectives
     where context_version_id =
         (select id from public.company_context_versions where status = 'active')$$,
  '42501',
  null,
  'borrar objetivos de una versión activa: rechazado'
);

-- ---------------------------------------------------------------------------
-- 4. Las RPC de edición exigen borrador
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.replace_draft_objectives(
      (select id from public.company_context_versions where status = 'active'),
      '[]'::jsonb)$$,
  '42501',
  null,
  'replace_draft_objectives sobre una versión activa: rechazado'
);

select throws_ok(
  $$select public.replace_draft_systems(
      (select id from public.company_context_versions where status = 'active'),
      '[]'::jsonb)$$,
  '42501',
  null,
  'replace_draft_systems sobre una versión activa: rechazado'
);

-- ---------------------------------------------------------------------------
-- 5. El camino correcto sigue funcionando
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.activate_context_draft(
      (select id from public.company_context_versions where status = 'draft'))$$,
  'activar el borrador coherente por la RPC: aceptado'
);

select results_eq(
  $$select version from public.company_context_versions order by version$$,
  $$values (1), (2)$$,
  'la numeración quedó consecutiva: 1 reemplazada y 2 vigente'
);

select * from finish();
rollback;
