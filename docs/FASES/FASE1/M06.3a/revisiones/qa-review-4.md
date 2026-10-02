# QA de M06.3a — 4

## Estado revisado

- Fecha: 2026-10-02. Rama: `mf/M06.3a`.
- Commit revisado: `83bfdd3b4ebd4562bbd228761e80997788b98141`. Base: `80e5bf33c344da08f3648c0af10f7cfdbee2605e` (`git merge-base main HEAD`).
- Precondiciones al iniciar, todas cumplidas:
  - La rama es `mf/M06.3a`.
  - La última revisión de implementación era `implementation-review-7.md`, con veredicto **APROBABLE**. Su commit y su base coinciden con los dos anteriores.
  - El comando de árbol limpio de la skill no devolvió nada.
- **Actividad externa durante este QA.** Otros dos procesos de QA y una corrección corrieron en paralelo:
  - `qa-review-2.md` dio REQUIERE CAMBIOS (su Q-02).
  - Después aparecieron cambios sin commit en `scripts/lib/sql-target.mjs`, `tests/unit/sql-test-target.test.ts`, la sesión, `HALLAZGOS.md` y `PROJECT_STATE.md`.
  - `qa-review-3.md` dio BLOQUEADO por esos cambios.
  - Por último se creó el commit `fecae40` ("review QA e implementacion de correcciones"), que es el HEAD al cerrar este informe.

  Este QA no hizo nada de eso. Todo lo que sigue evalúa `83bfdd3`. Al final hay una sección sobre qué sigue vigente en `fecae40`.

## Veredicto

**REQUIERE CAMBIOS.** Fallaron casos exploratorios en tres criterios. Todos se corrigen dentro de la microfase, en archivos previstos por el plan:

- **Q-01, media.** T-37 no verifica lo que la spec le pide. El mock de `pg` de su arnés no intercepta el `pg` de la suite. Por eso los contadores "cero Pool/Client" siempre dan 0, y el arnés no impide salir a la red.
- **Q-02, baja.** C-26 no se cumple en un borde: la identidad que valida la guarda puede ser distinta de la que usa `pg`.
- **Q-03, media.** Es el mismo defecto que R-02 de `implementation-review-7`, Q-02 de `qa-review-2` y H-E1-43. `fecae40` lo corrige. Este QA agrega la evidencia de punta a punta: con esa configuración, el `beforeAll` de la suite real deja pasar la conexión.
- **Q-04, baja.** La regla 7 acepta el puerto no canónico `06543`.
- **Q-05, observación.** Las URLs administrativas de referencia rechazan parámetros TLS, algo que la spec no pide.

`verify`, `test:unit`, `db:check:test`, `test:app` (con la suite del rol 8/8) y las comprobaciones T-24, T-28 y T-39 están en verde. No se creó `pr.md`. `G-CRYPTO` sigue pendiente y M28.2a sigue sin habilitar.

## Matriz de comportamiento

Tipos: `P` positivo, `N` negativo, `B` borde. Las filas `Q-…` son pruebas exploratorias de este QA, con el código más abajo. Los IDs `T-NN` son los casos de la spec. Los CA heredados se indican junto al criterio operativo que los verifica.

| Criterio | Caso | Tipo | Cubierto por | Resultado |
|---|---|---|---|---|
| C-01 (CA-25) | Dos versiones, orden y copias de 32 bytes | P | T-01 | PASS |
| C-01 | Espacios alrededor de `:` y de la versión actual se ignoran | P | Q-C01-a | PASS |
| C-01 | Rechazos con código, posición y sin la clave | N | T-02; Q-C01-b (coma final, base64url, no canónico, sin relleno, actual `01` o vacía) | PASS |
| C-01 | `keyFor` ausente: `unknown_key_version` y mensaje fijo | B | T-10; Q-C01-c | PASS |
| C-01 | `getCredentialKeyring` memoiza; ausente da `keyring_missing` | B | Q-C01-d | PASS |
| C-02 (CA-23, CA-11b) | Ida y vuelta, salida K04 y versión actual | P | T-03; Q-C02-a (Unicode) | PASS |
| C-02 | Texto vacío o que no es cadena: `invalid_plaintext` | N | T-05; Q-C02-a | PASS |
| C-02 | IV nuevo de 12 bytes por sello y etiqueta de 16 | B | T-04 | PASS |
| C-03 (CA-24) | Material auténtico abre | P | T-03 | PASS |
| C-03 | Clave, texto, etiqueta, IV o AAD alterados: `CredentialDecryptionError` sin `cause` ni material | N | T-06–T-08; Q-C03-b | PASS |
| C-03 | IV de 11 y 16 bytes, etiqueta de 4, 15 y 17, texto vacío o no base64, versión 0, 1.5 o `'1'`: `invalid_material` sin descifrador | B | T-09; Q-C03-a | PASS |
| C-04 (CA-25, trampa 2) | Versión vieja presente abre | P | T-11 | PASS |
| C-04 | Versión ausente da error propio | N | T-10, T-11 | PASS |
| C-04 | No es instancia de `CredentialDecryptionError` | B | T-10 | PASS |
| C-05 (CA-25) | Versión menor recifra una vez con la generación y la versión leídas | P | T-12, T-35 | PASS |
| C-05 | Versión igual o mayor no recifra | N | T-13 | PASS |
| C-05 | `canRetireKeyVersion`: true sin fila o con 0; true si solo otras versiones tienen conteo | B | T-16; Q-C05-a | PASS |
| C-06 (H-E1-37) | `pending_selection`, `active` y `needs_reauth` recifran | P | T-14 | PASS |
| C-06 | `disconnected` descifra sin recifrar; PX006 da `CredentialChangedError` sin token ni material | N | T-14, T-36, T-41; Q-C06-a | PASS |
| C-06 | PX008 da `version_conflict`, sin relectura | B | T-15 | PASS |
| C-07 | SQL del mapa, casts, aridad, sin `name` y `on('error')` | P | T-18 | PASS |
| C-07 | Nombres fuera de la unión (`toString`, `__proto__`, inyección) y args no array se rechazan antes de consultar | N | Q-C07-b | PASS |
| C-07 | Singleton runtime; URL runtime con TLS o `postgres.<ref>` da `config_invalid` sin Pool | B | T-18; Q-C07-a | PASS |
| C-07 | Las 12 firmas del mapa resuelven contra `0012` con el rol real | B | Q-C07-c (con base) | PASS: 11 `not_authorized` con actor sintético; conteo `ok` |
| C-08 (CA-26) | Traducción de SQLSTATE y códigos de red | P | T-17 | PASS |
| C-08 | Redacción de `detail`, `hint`, URL y contraseña; sin `cause` | N | T-17, T-53; Q-C08-b (`on('error')` no registra) | PASS |
| C-08 | Clase 08 (`08001`, `08P01`, `08003`) como transporte; `28000` como unavailable/other | B | T-17; Q-C08-a | PASS |
| C-09 (CA-00, CA-11b) | Solo `ctx` en args; UUID nuevo; AAD de la conexión nueva; retorno create exacto con ISO | P | T-19; Q-C09-a | PASS |
| C-09 | K01 inválido antes de la base | N | T-19, T-51 | PASS |
| C-09 | Otra empresa, o un actor ajeno a la empresa, no obtiene la credencial por el repositorio real | B | T-34; Q-C09-b (con base: tres `not_authorized`) | PASS |
| C-10 (CA-21, CA-26) | `reveal()` | P | T-20 | PASS |
| C-10 | `String`, plantilla, JSON e `inspect` dan `[redactado]` | N | T-20 | PASS |
| C-10 | `inspect` anidado y `Object.entries` no filtran | B | Q-C03-b | PASS |
| C-11 | `pg` en `dependencies` y build verde | P | T-28, T-40 (verify en este QA) | PASS |
| C-11 | `pg` fuera de `devDependencies` | N | T-28 | PASS |
| C-11 | `@types/pg` en desarrollo; lockfile sincronizado | B | T-28; `npm ci --dry-run --offline` | PASS |
| C-12 (CA-27) | Cinco reglas y dos `it` originales | P | T-21 | PASS |
| C-12 | Rotura detectable (variable o `pg` fuera del módulo) | N | Roturas de `implementation-review-7`; este QA no plantó archivos en `src/` porque se denegó el permiso | No re-ejecutado aquí |
| C-12 | Primera sentencia `server-only` en los cuatro módulos | B | T-21; `head -1` de los cuatro | PASS |
| C-13 (T09) | Configuración válida da `ok`; `db:check:test` da exit 0 y "Destino verificado." | P | T-22, T-27; Q-C13-f | PASS |
| C-13 | Rol `postgres`, otro proyecto, app, desechable, marcador, fallback y overrides | N | T-22, T-49; Q-C13-a; Q-C13-f (exit 1 e INVÁLIDA); Q-C13-e (sin valores) | PASS |
| C-13 | Regla 5 con `SUPABASE_DB_URL` no deducible y `NEXT_PUBLIC` igual al rol | B | Q-C13-c, Q-C18-c | **FAIL → Q-03** |
| C-13 | Regla 7: puerto `06543` | B | Q-C13-d | **FAIL → Q-04** |
| C-14 (H-M04.1-02) | La URL de pruebas distinta de la app pasa | P | T-22 | PASS |
| C-14 | La variable antigua no habilita la app | N | T-23 | PASS |
| C-14 | El literal solo aparece en T-23 | B | T-24 (líneas 161, 166, 170) | PASS |
| C-15 (CA-26) | Árbol sin hallazgos | P | T-25; scanner con los archivos de QA presentes, 5/5 | PASS |
| C-15 | Ocho patrones y un informe sin el texto | N | T-25 | PASS |
| C-15 | `.env.local` excluido; fallo de Git; rutas POSIX y win32 | B | T-25, T-26 | PASS |
| C-16 | SECURITY y ARCHITECTURE pasan a "vigente" solo lo implementado | P | T-29 (revisión 7 y `qa-review-2`) | PASS por revisión; no hay cambio funcional que probar |
| C-16 | No se duplica la matriz ni se toca la retención | N | T-29 | Ídem |
| C-16 | OAuth y sincronización siguen previstos | B | T-29 | Ídem |
| C-17 | Cuatro variables vacías y conteo 13 | P | T-30 | PASS |
| C-17 | Un valor haría fallar la prueba de `.env.example` | N | `it` original de `no-privileged-credentials` | PASS |
| C-17 | Sección final corregida | B | T-30 (diff) | PASS por revisión |
| C-18 (CA-21, CA-22, CA-24, CA-25, H-E1-36) | Login, `current_user`, CRUD, AAD, rotación, desconexión, carrera e idempotencia | P | T-31–T-36, T-41, T-43: 8/8 | PASS |
| C-18 | Sin la variable, la suite falla sin skip | N | T-37 | PASS en resultado; **aserción de contadores vacía → Q-01** |
| C-18 | Con variable inválida (`postgres.<ref>` u otro proyecto) falla por el resolvedor | N | Q-C18-a/b | PASS |
| C-18 | El mock de `pg` del arnés intercepta la suite | B | Q-T37-a | **FAIL → Q-01** |
| C-19 | Mock por suite, sin alias global | P | T-38 | PASS |
| C-19 | Sin dependencia nueva de `server-only` | N | T-38, `package.json` | PASS |
| C-19 | Las suites nuevas importan los módulos con el mock | B | T-38 | PASS |
| C-20 (CB-02–CB-04) | Diff de `supabase/` vacío | P | T-39 | PASS |
| C-20 | Ningún archivo nuevo en `supabase/` | N | `git ls-files -o --exclude-standard -- supabase/` | PASS |
| C-20 | Ninguna corrida contra la app | B | `db:check:test` antes de las pruebas con base | PASS |
| C-21 | Reutilización exacta del objeto preparado | P | T-42, T-43 | PASS |
| C-21 | Otro actor o empresa, o copia forjada, se rechaza | N | T-42, T-51 | PASS |
| C-21 | `inspect`, JSON y claves propias del objeto no contienen el token; congelado | B | Q-C21-a | PASS |
| C-22 (CA-25) | Conteo DB documentado como condición | P | T-44 | PASS por revisión |
| C-22 | Conteo cero no autoriza el retiro | N | T-44 | Ídem |
| C-22 | `disconnected` sin purga sigue contando | B | T-36 | PASS |
| C-23 | `confirmed` y `not_attempted` | P | T-12, T-46 | PASS |
| C-23 | Errores explícitos y fallos previos no dan `unconfirmed` | N | T-46, T-17/T-46 | PASS |
| C-23 | Transporte o timeout antes o después de escribir | B | T-45 | PASS |
| C-24 | URL sin parámetros TLS pasa la guarda | P | T-47 | PASS |
| C-24 | Parámetros TLS, incluidos en mayúsculas o repetidos, se rechazan sin Pool | N | T-47; Q-C26-a | PASS |
| C-24 | La guarda TLS aplica también a `getWorkerApi` | B | Q-C07-a | PASS |
| C-25 | CA y huella; `rejectUnauthorized`; `sslnegotiation postgres`; login real | P | T-48, T-50, T-31 | PASS |
| C-25 | Sin `checkServerIdentity` propio ni fallback | N | T-48 | PASS |
| C-25 | `PGSSLNEGOTIATION` adverso | B | T-50 | PASS |
| C-26 | Shared pooler en 6543 pasa; host en mayúsculas pasa; `PGUSER`, `PGHOST`, `PGPORT` y `PGPASSWORD` no alteran el destino efectivo | P | T-49; Q-C26-b | PASS |
| C-26 | Overrides, IPv6, punto final, dos etiquetas, guion, usuario en mayúsculas, ref de 19, sin contraseña, otro esquema, fragmento, escape inválido, sin base | N | T-49; Q-C26-a | PASS |
| C-26 | Identidad efectiva de `pg` = identidad validada | B | Q-C26-c | **FAIL → Q-02** |
| C-26 | Puerto `06543` en runtime | B | Q-C26-d | **FAIL → Q-04** |
| C-27 | Proyección K04, ISO y generación 0 y 2147483647 | P | T-52; Q-C27-c | PASS |
| C-27 | Entradas, envelopes y respuestas inválidas | N | T-51–T-53 | PASS |
| C-27 | Resolución perezosa: entrada inválida sin llavero ni URL; ejecutar y contar sin llavero | B | Q-C27-a, Q-C27-b | PASS |
| CB-01 | `verify` y suites de III.3 | P | Comandos de abajo | PASS en suites permanentes |
| CB-01 | Casos exploratorios fallidos | N | Q-01 a Q-04 | **FAIL global** |
| CB-01 | Linux (CI) | B | No ejecutado; T-25 portable por simulación | Pendiente para el merge |
| CB-05 | Evidencia con comandos y resultados | P | Sesión y este informe | PASS |
| CB-05 | Fallos y repeticiones registrados | N | Sesión y revisión 7 | PASS |
| CB-05 | Incidencia de red de este QA declarada | B | Sección "Incidencias" | PASS |
| CB-06 | Suite del rol sin omisiones | P | 8/8 | PASS |
| CB-06 | Las 7 omitidas de `test:app` son ajenas | N | 4 avisos "NO EJECUTADA" y 3 de `email-flows` (H-E1-23) | PASS |
| CB-06 | Una configuración ausente falla y no se omite | B | T-37; Q-C18-a/b | PASS |

