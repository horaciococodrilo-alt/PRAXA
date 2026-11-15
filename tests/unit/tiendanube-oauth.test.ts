import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TenantContext } from '@/modules/tenant/context';
import type { IntegrationConnectionRecord } from '@/modules/integrations/contract';

/**
 * M16e etapa .2 (paso 4): OAuth de Tiendanube, desconexión sin revocación remota y purga
 * perezosa por proveedor, contra Tiendanube y `worker_api` simulados (T-02 y T-03, parte
 * unitaria; la parte del cliente que usa el OAuth, de T-10).
 *
 * Valores sintéticos y cortos: ninguno coincide con un secreto real (CA-12).
 */

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const APP_ID = '4321';
const SECRET = 'secreto-sint-tn';
const CODE = 'codigo-sint-tn';
const TOKEN = 'token-sint-tn';
const STORE = '98765';
const TZ = 'America/Argentina/Buenos_Aires';
const SUPPORT = 'soporte@praxa.test';
const ORIGIN = 'https://praxa.test';
const REDIRECT_URI = `${ORIGIN}/api/integraciones/tiendanube/callback`;
const COOKIE = '__Host-praxa_oauth_binding';
const NOW = new Date('2026-11-14T12:00:00.000Z');
const TOKEN_URL = 'https://www.tiendanube.com/apps/authorize/token';
const STORE_URL = `https://api.tiendanube.com/2025-03/${STORE}/store`;

const CTX: TenantContext = Object.freeze({
  user_id: '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d',
  company_id: '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f',
  role: 'owner',
  request_id: '7c6b5a49-3827-4165-a4b3-c2d1e0f9a8b7',
});
const CONNECTION_ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';

const config = await import('@/modules/integrations/tiendanube/config');
const errors = await import('@/modules/integrations/tiendanube/errors');
const client = await import('@/modules/integrations/tiendanube/client');
const oauth = await import('@/modules/integrations/tiendanube/oauth');
const lifecycle = await import('@/modules/integrations/lifecycle');
const metaClient = await import('@/modules/integrations/meta/client');
const metaApi = await import('@/modules/integrations/meta/api');
const { WorkerApiError } = await import('@/modules/integrations/db/worker-api');
const { parseCredentialKeyring } = await import('@/modules/integrations/crypto/keyring');
const { openCredential } = await import('@/modules/integrations/crypto/seal');
const { UnauthorizedError } = await import('@/modules/identity/session');
const { NoCompanyError } = await import('@/modules/company/service');

type TiendanubeFetch = import('@/modules/integrations/tiendanube/client').TiendanubeFetch;
type TiendanubeOAuthDeps = import('@/modules/integrations/tiendanube/oauth').TiendanubeOAuthDeps;
type WorkerApi = import('@/modules/integrations/db/worker-api').WorkerApi;

const CONFIG = config.readTiendanubeConfig({
  TIENDANUBE_APP_ID: APP_ID,
  TIENDANUBE_CLIENT_SECRET: SECRET,
  TIENDANUBE_SUPPORT_CONTACT: SUPPORT,
  TIENDANUBE_REDIRECT_URI: REDIRECT_URI,
} as unknown as NodeJS.ProcessEnv);

const KEYRING = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const state43 = () => randomBytes(32).toString('base64url');
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let events: string[] = [];
let logs: unknown[] = [];

beforeEach(() => {
  events = [];
  logs = [];
});

// ---------------------------------------------------------------------------
// Tiendanube y worker_api simulados
// ---------------------------------------------------------------------------

type TnCall = { method: string; url: URL; headers: Headers; body: string | null };
type Responder = (call: TnCall) => Response | Promise<Response>;

const TOKEN_OK = { access_token: TOKEN, token_type: 'bearer', scope: 'read_orders,read_customers,read_products', user_id: STORE };
const STORE_OK = { id: Number(STORE), main_currency: 'ARS', timezone_id: TZ, name: 'Tienda sintética', email: 'x@praxa.test' };

function fakeTiendanube(overrides: Partial<Record<'token' | 'store', Responder>> = {}) {
  const calls: TnCall[] = [];
  const responders: Record<'token' | 'store', Responder> = {
    token: () => json(TOKEN_OK),
    store: () => json(STORE_OK),
    ...overrides,
  };
  const fetch: TiendanubeFetch = async (input, init) => {
    const url = new URL(input);
    const call = { method: init.method ?? 'GET', url, headers: new Headers(init.headers),
      body: typeof init.body === 'string' ? init.body : null };
    calls.push(call);
    events.push(`tn:${url.pathname}`);
    if (url.href === TOKEN_URL && call.method === 'POST') return responders.token(call);
    if (url.origin + url.pathname === STORE_URL && call.method === 'GET') return responders.store(call);
    return json({ error: 'no encontrado' }, 404);
  };
  return { calls, fetch };
}

