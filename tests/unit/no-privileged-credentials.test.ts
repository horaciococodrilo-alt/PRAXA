import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Guarda de credenciales.
 *
 * La aplicación no debe contener un cliente privilegiado. Si alguien agrega una clave de
 * servicio o secreta bajo `src/` o en el proxy, esta prueba falla y explica por qué.
 *
 * No reemplaza a una revisión: comprueba una invariante concreta y verificable.
 */

const testsDir = fileURLToPath(new URL('..', import.meta.url));
const projectRoot = join(testsDir, '..');

const FORBIDDEN = [
  // Credenciales que omiten RLS.
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_TEST_SECRET_KEY',
  'SUPABASE_SECRET_KEY',
  'service_role',
  'createAdminClient',
  // Credenciales de la CLI: tampoco tienen nada que hacer en la aplicación.
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
];

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return collectFiles(full);
      return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) ? [full] : [];
    }),
  );
  return files.flat();
}

describe('la aplicación no usa credenciales privilegiadas', () => {
  it('ningún archivo de src/ ni el proxy menciona una clave de servicio', async () => {
    const files = [
      ...(await collectFiles(join(projectRoot, 'src'))),
      join(projectRoot, 'proxy.ts'),
    ];

    const offenders: string[] = [];

    for (const file of files) {
      const content = await readFile(file, 'utf8');
      for (const token of FORBIDDEN) {
        // El propio archivo de prueba y los comentarios que explican la ausencia de la
        // clave están fuera de src/, así que cualquier aparición acá es real.
        if (content.includes(token)) {
          offenders.push(`${relative(projectRoot, file)} → ${token}`);
        }
      }
    }

    expect(
      offenders,
      'La aplicación debe operar solo con la clave publishable y bajo RLS. ' +
        'Una credencial privilegiada en el bundle anula el aislamiento entre empresas.',
    ).toEqual([]);
  });

  it('.env.example no contiene valores, solo nombres de variables', async () => {
    const content = await readFile(join(projectRoot, '.env.example'), 'utf8');

    const assignmentsWithValue = content
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .filter((line) => /^[A-Z0-9_]+=.+$/.test(line.trim()))
      // La URL local del sitio es un valor por defecto público, no un secreto.
      .filter((line) => !line.startsWith('NEXT_PUBLIC_SITE_URL='));

    expect(assignmentsWithValue).toEqual([]);
  });
});
