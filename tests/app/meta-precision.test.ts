import { randomInt, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { MetaFetch } from '@/modules/integrations/meta/client';
import type { SyncLimits } from '@/modules/integrations/repository/sync-calls';
import type { TenantContext } from '@/modules/tenant/context';
import { resolveIntegrationsTestTarget } from '../../scripts/lib/sql-target.mjs';
import { blockedReason, cleanupRun, createConfirmedUser, pendingCleanupCount, remoteProjectReachable, RUN_ID } from './helpers';

vi.mock('server-only', () => ({}));

const LIMITS: SyncLimits = { lookbackDays: 1, maxWindowDays: 1, maxPagesPerLevel: 2, maxMetadataPages: 2, maxEntities: 10,
  maxPayloadBytes: 500_000, maxDurationMs: 60_000, finalizationReserveMs: 10_000, leaseSeconds: 70, maxRetries: 0, retryDelayMs: 1 };

// Fuera de la precisión de `number`: pasar por JSON numérico o por Number los alteraría.
const SPEND = '123456789012345678901234567890.123456789012345678';
const COUNT = '9007199254740993';
const RATE = '0.1000000000000000055511151231257827';
const ACTION_COUNT = '1234567890123456789.25';
const ACTION_VALUE = '98765432109876543210.75';

describe('M16c-T-13: precisión de punta a punta', () => {
  let worker: ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi> | undefined;

  beforeAll(async () => {
    const target = resolveIntegrationsTestTarget(process.env);
    if (!target.ok) throw new Error(target.problems?.join(' ') ?? 'Destino de pruebas inválido.');
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);
    if (!(await remoteProjectReachable())) throw new Error('El proyecto de pruebas no responde.');
    const db = await import('@/modules/integrations/db/worker-api');
    worker = db.createWorkerApi({ connectionString: target.connectionString });
  });

  afterAll(async () => {
    try { await worker?.end(); }
    finally { await cleanupRun(); expect(pendingCleanupCount()).toBe(0); }
  });

  it('Graph simulado → SQL → Data API → Zod conserva decimales y enteros exactos, sin number', async () => {
    const [insights, client, connections, credentials, keyrings] = await Promise.all([
      import('@/modules/integrations/meta/insights'), import('@/modules/integrations/meta/client'),
      import('@/modules/integrations/repository/connections'), import('@/modules/integrations/repository/credentials'),
      import('@/modules/integrations/crypto/keyring'),
    ]);
    const user = await createConfirmedUser('m16c-precision');
    const { data, error } = await user.client.rpc('create_company_for_current_user',
      { p_name: `Empresa sintética ${RUN_ID} precisión` }).single<{ id: string }>();
    if (error || !data) throw new Error('No se pudo crear empresa sintética.');
    const ctx: TenantContext = { user_id: user.id, company_id: data.id, role: 'owner', request_id: randomUUID() };
    const keyring = keyrings.getCredentialKeyring();
    const created = await credentials.executePreparedCredentialOperation(ctx, credentials.preparePendingConnectionWithCredential(ctx,
      { token: 'token-sint', tokenType: 'system_user', issuedForAppId: 'app_sintetica', grantedScopes: ['ads_read'], expiresAt: null,
        clientBusinessId: 'negocio_sint' }, { keyring }), { workerApi: worker! });
    const account = `act_${randomInt(1_000_000, 2_000_000_000)}`;
    await worker!.call('confirm_connection', [ctx.user_id, ctx.company_id, created.connectionId, account, 'USD', 'UTC', true]);

    const today = new Date().toISOString().slice(0, 10);
    // El cuerpo se arma como texto: así Graph simulado entrega cadenas, igual que Meta.
    const body = JSON.stringify({ data: [{ date_start: today, date_stop: today, account_id: account.replace('act_', ''), account_name: 'Cuenta sint',
      spend: SPEND, impressions: COUNT, reach: '0', clicks: '9007199254740995', inline_link_clicks: '1', ctr: RATE, cpc: '0.10', cpm: '00.50', frequency: '1.000',
      actions: [{ action_type: 'purchase', value: ACTION_COUNT }, { action_type: 'lead.fraccion', value: '0.5' }],
      action_values: [{ action_type: 'purchase', value: ACTION_VALUE }] }] });
    const fetch: MetaFetch = async (url) => new Response(
      url.pathname.endsWith('/insights') && url.searchParams.get('level') === 'account' ? body : '{"data":[]}', { status: 200 });

    const outcome = await insights.syncMetaInsights({ tenant: async () => ctx, workerApi: () => worker!, keyring: () => keyring,
      readConnection: (c) => connections.readConnectionRecord(c, { supabase: user.client }),
      http: (timeoutMs) => client.createMetaHttpClient({ fetch, timeoutMs }), log: () => {}, limits: LIMITS });
    expect(outcome.result).toBe('completa');

    const [day] = await insights.readMetaDailyCoverage({ connectionId: created.connectionId, level: 'account', from: today, to: today }, { supabase: user.client });
    expect(day).toMatchObject({ presence: 'con_datos', spend: SPEND, impressions: COUNT, reach: '0', clicks: '9007199254740995', ctr: RATE, cpc: '0.10' });
    // numeric conserva el valor exacto; `00.50` se normaliza sin perder valor.
    expect(day.cpm).toBe('0.50');
    expect(day.frequency).toBe('1.000');
    expect(day.actions).toEqual([
      { action_type: 'lead.fraccion', variant: 'value', count: '0.5', value: null },
      { action_type: 'purchase', variant: 'value', count: ACTION_COUNT, value: ACTION_VALUE },
    ]);
    for (const metric of [day.spend, day.impressions, day.ctr]) expect(typeof metric).toBe('string');

    // La respuesta cruda de la Data API ya trae cadenas: no hay number que recuperar.
    const raw = await user.client.rpc('get_meta_daily_coverage', { p_connection_id: created.connectionId, p_level: 'account', p_from: today, p_to: today });
    expect(raw.error).toBeNull();
    expect(typeof raw.data[0].spend).toBe('string');
    expect(raw.data[0].spend).toBe(SPEND);
    expect(typeof raw.data[0].actions[1].count).toBe('string');
  });
});
