# QA de M16.2 — revisión 2

**Fecha:** 2026-10-17
**Rama y commit:** `mf/M16.2`, `HEAD` = `5a4c49cf0530b4c7517de5c966c10af262db2544`
**Commit revisado por `implementation-review-5`:** `89a41b193a7c56015bcaf5f8cbff15a24dfa0bfa` (APROBABLE)
**Base (merge-base con `main`):** `65404aa100788a4eab5e98dbcfa6c116c8fa0bc1`, igual a la registrada en la revisión.
**Veredicto:** **LISTO PARA PR**. Los 43 criterios de la fase A (C-01 a C-35, C-38 a C-42 y C-44 a C-46) están en verde y las verificaciones obligatorias de III.3 se corrieron y pasaron. Hay dos hallazgos de severidad baja (Q-01, Q-02), sin criterio de la spec que los exija; no bloquean y se proponen para registro.

## 1. Precondiciones

| Precondición | Resultado | Evidencia |
|---|---|---|
| Rama `mf/M16.2` | Cumplida | `git branch --show-current` |
| Última `implementation-review-N` APROBABLE | Cumplida | `implementation-review-5`, APROBABLE |
| Commit revisado = `HEAD` | **Cumplida en lo sustancial, con una salvedad** | El commit revisado es `89a41b1`; `HEAD` es `5a4c49c`, el commit que guarda el propio informe de la revisión. `git diff --stat 89a41b1 HEAD` muestra un único archivo: `docs/FASES/FASE1/M16.2/revisiones/implementation-review-5.md` (96 líneas). El código, las pruebas, los documentos y las migraciones son byte a byte los revisados. El informe de la revisión pide expresamente correr este QA sobre ese estado. Si el usuario cambia cualquier otro archivo antes del PR, hay que repetir ambas revisiones. |
| Base = `git merge-base main HEAD` | Cumplida | `65404aa…` |
| Árbol limpio | Cumplida | El comando del paso 1 no devuelve nada, antes y después de las pruebas exploratorias |

## 2. Fuentes leídas

Spec y plan de M16.2 (estados `APROBADA` y `APROBADO`), ficha de M16.2 y secciones II.10, III.2, III.3 y III.9 de la ruta, `sesiones/M16.2.md`, `implementation-review-5`, `PROJECT_STATE.md`, `.github/workflows/verify.yml` (la CI solo corre `npm run verify`), los tres proyectos de `vitest.config.mts` y los scripts de `package.json`. También leí el código de producción de `accounts.ts`, `probe.ts`, `revoke.ts`, `client.ts`, `tokens.ts`, `lifecycle.ts`, `actions.ts`, `meta-tarjeta.tsx` y `scripts/meta-preflight.mjs` para elegir los casos exploratorios; las pruebas escritas usan solo la interfaz pública.

## 3. Matriz de comportamiento

«Cubierto por» indica una prueba existente cuyo resultado confirmé con las corridas completas de la sección 5 (`verify` 589/589, `test:app` 57 pasadas). Los casos `Q-*` y `D-*` son exploratorios míos (sección 4).

