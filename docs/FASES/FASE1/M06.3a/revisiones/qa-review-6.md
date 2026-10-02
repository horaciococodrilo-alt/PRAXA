# QA de M06.3a — 6

## Nota de proceso concurrente (leer antes del resto)

Al empezar esta revisión, el árbol ya tenía sin seguimiento `implementation-review-10.md`,
`pr.md` y `qa-review-5.md` (excluidos de la comprobación de árbol limpio por el patrón de la
skill). `implementation-review-10.md` advierte explícitamente de un QA corriendo en paralelo
sobre la misma rama y recomienda confirmar con el usuario cuál cadena de revisión es la
vigente antes de avanzar. Esta revisión es independiente de `qa-review-5.md`: no reutiliza su
veredicto ni sus sondas, volvió a ejecutar toda la verificación y construyó sus propias
pruebas exploratorias. El resultado **no coincide** con `qa-review-5.md` (que concluyó LISTO
PARA PR): esta revisión encontró un hallazgo nuevo mediante exploración independiente (§5,
Q-01) que `qa-review-5.md` no reporta. Antes de usar `pr.md` (escrito por ese otro proceso),
el usuario debería resolver cuál de los dos QA es el vigente; por los motivos de abajo, esta
revisión no lo confirma como vigente y no lo reemplaza porque no corresponde escribir `pr.md`
con este veredicto.

## Estado y veredicto

- Fecha: 2026-10-02. Rama `mf/M06.3a`, commit `0327ad647381a8c22737dc0899e18717f57e18fe`,
  base (`git merge-base main HEAD`) `80e5bf33c344da08f3648c0af10f7cfdbee2605e`.
- Precondiciones: rama correcta (PASS); última revisión de implementación
  `implementation-review-10.md`, **APROBABLE**, sobre el mismo commit y la misma base (PASS);
  árbol limpio salvo `revisiones/*` (PASS, verificado al abrir y al cerrar esta revisión).
- **REQUIERE CAMBIOS.** La implementación, la suite real con el rol y `npm run verify` están
  en verde y coinciden con la evidencia de las revisiones anteriores. Pero una sonda
  exploratoria propia, fuera de los casos ya cubiertos por las pruebas permanentes, encontró
  un caso reproducible en el que la guarda de identidad/destino (`AMBIGUOUS_ENCODING`,
  D-M06.3a / H-E1-45, criterio C-26) **no** rechaza una URL con una ambigüedad de
  percent-encoding al final de la cadena, contradiciendo el comentario del propio código y el
  principio de "ningún rechazo construye Pool/Client" que las pruebas T-47/T-49 verifican para
  todos los demás casos de ambigüedad. Ver Q-01 en §6.

## Fuentes leídas

`docs/FASES/FASE1/M06.3a/spec.md` completa (727 líneas); `docs/FASES/FASE1/M06.3a/plan.md`
completo; `docs/FASES/FASE1/meta_first/plan.md` III.3 y III.9; `docs/FASES/FASE1/meta_first/
sesiones/M06.3a.md` completa; `implementation-review-10.md`; `.github/workflows/verify.yml`;
`vitest.config.mts`; `package.json` (scripts); `docs/PROJECT_STATE.md`; `docs/HALLAZGOS.md`
(entradas `H-E1-43` a `H-E1-47`); `src/modules/integrations/db/worker-api.ts` y
`scripts/lib/sql-target.mjs` (las dos copias de `AMBIGUOUS_ENCODING`); `tests/unit/
credential-crypto.test.ts` (secciones T-20, T-47, T-49, T-50).

## Matriz de comportamiento

**P** positivo, **N** negativo, **B** borde. Casos y criterios tomados de
`docs/FASES/FASE1/M06.3a/spec.md` (sección "Criterios de aceptación" y "Casos de prueba"), no
del código. `T-NN` son pruebas permanentes ya existentes; verificadas por re-ejecución propia
de `npm run test:unit`, `npm run test:app` y `npm run verify` en esta revisión (§7), más
lectura directa del archivo de pruebas para confirmar que la aserción corresponde al caso.
`E-NN` son las sondas exploratorias propias de esta revisión (§5).

