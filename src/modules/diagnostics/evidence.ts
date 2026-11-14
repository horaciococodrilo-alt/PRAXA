import { compareValues, parseSqlDecimal } from '@/modules/chat/decimal';

import {
  BREAKDOWN_DIMENSIONS,
  ENTITY_LEVELS,
  METRIC_UNITS,
  type AccountMetricsRow,
  type BreakdownDimension,
  type BreakdownMetricsRow,
  type Cause,
  type DiagnosticSettings,
  type DiagnosticWindow,
  type EntityLevel,
  type EntityMetricsRow,
  type Evidence,
  type Manifest,
  type Metric,
  type SectionStatus,
} from './contract';
import { DIAGNOSTIC_LIMITS } from './limits';

/**
 * Preparación completa y determinística del diagnóstico (M26a, Diseño §2). Todo lo autoritativo
 * sale de las filas SQL: este módulo no calcula cifras, solo las ordena, las rotula como
 * evidencia, decide qué secciones son evaluables y parte el conjunto en lotes sin truncar.
 */

export class DiagnosticPreparationError extends Error {
  readonly failureClass: 'too_large' | 'invalid_window';
  constructor(failureClass: 'too_large' | 'invalid_window') {
    super(`praxa: preparación del diagnóstico fallida (${failureClass})`);
    this.name = 'DiagnosticPreparationError';
    this.failureClass = failureClass;
  }
}

const DAY_MS = 86_400_000;

function shiftDate(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Ventana de 28 días que termina en window_to (del resumen de la sincronización) y la previa. */
export function windowsFor(windowTo: string): DiagnosticWindow {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(windowTo)
    && new Date(`${windowTo}T00:00:00Z`).toISOString().slice(0, 10) === windowTo;
  if (!valid) throw new DiagnosticPreparationError('invalid_window');
  const days = DIAGNOSTIC_LIMITS.windowDays;
  return Object.freeze({
    from: shiftDate(windowTo, -(days - 1)), to: windowTo,
    prev_from: shiftDate(windowTo, -(2 * days - 1)), prev_to: shiftDate(windowTo, -days),
  });
}

/** Estimación conservadora para español y números: ceil(caracteres del JSON / 3). */
export function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 3);
}

function below(value: string | null, threshold: number): boolean {
  if (value === null) return true;
  const parsed = parseSqlDecimal(value);
  if (!parsed) return true;
  return compareValues(parsed, { coefficient: BigInt(threshold), scale: 0 }) < 0;
}

export function isLowSample(sample: { impressions: string | null; clicks: string | null;
  results: string | null; resultUnavailable?: boolean }): boolean {
  const limits = DIAGNOSTIC_LIMITS.lowSample;
  return below(sample.impressions, limits.impressions) || below(sample.clicks, limits.clicks)
    || (!sample.resultUnavailable && below(sample.results, limits.results));
}

export type PrepareInput = Readonly<{
  settings: DiagnosticSettings;
  window: DiagnosticWindow;
  account: Readonly<{ current: AccountMetricsRow; previous: AccountMetricsRow | null }>;
  entities: Readonly<Record<EntityLevel, readonly EntityMetricsRow[]>>;
  breakdowns: Readonly<Record<BreakdownDimension, readonly BreakdownMetricsRow[]>>;
  levelStatus: Readonly<Record<'account' | EntityLevel, string>>;
  pagesRead: number;
  budgetTokens?: number;
}>;

export type MetricRef = Readonly<{ id: string; value: string | null }>;
export type MetricMap = Partial<Record<Metric, MetricRef>>;

export type PackageEntity = Readonly<{
  alias: string;
  level: EntityLevel;
  /** Texto capturado de Meta, no confiable: nunca es una instrucción. */
  name: string;
  status: string | null;
  objective: string | null;
  parent_alias: string | null;
  low_sample: boolean;
  metrics: MetricMap;
}>;

export type PackageBreakdown = Readonly<{
  status: SectionStatus;
  result_unavailable: boolean;
  segments: ReadonlyArray<Readonly<{ label: string; low_sample: boolean; metrics: MetricMap }>>;
}>;

export type DiagnosticPackage = Readonly<{
  goal: DiagnosticSettings;
  window: DiagnosticWindow;
  comparison: boolean;
  currency: string | null;
  totals: Readonly<{ current: MetricMap; previous: MetricMap | null }>;
  level_coverage: Readonly<Record<'account' | EntityLevel, string>>;
  entities: readonly PackageEntity[];
  candidates: Readonly<Record<EntityLevel, Readonly<Record<string, readonly string[]>>>>;
  breakdowns: Readonly<Record<BreakdownDimension, PackageBreakdown>>;
}>;

