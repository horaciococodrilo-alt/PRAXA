import 'server-only';

import { SecretValue } from '../crypto/seal';
import { TIENDANUBE_API_ORIGIN, TIENDANUBE_API_VERSION, TIENDANUBE_TOKEN_URL } from './config';
import {
  TiendanubeApiError,
  classifyTiendanubeStatus,
  tiendanubeTimeoutError,
  tiendanubeTransportError,
  type TiendanubeResource,
} from './errors';

/**
 * Cliente HTTP de solo lectura de Tiendanube (M16e-C-10).
 *
 * - El `User-Agent` es obligatorio al crear el cliente: no se puede enviar una petición sin él.
 * - Solo dos destinos: el canje (`POST` JSON a la URL fija) y lecturas `GET` a
 *   `api.tiendanube.com/2025-03/{store_id}/…`, con el token en `Authorization: Bearer`.
 * - Ninguna URL de salida lleva credenciales ni el código. Antes de llamar a `fetch` se
 *   rechaza la que los tenga.
 * - Los errores se clasifican por estado HTTP; ni la URL ni el cuerpo llegan al error, y el
 *   cliente no escribe en consola.
 *
 * La paginación, la cuota y los reintentos se agregan en la etapa .3.
 */

export type TiendanubeFetch = (input: URL, init: RequestInit) => Promise<Response>;

export type TiendanubeJson = Readonly<{ body: unknown; headers: Headers }>;

export type TiendanubeHttpClient = {
  exchangeCode(input: { clientId: string; clientSecret: SecretValue; code: string }): Promise<unknown>;
  getJson(
    storeId: string,
    path: string,
    query: Record<string, string>,
    token: SecretValue,
    resource: TiendanubeResource,
  ): Promise<TiendanubeJson>;
};

/** Petición rechazada antes de enviar: un defecto de PRAXA, no un error de Tiendanube. */
export class TiendanubeRequestRejectedError extends Error {
  constructor() {
    super('Petición a Tiendanube rechazada: la URL no es válida.');
    this.name = 'TiendanubeRequestRejectedError';
  }
}

export const TIENDANUBE_HTTP_TIMEOUT_MS = 10_000;

const STORE_ID = /^[1-9][0-9]{0,19}$/;
const PATH = /^[a-z_]+(?:\/[0-9a-z_]+)*$/;
const FORBIDDEN_PARAMS = new Set(['access_token', 'client_secret', 'client_id', 'code', 'token']);

function reject(): never {
  throw new TiendanubeRequestRejectedError();
}

function assertNoSecret(url: URL, secrets: readonly string[]) {
  for (const secret of secrets) {
    if (secret === '') continue;
    let plain: string;
    try {
      plain = decodeURIComponent(url.href);
    } catch {
      reject();
    }
    if (url.href.includes(secret) || plain.includes(secret)) reject();
  }
}

export function createTiendanubeHttpClient(deps: { userAgent: string; fetch?: TiendanubeFetch; timeoutMs?: number }):
TiendanubeHttpClient {
  const userAgent = deps.userAgent;
  if (typeof userAgent !== 'string' || userAgent.trim() === '' || /[\r\n]/.test(userAgent)) {
    throw new TiendanubeRequestRejectedError();
  }
  const send: TiendanubeFetch = deps.fetch ?? ((input, init) => fetch(input, init));
  const timeoutMs = deps.timeoutMs ?? TIENDANUBE_HTTP_TIMEOUT_MS;

  async function request(url: URL, init: RequestInit, resource: TiendanubeResource): Promise<TiendanubeJson> {
    let response: Response;
    try {
      response = await send(url, {
        ...init,
        headers: { ...(init.headers as Record<string, string>), accept: 'application/json', 'user-agent': userAgent },
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        throw tiendanubeTimeoutError();
      }
      throw tiendanubeTransportError();
    }
    if (!response.ok) {
      // El cuerpo de un error no se lee: puede traer datos de la tienda.
      try { await response.body?.cancel(); } catch { /* sin efecto */ }
      throw new TiendanubeApiError(classifyTiendanubeStatus(response.status, resource), response.status);
    }
    let text: string;
    try {
      text = await response.text();
    } catch {
      throw tiendanubeTransportError();
    }
    try {
      return { body: JSON.parse(text) as unknown, headers: response.headers };
    } catch {
      throw new TiendanubeApiError({ kind: 'desconocido', errorClass: 'unknown' }, response.status);
    }
  }

  return {
    async exchangeCode(input) {
      const url = new URL(TIENDANUBE_TOKEN_URL);
      const secret = input.clientSecret.reveal();
      assertNoSecret(url, [secret, input.code]);
      const { body } = await request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client_id: input.clientId, client_secret: secret,
          grant_type: 'authorization_code', code: input.code }),
      }, 'token');
      return body;
    },

    async getJson(storeId, path, query, token, resource) {
      if (!STORE_ID.test(storeId) || !PATH.test(path)) reject();
      const url = new URL(`${TIENDANUBE_API_ORIGIN}/${TIENDANUBE_API_VERSION}/${storeId}/${path}`);
      if (url.origin !== TIENDANUBE_API_ORIGIN || url.pathname !== `/${TIENDANUBE_API_VERSION}/${storeId}/${path}`) reject();
      for (const [name, value] of Object.entries(query)) {
        if (FORBIDDEN_PARAMS.has(name.toLowerCase())) reject();
        url.searchParams.set(name, value);
      }
      const bearer = token.reveal();
      if (bearer === '' || /[\s]/.test(bearer)) reject();
      assertNoSecret(url, [bearer]);
      return request(url, { method: 'GET', headers: { authorization: `Bearer ${bearer}` } }, resource);
    },
  };
}
