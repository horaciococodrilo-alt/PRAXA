# M16.1 — Spec de la microfase

**Estado:** APROBADA

Estados posibles: `BORRADOR` → `APROBADA`. Solo el usuario pasa una spec a `APROBADA`, y solo después de una auditoría APROBABLE.

**Hash de contenido.** Se calcula sin la línea de estado:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M16.1/spec.md | git hash-object --stdin
```

## Fuentes

- Ruta: `docs/FASES/FASE1/meta_first/plan.md` (ficha de M16.1 en la Parte I; sección II.9; III.2, III.3, III.4 y III.9) y `docs/FASES/FASE1/meta_first/spec.md` (secciones 4 a 9, CA-26, CA-28 a CA-34, CA-39, CB-06 y sección 14), **con la Enmienda M16.1 del 2026-10-12** preparada a partir de las decisiones D-M16.1-01 a D-M16.1-11. Hasta que el usuario la apruebe de forma visible, el texto aprobado de la ruta es el anterior (ver el encabezado de los dos documentos).
- Commit base: `d1f056d` al expandir. `main` avanzó después a `609ea29`, que solo toca `src/components/landing/herramientas.tsx`, fuera de esta microfase.
- Microfases previas en las que se apoya: `M05.1.1` (K01), `M05.1.2` a `M05.1.4` (K02 a K04), `M06.1a-M06.2a` (`0012`, `worker_api`), `M06.3a` (cifrado, cliente del rol y repositorio de credenciales) y `M28.2a` (`G-ENTORNO`, 2026-10-11). Todas cerradas en `docs/PROJECT_STATE.md`.
- Prerrequisitos externos de la ficha: P-01, P-02 y P-03. **Declarados cumplidos por el usuario el 2026-10-12** (H-S-12): configuración de system user con `ads_read`, cuenta publicitaria requerida y tarea ANALYZE; URI exacta validada por Meta; app en el portfolio propio del usuario, con control total. Las cuatro `META_*` figuran en Vercel Production, con `META_APP_SECRET` como Secret. No son verificables desde el repositorio y no se copia ningún valor ni identificador.
- IDs cubiertos: solo `M16.1` (la sección II.9 no agrupa microfases).
- Fuentes externas consultadas el 2026-10-12: changelog de Graph API v26.0, Facebook Login for Business, flujo manual de login, guía de límites de la Marketing API y documentación oficial de Runtime Logs de Vercel (ver "Supuestos e hipótesis").

## Objetivo

Implementar la autorización del dueño y el guardado cifrado de un token de system user válido, probado contra Meta simulada (ficha de M16.1, Parte I del plan). Sin autorización real: esa ocurre en `M16.2` (T10).

## Alcance

De la ficha ("Implementación requerida" y "Procedimiento del asistente") y de los pasos 1 a 10 de II.9 (enmendada):

1. Constante `GRAPH_API_VERSION = 'v26.0'` y armado de URLs de Graph y del diálogo en un único lugar (paso 1).
2. Cliente HTTP de Meta con timeout, errores tipados, clasificación por código de Graph según la tabla de CA-39 (incluidas las clases transporte y desconocido) y redacción de tokens, códigos y URLs con parámetros en cualquier error (paso 2; CA-09, CA-26, CA-39).
3. Ruta `iniciar`: construye K01, decide el propósito (`initial` o `reauth`), genera `state` y nonce, emite la cookie de vinculación, crea el intento por `worker_api` y redirige al diálogo con `config_id` y `response_type=code`, sin `scope` (paso 3; CA-28, CA-02b, CA-02c).
4. Ruta `callback`: construye K01, consume el intento en forma atómica pasando el hash del nonce de la cookie, maneja la cancelación del dueño (paso 4; CA-29, CA-33, CA-34).
5. Canje del código en el servidor con `META_APP_SECRET`, sin persistirlo ni registrarlo; redirección inmediata a una URL limpia con `Referrer-Policy: no-referrer` (paso 5; CA-30 corregida).
6. `debug_token`: validez, app emisora igual a `META_APP_ID` y `ads_read`; expiración real o ausente; `/me?fields=id,client_business_id` (paso 6; CA-31, CA-32).
7. Según el propósito: `initial` crea la conexión en `pending_selection` con la credencial cifrada; `reauth` consume el intento y valida la conexión y la generación esperadas, **sin canjear el código ni reemplazar la credencial**, que se completan en `M16.2` (paso 7; CA-29b enmendada, primera oración de CA-35; D-M16.1-03).
8. Pruebas con Meta simulada, unitarias, de componente y `test:app` (paso 8; CA-28 a CA-34).
9. Aviso del resultado del callback en `/app/integraciones` con `?meta=<resultado>` de una lista cerrada, y su prueba de componente (paso 9 enmendado; CA-29, CA-34; D-M16.1-01).
10. Documentación y configuración que la microfase vuelve desactualizadas: `SECURITY.md` (incluidos INV-06 y el límite de los logs del hosting), `ARCHITECTURE.md`, `.env.example`, el comentario de `src/lib/env.ts` (`H-E1-42`) y el inventario de variables de `entorno.md` (paso 10 enmendado; D-M16.1-02, D-M16.1-07).

## Fuera de alcance

- **Cualquier autorización real** contra Meta, con la cuenta del usuario o del dueño (T10, ficha de M16.1 y encabezado de II.9). Ningún dato real entra a la base antes de `G-ACTA-META` (`M03a`).
- Listado de cuentas delegadas (`assigned_ad_accounts`, H-01), pantalla de confirmación de cuenta, moneda y zona, probe y `confirm_connection` (`M16.2`, pasos 1 a 3).
- En el camino `reauth`: canje del código, `debug_token`, verificación de CA-37c de que la cuenta conectada sigue entre las delegadas y la llamada a `replace_credential` desde el callback (`M16.2`, paso 5; D-M16.1-03).
- Purga perezosa y reanudable, `list_pending_purges`, revocación (`oauth/revoke`, H-03), desconexión y `begin_disconnect` desde la aplicación (`M16.2`, pasos 4 y 6). Esto incluye revocar un token rechazado por CA-32 o huérfano: en `M16.1` no hay revocación ni procedimiento de recuperación de los casos A y B de la trampa 9 (`H-E1-114`, antes de la primera autorización real).
- Transiciones por clase de error sobre una conexión (`mark_needs_reauth`) y el registro persistente de clases que no llevan a `needs_reauth` (`H-E1-22`, parte de `M16.2`).
- UI de estado, reconexión y desconexión, y habilitar el botón "Conectar" de `/app/integraciones` (`M16.2`, paso 8; `H-E1-100`).
- Insights, sincronización, `meta_daily_coverage` y migraciones (`M16c`). `M16.1` no crea ni modifica migraciones ni pgTAP.
- Alta del dueño, apertura del registro y P-04 (`M16.2`).
- App Review, Business Verification y Advanced Access (`M16d`, fuera de la ruta).
- Cambiar el tope de 10 minutos del intento, el TTL de 30 minutos de la pendiente o cualquier función de `worker_api`.

## Contexto verificado en el código

| Qué | Dónde (archivo:línea) | Qué implica para esta microfase |
|---|---|---|
| K01 `requireTenantContext()` sin parámetros, `server-only`, devuelve un objeto congelado con `user_id`, `company_id`, `role = 'owner'`, `request_id` | `src/modules/tenant/context.ts:1`, `:21-26`, `:37-66` | Ambas rutas lo construyen adentro; nunca reciben actor ni empresa del navegador. Hoy no tiene consumidores en `src/` (`docs/ARCHITECTURE.md:73`): esta microfase es el primero |
| `requireCompanyMembership()` lanza `NoCompanyError` si el usuario no creó empresa; `requireUserForAction()` lanza `UnauthorizedError` | `src/modules/company/service.ts:85-90`, `:21-26`; `src/modules/identity/session.ts:41-53` | Cada ruta distingue sin sesión, sin empresa y error de contexto |
| `OAUTH_STATE_MIN_BYTES = 32`, `OAUTH_ATTEMPT_MAX_TTL_MS` = 10 min, `oauthStateSchema` (base64url de 43 a 256 caracteres), `BROWSER_BINDING_COOKIE` (`__Host-praxa_oauth_binding`, `HttpOnly`, `Secure`, `SameSite=lax`, `Path=/`), `oauthPurposeSchema`, `OAuthAttemptRejectedError` con mensaje fijo | `src/modules/integrations/contract/oauth-attempt.ts:20`, `:26`, `:34-39`, `:45-51`, `:54`, `:115-120` | Se reutilizan tal cual. El nonce de la cookie y el `state` se validan con `oauthStateSchema` antes de calcular el hash |
| `RETURN_PATH_ALLOWLIST = ['/app/integraciones']` y `returnPathSchema`; clases de error de CA-39; `redactErrorMessage` e `redactedErrorMessageSchema` | `src/modules/integrations/contract/primitives.ts:91-94`, `:101-124`, `:169-193` | El retorno se valida antes de tocar la base (CA-04). La clasificación usa `IntegrationErrorClass`; la redacción usa `redactErrorMessage` |
| `REQUIRED_SCOPE = 'ads_read'`; `tokenTypeSchema` con único valor `system_user` | `src/modules/integrations/contract/credential.ts:26`, `:32` | La traducción de `debug_token` a `token_type` (H-02) le toca a esta microfase (sesión M05.1.2-M05.1.4, nota para M16.1) |
| `clientBusinessIdSchema` (`^[A-Za-z0-9_-]{1,64}$`) | `src/modules/integrations/contract/connection.ts:52` | Valida el `client_business_id` de `/me` antes de guardarlo |
| `create_oauth_attempt(actor, empresa, purpose, state_hash, binding_hash, return_path, expires_at, expected_connection_id)`; rechaza `expires_at` posterior a `now() + 10 min` con el reloj de la base; `reauth` solo sobre `active` o `needs_reauth` (si no, `PX004`); `initial` con conexión viva da `PX003` | `supabase/migrations/0012_integrations.sql:490-498`, `:519-530`, `:552-554`, `:581-590` | Vida del intento con margen (9 min). Con una `pending_selection` vigente no se puede iniciar nada (`H-E1-21`) |
| `consume_oauth_attempt(actor, empresa, state_hash, binding_hash)`: una sola sentencia `update … returning`; cualquier fallo es `PX002` | `0012_integrations.sql:621-663` | El callback pasa el hash del nonce y no lee antes el intento (trampa 1 de II.9) |
| `create_pending_connection` exige `client_business_id` no nulo y fija `pending_expires_at = now() + 30 min`; no lee `oauth_attempts` | `0012_integrations.sql:684-778` (`:713-716`, `:777-778`) | El orden consumir → canjear → crear lo garantiza el servidor (`H-E1-24`) |
| `replace_credential` exige un intento `reauth` consumido hace 10 min o menos y la generación esperada (`PX006`) | `0012_integrations.sql:966-1069` (`:1022-1034`, `:1067-1069`) | Base de `M16.2`; en `M16.1` el camino `reauth` no lo llama (D-M16.1-03) |
| `return_path` en la tabla: `check` de valor exacto; vida máxima del intento en `check` | `0012_integrations.sql:389-392` | Espejo de K02; no se cambia |
| `authenticated` lee `integration_connections` por RLS (`private.is_company_member`) | `0012_integrations.sql:461-465` | La decisión del propósito lee la conexión viva con el JWT del usuario, por el camino A (DEC-04) |
| Cliente de `worker_api`: funciones y casts, traducción `PX001`…`PX008` a `WorkerApiCode`, `failureKind` `transport`/`timeout`/`other`, `getWorkerApi()` lee `PRAXA_INTEGRATIONS_DB_URL` | `src/modules/integrations/db/worker-api.ts:9-13`, `:27-32`, `:63-76`, `:120-142`, `:185-191` | Se reutiliza sin cambios. Las pruebas inyectan un cliente creado con la URL de pruebas |
| Repositorio de credenciales: `preparePendingConnectionWithCredential`, `executePreparedCredentialOperation` (reintento explícito con la misma operación preparada), `createPendingConnectionWithCredential`, `readCredential` | `src/modules/integrations/repository/credentials.ts:27`, `:153-165`, `:183-208`, `:210-215`, `:247-308` | `initial` crea la pendiente por acá. La spec de M06.3a deja a M16.1 decidir cuándo reintentar (`docs/FASES/FASE1/M06.3a/spec.md:280`) |
| `SecretValue` (`reveal()`, `toString`/`toJSON`/`inspect` redactados) | `src/modules/integrations/crypto/seal.ts:37-45` | Envoltorio del token y del secreto de la app en memoria |
| `getCredentialKeyring()` lee el llavero del entorno | `src/modules/integrations/crypto/keyring.ts:90-95` | Las pruebas de aplicación usan el llavero de `.env.local`, como M06.3a |
| `createSupabaseServerClient()` usa la clave publishable y la sesión en cookies | `src/lib/supabase/server.ts:12-36` | Lectura bajo RLS de la conexión viva |
| Las cookies de sesión de `@supabase/ssr` son `SameSite=lax` por defecto | `node_modules/@supabase/ssr/dist/main/utils/constants.js:4-11` | La redirección GET de Meta al callback lleva la sesión; un POST de otro sitio a `iniciar` no |
| El proxy refresca la sesión en todas las rutas salvo estáticos, pero solo redirige al login bajo `/app` | `src/proxy.ts:22`, `:73-78`, `:90-92` | Las rutas bajo `/api/integraciones/meta/` verifican identidad por su cuenta (trampa 3 de II.9) |
| Precedente de Route Handler: `GET` exportado, redirecciones con códigos de error cerrados, `catch` sin detalle | `src/app/auth/callback/route.ts:25-57` | Mismo patrón; un `route.ts` solo exporta los métodos HTTP |
| Precedente de mensaje por código cerrado en `searchParams` | `src/app/(auth)/verify-email/page.tsx:11-12` | Patrón para mostrar el resultado del callback (D-M16.1-01) |
| `/app/integraciones`: "Conectar" deshabilitado; integraciones desde un mock | `src/app/(app)/app/integraciones/page.tsx:9-14`, `:70-73`; `src/modules/app-data/index.ts:87-89` | `M16.1` no habilita el botón ni cambia el mock (`M16.2`, paso 8) |
| `.env.example`: sección del conector con solo tres variables; dice "Trece variables" y "No hay claves de LLM"; no tiene `META_*` | `.env.example:9`, `:82-94`, `:104` | La spec de la ruta exige las `META_*` sin valores (`spec.md` §5); autorizado por D-M16.1-02. La spec de M06.3a las dejó para M16.1 (`M06.3a/spec.md:50`) |
| Comentario de `env.ts` que niega cualquier camino privilegiado | `src/lib/env.ts:9-12` | `H-E1-42`, asignado a M16.1; autorizado por D-M16.1-02 |
| Guarda de credenciales: `PRAXA_INTEGRATIONS_DB_URL` solo en `worker-api.ts`, solo `worker-api.ts` importa `pg`, el llavero solo en `keyring.ts`, `.env.example` sin valores | `tests/unit/no-privileged-credentials.test.ts:84-121` | Los módulos nuevos no leen esas variables ni importan `pg` |
| Recorrido del árbol: patrones `EAA…`, `?code=…` de 20 o más caracteres, `META_APP_SECRET=valor`, etc. | `tests/unit/no-secrets-in-tree.test.ts:11-20` | Los fixtures no pueden tener esas formas (CA-12, CA-26) |
| Proyecto `app` de Vitest: `.env.local` por `setup.ts`, sin paralelismo; la suite del rol falla en vez de saltarse | `vitest.config.mts:50-56`; `tests/app/integrations-worker-api-client.test.ts:25-31` | La suite nueva sigue el patrón que falla (CB-06) |
| Fixtures de aplicación: usuario confirmado, empresa por RPC y limpieza en orden | `tests/app/helpers.ts:120-143`, `:180-220`; `integrations-worker-api-client.test.ts:57-62` | Mismo patrón para las empresas sintéticas |
| Scripts: `verify`, `test:unit`, `test:app`, `db:check:test` | `package.json` (`scripts`) | Comandos de la sección "Verificación" |
| `SECURITY.md` marca previstos el cliente HTTP de Meta y las rutas OAuth | `docs/SECURITY.md:108`, `:111`, `:253-254` | Al construirlos, pasan a vigentes: cambio de documento transversal (D-M16.1-02) |
| `ARCHITECTURE.md` marca previstos las rutas OAuth y el cliente de Meta | `docs/ARCHITECTURE.md:61-63`, `:73`, `:81`, `:188`, `:198-202` | Ídem |

Contradicciones o supuestos del plan que el código obligó a precisar. Las tres se resolvieron con decisiones del usuario del 2026-10-12 y con la Enmienda M16.1 de la ruta, que queda pendiente de aprobación visible:

- II.9 no autorizaba ningún archivo de UI, pero CA-29 y CA-34 exigen una pantalla. Resuelto por D-M16.1-01 (paso 9 enmendado).
- II.9 no autorizaba `SECURITY.md`, `ARCHITECTURE.md`, `.env.example`, `src/lib/env.ts` ni `entorno.md`, aunque la microfase cambia propiedades de los dos primeros, la spec de la ruta exige el tercero, `H-E1-42` pide el cuarto y el quinto quedaría desactualizado. Resuelto por D-M16.1-02 (paso 10 enmendado).
- CA-29b dice que `reauth` reemplaza la credencial, mientras II.9, paso 7, deja `replace_credential` para `M16.2`. Resuelto por D-M16.1-03: la enmienda divide CA-29b entre `M16.1` y `M16.2`.
- CA-30 e INV-06 afirman que el código OAuth no aparece en logs, pero los Runtime Logs de Vercel muestran los parámetros de la petición entrante (H-S-09). Resuelto por D-M16.1-07: la enmienda acota CA-30 a los logs de la aplicación y declara el límite.

## Diseño concreto

Las decisiones no materiales que tomé están marcadas **(decisión)** con su motivo. Las materiales que tomó el usuario se citan como **(D-M16.1-NN)**. No quedan partes del diseño sujetas a preguntas abiertas.

### 1. Archivos y responsabilidades

```
src/modules/integrations/meta/
  api.ts         versión, URLs de Graph y del diálogo, configuración META_* (server-only)
  errors.ts      MetaApiError y clasificación CA-39 (sin server-only: lógica pura)
  client.ts      cliente HTTP con timeout, clasificación y redacción (server-only)
  oauth.ts       URL del diálogo, canje del código y orquestación de iniciar/callback (server-only)
  tokens.ts      debug_token y /me (server-only)
  outcomes.ts    resultados cerrados del flujo y sus mensajes (puro; D-M16.1-01)