**UI y recorrido manual.** No aplica: III.8 de la ruta declara que el corte M04a–M06.3a no tiene superficie visible. No se requiere guion manual.

## Pruebas exploratorias

### Sin base de datos

Corrieron en el worktree `../praxa-qa-M06.3a`, creado con `git worktree add --detach` desde `83bfdd3`. Se instaló con `npm ci --offline` (0 vulnerabilidades; aviso informativo de `allow-scripts`). Los archivos estaban en `tests/unit/__qa__/`.

Resultado final con `npx vitest run --project unit tests/unit/__qa__`, el mismo proyecto que `npm run test:unit`: **4 archivos y 34 pruebas ejecutadas, 27 pasadas y 7 fallidas.**

Las fallidas:

- **Hallazgos:** Q-C26-c, Q-C26-d, Q-C13-c, Q-C13-d, Q-C18-c y Q-T37-a.
- **Control negativo:** Q-T37-b. Descarta una corrección candidata; no es un hallazgo del sistema.

#### `qa-crypto.test.ts`: 7/7 PASS

```ts
import { randomBytes, createDecipheriv } from 'node:crypto';
import { inspect } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CredentialAadInput } from '@/modules/integrations/contract';

vi.mock('server-only', () => ({}));
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, createDecipheriv: vi.fn(actual.createDecipheriv) };
});
const aad: CredentialAadInput = { company_id: '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f', connection_id: '4f1a7c2e-1b2c-4d5e-8f90-0a1b2c3d4e5f', provider: 'meta' };
async function load() {
  const keyring = await import('@/modules/integrations/crypto/keyring');
  const seal = await import('@/modules/integrations/crypto/seal');
  return { ...keyring, ...seal };
}
function errorOf(fn: () => unknown): unknown { try { fn(); } catch (error) { return error; } throw new Error('debía fallar'); }
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('QA C-01 llavero: bordes de formato', () => {
  it('Q-C01-a acepta espacios alrededor del separador ":" (Diseño §2)', async () => {
    const { parseCredentialKeyring } = await load();
    const key = randomBytes(32).toString('base64');
    const ring = parseCredentialKeyring(` 7 :  ${key} `, ' 7 ');
    expect(ring.currentVersion).toBe(7);
    expect(ring.keyFor(7).toString('base64')).toBe(key);
  });
  it('Q-C01-b rechaza coma final, base64url, base64 no canónico, sin relleno y actual con cero a la izquierda', async () => {
    const { parseCredentialKeyring, CredentialKeyringError } = await load();
    const key = randomBytes(32).toString('base64');
    const urlSafe = Buffer.from(Array(32).fill(0xfb)).toString('base64url') + '=';
    const nonCanonical = key.slice(0, 42) + 'B=';
    const cases: Array<[string, string, string, number | null]> = [
      [`1:${key},`, '1', 'keyring_invalid', 2], [`1:${urlSafe}`, '1', 'keyring_invalid', 1],
      [`1:${key.slice(0, 43)}`, '1', 'keyring_invalid', 1], [`1:${nonCanonical}`, '1', 'keyring_invalid', 1],
      [`1:${key}`, '01', 'current_invalid', null], [`1:${key}`, '', 'current_invalid', null],
    ];
    for (const [keys, current, code, position] of cases) {
      const error = errorOf(() => parseCredentialKeyring(keys, current));
      expect(error).toBeInstanceOf(CredentialKeyringError);
      expect(error).toMatchObject({ code });
      if (position !== null) expect((error as Error).message).toContain(`Par ${position}`);
      expect((error as Error).message).not.toContain(key);
      expect(JSON.stringify(error)).not.toContain(key);
      expect(error).not.toHaveProperty('cause');
    }
  });
  it('Q-C01-c keyFor ausente: código unknown_key_version y mensaje fijo de la spec', async () => {
    const { parseCredentialKeyring, CredentialKeyVersionUnknownError } = await load();
    const ring = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');
    const error = errorOf(() => ring.keyFor(5));
    expect(error).toBeInstanceOf(CredentialKeyVersionUnknownError);
    expect(error).toMatchObject({ code: 'unknown_key_version', message: 'La versión de clave 5 no está en el llavero.' });
  });
  it('Q-C01-d getCredentialKeyring lee el entorno una vez y memoiza; ausente da keyring_missing', async () => {
    const first = randomBytes(32).toString('base64');
    const second = randomBytes(32).toString('base64');
    vi.stubEnv('PRAXA_CREDENTIAL_KEYS', `1:${first},2:${second}`);
    vi.stubEnv('PRAXA_CREDENTIAL_KEY_CURRENT', '1');
    const { getCredentialKeyring } = await load();
    const ring = getCredentialKeyring();
    expect(ring.currentVersion).toBe(1);
    vi.stubEnv('PRAXA_CREDENTIAL_KEY_CURRENT', '2');
    expect(getCredentialKeyring()).toBe(ring);
    expect(getCredentialKeyring().currentVersion).toBe(1);
    vi.resetModules();
    vi.stubEnv('PRAXA_CREDENTIAL_KEYS', undefined);
    const fresh = await load();
    expect(errorOf(() => fresh.getCredentialKeyring())).toMatchObject({ code: 'keyring_missing', message: 'Falta PRAXA_CREDENTIAL_KEYS.' });
  });
});

describe('QA C-02/C-03 sellado: forma del material antes de descifrar', () => {
  it('Q-C03-a IV, etiqueta, texto y versión inválidos dan CredentialMaterialError sin llamar al descifrador', async () => {
    const { parseCredentialKeyring, sealCredential, openCredential, CredentialMaterialError } = await load();
    const ring = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');
    const sealed = sealCredential('token-sintetico-qa', aad, ring);
    const variants = [
      { ...sealed, iv: randomBytes(11).toString('base64') }, { ...sealed, iv: randomBytes(16).toString('base64') },
      { ...sealed, auth_tag: randomBytes(15).toString('base64') }, { ...sealed, auth_tag: randomBytes(17).toString('base64') },
      { ...sealed, ciphertext: '' }, { ...sealed, ciphertext: 'no base64 !!' },
      { ...sealed, key_version: 0 }, { ...sealed, key_version: 1.5 }, { ...sealed, key_version: '1' as unknown as number },
    ];
    vi.mocked(createDecipheriv).mockClear();
    for (const variant of variants) {
      const error = errorOf(() => openCredential(variant, aad, ring));
      expect(error).toBeInstanceOf(CredentialMaterialError);
      expect(error).toMatchObject({ code: 'invalid_material' });
      expect(error).not.toHaveProperty('cause');
      expect(JSON.stringify(error)).not.toContain(sealed.ciphertext);
    }
    expect(createDecipheriv).not.toHaveBeenCalled();
  });
  it('Q-C02-a texto no cadena da invalid_plaintext; Unicode hace ida y vuelta', async () => {
    const { parseCredentialKeyring, sealCredential, openCredential, CredentialMaterialError } = await load();
    const ring = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');
    for (const bad of [undefined, null, 42]) {
      const error = errorOf(() => sealCredential(bad as unknown as string, aad, ring));
      expect(error).toBeInstanceOf(CredentialMaterialError);
      expect(error).toMatchObject({ code: 'invalid_plaintext' });
    }
    const text = 'ñandú-€-😀-sintético';
    expect(openCredential(sealCredential(text, aad, ring), aad, ring).reveal()).toBe(text);
  });
  it('Q-C03-b descifrado fallido: código decryption_failed, sin cause ni material; SecretValue no filtra en inspect anidado', async () => {
    const { parseCredentialKeyring, sealCredential, openCredential, CredentialDecryptionError } = await load();
    const ring = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');
    const other = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');
    const sealed = sealCredential('token-sintetico-qa', aad, ring);
    const error = errorOf(() => openCredential(sealed, aad, other));
    expect(error).toBeInstanceOf(CredentialDecryptionError);
    expect(error).toMatchObject({ code: 'decryption_failed' });
    expect(error).not.toHaveProperty('cause');
    for (const part of [sealed.ciphertext, sealed.iv, sealed.auth_tag]) {
      expect((error as Error).message).not.toContain(part);
      expect(JSON.stringify(error)).not.toContain(part);
    }
    const secret = openCredential(sealed, aad, ring);
    expect(inspect({ nested: { secret } }, { depth: 5 })).not.toContain('token-sintetico-qa');
    expect(Object.keys(secret)).toHaveLength(0);
    expect(JSON.stringify(Object.entries(secret))).not.toContain('token-sintetico-qa');
  });
});
```