type WorkerHandler = (args: readonly unknown[]) => unknown[] | Promise<unknown[]>;

function consumed(purpose: 'initial' | 'reauth' = 'initial', generation = 2) {
  return {
    attempt_id: randomUUID(), purpose,
    expected_connection_id: purpose === 'reauth' ? CONNECTION_ID : null,
    expected_generation: purpose === 'reauth' ? generation : null,
    return_path: '/app/integraciones',
  };
}

function fakeWorker(overrides: Partial<Record<string, WorkerHandler>> = {}) {
  const calls: Array<{ fn: string; args: readonly unknown[] }> = [];
  const handlers: Record<string, WorkerHandler> = {
    create_oauth_attempt: (args) => [{
      attempt_id: randomUUID(), purpose: args[3], expected_connection_id: args[8] ?? null,
      expected_generation: args[3] === 'reauth' ? 2 : null, created_at: new Date(NOW),
      expires_at: new Date(String(args[7])),
    }],
    consume_oauth_attempt: () => [consumed()],
    list_pending_purges: () => [],
    create_pending_connection: (args) => [{
      connection_id: args[2], status: 'pending_selection',
      pending_expires_at: new Date(NOW.getTime() + 30 * 60_000), credential_generation: 0,
    }],
    confirm_connection: (args) => [{ connection_id: args[2], status: 'active', credential_generation: 0 }],
    replace_credential: (args) => [{ connection_id: args[2], status: 'active', credential_generation: 3 }],
    begin_disconnect: (args) => [{ connection_id: args[2], status: 'disconnected', credential_generation: 0,
      purge_requested_at: new Date(NOW) }],
    purge_connection: () => [{ purge_connection: true }],
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
  return { workerApi, calls, fns: () => calls.map((call) => call.fn) };
}

function record(over: Partial<IntegrationConnectionRecord> = {}): IntegrationConnectionRecord {
  return {
    id: CONNECTION_ID, company_id: CTX.company_id, provider: 'tiendanube', client_business_id: null,
    credential_generation: 2, current_sync_run_id: null, last_error_class: null, last_error_message: null,
    created_at: NOW.toISOString(), updated_at: NOW.toISOString(), external_account_id: STORE,
    currency: 'ARS', timezone: TZ, status: 'active', pending_expires_at: null, purge_requested_at: null,
    ...over,
  } as IntegrationConnectionRecord;
}

function deps(tn: ReturnType<typeof fakeTiendanube>, worker: ReturnType<typeof fakeWorker>,
  over: Partial<TiendanubeOAuthDeps> = {}): Partial<TiendanubeOAuthDeps> {
  return {
    tenant: async () => CTX,
    config: () => CONFIG,
    http: (cfg) => client.createTiendanubeHttpClient({ fetch: tn.fetch, userAgent: config.userAgentFor(cfg) }),
    workerApi: worker.workerApi,
    keyring: KEYRING,
    readLiveConnection: async () => null,
    readConnection: async () => null,
    now: () => new Date(NOW),
    log: (event) => logs.push(event),
    ...over,
  };
}

function startRequest(origin: string | null = ORIGIN) {
  const headers = new Headers();
  if (origin !== null) headers.set('origin', origin);
  return new NextRequest(`${ORIGIN}/api/integraciones/tiendanube/iniciar`, { method: 'POST', headers });
}

function callbackRequest(params: Record<string, string>, nonce?: string) {
  const url = new URL(REDIRECT_URI);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const headers = new Headers();
  if (nonce !== undefined) headers.set('cookie', `${COOKIE}=${nonce}`);
  return new NextRequest(url, { headers });
}

const RESULT = (outcome: string) => `${ORIGIN}/app/integraciones?tiendanube=${outcome}`;
const LOGIN = `${ORIGIN}/login?next=%2Fapp%2Fintegraciones`;

function expectClean(response: Response, location: string) {
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe(location);
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(response.headers.get('cache-control')).toBe('no-store');
  const cookie = response.headers.get('set-cookie') ?? '';
  expect(cookie).toContain(`${COOKIE}=;`);
  expect(cookie).toMatch(/Max-Age=0/i);
}

async function callback(params: Record<string, string>, nonce: string | undefined,
  tn = fakeTiendanube(), worker = fakeWorker(), over: Partial<TiendanubeOAuthDeps> = {}) {
  const response = await oauth.handleTiendanubeCallback(callbackRequest(params, nonce), deps(tn, worker, over));
  return { response, location: response.headers.get('location'), tn, worker };
}

function validCallback() {
  return { params: { code: CODE, state: state43() }, nonce: state43() };
}

/** Nada de lo sensible llega a los registros. */
function expectRedactedLogs() {
  const text = JSON.stringify(logs);
  for (const value of [TOKEN, CODE, SECRET, STORE]) expect(text).not.toContain(value);
}

// ---------------------------------------------------------------------------
// config.ts
// ---------------------------------------------------------------------------

describe('M16e .2: configuración de Tiendanube', () => {
  it('lee las cuatro variables; client_id es el ID de la app salvo TIENDANUBE_CLIENT_ID (H-10)', () => {
    expect(CONFIG.appId).toBe(APP_ID);
    expect(CONFIG.clientId).toBe(APP_ID);
    expect(CONFIG.clientSecret.reveal()).toBe(SECRET);
    expect(CONFIG.redirectUri).toBe(REDIRECT_URI);
    const other = config.readTiendanubeConfig({ TIENDANUBE_APP_ID: APP_ID, TIENDANUBE_CLIENT_SECRET: SECRET,
      TIENDANUBE_SUPPORT_CONTACT: SUPPORT, TIENDANUBE_REDIRECT_URI: REDIRECT_URI, TIENDANUBE_CLIENT_ID: '777' } as
      unknown as NodeJS.ProcessEnv);
    expect(other.clientId).toBe('777');
  });

  it('una variable ausente o mal formada falla nombrando solo la variable', () => {
    const bad = () => config.readTiendanubeConfig({ TIENDANUBE_APP_ID: 'abc', TIENDANUBE_CLIENT_SECRET: SECRET,
      TIENDANUBE_SUPPORT_CONTACT: SUPPORT, TIENDANUBE_REDIRECT_URI: `${ORIGIN}/api/integraciones/meta/callback` } as
      unknown as NodeJS.ProcessEnv);
    expect(bad).toThrow(config.TiendanubeConfigError);
    try { bad(); } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('TIENDANUBE_APP_ID');
      expect(message).toContain('TIENDANUBE_REDIRECT_URI');
      expect(message).not.toContain(SECRET);
    }
    expect(() => config.readTiendanubeConfig({} as NodeJS.ProcessEnv)).toThrow(config.TiendanubeConfigError);
  });

  it('la URL de autorización lleva solo `state`, sin scope ni redirect_uri', () => {
    const state = state43();
    const url = config.authorizationUrl(CONFIG, state);
    expect(url.origin + url.pathname).toBe(`https://www.tiendanube.com/apps/${APP_ID}/authorize`);
    expect([...url.searchParams.entries()]).toEqual([['state', state]]);
  });

  it('el User-Agent nombra la app y el contacto', () => {
    expect(config.userAgentFor(CONFIG)).toBe(`PRAXA (${SUPPORT})`);
  });
});

