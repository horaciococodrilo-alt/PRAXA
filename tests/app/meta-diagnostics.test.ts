import { randomInt, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import pg from 'pg';

import type { TenantContext } from '@/modules/tenant/context';
import { resolveIntegrationsTestTarget, resolveSqlTestTarget } from '../../scripts/lib/sql-target.mjs';
import { verifiedTestDbConfig } from '../../scripts/lib/test-db-client.mjs';
import { anonClient, blockedReason, cleanupRun, createConfirmedUser, pendingCleanupCount,
  remoteProjectReachable, RUN_ID, type TestUser } from './helpers';

vi.mock('server-only', () => ({}));

/**
 * M26a.1 por Data API y worker_api reales contra el proyecto desechable (T-04, T-05, T-11 y la
 * base de T-23). Datos sintéticos sembrados como administrador; todo se borra con la empresa.
 */

type Diag = typeof import('@/modules/diagnostics');
type Worker = ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi>;

const LIMITS = '{"lookbackDays":28,"maxWindowDays":28,"maxPagesPerLevel":1,"maxMetadataPages":1,"maxEntities":1,"maxPayloadBytes":100000,"maxDurationMs":1000,"finalizationReserveMs":1000,"leaseSeconds":2,"maxRetries":2,"retryDelayMs":500}';
const UNKNOWN_ATTR = '{"known":false,"report_time":"impression","unified":true,"settings":[]}';

type Seeded = { user: TestUser; ctx: TenantContext; connectionId: string };

async function seedCompany(admin: pg.Client, prefix: string): Promise<Seeded> {
  const user = await createConfirmedUser(prefix);
  const created = await user.client.rpc('create_company_for_current_user',
    { p_name: `Empresa sintética ${RUN_ID} ${prefix}` }).single<{ id: string }>();
  if (created.error || !created.data) throw new Error('No se pudo crear la empresa sintética.');
  const connectionId = randomUUID();
  const companyId = created.data.id;
  await admin.query(`select 1 from worker_api.create_pending_connection($1,$2,$3,'negocio_sintetico',
    'AAAA','AAAAAAAAAAAAAAAA','AAAAAAAAAAAAAAAAAAAAAA==',1,'system_user','app_sintetica','{ads_read}',null)`,
  [user.id, companyId, connectionId]);
  await admin.query(`select 1 from worker_api.confirm_connection($1,$2,$3,$4,'USD','UTC',true)`,
    [user.id, companyId, connectionId, `act_${randomInt(1_000_000, 2_000_000_000)}`]);
  const runId = randomUUID();
  await admin.query(`select 1 from worker_api.start_sync_run($1,$2,$3,0,$4,$5,current_date-27,current_date,$6::jsonb)`,
    [user.id, companyId, connectionId, runId, 'e'.repeat(64), LIMITS]);
  await admin.query(`insert into public.meta_insight_snapshots (id,company_id,connection_id,sync_run_id,level,
      fetched_at,window_from,window_to,currency,timezone,pages,validated_pages,complete,result,failure_reason,
      error_class,parameters,duration_ms,request_payload)
    select gen_random_uuid(),$1,$2,$3,lvl,now(),current_date-60,current_date,'USD','UTC',1,1,true,'complete',
      null,null,'{}'::jsonb,1,'{}'::jsonb
      from unnest(array['account','campaign','adset','ad']) lvl`, [companyId, connectionId, runId]);
  await admin.query(`insert into public.meta_entities (entity_ref,company_id,connection_id,level,external_id,parent_ref)
    values (gen_random_uuid(),$1,$2,'account','acct',null)`, [companyId, connectionId]);
  return { user, ctx: { user_id: user.id, company_id: companyId, role: 'owner', request_id: randomUUID() },
    connectionId };
}

/** Entidades de un nivel y su cobertura diaria, generadas en SQL. */
async function seedLevel(admin: pg.Client, s: Seeded, level: 'campaign' | 'adset' | 'ad', count: number,
  days: number, row: { spend: string; impressions: string; clicks: string }): Promise<void> {
  const parentLevel = level === 'campaign' ? 'account' : level === 'adset' ? 'campaign' : 'adset';
  await admin.query(`insert into public.meta_entities (entity_ref,company_id,connection_id,level,external_id,parent_ref)
    select gen_random_uuid(),$1::uuid,$2::uuid,$3::text,$3::text||n,(select entity_ref from public.meta_entities
      where connection_id=$2::uuid and level=$4::text order by external_id limit 1)
      from generate_series(1,$5::int) n`, [s.ctx.company_id, s.connectionId, level, parentLevel, count]);
  await admin.query(`with ents as (
      select entity_ref, parent_ref, external_id from public.meta_entities where connection_id=$2::uuid and level=$3::text),
    docs as (select jsonb_agg(jsonb_build_object('entity_ref',entity_ref,'level',$3::text,'parent_ref',parent_ref,
        'name','Entidad sintética '||external_id,'effective_status','ACTIVE','objective',null,
        'metadata_fetched_at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'attribution',$7::jsonb)) as entities,
      jsonb_agg(jsonb_build_object('entity_ref',entity_ref,'spend',$4::text,'impressions',$5::text,'reach',null,
        'clicks',$6::text,'inline_link_clicks','1','ctr',null,'cpc',null,'cpm',null,'frequency',null,
        'actions',jsonb_build_array(jsonb_build_object('action_type','purchase','variant','value',
          'count','1','value','3.5')),'attribution',$7::jsonb)) as rows from ents)
    insert into public.meta_daily_coverage (connection_id,level,date,company_id,snapshot_id,fetched_at,
      captured_before_day_end,currency,timezone,entities,rows)
    select $2::uuid,$3::text,current_date-1-i,$1::uuid,(select id from public.meta_insight_snapshots where connection_id=$2::uuid and level=$3::text),
      now(),false,'USD','UTC',docs.entities,docs.rows
      from docs cross join generate_series(0,$8::int-1) i
    on conflict (connection_id,level,date) do update set entities=excluded.entities, rows=excluded.rows`,
  [s.ctx.company_id, s.connectionId, level, row.spend, row.impressions, row.clicks, UNKNOWN_ATTR, days]);
}

async function seedAccount(admin: pg.Client, s: Seeded, days: number, spend: string): Promise<void> {
  await admin.query(`insert into public.meta_daily_coverage (connection_id,level,date,company_id,snapshot_id,
      fetched_at,captured_before_day_end,currency,timezone,entities,rows)
    select $2::uuid,'account',current_date-1-i,$1::uuid,(select id from public.meta_insight_snapshots where connection_id=$2 and level='account'),
      now(),false,'USD','UTC',
      jsonb_build_array(jsonb_build_object('entity_ref',a.entity_ref,'level','account','parent_ref',null,
        'name','Cuenta sintética','effective_status',null,'objective',null,
        'metadata_fetched_at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'attribution',$4::jsonb)),
      jsonb_build_array(jsonb_build_object('entity_ref',a.entity_ref,'spend',$3::text,'impressions','1000','reach',null,
        'clicks','20','inline_link_clicks','10','ctr',null,'cpc',null,'cpm',null,'frequency',null,
        'actions',jsonb_build_array(jsonb_build_object('action_type','purchase','variant','value','count','2','value','30')),
        'attribution',$4::jsonb))
      from public.meta_entities a cross join generate_series(0,$5::int-1) i
     where a.connection_id=$2::uuid and a.level='account'
    on conflict (connection_id,level,date) do update set rows=excluded.rows`,
  [s.ctx.company_id, s.connectionId, spend, UNKNOWN_ATTR, days]);
}

async function setSummary(admin: pg.Client, connectionId: string, status: string,
  finished: string | null, lease: string, account = 'complete'): Promise<void> {
  await admin.query(`update public.integration_connections c set meta_sync_summary = jsonb_build_object(
      'version',1,'credential_generation',c.credential_generation,
      'window_from',(current_date-28)::text,'window_to',(current_date-1)::text,'max_window_days',28,
      'started_at',to_char((now()-interval '2 days') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'lease_expires_at',to_char((now()+$4::interval) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'finished_at',case when $3::text is null then null
        else to_char((now()-$3::interval) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
      'status',$2::text,
      'levels',jsonb_build_object('account',case when $5::text = 'complete' then jsonb_build_object('status','complete',
          'reason','complete','fetched_at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'finished_at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
          else '{"status":"pending","reason":null,"fetched_at":null,"finished_at":null}'::jsonb end,
        'campaign','{"status":"pending","reason":null,"fetched_at":null,"finished_at":null}'::jsonb,
        'adset','{"status":"pending","reason":null,"fetched_at":null,"finished_at":null}'::jsonb,
        'ad','{"status":"pending","reason":null,"fetched_at":null,"finished_at":null}'::jsonb))
    where c.id = $1`, [connectionId, status, finished, lease, account]);
}

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
}