#### `qa-worker-api.test.ts`: 8 casos, 6 PASS y 2 FAIL (Q-C26-c y Q-C26-d)

```ts
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Queryable } from '@/modules/integrations/db/worker-api';

vi.mock('server-only', () => ({}));
const pgState = vi.hoisted(() => ({ constructed: [] as Record<string, unknown>[] }));
vi.mock('pg', () => ({ default: { Pool: class {
  constructor(options: Record<string, unknown>) { pgState.constructed.push(options); }
  query() { return Promise.resolve({ rows: [] }); } on() {} end() { return Promise.resolve(); }
} } }));
const REF = 'q'.repeat(20);
const HOST = 'aws-0-us-west-2.pooler.supabase.com';
const good = `postgresql://praxa_integrations.${REF}:clave@${HOST}:6543/postgres`;
const ConnectionParameters = createRequire(import.meta.url)('pg/lib/connection-parameters') as new (options: Record<string, unknown>) => { user: string; host: string; port: number; password: string };
const MSG = {
  generic: 'La URL de conexión no es válida.',
  overrides: 'La URL de conexión contiene overrides de identidad o destino no permitidos.',
  tls: 'La URL de conexión contiene parámetros TLS no permitidos; TLS se configura en el módulo.',
  pooler: 'Se requiere el shared transaction pooler en el puerto 6543.',
};
async function load() { return import('@/modules/integrations/db/worker-api'); }
function errorOf(fn: () => unknown): unknown { try { fn(); } catch (error) { return error; } throw new Error('debía fallar'); }
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); pgState.constructed.length = 0; });

describe('QA C-26 guarda de URI y destino (Diseño §5, A-02/A-09)', () => {
  it('Q-C26-a formas inválidas fallan con config_invalid antes de construir Pool', async () => {
    const { createWorkerApi, WorkerApiError } = await load();
    const bad: Array<[string, string | null]> = [
      [`postgresql://praxa_integrations.${REF}@${HOST}:6543/postgres`, null],
      [`mysql://praxa_integrations.${REF}:clave@${HOST}:6543/postgres`, null],
      [`${good}#frag`, null], [good.replace(':clave@', ':cl%ZZave@'), null],
      [good.replace(HOST, '[::1]'), MSG.pooler], [good.replace(HOST, `${HOST}.`), MSG.pooler],
      [good.replace(HOST, `a.${HOST}`), MSG.pooler], [good.replace(HOST, '-aws.pooler.supabase.com'), MSG.pooler],
      [good.replace(`praxa_integrations.${REF}`, `PRAXA_INTEGRATIONS.${REF}`), MSG.pooler],
      [good.replace(`praxa_integrations.${REF}`, `praxa_integrations.${'q'.repeat(19)}`), MSG.pooler],
      [good.replace('/postgres', ''), null], [`${good}?SSLMODE=disable`, MSG.tls],
      [`${good}?sslmode=require&sslmode=disable`, MSG.tls], [`${good}?USER=postgres`, MSG.overrides],
    ];
    for (const [url, message] of bad) {
      const error = errorOf(() => createWorkerApi({ connectionString: url }));
      expect(error).toBeInstanceOf(WorkerApiError);
      expect(error).toMatchObject({ code: 'config_invalid', failureKind: 'other' });
      if (message) expect((error as Error).message).toBe(message); else expect(Object.values(MSG)).toContain((error as Error).message);
      expect(JSON.stringify(error)).not.toContain('clave');
      expect((error as Error).message).not.toContain(REF);
      expect(error).not.toHaveProperty('cause');
    }
    expect(pgState.constructed).toHaveLength(0);
  });
  it('Q-C26-b host en mayúsculas se acepta y PGUSER/PGHOST/PGPORT no alteran el destino efectivo', async () => {
    vi.stubEnv('PGUSER', 'postgres'); vi.stubEnv('PGHOST', 'evil.example.test'); vi.stubEnv('PGPORT', '5432'); vi.stubEnv('PGPASSWORD', 'otra');
    const { createWorkerApi } = await load();
    createWorkerApi({ connectionString: good.replace(HOST, HOST.toUpperCase()) });
    createWorkerApi({ connectionString: good });
    expect(pgState.constructed).toHaveLength(2);
    const effective = new ConnectionParameters(pgState.constructed[1]);
    expect([effective.user, effective.host, effective.port, effective.password]).toEqual([`praxa_integrations.${REF}`, HOST, 6543, 'clave']);
  });
  it('Q-C26-c identidad validada = identidad efectiva de pg', async () => {
    const { createWorkerApi } = await load();
    const encodedUser = `praxa%5Fintegrations.${REF}`;
    const variants = [
      `postgresql://${encodedUser}:cla ve@${HOST}:6543/postgres`,
      `postgresql://${encodedUser}:clave@${HOST}:6543/postgres%zz`,
      `postgresql://${encodedUser}:clave@${HOST}:6543/postgres?application_name=a%zz`,
    ];
    const observed: string[] = [];
    for (const url of variants) {
      let accepted = true;
      pgState.constructed.length = 0;
      try { createWorkerApi({ connectionString: url }); } catch { accepted = false; }
      observed.push(accepted ? new ConnectionParameters(pgState.constructed[0]).user : 'rechazada');
    }
    console.log('OBSERVED', JSON.stringify(observed.map((u) => u.replace(REF, '<ref>'))));
    for (const user of observed) expect(['rechazada', `praxa_integrations.${REF}`]).toContain(user);
  });
  it('Q-C26-d puerto no canónico 06543', async () => {
    const { createWorkerApi } = await load();
    expect(() => createWorkerApi({ connectionString: good.replace(':6543/', ':06543/') })).toThrow();
  });
});

