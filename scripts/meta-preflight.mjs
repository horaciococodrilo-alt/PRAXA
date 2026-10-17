import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const GRAPH_API_VERSION = 'v26.0';
const ENDPOINT = `https://graph.facebook.com/${GRAPH_API_VERSION}/`;

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function graphCode(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export async function runPreflight({ env, fetch, log }) {
  const appId = env.META_APP_ID;
  const appSecret = env.META_APP_SECRET;
  if (!appId || !appSecret) {
    log(JSON.stringify({ preflight: 'sin_configuracion' }));
    return 1;
  }

  let http = null;
  let codigo = null;
  let tipo = null;
  let valido = null;
  let error_graph = null;
  try {
    const appToken = `${appId}|${appSecret}`;
    const relative = new URL('debug_token', 'https://graph.facebook.com/');
    relative.searchParams.set('input_token', appToken);
    const body = new URLSearchParams({
      access_token: appToken,
      batch: JSON.stringify([{ method: 'GET', relative_url: `debug_token${relative.search}` }]),
    });
    const response = await fetch(new URL(ENDPOINT), {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    http = response.status;
    const outer = JSON.parse(await response.text());
    if (Array.isArray(outer) && outer.length === 1) {
      const operation = record(outer[0]);
      codigo = graphCode(operation?.code);
      if (typeof operation?.body === 'string') {
        const inner = record(JSON.parse(operation.body));
        const data = record(inner?.data);
        tipo = typeof data?.type === 'string' && /^[A-Z_]{1,32}$/.test(data.type) ? data.type : null;
        valido = typeof data?.is_valid === 'boolean' ? data.is_valid : null;
        error_graph = graphCode(record(inner?.error)?.code);
      }
    } else {
      error_graph = graphCode(record(outer?.error)?.code);
    }
  } catch {
    // La salida solo incluye campos cerrados; ningún error externo se imprime.
  }
  const preflight = http === 200 && codigo === 200 && valido === true ? 'ok' : 'fallido';
  log(JSON.stringify({ preflight, http, codigo, tipo, valido, error_graph }));
  return preflight === 'ok' ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runPreflight({ env: process.env, fetch: globalThis.fetch,
    log: (line) => console.log(line) });
}
