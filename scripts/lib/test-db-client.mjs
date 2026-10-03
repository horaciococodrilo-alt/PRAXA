import { AMBIGUOUS_ENCODING } from '../../src/modules/integrations/db/connection-url.mjs';
import { SUPABASE_ROOT_CA } from '../../src/modules/integrations/db/supabase-root-ca.mjs';
import { testDbUrlHasUnsupportedQuery } from './target.mjs';

/** Configuración de pg para conexiones administrativas al proyecto desechable. */
export function verifiedTestDbConfig(connectionString, applicationName) {
  if (typeof connectionString !== 'string' || AMBIGUOUS_ENCODING.test(connectionString)) {
    throw new Error('SUPABASE_TEST_DB_URL no es válida.');
  }

  let url;
  try { url = new URL(connectionString); }
  catch { throw new Error('SUPABASE_TEST_DB_URL no es válida.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.hash) {
    throw new Error('SUPABASE_TEST_DB_URL no es válida.');
  }

  // pg-connection-string da prioridad a los parámetros de la URL sobre `ssl`.
  // La spec permite sslmode=require en la URL administrativa; se elimina antes de
  // entregar la cadena a pg y se configura verificación completa aquí.
  if (testDbUrlHasUnsupportedQuery(connectionString)) {
    throw new Error('SUPABASE_TEST_DB_URL contiene parámetros de conexión no permitidos.');
  }

  return {
    connectionString: connectionString.split('?')[0],
    sslnegotiation: /** @type {const} */ ('postgres'),
    ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true },
    application_name: applicationName,
  };
}
