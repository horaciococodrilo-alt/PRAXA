import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createHash } from 'node:crypto';
import { selectionKeyFor, siteMatch, parseWebStreamHosts, previewGa4Property,
  confirmGa4Property, applyGa4Failure, type Ga4SelectionDeps } from '@/modules/integrations/ga4/selection';
import { SecretValue } from '@/modules/integrations/crypto/seal';
import { Ga4ApiError } from '@/modules/integrations/ga4/google';
import { GA4_REPORT_CATALOG } from '@/modules/integrations/ga4/reports';
import type { IntegrationConnectionRecord } from '@/modules/integrations/contract';
import type { TenantContext } from '@/modules/tenant/context';
import type { WorkerApi } from '@/modules/integrations/db/worker-api';

const connectionId = '11111111-1111-4111-8111-111111111111';
const context: TenantContext = { user_id: '22222222-2222-4222-8222-222222222222',
  company_id: '33333333-3333-4333-8333-333333333333', role: 'owner',
  request_id: '44444444-4444-4444-8444-444444444444' };
const connection = { id: connectionId, company_id: context.company_id, provider: 'ga4',
  status: 'pending_selection', credential_generation: 0, external_account_id: null,
  client_business_id: null, current_sync_run_id: null, last_error_class: null,
  last_error_message: null, currency: null, timezone: null, created_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z', pending_expires_at: '2026-11-01T00:30:00.000Z',
  purge_requested_at: null } as IntegrationConnectionRecord;

function harness(options: { propertyType?: string; deleted?: boolean; web?: boolean; domain?: string | null } = {}) {
  const calls: string[] = [];
  const workerApi: WorkerApi = { call: (async (fn: string, args: readonly unknown[]) => {
    calls.push(fn);
    if (fn === 'confirm_connection') return [{ connection_id: args[2], status: 'active', credential_generation: 0 }];
    throw new Error('Llamada inesperada.');
  }) as WorkerApi['call'] };
  const deps: Partial<Ga4SelectionDeps> = {
    tenant: async () => context, readConnection: async () => connection,
    readStoreDomain: async () => options.domain === undefined ? 'https://shop.test' : options.domain,
    readToken: async () => new SecretValue('refresh-synthetic'),
    config: () => ({ clientId: '123-example.apps.googleusercontent.com', clientSecret: 'synthetic',
      redirectUri: 'https://praxa.test/api/integraciones/ga4/callback', appId: '123' }),
    workerApi: () => workerApi, log: () => {},
    http: {
      exchangeCode: async () => { throw new Error('No corresponde.'); },
      refresh: async () => ({ access_token: 'access-synthetic', token_type: 'Bearer', expires_in: 3600 }),
      getAdmin: async (path) => {
        if (path === 'accountSummaries') return { accountSummaries: [{ propertySummaries: [
          { property: 'properties/12345', propertyType: options.propertyType ?? 'PROPERTY_TYPE_ORDINARY',
            displayName: 'Shop' },
        ] }] };
        if (path === 'properties/12345') return { name: 'properties/12345', displayName: 'Shop',
          propertyType: options.propertyType ?? 'PROPERTY_TYPE_ORDINARY', currencyCode: 'ARS',
          timeZone: 'America/Argentina/Buenos_Aires', ...(options.deleted ? { deleteTime: '2026-01-01' } : {}) };
        if (path === 'properties/12345/dataStreams') return { dataStreams: options.web === false ? [] : [
          { type: 'WEB_DATA_STREAM', webStreamData: { defaultUri: 'https://www.shop.test' } },
        ] };
        throw new Error('Ruta inesperada.');
      },
      getMetadata: async () => {
        const names = (values: readonly string[]) => values.map((apiName) => ({ apiName }));
        return { dimensions: names([...new Set(GA4_REPORT_CATALOG.flatMap((r) => r.dimensions))]),
          metrics: names([...new Set(GA4_REPORT_CATALOG.flatMap((r) => r.metrics))]) };
      },
      checkCompatibility: async (_id, _token, request) => {
        const d = request.dimensions as Array<{ name: string }>;
        const m = request.metrics as Array<{ name: string }>;
        return { dimensionCompatibilities: d.map((x) => ({ dimensionMetadata: { apiName: x.name },
          compatibility: 'COMPATIBLE' })),
        metricCompatibilities: m.map((x) => ({ metricMetadata: { apiName: x.name },
          compatibility: 'COMPATIBLE' })) };
      },
      runReport: async () => ({ metadata: {}, rows: [] }),
    },
  };
  return { deps, calls };
}

