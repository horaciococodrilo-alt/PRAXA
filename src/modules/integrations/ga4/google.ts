import { currencyCodeSchema, timeZoneSchema } from '../contract';
import { GA4_READONLY_SCOPE } from '../contract/credential';
import { SecretValue } from '../crypto/seal';

export const GA4_SCOPE = GA4_READONLY_SCOPE;
export const GA4_PROPERTY_ID = /^[1-9][0-9]{0,19}$/;
export const GA4_HTTP_TIMEOUT_MS = 10_000;

export type Ga4Config = Readonly<{ clientId: string; clientSecret: string; redirectUri: string; appId: string }>;
export type Ga4ErrorKind = 'autorizacion_perdida' | 'sin_acceso_propiedad' | 'cuota' |
  'transitorio' | 'transporte' | 'consulta_invalida' | 'propiedad_no_disponible' | 'desconocido';
export type Ga4ErrorClass = 'authentication' | 'permission' | 'rate_limit' | 'temporary' | 'transport' |
  'own_error' | 'asset_access' | 'unknown';

/** Error de una llamada a Google, con su tipo. */
export class Ga4ApiError extends Error {
  constructor(readonly kind: Ga4ErrorKind, readonly errorClass: Ga4ErrorClass) {
    super('No se pudo completar la operación de GA4.');
    this.name = 'Ga4ApiError';
  }
}

/** Error que se lanza cuando Google devolvió una autorización incompleta. */
export class Ga4TokenRejectedError extends Error {
  constructor() { super('Autorización de Google incompleta.'); this.name = 'Ga4TokenRejectedError'; }
}

/** Traduce un código HTTP de Google (401, 403, 404, 429…) a un tipo de error. */
export function classifyGa4Error(status: number): { kind: Ga4ErrorKind; errorClass: Ga4ErrorClass } {
  if (status === 401) return { kind: 'autorizacion_perdida', errorClass: 'authentication' };
  if (status === 403) return { kind: 'sin_acceso_propiedad', errorClass: 'permission' };
  if (status === 404) return { kind: 'propiedad_no_disponible', errorClass: 'asset_access' };
  if (status === 429) return { kind: 'cuota', errorClass: 'rate_limit' };
  if (status === 500 || status === 503 || status === 504) return { kind: 'transitorio', errorClass: 'temporary' };
  if (status === 400) return { kind: 'consulta_invalida', errorClass: 'own_error' };
  return { kind: 'desconocido', errorClass: 'unknown' };
}

/** Lee y valida la configuración de Google desde las variables de entorno. */
export function readGa4Config(env: NodeJS.ProcessEnv = process.env): Ga4Config {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID ?? '';
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET ?? '';
  const redirectUri = env.GOOGLE_OAUTH_REDIRECT_URI ?? '';
  const match = /^([1-9][0-9]*)-[a-z0-9]+\.apps\.googleusercontent\.com$/.exec(clientId);
  let url: URL;
  try { url = new URL(redirectUri); } catch { throw new Error('Configuración GA4 inválida.'); }
  if (!match || !clientSecret || !['https:', 'http:'].includes(url.protocol) ||
      (url.protocol === 'http:' && url.hostname !== 'localhost') ||
      url.pathname !== '/api/integraciones/ga4/callback' || url.search || url.hash) {
    throw new Error('Configuración GA4 inválida.');
  }
  return { clientId, clientSecret, redirectUri: url.toString(), appId: match[1] };
}

/** Arma la URL a la que vas para autorizar a PRAXA en Google. */
export function authorizationUrl(config: Ga4Config, state: string): URL {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GA4_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return url;
}

function record(input: unknown): Record<string, unknown> | null {
  return input !== null && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : null;
}

function validToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096 && !/\s/.test(value);
}

/** Valida la respuesta del canje del código: token de acceso y refresh token, con el permiso correcto. */
export function parseTokenExchange(body: unknown): { accessToken: SecretValue; refreshToken: SecretValue } {
  const value = record(body);
  if (!value || !validToken(value.access_token) || !validToken(value.refresh_token) ||
      value.scope !== GA4_SCOPE || value.token_type !== 'Bearer' ||
      typeof value.expires_in !== 'number' || !Number.isFinite(value.expires_in) || value.expires_in <= 0) {
    throw new Ga4TokenRejectedError();
  }
  return { accessToken: new SecretValue(value.access_token), refreshToken: new SecretValue(value.refresh_token) };
}

/** Valida la respuesta al pedir un token de acceso nuevo con el refresh token. */
export function parseRefreshResponse(body: unknown): { accessToken: SecretValue; rotated: boolean } {
  const value = record(body);
  if (!value || !validToken(value.access_token) || value.token_type !== 'Bearer' ||
      (value.scope !== undefined && value.scope !== GA4_SCOPE) ||
      typeof value.expires_in !== 'number' || !Number.isFinite(value.expires_in) || value.expires_in <= 0) {
    throw new Ga4TokenRejectedError();
  }
  return { accessToken: new SecretValue(value.access_token), rotated: validToken(value.refresh_token) };
}

