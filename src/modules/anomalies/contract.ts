export const META_ANOMALY_RULES_V1 = Object.freeze({
  version: 'meta-anomaly-rules/1' as const,
  ctr: Object.freeze({ warningPct: 20, criticalPct: 40, minimumImpressions: '1000' }),
  cpc: Object.freeze({ warningPct: 25, criticalPct: 50, minimumClicks: '20' }),
  cpm: Object.freeze({ warningPct: 25, criticalPct: 50, minimumImpressions: '1000' }),
  spend: Object.freeze({ warningPct: 30, criticalPct: 60, minimumImpressions: '1000' }),
  cpa_purchase: Object.freeze({ warningPct: 25, criticalPct: 50, minimumPurchases: '5' }),
});

export type MetaAnomalyLevel = 'account' | 'campaign';
export type MetaAnomalyMetric = 'ctr' | 'cpc' | 'cpm' | 'spend' | 'cpa_purchase';
export type MetaAnomalySeverity = 'warning' | 'critical';
export type MetaAnomalyMode = 'real' | 'synthetic_demo';

export type MetaAnomalyObservation = Readonly<{
  day: string;
  level: MetaAnomalyLevel;
  entityRef: string;
  entityName: string | null;
  presence: 'no_observado' | 'sin_fila_reportada' | 'con_datos';
  temporalStatus: 'abierto' | 'cerrado';
  capturedBeforeDayEnd: boolean | null;
  spend: string | null;
  impressions: string | null;
  clicks: string | null;
  purchases: string | null;
  purchaseAttributionKey: string | null;
  currency: string | null;
  timezone: string | null;
  fetchedAt: string | null;
}>;

export type MetaAnomalyPeriod = Readonly<{ from: string; to: string }>;
export type MetaAnomalyPeriods = Readonly<{
  baseline: MetaAnomalyPeriod;
  current: MetaAnomalyPeriod;
}>;

export type MetaAnomalyValue = Readonly<{
  value: string;
  unit: 'percent' | 'money';
  currency: string | null;
}>;

export type MetaAnomaly = Readonly<{
  id: string;
  metric: MetaAnomalyMetric;
  level: MetaAnomalyLevel;
  entityRef: string;
  entityName: string | null;
  severity: MetaAnomalySeverity;
  direction: 'increase' | 'decrease';
  baseline: MetaAnomalyValue;
  current: MetaAnomalyValue;
  changePct: string;
  periods: MetaAnomalyPeriods;
  evidence: Readonly<{
    daysPerPeriod: 7;
    observationsUsed: 14;
    latestFetchedAt: string | null;
    timezone: string | null;
    minimumVolume: string;
    purchaseAttributionKey: string | null;
  }>;
  ruleId: 'ctr_decrease' | 'cpc_increase' | 'cpm_increase' | 'spend_increase' | 'cpa_purchase_increase';
  rulesVersion: typeof META_ANOMALY_RULES_V1.version;
}>;

export type MetaAnomalyOmissionReason = 'incomplete_period' | 'no_evaluable_metrics';

export type MetaAnomalyResult = Readonly<{
  contractVersion: 1;
  rulesVersion: typeof META_ANOMALY_RULES_V1.version;
  mode: MetaAnomalyMode;
  generatedAt: string;
  status: 'ready' | 'insufficient_data';
  periods: MetaAnomalyPeriods | null;
  evaluatedScopes: number;
  omittedScopes: readonly Readonly<{
    level: MetaAnomalyLevel;
    entityRef: string;
    entityName: string | null;
    reason: MetaAnomalyOmissionReason;
  }>[];
  anomalies: readonly MetaAnomaly[];
}>;

export type DetectMetaAnomaliesInput = Readonly<{
  mode: MetaAnomalyMode;
  observations: readonly MetaAnomalyObservation[];
  generatedAt: string;
}>;

export type MetaAnomalyView =
  | Readonly<{ state: 'not_connected'; reason: 'missing' | 'pending_selection' | 'needs_reauth' }>
  | Readonly<{ state: 'never_synced' }>
  | Readonly<{ state: 'insufficient_data'; result: MetaAnomalyResult; lastSyncedAt: string | null }>
  | Readonly<{ state: 'ready'; result: MetaAnomalyResult; lastSyncedAt: string | null }>
  | Readonly<{ state: 'unavailable' }>;