describe('QA C-07/C-24 runtime getWorkerApi', () => {
  it('Q-C07-a URL runtime con TLS o con postgres.<ref> da config_invalid sin Pool; válida crea un único Pool', async () => {
    vi.stubEnv('PRAXA_INTEGRATIONS_DB_URL', `${good}?sslmode=disable`);
    let mod = await load();
    expect(errorOf(() => mod.getWorkerApi())).toMatchObject({ code: 'config_invalid', message: MSG.tls });
    vi.resetModules();
    vi.stubEnv('PRAXA_INTEGRATIONS_DB_URL', good.replace('praxa_integrations.', 'postgres.'));
    mod = await load();
    expect(errorOf(() => mod.getWorkerApi())).toMatchObject({ code: 'config_invalid' });
    expect(pgState.constructed).toHaveLength(0);
    vi.resetModules();
    vi.stubEnv('PRAXA_INTEGRATIONS_DB_URL', good);
    mod = await load();
    expect(mod.getWorkerApi()).toBe(mod.getWorkerApi());
    expect(pgState.constructed).toHaveLength(1);
  });
});

describe('QA C-07/C-08 llamadas y traducción', () => {
  function pool(impl: Queryable['query']) {
    return { query: vi.fn(impl), on: vi.fn(), end: vi.fn(async () => {}) } as unknown as Queryable & { query: ReturnType<typeof vi.fn> };
  }
  it('Q-C07-b nombres fuera de la unión cerrada se rechazan antes de consultar', async () => {
    const { createWorkerApi } = await load();
    const p = pool(async () => ({ rows: [] }));
    const client = createWorkerApi({ pool: p });
    for (const fn of ['toString', 'constructor', '__proto__', 'pg_sleep', 'get_credential; drop table x']) {
      await expect(client.call(fn as never, [])).rejects.toMatchObject({ code: 'invalid_argument' });
    }
    await expect(client.call('get_credential', 'abc' as never)).rejects.toMatchObject({ code: 'invalid_argument' });
    expect(p.query).not.toHaveBeenCalled();
  });
  it('Q-C08-a otros SQLSTATE de clase 08 son transporte y 28000 es unavailable/other', async () => {
    const { createWorkerApi } = await load();
    for (const [code, failureKind] of [['08001', 'transport'], ['08P01', 'transport'], ['08003', 'transport'], ['28000', 'other']] as const) {
      const client = createWorkerApi({ pool: pool(async () => { throw Object.assign(new Error('x'), { code }); }) });
      await expect(client.call('count_credentials_by_key_version', [])).rejects.toMatchObject({ code: 'unavailable', failureKind });
    }
  });
  it('Q-C08-b el manejador on(error) no registra el error original', async () => {
    const { createWorkerApi } = await load();
    const p = pool(async () => ({ rows: [] }));
    createWorkerApi({ pool: p });
    const listener = (p.on as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as (e: Error) => void;
    const spies = [vi.spyOn(console, 'error'), vi.spyOn(console, 'log'), vi.spyOn(console, 'warn')];
    expect(() => listener(Object.assign(new Error('host-sintetico clave'), { code: '57P01' }))).not.toThrow();
    for (const spy of spies) { for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain('clave'); spy.mockRestore(); }
  });
});
```

Salidas relevantes:

- Q-C26-c: `OBSERVED ["praxa%5Fintegrations.<ref>","praxa%5Fintegrations.<ref>","praxa%5Fintegrations.<ref>"]`. Las tres URLs se aceptan. La guarda validó `praxa_integrations.<ref>`, pero `pg` usaría `praxa%5Fintegrations.<ref>`.
- Q-C26-d: `expected [Function] to throw an error`. `06543` se acepta: la URL WHATWG normaliza el puerto a `6543`.
- Una sonda previa con etiquetas confirmó que los otros 14 casos de Q-C26-a se rechazan con el mensaje esperado.

#### `qa-repository.test.ts`: 7/7 PASS

```ts
import { randomBytes } from 'node:crypto';
import { inspect } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkerApi } from '@/modules/integrations/db/worker-api';

vi.mock('server-only', () => ({}));
vi.mock('pg', () => ({ default: { Pool: class { constructor() { throw new Error('sin red en QA'); } } } }));
const companyId = '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f';
const connectionId = '4f1a7c2e-1b2c-4d5e-8f90-0a1b2c3d4e5f';
const actorId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const attemptId = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e';
const ctx = Object.freeze({ user_id: actorId, company_id: companyId, role: 'owner' as const, request_id: '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f' });
const token = 'token-sintetico-qa-repo';
const input = { token, tokenType: 'system_user' as const, issuedForAppId: 'app_sintetica', grantedScopes: ['ads_read'], expiresAt: null };
async function load() {
  const keyring = await import('@/modules/integrations/crypto/keyring');
  const seal = await import('@/modules/integrations/crypto/seal');
  const repo = await import('@/modules/integrations/repository/credentials');
  return { ...keyring, ...seal, ...repo };
}
function api(handler: (fn: string, args: readonly unknown[]) => Promise<unknown[]>) {
  return { call: vi.fn(handler) } as unknown as WorkerApi & { call: ReturnType<typeof vi.fn> };
}
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('QA C-27 resolución perezosa de dependencias (Diseño §6)', () => {
  it('Q-C27-a entrada inválida da invalid_input aunque falten llavero y URL de runtime', async () => {
    vi.stubEnv('PRAXA_CREDENTIAL_KEYS', undefined); vi.stubEnv('PRAXA_CREDENTIAL_KEY_CURRENT', undefined); vi.stubEnv('PRAXA_INTEGRATIONS_DB_URL', undefined);
    const { readCredential, preparePendingConnectionWithCredential, canRetireKeyVersion } = await load();
    await expect(readCredential(ctx, 'no-uuid')).rejects.toMatchObject({ code: 'invalid_input' });
    expect(() => preparePendingConnectionWithCredential(ctx, { ...input, clientBusinessId: '' })).toThrow(expect.objectContaining({ code: 'invalid_input' }));
    await expect(canRetireKeyVersion(0)).rejects.toMatchObject({ code: 'invalid_input' });
  });
  it('Q-C27-b ejecutar una operación preparada y contar no exigen llavero en el entorno', async () => {
    vi.stubEnv('PRAXA_CREDENTIAL_KEYS', undefined); vi.stubEnv('PRAXA_CREDENTIAL_KEY_CURRENT', undefined);
    const { parseCredentialKeyring, prepareReplaceCredential, executePreparedCredentialOperation, countCredentialsByKeyVersion } = await load();
    const ring = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');
    const op = prepareReplaceCredential(ctx, { ...input, connectionId, attemptId }, { keyring: ring });
    const workerApi = api(async (fn, args) => fn === 'replace_credential'
      ? [{ connection_id: args[2], status: 'active', credential_generation: 4 }]
      : [{ key_version: 1, credential_count: '3' }]);
    await expect(executePreparedCredentialOperation(ctx, op, { workerApi })).resolves.toEqual({ connectionId, status: 'active', credentialGeneration: 4 });
    await expect(countCredentialsByKeyVersion({ workerApi })).resolves.toEqual([{ keyVersion: 1, credentialCount: 3 }]);
  });
});