| Criterio | Caso | Tipo | Cubierto por | Resultado |
|---|---|---|---|---|
| CA-21 | Rol real usa función; tablas denegadas directamente; empresa ajena no lee vía AAD | P/N/B | T-31, T-32, T-34 | PASS |
| CA-23/CA-11b | IV nuevo de 12 bytes por llamada; AAD de empresa+conexión+proveedor; material movido de fila no abre | P/N/B | T-02 (seal), T-34 (real) | PASS |
| CA-24 | Material auténtico abre; clave/texto/etiqueta/AAD alterados fallan explícito; etiqueta corta falla antes de intentar descifrar | P/N/B | T-03, T-06–T-09 | PASS |
| CA-25 | Cifra con la actual, descifra con la guardada; rotación al usar; versión ausente da error propio, no un fallo de descifrado silencioso | P/N/B | T-05 (versión ausente), T-10–T-13, T-35 (real) | PASS |
| CA-26 | Ningún secreto en logs/errores/fixtures; recorrido del árbol los detecta | P/N/B (el borde es la lista sintética tolerada) | T-25, T-26, `no-secrets-in-tree` completa | PASS |
| CA-27 reescrita | `PRAXA_INTEGRATIONS_DB_URL` solo en `worker-api.ts`; las dos reglas originales siguen | P/N | T-21 | PASS |
| CA-11b | AAD obligatorio; conexión ajena no autentica | P/N | T-34 | PASS |
| C-01 | Llavero válido de 2 versiones; cada violación de formato rechazada con código y posición, sin exponer la clave | P/N | T-01, T-02 | PASS |
| C-02 | `sealCredential`: clave actual, IV de 12 bytes, etiqueta de 16, AAD correcto; texto vacío rechazado | P/B(vacío) | T-02 | PASS |
| C-03 | `openCredential` recupera el original; alteraciones de clave/texto/etiqueta/AAD dan `CredentialDecryptionError`; etiqueta mal formada da `CredentialMaterialError` sin descifrar | P/N/B | T-03, T-06–T-09 | PASS |
| C-04 | Versión ausente da `CredentialKeyVersionUnknownError`, nunca `CredentialDecryptionError` | N | T-05 | PASS |
| C-05 | Versión menor + estado permitido recifra una vez; igual o mayor no llama; `canRetireKeyVersion` solo `true` sin credenciales de esa versión | P/N/B | T-12, T-13, T-35 (real, conteo a cero) | PASS |
| C-06 | `disconnected` descifra sin recifrar; `PX006` da `CredentialChangedError`; `PX008` se tolera | P/N/B | T-14, T-15, T-36 y T-41 (real) | PASS |
| C-07 | `server-only` primera línea; único lector de `PRAXA_INTEGRATIONS_DB_URL`; SQL solo del mapa; sin `name`; `pool.on('error')`; `config_missing` sin valores | P/N | T-17, `no-privileged-credentials` | PASS |
| C-08 | Todo error sale como `WorkerApiError` tipado, sin `detail/hint/cause`/parámetros/cadena de conexión | P/N | T-17 | PASS |
| C-09 | Repositorio solo toma `user_id`/`company_id` de K01; rechaza K01 corrupto antes de tocar la base; AAD con `company_id`+conexión+`'meta'`; id de conexión nueva generado en servidor | P/N | T-19, T-51 | PASS |
| C-10 | `SecretValue`: `String()`, interpolación de plantilla, `JSON.stringify`, `util.inspect` (y por lo tanto `console.log`) dan `[redactado]`; `reveal()` da el texto | P | T-20 (verificado leyendo el código: las cuatro formas de exposición están cubiertas, no solo `toString`) | PASS |
| C-11 | `pg` en `dependencies`, no en `devDependencies`; `@types/pg` sigue en desarrollo; build y `npm ci` sin desincronización | P/N | T-28, inspección de dependencias, `verify` | PASS |
| C-12 | Cinco reglas nuevas de `no-privileged-credentials`; los dos `it` originales sin cambios | P/N | T-21 | PASS |
| C-13 | Siete reglas de `resolveIntegrationsTestTarget`; `check-target test` informa sin valores y sale 1 si la variable definida es inválida | P/N/B | T-22, T-23, `db:check:test` | **PASS en las reglas 3–7 probadas; gap encontrado en la validación previa de ambigüedad de encoding compartida con C-26 (ver E-01/E-02, Q-01)** |
| C-14 | Sin soporte operativo de `SUPABASE_TEST_ALLOW_APP_PROJECT`; única aparición permitida es T-23 | N | T-23, T-24 | PASS |
| C-15 | Recorrido vía `git ls-files`, nunca `.env.local`; patrones de Diseño §9; informe sin texto coincidente; falla si `git` falla | P/N/B | `no-secrets-in-tree` completa | PASS |
| C-16 | `SECURITY.md`/`ARCHITECTURE.md` documentan lo pactado sin duplicar matriz exacta ni tocar retención | P | Diff revisado (§7) | PASS |
| C-17 | Cuatro variables nuevas sin valor; conteo recalculado (trece); sección final corregida | P | T-30, lectura de `.env.example` (§7) | PASS |
| C-18 | Login real `praxa_integrations`; `42501` en lectura directa de tabla; crea/lee credencial con AAD; rotación real; `disconnected` no recifra; sin variable o inválida la suite falla (no se omite) | P/N/B | T-31–T-36, T-41, T-43 (real, 8/8) | PASS |
| C-19 | Mock explícito `server-only` en las suites nuevas | P | Lectura de cabeceras de `credential-crypto.test.ts` y las tres suites de guardas | PASS |
| C-20 | Sin diff/archivos nuevos en `supabase/`; sin comandos contra `app` | N | `git diff --name-only main -- supabase/`, `git ls-files -o` (§7) | PASS |
| C-21 | Operación preparada reutilizable sin resellar; rechaza otro actor/empresa; sin retry automático | P/N | T-42, T-43 (real) | PASS |
| C-22 | Retiro requiere condiciones operativas además del conteo cero; `canRetireKeyVersion` solo mira DB | P/B | T-44 | PASS |
| C-23 | Timeout/transporte en rewrap da `unconfirmed` con `keyVersion` leída; errores explícitos no se confunden con incertidumbre | P/N | T-45, T-46 | PASS |
| C-24 | Ambas URLs rechazan parámetros TLS antes de Pool/Client/red | N | T-47 | PASS (en los parámetros probados) |
| C-25 | CA pública versionada; verificación de cadena/hostname estándar de Node; fallo TLS se propaga redactado | P/N | T-48, T-50; T-25 real (TLS real contra el pooler) | PASS |
| C-26 | Ambas URLs rechazan overrides `user/host/port` y exigen identidad/destino validados antes de Pool/Client/red; el resolvedor tampoco admite overrides | N/B | T-49, T-22 | **FAIL en un caso de borde no cubierto por T-49/T-22: ver E-01/E-02 y Q-01** |
| C-27 | `Queryable` según §5; validación de entrada/operación/respuesta con errores tipados; proyección K04 solo tras validar contexto/lifecycle | P/N | T-51–T-53 | PASS |
| CB-01–CB-06 | `verify`/`test:app`/`db:check:test` pasan; sin secretos/migraciones/producción; evidencia real; omisión no acredita | P/N/B | Re-ejecución completa (§7); 7 omisiones de `test:app` ajenas a M06.3a confirmadas por nombre de archivo | PASS |

