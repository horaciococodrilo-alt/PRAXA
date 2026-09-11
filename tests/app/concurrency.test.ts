import pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  blockedReason,
  cleanupRun,
  createConfirmedUser,
  remoteProjectReachable,
  resetCompanyContext,
  type TestUser,
} from './helpers';
import { loadEnv } from '../../scripts/lib/env.mjs';

/**
 * Carrera entre EDITAR un borrador y CONFIRMARLO.
 *
 * `Promise.all` sobre dos llamadas REST no reproduce la intercalación: no controla en qué
 * punto queda cada transacción, y su resultado depende del azar. Acá se abren dos
 * conexiones a PostgreSQL y se coordinan con barreras explícitas, de modo que la
 * intercalación peligrosa ocurra siempre:
 *
 *   T1  BEGIN, borra los objetivos del borrador     ← se queda sin confirmar
 *   T2  BEGIN, intenta activar ese borrador          ← debe quedar esperando
 *   T1  COMMIT
 *   T2  continúa y valida contra el contenido YA COMMITEADO
 *
 * Sin el cerrojo compartido, T2 validaba contra los objetivos viejos y dejaba activo un
 * contenido nunca validado. Esa es la regresión que estas pruebas detectan.
 *
 * Las transacciones se abren con el rol `authenticated` y los claims del usuario real, no
 * con la clave administrativa: se prueba lo que puede hacer un usuario normal.
 */

const blocked = blockedReason();
const env = loadEnv();
const dbUrl = env.SUPABASE_TEST_DB_URL as string | undefined;

const reachable = blocked || !dbUrl ? false : await remoteProjectReachable();
const canRun = !blocked && Boolean(dbUrl) && reachable;

const skipReason = blocked
  ? blocked
  : !dbUrl
    ? 'Falta SUPABASE_TEST_DB_URL: estas pruebas abren dos conexiones directas a PostgreSQL.'
    : 'El proyecto remoto de pruebas no respondió.';

const STATEMENT_TIMEOUT_MS = 15_000;

/** Una sesión SQL que actúa como un usuario final concreto. */
class UserSession {
  private client: pg.Client;

  constructor(private readonly userId: string) {
    this.client = new pg.Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      application_name: `praxa-concurrency-${userId.slice(0, 8)}`,
    });
  }

  async connect() {
    await this.client.connect();
    // Sin esto, una espera mal resuelta colgaría la prueba en lugar de fallar.
    await this.client.query(`set statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    await this.client.query(`set lock_timeout = ${STATEMENT_TIMEOUT_MS}`);
    return this;
  }

  /** Asume el rol y los claims del usuario para el resto de la transacción. */
  async begin() {
    await this.client.query('begin');
    await this.client.query(
      `select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: this.userId, role: 'authenticated' })],
    );
    await this.client.query('set local role authenticated');
  }

  query(sql: string, params: unknown[] = []) {
    return this.client.query(sql, params);
  }

  commit() {
    return this.client.query('commit');
  }

  async rollbackQuietly() {
    try {
      await this.client.query('rollback');
    } catch {
      /* la transacción ya había terminado */
    }
  }

  end() {
    return this.client.end();
  }

  /**
   * Ejecuta una sentencia en su PROPIA transacción y devuelve el código de error real.
   *
   * Encadenar intentos dentro de una misma transacción no sirve para probar
   * protecciones: tras el primer error PostgreSQL aborta la transacción y todo lo que
   * siga falla con 25P02 ("current transaction is aborted"), que no dice nada sobre
   * autorización ni inmutabilidad. Acá cada intento arranca limpio.
   */
  async attempt(sql: string, params: unknown[] = []) {
    await this.begin();
    try {
      const result = await this.query(sql, params);
      await this.rollbackQuietly();
      return { ok: true as const, code: null as string | null, rowCount: result.rowCount ?? 0 };
    } catch (error) {
      const code = (error as { code?: string }).code ?? null;
      await this.rollbackQuietly();
      return { ok: false as const, code, rowCount: 0 };
    }
  }
}

/** 25P02 significa "la transacción ya estaba rota", nunca "la protección funcionó". */
function expectRejectedWith(
  attempt: { ok: boolean; code: string | null },
  expected: string,
  what: string,
) {
  expect(attempt.ok, `prosperó una operación que debía rechazarse: ${what}`).toBe(false);
  expect(
    attempt.code,
    `${what}: se esperaba ${expected} y llegó ${attempt.code}. ` +
      '25P02 indicaría una transacción abortada por un error anterior, no una protección.',
  ).toBe(expected);
}

