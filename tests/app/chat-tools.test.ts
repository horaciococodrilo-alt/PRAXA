import { randomInt, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import pg from 'pg';

import type { MetaFetch } from '@/modules/integrations/meta/client';
import type { SyncLimits } from '@/modules/integrations/repository/sync-calls';
import type { TenantContext } from '@/modules/tenant/context';
import { resolveIntegrationsTestTarget, resolveSqlTestTarget } from '../../scripts/lib/sql-target.mjs';
import { verifiedTestDbConfig } from '../../scripts/lib/test-db-client.mjs';
import { blockedReason, cleanupRun, createConfirmedUser, pendingCleanupCount,
  remoteProjectReachable, RUN_ID } from './helpers';

vi.mock('server-only', () => ({}));

const LIMITS: SyncLimits = { lookbackDays: 2, maxWindowDays: 2, maxPagesPerLevel: 2,
  maxMetadataPages: 2, maxEntities: 10, maxPayloadBytes: 500_000, maxDurationMs: 60_000,
  finalizationReserveMs: 10_000, leaseSeconds: 70, maxRetries: 0, retryDelayMs: 1 };
const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

describe('M25a.1: consultas del chat por Data API real', () => {
  let worker: ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi>;
  let owner: Awaited<ReturnType<typeof createConfirmedUser>>;
  let stranger: Awaited<ReturnType<typeof createConfirmedUser>>;
  let ctx: TenantContext;
  let connectionId: string;
  let accountRef: string;
  let tools: typeof import('@/modules/chat/tools/execute');

  beforeAll(async () => {
    const target = resolveIntegrationsTestTarget(process.env);
    if (!target.ok) throw new Error(target.problems?.join(' ') ?? 'Destino de pruebas inválido.');
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);
    if (!(await remoteProjectReachable())) throw new Error('El proyecto de pruebas no responde.');
    const [db, credentials, keyrings, connections, insights, client, executor] = await Promise.all([
      import('@/modules/integrations/db/worker-api'),
      import('@/modules/integrations/repository/credentials'),
      import('@/modules/integrations/crypto/keyring'),
      import('@/modules/integrations/repository/connections'),
      import('@/modules/integrations/meta/insights'),
      import('@/modules/integrations/meta/client'),
      import('@/modules/chat/tools/execute'),
    ]);
    tools = executor;
    worker = db.createWorkerApi({ connectionString: target.connectionString });
    owner = await createConfirmedUser('m25a-chat-owner');
    stranger = await createConfirmedUser('m25a-chat-other');
    const otherCompany = await stranger.client.rpc('create_company_for_current_user',
      { p_name: `Empresa sintética ${RUN_ID} chat ajena` }).single<{ id: string }>();
    if (otherCompany.error || !otherCompany.data) throw new Error('No se pudo crear empresa ajena.');
    const created = await owner.client.rpc('create_company_for_current_user',
      { p_name: `Empresa sintética ${RUN_ID} chat` }).single<{ id: string }>();
    if (created.error || !created.data) throw new Error('No se pudo crear empresa sintética.');
    ctx = { user_id: owner.id, company_id: created.data.id, role: 'owner', request_id: randomUUID() };
    const keyring = keyrings.getCredentialKeyring();
    const pending = await credentials.executePreparedCredentialOperation(ctx,
      credentials.preparePendingConnectionWithCredential(ctx, {
        token: 'token-sint', tokenType: 'system_user', issuedForAppId: 'app_sintetica',
        grantedScopes: ['ads_read'], expiresAt: null, clientBusinessId: 'negocio_sint',
      }, { keyring }), { workerApi: worker });
    connectionId = pending.connectionId;
    const account = `act_${randomInt(1_000_000, 2_000_000_000)}`;
    await worker.call('confirm_connection', [ctx.user_id, ctx.company_id, connectionId,
      account, 'USD', 'UTC', true]);
    const fetch: MetaFetch = async (url) => {
      if (!url.pathname.endsWith('/insights') || url.searchParams.get('level') !== 'account') {
        return new Response('{"data":[]}');
      }
      return new Response(JSON.stringify({ data: [
        { date_start: day(1), date_stop: day(1), account_id: account.slice(4),
          spend: '9007199254740993.125', impressions: '9007199254740993', clicks: '2' },
        { date_start: day(0), date_stop: day(0), account_id: account.slice(4),
          spend: '4503599627370496.5625', impressions: '10', clicks: '1' },
      ] }));
    };
    const outcome = await insights.syncMetaInsights({ tenant: async () => ctx,
      workerApi: () => worker, keyring: () => keyring,
      readConnection: (actor) => connections.readConnectionRecord(actor, { supabase: owner.client }),
      http: (timeoutMs) => client.createMetaHttpClient({ fetch, timeoutMs }),
      log: () => {}, limits: LIMITS, breakdowns: [] });
    expect(outcome.result).toBe('completa');
    const accounts = await insights.listCapturedEntities(connectionId, 'account', { supabase: owner.client });
    accountRef = accounts[0].entity_ref;
  }, 120_000);

  afterAll(async () => {
    try { await worker?.end(); }
    finally { await cleanupRun(); expect(pendingCleanupCount()).toBe(0); }
  });

  it('T-15/17/20/31: JWT propio conserva precisión; ajeno no ve cifras ni registro', async () => {
    const period = { from: day(1), to: day(0) };
    const connection = { id: connectionId, status: 'active' as const,
      external_account_id: null, currency: 'USD', timezone: 'UTC' };
    const call = await tools.resolveToolCall('total', { entity_ref: accountRef,
      metric: 'spend', period }, { connection }, period);
    const result = await tools.executeTool(call, { connection }, 't1', { supabase: owner.client });
    expect(result.values[0].value).toBe('13510798882111489.6875');
    const counts = await tools.executeTool(await tools.resolveToolCall('total', {
      entity_ref: accountRef, metric: 'impressions', period,
    }, { connection }, period), { connection }, 't2', { supabase: owner.client });
    expect(counts.values[0].value).toBe('9007199254741003');
    const other = await tools.executeTool(call, { connection }, 't1', { supabase: stranger.client });
    expect(other.status).toBe('not_found');
    expect(other.values).toEqual([]);
    const records = await owner.client.from('chat_query_records').select('id');
    expect(records.error?.code).toBe('42501');
    const ninetyThree = await owner.client.rpc('chat_coverage', { p_connection_id: connectionId,
      p_level: 'account', p_from: day(92), p_to: day(0) });
    expect(ninetyThree.error).toBeNull();
    const ninetyFour = await owner.client.rpc('chat_coverage', { p_connection_id: connectionId,
      p_level: 'account', p_from: day(93), p_to: day(0) });
    expect(ninetyFour.error?.code).toBe('22023');
  }, 60_000);

  it('T-76: variación negativa llega como decimal firmado exacto', async () => {
    const raw = await owner.client.rpc('chat_percent_change', {
      p_connection_id: connectionId, p_entity_ref: accountRef, p_metric: 'spend',
      p_a_from: day(1), p_a_to: day(1), p_b_from: day(0), p_b_to: day(0),
      p_action_type: null });
    expect(raw.error).toBeNull();
    expect(raw.data.status).toBe('ok');
    expect(raw.data.values).toHaveLength(1);
    expect(raw.data.values[0].value).toBe('-50.000000');
  });

  it('T-28: ranking de 500 anuncios y 93 días termina por Data API bajo el timeout del rol', async () => {
    const target = resolveSqlTestTarget(process.env);
    if (!target.ok) throw new Error('Destino SQL de prueba inválido.');
    const admin = new pg.Client(verifiedTestDbConfig(target.connectionString, 'praxa-chat-ranking-test'));
    const runId = randomUUID();
    const snapshotId = randomUUID();
    const from = '2026-01-01';
    const to = '2026-04-03';
    await admin.connect();
    try {
      await admin.query(`insert into public.meta_sync_runs(id,company_id,connection_id,
        credential_generation,ownership_token,started_at,lease_expires_at,finished_at,
        window_from,window_to,status,limits)
        select $1,company_id,connection_id,credential_generation,ownership_token,
          now()-interval '2 minutes',now()-interval '1 minute',now(),$3,$4,'completed',limits
        from public.meta_sync_runs where connection_id=$2 order by started_at desc limit 1`,
      [runId, connectionId, from, to]);
      await admin.query(`insert into public.meta_insight_snapshots(id,company_id,connection_id,
        sync_run_id,level,fetched_at,window_from,window_to,currency,timezone,pages,
        validated_pages,complete,result,failure_reason,error_class,parameters,duration_ms,
        request_payload)
        select $1,company_id,connection_id,$2,'ad',now(),$4,$5,currency,timezone,
          pages,validated_pages,complete,result,failure_reason,error_class,parameters,
          duration_ms,request_payload from public.meta_insight_snapshots
        where connection_id=$3 and level='account' order by fetched_at desc limit 1`,
      [snapshotId, runId, connectionId, from, to]);
      await admin.query(`insert into public.meta_entities(company_id,connection_id,level,external_id)
        select $1,$2,'ad',n::text from generate_series(1,500) n`, [ctx.company_id, connectionId]);
      await admin.query(`with docs as (
        select jsonb_agg(jsonb_build_object('entity_ref',e.entity_ref,'level','ad',
          'parent_ref',null,'name','Anuncio sintético','effective_status',null,
          'objective',null,'metadata_fetched_at',now(),
          'attribution','{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb)
          order by e.entity_ref) as entities,
          jsonb_agg(jsonb_build_object('entity_ref',e.entity_ref,'spend','1.00',
          'impressions','10','reach',null,'clicks','2','inline_link_clicks',null,
          'ctr',null,'cpc',null,'cpm',null,'frequency',null,'actions','[]'::jsonb,
          'attribution','{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb)
          order by e.entity_ref) as rows
        from public.meta_entities e where e.connection_id=$1 and e.level='ad')
        insert into public.meta_daily_coverage(connection_id,level,date,company_id,
          snapshot_id,fetched_at,captured_before_day_end,currency,timezone,entities,rows)
        select $1,'ad',d::date,$2,$3,now(),false,'USD','UTC',docs.entities,docs.rows
        from generate_series($4::date,$5::date,interval '1 day') d cross join docs`,
      [connectionId, ctx.company_id, snapshotId, from, to]);
      await admin.query('analyze public.meta_daily_coverage');
      await admin.query('analyze public.meta_entities');
      const role = await admin.query<{ setconfig: string[] }>(`select s.setconfig
        from pg_db_role_setting s join pg_roles r on r.oid=s.setrole
        where r.rolname='authenticated'`);
      expect(role.rows.flatMap((row) => row.setconfig)).toContain('statement_timeout=8s');
      const started = performance.now();
      const response = await owner.client.rpc('chat_ranking', {
        p_connection_id: connectionId, p_level: 'ad', p_metric: 'spend',
        p_from: from, p_to: to, p_action_type: null, p_order: 'desc',
        p_limit: 20, p_include_trend: false,
      });
      expect(response.error).toBeNull();
      expect(response.data.status).toBe('ok');
      expect(response.data.values).toHaveLength(22);
      const listed = response.data.values.slice(0, 20).map((item: { entity_ref: string }) => item.entity_ref);
      expect(listed).toEqual([...listed].sort());
      console.info('T-28 ranking Data API sin tendencia:',
        Math.round(performance.now() - started), 'ms');
      const trendStarted = performance.now();
      const withTrend = await owner.client.rpc('chat_ranking', {
        p_connection_id: connectionId, p_level: 'ad', p_metric: 'spend',
        p_from: from, p_to: to, p_action_type: null, p_order: 'desc',
        p_limit: 20, p_include_trend: true,
      });
      expect(withTrend.error).toBeNull();
      expect(withTrend.data.values).toEqual(response.data.values);
      expect(Object.keys(withTrend.data.extra.trends)).toHaveLength(20);
      console.info('T-28 ranking Data API con tendencia:',
        Math.round(performance.now() - trendStarted), 'ms');
      const coverage = await owner.client.rpc('chat_coverage', {
        p_connection_id: connectionId, p_level: 'ad', p_from: from, p_to: to,
      });
      expect(coverage.error).toBeNull();
      expect(coverage.data.composition).toMatchObject({ days_total: 93, days_with_value: 93 });
    } finally {
      try {
        await admin.query('delete from public.meta_sync_runs where id=$1', [runId]);
        await admin.query("delete from public.meta_entities where connection_id=$1 and level='ad'",
          [connectionId]);
      } finally { await admin.end(); }
    }
  }, 90_000);

  it('T-23: rango de capturas y parcialidad del día anterior sobreviven la Data API', async () => {
    const target = resolveSqlTestTarget(process.env);
    if (!target.ok) throw new Error('Destino SQL de prueba inválido.');
    const admin = new pg.Client(verifiedTestDbConfig(target.connectionString, 'praxa-chat-capture-test'));
    await admin.connect();
    try {
      await admin.query(`update public.meta_daily_coverage
        set fetched_at=now()-interval '1 day',captured_before_day_end=true
        where connection_id=$1 and level='account' and date=$2`, [connectionId, day(1)]);
      await admin.query(`update public.meta_daily_coverage
        set fetched_at=now(),captured_before_day_end=false
        where connection_id=$1 and level='account' and date=$2`, [connectionId, day(0)]);
    } finally { await admin.end(); }
    const period = { from: day(1), to: day(0) };
    const connection = { id: connectionId, status: 'active' as const,
      external_account_id: null, currency: 'USD', timezone: 'UTC' };
    const call = await tools.resolveToolCall('total', { entity_ref: accountRef,
      metric: 'spend', period }, { connection }, period);
    const result = await tools.executeTool(call, { connection }, 't1', { supabase: owner.client });
    expect(result.composition?.days_captured_partial).toBe(1);
    expect(result.composition?.partial).toBe(true);
    expect(result.composition?.fetched_at_min).not.toBe(result.composition?.fetched_at_max);
  });

  it('T-32/37: arriendo concurrente y registro tardío se descartan', async () => {
    const turnA = randomUUID();
    const turnB = randomUUID();
    const attempts = await Promise.allSettled([
      worker.call('begin_chat_turn', [ctx.user_id, ctx.company_id, turnA, 90]),
      worker.call('begin_chat_turn', [ctx.user_id, ctx.company_id, turnB, 90]),
    ]);
    const winner = attempts.find((attempt) => attempt.status === 'fulfilled');
    const loser = attempts.find((attempt) => attempt.status === 'rejected');
    expect(winner?.status).toBe('fulfilled');
    expect(loser?.status).toBe('rejected');
    if (winner?.status !== 'fulfilled' || loser?.status !== 'rejected') throw new Error('Arriendo inválido.');
    expect(loser.reason).toMatchObject({ code: 'chat_turn_in_progress' });
    const turn = winner.value[0].begin_chat_turn;
    expect([turnA, turnB]).toContain(turn);
    const [ended] = await worker.call('end_chat_turn', [ctx.user_id, ctx.company_id, turn]);
    expect(ended.end_chat_turn).toBe(true);
    await worker.call('begin_disconnect', [ctx.user_id, ctx.company_id, connectionId]);
    const [written] = await worker.call('record_query', [ctx.user_id, ctx.company_id,
      randomUUID(), connectionId, 0, 'Pregunta sintética', [], 'answered', null, 10,
      'modelo_sintetico', null]);
    expect(written).toMatchObject({ written: false });
  });
});
