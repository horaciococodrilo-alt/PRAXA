/* eslint-disable @typescript-eslint/no-explicit-any -- los fixtures se mutan a mano para probar estados */
import { describe, expect, it, vi } from 'vitest';

/**
 * M27a-T-03 y M27a-T-15 (parte del loader): orden de estados, moneda desde `?currency=`,
 * lectura solo bajo JWT/RLS, errores genéricos y frescura. Supabase simulado; fixtures
 * sintéticos.
 */

vi.mock('server-only', () => ({}));

const { loadCustomerInsightsView } = await import('@/modules/customer-insights/load');
const contract = await import('@/modules/customer-insights/contract');
const { NoCompanyError } = await import('@/modules/company/service');

type Deps = import('@/modules/customer-insights/load').CustomerInsightsDeps;
type Connection = import('@/modules/integrations/contract').IntegrationConnectionRecord;

const CTX = Object.freeze({ user_id: '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d', company_id: '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f',
  role: 'owner' as const, request_id: '7c6b5a49-3827-4165-a4b3-c2d1e0f9a8b7' });
const CONNECTION_ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
const NOW = new Date('2026-11-16T12:00:00.000Z');

function m(value: string | null, unit: string, definition: string, absence: string | null = null) {
  return { value, absence: value === null ? absence : null, unit, definition };
}

function payload(currency = 'ARS', status: 'unverified' | 'verified' = 'unverified', fetchedAt = '2026-11-16T10:00:00.000Z') {
  const money = status === 'verified';
  const cells = Array.from({ length: 13 }, (_, k) => {
    const d = new Date(Date.UTC(2026, 8 + k, 1));
    const open = k > 1;
    const v = (value: string, unit: string, def: string, isMoney = false) => open ? m(null, unit, def, 'periodo_abierto')
      : isMoney && !money ? m(null, unit, def, 'monetario_no_validado') : m(value, unit, def);
    return { offset: k, calendarMonth: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      activeCustomers: v(k === 0 ? '10' : '6', 'customers', 'cohort_active_v1'),
      retention: v(k === 0 ? '1' : '0.6', 'ratio', 'cohort_retention_v1'),
      repeatPurchaseCumulative: v('0.6', 'ratio', 'cohort_repeat_cumulative_v1'),
      observedValue: v('100', 'currency', 'cohort_observed_value_v1', true),
      ticket: v('10', 'currency', 'cohort_ticket_v1', true),
      observedValuePerCustomerCumulative: v('10', 'currency', 'cohort_observed_value_per_customer_cumulative_v1', true),
      meanDaysBetweenPurchases: v('12', 'days', 'cohort_mean_days_between_purchases_v1'),
      repeatCustomers: v('6', 'customers', 'cohort_repeat_customers_v1'),
      purchaseIntervals: v('6', 'intervals', 'cohort_purchase_intervals_v1') };
  });
  const segments = money ? {
    status: 'available', totalCustomers: m('10', 'customers', 'segment_total_customers_v1'),
    excludedBeforeWindow: m(null, 'customers', 'excluded_before_window_v1', 'privacidad'),
    rows: ['inactivos', 'riesgo', 'nuevos', 'alto_valor', 'frecuentes', 'potencial'].map((code, i) => {
      const n = i === 0 || i === 4 ? '5' : '0';
      const empty = n === '0';
      const per = (unit: string, def: string) => empty ? m(null, unit, def, 'sin_denominador') : m('2', unit, def);
      return { code, customers: m(n, 'customers', 'segment_customers_v1'), orders: m(empty ? '0' : '10', 'orders', 'segment_orders_v1'),
        monetary: m(empty ? '0' : '50', 'currency', 'segment_monetary_v1'),
        monetaryPerCustomer: per('currency', 'segment_monetary_per_customer_v1'),
        monetaryPerOrder: per('currency', 'segment_monetary_per_order_v1'),
        recencyMedianDays: per('days', 'segment_recency_median_days_v1'),
        frequencyMean: per('orders_per_customer', 'segment_frequency_mean_v1') };
    }),
  } : { status: 'unavailable', absence: 'monetario_no_validado', definition: 'segment_partition_v1' };
  return {
    ruleset: 'rfm_v1', source: 'tiendanube', asOfDay: '2026-11-15', fetchedAt, timezone: 'America/Argentina/Buenos_Aires',
    currency, rfmFrom: '2025-11-16', firstPurchaseBasis: 'observada',
    quality: { coverage: { fromDay: null, throughDay: '2026-11-15', complete: true }, identity: 'completa',
      monetary: money ? { status: 'verified', definition: 'tn_paid_current_observed_v1' } : { status: 'unverified', definition: null },
      catalog: 'completo', orderLines: 'completas' },
    segments,
    cohorts: { status: 'available', rows: [{ cohortMonth: '2026-09', size: m('10', 'customers', 'cohort_size_observed_v1'), cells }] },
    productEvidence: { catalogComplete: true, linesComplete: true,
      crossSell: { status: 'unavailable', absence: money ? 'privacidad' : 'monetario_no_validado', definition: 'cross_sell_pair_v1' } },
  };
}