No hay recorrido manual: la ficha y III.8 del plan de la ruta clasifican a `M06.3a` como
cimiento sin UI visible.

## Sondas exploratorias (E-01, E-02)

Se usó un worktree temporal fuera del repositorio (`../praxa-qa-M06.3a`, `git worktree add
../praxa-qa-M06.3a HEAD`, `npm ci --offline`, 471 paquetes) para no tocar el árbol principal.
Las pruebas exploratorias se guardaron en `tests/unit/__qa__/M06.3a-trailing-percent.test.ts`
dentro de ese worktree.

**Motivación.** El comentario de `AMBIGUOUS_ENCODING` en `worker-api.ts` (y su copia idéntica
en `sql-target.mjs`) dice explícitamente: *"pg-connection-string vuelve a codificar toda la
cadena con `encodeURI` cuando encuentra un espacio sin codificar o un `%` que no va seguido de
dos dígitos hexadecimales"*. La expresión regular usada es `/ |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i`.
Las dos alternativas con `%` necesitan que existan 1 o 2 caracteres **después** del `%` para
poder decidir si la secuencia es ambigua. Si el `%` problemático está en el último o
penúltimo carácter de **toda la cadena** (sin nada después, o con un solo dígito hex y nada
más), ninguna alternativa tiene caracteres que inspeccionar y la expresión no coincide, aunque
la propia definición del comentario ("no va seguido de dos dígitos hexadecimales") sí
describe ese caso como ambiguo.

