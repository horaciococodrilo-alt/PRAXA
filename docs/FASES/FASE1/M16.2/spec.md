# M16.2 — Spec de la microfase

**Estado:** APROBADA

Estados posibles: `BORRADOR` → `APROBADA`. Solo el usuario pasa una spec a `APROBADA`, y solo después de una auditoría APROBABLE.

**Hash de contenido.** Se calcula sin la línea de estado:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M16.2/spec.md | git hash-object --stdin
```

## Fuentes

- Ruta: `docs/FASES/FASE1/meta_first/plan.md` (ficha de M16.2 en la Parte I; sección II.10, con la nota de la Enmienda M16.1 en el paso 6; III.2, III.3, III.4, III.5 y III.9) y `docs/FASES/FASE1/meta_first/spec.md` (secciones 4, 6, 7, 9 y 10; CA-07 a CA-09b, CA-26, CA-28, CA-29b, CA-31, CA-35 a CA-40, CA-60; DEC-02, DEC-09, DEC-17, DEC-18; P-04, P-05; H-01 a H-04; VR-01; sección 14 y CB-01 a CB-06).
- Commit base: `65404aa` (`main`, árbol limpio al expandir).
- Microfases previas en las que se apoya: `M05.1.1` (K01), `M05.1.2` a `M05.1.4` (K02 a K04), `M06.1a-M06.2a` (`0012`, `worker_api`, pgTAP `08`, `09`, `09b`, `10`), `M06.3a` (cifrado, cliente del rol, repositorio de credenciales), `M28.2a` (`G-ENTORNO`) y `M16.1` (`G-OAUTH`, 2026-10-14). Todas cerradas en `docs/PROJECT_STATE.md`.
- Gates y prerrequisitos de la ficha que **no** están cumplidos al expandir: `G-ACTA-META` (`M03a` sin empezar; `docs/FASES/FASE1/M03a/` no existe) y P-04. Bloquean solo los pasos 10 a 12 de II.10 (alta del dueño y VR-01), no los pasos 1 a 9.
- IDs cubiertos: solo `M16.2` (II.10 no agrupa microfases).
- Hallazgos asignados: `H-E1-13`, `H-E1-21`, `H-E1-22`, `H-E1-28`, `H-E1-114`, `H-E1-116`, `H-E1-117`; relacionados: `H-E1-25`, `H-E1-100`.
- Fuentes externas consultadas el 2026-10-16: revocación de tokens de system user (https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens/) y referencia de `assigned_ad_accounts` (https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/system-user/assigned_ad_accounts), solicitudes por lote (https://developers.facebook.com/docs/graph-api/batch-requests) y referencia de `debug_token` (https://developers.facebook.com/docs/graph-api/reference/debug_token/). Ver "Supuestos e hipótesis".
- Grill del 2026-10-16: decisiones D-M16.2-01 a D-M16.2-08. Después de la auditoría: D-M16.2-10 y D-M16.2-11. D-M16.2-09 está retirada ("Decisiones de la microfase").

## Objetivo

Pasar de `pending_selection` a `active` con una cuenta confirmada y probada, y completar VR-01 con el dueño real (ficha de M16.2, Parte I del plan).

## Alcance

De la ficha ("Implementación requerida" y "Procedimiento del asistente") y de los pasos 1 a 12 de II.10:

1. Listado paginado de cuentas delegadas con `/{id}/assigned_ad_accounts` y `name,currency,timezone_name`, hasta agotar la respuesta (paso 1; CA-35, CA-60, H-01).
2. Pantalla de confirmación de cuenta, moneda y zona, aunque haya una sola cuenta, con la cuenta truncada (paso 2; CA-36, CA-40).
3. Probe: una consulta de Insights contra la cuenta elegida antes de `confirm_connection`, que además verifica el vencimiento en la base (paso 3; CA-37).
4. Vencimiento de pendientes y purga perezosa y reanudable: al iniciar un intento, al abrir integraciones o al repetir una desconexión, recorre `list_pending_purges` y aplica bloqueo → revocación (si queda credencial) → `purge_connection` (paso 4; CA-37b, CA-38, DEC-17).
5. Reautorización completa: el callback `reauth` canjea, inspecciona, verifica que la cuenta conectada siga entre las delegadas y llama a `replace_credential` con la generación esperada (paso 5; CA-37c y la parte de `M16.2` de CA-29b).
6. Desconexión reanudable con revocación: `begin_disconnect` → revocación en Meta (H-03) → `purge_connection`; la UI indica cómo quitar la app desde las apps conectadas del negocio. La revocación y `debug_token` viajan como operaciones `GET` dentro de una solicitud por lote, sin token ni secreto en la URL de salida (paso 6 y su nota; `H-E1-114`, `H-E1-116`, D-M16.1-08, D-M16.1-11, D-M16.2-03), y la vía por lote se verifica con un preflight sin el dueño antes de la primera autorización real (D-M16.2-05).
7. Transiciones por clase de error de CA-39 (paso 7).
8. UI de estado, reconexión y desconexión en `/app/integraciones` (paso 8; habilita "Conectar", `H-E1-100`), y estado real de Meta Ads en `getIntegraciones` para el chip, Inicio y Chat (D-M16.2-02).
9. Pruebas de ciclo de vida con Meta simulada, unitarias y `test:app` (paso 9).
10. Escrituras en vuelo (CA-38c) en las escrituras que existen en esta microfase.
11. Procedimiento de recuperación de los casos A y B de `H-E1-114`, antes de la primera autorización real.
12. Alta del dueño (paso 10), VR-01 (paso 11) y el cierre sin credenciales reales pendientes (paso 12), recién con `G-ACTA-META` y P-04.

## Fuera de alcance

- Insights para persistir: snapshots, cobertura, ejecuciones, botón de sincronización, Q-04 como valor (solo se mide), migración `0015` (`M16c`). El probe no guarda ningún valor.
- `publish_snapshot` y `record_query`, y la parte de CA-38c que les toca (`M16c` y `M25a.1`; ver Diseño §12).
- Cualquier migración nueva o cambio de `worker_api`, pgTAP nuevo, o cambio del TTL de 30 minutos o del tope de 10 minutos del intento.
- Más de una cuenta por empresa; cambiar de cuenta sin desconectar (CA-37c).
- Escrituras sobre Meta distintas de la revocación del propio token (sección 2 de la spec de la ruta).
- Flujo de baja de cuenta, cierre del piloto (CA-67, `M28.3a`).
- App Review, Business Verification y Advanced Access (`M16d`).
- Cambiar la forma de las llamadas que llevan el token solo en `Authorization` (`/me`, `assigned_ad_accounts`, Insights) o del canje (`POST oauth/access_token`). Solo `debug_token` y la revocación pasan a lote (D-M16.2-03).
- Cambiar el texto de la landing (`H-E1-82`) o el resto de las tarjetas de integraciones (Google Analytics y Tiendanube siguen del mock, deshabilitadas, también en `getIntegraciones`).
- Registro persistente de clases de error que no llevan a `needs_reauth`: se reasigna a `M16c` (D-M16.2-07).
- Un `loading.tsx` en `/app/integraciones`: haría que Next prefetchee la ruta y adelantaría la purga y las llamadas a Meta (trampa 11).

## Contexto verificado en el código

| Qué | Dónde (archivo:línea) | Qué implica para esta microfase |
|---|---|---|
| `GRAPH_API_VERSION`, `graphUrl` y la lista de parámetros prohibidos en URLs de salida (`access_token`, `input_token`, `client_secret`, `code`, `appsecret_proof`) | `src/modules/integrations/meta/api.ts:14-41` | La revocación lleva `revoke_token`: se suma a la lista para que nunca viaje en una URL |
| `readMetaOAuthConfig`/`getMetaOAuthConfig` con `appId`, `appSecret` (`SecretValue`), `redirectUri`, `configId` | `meta/api.ts:53-124` | La revocación usa `appId` y `appSecret` de acá; `META_APP_SECRET` sigue solo en `api.ts` |
| Cliente HTTP: `getJson` con `bearer` (token solo en `Authorization`), `postFormJson` sin consulta; rechazo previo de URLs con credenciales; sin reintentos; timeout 10 s | `meta/client.ts:16-122` | Listado y probe usan `getJson` con `bearer`; `debug_token` y la revocación, un método de lote nuevo (`postBatchGetJson`, D-M16.2-03) con las mismas guardas |
| Clasificación CA-39 por código de Graph; `asset_access` nunca se asigna; textos fijos por clase y `redactedMessage` de plantilla | `meta/errors.ts:16-107` | El efecto sobre la conexión (paso 7) se agrega sobre esta clasificación, sin cambiarla |
| `inspectToken` por `POST` (`debug_token`) y `fetchClientBusinessId` con `GET me?fields=id,client_business_id` y `bearer` | `meta/tokens.ts:68-102` | `/me` ya devuelve `id` (system user): se reutiliza la misma petición para obtenerlo, sin cambiar su forma (T-40 de M16.1) |
| `handleMetaStart`: con `pending_selection` responde `pendiente_vigente` sin purgar | `meta/oauth.ts:222-226` | Paso 4: la purga perezosa se agrega antes de leer la conexión viva |
| Callback `reauth`: compara conexión y generación y responde `reautorizacion_no_disponible` sin canjear | `meta/oauth.ts:348-355` | Paso 5: se reemplaza por el camino completo de CA-37c |
| Camino `initial`: consumo → canje → `debug_token` → `/me` → pendiente; reintento único por transporte; fallos después del canje terminan sin revocar | `meta/oauth.ts:357-409` | Caso B de `H-E1-114`: hoy un token canjeado y rechazado queda huérfano |
| Registro de formato fijo `{ evento, etapa, resultado, clase?, request_id? }` | `meta/oauth.ts:53-76` | Mismo patrón para el ciclo de vida, con campos cerrados |
| Resultados cerrados y textos; `parseMetaOAuthOutcome` | `meta/outcomes.ts:9-61` | Se amplía la lista; `reautorizacion_no_disponible` deja de existir |
| `readLiveConnection` lee `id, status, credential_generation` bajo RLS, filtrando por `company_id` de K01 | `repository/connections.ts:21-63` | La pantalla y la confirmación necesitan el registro K03 completo: lectura nueva en el mismo archivo |
| `prepareReplaceCredential`/`replaceCredential` con `connectionId` y `attemptId`; `readCredential` descifra y recifra según estado; `CredentialNotFoundError` si la conexión no tiene credencial | `repository/credentials.ts:28`, `:167-178`, `:217-222`, `:247-308`, `:56-59` | La reautorización y la revocación los reutilizan sin cambios |
| `WorkerApiFunction` incluye `confirm_connection`, `replace_credential`, `mark_needs_reauth`, `begin_disconnect`, `purge_connection`, `list_pending_purges`; traducción `PX001`…`PX008` | `db/worker-api.ts:9-13`, `:63-76`, `:120-142` | Los envoltorios nuevos usan el cliente tal cual |
| `get_credential` responde también en `disconnected`; cero filas si no hay credencial | `0012_integrations.sql:806-861` | La revocación de CA-38 puede leer la credencial después de `begin_disconnect` |
| `confirm_connection`: exige `p_probe_succeeded = true`, valida formato de moneda y zona contra `pg_timezone_names`, `PX005` si la pendiente venció, reintento idempotente solo con generación 0 | `0012_integrations.sql:865-960` (`:888-896`, `:911-931`) | El servidor valida la moneda con K03 antes de llamar (`H-E1-28`); la zona puede fallar en la base aunque `Intl` la acepte (H-S-09) |
| `replace_credential`: exige un intento `reauth` consumido hace 10 minutos o menos, del mismo actor y con la conexión esperada; `PX004` fuera de `active`/`needs_reauth`; `PX006` con otra generación; incrementa la generación y deja `active` | `0012_integrations.sql:966-1114` (`:1022-1034`, `:1063-1069`, `:1089-1093`) | La reautorización completa se hace en la misma petición del callback |
| `mark_needs_reauth`: solo `authentication`, `user_action`, `permission`, `asset_access`; generación esperada; mensaje de 1 a 500 caracteres | `0012_integrations.sql:1119-1203` (`:1144`) | No existe función para registrar las demás clases (`H-E1-22`) |
| `begin_disconnect`: desde cualquier estado vivo a `disconnected`, incrementa la generación, fija `purge_requested_at`; idempotente | `0012_integrations.sql:1206-1270` | Primer paso de CA-38 y CA-37b; cancela una pendiente sin inventar metadatos |
| `purge_connection`: `false` si no existe; `PX004` si no está `disconnected`; borra credencial y fila | `0012_integrations.sql:1277-1335` | Idempotente: repetirla no falla |
| `list_pending_purges`: pendientes vencidas y `disconnected`, con `has_credential` | `0012_integrations.sql:1340-1376` (`:1370`) | Fuente única de la purga perezosa |
| Tablas sin grants para `service_role`; solo `worker_api` escribe | `0012_integrations.sql:26-28`, `:444-467` | En `test:app` no se puede adelantar `pending_expires_at`: el vencimiento real se prueba en pgTAP `09b` y con `worker_api` simulado en unitarias |
| pgTAP `09b` ya prueba transiciones, pendiente → desconectada sin metadatos, confirmación vencida, `replace_credential` con generación vieja, purga idempotente y reconexión | `supabase/tests/09b_integration_lifecycle.test.sql:1-17`, `:600-760` | `test:policies` se corre como regresión; no se agrega pgTAP |
| K03: `currencyCodeSchema` (ISO 4217 por `Intl`), `timeZoneSchema`, `externalAccountIdSchema`, `maskExternalAccountId` (últimos 4 si el id tiene más de 8 caracteres), registro y DTO separados; `toConnectionDto` sin consumidores | `contract/connection.ts:23-52`, `:150-190` | La pantalla usa el DTO; el id completo no sale del servidor (CA-40) |
| `/app/integraciones`: aviso `?meta=`, tarjetas del mock, "Conectar" deshabilitado | `src/app/(app)/app/integraciones/page.tsx:20-94` | El paso 8 reemplaza la tarjeta de Meta Ads por el estado real |
| Mock de integraciones y chip "… conectado" del layout | `src/modules/app-data/mock.ts:10-29`, `src/modules/app-data/index.ts:86-89`, `src/app/(app)/app/layout.tsx:38-48` | Fuera de los archivos de II.10 (D-M16.2-02) |
| `app-paginas-sesion.test.tsx` importa cada `page.tsx` de `/app`, exige exactamente siete pantallas y simula solo `app-data` y las acciones existentes | `tests/component/app-paginas-sesion.test.tsx:18-35`, `:59-69` | Una página nueva rompe el conteo; un import nuevo con `server-only` rompe la importación (D-M16.2-01) |
| `integraciones-meta-aviso.test.tsx` exige "Conectar sigue deshabilitado" | `tests/component/integraciones-meta-aviso.test.tsx:80-83` | Deja de ser cierto (D-M16.2-01) |
| Pruebas de M16.1 que fijan el comportamiento que cambia: T-10 (inicio sin ninguna llamada a `worker_api`), T-21 y T-33 (`reautorizacion_no_disponible`), T-32 | `tests/unit/meta-oauth.test.ts:663-676`, `:1143-1161`; `tests/app/meta-oauth.test.ts:305-315`, `:356-414` | Hay que modificarlas (D-M16.2-01) |
| `server-only` no está simulado en el proyecto `component`; sí en `tests/app` | `tests/component/setup.ts:1-8`; `tests/app/meta-oauth.test.ts:32` | Las pruebas de componente nuevas simulan los módulos del servidor |
| Patrones del recorrido del árbol (`EAA…`, `?code=` de 20 o más, etc.) | `tests/unit/no-secrets-in-tree.test.ts:11-20` | Fixtures sintéticos cortos, como en M16.1 |
| Scripts: `test:unit`, `test:component`, `test:app`, `test:policies`, `db:check:test`, `verify` | `package.json:14-26` | Comandos de "Verificación" |
| `SECURITY.md` §7 y §9 marcan previstos el reemplazo por reautorización, la revocación y la orquestación de la purga | `docs/SECURITY.md:263-265`, `:295` | Pasan a vigentes (D-M16.2-01) |
| `ARCHITECTURE.md` marca previstos el ciclo de vida, el listado, la prueba de acceso y la revocación | `docs/ARCHITECTURE.md:65-67`, `:86`, `:196`, `:225-226`, `:283-284` | Ídem |
| Comentario de `purge_connection` que nombra `0013` y `0014` (desactualizado por I.5) | `0012_integrations.sql:1276` | No se toca (CB-03); solo informativo |

Contradicciones o supuestos de la ruta original que el código obligó a precisar (decididos en el grill y resueltos por las enmiendas aprobadas de la ruta):

- II.10 original no autorizaba todos los archivos que el cambio de comportamiento obliga a tocar: pruebas existentes, pruebas nuevas, los dos documentos transversales, `app-data` y el script de preflight. II.10 enmendada los enumera (D-M16.2-01 y -05).
- El chip "Meta Ads conectado" y el resto de las pantallas leen el mock de `app-data`; II.10 enmendada autoriza conectarlo al estado real (D-M16.2-02).
- La documentación de Meta describe la revocación solo por `GET` con el token y el secreto en la consulta, lo que contradice D-M16.1-08; y `debug_token` solo por `GET` (D-M16.2-03, `H-E1-114`, `H-E1-116`).
- La ruta prevé registrar la clase de los errores que no llevan a `needs_reauth`, y la base no tiene función para eso ni M16.2 tiene migración (D-M16.2-07, `H-E1-22`).
- La sección 14 original de la spec de la ruta pedía en `test:app` "revocación y desconexión durante una sincronización", que no existe hasta `M16c`. La enmienda aprobada la asigna a `M16c` (A-09), donde la ruta prevé esas escrituras.

## Diseño concreto

Las decisiones no materiales que tomé están marcadas **(decisión)** con su motivo. Las partes que dependen de una pregunta abierta citan su ID; el diseño describe la opción recomendada.

### 1. Archivos y responsabilidades

```
src/modules/integrations/meta/
  accounts.ts    listado paginado de cuentas delegadas (server-only)            — nuevo, paso 1
  probe.ts       consulta de prueba de Insights y su resumen (server-only)      — nuevo, paso 3
  revoke.ts      revocación del token (server-only)                              — nuevo, paso 6
  errors.ts      + efecto de cada clase sobre la conexión (puro)                 — paso 7
  api.ts         + `revoke_token` entre los parámetros prohibidos                — paso 6
  client.ts      + `postBatchGetJson` (una operación `GET` por lote)             — paso 6 (D-M16.2-03)
  tokens.ts      + `fetchSystemUser`; `inspectToken` por lote                    — pasos 1 y 6 (D-M16.2-03)
  oauth.ts       purga al iniciar; camino `reauth` completo; recuperación B      — pasos 4 y 5
  outcomes.ts    lista cerrada ampliada                                          — pasos 2, 5, 6 y 8