src/modules/integrations/repository/
  attempts.ts    create/consume del intento sobre worker_api (server-only)
  connections.ts lectura de la conexión viva bajo RLS (server-only)
src/app/api/integraciones/meta/iniciar/route.ts   POST → handleMetaStart
src/app/api/integraciones/meta/callback/route.ts  GET  → handleMetaCallback
src/app/(app)/app/integraciones/page.tsx          aviso del resultado (D-M16.1-01)
```

**(decisión)** La configuración `META_*` vive en `api.ts`, el "único lugar" del paso 1, para no sumar un archivo. `outcomes.ts`, `attempts.ts` y `connections.ts` son ubicaciones dentro del mismo módulo, permitidas por el preámbulo de la Parte II del plan; el paso 7 nombra "Repositorio de conexiones" sin ruta. Los `route.ts` solo exportan `POST` o `GET` y delegan: Next solo admite exportar métodos y opciones de segmento en un `route.ts`, y las pruebas necesitan llamar a los manejadores con dependencias inyectadas.

### 2. `api.ts`

```ts
import 'server-only';
export const GRAPH_API_VERSION = 'v26.0';          // único literal de versión en src/
export const GRAPH_ORIGIN = 'https://graph.facebook.com';
export const DIALOG_ORIGIN = 'https://www.facebook.com';
export const META_CALLBACK_PATH = '/api/integraciones/meta/callback';
export const GRAPH_URL_FORBIDDEN_PARAMS = ['access_token', 'input_token', 'client_secret', 'code', 'appsecret_proof'] as const;
export function graphUrl(path: string, params?: Record<string, string>): URL; // `${GRAPH_ORIGIN}/${GRAPH_API_VERSION}/${path}`; lanza si params trae un nombre prohibido (D-M16.1-08)
export function dialogUrl(params: Record<string, string>): URL;             // `${DIALOG_ORIGIN}/${GRAPH_API_VERSION}/dialog/oauth`
export type MetaOAuthConfig = Readonly<{ appId: string; appSecret: SecretValue; redirectUri: string; configId: string }>;
export class MetaConfigError extends Error { readonly missing: readonly string[] } // mensaje: "Falta configuración de Meta: <nombres>." o "Configuración de Meta inválida: <nombres>."
export function readMetaOAuthConfig(env?: NodeJS.ProcessEnv): MetaOAuthConfig;   // sin caché, para poder probarla
export function getMetaOAuthConfig(): MetaOAuthConfig;                           // lee process.env una vez por proceso
```

Validación de `readMetaOAuthConfig`:

- `META_APP_ID` y `META_CONFIG_ID`: `^[0-9]{1,32}$`.
- `META_APP_SECRET`: no vacío; se envuelve en `SecretValue` en el momento de leerlo.
- `META_REDIRECT_URI`: URL absoluta, sin consulta, fragmento ni credenciales; ruta exactamente `META_CALLBACK_PATH`; esquema `https`, salvo `http` con host `localhost` o `127.0.0.1` para desarrollo local.
- El error lista solo **nombres** de variables, nunca valores.

**(decisión)** `META_APP_SECRET` aparece solo en `api.ts`; una prueba lo verifica (T-04). No se extiende `tests/unit/no-privileged-credentials.test.ts`, porque no está en los archivos de II.9: la comprobación vive en `tests/unit/meta-oauth.test.ts`.

### 3. `errors.ts`: clasificación CA-39

```ts
export type MetaFailure = { errorClass: IntegrationErrorClass; graphCode: number | null; graphSubcode: number | null };
export class MetaApiError extends Error {
  readonly errorClass: IntegrationErrorClass;
  readonly graphCode: number | null;
  readonly graphSubcode: number | null;
  readonly redactedMessage: string; // plantilla fija; pasa redactedErrorMessageSchema
}
export function classifyGraphError(body: unknown): MetaFailure; // nunca mira el estado HTTP
export function transportError(): MetaApiError;                  // timeout, red o respuesta ilegible
```

Tabla, por código de Graph (`error.code`) y subcódigo (`error.error_subcode`), nunca por estado HTTP:

| Código | Clase |
|---|---|
| 190 sin subcódigo, 190/458, 190/460, 190/463, 190/467 | `authentication` |
| 190/459, 190/464 | `user_action` |
| 190 con cualquier otro subcódigo | `unknown` |
| 10, 200 a 299 | `permission` |
| 4, 17, 341, 613, 80000, 80003, 80004, 80014 | `rate_limit` |
| 1, 2 | `temporary` |
| 3, 100, 3018 | `own_error` |
| Timeout, error de red, cuerpo no JSON | `transport` |
| Cualquier otro código o forma | `unknown` |

`asset_access` no se asigna nunca en esta microfase: requiere la evidencia de H-04.

**(A2x-01) Ningún texto libre del proveedor entra en el error.** `redactErrorMessage` no reconoce tokens, códigos ni secretos escritos como texto suelto (CA-06, comentario de `primitives.ts`), así que no puede garantizar C-07 sobre `error.message`, `error_user_msg`, `error.type` ni `fbtrace_id`. `classifyGraphError` lee del cuerpo solo `error.code` y `error.error_subcode`, y solo los acepta si son números enteros entre 0 y 2 147 483 647; cualquier otro tipo o valor (incluida una cadena) da `null` y clase `unknown`. Del resto del cuerpo no conserva nada.

`message` de `MetaApiError` es fijo por clase, en español y sin datos: `errors.ts` exporta la constante `META_FAILURE_TEXTS: Readonly<Record<IntegrationErrorClass, string>>` con exactamente estos valores, y `message` es `META_FAILURE_TEXTS[errorClass]`.

| Clase | Texto fijo |
|---|---|
| `authentication` | "Meta rechazó la credencial." |
| `user_action` | "Meta pide que la persona vuelva a autorizar." |
| `permission` | "Meta denegó un permiso." |
| `asset_access` | "Meta denegó el acceso al activo." (la clase no se asigna en esta microfase) |
| `rate_limit` | "Meta limitó las llamadas." |
| `temporary` | "Meta tuvo un error temporal." |
| `own_error` | "Meta rechazó la petición de Praxa." |
| `transport` | "Meta no respondió a tiempo." |
| `unknown` | "Error de Meta sin detalle." |

Ningún texto lleva `=` ni `:` pegados a una palabra como `token`, `code` o `state`, porque `redactErrorMessage` los reescribiría (`primitives.ts:131-134`). `redactedMessage` sale de una plantilla fija: `Graph ${code}/${subcode}: ${textoFijoDeLaClase}` (o `Graph ${code}: …` sin subcódigo, o `Graph sin código: …` si el código es `null`), con `code` y `subcode` ya validados como enteros y `textoFijoDeLaClase` igual a `META_FAILURE_TEXTS[errorClass]`. Pasa por `redactErrorMessage` solo como defensa (es idempotente) y se valida con `redactedErrorMessageSchema`; si no valida, queda `"Error de Meta sin detalle."`. El error nunca guarda texto del proveedor, la URL, los parámetros, el cuerpo crudo ni un `cause`.

**(decisión)** La lista de límite agrega a la tabla de la ruta (4, 17, 341, 613, 80004) los códigos 80000, 80003 y 80014, que la guía de límites de la Marketing API lista para Business Use Case (verificado el 2026-10-12). La ruta lo habilita ("y los demás de la guía de límites"). 190 con un subcódigo no listado va a `unknown`, porque CA-39 manda "cualquier otro código" a desconocido y nunca pasa solo a `needs_reauth`.

### 4. `client.ts`

```ts
import 'server-only';
export type MetaFetch = (input: URL, init: RequestInit) => Promise<Response>;
export type MetaHttpClient = {
  getJson(url: URL, options?: { bearer?: SecretValue }): Promise<unknown>;
  postFormJson(url: URL, form: Record<string, string | SecretValue>): Promise<unknown>; // D-M16.1-08
};
export class MetaRequestRejectedError extends Error {} // URL rechazada antes de enviar; mensaje fijo, sin la URL (A2x-02)
export const META_HTTP_TIMEOUT_MS = 10_000;
export function createMetaHttpClient(deps?: { fetch?: MetaFetch; timeoutMs?: number }): MetaHttpClient;
```

- `fetch(url, { method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs), headers })`. Si hay `bearer`, `Authorization: Bearer <token>`; el token no va a la URL.
- **(D-M16.1-08, A2x-02)** Antes de llamar a `fetch`, los dos métodos rechazan, sin hacer la petición, una URL cuyo origen no sea `GRAPH_ORIGIN`, que tenga usuario o contraseña, o cuya consulta tenga algún nombre de `GRAPH_URL_FORBIDDEN_PARAMS`. Además:
  - `postFormJson` rechaza **cualquier** consulta o fragmento, sea cual sea el nombre del parámetro: todo dato va en el cuerpo.
  - `getJson` con `bearer` rechaza una URL que contenga el valor del token que va a enviar, escrito tal cual o con codificación porcentual, en la ruta, la consulta o el fragmento, aunque esté bajo un nombre permitido como `fields`.
  - Un rechazo lanza `MetaRequestRejectedError`, con mensaje fijo ("Petición a Meta rechazada: la URL no es válida.") y sin la URL, la consulta ni el valor. No es un `MetaApiError` y no se clasifica por CA-39: es un defecto de programación, y el callback lo trata como cualquier excepción no prevista (`meta=error`).
  Es una segunda barrera además de la de `graphUrl`: ninguna URL de salida hacia Meta lleva credenciales, códigos ni tokens.
- **(D-M16.1-08)** `postFormJson` envía `POST` con `Content-Type: application/x-www-form-urlencoded` y los campos en el cuerpo (los `SecretValue` se revelan solo al armar el cuerpo), con las mismas opciones de `redirect`, `cache` y `signal`. La URL no lleva consulta: `graphUrl` sin parámetros. El cuerpo nunca llega a un error.
- Rechazo de `fetch` o del `signal` → `transportError()`. `response.text()` que no es JSON → `transportError()` ("respuesta ilegible").
- JSON con `error` objeto → `new MetaApiError(classifyGraphError(body))`. Respuesta no 2xx sin `error` → `unknown`. 2xx → devuelve el JSON parseado.
- No reintenta: en esta microfase solo hay canje (de un solo uso), `debug_token` y `/me`, todos dentro de una petición. Los reintentos acotados de CA-57 son de `M16c`.
- No escribe en consola. Nada de la URL llega a un error.

### 5. `tokens.ts`

```ts
import 'server-only';
export type ValidatedToken = Readonly<{ tokenType: TokenType; issuedForAppId: string; grantedScopes: readonly string[]; expiresAt: string | null }>;
export type TokenRejectionReason = 'invalid' | 'wrong_app' | 'missing_ads_read' | 'unsupported_type' | 'missing_business';
export class TokenRejectedError extends Error { readonly reason: TokenRejectionReason }
export async function inspectToken(token: SecretValue, deps: { http: MetaHttpClient; config: MetaOAuthConfig }): Promise<ValidatedToken>;
export async function fetchClientBusinessId(token: SecretValue, deps: { http: MetaHttpClient }): Promise<string>;
```

- `inspectToken` **(D-M16.1-08)**: `POST graphUrl('debug_token')` con `input_token` y `access_token` (token de app, `${appId}|${appSecret}`) en el cuerpo de formulario, para que ni el token nuevo ni el secreto de la app viajen en la URL de la subpetición. No existe un camino por `GET` para este endpoint. Si Meta rechaza el `POST`, el error se clasifica como cualquier otro (CA-39) y no se crea la conexión. Eso no deshace nada en Meta: el canje ya funcionó, así que Meta ya emitió un token válido que M16.1 no conserva ni revoca (caso B, trampa 9). Exige, sobre `data`:
  - `is_valid === true`, si no `invalid`;
  - `String(app_id) === config.appId`, si no `wrong_app`;
  - `scopes` es un arreglo que incluye `ads_read`, si no `missing_ads_read`;
  - `type === 'SYSTEM_USER'` → `tokenType: 'system_user'`; cualquier otro valor o ausente → `unsupported_type` (H-02, fail-closed por DEC-02 y por el enum de K04).
- `grantedScopes`: los de `scopes` que cumplen el formato de K04, sin repetidos; tiene que validar con `secretCredentialSchema.shape.granted_scopes`.
- `expiresAt`: `expires_at` numérico, finito y mayor que 0 cuya fecha (`new Date(expires_at * 1000)`) sea válida → `toISOString()`; `0`, ausente, no numérico, no finito o con una fecha inválida (fuera del rango de `Date`) → `null`, sin lanzar. No se inventa un plazo (CA-31).
- `fetchClientBusinessId`: `GET graphUrl('me', { fields: 'id,client_business_id' })` con `bearer`: el token va solo en el encabezado `Authorization: Bearer`, nunca en la URL, y la consulta lleva únicamente `fields` (D-M16.1-08). Valida con `clientBusinessIdSchema`; ausente o inválido → `missing_business`. `create_pending_connection` lo exige no nulo (`0012_integrations.sql:713-716`).
- Ningún error ni log de la aplicación contiene la URL ni el cuerpo de una petición a Meta (C-07, T-07). Las URLs de salida no llevan credenciales, códigos ni tokens (D-M16.1-08), así que lo que la plataforma de hosting muestre de las subpeticiones no los expone, cualquiera sea su forma de mostrar la consulta.

### 6. `oauth.ts`

```ts
import 'server-only';
export const OAUTH_START_TTL_MS = 9 * 60 * 1000; // < OAUTH_ATTEMPT_MAX_TTL_MS, margen para el reloj de la base
export function buildAuthorizationUrl(config: MetaOAuthConfig, state: string): URL;
export async function exchangeCodeForToken(code: string, deps: { http: MetaHttpClient; config: MetaOAuthConfig }): Promise<SecretValue>;
export type MetaOAuthDeps = {
  tenant: () => Promise<TenantContext>;                 // por defecto requireTenantContext
  config: () => MetaOAuthConfig;                         // por defecto getMetaOAuthConfig
  http: MetaHttpClient;                                  // por defecto createMetaHttpClient()
  workerApi?: WorkerApi;                                 // por defecto getWorkerApi() (perezoso)
  keyring?: CredentialKeyring;                           // por defecto getCredentialKeyring() (perezoso)
  readLiveConnection: (ctx: TenantContext) => Promise<LiveConnection | null>; // por defecto connections.ts
  now: () => Date;
  randomBytes: (size: number) => Buffer;                 // por defecto node:crypto
  log: (event: MetaOAuthLogEvent) => void;               // por defecto console.info con formato fijo
};
export async function handleMetaStart(request: NextRequest, deps?: Partial<MetaOAuthDeps>): Promise<NextResponse>;
export async function handleMetaCallback(request: NextRequest, deps?: Partial<MetaOAuthDeps>): Promise<NextResponse>;
```

**`buildAuthorizationUrl`.** `dialogUrl` con exactamente: `client_id`, `redirect_uri` (`META_REDIRECT_URI`), `state`, `response_type=code`, `config_id` y `override_default_response_type=true`. Sin `scope`.

**(decisión)** Se agrega `override_default_response_type=true`: la documentación de Facebook Login for Business lo indica para configuraciones de system user junto con `response_type=code` (consultada el 2026-10-12). No contradice la ruta, que exige `config_id`, `response_type=code` y ausencia de `scope`.

**`exchangeCodeForToken`** **(D-M16.1-08)**. `POST graphUrl('oauth/access_token')` con `client_id`, `redirect_uri`, `client_secret` y `code` en el cuerpo de formulario, nunca en la URL. No existe un camino por `GET` para el canje. Si Meta rechaza el `POST`, el error se clasifica según CA-39 y el callback termina sin conexión en PRAXA. Eso no deshace la autorización: cuando el callback llega, la persona ya concedió acceso en Meta (caso A, trampa 9). Exige `access_token` string no vacío y devuelve `new SecretValue(access_token)`; ignora el resto. Si la respuesta 2xx no trae un `access_token` string no vacío, lanza un `MetaApiError` de clase `unknown` (CA-39: "cualquier otro código o forma") sin texto del cuerpo, y el callback lo trata como `meta_no_disponible`, sin llamar a `debug_token`. No reintenta, porque el código es de un solo uso. **(decisión)** Incluye `redirect_uri`: el flujo manual de Meta lo exige idéntico al del diálogo, y enviarlo no tiene costo.

**Cookie de vinculación.** Nombre y atributos de `BROWSER_BINDING_COOKIE`, `maxAge = OAUTH_START_TTL_MS / 1000` (540 s), valor = nonce. El callback siempre la borra (`maxAge: 0`, mismos atributos).

**Hashes.** `state` y nonce: `randomBytes(32).toString('base64url')` (43 caracteres), validados con `oauthStateSchema`. Hash: `createHash('sha256').update(valor, 'utf8').digest('hex')`. La base recibe solo hashes (CA-01).

**Redirecciones.** Todas con estado `303`, `Cache-Control: no-store` y `Referrer-Policy: no-referrer`. Destino del resultado: `new URL('/app/integraciones', request.nextUrl.origin)` con `?meta=<resultado>` (D-M16.1-01). La ruta es el `return_path` del intento consumido, validado con `returnPathSchema`; sin intento, la constante de la allowlist. Nunca se reenvía un parámetro recibido.

**Registro.** `log` escribe una línea con formato fijo: `{ evento: 'meta_oauth', etapa, resultado, clase?, request_id? }`, con `etapa` en `'inicio' | 'configuracion' | 'consumo' | 'canje' | 'inspeccion' | 'negocio' | 'pendiente' | 'reauth'`, `resultado` en `MetaOAuthOutcome | 'ok'` (`'ok'` para una etapa que continúa) y `clase` opcional de tipo `IntegrationErrorClass`. Ningún otro campo. Nunca incluye tokens, código, `state`, nonce, hashes, URLs, identificadores de cuenta o de negocio, ni mensajes de Meta. **(decisión)** Cubre el "se registra la clase" de CA-39 para `unknown` sin persistir nada en la conexión: en el flujo `initial` todavía no existe una conexión a la que asociarlo (ver Hallazgos, `H-E1-22`).

#### 6.1 `handleMetaStart` (POST `/api/integraciones/meta/iniciar`)

1. **(D-M16.1-06)** Solo `POST`. Si el encabezado `Origin` falta o no es `request.nextUrl.origin` → `403` con texto fijo "Solicitud no permitida.", sin construir K01. Motivo: una ruta GET con efectos (crea un intento, pisa la cookie) quedaría expuesta a cualquier enlace o imagen de otro sitio, como el cierre de sesión (`src/app/auth/signout/route.ts:5-9`). Con cookies `SameSite=lax`, un POST de otro sitio llega sin sesión. `GET` responde `405` porque el archivo no lo exporta.
2. `tenant()`: `UnauthorizedError` → `303` a `/login?next=%2Fapp%2Fintegraciones`; `NoCompanyError` → `meta=sin_empresa`; otro error → `meta=error`.
3. `config()`: `MetaConfigError` → `meta=error` y `log({ etapa: 'configuracion', resultado: 'error' })`.
4. `readLiveConnection(ctx)`:
   - `null` → propósito `initial`, `expectedConnectionId = null`;
   - `active` o `needs_reauth` → propósito `reauth`, `expectedConnectionId = conexión.id`;
   - `pending_selection` → `meta=pendiente_vigente`, sin crear intento **(D-M16.1-04)**: se informa que existe una conexión pendiente; la purga y la revocación son de `M16.2`. **Límite de `M16.1`:** `readLiveConnection` no lee `pending_expires_at` y no hay purga, así que una pendiente vencida sin purgar sigue dando `pendiente_vigente` y `create_oauth_attempt` seguiría rechazando con `PX003`. El texto no promete una fecha ni que se pueda iniciar otra.
5. `returnPathSchema.parse('/app/integraciones')` antes de tocar la base (CA-04).
6. Genera `state` y nonce; `expiresAt = now() + OAUTH_START_TTL_MS`.
7. `createOAuthAttempt` (§7). `live_connection_exists` → `meta=conexion_existente` (carrera); otro error → `meta=error`.
8. `303` a `buildAuthorizationUrl(config, state)` con la cookie emitida.

#### 6.2 `handleMetaCallback` (GET `/api/integraciones/meta/callback`)

Toda respuesta borra la cookie y es una redirección limpia (§6). Orden:

1. Lee `state`, `code`, `error` de la consulta y el nonce de la cookie. Nunca los registra.
2. `tenant()`: sin sesión → `303` a `/login?next=%2Fapp%2Fintegraciones`; sin empresa → `meta=sin_empresa`; otro → `meta=error`. El código se descarta y el intento vence solo.
3. **Cancelación (CA-34).** Si `error` está presente: si `state` y nonce validan con `oauthStateSchema`, consume el intento como mejor esfuerzo e ignora el resultado; responde `meta=cancelado` sin llamar a Meta. **(decisión)** La pantalla de cancelación no depende de que el `state` sea válido (H-S-07): mostrarla no cambia ningún estado, y consumir cuando se puede evita reutilizar el intento.
4. Si `state` o nonce faltan o no validan, o falta `code` → `meta=rechazado`, sin tocar la base ni Meta (CA-29: `state` ausente, cookie ausente).
5. `consumeOAuthAttempt(ctx, { stateHash, bindingHash })` en una sola llamada (§7). `OAuthAttemptRejectedError` (de `PX002` o `PX001`) → `meta=rechazado`. Desconocido, vencido, consumido, de otro actor, de otra empresa o con otro nonce dan el mismo resultado y el mismo mensaje, sin decir cuál falló.
6. Propósito `reauth` → §6.3.
7. Propósito `initial`:
   1. `exchangeCodeForToken(code)`. `MetaApiError` de clase `own_error`, `authentication`, `user_action` o `permission` → `meta=rechazado`; el resto (`transport`, `temporary`, `rate_limit`, `unknown`) → `meta=meta_no_disponible`. Se registra la clase.
   2. `inspectToken(token)`. `missing_ads_read` → `meta=permiso_faltante`; otro `TokenRejectedError` → `meta=token_no_valido`; `MetaApiError` → como en 7.1. No se crea conexión (CA-32).
   3. `fetchClientBusinessId(token)`. Mismos mapeos.
   4. `preparePendingConnectionWithCredential(ctx, { token: token.reveal(), …validado, clientBusinessId })` y `executePreparedCredentialOperation`. **(decisión)** Si falla con `WorkerApiError` `unavailable` y `failureKind` `transport` o `timeout`, se reintenta **una vez** con la **misma** operación preparada: la función es idempotente para la misma llamada (`0012_integrations.sql:728-758`). `live_connection_exists` → `meta=conexion_existente`; otro error → `meta=error`.
   5. `meta=pendiente`.
8. Cualquier excepción no prevista → `meta=error`, sin el mensaje.

El orden 5 → 7.1 → 7.4 es la garantía de `H-E1-24`: no hay ningún camino que llegue a `create_pending_connection` sin haber consumido antes un intento `initial` de ese actor y esa empresa en la misma petición (D-M16.1-05: garantía en el servidor, sin migración nueva). Una prueba unitaria fija el orden de llamadas (T-16).

#### 6.3 Camino `reauth` (D-M16.1-03)

1. Después de consumir el intento `reauth`, `readLiveConnection(ctx)` bajo RLS.
2. Si no hay conexión viva, su `id` no es `expectedConnectionId` o su `credential_generation` no es `expectedGeneration` → `meta=credencial_cambio` ("generación vieja"; sección 14 de la spec de la ruta).
3. Si coincide → `meta=reautorizacion_no_disponible`. **No canjea el código**: así no queda un token válido en Meta sin guardar ni revocar. `M16.2` reemplaza este paso por canje, `debug_token`, la verificación de CA-37c y `replace_credential`, que hace atómico el chequeo de generación.

En producción este camino no se alcanza antes de `M16.2`: un intento `reauth` exige una conexión `active` o `needs_reauth` (`0012_integrations.sql:552-554`), y eso requiere `confirm_connection`, que no tiene llamador hasta `M16.2`.

### 7. Repositorios

`repository/attempts.ts` (`server-only`):

```ts
export type CreatedAttempt = { attemptId: string; purpose: OAuthPurpose; expiresAt: string };
export type ConsumedAttempt = { attemptId: string; purpose: OAuthPurpose; expectedConnectionId: string | null; expectedGeneration: number | null; returnPath: ReturnPath };
export class LiveConnectionExistsError extends Error {} // mensaje fijo
export async function createOAuthAttempt(ctx: TenantContext, input: { purpose: OAuthPurpose; stateHash: string; bindingHash: string; returnPath: ReturnPath; expiresAt: Date; expectedConnectionId: string | null }, deps?: { workerApi?: WorkerApi }): Promise<CreatedAttempt>;
export async function consumeOAuthAttempt(ctx: TenantContext, input: { stateHash: string; bindingHash: string }, deps?: { workerApi?: WorkerApi }): Promise<ConsumedAttempt>;
```

- Validan K01 con `tenantContextSchema`, los hashes con `sha256HexSchema`, el propósito con `oauthPurposeSchema` y el retorno con `returnPathSchema` antes de llamar a la base.
- Respuesta: exactamente una fila con las columnas de la función (`0012_integrations.sql:500-507` y `:627-633`), validada. La coherencia propósito/conexión esperada se valida como en K02.
- Errores: `attempt_rejected` y `not_authorized` → `OAuthAttemptRejectedError` (contrato K02); `live_connection_exists` → `LiveConnectionExistsError`; el resto se propaga como `WorkerApiError`.

`repository/connections.ts` (`server-only`):

```ts
export type LiveConnection = Readonly<{ id: string; status: 'pending_selection' | 'active' | 'needs_reauth'; credentialGeneration: number }>;
export async function readLiveConnection(ctx: TenantContext, deps?: { supabase?: SupabaseClient }): Promise<LiveConnection | null>;
```

- `from('integration_connections').select('id, status, credential_generation, company_id').eq('company_id', ctx.company_id).in('status', ['pending_selection','active','needs_reauth']).maybeSingle()` con el cliente del usuario (camino A). El filtro explícito por `company_id` (K01, resuelto en el servidor) evita depender de que una cuenta tenga una sola empresa; además exige `company_id === ctx.company_id`; si no coincide o la fila no valida → error. Un error de PostgREST → error fijo, sin su mensaje.
- **(decisión)** Se lee por RLS y no por `worker_api`, porque `worker_api` no tiene una función de lectura de estado y DEC-04 reserva `authenticated` para leer. La base sigue siendo la autoridad: `create_oauth_attempt` vuelve a verificar el propósito.

### 8. `outcomes.ts` y aviso en `/app/integraciones` (D-M16.1-01)

```ts
export const META_OAUTH_OUTCOMES = ['pendiente','cancelado','rechazado','permiso_faltante','token_no_valido','conexion_existente','pendiente_vigente','reautorizacion_no_disponible','credencial_cambio','sin_empresa','meta_no_disponible','error'] as const;
export type MetaOAuthOutcome = (typeof META_OAUTH_OUTCOMES)[number];
export const META_OAUTH_MESSAGES: Readonly<Record<MetaOAuthOutcome, { tone: 'ok' | 'info' | 'error'; text: string }>>;
export function parseMetaOAuthOutcome(value: string | string[] | undefined): MetaOAuthOutcome | null; // ante la duda, null
```

Textos (español rioplatense, sin datos):

| Resultado | Texto |
|---|---|
| `pendiente` | "Autorizaste a Praxa en Meta. Falta elegir la cuenta publicitaria." |
| `cancelado` | "Cancelaste la conexión con Meta. No se guardó nada. Podés intentarlo de nuevo cuando quieras." |
| `rechazado` | "La autorización no es válida o ya se usó. Volvé a iniciar la conexión." (mismo texto que `OAuthAttemptRejectedError`) |
| `permiso_faltante` | "Meta no concedió el permiso de lectura de anuncios (ads_read). No se creó la conexión." |
| `token_no_valido` | "Meta devolvió una autorización que Praxa no puede usar. No se creó la conexión." |
| `conexion_existente` | "Tu empresa ya tiene una conexión con Meta." |
| `pendiente_vigente` | "Tenés una conexión con Meta pendiente de confirmar." (D-M16.1-04) |
| `reautorizacion_no_disponible` | "La reconexión con Meta todavía no está disponible." (D-M16.1-03) |
| `credencial_cambio` | "La conexión cambió mientras autorizabas. Volvé a iniciar la reconexión." |
| `sin_empresa` | "Primero completá los datos de tu empresa en Configuración." |
| `meta_no_disponible` | "Meta no respondió como esperábamos. Probá de nuevo en unos minutos." |
| `error` | "No pudimos completar la conexión. Probá de nuevo más tarde." |

`src/app/(app)/app/integraciones/page.tsx` recibe `props` **sin desestructurar en la firma**, llama primero a `requireAppSession('/app/integraciones')` y solo después lee `await props.searchParams`; con `parseMetaOAuthOutcome(searchParams.meta)` y, si no es `null`, muestra el texto en un aviso (`role="status"`, o `role="alert"` para `error`) sobre las tarjetas. Un valor desconocido no muestra nada. El aviso no cambia el mock de integraciones ni habilita "Conectar" (D-M16.1-06). La página nunca muestra otro parámetro de la URL ni texto que no venga de `META_OAUTH_MESSAGES`. Así `tests/component/app-paginas-sesion.test.tsx`, que llama a cada página sin argumentos y exige que rechace por falta de sesión antes de leer nada, sigue en verde sin cambios (T-37). Prueba en un archivo nuevo, `tests/component/integraciones-meta-aviso.test.tsx`, con los mismos mocks de sesión que ese archivo (T-23).

### 9. Rutas

```ts
// src/app/api/integraciones/meta/iniciar/route.ts
import { handleMetaStart } from '@/modules/integrations/meta/oauth';
export async function POST(request: NextRequest) { return handleMetaStart(request); }

