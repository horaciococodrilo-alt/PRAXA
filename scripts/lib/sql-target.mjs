import { dbUrlHasPlaceholderPassword, dbUrlIsParsable, refFromApiUrl, refFromDbUrl } from './target.mjs';

/**
 * Elección del destino de las pruebas SQL.
 *
 * Está separada del script y sin efectos para poder probarla sin conectarse a ninguna
 * base: no hace falta —ni sería correcto— apuntar una prueba negativa a la base de la
 * aplicación para comprobar que debería rechazarla.
 *
 * Reglas, en orden:
 *
 *   1. Solo se usa `SUPABASE_TEST_DB_URL`. Nunca se cae a `SUPABASE_DB_URL`: un respaldo
 *      silencioso mandaría las pruebas a la base de la aplicación, que es justo lo que
 *      hay que evitar.
 *   2. El proyecto tiene que estar declarado desechable.
 *   3. Si el destino coincide con el de la aplicación —por URL o por referencia de
 *      proyecto— se rechaza.
 *   4. Si el destino no se puede comprobar, se rechaza. Ante la duda no se corre.
 */

export const DISPOSABLE_ACK = 'yes-this-project-is-disposable';
export const INTEGRATIONS_ROLE = 'praxa_integrations';

const TLS_QUERY = new Set(['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'sslnegotiation', 'uselibpqcompat']);
const DESTINATION_QUERY = new Set(['user', 'host', 'port']);
const POOLER_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.pooler\.supabase\.com$/i;

function inspectedUrl(value) {
  if (typeof value !== 'string' || !/^postgres(?:ql)?:\/\//i.test(value)) {
    return { ok: false, problem: 'La URL de conexión no es válida.' };
  }
  let url;
  try { url = new URL(value); }
  catch { return { ok: false, problem: 'La URL de conexión no es válida.' }; }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash || !url.username ||
      !url.password || !url.hostname || !url.port || !url.pathname || url.pathname === '/') {
    return { ok: false, problem: 'La URL de conexión no es válida.' };
  }
  try {
    if (!decodeURIComponent(url.username) || !decodeURIComponent(url.password)) {
      return { ok: false, problem: 'La URL de conexión no es válida.' };
    }
  } catch { return { ok: false, problem: 'La URL de conexión no es válida.' }; }
  for (const [name] of url.searchParams) {
    const normalized = name.toLowerCase();
    if (DESTINATION_QUERY.has(normalized)) {
      return { ok: false, problem: 'La URL de conexión contiene overrides de identidad o destino no permitidos.' };
    }
    if (TLS_QUERY.has(normalized)) {
      return { ok: false, problem: 'La URL de conexión contiene parámetros TLS no permitidos; TLS se configura en el módulo.' };
    }
  }
  return { ok: true, url };
}

/** Comprueba la URL exclusiva del rol sin usar la de runtime como respaldo. No conecta. */
export function resolveIntegrationsTestTarget(env) {
  const problems = [];
  const roleUrl = env.PRAXA_INTEGRATIONS_TEST_DB_URL;
  if (!roleUrl) {
    return { ok: false, problems: [
      'Falta PRAXA_INTEGRATIONS_TEST_DB_URL. No se usa PRAXA_INTEGRATIONS_DB_URL como alternativa.',
    ] };
  }

  const role = inspectedUrl(roleUrl);
  const reference = env.SUPABASE_TEST_DB_URL ? inspectedUrl(env.SUPABASE_TEST_DB_URL) : null;
  const app = env.SUPABASE_DB_URL ? inspectedUrl(env.SUPABASE_DB_URL) : null;
  if (!role.ok) problems.push(role.problem);
  if (reference && !reference.ok) problems.push(`SUPABASE_TEST_DB_URL: ${reference.problem}`);
  if (app && !app.ok) problems.push(`SUPABASE_DB_URL: ${app.problem}`);
  if (!dbUrlIsParsable(roleUrl)) problems.push('PRAXA_INTEGRATIONS_TEST_DB_URL no es una cadena de conexión válida.');
  if (dbUrlHasPlaceholderPassword(roleUrl)) problems.push('PRAXA_INTEGRATIONS_TEST_DB_URL contiene el marcador [YOUR-PASSWORD].');

  const sql = resolveSqlTestTarget(env);
  if (!sql.ok) problems.push(...sql.problems);

  let projectRef = null;
  if (role.ok) {
    let username;
    try { username = decodeURIComponent(role.url.username); }
    catch { username = ''; }
    const match = username.match(/^praxa_integrations\.([a-z0-9]{20})$/);
    if (!match) problems.push('La URL del rol debe usar praxa_integrations.<ref>.');
    else projectRef = match[1];
    if (!POOLER_HOST.test(role.url.hostname) || role.url.port !== '6543') {
      problems.push('Se requiere el shared transaction pooler en el puerto 6543.');
    }
  }
  if (sql.ok && projectRef && sql.projectRef !== projectRef) {
    problems.push('La URL del rol apunta a un proyecto distinto del proyecto de pruebas.');
  }
  const appDbRef = app?.ok ? refFromDbUrl(env.SUPABASE_DB_URL) : null;
  const appApiRef = refFromApiUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  if (app?.ok && !appDbRef) {
    problems.push('No se pudo deducir el proyecto de SUPABASE_DB_URL.');
  }
  if (projectRef && (projectRef === appDbRef || projectRef === appApiRef)) {
    problems.push('La URL del rol apunta al proyecto de la aplicación.');
  }
  if (env.PRAXA_INTEGRATIONS_DB_URL && env.PRAXA_INTEGRATIONS_DB_URL === roleUrl) {
    problems.push('La URL del rol de pruebas coincide con la URL de runtime.');
  }
  if (problems.length) return { ok: false, problems };
  return { ok: true, connectionString: roleUrl, projectRef, notes: [] };
}

/**
 * @param {Record<string, string|undefined>} env
 * @returns {{ ok: true, connectionString: string, projectRef: string|null }
 *          | { ok: false, problems: string[] }}
 */
export function resolveSqlTestTarget(env) {
  const problems = [];

  const dbUrl = env.SUPABASE_TEST_DB_URL;
  const appDbUrl = env.SUPABASE_DB_URL;
  const testApiUrl = env.SUPABASE_TEST_URL;
  const appApiUrl = env.NEXT_PUBLIC_SUPABASE_URL;

  if (!dbUrl) {
    problems.push(
      'Falta SUPABASE_TEST_DB_URL: la cadena de conexión del proyecto de PRUEBAS. ' +
        'Dashboard del proyecto desechable → Connect → Session pooler. ' +
        'No se usa SUPABASE_DB_URL como alternativa: esa es la base de la aplicación.',
    );
    return { ok: false, problems };
  }

  if (!dbUrlIsParsable(dbUrl)) {
    problems.push(
      'SUPABASE_TEST_DB_URL no es una cadena de conexión válida. Si la contraseña tiene ' +
        'caracteres especiales (@ : / ? #), hay que codificarla en porcentaje.',
    );
    return { ok: false, problems };
  }

  if (dbUrlHasPlaceholderPassword(dbUrl)) {
    problems.push(
      'SUPABASE_TEST_DB_URL todavía tiene el marcador [YOUR-PASSWORD] en lugar de la ' +
        'contraseña real.',
    );
  }

  if (env.SUPABASE_TEST_IS_DISPOSABLE !== DISPOSABLE_ACK) {
    problems.push(
      `Falta SUPABASE_TEST_IS_DISPOSABLE=${DISPOSABLE_ACK}. Las pruebas SQL crean y ` +
        'borran datos: nunca deben correr contra una base que no sea desechable.',
    );
  }

  const testRef = refFromDbUrl(dbUrl);
  const appRef = appDbUrl ? refFromDbUrl(appDbUrl) : refFromApiUrl(appApiUrl);

  // Coincidencia por cadena exacta: el caso más obvio de copiar y pegar mal.
  if (appDbUrl && dbUrl === appDbUrl) {
    problems.push(
      'SUPABASE_TEST_DB_URL es idéntica a SUPABASE_DB_URL: apuntaría a la base de la ' +
        'aplicación.',
    );
  }

  // Coincidencia por proyecto, que atrapa además el caso de dos cadenas distintas
  // (pooler y conexión directa) hacia el mismo proyecto.
  if (testRef && appRef && testRef === appRef) {
    problems.push(
      `SUPABASE_TEST_DB_URL apunta al proyecto ${testRef}, que es el de la aplicación. ` +
        'Usá un proyecto aparte y desechable.',
    );
  }

  if (testApiUrl && appApiUrl && testApiUrl === appApiUrl) {
    problems.push(
      'SUPABASE_TEST_URL y NEXT_PUBLIC_SUPABASE_URL son el mismo proyecto.',
    );
  }

  // Si no se puede deducir de qué proyecto se trata, no hay forma de descartar que sea
  // el de la aplicación. Ante la duda, no se corre.
  if (!testRef) {
    problems.push(
      'No se pudo deducir a qué proyecto apunta SUPABASE_TEST_DB_URL, así que no se ' +
        'puede descartar que sea el de la aplicación. Usá la URI que da el dashboard ' +
        '(Session pooler o conexión directa).',
    );
  }

  if (problems.length > 0) return { ok: false, problems };

  return { ok: true, connectionString: dbUrl, projectRef: testRef };
}