// ---------------------------------------------------------------------------
// client.ts y errors.ts
// ---------------------------------------------------------------------------

describe('M16e .2: cliente HTTP de Tiendanube (lo que usa el OAuth)', () => {
  const http = (tn: ReturnType<typeof fakeTiendanube>) =>
    client.createTiendanubeHttpClient({ fetch: tn.fetch, userAgent: config.userAgentFor(CONFIG) });

  it('el canje es un POST JSON a la URL fija, sin parámetros en la URL', async () => {
    const tn = fakeTiendanube();
    await http(tn).exchangeCode({ clientId: CONFIG.clientId, clientSecret: CONFIG.clientSecret, code: CODE });
    expect(tn.calls).toHaveLength(1);
    const [call] = tn.calls;
    expect(call.url.href).toBe(TOKEN_URL);
    expect(call.method).toBe('POST');
    expect(call.headers.get('content-type')).toBe('application/json');
    expect(call.headers.get('user-agent')).toBe(`PRAXA (${SUPPORT})`);
    expect(JSON.parse(call.body ?? '')).toEqual({ client_id: APP_ID, client_secret: SECRET,
      grant_type: 'authorization_code', code: CODE });
  });

  it('las lecturas van solo a api.tiendanube.com/2025-03, con Bearer y User-Agent', async () => {
    const tn = fakeTiendanube();
    await http(tn).getJson(STORE, 'store', { fields: 'id' }, new (await import('@/modules/integrations/crypto/seal')).SecretValue(TOKEN), 'store');
    const [call] = tn.calls;
    expect(call.url.origin + call.url.pathname).toBe(STORE_URL);
    expect(call.url.searchParams.get('fields')).toBe('id');
    expect(call.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(call.headers.get('user-agent')).toBe(`PRAXA (${SUPPORT})`);
    expect(call.url.href).not.toContain(TOKEN);
  });

  it('rechaza una tienda no numérica, una ruta extraña o un parámetro con credencial, sin enviar', async () => {
    const tn = fakeTiendanube();
    const { SecretValue } = await import('@/modules/integrations/crypto/seal');
    const token = new SecretValue(TOKEN);
    await expect(http(tn).getJson('12a', 'store', {}, token, 'store')).rejects.toThrow(client.TiendanubeRequestRejectedError);
    await expect(http(tn).getJson(STORE, '../store', {}, token, 'store')).rejects.toThrow(client.TiendanubeRequestRejectedError);
    await expect(http(tn).getJson(STORE, 'store', { access_token: 'x' }, token, 'store'))
      .rejects.toThrow(client.TiendanubeRequestRejectedError);
    expect(tn.calls).toEqual([]);
  });

  it('un cliente sin User-Agent no se puede crear', () => {
    expect(() => client.createTiendanubeHttpClient({ userAgent: '' })).toThrow();
  });

  it.each([
    [401, 'store', 'credencial_invalida', 'authentication'],
    [403, 'store', 'permiso_faltante', 'permission'],
    [402, 'store', 'tienda_suspendida', 'user_action'],
    [400, 'store', 'solicitud_invalida', 'own_error'],
    [422, 'store', 'campo_invalido', 'own_error'],
    [429, 'store', 'cuota', 'rate_limit'],
    [503, 'store', 'transitorio', 'temporary'],
    [404, 'product', 'no_encontrado', null],
    [404, 'store', 'no_encontrado', 'unknown'],
    [418, 'store', 'desconocido', 'unknown'],
  ] as const)('HTTP %i en %s → %s / %s', async (status, resource, kind, errorClass) => {
    expect(errors.classifyTiendanubeStatus(status, resource)).toEqual({ kind, errorClass });
    const tn = fakeTiendanube({ store: () => json({ message: 'detalle con datos' }, status) });
    const { SecretValue } = await import('@/modules/integrations/crypto/seal');
    const failure = await http(tn).getJson(STORE, 'store', {}, new SecretValue(TOKEN), 'store').catch((error) => error);
    expect(failure).toBeInstanceOf(errors.TiendanubeApiError);
    expect(failure.message).not.toContain('detalle');
  });

  it('red caída → transporte; timeout → transitorio', async () => {
    const { SecretValue } = await import('@/modules/integrations/crypto/seal');
    const token = new SecretValue(TOKEN);
    const down = client.createTiendanubeHttpClient({ userAgent: 'PRAXA (x)', fetch: async () => { throw new TypeError('fetch failed'); } });
    expect((await down.getJson(STORE, 'store', {}, token, 'store').catch((e) => e)).kind).toBe('transporte');
    const slow = client.createTiendanubeHttpClient({ userAgent: 'PRAXA (x)', fetch: async () => {
      throw new DOMException('timeout', 'TimeoutError');
    } });
    const timeout = await slow.getJson(STORE, 'store', {}, token, 'store').catch((e) => e);
    expect([timeout.kind, timeout.errorClass]).toEqual(['transitorio', 'temporary']);
  });
});

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------

describe('M16e-T-02: inicio del OAuth de Tiendanube', () => {
  it('la ruta exporta solo POST (DP-04: mismo origen, como Meta)', async () => {
    const route = await import('@/app/api/integraciones/tiendanube/iniciar/route');
    expect(Object.keys(route).sort()).toEqual(['POST']);
  });

  it('otro origen o sin origen → 403 sin tocar sesión ni base', async () => {
    const worker = fakeWorker();
    const tenant = vi.fn(async () => CTX);
    for (const origin of ['https://otro.test', null]) {
      const response = await oauth.handleTiendanubeStart(startRequest(origin), deps(fakeTiendanube(), worker, { tenant }));
      expect(response.status).toBe(403);
    }
    expect(tenant).not.toHaveBeenCalled();
    expect(worker.calls).toEqual([]);
  });

  it('initial: intento de Tiendanube con hashes, cookie de vinculación y redirección a la autorización', async () => {
    const worker = fakeWorker();
    const response = await oauth.handleTiendanubeStart(startRequest(), deps(fakeTiendanube(), worker));
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.origin + location.pathname).toBe(`https://www.tiendanube.com/apps/${APP_ID}/authorize`);
    const state = location.searchParams.get('state') ?? '';
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const cookie = response.headers.get('set-cookie') ?? '';
    const nonce = new RegExp(`${COOKIE}=([^;]+)`).exec(cookie)?.[1] ?? '';
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    const created = worker.calls.find((call) => call.fn === 'create_oauth_attempt')!.args;
    expect(created.slice(0, 4)).toEqual([CTX.user_id, CTX.company_id, 'tiendanube', 'initial']);
    expect(created[4]).toBe(sha256(state));
    expect(created[5]).toBe(sha256(nonce));
    expect(created[8]).toBeNull();
    expect(JSON.stringify(created)).not.toContain(state);
  });

  it('con una conexión viva de Tiendanube el intento es reauth sobre esa conexión', async () => {
    const worker = fakeWorker();
    await oauth.handleTiendanubeStart(startRequest(), deps(fakeTiendanube(), worker, {
      readLiveConnection: async () => ({ id: CONNECTION_ID, status: 'needs_reauth', credentialGeneration: 2 }),
    }));
    const created = worker.calls.find((call) => call.fn === 'create_oauth_attempt')!.args;
    expect([created[2], created[3], created[8]]).toEqual(['tiendanube', 'reauth', CONNECTION_ID]);
  });

  it('una pendiente en curso no inicia otro intento', async () => {
    const worker = fakeWorker();
    const response = await oauth.handleTiendanubeStart(startRequest(), deps(fakeTiendanube(), worker, {
      readLiveConnection: async () => ({ id: CONNECTION_ID, status: 'pending_selection', credentialGeneration: 0 }),
    }));
    expect(response.headers.get('location')).toBe(RESULT('conexion_en_curso'));
    expect(worker.fns()).not.toContain('create_oauth_attempt');
  });

  it('sin sesión → login; sin empresa → sin_empresa; callback en otro origen → error de configuración', async () => {
    const worker = fakeWorker();
    const noSession = await oauth.handleTiendanubeStart(startRequest(), deps(fakeTiendanube(), worker, {
      tenant: async () => { throw new UnauthorizedError(); } }));
    expect(noSession.headers.get('location')).toBe(LOGIN);
    const noCompany = await oauth.handleTiendanubeStart(startRequest(), deps(fakeTiendanube(), worker, {
      tenant: async () => { throw new NoCompanyError(); } }));
    expect(noCompany.headers.get('location')).toBe(RESULT('sin_empresa'));
    const elsewhere = config.readTiendanubeConfig({ TIENDANUBE_APP_ID: APP_ID, TIENDANUBE_CLIENT_SECRET: SECRET,
      TIENDANUBE_SUPPORT_CONTACT: SUPPORT, TIENDANUBE_REDIRECT_URI: 'https://otro.test/api/integraciones/tiendanube/callback' } as
      unknown as NodeJS.ProcessEnv);
    const wrong = await oauth.handleTiendanubeStart(startRequest(), deps(fakeTiendanube(), worker, { config: () => elsewhere }));
    expect(wrong.headers.get('location')).toBe(RESULT('error'));
    expect(worker.fns()).not.toContain('create_oauth_attempt');
  });

  it('la purga perezosa corre antes del intento y su fallo no lo impide', async () => {
    const worker = fakeWorker({ list_pending_purges: () => { throw new Error('caída'); } });
    const response = await oauth.handleTiendanubeStart(startRequest(), deps(fakeTiendanube(), worker));
    expect(new URL(response.headers.get('location') ?? '').hostname).toBe('www.tiendanube.com');
    expect(worker.fns()).toEqual(['list_pending_purges', 'create_oauth_attempt']);
  });
});