describe('QA C-09/C-21 contratos de retorno y redacción', () => {
  it('Q-C21-a operación preparada: inspect y JSON no contienen el token; congelada', async () => {
    const { parseCredentialKeyring, preparePendingConnectionWithCredential } = await load();
    const ring = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');
    const op = preparePendingConnectionWithCredential(ctx, { ...input, clientBusinessId: 'business_sintetico' }, { keyring: ring });
    expect(inspect(op, { depth: 10, showHidden: true })).not.toContain(token);
    expect(JSON.stringify(op)).not.toContain(token);
    expect(Object.isFrozen(op)).toBe(true);
    expect(Reflect.ownKeys(op).map(String).join(',')).not.toContain(token);
  });
  it('Q-C09-a conveniencia create: retorno exacto con pendingExpiresAt ISO; args usan solo ctx y AAD de la conexión nueva', async () => {
    const { parseCredentialKeyring, createPendingConnectionWithCredential, openCredential } = await load();
    const ring = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');
    const expires = new Date('2030-01-02T03:04:05.000Z');
    const workerApi = api(async (_fn, args) => [{ connection_id: args[2], status: 'pending_selection', pending_expires_at: expires, credential_generation: 1 }]);
    const created = await createPendingConnectionWithCredential(ctx, { ...input, clientBusinessId: 'business_sintetico', expiresAt: '2031-05-06T07:08:09.000Z' }, { workerApi, keyring: ring });
    expect(created).toEqual({ connectionId: created.connectionId, status: 'pending_selection', pendingExpiresAt: expires.toISOString(), credentialGeneration: 1 });
    const args = workerApi.call.mock.calls[0][1] as unknown[];
    expect(args).toHaveLength(12);
    expect(args.slice(0, 4)).toEqual([actorId, companyId, created.connectionId, 'business_sintetico']);
    expect(args).not.toContain(token);
    expect(openCredential({ ciphertext: args[4] as string, iv: args[5] as string, auth_tag: args[6] as string, key_version: args[7] as number },
      { company_id: companyId, connection_id: created.connectionId, provider: 'meta' }, ring).reveal()).toBe(token);
  });
  it('Q-C27-c get_credential: expires_at Date pasa a ISO; generación 0 y 2147483647 válidas; resultado serializado no contiene el token', async () => {
    const { parseCredentialKeyring, sealCredential, readCredential } = await load();
    const ring = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');
    const aad = { company_id: companyId, connection_id: connectionId, provider: 'meta' as const };
    for (const generation of [0, 2_147_483_647]) {
      const row = { connection_id: connectionId, company_id: companyId, provider: 'meta', status: 'active', credential_generation: generation,
        ...sealCredential(token, aad, ring), token_type: 'system_user', issued_for_app_id: 'app_sintetica',
        granted_scopes: ['ads_read'], expires_at: new Date('2032-03-04T05:06:07.000Z') };
      const result = await readCredential(ctx, connectionId, { workerApi: api(async () => [row]), keyring: ring });
      expect(result.credentialGeneration).toBe(generation);
      expect(result.expiresAt).toBe('2032-03-04T05:06:07.000Z');
      expect(JSON.stringify(result)).not.toContain(token);
      expect(inspect(result, { depth: 10 })).not.toContain(token);
    }
  });
  it('Q-C05-a canRetireKeyVersion: true si la versión no figura aunque otras tengan conteo', async () => {
    const { canRetireKeyVersion } = await load();
    const workerApi = api(async () => [{ key_version: 2, credential_count: '5' }, { key_version: 3, credential_count: '1' }]);
    expect(await canRetireKeyVersion(1, { workerApi })).toBe(true);
    expect(await canRetireKeyVersion(2, { workerApi })).toBe(false);
  });
  it('Q-C06-a PX006 en needs_reauth no entrega token ni material en el error; rewrap usa generación y versión leídas', async () => {
    const { parseCredentialKeyring, sealCredential, readCredential, CredentialChangedError } = await load();
    const keys = `1:${randomBytes(32).toString('base64')},2:${randomBytes(32).toString('base64')}`;
    const old = parseCredentialKeyring(keys, '1');
    const ring = parseCredentialKeyring(keys, '2');
    const { WorkerApiError } = await import('@/modules/integrations/db/worker-api');
    const sealed = sealCredential(token, { company_id: companyId, connection_id: connectionId, provider: 'meta' }, old);
    const row = { connection_id: connectionId, company_id: companyId, provider: 'meta', status: 'needs_reauth', credential_generation: 7,
      ...sealed, token_type: 'system_user', issued_for_app_id: 'app_sintetica', granted_scopes: ['ads_read'], expires_at: null };
    const workerApi = api(async (fn) => { if (fn === 'get_credential') return [row]; throw new WorkerApiError('generation_mismatch'); });
    let error: unknown;
    try { await readCredential(ctx, connectionId, { workerApi, keyring: ring }); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(CredentialChangedError);
    expect(error).toMatchObject({ code: 'credential_changed', message: 'La credencial cambió; volvé a empezar.' });
    expect(JSON.stringify(error)).not.toContain(token);
    expect(JSON.stringify(error)).not.toContain(sealed.ciphertext);
    expect(error).not.toHaveProperty('cause');
    expect((workerApi.call.mock.calls[1][1] as unknown[]).slice(3, 5)).toEqual([7, 1]);
  });
});
```

#### `qa-target.test.ts`: 12 casos, 7 PASS y 5 FAIL

Fallaron Q-C13-c, Q-C13-d, Q-C18-c y Q-T37-a, que son hallazgos, y Q-T37-b, que es un control negativo.

```ts
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISPOSABLE_ACK, resolveIntegrationsTestTarget } from '../../../scripts/lib/sql-target.mjs';

const APP_REF = 'a'.repeat(20);
const TEST_REF = 'b'.repeat(20);
const OTHER_REF = 'c'.repeat(20);
const pooler = (ref: string) => `postgresql://postgres.${ref}:secreta@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;
const role = (ref: string) => `postgresql://praxa_integrations.${ref}:secreta@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
function env(overrides: Record<string, string | undefined> = {}) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: `https://${APP_REF}.supabase.co`, SUPABASE_DB_URL: pooler(APP_REF),
    SUPABASE_TEST_URL: `https://${TEST_REF}.supabase.co`, SUPABASE_TEST_DB_URL: pooler(TEST_REF),
    SUPABASE_TEST_IS_DISPOSABLE: DISPOSABLE_ACK, PRAXA_INTEGRATIONS_TEST_DB_URL: role(TEST_REF), ...overrides,
  };
}

describe('QA C-13 resolvedor del rol: bordes de las siete reglas', () => {
  it('Q-C13-a regla 3: usuario con ref de 19, en mayúsculas o con sufijo se rechaza', () => {
    for (const url of [
      role(TEST_REF).replace(`praxa_integrations.${TEST_REF}`, `praxa_integrations.${TEST_REF.slice(1)}`),
      role(TEST_REF).replace('praxa_integrations.', 'PRAXA_INTEGRATIONS.'),
      role(TEST_REF).replace('praxa_integrations.', 'praxa_integrations_x.'),
    ]) expect(resolveIntegrationsTestTarget(env({ PRAXA_INTEGRATIONS_TEST_DB_URL: url })).ok).toBe(false);
  });
  it('Q-C13-b regla 5 sin SUPABASE_DB_URL: ref igual a NEXT_PUBLIC_SUPABASE_URL se rechaza', () => {
    expect(resolveIntegrationsTestTarget(env({ SUPABASE_DB_URL: undefined, NEXT_PUBLIC_SUPABASE_URL: `https://${TEST_REF}.supabase.co`, SUPABASE_TEST_URL: undefined })).ok).toBe(false);
  });
  it('Q-C13-c regla 5 con SUPABASE_DB_URL no deducible: ref igual a NEXT_PUBLIC_SUPABASE_URL', () => {
    expect(resolveIntegrationsTestTarget(env({
      SUPABASE_DB_URL: 'postgresql://postgres:secreta@db.example.test:5432/postgres',
      NEXT_PUBLIC_SUPABASE_URL: `https://${TEST_REF}.supabase.co`, SUPABASE_TEST_URL: undefined,
    })).ok).toBe(false);
  });
  it('Q-C13-d regla 7: puerto 06543 no canónico', () => {
    expect(resolveIntegrationsTestTarget(env({ PRAXA_INTEGRATIONS_TEST_DB_URL: role(TEST_REF).replace(':6543/', ':06543/') })).ok).toBe(false);
  });
  it('Q-C13-e los problemas nunca contienen contraseñas ni la URL', () => {
    const result = resolveIntegrationsTestTarget(env({ PRAXA_INTEGRATIONS_TEST_DB_URL: role(OTHER_REF).replace(':6543/', ':5432/') + '?sslmode=disable' }));
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('secreta');
    expect(JSON.stringify(result)).not.toContain('pooler.supabase.com');
  });
});

describe('QA C-13 db:check:test como comando (entorno sintético, sin .env.local)', () => {
  const root = resolve(process.cwd());
  function run(extra: Record<string, string | undefined>) {
    const cwd = mkdtempSync(join(tmpdir(), 'praxa-qa-check-'));
    try {
      const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(PRAXA|SUPABASE|NEXT_PUBLIC_SUPABASE|PG)/i.test(k)));
      const full = { ...base, ...env(), ...extra } as NodeJS.ProcessEnv;
      for (const [k, v] of Object.entries(extra)) if (v === undefined) delete full[k];
      const out = spawnSync(process.execPath, [join(root, 'scripts/check-target.mjs'), 'test'], { cwd, env: full, encoding: 'utf8' });
      return { code: out.status, text: out.stdout + out.stderr };
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }
  it('Q-C13-f válido exit 0; definido e inválido exit 1 e INVÁLIDA; ausente FALTA y exit 0; sin contraseñas', () => {
    const ok = run({}); expect(ok.code).toBe(0); expect(ok.text).toContain('Destino verificado.');
    const bad = run({ PRAXA_INTEGRATIONS_TEST_DB_URL: pooler(TEST_REF).replace(':5432/', ':6543/') });
    expect(bad.code).toBe(1); expect(bad.text).toContain('INVÁLIDA');
    const other = run({ PRAXA_INTEGRATIONS_TEST_DB_URL: role(OTHER_REF) }); expect(other.code).toBe(1);
    const missing = run({ PRAXA_INTEGRATIONS_TEST_DB_URL: undefined }); expect(missing.code).toBe(0);
    expect(missing.text).toMatch(/PRAXA_INTEGRATIONS_TEST_DB_URL: \(sin definir\) \| FALTA/);
    for (const r of [ok, bad, other, missing]) { expect(r.text).not.toContain('secreta'); expect(r.text).not.toContain('pooler.supabase.com'); }
  });
  it('Q-C13-g db:check:test sí rechaza el escenario de Q-C13-c', () => {
    const r = run({ SUPABASE_DB_URL: 'postgresql://postgres:secreta@db.example.test:5432/postgres',
      NEXT_PUBLIC_SUPABASE_URL: `https://${TEST_REF}.supabase.co`, SUPABASE_TEST_URL: `https://${OTHER_REF}.supabase.co` });
    expect(r.code).toBe(1);
  });
});

