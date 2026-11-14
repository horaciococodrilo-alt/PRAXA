import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * M26a-T-28: la clave de Anthropic solo se lee en `provider.ts` y no hay claves ni valores
 * literales en el árbol. `docs/` queda fuera: puede nombrar el prefijo sin que sea una clave
 * (T-30 lo revisa aparte con la forma completa). Nunca imprime coincidencias, solo rutas.
 */

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const self = 'tests/unit/diagnostics-secrets.test.ts';
const VARIABLE = ['ANTHROPIC', 'API', 'KEY'].join('_');
const LITERAL_KEY = new RegExp(['sk', 'ant', ''].join('-') + '[A-Za-z0-9_-]{20,}');
const LITERAL_VALUE = new RegExp(`${VARIABLE}=(?!<[^>\\r\\n]*>)[^\\s#'"\`][^\\r\\n]*`);
const ROOT_CONFIG = /^[^/]+\.(json|ts|mts|mjs|cjs|js|example|yaml|yml|toml)$/;

function tracked(): string[] {
  const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, encoding: 'buffer' });
  return Buffer.from(out).toString('utf8').split('\0').filter(Boolean).map((p) => p.replaceAll('\\', '/'));
}

function inScope(path: string): boolean {
  if (path === self) return false;
  if (path.startsWith('docs/')) return false;
  return path.startsWith('src/') || path.startsWith('tests/') || path.startsWith('scripts/')
    || path.startsWith('supabase/') || ROOT_CONFIG.test(path) || path === '.env.example';
}

function read(path: string): string | null {
  try { return readFileSync(join(root, path), 'utf8'); } catch { return null; }
}

describe('M26a-T-28: clave de Anthropic', () => {
  const files = tracked();

  it('bajo src/, la variable solo aparece en provider.ts', () => {
    const readers = files.filter((p) => p.startsWith('src/') && read(p)?.includes(VARIABLE));
    expect(readers).toEqual(['src/modules/diagnostics/provider.ts']);
  });

  it('ningún archivo del alcance contiene una clave literal', () => {
    const offenders = files.filter(inScope).filter((p) => LITERAL_KEY.test(read(p) ?? ''));
    expect(offenders).toEqual([]);
  });

  it('ningún archivo del alcance asigna un valor literal a la variable', () => {
    const offenders = files.filter(inScope).filter((p) => LITERAL_VALUE.test(read(p) ?? ''));
    expect(offenders).toEqual([]);
  });

  it('el detector reconoce los casos que debe rechazar y admite los marcadores', () => {
    const key = ['sk', 'ant', 'api03', 'A'.repeat(24)].join('-');
    expect(LITERAL_KEY.test(`const k = '${key}'`)).toBe(true);
    expect(LITERAL_KEY.test('el prefijo sk-ant- de las claves')).toBe(false);
    expect(LITERAL_VALUE.test(`${VARIABLE}=valor-cualquiera`)).toBe(true);
    expect(LITERAL_VALUE.test(`${VARIABLE}=`)).toBe(false);
    expect(LITERAL_VALUE.test(`${VARIABLE}=<tu clave>`)).toBe(false);
    // El arnés de eval asigna desde el entorno en tiempo de ejecución, sin literal.
    expect(LITERAL_VALUE.test(`process.env.${VARIABLE} = configured.${VARIABLE}`)).toBe(false);
  });

  it('el módulo de diagnóstico no registra contenido: una sola salida de log, de forma fija', () => {
    const calls = files.filter((p) => p.startsWith('src/modules/diagnostics/')).flatMap((p) =>
      [...(read(p) ?? '').matchAll(/console\.\w+\(.*\)/g)].map((m) => `${p}: ${m[0]}`));
    expect(calls).toEqual(['src/modules/diagnostics/orchestrator.ts: console.warn(failureLine(step, failureClass, httpStatus))']);
  });
});
