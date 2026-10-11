-- PRAXA — Foto de perfil (0014): bucket privado y carpetas por usuario.

begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('aaaaaaaa-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'foto.a@praxa.test', 'x', now(), now(), now()),
  ('bbbbbbbb-0000-4000-8000-0000000000c2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'foto.b@praxa.test', 'x', now(), now(), now());

select is(
  (select public from storage.buckets where id = 'avatars'),
  false,
  'El bucket avatars no es público'
);

select is(
  (select file_size_limit from storage.buckets where id = 'avatars'),
  5242880::bigint,
  'El bucket avatars admite hasta 5 MB por archivo'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'avatars'),
  array['image/jpeg', 'image/png'],
  'El bucket avatars solo admite JPG y PNG'
);

-- Usuario A
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', 'aaaaaaaa-0000-4000-8000-0000000000c1/foto.png') $$,
  'Un usuario sube una foto a su propia carpeta'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('avatars', 'bbbbbbbb-0000-4000-8000-0000000000c2/foto.png') $$,
  '42501',
  null,
  'Un usuario no puede subir a la carpeta de otro'
);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'avatars'),
  1,
  'El usuario ve su propia foto'
);

-- Usuario B no ve ni borra la foto de A.
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-4000-8000-0000000000c2","role":"authenticated"}', true);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'avatars'),
  0,
  'Otro usuario no ve la foto de A'
);

-- Las versiones recientes de Storage rechazan el DELETE directo por SQL con un trigger,
-- salvo que la sesión lo habilite con esta variable. Sin ella, el trigger abortaría el
-- archivo antes de probar la política. En versiones sin el trigger, la variable no hace nada.
select set_config('storage.allow_delete_query', 'true', true);

select results_eq(
  $$ with borradas as (delete from storage.objects where bucket_id = 'avatars' returning 1)
     select count(*)::int from borradas $$,
  $$ values (0) $$,
  'Otro usuario no puede borrar la foto de A'
);

select results_eq(
  $$ with movidas as (
       update storage.objects set name = 'bbbbbbbb-0000-4000-8000-0000000000c2/robada.png'
        where name = 'aaaaaaaa-0000-4000-8000-0000000000c1/foto.png'
       returning 1)
     select count(*)::int from movidas $$,
  $$ values (0) $$,
  'Otro usuario no puede modificar ni mover la foto de A'
);

-- Usuario A no puede sacar su foto de su carpeta (WITH CHECK de avatars_update_own).
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-0000000000c1","role":"authenticated"}', true);

select throws_ok(
  $$ update storage.objects set name = 'bbbbbbbb-0000-4000-8000-0000000000c2/movida.png'
      where name = 'aaaaaaaa-0000-4000-8000-0000000000c1/foto.png' $$,
  '42501',
  null,
  'Un usuario no puede mover su foto a la carpeta de otro'
);

reset role;

select is(
  (select count(*)::int from storage.objects
    where name = 'aaaaaaaa-0000-4000-8000-0000000000c1/foto.png'),
  1,
  'La foto de A sigue en su carpeta, sin borrar ni mover'
);

select ok(
  not exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'avatars_%' and 'anon' = any (roles)
  ),
  'Ninguna política de avatars alcanza a anon'
);

select * from finish();
rollback;
