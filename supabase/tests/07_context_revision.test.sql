-- PRAXA — Control de revisión al confirmar el contexto (migración 0010).
--
-- El caso que cierra: el mismo borrador abierto en dos pestañas, una guarda algo y la
-- otra confirma mostrando todavía el contenido anterior. Antes se activaba lo que hubiera
-- en ese momento; ahora la confirmación trae la revisión que el usuario vio y la base la
-- vuelve a calcular con el cerrojo tomado, dentro de la misma transacción que activa.

begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

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

select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select public.start_context_draft('1.0.0');

update public.company_context_versions set has_defined_objective = true where status = 'draft';
select public.replace_draft_objectives(
  (select id from public.company_context_versions where status = 'draft'),
  '[{"kind":"primary","title":"Aumentar la conversión"}]'::jsonb);

-- ---------------------------------------------------------------------------
-- 1. La revisión cubre TODO el contexto, no solo la fila
-- ---------------------------------------------------------------------------

create temporary table rev (etapa text, valor text);

insert into rev values ('inicial',
  public.context_revision((select id from public.company_context_versions where status = 'draft')));

select isnt(
  (select valor from rev where etapa = 'inicial'),
  null,
  'la revisión se puede leer'
);

-- Cambiar SOLO los sistemas. La fila de contexto no se toca: si la revisión dependiera de
-- `updated_at`, esto pasaría inadvertido.
select public.replace_draft_systems(
  (select id from public.company_context_versions where status = 'draft'),
  '[{"system_key":"shopify"}]'::jsonb);

insert into rev values ('tras-sistemas',
  public.context_revision((select id from public.company_context_versions where status = 'draft')));

select isnt(
  (select valor from rev where etapa = 'tras-sistemas'),
  (select valor from rev where etapa = 'inicial'),
  'cambiar SOLO sistemas invalida la revisión'
);

-- Cambiar solo los objetivos.
select public.replace_draft_objectives(
  (select id from public.company_context_versions where status = 'draft'),
  '[{"kind":"primary","title":"Reducir faltantes"}]'::jsonb);

insert into rev values ('tras-objetivos',
  public.context_revision((select id from public.company_context_versions where status = 'draft')));

select isnt(
  (select valor from rev where etapa = 'tras-objetivos'),
  (select valor from rev where etapa = 'tras-sistemas'),
  'cambiar solo objetivos invalida la revisión'
);

-- Cambiar solo un campo de la fila.
update public.company_context_versions
   set additional_context = 'algo más'
 where status = 'draft';

insert into rev values ('tras-campo',
  public.context_revision((select id from public.company_context_versions where status = 'draft')));

select isnt(
  (select valor from rev where etapa = 'tras-campo'),
  (select valor from rev where etapa = 'tras-objetivos'),
  'cambiar un campo de la fila invalida la revisión'
);

-- Sin cambios, la revisión es estable.
select is(
  public.context_revision((select id from public.company_context_versions where status = 'draft')),
  (select valor from rev where etapa = 'tras-campo'),
  'sin cambios, la revisión no se mueve'
);

-- ---------------------------------------------------------------------------
-- 2. Confirmar con una revisión desactualizada se rechaza
-- ---------------------------------------------------------------------------
--
-- Es la segunda pestaña: trae la revisión de antes de que la primera guardara.
--
-- El código es PT409 (409 Conflict), no un error de la clase 40: esa clase significa
-- "transitorio, reintentá", y PostgREST la reintenta sola hasta agotar el tiempo. Un
-- conflicto de revisión nunca se resuelve reintentando.

select throws_ok(
  format(
    $fmt$select public.activate_context_draft(%L, %L)$fmt$,
    (select id from public.company_context_versions where status = 'draft'),
    (select valor from rev where etapa = 'inicial')
  ),
  'PT409',
  null,
  'confirmar con una revisión vieja: rechazado'
);

select is(
  (select count(*)::int from public.company_context_versions where status = 'active'),
  0,
  'no se activó nada con la revisión vieja'
);

-- Tampoco se acepta una revisión inventada, ni vacía.
select throws_ok(
  format(
    $fmt$select public.activate_context_draft(%L, 'una-revision-cualquiera')$fmt$,
    (select id from public.company_context_versions where status = 'draft')
  ),
  'PT409',
  null,
  'confirmar con una revisión inventada: rechazado'
);

select throws_ok(
  format(
    $fmt$select public.activate_context_draft(%L, '')$fmt$,
    (select id from public.company_context_versions where status = 'draft')
  ),
  '22023',
  null,
  'confirmar sin revisión: rechazado'
);

-- ---------------------------------------------------------------------------
-- 3. Con la revisión correcta, confirma
-- ---------------------------------------------------------------------------

select lives_ok(
  format(
    $fmt$select public.activate_context_draft(%L, %L)$fmt$,
    (select id from public.company_context_versions where status = 'draft'),
    (select valor from rev where etapa = 'tras-campo')
  ),
  'confirmar con la revisión vigente: aceptado'
);

select is(
  (select version from public.company_context_versions where status = 'active'),
  1,
  'quedó activa la versión 1'
);

select is(
  (select title from public.company_objectives o
     join public.company_context_versions v on v.id = o.context_version_id
    where v.status = 'active'),
  'Reducir faltantes',
  'se activó exactamente el contenido revisado'
);

-- ---------------------------------------------------------------------------
-- 4. Idempotencia del reintento
-- ---------------------------------------------------------------------------
--
-- Un reintento legítimo trae la revisión de ANTES de activar —activar la cambia—, así que
-- la idempotencia no puede depender de que coincida.

select is(
  (select version from public.activate_context_draft(
     (select id from public.company_context_versions where status = 'active'),
     (select valor from rev where etapa = 'tras-campo'))),
  1,
  'reintentar la confirmación exitosa es idempotente'
);

select is(
  (select version from public.activate_context_draft(
     (select id from public.company_context_versions where status = 'active'),
     'revision-que-ya-no-corresponde')),
  1,
  'el reintento no exige la revisión, porque activar la cambió'
);

select is(
  (select count(*)::int from public.company_context_versions where status = 'active'),
  1,
  'sigue habiendo una sola versión vigente'
);

-- ---------------------------------------------------------------------------
-- 5. La revisión no reemplaza a la autorización por empresa
-- ---------------------------------------------------------------------------
--
-- El usuario B conoce el identificador y podría llegar a conocer la revisión: ninguna de
-- las dos cosas lo autoriza. La pertenencia la resuelve RLS a partir de la sesión.

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);

select public.create_company_for_current_user('Empresa B ya existe');
select public.start_context_draft('1.0.0');

select throws_ok(
  format(
    $fmt$select public.activate_context_draft(%L, %L)$fmt$,
    (select id from public.company_context_versions
      where company_id = 'c0a00000-0000-4000-8000-00000000000a' and status = 'active'),
    (select valor from rev where etapa = 'tras-campo')
  ),
  '42501',
  null,
  'un usuario no confirma un borrador de otra empresa, ni con la revisión correcta'
);

select * from finish();
rollback;
