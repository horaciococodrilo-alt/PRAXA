# M06.3a — Spec de la microfase

**Estado:** BORRADOR

Estados posibles: `BORRADOR` → `APROBADA`. Solo el usuario pasa una spec a `APROBADA`, y solo después de una auditoría APROBABLE.

**Hash de contenido.** Se calcula sin la línea de estado:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M06.3a/spec.md | git hash-object --stdin
```

## Fuentes

- Ruta: `docs/FASES/FASE1/meta_first/plan.md`: ficha de `M06.3a` en la Parte I (plan.md:210-223), sección II.6 (plan.md:501-522), precondiciones 8 y 9 de la Parte II (plan.md:370-371), III.2 (plan.md:767), III.3 (plan.md:789) y III.9 (plan.md:892-905). `docs/FASES/FASE1/meta_first/spec.md`: sección 5 (spec.md:91-106), sección 7 (spec.md:144-184), K04 (spec.md:218-225), sección 9, CA-21 y CA-23 a CA-27 (spec.md:238-250), 13b (spec.md:515) y CB-01 a CB-06 (spec.md:536-541).
- Borrador original recuperado de `b1bb059` (rama local `M06.3a`), expandido sobre `06f6fae`. Actualizado por el grill del 2026-10-01 sobre `main@25bf4ab`, incluido el contrato documental de `a6e37ee`. Continúa BORRADOR; Q-01 a Q-11 resueltas, pendiente confirmación global del cierre del grill. Las referencias de línea al plan corresponden a la expansión original; los títulos de sección gobiernan la lectura.
- Microfases previas en las que se apoya: `M05.1.1` (K01, `G-K01`), `M05.1.2` a `M05.1.4` (K02 a K04, `G-K02-K04`) y el grupo `M06.1a-M06.2a` (migración `0012`, `G-DB-META` aprobado el 2026-09-28; `docs/PROJECT_STATE.md`). Evidencia: `docs/FASES/FASE1/meta_first/sesiones/M05.1.1.md`, `M05.1.2-M05.1.4.md` y `M06.1a-M06.2a.md`.
- IDs cubiertos: solo `M06.3a`. La sección II.6 no agrupa otras microfases.
- Hallazgos asignados a esta microfase en `docs/HALLAZGOS.md`: `H-M04.1-02` (HALLAZGOS.md:8), `H-E1-09` (:26), `H-E1-10` (:27), `H-E1-17` (:34), `H-E1-36` (:53, solo la comprobación de acceso) y `H-E1-37` (:54). `H-E1-12` aplica a todas.

## Objetivo

Tomado de la ficha (plan.md:215), sin ampliarlo: cifrar y descifrar credenciales en el servidor, y acceder a `worker_api` solo desde un módulo `server-only`.

## Alcance

De la ficha (plan.md:216-217) y de II.6 (plan.md:503-516):

1. Llavero `PRAXA_CREDENTIAL_KEYS` (pares `versión:clave_base64`, 32 bytes cada clave) y versión actual `PRAXA_CREDENTIAL_KEY_CURRENT` (II.6, paso 2).
2. `seal` y `open` con AES-256-GCM de `node:crypto`, IV aleatorio de 12 bytes por operación y AAD = empresa, conexión y proveedor (paso 3; CA-11b, CA-23, CA-24).
3. Rotación de claves según CA-25: cifrado con la clave actual, descifrado con la versión guardada, recifrado al usar la credencial y retiro de una clave solo cuando `worker_api.count_credentials_by_key_version` confirma que ninguna credencial la usa.
4. Cliente `pg` del rol de C (`praxa_integrations`), `server-only`, por el pooler en modo transacción y sin prepared statements con nombre (paso 4).
5. Repositorio de credenciales sobre `worker_api` (paso 5; CA-21), incluida la mitigación de `H-E1-37` a nivel repositorio según D-M06.3a-04.
6. `pg` pasa de `devDependencies` a `dependencies` (paso 6; `H-E1-09`).
7. Extensión de `tests/unit/no-privileged-credentials.test.ts` (paso 7; CA-27 reescrita; `H-E1-10`).
8. Extensión de `check-target` para `PRAXA_INTEGRATIONS_TEST_DB_URL` (paso 7b; T09).
9. Cierre de `H-M04.1-02`: se quita la excepción `SUPABASE_TEST_ALLOW_APP_PROJECT` (paso 7c).
10. Recorrido del árbol en busca de claves, tokens y códigos OAuth (paso 8; CA-26).
11. Documentación de la excepción acotada en `docs/SECURITY.md` y `docs/ARCHITECTURE.md` (paso 9; spec.md:180-184).
12. Variables nuevas en `.env.example`, sin valores (paso 10).
13. La comprobación de acceso real con el rol (`H-E1-36`; `docs/PROJECT_STATE.md`, entrada de `M06.1a-M06.2a`), mediante la suite permanente decidida en D-M06.3a-01.
14. La decisión sobre `H-E1-17` (`server-only` en Vitest), según `M06.3a-Q-03`.

## Fuera de alcance

- Cualquier migración. `0012` no se modifica (CB-03) y esta microfase no crea ninguna: la ruta reserva `0013` para `M16c` (plan.md:291). Q-04 quedó resuelta sin migración.
- Rutas OAuth, canje del código, `debug_token`, cliente HTTP de Meta y su redacción de errores (`M16.1`). La segunda mitad de CA-26 ("otra verifica la redacción de errores del cliente HTTP") es de `M16.1`, paso 2 (plan.md:571); acá solo se prueba la redacción de los errores del cliente `pg`.
- Repositorio de conexiones e intentos: `create_oauth_attempt`, `consume_oauth_attempt`, `confirm_connection`, `mark_needs_reauth`, `begin_disconnect`, `purge_connection` y `list_pending_purges` no tienen envoltorio de dominio en esta microfase (`M16.1`, `M16.2`). El cliente de `worker_api` las declara, pero solo el repositorio de credenciales las usa (ver Diseño §5).
- Un comando explícito de recifrado masivo (CA-25, paso 3, admite "al usar cada credencial **o** con un comando explícito"): se elige el recifrado al usar (plan.md:452).
- Variables `META_*` y `DEEPINFRA_API_KEY` en `.env.example`: son de `M16.1` y `M25a.2`. Esta microfase agrega solo las cuatro que usa.
- Cargar variables en Vercel, la contraseña del rol en el proyecto `app`, `PRAXA_INTEGRATIONS_DB_URL` real y la verificación de esquemas expuestos del proyecto `app`: `M28.2a` (plan.md:533-535).
- La política de retención: corresponde a M03a. Tras el refactor documental vive en SECURITY §9; las referencias antiguas de la ruta se siguen en H-E1-40 y no se corrigen en este corte.
- `force row level security` en tablas existentes y el cambio de dueño de las funciones: pendientes declarados en CA-14, fuera de la ruta.
- `H-E1-35` y el endurecimiento del rol de `H-E1-36` en la migración: `M16c`. Acá solo se comprueba el acceso.
- `H-E1-18` y `H-E1-20` (inestabilidad de Vitest): no se toca `vitest.config.mts`; Q-03 eligió mocks por suite.
- `src/lib/env.ts:9-12` dice que la aplicación no usa ninguna credencial de servicio. Queda desactualizado con esta microfase, pero no está en la tabla de II.6: se registra como hallazgo al implementar y no se edita.
- `act_` con dígitos y otros datos de negocio en el recorrido del árbol: CA-26 trata secretos; la búsqueda de identificadores de cuenta ya se hizo en `M04a` (`H-E1-04`).

## Contexto verificado en el código

| Qué | Dónde (archivo:línea) | Qué implica para esta microfase |
|---|---|---|
| K04: IV de 12 bytes y etiqueta de 16 | `src/modules/integrations/contract/credential.ts:22-23` | `seal` genera exactamente esos tamaños |
| K04: forma del material (`ciphertext` base64 no vacío, `iv`, `auth_tag`, `key_version` entero positivo, `token_type` `system_user`, `issued_for_app_id`, `granted_scopes` con `ads_read`, `expires_at` nullable) | `credential.ts:32`, `:37-60` | El repositorio valida lo que escribe y lo que lee con estos esquemas |
| K04: AAD = `praxa.credential.v1\|provider\|company_id\|connection_id`, validado antes de unir | `credential.ts:64-86` | `seal` y `open` usan `buildCredentialAad` tal cual; no se inventa otro AAD |
| Base64 estándar con relleno; `base64OfBytes` decodifica y cuenta | `src/modules/integrations/contract/primitives.ts:18-26` | Mismo criterio para las claves del llavero (44 caracteres → 32 bytes) |
| Proveedor único `meta` | `primitives.ts:33` | El AAD usa `'meta'` |
| El barrel exporta `buildCredentialAad`, `secretCredentialSchema`, `tokenTypeSchema`, `GCM_*`; no exporta `base64OfBytes` | `src/modules/integrations/contract/index.ts:59-70`, `:10-31` | El módulo de cifrado importa `base64OfBytes` desde `contract/primitives` directamente |
| K01 `TenantContext`: `user_id`, `company_id`, `role`, `request_id`; `import 'server-only'` en la línea 1 | `src/modules/tenant/context.ts:1`, `:21-28` | El repositorio toma `p_actor_user_id` y `p_company_id` del K01 (spec.md:150). Se importa solo el tipo, para no arrastrar el cliente de Supabase a las pruebas |
| `get_credential` devuelve `status` y `credential_generation` además del material, responde en cualquier estado y da cero filas si la conexión propia no tiene credencial | `supabase/migrations/0012_integrations.sql:805-862` | `readCredential` decide el recifrado con el estado leído (`H-E1-37`) |
| `rewrap_credential(actor, empresa, conexión, generación esperada, versión esperada, material, versión nueva)`: `PX006` si la generación cambió, `PX008` si la versión guardada no es la esperada, `22023` si la nueva no es mayor; **no mira el estado** | `0012_integrations.sql:1401-1514` (generación: `:1449-1451`; versión: `:1478-1487`) | Confirma `H-E1-37`. El recifrado solo pide versiones crecientes |
| `begin_disconnect` incrementa la generación al pasar a `disconnected`; `replace_credential` también; `confirm_connection` y `mark_needs_reauth` no | `0012_integrations.sql:1249`, `:1090`; `:919`, `:1167` | Una desconexión entre la lectura y el recifrado hace fallar el recifrado con `PX006` (base de la opción A de `M06.3a-Q-04`) |
| `count_credentials_by_key_version()`: global, sin actor, `(key_version integer, credential_count bigint)` | `0012_integrations.sql:1380-1395` | `count` llega como cadena desde `pg` (bigint): hay que convertirlo |
| Catálogo de errores `PX001` a `PX008` y `22023`, mensajes fijos sin detalles | `0012_integrations.sql:80-91`; spec de `M06.1a-M06.2a`, Diseño §6 | El cliente traduce cada SQLSTATE a un error tipado |
| El rol solo tiene `USAGE` sobre `worker_api` y `EXECUTE` función por función; ninguna tabla | `0012_integrations.sql:109-110`, `:206`, `:1520` en adelante | Una lectura directa de tabla con el rol da `42501` |
| `pg` 8.23.0 está en `devDependencies`; `@types/pg` también | `package.json:42`, `:49`; `node_modules/pg/package.json` | Paso 6. `@types/pg` se queda en `devDependencies` |
| El lockfile marca `pg` y sus dependencias con `"dev": true` | `package-lock.json:6819-6823`, `:6872-6876` | Mover `pg` cambia `package-lock.json`, incluido en II.6 por decisión del grill (`M06.3a-Q-02`) |
| Next externaliza `pg` por defecto (no lo empaqueta): tiene que estar instalado en producción | `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md:75` | Refuerza `H-E1-09` |
| `server-only` no está instalado; Next lo resuelve internamente y su instalación es opcional | `node_modules/server-only` inexistente; `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md:584`, `:602` | `H-E1-17`: las suites que importen módulos `server-only` necesitan `vi.mock('server-only', () => ({}))`, como `tests/unit/tenant-context.test.ts:11` (`M06.3a-Q-03`) |
| Scripts: `test` = `unit` + `component`; `test:unit`, `test:app`, `test:policies`, `db:check:test`, `verify` | `package.json:14-26` | Comandos de los casos de prueba |
| Proyectos de Vitest: `unit` (node, `tests/unit/**/*.test.ts`), `component`, `app` (node, `setupFiles` que carga `.env.local`, sin paralelismo por archivo) | `vitest.config.mts:24-58`; `tests/app/setup.ts:12-15` | Las pruebas nuevas de cifrado son `unit`; la prueba con la base real sería `app` (`M06.3a-Q-01`) |
| `no-privileged-credentials`: siete nombres prohibidos bajo `src/` y `proxy.ts`, más la prueba de `.env.example` sin valores | `tests/unit/no-privileged-credentials.test.ts:19-29`, `:43-68`, `:70-81` | Paso 7: se extiende sin romper lo existente (CA-27) |
| `refFromDbUrl` solo reconoce el usuario `postgres.<ref>` | `scripts/lib/target.mjs:36-51` (regex en `:41`) | Una URL con usuario `praxa_integrations.<ref>` no deduce el proyecto: el paso 7b necesita su propio análisis del usuario |
| Excepción `SUPABASE_TEST_ALLOW_APP_PROJECT` | `scripts/lib/target.mjs:179-188`; `tests/app/helpers.ts:53-62` | Paso 7c; única aparición fuera de la documentación histórica |
| `check-target test` valida la URL SQL de pruebas solo si está cargada | `scripts/check-target.mjs:9-31` | El paso 7b sigue el mismo patrón para la URL del rol |
| `resolveSqlTestTarget(env)`: función pura, solo `SUPABASE_TEST_DB_URL`, desechable, distinto del proyecto `app`, sin recurrir a `SUPABASE_DB_URL` | `scripts/lib/sql-target.mjs:28-106` | El resolvedor del rol se apoya en él; vive en el mismo archivo (`M06.3a-Q-02`) |
| `sql-test-target.test.ts` prueba `resolveSqlTestTarget` sin conectarse; sus fixtures usan contraseñas `secreta` y `clave` | `tests/unit/sql-test-target.test.ts:3`, `:15-19`, `:87` | Paso 7b agrega casos ahí. El recorrido del árbol tiene que tolerar esas contraseñas sintéticas |
| `supabase-key-formats.test.ts` tiene un JWT sintético sin firma real | `tests/unit/supabase-key-formats.test.ts:24` | El patrón de JWT del recorrido necesita una lista de marcadores sintéticos |
| Conexiones `pg` existentes: `ssl: { rejectUnauthorized: false }` | `scripts/run-pgtap.mjs:240-244`; `tests/app/integrations-data-api.test.ts:89-93` | Precedente que no se adopta en el nuevo cliente; TLS estricto decidido en `M06.3a-Q-05` |
| La guía de Supabase: pooler en modo transacción en el puerto 6543, sin prepared statements; usuario de un rol propio `[ROLE].[PROJECT-REF]`; `require` cifra pero no verifica al servidor, `verify-full` con el certificado raíz sí | https://supabase.com/docs/guides/database/connecting-to-postgres (consultada al expandir) | Diseño §5, §7 y `M06.3a-Q-05` |
| `.env.example`: el encabezado dice "Ocho variables", pero el archivo declara nueve; la sección final dice que no hay credenciales de integraciones | `.env.example:9`, `:21-74`, `:76-85` | Paso 10: el conteo se recalcula desde el archivo (trece) y la sección final se actualiza |
| `prepare-env` agrega a `.env.local` las claves nuevas de `.env.example`, sin tocar valores | `scripts/prepare-env.mjs:26-56` | Primer paso de la intervención del usuario |
| El README repite "Ocho variables" y lista las de prueba | `README.md:72`, `:96-104` | Solo se actualizarán la tabla de variables de prueba y las salvaguardas (`M06.3a-Q-02`) |
| Node del proyecto: 24.18.1 | `.nvmrc`; `package.json:6` | Verificado al expandir: sin `authTagLength`, `createDecipheriv` acepta una etiqueta GCM de 4 bytes y solo emite `DEP0182` |
| `z.iso.datetime({ offset: true })` acepta el `toISOString()` de un `Date` | Verificado al expandir con el `zod` instalado | `expires_at` llega de `pg` como `Date` y se convierte con `toISOString()` |
| La CI corre `npm ci` y `npm run verify` sobre un checkout de Git | `.github/workflows/verify.yml` | El recorrido del árbol puede usar `git ls-files`; `npm ci` exige lockfile sincronizado (paso 6) |

El refactor `a6e37ee` ya documenta los tres esquemas, contratos existentes y capacidades por categoría. Diseño §11 parte de esas secciones actuales, no del texto previo a ese refactor.

## Diseño concreto

### 1. Módulos

```
src/modules/integrations/
  crypto/keyring.ts        llavero (II.6, paso 2)
  crypto/seal.ts           seal/open y SecretValue (paso 3)
  db/worker-api.ts         cliente pg del rol de C (paso 4)
  repository/credentials.ts  repositorio de credenciales (paso 5)
