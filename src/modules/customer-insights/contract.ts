/**
 * Contrato público de M27a (spec §1.1). Todo objeto es estricto: una clave desconocida falla.
 * Ninguna forma lleva IDs de empresa, conexión, tienda, cliente, pedido, producto o variante.
 *
 * Dinero, tasas y medias viajan como strings decimales exactos; no hay `number` para ellos.
 */

import { z } from 'zod';

import { PROPOSAL_CATALOG } from './rules';

// ---------------------------------------------------------------------------
// Vocabulario cerrado
// ---------------------------------------------------------------------------

export const ABSENCES = ['sin_cobertura', 'periodo_abierto', 'monetario_no_validado', 'dato_incompleto', 'privacidad',
  'sin_denominador'] as const;
export type Absence = (typeof ABSENCES)[number];

export const METRIC_UNITS = ['customers', 'orders', 'currency', 'days', 'ratio', 'orders_per_customer', 'intervals'] as const;
export type MetricUnit = (typeof METRIC_UNITS)[number];

/** Tabla de §1.1: cada definición fija su unidad y las ausencias que admite. */
const METRIC_SPECS = {
  segment_total_customers_v1: { unit: 'customers', absences: [] },
  excluded_before_window_v1: { unit: 'customers', absences: ['privacidad'] },
  segment_customers_v1: { unit: 'customers', absences: [] },
  segment_orders_v1: { unit: 'orders', absences: [] },
  segment_monetary_v1: { unit: 'currency', absences: [] },
  segment_monetary_per_customer_v1: { unit: 'currency', absences: ['sin_denominador'] },
  segment_monetary_per_order_v1: { unit: 'currency', absences: ['sin_denominador'] },
  segment_recency_median_days_v1: { unit: 'days', absences: ['sin_denominador'] },
  segment_frequency_mean_v1: { unit: 'orders_per_customer', absences: ['sin_denominador'] },
  cohort_size_observed_v1: { unit: 'customers', absences: [] },
  cohort_active_v1: { unit: 'customers', absences: ['sin_cobertura', 'periodo_abierto', 'privacidad'] },
  cohort_retention_v1: { unit: 'ratio', absences: ['sin_cobertura', 'periodo_abierto', 'privacidad', 'sin_denominador'] },
  cohort_repeat_cumulative_v1: { unit: 'ratio', absences: ['sin_cobertura', 'periodo_abierto', 'privacidad', 'sin_denominador'] },
  cohort_observed_value_v1: { unit: 'currency',
    absences: ['sin_cobertura', 'periodo_abierto', 'monetario_no_validado', 'dato_incompleto', 'privacidad'] },
  cohort_ticket_v1: { unit: 'currency',
    absences: ['sin_cobertura', 'periodo_abierto', 'monetario_no_validado', 'dato_incompleto', 'privacidad', 'sin_denominador'] },
  cohort_observed_value_per_customer_cumulative_v1: { unit: 'currency',
    absences: ['sin_cobertura', 'periodo_abierto', 'monetario_no_validado', 'dato_incompleto', 'privacidad', 'sin_denominador'] },
  cohort_mean_days_between_purchases_v1: { unit: 'days',
    absences: ['sin_cobertura', 'periodo_abierto', 'dato_incompleto', 'privacidad', 'sin_denominador'] },
  cohort_repeat_customers_v1: { unit: 'customers',
    absences: ['sin_cobertura', 'periodo_abierto', 'dato_incompleto', 'privacidad'] },
  cohort_purchase_intervals_v1: { unit: 'intervals',
    absences: ['sin_cobertura', 'periodo_abierto', 'dato_incompleto', 'privacidad'] },
  proposal_identified_customers_v1: { unit: 'customers', absences: [] },
} as const satisfies Record<string, { unit: MetricUnit; absences: readonly Absence[] }>;

export type DefinitionCode = keyof typeof METRIC_SPECS;
export const DEFINITION_CODES = Object.keys(METRIC_SPECS) as DefinitionCode[];

