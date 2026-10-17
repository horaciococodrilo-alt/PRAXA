import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NextRequest } from 'next/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TenantContext } from '@/modules/tenant/context';
import type { IntegrationConnectionRecord } from '@/modules/integrations/contract';

/**
 * M16.1: OAuth con Meta, probado contra Meta simulada (casos T-01 a T-22 y T-40 a T-42 de
 * la spec de la microfase).
 *
 * Todos los valores son sintéticos y de menos de 20 caracteres, para que ni escritos
 * después de `?access_token=` o `code=` coincidan con `no-secrets-in-tree` (CA-12). Las
 * URLs se arman interpolando las constantes.
 */

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const APP_ID = '1234567';
const CONFIG_ID = '7654321';
const SECRET = 'secreto-sint';
const CODE = 'codigo-sint';
const TOKEN = 'token-sint-meta';
const BUSINESS = 'negocio_sintetico';
const ORIGIN = 'https://praxa.test';
const REDIRECT_URI = `${ORIGIN}/api/integraciones/meta/callback`;
const GRAPH = 'https://graph.facebook.com';
const COOKIE = '__Host-praxa_oauth_binding';
const NOW = new Date('2026-10-14T12:00:00.000Z');

const CTX: TenantContext = Object.freeze({
  user_id: '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d',
  company_id: '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f',
  role: 'owner',
  request_id: '7c6b5a49-3827-4165-a4b3-c2d1e0f9a8b7',
});
const CONNECTION_ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';

const api = await import('@/modules/integrations/meta/api');
const errors = await import('@/modules/integrations/meta/errors');
const client = await import('@/modules/integrations/meta/client');
const tokens = await import('@/modules/integrations/meta/tokens');
const oauth = await import('@/modules/integrations/meta/oauth');
const outcomes = await import('@/modules/integrations/meta/outcomes');
const { WorkerApiError } = await import('@/modules/integrations/db/worker-api');
const { parseCredentialKeyring } = await import('@/modules/integrations/crypto/keyring');
const { SecretValue } = await import('@/modules/integrations/crypto/seal');
const { sealCredential } = await import('@/modules/integrations/crypto/seal');
const { redactErrorMessage, redactedErrorMessageSchema, integrationErrorClassSchema } = await import(
  '@/modules/integrations/contract'
);
const { UnauthorizedError } = await import('@/modules/identity/session');
const { NoCompanyError } = await import('@/modules/company/service');

type MetaFetch = import('@/modules/integrations/meta/client').MetaFetch;
type MetaOAuthDeps = import('@/modules/integrations/meta/oauth').MetaOAuthDeps;
type WorkerApi = import('@/modules/integrations/db/worker-api').WorkerApi;
type LiveConnection = import('@/modules/integrations/repository/connections').LiveConnection;

const CONFIG = api.readMetaOAuthConfig({
  META_APP_ID: APP_ID,
  META_APP_SECRET: SECRET,
  META_REDIRECT_URI: REDIRECT_URI,
  META_CONFIG_ID: CONFIG_ID,
} as unknown as NodeJS.ProcessEnv);

// Llavero sintético creado en la ejecución: ninguna clave queda en el árbol.
const KEYRING = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const state43 = () => randomBytes(32).toString('base64url');

// ---------------------------------------------------------------------------
// Meta simulada y worker_api simulado
// ---------------------------------------------------------------------------

/** Registro único de llamadas, para fijar el orden entre la base y Meta (T-16). */
let events: string[] = [];

type MetaCall = { method: string; url: URL; headers: Headers; body: string | null };
type Responder = (call: MetaCall) => Response | Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const DEFAULT_RESPONSES: Record<string, Responder> = {
  '/v26.0/oauth/access_token': () => json({ access_token: TOKEN, token_type: 'bearer' }),
  '/v26.0/debug_token': () =>
    json({
      data: {
        is_valid: true,
        app_id: APP_ID,
        type: 'SYSTEM_USER',
        scopes: ['ads_read', 'business_management', 'ads_read'],
        expires_at: 0,
      },
    }),
  '/v26.0/me': () => json({ id: '9876543', client_business_id: BUSINESS }),
  '/v26.0/9876543/assigned_ad_accounts': () => json({ data: [
    { id: 'act_1001', name: 'Cuenta sintética', currency: 'USD', timezone_name: 'UTC' },
  ] }),
  '/v26.0/oauth/revoke': () => json({ success: true }),
};

function fakeMeta(overrides: Record<string, Responder> = {}) {
  const calls: MetaCall[] = [];
  const violations: string[] = [];
  const responses = { ...DEFAULT_RESPONSES, ...overrides };
  const fetch: MetaFetch = async (input, init) => {
    const url = new URL(input);
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? init.body : init.body == null ? null : String(init.body);
    const call = { method, url, headers: new Headers(init.headers), body };
    calls.push(call);
    events.push(`meta:${url.pathname}`);
    if (url.pathname === '/v26.0/' && method === 'POST') {
      const form = new URLSearchParams(body ?? '');
      const batch = JSON.parse(form.get('batch') ?? 'null');
      if (!Array.isArray(batch) || batch.length !== 1 || batch[0]?.method !== 'GET') {
        return json({ error: { code: 100 } }, 400);
      }
      const innerUrl = new URL(batch[0].relative_url, `${GRAPH}/`);
      const inner = responses[`/v26.0/${innerUrl.pathname.replace(/^\//, '')}`];
      if (!inner) return json([{ code: 404, body: JSON.stringify({ error: { code: 803 } }) }]);
      const response = await inner({ ...call, method: 'GET', url: innerUrl, body: null });
      return json([{ code: response.status, body: await response.text() }]);
    }
    if (method === 'GET' && /\/(oauth\/access_token|debug_token)$/.test(url.pathname)) {
      violations.push(`GET ${url.pathname}`);
    }
    const responder = responses[url.pathname];
    if (!responder) return json({ error: { code: 803 } }, 404);
    return responder(call);
  };
  return { fetch, calls, violations, http: client.createMetaHttpClient({ fetch }) };
}

type WorkerHandler = (args: readonly unknown[]) => unknown[] | Promise<unknown[]>;

function consumedRow(purpose: 'initial' | 'reauth' = 'initial', generation: number | null = null) {
  return {
    attempt_id: randomUUID(),
    purpose,
    expected_connection_id: purpose === 'reauth' ? CONNECTION_ID : null,
    expected_generation: purpose === 'reauth' ? generation : null,
    return_path: '/app/integraciones',
  };
}

function fakeWorker(overrides: Partial<Record<string, WorkerHandler>> = {}) {
  const calls: Array<{ fn: string; args: readonly unknown[] }> = [];
  const handlers: Record<string, WorkerHandler> = {
    create_oauth_attempt: (args) => [
      {
        attempt_id: randomUUID(),
        purpose: args[2],
        expected_connection_id: args[7] ?? null,
        expected_generation: args[2] === 'reauth' ? 3 : null,
        created_at: new Date(NOW),
        expires_at: new Date(String(args[6])),
      },
    ],
    consume_oauth_attempt: () => [consumedRow()],
    list_pending_purges: () => [],
    create_pending_connection: (args) => [
      {
        connection_id: args[2],
        status: 'pending_selection',
        pending_expires_at: new Date(NOW.getTime() + 30 * 60_000),
        credential_generation: 0,
      },
    ],
    ...overrides,
  };
  const workerApi: WorkerApi = {
    call: (async (fn: string, args: readonly unknown[]) => {
      calls.push({ fn, args });
      events.push(`db:${fn}`);
      const handler = handlers[fn];
      if (!handler) throw new Error(`worker_api simulado: ${fn} no esperada`);
      return handler(args);
    }) as WorkerApi['call'],
  };
  return { workerApi, calls };
}

let logs: unknown[] = [];

function deps(
  meta: ReturnType<typeof fakeMeta>,
  worker: ReturnType<typeof fakeWorker>,
  over: Partial<MetaOAuthDeps> = {},
): Partial<MetaOAuthDeps> {
  return {
    tenant: async () => CTX,
    config: () => CONFIG,
    http: meta.http,
    workerApi: worker.workerApi,
    keyring: KEYRING,
    readLiveConnection: async () => null,
    now: () => new Date(NOW),
    log: (event) => logs.push(event),
    ...over,
  };
}

function startRequest(origin: string | null = ORIGIN) {
  const headers = new Headers();
  if (origin !== null) headers.set('origin', origin);
  return new NextRequest(`${ORIGIN}/api/integraciones/meta/iniciar`, { method: 'POST', headers });
}

function callbackRequest(params: Record<string, string>, nonce?: string) {
  const url = new URL(REDIRECT_URI);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const headers = new Headers();
  if (nonce !== undefined) headers.set('cookie', `${COOKIE}=${nonce}`);
  return new NextRequest(url, { headers });
}

