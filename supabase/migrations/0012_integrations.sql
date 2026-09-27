-- PRAXA 0012 — Conector de Meta: rol, esquema worker_api, tablas y funciones
--
-- Modelo (DEC-03 y DEC-04): las credenciales son inaccesibles para los usuarios y toda
-- escritura del conector pasa por `worker_api`, un esquema NO expuesto por la Data API
-- que solo ejecuta el rol acotado `praxa_integrations` (el "rol de C"). Los usuarios leen
-- sus conexiones por RLS y no escriben nada.
--
-- MATRIZ DE PRIVILEGIOS (spec de la ruta, sección 7; CA-16)
--
--   objeto                              | anon | authenticated   | rol de C          | PUBLIC   | service_role
--   ------------------------------------+------+-----------------+-------------------+----------+-------------
--   public.integration_connections      | —    | SELECT por RLS  | —                 | —        | —
--   public.meta_daily_coverage          | —    | SELECT por RLS  | —                 | —        | —
--     (prevista en 0013; no existe todavía)
--   public.oauth_attempts               | —    | —               | —                 | —        | —
--   private.integration_credentials     | —    | —               | —                 | —        | —
--   snapshots, días de snapshot y       | —    | —               | —                 | —        | —
--     ejecuciones de sincronización
--     (previstas en 0013; no existen todavía)
--   public.chat_query_records           | —    | —               | —                 | —        | —
--     (prevista en 0014; no existe todavía)
--   esquema worker_api                  | —    | —               | USAGE             | —        | —
--   funciones de worker_api             | —    | —               | EXECUTE, función  | revocado | —
--                                       |      |                 | por función       |          |
--
-- La columna service_role se suma a la matriz de la ruta (D-M06.1a-M06.2a-01): ningún
-- código de la aplicación usa service_role, los fixtures siembran por worker_api y limpian
-- por cascada, y así la matriz no depende del cambio de Supabase del 2026-10-30.
--
-- REGLAS
--
--   * Cada tabla y cada función nueva empieza con `revoke all ... from public, anon,
--     authenticated, service_role` explícito, y recién después se concede lo que marca la
--     matriz. No se depende de los privilegios predeterminados del proyecto (CA-17).
--   * Todas las funciones de worker_api son SECURITY DEFINER, con `set search_path = ''`
--     y objetos calificados. Además, `alter default privileges in schema worker_api
--     revoke execute on functions from public`.
--   * El rol de C es LOGIN, NOBYPASSRLS y NOINHERIT, sin grants sobre tablas.
--   * La migración crea el rol SIN CONTRASEÑA, porque el repositorio es público. La fija
--     el usuario fuera del repositorio (M06.3a en pruebas, M28.2a en la aplicación).
--   * worker_api no figura en los esquemas expuestos (supabase/config.toml); en el
--     proyecto de la aplicación se verifica en el dashboard (M28.2a).
--   * Cada función verifica en `public.company_members` que el actor sea miembro de la
--     empresa, y que la conexión pertenezca a esa empresa. ÚNICA EXCEPCIÓN:
--     `count_credentials_by_key_version()` no recibe actor ni empresa y devuelve solo
--     conteos por versión de clave, sin ningún dato de empresas; solo la ejecuta el rol
--     de C. Es global porque CA-25 exige confirmar que NINGUNA credencial usa la clave
--     vieja antes de retirarla (D-M06.1a-M06.2a-04).
--
-- LÍMITE DECLARADO (sección 7, paso 4)
--
--   Por la conexión del rol de C no viaja ningún JWT, así que la base no puede verificar
--   la identidad por sí misma. El chequeo de pertenencia protege contra errores del
--   servidor que mezclen actor, empresa o conexión; no contra un servidor comprometido,
--   que de todos modos tendría la clave de cifrado. Por eso tampoco se usa
--   `private.is_company_member()` acá: lanza una excepción sin `auth.uid()`.
--
-- RLS FORZADA (CA-14)
--
--   Las tres tablas tienen RLS habilitada y forzada. `force` no restringe a las funciones
--   SECURITY DEFINER cuyo dueño tiene `bypassrls`, como `postgres` en Supabase: lo que
--   protege worker_api es el chequeo dentro de cada función, no la política. Si el dueño
--   de las funciones cambiara a un rol sin `bypassrls`, leerían cero filas en silencio;
--   09_integration_privileges lo afirma para detectarlo. Pasar las tablas existentes a
--   `force` y cambiar el dueño de las funciones quedan pendientes, fuera de la ruta.
--
-- CATÁLOGO DE ERRORES TIPADOS
--
--   worker_api no pasa por PostgREST: lo consume el cliente de M06.3a, que traduce cada
--   código. 42501 queda reservado a los privilegios faltantes. Los mensajes son fijos, sin
--   identificadores, hashes, valores de parámetros ni texto de Meta, y sin DETAIL ni HINT.
--
--   SQLSTATE | clave                  | cuándo
--   ---------+------------------------+----------------------------------------------------
--   PX001    | not_authorized         | actor o empresa nulos; actor que no es miembro; conexión
--            |                        | o intento inexistente o de otra empresa (indistinguibles);
--            |                        | p_connection_id ya existente en create_pending_connection.
--            |                        | Excepción: purge_connection devuelve false sin efecto
--   PX002    | attempt_rejected       | el intento no se puede consumir o usar (sin decir por qué)
--   PX003    | live_connection_exists | la empresa ya tiene una conexión viva
--   PX004    | invalid_transition     | transición no declarada en CA-07
--   PX005    | pending_expired        | confirm_connection con la pendiente vencida
--   PX006    | generation_mismatch    | la generación de credencial no es la esperada
--   PX007    | account_conflict       | la cuenta ya está en otra fila de la empresa
--   PX008    | key_version_mismatch   | rewrap_credential con una versión de clave que ya no es la guardada
--   22023    | invalid_argument       | parámetro nulo o con forma inválida; cualquier otra violación
--            |                        | de integridad (clase 23) sin código propio
--
--   Ningún SQLSTATE de clase 23 sale crudo de worker_api: las funciones que escriben lo
--   capturan y lo relanzan con un código del catálogo, porque Postgres adjunta a 23502 y
--   23505 la fila o la clave que falló. Las que solo leen no pueden producirlo.
--
-- H-E1-07 (hipótesis sobre `reports_context_fkey`): la parte 1 de 10_demo_closure, corrida
-- antes de esta migración, pasó. La cascada desde `companies` no se rompe, así que esta
-- migración no toca `reports`.

