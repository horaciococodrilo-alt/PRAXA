import { z } from 'zod';

import { evidenceIdSchema, isoDateSchema, periodSchema } from '@/modules/reporting/contract/primitives';

/**
 * Contrato del diagnóstico de Meta Ads (M26a): objetivo, filas de las funciones SQL, evidencia
 * tipada y causas de lista cerrada. Toda cifra es texto decimal exacto o null (CA-44b): null
 * significa «no calculable» o «sin dato», nunca cero.
 */

export const SCHEMA_VERSION = 1 as const;
export const METHODOLOGY_VERSION = 'meta-diag-1' as const;

export const GOAL_KINDS = ['purchase', 'inquiry', 'traffic'] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

export const ACTION_TYPE_PATTERN = /^[A-Za-z0-9._]{1,128}$/;
const METRIC_REF_PATTERN = /^actions:[A-Za-z0-9._]{1,128}$/;

export const diagnosticSettingsSchema = z.strictObject({
  goal_kind: z.enum(GOAL_KINDS),
  metric_ref: z.string(),
}).refine((s) => s.goal_kind === 'traffic'
  ? s.metric_ref === 'inline_link_clicks'
  : METRIC_REF_PATTERN.test(s.metric_ref), { message: 'objetivo y métrica incompatibles' });
export type DiagnosticSettings = z.infer<typeof diagnosticSettingsSchema>;

export const ELIGIBILITY_REASONS = [
  'no_settings', 'connection_not_active', 'sync_missing', 'sync_running', 'sync_not_usable',
  'sync_stale', 'sync_not_after_report', 'too_soon',
] as const;
export type EligibilityReason = (typeof ELIGIBILITY_REASONS)[number];

/** Instante ISO con microsegundos, tal como lo emite la base; se reenvía sin pasar por Date. */
export const isoInstantTextSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/);

export const eligibilitySchema = z.strictObject({
  eligible: z.boolean(),
  reason: z.enum(ELIGIBILITY_REASONS).nullable(),
  available_at: isoInstantTextSchema.nullable(),
  sync_finished_at: isoInstantTextSchema.nullable(),
  window_to: isoDateSchema.nullable(),
}).refine((e) => e.eligible === (e.reason === null), { message: 'elegibilidad incoherente' });
export type Eligibility = z.infer<typeof eligibilitySchema>;

/** Causas de lista cerrada de las secciones «no evaluable» y de los límites de datos. */
export const CAUSES = [
  'no_activity', 'no_coverage', 'no_goal_action', 'no_comparison', 'low_sample',
  'breakdown_unavailable', 'web_unavailable', 'partial_coverage',
] as const;
export type Cause = (typeof CAUSES)[number];

export const decimalTextSchema = z.string().regex(/^-?\d+(\.\d+)?$/);
const decimal = decimalTextSchema.nullable();
const currency = z.string().regex(/^([A-Z]{3}|mixed)$/).nullable();
const attribution = z.string().regex(/^(unknown|mixed|attr_[0-9a-f]{32})$/);

export const actionTypeRowSchema = z.strictObject({
  action_type: z.string().regex(ACTION_TYPE_PATTERN),
  observed_days: z.number().int().nonnegative(),
  total_count: decimal,
});
export type ActionTypeRow = z.infer<typeof actionTypeRowSchema>;

export const accountMetricsRowSchema = z.strictObject({
  period: z.enum(['current', 'previous']),
  spend: decimal, impressions: decimal, clicks: decimal, link_clicks: decimal,
  result_count: decimal, result_value: decimal, ctr: decimal, cpc: decimal, cpm: decimal,
  cost_per_result: decimal, attributed_return: decimal,
  currency, attribution,
  days_with_data: z.number().int().nonnegative(), days_no_row: z.number().int().nonnegative(),
  days_not_observed: z.number().int().nonnegative(), days_open: z.number().int().nonnegative(),
  days_partial: z.number().int().nonnegative(),
  activity_status: z.enum(['active', 'zero', 'no_coverage']),
  fetched_at_min: isoInstantTextSchema.nullable(), fetched_at_max: isoInstantTextSchema.nullable(),
  open_dates: z.array(isoDateSchema), partial_dates: z.array(isoDateSchema),
});
export type AccountMetricsRow = z.infer<typeof accountMetricsRowSchema>;

export const ENTITY_LEVELS = ['campaign', 'adset', 'ad'] as const;
export type EntityLevel = (typeof ENTITY_LEVELS)[number];

export const entityMetricsRowSchema = z.strictObject({
  entity_ref: z.uuid(), name: z.string().nullable(), parent_ref: z.uuid().nullable(),
  effective_status: z.string().nullable(), objective: z.string().nullable(),
  currency, attribution,
  cur_spend: decimal, cur_impressions: decimal, cur_clicks: decimal, cur_result_count: decimal,
  cur_result_value: decimal, cur_ctr: decimal, cur_cpc: decimal, cur_cpm: decimal,
  cur_cost_per_result: decimal, cur_attributed_return: decimal,
  prev_spend: decimal, prev_impressions: decimal, prev_clicks: decimal, prev_result_count: decimal,
  prev_result_value: decimal, prev_ctr: decimal, prev_cpc: decimal, prev_cpm: decimal,
  prev_cost_per_result: decimal, prev_attributed_return: decimal,
  var_spend: decimal, var_ctr: decimal, var_cost_per_result: decimal, var_attributed_return: decimal,
  days_with_row: z.number().int().nonnegative(), days_open: z.number().int().nonnegative(),
});
export type EntityMetricsRow = z.infer<typeof entityMetricsRowSchema>;

