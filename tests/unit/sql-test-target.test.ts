import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { DISPOSABLE_ACK, resolveIntegrationsTestTarget, resolveSqlTestTarget } from '../../scripts/lib/sql-target.mjs';
import { resolveTarget } from '../../scripts/lib/target.mjs';

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
const roleUrl = (ref: string) =>
  `postgresql://praxa_integrations.${ref}:secreta@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

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

describe('M06.3a paso 3 RED: destino del rol de integraciones', () => {
  it('T-22 acepta solo el rol del proyecto desechable por shared transaction pooler', () => {
    const result = resolveIntegrationsTestTarget(baseEnv({ PRAXA_INTEGRATIONS_TEST_DB_URL: roleUrl(TEST_REF) }));
    expect(result).toMatchObject({ ok: true, projectRef: TEST_REF, connectionString: roleUrl(TEST_REF) });
  });

  it('T-22 falla sin URL propia y no propone la URL runtime', () => {
    const result = resolveIntegrationsTestTarget(baseEnv({ PRAXA_INTEGRATIONS_DB_URL: roleUrl(TEST_REF) }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems?.join(' ')).toMatch(/Falta PRAXA_INTEGRATIONS_TEST_DB_URL/);
    expect(result.problems?.join(' ')).toMatch(/No se usa PRAXA_INTEGRATIONS_DB_URL/);
  });

  it('T-22 rechaza rol, proyecto, desechabilidad, marcador y fallback incorrectos', () => {
    const variants = [
      { PRAXA_INTEGRATIONS_TEST_DB_URL: pooler(TEST_REF) },
      { PRAXA_INTEGRATIONS_TEST_DB_URL: roleUrl(APP_REF) },
      { PRAXA_INTEGRATIONS_TEST_DB_URL: roleUrl(TEST_REF), PRAXA_INTEGRATIONS_DB_URL: roleUrl(TEST_REF) },
      { PRAXA_INTEGRATIONS_TEST_DB_URL: roleUrl(TEST_REF), SUPABASE_TEST_DB_URL: pooler(APP_REF) },
      { PRAXA_INTEGRATIONS_TEST_DB_URL: roleUrl(TEST_REF), SUPABASE_TEST_DB_URL: 'no-es-una-url' },
      { PRAXA_INTEGRATIONS_TEST_DB_URL: roleUrl(TEST_REF), SUPABASE_TEST_IS_DISPOSABLE: undefined },
      { PRAXA_INTEGRATIONS_TEST_DB_URL: roleUrl(TEST_REF).replace(':secreta@', ':%5BYOUR-PASSWORD%5D@') },
    ];
    for (const variant of variants) expect(resolveIntegrationsTestTarget(baseEnv(variant)).ok).toBe(false);
  });

  it('T-22 rechaza una referencia SQL de app configurada pero indeducible', () => {
    const result = resolveIntegrationsTestTarget(baseEnv({
      PRAXA_INTEGRATIONS_TEST_DB_URL: roleUrl(TEST_REF),
      SUPABASE_DB_URL: 'postgresql://usuario:clave@db.example.test:5432/postgres',
      SUPABASE_TEST_URL: undefined,
      NEXT_PUBLIC_SUPABASE_URL: `https://${TEST_REF}.supabase.co`,
    }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems?.join(' ')).toMatch(/no se pudo deducir.*SUPABASE_DB_URL/i);
    expect(result.problems?.join(' ')).not.toContain('db.example.test');
  });

  it('T-22 contrasta por separado las referencias SQL y pública de app', () => {
    const result = resolveIntegrationsTestTarget(baseEnv({
      PRAXA_INTEGRATIONS_TEST_DB_URL: roleUrl(TEST_REF),
      SUPABASE_TEST_URL: undefined,
      NEXT_PUBLIC_SUPABASE_URL: `https://${TEST_REF}.supabase.co`,
    }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems?.join(' ')).toMatch(/proyecto de la aplicación/i);
  });

  it('T-22/T-49 rechaza 5432, puerto ausente, host falso y overrides de URL', () => {
    const variants = [
      roleUrl(TEST_REF).replace(':6543/', ':5432/'),
      roleUrl(TEST_REF).replace(':6543/', '/'),
      roleUrl(TEST_REF).replace('aws-0-us-east-1.pooler.supabase.com', 'db.example.com'),
      roleUrl(TEST_REF).replace('aws-0-us-east-1.pooler.supabase.com', 'aws-0-us-east-1.pooler.supabase.com.evil.test'),
      // Q-04 de qa-review-4: puerto no canónico, aunque new URL() lo normalice a 6543.
      roleUrl(TEST_REF).replace(':6543/', ':06543/'),
      // Q-02/Q-C26-c de qa-review-4: usuario codificado combinado con un espacio o un
      // `%` no hexadecimal en otra parte dispara la re-codificación de pg-connection-string,
      // que deja el usuario efectivo de pg distinto del validado por esta guarda.
      roleUrl(TEST_REF).replace('praxa_integrations.', 'praxa%5Fintegrations.').replace(':secreta@', ':sec reta@'),
      `${roleUrl(TEST_REF).replace('praxa_integrations.', 'praxa%5Fintegrations.')}%zz`,
      `${roleUrl(TEST_REF).replace('praxa_integrations.', 'praxa%5Fintegrations.')}?application_name=a%zz`,
      // Q-01/H-E1-48 de qa-review-6: el `%` ambiguo cae en el último o penúltimo
      // carácter de toda la cadena, donde no hay carácter siguiente que inspeccionar.
      `${roleUrl(TEST_REF)}%`,
      `${roleUrl(TEST_REF)}%4`,
      ...['user=x', 'host=x', 'port=5432', 'user=', 'host=', 'port=', '%75ser=x', 'user=x&user=y', 'sslmode=disable', 'sslcert=', 'sslnegotiation=direct'].map((query) => `${roleUrl(TEST_REF)}?${query}`),
    ];
    for (const url of variants) expect(resolveIntegrationsTestTarget(baseEnv({ PRAXA_INTEGRATIONS_TEST_DB_URL: url })).ok).toBe(false);
    // La URL de referencia conserva el rechazo de overrides de identidad/destino...
    for (const query of ['user=x', 'host=x', 'port=', '%75ser=x']) {
      expect(resolveIntegrationsTestTarget(baseEnv({ PRAXA_INTEGRATIONS_TEST_DB_URL: roleUrl(TEST_REF), SUPABASE_TEST_DB_URL: `${pooler(TEST_REF)}?${query}` })).ok).toBe(false);
    }
  });

  it('T-22 acepta sslmode en la referencia de pruebas, decisión del usuario sobre Q-05 de qa-review-4: el rechazo de parámetros TLS se acota a la URL del rol', () => {
    const result = resolveIntegrationsTestTarget(baseEnv({
      PRAXA_INTEGRATIONS_TEST_DB_URL: roleUrl(TEST_REF),
      SUPABASE_TEST_DB_URL: `${pooler(TEST_REF)}?sslmode=require`,
    }));
    expect(result).toMatchObject({ ok: true, projectRef: TEST_REF });
    // La URL del rol sigue rechazando TLS: regla acotada a la referencia administrativa.
    expect(resolveIntegrationsTestTarget(baseEnv({ PRAXA_INTEGRATIONS_TEST_DB_URL: `${roleUrl(TEST_REF)}?sslmode=require` })).ok).toBe(false);
  });

  it('T-23: SUPABASE_TEST_ALLOW_APP_PROJECT=true ya no habilita el proyecto app', () => {
    const root = mkdtempSync(join(tmpdir(), 'praxa-m063a-target-'));
    vi.stubEnv('SUPABASE_TEST_URL', `https://${APP_REF}.supabase.co`);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', `https://${APP_REF}.supabase.co`);
    vi.stubEnv('SUPABASE_TEST_IS_DISPOSABLE', DISPOSABLE_ACK);
    vi.stubEnv('SUPABASE_TEST_ALLOW_APP_PROJECT', 'true');
    try {
      const result = resolveTarget('test', { root });
      expect(result.ok).toBe(false);
      expect(result.problems.join(' ')).not.toContain('SUPABASE_TEST_ALLOW_APP_PROJECT');
    } finally {
      vi.unstubAllEnvs();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