-- ---------------------------------------------------------------------------
-- Esquema y rol
-- ---------------------------------------------------------------------------

create schema worker_api;
revoke all on schema worker_api from public, anon, authenticated;
alter default privileges in schema worker_api revoke execute on functions from public;

-- Sin contraseña: la fija el usuario fuera del repositorio.
create role praxa_integrations login nobypassrls noinherit;
grant usage on schema worker_api to praxa_integrations;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

-- CA-05: enum cerrado. Agregar un proveedor es una decisión, no un valor nuevo.
create type public.integration_provider as enum ('meta');

-- CA-07. `disconnected` significa "borrado en curso": la purga elimina la fila.
create type public.connection_status as enum
  ('pending_selection', 'active', 'needs_reauth', 'disconnected');

-- ---------------------------------------------------------------------------
-- Helpers privados
-- ---------------------------------------------------------------------------

-- Pertenencia del actor sin JWT: se verifica contra `company_members` por el id que
-- manda el servidor. SECURITY INVOKER: solo lo llaman las funciones de worker_api, que
-- corren como su dueño.
create function private.assert_worker_actor(p_actor_user_id uuid, p_company_id uuid)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_actor_user_id is null
     or p_company_id is null
     or not exists (
       select 1
       from public.company_members m
       where m.company_id = p_company_id
         and m.user_id = p_actor_user_id
     ) then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;
end;
$$;