// src/app/api/integraciones/meta/callback/route.ts
import { handleMetaCallback } from '@/modules/integrations/meta/oauth';
export async function GET(request: NextRequest) { return handleMetaCallback(request); }
```

Sin `export const runtime`: el valor por defecto es Node (necesario para `pg` y `node:crypto`). Los `GET` de Route Handlers son dinámicos por defecto en Next 16 (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md:669`).

### 10. Meta simulada en las pruebas

Un `MetaFetch` falso responde por ruta (`/v26.0/oauth/access_token`, `/v26.0/debug_token`, `/v26.0/me`), registra cada llamada sin guardar el secreto y permite inyectar respuestas de error, cuerpos ilegibles, demoras y rechazos de red. Valores sintéticos: código `codigo-sint` (menos de 20 caracteres), token `token-sint-meta` (15 caracteres), secreto de la app `secreto-sint` (12), app `1234567`, negocio `negocio_sintetico`. Todos tienen menos de 20 caracteres: así ni siquiera escritos literalmente después de `?access_token=` o `code=` coinciden con el patrón `oauth_param` de `no-secrets-in-tree` (`{20,}`). Ninguno tiene forma de token real (CA-12). Una prueba nueva no puede subirlos a 20 caracteres o más sin romper esa prueba del árbol, y las URLs de los fixtures se arman interpolando la constante.

