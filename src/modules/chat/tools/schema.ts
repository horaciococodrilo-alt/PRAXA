import { z } from 'zod';

import { periodSchema } from '@/modules/reporting/contract/primitives';

import { CHAT_LIMITS } from '../limits';

export const TOOL_NAMES = [
  'entities', 'action_types', 'coverage', 'daily_series', 'total', 'connection_status',
  'compare_periods', 'daily_average', 'ranking', 'cost_per_result', 'share',
  'percent_change', 'breakdown',
] as const;
export type ToolName = typeof TOOL_NAMES[number];

export const chatLevelSchema = z.enum(['account', 'campaign', 'adset', 'ad']);
export const chatMetricSchema = z.enum([
  'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks',
  'ctr', 'cpc', 'cpm', 'frequency', 'action_count', 'action_value',
]);
export const chatPeriodSchema = z.strictObject({
  from: z.iso.date(), to: z.iso.date(),
}).superRefine((period, ctx) => {
  if (!periodSchema.safeParse(period).success ||
      (Date.parse(period.to) - Date.parse(period.from)) / 86_400_000 + 1 > CHAT_LIMITS.maxPeriodDays) {
    ctx.addIssue({ code: 'custom', message: 'Período inválido.' });
  }
});

const ref = z.uuid();
const actionType = z.string().regex(/^[A-Za-z0-9._]{1,128}$/);
const metricArgs = <S extends z.ZodRawShape>(shape: S) => z.strictObject({
  ...shape, metric: chatMetricSchema, action_type: actionType.optional(),
}).superRefine((args, ctx) => {
  const fields = args as { metric: string; action_type?: string };
  const isAction = fields.metric === 'action_count' || fields.metric === 'action_value';
  if (isAction !== (fields.action_type !== undefined)) {
    ctx.addIssue({ code: 'custom', message: 'Tipo de acción inválido.' });
  }
});

export const toolSchemas = {
  entities: z.strictObject({ level: chatLevelSchema }),
  action_types: z.strictObject({ entity_ref: ref, period: chatPeriodSchema }),
  coverage: z.strictObject({ level: chatLevelSchema, period: chatPeriodSchema }),
  daily_series: metricArgs({ entity_ref: ref, period: chatPeriodSchema }),
  total: metricArgs({ entity_ref: ref, period: chatPeriodSchema }),
  connection_status: z.strictObject({}),
  compare_periods: metricArgs({ entity_ref: ref, period_a: chatPeriodSchema, period_b: chatPeriodSchema }),
  daily_average: metricArgs({ entity_ref: ref, period: chatPeriodSchema }),
  ranking: metricArgs({ level: chatLevelSchema, period: chatPeriodSchema,
    order: z.enum(['asc', 'desc']), limit: z.number().int().min(1).max(20).default(10),
    include_trend: z.boolean().default(false) }),
  cost_per_result: z.strictObject({ entity_ref: ref, action_type: actionType, period: chatPeriodSchema }),
  share: metricArgs({ entity_ref: ref, period: chatPeriodSchema }),
  percent_change: metricArgs({ entity_ref: ref, period_a: chatPeriodSchema, period_b: chatPeriodSchema }),
  breakdown: metricArgs({ level: z.enum(['account', 'campaign']),
    dimension: z.enum(['age_gender', 'country', 'region']), period: chatPeriodSchema,
    entity_ref: ref.nullable(), limit: z.number().int().min(1).max(20).default(20) }),
} as const;

const FLAT_KEYS = new Set([
  'level', 'entity_ref', 'metric', 'period', 'period_a', 'period_b',
  'action_type', 'order', 'limit', 'include_trend', 'dimension',
]);
const DEFAULT_ENTITY_TOOLS = new Set<ToolName>([
  'action_types', 'daily_series', 'total', 'compare_periods', 'daily_average',
  'cost_per_result', 'percent_change',
]);

export class ToolArgumentError extends Error {
  constructor() { super('Argumentos de herramienta inválidos.'); }
}
export class ToolEntityNotFoundError extends Error {
  constructor() { super('Entidad de cuenta no disponible.'); }
}

export type ProjectedToolCall = Readonly<{
  name: ToolName;
  args: Record<string, unknown>;
  periodDefaulted: boolean;
  entityDefaulted: boolean;
}>;

/** El esquema plano del modelo se proyecta antes de validar cada herramienta. */
export function projectToolArgs(
  name: string,
  flat: Record<string, unknown>,
  defaults: { period: z.infer<typeof chatPeriodSchema>; accountEntityRef: string | null },
): ProjectedToolCall {
  if (!(TOOL_NAMES as readonly string[]).includes(name) || !flat || typeof flat !== 'object' || Array.isArray(flat)) {
    throw new ToolArgumentError();
  }
  const toolName = name as ToolName;
  const schema = toolSchemas[toolName];
  const permitted = new Set(Object.keys(schema.shape));
  const args: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (!FLAT_KEYS.has(key) || (!permitted.has(key) && value !== null)) throw new ToolArgumentError();
    if (permitted.has(key) && value !== null) args[key] = value;
  }
  let periodDefaulted = false;
  let entityDefaulted = false;
  if (permitted.has('period') && args.period === undefined) {
    args.period = defaults.period;
    periodDefaulted = true;
  }
  if (DEFAULT_ENTITY_TOOLS.has(toolName) && args.entity_ref === undefined) {
    if (!defaults.accountEntityRef) throw new ToolEntityNotFoundError();
    args.entity_ref = defaults.accountEntityRef;
    entityDefaulted = true;
  }
  if (toolName === 'breakdown' && args.level === 'account') {
    if (args.entity_ref !== undefined) throw new ToolArgumentError();
    args.entity_ref = null;
  }
  if (toolName === 'breakdown' && args.level === 'campaign' && args.entity_ref === undefined) {
    throw new ToolArgumentError();
  }
  const parsed = schema.safeParse(args);
  if (!parsed.success) throw new ToolArgumentError();
  return { name: toolName, args: parsed.data, periodDefaulted, entityDefaulted };
}