export const MONETARY_DEFINITIONS = ['tn_paid_current_observed_v1', 'tn_paid_current_less_verified_refunds_v1'] as const;
export type MonetaryDefinition = (typeof MONETARY_DEFINITIONS)[number];

/** Orden de prioridad de §4: también es el orden obligatorio de `segments.rows`. */
export const SEGMENT_CODES = ['inactivos', 'riesgo', 'nuevos', 'alto_valor', 'frecuentes', 'potencial'] as const;
export type SegmentCode = (typeof SEGMENT_CODES)[number];

export const PROPOSAL_IDS = ['fidelizacion_v1', 'remarketing_v1', 'reactivacion_riesgo_v1', 'reactivacion_inactivos_v1',
  'exclusion_adquisicion_v1', 'similares_alto_valor_v1', 'venta_cruzada_v1'] as const;
export type ProposalId = (typeof PROPOSAL_IDS)[number];

export const CRITERION_CODES = [...SEGMENT_CODES.map((code) => `segment_${code}` as const),
  'comprador_identificado_365d', 'compro_producto_a', 'no_compro_producto_b'] as const;
export type CriterionCode = (typeof CRITERION_CODES)[number];

export const SEGMENT_METRIC_KEYS = ['customers', 'orders', 'monetary', 'monetaryPerCustomer', 'monetaryPerOrder',
  'recencyMedianDays', 'frequencyMean'] as const;
export type SegmentMetricKey = (typeof SEGMENT_METRIC_KEYS)[number];

export const COHORT_METRIC_KEYS = ['activeCustomers', 'retention', 'repeatPurchaseCumulative', 'observedValue', 'ticket',
  'observedValuePerCustomerCumulative', 'meanDaysBetweenPurchases', 'repeatCustomers', 'purchaseIntervals'] as const;
export type CohortMetricKey = (typeof COHORT_METRIC_KEYS)[number];

export type EvidenceRef =
  | `segments.${SegmentCode}.${SegmentMetricKey}`
  | `cohorts.${string}.${number}.${CohortMetricKey}`
  | 'productEvidence.crossSell';

const COHORT_MONEY_KEYS = ['observedValue', 'ticket', 'observedValuePerCustomerCumulative'] as const;

// ---------------------------------------------------------------------------
// Métrica
// ---------------------------------------------------------------------------

const INTEGER = /^(?:0|[1-9][0-9]{0,15})$/;
const DECIMAL = /^(?:0|[1-9][0-9]{0,17})(?:\.[0-9]{1,12})?$/;

function validValue(unit: MetricUnit, value: string): boolean {
  if (unit === 'customers' || unit === 'orders' || unit === 'intervals') {
    return INTEGER.test(value) && Number.isSafeInteger(Number(value));
  }
  if (!DECIMAL.test(value)) return false;
  if (unit === 'ratio') {
    const [whole, fraction = ''] = value.split('.');
    return whole === '0' || (whole === '1' && /^0*$/.test(fraction));
  }
  return true;
}

const metricShape = z.strictObject({
  value: z.string().nullable(),
  absence: z.enum(ABSENCES).nullable(),
  unit: z.enum(METRIC_UNITS),
  definition: z.enum(DEFINITION_CODES as [DefinitionCode, ...DefinitionCode[]]),
});

export type Metric = Readonly<{ value: string | null; absence: Absence | null; unit: MetricUnit; definition: DefinitionCode }>;

/** Métrica con su definición fijada por la tabla. */
function metric(definition: DefinitionCode) {
  const spec = METRIC_SPECS[definition];
  return metricShape.superRefine((m, ctx) => {
    if (m.definition !== definition || m.unit !== spec.unit) ctx.addIssue({ code: 'custom', message: 'unidad/definición' });
    if ((m.value === null) === (m.absence === null)) ctx.addIssue({ code: 'custom', message: 'value XOR absence' });
    if (m.value !== null && !validValue(spec.unit, m.value)) ctx.addIssue({ code: 'custom', message: 'valor' });
    if (m.absence !== null && !(spec.absences as readonly Absence[]).includes(m.absence)) {
      ctx.addIssue({ code: 'custom', message: 'ausencia no permitida' });
    }
  });
}

