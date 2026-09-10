-- PRAXA — Aislamiento entre empresas.
--
-- Matriz completa SELECT / INSERT / UPDATE / DELETE × usuario propio / usuario de otra
-- empresa / anónimo.
--
-- Punto importante: una denegación de RLS NO siempre lanza excepción. En UPDATE y DELETE
-- las filas simplemente quedan fuera del alcance de la sentencia y se afectan cero filas,
-- en silencio. Por eso cada intento cruzado comprueba dos cosas: que afectó cero filas y
-- que el dato siguió intacto después.

begin;

create extension if not exists pgtap with schema extensions;
select plan(34);

-- Cuenta las filas que una sentencia realmente afectó.
--
-- Hace falta porque una denegación de RLS en UPDATE/DELETE no lanza excepción: la fila
-- queda fuera del alcance y se afectan cero filas, en silencio. El patrón natural
-- —un CTE modificante dentro de un subselect— no es válido en PostgreSQL ("WITH clause
-- containing a data-modifying statement must be at the top level"), así que se envuelve
-- en una función.
--
-- Es SECURITY INVOKER y vive en pg_temp: se ejecuta con el rol que la llama, así que las
-- políticas se evalúan igual que en una sentencia directa, y desaparece con el rollback.
create function pg_temp.affected(p_sql text)
returns integer
language plpgsql
as $fn$
declare
  v_rows integer;
begin
  execute p_sql;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$fn$;



-- Ejecuta una sentencia como el rol de la prueba (postgres), para poder ejercitar
-- comprobaciones que ya no son alcanzables desde `authenticated`.
-- Ojo: adentro se omite RLS, así que toda consulta debe acotarse por empresa.
create function pg_temp.as_admin(p_sql text)
returns void
language plpgsql
security definer
as $fn$
begin
  execute p_sql;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Semilla (como postgres, antes de asumir ningún rol)
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'duenio.a@praxa.test', 'x', now(), now(), now()),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'duenio.b@praxa.test', 'x', now(), now(), now());

insert into public.companies (id, name, owner_id)
values
  ('c0a00000-0000-4000-8000-00000000000a', 'Empresa A', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('c0b00000-0000-4000-8000-00000000000b', 'Empresa B', 'bbbbbbbb-0000-4000-8000-000000000002');

-- Se siembra siguiendo el ciclo real del producto: primero borrador, después los hijos,
-- y recién entonces se activa. Insertar hijos directamente en una versión ya activa lo
-- rechaza `enforce_child_parent_is_draft`, y con razón.
insert into public.company_context_versions
  (id, company_id, context_schema_version, has_defined_objective,
   problems, constraints, created_by)
values
  ('11110000-0000-4000-8000-00000000000a', 'c0a00000-0000-4000-8000-00000000000a',
   '1.0.0', true, '["problema A"]'::jsonb, '[]'::jsonb,
   'aaaaaaaa-0000-4000-8000-000000000001'),
  ('22220000-0000-4000-8000-00000000000b', 'c0b00000-0000-4000-8000-00000000000b',
   '1.0.0', true, '["problema B"]'::jsonb, '[]'::jsonb,
   'bbbbbbbb-0000-4000-8000-000000000002');

insert into public.company_objectives (id, company_id, context_version_id, kind, title)
values
  ('0b1e0000-0000-4000-8000-00000000000a', 'c0a00000-0000-4000-8000-00000000000a',
   '11110000-0000-4000-8000-00000000000a', 'primary', 'Objetivo de A'),
  ('0b1e0000-0000-4000-8000-00000000000b', 'c0b00000-0000-4000-8000-00000000000b',
   '22220000-0000-4000-8000-00000000000b', 'primary', 'Objetivo de B');

insert into public.company_systems (id, company_id, context_version_id, system_key, label)
values
  ('55500000-0000-4000-8000-00000000000a', 'c0a00000-0000-4000-8000-00000000000a',
   '11110000-0000-4000-8000-00000000000a', 'shopify', 'Shopify');

-- Con los hijos ya cargados, las versiones pasan a activas.
update public.company_context_versions
   set status = 'active', version = 1, activated_at = now()
 where id in ('11110000-0000-4000-8000-00000000000a',
              '22220000-0000-4000-8000-00000000000b');

-- Un borrador de la empresa B. Sirve para ejercitar la clave foránea compuesta: si el
-- padre estuviera activo, el trigger de inmutabilidad cortaría antes y no se llegaría a
-- probar la FK.
insert into public.company_context_versions
  (id, company_id, context_schema_version, created_by)
values ('33330000-0000-4000-8000-00000000000b', 'c0b00000-0000-4000-8000-00000000000b',
        '1.0.0', 'bbbbbbbb-0000-4000-8000-000000000002');

insert into public.reports
  (id, company_id, context_version_id, status, report_schema_version, methodology_version)
values
  ('4e400000-0000-4000-8000-00000000000a', 'c0a00000-0000-4000-8000-00000000000a',
   '11110000-0000-4000-8000-00000000000a', 'pending', '1.0.0', '1.0.0');

-- ---------------------------------------------------------------------------
-- Usuario A: ve lo suyo y nada más
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*)::int from public.companies),
  1,
  'SELECT companies: A ve exactamente una empresa'
);

