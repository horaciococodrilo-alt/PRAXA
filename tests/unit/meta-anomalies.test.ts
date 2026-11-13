import { describe, expect, it } from 'vitest';

import {
  META_ANOMALY_RULES_V1,
  detectMetaAnomalies,
  type MetaAnomalyMetric,
  type MetaAnomalyObservation,
} from '@/modules/anomalies';

const START = new Date('2026-10-01T00:00:00.000Z');

function isoDay(offset: number): string {
  const date = new Date(START);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

type RowOverrides = Partial<Omit<MetaAnomalyObservation, 'day'>> & { day?: string };

function row(day: number, overrides: RowOverrides = {}): MetaAnomalyObservation {
  return {
    day: overrides.day ?? isoDay(day),
    level: 'account',
    entityRef: 'scope-account',
    entityName: 'Cuenta de prueba',
    presence: 'con_datos',
    temporalStatus: 'cerrado',
    capturedBeforeDayEnd: false,
    spend: '100',
    impressions: '1000',
    clicks: '100',
    purchases: '10',
    purchaseAttributionKey: 'known:7d_click',
    currency: 'ARS',
    timezone: 'America/Argentina/Buenos_Aires',
    fetchedAt: '2026-10-15T12:00:00.000Z',
    ...overrides,
  };
}

function series(current: RowOverrides = {}, baseline: RowOverrides = {}): MetaAnomalyObservation[] {
  return Array.from({ length: 14 }, (_, day) => row(day, day < 7 ? baseline : current));
}

function detect(observations: MetaAnomalyObservation[]) {
  return detectMetaAnomalies({
    mode: 'real',
    generatedAt: '2026-10-15T13:00:00.000Z',
    observations,
  });
}

function anomaly(observations: MetaAnomalyObservation[], metric: MetaAnomalyMetric) {
  return detect(observations).anomalies.find((item) => item.metric === metric);
}

describe('M25b: contrato, períodos y cobertura', () => {
  it('devuelve insufficient_data sin observaciones', () => {
    const result = detect([]);
    expect(result).toMatchObject({
      contractVersion: 1,
      rulesVersion: 'meta-anomaly-rules/1',
      mode: 'real',
      status: 'insufficient_data',
      periods: null,
      evaluatedScopes: 0,
      anomalies: [],
    });
  });

  it('selecciona dos períodos consecutivos de siete días', () => {
    const result = detect(series());
    expect(result.status).toBe('ready');
    expect(result.periods).toEqual({
      baseline: { from: '2026-10-01', to: '2026-10-07' },
      current: { from: '2026-10-08', to: '2026-10-14' },
    });
    expect(result.evaluatedScopes).toBe(1);
  });

  it.each([
    ['un hueco', (rows: MetaAnomalyObservation[]) => rows.filter((_, index) => index !== 4)],
    ['un día abierto', (rows: MetaAnomalyObservation[]) => rows.map((item, index) => index === 4 ? { ...item, temporalStatus: 'abierto' as const } : item)],
    ['una fila sin datos', (rows: MetaAnomalyObservation[]) => rows.map((item, index) => index === 4 ? { ...item, presence: 'sin_fila_reportada' as const } : item)],
    ['una captura parcial', (rows: MetaAnomalyObservation[]) => rows.map((item, index) => index === 4 ? { ...item, capturedBeforeDayEnd: true } : item)],
  ])('no comprime ni convierte en cero %s', (_, alter) => {
    const result = detect(alter(series()));
    expect(result.status).toBe('insufficient_data');
    expect(result.anomalies).toEqual([]);
    expect(result.omittedScopes[0]?.reason).toBe('incomplete_period');
  });
});

describe('M25b: reglas versionadas y bordes', () => {
  it('publica los umbrales aprobados en una sola constante', () => {
    expect(META_ANOMALY_RULES_V1).toMatchObject({
      version: 'meta-anomaly-rules/1',
      ctr: { warningPct: 20, criticalPct: 40, minimumImpressions: '1000' },
      cpc: { warningPct: 25, criticalPct: 50, minimumClicks: '20' },
      cpm: { warningPct: 25, criticalPct: 50, minimumImpressions: '1000' },
      spend: { warningPct: 30, criticalPct: 60, minimumImpressions: '1000' },
      cpa_purchase: { warningPct: 25, criticalPct: 50, minimumPurchases: '5' },
    });
  });

  it.each([
    ['19 % no alerta', '81', undefined],
    ['20 % es warning', '80', 'warning'],
    ['40 % es critical', '60', 'critical'],
  ])('CTR: %s', (_, clicks, severity) => {
    expect(anomaly(series({ clicks }), 'ctr')?.severity).toBe(severity);
  });

  it.each([
    ['24 % no alerta', '124', undefined],
    ['25 % es warning', '125', 'warning'],
    ['50 % es critical', '150', 'critical'],
  ])('CPC: %s', (_, spend, severity) => {
    expect(anomaly(series({ spend }), 'cpc')?.severity).toBe(severity);
  });

  it.each([
    ['24 % no alerta', '124', undefined],
    ['25 % es warning', '125', 'warning'],
    ['50 % es critical', '150', 'critical'],
  ])('CPM: %s', (_, spend, severity) => {
    expect(anomaly(series({ spend }), 'cpm')?.severity).toBe(severity);
  });

  it.each([
    ['29 % no alerta', '129', undefined],
    ['30 % es warning', '130', 'warning'],
    ['60 % es critical', '160', 'critical'],
  ])('gasto: %s', (_, value, severity) => {
    const factor = BigInt(value);
    const observations = series({
      spend: value,
      impressions: String(factor * BigInt(10)),
      clicks: value,
    });
    expect(anomaly(observations, 'spend')?.severity).toBe(severity);
  });

  it('respeta los mínimos de volumen', () => {
    expect(anomaly(series({ clicks: '8', impressions: '70' }, { clicks: '10', impressions: '70' }), 'ctr')).toBeUndefined();
    expect(anomaly(series({ spend: '3', clicks: '2' }, { spend: '2', clicks: '2' }), 'cpc')).toBeUndefined();
    expect(anomaly(series({ spend: '150', impressions: '100' }, { spend: '100', impressions: '100' }), 'cpm')).toBeUndefined();
  });
});

describe('M25b: CPA confiable', () => {
  it.each([
    ['24 % no alerta', '124', undefined],
    ['25 % es warning', '125', 'warning'],
    ['50 % es critical', '150', 'critical'],
  ])('CPA: %s', (_, spend, severity) => {
    expect(anomaly(series({ spend }), 'cpa_purchase')?.severity).toBe(severity);
  });

  it('omite CPA si falta compra explícita, sin bloquear otras reglas', () => {
    const observations = series({ clicks: '60' });
    observations[9] = { ...observations[9], purchases: null };
    const result = detect(observations);
    expect(result.anomalies.some((item) => item.metric === 'cpa_purchase')).toBe(false);
    expect(result.anomalies.find((item) => item.metric === 'ctr')?.severity).toBe('critical');
  });

  it.each([
    ['atribución desconocida', { purchaseAttributionKey: null }],
    ['atribución distinta', { purchaseAttributionKey: 'known:1d_view' }],
  ])('omite CPA con %s', (_, change) => {
    const observations = series({ spend: '150' });
    observations[10] = { ...observations[10], ...change };
    expect(anomaly(observations, 'cpa_purchase')).toBeUndefined();
  });

  it('omite CPA con menos de cinco compras en cualquiera de los períodos', () => {
    expect(anomaly(series({ spend: '15', purchases: '0.5' }, { spend: '10', purchases: '0.5' }), 'cpa_purchase')).toBeUndefined();
  });
});

describe('M25b: precisión, alcances y salida', () => {
  it('omite reglas afectadas por impresiones o clics no enteros', () => {
    const clicks = series({ clicks: '60' });
    clicks[10] = { ...clicks[10], clicks: '60.5' };
    const clickMetrics = detect(clicks).anomalies.map((item) => item.metric);
    expect(clickMetrics).not.toContain('ctr');
    expect(clickMetrics).not.toContain('cpc');

    const impressions = series({ spend: '150' });
    impressions[10] = { ...impressions[10], impressions: '1000.5' };
    const impressionMetrics = detect(impressions).anomalies.map((item) => item.metric);
    expect(impressionMetrics).not.toContain('cpm');
    expect(impressionMetrics).not.toContain('spend');
  });

  it('no compara importes de monedas distintas entre períodos', () => {
    const result = detect(series({ spend: '150', currency: 'USD' }, { currency: 'ARS' }));
    expect(result.anomalies.some((item) => item.baseline.unit === 'money')).toBe(false);
    expect(result.anomalies.some((item) => item.metric === 'ctr')).toBe(false);
  });

  it('acepta decimales válidos con ceros iniciales sin perder exactitud', () => {
    const result = anomaly(series({ spend: '00150.00' }), 'spend');
    expect(result).toMatchObject({
      baseline: { value: '700.00' },
      current: { value: '1050.00' },
      changePct: '50.0',
    });
  });

  it('conserva exactitud por encima de Number.MAX_SAFE_INTEGER', () => {
    const baseline = '900719925474099300000';
    const current = '1170935903116329090000';
    const result = anomaly(series(
      { spend: current, impressions: '1300', clicks: '130' },
      { spend: baseline, impressions: '1000', clicks: '100' },
    ), 'spend');
    expect(result).toMatchObject({
      changePct: '30.0',
      baseline: { value: '6305039478318695100000.00' },
      current: { value: '8196551321814303630000.00' },
    });
  });

  it('evalúa cuenta y campañas por separado y limita la salida a 20', () => {
    const observations = Array.from({ length: 22 }, (_, scope) =>
      series({ clicks: '40' }).map((item) => ({
        ...item,
        level: scope === 0 ? 'account' as const : 'campaign' as const,
        entityRef: `scope-${scope}`,
        entityName: scope === 0 ? 'Cuenta' : `Campaña ${scope}`,
      }))).flat();
    const result = detect(observations);
    expect(result.evaluatedScopes).toBe(22);
    expect(result.anomalies).toHaveLength(20);
    expect(result.anomalies.every((item) => item.severity === 'critical')).toBe(true);
    expect(new Set(result.anomalies.map((item) => item.entityRef)).size).toBe(20);
  });

  it('es determinístico y JSON-serializable', () => {
    const input = series({ spend: '150' });
    const first = detect(input);
    const second = detect([...input].reverse());
    expect(second).toEqual(first);
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain('bigint');
    expect(JSON.parse(serialized)).toEqual(first);
  });

  it('incluye períodos, regla, evidencia y valores comparados', () => {
    const result = anomaly(series({ clicks: '60' }), 'ctr');
    expect(result).toMatchObject({
      metric: 'ctr',
      direction: 'decrease',
      severity: 'critical',
      baseline: { value: '10.00', unit: 'percent' },
      current: { value: '6.00', unit: 'percent' },
      changePct: '-40.0',
      periods: {
        baseline: { from: '2026-10-01', to: '2026-10-07' },
        current: { from: '2026-10-08', to: '2026-10-14' },
      },
      evidence: { daysPerPeriod: 7, observationsUsed: 14 },
      ruleId: 'ctr_decrease',
      rulesVersion: 'meta-anomaly-rules/1',
    });
  });
});
