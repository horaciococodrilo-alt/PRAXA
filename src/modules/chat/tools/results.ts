import { z } from 'zod';

import { chatLevelSchema, chatMetricSchema, chatPeriodSchema } from './schema';
import type { ToolName } from './schema';

const signedDecimalText = z.string().regex(/^-?[0-9]+([.][0-9]+)?$/);
const nullableDate = z.iso.date().nullable();
const nullableInstant = z.iso.datetime({ offset: true }).nullable();

const compositionSchema = z.strictObject({
  days_total: z.number().int().min(0),
  days_with_value: z.number().int().min(0),
  days_metric_missing: z.number().int().min(0),
  days_no_row: z.number().int().min(0),
  days_not_observed: z.number().int().min(0),
  days_open: z.number().int().min(0),
  days_captured_partial: z.number().int().min(0),
  fetched_at_min: nullableInstant,
  fetched_at_max: nullableInstant,
  observed_from: nullableDate,
  observed_to: nullableDate,
  partial: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.days_with_value + value.days_metric_missing + value.days_no_row +
      value.days_not_observed !== value.days_total) {
    ctx.addIssue({ code: 'custom', message: 'Composición inconsistente.' });
  }
});

const valueSchema = z.strictObject({
  path_key: z.enum(['day', 'total', 'daily_average', 'cost_per_result', 'share', 'a', 'b',
    'difference', 'change', 'entity', 'segment', 'segment_share', 'action_count',
    'action_value', 'list_count', 'excluded_count']),
  metric: z.union([chatMetricSchema, z.enum(['cost_per_result', 'share', 'list_count', 'excluded_count'])]),
  unit: z.enum(['money', 'count', 'percent', 'ratio']),
  currency: z.string().nullable(),
  action_type: z.string().nullable(),
  attribution_ref: z.string().nullable(),
  period: chatPeriodSchema.nullable(),
  period_a: chatPeriodSchema.nullable(),
  period_b: chatPeriodSchema.nullable(),
  day: nullableDate,
  entity_ref: z.uuid().nullable(),
  entity_name: z.string().nullable(),
  parent_ref: z.uuid().nullable(),
  segment_primary: z.string().nullable(),
  segment_secondary: z.string().nullable(),
  value: signedDecimalText.nullable(),
  absence: z.enum(['no_informado', 'sin_fila_reportada', 'no_observado', 'no_calculable']).nullable(),
  presence: z.enum(['con_datos', 'sin_fila_reportada', 'no_observado']).nullable(),
  temporal_status: z.enum(['abierto', 'cerrado']).nullable(),
  captured_partial: z.boolean(),
  fetched_at: nullableInstant,
  composition: compositionSchema.nullable(),
}).superRefine((value, ctx) => {
  const hasA = value.period_a !== null;
  const hasB = value.period_b !== null;
  if ((value.value === null) === (value.absence === null) ||
      (value.day !== null) !== (value.presence !== null) ||
      hasA !== hasB || (value.period !== null && hasA) ||
      (value.day !== null && (value.period === null || value.composition !== null)) ||
      (value.unit !== 'money' && value.currency !== null) ||
      (value.metric === 'action_count' || value.metric === 'action_value' ||
        value.metric === 'cost_per_result' ? value.action_type === null :
        value.metric !== 'share' && value.action_type !== null) ||
      (value.day === null && value.composition !== null &&
        value.captured_partial !== (value.composition.days_captured_partial > 0))) {
    ctx.addIssue({ code: 'custom', message: 'Valor incoherente.' });
  }
});

const scopeSchema = z.strictObject({
  level: chatLevelSchema.nullable(),
  entity_ref: z.uuid().nullable(),
  entity_name: z.string().nullable(),
  period: chatPeriodSchema.nullable(),
  period_a: chatPeriodSchema.nullable(),
  period_b: chatPeriodSchema.nullable(),
  period_defaulted: z.boolean(),
  entity_defaulted: z.boolean(),
  timezone: z.string().nullable(),
  currency: z.string().nullable(),
}).superRefine((scope, ctx) => {
  const hasA = scope.period_a !== null;
  if (hasA !== (scope.period_b !== null) || (scope.period !== null && hasA)) {
    ctx.addIssue({ code: 'custom', message: 'Períodos incoherentes.' });
  }
});

const resultSchema = z.strictObject({
  status: z.enum(['ok', 'not_calculable', 'not_supported', 'not_found']),
  reason: z.enum(['denominator_zero', 'data_absent', 'attribution_incompatible',
    'metric_not_additive', 'currency_mixed', 'invalid_scope', 'entity_not_found']).nullable(),
  scope: scopeSchema,
  values: z.array(valueSchema),
  composition: compositionSchema.nullable(),
  extra: z.record(z.string(), z.unknown()),
}).superRefine((result, ctx) => {
  if ((result.status === 'ok') !== (result.reason === null) ||
      (result.status !== 'ok' && result.values.length !== 0)) {
    ctx.addIssue({ code: 'custom', message: 'Estado y valores incoherentes.' });
  }
});

export class ToolResultError extends Error {
  constructor() { super('Resultado de herramienta inválido.'); }
}

export type ToolResult = Omit<z.infer<typeof resultSchema>, 'values'> & {
  tool_call_id: string;
  tool_name: ToolName | null;
  account_ref: string | null;
  values: (z.infer<typeof valueSchema> & { path: string; tool_call_id: string; account_ref: string | null })[];
};