select is(
  (select name from public.companies),
  'Empresa A',
  'SELECT companies: A ve la suya, no la de B'
);

select is(
  (select count(*)::int from public.companies
   where id = 'c0b00000-0000-4000-8000-00000000000b'),
  0,
  'SELECT companies: pedir explícitamente la empresa de B no devuelve nada'
);

select is(
  (select count(*)::int from public.company_members),
  1,
  'SELECT company_members: A solo ve su propia membresía'
);

select is(
  (select count(*)::int from public.company_context_versions),
  1,
  'SELECT contexto: A no ve versiones de B'
);

select is(
  (select count(*)::int from public.company_objectives),
  1,
  'SELECT objetivos: A no ve objetivos de B'
);

select is(
  (select count(*)::int from public.company_systems),
  1,
  'SELECT sistemas: A no ve sistemas de B'
);

select is(
  (select count(*)::int from public.reports),
  1,
  'SELECT reportes: A no ve reportes de B'
);

-- ---------------------------------------------------------------------------
-- Usuario B contra los datos de A: escrituras cruzadas
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);

-- UPDATE cruzado: cero filas, sin excepción.
select is(
  pg_temp.affected($sql$update public.companies set name = 'Robada por B' where id = 'c0a00000-0000-4000-8000-00000000000a'$sql$),
  0,
  'UPDATE companies ajeno: afecta cero filas'
);

select is(
  pg_temp.affected($sql$update public.company_context_versions set additional_context = 'inyectado' where id = '11110000-0000-4000-8000-00000000000a'$sql$),
  0,
  'UPDATE contexto ajeno: afecta cero filas'
);

-- Desde 0007 las listas se escriben solo por RPC: la escritura directa no tiene
-- privilegio, así que el corte llega antes que RLS, como excepción y no como cero filas.
select throws_ok(
  $$update public.company_objectives set title = 'Objetivo secuestrado'
     where id = '0b1e0000-0000-4000-8000-00000000000a'$$,
  '42501',
  null,
  'UPDATE directo de un objetivo: sin privilegio'
);

select throws_ok(
  $$delete from public.company_objectives
     where id = '0b1e0000-0000-4000-8000-00000000000a'$$,
  '42501',
  null,
  'DELETE directo de un objetivo: sin privilegio'
);

select is(
  pg_temp.affected($sql$delete from public.company_context_versions where id = '11110000-0000-4000-8000-00000000000a'$sql$),
  0,
  'DELETE contexto ajeno: afecta cero filas'
);

-- Acá el corte es anterior a RLS: `authenticated` no tiene DELETE sobre company_members,
-- así que la denegación llega como excepción de permisos, no como cero filas.
select throws_ok(
  $$delete from public.company_members
     where company_id = 'c0a00000-0000-4000-8000-00000000000a'$$,
  '42501',
  null,
  'DELETE membresía: no hay privilegio de DELETE sobre company_members'
);

-- INSERT cruzado: acá sí hay excepción, porque WITH CHECK se evalúa sobre la fila nueva.
select throws_ok(
  $$insert into public.company_context_versions
      (company_id, context_schema_version, created_by)
    values ('c0a00000-0000-4000-8000-00000000000a', '1.0.0',
            'bbbbbbbb-0000-4000-8000-000000000002')$$,
  '42501',
  null,
  'INSERT de contexto en la empresa de A: rechazado'
);

select throws_ok(
  $$insert into public.company_objectives (company_id, context_version_id, kind, title)
    values ('c0a00000-0000-4000-8000-00000000000a',
            '11110000-0000-4000-8000-00000000000a', 'secondary', 'Colado')$$,
  '42501',
  null,
  'INSERT directo de un objetivo: sin privilegio'
);

