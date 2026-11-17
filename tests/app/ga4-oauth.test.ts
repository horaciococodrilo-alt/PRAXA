import { randomUUID } from 'node:crypto';

import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Ga4ApiError } from '@/modules/integrations/ga4/google';
import { GA4_REPORT_CATALOG } from '@/modules/integrations/ga4/reports';

import { resolveIntegrationsTestTarget } from '../../scripts/lib/sql-target.mjs';
import { blockedReason, cleanupRun, createConfirmedUser, pendingCleanupCount,
  remoteProjectReachable, RUN_ID, type TestUser } from './helpers';

vi.mock('server-only', () => ({}));

const origin = 'https://praxa.test';
const propertyId = '12345';
const config = { clientId: '123-example.apps.googleusercontent.com', clientSecret: 'synthetic',
  redirectUri: `${origin}/api/integraciones/ga4/callback`, appId: '123' };

describe('M16f: OAuth GA4 contra base desechable y Google simulado', () => {
  let user: TestUser;
  let workerApi: ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi>;
  let ctx: import('@/modules/tenant/context').TenantContext;
  let oauth: typeof import('@/modules/integrations/ga4/oauth');
  let selection: typeof import('@/modules/integrations/ga4/selection');
  let connections: typeof import('@/modules/integrations/repository/connections');
  let credentials: typeof import('@/modules/integrations/repository/credentials');
  let keyring: ReturnType<typeof import('@/modules/integrations/crypto/keyring').getCredentialKeyring>;

  beforeAll(async () => {
    const target = resolveIntegrationsTestTarget(process.env);
    if (!target.ok) throw new Error(target.problems?.join(' ') ?? 'Destino desechable no verificado.');
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);
    if (!(await remoteProjectReachable())) throw new Error('El proyecto desechable no responde.');
    const [o, s, c, cr, k, w] = await Promise.all([
      import('@/modules/integrations/ga4/oauth'),
      import('@/modules/integrations/ga4/selection'),
      import('@/modules/integrations/repository/connections'),
      import('@/modules/integrations/repository/credentials'),
      import('@/modules/integrations/crypto/keyring'),
      import('@/modules/integrations/db/worker-api'),
    ]);
    oauth = o; selection = s; connections = c; credentials = cr;
    keyring = k.getCredentialKeyring();
    workerApi = w.createWorkerApi({ connectionString: target.connectionString });
    user = await createConfirmedUser('ga4-oauth');
    const { data, error } = await user.client.rpc('create_company_for_current_user',
      { p_name: `Empresa sintética ${RUN_ID} ga4` }).single<{ id: string }>();
    if (error || !data) throw new Error('No se pudo crear empresa sintética.');
    ctx = { user_id: user.id, company_id: data.id, role: 'owner', request_id: randomUUID() };
  });

  afterAll(async () => {
    try { await workerApi?.end(); }
    finally { await cleanupRun(); expect(pendingCleanupCount()).toBe(0); }
  });

  it('consume K02, guarda credencial cifrada, confirma propiedad y desconecta sin Google', async () => {
    const googleCalls: string[] = [];
    let listedPropertyId = propertyId;
    const http: import('@/modules/integrations/ga4/google').Ga4Http = {
      exchangeCode: async () => {
        googleCalls.push('exchange');
        return { access_token: 'access-synthetic', refresh_token: 'refresh-synthetic',
          token_type: 'Bearer', expires_in: 3600,
          scope: 'https://www.googleapis.com/auth/analytics.readonly' };
      },
      refresh: async () => {
        googleCalls.push('refresh');
        return { access_token: 'access-synthetic', token_type: 'Bearer', expires_in: 3600 };
      },
      getAdmin: async (path) => {
        googleCalls.push(path);
        if (path === 'accountSummaries') return { accountSummaries: [{ propertySummaries: [
          { property: `properties/${listedPropertyId}`, propertyType: 'PROPERTY_TYPE_ORDINARY',
            displayName: 'Tienda sintética' },
        ] }] };
        if (path === `properties/${propertyId}`) return { name: `properties/${propertyId}`,
          displayName: 'Tienda sintética', propertyType: 'PROPERTY_TYPE_ORDINARY',
          currencyCode: 'ARS', timeZone: 'America/Argentina/Buenos_Aires' };
        if (path === `properties/${propertyId}/dataStreams`) return { dataStreams: [
          { type: 'WEB_DATA_STREAM', webStreamData: { defaultUri: 'https://www.shop.test' } },
        ] };
        throw new Error('Ruta Google inesperada.');
      },
      getMetadata: async () => {
        const names = (values: readonly string[]) => values.map((apiName) => ({ apiName }));
        return { dimensions: names([...new Set(GA4_REPORT_CATALOG.flatMap((r) => r.dimensions))]),
          metrics: names([...new Set(GA4_REPORT_CATALOG.flatMap((r) => r.metrics))]) };
      },
      checkCompatibility: async (_id, _token, request) => {
        const d = request.dimensions as Array<{ name: string }>;
        const m = request.metrics as Array<{ name: string }>;
        return { dimensionCompatibilities: d.map((x) => ({ dimensionMetadata: { apiName: x.name },
          compatibility: 'COMPATIBLE' })),
        metricCompatibilities: m.map((x) => ({ metricMetadata: { apiName: x.name },
          compatibility: 'COMPATIBLE' })) };
      },
      runReport: async () => ({ metadata: {}, rows: [] }),
    };
    const readConnection = (c: typeof ctx) => connections.readConnectionRecord(c,
      { supabase: user.client }, 'ga4');
    const deps: Partial<import('@/modules/integrations/ga4/oauth').Ga4OAuthDeps> = {
      tenant: async () => ctx, config: () => config, http, workerApi: () => workerApi,
      keyring: () => keyring, readLive: (c) => connections.readLiveConnection(c, 'ga4',
        { supabase: user.client }), readConnection, log: () => {},
    };
    const start = await oauth.handleGa4Start(new NextRequest(`${origin}/api/integraciones/ga4/iniciar`,
      { method: 'POST', headers: { Origin: origin } }), deps);
    expect(start.status).toBe(303);
    const state = new URL(start.headers.get('location')!).searchParams.get('state')!;
    const nonce = start.cookies.get('__Host-praxa_oauth_binding')!.value;
    const callback = new NextRequest(`${origin}/api/integraciones/ga4/callback?state=${state}&code=synthetic`,
      { headers: { Cookie: `__Host-praxa_oauth_binding=${nonce}` } });
    const otherBrowser = await oauth.handleGa4Callback(new NextRequest(callback.url), deps);
    expect(new URL(otherBrowser.headers.get('location')!).searchParams.get('ga4')).toBe('rechazado');
    const result = await oauth.handleGa4Callback(callback, deps);
    expect(new URL(result.headers.get('location')!).searchParams.get('ga4')).toBe('pendiente');
    const replay = await oauth.handleGa4Callback(callback, deps);
    expect(new URL(replay.headers.get('location')!).searchParams.get('ga4')).toBe('rechazado');
    const pending = await readConnection(ctx);
    expect(pending?.status).toBe('pending_selection');
    const token = await credentials.readCredential(ctx, pending!.id,
      { workerApi, keyring, provider: 'ga4' });
    expect(token.token.reveal()).toBe('refresh-synthetic');
    const selectionDeps: Partial<import('@/modules/integrations/ga4/selection').Ga4SelectionDeps> = {
      tenant: async () => ctx, readConnection, readStoreDomain: async () => null,
      readToken: async () => token.token, config: () => config, http,
      workerApi: () => workerApi, log: () => {},
    };
    const key = selection.selectionKeyFor(pending!.id, propertyId);
    expect((await selection.previewGa4Property(key, selectionDeps))?.hosts).toEqual(['shop.test']);
    expect(await selection.confirmGa4Property(key, true, selectionDeps)).toBe('conectado');
    expect((await readConnection(ctx))?.status).toBe('active');
    await selection.applyGa4Failure(ctx, (await readConnection(ctx))!,
      new Ga4ApiError('sin_acceso_propiedad', 'permission'), workerApi);
    expect((await readConnection(ctx))?.status).toBe('needs_reauth');
    async function reconnect() {
      const begin = await oauth.handleGa4Start(new NextRequest(`${origin}/api/integraciones/ga4/iniciar`,
        { method: 'POST', headers: { Origin: origin } }), deps);
      const state = new URL(begin.headers.get('location')!).searchParams.get('state')!;
      const nonce = begin.cookies.get('__Host-praxa_oauth_binding')!.value;
      return oauth.handleGa4Callback(new NextRequest(`${origin}/api/integraciones/ga4/callback?state=${state}&code=synthetic`,
        { headers: { Cookie: `__Host-praxa_oauth_binding=${nonce}` } }), deps);
    }
    listedPropertyId = '67890';
    expect(new URL((await reconnect()).headers.get('location')!).searchParams.get('ga4')).toBe('otra_propiedad');
    expect((await readConnection(ctx))?.status).toBe('needs_reauth');
    listedPropertyId = propertyId;
    expect(new URL((await reconnect()).headers.get('location')!).searchParams.get('ga4')).toBe('reautorizado');
    expect((await readConnection(ctx))?.status).toBe('active');
    const beforeDisconnect = googleCalls.length;
    expect(await (await import('@/modules/integrations/lifecycle')).disconnectGa4({
      tenant: async () => ctx, readConnection, workerApi: () => workerApi, keyring: () => keyring,
      log: () => {},
    })).toBe('desconectado');
    expect(googleCalls).toHaveLength(beforeDisconnect);
    expect(await readConnection(ctx)).toBeNull();
  });
});