### 11. Documentación y configuración (D-M16.1-02, D-M16.1-07)

Se editan al implementar, después de que las pruebas pasen. No copian TTL, nombres de funciones, conteos de pruebas ni estado de microfases (contrato documental de `AGENTS.md`).

- **`docs/SECURITY.md`.**
  - §3, INV-06: deja de ser absoluta respecto de los canales que la aplicación no controla. Texto propuesto: "Los tokens y las claves nunca llegan al navegador. Ni tokens, ni códigos OAuth, ni claves, ni URLs que los contengan aparecen en los logs, errores, snapshots, fixtures, documentación o evidencia que produce PRAXA (CA-26, CB-02). La única excepción es el código de autorización y el `state`, que el proveedor entrega al callback en la consulta de la redirección; la plataforma de hosting puede registrar esa petición entrante, límite declarado en la sección 12. Ningún token, secreto de la app ni código aparece en una URL de salida hacia un proveedor".
  - §4, filas "Replay o abuso del flujo OAuth" y "Logs o errores que filtren secretos o identificadores": rutas, canje, inspección y cliente HTTP de Meta pasan de previstos a vigentes, probados con Meta simulada. La fila de OAuth conserva el límite de `H-E1-24` (D-M16.1-05).
  - §7, punto del código de autorización: el texto actual dice que en el servidor "no se persiste ni se registra" y que el callback termina con una redirección limpia. Texto propuesto: "El código de autorización pasa por el navegador (es parte del flujo). PRAXA no lo persiste ni lo registra, y lo envía a Meta en el cuerpo de un `POST`, nunca en una URL. La plataforma de hosting puede registrar el `code` y el `state` de la petición entrante al callback (límite declarado en la sección 12). El callback termina con una redirección a una URL limpia, con `Referrer-Policy: no-referrer`". El punto que dice que el token no llega a ninguna URL se conserva y se extiende a las URLs de salida.
  - §7, "Vigente/Previsto": pasan a vigentes las rutas `iniciar` y `callback`, el canje y la inspección; el reemplazo de credencial por reautorización sigue previsto (`M16.2`, D-M16.1-03).
  - §12: límite declarado de los logs del hosting. Los Runtime Logs de Vercel muestran los parámetros de búsqueda de cada petición ("Search Params"), así que el código y el `state` del callback quedan visibles para quien tenga acceso al proyecto de Vercel durante la retención del plan, y en un Log Drain si se configura uno. Mitigación: el código es de un solo uso y no sirve sin `META_APP_SECRET`; el `state` es de un solo uso y la base solo guarda su hash. Las subpeticiones a Meta no entran en este límite: por D-M16.1-08 sus URLs no llevan credenciales, códigos ni tokens, y eso se documenta como control vigente en la fila "Logs o errores que filtren secretos o identificadores" de §4.
- **`docs/ARCHITECTURE.md`.** Estructura (`src/modules/integrations/meta/`, rutas bajo `src/app/api/integraciones/meta/`), tabla de módulos (`tenant` con su primer consumidor; `integrations` con OAuth existente y ciclo de vida previsto), camino B y sección C: rutas OAuth y cliente de Meta pasan a existir.
- **`.env.example`.** Las cuatro `META_*` sin valores, en la sección 4 del conector, con comentarios que nombren solo su propósito; se corrige el conteo de variables del encabezado. No se agrega ninguna `NEXT_PUBLIC_META_*`.
- **`src/lib/env.ts`.** El comentario inicial deja de negar todo camino privilegiado: este archivo solo tiene configuración pública, y el conector usa un rol acotado confinado a un módulo `server-only` (`H-E1-42`). Solo cambia el comentario.
- **`docs/FASES/FASE1/meta_first/entorno.md`.** La fila de Meta del inventario deja de decir "diferida": pasa a "configurada por el usuario" (declaración del 2026-10-12), con `META_APP_SECRET` marcada como Secret, sin valores. Se agrega la misma limitación de verificación por presencia que ya tiene el inventario.

## Archivos previstos

| Archivo | Nuevo o modificado | Para qué | Autorizado por |
|---|---|---|---|
| `src/modules/integrations/meta/api.ts` | Nuevo | Versión, URLs y configuración `META_*` | II.9 paso 1 (y pasos 5-6 para la configuración) |
| `src/modules/integrations/meta/errors.ts` | Nuevo | `MetaApiError` y clasificación CA-39 | II.9 paso 2 |
| `src/modules/integrations/meta/client.ts` | Nuevo | Cliente HTTP con timeout y redacción | II.9 paso 2 |
| `src/modules/integrations/meta/oauth.ts` | Nuevo | Diálogo, canje y orquestación de iniciar/callback | II.9 pasos 3, 4, 5 y 7 (orquestación dentro del módulo, preámbulo de la Parte II del plan) |
| `src/modules/integrations/meta/tokens.ts` | Nuevo | `debug_token` y `/me` | II.9 paso 6 |
| `src/modules/integrations/meta/outcomes.ts` | Nuevo | Resultados cerrados y mensajes | II.9 pasos 4, 5 y 9 enmendado (CA-29, CA-34; D-M16.1-01), ubicación dentro del módulo |
| `src/modules/integrations/repository/attempts.ts` | Nuevo | `create_oauth_attempt` y `consume_oauth_attempt` | II.9 pasos 3 y 4 ("crea el intento por `worker_api`"), ruta sugerida |
| `src/modules/integrations/repository/connections.ts` | Nuevo | Lectura de la conexión viva bajo RLS | II.9 paso 7 ("Repositorio de conexiones") |
| `src/app/api/integraciones/meta/iniciar/route.ts` | Nuevo | `POST` de inicio | II.9 paso 3 |
| `src/app/api/integraciones/meta/callback/route.ts` | Nuevo | `GET` del callback | II.9 paso 4 |
| `tests/unit/meta-oauth.test.ts` | Nuevo | Pruebas unitarias con Meta simulada | II.9 paso 8 |
| `tests/app/meta-oauth.test.ts` | Nuevo | Pruebas contra el proyecto desechable | II.9 paso 8 |
| `src/app/(app)/app/integraciones/page.tsx` | Modificado | Aviso del resultado (CA-29, CA-34) | II.9 paso 9 de la Enmienda M16.1 (D-M16.1-01) |
| `tests/component/integraciones-meta-aviso.test.tsx` | Nuevo | Prueba de componente del aviso | II.9 paso 9 de la Enmienda M16.1 (D-M16.1-01) |
| `docs/SECURITY.md` | Modificado | §4, filas "Replay o abuso del flujo OAuth" y "Logs o errores que filtren secretos": rutas, canje, inspección y cliente HTTP de Meta pasan a vigentes; §7, "Vigente/Previsto"; §3, INV-06; §12, límite de los logs del hosting (Diseño §11) | II.9 paso 10 de la Enmienda M16.1 (D-M16.1-02, D-M16.1-07) |
| `docs/ARCHITECTURE.md` | Modificado | Estructura (`integrations/meta/`, rutas `api/`), tabla de módulos (`tenant` con consumidores, `integrations` parcial), camino B y sección C: rutas OAuth y cliente de Meta pasan a existir | II.9 paso 10 de la Enmienda M16.1 (D-M16.1-02) |
| `.env.example` | Modificado | Las cuatro `META_*` sin valores; conteo de variables | II.9 paso 10 de la Enmienda M16.1 (D-M16.1-02); exigido por la spec de la ruta, §5 |
| `src/lib/env.ts` | Modificado | Comentario de `H-E1-42` | II.9 paso 10 de la Enmienda M16.1 (D-M16.1-02) |
| `docs/FASES/FASE1/meta_first/entorno.md` | Modificado | Fila de Meta del inventario: de "diferida" a "configurada por el usuario", sin valores | II.9 paso 10 de la Enmienda M16.1 (D-M16.1-02) |
| `docs/HALLAZGOS.md` | Modificado | Estado de `H-E1-13`, `H-E1-21`, `H-E1-22`, `H-E1-23`, `H-E1-24`, `H-E1-42`, `H-E1-114` y hallazgos nuevos | Precondición 8 de la Parte II |
| `docs/PROJECT_STATE.md` | Modificado | Cierre de M16.1 y `G-OAUTH`, cuando el usuario lo apruebe | Precondición 8 |
| `docs/FASES/FASE1/meta_first/sesiones/M16.1.md` | Nuevo | Evidencia, incluida la declaración del usuario sobre P-01 a P-03 y las variables | Precondición 8 |
| `docs/FASES/FASE1/M16.1/spec.md`, `plan.md`, `revisiones/*.md` | Nuevo | Pipeline de la microfase | Precondición 9 |
| `tests/unit/__qa__/*` | Temporal | Pruebas de `qa-review`, que se borran | Precondición 9 |

