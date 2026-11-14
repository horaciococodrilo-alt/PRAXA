import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { TiendanubeFetch } from '@/modules/integrations/tiendanube/client';
import type { TiendanubeOAuthDeps } from '@/modules/integrations/tiendanube/oauth';
import type { TenantContext } from '@/modules/tenant/context';
import { resolveIntegrationsTestTarget } from '../../scripts/lib/sql-target.mjs';
import {
  blockedReason,
  cleanupRun,
  createConfirmedUser,
  pendingCleanupCount,
  remoteProjectReachable,
  RUN_ID,
  type TestUser,
} from './helpers';

/**
 * M16e-T-02 y T-03 contra el proyecto desechable (etapa .2).
 *
 * La base es real: `worker_api` con el rol de pruebas, RLS con el cliente del usuario y el
 * llavero de `.env.local`. Tiendanube es simulada: ninguna autorización real. Tienda, token y
 * código son sintéticos.
 *
 * El primer `beforeAll` lanza si falta o es inválida la configuración del proyecto desechable
 * o del rol: la suite falla en vez de saltarse (CB-06).
 */

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const APP_ID = '4321';
const SECRET = 'secreto-sint-tn';
const CODE = 'codigo-sint-tn';
const TZ = 'America/Argentina/Buenos_Aires';
const ORIGIN = 'https://praxa.test';
const REDIRECT_URI = `${ORIGIN}/api/integraciones/tiendanube/callback`;
const COOKIE = '__Host-praxa_oauth_binding';

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const state43 = () => randomBytes(32).toString('base64url');
const storeId = () => String(800_000_000 + Math.floor(Math.random() * 99_000_000));
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type Company = { user: TestUser; ctx: TenantContext };