src/modules/integrations/
  lifecycle.ts   purga perezosa, estado de la tarjeta, confirmación, desconexión,
                 reautorización y efecto de errores (server-only)                — nuevo, pasos 3 a 5 y 7
  actions.ts     Server Actions `confirmarCuentaMeta` y `desconectarMeta`        — nuevo, paso 6
src/modules/integrations/repository/
  connections.ts + `readConnectionRecord` (registro K03 bajo RLS)                — pasos 2 y 8
  lifecycle-calls.ts  envoltorios de `worker_api` del ciclo de vida (server-only) — nuevo, pasos 3, 4, 6 y 7
src/app/(app)/app/integraciones/
  page.tsx       tarjeta real de Meta Ads                                        — pasos 2 y 8
  meta-tarjeta.tsx  presentación de cada estado (componente de servidor)        — nuevo, pasos 2 y 8
src/modules/app-data/
  index.ts       `getIntegraciones` con el estado real de `meta_ads`            — paso 8 (D-M16.2-02)
scripts/
  meta-preflight.mjs  preflight de `debug_token` por lote con el token de la app — paso 6 (D-M16.2-05)
```

**(decisión)** Los archivos nuevos o modificados dentro de `src/modules/integrations/` son ubicaciones del mismo módulo, que el preámbulo de la Parte II y III.9 no cuentan como desvío (como hizo M16.1 con `outcomes.ts`, `attempts.ts` y `connections.ts`). La selección de cuenta vive en `/app/integraciones` y no en una ruta nueva: una página nueva cambia el conteo de siete pantallas de `app-paginas-sesion.test.tsx:59-69` y el `return_path` de la allowlist es solo `/app/integraciones` (`contract/primitives.ts:91`).

### 2. `api.ts`

`GRAPH_URL_FORBIDDEN_PARAMS` suma `'revoke_token'`. Ningún otro cambio. Como el cliente HTTP usa la misma lista (`client.ts:46-48`), una URL de salida con `revoke_token` se rechaza antes de enviar.

### 2b. `client.ts`: solicitud por lote (D-M16.2-03)

```ts
postBatchGetJson(
  relativePath: string,                                   // 'debug_token' u 'oauth/revoke'
  query: Record<string, string | SecretValue>,            // va dentro de relative_url, en el cuerpo
  accessToken: SecretValue,                               // va como campo `access_token` del cuerpo
): Promise<unknown>;                                       // el cuerpo de la operación, ya parseado
```

- Envía `POST` a `graphUrl('')` (`https://graph.facebook.com/v26.0/`, sin consulta) con `Content-Type: application/x-www-form-urlencoded` y dos campos: `access_token` y `batch` = `[{"method":"GET","relative_url":"<relativePath>?<query codificada>"}]`. Los `SecretValue` se revelan solo al armar el cuerpo. La URL de salida pasa por las mismas guardas de origen y parámetros prohibidos que `getJson` y `postFormJson`, con las mismas opciones de `redirect`, `cache`, `signal` y timeout, y sin reintentos.
- `relativePath` se valida contra una lista cerrada (`debug_token`, `oauth/revoke`); cualquier otro valor lanza sin `fetch`.
- La respuesta externa se lee con el mismo `readJson` de hoy (`client.ts:61-78`): texto ilegible o JSON inválido → transporte; un objeto con `error` → `classifyGraphError`; no 2xx sin `error` → `unknown`.
- Después, tiene que ser un arreglo de exactamente un elemento. Un arreglo con otra cantidad, o un elemento que no es objeto con `code` numérico y `body` cadena → `MetaApiError` `unknown`. Un `null` en el arreglo → `MetaApiError` `transport` (CA-39). **(decisión)** Graph usa `null` para una operación que no completó, típicamente por tiempo. No trae código de Graph, así que no es `temporary`, que CA-39 reserva para los códigos 1 y 2.
- `body` se parsea como JSON. Si es ilegible → `transport`, igual que `readJson` (CA-39: "respuesta ilegible"). Un cuerpo con `error` se clasifica con `classifyGraphError`, igual que una respuesta directa. Un `code` fuera de 2xx sin `error` en el cuerpo → `unknown`.
- Ni la URL ni el cuerpo, ni el `relative_url`, llegan a un error o a un registro (igual que `postFormJson`).

### 3. `tokens.ts`

```ts
export type SystemUser = Readonly<{ id: string; clientBusinessId: string }>;
export async function fetchSystemUser(token: SecretValue, deps: { http: MetaHttpClient }): Promise<SystemUser>;
export async function fetchClientBusinessId(token: SecretValue, deps: { http: MetaHttpClient }): Promise<string>; // = (await fetchSystemUser(...)).clientBusinessId
```

`fetchSystemUser` hace la **misma** petición que hoy (`GET graphUrl('me', { fields: 'id,client_business_id' })` con `bearer`). `id`: cadena `^[0-9]{1,32}$` (o número entero convertido a cadena), si no `TokenRejectedError('missing_business')`. `client_business_id`: `clientBusinessIdSchema`, igual que hoy. **(decisión)** Reutilizar la petición existente evita una llamada y no cambia la forma que M16.1-T-40 fija para `/me`.

`inspectToken` (D-M16.2-03): cambia solo el transporte. En lugar de `postFormJson(graphUrl('debug_token'), …)` usa `postBatchGetJson('debug_token', { input_token: token }, appToken)`, con el token de la app como `access_token` del lote. La validación de `data` (`is_valid`, `app_id`, `ads_read`, `type`) y los motivos de `TokenRejectedError` no cambian. Las pruebas de M16.1 que fijan el `POST` directo a `debug_token` se adaptan (D-M16.2-01).

### 4. `accounts.ts` (paso 1; CA-35, CA-60, H-01)

```ts
import 'server-only';
export const ACCOUNTS_PAGE_LIMIT = 100;
export const ACCOUNTS_MAX_PAGES = 10;
export type DelegatedAccount = Readonly<{
  id: string;            // `act_<dígitos>`, completo: solo en el servidor
  name: string | null;   // recortado, hasta 200 caracteres; nunca se registra
  currency: string;      // currencyCodeSchema (H-E1-28)
  timezone: string;      // timeZoneSchema
}>;
export type DelegatedAccounts = Readonly<{ accounts: readonly DelegatedAccount[]; discarded: number; pages: number }>;
export class AccountListLimitError extends Error {} // mensaje fijo, sin datos
export async function listDelegatedAccounts(
  token: SecretValue,
  systemUserId: string,
  deps: { http: MetaHttpClient },
): Promise<DelegatedAccounts>;
```

- Petición: `GET graphUrl(`${systemUserId}/assigned_ad_accounts`, { fields: 'id,name,currency,timezone_name', limit: '100', after? })` con `bearer`. `systemUserId` validado con `^[0-9]{1,32}$` antes de armar la ruta.
- Paginación: mientras la respuesta traiga `paging.next` **y** `paging.cursors.after` (cadena no vacía de hasta 2048 caracteres), pide la página siguiente con ese `after`. Nunca lee, guarda ni registra `paging.next`: puede llevar el token (trampa 2 de II.11, aplicada por analogía). Sin `paging.next` termina. Más de `ACCOUNTS_MAX_PAGES` páginas → `AccountListLimitError`.
- Cada elemento de `data` se valida: `id` con `^act_[0-9]{1,60}$` (que además cumple `externalAccountIdSchema`), `currency` con `currencyCodeSchema`, `timezone_name` con `timeZoneSchema`. Uno que no valida no es seleccionable y suma a `discarded`; no se registra ni su id ni su nombre. Ids repetidos entre páginas se cuentan una vez.
- Respuesta sin `data` arreglo → `MetaApiError` de clase `unknown`.
- **(decisión)** `fields` agrega `id` a los tres que nombra el paso 1, porque `confirm_connection` necesita el identificador. **(decisión)** El límite de 10 páginas de 100 cuentas es una barrera de duración, no un criterio de negocio; un dueño piloto delega una cuenta (DEC-01). La clave de selección del formulario no la calcula este archivo: la arma `lifecycle.ts` ligada a la pendiente (§9.3, D-M16.2-08).

### 5. `probe.ts` (paso 3; CA-37, VR-01)

```ts
import 'server-only';
export const PROBE_MAX_PAGES = 5;
export const PROBE_FIELDS = ['date_start', 'date_stop', 'spend', 'impressions'] as const;
export type ProbeSummary = Readonly<{
  rows: number;
  fieldsPresent: readonly (typeof PROBE_FIELDS)[number][];
  pages: number;
  calls: number;
  complete: boolean;     // false si cortó por PROBE_MAX_PAGES
  durationMs: number;
}>;
export async function probeInsights(
  token: SecretValue,
  accountId: string,
  deps: { http: MetaHttpClient; now: () => number },
): Promise<ProbeSummary>;
```

- Petición: `GET graphUrl(`${accountId}/insights`, { level: 'account', fields: 'spend,impressions', time_increment: '1', date_preset: 'last_28d', limit: '100', after? })` con `bearer`. `accountId` validado con `^act_[0-9]{1,60}$`.
- Éxito: la primera página es 2xx con `data` arreglo, aunque esté vacío (una cuenta sin actividad prueba igual el acceso). Pagina con `paging.cursors.after` como en §4, hasta `PROBE_MAX_PAGES`.
- Cada fila se mira solo para contar y para saber qué campos de `PROBE_FIELDS` trae con valor no nulo. Ningún valor sale de la función, se guarda, se registra ni se devuelve (CA-40, CA-26).
- Errores: `MetaApiError` de cualquier clase → el probe falla y la conexión no se activa (CA-37).
- **(decisión)** 28 días diarios a nivel cuenta es la relectura inicial de CA-47b: así VR-01 mide páginas, llamadas y duración representativas para Q-04 (paso 11) con la misma forma que usará `M16c`, sin persistir nada. `date_preset` evita calcular fechas en la zona de la cuenta, que es trabajo de `M16c`.

### 6. `revoke.ts` (paso 6; H-03, `H-E1-114`; D-M16.2-03)

```ts
import 'server-only';
export type RevokeResult = Readonly<{ status: 'revoked' } | { status: 'failed'; errorClass: IntegrationErrorClass }>;
export async function revokeToken(
  token: SecretValue,
  deps: { http: MetaHttpClient; config: MetaOAuthConfig },
): Promise<RevokeResult>;
```

- `postBatchGetJson('oauth/revoke', { client_id, client_secret (SecretValue), revoke_token: token }, token)`: la operación es el `GET` documentado, pero viaja dentro del cuerpo del lote; el `access_token` del lote es el mismo token (H-S-20). La URL de salida es `https://graph.facebook.com/v26.0/` sin consulta. Cuerpo de la operación con `success === true` o `success === 'true'` → `revoked`; cualquier otra forma → `failed` con `unknown`.
- Nunca lanza: un `MetaApiError` da `failed` con su clase; cualquier otra excepción (incluido `MetaRequestRejectedError`), `failed` con `unknown`. Sin reintentos.
- No existe un camino por `GET` directo con el token en la URL (D-M16.1-08), ni un `POST` directo a `oauth/revoke`.

### 7. `errors.ts`: efecto sobre la conexión (paso 7; CA-39)

```ts
export type ConnectionEffect = 'needs_reauth' | 'unchanged';
export function connectionEffectFor(errorClass: IntegrationErrorClass): ConnectionEffect;
export const NEEDS_REAUTH_TEXTS: Readonly<Record<'authentication' | 'user_action' | 'permission' | 'asset_access', string>>;
```

| Clase | Efecto | Texto en la UI (`needs_reauth`) |
|---|---|---|
| `authentication` | `needs_reauth` | "Meta rechazó la credencial. Volvé a autorizar a Praxa." |
| `user_action` | `needs_reauth` | "Meta pide que vuelvas a autorizar desde tu cuenta de Facebook." (mensaje específico, CA-39) |
| `permission` | `needs_reauth` | "Meta retiró el permiso de lectura de anuncios (ads_read). Volvé a autorizar." (indica el permiso) |
| `asset_access` | `needs_reauth` (la clase no se asigna hasta tener evidencia de H-04) | "Meta retiró el acceso a la cuenta publicitaria. Volvé a autorizar." |
| `rate_limit`, `temporary`, `transport`, `own_error`, `unknown` | `unchanged` | — (se muestra el resultado de la operación, no un estado) |

`classifyGraphError` no cambia: `asset_access` sigue sin asignarse.

### 8. Repositorios

`repository/connections.ts` suma:

```ts
export async function readConnectionRecord(ctx: TenantContext, deps?: { supabase?: SupabaseClient }): Promise<IntegrationConnectionRecord | null>;
```

Lee con el cliente del usuario las columnas de K03 de la conexión **viva** de la empresa (`status in (pending_selection, active, needs_reauth)`, filtro `company_id = ctx.company_id`) con `maybeSingle()` y valida con `integrationConnectionRecordSchema`; error de PostgREST o fila inválida → `ConnectionReadError` con su mensaje fijo. **(decisión)** Lectura por RLS, no por `worker_api`, por la misma razón que `readLiveConnection` (DEC-04; `connections.ts:9-13`).

`repository/lifecycle-calls.ts` (`server-only`): un envoltorio por función, con K01 validado (`tenantContextSchema`), ids con `uuidSchema` y la respuesta validada como en `credentials.ts` (exactamente las columnas de cada función):

```ts
export async function confirmConnection(ctx, input: { connectionId: string; externalAccountId: string; currency: string; timezone: string }, deps?): Promise<{ connectionId: string; status: 'active'; credentialGeneration: number }>;
export async function markNeedsReauth(ctx, input: { connectionId: string; expectedGeneration: number; errorClass: ReauthErrorClass; message: string }, deps?): Promise<{ connectionId: string; status: 'needs_reauth'; credentialGeneration: number }>;
export async function beginDisconnect(ctx, connectionId: string, deps?): Promise<{ connectionId: string; credentialGeneration: number }>;
export async function purgeConnection(ctx, connectionId: string, deps?): Promise<boolean>;
export type PendingPurge = Readonly<{ connectionId: string; status: 'pending_selection' | 'disconnected'; reason: 'pending_expired' | 'disconnect_requested'; hasCredential: boolean }>;
export async function listPendingPurges(ctx, deps?): Promise<readonly PendingPurge[]>;
```

- `confirmConnection` siempre envía `p_probe_succeeded = true`: solo se llama después de un probe exitoso (§9.3). Valida antes `currencyCodeSchema` y `timeZoneSchema` (`H-E1-28`).
- `markNeedsReauth` exige `message` que valide con `redactedErrorMessageSchema` (CA-09); el llamador pasa `MetaApiError.redactedMessage`.
- Errores de `worker_api` se propagan como `WorkerApiError` con su código (`pending_expired`, `invalid_transition`, `generation_mismatch`, `account_conflict`, `invalid_argument`, …).

### 9. `lifecycle.ts`

```ts
import 'server-only';
export type LifecycleDeps = {
  tenant: () => Promise<TenantContext>;            // requireTenantContext
  config: () => MetaOAuthConfig;                    // getMetaOAuthConfig
  http: MetaHttpClient;                             // createMetaHttpClient()
  workerApi: () => WorkerApi;                       // getWorkerApi(), perezoso
  keyring: () => CredentialKeyring;                 // getCredentialKeyring(), perezoso
  readConnection: (ctx) => Promise<IntegrationConnectionRecord | null>; // readConnectionRecord
  now: () => Date;
  log: (event: MetaLifecycleLogEvent) => void;      // console.info(JSON.stringify(event))
};
export const PURGE_MAX_PER_RUN = 5;
```

#### 9.1 Registro

```ts
export type MetaLifecycleLogEvent = {
  evento: 'meta_ciclo';
  etapa: 'purga' | 'revocacion' | 'listado' | 'prueba' | 'confirmacion' | 'desconexion' | 'reauth' | 'error_conexion' | 'estado';
  resultado: 'ok' | 'fallida' | 'sin_credencial' | 'sin_credencial_legible' | 'omitida' | MetaOAuthOutcome;
  clase?: IntegrationErrorClass;
  request_id?: string;
  // Solo en `prueba` (VR-01 y Q-04):
  filas?: number; campos?: string[]; paginas?: number; llamadas?: number; completa?: boolean; duracion_ms?: number;
  // Solo en `listado`:
  cuentas?: number; descartadas?: number;
};
```

Ningún otro campo. Nunca: tokens, código, `state`, hashes, URLs, ids de cuenta, de negocio o de system user, nombres de cuenta, montos ni impresiones.

#### 9.2 `runLazyPurge(ctx, deps?)` (paso 4; CA-37b, CA-38, DEC-17)

```ts
export async function runLazyPurge(ctx: TenantContext, deps?: Partial<LifecycleDeps>): Promise<{ purged: number; revokeFailed: number; remaining: boolean }>;
```

1. `listPendingPurges(ctx)`; toma como mucho `PURGE_MAX_PER_RUN`, en el orden de la función.
2. Por cada una, en este orden fijo:
   1. si `status = 'pending_selection'` (vencida) → `beginDisconnect` (bloqueo; CA-37b paso 1, sin metadatos, CA-08);
   2. si `hasCredential` → `readCredential(ctx, id)` → `revokeToken(token)`; registra `revocacion` con `ok` o `fallida` y la clase. `CredentialNotFoundError` → `sin_credencial`. Cualquier otro error de lectura o descifrado (por ejemplo, versión de clave ausente) → `sin_credencial_legible`, sin revocar;
   3. `purgeConnection` siempre, aunque la revocación haya fallado (trampa 1 de II.10).
3. Un error de `worker_api` en una conexión corta esa conexión y sigue con la siguiente; queda para la próxima corrida (reanudable).
4. `remaining = true` si la lista tenía más de `PURGE_MAX_PER_RUN` o alguna conexión no terminó.
5. Si `config()` falla, no hay revocación posible: se registra `revocacion fallida` con `own_error` y se purga igual.

Se llama desde: `handleMetaStart` (antes de leer la conexión viva), la carga de la tarjeta (§9.3) y `desconectarMeta` (§10). En los tres, un error de la purga se registra (`purga fallida`) y **no** corta el flujo: la base sigue siendo la autoridad (`create_oauth_attempt` y `confirm_connection` vuelven a verificar).

