import { loadEnv } from './env.mjs';

/**
 * Verifica que el proyecto remoto contra el que se va a operar sea el previsto, antes de
 * migrar o de correr pruebas.
 *
 * La comprobación cruza dos fuentes INDEPENDIENTES que el usuario copia por separado:
 *
 *   1. `NEXT_PUBLIC_SUPABASE_URL` — el proyecto contra el que habla la aplicación.
 *   2. `SUPABASE_DB_URL`          — el proyecto cuya base se va a migrar y probar.
 *
 * Si los refs no coinciden, se aborta: migrar una base distinta de la que usa la
 * aplicación es exactamente el accidente que hay que evitar. No hace falta declarar el
 * ref a mano: se deduce de ambas cadenas, así que no hay una tercera copia que mantener
 * sincronizada.
 */

/** Ref de una URL de API: https://<ref>.supabase.co */
export function refFromApiUrl(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const match = host.match(/^([a-z0-9]{20})\.supabase\.(co|in|red)$/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Ref de una cadena de conexión a PostgreSQL. Contempla las dos formas que entrega
 * Supabase:
 *   - pooler:  postgresql://postgres.<ref>:...@aws-0-<region>.pooler.supabase.com:5432/postgres
 *   - directa: postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres
 */
export function refFromDbUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);

    const fromUser = parsed.username.match(/^postgres\.([a-z0-9]{20})$/i);
    if (fromUser) return fromUser[1];

    const fromHost = parsed.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.(co|in|red)$/i);
    if (fromHost) return fromHost[1];

    return null;
  } catch {
    return null;
  }
}

/** La cadena de conexión debe parsear; si no, casi siempre es la contraseña sin codificar. */
export function dbUrlIsParsable(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return Boolean(parsed.hostname) && parsed.protocol.startsWith('postgres');
  } catch {
    return false;
  }
}

/**
 * Detecta el error más común al copiar la URI del dashboard: dejar el marcador
 * `[YOUR-PASSWORD]` sin reemplazar. El dashboard lo entrega entre corchetes y al pegarlo
 * suele quedar codificado como %5BYOUR-PASSWORD%5D, así que se compara ya decodificado.
 *
 * Vale la pena atajarlo acá: si no, el fallo aparece recién como un
 * "password authentication failed" del servidor, que no dice qué corregir.
 */
export function dbUrlHasPlaceholderPassword(url) {
  if (!url) return false;
  try {
    const { password } = new URL(url);
    let decoded = password;
    try {
      decoded = decodeURIComponent(password);
    } catch {
      /* se compara sin decodificar */
    }
    return /your[-_ ]?password/i.test(decoded) || /^\[.*\]$/.test(decoded);
  } catch {
    return false;
  }
}

/**
 * @param {'app'|'test'} scope
 * @param {{ requireDbUrl?: boolean, root?: string }} [options]
 *
 * `requireDbUrl` distingue las dos cosas que se hacen con un proyecto:
 *   - migrarlo o correr pgTAP  → hace falta la cadena de conexión;
 *   - usarlo desde la API REST → alcanza con la URL y la clave.
 * Por eso el proyecto de pruebas solo necesita su cadena cuando se lo migra.
 */
