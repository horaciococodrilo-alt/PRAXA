import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { runPreflight } from '../../scripts/meta-preflight.mjs';

const APP_ID = '1234567';
const SECRET = 'secret-sint';
const env = { META_APP_ID: APP_ID, META_APP_SECRET: SECRET };

function fakeResponse(inner: unknown, status = 200) {
  const requests: Array<{ url: URL; init: RequestInit }> = [];
  const fetch = vi.fn(async (url: URL, init: RequestInit) => {
    requests.push({ url, init });
    return new Response(JSON.stringify(inner), { status });
  });
  return { requests, fetch };
}

describe('M16.2: preflight local', () => {
  it('T-48 prueba debug_token por lote en una petición con salida cerrada', async () => {
    const meta = fakeResponse([{ code: 200, body: '{"data":{"is_valid":true,"type":"APP"}}' }]);
    const lines: string[] = [];
    expect(await runPreflight({ env, fetch: meta.fetch, log: (line: string) => lines.push(line) })).toBe(0);
    expect(meta.requests).toHaveLength(1);
    const [{ url, init }] = meta.requests;
    const apiSource = await readFile('src/modules/integrations/meta/api.ts', 'utf8');
    const version = /GRAPH_API_VERSION = '(v[^']+)'/.exec(apiSource)?.[1];
    expect(url.href).toBe(`https://graph.facebook.com/${version}/`);
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('error');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const form = new URLSearchParams(String(init.body));
    expect(form.get('access_token')).toBe(`${APP_ID}|${SECRET}`);
    const batch = JSON.parse(form.get('batch') ?? 'null');
    expect(batch).toHaveLength(1);
    expect(batch[0].method).toBe('GET');
    const relative = new URL(batch[0].relative_url, 'https://graph.facebook.com/');
    expect(relative.pathname).toBe('/debug_token');
    expect(relative.searchParams.get('input_token')).toBe(`${APP_ID}|${SECRET}`);
    expect(lines).toHaveLength(1);
    const result = JSON.parse(lines[0]);
    expect(Object.keys(result)).toEqual(['preflight', 'http', 'codigo', 'tipo', 'valido', 'error_graph']);
    expect(result).toEqual({ preflight: 'ok', http: 200, codigo: 200, tipo: 'APP', valido: true,
      error_graph: null });
    expect(lines[0]).not.toContain(APP_ID);
    expect(lines[0]).not.toContain(SECRET);
  });

  it.each([
    ['Graph', [{ code: 400, body: '{"error":{"code":190}}' }], 200],
    ['rechazo', [{ code: 200, body: '{"data":{"is_valid":false}}' }], 200],
    ['HTTP', {}, 500],
  ] as const)('T-48 %s sale fallido', async (_name, payload, status) => {
    const meta = fakeResponse(payload, status);
    const lines: string[] = [];
    expect(await runPreflight({ env, fetch: meta.fetch, log: (line: string) => lines.push(line) })).toBe(1);
    expect(JSON.parse(lines[0]).preflight).toBe('fallido');
    expect(lines).toHaveLength(1);
  });

  it('T-48 sin configuración no llama a Meta', async () => {
    const meta = fakeResponse([]);
    const lines: string[] = [];
    expect(await runPreflight({ env: { META_APP_ID: APP_ID }, fetch: meta.fetch,
      log: (line: string) => lines.push(line) })).toBe(1);
    expect(meta.requests).toHaveLength(0);
    expect(lines).toEqual(['{"preflight":"sin_configuracion"}']);
  });

  it('T-48 la red puede fallar sin exponer el error', async () => {
    const lines: string[] = [];
    expect(await runPreflight({ env, fetch: async () => { throw new Error(`secret ${SECRET}`); },
      log: (line: string) => lines.push(line) })).toBe(1);
    expect(JSON.parse(lines[0]).preflight).toBe('fallido');
    expect(lines[0]).not.toContain(SECRET);
  });
});