```

Los cuatro empiezan con `import 'server-only';` como primera sentencia (decisión no material: los cuatro manipulan claves, tokens o la conexión del rol; II.6 lo exige para `worker-api.ts`). `SecretValue` vive en `seal.ts` para no sumar archivos.

### 2. Llavero (`crypto/keyring.ts`)

Formato de las variables (decisión no material: el separador entre pares no lo fija la ruta; la coma y los dos puntos no pertenecen al alfabeto base64):

- `PRAXA_CREDENTIAL_KEYS="1:<base64>,2:<base64>"`. Espacios alrededor de cada par y de cada separador se ignoran.
- Cada versión es un entero decimal entre 1 y 2147483647 (el `key_version integer check (> 0)` de la tabla), sin ceros a la izquierda, sin repetir.
- Cada clave es base64 estándar con relleno, exactamente 44 caracteres, y decodifica a exactamente 32 bytes (misma regla que `base64OfBytes`, `primitives.ts:22-26`).
- `PRAXA_CREDENTIAL_KEY_CURRENT` es una de las versiones del llavero.

```ts
export type CredentialKeyring = {
  readonly currentVersion: number;
  readonly versions: readonly number[];      // ordenadas
  has(version: number): boolean;
  keyFor(version: number): Buffer;           // copia; si no está, CredentialKeyVersionUnknownError
};

export function parseCredentialKeyring(keys: string | undefined, current: string | undefined): CredentialKeyring;
export function getCredentialKeyring(): CredentialKeyring;  // lee process.env una vez y memoiza
```

Errores:

| Clase | `code` | Cuándo | Mensaje (sin material) |
|---|---|---|---|
| `CredentialKeyringError` | `keyring_missing` | Falta o está vacía `PRAXA_CREDENTIAL_KEYS` | `Falta PRAXA_CREDENTIAL_KEYS.` |
| `CredentialKeyringError` | `keyring_invalid` | Par sin `:`, versión inválida o repetida, clave que no es base64 de 32 bytes | Indica la **posición** del par (1, 2, …) y el motivo, nunca el valor |
| `CredentialKeyringError` | `current_invalid` | Falta `PRAXA_CREDENTIAL_KEY_CURRENT`, no es entero o no está en el llavero | Indica la versión si es un entero; nunca claves |
| `CredentialKeyVersionUnknownError` | `unknown_key_version` | `keyFor` con una versión ausente | `La versión de clave N no está en el llavero.` (segunda trampa de II.6) |

`getCredentialKeyring` es la única lectura de `PRAXA_CREDENTIAL_KEYS` y `PRAXA_CREDENTIAL_KEY_CURRENT` bajo `src/` (criterio C-12). Memoiza por proceso: cambiar el llavero exige reiniciar o redesplegar, que es lo que pasa al cambiar una variable en Vercel.

### 3. Sellado (`crypto/seal.ts`)

```ts
export type SealedCredential = { ciphertext: string; iv: string; auth_tag: string; key_version: number };

export class SecretValue {
  reveal(): string;
  toString(): '[redactado]';
  toJSON(): '[redactado]';
  [Symbol.for('nodejs.util.inspect.custom')](): '[redactado]';
}

export function sealCredential(plaintext: string, aad: CredentialAadInput, keyring: CredentialKeyring): SealedCredential;
export function openCredential(sealed: SealedCredential, aad: CredentialAadInput, keyring: CredentialKeyring): SecretValue;
```

- `sealCredential`: `plaintext` tiene que ser una cadena no vacía (si no, `CredentialMaterialError` `invalid_plaintext`). Clave = `keyring.keyFor(keyring.currentVersion)`. IV = `randomBytes(12)` en **cada** llamada (CA-23; primera trampa de II.6). `createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })`, `setAAD(Buffer.from(buildCredentialAad(aad), 'utf8'))`. Devuelve base64 de texto cifrado, IV y etiqueta, y la versión usada.
- `openCredential`, en este orden: (1) forma del material: `ciphertext` base64 no vacío, `iv` de 12 bytes, `auth_tag` de 16 bytes y `key_version` entero positivo; si no, `CredentialMaterialError` `invalid_material`, **antes** de intentar descifrar; (2) `keyring.keyFor(key_version)`, que puede dar `CredentialKeyVersionUnknownError`; (3) `createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })`, `setAAD`, `setAuthTag`, `update` y `final`; cualquier error de este paso se convierte en `CredentialDecryptionError` `decryption_failed`.
- Clave incorrecta, texto alterado, etiqueta alterada, IV alterado y AAD distinto son indistinguibles en GCM: los cinco dan `CredentialDecryptionError`, que es explícito y tipado (CA-24). Una versión ausente del llavero da siempre `CredentialKeyVersionUnknownError`, nunca `CredentialDecryptionError` (CA-25; segunda trampa de II.6).
- Ningún error incluye el texto cifrado, el IV, la etiqueta, la clave ni el texto plano; ninguno lleva `cause`.
- `SecretValue` (decisión no material, motivo CA-26): envuelve el token descifrado para que un `console.log`, un `JSON.stringify` o una interpolación accidental muestren `[redactado]`. Solo `reveal()` devuelve el texto.

### 4. Rotación (CA-25)

Procedimiento canónico de esta spec, enlazado desde `SECURITY.md` sin duplicar sus pasos:

1. Generar la clave nueva y agregarla al llavero con una versión **mayor** que todas las existentes (`D-M06.1a-M06.2a-15` exige versiones crecientes en `rewrap_credential`).
2. Cambiar `PRAXA_CREDENTIAL_KEY_CURRENT` a la versión nueva y redesplegar.
3. Recifrado al usar: `readCredential` (§6) recifra toda credencial cuya versión guardada sea **menor** que la actual. Si es igual, no hace nada. Si es mayor (por ejemplo, porque se volvió atrás la versión actual), tampoco: descifra con la guardada y no llama a la base.
4. Antes del retiro, acreditar que la nueva versión es la única admitida para nuevas escrituras, que los writers/deployments antiguos dejaron de poder escribir y que terminaron las operaciones en vuelo. Después comprobar el conteo global cero de la versión vieja y retirar la clave. Si cualquiera de esas condiciones no puede acreditarse, conservarla. No se agrega infraestructura para imponerlas en este corte.
5. `canRetireKeyVersion(v)` comprueba exclusivamente la condición de DB: ninguna fila con conteo positivo para esa versión. No autoriza integralmente el retiro. Las credenciales `disconnected` sin purgar siguen contando y bloquean el retiro hasta su purga. El operador puede consultar `select * from worker_api.count_credentials_by_key_version();` (solo conteos).

### 5. Cliente de `worker_api` (`db/worker-api.ts`)

```ts
import 'server-only';
import pg from 'pg';

