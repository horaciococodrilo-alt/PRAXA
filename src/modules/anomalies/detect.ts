import {
  META_ANOMALY_RULES_V1,
  type DetectMetaAnomaliesInput,
  type MetaAnomaly,
  type MetaAnomalyLevel,
  type MetaAnomalyMetric,
  type MetaAnomalyObservation,
  type MetaAnomalyPeriods,
  type MetaAnomalyResult,
  type MetaAnomalySeverity,
} from './contract';
import {
  addExact,
  compareExact,
  compareRatio,
  formatRatio,
  parseExactDecimal,
  percentChange,
  ratio,
  thresholdReached,
  type ExactDecimal,
  type ExactRatio,
} from './decimal';

const DAYS_PER_PERIOD = 7;
const DAYS_REQUIRED = DAYS_PER_PERIOD * 2;
const MAX_ANOMALIES = 20;

type Scope = {
  level: MetaAnomalyLevel;
  entityRef: string;
  entityName: string | null;
  rows: MetaAnomalyObservation[];
};

type Aggregate = {
  rows: readonly MetaAnomalyObservation[];
  spend: ExactDecimal | null;
  impressions: ExactDecimal | null;
  clicks: ExactDecimal | null;
  purchases: ExactDecimal | null;
  currency: string | null;
  purchaseAttributionKey: string | null;
};

type Candidate = { anomaly: MetaAnomaly; magnitude: ExactRatio };

