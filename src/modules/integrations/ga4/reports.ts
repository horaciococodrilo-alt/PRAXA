import 'server-only';

import { SecretValue } from '../crypto/seal';
import { Ga4ApiError, normalizeSiteHost, parseProperty, type Ga4Http, type Ga4Property } from './google';

export const GA4_PROVISIONAL_DAYS = 3;
export const GA4_REPORT_VERSION = 1;

export type Ga4ReportId = 'ga4_trafico_dia' | 'ga4_trafico_fuente' | 'ga4_campanias' |
  'ga4_embudo' | 'ga4_productos' | 'ga4_cohortes';
export type Ga4Capability = 'trafico' | 'cohortes' | 'campanias' | 'embudo' | 'productos';
export type Ga4CapabilityStatus = 'disponible' | 'sin_instrumentacion' | 'incompatible' | 'restringida';
export type Ga4CapabilityResult = Readonly<{ status: Ga4CapabilityStatus; reason: string | null }>;

type Filter = Record<string, unknown>;
export type Ga4ReportDefinition = Readonly<{
  id: Ga4ReportId; version: number; capability: Ga4Capability; required: boolean;
  dimensions: readonly string[]; metrics: readonly string[];
  window: Readonly<{ kind: 'daily'; days: 31 } | { kind: 'cohort'; months: 12; endOffset: 11 }>;
  dimensionFilter: Filter | null;
}>;

const notExact = (fieldName: string, value: string): Filter => ({ notExpression: {
  filter: { fieldName, stringFilter: { matchType: 'EXACT', value } },
} });
export const GA4_CAMPAIGN_FILTER: Filter = Object.freeze({ andGroup: { expressions: [
  notExact('sessionManualCampaignId', ''), notExact('sessionManualCampaignId', '(not set)'),
] } });
export const GA4_FUNNEL_EVENTS = Object.freeze(['view_item', 'add_to_cart', 'begin_checkout', 'purchase'] as const);
export const GA4_FUNNEL_FILTER: Filter = Object.freeze({ filter: {
  fieldName: 'eventName', inListFilter: { values: [...GA4_FUNNEL_EVENTS] },
} });

const DAILY = Object.freeze({ kind: 'daily', days: 31 } as const);
const COHORT = Object.freeze({ kind: 'cohort', months: 12, endOffset: 11 } as const);
export const GA4_REPORT_CATALOG: readonly Ga4ReportDefinition[] = Object.freeze([
  { id: 'ga4_trafico_dia', version: GA4_REPORT_VERSION, capability: 'trafico', required: true,
    dimensions: ['date'], metrics: ['sessions', 'activeUsers', 'newUsers'], window: DAILY, dimensionFilter: null },
  { id: 'ga4_trafico_fuente', version: GA4_REPORT_VERSION, capability: 'trafico', required: true,
    dimensions: ['date', 'sessionSource', 'sessionMedium'], metrics: ['sessions'], window: DAILY, dimensionFilter: null },
  { id: 'ga4_campanias', version: GA4_REPORT_VERSION, capability: 'campanias', required: false,
    dimensions: ['date', 'sessionManualCampaignId'], metrics: ['sessions'], window: DAILY,
    dimensionFilter: GA4_CAMPAIGN_FILTER },
  { id: 'ga4_embudo', version: GA4_REPORT_VERSION, capability: 'embudo', required: false,
    dimensions: ['date', 'eventName'], metrics: ['eventCount'], window: DAILY,
    dimensionFilter: GA4_FUNNEL_FILTER },
  { id: 'ga4_productos', version: GA4_REPORT_VERSION, capability: 'productos', required: false,
    dimensions: ['date', 'itemId', 'itemName'], metrics: ['itemsViewed', 'itemsAddedToCart', 'itemsPurchased'],
    window: DAILY, dimensionFilter: null },
  { id: 'ga4_cohortes', version: GA4_REPORT_VERSION, capability: 'cohortes', required: true,
    dimensions: ['cohort', 'cohortNthMonth'], metrics: ['cohortTotalUsers', 'cohortActiveUsers'],
    window: COHORT, dimensionFilter: null },
]);

