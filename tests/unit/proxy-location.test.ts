import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

/**
 * Next.js 16 solo carga el proxy si está al mismo nivel que app/. Con la aplicación en
 * src/app, tiene que ser src/proxy.ts; en la raíz se ignora sin ningún aviso (H-E1-75).
 */
describe('ubicación del proxy', () => {
  it('está en src/, junto a app/', async () => {
    expect(await exists(join(projectRoot, 'src', 'app'))).toBe(true);
    expect(await exists(join(projectRoot, 'src', 'proxy.ts'))).toBe(true);
  });

  it('no hay otro proxy ni middleware fuera de src/ que se pueda confundir con el real', async () => {
    for (const name of ['proxy.ts', 'proxy.js', 'middleware.ts', 'middleware.js']) {
      expect(await exists(join(projectRoot, name)), name).toBe(false);
    }
  });
});
