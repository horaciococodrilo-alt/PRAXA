import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { MetaFetch } from '@/modules/integrations/meta/client';
import type { SyncDeps } from '@/modules/integrations/meta/insights';
import type { SyncLimits } from '@/modules/integrations/repository/sync-calls';
import type { TenantContext } from '@/modules/tenant/context';
import { resolveIntegrationsTestTarget } from '../../scripts/lib/sql-target.mjs';
import { blockedReason, cleanupRun, createConfirmedUser, pendingCleanupCount, remoteProjectReachable,
  RUN_ID, type TestUser } from './helpers';

vi.mock('server-only', () => ({}));

const LIMITS: SyncLimits = { lookbackDays: 3, maxWindowDays: 3, maxPagesPerLevel: 3, maxMetadataPages: 3, maxEntities: 50,
  maxPayloadBytes: 500_000, maxDurationMs: 60_000, finalizationReserveMs: 10_000, leaseSeconds: 70, maxRetries: 2, retryDelayMs: 1 };
const SHORT_LEASE: SyncLimits = { ...LIMITS, maxDurationMs: 500, finalizationReserveMs: 500, leaseSeconds: 1 };
const DAY = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const error = (code: number) => json({ error: { code } }, 400);
type Route = (url: URL) => Response | Promise<Response>;
type Owner = { user: TestUser; ctx: TenantContext; connectionId: string; account: string };