-- La FK compuesta sigue siendo la última línea: impide cruzar empresas incluso para
-- quien SÍ tiene privilegio de escritura. Se comprueba con el rol administrativo, que es
-- el único que queda con escritura directa.
select throws_ok(
  $$select pg_temp.as_admin($adm$insert into public.company_objectives
      (company_id, context_version_id, kind, title)
    values ('c0a00000-0000-4000-8000-00000000000a',
            '33330000-0000-4000-8000-00000000000b', 'secondary', 'FK cruzada')$adm$)$$,
  '23503',
  null,
  'company_id de una empresa con context_version_id de otra: lo frena la FK compuesta'
);

-- Escalada de permisos: darse membresía en la empresa de A.
select throws_ok(
  $$insert into public.company_members (company_id, user_id, role)
    values ('c0a00000-0000-4000-8000-00000000000a',
            'bbbbbbbb-0000-4000-8000-000000000002', 'owner')$$,
  '42501',
  null,
  'INSERT en company_members: no hay política que lo permita'
);

-- Mover la propia fila a otra empresa. La fila SÍ es visible para B, así que la
-- denegación llega como excepción (trigger de inmutabilidad y WITH CHECK), no como
-- cero filas.
select throws_ok(
  $$update public.company_context_versions
       set company_id = 'c0a00000-0000-4000-8000-00000000000a'
     where id = '22220000-0000-4000-8000-00000000000b'$$,
  '42501',
  null,
  'Cambiar company_id de una fila propia hacia otra empresa: rechazado'
);

-- ---------------------------------------------------------------------------
-- Anónimo: no accede a ninguna tabla del producto
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  'select count(*) from public.companies',
  '42501', null,
  'anon SELECT companies: permiso denegado'
);

select throws_ok(
  'select count(*) from public.company_members',
  '42501', null,
  'anon SELECT company_members: permiso denegado'
);

select throws_ok(
  'select count(*) from public.company_context_versions',
  '42501', null,
  'anon SELECT contexto: permiso denegado'
);

select throws_ok(
  'select count(*) from public.company_objectives',
  '42501', null,
  'anon SELECT objetivos: permiso denegado'
);

select throws_ok(
  'select count(*) from public.company_systems',
  '42501', null,
  'anon SELECT sistemas: permiso denegado'
);

select throws_ok(
  'select count(*) from public.reports',
  '42501', null,
  'anon SELECT reportes: permiso denegado'
);

select throws_ok(
  $$insert into public.companies (name, owner_id)
    values ('Anónima', 'aaaaaaaa-0000-4000-8000-000000000001')$$,
  '42501', null,
  'anon INSERT companies: permiso denegado'
);

select throws_ok(
  $$update public.companies set name = 'x'$$,
  '42501', null,
  'anon UPDATE companies: permiso denegado'
);

select throws_ok(
  $$delete from public.companies$$,
  '42501', null,
  'anon DELETE companies: permiso denegado'
);

select throws_ok(
  $$select public.create_company_for_current_user('Sin sesión')$$,
  '42501', null,
  'anon no puede ejecutar create_company_for_current_user'
);

select throws_ok(
  $$select public.start_context_draft('1.0.0')$$,
  '42501', null,
  'anon no puede ejecutar start_context_draft'
);

-- ---------------------------------------------------------------------------
-- Los datos siguieron intactos después de todos los intentos
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', null, true);

select is(
  (select name from public.companies where id = 'c0a00000-0000-4000-8000-00000000000a'),
  'Empresa A',
  'Tras los intentos cruzados, el nombre de la empresa A sigue intacto'
);

select is(
  (select title from public.company_objectives
    where id = '0b1e0000-0000-4000-8000-00000000000a'),
  'Objetivo de A',
  'Tras los intentos cruzados, el objetivo de A sigue intacto'
);

select is(
  (select additional_context from public.company_context_versions
    where id = '11110000-0000-4000-8000-00000000000a'),
  null,
  'Tras los intentos cruzados, el contexto de A no fue modificado'
);

select is(
  (select count(*)::int from public.company_members
    where company_id = 'c0a00000-0000-4000-8000-00000000000a'),
  1,
  'La empresa A sigue teniendo exactamente un miembro'
);

select * from finish();
rollback;
