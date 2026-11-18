/* eslint-disable @typescript-eslint/no-explicit-any -- los fixtures se mutan a mano para probar rechazos y coherencia */
import { describe, expect, it, vi } from 'vitest';

/**
 * M27a-T-10 y M27a-T-15 (parte de contrato): formas exactas de §1.1 y vista por `kind`.
 * Fixtures sintéticos escritos a mano; ningún ID, nombre de persona ni monto real.
 */

vi.mock('server-only', () => ({}));

const contract = await import('@/modules/customer-insights/contract');
const rules = await import('@/modules/customer-insights/rules');

type Data = import('@/modules/customer-insights/contract').InsightsData;
type Proposal = import('@/modules/customer-insights/contract').AudienceProposal;

const SEGMENTS = ['inactivos', 'riesgo', 'nuevos', 'alto_valor', 'frecuentes', 'potencial'] as const;

function m(value: string | null, unit: string, definition: string, absence: string | null = null) {
  return { value, absence: value === null ? absence : null, unit, definition };
}

function segmentRow(code: string, customers: string) {
  const empty = customers === '0';
  const per = (unit: string, def: string, v: string) => (empty ? m(null, unit, def, 'sin_denominador') : m(v, unit, def));
  return {
    code,
    customers: m(customers, 'customers', 'segment_customers_v1'),
    orders: m(empty ? '0' : '12', 'orders', 'segment_orders_v1'),
    monetary: m(empty ? '0' : '1200.50', 'currency', 'segment_monetary_v1'),
    monetaryPerCustomer: per('currency', 'segment_monetary_per_customer_v1', '200.083333'),
    monetaryPerOrder: per('currency', 'segment_monetary_per_order_v1', '100.041667'),
    recencyMedianDays: per('days', 'segment_recency_median_days_v1', '45.5'),
    frequencyMean: per('orders_per_customer', 'segment_frequency_mean_v1', '2'),
  };
}

function cell(month: string, offset: number, state: 'value' | 'privacidad' | 'periodo_abierto' = 'value') {
  const [y, mo] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + offset, 1));
  const calendarMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const hidden = state !== 'value';
  const v = (value: string, unit: string, def: string) => (hidden ? m(null, unit, def, state) : m(value, unit, def));
  return {
    offset,
    calendarMonth,
    activeCustomers: v(offset === 0 ? '10' : '6', 'customers', 'cohort_active_v1'),
    retention: v(offset === 0 ? '1' : '0.6', 'ratio', 'cohort_retention_v1'),
    repeatPurchaseCumulative: v('0.5', 'ratio', 'cohort_repeat_cumulative_v1'),
    observedValue: v('800', 'currency', 'cohort_observed_value_v1'),
    ticket: v('80', 'currency', 'cohort_ticket_v1'),
    observedValuePerCustomerCumulative: v('80', 'currency', 'cohort_observed_value_per_customer_cumulative_v1'),
    meanDaysBetweenPurchases: v('20.5', 'days', 'cohort_mean_days_between_purchases_v1'),
    repeatCustomers: v('5', 'customers', 'cohort_repeat_customers_v1'),
    purchaseIntervals: v('6', 'intervals', 'cohort_purchase_intervals_v1'),
  };
}

function cohortRow(month: string) {
  return {
    cohortMonth: month,
    size: m('10', 'customers', 'cohort_size_observed_v1'),
    cells: Array.from({ length: 13 }, (_, k) => cell(month, k, k === 0 ? 'value' : k < 3 ? 'value' : k < 5 ? 'privacidad' : 'periodo_abierto')),
  };
}