const available = (): Ga4CapabilityResult => ({ status: 'disponible', reason: null });
const absent = (status: Exclude<Ga4CapabilityStatus, 'disponible'>, reason: string): Ga4CapabilityResult =>
  ({ status, reason });

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function names(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.map((entry) => record(entry)?.apiName).filter((name): name is string =>
    typeof name === 'string'));
}
function metadataHas(body: unknown, report: Ga4ReportDefinition): boolean {
  const metadata = record(body);
  if (!metadata) return false;
  const dimensions = names(metadata.dimensions);
  const metrics = names(metadata.metrics);
  return report.dimensions.every((name) => dimensions.has(name)) && report.metrics.every((name) => metrics.has(name));
}
function compatible(body: unknown, report: Ga4ReportDefinition): boolean {
  const response = record(body);
  if (!response) return false;
  const dimensionRows = Array.isArray(response.dimensionCompatibilities) ? response.dimensionCompatibilities : [];
  const metricRows = Array.isArray(response.metricCompatibilities) ? response.metricCompatibilities : [];
  const has = (rows: unknown[], key: string, requested: string) => rows.some((row) => {
    const value = record(row);
    return record(value?.[key])?.apiName === requested && value?.compatibility === 'COMPATIBLE';
  });
  return report.dimensions.every((name) => has(dimensionRows, 'dimensionMetadata', name)) &&
    report.metrics.every((name) => has(metricRows, 'metricMetadata', name));
}

function restricted(body: unknown): boolean {
  const metadata = record(record(body)?.metadata);
  const restrictions = record(metadata?.schemaRestrictionResponse)?.activeMetricRestrictions;
  return Array.isArray(restrictions) && restrictions.some((item) => {
    const types = record(item)?.restrictedMetricTypes;
    return Array.isArray(types) && types.some((type) => type === 'REVENUE_DATA' || type === 'COST_DATA');
  });
}
function rowsOf(body: unknown): unknown[] | null {
  const response = record(body);
  if (!response || !record(response.metadata) || (response.rows !== undefined && !Array.isArray(response.rows))) {
    return null;
  }
  return (response.rows ?? []) as unknown[];
}
function positiveMetric(row: unknown): boolean {
  const value = record(row)?.metricValues;
  if (!Array.isArray(value)) return false;
  return value.some((cell) => {
    const raw = record(cell)?.value;
    return typeof raw === 'string' && Number.isFinite(Number(raw)) && Number(raw) > 0;
  });
}
function dimensionValue(row: unknown): string | null {
  const values = record(row)?.dimensionValues;
  return Array.isArray(values) && typeof record(values[0])?.value === 'string'
    ? record(values[0])!.value as string : null;
}
function dayShift(day: string, delta: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Ga4ApiError('consulta_invalida', 'own_error');
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) {
    throw new Ga4ApiError('consulta_invalida', 'own_error');
  }
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export type Ga4PreflightResult = Readonly<{
  property: Ga4Property;
  capabilities: Readonly<Record<Ga4Capability, Ga4CapabilityResult>>;
  targetReports: readonly Ga4ReportId[];
  canSync: boolean;
  calls: number;
  checkedAt: string;
}>;