**(decisión)** `PURGE_MAX_PER_RUN = 5` acota la duración de una petición con revocaciones de 10 s de timeout; la regla de una conexión viva por empresa deja como mucho una pendiente más las desconectadas sin terminar.

#### 9.3 Estado de la tarjeta y confirmación (pasos 2 y 3; CA-35 a CA-37, CA-40)

```ts
export type AccountOption = Readonly<{ selectionKey: string; name: string | null; maskedId: string; currency: string; timezone: string }>;
export type MetaCardState =
  | { kind: 'sin_empresa' }
  | { kind: 'sin_conexion' }
  | { kind: 'pendiente'; pendingExpiresAt: string; accounts: readonly AccountOption[]; discarded: number; listError: MetaOAuthOutcome | null }
  | { kind: 'activa'; maskedId: string; currency: string; timezone: string }
  | { kind: 'requiere_reauth'; maskedId: string; currency: string; timezone: string; errorClass: ReauthErrorClass }
  | { kind: 'error' };
export async function loadMetaCardState(deps?: Partial<LifecycleDeps>): Promise<MetaCardState>;
export async function confirmAccount(selectionKey: string, deps?: Partial<LifecycleDeps>): Promise<MetaOAuthOutcome>;
```

`loadMetaCardState`:

1. `tenant()`: `NoCompanyError` → `sin_empresa`; cualquier otro error, incluido `UnauthorizedError` → `error`. La página ya llamó a `requireAppSession` antes, así que una sesión ausente redirige ahí y no llega acá.
2. `runLazyPurge(ctx)` (best effort).
3. `readConnection(ctx)` → `toConnectionDto` para los datos visibles (cuenta truncada con `maskExternalAccountId`). `null` → `sin_conexion`.
4. `pending_selection` **y** `pending_expires_at > now()`: `readCredential` → `fetchSystemUser` → `listDelegatedAccounts` → `AccountOption[]` (sin el id completo), con `selectionKey = selectionKeyFor(connectionId, account.id)`: SHA-256 hex de `` `${connectionId}:${account.id}` `` (D-M16.2-08). El UUID de la conexión nunca llega al HTML, así que la clave no se puede invertir por fuerza bruta sobre los dígitos del id, y una clave de otra pendiente no coincide con ninguna cuenta. Un error en esta cadena deja `accounts: []` y fija `listError` (A-05):
   - `MetaApiError` de `/me` o del listado: `token_no_valido` para `own_error`, `authentication`, `user_action`, `permission` y `asset_access`; `meta_no_disponible` para `transport`, `temporary`, `rate_limit` y `unknown`;
   - `TokenRejectedError` de `fetchSystemUser`: `token_no_valido`;
   - `AccountListLimitError`: `meta_no_disponible`;
   - error de `readCredential`: `listError: 'error'`. La tarjeta sigue en `kind: 'pendiente'`, sin cuentas y con "Cancelar conexión"; no pasa a `kind: 'error'` (A-17). **(decisión)** Una pendiente ya vencida que la purga no alcanzó se muestra como `pendiente` con `accounts: []` y `listError: 'pendiente_vencida'`, y no como `sin_conexion`, para no habilitar "Conectar" mientras la base todavía tiene la fila viva (`create_oauth_attempt` daría `PX003`).
5. `active` → `activa`; `needs_reauth` → `requiere_reauth` con `last_error.class`.

`confirmAccount(selectionKey)`:

1. `selectionKey` con `sha256HexSchema`; si no valida → `cuenta_invalida` sin llamar a nada.
2. `tenant()`: `UnauthorizedError` se deja pasar (la acción redirige al login); `NoCompanyError` → `sin_empresa`; cualquier otro error → `error`. `readConnection`: si no es `pending_selection` → `conexion_cambio`; si `pending_expires_at <= now()` → `pendiente_vencida`, sin llamar a Meta ni escribir. **No ejecuta `runLazyPurge`**: al confirmar una pendiente vencida debe poder informar ese resultado antes de que la purga borre la fila. La siguiente carga de la tarjeta ejecuta la purga según §9.2. Si llega de nuevo el formulario después de una confirmación exitosa, la conexión ya está `active` y responde `conexion_cambio`, sin repetir probe ni escritura.
3. `readCredential` → `fetchSystemUser` → `listDelegatedAccounts` con la credencial guardada. La elección se resuelve **en el servidor** comparando `selectionKey` con `selectionKeyFor(connectionId, cuenta.id)` de la pendiente actual; ninguna moneda, zona o cuenta enviada por el navegador se usa (CA-36, INV-01). Sin coincidencia → `cuenta_invalida`, sin probe ni confirmación. Los errores de esta cadena dan el mismo resultado que en `loadMetaCardState` paso 4, devuelto como resultado de la acción, sin probe ni `confirm_connection`.
4. `probeInsights(token, cuenta.id)`. Falla → `prueba_fallida` (clases `own_error`, `authentication`, `user_action`, `permission`) o `meta_no_disponible` (resto), sin llamar a `confirm_connection` (CA-37). La conexión sigue `pending_selection` (CA-39 no cambia el estado de una pendiente). Éxito → registra `prueba ok` con `filas`, `campos`, `paginas`, `llamadas`, `completa`, `duracion_ms`.
5. `confirmConnection(ctx, { connectionId, externalAccountId: cuenta.id, currency, timezone })`. Un fallo de transporte o timeout **de esta llamada** se reintenta una vez con los mismos argumentos (la función SQL es idempotente para la misma confirmación, `0012_integrations.sql:911-923`); esto no vuelve idempotente el reenvío posterior del formulario, que se corta en el paso 2. `pending_expired` → `pendiente_vencida` (CA-37: la base decide aunque el servidor haya visto la pendiente vigente); `invalid_transition` o `not_authorized` → `conexion_cambio`; `account_conflict` o `invalid_argument` → `cuenta_invalida` (incluye una zona que `Intl` acepta y `pg_timezone_names` no, H-S-09); otro → `error`.
6. Éxito → `conectado`.

#### 9.4 `disconnect(deps?)` (paso 6; CA-38, DEC-09)

```ts
export type DisconnectOutcome = Extract<MetaOAuthOutcome, 'desconectado' | 'desconexion_en_curso' | 'sin_empresa' | 'error'>;
export async function disconnect(deps?: Partial<LifecycleDeps>): Promise<DisconnectOutcome>;
```

1. `tenant()`: `UnauthorizedError` se deja pasar (la acción redirige al login); `NoCompanyError` → `sin_empresa`; cualquier otro error → `error`. Después, `readConnection`; un `ConnectionReadError` → `error`. Con conexión viva → `beginDisconnect(ctx, id)` (CA-38 paso 1: desde acá no hay llamadas nuevas a Meta salvo la revocación).
2. `runLazyPurge(ctx)` hace los pasos 2 y 3 de CA-38 para esta conexión y para cualquier `disconnected` previa (repetir la desconexión reanuda la purga).
3. Resultado `desconectado` si `remaining` es `false`; si quedó algo, `desconexion_en_curso`. Sin conexión viva ni nada para purgar → `desconectado` (idempotente). Un `WorkerApiError` de `beginDisconnect` → `error`, sin purgar. **(decisión)** Sin el paso 1 de CA-38 no hay garantía de que no se hagan llamadas nuevas a Meta, así que no se revoca ni se purga.

#### 9.5 Reautorización (paso 5; CA-37c, CA-29b)

```ts
export type ReauthDeps = Readonly<{
  http: MetaHttpClient;
  config: () => MetaOAuthConfig;
  workerApi: () => WorkerApi;
  keyring: () => CredentialKeyring;
  readConnection: (ctx: TenantContext) => Promise<IntegrationConnectionRecord | null>;
  log: (event: MetaLifecycleLogEvent) => void;   // las líneas `revocacion` del caso B
}>;
export type ReauthResult = Readonly<{
  outcome: MetaOAuthOutcome;
  etapa: MetaOAuthLogEvent['etapa'];             // `import type` desde `meta/oauth.ts`: no crea dependencia en tiempo de ejecución
  clase?: IntegrationErrorClass;
  motivo?: TokenRejectionReason;
}>;
export async function completeReauth(
  ctx: TenantContext,
  attempt: ConsumedAttempt,          // propósito 'reauth', con expectedConnectionId y expectedGeneration
  code: string,
  deps: ReauthDeps,
): Promise<ReauthResult>;
```

`handleMetaCallback` arma `ReauthDeps` desde sus propias dependencias resueltas (`oauth.ts:78-95`) y registra la línea `meta_oauth` con `etapa`, `clase` y `motivo` del resultado. `ReauthDeps` es un tipo nuevo y explícito: el tipo privado `Resolved` de `oauth.ts` no se exporta. `etapa` del resultado (A-17): `canje`, `inspeccion` o `negocio` para los fallos de esas llamadas, como en `initial`; `reauth` para todo lo demás (lectura de la conexión, listado, cuenta no delegada, reemplazo, escritura ambigua y éxito). La lista cerrada de `MetaOAuthLogEvent['etapa']` no cambia.

**Dirección de dependencias (A-05).** `meta/oauth.ts` importa de `lifecycle.ts` (`runLazyPurge`, `completeReauth`) y de `meta/revoke.ts`. `lifecycle.ts` **no** importa en tiempo de ejecución nada de `meta/oauth.ts`; solo puede usar `import type`. Para eso se mueven dos piezas compartidas:
- `exchangeCodeForToken` pasa de `oauth.ts` a `meta/tokens.ts`, sin cambios de firma ni de comportamiento. Ningún archivo fuera de `oauth.ts` la importa hoy.
- `metaOutcome` (`oauth.ts:174-179`) pasa a `meta/errors.ts` como `export function rejectionOutcomeFor(errorClass: IntegrationErrorClass): 'rechazado' | 'meta_no_disponible'`, con el mismo conjunto de clases. `oauth.ts` y `lifecycle.ts` la usan.

Lo llama `handleMetaCallback` en lugar del bloque de `oauth.ts:348-355`, después del consumo:

1. `readConnection(ctx)`: sin conexión viva, otro `id` o otra generación → `credencial_cambio` **sin canjear** (igual que M16.1: no queda un token sin guardar).
2. `config()`; `exchangeCodeForToken`; `inspectToken`; `fetchSystemUser`; `listDelegatedAccounts` con el token **nuevo**.
3. Si `external_account_id` de la conexión no está entre las delegadas → `revokeToken(nuevo)` y `cuenta_no_delegada`. Para cambiar de cuenta hay que desconectar (CA-37c).
4. `prepareReplaceCredential(ctx, { connectionId, attemptId: attempt.attemptId, token, …validado })` y `executePreparedCredentialOperation`, con un reintento único por transporte o timeout con la misma operación preparada (idempotente, `0012_integrations.sql:1036-1061`).
5. Respuestas de `replace_credential` (A-14):
   - `generation_mismatch` o `invalid_transition` (desconexión en curso, CA-38c) → `revokeToken(nuevo)` y `credencial_cambio`;
   - `not_authorized` (`PX001`: la conexión ya no existe porque una desconexión completa purgó la fila antes del reemplazo, `0012_integrations.sql:1010-1018`, o ya no pertenece al actor) → `revokeToken(nuevo)` y `credencial_cambio`;
   - `attempt_rejected` (pasaron más de 10 minutos desde el consumo) → `revokeToken(nuevo)` y `rechazado`;
   - cualquier otro `WorkerApiError` que no sea de transporte o timeout, o cualquier otra excepción → `revokeToken(nuevo)` y `error`. La escritura fue rechazada, así que no hay credencial nueva guardada;
   - **escritura ambigua** (el segundo intento también falla por transporte o timeout; puede haberse aplicado) → `resolveAmbiguousWrite` (§11).
6. Éxito → `reautorizado`: la conexión queda `active`, con la generación incrementada y sin error.
7. Errores del paso 2:
   - `MetaApiError` → `rejectionOutcomeFor(clase)`, igual que en `initial`;
   - `TokenRejectedError` → el mismo resultado que da `initial` para ese motivo (`oauth.ts:357-409`), con `motivo` en el resultado;
   - `AccountListLimitError` → `meta_no_disponible`.

   Si el canje ya funcionó, cualquiera de los tres aplica antes la recuperación del caso B (§11): una revocación del token nuevo.

**(decisión)** No se exige que el `client_business_id` del token nuevo coincida con el guardado: la autoridad de CA-37c es que la cuenta conectada siga delegada, y agregar otra condición ampliaría el criterio.

#### 9.6 Efecto de un error sobre una conexión existente (paso 7; CA-39)

```ts
export async function applyConnectionFailure(
  ctx: TenantContext,
  connection: { id: string; credentialGeneration: number },
  error: MetaApiError,
  deps?: Partial<LifecycleDeps>,
): Promise<ConnectionEffect>;
```

- `connectionEffectFor(error.errorClass) === 'needs_reauth'` → `markNeedsReauth(ctx, { connectionId, expectedGeneration, errorClass, message: error.redactedMessage })`. `generation_mismatch` o `invalid_transition` → no hace nada más (la conexión ya cambió) y devuelve `unchanged`.
- `unchanged` → no escribe en la base; registra `error_conexion` con la clase (D-M16.2-07). La persistencia de esa clase en la conexión se reasigna a `M16c` (`H-E1-22`).
- **Consumidores.** En M16.2 ninguna llamada a Meta usa la credencial de una conexión `active` o `needs_reauth` (el listado y el probe usan la de una pendiente; la reautorización usa un token nuevo; la revocación, una desconectada). La función se construye y se prueba acá porque el paso 7 lo exige, y la consume la sincronización de `M16c`.

### 10. `actions.ts` (paso 6; Server Actions)

```ts
'use server';
export async function confirmarCuentaMeta(formData: FormData): Promise<never>;  // lee solo `cuenta` (selectionKey)
export async function desconectarMeta(): Promise<never>;
```

- Cada una llama a `confirmAccount` o `disconnect` dentro de un `try` que solo calcula el resultado, y **después**, fuera del `try`, llama a `redirect('/app/integraciones?meta=<resultado>')` de `next/navigation`. `redirect` lanza internamente y no debe quedar capturado. K01 se construye adentro (trampa de II.2): ninguna recibe actor, empresa ni conexión.
- `UnauthorizedError` (que `confirmAccount` y `disconnect` dejan pasar) → `redirect('/login?next=%2Fapp%2Fintegraciones')`. `NoCompanyError` ya llega como resultado `sin_empresa`.
- Cualquier otra excepción no prevista → `meta=error`, sin el mensaje.
- El archivo solo exporta esas dos funciones `async` (regla de `'use server'`).

### 11. Recuperación de los casos A y B de `H-E1-114` (D-M16.2-04)

- **Caso A (falla el canje: rechazo del `POST`, transporte o código vencido).** No hay token que revocar. El callback termina en `rechazado` o `meta_no_disponible` como hoy, y el texto de esos dos resultados suma: "Si llegaste a autorizar en Meta, podés quitar a Praxa desde la configuración de tu negocio, en las integraciones o apps conectadas." El dueño puede reintentar: no se creó ninguna conexión.
- **Caso B (el canje funcionó y después falla `debug_token`, `/me`, el listado de la reautorización o la escritura en la base).** Para un fallo confirmado antes de guardar la credencial, el callback llama a `revokeToken` (por lote, §6) con el token nuevo **antes** de responder, una sola vez, y registra `revocacion ok` o `fallida` con la clase. No registra el token. Una escritura con resultado ambiguo sigue el procedimiento de relectura que se describe abajo: puede haberse guardado y, si se confirma, no se revoca. El resultado visible corresponde al fallo original o al éxito confirmado, según ese procedimiento.
- **Escritura ambigua en el caso B (A-14).** Si la escritura en la base (`replace_credential` en `reauth`, `create_pending_connection` en `initial`) falla por transporte o timeout también en su único reintento, puede haberse aplicado. Revocar sin más podría dejar una conexión con una credencial que Meta ya invalidó. Antes de revocar, el callback llama una sola vez a `resolveAmbiguousWrite(ctx, token, expectation, deps)` (en `lifecycle.ts`):

  ```ts
  type AmbiguousWriteExpectation =
    | Readonly<{ kind: 'initial' }>
    | Readonly<{ kind: 'reauth'; connectionId: string; expectedGeneration: number }>;
  type AmbiguousWriteResolution = 'applied' | 'not_applied' | 'unreadable';
  async function resolveAmbiguousWrite(
    ctx: TenantContext,
    token: SecretValue,
    expectation: AmbiguousWriteExpectation,
    deps: Pick<LifecycleDeps, 'readConnection' | 'workerApi' | 'keyring'>,
  ): Promise<AmbiguousWriteResolution>;
  ```

  `readCredential` recibe `deps.workerApi()` y `deps.keyring()`; no usa clientes por defecto en las pruebas. `applied` da el resultado de éxito sin revocar; `not_applied` y `unreadable` dan `error` tras una sola revocación. La función no registra ni devuelve el token ni su hash.

  1. Relee la conexión viva con el cliente del usuario (`readConnection`). En `reauth` busca la misma conexión, `active` y con generación `expectedGeneration + 1`. En `initial` busca una `pending_selection` de la empresa. Si existe, la lee con `readCredential` y compara la credencial con el token nuevo: SHA-256 de ambos y `timingSafeEqual`, sin registrar ninguno.
  2. Coinciden → la escritura se aplicó: no se revoca, y el resultado es el de éxito (`reautorizado` o `pendiente`). En `reauth`, se registra `meta_ciclo` con etapa `reauth` y resultado `ok`; en `initial`, el callback registra `meta_oauth` con etapa `pendiente` y resultado `pendiente`. No se duplican líneas para una misma operación.
  3. No hay conexión que cumpla la expectativa, o la credencial no coincide → la escritura no se aplicó: `revokeToken(nuevo)` y `error`, el mismo resultado que hoy da una escritura fallida en `initial` (`oauth.ts:399-410`).
  4. La relectura también falla → **(decisión)** se revoca igual y el resultado es `error`. Un token válido sin guardar es una exposición que el dueño solo puede cerrar a mano. Una credencial guardada pero revocada se corrige sola: la próxima llamada con ella da `authentication`, la conexión pasa a `needs_reauth` (CA-39) y el dueño vuelve a autorizar. Este caso queda declarado como límite (trampa 22).
- **Falla correlacionada.** Si Graph rechaza la vía por lote, falla `debug_token` (caso B) y probablemente también su revocación. Por eso el preflight (§19) prueba el lote antes de la primera autorización real.
- **En VR-01**, si cualquiera de los dos casos ocurre por un rechazo de la forma elegida (H-S-13, H-S-23, H-S-19) se frena: el usuario verifica con el dueño que la app quedó quitada de su negocio y decide cómo seguir antes de otra autorización real (`H-E1-116`).