export function validData(): Data {
  return {
    ruleset: 'rfm_v1',
    source: 'tiendanube',
    asOfDay: '2026-11-15',
    fetchedAt: '2026-11-16T10:00:00.000Z',
    timezone: 'America/Argentina/Buenos_Aires',
    currency: 'ARS',
    rfmFrom: '2025-11-16',
    firstPurchaseBasis: 'observada',
    quality: {
      coverage: { fromDay: '2024-01-01', throughDay: '2026-11-15', complete: true },
      identity: 'completa',
      monetary: { status: 'verified', definition: 'tn_paid_current_observed_v1' },
      catalog: 'completo',
      orderLines: 'completas',
    },
    segments: {
      status: 'available',
      totalCustomers: m('40', 'customers', 'segment_total_customers_v1'),
      excludedBeforeWindow: m(null, 'customers', 'excluded_before_window_v1', 'privacidad'),
      rows: SEGMENTS.map((code, i) => segmentRow(code, i === 2 ? '0' : '8')),
    },
    cohorts: { status: 'available', rows: [cohortRow('2026-09'), cohortRow('2026-08')] },
    productEvidence: {
      catalogComplete: true,
      linesComplete: true,
      crossSell: {
        status: 'available', sourceSegment: 'frecuentes', productAName: 'Taza sintética', productBName: 'Plato sintético',
        coPurchaseSufficient: true, targetSufficient: true, identifiedCustomers: null,
        identifiedCustomersAbsence: 'privacidad', definition: 'cross_sell_pair_v1',
      },
    },
  } as unknown as Data;
}

const clone = <T,>(value: T): T => structuredClone(value);
const ok = (data: unknown) => contract.insightsDataSchema.safeParse(data).success;

