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
 * Las rutas son una lista cerrada (§3): `store`, `orders`, `orders/{id}/history/values` y
 * `products`. La paginación sigue `Link rel="next"`, que se valida igual que una URL armada
 * acá. Un `429` lleva la espera de `x-rate-limit-reset`. El cliente no reintenta: los
 * reintentos y la espera los decide la sincronización con su presupuesto.
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
  /** Sigue un `Link rel="next"`: misma tienda, versión y ruta que la página anterior. */
  getNext(storeId: string, path: string, next: string, token: SecretValue, resource: TiendanubeResource):
  Promise<TiendanubeJson>;
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
const PATH = /^(?:store|orders|products|orders\/[1-9][0-9]{0,19}\/history\/values)$/;
/** Listados: un 404 es una página vacía (H-E1-256). */
const LIST_PATHS = new Set(['orders', 'products']);
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

  async function request(url: URL, init: RequestInit, resource: TiendanubeResource, list = false):
  Promise<TiendanubeJson> {
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
    if (!response.ok && list && response.status === 404) {
      // H-E1-256: Tiendanube responde 404 a un listado sin resultados (o pasada la última
      // página) en lugar de una lista vacía. La tienda ya se confirmó con `GET /store` y la
      // ruta es fija, así que en `orders` y `products` es una página vacía, sin siguiente.
      try { await response.body?.cancel(); } catch { /* sin efecto */ }
      return { body: [], headers: new Headers({ 'x-total-count': '0' }) };
    }
    if (!response.ok) {
      // El cuerpo de un error no se lee: puede traer datos de la tienda.
      try { await response.body?.cancel(); } catch { /* sin efecto */ }
      throw new TiendanubeApiError(classifyTiendanubeStatus(response.status, resource), response.status,
        response.status === 429 ? rateLimitResetMs(response.headers) : null);
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

  async function get(url: URL, storeId: string, path: string, token: SecretValue, resource: TiendanubeResource) {
    if (url.origin !== TIENDANUBE_API_ORIGIN || url.username !== '' || url.password !== '' || url.hash !== '' ||
        url.pathname !== `/${TIENDANUBE_API_VERSION}/${storeId}/${path}`) reject();
    for (const name of url.searchParams.keys()) {
      if (FORBIDDEN_PARAMS.has(name.toLowerCase())) reject();
    }
    const bearer = token.reveal();
    if (bearer === '' || /[\s]/.test(bearer)) reject();
    assertNoSecret(url, [bearer]);
    return request(url, { method: 'GET', headers: { authorization: `Bearer ${bearer}` } }, resource,
      LIST_PATHS.has(path));
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
      for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
      return get(url, storeId, path, token, resource);
    },

    async getNext(storeId, path, next, token, resource) {
      if (!STORE_ID.test(storeId) || !PATH.test(path)) reject();
      let url: URL;
      try {
        url = new URL(next);
      } catch {
        reject();
      }
      return get(url, storeId, path, token, resource);
    },
  };
}

/** `x-rate-limit-reset`: milisegundos hasta que el balde se vacía. Sin el header, `null`. */
export function rateLimitResetMs(headers: Headers): number | null {
  const value = Number(headers.get('x-rate-limit-reset'));
  return Number.isFinite(value) && value >= 0 ? Math.min(value, 60_000) : null;
}

/** `x-total-count` de una página; `null` si falta o no es un entero. */
export function totalCount(headers: Headers): number | null {
  const raw = headers.get('x-total-count');
  if (raw === null || !/^[0-9]{1,9}$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

/** URL de `Link: <…>; rel="next"`, o `null`. */
export function nextLink(headers: Headers): string | null {
  const header = headers.get('link');
  if (!header) return null;
  for (const part of header.split(',')) {
    const match = /^\s*<([^>]+)>\s*;(.*)$/.exec(part);
    if (match && /(?:^|;)\s*rel\s*=\s*"?next"?\s*(?:;|$)/i.test(match[2])) return match[1];
  }
  return null;
}
