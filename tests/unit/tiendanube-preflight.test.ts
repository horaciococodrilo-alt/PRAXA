import { describe, expect, it } from 'vitest';

import { runPreflight } from '../../scripts/tiendanube-preflight.mjs';

const SECRET = 'secreto-sintetico-de-prueba';
const CONTACT = 'soporte@ejemplo.invalid';
const VALID = {
  TIENDANUBE_APP_ID: '12345',
  TIENDANUBE_CLIENT_SECRET: SECRET,
  TIENDANUBE_SUPPORT_CONTACT: CONTACT,
  TIENDANUBE_REDIRECT_URI: 'https://app.ejemplo.invalid/api/integraciones/tiendanube/callback',
};

function run(env: Record<string, string | undefined>) {
  const lines: string[] = [];
  const code = runPreflight({ env, log: (line: string) => lines.push(line) });
  expect(lines).toHaveLength(1);
  return { code, line: lines[0], out: JSON.parse(lines[0]) as Record<string, string> };
}

describe('M16e paso 3: preflight de Tiendanube', () => {
  it('con las cuatro variables bien formadas da ok, sin imprimir valores', () => {
    const { code, line, out } = run(VALID);
    expect(code).toBe(0);
    expect(out).toEqual({
      preflight: 'ok', TIENDANUBE_APP_ID: 'ok', TIENDANUBE_CLIENT_SECRET: 'ok',
      TIENDANUBE_SUPPORT_CONTACT: 'ok', TIENDANUBE_REDIRECT_URI: 'ok', TIENDANUBE_CLIENT_ID: 'ausente',
    });
    for (const value of [...Object.values(VALID), '12345']) expect(line).not.toContain(value);
  });

  it('acepta un contacto URL https y un TIENDANUBE_CLIENT_ID numérico opcional', () => {
    const { code, out } = run({ ...VALID, TIENDANUBE_SUPPORT_CONTACT: 'https://ejemplo.invalid/soporte',
      TIENDANUBE_CLIENT_ID: '67890' });
    expect(code).toBe(0);
    expect(out.TIENDANUBE_CLIENT_ID).toBe('ok');
  });

  it('falla si falta una variable obligatoria', () => {
    for (const name of Object.keys(VALID)) {
      const { code, out } = run({ ...VALID, [name]: undefined });
      expect(code).toBe(1);
      expect(out.preflight).toBe('fallido');
      expect(out[name]).toBe('falta');
    }
  });

  it.each([
    ['TIENDANUBE_APP_ID', 'app-praxa'],
    ['TIENDANUBE_APP_ID', '0123'],
    ['TIENDANUBE_CLIENT_SECRET', ' secreto-con-espacios '],
    ['TIENDANUBE_SUPPORT_CONTACT', 'no es un contacto'],
    ['TIENDANUBE_SUPPORT_CONTACT', 'http://ejemplo.invalid/soporte'],
    ['TIENDANUBE_REDIRECT_URI', 'http://app.ejemplo.invalid/api/integraciones/tiendanube/callback'],
    ['TIENDANUBE_REDIRECT_URI', 'https://app.ejemplo.invalid/api/integraciones/meta/callback'],
    ['TIENDANUBE_REDIRECT_URI', 'https://app.ejemplo.invalid/api/integraciones/tiendanube/callback/'],
    ['TIENDANUBE_REDIRECT_URI', 'https://app.ejemplo.invalid/api/integraciones/tiendanube/callback?x=1'],
    ['TIENDANUBE_REDIRECT_URI', 'https://partners.ejemplo.invalid/applications/authentication/1'],
    ['TIENDANUBE_CLIENT_ID', 'cliente'],
  ])('rechaza %s con forma inválida', (name, value) => {
    const { code, line, out } = run({ ...VALID, [name]: value });
    expect(code).toBe(1);
    expect(out[name]).toBe('forma_invalida');
    expect(line).not.toContain(value.trim());
  });
});
