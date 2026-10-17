import 'server-only';

import { SecretValue } from '../crypto/seal';

/**
 * Único lugar con la versión de la Graph API, las URLs de Meta y la configuración `META_*`
 * (II.9, paso 1).
 *
 * Ninguna URL de salida hacia Meta lleva credenciales, códigos ni tokens (D-M16.1-08): van
 * en el cuerpo de un `POST` o en `Authorization`. `graphUrl` rechaza esos parámetros y el
 * cliente HTTP lo vuelve a comprobar antes de enviar.
 */

export const GRAPH_API_VERSION = 'v26.0';
export const GRAPH_ORIGIN = 'https://graph.facebook.com';
export const DIALOG_ORIGIN = 'https://www.facebook.com';
export const META_CALLBACK_PATH = '/api/integraciones/meta/callback';

export const GRAPH_URL_FORBIDDEN_PARAMS = [
  'access_token',
  'input_token',
  'client_secret',
  'code',
  'appsecret_proof',
  'revoke_token',
] as const;

export class MetaUrlParamError extends Error {
  constructor() {
    super('Parámetro no permitido en una URL de Meta.');
    this.name = 'MetaUrlParamError';
  }
}

export function graphUrl(path: string, params: Record<string, string> = {}): URL {
  const url = new URL(`${GRAPH_ORIGIN}/${GRAPH_API_VERSION}/${path}`);
  for (const [name, value] of Object.entries(params)) {
    if ((GRAPH_URL_FORBIDDEN_PARAMS as readonly string[]).includes(name)) throw new MetaUrlParamError();
    url.searchParams.set(name, value);
  }
  return url;
}

export function dialogUrl(params: Record<string, string>): URL {
  const url = new URL(`${DIALOG_ORIGIN}/${GRAPH_API_VERSION}/dialog/oauth`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  return url;
}

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

export type MetaOAuthConfig = Readonly<{
  appId: string;
  appSecret: SecretValue;
  redirectUri: string;
  configId: string;
}>;

/** El mensaje nombra solo variables, nunca valores. */
export class MetaConfigError extends Error {
  readonly missing: readonly string[];

  constructor(missing: readonly string[], invalid: readonly string[]) {
    const parts = [
      missing.length > 0 ? `Falta configuración de Meta: ${missing.join(', ')}.` : '',
      invalid.length > 0 ? `Configuración de Meta inválida: ${invalid.join(', ')}.` : '',
    ];
    super(parts.filter(Boolean).join(' '));
    this.name = 'MetaConfigError';
    this.missing = Object.freeze([...missing]);
  }
}

const NUMERIC_ID = /^[0-9]{1,32}$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function validRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username !== '' || url.password !== '') return false;
  if (url.search !== '' || url.hash !== '' || value.includes('?') || value.includes('#')) return false;
  if (url.pathname !== META_CALLBACK_PATH) return false;
  return url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
}

/** Lee y valida las cuatro `META_*`, sin caché, para poder probarla. */
export function readMetaOAuthConfig(env: NodeJS.ProcessEnv = process.env): MetaOAuthConfig {
  const appId = env.META_APP_ID;
  const appSecret = env.META_APP_SECRET;
  const redirectUri = env.META_REDIRECT_URI;
  const configId = env.META_CONFIG_ID;

  const missing: string[] = [];
  const invalid: string[] = [];
  const check = (name: string, value: string | undefined, valid: (v: string) => boolean) => {
    if (value === undefined || value === '') missing.push(name);
    else if (!valid(value)) invalid.push(name);
  };
  check('META_APP_ID', appId, (v) => NUMERIC_ID.test(v));
  check('META_APP_SECRET', appSecret, () => true);
  check('META_REDIRECT_URI', redirectUri, validRedirectUri);
  check('META_CONFIG_ID', configId, (v) => NUMERIC_ID.test(v));
  if (missing.length > 0 || invalid.length > 0) throw new MetaConfigError(missing, invalid);

  return Object.freeze({
    appId: appId!,
    appSecret: new SecretValue(appSecret!),
    redirectUri: redirectUri!,
    configId: configId!,
  });
}

let runtimeConfig: MetaOAuthConfig | undefined;

/** Lee `process.env` una vez por proceso. */
export function getMetaOAuthConfig(): MetaOAuthConfig {
  runtimeConfig ??= readMetaOAuthConfig(process.env);
  return runtimeConfig;
}
