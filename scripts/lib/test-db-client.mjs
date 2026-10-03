import { inspectConnectionUrl, supabaseTlsConfig } from '../../src/modules/integrations/db/connection-url.mjs';
import { testDbUrlHasUnsupportedQuery } from './target.mjs';

/** Configuración de pg para conexiones administrativas al proyecto desechable. */
export function verifiedTestDbConfig(connectionString, applicationName) {
  // Misma guarda de forma que el resolvedor de destino de pruebas, con el mismo
  // `allowTls` para la URL administrativa: las tres guardas aceptan las mismas URLs,
  // sin diverger en los campos que no cubría el chequeo propio anterior (H-E1-60).
  if (!inspectConnectionUrl(connectionString, { allowTls: true }).ok) {
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
    ...supabaseTlsConfig(),
    application_name: applicationName,
  };
}