describe('InsightsData (§1.1)', () => {
  it('acepta la forma exacta', () => {
    const parsed = contract.insightsDataSchema.safeParse(validData());
    expect(parsed.error?.issues ?? []).toEqual([]);
  });

  it('rechaza claves extra en cualquier nivel', () => {
    for (const mutate of [
      (d: any) => { d.company_id = 'x'; },
      (d: any) => { d.quality.extra = true; },
      (d: any) => { d.segments.rows[0].customerIds = []; },
      (d: any) => { d.segments.rows[0].customers.connection_id = 'x'; },
      (d: any) => { d.cohorts.rows[0].cells[0].payload = {}; },
      (d: any) => { d.productEvidence.crossSell.productAId = '1'; },
    ]) {
      const d = clone(validData()); mutate(d); expect(ok(d)).toBe(false);
    }
  });

  it('rechaza campos faltantes', () => {
    const d = clone(validData()) as any; delete d.rfmFrom; expect(ok(d)).toBe(false);
    const e = clone(validData()) as any; delete e.segments.rows[1].orders; expect(ok(e)).toBe(false);
  });

  it('rechaza unidad, definición o ausencia incompatibles', () => {
    const cases = [
      (d: any) => { d.segments.rows[0].customers.unit = 'orders'; },
      (d: any) => { d.segments.rows[0].customers.definition = 'cohort_active_v1'; },
      (d: any) => { d.segments.rows[0].customers.definition = 'inventada_v1'; },
      (d: any) => { d.segments.rows[0].monetary = m(null, 'currency', 'segment_monetary_v1', 'privacidad'); },
      (d: any) => { d.segments.rows[0].monetaryPerCustomer = m(null, 'currency', 'segment_monetary_per_customer_v1', 'sin_denominador'); },
      (d: any) => { d.cohorts.rows[0].cells[1].activeCustomers = m(null, 'customers', 'cohort_active_v1', 'monetario_no_validado'); },
      (d: any) => { d.cohorts.rows[0].cells[0].retention = m('1.5', 'ratio', 'cohort_retention_v1'); },
      (d: any) => { d.cohorts.rows[0].cells[0].activeCustomers = m('1.5', 'customers', 'cohort_active_v1'); },
      (d: any) => { d.cohorts.rows[0].cells[0].ticket = m('-1', 'currency', 'cohort_ticket_v1'); },
      (d: any) => { d.segments.rows[0].customers = { value: '8', absence: 'privacidad', unit: 'customers', definition: 'segment_customers_v1' }; },
      (d: any) => { d.segments.rows[0].customers = { value: 8, absence: null, unit: 'customers', definition: 'segment_customers_v1' }; },
    ];
    for (const mutate of cases) {
      const d = clone(validData()); mutate(d); expect(ok(d)).toBe(false);
    }
  });

  it('DefinitionCode es exactamente la tercera columna de la tabla', () => {
    expect([...contract.DEFINITION_CODES].sort()).toEqual([
      'cohort_active_v1', 'cohort_mean_days_between_purchases_v1', 'cohort_observed_value_per_customer_cumulative_v1',
      'cohort_observed_value_v1', 'cohort_purchase_intervals_v1', 'cohort_repeat_customers_v1',
      'cohort_repeat_cumulative_v1', 'cohort_retention_v1', 'cohort_size_observed_v1', 'cohort_ticket_v1',
      'excluded_before_window_v1', 'proposal_identified_customers_v1', 'segment_customers_v1',
      'segment_frequency_mean_v1', 'segment_monetary_per_customer_v1', 'segment_monetary_per_order_v1',
      'segment_monetary_v1', 'segment_orders_v1', 'segment_recency_median_days_v1', 'segment_total_customers_v1',
    ].sort());
    for (const code of contract.DEFINITION_CODES) expect(rules.DEFINITION_TEXT[code]).toBeTruthy();
  });

  it('segmentos: seis códigos exactos, en el orden de prioridad', () => {
    const dup = clone(validData()) as any; dup.segments.rows[1].code = 'inactivos'; expect(ok(dup)).toBe(false);
    const order = clone(validData()) as any;
    [order.segments.rows[0], order.segments.rows[1]] = [order.segments.rows[1], order.segments.rows[0]];
    expect(ok(order)).toBe(false);
    const short = clone(validData()) as any; short.segments.rows.pop(); expect(ok(short)).toBe(false);
  });

  it('cohortes: meses únicos descendentes, hasta 24, offsets 0..12 ordenados y mes calendario coherente', () => {
    const dup = clone(validData()) as any; dup.cohorts.rows[1] = cohortRow('2026-09'); expect(ok(dup)).toBe(false);
    const asc = clone(validData()) as any; asc.cohorts.rows.reverse(); expect(ok(asc)).toBe(false);
    const many = clone(validData()) as any;
    many.cohorts.rows = Array.from({ length: 25 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 9 - i, 1));
      return cohortRow(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    });
    expect(ok(many)).toBe(false);
    const off = clone(validData()) as any; off.cohorts.rows[0].cells[3].offset = 2; expect(ok(off)).toBe(false);
    const cal = clone(validData()) as any; cal.cohorts.rows[0].cells[1].calendarMonth = '2026-12'; expect(ok(cal)).toBe(false);
  });

  it('una celda oculta no deja métricas visibles que la reconstruyan', () => {
    const d = clone(validData()) as any;
    d.cohorts.rows[0].cells[3].ticket = m('80', 'currency', 'cohort_ticket_v1');
    expect(ok(d)).toBe(false);
  });

  it('coherencia de Monetary: sin verificación no hay segmentos ni dinero de cohortes', () => {
    const unverifiedWithDef = clone(validData()) as any;
    unverifiedWithDef.quality.monetary = { status: 'unverified', definition: 'tn_paid_current_observed_v1' };
    expect(ok(unverifiedWithDef)).toBe(false);

    const verifiedNoDef = clone(validData()) as any;
    verifiedNoDef.quality.monetary = { status: 'verified', definition: null };
    expect(ok(verifiedNoDef)).toBe(false);

    const unverified = clone(validData()) as any;
    unverified.quality.monetary = { status: 'unverified', definition: null };
    expect(ok(unverified)).toBe(false);
    unverified.segments = { status: 'unavailable', absence: 'monetario_no_validado', definition: 'segment_partition_v1' };
    unverified.productEvidence.crossSell = { status: 'unavailable', absence: 'monetario_no_validado', definition: 'cross_sell_pair_v1' };
    expect(ok(unverified)).toBe(false);
    for (const row of unverified.cohorts.rows) {
      for (const c of row.cells) {
        for (const key of ['observedValue', 'ticket', 'observedValuePerCustomerCumulative']) {
          if (c[key].value !== null) c[key] = m(null, c[key].unit, c[key].definition, 'monetario_no_validado');
        }
      }
    }
    expect(contract.insightsDataSchema.safeParse(unverified).error?.issues ?? []).toEqual([]);

    const incomplete = clone(unverified);
    incomplete.quality.monetary = { status: 'incomplete', definition: null };
    expect(ok(incomplete)).toBe(false);
    incomplete.segments = { status: 'unavailable', absence: 'dato_incompleto', definition: 'segment_partition_v1' };
    expect(ok(incomplete)).toBe(true);
  });

  it('evidencia de productos coherente con la calidad', () => {
    const d = clone(validData()) as any; d.productEvidence.catalogComplete = false; expect(ok(d)).toBe(false);
    const e = clone(validData()) as any;
    e.quality.catalog = 'incompleto'; e.productEvidence.catalogComplete = false;
    expect(ok(e)).toBe(false);
    e.productEvidence.crossSell = { status: 'unavailable', absence: 'dato_incompleto', definition: 'cross_sell_pair_v1' };
    expect(ok(e)).toBe(true);
    const name = clone(validData()) as any; name.productEvidence.crossSell.productAName = ''; expect(ok(name)).toBe(false);
  });
});