export type SectionPlan = Readonly<{
  comparison: SectionStatus;
  breakdowns: Readonly<Record<BreakdownDimension, SectionStatus>>;
}>;

export type PreparedDiagnostic =
  | Readonly<{ status: 'insufficient'; cause: 'no_activity' | 'no_coverage' }>
  | Readonly<{
    status: 'ready';
    package: DiagnosticPackage;
    evidence: readonly Evidence[];
    sectionPlan: SectionPlan;
    limits: readonly Cause[];
    manifest: Manifest;
    batches: readonly (readonly string[])[];
  }>;

const RAW_METRICS = new Set<Metric>(['spend', 'impressions', 'clicks', 'link_clicks', 'result_count', 'result_value']);

function compatibleAttribution(a: string, b: string): boolean {
  if (a === 'mixed' || b === 'mixed') return false;
  return !(a.startsWith('attr_') && b.startsWith('attr_') && a !== b);
}

export function prepareDiagnostic(input: PrepareInput): PreparedDiagnostic {
  const { current, previous } = input.account;
  if (current.activity_status === 'zero') return { status: 'insufficient', cause: 'no_activity' };
  if (current.activity_status === 'no_coverage') return { status: 'insufficient', cause: 'no_coverage' };

  const traffic = input.settings.metric_ref === 'inline_link_clicks';
  const w = input.window;
  const curPeriod = { from: w.from, to: w.to };
  const prevPeriod = { from: w.prev_from, to: w.prev_to };
  const comparison = previous !== null && previous.days_not_observed === 0
    && compatibleAttribution(current.attribution, previous.attribution);
  const evidence: Evidence[] = [];

  const accountMetrics: Metric[] = ['spend', 'impressions', 'clicks', 'link_clicks', 'result_count',
    ...(traffic ? [] : ['result_value'] as Metric[]), 'ctr', 'cpc', 'cpm', 'cost_per_result',
    ...(traffic ? [] : ['attributed_return'] as Metric[])];

  const push = (item: Omit<Evidence, 'kind' | 'unit'>): MetricRef => {
    evidence.push({ ...item, kind: RAW_METRICS.has(item.metric) ? 'system_fact' : 'calculated_metric',
      unit: METRIC_UNITS[item.metric] });
    return { id: item.id, value: item.value };
  };

  const accountTotals = (row: AccountMetricsRow, tag: 'cur' | 'prev'): MetricMap => {
    const period = tag === 'cur' ? curPeriod : prevPeriod;
    const map: MetricMap = {};
    for (const metric of accountMetrics) {
      map[metric] = push({
        id: `ev_acct_${tag}_${metric}`, level: 'account', entity_alias: null, segment: null, period,
        metric, value: row[metric as keyof AccountMetricsRow] as string | null,
        currency: row.currency,
        attribution: metric === 'result_count' || metric === 'result_value' || metric === 'cost_per_result'
          || metric === 'attributed_return' ? row.attribution : 'unknown',
        coverage: { days_with_data: row.days_with_data, days_no_row: row.days_no_row,
          days_not_observed: row.days_not_observed, days_open: row.days_open, days_partial: row.days_partial },
        sample: 'ok',
        provenance: { fn: 'meta_diagnostic_account_metrics', window: period,
          fetched_at_min: row.fetched_at_min, fetched_at_max: row.fetched_at_max },
      });
    }
    return map;
  };

  const totals = { current: accountTotals(current, 'cur'),
    previous: comparison && previous ? accountTotals(previous, 'prev') : null };

  // Entidades: orden determinístico por nivel y por el orden SQL (gasto desc, ref).
  const entities: PackageEntity[] = [];
  const aliasOf = new Map<string, string>();
  const candidates = {} as Record<EntityLevel, Record<string, string[]>>;
  const examined = { campaign: 0, adset: 0, ad: 0 };
  const entityMetrics: Metric[] = ['spend', 'impressions', 'clicks', 'result_count',
    ...(traffic ? [] : ['result_value'] as Metric[]), 'ctr', 'cpc', 'cpm', 'cost_per_result',
    ...(traffic ? [] : ['attributed_return'] as Metric[])];
  const variations: Metric[] = ['var_spend', 'var_ctr', 'var_cost_per_result',
    ...(traffic ? [] : ['var_attributed_return'] as Metric[])];

  for (const level of ENTITY_LEVELS) {
    // La función SQL ya devolvió solo entidades con actividad en cualquier acción o métrica.
    // Filtrar de nuevo por el objetivo elegido descartaría actividad de otras acciones.
    examined[level] = input.entities[level].length;
    for (const row of input.entities[level]) {
      const alias = `e${entities.length + 1}`;
      aliasOf.set(row.entity_ref, alias);
      const lowSample = isLowSample({ impressions: row.cur_impressions, clicks: row.cur_clicks,
        results: row.cur_result_count });
      const base = {
        level, entity_alias: alias, segment: null, currency: row.currency,
        coverage: { days_with_row: row.days_with_row, days_open: row.days_open },
        sample: lowSample ? 'low_sample' as const : 'ok' as const,
      };
      const attr = (metric: Metric) => metric.includes('result') || metric.includes('return')
        ? row.attribution : 'unknown';
      const metrics: MetricMap = {};
      for (const metric of entityMetrics) {
        metrics[metric] = push({ ...base, id: `ev_${alias}_${metric}`, period: curPeriod, metric,
          value: row[`cur_${metric}` as keyof EntityMetricsRow] as string | null, attribution: attr(metric),
          provenance: { fn: 'meta_diagnostic_entity_metrics', window: curPeriod,
            fetched_at_min: current.fetched_at_min, fetched_at_max: current.fetched_at_max } });
      }
      if (comparison) {
        for (const metric of entityMetrics) {
          push({ ...base, id: `ev_${alias}_prev_${metric}`, period: prevPeriod, metric,
            value: row[`prev_${metric}` as keyof EntityMetricsRow] as string | null, attribution: attr(metric),
            provenance: { fn: 'meta_diagnostic_entity_metrics', window: prevPeriod,
              fetched_at_min: previous?.fetched_at_min ?? null, fetched_at_max: previous?.fetched_at_max ?? null } });
        }
        for (const metric of variations) {
          metrics[metric] = push({ ...base, id: `ev_${alias}_${metric}`, period: curPeriod, metric,
            value: row[metric as keyof EntityMetricsRow] as string | null, attribution: attr(metric),
            provenance: { fn: 'meta_diagnostic_entity_metrics', window: curPeriod,
              fetched_at_min: current.fetched_at_min, fetched_at_max: current.fetched_at_max } });
        }
      }
      entities.push({
        alias, level, name: (row.name ?? '').slice(0, DIAGNOSTIC_LIMITS.entityNameMax),
        status: row.effective_status, objective: row.objective,
        parent_alias: row.parent_ref ? aliasOf.get(row.parent_ref) ?? null : null,
        low_sample: lowSample, metrics,
      });
    }
    candidates[level] = levelCandidates(entities.filter((e) => e.level === level), comparison);
  }

  // Desgloses de cuenta: estimaciones de Meta, atribución siempre desconocida.
  const breakdowns = {} as Record<BreakdownDimension, PackageBreakdown>;
  const breakdownPlan = {} as Record<BreakdownDimension, SectionStatus>;
  const segmentsOmitted = { age_gender: 0, country: 0, region: 0 };
  for (const dimension of BREAKDOWN_DIMENSIONS) {
    const rows = input.breakdowns[dimension];
    const resultUnavailable = dimension === 'region';
    segmentsOmitted[dimension] = Math.max(0, Math.max(0, ...rows.map((r) => r.segments_total)) - rows.length);
    const lows = rows.map((row) => isLowSample({ impressions: row.impressions, clicks: row.clicks,
      results: row.result_count, resultUnavailable }));
    let status: SectionStatus;
    if (rows.length === 0 || rows.some((row) => row.last_attempt_status !== 'complete')) {
      status = { status: 'not_evaluable', cause: 'breakdown_unavailable' };
    } else if (lows.every(Boolean)) {
      status = { status: 'not_evaluable', cause: 'low_sample' };
    } else status = { status: 'evaluable' };
    breakdownPlan[dimension] = status;
    const segments = status.status === 'evaluable' ? rows.map((row, index) => {
      const metrics: MetricMap = {};
      const list: Metric[] = ['spend', 'impressions', 'clicks', 'ctr', 'cpc',
        ...(resultUnavailable ? [] : ['result_count', 'cost_per_result'] as Metric[])];
      for (const metric of list) {
        metrics[metric] = push({
          id: `ev_bd_${dimension}_${index + 1}_${metric}`, level: 'account', entity_alias: null,
          segment: { dimension, label: row.segment_label }, period: curPeriod, metric,
          value: row[metric as keyof BreakdownMetricsRow] as string | null,
          currency: row.currency, attribution: 'unknown', coverage: {},
          sample: lows[index] ? 'low_sample' : 'ok',
          provenance: { fn: 'meta_diagnostic_breakdown_metrics', window: curPeriod,
            fetched_at_min: current.fetched_at_min, fetched_at_max: current.fetched_at_max },
        });
      }
      return { label: row.segment_label, low_sample: lows[index], metrics };
    }) : [];
    breakdowns[dimension] = { status, result_unavailable: resultUnavailable, segments };
  }

  const limits: Cause[] = [];
  const levelsIncomplete = Object.values(input.levelStatus).some((s) => s !== 'complete');
  if (current.days_not_observed > 0 || current.days_open > 0 || current.days_partial > 0 || levelsIncomplete) {
    limits.push('partial_coverage');
  }
  if (!traffic && current.result_count === null) limits.push('no_goal_action');
  if (!comparison) limits.push('no_comparison');

  const pkg: DiagnosticPackage = {
    goal: input.settings, window: w, comparison, currency: current.currency, totals,
    level_coverage: input.levelStatus, entities, candidates, breakdowns,
  };
  const batches = splitBatches(pkg, input.budgetTokens ?? DIAGNOSTIC_LIMITS.tokenBudget);
  const manifest: Manifest = {
    entities_examined: examined, batches: batches.length, pages_read: input.pagesRead,
    segments_omitted: segmentsOmitted, open_days: [...current.open_dates],
    partial_capture_days: [...current.partial_dates],
  };
  return {
    status: 'ready', package: pkg, evidence,
    sectionPlan: { comparison: comparison ? { status: 'evaluable' } : { status: 'not_evaluable', cause: 'no_comparison' },
      breakdowns: breakdownPlan },
    limits, manifest, batches,
  };
}