export type WorkerApiFunction =
  | 'create_oauth_attempt' | 'consume_oauth_attempt' | 'create_pending_connection'
  | 'get_credential' | 'confirm_connection' | 'replace_credential' | 'mark_needs_reauth'
  | 'begin_disconnect' | 'purge_connection' | 'list_pending_purges'
  | 'count_credentials_by_key_version' | 'rewrap_credential';

export interface WorkerApi {
  call<Row>(fn: WorkerApiFunction, args: readonly unknown[]): Promise<Row[]>;
}

export function createWorkerApi(options: { connectionString: string } | { pool: Queryable }): WorkerApi & { end(): Promise<void> };
export function getWorkerApi(): WorkerApi;   // singleton perezoso
```

- **Única lectura de `PRAXA_INTEGRATIONS_DB_URL`** en todo `src/`: dentro de `getWorkerApi()`. Si falta, `WorkerApiError` `config_missing`, con el nombre de la variable y sin valores. Las pruebas usan `createWorkerApi({ connectionString })` con la URL de pruebas del rol y nunca pasan por `getWorkerApi()` (spec.md:106).
- **SQL fijo.** Un mapa estático nombre → texto, con la firma exacta de `0012` y casts explícitos, por ejemplo `select * from worker_api.get_credential($1::uuid, $2::uuid, $3::uuid)`. El nombre de la función sale de la unión cerrada; nunca se interpola nada que venga de la entrada. La aridad se verifica antes de consultar.
- **Sin prepared statements con nombre** (paso 4): ninguna consulta pasa `name` en su configuración. Se usa `pool.query({ text, values })`.
- **Pool** (valores no materiales): `max: 3`, `idleTimeoutMillis: 10_000`, `connectionTimeoutMillis: 10_000`, `query_timeout: 15_000` (del lado del cliente; no se envían parámetros de sesión, que el pooler en modo transacción no conserva), `application_name: 'praxa-worker-api'`, `allowExitOnIdle: true`. `ssl` según `M06.3a-Q-05`.
- **`pool.on('error', …)`** se registra siempre: sin manejador, un error en un cliente inactivo termina el proceso. El manejador no registra el error original (puede traer host o usuario); como mucho, un mensaje fijo.
- **Traducción de errores.** Toda falla sale como `WorkerApiError` con `code`, mensaje fijo en español y **sin** `cause`, `detail`, `hint`, parámetros ni cadena de conexión:

| Origen | `code` |
|---|---|
| `PX001` | `not_authorized` |
| `PX002` | `attempt_rejected` |
| `PX003` | `live_connection_exists` |
| `PX004` | `invalid_transition` |
| `PX005` | `pending_expired` |
| `PX006` | `generation_mismatch` |
| `PX007` | `account_conflict` |
| `PX008` | `key_version_mismatch` |
| `22023` | `invalid_argument` |
| `42501`, `42883` | `privilege_missing` (rol mal configurado o función ausente) |
| Clase `08`, `28000`, `28P01`, `53300`, `57P01`, `57P03`, errores de red (`ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`, `ECONNRESET`) y el timeout de consulta | `unavailable` |
| Cualquier otro | `unexpected` |
| Falta la variable | `config_missing` |
| URL inválida o con parámetros que controlan TLS | `config_invalid` |

**Política TLS exclusiva del módulo (D-M06.3a-10).** Tanto `getWorkerApi()` como `createWorkerApi({ connectionString })` validan la URL antes de entregarla a `pg`, construir el pool o abrir una conexión. Se rechazan `sslmode`, `sslcert`, `sslkey` y `sslrootcert`, incluso con valor vacío. También se rechazan los controles alternativos del parser instalado que pueden modificar TLS (`ssl`, `sslnegotiation`, `uselibpqcompat`). La presencia se comprueba sobre nombres decodificados, incluidos parámetros repetidos; no se eliminan ni normalizan silenciosamente. El error `WorkerApiError` con `code = config_invalid` y `failureKind = other` usa un mensaje fijo: `La URL de conexión contiene parámetros TLS no permitidos; TLS se configura en el módulo.` No incluye URL, valores ni error original. Esto aplica por igual a la URL del runtime y a la de pruebas. El resolvedor de destino de pruebas informa el mismo problema antes de conectar. La validación no lee los archivos nombrados por parámetros de certificado. La configuración TLS definitiva se fija en D-M06.3a-11 y el contrato siguiente.

La configuración TLS del cliente de §5 queda fijada por **D-M06.3a-11**:

- Constante pública PEM `SUPABASE_ROOT_CA` dentro de `db/worker-api.ts`, con comentario que registre fuente oficial, fecha de verificación (2026-10-01) y fingerprint SHA-256. No es un secreto ni una variable de entorno.
- Fuente de descarga: `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`, corroborada en el código oficial del dashboard (`apps/studio/hooks/custom-content/custom-content.json` y `SSLConfiguration.tsx`). Su procedencia y la prueba real están registradas en `meta_first/sesiones/M06.3a.md`.
- Huella SHA-256 de la raíz verificada: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`. Una prueba con `X509Certificate` comprueba esa huella sobre el PEM versionado para hacer auditable su sustitución. No se fija el certificado hoja.
- Pool con `ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true }`; se conserva la verificación estándar de hostname de Node. pg transmite el hostname DNS como SNI. No sustituir `checkServerIdentity` ni implementar un verificador propio sin necesidad demostrada.
- Ambas URLs pasan la guarda Q-11 antes de llegar al parser de pg. No hay descarga de CA en runtime, variable adicional, confianza tomada de la cadena recibida ni fallback a TLS sin verificación. Una cadena no confiable, hostname incorrecto o certificado vencido hace fallar la conexión con error redactado; no se clasifica como fallo de transporte tolerable de Q-10.
- Si Supabase cambia a una CA no incluida en el trust anchor versionado, la conexión falla hasta actualizarlo mediante cambio revisado y despliegue. Renovar el certificado hoja bajo la misma raíz confiable no requiere cambiar el trust anchor. El despliegue sigue reservado al usuario.

### 6. Repositorio de credenciales (`repository/credentials.ts`)

Todas las funciones reciben dependencias opcionales `deps = { workerApi: getWorkerApi(), keyring: getCredentialKeyring() }` (decisión no material: permite probar sin red). Las que operan sobre una empresa reciben un K01 (`import type { TenantContext }`) y toman de ahí **solo** `user_id` y `company_id`, que validan con `uuidSchema` antes de llamar a la base; ninguna acepta una empresa por otro parámetro (spec.md:148-150).

| Función | `worker_api` | Comportamiento |
|---|---|---|
| `readCredential(ctx, connectionId, deps?)` | `get_credential` y, si corresponde, `rewrap_credential` | Cero filas: `CredentialNotFoundError`. Valida la fila; `expires_at` (`Date` o `null`) pasa a ISO. Descifra con AAD `{ company_id: ctx.company_id, connection_id, provider: 'meta' }`. **Recifrado** solo si `key_version < keyring.currentVersion` **y** el estado leído es `pending_selection`, `active` o `needs_reauth` (`H-E1-37`, opción A de `M06.3a-Q-04`): sella el mismo texto con la clave actual y llama a `rewrap_credential` con la generación y la versión leídas. `PX006`: `CredentialChangedError` (la credencial se reemplazó o la conexión se desconectó; el llamador vuelve a empezar). `PX008`: otro pedido ya recifró; se devuelve el token sin error. Devuelve `{ connectionId, status, credentialGeneration, keyVersion, tokenType, issuedForAppId, grantedScopes, expiresAt, token: SecretValue, rewrap: CredentialRewrapResult }`, con `keyVersion` de la versión del material efectivamente leído y descifrado, incluso si el recifrado tuvo éxito. No representa la versión actual en DB. Tras `PX008` no se asigna la versión intentada ni se relee automáticamente |
| `createPendingConnectionWithCredential(ctx, input, deps?)` | `create_pending_connection` | Valida `clientBusinessId`, `token` no vacío, `tokenType`, `issuedForAppId`, `grantedScopes` (con `ads_read`) y `expiresAt` con los esquemas de K03 y K04. Genera `connectionId = randomUUID()` en el servidor, porque el AAD lo necesita antes de cifrar (`credential.ts:78-86`). Sella con AAD de `ctx.company_id`, ese id y `'meta'`. Devuelve `{ connectionId, status, pendingExpiresAt, credentialGeneration }` |
| `replaceCredential(ctx, input, deps?)` | `replace_credential` | Mismo sellado, con el `connectionId` recibido. Pasa `attemptId`. Devuelve `{ connectionId, status, credentialGeneration }` |
| `countCredentialsByKeyVersion(deps?)` | `count_credentials_by_key_version` | Sin K01 (única excepción de la ruta, plan.md:452). Convierte `credential_count` (bigint, cadena) a `number` entero no negativo; si no es seguro, `WorkerApiError` `unexpected` |
| `canRetireKeyVersion(version, deps?)` | la anterior | `true` solo si ninguna fila tiene esa versión con conteo mayor que cero |

`rewrap_credential` no se exporta como operación suelta: solo la usa `readCredential`, que es donde vive la condición de estado (`H-E1-37`).

**Resultado del recifrado (D-M06.3a-09, Q-10).** El resultado de `readCredential` agrega un campo `rewrap` con esta unión cerrada:

```ts
type CredentialRewrapResult =
  | { status: 'not_attempted' }
  | { status: 'confirmed' }
  | { status: 'version_conflict' }
  | { status: 'unconfirmed'; reason: 'transport' | 'timeout' };
```

- `not_attempted`: no corresponde recifrar por versión o estado.
- `confirmed`: llegó una respuesta de éxito de `rewrap_credential`. Confirma esa operación, no que la DB permanezca en esa versión al devolver el resultado.
- `version_conflict`: llegó `PX008`. Se conserva el material leído sin relectura automática, según Q-06.
- `unconfirmed`: después de obtener la fila y descifrar/autenticar correctamente el material, la llamada a `rewrap_credential` falló por transporte o timeout. Se devuelve la credencial con esta señal, sin retry automático ni relectura dentro de la llamada. No se afirma ni éxito ni ausencia de escritura. Una próxima lectura independiente puede observar y reconciliar el estado persistido real.

En todos los resultados que entregan credencial, `keyVersion` sigue siendo la versión del material leído. La señal no contiene error original, `cause`, SQL, parámetros, URL ni material de credencial. Autenticación criptográfica del material no equivale a validación actual del token ante Meta ni a autorización de una operación futura.

