import { describe, expect, it } from 'vitest';

import { safeNextPath } from '@/lib/safe-next';

describe('ruta posterior a la autenticación', () => {
  it('conserva rutas internas con consulta y fragmento', () => {
    expect(safeNextPath('/app/contexto?tab=ventas#resumen')).toBe('/app/contexto?tab=ventas#resumen');
  });

  it.each([
    null,
    'https://evil.example/',
    '//evil.example/',
    '/\\evil.example/',
    '/app\\evil.example',
    'javascript:alert(1)',
  ])('rechaza un destino externo o ambiguo: %s', (value) => {
    expect(safeNextPath(value)).toBe('/app');
  });

  it.each([
    '/.//evil.example',
    '/a/..//evil.example',
    '/%2e//evil.example',
    '/./%2e//evil.example/ruta?x=1',
  ])('H-E1-53 rechaza rutas que la normalización vuelve relativas al protocolo: %s', (value) => {
    expect(safeNextPath(value)).toBe('/app');
  });
});

// Variantes encontradas en el QA del frontend (MF_FRONTEND, H-E1-74): la barra invertida
// después de la primera, que el navegador convierte en `//`.
describe('ruta posterior a la autenticación: casos del QA del frontend', () => {
  it.each(['/app/integraciones', '/reset-password', '/onboarding'])('acepta la ruta interna %s', (value) => {
    expect(safeNextPath(value)).toBe(value);
  });

  it.each(['', 'app', ' /app', 'http:/evil.example', '/\\\\evil.example', '/\\/evil.example', '/\n/evil.example'])(
    'rechaza %j',
    (value) => {
      expect(safeNextPath(value)).toBe('/app');
    },
  );
});
