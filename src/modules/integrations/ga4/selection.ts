import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireTenantContext, type TenantContext } from '@/modules/tenant/context';
import { UnauthorizedError } from '@/modules/identity/session';
import { NoCompanyError } from '@/modules/company/service';
import { maskExternalAccountId, type IntegrationConnectionRecord } from '../contract';
import { SecretValue } from '../crypto/seal';
import { getCredentialKeyring } from '../crypto/keyring';
import { getWorkerApi, type WorkerApi } from '../db/worker-api';
import { readConnectionRecord } from '../repository/connections';
import { readCredential } from '../repository/credentials';
import { confirmConnection, markNeedsReauth } from '../repository/lifecycle-calls';
import { recordConnectionError } from '../repository/sync-calls';
import { runGa4Preflight } from './reports';
import { ga4LocalDay } from './sync-core';
import { createGa4Http, Ga4ApiError, normalizeSiteHost, parseProperty,
  parseRefreshResponse, propertyIdFromName, readGa4Config, type Ga4Config, type Ga4Http,
  type Ga4Property } from './google';

export type Ga4SelectionDeps = {
  tenant: () => Promise<TenantContext>;
  readConnection: (ctx: TenantContext) => Promise<IntegrationConnectionRecord | null>;
  readStoreDomain: (ctx: TenantContext) => Promise<string | null>;
  readToken: (ctx: TenantContext, id: string) => Promise<SecretValue>;
  config: () => Ga4Config;
  http: Ga4Http;
  workerApi: () => WorkerApi;
  log: (event: { evento: 'ga4_ciclo'; etapa: string; resultado: string; request_id?: string }) => void;
};

/** Solo una conexión activa cambia de estado ante un fallo de Google. */
export async function applyGa4Failure(ctx: TenantContext, connection: IntegrationConnectionRecord,
  error: Ga4ApiError, workerApi: WorkerApi): Promise<void> {
  if (connection.status !== 'active') return;
  const input = { connectionId: connection.id, expectedGeneration: connection.credential_generation,
    errorClass: error.errorClass, message: 'No se pudo consultar GA4.' };
  if (['authentication', 'permission', 'asset_access'].includes(error.errorClass)) {
    await markNeedsReauth(ctx, input, { workerApi });
  } else {
    await recordConnectionError(ctx, input, { workerApi });
  }
}

async function defaultStoreDomain(ctx: TenantContext): Promise<string | null> {
  const store = await readConnectionRecord(ctx, {}, 'tiendanube');
  if (!store || store.status !== 'active') return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_tn_sync_status', { p_connection_id: store.id });
  if (error) throw new Error('No se pudo leer el dominio de la tienda.');
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const domain = (row as Record<string, unknown>).store_domain;
  return typeof domain === 'string' ? domain : null;
}

function depsOf(partial: Partial<Ga4SelectionDeps> = {}): Ga4SelectionDeps {
  return {
    tenant: partial.tenant ?? requireTenantContext,
    readConnection: partial.readConnection ?? ((ctx) => readConnectionRecord(ctx, {}, 'ga4')),
    readStoreDomain: partial.readStoreDomain ?? defaultStoreDomain,
    readToken: partial.readToken ?? (async (ctx, id) => (await readCredential(ctx, id,
      { provider: 'ga4', keyring: getCredentialKeyring() })).token),
    config: partial.config ?? readGa4Config,
    http: partial.http ?? createGa4Http(),
    workerApi: partial.workerApi ?? getWorkerApi,
    log: partial.log ?? ((event) => console.info(JSON.stringify(event))),
  };
}