describe('parseCurrencyParam', () => {
  it('solo un string ISO de tres letras o ausencia', () => {
    expect(contract.parseCurrencyParam(undefined)).toEqual({ ok: true, currency: null });
    expect(contract.parseCurrencyParam(null)).toEqual({ ok: true, currency: null });
    expect(contract.parseCurrencyParam('USD')).toEqual({ ok: true, currency: 'USD' });
    for (const bad of [['USD', 'ARS'], 'usd', 'US', 'USDD', '', 1, {}, ' USD']) {
      expect(contract.parseCurrencyParam(bad)).toEqual({ ok: false });
    }
  });
});

function proposal(overrides: Partial<Proposal> = {}): Proposal {
  const base = rules.PROPOSAL_CATALOG.fidelizacion_v1;
  return {
    id: 'fidelizacion_v1', ruleVersion: 'audience_rules_v1', name: base.name, objective: base.objective,
    segmentRefs: ['alto_valor'], identifiedCustomers: m('8', 'customers', 'proposal_identified_customers_v1') as never,
    identifiedCustomersAbsence: null, inclusion: ['segment_alto_valor'],
    exclusion: ['segment_inactivos', 'segment_riesgo', 'segment_nuevos', 'segment_frecuentes', 'segment_potencial'],
    evidenceRefs: ['segments.alto_valor.monetaryPerCustomer', 'segments.alto_valor.frequencyMean'],
    justification: base.justification, suggestedStrategy: base.suggestedStrategy, limitations: [...base.limitations],
    ...overrides,
  } as Proposal;
}

describe('AudienceProposal (§1.1)', () => {
  it('acepta la forma exacta y resuelve su evidencia', () => {
    expect(contract.audienceProposalSchema.safeParse(proposal()).success).toBe(true);
    expect(contract.proposalsResolve(validData(), [proposal()])).toBe(true);
  });

  it('rechaza claves extra, XOR roto, textos fuera del catálogo y métrica incompatible', () => {
    expect(contract.audienceProposalSchema.safeParse({ ...proposal(), customerIds: [] }).success).toBe(false);
    expect(contract.audienceProposalSchema.safeParse(proposal({ identifiedCustomersAbsence: 'privacidad' })).success).toBe(false);
    expect(contract.audienceProposalSchema.safeParse(proposal({ identifiedCustomers: null })).success).toBe(false);
    expect(contract.audienceProposalSchema.safeParse(proposal({ name: 'Texto libre' })).success).toBe(false);
    expect(contract.audienceProposalSchema.safeParse(proposal({ limitations: ['otra'] })).success).toBe(false);
    expect(contract.audienceProposalSchema.safeParse(proposal({
      identifiedCustomers: m('8', 'customers', 'segment_customers_v1') as never })).success).toBe(false);
  });

  it('rechaza referencias inexistentes u ocultas', () => {
    expect(contract.proposalsResolve(validData(), [proposal({ evidenceRefs: ['segments.alto_valor.inventada' as never] })])).toBe(false);
    expect(contract.proposalsResolve(validData(), [proposal({ evidenceRefs: ['cohorts.2026-09.4.ticket'] })])).toBe(false);
    expect(contract.proposalsResolve(validData(), [proposal({ evidenceRefs: ['cohorts.2026-01.0.ticket'] })])).toBe(false);
    expect(contract.proposalsResolve(validData(), [proposal({ evidenceRefs: ['cohorts.2026-09.1.ticket'] })])).toBe(true);
    expect(contract.proposalsResolve(validData(), [proposal({ evidenceRefs: ['segments.nuevos.monetaryPerCustomer'] })])).toBe(false);
  });
});