type World = {
  connection: Partial<Connection> | null;
  status: Record<string, unknown> | null;
  currencies: string[];
  sales: boolean;
  snapshot: (currency: string) => unknown;
  fail?: string;
};

function world(over: Partial<World> = {}): World {
  return {
    connection: {},
    status: { phase: 'incremental', coverage_until: '2026-11-16T09:00:00.000Z', covered_through: '2026-11-15',
      timezone: 'America/Argentina/Buenos_Aires', last_run_status: 'complete', last_fetched_at: '2026-11-16T10:00:00.000Z' },
    currencies: ['ARS', 'USD'],
    sales: true,
    snapshot: (currency) => payload(currency),
    ...over,
  };
}

function fakeSupabase(w: World) {
  const calls: Array<{ kind: string; name: string; args: unknown }> = [];
  const result = (data: unknown) => Promise.resolve(w.fail ? { data: null, error: { message: w.fail } } : { data, error: null });
  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ kind: 'rpc', name, args });
      if (name === 'get_tn_sync_status') return result(w.status ? [w.status] : []);
      if (name === 'get_tn_customer_insights') {
        const snap = w.snapshot(String(args.p_currency));
        return result(snap === null ? [] : [{ as_of_day: '2026-11-15', fetched_at: '2026-11-16T10:00:00+00:00',
          ruleset: 'rfm_v1', payload: snap }]);
      }
      throw new Error(`rpc inesperada: ${name}`);
    },
    from(table: string) {
      const filters: unknown[] = [];
      const builder: any = {
        select: (...a: unknown[]) => { filters.push(['select', ...a]); return builder; },
        eq: (...a: unknown[]) => { filters.push(['eq', ...a]); return builder; },
        gte: (...a: unknown[]) => { filters.push(['gte', ...a]); return builder; },
        lte: (...a: unknown[]) => { filters.push(['lte', ...a]); return builder; },
        gt: (...a: unknown[]) => { filters.push(['gt', ...a]); return builder; },
        order: (...a: unknown[]) => { filters.push(['order', ...a]); return builder; },
        limit: (...a: unknown[]) => { filters.push(['limit', ...a]); return builder; },
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
          calls.push({ kind: 'from', name: table, args: filters });
          const data = table === 'tn_customer_insights' ? w.currencies.map((currency) => ({ currency }))
            : table === 'tn_sales_daily' ? (w.sales ? [{ day: '2026-11-01' }] : []) : null;
          return result(data).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { client, calls };
}

function deps(w: World, over: Partial<Deps> = {}) {
  const fake = fakeSupabase(w);
  const value: Partial<Deps> = {
    tenant: async () => CTX,
    supabase: async () => fake.client as never,
    readConnection: async () => (w.connection === null ? null : {
      id: CONNECTION_ID, company_id: CTX.company_id, provider: 'tiendanube', client_business_id: null,
      credential_generation: 0, current_sync_run_id: null, last_error_class: null, last_error_message: null,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z', external_account_id: '98765',
      currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires', status: 'active', pending_expires_at: null,
      purge_requested_at: null, ...w.connection } as Connection),
    now: () => NOW,
    monetaryDefinition: null,
    ...over,
  };
  return { deps: value, calls: fake.calls };
}

const valid = (view: unknown) => contract.customerInsightsViewSchema.safeParse(view).error?.issues ?? [];

describe('loadCustomerInsightsView: orden de estados (§1.1)', () => {
  it('una moneda malformada es error antes de resolver tenant o leer nada', async () => {
    for (const bad of [['USD', 'ARS'], 'usd', 'US', 7]) {
      const tenant = vi.fn(async () => CTX);
      const { deps: d, calls } = deps(world(), { tenant });
      const view = await loadCustomerInsightsView(bad, d);
      expect(view).toEqual({ kind: 'error', availableCurrencies: [], selectedCurrency: null });
      expect(tenant).not.toHaveBeenCalled();
      expect(calls).toEqual([]);
    }
  });

  it('sin empresa, sin conexión, conexión pendiente y requiere_reauth', async () => {
    const empty = { availableCurrencies: [], selectedCurrency: null };
    expect(await loadCustomerInsightsView(null, deps(world(), { tenant: async () => { throw new NoCompanyError(); } }).deps))
      .toEqual({ kind: 'sin_empresa', ...empty });
    expect(await loadCustomerInsightsView(null, deps(world({ connection: null })).deps))
      .toEqual({ kind: 'sin_conexion', actionHref: '/app/integraciones', ...empty });
    expect(await loadCustomerInsightsView(null, deps(world({ connection: { status: 'pending_selection',
      pending_expires_at: '2026-11-16T12:30:00.000Z', external_account_id: null, currency: null, timezone: null } })).deps))
      .toEqual({ kind: 'sin_conexion', actionHref: '/app/integraciones', ...empty });
    expect(await loadCustomerInsightsView(null, deps(world({ connection: { status: 'needs_reauth',
      last_error_class: 'authentication', last_error_message: 'Volvé a conectar la tienda.' } })).deps))
      .toEqual({ kind: 'requiere_reauth', actionHref: '/app/integraciones', ...empty });
  });

  it('una sincronización en curso es actualizando aunque exista snapshot', async () => {
    const w = world({ status: { ...world().status, last_run_status: 'running' } });
    const { deps: d, calls } = deps(w);
    const view = await loadCustomerInsightsView('ARS', d);
    expect(view.kind).toBe('actualizando');
    expect(calls.some((c) => c.name === 'get_tn_customer_insights')).toBe(false);
    expect(valid(view)).toEqual([]);
  });

  it('sin cobertura o sin última ejecución completa es sin_cobertura', async () => {
    for (const status of [{ ...world().status, coverage_until: null, covered_through: null },
      { ...world().status, last_run_status: 'incomplete' }, null]) {
      const view = await loadCustomerInsightsView(null, deps(world({ status })).deps);
      expect(view.kind).toBe('sin_cobertura');
      expect(valid(view)).toEqual([]);
    }
  });

  it('sin monedas: sin compras elegibles es sin_compras; con compras y sin snapshot, sin_cobertura', async () => {
    const none = await loadCustomerInsightsView(null, deps(world({ currencies: [], sales: false })).deps);
    expect(none).toMatchObject({ kind: 'sin_compras', availableCurrencies: [], selectedCurrency: null });
    expect(valid(none)).toEqual([]);
    const pending = await loadCustomerInsightsView(null, deps(world({ currencies: [], sales: true })).deps);
    expect(pending.kind).toBe('sin_cobertura');
  });

  it('la ventana de compras elegibles es [C-364, C] y no usa empresa ni conexión del cliente', async () => {
    const { deps: d, calls } = deps(world({ currencies: [], sales: false }));
    await loadCustomerInsightsView(null, d);
    const sales = calls.find((c) => c.name === 'tn_sales_daily')!.args as unknown[][];
    expect(sales).toEqual(expect.arrayContaining([['eq', 'connection_id', CONNECTION_ID], ['gte', 'day', '2025-11-16'],
      ['lte', 'day', '2026-11-15'], ['gt', 'paid_orders', 0]]));
    expect(JSON.stringify(calls)).not.toContain('company_id');
  });
});

describe('loadCustomerInsightsView: moneda (T-03)', () => {
  it('por defecto la primera disponible; ?currency= elige exactamente', async () => {
    const first = await loadCustomerInsightsView(undefined, deps(world()).deps);
    expect(first).toMatchObject({ kind: 'monetario_no_validado', availableCurrencies: ['ARS', 'USD'], selectedCurrency: 'ARS' });
    expect(valid(first)).toEqual([]);
    const usd = await loadCustomerInsightsView('USD', deps(world()).deps);
    expect(usd).toMatchObject({ selectedCurrency: 'USD' });
    expect((usd as any).data.currency).toBe('USD');
  });

  it('una moneda válida pero no disponible es error sin consultar el getter', async () => {
    const { deps: d, calls } = deps(world());
    const view = await loadCustomerInsightsView('EUR', d);
    expect(view).toEqual({ kind: 'error', availableCurrencies: ['ARS', 'USD'], selectedCurrency: null });
    expect(calls.some((c) => c.name === 'get_tn_customer_insights')).toBe(false);
  });

  it('un payload de otra moneda o malformado es error', async () => {
    expect((await loadCustomerInsightsView('ARS', deps(world({ snapshot: () => payload('USD') })).deps)).kind).toBe('error');
    expect((await loadCustomerInsightsView('ARS', deps(world({ snapshot: () => ({ ...payload(), extra: 1 }) })).deps)).kind)
      .toBe('error');
    expect((await loadCustomerInsightsView('ARS', deps(world({ snapshot: () => null })).deps)).kind).toBe('error');
  });
});

describe('loadCustomerInsightsView: Monetary, frescura y errores (T-15)', () => {
  it('verified exige la definición acreditada: con la constante nula es error', async () => {
    const w = world({ snapshot: (c) => payload(c, 'verified') });
    expect((await loadCustomerInsightsView('ARS', deps(w).deps)).kind).toBe('error');
    const ok = await loadCustomerInsightsView('ARS', deps(w, { monetaryDefinition: 'tn_paid_current_observed_v1' }).deps);
    expect(ok.kind).toBe('listo');
    expect(valid(ok)).toEqual([]);
    const other = await loadCustomerInsightsView('ARS', deps(w, { monetaryDefinition: 'tn_paid_current_less_verified_refunds_v1' }).deps);
    expect(other.kind).toBe('error');
  });

  it('más de 7 días desde la extracción bloquea propuestas; hasta 7 días las mantiene', async () => {
    const at = (iso: string) => world({ snapshot: (c) => payload(c, 'verified', iso) });
    const fresh = await loadCustomerInsightsView('ARS', deps(at('2026-11-09T12:00:00.000Z'),
      { monetaryDefinition: 'tn_paid_current_observed_v1' }).deps) as any;
    expect(fresh.proposals.length).toBeGreaterThan(0);
    const stale = await loadCustomerInsightsView('ARS', deps(at('2026-11-09T11:59:59.999Z'),
      { monetaryDefinition: 'tn_paid_current_observed_v1' }).deps) as any;
    expect(stale.kind).toBe('listo');
    expect(stale.proposals).toEqual([]);
  });

  it('un error de lectura es error genérico, sin texto del proveedor', async () => {
    const view = await loadCustomerInsightsView(null, deps(world({ fail: 'relation private.tn_orders: detalle' })).deps);
    expect(view).toEqual({ kind: 'error', availableCurrencies: [], selectedCurrency: null });
    expect(JSON.stringify(view)).not.toContain('tn_orders');
  });

  it('no llama a la red ni a otros proveedores', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await loadCustomerInsightsView(null, deps(world()).deps);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