### 12. Escrituras en vuelo (CA-38c)

**(decisión)** En M16.2 las escrituras que pueden terminar después de una desconexión son `confirm_connection`, `replace_credential` y `mark_needs_reauth`. Las tres rechazan en la base una conexión `disconnected` o con otra generación (`PX004`, `PX006`; `0012_integrations.sql:925-931`, `:1063-1069`, `:1173-1179`), así que no pueden reinsertar datos. La aplicación las traduce a `conexion_cambio` o `credencial_cambio` y revoca el token nuevo si lo había. `publish_snapshot` y `record_query`, que nombra CA-38c, no existen hasta `M16c` y `M25a.1`, cuyas fichas y pasos ya citan CA-38c (II.11 paso 2, II.12 paso 1). La "revocación y desconexión durante una sincronización" de la sección 14 de la spec de la ruta pasa a `M16c` con la enmienda de D-M16.2-01 (II.11 paso 9 suma la revocación, A-09); en M16.2 se prueba la desconexión durante una confirmación y durante una reautorización (T-30 y T-31).

### 13. `oauth.ts`: cambios

- `handleMetaStart`: después de validar la configuración y el origen de la URI, `runLazyPurge(ctx, { http, config, workerApi, keyring, log, now })` en modo mejor esfuerzo, con **sus propias** dependencias resueltas (A-17). Nunca se llama sin dependencias: así una prueba que inyecta Meta simulada no puede revocar contra Meta real. La misma regla vale dentro de `lifecycle.ts`: `loadMetaCardState` y `disconnect` pasan a `runLazyPurge` las dependencias que recibieron; después, `readLiveConnection` como hoy. Con una pendiente **vigente**, sigue respondiendo `pendiente_vigente` sin crear intento (D-M16.2-06).
- `handleMetaCallback`: el camino `reauth` delega en `completeReauth` (§9.5). El camino `initial` agrega la revocación del caso B (§11) cuando falla algo después de un canje exitoso.
- `MetaOAuthLogEvent` suma `motivo?: TokenRejectionReason` (lista cerrada) en `inspeccion` y `negocio`, para que VR-01 distinga H-02 (`unsupported_type`) de otros rechazos sin registrar datos. **(decisión)** Sin esto, H-S-04 no se podría diagnosticar con evidencia.
- `MetaOAuthDeps` suma `readConnection` y amplía `log` a `(event: MetaOAuthLogEvent | MetaLifecycleLogEvent) => void`, con el mismo registro por defecto (`console.info(JSON.stringify(event))`). Con eso `handleMetaCallback` arma `ReauthDeps` (§9.5).
- `exchangeCodeForToken` y `metaOutcome` salen de este archivo (§9.5, "Dirección de dependencias"). Las llamadas de `initial` usan las versiones movidas, sin cambio de comportamiento.

### 14. `outcomes.ts`

Se quita `reautorizacion_no_disponible`. Se suman `conectado`, `reautorizado`, `cuenta_no_delegada`, `cuenta_invalida`, `prueba_fallida`, `pendiente_vencida`, `conexion_cambio`, `desconectado` y `desconexion_en_curso`. Textos nuevos o cambiados (español rioplatense, sin datos):

| Resultado | Tono | Texto |
|---|---|---|
| `pendiente` (cambia) | ok | "Autorizaste a Praxa en Meta. Elegí la cuenta publicitaria y confirmala." |
| `pendiente_vigente` (cambia) | info | "Tenés una conexión con Meta pendiente de confirmar. Elegí la cuenta o cancelá la conexión." |
| `conectado` | ok | "Conectaste tu cuenta publicitaria de Meta." |
| `reautorizado` | ok | "Volviste a autorizar a Praxa en Meta." |
| `cuenta_no_delegada` | error | "La cuenta conectada ya no está entre las que compartiste con Praxa. Para usar otra cuenta, desconectá primero." |
| `cuenta_invalida` | error | "No pudimos usar esa cuenta. Elegí otra o volvé a intentarlo." |
| `prueba_fallida` | error | "Meta no dejó leer esa cuenta. La conexión no se activó." |
| `pendiente_vencida` | error | "La conexión pendiente venció. Volvé a conectar Meta." |
| `conexion_cambio` | error | "La conexión cambió mientras la confirmabas. Revisá su estado." |
| `desconectado` | ok | "Desconectaste Meta. Se borraron la credencial y los datos de la conexión de la base activa. Si el proyecto usa Supabase Pro, las copias nocturnas pueden conservarlos hasta 7 días." (CA-38b, D-M16.2-10) |
| `desconexion_en_curso` | info | "La desconexión no terminó. Se va a completar la próxima vez que abras esta página." |

`rechazado` y `meta_no_disponible` suman la oración del caso A (§11). El resto no cambia.

### 15. Pantalla (`page.tsx` y `meta-tarjeta.tsx`; pasos 2 y 8)

- `page.tsx`: `requireAppSession('/app/integraciones')` primero (sin cambios, `app-paginas-sesion`); después `searchParams` y el aviso como hoy; después `loadMetaCardState()` y `getIntegraciones()`. Las tarjetas del mock se muestran **sin** `meta_ads`; la de Meta Ads la arma `MetaTarjeta` con el estado real. **(decisión)** La tarjeta usa `loadMetaCardState` y no el `conectada` de `getIntegraciones`, porque necesita los seis estados y no un booleano (§20).
- `MetaTarjeta` (componente de servidor, sin JavaScript de cliente):
  - `sin_empresa`: "Primero completá los datos de tu empresa en Configuración." con enlace a `/app/configuracion`; sin "Conectar".
  - `sin_conexion`: `<form method="post" action="/api/integraciones/meta/iniciar">` con el botón "Conectar" habilitado (`H-E1-100`). El navegador envía `Origin` en un `POST` de formulario, que `iniciar` exige (D-M16.1-06).
  - `pendiente`: lista de cuentas como `radio` con `name="cuenta"` y `value=selectionKey`, cada una con nombre (o "Cuenta sin nombre"), id truncado, moneda y zona; ninguna preseleccionada, aunque sea una sola (CA-36); botón "Confirmar cuenta" (`confirmarCuentaMeta`). Si hay descartadas: "N cuentas no se pueden usar porque Meta no informó moneda o zona válidas." Si `listError`: su texto y ninguna cuenta. Siempre: "Cancelar conexión" (`desconectarMeta`).
  - `activa`: badge "Conectado", cuenta truncada, moneda y zona; "Desconectar" dentro de un `<details>` con la advertencia "Se borran la credencial y los datos de esta conexión de la base activa. Esta acción no se puede deshacer. Si el proyecto usa Supabase Pro, las copias nocturnas pueden conservarlos hasta 7 días." (CA-38b, D-M16.2-10) y el botón "Sí, desconectar"; texto fijo: "Desconectar no quita a Praxa de tu negocio en Meta. Para hacerlo, entrá a la configuración de tu negocio en Meta, a las integraciones o apps conectadas, y quitá a Praxa." (CA-38).
  - `requiere_reauth`: badge "Requiere autorización", texto de `NEEDS_REAUTH_TEXTS[clase]`, botón "Volver a autorizar" (mismo formulario `POST` a `iniciar`, que elige `reauth`), y "Desconectar" como en `activa`.
  - `error`: "No pudimos leer el estado de Meta. Probá de nuevo más tarde."; sin "Conectar".
- Nunca aparece en el HTML el id completo de la cuenta, el `client_business_id`, el id del system user ni ningún valor de Insights (CA-40).

### 16. Meta simulada y fixtures

Mismo `MetaFetch` falso de M16.1 (`tests/unit/meta-oauth.test.ts`), con rutas nuevas: `/v26.0/<systemUserId>/assigned_ad_accounts`, `/v26.0/act_<n>/insights`, `/v26.0/oauth/revoke`. Valores sintéticos de menos de 20 caracteres: system user `5550001`, cuentas `act_1001`, `act_1002` y `act_90001` (esta última, de 9 caracteres, para probar que se ven los últimos 4), nombres `Cuenta sintetica 1`, monedas `USD` y `ARS`, zonas `America/Argentina/Buenos_Aires` y `UTC`; cursores `cur-1`, `cur-2`. Filas de Insights con montos sintéticos (`'1.23'`), nunca reales. Una zona válida para `Intl` y ausente de `pg_timezone_names` no se puede fabricar con certeza: ese caso se prueba con `worker_api` simulado devolviendo `invalid_argument`.

### 17. Documentación (D-M16.2-01)

Se edita después de que las pruebas pasen, sin TTL, nombres de funciones ni conteos (contrato documental):

- `docs/SECURITY.md` §7: pasan a vigentes el reemplazo de la credencial al reautorizar y la revocación en Meta, con el límite de que la revocación es de mejor esfuerzo y la credencial local se destruye aunque falle. §9: "Orquestación de la purga perezosa y revocación en Meta" pasa a vigente, con el límite de CA-37b (la credencial persiste hasta que el dueño vuelva). §4, fila de logs: el probe y el listado no registran valores ni identificadores.
- `docs/SECURITY.md` §6 (A-06):
  - en "Qué credencial usa cada camino", una fila para el preflight operativo: el secreto de la app de Meta, leído del `.env.local` del usuario por un script local que corre el usuario, nunca el asistente ni el despliegue. Alcance: una sola petición de lectura a Graph con las credenciales en el cuerpo, y salida de claves cerradas sin valores;
  - en "Reglas de secretos": hacia Meta, ninguna credencial viaja en la URL de salida. Las que Graph documenta como consulta (`debug_token`, revocación) van dentro del cuerpo de una solicitud por lote.
- `docs/ARCHITECTURE.md`:
  - estructura (`lifecycle.ts`, `actions.ts`, archivos nuevos de `meta/`), y `scripts/` con el preflight de Meta (`:59`);
  - tabla de módulos: `integrations` con selección de cuenta y ciclo de vida existentes, sincronización prevista; y la dependencia nueva `app-data` → `integrations`, solo lectura de la conexión;
  - camino B: "la orquestación del ciclo de vida" pasa a existir;
  - sección C: el diagrama cambia `debug_token (POST)` por `debug_token (lote)` (`:217`) y suma el listado, la prueba de acceso y la revocación por lote como existentes; Insights para persistir sigue previsto;
  - "Operaciones largas": la purga perezosa existe.

  El recorrido real con el dueño (VR-01) se registra en la evidencia, no en estos documentos.

### 18. Alta del dueño y VR-01 (pasos 10 a 12)

Requisitos previos, verificados al iniciar el paso: `G-ACTA-META` aprobado en `PROJECT_STATE.md`; P-04 declarado por el usuario; esta microfase desplegada en producción por el usuario (merge, push y despliegue); preflight de §19 con resultado `ok` y comprobación de H-S-22 con resultado esperado, ambos registrados en la sesión antes del paso 10.

**Verificación posterior al despliegue VD-01 (H-S-22; A-13).** No es un caso de prueba: es la verificación del despliegue que hace el usuario, con el mismo carácter que el `405`/`403` posterior al despliegue de M16.1 (`docs/FASES/FASE1/M16.1/spec.md`, "Intervenciones", fila de merge, push y despliegue). Figura en la ficha de M16.2 y en III.2 por la enmienda (D-M16.2-01). Tras el despliegue `Ready`, el usuario entra a `/app/integraciones` con la cuenta sintética ya conservada de `M28.2a`, abre la pestaña Network del navegador con el registro preservado y pulsa "Conectar". En la petición `POST /api/integraciones/meta/iniciar` verifica `Origin` igual al origen de la página y respuesta `303` con `Location` cuyo host es el de Meta; un `403` o cualquier otro resultado detiene el recorrido para diagnóstico. Se detiene en la pantalla de Meta **sin conceder acceso ni completar una autorización**. En la sesión se registran solo `Origin coincidente: sí/no`, el estado HTTP y `host de redirección: Meta/sin redirección`; no se copian cabeceras, cookies, URL completa, `state`, `code` ni capturas de Network. La comprobación no crea una conexión ni un token; el intento OAuth sin consumir vence y sigue la purga prevista de intentos. No sustituye la cancelación real del paso 2 de VR-01.

Guion (lo ejecutan el usuario y el dueño; el asistente guía y registra sin datos):

1. **Alta (paso 10, DEC-18).** El usuario abre el registro público; el dueño se registra con su correo, lo confirma, entra a Mi perfil y completa su empresa en Configuración; el usuario cierra el registro. Verificación: un alta nueva es rechazada después del cierre.
2. **Cancelación (H-S-07).** El dueño pulsa "Conectar" y cancela en el diálogo de Meta. Esperado: `meta=cancelado`.
3. **Autorización (H-02, H-S-03, H-S-04, H-S-05, H-S-13, H-S-15).** El dueño pulsa "Conectar" y autoriza. Esperado: `meta=pendiente` y la lista de cuentas (H-01). Cualquier `token_no_valido`, `meta_no_disponible` o `rechazado` → se frena (§11).
4. **Revocación real (H-03, H-S-19).** El dueño pulsa "Cancelar conexión". Esperado: `meta=desconectado` y una línea `meta_ciclo revocacion ok`. Si es `fallida`, se frena: el dueño quita a Praxa desde la configuración de su negocio y el usuario decide cómo seguir (D-M16.2-03 se vuelve a abrir).
5. **Conexión (VR-01).** El dueño vuelve a autorizar, elige la cuenta y confirma. Esperado: `meta=conectado` y una línea `meta_ciclo prueba ok` con `filas`, `campos`, `paginas`, `llamadas` y `duracion_ms` (Q-04). La moneda y la zona mostradas validan en la base (H-S-09).
6. **Cierre de la sesión (paso 12).** La conexión queda `active` (la necesita `M16c`). Si la sesión termina antes del paso 5, no se deja una pendiente a propósito: el dueño cancela la conexión, o la pendiente vence y se purga en la próxima visita (límite declarado de CA-37b).

Evidencia (`sesiones/M16.2.md`): fecha, comprobación previa de H-S-22 sin URL ni cabeceras copiadas, pasos cumplidos, resultados `meta=`, las líneas `meta_ciclo` y `meta_oauth` relevantes copiadas por el usuario desde los Runtime Logs (sin `request_id` si lo prefiere), cantidad de filas y campos presentes del probe, y la resolución de H-01, H-02, H-03, H-S-03, H-S-04, H-S-05, H-S-07, H-S-09, H-S-13 y H-S-15. Sin montos, sin el id completo de la cuenta, sin nombres ni correos.

Si P-01 a P-04 no se pueden cumplir: se frena y se presenta la alternativa con User Access Token y sus consecuencias en K04, CA-31 y el riesgo 2, antes de cambiar DEC-02 (II.10).

### 19. Preflight de la vía por lote (D-M16.2-05)

`scripts/meta-preflight.mjs`, sin dependencias del proyecto (solo `fetch` de Node 24):

- Exporta `runPreflight({ env, fetch, log })` y la ejecuta solo si es el módulo principal. Lee `META_APP_ID` y `META_APP_SECRET` de `env`; si falta alguno, imprime `{ "preflight": "sin_configuracion" }` y sale con código 1, sin nombrar valores.
- Hace una sola petición: `POST https://graph.facebook.com/v26.0/` (la misma versión que `GRAPH_API_VERSION`, comprobada por una prueba) con cuerpo de formulario `access_token=<appId>|<appSecret>` y `batch=[{"method":"GET","relative_url":"debug_token?input_token=<appId>|<appSecret>"}]`. Ninguna credencial va en la URL. Timeout de 10 s y `redirect: 'error'`.
- Imprime una sola línea JSON con solo estas claves: `preflight` (`ok` o `fallido`), `http` (estado externo), `codigo` (el `code` de la operación o `null`), `tipo` (`data.type` si es una cadena de hasta 32 caracteres en `[A-Z_]`, si no `null`), `valido` (`data.is_valid` si es booleano, si no `null`) y `error_graph` (el `error.code` numérico de Graph o `null`). `ok` exige `http` 200, `codigo` 200 y `valido === true`. Sale con 0 en `ok` y 1 en el resto.
- Nunca imprime el cuerpo, la URL, el token, el secreto, el id de la app, `app_id`, `user_id` ni mensajes de error de Graph.
- Lo ejecuta el usuario, no el asistente: `node --env-file=.env.local scripts/meta-preflight.mjs`, después de la aprobación de la spec y antes del paso 10. El usuario copia la línea impresa a la sesión. Con `fallido`, se frena y D-M16.2-03 se vuelve a abrir antes de cualquier autorización real.
- **(decisión)** El token de la app como `input_token` prueba la vía por lote de `debug_token` sin ningún token de usuario ni de system user. La revocación por lote no se puede probar así: se prueba en el paso 4 del guion de §18, antes de dejar una conexión activa.

### 20. `app-data`: estado real de Meta Ads (D-M16.2-02)

- `getIntegraciones` sigue siendo una `async function` **sin** `cache` de React, como hoy (`src/modules/app-data/index.ts:86-89`), y devuelve las tres integraciones en el mismo orden. **(decisión)** No se agrega `cache`: el layout y la página la llaman en el mismo render, y una lectura memoizada podría quedar anterior a la purga que hace la página. Dos lecturas RLS por render es un costo aceptable. `meta_ads.conectada` es `true` solo si `readConnectionRecord(await requireTenantContext())` devuelve una conexión `active`. Google Analytics y Tiendanube siguen en `false`.
- Es solo lectura RLS: no corre la purga perezosa, no llama a Meta ni a `worker_api`.
- `NoCompanyError`, un error de lectura o cualquier otra excepción → `meta_ads.conectada = false`, sin propagar. **(decisión)** El layout de todo `/app` usa esta función: un fallo de lectura no puede tirar las pantallas, y "no conectado" es el lado seguro.
- `requiere_reauth` cuenta como no conectada en el chip, en Inicio y en Chat. El detalle está en la tarjeta de Integraciones.
- Consumidores: el chip del layout, el badge de Inicio, las "Fuentes conectadas" de Chat (que sigue siendo un mock) y las tarjetas de Integraciones distintas de Meta.

## Archivos previstos

