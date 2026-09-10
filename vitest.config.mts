import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const srcRoot = fileURLToPath(new URL('./src', import.meta.url));

/**
 * Dos proyectos separados a propósito:
 *
 *  - `unit` no necesita infraestructura ni credenciales y corre siempre (`npm test`).
 *  - `app`  corre contra un proyecto REMOTO y desechable de Supabase
 *           (`npm run test:app`). No requiere Docker. Si faltan las credenciales de
 *           prueba, se salta con un mensaje que dice exactamente qué falta. Nunca simula
 *           el backend ni la autenticación: una prueba que no se ejecutó no puede
 *           reportarse como que pasó.
 */
export default defineConfig({
  resolve: {
    alias: { '@': srcRoot },
  },
  test: {
    projects: [
      {
        resolve: { alias: { '@': srcRoot } },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        resolve: { alias: { '@': srcRoot } },
        test: {
          name: 'app',
          include: ['tests/app/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['tests/app/setup.ts'],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
