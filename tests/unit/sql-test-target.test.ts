import { describe, expect, it } from 'vitest';

import { DISPOSABLE_ACK, resolveSqlTestTarget } from '../../scripts/lib/sql-target.mjs';

/**
 * Elección del destino de las pruebas SQL.
 *
 * Se prueba la función pura, sin abrir ninguna conexión: comprobar que el destino
 * equivocado se rechaza no debe requerir apuntar a la base de la aplicación.
 */

const APP_REF = 'aaaaaaaaaaaaaaaaaaaa';
const TEST_REF = 'bbbbbbbbbbbbbbbbbbbb';

const pooler = (ref: string) =>
  `postgresql://postgres.${ref}:secreta@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;

const direct = (ref: string) =>
  `postgresql://postgres:secreta@db.${ref}.supabase.co:5432/postgres`;

function baseEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: `https://${APP_REF}.supabase.co`,
    SUPABASE_DB_URL: pooler(APP_REF),
    SUPABASE_TEST_URL: `https://${TEST_REF}.supabase.co`,
    SUPABASE_TEST_DB_URL: pooler(TEST_REF),
    SUPABASE_TEST_IS_DISPOSABLE: DISPOSABLE_ACK,
    ...overrides,
  };
}

function problemsOf(env: Record<string, string | undefined>) {
  const result = resolveSqlTestTarget(env);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('se esperaba un rechazo');
  return result.problems.join(' | ');
}

describe('destino de las pruebas SQL', () => {
  it('acepta una configuración correcta y devuelve la base de pruebas', () => {
    const result = resolveSqlTestTarget(baseEnv());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.connectionString).toBe(pooler(TEST_REF));
    expect(result.projectRef).toBe(TEST_REF);
  });

  it('rechaza cuando falta la configuración, sin caer a la base de la aplicación', () => {
    const problems = problemsOf(baseEnv({ SUPABASE_TEST_DB_URL: undefined }));

    expect(problems).toMatch(/Falta SUPABASE_TEST_DB_URL/);
    // Lo importante: no propone ni usa la de la aplicación.
    expect(problems).toMatch(/No se usa SUPABASE_DB_URL/);
  });

  it('rechaza si el proyecto no está declarado desechable', () => {
    expect(problemsOf(baseEnv({ SUPABASE_TEST_IS_DISPOSABLE: 'True' }))).toMatch(
      /desechable/i,
    );
    expect(problemsOf(baseEnv({ SUPABASE_TEST_IS_DISPOSABLE: undefined }))).toMatch(
      /desechable/i,
    );
  });

  it('rechaza si el destino es literalmente la base de la aplicación', () => {
    const problems = problemsOf(baseEnv({ SUPABASE_TEST_DB_URL: pooler(APP_REF) }));
    expect(problems).toMatch(/proyecto de la aplicación|es idéntica/i);
  });

  it('rechaza si apunta al mismo proyecto por otra forma de conexión', () => {
    // Cadenas distintas (pooler vs. directa) pero el mismo proyecto: no alcanza con
    // comparar las cadenas.
    const problems = problemsOf(baseEnv({ SUPABASE_TEST_DB_URL: direct(APP_REF) }));
    expect(problems).toMatch(new RegExp(APP_REF));
  });

  it('rechaza si las URL de API de pruebas y aplicación coinciden', () => {
    const problems = problemsOf(
      baseEnv({ SUPABASE_TEST_URL: `https://${APP_REF}.supabase.co` }),
    );
    expect(problems).toMatch(/mismo proyecto/i);
  });

  it('rechaza si no se puede deducir a qué proyecto apunta', () => {
    const problems = problemsOf(
      baseEnv({ SUPABASE_TEST_DB_URL: 'postgresql://usuario:clave@base.interna:5432/postgres' }),
    );
    expect(problems).toMatch(/no se puede descartar que sea el de la aplicación/i);
  });

  it('rechaza una cadena inválida o con el marcador sin reemplazar', () => {
    expect(problemsOf(baseEnv({ SUPABASE_TEST_DB_URL: 'no-es-una-url' }))).toMatch(
      /no es una cadena de conexión válida/i,
    );
    expect(
      problemsOf(
        baseEnv({
          SUPABASE_TEST_DB_URL: `postgresql://postgres.${TEST_REF}:%5BYOUR-PASSWORD%5D@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
        }),
      ),
    ).toMatch(/YOUR-PASSWORD/);
  });

  it('funciona aunque la aplicación no esté configurada en este entorno', () => {
    const result = resolveSqlTestTarget(
      baseEnv({ SUPABASE_DB_URL: undefined, NEXT_PUBLIC_SUPABASE_URL: undefined }),
    );
    expect(result.ok).toBe(true);
  });
});