-- Espejo de `granted_scopes` de K04 (credential.ts): al menos un permiso, ninguno nulo ni
-- repetido, cada uno con la forma de `scopeSchema`, e incluye `ads_read`. Es una función
-- porque un `check` no admite subconsultas.
create function private.valid_granted_scopes(p_scopes text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_scopes is not null
     and pg_catalog.array_ndims(p_scopes) = 1
     and pg_catalog.cardinality(p_scopes) >= 1
     and pg_catalog.array_position(p_scopes, null) is null
     and 'ads_read' = any (p_scopes)
     and (select pg_catalog.count(*) = pg_catalog.count(distinct s)
                 and pg_catalog.bool_and(s ~ '^[a-z][a-z0-9_]{0,63}$')
            from pg_catalog.unnest(p_scopes) as s)
$$;

revoke all on function private.assert_worker_actor(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.valid_granted_scopes(text[])
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- K03. El id lo genera el servidor, sin default: el AAD del cifrado lo necesita antes de
-- que exista la fila (CA-11b).
create table public.integration_connections (
  id                    uuid primary key,
  company_id            uuid not null references public.companies (id) on delete cascade,
  provider              public.integration_provider not null default 'meta',
  status                public.connection_status not null default 'pending_selection',
  external_account_id   text,
  client_business_id    text,
  currency              text,
  timezone              text,
  credential_generation integer not null default 0,
  pending_expires_at    timestamptz,
  purge_requested_at    timestamptz,
  -- Sin FK hasta 0013, que crea las ejecuciones de sincronización.
  current_sync_run_id   uuid,
  last_error_class      text,
  last_error_message    text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Destino de las FK compuestas: una fila hija no puede apuntar a la conexión de otra
  -- empresa (patrón de 0002).
  constraint integration_connections_company_id_id_key unique (company_id, id),

  -- CA-18. Los null no chocan entre sí: una pendiente todavía no tiene cuenta.
  constraint integration_connections_account_key
    unique (company_id, provider, external_account_id),

  constraint integration_connections_account_format
    check (external_account_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  constraint integration_connections_business_format
    check (client_business_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  constraint integration_connections_currency_format
    check (currency ~ '^[A-Z]{3}$'),
  constraint integration_connections_timezone_format
    check (timezone = 'UTC' or timezone ~ '^[A-Z][A-Za-z_]+(/[A-Za-z0-9_+-]+)+$'),
  constraint integration_connections_generation_nonnegative
    check (credential_generation >= 0),
  constraint integration_connections_error_class
    check (last_error_class in ('authentication', 'user_action', 'permission', 'asset_access',
                                'rate_limit', 'temporary', 'own_error', 'transport', 'unknown')),
  constraint integration_connections_error_message_length
    check (char_length(last_error_message) between 1 and 500),

  -- CA-08: ninguna transición inventa metadatos. Vienen juntos de la confirmación.
  constraint integration_connections_metadata_together
    check (num_nonnulls(external_account_id, currency, timezone) in (0, 3)),
  constraint integration_connections_metadata_required
    check (status not in ('active', 'needs_reauth')
           or num_nonnulls(external_account_id, currency, timezone) = 3),

  -- DEC-17: la pendiente vence.
  constraint integration_connections_pending_expiry
    check (status <> 'pending_selection' or pending_expires_at is not null),

  -- CA-38: marca persistente de la purga pendiente, solo en disconnected.
  constraint integration_connections_purge_mark
    check ((status = 'disconnected') = (purge_requested_at is not null)),

  -- CA-09: el último error es una clase más un mensaje; uno sin el otro no sirve.
  constraint integration_connections_error_pair
    check ((last_error_class is null) = (last_error_message is null)),

  -- CA-39: solo cuatro clases llevan a needs_reauth. El `is not null` hace falta: con una
  -- clase nula, el `in` daría null y el check pasaría.
  constraint integration_connections_reauth_class
    check (status <> 'needs_reauth'
           or (last_error_class is not null
               and last_error_class in ('authentication', 'user_action', 'permission',
                                        'asset_access')))
);

-- CA-18: una sola conexión viva por empresa.
create unique index integration_connections_one_live_per_company
  on public.integration_connections (company_id)
  where status in ('pending_selection', 'active', 'needs_reauth');

create trigger integration_connections_touch
  before update on public.integration_connections
  for each row execute function private.touch_updated_at();

-- K02. Solo se persisten hashes (CA-01); el intento vence a los 10 minutos como máximo,
-- el tope ratificado en G-K02-K04 (H-E1-19, D-M06.1a-M06.2a-10).
create table public.oauth_attempts (
  id                     uuid primary key default gen_random_uuid(),
  provider               public.integration_provider not null default 'meta',
  company_id             uuid not null references public.companies (id) on delete cascade,
  actor_user_id          uuid not null references auth.users (id) on delete cascade,
  purpose                text not null,
  expected_connection_id uuid,
  expected_generation    integer,
  state_hash             text not null,
  browser_binding_hash   text not null,
  return_path            text not null,
  created_at             timestamptz not null default now(),
  expires_at             timestamptz not null,
  consumed_at            timestamptz,

  constraint oauth_attempts_state_hash_key unique (state_hash),

  constraint oauth_attempts_expected_connection_fkey
    foreign key (company_id, expected_connection_id)
    references public.integration_connections (company_id, id) on delete cascade,

  constraint oauth_attempts_purpose_check
    check (purpose in ('initial', 'reauth')),
  constraint oauth_attempts_expected_generation_nonnegative
    check (expected_generation >= 0),
  constraint oauth_attempts_state_hash_format
    check (state_hash ~ '^[0-9a-f]{64}$'),
  constraint oauth_attempts_browser_binding_hash_format
    check (browser_binding_hash ~ '^[0-9a-f]{64}$'),
  -- CA-04: espejo de RETURN_PATH_ALLOWLIST (primitives.ts). Valores exactos.
  constraint oauth_attempts_return_path_allowlist
    check (return_path in ('/app/integraciones')),
  constraint oauth_attempts_expiry_window
    check (expires_at > created_at and expires_at <= created_at + interval '10 minutes'),

  -- CA-02c: reauth guarda la conexión y la generación esperadas; initial, ninguna.
  constraint oauth_attempts_purpose_shape
    check ((purpose = 'initial' and expected_connection_id is null and expected_generation is null)
           or (purpose = 'reauth' and expected_connection_id is not null
               and expected_generation is not null))
);

create index oauth_attempts_company_idx on public.oauth_attempts (company_id);
create index oauth_attempts_expected_connection_idx
  on public.oauth_attempts (company_id, expected_connection_id);

-- K04. Solo material cifrado (CA-10): no hay columna de texto plano. La fila coincide con
-- `secretCredentialSchema`.
create table private.integration_credentials (
  connection_id     uuid primary key,
  company_id        uuid not null,
  ciphertext        text not null,
  iv                text not null,
  auth_tag          text not null,
  key_version       integer not null,
  token_type        text not null,
  issued_for_app_id text not null,
  granted_scopes    text[] not null,
  expires_at        timestamptz,

  -- CA-13 y CA-68: toda credencial referencia una conexión de su misma empresa.
  constraint integration_credentials_connection_fkey
    foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,

  -- base64 no vacío, igual que `base64Schema.min(1)`.
  constraint integration_credentials_ciphertext_base64
    check (char_length(ciphertext) >= 1
           and ciphertext ~ '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'),
  -- 16 caracteres sin relleno decodifican exactamente a 12 bytes (GCM_IV_BYTES).
  constraint integration_credentials_iv_12_bytes
    check (iv ~ '^[A-Za-z0-9+/]{16}$'),
  -- 24 caracteres terminados en `==` decodifican exactamente a 16 bytes (GCM_AUTH_TAG_BYTES).
  constraint integration_credentials_auth_tag_16_bytes
    check (auth_tag ~ '^[A-Za-z0-9+/]{22}==$'),
  constraint integration_credentials_key_version_positive
    check (key_version > 0),
  constraint integration_credentials_token_type
    check (token_type in ('system_user')),
  constraint integration_credentials_app_format
    check (issued_for_app_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  constraint integration_credentials_scopes
    check (private.valid_granted_scopes(granted_scopes))
);

-- ---------------------------------------------------------------------------
-- RLS y privilegios de tablas
-- ---------------------------------------------------------------------------

revoke all on public.integration_connections from public, anon, authenticated, service_role;
alter table public.integration_connections enable row level security;
alter table public.integration_connections force row level security;

revoke all on public.oauth_attempts from public, anon, authenticated, service_role;
alter table public.oauth_attempts enable row level security;
alter table public.oauth_attempts force row level security;

revoke all on private.integration_credentials from public, anon, authenticated, service_role;
alter table private.integration_credentials enable row level security;
alter table private.integration_credentials force row level security;

-- CA-20: la empresa sale de la membresía del JWT, nunca del cliente.
create policy integration_connections_select_member
  on public.integration_connections for select to authenticated
  using (private.is_company_member(company_id));

grant select on public.integration_connections to authenticated;

-- oauth_attempts e integration_credentials: sin políticas ni grants. Solo worker_api.

-- ---------------------------------------------------------------------------
-- Funciones de worker_api
-- ---------------------------------------------------------------------------
--
-- Orden dentro de cada función:
--   1. pertenencia del actor (PX001);
--   2. parámetros nulos o con forma inválida (22023);
--   3. cerrojo de empresa, antes de tocar filas (orden único del sistema, 0007);
--   4. lectura de la conexión por id Y empresa, antes de cualquier chequeo propio
--      (PX001; en purge_connection, false);
--   5. chequeos propios (intento, estado, generación, versión de clave).
--
-- Las columnas se califican siempre con alias: los parámetros de salida de `returns table`
-- comparten nombre con columnas, y PL/pgSQL rechaza la referencia ambigua.
--
-- Las transiciones se hacen cumplir acá y no con un trigger: las tablas no tienen grants de
-- escritura, así que worker_api es la única vía.

-- Crea un intento OAuth. Antes purga, de esa empresa, los no consumidos ya vencidos y los
-- consumidos hace MÁS de 10 minutos (CA-38b): uno consumido se conserva hasta entonces
-- aunque haya vencido, porque replace_credential lo necesita después del consumo.
create function worker_api.create_oauth_attempt(
  p_actor_user_id          uuid,
  p_company_id             uuid,
  p_purpose                text,
  p_state_hash             text,
  p_browser_binding_hash   text,
  p_return_path            text,
  p_expires_at             timestamptz,
  p_expected_connection_id uuid default null
)
returns table (
  attempt_id             uuid,
  purpose                text,
  expected_connection_id uuid,
  expected_generation    integer,
  created_at             timestamptz,
  expires_at             timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_generation integer;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_purpose is null or p_state_hash is null or p_browser_binding_hash is null
     or p_return_path is null or p_expires_at is null
     or p_purpose not in ('initial', 'reauth')
     or (p_purpose = 'initial' and p_expected_connection_id is not null)
     or (p_purpose = 'reauth' and p_expected_connection_id is null)
     or p_expires_at <= now()
     or p_expires_at > now() + interval '10 minutes' then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  delete from public.oauth_attempts a
   where a.company_id = p_company_id
     and ((a.consumed_at is null and a.expires_at <= now())
          or a.consumed_at < now() - interval '10 minutes');

  if p_purpose = 'initial' then
    if exists (
      select 1
      from public.integration_connections c
      where c.company_id = p_company_id
        and c.status in ('pending_selection', 'active', 'needs_reauth')
    ) then
      raise exception 'praxa: la empresa ya tiene una conexión' using errcode = 'PX003';
    end if;
  else
    select c.* into v_connection
    from public.integration_connections c
    where c.id = p_expected_connection_id
      and c.company_id = p_company_id
    for update;

    if not found then
      raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
    end if;

    -- Una pendiente no tiene cuenta que reautorizar (D-M06.1a-M06.2a-02, H-E1-21).
    if v_connection.status not in ('active', 'needs_reauth') then
      raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
    end if;

    -- La generación esperada se lee de la fila; nunca viene del llamador.
    v_generation := v_connection.credential_generation;
  end if;

  return query
  insert into public.oauth_attempts as a
    (company_id, actor_user_id, purpose, expected_connection_id, expected_generation,
     state_hash, browser_binding_hash, return_path, created_at, expires_at)
  values
    (p_company_id, p_actor_user_id, p_purpose, p_expected_connection_id, v_generation,
     p_state_hash, p_browser_binding_hash, p_return_path, now(), p_expires_at)
  returning a.id, a.purpose, a.expected_connection_id, a.expected_generation,
            a.created_at, a.expires_at;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'integration_connections_account_key' then
      raise exception 'praxa: la cuenta ya está vinculada' using errcode = 'PX007';
    elsif v_constraint = 'integration_connections_one_live_per_company' then
      raise exception 'praxa: la empresa ya tiene una conexión' using errcode = 'PX003';
    elsif v_constraint in ('integration_connections_pkey', 'integration_credentials_pkey') then
      raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
    else
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end if;
end;
$$;

-- Consumo único y atómico (CA-03): UNA sola sentencia valida state, vinculación, actor,
-- empresa, no consumido y vigencia, y lo marca. No toma el cerrojo de empresa: la fila
-- bloqueada serializa dos consumos, y en `read committed` el segundo reevalúa
-- `consumed_at is null` y no encuentra fila. Separarlo en select + update reabriría la
-- ventana de reutilización.
create function worker_api.consume_oauth_attempt(
  p_actor_user_id        uuid,
  p_company_id           uuid,
  p_state_hash           text,
  p_browser_binding_hash text
)
returns table (
  attempt_id             uuid,
  purpose                text,
  expected_connection_id uuid,
  expected_generation    integer,
  return_path            text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_state_hash is null or p_browser_binding_hash is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  return query
  update public.oauth_attempts a
     set consumed_at = now()
   where a.state_hash = p_state_hash
     and a.browser_binding_hash = p_browser_binding_hash
     and a.actor_user_id = p_actor_user_id
     and a.company_id = p_company_id
     and a.consumed_at is null
     and a.expires_at > now()
  returning a.id, a.purpose, a.expected_connection_id, a.expected_generation, a.return_path;

  -- Un solo error para todas las causas: no se dice cuál condición falló (CA-29).
  if not found then
    raise exception 'praxa: la autorización no es válida o ya se usó' using errcode = 'PX002';
  end if;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'integration_connections_account_key' then
      raise exception 'praxa: la cuenta ya está vinculada' using errcode = 'PX007';
    elsif v_constraint = 'integration_connections_one_live_per_company' then
      raise exception 'praxa: la empresa ya tiene una conexión' using errcode = 'PX003';
    elsif v_constraint in ('integration_connections_pkey', 'integration_credentials_pkey') then
      raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
    else
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end if;
end;
$$;

-- Crea la conexión pendiente (DEC-17: vence a los 30 minutos) y guarda su credencial en la
-- misma transacción. `p_connection_id` lo genera el servidor, porque el AAD lo necesita
-- antes de cifrar (CA-11b); nunca viene del navegador. Un id que ya existe, en esta
-- empresa o en otra, da PX001 sin distinguir los casos.
create function worker_api.create_pending_connection(
  p_actor_user_id      uuid,
  p_company_id         uuid,
  p_connection_id      uuid,
  p_client_business_id text,
  p_ciphertext         text,
  p_iv                 text,
  p_auth_tag           text,
  p_key_version        integer,
  p_token_type         text,
  p_issued_for_app_id  text,
  p_granted_scopes     text[],
  p_token_expires_at   timestamptz
)
returns table (
  connection_id         uuid,
  status                text,
  pending_expires_at    timestamptz,
  credential_generation integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_client_business_id is null or p_ciphertext is null
     or p_iv is null or p_auth_tag is null or p_key_version is null
     or p_token_type is null or p_issued_for_app_id is null or p_granted_scopes is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  -- PX003 primero: no revela nada de otra empresa.
  if exists (
    select 1
    from public.integration_connections c
    where c.company_id = p_company_id
      and c.status in ('pending_selection', 'active', 'needs_reauth')
  ) then
    raise exception 'praxa: la empresa ya tiene una conexión' using errcode = 'PX003';
  end if;

  if exists (select 1 from public.integration_connections c where c.id = p_connection_id) then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;

  insert into public.integration_connections
    (id, company_id, status, client_business_id, pending_expires_at)
  values
    (p_connection_id, p_company_id, 'pending_selection', p_client_business_id,
     now() + interval '30 minutes');

  insert into private.integration_credentials
    (connection_id, company_id, ciphertext, iv, auth_tag, key_version, token_type,
     issued_for_app_id, granted_scopes, expires_at)
  values
    (p_connection_id, p_company_id, p_ciphertext, p_iv, p_auth_tag, p_key_version,
     p_token_type, p_issued_for_app_id, p_granted_scopes, p_token_expires_at);

  return query
  select c.id, c.status::text, c.pending_expires_at, c.credential_generation
  from public.integration_connections c
  where c.id = p_connection_id;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'integration_connections_account_key' then
      raise exception 'praxa: la cuenta ya está vinculada' using errcode = 'PX007';
    elsif v_constraint = 'integration_connections_one_live_per_company' then
      raise exception 'praxa: la empresa ya tiene una conexión' using errcode = 'PX003';
    elsif v_constraint in ('integration_connections_pkey', 'integration_credentials_pkey') then
      raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
    else
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end if;
end;
$$;

-- Devuelve el material cifrado para descifrar en Node. Solo lectura, sin cerrojo. Responde
-- en cualquier estado: la revocación de CA-38 la necesita en `disconnected`. Una conexión
-- propia sin credencial devuelve cero filas.
create function worker_api.get_credential(
  p_actor_user_id uuid,
  p_company_id    uuid,
  p_connection_id uuid
)
returns table (
  connection_id         uuid,
  company_id            uuid,
  provider              text,
  status                text,
  credential_generation integer,
  ciphertext            text,
  iv                    text,
  auth_tag              text,
  key_version           integer,
  token_type            text,
  issued_for_app_id     text,
  granted_scopes        text[],
  expires_at            timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform 1
  from public.integration_connections c
  where c.id = p_connection_id
    and c.company_id = p_company_id;

  if not found then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;

  return query
  select c.id, c.company_id, c.provider::text, c.status::text, c.credential_generation,
         k.ciphertext, k.iv, k.auth_tag, k.key_version, k.token_type, k.issued_for_app_id,
         k.granted_scopes, k.expires_at
  from public.integration_connections c
  join private.integration_credentials k
    on k.connection_id = c.id
   and k.company_id = c.company_id
  where c.id = p_connection_id
    and c.company_id = p_company_id;
end;
$$;

-- pending_selection → active, con cuenta, moneda y zona. El probe lo informa el servidor;
-- el vencimiento de la pendiente se verifica acá, aunque la purga no haya corrido (CA-37).
create function worker_api.confirm_connection(
  p_actor_user_id       uuid,
  p_company_id          uuid,
  p_connection_id       uuid,
  p_external_account_id text,
  p_currency            text,
  p_timezone            text,
  p_probe_succeeded     boolean
)
returns table (
  connection_id         uuid,
  status                text,
  credential_generation integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_external_account_id is null or p_currency is null
     or p_timezone is null or p_probe_succeeded is distinct from true
     or not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_timezone) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  select c.* into v_connection
  from public.integration_connections c
  where c.id = p_connection_id
    and c.company_id = p_company_id
  for update;

  if not found then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;

  if v_connection.status <> 'pending_selection' then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;

  if v_connection.pending_expires_at <= now() then
    raise exception 'praxa: la conexión pendiente venció' using errcode = 'PX005';
  end if;

  update public.integration_connections c
     set status = 'active',
         external_account_id = p_external_account_id,
         currency = p_currency,
         timezone = p_timezone,
         pending_expires_at = null,
         last_error_class = null,
         last_error_message = null
   where c.id = p_connection_id;

  return query
  select c.id, c.status::text, c.credential_generation
  from public.integration_connections c
  where c.id = p_connection_id;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'integration_connections_account_key' then
      raise exception 'praxa: la cuenta ya está vinculada' using errcode = 'PX007';
    elsif v_constraint = 'integration_connections_one_live_per_company' then
      raise exception 'praxa: la empresa ya tiene una conexión' using errcode = 'PX003';
    elsif v_constraint in ('integration_connections_pkey', 'integration_credentials_pkey') then
      raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
    else
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end if;
end;
$$;

-- Reautorización (CA-37c): reemplaza la credencial solo si la generación sigue siendo la
-- que esperaba el intento `reauth` consumido. La conexión se autoriza antes que el intento:
-- una conexión ajena da PX001 y nunca un error que dependa de sus datos.
create function worker_api.replace_credential(
  p_actor_user_id     uuid,
  p_company_id        uuid,
  p_connection_id     uuid,
  p_attempt_id        uuid,
  p_ciphertext        text,
  p_iv                text,
  p_auth_tag          text,
  p_key_version       integer,
  p_token_type        text,
  p_issued_for_app_id text,
  p_granted_scopes    text[],
  p_token_expires_at  timestamptz
)
returns table (
  connection_id         uuid,
  status                text,
  credential_generation integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_attempt    public.oauth_attempts;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_attempt_id is null or p_ciphertext is null
     or p_iv is null or p_auth_tag is null or p_key_version is null
     or p_token_type is null or p_issued_for_app_id is null or p_granted_scopes is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  select c.* into v_connection
  from public.integration_connections c
  where c.id = p_connection_id
    and c.company_id = p_company_id
  for update;

  if not found then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;

  select a.* into v_attempt
  from public.oauth_attempts a
  where a.id = p_attempt_id
    and a.company_id = p_company_id
    and a.actor_user_id = p_actor_user_id
    and a.purpose = 'reauth'
    and a.consumed_at is not null
    and a.expected_connection_id = p_connection_id;

  if not found then
    raise exception 'praxa: la autorización no es válida o ya se usó' using errcode = 'PX002';
  end if;

  if v_connection.status not in ('active', 'needs_reauth') then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;

  if v_connection.credential_generation <> v_attempt.expected_generation then
    raise exception 'praxa: la credencial cambió; volvé a empezar' using errcode = 'PX006';
  end if;

  -- Por nombre de restricción: en la lista de columnas del `on conflict` no se puede poner
  -- alias, y `connection_id` sería ambiguo con el parámetro de salida.
  insert into private.integration_credentials as k
    (connection_id, company_id, ciphertext, iv, auth_tag, key_version, token_type,
     issued_for_app_id, granted_scopes, expires_at)
  values
    (p_connection_id, p_company_id, p_ciphertext, p_iv, p_auth_tag, p_key_version,
     p_token_type, p_issued_for_app_id, p_granted_scopes, p_token_expires_at)
  on conflict on constraint integration_credentials_pkey do update
     set ciphertext = excluded.ciphertext,
         iv = excluded.iv,
         auth_tag = excluded.auth_tag,
         key_version = excluded.key_version,
         token_type = excluded.token_type,
         issued_for_app_id = excluded.issued_for_app_id,
         granted_scopes = excluded.granted_scopes,
         expires_at = excluded.expires_at;

  update public.integration_connections c
     set credential_generation = c.credential_generation + 1,
         status = 'active',
         last_error_class = null,
         last_error_message = null
   where c.id = p_connection_id;

  return query
  select c.id, c.status::text, c.credential_generation
  from public.integration_connections c
  where c.id = p_connection_id;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'integration_connections_account_key' then
      raise exception 'praxa: la cuenta ya está vinculada' using errcode = 'PX007';
    elsif v_constraint = 'integration_connections_one_live_per_company' then
      raise exception 'praxa: la empresa ya tiene una conexión' using errcode = 'PX003';
    elsif v_constraint in ('integration_connections_pkey', 'integration_credentials_pkey') then
      raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
    else
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end if;
end;
$$;

-- active → needs_reauth con una de las cuatro clases de CA-39. La generación esperada evita
-- que el error de un token viejo marque una conexión recién reautorizada. El mensaje ya
-- viene redactado por el servidor (redactErrorMessage, CA-09).
create function worker_api.mark_needs_reauth(
  p_actor_user_id       uuid,
  p_company_id          uuid,
  p_connection_id       uuid,
  p_expected_generation integer,
  p_error_class         text,
  p_error_message       text
)
returns table (
  connection_id         uuid,
  status                text,
  credential_generation integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_expected_generation is null
     or p_error_class is null or p_error_message is null
     or p_error_class not in ('authentication', 'user_action', 'permission', 'asset_access')
     or char_length(p_error_message) not between 1 and 500 then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  select c.* into v_connection
  from public.integration_connections c
  where c.id = p_connection_id
    and c.company_id = p_company_id
  for update;

  if not found then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;

  if v_connection.status <> 'active' then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;

  if v_connection.credential_generation <> p_expected_generation then
    raise exception 'praxa: la credencial cambió; volvé a empezar' using errcode = 'PX006';
  end if;

  update public.integration_connections c
     set status = 'needs_reauth',
         last_error_class = p_error_class,
         last_error_message = p_error_message
   where c.id = p_connection_id;

  return query
  select c.id, c.status::text, c.credential_generation
  from public.integration_connections c
  where c.id = p_connection_id;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'integration_connections_account_key' then
      raise exception 'praxa: la cuenta ya está vinculada' using errcode = 'PX007';
    elsif v_constraint = 'integration_connections_one_live_per_company' then
      raise exception 'praxa: la empresa ya tiene una conexión' using errcode = 'PX003';
    elsif v_constraint in ('integration_connections_pkey', 'integration_credentials_pkey') then
      raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
    else
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end if;
end;
$$;

-- Primer paso de CA-38: desde cualquier estado vivo pasa a `disconnected`, incrementa la
-- generación (invalida cualquier reautorización en curso) y deja la marca de purga. Los
-- metadatos no cambian: nulos si venía de pendiente (CA-08). Idempotente.
create function worker_api.begin_disconnect(
  p_actor_user_id uuid,
  p_company_id    uuid,
  p_connection_id uuid
)
returns table (
  connection_id         uuid,
  status                text,
  credential_generation integer,
  purge_requested_at    timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  select c.* into v_connection
  from public.integration_connections c
  where c.id = p_connection_id
    and c.company_id = p_company_id
  for update;

  if not found then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;

  if v_connection.status <> 'disconnected' then
    update public.integration_connections c
       set status = 'disconnected',
           credential_generation = c.credential_generation + 1,
           purge_requested_at = now()
     where c.id = p_connection_id;
  end if;

  return query
  select c.id, c.status::text, c.credential_generation, c.purge_requested_at
  from public.integration_connections c
  where c.id = p_connection_id;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'integration_connections_account_key' then
      raise exception 'praxa: la cuenta ya está vinculada' using errcode = 'PX007';
    elsif v_constraint = 'integration_connections_one_live_per_company' then
      raise exception 'praxa: la empresa ya tiene una conexión' using errcode = 'PX003';
    elsif v_constraint in ('integration_connections_pkey', 'integration_credentials_pkey') then
      raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
    else
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end if;
end;
$$;

-- Paso 3 de CA-38: borra la credencial y al final la fila de la conexión; los intentos
-- `reauth` que la esperaban caen por la FK en cascada. Una conexión inexistente y una de
-- otra empresa devuelven `false` sin efecto, indistinguibles, y repetir la llamada es
-- idempotente. 0013 y 0014 la reemplazan con `create or replace` para sumar sus tablas.
create function worker_api.purge_connection(
  p_actor_user_id uuid,
  p_company_id    uuid,
  p_connection_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  select c.* into v_connection
  from public.integration_connections c
  where c.id = p_connection_id
    and c.company_id = p_company_id
  for update;

  if not found then
    return false;
  end if;

  if v_connection.status <> 'disconnected' then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;

  delete from private.integration_credentials k
   where k.connection_id = p_connection_id
     and k.company_id = p_company_id;

  delete from public.integration_connections c
   where c.id = p_connection_id
     and c.company_id = p_company_id;

  return true;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'integration_connections_account_key' then
      raise exception 'praxa: la cuenta ya está vinculada' using errcode = 'PX007';
    elsif v_constraint = 'integration_connections_one_live_per_company' then
      raise exception 'praxa: la empresa ya tiene una conexión' using errcode = 'PX003';
    elsif v_constraint in ('integration_connections_pkey', 'integration_credentials_pkey') then
      raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
    else
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end if;
end;
$$;

-- Conexiones de la empresa que hay que purgar: pendientes vencidas y desconectadas. La usa
-- la purga perezosa y reanudable; `has_credential` dice si todavía corresponde intentar
-- la revocación en Meta (CA-38, paso 2).
create function worker_api.list_pending_purges(
  p_actor_user_id uuid,
  p_company_id    uuid
)
returns table (
  connection_id      uuid,
  status             text,
  reason             text,
  has_credential     boolean,
  pending_expires_at timestamptz,
  purge_requested_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  return query
  select c.id,
         c.status::text,
         case when c.status = 'disconnected' then 'disconnect_requested'
              else 'pending_expired' end,
         exists (select 1 from private.integration_credentials k
                  where k.connection_id = c.id and k.company_id = c.company_id),
         c.pending_expires_at,
         c.purge_requested_at
  from public.integration_connections c
  where c.company_id = p_company_id
    and ((c.status = 'pending_selection' and c.pending_expires_at <= now())
         or c.status = 'disconnected')
  order by c.created_at, c.id;
end;
$$;

-- ÚNICA EXCEPCIÓN a la verificación de actor y empresa (D-M06.1a-M06.2a-04): cuenta TODAS
-- las credenciales, de todas las empresas, por versión de clave, para confirmar que
-- ninguna usa la clave que se va a retirar (CA-25, paso 4). No devuelve ningún dato de
-- empresas ni de conexiones.
create function worker_api.count_credentials_by_key_version()
returns table (
  key_version      integer,
  credential_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select k.key_version, count(*)
  from private.integration_credentials k
  group by k.key_version
  order by k.key_version;
end;
$$;

-- Recifrado al usar la credencial (CA-25, paso 3). Cambia solo el material y la versión
-- de clave; la generación no, porque es el mismo token.
create function worker_api.rewrap_credential(
  p_actor_user_id         uuid,
  p_company_id            uuid,
  p_connection_id         uuid,
  p_expected_generation   integer,
  p_expected_key_version  integer,
  p_ciphertext            text,
  p_iv                    text,
  p_auth_tag              text,
  p_key_version           integer
)
returns table (
  connection_id uuid,
  key_version   integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection  public.integration_connections;
  v_key_version integer;
  v_constraint  text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_expected_generation is null
     or p_expected_key_version is null or p_ciphertext is null or p_iv is null
     or p_auth_tag is null or p_key_version is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  select c.* into v_connection
  from public.integration_connections c
  where c.id = p_connection_id
    and c.company_id = p_company_id
  for update;

  if not found then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;

  if v_connection.credential_generation <> p_expected_generation then
    raise exception 'praxa: la credencial cambió; volvé a empezar' using errcode = 'PX006';
  end if;

  select k.key_version into v_key_version
  from private.integration_credentials k
  where k.connection_id = p_connection_id
    and k.company_id = p_company_id
  for update;

  -- Sin credencial, la versión guardada tampoco es la esperada.
  if v_key_version is distinct from p_expected_key_version then
    raise exception 'praxa: la versión de clave cambió' using errcode = 'PX008';
  end if;

  update private.integration_credentials k
     set ciphertext = p_ciphertext,
         iv = p_iv,
         auth_tag = p_auth_tag,
         key_version = p_key_version
   where k.connection_id = p_connection_id
     and k.company_id = p_company_id;

  return query
  select k.connection_id, k.key_version
  from private.integration_credentials k
  where k.connection_id = p_connection_id;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'integration_connections_account_key' then
      raise exception 'praxa: la cuenta ya está vinculada' using errcode = 'PX007';
    elsif v_constraint = 'integration_connections_one_live_per_company' then
      raise exception 'praxa: la empresa ya tiene una conexión' using errcode = 'PX003';
    elsif v_constraint in ('integration_connections_pkey', 'integration_credentials_pkey') then
      raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
    else
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilegios de funciones: revoke all y después EXECUTE para el rol de C, una por una
-- ---------------------------------------------------------------------------

revoke all on function worker_api.create_oauth_attempt(uuid, uuid, text, text, text, text, timestamptz, uuid)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.create_oauth_attempt(uuid, uuid, text, text, text, text, timestamptz, uuid)
  to praxa_integrations;

revoke all on function worker_api.consume_oauth_attempt(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.consume_oauth_attempt(uuid, uuid, text, text)
  to praxa_integrations;

revoke all on function worker_api.create_pending_connection(uuid, uuid, uuid, text, text, text, text, integer, text, text, text[], timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.create_pending_connection(uuid, uuid, uuid, text, text, text, text, integer, text, text, text[], timestamptz)
  to praxa_integrations;

revoke all on function worker_api.get_credential(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.get_credential(uuid, uuid, uuid)
  to praxa_integrations;

revoke all on function worker_api.confirm_connection(uuid, uuid, uuid, text, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.confirm_connection(uuid, uuid, uuid, text, text, text, boolean)
  to praxa_integrations;

revoke all on function worker_api.replace_credential(uuid, uuid, uuid, uuid, text, text, text, integer, text, text, text[], timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.replace_credential(uuid, uuid, uuid, uuid, text, text, text, integer, text, text, text[], timestamptz)
  to praxa_integrations;

revoke all on function worker_api.mark_needs_reauth(uuid, uuid, uuid, integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.mark_needs_reauth(uuid, uuid, uuid, integer, text, text)
  to praxa_integrations;

revoke all on function worker_api.begin_disconnect(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.begin_disconnect(uuid, uuid, uuid)
  to praxa_integrations;

revoke all on function worker_api.purge_connection(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.purge_connection(uuid, uuid, uuid)
  to praxa_integrations;

revoke all on function worker_api.list_pending_purges(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.list_pending_purges(uuid, uuid)
  to praxa_integrations;

revoke all on function worker_api.count_credentials_by_key_version()
  from public, anon, authenticated, service_role;
grant execute on function worker_api.count_credentials_by_key_version()
  to praxa_integrations;

revoke all on function worker_api.rewrap_credential(uuid, uuid, uuid, integer, integer, text, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.rewrap_credential(uuid, uuid, uuid, integer, integer, text, text, text, integer)
  to praxa_integrations;