// ---------------------------------------------------------------------------
// InsightsData
// ---------------------------------------------------------------------------

const DAY = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/);
const MONTH = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/);
const INSTANT = z.string().refine((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) &&
  Number.isFinite(Date.parse(v)));
const CURRENCY = z.string().regex(/^[A-Z]{3}$/);
const TIMEZONE = z.string().min(1).max(64).regex(/^[A-Za-z0-9_+\-/]+$/);

const qualitySchema = z.strictObject({
  coverage: z.strictObject({ fromDay: DAY.nullable(), throughDay: DAY.nullable(), complete: z.boolean() }),
  identity: z.enum(['completa', 'incompleta', 'no_evaluable']),
  monetary: z.strictObject({
    status: z.enum(['verified', 'unverified', 'incomplete', 'inconsistent']),
    definition: z.enum(MONETARY_DEFINITIONS).nullable(),
  }),
  catalog: z.enum(['completo', 'incompleto']),
  orderLines: z.enum(['completas', 'incompletas']),
});

const segmentRowSchema = z.strictObject({
  code: z.enum(SEGMENT_CODES),
  customers: metric('segment_customers_v1'),
  orders: metric('segment_orders_v1'),
  monetary: metric('segment_monetary_v1'),
  monetaryPerCustomer: metric('segment_monetary_per_customer_v1'),
  monetaryPerOrder: metric('segment_monetary_per_order_v1'),
  recencyMedianDays: metric('segment_recency_median_days_v1'),
  frequencyMean: metric('segment_frequency_mean_v1'),
}).superRefine((row, ctx) => {
  const empty = row.customers.value === '0';
  for (const key of ['monetaryPerCustomer', 'monetaryPerOrder', 'recencyMedianDays', 'frequencyMean'] as const) {
    if ((row[key].absence === 'sin_denominador') !== empty) ctx.addIssue({ code: 'custom', message: 'sin_denominador solo en fila vacía' });
  }
});

const segmentSectionSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('available'),
    totalCustomers: metric('segment_total_customers_v1'),
    excludedBeforeWindow: metric('excluded_before_window_v1'),
    rows: z.array(segmentRowSchema).length(6),
  }).superRefine((s, ctx) => {
    if (s.rows.some((row, i) => row.code !== SEGMENT_CODES[i])) ctx.addIssue({ code: 'custom', message: 'orden de segmentos' });
  }),
  z.strictObject({
    status: z.literal('unavailable'),
    absence: z.enum(['monetario_no_validado', 'dato_incompleto', 'privacidad']),
    definition: z.literal('segment_partition_v1'),
  }),
]);

const cohortCellSchema = z.strictObject({
  offset: z.number().int().min(0).max(12),
  calendarMonth: MONTH,
  activeCustomers: metric('cohort_active_v1'),
  retention: metric('cohort_retention_v1'),
  repeatPurchaseCumulative: metric('cohort_repeat_cumulative_v1'),
  observedValue: metric('cohort_observed_value_v1'),
  ticket: metric('cohort_ticket_v1'),
  observedValuePerCustomerCumulative: metric('cohort_observed_value_per_customer_cumulative_v1'),
  meanDaysBetweenPurchases: metric('cohort_mean_days_between_purchases_v1'),
  repeatCustomers: metric('cohort_repeat_customers_v1'),
  purchaseIntervals: metric('cohort_purchase_intervals_v1'),
}).superRefine((cell, ctx) => {
  // Una celda oculta, abierta o sin cobertura no deja ninguna métrica que la reconstruya.
  if (cell.activeCustomers.value === null && COHORT_METRIC_KEYS.some((key) => cell[key].value !== null)) {
    ctx.addIssue({ code: 'custom', message: 'celda oculta con métricas visibles' });
  }
});