La Enmienda M16.1 de la ruta (`docs/FASES/FASE1/meta_first/plan.md` y `spec.md`) se preparó al incorporar las decisiones, antes de esta implementación, y no forma parte de los archivos que la microfase modifica.

No se modifican: `supabase/migrations/*`, `supabase/tests/*`, `src/modules/integrations/contract/*`, `src/modules/integrations/db/worker-api.ts`, `src/modules/integrations/repository/credentials.ts`, `src/modules/integrations/crypto/*`, `src/proxy.ts`, `tests/unit/no-privileged-credentials.test.ts`, `tests/unit/no-secrets-in-tree.test.ts` ni `package.json`.

## Criterios de aceptación

### Heredados de la ruta

| ID de la ruta | Qué exige (resumen fiel) |
|---|---|
| CA-28 | El inicio crea un intento K02 con su propósito y redirige al diálogo con `config_id` y `response_type=code`, sin `scope`. Una conexión inicial solo se inicia si la empresa no tiene una conexión viva; si la tiene, el único propósito admitido es reautorizarla |
| CA-29 | El callback rechaza el intento si el `state` falta, es desconocido, venció, ya fue consumido o es de otro actor o de otra empresa, y si el hash del nonce de la cookie no coincide. Todo en la misma sentencia atómica que consume (CA-03); no alcanza con que exista la cookie. El error es comprensible y sin detalles internos |
| CA-29b (enmendada) | El callback sigue el propósito: `initial` crea la conexión pendiente (CA-35). Para `reauth`, en `M16.1` consume el intento y valida la conexión y la generación esperadas, sin canjear el código ni reemplazar la credencial; el reemplazo (CA-37c) es de `M16.2` |
| CA-30 (corregida) | El token existe solo en el servidor (nunca en navegador, HTML, cookie ni URL). El código se canjea en el servidor con `META_APP_SECRET`, una sola vez, y no se persiste ni aparece en logs, errores o snapshots. El callback termina con una redirección inmediata a una URL limpia, sin `code` ni `state`, con `Referrer-Policy: no-referrer`. Enmienda: "logs" son los que produce PRAXA; los logs de la plataforma de hosting registran la consulta de la petición entrante, límite declarado en `SECURITY.md` (D-M16.1-07) |
| CA-31 | El token se inspecciona con `debug_token`: válido, emitido para esta app y con `ads_read`. Se guarda la expiración real; si Meta no la informa, se guarda ausente. La revocación se contempla aunque no haya vencimiento |
| CA-32 | Si falta `ads_read` o la app emisora no coincide, no se crea una conexión que aparente estar sana |
| CA-33 | Un callback repetido con el mismo código no crea una segunda conexión |
| CA-34 | Si el dueño cancela en Meta, llega a una pantalla que lo explica |
| CA-39 (parte del cliente) | Clasificación por código de Graph, no por estado HTTP, según la tabla; transporte (timeout, red, ilegible) y desconocido (cualquier otro), que deja la conexión como estaba y registra la clase; nunca pasa solo a `needs_reauth` |
| CA-09 | Un error se expresa como clase más mensaje redactado; nunca incluye tokens, códigos ni URLs con parámetros |
| CA-26 (parte HTTP, enmendada) | Ni claves, ni tokens, ni códigos OAuth, ni secretos, ni URLs que los contengan aparecen en los logs, errores, snapshots o fixtures que produce PRAXA; una prueba verifica la redacción de errores del cliente HTTP. El hosting puede registrar el `code` y el `state` de la petición entrante al callback (límite declarado). Ningún token, secreto de la app ni código aparece en una URL de salida (D-M16.1-08, D-M16.1-10) |
| CA-02b | El intento queda vinculado al actor, a su empresa y al navegador, este último por el hash de un nonce en una cookie `HttpOnly`, `Secure`, `SameSite=Lax` |
| CA-02c | El intento declara su propósito; `reauth` guarda la conexión y la generación esperadas |
| CA-04 | La URI de retorno está en una allowlist y se valida antes de tocar la base |
| CA-35 (primera oración, paso 7) | Después de un callback `initial`, la conexión queda en `pending_selection` con la credencial cifrada, `pending_expires_at` a 30 minutos y moneda, zona y cuenta vacías. El listado de cuentas es de `M16.2` |
| CB-01 | `verify` y las suites del corte pasan |
| CB-02 | Ningún diff contiene secretos, tokens, montos reales ni identificadores completos de cuentas |
| CB-03 | Ninguna migración existente se modifica |
| CB-04 | Ninguna prueba se ejecuta contra producción |
| CB-05 | La evidencia registra comandos y resultados reales, redactados |
| CB-06 (precisada, `H-E1-23`) | Un gate no se aprueba si una prueba requerida se omitió por falta de configuración. Requerida es toda prueba de las suites que la microfase exige y todo caso que su spec lista; las pruebas opt-in ajenas pueden figurar como omitidas con su archivo y motivo en la evidencia (D-M16.1-09) |

### Operativos de esta microfase