export async function runGa4Preflight(input: {
  propertyId: string; token: SecretValue; http: Ga4Http; today: string; now?: () => Date;
}): Promise<Ga4PreflightResult> {
  const { propertyId, token, http } = input;
  let calls = 0;
  const call = async <T>(operation: () => Promise<T>): Promise<T> => {
    if (calls >= 12) throw new Ga4ApiError('cuota', 'rate_limit');
    calls += 1;
    return operation();
  };
  const property = parseProperty(await call(() => http.getAdmin(`properties/${propertyId}`, token)), propertyId);
  if (!property) throw new Ga4ApiError('propiedad_no_disponible', 'asset_access');
  const streams = record(await call(() => http.getAdmin(`properties/${propertyId}/dataStreams`, token,
    { pageSize: '200' })));
  if (!streams || !Array.isArray(streams.dataStreams) || !streams.dataStreams.some((item) => {
    const row = record(item);
    return row?.type === 'WEB_DATA_STREAM' && normalizeSiteHost(record(row.webStreamData)?.defaultUri);
  })) throw new Ga4ApiError('propiedad_no_disponible', 'asset_access');
  const metadata = await call(() => http.getMetadata(propertyId, token));

  const reportStates = new Map<Ga4ReportId, Ga4CapabilityResult>();
  for (const report of GA4_REPORT_CATALOG) {
    if (!metadataHas(metadata, report)) {
      reportStates.set(report.id, absent('incompatible', 'metadata_ausente'));
      continue;
    }
    const request: Record<string, unknown> = {
      dimensions: report.dimensions.map((name) => ({ name })),
      metrics: report.metrics.map((name) => ({ name })),
      ...(report.dimensionFilter ? { dimensionFilter: report.dimensionFilter } : {}),
    };
    try {
      const response = await call(() => http.checkCompatibility(propertyId, token, request));
      reportStates.set(report.id, compatible(response, report)
        ? available() : absent('incompatible', 'combinacion_incompatible'));
    } catch (error) {
      if (error instanceof Ga4ApiError && error.kind === 'consulta_invalida') {
        reportStates.set(report.id, absent('incompatible', 'consulta_invalida'));
      } else throw error;
    }
  }

  const probeRange = { startDate: dayShift(input.today, -28), endDate: dayShift(input.today, -1) };
  const probe = async (capability: 'embudo' | 'productos' | 'campanias',
    dimensions: string[], metrics: string[], dimensionFilter: Filter) => {
    const report = GA4_REPORT_CATALOG.find((entry) => entry.capability === capability)!;
    if (reportStates.get(report.id)?.status !== 'disponible') return;
    const response = await call(() => http.runReport(propertyId, token, {
      dimensions: dimensions.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })),
      dimensionFilter, dateRanges: [probeRange], limit: '100', returnPropertyQuota: true,
    }));
    if (restricted(response)) {
      reportStates.set(report.id, absent('restringida', 'datos_restringidos'));
      return;
    }
    const rows = rowsOf(response);
    if (!rows) {
      reportStates.set(report.id, absent('incompatible', 'metadata_incompleta'));
      return;
    }
    const present = capability === 'embudo'
      ? ['view_item', 'purchase'].every((event) => rows.some((row) => dimensionValue(row) === event && positiveMetric(row)))
      : capability === 'productos'
        ? rows.some((row) => Boolean(dimensionValue(row)?.trim()) && positiveMetric(row))
        : rows.some((row) => { const value = dimensionValue(row)?.trim();
          return Boolean(value && value !== '(not set)' && positiveMetric(row)); });
    if (!present) reportStates.set(report.id, absent('sin_instrumentacion', capability === 'embudo'
      ? 'eventos_ausentes' : capability === 'productos' ? 'items_ausentes' : 'utm_ausente'));
  };
  await probe('embudo', ['eventName'], ['eventCount'], GA4_FUNNEL_FILTER);
  await probe('productos', ['itemId'], ['itemsViewed'], notExact('itemId', ''));
  await probe('campanias', ['sessionManualCampaignId'], ['sessions'], GA4_CAMPAIGN_FILTER);

  const state = (id: Ga4ReportId) => reportStates.get(id) ?? absent('incompatible', 'metadata_ausente');
  const traffic = state('ga4_trafico_dia').status !== 'disponible'
    ? state('ga4_trafico_dia') : state('ga4_trafico_fuente');
  const capabilities: Record<Ga4Capability, Ga4CapabilityResult> = {
    trafico: traffic, cohortes: state('ga4_cohortes'), embudo: state('ga4_embudo'),
    productos: state('ga4_productos'), campanias: state('ga4_campanias'),
  };
  const targetReports = GA4_REPORT_CATALOG.filter((report) =>
    reportStates.get(report.id)?.status === 'disponible').map((report) => report.id);
  return { property: { ...property, name: property.name?.slice(0, 100) ?? null },
    capabilities, targetReports, canSync: capabilities.trafico.status === 'disponible' &&
      capabilities.cohortes.status === 'disponible', calls,
    checkedAt: (input.now ?? (() => new Date()))().toISOString() };
}