export const BREAKDOWN_DIMENSIONS = ['age_gender', 'country', 'region'] as const;
export type BreakdownDimension = (typeof BREAKDOWN_DIMENSIONS)[number];

export const breakdownMetricsRowSchema = z.strictObject({
  dimension: z.enum(BREAKDOWN_DIMENSIONS),
  segment_key: z.string().min(1).max(260), segment_label: z.string().min(1).max(260),
  spend: decimal, impressions: decimal, clicks: decimal, result_count: decimal,
  ctr: decimal, cpc: decimal, cost_per_result: decimal, currency,
  attribution: z.literal('unknown'),
  last_attempt_status: z.enum(['complete', 'failed']).nullable(),
  segments_total: z.number().int().nonnegative(),
});
export type BreakdownMetricsRow = z.infer<typeof breakdownMetricsRowSchema>;

export const METRICS = [
  'spend', 'impressions', 'clicks', 'link_clicks', 'result_count', 'result_value', 'ctr', 'cpc',
  'cpm', 'cost_per_result', 'attributed_return', 'var_spend', 'var_ctr', 'var_cost_per_result',
  'var_attributed_return',
] as const;
export type Metric = (typeof METRICS)[number];

export const UNITS = ['money', 'count', 'percent', 'variation', 'ratio'] as const;
export type Unit = (typeof UNITS)[number];

export const METRIC_UNITS: Readonly<Record<Metric, Unit>> = {
  spend: 'money', impressions: 'count', clicks: 'count', link_clicks: 'count',
  result_count: 'count', result_value: 'money', ctr: 'percent', cpc: 'money', cpm: 'money',
  cost_per_result: 'money', attributed_return: 'ratio', var_spend: 'variation',
  var_ctr: 'variation', var_cost_per_result: 'variation', var_attributed_return: 'variation',
};

/** Rótulos fijos. El retorno es siempre «atribuido por Meta»; nunca ganancia. */
export const METRIC_LABELS: Readonly<Record<Metric, string>> = {
  spend: 'Gasto', impressions: 'Impresiones', clicks: 'Clics', link_clicks: 'Clics al enlace',
  result_count: 'Resultados del objetivo', result_value: 'Valor atribuido por Meta',
  ctr: 'CTR (porcentaje de clics sobre impresiones)', cpc: 'Costo por clic',
  cpm: 'Costo por mil impresiones', cost_per_result: 'Costo por resultado',
  attributed_return: 'Retorno atribuido por Meta (valor atribuido / gasto)',
  var_spend: 'Variación del gasto', var_ctr: 'Variación del CTR',
  var_cost_per_result: 'Variación del costo por resultado',
  var_attributed_return: 'Variación del retorno atribuido por Meta',
};

export const evidenceLevelSchema = z.enum(['account', 'campaign', 'adset', 'ad']);

export const evidenceSchema = z.strictObject({
  id: evidenceIdSchema,
  kind: z.enum(['system_fact', 'calculated_metric']),
  level: evidenceLevelSchema,
  entity_alias: z.string().regex(/^e[1-9]\d{0,5}$/).nullable(),
  segment: z.strictObject({ dimension: z.enum(BREAKDOWN_DIMENSIONS), label: z.string() }).nullable(),
  period: periodSchema,
  metric: z.enum(METRICS),
  value: decimal,
  unit: z.enum(UNITS),
  currency,
  attribution,
  coverage: z.record(z.string(), z.number().int().nonnegative()),
  sample: z.enum(['ok', 'low_sample']),
  provenance: z.strictObject({
    fn: z.string(),
    window: periodSchema,
    fetched_at_min: isoInstantTextSchema.nullable(),
    fetched_at_max: isoInstantTextSchema.nullable(),
  }),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const manifestSchema = z.strictObject({
  entities_examined: z.strictObject({ campaign: z.number().int(), adset: z.number().int(), ad: z.number().int() }),
  batches: z.number().int().nonnegative(),
  pages_read: z.number().int().nonnegative(),
  segments_omitted: z.strictObject({ age_gender: z.number().int(), country: z.number().int(), region: z.number().int() }),
  open_days: z.array(isoDateSchema),
  partial_capture_days: z.array(isoDateSchema),
});
export type Manifest = z.infer<typeof manifestSchema>;

export type SectionStatus = Readonly<{ status: 'evaluable' } | { status: 'not_evaluable'; cause: Cause }>;

export type DiagnosticWindow = Readonly<{ from: string; to: string; prev_from: string; prev_to: string }>;
