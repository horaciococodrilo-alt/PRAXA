import 'server-only';

import { SecretValue } from '../crypto/seal';

/**
 * Único lugar con la versión de la API de Tiendanube, sus orígenes y la configuración
 * `TIENDANUBE_*` (M16e §1).
 *
 * La autorización no lleva `scope` ni `redirect_uri`: los dos se fijan en el Portal de
 * Socios. El control de permisos es la verificación exacta del `scope` que devuelve el canje.
 */

export const TIENDANUBE_API_VERSION = '2025-03';
export const TIENDANUBE_API_ORIGIN = 'https://api.tiendanube.com';
export const TIENDANUBE_AUTH_ORIGIN = 'https://www.tiendanube.com';
export const TIENDANUBE_TOKEN_URL = `${TIENDANUBE_AUTH_ORIGIN}/apps/authorize/token`;
export const TIENDANUBE_CALLBACK_PATH = '/api/integraciones/tiendanube/callback';

export type TiendanubeConfig = Readonly<{
  appId: string;
  /** El ID de la app salvo `TIENDANUBE_CLIENT_ID` (M16e-H-10, confirmada en el Portal). */
  clientId: string;
  clientSecret: SecretValue;
  supportContact: string;
  redirectUri: string;
}>;

/** El mensaje nombra solo variables, nunca valores. */
export class TiendanubeConfigError extends Error {
  constructor(missing: readonly string[], invalid: readonly string[]) {
    const parts = [
      missing.length > 0 ? `Falta configuración de Tiendanube: ${missing.join(', ')}.` : '',
      invalid.length > 0 ? `Configuración de Tiendanube inválida: ${invalid.join(', ')}.` : '',
    ];
    super(parts.filter(Boolean).join(' '));
    this.name = 'TiendanubeConfigError';
  }
}

const NUMERIC_ID = /^[1-9][0-9]{0,19}$/;
const EMAIL = /^[^\s@()]+@[^\s@()]+\.[^\s@()]+$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function validContact(value: string): boolean {
  if (EMAIL.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !/[()\s]/.test(value);
  } catch {
    return false;
  }
}

function validRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username !== '' || url.password !== '') return false;
  if (url.search !== '' || url.hash !== '' || value.includes('?') || value.includes('#')) return false;
  if (url.pathname !== TIENDANUBE_CALLBACK_PATH) return false;
  return url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
}

/** Lee y valida las `TIENDANUBE_*`, sin caché, para poder probarla. */
export function readTiendanubeConfig(env: NodeJS.ProcessEnv = process.env): TiendanubeConfig {
  const appId = env.TIENDANUBE_APP_ID;
  const clientSecret = env.TIENDANUBE_CLIENT_SECRET;
  const supportContact = env.TIENDANUBE_SUPPORT_CONTACT;
  const redirectUri = env.TIENDANUBE_REDIRECT_URI;
  const clientId = env.TIENDANUBE_CLIENT_ID;

  const missing: string[] = [];
  const invalid: string[] = [];
  const check = (name: string, value: string | undefined, valid: (v: string) => boolean) => {
    if (value === undefined || value === '') missing.push(name);
    else if (!valid(value)) invalid.push(name);
  };
  check('TIENDANUBE_APP_ID', appId, (v) => NUMERIC_ID.test(v));
  check('TIENDANUBE_CLIENT_SECRET', clientSecret, (v) => v === v.trim());
  check('TIENDANUBE_SUPPORT_CONTACT', supportContact, validContact);
  check('TIENDANUBE_REDIRECT_URI', redirectUri, validRedirectUri);
  if (clientId !== undefined && clientId !== '' && !NUMERIC_ID.test(clientId)) invalid.push('TIENDANUBE_CLIENT_ID');
  if (missing.length > 0 || invalid.length > 0) throw new TiendanubeConfigError(missing, invalid);

  return Object.freeze({
    appId: appId!,
    clientId: clientId !== undefined && clientId !== '' ? clientId : appId!,
    clientSecret: new SecretValue(clientSecret!),
    supportContact: supportContact!,
    redirectUri: redirectUri!,
  });
}

let runtimeConfig: TiendanubeConfig | undefined;

/** Lee `process.env` una vez por proceso. */
export function getTiendanubeConfig(): TiendanubeConfig {
  runtimeConfig ??= readTiendanubeConfig(process.env);
  return runtimeConfig;
}

/** `GET https://www.tiendanube.com/apps/{app_id}/authorize?state=…`, sin ningún otro parámetro. */
export function authorizationUrl(config: TiendanubeConfig, state: string): URL {
  const url = new URL(`${TIENDANUBE_AUTH_ORIGIN}/apps/${encodeURIComponent(config.appId)}/authorize`);
  url.searchParams.set('state', state);
  return url;
}

/** Obligatorio en cada llamada: sin él, Tiendanube responde 400 (D-M16e-08). */
export function userAgentFor(config: TiendanubeConfig): string {
  return `PRAXA (${config.supportContact})`;
}