/** Crea una clave opaca (hash) para elegir una propiedad sin mandar su ID al navegador. */
export function selectionKeyFor(connectionId: string, propertyId: string): string {
  return createHash('sha256').update(`${connectionId}:${propertyId}`, 'utf8').digest('hex');
}
function sameKey(a: string, b: string): boolean {
  return /^[0-9a-f]{64}$/.test(a) && /^[0-9a-f]{64}$/.test(b) &&
    timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Saca los dominios de los sitios web asociados a la propiedad. */
export function parseWebStreamHosts(body: unknown): string[] {
  const value = record(body);
  if (!value || (value.dataStreams !== undefined && !Array.isArray(value.dataStreams))) {
    throw new Ga4ApiError('desconocido', 'unknown');
  }
  const hosts = new Set<string>();
  for (const stream of (value.dataStreams ?? []) as unknown[]) {
    const row = record(stream);
    if (row?.type !== 'WEB_DATA_STREAM') continue;
    const web = record(row.webStreamData);
    const host = normalizeSiteHost(web?.defaultUri);
    if (host) hosts.add(host);
  }
  return [...hosts].sort();
}
/** Dice si la propiedad de GA4 corresponde al dominio de tu tienda. */
export function siteMatch(hosts: readonly string[], storeDomain: string | null): boolean {
  const domain = normalizeSiteHost(storeDomain?.includes('://') ? storeDomain :
    storeDomain ? `https://${storeDomain}` : null);
  return domain !== null && hosts.includes(domain);
}

export type Ga4PropertyOption = Readonly<{ selectionKey: string; name: string | null; maskedId: string }>;
async function optionsFor(connectionId: string, token: SecretValue, http: Ga4Http): Promise<readonly Ga4PropertyOption[]> {
  const options = new Map<string, Ga4PropertyOption>();
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const body = record(await http.getAdmin('accountSummaries', token,
      { pageSize: '200', ...(pageToken ? { pageToken } : {}) }));
    if (!body || (body.accountSummaries !== undefined && !Array.isArray(body.accountSummaries))) {
      throw new Ga4ApiError('desconocido', 'unknown');
    }
    for (const account of (body.accountSummaries ?? []) as unknown[]) {
      const properties = record(account)?.propertySummaries;
      if (!Array.isArray(properties)) continue;
      for (const item of properties) {
        const row = record(item);
        if (!row || row.propertyType !== 'PROPERTY_TYPE_ORDINARY') continue;
        const id = propertyIdFromName(row.property);
        if (!id) continue;
        options.set(id, { selectionKey: selectionKeyFor(connectionId, id),
          name: typeof row.displayName === 'string' ? row.displayName.slice(0, 120) : null,
          maskedId: maskExternalAccountId(id) });
      }
    }
    if (typeof body.nextPageToken !== 'string' || body.nextPageToken === '') return [...options.values()];
    pageToken = body.nextPageToken;
  }
  throw new Ga4ApiError('desconocido', 'unknown');
}

async function accessFor(ctx: TenantContext, connection: IntegrationConnectionRecord, deps: Ga4SelectionDeps):
Promise<SecretValue> {
  const refresh = await deps.readToken(ctx, connection.id);
  try {
    const token = parseRefreshResponse(await deps.http.refresh(refresh, deps.config()));
    if (token.rotated) deps.log({ evento: 'ga4_ciclo', etapa: 'refresh', resultado: 'rotacion_descartada',
      request_id: ctx.request_id });
    return token.accessToken;
  } catch (error) {
    if (error instanceof Ga4ApiError) await applyGa4Failure(ctx, connection, error, deps.workerApi());
    throw error;
  }
}

async function pending(ctx: TenantContext, deps: Ga4SelectionDeps) {
  const connection = await deps.readConnection(ctx);
  if (!connection || connection.status !== 'pending_selection') return null;
  const token = await accessFor(ctx, connection, deps);
  return { connection, token, options: await optionsFor(connection.id, token, deps.http) };
}

/** Lista las propiedades de GA4 que podés elegir. */
export async function listGa4Properties(partial: Partial<Ga4SelectionDeps> = {}):
Promise<readonly Ga4PropertyOption[]> {
  const deps = depsOf(partial);
  const ctx = await deps.tenant();
  const state = await pending(ctx, deps);
  return state?.options ?? [];
}