function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const cohortRowSchema = z.strictObject({
  cohortMonth: MONTH,
  size: metric('cohort_size_observed_v1'),
  cells: z.array(cohortCellSchema).length(13),
}).superRefine((row, ctx) => {
  row.cells.forEach((cell, i) => {
    if (cell.offset !== i || cell.calendarMonth !== addMonths(row.cohortMonth, i)) {
      ctx.addIssue({ code: 'custom', message: 'offsets/mes calendario' });
    }
  });
});

const cohortSectionSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('available'), rows: z.array(cohortRowSchema).max(24) }).superRefine((s, ctx) => {
    for (let i = 1; i < s.rows.length; i += 1) {
      if (!(s.rows[i].cohortMonth < s.rows[i - 1].cohortMonth)) ctx.addIssue({ code: 'custom', message: 'meses descendentes' });
    }
  }),
  z.strictObject({
    status: z.literal('unavailable'),
    absence: z.enum(['sin_cobertura', 'dato_incompleto', 'privacidad']),
    definition: z.literal('cohorts_observed_v1'),
  }),
]);

const PRODUCT_NAME = z.string().min(1).max(255);

const crossSellSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('available'),
    sourceSegment: z.enum(['frecuentes', 'alto_valor']),
    productAName: PRODUCT_NAME,
    productBName: PRODUCT_NAME,
    coPurchaseSufficient: z.literal(true),
    targetSufficient: z.literal(true),
    identifiedCustomers: z.null(),
    identifiedCustomersAbsence: z.literal('privacidad'),
    definition: z.literal('cross_sell_pair_v1'),
  }),
  z.strictObject({
    status: z.literal('unavailable'),
    absence: z.enum(['dato_incompleto', 'privacidad', 'monetario_no_validado']),
    definition: z.literal('cross_sell_pair_v1'),
  }),
]);

const insightsDataShape = z.strictObject({
  ruleset: z.literal('rfm_v1'),
  source: z.literal('tiendanube'),
  asOfDay: DAY,
  fetchedAt: INSTANT,
  timezone: TIMEZONE,
  currency: CURRENCY,
  rfmFrom: DAY,
  firstPurchaseBasis: z.literal('observada'),
  quality: qualitySchema,
  segments: segmentSectionSchema,
  cohorts: cohortSectionSchema,
  productEvidence: z.strictObject({
    catalogComplete: z.boolean(),
    linesComplete: z.boolean(),
    crossSell: crossSellSchema,
  }),
});

export const insightsDataSchema = insightsDataShape.superRefine((d, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const { status, definition } = d.quality.monetary;
  if ((status === 'verified') !== (definition !== null)) issue('monetary: estado/definición');
  if (status === 'verified') {
    if (d.segments.status === 'unavailable' && d.segments.absence === 'monetario_no_validado') issue('segmentos sin Monetary');
  } else {
    const expected = status === 'unverified' ? 'monetario_no_validado' : 'dato_incompleto';
    if (d.segments.status !== 'unavailable' || d.segments.absence !== expected) issue('segmentos con Monetary no verificado');
    if (d.cohorts.status === 'available' && d.cohorts.rows.some((row) =>
      row.cells.some((cell) => COHORT_MONEY_KEYS.some((key) => cell[key].value !== null)))) {
      issue('dinero de cohortes sin Monetary');
    }
  }
  const pe = d.productEvidence;
  if (pe.catalogComplete !== (d.quality.catalog === 'completo') || pe.linesComplete !== (d.quality.orderLines === 'completas')) {
    issue('evidencia de productos ≠ calidad');
  }
  if (pe.crossSell.status === 'available' && (!pe.catalogComplete || !pe.linesComplete || d.segments.status !== 'available')) {
    issue('venta cruzada sin calidad');
  }
  if (d.rfmFrom > d.asOfDay) issue('ventana');
});

export type InsightQuality = z.infer<typeof qualitySchema>;
export type SegmentRow = z.infer<typeof segmentRowSchema>;
export type SegmentSection = z.infer<typeof segmentSectionSchema>;
export type CohortCell = z.infer<typeof cohortCellSchema>;
export type CohortRow = z.infer<typeof cohortRowSchema>;
export type CohortSection = z.infer<typeof cohortSectionSchema>;
export type CrossSellEvidence = z.infer<typeof crossSellSchema>;
export type InsightsData = z.infer<typeof insightsDataShape>;

