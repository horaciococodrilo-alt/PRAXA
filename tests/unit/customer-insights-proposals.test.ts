/* eslint-disable @typescript-eslint/no-explicit-any -- los fixtures se mutan a mano para probar rechazos y coherencia */
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * M27a-T-11 (C-09, C-11): siete reglas cerradas sobre agregados sanitizados.
 * Fixtures sintéticos; cero llamadas externas.
 */

vi.mock('server-only', () => ({}));

const { buildAudienceProposals } = await import('@/modules/customer-insights/proposals');
const contract = await import('@/modules/customer-insights/contract');
const rules = await import('@/modules/customer-insights/rules');

type Data = import('@/modules/customer-insights/contract').InsightsData;

const SEGMENTS = ['inactivos', 'riesgo', 'nuevos', 'alto_valor', 'frecuentes', 'potencial'] as const;

function m(value: string | null, unit: string, definition: string, absence: string | null = null) {
  return { value, absence: value === null ? absence : null, unit, definition };
}

function row(code: string, customers: string) {
  const empty = customers === '0';
  const per = (unit: string, def: string, v: string) => (empty ? m(null, unit, def, 'sin_denominador') : m(v, unit, def));
  return {
    code,
    customers: m(customers, 'customers', 'segment_customers_v1'),
    orders: m(empty ? '0' : '20', 'orders', 'segment_orders_v1'),
    monetary: m(empty ? '0' : '1000', 'currency', 'segment_monetary_v1'),
    monetaryPerCustomer: per('currency', 'segment_monetary_per_customer_v1', '125'),
    monetaryPerOrder: per('currency', 'segment_monetary_per_order_v1', '50'),
    recencyMedianDays: per('days', 'segment_recency_median_days_v1', '40'),
    frequencyMean: per('orders_per_customer', 'segment_frequency_mean_v1', '2.5'),
  };
}

function data(counts: Partial<Record<(typeof SEGMENTS)[number], string>> = {}): Data {
  const sizes = { inactivos: '8', riesgo: '6', nuevos: '7', alto_valor: '5', frecuentes: '9', potencial: '12', ...counts };
  const total = String(Object.values(sizes).reduce((a, b) => a + Number(b), 0));
  const cells = Array.from({ length: 13 }, (_, k) => {
    const d = new Date(Date.UTC(2026, 8 + k, 1));
    const visible = k < 2;
    const v = (value: string, unit: string, def: string) => (visible ? m(value, unit, def) : m(null, unit, def, 'periodo_abierto'));
    return {
      offset: k, calendarMonth: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      activeCustomers: v(k === 0 ? '10' : '5', 'customers', 'cohort_active_v1'),
      retention: v(k === 0 ? '1' : '0.5', 'ratio', 'cohort_retention_v1'),
      repeatPurchaseCumulative: v('0.5', 'ratio', 'cohort_repeat_cumulative_v1'),
      observedValue: v('500', 'currency', 'cohort_observed_value_v1'),
      ticket: v('50', 'currency', 'cohort_ticket_v1'),
      observedValuePerCustomerCumulative: v('50', 'currency', 'cohort_observed_value_per_customer_cumulative_v1'),
      meanDaysBetweenPurchases: v('15', 'days', 'cohort_mean_days_between_purchases_v1'),
      repeatCustomers: v('5', 'customers', 'cohort_repeat_customers_v1'),
      purchaseIntervals: v('5', 'intervals', 'cohort_purchase_intervals_v1'),
    };
  });
  return {
    ruleset: 'rfm_v1', source: 'tiendanube', asOfDay: '2026-11-15', fetchedAt: '2026-11-16T10:00:00.000Z',
    timezone: 'America/Argentina/Buenos_Aires', currency: 'ARS', rfmFrom: '2025-11-16', firstPurchaseBasis: 'observada',
    quality: {
      coverage: { fromDay: '2024-01-01', throughDay: '2026-11-15', complete: true }, identity: 'completa',
      monetary: { status: 'verified', definition: 'tn_paid_current_observed_v1' }, catalog: 'completo', orderLines: 'completas',
    },
    segments: {
      status: 'available', totalCustomers: m(total, 'customers', 'segment_total_customers_v1'),
      excludedBeforeWindow: m(null, 'customers', 'excluded_before_window_v1', 'privacidad'),
      rows: SEGMENTS.map((code) => row(code, sizes[code])),
    },
    cohorts: { status: 'available', rows: [{ cohortMonth: '2026-09', size: m('10', 'customers', 'cohort_size_observed_v1'), cells }] },
    productEvidence: {
      catalogComplete: true, linesComplete: true,
      crossSell: {
        status: 'available', sourceSegment: 'frecuentes', productAName: 'Taza sintética', productBName: 'Plato sintético',
        coPurchaseSufficient: true, targetSufficient: true, identifiedCustomers: null,
        identifiedCustomersAbsence: 'privacidad', definition: 'cross_sell_pair_v1',
      },
    },
  } as unknown as Data;
}

