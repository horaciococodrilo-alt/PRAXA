# M06.1a-M06.2a — Spec de la microfase

**Estado:** APROBADA

Estados posibles: `BORRADOR` → `APROBADA`. Solo el usuario pasa una spec a `APROBADA`, y solo después de una auditoría APROBABLE.

**Hash de contenido.** Se calcula sin la línea de estado:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M06.1a-M06.2a/spec.md | git hash-object --stdin
```

## Fuentes

- Ruta: `docs/FASES/FASE1/meta_first/plan.md` (fichas de `M06.1a` y `M06.2a` en la Parte I, líneas 180–208; secciones II.4 y II.5, líneas 429–495; III.2, III.3, III.4 y III.9) y `docs/FASES/FASE1/meta_first/spec.md` (secciones 5b, 7, 8, 9 y 10, CA-67, CA-68 y CB-01 a CB-06).
- Commit base: `15fc9b8` (`main`, árbol limpio al expandir). La ruta se actualizó después en `5bc7472` (excepción de `count_credentials_by_key_version`, purga de intentos en `create_oauth_attempt`, reasignación de `H-M04.1-02` a `M06.3a` y hallazgo `H-E1-21`); y en `b9d067e` (purga de intentos no consumidos ya vencidos y consumidos hace más de 10 minutos; `db:push:test` a cargo del usuario en las fichas y en III.2). Esta spec cita la ruta en `b9d067e`.
- Microfases previas en las que se apoya: `M05.1.1` (K01 `TenantContext`, `G-K01`) y `M05.1.2` a `M05.1.4` (contratos K02 a K04, `G-K02-K04` aprobado el 2026-09-26). Evidencia: `docs/FASES/FASE1/meta_first/sesiones/M05.1.1.md` y `M05.1.2-M05.1.4.md`.
- IDs cubiertos: `M06.1a` (migración `0012`) y `M06.2a` (pruebas de aislamiento, privilegios, transiciones, purga, cierre y Data API). La ruta los ejecuta como un solo ID de pipeline, `M06.1a-M06.2a`, y los cierra juntos con `G-DB-META` (plan.md:90, 191 y 431).

## Objetivo

Tomado de las fichas, sin ampliarlo:

- **M06.1a.** Crear la base del conector según DEC-03 y DEC-04: credenciales inaccesibles para los usuarios y toda escritura mediante `worker_api`.
- **M06.2a.** Probar en la base, no en el código, el aislamiento, la matriz de privilegios y el borrado completo de una empresa.

## Alcance

1. Una sola migración nueva, `supabase/migrations/0012_integrations.sql` (II.4), con:
   - encabezado con la matriz de privilegios de la sección 7 de la spec de la ruta (CA-16);
   - esquema `worker_api` no expuesto, sin privilegios para `public`, `anon` ni `authenticated`, y privilegios por defecto de funciones revocados a `public`;
   - rol `praxa_integrations` (`LOGIN`, `NOBYPASSRLS`, `NOINHERIT`), **sin contraseña**, con `USAGE` sobre `worker_api`;
   - enums `integration_provider` y `connection_status`;
   - tablas `public.oauth_attempts`, `public.integration_connections` y `private.integration_credentials`, en cascada desde `companies` (CA-68), con RLS habilitada y forzada (CA-14), `revoke all` explícito antes de cada grant (CA-17), restricciones por estado (CA-08), intentos con propósito (CA-02c) y marca de purga pendiente (CA-38);
   - las columnas que exigen los contratos K02 a K04, incluidas `created_at` y `provider` de `oauth_attempts` (`H-E1-19`);
   - la política de lectura de conexiones con `private.is_company_member(company_id)` y el único grant `select` para `authenticated`;
   - las doce funciones `SECURITY DEFINER` de `worker_api` de la tabla de II.4, cada una con el chequeo de pertenencia del actor y de la conexión, salvo `count_credentials_by_key_version`, que es global y no recibe actor ni empresa (única excepción de la ruta, plan.md:452; `D-M06.1a-M06.2a-04`);
   - la purga de intentos OAuth vencidos sin consumir y consumidos hace más de 10 minutos dentro de `create_oauth_attempt` (CA-38b; plan.md:456; `D-M06.1a-M06.2a-03`);
   - privilegios revocados también a `service_role` en las tres tablas y en las doce funciones (`D-M06.1a-M06.2a-01`).
2. Las pruebas pgTAP `08`, `09`, `09b` y `10` y la prueba `test:app` de la Data API (II.5, pasos 1 a 5).
3. La resolución de la hipótesis del `RESTRICT` de `reports` (`H-E1-07`) con la parte 1 de la prueba `10` y, **solo si la confirma**, la corrección dentro de `0012` antes de su primer push, según el procedimiento condicional de la sección 9 (ficha de M06.2a, "Condición para avanzar"; `D-M06.1a-M06.2a-05`).
4. La evidencia de cierre: salida de `db:check:test`, `db:push:test`, `test:policies`, `test:app` y `verify`.

## Fuera de alcance

- Cifrado y descifrado, llavero `PRAXA_CREDENTIAL_KEYS`, cliente `pg` del rol de C (`src/modules/integrations/db/worker-api.ts`), repositorio de credenciales, mover `pg` a `dependencies`, extender `no-privileged-credentials` y `check-target` para `PRAXA_INTEGRATIONS_TEST_DB_URL`, y documentar la excepción en `SECURITY.md` y `ARCHITECTURE.md`: todo es de `M06.3a`.
- Fijar la contraseña del rol `praxa_integrations`, en cualquier proyecto (intervención del usuario en `M06.3a` y `M28.2a`).
- Aplicar `0012` al proyecto `app` (`M28.2a`, paso 3, ejecutado por el usuario).
- `force row level security` sobre las tablas existentes y el cambio de dueño de las funciones a un rol sin `bypassrls`: pendientes declarados en CA-14, fuera de la ruta.
- Las tablas de `0013` (snapshots, ejecuciones, cobertura) y `0014` (registro del chat), y los `create or replace` de `purge_connection` que las suman. En `0012`, `current_sync_run_id` queda sin clave foránea: la agrega `0013`.
- Rutas OAuth, canje de código, `debug_token`, listado de cuentas, probe, revocación en Meta, orquestación de la purga perezosa (`lifecycle.ts`) y UI: `M16.1` y `M16.2`.
- Registrar un error de clase `desconocido`, `límite`, `temporal`, `transporte` o `error propio` sin cambiar el estado (CA-39): ninguna función de la tabla de II.4 lo hace y `authenticated` no escribe. Registrado como `H-E1-22`, asignado a `M16.1` y `M16.2`.
- Cerrar la excepción `SUPABASE_TEST_ALLOW_APP_PROJECT` (`H-M04.1-02`): asignado a `M06.3a`, paso 7c de II.6 (plan.md:513; `HALLAZGOS.md:8`; `D-M06.1a-M06.2a-06`). Esta microfase no toca `scripts/lib/target.mjs`, `tests/app/helpers.ts` ni `docs/SECURITY.md`.
- Resolver `H-E1-18` (fallo intermitente del pool de Vitest al arrancar el worker de `tests/component/onboarding-wizard.test.tsx`): se difiere con motivo (`D-M06.1a-M06.2a-09`). Es un fallo de una prueba de UI, ajeno a esta microfase de base de datos, y se resuelve como tarea aparte. Esta microfase no toca `vitest.config.mts`; si aparece en `verify`, se aplica la Verificación, paso 5.
- Destrabar una conexión `pending_selection` vigente cuando el dueño quiere empezar de nuevo (`H-E1-21`): lo definen `M16.1` y `M16.2`. Esta microfase solo fija que la base rechaza un `reauth` sobre una pendiente (`D-M06.1a-M06.2a-02`).
- Una prueba de concurrencia real del consumo de intentos (dos conexiones en paralelo): no figura en II.5. La atomicidad se garantiza por construcción (una sola sentencia) y se revisa en el código (C-18).
- Cambios en `supabase/config.toml`: `worker_api` ya no figura entre los esquemas expuestos (`config.toml:24`).

## Contexto verificado en el código

| Qué | Dónde (archivo:línea) | Qué implica para esta microfase |
|---|---|---|
| Hay once migraciones; la siguiente libre es `0012` | `supabase/migrations/` (0001 a 0011) | El archivo nuevo es `0012_integrations.sql`. Ninguna existente se toca (CB-03) |
| Patrón de privilegios: `revoke all` y después grant operación por operación, con matriz en el encabezado | `0004_grants.sql:1-23` (matriz), `:29-34` (revokes), `:37-48` (grants); `0001_schemas_and_identity.sql:226-234` | Se sigue el mismo estilo, objeto por objeto |
| Funciones con `set search_path = ''` y objetos calificados | `0001_schemas_and_identity.sql:62-88`, `0007_write_path_locking.sql:44-62` | Todas las funciones nuevas lo repiten |
| `private.is_company_member()` lanza `42501` si `auth.uid()` es nulo | `0001_schemas_and_identity.sql:69-75` | No sirve dentro de `worker_api` (no hay JWT). La pertenencia se verifica contra `public.company_members` por `p_actor_user_id` (II.4, segunda trampa). En pgTAP, las lecturas como `authenticated` necesitan `request.jwt.claims` |
| `private` no da `USAGE` a `public` ni a `anon`; sí a `authenticated` | `0001_schemas_and_identity.sql:13-17` | `praxa_integrations` no puede ni nombrar `private.integration_credentials`; `authenticated` llega al esquema pero no a la tabla |
| `private.touch_updated_at()` existe, `SECURITY INVOKER` | `0001_schemas_and_identity.sql:123-133` | Se reutiliza para el `updated_at` de las conexiones |
| `private.lock_company(uuid)` existe y fija el orden de adquisición (cerrojo de empresa, después filas) | `0007_write_path_locking.sql:44-62`; `docs/SECURITY.md:68-71` | Las funciones de escritura de `worker_api` lo toman antes de tocar filas |
| Convención de errores existente: `42501` autorización, `22023` argumento inválido, `PT409` para conflictos por PostgREST | `0011_revision_conflict_code.sql:1-15`, `:31-50` | `worker_api` no pasa por PostgREST, así que usa su propio catálogo `PX…` (ver Diseño) para no confundir un rechazo de negocio con un privilegio faltante (`42501`) |
| `companies.owner_id` con `on delete restrict`; `company_context_versions.created_by` sin acción | `0001_schemas_and_identity.sql:26`; `0002_company_context.sql:43` | El cierre (CA-67) borra primero la empresa y después el usuario (`H-E1-06`) |
| `reports_context_fkey` con `on delete restrict` hacia `company_context_versions` | `0003_reports.sql:31-33` | Hipótesis `H-E1-07`: la cascada desde `companies` puede fallar según el orden de las acciones referenciales. La resuelve la prueba `10` |
| Excepción administrativa de borrado: rol `service_role`, `supabase_admin` o `postgres` **y** `auth.uid()` nulo | `0008_admin_activation.sql:27-41`; `docs/SECURITY.md:184-205` | La prueba `10` borra como `postgres` sin claims, igual que el SQL editor (CA-67, paso 2) |
| `05_delete_carveout` prueba la cascada de contexto **sin reportes** | `supabase/tests/05_delete_carveout.test.sql:160-183` | La prueba `10` agrega el reporte y las tablas de integración |
| Patrón pgTAP: `begin` / `plan(N)` / `finish()` / `rollback`, `pg_temp.affected`, claims con `set_config`, `set local role` | `supabase/tests/01_tenant_isolation.test.sql:11-50`, `05_delete_carveout.test.sql:13-39` y `:96-98` | Las pruebas nuevas usan el mismo esqueleto |
| `03_privileges` cuenta solo funciones con nombre propio | `supabase/tests/03_privileges.test.sql:185-220` | Un helper nuevo en `private`, `SECURITY INVOKER`, no altera sus conteos |
| `test:policies` corre todos los `*.test.sql` ordenados por nombre, con la conexión de `SUPABASE_TEST_DB_URL`; un error SQL invalida el archivo entero | `scripts/run-pgtap.mjs:27`, `:150-159`, `:163`, `:74-99` | `09_…` corre antes que `09b_…` y este antes que `10_…`. Los rechazos esperados se prueban con `throws_ok`, nunca dejando que el error corte el archivo |
| Guarda del destino SQL: solo `SUPABASE_TEST_DB_URL`, proyecto desechable y distinto del de la app | `scripts/lib/sql-target.mjs:28-106` | La prueba `test:app` la reutiliza para sembrar fixtures por SQL |
| `db:push:test` aplica con `supabase db push --db-url` sobre `SUPABASE_TEST_DB_URL` | `scripts/db-push.mjs:28-41`; `package.json:24` | Las migraciones corren como el usuario de esa URL (`postgres`), que queda como dueño de tablas y funciones |
| `db:preview` apunta al proyecto **`app`** | `package.json:22`; `scripts/db-push.mjs:27-31` | No se usa en esta microfase (trampa) |
| `db:check:test` verifica el destino de pruebas | `package.json:21`; `scripts/check-target.mjs:9-42` | Se corre antes de pedir el push |
| Scripts de verificación | `package.json:17` (`test:app`), `:18` (`test:policies`), `:21` (`db:check:test`), `:24` (`db:push:test`), `:26` (`verify`) | Son los comandos de los casos de prueba |
| `pg` está en `devDependencies` | `package.json:49` | Las pruebas `app` pueden usarlo; pasarlo a `dependencies` es de `M06.3a` |
| Proyecto `app` de Vitest: entorno node, `setupFiles` que carga `.env.local`, sin paralelismo por archivo | `vitest.config.mts:47-58`; `tests/app/setup.ts:12-15` | La prueba nueva de la Data API corre en serie con las demás |
| Fixtures `test:app`: usuarios confirmados, `blockedReason()`, `cleanupRun()` borra empresas y después usuarios | `tests/app/helpers.ts:40-65`, `:115-138`, `:152-180` | La prueba nueva reutiliza los helpers sin modificarlos; la limpieza por cascada arrastra conexiones y credenciales |
| La excepción `SUPABASE_TEST_ALLOW_APP_PROJECT` | `tests/app/helpers.ts:56-61`; `scripts/lib/target.mjs:182-188` | `H-M04.1-02`, reasignado a `M06.3a` en `HALLAZGOS.md:8` (`5bc7472`): fuera de alcance (`D-M06.1a-M06.2a-06`). La prueba nueva siembra por `resolveSqlTestTarget`, que no reconoce la excepción |
| Esquemas expuestos localmente: `public` y `graphql_public` | `supabase/config.toml:24` | `worker_api` no se agrega; `test:app` verifica que el remoto tampoco lo exponga |
| Versión de Postgres declarada: 17 | `supabase/config.toml:52` | Afecta la membresía para `set role` (hipótesis H-S-02) |
| K01: `user_id`, `company_id`, `role = owner`, `request_id` | `src/modules/tenant/context.ts:21-26` | `p_actor_user_id` y `p_company_id` salen de ahí en `M06.3a`/`M16.x` |
| K02: campos `id`, `provider`, `company_id`, `actor_user_id`, `state_hash`, `browser_binding_hash`, `return_path`, `created_at`, `expires_at`, `consumed_at`, `purpose`, `expected_connection_id`, `expected_generation` | `src/modules/integrations/contract/oauth-attempt.ts:57-96` | Columnas exactas de `oauth_attempts` |
| K02: vida máxima de 10 minutos, ratificada por el usuario | `oauth-attempt.ts:26`; hallazgo `H-E1-19` en `HALLAZGOS.md` | La base la hace cumplir con un `check` (decisión que `H-E1-19` asigna a esta microfase; `D-M06.1a-M06.2a-10`) |
| K02: hashes SHA-256 hex en minúsculas; retorno en allowlist exacta `['/app/integraciones']`; proveedor `['meta']` | `src/modules/integrations/contract/primitives.ts:15`, `:84-86`, `:33` | `check` equivalentes en la base |
| K03: estados y transiciones declaradas | `primitives.ts:37-54` | La base aplica las mismas transiciones en `worker_api` |
| K03: clases de error y las cuatro que llevan a `needs_reauth`; mensaje de hasta 500 caracteres | `primitives.ts:94-119` | `check` sobre `last_error_class`, sobre la clase en `needs_reauth` y sobre la longitud |
| K03: registro con metadatos "todos o ninguno", obligatorios en `active` y `needs_reauth`, `pending_expires_at` obligatorio en `pending_selection`, `purge_requested_at` solo en `disconnected`, clase y mensaje de error juntos | `src/modules/integrations/contract/connection.ts:54-138` | Restricciones `check` de la tabla (CA-08, CA-09) |
| K03: formato de cuenta, negocio, moneda y zona | `connection.ts:26-52` | Mismos patrones en la base; la existencia de la moneda la valida Zod |
| K04: campos, IV de 12 bytes, etiqueta de 16, `key_version` entero positivo, `token_type` `system_user`, permisos con `ads_read` sin repetidos, expiración nullable | `src/modules/integrations/contract/credential.ts:21-60` | Columnas y `check` de `private.integration_credentials` |
| K04: AAD = versión, proveedor, empresa y conexión | `credential.ts:83-86` | El identificador de la conexión tiene que existir **antes** de cifrar: `create_pending_connection` lo recibe del servidor |
| Pendientes que `M05.1.2-M05.1.4` dejó para M06.1a | `sesiones/M05.1.2-M05.1.4.md:148-151` | `created_at` y `provider`; mismas clases, estados y columnas; `check` de vida máxima |
| Supabase concede por defecto `select/insert/update/delete` a `anon`, `authenticated` y `service_role` sobre tablas nuevas de `public` en proyectos existentes, y un grant faltante da `42501` por la Data API | Documentación oficial "Securing your API" (https://supabase.com/docs/guides/api/securing-your-api), consultada al expandir | Por eso cada tabla empieza con `revoke all`, y por eso también se revoca a `service_role` (`D-M06.1a-M06.2a-01`) |

## Diseño concreto

### 1. Convenciones de la migración

- Un solo archivo, `supabase/migrations/0012_integrations.sql`, en este orden: encabezado, esquema, rol, enums, helper privado, tablas (conexiones, intentos, credenciales), índices, RLS y privilegios de tablas, funciones y privilegios de funciones.
- Todo objeto calificado con su esquema. Toda función con `set search_path = ''`.
- **Dentro de las funciones, toda columna se califica con alias de tabla** (`c.status`, `a.consumed_at`). Los parámetros de salida de `returns table (...)` comparten nombre con columnas (`status`, `connection_id`), y PL/pgSQL rechaza la referencia ambigua en tiempo de ejecución.
- **En funciones que devuelven columnas con el mismo nombre que una columna de tabla, el `on conflict` se escribe por nombre de restricción** (`on conflict on constraint integration_credentials_pkey`), nunca por lista de columnas (`on conflict (connection_id)`). En la lista de columnas del `on conflict` no se puede poner alias de tabla, así que la regla anterior no alcanza y PL/pgSQL la toma como ambigua con el parámetro de salida.
- Mensajes de error fijos, con prefijo `praxa:`, sin identificadores, hashes, valores de parámetros ni texto de Meta (sección 7, paso 3: "error tipado sin detalles"; CA-09; CB-02).
- La migración no contiene la palabra `password` ni ningún valor secreto.

### 2. Encabezado (CA-16)

Comentario SQL con:

1. La matriz completa de la sección 7 de la spec de la ruta (spec.md:157-168), con las columnas `anon`, `authenticated`, rol de C y `PUBLIC`, más una columna `service_role` con "—" en todas las filas (`D-M06.1a-M06.2a-01`). Las filas de `meta_daily_coverage`, snapshots, ejecuciones y `chat_query_records` se marcan "prevista en `0013`/`0014`; no existe todavía".
2. Las reglas de la sección 7: `revoke all` antes de cada grant, funciones `SECURITY DEFINER` con `search_path` vacío, rol `LOGIN` y `NOBYPASSRLS` sin grants sobre tablas, rol sin contraseña, `worker_api` no expuesto (verificarlo en el dashboard en `M28.2a`). Y la única excepción de II.4: `count_credentials_by_key_version` no recibe actor ni empresa y devuelve solo conteos por versión de clave (`D-M06.1a-M06.2a-04`).
3. El límite declarado de la sección 7, paso 4 (sin JWT por la conexión del rol de C) y la aclaración de CA-14 sobre `force` y `bypassrls`.
4. El catálogo de errores tipados (sección 6 de este diseño).

### 3. Esquema y rol

```sql
create schema worker_api;
revoke all on schema worker_api from public, anon, authenticated;
alter default privileges in schema worker_api revoke execute on functions from public;