describe('M16e .2: OAuth de Tiendanube simulada contra la base real', () => {
  let oauth: typeof import('@/modules/integrations/tiendanube/oauth');
  let config: typeof import('@/modules/integrations/tiendanube/config');
  let clientModule: typeof import('@/modules/integrations/tiendanube/client');
  let lifecycle: typeof import('@/modules/integrations/lifecycle');
  let attempts: typeof import('@/modules/integrations/repository/attempts');
  let connections: typeof import('@/modules/integrations/repository/connections');
  let credentials: typeof import('@/modules/integrations/repository/credentials');
  let keyringModule: typeof import('@/modules/integrations/crypto/keyring');
  let workerApi: ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi> | undefined;

  beforeAll(async () => {
    const target = resolveIntegrationsTestTarget(process.env);
    if (!target.ok) throw new Error(target.problems?.join(' ') ?? 'Destino del rol no verificado.');
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);
    if (!(await remoteProjectReachable())) throw new Error('El proyecto de pruebas no responde.');
    let workerApiModule: typeof import('@/modules/integrations/db/worker-api');
    [oauth, config, clientModule, lifecycle, attempts, connections, credentials, keyringModule, workerApiModule] =
      await Promise.all([
        import('@/modules/integrations/tiendanube/oauth'),
        import('@/modules/integrations/tiendanube/config'),
        import('@/modules/integrations/tiendanube/client'),
        import('@/modules/integrations/lifecycle'),
        import('@/modules/integrations/repository/attempts'),
        import('@/modules/integrations/repository/connections'),
        import('@/modules/integrations/repository/credentials'),
        import('@/modules/integrations/crypto/keyring'),
        import('@/modules/integrations/db/worker-api'),
      ]);
    workerApi = workerApiModule.createWorkerApi({ connectionString: target.connectionString });
  });

  afterAll(async () => {
    try {
      await workerApi?.end();
    } finally {
      await cleanupRun();
      expect(pendingCleanupCount()).toBe(0);
    }
  });

  // -------------------------------------------------------------------------
  // Fixtures
  // -------------------------------------------------------------------------

  async function company(prefix: string): Promise<Company> {
    const user = await createConfirmedUser(prefix);
    const { data, error } = await user.client
      .rpc('create_company_for_current_user', { p_name: `Empresa sintética ${RUN_ID} ${prefix}` })
      .single<{ id: string }>();
    if (error || !data) throw new Error('No se pudo crear la empresa sintética.');
    return { user, ctx: { user_id: user.id, company_id: data.id, role: 'owner', request_id: randomUUID() } };
  }

  function fakeTiendanube(store: string, token = `tok-${randomBytes(6).toString('hex')}`) {
    const calls: string[] = [];
    const fetch: TiendanubeFetch = async (input, init) => {
      const url = new URL(input);
      calls.push(`${init.method ?? 'GET'} ${url.pathname}`);
      if (url.href === 'https://www.tiendanube.com/apps/authorize/token' && init.method === 'POST') {
        return json({ access_token: token, token_type: 'bearer', scope: 'read_orders,read_customers,read_products',
          user_id: store });
      }
      if (url.pathname === `/2025-03/${store}/store`) {
        return json({ id: Number(store), main_currency: 'ARS', timezone_id: TZ });
      }
      return json({}, 404);
    };
    return { calls, token, fetch };
  }

  function deps(owner: Company, tn: ReturnType<typeof fakeTiendanube>, over: Partial<TiendanubeOAuthDeps> = {}) {
    const cfg = config.readTiendanubeConfig({ TIENDANUBE_APP_ID: APP_ID, TIENDANUBE_CLIENT_SECRET: SECRET,
      TIENDANUBE_SUPPORT_CONTACT: 'soporte@praxa.test', TIENDANUBE_REDIRECT_URI: REDIRECT_URI } as
      unknown as NodeJS.ProcessEnv);
    return {
      tenant: async () => owner.ctx,
      config: () => cfg,
      http: (c) => clientModule.createTiendanubeHttpClient({ fetch: tn.fetch, userAgent: config.userAgentFor(c) }),
      workerApi: workerApi!,
      keyring: keyringModule.getCredentialKeyring(),
      readLiveConnection: (ctx: TenantContext) => connections.readLiveConnection(ctx, 'tiendanube', { supabase: owner.user.client }),
      readConnection: (ctx: TenantContext) => connections.readConnectionRecord(ctx, { supabase: owner.user.client }, 'tiendanube'),
      log: () => {},
      ...over,
    } satisfies Partial<TiendanubeOAuthDeps>;
  }

  async function start(owner: Company, tn: ReturnType<typeof fakeTiendanube>) {
    const request = new NextRequest(`${ORIGIN}/api/integraciones/tiendanube/iniciar`, {
      method: 'POST', headers: { origin: ORIGIN } });
    const response = await oauth.handleTiendanubeStart(request, deps(owner, tn));
    const location = response.headers.get('location') ?? '';
    const nonce = /__Host-praxa_oauth_binding=([^;]*)/.exec(response.headers.get('set-cookie') ?? '')?.[1] ?? '';
    const state = location.startsWith('https://www.tiendanube.com/') ? (new URL(location).searchParams.get('state') ?? '') : '';
    return { location, state, nonce };
  }

  async function callback(owner: Company, state: string, nonce: string, tn: ReturnType<typeof fakeTiendanube>) {
    const url = new URL(REDIRECT_URI);
    url.searchParams.set('state', state);
    url.searchParams.set('code', CODE);
    const response = await oauth.handleTiendanubeCallback(
      new NextRequest(url, { headers: { cookie: `${COOKIE}=${nonce}` } }), deps(owner, tn));
    expect(response.status).toBe(303);
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    const location = new URL(response.headers.get('location') ?? '');
    expect([...location.searchParams.keys()]).toEqual(['tiendanube']);
    return location.searchParams.get('tiendanube');
  }

  async function connect(owner: Company, store: string) {
    const tn = fakeTiendanube(store);
    const started = await start(owner, tn);
    return { outcome: await callback(owner, started.state, started.nonce, tn), tn };
  }

  async function rows(owner: Company) {
    const { data, error } = await owner.user.client.from('integration_connections')
      .select('id, provider, status, external_account_id, currency, timezone, credential_generation')
      .eq('company_id', owner.ctx.company_id);
    if (error) throw new Error('No se pudo leer la conexión con el cliente del usuario.');
    return data ?? [];
  }

  async function connectMeta(owner: Company) {
    const id = randomUUID();
    await workerApi!.call('create_pending_connection', [owner.ctx.user_id, owner.ctx.company_id, id, 'meta',
      'negocio_sintetico', 'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica',
      ['ads_read'], null]);
    await workerApi!.call('confirm_connection', [owner.ctx.user_id, owner.ctx.company_id, id, `act_${Date.now()}`,
      'USD', 'UTC', true]);
    return id;
  }

  // -------------------------------------------------------------------------
  // Casos
  // -------------------------------------------------------------------------

  it('T-02 initial: la tienda queda activa con zona y moneda, y la credencial cifrada es de Tiendanube', async () => {
    const owner = await company('m16e-feliz');
    const store = storeId();
    const { outcome, tn } = await connect(owner, store);
    expect(outcome).toBe('conectado');
    const [row] = await rows(owner);
    expect(row).toMatchObject({ provider: 'tiendanube', status: 'active', external_account_id: store,
      currency: 'ARS', timezone: TZ, credential_generation: 0 });
    const read = await credentials.readCredential(owner.ctx, row.id,
      { workerApi: workerApi!, keyring: keyringModule.getCredentialKeyring(), provider: 'tiendanube' });
    expect(read.token.reveal()).toBe(tn.token);
    expect([read.tokenType, read.issuedForAppId, read.expiresAt]).toEqual(['store_app_token', APP_ID, null]);
    expect([...read.grantedScopes].sort()).toEqual(['read_customers', 'read_orders', 'read_products']);
    const raw = await workerApi!.call<{ ciphertext: string }>('get_credential', [owner.ctx.user_id, owner.ctx.company_id, row.id]);
    expect(raw[0].ciphertext).not.toContain(tn.token);
    // Un token de Tiendanube nunca se lee como de Meta (A-13).
    await expect(credentials.readCredential(owner.ctx, row.id,
      { workerApi: workerApi!, keyring: keyringModule.getCredentialKeyring() })).rejects.toThrow();
    expect(tn.calls).toEqual(['POST /apps/authorize/token', `GET /2025-03/${store}/store`]);
  });

  it('T-02 el mismo callback dos veces: un solo canje y una sola conexión', async () => {
    const owner = await company('m16e-replay');
    const tn = fakeTiendanube(storeId());
    const started = await start(owner, tn);
    expect(await callback(owner, started.state, started.nonce, tn)).toBe('conectado');
    expect(await callback(owner, started.state, started.nonce, tn)).toBe('rechazado');
    expect(tn.calls.filter((call) => call.startsWith('POST'))).toHaveLength(1);
    expect(await rows(owner)).toHaveLength(1);
  });

  it('T-02 un intento de Meta no se consume en el callback de Tiendanube (A-14)', async () => {
    const owner = await company('m16e-proveedor');
    const state = state43();
    const nonce = state43();
    await attempts.createOAuthAttempt(owner.ctx, { provider: 'meta', purpose: 'initial', stateHash: sha256(state),
      bindingHash: sha256(nonce), returnPath: '/app/integraciones', expiresAt: new Date(Date.now() + 5 * 60_000),
      expectedConnectionId: null }, { workerApi: workerApi! });
    const tn = fakeTiendanube(storeId());
    expect(await callback(owner, state, nonce, tn)).toBe('rechazado');
    expect(tn.calls).toEqual([]);
    expect(await rows(owner)).toEqual([]);
  });

  it('T-02 el intento de una empresa no se consume con el contexto de otra', async () => {
    const a = await company('m16e-a');
    const b = await company('m16e-b');
    const tn = fakeTiendanube(storeId());
    const started = await start(a, tn);
    expect(await callback(b, started.state, started.nonce, tn)).toBe('rechazado');
    expect(tn.calls).toEqual([]);
  });

  it('T-01/T-02 Meta y Tiendanube conviven; la reautorización de la misma tienda sube la generación', async () => {
    const owner = await company('m16e-reauth');
    const metaId = await connectMeta(owner);
    const store = storeId();
    expect((await connect(owner, store)).outcome).toBe('conectado');
    expect((await connect(owner, store)).outcome).toBe('reautorizado');
    const all = await rows(owner);
    expect(all.map((row) => [row.provider, row.status]).sort()).toEqual([['meta', 'active'], ['tiendanube', 'active']]);
    expect(all.find((row) => row.provider === 'tiendanube')!.credential_generation).toBe(1);
    expect(all.find((row) => row.provider === 'meta')!.id).toBe(metaId);
  });

  it('T-02 reautorizar con otra tienda se rechaza y la credencial no cambia', async () => {
    const owner = await company('m16e-otra');
    const store = storeId();
    expect((await connect(owner, store)).outcome).toBe('conectado');
    const other = fakeTiendanube(storeId());
    const started = await start(owner, other);
    expect(await callback(owner, started.state, started.nonce, other)).toBe('otra_tienda');
    const [row] = await rows(owner);
    expect([row.external_account_id, row.credential_generation]).toEqual([store, 0]);
  });

  it('T-02 una reautorización con generación vieja → credencial_cambio', async () => {
    const owner = await company('m16e-generacion');
    const store = storeId();
    expect((await connect(owner, store)).outcome).toBe('conectado');
    const slow = fakeTiendanube(store);
    const first = await start(owner, slow);
    expect((await connect(owner, store)).outcome).toBe('reautorizado');
    expect(await callback(owner, first.state, first.nonce, slow)).toBe('credencial_cambio');
    expect(slow.calls).toEqual([]);
    expect((await rows(owner))[0].credential_generation).toBe(1);
  });

  it('T-03 desconectar Tiendanube purga la tienda sin tocar Meta ni llamar afuera', async () => {
    const owner = await company('m16e-desconexion');
    await connectMeta(owner);
    const { tn } = await connect(owner, storeId());
    const calls = tn.calls.length;
    const outcome = await lifecycle.disconnectTiendanube({
      tenant: async () => owner.ctx,
      workerApi: () => workerApi!,
      keyring: () => keyringModule.getCredentialKeyring(),
      readConnection: (ctx) => connections.readConnectionRecord(ctx, { supabase: owner.user.client }, 'tiendanube'),
      log: () => {},
    });
    expect(outcome).toBe('desconectado');
    expect((await rows(owner)).map((row) => [row.provider, row.status])).toEqual([['meta', 'active']]);
    expect(tn.calls).toHaveLength(calls);
  });
});
