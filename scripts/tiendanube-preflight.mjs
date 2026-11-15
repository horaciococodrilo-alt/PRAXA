import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/**
 * M16e, paso 3: preflight local de la app de Tiendanube. Informa presencia y forma de cada
 * variable sin imprimir ningún valor y sin llamar a ninguna API: el canje real se prueba en
 * la etapa 4 (T-15). La salida es una línea JSON con campos cerrados.
 *
 * Uso: node --env-file=.env.local scripts/tiendanube-preflight.mjs
 */

export const CALLBACK_PATH = '/api/integraciones/tiendanube/callback';

const NUMERIC_ID = /^[1-9][0-9]{0,19}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function present(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function numericId(value) {
  if (!present(value)) return 'falta';
  return NUMERIC_ID.test(value) ? 'ok' : 'forma_invalida';
}

function secret(value) {
  if (!present(value)) return 'falta';
  return value === value.trim() ? 'ok' : 'forma_invalida';
}

function httpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname !== '' ? url : null;
  } catch {
    return null;
  }
}

function contact(value) {
  if (!present(value)) return 'falta';
  return EMAIL.test(value) || httpsUrl(value) ? 'ok' : 'forma_invalida';
}

function redirectUri(value) {
  if (!present(value)) return 'falta';
  const url = httpsUrl(value);
  if (!url || url.search !== '' || url.hash !== '' || url.username !== '' || url.password !== '') {
    return 'forma_invalida';
  }
  return url.pathname === CALLBACK_PATH ? 'ok' : 'forma_invalida';
}

export function runPreflight({ env, log }) {
  const result = {
    TIENDANUBE_APP_ID: numericId(env.TIENDANUBE_APP_ID),
    TIENDANUBE_CLIENT_SECRET: secret(env.TIENDANUBE_CLIENT_SECRET),
    TIENDANUBE_SUPPORT_CONTACT: contact(env.TIENDANUBE_SUPPORT_CONTACT),
    TIENDANUBE_REDIRECT_URI: redirectUri(env.TIENDANUBE_REDIRECT_URI),
    // Opcional: solo si M16e-H-10 falla (el client_id del canje distinto del ID de la app).
    TIENDANUBE_CLIENT_ID: present(env.TIENDANUBE_CLIENT_ID) ? numericId(env.TIENDANUBE_CLIENT_ID) : 'ausente',
  };
  const ok = Object.entries(result).every(([name, state]) =>
    state === 'ok' || (name === 'TIENDANUBE_CLIENT_ID' && state === 'ausente'));
  log(JSON.stringify({ preflight: ok ? 'ok' : 'fallido', ...result }));
  return ok ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runPreflight({ env: process.env, log: (line) => console.log(line) });
}