const RESULT = (outcome: string) => `${ORIGIN}/app/integraciones?meta=${outcome}`;
const LOGIN = `${ORIGIN}/login?next=%2Fapp%2Fintegraciones`;

/** C-12: redirección limpia, sin caché ni referrer, y cookie de vinculación borrada. */
function expectCleanCallback(response: Response, location: string) {
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe(location);
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(response.headers.get('cache-control')).toBe('no-store');
  const cookie = response.headers.get('set-cookie') ?? '';
  expect(cookie).toContain(`${COOKIE}=;`);
  expect(cookie).toMatch(/Max-Age=0/i);
  const target = new URL(location);
  for (const name of ['code', 'state', 'error', 'error_reason']) expect(target.searchParams.has(name)).toBe(false);
}

beforeEach(() => {
  events = [];
  logs = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Recorrido de src/
// ---------------------------------------------------------------------------

const projectRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..');
let sources: Map<string, string>;

async function collect(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return collect(full);
      return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) ? [full] : [];
    }),
  );
  return nested.flat();
}

beforeAll(async () => {
  const files = await collect(join(projectRoot, 'src'));
  sources = new Map(
    await Promise.all(
      files.map(async (file) => [relative(projectRoot, file).replaceAll('\\', '/'), await readFile(file, 'utf8')] as const),
    ),
  );
});

const filesWhere = (matches: (content: string) => boolean) =>
  [...sources].filter(([, content]) => matches(content)).map(([file]) => file).sort();

const startsWithServerOnly = (content: string) =>
  content.replace(/^\s*(?:(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*)(?:\r?\n|\s*))*/, '').trimStart().startsWith("import 'server-only';");

// ---------------------------------------------------------------------------
// api.ts
// ---------------------------------------------------------------------------

describe('M16.1-T-01: versión única de la Graph API', () => {
  it('v26.0 aparece solo en meta/api.ts y las URLs la llevan', () => {
    expect(filesWhere((content) => content.includes('v26.0'))).toEqual(['src/modules/integrations/meta/api.ts']);
    expect(api.GRAPH_API_VERSION).toBe('v26.0');
    expect(api.graphUrl('me').toString()).toBe(`${GRAPH}/v26.0/me`);
    expect(api.dialogUrl({}).toString()).toBe('https://www.facebook.com/v26.0/dialog/oauth');
  });
});

describe('M16.1-T-02: URL del diálogo', () => {
  it('lleva exactamente los parámetros esperados y ningún scope', () => {
    const state = state43();
    const url = oauth.buildAuthorizationUrl(CONFIG, state);
    expect(url.origin).toBe('https://www.facebook.com');
    expect(url.pathname).toBe('/v26.0/dialog/oauth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: APP_ID,
      redirect_uri: REDIRECT_URI,
      state,
      response_type: 'code',
      config_id: CONFIG_ID,
      override_default_response_type: 'true',
    });
    expect([...url.searchParams.keys()]).toHaveLength(6);
    expect(url.searchParams.has('scope')).toBe(false);
  });
});

describe('M16.1-T-03: configuración de Meta', () => {
  const valid = {
    META_APP_ID: APP_ID,
    META_APP_SECRET: SECRET,
    META_REDIRECT_URI: REDIRECT_URI,
    META_CONFIG_ID: CONFIG_ID,
  };
  const read = (env: Record<string, string | undefined>) => api.readMetaOAuthConfig(env as NodeJS.ProcessEnv);
  const failure = (env: Record<string, string | undefined>) => {
    try {
      read(env);
    } catch (error) {
      return error as InstanceType<typeof api.MetaConfigError>;
    }
    throw new Error('se esperaba MetaConfigError');
  };

  it('lee una configuración válida y envuelve el secreto', () => {
    const config = read(valid);
    expect(config.appId).toBe(APP_ID);
    expect(config.configId).toBe(CONFIG_ID);
    expect(config.redirectUri).toBe(REDIRECT_URI);
    expect(config.appSecret).toBeInstanceOf(SecretValue);
    expect(config.appSecret.reveal()).toBe(SECRET);
    expect(JSON.stringify(config)).not.toContain(SECRET);
  });

  it.each(['META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI', 'META_CONFIG_ID'])(
    'sin %s falla nombrando la variable',
    (name) => {
      const error = failure({ ...valid, [name]: undefined });
      expect(error).toBeInstanceOf(api.MetaConfigError);
      expect(error.message).toContain(name);
      expect(error.missing).toEqual([name]);
      for (const value of Object.values(valid)) expect(error.message).not.toContain(value);
    },
  );

  it.each([
    ['META_APP_ID', 'valor-invalido-x'],
    ['META_CONFIG_ID', 'valor-invalido-x'],
    ['META_REDIRECT_URI', `${REDIRECT_URI}?x=1`],
    ['META_REDIRECT_URI', `${REDIRECT_URI}#f`],
    ['META_REDIRECT_URI', `${ORIGIN}/api/otra/ruta`],
    ['META_REDIRECT_URI', 'http://praxa.test/api/integraciones/meta/callback'],
    ['META_REDIRECT_URI', 'https://usuario:clave@praxa.test/api/integraciones/meta/callback'],
    ['META_REDIRECT_URI', '/api/integraciones/meta/callback'],
  ])('rechaza %s inválida sin mostrar el valor (%s)', (name, value) => {
    const error = failure({ ...valid, [name]: value });
    expect(error).toBeInstanceOf(api.MetaConfigError);
    expect(error.message).toContain(name);
    expect(error.message).not.toContain(value);
    expect(error.message).not.toContain(SECRET);
  });

  it('acepta http solo para localhost y 127.0.0.1', () => {
    for (const uri of [
      'http://localhost:3000/api/integraciones/meta/callback',
      'http://127.0.0.1:3000/api/integraciones/meta/callback',
    ]) {
      expect(read({ ...valid, META_REDIRECT_URI: uri }).redirectUri).toBe(uri);
    }
  });
});

