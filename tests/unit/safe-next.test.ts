import { describe, expect, it } from 'vitest';

import { safeNextPath } from '@/lib/safe-next';

/** `next` viene de la URL: nunca puede llevar a otro dominio (redirección abierta). */
describe('safeNextPath', () => {
  it.each([
    ['/app', '/app'],
    ['/app/integraciones', '/app/integraciones'],
    ['/app/reportes?id=3#resumen', '/app/reportes?id=3#resumen'],
    ['/reset-password', '/reset-password'],
  ])('acepta la ruta interna %s', (raw, esperado) => {
    expect(safeNextPath(raw)).toBe(esperado);
  });

  it.each([
    [null],
    [''],
    ['app'],
    ['//evil.example'],
    ['/\\evil.example'],
    ['/\\\\evil.example'],
    ['/\\/evil.example'],
    ['https://evil.example'],
    ['http:/evil.example'],
    ['javascript:alert(1)'],
    ['/\tevil.example'],
    ['/\n/evil.example'],
    [' /app'],
  ])('rechaza %j y usa el destino por defecto', (raw) => {
    expect(safeNextPath(raw)).toBe('/app');
  });

  it('respeta el destino por defecto indicado', () => {
    expect(safeNextPath('//evil.example', '/onboarding')).toBe('/onboarding');
  });
});
