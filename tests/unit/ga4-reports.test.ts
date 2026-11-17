import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { SecretValue } from '@/modules/integrations/crypto/seal';
import { GA4_REPORT_CATALOG, runGa4Preflight } from '@/modules/integrations/ga4/reports';
import type { Ga4Http } from '@/modules/integrations/ga4/google';

const token = new SecretValue('access-synthetic');
const propertyId = '12345';
const names = (values: readonly string[]) => values.map((apiName) => ({ apiName }));

function harness(input: {
  missingMetric?: string; incompatible?: string; restricted?: string;
  noFunnelPurchase?: boolean; noProducts?: boolean; noUtm?: boolean;
} = {}) {
  const calls: Array<{ method: string; request?: unknown }> = [];
  const reports = GA4_REPORT_CATALOG;
  const allDimensions = [...new Set(reports.flatMap((r) => r.dimensions))];
  const allMetrics = [...new Set(reports.flatMap((r) => r.metrics))].filter((x) => x !== input.missingMetric);
  const http: Ga4Http = {
    exchangeCode: async () => { throw new Error('No corresponde.'); },
    refresh: async () => { throw new Error('No corresponde.'); },
    getAdmin: async (path) => {
      calls.push({ method: path });
      if (path === `properties/${propertyId}`) return { name: `properties/${propertyId}`,
        propertyType: 'PROPERTY_TYPE_ORDINARY', displayName: 'Shop',
        currencyCode: 'ARS', timeZone: 'America/Argentina/Buenos_Aires' };
      if (path === `properties/${propertyId}/dataStreams`) return { dataStreams: [
        { type: 'WEB_DATA_STREAM', webStreamData: { defaultUri: 'https://shop.test' } },
      ] };
      throw new Error('Ruta Admin inesperada.');
    },
    getMetadata: async () => {
      calls.push({ method: 'getMetadata' });
      return { dimensions: names(allDimensions), metrics: names(allMetrics) };
    },
    checkCompatibility: async (_id, _token, request) => {
      calls.push({ method: 'checkCompatibility', request });
      const body = request as { dimensions: Array<{ name: string }>; metrics: Array<{ name: string }> };
      return { dimensionCompatibilities: body.dimensions.map(({ name }) => ({
        dimensionMetadata: { apiName: name }, compatibility: name === input.incompatible ? 'INCOMPATIBLE' : 'COMPATIBLE',
      })), metricCompatibilities: body.metrics.map(({ name }) => ({
        metricMetadata: { apiName: name }, compatibility: name === input.incompatible ? 'INCOMPATIBLE' : 'COMPATIBLE',
      })) };
    },
    runReport: async (_id, _token, request) => {
      calls.push({ method: 'runReport', request });
      const body = request as { dimensions: Array<{ name: string }> };
      const dimension = body.dimensions.map((x) => x.name);
      const report = dimension.includes('eventName') ? 'embudo' : dimension.includes('itemId') ? 'productos' : 'campanias';
      const rows = report === 'embudo' ? [
        { dimensionValues: [{ value: 'view_item' }], metricValues: [{ value: '2' }] },
        ...(input.noFunnelPurchase ? [] : [{ dimensionValues: [{ value: 'purchase' }], metricValues: [{ value: '1' }] }]),
      ] : report === 'productos' ? (input.noProducts ? [] : [
        { dimensionValues: [{ value: 'sku-synthetic' }], metricValues: [{ value: '1' }] },
      ]) : (input.noUtm ? [] : [
        { dimensionValues: [{ value: 'campaign-synthetic' }], metricValues: [{ value: '1' }] },
      ]);
      return { rows, metadata: report === input.restricted ? {
        schemaRestrictionResponse: { activeMetricRestrictions: [{ restrictedMetricTypes: ['REVENUE_DATA'] }] },
      } : {} };
    },
  };
  return { http, calls };
}

describe('catálogo y preflight GA4', () => {
  it('define exactamente seis informes versionados y tres obligatorios', () => {
    expect(GA4_REPORT_CATALOG.map((r) => r.id)).toEqual([
      'ga4_trafico_dia', 'ga4_trafico_fuente', 'ga4_campanias',
      'ga4_embudo', 'ga4_productos', 'ga4_cohortes',
    ]);
    expect(GA4_REPORT_CATALOG.every((r) => r.version === 1)).toBe(true);
    expect(GA4_REPORT_CATALOG.filter((r) => r.required).map((r) => r.id)).toEqual([
      'ga4_trafico_dia', 'ga4_trafico_fuente', 'ga4_cohortes',
    ]);
  });

  it('habilita los informes completos sin enviar cuota en Admin, Metadata ni compatibilidad', async () => {
    const { http, calls } = harness();
    const result = await runGa4Preflight({ propertyId, token, http, today: '2026-11-16' });
    expect(result.canSync).toBe(true);
    expect(result.targetReports).toHaveLength(6);
    expect(Object.values(result.capabilities).every((v) => v.status === 'disponible')).toBe(true);
    expect(calls).toHaveLength(12);
    expect(calls.filter((c) => c.method === 'runReport')).toHaveLength(3);
    expect(calls.filter((c) => c.method !== 'runReport').every((c) =>
      !(JSON.stringify(c.request) ?? '').includes('returnPropertyQuota'))).toBe(true);
  });

  it('separa faltas de metadata, incompatibilidad, restricción y falta de instrumentación', async () => {
    const missing = await runGa4Preflight({ propertyId, token, http: harness({ missingMetric: 'itemsPurchased' }).http,
      today: '2026-11-16' });
    expect(missing.capabilities.productos.status).toBe('incompatible');
    expect(missing.capabilities.trafico.status).toBe('disponible');
    expect(missing.targetReports).not.toContain('ga4_productos');

    const incompatible = await runGa4Preflight({ propertyId, token,
      http: harness({ incompatible: 'cohortNthMonth' }).http, today: '2026-11-16' });
    expect(incompatible.capabilities.cohortes.status).toBe('incompatible');
    expect(incompatible.canSync).toBe(false);

    const restricted = await runGa4Preflight({ propertyId, token,
      http: harness({ restricted: 'embudo' }).http, today: '2026-11-16' });
    expect(restricted.capabilities.embudo.status).toBe('restringida');
    expect(restricted.capabilities.trafico.status).toBe('disponible');

    const absent = await runGa4Preflight({ propertyId, token,
      http: harness({ noFunnelPurchase: true, noProducts: true, noUtm: true }).http, today: '2026-11-16' });
    expect(absent.canSync).toBe(true);
    expect(absent.targetReports).toEqual(['ga4_trafico_dia', 'ga4_trafico_fuente', 'ga4_cohortes']);
    expect(absent.capabilities.embudo.status).toBe('sin_instrumentacion');
    expect(absent.capabilities.productos.status).toBe('sin_instrumentacion');
    expect(absent.capabilities.campanias.status).toBe('sin_instrumentacion');
  });
});