// ---------------------------------------------------------------------------
// Callback
// ---------------------------------------------------------------------------

describe('M16e-T-02: callback del OAuth de Tiendanube', () => {
  it('feliz: consumo → canje → /store → pendiente cifrada → activa con zona y moneda', async () => {
    const { params, nonce } = validCallback();
    const worker = fakeWorker();
    const { response, location, tn } = await callback(params, nonce, fakeTiendanube(), worker);
    expectClean(response, RESULT('conectado'));
    expect(location).toBe(RESULT('conectado'));
    expect(events).toEqual(['db:consume_oauth_attempt', 'tn:/apps/authorize/token', `tn:/2025-03/${STORE}/store`,
      'db:create_pending_connection', 'db:confirm_connection']);
    const consume = worker.calls[0].args;
    expect(consume).toEqual([CTX.user_id, CTX.company_id, 'tiendanube', sha256(params.state), sha256(nonce)]);

    const pending = worker.calls.find((call) => call.fn === 'create_pending_connection')!.args;
    expect(pending.slice(3, 5)).toEqual(['tiendanube', null]);
    expect(pending.slice(9)).toEqual(['store_app_token', APP_ID, ['read_customers', 'read_orders', 'read_products'], null]);
    expect(JSON.stringify(pending)).not.toContain(TOKEN);
    const opened = openCredential({ ciphertext: pending[5], iv: pending[6], auth_tag: pending[7], key_version: pending[8] } as
      Parameters<typeof openCredential>[0],
    { company_id: CTX.company_id, connection_id: pending[2] as string, provider: 'tiendanube' }, KEYRING);
    expect(opened.reveal()).toBe(TOKEN);

    const confirm = worker.calls.find((call) => call.fn === 'confirm_connection')!.args;
    expect(confirm).toEqual([CTX.user_id, CTX.company_id, pending[2], STORE, 'ARS', TZ, true]);
    const storeCall = tn.calls[1];
    expect(storeCall.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expectRedactedLogs();
  });

  it('acepta `store_id` en lugar de `user_id` y scopes en cualquier orden', async () => {
    const { params, nonce } = validCallback();
    const tn = fakeTiendanube({ token: () => json({ access_token: TOKEN, token_type: 'Bearer',
      scope: 'read_products, read_customers,read_orders', store_id: Number(STORE) }) });
    expect((await callback(params, nonce, tn)).location).toBe(RESULT('conectado'));
  });

  it('sin `state` (instalación iniciada desde Tiendanube) → aviso, sin canje ni base', async () => {
    const worker = fakeWorker();
    const tn = fakeTiendanube();
    const { response } = await callback({ code: CODE }, state43(), tn, worker);
    expectClean(response, RESULT('iniciar_desde_praxa'));
    expect(tn.calls).toEqual([]);
    expect(worker.calls).toEqual([]);
  });

  it('`state` mal formado o sin cookie → rechazado, sin consumir', async () => {
    for (const [params, nonce] of [[{ code: CODE, state: 'corto' }, state43()], [{ code: CODE, state: state43() }, undefined]] as const) {
      const worker = fakeWorker();
      const tn = fakeTiendanube();
      const { response } = await callback(params, nonce, tn, worker);
      expectClean(response, RESULT('rechazado'));
      expect(worker.calls).toEqual([]);
      expect(tn.calls).toEqual([]);
    }
  });

  it('sin `code` (canceló): consume el intento y muestra cancelado, sin canje', async () => {
    const worker = fakeWorker();
    const tn = fakeTiendanube();
    const { response } = await callback({ state: state43() }, state43(), tn, worker);
    expectClean(response, RESULT('cancelado'));
    expect(worker.fns()).toEqual(['consume_oauth_attempt']);
    expect(tn.calls).toEqual([]);
  });

  it('intento ya usado, vencido, ajeno o de otro proveedor → rechazado, sin canje', async () => {
    const { params, nonce } = validCallback();
    const worker = fakeWorker({ consume_oauth_attempt: () => { throw new WorkerApiError('attempt_rejected'); } });
    const tn = fakeTiendanube();
    const { response } = await callback(params, nonce, tn, worker);
    expectClean(response, RESULT('rechazado'));
    expect(tn.calls).toEqual([]);
  });

  it('sin sesión → login, sin consumir; sin empresa → sin_empresa', async () => {
    const { params, nonce } = validCallback();
    const worker = fakeWorker();
    const login = await callback(params, nonce, fakeTiendanube(), worker, {
      tenant: async () => { throw new UnauthorizedError(); } });
    expect(login.location).toBe(LOGIN);
    const none = await callback(params, nonce, fakeTiendanube(), worker, {
      tenant: async () => { throw new NoCompanyError(); } });
    expect(none.location).toBe(RESULT('sin_empresa'));
    expect(worker.calls).toEqual([]);
  });

  it.each([
    ['un permiso de más', 'read_orders,read_customers,read_products,write_orders'],
    ['un permiso de menos', 'read_orders,read_customers'],
    ['repetidos', 'read_orders,read_orders,read_products'],
    ['vacío', ''],
  ])('scopes distintos de los tres read_* (%s) → permisos_distintos, sin crear conexión', async (_name, scope) => {
    const { params, nonce } = validCallback();
    const worker = fakeWorker();
    const tn = fakeTiendanube({ token: () => json({ ...TOKEN_OK, scope }) });
    const { response } = await callback(params, nonce, tn, worker);
    expectClean(response, RESULT('permisos_distintos'));
    expect(worker.fns()).toEqual(['consume_oauth_attempt']);
    expect(tn.calls).toHaveLength(1);
  });

  it.each([
    ['sin access_token', { ...TOKEN_OK, access_token: undefined }],
    ['token_type no bearer', { ...TOKEN_OK, token_type: 'mac' }],
    ['tienda no numérica', { ...TOKEN_OK, user_id: 'abc' }],
    ['user_id y store_id distintos', { ...TOKEN_OK, store_id: 11111 }],
  ])('respuesta de canje inválida (%s) → rechazado, sin crear conexión', async (_name, body) => {
    const { params, nonce } = validCallback();
    const worker = fakeWorker();
    const { response } = await callback(params, nonce, fakeTiendanube({ token: () => json(body) }), worker);
    expectClean(response, RESULT('rechazado'));
    expect(worker.fns()).toEqual(['consume_oauth_attempt']);
  });

  it.each([
    ['otra tienda', { ...STORE_OK, id: 11111 }],
    ['sin zona', { ...STORE_OK, timezone_id: undefined }],
    ['zona inválida', { ...STORE_OK, timezone_id: 'Marte/Base' }],
    ['sin moneda', { ...STORE_OK, main_currency: null }],
  ])('/store incompleta (%s) → tienda_incompleta, sin crear conexión', async (_name, body) => {
    const { params, nonce } = validCallback();
    const worker = fakeWorker();
    const { response } = await callback(params, nonce, fakeTiendanube({ store: () => json(body) }), worker);
    expectClean(response, RESULT('tienda_incompleta'));
    expect(worker.fns()).toEqual(['consume_oauth_attempt']);
  });

  it('errores de Tiendanube: canje 503 → no disponible; /store 402 → tienda suspendida; 401 → rechazado', async () => {
    const cases = [
      [{ token: () => json({}, 503) }, 'tiendanube_no_disponible'],
      [{ store: () => json({}, 402) }, 'tienda_suspendida'],
      [{ store: () => json({}, 401) }, 'rechazado'],
      [{ token: () => json({ error: 'invalid_grant' }, 400) }, 'rechazado'],
    ] as const;
    for (const [overrides, outcome] of cases) {
      const { params, nonce } = validCallback();
      const worker = fakeWorker();
      const { response } = await callback(params, nonce, fakeTiendanube(overrides), worker);
      expectClean(response, RESULT(outcome));
      expect(worker.fns()).not.toContain('create_pending_connection');
    }
  });

  it('ya hay una conexión viva → conexion_existente', async () => {
    const { params, nonce } = validCallback();
    const worker = fakeWorker({ create_pending_connection: () => { throw new WorkerApiError('live_connection_exists'); } });
    expect((await callback(params, nonce, fakeTiendanube(), worker)).location).toBe(RESULT('conexion_existente'));
  });

  it('si la confirmación falla, la pendiente se desconecta y se purga: no queda token guardado', async () => {
    const { params, nonce } = validCallback();
    const worker = fakeWorker({ confirm_connection: () => { throw new WorkerApiError('invalid_argument'); } });
    const { location } = await callback(params, nonce, fakeTiendanube(), worker);
    expect(location).toBe(RESULT('error'));
    const created = worker.calls.find((call) => call.fn === 'create_pending_connection')!.args[2];
    expect(worker.fns().slice(-2)).toEqual(['begin_disconnect', 'purge_connection']);
    expect(worker.calls.at(-1)!.args[2]).toBe(created);
  });

  it('una caída de transporte al crear la pendiente se reintenta una vez con la misma operación', async () => {
    const { params, nonce } = validCallback();
    let first = true;
    const worker = fakeWorker({ create_pending_connection: (args) => {
      if (first) { first = false; throw new WorkerApiError('unavailable', 'transport'); }
      return [{ connection_id: args[2], status: 'pending_selection',
        pending_expires_at: new Date(NOW.getTime() + 30 * 60_000), credential_generation: 0 }];
    } });
    expect((await callback(params, nonce, fakeTiendanube(), worker)).location).toBe(RESULT('conectado'));
    const creates = worker.calls.filter((call) => call.fn === 'create_pending_connection');
    expect(creates).toHaveLength(2);
    expect(creates[0].args).toEqual(creates[1].args);
  });

  it('el token nunca llega a la URL de respuesta, a la cookie ni al registro', async () => {
    const { params, nonce } = validCallback();
    const { response } = await callback(params, nonce);
    const visible = JSON.stringify([...response.headers.entries()]);
    for (const value of [TOKEN, CODE, STORE]) expect(visible).not.toContain(value);
    expectRedactedLogs();
  });
});

describe('M16e-T-02: reautorización de Tiendanube (CA-37c)', () => {
  const reauth = (generation = 2) => fakeWorker({ consume_oauth_attempt: () => [consumed('reauth', generation)] });

  it('misma tienda y generación vigente → reemplaza la credencial con el intento consumido', async () => {
    const { params, nonce } = validCallback();
    const worker = reauth();
    const { response, tn } = await callback(params, nonce, fakeTiendanube(), worker, { readConnection: async () => record() });
    expectClean(response, RESULT('reautorizado'));
    expect(worker.fns()).toEqual(['consume_oauth_attempt', 'replace_credential']);
    const args = worker.calls[1].args;
    expect(args[2]).toBe(CONNECTION_ID);
    expect(args.slice(8)).toEqual(['store_app_token', APP_ID, ['read_customers', 'read_orders', 'read_products'], null]);
    expect(tn.calls.map((call) => call.url.pathname)).toEqual(['/apps/authorize/token']);
  });

  it('otra tienda → otra_tienda; el historial no se reasigna', async () => {
    const { params, nonce } = validCallback();
    const worker = reauth();
    const { location } = await callback(params, nonce,
      fakeTiendanube({ token: () => json({ ...TOKEN_OK, user_id: '11111' }) }), worker,
      { readConnection: async () => record() });
    expect(location).toBe(RESULT('otra_tienda'));
    expect(worker.fns()).toEqual(['consume_oauth_attempt']);
  });

  it('generación vieja, otra conexión o desconectada → credencial_cambio, sin canje', async () => {
    for (const current of [record({ credential_generation: 3 }), record({ id: randomUUID() }), null]) {
      const { params, nonce } = validCallback();
      const tn = fakeTiendanube();
      const { location } = await callback(params, nonce, tn, reauth(), { readConnection: async () => current });
      expect(location).toBe(RESULT('credencial_cambio'));
      expect(tn.calls).toEqual([]);
    }
  });

  it('la base rechaza el reemplazo por generación → credencial_cambio', async () => {
    const { params, nonce } = validCallback();
    const worker = fakeWorker({ consume_oauth_attempt: () => [consumed('reauth')],
      replace_credential: () => { throw new WorkerApiError('generation_mismatch'); } });
    const { location } = await callback(params, nonce, fakeTiendanube(), worker, { readConnection: async () => record() });
    expect(location).toBe(RESULT('credencial_cambio'));
  });

  it('scopes distintos en la reautorización → permisos_distintos, sin reemplazo', async () => {
    const { params, nonce } = validCallback();
    const worker = reauth();
    const { location } = await callback(params, nonce,
      fakeTiendanube({ token: () => json({ ...TOKEN_OK, scope: 'read_orders,write_orders' }) }), worker,
      { readConnection: async () => record() });
    expect(location).toBe(RESULT('permisos_distintos'));
    expect(worker.fns()).toEqual(['consume_oauth_attempt']);
  });
});

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

describe('M16e-T-03: purga perezosa y desconexión por proveedor', () => {
  function metaHttp() {
    const calls: string[] = [];
    const http = metaClient.createMetaHttpClient({ fetch: async (input) => {
      calls.push(new URL(input).pathname);
      return json([{ code: 200, body: '{"success":true}' }]);
    } });
    return { calls, http };
  }
  const META_CONFIG = metaApi.readMetaOAuthConfig({ META_APP_ID: '1234567', META_APP_SECRET: 'secreto-meta',
    META_REDIRECT_URI: `${ORIGIN}/api/integraciones/meta/callback`, META_CONFIG_ID: '7654321' } as unknown as NodeJS.ProcessEnv);

  const purgeRow = (provider: 'meta' | 'tiendanube', connectionId = randomUUID()) => ({
    connection_id: connectionId, provider, status: 'disconnected', reason: 'disconnect_requested', has_credential: true,
    pending_expires_at: null, purge_requested_at: new Date(NOW),
  });

  it('una credencial de Tiendanube se destruye sin leerla ni llamar a Meta', async () => {
    const meta = metaHttp();
    const worker = fakeWorker({ list_pending_purges: () => [purgeRow('tiendanube')] });
    const result = await lifecycle.runLazyPurge(CTX, { http: meta.http, config: () => META_CONFIG,
      workerApi: () => worker.workerApi, keyring: () => KEYRING, log: (event) => logs.push(event) });
    expect(result).toEqual({ purged: 1, revokeFailed: 0, remaining: false });
    expect(worker.fns()).toEqual(['list_pending_purges', 'purge_connection']);
    expect(meta.calls).toEqual([]);
  });

  it('una de Meta se sigue revocando en Meta', async () => {
    const meta = metaHttp();
    const { sealCredential } = await import('@/modules/integrations/crypto/seal');
    const id = randomUUID();
    const sealed = sealCredential('token-meta-sint', { company_id: CTX.company_id, connection_id: id, provider: 'meta' }, KEYRING);
    const worker = fakeWorker({
      list_pending_purges: () => [purgeRow('meta', id)],
      get_credential: () => [{ ...sealed, connection_id: id, company_id: CTX.company_id, provider: 'meta', status: 'disconnected',
        credential_generation: 0, token_type: 'system_user', issued_for_app_id: '1234567',
        granted_scopes: ['ads_read'], expires_at: null }],
    });
    await lifecycle.runLazyPurge(CTX, { http: meta.http, config: () => META_CONFIG,
      workerApi: () => worker.workerApi, keyring: () => KEYRING, log: () => {} });
    expect(worker.fns()).toEqual(['list_pending_purges', 'get_credential', 'purge_connection']);
    expect(meta.calls).toEqual(['/v26.0/']);
  });

  it('desconectar Tiendanube lee y desconecta solo la conexión de Tiendanube', async () => {
    const worker = fakeWorker();
    const readConnection = vi.fn(async () => record());
    const outcome = await lifecycle.disconnectTiendanube({ tenant: async () => CTX, workerApi: () => worker.workerApi,
      keyring: () => KEYRING, readConnection, log: () => {} });
    expect(outcome).toBe('desconectado');
    expect(worker.calls.find((call) => call.fn === 'begin_disconnect')!.args[2]).toBe(CONNECTION_ID);
  });

  it('desconectarTiendanube por defecto lee la conexión con proveedor tiendanube', async () => {
    const source = await readFile('src/modules/integrations/lifecycle.ts', 'utf8');
    expect(source).toMatch(/readConnectionRecord\(ctx, \{\}, 'tiendanube'\)/);
  });
});