| Archivo | Nuevo o modificado | Para qué | Autorizado por |
|---|---|---|---|
| `src/modules/integrations/meta/accounts.ts` | Nuevo | Listado paginado de cuentas delegadas | II.10 paso 1 |
| `src/modules/integrations/meta/probe.ts` | Nuevo | Probe de Insights | II.10 paso 3 |
| `src/modules/integrations/meta/revoke.ts` | Nuevo | Revocación | II.10 paso 6 |
| `src/modules/integrations/meta/errors.ts` | Modificado | Efecto de cada clase | II.10 paso 7 |
| `src/modules/integrations/meta/api.ts` | Modificado | `revoke_token` prohibido en URLs | II.10 paso 6; archivo existente fuera de la tabla de II.10: **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-01, A-10) |
| `src/modules/integrations/meta/client.ts` | Modificado | `postBatchGetJson` | II.10 paso 6; D-M16.2-03; archivo existente fuera de la tabla de II.10: **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-01, A-10) |
| `src/modules/integrations/meta/tokens.ts` | Modificado | `fetchSystemUser`; `inspectToken` por lote | II.10 pasos 1 y 6; D-M16.2-03; archivo existente fuera de la tabla de II.10: **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-01, A-10) |
| `src/modules/integrations/meta/oauth.ts` | Modificado | Purga al iniciar; `reauth` completo; caso B; `motivo` en el registro | II.10 pasos 4 y 5; `H-E1-114`; archivo existente fuera de la tabla de II.10: **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-01, A-10) |
| `src/modules/integrations/meta/outcomes.ts` | Modificado | Resultados y textos | II.10 pasos 2, 5, 6 y 8; archivo existente fuera de la tabla de II.10: **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-01, A-10) |
| `src/modules/integrations/lifecycle.ts` | Nuevo | Purga, estado, confirmación, desconexión, reautorización, efecto de errores | II.10 pasos 3, 4, 5 y 7 |
| `src/modules/integrations/actions.ts` | Nuevo | Server Actions | II.10 paso 6 |
| `src/modules/integrations/repository/connections.ts` | Modificado | `readConnectionRecord` | II.10 pasos 2 y 8; archivo existente fuera de la tabla de II.10: **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-01, A-10) |
| `src/modules/integrations/repository/lifecycle-calls.ts` | Nuevo | Envoltorios de `worker_api` del ciclo de vida | II.10 pasos 3, 4, 6 y 7; archivo nuevo en ruta sugerida del mismo módulo (preámbulo de la Parte II); se lista igual en la enmienda (D-M16.2-01) |
| `src/app/(app)/app/integraciones/page.tsx` | Modificado | Tarjeta real de Meta | II.10 pasos 2 y 8 |
| `src/app/(app)/app/integraciones/meta-tarjeta.tsx` | Nuevo | Estados de la tarjeta | II.10 pasos 2 y 8 |
| `tests/unit/meta-lifecycle.test.ts` | Nuevo | Pruebas unitarias con Meta y `worker_api` simulados | II.10 paso 9 |
| `tests/app/meta-lifecycle.test.ts` | Nuevo | Pruebas contra el proyecto desechable | II.10 paso 9 |
| `tests/unit/meta-oauth.test.ts` | Modificado | T-10 y T-21 de M16.1 cambian de comportamiento; Meta simulada y aserciones de `debug_token` pasan a lote | **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-01) |
| `tests/app/meta-oauth.test.ts` | Modificado | T-32 y T-33 de M16.1 cambian de comportamiento; Meta simulada responde `debug_token` por lote | **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-01) |
| `tests/component/integraciones-meta-aviso.test.tsx` | Modificado | "Conectar sigue deshabilitado" deja de ser cierto; simulación de los módulos nuevos | **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-01) |
| `tests/component/app-paginas-sesion.test.tsx` | Modificado | Simular `@/modules/integrations/actions` y `lifecycle` (solo mocks; ninguna aserción cambia) | **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-01) |
| `tests/component/integraciones-meta-tarjeta.test.tsx` | Nuevo | Estados de la tarjeta, CA-36 y CA-40 en el HTML | **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-01) |
| `docs/SECURITY.md` | Modificado | §4 (fila de logs), §6 (uso local del secreto y salida a Meta), §7 y §9 (controles de previstos a vigentes), según Diseño §17 | **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-01) |
| `docs/ARCHITECTURE.md` | Modificado | Estructura, módulos (incluida la dependencia `app-data` → `integrations`), camino B, sección C, operaciones largas (Diseño §17) | **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-01, D-M16.2-02) |
| `src/modules/app-data/index.ts` | Modificado | `getIntegraciones` con el estado real de `meta_ads` (Diseño §20) | **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-02) |
| `tests/unit/app-data.test.ts` | Modificado | Las dos pruebas de `getIntegraciones` pasan a cubrir el estado real (T-46) | **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-02) |
| `scripts/meta-preflight.mjs` | Nuevo | Preflight de la vía por lote (Diseño §19) | **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-05) |
| `tests/unit/meta-preflight.test.ts` | Nuevo | Pruebas del preflight con `fetch` simulado (T-48) | **ENMIENDA APROBADA EN LA RUTA** (D-M16.2-05) |
| `docs/HALLAZGOS.md` | Modificado | Estado de `H-E1-13`, `-21`, `-22` (parte persistente reasignada a `M16c`), `-28`, `-100`, `-114`, `-116`, `-117` y hallazgos nuevos | Precondición 8 de la Parte II |
| `docs/FASES/FASE1/meta_first/plan.md` | Modificado | Enmienda de la ruta, redactada antes de implementar y aprobada por el usuario de forma visible en el encabezado (A-11): (1) II.10 con todos los archivos marcados **ENMIENDA APROBADA EN LA RUTA** en esta tabla, incluidos los existentes de M16.1 (A-10); (2) ficha e II.11 de `M16c`: la parte persistente de `H-E1-22` (D-M16.2-07) y, en el paso 9, la revocación y la desconexión durante una sincronización (A-09); (3) nota en la ficha de M16.2 de la excepción de tamaño (D-M16.2-11); (4) en la ficha de M16.2 ("Intervención requerida") y en su fila de III.2, el preflight y la verificación posterior al despliegue VD-01 (A-13); (5) CA-39 en el criterio de aceptación de la ficha de `M16c` (A-16) | D-M16.2-01, -02, -05, -07, -11 |
| `docs/FASES/FASE1/meta_first/spec.md` | Modificado | Enmienda coordinada de §14: la prueba de revocación y desconexión durante sincronización pasa de la fila «Ciclo de vida» a «Sincronización» (`M16c`); en M16.2 se prueban confirmación y reautorización en carrera con desconexión (A-09). Requiere aprobación visible junto con el plan de la ruta | D-M16.2-01; A-09 |
| `docs/PROJECT_STATE.md` | Modificado | Cierre y `G-VR01`, cuando el usuario lo apruebe | Precondición 8 |
| `docs/FASES/FASE1/meta_first/sesiones/M16.2.md` | Nuevo | Evidencia, incluido VR-01 | Precondición 8 |
| `docs/FASES/FASE1/M16.2/spec.md`, `plan.md`, `revisiones/*.md` | Nuevo | Pipeline | Precondición 9 |
| `tests/unit/__qa__/*` | Temporal | Pruebas de `qa-review` | Precondición 9 |

No se modifican: `supabase/migrations/*`, `supabase/tests/*`, `src/modules/integrations/contract/*`, `src/modules/integrations/db/*`, `src/modules/integrations/crypto/*`, `src/modules/integrations/repository/credentials.ts`, `src/modules/integrations/repository/attempts.ts`, `src/proxy.ts`, `src/app/api/integraciones/meta/*/route.ts`, `tests/unit/no-privileged-credentials.test.ts`, `tests/unit/no-secrets-in-tree.test.ts`, `.env.example` (no hay variables nuevas), `package.json` (el preflight se corre con `node` directo) ni ningún `loading.tsx` de `/app`.

## Criterios de aceptación

### Heredados de la ruta

| ID de la ruta | Qué exige (resumen fiel) |
|---|---|
| CA-29b (parte de M16.2) | En el callback `reauth`, `M16.2` agrega el canje, la inspección, la verificación de cuentas delegadas y el reemplazo de la credencial (CA-37c) |
| CA-35 | Después de un callback `initial`, la conexión queda en `pending_selection` con la credencial cifrada, `pending_expires_at` a 30 minutos y moneda, zona y cuenta vacías. Se listan las cuentas delegadas (H-01), paginando hasta agotar la respuesta |
| CA-36 | El dueño confirma explícitamente la cuenta, su moneda y su zona, aunque haya delegado una sola; si delegó más de una, elige una |
| CA-37 | Antes de pasar a `active` se hace una consulta de prueba contra la cuenta elegida; si falla, no se activa. `confirm_connection` verifica en la base que `pending_expires_at` no haya pasado, aunque la purga no haya corrido |
| CA-37b | Una pendiente vence a los 30 minutos (DEC-17). Purga en este orden: `pending_selection` → `disconnected` sin metadatos; intento de revocación en Meta (H-03); purga. Perezosa: al iniciar un intento nuevo o al abrir integraciones. Límite: hasta que el dueño vuelva, la credencial cifrada persiste |
| CA-37c | Reautorización con un intento `reauth` sobre la conexión existente; el callback reemplaza la credencial en esa conexión solo si la generación sigue siendo la esperada y la cuenta conectada sigue entre las delegadas; si no, se rechaza. El historial nunca se reasigna a otra cuenta |
| CA-38 | Desconexión en orden: `begin_disconnect` (estado `disconnected`, generación incrementada, `purge_requested_at`; desde ahí ninguna llamada nueva a Meta); intento de revocación si la credencial existe; `purge_connection` idempotente. Si se corta después del paso 1, se reanuda al abrir integraciones, al repetir la desconexión o al iniciar una conexión nueva. La UI indica cómo quitar la app desde las apps conectadas del negocio |
| CA-38b (parte de M16.2, D-M16.2-10) | "Borrar" alcanza a la base activa; con Pro (DEC-08), un dato borrado puede seguir hasta 7 días en las copias nocturnas, y la UI lo declara. En M16.2 solo la declaración en la UI de desconexión. El resto de CA-38b queda donde ya se cumple: la purga perezosa de intentos (M16.1, `create_oauth_attempt`); la conservación de snapshots reemplazados (`M16c`); el borrado de la cuenta en cascada (`M28.3a`); la declaración en el acta (`M03a`) |
| CA-38c | Una operación que empezó antes de la desconexión y termina después no puede reinsertar datos: verifica en la misma transacción que la conexión exista, esté `active` y conserve la generación |
| CA-39 | Clasificación por código de Graph según la tabla; autenticación, acción del usuario y permiso → `needs_reauth` (con mensaje específico o indicando el permiso); acceso al activo solo con evidencia de H-04; límite, temporal, error propio, transporte y desconocido dejan la conexión como estaba; desconocido nunca pasa solo a `needs_reauth` |
| CA-40 | El identificador completo de la cuenta nunca aparece junto a datos de gasto en capturas, registros o evidencia |
| CA-60 | La paginación también se aplica al listado de cuentas |
| CA-09 | El último error se guarda como clase más mensaje redactado, sin tokens, códigos ni URLs con parámetros |
| CA-26 (enmendada) | Ni claves, ni tokens, ni códigos, ni secretos, ni URLs que los contengan aparecen en logs, errores, snapshots o fixtures de PRAXA; ningún token ni secreto aparece en una URL de salida hacia Meta |
| CA-08 | Moneda (ISO 4217), zona (IANA) y cuenta obligatorias en `active` y `needs_reauth`; ninguna transición inventa metadatos |
| VR-01 | El dueño, registrado y con su empresa, autoriza → callback seguro → token válido según CA-31 → acceso efectivo a la cuenta delegada → una respuesta real de Insights. Evidencia redactada: cantidad de filas y campos presentes, sin montos. H-01 a H-03 resueltas |
| DEC-17 | La pendiente vence a los 30 minutos y su purga incluye la revocación |
| DEC-18 | El registro público se abre solo mientras el dueño se registra en M16.2 y después se cierra |
| P-04, P-05 | Dueño con portfolio propio, control total y rol de tester aceptado, antes de VR-01; recorrido completo validado en VR-01 |
| CB-01 | `verify` y las suites del corte pasan |
| CB-02 | Ningún diff contiene secretos, tokens, montos reales ni identificadores completos de cuentas |
| CB-03 | Ninguna migración existente se modifica |
| CB-04 | Ninguna prueba se ejecuta contra producción, salvo el recorrido manual acotado de `M28.2a` aprobado por el usuario y descrito en DEC-18 e II.7 del plan. Ninguna suite automatizada ni fixture se ejecuta contra `app` (texto de la ruta, sin recortes; A-13) |
| CB-05 | La evidencia registra comandos y resultados reales, redactados |
| CB-06 | Un gate no se aprueba si una prueba requerida se omitió por falta de configuración; las opt-in ajenas se listan con archivo y motivo |

### Operativos de esta microfase

