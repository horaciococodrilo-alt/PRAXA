/**
 * Validación compartida de cadenas de conexión antes de entregarlas al parser de pg.
 *
 * La usan el cliente de runtime (`worker-api.ts`), el resolvedor de destino de pruebas
 * (`scripts/lib/sql-target.mjs`) y el cliente administrativo de pruebas
 * (`scripts/lib/test-db-client.mjs`), para que las tres guardas acepten exactamente las
 * mismas URLs (H-E1-56).
 */

import { SUPABASE_ROOT_CA } from './supabase-root-ca.mjs';

export const TLS_QUERY = new Set(['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'sslnegotiation', 'uselibpqcompat']);
export const DESTINATION_QUERY = new Set(['user', 'host', 'port']);
export const POOLER_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.pooler\.supabase\.com$/i;
export const ROLE_USER = /^praxa_integrations\.([a-z0-9]{20})$/;

/**
 * pg-connection-string vuelve a codificar toda la cadena con `encodeURI` cuando
 * encuentra un espacio sin codificar o un `%` que no va seguido de dos dígitos
 * hexadecimales (pg-connection-string/index.js:20). Esa re-codificación no decodifica
 * un `%XX` ya presente (por ejemplo `%5F`): lo deja como texto literal en el usuario
 * que pg termina usando, distinto del que valida esta guarda. Ante esa ambigüedad se
 * rechaza la URL entera, sin intentar replicar la re-codificación. La última alternativa
 * (`%[a-f0-9]?$`) cubre el mismo caso cuando el `%` ambiguo cae en los últimos 1-2
 * caracteres de toda la cadena, donde las alternativas anteriores no tienen carácter
 * siguiente que inspeccionar (H-E1-48).
 */
export const AMBIGUOUS_ENCODING = / |%[^a-f0-9]|%[a-f0-9][^a-f0-9]|%[a-f0-9]?$/i;

export const INVALID_URL = 'La URL de conexión no es válida.';
export const DESTINATION_OVERRIDE = 'La URL de conexión contiene overrides de identidad o destino no permitidos.';
export const TLS_OVERRIDE = 'La URL de conexión contiene parámetros TLS no permitidos; TLS se configura en el módulo.';
export const EXTRA_QUERY = 'La URL del rol no admite parámetros de conexión adicionales.';

/**
 * Puerto literal de la autoridad de la URL original, sin la normalización de `new URL()`.
 * @param {string} raw
 * @returns {string | null}
 */
export function literalAuthorityPort(raw) {
  const afterScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const end = afterScheme.search(/[/?#]/);
  const authority = end === -1 ? afterScheme : afterScheme.slice(0, end);
  const at = authority.lastIndexOf('@');
  const hostport = at === -1 ? authority : authority.slice(at + 1);
  const match = /:(\d+)$/.exec(hostport);
  return match ? match[1] : null;
}

/**
 * Referencia de proyecto de un usuario `praxa_integrations.<ref>` ya decodificado, o
 * null si no coincide. La usan el cliente de runtime y el resolvedor de destino de
 * pruebas para que la forma del usuario del rol no diverja entre ambos (H-E1-59).
 * @param {string} username
 * @returns {string | null}
 */
export function roleUserRef(username) {
  return ROLE_USER.exec(username)?.[1] ?? null;
}

/**
 * La URL exige el shared transaction pooler en el puerto 6543, comparando tanto el
 * puerto normalizado por `new URL()` como el literal de la cadena original (H-E1-59).
 * @param {URL} url
 * @param {string} rawUrl
 * @returns {boolean}
 */
export function isSharedTransactionPooler(url, rawUrl) {
  return POOLER_HOST.test(url.hostname) && url.port === '6543' && literalAuthorityPort(rawUrl) === '6543';
}

/**
 * Forma de la URL, overrides de identidad/destino y, salvo `allowTls`, parámetros TLS y
 * cualquier otra query. `allowTls` es solo para la URL administrativa de pruebas, cuya
 * query restante valida `testDbUrlHasUnsupportedQuery`. No valida usuario ni host del rol.
 * @param {unknown} value
 * @param {{ allowTls?: boolean }} [options]
 * @returns {{ ok: true, url: URL } | { ok: false, problem: string }}
 */
export function inspectConnectionUrl(value, { allowTls = false } = {}) {
  if (typeof value !== 'string' || !/^postgres(?:ql)?:\/\//i.test(value)) return { ok: false, problem: INVALID_URL };
  if (AMBIGUOUS_ENCODING.test(value)) return { ok: false, problem: INVALID_URL };
  let url;
  try { url = new URL(value); }
  catch { return { ok: false, problem: INVALID_URL }; }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash || !url.username ||
      !url.password || !url.hostname || !url.port || !url.pathname || url.pathname === '/') {
    return { ok: false, problem: INVALID_URL };
  }
  try {
    if (!decodeURIComponent(url.username) || !decodeURIComponent(url.password)) return { ok: false, problem: INVALID_URL };
  } catch { return { ok: false, problem: INVALID_URL }; }
  for (const [name] of url.searchParams) {
    const normalized = name.toLowerCase();
    if (DESTINATION_QUERY.has(normalized)) return { ok: false, problem: DESTINATION_OVERRIDE };
    if (!allowTls && TLS_QUERY.has(normalized)) return { ok: false, problem: TLS_OVERRIDE };
  }
  // pg también interpreta opciones de sesión y overrides del pool desde la query (H-E1-52).
  if (!allowTls && url.search) return { ok: false, problem: EXTRA_QUERY };
  return { ok: true, url };
}

/**
 * Configuración TLS fija para cualquier cliente `pg` contra Supabase: CA pública
 * versionada, verificación completa y negociación `postgres` explícita (D-M06.3a-11). La
 * usan tanto el cliente de runtime como el administrativo de pruebas, para que la
 * política TLS no diverja entre ambos (hallazgo de la ultrareview sobre H-E1-59 a H-E1-66).
 * @returns {{ sslnegotiation: 'postgres', ssl: { ca: string, rejectUnauthorized: true } }}
 */
export function supabaseTlsConfig() {
  return { sslnegotiation: /** @type {'postgres'} */ ('postgres'), ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true } };
}
