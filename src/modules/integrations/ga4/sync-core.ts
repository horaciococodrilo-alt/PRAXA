import 'server-only';

import { GA4_PROVISIONAL_DAYS, GA4_REPORT_VERSION, type Ga4ReportDefinition, type Ga4ReportId } from './reports';

const DAY_MS = 86_400_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type Ga4Window = Readonly<{ from: string; to: string }>;
export type Ga4Quality = Readonly<{
  sampling_metadatas: readonly { samples_read_count: string; sampling_space_size: string }[];
  subject_to_thresholding: boolean;
  data_loss_from_other_row: boolean;
  data_truncation_reasons: readonly string[];
  restricted_metrics: readonly { metric_name: string; restricted_metric_types: readonly string[] }[];
  empty_reason: string | null;
  currency_code: string;
  time_zone: string;
}>;

export class Ga4SyncDataError extends Error {
  constructor(readonly kind: 'calidad_inconsistente' | 'solicitud_invalida' | 'campo_invalido') {
    super('Respuesta de GA4 inválida para la sincronización.');
  }
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function utc(day: string): number {
  if (!DAY.test(day)) throw new Ga4SyncDataError('solicitud_invalida');
  const n = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== day) {
    throw new Ga4SyncDataError('solicitud_invalida');
  }
  return n;
}
export function shiftGa4Day(day: string, delta: number): string {
  return new Date(utc(day) + delta * DAY_MS).toISOString().slice(0, 10);
}
export function ga4LocalDay(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit',
    day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function ga4DailyWindows(today: string, phase: 'backfill' | 'incremental',
  coverageThrough: string | null): readonly Ga4Window[] {
  const end = shiftGa4Day(today, -1);
  const start = phase === 'backfill' ? shiftGa4Day(today, -365)
    : coverageThrough ? shiftGa4Day(coverageThrough, -GA4_PROVISIONAL_DAYS) : shiftGa4Day(today, -365);
  if (start > end) return [];
  const windows: Ga4Window[] = [];
  for (let cursor = end; cursor >= start; cursor = shiftGa4Day(windows.at(-1)!.from, -1)) {
    const from = shiftGa4Day(cursor, -30);
    windows.push({ from: from < start ? start : from, to: cursor });
  }
  return windows;
}
function monthStart(day: string): string { return `${day.slice(0, 7)}-01`; }
function shiftMonth(day: string, months: number): string {
  const date = new Date(utc(monthStart(day)));
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}
function monthEnd(day: string): string { return shiftGa4Day(shiftMonth(day, 1), -1); }
export function ga4CohortMonths(today: string): readonly Ga4Window[] {
  const newest = monthStart(today);
  return Array.from({ length: 12 }, (_, index) => {
    const from = shiftMonth(newest, index - 11);
    return { from, to: monthEnd(from) };
  });
}
export function ga4CohortCellAvailability(month: Ga4Window, offset: number, today: string):
  'aun_no_disponible' | 'provisional' | 'cerrada' {
  if (!Number.isInteger(offset) || offset < 0 || offset > 11) throw new Ga4SyncDataError('solicitud_invalida');
  const start = shiftGa4Day(month.from, 30 * offset);
  const end = shiftGa4Day(month.to, 30 * offset);
  return today < start ? 'aun_no_disponible'
    : today <= shiftGa4Day(end, GA4_PROVISIONAL_DAYS) ? 'provisional' : 'cerrada';
}
export function ga4ReportRequest(report: Ga4ReportDefinition, window: Ga4Window,
  today: string, offset: number): Record<string, unknown> {
  const common: Record<string, unknown> = {
    dimensions: report.dimensions.map((name) => ({ name })),
    metrics: report.metrics.map((name) => ({ name })),
    limit: '10000', offset: String(offset), returnPropertyQuota: true,
  };
  if (report.dimensionFilter) common.dimensionFilter = report.dimensionFilter;
  if (report.window.kind === 'cohort') {
    const months = ga4CohortMonths(today);
    common.cohortSpec = { cohorts: months.map((month) => ({ name: month.from.slice(0, 7),
      dimension: 'firstSessionDate', dateRange: { startDate: month.from, endDate: month.to } })),
      cohortsRange: { granularity: 'MONTHLY', startOffset: 0, endOffset: 11 } };
  } else common.dateRanges = [{ startDate: window.from, endDate: window.to }];
  return common;
}

function nonnegative(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(value)) {
    throw new Ga4SyncDataError('campo_invalido');
  }
  return value;
}
function stringList(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.length <= 100)) {
    throw new Ga4SyncDataError('calidad_inconsistente');
  }
  return [...new Set(value)].sort();
}
export function ga4PageQuality(response: unknown, property: { currency: string; timezone: string }): Ga4Quality {
  const body = object(response);
  const metadata = object(body?.metadata);
  if (!metadata) throw new Ga4SyncDataError('calidad_inconsistente');
  const sampling = metadata.samplingMetadatas === undefined ? [] : metadata.samplingMetadatas;
  if (!Array.isArray(sampling)) throw new Ga4SyncDataError('calidad_inconsistente');
  const sampling_metadatas = sampling.map((value) => {
    const row = object(value);
    if (!row) throw new Ga4SyncDataError('calidad_inconsistente');
    return { samples_read_count: nonnegative(row.samplesReadCount),
      sampling_space_size: nonnegative(row.samplingSpaceSize) };
  });
  const restrictions = object(metadata.schemaRestrictionResponse)?.activeMetricRestrictions;
  if (restrictions !== undefined && !Array.isArray(restrictions)) {
    throw new Ga4SyncDataError('calidad_inconsistente');
  }
  const restricted_metrics = ((restrictions ?? []) as unknown[]).map((value) => {
    const row = object(value);
    if (typeof row?.metricName !== 'string' || row.metricName.length > 100) {
      throw new Ga4SyncDataError('calidad_inconsistente');
    }
    return { metric_name: row.metricName, restricted_metric_types: stringList(row.restrictedMetricTypes) };
  });
  const boolean = (value: unknown) => {
    if (value !== undefined && typeof value !== 'boolean') throw new Ga4SyncDataError('calidad_inconsistente');
    return value === true;
  };
  const currency = metadata.currencyCode ?? property.currency;
  const timezone = metadata.timeZone ?? property.timezone;
  const empty = metadata.emptyReason ?? null;
  if (currency !== property.currency || timezone !== property.timezone ||
      (empty !== null && typeof empty !== 'string')) throw new Ga4SyncDataError('calidad_inconsistente');
  const responseRows = body?.rows;
  const hasOther = Array.isArray(responseRows) && responseRows.some((row) => {
    const dimensions = object(row)?.dimensionValues;
    return Array.isArray(dimensions) && dimensions.some((cell) => object(cell)?.value === '(other)');
  });
  return { sampling_metadatas, subject_to_thresholding: boolean(metadata.subjectToThresholding),
    data_loss_from_other_row: boolean(metadata.dataLossFromOtherRow) || hasOther,
    data_truncation_reasons: stringList(metadata.dataTruncationReasons), restricted_metrics,
    empty_reason: empty, currency_code: property.currency, time_zone: property.timezone };
}
export function mergeGa4Quality(pages: readonly Ga4Quality[]): Ga4Quality {
  if (!pages.length) throw new Ga4SyncDataError('calidad_inconsistente');
  const first = pages[0];
  for (const next of pages.slice(1)) {
    if (JSON.stringify(next.sampling_metadatas) !== JSON.stringify(first.sampling_metadatas) ||
        next.empty_reason !== first.empty_reason || next.currency_code !== first.currency_code ||
        next.time_zone !== first.time_zone) throw new Ga4SyncDataError('calidad_inconsistente');
  }
  const union = (lists: readonly (readonly string[])[]) => [...new Set(lists.flat())].sort();
  const restrictions = new Map<string, Set<string>>();
  for (const page of pages) for (const metric of page.restricted_metrics) {
    const types = restrictions.get(metric.metric_name) ?? new Set<string>();
    metric.restricted_metric_types.forEach((type) => types.add(type));
    restrictions.set(metric.metric_name, types);
  }
  return { ...first, subject_to_thresholding: pages.some((page) => page.subject_to_thresholding),
    data_loss_from_other_row: pages.some((page) => page.data_loss_from_other_row),
    data_truncation_reasons: union(pages.map((page) => page.data_truncation_reasons)),
    restricted_metrics: [...restrictions].sort(([a], [b]) => a.localeCompare(b))
      .map(([metric_name, types]) => ({ metric_name, restricted_metric_types: [...types].sort() })) };
}
export function ga4QuotaLow(response: unknown): boolean | null {
  const quota = object(object(response)?.propertyQuota);
  if (!quota) return null;
  for (const [name, threshold] of [['tokensPerHour', 4000],
    ['tokensPerProjectPerHour', 1400], ['tokensPerDay', 20000]] as const) {
    const entry = object(quota[name]);
    if (entry && typeof entry.remaining === 'number' && entry.remaining < threshold) return true;
  }
  return false;
}