**Código de la sonda (E-01/E-02), tal como se ejecutó, en el worktree temporal:**

```ts
// tests/unit/__qa__/M06.3a-trailing-percent.test.ts
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const pgState = vi.hoisted(() => ({ constructed: [] as unknown[] }));
vi.mock('pg', () => ({
  default: {
    Pool: class {
      constructor(options: unknown) { pgState.constructed.push(options); }
      query() { return Promise.resolve({ rows: [] }); }
      on() {}
      end() { return Promise.resolve(); }
    },
  },
}));

const ConnectionParameters = createRequire(import.meta.url)(
  'pg/lib/connection-parameters',
) as new (options: Record<string, unknown>) => { user: string; host: string; port: number };

const testRef = 'a'.repeat(20);
const base = `postgresql://praxa_integrations.${testRef}:clave@aws-0-us-west-2.pooler.supabase.com:6543/postgres`;

describe('QA exploratorio M06.3a: % incompleto al final de la URL (gap de AMBIGUOUS_ENCODING)', () => {
  it('createWorkerApi rechaza o acepta una URL que termina en "%" suelto', async () => {
    const { createWorkerApi } = await import('@/modules/integrations/db/worker-api');
    const url = `${base}%`;
    pgState.constructed.length = 0;
    let threw = false;
    try { createWorkerApi({ connectionString: url }); } catch { threw = true; }
    expect(threw).toBe(true); // esperado por la spec/el comentario del código
  });

  it('createWorkerApi rechaza o acepta una URL que termina en "%4" (un solo hex, sin segundo dígito)', async () => {
    const { createWorkerApi } = await import('@/modules/integrations/db/worker-api');
    const url = `${base}%4`;
    pgState.constructed.length = 0;
    let threw = false;
    try { createWorkerApi({ connectionString: url }); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});
```

**Resultado:** `npm run test:unit -- tests/unit/__qa__/M06.3a-trailing-percent.test.ts
--reporter=verbose` (PowerShell) → **1 archivo, 2/2 pruebas FALLIDAS** (`expect(threw).toBe(true)`
recibió `false` en ambos casos): `createWorkerApi` **no lanzó**, construyó un `pg.Pool` real
(`pgState.constructed.length === 1`) para las dos URLs con `%` ambiguo al final.

**Confirmación fuera del mock, con `pg` real (no es código de producción, solo diagnóstico, en
el mismo worktree, sin red real: la conexión nunca llega a intentarse porque el parseo falla
antes):**

```js
// node -e, en el worktree temporal
const pg = require('pg');
const p = new pg.Pool({ connectionString: 'postgresql://praxa_integrations.aaaaaaaaaaaaaaaaaaaa:clave@aws-0-us-west-2.pooler.supabase.com:6543/postgres%' });
async function call() {
  try { await p.query('select 1'); }
  catch (e) { console.log('CAUGHT:', e.constructor.name, e.message); }
}
call();
```

Resultado: `CAUGHT: URIError URI malformed`, lanzado dentro de `pg-connection-string/index.js:67`
(`decodeURI(pathname)`) al intentar crear el primer `Client` del pool, durante `pool.query()`.
Repetido también con `resolveIntegrationsTestTarget` (misma guarda duplicada en
`scripts/lib/sql-target.mjs`): con las mismas dos URLs, devuelve `{"ok":true, ...}` — el
resolvedor de destino de pruebas también acepta la ambigüedad.

**Qué significa y qué no.** Confirmé con el código real de `worker-api.ts` (`call()` envuelve
`await pool.query(...)` en `try/catch` y pasa todo a `translated()`) que este `URIError`
**sí** queda atrapado por ese `try/catch` (no es un throw fuera de una promesa no capturada):
`translated()` no reconoce ningún código SQL en un `URIError` y cae al genérico
`WorkerApiError('unexpected')`, sin exponer la URL ni la contraseña. **No es una fuga de
secretos ni un bypass de identidad** (el carácter ambiguo cae en el *pathname*, nunca en
usuario/contraseña, porque esos componentes nunca pueden ser los últimos caracteres de una URL
válida). Pero **sí** es una violación concreta del invariante que las propias T-47/T-49 prueban
para todo el resto de los casos ("ningún rechazo construye Pool/Client") y del criterio C-26/
C-13: la guarda que existe precisamente para interceptar esta clase de ambigüedad antes de
`pg` (`H-E1-45`) no cubre el caso en que la ambigüedad cae al final de toda la cadena. El
`db:check:test`/`resolveIntegrationsTestTarget` informaría "destino verificado" para una URL
así, y la suite real fallaría después con un `WorkerApiError('unexpected')` genérico en vez de
un diagnóstico claro de configuración.

**Limpieza:** se borró `tests/unit/__qa__/M06.3a-trailing-percent.test.ts` y se ejecutó
`git worktree remove --force ../praxa-qa-M06.3a` (el `--force` es sobre esa ruta temporal
únicamente, por el archivo de prueba sin seguimiento que quedaba dentro). Después de borrar,
`git status --porcelain --untracked-files=all -- . ':(exclude)docs/FASES/FASE1/*/revisiones/*'
':(exclude)docs/FASES/FASE1/meta_first/sesiones/*-review-*'` en el repositorio principal volvió
a no devolver nada. `git worktree list` solo muestra `C:/Users/Simon/dev/PRAXA`.

Total de pruebas exploratorias ejecutadas: 1 archivo, 2 casos, los dos con resultado "FALLIDO"
respecto de la expectativa esperada por la spec — es decir, las dos sondas **encontraron** el
comportamiento buscado (la guarda no rechaza), lo cual constituye el hallazgo Q-01.

## Verificación completa

Todas repetidas en PowerShell por `H-E1-20` (Git Bash no cargó las suites de Vitest al
primer intento de esta sesión: "Vitest failed to find the runner" / "Cannot read properties
of undefined (reading 'config')" en 9/9 archivos; es la falla de entorno documentada, no un
FAIL de prueba — se repitió en PowerShell como exige la skill y el plan).

| Comando | Resultado |
|---|---|
| `npm run db:check:test` | Exit 0. `Destino verificado.`: proyecto desechable, URL administrativa y URL del rol con la misma referencia (`hyvfsfzrlhyrwirbvize`), sin imprimir valores |
| `npm run test:unit` (PowerShell) | Exit 0, 9 archivos, **188/188** |
| `npm run test:unit -- <4 archivos de esta corrección>` × 5 | Exit 0 las 5 veces, 4 archivos/63 pruebas cada vez (se repitió por la intermitencia de baja severidad que reporta `implementation-review-10.md`, R-01; no se reprodujo aquí) |
| `npm run test:app` (PowerShell) | Exit 0, 6 archivos, **37 pasadas, 7 omitidas** |
| `npm run test:app -- tests/app/integrations-worker-api-client.test.ts --reporter=verbose` | Exit 0, **8/8** (T-31–T-36, T-41, T-43), sin omisiones, nombres de caso confirmados uno por uno |
| `npm run verify` (PowerShell) | Exit 0: lint, typegen, typecheck, 10 archivos/**197/197**, build Next completo (ejecutado en background por el límite de 120 s de esta sesión; salida completa inspeccionada) |
| `npm run test:app -- --reporter=verbose` (listado de omitidas) | Las 7 omisiones: `concurrency.test.ts`, `onboarding.test.ts`, `integrations-data-api.test.ts`, `isolation.test.ts` ("NO EJECUTADA: falta el proyecto remoto de pruebas") y tres de `email-flows.test.ts` (opt-in). Ninguna pertenece a `M06.3a`; estas cuatro primeras ya aparecían omitidas en revisiones anteriores por una condición ajena a esta microfase, no introducida por esta sesión |
| `grep -rn SUPABASE_TEST_ALLOW_APP_PROJECT scripts tests src .github docs/SECURITY.md .env.example README.md` | 3 coincidencias, las tres dentro de T-23 (`tests/unit/sql-test-target.test.ts:204,209,213`) |
| `node -e "...pg deps..."` | `true false true` |
| `npm ci --dry-run` | Exit 0 (aviso informativo de `allow-scripts`, no bloqueante) |
| `git diff main -- package.json` | Solo mueve `pg` de `devDependencies` a `dependencies`, mismo rango `^8.23.0` |
| `git diff main -- .env.example` | Cuatro variables nuevas vacías; encabezado "Trece variables en total" |
| `git diff --stat main -- .env.example README.md docs/SECURITY.md docs/ARCHITECTURE.md` | 4 archivos, 76 inserciones/34 eliminaciones, dentro del alcance declarado |
| `git diff --name-only main -- supabase/`; `git ls-files -o --exclude-standard -- supabase/` | Ambos vacíos |
| `git diff --check` | Exit 0, sin salida |
| `git status --short` | Solo los tres archivos de proceso concurrente ya señalados, excluidos por el patrón de la skill |

## Requisitos, separados por etapa

**Para abrir el PR (NO cumplido todavía):**
- ✅ `npm run verify` en verde (CI local).
- ✅ `db:check:test` y `test:app`, incluida la suite real del rol, en verde y sin omisiones
  propias de M06.3a (III.3).
- ✅ Documentación (`SECURITY.md`, `ARCHITECTURE.md`, `.env.example`, `README.md`) dentro del
  alcance declarado, sin duplicar matriz exacta ni fechas.
- ✅ Higiene: sin secretos en el árbol, sin diff de `supabase/`, sin comandos contra `app`.
- ❌ **Pendiente:** el hallazgo Q-01 (gap de `AMBIGUOUS_ENCODING` en el borde de fin de cadena,
  C-26/C-13) debe corregirse y acreditarse con una prueba permanente antes de declarar el PR
  listo. Es el mismo tipo de corrección puntual que ya resolvió `H-E1-44` a `H-E1-47` en esta
  misma microfase: alcance acotado a `worker-api.ts`, `sql-target.mjs` y sus dos suites de
  pruebas ya previstas en el plan.
- La aprobación visible de `G-CRYPTO` es posterior al PR y la CI: no corresponde a esta etapa.

**Para el merge:** revisión de Codex sin bloqueantes y CI en verde — no evaluado en este QA
porque todavía no hay PR abierto; queda condicionado a que se resuelva Q-01 primero.

**Para el gate:** aprobación visible del usuario de `G-CRYPTO`, posterior a PR/CI; no se
ejecuta ningún `db:push` en esta microfase (reservado a `M28.2a`).

`PROJECT_STATE.md` sigue en **VERIFICADO — PENDIENTE DE NUEVA REVISIÓN Y QA** y no declara el
gate aprobado ni habilita `M28.2a`; es coherente con el estado real y con este veredicto. No
contiene explicaciones técnicas, hallazgos ni conteos de pruebas (cumple el contrato
documental). La sesión (`sesiones/M06.3a.md`) registra evidencia real de comandos y
resultados hasta la corrección de Q-01–Q-05 de `qa-review-4`; no incluye todavía este QA 6
porque el asistente de QA no edita la sesión.

## Hallazgos

| ID | Severidad | Criterio | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| Q-01 | Media | C-26, C-13 (A-02, `D-M06.3a-02`, familia de `H-E1-45`) | `AMBIGUOUS_ENCODING` (`/ \|%[^a-f0-9]\|%[a-f0-9][^a-f0-9]/i`, duplicada en `src/modules/integrations/db/worker-api.ts` y `scripts/lib/sql-target.mjs`) no detecta un `%` sin dos dígitos hexadecimales cuando ese `%` cae en los últimos 1–2 caracteres de toda la cadena de conexión (nada después, o un solo dígito hex y nada más). Contradice el propio comentario del código, que describe la ambigüedad como "un `%` que no va seguido de dos dígitos hexadecimales" sin excepción de posición. `createWorkerApi` construye un `pg.Pool` real para esa URL (viola el invariante "ningún rechazo crea Pool/Client" que T-47/T-49 verifican para el resto de los casos) y `resolveIntegrationsTestTarget` la informa `ok: true`. El fallo real ocurre más tarde, dentro de `pool.query()`, como `URIError: URI malformed` de `pg-connection-string` al decodificar el *pathname* — **no** es una fuga de secretos ni un bypass de identidad (el carácter ambiguo no puede caer en usuario/contraseña, que nunca son los últimos caracteres de una URL válida), y el `try/catch` de `call()` lo traduce correctamente a `WorkerApiError('unexpected')` sin exponer nada. Es un hueco de robustez/diagnóstico en una guarda de seguridad explícitamente creada para esta clase de ambigüedad, no una vía de explotación. | Sondas E-01/E-02 arriba: 2/2 con `createWorkerApi({ connectionString })` terminando en `.../postgres%` y `.../postgres%4`; `pgState.constructed.length === 1` en ambos casos (debería ser `0`). Confirmado también en `resolveIntegrationsTestTarget` con las mismas URLs → `{"ok":true,...}`. Confirmado con `pg` real (no mockeado) que el fallo posterior es `URIError: URI malformed` capturado por `try/catch`, nunca no manejado. | Extender la expresión para cubrir el fin de cadena, por ejemplo agregando las alternativas `%$` y `%[a-f0-9]$` (o equivalente con *lookahead* que también sea verdadero al final de la cadena), en las dos copias (`worker-api.ts` y `sql-target.mjs`), y agregar un caso a T-49 y a su equivalente de T-22 con una URL que termine en `%` y otra en `%` seguido de un solo dígito hexadecimal, verificando que ninguna construya `Pool`/acepte el destino. Registrar como nuevo hallazgo estable en `docs/HALLAZGOS.md` (sugerido `H-E1-48`) vinculado a la familia de `H-E1-45`. |
| — | Informativa, sin acción | — | La intermitencia de baja severidad que `implementation-review-10.md` registra como R-01 (un fallo aislado de T-49 en 11 corridas de un subconjunto específico de 4 archivos, sin reproducirse en el comando canónico) no se reprodujo en 5 repeticiones adicionales de esta revisión. Se deja constancia, sin abrir un hallazgo nuevo: ya está documentada en la revisión de implementación. | 5/5 corridas verdes de `npm run test:unit -- tests/unit/credential-crypto.test.ts tests/unit/sql-test-target.test.ts tests/unit/no-privileged-credentials.test.ts tests/unit/no-secrets-in-tree.test.ts` | Ninguna; no bloquea. |

## Pendientes del usuario

1. **Decidir cuál cadena de revisión es la vigente.** Hay dos QA independientes sobre el mismo
   commit `0327ad6` con veredictos distintos: `qa-review-5.md` (LISTO PARA PR, sin hallazgos) y
   este informe (REQUIERE CAMBIOS, hallazgo Q-01). El `pr.md` existente en el árbol fue escrito
   junto con `qa-review-5.md`; esta revisión no lo reemplaza ni lo valida porque su propio
   veredicto no lo permite. Antes de abrir un PR, el usuario debería confirmar con cuál de los
   dos QA sigue el proceso, o pedir que se corrija Q-01 y se repita el QA.
2. Si se acepta Q-01 como hallazgo real: autorizar una corrección puntual (mismo patrón que las
   de `qa-review-4`) en `worker-api.ts` y `sql-target.mjs`, con sus dos suites de pruebas ya
   previstas en el plan, seguida de una nueva revisión de implementación y un nuevo QA antes de
   declarar LISTO PARA PR.
3. No hay ninguna otra intervención de cuentas, secretos ni decisiones de negocio pendiente
   para este QA. La aprobación de `G-CRYPTO` sigue correspondiendo al usuario, después de PR y
   CI, y no se adelanta aquí.

No se escribe `pr.md` en este informe: el veredicto REQUIERE CAMBIOS no lo permite.