| Criterio | Caso | Tipo | Cubierto por | Resultado |
|---|---|---|---|---|
| C-01 listado paginado | Tres páginas por cursor; `paging.next` nunca se pide | Positivo | T-01 | Pasa |
| C-01 | Respuesta sin `data`; id de system user no numérico sin `fetch` | Negativo | T-02, Q-A7 | Pasa |
| C-01 | Diez páginas exactas aceptadas; décima con `next` falla con error fijo; `next` sin cursor falla sin seguir; cursor sin `next` termina; lista vacía válida | Borde | T-02, Q-A1 a Q-A4, Q-A8 | Pasa |
| C-02 cuentas inválidas | Una válida y cuatro inválidas, duplicado entre páginas | Positivo y negativo | T-03 | Pasa |
| C-02 | Nombre de 300 caracteres se recorta a 200 | Borde | Q-A5 | Pasa |
| C-02 | Nombre en blanco (`'   '`) debería tratarse como sin nombre | Borde | Q-A6 | **Falla** (Q-01) |
| C-03 selección explícita | Una sola cuenta sin preselección; varias cuentas con valor propio y descartadas informadas | Positivo y borde | T-27, Q-U1 | Pasa |
| C-03 | Error de listado: sin cuentas, con «Cancelar conexión» y alerta | Negativo | T-51, Q-U2 | Pasa |
| C-03 | Pendiente con cero cuentas delegadas y sin error: debería explicar por qué no hay nada que elegir | Borde | Q-U3 | **Falla** (Q-02) |
| C-04 elección resuelta en el servidor | Clave válida confirma con moneda y zona del listado | Positivo | T-06, D-1 | Pasa |
| C-04 | Clave mal formada, de otra conexión, solo con el id de la cuenta, de una cuenta fuera del listado | Negativo | T-07, D-2 | Pasa |
| C-04 | Campos extra del formulario ignorados | Borde | T-07 | Pasa |
| C-05 probe antes de confirmar | Probe ok y luego `confirm_connection` | Positivo | T-06, T-36 | Pasa |
| C-05 | Probe falla: no se confirma ni se marca | Negativo | T-08 | Pasa |
| C-05 | Desconexión entre el probe y la confirmación | Borde | T-30 | Pasa |
| C-06 probe sin valores | Consulta exacta, resumen sin valores | Positivo | T-04 | Pasa |
| C-06 | Seis o más páginas, cinco exactas sin `next`, respuesta vacía, campos nulos no cuentan, id inválido sin `fetch`, errores de Graph | Negativo y borde | T-04, T-05, Q-P1 a Q-P3 | Pasa |
| C-07 vencimiento | `pending_expired` de la base; vencida según servidor sin tocar Meta | Positivo y negativo | T-09, T-36, Q-L2 | Pasa |
| C-07 | Igualdad exacta `pending_expires_at == ahora` | Borde | No ejecutado: el código usa `<=`; el reloj es inyectable pero no armé el caso | Sin evidencia propia, riesgo bajo |
| C-08 orden de la purga | Bloqueo, revocación, purga; máximo cinco | Positivo | T-11, T-33 | Pasa |
| C-08 | Falla de bloqueo no purga; una purga que falla no frena la siguiente conexión | Negativo | T-12, Q-L5 | Pasa |
| C-08 | Siete entradas procesan cinco | Borde | T-11, Q-L6 | Pasa |
| C-09 purga al iniciar, al abrir y al desconectar | Orden y cliente inyectado; error de purga no corta el flujo | Positivo y negativo | T-13, T-33 | Pasa |
| C-09 | Pendiente vencida al abrir la tarjeta | Borde | Q-L2 | Pasa |
| C-10 revocación que falla no retiene la credencial | Error 190, red, `success:false`, sin credencial, llavero ilegible, configuración inválida | Negativo | T-12 | Pasa |
| C-10 | `success:"false"`, `success:1`, cuerpo `null`, arreglo vacío o de dos elementos no cuentan como revocado; `null` en el lote es `transport`; 190 dentro del lote es `authentication`; `fetch` que lanza no propaga | Borde | Q-R1, Q-R3 a Q-R5 | Pasa |
| C-10 | `success:"true"` revoca | Positivo | Q-R2 | Pasa |
| C-11 purga reanudable | Corrida siguiente completa; reconectar crea fila nueva | Positivo | T-30, T-33 | Pasa |
| C-11 | Repetir la desconexión no falla ni revoca otra vez | Borde | D-4 | Pasa |
| C-12 desconexión | `begin_disconnect` primero; sin filas al final; desde `active` | Positivo | T-34 | Pasa |
| C-12 | Desde `needs_reauth`: revoca una vez, sin filas; sin conexión ni pendientes responde `desconectado` sin `begin_disconnect` | Borde | D-4, Q-L7 | Pasa |
| C-13 cómo quitar la app en Meta | Texto fijo en `activa` y `requiere_reauth` | Positivo | T-28 | Pasa |
| C-13 | No aparece «Conectar» fuera de `sin_conexion` | Negativo | Q-U5 | Pasa |
| C-14 revocación por lote | `POST` único a `/v26.0/` sin consulta; secretos solo en el cuerpo; `GET` directo rechazado; `revoke_token` prohibido en URL | Positivo y negativo | T-14 | Pasa |
| C-15 reautorización | Orden completo y generación +1 desde `active` | Positivo | T-15, T-31 | Pasa |
| C-15 | Desde `needs_reauth`: queda `active`, sin error, generación +1, credencial nueva, misma cuenta | Borde | D-3 | Pasa |
| C-16 | Otra conexión u otra generación: `credencial_cambio` sin canjear | Negativo | T-16 | Pasa |
| C-17 | Cuenta fuera de las delegadas: no reemplaza y revoca | Negativo | T-17, T-32 | Pasa |
| C-18 | Cinco respuestas de `replace_credential`, una revocación en cada una | Negativo | T-18, T-31 | Pasa |
| C-19 caso B | Rechazo después del canje en `initial` y `reauth` revoca una vez | Negativo | T-19, T-51 y 11 roturas de la revisión | Pasa |
| C-20 caso A | Canje fallido no revoca; textos con la recuperación | Negativo | T-20 | Pasa |
| C-21 efecto por clase | Nueve clases; generación esperada; mensaje redactado | Positivo y negativo | T-21, T-37 | Pasa |
| C-22 | `unknown` y similares solo dejan una línea de registro | Negativo | T-22 | Pasa |
| C-23 | Tarjeta `requiere_reauth` con texto por clase y «Volver a autorizar» por `POST` | Positivo | T-28, D-3, Q-L4 | Pasa |
| C-24 escritura tardía | Desconexión parcial o completa durante confirmación y reautorización | Negativo | T-18, T-30, T-31 | Pasa |
| C-25 | Pendiente vigente: `pendiente_vigente` sin intento; cancelar deja sin filas | Positivo y negativo | T-13, T-35 | Pasa |
| C-26 seis estados de la tarjeta | Estados y botones; Google Analytics y Tiendanube sin cambios | Positivo | T-27, T-29, Q-U5 | Pasa |
| C-26 | Nombre con HTML se escapa | Borde | Q-U4 | Pasa |
| C-27 sin identificadores completos | HTML y salida de `loadMetaCardState` sin id de cuenta, system user ni negocio | Negativo | T-27, D-1 | Pasa |
| C-28 confinamiento | `server-only`, `'use server'`, secretos en un solo archivo | Positivo | T-24 y guardas existentes | Pasa |
| C-29 registros cerrados | Claves y valores permitidos | Negativo | T-23 | Pasa |
| C-30 textos cerrados | Resultados nuevos con texto; resultado retirado ya no existe | Positivo y negativo | T-25, T-29 | Pasa |
| C-31 K01 interno | Acciones sin actor ni empresa del navegador | Negativo | T-26 | Pasa |
| C-31 | Una empresa no confirma, bloquea, purga ni lee la credencial de la conexión de otra; desconectar lo propio no toca la ajena | Negativo (aislamiento) | D-5 | Pasa |
| C-32 un reintento | `confirm_connection` y `replace_credential` ante transporte | Positivo y negativo | T-10, T-52 | Pasa |
| C-33 guarda de `test:app` | Falla sin destino desechable | Negativo | T-38 (inspección más `db:check:test`) | Pasa |
| C-34 verificaciones | `verify`, `test:policies`, `test:app` sin omitir Meta | Positivo | T-39 a T-41, sección 5 | Pasa |
| C-35 documentos | Diff limitado al Diseño §17 | Revisión | T-42 y revisión 5 | Pasa |
| C-36, C-37 | VR-01, VD-01 y recuperación | Manual | T-44, T-45 | Fase B, ver sección 6 |
| C-38 estado compartido | Solo `active` es conectada; los otros estados y errores dan `false` | Positivo y negativo | T-46, D-1 | Pasa |
| C-39, C-40 transporte por lote | `debug_token` por lote; clasificación de respuestas externas e internas | Positivo y negativo | T-47 | Pasa |
| C-41 preflight | Una petición; salida cerrada; `ok` real del usuario | Positivo y negativo | T-48, sesión paso 11 | Pasa |
| C-41 | Tipo con caracteres fuera de `[A-Z_]` y `is_valid` no booleano salen como `null`; mensaje de error de Graph con el secreto no se imprime; sin `META_APP_ID` no hay `fetch`; respuesta válida sale con 0 | Borde | Q-F1 a Q-F4 | Pasa |
| C-42 clave ligada a la conexión | Clave de otra conexión o solo de la cuenta | Negativo | T-07, D-2 | Pasa |
| C-44 | Advertencia de retención en la UI | Positivo | T-50 | Pasa (el acta de M03a es de la fase B) |
| C-45 | `UnauthorizedError`, `NoCompanyError` y `begin_disconnect` fallido | Negativo | T-51 | Pasa |
| C-45 | `UnauthorizedError` en la tarjeta se muestra como `error`, no como `sin_empresa` | Borde | Q-L3 | Pasa |
| C-46 escritura ambigua | Relectura aplicada, distinta, ausente o ilegible | Positivo y negativo | T-52 | Pasa |

Criterios sin caso de borde propio: C-13, C-14, C-16 a C-18, C-20 a C-25, C-28 a C-33 y C-35 a C-42 tienen condiciones binarias o ya contienen su borde en el propio caso T (por ejemplo, las cinco respuestas de `replace_credential` de T-18); no inventé bordes.

## 4. Pruebas exploratorias

Dos tandas. **Sin base de datos:** worktree `../praxa-qa-M16.2` del commit `5a4c49c` (`git worktree add --detach`), `npm ci`, archivos en `tests/unit/__qa__/` y `tests/component/__qa__/`. **Con base de datos:** `npm run db:check:test` salió con 0 («Destino verificado», proyecto desechable) antes de empezar; el archivo vivió en `tests/app/__qa__/` del directorio del usuario, porque necesita su `.env.local` (no lo leí).

| Tanda | Comando | Archivos | Pruebas | Resultado |
|---|---|---|---|---|
| Unitarias (`unit`) | `npm run test:unit -- tests/unit/__qa__/qa-m16-2.test.ts` | 1 | 34 | 33 pasan, **1 falla** (Q-A6) |
| Componente (`component`) | `npm run test:component -- tests/component/__qa__/qa-tarjeta.test.tsx` | 1 | 5 | 4 pasan, **1 falla** (Q-U3). La primera corrida tuvo también un fallo mío en Q-U4 (el selector `img` encontraba el logo de la tarjeta); corregí el selector a `img[src="x"]` y repetí |
| Con base (`app`) | `npx vitest run --project app tests/app/__qa__/qa-m16-2-db.test.ts` | 1 | 5 | 5 pasan. La primera corrida tuvo dos fallos de mi expectativa (esperaba `…1002` y `…1001`): `maskExternalAccountId` solo muestra los últimos 4 con más de 8 caracteres y `act_1001` tiene 8. No es defecto del producto; corregí a `…` y repetí |

Cantidades confirmadas en la salida de Vitest: archivos y pruebas mayores que cero e iguales a los escritos. Borrado: el worktree se eliminó con `git worktree remove --force` sobre esa ruta temporal; `tests/app/__qa__/` se borró en el directorio del usuario. `git worktree list` muestra solo el directorio principal y el comando de árbol limpio del paso 1 no devuelve nada.

### 4.1 `tests/unit/__qa__/qa-m16-2.test.ts`

