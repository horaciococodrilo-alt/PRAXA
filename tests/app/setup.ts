import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { config } from 'dotenv';

/**
 * Carga `.env.local` antes de que se evalúen los archivos de prueba, para no tener que
 * exportar las variables a mano en cada shell.
 *
 * No sobreescribe variables ya presentes en el entorno: en CI mandan las del runner.
 */
const envFile = join(process.cwd(), '.env.local');
if (existsSync(envFile)) {
  config({ path: envFile, override: false, quiet: true });
}