describe('M16.1-T-04 y T-41: confinamiento de la configuración', () => {
  it('META_APP_SECRET aparece solo en meta/api.ts y no hay NEXT_PUBLIC_META', () => {
    expect(filesWhere((content) => content.includes('META_APP_SECRET'))).toEqual([
      'src/modules/integrations/meta/api.ts',
    ]);
    expect(filesWhere((content) => content.includes('NEXT_PUBLIC_META'))).toEqual([]);
  });

  it('los seis módulos de servidor empiezan con server-only', () => {
    for (const file of [
      'src/modules/integrations/meta/api.ts',
      'src/modules/integrations/meta/client.ts',
      'src/modules/integrations/meta/oauth.ts',
      'src/modules/integrations/meta/tokens.ts',
      'src/modules/integrations/repository/attempts.ts',
      'src/modules/integrations/repository/connections.ts',
    ]) {
      expect(startsWithServerOnly(sources.get(file) ?? ''), file).toBe(true);
    }
  });

  it('todo archivo que lee una META_* empieza con server-only', () => {
    const readers = filesWhere((content) =>
      ['META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI', 'META_CONFIG_ID'].some((name) => content.includes(name)),
    );
    expect(readers).toEqual(['src/modules/integrations/meta/api.ts']);
    for (const file of readers) expect(startsWithServerOnly(sources.get(file) ?? ''), file).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// errors.ts y client.ts
// ---------------------------------------------------------------------------

const graphError = (code: unknown, subcode?: unknown) => ({
  error: subcode === undefined ? { code } : { code, error_subcode: subcode },
});

describe('M16.1-T-05: clasificación por código de Graph', () => {
  const table: Array<[unknown, unknown, string]> = [
    [190, undefined, 'authentication'],
    [190, 458, 'authentication'],
    [190, 460, 'authentication'],
    [190, 463, 'authentication'],
    [190, 467, 'authentication'],
    [190, 459, 'user_action'],
    [190, 464, 'user_action'],
    [190, 492, 'unknown'],
    [10, undefined, 'permission'],
    [200, undefined, 'permission'],
    [250, undefined, 'permission'],
    [299, undefined, 'permission'],
    [4, undefined, 'rate_limit'],
    [17, undefined, 'rate_limit'],
    [341, undefined, 'rate_limit'],
    [613, undefined, 'rate_limit'],
    [80000, undefined, 'rate_limit'],
    [80003, undefined, 'rate_limit'],
    [80004, undefined, 'rate_limit'],
    [80014, undefined, 'rate_limit'],
    [1, undefined, 'temporary'],
    [2, undefined, 'temporary'],
    [3, undefined, 'own_error'],
    [100, undefined, 'own_error'],
    [3018, undefined, 'own_error'],
    [300, undefined, 'unknown'],
    [999, undefined, 'unknown'],
  ];

  it.each(table)('código %s/%s → %s', (code, subcode, expected) => {
    expect(errors.classifyGraphError(graphError(code, subcode)).errorClass).toBe(expected);
  });

  it('un cuerpo sin error.code es unknown', () => {
    for (const body of [{}, { error: {} }, { error: 'x' }, null, 'texto', { error: { code: '190' } }]) {
      expect(errors.classifyGraphError(body)).toEqual({ errorClass: 'unknown', graphCode: null, graphSubcode: null });
    }
  });

  it.each([200, 403, 500])('el estado HTTP %s no cambia la clase', async (status) => {
    const meta = fakeMeta({ '/v26.0/me': () => json(graphError(190, 460), status) });
    const error = await meta.http.getJson(api.graphUrl('me')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(errors.MetaApiError);
    expect((error as InstanceType<typeof errors.MetaApiError>).errorClass).toBe('authentication');
  });

  it('nunca asigna asset_access', () => {
    for (const [code, subcode] of table) {
      expect(errors.classifyGraphError(graphError(code, subcode)).errorClass).not.toBe('asset_access');
    }
    for (let code = 0; code < 4000; code += 1) {
      expect(errors.classifyGraphError(graphError(code)).errorClass).not.toBe('asset_access');
    }
  });
});

describe('M16.1-T-06: transporte y respuestas ilegibles', () => {
  const callMe = async (fetch: MetaFetch, timeoutMs?: number) =>
    (await client
      .createMetaHttpClient({ fetch, timeoutMs })
      .getJson(api.graphUrl('me', { fields: 'id' }))
      .catch((e: unknown) => e)) as InstanceType<typeof errors.MetaApiError>;

  it('un fetch que rechaza es transport', async () => {
    const error = await callMe(async () => {
      throw new TypeError('fetch failed');
    });
    expect(error).toBeInstanceOf(errors.MetaApiError);
    expect(error.errorClass).toBe('transport');
  });

  it('un timeout es transport', async () => {
    const slow: MetaFetch = (_input, init) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(json({ id: '1' })), 2_000);
        init.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(init.signal?.reason);
        });
      });
    const error = await callMe(slow, 5);
    expect(error).toBeInstanceOf(errors.MetaApiError);
    expect(error.errorClass).toBe('transport');
  });

  it('un cuerpo no JSON es transport', async () => {
    const error = await callMe(async () => new Response('<html>', { status: 200 }));
    expect(error.errorClass).toBe('transport');
  });

  it('un 500 sin objeto error es unknown', async () => {
    const error = await callMe(async () => json({}, 500));
    expect(error.errorClass).toBe('unknown');
  });

  it('usa redirect: error y cache: no-store', async () => {
    const meta = fakeMeta();
    const seen: RequestInit[] = [];
    const spy: MetaFetch = (input, init) => {
      seen.push(init);
      return meta.fetch(input, init);
    };
    const http = client.createMetaHttpClient({ fetch: spy });
    await http.getJson(api.graphUrl('me', { fields: 'id' }));
    await http.postBatchGetJson('debug_token', { input_token: new SecretValue(TOKEN) }, new SecretValue(SECRET));
    expect(seen).toHaveLength(2);
    for (const init of seen) {
      expect(init.redirect).toBe('error');
      expect(init.cache).toBe('no-store');
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });
});

describe('M16.1-T-07: redacción de errores de Meta', () => {
  const ACCOUNT = 'act_90001';
  const leakyBody = {
    error: {
      code: 190,
      error_subcode: 460,
      message: `Fallo en ${GRAPH}/v26.0/me?access_token=${TOKEN} con code=${CODE}`,
      error_user_msg: `El código ${CODE} no es válido para la app con secreto ${SECRET}; token ${TOKEN}`,
      type: `Bearer ${TOKEN}`,
      fbtrace_id: `${ACCOUNT} ${TOKEN}`,
    },
  };

  function leaks(error: unknown): string[] {
    const e = error as InstanceType<typeof errors.MetaApiError>;
    const views = [e.message, e.redactedMessage, String(e), JSON.stringify(e), JSON.stringify(Object.values(e))];
    return [TOKEN, SECRET, CODE, ACCOUNT].filter((value) => views.some((view) => view.includes(value)));
  }

  it('ningún texto libre de Meta llega al error', async () => {
    const meta = fakeMeta({ '/v26.0/me': () => json(leakyBody, 400) });
    const error = await meta.http.getJson(api.graphUrl('me')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(errors.MetaApiError);
    expect(leaks(error)).toEqual([]);
    const e = error as InstanceType<typeof errors.MetaApiError>;
    expect(e.errorClass).toBe('authentication');
    expect(e.redactedMessage).toBe('Graph 190/460: Meta rechazó la credencial.');
    expect(e.message).toBe(errors.META_FAILURE_TEXTS.authentication);
    expect(redactedErrorMessageSchema.safeParse(e.redactedMessage).success).toBe(true);
    expect(e.cause).toBeUndefined();
  });

  it('un código que es una cadena igual al token da unknown sin código', async () => {
    const meta = fakeMeta({ '/v26.0/me': () => json({ error: { code: TOKEN, message: TOKEN } }, 400) });
    const error = (await meta.http.getJson(api.graphUrl('me')).catch((e: unknown) => e)) as InstanceType<
      typeof errors.MetaApiError
    >;
    expect(error.errorClass).toBe('unknown');
    expect(error.graphCode).toBeNull();
    expect(error.redactedMessage).toBe(`Graph sin código: ${errors.META_FAILURE_TEXTS.unknown}`);
    expect(leaks(error)).toEqual([]);
  });

  it('la plantilla usa solo código y subcódigo', () => {
    const failure = errors.classifyGraphError(graphError(100));
    const error = new errors.MetaApiError(failure);
    expect(error.redactedMessage).toBe(`Graph 100: ${errors.META_FAILURE_TEXTS.own_error}`);
  });

  it('cada texto fijo es invariante bajo la redacción y hay uno por clase', () => {
    expect(Object.keys(errors.META_FAILURE_TEXTS).sort()).toEqual([...integrationErrorClassSchema.options].sort());
    for (const text of Object.values(errors.META_FAILURE_TEXTS)) expect(redactErrorMessage(text)).toBe(text);
  });

  it('el error de transporte tampoco lleva detalle', () => {
    const error = errors.transportError();
    expect(error.errorClass).toBe('transport');
    expect(error.cause).toBeUndefined();
    expect(error.redactedMessage).toBe(`Graph sin código: ${errors.META_FAILURE_TEXTS.transport}`);
  });

  it('el canje envía client_secret solo a graph.facebook.com', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker();
    const { state, nonce } = await startedAttempt(meta, worker);
    await oauth.handleMetaCallback(callbackRequest({ state, code: CODE }, nonce), deps(meta, worker));
    const withSecret = meta.calls.filter(
      (call) => (call.body ?? '').includes(SECRET) || call.url.toString().includes(SECRET),
    );
    expect(withSecret.length).toBeGreaterThan(0);
    for (const call of withSecret) expect(call.url.origin).toBe(GRAPH);
  });
});

// ---------------------------------------------------------------------------
// handleMetaStart
// ---------------------------------------------------------------------------

function parseStart(response: Response) {
  const location = new URL(response.headers.get('location') ?? '');
  const cookie = response.headers.get('set-cookie') ?? '';
  const nonce = /__Host-praxa_oauth_binding=([^;]*)/.exec(cookie)?.[1] ?? '';
  return { location, cookie, state: location.searchParams.get('state') ?? '', nonce };
}

/** Inicia un intento con Meta y la base simuladas y devuelve lo que vería el navegador. */
async function startedAttempt(meta: ReturnType<typeof fakeMeta>, worker: ReturnType<typeof fakeWorker>) {
  const response = await oauth.handleMetaStart(startRequest(), deps(meta, worker));
  const parsed = parseStart(response);
  events = [];
  return parsed;
}

describe('M16.1-T-08: inicio sin conexión viva', () => {
  it('crea un intento initial con hashes, retorno, vencimiento y cookie', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker();
    const response = await oauth.handleMetaStart(startRequest(), deps(meta, worker));
    expect(response.status).toBe(303);
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const { location, cookie, state, nonce } = parseStart(response);
    expect(location.origin).toBe('https://www.facebook.com');

    expect(worker.calls.map((call) => call.fn)).toEqual(['list_pending_purges', 'create_oauth_attempt']);
    const [actor, company, purpose, stateHash, bindingHash, returnPath, expiresAt, expected] = worker.calls[1].args;
    expect([actor, company, purpose]).toEqual([CTX.user_id, CTX.company_id, 'initial']);
    expect(stateHash).toBe(sha256(state));
    expect(bindingHash).toBe(sha256(nonce));
    expect(returnPath).toBe('/app/integraciones');
    expect(expected).toBeNull();
    const ttl = Date.parse(String(expiresAt)) - NOW.getTime();
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(540_000);

    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(state).not.toBe(nonce);

    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=540/i);
    expect(cookie).not.toMatch(/Domain=/i);
    expect(meta.calls).toEqual([]);
  });
});