| ID | Criterio verificable | Traza a (CA, DEC o trampa de la ruta) |
|---|---|---|
| M16.1-C-01 | El literal `v26.0` aparece en un solo archivo de `src/` (`meta/api.ts`), y todas las URLs de Graph y del diálogo se arman con `graphUrl` o `dialogUrl` | II.9 paso 1; spec §5 |
| M16.1-C-02 | La URL del diálogo tiene exactamente `client_id`, `redirect_uri`, `state`, `response_type=code`, `config_id` y `override_default_response_type=true`, y ningún `scope` | CA-28; trampa 4 de II.9 |
| M16.1-C-03 | `readMetaOAuthConfig` falla con un error que nombra las variables y no contiene valores si falta o es inválida alguna `META_*`; rechaza un `META_REDIRECT_URI` con consulta, fragmento, otra ruta o `http` fuera de `localhost` | Spec §5; P-02 |
| M16.1-C-04 | `META_APP_SECRET` aparece solo en `meta/api.ts`; ningún archivo de `src/` usa `NEXT_PUBLIC_META`; `api.ts`, `client.ts`, `oauth.ts`, `tokens.ts`, `attempts.ts` y `connections.ts` empiezan con `import 'server-only';` | CA-30; INV-04/INV-06 |
| M16.1-C-05 | `classifyGraphError` cumple la tabla del Diseño §3 caso por caso, ignora el estado HTTP y nunca devuelve `asset_access` | CA-39; trampa 2 de II.10 |
| M16.1-C-06 | El cliente HTTP convierte rechazo de red, timeout y cuerpo no JSON en `transport`, y una respuesta no 2xx sin objeto `error` en `unknown`; usa `redirect: 'error'` y `cache: 'no-store'` | CA-39 |
| M16.1-C-07 | Ningún `MetaApiError` contiene en `message`, `redactedMessage`, `String()`, `JSON.stringify()` ni en propiedades propias el token, el secreto de la app, el código, una URL con consulta ni un `act_` completo, **escritos como URL, como par `clave=valor` o como texto suelto**; no tiene `cause`. `message` y `redactedMessage` salen de plantillas fijas por clase con solo el código y el subcódigo enteros validados (A2x-01) | CA-09; CA-26 |
| M16.1-C-08 | `iniciar` sin conexión viva crea un intento `initial`; con una `active` o `needs_reauth`, un intento `reauth` con esa conexión; nunca un `initial` con una conexión viva | CA-28; CA-02c |
| M16.1-C-09 | `iniciar` emite la cookie `__Host-praxa_oauth_binding` con `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sin `Domain` y `Max-Age=540`; el valor de la cookie y el `state` son distintos, de 43 caracteres base64url, y a la base llegan solo sus SHA-256 en hex | CA-01; CA-02b |
| M16.1-C-10 | `iniciar` valida `return_path` con `returnPathSchema` antes de llamar a la base y fija `expires_at` en 9 minutos o menos | CA-04; CA-02; riesgo de relojes de M06.1a-M06.2a |
| M16.1-C-11 | `iniciar` solo acepta `POST` con `Origin` igual al de la petición; sin sesión redirige al login con `next=/app/integraciones`; sin empresa o sin configuración no crea intento | Trampa 3 de II.9; INV-01 |
| M16.1-C-12 | Toda respuesta del callback es `303` a `/app/integraciones` (más, como mucho, `meta=<resultado>`) o, sin sesión, a `/login?next=%2Fapp%2Fintegraciones` y nada más, sin `code`, `state`, `error` ni ningún otro parámetro recibido, con `Referrer-Policy: no-referrer` y `Cache-Control: no-store`, y borra la cookie de vinculación | CA-30 |
| M16.1-C-13 | Con `state` o cookie ausentes o mal formados el callback no llama a `worker_api` ni a Meta (K01 ya leyó la membresía por RLS); con `state` desconocido, vencido, consumido, de otro actor, de otra empresa o con otro nonce, la única llamada a `worker_api` es `consume_oauth_attempt` y no se llama a Meta. Todos terminan en `rechazado` con el mismo texto | CA-29; CA-03; trampa 1 de II.9 |
| M16.1-C-14 | Con `error` en la consulta el callback responde `cancelado`, no llama a Meta y, si `state` y nonce tienen forma válida, consume el intento | CA-34 |
| M16.1-C-15 | En el camino `initial` el orden de llamadas es `consume_oauth_attempt` → canje → `debug_token` → `/me` → `create_pending_connection`, y no existe camino a `create_pending_connection` sin un consumo `initial` exitoso en la misma petición | `H-E1-24`; CA-29b |
| M16.1-C-16 | El canje se hace una sola vez por callback y con `client_secret` solo hacia `graph.facebook.com`; el código no se guarda ni se registra | CA-30; CA-33 |
| M16.1-C-17 | Un `debug_token` con `is_valid` falso, otra app, sin `ads_read`, de tipo distinto de `SYSTEM_USER`, o un `/me` sin `client_business_id` válido no llaman a `create_pending_connection` | CA-31; CA-32; DEC-02 |
| M16.1-C-18 | La credencial guardada lleva `token_type = system_user`, `issued_for_app_id = META_APP_ID`, permisos que incluyen `ads_read` y `expires_at` igual al real informado o `null` si es 0 o ausente | CA-31; CA-11c |
| M16.1-C-19 | Después de un callback `initial` exitoso, la conexión de la empresa está en `pending_selection`, con `external_account_id`, `currency` y `timezone` nulos, `pending_expires_at` a 30 minutos (±2 min de tolerancia) y una credencial que descifra al token simulado y cuyo texto cifrado no es el token | CA-29b; CA-35; CA-10 |
| M16.1-C-20 | Dos callbacks con el mismo `state`, cookie y código producen una sola conexión y un solo canje | CA-33 |
| M16.1-C-21 | En el camino `reauth`, después de consumir el intento: sin conexión viva, con otra conexión o con otra generación → `credencial_cambio`; con la conexión y la generación esperadas → `reautorizacion_no_disponible`. En ningún caso se canjea el código, se llama a Meta ni se llama a `replace_credential` | CA-29b enmendada; spec §14; D-M16.1-03 |
| M16.1-C-22 | Con una `pending_selection` viva, `iniciar` responde `pendiente_vigente`, no crea intento, no purga ni revoca nada | `H-E1-21`; CA-28; D-M16.1-04 |
| M16.1-C-23 | Ninguna línea de registro de las rutas contiene el token, el código, el `state`, el nonce, sus hashes, el secreto, una URL de Meta ni el `client_business_id`; solo etapa, resultado, clase y `request_id` | CA-26; CA-63 por analogía; INV-06 |
| M16.1-C-24 | Un fallo de transporte o timeout de `create_pending_connection` se reintenta una sola vez con la misma operación preparada | Toda escritura idempotente (`AGENTS.md`); `M06.3a/spec.md:280` |
| M16.1-C-25 | El resultado se muestra en `/app/integraciones` con el texto cerrado de §8; un valor desconocido de `meta` no muestra nada; "Conectar" sigue deshabilitado | CA-29; CA-34; D-M16.1-01; D-M16.1-06 |
| M16.1-C-26 | La suite `tests/app/meta-oauth.test.ts` falla, no se salta, si falta o es inválida la configuración del proyecto desechable o del rol, y nunca usa `PRAXA_INTEGRATIONS_DB_URL` | CB-04; CB-06; spec §5 |
| M16.1-C-27 | Los fixtures nuevos no disparan `no-secrets-in-tree` ni contienen tokens con forma real | CA-12; CA-26 |
| M16.1-C-28 | `npm run verify` pasa completo y `npm run test:app` termina correctamente. Ninguna prueba de `meta-oauth.test.ts` ni suite positiva de `tests/app/` se omite por falta de configuración; las omitidas ajenas a M16.1 figuran en la evidencia con su archivo y su motivo | III.3; CB-01; CB-06 precisada (D-M16.1-09) |
| M16.1-C-29 | Los documentos y la configuración cambian solo como dice el Diseño §11: INV-06 y CA-30 coherentes con el límite de los logs del hosting, controles OAuth vigentes, cuatro `META_*` sin valores en `.env.example`, comentario de `env.ts` corregido y la fila de Meta de `entorno.md` sin "diferida" | D-M16.1-02; D-M16.1-07; `H-E1-42`; contrato documental de `AGENTS.md` |
| M16.1-C-30 | Ninguna `META_*` se lee en un archivo sin `server-only`, y la evidencia de cierre no registra ninguna autorización real ni dato real (T10, `G-ACTA-META`) | D-M16.1-06; CB-04 |
| M16.1-C-31 | Ninguna URL de salida hacia Meta contiene `access_token`, `input_token`, `client_secret`, `code` ni `appsecret_proof`, ni el valor de un token, del secreto de la app o del código. El canje y `debug_token` son siempre `POST` con esos datos en el cuerpo de formulario y sin consulta, y no existe un camino por `GET` para ninguno de los dos. `/me` lleva el token solo en `Authorization: Bearer` y en la consulta únicamente `fields`. `graphUrl` y el cliente HTTP rechazan, sin hacer la petición, una URL con un parámetro prohibido; `postFormJson` rechaza cualquier consulta, y `getJson` rechaza una URL que contenga el token bearer que va a enviar, aunque esté bajo un nombre permitido (A2x-02) | INV-06; CA-30; D-M16.1-08 |

## Casos de prueba

Comandos: `npm run test:unit` (unitarias), `npm run test:app` (proyecto desechable), `npm run verify`. Todas las pruebas de `tests/unit/meta-oauth.test.ts`, `tests/component/integraciones-meta-aviso.test.tsx` y `tests/app/meta-oauth.test.ts` se escriben antes del código y fallan primero por ausencia de los módulos o por comportamiento, no por errores de sintaxis del archivo de prueba.

| ID | Criterios | Tipo | Comando | Resultado esperado | ¿Falla sin la implementación? |
|---|---|---|---|---|---|
| M16.1-T-01 | C-01 | unit | `npm run test:unit` | Recorre `src/`: `v26.0` solo en `meta/api.ts`; `graphUrl('me')` y `dialogUrl({})` llevan `/v26.0/` | Sí: no existe `api.ts` |
| M16.1-T-02 | C-02 | unit | `npm run test:unit` | El conjunto de parámetros de `buildAuthorizationUrl` es exactamente el esperado; `searchParams.has('scope')` es `false`; origen `https://www.facebook.com` | Sí |
| M16.1-T-03 | C-03 | unit | `npm run test:unit` | Cada `META_*` ausente o inválida da `MetaConfigError` con el nombre y sin el valor; `redirect_uri` con `?x=1`, `#f`, otra ruta o `http://` no local es rechazada; `http://localhost:3000/api/integraciones/meta/callback` es aceptada | Sí |
| M16.1-T-04 | C-04 | unit | `npm run test:unit` | Recorre `src/`: `META_APP_SECRET` solo en `meta/api.ts`; ningún `NEXT_PUBLIC_META`; los seis módulos empiezan con `import 'server-only';` | Sí |
| M16.1-T-05 | C-05 | unit | `npm run test:unit` | Tabla parametrizada: 190 sin subcódigo, 458, 460, 463, 467 → `authentication`; 459, 464 → `user_action`; 190/492 → `unknown`; 10, 200, 250, 299 → `permission`; 4, 17, 341, 613, 80000, 80003, 80004, 80014 → `rate_limit`; 1, 2 → `temporary`; 3, 100, 3018 → `own_error`; 300, 999, cuerpo sin `error.code` → `unknown`; el mismo cuerpo con estado 200, 403 o 500 da la misma clase; ningún caso da `asset_access` | Sí |
| M16.1-T-06 | C-06 | unit | `npm run test:unit` | `fetch` que rechaza, `AbortSignal` vencido (timeout de 5 ms con respuesta demorada), cuerpo `<html>` → `transport`; 500 con `{}` → `unknown`; se verifica `redirect: 'error'` y `cache: 'no-store'` en el `init` | Sí |
| M16.1-T-07 | C-07, C-16 | unit | `npm run test:unit` | Meta simulada responde errores cuyo `message`, `error_user_msg`, `type` y `fbtrace_id` contienen `https://graph.facebook.com/v26.0/me?access_token=…`, `code=…`, `Bearer …` y `act_` con dígitos, **y también el token, el código y el secreto simulados como texto suelto** (por ejemplo, "El código codigo-sint no es válido para la app con secreto secreto-sint; token token-sint-meta", sin ningún `clave=` delante), más un cuerpo cuyo `error.code` es una cadena igual al token simulado (→ `unknown`, `graphCode` `null`); ni `message`, ni `redactedMessage`, ni `String(e)`, ni `JSON.stringify(e)`, ni `Object.values(e)` contienen el token, el secreto, el código ni el `act_` completo; `redactedMessage` es exactamente `Graph ${code}/${subcode}: ${META_FAILURE_TEXTS[clase]}` y valida con `redactedErrorMessageSchema`; para `authentication` con 190/460 es el literal `Graph 190/460: Meta rechazó la credencial.`; cada valor de `META_FAILURE_TEXTS` es invariante bajo `redactErrorMessage`; `e.cause` es `undefined`. El canje envía `client_secret` solo a `graph.facebook.com` | Sí |
| M16.1-T-08 | C-08, C-09, C-10 | unit | `npm run test:unit` | `handleMetaStart` sin conexión viva: `createOAuthAttempt` con `initial`, hashes iguales a SHA-256 hex del `state` (de la `Location`) y del nonce (de la cookie), `return_path` `/app/integraciones`, `expires_at - now ≤ 540 s`; `303` a Meta; `Set-Cookie` con los atributos exactos; `state ≠ nonce`; los dos de 43 caracteres | Sí |
| M16.1-T-09 | C-08 | unit | `npm run test:unit` | Con conexión `active` y con `needs_reauth`: intento `reauth` con `expectedConnectionId` igual al de la conexión | Sí |
| M16.1-T-10 | C-22 | unit | `npm run test:unit` | Con `pending_selection`: `meta=pendiente_vigente`; ni `createOAuthAttempt` ni ninguna función de purga o revocación se llaman | Sí |
| M16.1-T-11 | C-11 | unit | `npm run test:unit` | `POST` sin `Origin` o con otro origen → `403` sin llamar a `tenant`; sin sesión → `303` a `/login?next=%2Fapp%2Fintegraciones`; sin empresa → `meta=sin_empresa`; sin configuración → `meta=error`; en los tres, `createOAuthAttempt` no se llama. El `route.ts` de inicio no exporta `GET` | Sí |
| M16.1-T-12 | C-12, C-13 | unit | `npm run test:unit` | Callback sin `state`, con `state` corto, sin cookie, con cookie mal formada, sin `code`: `meta=rechazado`; callback sin sesión (`tenant` lanza `UnauthorizedError`) con `state`, cookie y `code` válidos: `303` a `/login?next=%2Fapp%2Fintegraciones` y nada más; en todos, ni `consumeOAuthAttempt` ni `fetch` se llaman; la `Location` no tiene `code`, `state` ni `error`; `Referrer-Policy: no-referrer`; `Cache-Control: no-store`; cookie borrada (`Max-Age=0`) | Sí |
| M16.1-T-13 | C-13 | unit | `npm run test:unit` | `consumeOAuthAttempt` que lanza `OAuthAttemptRejectedError` → `meta=rechazado` con el mismo texto que T-12; `fetch` no se llama | Sí |
| M16.1-T-14 | C-14 | unit | `npm run test:unit` | `?error=access_denied&error_reason=user_denied&state=<válido>` con cookie → consume y `meta=cancelado`; sin `state` → `meta=cancelado` sin consumir; `fetch` no se llama en ningún caso | Sí |
| M16.1-T-15 | C-12, C-23 | unit | `npm run test:unit` | Callback `initial` exitoso: `303` exactamente a `<origen>/app/integraciones?meta=pendiente`; el token simulado, el código, el `state` y el nonce no aparecen en ningún encabezado, en el cuerpo ni en las líneas capturadas de `console.*` y de `log` | Sí |
| M16.1-T-16 | C-15 | unit | `npm run test:unit` | Orden de llamadas registrado: consume, canje, `debug_token`, `/me`, `create_pending_connection`. Si el consumo falla, ninguna de las siguientes | Sí |
| M16.1-T-17 | C-17 | unit | `npm run test:unit` | `debug_token` sin `ads_read` → `permiso_faltante`; `is_valid: false`, `app_id` distinto, `type: 'USER'`, `type` ausente, `/me` sin `client_business_id` → `token_no_valido`; en todos, `create_pending_connection` no se llama | Sí |
| M16.1-T-18 | C-18 | unit | `npm run test:unit` | `expires_at` 0, ausente, `NaN`, `Infinity`, una cadena y `1e20` → `expiresAt: null` sin lanzar; un epoch futuro → ISO exacto; `issuedForAppId` igual al `META_APP_ID` de la configuración; `tokenType: 'system_user'` | Sí |
| M16.1-T-19 | C-16 | unit | `npm run test:unit` | Canje con error 100 → `rechazado`; con error de red → `meta_no_disponible`; con 2xx sin `access_token`, con `access_token` vacío y con `access_token` no string → `meta_no_disponible`; en todos el canje se llamó una vez y no hubo `debug_token` ni `/me` | Sí |
| M16.1-T-20 | C-24 | unit | `npm run test:unit` | `create_pending_connection` que falla una vez por transporte y después responde → un reintento con argumentos idénticos y `pendiente`; que falla dos veces → `error`; `PX003` → `conexion_existente` sin reintento | Sí |
| M16.1-T-21 | C-21 | unit | `npm run test:unit` | Intento `reauth` consumido: conexión con otra generación o sin conexión viva → `credencial_cambio`; misma generación → `reautorizacion_no_disponible`; en todos los casos `fetch` no se llama y no hay llamada a `replace_credential` | Sí |
| M16.1-T-22 | C-25 | unit | `npm run test:unit` | `parseMetaOAuthOutcome` acepta cada valor de `META_OAUTH_OUTCOMES`, rechaza `''`, `'PENDIENTE'`, `['pendiente','x']` y valores desconocidos; cada resultado tiene texto | Sí |
| M16.1-T-23 | C-25 | component | `npm run test:component` (archivo `tests/component/integraciones-meta-aviso.test.tsx`) | La página de integraciones con `meta=cancelado` muestra el texto de cancelación en un `role="status"`; con `meta=error`, en un `role="alert"`; con `meta=desconocido`, con `meta` repetido o sin `meta`, no muestra aviso; ningún texto de la URL aparece en la página; "Conectar" sigue deshabilitado | Sí |
| M16.1-T-24 | C-26 | app | `npm run test:app` | Sin `PRAXA_INTEGRATIONS_TEST_DB_URL` válida o con `blockedReason()` no nulo, el `beforeAll` lanza (la suite falla, no se salta). Se verifica revisando el patrón del archivo y la salida de una corrida con la configuración presente | No aplica TDD: es la guarda; se verifica por inspección y por el conteo de la corrida |
| M16.1-T-25 | C-08, C-09, C-15, C-18, C-19 | app | `npm run test:app` | Empresa sintética: `handleMetaStart` real crea el intento; `handleMetaCallback` con Meta simulada crea la conexión. Leída con el cliente del usuario: `pending_selection`, metadatos nulos, `pending_expires_at` a 30 ± 2 min. `readCredential` con el cliente del rol de pruebas devuelve el token simulado, `system_user`, `ads_read` y `expiresAt` simulado; el texto cifrado no es el token | Sí |
| M16.1-T-26 | C-13 | app | `npm run test:app` | `state` desconocido (hash de uno nunca creado) → `rechazado`; ninguna conexión | Sí |
| M16.1-T-27 | C-13 | app | `npm run test:app` | Intento creado por `createOAuthAttempt` con `expires_at` a 4 s; se espera 6 s; callback → `rechazado`; ninguna conexión | Sí |
| M16.1-T-28 | C-13, C-20 | app | `npm run test:app` | Mismo `state`, cookie y código dos veces: primera `pendiente`, segunda `rechazado`; Meta simulada registró un solo canje; la empresa tiene una sola conexión | Sí |
| M16.1-T-29 | C-13 | app | `npm run test:app` | Intento de A consumido con el contexto de B (otro usuario y su empresa) → `rechazado`; después A completa con su contexto → `pendiente` (el intento no se gastó) | Sí |
| M16.1-T-30 | C-13 | app | `npm run test:app` | Contexto con el usuario de A y la empresa de B → `rechazado`; ninguna conexión en B | Sí |
| M16.1-T-31 | C-13 | app | `npm run test:app` | Cookie con otro nonce válido → `rechazado`; con la cookie correcta, después → `pendiente` | Sí |
| M16.1-T-32 | C-08, C-22 | app | `npm run test:app` | Con una pendiente creada por el flujo, `handleMetaStart` → `pendiente_vigente` y la pendiente sigue intacta. Con la conexión activada por `confirm_connection` sembrado por `worker_api` (`p_probe_succeeded = true`, datos sintéticos), `handleMetaStart` crea un intento `reauth` con esa conexión. `createOAuthAttempt` `initial` directo sobre esa empresa → `LiveConnectionExistsError` | Sí |
| M16.1-T-33 | C-21 | app | `npm run test:app` | Conexión activa; intento `reauth` 1 creado; la generación avanza con un segundo intento `reauth` consumido y `replaceCredential` del repositorio; callback del intento 1 → `credencial_cambio`, sin canje; con un intento `reauth` sobre la generación vigente → `reautorizacion_no_disponible`, sin canje, y la credencial sigue siendo la misma (lectura con `readCredential`) | Sí |
| M16.1-T-34 | C-17 | app | `npm run test:app` | Meta simulada sin `ads_read` → `permiso_faltante`; la empresa no tiene ninguna conexión (lectura RLS) | Sí |
| M16.1-T-35 | C-12 | app | `npm run test:app` | Para cada respuesta de T-25 a T-34, la `Location` cumple C-12 | Sí |
| M16.1-T-36 | C-04, C-27 | unit | `npm run test:unit` | `no-privileged-credentials` y `no-secrets-in-tree` siguen en verde con los archivos nuevos | No: son regresión; fallarían solo si un archivo nuevo rompe la invariante |
| M16.1-T-37 | C-28 | verify | `npm run verify` | lint, typegen, typecheck, `unit`, `component` (con `app-paginas-sesion.test.tsx` en verde sin cambios) y build en verde; el build lista `/api/integraciones/meta/iniciar` y `/api/integraciones/meta/callback` como dinámicas | Sí (rutas inexistentes) |
| M16.1-T-38 | CB-02, C-27 | manual | `git diff --stat` y búsqueda por patrón del diff | Sin valores de `META_*`, tokens, IDs de app o de negocio reales, ni el dominio en fixtures | No aplica TDD: revisión de evidencia |
| M16.1-T-39 | C-29 | manual | `git diff docs/SECURITY.md docs/ARCHITECTURE.md .env.example src/lib/env.ts docs/FASES/FASE1/meta_first/entorno.md` | Los cambios se limitan al Diseño §11; INV-06 ya no es absoluta respecto del hosting y §12 declara el límite; no copian TTL, nombres de funciones ni conteos; ningún valor ni identificador | No aplica TDD: documentación |
| M16.1-T-40 | C-31 | unit | `npm run test:unit` | Meta simulada registra método, URL, encabezados y cuerpo de cada petición de un callback `initial` exitoso: el canje y `debug_token` son `POST` con `Content-Type: application/x-www-form-urlencoded` y URL sin consulta; `/me` es `GET` cuya consulta tiene un único parámetro, `fields`, y `url.searchParams.get('fields')` es `id,client_business_id` (se compara el valor decodificado, no el texto de la URL, porque `URLSearchParams` codifica la coma como `%2C`), con `Authorization: Bearer <token simulado>`. En ninguna URL registrada aparecen el token simulado, el secreto simulado, el código simulado ni los nombres prohibidos. Meta simulada falla la prueba si recibe un `GET` a `oauth/access_token` o a `debug_token`. Con el `POST` del canje respondido con un error de Graph, el callback termina sin conexión y sin ningún reintento por `GET` | Sí |
| M16.1-T-41 | C-30 | unit | `npm run test:unit` | Recorre `src/`: todo archivo que lee `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` o `META_CONFIG_ID` empieza con `import 'server-only';` (hoy solo `meta/api.ts`) | Sí |
| M16.1-T-42 | C-31 | unit | `npm run test:unit` | `graphUrl('me', { access_token: 'x' })` y cada nombre de `GRAPH_URL_FORBIDDEN_PARAMS` lanzan; `getJson` y `postFormJson` con una URL armada a mano que tenga `?access_token=x`, o con otro origen, o con usuario y contraseña, lanzan sin llamar a `fetch`. **(A2x-02)** `postFormJson` con `?fields=x`, con `?x=1`, con `#f` y con una consulta que lleva el token simulado bajo `fields` lanza; `getJson` con `bearer` y la URL `…/me?fields=token-sint-meta`, con el token codificado (`%74oken-sint-meta`), en la ruta (`…/token-sint-meta/me`) y en el fragmento lanza; `getJson` con `bearer` y `…/me?fields=id,client_business_id` no lanza y llama a `fetch` con `Authorization: Bearer`. En los casos que lanzan, `fetch` no se llama y el mensaje del error no contiene la URL ni el token | Sí |
| M16.1-T-43 | C-28 | app | `npm run test:app` | Corrida completa con el proyecto desechable configurado: exit 0; `meta-oauth.test.ts` con todas sus pruebas ejecutadas y ninguna omitida; ninguna suite positiva omitida por falta de configuración; las omitidas restantes, si hay, son solo las del opt-in de `email-flows` y los bloques `NO EJECUTADA`, identificadas por archivo y motivo en la evidencia. Sin configuración válida, `meta-oauth.test.ts` falla en vez de saltarse (T-24) | No aplica TDD: es la corrida de cierre |

