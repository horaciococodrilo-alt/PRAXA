-- PRAXA — Matriz de privilegios.
--
-- RLS no reemplaza los permisos SQL. Esta prueba verifica la capa de GRANT/REVOKE por
-- separado: qué puede tocar cada rol, antes incluso de que las políticas entren en juego.
-- Es la matriz documentada en supabase/migrations/0004_grants.sql y docs/SECURITY.md.

begin;

create extension if not exists pgtap with schema extensions;
select plan(35);

-- ---------------------------------------------------------------------------
-- anon: ninguna tabla del producto
-- ---------------------------------------------------------------------------

select ok(
  not has_table_privilege('anon', 'public.companies', 'SELECT'),
  'anon no tiene SELECT sobre companies'
);
select ok(
  not has_table_privilege('anon', 'public.companies', 'INSERT'),
  'anon no tiene INSERT sobre companies'
);
select ok(
  not has_table_privilege('anon', 'public.companies', 'UPDATE'),
  'anon no tiene UPDATE sobre companies'
);
select ok(
  not has_table_privilege('anon', 'public.companies', 'DELETE'),
  'anon no tiene DELETE sobre companies'
);
select ok(
  not has_table_privilege('anon', 'public.company_members', 'SELECT'),
  'anon no tiene SELECT sobre company_members'
);
select ok(
  not has_table_privilege('anon', 'public.company_context_versions', 'SELECT'),
  'anon no tiene SELECT sobre company_context_versions'
);
select ok(
  not has_table_privilege('anon', 'public.company_objectives', 'SELECT'),
  'anon no tiene SELECT sobre company_objectives'
);
select ok(
  not has_table_privilege('anon', 'public.company_systems', 'SELECT'),
  'anon no tiene SELECT sobre company_systems'
);
select ok(
  not has_table_privilege('anon', 'public.reports', 'SELECT'),
  'anon no tiene SELECT sobre reports'
);

-- ---------------------------------------------------------------------------
-- authenticated: exactamente lo necesario
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('authenticated', 'public.companies', 'SELECT'),
  'authenticated tiene SELECT sobre companies'
);
select ok(
  has_table_privilege('authenticated', 'public.companies', 'INSERT'),
  'authenticated tiene INSERT sobre companies'
);
select ok(
  has_table_privilege('authenticated', 'public.companies', 'UPDATE'),
  'authenticated tiene UPDATE sobre companies'
);
select ok(
  not has_table_privilege('authenticated', 'public.companies', 'DELETE'),
  'authenticated NO tiene DELETE sobre companies'
);

select ok(
  has_table_privilege('authenticated', 'public.company_members', 'SELECT'),
  'authenticated tiene SELECT sobre company_members'
);
select ok(
  not has_table_privilege('authenticated', 'public.company_members', 'INSERT'),
  'authenticated NO tiene INSERT sobre company_members'
);
select ok(
  not has_table_privilege('authenticated', 'public.company_members', 'UPDATE'),
  'authenticated NO tiene UPDATE sobre company_members'
);
select ok(
  not has_table_privilege('authenticated', 'public.company_members', 'DELETE'),
  'authenticated NO tiene DELETE sobre company_members'
);

select ok(
  has_table_privilege('authenticated', 'public.company_context_versions', 'SELECT')
  and has_table_privilege('authenticated', 'public.company_context_versions', 'INSERT')
  and has_table_privilege('authenticated', 'public.company_context_versions', 'UPDATE')
  and has_table_privilege('authenticated', 'public.company_context_versions', 'DELETE'),
  'authenticated tiene CRUD sobre company_context_versions'
);
select ok(
  has_table_privilege('authenticated', 'public.company_objectives', 'SELECT')
  and has_table_privilege('authenticated', 'public.company_objectives', 'INSERT')
  and has_table_privilege('authenticated', 'public.company_objectives', 'UPDATE')
  and has_table_privilege('authenticated', 'public.company_objectives', 'DELETE'),
  'authenticated tiene CRUD sobre company_objectives'
);
select ok(
  has_table_privilege('authenticated', 'public.company_systems', 'SELECT')
  and has_table_privilege('authenticated', 'public.company_systems', 'INSERT')
  and has_table_privilege('authenticated', 'public.company_systems', 'UPDATE')
  and has_table_privilege('authenticated', 'public.company_systems', 'DELETE'),
  'authenticated tiene CRUD sobre company_systems'
);