| ID | Criterio verificable | Traza a (CA, DEC o trampa de la ruta) |
|---|---|---|
| M16.2-C-01 | `listDelegatedAccounts` pide `/{systemUserId}/assigned_ad_accounts` con `fields=id,name,currency,timezone_name` y `limit=100`, con el token solo en `Authorization`, pagina con `paging.cursors.after` mientras haya `paging.next`, nunca usa la URL de `paging.next` y falla con un error fijo después de 10 páginas | CA-35; CA-60; H-01; trampa 2 de II.11 |
| M16.2-C-02 | Una cuenta con id fuera de `^act_[0-9]{1,60}$`, moneda que no valida con `currencyCodeSchema` o zona que no valida con `timeZoneSchema` no es seleccionable y solo se cuenta como descartada | CA-08; `H-E1-28`; H-S-09 |
| M16.2-C-03 | Con una pendiente vigente, la tarjeta lista todas las cuentas válidas como opciones sin preselección, aunque haya una sola, con nombre, id truncado, moneda y zona, y exige pulsar "Confirmar cuenta" | CA-36; CA-40 |
| M16.2-C-04 | `confirmarCuentaMeta` solo usa el campo `cuenta`; la cuenta, la moneda y la zona salen de un listado nuevo hecho en el servidor con la credencial guardada; un `selectionKey` que no coincide termina en `cuenta_invalida` sin probe ni `confirm_connection` | CA-36; INV-01 |
| M16.2-C-05 | `confirm_connection` se llama solo después de un probe exitoso contra la cuenta elegida; un probe que falla deja la conexión en `pending_selection` y no llama a `confirm_connection` | CA-37 |
| M16.2-C-06 | El probe pide `/{act}/insights` con `level=account`, `fields=spend,impressions`, `time_increment=1`, `date_preset=last_28d`, token solo en `Authorization`; devuelve solo conteos y nombres de campos; ningún valor de Insights aparece en el resultado, en errores ni en registros | CA-37; CA-40; CA-26; VR-01 |
| M16.2-C-07 | `pending_expired` de la base termina en `pendiente_vencida` aunque el servidor haya visto la pendiente vigente; si la pendiente ya venció según el servidor, `confirmAccount` devuelve `pendiente_vencida` sin purga, probe ni otra llamada a Meta. La carga siguiente de la tarjeta puede revocar y purgar esa pendiente | CA-37; CA-37b |
| M16.2-C-08 | La purga perezosa sigue el orden `begin_disconnect` (solo si era pendiente) → lectura de la credencial y revocación (solo si `has_credential`) → `purge_connection`, por cada conexión de `list_pending_purges`, con un máximo de 5 por corrida | CA-37b; CA-38; DEC-17 |
| M16.2-C-09 | La purga corre al iniciar (antes de leer la conexión viva), al cargar la tarjeta y al desconectar; un error de la purga no corta esos flujos | CA-37b; CA-38 |
| M16.2-C-10 | Si la revocación falla, la credencial no se puede leer o falta la configuración de Meta, `purge_connection` se llama igual y queda una línea de registro sin token | Trampa 1 de II.10; CA-38 |
| M16.2-C-11 | Una conexión `disconnected` con la purga sin terminar se completa en la siguiente corrida; repetir `purge_connection` no falla; reconectar después crea una fila nueva | CA-38; CA-18 |
| M16.2-C-12 | `desconectarMeta` sobre una conexión viva llama a `begin_disconnect` antes que a cualquier otra cosa; después de `begin_disconnect` la única llamada a Meta es la revocación; al terminar no queda fila ni credencial | CA-38; DEC-09 |
| M16.2-C-13 | La tarjeta `activa` y `requiere_reauth` muestra el texto fijo sobre cómo quitar a Praxa desde las apps conectadas del negocio | CA-38 |
| M16.2-C-14 | La revocación viaja como operación `GET oauth/revoke` dentro de un `POST` por lote a `https://graph.facebook.com/v26.0/` sin consulta; el token, el secreto y `revoke_token` van solo en el cuerpo; `graphUrl` y el cliente rechazan `revoke_token` en la consulta | CA-26; D-M16.1-08; `H-E1-114`; D-M16.2-03 |
| M16.2-C-15 | El callback `reauth` con conexión y generación esperadas hace consumo → canje → `debug_token` → `/me` → listado → `replace_credential` con el `attemptId` consumido, y termina en `reautorizado` con la conexión `active`, la generación incrementada y la credencial nueva | CA-37c; CA-29b |
| M16.2-C-16 | Con otra conexión u otra generación antes del canje, el callback `reauth` termina en `credencial_cambio` sin canjear ni llamar a Meta | CA-37c; D-M16.1-03 |
| M16.2-C-17 | Si la cuenta conectada no está entre las delegadas al token nuevo, no se llama a `replace_credential`, se revoca el token nuevo y el resultado es `cuenta_no_delegada` | CA-37c |
| M16.2-C-18 | Si `replace_credential` responde `generation_mismatch`, `invalid_transition`, `not_authorized`, `attempt_rejected` u otro error no de transporte, se revoca el token nuevo, la credencial guardada no cambia y el resultado es `credencial_cambio`, `credencial_cambio`, `credencial_cambio`, `rechazado` o `error` | CA-37c; CA-38c; A-14 |
| M16.2-C-19 | Caso B: en `initial` y en `reauth`, un fallo confirmado después del canje y antes de guardar la credencial revoca el token nuevo una vez antes de responder, sin registrarlo. La escritura ambigua sigue C-46 y puede resultar en éxito sin revocación si la relectura confirma que se guardó | `H-E1-114`; D-M16.2-04; C-46 |
| M16.2-C-20 | Caso A: con el canje fallido no se llama a la revocación; los textos de `rechazado` y `meta_no_disponible` explican cómo quitar a Praxa del negocio | `H-E1-114`; D-M16.2-04 |
| M16.2-C-21 | `connectionEffectFor` devuelve `needs_reauth` solo para `authentication`, `user_action`, `permission` y `asset_access`, y `unchanged` para las demás; `applyConnectionFailure` llama a `mark_needs_reauth` con la generación esperada y el `redactedMessage`, y nunca con `unknown` | CA-39; CA-09 |
| M16.2-C-22 | Las clases que no llevan a `needs_reauth` no escriben en la base y dejan una línea de registro de formato fijo; la persistencia queda asignada a `M16c` | CA-39; `H-E1-22`; D-M16.2-07 |
| M16.2-C-23 | La tarjeta `requiere_reauth` muestra el texto de su clase y "Volver a autorizar" envía un `POST` a `iniciar` | CA-39; CA-28 |
| M16.2-C-24 | Una confirmación o una reautorización que termina después de `begin_disconnect` no deja la conexión activa ni una credencial nueva | CA-38c |
| M16.2-C-25 | Con una pendiente vigente, "Cancelar conexión" la lleva a `disconnected` sin metadatos, revoca y purga; `iniciar` con una pendiente vigente sigue respondiendo `pendiente_vigente` sin crear intento | CA-07; CA-08; `H-E1-21`; D-M16.2-06 |
| M16.2-C-26 | La tarjeta cubre los seis estados del Diseño §15; "Conectar" está habilitado y es un formulario `POST` a `/api/integraciones/meta/iniciar` solo en `sin_conexion`; Google Analytics y Tiendanube siguen como hoy | CA-28; `H-E1-100` |
| M16.2-C-27 | El HTML de `/app/integraciones` nunca contiene el id completo de una cuenta, el `client_business_id`, el id del system user ni valores de Insights, en ningún estado | CA-40; CA-09b |
| M16.2-C-28 | Los módulos nuevos de servidor empiezan con `import 'server-only';`; `actions.ts` empieza con `'use server';` y solo exporta funciones `async`; dentro de `src/`, `META_APP_SECRET` sigue solo en `meta/api.ts` y `PRAXA_INTEGRATIONS_DB_URL` solo en `db/worker-api.ts`; fuera de `src/`, solo `scripts/meta-preflight.mjs` lee `META_APP_SECRET` (§19, uso operativo declarado en `SECURITY.md` §6) | CA-27; INV-04 |
| M16.2-C-29 | Las líneas `meta_ciclo` y `meta_oauth` solo tienen los campos del Diseño §9.1 y §13; ninguna contiene token, código, ids de cuenta, de negocio o de system user, nombres de cuenta ni valores de Insights | CA-26; CA-40 |
| M16.2-C-30 | La página muestra solo textos de `META_OAUTH_MESSAGES`; `reautorizacion_no_disponible` ya no existe; cada resultado nuevo tiene texto | CA-29; D-M16.1-01 |
| M16.2-C-31 | Las Server Actions y las funciones del ciclo de vida construyen K01 adentro y no aceptan actor, empresa ni conexión del navegador | INV-01; trampa de II.2 |
| M16.2-C-32 | `confirm_connection` y `replace_credential` se reintentan una sola vez ante transporte o timeout, con los mismos argumentos | Toda escritura idempotente (`AGENTS.md`) |
| M16.2-C-33 | `tests/app/meta-lifecycle.test.ts` falla, no se salta, sin configuración válida del proyecto desechable o del rol, y nunca usa `PRAXA_INTEGRATIONS_DB_URL` | CB-04; CB-06 |
| M16.2-C-34 | `npm run verify`, `npm run test:policies` y `npm run test:app` terminan correctamente; ninguna prueba de `meta-lifecycle` ni de `meta-oauth` se omite | III.3; CB-01; CB-06 |
| M16.2-C-35 | Los documentos cambian solo como dice el Diseño §17, sin TTL, nombres de funciones ni conteos | Contrato documental de `AGENTS.md` |
| M16.2-C-36 | VR-01 completo según el guion del Diseño §18, con evidencia sin montos ni identificadores completos; H-01, H-02, H-03 y las hipótesis de `H-E1-117` y H-S-09 resueltas o registradas; H-S-22 verificada antes del paso 10; el registro público cerrado después del alta; ninguna credencial real pendiente a propósito al terminar la sesión | VR-01; P-05; DEC-18; paso 12 de II.10 |
| M16.2-C-37 | Ante un rechazo de la forma de una petición a Meta (H-S-13, H-S-15, revocación) o un prerrequisito P que falla durante VR-01, la sesión se frena y la evidencia registra la recuperación aplicada | `H-E1-116`; II.10 (si fallan P-01 a P-04); III.9 |
| M16.2-C-38 | `getIntegraciones` marca `meta_ads` conectada solo con la conexión `active` real de la empresa (chip, Inicio y Chat); `pending_selection`, `needs_reauth`, sin empresa o un error de lectura dan `false` sin propagar; no escribe ni llama a Meta | Paso 8 (UI de estado); D-M16.2-02 |
| M16.2-C-39 | `inspectToken` pide `debug_token` como operación `GET` por lote, con `input_token` dentro del `relative_url` y el token de la app como `access_token` del cuerpo; ningún token ni secreto en la URL de salida; la validación y los motivos de rechazo no cambian | CA-26; CA-31; D-M16.1-08; `H-E1-116`; D-M16.2-03 |
| M16.2-C-40 | `postBatchGetJson` acepta solo `debug_token` y `oauth/revoke`. Respuesta externa o `body` ilegibles → `transport`; `null` en el arreglo → `transport`; arreglo que no tiene exactamente un elemento con `code` y `body`, o `code` fuera de 2xx sin `error` → `unknown`; `error` en el cuerpo → su clase según CA-39; nunca `temporary` sin código 1 o 2. Ningún error lleva URL ni cuerpo | CA-26; CA-39; D-M16.2-03 |
| M16.2-C-41 | `scripts/meta-preflight.mjs` hace una sola petición por lote sin credenciales en la URL, usa la misma versión que `GRAPH_API_VERSION` e imprime solo `preflight`, `http`, `codigo`, `tipo`, `valido` y `error_graph`; el resultado `ok` queda registrado en la sesión antes del paso 10 | `H-E1-116`; `H-E1-114`; D-M16.2-05 |
| M16.2-C-42 | La clave de selección es el SHA-256 de `connectionId:accountId`; una clave calculada con otra conexión o solo con el id de la cuenta no coincide y termina en `cuenta_invalida` | CA-36; CA-40; D-M16.2-08 |
| M16.2-C-44 | La advertencia de "Desconectar" (en `activa` y en `requiere_reauth`) y el texto del resultado `desconectado` aclaran que el borrado alcanza a la base activa y que, si el proyecto usa Supabase Pro, las copias nocturnas pueden conservar los datos hasta 7 días; antes de VR-01 se verifica que el acta de M03a también declare ese límite | CA-38b; D-M16.2-10 |
| M16.2-C-45 | `confirmAccount` y `disconnect` dejan pasar `UnauthorizedError` y devuelven `sin_empresa` ante `NoCompanyError`; las acciones redirigen al login con `UnauthorizedError` y llaman a `redirect` fuera del `try`; `disconnect` devuelve solo `DisconnectOutcome` y no purga si `begin_disconnect` falla; en la reautorización, un `AccountListLimitError` o un `TokenRejectedError` después del canje revoca el token nuevo y termina en `meta_no_disponible` o en el resultado de `initial`; `lifecycle.ts` no importa `meta/oauth.ts` en tiempo de ejecución | Diseño §9.3 a §10; A-05 |
| M16.2-C-46 | Si la escritura de la credencial (`replace_credential` en `reauth`, `create_pending_connection` en `initial`) falla por transporte o timeout en sus dos intentos, el callback relee antes de revocar. Si la credencial guardada coincide con el token nuevo, no revoca y responde éxito. Si no coincide o no hay conexión, revoca y responde `error`. Si la relectura falla, revoca y responde `error`. Nunca registra el token ni su hash | `H-E1-114`; CA-38c; A-14 |

## Casos de prueba

Comandos: `npm run test:unit`, `npm run test:component`, `npm run test:app`, `npm run test:policies`, `npm run verify`. Las pruebas de `tests/unit/meta-lifecycle.test.ts`, `tests/unit/meta-preflight.test.ts`, `tests/component/integraciones-meta-tarjeta.test.tsx` y `tests/app/meta-lifecycle.test.ts` se escriben antes del código y fallan primero por ausencia de los módulos o por comportamiento.