// ---------------------------------------------------------------------------
// Propuestas
// ---------------------------------------------------------------------------

const EVIDENCE_REF = /^(?:segments\.[a-z_]+\.[A-Za-z]+|cohorts\.\d{4}-\d{2}\.\d{1,2}\.[A-Za-z]+|productEvidence\.crossSell)$/;

export const audienceProposalSchema = z.strictObject({
  id: z.enum(PROPOSAL_IDS),
  ruleVersion: z.literal('audience_rules_v1'),
  name: z.string(),
  objective: z.string(),
  segmentRefs: z.array(z.enum(SEGMENT_CODES)).max(6),
  identifiedCustomers: metric('proposal_identified_customers_v1').nullable(),
  identifiedCustomersAbsence: z.enum(['privacidad', 'dato_incompleto', 'monetario_no_validado']).nullable(),
  inclusion: z.array(z.enum(CRITERION_CODES)).max(10),
  exclusion: z.array(z.enum(CRITERION_CODES)).max(10),
  evidenceRefs: z.array(z.string().regex(EVIDENCE_REF)).min(1).max(20),
  justification: z.string(),
  suggestedStrategy: z.string(),
  limitations: z.array(z.string()).max(10),
}).superRefine((p, ctx) => {
  const fixed = PROPOSAL_CATALOG[p.id];
  if (p.name !== fixed.name || p.objective !== fixed.objective || p.justification !== fixed.justification ||
      p.suggestedStrategy !== fixed.suggestedStrategy || p.limitations.length !== fixed.limitations.length ||
      p.limitations.some((text, i) => text !== fixed.limitations[i])) {
    ctx.addIssue({ code: 'custom', message: 'texto fuera del catálogo' });
  }
  if ((p.identifiedCustomers === null) === (p.identifiedCustomersAbsence === null)) {
    ctx.addIssue({ code: 'custom', message: 'identifiedCustomers XOR absence' });
  }
});

/** Propuesta tal como queda en la vista validada. */
export type ViewProposal = z.infer<typeof audienceProposalSchema>;

export type AudienceProposal = Readonly<Omit<z.infer<typeof audienceProposalSchema>, 'evidenceRefs'> & {
  evidenceRefs: readonly EvidenceRef[];
}>;

function visible(m: Metric | undefined): boolean {
  return m !== undefined && m.value !== null;
}

/** ¿La referencia apunta a una métrica visible del mismo `InsightsData`? */
export function evidenceResolves(data: InsightsData, ref: string): boolean {
  if (ref === 'productEvidence.crossSell') return data.productEvidence.crossSell.status === 'available';
  const parts = ref.split('.');
  if (parts[0] === 'segments' && parts.length === 3) {
    if (data.segments.status !== 'available') return false;
    if (!(SEGMENT_METRIC_KEYS as readonly string[]).includes(parts[2])) return false;
    const row = data.segments.rows.find((r) => r.code === parts[1]);
    return visible(row?.[parts[2] as SegmentMetricKey]);
  }
  if (parts[0] === 'cohorts' && parts.length === 4) {
    if (data.cohorts.status !== 'available') return false;
    if (!(COHORT_METRIC_KEYS as readonly string[]).includes(parts[3]) || !/^\d{1,2}$/.test(parts[2])) return false;
    const row = data.cohorts.rows.find((r) => r.cohortMonth === parts[1]);
    const cell = row?.cells.find((c) => c.offset === Number(parts[2]));
    return visible(cell?.[parts[3] as CohortMetricKey]);
  }
  return false;
}

/** Cada propuesta válida, con evidencia visible y grupos ya divulgados. */
export function proposalsResolve(data: InsightsData,
  proposals: ReadonlyArray<Readonly<{ evidenceRefs: readonly string[]; segmentRefs: readonly SegmentCode[] }>>): boolean {
  return proposals.every((p) => audienceProposalSchema.safeParse(p).success &&
    p.evidenceRefs.every((ref) => evidenceResolves(data, ref)) &&
    p.segmentRefs.every((code) => data.segments.status === 'available' &&
      visible(data.segments.rows.find((r) => r.code === code)?.customers)));
}

