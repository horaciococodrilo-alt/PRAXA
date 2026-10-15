import 'server-only';

import { SecretValue } from '../crypto/seal';
import { GRAPH_ORIGIN, GRAPH_URL_FORBIDDEN_PARAMS } from './api';
import { MetaApiError, classifyGraphError, transportError } from './errors';

/**
 * Cliente HTTP de Meta (CA-39, CA-09, CA-26).
 *
 * Ninguna URL de salida lleva credenciales, códigos ni tokens (D-M16.1-08, A2x-02): antes
 * de llamar a `fetch` se rechaza la URL que los tenga. Nada de la URL, la petición ni el
 * cuerpo llega a un error, y el cliente no escribe en consola. No reintenta: en M16.1 solo
 * hay canje (de un solo uso), `debug_token` y `/me`.
 */

export type MetaFetch = (input: URL, init: RequestInit) => Promise<Response>;

export type MetaHttpClient = {
  getJson(url: URL, options?: { bearer?: SecretValue }): Promise<unknown>;
  postFormJson(url: URL, form: Record<string, string | SecretValue>): Promise<unknown>;
};

/** URL rechazada antes de enviar. Es un defecto de programación, no un error de Meta. */
export class MetaRequestRejectedError extends Error {
  constructor() {
    super('Petición a Meta rechazada: la URL no es válida.');
    this.name = 'MetaRequestRejectedError';
  }
}

export const META_HTTP_TIMEOUT_MS = 10_000;

function decoded(part: string): string | null {
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
}

function assertOutgoingUrl(url: URL, options: { allowQuery: boolean; secrets: readonly string[] }): void {
  const reject = () => {
    throw new MetaRequestRejectedError();
  };
  if (!(url instanceof URL) || url.origin !== GRAPH_ORIGIN || url.username !== '' || url.password !== '') reject();
  for (const name of url.searchParams.keys()) {
    if ((GRAPH_URL_FORBIDDEN_PARAMS as readonly string[]).includes(name)) reject();
  }
  if (!options.allowQuery && (url.search !== '' || url.hash !== '' || url.href.includes('?') || url.href.includes('#'))) {
    reject();
  }
  for (const secret of options.secrets) {
    if (secret === '') continue;
    for (const part of [url.pathname, url.search, url.hash]) {
      const plain = decoded(part);
      if (plain === null || part.includes(secret) || plain.includes(secret)) reject();
    }
  }
}

async function readJson(response: Response): Promise<unknown> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    throw transportError();
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw transportError();
  }
  const error = body && typeof body === 'object' && !Array.isArray(body) ? (body as { error?: unknown }).error : undefined;
  if (error && typeof error === 'object') throw new MetaApiError(classifyGraphError(body));
  if (!response.ok) throw new MetaApiError({ errorClass: 'unknown', graphCode: null, graphSubcode: null });
  return body;
}

export function createMetaHttpClient(deps: { fetch?: MetaFetch; timeoutMs?: number } = {}): MetaHttpClient {
  const send: MetaFetch = deps.fetch ?? ((input, init) => fetch(input, init));
  const timeoutMs = deps.timeoutMs ?? META_HTTP_TIMEOUT_MS;

  async function request(url: URL, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await send(url, {
        ...init,
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw transportError();
    }
    return readJson(response);
  }

  return {
    async getJson(url, options = {}) {
      const token = options.bearer?.reveal();
      assertOutgoingUrl(url, { allowQuery: true, secrets: token === undefined ? [] : [token] });
      const headers: Record<string, string> = { accept: 'application/json' };
      if (token !== undefined) headers.authorization = `Bearer ${token}`;
      return request(url, { method: 'GET', headers });
    },

    async postFormJson(url, form) {
      const secrets = Object.values(form).flatMap((value) => (value instanceof SecretValue ? [value.reveal()] : []));
      assertOutgoingUrl(url, { allowQuery: false, secrets });
      const body = new URLSearchParams();
      for (const [name, value] of Object.entries(form)) {
        body.set(name, value instanceof SecretValue ? value.reveal() : value);
      }
      return request(url, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    },
  };
}
