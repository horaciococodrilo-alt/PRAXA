import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  blockedReason,
  cleanupRun,
  createConfirmedUser,
  pendingCleanupCount,
  remoteProjectReachable,
  RUN_ID,
  type TestUser,
} from './helpers';
import { resolveSqlTestTarget } from '../../scripts/lib/sql-target.mjs';

/**
 * Lectura efectiva de las tablas del conector por la Data API (sección 5b, H-E1-11).
 *
 * pgTAP prueba los privilegios en SQL, pero un grant olvidado recién se nota por HTTP:
 * PostgREST responde 42501. Por eso estas aserciones usan el cliente autenticado de la
 * Data API, el mismo que usa el navegador.
 *
 * `authenticated` no escribe en `integration_connections`, así que la conexión de cada
 * empresa se siembra por `worker_api` con una conexión SQL directa al proyecto de pruebas,
 * como `postgres`, dueño de las funciones. Es el equivalente, para esta tabla, de la clave
 * `service_role` de `helpers.ts`: prepara datos y ninguna aserción la usa. La limpieza es
 * `cleanupRun()`: la cascada desde `companies` arrastra conexiones y credenciales.
 */

const blocked = blockedReason();
const sqlTarget = resolveSqlTestTarget(process.env);
const reachable = blocked || !sqlTarget.ok ? false : await remoteProjectReachable();
const canRun = !blocked && sqlTarget.ok && reachable;

const skipReason = blocked
  ? blocked
  : !sqlTarget.ok
    ? `Destino SQL de pruebas inválido: ${sqlTarget.problems.join(' ')}`
    : 'El proyecto remoto de Supabase no respondió. Revisá SUPABASE_TEST_URL y la conexión.';

const STATEMENT_TIMEOUT_MS = 15_000;

/**
 * Siembra una conexión pendiente con credencial sintética, por worker_api. Es una sola
 * sentencia: se confirma sola, y la función escribe conexión y credencial en su propia
 * transacción.
 */
async function seedPendingConnection(
  client: pg.Client,
  userId: string,
  companyId: string,
): Promise<string> {
  const connectionId = randomUUID();
  await client.query(
    `select 1 from worker_api.create_pending_connection(
       $1, $2, $3, 'negocio_sintetico', 'AAAA', 'AAAAAAAAAAAAAAAA',
       'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica', '{ads_read}', null)`,
    [userId, companyId, connectionId],
  );
  return connectionId;
}

describe.skipIf(!canRun)('tablas del conector por la Data API (proyecto remoto)', () => {
  let alice: TestUser;
  let bob: TestUser;
  let aliceCompanyId: string;
  let aliceConnectionId: string;
  let bobConnectionId: string;
  let sql: pg.Client | undefined;

  beforeAll(async () => {
    if (!sqlTarget.ok) throw new Error('Destino SQL de pruebas inválido.');

    alice = await createConfirmedUser('conector-alice');
    bob = await createConfirmedUser('conector-bob');

    const { data: aliceCompany, error: aliceError } = await alice.client
      .rpc('create_company_for_current_user', { p_name: `Conector de Alice ${RUN_ID}` })
      .single<{ id: string }>();
    expect(aliceError).toBeNull();
    aliceCompanyId = aliceCompany!.id;

    const { data: bobCompany, error: bobError } = await bob.client
      .rpc('create_company_for_current_user', { p_name: `Conector de Bob ${RUN_ID}` })
      .single<{ id: string }>();
    expect(bobError).toBeNull();

    sql = new pg.Client({
      connectionString: sqlTarget.connectionString,
      ssl: { rejectUnauthorized: false },
      application_name: 'praxa-integrations-data-api',
    });
    await sql.connect();
    // Sin esto, un cerrojo tomado por otra sesión colgaría la siembra en lugar de fallar.
    await sql.query(`set statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    await sql.query(`set lock_timeout = ${STATEMENT_TIMEOUT_MS}`);

    aliceConnectionId = await seedPendingConnection(sql, alice.id, aliceCompanyId);
    bobConnectionId = await seedPendingConnection(sql, bob.id, bobCompany!.id);
  });

  afterAll(async () => {
    await sql?.end();
    await cleanupRun();
    expect(pendingCleanupCount()).toBe(0);
  });

  it('el usuario lee su conexión sin error', async () => {
    const { data, error } = await alice.client.from('integration_connections').select('id');

    expect(error).toBeNull();
    expect(data).toEqual([{ id: aliceConnectionId }]);
  });

  it('filtrar por la conexión de otra empresa devuelve vacío', async () => {
    const { data, error } = await alice.client
      .from('integration_connections')
      .select('id')
      .eq('id', bobConnectionId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('los intentos OAuth no se leen', async () => {
    const { data, error } = await alice.client.from('oauth_attempts').select('id');

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it('worker_api no está expuesto', async () => {
    const { data, error } = await alice.client
      .schema('worker_api')
      .rpc('list_pending_purges', { p_actor_user_id: alice.id, p_company_id: aliceCompanyId });

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it('no existe una RPC homónima en public', async () => {
    const { data, error } = await alice.client.rpc('list_pending_purges', {
      p_actor_user_id: alice.id,
      p_company_id: aliceCompanyId,
    });

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it('las credenciales no se leen', async () => {
    const { data, error } = await alice.client
      .schema('private')
      .from('integration_credentials')
      .select('connection_id');

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});

describe.skipIf(canRun)('tablas del conector por la Data API', () => {
  it('NO EJECUTADA: falta el proyecto remoto de pruebas', () => {
    console.warn(`[praxa] pruebas de la Data API del conector omitidas: ${skipReason}`);
    expect(canRun).toBe(false);
  });
});