describe('M16.1-T-09: inicio con una conexión activa o por reautorizar', () => {
  it.each(['active', 'needs_reauth'] as const)('con %s crea un intento reauth de esa conexión', async (status) => {
    const meta = fakeMeta();
    const worker = fakeWorker();
    const live: LiveConnection = { id: CONNECTION_ID, status, credentialGeneration: 3 };
    const response = await oauth.handleMetaStart(
      startRequest(),
      deps(meta, worker, { readLiveConnection: async () => live }),
    );
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get('location') ?? '').origin).toBe('https://www.facebook.com');
    expect(worker.calls.map((call) => call.fn)).toEqual(['list_pending_purges', 'create_oauth_attempt']);
    expect(worker.calls[1].args[2]).toBe('reauth');
    expect(worker.calls[1].args[7]).toBe(CONNECTION_ID);
  });
});

describe('M16.1-T-10: inicio con una pendiente', () => {
  it('responde pendiente_vigente sin crear intento ni llamar a nadie', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker();
    const live: LiveConnection = { id: CONNECTION_ID, status: 'pending_selection', credentialGeneration: 0 };
    const response = await oauth.handleMetaStart(
      startRequest(),
      deps(meta, worker, { readLiveConnection: async () => live }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(RESULT('pendiente_vigente'));
    expect(worker.calls.map((call) => call.fn)).toEqual(['list_pending_purges']);
    expect(meta.calls).toEqual([]);
  });
});

describe('M16.1-T-11: barreras del inicio', () => {
  it.each([null, 'https://otro.example'])('Origin %s → 403 sin construir K01', async (origin) => {
    const meta = fakeMeta();
    const worker = fakeWorker();
    const tenant = vi.fn(async () => CTX);
    const response = await oauth.handleMetaStart(startRequest(origin), deps(meta, worker, { tenant }));
    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Solicitud no permitida.');
    expect(tenant).not.toHaveBeenCalled();
    expect(worker.calls).toEqual([]);
  });

  it('sin sesión redirige al login', async () => {
    const worker = fakeWorker();
    const response = await oauth.handleMetaStart(
      startRequest(),
      deps(fakeMeta(), worker, {
        tenant: async () => {
          throw new UnauthorizedError();
        },
      }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(LOGIN);
    expect(worker.calls).toEqual([]);
  });

  it('sin empresa responde sin_empresa', async () => {
    const worker = fakeWorker();
    const response = await oauth.handleMetaStart(
      startRequest(),
      deps(fakeMeta(), worker, {
        tenant: async () => {
          throw new NoCompanyError();
        },
      }),
    );
    expect(response.headers.get('location')).toBe(RESULT('sin_empresa'));
    expect(worker.calls).toEqual([]);
  });

  it('sin configuración responde error', async () => {
    const worker = fakeWorker();
    const response = await oauth.handleMetaStart(
      startRequest(),
      deps(fakeMeta(), worker, {
        config: () => api.readMetaOAuthConfig({} as NodeJS.ProcessEnv),
      }),
    );
    expect(response.headers.get('location')).toBe(RESULT('error'));
    expect(worker.calls).toEqual([]);
  });

  it('una URI de redirección de otro host responde error sin crear intento', async () => {
    const worker = fakeWorker();
    const otherHost = api.readMetaOAuthConfig({
      META_APP_ID: APP_ID,
      META_APP_SECRET: SECRET,
      META_REDIRECT_URI: 'https://otro.praxa.test/api/integraciones/meta/callback',
      META_CONFIG_ID: CONFIG_ID,
    } as unknown as NodeJS.ProcessEnv);
    const response = await oauth.handleMetaStart(startRequest(), deps(fakeMeta(), worker, { config: () => otherHost }));
    expect(response.headers.get('location')).toBe(RESULT('error'));
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(worker.calls).toEqual([]);
    expect(logs).toContainEqual(expect.objectContaining({ etapa: 'configuracion', resultado: 'error' }));
  });

  it('una carrera con una conexión nueva responde conexion_existente', async () => {
    const worker = fakeWorker({
      create_oauth_attempt: () => {
        throw new WorkerApiError('live_connection_exists');
      },
    });
    const response = await oauth.handleMetaStart(startRequest(), deps(fakeMeta(), worker));
    expect(response.headers.get('location')).toBe(RESULT('conexion_existente'));
  });

  it('el route.ts de inicio exporta solo POST', async () => {
    const route = await import('@/app/api/integraciones/meta/iniciar/route');
    expect(typeof route.POST).toBe('function');
    expect('GET' in route).toBe(false);
    const callback = await import('@/app/api/integraciones/meta/callback/route');
    expect(typeof callback.GET).toBe('function');
    expect('POST' in callback).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handleMetaCallback
// ---------------------------------------------------------------------------

describe('M16.1-T-12: callback con datos ausentes o mal formados', () => {
  const state = state43();
  const nonce = state43();
  const cases: Array<[string, Record<string, string>, string | undefined]> = [
    ['sin state', { code: CODE }, nonce],
    ['con state corto', { state: 'corto', code: CODE }, nonce],
    ['sin cookie', { state, code: CODE }, undefined],
    ['con cookie mal formada', { state, code: CODE }, 'no valida!'],
    ['sin code', { state }, nonce],
  ];

  it.each(cases)('%s → rechazado sin tocar la base ni Meta', async (_name, params, cookie) => {
    const meta = fakeMeta();
    const worker = fakeWorker();
    const response = await oauth.handleMetaCallback(callbackRequest(params, cookie), deps(meta, worker));
    expectCleanCallback(response, RESULT('rechazado'));
    expect(worker.calls).toEqual([]);
    expect(meta.calls).toEqual([]);
  });

  it('sin sesión redirige al login y no consume', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker();
    const response = await oauth.handleMetaCallback(
      callbackRequest({ state, code: CODE }, nonce),
      deps(meta, worker, {
        tenant: async () => {
          throw new UnauthorizedError();
        },
      }),
    );
    expectCleanCallback(response, LOGIN);
    expect(worker.calls).toEqual([]);
    expect(meta.calls).toEqual([]);
  });

  it('sin empresa responde sin_empresa', async () => {
    const worker = fakeWorker();
    const response = await oauth.handleMetaCallback(
      callbackRequest({ state, code: CODE }, nonce),
      deps(fakeMeta(), worker, {
        tenant: async () => {
          throw new NoCompanyError();
        },
      }),
    );
    expectCleanCallback(response, RESULT('sin_empresa'));
    expect(worker.calls).toEqual([]);
  });
});

describe('M16.1-T-13: intento rechazado por la base', () => {
  it.each(['attempt_rejected', 'not_authorized'] as const)('%s → rechazado sin llamar a Meta', async (code) => {
    const meta = fakeMeta();
    const worker = fakeWorker({
      consume_oauth_attempt: () => {
        throw new WorkerApiError(code);
      },
    });
    const response = await oauth.handleMetaCallback(
      callbackRequest({ state: state43(), code: CODE }, state43()),
      deps(meta, worker),
    );
    expectCleanCallback(response, RESULT('rechazado'));
    expect(worker.calls.map((call) => call.fn)).toEqual(['consume_oauth_attempt']);
    expect(meta.calls).toEqual([]);
  });
});

describe('M16.1-T-14: cancelación en Meta', () => {
  it('con state válido consume y responde cancelado', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker();
    const state = state43();
    const nonce = state43();
    const response = await oauth.handleMetaCallback(
      callbackRequest({ error: 'access_denied', error_reason: 'user_denied', state }, nonce),
      deps(meta, worker),
    );
    expectCleanCallback(response, RESULT('cancelado'));
    expect(worker.calls.map((call) => call.fn)).toEqual(['consume_oauth_attempt']);
    expect(worker.calls[0].args.slice(2)).toEqual([sha256(state), sha256(nonce)]);
    expect(meta.calls).toEqual([]);
  });

  it('sin state responde cancelado sin consumir', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker();
    const response = await oauth.handleMetaCallback(
      callbackRequest({ error: 'access_denied', error_reason: 'user_denied' }, state43()),
      deps(meta, worker),
    );
    expectCleanCallback(response, RESULT('cancelado'));
    expect(worker.calls).toEqual([]);
    expect(meta.calls).toEqual([]);
  });

  it('si el consumo falla igual responde cancelado', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker({
      consume_oauth_attempt: () => {
        throw new WorkerApiError('attempt_rejected');
      },
    });
    const response = await oauth.handleMetaCallback(
      callbackRequest({ error: 'access_denied', state: state43() }, state43()),
      deps(meta, worker),
    );
    expectCleanCallback(response, RESULT('cancelado'));
    expect(meta.calls).toEqual([]);
  });
});

describe('M16.1-T-15: callback initial exitoso sin datos sensibles a la vista', () => {
  it('redirige a pendiente sin token, código, state ni nonce en la respuesta ni en los logs', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker();
    const { state, nonce } = await startedAttempt(meta, worker);
    const captured: string[] = [];
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        captured.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
      });
    }
    // Sin `log` inyectado: corre el registro por defecto, que escribe en consola.
    const withoutLog = { ...deps(meta, worker), log: undefined };
    const response = await oauth.handleMetaCallback(callbackRequest({ state, code: CODE }, nonce), withoutLog);
    expectCleanCallback(response, RESULT('pendiente'));
    const visible = [
      ...[...response.headers.entries()].map(([name, value]) => `${name}: ${value}`),
      await response.text(),
      ...captured,
    ].join('\n');
    for (const secret of [TOKEN, CODE, state, nonce, SECRET, sha256(state), sha256(nonce), BUSINESS]) {
      expect(visible).not.toContain(secret);
    }
    expect(captured.length).toBeGreaterThan(0);
    for (const line of captured) {
      const event = JSON.parse(line) as Record<string, unknown>;
      expect(Object.keys(event).every((key) => ['evento', 'etapa', 'resultado', 'clase', 'request_id'].includes(key))).toBe(
        true,
      );
      expect(event.evento).toBe('meta_oauth');
    }
  });
});

