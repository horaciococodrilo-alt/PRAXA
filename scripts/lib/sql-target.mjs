import { inspectConnectionUrl, isSharedTransactionPooler, roleUserRef } from '../../src/modules/integrations/db/connection-url.mjs';
import { dbUrlHasPlaceholderPassword, dbUrlIsParsable, refFromApiUrl, refFromDbUrl, sameProject, testDbUrlHasUnsupportedQuery } from './target.mjs';

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

/** Referencia de proyecto del usuario `praxa_integrations.<ref>`, o null si no se deduce. */
function roleRef(url) {
  let username;
  try { username = decodeURIComponent(url.username); }
  catch { return null; }
  return roleUserRef(username);
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

  const role = inspectConnectionUrl(roleUrl);
  const reference = env.SUPABASE_TEST_DB_URL ? inspectConnectionUrl(env.SUPABASE_TEST_DB_URL, { allowTls: true }) : null;
  const app = env.SUPABASE_DB_URL ? inspectConnectionUrl(env.SUPABASE_DB_URL, { allowTls: true }) : null;
  if (!role.ok) problems.push(role.problem);
  if (reference && !reference.ok) problems.push(`SUPABASE_TEST_DB_URL: ${reference.problem}`);
  if (app && !app.ok) problems.push(`SUPABASE_DB_URL: ${app.problem}`);
  if (!dbUrlIsParsable(roleUrl)) problems.push('PRAXA_INTEGRATIONS_TEST_DB_URL no es una cadena de conexión válida.');
  if (dbUrlHasPlaceholderPassword(roleUrl)) problems.push('PRAXA_INTEGRATIONS_TEST_DB_URL contiene el marcador [YOUR-PASSWORD].');

  const sql = resolveSqlTestTarget(env);
  if (!sql.ok) problems.push(...sql.problems);

  let projectRef = null;
  if (role.ok) {
    projectRef = roleRef(role.url);
    if (!projectRef) problems.push('La URL del rol debe usar praxa_integrations.<ref>.');
    if (!isSharedTransactionPooler(role.url, roleUrl)) {
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
  if (sameProject(projectRef, appDbRef) || sameProject(projectRef, appApiRef)) {
    problems.push('La URL del rol apunta al proyecto de la aplicación.');
  }
  // Por referencia de proyecto, no por cadena: otro host del pooler o la contraseña
  // codificada de otra forma siguen apuntando al mismo proyecto (H-E1-55).
  if (env.PRAXA_INTEGRATIONS_DB_URL) {
    let runtimeRef = null;
    try { runtimeRef = roleRef(new URL(env.PRAXA_INTEGRATIONS_DB_URL)); }
    catch { /* indeducible */ }
    if (!runtimeRef) problems.push('No se pudo deducir el proyecto de PRAXA_INTEGRATIONS_DB_URL.');
    else if (sameProject(runtimeRef, projectRef)) {
      problems.push('La URL del rol de pruebas apunta al mismo proyecto que la URL de runtime.');
    }
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
  const appDbRef = refFromDbUrl(appDbUrl);
  const appApiRef = refFromApiUrl(appApiUrl);
  const testApiRef = refFromApiUrl(testApiUrl);

  // Coincidencia por cadena exacta: el caso más obvio de copiar y pegar mal.
  if (appDbUrl && dbUrl === appDbUrl) {
    problems.push(
      'SUPABASE_TEST_DB_URL es idéntica a SUPABASE_DB_URL: apuntaría a la base de la ' +
        'aplicación.',
    );
  }

  // Coincidencia por proyecto, que atrapa además el caso de dos cadenas distintas
  // (pooler y conexión directa) hacia el mismo proyecto.
  if (sameProject(testRef, appDbRef) || sameProject(testRef, appApiRef)) {
    problems.push(
      `SUPABASE_TEST_DB_URL apunta al proyecto ${testRef}, que es el de la aplicación. ` +
        'Usá un proyecto aparte y desechable.',
    );
  }

  if (testApiUrl && appApiUrl && (testApiUrl === appApiUrl || sameProject(testApiRef, appApiRef))) {
    problems.push(
      'SUPABASE_TEST_URL y NEXT_PUBLIC_SUPABASE_URL son el mismo proyecto.',
    );
  }

  if (testDbUrlHasUnsupportedQuery(dbUrl)) {
    problems.push('SUPABASE_TEST_DB_URL contiene parámetros de conexión no permitidos.');
  }

  if (sameProject(testApiRef, appDbRef) || (testApiRef && testRef && testApiRef !== testRef)) {
    problems.push('SUPABASE_TEST_URL no identifica el proyecto SQL de pruebas separado de la aplicación.');
  }
  if (appDbUrl && !appDbRef) problems.push('No se pudo deducir el proyecto de SUPABASE_DB_URL.');
  if (appApiUrl && !appApiRef) problems.push('No se pudo deducir el proyecto de NEXT_PUBLIC_SUPABASE_URL.');
  if (testApiUrl && !testApiRef) problems.push('No se pudo deducir el proyecto de SUPABASE_TEST_URL.');

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