El cliente conserva una clasificación redactada `failureKind: 'transport' | 'timeout' | 'other'` en `WorkerApiError`, derivada de códigos de red/clase SQLSTATE 08 y del timeout reconocido. No basta capturar todo `code = unavailable`: ese código también agrupa rechazos explícitos de autenticación y otros errores del servidor. Esos casos mantienen `failureKind = other` y se propagan. Solo el fallo de la llamada de recifrado por transporte/timeout activa `unconfirmed`; fallos de lectura, validación, sellado o descifrado no entregan credencial. `PX006` sigue produciendo `CredentialChangedError`; los demás errores explícitos se propagan. Q-08 sigue rigiendo el retiro de claves, sin inferirlo de esta señal.

**Operaciones preparadas (D-M06.3a-06).** El repositorio separa preparación y ejecución para creación y reemplazo: `preparePendingConnectionWithCredential(ctx, input, deps?)` y `prepareReplaceCredential(ctx, input, deps?)` validan y capturan una sola vez identidad, parámetros y material sellado; `executePreparedCredentialOperation(ctx, operation, deps?)` envía exactamente esos argumentos. El objeto preparado es opaco, inmutable y solo de servidor; no guarda el token en claro. La ejecución verifica que el actor y empresa de K01 coincidan con los capturados, antes de tocar la base. Las funciones de conveniencia de la tabla preparan y ejecutan una vez; invocarlas de nuevo no equivale a reintentar la misma operación.

Un reintento explícito reutiliza el mismo objeto preparado: no genera otro UUID, IV ni ciphertext, ni vuelve a sellar con una nueva versión actual. No hay retries automáticos ni persistencia adicional. Si el caller pierde la operación por crash/reinicio, no hay idempotencia durable. M16.1 decidirá cuándo reintentar y cómo reconciliar una petición posterior. La operación preparada no se serializa para el navegador, logs o evidencia.

`H-E1-37` queda mitigado / límite aceptado a nivel repository después de verificarlo: SQL sigue sin validar estado por sí mismo. La capacidad SQL es más amplia que la del único caller de aplicación previsto.

### 7. Destino de pruebas del rol (II.6, paso 7b)

Función pura nueva en `scripts/lib/sql-target.mjs` (ubicación confirmada por D-M06.3a-02), junto a `resolveSqlTestTarget`:

```js
export const INTEGRATIONS_ROLE = 'praxa_integrations';
export function resolveIntegrationsTestTarget(env)
// → { ok: true, connectionString, projectRef, notes: string[] } | { ok: false, problems: string[] }
```

Reglas, todas acumulativas:

1. Solo lee `PRAXA_INTEGRATIONS_TEST_DB_URL`. Si falta: problema que dice que no se usa `PRAXA_INTEGRATIONS_DB_URL` como alternativa. Nunca lee esa variable salvo para compararla (regla 6).
2. Tiene que parsear (`dbUrlIsParsable`) y no tener el marcador `[YOUR-PASSWORD]` (`dbUrlHasPlaceholderPassword`).
3. El usuario tiene que ser exactamente `praxa_integrations.<ref de 20 caracteres>`. Un usuario `postgres.<ref>` se rechaza: correr las pruebas del rol como `postgres` las aprobaría sin probar nada.
4. `resolveSqlTestTarget(env)` tiene que ser `ok` (desechable, distinto de la app, deducible), y su `projectRef` igual al `<ref>` de la regla 3.
5. `<ref>` distinto del proyecto `app` (por `SUPABASE_DB_URL` o `NEXT_PUBLIC_SUPABASE_URL`).
6. Distinta de `PRAXA_INTEGRATIONS_DB_URL` si esa existe.
7. Puerto distinto de `6543`: nota, no problema ("no es el pooler en modo transacción").

`scripts/check-target.mjs test` informa, sin valores: `rol de C según PRAXA_INTEGRATIONS_TEST_DB_URL: <ref> | (sin definir)` y el resultado. Si la variable está definida y falla alguna regla, el comando termina con código 1. Si no está definida, imprime `FALTA` como nota y no falla, igual que hoy con `SUPABASE_TEST_DB_URL` (`check-target.mjs:13`). Las pruebas que la necesitan fallan por su cuenta (§10).

### 8. Cierre de `H-M04.1-02` (paso 7c)

- `scripts/lib/target.mjs:179-188`: la condición pasa a `apiUrl && appUrl && apiUrl === appUrl`, sin excepción, y el mensaje deja de mencionar la variable.
- `tests/app/helpers.ts:53-62`: igual.
- `docs/SECURITY.md`: verificar que la sección de pruebas aisladas no permita esa excepción; actualizar solo si persiste. El refactor documental ya cambió su estructura.
- `resolveSqlTestTarget` no cambia: ya no tenía la excepción.

### 9. Recorrido del árbol (`tests/unit/no-secrets-in-tree.test.ts`, paso 8)

- **Archivos:** `git ls-files -co --exclude-standard -z`, ejecutado con `execFileSync` desde la raíz. Incluye versionados y nuevos no ignorados; `.env.local` está ignorado (`.gitignore`, `.env*`) y nunca se lee. Si `git` falla, la prueba falla con un mensaje claro (no se omite; CB-06). Se saltean archivos con un byte NUL (binarios) y el propio archivo de la prueba.
- **Patrones** (con nombre, para el informe):

| Nombre | Qué detecta |
|---|---|
| `meta_token` | `\bEAA[A-Za-z0-9]{30,}` (HIPÓTESIS H-S-03 sobre el prefijo) |
| `oauth_param` | `[?&#](code|access_token|input_token|fb_exchange_token|client_secret)=` seguido de 20 o más caracteres `[A-Za-z0-9._~-]` |
| `supabase_secret` | `\bsb_secret_[A-Za-z0-9_-]{16,}` |
| `jwt` | tres segmentos base64url, los dos primeros empezando con `eyJ`, cada uno de 10 o más caracteres |
| `keyring_pair` | `\b\d{1,10}:[A-Za-z0-9+/]{43}=` sin caracteres base64 a los costados |
| `db_url_password` | `postgres(ql)?://usuario:contraseña@` con una contraseña fuera de la lista sintética |
| `env_secret_assignment` | una línea `NOMBRE=valor` no vacía para `PRAXA_CREDENTIAL_KEYS`, `PRAXA_INTEGRATIONS_DB_URL`, `PRAXA_INTEGRATIONS_TEST_DB_URL`, `META_APP_SECRET`, `DEEPINFRA_API_KEY`, `SUPABASE_TEST_SECRET_KEY`, `SUPABASE_DB_URL` o `SUPABASE_TEST_DB_URL` |
| `private_key` | `-----BEGIN ` … `PRIVATE KEY-----` |

- **Lista sintética, cerrada y declarada en la prueba:** un hallazgo se tolera solo si el texto coincidente contiene `no-es-una-firma-real` o `ejemplo-no-real` (`supabase-key-formats.test.ts:24`), o si la contraseña de una URL es `...`, `…`, `secreta`, `clave`, `[YOUR-PASSWORD]`, `%5BYOUR-PASSWORD%5D` o empieza con `${` o `<`.
- **Informe:** `archivo:línea → nombre_del_patrón`, **nunca** el texto coincidente.
- **Autoprueba:** cada patrón se ejercita con una muestra positiva armada en tiempo de ejecución (por ejemplo, `'EA' + 'A' + 'x'.repeat(40)`), para que el archivo de la prueba no contenga el literal, y con las muestras sintéticas permitidas, que no se informan.

### 10. `no-privileged-credentials` (paso 7)

Se conservan intactos los dos `it` existentes. Se agregan, sobre `src/` y `proxy.ts`:

1. `PRAXA_INTEGRATIONS_DB_URL` aparece **solo** en `src/modules/integrations/db/worker-api.ts`, y aparece ahí (CA-27).
2. Ese archivo tiene `import 'server-only';` como primera sentencia (se permiten comentarios antes).
3. `PRAXA_INTEGRATIONS_TEST_DB_URL` no aparece en ningún archivo de `src/` ni en `proxy.ts`.
4. Las importaciones del paquete `pg` (`from 'pg'`, `from "pg"`, `require('pg')`) aparecen **solo** en `worker-api.ts`. Es la invariante que pide `H-E1-10`: la capacidad (una conexión directa a la base) queda confinada a un módulo, cualquiera sea el nombre de la variable.
5. `PRAXA_CREDENTIAL_KEYS` y `PRAXA_CREDENTIAL_KEY_CURRENT` aparecen solo en `src/modules/integrations/crypto/keyring.ts`.

### 11. Documentación y `.env.example` (pasos 9 y 10)

**`docs/SECURITY.md`**

- Actualizar de previsto a vigente el confinamiento del cliente, el cifrado y la guarda, solo después de implementarlos y probarlos. Conservar las fronteras y límites de confianza existentes.
- Enumerar categorías de autoridad y restricciones, sin copiar funciones ni grants: la matriz exacta vive en migraciones y pgTAP (D-M06.3a-08; H-E1-41).
- Documentar el límite del recifrado a nivel repositorio y el retiro de claves como procedimiento con precondiciones; enlazar Diseño §4 para los pasos concretos. No duplicar contratos ni estados de microfases.
- No modificar la política de retención de §9 (M03a).

**`docs/ARCHITECTURE.md`**

- Incorporar los módulos crypto, db y repository al árbol y sus responsabilidades cuando existan. Los contratos y los tres esquemas ya están documentados.
- Actualizar el camino privilegiado para reflejar el cliente Node y el cifrado implementados. Mantener OAuth, ciclo de vida y sincronización como previstos.
- No copiar gates, CA, hallazgos, fechas ni matrices exactas. No introducir workers.

**`README.md`**

- Cambiar únicamente la tabla de variables de prueba y el párrafo de salvaguardas relacionado (D-M06.3a-02). No corregir otros párrafos ni copiar arquitectura o contratos.

**`.env.example`**

- Sección 3 (pruebas): `PRAXA_INTEGRATIONS_TEST_DB_URL=`, con la forma de la URL (usuario `praxa_integrations.<ref>`, pooler en modo transacción, puerto 6543) y la aclaración de que nunca va a Vercel.
- Sección nueva 4 (conector de Meta): `PRAXA_CREDENTIAL_KEYS=`, `PRAXA_CREDENTIAL_KEY_CURRENT=` y `PRAXA_INTEGRATIONS_DB_URL=`, con el formato del llavero y cómo generar una clave sin pegarla en ningún chat.
- El conteo del encabezado se recalcula desde el archivo: trece variables.
- "Lo que deliberadamente NO está acá" deja de decir que no hay credenciales de integraciones.

### 12. Prueba del cliente contra la base de pruebas

Suite permanente confirmada por D-M06.3a-01: `tests/app/integrations-worker-api-client.test.ts`, en el proyecto `app` de Vitest.

- Sin `describe.skipIf`: si falta configuración, el destino es inválido o el proyecto no responde, la suite falla de forma redactada. Un verde sin ejecutar esta comprobación no aprueba el gate.
- Validar siempre `resolveIntegrationsTestTarget(process.env)` antes de conectar; si no es `ok`: la suite **falla**, no se omite, con los problemas del resolvedor (spec.md:106).
- Los fixtures siguen el patrón de `integrations-data-api.test.ts`: usuarios con `createConfirmedUser`, empresas con `create_company_for_current_user` y limpieza con `cleanupRun()`.
- Las aserciones usan `createWorkerApi({ connectionString })` con la URL del rol y el repositorio. El llavero es el de `.env.local`, que carga `tests/app/setup.ts`, más una versión sintética creada en tiempo de ejecución para la rotación: un número alto y aleatorio de la corrida, para que los conteos globales se puedan atribuir.
- Una conexión fallida no es un salto: falla la suite y se frena el gate (`H-E1-36`).