describe('M16.1-T-16: orden de llamadas del camino initial', () => {
  it('consume, canje, debug_token, /me y después la pendiente', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker();
    const { state, nonce } = await startedAttempt(meta, worker);
    const response = await oauth.handleMetaCallback(callbackRequest({ state, code: CODE }, nonce), deps(meta, worker));
    expect(response.headers.get('location')).toBe(RESULT('pendiente'));
    expect(events).toEqual([
      'db:consume_oauth_attempt',
      'meta:/v26.0/oauth/access_token',
      'meta:/v26.0/',
      'meta:/v26.0/me',
      'db:create_pending_connection',
    ]);
  });

  it('si el consumo falla no sigue nada', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker({
      consume_oauth_attempt: () => {
        throw new WorkerApiError('attempt_rejected');
      },
    });
    await oauth.handleMetaCallback(callbackRequest({ state: state43(), code: CODE }, state43()), deps(meta, worker));
    expect(events).toEqual(['db:consume_oauth_attempt']);
  });
});

async function runCallback(meta: ReturnType<typeof fakeMeta>, worker: ReturnType<typeof fakeWorker>, over = {}) {
  const response = await oauth.handleMetaCallback(
    callbackRequest({ state: state43(), code: CODE }, state43()),
    deps(meta, worker, over),
  );
  expectCleanCallback(response, response.headers.get('location') ?? '');
  return response.headers.get('location');
}

const debugToken = (data: Record<string, unknown>) => () =>
  json({
    data: { is_valid: true, app_id: APP_ID, type: 'SYSTEM_USER', scopes: ['ads_read'], expires_at: 0, ...data },
  });

describe('M16.1-T-17: token rechazado', () => {
  it('sin ads_read → permiso_faltante', async () => {
    const worker = fakeWorker();
    const location = await runCallback(
      fakeMeta({ '/v26.0/debug_token': debugToken({ scopes: ['business_management'] }) }),
      worker,
    );
    expect(location).toBe(RESULT('permiso_faltante'));
    expect(worker.calls.map((call) => call.fn)).not.toContain('create_pending_connection');
  });

  it.each([
    ['is_valid falso', { '/v26.0/debug_token': debugToken({ is_valid: false }) }],
    ['otra app', { '/v26.0/debug_token': debugToken({ app_id: '7777777' }) }],
    ['tipo USER', { '/v26.0/debug_token': debugToken({ type: 'USER' }) }],
    ['tipo ausente', { '/v26.0/debug_token': debugToken({ type: undefined }) }],
    ['debug_token sin data', { '/v26.0/debug_token': () => json({}) }],
    ['/me sin client_business_id', { '/v26.0/me': () => json({ id: '9876543' }) }],
    ['/me con client_business_id inválido', { '/v26.0/me': () => json({ client_business_id: 'no válido!' }) }],
    ['/me con cuerpo null', { '/v26.0/me': () => json(null) }],
  ] as Array<[string, Record<string, Responder>]>)('%s → token_no_valido', async (_name, overrides) => {
    const worker = fakeWorker();
    const location = await runCallback(fakeMeta(overrides), worker);
    expect(location).toBe(RESULT('token_no_valido'));
    expect(worker.calls.map((call) => call.fn)).not.toContain('create_pending_connection');
  });
});

describe('M16.1-T-18: inspección del token', () => {
  const inspect = (data: Record<string, unknown>) =>
    tokens.inspectToken(new SecretValue(TOKEN), {
      config: CONFIG,
      http: {
        getJson: async () => {
          throw new Error('no se espera GET');
        },
        postBatchGetJson: async () => ({
          data: { is_valid: true, app_id: APP_ID, type: 'SYSTEM_USER', scopes: ['ads_read'], ...data },
        }),
        postFormJson: async () => { throw new Error('no se espera POST directo'); },
      },
    });

  it.each([
    ['0', 0],
    ['ausente', undefined],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['una cadena', '1893456000'],
    ['1e20', 1e20],
    ['negativo', -5],
    ['fuera del rango ISO', 253402300800],
  ])('expires_at %s → null sin lanzar', async (_name, value) => {
    const validated = await inspect({ expires_at: value });
    expect(validated.expiresAt).toBeNull();
  });

  it('un epoch futuro da el ISO exacto', async () => {
    const validated = await inspect({ expires_at: 1893456000 });
    expect(validated.expiresAt).toBe('2030-01-01T00:00:00.000Z');
  });

  it('traduce tipo, app y permisos', async () => {
    const validated = await inspect({ scopes: ['ads_read', 'ads_read', 'Mal Formado', 'business_management'] });
    expect(validated.tokenType).toBe('system_user');
    expect(validated.issuedForAppId).toBe(APP_ID);
    expect(validated.grantedScopes).toEqual(['ads_read', 'business_management']);
  });

  it('envía input_token y el token de app solo en el cuerpo', async () => {
    const meta = fakeMeta();
    await tokens.inspectToken(new SecretValue(TOKEN), { config: CONFIG, http: meta.http });
    expect(meta.calls).toHaveLength(1);
    const [call] = meta.calls;
    expect(call.method).toBe('POST');
    expect(call.url.search).toBe('');
    const form = new URLSearchParams(call.body ?? '');
    expect(form.get('access_token')).toBe(`${APP_ID}|${SECRET}`);
    const batch = JSON.parse(form.get('batch') ?? 'null');
    expect(batch).toHaveLength(1);
    expect(batch[0].method).toBe('GET');
    const relative = new URL(batch[0].relative_url, `${GRAPH}/`);
    expect(relative.pathname).toBe('/debug_token');
    expect(relative.searchParams.get('input_token')).toBe(TOKEN);
  });
});

describe('M16.1-T-19: fallos del canje', () => {
  it.each([
    ['error 100', () => json(graphError(100), 400), 'rechazado'],
    ['error 190', () => json(graphError(190), 400), 'rechazado'],
    ['error de red', () => Promise.reject(new TypeError('fetch failed')), 'meta_no_disponible'],
    ['error 2', () => json(graphError(2), 500), 'meta_no_disponible'],
    ['2xx sin access_token', () => json({ token_type: 'bearer' }), 'meta_no_disponible'],
    ['access_token vacío', () => json({ access_token: '' }), 'meta_no_disponible'],
    ['access_token no string', () => json({ access_token: 12345 }), 'meta_no_disponible'],
  ] as Array<[string, Responder, string]>)('%s → %s', async (_name, responder, outcome) => {
    const meta = fakeMeta({ '/v26.0/oauth/access_token': responder });
    const worker = fakeWorker();
    const location = await runCallback(meta, worker);
    expect(location).toBe(RESULT(outcome));
    expect(meta.calls.map((call) => call.url.pathname)).toEqual(['/v26.0/oauth/access_token']);
    expect(worker.calls.map((call) => call.fn)).toEqual(['consume_oauth_attempt']);
  });

  it('registra la clase del fallo', async () => {
    const meta = fakeMeta({ '/v26.0/oauth/access_token': () => json(graphError(2), 500) });
    await runCallback(meta, fakeWorker());
    expect(logs).toContainEqual(expect.objectContaining({ etapa: 'canje', resultado: 'meta_no_disponible', clase: 'temporary' }));
  });
});

