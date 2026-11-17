import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { SecretValue } from '@/modules/integrations/crypto/seal';
import { GA4_REPORT_CATALOG } from '@/modules/integrations/ga4/reports';
import { fetchGa4Window, syncGa4, type Ga4SyncDeps } from '@/modules/integrations/ga4/sync';
import { Ga4ApiError, type Ga4Http } from '@/modules/integrations/ga4/google';
import type { WorkerApi } from '@/modules/integrations/db/worker-api';

const now = Date.parse('2026-11-16T12:00:00.000Z');
const companyId = 'c0a00000-0000-4000-8000-000000009001';
const connectionId = 'cc000000-0000-4000-8000-000000009001';
const actorId = 'aa000000-0000-4000-8000-000000009001';
const names = (list: readonly string[]) => list.map((apiName) => ({ apiName }));

function harness() {
  const calls: string[] = [];
  const writes: Array<{ fn: string; args: readonly unknown[] }> = [];
  const quality: Array<{ report_id: string; report_version: number; window_from: string;
    window_to: string; fetched_at: string }> = [];
  let state: Record<string, unknown> | null = null;
  let ids = 0;
  const http: Ga4Http = {
    exchangeCode: async () => { throw new Error('No corresponde.'); },
    refresh: async () => ({ access_token: 'access-synthetic', token_type: 'Bearer',
      expires_in: 3600 }),
    getAdmin: async (path) => {
      calls.push('admin');
      if (path === 'properties/12345') return { name: 'properties/12345',
        propertyType: 'PROPERTY_TYPE_ORDINARY', displayName: 'Demo', currencyCode: 'USD',
        timeZone: 'UTC' };
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
      expect(body.limit).toBe('10000');
      expect(body.returnPropertyQuota).toBe(true);
      return { metadata: {}, rowCount: 0, rows: [] };
    },
  };
  const workerApi: WorkerApi = { call: async (fn, args) => {
    writes.push({ fn, args });
    if (fn === 'ga4_start_sync') state = { ...state, phase: args[7], last_step_status: 'running' };
    if (fn === 'ga4_set_preflight') state = { ...state, preflight: args[9],
      preflight_at: new Date(now).toISOString(), currency_code: args[8], time_zone: args[7] };
    if (fn === 'ga4_publish_report') quality.push({ report_id: args[6] as string,
      report_version: args[7] as number, window_from: args[8] as string,
      window_to: args[9] as string, fetched_at: new Date(now).toISOString() });
    if (fn === 'ga4_fail_sync') state = { ...state, last_step_status: args[6] };
    if (fn === 'ga4_finish_sync') state = { ...state, last_step_status: 'complete',
      coverage_from: args[6], coverage_through: args[7] };
    return [];
  } };
  const deps: Partial<Ga4SyncDeps> = {
    tenant: async () => ({ user_id: actorId, company_id: companyId,
      request_id: 'test' }) as Awaited<ReturnType<Ga4SyncDeps['tenant']>>,
    readConnection: async () => ({ id: connectionId, status: 'active',
      external_account_id: '12345', currency: 'USD', timezone: 'UTC',
      credential_generation: 0 }) as Awaited<ReturnType<Ga4SyncDeps['readConnection']>>,
    readStatus: async () => state as Awaited<ReturnType<Ga4SyncDeps['readStatus']>>,
    readQuality: async () => quality as Awaited<ReturnType<Ga4SyncDeps['readQuality']>>,
    readToken: async () => new SecretValue('refresh-synthetic'),
    workerApi: () => workerApi,
    config: () => ({ clientId: '123.apps.googleusercontent.com', clientSecret: 'synthetic',
      redirectUri: 'https://example.test/api/integraciones/ga4/callback', appId: '123' }),
    http, now: () => now, sleep: async () => {}, randomUUID: () =>
      `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`,
    log: () => {},
  };
  return { deps, calls, writes, quality };
}

describe('GA4 sync step', () => {
  it('lee 25.000 filas en tres páginas y une las banderas de calidad', async () => {
    const offsets: string[] = [];
    const page = (length: number, other = false) => Array.from({ length }, (_, index) => ({
      dimensionValues: [{ value: '20261101' },
        { value: other && index === 0 ? '(other)' : `fuente_${index}` }, { value: 'paid' }],
      metricValues: [{ value: '1' }],
    }));
    const pages = [
      { rowCount: 25000, rows: page(10000), metadata: {} },
      { rowCount: 25000, rows: page(10000), metadata: { subjectToThresholding: true } },
      { rowCount: 25000, rows: page(5000, true), metadata: {
        dataTruncationReasons: ['OTHER'], schemaRestrictionResponse: {
          activeMetricRestrictions: [{ metricName: 'sessions', restrictedMetricTypes: ['COST_DATA'] }],
        },
      } },
    ];
    const http = { runReport: async (_id: string, _token: SecretValue, body: Record<string, unknown>) => {
      offsets.push(body.offset as string);
      return pages[offsets.length - 1];
    } } as Ga4Http;
    const result = await fetchGa4Window({ report: GA4_REPORT_CATALOG[1],
      window: { from: '2026-11-01', to: '2026-11-15' }, propertyId: '12345',
      token: new SecretValue('access-synthetic'), today: '2026-11-16',
      currency: 'USD', timezone: 'UTC', http });
    expect(offsets).toEqual(['0', '10000', '20000']);
    expect(result.rows).toHaveLength(25000);
    expect(result.quality).toMatchObject({ subject_to_thresholding: true,
      data_loss_from_other_row: true, data_truncation_reasons: ['OTHER'],
      restricted_metrics: [{ metric_name: 'sessions', restricted_metric_types: ['COST_DATA'] }] });
  });

  it('reanuda 365 días sin repetir preflight, nunca supera 25 llamadas por paso y cierra al final', async () => {
    const h = harness();
    expect(await syncGa4(h.deps)).toBe('parcial');
    expect(h.calls).toHaveLength(25);
    expect(h.writes.filter((x) => x.fn === 'ga4_set_preflight')).toHaveLength(1);
    expect(h.writes.filter((x) => x.fn === 'ga4_finish_sync')).toHaveLength(0);
    expect(await syncGa4(h.deps)).toBe('completa');
    expect(h.calls.length).toBeLessThanOrEqual(50);
    expect(h.writes.filter((x) => x.fn === 'ga4_set_preflight')).toHaveLength(1);
    expect(h.writes.filter((x) => x.fn === 'ga4_finish_sync')).toHaveLength(1);
    expect(h.quality).toHaveLength(25);
    expect(new Set(h.quality.map((x) => `${x.report_id}:${x.window_from}:${x.window_to}`)).size)
      .toBe(25);
  });

  it('repite el preflight si recibió cuota antes de fijar el nuevo objetivo', async () => {
    const h = harness();
    expect(await syncGa4(h.deps)).toBe('parcial');
    expect(await syncGa4(h.deps)).toBe('completa');
    const original = h.deps.http!;
    h.deps.http = { ...original, runReport: async (_id, _token, body) => {
      if (body.limit === '100') throw new Ga4ApiError('cuota', 'rate_limit');
      return original.runReport(_id, _token, body);
    } };
    expect(await syncGa4(h.deps)).toBe('cuota');
    expect(h.writes.filter((entry) => entry.fn === 'ga4_fail_sync').at(-1)?.args[6]).toBe('failed');
    h.deps.http = original;
    expect(await syncGa4(h.deps)).toBe('completa');
    expect(h.writes.filter((entry) => entry.fn === 'ga4_set_preflight')).toHaveLength(2);
  });
});