export function ga4ProjectRows(reportId: Ga4ReportId, response: unknown,
  window: Ga4Window, today: string): Record<string, unknown>[] {
  const body = object(response);
  const rows = body?.rows ?? [];
  if (!Array.isArray(rows)) throw new Ga4SyncDataError('campo_invalido');
  const read = (row: unknown, key: 'dimensionValues' | 'metricValues', count: number) => {
    const cells = object(row)?.[key];
    if (!Array.isArray(cells) || cells.length !== count) throw new Ga4SyncDataError('campo_invalido');
    return cells.map((cell) => {
      const value = object(cell)?.value;
      if (typeof value !== 'string') throw new Ga4SyncDataError('campo_invalido');
      return value;
    });
  };
  const day = (value: string) => {
    if (!/^\d{8}$/.test(value)) throw new Ga4SyncDataError('campo_invalido');
    const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
    if (utc(iso) < utc(window.from) || utc(iso) > utc(window.to)) throw new Ga4SyncDataError('campo_invalido');
    return iso;
  };
  return rows.map((row) => {
    if (reportId === 'ga4_cohortes') {
      const [cohort, rawOffset] = read(row, 'dimensionValues', 2);
      const [size, active] = read(row, 'metricValues', 2).map(nonnegative).map(Number);
      const month = `${cohort}-01`;
      const offset = Number(rawOffset);
      if (!/^\d{4}-\d{2}$/.test(cohort) || !Number.isSafeInteger(size) ||
          !Number.isSafeInteger(active) || !Number.isInteger(offset) || offset < 0 || offset > 11 ||
          active > size || utc(month) < utc(window.from) || utc(month) > utc(window.to)) {
        throw new Ga4SyncDataError('campo_invalido');
      }
      const monthWindow = { from: month, to: monthEnd(month) };
      const availability = ga4CohortCellAvailability(monthWindow, offset, today);
      if (availability === 'aun_no_disponible') throw new Ga4SyncDataError('campo_invalido');
      return { cohort_month: month, month_offset: offset, cohort_size: size >= 5 ? size : null,
        active: size >= 5 && active >= 5 ? active : null, provisional: availability === 'provisional' };
    }
    const dimensions = reportId === 'ga4_trafico_dia' ? 1 : reportId === 'ga4_productos' ? 3 :
      reportId === 'ga4_trafico_fuente' ? 3 : 2;
    const metrics = reportId === 'ga4_trafico_dia' || reportId === 'ga4_productos' ? 3 : 1;
    const d = read(row, 'dimensionValues', dimensions);
    const m = read(row, 'metricValues', metrics).map(nonnegative).map(Number);
    if (m.some((value) => !Number.isSafeInteger(value))) throw new Ga4SyncDataError('campo_invalido');
    const base = { day: day(d[0]) };
    if (reportId === 'ga4_trafico_dia') return { ...base, sessions: m[0], active_users: m[1],
      new_users: m[2], provisional: base.day >= shiftGa4Day(today, -GA4_PROVISIONAL_DAYS) };
    if (reportId === 'ga4_trafico_fuente') return { ...base, source: d[1], medium: d[2], sessions: m[0] };
    if (reportId === 'ga4_campanias') return { ...base, campaign_id: d[1], sessions: m[0] };
    if (reportId === 'ga4_embudo') return { ...base, event_name: d[1], event_count: m[0] };
    return { ...base, item_id: d[1], item_name: d[2], views: m[0],
      add_to_carts: m[1], purchases: m[2] };
  });
}

export function ga4Checkpoint(completed: readonly string[]): { completed_reports: string[]; version: number } {
  return { completed_reports: [...new Set(completed)], version: GA4_REPORT_VERSION };
}