## Verificación

Antes de modificar archivos: `git status --short` limpio o cambios ajenos preservados; dependencias cerradas en `docs/PROJECT_STATE.md`; la Enmienda M16.1 de la ruta aprobada de forma visible por el usuario y esta spec en `APROBADA` (la implementación depende del texto enmendado).

Durante y al cierre (III.3: `npm run verify` y `test:app`, sin autorización real):

```bash
npm run test:unit            # rojo esperado al escribir las pruebas; verde al final
npm run db:check:test        # confirma que el destino de las pruebas es el proyecto desechable
npm run test:app             # obligatorio; incluye tests/app/meta-oauth.test.ts y las suites existentes; tiene que terminar correctamente
npm run verify               # lint, typegen, typecheck, unit, component y build
```

- `test:policies`, `db:push:test` y `db:push` **no** aplican: la microfase no tiene migración ni pgTAP.
- CB-06, precisada por D-M16.1-09 (`H-E1-23`): ninguna prueba de `tests/app/meta-oauth.test.ts` ni ninguna suite positiva de `tests/app/` que corre con el proyecto desechable configurado puede omitirse por falta de configuración. Las únicas omitidas admitidas son las ajenas a M16.1: el opt-in de correo de `tests/app/email-flows.test.ts` (consume la cuota de correo del proyecto) y los bloques complementarios `NO EJECUTADA` de `concurrency`, `email-flows`, `integrations-data-api`, `isolation` y `onboarding`, que por diseño se omiten cuando hay configuración. La evidencia registra el conteo de pruebas por archivo de `test:app`, lista cada archivo con omitidas y su motivo, y **no** declara "cero omitidas" para toda la suite.
- La evidencia (`sesiones/M16.1.md`) registra los comandos y resultados reales, sin valores de entorno, y la declaración del usuario sobre P-01 a P-03 y las variables, con sus limitaciones.

## Intervenciones del usuario y acciones reservadas

| Paso | Qué hace el usuario | Cómo se verifica después |
|---|---|---|
| P-01 (declarado hecho el 2026-10-12) | Configuración de Login for Business de tipo system user, con `ads_read`, cuenta publicitaria requerida y tarea ANALYZE | Declaración del usuario (H-S-12), sin el `config_id`. No verificable desde el repositorio; el recorrido real es VR-01 en `M16.2` |
| P-02 (declarado hecho el 2026-10-12) | URI de redirección registrada; según el usuario, Meta validó la URI exacta | Declaración del usuario. En runtime, `readMetaOAuthConfig` rechaza un `META_REDIRECT_URI` cuya ruta no sea exactamente `/api/integraciones/meta/callback` o que tenga consulta o fragmento (C-03) |
| P-03 (declarado hecho el 2026-10-12) | App en el portfolio propio del usuario, con control total, separado del portfolio del dueño | Declaración del usuario. La separación respecto del portfolio del dueño se confirma con P-04, en `M16.2` |
| Variables (declarado hecho el 2026-10-12) | `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` y `META_CONFIG_ID` en Vercel Production, con `META_APP_SECRET` como Secret | Inventario por nombre en `entorno.md` (Diseño §11), sin valores. La presencia no acredita validez. No hace falta cargarlas en `.env.local`: las pruebas usan Meta simulada |
| Producción entre M16.1 y M16.2 | No completar ninguna autorización real en el entorno del piloto antes de `M16.2` y `G-ACTA-META`. `META_CONFIG_ID` sigue en Production por decisión del usuario | D-M16.1-06; C-30. "Conectar" deshabilitado e `iniciar` solo por `POST` con `Origin` propio |
| Aprobar la Enmienda M16.1 de la ruta | Aprobación visible del texto enmendado de `plan.md` y `spec.md` de `meta_first` | Registro en el encabezado de los dos documentos |
| Merge, push y despliegue | Los ejecuta el usuario. Con las variables ya cargadas, el despliegue deja las rutas activas en producción, contenidas por D-M16.1-06 | Sin ningún dato real: el despliegue de Vercel queda `Ready`; `GET /api/integraciones/meta/iniciar` responde `405`; un `POST` sin `Origin` responde `403` y no inicia ninguna autorización; "Conectar" sigue deshabilitado en producción. Se registra en `sesiones/M16.1.md`, redactado |
| `db:push` y `db:push:test` | No aplican en esta microfase | — |
| Gate | Aprobar `G-OAUTH` | Registro en `PROJECT_STATE.md` |

Ninguna clave ni identificador se pega en el chat ni en la evidencia.

## Trampas y riesgos

De II.9:

1. **Consumo en la misma sentencia.** El `state` se compara por hash y se consume en la misma sentencia en que se valida. El callback no lee el intento antes de consumirlo.
2. **El código pasa por el navegador.** Se controla que no se persista, que no se registre y que la URL quede limpia enseguida.
3. **El callback es un Route Handler.** El proxy refresca la sesión pero no redirige fuera de `/app` (`src/proxy.ts:22`, `:73`); identidad y empresa se verifican en el handler con K01.
4. **"Feature unavailable".** Con una app Business, el diálogo clásico con `scope` puede fallar; se usa `config_id`.

Del código y de las fuentes:

5. **Reloj de la base.** `create_oauth_attempt` rechaza un vencimiento mayor a `now() + 10 min` medido en la base (`0012_integrations.sql:527-528`); por eso 9 minutos.
6. **`client_business_id` obligatorio.** `create_pending_connection` lo exige no nulo aunque K03 lo admita nulo (`0012_integrations.sql:713-716`; sesión M06.1a-M06.2a, nota para M16.1).
7. **Secretos hacia Meta.** El canje y `debug_token` necesitan el secreto de la app. El cliente nunca pone la URL, la petición ni el cuerpo en un error, no usa `cause` y no registra nada; Next no imprime las URLs de `fetch` del servidor salvo con `logging.fetches`, que no está configurado (`next.config.ts`). Por D-M16.1-08, el secreto, el código y los tokens nunca viajan en la URL: van en el cuerpo de un `POST` o en `Authorization`.
8. **Logs del hosting (D-M16.1-07).** Los Runtime Logs de Vercel muestran los "Search Params" de cada petición (H-S-09, verificado en la documentación oficial), así que `code` y `state` del callback quedan visibles durante la retención del plan y en cualquier Log Drain. Nada en la aplicación lo evita; se declara en `SECURITY.md` §12 y se acota INV-06.
9. **Fallos después de que la persona autorizó en Meta.** Cuando llega el callback, la autorización en Meta ya ocurrió. Un fallo posterior impide crear la conexión en PRAXA, pero no deshace lo que pasó en Meta:
   - **Caso A: falla el canje** (incluido un rechazo del `POST`, H-S-13, un error de transporte o un código vencido). No se crea ninguna conexión en PRAXA y no hay token, pero la persona ya concedió acceso a la app en Meta, y ese acceso sigue ahí.
   - **Caso B: el canje funciona y después falla `debug_token`, `/me` o la creación de la pendiente** (incluido un rechazo del `POST` de `debug_token`). Meta ya emitió un token válido. M16.1 no lo guarda, no lo registra y no lo revoca, porque no tiene revocación: es un token huérfano.

   En M16.1 ninguno de los dos puede ocurrir con datos reales, porque no hay autorización real (D-M16.1-06). El procedimiento de recuperación de los dos casos se asigna a `M16.2` y tiene que existir **antes de la primera autorización real** (`H-E1-114`). No se resuelve agregando un `GET` de respaldo (D-M16.1-08).
10. **Cookie `__Host-`.** Exige `Secure`, `Path=/` y ningún `Domain`. En `http://localhost`, Chrome y Firefox aceptan `Secure`; otros navegadores pueden no hacerlo en desarrollo local. No afecta las pruebas, que leen el encabezado.
11. **Exportaciones de `route.ts`.** Next solo admite métodos HTTP y opciones de segmento; los manejadores con dependencias van en `oauth.ts`.
12. **Caché de `fetch` en Next.** Toda llamada a Meta usa `cache: 'no-store'`.
13. **Mapeo de errores de `worker_api`.** `PX001` en el consumo (empresa ajena) también se presenta como `rechazado`, para no distinguir causas (CA-29).
14. **Fixtures.** Un `?code=` de 20 o más caracteres, un `EAA…` o un `META_APP_SECRET=valor` en el árbol rompe `no-secrets-in-tree` (`tests/unit/no-secrets-in-tree.test.ts:11-20`).
15. **Suite de aplicación que se salta.** El patrón general de `tests/app/` puede saltar sin credenciales; la suite nueva lanza en `beforeAll`, como la del rol (CB-06).
16. **URL del rol.** Las pruebas crean el cliente con `resolveIntegrationsTestTarget(process.env)`; `getWorkerApi()` lee `PRAXA_INTEGRATIONS_DB_URL` y nunca debe ejecutarse en pruebas (spec §5, `SECURITY.md:312-314`).
17. **Lectura RLS en pruebas.** `readLiveConnection` recibe el cliente autenticado del usuario de prueba; el de la clave secreta nunca verifica comportamiento (`tests/app/helpers.ts:91-100`).
18. **Exposición antes de `M16.2` (D-M16.1-06).** Las variables `META_*` siguen en producción: un despliegue de esta microfase deja el flujo alcanzable con un `POST` armado a mano desde el propio origen. La contención es operativa (ninguna autorización real hasta `M16.2` y `G-ACTA-META`) más "Conectar" deshabilitado; no hay una barrera técnica que lo impida.
19. **H-02.** Si `debug_token` informa el tipo del token de system user con otro valor, el diseño rechaza la conexión (`unsupported_type`). Se detecta recién en VR-01 (`M16.2`); allí se ajusta el mapeo con evidencia, sin aflojarlo antes.
20. **Subpeticiones en los logs del hosting (D-M16.1-08).** La tabla de detalles de Runtime Logs incluye "Outgoing Requests", y el changelog de Vercel indica que cada una muestra su URL. Un canje o un `debug_token` por `GET` dejaría `client_secret`, el token de app, el código o el token nuevo en esa URL, y el token de app y el de system user no son de un solo uso. Por eso ninguna URL de salida lleva credenciales (C-31), sin depender de cómo muestre Vercel la consulta.
21. **Meta podría rechazar el `POST` (H-S-13).** Lo mismo vale para `Authorization: Bearer` en `/me` (H-S-15). Si eso pasa en VR-01, la autorización del dueño ya ocurrió: es el caso A (canje) o el caso B (`debug_token` o `/me`) de la trampa 9, y se aplica el procedimiento de recuperación de `M16.2`. No se agrega un `GET` de respaldo ni se pone el token en la URL: se frena y el usuario decide cómo seguir antes de cualquier autorización real siguiente.

## Decisiones de la microfase