describe('M26a.1: diagnóstico por Data API y worker_api reales', () => {
  let admin: pg.Client;
  let worker: Worker;
  let diag: Diag;
  let main: Seeded;
  let stranger: TestUser;
  const rpcOf = (user: TestUser) => (fn: string, args: Record<string, unknown>) => user.client.rpc(fn, args);
  const reservations = async (companyId: string) => Number((await admin.query(
    'select count(*) from private.meta_diagnostic_reservations where company_id=$1', [companyId])).rows[0].count);

  beforeAll(async () => {
    const integrations = resolveIntegrationsTestTarget(process.env);
    if (!integrations.ok) throw new Error(integrations.problems?.join(' ') ?? 'Destino de pruebas inválido.');
    const sql = resolveSqlTestTarget(process.env);
    if (!sql.ok) throw new Error('Destino SQL de prueba inválido.');
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);
    if (!(await remoteProjectReachable())) throw new Error('El proyecto de pruebas no responde.');
    const db = await import('@/modules/integrations/db/worker-api');
    diag = await import('@/modules/diagnostics');
    worker = db.createWorkerApi({ connectionString: integrations.connectionString });
    admin = new pg.Client(verifiedTestDbConfig(sql.connectionString, 'praxa-diagnostics-test'));
    await admin.connect();
    main = await seedCompany(admin, 'm26a-main');
    stranger = await createConfirmedUser('m26a-other');
    const other = await stranger.client.rpc('create_company_for_current_user',
      { p_name: `Empresa sintética ${RUN_ID} m26a ajena` }).single<{ id: string }>();
    if (other.error || !other.data) throw new Error('No se pudo crear la empresa ajena.');
    await seedAccount(admin, main, 56, '1.50');
    await setSummary(admin, main.connectionId, 'completed', '1 minute', '-1 minute');
  }, 120_000);

  afterAll(async () => {
    try {
      await worker?.end();
      await admin?.end();
    } finally {
      await cleanupRun();
      expect(pendingCleanupCount()).toBe(0);
    }
  });

  it('T-04: cada motivo devuelve su razón y no deja reserva', async () => {
    const rpc = rpcOf(main.user);
    const eligibility = await diag.readEligibility(rpc, main.connectionId);
    expect(eligibility.reason).toBe('no_settings');
    const finished = (await admin.query(`select meta_sync_summary->>'finished_at' f from public.integration_connections
      where id=$1`, [main.connectionId])).rows[0].f as string;
    const reserve = () => diag.reserveDiagnostic(worker, { ...main.ctx, request_id: randomUUID() },
      { connectionId: main.connectionId, generation: 0, syncFinishedAt: finished });
    expect(await reserve()).toBe('no_settings');
    expect(await diag.saveSettings(worker, main.ctx, { goal_kind: 'purchase', metric_ref: 'actions:purchase' }))
      .toBe('saved');
    await admin.query(`update public.integration_connections set status='needs_reauth',
      last_error_class='authentication', last_error_message='Error sintético' where id=$1`, [main.connectionId]);
    expect(await reserve()).toBe('connection_not_active');
    await admin.query(`update public.integration_connections set status='active', last_error_class=null,
      last_error_message=null where id=$1`, [main.connectionId]);
    await setSummary(admin, main.connectionId, 'running', null, '5 minutes', 'pending');
    expect((await diag.readEligibility(rpc, main.connectionId)).reason).toBe('sync_running');
    expect(await reserve()).toBe('sync_running');
    await setSummary(admin, main.connectionId, 'failed', '1 hour', '-1 hour');
    expect(await reserve()).toBe('sync_not_usable');
    await setSummary(admin, main.connectionId, 'completed', '25 hours', '-25 hours');
    expect(await reserve()).toBe('sync_stale');
    await setSummary(admin, main.connectionId, 'completed', '2 hours', '-2 hours');
    const reportId = randomUUID();
    await admin.query(`insert into public.diagnostic_reports (company_id,connection_id,credential_generation,request_id,
        generated_at,window_from,window_to,sync_finished_at,schema_version,methodology_version,settings,evidence,
        output,web_sources,model_requested,model_reported,usage)
      values ($1,$2,0,$3,now()-interval '1 hour',current_date-28,current_date-1,now(),1,'meta-diag-1',
        '{"goal_kind":"purchase","metric_ref":"actions:purchase"}','{"items":[],"totals":{},"manifest":{}}',
        '{}','[]','modelo_sintetico','modelo_sintetico','{"calls":1,"batches":0,"steps":[]}')`,
    [main.ctx.company_id, main.connectionId, reportId]);
    const now = (await admin.query(`select meta_sync_summary->>'finished_at' f from public.integration_connections
      where id=$1`, [main.connectionId])).rows[0].f as string;
    expect(await diag.reserveDiagnostic(worker, { ...main.ctx, request_id: randomUUID() },
      { connectionId: main.connectionId, generation: 0, syncFinishedAt: now })).toBe('sync_not_after_report');
    expect((await diag.readEligibility(rpc, main.connectionId)).reason).toBe('sync_not_after_report');
    await admin.query('delete from public.diagnostic_reports where request_id=$1', [reportId]);
    expect(await reservations(main.ctx.company_id)).toBe(0);
  }, 60_000);

  it('T-05: concurrencia, reintentos, sync_changed con microsegundos y generación', async () => {
    await setSummary(admin, main.connectionId, 'completed', '1 minute', '-1 minute');
    const rpc = rpcOf(main.user);
    const eligibility = await diag.readEligibility(rpc, main.connectionId);
    expect(eligibility.eligible).toBe(true);
    expect(eligibility.sync_finished_at).toMatch(/\.\d{6}Z$/);
    const finished = eligibility.sync_finished_at as string;
    const older = new Date(Date.parse(finished) - 60_000).toISOString();
    const args = { connectionId: main.connectionId, generation: 0, syncFinishedAt: finished };

    expect(await diag.reserveDiagnostic(worker, { ...main.ctx, request_id: randomUUID() },
      { ...args, syncFinishedAt: older })).toBe('sync_changed');
    expect(await diag.reserveDiagnostic(worker, { ...main.ctx, request_id: randomUUID() },
      { ...args, generation: 1 })).toBe('connection_changed');
    expect(await reservations(main.ctx.company_id)).toBe(0);

    const a = { ...main.ctx, request_id: randomUUID() };
    const b = { ...main.ctx, request_id: randomUUID() };
    const both = await Promise.all([diag.reserveDiagnostic(worker, a, args), diag.reserveDiagnostic(worker, b, args)]);
    expect([...both].sort()).toEqual(['in_progress', 'reserved']);
    const winner = both[0] === 'reserved' ? a : b;
    expect(await diag.reserveDiagnostic(worker, winner, args)).toBe('already_reserved');
    expect(await reservations(main.ctx.company_id)).toBe(1);

    const window = diag.windowsFor(eligibility.window_to as string);
    const report = { schema_version: 1, methodology_version: 'meta-diag-1', window,
      settings: { goal_kind: 'purchase', metric_ref: 'actions:purchase' }, sync_finished_at: finished,
      evidence: { items: [], totals: {}, manifest: {} }, output: { marker: 'concurrente' }, web_sources: [],
      model_requested: 'modelo_sintetico', model_reported: 'modelo_sintetico',
      usage: { calls: 1, batches: 0, steps: [] } };
    const published = await Promise.all([
      diag.publishDiagnostic(worker, winner, { connectionId: main.connectionId, generation: 0, report }),
      diag.publishDiagnostic(worker, winner, { connectionId: main.connectionId, generation: 0, report }),
    ]);
    expect([...published].sort()).toEqual(['already_published', 'published']);
    const stored = await main.user.client.from('diagnostic_reports').select('output, request_id, prev_from');
    expect(stored.error).toBeNull();
    expect(stored.data).toEqual([{ output: { marker: 'concurrente' }, request_id: winner.request_id,
      prev_from: window.prev_from }]);
    expect(await reservations(main.ctx.company_id)).toBe(0);
    expect((await diag.readEligibility(rpc, main.connectionId)).reason).toBe('sync_not_after_report');
  }, 60_000);

  it('T-23 (base): ajeno y anon no leen; cambio de generación antes de publicar conserva el anterior', async () => {
    const theirs = await stranger.client.from('diagnostic_reports').select('id');
    expect(theirs.error).toBeNull();
    expect(theirs.data).toEqual([]);
    const settings = await stranger.client.from('diagnostic_settings').select('company_id');
    expect(settings.data).toEqual([]);
    const elig = await diag.readEligibility(rpcOf(stranger), main.connectionId);
    expect(elig.reason).toBe('connection_not_active');
    const anon = anonClient();
    const anonRead = await anon.from('diagnostic_reports').select('id');
    expect(anonRead.data ?? []).toEqual([]);
    const anonRpc = await anon.rpc('meta_diagnostic_eligibility', { p_connection_id: main.connectionId });
    expect(anonRpc.error).not.toBeNull();

    await admin.query(`update public.diagnostic_reports set generated_at = now() - interval '25 hours'
      where company_id=$1`, [main.ctx.company_id]);
    await setSummary(admin, main.connectionId, 'completed', '1 minute', '-1 minute');
    const before = (await admin.query('select md5(r::text) h from public.diagnostic_reports r where company_id=$1',
      [main.ctx.company_id])).rows[0].h;
    const eligibility = await diag.readEligibility(rpcOf(main.user), main.connectionId);
    expect(eligibility.eligible).toBe(true);
    const ctx = { ...main.ctx, request_id: randomUUID() };
    expect(await diag.reserveDiagnostic(worker, ctx, { connectionId: main.connectionId, generation: 0,
      syncFinishedAt: eligibility.sync_finished_at as string })).toBe('reserved');
    await admin.query('update public.integration_connections set credential_generation = 1 where id=$1', [main.connectionId]);
    const window = diag.windowsFor(eligibility.window_to as string);
    expect(await diag.publishDiagnostic(worker, ctx, { connectionId: main.connectionId, generation: 0, report: {
      schema_version: 1, methodology_version: 'meta-diag-1', window,
      settings: { goal_kind: 'purchase', metric_ref: 'actions:purchase' },
      sync_finished_at: eligibility.sync_finished_at, evidence: { items: [], totals: {}, manifest: {} },
      output: {}, web_sources: [], model_requested: 'm', model_reported: null,
      usage: { calls: 0, batches: 0, steps: [] } } })).toBe('connection_changed');
    expect((await admin.query('select md5(r::text) h from public.diagnostic_reports r where company_id=$1',
      [main.ctx.company_id])).rows[0].h).toBe(before);
    expect(await diag.releaseDiagnostic(worker, ctx)).toBe(true);
    await admin.query('update public.integration_connections set credential_generation = 0 where id=$1', [main.connectionId]);
  }, 60_000);

  it('T-11: decimales exactos y recorrido por clave de más de 1000 entidades', async () => {
    await seedLevel(admin, main, 'campaign', 2, 2, { spend: '9007199254740993.125', impressions: '9007199254740993', clicks: '3' });
    await seedLevel(admin, main, 'adset', 1, 2, { spend: '1', impressions: '10', clicks: '1' });
    await seedLevel(admin, main, 'ad', 1100, 2, { spend: '0.01', impressions: '10', clicks: '1' });
    const rpc = rpcOf(main.user);
    const window = diag.windowsFor((await diag.readEligibility(rpc, main.connectionId)).window_to as string);
    const campaigns = await diag.readAllEntities(rpc, { connectionId: main.connectionId, level: 'campaign',
      window, comparison: true, metricRef: 'actions:purchase' });
    expect(campaigns.rows).toHaveLength(2);
    expect(campaigns.rows[0].cur_spend).toBe('18014398509481986.250');
    expect(campaigns.rows[0].cur_impressions).toBe('18014398509481986');
    expect(campaigns.rows[0].cur_result_value).toBe('7.0');
    expect(campaigns.rows[0].cur_attributed_return).toBe('0.000000');
    const ads = await diag.readAllEntities(rpc, { connectionId: main.connectionId, level: 'ad', window,
      comparison: false, metricRef: 'actions:purchase', pageSize: 500 });
    expect(ads.rows).toHaveLength(1100);
    expect(ads.pages).toBe(3);
    expect(new Set(ads.rows.map((r) => r.entity_ref)).size).toBe(1100);
    const account = await diag.readAccountMetrics(rpc, { connectionId: main.connectionId, window,
      metricRef: 'actions:purchase' });
    expect(account.current.spend).toBe('42.00');
    expect(account.current.days_with_data).toBe(28);
    expect(account.previous?.days_with_data).toBe(28);
    const tooLong = await main.user.client.rpc('meta_diagnostic_account_metrics', { p_connection_id: main.connectionId,
      p_from: window.prev_from, p_to: window.to, p_prev_from: null, p_prev_to: null, p_metric_ref: 'actions:purchase' });
    expect(tooLong.error?.code).toBe('22023');
  }, 120_000);

  it('T-11 (H-03/H-08): fixture máximo de 500 entidades × 56 días bajo el timeout del rol', async () => {
    const big = await seedCompany(admin, 'm26a-max');
    await seedAccount(admin, big, 56, '12.34');
    await seedLevel(admin, big, 'campaign', 1, 56, { spend: '5', impressions: '100', clicks: '2' });
    await seedLevel(admin, big, 'adset', 1, 56, { spend: '5', impressions: '100', clicks: '2' });
    await seedLevel(admin, big, 'ad', 500, 56, { spend: '1.23', impressions: '1000', clicks: '12' });
    await diag.saveSettings(worker, big.ctx, { goal_kind: 'purchase', metric_ref: 'actions:purchase' });
    await setSummary(admin, big.connectionId, 'completed', '1 minute', '-1 minute');
    await admin.query('analyze public.meta_daily_coverage');
    const rpc = rpcOf(big.user);
    const timings: Record<string, number[]> = { eligibility: [], account: [], entity_page_500: [],
      entity_page_200: [], breakdowns: [], action_types: [] };
    let window = diag.windowsFor('2026-01-28');
    let prepared: ReturnType<Diag['prepareDiagnostic']> | null = null;
    for (let i = 0; i < 10; i += 1) {
      let t = performance.now();
      const eligibility = await diag.readEligibility(rpc, big.connectionId);
      timings.eligibility.push(performance.now() - t);
      window = diag.windowsFor(eligibility.window_to as string);
      t = performance.now();
      const account = await diag.readAccountMetrics(rpc, { connectionId: big.connectionId, window, metricRef: 'actions:purchase' });
      timings.account.push(performance.now() - t);
      t = performance.now();
      const ads = await diag.readAllEntities(rpc, { connectionId: big.connectionId, level: 'ad', window,
        comparison: true, metricRef: 'actions:purchase', pageSize: 500 });
      timings.entity_page_500.push(performance.now() - t);
      expect(ads.rows).toHaveLength(500);
      t = performance.now();
      const page = await rpc('meta_diagnostic_entity_metrics', { p_connection_id: big.connectionId, p_level: 'ad',
        p_from: window.from, p_to: window.to, p_prev_from: window.prev_from, p_prev_to: window.prev_to,
        p_metric_ref: 'actions:purchase', p_after_spend: null, p_after_ref: null, p_limit: 200 });
      timings.entity_page_200.push(performance.now() - t);
      expect(page.error).toBeNull();
      t = performance.now();
      const breakdowns = await diag.readBreakdowns(rpc, { connectionId: big.connectionId, window, metricRef: 'actions:purchase' });
      timings.breakdowns.push(performance.now() - t);
      t = performance.now();
      await diag.readActionTypes(rpc, big.connectionId, window);
      timings.action_types.push(performance.now() - t);
      if (i === 0) {
        const campaigns = await diag.readAllEntities(rpc, { connectionId: big.connectionId, level: 'campaign',
          window, comparison: true, metricRef: 'actions:purchase' });
        const adsets = await diag.readAllEntities(rpc, { connectionId: big.connectionId, level: 'adset',
          window, comparison: true, metricRef: 'actions:purchase' });
        prepared = diag.prepareDiagnostic({ settings: { goal_kind: 'purchase', metric_ref: 'actions:purchase' },
          window, account, entities: { campaign: campaigns.rows, adset: adsets.rows, ad: ads.rows }, breakdowns,
          levelStatus: { account: 'complete', campaign: 'complete', adset: 'complete', ad: 'complete' },
          pagesRead: 3 });
      }
    }
    const summary = Object.fromEntries(Object.entries(timings).map(([fn, samples]) =>
      [fn, { p95_ms: Math.round(p95(samples)), max_ms: Math.round(Math.max(...samples)) }]));
    if (!prepared || prepared.status !== 'ready') throw new Error('se esperaba paquete');
    // Informe persistido más grande plausible: totales, desgloses y diez entidades citadas, con
    // la salida en sus longitudes máximas (Diseño §3).
    const cited = prepared.evidence.filter((item) => item.entity_alias === null
      || Number(item.entity_alias.slice(1)) <= 10);
    const output = { executive_summary: { text: 'x'.repeat(1200), evidence_ids: cited.slice(0, 20).map((e) => e.id) },
      overall_performance: { text: 'x'.repeat(1200), evidence_ids: cited.slice(0, 20).map((e) => e.id) },
      top_entities: Array.from({ length: 10 }, () => ({ note: 'x'.repeat(400), evidence_ids: ['ev_e1_spend'] })),
      opportunities: Array.from({ length: 3 }, () => ({ title: 'x'.repeat(120), rationale: 'x'.repeat(600),
        action: 'x'.repeat(400), check_plan: 'x'.repeat(400), uncertainty: 'x'.repeat(300), evidence_ids: ['ev_e1_spend'] })) };
    const reportBytes = Buffer.byteLength(JSON.stringify({ evidence: { items: cited, manifest: prepared.manifest }, output }));
    console.log(`M26a T-11 medición: ${JSON.stringify(summary)}; batches=${prepared.batches.length}; ` +
      `paquete_tokens=${diag.estimateTokens(prepared.package)}; informe_bytes=${reportBytes}`);
    for (const [fn, value] of Object.entries(summary)) {
      expect(value.p95_ms, `p95 de ${fn}`).toBeLessThanOrEqual(4000);
    }
    expect(reportBytes).toBeLessThanOrEqual(1_048_576);
  }, 600_000);
});