describe('M16.1-T-20: reintento de la pendiente', () => {
  it('un fallo de transporte se reintenta una vez con los mismos argumentos', async () => {
    let attempts = 0;
    const worker = fakeWorker({
      create_pending_connection: (args) => {
        attempts += 1;
        if (attempts === 1) throw new WorkerApiError('unavailable', 'transport');
        return [
          {
            connection_id: args[2],
            status: 'pending_selection',
            pending_expires_at: new Date(NOW.getTime() + 30 * 60_000),
            credential_generation: 0,
          },
        ];
      },
    });
    const location = await runCallback(fakeMeta(), worker);
    expect(location).toBe(RESULT('pendiente'));
    const creates = worker.calls.filter((call) => call.fn === 'create_pending_connection');
    expect(creates).toHaveLength(2);
    expect(creates[1].args).toEqual(creates[0].args);
  });

  it('un timeout también se reintenta una vez', async () => {
    let attempts = 0;
    const worker = fakeWorker({
      create_pending_connection: (args) => {
        attempts += 1;
        if (attempts === 1) throw new WorkerApiError('unavailable', 'timeout');
        return [
          {
            connection_id: args[2],
            status: 'pending_selection',
            pending_expires_at: new Date(NOW.getTime() + 30 * 60_000),
            credential_generation: 0,
          },
        ];
      },
    });
    expect(await runCallback(fakeMeta(), worker)).toBe(RESULT('pendiente'));
  });

  it('dos fallos seguidos terminan en error', async () => {
    const worker = fakeWorker({
      create_pending_connection: () => {
        throw new WorkerApiError('unavailable', 'transport');
      },
    });
    expect(await runCallback(fakeMeta(), worker)).toBe(RESULT('error'));
    expect(worker.calls.filter((call) => call.fn === 'create_pending_connection')).toHaveLength(2);
  });

  it('PX003 da conexion_existente sin reintento', async () => {
    const worker = fakeWorker({
      create_pending_connection: () => {
        throw new WorkerApiError('live_connection_exists');
      },
    });
    expect(await runCallback(fakeMeta(), worker)).toBe(RESULT('conexion_existente'));
    expect(worker.calls.filter((call) => call.fn === 'create_pending_connection')).toHaveLength(1);
  });

  it('la credencial guardada lleva tipo, app, permisos y vencimiento', async () => {
    const meta = fakeMeta({ '/v26.0/debug_token': debugToken({ expires_at: 1893456000 }) });
    const worker = fakeWorker();
    await runCallback(meta, worker);
    const create = worker.calls.find((call) => call.fn === 'create_pending_connection');
    expect(create).toBeDefined();
    const args = create!.args;
    expect(args.slice(0, 2)).toEqual([CTX.user_id, CTX.company_id]);
    expect(args[3]).toBe(BUSINESS);
    expect(args[4]).not.toContain(TOKEN);
    expect(args.slice(8)).toEqual(['system_user', APP_ID, ['ads_read'], '2030-01-01T00:00:00.000Z']);
  });
});

describe('M16.1-T-21: camino reauth', () => {
  const reauthWorker = () => fakeWorker({ consume_oauth_attempt: () => [consumedRow('reauth', 2)] });

  it.each([
    ['sin conexión viva', null, 'credencial_cambio'],
    ['con otra conexión', { id: randomUUID(), status: 'active', credentialGeneration: 2 }, 'credencial_cambio'],
    ['con otra generación', { id: CONNECTION_ID, status: 'active', credentialGeneration: 3 }, 'credencial_cambio'],
  ] as Array<[string, LiveConnection | null, string]>)('%s → %s sin canje', async (_name, live, outcome) => {
    const meta = fakeMeta();
    const worker = reauthWorker();
    const connection = live && { id: live.id, status: live.status,
      credential_generation: live.credentialGeneration };
    const location = await runCallback(meta, worker, { readConnection: async () => connection as never });
    expect(location).toBe(RESULT(outcome));
    expect(meta.calls).toEqual([]);
    expect(worker.calls.map((call) => call.fn)).toEqual(['consume_oauth_attempt']);
  });

  it('un fallo al leer la conexión después de consumir se registra en la etapa reauth', async () => {
    const meta = fakeMeta();
    const location = await runCallback(meta, reauthWorker(), {
      readConnection: async () => {
        throw new Error('fallo sintético de lectura');
      },
    });
    expect(location).toBe(RESULT('error'));
    expect(logs).toEqual([expect.objectContaining({ etapa: 'reauth', resultado: 'error' })]);
    expect(meta.calls).toEqual([]);
  });
});

function activeReauthRecord(): IntegrationConnectionRecord {
  return { id: CONNECTION_ID, company_id: CTX.company_id, provider: 'meta',
    client_business_id: BUSINESS, credential_generation: 2, current_sync_run_id: null,
    last_error_class: null, last_error_message: null, created_at: '2026-10-14T00:00:00.000Z',
    updated_at: '2026-10-14T00:00:00.000Z', status: 'active', external_account_id: 'act_1001',
    currency: 'USD', timezone: 'UTC', pending_expires_at: null, purge_requested_at: null };
}

function savedReauthCredential(token: string) {
  return { connection_id: CONNECTION_ID, company_id: CTX.company_id, provider: 'meta',
    status: 'active', credential_generation: 3,
    ...sealCredential(token, { company_id: CTX.company_id, connection_id: CONNECTION_ID, provider: 'meta' }, KEYRING),
    token_type: 'system_user', issued_for_app_id: APP_ID, granted_scopes: ['ads_read'], expires_at: null };
}

function revokeCalls(meta: ReturnType<typeof fakeMeta>): MetaCall[] {
  return meta.calls.filter((call) => {
    if (call.url.pathname !== '/v26.0/' || call.body === null) return false;
    const batch = JSON.parse(new URLSearchParams(call.body).get('batch') ?? '[]');
    return batch[0]?.relative_url?.startsWith('oauth/revoke?') === true;
  });
}

describe('M16.2-T-13: purga al iniciar con Meta inyectada', () => {
  it('revoca una desconectada antes de leer la conexión viva y crear el intento', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker({
      list_pending_purges: () => [{ connection_id: CONNECTION_ID, status: 'disconnected',
        reason: 'disconnect_requested', has_credential: true,
        pending_expires_at: null, purge_requested_at: new Date(NOW) }],
      get_credential: () => [{ connection_id: CONNECTION_ID, company_id: CTX.company_id,
        provider: 'meta', status: 'disconnected', credential_generation: 1,
        ...sealCredential(TOKEN, { company_id: CTX.company_id, connection_id: CONNECTION_ID,
          provider: 'meta' }, KEYRING), token_type: 'system_user', issued_for_app_id: APP_ID,
        granted_scopes: ['ads_read'], expires_at: null }],
      purge_connection: () => [{ purge_connection: true }],
    });
    const readLiveConnection = vi.fn(async () => { events.push('readLive'); return null; });
    const defaultClient = vi.spyOn(client, 'createMetaHttpClient');
    const response = await oauth.handleMetaStart(startRequest(), deps(meta, worker, { readLiveConnection }));
    expect(response.status).toBe(303);
    expect(revokeCalls(meta)).toHaveLength(1);
    expect(defaultClient).not.toHaveBeenCalled();
    expect(events).toEqual(['db:list_pending_purges', 'db:get_credential', 'meta:/v26.0/',
      'db:purge_connection', 'readLive', 'db:create_oauth_attempt']);
  });

  it.each([
    ['sin conexión', null, 'https://www.facebook.com/v26.0/dialog/oauth', 1],
    ['pendiente vigente', { id: CONNECTION_ID, status: 'pending_selection', credentialGeneration: 0 },
      RESULT('pendiente_vigente'), 0],
  ] as const)('T-13 una purga que lanza no corta el inicio: %s', async (_name, live, expected, attempts) => {
    const meta = fakeMeta();
    const worker = fakeWorker({ list_pending_purges: () => { throw new Error('Fallo sintético de purga.'); } });
    const defaultClient = vi.spyOn(client, 'createMetaHttpClient');
    const readLiveConnection = vi.fn(async () => { events.push('readLive'); return live; });
    const response = await oauth.handleMetaStart(startRequest(), deps(meta, worker, { readLiveConnection }));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain(expected);
    expect(worker.calls.filter((call) => call.fn === 'create_oauth_attempt')).toHaveLength(attempts);
    expect(events.slice(0, 2)).toEqual(['db:list_pending_purges', 'readLive']);
    expect(logs).toContainEqual({ evento: 'meta_ciclo', etapa: 'purga', resultado: 'fallida',
      request_id: CTX.request_id });
    expect(defaultClient).not.toHaveBeenCalled();
    expect(meta.calls).toEqual([]);
  });
});

