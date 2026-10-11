-- PRAXA 0014 — Foto de perfil: bucket privado `avatars` en Supabase Storage
--
-- La sube el usuario desde Mi perfil (`/app/perfil`). Es un dato personal del usuario, no
-- de la empresa: vive en una carpeta con su id (`<auth.uid()>/<archivo>`) y solo él la
-- puede leer, subir o borrar. La aplicación la muestra con URLs firmadas de vida corta;
-- el bucket NO es público.
--
-- LÍMITES (los aplica Storage en el servidor, no solo la pantalla):
--   * hasta 5 MB por archivo;
--   * solo image/jpeg e image/png.
--
-- PRIVILEGIOS: `authenticated` opera sobre `storage.objects` únicamente por estas
-- políticas, acotadas al bucket y a su propia carpeta. `anon` no tiene ninguna.
--
-- NUMERACIÓN: el plan de la ruta reservaba 0014 para `chat_query_records`; con 0013 y esta
-- migración, la ruta corre dos números (ver docs/HALLAZGOS.md, H-E1-94 y H-E1-96).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_select_own
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_insert_own
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_update_own
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatars_delete_own
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