```ts
import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { readMetaOAuthConfig } from '@/modules/integrations/meta/api';
import { createMetaHttpClient, type MetaFetch } from '@/modules/integrations/meta/client';
import { MetaApiError } from '@/modules/integrations/meta/errors';
import { SecretValue, sealCredential } from '@/modules/integrations/crypto/seal';
import { parseCredentialKeyring } from '@/modules/integrations/crypto/keyring';
import { revokeToken } from '@/modules/integrations/meta/revoke';
import { listDelegatedAccounts, AccountListLimitError } from '@/modules/integrations/meta/accounts';
import { probeInsights } from '@/modules/integrations/meta/probe';
import { confirmAccount, disconnect, loadMetaCardState, runLazyPurge } from '@/modules/integrations/lifecycle';
import { WorkerApiError, type WorkerApi } from '@/modules/integrations/db/worker-api';
import { UnauthorizedError } from '@/modules/identity/session';
import type { TenantContext } from '@/modules/tenant/context';
import type { IntegrationConnectionRecord } from '@/modules/integrations/contract';
// @ts-expect-error script .mjs sin tipos
import { runPreflight } from '../../../scripts/meta-preflight.mjs';

const TOKEN = 'token-sint';
const CONFIG = readMetaOAuthConfig({ META_APP_ID: '1234567', META_APP_SECRET: 'secret-sint',
  META_CONFIG_ID: '7654321', META_REDIRECT_URI: 'https://praxa.test/api/integraciones/meta/callback' } as unknown as NodeJS.ProcessEnv);
const CTX: TenantContext = { user_id: '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d',
  company_id: '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f', role: 'owner', request_id: '7c6b5a49-3827-4165-a4b3-c2d1e0f9a8b7' };
const CID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
const keyring = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s });

function record(over: Record<string, unknown> = {}): IntegrationConnectionRecord {
  return { id: CID, company_id: CTX.company_id, provider: 'meta', client_business_id: 'negocio_sintetico',
    credential_generation: 0, current_sync_run_id: null, last_error_class: null, last_error_message: null,
    created_at: '2026-10-17T00:00:00.000Z', updated_at: '2026-10-17T00:00:00.000Z', status: 'pending_selection',
    external_account_id: null, currency: null, timezone: null, pending_expires_at: '2030-10-17T00:00:00.000Z',
    purge_requested_at: null, ...over } as IntegrationConnectionRecord;
}
function credentialRow() {
  return { connection_id: CID, company_id: CTX.company_id, provider: 'meta', status: 'pending_selection',
    credential_generation: 0, ...sealCredential(TOKEN, { company_id: CTX.company_id, connection_id: CID, provider: 'meta' }, keyring),
    token_type: 'system_user', issued_for_app_id: CONFIG.appId, granted_scopes: ['ads_read'], expires_at: null };
}
const acct = (n: number, extra: Record<string, unknown> = {}) => ({ id: `act_${1000 + n}`, name: `Cuenta ${n}`,
  currency: 'USD', timezone_name: 'UTC', ...extra });

function paged(pages: Array<{ data: unknown[]; next?: boolean; after?: string | null }>) {
  const urls: URL[] = [];
  const fetch: MetaFetch = async (url) => {
    urls.push(url);
    const i = urls.length - 1;
    const p = pages[Math.min(i, pages.length - 1)]!;
    const cursors = p.after === null || p.after === undefined ? {} : { cursors: { after: p.after } };
    const next = p.next ? { next: `https://graph.facebook.com/v26.0/x?access_token=${TOKEN}` } : {};
    const paging = Object.keys({ ...cursors, ...next }).length > 0 ? { paging: { ...cursors, ...next } } : {};
    return json({ data: p.data, ...paging });
  };
  return { urls, http: createMetaHttpClient({ fetch }) };
}

describe('QA accounts', () => {
  it('Q-A1 diez páginas exactas sin next final se aceptan', async () => {
    const pages = Array.from({ length: 10 }, (_, i) => ({ data: [acct(i)], next: i < 9, after: `c${i}` }));
    const m = paged(pages);
    const r = await listDelegatedAccounts(new SecretValue(TOKEN), '5550001', { http: m.http });
    expect(r.pages).toBe(10); expect(r.accounts).toHaveLength(10); expect(m.urls).toHaveLength(10);
  });
  it('Q-A2 la décima página con next falla con error fijo', async () => {
    const pages = Array.from({ length: 12 }, (_, i) => ({ data: [acct(i)], next: true, after: `c${i}` }));
    const m = paged(pages);
    await expect(listDelegatedAccounts(new SecretValue(TOKEN), '5550001', { http: m.http })).rejects.toBeInstanceOf(AccountListLimitError);
    expect(m.urls).toHaveLength(10);
  });
  it('Q-A3 next sin cursor after no se sigue y el listado se declara incompleto', async () => {
    const m = paged([{ data: [acct(1)], next: true, after: null }, { data: [acct(2)] }]);
    await expect(listDelegatedAccounts(new SecretValue(TOKEN), '5550001', { http: m.http })).rejects.toBeInstanceOf(AccountListLimitError);
    expect(m.urls).toHaveLength(1);
  });
  it('Q-A4 cursor sin next termina en una sola página', async () => {
    const m = paged([{ data: [acct(1)], after: 'zzz' }, { data: [acct(2)] }]);
    const r = await listDelegatedAccounts(new SecretValue(TOKEN), '5550001', { http: m.http });
    expect(r.accounts).toHaveLength(1); expect(m.urls).toHaveLength(1);
  });
  it('Q-A5 nombre de más de 200 caracteres se recorta', async () => {
    const m = paged([{ data: [acct(1, { name: 'x'.repeat(300) })] }]);
    const r = await listDelegatedAccounts(new SecretValue(TOKEN), '5550001', { http: m.http });
    expect(r.accounts[0]!.name).toHaveLength(200);
  });
  it('Q-A6 nombre en blanco debe tratarse como sin nombre (null)', async () => {
    const m = paged([{ data: [acct(1, { name: '   ' })] }]);
    const r = await listDelegatedAccounts(new SecretValue(TOKEN), '5550001', { http: m.http });
    expect(r.accounts[0]!.name).toBeNull();
  });
  it('Q-A7 systemUserId inválido no llama a fetch', async () => {
    const m = paged([{ data: [] }]);
    await expect(listDelegatedAccounts(new SecretValue(TOKEN), '55a', { http: m.http })).rejects.toBeInstanceOf(MetaApiError);
    expect(m.urls).toHaveLength(0);
  });
  it('Q-A8 lista vacía es válida (cero cuentas delegadas)', async () => {
    const m = paged([{ data: [] }]);
    const r = await listDelegatedAccounts(new SecretValue(TOKEN), '5550001', { http: m.http });
    expect(r).toMatchObject({ accounts: [], discarded: 0, pages: 1 });
  });
});

describe('QA probe', () => {
  const now = (() => { let t = 0; return () => (t += 5); })();
  it('Q-P1 cinco páginas exactas sin next final: completa', async () => {
    const pages = Array.from({ length: 5 }, (_, i) => ({ data: [{ date_start: 'd', spend: '1.23' }], next: i < 4, after: `c${i}` }));
    const m = paged(pages);
    const r = await probeInsights(new SecretValue(TOKEN), 'act_1001', { http: m.http, now });
    expect(r).toMatchObject({ rows: 5, pages: 5, calls: 5, complete: true });
    expect(r.fieldsPresent).toEqual(['date_start', 'spend']);
  });
  it('Q-P2 id de cuenta inválido no llama a fetch', async () => {
    const m = paged([{ data: [] }]);
    await expect(probeInsights(new SecretValue(TOKEN), '1001', { http: m.http, now })).rejects.toBeInstanceOf(MetaApiError);
    expect(m.urls).toHaveLength(0);
  });
  it('Q-P3 campos nulos no cuentan como presentes', async () => {
    const m = paged([{ data: [{ spend: null, impressions: '9' }] }]);
    const r = await probeInsights(new SecretValue(TOKEN), 'act_1001', { http: m.http, now });
    expect(r.fieldsPresent).toEqual(['impressions']);
  });
});

