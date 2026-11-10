import { parseToolResult, type ToolResult } from '@/modules/chat/tools/results';
import type { ProjectedToolCall } from '@/modules/chat/tools/schema';

const account = 'b0000000-0000-4000-8000-000000000151';
const campaignA = 'b0000000-0000-4000-8000-000000000152';
const campaignB = 'b0000000-0000-4000-8000-000000000153';
const adsetA = 'b0000000-0000-4000-8000-000000000154';
type Period = { from: string; to: string };
const days = (period: Period) => Math.round((Date.parse(period.to) -
  Date.parse(period.from)) / 86_400_000) + 1;
const composition = (period: Period) => ({ days_total: days(period),
  days_with_value: days(period), days_metric_missing: 0, days_no_row: 0,
  days_not_observed: 0, days_open: 0, days_captured_partial: 0,
  fetched_at_min: '2026-01-15T00:00:00Z', fetched_at_max: '2026-01-15T00:00:00Z',
  observed_from: period.from, observed_to: period.to, partial: false });
const name = (ref: unknown) => ref === campaignA ? 'Campaña sintética A' :
  ref === campaignB ? 'Campaña sintética B' : ref === adsetA ?
    'Conjunto sintético A' : 'Cuenta sintética';
const unitFor = (metric: string) => ['spend', 'cpc', 'cpm', 'action_value',
  'cost_per_result'].includes(metric) ? 'money' : ['ctr', 'share'].includes(metric) ?
    'percent' : metric === 'frequency' ? 'ratio' : 'count';