describe('QA C-18 la suite real ante configuraciones inválidas (arnés aislado, patrón de T-37)', () => {
  const root = resolve(process.cwd());
  const suitePath = join(root, 'tests/app/integrations-worker-api-client.test.ts');
  async function harness(roleUrl: string, extraEnv: Record<string, string> = {}, healthOk = false, mockId = 'pg', aliasPg = false) {
    const temporary = mkdtempSync(join(tmpdir(), 'praxa-qa-invalid-'));
    const configPath = join(temporary, 'vitest.config.mts');
    const setupPath = join(temporary, 'setup.mts');
    const stubPath = join(temporary, 'pg-stub.mjs').replaceAll('\\', '/');
    try {
      writeFileSync(stubPath, `const c = (globalThis.__qaPg ??= { pool: 0, client: 0 });
class Pool { constructor() { c.pool++; throw new Error('red bloqueada'); } on() {} }
class Client { constructor() { c.client++; throw new Error('red bloqueada'); } }
export default { Pool, Client };
`, 'utf8');
      const pgAlias = aliasPg ? `, pg: ${JSON.stringify(stubPath)}` : '';
      writeFileSync(configPath, `export default {
        root: ${JSON.stringify(root)}, envDir: false,
        resolve: { alias: { '@': ${JSON.stringify(join(root, 'src'))}, vitest: ${JSON.stringify(join(root, 'node_modules/vitest/dist/index.js'))} } },
        test: { projects: [{
          resolve: { alias: { '@': ${JSON.stringify(join(root, 'src'))}, vitest: ${JSON.stringify(join(root, 'node_modules/vitest/dist/index.js'))}${pgAlias} } },
          test: { name: 'app', include: [${JSON.stringify(suitePath.replaceAll('\\', '/'))}], environment: 'node', setupFiles: [${JSON.stringify(setupPath)}], fileParallelism: false }
        }] }
      };`, 'utf8');
      writeFileSync(setupPath, `import { vi, afterAll } from 'vitest';
        const counters = { pool: 0, client: 0, fetch: 0 };
        vi.mock(${JSON.stringify(mockId)}, () => ({ default: {
          Pool: class { constructor() { counters.pool++; throw new Error('red bloqueada'); } on() {} },
          Client: class { constructor() { counters.client++; throw new Error('red bloqueada'); } }
        } }));
        globalThis.fetch = async () => { counters.fetch++; if (${healthOk}) return new Response('{}', { status: 200 }); throw new Error('red bloqueada'); };
        afterAll(() => console.log('QA_STATE ' + JSON.stringify({ ...counters, ...(globalThis.__qaPg ? { stubPool: globalThis.__qaPg.pool } : {}) })));
      `, 'utf8');
      const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(PRAXA|SUPABASE|NEXT_PUBLIC_SUPABASE|PG)/i.test(k)));
      const childEnv = { ...base, ...env({ PRAXA_INTEGRATIONS_TEST_DB_URL: roleUrl }), SUPABASE_TEST_PUBLISHABLE_KEY: 'sintetica', ...extraEnv } as NodeJS.ProcessEnv;
      return await new Promise<{ code: number | null; report: string }>((done, reject) => {
        const child = spawn(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', configPath, '--project', 'app', suitePath], { cwd: root, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
        let report = '';
        const timer = setTimeout(() => child.kill(), 110_000);
        child.stdout.on('data', (c: Buffer) => { report += c.toString(); });
        child.stderr.on('data', (c: Buffer) => { report += c.toString(); });
        child.on('error', reject);
        child.on('close', (code) => { clearTimeout(timer); done({ code, report }); });
      });
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  }
  const unresolvable = role(TEST_REF).replace('aws-0-us-east-1.pooler.supabase.com', 'qa-nonexistent-m063a.pooler.supabase.com');

  it('Q-C18-a usuario postgres.<ref> y Q-C18-b otro proyecto: suite fallida por el resolvedor, cero Pool/Client/fetch', async () => {
    for (const [url, reason] of [
      [pooler(TEST_REF).replace(':5432/', ':6543/'), 'La URL del rol debe usar praxa_integrations.<ref>.'],
      [role(OTHER_REF), 'La URL del rol apunta a un proyecto distinto del proyecto de pruebas.'],
    ] as const) {
      const { code, report } = await harness(url);
      expect(code).not.toBe(0);
      expect(report).toMatch(/Test Files\s+1 failed/);
      expect(report).not.toMatch(/Test Files\s+1 skipped/);
      expect(report).toContain(reason);
      expect(report).toContain('QA_STATE {"pool":0,"client":0,"fetch":0}');
      expect(report).not.toContain('secreta');
    }
  }, 240_000);
  it('Q-C18-c escenario de Q-C13-c: el beforeAll de la suite real debe rechazar', async () => {
    const { report } = await harness(unresolvable, {
      SUPABASE_DB_URL: 'postgresql://postgres:secreta@db.example.test:5432/postgres',
      NEXT_PUBLIC_SUPABASE_URL: `https://${TEST_REF}.supabase.co`,
      SUPABASE_TEST_URL: `https://${OTHER_REF}.supabase.co`, SUPABASE_TEST_SECRET_KEY: 'sintetica',
    }, true);
    expect(/× T-31 /.test(report)).toBe(false);
  }, 240_000);
  it('Q-T37-a el mock de pg del setup temporal (patrón de T-37) intercepta el pg de la suite', async () => {
    const { report } = await harness(unresolvable, { SUPABASE_TEST_SECRET_KEY: 'sintetica' }, true);
    const state = JSON.parse(report.match(/QA_STATE (\{.*\})/)?.[1] ?? '{}');
    expect(/ENOTFOUND|getaddrinfo/.test(report)).toBe(false);
    expect(state.pool).toBeGreaterThan(0);
  }, 240_000);
  it('Q-T37-b control: mock con la ruta absoluta de pg', async () => {
    const { createRequire } = await import('node:module');
    const absolute = createRequire(join(root, 'package.json')).resolve('pg').replaceAll('\\', '/');
    const { report } = await harness(unresolvable, { SUPABASE_TEST_SECRET_KEY: 'sintetica' }, true, absolute);
    const state = JSON.parse(report.match(/QA_STATE (\{.*\})/)?.[1] ?? '{}');
    expect(state.pool).toBe(1);
    expect(/× T-31 /.test(report)).toBe(false);
  }, 240_000);
  it('Q-T37-c control: alias de pg a un stub en la config temporal', async () => {
    const { report } = await harness(unresolvable, { SUPABASE_TEST_SECRET_KEY: 'sintetica' }, true, 'pg', true);
    const state = JSON.parse(report.match(/QA_STATE (\{.*\})/)?.[1] ?? '{}');
    expect(state.pool + (state.stubPool ?? 0)).toBe(1);
    expect(/× T-31 /.test(report)).toBe(false);
  }, 240_000);
});
```

Salidas relevantes:

- **Q-C13-c y Q-C13-d:** `expected true to be false`. El resolvedor devuelve `ok: true` en los dos casos.
- **Q-C13-g:** `db:check:test` sale con exit 1 en el escenario de Q-C13-c. El comando sí lo detiene, porque `resolveTarget('test')` hace su propia comparación.
- **Q-C18-c:** el resultado fue `beforeAll-paso: la suite intento conectar`, con T-31–T-43 ejecutados y fallidos por timeout o por fixtures. Pasaron el resolvedor y `blockedReason()`, y la suite intentó conectar con el rol al proyecto que `NEXT_PUBLIC_SUPABASE_URL` identifica como app. `npm run test:app` no corre `db:check:test` antes.
- **Q-T37-a:** el resultado fue `QA_STATE {"pool":0,"client":0,"fetch":14}`. T-31 y T-32 vencieron a los 5000 ms intentando conectar, es decir que `beforeAll` construyó un Pool de `pg` **real**, y aun así el contador del mock quedó en 0. El host no resuelve: solo hubo consulta DNS.
- **Q-T37-b:** dio el mismo resultado: `{"pool":0,…}` y T-31 ejecutado. Descarta la ruta absoluta como corrección.
- **Q-T37-c:** dio `{"pool":1,"client":0,"fetch":1}`, con `beforeAll` fallido por `red bloqueada`. El alias en `resolve.alias` sí intercepta y no sale a la red.

### Con base de datos

`npm run db:check:test`: exit 0, "Destino verificado.", proyecto desechable y URL del rol con la misma referencia. Las referencias se enmascararon en la captura.

La prueba se creó en `tests/app/__qa__/qa-worker-api-db.test.ts`, en el directorio del usuario. Se ejecutó con `npx vitest run --project app tests/app/__qa__/qa-worker-api-db.test.ts`: **1 archivo y 2 pruebas ejecutadas, 2/2 PASS**, con exit 0.

```ts
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TenantContext } from '@/modules/tenant/context';
import { resolveIntegrationsTestTarget } from '../../../scripts/lib/sql-target.mjs';
import { blockedReason, cleanupRun, createConfirmedUser, pendingCleanupCount, RUN_ID } from '../helpers';