describe('CustomerInsightsView (T-15)', () => {
  const sel = { availableCurrencies: ['ARS', 'USD'], selectedCurrency: 'ARS' };
  const parse = (view: unknown) => contract.customerInsightsViewSchema.safeParse(view).success;

  it('las once variantes llevan la selección de moneda y nada de texto', () => {
    const empty = { availableCurrencies: [], selectedCurrency: null };
    expect(parse({ kind: 'sin_empresa', ...empty })).toBe(true);
    expect(parse({ kind: 'sin_conexion', actionHref: '/app/integraciones', ...empty })).toBe(true);
    expect(parse({ kind: 'requiere_reauth', actionHref: '/app/integraciones', ...empty })).toBe(true);
    expect(parse({ kind: 'actualizando', ...empty })).toBe(true);
    const context = { source: 'tiendanube', asOfDay: null, fetchedAt: null, timezone: null, currency: null, rfmFrom: null };
    expect(parse({ kind: 'sin_cobertura', context, actionHref: '/app/integraciones', ...empty })).toBe(true);
    expect(parse({ kind: 'sin_compras', context, ...empty })).toBe(true);
    expect(parse({ kind: 'listo', data: validData(), proposals: [proposal()], ...sel })).toBe(true);
    expect(parse({ kind: 'error', ...empty })).toBe(true);
    expect(parse({ kind: 'error', message: 'boom', ...empty })).toBe(false);
    expect(parse({ kind: 'sin_empresa' })).toBe(false);
  });

  it('kind coherente con la calidad: no se colapsan estados', () => {
    const unverified = validData() as any;
    unverified.quality.monetary = { status: 'unverified', definition: null };
    unverified.segments = { status: 'unavailable', absence: 'monetario_no_validado', definition: 'segment_partition_v1' };
    unverified.productEvidence.crossSell = { status: 'unavailable', absence: 'monetario_no_validado', definition: 'cross_sell_pair_v1' };
    for (const row of unverified.cohorts.rows) for (const c of row.cells) {
      for (const key of ['observedValue', 'ticket', 'observedValuePerCustomerCumulative']) {
        if (c[key].value !== null) c[key] = m(null, c[key].unit, c[key].definition, 'monetario_no_validado');
      }
    }
    expect(parse({ kind: 'monetario_no_validado', data: unverified, proposals: [], ...sel })).toBe(true);
    expect(parse({ kind: 'listo', data: unverified, proposals: [], ...sel })).toBe(false);
    expect(parse({ kind: 'calidad_insuficiente', data: unverified, proposals: [], ...sel })).toBe(false);

    const incomplete = structuredClone(unverified);
    incomplete.quality.monetary = { status: 'incomplete', definition: null };
    incomplete.segments.absence = 'dato_incompleto';
    expect(parse({ kind: 'calidad_insuficiente', data: incomplete, proposals: [], ...sel })).toBe(true);
    expect(parse({ kind: 'monetario_no_validado', data: incomplete, proposals: [], ...sel })).toBe(false);

    const priv = validData() as any;
    priv.segments = { status: 'unavailable', absence: 'privacidad', definition: 'segment_partition_v1' };
    priv.productEvidence.crossSell = { status: 'unavailable', absence: 'privacidad', definition: 'cross_sell_pair_v1' };
    expect(parse({ kind: 'privacidad', data: priv, proposals: [], ...sel })).toBe(true);
    expect(parse({ kind: 'listo', data: priv, proposals: [], ...sel })).toBe(false);
    expect(parse({ kind: 'privacidad', data: validData(), proposals: [], ...sel })).toBe(false);
  });

  it('la moneda elegida es una de las disponibles y coincide con el payload', () => {
    expect(parse({ kind: 'listo', data: validData(), proposals: [], availableCurrencies: ['ARS'], selectedCurrency: 'USD' })).toBe(false);
    expect(parse({ kind: 'listo', data: validData(), proposals: [], availableCurrencies: ['USD', 'ARS'], selectedCurrency: 'ARS' })).toBe(false);
    expect(parse({ kind: 'listo', data: validData(), proposals: [], availableCurrencies: ['ARS', 'USD'], selectedCurrency: 'USD' })).toBe(false);
  });
});
