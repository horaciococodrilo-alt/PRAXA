-- PRAXA 0025 — ¿Un correo tiene cuenta? Para «olvidé mi contraseña» (H-E1-259).
--
-- RIESGO ACEPTADO POR EL USUARIO (2026-11-15): recuperar el acceso con un correo sin cuenta
-- avisa que no existe, en lugar de la respuesta neutra. Permite comprobar si un correo es
-- usuario de PRAXA, como ya pasa en el registro (H-E1-73). Ver SECURITY.md, «Riesgos
-- aceptados».
--
-- MATRIZ
--   worker_api.email_has_account(text) : DEFINER, search_path vacío, solo praxa_integrations.
--                                        Sin EXECUTE para anon, authenticated, service_role ni
--                                        PUBLIC: no se expone por la Data API; la llama solo el
--                                        servidor (Server Action de /forgot-password).
--
-- Sin actor ni empresa: es la única lectura de worker_api que no las recibe, porque se usa
-- antes de iniciar sesión. Devuelve solo un booleano, nunca datos de la cuenta.
-- CATÁLOGO DE ERRORES: 22023 para un correo nulo, sin arroba o de más de 320 caracteres.

create function worker_api.email_has_account(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
begin
  if v_email is null or pg_catalog.char_length(v_email) > 320
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+$' then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  return exists (
    select 1 from auth.users u
     where pg_catalog.lower(u.email) = v_email
       and u.deleted_at is null);
end;
$$;

revoke all on function worker_api.email_has_account(text)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.email_has_account(text) to praxa_integrations;
