import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

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

/** Ruta relativa con `/` → contenido, de src/ y el proxy; se lee una sola vez (H-E1-58). */
let sources: Map<string, string>;

/** Archivos de src/ y el proxy cuyo contenido cumple `matches`. */
function filesWhere(matches: (content: string) => boolean): string[] {
  return [...sources].filter(([, content]) => matches(content)).map(([file]) => file);
}

beforeAll(async () => {
  // El proxy vive en src/ (H-E1-75), así que lo cubre la misma recorrida.
  const files = await collectFiles(join(projectRoot, 'src'));
  sources = new Map(await Promise.all(files.map(async (file) => [
    relative(projectRoot, file).replaceAll('\\', '/'), await readFile(file, 'utf8'),
  ] as const)));
});

describe('la aplicación no usa credenciales privilegiadas', () => {
  it('ningún archivo de src/ ni el proxy menciona una clave de servicio', () => {
    const offenders: string[] = [];

    for (const [file, content] of sources) {
      for (const token of FORBIDDEN) {
        // El propio archivo de prueba y los comentarios que explican la ausencia de la
        // clave están fuera de src/, así que cualquier aparición acá es real.
        if (content.includes(token)) {
          offenders.push(`${file} → ${token}`);
        }
      }
    }

    expect(
      offenders,
      'La aplicación debe operar solo con la clave publishable y bajo RLS. ' +
        'Una credencial privilegiada en el bundle anula el aislamiento entre empresas.',
    ).toEqual([]);
  });

  it('el proxy se revisa: está en src/ (H-E1-75)', () => {
    expect(sources.has('src/proxy.ts')).toBe(true);
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

  it('T-21: la URL del rol solo aparece en worker-api.ts y allí está presente', () => {
    expect(filesWhere((content) => content.includes('PRAXA_INTEGRATIONS_DB_URL')))
      .toEqual(['src/modules/integrations/db/worker-api.ts']);
  });

  it('T-21: worker-api.ts tiene server-only como primera sentencia', () => {
    const source = sources.get('src/modules/integrations/db/worker-api.ts') ?? '';
    const withoutLeadingComments = source.replace(/^\s*(?:(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*)(?:\r?\n|\s*))*/, '').trimStart();
    expect(withoutLeadingComments.startsWith("import 'server-only';")).toBe(true);
  });

  it('T-21: la URL de pruebas del rol no aparece en src ni proxy', () => {
    expect(filesWhere((content) => content.includes('PRAXA_INTEGRATIONS_TEST_DB_URL'))).toEqual([]);
  });

  it('T-21: solo worker-api.ts importa pg', () => {
    expect(filesWhere((content) => /(?:from\s*['"]pg['"]|require\s*\(\s*['"]pg['"]\s*\))/.test(content)))
      .toEqual(['src/modules/integrations/db/worker-api.ts']);
  });

  it('T-21: solo keyring.ts lee variables del llavero', () => {
    for (const variable of ['PRAXA_CREDENTIAL_KEYS', 'PRAXA_CREDENTIAL_KEY_CURRENT']) {
      expect(filesWhere((content) => content.includes(variable))).toEqual(['src/modules/integrations/crypto/keyring.ts']);
    }
  });
});