describe('M16.2: reautorización y recuperación del token nuevo', () => {
  const workerForReauth = (handler: WorkerHandler = (args) => [{ connection_id: args[2],
    status: 'active', credential_generation: 3 }]) => fakeWorker({
    consume_oauth_attempt: () => [consumedRow('reauth', 2)], replace_credential: handler,
  });

  it('T-15 consume, valida y reemplaza la credencial antes de responder reautorizado', async () => {
    const meta = fakeMeta();
    const worker = workerForReauth();
    expect(await runCallback(meta, worker, { readConnection: async () => activeReauthRecord() }))
      .toBe(RESULT('reautorizado'));
    expect(worker.calls.map((call) => call.fn)).toEqual(['consume_oauth_attempt', 'replace_credential']);
    expect(events).toEqual(['db:consume_oauth_attempt', 'meta:/v26.0/oauth/access_token',
      'meta:/v26.0/', 'meta:/v26.0/me', 'meta:/v26.0/9876543/assigned_ad_accounts',
      'db:replace_credential']);
    expect(worker.calls[1].args.slice(0, 4)).toEqual([CTX.user_id, CTX.company_id,
      CONNECTION_ID, expect.any(String)]);
    expect(revokeCalls(meta)).toHaveLength(0);
  });

  it('T-17 revoca el token nuevo si la cuenta conectada dejó de estar delegada', async () => {
    const meta = fakeMeta({ '/v26.0/9876543/assigned_ad_accounts': () => json({ data: [] }) });
    const worker = workerForReauth();
    expect(await runCallback(meta, worker, { readConnection: async () => activeReauthRecord() }))
      .toBe(RESULT('cuenta_no_delegada'));
    expect(worker.calls.map((call) => call.fn)).toEqual(['consume_oauth_attempt']);
    expect(revokeCalls(meta)).toHaveLength(1);
  });

  it('T-51 revoca el token nuevo si el listado supera el límite', async () => {
    let pages = 0;
    const meta = fakeMeta({ '/v26.0/9876543/assigned_ad_accounts': () => {
      pages += 1;
      return json({ data: [], paging: { next: 'ignorado', cursors: { after: `cur-${pages}` } } });
    } });
    const worker = workerForReauth();
    expect(await runCallback(meta, worker, { readConnection: async () => activeReauthRecord() }))
      .toBe(RESULT('meta_no_disponible'));
    expect(pages).toBe(10);
    expect(revokeCalls(meta)).toHaveLength(1);
    expect(worker.calls.map((call) => call.fn)).not.toContain('replace_credential');
  });

  it('T-51 revoca el token nuevo si reauth no obtiene ads_read', async () => {
    const meta = fakeMeta({ '/v26.0/debug_token': debugToken({ scopes: [] }) });
    const worker = workerForReauth();
    expect(await runCallback(meta, worker, { readConnection: async () => activeReauthRecord() }))
      .toBe(RESULT('permiso_faltante'));
    expect(revokeCalls(meta)).toHaveLength(1);
    expect(worker.calls.map((call) => call.fn)).toEqual(['consume_oauth_attempt']);
    expect(JSON.stringify(logs)).not.toContain(TOKEN);
  });

  it.each([
    ['generation_mismatch', 'credencial_cambio'], ['invalid_transition', 'credencial_cambio'],
    ['not_authorized', 'credencial_cambio'], ['attempt_rejected', 'rechazado'],
    ['invalid_argument', 'error'],
  ] as const)('T-18 %s → %s y una revocación', async (code, expected) => {
    const meta = fakeMeta();
    const worker = workerForReauth(() => { throw new WorkerApiError(code); });
    expect(await runCallback(meta, worker, { readConnection: async () => activeReauthRecord() }))
      .toBe(RESULT(expected));
    expect(revokeCalls(meta)).toHaveLength(1);
    expect(JSON.stringify(logs)).not.toContain(TOKEN);
  });

  it.each([
    ['debug_token sin ads_read', { '/v26.0/debug_token': debugToken({ scopes: [] }) }, {}, 'permiso_faltante'],
    ['/me sin negocio', { '/v26.0/me': () => json({ id: '9876543' }) }, {}, 'token_no_valido'],
    ['/me con error de Graph', { '/v26.0/me': () => json(graphError(190), 400) }, {}, 'rechazado'],
    ['PX003 al crear pendiente', {}, { create_pending_connection: () => {
      throw new WorkerApiError('live_connection_exists');
    } }, 'conexion_existente'],
    ['error inesperado al crear pendiente', {}, { create_pending_connection: () => {
      throw new Error('Fallo sintético de escritura.');
    } }, 'error'],
  ] as Array<[string, Record<string, Responder>, Partial<Record<string, WorkerHandler>>, string]>)
  ('T-19 revoca una vez el token nuevo en initial tras %s', async (_name, metaOverrides, workerOverrides, outcome) => {
    const meta = fakeMeta(metaOverrides);
    const worker = fakeWorker(workerOverrides);
    expect(await runCallback(meta, worker)).toBe(RESULT(outcome));
    expect(revokeCalls(meta)).toHaveLength(1);
    expect(JSON.stringify(logs)).not.toContain(TOKEN);
  });

  it('T-20 no revoca sin token después de fallar el canje', async () => {
    const denied = fakeMeta({ '/v26.0/oauth/access_token': () => json(graphError(100), 400) });
    expect(await runCallback(denied, fakeWorker())).toBe(RESULT('rechazado'));
    expect(revokeCalls(denied)).toHaveLength(0);
    expect(outcomes.META_OAUTH_MESSAGES.rechazado.text).toContain('Si llegaste a autorizar en Meta');
    expect(outcomes.META_OAUTH_MESSAGES.meta_no_disponible.text).toContain('Si llegaste a autorizar en Meta');
  });

  it.each([
    ['mismo token', TOKEN, false, 'reautorizado', 0],
    ['otro token', 'token-anterior', false, 'error', 1],
    ['lectura fallida', TOKEN, true, 'error', 1],
  ] as const)('T-52 relee tras dos fallos de transporte: %s', async (_case, saved, unreadable, expected, revocations) => {
    const meta = fakeMeta();
    let writes = 0;
    const worker = fakeWorker({
      consume_oauth_attempt: () => [consumedRow('reauth', 2)],
      replace_credential: () => { writes += 1; throw new WorkerApiError('unavailable', 'transport'); },
      get_credential: () => unreadable ? (() => { throw new WorkerApiError('unavailable', 'transport'); })()
        : [savedReauthCredential(saved)],
    });
    let reads = 0;
    const result = await runCallback(meta, worker, { readConnection: async () => {
      reads += 1;
      return { ...activeReauthRecord(), credential_generation: reads === 1 ? 2 : 3 };
    } });
    expect(result).toBe(RESULT(expected));
    expect(writes).toBe(2);
    expect(revokeCalls(meta)).toHaveLength(revocations);
    const reauthLines = logs.filter((line) => (line as { evento?: string; etapa?: string }).evento === 'meta_ciclo' &&
      (line as { etapa?: string }).etapa === 'reauth');
    expect(reauthLines).toEqual(expected === 'reautorizado'
      ? [{ evento: 'meta_ciclo', etapa: 'reauth', resultado: 'ok', request_id: CTX.request_id }] : []);
    expect(JSON.stringify(logs)).not.toContain(TOKEN);
    expect(JSON.stringify(logs)).not.toContain(sha256(TOKEN));
  });
});