### 13. Secuencia (TDD)

1. `git status` limpio; rama `mf/M06.3a` desde `main`.
2. Pruebas primero, en rojo por la razón esperada: `credential-crypto.test.ts`, los casos nuevos de `sql-test-target.test.ts` y de `no-privileged-credentials.test.ts`, `no-secrets-in-tree.test.ts` y la prueba permanente de `app`. `npm run test:unit` y `npm run test:app` registran el rojo.
3. `keyring.ts`, `seal.ts`, `worker-api.ts` y `credentials.ts`, hasta el verde de `test:unit`.
4. `package.json` y `package-lock.json`, con `npm install` sin cambiar versiones.
5. Pasos 7b y 7c.
6. Documentación y `.env.example`.
7. Intervención del usuario (contraseña del rol, URL del rol y llavero); `npm run db:check:test`.
8. `npm run test:app` y `npm run verify` en verde, sin omisiones exigidas.
9. Evidencia en `sesiones/M06.3a.md`, hallazgos y `PROJECT_STATE.md`.

## Archivos previstos

| Archivo | Nuevo o modificado | Para qué | Autorizado por |
|---|---|---|---|
| `tests/unit/credential-crypto.test.ts` | Nuevo | Llavero, sellado, rotación, repositorio y cliente con dependencias simuladas | II.6, paso 1 |
| `src/modules/integrations/crypto/keyring.ts` | Nuevo | Llavero | II.6, paso 2 |
| `src/modules/integrations/crypto/seal.ts` | Nuevo | `seal`, `open` y `SecretValue` | II.6, paso 3 |
| `src/modules/integrations/db/worker-api.ts` | Nuevo | Cliente `pg` del rol de C | II.6, paso 4 |
| `src/modules/integrations/repository/credentials.ts` | Nuevo | Repositorio de credenciales | II.6, paso 5 |
| `package.json` | Modificado | `pg` a `dependencies` | II.6, paso 6 |
| `package-lock.json` | Modificado | Consecuencia de mover `pg` (`"dev": true`) | D-M06.3a-02; II.6 actualizado |
| `tests/unit/no-privileged-credentials.test.ts` | Modificado | CA-27, `H-E1-10` | II.6, paso 7 |
| `scripts/check-target.mjs` | Modificado | Informe de la URL del rol | II.6, paso 7b |
| `scripts/lib/sql-target.mjs` | Modificado | `resolveIntegrationsTestTarget`, función pura probable | D-M06.3a-02; II.6, paso 7b |
| `tests/unit/sql-test-target.test.ts` | Modificado | Casos del resolvedor del rol y regresión de `H-M04.1-02` | II.6, paso 7b |
| `scripts/lib/target.mjs` | Modificado | Quitar la excepción | II.6, paso 7c |
| `tests/app/helpers.ts` | Modificado | Quitar la excepción | II.6, paso 7c |
| `tests/unit/no-secrets-in-tree.test.ts` | Nuevo | CA-26 | II.6, paso 8 |
| `docs/SECURITY.md` | Modificado | Excepción, cifrado, rotación y excepción de pruebas | II.6, pasos 7c y 9 |
| `docs/ARCHITECTURE.md` | Modificado | Conector y `worker_api` | II.6, paso 9 |
| `.env.example` | Modificado | Cuatro variables sin valores | II.6, paso 10 |
| `tests/app/integrations-worker-api-client.test.ts` | Nuevo | Acceso real con el rol (`H-E1-36`) y ciclo completo | D-M06.3a-01; II.6 actualizado |
| `README.md` | Modificado | Solo tabla de variables de prueba y párrafo de salvaguardas | D-M06.3a-02; II.6 actualizado |
| `docs/HALLAZGOS.md` | Modificado | Estado de `H-M04.1-02`, `H-E1-09`, `-10`, `-17`, `-36`, `-37`; hallazgos nuevos | Precondición 8 |
| `docs/PROJECT_STATE.md` | Modificado | Estado de `G-CRYPTO` | Precondición 8 |
| `docs/FASES/FASE1/meta_first/sesiones/M06.3a.md` | Nuevo | Evidencia | Precondición 8 |
| `docs/FASES/FASE1/M06.3a/spec.md`, `plan.md`, `revisiones/*.md` | Nuevos | Pipeline | Precondición 9 |

Ningún otro archivo. Ninguna migración.

## Criterios de aceptación

### Heredados de la ruta

| ID de la ruta | Qué exige (resumen fiel) |
|---|---|
| CA-21 (ficha) | Ningún usuario lee credenciales por ninguna vía, ni directa ni a través de una función |
| CA-23 (ficha) | AES-256-GCM con IV aleatorio por operación |
| CA-24 (ficha) | Clave incorrecta, texto alterado o AAD distinto fallan de forma explícita |
| CA-25 (ficha) | Se cifra siempre con `PRAXA_CREDENTIAL_KEY_CURRENT` y se descifra con la versión guardada buscándola en el llavero. Rotación: agregar la clave nueva, cambiar la actual, recifrar (al usar o con un comando) y retirar la vieja solo cuando una función de `worker_api` confirme que ninguna credencial la referencia. Una versión ausente del llavero da un error explícito, no un descifrado fallido silencioso |
| CA-26 (ficha) | Ni claves, ni tokens, ni códigos OAuth, ni secretos, ni URLs que los contengan aparecen en logs, errores, snapshots o fixtures. Una prueba recorre el árbol buscándolos (la del cliente HTTP es de `M16.1`) |
| CA-27 reescrita (ficha) | `no-privileged-credentials` se extiende: `PRAXA_INTEGRATIONS_DB_URL` solo aparece en el módulo `server-only` del conector, y el resto de la invariante existente sigue pasando |
| CA-11b (II.6, paso 3) | El cifrado usa empresa, conexión y proveedor como AAD; un texto cifrado movido a otra fila no descifra |
| Ficha, implementación | Llavero y versión actual; AES-256-GCM con IV aleatorio y AAD; rotación; cliente `pg` del rol de C; `pg` en `dependencies`; extensión de `no-privileged-credentials`; actualización de `SECURITY.md` y `ARCHITECTURE.md` |
| Ficha, pruebas | Ciclo completo; clave incorrecta; texto alterado; AAD distinto; versión ausente del llavero; rotación; credencial fuera del módulo permitido |
| II.6, paso 4 | Cliente `server-only`, por el pooler en modo transacción, sin prepared statements con nombre |
| II.6, paso 7b (T09) | `check-target` verifica que `PRAXA_INTEGRATIONS_TEST_DB_URL` apunte al mismo proyecto que `SUPABASE_TEST_DB_URL`, con `SUPABASE_TEST_IS_DISPOSABLE` activo, sin recurrir a `PRAXA_INTEGRATIONS_DB_URL`; si falta o apunta a otro proyecto, las pruebas fallan (spec.md:106) |
| II.6, paso 7c | Se cierra `H-M04.1-02`: se quita `SUPABASE_TEST_ALLOW_APP_PROJECT` de la guarda de destino, de los helpers de `test:app` y de `SECURITY.md` |
| II.6, paso 9 (spec.md:182-183) | `SECURITY.md` documenta la excepción: una sola credencial, acotada, con sus capacidades enumeradas. `ARCHITECTURE.md` incorpora el conector y `worker_api` |
| II.6, paso 10 | Variables nuevas en `.env.example`, sin valores; la prueba existente lo exige |
| II.6, trampas 1 y 2 | IV nunca derivado ni reutilizado; versión ausente es un error explícito, distinto de un texto alterado |
| `H-E1-36` (HALLAZGOS.md:120) | Se comprueba el acceso real del cliente con el rol; si falla, se detiene el gate |
| CB-01 a CB-06 | `verify` y las suites del corte pasan; ningún diff con secretos, tokens, montos o identificadores; ninguna migración modificada; ninguna prueba contra producción; evidencia real y redactada; una prueba omitida por configuración no aprueba el gate |

### Operativos de esta microfase