/** Saca el ID de la propiedad de un nombre como "properties/123". */
export function propertyIdFromName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^properties\/(.+)$/.exec(value);
  return match && GA4_PROPERTY_ID.test(match[1]) ? match[1] : null;
}

/** Deja un dominio en forma comparable: sin https, sin www y en minúsculas. */
export function normalizeSiteHost(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch { return null; }
}

export type Ga4Property = Readonly<{ id: string; name: string | null; currency: string; timezone: string }>;
/** Valida los datos de una propiedad de GA4 (moneda, zona horaria). Null si no sirve. */
export function parseProperty(body: unknown, expectedId: string): Ga4Property | null {
  const value = record(body);
  if (!value || propertyIdFromName(value.name) !== expectedId || value.deleteTime !== undefined ||
      value.propertyType !== 'PROPERTY_TYPE_ORDINARY') return null;
  const currency = currencyCodeSchema.safeParse(value.currencyCode);
  const timezone = timeZoneSchema.safeParse(value.timeZone);
  if (!currency.success || !timezone.success) return null;
  return { id: expectedId, name: typeof value.displayName === 'string' ? value.displayName : null,
    currency: currency.data, timezone: timezone.data };
}

type Fetch = (input: URL, init: RequestInit) => Promise<Response>;
export type Ga4Http = Readonly<{
  exchangeCode: (code: string, config: Ga4Config) => Promise<unknown>;
  refresh: (refreshToken: SecretValue, config: Ga4Config) => Promise<unknown>;
  getAdmin: (path: string, token: SecretValue, query?: Record<string, string>) => Promise<unknown>;
  getMetadata: (propertyId: string, token: SecretValue) => Promise<unknown>;
  checkCompatibility: (propertyId: string, token: SecretValue, body: Record<string, unknown>) => Promise<unknown>;
  runReport: (propertyId: string, token: SecretValue, body: Record<string, unknown>) => Promise<unknown>;
}>;

/** Crea el cliente HTTP para hablar con Google, con tiempo límite y errores clasificados. */
export function createGa4Http(fetcher: Fetch = fetch): Ga4Http {
  async function request(url: URL, init: RequestInit): Promise<unknown> {
    let response: Response;
    try { response = await fetcher(url, { ...init, signal: AbortSignal.timeout(GA4_HTTP_TIMEOUT_MS), redirect: 'error' }); }
    catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') throw new Ga4ApiError('transitorio', 'temporary');
      throw new Ga4ApiError('transporte', 'transport');
    }
    if (!response.ok) {
      // Google puede devolver `invalid_grant` en refresh. No se registra el cuerpo.
      if (url.host === 'oauth2.googleapis.com' && response.status === 400) {
        let body: unknown;
        try { body = await response.json(); } catch { /* respuesta inválida */ }
        if (record(body)?.error === 'invalid_grant') throw new Ga4ApiError('autorizacion_perdida', 'authentication');
      }
      const type = classifyGa4Error(response.status);
      throw new Ga4ApiError(type.kind, type.errorClass);
    }
    try { return await response.json(); }
    catch { throw new Ga4ApiError('desconocido', 'unknown'); }
  }
  function dataUrl(propertyId: string, suffix: string): URL {
    if (!GA4_PROPERTY_ID.test(propertyId)) throw new Ga4ApiError('consulta_invalida', 'own_error');
    return new URL(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}${suffix}`);
  }
  function dataPost(propertyId: string, suffix: string, token: SecretValue,
    body: Record<string, unknown>): Promise<unknown> {
    return request(dataUrl(propertyId, suffix), { method: 'POST',
      headers: { Authorization: `Bearer ${token.reveal()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body) });
  }
  return {
    exchangeCode: (code, config) => request(new URL('https://oauth2.googleapis.com/token'), {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret,
        redirect_uri: config.redirectUri, grant_type: 'authorization_code' }),
    }),
    refresh: (token, config) => request(new URL('https://oauth2.googleapis.com/token'), {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: token.reveal(), client_id: config.clientId,
        client_secret: config.clientSecret, grant_type: 'refresh_token' }),
    }),
    getAdmin: (path, token, query = {}) => {
      if (!/^(?:accountSummaries|properties\/[1-9][0-9]{0,19}(?:\/dataStreams)?)$/.test(path)) {
        throw new Ga4ApiError('consulta_invalida', 'own_error');
      }
      const url = new URL(`https://analyticsadmin.googleapis.com/v1beta/${path}`);
      for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
      return request(url, { method: 'GET', headers: { Authorization: `Bearer ${token.reveal()}` } });
    },
    getMetadata: (propertyId, token) => request(dataUrl(propertyId, '/metadata'),
      { method: 'GET', headers: { Authorization: `Bearer ${token.reveal()}` } }),
    checkCompatibility: (propertyId, token, body) => dataPost(propertyId, ':checkCompatibility', token, body),
    runReport: (propertyId, token, body) => dataPost(propertyId, ':runReport', token, body),
  };
}
