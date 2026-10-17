import { createHash, randomUUID } from 'node:crypto';

import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { MetaFetch } from '@/modules/integrations/meta/client';
import type { MetaOAuthDeps } from '@/modules/integrations/meta/oauth';
import type { TenantContext } from '@/modules/tenant/context';
import { resolveIntegrationsTestTarget } from '../../scripts/lib/sql-target.mjs';
import { blockedReason, cleanupRun, createConfirmedUser, pendingCleanupCount,
  remoteProjectReachable, RUN_ID, type TestUser } from './helpers';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const ORIGIN = 'https://praxa.test';
const REDIRECT_URI = `${ORIGIN}/api/integraciones/meta/callback`;
const ACCOUNT = 'act_1001';
const COOKIE = '__Host-praxa_oauth_binding';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
type Company = { user: TestUser; ctx: TenantContext };

describe('M16.2: ciclo de vida con base desechable y Meta simulada', () => {
  let oauth: typeof import('@/modules/integrations/meta/oauth');
  let lifecycle: typeof import('@/modules/integrations/lifecycle');
  let api: typeof import('@/modules/integrations/meta/api');
  let client: typeof import('@/modules/integrations/meta/client');
  let connections: typeof import('@/modules/integrations/repository/connections');
  let calls: typeof import('@/modules/integrations/repository/lifecycle-calls');
  let credentials: typeof import('@/modules/integrations/repository/credentials');
  let keyrings: typeof import('@/modules/integrations/crypto/keyring');
  let worker: ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi> | undefined;

  // T-38: sin destino y rol desechables válidos, esta suite falla antes de crear fixtures.
  beforeAll(async () => {
    const target = resolveIntegrationsTestTarget(process.env);
    if (!target.ok) throw new Error(target.problems?.join(' ') ?? 'Destino de pruebas inválido.');
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);
    if (!(await remoteProjectReachable())) throw new Error('El proyecto de pruebas no responde.');
    [oauth, lifecycle, api, client, connections, calls, credentials, keyrings] = await Promise.all([
      import('@/modules/integrations/meta/oauth'), import('@/modules/integrations/lifecycle'),
      import('@/modules/integrations/meta/api'), import('@/modules/integrations/meta/client'),
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
    const user = await createConfirmedUser(`m162-${label}`);
    const { data, error } = await user.client.rpc('create_company_for_current_user',
      { p_name: `Empresa sintética ${RUN_ID} ${label}` }).single<{ id: string }>();
    if (error || !data) throw new Error('No se pudo crear empresa sintética.');
    return { user, ctx: { user_id: user.id, company_id: data.id, role: 'owner', request_id: randomUUID() } };
  }

  function fakeMeta(options: { accounts?: string[]; onInsights?: () => Promise<void> } = {}) {
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
        if (!Array.isArray(batch) || batch.length !== 1 || batch[0]?.method !== 'GET') return json({ error: { code: 100 } }, 400);
        const inner = new URL(batch[0].relative_url, 'https://graph.facebook.com/');
        seen.push({ path: inner.pathname, method: 'BATCH_GET' });
        if (inner.pathname === '/debug_token') return json([{ code: 200, body: JSON.stringify({ data: {
          is_valid: true, app_id: '1234567', type: 'SYSTEM_USER', scopes: ['ads_read'], expires_at: 0,
        } }) }]);
        if (inner.pathname === '/oauth/revoke') return json([{ code: 200, body: '{"success":true}' }]);
        return json([{ code: 404, body: '{"error":{"code":803}}' }]);
      }
      if (url.pathname === '/v26.0/me') return json({ id: '5550001', client_business_id: 'negocio_sint' });
      if (url.pathname === '/v26.0/5550001/assigned_ad_accounts') return json({
        data: (options.accounts ?? [ACCOUNT]).map((id) => ({ id, name: 'Cuenta sintética', currency: 'USD',
          timezone_name: 'America/Argentina/Buenos_Aires' })),
      });
      if (url.pathname === `/v26.0/${ACCOUNT}/insights`) {
        if (options.onInsights) await options.onInsights();
        return json({ data: [{ date_start: '2026-10-01', spend: '1.23', impressions: '9' }] });
      }
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
      log: () => {}, now: () => new Date() } satisfies Partial<import('@/modules/integrations/lifecycle').LifecycleDeps>;
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
    return { start: location, outcome: new URL(callback.headers.get('location') ?? '').searchParams.get('meta') };
  }

  async function pending(owner: Company, meta: ReturnType<typeof fakeMeta>) {
    expect((await authorize(owner, meta)).outcome).toBe('pendiente');
    const row = await connections.readConnectionRecord(owner.ctx, { supabase: owner.user.client });
    expect(row?.status).toBe('pending_selection');
    return row!;
  }

  async function active(owner: Company, meta: ReturnType<typeof fakeMeta>) {
    const row = await pending(owner, meta);
    expect(await lifecycle.confirmAccount(sha256(`${row.id}:${ACCOUNT}`), lifeDeps(owner, meta))).toBe('conectado');
    return row;
  }

  it('T-30 desconexión durante el probe impide confirmar y la purga queda completa', async () => {
    const owner = await company('probe-race');
    let fire: () => Promise<void> = async () => {};
    const meta = fakeMeta({ onInsights: async () => fire() });
    const row = await pending(owner, meta);
    fire = async () => { expect(await lifecycle.disconnect(lifeDeps(owner, meta))).toBe('desconectado'); };
    expect(await lifecycle.confirmAccount(sha256(`${row.id}:${ACCOUNT}`), lifeDeps(owner, meta)))
      .toBe('conexion_cambio');
    expect(await connections.readConnectionRecord(owner.ctx, { supabase: owner.user.client })).toBeNull();
    expect((await lifecycle.runLazyPurge(owner.ctx, lifeDeps(owner, meta))).remaining).toBe(false);
  });

  it('T-31 reautoriza, valida la generación y rechaza un reemplazo tras la purga', async () => {
    const owner = await company('reauth-race'); const meta = fakeMeta(); const row = await active(owner, meta);
    expect((await authorize(owner, meta)).outcome).toBe('reautorizado');
    const read = await credentials.readCredential(owner.ctx, row.id, { workerApi: worker!,
      keyring: keyrings.getCredentialKeyring() });
    expect(read.credentialGeneration).toBe(1);
    expect(read.token.reveal()).toBe('token-sint-2');
    const original = worker!;
    const interleaved = { call: (async (fn: string, args: readonly unknown[]) => {
      if (fn === 'replace_credential') await calls.beginDisconnect(owner.ctx, row.id, { workerApi: original });
      return original.call(fn as never, args);
    }) as typeof original.call };
    const deps = oauthDeps(owner, meta); deps.workerApi = interleaved;
    const started = await oauth.handleMetaStart(new NextRequest(`${ORIGIN}/api/integraciones/meta/iniciar`,
      { method: 'POST', headers: { origin: ORIGIN } }), deps);
    const state = new URL(started.headers.get('location') ?? '').searchParams.get('state') ?? '';
    const nonce = /__Host-praxa_oauth_binding=([^;]*)/.exec(started.headers.get('set-cookie') ?? '')?.[1] ?? '';
    const url = new URL(REDIRECT_URI); url.searchParams.set('state', state); url.searchParams.set('code', 'codigo-sint');
    const result = await oauth.handleMetaCallback(new NextRequest(url, { headers: { cookie: `${COOKIE}=${nonce}` } }), deps);
    expect(new URL(result.headers.get('location') ?? '').searchParams.get('meta')).toBe('credencial_cambio');
    expect((await connections.readConnectionRecord(owner.ctx, { supabase: owner.user.client }))).toBeNull();
  });

  it('T-31 una desconexión completa intercalada impide reemplazar y revoca el token nuevo', async () => {
    const owner = await company('reauth-purged'); const meta = fakeMeta(); await active(owner, meta);
    const original = worker!;
    let disconnected = false;
    const interleaved = { call: (async (fn: string, args: readonly unknown[]) => {
      if (fn === 'replace_credential' && !disconnected) {
        disconnected = true;
        expect(await lifecycle.disconnect(lifeDeps(owner, meta))).toBe('desconectado');
      }
      return original.call(fn as never, args);
    }) as typeof original.call };
    const deps = oauthDeps(owner, meta); deps.workerApi = interleaved;
    const started = await oauth.handleMetaStart(new NextRequest(`${ORIGIN}/api/integraciones/meta/iniciar`,
      { method: 'POST', headers: { origin: ORIGIN } }), deps);
    const state = new URL(started.headers.get('location') ?? '').searchParams.get('state') ?? '';
    const nonce = /__Host-praxa_oauth_binding=([^;]*)/.exec(started.headers.get('set-cookie') ?? '')?.[1] ?? '';
    const url = new URL(REDIRECT_URI); url.searchParams.set('state', state); url.searchParams.set('code', 'codigo-sint');
    const result = await oauth.handleMetaCallback(new NextRequest(url, { headers: { cookie: `${COOKIE}=${nonce}` } }), deps);
    expect(new URL(result.headers.get('location') ?? '').searchParams.get('meta')).toBe('credencial_cambio');
    expect(disconnected).toBe(true);
    expect(meta.seen.filter((call) => call.path === '/oauth/revoke')).toHaveLength(2);
    expect(await connections.readConnectionRecord(owner.ctx, { supabase: owner.user.client })).toBeNull();
  });

  it('T-32 no reemplaza cuando la cuenta conectada deja de estar delegada', async () => {
    const owner = await company('delegation'); const meta = fakeMeta(); const row = await active(owner, meta);
    const changed = fakeMeta({ accounts: ['act_2002'] });
    expect((await authorize(owner, changed)).outcome).toBe('cuenta_no_delegada');
    const current = await credentials.readCredential(owner.ctx, row.id, { workerApi: worker!,
      keyring: keyrings.getCredentialKeyring() });
    expect(current.credentialGeneration).toBe(0);
    expect(changed.seen.some((call) => call.path === '/v26.0/')).toBe(true);
  });

  it('T-33 reanuda una desconexión cortada y permite reconectar', async () => {
    const owner = await company('resume'); const meta = fakeMeta(); const row = await pending(owner, meta);
    await calls.beginDisconnect(owner.ctx, row.id, { workerApi: worker! });
    expect((await lifecycle.loadMetaCardState(lifeDeps(owner, meta))).kind).toBe('sin_conexion');
    expect((await lifecycle.loadMetaCardState(lifeDeps(owner, meta))).kind).toBe('sin_conexion');
    const next = await pending(owner, meta);
    expect(next.id).not.toBe(row.id);
  });

  it('T-34 desconecta una activa y destruye la credencial', async () => {
    const owner = await company('disconnect'); const meta = fakeMeta(); const row = await active(owner, meta);
    expect(await lifecycle.disconnect(lifeDeps(owner, meta))).toBe('desconectado');
    expect(await connections.readConnectionRecord(owner.ctx, { supabase: owner.user.client })).toBeNull();
    await expect(credentials.readCredential(owner.ctx, row.id, { workerApi: worker!,
      keyring: keyrings.getCredentialKeyring() })).rejects.toThrow();
  });

  it('T-35 una pendiente vigente bloquea otro inicio hasta cancelarla', async () => {
    const owner = await company('pending'); const meta = fakeMeta(); await pending(owner, meta);
    const blocked = await oauth.handleMetaStart(new NextRequest(`${ORIGIN}/api/integraciones/meta/iniciar`,
      { method: 'POST', headers: { origin: ORIGIN } }), oauthDeps(owner, meta));
    expect(new URL(blocked.headers.get('location') ?? '').searchParams.get('meta')).toBe('pendiente_vigente');
    expect(await lifecycle.disconnect(lifeDeps(owner, meta))).toBe('desconectado');
    expect((await authorize(owner, meta)).outcome).toBe('pendiente');
  });

  it('T-36 confirma con RLS y el reenvío no repite el probe', async () => {
    const owner = await company('confirm'); const meta = fakeMeta(); const row = await pending(owner, meta);
    const key = sha256(`${row.id}:${ACCOUNT}`);
    expect(await lifecycle.confirmAccount(key, lifeDeps(owner, meta))).toBe('conectado');
    const current = await connections.readConnectionRecord(owner.ctx, { supabase: owner.user.client });
    expect(current).toMatchObject({ status: 'active', external_account_id: ACCOUNT, currency: 'USD',
      timezone: 'America/Argentina/Buenos_Aires' });
    const probes = meta.seen.filter((call) => call.path.endsWith('/insights')).length;
    expect(await lifecycle.confirmAccount(key, lifeDeps(owner, meta))).toBe('conexion_cambio');
    expect(meta.seen.filter((call) => call.path.endsWith('/insights'))).toHaveLength(probes);
  });

  it('T-37 marca reautorización solo para la generación vigente', async () => {
    const owner = await company('failure'); const meta = fakeMeta(); const row = await active(owner, meta);
    const { MetaApiError } = await import('@/modules/integrations/meta/errors');
    const failure = new MetaApiError({ errorClass: 'authentication', graphCode: 190, graphSubcode: null });
    expect(await lifecycle.applyConnectionFailure(owner.ctx, { id: row.id, credentialGeneration: 0 }, failure,
      lifeDeps(owner, meta))).toBe('needs_reauth');
    expect((await connections.readConnectionRecord(owner.ctx, { supabase: owner.user.client }))?.status)
      .toBe('needs_reauth');
    expect(await lifecycle.applyConnectionFailure(owner.ctx, { id: row.id, credentialGeneration: 999 }, failure,
      lifeDeps(owner, meta))).toBe('unchanged');
    const unknown = new MetaApiError({ errorClass: 'unknown', graphCode: null, graphSubcode: null });
    expect(await lifecycle.applyConnectionFailure(owner.ctx, { id: row.id, credentialGeneration: 0 }, unknown,
      lifeDeps(owner, meta))).toBe('unchanged');
    expect((await connections.readConnectionRecord(owner.ctx, { supabase: owner.user.client }))?.last_error_class)
      .toBe('authentication');
  });
});