| ID | Criterio verificable | Traza a (CA, DEC o trampa de la ruta) |
|---|---|---|
| M06.3a-C-01 | `parseCredentialKeyring` acepta exactamente el formato de Diseño §2 y rechaza con `CredentialKeyringError` (código y posición) cada violación; ningún mensaje contiene una clave | CA-25; II.6, paso 2 |
| M06.3a-C-02 | `sealCredential` usa la clave actual, un IV nuevo de 12 bytes por llamada, etiqueta de 16 bytes y el AAD de `buildCredentialAad`; su salida cumple las reglas de K04; rechaza texto vacío | CA-23, CA-11b, CA-10, CA-11; II.6, trampa 1 |
| M06.3a-C-03 | `openCredential` devuelve el texto original; clave incorrecta, texto, etiqueta o IV alterados y AAD distinto dan `CredentialDecryptionError`; una etiqueta que no mide 16 bytes da `CredentialMaterialError` sin intentar descifrar | CA-24; trampa del código (`authTagLength`) |
| M06.3a-C-04 | Una versión ausente del llavero da `CredentialKeyVersionUnknownError`, que no es `CredentialDecryptionError` ni subclase de él | CA-25; II.6, trampa 2 |
| M06.3a-C-05 | Rotación: con la versión guardada menor que la actual, `readCredential` recifra una vez por `rewrap_credential` con la generación y la versión leídas; con igual o mayor, no llama; `canRetireKeyVersion` es `true` solo sin credenciales de esa versión | CA-25 |
| M06.3a-C-06 | `readCredential` nunca recifra una credencial de una conexión `disconnected`, pero la descifra; `PX006` en el recifrado da `CredentialChangedError`; `PX008` se tolera | `H-E1-37` (según `Q-04`); CA-38, paso 2 |
| M06.3a-C-07 | `worker-api.ts` empieza con `import 'server-only'`, es el único lector de `PRAXA_INTEGRATIONS_DB_URL`, arma SQL solo desde el mapa estático, nunca pasa `name`, registra `pool.on('error')` y da `config_missing` sin valores si falta la variable | II.6, paso 4; spec.md:178 |
| M06.3a-C-08 | Todo error del cliente sale como `WorkerApiError` con el código de la tabla de Diseño §5; su `message`, su `JSON.stringify` y sus propiedades no contienen `detail`, `hint`, parámetros, cadena de conexión ni contraseña, y no tiene `cause` | CA-26; spec.md:150 |
| M06.3a-C-09 | El repositorio pasa a `worker_api` solo `ctx.user_id` y `ctx.company_id`; rechaza un K01 con identificadores que no son UUID antes de tocar la base; el AAD usa `ctx.company_id`, la conexión y `'meta'`; el id de una conexión nueva se genera en el servidor | spec.md:148-150; CA-11b; CA-00 |
| M06.3a-C-10 | El token descifrado solo sale como `SecretValue`: `JSON.stringify`, `String()`, plantilla y `util.inspect` muestran `[redactado]`; `reveal()` devuelve el texto | CA-21, CA-26 |
| M06.3a-C-11 | `pg` está en `dependencies` y no en `devDependencies`; `@types/pg` sigue en `devDependencies`; `npm run build` pasa; `npm ci` no falla por desincronización | `H-E1-09`; II.6, paso 6 |
| M06.3a-C-12 | `no-privileged-credentials` exige las cinco reglas de Diseño §10 y los dos `it` existentes siguen pasando sin cambios | CA-27 reescrita; `H-E1-10` |
| M06.3a-C-13 | `resolveIntegrationsTestTarget` cumple las siete reglas de Diseño §7; `db:check:test` informa el estado sin valores y sale con 1 si la variable definida es inválida | II.6, paso 7b (T09); spec.md:106 |
| M06.3a-C-14 | `SUPABASE_TEST_ALLOW_APP_PROJECT` no aparece en `scripts/`, `tests/`, `src/`, `docs/SECURITY.md`, `.env.example` ni `README.md`; `resolveTarget('test')` rechaza la misma URL de app y pruebas aunque la variable valga `true` | II.6, paso 7c; `H-M04.1-02` |
| M06.3a-C-15 | `no-secrets-in-tree` recorre `git ls-files -co --exclude-standard`, nunca `.env.local`, aplica los patrones de Diseño §9 con la lista sintética cerrada, informa `archivo:línea → patrón` sin el texto, falla si `git` falla y pasa sobre el árbol | CA-26; II.6, paso 8 |
| M06.3a-C-16 | `SECURITY.md` y `ARCHITECTURE.md` contienen lo de Diseño §11; las capacidades se enumeran por categoría con enlaces a la matriz canónica; no se altera la política de retención | II.6, paso 9; spec.md:182-183 |
| M06.3a-C-17 | `.env.example` tiene las cuatro variables nuevas sin valor, el conteo recalculado y la sección final corregida; la prueba de `.env.example` pasa | II.6, paso 10 |
| M06.3a-C-18 | Contra el proyecto de pruebas y con `PRAXA_INTEGRATIONS_TEST_DB_URL`: el cliente conecta; `current_user` es `praxa_integrations`; leer las tres tablas da `42501`; crear y leer una credencial devuelve el mismo token y lo guardado no es el token; material movido a una conexión de otra empresa no descifra; la rotación recifra y el conteo de la versión sintética llega a cero; una conexión `disconnected` no se recifra; sin la variable o con una inválida, la suite falla | CA-11b, CA-21, CA-22, CA-24, CA-25; `H-E1-36`; spec.md:106 |
| M06.3a-C-19 | `H-E1-17` queda resuelto según `M06.3a-Q-03` y registrado en `HALLAZGOS.md` | `H-E1-17` |
| M06.3a-C-21 | Las operaciones preparadas conservan identidad y argumentos cifrados en cada reintento explícito; rechazan otro actor/empresa y no reintentan automáticamente. Sin durabilidad tras perder el objeto | Idempotencia de AGENTS; D-M06.3a-06 |
| M06.3a-C-22 | Retiro documentado con writers antiguos inhabilitados, operaciones terminadas y conteo cero, incluidas disconnected. canRetireKeyVersion solo comprueba DB | CA-25; D-M06.3a-07 |
| M06.3a-C-23 | Timeout/transporte exclusivamente durante rewrap devuelve la credencial autenticada con rewrap.status unconfirmed y motivo redactado; conserva keyVersion leída, sin retry ni relectura. Errores explícitos y fallos anteriores conservan su tratamiento | CA-24, CA-25, CA-26; D-M06.3a-09 |
| M06.3a-C-24 | Ambas URLs rechazan parámetros que cambian TLS antes de pg, sin construir pool, conectar ni leer certificados; error fijo redactado, sin eliminación silenciosa | CA-26; D-M06.3a-10 |
| M06.3a-C-25 | CA pública oficial versionada con fuente, fecha y huella; pool verifica cadena y hostname por Node, sin override propio, variable nueva, descarga o fallback. Fallos TLS se propagan redactados | D-M06.3a-11; frontera servidor → DB |
| M06.3a-C-20 | `git diff --name-only main -- supabase/` vacío; ningún comando contra el proyecto `app`; el diff pasa `no-secrets-in-tree` | CB-02, CB-03, CB-04 |

## Casos de prueba

| ID | Criterios | Tipo (unit, component, app, pgTAP, manual) | Comando | Resultado esperado | ¿Falla sin la implementación? |
|---|---|---|---|---|---|
| M06.3a-T-01 | C-01 | unit | `npm run test:unit -- tests/unit/credential-crypto.test.ts` | Llavero válido con dos versiones: `currentVersion`, `versions` ordenadas, `keyFor` devuelve 32 bytes | Sí: el módulo no existe |
| M06.3a-T-02 | C-01 | unit | ídem | Rechazos: variable ausente o vacía; par sin `:`; versión `0`, negativa, con cero a la izquierda, no entera o mayor a 2147483647; versión repetida; clave no base64, de 31 y de 33 bytes; actual ausente, no entera o fuera del llavero. Ningún mensaje contiene la clave usada en el caso | Sí |
| M06.3a-T-03 | C-02, C-03 | unit | ídem | Ciclo completo: `open(seal(x)) === x`; la salida cumple `ciphertext`, `iv` y `auth_tag` de K04; `key_version` es la actual | Sí |
| M06.3a-T-04 | C-02 | unit | ídem | Dos sellos del mismo texto y AAD dan IV y texto cifrado distintos; IV de 12 bytes, etiqueta de 16 | Sí |
| M06.3a-T-05 | C-02 | unit | ídem | Texto vacío: `CredentialMaterialError` | Sí |
| M06.3a-T-06 | C-03 | unit | ídem | Misma versión con otra clave: `CredentialDecryptionError` | Sí |
| M06.3a-T-07 | C-03 | unit | ídem | Un byte cambiado en el texto cifrado, en la etiqueta y en el IV: `CredentialDecryptionError` en los tres | Sí |
| M06.3a-T-08 | C-03 | unit | ídem | AAD con otra empresa, con otra conexión: `CredentialDecryptionError` | Sí |
| M06.3a-T-09 | C-03 | unit | ídem | Etiqueta de 4 bytes: `CredentialMaterialError`, y `createDecipheriv` no se llega a usar (espía) | Sí |
| M06.3a-T-10 | C-04 | unit | ídem | Versión ausente: `CredentialKeyVersionUnknownError`, `not.toBeInstanceOf(CredentialDecryptionError)`; el mensaje nombra solo la versión | Sí |
| M06.3a-T-11 | C-04, C-05 | unit | ídem | Llavero {1, 2} con actual 2: abre material de la versión 1 y sella con la 2; sin la versión 1, abrir material de la 1 da `CredentialKeyVersionUnknownError` | Sí |
| M06.3a-T-12 | C-05, C-09 | unit | ídem | `readCredential` con `workerApi` simulado (versión 1, `active`, generación 3) y actual 2: una llamada a `rewrap_credential` con `[user_id, company_id, conexión, 3, 1, material nuevo, 2]`; el material nuevo abre con el AAD correcto; `keyVersion` devuelta es 1 (material leído), aunque el recifrado persista 2 | Sí |
| M06.3a-T-13 | C-05 | unit | ídem | Versión guardada igual o mayor que la actual: ninguna llamada a `rewrap_credential` | Sí |
| M06.3a-T-14 | C-06 | unit | ídem | `disconnected`: sin recifrado y token devuelto. `pending_selection` y `needs_reauth`: con recifrado | Sí |
| M06.3a-T-15 | C-06 | unit | ídem | `rewrap_credential` responde `PX006`: `CredentialChangedError`. Responde `PX008` (otro writer pudo guardar una versión distinta de la intentada): token sin error, versión leída intacta y ninguna relectura automática | Sí |
| M06.3a-T-16 | C-05 | unit | ídem | `countCredentialsByKeyVersion` convierte `'2'` en `2` y rechaza un conteo no entero; `canRetireKeyVersion` es `false` con conteo 2, `true` sin fila o con conteo 0 | Sí |
| M06.3a-T-17 | C-08 | unit | ídem | Pool simulado que lanza errores con `code` `PX001` a `PX008`, `22023`, `42501`, `28P01`, `ECONNREFUSED`, timeout y otro: código traducido; errores sintéticos con `detail`, `hint` y una cadena de conexión con contraseña sintética no dejan rastro en `message`, `JSON.stringify` ni propiedades; sin `cause` | Sí |
| M06.3a-T-18 | C-07 | unit | ídem | Pool simulado: `call('get_credential', …)` envía `text` del mapa, `values` en orden y ningún `name`; aridad errónea rechazada antes de consultar; `getWorkerApi()` sin la variable da `config_missing` sin valores (con `vi.stubEnv`) | Sí |
| M06.3a-T-19 | C-09 | unit | ídem | K01 con `company_id` no UUID: error antes de llamar al pool. `createPendingConnectionWithCredential` genera un UUID nuevo, lo pasa como `p_connection_id` y el material abre solo con el AAD de ese id y de `ctx.company_id` | Sí |
| M06.3a-T-20 | C-10 | unit | ídem | `SecretValue`: `JSON.stringify({ t })`, `String(t)`, `` `${t}` `` y `util.inspect(t)` dan `[redactado]`; `reveal()` da el texto | Sí |
| M06.3a-T-21 | C-12 | unit | `npm run test:unit -- tests/unit/no-privileged-credentials.test.ts` | Las cinco reglas pasan sobre el árbol; los dos `it` originales siguen iguales | Sí: la regla 1 exige que `worker-api.ts` exista y contenga la variable |
| M06.3a-T-22 | C-13 | unit | `npm run test:unit -- tests/unit/sql-test-target.test.ts` | `resolveIntegrationsTestTarget`: configuración válida `ok`; falta la variable (el mensaje no propone la de la app); usuario `postgres.<ref>`; otro proyecto; proyecto `app`; igual a `PRAXA_INTEGRATIONS_DB_URL`; `SUPABASE_TEST_DB_URL` inválida; sin confirmación de desechable; marcador de contraseña: todos rechazados. Puerto 5432: `ok` con nota. Los casos existentes siguen pasando | Sí: la función no existe |
| M06.3a-T-23 | C-14 | unit | ídem | `resolveTarget('test', { root: <temporal sin .env.local> })` con `vi.stubEnv` de la misma URL para app y pruebas y `SUPABASE_TEST_ALLOW_APP_PROJECT=true`: `ok` es `false` y ningún problema menciona la variable | Sí: hoy la excepción la acepta |
| M06.3a-T-24 | C-14 | manual | `git grep -n SUPABASE_TEST_ALLOW_APP_PROJECT -- scripts tests src docs/SECURITY.md .env.example README.md` | Sin salida | Sí |
| M06.3a-T-25 | C-15 | unit | `npm run test:unit -- tests/unit/no-secrets-in-tree.test.ts` | Autoprueba: cada patrón detecta su muestra positiva armada en tiempo de ejecución; las muestras sintéticas permitidas no se informan; el informe no contiene el texto coincidente. Recorrido: cero hallazgos en el árbol | Sí: el archivo no existe |
| M06.3a-T-26 | C-15 | unit | ídem | La lista de archivos sale de `git ls-files -co --exclude-standard` y no incluye `.env.local` (aserción sobre la lista, sin leer ese archivo) | Sí |
| M06.3a-T-27 | C-13 | manual | `npm run db:check:test` | Imprime el `<ref>` del rol y "Destino verificado."; ningún valor de variable | No aplica: salida de un script; se registra antes y después de la intervención |
| M06.3a-T-28 | C-11 | manual | `node -e "const p=require('./package.json');console.log(Boolean(p.dependencies.pg),Boolean(p.devDependencies.pg),Boolean(p.devDependencies['@types/pg']))"` y `npm ci --dry-run` | `true false true`; `npm ci --dry-run` sin error de sincronización | Sí: hoy imprime `false true true` |
| M06.3a-T-29 | C-16 | manual | `git diff main -- docs/SECURITY.md docs/ARCHITECTURE.md` | Contiene Diseño §11, categorías y enlaces canónicos; sin lista duplicada de funciones ni cambios a la política de retención | No aplica: documentación |
| M06.3a-T-30 | C-17 | unit | `npm run test:unit -- tests/unit/no-privileged-credentials.test.ts` y `git diff main -- .env.example` | La prueba de `.env.example` pasa; el diff muestra las cuatro variables sin valor, el conteo y la sección final | No aplica para el conteo y los comentarios (revisión); sí para la prueba si se escribiera un valor |
| M06.3a-T-31 | C-18 | app | `npm run test:app -- tests/app/integrations-worker-api-client.test.ts` | El cliente conecta con la URL del rol; `select current_user` da `praxa_integrations` | Sí: el módulo no existe (y, antes de la intervención, falla por falta de la variable) |
| M06.3a-T-32 | C-18 | app | ídem | Por la misma conexión, `select` sobre `public.integration_connections`, `public.oauth_attempts` y `private.integration_credentials` da `42501` | Sí |
| M06.3a-T-33 | C-18 | app | ídem | Crear una pendiente con un token sintético y leerla: `reveal()` coincide; el `ciphertext` crudo de `get_credential` es distinto del token en base64 | Sí |
| M06.3a-T-34 | C-18 | app | ídem | Material crudo de la conexión de la empresa A insertado con `create_pending_connection` en la empresa B: `readCredential` de B da `CredentialDecryptionError` | Sí |
| M06.3a-T-35 | C-18 | app | ídem | Rotación con la versión sintética: sellado con la versión sintética V, cambio a V+1, lectura que recifra; `get_credential` informa V+1; `count_credentials_by_key_version` no tiene fila V; `canRetireKeyVersion(V)` es `true` | Sí |
| M06.3a-T-36 | C-06, C-18 | app | ídem | Después de `begin_disconnect` (llamado con el cliente), una lectura con versión vieja descifra y la versión guardada no cambia | Sí |
| M06.3a-T-37 | C-18 | manual | En PowerShell: `$env:PRAXA_INTEGRATIONS_TEST_DB_URL=''; npm run test:app -- tests/app/integrations-worker-api-client.test.ts` | La suite **falla** con los problemas del resolvedor; no figura como omitida | Sí |
| M06.3a-T-38 | C-19 | manual | `git diff main -- package.json` y revisión de las suites | Solo se mueve `pg`; las suites que cruzan `server-only` mockean el marcador. No se agrega dependencia ni alias global | No aplica: revisión |
| M06.3a-T-39 | C-20 | manual | `git diff --name-only main -- supabase/` | Sin salida | No aplica: revisión del diff |
| M06.3a-T-40 | todos | unit, component y build | `npm run verify` | Exit 0 | Sí, hasta que existan los módulos |