vi.mock('server-only', () => ({}));
const b64 = (n: number) => randomBytes(n).toString('base64');

describe('QA M06.3a con base: firmas reales de worker_api y aislamiento por empresa', () => {
  let worker: typeof import('@/modules/integrations/db/worker-api');
  let repo: typeof import('@/modules/integrations/repository/credentials');
  let keyringApi: typeof import('@/modules/integrations/crypto/keyring');
  let client: ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi>;
  beforeAll(async () => {
    const target = resolveIntegrationsTestTarget(process.env);
    if (!target.ok) throw new Error(target.problems.join(' '));
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);
    worker = await vi.importActual('@/modules/integrations/db/worker-api');
    repo = await vi.importActual('@/modules/integrations/repository/credentials');
    keyringApi = await vi.importActual('@/modules/integrations/crypto/keyring');
    client = worker.createWorkerApi({ connectionString: target.connectionString });
  });
  afterAll(async () => { try { await client?.end(); } finally { await cleanupRun(); expect(pendingCleanupCount()).toBe(0); } });

  it('Q-C07-c las 12 funciones del mapa resuelven contra 0012 con el rol (nunca privilege_missing ni unexpected)', async () => {
    const u = () => randomUUID();
    const future = new Date(Date.now() + 600_000).toISOString();
    const calls: Array<[Parameters<typeof client.call>[0], unknown[]]> = [
      ['create_oauth_attempt', [u(), u(), 'qa', 'qa', 'qa', 'qa', future, u()]],
      ['consume_oauth_attempt', [u(), u(), 'qa', 'qa']],
      ['create_pending_connection', [u(), u(), u(), 'business_qa', b64(24), b64(12), b64(16), 1, 'system_user', 'app_qa', ['ads_read'], null]],
      ['get_credential', [u(), u(), u()]],
      ['confirm_connection', [u(), u(), u(), 'qa', 'qa', 'qa', true]],
      ['replace_credential', [u(), u(), u(), u(), b64(24), b64(12), b64(16), 1, 'system_user', 'app_qa', ['ads_read'], null]],
      ['mark_needs_reauth', [u(), u(), u(), 1, 'qa', 'qa']],
      ['begin_disconnect', [u(), u(), u()]],
      ['purge_connection', [u(), u(), u()]],
      ['list_pending_purges', [u(), u()]],
      ['count_credentials_by_key_version', []],
      ['rewrap_credential', [u(), u(), u(), 1, 1, b64(24), b64(12), b64(16), 2]],
    ];
    const outcome: Record<string, string> = {};
    for (const [fn, args] of calls) {
      try { await client.call(fn, args); outcome[fn] = 'ok'; }
      catch (error) { outcome[fn] = (error as { code?: string }).code ?? 'sin-code'; }
    }
    console.log('QA_SIGNATURES', JSON.stringify(outcome));
    for (const code of Object.values(outcome)) expect(['privilege_missing', 'unexpected', 'sin-code']).not.toContain(code);
  });

  async function company(prefix: string): Promise<TenantContext> {
    const user = await createConfirmedUser(prefix);
    const { data, error } = await user.client.rpc('create_company_for_current_user', { p_name: `Empresa QA ${RUN_ID} ${prefix}` }).single<{ id: string }>();
    if (error || !data) throw new Error('No se pudo crear la empresa sintética.');
    return { user_id: user.id, company_id: data.id, role: 'owner', request_id: randomUUID() };
  }

  it('Q-C09-b otra empresa no obtiene la credencial por el repositorio; actor de A con empresa B no está autorizado', async () => {
    const a = await company('qa-a');
    const b = await company('qa-b');
    const version = randomInt(1_000_000, 2_000_000_000);
    const ring = keyringApi.parseCredentialKeyring(`${version}:${b64(32)}`, String(version));
    const token = 'token-sintetico-qa-aislamiento';
    const created = await repo.executePreparedCredentialOperation(a, repo.preparePendingConnectionWithCredential(a, {
      token, tokenType: 'system_user', issuedForAppId: 'app_sintetica', grantedScopes: ['ads_read'], expiresAt: null, clientBusinessId: 'business_sintetico',
    }, { keyring: ring }), { workerApi: client });
    const outcomes: string[] = [];
    for (const ctx of [b, { ...b, user_id: a.user_id }, { ...a, company_id: b.company_id }]) {
      try {
        const read = await repo.readCredential(ctx, created.connectionId, { workerApi: client, keyring: ring });
        outcomes.push(read.token.reveal() === token ? 'TOKEN-ENTREGADO' : 'otro');
      } catch (error) {
        outcomes.push(`${(error as Error).name}:${(error as { code?: string }).code}`);
        expect(JSON.stringify(error)).not.toContain(token);
      }
    }
    console.log('QA_ISOLATION', JSON.stringify(outcomes));
    expect(outcomes).not.toContain('TOKEN-ENTREGADO');
    const own = await repo.readCredential(a, created.connectionId, { workerApi: client, keyring: ring });
    expect(own.token.reveal()).toBe(token);
    await client.call('begin_disconnect', [a.user_id, a.company_id, created.connectionId]);
  });
});
```

Salidas:

- `QA_SIGNATURES`: `not_authorized` en las 11 funciones con actor sintético, y `count_credentials_by_key_version: ok`. Ninguna dio `privilege_missing` ni `unexpected`.
- `QA_ISOLATION`: `["WorkerApiError:not_authorized","WorkerApiError:not_authorized","WorkerApiError:not_authorized"]`. La empresa A lee su propia credencial. La limpieza dejó `pendingCleanupCount() = 0`.

### Borrado

- Los cuatro archivos de `tests/unit/__qa__/` del worktree se borraron. `git status --porcelain --untracked-files=all` del worktree quedó vacío.
- `tests/app/__qa__/qa-worker-api-db.test.ts` y su carpeta se borraron del directorio del usuario.
- El worktree se eliminó con `git worktree remove ../praxa-qa-M06.3a`, sin `--force`. `git worktree list` muestra solo el directorio principal.
- Los temporales de los arneses, en el `tmpdir` del sistema, se borran en cada `finally`.

### Incidencias

Una primera versión de Q-C18-c usó el host del pooler compartido real, `aws-0-us-east-1.pooler.supabase.com`, con el usuario sintético `praxa_integrations.bbbb…` (20 `b`) y la contraseña sintética `secreta`. El arnés confiaba en el mock de `pg`, que resultó inefectivo (Q-01), y la suite abrió conexiones reales a ese host público. Supavisor respondió que el tenant no existe. No se usó ningún proyecto, credencial ni dato del usuario.

A partir de ahí todos los casos usan `qa-nonexistent-m063a.pooler.supabase.com`, cuyo DNS da `ENOTFOUND`, confirmado antes de usarlo. El código copiado arriba es el de esa versión.

## Verificación ejecutada

Todos los comandos se corrieron con `powershell -NoProfile -Command` (H-E1-20), salvo donde se indica `npx`.

| Comando | Dónde | Resultado |
|---|---|---|
| `npm ci --offline` | Worktree en `83bfdd3` | Exit 0; 0 vulnerabilidades |
| `npm run verify`, primer intento | Worktree con las pruebas QA todavía presentes | Exit 1: `typecheck` falló con TS2352 en `qa-target.test.ts`, en una prueba exploratoria, no en el código revisado. No cuenta. |
| `npm run verify` | Worktree en `83bfdd3`, limpio | **Exit 0**: lint, typegen, typecheck, 10 archivos y 193/193 de unit/component, build Next completo |
| `npm run test:unit` | Worktree en `83bfdd3` | Exit 0: 9 archivos y 184/184 |
| `npx vitest run --project unit tests/unit/no-secrets-in-tree.test.ts` | Worktree con los archivos QA | 5/5: los archivos QA no disparan el scanner |
| `npm run db:check:test` | Directorio del usuario | Exit 0, "Destino verificado." |
| `npm run test:app` | Directorio del usuario (ver la limitación) | **Exit 0**: 6 archivos, 37 pasadas y 7 omitidas. Las omitidas son 4 avisos "NO EJECUTADA" (concurrency, onboarding, integrations-data-api, isolation) y 3 de `email-flows` (opt-in, H-E1-23) |
| `npx vitest run --project app tests/app/integrations-worker-api-client.test.ts --reporter=verbose` | Directorio del usuario | Exit 0: 8/8 (T-31–T-36, T-41, T-43), sin omisiones |
| T-24: búsqueda de `SUPABASE_TEST_ALLOW_APP_PROJECT` en `scripts tests src .github docs/SECURITY.md .env.example README.md` | Worktree | 3 coincidencias, todas en T-23 (`sql-test-target.test.ts:161,166,170`) |
| T-28: `node -e …` | Worktree | `true false true` |
| `npm ci --dry-run --offline` | Worktree | Exit 0 |
| T-39: `git diff --name-only 80e5bf3 HEAD -- supabase/` y `git ls-files -o --exclude-standard -- supabase/` | Worktree | Sin salida |
| `git diff --check 80e5bf3 HEAD` | Worktree | Exit 0 |
| Primera línea de los cuatro módulos | Worktree | `import 'server-only';` en los cuatro |

**Limitación de `test:app`.** `db:check:test` y `test:app` solo se pueden correr en el directorio del usuario, porque necesitan su configuración local. Cuando se corrieron, ese directorio tenía cambios externos sin commit en `scripts/lib/sql-target.mjs` y `tests/unit/sql-test-target.test.ts`, que después pasaron a `fecae40`. `src/` y `tests/app/integrations-worker-api-client.test.ts` eran idénticos a `83bfdd3`. El cambio solo endurece el resolvedor del `beforeAll`.

`test:policies` no corresponde: la spec lo excluye y T-39 confirma que no hay cambios de SQL. La CI Linux no se ejecutó.

## Requisitos separados por etapa

| Etapa | Requisito | Origen | Estado |
|---|---|---|---|
| PR | CA-21, CA-23–CA-27 y CA-11b en sus casos especificados | Ficha | Cumplidos en las suites permanentes |
| PR | C-01–C-27 sin casos fallidos | Spec, criterios operativos | **No cumplido**: C-13 (Q-03 y Q-04), C-18/T-37 (Q-01) y C-26 (Q-02 y Q-04) |
| PR | Pruebas de la ficha: ciclo, clave incorrecta, texto alterado, AAD, versión ausente, rotación y credencial fuera del módulo | Ficha | Cumplidas: T-03, T-06–T-11, T-12–T-16, T-35 y T-21 |
| PR | Evidencia de cierre: pruebas en verde | Ficha | En verde en las permanentes, pero **T-37 no verifica su aserción de contadores** (Q-01) |
| PR | Evidencia de cierre: diff de la documentación | Ficha | Cumplida (T-29) |
| PR | III.3: `verify`, `db:check:test` y `test:app` con la suite del rol obligatoria | Ruta | En verde en este QA. Hay que repetirlas sobre el HEAD corregido. |
| PR | `/implementation-review` APROBABLE sobre el HEAD final y QA sin fallos | Pipeline | **Pendiente**: HEAD es `fecae40`, distinto del revisado |
| Merge | Revisión de Codex sin bloqueantes | Skill | Pendiente |
| Merge | CI (`npm ci` y `npm run verify` en `ubuntu-latest`) en verde | `.github/workflows/verify.yml` | Pendiente; además confirma la portabilidad de T-25 |
| Gate | Aprobación visible de `G-CRYPTO` por el usuario | Ficha: condición para avanzar | Pendiente |
| Gate | Registrar la aprobación con fecha en `PROJECT_STATE.md` y habilitar M28.2a, sin iniciarla | Plan, paso 15 | Pendiente |
| Gate | `db:push` al proyecto `app`, Vercel y `PRAXA_INTEGRATIONS_DB_URL` real | Plan, paso 16 | **No aplican a M06.3a**: son de M28.2a. No hay migración. |

**Consistencia documental.**

- En `83bfdd3`, `PROJECT_STATE.md` y la sesión decían `VERIFICADO — PENDIENTE DE APROBACIÓN`, coherente con ese commit antes de este QA.
- En `fecae40` dicen `PENDIENTE DE NUEVA REVISIÓN Y QA`, coherente con la necesidad de volver a revisar.
- `PROJECT_STATE.md` contiene solo estado, más IDs de hallazgos enlazados, lo que respeta el contrato documental. La frase "tras la corrección de Q-02" es una referencia mínima, no un detalle.
- Después de las correcciones de este informe, la sesión y `PROJECT_STATE.md` tendrán que volver a reflejar el estado.

## Hallazgos

Los IDs son locales de este informe. Q-03 equivale a Q-02 de `qa-review-2` y a H-E1-43.

| ID | Severidad | Criterio | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| Q-01 | media | C-18, CB-06, T-37 (Diseño §12) | El arnés de T-37 registra `vi.mock('pg')` en un setup temporal que no intercepta el `pg` de la suite real. Por eso la aserción `"pool":0,"client":0,"connect":0` vale 0 siempre, no prueba nada, y el arnés no garantiza "cada intento falla inmediatamente sin red". El negativo de T-37 sigue siendo correcto, porque el resolvedor falla primero, pero una regresión que conectara antes de validar no la detectarían los contadores. | Q-T37-a: con configuración sintética válida y host que no resuelve, `beforeAll` construyó un Pool de `pg` real (T-31 venció intentando conectar) y el contador quedó en 0. La primera versión de Q-C18-c abrió conexiones reales al pooler público. Q-T37-b muestra que la ruta absoluta no lo corrige. Q-T37-c muestra que un alias de `pg` a un stub en `resolve.alias` de la config temporal sí intercepta: `pool: 1` y sin red. La causa probable es el alias de `vitest` a `dist/index.js` o la externalización de `pg`; no se aisló. | En `tests/unit/credential-crypto.test.ts`, que está en el plan: reemplazar el mock por un alias de `pg` a un stub temporal, o un mecanismo equivalente probado. Agregar un control positivo permanente: configuración sintética válida y host que no resuelve deben dar contador ≥ 1, `beforeAll` fallido y ninguna salida DNS. Convertir Q-T37-a en esa regresión. |
| Q-02 | baja | C-26 (Diseño §5, A-02: "La identidad, destino y puerto validados son exactamente los que pg utilizará") | `pg-connection-string` vuelve a codificar la URL con `encodeURI` cuando encuentra un espacio o un `%` que no va seguido de dos dígitos hexadecimales. En ese caso no decodifica `%5F` y el usuario efectivo queda distinto del validado. Falla cerrada (un rol inexistente no autentica) y no puede escalar a otro rol válido, pero contradice el contrato. | Q-C26-c: tres variantes aceptadas por `createWorkerApi`; `ConnectionParameters` da `praxa%5Fintegrations.<ref>` contra el `praxa_integrations.<ref>` validado. El resolvedor en `fecae40` también acepta la variante con `%zz` en la query. | En `worker-api.ts` y en `inspectedUrl` de `sql-target.mjs`: rechazar las URLs que disparan esa recodificación (`/ \|%[^a-f0-9]\|%[a-f0-9][^a-f0-9]/i`), o comparar sin red el usuario, host y puerto que da el parser instalado con los validados antes de crear el Pool. Agregar las tres variantes a T-49 y T-22. |
| Q-03 | media | C-13, regla 5; Diseño §7 ("una referencia ambigua se rechaza"); CB-04 | Una `SUPABASE_DB_URL` definida pero no deducible deja sin comparar `NEXT_PUBLIC_SUPABASE_URL`. | Q-C13-c da `ok: true`. Q-C18-c muestra que `npm run test:app`, que no ejecuta `db:check:test`, pasa el `beforeAll` y la suite intenta conectar al proyecto que `NEXT_PUBLIC_SUPABASE_URL` identifica como app. Q-C13-g muestra que `db:check:test` sí lo rechaza. | **Ya corregido en `fecae40`** (H-E1-43). Una sonda pura sobre ese HEAD da `ok: false`. Falta la revisión de implementación de esa corrección. Conviene sumar Q-C18-c como regresión del recorrido de la suite. |
| Q-04 | baja | C-13 regla 7 y C-26 ("puerto explícito decimal canónico 6543") | Se acepta `:06543`, porque la URL WHATWG normaliza el puerto. El puerto efectivo es 6543, así que no cambia el destino. | Q-C13-d y Q-C26-d: ambos aceptan. Sigue igual en `fecae40`. | Que el usuario decida entre dos opciones: comparar el texto literal del puerto en la autoridad (y agregar el caso a T-22 y T-49), o aclarar en la spec que se acepta la normalización, con registro como hallazgo. |
| Q-05 | observación | Diseño §7 | `inspectedUrl` también rechaza parámetros TLS en `SUPABASE_TEST_DB_URL` y `SUPABASE_DB_URL`. La spec aplica a esas referencias solo el rechazo de `user`, `host` y `port`; la guarda TLS es "además" para la URL del rol. Una URL administrativa válida con `?sslmode=require` haría fallar la guarda del rol. | T-22 (`sql-test-target.test.ts`) exige ese rechazo. La configuración actual del usuario pasa. | Sin cambio obligatorio. Que el usuario decida si es endurecimiento aceptado y se registra, o si se acota a la spec. |

## Estado en `fecae40` (HEAD al cerrar)

- `git diff --stat 83bfdd3 fecae40 -- src tests/unit/credential-crypto.test.ts tests/app` no muestra cambios, así que **Q-01 y Q-02 (runtime) siguen vigentes**.
- La sonda pura de `resolveIntegrationsTestTarget`, sin red, dio:
  - Q-C13-c: `ok = false`, corregido.
  - Q-C13-d (`06543`): `ok = true`, sigue vigente.
  - Q-C26-c en el resolvedor (`%5F` con `%zz` en la query): `ok = true`, sigue vigente.
  - Control válido: `ok = true`.
- `fecae40` todavía no tiene revisión de implementación.

## Pendientes del usuario

1. Pedir la corrección de Q-01 y Q-02 dentro de M06.3a. Los archivos son `tests/unit/credential-crypto.test.ts`, `src/modules/integrations/db/worker-api.ts`, `scripts/lib/sql-target.mjs` y `tests/unit/sql-test-target.test.ts`, todos en el plan. Para Q-03, la corrección de `fecae40` necesita revisión.
2. Decidir Q-04 (rechazar `06543` o aceptar la normalización) y Q-05 (rechazo TLS en las URLs de referencia).
3. Después, correr `/implementation-review M06.3a` sobre el HEAD resultante y, si da APROBABLE, `/qa-review M06.3a`.
4. Evitar procesos de revisión o QA en paralelo sobre la misma rama. En este QA, otros dos procesos y un commit externo cambiaron el estado a mitad de la revisión.
5. Más adelante: push, PR, Codex y CI Linux; después, aprobación visible de `G-CRYPTO`. M28.2a sigue sin habilitar.
