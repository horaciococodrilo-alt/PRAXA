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
