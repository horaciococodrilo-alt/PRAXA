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
});