describe('QA revocación', () => {
  const run = async (outer: unknown, status = 200) => {
    const http = createMetaHttpClient({ fetch: async () => json(outer, status) });
    return revokeToken(new SecretValue(TOKEN), { http, config: CONFIG });
  };
  it.each([
    ['success "false"', [{ code: 200, body: '{"success":"false"}' }]],
    ['success 1', [{ code: 200, body: '{"success":1}' }]],
    ['cuerpo null', [{ code: 200, body: 'null' }]],
    ['arreglo vacío', []],
    ['dos elementos', [{ code: 200, body: '{"success":true}' }, { code: 200, body: '{"success":true}' }]],
  ])('Q-R1 %s no cuenta como revocado', async (_n, outer) => {
    expect(await run(outer)).toEqual({ status: 'failed', errorClass: 'unknown' });
  });
  it('Q-R2 success "true" revoca', async () => {
    expect(await run([{ code: 200, body: '{"success":"true"}' }])).toEqual({ status: 'revoked' });
  });
  it('Q-R3 null en el lote: failed transport', async () => {
    expect(await run([null])).toEqual({ status: 'failed', errorClass: 'transport' });
  });
  it('Q-R4 error 190 dentro del lote con code 400: failed authentication', async () => {
    expect(await run([{ code: 400, body: '{"error":{"code":190}}' }])).toEqual({ status: 'failed', errorClass: 'authentication' });
  });
  it('Q-R5 fetch que lanza no propaga', async () => {
    const http = createMetaHttpClient({ fetch: async () => { throw new Error(`boom ${TOKEN}`); } });
    expect(await revokeToken(new SecretValue(TOKEN), { http, config: CONFIG })).toEqual({ status: 'failed', errorClass: 'transport' });
  });
});

function metaFor(accounts: unknown[]) {
  const seen: string[] = [];
  const http = createMetaHttpClient({ fetch: async (url) => {
    seen.push(url.pathname);
    if (url.pathname === '/v26.0/me') return json({ id: '5550001', client_business_id: 'negocio_sintetico' });
    if (url.pathname === '/v26.0/5550001/assigned_ad_accounts') return json({ data: accounts });
    return json({ data: [] });
  } });
  return { seen, http };
}
function worker(handler: (fn: string, args: readonly unknown[]) => unknown) {
  const calls: string[] = [];
  const api = { call: (async (fn: string, args: readonly unknown[]) => { calls.push(fn); return handler(fn, args); }) as WorkerApi['call'] };
  return { calls, api };
}

describe('QA ciclo de vida', () => {
  it.each([
    ['active', record({ status: 'active', external_account_id: 'act_1001', currency: 'USD', timezone: 'UTC', pending_expires_at: null })],
    ['needs_reauth', record({ status: 'needs_reauth', external_account_id: 'act_1001', currency: 'USD', timezone: 'UTC',
      pending_expires_at: null, last_error_class: 'authentication', last_error_message: 'x' })],
    ['sin conexión', null],
  ])('Q-L1 confirmAccount con %s responde conexion_cambio sin tocar Meta ni worker_api', async (_n, rec) => {
    const m = metaFor([acct(1)]); const w = worker(() => { throw new Error('no'); });
    const key = createHash('sha256').update(`${CID}:act_1001`).digest('hex');
    expect(await confirmAccount(key, { tenant: async () => CTX, readConnection: async () => rec as never,
      http: m.http, workerApi: () => w.api, keyring: () => keyring, config: () => CONFIG, log: () => {} })).toBe('conexion_cambio');
    expect(m.seen).toHaveLength(0); expect(w.calls).toHaveLength(0);
  });
  it('Q-L2 pendiente vencida: la tarjeta no consulta a Meta y no habilita cuentas', async () => {
    const m = metaFor([acct(1)]); const w = worker((fn) => { if (fn === 'list_pending_purges') return []; throw new Error('no'); });
    const state = await loadMetaCardState({ tenant: async () => CTX,
      readConnection: async () => record({ pending_expires_at: '2026-10-17T11:00:00.000Z' }),
      http: m.http, workerApi: () => w.api, keyring: () => keyring, config: () => CONFIG, log: () => {},
      now: () => new Date('2026-10-17T12:00:00.000Z') });
    expect(state).toMatchObject({ kind: 'pendiente', accounts: [], listError: 'pendiente_vencida' });
    expect(m.seen).toHaveLength(0); expect(w.calls).toEqual(['list_pending_purges']);
  });
  it('Q-L3 UnauthorizedError en loadMetaCardState se muestra como error, no sin_empresa', async () => {
    const w = worker(() => []);
    expect(await loadMetaCardState({ tenant: async () => { throw new UnauthorizedError(); }, workerApi: () => w.api, log: () => {} }))
      .toEqual({ kind: 'error' });
    expect(w.calls).toHaveLength(0);
  });
  it('Q-L4 needs_reauth muestra la clase guardada', async () => {
    const w = worker(() => []);
    const rec = record({ status: 'needs_reauth', external_account_id: 'act_90001', currency: 'ARS', timezone: 'UTC',
      pending_expires_at: null, last_error_class: 'permission', last_error_message: 'Falta permiso' });
    expect(await loadMetaCardState({ tenant: async () => CTX, readConnection: async () => rec, workerApi: () => w.api, log: () => {} }))
      .toEqual({ kind: 'requiere_reauth', maskedId: '…0001', currency: 'ARS', timezone: 'UTC', errorClass: 'permission' });
  });
  it('Q-L5 una purga que falla no frena a la siguiente conexión', async () => {
    const A = CID; const B = 'c5c4c3c2-1111-4111-8111-a5a4a3a2a1a0';
    const w = worker((fn, args) => {
      if (fn === 'list_pending_purges') return [A, B].map((id) => ({ connection_id: id, status: 'disconnected',
        reason: 'disconnect_requested', has_credential: false, pending_expires_at: null, purge_requested_at: new Date() }));
      if (fn === 'purge_connection') {
        if (args[2] === A) throw new WorkerApiError('unavailable', 'other');
        return [{ purge_connection: true }];
      }
      throw new Error('no');
    });
    const logs: unknown[] = [];
    expect(await runLazyPurge(CTX, { workerApi: () => w.api, log: (l) => logs.push(l) }))
      .toEqual({ purged: 1, revokeFailed: 0, remaining: true });
    expect(w.calls.filter((c) => c === 'purge_connection')).toHaveLength(2);
  });
  it('Q-L6 disconnect con más de cinco pendientes responde desconexion_en_curso', async () => {
    const w = worker((fn) => {
      if (fn === 'begin_disconnect') return [{ connection_id: CID, status: 'disconnected', credential_generation: 1,
        purge_requested_at: new Date() }];
      if (fn === 'list_pending_purges') return Array.from({ length: 7 }, (_, i) => ({
        connection_id: `c5c4c3c2-1111-4111-8111-a5a4a3a2a1a${i}`, status: 'disconnected', reason: 'disconnect_requested',
        has_credential: false, pending_expires_at: null, purge_requested_at: new Date() }));
      if (fn === 'purge_connection') return [{ purge_connection: true }];
      throw new Error('no');
    });
    expect(await disconnect({ tenant: async () => CTX, readConnection: async () => record(), workerApi: () => w.api,
      log: () => {} })).toBe('desconexion_en_curso');
  });
  it('Q-L7 disconnect sin conexión ni pendientes: desconectado sin begin_disconnect (idempotente)', async () => {
    const w = worker((fn) => { if (fn === 'list_pending_purges') return []; throw new Error('no'); });
    expect(await disconnect({ tenant: async () => CTX, readConnection: async () => null, workerApi: () => w.api,
      log: () => {} })).toBe('desconectado');
    expect(w.calls).toEqual(['list_pending_purges']);
  });
  it('Q-L8 la tarjeta pendiente con la lista de Meta vacía no ofrece cuentas ni error', async () => {
    const m = metaFor([]);
    const w = worker((fn) => { if (fn === 'list_pending_purges') return []; if (fn === 'get_credential') return [credentialRow()]; throw new Error('no'); });
    const s = await loadMetaCardState({ tenant: async () => CTX, readConnection: async () => record(), http: m.http,
      workerApi: () => w.api, keyring: () => keyring, config: () => CONFIG, log: () => {},
      now: () => new Date('2026-10-17T12:00:00.000Z') });
    expect(s).toMatchObject({ kind: 'pendiente', accounts: [], discarded: 0, listError: null });
  });
});