Casos adicionales del grill (sin renumerar los existentes):

| ID | Criterios | Tipo y comando | Resultado esperado |
|---|---|---|---|
| M06.3a-T-41 | C-06, C-18 | app; `npm run test:app -- tests/app/integrations-worker-api-client.test.ts` | Intercalar begin_disconnect real tras get_credential y antes de rewrap mediante barrera determinística. El rewrap viejo recibe PX006; repository entrega CredentialChangedError y la versión guardada no cambia. Sin sleeps ni simulación del error SQL |
| M06.3a-T-42 | C-21 | unit; `npm run test:unit -- tests/unit/credential-crypto.test.ts` | Tras respuesta perdida simulada, repetir creación y reemplazo preparados manda argumentos idénticos, incluso si cambia la clave actual. No otro UUID/IV/sello ni retry automático. Otro actor/empresa falla antes de DB. Rojo antes de implementar |
| M06.3a-T-43 | C-21 | app; comando de T-41 | Ejecutar dos veces la misma operación preparada verifica el reconocimiento idempotente de SQL, sin duplicar conexión ni generación. Rojo antes de implementar |
| M06.3a-T-44 | C-22 | Revisión documental de Diseño §4 | Conteo cero no se confunde con autorización; disconnected sin purgar sigue bloqueando el retiro. No es prueba de writers reales ni requiere infraestructura |
| M06.3a-T-45 | C-23 | unit; `npm run test:unit -- tests/unit/credential-crypto.test.ts` | Simular transporte/timeout de rewrap tanto antes de aplicar la escritura como después de aplicarla y perder la respuesta: ambos devuelven token leído, keyVersion original y señal unconfirmed. Exactamente una lectura y un intento de rewrap por llamada. Una lectura posterior independiente observa la versión realmente persistida. Rojo antes de implementar |
| M06.3a-T-46 | C-23 | unit; comando de T-45 | No convertir en unconfirmed errores de lectura, material inválido, descifrado, sellado, permisos, autenticación DB, PX006 ni otros rechazos explícitos. PX008 produce version_conflict; éxito confirmed; ausencia de intento not_attempted. La serialización de la señal y errores no filtra datos. Rojo antes de implementar |
| M06.3a-T-47 | C-24 | unit; `npm run test:unit -- tests/unit/credential-crypto.test.ts tests/unit/sql-test-target.test.ts` | Cada parámetro prohibido, vacío, repetido o con nombre codificado, se rechaza en runtime y pruebas. Espías confirman cero construcción de pool, conexión o lectura de certificados. Mensaje y propiedades sin URL/valores/cause. Una URL sin esos parámetros atraviesa esta guarda, sujeta a las demás validaciones y a Q-05. Rojo antes de implementar |
| M06.3a-T-48 | C-25 | unit; `npm run test:unit -- tests/unit/credential-crypto.test.ts`; app T-31 | X509Certificate del PEM coincide con la huella documentada; pool recibe ca y rejectUnauthorized true sin checkServerIdentity propio. Errores de certificado/hostname no activan fallback ni unconfirmed. T-31 autentica con esa configuración real. Rojo antes de implementar; la evidencia TLS sin login del grill no sustituye T-31 |

La suite unit concentra los negativos criptográficos; la suite app prueba autenticación, capacidades/restricciones, recorrido real del repositorio y las regresiones SQL anteriores. El caso AAD contra filas reales es complementario, no reemplaza los negativos unitarios.

## Verificación

En este orden, con la salida real en la evidencia (CB-05):

1. `npm run test:unit`: todas las suites, incluidas las cuatro nuevas o extendidas.
2. `npm run db:check:test` después de la intervención (T-27).
3. `npm run test:app`, con todas las suites exigidas ejecutadas. `tests/app/email-flows.test.ts` sigue siendo opt-in y ajena al corte (`H-E1-23`); la suite nueva no puede quedar omitida (CB-06).
4. `npm run verify`: exit 0. Si Vitest falla al cargar desde Git Bash, se repite con `powershell -NoProfile -Command "npm run verify"` antes de reportar una regresión (`H-E1-20`); un fallo de arranque del pool se repite una vez y se registra (`H-E1-18`).
5. T-24, T-28, T-29, T-30, T-37, T-38 y T-39.

III.3 actualizado por D-M06.3a-01 exige `db:check:test` y `test:app`, además de `verify`. No se corre `test:policies`: la microfase no cambia SQL (T-39 lo confirma). Nada corre contra el proyecto `app` (CB-04); `db:preview` no se usa.

## Intervenciones del usuario y acciones reservadas

| Paso | Qué hace el usuario | Cómo se verifica después |
|---|---|---|
| Antes de implementar | Confirmar cierre global del grill; después auditoría de spec y aprobación visible del usuario antes de continuar el pipeline | Decisiones `D-M06.3a-NN` en esta spec |
| Secuencia, paso 7 | En el SQL editor de `praxa-test`, fijar la contraseña del rol: `alter role praxa_integrations with password '<generada>'`, fuera del repositorio y sin pegarla en el chat (ficha, plan.md:223; III.2) | T-31 conecta. Si falla, el asistente consulta como `postgres`, por `SUPABASE_TEST_DB_URL`, solo `rolcanlogin`, `rolconnlimit` y si `rolvaliduntil` es nulo o futuro (`H-E1-36`), y frena el gate |
| Secuencia, paso 7 | `npm run env:prepare`; cargar en `.env.local` `PRAXA_INTEGRATIONS_TEST_DB_URL` con usuario `praxa_integrations.<ref de pruebas>`, el host del pooler, puerto 6543 y la contraseña codificada en porcentaje | T-27 (`db:check:test`) |
| Secuencia, paso 7 | Generar una clave de 32 bytes en base64 (por ejemplo `openssl rand -base64 32`) y cargar `PRAXA_CREDENTIAL_KEYS=1:<clave>` y `PRAXA_CREDENTIAL_KEY_CURRENT=1` en `.env.local`, sin pegarlas en el chat | T-33 descifra con ese llavero; no se omite esta comprobación |
| Cierre | Aprobar `G-CRYPTO` | `PROJECT_STATE.md` lo registra con fecha |
| Cuando lo pida | Commit, push y PR de `mf/M06.3a` | `git log` y estado del remoto |
| Reservado al usuario | Push, despliegue en Vercel, `db:push` al proyecto `app` y `db:push:test` | El asistente no los ejecuta. Esta microfase no necesita ningún `db:push` |
| No en esta microfase | Contraseña del rol en el proyecto `app`, `PRAXA_INTEGRATIONS_DB_URL` real y variables en Vercel | `M28.2a` (plan.md:533-535) |

## Trampas y riesgos

De la ruta:

1. **IV reutilizado** (II.6, primera trampa): se genera al azar en cada `seal`, se guarda con el texto cifrado y nunca se deriva. T-04 lo prueba.
2. **Versión ausente confundida con texto alterado** (II.6, segunda trampa): dos clases distintas, sin herencia entre ellas. T-10.
3. **Una prueba omitida por configuración no aprueba el gate** (CB-06; II.5, tercera trampa): la suite del rol falla, no se omite, cuando faltan sus variables.
4. **Nunca recurrir a `PRAXA_INTEGRATIONS_DB_URL` en pruebas** (spec.md:106).

Del código:

