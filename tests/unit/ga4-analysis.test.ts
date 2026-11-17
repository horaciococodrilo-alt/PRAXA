import { describe, expect, it, vi } from 'vitest';

import type { IntegrationConnectionRecord } from '@/modules/integrations/contract';
import type { TenantContext } from '@/modules/tenant/context';

vi.mock('server-only', () => ({}));
const { loadGa4View } = await import('@/modules/integrations/ga4/analysis');
const CTX: TenantContext = { user_id: '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d',
  company_id: '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f', role: 'owner', request_id: '7c6b5a49-3827-4165-a4b3-c2d1e0f9a8b7' };
const ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
function connection(over: Partial<IntegrationConnectionRecord> = {}): IntegrationConnectionRecord {
  return { id: ID, company_id: CTX.company_id, provider: 'ga4', client_business_id: null,
    credential_generation: 0, current_sync_run_id: null, last_error_class: null,
    last_error_message: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    external_account_id: '12345', currency: 'USD', timezone: 'UTC', status: 'active',
    pending_expires_at: null, purge_requested_at: null, ...over } as IntegrationConnectionRecord;
}
function database(responses: Record<string, unknown[]> = {}, fail: string | null = null) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = { rpc: (fn: string, args: Record<string, unknown>) => ({
    range: async () => {
      calls.push({ fn, args });
      return fn === fail ? { data: null, count: null, error: { message: 'synthetic' } }
        : { data: responses[fn] ?? [], count: (responses[fn] ?? []).length, error: null };
    },
  }) };
  return { client: client as never, calls };
}

describe('M16f-T-07: lectura GA4 para Integraciones', () => {
  it('una conexión nueva sin sincronización no inventa cobertura ni cero', async () => {
    const db = database();
    const view = await loadGa4View({ tenant: async () => CTX, supabase: async () => db.client,
      readConnection: async (_ctx, _db, provider) => provider === 'ga4' ? connection() : null,
      now: () => new Date('2026-11-16T12:00:00Z') });
    expect(view.card.kind).toBe('activa');
    expect(view.error).toBe(false);
    expect(view.data).toMatchObject({ coverageFrom: null, coverageThrough: null,
      lastStep: null, traffic: [], products: [], metaConnected: false });
    expect(db.calls.map((call) => call.fn)).toContain('get_ga4_cohorts');
    expect(db.calls.find((call) => call.fn === 'get_ga4_cohorts')?.args)
      .toMatchObject({ p_from: '2025-12-01', p_today: '2026-11-16',
        p_provisional_days: 3, p_max_offset: 5 });
    expect(JSON.stringify(view)).not.toContain('12345');
  });

  it('conserva la calidad, el gasto en moneda Meta y oculta un conteo de cohorte', async () => {
    const db = database({
      get_ga4_sync_status: [{ display_name: 'Web', coverage_from: '2026-11-01',
        coverage_through: '2026-11-15', last_step_status: 'complete',
        last_error_kind: null, last_fetched_at: '2026-11-16T01:00:00Z',
        preflight: { trafico: { status: 'disponible', reason: null } }, item_mapping_rule: null }],
      get_ga4_traffic: [{ day: '2026-11-15', sessions: '5', active_users: '4', new_users: '2',
        meta_visits: '1', provisional: true, traffic_quality: { row_count: 1, fetched_at: '2026-11-16T01:00:00Z' },
        source_quality: { row_count: 1 } }],
      get_ga4_cohorts: [{ cohort_month: '2026-11-01', month_offset: 0, cohort_size: null,
        active: null, retention: null, absence: 'menos_de_5', size_hidden: true,
        active_hidden: true, provisional: true, quality: { row_count: 1 } }],
    });
    const view = await loadGa4View({ tenant: async () => CTX, supabase: async () => db.client,
      readConnection: async (_ctx, _db, provider) => provider === 'ga4' ? connection() :
        connection({ id: 'meta-connection', provider: 'meta', currency: 'ARS' }),
      metaCoverage: async ({ level }) => level === 'account' ? [{ day: '2026-11-15',
        spend: '10.25', currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires',
        presence: 'con_datos', fetched_at: '2026-11-16T02:00:00Z' }] as never : [],
      now: () => new Date('2026-11-16T12:00:00Z') });
    expect(view.data?.traffic[0]).toMatchObject({ sessions: 5, provisional: true });
    expect(view.data?.cohorts[0]).toMatchObject({ size: null, active: null,
      retention: null, sizeHidden: true });
    expect(view.data?.metaSpend[0]).toMatchObject({ spend: '10.25', currency: 'ARS' });
  });

  it('una falla en un getter muestra error y no cifras vacías', async () => {
    const db = database({}, 'get_ga4_traffic');
    const view = await loadGa4View({ tenant: async () => CTX, supabase: async () => db.client,
      readConnection: async () => connection() });
    expect(view).toMatchObject({ card: { kind: 'activa' }, data: null, error: true });
  });
});