describe('QA preflight', () => {
  const run = async (inner: unknown, status = 200,
    env: Record<string, string | undefined> = { META_APP_ID: '1234567', META_APP_SECRET: 'secret-sint' }) => {
    const lines: string[] = []; let calls = 0;
    const code = await runPreflight({ env, fetch: async () => { calls += 1; return new Response(JSON.stringify(inner), { status }); },
      log: (l: string) => lines.push(l) });
    return { code, lines, calls };
  };
  it('Q-F1 tipo inválido y valido no booleano salen como null', async () => {
    const r = await run([{ code: 200, body: JSON.stringify({ data: { type: 'app<script>', is_valid: 'true', app_id: '1234567' } }) }]);
    expect(r.code).toBe(1);
    expect(JSON.parse(r.lines[0]!)).toEqual({ preflight: 'fallido', http: 200, codigo: 200, tipo: null, valido: null, error_graph: null });
  });
  it('Q-F2 mensaje de error de Graph con el secreto no se imprime', async () => {
    const r = await run([{ code: 400, body: JSON.stringify({ error: { code: 190, message: 'secret-sint 1234567' } }) }], 200);
    expect(r.lines.join('')).not.toContain('secret-sint'); expect(r.lines.join('')).not.toContain('1234567');
    expect(JSON.parse(r.lines[0]!).error_graph).toBe(190);
  });
  it('Q-F3 sin META_APP_ID: sin_configuracion y sin fetch', async () => {
    const r = await run([], 200, { META_APP_SECRET: 'secret-sint' });
    expect(r).toMatchObject({ code: 1, calls: 0 });
    expect(JSON.parse(r.lines[0]!)).toEqual({ preflight: 'sin_configuracion' });
  });
  it('Q-F4 respuesta ok válida', async () => {
    const r = await run([{ code: 200, body: JSON.stringify({ data: { type: 'APP', is_valid: true } }) }]);
    expect(r.code).toBe(0);
  });
});
```

Resultado: 34 pruebas, 33 pasan. Falla **Q-A6**: `expected '' to be null` (`listDelegatedAccounts` devuelve `name: ''` para un nombre de solo espacios).

### 4.2 `tests/component/__qa__/qa-tarjeta.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/modules/integrations/actions', () => ({ confirmarCuentaMeta: vi.fn(), desconectarMeta: vi.fn() }));

import { MetaTarjeta } from '@/app/(app)/app/integraciones/meta-tarjeta';

const key = (c: string) => c.repeat(64);

