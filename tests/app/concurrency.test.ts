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

  async function objectivesOf(versionId: string) {
    const { data } = await user.client
      .from('company_objectives')
      .select('title, kind')
      .eq('context_version_id', versionId);
    return data ?? [];
  }

  it('edición primero: la confirmación espera y valida el contenido ya commiteado', async () => {
    const draftId = await draftReadyToActivate();

    // T1 empieza a vaciar los objetivos y NO confirma.
    await t1.begin();
    await t1.query('select public.replace_draft_objectives($1, $2::jsonb)', [draftId, '[]']);

    // T2 intenta activar. Con el cerrojo compartido tiene que quedar esperando a T1.
    await t2.begin();
    const activation = t2
      .query('select public.activate_context_draft($1)', [draftId])
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

    // T2 validó DESPUÉS del commit de T1, es decir contra cero objetivos con
    // has_defined_objective = true: tiene que rechazar, no activar.
    expect(outcome.ok, 'se activó un contexto que quedó incoherente tras la edición').toBe(
      false,
    );
    if (!outcome.ok) {
      expect(outcome.code).toBe('23514');
    }

    // Y no quedó ninguna versión activa.
    expect(await activeVersion()).toBeNull();
  }, 60_000);

  it('activación primero: la edición posterior se rechaza por no ser un borrador', async () => {
    const draftId = await draftReadyToActivate();

    // T2 activa y confirma.
    await t2.begin();
    await t2.query('select public.activate_context_draft($1)', [draftId]);
    await t2.commit();

    // T1 intenta editar esa misma versión, que ya no es borrador.
    await t1.begin();
    const edit = await t1
      .query('select public.replace_draft_objectives($1, $2::jsonb)', [draftId, '[]'])
      .then(() => ({ ok: true as const }))
      .catch((error: Error & { code?: string }) => ({ ok: false as const, code: error.code }));
    await t1.rollbackQuietly();

    expect(edit.ok, 'se pudo editar una versión ya activada').toBe(false);
    if (!edit.ok) expect(edit.code).toBe('42501');

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

    await t1.begin();
    const direct = await t1
      .query(
        `delete from public.company_objectives where context_version_id = $1`,
        [draftId],
      )
      .then(() => ({ ok: true as const }))
      .catch((error: Error & { code?: string }) => ({ ok: false as const, code: error.code }));
    await t1.rollbackQuietly();

    // Si esta vía existiera, esquivaría el cerrojo y la carrera seguiría abierta.
    expect(direct.ok, 'la escritura directa sigue disponible y elude el cerrojo').toBe(false);
    if (!direct.ok) expect(direct.code).toBe('42501');
  }, 60_000);

  it('la activación directa por UPDATE tampoco es una vía alternativa', async () => {
    const draftId = await draftReadyToActivate();

    await t1.begin();
    const direct = await t1
      .query(
        `update public.company_context_versions
            set status = 'active', version = 1, activated_at = now()
          where id = $1`,
        [draftId],
      )
      .then(() => ({ ok: true as const }))
      .catch((error: Error & { code?: string }) => ({ ok: false as const, code: error.code }));
    await t1.rollbackQuietly();

    expect(direct.ok, 'se activó con un UPDATE directo, sin pasar por el cerrojo').toBe(false);
    if (!direct.ok) expect(direct.code).toBe('42501');

    expect(await activeVersion()).toBeNull();
  }, 60_000);

  it('un contexto ya activado no cambia después', async () => {
    const draftId = await draftReadyToActivate();

    await t2.begin();
    await t2.query('select public.activate_context_draft($1)', [draftId]);
    await t2.commit();

    const before = await objectivesOf(draftId);

    // Todos los caminos de modificación, uno por uno.
    await t1.begin();
    const attempts = await Promise.all(
      [
        `select public.replace_draft_objectives('${draftId}', '[]'::jsonb)`,
        `select public.replace_draft_systems('${draftId}', '[]'::jsonb)`,
        `update public.company_context_versions set additional_context = 'inyectado' where id = '${draftId}'`,
      ].map((sql) =>
        t1
          .query(sql)
          .then(() => ({ ok: true as const, sql }))
          .catch(() => ({ ok: false as const, sql })),
      ),
    );
    await t1.rollbackQuietly();

    for (const attempt of attempts) {
      expect(attempt.ok, `prosperó una modificación sobre un contexto activo: ${attempt.sql}`).toBe(
        false,
      );
    }

    const after = await objectivesOf(draftId);
    expect(after).toEqual(before);

    const active = await activeVersion();
    expect(active!.id).toBe(draftId);
  }, 60_000);
});

describe.skipIf(canRun)('carrera entre editar y confirmar', () => {
  it('NO EJECUTADA: falta el proyecto remoto de pruebas', () => {
    console.warn(`[praxa] pruebas de concurrencia omitidas: ${skipReason}`);
    expect(canRun).toBe(false);
  });
});