function addDays(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function scopeKey(row: MetaAnomalyObservation): string {
  return `${row.level}\u0000${row.entityRef}`;
}

function groupScopes(observations: readonly MetaAnomalyObservation[]): Scope[] {
  const groups = new Map<string, Scope>();
  for (const observation of observations) {
    const key = scopeKey(observation);
    const existing = groups.get(key);
    if (existing) existing.rows.push(observation);
    else groups.set(key, {
      level: observation.level,
      entityRef: observation.entityRef,
      entityName: observation.entityName,
      rows: [observation],
    });
  }
  return [...groups.values()].sort((left, right) =>
    left.level.localeCompare(right.level) || left.entityRef.localeCompare(right.entityRef));
}

function eligibleRow(row: MetaAnomalyObservation): boolean {
  return row.presence === 'con_datos' && row.temporalStatus === 'cerrado' &&
    row.capturedBeforeDayEnd === false;
}

function selectWindow(scope: Scope): { rows: MetaAnomalyObservation[]; periods: MetaAnomalyPeriods } | null {
  const latest = [...scope.rows].filter(eligibleRow).sort((a, b) => b.day.localeCompare(a.day))[0];
  if (!latest) return null;
  const byDay = new Map<string, MetaAnomalyObservation>();
  for (const item of scope.rows) {
    if (byDay.has(item.day)) return null;
    byDay.set(item.day, item);
  }
  const days = Array.from({ length: DAYS_REQUIRED }, (_, index) => addDays(latest.day, index - (DAYS_REQUIRED - 1)));
  if (days.some((day) => !day)) return null;
  const rows = days.map((day) => byDay.get(day));
  if (rows.some((item) => !item || !eligibleRow(item))) return null;
  return {
    rows: rows as MetaAnomalyObservation[],
    periods: {
      baseline: { from: days[0], to: days[DAYS_PER_PERIOD - 1] },
      current: { from: days[DAYS_PER_PERIOD], to: days[DAYS_REQUIRED - 1] },
    },
  };
}

function allDecimals(rows: readonly MetaAnomalyObservation[], key: 'spend' | 'impressions' | 'clicks' | 'purchases'):
ExactDecimal[] | null {
  if ((key === 'impressions' || key === 'clicks') &&
      rows.some((item) => item[key] === null || !/^\d+$/.test(item[key]))) return null;
  const parsed = rows.map((item) => parseExactDecimal(item[key]));
  return parsed.every((item): item is ExactDecimal => item !== null) ? parsed : null;
}

function onlyCurrency(rows: readonly MetaAnomalyObservation[]): string | null {
  const values = new Set(rows.map((item) => item.currency).filter((item): item is string => item !== null));
  return values.size === 1 ? [...values][0] : null;
}

function onlyAttribution(rows: readonly MetaAnomalyObservation[]): string | null {
  const keys = rows.map((item) => item.purchaseAttributionKey);
  if (keys.some((item) => item === null)) return null;
  const unique = new Set(keys as string[]);
  return unique.size === 1 ? [...unique][0] : null;
}

function aggregate(rows: readonly MetaAnomalyObservation[]): Aggregate {
  const sum = (key: 'spend' | 'impressions' | 'clicks' | 'purchases') => {
    const values = allDecimals(rows, key);
    return values ? addExact(values) : null;
  };
  return {
    rows,
    spend: sum('spend'),
    impressions: sum('impressions'),
    clicks: sum('clicks'),
    purchases: sum('purchases'),
    currency: onlyCurrency(rows),
    purchaseAttributionKey: onlyAttribution(rows),
  };
}

function minimumMet(value: ExactDecimal | null, minimum: string): boolean {
  const parsedMinimum = parseExactDecimal(minimum);
  return value !== null && parsedMinimum !== null && compareExact(value, parsedMinimum) >= 0;
}

function metricRatio(metric: MetaAnomalyMetric, aggregateValue: Aggregate): ExactRatio | null {
  if (metric === 'spend') return aggregateValue.spend ? ratio(aggregateValue.spend, { coefficient: BigInt(1), scale: 0 }) : null;
  if (!aggregateValue.spend && metric !== 'ctr') return null;
  if (metric === 'ctr') return aggregateValue.clicks && aggregateValue.impressions ?
    ratio(aggregateValue.clicks, aggregateValue.impressions, BigInt(100)) : null;
  if (metric === 'cpc') return aggregateValue.clicks ? ratio(aggregateValue.spend!, aggregateValue.clicks) : null;
  if (metric === 'cpm') return aggregateValue.impressions ? ratio(aggregateValue.spend!, aggregateValue.impressions, BigInt(1000)) : null;
  return aggregateValue.purchases ? ratio(aggregateValue.spend!, aggregateValue.purchases) : null;
}

function isEvaluable(metric: MetaAnomalyMetric, baseline: Aggregate, current: Aggregate): boolean {
  const both = [baseline, current];
  const sameCurrency = baseline.currency !== null && baseline.currency === current.currency;
  if (metric === 'ctr') {
    return both.every((item) => item.clicks !== null && item.impressions !== null &&
      minimumMet(item.impressions, META_ANOMALY_RULES_V1.ctr.minimumImpressions));
  }
  if (metric === 'cpc') {
    return sameCurrency && both.every((item) => item.spend !== null && item.clicks !== null &&
      minimumMet(item.clicks, META_ANOMALY_RULES_V1.cpc.minimumClicks));
  }
  if (metric === 'cpm' || metric === 'spend') {
    const rules = metric === 'cpm' ? META_ANOMALY_RULES_V1.cpm : META_ANOMALY_RULES_V1.spend;
    return sameCurrency && both.every((item) => item.spend !== null && item.impressions !== null &&
      minimumMet(item.impressions, rules.minimumImpressions));
  }
  return sameCurrency && both.every((item) => item.spend !== null && item.purchases !== null &&
    minimumMet(item.purchases, META_ANOMALY_RULES_V1.cpa_purchase.minimumPurchases) &&
    item.purchaseAttributionKey !== null) &&
    baseline.purchaseAttributionKey === current.purchaseAttributionKey;
}

function ruleFor(metric: MetaAnomalyMetric) {
  if (metric === 'ctr') return {
    direction: 'decrease' as const, warning: META_ANOMALY_RULES_V1.ctr.warningPct,
    critical: META_ANOMALY_RULES_V1.ctr.criticalPct, minimum: `${META_ANOMALY_RULES_V1.ctr.minimumImpressions} impresiones`,
    ruleId: 'ctr_decrease' as const,
  };
  if (metric === 'cpc') return {
    direction: 'increase' as const, warning: META_ANOMALY_RULES_V1.cpc.warningPct,
    critical: META_ANOMALY_RULES_V1.cpc.criticalPct, minimum: `${META_ANOMALY_RULES_V1.cpc.minimumClicks} clics`,
    ruleId: 'cpc_increase' as const,
  };
  if (metric === 'cpm') return {
    direction: 'increase' as const, warning: META_ANOMALY_RULES_V1.cpm.warningPct,
    critical: META_ANOMALY_RULES_V1.cpm.criticalPct, minimum: `${META_ANOMALY_RULES_V1.cpm.minimumImpressions} impresiones`,
    ruleId: 'cpm_increase' as const,
  };
  if (metric === 'spend') return {
    direction: 'increase' as const, warning: META_ANOMALY_RULES_V1.spend.warningPct,
    critical: META_ANOMALY_RULES_V1.spend.criticalPct, minimum: `${META_ANOMALY_RULES_V1.spend.minimumImpressions} impresiones`,
    ruleId: 'spend_increase' as const,
  };
  return {
    direction: 'increase' as const, warning: META_ANOMALY_RULES_V1.cpa_purchase.warningPct,
    critical: META_ANOMALY_RULES_V1.cpa_purchase.criticalPct, minimum: `${META_ANOMALY_RULES_V1.cpa_purchase.minimumPurchases} compras`,
    ruleId: 'cpa_purchase_increase' as const,
  };
}

function stableHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function latestFetchedAt(rows: readonly MetaAnomalyObservation[]): string | null {
  return rows.map((item) => item.fetchedAt).filter((item): item is string => item !== null)
    .sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function displayValue(metric: MetaAnomalyMetric, value: ExactRatio, aggregateValue: Aggregate) {
  const unit = metric === 'ctr' ? 'percent' as const : 'money' as const;
  return {
    value: formatRatio(value, 2),
    unit,
    currency: unit === 'money' ? aggregateValue.currency : null,
  };
}

function evaluateMetric(
  metric: MetaAnomalyMetric,
  scope: Scope,
  rows: readonly MetaAnomalyObservation[],
  periods: MetaAnomalyPeriods,
  baseline: Aggregate,
  current: Aggregate,
): Candidate | null {
  if (!isEvaluable(metric, baseline, current)) return null;
  const baselineRatio = metricRatio(metric, baseline);
  const currentRatio = metricRatio(metric, current);
  if (!baselineRatio || !currentRatio || baselineRatio.numerator === BigInt(0) || currentRatio.denominator === BigInt(0)) return null;
  const rule = ruleFor(metric);
  let severity: MetaAnomalySeverity | null = null;
  if (thresholdReached(currentRatio, baselineRatio, rule.direction, rule.critical)) severity = 'critical';
  else if (thresholdReached(currentRatio, baselineRatio, rule.direction, rule.warning)) severity = 'warning';
  if (!severity) return null;
  const change = percentChange(currentRatio, baselineRatio);
  if (!change) return null;
  const changePct = formatRatio(change, 1);
  const magnitude: ExactRatio = { numerator: change.numerator < BigInt(0) ? -change.numerator : change.numerator, denominator: change.denominator };
  return {
    magnitude,
    anomaly: {
      id: `meta-anomaly-${stableHash(`${scope.level}|${scope.entityRef}|${metric}|${periods.current.to}`)}`,
      metric,
      level: scope.level,
      entityRef: scope.entityRef,
      entityName: scope.entityName,
      severity,
      direction: rule.direction,
      baseline: displayValue(metric, baselineRatio, baseline),
      current: displayValue(metric, currentRatio, current),
      changePct,
      periods,
      evidence: {
        daysPerPeriod: 7,
        observationsUsed: 14,
        latestFetchedAt: latestFetchedAt(rows),
        timezone: rows.map((item) => item.timezone).find((item): item is string => item !== null) ?? null,
        minimumVolume: rule.minimum,
        purchaseAttributionKey: metric === 'cpa_purchase' ? baseline.purchaseAttributionKey : null,
      },
      ruleId: rule.ruleId,
      rulesVersion: META_ANOMALY_RULES_V1.version,
    },
  };
}

export function detectMetaAnomalies(input: DetectMetaAnomaliesInput): MetaAnomalyResult {
  const candidates: Candidate[] = [];
  const omittedScopes: MetaAnomalyResult['omittedScopes'][number][] = [];
  let evaluatedScopes = 0;
  let resultPeriods: MetaAnomalyPeriods | null = null;

  for (const scope of groupScopes(input.observations)) {
    const selected = selectWindow(scope);
    if (!selected) {
      omittedScopes.push({ level: scope.level, entityRef: scope.entityRef,
        entityName: scope.entityName, reason: 'incomplete_period' });
      continue;
    }
    if (!resultPeriods || scope.level === 'account') resultPeriods = selected.periods;
    const baseline = aggregate(selected.rows.slice(0, DAYS_PER_PERIOD));
    const current = aggregate(selected.rows.slice(DAYS_PER_PERIOD));
    const metrics: MetaAnomalyMetric[] = ['ctr', 'cpc', 'cpm', 'spend', 'cpa_purchase'];
    const evaluable = metrics.filter((metric) => isEvaluable(metric, baseline, current));
    if (evaluable.length === 0) {
      omittedScopes.push({ level: scope.level, entityRef: scope.entityRef,
        entityName: scope.entityName, reason: 'no_evaluable_metrics' });
      continue;
    }
    evaluatedScopes += 1;
    for (const metric of evaluable) {
      const candidate = evaluateMetric(metric, scope, selected.rows, selected.periods, baseline, current);
      if (candidate) candidates.push(candidate);
    }
  }

  candidates.sort((left, right) => {
    const severity = Number(right.anomaly.severity === 'critical') - Number(left.anomaly.severity === 'critical');
    if (severity !== 0) return severity;
    const magnitude = compareRatio(right.magnitude, left.magnitude);
    if (magnitude !== 0) return magnitude;
    return left.anomaly.id.localeCompare(right.anomaly.id);
  });

  return {
    contractVersion: 1,
    rulesVersion: META_ANOMALY_RULES_V1.version,
    mode: input.mode,
    generatedAt: input.generatedAt,
    status: evaluatedScopes > 0 ? 'ready' : 'insufficient_data',
    periods: evaluatedScopes > 0 ? resultPeriods : null,
    evaluatedScopes,
    omittedScopes,
    anomalies: candidates.slice(0, MAX_ANOMALIES).map((item) => item.anomaly),
  };
}
