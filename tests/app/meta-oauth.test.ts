import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { MetaFetch } from '@/modules/integrations/meta/client';
import type { MetaOAuthDeps } from '@/modules/integrations/meta/oauth';
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
 * M16.1: OAuth con Meta contra el proyecto desechable (T-24 a T-35).
 *
 * La base es real: `worker_api` con el rol de pruebas, RLS con el cliente del usuario y el
 * llavero de `.env.local`. Meta es simulada: ninguna autorización real (T10). Los valores
 * de Meta son sintéticos y de menos de 20 caracteres (CA-12).
 *
 * T-24: el primer `beforeAll` lanza si falta o es inválida la configuración del proyecto
 * desechable o del rol, así que la suite falla en vez de saltarse (CB-06). Nunca se usa la
 * URL del rol de la aplicación.
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
const COOKIE = '__Host-praxa_oauth_binding';
const EXPIRES_AT = 1893456000;

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const state43 = () => randomBytes(32).toString('base64url');
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type Company = { user: TestUser; ctx: TenantContext };

describe('M16.1: OAuth con Meta simulada contra la base real', () => {
  let oauth: typeof import('@/modules/integrations/meta/oauth');
  let api: typeof import('@/modules/integrations/meta/api');
  let clientModule: typeof import('@/modules/integrations/meta/client');
  let attempts: typeof import('@/modules/integrations/repository/attempts');
  let connections: typeof import('@/modules/integrations/repository/connections');
  let credentials: typeof import('@/modules/integrations/repository/credentials');
  let keyringModule: typeof import('@/modules/integrations/crypto/keyring');
  let workerApiModule: typeof import('@/modules/integrations/db/worker-api');
  let workerApi: ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi> | undefined;

  // T-24: guarda. Sin destino seguro no crea cliente, usuario ni fixture: lanza.
  beforeAll(async () => {
    const target = resolveIntegrationsTestTarget(process.env);
    if (!target.ok) throw new Error(target.problems?.join(' ') ?? 'Destino del rol no verificado.');
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);
    if (!(await remoteProjectReachable())) throw new Error('El proyecto de pruebas no responde.');

    [oauth, api, clientModule, attempts, connections, credentials, keyringModule, workerApiModule] = await Promise.all([
      import('@/modules/integrations/meta/oauth'),
      import('@/modules/integrations/meta/api'),
      import('@/modules/integrations/meta/client'),
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

  function fakeMeta(debugScopes: string[] = ['ads_read']) {
    const calls: Array<{ method: string; path: string }> = [];
    const fetch: MetaFetch = async (input, init) => {
      const url = new URL(input);
      calls.push({ method: init.method ?? 'GET', path: url.pathname });
      switch (url.pathname) {
        case '/v26.0/oauth/access_token':
          return json({ access_token: TOKEN, token_type: 'bearer' });
        case '/v26.0/debug_token':
          return json({
            data: { is_valid: true, app_id: APP_ID, type: 'SYSTEM_USER', scopes: debugScopes, expires_at: EXPIRES_AT },
          });
        case '/v26.0/me':
          return json({ id: '9876543', client_business_id: BUSINESS });
        default:
          return json({ error: { code: 803 } }, 404);
      }
    };
    return { calls, http: clientModule.createMetaHttpClient({ fetch }) };
  }

  function deps(owner: Company, meta: ReturnType<typeof fakeMeta>, over: Partial<MetaOAuthDeps> = {}) {
    const config = api.readMetaOAuthConfig({
      META_APP_ID: APP_ID,
      META_APP_SECRET: SECRET,
      META_REDIRECT_URI: REDIRECT_URI,
      META_CONFIG_ID: CONFIG_ID,
    } as unknown as NodeJS.ProcessEnv);
    return {
      tenant: async () => owner.ctx,
      config: () => config,
      http: meta.http,
      workerApi: workerApi!,
      keyring: keyringModule.getCredentialKeyring(),
      readLiveConnection: (ctx: TenantContext) => connections.readLiveConnection(ctx, { supabase: owner.user.client }),
      log: () => {},
      ...over,
    } satisfies Partial<MetaOAuthDeps>;
  }

  async function start(owner: Company, meta = fakeMeta(), over: Partial<MetaOAuthDeps> = {}) {
    const request = new NextRequest(`${ORIGIN}/api/integraciones/meta/iniciar`, {
      method: 'POST',
      headers: { origin: ORIGIN },
    });
    const response = await oauth.handleMetaStart(request, deps(owner, meta, over));
    const location = response.headers.get('location') ?? '';
    const cookie = response.headers.get('set-cookie') ?? '';
    const nonce = /__Host-praxa_oauth_binding=([^;]*)/.exec(cookie)?.[1] ?? '';
    const state = location.startsWith('https://www.facebook.com/') ? (new URL(location).searchParams.get('state') ?? '') : '';
    return { response, location, state, nonce };
  }

  async function callback(owner: Company, state: string, nonce: string, meta = fakeMeta()) {
    const url = new URL(REDIRECT_URI);
    url.searchParams.set('state', state);
    url.searchParams.set('code', CODE);
    const request = new NextRequest(url, { headers: { cookie: `${COOKIE}=${nonce}` } });
    const response = await oauth.handleMetaCallback(request, deps(owner, meta));
    expectClean(response); // T-35
    return response.headers.get('location');
  }

  const RESULT = (outcome: string) => `${ORIGIN}/app/integraciones?meta=${outcome}`;

  /** T-35 (C-12): toda respuesta del callback es una redirección limpia. */
  function expectClean(response: Response) {
    expect(response.status).toBe(303);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.origin).toBe(ORIGIN);
    expect(location.pathname).toBe('/app/integraciones');
    expect([...location.searchParams.keys()]).toEqual(['meta']);
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie') ?? '').toMatch(/Max-Age=0/i);
  }

  async function liveRows(owner: Company) {
    const { data, error } = await owner.user.client
      .from('integration_connections')
      .select('id, status, external_account_id, currency, timezone, pending_expires_at, credential_generation')
      .eq('company_id', owner.ctx.company_id);
    if (error) throw new Error('No se pudo leer la conexión con el cliente del usuario.');
    return data ?? [];
  }

  // -------------------------------------------------------------------------
  // Casos
  // -------------------------------------------------------------------------

  it('T-25 el flujo initial crea la pendiente con la credencial cifrada', async () => {
    const owner = await company('m161-feliz');
    const meta = fakeMeta();
    const started = await start(owner, meta);
    expect(started.response.status).toBe(303);
    expect(started.state).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const before = Date.now();
    expect(await callback(owner, started.state, started.nonce, meta)).toBe(RESULT('pendiente'));

    const rows = await liveRows(owner);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.status).toBe('pending_selection');
    expect([row.external_account_id, row.currency, row.timezone]).toEqual([null, null, null]);
    const pendingMs = Date.parse(row.pending_expires_at) - before;
    expect(Math.abs(pendingMs - 30 * 60_000)).toBeLessThanOrEqual(2 * 60_000);

    const keyring = keyringModule.getCredentialKeyring();
    const read = await credentials.readCredential(owner.ctx, row.id, { workerApi: workerApi!, keyring });
    expect(read.token.reveal()).toBe(TOKEN);
    expect(read.tokenType).toBe('system_user');
    expect(read.issuedForAppId).toBe(APP_ID);
    expect(read.grantedScopes).toContain('ads_read');
    expect(read.expiresAt).toBe(new Date(EXPIRES_AT * 1000).toISOString());
    const raw = await workerApi!.call<{ ciphertext: string }>('get_credential', [
      owner.ctx.user_id,
      owner.ctx.company_id,
      row.id,
    ]);
    expect(raw[0].ciphertext).not.toContain(TOKEN);
    expect(raw[0].ciphertext).not.toBe(Buffer.from(TOKEN).toString('base64'));
    expect(meta.calls.map((call) => call.path)).toEqual([
      '/v26.0/oauth/access_token',
      '/v26.0/debug_token',
      '/v26.0/me',
    ]);
  });

  it('T-26 un state desconocido se rechaza', async () => {
    const owner = await company('m161-desconocido');
    const meta = fakeMeta();
    expect(await callback(owner, state43(), state43(), meta)).toBe(RESULT('rechazado'));
    expect(await liveRows(owner)).toEqual([]);
    expect(meta.calls).toEqual([]);
  });

  it('T-27 un intento vencido se rechaza', async () => {
    const owner = await company('m161-vencido');
    const state = state43();
    const nonce = state43();
    await attempts.createOAuthAttempt(
      owner.ctx,
      {
        purpose: 'initial',
        stateHash: sha256(state),
        bindingHash: sha256(nonce),
        returnPath: '/app/integraciones',
        expiresAt: new Date(Date.now() + 4_000),
        expectedConnectionId: null,
      },
      { workerApi: workerApi! },
    );
    await new Promise((resolve) => setTimeout(resolve, 6_000));
    const meta = fakeMeta();
    expect(await callback(owner, state, nonce, meta)).toBe(RESULT('rechazado'));
    expect(await liveRows(owner)).toEqual([]);
    expect(meta.calls).toEqual([]);
  });

  it('T-28 el mismo callback dos veces crea una sola conexión con un solo canje', async () => {
    const owner = await company('m161-repetido');
    const meta = fakeMeta();
    const started = await start(owner, meta);
    expect(await callback(owner, started.state, started.nonce, meta)).toBe(RESULT('pendiente'));
    expect(await callback(owner, started.state, started.nonce, meta)).toBe(RESULT('rechazado'));
    expect(meta.calls.filter((call) => call.path === '/v26.0/oauth/access_token')).toHaveLength(1);
    expect(await liveRows(owner)).toHaveLength(1);
  });

  it('T-29 el intento de A no se consume con el contexto de B', async () => {
    const a = await company('m161-a');
    const b = await company('m161-b');
    const started = await start(a);
    const meta = fakeMeta();
    expect(await callback(b, started.state, started.nonce, meta)).toBe(RESULT('rechazado'));
    expect(meta.calls).toEqual([]);
    expect(await callback(a, started.state, started.nonce)).toBe(RESULT('pendiente'));
  });

  it('T-30 el usuario de A con la empresa de B se rechaza', async () => {
    const a = await company('m161-actor');
    const b = await company('m161-empresa');
    const started = await start(a);
    const mixed: Company = { user: a.user, ctx: { ...a.ctx, company_id: b.ctx.company_id, request_id: randomUUID() } };
    const meta = fakeMeta();
    expect(await callback(mixed, started.state, started.nonce, meta)).toBe(RESULT('rechazado'));
    expect(meta.calls).toEqual([]);
    expect(await liveRows(b)).toEqual([]);
  });

  it('T-31 una cookie con otro nonce se rechaza sin gastar el intento', async () => {
    const owner = await company('m161-nonce');
    const started = await start(owner);
    expect(await callback(owner, started.state, state43())).toBe(RESULT('rechazado'));
    expect(await callback(owner, started.state, started.nonce)).toBe(RESULT('pendiente'));
  });

  it('T-32 con una pendiente no se inicia; con una activa se inicia una reautorización', async () => {
    const owner = await company('m161-vivas');
    const started = await start(owner);
    expect(await callback(owner, started.state, started.nonce)).toBe(RESULT('pendiente'));
    const [pending] = await liveRows(owner);

    const blocked = await start(owner);
    expect(blocked.response.status).toBe(303);
    expect(blocked.location).toBe(RESULT('pendiente_vigente'));
    expect(await liveRows(owner)).toEqual([pending]);

    await workerApi!.call('confirm_connection', [
      owner.ctx.user_id,
      owner.ctx.company_id,
      pending.id,
      `cuenta_sint_${RUN_ID}_32`,
      'USD',
      'UTC',
      true,
    ]);

    const created: unknown[][] = [];
    const recording = {
      call: (async (fn: string, args: readonly unknown[]) => {
        const rows = await workerApi!.call(fn as never, args);
        if (fn === 'create_oauth_attempt') created.push([...args]);
        return rows;
      }) as NonNullable<typeof workerApi>['call'],
    };
    const reauth = await start(owner, fakeMeta(), { workerApi: recording });
    expect(reauth.location.startsWith('https://www.facebook.com/')).toBe(true);
    expect(created).toHaveLength(1);
    expect(created[0][2]).toBe('reauth');
    expect(created[0][7]).toBe(pending.id);

    await expect(
      attempts.createOAuthAttempt(
        owner.ctx,
        {
          purpose: 'initial',
          stateHash: sha256(state43()),
          bindingHash: sha256(state43()),
          returnPath: '/app/integraciones',
          expiresAt: new Date(Date.now() + 5 * 60_000),
          expectedConnectionId: null,
        },
        { workerApi: workerApi! },
      ),
    ).rejects.toBeInstanceOf(attempts.LiveConnectionExistsError);
  });

  it('T-33 reauth: generación vieja → credencial_cambio; vigente → no disponible, sin canje', async () => {
    const owner = await company('m161-reauth');
    const first = await start(owner);
    expect(await callback(owner, first.state, first.nonce)).toBe(RESULT('pendiente'));
    const [pending] = await liveRows(owner);
    await workerApi!.call('confirm_connection', [
      owner.ctx.user_id,
      owner.ctx.company_id,
      pending.id,
      `cuenta_sint_${RUN_ID}_33`,
      'USD',
      'UTC',
      true,
    ]);

    const stale = await start(owner);
    expect(stale.state).not.toBe('');

    // La generación avanza con otra reautorización completa, hecha por el repositorio.
    const state = state43();
    const nonce = state43();
    await attempts.createOAuthAttempt(
      owner.ctx,
      {
        purpose: 'reauth',
        stateHash: sha256(state),
        bindingHash: sha256(nonce),
        returnPath: '/app/integraciones',
        expiresAt: new Date(Date.now() + 5 * 60_000),
        expectedConnectionId: pending.id,
      },
      { workerApi: workerApi! },
    );
    const consumed = await attempts.consumeOAuthAttempt(
      owner.ctx,
      { stateHash: sha256(state), bindingHash: sha256(nonce) },
      { workerApi: workerApi! },
    );
    const keyring = keyringModule.getCredentialKeyring();
    await credentials.replaceCredential(
      owner.ctx,
      {
        token: 'token-sint-nuevo',
        tokenType: 'system_user',
        issuedForAppId: APP_ID,
        grantedScopes: ['ads_read'],
        expiresAt: null,
        connectionId: pending.id,
        attemptId: consumed.attemptId,
      },
      { workerApi: workerApi!, keyring },
    );

    const meta = fakeMeta();
    expect(await callback(owner, stale.state, stale.nonce, meta)).toBe(RESULT('credencial_cambio'));
    expect(meta.calls).toEqual([]);

    const current = await start(owner);
    expect(await callback(owner, current.state, current.nonce, meta)).toBe(RESULT('reautorizacion_no_disponible'));
    expect(meta.calls).toEqual([]);

    const read = await credentials.readCredential(owner.ctx, pending.id, { workerApi: workerApi!, keyring });
    expect(read.token.reveal()).toBe('token-sint-nuevo');
    expect(read.credentialGeneration).toBe(1);
  });

  it('T-34 sin ads_read no se crea ninguna conexión', async () => {
    const owner = await company('m161-permiso');
    const meta = fakeMeta(['business_management']);
    const started = await start(owner, meta);
    expect(await callback(owner, started.state, started.nonce, meta)).toBe(RESULT('permiso_faltante'));
    expect(await liveRows(owner)).toEqual([]);
  });
});
