import { describe, expect, it } from 'vitest';

import { runPreflight } from '../../scripts/ga4-preflight.mjs';

const CLIENT_ID = '12345-sintetico.apps.googleusercontent.com';
const CLIENT_SECRET = 'secreto-sintetico';
const REDIRECT_URI = 'https://ejemplo.invalid/api/integraciones/ga4/callback';
const VALID = {
  GOOGLE_OAUTH_CLIENT_ID: CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET: CLIENT_SECRET,
  GOOGLE_OAUTH_REDIRECT_URI: REDIRECT_URI,
};

function run(env: Record<string, string | undefined>) {
  const lines: string[] = [];
  const code = runPreflight({ env, log: (line: string) => lines.push(line) });
  expect(lines).toHaveLength(1);
  return { code, line: lines[0], result: JSON.parse(lines[0]) as Record<string, string> };
}

describe('M16f paso 1: preflight local de Google OAuth', () => {
  it('acepta las tres variables y solo imprime estados cerrados', () => {
    const { code, line, result } = run(VALID);
    expect(code).toBe(0);
    expect(result).toEqual({
      preflight: 'ok', GOOGLE_OAUTH_CLIENT_ID: 'ok',
      GOOGLE_OAUTH_CLIENT_SECRET: 'ok', GOOGLE_OAUTH_REDIRECT_URI: 'ok',
    });
    for (const value of Object.values(VALID)) expect(line).not.toContain(value);
  });

  it('señala cada variable faltante sin imprimir las otras', () => {
    for (const name of Object.keys(VALID)) {
      const { code, line, result } = run({ ...VALID, [name]: undefined });
      expect(code).toBe(1);
      expect(result.preflight).toBe('fallido');
      expect(result[name]).toBe('falta');
      for (const value of Object.values(VALID)) expect(line).not.toContain(value);
    }
  });

  it.each([
    ['GOOGLE_OAUTH_CLIENT_ID', 'cliente-sin-prefijo.apps.googleusercontent.com'],
    ['GOOGLE_OAUTH_CLIENT_ID', '0-sintetico.apps.googleusercontent.com'],
    ['GOOGLE_OAUTH_CLIENT_SECRET', ' secreto-sintetico '],
    ['GOOGLE_OAUTH_REDIRECT_URI', 'http://ejemplo.invalid/api/integraciones/ga4/callback'],
    ['GOOGLE_OAUTH_REDIRECT_URI', 'https://ejemplo.invalid/api/integraciones/meta/callback'],
    ['GOOGLE_OAUTH_REDIRECT_URI', 'https://ejemplo.invalid/api/integraciones/ga4/callback/'],
    ['GOOGLE_OAUTH_REDIRECT_URI', 'https://ejemplo.invalid/api/integraciones/ga4/callback?code=ejemplo'],
  ])('rechaza forma inválida de %s sin volcar el valor', (name, value) => {
    const { code, line, result } = run({ ...VALID, [name]: value });
    expect(code).toBe(1);
    expect(result[name]).toBe('forma_invalida');
    expect(line).not.toContain(value.trim());
  });
});