| ID | Criterios | Tipo | Comando | Resultado esperado | ¿Falla sin la implementación? |
|---|---|---|---|---|---|
| M16.2-T-01 | C-01 | unit | `npm run test:unit` | Meta simulada con tres páginas (`cur-1`, `cur-2`, sin `next`): tres peticiones `GET` a `/v26.0/5550001/assigned_ad_accounts`, la consulta con `fields`, `limit` y `after` (decodificados), `Authorization: Bearer`; la URL de `paging.next` (que el fixture arma con un parámetro `access_token`) nunca se pide; resultado con las cuentas de las tres páginas | Sí: no existe `accounts.ts` |
| M16.2-T-02 | C-01 | unit | `npm run test:unit` | Once páginas encadenadas → `AccountListLimitError` con mensaje fijo después de la décima; respuesta sin `data` → `MetaApiError` `unknown`; `systemUserId` no numérico lanza sin llamar a `fetch` | Sí |
| M16.2-T-03 | C-02 | unit | `npm run test:unit` | Cuentas con id `123`, `act_x`, moneda `ZZZ`, zona `Mars/Base` y una válida: una seleccionable, cuatro descartadas; un id repetido en dos páginas cuenta una vez | Sí |
| M16.2-T-04 | C-06 | unit | `npm run test:unit` | Probe con dos páginas: consulta exacta (`level`, `fields`, `time_increment`, `date_preset`, `limit`), `Authorization: Bearer`; `ProbeSummary` con `rows`, `fieldsPresent`, `pages: 2`, `calls: 2`, `complete: true`; `JSON.stringify` del resultado no contiene `1.23` ni ningún valor de las filas; `data: []` → éxito con `rows: 0`; seis páginas → `complete: false` y `pages: 5` | Sí |
| M16.2-T-05 | C-05, C-06 | unit | `npm run test:unit` | Probe con error 100, 200, 4, 2, red y cuerpo ilegible → lanza `MetaApiError` con su clase; el mensaje no contiene el id de la cuenta | Sí |
| M16.2-T-06 | C-04, C-05 | unit | `npm run test:unit` | `confirmAccount` con `selectionKey` válido: orden lectura de conexión → `get_credential` → `/me` → listado → insights → `confirm_connection` con la cuenta, moneda y zona del listado; resultado `conectado`; no llama a `list_pending_purges` | Sí |
| M16.2-T-07 | C-04, C-42 | unit | `npm run test:unit` | `selectionKey` mal formado → `cuenta_invalida` sin llamadas; bien formado sin coincidencia → `cuenta_invalida` sin insights ni `confirm_connection`; el SHA-256 de `act_1001` solo y el de `<otra conexión>:act_1001` → `cuenta_invalida`; un `FormData` con campos extra (`currency`, `timezone`, `account`) produce la misma llamada a `confirm_connection` que sin ellos | Sí |
| M16.2-T-08 | C-05 | unit | `npm run test:unit` | Probe que falla con `permission` → `prueba_fallida`; con `transport` → `meta_no_disponible`; en ambos `confirm_connection` no se llama y no se llama a `mark_needs_reauth` | Sí |
| M16.2-T-09 | C-07 | unit | `npm run test:unit` | `confirm_connection` que responde `pending_expired` → `pendiente_vencida`; registro con `pending_expires_at` pasado → `pendiente_vencida` sin `list_pending_purges`, probe ni ninguna llamada a Meta en `confirmAccount`; la carga posterior de la tarjeta sí ejecuta purga y revocación; `invalid_transition` → `conexion_cambio`; `invalid_argument` → `cuenta_invalida` | Sí |
| M16.2-T-10 | C-32 | unit | `npm run test:unit` | `confirm_connection` que falla una vez por transporte → segundo intento con argumentos idénticos y `conectado`; dos fallos → `error` | Sí |
| M16.2-T-11 | C-08 | unit | `npm run test:unit` | `list_pending_purges` con una pendiente vencida con credencial y una desconectada sin credencial: orden exacto `begin_disconnect(pendiente)` → `get_credential(pendiente)` → `oauth/revoke` → `purge_connection(pendiente)` → `purge_connection(desconectada)`; ninguna revocación para la segunda; siete entradas → solo cinco procesadas y `remaining: true` | Sí: no existe `lifecycle.ts` |
| M16.2-T-12 | C-10 | unit | `npm run test:unit` | Revocación que responde error 190, error de red, `success: false`; `get_credential` sin filas; `readCredential` que lanza por versión de clave; configuración de Meta inválida: en todos se llama a `purge_connection` y queda una línea `revocacion` (`fallida`, `sin_credencial` o `sin_credencial_legible`) sin el token | Sí |
| M16.2-T-13 | C-09, C-25 | unit | `npm run test:unit` | `handleMetaStart`: `list_pending_purges` se llama antes de leer la conexión viva; con la purga que lanza, el inicio sigue y crea el intento; con una pendiente vigente responde `pendiente_vigente` sin crear intento (reemplaza M16.1-T-10). Con `list_pending_purges` que devuelve una desconectada con credencial, la revocación llega a la Meta simulada inyectada en `handleMetaStart`, y `createMetaHttpClient` no se llama para crear un cliente por defecto (espía del módulo) | Sí |
| M16.2-T-14 | C-14 | unit | `npm run test:unit` | `revokeToken`: una sola petición `POST` a `/v26.0/` sin consulta, `Content-Type` de formulario, cuerpo con `access_token` (el token) y `batch` de un elemento `{ method: 'GET', relative_url: 'oauth/revoke?…' }` cuyo `relative_url` decodificado tiene `client_id`, `client_secret` y `revoke_token`; ninguna URL registrada contiene el token ni el secreto simulados; cuerpo de la operación con `success: true` y `'true'` → `revoked`; Meta simulada falla la prueba si recibe un `GET` o un `POST` a `/v26.0/oauth/revoke`. `graphUrl('x', { revoke_token: 'y' })` lanza; `getJson` con `?revoke_token=y` lanza sin `fetch` | Sí |
| M16.2-T-15 | C-15 | unit | `npm run test:unit` | Callback `reauth` con conexión y generación esperadas: orden consumo → canje → `debug_token` → `/me` → listado → `replace_credential` con el `attemptId` consumido; `303` a `?meta=reautorizado` (reemplaza M16.1-T-21) | Sí |
| M16.2-T-16 | C-16 | unit | `npm run test:unit` | Callback `reauth` sin conexión viva, con otra conexión o con otra generación → `credencial_cambio`; `meta.calls` vacío; solo `consume_oauth_attempt` en `worker_api` | Sí (hoy responde `reautorizacion_no_disponible` en uno de los casos de M16.1-T-21 que cambia) |
| M16.2-T-17 | C-17 | unit | `npm run test:unit` | Listado del token nuevo sin la cuenta conectada → `cuenta_no_delegada`; `replace_credential` no se llama; una petición a `oauth/revoke` con el token nuevo | Sí |
| M16.2-T-18 | C-18, C-24 | unit | `npm run test:unit` | `replace_credential` que responde `generation_mismatch`, `invalid_transition`, `not_authorized`, `attempt_rejected` e `invalid_argument` → `credencial_cambio`, `credencial_cambio`, `credencial_cambio`, `rechazado` y `error`; en los cinco, exactamente una revocación del token nuevo | Sí |
| M16.2-T-19 | C-19 | unit | `npm run test:unit` | Camino `initial`: canje exitoso y después `debug_token` sin `ads_read`, `/me` sin negocio, `create_pending_connection` con `PX003` y con error inesperado → una revocación del token nuevo en cada caso, el resultado de M16.1 sin cambios, y el token no aparece en registros | Sí |
| M16.2-T-20 | C-20 | unit | `npm run test:unit` | Canje con error 100 y con error de red → ninguna petición a `oauth/revoke`; `META_OAUTH_MESSAGES.rechazado.text` y `.meta_no_disponible.text` contienen la oración del caso A | Sí |
| M16.2-T-21 | C-21 | unit | `npm run test:unit` | Tabla: cada una de las nueve clases → efecto esperado; `applyConnectionFailure` con `authentication` llama a `mark_needs_reauth` con la generación y el `redactedMessage` (que valida con `redactedErrorMessageSchema`); con `unknown`, `rate_limit` y `transport` no llama a `worker_api`; con `generation_mismatch` devuelve `unchanged` | Sí |
| M16.2-T-22 | C-22, C-29 | unit | `npm run test:unit` | Con `unknown` queda exactamente una línea `{ evento: 'meta_ciclo', etapa: 'error_conexion', resultado: 'omitida', clase: 'unknown', request_id }` y ninguna escritura | Sí |
| M16.2-T-23 | C-29 | unit | `npm run test:unit` | Recorrido de todas las líneas `meta_ciclo` y `meta_oauth` capturadas en T-01 a T-22: solo claves permitidas; ningún valor contiene el token, `act_1001`, `act_90001`, `5550001`, `negocio_sintetico`, `Cuenta sintetica` ni `1.23` | Sí |
| M16.2-T-24 | C-28 | unit | `npm run test:unit` | Recorre los archivos nuevos: `server-only` en los de servidor; `actions.ts` con `'use server'` y solo exportaciones de funciones `async`; `no-privileged-credentials` y `no-secrets-in-tree` siguen en verde | Sí (archivos inexistentes) |
| M16.2-T-25 | C-30 | unit | `npm run test:unit` | `META_OAUTH_OUTCOMES` no incluye `reautorizacion_no_disponible`, incluye los nueve nuevos; cada uno tiene texto y tono; `parseMetaOAuthOutcome('reautorizacion_no_disponible')` es `null` | Sí |
| M16.2-T-26 | C-31 | unit | `npm run test:unit` | `confirmarCuentaMeta` y `desconectarMeta` con `tenant` que lanza `UnauthorizedError` → `redirect` al login; con `NoCompanyError` → `meta=sin_empresa`; ninguna lee empresa ni conexión del `FormData` | Sí |
| M16.2-T-27 | C-03, C-26, C-27 | component | `npm run test:component` (archivo `tests/component/integraciones-meta-tarjeta.test.tsx`) | Para cada uno de los seis estados: textos y botones del Diseño §15; con una sola cuenta, un `radio` sin `checked` y "Confirmar cuenta"; con `act_90001`, se ve `…0001` y `container.innerHTML` no contiene `act_90001`, `negocio_sintetico` ni `5550001`; "Conectar" habilitado dentro de un `form` con `method="post"` y `action="/api/integraciones/meta/iniciar"` solo en `sin_conexion` | Sí |
| M16.2-T-28 | C-13, C-23 | component | `npm run test:component` | `activa` y `requiere_reauth` muestran el texto de las apps conectadas; `requiere_reauth` con `user_action` y `permission` muestra cada texto de `NEEDS_REAUTH_TEXTS` y "Volver a autorizar" en un `form` `POST` a `iniciar` | Sí |
| M16.2-T-29 | C-26, C-30 | component | `npm run test:component` (`integraciones-meta-aviso.test.tsx`, modificado) | El aviso `?meta=` sigue igual; la aserción "Conectar sigue deshabilitado" pasa a "Conectar habilitado sin conexión"; Google Analytics y Tiendanube siguen deshabilitados; `app-paginas-sesion.test.tsx` sigue verde con los mocks nuevos | Sí |
| M16.2-T-30 | C-11, C-12, C-24 | app | `npm run test:app` | Empresa sintética con pendiente creada por el flujo de M16.1 (Meta simulada): confirmación con un `deps` cuyo `http` simulado, al responder la última página de Insights, llama a `disconnect({ tenant: () => ctxSintetico, … })` con el K01 sintético de la prueba. Así la desconexión cae entre el probe y `confirm_connection` (`desconectarMeta` no se usa: en `test:app` no hay sesión de la que construir K01) → `conexion_cambio`; la empresa no tiene conexión viva; la siguiente corrida de la purga no deja filas (lectura RLS) | Sí |
| M16.2-T-31 | C-15, C-18, C-24 | app | `npm run test:app` | Conexión activada por el flujo (pendiente → confirmación con Meta simulada); reautorización completa → `reautorizado`, generación +1, `readCredential` devuelve el token nuevo; segunda reautorización con `begin_disconnect` antes de `replace_credential` → `credencial_cambio`, la conexión queda `disconnected` y la credencial no cambia. Tercera variante, sobre otra conexión activada por el flujo: un `disconnect({ tenant: () => ctxSintetico, … })` completo (bloqueo, revocación simulada y purga) intercalado antes de `replace_credential` → la base responde `not_authorized`, el resultado es `credencial_cambio`, Meta simulada recibe la revocación del token nuevo y la lectura RLS no tiene filas | Sí |
| M16.2-T-32 | C-17 | app | `npm run test:app` | Conexión activa con `act_1001`; reautorización cuyo listado no la incluye → `cuenta_no_delegada`; credencial y generación sin cambios | Sí |
| M16.2-T-33 | C-08, C-10, C-11 | app | `npm run test:app` | `begin_disconnect` directo (corte simulado después del paso 1); `loadMetaCardState` completa la purga con revocación simulada; repetirla no falla; reconectar crea una fila nueva con otro id | Sí |
| M16.2-T-34 | C-12 | app | `npm run test:app` | `disconnect` sobre una conexión activa: orden registrado `begin_disconnect` antes de la revocación; al terminar, `get_credential` da `not_authorized` y la lectura RLS no tiene filas | Sí |
| M16.2-T-35 | C-25 | app | `npm run test:app` | Pendiente vigente: `handleMetaStart` → `pendiente_vigente` (reemplaza la aserción de M16.1-T-32 sobre la pendiente); "Cancelar conexión" → sin filas; un nuevo inicio crea un intento `initial` | Sí |
| M16.2-T-36 | C-05, C-07, C-02 | app | `npm run test:app` | Confirmación real contra la base con Meta simulada: la conexión queda `active` con cuenta, `USD` y `America/Argentina/Buenos_Aires` (lectura RLS, DTO con id truncado); reenviar el mismo formulario devuelve `conexion_cambio` sin probe ni escritura y deja la fila `active` sin cambios. El reintento de transporte dentro de la primera operación se prueba en T-10 | Sí |
| M16.2-T-37 | C-21 | app | `npm run test:app` | `applyConnectionFailure` con `authentication` sobre una conexión activa → `needs_reauth` con `last_error_class` y mensaje redactado; con generación vieja no cambia; con `unknown` la fila no cambia | Sí |
| M16.2-T-38 | C-33 | app | `npm run test:app` | Sin `PRAXA_INTEGRATIONS_TEST_DB_URL` válida o con `blockedReason()` no nulo, el `beforeAll` lanza. Se verifica por inspección del patrón y por la corrida con configuración presente | No aplica TDD: es la guarda |
| M16.2-T-39 | C-34 | app | `npm run test:app` | Corrida completa: exit 0; `meta-lifecycle.test.ts` y `meta-oauth.test.ts` sin omitidas; las omitidas restantes solo son las opt-in ajenas listadas por archivo y motivo | No aplica TDD: corrida de cierre |
| M16.2-T-40 | C-34 | pgTAP | `npm run test:policies` | `08`, `09`, `09b` y `10` en verde sin cambios (regresión de transiciones, vencimiento, purga y cierre) | No: regresión |
| M16.2-T-41 | C-34 | verify | `npm run verify` | lint, typegen, typecheck, `unit`, `component` y build en verde | Sí (módulos inexistentes) |
| M16.2-T-42 | C-35 | manual | `git diff docs/SECURITY.md docs/ARCHITECTURE.md` | Solo los cambios del Diseño §17, sin TTL, nombres de funciones, conteos ni valores | No aplica TDD: documentación |
| M16.2-T-43 | CB-02, C-29 | manual | `git diff --stat` y búsqueda por patrón del diff (`EAA`, `act_` con 5 o más dígitos, `sb_secret_`, `eyJ`, el ref del proyecto, el dominio del piloto) | Solo fixtures sintéticos (`act_90001` es el único `act_` de 5 dígitos, declarado) | No aplica TDD: revisión de evidencia |
| M16.2-T-44 | C-36 | manual | Guion del Diseño §18 en producción (recorrido VR-01 de II.10, paso 11) | VD-01 registrada antes del paso 10; pasos 1 a 6 cumplidos y evidencia sin montos ni identificadores; registro cerrado al final | No aplica TDD: VR-01 |
| M16.2-T-45 | C-37 | manual | Revisión de la evidencia | Si hubo un rechazo de forma o un P que falló, la sesión se detuvo y la evidencia lo registra con la recuperación aplicada | No aplica TDD: procedimiento |
| M16.2-T-46 | C-38 | unit | `npm run test:unit` (`tests/unit/app-data.test.ts`) | Con la lectura simulada: `active` → `meta_ads` conectada; `pending_selection`, `needs_reauth`, `null`, `NoCompanyError` y `ConnectionReadError` → no conectada, sin lanzar; Google Analytics y Tiendanube siempre `false`; orden sin cambios; ninguna llamada a `worker_api` ni a `fetch`; siguen devolviendo copias | Sí |
| M16.2-T-47 | C-39, C-40 | unit | `npm run test:unit` | `inspectToken`: una petición `POST` a `/v26.0/` sin consulta, `access_token` = token de la app simulado y `batch` con `GET debug_token?input_token=…`; ninguna URL contiene el token ni el secreto; los motivos `invalid`, `wrong_app`, `missing_ads_read` y `unsupported_type` siguen iguales. `postBatchGetJson` con `relativePath` `me` lanza sin `fetch`; respuesta externa no JSON, objeto no arreglo, arreglo de dos, `[null]`, `code: 400` con `error.code: 190`, `code: 500` sin `error`, `body` con `error.code: 2` y `body` ilegible → `MetaApiError` `transport`, `unknown`, `unknown`, `transport`, `authentication`, `unknown`, `temporary` y `transport`; ningún mensaje contiene el token, el secreto ni `relative_url` (reemplaza las aserciones de M16.1 sobre el `POST` directo a `debug_token`) | Sí |
| M16.2-T-48 | C-41 | unit | `npm run test:unit` (`tests/unit/meta-preflight.test.ts`) | `runPreflight` con `fetch` simulado: una sola petición `POST` a `https://graph.facebook.com/<GRAPH_API_VERSION>/` sin consulta y con `batch` de un `GET debug_token`; respuesta válida → una línea con exactamente las seis claves, `preflight: 'ok'` y código de salida 0; `code: 400`, `is_valid: false`, HTTP 500 y error de red → `fallido` y 1; sin `META_APP_SECRET` → `sin_configuracion` y 1, sin `fetch`; la salida nunca contiene el id ni el secreto de la app simulados, ni el cuerpo de la respuesta | Sí: no existe el script |
| M16.2-T-50 | C-44 | component + manual | `npm run test:component` (`integraciones-meta-tarjeta.test.tsx`) y revisión de M03a antes de VR-01 | En `activa` y `requiere_reauth`, el `<details>` de "Desconectar" dice "base activa", "Supabase Pro" y "hasta 7 días"; `META_OAUTH_MESSAGES.desconectado.text` y el aviso `?meta=desconectado` muestran el mismo límite. El acta aprobada de M03a declara el límite de las copias | Sí para la UI; no aplica TDD al acta |
| M16.2-T-51 | C-45 | unit | `npm run test:unit` (`meta-lifecycle.test.ts`) | `disconnect` con `tenant` que lanza `UnauthorizedError` → la promesa rechaza con ese error; con `NoCompanyError` → `sin_empresa`; con `beginDisconnect` que responde `invalid_argument` → `error` sin `list_pending_purges` ni `purge_connection`. `confirmarCuentaMeta` con `UnauthorizedError` → `redirect` a `/login?next=%2Fapp%2Fintegraciones`, y el `NEXT_REDIRECT` simulado no queda capturado (sale de la acción). Reautorización con un listado de once páginas → una petición por lote a `oauth/revoke` y `meta_no_disponible`; con `debug_token` sin `ads_read` → una revocación y el mismo resultado que en `initial`. El texto de `lifecycle.ts` no contiene un `import` de `./meta/oauth` que no sea `import type`. `loadMetaCardState` con `/me` que falla con `190` → `listError: token_no_valido`; con `AccountListLimitError` → `listError: meta_no_disponible`; con `readCredential` que lanza → `kind: 'pendiente'` y `listError: 'error'` | Sí |
| M16.2-T-52 | C-46 | unit | `npm run test:unit` (`meta-lifecycle.test.ts` y `meta-oauth.test.ts`) | En `reauth` y en `initial`, con `worker_api` simulado que falla dos veces por transporte: (1) la relectura devuelve la conexión esperada y `get_credential` el mismo token → `reautorizado`/`pendiente` y ninguna petición a `oauth/revoke`; (2) la relectura no encuentra la conexión, o el token guardado es otro → una revocación y `error`; (3) la relectura lanza → una revocación y `error`. En los tres, ningún registro contiene el token ni su SHA-256 | Sí |

## Verificación

Antes de modificar archivos: `git status --short` limpio o cambios ajenos preservados; dependencias cerradas en `docs/PROJECT_STATE.md` (`G-OAUTH`); esta spec en `APROBADA`; las enmiendas coordinadas de `meta_first/plan.md` (II.10, ficha e II.11 de `M16c`, excepción puntual de tamaño) y `meta_first/spec.md` (§14) aprobadas de forma visible por el usuario. Antes de los pasos 10 a 12, además: `G-ACTA-META`, P-04 y el preflight de §19 en `ok`.

Durante y al cierre (III.3: `test:policies`, `test:app`; alta del dueño y VR-01):

```bash
npm run test:unit            # rojo esperado al escribir las pruebas; verde al final
npm run test:component       # tarjeta, aviso y app-paginas-sesion
npm run db:check:test        # destino de las pruebas: proyecto desechable
npm run test:policies        # regresión pgTAP (08, 09, 09b, 10); sin pgTAP nuevo
npm run test:app             # obligatorio: meta-lifecycle y meta-oauth sin omitidas
npm run verify               # lint, typegen, typecheck, unit, component y build
```

- `db:push:test` y `db:push` **no** aplican: la microfase no tiene migración.
- CB-06: ninguna prueba de `tests/app/meta-lifecycle.test.ts` ni `tests/app/meta-oauth.test.ts`, ni ningún caso de esta spec, puede omitirse por falta de configuración. Las omitidas admitidas son solo las opt-in ajenas (`email-flows`) y los bloques `NO EJECUTADA`, listados por archivo y motivo, sin declarar "cero omitidas".
- VR-01 se verifica con el guion del Diseño §18 y su evidencia redactada.
- H-S-22 se verifica con VD-01, la verificación posterior al despliegue que hace el usuario antes del paso 10 (§18). No completa una autorización real y no es un caso de prueba (CB-04).

## Intervenciones del usuario y acciones reservadas

| Paso | Qué hace el usuario | Cómo se verifica después |
|---|---|---|
| Enmiendas de la ruta (D-M16.2-01, -02, -05, -07, -11; A-09 a A-11) | Aprobar de forma visible la tabla ampliada de II.10, la ficha e II.11 de `M16c`, la excepción puntual de tamaño y la reasignación de la prueba de §14 | Registro de aprobación en los encabezados de `meta_first/plan.md` y `meta_first/spec.md` |
| Preflight (D-M16.2-05) | Con `META_APP_ID` y `META_APP_SECRET` en su `.env.local`, correr `node --env-file=.env.local scripts/meta-preflight.mjs` y copiar a la sesión la única línea que imprime | Línea con `preflight: ok` en `sesiones/M16.2.md`; con `fallido`, se frena antes del paso 10 |
| `G-ACTA-META` (`M03a`) | Aprobar el acta antes del alta del dueño | `PROJECT_STATE.md` |
| P-04 | Agregar al dueño como tester en la app de Meta; confirmar que aceptó y que tiene control total de su portfolio | Declaración del usuario en la sesión, sin identificadores |
| Merge, push y despliegue | Los ejecuta el usuario, antes de VR-01 | Despliegue `Ready`; "Conectar" visible en `/app/integraciones` sin ninguna autorización real hasta el paso 10 |
| VD-01: verificación posterior al despliegue de H-S-22, antes del paso 10 | Con la cuenta sintética de `M28.2a`, pulsar "Conectar" en un navegador real, revisar la petición en Network y detenerse antes de conceder acceso en Meta (§18). Está en la ficha de M16.2 y en III.2 por la enmienda | `Origin` coincidente, `303` y host de Meta; solo esos datos redactados en `sesiones/M16.2.md`. Con `403` u otro resultado se frena antes del paso 10 |
| Paso 10 (DEC-18) | Abrir el registro público en Supabase Auth del proyecto `app`, acompañar el alta del dueño y de su empresa en Configuración, cerrar el registro | Un alta nueva es rechazada después del cierre (declaración del usuario) |
| Paso 11 (VR-01) | Coordinar con el dueño el guion del Diseño §18 (cancelación, autorización, cancelación de la pendiente, autorización, confirmación) | Resultados `meta=` y líneas `meta_ciclo`/`meta_oauth` copiadas de los Runtime Logs de Vercel dentro de la retención del plan, sin `code`, `state`, montos ni ids |
| Paso 12 | No dejar una pendiente real a propósito; si la sesión se corta, pedir al dueño que cancele la conexión o volver a la página para que se purgue | Lectura del estado en la tarjeta |
| Si una petición a Meta es rechazada por su forma | Verificar con el dueño que la app quedó quitada de su negocio y decidir cómo seguir | Registro en la sesión (`H-E1-116`) |
| `db:push` y `db:push:test` | No aplican | — |
| Gate | Aprobar `G-VR01` | `PROJECT_STATE.md` |

Ninguna clave, token ni identificador se pega en el chat ni en la evidencia.

## Trampas y riesgos

De II.10:

1. **Borrar la credencial local no desinstala la app ni invalida el token en Meta.** La purga y la desconexión revocan primero; si la revocación falla, la credencial se destruye igual y la falla queda registrada sin el token.
2. **No todo `403` es un token vencido.** Se clasifica por código de Graph; timeout, red, respuesta ilegible y cualquier código no listado dejan la conexión como estaba.
3. **El alta necesita el registro abierto, y `M28.2a` lo dejó cerrado** (`entorno.md`, fila del registro público). Se abre solo durante el paso 10 y se cierra enseguida.
4. **Si fallan P-01 a P-04:** se frena y se presenta la alternativa con User Access Token antes de cambiar DEC-02.

Del código y de las fuentes:

5. **La revocación documentada pone el token y el secreto en la URL** (`GET oauth/revoke`, documentación consultada el 2026-10-16), y `debug_token` solo está documentado por `GET`. Se resuelve con el lote (D-M16.2-03): la semántica sigue siendo `GET`, pero la consulta viaja en el cuerpo. Que Graph acepte estos dos endpoints por lote es una hipótesis (H-S-19, H-S-23).
6. **`paging.next` puede llevar el token.** Se pagina por `paging.cursors.after` y nunca se pide, guarda ni registra esa URL (listado y probe).
7. **El id de la cuenta viaja en la ruta de las peticiones de Insights.** Si el hosting muestra las subpeticiones (H-S-14 de M16.1), el id completo aparece ahí, sin montos. No contradice CA-40 (no va junto a gasto), pero se declara en la evidencia.
8. **La pendiente no se puede vencer a mano en `test:app`:** las tablas no tienen grants para `service_role` (`0012_integrations.sql:26-28`) y esperar 30 minutos no es viable. El vencimiento real lo prueban pgTAP `09b` y las unitarias con `worker_api` simulado.
9. **`replace_credential` acepta un intento consumido hace 10 minutos o menos** (`0012_integrations.sql:1029`): la reautorización completa ocurre en la misma petición del callback.
10. **`confirm_connection` valida la zona contra `pg_timezone_names`** (`0012_integrations.sql:895`) y K03 contra `Intl`: pueden diferir (H-S-09). Una zona rechazada termina en `cuenta_invalida` y se registra un hallazgo.
11. **La página hace escrituras y llamadas a Meta al renderizar** (purga perezosa y listado al abrir integraciones, paso 4). `/app/integraciones` es dinámica y no tiene `loading.tsx`, y el proyecto no usa `cacheComponents`. En Next 16 el prefetch de un `<Link>` a una ruta dinámica sin `loading.tsx` se omite (`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`, "Prefetching"), así que la carga corre solo cuando el dueño abre la página. **(decisión)** Agregar un `loading.tsx` ahí está fuera de alcance. Aunque corriera de más, la purga es idempotente y acotada, y solo toca conexiones que la base ya marcó para purgar.
12. **`server-only` no está simulado en el proyecto `component`.** Importar un módulo de servidor en una página rompe `app-paginas-sesion.test.tsx` si no se simula (D-M16.2-01).
13. **Pruebas de M16.1 que fijan comportamiento que cambia** (T-10, T-21, T-32, T-33). Modificarlas sin autorización es un desvío (D-M16.2-01).
14. **Retención de los Runtime Logs en Hobby: 1 hora** (H-S-09 de M16.1). La evidencia de VR-01 se copia enseguida o se pierde.
15. **Una credencial real puede quedar pendiente entre visitas** si el dueño abandona la selección (límite declarado de CA-37b). El guion termina con la conexión activa o cancelada.
16. **`readCredential` recifra al leer** si la versión de clave es vieja (`credentials.ts:274-300`). En `disconnected` no recifra; en una pendiente sí: es correcto y no cambia el flujo.
17. **Las Server Actions verifican `Origin` contra el host** (comportamiento de Next); el formulario a `iniciar` depende del `Origin` del `POST` del navegador (D-M16.1-06).
18. **El identificador `act_` completo nunca va al HTML.** Un `value` con el id en un `radio` lo dejaría en el HTML aunque no se vea; por eso `selectionKey`. Un hash simple del id tampoco alcanza, porque son solo dígitos: se liga a la conexión (D-M16.2-08).
19. **Fixtures.** `act_` con muchos dígitos o un `?access_token=` de 20 o más caracteres en un fixture rompe la búsqueda de CB-02 o `no-secrets-in-tree`.
20. **El layout de todo `/app` lee la conexión** por `getIntegraciones` (D-M16.2-02). Un fallo ahí no puede romper las pantallas: se degrada a "no conectado" (§20).
21. **El preflight lo corre el usuario con sus secretos locales.** El asistente no lee `.env.local` ni ve la salida antes de que el usuario la copie. El script imprime solo campos cerrados (§19).
22. **Escritura ambigua de la credencial.** Si la escritura y su relectura fallan por transporte, el callback revoca el token nuevo aunque la base pudiera haberlo guardado (§11, paso 4 de `resolveAmbiguousWrite`). La conexión puede quedar con una credencial revocada en Meta: la primera llamada con ella da `authentication` y pasa a `needs_reauth` (CA-39), recuperable con "Volver a autorizar". Hasta `M16c` ninguna llamada usa la credencial de una conexión `active`, así que en M16.2 se vería recién al abrir la tarjeta de una pendiente (`listError: token_no_valido`).