export function resolveTarget(scope, options = {}) {
  const { requireDbUrl = scope === 'app', root = process.cwd() } = options;
  const env = loadEnv(root);
  const problems = [];
  const notes = [];

  const apiUrl = scope === 'test' ? env.SUPABASE_TEST_URL : env.NEXT_PUBLIC_SUPABASE_URL;
  const apiRef = refFromApiUrl(apiUrl);
  const dbUrlName = scope === 'test' ? 'SUPABASE_TEST_DB_URL' : 'SUPABASE_DB_URL';

  if (!apiUrl) {
    problems.push(
      scope === 'test'
        ? 'Falta SUPABASE_TEST_URL: no se sabe contra qué proyecto correrían las pruebas.'
        : 'Falta NEXT_PUBLIC_SUPABASE_URL: no se sabe cuál es el proyecto de la aplicación.',
    );
  }

  let dbRef = null;
  const dbUrl = env[dbUrlName];

  if (requireDbUrl) {
    if (!dbUrl) {
      problems.push(
        `Falta ${dbUrlName}: es la cadena de conexión para migrar y correr pgTAP. ` +
          'Dashboard → Connect → Session pooler.',
      );
    } else if (/^https?:\/\//i.test(dbUrl.trim())) {
      // Confusión habitual: el dashboard muestra las dos cosas y ambas llevan el ref.
      problems.push(
        `${dbUrlName} tiene la URL de la API (https://…), no la cadena de conexión a ` +
          'PostgreSQL. La que hace falta empieza con `postgresql://` y contiene ' +
          '`pooler.supabase.com:5432`. Dashboard del proyecto → Connect → Direct ' +
          'Connection string → Session pooler.',
      );
    } else if (!dbUrlIsParsable(dbUrl)) {
      problems.push(
        `${dbUrlName} no parece una cadena de conexión válida. Si la contraseña tiene ` +
          'caracteres especiales (@ : / ? # etc.), hay que codificarla en porcentaje.',
      );
    } else if (dbUrlHasPlaceholderPassword(dbUrl)) {
      problems.push(
        `${dbUrlName} todavía tiene el marcador [YOUR-PASSWORD] en lugar de la ` +
          'contraseña real de la base. Reemplazá ese marcador completo —corchetes ' +
          'incluidos— por la contraseña del proyecto (Dashboard → Project Settings → ' +
          'Database; ahí también podés reiniciarla si no la tenés).',
      );
    } else {
      dbRef = refFromDbUrl(dbUrl);

      // La forma "Direct connection" solo resuelve por IPv6. No se bloquea —en una red
      // con IPv6 funciona— pero se avisa antes, porque si no el fallo llega como un
      // ENOTFOUND que no sugiere la causa.
      if (/^db\./i.test(new URL(dbUrl).hostname)) {
        notes.push(
          `${dbUrlName} usa la conexión directa (db.<ref>.supabase.co), que solo resuelve ` +
            'por IPv6. Si falla con ENOTFOUND, cambiala por la de Session pooler ' +
            '(Connect → Direct Connection string → Session pooler).',
        );
      }

      if (!dbRef) {
        notes.push(
          `No se pudo deducir el proyecto desde ${dbUrlName} (¿self-hosted o dominio ` +
            'propio?). Se omite el cruce de proyectos.',
        );
      } else if (apiRef && dbRef !== apiRef) {
        problems.push(
          `${dbUrlName} apunta al proyecto ${dbRef}, pero la URL de ese entorno usa ` +
            `${apiRef}. Migrar o probar una base distinta de la prevista casi siempre es ` +
            'un error de copiado.',
        );
      }
    }
  } else if (dbUrl && dbUrlIsParsable(dbUrl)) {
    dbRef = refFromDbUrl(dbUrl);
  }

  if (apiUrl && !apiRef) {
    notes.push(`No se pudo deducir el proyecto desde la URL de ${scope === 'test' ? 'pruebas' : 'la aplicación'}.`);
  }

  if (scope === 'test') {
    const appUrl = env.NEXT_PUBLIC_SUPABASE_URL;

    if (apiUrl && appUrl && apiUrl === appUrl && env.SUPABASE_TEST_ALLOW_APP_PROJECT !== 'true') {
      problems.push(
        'SUPABASE_TEST_URL apunta al mismo proyecto que la aplicación. Usá un proyecto ' +
          'aparte, o definí SUPABASE_TEST_ALLOW_APP_PROJECT=true si ese proyecto también ' +
          'es desechable.',
      );
    }

    if (env.SUPABASE_TEST_IS_DISPOSABLE !== 'yes-this-project-is-disposable') {
      problems.push(
        'Falta SUPABASE_TEST_IS_DISPOSABLE=yes-this-project-is-disposable. Estas pruebas ' +
          'crean y borran usuarios y empresas: nunca deben tocar una base de producción.',
      );
    }
  }

  return { env, apiRef, dbRef, problems, notes, ok: problems.length === 0 };
}

/** Aborta con un mensaje claro si el destino no está verificado. */
export function requireTarget(scope, options = {}) {
  const target = resolveTarget(scope, options);

  for (const note of target.notes) console.log(`  nota: ${note}`);

  if (!target.ok) {
    console.error(
      `\nDestino remoto NO verificado (${
        scope === 'test' ? 'proyecto de pruebas' : 'proyecto de la aplicación'
      }):\n`,
    );
    for (const problem of target.problems) console.error(`  - ${problem}`);
    console.error('\nVer README.md, sección "Puesta en marcha".\n');
    process.exit(1);
  }

  return target;
}