describe('M16c: sincronización con base desechable y Meta simulada', () => {
  let attempts: typeof import('@/modules/integrations/repository/attempts');
  let insights: typeof import('@/modules/integrations/meta/insights');
  let client: typeof import('@/modules/integrations/meta/client');
  let connections: typeof import('@/modules/integrations/repository/connections');
  let credentials: typeof import('@/modules/integrations/repository/credentials');
  let lifecycleCalls: typeof import('@/modules/integrations/repository/lifecycle-calls');
  let syncCalls: typeof import('@/modules/integrations/repository/sync-calls');
  let keyrings: typeof import('@/modules/integrations/crypto/keyring');
  let worker: ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi> | undefined;

  beforeAll(async () => {
    const target = resolveIntegrationsTestTarget(process.env);
    if (!target.ok) throw new Error(target.problems?.join(' ') ?? 'Destino de pruebas inválido.');
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);
    if (!(await remoteProjectReachable())) throw new Error('El proyecto de pruebas no responde.');
    [attempts, insights, client, connections, credentials, lifecycleCalls, syncCalls, keyrings] = await Promise.all([
      import('@/modules/integrations/repository/attempts'), import('@/modules/integrations/meta/insights'), import('@/modules/integrations/meta/client'),
      import('@/modules/integrations/repository/connections'), import('@/modules/integrations/repository/credentials'),
      import('@/modules/integrations/repository/lifecycle-calls'), import('@/modules/integrations/repository/sync-calls'),
      import('@/modules/integrations/crypto/keyring'),
    ]);
    const db = await import('@/modules/integrations/db/worker-api');
    worker = db.createWorkerApi({ connectionString: target.connectionString });
  });

  afterAll(async () => {
    try { await worker?.end(); }
    finally { await cleanupRun(); expect(pendingCleanupCount()).toBe(0); }
  });

  async function company(label: string) {
    const user = await createConfirmedUser(`m16c-${label}`);
    const { data, error: failure } = await user.client.rpc('create_company_for_current_user',
      { p_name: `Empresa sintética ${RUN_ID} ${label}` }).single<{ id: string }>();
    if (failure || !data) throw new Error('No se pudo crear empresa sintética.');
    return { user, ctx: { user_id: user.id, company_id: data.id, role: 'owner', request_id: randomUUID() } as TenantContext };
  }

  async function pending(label: string) {
    const base = await company(label);
    const keyring = keyrings.getCredentialKeyring();
    const created = await credentials.executePreparedCredentialOperation(base.ctx, credentials.preparePendingConnectionWithCredential(base.ctx,
      { token: 'token-sint', tokenType: 'system_user', issuedForAppId: 'app_sintetica', grantedScopes: ['ads_read'], expiresAt: null,
        clientBusinessId: 'negocio_sint' }, { keyring }), { workerApi: worker! });
    return { ...base, connectionId: created.connectionId };
  }

  async function active(label: string): Promise<Owner> {
    const base = await pending(label);
    const account = `act_${randomInt(1_000_000, 2_000_000_000)}`;
    await worker!.call('confirm_connection', [base.ctx.user_id, base.ctx.company_id, base.connectionId, account, 'USD', 'UTC', true]);
    return { ...base, account };
  }

  function meta(owner: Owner, routes: Record<string, Route> = {}) {
    const seen: string[] = [];
    const fetch: MetaFetch = async (url) => {
      const key = url.pathname.replace(`/v26.0/${owner.account}/`, '').replace('/v26.0/', '');
      seen.push(`${key}:${url.searchParams.get('level') ?? ''}`);
      return routes[key] ? routes[key](url) : json({ data: [] });
    };
    return { seen, http: (timeoutMs: number) => client.createMetaHttpClient({ fetch, timeoutMs }) };
  }

  function deps(owner: Owner, graph: ReturnType<typeof meta>, over: Partial<SyncDeps> = {}): Partial<SyncDeps> {
    return { tenant: async () => owner.ctx, workerApi: () => worker!, keyring: () => keyrings.getCredentialKeyring(),
      readConnection: (ctx) => connections.readConnectionRecord(ctx, { supabase: owner.user.client }),
      http: graph.http, log: () => {}, limits: LIMITS, ...over };
  }

  const read = (owner: Owner) => connections.readConnectionRecord(owner.ctx, { supabase: owner.user.client });
  const coverage = (owner: Owner, level: 'account' | 'campaign' | 'adset' | 'ad', from = daysAgo(2), to = today(), entityRef?: string) =>
    insights.readMetaDailyCoverage({ connectionId: owner.connectionId, level, from, to, entityRef }, { supabase: owner.user.client });
  const status = (owner: Owner, viewer: TestUser = owner.user) =>
    insights.readMetaSyncStatus(owner.connectionId, { supabase: viewer.client });

  const row = (owner: Owner, extra: Record<string, unknown> = {}) => ({ date_start: today(), date_stop: today(),
    account_id: owner.account.replace('act_', ''), account_name: 'Cuenta sint', ...extra });

  it('M16c-T-02 lectura aislada por JWT: propio con texto, ajeno y referencias adulteradas sin calendario', async () => {
    const owner = await active('aislada'); const stranger = await company('aislada-b');
    const graph = meta(owner, { insights: (url) => json({ data: url.searchParams.get('level') === 'account'
      ? [row(owner, { spend: '1.50', impressions: '10' })] : [] }) });
    expect((await insights.syncMetaInsights(deps(owner, graph))).result).toBe('completa');
    const days = await coverage(owner, 'account');
    const filled = days.find((day) => day.presence === 'con_datos')!;
    expect(filled).toMatchObject({ spend: '1.50', impressions: '10', currency: 'USD', timezone: 'UTC', level: 'account', temporal_status: 'abierto', captured_before_day_end: true });
    expect(JSON.stringify(days)).not.toContain(owner.account);

    expect(await insights.readMetaDailyCoverage({ connectionId: owner.connectionId, level: 'account', from: daysAgo(2), to: today() },
      { supabase: stranger.user.client })).toEqual([]);
    expect(await insights.listCapturedEntities(owner.connectionId, 'account', { supabase: stranger.user.client })).toEqual([]);
    expect(await coverage(owner, 'account', daysAgo(2), today(), randomUUID())).toEqual([]);
    const direct = await stranger.user.client.from('meta_daily_coverage').select('date').eq('connection_id', owner.connectionId);
    expect(direct.data ?? []).toEqual([]);
    const hidden = await owner.user.client.from('meta_insight_snapshots').select('id');
    expect(hidden.error?.code).toBe('42501');
    const mine = await insights.listCapturedEntities(owner.connectionId, 'account', { supabase: owner.user.client });
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ level: 'account', name: 'Cuenta sint' });
    expect(Object.keys(mine[0])).not.toContain('external_id');
  });

  it('M16c-T-07 un nivel fallido deja su cobertura vieja y los demás se publican: parcial', async () => {
    const owner = await active('parcial');
    const campaign = { id: '4100', name: 'Vieja', effective_status: 'ACTIVE' };
    const first = meta(owner, { campaigns: () => json({ data: [campaign] }), insights: (url) => json({ data: url.searchParams.get('level') === 'campaign'
      ? [row(owner, { campaign_id: '4100', spend: '5.00' })] : url.searchParams.get('level') === 'account' ? [row(owner, { spend: '5.00' })] : [] }) });
    expect((await insights.syncMetaInsights(deps(owner, first))).result).toBe('completa');
    const before = (await coverage(owner, 'campaign')).find((day) => day.presence === 'con_datos')!;

    const second = meta(owner, { campaigns: () => json({ data: [campaign] }), insights: (url) => {
      const level = url.searchParams.get('level');
      if (level === 'campaign') return error(100);
      return json({ data: level === 'account' ? [row(owner, { spend: '6.00' })] : [] });
    } });
    expect((await insights.syncMetaInsights(deps(owner, second))).result).toBe('parcial');
    expect((await coverage(owner, 'account')).find((day) => day.presence === 'con_datos')?.spend).toBe('6.00');
    const after = (await coverage(owner, 'campaign')).find((day) => day.presence === 'con_datos')!;
    expect(after).toMatchObject({ spend: '5.00', snapshot_id: before.snapshot_id, fetched_at: before.fetched_at });
    const summary = await status(owner);
    expect(summary).toMatchObject({ effective_status: 'partial' });
    expect(summary?.summary?.levels).toMatchObject({ account: { status: 'complete' }, campaign: { status: 'incomplete', reason: 'meta_error' },
      adset: { status: 'complete' }, ad: { status: 'complete' } });
  });

  it('M16c-T-08 cuatro niveles vacíos: éxito global, días cubiertos y cero entidades inventadas', async () => {
    const owner = await active('vacia');
    const graph = meta(owner);
    expect((await insights.syncMetaInsights(deps(owner, graph))).result).toBe('completa');
    for (const level of ['account', 'campaign', 'adset', 'ad'] as const) {
      const days = await coverage(owner, level);
      expect(days).toHaveLength(3);
      for (const day of days) expect(day).toMatchObject({ presence: 'sin_fila_reportada', entity_ref: null, spend: null });
      expect(await insights.listCapturedEntities(owner.connectionId, level, { supabase: owner.user.client })).toEqual([]);
    }
    expect((await status(owner))?.effective_status).toBe('completed');
  });

  it('M16c-T-09 omitida, null, cero explícito, fila ausente y día no observado se distinguen', async () => {
    const owner = await active('presencia');
    const graph = meta(owner, { campaigns: () => json({ data: [{ id: '4200', name: 'A' }, { id: '4201', name: 'B' }] }),
      insights: (url) => json({ data: url.searchParams.get('level') === 'campaign'
        ? [row(owner, { campaign_id: '4200', spend: '0', reach: null })] : [] }) });
    expect((await insights.syncMetaInsights(deps(owner, graph))).result).toBe('completa');
    const days = await coverage(owner, 'campaign', today(), today());
    const withRow = days.find((day) => day.presence === 'con_datos')!;
    expect(withRow).toMatchObject({ spend: '0', reach: null, impressions: null, name: 'A' });
    expect(days.find((day) => day.name === 'B')).toMatchObject({ presence: 'sin_fila_reportada', spend: null });
    const window = await status(owner);
    const earlier = await coverage(owner, 'campaign', daysAgo(2), today(), withRow.entity_ref!);
    expect(window?.summary?.max_window_days).toBe(3);
    expect(earlier.find((day) => day.day === daysAgo(1))?.presence).toBe('sin_fila_reportada');

    const fresh = await active('presencia-sin-cobertura');
    const [never] = await coverage(fresh, 'account', today(), today());
    expect(never).toMatchObject({ presence: 'no_observado', entity_ref: null, snapshot_id: null, fetched_at: null, captured_before_day_end: null });
  });

  it('M16c-T-22 auth con posesión marca reauth y termina; las demás clases persisten; completed limpia', async () => {
    const owner = await active('errores');
    const graph = meta(owner, { insights: (url) => url.searchParams.get('level') === 'adset' ? error(4) : json({ data: [] }) });
    expect((await insights.syncMetaInsights(deps(owner, graph))).result).toBe('parcial');
    let current = await read(owner);
    expect(current).toMatchObject({ status: 'active', credential_generation: 0, last_error_class: 'rate_limit' });
    expect(current?.last_error_message).toContain('Meta limitó las llamadas.');
    expect((await status(owner))?.summary?.levels).toMatchObject({ adset: { status: 'failed' }, ad: { status: 'not_attempted', fetched_at: null } });

    const unknown = meta(owner, { insights: (url) => url.searchParams.get('level') === 'account' ? error(999) : json({ data: [] }) });
    expect((await insights.syncMetaInsights(deps(owner, unknown))).result).toBe('parcial');
    current = await read(owner);
    expect(current).toMatchObject({ last_error_class: 'unknown', status: 'active' });

    expect((await insights.syncMetaInsights(deps(owner, meta(owner)))).result).toBe('completa');
    current = await read(owner);
    expect(current).toMatchObject({ last_error_class: null, last_error_message: null });

    const auth = meta(owner, { insights: () => error(190) });
    expect((await insights.syncMetaInsights(deps(owner, auth))).result).toBe('requiere_reauth');
    current = await read(owner);
    expect(current).toMatchObject({ status: 'needs_reauth', last_error_class: 'authentication', credential_generation: 0 });
    expect(auth.seen.filter((entry) => entry.startsWith('insights'))).toHaveLength(1);
    expect((await status(owner))?.effective_status).toBe('failed');
    // Sin iniciar: needs_reauth lee, pero no sincroniza.
    const blocked = meta(owner);
    expect((await insights.syncMetaInsights(deps(owner, blocked))).result).toBe('error');
    expect(blocked.seen).toEqual([]);
  });

  it('M16c-T-22 una ejecución desplazada no escribe en la conexión y el reintento idéntico no reescribe', async () => {
    const owner = await active('desplazada');
    const a = { connectionId: owner.connectionId, expectedGeneration: 0, runId: randomUUID(), ownershipToken: randomBytes(32).toString('hex'),
      windowFrom: today(), windowTo: today(), limits: SHORT_LEASE };
    const started = await syncCalls.startSyncRun(owner.ctx, a, { workerApi: worker! });
    const shared = { connectionId: owner.connectionId, expectedGeneration: 0, runId: a.runId, ownershipToken: a.ownershipToken,
      fetchedAt: started.startedAt.toISOString(), pages: 1, durationMs: 1, payload: { entities: [], days: [] } };
    const failure = { ...shared, snapshotId: randomUUID(), level: 'account' as const, validatedPages: 0, failureReason: 'meta_error' as const,
      errorClass: 'rate_limit' as const, errorMessage: 'Graph 4: Meta limitó las llamadas.', stopRemaining: true };
    expect(await syncCalls.failSyncRun(owner.ctx, failure, { workerApi: worker! })).toMatchObject({ status: 'failed', snapshotResult: 'failed' });
    await syncCalls.recordConnectionError(owner.ctx, { connectionId: owner.connectionId, expectedGeneration: 0, errorClass: 'temporary',
      message: 'Meta tuvo un error temporal.' }, { workerApi: worker! });
    // Reintento idéntico de algo confirmado: responde igual y no vuelve a escribir la clase.
    expect(await syncCalls.failSyncRun(owner.ctx, failure, { workerApi: worker! })).toMatchObject({ status: 'failed', snapshotResult: 'failed' });
    expect((await read(owner))?.last_error_class).toBe('temporary');

    const b = { ...a, runId: randomUUID(), ownershipToken: randomBytes(32).toString('hex') };
    await syncCalls.startSyncRun(owner.ctx, b, { workerApi: worker! });
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    const c = { ...a, runId: randomUUID(), ownershipToken: randomBytes(32).toString('hex'), limits: LIMITS };
    await syncCalls.startSyncRun(owner.ctx, c, { workerApi: worker! });
    await expect(syncCalls.failSyncRun(owner.ctx, { ...failure, runId: b.runId, ownershipToken: b.ownershipToken, snapshotId: randomUUID() },
      { workerApi: worker! })).rejects.toMatchObject({ code: 'sync_ownership_lost' });
    await expect(syncCalls.failSyncRun(owner.ctx, { ...failure, runId: b.runId, ownershipToken: b.ownershipToken, snapshotId: randomUUID(),
      errorClass: 'authentication', errorMessage: 'Graph 190: Meta rechazó la credencial.' }, { workerApi: worker! }))
      .rejects.toMatchObject({ code: 'sync_ownership_lost' });
    expect(await read(owner)).toMatchObject({ status: 'active', last_error_class: 'temporary' });
  });

  it('M16c-T-23 desconexión y purga en vuelo: sin llamada siguiente ni reinserción, conexion_cambio', async () => {
    const owner = await active('purga-vuelo');
    let inFlight = false;
    const graph = meta(owner, { insights: async () => {
      if (!inFlight) {
        inFlight = true;
        await lifecycleCalls.beginDisconnect(owner.ctx, owner.connectionId, { workerApi: worker! });
        await lifecycleCalls.purgeConnection(owner.ctx, owner.connectionId, { workerApi: worker! });
      }
      return json({ data: [row(owner, { spend: '9.00' })] });
    } });
    expect((await insights.syncMetaInsights(deps(owner, graph))).result).toBe('conexion_cambio');
    expect(graph.seen.filter((entry) => entry.startsWith('insights'))).toHaveLength(1);
    expect(await read(owner)).toBeNull();
    expect(await lifecycleCalls.purgeConnection(owner.ctx, owner.connectionId, { workerApi: worker! })).toBe(false);
  });

  // H-E1-198: el corte de la Data API se ejercita de verdad, con más filas que su máximo.
  it('M16c-T-02 la cobertura se lee entera aunque supere el máximo de filas de la Data API', async () => {
    const owner = await active('volumen');
    const campaigns = Array.from({ length: 40 }, (_, i) => ({ id: String(1000 + i), name: `Campaña ${i}` }));
    const graph = meta(owner, { campaigns: () => json({ data: campaigns }) });
    const limits = { ...LIMITS, lookbackDays: 28, maxWindowDays: 28 };
    expect((await insights.syncMetaInsights(deps(owner, graph, { limits }))).result).toBe('completa');
    const days = await coverage(owner, 'campaign', daysAgo(27), today());
    expect(days).toHaveLength(40 * 28);
    expect(new Set(days.map((day) => `${day.day}:${day.entity_ref}`)).size).toBe(40 * 28);
    expect(days.at(-1)?.day).toBe(today());
  }, 120_000);

  // H-E1-200: el mismo reemplazo que hace `completeReauth`, con el rol real, mientras una llamada está en vuelo.
  it.each([['adsets', 0], ['insights', 1]] as const)('M16c-T-23 reemplazo real de la credencial durante %s: sin llamadas nuevas ni publicación', async (edge, insightCalls) => {
    const owner = await active(`reemplazo-${edge}`);
    const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    await attempts.createOAuthAttempt(owner.ctx, { purpose: 'reauth', stateHash: sha256(state), bindingHash: sha256(nonce), returnPath: '/app/integraciones',
      expiresAt: new Date(Date.now() + 5 * 60_000), expectedConnectionId: owner.connectionId }, { workerApi: worker! });
    const consumed = await attempts.consumeOAuthAttempt(owner.ctx, { stateHash: sha256(state), bindingHash: sha256(nonce) }, { workerApi: worker! });
    const keyring = keyrings.getCredentialKeyring();
    const graph = meta(owner, { [edge]: async () => {
      await credentials.replaceCredential(owner.ctx, { token: 'token-sint-nuevo', tokenType: 'system_user', issuedForAppId: 'app_sintetica',
        grantedScopes: ['ads_read'], expiresAt: null, connectionId: owner.connectionId, attemptId: consumed.attemptId }, { workerApi: worker!, keyring });
      return json({ data: [] });
    } });

    expect((await insights.syncMetaInsights(deps(owner, graph))).result).toBe('conexion_cambio');
    expect(graph.seen.filter((entry) => entry.startsWith('insights'))).toHaveLength(insightCalls);
    expect(graph.seen.at(-1)?.startsWith(edge)).toBe(true);

    expect(await read(owner)).toMatchObject({ status: 'active', credential_generation: 1 });
    const current = await credentials.readCredential(owner.ctx, owner.connectionId, { workerApi: worker!, keyring });
    expect(current.token.reveal()).toBe('token-sint-nuevo');
    const changed = await status(owner);
    expect(changed).toMatchObject({ effective_status: 'connection_changed', connection_changed: true });
    expect(changed?.summary?.levels.account.status).toBe('pending');
    expect((await coverage(owner, 'account')).filter((day) => day.presence === 'con_datos')).toEqual([]);
  });

  it('M16c-T-23 desconexión en vuelo sin purga y reautorización: la escritura tardía se rechaza', async () => {
    const owner = await active('desconexion-vuelo');
    const graph = meta(owner, { insights: async () => {
      await lifecycleCalls.beginDisconnect(owner.ctx, owner.connectionId, { workerApi: worker! });
      return json({ data: [] });
    } });
    // La última llamada del nivel ya está en vuelo: la escritura la frena SQL, no la relectura.
    expect((await insights.syncMetaInsights(deps(owner, graph))).result).toBe('conexion_cambio');
    expect(graph.seen.filter((entry) => entry.startsWith('insights'))).toHaveLength(1);
    expect((await status(owner))).toBeNull();

    const other = await active('generacion-vuelo');
    const stale = { connectionId: other.connectionId, expectedGeneration: 0, runId: randomUUID(), ownershipToken: randomBytes(32).toString('hex'),
      windowFrom: today(), windowTo: today(), limits: LIMITS };
    const started = await syncCalls.startSyncRun(other.ctx, stale, { workerApi: worker! });
    await lifecycleCalls.markNeedsReauth(other.ctx, { connectionId: other.connectionId, expectedGeneration: 0, errorClass: 'authentication',
      message: 'Meta rechazó la credencial.' }, { workerApi: worker! });
    await expect(syncCalls.publishSnapshot(other.ctx, { connectionId: other.connectionId, expectedGeneration: 0, runId: stale.runId,
      ownershipToken: stale.ownershipToken, snapshotId: randomUUID(), level: 'account', fetchedAt: started.startedAt.toISOString(), pages: 1,
      durationMs: 1, payload: { entities: [], days: [] } }, { workerApi: worker! })).rejects.toMatchObject({ code: 'invalid_transition' });
    const changed = await status(other);
    expect(changed).toMatchObject({ effective_status: 'connection_changed', connection_changed: true });
    expect(changed?.summary?.levels.account.status).toBe('pending');
  });

  it('M16c-T-35 estado por JWT: never, primer fallo, límite público, ajena y pendiente sin filas, lease vencido sin escribir', async () => {
    const owner = await active('estado');
    expect(await status(owner)).toEqual({ has_attempt: false, summary: null, effective_status: 'never', connection_changed: false });

    const failing = meta(owner, { insights: () => error(4) });
    expect((await insights.syncMetaInsights(deps(owner, failing))).result).toBe('incompleta');
    const first = await status(owner);
    expect(first).toMatchObject({ has_attempt: true, effective_status: 'failed' });
    expect(first?.summary?.levels).toMatchObject({ account: { status: 'incomplete', reason: 'meta_error' }, campaign: { status: 'not_attempted', reason: null } });
    expect((await coverage(owner, 'account', today(), today()))[0].presence).toBe('no_observado');

    const serialized = JSON.stringify(first);
    for (const secret of [owner.account, 'ownership', 'token', 'run_id']) expect(serialized).not.toContain(secret);

    // Sin resumen, 28 días; con resumen, el máximo público del intento.
    await expect(coverage(owner, 'account', daysAgo(3), today())).rejects.toThrow();

    const stranger = await company('estado-b');
    expect(await status(owner, stranger.user)).toBeNull();
    const direct = await owner.user.client.from('meta_sync_runs').select('id');
    expect(direct.error?.code).toBe('42501');

    const unconfirmed = await pending('estado-pendiente');
    expect(await insights.readMetaSyncStatus(unconfirmed.connectionId, { supabase: unconfirmed.user.client })).toBeNull();

    const short = await active('estado-vencido');
    await syncCalls.startSyncRun(short.ctx, { connectionId: short.connectionId, expectedGeneration: 0, runId: randomUUID(),
      ownershipToken: randomBytes(32).toString('hex'), windowFrom: today(), windowTo: today(), limits: SHORT_LEASE }, { workerApi: worker! });
    expect((await status(short))?.effective_status).toBe('running');
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    const expired = await status(short);
    expect(expired?.effective_status).toBe('expired');
    expect(expired?.summary?.status).toBe('running');
    expect((await status(short))?.summary).toEqual(expired?.summary);
  });
});