describe('QA tarjeta', () => {
  it('Q-U1 varias cuentas: ninguna preseleccionada, cada una con su valor', () => {
    render(<MetaTarjeta state={{ kind: 'pendiente', pendingExpiresAt: 'x', discarded: 2, listError: null, accounts: [
      { selectionKey: key('a'), name: 'Uno', maskedId: '…1001', currency: 'USD', timezone: 'UTC' },
      { selectionKey: key('b'), name: null, maskedId: '…1002', currency: 'ARS', timezone: 'UTC' }] }} />);
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(2); expect(radios.some((r) => r.checked)).toBe(false);
    expect(radios.map((r) => r.value)).toEqual([key('a'), key('b')]);
    expect(screen.getByText(/Cuenta sin nombre/)).toBeInTheDocument();
    expect(screen.getByText(/2 cuentas no se pueden usar/)).toBeInTheDocument();
  });
  it('Q-U2 pendiente con error de listado: sin cuentas y con cancelar', () => {
    render(<MetaTarjeta state={{ kind: 'pendiente', pendingExpiresAt: 'x', discarded: 0, listError: 'token_no_valido', accounts: [] }} />);
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar cuenta' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar conexión' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
  it('Q-U3 pendiente con cero cuentas delegadas y sin error: debe haber un mensaje que lo explique', () => {
    const { container } = render(<MetaTarjeta state={{ kind: 'pendiente', pendingExpiresAt: 'x', discarded: 0, listError: null, accounts: [] }} />);
    expect(screen.getByRole('button', { name: 'Cancelar conexión' })).toBeInTheDocument();
    expect(container.textContent).toMatch(/no hay cuentas|ninguna cuenta|sin cuentas|no compartiste/i);
  });
  it('Q-U4 nombre con HTML se escapa', () => {
    const { container } = render(<MetaTarjeta state={{ kind: 'pendiente', pendingExpiresAt: 'x', discarded: 0, listError: null, accounts: [
      { selectionKey: key('a'), name: '<img src=x onerror=alert(1)>', maskedId: '…1001', currency: 'USD', timezone: 'UTC' }] }} />);
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });
  it('Q-U5 Conectar sólo en sin_conexion', () => {
    for (const state of [
      { kind: 'activa', maskedId: '…1', currency: 'USD', timezone: 'UTC' },
      { kind: 'requiere_reauth', maskedId: '…1', currency: 'USD', timezone: 'UTC', errorClass: 'authentication' },
      { kind: 'pendiente', pendingExpiresAt: 'x', discarded: 0, listError: null, accounts: [] }] as const) {
      const { unmount } = render(<MetaTarjeta state={state as never} />);
      expect(screen.queryByRole('button', { name: 'Conectar' })).not.toBeInTheDocument();
      unmount();
    }
  });
});
```

Resultado: 5 pruebas, 4 pasan. Falla **Q-U3**: el texto renderizado es `Meta AdsCampañas de Facebooke InstagramNo conectadoCancelar conexión`; sin cuentas, sin error y sin explicación.

### 4.3 `tests/app/__qa__/qa-m16-2-db.test.ts` (versión final, con la expectativa de máscara corregida)

```ts
import { createHash, randomUUID } from 'node:crypto';

import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { MetaFetch } from '@/modules/integrations/meta/client';
import type { MetaOAuthDeps } from '@/modules/integrations/meta/oauth';
import type { TenantContext } from '@/modules/tenant/context';
import { resolveIntegrationsTestTarget } from '../../../scripts/lib/sql-target.mjs';
import { blockedReason, cleanupRun, createConfirmedUser, pendingCleanupCount,
  remoteProjectReachable, RUN_ID, type TestUser } from '../helpers';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const ORIGIN = 'https://praxa.test';
const REDIRECT_URI = `${ORIGIN}/api/integraciones/meta/callback`;
const COOKIE = '__Host-praxa_oauth_binding';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
type Company = { user: TestUser; ctx: TenantContext };
const ACCOUNTS = [
  { id: 'act_1001', name: 'Cuenta sintética 1', currency: 'USD', timezone_name: 'UTC' },
  { id: 'act_1002', name: 'Cuenta sintética 2', currency: 'ARS', timezone_name: 'America/Argentina/Buenos_Aires' },
];

describe('QA M16.2: exploratorias con base desechable', () => {
  let oauth: typeof import('@/modules/integrations/meta/oauth');
  let lifecycle: typeof import('@/modules/integrations/lifecycle');
  let api: typeof import('@/modules/integrations/meta/api');
  let client: typeof import('@/modules/integrations/meta/client');
  let errors: typeof import('@/modules/integrations/meta/errors');
  let connections: typeof import('@/modules/integrations/repository/connections');
  let calls: typeof import('@/modules/integrations/repository/lifecycle-calls');
  let credentials: typeof import('@/modules/integrations/repository/credentials');
  let keyrings: typeof import('@/modules/integrations/crypto/keyring');
  let worker: ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi> | undefined;

  beforeAll(async () => {
    const target = resolveIntegrationsTestTarget(process.env);
    if (!target.ok) throw new Error(target.problems?.join(' ') ?? 'Destino de pruebas inválido.');
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);
    if (!(await remoteProjectReachable())) throw new Error('El proyecto de pruebas no responde.');
    [oauth, lifecycle, api, client, errors, connections, calls, credentials, keyrings] = await Promise.all([
      import('@/modules/integrations/meta/oauth'), import('@/modules/integrations/lifecycle'),
      import('@/modules/integrations/meta/api'), import('@/modules/integrations/meta/client'),
      import('@/modules/integrations/meta/errors'),
      import('@/modules/integrations/repository/connections'),
      import('@/modules/integrations/repository/lifecycle-calls'),
      import('@/modules/integrations/repository/credentials'),
      import('@/modules/integrations/crypto/keyring'),
    ]);
    const db = await import('@/modules/integrations/db/worker-api');
    worker = db.createWorkerApi({ connectionString: target.connectionString });
  });

  afterAll(async () => {
    try { await worker?.end(); }
    finally { await cleanupRun(); expect(pendingCleanupCount()).toBe(0); }
  });

  async function company(label: string): Promise<Company> {
    const user = await createConfirmedUser(`qa162-${label}`);
    const { data, error } = await user.client.rpc('create_company_for_current_user',
      { p_name: `Empresa sintética ${RUN_ID} ${label}` }).single<{ id: string }>();
    if (error || !data) throw new Error('No se pudo crear empresa sintética.');
    return { user, ctx: { user_id: user.id, company_id: data.id, role: 'owner', request_id: randomUUID() } };
  }

  function fakeMeta(accounts = ACCOUNTS) {
    const seen: Array<{ path: string; method: string }> = [];
    let exchanges = 0;
    const fetch: MetaFetch = async (url, init) => {
      seen.push({ path: url.pathname, method: init.method ?? 'GET' });
      if (url.pathname === '/v26.0/oauth/access_token') {
        exchanges += 1;
        return json({ access_token: `token-sint-${exchanges}`, token_type: 'bearer' });
      }
      if (url.pathname === '/v26.0/' && init.method === 'POST') {
        const batch = JSON.parse(new URLSearchParams(String(init.body)).get('batch') ?? 'null');
        const inner = new URL(batch[0].relative_url, 'https://graph.facebook.com/');
        seen.push({ path: inner.pathname, method: 'BATCH_GET' });
        if (inner.pathname === '/debug_token') return json([{ code: 200, body: JSON.stringify({ data: {
          is_valid: true, app_id: '1234567', type: 'SYSTEM_USER', scopes: ['ads_read'], expires_at: 0 } }) }]);
        if (inner.pathname === '/oauth/revoke') return json([{ code: 200, body: '{"success":true}' }]);
        return json([{ code: 404, body: '{"error":{"code":803}}' }]);
      }
      if (url.pathname === '/v26.0/me') return json({ id: '5550001', client_business_id: 'negocio_sint' });
      if (url.pathname === '/v26.0/5550001/assigned_ad_accounts') return json({ data: accounts });
      if (/^\/v26\.0\/act_\d+\/insights$/.test(url.pathname)) return json({ data: [{ date_start: '2026-10-01', spend: '1.23' }] });
      return json({ error: { code: 803 } }, 404);
    };
    return { seen, http: client.createMetaHttpClient({ fetch }) };
  }

  function config() { return api.readMetaOAuthConfig({ META_APP_ID: '1234567', META_APP_SECRET: 'secret-sint',
    META_REDIRECT_URI: REDIRECT_URI, META_CONFIG_ID: '7654321' } as unknown as NodeJS.ProcessEnv); }

  function lifeDeps(owner: Company, meta: ReturnType<typeof fakeMeta>) {
    return { tenant: async () => owner.ctx, config, http: meta.http, workerApi: () => worker!,
      keyring: () => keyrings.getCredentialKeyring(),
      readConnection: (ctx: TenantContext) => connections.readConnectionRecord(ctx, { supabase: owner.user.client }),
      log: () => {}, now: () => new Date() };
  }
  function oauthDeps(owner: Company, meta: ReturnType<typeof fakeMeta>): Partial<MetaOAuthDeps> {
    return { tenant: async () => owner.ctx, config, http: meta.http, workerApi: worker!,
      keyring: keyrings.getCredentialKeyring(),
      readLiveConnection: (ctx) => connections.readLiveConnection(ctx, { supabase: owner.user.client }),
      readConnection: (ctx) => connections.readConnectionRecord(ctx, { supabase: owner.user.client }),
      log: () => {} };
  }
  async function authorize(owner: Company, meta: ReturnType<typeof fakeMeta>) {
    const started = await oauth.handleMetaStart(new NextRequest(`${ORIGIN}/api/integraciones/meta/iniciar`,
      { method: 'POST', headers: { origin: ORIGIN } }), oauthDeps(owner, meta));
    const location = started.headers.get('location') ?? '';
    const state = new URL(location).searchParams.get('state') ?? '';
    const nonce = /__Host-praxa_oauth_binding=([^;]*)/.exec(started.headers.get('set-cookie') ?? '')?.[1] ?? '';
    const url = new URL(REDIRECT_URI);
    url.searchParams.set('state', state); url.searchParams.set('code', 'codigo-sint');
    const callback = await oauth.handleMetaCallback(new NextRequest(url, { headers: { cookie: `${COOKIE}=${nonce}` } }),
      oauthDeps(owner, meta));
    return new URL(callback.headers.get('location') ?? '').searchParams.get('meta');
  }
  async function pending(owner: Company, meta: ReturnType<typeof fakeMeta>) {
    expect(await authorize(owner, meta)).toBe('pendiente');
    const row = await connections.readConnectionRecord(owner.ctx, { supabase: owner.user.client });
    expect(row?.status).toBe('pending_selection');
    return row!;
  }

  it('D-1 con dos cuentas, se activa exactamente la elegida con su moneda y zona', async () => {
    const owner = await company('multi'); const meta = fakeMeta(); const row = await pending(owner, meta);
    const state = await lifecycle.loadMetaCardState(lifeDeps(owner, meta));
    expect(state.kind).toBe('pendiente');
    if (state.kind !== 'pendiente') return;
    expect(state.accounts).toHaveLength(2);
    expect(JSON.stringify(state)).not.toContain('act_1002');
    expect(await lifecycle.confirmAccount(sha256(`${row.id}:act_1002`), lifeDeps(owner, meta))).toBe('conectado');
    const after = await connections.readConnectionRecord(owner.ctx, { supabase: owner.user.client });
    expect(after).toMatchObject({ status: 'active', external_account_id: 'act_1002', currency: 'ARS',
      timezone: 'America/Argentina/Buenos_Aires' });
    const card = await lifecycle.loadMetaCardState(lifeDeps(owner, meta));
    expect(card).toEqual({ kind: 'activa', maskedId: '…', currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires' });
  });

  it('D-2 clave de una cuenta que no está en el listado deja la pendiente intacta', async () => {
    const owner = await company('forged'); const meta = fakeMeta(); const row = await pending(owner, meta);
    expect(await lifecycle.confirmAccount(sha256(`${row.id}:act_9999`), lifeDeps(owner, meta))).toBe('cuenta_invalida');
    expect(await lifecycle.confirmAccount(sha256('act_1001'), lifeDeps(owner, meta))).toBe('cuenta_invalida');
    const after = await connections.readConnectionRecord(owner.ctx, { supabase: owner.user.client });
    expect(after).toMatchObject({ status: 'pending_selection', external_account_id: null, currency: null });
    expect(meta.seen.some((c) => c.path.endsWith('/insights'))).toBe(false);
  });

  it('D-3 needs_reauth -> reautorización completa deja active, sin error y con generación +1', async () => {
    const owner = await company('needs-reauth'); const meta = fakeMeta(); const row = await pending(owner, meta);
    expect(await lifecycle.confirmAccount(sha256(`${row.id}:act_1001`), lifeDeps(owner, meta))).toBe('conectado');
    const active = (await connections.readConnectionRecord(owner.ctx, { supabase: owner.user.client }))!;
    const failure = new errors.MetaApiError({ errorClass: 'authentication', graphCode: 190, graphSubcode: null });
    expect(await lifecycle.applyConnectionFailure(owner.ctx,
      { id: active.id, credentialGeneration: active.credential_generation }, failure, lifeDeps(owner, meta))).toBe('needs_reauth');
    const card = await lifecycle.loadMetaCardState(lifeDeps(owner, meta));
    expect(card).toEqual({ kind: 'requiere_reauth', maskedId: '…', currency: 'USD', timezone: 'UTC', errorClass: 'authentication' });
    expect(await authorize(owner, meta)).toBe('reautorizado');
    const after = (await connections.readConnectionRecord(owner.ctx, { supabase: owner.user.client }))!;
    expect(after.status).toBe('active');
    expect(after.credential_generation).toBe(active.credential_generation + 1);
    expect(after.last_error_class).toBeNull();
    expect(after.last_error_message).toBeNull();
    expect(after.external_account_id).toBe('act_1001');
    const saved = await credentials.readCredential(owner.ctx, active.id,
      { workerApi: worker!, keyring: keyrings.getCredentialKeyring() });
    expect(saved.token.reveal()).toBe('token-sint-2');
  });

  it('D-4 desconectar desde needs_reauth revoca una vez y no deja filas', async () => {
    const owner = await company('disc-needs'); const meta = fakeMeta(); const row = await pending(owner, meta);
    await lifecycle.confirmAccount(sha256(`${row.id}:act_1001`), lifeDeps(owner, meta));
    const active = (await connections.readConnectionRecord(owner.ctx, { supabase: owner.user.client }))!;
    await lifecycle.applyConnectionFailure(owner.ctx, { id: active.id, credentialGeneration: active.credential_generation },
      new errors.MetaApiError({ errorClass: 'permission', graphCode: 200, graphSubcode: null }), lifeDeps(owner, meta));
    const before = meta.seen.filter((c) => c.path === '/oauth/revoke').length;
    expect(await lifecycle.disconnect(lifeDeps(owner, meta))).toBe('desconectado');
    expect(meta.seen.filter((c) => c.path === '/oauth/revoke').length - before).toBe(1);
    expect(await connections.readConnectionRecord(owner.ctx, { supabase: owner.user.client })).toBeNull();
    // idempotente: repetir no falla ni revoca otra vez
    expect(await lifecycle.disconnect(lifeDeps(owner, meta))).toBe('desconectado');
    expect(meta.seen.filter((c) => c.path === '/oauth/revoke').length - before).toBe(1);
  });

  it('D-5 aislamiento: otra empresa no puede bloquear, purgar ni confirmar la conexión ajena', async () => {
    const a = await company('iso-a'); const b = await company('iso-b');
    const metaA = fakeMeta(); const metaB = fakeMeta();
    const rowA = await pending(a, metaA);
    expect(await lifecycle.confirmAccount(sha256(`${rowA.id}:act_1001`), lifeDeps(a, metaA))).toBe('conectado');
    const rowB = await pending(b, metaB);

    // la clave de A no sirve en B
    expect(await lifecycle.confirmAccount(sha256(`${rowA.id}:act_1001`), lifeDeps(b, metaB))).toBe('cuenta_invalida');
    // funciones de ciclo de vida de B con el id de A
    await expect(calls.beginDisconnect(b.ctx, rowA.id, { workerApi: worker! })).rejects.toMatchObject({ name: 'WorkerApiError' });
    await expect(calls.confirmConnection(b.ctx, { connectionId: rowA.id, externalAccountId: 'act_1001',
      currency: 'USD', timezone: 'UTC' }, { workerApi: worker! })).rejects.toMatchObject({ name: 'WorkerApiError' });
    const purged = await calls.purgeConnection(b.ctx, rowA.id, { workerApi: worker! }).catch((e) => e);
    expect(purged === false || (purged as Error).name === 'WorkerApiError').toBe(true);
    await expect(credentials.readCredential(b.ctx, rowA.id,
      { workerApi: worker!, keyring: keyrings.getCredentialKeyring() })).rejects.toBeDefined();
    // B desconecta lo suyo y A sigue activa con su credencial
    expect(await lifecycle.disconnect(lifeDeps(b, metaB))).toBe('desconectado');
    expect(await connections.readConnectionRecord(b.ctx, { supabase: b.user.client })).toBeNull();
    const afterA = await connections.readConnectionRecord(a.ctx, { supabase: a.user.client });
    expect(afterA).toMatchObject({ id: rowA.id, status: 'active', external_account_id: 'act_1001' });
    const credA = await credentials.readCredential(a.ctx, rowA.id, { workerApi: worker!, keyring: keyrings.getCredentialKeyring() });
    expect(credA.token.reveal()).toBe('token-sint-1');
    // RLS: B no ve la conexión de A
    expect(await connections.readConnectionRecord(b.ctx, { supabase: b.user.client })).toBeNull();
    void rowB;
  });
});
```

Resultado final: 1 archivo, 5/5 pruebas pasan (D-1 a D-5). Las pruebas de la empresa sintética se limpiaron con `cleanupRun` y `pendingCleanupCount() === 0` (afterAll). Ninguna corrió contra `app`.

## 5. Verificación completa

Todo en `mf/M16.2`, `HEAD` `5a4c49c`, Git Bash (Vitest cargó las suites sin el problema H-E1-20), Node 24.18.1.

| Comando | Resultado |
|---|---|
| `npm run db:check:test` | Exit 0, «Destino verificado» (proyecto desechable; no se copia el identificador) |
| `npm run verify` | Exit 0. Lint sin errores ni advertencias, `typegen`, `typecheck`, **26 archivos y 589/589 pruebas** (`unit` y `component`), build de Next correcto |
| `npm run test:policies` | Exit 0. 13 archivos, 14 ejecuciones, **482 aserciones**, 0 problemas (08, 09, 09b y 10 en verde) |
| `npm run test:app` | Exit 0. 9 archivos, **57 pasadas y 7 omitidas**. Las omitidas son las 3 pruebas de `email-flows.test.ts` (opt-in `SUPABASE_TEST_EMAIL_FLOWS=true`, consumen cuota de correo) y las 4 guardas inversas `skipIf(canRun)` de `integrations-data-api`, `concurrency`, `isolation` y `onboarding`, cuyas suites efectivas corrieron. Verificado con `grep skipIf` en `tests/app` |
| `npx vitest run --project app tests/app/meta-lifecycle.test.ts tests/app/meta-oauth.test.ts` | Exit 0. 2 archivos, **19/19, sin omitidas** (CB-06) |
| `git diff --name-status -M 65404aa HEAD -- supabase` | Vacío: ninguna migración creada, modificada ni renombrada (CB-03; `db:push` al proyecto `app` no aplica) |
| Búsqueda en el diff contra la base (`src`, `scripts`, `tests`, `SECURITY.md`, `ARCHITECTURE.md`) de token de Meta, `act_` de 6 o más dígitos, `sb_secret_`, JWT, clave privada | Cero coincidencias en las líneas agregadas |
| `git diff --check 65404aa HEAD` | Solo espacios finales en los informes de revisión (saltos de línea de Markdown); nada en código |

Ninguna suite se corrió contra producción. No leí `.env.local`.

## 6. Requisitos por etapa

### Para abrir el PR (fase A)

| Requisito (plan, «Requisitos por etapa») | Estado |
|---|---|
| C-01 a C-35, C-38 a C-42 y C-44 a C-46 en verde por sus casos T | Cumplido (sección 3). C-44 verifica la parte de UI; el acta de M03a es de la fase B |
| `verify`, `test:policies`, `test:app` y `db:check:test` en verde, sin omitir `meta-lifecycle` ni `meta-oauth` | Cumplido (sección 5) |
| Preflight real con `preflight: ok` registrado | Cumplido: sesión, paso 11. No lo repetí: lo ejecuta el usuario |
| Documentación del paso 12 aplicada, diff y archivos nuevos revisados (CB-01 a CB-06) | Cumplido (revisión 5 y verificaciones de patrones y migraciones de la sección 5) |
| `implementation-review` APROBABLE sobre el commit | Cumplido: `implementation-review-5` sobre `89a41b1`; `HEAD` solo agrega ese informe |
| `PROJECT_STATE.md` y la sesión consistentes | Cumplido: `PROJECT_STATE.md` contiene solo estado (`VERIFICADO — PENDIENTE DE APROBACIÓN`, fase B pendiente, `G-VR01` no aprobado, sin conteos ni decisiones); las cifras de la sesión (589/589, 482, 57 pasadas y 7 omitidas) coinciden con mis corridas |

### Para el merge

| Requisito | Estado |
|---|---|
| Este QA: LISTO PARA PR sobre el mismo commit | Cumplido con este informe |
| Revisión de Codex sin bloqueantes | **Pendiente** (el usuario, después del push y del PR) |
| CI en verde (`verify.yml` corre `npm run verify`) | **Pendiente** (el usuario; local en verde) |

### Para cerrar el gate `G-VR01` (fase B, después del merge)

El plan ubica estas acciones después del merge y el despliegue, porque necesitan la aplicación en producción; no se postergan verificaciones previas al gate.

| Acción | Verificación | Responsable |
|---|---|---|
| Paso 14 (a): comprobar que **D** (commit de `main` tras el merge) es idéntico a **R** fuera de `docs` y `.claude` | `git diff --stat R D -- . ':(exclude)docs' ':(exclude).claude'` sin salida | Asistente en `/microfase M16.2` |
| Paso 14 (b): despliegue de producción de **D** en `Ready` | Hash corto registrado | Usuario |
| Paso 14 (c): `M03a` cerrada, `G-ACTA-META` aprobado, P-04 declarado, acta con el límite de copias (C-44) | `PROJECT_STATE.md` y acta | Usuario |
| Paso 14 (d): VD-01 (`Origin` coincidente, `303` hacia Meta, sin conceder acceso) | Tres datos cerrados en la sesión | Usuario |
| Paso 15: alta del dueño y cierre del registro | Alta nueva rechazada después del cierre | Usuario y dueño |
| Paso 16: VR-01 (cancelar, autorizar, cancelar con revocación `ok`, volver a autorizar, elegir y confirmar) | Líneas `meta_ciclo`, filas y campos del probe, H-01 a H-03 resueltas (C-36, C-37, T-44, T-45) | Usuario y dueño |
| Paso 17: cierre sin credencial pendiente y PR de cierre con tres archivos | `git diff --name-only main...mf/M16.2` limitado a los tres | Asistente y usuario |
| Aprobación explícita de `G-VR01` | Registro en `PROJECT_STATE.md` | Usuario |
| `db:push` al proyecto `app` | No aplica: no hay migraciones | — |

## 7. Hallazgos

| ID | Severidad | Criterio | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| Q-01 | baja | C-02, C-03 (nombre de la cuenta) | Un nombre de cuenta compuesto solo de espacios llega a la pantalla como cadena vacía, porque `accounts.ts` hace `trim()` y solo asigna `null` si el valor no es cadena. La tarjeta usa `account.name ?? 'Cuenta sin nombre'`, así que la opción se ve como « (…1001) · USD · UTC», sin nombre y sin el texto de reemplazo | Q-A6: `expected '' to be null` | En `accounts.ts`, `name: trimmed === '' ? null : trimmed`. Convertir Q-A6 en prueba permanente en `tests/unit/meta-lifecycle.test.ts` (T-03) |
| Q-02 | baja | C-03, C-26 (estado `pendiente`) | Si el dueño autoriza pero no delegó ninguna cuenta publicitaria (lista vacía válida, sin descartadas ni error), la tarjeta pendiente muestra solo «Cancelar conexión», sin radio, sin botón de confirmar y sin texto que explique por qué. La spec (§15) no define este estado; es un caso realista del primer recorrido con el dueño (H-01) | Q-U3: texto renderizado `Meta AdsCampañas de Facebooke InstagramNo conectadoCancelar conexión` | Agregar un texto fijo para `accounts.length === 0 && !listError && discarded === 0`, p. ej. «Meta no informó cuentas publicitarias para Praxa. Cancelá la conexión y revisá qué cuentas compartiste». Requiere decisión de texto del usuario. Convertir Q-U3 en prueba permanente en `integraciones-meta-tarjeta.test.tsx` |
| Q-03 | informativa | Evidencia (CB-05) | La fila del paso 13 de la sesión conserva las cifras de la corrida inicial (579/579, 503/503) y el texto «E1 debe repetirse» describe un paso ya hecho (R-01 de `implementation-review-5` ya lo señala) | Lectura de `sesiones/M16.2.md` | Opcional: marcar «(corrida inicial)» y actualizar el estado de E1 en la próxima edición de la sesión |

Ninguno bloquea el PR: Q-01 y Q-02 no incumplen un criterio escrito de la spec ni afectan seguridad, aislamiento ni datos. Ambos deben registrarse en `HALLAZGOS.md` con ID estable y microfase asignada (por ejemplo, un ajuste de M16.2 en la fase B si el usuario lo decide, antes del VR-01, o `M16c`). Cualquier cambio de código que los corrija obliga a repetir `/implementation-review` y `/qa-review` sobre el commit nuevo. Esta revisión no modificó `HALLAZGOS.md`.

Limitaciones: el caso de igualdad exacta de `pending_expires_at` con la hora actual no se ejercitó. La zona válida para `Intl` pero ausente de `pg_timezone_names` no se puede fabricar con certeza (spec §16) y queda cubierta solo con `worker_api` simulado. Los recorridos que dependen del dueño y de Meta real (VR-01, VD-01) son de la fase B.

## 8. Guion manual (para la fase B, sin datos reales)

1. **VD-01.** Con la cuenta sintética, en `/app/integraciones` con Network abierta y el registro preservado, pulsar «Conectar». Esperado: `POST /api/integraciones/meta/iniciar`, `Origin` igual al de la página, `303` con `Location` en el host de Meta. Detenerse en Meta sin conceder acceso. Registrar solo `Origin coincidente: sí/no`, el estado HTTP y `host de redirección: Meta/sin redirección`.
2. **Tarjeta vacía (Q-02).** Si el dueño autoriza sin delegar cuentas, anotar qué ve la tarjeta pendiente (sin capturas con datos).
3. **Revocación real (H-03).** «Cancelar conexión» con una pendiente real. Esperado: `meta=desconectado` y una línea `meta_ciclo revocacion ok`. Capturar solo esa línea de los Runtime Logs, sin `request_id` si se prefiere.
4. **Conexión (VR-01).** Autorizar, elegir la cuenta, «Confirmar cuenta». Esperado: `meta=conectado` y una línea `meta_ciclo prueba ok` con `filas`, `campos`, `paginas`, `llamadas`, `duracion_ms`. No capturar montos, el id completo de la cuenta, nombres ni correos.

## 9. Pendientes del usuario

- Decidir si Q-01 y Q-02 se corrigen antes del PR (implica repetir las revisiones) o se registran y asignan a una microfase posterior.
- Commitear este informe y `pr.md`, hacer push y abrir el PR con `pr.md`; esperar a Codex y a la CI; mergear.
- Fase B: despliegue verificado, `M03a` y `G-ACTA-META`, P-04, VD-01, alta y cierre del registro, VR-01 y aprobación de `G-VR01`.

## 10. Confirmaciones finales

- `git rev-parse HEAD` sigue en `5a4c49cf0530b4c7517de5c966c10af262db2544`.
- Worktree temporal eliminado; `git worktree list` muestra solo el directorio principal; `tests/app/__qa__/` borrado.
- El comando de árbol limpio del paso 1 no devuelve nada.
- No se modificó ningún archivo del producto. Se escribieron solo este informe y `pr.md`.
