import 'server-only';

import {
  REQUIRED_SCOPE,
  clientBusinessIdSchema,
  secretCredentialSchema,
  type TokenType,
} from '@/modules/integrations/contract';
import { isoDateTimeSchema } from '@/modules/integrations/contract/primitives';
import { SecretValue } from '../crypto/seal';
import { graphUrl, type MetaOAuthConfig } from './api';
import { MetaApiError } from './errors';
import type { MetaHttpClient } from './client';

/**
 * Inspección del token (CA-31, CA-32) y negocio cliente (`/me`).
 *
 * `debug_token` va por `POST` con el token nuevo y el token de app en el cuerpo, y `/me`
 * lleva el token solo en `Authorization` (D-M16.1-08). No hay camino por `GET` con el token
 * en la URL: si Meta rechaza la forma elegida, el error se clasifica como cualquier otro.
 */

export type ValidatedToken = Readonly<{
  tokenType: TokenType;
  issuedForAppId: string;
  grantedScopes: readonly string[];
  expiresAt: string | null;
}>;

export type TokenRejectionReason = 'invalid' | 'wrong_app' | 'missing_ads_read' | 'unsupported_type' | 'missing_business';

const REJECTION_TEXTS: Record<TokenRejectionReason, string> = {
  invalid: 'Meta informó que el token no es válido.',
  wrong_app: 'El token fue emitido para otra app.',
  missing_ads_read: 'El token no tiene el permiso de lectura de anuncios.',
  unsupported_type: 'El tipo de token no está admitido.',
  missing_business: 'Meta no informó el negocio cliente.',
};

export class TokenRejectedError extends Error {
  readonly reason: TokenRejectionReason;

  constructor(reason: TokenRejectionReason) {
    super(REJECTION_TEXTS[reason]);
    this.name = 'TokenRejectedError';
    this.reason = reason;
  }
}

/** H-02: el único tipo admitido es el de system user; cualquier otro se rechaza (DEC-02). */
const SYSTEM_USER_TYPE = 'SYSTEM_USER';
/** Forma de un permiso según el contrato K04, sin copiar su regla. */
const scopeSchema = secretCredentialSchema.shape.granted_scopes.element;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** CA-31: la expiración real, o `null` si Meta no la informa o no es una fecha usable. */
function expiresAtOf(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value * 1000);
  if (!Number.isFinite(date.getTime())) return null;
  const iso = date.toISOString();
  // Un año de más de cuatro cifras no es una fecha ISO que la base acepte.
  return isoDateTimeSchema.safeParse(iso).success ? iso : null;
}

export async function inspectToken(
  token: SecretValue,
  deps: { http: MetaHttpClient; config: MetaOAuthConfig },
): Promise<ValidatedToken> {
  const appToken = new SecretValue(`${deps.config.appId}|${deps.config.appSecret.reveal()}`);
  const body = await deps.http.postBatchGetJson('debug_token', { input_token: token }, appToken);
  const data = record(record(body)?.data);
  if (!data || data.is_valid !== true) throw new TokenRejectedError('invalid');
  if (String(data.app_id) !== deps.config.appId) throw new TokenRejectedError('wrong_app');
  if (!Array.isArray(data.scopes) || !data.scopes.includes(REQUIRED_SCOPE)) {
    throw new TokenRejectedError('missing_ads_read');
  }
  if (data.type !== SYSTEM_USER_TYPE) throw new TokenRejectedError('unsupported_type');

  // `ads_read` ya está y tiene la forma del contrato; el repositorio de credenciales vuelve a
  // validar la lista completa antes de escribir.
  const grantedScopes = [...new Set(data.scopes.filter((scope) => scopeSchema.safeParse(scope).success))] as string[];

  return Object.freeze({
    tokenType: 'system_user',
    issuedForAppId: deps.config.appId,
    grantedScopes: Object.freeze(grantedScopes),
    expiresAt: expiresAtOf(data.expires_at),
  });
}

export type SystemUser = Readonly<{ id: string; clientBusinessId: string }>;

export async function fetchSystemUser(token: SecretValue, deps: { http: MetaHttpClient }): Promise<SystemUser> {
  const body = await deps.http.getJson(graphUrl('me', { fields: 'id,client_business_id' }), { bearer: token });
  const fields = record(body);
  const parsed = clientBusinessIdSchema.safeParse(fields?.client_business_id);
  const id = typeof fields?.id === 'number' && Number.isSafeInteger(fields.id)
    ? String(fields.id) : fields?.id;
  if (!parsed.success || typeof id !== 'string' || !/^[0-9]{1,32}$/.test(id)) {
    throw new TokenRejectedError('missing_business');
  }
  return Object.freeze({ id, clientBusinessId: parsed.data });
}

export async function fetchClientBusinessId(token: SecretValue, deps: { http: MetaHttpClient }): Promise<string> {
  return (await fetchSystemUser(token, deps)).clientBusinessId;
}

/** Canje por POST con todo en el cuerpo; el código de un solo uso no se reintenta. */
export async function exchangeCodeForToken(
  code: string,
  deps: { http: MetaHttpClient; config: MetaOAuthConfig },
): Promise<SecretValue> {
  const body = await deps.http.postFormJson(graphUrl('oauth/access_token'), {
    client_id: deps.config.appId,
    redirect_uri: deps.config.redirectUri,
    client_secret: deps.config.appSecret,
    code: new SecretValue(code),
  });
  const token = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as { access_token?: unknown }).access_token : undefined;
  if (typeof token !== 'string' || token === '') {
    throw new MetaApiError({ errorClass: 'unknown', graphCode: null, graphSubcode: null });
  }
  return new SecretValue(token);
}