export function parseToolResult(raw: unknown, toolCallId: string, accountRef: string | null,
  toolName: ToolName | null = null): ToolResult {
  const parsed = resultSchema.safeParse(raw);
  if (!parsed.success || !/^t[1-6]$/.test(toolCallId)) throw new ToolResultError();
  return {
    ...parsed.data, tool_call_id: toolCallId, tool_name: toolName, account_ref: accountRef,
    values: parsed.data.values.map((value, index) => ({ ...value, path: `/values/${index}`,
      tool_call_id: toolCallId, account_ref: accountRef })),
  };
}

function modelComposition(composition: z.infer<typeof compositionSchema> | null) {
  if (composition === null) return null;
  const visible: Record<string, unknown> = { ...composition };
  for (const key of ['fetched_at_min', 'fetched_at_max', 'observed_from', 'observed_to']) {
    delete visible[key];
  }
  return visible;
}

/** Solo la prueba de la guarda ve la evidencia completa. El modelo recibe esta vista. */
type MarkerKind = 'ENTIDAD' | 'SEGMENTO' | 'ACCION' | 'DIA' | 'FECHA';
export type ModelMarkers = Map<string, { kind: MarkerKind; text: string }>;

function markerFor(markers: ModelMarkers, kind: MarkerKind, text: string | null): string | null {
  if (!text) return null;
  for (const [marker, item] of markers) {
    if (item.kind === kind && item.text === text) return marker;
  }
  const count = [...markers.values()].filter((item) => item.kind === kind).length;
  let n = count;
  let letters = '';
  do { letters = String.fromCharCode(65 + n % 26) + letters; n = Math.floor(n / 26) - 1; } while (n >= 0);
  const marker = `⟦${kind}_${letters}⟧`;
  markers.set(marker, { kind, text });
  return marker;
}

export function modelMarkers(results: ToolResult[]): ModelMarkers {
  const markers: ModelMarkers = new Map();
  const displayDate = (date: string) => {
    const [year, month, day] = date.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  };
  for (const result of results) {
    markerFor(markers, 'ENTIDAD', result.scope.entity_name);
    for (const value of result.values) {
      markerFor(markers, 'ENTIDAD', value.entity_name);
      markerFor(markers, 'SEGMENTO', value.segment_primary);
      markerFor(markers, 'SEGMENTO', value.segment_secondary);
      markerFor(markers, 'ACCION', value.action_type);
      markerFor(markers, 'DIA', value.day ? displayDate(value.day) : null);
    }
    const entities = result.extra.entities;
    if (Array.isArray(entities)) for (const entry of entities) {
      if (entry && typeof entry === 'object' &&
          (('entity_name' in entry && typeof entry.entity_name === 'string') ||
            ('name' in entry && typeof entry.name === 'string'))) {
        markerFor(markers, 'ENTIDAD',
          'entity_name' in entry && typeof entry.entity_name === 'string' ?
            entry.entity_name : (entry as { name: string }).name);
      }
    }
    for (const key of ['history_from', 'history_to', 'last_finished_at']) {
      const date = result.extra[key];
      if (typeof date === 'string') markerFor(markers, 'FECHA', displayDate(date));
    }
  }
  return markers;
}

export function toModelView(result: ToolResult, markers: ModelMarkers = modelMarkers([result])) {
  const extra = { ...result.extra };
  for (const key of ['trends', 'last_result', 'nearest_before', 'nearest_after']) delete extra[key];
  const aliasFor = (entityName: string | null) => markerFor(markers, 'ENTIDAD', entityName);
  const displayDate = (date: string) => {
    const [year, month, day] = date.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  };
  const visibleExtra = { ...extra };
  for (const key of ['history_from', 'history_to', 'last_finished_at']) {
    const date = visibleExtra[key];
    if (typeof date === 'string') {
      visibleExtra[`${key}_alias`] = markerFor(markers, 'FECHA', displayDate(date));
    }
  }
  for (const key of ['composition_a', 'composition_b']) {
    if (!(key in visibleExtra)) continue;
    const parsed = compositionSchema.nullable().safeParse(visibleExtra[key]);
    if (parsed.success) visibleExtra[key] = modelComposition(parsed.data);
    else delete visibleExtra[key];
  }
  if (Array.isArray(visibleExtra.entities)) {
    visibleExtra.entities = visibleExtra.entities.map((entry: unknown) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
      const entity = entry as Record<string, unknown>;
      return { ...entity, entity_alias: aliasFor(
        typeof entity.entity_name === 'string' ? entity.entity_name :
          typeof entity.name === 'string' ? entity.name : null) };
    });
  }
  return {
    status: result.status, reason: result.reason, tool_call_id: result.tool_call_id,
    account_ref: result.account_ref, scope: { ...result.scope,
      entity_alias: aliasFor(result.scope.entity_name) },
    values: result.values.map((value) => {
      const visible: Record<string, unknown> = { ...value };
      for (const key of ['fetched_at', 'presence', 'temporal_status', 'captured_partial']) {
        delete visible[key];
      }
      visible.composition = value.composition === null ? null : { partial: value.composition.partial };
      visible.entity_alias = aliasFor(value.entity_name);
      visible.segment_primary_alias = markerFor(markers, 'SEGMENTO', value.segment_primary);
      visible.segment_secondary_alias = markerFor(markers, 'SEGMENTO', value.segment_secondary);
      visible.action_alias = markerFor(markers, 'ACCION', value.action_type);
      visible.day_alias = markerFor(markers, 'DIA', value.day ? displayDate(value.day) : null);
      return visible;
    }),
    composition: modelComposition(result.composition), extra: visibleExtra,
  };
}
