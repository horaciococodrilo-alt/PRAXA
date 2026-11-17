import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { GA4_REPORT_CATALOG } from '@/modules/integrations/ga4/reports';
import { SecretValue } from '@/modules/integrations/crypto/seal';
import type { Ga4Http } from '@/modules/integrations/ga4/google';

import { resolveIntegrationsTestTarget, resolveSqlTestTarget } from '../../scripts/lib/sql-target.mjs';
import { verifiedTestDbConfig } from '../../scripts/lib/test-db-client.mjs';
import { blockedReason, cleanupRun, createConfirmedUser, pendingCleanupCount,
  remoteProjectReachable, RUN_ID, type TestUser } from './helpers';

vi.mock('server-only', () => ({}));

describe('M16f: sincronización GA4 con Google simulado y base desechable', () => {
  let user: TestUser;
  let workerApi: ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi>;
  let ctx: import('@/modules/tenant/context').TenantContext;
  let sync: typeof import('@/modules/integrations/ga4/sync');
  let connections: typeof import('@/modules/integrations/repository/connections');
  let connectionId: string;
  let sql: pg.Client;

  beforeAll(async () => {
    const target = resolveIntegrationsTestTarget(process.env);
    if (!target.ok) throw new Error(target.problems?.join(' ') ?? 'Destino desechable no verificado.');
    const sqlTarget = resolveSqlTestTarget(process.env);
    if (!sqlTarget.ok) throw new Error('Destino SQL desechable no verificado.');
    sql = new pg.Client(verifiedTestDbConfig(sqlTarget.connectionString, 'praxa-ga4-sync'));
    await sql.connect();
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);
    if (!(await remoteProjectReachable())) throw new Error('El proyecto desechable no responde.');
    const [s, c, w] = await Promise.all([
      import('@/modules/integrations/ga4/sync'),
      import('@/modules/integrations/repository/connections'),
      import('@/modules/integrations/db/worker-api'),
    ]);
    sync = s; connections = c;
    workerApi = w.createWorkerApi({ connectionString: target.connectionString });
    user = await createConfirmedUser('ga4-sync');
    const { data, error } = await user.client.rpc('create_company_for_current_user',
      { p_name: `Empresa sintética ${RUN_ID} ga4-sync` }).single<{ id: string }>();
    if (error || !data) throw new Error('No se pudo crear empresa sintética.');
    ctx = { user_id: user.id, company_id: data.id, role: 'owner', request_id: randomUUID() };
    connectionId = randomUUID();
    await workerApi.call('create_pending_connection', [ctx.user_id, ctx.company_id, connectionId,
      'ga4', null, 'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1,
      'google_refresh_token', '123456789',
      ['https://www.googleapis.com/auth/analytics.readonly'], null]);
    await workerApi.call('confirm_connection', [ctx.user_id, ctx.company_id, connectionId,
      '12345', 'USD', 'UTC', true]);
  });

  afterAll(async () => {
    try { await workerApi?.end(); await sql?.end(); }
    finally { await cleanupRun(); expect(pendingCleanupCount()).toBe(0); }
  });

  it('publica solo ventanas completas y reanuda sin repetir preflight', async () => {
    const calls: string[] = [];
    const workerFailures: string[] = [];
    const names = (values: readonly string[]) => values.map((apiName) => ({ apiName }));
    const http: Ga4Http = {
      exchangeCode: async () => { throw new Error('No corresponde.'); },
      refresh: async () => ({ access_token: 'access-synthetic', token_type: 'Bearer', expires_in: 3600 }),
      getAdmin: async (path) => {
        calls.push('admin');
        if (path === 'properties/12345') return { name: 'properties/12345',
          propertyType: 'PROPERTY_TYPE_ORDINARY', displayName: 'Demo', currencyCode: 'USD', timeZone: 'UTC' };
        return { dataStreams: [{ type: 'WEB_DATA_STREAM',
          webStreamData: { defaultUri: 'https://example.test' } }] };
      },
      getMetadata: async () => {
        calls.push('metadata');
        return { dimensions: names([...new Set(GA4_REPORT_CATALOG.flatMap((r) => r.dimensions))]),
          metrics: names([...new Set(GA4_REPORT_CATALOG.flatMap((r) => r.metrics))]) };
      },
      checkCompatibility: async (_id, _token, body) => {
        calls.push('compatibility');
        const d = body.dimensions as Array<{ name: string }>;
        const m = body.metrics as Array<{ name: string }>;
        return { dimensionCompatibilities: d.map((x) => ({ dimensionMetadata: { apiName: x.name },
          compatibility: 'COMPATIBLE' })),
        metricCompatibilities: m.map((x) => ({ metricMetadata: { apiName: x.name },
          compatibility: 'COMPATIBLE' })) };
      },
      runReport: async (_id, _token, body) => {
        calls.push('report');
        if (body.limit === '100') return { metadata: {}, rows: [] };
        return { metadata: {}, rowCount: 0, rows: [] };
      },
    };
    const deps: Partial<import('@/modules/integrations/ga4/sync').Ga4SyncDeps> = {
      tenant: async () => ctx,
      readConnection: (c) => connections.readConnectionRecord(c, { supabase: user.client }, 'ga4'),
      readStatus: async (_c, id) => {
        const { data, error } = await user.client.from('ga4_sync_status')
          .select('phase,coverage_from,coverage_through,last_step_status,preflight,preflight_at,time_zone,currency_code,display_name')
          .eq('connection_id', id).maybeSingle();
        if (error) throw error;
        return data as Awaited<ReturnType<import('@/modules/integrations/ga4/sync').Ga4SyncDeps['readStatus']>>;
      },
      readQuality: async (_c, id, since) => {
        const { data, error } = await user.client.from('ga4_report_quality')
          .select('report_id,report_version,window_from,window_to,fetched_at')
          .eq('connection_id', id).gte('fetched_at', since);
        if (error) throw error;
        return (data ?? []) as Awaited<ReturnType<import('@/modules/integrations/ga4/sync').Ga4SyncDeps['readQuality']>>;
      },
      readToken: async () => new SecretValue('refresh-synthetic'),
      workerApi: () => ({ call: async (fn, args) => {
        try { return await workerApi.call(fn, args); }
        catch (error) {
          workerFailures.push(`${fn}:${error instanceof Error ? error.constructor.name : 'unknown'}:${
            error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown'}`);
          throw error;
        }
      } }),
      config: () => ({ clientId: '123.apps.googleusercontent.com', clientSecret: 'synthetic',
        redirectUri: 'https://example.test/api/integraciones/ga4/callback', appId: '123' }),
      http, log: () => {},
    };
    const first = await sync.syncGa4(deps);
    const { data: firstStatus } = await user.client.from('ga4_sync_status')
      .select('last_step_status,last_error_kind').eq('connection_id', connectionId).maybeSingle();
    expect({ first, calls: calls.length, failures: workerFailures, status: firstStatus?.last_step_status,
      kind: firstStatus?.last_error_kind }).toEqual({ first: 'parcial', calls: 25,
      failures: [], status: 'incomplete', kind: null });
    const { count: firstCount } = await user.client.from('ga4_report_quality')
      .select('*', { count: 'exact', head: true }).eq('connection_id', connectionId);
    expect(firstCount).toBe(13);
    const abandonedRun = randomUUID();
    await workerApi.call('ga4_start_sync', [ctx.user_id, ctx.company_id, connectionId, 0,
      abandonedRun, randomUUID(), new Date(Date.now() + 240_000).toISOString(), 'backfill']);
    await sql.query({
      text: `update private.ga4_sync_runs set started_at = now() - interval '3 minutes',
        lease_expires_at = now() - interval '1 minute' where id = $1`,
      values: [abandonedRun],
    });
    expect(await sync.syncGa4(deps)).toBe('completa');
    const retired = await sql.query<{ status: string; error_kind: string }>({
      text: 'select status, error_kind from private.ga4_sync_runs where id = $1',
      values: [abandonedRun],
    });
    expect(retired.rows[0]).toMatchObject({ status: 'incomplete', error_kind: 'transitorio' });
    const { count } = await user.client.from('ga4_report_quality')
      .select('*', { count: 'exact', head: true }).eq('connection_id', connectionId);
    expect(count).toBe(25);
    const { data: status } = await user.client.rpc('get_ga4_sync_status',
      { p_connection_id: connectionId });
    expect(status?.[0]?.last_step_status).toBe('complete');
    expect(calls.filter((x) => x === 'admin')).toHaveLength(2);

    // M16f-T-09: las seis herramientas del chat leen los getters reales bajo RLS con el JWT del
    // dueño; con informes completos de cero filas, los días cerrados son cero y los provisionales
    // quedan desconocidos, igual que en SQL.
    const [{ executeGa4Tool }, { supabaseRpc }, { projectToolArgs }] = await Promise.all([
      import('@/modules/chat/tools/ga4'), import('@/modules/chat/tools/tiendanube'),
      import('@/modules/chat/tools/schema')]);
    const through = String(status?.[0]?.coverage_through).slice(0, 10);
    const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000)
      .toISOString().slice(0, 10);
    const period = { from: shift(through, -9), to: through };
    const flat = { level: null, entity_ref: null, metric: null, period: null, period_a: null, period_b: null,
      action_type: null, order: null, limit: null, include_trend: null, dimension: null, granularity: null,
      from_month: null, to_month: null, max_offset: null };
    const tool = (name: string, args: Record<string, unknown> = {}) => executeGa4Tool(
      projectToolArgs(name, { ...flat, ...args }, { period, accountEntityRef: null, month: through.slice(0, 7) }),
      { id: connectionId, status: 'active', currency: 'USD', timezone: 'UTC' }, 't1',
      { rpc: supabaseRpc(user.client), today: shift(through, 1) });
    const traffic = await tool('ga4_trafico', { period });
    const sessions = traffic.values.filter((v) => v.metric === 'ga4_sessions');
    expect(sessions).toHaveLength(10);
    expect(sessions.slice(0, 7).every((v) => v.value === '0' && v.absence === null)).toBe(true);
    expect(sessions.slice(7).every((v) => v.value === null && v.absence === 'desconocido')).toBe(true);
    for (const name of ['ga4_embudo', 'ga4_productos', 'ga4_campanias', 'ga4_cohortes', 'ga4_cobertura']) {
      const result = await tool(name);
      expect(result.status).toBe('ok');
      expect(JSON.stringify(result)).not.toContain('12345');
      expect(result.values.every((v) => v.value === null || v.value === '0')).toBe(true);
    }
    expect((await tool('ga4_cobertura')).extra).toMatchObject({ source: 'ga4', covered_through: through });

    // CA-38c: desconexión entre la respuesta de Google y la escritura.
    let disconnected = false;
    deps.http = { ...http, runReport: async (_id, _token, body) => {
      if (body.limit === '10000' && !disconnected) {
        disconnected = true;
        await workerApi.call('begin_disconnect', [ctx.user_id, ctx.company_id, connectionId]);
      }
      return body.limit === '100' ? { metadata: {}, rows: [] }
        : { metadata: {}, rowCount: 0, rows: [] };
    } };
    expect(await sync.syncGa4(deps)).toBe('conexion_cambio');
    const afterDisconnect = await sql.query<{ n: number }>({
      text: 'select count(*)::integer n from public.ga4_report_quality where connection_id = $1',
      values: [connectionId],
    });
    expect(afterDisconnect.rows[0].n).toBe(25);
  }, 120_000);
});
