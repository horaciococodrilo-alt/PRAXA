import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import pg from 'pg';

import { DISPOSABLE_ACK, resolveIntegrationsTestTarget, resolveSqlTestTarget } from '../../scripts/lib/sql-target.mjs';
import { resolveTarget } from '../../scripts/lib/target.mjs';
import { verifiedTestDbConfig } from '../../scripts/lib/test-db-client.mjs';

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

  it('rechaza equivalencias canónicas y cada referencia de app por separado', () => {
    expect(problemsOf(baseEnv({ SUPABASE_TEST_URL: `https://${APP_REF}.supabase.co/` }))).toMatch(/mismo proyecto/i);
    expect(problemsOf(baseEnv({
      SUPABASE_DB_URL: 'postgresql://usuario:clave@db.example.test:5432/postgres',
      NEXT_PUBLIC_SUPABASE_URL: `https://${TEST_REF}.supabase.co/`,
    }))).toMatch(/el de la aplicación|mismo proyecto/i);
    expect(problemsOf(baseEnv({
      SUPABASE_DB_URL: pooler(TEST_REF),
      NEXT_PUBLIC_SUPABASE_URL: undefined,
    }))).toMatch(/el de la aplicación|proyecto de la aplicación/i);
    expect(problemsOf(baseEnv({
      SUPABASE_TEST_URL: `https://${APP_REF}.supabase.co/`,
      SUPABASE_TEST_DB_URL: pooler(TEST_REF),
    }))).toMatch(/mismo proyecto|separado de la aplicación/i);
  });

  it('rechaza una API de pruebas distinta de su base SQL', () => {
    expect(problemsOf(baseEnv({ SUPABASE_TEST_URL: `https://${APP_REF}.supabase.co` }))).toMatch(/proyecto SQL de pruebas/i);
  });

  it('rechaza una URL directa con referencias de usuario y host contradictorias', () => {
    const conflicted = `postgresql://postgres.${TEST_REF}:secreta@db.${APP_REF}.supabase.co:5432/postgres`;
    expect(problemsOf(baseEnv({ SUPABASE_TEST_DB_URL: conflicted }))).toMatch(/No se pudo deducir/i);
  });

  it('rechaza overrides de destino antes de pasar la URL a pg o la CLI', () => {
    for (const query of ['host=db.example.test', '%68ost=db.example.test', 'port=5433', 'user=x', 'sslmode=require&host=x']) {
      expect(problemsOf(baseEnv({ SUPABASE_TEST_DB_URL: `${pooler(TEST_REF)}?${query}` }))).toMatch(/parámetros de conexión no permitidos/i);
    }
  });

  it('fija TLS real de pg aun con sslmode=require permitido en la URL', () => {
    const config = verifiedTestDbConfig(`${pooler(TEST_REF)}?sslmode=require`, 'praxa-test');
    expect(config.connectionString).toBe(pooler(TEST_REF));
    const effective = (new pg.Client(config) as unknown as {
      connectionParameters: { ssl: unknown; sslnegotiation: string; user: string; host: string; port: number };
    }).connectionParameters;
    expect(effective.ssl).toMatchObject({ rejectUnauthorized: true, ca: expect.stringContaining('BEGIN CERTIFICATE') });
    expect(effective.sslnegotiation).toBe('postgres');
    expect([effective.user, effective.host, effective.port]).toEqual([
      `postgres.${TEST_REF}`, 'aws-0-us-east-1.pooler.supabase.com', 5432,
    ]);
    for (const query of ['sslmode=disable', 'ssl=no-verify', 'sslrootcert=x', 'user=x', 'sslmode=require&sslmode=require']) {
      expect(() => verifiedTestDbConfig(`${pooler(TEST_REF)}?${query}`, 'praxa-test')).toThrow();
    }
  });

  it('H-E1-60 rechaza lo que el resolvedor de destino ya rechaza: sin credenciales o sin ruta', () => {
    for (const url of [
      `postgresql://@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
      `postgresql://postgres.${TEST_REF}:secreta@aws-0-us-east-1.pooler.supabase.com:5432`,
    ]) {
      expect(() => verifiedTestDbConfig(url, 'praxa-test')).toThrow('SUPABASE_TEST_DB_URL no es válida.');
    }
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

  it('rechaza parámetros de sesión de pg en la URL del rol de pruebas', () => {
    for (const query of [
      'options=-c%20statement_timeout%3D1', 'statement_timeout=1', '%6Fptions=-c%20search_path%3Dpublic',
      'lock_timeout=1', 'idle_in_transaction_session_timeout=1', 'replication=database',
      'client_encoding=LATIN1', 'application_name=otro', 'fallback_application_name=otro',
      'query_timeout=1', 'options=', 'options=x&options=y', 'unknown=1',
    ]) {
      const result = resolveIntegrationsTestTarget(baseEnv({ PRAXA_INTEGRATIONS_TEST_DB_URL: `${roleUrl(TEST_REF)}?${query}` }));
      expect(result.ok, query).toBe(false);
      if (!result.ok) expect(result.problems?.join(' ')).not.toContain('statement_timeout=1');
    }
  });

  it('H-E1-55 rechaza la URL de pruebas del rol si apunta al proyecto de la URL de runtime', () => {
    const otherHost = roleUrl(TEST_REF).replace('aws-0-us-east-1', 'aws-1-sa-east-1').replace(':secreta@', ':otra@');
    const result = resolveIntegrationsTestTarget(baseEnv({
      PRAXA_INTEGRATIONS_TEST_DB_URL: roleUrl(TEST_REF),
      PRAXA_INTEGRATIONS_DB_URL: otherHost,
      SUPABASE_DB_URL: undefined,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems?.join(' ')).toMatch(/mismo proyecto que la URL de runtime/);
    // Un runtime de otro proyecto no bloquea; uno indeducible sí.
    expect(resolveIntegrationsTestTarget(baseEnv({
      PRAXA_INTEGRATIONS_TEST_DB_URL: roleUrl(TEST_REF), PRAXA_INTEGRATIONS_DB_URL: roleUrl(APP_REF.replace(/a/g, 'c')),
    })).ok).toBe(true);
    for (const runtime of ['no-es-una-url', pooler(TEST_REF)]) {
      const rejected = resolveIntegrationsTestTarget(baseEnv({ PRAXA_INTEGRATIONS_TEST_DB_URL: roleUrl(TEST_REF), PRAXA_INTEGRATIONS_DB_URL: runtime }));
      expect(rejected.ok).toBe(false);
      if (!rejected.ok) expect(rejected.problems?.join(' ')).toMatch(/No se pudo deducir el proyecto de PRAXA_INTEGRATIONS_DB_URL/);
    }
  });

  it('H-E1-57 resolveTarget no suma un ref indeducible cuando la URL ya se rechazó o falta', () => {
    const root = mkdtempSync(join(tmpdir(), 'praxa-m063a-target-'));
    try {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', `https://${APP_REF}.supabase.co`);
      vi.stubEnv('SUPABASE_TEST_URL', `https://${TEST_REF}.supabase.co`);
      vi.stubEnv('SUPABASE_TEST_IS_DISPOSABLE', DISPOSABLE_ACK);
      vi.stubEnv('SUPABASE_TEST_DB_URL', `${pooler(TEST_REF)}?sslmode=verify-full`);
      const query = resolveTarget('test', { root, requireDbUrl: true });
      expect(query.ok).toBe(false);
      expect(query.problems.join(' ')).toMatch(/parámetros de conexión no permitidos/);
      expect(query.problems.join(' ')).not.toMatch(/No se pudo deducir/);
      vi.stubEnv('SUPABASE_TEST_DB_URL', pooler(TEST_REF));
      vi.stubEnv('SUPABASE_TEST_URL', undefined);
      const missing = resolveTarget('test', { root, requireDbUrl: true });
      expect(missing.ok).toBe(false);
      expect(missing.problems.join(' ')).toMatch(/Falta SUPABASE_TEST_URL/);
      expect(missing.problems.join(' ')).not.toMatch(/No se pudo deducir/);
    } finally {
      vi.unstubAllEnvs();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('T-23 rechaza la misma referencia con otra representación o DB de app independiente', () => {
    const root = mkdtempSync(join(tmpdir(), 'praxa-m063a-target-'));
    try {
      vi.stubEnv('SUPABASE_TEST_URL', `https://${APP_REF}.supabase.co/`);
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', `https://${APP_REF}.supabase.co`);
      vi.stubEnv('SUPABASE_TEST_IS_DISPOSABLE', DISPOSABLE_ACK);
      expect(resolveTarget('test', { root }).ok).toBe(false);
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', `https://${TEST_REF}.supabase.co`);
      vi.stubEnv('SUPABASE_DB_URL', pooler(APP_REF));
      expect(resolveTarget('test', { root }).ok).toBe(false);
      vi.stubEnv('SUPABASE_TEST_URL', `https://${TEST_REF}.supabase.co`);
      vi.stubEnv('SUPABASE_TEST_DB_URL', `${pooler(TEST_REF)}?host=db.${APP_REF}.supabase.co&port=5432`);
      expect(resolveTarget('test', { root, requireDbUrl: true }).problems.join(' ')).toMatch(/parámetros de conexión no permitidos/i);
      vi.stubEnv('SUPABASE_TEST_DB_URL', `postgresql://postgres.${TEST_REF}:secreta@db.${APP_REF}.supabase.co:5432/postgres`);
      expect(resolveTarget('test', { root, requireDbUrl: true }).dbRef).toBeNull();
      expect(resolveTarget('test', { root, requireDbUrl: true }).ok).toBe(false);
    } finally {
      vi.unstubAllEnvs();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
