-- PRAXA — Regresión: la excepción de DELETE de los triggers de inmutabilidad no puede
-- ser aprovechada por un usuario normal, ni directa ni indirectamente.
--
-- Los triggers `enforce_context_version_immutability` y `enforce_child_parent_is_draft`
-- permiten borrar versiones no-borrador cuando la operación es administrativa y fuera de
-- banda. La condición tiene DOS partes: rol administrativo Y `auth.uid()` nulo.
--
-- La segunda parte es la que cierra la vía indirecta: dentro de una función
-- SECURITY DEFINER, `current_user` pasa a ser el dueño (postgres), así que mirar solo el
-- rol permitiría que un usuario normal borre una versión inmutable a través de una
-- función definer. El claim `sub` del JWT sobrevive al cambio de rol, y por eso se usa.

begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

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


insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'duenio.a@praxa.test', 'x', now(), now(), now());

insert into public.companies (id, name, owner_id)
values ('c0a00000-0000-4000-8000-00000000000a', 'Empresa A',
        'aaaaaaaa-0000-4000-8000-000000000001');

-- Ciclo real: borrador, hijos, activación.
insert into public.company_context_versions
  (id, company_id, context_schema_version, has_defined_objective, created_by)
values ('11110000-0000-4000-8000-00000000000a', 'c0a00000-0000-4000-8000-00000000000a',
        '1.0.0', true, 'aaaaaaaa-0000-4000-8000-000000000001');

insert into public.company_objectives (id, company_id, context_version_id, kind, title)
values ('0b1e0000-0000-4000-8000-00000000000a', 'c0a00000-0000-4000-8000-00000000000a',
        '11110000-0000-4000-8000-00000000000a', 'primary', 'Objetivo de A');

update public.company_context_versions
   set status = 'active', version = 1, activated_at = now()
 where id = '11110000-0000-4000-8000-00000000000a';

-- Función SECURITY DEFINER de prueba, propiedad de postgres, que intenta el borrado.
-- Representa la vía indirecta: cualquier función definer que borrase filas de contexto.
create function public.praxa_test_definer_delete_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.company_context_versions where id = p_version_id;
end;
$$;

create function public.praxa_test_definer_delete_objective(p_objective_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.company_objectives where id = p_objective_id;
end;
$$;

grant execute on function public.praxa_test_definer_delete_version(uuid) to authenticated;
grant execute on function public.praxa_test_definer_delete_objective(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Vía directa: usuario autenticado normal
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- La política de DELETE solo alcanza borradores, así que la fila activa queda fuera del
-- alcance de la sentencia: cero filas, sin excepción.
select is(
  pg_temp.affected($sql$delete from public.company_context_versions where id = '11110000-0000-4000-8000-00000000000a'$sql$),
  0,
  'DIRECTA: un usuario normal no borra una versión activa (cero filas)'
);

select is(
  (select count(*)::int from public.company_context_versions
    where id = '11110000-0000-4000-8000-00000000000a'),
  1,
  'DIRECTA: la versión activa sigue existiendo'
);

-- Los objetivos de una versión activa los frena el trigger del hijo.
select throws_ok(
  $$delete from public.company_objectives
     where id = '0b1e0000-0000-4000-8000-00000000000a'$$,
  '42501',
  null,
  'DIRECTA: un usuario normal no borra objetivos de una versión activa'
);

-- ---------------------------------------------------------------------------
-- Vía indirecta: el mismo usuario, a través de una función SECURITY DEFINER
-- ---------------------------------------------------------------------------
--
-- Acá `current_user` pasa a ser postgres. Si la excepción mirara solo el rol, el borrado
-- prosperaría. Como además exige `auth.uid()` nulo, y el claim del usuario sobrevive,
-- el trigger rechaza.

select throws_ok(
  $$select public.praxa_test_definer_delete_version('11110000-0000-4000-8000-00000000000a')$$,
  '42501',
  null,
  'INDIRECTA: una función SECURITY DEFINER invocada por un usuario no borra la versión activa'
);

select is(
  (select count(*)::int from public.company_context_versions
    where id = '11110000-0000-4000-8000-00000000000a'),
  1,
  'INDIRECTA: la versión activa sigue intacta tras el intento'
);

select throws_ok(
  $$select public.praxa_test_definer_delete_objective('0b1e0000-0000-4000-8000-00000000000a')$$,
  '42501',
  null,
  'INDIRECTA: tampoco borra los objetivos de una versión activa'
);

select is(
  (select count(*)::int from public.company_objectives
    where id = '0b1e0000-0000-4000-8000-00000000000a'),
  1,
  'INDIRECTA: el objetivo sigue intacto tras el intento'
);

-- ---------------------------------------------------------------------------
-- El camino administrativo legítimo sí funciona
-- ---------------------------------------------------------------------------
--
-- Sin sesión de usuario (auth.uid() nulo) y con rol administrativo: es el caso de la
-- limpieza de datos, donde el borrado en cascada de la empresa pasa por los triggers.

reset role;
select set_config('request.jwt.claims', null, true);
set local role service_role;

select lives_ok(
  $$delete from public.companies where id = 'c0a00000-0000-4000-8000-00000000000a'$$,
  'ADMINISTRATIVA: sin sesión de usuario, el borrado en cascada de la empresa procede'
);

reset role;

select is(
  (select count(*)::int from public.company_context_versions
    where company_id = 'c0a00000-0000-4000-8000-00000000000a'),
  0,
  'ADMINISTRATIVA: la cascada se llevó las versiones de contexto'
);

select * from finish();
rollback;
