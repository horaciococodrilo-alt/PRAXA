import { spawnSync } from 'node:child_process';

import { loadEnv } from './lib/env.mjs';
import { requireTarget } from './lib/target.mjs';

/**
 * Único procedimiento de migración del proyecto.
 *
 * Envuelve `supabase db push --db-url <cadena>`, que aplica las migraciones pendientes y
 * registra cada una en `supabase_migrations.schema_migrations` del proyecto remoto. Ese
 * historial es lo que evita reaplicar todo en la corrida siguiente; aplicar el SQL a mano
 * desde el dashboard lo deja vacío, y por eso este es el camino y no una opción más.
 *
 * Se usa `--db-url` en vez de `--linked` a propósito: no requiere `supabase login` ni
 * `supabase link`, así que no hace falta un token de acceso personal —que en Supabase es
 * una credencial de alcance amplio sobre la cuenta— para una tarea que solo necesita
 * conectarse a una base. Menos credenciales, menos superficie.
 *
 * Antes de invocar a la CLI:
 *   1. verifica que la base a migrar sea la del proyecto que usa la aplicación;
 *   2. le pasa el entorno de `.env.local`, porque la CLI no lee ese archivo.
 *
 * `--dry-run` muestra qué se aplicaría sin aplicar nada, y sin contenedores (a diferencia
 * de `supabase db diff`, que sí los usa).
 */

const dryRun = process.argv.includes('--dry-run');
const toTestProject = process.argv.includes('--test');

const scope = toTestProject ? 'test' : 'app';
const target = requireTarget(scope, { requireDbUrl: true });

console.log(
  `${toTestProject ? 'Proyecto de PRUEBAS' : 'Proyecto de la aplicación'} verificado: ` +
    (target.dbRef ?? '(no deducible de la cadena de conexión)'),
);

const env = loadEnv();
const dbUrl = toTestProject ? env.SUPABASE_TEST_DB_URL : env.SUPABASE_DB_URL;

const args = ['supabase', 'db', 'push', '--db-url', dbUrl];
if (dryRun) args.push('--dry-run');

console.log(
  dryRun
    ? '\nVista previa de migraciones (no se aplica nada)...\n'
    : '\nAplicando migraciones al proyecto remoto...\n',
);

const result = spawnSync('npx', args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  console.error(
    '\nSi el error menciona autenticación o la contraseña, revisá que SUPABASE_DB_URL\n' +
      'tenga la contraseña real (no el marcador [YOUR-PASSWORD]) y codificada en\n' +
      'porcentaje si tiene caracteres especiales.\n',
  );
}

process.exit(result.status ?? 1);