// ---------------------------------------------------------------------------
// Vista
// ---------------------------------------------------------------------------

const currencySelection = {
  availableCurrencies: z.array(CURRENCY).max(50),
  selectedCurrency: CURRENCY.nullable(),
};

const viewContextSchema = z.strictObject({
  source: z.literal('tiendanube'),
  asOfDay: DAY.nullable(),
  fetchedAt: INSTANT.nullable(),
  timezone: TIMEZONE.nullable(),
  currency: CURRENCY.nullable(),
  rfmFrom: DAY.nullable(),
});

const ACTION = z.literal('/app/integraciones');
const proposalsArray = z.array(audienceProposalSchema).max(7);
const withData = <K extends string>(kind: K) => z.strictObject({
  kind: z.literal(kind), data: insightsDataSchema, proposals: proposalsArray, ...currencySelection,
});

const viewShape = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('sin_empresa'), ...currencySelection }),
  z.strictObject({ kind: z.literal('sin_conexion'), actionHref: ACTION, ...currencySelection }),
  z.strictObject({ kind: z.literal('requiere_reauth'), actionHref: ACTION, ...currencySelection }),
  z.strictObject({ kind: z.literal('actualizando'), ...currencySelection }),
  z.strictObject({ kind: z.literal('sin_cobertura'), context: viewContextSchema, actionHref: ACTION, ...currencySelection }),
  z.strictObject({ kind: z.literal('sin_compras'), context: viewContextSchema, ...currencySelection }),
  withData('monetario_no_validado'),
  withData('calidad_insuficiente'),
  withData('privacidad'),
  withData('listo'),
  z.strictObject({ kind: z.literal('error'), ...currencySelection }),
]);

export type DataViewKind = 'monetario_no_validado' | 'calidad_insuficiente' | 'privacidad' | 'listo';

/** Kind que corresponde a un payload válido (tabla de calidad de §1.1). */
export function dataViewKind(data: InsightsData): DataViewKind {
  const q = data.quality;
  if (q.monetary.status === 'unverified') return 'monetario_no_validado';
  if (q.monetary.status !== 'verified' || q.identity === 'incompleta' || q.catalog !== 'completo' ||
      q.orderLines !== 'completas') return 'calidad_insuficiente';
  const hidden = (s: { status: string; absence?: string }) => s.status === 'unavailable' && s.absence === 'privacidad';
  if (hidden(data.segments) || hidden(data.cohorts)) return 'privacidad';
  return 'listo';
}

export const customerInsightsViewSchema = viewShape.superRefine((view, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const list = view.availableCurrencies;
  if (list.some((c, i) => i > 0 && !(list[i - 1] < c))) issue('monedas ordenadas y únicas');
  if (view.selectedCurrency !== null && !list.includes(view.selectedCurrency)) issue('moneda no disponible');
  if (['sin_empresa', 'sin_conexion', 'requiere_reauth'].includes(view.kind) &&
      (list.length > 0 || view.selectedCurrency !== null)) issue('selección sin conexión');
  if (view.kind === 'error' && view.selectedCurrency !== null) issue('error con moneda');
  if ('data' in view) {
    if (view.selectedCurrency !== view.data.currency) issue('moneda ≠ payload');
    if (dataViewKind(view.data) !== view.kind) issue('kind ≠ calidad');
    if (!proposalsResolve(view.data, view.proposals)) issue('propuestas sin evidencia');
  }
});

export type ViewContext = z.infer<typeof viewContextSchema>;
export type CustomerInsightsView = z.infer<typeof viewShape>;

/** `?currency=`: un único string ISO de tres letras, o ausente. Una lista es inválida. */
export function parseCurrencyParam(value: unknown): { ok: true; currency: string | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, currency: null };
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? { ok: true, currency: value } : { ok: false };
}