describe('M16.2: registros cerrados y frontera de servidor', () => {
  it('T-23 registra solo campos cerrados sin token, cuenta ni valores del proveedor', async () => {
    const meta = fakeMeta({ '/v26.0/debug_token': debugToken({ scopes: [] }) });
    expect(await runCallback(meta, fakeWorker())).toBe(RESULT('permiso_faltante'));
    const allowed = new Set(['evento', 'etapa', 'resultado', 'clase', 'motivo', 'request_id',
      'filas', 'campos', 'paginas', 'llamadas', 'completa', 'duracion_ms', 'cuentas', 'descartadas']);
    for (const line of logs) {
      expect(line).toMatchObject({ evento: expect.stringMatching(/^meta_(oauth|ciclo)$/) });
      for (const key of Object.keys(line as object)) expect(allowed.has(key)).toBe(true);
    }
    const serialized = JSON.stringify(logs);
    for (const forbidden of [TOKEN, 'act_1001', 'act_90001', BUSINESS, 'Cuenta sintética', '1.23']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('T-24 confina los módulos nuevos al servidor', () => {
    for (const file of ['src/modules/integrations/lifecycle.ts',
      'src/modules/integrations/meta/accounts.ts', 'src/modules/integrations/meta/probe.ts',
      'src/modules/integrations/meta/revoke.ts',
      'src/modules/integrations/repository/lifecycle-calls.ts']) {
      expect(startsWithServerOnly(sources.get(file) ?? '')).toBe(true);
    }
    const actions = sources.get('src/modules/integrations/actions.ts') ?? '';
    expect(actions.trimStart().startsWith("'use server';")).toBe(true);
    expect(actions.match(/export (?:async )?function /g)).toEqual(['export async function ', 'export async function ']);
    expect(actions).not.toMatch(/export (?:const|class|type|interface) /);
  });
});

describe('M16.2-T-52: escritura inicial ambigua en el callback', () => {
  it.each([
    ['mismo token', TOKEN, 'pendiente', 0],
    ['otro token', 'token-anterior', 'error', 1],
    ['sin conexión', null, 'error', 1],
    ['lectura fallida', TOKEN, 'error', 1],
  ] as const)('%s → %s tras relectura', async (_case, saved, expected, revocations) => {
    const meta = fakeMeta();
    let pendingId = '';
    let writes = 0;
    const worker = fakeWorker({
      create_pending_connection: (args) => {
        pendingId = args[2] as string;
        writes += 1;
        throw new WorkerApiError('unavailable', 'transport');
      },
      get_credential: () => {
        if (!saved) throw new Error('No se debía leer credencial.');
        return [{ connection_id: pendingId, company_id: CTX.company_id, provider: 'meta',
          status: 'pending_selection', credential_generation: 0,
          ...sealCredential(saved, { company_id: CTX.company_id, connection_id: pendingId,
            provider: 'meta' }, KEYRING), token_type: 'system_user', issued_for_app_id: APP_ID,
          granted_scopes: ['ads_read'], expires_at: null }];
      },
    });
    const readConnection = async (): Promise<IntegrationConnectionRecord | null> => {
      if (_case === 'lectura fallida') throw new Error('Relectura fallida.');
      return saved === null ? null : {
      id: pendingId, company_id: CTX.company_id, provider: 'meta', client_business_id: BUSINESS,
      credential_generation: 0, current_sync_run_id: null, last_error_class: null,
      last_error_message: null, created_at: '2026-10-14T00:00:00.000Z',
      updated_at: '2026-10-14T00:00:00.000Z', status: 'pending_selection',
      external_account_id: null, currency: null, timezone: null,
      pending_expires_at: '2030-01-01T00:00:00.000Z', purge_requested_at: null,
      };
    };
    expect(await runCallback(meta, worker, { readConnection })).toBe(RESULT(expected));
    expect(writes).toBe(2);
    expect(revokeCalls(meta)).toHaveLength(revocations);
    expect(JSON.stringify(logs)).not.toContain(TOKEN);
    expect(JSON.stringify(logs)).not.toContain(sha256(TOKEN));
  });
});

// ---------------------------------------------------------------------------
// outcomes.ts
// ---------------------------------------------------------------------------

describe('M16.1-T-22: resultados cerrados', () => {
  it('acepta cada resultado y cada uno tiene texto', () => {
    for (const outcome of outcomes.META_OAUTH_OUTCOMES) {
      expect(outcomes.parseMetaOAuthOutcome(outcome)).toBe(outcome);
      expect(outcomes.META_OAUTH_MESSAGES[outcome].text.length).toBeGreaterThan(0);
      expect(['ok', 'info', 'error']).toContain(outcomes.META_OAUTH_MESSAGES[outcome].tone);
    }
    expect(outcomes.META_OAUTH_MESSAGES.error.tone).toBe('error');
    expect(outcomes.META_OAUTH_MESSAGES.cancelado.tone).not.toBe('error');
  });

  it.each(['', 'PENDIENTE', 'desconocido', 'toString', '__proto__'])('rechaza %j', (value) => {
    expect(outcomes.parseMetaOAuthOutcome(value)).toBeNull();
  });

  it('rechaza un valor repetido o ausente', () => {
    expect(outcomes.parseMetaOAuthOutcome(['pendiente', 'x'])).toBeNull();
    expect(outcomes.parseMetaOAuthOutcome(['pendiente'])).toBeNull();
    expect(outcomes.parseMetaOAuthOutcome(undefined)).toBeNull();
  });

  it('rechazado usa el mismo texto que el contrato K02', async () => {
    const { OAuthAttemptRejectedError } = await import('@/modules/integrations/contract');
    expect(outcomes.META_OAUTH_MESSAGES.rechazado.text).toContain(new OAuthAttemptRejectedError().message);
  });
});

// ---------------------------------------------------------------------------
// URLs de salida
// ---------------------------------------------------------------------------

describe('M16.1-T-40: forma de las peticiones a Meta', () => {
  it('canje y debug_token por POST de formulario; /me con bearer y solo fields', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker();
    const { state, nonce } = await startedAttempt(meta, worker);
    const response = await oauth.handleMetaCallback(callbackRequest({ state, code: CODE }, nonce), deps(meta, worker));
    expect(response.headers.get('location')).toBe(RESULT('pendiente'));
    expect(meta.violations).toEqual([]);

    const [exchange, debug, me] = meta.calls;
    for (const call of [exchange, debug]) {
      expect(call.method).toBe('POST');
      expect(call.url.search).toBe('');
      expect(call.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
    }
    const exchangeForm = new URLSearchParams(exchange.body ?? '');
    expect(Object.fromEntries(exchangeForm)).toEqual({
      client_id: APP_ID,
      redirect_uri: REDIRECT_URI,
      client_secret: SECRET,
      code: CODE,
    });
    expect(me.method).toBe('GET');
    expect([...me.url.searchParams.keys()]).toEqual(['fields']);
    expect(me.url.searchParams.get('fields')).toBe('id,client_business_id');
    expect(me.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);

    // Los nombres prohibidos no van como parámetros (la ruta del canje es `oauth/access_token`);
    // los valores no aparecen en ninguna parte de la URL.
    for (const call of meta.calls) {
      const url = call.url.toString();
      for (const value of [TOKEN, SECRET, CODE]) expect(url).not.toContain(value);
      for (const name of api.GRAPH_URL_FORBIDDEN_PARAMS) expect(call.url.searchParams.has(name)).toBe(false);
    }
  });

  it('un canje rechazado no se reintenta por GET', async () => {
    const meta = fakeMeta({ '/v26.0/oauth/access_token': () => json(graphError(100), 400) });
    const worker = fakeWorker();
    const location = await runCallback(meta, worker);
    expect(location).toBe(RESULT('rechazado'));
    expect(meta.calls).toHaveLength(1);
    expect(meta.calls[0].method).toBe('POST');
    expect(meta.violations).toEqual([]);
    expect(worker.calls.map((call) => call.fn)).not.toContain('create_pending_connection');
  });
});

describe('M16.1-T-42: barreras de URLs de salida', () => {
  it.each([...['access_token', 'input_token', 'client_secret', 'code', 'appsecret_proof']])(
    'graphUrl rechaza el parámetro %s',
    (name) => {
      expect(api.GRAPH_URL_FORBIDDEN_PARAMS).toContain(name);
      expect(() => api.graphUrl('me', { [name]: 'x' })).toThrow();
    },
  );

  async function rejected(run: (http: ReturnType<typeof client.createMetaHttpClient>) => Promise<unknown>) {
    const fetch = vi.fn<MetaFetch>(async () => json({}));
    const error = await run(client.createMetaHttpClient({ fetch })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(client.MetaRequestRejectedError);
    expect(fetch).not.toHaveBeenCalled();
    const message = (error as Error).message;
    expect(message).toBe('Petición a Meta rechazada: la URL no es válida.');
    expect(message).not.toContain(TOKEN);
    expect(message).not.toContain('graph.facebook.com');
  }

  const bearer = new SecretValue(TOKEN);

  it.each([
    `${GRAPH}/v26.0/me?access_token=x`,
    'https://otro.example/v26.0/me',
    'https://usuario:clave@graph.facebook.com/v26.0/me',
  ])('getJson y postFormJson rechazan %s sin llamar a fetch', async (raw) => {
    await rejected((http) => http.getJson(new URL(raw)));
    await rejected((http) => http.postFormJson(new URL(raw), {}));
  });

  it.each([
    `${GRAPH}/v26.0/debug_token?fields=x`,
    `${GRAPH}/v26.0/debug_token?x=1`,
    `${GRAPH}/v26.0/debug_token#f`,
    `${GRAPH}/v26.0/debug_token?fields=${TOKEN}`,
  ])('postFormJson rechaza cualquier consulta o fragmento: %s', async (raw) => {
    await rejected((http) => http.postFormJson(new URL(raw), { input_token: bearer }));
  });

  it.each([
    `${GRAPH}/v26.0/me?fields=${TOKEN}`,
    `${GRAPH}/v26.0/me?fields=%74${TOKEN.slice(1)}`,
    `${GRAPH}/v26.0/${TOKEN}/me`,
    `${GRAPH}/v26.0/me#${TOKEN}`,
  ])('getJson con bearer rechaza una URL que contiene el token: %s', async (raw) => {
    await rejected((http) => http.getJson(new URL(raw), { bearer }));
  });

  it('getJson con bearer y fields permitido llama a fetch con el encabezado', async () => {
    const meta = fakeMeta();
    await meta.http.getJson(api.graphUrl('me', { fields: 'id,client_business_id' }), { bearer });
    expect(meta.calls).toHaveLength(1);
    expect(meta.calls[0].headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
  });
});