| ID | Decisión | Motivo | Decidió | Fecha |
|---|---|---|---|---|
| D-M16.1-01 | (Q-01, opción a) El resultado del callback se muestra en `/app/integraciones` con `?meta=<resultado>` de una lista cerrada. Se autoriza la enmienda de la ruta para incluir `page.tsx` y su prueba de componente | CA-29 y CA-34 exigen una pantalla; reutiliza el `return_path` de la allowlist y no adelanta la UI de `M16.2` | Usuario | 2026-10-12 |
| D-M16.1-02 | (Q-02, opción a, con `entorno.md`) La ruta incluye `SECURITY.md`, `ARCHITECTURE.md`, `.env.example`, `src/lib/env.ts` y `entorno.md` entre los archivos previstos. En `entorno.md`, las `META_*` dejan de figurar como "diferidas" | Contrato documental de `AGENTS.md`; spec de la ruta §5; `H-E1-42` | Usuario | 2026-10-12 |
| D-M16.1-03 | (Q-03, opción a) `M16.1` valida el intento `reauth` y la generación, pero no canjea el código ni reemplaza la credencial; eso queda en `M16.2`. La enmienda aclara esta división en CA-29b y en el criterio de aceptación de la ficha | Evita la contradicción con CA-29b y no deja tokens válidos en Meta sin guardar ni revocar | Usuario | 2026-10-12 |
| D-M16.1-04 | (Q-04, opción a) Con una pendiente vigente, `iniciar` informa que existe una conexión pendiente. Purga y revocación quedan para `M16.2` | Purgar sin revocar dejaría el token válido en Meta; la revocación es de `M16.2` | Usuario | 2026-10-12 |
| D-M16.1-05 | (Q-05, opción a) El orden consumir intento → crear conexión se garantiza y se prueba en el servidor, sin migración nueva | Único llamador; una migración nueva chocaría con la numeración reservada de `M16c` | Usuario | 2026-10-12 |
| D-M16.1-06 | (Q-06, opción a) `iniciar` solo por `POST` con `Origin` propio, "Conectar" deshabilitado y ninguna autorización real antes de `M16.2` y `G-ACTA-META`. `META_CONFIG_ID` no se quita de Production | Contención sin cambiar la ruta ni el entorno | Usuario | 2026-10-12 |
| D-M16.1-07 | (Q-07, opción a) Se declara el límite de los logs de Vercel y se ajusta la redacción absoluta de INV-06 (y, por coherencia, de CA-30). La documentación oficial de Vercel muestra "Search Params" en los detalles de Runtime Logs: no es una hipótesis | El código es de un solo uso y no sirve sin `META_APP_SECRET`; el `state` se guarda como hash | Usuario | 2026-10-12 |
| D-M16.1-08 | (Q-08, opción a) En el canje y en `debug_token`, los parámetros sensibles van en el cuerpo de un `POST`, y ninguna URL de salida hacia Meta lleva secretos, códigos ni tokens; `/me` envía el token solo en `Authorization`. No hay respaldo automático por `GET`: si Meta rechaza el `POST` en VR-01, se frena y se decide cómo resolverlo antes de cualquier autorización real siguiente. La autorización en curso ya ocurrió: su recuperación (casos A y B de la trampa 9) es de `M16.2` (`H-E1-114`). H-S-13 sigue como hipótesis. *(Redacción corregida por el usuario el 2026-10-12.)* | Evitar la exposición aunque Vercel muestre la URL completa de una subpetición, sin inspeccionar los logs de producción ni asumir cómo los muestra | Usuario | 2026-10-12 |
| D-M16.1-09 | (A-01, auditoría de la ronda 1) Se resuelve `H-E1-23` en la enmienda: CB-06 se precisa. Para M16.1, ninguna prueba requerida de `meta-oauth.test.ts` ni suite positiva exigida por el gate puede omitirse por falta de configuración, y `npm run test:app` termina correctamente. Las pruebas opt-in ajenas a M16.1 pueden figurar como omitidas con su archivo y motivo en la evidencia; no se declara "cero omitidas" para toda la suite | `test:app` omite hoy pruebas ajenas por diseño; una lectura literal impediría aprobar `G-OAUTH` | Usuario | 2026-10-14 |
| D-M16.1-10 | (A-04) La enmienda se amplía a CA-26 y al punto de §7 de `SECURITY.md`: la prohibición cubre los logs, errores y archivos que produce PRAXA, y declara que el hosting puede registrar `code` y `state` de la petición entrante al callback. Se conserva absoluta la prohibición de tokens y secretos en las URLs de salida | Coherencia con D-M16.1-07 | Usuario | 2026-10-14 |
| D-M16.1-11 | (A-11) Nota en II.10, paso 6, que remite a `H-E1-114` y a D-M16.1-08: la forma de revocar se decide y verifica en `M16.2` antes de la primera autorización real, y `GET oauth/revoke` no queda como instrucción ejecutable que ponga el token en la URL | La ruta no puede contradecir D-M16.1-08 | Usuario | 2026-10-14 |

Las decisiones no materiales tomadas al expandir están en "Diseño concreto", marcadas **(decisión)**.

## Supuestos e hipótesis

- **H-S-01 — Verificado (2026-10-12).** Graph API v26.0 es la versión vigente: publicada el 2026-07-29, "Available until TBD" (https://developers.facebook.com/docs/graph-api/changelog/version26.0). *Cómo y cuándo:* volver a mirar el changelog al implementar (spec §5); si hay una versión más nueva, la constante sigue en v26.0 salvo decisión del usuario.
- **H-S-02 — Verificado en la documentación (2026-10-12).** Para system user, Login for Business usa `config_id` en lugar de `scope`, `response_type=code` y `override_default_response_type=true` (https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business). *Comportamiento real:* VR-01, en `M16.2`.
- **H-S-03 — HIPÓTESIS.** El canje acepta `redirect_uri` y exige que coincida con el del diálogo, como en el flujo manual (https://developers.facebook.com/documentation/facebook-login/guides/advanced/manual-flow). La página de Login for Business muestra el canje solo con `client_id`, `client_secret` y `code`. *Cómo y cuándo:* VR-01 (`M16.2`); si Meta rechaza el parámetro, se quita con evidencia.
- **H-S-04 — HIPÓTESIS (H-02).** `debug_token` informa `type: 'SYSTEM_USER'`, `is_valid`, `app_id`, `scopes` y `expires_at` para un token de system user de integración. *Cómo y cuándo:* VR-01. Si difiere, se frena en `M16.2` y se ajusta `tokens.ts` con evidencia.
- **H-S-05 — HIPÓTESIS.** `expires_at = 0` en `debug_token` significa "sin vencimiento"; Login for Business indica que estos tokens no vencen por defecto, salvo que se pida el vencimiento a 60 días. *Cómo y cuándo:* VR-01; en cualquier caso se guarda `null` y no se inventa un plazo (CA-31).
- **H-S-06 — Verificado en la documentación (2026-10-12).** `/me?fields=id,client_business_id` con el token de system user devuelve el negocio cliente (misma página de Login for Business). *Comportamiento real:* VR-01.
- **H-S-07 — HIPÓTESIS.** Al cancelar, Meta redirige con `error=access_denied`, `error_reason=user_denied` y `error_description`, y conserva `state` (flujo manual). *Cómo y cuándo:* VR-01. El diseño muestra `cancelado` aunque falte `state` (Diseño §6.2, paso 3).
- **H-S-08 — Verificado en el código.** Las cookies de sesión de `@supabase/ssr` son `SameSite=lax` (`node_modules/@supabase/ssr/dist/main/utils/constants.js:4-11`): la navegación GET de Meta al callback lleva la sesión, y un POST de otro sitio a `iniciar` no. *Comportamiento en navegador real:* VR-01.
- **H-S-09 — Verificado en la documentación oficial (2026-10-12).** La página de Runtime Logs de Vercel lista "Search Params" ("Search parameters of the request path") entre los detalles de cada petición, y una retención de 1 hora en Hobby, 1 día en Pro y 30 días con Observability Plus (https://vercel.com/docs/logs/runtime). La documentación no ofrece una opción para redactar esos parámetros antes de guardarlos (consulta abierta en el foro de Vercel: https://community.vercel.com/t/can-oauth-callback-query-parameters-be-excluded-from-platform-logs-before-storage/49984). Decidido en D-M16.1-07.
- **H-S-10 — Verificado en la documentación (2026-10-12).** Los códigos de límite de la Marketing API son 4, 17, 613, 80000, 80003, 80004 y 80014 (https://developers.facebook.com/documentation/ads-commerce/marketing-api/overview/rate-limiting). 341 viene de la tabla de la ruta.
- **H-S-11 — HIPÓTESIS.** El código de autorización de Meta es de un solo uso y de vida corta. CA-33 no depende de esto: lo garantiza el consumo único del intento. *Cómo y cuándo:* no se verifica en `M16.1` ni en `M16.2`; es informativa, y ningún criterio ni caso de prueba la usa.
- **H-S-12 — Declaración del usuario del 2026-10-12, no verificable desde el repositorio.** P-01 (system user, `ads_read`, cuenta publicitaria requerida, ANALYZE), P-02 (URI exacta validada por Meta) y P-03 (app en el portfolio propio, control total) cumplidos; las cuatro `META_*` en Vercel Production, con `META_APP_SECRET` como Secret. *Cómo y cuándo:* se registra en la sesión de `M16.1`; el recorrido real, en VR-01.
- **H-S-15 — HIPÓTESIS (A-13).** Graph acepta `Authorization: Bearer <token>` en `GET /me`. La página oficial de Facebook Login for Business (consultada el 2026-10-14) muestra `/me?fields=client_business_id&access_token=…`, con el token en la consulta, y ningún ejemplo con encabezado. *Cómo y cuándo:* VR-01 (`M16.2`). Si Meta rechaza el encabezado, el token ya canjeado y validado queda huérfano (caso B de la trampa 9): se aplica la recuperación de `M16.2` (`H-E1-114`), se frena y el usuario decide cómo resolver `/me` antes de cualquier autorización real siguiente. No hay respaldo con el token en la URL (D-M16.1-08).
- **H-S-13 — HIPÓTESIS.** Graph acepta `POST` con cuerpo de formulario en `oauth/access_token` y en `debug_token`, con la misma respuesta que por `GET`. La Graph API admite parámetros en el cuerpo, pero la documentación de Login for Business muestra ambos endpoints por `GET`. *Cómo y cuándo:* VR-01 (`M16.2`). Si Meta rechaza el `POST` en cualquiera de los dos, la autorización del dueño ya ocurrió (casos A y B de la trampa 9): se aplica la recuperación de `M16.2` (`H-E1-114`), se frena y se decide cómo resolverlo antes de cualquier autorización real siguiente. No hay respaldo automático por `GET` (D-M16.1-08).
- **H-S-14 — NO VERIFICADO, y la decisión no depende de esto.** La página de Runtime Logs lista "Outgoing Requests" ("Sub-requests made during the function execution", https://vercel.com/docs/logs/runtime) y el changelog de 2024 dice que cada una muestra su URL (https://vercel.com/changelog/metrics-for-outgoing-requests). La documentación de Vercel **no confirma** si esa URL incluye la consulta ni si el panel está disponible en Hobby. D-M16.1-08 no asume ni lo uno ni lo otro: las URLs de salida no llevan credenciales en ningún caso. El usuario decidió no inspeccionar los logs de producción.

## Preguntas abiertas

Ninguna. `M16.1-Q-08` se resolvió con D-M16.1-08:

| ID | Pregunta | Opciones | Recomendación | Evidencia |
|---|---|---|---|---|
| M16.1-Q-08 (resuelta: D-M16.1-08, opción a) | Los Runtime Logs de Vercel listan las subpeticiones de cada función ("Outgoing Requests") con su URL (H-S-14). Un canje o un `debug_token` por `GET` llevan en la consulta `client_secret`, el token de app, el código o el token nuevo, que podrían quedar visibles en el panel. A diferencia del código del callback (D-M16.1-07), el token de app y el de system user no son de un solo uso. ¿Cómo se envían? | (a) `POST` con cuerpo de formulario para el canje y para `debug_token`, y la URL sin consulta (Diseño §4 a §6, C-31, T-40); si VR-01 muestra que Meta no lo acepta (H-S-13), se frena y se vuelve a decidir. (b) `GET` como en la documentación de Meta, y extender el límite de D-M16.1-07 a las subpeticiones. (c) Decidir después de que el usuario observe el panel: si no muestra la consulta, (b); si la muestra, (a) | (a): cierra la exposición sin depender de cómo muestre Vercel las URLs, no cambia el flujo ni los archivos de la ruta, y el costo es una hipótesis más para VR-01 | https://vercel.com/docs/logs/runtime ("Outgoing Requests"); https://vercel.com/changelog/metrics-for-outgoing-requests; INV-06; CA-30; trampa 20 |

## Hallazgos relacionados

- `H-E1-13` (asignado a M16.1): la evidencia de M00 no prueba el flujo de un tercero. M16.1 no hace autorización real (T10), así que no puede resolverlo. Al cerrar, se registra que queda pendiente de VR-01 en `M16.2`.
- `H-E1-21` (M16.1 y M16.2): parte de M16.1 resuelta por D-M16.1-04 (C-22, T-10, T-32). La purga de la pendiente y su revocación siguen en `M16.2`.
- `H-E1-22` (M16.1 y M16.2): en el flujo `initial` de M16.1 no existe todavía una conexión a la que asociar una clase de error; la clase se registra en el log (Diseño §6). La parte de conexiones existentes queda para `M16.2`.
- `H-E1-24` (M16.1): resuelto en diseño por D-M16.1-05 (C-15, T-16); se cierra con la evidencia de la implementación. El límite sigue declarado en `SECURITY.md` §4.
- `H-E1-42` (M16.1): autorizado por D-M16.1-02; se cierra al corregir el comentario (C-29).
- `H-E1-100`: "Conectar" sigue deshabilitado hasta `M16.2` (D-M16.1-06).
- `H-E1-82`: la landing dice que Meta Ads "ya está disponible"; M16.1 no lo cambia (decisión de copy pendiente del usuario).
- Nuevos a registrar en `docs/HALLAZGOS.md` al implementar, con ID estable: el límite de los logs del hosting (D-M16.1-07, H-S-09), y la regla de URLs de salida sin credenciales y su dependencia de H-S-13 para VR-01 (D-M16.1-08).
- `H-E1-114` (registrado el 2026-10-12, asignado a `M16.2`): procedimiento de recuperación de los casos A y B de la trampa 9, antes de la primera autorización real. Incluye la forma de revocar: la Enmienda M16.1 deja II.10, paso 6, sin fijar el método y remite a este hallazgo y a D-M16.1-08 (D-M16.1-11); se decide y verifica en `M16.2`, sin token ni secreto en la URL. M16.1 no lo implementa.
- **Hipótesis de M16.1 para VR-01** (A-09): al implementar se registra en `docs/HALLAZGOS.md` un hallazgo nuevo, con ID estable y asignación a `M16.2` (VR-01), que reúne H-S-03 (`redirect_uri` en el canje), H-S-05 (`expires_at = 0` significa sin vencimiento), H-S-07 (parámetros de la cancelación y `state` conservado), H-S-13 (`POST` en el canje y en `debug_token`) y H-S-15 (`Authorization: Bearer` en `/me`), para que `M16.2` las verifique aunque III.4 de la ruta no las liste.

## Auditorías

| Ronda | Informe | Veredicto | Estado |
|---|---|---|---|
| 1 | `revisiones/spec-audit-1.md` | REQUIERE CAMBIOS (A-01 a A-12) | Aplicadas las correcciones; A-01, A-04 y A-11 resueltas por D-M16.1-09 a D-M16.1-11 |
| 2 | `revisiones/spec-audit-2.md` | REQUIERE CAMBIOS (A-13 a A-17) | Aplicadas las correcciones |
| 2 (segunda auditoría) | Sin informe propio: dos puntos que quedaron fuera de `spec-audit-2.md` | — | **A2x-01** (media): `redactedMessage` incorporaba `error.message` libre de Meta y `redactErrorMessage` no detecta tokens como texto suelto; resuelto en §3, C-07 y T-07. **A2x-02** (media): la barrera HTTP aceptaba un token bajo un nombre permitido como `fields`; resuelto en §4, C-31 y T-42. Los IDs `A2x-NN` se usan para no colisionar con los `A-NN` de los informes |
| 3 | `revisiones/spec-audit-3.md` | APROBABLE, con hallazgos bajos A-18 a A-21 | Aplicadas las correcciones sin ampliar el alcance |
| 4 | Pendiente | — | — |