describe.skipIf(!canRun)('carrera entre editar y confirmar (dos transacciones reales)', () => {
  let user: TestUser;
  let companyId: string;
  let t1: UserSession;
  let t2: UserSession;

  beforeAll(async () => {
    user = await createConfirmedUser('carrera');
    const { data } = await user.client
      .rpc('create_company_for_current_user', { p_name: 'Carreras SRL' })
      .single<{ id: string }>();
    companyId = data!.id;

    t1 = await new UserSession(user.id).connect();
    t2 = await new UserSession(user.id).connect();
  }, 60_000);

  afterEach(async () => {
    // Aunque una aserción falle, las transacciones no quedan abiertas bloqueando al resto.
    await t1.rollbackQuietly();
    await t2.rollbackQuietly();

    // Se deja la empresa sin contexto para la prueba siguiente.
    await resetCompanyContext(companyId);
  });

  afterAll(async () => {
    await t1?.end();
    await t2?.end();
    await cleanupRun();
  }, 60_000);

  /** Deja un borrador con un objetivo principal, listo para activarse. */
  async function draftReadyToActivate(): Promise<string> {
    const { data: draft, error } = await user.client
      .rpc('start_context_draft', { p_context_schema_version: '1.0.0' })
      .single<{ id: string }>();
    expect(error).toBeNull();

    await user.client.rpc('replace_draft_objectives', {
      p_version_id: draft!.id,
      p_objectives: [{ kind: 'primary', title: 'Objetivo original', position: 0 }],
    });
    await user.client
      .from('company_context_versions')
      .update({ has_defined_objective: true })
      .eq('id', draft!.id);

    return draft!.id;
  }

  async function activeVersion() {
    const { data } = await user.client
      .from('company_context_versions')
      .select('id, version, status, has_defined_objective')
      .eq('status', 'active')
      .maybeSingle();
    return data;
  }

  async function revisionOf(versionId: string): Promise<string> {
    const { data, error } = await user.client.rpc('context_revision', {
      p_version_id: versionId,
    });
    expect(error).toBeNull();
    return data as string;
  }

  async function systemsOf(versionId: string) {
    const { data } = await user.client
      .from('company_systems')
      .select('system_key, label')
      .eq('context_version_id', versionId)
      .order('system_key');
    return data ?? [];
  }

  async function versionRow(versionId: string) {
    const { data } = await user.client
      .from('company_context_versions')
      .select('id, status, version, has_defined_objective, problems, constraints, additional_context')
      .eq('id', versionId)
      .single();
    return data;
  }

  async function objectivesOf(versionId: string) {
    const { data } = await user.client
      .from('company_objectives')
      .select('title, kind')
      .eq('context_version_id', versionId);
    return data ?? [];
  }

  it('edición primero: la confirmación espera y valida el contenido ya commiteado', async () => {
    const draftId = await draftReadyToActivate();
    const revision = await revisionOf(draftId);

    // T1 empieza a vaciar los objetivos y NO confirma.
    await t1.begin();
    await t1.query('select public.replace_draft_objectives($1, $2::jsonb)', [draftId, '[]']);

    // T2 intenta activar. Con el cerrojo compartido tiene que quedar esperando a T1.
    await t2.begin();
    const activation = t2
      .query('select public.activate_context_draft($1, $2)', [draftId, revision])
      .then(() => ({ ok: true as const }))
      .catch((error: Error & { code?: string }) => ({
        ok: false as const,
        code: error.code,
        message: error.message,
      }));

    // Barrera: se comprueba que T2 sigue esperando y no pasó de largo.
    const stillWaiting = await Promise.race([
      activation.then(() => 'terminó'),
      new Promise<string>((resolve) => setTimeout(() => resolve('esperando'), 1500)),
    ]);
    expect(
      stillWaiting,
      'la activación no esperó al cerrojo: se intercaló con la edición en curso',
    ).toBe('esperando');

    await t1.commit();

    const outcome = await activation;
    await t2.rollbackQuietly();

    // T2 esperó al cerrojo y recalculó la revisión con el contenido YA commiteado por T1,
    // que difiere del que T2 tenía a la vista: rechaza por revisión desactualizada (40001)
    // antes incluso de llegar a la comprobación de coherencia. Sin cerrojo ni revisión,
    // T2 habría activado el contenido viejo sin enterarse.
    expect(outcome.ok, 'se activó un contexto que cambió durante la confirmación').toBe(false);
    if (!outcome.ok) {
      // PT409, no un código de la clase 40: esa clase se interpreta como transitoria y
      // la infraestructura la reintenta sola, en un bucle que nunca resuelve.
      expect(outcome.code).toBe('PT409');
    }

    // Y no quedó ninguna versión activa.
    expect(await activeVersion()).toBeNull();
  }, 60_000);

  it('activación primero: la edición posterior se rechaza por no ser un borrador', async () => {
    const draftId = await draftReadyToActivate();

    // T2 activa y confirma.
    await t2.begin();
    await t2.query('select public.activate_context_draft($1, $2)', [
      draftId,
      await revisionOf(draftId),
    ]);
    await t2.commit();

    // T1 intenta editar esa misma versión, que ya no es borrador.
    const edit = await t1.attempt('select public.replace_draft_objectives($1, $2::jsonb)', [
      draftId,
      '[]',
    ]);
    expectRejectedWith(edit, '42501', 'editar una versión ya activada');

    // La versión activada es exactamente la que se probó, con su contenido intacto.
    const active = await activeVersion();
    expect(active).not.toBeNull();
    expect(active!.id).toBe(draftId);
    expect(active!.version).toBe(1);

    const objectives = await objectivesOf(draftId);
    expect(objectives).toHaveLength(1);
    expect(objectives[0].title).toBe('Objetivo original');
  }, 60_000);

  it('la escritura directa a las tablas hijas no es una vía alternativa', async () => {
    const draftId = await draftReadyToActivate();

    // Si esta vía existiera, esquivaría el cerrojo y la carrera seguiría abierta.
    const direct = await t1.attempt(
      'delete from public.company_objectives where context_version_id = $1',
      [draftId],
    );
    expectRejectedWith(direct, '42501', 'escritura directa a las tablas hijas');
  }, 60_000);

  it('la activación directa por UPDATE tampoco es una vía alternativa', async () => {
    const draftId = await draftReadyToActivate();

    const direct = await t1.attempt(
      `update public.company_context_versions
          set status = 'active', version = 1, activated_at = now()
        where id = $1`,
      [draftId],
    );
    expectRejectedWith(direct, '42501', 'activación por UPDATE directo');

    expect(await activeVersion()).toBeNull();
  }, 60_000);

  it('un contexto ya activado no cambia después', async () => {
    const draftId = await draftReadyToActivate();
    const revision = await revisionOf(draftId);

    await t2.begin();
    await t2.query('select public.activate_context_draft($1, $2)', [draftId, revision]);
    await t2.commit();

    const objetivosAntes = await objectivesOf(draftId);
    const sistemasAntes = await systemsOf(draftId);
    const filaAntes = await versionRow(draftId);

    // Cada intento en su propia transacción: si fueran encadenados, del segundo en
    // adelante fallarían con 25P02 y no probarían nada.
    const intentos = [
      {
        que: 'reemplazar objetivos por RPC',
        sql: `select public.replace_draft_objectives('${draftId}', '[]'::jsonb)`,
        codigo: '42501',
      },
      {
        que: 'reemplazar sistemas por RPC',
        sql: `select public.replace_draft_systems('${draftId}', '[]'::jsonb)`,
        codigo: '42501',
      },
      {
        que: 'editar un campo del contexto',
        sql: `update public.company_context_versions set additional_context = 'inyectado' where id = '${draftId}'`,
        codigo: '42501',
      },
      {
        que: 'borrar objetivos directamente',
        sql: `delete from public.company_objectives where context_version_id = '${draftId}'`,
        codigo: '42501',
      },
    ];

    for (const intento of intentos) {
      expectRejectedWith(await t1.attempt(intento.sql), intento.codigo, intento.que);
    }

    // Borrar una versión activa es una denegación SILENCIOSA: la política de DELETE solo
    // alcanza borradores, así que la fila queda fuera del alcance y no hay excepción.
    const borrado = await t1.attempt(
      `delete from public.company_context_versions where id = '${draftId}'`,
    );
    expect(borrado.ok, 'el borrado debería no encontrar filas, no fallar').toBe(true);
    expect(borrado.rowCount, 'se borró una versión activa').toBe(0);

    // Nada se movió: ni las listas, ni los campos, ni la identidad de la versión.
    expect(await objectivesOf(draftId)).toEqual(objetivosAntes);
    expect(await systemsOf(draftId)).toEqual(sistemasAntes);
    expect(await versionRow(draftId)).toEqual(filaAntes);

    const active = await activeVersion();
    expect(active!.id).toBe(draftId);
    expect(active!.version).toBe(1);
  }, 90_000);

  it('una revisión desactualizada no confirma, aunque se omita la interfaz', async () => {
    // La segunda pestaña: leyó la revisión, otra guardó después, y confirma igual.
    const draftId = await draftReadyToActivate();
    const revisionVieja = await revisionOf(draftId);

    // Otra pestaña cambia SOLO los sistemas: no toca la fila de contexto.
    const { error } = await user.client.rpc('replace_draft_systems', {
      p_version_id: draftId,
      p_systems: [{ system_key: 'shopify' }],
    });
    expect(error).toBeNull();

    const conflicto = await t1.attempt(
      'select public.activate_context_draft($1, $2)',
      [draftId, revisionVieja],
    );
    expectRejectedWith(conflicto, 'PT409', 'confirmar con una revisión vieja');

    expect(await activeVersion()).toBeNull();

    // Con la revisión al día sí confirma, y activa exactamente ese borrador.
    const revisionNueva = await revisionOf(draftId);
    expect(revisionNueva).not.toBe(revisionVieja);

    await t1.begin();
    await t1.query('select public.activate_context_draft($1, $2)', [draftId, revisionNueva]);
    await t1.commit();

    const active = await activeVersion();
    expect(active!.id).toBe(draftId);
    expect(active!.version).toBe(1);
    expect(await systemsOf(draftId)).toHaveLength(1);
  }, 90_000);
});

describe.skipIf(canRun)('carrera entre editar y confirmar', () => {
  it('NO EJECUTADA: falta el proyecto remoto de pruebas', () => {
    console.warn(`[praxa] pruebas de concurrencia omitidas: ${skipReason}`);
    expect(canRun).toBe(false);
  });
});