/** Herramientas inyectadas: ningún resultado procede de una cuenta ni de una base. */
export function expandedSyntheticResult(call: ProjectedToolCall, id: string,
  caseId: string): ToolResult {
  const args = call.args;
  const period = (args.period ?? null) as Period | null;
  const periodA = (args.period_a ?? null) as Period | null;
  const periodB = (args.period_b ?? null) as Period | null;
  const metric = String(args.metric ?? (call.name === 'cost_per_result' ?
    'cost_per_result' : 'spend'));
  const entityRef = String(args.entity_ref ?? account);
  const level = String(args.level ?? (entityRef === account ? 'account' :
    entityRef === adsetA ? 'adset' : 'campaign'));
  const scope: { level: string | null; entity_ref: unknown; entity_name: string | null;
    period: Period | null; period_a: Period | null; period_b: Period | null;
    period_defaulted: boolean; entity_defaulted: boolean;
    timezone: string; currency: string } = {
    level, entity_ref: args.entity_ref ?? account,
    entity_name: name(args.entity_ref ?? account), period,
    period_a: periodA, period_b: periodB,
    period_defaulted: call.periodDefaulted, entity_defaulted: call.entityDefaulted,
    timezone: 'UTC', currency: 'USD' };
  const make = (path_key: string, value: string, options: {
    metric?: string; unit?: string; period?: Period | null;
    period_a?: Period | null; period_b?: Period | null; day?: string | null;
    entity_ref?: string | null; parent_ref?: string | null;
    segment_primary?: string | null; segment_secondary?: string | null;
    action_type?: string | null; attribution_ref?: string | null;
  } = {}) => {
    const rowMetric = options.metric ?? metric;
    const rowPeriod = options.period === undefined ? period : options.period;
    const rowDay = options.day ?? null;
    const rowEntity = options.entity_ref === undefined ? entityRef : options.entity_ref;
    const rowUnit = options.unit ?? unitFor(rowMetric);
    return { path_key, metric: rowMetric, unit: rowUnit,
      currency: rowUnit === 'money' ? 'USD' : null,
      action_type: options.action_type === undefined ?
        ['action_count', 'action_value', 'cost_per_result'].includes(rowMetric) ?
          String(args.action_type ?? 'purchase') : null : options.action_type,
      attribution_ref: options.attribution_ref === undefined ?
        rowMetric.startsWith('action_') || rowMetric === 'cost_per_result' ?
          caseId === 'E26' ? 'unknown' : 'attr_synthetic_a' : null :
        options.attribution_ref,
      period: rowPeriod, period_a: options.period_a ?? null,
      period_b: options.period_b ?? null, day: rowDay,
      entity_ref: rowEntity, entity_name: rowEntity ? name(rowEntity) : null,
      parent_ref: options.parent_ref ?? null,
      segment_primary: options.segment_primary ?? null,
      segment_secondary: options.segment_secondary ?? null,
      value, absence: null, presence: rowDay ? 'con_datos' : null,
      temporal_status: null, captured_partial: false, fetched_at: null,
      composition: !rowDay && rowPeriod ? composition(rowPeriod) : null };
  };
  const raw: { status: string; reason: string | null; scope: typeof scope;
    values: ReturnType<typeof make>[]; composition: unknown;
    extra: Record<string, unknown> } = { status: 'ok', reason: null, scope,
    values: [], composition: period ? composition(period) : null, extra: {} };
  if (period?.from.startsWith('2024') &&
      !['entities', 'connection_status'].includes(call.name)) {
    raw.composition = { ...composition(period), days_with_value: 0,
      days_not_observed: days(period), observed_from: null,
      observed_to: null, fetched_at_min: null, fetched_at_max: null,
      partial: true };
    raw.extra = { history_from: '2026-01-01', history_to: '2026-01-14' };
    return parseToolResult(raw, id, '…0151', call.name);
  }
  if (call.name === 'entities') {
    const entities = args.level === 'campaign' ? [
      { entity_ref: campaignA, level: 'campaign', name: name(campaignA), parent_ref: account },
      { entity_ref: campaignB, level: 'campaign', name: name(campaignB), parent_ref: account },
    ] : args.level === 'adset' ? [
      { entity_ref: adsetA, level: 'adset', name: name(adsetA), parent_ref: campaignA },
    ] : [{ entity_ref: account, level: 'account', name: name(account), parent_ref: null }];
    raw.scope = { ...scope, level: String(args.level), entity_ref: null,
      entity_name: null, period: null };
    raw.composition = null;
    raw.values = [make('list_count', String(entities.length), {
      metric: 'list_count', unit: 'count', period: null, entity_ref: null })];
    raw.extra = { entities, total: entities.length, truncated: false };
  } else if (call.name === 'connection_status') {
    raw.scope = { ...scope, period: null };
    raw.composition = null;
    raw.extra = { connection_status: 'active', effective_sync_status: 'ok',
      last_finished_at: '2026-01-15T00:00:00Z' };
  } else if (call.name === 'coverage') {
    raw.extra = { history_from: '2026-01-01', history_to: '2026-01-14',
      nearest_before: null, nearest_after: null };
  } else if (caseId === 'E27' && call.name === 'total' && metric === 'action_count') {
    raw.status = 'not_calculable'; raw.reason = 'attribution_incompatible';
  } else if (call.name === 'total') {
    raw.values = [make('total', metric === 'impressions' ? '120' :
      metric === 'clicks' ? '24' : metric === 'action_count' ? '4' : '12.50')];
  } else if (call.name === 'daily_series' && period) {
    raw.values = Array.from({ length: days(period) }, (_, index) => make('day',
      metric === 'spend' ? '1.00' : metric === 'impressions' ? '10' : '2',
      { day: new Date(Date.parse(period.from) + index * 86_400_000)
        .toISOString().slice(0, 10) }));
  } else if (call.name === 'daily_average') {
    raw.values = [make('daily_average', metric === 'clicks' ? '3.428571' : '1.785714')];
  } else if (call.name === 'cost_per_result') {
    raw.values = [make('cost_per_result', '12.50', { metric: 'cost_per_result' })];
  } else if (call.name === 'share') {
    raw.values = [make('share', '40.000000', { metric: 'share', unit: 'percent' })];
    raw.extra = { base_metric: metric, attribution_mixed: false };
  } else if (call.name === 'compare_periods' && periodA && periodB) {
    raw.values = [make('a', metric === 'impressions' ? '100' : '10.00',
      { period: periodA }), make('b', metric === 'impressions' ? '120' : '12.00',
      { period: periodB }), make('difference', metric === 'impressions' ? '20' : '2.00',
      { period: null, period_a: periodA, period_b: periodB })];
    raw.extra = { relation: 'b_greater', period_lengths_differ: false,
      composition_a: composition(periodA), composition_b: composition(periodB) };
  } else if (call.name === 'percent_change' && periodA && periodB) {
    raw.values = [make('change', '20.000000', { unit: 'percent', period: null,
      period_a: periodA, period_b: periodB })];
    raw.extra = { period_lengths_differ: false,
      composition_a: composition(periodA), composition_b: composition(periodB) };
  } else if (call.name === 'ranking') {
    const refs = args.level === 'adset' ? [adsetA] : [campaignA, campaignB];
    raw.scope = { ...scope, entity_ref: null, entity_name: null };
    raw.values = refs.map((ref, index) => make('entity', index === 0 ? '16' : '8',
      { entity_ref: ref, parent_ref: args.level === 'adset' ? campaignA : account,
        attribution_ref: metric === 'action_count' ?
          index === 0 ? 'attr_synthetic_a' : 'attr_synthetic_b' : null }));
    raw.values.push(make('list_count', String(refs.length), { metric: 'list_count',
      unit: 'count', entity_ref: null }));
    raw.values.push(make('excluded_count', '0', { metric: 'excluded_count',
      unit: 'count', entity_ref: null }));
    raw.extra = { attribution_mixed: metric === 'action_count',
      trends: Object.fromEntries(refs.map((ref) => [ref, [
        { day: period?.from ?? '2026-01-01', value: '2', absence: null },
        { day: period?.to ?? '2026-01-07', value: '4', absence: null },
      ]])) };
  } else if (call.name === 'breakdown') {
    const dimension = String(args.dimension);
    const segments = dimension === 'age_gender' ? [
      ['25-34', 'female'], ['35-44', 'male'],
    ] : dimension === 'region' ? [['Región sintética A', null],
      ['Región sintética B', null]] : [['País sintético A', null],
      [caseId === 'E25' ? 'Desconocido' : 'País sintético B', null]];
    raw.values = segments.flatMap(([primary, secondary], index) => [
      make('segment', index === 0 ? '8.00' : '4.50', {
        entity_ref: null, segment_primary: primary, segment_secondary: secondary }),
      make('segment_share', index === 0 ? '64.000000' : '36.000000', {
        metric: 'share', unit: 'percent', entity_ref: null,
        segment_primary: primary, segment_secondary: secondary }),
    ]);
    raw.values.push(make('list_count', String(segments.length), {
      metric: 'list_count', unit: 'count', entity_ref: null }));
    raw.extra = { dimension, estimated: true, segments_total: segments.length,
      nearest_before: null, nearest_after: null,
      last_result: { result: 'completed', reason: null,
        attempted_at: '2026-01-15T00:00:00Z' } };
  } else if (call.name === 'action_types') {
    raw.values = [make('action_count', '4', { metric: 'action_count',
      action_type: 'purchase', attribution_ref: 'unknown' }),
      make('action_value', '40.00', { metric: 'action_value',
        action_type: 'purchase', attribution_ref: 'unknown' })];
  } else {
    raw.status = 'not_supported'; raw.reason = 'metric_not_additive';
  }
  return parseToolResult(raw, id, '…0151', call.name);
}
