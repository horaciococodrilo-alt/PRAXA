-- PRAXA 0004 — Matriz de privilegios explícita
--
-- RLS NO reemplaza los permisos SQL: son dos capas independientes y ambas tienen que
-- ser correctas. Supabase concede por defecto privilegios amplios sobre las tablas
-- nuevas de `public` a `anon` y `authenticated`; esta migración revoca todo eso y
-- vuelve a conceder operación por operación.
--
-- Matriz resultante (documentada y probada en supabase/tests/03_privileges.test.sql):
--
--   tabla                      | anon | authenticated
--   ---------------------------+------+---------------------------
--   companies                  | —    | SELECT, INSERT, UPDATE
--   company_members            | —    | SELECT
--   company_context_versions   | —    | SELECT, INSERT, UPDATE, DELETE
--   company_objectives         | —    | SELECT, INSERT, UPDATE, DELETE
--   company_systems            | —    | SELECT, INSERT, UPDATE, DELETE
--   reports                    | —    | SELECT
--
-- `anon` no accede a ninguna tabla del producto: un visitante sin sesión no debe poder
-- ni siquiera comprobar si una empresa existe.
--
-- No hay secuencias que conceder: todas las claves primarias son uuid con default
-- gen_random_uuid(), no identity/serial.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

revoke all on public.companies                from anon, authenticated;
revoke all on public.company_members          from anon, authenticated;
revoke all on public.company_context_versions from anon, authenticated;
revoke all on public.company_objectives       from anon, authenticated;
revoke all on public.company_systems          from anon, authenticated;
revoke all on public.reports                  from anon, authenticated;

-- Sin DELETE: la aplicación no borra empresas.
grant select, insert, update on public.companies to authenticated;

-- Solo lectura: nadie se otorga ni modifica membresías. La membresía inicial la crea
-- private.handle_new_company() en la misma transacción que el alta de la empresa.
grant select on public.company_members to authenticated;

grant select, insert, update, delete on public.company_context_versions to authenticated;
grant select, insert, update, delete on public.company_objectives       to authenticated;
grant select, insert, update, delete on public.company_systems          to authenticated;

-- Solo lectura hasta que exista el worker de generación.
grant select on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- Funciones expuestas
-- ---------------------------------------------------------------------------

revoke all on function public.create_company_for_current_user(text) from public, anon;
revoke all on function public.start_context_draft(text)             from public, anon;
revoke all on function public.activate_context_draft(uuid)          from public, anon;

grant execute on function public.create_company_for_current_user(text) to authenticated;
grant execute on function public.start_context_draft(text)             to authenticated;
grant execute on function public.activate_context_draft(uuid)          to authenticated;

-- ---------------------------------------------------------------------------
-- Funciones internas
-- ---------------------------------------------------------------------------

revoke all on function private.enforce_context_version_immutability() from public, anon;
revoke all on function private.enforce_child_parent_is_draft()        from public, anon;

-- Trigger functions SECURITY INVOKER: se ejecutan con los privilegios de quien dispara
-- el trigger, así que `authenticated` necesita EXECUTE. Viven en `private`, que no está
-- expuesto por la Data API, y además fallan si se las invoca fuera de un trigger.
grant execute on function private.enforce_context_version_immutability() to authenticated;
grant execute on function private.enforce_child_parent_is_draft()        to authenticated;