do $$                                                          -- sin contraseña
declare
  v_membership record;
begin                                                          -- idempotente (D-16, `-18`)
  if exists (select 1 from pg_catalog.pg_roles r where r.rolname = 'praxa_integrations') then
    if exists (select 1 from pg_catalog.pg_roles r
                where r.rolname = 'praxa_integrations' and r.rolsuper) then
      raise exception 'praxa: praxa_integrations ya existe con SUPERUSER; resolverlo a mano';
    end if;

    -- Revoca cualquier membresía heredada: NOINHERIT no evita SET ROLE.
    for v_membership in
      select r.rolname as target
        from pg_catalog.pg_auth_members m
        join pg_catalog.pg_roles member_role on member_role.oid = m.member
        join pg_catalog.pg_roles r on r.oid = m.roleid
       where member_role.rolname = 'praxa_integrations'
    loop
      execute format('revoke %I from praxa_integrations', v_membership.target);
    end loop;

    alter role praxa_integrations
      login nobypassrls noinherit nocreatedb nocreaterole noreplication;
  else
    create role praxa_integrations
      login nobypassrls noinherit nocreatedb nocreaterole noreplication;
  end if;
end;
$$;
grant usage on schema worker_api to praxa_integrations;
```

El rol no recibe nada más: ni `USAGE` sobre `private`, ni privilegios sobre tablas. Si el rol ya existe, se le vuelven a fijar los mismos atributos y no se toca su contraseña (`D-M06.1a-M06.2a-16`). Además, si ya es miembro de otro rol, se le revoca esa membresía (`NOINHERIT` no evita `SET ROLE`), y si ya es `SUPERUSER` la migración se detiene: `postgres` no tiene permiso para quitarle ese atributo (`D-M06.1a-M06.2a-18`).

### 4. Tipos

```sql
create type public.integration_provider as enum ('meta');                        -- CA-05
create type public.connection_status as enum
  ('pending_selection', 'active', 'needs_reauth', 'disconnected');               -- CA-07
```

`purpose`, `last_error_class` y `token_type` son `text` con `check` (decisión no material: agregar un valor a un `check` es un `alter` simple en una migración nueva; el contrato Zod sigue siendo la fuente del conjunto).

### 5. Tablas

#### 5.1 `public.integration_connections` (K03)

| Columna | Tipo | Nulo | Default / regla |
|---|---|---|---|
| `id` | `uuid` | no | PK. Lo genera el servidor (ver `create_pending_connection`) |
| `company_id` | `uuid` | no | FK `public.companies(id) on delete cascade` |
| `provider` | `public.integration_provider` | no | `'meta'` |
| `status` | `public.connection_status` | no | `'pending_selection'` |
| `external_account_id` | `text` | sí | `check (external_account_id ~ '^[A-Za-z0-9_-]{1,64}$')` |
| `client_business_id` | `text` | sí | misma forma |
| `currency` | `text` | sí | `check (currency ~ '^[A-Z]{3}$')` |
| `timezone` | `text` | sí | `check (timezone = 'UTC' or timezone ~ '^[A-Z][A-Za-z_]+(/[A-Za-z0-9_+-]+)+$')` |
| `credential_generation` | `integer` | no | `0`, `check (>= 0)` |
| `pending_expires_at` | `timestamptz` | sí | — |
| `purge_requested_at` | `timestamptz` | sí | — |
| `current_sync_run_id` | `uuid` | sí | sin FK hasta `0013` |
| `last_error_class` | `text` | sí | `check` en las nueve clases de `primitives.ts:94-104` |
| `last_error_message` | `text` | sí | `check (char_length(last_error_message) between 1 and 500)` |
| `created_at`, `updated_at` | `timestamptz` | no | `now()`; trigger `before update` con `private.touch_updated_at()` |

Restricciones con nombre:

- `integration_connections_company_id_id_key unique (company_id, id)`: destino de las FK compuestas (patrón de `0002`).
- `integration_connections_account_key unique (company_id, provider, external_account_id)` (CA-18). Los `null` no chocan entre sí.
- `integration_connections_metadata_together check (num_nonnulls(external_account_id, currency, timezone) in (0, 3))` (CA-08, `connection.ts:118-129`).
- `integration_connections_metadata_required check (status not in ('active', 'needs_reauth') or num_nonnulls(external_account_id, currency, timezone) = 3)` (CA-08).
- `integration_connections_pending_expiry check (status <> 'pending_selection' or pending_expires_at is not null)` (DEC-17).
- `integration_connections_purge_mark check ((status = 'disconnected') = (purge_requested_at is not null))` (CA-38).
- `integration_connections_error_pair check ((last_error_class is null) = (last_error_message is null))` (CA-09).
- `integration_connections_reauth_class check (status <> 'needs_reauth' or (last_error_class is not null and last_error_class in ('authentication', 'user_action', 'permission', 'asset_access')))` (CA-39, `primitives.ts:111-116`). El `is not null` es necesario: sin él, una clase nula hace que el `in` dé `null` y el `check` pase; K03 exige la clase en `needs_reauth` (`connection.ts:96-104`).

Índice único parcial `integration_connections_one_live_per_company on (company_id) where status in ('pending_selection', 'active', 'needs_reauth')` (CA-18).

#### 5.2 `public.oauth_attempts` (K02)

| Columna | Tipo | Nulo | Default / regla |
|---|---|---|---|
| `id` | `uuid` | no | PK, `gen_random_uuid()` |
| `provider` | `public.integration_provider` | no | `'meta'` |
| `company_id` | `uuid` | no | FK `public.companies(id) on delete cascade` |
| `actor_user_id` | `uuid` | no | FK `auth.users(id) on delete cascade` (patrón de `company_members`, `0001:45`) |
| `purpose` | `text` | no | `check (purpose in ('initial', 'reauth'))` |
| `expected_connection_id` | `uuid` | sí | FK compuesta `(company_id, expected_connection_id)` → `integration_connections (company_id, id) on delete cascade` |
| `expected_generation` | `integer` | sí | `check (>= 0)` |
| `state_hash` | `text` | no | `check (state_hash ~ '^[0-9a-f]{64}$')`, `unique` |
| `browser_binding_hash` | `text` | no | `check (browser_binding_hash ~ '^[0-9a-f]{64}$')` |
| `return_path` | `text` | no | `check (return_path in ('/app/integraciones'))` (espejo de `primitives.ts:84`) |
| `created_at` | `timestamptz` | no | `now()` |
| `expires_at` | `timestamptz` | no | `check (expires_at > created_at and expires_at <= created_at + interval '10 minutes')` (CA-02, `H-E1-19`, `D-M06.1a-M06.2a-10`) |
| `consumed_at` | `timestamptz` | sí | — |

`oauth_attempts_purpose_shape check ((purpose = 'initial' and expected_connection_id is null and expected_generation is null) or (purpose = 'reauth' and expected_connection_id is not null and expected_generation is not null))` (CA-02c). Índice en `(company_id)` y en `(company_id, expected_connection_id)`.

#### 5.3 `private.integration_credentials` (K04)

| Columna | Tipo | Nulo | Regla |
|---|---|---|---|
| `connection_id` | `uuid` | no | PK |
| `company_id` | `uuid` | no | FK compuesta `(company_id, connection_id)` → `public.integration_connections (company_id, id) on delete cascade` (CA-13, CA-68) |
| `ciphertext` | `text` | no | base64 no vacío, igual que `base64Schema.min(1)` (`primitives.ts:18-20`, `credential.ts:42`; en la tabla, la alternancia del regex va escapada como `\|`): `check (char_length(ciphertext) >= 1 and ciphertext ~ '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==\|[A-Za-z0-9+/]{3}=)?$')` |
| `iv` | `text` | no | Exactamente 12 bytes decodificados (`GCM_IV_BYTES`, `credential.ts:22`, `:43`): `check (iv ~ '^[A-Za-z0-9+/]{16}$')`. Una cadena base64 de 16 caracteres decodifica a 12 bytes **solo** si no tiene relleno; con `=` o `==` decodifica a 11 o 10, y el regex la rechaza. Es equivalente a `base64OfBytes(12)` sin decodificar |
| `auth_tag` | `text` | no | Exactamente 16 bytes decodificados (`GCM_AUTH_TAG_BYTES`, `credential.ts:23`, `:44`): `check (auth_tag ~ '^[A-Za-z0-9+/]{22}==$')`. Una cadena base64 de 24 caracteres decodifica a 16 bytes **solo** si termina en `==` |
| `key_version` | `integer` | no | `check (> 0)` |
| `token_type` | `text` | no | `check (token_type in ('system_user'))` |
| `issued_for_app_id` | `text` | no | `check (~ '^[A-Za-z0-9_-]{1,64}$')` |
| `granted_scopes` | `text[]` | no | `check (private.valid_granted_scopes(granted_scopes))` (helper de la sección 7): igual que `credential.ts:49-57`, al menos un elemento, ninguno nulo, ninguno repetido, cada uno con la forma de `scopeSchema` (`^[a-z][a-z0-9_]{0,63}$`, `credential.ts:35`) e incluye `ads_read` |
| `expires_at` | `timestamptz` | sí | — (CA-11c, CA-31) |

Sin columnas extra: la fila coincide con `secretCredentialSchema` (strict). No hay columna de texto plano (CA-10).

#### 5.4 RLS y privilegios de tablas

En cada tabla, en este orden:

```sql
revoke all on <tabla> from public, anon, authenticated, service_role;   -- D-M06.1a-M06.2a-01
alter table <tabla> enable row level security;
alter table <tabla> force row level security;
```

Después, solo:

```sql
create policy integration_connections_select_member
  on public.integration_connections for select to authenticated
  using (private.is_company_member(company_id));

grant select on public.integration_connections to authenticated;
```

`oauth_attempts` y `integration_credentials` no tienen políticas ni grants. En `integration_credentials`, la revocación a `service_role` la exige además CA-15 (nadie salvo el dueño de las funciones tiene privilegios); en las otras dos tablas la fija `D-M06.1a-M06.2a-01`.

### 6. Catálogo de errores tipados

| SQLSTATE | Clave | Cuándo | Mensaje (fijo) |
|---|---|---|---|
| `PX001` | `not_authorized` | Actor o empresa nulos, actor que no es miembro de la empresa, conexión o intento inexistente o de otra empresa. Indistinguibles a propósito. Incluye un `p_connection_id` ya existente en `create_pending_connection`, propio o ajeno, salvo el reintento de la misma llamada sobre una pendiente propia, que devuelve la fila (`D-M06.1a-M06.2a-11`). Excepción: en `purge_connection`, una conexión inexistente y una de otra empresa no dan `PX001` sino `false`, también indistinguibles (sección 8) | `praxa: operación no autorizada` |
| `PX002` | `attempt_rejected` | El intento no se puede consumir o usar (desconocido, vencido, consumido, de otro actor, de otra empresa, con otro hash de vinculación, o propósito que no corresponde). Un solo error, sin decir cuál condición falló (CA-29) | `praxa: la autorización no es válida o ya se usó` |
| `PX003` | `live_connection_exists` | Intento `initial` o conexión pendiente con una conexión viva en la empresa (CA-28, CA-18), salvo el reintento de `create_pending_connection` (`D-M06.1a-M06.2a-11`) | `praxa: la empresa ya tiene una conexión` |
| `PX004` | `invalid_transition` | Transición no declarada en CA-07, o función aplicada en un estado que no la admite. El reintento de una transición ya aplicada, con los mismos parámetros, no es una transición nueva: devuelve la fila (`D-M06.1a-M06.2a-12`, `-13`) | `praxa: transición de estado no permitida` |
| `PX005` | `pending_expired` | `confirm_connection` con `pending_expires_at <= now()` (CA-37, DEC-17) | `praxa: la conexión pendiente venció` |
| `PX006` | `generation_mismatch` | La generación de credencial no es la esperada (CA-37c, CA-38c) | `praxa: la credencial cambió; volvé a empezar` |
| `PX007` | `account_conflict` | La cuenta ya está en otra fila de la empresa (violación de `integration_connections_account_key`) | `praxa: la cuenta ya está vinculada` |
| `PX008` | `key_version_mismatch` | `rewrap_credential` con una versión de clave que ya no es la guardada | `praxa: la versión de clave cambió` |
| `22023` | `invalid_argument` | Parámetro con forma inválida o nulo cuando es obligatorio, versión de clave no posterior a la guardada en `rewrap_credential` (`D-M06.1a-M06.2a-15`), o violación de integridad sin código propio: `23514`, `23502`, `23503` y los `23505` que no son de cuenta, conexión viva ni clave primaria de conexión (por ejemplo, `state_hash` repetido). Ver la traducción de la sección 8 | `praxa: argumento inválido` |

Motivo (decisión no material): `worker_api` no pasa por PostgREST y lo consume el cliente de `M06.3a`, que traduce cada código a un error tipado. Usar `42501` para el rechazo de negocio lo haría indistinguible de un privilegio faltante, que es justo lo que prueban `09` y `test:app`. Ningún código termina en `000` (códigos de categoría).

### 7. Helper privado

```sql
create function private.assert_worker_actor(p_actor_user_id uuid, p_company_id uuid)
returns void language plpgsql stable security invoker set search_path = '' ...
```

Lanza `PX001` si alguno es nulo o si no existe la fila `(p_company_id, p_actor_user_id)` en `public.company_members`. `revoke all ... from public, anon, authenticated, service_role`; sin grants: solo lo llaman las funciones de `worker_api`, que corren como su dueño.

```sql
create function private.valid_granted_scopes(p_scopes text[])
returns boolean language sql immutable set search_path = '' as $$
  select p_scopes is not null
     and pg_catalog.array_ndims(p_scopes) = 1
     and pg_catalog.cardinality(p_scopes) >= 1
     and pg_catalog.array_position(p_scopes, null) is null
     and 'ads_read' = any (p_scopes)
     and (select pg_catalog.count(*) = pg_catalog.count(distinct s)
                 and pg_catalog.bool_and(s ~ '^[a-z][a-z0-9_]{0,63}$')
            from pg_catalog.unnest(p_scopes) as s)