async function propertyFor(state: NonNullable<Awaited<ReturnType<typeof pending>>>, key: string,
  deps: Ga4SelectionDeps): Promise<{ property: Ga4Property; hosts: string[] } | null> {
  const option = state.options.find((entry) => sameKey(entry.selectionKey, key));
  if (!option) return null;
  // La clave no trae el ID: la lista se reconsulta y se busca el valor correspondiente.
  // `maskedId` no se usa para recuperar el ID.
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const body = record(await deps.http.getAdmin('accountSummaries', state.token,
      { pageSize: '200', ...(pageToken ? { pageToken } : {}) }));
    if (!body || (body.accountSummaries !== undefined && !Array.isArray(body.accountSummaries))) {
      throw new Ga4ApiError('desconocido', 'unknown');
    }
    for (const account of (body.accountSummaries ?? []) as unknown[]) {
      const properties = record(account)?.propertySummaries;
      if (!Array.isArray(properties)) continue;
      for (const item of properties) {
        const row = record(item);
        if (!row || row.propertyType !== 'PROPERTY_TYPE_ORDINARY') continue;
        const id = propertyIdFromName(row.property);
        if (!id || !sameKey(selectionKeyFor(state.connection.id, id), key)) continue;
        const property = parseProperty(await deps.http.getAdmin(`properties/${id}`, state.token), id);
        if (!property) return null;
        const hosts = new Set<string>();
        let streamPage: string | undefined;
        for (let streamIndex = 0; streamIndex < 10; streamIndex += 1) {
          const streamBody = record(await deps.http.getAdmin(`properties/${id}/dataStreams`, state.token,
            { pageSize: '200', ...(streamPage ? { pageToken: streamPage } : {}) }));
          if (!streamBody) throw new Ga4ApiError('desconocido', 'unknown');
          for (const host of parseWebStreamHosts(streamBody)) hosts.add(host);
          if (typeof streamBody.nextPageToken !== 'string' || streamBody.nextPageToken === '') {
            return { property, hosts: [...hosts].sort() };
          }
          streamPage = streamBody.nextPageToken;
        }
        throw new Ga4ApiError('desconocido', 'unknown');
      }
    }
    if (typeof body.nextPageToken !== 'string' || body.nextPageToken === '') return null;
    pageToken = body.nextPageToken;
  }
  return null;
}

export type Ga4PropertyPreview = Readonly<{ name: string | null; maskedId: string;
  hosts: readonly string[]; storeHost: string | null; matchesStore: boolean }>;
/** Vista previa de una propiedad antes de confirmarla. */
export async function previewGa4Property(selectionKey: string,
  partial: Partial<Ga4SelectionDeps> = {}): Promise<Ga4PropertyPreview | null> {
  const deps = depsOf(partial);
  const ctx = await deps.tenant();
  const state = await pending(ctx, deps);
  if (!state) return null;
  const selected = await propertyFor(state, selectionKey, deps);
  if (!selected || selected.hosts.length === 0) return null;
  const storeDomain = await deps.readStoreDomain(ctx);
  const storeHost = normalizeSiteHost(storeDomain?.includes('://') ? storeDomain :
    storeDomain ? `https://${storeDomain}` : null);
  return { name: selected.property.name, maskedId: maskExternalAccountId(selected.property.id),
    hosts: selected.hosts, storeHost, matchesStore: siteMatch(selected.hosts, storeDomain) };
}

export type Ga4ConfirmOutcome = 'conectado' | 'propiedad_no_disponible' | 'confirmacion_requerida' |
  'sin_flujo_web' | 'informe_base_no_disponible' | 'rechazado' | 'sin_empresa' | 'error';
/** Confirma la propiedad elegida y deja la conexión activa. */
export async function confirmGa4Property(selectionKey: string, siteConfirmed: boolean,
  partial: Partial<Ga4SelectionDeps> = {}): Promise<Ga4ConfirmOutcome> {
  const deps = depsOf(partial);
  let ctx: TenantContext;
  try { ctx = await deps.tenant(); }
  catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    return error instanceof NoCompanyError ? 'sin_empresa' : 'error';
  }
  try {
    const state = await pending(ctx, deps);
    if (!state) return 'rechazado';
    const selected = await propertyFor(state, selectionKey, deps);
    if (!selected) return 'propiedad_no_disponible';
    if (selected.hosts.length === 0) return 'sin_flujo_web';
    if (!siteConfirmed) return 'confirmacion_requerida';
    const preflight = await runGa4Preflight({ propertyId: selected.property.id, token: state.token,
      http: deps.http, today: ga4LocalDay(new Date(), selected.property.timezone) });
    if (!preflight.canSync) return 'informe_base_no_disponible';
    await confirmConnection(ctx, { connectionId: state.connection.id,
      externalAccountId: selected.property.id, currency: selected.property.currency,
      timezone: selected.property.timezone }, { workerApi: deps.workerApi() });
    deps.log({ evento: 'ga4_ciclo', etapa: 'confirmacion', resultado: 'ok', request_id: ctx.request_id });
    return 'conectado';
  } catch { return 'error'; }
}