## Decisiones de la microfase

| ID | Decisión | Motivo | Decidió | Fecha |
|---|---|---|---|---|
| D-M16.2-01 (ex `M16.2-Q-01`; **ENMIENDA APROBADA EN LA RUTA**) | Enmienda de II.10: un paso de pruebas existentes (`tests/unit/meta-oauth.test.ts`, `tests/app/meta-oauth.test.ts`, `tests/component/integraciones-meta-aviso.test.tsx`, `tests/component/app-paginas-sesion.test.tsx`), la prueba de componente nueva de la tarjeta y un paso de documentación (`docs/SECURITY.md`, `docs/ARCHITECTURE.md`, Diseño §17), como en D-M16.1-01 y D-M16.1-02. La misma enmienda lista los archivos existentes de M16.1 que se modifican fuera de la tabla de II.10 (`meta/api.ts`, `meta/client.ts`, `meta/tokens.ts`, `meta/oauth.ts`, `meta/outcomes.ts`, `repository/connections.ts`; A-10) y pasa a `M16c` (II.11 paso 9) la revocación y la desconexión durante una sincronización de la §14 de la spec de la ruta (A-09). El detalle está en la fila de `meta_first/plan.md` de "Archivos previstos" | Sin las pruebas `verify` no pasa, y el contrato documental exige actualizar los controles que pasan de previstos a vigentes. La alternativa sin tocar las pruebas de M16.1 deja sin cumplir los pasos 4 y 5 | Usuario (grill) | 2026-10-16 |
| D-M16.2-02 (ex `M16.2-Q-02`; **ENMIENDA APROBADA EN LA RUTA**) | `getIntegraciones` lee la conexión real para `meta_ads` (conectada solo si `active`), con lectura RLS sin purga ni llamadas a Meta y con degradación a "no conectado" ante cualquier error (Diseño §20). Se agregan `src/modules/app-data/index.ts` y `tests/unit/app-data.test.ts` | Evita que durante VR-01 y la demo el dueño vea "Conectado" en Integraciones y "No conectado" en Inicio, en el chip y en Chat. Efecto aceptado: Chat lista Meta Ads como fuente antes de que haya datos (`M16c`) | Usuario (grill) | 2026-10-16 |
| D-M16.2-03 (ex `M16.2-Q-03` y `M16.2-Q-05`) | `debug_token` y la revocación viajan como una operación `GET` dentro de un `POST` por lote a `https://graph.facebook.com/v26.0/`, con `access_token` y `batch` en el cuerpo y la URL sin consulta (Diseño §2b, §3, §6). El canje sigue por `POST oauth/access_token` | La documentación oficial solo muestra `GET` para los dos endpoints, con credenciales en la consulta, lo que D-M16.1-08 prohíbe. Un `POST` directo sobre un endpoint de lectura arriesga `Unsupported post request` (`H-E1-116`), y no se encontró documentación del override `method=GET`. Las solicitudes por lote son la vía documentada con semántica `GET` y credenciales en el cuerpo. Descartadas: `POST` simple, `POST` con `method=GET` y la excepción con `GET` para revocar | Usuario (grill) | 2026-10-16 |
| D-M16.2-04 (ex `M16.2-Q-04`) | Caso A: texto en `rechazado` y `meta_no_disponible` sobre cómo quitar a Praxa del negocio. Caso B: ante un fallo confirmado antes de guardar, revocación inmediata y única del token nuevo en la misma petición. Si la escritura es ambigua, se relee antes de decidir si revocar (A-14, C-46). En VR-01, un fallo de cualquiera de los dos casos frena (Diseño §11) | Evita tokens válidos sin guardar ni revocar y, tras una escritura ambigua que sí se aplicó, evita invalidar la credencial guardada. No necesita migración | Usuario (grill); precisión técnica de A-14 | 2026-10-16 |
| D-M16.2-05 (**ENMIENDA APROBADA EN LA RUTA**) | Preflight `scripts/meta-preflight.mjs` (`debug_token` por lote con el token de la app) que corre el usuario antes del paso 10, con su prueba `tests/unit/meta-preflight.test.ts` (Diseño §19) | Si el lote falla, la primera autorización real cae en el caso B y su revocación probablemente también falla (falla correlacionada). El preflight lo detecta sin crear ninguna autorización real | Usuario (grill) | 2026-10-16 |
| D-M16.2-06 (ex `M16.2-Q-06`) | Con una pendiente vigente, `iniciar` sigue respondiendo `pendiente_vigente` sin crear intento; la tarjeta ofrece elegir la cuenta o "Cancelar conexión" | Ninguna acción destruye una autorización sin que el dueño lo pida explícitamente | Usuario (grill) | 2026-10-16 |
| D-M16.2-07 (ex `M16.2-Q-07`; **ENMIENDA APROBADA EN LA RUTA** en la ficha de `M16c`) | En M16.2, las clases que no llevan a `needs_reauth` solo dejan una línea `meta_ciclo error_conexion`; la parte persistente de `H-E1-22` se reasigna a `M16c` | En M16.2 ninguna llamada usa la credencial de una conexión `active` (Diseño §9.6). Una migración ahora obligaría a renumerar `0015` y `0016` | Usuario (grill) | 2026-10-16 |
| D-M16.2-08 | `selectionKey` = SHA-256 hex de `connectionId:accountId`, calculado en `lifecycle.ts` | Un SHA-256 simple de un id de solo dígitos se invierte por fuerza bruta y vale para cualquier pendiente futura. El UUID de la conexión nunca sale del servidor. Sin estado nuevo ni secreto nuevo | Usuario (grill) | 2026-10-16 |
| D-M16.2-10 (A-04) | CA-38b se hereda solo en la declaración de la UI: la advertencia de "Desconectar" y el resultado `desconectado` aclaran el borrado de la base activa y que, con Supabase Pro, las copias nocturnas pueden conservar los datos hasta 7 días (C-44, T-50). Antes de VR-01 se verifica la misma declaración en el acta de M03a. El resto de CA-38b queda donde ya se cumple (tabla "Heredados de la ruta") | La UI de desconexión la construye esta microfase y CA-38b exige que lo declare. Las demás reglas ya tienen dueño en M16.1, `M16c`, `M28.3a` y `M03a` | Usuario | 2026-10-16 |
| D-M16.2-11 (observación de tamaño de las auditorías 1 y 2) | M16.2 se mantiene como una sola microfase y no se divide en M16.2.1 y M16.2.2. El usuario exceptúa para este corte el límite de 8 horas de `AGENTS.md` ("Reglas de las microfases") | Confirmado por el usuario en la consulta de esta corrección: «Sí, un solo corte sin límite de 8 horas». El riesgo de un corte grande se acota con el orden de implementación del plan, que el plan de la microfase tiene que fijar en etapas verificables | Usuario | 2026-10-16 |

La numeración salta D-M16.2-09: se retiró tras A-08 de la auditoría 1, y su aclaración no material quedó en la trampa 11 como **(decisión)**. Las decisiones no materiales tomadas al expandir están en "Diseño concreto", marcadas **(decisión)**.

## Supuestos e hipótesis

- **H-01 — HIPÓTESIS (ruta).** `/{system-user-id}/assigned_ad_accounts` alcanza con `ads_read`. La referencia oficial (consultada el 2026-10-16) no indica el permiso ni lista `name`, `currency` o `timezone_name` en la página del edge: remite al nodo AdAccount. *Cómo y cuándo:* VR-01, paso 3. Si falla, se frena.
- **H-02 — HIPÓTESIS (ruta; H-S-04 de M16.1).** `debug_token` informa `type: 'SYSTEM_USER'`, validez, app y permisos. *Cómo y cuándo:* VR-01, paso 3, con `motivo` en el registro.
- **H-03 — HIPÓTESIS (ruta).** La revocación funciona con este tipo de token. La documentación (2026-10-16) la describe por `GET` con `revoke_token`, `client_id`, `client_secret` y `access_token` en la consulta, respuesta `{"success": "true"}` e invalidación inmediata, y exige que las tres apps coincidan. *Cómo y cuándo:* VR-01, paso 4, por lote (D-M16.2-03).
- **H-04 — HIPÓTESIS (ruta).** Código de error al quitar la cuenta de la delegación. Opcional, al cierre; `asset_access` sigue sin asignarse.
- **H-S-03, H-S-05, H-S-07, H-S-13, H-S-15 — HIPÓTESIS (M16.1, `H-E1-117`).** Se verifican en VR-01, pasos 2 y 3. De H-S-13, la parte de `debug_token` pasa a H-S-23.
- **H-S-09 (M06.1a-M06.2a) — HIPÓTESIS.** Las zonas de Meta que acepta `Intl` existen en `pg_timezone_names`. *Cómo y cuándo:* VR-01, paso 5.
- **H-S-16 — HIPÓTESIS.** `/me?fields=id,client_business_id` con el token de system user devuelve en `id` el identificador del system user que acepta `assigned_ad_accounts`. *Cómo y cuándo:* VR-01, paso 3.
- **H-S-17 — HIPÓTESIS.** Cada elemento de `assigned_ad_accounts` trae `id` con la forma `act_<dígitos>`, `currency` ISO 4217 y `timezone_name` IANA. *Cómo y cuándo:* VR-01, paso 3; si difiere, las cuentas quedan como descartadas y se frena.
- **H-S-18 — HIPÓTESIS.** Insights acepta `level=account`, `time_increment=1` y `date_preset=last_28d`, y una cuenta sin actividad devuelve `data: []` con 200. *Cómo y cuándo:* VR-01, paso 5.
- **H-S-19 — HIPÓTESIS.** Graph acepta `GET oauth/revoke` como operación de una solicitud por lote, con `client_id`, `client_secret` y `revoke_token` en el `relative_url`. La documentación de lotes no lo excluye, pero tampoco lo nombra. *Cómo y cuándo:* VR-01, paso 4; no se puede probar en el preflight.
- **H-S-23 — HIPÓTESIS.** Graph acepta `GET debug_token` como operación de una solicitud por lote, con `input_token` en el `relative_url` y el token de la app como `access_token` del lote, y responde con el mismo `data` que la petición directa. Reemplaza la parte de H-S-13 (M16.1) sobre el `POST` directo a `debug_token`; la del canje sigue en H-S-13. *Cómo y cuándo:* preflight de §19 con el token de la app, antes del paso 10; con un token de system user, VR-01 paso 3.
- **H-S-20 — HIPÓTESIS.** En la revocación, `access_token` puede ser el mismo token que se revoca ("a token that identifies the caller", emitido para la misma app). *Cómo y cuándo:* VR-01, paso 4.
- **H-S-21 — HIPÓTESIS.** Quitar la app desde la configuración del negocio en Meta (integraciones o apps conectadas) invalida el token de system user. *Cómo y cuándo:* informativa; el texto de la UI no afirma más que dónde quitarla.
- **H-S-22 — HIPÓTESIS.** El formulario `POST` del navegador a `/api/integraciones/meta/iniciar` desde `/app/integraciones` lleva `Origin` igual al de la página, que es lo que exige `oauth.ts:187`. *Cómo y cuándo:* VD-01 (verificación posterior al despliegue a cargo del usuario, §18), con la cuenta sintética y Network del navegador tras el despliegue `Ready`, antes del paso 10; se comprueban `Origin` coincidente y `303` hacia Meta sin conceder acceso. Un `403` frena el recorrido.

## Preguntas abiertas

Ninguna. Las siete preguntas de la expansión (`M16.2-Q-01` a `M16.2-Q-07`) se resolvieron en el grill del 2026-10-16 y están en "Decisiones de la microfase" (D-M16.2-01 a D-M16.2-07). Tres de ellas exigen una enmienda visible de la ruta antes de implementar (D-M16.2-01, -02, -05) y una toca la ficha de `M16c` (D-M16.2-07).

## Hallazgos relacionados

- `H-E1-13` (M16.2, VR-01): se cierra con la evidencia de VR-01, que prueba el flujo con un tercero (el dueño).
- `H-E1-21` (M16.2): purga y revocación de la pendiente (C-08, C-25); `iniciar` sigue en `pendiente_vigente` (D-M16.2-06).
- `H-E1-22` (M16.2): el registro sin escritura se cumple acá (C-22); la parte persistente se reasigna a `M16c` (D-M16.2-07).
- `H-E1-28` (M16.2): la moneda real se valida con K03 antes de `confirm_connection` (C-02, §8).
- `H-E1-100`: "Conectar" se habilita (C-26).
- `H-E1-114` (M16.2, antes de la primera autorización real): D-M16.2-03, D-M16.2-04 y D-M16.2-05; C-14, C-19, C-20, C-41.
- `H-E1-116` (M16.2, VR-01): `debug_token` pasa a lote (D-M16.2-03) y se prueba con el preflight (D-M16.2-05); el canje por `POST` y `/me` con `Authorization` siguen pendientes de VR-01; C-37, C-39, C-41.
- `H-E1-117` (M16.2, VR-01): guion del Diseño §18, pasos 2 y 3.
- `H-E1-25`: la validación de zona en la base sigue con su costo; sin cambio.
- `H-E1-40` (A-15): **diferido, no se incluyó en la enmienda M16.2.** Depende de una decisión pendiente del usuario (`PROJECT_STATE.md`, "Decisiones pendientes"). Las referencias a "la línea 181 de `SECURITY.md`" están en la ficha de M03a, II.8 y la §15 de la spec de la ruta, que esta microfase no toca. Incluirlo habría ampliado la enmienda sin esa decisión. Queda asignado a una corrección posterior de la ruta.
- `H-E1-82`: la landing dice que Meta Ads "ya está disponible"; con M16.2 empieza a ser cierto solo para cuentas con rol en la app (`H-E1-01`). Sigue siendo decisión de copy del usuario.
- Nuevos a registrar en `docs/HALLAZGOS.md` al implementar, con ID estable: el comentario desactualizado de `purge_connection` (`0012_integrations.sql:1276`, nombra `0013` y `0014`; informativo, sin corrección por CB-03), y cualquier diferencia que VR-01 encuentre en H-01 a H-03, H-S-09 o H-S-16 a H-S-20.

## Auditorías

| Ronda | Informe | Veredicto | Estado |
|---|---|---|---|
| 1 | `revisiones/spec-audit-1.md` (informe vigente en disco, hash auditado `90c41832…`) | REQUIERE CAMBIOS | Corregidos en la spec: A-01 (§2b, C-40, T-47), A-02 (§9.3, T-36), A-03 (§20), A-05 (§9.3 a §10, §13, C-45, T-51), A-06 (§17, C-28), A-07 (T-30) y A-08 (D-M16.2-09 retirada). A-04 resuelto con D-M16.2-10 (C-44, T-50). A-09 y A-10 incluidos en las enmiendas preparadas de `meta_first/plan.md` y `meta_first/spec.md`, pendientes de aprobación visible. Observación de tamaño: D-M16.2-11 |
| 2 | `revisiones/spec-audit-2.md` (hash auditado `f29d2e3e…`) | REQUIERE CAMBIOS | Mismos IDs que la ronda 1, más A-11 y A-12. A-11: las enmiendas coordinadas de la ruta están redactadas y señaladas como pendientes de aprobación visible; A-12: seguimiento corregido en esta tabla. Reauditar esta versión (ronda 3) |
| 3 | `revisiones/spec-audit-3.md` (hash auditado `5843db44…`) | REQUIERE CAMBIOS | Confirma resueltos A-01, A-03 a A-07, A-09, A-10, A-11 (en lo que depende de la spec) y A-12. Corregidos después: A-13 (CB-04 textual en "Heredados"; la comprobación de H-S-22 pasa a ser la verificación posterior al despliegue VD-01; C-43/T-49 retirados para no tratarlos como criterio y caso de prueba contra producción; preflight y VD-01 en la ficha de M16.2 y en III.2 de la enmienda), A-14 (§9.5 paso 5, §11 "Escritura ambigua", trampa 22, C-18, C-46, T-18, T-31, T-52), A-15 (`H-E1-40` diferido con su motivo en "Hallazgos relacionados"), A-16 (CA-39 en la ficha de `M16c` de la enmienda) y A-17 (§9.3 paso 4, §9.5 `etapa`, §13 dependencias de la purga, T-13, T-51). `revisiones/enmienda-ruta-1.md` se amplió para verificar A-13 y A-16; ambas enmiendas fueron aprobadas por el usuario el 2026-10-16. Reauditar esta versión (ronda 4) |