function decimalOrder(a: string | null | undefined, b: string | null | undefined): number {
  const pa = a ? parseSqlDecimal(a) : null;
  const pb = b ? parseSqlDecimal(b) : null;
  if (!pa || !pb) return 0;
  return compareValues(pa, pb);
}

function absText(value: string | null | undefined): string | null {
  return value ? value.replace(/^-/, '') : null;
}

function levelCandidates(list: readonly PackageEntity[], comparison: boolean): Record<string, string[]> {
  const top = DIAGNOSTIC_LIMITS.candidatesPerLevel;
  const withCpr = list.filter((e) => !e.low_sample && e.metrics.cost_per_result?.value);
  const byCpr = [...withCpr].sort((a, b) => decimalOrder(a.metrics.cost_per_result?.value,
    b.metrics.cost_per_result?.value) || (a.alias < b.alias ? -1 : 1));
  const out: Record<string, string[]> = {
    top_spend: list.slice(0, top).map((e) => e.alias),
    best_cost_per_result: byCpr.slice(0, top).map((e) => e.alias),
    worst_cost_per_result: [...byCpr].reverse().slice(0, top).map((e) => e.alias),
  };
  if (comparison) {
    out.largest_spend_change = list.filter((e) => e.metrics.var_spend?.value)
      .sort((a, b) => -decimalOrder(absText(a.metrics.var_spend?.value), absText(b.metrics.var_spend?.value))
        || (a.alias < b.alias ? -1 : 1))
      .slice(0, top).map((e) => e.alias);
  }
  return out;
}

/** Lotes en serie por orden determinístico; si no alcanzan, too_large (nunca se trunca). */
function splitBatches(pkg: DiagnosticPackage, budget: number): string[][] {
  if (estimateTokens(pkg) <= budget) return [pkg.entities.map((e) => e.alias)];
  const base = estimateTokens({ ...pkg, entities: [] });
  const batches: string[][] = [];
  let current: string[] = [];
  let used = base;
  for (const entity of pkg.entities) {
    const cost = estimateTokens(entity) + 1;
    if (base + cost > budget) throw new DiagnosticPreparationError('too_large');
    if (used + cost > budget && current.length > 0) {
      batches.push(current);
      current = [];
      used = base;
    }
    current.push(entity.alias);
    used += cost;
  }
  if (current.length > 0) batches.push(current);
  if (batches.length > DIAGNOSTIC_LIMITS.maxBatches) throw new DiagnosticPreparationError('too_large');
  return batches;
}
