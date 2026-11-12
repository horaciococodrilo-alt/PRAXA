import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { loadMetaAnomalyView, type MetaAnomalyLoadDeps } from '@/modules/anomalies/load';
import type { MetaCoverageRow, MetaSyncStatus } from '@/modules/integrations/meta/insights';

const COMPANY_ID = randomUUID();
const CONNECTION_ID = randomUUID();
const ENTITY_ID = randomUUID();
const ATTRIBUTION_ID = randomUUID();

function day(index: number): string {
  const date = new Date('2026-10-01T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
}

function coverage(name: string): MetaCoverageRow[] {
  return Array.from({ length: 14 }, (_, index) => ({
    day: day(index), level: 'account', entity_ref: ENTITY_ID, parent_ref: null, name,
    effective_status: 'ACTIVE', objective: null, metadata_fetched_at: '2026-10-15T12:00:00.000Z',
    presence: 'con_datos', spend: index < 7 ? '100' : '150', impressions: '1000', reach: '900',
    clicks: index < 7 ? '100' : '60', inline_link_clicks: '50', ctr: null, cpc: null, cpm: null,
    frequency: null,
    actions: [{ action_type: 'purchase', variant: 'value', count: '10', value: null }],
    attribution: { known: true, report_time: 'impression', unified: true,
      settings: [{ adset_ref: ATTRIBUTION_ID, windows: [{ event_type: 'click', days: 7 }] }] },
    currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires', snapshot_id: randomUUID(),
    fetched_at: '2026-10-15T12:00:00.000Z', captured_before_day_end: false,
    temporal_status: 'cerrado',
  }));
}

const syncStatus: MetaSyncStatus = {
  has_attempt: true,
  effective_status: 'completed',
  connection_changed: false,
  summary: {
    version: 1, credential_generation: 1, window_from: '2026-10-01', window_to: '2026-10-14',
    max_window_days: 28, started_at: '2026-10-15T11:59:00.000Z',
    lease_expires_at: '2026-10-15T12:05:00.000Z', finished_at: '2026-10-15T12:00:00.000Z',
    status: 'completed',
    levels: Object.fromEntries(['account', 'campaign', 'adset', 'ad'].map((level) => [level, {
      status: 'complete', reason: 'complete', fetched_at: '2026-10-15T12:00:00.000Z',
      finished_at: '2026-10-15T12:00:00.000Z',
    }])) as NonNullable<MetaSyncStatus['summary']>['levels'],
  },
};

function deps(name: string): MetaAnomalyLoadDeps {
  return {
    tenant: vi.fn(async () => ({
      user_id: randomUUID(), company_id: COMPANY_ID, role: 'owner' as const, request_id: randomUUID(),
    })),
    readConnection: vi.fn(async (ctx) => ({
      id: CONNECTION_ID, company_id: ctx.company_id, provider: 'meta' as const,
      client_business_id: 'business-test', credential_generation: 1, current_sync_run_id: null,
      last_error_class: null, last_error_message: null, created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-15T12:00:00.000Z', external_account_id: 'account-test', currency: 'ARS',
      timezone: 'America/Argentina/Buenos_Aires', status: 'active' as const, pending_expires_at: null,
      purge_requested_at: null,
    })),
    readStatus: vi.fn(async () => syncStatus),
    readCoverage: vi.fn(async (input) => input.level === 'account' ? coverage(name) : []),
    now: () => new Date('2026-10-15T13:00:00.000Z'),
  };
}

describe('carga server-only de anomalías', () => {
  it('resuelve tenant y conexión en servidor y solo usa su cobertura', async () => {
    const alice = deps('Cuenta de Alice');
    const bob = deps('Cuenta de Bob');
    const [aliceView, bobView] = await Promise.all([
      loadMetaAnomalyView({ mode: 'real' }, alice),
      loadMetaAnomalyView({ mode: 'real' }, bob),
    ]);
    expect(alice.tenant).toHaveBeenCalledOnce();
    expect(alice.readConnection).toHaveBeenCalledWith(expect.objectContaining({ company_id: COMPANY_ID }));
    expect(alice.readStatus).toHaveBeenCalledWith(CONNECTION_ID);
    expect(alice.readCoverage).toHaveBeenCalledWith(expect.objectContaining({ connectionId: CONNECTION_ID, level: 'account' }));
    expect(JSON.stringify(aliceView)).toContain('Cuenta de Alice');
    expect(JSON.stringify(aliceView)).not.toContain('Cuenta de Bob');
    expect(JSON.stringify(bobView)).toContain('Cuenta de Bob');
    expect(aliceView.state === 'ready' && aliceView.result.anomalies.some((item) =>
      item.metric === 'cpa_purchase' && item.severity === 'critical')).toBe(true);
  });

  it('el modo demo no construye tenant ni lee conexión o cobertura real', async () => {
    const injected = deps('No debe aparecer');
    const view = await loadMetaAnomalyView({ mode: 'synthetic_demo' }, injected);
    expect(view.state).toBe('ready');
    if (view.state === 'ready') {
      expect(view.result.mode).toBe('synthetic_demo');
      expect(view.result.anomalies.some((item) => item.metric === 'cpa_purchase')).toBe(true);
    }
    expect(injected.tenant).not.toHaveBeenCalled();
    expect(injected.readConnection).not.toHaveBeenCalled();
    expect(injected.readCoverage).not.toHaveBeenCalled();
    expect(JSON.stringify(view)).not.toContain('No debe aparecer');
  });

  it('sin conexión, sin sync y error producen estados cerrados sin detalles internos', async () => {
    const missing = { ...deps('Cuenta'), readConnection: vi.fn(async () => null) };
    await expect(loadMetaAnomalyView({ mode: 'real' }, missing)).resolves.toEqual({ state: 'not_connected', reason: 'missing' });

    const never = { ...deps('Cuenta'), readStatus: vi.fn(async () => ({ has_attempt: false, summary: null,
      effective_status: 'never' as const, connection_changed: false })) };
    await expect(loadMetaAnomalyView({ mode: 'real' }, never)).resolves.toEqual({ state: 'never_synced' });

    const failed = { ...deps('Cuenta'), readStatus: vi.fn(async () => { throw new Error('detalle interno de postgres'); }) };
    await expect(loadMetaAnomalyView({ mode: 'real' }, failed)).resolves.toEqual({ state: 'unavailable' });
  });
});
