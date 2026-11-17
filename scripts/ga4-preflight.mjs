import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/**
 * M16f, paso 1: comprueba la presencia y la forma de las variables de Google OAuth
 * sin imprimir valores ni llamar a Google.
 * Uso: node --env-file=.env.local scripts/ga4-preflight.mjs
 */
export const CALLBACK_PATH = '/api/integraciones/ga4/callback';

const CLIENT_ID = /^[1-9][0-9]*-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/;

function present(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function clientId(value) {
  if (!present(value)) return 'falta';
  return CLIENT_ID.test(value) ? 'ok' : 'forma_invalida';
}

function clientSecret(value) {
  if (!present(value)) return 'falta';
  return value === value.trim() ? 'ok' : 'forma_invalida';
}

function redirectUri(value) {
  if (!present(value)) return 'falta';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname !== '' &&
      url.pathname === CALLBACK_PATH && url.search === '' && url.hash === '' &&
      url.username === '' && url.password === ''
      ? 'ok' : 'forma_invalida';
  } catch {
    return 'forma_invalida';
  }
}

export function runPreflight({ env, log }) {
  const result = {
    GOOGLE_OAUTH_CLIENT_ID: clientId(env.GOOGLE_OAUTH_CLIENT_ID),
    GOOGLE_OAUTH_CLIENT_SECRET: clientSecret(env.GOOGLE_OAUTH_CLIENT_SECRET),
    GOOGLE_OAUTH_REDIRECT_URI: redirectUri(env.GOOGLE_OAUTH_REDIRECT_URI),
  };
  const ok = Object.values(result).every((state) => state === 'ok');
  log(JSON.stringify({ preflight: ok ? 'ok' : 'fallido', ...result }));
  return ok ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runPreflight({ env: process.env, log: (line) => console.log(line) });
}