function withoutMonetary(d: Data, status: 'unverified' | 'incomplete' = 'unverified'): Data {
  const x = structuredClone(d) as any;
  x.quality.monetary = { status, definition: null };
  const absence = status === 'unverified' ? 'monetario_no_validado' : 'dato_incompleto';
  x.segments = { status: 'unavailable', absence, definition: 'segment_partition_v1' };
  x.productEvidence.crossSell = { status: 'unavailable', absence: status === 'unverified' ? 'monetario_no_validado' : 'dato_incompleto', definition: 'cross_sell_pair_v1' };
  for (const r of x.cohorts.rows) for (const c of r.cells) {
    for (const key of ['observedValue', 'ticket', 'observedValuePerCustomerCumulative']) {
      if (c[key].value !== null) c[key] = m(null, c[key].unit, c[key].definition, absence);
    }
  }
  return x;
}

afterEach(() => vi.restoreAllMocks());

describe('buildAudienceProposals', () => {
  it('con datos completos produce las siete reglas, válidas y resolubles', () => {
    const d = data();
    expect(contract.insightsDataSchema.safeParse(d).error?.issues ?? []).toEqual([]);
    const proposals = buildAudienceProposals(d);
    expect(proposals.map((p) => p.id)).toEqual([...contract.PROPOSAL_IDS]);
    for (const p of proposals) {
      expect(contract.audienceProposalSchema.safeParse(p).error?.issues ?? []).toEqual([]);
      const fixed = rules.PROPOSAL_CATALOG[p.id];
      expect([p.name, p.objective, p.justification, p.suggestedStrategy]).toEqual(
        [fixed.name, fixed.objective, fixed.justification, fixed.suggestedStrategy]);
      expect(p.limitations).toEqual(fixed.limitations);
      expect(p.evidenceRefs.length).toBeGreaterThan(0);
    }
    expect(contract.proposalsResolve(d, proposals)).toBe(true);
  });

  it('las inclusiones y exclusiones son las de la tabla de §7', () => {
    const byId = Object.fromEntries(buildAudienceProposals(data()).map((p) => [p.id, p]));
    expect(byId.fidelizacion_v1.inclusion).toEqual(['segment_alto_valor']);
    expect(byId.fidelizacion_v1.exclusion).toEqual(['segment_inactivos', 'segment_riesgo', 'segment_nuevos',
      'segment_frecuentes', 'segment_potencial']);
    expect(byId.remarketing_v1.inclusion).toEqual(['segment_potencial']);
    expect(byId.remarketing_v1.exclusion).toEqual(['segment_inactivos', 'segment_riesgo', 'segment_nuevos',
      'segment_alto_valor', 'segment_frecuentes']);
    expect(byId.exclusion_adquisicion_v1.inclusion).toEqual(['comprador_identificado_365d']);
    expect(byId.venta_cruzada_v1.inclusion).toEqual(['segment_frecuentes', 'compro_producto_a']);
    expect(byId.venta_cruzada_v1.exclusion).toEqual(['no_compro_producto_b']);
  });

  it('el conteo identificado es el del grupo ya divulgado; venta cruzada nunca publica la intersección', () => {
    const byId = Object.fromEntries(buildAudienceProposals(data()).map((p) => [p.id, p]));
    expect(byId.fidelizacion_v1.identifiedCustomers?.value).toBe('5');
    expect(byId.exclusion_adquisicion_v1.identifiedCustomers?.value).toBe('47');
    expect(byId.venta_cruzada_v1.identifiedCustomers).toBeNull();
    expect(byId.venta_cruzada_v1.identifiedCustomersAbsence).toBe('privacidad');
  });

  it('un segmento vacío no produce una audiencia ficticia', () => {
    const ids = buildAudienceProposals(data({ alto_valor: '0' })).map((p) => p.id);
    expect(ids).not.toContain('fidelizacion_v1');
    expect(ids).not.toContain('similares_alto_valor_v1');
  });

  it('sin Monetary no hay alto valor ni propuestas que dependan de los segmentos', () => {
    for (const status of ['unverified', 'incomplete'] as const) {
      const proposals = buildAudienceProposals(withoutMonetary(data(), status));
      expect(proposals.map((p) => p.id)).toEqual(['exclusion_adquisicion_v1']);
      const [only] = proposals;
      expect(only.identifiedCustomers).toBeNull();
      expect(only.identifiedCustomersAbsence).toBe(status === 'unverified' ? 'monetario_no_validado' : 'dato_incompleto');
      expect(contract.proposalsResolve(withoutMonetary(data(), status), proposals)).toBe(true);
    }
  });

  it('identidad incompleta: el conteo identificado queda nulo con dato_incompleto', () => {
    const d = data() as any; d.quality.identity = 'incompleta';
    const proposals = buildAudienceProposals(d);
    expect(proposals.length).toBeGreaterThan(0);
    for (const p of proposals) {
      expect(p.identifiedCustomers).toBeNull();
      expect(p.identifiedCustomersAbsence).toBe(p.id === 'venta_cruzada_v1' ? 'privacidad' : 'dato_incompleto');
    }
  });

  it('privacidad en segmentos: ninguna propuesta los referencia', () => {
    const d = data() as any;
    d.segments = { status: 'unavailable', absence: 'privacidad', definition: 'segment_partition_v1' };
    d.productEvidence.crossSell = { status: 'unavailable', absence: 'privacidad', definition: 'cross_sell_pair_v1' };
    const proposals = buildAudienceProposals(d);
    for (const p of proposals) expect(p.evidenceRefs.every((r) => !r.startsWith('segments.'))).toBe(true);
    expect(contract.proposalsResolve(d, proposals)).toBe(true);
  });

  it('venta cruzada se abstiene sin evidencia de productos', () => {
    const d = data() as any;
    d.quality.catalog = 'incompleto'; d.productEvidence.catalogComplete = false;
    d.productEvidence.crossSell = { status: 'unavailable', absence: 'dato_incompleto', definition: 'cross_sell_pair_v1' };
    expect(buildAudienceProposals(d).map((p) => p.id)).not.toContain('venta_cruzada_v1');
  });

  it('no hace llamadas de red ni necesita conexión de Meta', () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    buildAudienceProposals(data());
    expect(spy).not.toHaveBeenCalled();
  });

  it('es determinística', () => {
    expect(buildAudienceProposals(data())).toEqual(buildAudienceProposals(data()));
  });
});

describe('frescura (D-M27a-08)', () => {
  const at = (iso: string) => Date.parse(iso);
  it('≤24 h sin aviso; ≤7 días con aviso; más, propuestas bloqueadas', () => {
    const f = '2026-11-10T00:00:00.000Z';
    expect(rules.freshnessOf(f, at('2026-11-11T00:00:00.000Z'))).toBe('al_dia');
    expect(rules.freshnessOf(f, at('2026-11-11T00:00:00.001Z'))).toBe('advertencia');
    expect(rules.freshnessOf(f, at('2026-11-17T00:00:00.000Z'))).toBe('advertencia');
    expect(rules.freshnessOf(f, at('2026-11-17T00:00:00.001Z'))).toBe('vencido');
  });
});