$$;
```

Espejo de `granted_scopes` en `credential.ts:49-57`. Es una función porque un `check` no admite subconsultas. `SECURITY INVOKER` e inmutable. Mismos `revoke all`, sin grants. La evalúa quien inserta en `private.integration_credentials`, y eso solo lo hace el dueño de las funciones de `worker_api` (y `postgres` en las pruebas), así que no necesita `EXECUTE` para nadie más.

### 8. Funciones de `worker_api`

Reglas comunes a las doce:

- `language plpgsql`, `security definer`, `set search_path = ''`.
- Primer paso: `perform private.assert_worker_actor(p_actor_user_id, p_company_id)`. Única excepción: `count_credentials_by_key_version`, que no recibe actor ni empresa (plan.md:452; `D-M06.1a-M06.2a-04`).
- Todas las que escriben, **excepto `consume_oauth_attempt`**, toman `perform private.lock_company(p_company_id)` después del chequeo de pertenencia y antes de tocar filas. `consume_oauth_attempt` no toma el cerrojo: se serializa con su única sentencia `update … returning`, que bloquea la fila del intento.
- **Lectura de la conexión existente.** Las funciones que actúan sobre una conexión que ya existe (`get_credential`, `confirm_connection`, `replace_credential`, `mark_needs_reauth`, `begin_disconnect`, `purge_connection`, `rewrap_credential`, y `create_oauth_attempt` con propósito `reauth`) leen la fila filtrando por `id` **y** `company_id` (con `for update` las que escriben), después del chequeo de pertenencia, del chequeo de nulos y del cerrojo, y **antes de cualquier chequeo propio de la función** (intento, estado, generación, versión de clave). Si no hay fila: `PX001`, salvo en `purge_connection`, que devuelve `false`. Así, una conexión de otra empresa da siempre `PX001` y nunca un error que dependa de sus datos. La regla no aplica a `create_pending_connection` (crea la fila; el choque de `p_connection_id` tiene su propia regla), a `create_oauth_attempt` con propósito `initial`, a `consume_oauth_attempt`, a `list_pending_purges` ni a `count_credentials_by_key_version`.
- Privilegios, función por función y con la firma completa:

  ```sql
  revoke all on function worker_api.<f>(<firma>) from public, anon, authenticated, service_role;   -- D-M06.1a-M06.2a-01
  grant execute on function worker_api.<f>(<firma>) to praxa_integrations;
  ```
- Los parámetros de texto con forma inválida dan `22023`. Todo parámetro obligatorio nulo da `22023` con un chequeo explícito, después del chequeo de actor y antes de tocar filas (así un `p_expires_at` nulo no pasa la comparación de rango por ser `null`). Solo son opcionales `p_expected_connection_id` de `create_oauth_attempt` y `p_token_expires_at` de `create_pending_connection` y `replace_credential`.
- **Traducción de errores de integridad.** Cada función captura los errores de clase `23` y los relanza con un código del catálogo y su mensaje fijo, **sin `DETAIL` ni `HINT`**: Postgres adjunta a `23502` y `23505` la fila o la clave que falló, con hashes, identificadores o material cifrado (C-35, CB-02). El nombre de la restricción se obtiene con `get stacked diagnostics … = constraint_name`:

  | Error de origen | Restricción | Se relanza como |
  |---|---|---|
  | `23514` | cualquier `check` | `22023` |
  | `23502` | cualquier `not null` (red de seguridad del chequeo explícito de nulos) | `22023` |
  | `23505` | `integration_connections_account_key` | `PX007` |
  | `23505` | `integration_connections_one_live_per_company` | `PX003` |
  | `23505` | `integration_connections_pkey` o `integration_credentials_pkey` (choque de `p_connection_id`) | `PX001` |
  | `23505` | `oauth_attempts_state_hash_key` y cualquier otra unicidad | `22023` |
  | `23503` y cualquier otro `23xxx` | — | `22023` |

  Ningún SQLSTATE de clase `23` sale crudo de `worker_api`.

| Función (firma) | Devuelve | Comportamiento |
|---|---|---|
| `create_oauth_attempt(p_actor_user_id uuid, p_company_id uuid, p_purpose text, p_state_hash text, p_browser_binding_hash text, p_return_path text, p_expires_at timestamptz, p_expected_connection_id uuid default null)` | `table (attempt_id uuid, purpose text, expected_connection_id uuid, expected_generation integer, created_at timestamptz, expires_at timestamptz)` | Cerrojo de empresa. Después de la purga (ver abajo), **reintento** (`D-M06.1a-M06.2a-20`): si ya existe una fila con el mismo `state_hash`, actor, empresa y `browser_binding_hash`, sin consumir y sin vencer, devuelve esa fila sin insertar otra; con otro `browser_binding_hash`, el `state_hash` repetido sigue dando `22023` por su restricción `unique` (T-46). Si no es un reintento, **purga** de esa empresa (CA-38b; plan.md:456; `D-M06.1a-M06.2a-03`): `delete from public.oauth_attempts a where a.company_id = p_company_id and ((a.consumed_at is null and a.expires_at <= now()) or a.consumed_at < now() - interval '10 minutes')`. Borra los no consumidos ya vencidos y los consumidos hace **más de** 10 minutos (`<`, no `<=`: uno consumido hace exactamente 10 minutos se conserva). Un intento consumido se conserva hasta entonces aunque ya haya vencido, porque `replace_credential` lo necesita después del consumo (`D-M06.1a-M06.2a-07`). Si la función termina en error, la purga se revierte con ella. `p_purpose` fuera de `initial` y `reauth`: `22023`. `initial` con `p_expected_connection_id` no nulo: `22023` (argumento incoherente con el propósito; mismo criterio que `oauth_attempts_purpose_shape`). `reauth` con `p_expected_connection_id` nulo: `22023`. `initial`: ninguna conexión viva (si no, `PX003`). `reauth`: la conexión es de la empresa (si no, `PX001`) y su estado es `active` o `needs_reauth`; sobre `pending_selection` o `disconnected`, `PX004` (`D-M06.1a-M06.2a-02`); `expected_generation` **se lee de la fila**, no se recibe. `p_expires_at` tiene que ser posterior a `now()` y a lo sumo `now() + 10 minutos` (si no, `22023`). Inserta con `created_at = now()` |
| `consume_oauth_attempt(p_actor_user_id uuid, p_company_id uuid, p_state_hash text, p_browser_binding_hash text)` | `table (attempt_id uuid, purpose text, expected_connection_id uuid, expected_generation integer, return_path text)` | Después del chequeo de pertenencia, **una sola sentencia**: `update public.oauth_attempts a set consumed_at = now() where a.state_hash = p_state_hash and a.browser_binding_hash = p_browser_binding_hash and a.actor_user_id = p_actor_user_id and a.company_id = p_company_id and a.consumed_at is null and a.expires_at > now() returning …`. Sin fila: `PX002`. No toma el cerrojo de empresa: la fila bloqueada serializa dos consumos, y en `read committed` el segundo reevalúa `consumed_at is null` y no encuentra fila (CA-03) |
| `create_pending_connection(p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid, p_client_business_id text, p_ciphertext text, p_iv text, p_auth_tag text, p_key_version integer, p_token_type text, p_issued_for_app_id text, p_granted_scopes text[], p_token_expires_at timestamptz)` | `table (connection_id uuid, status text, pending_expires_at timestamptz, credential_generation integer)` | Cerrojo de empresa. **Reintento** (`D-M06.1a-M06.2a-11`): si ya existe una conexión con el mismo `p_connection_id`, de la misma empresa, en `pending_selection`, con el mismo `client_business_id` y una credencial igual a los parámetros (el material cifrado, byte a byte), devuelve esa fila sin escribir. Si no, con conexión viva: `PX003`; eso incluye el mismo id con otro material cifrado, porque si el servidor volvió a cifrar es una operación nueva. Si `p_connection_id` ya existe en `integration_connections`, **de esta empresa o de otra**, da `PX001`, sin detalles e indistinguible entre los dos casos: se verifica antes del `insert` y, si igual choca la clave primaria, la traducción de errores la convierte en `PX001`. Inserta la conexión con `id = p_connection_id`, `status = 'pending_selection'`, `pending_expires_at = now() + interval '30 minutes'` (DEC-17), metadatos nulos y generación `0`; inserta la credencial en la misma transacción. `p_connection_id` lo genera el servidor porque el AAD lo necesita antes de cifrar (CA-11b, `credential.ts:83-86`); nunca viene del navegador |
| `get_credential(p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid)` | `table (connection_id uuid, company_id uuid, provider text, status text, credential_generation integer, ciphertext text, iv text, auth_tag text, key_version integer, token_type text, issued_for_app_id text, granted_scopes text[], expires_at timestamptz)` | Solo lectura; no toma cerrojo. Conexión ajena o inexistente: `PX001`. Conexión propia sin credencial: cero filas. Responde en cualquier estado, porque la revocación de CA-38 (paso 2) la necesita en `disconnected` |
| `confirm_connection(p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid, p_external_account_id text, p_currency text, p_timezone text, p_probe_succeeded boolean)` | `table (connection_id uuid, status text, credential_generation integer)` | `p_probe_succeeded` distinto de `true`: `22023`. **Reintento** (`D-M06.1a-M06.2a-12`): si la fila ya está `active` con la misma cuenta, moneda y zona, y con generación `0` (la que deja la confirmación: la pendiente nace con `0` y confirmar no la cambia; otra generación significa que hubo una reautorización después), devuelve la fila sin escribir. Si no, estado distinto de `pending_selection`: `PX004`. `pending_expires_at <= now()`: `PX005`, aunque la purga no haya corrido (CA-37). `p_timezone` tiene que existir en `pg_catalog.pg_timezone_names` (si no, `22023`). Pasa a `active` con cuenta, moneda y zona; `pending_expires_at` y el último error quedan nulos. Cuenta repetida en la empresa: `PX007` |
| `replace_credential(p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid, p_attempt_id uuid, p_ciphertext text, p_iv text, p_auth_tag text, p_key_version integer, p_token_type text, p_issued_for_app_id text, p_granted_scopes text[], p_token_expires_at timestamptz)` | `table (connection_id uuid, status text, credential_generation integer)` | En este orden: cerrojo de empresa y lectura de la conexión por `id` y `company_id` con `for update`; conexión de otra empresa o inexistente: `PX001`, antes que cualquier chequeo del intento (C-16, T-16). Después, el intento tiene que existir con esa empresa, ese actor, `purpose = 'reauth'`, `consumed_at` no nulo y de hace 10 minutos o menos (`consumed_at >= now() - interval '10 minutes'`, `D-M06.1a-M06.2a-14`) y `expected_connection_id = p_connection_id` (si no, `PX002`). **Reintento** (`D-M06.1a-M06.2a-20`): si la conexión ya está `active` con generación igual a `expected_generation + 1` del intento (la que deja precisamente esta escritura) y la credencial guardada ya es exactamente el material dado, devuelve la fila sin volver a escribir. Si no, estado `active` o `needs_reauth` (si no, `PX004`). `credential_generation` igual a `expected_generation` del intento (si no, `PX006`). Reemplaza la credencial (`insert … on conflict on constraint integration_credentials_pkey do update`, convención de la sección 1), incrementa la generación, deja `status = 'active'` y el último error nulo (CA-37c) |
| `mark_needs_reauth(p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid, p_expected_generation integer, p_error_class text, p_error_message text)` | `table (connection_id uuid, status text, credential_generation integer)` | **Reintento** (`D-M06.1a-M06.2a-13`, `-21`): si la fila ya está `needs_reauth` con generación igual a `p_expected_generation`, devuelve la fila sin escribir, **sin importar la clase que llegue ahora**: dos workers pueden ver clases distintas para el mismo token y el segundo no tiene que fallar. Ni la clase ni el mensaje se comparan ni se sobrescriben. Si no, solo desde `active` (si no, `PX004`). Clase en las cuatro de `needs_reauth` (si no, `22023`). Mensaje de 1 a 500 caracteres; la redacción la hace el servidor con `redactErrorMessage` (CA-09). Generación distinta de la esperada: `PX006`, para que un error de un token viejo no marque una conexión recién reautorizada (motivo: CA-38c y CA-59; decisión no material) |
| `begin_disconnect(p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid)` | `table (connection_id uuid, status text, credential_generation integer, purge_requested_at timestamptz)` | Desde `pending_selection`, `active` o `needs_reauth`: `disconnected`, generación + 1, `purge_requested_at = now()`, metadatos intactos (nulos si venía de pendiente; CA-08). Si ya está `disconnected`, devuelve la fila sin cambios (idempotente, CA-38 paso 1) |
| `purge_connection(p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid)` | `boolean` | Busca la fila por `id` **y** `company_id`. Si no la encuentra, porque no existe o porque es de otra empresa, devuelve `false` sin efecto: los dos casos son indistinguibles, así que no revela si la conexión existe en otra empresa, y la llamada repetida es idempotente. Si es de la empresa y no está `disconnected`: `PX004`. Borra la credencial y después la fila de la conexión, en la misma transacción; los intentos `reauth` que la esperaban caen por la FK en cascada. Devuelve `true`. `0013` y `0014` la reemplazan con `create or replace` para sumar sus tablas |
| `list_pending_purges(p_actor_user_id uuid, p_company_id uuid)` | `table (connection_id uuid, status text, reason text, has_credential boolean, pending_expires_at timestamptz, purge_requested_at timestamptz)` | Solo lectura, solo de `p_company_id`: pendientes con `pending_expires_at <= now()` (`reason = 'pending_expired'`) y `disconnected` (`reason = 'disconnect_requested'`). `has_credential` indica si todavía corresponde intentar la revocación (CA-38, paso 2) |
| `count_credentials_by_key_version()` | `table (key_version integer, credential_count bigint)` | Única excepción de II.4 (plan.md:452; `D-M06.1a-M06.2a-04`): sin parámetros, sin chequeo de actor ni cerrojo. Cuenta **todas** las credenciales, de todas las empresas, agrupadas por versión de clave, para confirmar que ninguna usa la clave que se va a retirar (CA-25, paso 4). No devuelve ningún dato de empresas ni de conexiones. Solo `praxa_integrations` tiene `EXECUTE` |
| `rewrap_credential(p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid, p_expected_generation integer, p_expected_key_version integer, p_ciphertext text, p_iv text, p_auth_tag text, p_key_version integer)` | `table (connection_id uuid, key_version integer)` | Recifrado al usar la credencial (CA-25, paso 3); mantiene actor y empresa, como el resto (plan.md:452). Generación distinta: `PX006`. **Reintento** (`D-M06.1a-M06.2a-20`, `-22`): si la versión guardada ya es `p_key_version`, `p_expected_key_version` es menor que `p_key_version` y el material guardado ya es exactamente el dado, devuelve la fila sin volver a escribir. Con la versión esperada igual o mayor que la nueva no hay reintento posible: ninguna llamada exitosa pudo tenerla, porque `D-M06.1a-M06.2a-15` la habría rechazado. Si no, `key_version` guardada distinta de `p_expected_key_version`: `PX008`. `p_key_version` menor o igual a la guardada: `22023` (`D-M06.1a-M06.2a-15`). Reemplaza solo `ciphertext`, `iv`, `auth_tag` y `key_version`; la generación no cambia (es el mismo token) |

Transiciones que la base rechaza con `PX004` (CA-07): `pending_selection → needs_reauth`, `needs_reauth → needs_reauth` con otra generación (cualquier clase con la misma generación es un reintento, `D-M06.1a-M06.2a-21`), `active → active` por `confirm_connection` con otra cuenta, moneda, zona o generación, `needs_reauth → active` por `confirm_connection`, `disconnected → active` y `disconnected → needs_reauth` por cualquier función, `purge_connection` sobre una conexión que no está `disconnected`, y `create_oauth_attempt` con propósito `reauth` sobre una conexión `pending_selection` o `disconnected` (`D-M06.1a-M06.2a-02`). El reintento de una transición ya aplicada devuelve la fila en vez de un error: para `confirm_connection` y `replace_credential`, con los mismos parámetros exactos; para `mark_needs_reauth`, con la misma generación, sin importar la clase (`D-M06.1a-M06.2a-12`, `-13`, `-21`; AGENTS.md:48). No se agrega un trigger de transiciones: las tablas no tienen grants de escritura, así que la única vía es `worker_api` (II.4, tercera trampa).

### 9. Corrección condicional de `H-E1-07`

Procedimiento condicional (`D-M06.1a-M06.2a-05`), en este orden:

1. **Primero, la parte 1 de la prueba `10`, sola.** `run-pgtap.mjs` manda cada archivo en una sola consulta y, si hay un error SQL, descarta todos sus resultados y solo informa el error (`scripts/run-pgtap.mjs:74-99`). Por eso `10_demo_closure.test.sql` se escribe al principio **solo con la parte 1** (que no toca ninguna tabla de integración), y se corre así, antes de que existan `0012` y la parte 2 (secuencia, paso 3). La parte 2 se agrega al mismo archivo después. Si la parte 1 pasa, `H-E1-07` es falsa: `0012` **no** contiene ninguna sección sobre `reports` y el hallazgo se registra como descartado, con la salida de la prueba.
2. **Solo si la parte 1 confirma `H-E1-07`** (falla con la violación de `reports_context_fkey`), se agrega al final de `0012`, antes de su primer push, una sección propia con la corrección **no diferida**:

   ```sql
   alter table public.reports drop constraint reports_context_fkey;
   alter table public.reports add constraint reports_context_fkey
     foreign key (company_id, context_version_id)
     references public.company_context_versions (company_id, id)
     on delete no action;
   ```

   `no action` se verifica al final de la sentencia, no durante la acción en cascada: la cascada desde `companies` ya borró los reportes cuando se verifica, y borrar un contexto que tiene reportes sigue fallando en el momento. Se verifica con la misma prueba `10` (partes 1 y 2), en el ensayo con rollback (secuencia, paso 5) y después del push.
3. **Solo si la prueba `10` demuestra que la no diferida no alcanza** (la parte 1 sigue fallando con la violación de `reports_context_fkey`), se reemplaza, en la misma sección y todavía antes del primer push, por la variante diferida:

   ```sql
     on delete no action deferrable initially deferred;
   ```

   Borrar un contexto con reportes sigue fallando, pero al confirmar la transacción. Como cada archivo pgTAP termina en `rollback`, una FK diferida nunca se verificaría: la aserción de protección de la prueba `10` corre, en esta variante, después de `set constraints public.reports_context_fkey immediate`. Detectar que la no diferida no alcanza requiere el ensayo con rollback: si recién se ve después del push, es la condición de parada de la trampa 8.

En los tres casos, `0003` no se modifica, la sección lleva un comentario con `H-E1-07` y la variante elegida, y la evidencia registra la salida de la parte 1 antes y después de la corrección.

### 10. Pruebas pgTAP

Esqueleto común: `begin; create extension if not exists pgtap with schema extensions; select plan(N); … select * from finish(); rollback;`. Datos 100 % sintéticos: usuarios `…@praxa.test`, UUID con el patrón de `01_tenant_isolation`, cuentas `cuenta_sintetica_0001`, hashes `repeat('a', 64)`, material cifrado `AAAA` / `AAAAAAAAAAAAAAAA` / `AAAAAAAAAAAAAAAAAAAAAA==`, app `app_sintetica`. Ningún valor con forma de token real (CA-12).

Helpers en `pg_temp`, dentro de la transacción de cada archivo que los necesite:

- `pg_temp.affected(p_sql text) returns integer`: el de `01` y `05`.
- `pg_temp.sqlstate_as(p_role text, p_sql text) returns text`: `set local role` al rol pedido, ejecuta `p_sql`, vuelve al rol original y devuelve `null` si no hubo error, o el SQLSTATE si lo hubo (el bloque `exception` revierte la subtransacción, incluido el cambio de rol). Hace falta porque las funciones de pgTAP viven en `extensions`, y `praxa_integrations` no tiene `USAGE` sobre ese esquema: una aserción de pgTAP ejecutada **como** el rol de C fallaría por eso y no por lo que se prueba.
- `pg_temp.error_of(p_sql text) returns table (sqlstate text, message text, detail text, hint text)`: ejecuta `p_sql` como el rol actual y, si falla, devuelve lo que informa `get stacked diagnostics` (`returned_sqlstate`, `message_text`, `pg_exception_detail`, `pg_exception_hint`); si no falla, una fila de nulos. Lo usan T-45 a T-48 para afirmar que `DETAIL` y `HINT` están vacíos, algo que `throws_ok` no revisa.
- En `09`, antes de usar `sqlstate_as` con el rol de C: `grant praxa_integrations to current_user;`. Se revierte con el `rollback` del archivo (H-S-02).

Para `authenticated`, antes de cada bloque: `set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true)`, como en `05_delete_carveout.test.sql:96-98`.

Reparto:

- **`08_integration_isolation.test.sql` (CA-19).** Dos empresas sintéticas, A y B, cada una con conexión activa, credencial e intento, sembrados como `postgres`. Como `authenticated` de A: ve solo su conexión; filtrar por el `id` de B devuelve cero filas; `insert`, `update` y `delete` sobre `integration_connections` fallan con `42501` (sin privilegio, no en silencio); leer `oauth_attempts` y `private.integration_credentials` falla con `42501`. Por `worker_api`, con el actor de A: cada función que recibe `p_connection_id` da `PX001` con la conexión de B, salvo `purge_connection`, que devuelve `false` sin efecto, igual que con un `id` inexistente; para eso B tiene además una conexión `disconnected` con credencial e intento `reauth`, y la prueba verifica que quedan intactos (T-42); `create_oauth_attempt`, `create_pending_connection` y `list_pending_purges` con `p_company_id` de B dan `PX001`; `list_pending_purges(A, A)` no devuelve filas de B; `consume_oauth_attempt` con los hashes del intento de B da `PX001` si el actor no es miembro de B.
- **`09_integration_privileges.test.sql` (CA-14 a CA-17, CA-20 a CA-22).** Estructura y privilegios, más la ejecución efectiva como cada rol (detalle en los casos T-04 a T-15).
- **`09b_integration_lifecycle.test.sql` (CA-02c, CA-03, CA-07, CA-08, CA-18, CA-37, CA-37c, CA-38).** Comportamiento de las doce funciones y de las restricciones, llamando a las funciones como `postgres`, que es su dueño (mismo cuerpo `SECURITY DEFINER`; el privilegio del rol de C se prueba aparte en `09`).
- **`10_demo_closure.test.sql` (CA-67, CA-68, `H-E1-06`, `H-E1-07`).** Se construye en dos tiempos (sección 9, paso 1): primero solo la parte 1, con su propio `plan(N)`, que se corre sola; después se agrega la parte 2 y se actualiza el `plan`.
  - Parte 1, **sin tocar ninguna tabla de integración**: usuario, empresa, contexto activado con un objetivo, y un reporte que lo referencia. Primero, la protección que tiene que sobrevivir a cualquier variante de la sección 9: como `postgres` y sin claims, borrar solo esa versión de contexto → `throws_ok(…, '23503')` (en la variante diferida, precedido por `set constraints public.reports_context_fkey immediate`). Después, `delete from public.companies` → `lives_ok`, y cero filas de la empresa en `companies`, `company_members`, `company_context_versions`, `company_objectives`, `company_systems` y `reports`. Se corre sola, antes de que existan `0012` y la parte 2, para que su resultado no se pierda por el error de una tabla inexistente (sección 9, paso 1).
  - Parte 2: otra empresa con contexto, reporte, conexión activa, credencial e intento `reauth`. Primero, borrar el usuario antes que la empresa falla (`throws_ok`, `23503`; `H-E1-06`). Después, borrar la empresa → cero filas en todas las tablas anteriores más `integration_connections`, `oauth_attempts` e `integration_credentials`; y borrar el usuario de `auth.users` → `lives_ok` y cero filas.

### 11. Prueba `test:app` de la Data API

Archivo `tests/app/integrations-data-api.test.ts`, en el proyecto `app` de Vitest.

- Condición para correr: `blockedReason()` nulo, `remoteProjectReachable()` y `resolveSqlTestTarget(process.env).ok` (de `scripts/lib/sql-target.mjs`). Si no, `describe.skipIf` con el motivo; eso cuenta como no ejecutada (CB-06).
- Fixtures: dos usuarios con `createConfirmedUser()` y sus empresas con `create_company_for_current_user`. La conexión de cada empresa se siembra con un `pg.Client` sobre la `connectionString` que devuelve `resolveSqlTestTarget`, llamando a `worker_api.create_pending_connection` como `postgres` (dueño de la función) y confirmando la transacción. Es el equivalente, para esta tabla, del uso de la clave `service_role` en `helpers.ts`: prepara datos y **ninguna aserción se hace con esa conexión**. Se cierra en `afterAll`. La limpieza es `cleanupRun()`: la cascada desde `companies` arrastra conexiones y credenciales.
- Aserciones, todas con el cliente autenticado de la Data API:
  1. A lee `integration_connections` sin error y obtiene exactamente su conexión (un `grant` faltante daría `42501`: sección 5b, `H-E1-11`).
  2. A filtrando por el `id` de B obtiene `[]`.
  3. A leyendo `oauth_attempts` obtiene un error y ningún dato.
  4. A llamando `schema('worker_api').rpc('list_pending_purges', …)` obtiene un error (esquema no expuesto).
  5. A llamando `rpc('list_pending_purges', …)` en `public` obtiene un error (no existe).
  6. A leyendo `schema('private').from('integration_credentials')` obtiene un error.

  No se fija el código exacto de los errores 3 a 6 (H-S-06): basta con que haya error y no haya datos.

### 12. Secuencia de ejecución (TDD sobre el grupo)

1. `git status` limpio y rama propia desde `main` (convención de las microfases previas: `mf/M06.1a-M06.2a`).
2. Escribir `10_demo_closure.test.sql` **solo con la parte 1** (sección 9, paso 1). Todavía no se escriben `0012` ni la parte 2.
3. `npm run test:policies`: `01` a `07` pasan; `10` (solo parte 1) resuelve `H-E1-07`: pasa (hipótesis falsa) o falla con la violación de `reports_context_fkey` (hipótesis verdadera). Como el archivo todavía no nombra ninguna tabla de integración, el resultado no se pierde por un error de objeto inexistente. Registrar la salida: define la sección 9 y `D-M06.1a-M06.2a-05`.
3b. Agregar la parte 2 a `10` y escribir `08`, `09`, `09b` y la prueba de la Data API. `npm run test:policies` y `npm run test:app`: rojo esperado. `01` a `07` pasan; `08`, `09`, `09b`, `10` y la prueba nueva fallan porque los objetos no existen. Registrar las salidas.
4. Escribir `0012`, con la sección de `H-E1-07` solo si el paso 3 la confirmó, y en la variante no diferida (sección 9, paso 2).
5. **Ensayo con rollback (recomendado; obligatorio si `0012` lleva la sección de `H-E1-07`, porque es donde se decide entre la variante no diferida y la diferida antes del push).** Un script temporal en el scratchpad de la sesión, **fuera del repositorio**, que usa `resolveSqlTestTarget` y, por cada archivo pgTAP, ejecuta en una sola transacción el SQL de `0012` más el cuerpo del archivo, y termina en `rollback`. Detecta errores de la migración antes del push, porque después de aplicarla corregirla exige intervención del usuario (trampa T8). Nunca usa `SUPABASE_DB_URL`. El resultado se registra como ensayo y no reemplaza a las corridas del paso 7. Si la sección de `H-E1-07` está presente y la parte 1 de `10` sigue fallando, se pasa a la variante diferida (sección 9, paso 3) y se repite el ensayo antes del push.
6. `npm run db:check:test` (asistente). Después, el **usuario** corre `npm run db:push:test` y comparte la salida sin la URL.
7. `npm run test:policies`, `npm run test:app` y `npm run verify`: verde, sin pruebas omitidas.
8. Evidencia en `sesiones/M06.1a-M06.2a.md`; hallazgos en `HALLAZGOS.md` (`H-E1-07` resuelto en un sentido u otro; `H-E1-05`, `H-E1-06`, `H-E1-11` y `H-E1-19` actualizados; `H-E1-18` registrado como diferido según `D-M06.1a-M06.2a-09`; `H-E1-22` ya registrado, sin cambios); `PROJECT_STATE.md` con el estado del gate.

## Archivos previstos

| Archivo | Nuevo o modificado | Para qué | Autorizado por |
|---|---|---|---|
| `supabase/migrations/0012_integrations.sql` | Nuevo | Esquema, rol, tipos, tablas, políticas, privilegios y funciones; y la corrección condicional de `H-E1-07` | II.4 ("una sola migración nueva") y ficha de M06.2a ("se diseña la corrección en una migración nueva") |
| `supabase/tests/08_integration_isolation.test.sql` | Nuevo | CA-19 | II.5, paso 1 |
| `supabase/tests/09_integration_privileges.test.sql` | Nuevo | CA-14 a CA-17, CA-20 a CA-22 | II.5, paso 2 |
| `supabase/tests/09b_integration_lifecycle.test.sql` | Nuevo | Transiciones y purga | II.5, pasos 3 y 3b ("mismo archivo o `09b_…`") |
| `supabase/tests/10_demo_closure.test.sql` | Nuevo | CA-67, CA-68, `H-E1-06`, `H-E1-07` | II.5, paso 4 |
| `tests/app/integrations-data-api.test.ts` | Nuevo | Lectura efectiva por la Data API | II.5, paso 5 |
| `docs/HALLAZGOS.md` | Modificado | Estado de `H-E1-05`, `H-E1-06`, `H-E1-07`, `H-E1-11`, `H-E1-19` y hallazgos nuevos | Precondición 8 de la Parte II |
| `docs/PROJECT_STATE.md` | Modificado | Estado de `G-DB-META` | Precondición 8 |
| `docs/FASES/FASE1/meta_first/sesiones/M06.1a-M06.2a.md` | Nuevo | Evidencia | Precondición 8 |
| `docs/FASES/FASE1/M06.1a-M06.2a/spec.md`, `plan.md`, `revisiones/*.md` | Nuevos | Pipeline | Precondición 9 |
Ningún otro archivo. La ruta (`meta_first/spec.md` y `plan.md`) no se modifica: los cambios que exigían `Q-03`, `Q-04` y `Q-06` ya están en `5bc7472`. `scripts/lib/target.mjs`, `tests/app/helpers.ts` y `docs/SECURITY.md` son de `M06.3a` (`D-M06.1a-M06.2a-06`). `docs/HALLAZGOS.md` ya se modificó antes de implementar para registrar `H-E1-22` (auditoría 2, A-08). El script del ensayo (paso 5 de la secuencia) vive fuera del repositorio.

## Criterios de aceptación

### Heredados de la ruta

| ID de la ruta | Qué exige (resumen fiel) |
|---|---|
| CA-01 (II.4, paso 5) | Solo se persiste el hash del `state`, de 32 bytes aleatorios o más |
| CA-02 (II.4, paso 5) | Vencimiento explícito y corto; un intento vencido no es consumible |
| CA-02b (II.4, paso 5; II.5, paso 3) | El intento queda vinculado al actor, a su empresa y al navegador (hash del nonce de la cookie) |
| CA-02c (ficha M06.1a) | El intento declara propósito `initial` o `reauth`; `reauth` guarda la conexión y la generación esperadas |
| CA-03 (ficha M06.1a) | Consumo único y atómico: una sola sentencia valida `state`, actor, empresa, vinculación, vencimiento y no consumido, y lo marca; un segundo consumo es un error tipado |
| CA-05 (II.4, paso 4) | Proveedor en enum cerrado con único valor `meta` |
| CA-07 (ficha M06.1a) | Estados `pending_selection`, `active`, `needs_reauth`, `disconnected` y solo las transiciones declaradas; se aplican en `worker_api` y se prueban en pgTAP |
| CA-08 (ficha M06.1a) | Moneda, zona y cuenta obligatorias en `active` y `needs_reauth`; nulas permitidas en `pending_selection` y en `disconnected` que viene de pendiente; ninguna transición inventa metadatos |
| CA-09, CA-09b (II.4, paso 6) | Último error como clase más mensaje redactado; se guardan `client_business_id` y la cuenta externa |
| CA-10 a CA-13 (II.4, paso 8) | Solo texto cifrado; IV, etiqueta y versión obligatorios; AAD con empresa, conexión y proveedor; tipo, app, permisos y expiración nullable; ningún fixture con token; toda credencial referencia una conexión |
| CA-14 (ficha M06.1a) | Tablas nuevas con `company_id`, RLS habilitada y `force row level security`; `force` no restringe a funciones de un dueño con `bypassrls` |
| CA-15 (ficha M06.1a) | `private.integration_credentials` sin grants para nadie salvo el dueño de las funciones |
| CA-16 (ficha M06.1a) | La matriz de la sección 7 queda en el encabezado de la migración |
| CA-17 (ficha M06.1a) | `revoke all` explícito antes de cada grant, sobre la tabla o la función |
| CA-18 (ficha M06.1a) | Una sola conexión viva por empresa (índice único parcial); unicidad `(company_id, provider, external_account_id)`; reconectar tras una purga completa crea una fila nueva |
| CA-19 (ficha M06.2a) | Aislamiento entre dos empresas sintéticas, en pgTAP |
| CA-20 (ficha M06.2a) | Las políticas de lectura usan `private.is_company_member()`; ninguna acepta un `company_id` del cliente |
| CA-21 (ficha M06.2a) | Ningún usuario lee credenciales por ninguna vía, ni directa ni por una función |
| CA-22 (ficha M06.2a) | pgTAP como `authenticated`, `anon` y el rol de C; el rol de C ejecuta sus funciones y no lee ninguna tabla |
| CA-25 (tabla de funciones de II.4; excepción de plan.md:452) | Rotación: una función de `worker_api`, global y sin actor ni empresa, confirma que ninguna credencial referencia la clave vieja antes de retirarla; el recifrado se hace al usar cada credencial, con actor y empresa |
| CA-28 (II.4, `create_oauth_attempt`) | Un intento `initial` solo sin conexión viva; con conexión viva, solo `reauth` de esa conexión. En esta microfase, `reauth` se limita a `active` y `needs_reauth` (`D-M06.1a-M06.2a-02`; `H-E1-21`) |
| CA-38b (II.4, `create_oauth_attempt`, plan.md:456) | `create_oauth_attempt` purga, de esa empresa, los intentos no consumidos ya vencidos y los consumidos hace más de 10 minutos |
| CA-37 (II.5, paso 3) | `confirm_connection` verifica en la base que `pending_expires_at` no pasó, aunque la purga no haya corrido |
| CA-37c (II.4, `replace_credential`) | La reautorización reemplaza la credencial solo si la generación sigue siendo la esperada |
| CA-38 (ficha M06.1a; II.5, paso 3b) | `begin_disconnect` (estado, generación, `purge_requested_at`) y `purge_connection` idempotente que borra credencial y datos y al final la fila |
| CA-67 (II.5, paso 4) | Cierre sobre una empresa sintética con reporte, contexto e integración: borrado administrativo de la empresa, borrado del usuario, cero filas |
| CA-68 (ficha M06.1a) | Toda tabla nueva referencia `companies`, directamente o por la conexión, con `on delete cascade` |
| Ficha M06.1a; II.4 (plan.md:450-452) | Cada función verifica que el actor sea miembro de la empresa y que la conexión pertenezca a ella, salvo `count_credentials_by_key_version`, que no recibe actor ni empresa y solo ejecuta `praxa_integrations` |
| Ficha M06.2a | El rol de C no lee ninguna tabla. `authenticated` no ejecuta `worker_api`. El cierre deja cero filas de la empresa |
| Sección 5b (II.5, paso 5) | `test:app` verifica que `authenticated` lee las tablas nuevas por la Data API: el usuario lee su conexión, no la de otra empresa, y una RPC a `worker_api` falla |
| CB-01 a CB-06 | `verify` y las suites del corte pasan; sin secretos ni datos reales en diffs; ninguna migración existente modificada; ninguna prueba contra producción; evidencia real y redactada; una prueba omitida por configuración no aprueba el gate |

### Operativos de esta microfase

| ID | Criterio verificable | Traza a (CA, DEC o trampa de la ruta) |
|---|---|---|
| M06.1a-M06.2a-C-01 | El diff contra `main` agrega `0012_integrations.sql` y no modifica ningún archivo de `supabase/migrations/` existente | CB-03 |
| M06.1a-M06.2a-C-02 | El encabezado de `0012` reproduce la matriz de la sección 7 (con las filas de `0013`/`0014` marcadas como previstas) más la columna `service_role` con "—" en todas las filas, las reglas del rol, la excepción de `count_credentials_by_key_version` y el catálogo de errores | CA-16; `D-M06.1a-M06.2a-01`, `-04` |
| M06.1a-M06.2a-C-03 | En `0012`, cada `grant` está precedido por un `revoke all` sobre el mismo objeto, y cada tabla y función nueva tiene su `revoke all … from public, anon, authenticated, service_role` | CA-17; `D-M06.1a-M06.2a-01` |
| M06.1a-M06.2a-C-04 | `worker_api` existe; `anon` y `authenticated` no tienen `USAGE`; `PUBLIC` no tiene `USAGE`; `praxa_integrations` sí | Sección 7 (matriz), CA-21 |
| M06.1a-M06.2a-C-05 | `praxa_integrations`: `rolcanlogin`, no `rolbypassrls`, no `rolinherit`, no `rolsuper`, no `rolcreaterole`, no `rolcreatedb`, no `rolreplication`, y sin membresía en ningún otro rol; `0012` no contiene `password` | Ficha M06.1a; sección 7 (rol sin contraseña); `D-M06.1a-M06.2a-18` |
| M06.1a-M06.2a-C-06 | `integration_provider` tiene exactamente `meta`; `connection_status` tiene exactamente los cuatro estados | CA-05, CA-07 |
| M06.1a-M06.2a-C-07 | Las columnas de las tres tablas son exactamente las de K02, K03 y K04, con la nulabilidad del contrato; `oauth_attempts` tiene `created_at` y `provider` | II.4 (nota de columnas), `H-E1-19` |
| M06.1a-M06.2a-C-08 | Las tres tablas tienen `company_id not null`, `relrowsecurity` y `relforcerowsecurity` | CA-14, `H-E1-05` |
| M06.1a-M06.2a-C-09 | Privilegios de tablas: `authenticated` solo `SELECT` sobre `integration_connections`; ningún privilegio de `anon`, `authenticated` ni `praxa_integrations` sobre `oauth_attempts` ni `integration_credentials`; ningún privilegio de `service_role` sobre ninguna de las tres; la ACL de `integration_credentials` no tiene más titular que el dueño | CA-15, CA-16, CA-22; `D-M06.1a-M06.2a-01` |
| M06.1a-M06.2a-C-10 | `integration_connections` tiene una sola política, `SELECT`, `to authenticated`, con `private.is_company_member(company_id)`; `oauth_attempts` e `integration_credentials` no tienen políticas | CA-20 |
| M06.1a-M06.2a-C-11 | Un `insert` directo que viola cada restricción de estado de 5.1 (metadatos parciales, `active` sin metadatos, pendiente sin vencimiento, marca de purga fuera de `disconnected`, error sin mensaje, `needs_reauth` con clase `unknown`, `needs_reauth` con clase y mensaje nulos, mensaje de 501 caracteres) falla con `23514` | CA-08, CA-09, CA-39; K03 (`connection.ts:96-104`) |
| M06.1a-M06.2a-C-12 | Dos conexiones vivas en la misma empresa violan el índice parcial; dos filas con la misma cuenta en la misma empresa violan la unicidad | CA-18 |
| M06.1a-M06.2a-C-13 | Las FK de las tres tablas hacia `companies` o hacia la conexión son `on delete cascade` (`confdeltype = 'c'`), incluida la de credenciales | CA-68, CA-13 |
| M06.1a-M06.2a-C-14 | `oauth_attempts` rechaza (`23514`) un hash que no es SHA-256 hex, un propósito incoherente con sus campos esperados, un retorno fuera de la allowlist y un vencimiento mayor a 10 minutos o no posterior a la creación; `state_hash` es único | CA-01, CA-02, CA-02c, CA-04, `H-E1-19`; `D-M06.1a-M06.2a-10` |
| M06.1a-M06.2a-C-15 | En `worker_api` existen exactamente las doce funciones de II.4; todas `prosecdef`, con `search_path=""` en `proconfig`, `proacl` no nulo, sin `EXECUTE` para `PUBLIC`, `anon`, `authenticated` ni `service_role`, y con `EXECUTE` para `praxa_integrations` | CA-21, CA-22, sección 7; `D-M06.1a-M06.2a-01` |
| M06.1a-M06.2a-C-16 | Cada una de las once funciones con actor y empresa, con actor no miembro de la empresa o con actor o empresa nulos, da `PX001`; cada función que recibe `p_connection_id` da `PX001` con una conexión de otra empresa, salvo `purge_connection`, que devuelve `false` sin efecto (C-24). En `create_pending_connection`, un `p_connection_id` que ya existe en otra empresa (o en la propia) da `PX001` cuando la empresa no tiene conexión viva; si la tiene, gana `PX003`, que no revela nada de la otra empresa. El reintento de la misma llamada sobre una pendiente propia y no vencida devuelve la fila (C-19). `count_credentials_by_key_version` es la única sin esos parámetros | Ficha M06.1a; sección 7, paso 3; plan.md:450-452 |
| M06.1a-M06.2a-C-17 | `create_oauth_attempt`: `initial` con una conexión viva da `PX003`; `reauth` guarda la conexión y la generación leída de la base; `reauth` sobre una conexión `pending_selection` da `PX004`, y sobre una `disconnected` también; `initial` con `p_expected_connection_id` no nulo, `reauth` con `p_expected_connection_id` nulo y un propósito desconocido dan `22023`; vencimiento fuera de rango da `22023`; el reintento con el mismo `state`, actor, empresa y vinculación de navegador, sin consumir y sin vencer, devuelve la fila ya creada, y con otra vinculación el `state` repetido sigue dando `22023` | CA-02, CA-02c, CA-28 (base); `D-M06.1a-M06.2a-02`, `-20` |
| M06.1a-M06.2a-C-37 | `create_oauth_attempt` borra, de su empresa, los intentos no consumidos ya vencidos y los consumidos hace más de 10 minutos (`consumed_at < now() - interval '10 minutes'`); conserva los consumidos hace 10 minutos o menos, incluido el borde exacto de 10 minutos, aunque hayan vencido, y los vigentes; no toca intentos de otra empresa; si la función termina en error, no borra nada | CA-38b; plan.md:456; `D-M06.1a-M06.2a-03`, `-07` |
| M06.1a-M06.2a-C-38 | `private.integration_credentials` rechaza (`23514`) lo que K04 rechaza: un IV que decodifica a 10 u 11 bytes, una etiqueta que no decodifica a 16, un `ciphertext` vacío o que no es base64, `granted_scopes` con un permiso que no cumple `scopeSchema`, con un permiso repetido, con un elemento nulo o sin `ads_read` | K04 (`credential.ts:21-23`, `:35`, `:42-57`); CA-11, CA-32 |
| M06.1a-M06.2a-C-18 | `consume_oauth_attempt` se implementa como una sola sentencia `update … returning`; un intento desconocido, vencido, ya consumido, de otro actor, de otra empresa (actor miembro de ambas) o con otro hash de vinculación da `PX002`; el primer consumo devuelve el propósito y el segundo da `PX002` | CA-02b, CA-03, CA-29 (base) |
| M06.1a-M06.2a-C-19 | `create_pending_connection` deja la conexión en `pending_selection` con `pending_expires_at` a 30 minutos, metadatos nulos, generación `0` y la credencial guardada; con una conexión viva da `PX003`; el reintento idéntico (mismo id, mismo negocio y misma credencial, byte a byte) devuelve la pendiente sin crear filas, y el mismo id con otro material cifrado da `PX003` | DEC-17, CA-35 (base), CA-13; AGENTS.md:48, `D-M06.1a-M06.2a-11` |
| M06.1a-M06.2a-C-20 | `confirm_connection` sobre una pendiente vencida da `PX005` sin que haya corrido la purga; con `p_probe_succeeded` falso da `22023`; con una zona inexistente da `22023`; en caso válido deja `active` con los tres metadatos; el reintento con la misma cuenta, moneda y zona devuelve la fila, y con otra moneda, o con la misma después de una reautorización (generación distinta de `0`), da `PX004` | CA-37, CA-07, CA-08; AGENTS.md:48, `D-M06.1a-M06.2a-12` |
| M06.1a-M06.2a-C-21 | `replace_credential` con generación vieja da `PX006`; con un intento no consumido, consumido hace más de 10 minutos, `initial` o de otra conexión da `PX002` (uno consumido hace exactamente 10 minutos sirve); en caso válido incrementa la generación, reemplaza la credencial y deja `active`; el reintento con el mismo intento y el mismo material cifrado devuelve la fila ya aplicada, y con otro material sigue dando `PX006` | CA-37c; `D-M06.1a-M06.2a-14`, `-20` |
| M06.1a-M06.2a-C-22 | `mark_needs_reauth` pasa `active → needs_reauth` con una clase de las cuatro; con clase `unknown` da `22023`; con generación vieja da `PX006`; el reintento con la misma generación, cualquiera sea la clase que llegue, devuelve la fila y conserva la clase y el mensaje guardados, y con otra generación da `PX004` | CA-07, CA-39; AGENTS.md:48, `D-M06.1a-M06.2a-13`, `-21` |
| M06.1a-M06.2a-C-23 | `begin_disconnect` desde cada estado vivo deja `disconnected`, generación + 1 y `purge_requested_at`; desde pendiente, sin metadatos; repetirlo no cambia la fila | CA-38, CA-08 |
| M06.1a-M06.2a-C-24 | `purge_connection` sobre una conexión propia no desconectada da `PX004`; sobre una desconectada devuelve `true` y no deja conexión, credencial ni intentos `reauth` que la esperaban; repetida devuelve `false` sin error; con el `id` de una conexión inexistente o de otra empresa devuelve `false`, el mismo resultado en los dos casos, y la conexión, la credencial y los intentos de la otra empresa quedan intactos | CA-38, DEC-09; ficha M06.1a (la conexión pertenece a la empresa); sección 7, paso 3 |
| M06.1a-M06.2a-C-25 | `list_pending_purges` devuelve las pendientes vencidas y las desconectadas de la empresa, con `has_credential`, y no devuelve activas ni filas de otra empresa | CA-37b, CA-38 |
| M06.1a-M06.2a-C-26 | Con una desconectada sin purgar que tiene la cuenta X, confirmar una pendiente nueva con X da `PX007`; después de purgarla, la misma confirmación crea una fila nueva y activa | CA-18 |
| M06.1a-M06.2a-C-27 | `count_credentials_by_key_version()` no tiene parámetros y devuelve los conteos por versión de **todas** las empresas (con credenciales de dos empresas, el total es la suma de ambas), con solo las columnas `key_version` y `credential_count`; `rewrap_credential` recibe actor y empresa, cambia solo el material y la versión, da `PX008` o `PX006` si la versión o la generación cambiaron, y `22023` si la versión nueva no es posterior a la guardada; el reintento con la misma versión esperada y el mismo material nuevo devuelve la fila ya recifrada, con otro material sigue dando `PX008`, y con el mismo material pero la versión esperada igual a la nueva da `22023` | CA-25 (base); plan.md:452; `D-M06.1a-M06.2a-04`, `-15`, `-20`, `-22` |
| M06.1a-M06.2a-C-28 | Cada transición no declarada de la sección 8 da `PX004` | CA-07; II.4, tercera trampa |
| M06.1a-M06.2a-C-29 | Como `authenticated` de A: ve solo su conexión, cero filas de B, y `insert`/`update`/`delete` sobre conexiones y cualquier lectura de intentos y credenciales dan `42501` | CA-19, CA-21 |
| M06.1a-M06.2a-C-30 | Como `praxa_integrations`: ejecutar al menos `list_pending_purges`, `create_oauth_attempt` y `count_credentials_by_key_version` con datos válidos no da error; leer cada una de las tres tablas da `42501`; como `authenticated` y como `anon`, ejecutar cualquier función de `worker_api`, incluida `count_credentials_by_key_version`, da `42501` | CA-22; ficha M06.2a; `D-M06.1a-M06.2a-04` |
| M06.1a-M06.2a-C-31 | Ninguna función fuera de `worker_api` menciona `integration_credentials` en su cuerpo | CA-21 |
| M06.1a-M06.2a-C-32 | El dueño de las funciones de `worker_api` tiene `rolbypassrls`: se afirma en `09` para que un cambio de dueño que rompa la lectura bajo `force` se detecte | CA-14; II.4, primera trampa |
| M06.1a-M06.2a-C-33 | Parte 1 de `10`: como `postgres` sin claims, borrar solo una versión de contexto que tiene un reporte falla con `23503`, y borrar la empresa con contexto activo y reporte deja cero filas en las seis tablas del producto. `0012` contiene una sección sobre `reports_context_fkey` solo si la parte 1 falló antes de aplicarla, y en la variante que fija la sección 9 (no diferida; diferida solo si la no diferida no alcanzó). Parte 2: con integración, borrar primero el usuario falla con `23503`; borrar la empresa deja cero filas en las nueve tablas y después borrar el usuario deja cero filas en `auth.users` | CA-67, CA-68, `H-E1-06`, `H-E1-07`; `D-M06.1a-M06.2a-05` |
| M06.1a-M06.2a-C-34 | Por la Data API, con el cliente autenticado: A lee su conexión sin error; filtrar por la de B da `[]`; `oauth_attempts`, `worker_api` (por esquema), la RPC homónima en `public` y `private.integration_credentials` dan error sin datos | Sección 5b, `H-E1-11`, II.5 paso 5, CA-21 |
| M06.1a-M06.2a-C-35 | Ningún error de `worker_api` incluye identificadores, hashes ni valores de parámetros: los mensajes son los fijos del catálogo, `DETAIL` y `HINT` quedan vacíos, y ningún SQLSTATE de clase `23` sale crudo (`23502` y los `23505` sin código propio dan `22023`; el choque de `p_connection_id` da `PX001`) | Sección 7, paso 3; CA-09; CB-02 |
| M06.1a-M06.2a-C-36 | `db:check:test`, `db:push:test`, `test:policies`, `test:app` y `verify` terminan en verde, sin pruebas omitidas y sin ningún comando contra el proyecto `app`; `db:push:test` lo corre el usuario | III.3, CB-01, CB-04, CB-06; `D-M06.1a-M06.2a-08` |

## Casos de prueba

Comandos: `npm run test:policies` (pgTAP), `npm run test:app` (Vitest `app`), `npm run verify`, `npm run db:check:test`. Los casos "manual" se verifican con el comando indicado y se registran en la evidencia.

| ID | Criterios | Tipo | Comando | Resultado esperado | ¿Falla sin la implementación? |
|---|---|---|---|---|---|
| M06.1a-M06.2a-T-01 | C-01 | manual | `git diff --name-status main -- supabase/migrations` (archivos con seguimiento, commiteados o no) **y** `git ls-files -co --exclude-standard -- supabase/migrations` comparado con `git ls-tree -r --name-only main -- supabase/migrations` (incluye los nuevos sin seguimiento) | Ninguna línea `M`, `D` ni `R` sobre una migración existente; la única ruta nueva respecto de `main` es `supabase/migrations/0012_integrations.sql` | No aplica: verifica el diff |
| M06.1a-M06.2a-T-02 | C-02 | manual | Lectura del encabezado de `0012` | Contiene la matriz de la sección 7 fila por fila con la columna `service_role` en "—", las reglas, la excepción de `count_credentials_by_key_version` y el catálogo `PX001` a `PX008` y `22023` | No aplica: documentación |
| M06.1a-M06.2a-T-03 | C-03, C-05 | manual | Lectura directa del archivo, con o sin seguimiento: `grep -n -i -E "^\s*(grant\|revoke)\|password" supabase/migrations/0012_integrations.sql` | Cada `grant` tiene antes un `revoke all` sobre el mismo objeto; ninguna coincidencia con `password` | No aplica: revisión estática |
| M06.1a-M06.2a-T-04 | C-04 | pgTAP (`09`) | `npm run test:policies` | `has_schema` de `worker_api`; `has_schema_privilege` falso para `anon` y `authenticated`, verdadero para `praxa_integrations`; sin entrada de `PUBLIC` en `nspacl` | Sí: el esquema no existe |
| M06.1a-M06.2a-T-05 | C-05 | pgTAP (`09`) | `npm run test:policies` | Atributos del rol en `pg_roles` según C-05, incluida la ausencia de `rolreplication`; cero filas en `pg_auth_members` con `praxa_integrations` como miembro | Sí: el rol no existe |
| M06.1a-M06.2a-T-06 | C-06 | pgTAP (`09`) | `npm run test:policies` | `enum_has_labels` con los valores exactos | Sí |
| M06.1a-M06.2a-T-07 | C-07 | pgTAP (`09`) | `npm run test:policies` | `columns_are` para las tres tablas y `col_not_null` / `col_is_null` según el contrato | Sí |
| M06.1a-M06.2a-T-08 | C-08 | pgTAP (`09`) | `npm run test:policies` | `relrowsecurity` y `relforcerowsecurity` verdaderos en las tres; `company_id` no nulo | Sí |
| M06.1a-M06.2a-T-09 | C-09 | pgTAP (`09`) | `npm run test:policies` | `has_table_privilege` para `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` y `TRIGGER` según la matriz, para `anon`, `authenticated`, `praxa_integrations` y `service_role` (falso en las siete para `service_role` en las tres tablas); `aclexplode(relacl)` de credenciales sin titulares distintos del dueño | Sí |
| M06.1a-M06.2a-T-10 | C-10 | pgTAP (`09`) | `npm run test:policies` | En `pg_policies`: una fila para conexiones con `cmd = SELECT`, `roles = {authenticated}` y `qual` con `is_company_member(company_id)`; cero para las otras dos | Sí |
| M06.1a-M06.2a-T-11 | C-13 | pgTAP (`09`) | `npm run test:policies` | En `pg_constraint`, todas las FK de las tres tablas hacia `companies`, `auth.users` o la conexión con `confdeltype = 'c'` | Sí |
| M06.1a-M06.2a-T-12 | C-15 | pgTAP (`09`) | `npm run test:policies` | Doce funciones en `worker_api`; todas `prosecdef`, `proconfig` con `search_path=""`, `proacl` no nulo y sin `grantee = 0`; `has_function_privilege` falso para `anon`, `authenticated` y `service_role`, verdadero para `praxa_integrations`, en cada una; `count_credentials_by_key_version` con `pronargs = 0` y las otras once con `p_actor_user_id` y `p_company_id` como primeros parámetros | Sí |
| M06.1a-M06.2a-T-13 | C-30 | pgTAP (`09`) | `npm run test:policies` | `sqlstate_as('praxa_integrations', …)`: `null` al ejecutar `list_pending_purges`, `create_oauth_attempt` y `count_credentials_by_key_version()` válidos; `42501` al leer cada tabla. `sqlstate_as('authenticated' \| 'anon', …)` sobre las doce funciones de `worker_api`, con `USAGE` sobre el esquema concedido a los dos roles solo dentro de la transacción de la prueba, para que el `42501` venga del `EXECUTE` revocado de cada función y no de la falta de `USAGE` (`D-M06.1a-M06.2a-17`); el `USAGE` temporal se revoca apenas termina T-13, antes de seguir con el resto del archivo: `42501` | Sí |
| M06.1a-M06.2a-T-14 | C-31 | pgTAP (`09`) | `npm run test:policies` | Cero funciones fuera de `worker_api` con `prosrc` que contenga `integration_credentials` | No: pasa también sin la migración; es una regresión contra futuras funciones. Se declara así |
| M06.1a-M06.2a-T-15 | C-32 | pgTAP (`09`) | `npm run test:policies` | `rolbypassrls` verdadero para el dueño (`proowner`) de las doce funciones | Sí: sin funciones, el conteo esperado no se cumple |
| M06.1a-M06.2a-T-16 | C-29, C-16 | pgTAP (`08`) | `npm run test:policies` | Aislamiento de la sección 10 del diseño (`08`): lecturas de A limitadas a A; escrituras y lecturas prohibidas con `42501`; llamadas cruzadas a `worker_api` con `PX001`, salvo `purge_connection`, que devuelve `false` (T-42) | Sí |
| M06.1a-M06.2a-T-17 | C-11, C-12, C-14, C-38 | pgTAP (`09b`) | `npm run test:policies` | Cada `insert` inválido de C-11, C-14 y C-38 con `throws_ok(…, '23514')`, incluidos: `needs_reauth` con clase y mensaje nulos; IV `AAAAAAAAAAAAAA==` (10 bytes) y `AAAAAAAAAAAAAAA=` (11 bytes); etiqueta de 15 bytes; `ciphertext` vacío; `granted_scopes` `{ads_read,Ads-Read}` (forma inválida), `{ads_read,ads_read}` (repetido), `{ads_read,NULL}` y `{business_management}` (sin `ads_read`). Control positivo: IV de 12 bytes, etiqueta de 16 y `{ads_read,business_management}` se insertan. Segunda viva y cuenta repetida con `23505`; `state_hash` repetido con `23505` | Sí |
| M06.1a-M06.2a-T-18 | C-17 | pgTAP (`09b`) | `npm run test:policies` | `initial` con viva → `PX003`; `initial` con `p_expected_connection_id` no nulo → `22023`; `reauth` con `p_expected_connection_id` nulo → `22023`; propósito `other` → `22023`; `reauth` sobre activa devuelve `expected_generation` igual a la de la fila; `reauth` sobre una pendiente no vencida → `PX004` y sobre una desconectada → `PX004` (`D-M06.1a-M06.2a-02`); vencimiento a 11 minutos o en el pasado → `22023`; reintento con el mismo `state` y navegador → la fila ya creada, sin fila duplicada (T-46 confirma que otro navegador con el mismo `state` sigue dando `22023`) | Sí |
| M06.1a-M06.2a-T-19 | C-18 | pgTAP (`09b`) + revisión | `npm run test:policies` | Primer consumo devuelve `purpose`; segundo → `PX002`; vencido, otro actor, otra empresa con actor miembro de ambas, otro hash de vinculación y `state` desconocido → `PX002`. En la revisión del código, el cuerpo de `consume_oauth_attempt` tiene una sola sentencia de escritura con todos los predicados y no llama a `private.lock_company`; todas las demás funciones que escriben sí lo llaman antes de tocar filas | Sí |
| M06.1a-M06.2a-T-20 | C-19 | pgTAP (`09b`) | `npm run test:policies` | Pendiente creada con `pending_expires_at` entre `now() + 29 min` y `now() + 31 min`, metadatos nulos, generación `0`, una fila de credencial; segunda creación con otro id → `PX003`; reintento idéntico → la misma pendiente, sin filas nuevas; mismo id con otro material cifrado → `PX003` | Sí |
| M06.1a-M06.2a-T-21 | C-20 | pgTAP (`09b`) | `npm run test:policies` | Pendiente con `pending_expires_at` movido al pasado como `postgres` → `confirm_connection` da `PX005`; probe falso → `22023`; zona `Mars/Olympus` → `22023`; caso válido → `active`; reintento idéntico → la misma fila `active`; reintento con otra moneda → `PX004`; misma cuenta, moneda y zona sobre una activa con generación 2 → `PX004` | Sí |
| M06.1a-M06.2a-T-22 | C-21 | pgTAP (`09b`) | `npm run test:policies` | Intento `reauth` consumido con generación 0, conexión llevada a generación 1 → `PX006`; intento no consumido, `initial` o consumido hace 11 minutos → `PX002`; consumido hace exactamente 10 minutos → válido; válido → generación + 1 y `active` desde `needs_reauth` | Sí |
| M06.1a-M06.2a-T-23 | C-22 | pgTAP (`09b`) | `npm run test:policies` | `active → needs_reauth` con `authentication`; clase `unknown` → `22023`; generación vieja → `PX006`; reintento con la misma generación y clase y otro mensaje → la fila, con el mensaje guardado intacto; misma clase con otra generación → `PX004` | Sí |
| M06.1a-M06.2a-T-24 | C-23 | pgTAP (`09b`) | `npm run test:policies` | Desde cada estado vivo: `disconnected`, generación + 1, marca de purga; desde pendiente, metadatos nulos y sin violar `check`; segunda llamada devuelve la misma fila | Sí |
| M06.1a-M06.2a-T-25 | C-24 | pgTAP (`09b`) | `npm run test:policies` | Activa → `PX004`; desconectada → `true` y cero filas en conexión, credencial e intentos que la esperaban; repetida → `false` | Sí |
| M06.1a-M06.2a-T-26 | C-25 | pgTAP (`09b`) | `npm run test:policies` | En pasos secuenciales, sin violar la regla de una conexión viva por empresa. Paso 1, empresa A: una desconectada con credencial y una pendiente con `pending_expires_at` en el pasado (la pendiente es la única viva) → la lista tiene las dos, con `reason` `disconnect_requested` y `pending_expired` y su `has_credential`. Paso 2: se desconecta y se purga la pendiente, y se crea y se confirma una conexión nueva en A (`active`) → la lista tiene solo la desconectada y no la activa. En la empresa B hay una desconectada y una pendiente vencida, y ninguna aparece en la lista de A en ningún paso | Sí |
| M06.1a-M06.2a-T-27 | C-26 | pgTAP (`09b`) | `npm run test:policies` | Con desconectada sin purgar con la cuenta X, confirmar otra pendiente con X → `PX007`; tras purgar, la misma confirmación → fila nueva `active` | Sí |
| M06.1a-M06.2a-T-28 | C-27 | pgTAP (`09b`) | `npm run test:policies` | Con credenciales en dos empresas (versiones 1 y 2), `count_credentials_by_key_version()` devuelve la suma de ambas por versión, con solo `key_version` y `credential_count`; después de recifrar una de versión 1 a 2, los conteos cambian en consecuencia; `rewrap_credential` con versión esperada vieja → `PX008`, con generación vieja → `PX006`, con versión nueva igual o menor a la guardada → `22023`; reintento con la misma versión esperada y el mismo material nuevo → la fila ya recifrada; con otro material → `PX008`; con el mismo material ya guardado y la versión esperada igual a la nueva → `22023` | Sí |
| M06.1a-M06.2a-T-29 | C-28 | pgTAP (`09b`) | `npm run test:policies` | Cada transición no declarada de la sección 8 → `PX004`, incluidos `needs_reauth → needs_reauth` con otra generación, `needs_reauth → active` por `confirm_connection` y `active → active` por `confirm_connection` con otra cuenta; `needs_reauth → needs_reauth` con la MISMA generación y otra clase ya no es una transición rechazada: devuelve la fila y conserva la clase original (D-21) | Sí |
| M06.1a-M06.2a-T-30 | C-16 | pgTAP (`09b`) | `npm run test:policies` | Las once funciones con actor y empresa, con actor no miembro, con actor nulo y con empresa nula → `PX001` (`count_credentials_by_key_version` no aplica: no tiene esos parámetros) | Sí |
| M06.1a-M06.2a-T-31 | C-35 | pgTAP (`09b`) | `npm run test:policies` | `throws_ok` con el mensaje exacto del catálogo en un caso de cada código `PX…` | Sí |
| M06.1a-M06.2a-T-32 | C-33 | pgTAP (`10`) | `npm run test:policies` | **Primera corrida, con el archivo solo con la parte 1** y sin `0012` (secuencia, pasos 2 y 3): su salida decide `H-E1-07` y la sección 9. Después, con la parte 2 agregada: partes 1 y 2 según C-33, con `lives_ok`, `throws_ok(…, '23503')` y conteos en cero. Se registra la salida de la parte 1 sola y, si hubo corrección, la del archivo completo después de aplicarla (en el ensayo y después del push), con la variante usada | Parte 1 sola: resuelve `H-E1-07` (pasa si la hipótesis es falsa; falla si es verdadera) y decide si `0012` lleva corrección. Parte 2: sí |
| M06.1a-M06.2a-T-33 | C-34 | app | `npm run test:app` | Las seis aserciones de 11; la suite no se omite | Sí: sin la tabla, la lectura 1 da error |
| M06.1a-M06.2a-T-34 | C-36, C-13 | app + pgTAP | `npm run test:app` y `npm run test:policies` | `cleanupRun()` termina sin error y `pendingCleanupCount()` es `0` después de borrar empresas con conexión y credencial; `01` a `07` siguen en verde | Sí para la limpieza con integración; no para `01` a `07` (regresión) |
| M06.1a-M06.2a-T-35 | C-36 | manual | `npm run db:check:test` | "Destino verificado." con el proyecto de pruebas y la confirmación de desechable presente | No aplica: guarda de destino |
| M06.1a-M06.2a-T-36 | C-36 | manual (usuario) | `npm run db:push:test` | Aplica `0012` sin error; la salida se registra sin la URL | No aplica: aplicación de la migración |
| M06.1a-M06.2a-T-37 | C-36, CB-01 | unit, component, build | `npm run verify` | Exit 0 (lint, typegen, typecheck, test y build; incluye el tipado de la prueba nueva de `tests/app`) | No aplica: regresión |
| M06.1a-M06.2a-T-38 | CB-02 | manual | Búsqueda por patrón sobre los archivos cambiados respecto de `main`, con y sin seguimiento: la lista es `git diff --name-only main` más `git ls-files -o --exclude-standard`, y sobre cada archivo de esa lista, lectura directa con `grep -n -E -i "act_[0-9]{6,}\|eyJ[A-Za-z0-9_-]{10,}\|EAA[A-Za-z0-9]{20,}\|postgres(ql)?://"` | Sin coincidencias | No aplica |
| M06.1a-M06.2a-T-39 | C-37 | pgTAP (`09b`) | `npm run test:policies` | En la empresa A, sembrados como `postgres` con fechas ajustadas: uno vencido sin consumir, uno consumido hace 11 minutos, uno consumido hace **exactamente** 10 minutos (`consumed_at = now() - interval '10 minutes'`; `now()` es fijo dentro de la transacción del archivo, así que el borde es determinista), uno consumido hace 2 minutos y ya vencido, y uno vigente; en la empresa B, uno vencido. Tras `create_oauth_attempt` válido en A: quedan el consumido hace 10 minutos, el consumido hace 2 minutos, el vigente y el nuevo; el vencido de B sigue. Una llamada que termina en `PX003` no borra nada | Sí |
| M06.1a-M06.2a-T-40 | C-02, C-03, C-15 | manual | Lectura directa del archivo, con o sin seguimiento: `grep -n -E "revoke all" supabase/migrations/0012_integrations.sql` | Cada `revoke all` sobre una tabla o función nueva incluye `service_role` | No aplica: revisión estática |
| M06.1a-M06.2a-T-41 | Fuera de alcance (`D-M06.1a-M06.2a-06`, `-09`) | manual | `git diff --name-only main -- scripts/lib/target.mjs tests/app/helpers.ts docs/SECURITY.md vitest.config.mts` | Sin salida: la excepción `SUPABASE_TEST_ALLOW_APP_PROJECT` sigue intacta para `M06.3a` y `vitest.config.mts` no cambia (`H-E1-18` diferido) | No aplica: revisión del diff |
| M06.1a-M06.2a-T-42 | C-24, C-16 | pgTAP (`08`) | `npm run test:policies` | Con B desconectada y con credencial e intento `reauth`: `purge_connection(actor A, empresa A, conexión de B)` → `false`, igual que `purge_connection(actor A, empresa A, uuid inexistente)` → `false`; después, como `postgres`, la conexión de B sigue `disconnected` con su credencial y su intento (conteos iguales a los de antes) | Sí |
| M06.1a-M06.2a-T-43 | Intervenciones (despliegue reservado al usuario) | manual | Al cierre: `git status -sb`, `git branch -vv` y `git log --oneline main..HEAD` (funcionan en una rama nueva sin upstream) | La rama no tiene upstream, o el upstream no tiene commits empujados por el asistente sin pedido; los commits de `main..HEAD` los pidió el usuario; el asistente no hizo deploy ni `db:push` al proyecto `app` | No aplica: revisión del estado |
| M06.1a-M06.2a-T-44 | Contexto verificado (referencias) | manual | `grep -n -E "HALLAZGOS\.md:68\|plan\.md:578\|plan\.md:192\|sección 10\.1\|de 10\.1\|credential\.ts:(37\|45\|46\|47\|48-56\|45-56)" docs/FASES/FASE1/M06.1a-M06.2a/spec.md \| grep -v "T-44"` | Sin coincidencias (se excluye la fila de este caso, que contiene el patrón): las referencias corregidas citan `H-E1-19`, plan.md:581, plan.md:193 y 208, la sección 10 del diseño y `credential.ts:35`, `:42`–`:44` y `:49-57` | No aplica: revisión documental |
| M06.1a-M06.2a-T-45 | C-35 (`23502`) | pgTAP (`09b`) | `npm run test:policies` | Con `pg_temp.error_of`: `create_oauth_attempt` con `p_state_hash` nulo y con `p_expires_at` nulo, y `create_pending_connection` con `p_ciphertext` nulo → `sqlstate = '22023'`, `message = 'praxa: argumento inválido'`, `detail` y `hint` nulos o vacíos | Sí |
| M06.1a-M06.2a-T-46 | C-35 (`23505` de `state_hash`) | pgTAP (`09b`) | `npm run test:policies` | Dos `create_oauth_attempt` con el mismo `p_state_hash` (el primero vigente) → el segundo da `22023` con el mensaje fijo, `detail` y `hint` vacíos, y el hash no aparece en ningún campo del error | Sí |
| M06.1a-M06.2a-T-47 | C-35 (`23505` de clave primaria), C-16 | pgTAP (`09b`) | `npm run test:policies` | Empresa A con una conexión propia `disconnected` (sin conexión viva): `create_pending_connection` con el `id` de esa conexión → `PX001`, `praxa: operación no autorizada`, `detail` y `hint` vacíos; no se crea ninguna fila | Sí |
| M06.1a-M06.2a-T-48 | C-16 (`create_pending_connection` con conexión ajena) | pgTAP (`08`) | `npm run test:policies` | Con una tercera empresa C, con su propio actor y sin conexión viva: `create_pending_connection(actor C, empresa C, id de la conexión de B)` → `PX001` con el mismo mensaje, `detail` y `hint` vacíos que en T-47 (indistinguible); la conexión y la credencial de B quedan intactas y C no tiene filas nuevas | Sí |

## Verificación

En este orden, con la salida real registrada en la evidencia (CB-05):

1. `npm run db:check:test` (asistente).
2. `npm run db:push:test` (usuario).
3. `npm run test:policies`: todos los archivos `OK`, incluidos `01` a `07`.
4. `npm run test:app`: todas las suites ejecutadas; **ninguna** omitida. Si `describe.skipIf` salta alguna, la corrida no cuenta (CB-06).
5. `npm run verify`: exit 0. Si Vitest falla al cargar desde Git Bash, repetirlo con `powershell -NoProfile -Command "npm run verify"` antes de reportar una regresión (`H-E1-20`); un fallo de arranque del pool de workers se repite una vez y se registra (`H-E1-18`).
6. T-01, T-02, T-03, T-38, T-40 y T-41 (revisión estática y búsqueda por patrón).

III.3 exige para `M06.1a` `db:check:test` y `db:push:test`, y para `M06.2a` `db:check:test`, `test:policies` y `test:app`, además de `verify`. Ninguna prueba corre contra el proyecto `app` (CB-04), y `db:preview` no se usa porque apunta a ese proyecto.

## Intervenciones del usuario y acciones reservadas

| Paso | Qué hace el usuario | Cómo se verifica después |
|---|---|---|
| Antes de implementar | Hecho: el usuario respondió `Q-01` a `Q-06` en el grill del 2026-09-26 | Decisiones `D-M06.1a-M06.2a-01` a `-06` |
| Secuencia, paso 6 (`D-M06.1a-M06.2a-08`) | Correr `npm run db:push:test` después de que el asistente corrió `db:check:test` y, si lo hizo, el ensayo | El asistente corre `test:policies` y ve `09` con el esquema y el rol presentes; la salida del push queda en la evidencia sin URL |
| Solo si aparece un defecto de `0012` **después** del push | Decidir entre restablecer el proyecto de pruebas (borrar los objetos de `0012` y su fila en el historial de migraciones) y volver a aplicar, o una migración correctiva con renumeración de las siguientes | El asistente frena (III.9) y registra la decisión; después, `db:push:test` y la suite completa en verde |
| Cierre | Aprobar `G-DB-META` | `PROJECT_STATE.md` lo registra con fecha |
| Cuando lo pida | Commit y push de la rama | `git log` / estado del remoto |
| Reservado al usuario, no en esta microfase | Cualquier despliegue o publicación: deploy en Vercel, `db:push` al proyecto `app`, push de ramas y commits. El asistente no despliega ni publica nada | `git status` y el historial del remoto sin cambios hechos por el asistente |
| No en esta microfase | `db:push` al proyecto `app`, contraseña del rol y verificación de esquemas expuestos en el dashboard | Se hacen en `M06.3a` (contraseña en pruebas) y `M28.2a` (proyecto `app`) |

Las fichas de `M06.1a` y `M06.2a` piden una sola intervención: ejecutar `npm run db:push:test` cuando la microfase lo pida, porque el asistente lo tiene denegado en `.claude/settings.json` (plan.md:193 y 208; III.2, plan.md:766; commit `b9d067e`; `D-M06.1a-M06.2a-08`). No piden otras.

## Trampas y riesgos

De la ruta:

1. **`force` no protege `worker_api`** (II.4, primera trampa; `H-E1-05`). Las funciones son de `postgres`, que omite RLS. Lo que protege es el chequeo de pertenencia de cada función. C-32 afirma el `bypassrls` del dueño para que un cambio futuro no deje las funciones leyendo cero filas en silencio.
2. **`private.is_company_member()` lanza sin `auth.uid()`** (II.4, segunda trampa): no se usa en `worker_api`.
3. **Transiciones en la función, no en Zod** (II.4, tercera trampa).
4. **`05_delete_carveout` no tiene reportes** (II.5, trampa): la hipótesis del `restrict` la resuelve `10`; si falla, hallazgo y corrección en una migración nueva, sin tocar `0003`.
5. **Grants olvidados dan `42501` por la Data API, desde el 2026-10-30 también en tablas nuevas** (II.5, segunda trampa; `H-E1-11`): por eso `test:app` lee por la Data API. Una política que no deja pasar filas es silenciosa: la cubren `08` y `09`.
6. **El rol de C en pgTAP usa `set role` sobre la conexión existente** (II.5, tercera trampa): `PRAXA_INTEGRATIONS_TEST_DB_URL` es de `M06.3a`. Una prueba omitida no aprueba el gate (CB-06).
7. **Postgres 16 o posterior puede exigir un grant para `set role`** (II.5, hipótesis): se resuelve con el `grant … to current_user` revertido por el `rollback` (H-S-02).

Del código:

8. **Corregir `0012` después del push no la vuelve a aplicar.** `supabase db push` registra la versión y no reaplica un archivo editado. Por eso el ensayo con rollback antes del push, y por eso un defecto posterior es una condición de parada.
9. **`proacl` nulo significa `EXECUTE` para `PUBLIC`.** Revisar `aclexplode` sin comprobar antes que `proacl` no sea nulo aprueba una función abierta.
10. **Las funciones de pgTAP no son usables como `praxa_integrations`** (sin `USAGE` sobre `extensions`): toda aserción corre como `postgres` y el rol se asume solo dentro de `pg_temp.sqlstate_as`.
11. **Nombres de salida y columnas iguales** en funciones `returns table`: toda columna con alias.
12. **Un error SQL no capturado invalida el archivo pgTAP entero** (`run-pgtap.mjs:74-99`): cada rechazo esperado va dentro de `throws_ok`.
13. **Orden de archivos:** `08` < `09` < `09b` < `10` por orden de nombre (`run-pgtap.mjs:163`).
14. **`db:preview` apunta al proyecto `app`** (`package.json:22`): no se usa.
15. **Lectura como `authenticated` sin claims** hace que la política lance `42501` por falta de sesión, no por aislamiento: fijar siempre `request.jwt.claims`.
16. **`sin datos reales`:** cuentas `cuenta_sintetica_…`, nunca `act_` con dígitos; hashes y material cifrado de relleno.
17. **Flakiness de Vitest** (`H-E1-18`, diferido por `D-M06.1a-M06.2a-09`; `H-E1-20`): no confundir con regresiones.
18. **Consumo de intentos y `read committed`:** si alguien lo reescribe como `select` + `update`, reabre la ventana de reutilización (II.9, "Trampa conocida", plan.md:581). C-18 lo revisa en el código.

Riesgos:

- `H-E1-07` confirmado y ninguna de las dos variantes de la sección 9 alcanza: el gate no se puede aprobar (CA-67). Condición de parada: se frena y se lleva al usuario con la salida de la prueba `10`.
- La purga de intentos borra un intento `reauth` consumido que todavía se necesitaba si `replace_credential` llega más de 10 minutos después del consumo: da `PX002` y el dueño vuelve a empezar. Es el margen que fija la ruta (plan.md:456). Desde `D-M06.1a-M06.2a-14`, `replace_credential` rechaza ese intento con `PX002` aunque la purga no haya corrido, así que el resultado no depende de esa carrera.
- **Diferencia de relojes con `M16.1`.** `create_oauth_attempt` rechaza con `22023` un `p_expires_at` posterior a `now() + 10 minutos` medido con el reloj de la base (`D-M06.1a-M06.2a-10`), y el `check` de la tabla mide contra `created_at = now()`. Si `M16.1` calcula el vencimiento como exactamente 10 minutos con el reloj de su servidor, cualquier adelanto de ese reloj respecto del de la base da un `22023` intermitente. `M16.1` tiene que usar una vida del intento menor a 10 minutos, con margen (por ejemplo, 9 minutos). Esta microfase no cambia el tope; el caso de 11 minutos de T-18 y el de T-17 fijan el borde en la base.
- Mientras una conexión `pending_selection` esté vigente, la base no deja iniciar ningún intento (`PX003` para `initial`, `PX004` para `reauth`). Es el comportamiento buscado; cómo lo destraba la UI es `H-E1-21` (`M16.1`, `M16.2`).

## Decisiones de la microfase

| ID | Decisión | Motivo | Decidió | Fecha |
|---|---|---|---|---|
| D-M06.1a-M06.2a-01 (`Q-01`) | `0012` revoca también a `service_role` todos los privilegios sobre `oauth_attempts`, `integration_connections` e `integration_credentials` y sobre las doce funciones de `worker_api`. La matriz del encabezado suma la columna `service_role` con "—" en todas las filas | Ningún código de la aplicación usa `service_role` (`SECURITY.md:121-133`); los fixtures siembran por `worker_api` y limpian por cascada, que no necesita grants (H-S-05); la matriz queda igual antes y después del cambio de Supabase del 2026-10-30; y `service_role` no puede leer los hashes de los intentos por la Data API. Verifican: T-02, T-09, T-12, T-40 | Usuario (grill) | 2026-09-26 |
| D-M06.1a-M06.2a-02 (`Q-02`) | `create_oauth_attempt` con propósito `reauth` solo se acepta sobre una conexión `active` o `needs_reauth`; sobre `pending_selection` (y `disconnected`) da `PX004` | CA-37c exige que la cuenta conectada esté entre las delegadas y una pendiente no tiene cuenta; DEC-17 ya resuelve el abandono. El bloqueo que eso deja al dueño queda registrado como `H-E1-21`, asignado a `M16.1` y `M16.2` (`5bc7472`). Verifican: T-18, T-29 | Usuario (grill) | 2026-09-26 |
| D-M06.1a-M06.2a-03 (`Q-03`) | `create_oauth_attempt`, después del cerrojo de empresa, purga de esa empresa los intentos vencidos sin consumir y los consumidos hace más de 10 minutos, el TTL máximo ratificado en `H-E1-19` (CA-38b) | Decisión de la ruta: plan.md:456, commit `5bc7472`. El alcance exacto de "vencidos" lo precisa `D-M06.1a-M06.2a-07`. Verifica: T-39 | Usuario (ruta, `5bc7472`) | 2026-09-26 |
| D-M06.1a-M06.2a-04 (`Q-04`) | `count_credentials_by_key_version()` no recibe actor ni empresa, cuenta las credenciales de todas las empresas y devuelve solo `(key_version, credential_count)`; solo `praxa_integrations` la ejecuta. `rewrap_credential` mantiene actor y empresa | Decisión de la ruta: única excepción de II.4, plan.md:452, commit `5bc7472`. CA-25 exige confirmar que **ninguna** credencial usa la clave antes de retirarla. Verifican: T-12, T-13, T-28, T-30 | Usuario (ruta, `5bc7472`) | 2026-09-26 |
| D-M06.1a-M06.2a-05 (`Q-05`) | Primero corre la parte 1 de la prueba `10`. Solo si confirma `H-E1-07`, `0012` recrea antes de su primer push `reports_context_fkey` como `on delete no action` **no diferida**, verificada con la misma prueba `10`. Solo si la prueba demuestra que la no diferida no alcanza, se usa `on delete no action deferrable initially deferred`. Si la parte 1 pasa, `0012` no toca `reports` | `no action` se verifica al final de la sentencia, así que deja pasar la cascada desde `companies` y borrar un contexto con reportes sigue fallando en el momento; la diferida solo posterga ese fallo al confirmar. Ninguna renumera `0013`/`0014` ni modifica `0003`. Es la variante del usuario, distinta de las opciones A, B y C propuestas. Verifica: T-32 | Usuario (grill) | 2026-09-26 |
| D-M06.1a-M06.2a-06 (`Q-06`) | `H-M04.1-02` queda fuera de este grupo: lo cierra `M06.3a`, paso 7c de II.6, con `scripts/lib/target.mjs`, `tests/app/helpers.ts` y `docs/SECURITY.md` | Decisión de la ruta: plan.md:513 y `HALLAZGOS.md:8`, commit `5bc7472`. `M06.3a` ya modifica la guarda de destino y la documentación de seguridad. Verifica: T-41 | Usuario (ruta, `5bc7472`) | 2026-09-26 |
| D-M06.1a-M06.2a-07 | La purga de `create_oauth_attempt` borra, de esa empresa, los intentos **no consumidos ya vencidos** y los **consumidos hace más de 10 minutos** (`consumed_at < now() - interval '10 minutes'`). Un intento consumido se conserva hasta cumplir 10 minutos desde el consumo aunque haya vencido | Un intento `reauth` consumido tiene que sobrevivir hasta `replace_credential` aunque su `expires_at` ya haya pasado. La ruta ya lo dice así: plan.md:456, commit `b9d067e` ("los intentos no consumidos ya vencidos y los consumidos hace más de 10 minutos"). Resuelve el hallazgo de la auditoría sobre la lectura de "vencidos" y el comparador `<`. Verifica: T-39 (con el borde exacto de 10 minutos) | Usuario (ruta, `b9d067e`) | 2026-09-26 |
| D-M06.1a-M06.2a-08 | `npm run db:push:test` lo ejecuta el usuario, cuando la microfase lo pide (secuencia, paso 6), después de que el asistente corrió `db:check:test` y el ensayo | El asistente tiene ese comando denegado en `.claude/settings.json`. La ruta ya lo dice así: fichas de `M06.1a` y `M06.2a` (plan.md:193 y 208) y III.2 (plan.md:766), commit `b9d067e`. Resuelve la contradicción de la auditoría entre la spec y las fichas. Verifican: T-35 (el asistente verifica el destino antes) y T-36 (salida del push del usuario, sin URL) | Usuario (ruta, `b9d067e`) | 2026-09-26 |
| D-M06.1a-M06.2a-09 | `H-E1-18` se difiere: no se resuelve en esta microfase y queda en "Fuera de alcance". Esta microfase no modifica `vitest.config.mts`. Si aparece en `verify`, se repite una vez y se registra (Verificación, paso 5) | Es un fallo intermitente del pool de Vitest en una prueba de UI (`tests/component/onboarding-wizard.test.tsx`), ajeno a esta microfase de base de datos; se resuelve como tarea aparte. En la primera auditoría de esta spec no se reprodujo: aquella corrida falló por el sandbox (`spawn EPERM`, `revisiones/spec-audit-1.md:71`), que es un problema de entorno distinto de `H-E1-18`. La decisión no depende de que se repita. Verifican: T-37 (con la regla de repetición) y T-41 (`vitest.config.mts` sin cambios) | Usuario | 2026-09-26 |
| D-M06.1a-M06.2a-10 | `oauth_attempts` hace cumplir en la base la vida máxima de 10 minutos: `check (expires_at > created_at and expires_at <= created_at + interval '10 minutes')`, y `create_oauth_attempt` rechaza con `22023` un `p_expires_at` fuera de `(now(), now() + 10 minutos]` | Decisión derivada: el usuario ratificó el tope de 10 minutos de K02 (`OAUTH_ATTEMPT_MAX_TTL_MS`) al aprobar `G-K02-K04` el 2026-09-26, y `H-E1-19` asigna a M06.1a decidir si la base lo hace cumplir con un `check`. Verifican: T-17 (vencimiento mayor a 10 minutos o no posterior a la creación → `23514`) y T-18 (11 minutos o en el pasado → `22023`) | Usuario (ratificación en `G-K02-K04`; derivada) | 2026-09-26 |
| D-M06.1a-M06.2a-11 | `create_pending_connection` es idempotente: si ya existe una conexión con el mismo `p_connection_id`, de la misma empresa, en `pending_selection`, con el mismo `client_business_id` y una credencial igual a los parámetros (el material cifrado, byte a byte), devuelve esa fila sin escribir. Otro id con conexión viva sigue dando `PX003`, igual que el mismo id con otro material cifrado; un id ajeno o de una conexión `disconnected` sigue dando `PX001` (T-47 y T-48 no cambian) | Un reintento es la misma llamada repetida con los mismos parámetros; si el servidor vuelve a cifrar, es una operación nueva. Solo mira filas de la propia empresa, así que no revela nada de otra. Verifican: T-20, T-47, T-48. Enmienda de alineación con AGENTS.md:48, decidida por el usuario sin nueva auditoría | Usuario (corrección de revisión) | 2026-09-27 |
| D-M06.1a-M06.2a-12 | `confirm_connection` es idempotente: si la fila ya está `active` con la misma cuenta, moneda y zona, y con generación `0`, devuelve la fila sin escribir. Cualquier otra diferencia sigue dando `PX004` | La función no recibe generación. "La misma generación" es la que deja la confirmación: una pendiente nace con `0` y confirmar no la cambia, así que otra generación significa que hubo una reautorización después y ya no es un reintento. Verifican: T-21, T-29. Enmienda de alineación con AGENTS.md:48, decidida por el usuario sin nueva auditoría | Usuario (corrección de revisión) | 2026-09-27 |
| D-M06.1a-M06.2a-13 | `mark_needs_reauth` es idempotente: si la fila ya está `needs_reauth` con generación igual a `p_expected_generation` y la misma clase, devuelve la fila sin escribir. El mensaje no se compara y se conserva el guardado. Cualquier otra diferencia sigue dando el error de antes (`PX004`) | El mensaje lo redacta el servidor y puede variar entre intentos sin cambiar el hecho registrado. Verifican: T-23, T-29. Enmienda de alineación con AGENTS.md:48, decidida por el usuario sin nueva auditoría | Usuario (corrección de revisión) | 2026-09-27 |
| D-M06.1a-M06.2a-14 | `replace_credential` rechaza con `PX002` un intento `reauth` consumido hace más de 10 minutos (`consumed_at >= now() - interval '10 minutes'`); uno consumido hace exactamente 10 minutos sirve | Hace explícito el riesgo de la reautorización demorada (Trampas y riesgos): el resultado ya no depende de que la purga de `create_oauth_attempt` haya corrido. Mismo borde que la purga (`D-M06.1a-M06.2a-07`). Verifica: T-22. Enmienda de alineación con AGENTS.md:48, decidida por el usuario sin nueva auditoría | Usuario (corrección de revisión) | 2026-09-27 |
| D-M06.1a-M06.2a-15 | `rewrap_credential` rechaza con `22023` una `p_key_version` menor o igual a la guardada | Recifrar con la misma versión no rota nada, y con una anterior volvería a una clave que se está retirando (CA-25). Es un argumento inválido, no un cambio concurrente (`PX008`). Verifica: T-28. Enmienda de alineación con AGENTS.md:48, decidida por el usuario sin nueva auditoría | Usuario (corrección de revisión) | 2026-09-27 |
| D-M06.1a-M06.2a-16 | La creación del rol `praxa_integrations` es idempotente: si ya existe, `alter role` con los mismos atributos (`login nobypassrls noinherit`), sin tocar la contraseña | La migración no falla con `42710` en un proyecto donde el rol ya existe. Verifican: T-05, y el ensayo con el rol ya creado. Enmienda de alineación con AGENTS.md:48, decidida por el usuario sin nueva auditoría | Usuario (corrección de revisión) | 2026-09-27 |
| D-M06.1a-M06.2a-17 | T-13 prueba la revocación de `EXECUTE` función por función, con `USAGE` sobre `worker_api` concedido a `anon` y `authenticated` solo dentro de la transacción de la prueba | Sin `USAGE`, el `42501` llega antes de mirar el `EXECUTE` de cada función y oculta un grant de más. Verifica: T-13. Enmienda de alineación con AGENTS.md:48, decidida por el usuario sin nueva auditoría | Usuario (corrección de revisión) | 2026-09-27 |
| D-M06.1a-M06.2a-18 | Si `praxa_integrations` ya existe con una membresía en otro rol, la migración se la revoca antes de fijar sus atributos; si ya es `SUPERUSER`, la migración se detiene, porque `postgres` no tiene permiso para quitárselo | `NOINHERIT` solo evita la herencia automática de privilegios; una membresía igual permite `SET ROLE`. Sin este chequeo, un rol manipulado a mano en el dashboard quedaría con privilegios de más después de un `db:push:test` que no toca ese aspecto. Verifica: T-05. Enmienda de alineación con AGENTS.md:48, decidida por el usuario sin nueva auditoría | Usuario (corrección de revisión) | 2026-09-27 |
| D-M06.1a-M06.2a-19 | El reintento de `create_pending_connection` exige, además de lo que ya pedía `D-M06.1a-M06.2a-11`, que `pending_expires_at` todavía no haya pasado; si venció, no cuenta como reintento y sigue el camino normal (`PX003`) | Sin este chequeo, un reintento tardío devolvía como éxito una pendiente ya vencida, y el servidor seguía con la selección de cuenta sobre una fila que `confirm_connection` iba a rechazar con `PX005`. Verifica: T-20. Enmienda de alineación con AGENTS.md:48, decidida por el usuario sin nueva auditoría | Usuario (corrección de revisión) | 2026-09-27 |
| D-M06.1a-M06.2a-20 | `replace_credential`, `rewrap_credential` y `create_oauth_attempt` también son idempotentes: un reintento con los mismos parámetros (en `create_oauth_attempt`, mismo `state`, actor, empresa y vinculación de navegador, sin consumir y sin vencer) devuelve la fila ya escrita en vez de un error de negocio (`PX002`, `PX006`, `PX008` o `22023` por unicidad de `state_hash`). `consume_oauth_attempt` sigue dando error en cualquier reintento (CA-03: el consumo es de una sola vez) | Sin esto, una respuesta perdida en cualquiera de estas tres funciones dejaba al servidor sin forma de confirmar que la escritura ya se había aplicado, y lo llevaba a pedirle al dueño que repitiera un paso de OAuth ya completado. `browser_binding_hash` se suma al criterio de `create_oauth_attempt` porque, sin él, un segundo intento real desde otro navegador que reutilizara accidentalmente el mismo `state` se confundiría con un reintento (T-46 exige que eso siga dando `22023`). Verifican: T-18, T-22, T-28. Enmienda de alineación con AGENTS.md:48, decidida por el usuario sin nueva auditoría | Usuario (corrección de revisión) | 2026-09-27 |
| D-M06.1a-M06.2a-21 | `mark_needs_reauth` acepta como reintento cualquier clase de reautorización, siempre que la generación coincida con la ya registrada; conserva la clase y el mensaje guardados y no los sobrescribe | Dos procesos pueden observar clases de error distintas para el mismo token (por ejemplo, `authentication` y `permission` en llamadas casi simultáneas a Meta); exigir la misma clase para reconocer el reintento hacía que el segundo proceso recibiera `PX004` como si fuera una transición inválida, cuando la conexión ya estaba correctamente marcada. Verifican: T-23, T-29. Enmienda de alineación con AGENTS.md:48, decidida por el usuario sin nueva auditoría | Usuario (corrección de revisión) | 2026-09-27 |
| D-M06.1a-M06.2a-22 | El reintento de `rewrap_credential` exige además `p_expected_key_version < p_key_version`. Una llamada con el mismo material ya guardado y la versión esperada igual a la nueva no es un reintento y da `22023` (`D-M06.1a-M06.2a-15`) | Hallazgo de la revisión de Copilot en el PR #12: el bloque de reintento no miraba la versión esperada, así que una llamada "espero la 2, dejala en 2" con el material ya guardado devolvía éxito y salteaba la regla de `-15`. La condición no es arbitraria: toda llamada que haya tenido éxito cumplió `p_expected_key_version < p_key_version`. El usuario aplicó la corrección de Copilot en GitHub (`54aafe4`); la regresión se agregó después. Verifica: T-28. Enmienda de alineación con AGENTS.md:48, decidida por el usuario sin nueva auditoría | Usuario (revisión del PR) | 2026-09-28 |

## Supuestos e hipótesis

- **H-S-01 — HIPÓTESIS.** En el proyecto de pruebas, `postgres` tiene `rolbypassrls`, así que las funciones `SECURITY DEFINER` leen las tablas con `force row level security`. La documentación de Supabase dice que `postgres` "tiene privilegios de administrador" y no es superusuario, sin nombrar `bypassrls` (https://supabase.com/docs/guides/database/postgres/roles-superuser). *Cómo y cuándo:* el ensayo del paso 5 y T-15 en la primera corrida de `test:policies`. Si es falsa, las funciones leen cero filas y las pruebas de `09b` fallan: condición de parada.
- **H-S-02 — HIPÓTESIS.** En Postgres 17 (`config.toml:52`), `postgres` recibe `ADMIN OPTION` sobre el rol que crea pero no `SET`, y puede concederse la membresía con `grant praxa_integrations to current_user` dentro de la transacción de la prueba. *Cómo y cuándo:* ensayo y primera corrida de `09`. Si falla, se frena y se presenta al usuario la alternativa de un grant permanente en `0012` (`with inherit false, set true`), que afectaría también al proyecto `app`.
- **H-S-03 — HIPÓTESIS.** Supabase permite a `postgres` `create role … login nobypassrls noinherit` sin contraseña desde una migración. *Cómo y cuándo:* ensayo y `db:push:test`.
- **H-S-04 — HIPÓTESIS (`H-E1-07`).** El `restrict` de `reports_context_fkey` rompe la cascada desde `companies` porque la acción `cascade` hacia `company_context_versions` se ejecuta antes que la de `reports` y el chequeo `restrict` corre al terminar esa sentencia anidada. *Cómo y cuándo:* parte 1 de `10`, en la corrida en rojo del paso 3, antes de escribir `0012`. Puede resultar falsa: Postgres ejecuta las acciones en cascada sin disparar en ese momento los triggers que generan, así que el chequeo del `restrict` podría correr al final del `delete` de `companies`, cuando los reportes ya no existen. Si es verdadera, se aplica la sección 9 (`D-M06.1a-M06.2a-05`).
- **H-S-10 — HIPÓTESIS (solo si H-S-04 es verdadera).** `on delete no action` no diferida alcanza para que la cascada desde `companies` pase, porque se verifica al final de la sentencia externa. *Cómo y cuándo:* la parte 1 de `10` en el ensayo con rollback, con la sección de la sección 9 en su variante no diferida. Si falla, se pasa a la diferida (sección 9, paso 3).
- **H-S-05 — HIPÓTESIS.** Las acciones referenciales en cascada corren como dueño de la tabla y sin forzar RLS, así que `cleanupRun()` (clave de servicio) y el borrado de `10` atraviesan tablas con `force` aunque `service_role` no tenga grants sobre ellas. *Cómo y cuándo:* T-32 y T-34.
- **H-S-06 — HIPÓTESIS.** Por la Data API, un esquema no expuesto, una RPC inexistente y una tabla sin grant devuelven error. El código exacto (`PGRST106`, `PGRST202`, `42501`) puede variar según la versión de PostgREST; por eso T-33 solo exige error y ausencia de datos. Para la tabla sin grant, la documentación oficial confirma `42501` (https://supabase.com/docs/guides/api/securing-your-api). *Cómo y cuándo:* primera corrida de `test:app`.
- **H-S-07 — HIPÓTESIS.** El proyecto de pruebas remoto expone solo `public` y `graphql_public`. *Cómo y cuándo:* aserción 4 de T-33. La verificación en el dashboard del proyecto `app` es de `M28.2a`.
- **H-S-08 — HIPÓTESIS.** `supabase db push` aplica cada archivo en una transacción, así que un error de `0012` no deja objetos a medias ni registra la versión. *Cómo y cuándo:* si el push falla, el asistente comprueba con `test:policies` que `worker_api` no existe antes de pedir un nuevo push.
- **H-S-09 — HIPÓTESIS.** Los nombres de zona de `pg_timezone_names` coinciden con los que acepta `Intl` en Node para las zonas de Meta. *Cómo y cuándo:* en `M16.2`, con la zona real de VR-01; si no coinciden, se registra un hallazgo.
- **Supuesto verificado.** En proyectos existentes, Supabase concede por defecto privilegios de tabla a `anon`, `authenticated` y `service_role` sobre tablas nuevas de `public`, y un grant faltante da `42501` con una pista (documentación oficial citada arriba). Es la razón de `revoke all` en cada tabla y de `D-M06.1a-M06.2a-01`.

## Preguntas abiertas

Ninguna. `Q-01` a `Q-06` quedaron resueltas como `D-M06.1a-M06.2a-01` a `-06`, y los hallazgos de la auditoría que requerían decisión, como `D-M06.1a-M06.2a-07` a `-10`.

## Hallazgos relacionados

- `H-E1-05` (force RLS; se cumple en las tablas nuevas, C-08).
- `H-E1-06` (orden de borrado empresa → usuario; C-33).
- `H-E1-07` (hipótesis del `restrict`; T-32 y `D-M06.1a-M06.2a-05`).
- `H-E1-11` (grants explícitos para la Data API; C-34).
- `H-E1-12` (`verify` no corre pgTAP ni `test:app`; sección Verificación).
- `H-E1-18` (fallo intermitente del pool de Vitest): diferido, fuera de alcance (`D-M06.1a-M06.2a-09`; T-41).
- `H-E1-20` (inestabilidad de Vitest desde Git Bash; Verificación, paso 5).
- `H-E1-19` (columnas `created_at` y `provider`, y `check` de la vida máxima; C-07 y C-14; el mismo TTL fija el margen de la purga, C-37).
- `H-E1-22` (ninguna función de la base registra una clase de error que no lleve a `needs_reauth`; asignado a `M16.1` y `M16.2`; fuera de alcance).
- `H-E1-21` (bloqueo con una pendiente vigente; asignado a `M16.1` y `M16.2`; aquí solo `D-M06.1a-M06.2a-02`).
- `H-M04.1-02` (excepción de destino de pruebas): fuera de alcance, asignado a `M06.3a` (`D-M06.1a-M06.2a-06`; T-41).
- `H-M04.1-01`, `-03`, `-05`, `-08` y `H-M04.2-02`: no aplican a esta microfase (`HALLAZGOS.md:7-16`).

## Auditorías

- `revisiones/spec-audit-1.md` (2026-09-26, commit `5bc7472`, hash `a79fff1a843af0905cf98dde97d97e19b8ec3d58`): **REQUIERE CAMBIOS**. Correcciones técnicas aplicadas en esta versión (parte 1 de `10` sola, invariantes de K04, clase en `needs_reauth`, comparador de la purga y su borde, casos con archivos sin seguimiento, excepción de cerrojo, semántica de `purge_connection`, código de `initial` con conexión esperada, referencias corregidas y despliegue reservado); decisiones `D-M06.1a-M06.2a-07` a `-10`.
- `revisiones/spec-audit-2.md` (2026-09-26, commit `b9d067e`): **REQUIERE CAMBIOS**, sin decisiones del usuario. Aplicadas A-01 a A-08: traducción completa de los errores de clase `23` sin `DETAIL` (T-45 a T-47), `PX001` para un `p_connection_id` existente en `create_pending_connection` (T-47, T-48), T-26 en pasos secuenciales, citas de `credential.ts`, fila heredada de CA-38b, motivo de `D-M06.1a-M06.2a-09`, T-43 sin upstream y hallazgo `H-E1-22`.
- `revisiones/spec-audit-3.md` (2026-09-26, commit `b9d067e`, hash `512350f97431ca4d991782e1156a314ea3de8f33`): **REQUIERE CAMBIOS**, sin decisiones del usuario. Aplicadas A-01 a A-04: `on conflict` por nombre de restricción, `vitest.config.mts`, lectura de la conexión existente antes de los chequeos propios (y `PX001` antes que `PX002` en `replace_credential`) y riesgo de diferencia de relojes para `M16.1`. Falta una nueva auditoría.
- **Enmienda del 2026-09-27, primera ronda** (corrección de la revisión de implementación, sin nueva auditoría por decisión del usuario): alineación con AGENTS.md:48 (toda escritura idempotente) y ajustes de la revisión, `D-M06.1a-M06.2a-11` a `-17`. El estado sigue `APROBADA`.
- **Enmienda del 2026-09-27, segunda ronda** (corrección de una revisión de código sobre la primera ronda, sin nueva auditoría por decisión del usuario): el rol idempotente también revoca membresías heredadas y se detiene si ya es `SUPERUSER` (`D-M06.1a-M06.2a-18`); el reintento de `create_pending_connection` exige que la pendiente no haya vencido (`-19`); `replace_credential`, `rewrap_credential` y `create_oauth_attempt` también son idempotentes (`-20`); `mark_needs_reauth` acepta cualquier clase con la misma generación (`-21`). El estado sigue `APROBADA`.
- **Enmienda del 2026-09-28, tercera ronda** (revisión de Copilot en el PR #12, sin nueva auditoría por decisión del usuario): el reintento de `rewrap_credential` exige que la versión esperada sea menor que la nueva (`D-M06.1a-M06.2a-22`). El estado sigue `APROBADA`. El hash de contenido cambió respecto del auditado (`e57d8a7fefc5c45575343d9c045c9e096b97b063`).