describe('selección de propiedad GA4', () => {
  it('no expone el ID de propiedad en la clave opaca', () => {
    const key = selectionKeyFor('11111111-1111-4111-8111-111111111111', '12345');
    expect(key).toBe(createHash('sha256').update('11111111-1111-4111-8111-111111111111:12345').digest('hex'));
    expect(key).not.toContain('12345');
  });

  it('extrae solo hosts de flujos web y compara sin www ni mayúsculas', () => {
    const hosts = parseWebStreamHosts({ dataStreams: [
      { type: 'WEB_DATA_STREAM', webStreamData: { defaultUri: 'https://WWW.Shop.test/path' } },
      { type: 'ANDROID_APP_DATA_STREAM', webStreamData: { defaultUri: 'https://other.test' } },
    ] });
    expect(hosts).toEqual(['shop.test']);
    expect(siteMatch(hosts, 'https://shop.test')).toBe(true);
    expect(siteMatch(hosts, 'https://different.test')).toBe(false);
    expect(siteMatch(hosts, null)).toBe(false);
  });

  it('rechaza clave inventada, propiedad eliminada y propiedad no ordinaria', async () => {
    const key = selectionKeyFor(connectionId, '12345');
    const wrong = harness();
    expect(await confirmGa4Property(selectionKeyFor(connectionId, '999'), true, wrong.deps)).toBe('propiedad_no_disponible');
    expect(wrong.calls).not.toContain('confirm_connection');
    const deleted = harness({ deleted: true });
    expect(await confirmGa4Property(key, true, deleted.deps)).toBe('propiedad_no_disponible');
    const rollup = harness({ propertyType: 'PROPERTY_TYPE_ROLLUP' });
    expect(await confirmGa4Property(key, true, rollup.deps)).toBe('propiedad_no_disponible');
  });

  it('requiere flujo web y confirmación del dueño aun si coincide el host', async () => {
    const key = selectionKeyFor(connectionId, '12345');
    const noWeb = harness({ web: false });
    expect(await confirmGa4Property(key, true, noWeb.deps)).toBe('sin_flujo_web');
    const same = harness();
    expect((await previewGa4Property(key, same.deps))?.matchesStore).toBe(true);
    expect(await confirmGa4Property(key, false, same.deps)).toBe('confirmacion_requerida');
    expect(same.calls).not.toContain('confirm_connection');
    expect(await confirmGa4Property(key, true, same.deps)).toBe('conectado');
    const different = harness({ domain: 'https://different.test' });
    expect((await previewGa4Property(key, different.deps))?.matchesStore).toBe(false);
    const noStore = harness({ domain: null });
    expect((await previewGa4Property(key, noStore.deps))?.storeHost).toBeNull();
  });

  it('403 activo marca reautorización; pendiente no cambia; cuota solo registra error', async () => {
    const calls: string[] = [];
    const worker: WorkerApi = { call: (async (fn: string, args: readonly unknown[]) => {
      calls.push(fn);
      if (fn === 'mark_needs_reauth') return [{ connection_id: args[2], status: 'needs_reauth',
        credential_generation: 0 }];
      if (fn === 'record_connection_error') return [{ connection_id: args[2], status: 'active',
        credential_generation: 0 }];
      throw new Error('Llamada inesperada.');
    }) as WorkerApi['call'] };
    const denied = new Ga4ApiError('sin_acceso_propiedad', 'permission');
    await applyGa4Failure(context, connection, denied, worker);
    expect(calls).toEqual([]);
    const active = { ...connection, status: 'active', external_account_id: '12345',
      pending_expires_at: null, currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires' } as IntegrationConnectionRecord;
    await applyGa4Failure(context, active, denied, worker);
    await applyGa4Failure(context, active, new Ga4ApiError('cuota', 'rate_limit'), worker);
    expect(calls).toEqual(['mark_needs_reauth', 'record_connection_error']);
  });
});
