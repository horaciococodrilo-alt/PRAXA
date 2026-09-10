-- PRAXA — Integridad de la activación y de las vías de escritura (migraciones 0006–0009).
--
-- Historia de las tres capas que se fueron cerrando:
--
--   0006  la coherencia del contexto bajó de la RPC al trigger, para que corriera en
--         todos los caminos de escritura;
--   0007  las listas pasaron a escribirse SOLO por RPC —la única vía que toma el
--         cerrojo— y la activación directa por UPDATE quedó prohibida;
--   0008  se admitió la activación administrativa fuera de banda, sin relajar la
--         validación de coherencia;
--   0009  start_context_draft() recuperó el privilegio de clonar, por función privada.
--
-- Todo lo que sigue corre como usuario normal salvo donde se diga lo contrario.

begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'duenio.a@praxa.test', 'x', now(), now(), now());

insert into public.companies (id, name, owner_id)
values ('c0a00000-0000-4000-8000-00000000000a', 'Empresa A',
        'aaaaaaaa-0000-4000-8000-000000000001');

-- Ejecuta una sentencia con privilegios administrativos, para ejercitar comprobaciones
-- que ya no son alcanzables desde `authenticated`.
create function pg_temp.as_admin(p_sql text)
returns void
language plpgsql
security definer
as $fn$
begin
  execute p_sql;
end;
$fn$;

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 1. Las listas no se pueden escribir directamente
-- ---------------------------------------------------------------------------
--
-- Es la vía que no se podía coordinar con la activación: un trigger que tomara el
-- cerrojo lo haría DESPUÉS del bloqueo de fila, invirtiendo el orden de adquisición y
-- abriendo un interbloqueo. Por eso se cerró en vez de intentar protegerla.

select lives_ok(
  $$select public.start_context_draft('1.0.0')$$,
  'se abre un borrador'
);

select throws_ok(
  $$insert into public.company_objectives (company_id, context_version_id, kind, title)
    values ('c0a00000-0000-4000-8000-00000000000a',
            (select id from public.company_context_versions where status = 'draft'),
            'primary', 'Colado')$$,
  '42501',
  null,
  'INSERT directo de objetivos: sin privilegio'
);

select throws_ok(
  $$insert into public.company_systems (company_id, context_version_id, system_key)
    values ('c0a00000-0000-4000-8000-00000000000a',
            (select id from public.company_context_versions where status = 'draft'),
            'shopify')$$,
  '42501',
  null,
  'INSERT directo de sistemas: sin privilegio'
);

-- La vía correcta sí funciona.
select lives_ok(
  $$select public.replace_draft_objectives(
      (select id from public.company_context_versions where status = 'draft'),
      '[{"kind":"primary","title":"Aumentar la conversión"}]'::jsonb)$$,
  'replace_draft_objectives sobre el borrador: aceptado'
);

select is(
  (select count(*)::int from public.company_objectives),
  1,
  'el objetivo quedó escrito por la vía con cerrojo'
);

-- ---------------------------------------------------------------------------
-- 2. La activación no se puede hacer con un UPDATE directo
-- ---------------------------------------------------------------------------

update public.company_context_versions set has_defined_objective = true where status = 'draft';

select throws_ok(
  $$update public.company_context_versions
       set status = 'active', version = 1, activated_at = now()
     where status = 'draft'$$,
  '42501',
  null,
  'UPDATE directo a activo: solo se puede por activate_context_draft()'
);

select is(
  (select count(*)::int from public.company_context_versions where status = 'active'),
  0,
  'no quedó ninguna versión activa tras el intento'
);

-- ---------------------------------------------------------------------------
-- 3. La coherencia se exige aunque el camino sea el correcto
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.replace_draft_objectives(
      (select id from public.company_context_versions where status = 'draft'),
      '[]'::jsonb)$$,
  'se vacían los objetivos del borrador'
);

select throws_ok(
  $$select public.activate_context_draft(
      (select id from public.company_context_versions where status = 'draft'),
      public.context_revision(
        (select id from public.company_context_versions where status = 'draft')))$$,
  '23514',
  null,
  'activar con objetivo declarado y cero objetivos: rechazado'
);

-- El caso simétrico.
update public.company_context_versions set has_defined_objective = false where status = 'draft';

select public.replace_draft_objectives(
  (select id from public.company_context_versions where status = 'draft'),
  '[{"kind":"primary","title":"Objetivo contradictorio"}]'::jsonb);

select throws_ok(
  $$select public.activate_context_draft(
      (select id from public.company_context_versions where status = 'draft'),
      public.context_revision(
        (select id from public.company_context_versions where status = 'draft')))$$,
  '23514',
  null,
  'activar con "sin objetivo definido" y objetivos cargados: rechazado'
);

-- ---------------------------------------------------------------------------
-- 4. La numeración y el sello los pone la base
-- ---------------------------------------------------------------------------

update public.company_context_versions set has_defined_objective = true where status = 'draft';

select lives_ok(
  $$select public.activate_context_draft(
      (select id from public.company_context_versions where status = 'draft'),
      public.context_revision(
        (select id from public.company_context_versions where status = 'draft')))$$,
  'activar el borrador coherente: aceptado'
);

select is(
  (select version from public.company_context_versions where status = 'active'),
  1,
  'la primera versión activa recibe el número 1'
);

select ok(
  (select activated_at from public.company_context_versions where status = 'active')
    > now() - interval '1 hour',
  'la fecha de activación la sella la base'
);

-- ---------------------------------------------------------------------------
-- 5. Una versión activa no pierde filas hijas, ni siquiera por vía administrativa
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.start_context_draft('1.0.0')$$,
  'start_context_draft clona la versión activa hacia un borrador nuevo'
);

select is(
  (select count(*)::int from public.company_objectives o
     join public.company_context_versions v on v.id = o.context_version_id
    where v.status = 'draft'),
  1,
  'el clon arrastra los objetivos de la versión activa'
);

-- Mover una fila hija entre versiones sigue prohibido incluso con privilegios: es lo que
-- vaciaría una versión activa pasando el control porque el DESTINO es un borrador.
select throws_ok(
  $$select pg_temp.as_admin($adm$update public.company_objectives
       set context_version_id =
         (select id from public.company_context_versions
           where status = 'draft'
             and company_id = 'c0a00000-0000-4000-8000-00000000000a')
     where context_version_id =
         (select id from public.company_context_versions
           where status = 'active'
             and company_id = 'c0a00000-0000-4000-8000-00000000000a')$adm$)$$,
  '42501',
  null,
  'mover un objetivo desde una versión activa: rechazado incluso con privilegios'
);

select is(
  (select count(*)::int from public.company_objectives o
     join public.company_context_versions v on v.id = o.context_version_id
    where v.status = 'active'),
  1,
  'la versión activa conserva su objetivo'
);

-- ---------------------------------------------------------------------------
-- 6. Cierre: la numeración queda consecutiva
-- ---------------------------------------------------------------------------

select public.activate_context_draft(
  (select id from public.company_context_versions where status = 'draft'),
  public.context_revision(
    (select id from public.company_context_versions where status = 'draft')));

select results_eq(
  $$select version from public.company_context_versions order by version$$,
  $$values (1), (2)$$,
  'la numeración quedó consecutiva: 1 reemplazada y 2 vigente'
);

select * from finish();
rollback;
