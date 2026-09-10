import { loadEnv } from './lib/env.mjs';
import { resolveTarget } from './lib/target.mjs';

/**
 * Comprueba que el proyecto remoto sea el previsto, antes de migrar o probar.
 * Solo imprime referencias de proyecto (públicas), nunca claves ni contraseñas.
 */

const scope = process.argv[2] === 'test' ? 'test' : 'app';

// Para el proyecto de pruebas, la cadena de conexión solo hace falta para migrarlo. Si
// está cargada se valida a fondo; si no, no se exige (test:app usa la API REST).
const requireDbUrl = scope === 'app' || Boolean(loadEnv().SUPABASE_TEST_DB_URL);
const target = resolveTarget(scope, { requireDbUrl });

if (scope === 'app') {
  console.log('Destino de la aplicación y las migraciones:');
  console.log(`  proyecto según NEXT_PUBLIC_SUPABASE_URL : ${target.apiRef ?? '(no deducible)'}`);
  console.log(`  proyecto según SUPABASE_DB_URL          : ${target.dbRef ?? '(no deducible)'}`);
} else {
  console.log('Destino de las pruebas (proyecto desechable):');
  console.log(`  proyecto según SUPABASE_TEST_URL : ${target.apiRef ?? '(no deducible)'}`);
  console.log(`  proyecto según SUPABASE_TEST_DB_URL : ${target.dbRef ?? '(sin definir)'}`);
  console.log(
    `  confirmación de desechable       : ${
      target.env.SUPABASE_TEST_IS_DISPOSABLE === 'yes-this-project-is-disposable'
        ? 'presente'
        : 'FALTA'
    }`,
  );
}

for (const note of target.notes) console.log(`  nota: ${note}`);

if (!target.ok) {
  console.error('\nDestino NO verificado:\n');
  for (const problem of target.problems) console.error(`  - ${problem}`);
  console.error('');
  process.exit(1);
}

console.log('\nDestino verificado.');