select ok(
  has_table_privilege('authenticated', 'public.reports', 'SELECT'),
  'authenticated tiene SELECT sobre reports'
);
select ok(
  not has_table_privilege('authenticated', 'public.reports', 'INSERT'),
  'authenticated NO tiene INSERT sobre reports en esta fase'
);
select ok(
  not has_table_privilege('authenticated', 'public.reports', 'UPDATE'),
  'authenticated NO tiene UPDATE sobre reports en esta fase'
);
select ok(
  not has_table_privilege('authenticated', 'public.reports', 'DELETE'),
  'authenticated NO tiene DELETE sobre reports en esta fase'
);

-- ---------------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------------

select ok(
  has_function_privilege('authenticated', 'public.create_company_for_current_user(text)', 'EXECUTE'),
  'authenticated puede ejecutar create_company_for_current_user'
);
select ok(
  not has_function_privilege('anon', 'public.create_company_for_current_user(text)', 'EXECUTE'),
  'anon NO puede ejecutar create_company_for_current_user'
);
select ok(
  not has_function_privilege('anon', 'public.start_context_draft(text)', 'EXECUTE'),
  'anon NO puede ejecutar start_context_draft'
);
select ok(
  not has_function_privilege('anon', 'public.activate_context_draft(uuid)', 'EXECUTE'),
  'anon NO puede ejecutar activate_context_draft'
);
select ok(
  not has_function_privilege('anon', 'public.replace_draft_objectives(uuid, jsonb)', 'EXECUTE'),
  'anon NO puede ejecutar replace_draft_objectives'
);

-- ---------------------------------------------------------------------------
-- Esquema privado
-- ---------------------------------------------------------------------------

select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anon no tiene USAGE sobre el esquema private'
);

-- authenticated necesita USAGE solo para que las políticas RLS puedan evaluar la
-- función de membresía. La protección real es que `private` no está expuesto por la
-- Data API (ver db.schemas en supabase/config.toml).
select ok(
  has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated tiene USAGE sobre private (necesario para evaluar las políticas)'
);

select ok(
  not has_function_privilege('anon', 'private.is_company_member(uuid)', 'EXECUTE'),
  'anon NO puede ejecutar private.is_company_member'
);

-- Las RPC del producto no son SECURITY DEFINER: operan bajo RLS.
--
-- Se cuenta en lugar de comparar conjuntos de filas: `pg_proc.proname` es de tipo `name`
-- (colación "C") y compararlo contra literales de texto hace fallar a results_eq con
-- "could not determine which collation to use". Contar evita la comparación de cadenas
-- y expresa lo mismo.
select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_company_for_current_user', 'start_context_draft',
                        'activate_context_draft', 'replace_draft_objectives',
                        'replace_draft_systems')),
  5,
  'Las cinco RPC del producto existen en public'
);

select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in ('create_company_for_current_user', 'start_context_draft',
                        'activate_context_draft', 'replace_draft_objectives',
                        'replace_draft_systems')),
  0,
  'Ninguna RPC expuesta en public es SECURITY DEFINER'
);

-- Y las funciones internas que SÍ necesitan elevación viven fuera del esquema expuesto.
select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.prosecdef
      and p.proname in ('is_company_member', 'handle_new_company')),
  2,
  'Las dos funciones SECURITY DEFINER viven en el esquema privado'
);

select * from finish();
rollback;