5. **Etiqueta GCM corta aceptada.** En Node 24.18.1, sin `authTagLength`, `createDecipheriv` acepta una etiqueta de 4 bytes (verificado al expandir; solo emite `DEP0182`). Siempre `authTagLength: 16` y validación de la etiqueta antes de descifrar. T-09.
6. **`refFromDbUrl` no reconoce `praxa_integrations.<ref>`** (`target.mjs:41`). Si se lo reutiliza sin más, el proyecto "no se puede deducir" y la guarda rechaza todo; si se lo generaliza, `SUPABASE_TEST_DB_URL` aceptaría otro usuario. Por eso §7 analiza el usuario aparte y no cambia `refFromDbUrl`.
7. **Un usuario `postgres.<ref>` en la URL del rol** haría pasar las pruebas del rol como administrador. §7, regla 3.
8. **`bigint` llega como cadena y `timestamptz` como `Date`** desde `pg`: `credential_count` y `expires_at` se convierten explícitamente (T-16).
9. **Error sin manejar en el pool.** Sin `pool.on('error')`, la caída de un cliente inactivo termina el proceso.
10. **Errores de `pg` con detalle.** `detail` y algunos mensajes de conexión traen datos de la fila o del host. Mensajes fijos y sin `cause` (T-17).
11. **El recorrido del árbol se detecta a sí mismo** si contiene literales con forma de secreto: las muestras se arman en tiempo de ejecución y el propio archivo se excluye.
12. **Fixtures sintéticos existentes** (`supabase-key-formats.test.ts:24`, contraseñas `secreta` y `clave`): la lista sintética es cerrada y declarada; no se editan esos archivos.
13. **Conteo global de `count_credentials_by_key_version`.** El proyecto de pruebas puede tener credenciales de otras corridas: la rotación de T-35 usa una versión sintética propia de la corrida.
14. **`server-only` en Vitest** (`H-E1-17`): sin mock o alias, toda suite que importe los módulos nuevos falla al resolver el paquete.
15. **Lockfile.** Mover `pg` sin actualizar `package-lock.json` rompe `npm ci` en la CI.
16. **Reintento con otro IV.** Repetir una función de conveniencia prepara una operación nueva. Ante resultado incierto se reutiliza la operación preparada de Diseño §6. Perderla en un reinicio exige reconciliación en M16.1; este corte no ofrece idempotencia durable.
17. **Memoización del llavero.** Cambiar las variables sin reiniciar el proceso no cambia la clave actual.
18. **Inestabilidad de Vitest** (`H-E1-18`, `H-E1-20`): no confundir con regresiones.
19. **`.env.example` ya subcontaba** (nueve variables declaradas con "Ocho" en el encabezado): recalcular desde el archivo.

Riesgos:

- `H-E1-36`: si `praxa_integrations` en `praxa-test` tiene `rolconnlimit = 0` o `rolvaliduntil` vencido, T-31 falla. Condición de parada: se frena y se lleva al usuario el resultado de la consulta de atributos, sin contraseñas.
- H-S-02: si el pooler en modo transacción rechaza las consultas parametrizadas sin nombre de `pg`, T-33 falla y el paso 4 de II.6 no se puede cumplir tal como está. Condición de parada.
- La suite permanente debe ejecutarse y pasar; un verde de otras suites no sustituye el acceso real exigido.

## Decisiones de la microfase

| ID | Decisión | Motivo | Decidió | Fecha |
|---|---|---|---|---|
| D-M06.3a-01 | Q-01 A: suite permanente, trust path real y recorrido de repositorio; configuración inválida falla, sin skip ni fallback. | Respuesta explícita del grill; alcance vigente | Usuario | 2026-10-01 |
| D-M06.3a-02 | Q-02 B acotada: lockfile, sql-target y README solo tabla de variables de prueba y salvaguardas. | Respuesta explícita del grill; alcance vigente | Usuario | 2026-10-01 |
| D-M06.3a-03 | Q-03 A: mock de server-only en cada suite que lo importe directa o indirectamente; convención de repo. | Respuesta explícita del grill; alcance vigente | Usuario | 2026-10-01 |
| D-M06.3a-04 | Q-04 A: recifrado solo en estados permitidos; disconnected se descifra para revocar, no se recifra. Regresión concurrente PX006. H-E1-37 mitigado, no resuelto integralmente. | Respuesta explícita del grill; alcance vigente | Usuario | 2026-10-01 |
| D-M06.3a-05 | Q-06: keyVersion describe el material leído; nunca la DB posterior. PX008 sin versión inventada ni relectura. | Respuesta explícita del grill; alcance vigente | Usuario | 2026-10-01 |
| D-M06.3a-06 | Q-07: operación preparada reutilizable exactamente; sin retries automáticos, persistencia ni idempotencia durable tras pérdida por crash. | Respuesta explícita del grill; alcance vigente | Usuario | 2026-10-01 |
| D-M06.3a-07 | Q-08: retiro exige nueva versión única para escrituras, writers antiguos inhabilitados, operaciones terminadas y conteo cero. Si no se acredita, conservar clave. | Respuesta explícita del grill; alcance vigente | Usuario | 2026-10-01 |
| D-M06.3a-08 | Q-09: capacidades por categoría en SECURITY, matriz exacta solo en migraciones/pgTAP; resuelve H-E1-41. | Respuesta explícita del grill; alcance vigente | Usuario | 2026-10-01 |
| D-M06.3a-09 | Q-10: entregar la credencial correctamente leída y autenticada cuando el rewrap posterior falla por timeout/transporte, indicando recifrado no confirmado. Conservar keyVersion leída, sin retry automático ni afirmación sobre persistencia. | CA-25 no exige confirmar el rewrap antes de entregar material autenticado; retiro protegido por Q-08 | Usuario | 2026-10-01 |
| D-M06.3a-10 | Q-11 A: rechazar parámetros TLS en ambas URLs antes de abrir conexión; política exclusiva del módulo, sin overrides ni eliminación silenciosa | Configuración inequívoca y error redactado; complementada por D-M06.3a-11 | Usuario | 2026-10-01 |
| D-M06.3a-11 | Q-05: CA pública oficial como trust anchor versionado en worker-api.ts; rejectUnauthorized true y verificación estándar de hostname de Node. Fuente, fecha y fingerprint auditables. Sin variable adicional, descarga en runtime ni fallback; cambiar CA requiere revisión y despliegue | Evidencia TLS real: éxito con CA, fallo sin CA y rechazo de hostname incorrecto. Q-11 conserva la política exclusiva del módulo | Usuario | 2026-10-01 |

## Supuestos e hipótesis

- **H-S-01 — HIPÓTESIS.** El pooler compartido de Supabase autentica a `praxa_integrations`, creado por `0012` y con contraseña fijada en el SQL editor, con el usuario `praxa_integrations.<ref>`. La guía oficial confirma el formato `[ROLE].[PROJECT-REF]` para roles propios (https://supabase.com/docs/guides/database/connecting-to-postgres, consultada al expandir). *Cómo y cuándo:* T-31, después de la intervención.
- **H-S-02 — HIPÓTESIS.** Las consultas parametrizadas sin `name` de `pg` 8.23 (protocolo extendido con sentencia sin nombre) funcionan en el pooler en modo transacción, que "no soporta prepared statements" según la misma guía. *Cómo y cuándo:* T-33 con puerto 6543. Si falla, condición de parada.
- **H-S-03 — HIPÓTESIS.** Los tokens de acceso de Meta empiezan con `EAA`, y los códigos de autorización superan los 20 caracteres. Meta no documenta el formato. Si es falsa, el patrón `meta_token` no detecta tokens reales, pero `oauth_param` y `env_secret_assignment` siguen cubriendo las formas de filtración más probables. *Cómo y cuándo:* en `M16.2`, con el token real de VR-01, comprobando solo el prefijo, sin registrarlo.
- **H-S-04 — HIPÓTESIS.** `pg` 8.23 devuelve `bigint` como cadena, `timestamptz` como `Date` y `text[]` como arreglo. *Cómo y cuándo:* T-16 fija la conversión, y T-33 y T-35 la ejercitan contra la base.
- **H-S-05 — VERIFICADA para TLS del endpoint compartido de pruebas (2026-10-01).** La CA pública del enlace oficial del dashboard permite validar cadena y hostname con Node 24.18.1 y el transporte de pg 8.23.0. Evidencia en sesiones/M06.3a.md. Configuración adoptada en D-M06.3a-11; login del rol y recorrido worker_api siguen en T-31 y la suite app.
- **H-S-06 — HIPÓTESIS.** `praxa_integrations` en `praxa-test` tiene `rolconnlimit = -1` y `rolvaliduntil` nulo, porque `0012` lo creó en un proyecto recreado (`H-E1-36`). *Cómo y cuándo:* T-31; si falla, la consulta de atributos de la Intervención.
- **Verificado.** Node 24.18.1 acepta una etiqueta GCM de 4 bytes sin `authTagLength` (trampa 5). `z.iso.datetime({ offset: true })` acepta `Date#toISOString()`. La CI usa un checkout de Git y `npm ci` (`.github/workflows/verify.yml`). `server-only` no está instalado y Next no lo exige (documentación local de Next).

## Preguntas abiertas

Ninguna decisión de Q-01 a Q-11 queda abierta. Todas están incorporadas en D-M06.3a-01 a D-M06.3a-11. Falta la confirmación global del usuario de que se alcanzó entendimiento compartido para cerrar el grill. La spec continúa BORRADOR: no está auditada ni aprobada, y no autoriza implementación.

Fuentes para la comprobación: https://node-postgres.com/features/ssl y https://supabase.com/docs/guides/platform/ssl-enforcement. La documentación no sustituye la evidencia del destino de pruebas.

**M06.3a-Q-10 resuelta:** D-M06.3a-09; contrato en Diseño §6 y regresiones T-45/T-46. No queda pendiente de decisión.

**M06.3a-Q-11 resuelta:** A, D-M06.3a-10; contrato en Diseño §5 y regresión T-47.

**Evidencia reunida para Q-05 (2026-10-01):** el endpoint público de pruebas confirmado por el usuario fue comprobado sin credenciales ni SQL. La confianza predeterminada de Node 24.18.1 falló con `SELF_SIGNED_CERT_IN_CHAIN`. Con la CA pública obtenida del enlace oficial del dashboard, Node y el transporte de pg 8.23.0 verificaron cadena y hostname (`authorized=true`, TLSv1.3); hostname incorrecto falló con `ERR_TLS_CERT_ALTNAME_INVALID`. Comandos, fuente, cadena y límites en `meta_first/sesiones/M06.3a.md`, sección Q-05. La autenticación del rol y worker_api siguen pendientes de implementación.

**Q-05 aprobada:** D-M06.3a-11. El contrato definitivo está en Diseño §5. No hace falta descarga manual del usuario ni una variable adicional. Las hipótesis restantes de autenticación y ejecución SQL se verifican durante implementación; no son decisiones de diseño pendientes del grill.

## Hallazgos relacionados

- `H-M04.1-02` (excepción `SUPABASE_TEST_ALLOW_APP_PROJECT`): se cierra en esta microfase (C-14, T-23, T-24).
- `H-E1-09` (`pg` en `devDependencies`): se cierra (C-11, T-28).
- `H-E1-10` (`no-privileged-credentials` como lista de nombres): se cierra con la invariante del paquete `pg` (C-12, T-21).
- `H-E1-17` (`server-only` en Vitest): según `M06.3a-Q-03` (C-19, T-38).
- `H-E1-36` (atributos de conexión de un rol reutilizado): se comprueba el acceso (C-18, T-31); el endurecimiento sigue en `M16c`.
- `H-E1-37`: mitigación / límite aceptado a nivel repository según D-M06.3a-04; pendiente de implementar y verificar. SQL conserva su capacidad más amplia.
- `H-E1-12` (`verify` no corre pgTAP ni `test:app`): sección Verificación.
- `H-E1-18` y `H-E1-20` (inestabilidad de Vitest): Verificación, paso 4.
- `H-E1-23` (alcance de CB-06 con suites opt-in): Verificación, paso 3.
- `H-E1-24` (`create_pending_connection` sin intento consumido): lo resuelve `M16.1`; el repositorio no lo cambia.
- `H-E1-03` y H-E1-40: retención y referencias antiguas, fuera de este corte.
- `H-E1-41`: resuelto documentalmente por D-M06.3a-08; categorías y restricciones con matriz canónica enlazada.
- A registrar al implementar: `src/lib/env.ts:9-12` desactualizado (fuera de la tabla).

## Auditorías

Ninguna todavía.
