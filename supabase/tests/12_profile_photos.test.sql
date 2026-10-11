-- PRAXA — Foto de perfil (0014): bucket privado y carpetas por usuario.

begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

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

delete from storage.objects where bucket_id = 'avatars';

reset role;

select is(
  (select count(*)::int from storage.objects
    where name = 'aaaaaaaa-0000-4000-8000-0000000000c1/foto.png'),
  1,
  'El DELETE de otro usuario no borró la foto de A'
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
