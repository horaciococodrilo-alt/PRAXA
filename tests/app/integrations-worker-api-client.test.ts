import { randomBytes, randomInt, randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { WorkerApi } from '@/modules/integrations/db/worker-api';
import type { TenantContext } from '@/modules/tenant/context';
import { resolveIntegrationsTestTarget } from '../../scripts/lib/sql-target.mjs';
import { blockedReason, cleanupRun, createConfirmedUser, pendingCleanupCount, remoteProjectReachable, RUN_ID } from './helpers';

vi.mock('server-only', () => ({}));

const token = 'token-sintetico-cliente-rol';
const input = { token, tokenType: 'system_user' as const, issuedForAppId: 'app_sintetica', grantedScopes: ['ads_read'], expiresAt: null, clientBusinessId: 'business_sintetico' };

describe('M06.3a: cliente real praxa_integrations → worker_api', () => {
  let keyringApi: typeof import('@/modules/integrations/crypto/keyring');
  let sealApi: typeof import('@/modules/integrations/crypto/seal');
  let workerApiModule: typeof import('@/modules/integrations/db/worker-api');
  let repository: typeof import('@/modules/integrations/repository/credentials');
  let syncCalls: typeof import('@/modules/integrations/repository/sync-calls');
  let client: ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi> | undefined;
  let pool: pg.Pool | undefined;

  // Esta guarda es el primer beforeAll: sin destino seguro, no crea Pool, usuario ni fixture.
  beforeAll(async () => {
    const target = resolveIntegrationsTestTarget(process.env);
    if (!target.ok) throw new Error(target.problems?.join(' ') ?? 'Destino del rol no verificado.');
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);
    if (!(await remoteProjectReachable())) throw new Error('El proyecto de pruebas no responde.');

    [keyringApi, sealApi, workerApiModule, repository, syncCalls] = await Promise.all([
      vi.importActual<typeof keyringApi>('@/modules/integrations/crypto/keyring'),
      vi.importActual<typeof sealApi>('@/modules/integrations/crypto/seal'),
      vi.importActual<typeof workerApiModule>('@/modules/integrations/db/worker-api'),
      vi.importActual<typeof repository>('@/modules/integrations/repository/credentials'),
      vi.importActual<typeof syncCalls>('@/modules/integrations/repository/sync-calls'),
    ]);

    const originalOn = pg.Pool.prototype.on;
    const observer = vi.spyOn(pg.Pool.prototype, 'on').mockImplementation(function (this: pg.Pool, ...args) {
      pool = observer.mock.contexts.at(-1) as pg.Pool;
      return originalOn.apply(this, args);
    });
    try { client = workerApiModule.createWorkerApi({ connectionString: target.connectionString }); }
    finally { observer.mockRestore(); }
    if (!pool || !client) throw new Error('No se observó el pool real del cliente.');
  });

  afterAll(async () => {
    try { await client?.end(); }
    finally {
      await cleanupRun();
      expect(pendingCleanupCount()).toBe(0);
    }
  });

  async function company(prefix: string): Promise<TenantContext> {
    const user = await createConfirmedUser(prefix);
    const { data, error } = await user.client.rpc('create_company_for_current_user', { p_name: `Empresa sintética ${RUN_ID} ${prefix}` }).single<{ id: string }>();
    if (error || !data) throw new Error('No se pudo crear la empresa sintética.');
    return { user_id: user.id, company_id: data.id, role: 'owner', request_id: randomUUID() };
  }

  function ringPair() {
    const version = randomInt(1_000_000, 2_000_000_000);
    const first = randomBytes(32).toString('base64');
    const second = randomBytes(32).toString('base64');
    const keys = `${version}:${first},${version + 1}:${second}`;
    return { version, old: keyringApi.parseCredentialKeyring(keys, String(version)), current: keyringApi.parseCredentialKeyring(keys, String(version + 1)) };
  }

  it('T-31 autentica el pool real como praxa_integrations', async () => {
    const result = await pool!.query<{ current_user: string }>('select current_user');
    expect(result.rows).toEqual([{ current_user: 'praxa_integrations' }]);
  });

  it('T-32 deniega lectura directa de las tres tablas', async () => {
    for (const table of ['public.integration_connections', 'public.oauth_attempts', 'private.integration_credentials']) {
      await expect(pool!.query(`select * from ${table} limit 1`)).rejects.toMatchObject({ code: '42501' });
    }
  });

  it('T-33 crea y lee una credencial con el llavero configurado', async () => {
    const ctx = await company('credencial');
    const keyring = keyringApi.getCredentialKeyring();
    const operation = repository.preparePendingConnectionWithCredential(ctx, input, { keyring });
    const created = await repository.executePreparedCredentialOperation(ctx, operation, { workerApi: client! });
    expect(created.status).toBe('pending_selection');
    const read = await repository.readCredential(ctx, created.connectionId, { workerApi: client!, keyring });
    expect(read.token.reveal()).toBe(token);
    const raw = await client!.call<{ ciphertext: string }>('get_credential', [ctx.user_id, ctx.company_id, created.connectionId]);
    expect(raw).toHaveLength(1);
    expect(raw[0].ciphertext).not.toBe(Buffer.from(token).toString('base64'));
  });

  it('T-34 material de otra empresa no pasa AAD', async () => {
    const a = await company('aad-a');
    const b = await company('aad-b');
    const keyring = keyringApi.getCredentialKeyring();
    const created = await repository.executePreparedCredentialOperation(a, repository.preparePendingConnectionWithCredential(a, input, { keyring }), { workerApi: client! });
    const raw = (await client!.call<Record<string, unknown>>('get_credential', [a.user_id, a.company_id, created.connectionId]))[0];
    const foreignId = randomUUID();
    await client!.call('create_pending_connection', [
      b.user_id, b.company_id, foreignId, 'business_sintetico', raw.ciphertext, raw.iv,
      raw.auth_tag, raw.key_version, raw.token_type, raw.issued_for_app_id, raw.granted_scopes, raw.expires_at,
    ]);
    await expect(repository.readCredential(b, foreignId, { workerApi: client!, keyring })).rejects.toBeInstanceOf(sealApi.CredentialDecryptionError);
  });

  it('T-35 rota una versión sintética y confirma conteo cero', async () => {
    const ctx = await company('rotacion');
    const ring = ringPair();
    const initial = await repository.countCredentialsByKeyVersion({ workerApi: client! });
    expect(initial.some((entry) => entry.keyVersion === ring.version || entry.keyVersion === ring.version + 1)).toBe(false);
    const created = await repository.executePreparedCredentialOperation(ctx, repository.preparePendingConnectionWithCredential(ctx, input, { keyring: ring.old }), { workerApi: client! });
    const read = await repository.readCredential(ctx, created.connectionId, { workerApi: client!, keyring: ring.current });
    expect(read.keyVersion).toBe(ring.version);
    expect(read.rewrap).toEqual({ status: 'confirmed' });
    const raw = await client!.call<{ key_version: number }>('get_credential', [ctx.user_id, ctx.company_id, created.connectionId]);
    expect(raw[0].key_version).toBe(ring.version + 1);
    const counts = await repository.countCredentialsByKeyVersion({ workerApi: client! });
    expect(counts.some((entry) => entry.keyVersion === ring.version)).toBe(false);
    expect(await repository.canRetireKeyVersion(ring.version, { workerApi: client! })).toBe(true);
  });

  it('T-36 desconectada descifra pero no recifra; sigue contando hasta purga', async () => {
    const ctx = await company('desconexion');
    const ring = ringPair();
    const created = await repository.executePreparedCredentialOperation(ctx, repository.preparePendingConnectionWithCredential(ctx, input, { keyring: ring.old }), { workerApi: client! });
    await client!.call('begin_disconnect', [ctx.user_id, ctx.company_id, created.connectionId]);
    const read = await repository.readCredential(ctx, created.connectionId, { workerApi: client!, keyring: ring.current });
    expect(read.token.reveal()).toBe(token);
    expect(read.status).toBe('disconnected');
    expect(read.rewrap).toEqual({ status: 'not_attempted' });
    const raw = await client!.call<{ key_version: number }>('get_credential', [ctx.user_id, ctx.company_id, created.connectionId]);
    expect(raw[0].key_version).toBe(ring.version);
    expect(await repository.canRetireKeyVersion(ring.version, { workerApi: client! })).toBe(false);
  });

  it('T-41 carrera real de desconexión produce PX006 y CredentialChangedError', async () => {
    const ctx = await company('carrera-rotacion');
    const ring = ringPair();
    const created = await repository.executePreparedCredentialOperation(ctx, repository.preparePendingConnectionWithCredential(ctx, input, { keyring: ring.old }), { workerApi: client! });
    let release!: () => void;
    let reached!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const atRewrap = new Promise<void>((resolve) => { reached = resolve; });
    let rewrapFailure: unknown;
    const intercepted: WorkerApi = {
      call: (fn, args) => fn === 'rewrap_credential'
        ? (async () => {
          reached();
          await barrier;
          try { return await client!.call(fn, args); }
          catch (error) { rewrapFailure = error; throw error; }
        })()
        : client!.call(fn, args),
    };
    const reading = repository.readCredential(ctx, created.connectionId, { workerApi: intercepted, keyring: ring.current });
    await atRewrap;
    await client!.call('begin_disconnect', [ctx.user_id, ctx.company_id, created.connectionId]);
    release();
    await expect(reading).rejects.toBeInstanceOf(repository.CredentialChangedError);
    expect(rewrapFailure).toMatchObject({ code: 'generation_mismatch' });
    const raw = await client!.call<{ key_version: number }>('get_credential', [ctx.user_id, ctx.company_id, created.connectionId]);
    expect(raw[0].key_version).toBe(ring.version);
  });

  it('T-43 repetir la misma creación preparada reconoce el mismo intento SQL', async () => {
    const ctx = await company('repeticion');
    const keyring = keyringApi.getCredentialKeyring();
    const operation = repository.preparePendingConnectionWithCredential(ctx, input, { keyring });
    const first = await repository.executePreparedCredentialOperation(ctx, operation, { workerApi: client! });
    const second = await repository.executePreparedCredentialOperation(ctx, operation, { workerApi: client! });
    expect(second).toEqual(first);
    const rows = await client!.call('get_credential', [ctx.user_id, ctx.company_id, first.connectionId]);
    expect(rows).toHaveLength(1);
  });

  // --- M16c: cuatro operaciones nuevas con el rol real ---

  const LIMITS = { lookbackDays: 3, maxWindowDays: 3, maxPagesPerLevel: 2, maxMetadataPages: 2, maxEntities: 10,
    maxPayloadBytes: 100_000, maxDurationMs: 20_000, finalizationReserveMs: 10_000, leaseSeconds: 30, maxRetries: 2,
    retryDelayMs: 500 };
  const SHORT_LEASE = { ...LIMITS, maxDurationMs: 500, finalizationReserveMs: 500, leaseSeconds: 1 };
  const EMPTY = { entities: [], days: [] };
  const today = () => new Date().toISOString().slice(0, 10);

  async function activeConnection(prefix: string) {
    const ctx = await company(prefix);
    const keyring = keyringApi.getCredentialKeyring();
    const created = await repository.executePreparedCredentialOperation(ctx,
      repository.preparePendingConnectionWithCredential(ctx, input, { keyring }), { workerApi: client! });
    await client!.call('confirm_connection', [ctx.user_id, ctx.company_id, created.connectionId,
      `act_${randomInt(1_000_000, 2_000_000_000)}`, 'USD', 'UTC', true]);
    return { ctx, connectionId: created.connectionId };
  }

  function run(connectionId: string, limits = LIMITS) {
    return { connectionId, expectedGeneration: 0, runId: randomUUID(), ownershipToken: randomBytes(32).toString('hex'),
      windowFrom: today(), windowTo: today(), limits };
  }

  it('M16c-T-26 las cuatro operaciones nuevas corren con el rol real y sus errores no llevan detalle', async () => {
    const { ctx, connectionId } = await activeConnection('sync-ops');
    const a = run(connectionId);
    const started = await syncCalls.startSyncRun(ctx, a, { workerApi: client! });
    expect(started).toMatchObject({ runId: a.runId, credentialGeneration: 0 });
    expect(started.startedAt).toBeInstanceOf(Date);
    expect(started.leaseExpiresAt.getTime()).toBeGreaterThan(started.startedAt.getTime());

    const conflict = await syncCalls.startSyncRun(ctx, run(connectionId), { workerApi: client! }).catch((error) => error);
    expect(conflict).toMatchObject({ code: 'sync_in_progress', message: 'Ya hay una sincronización en curso.' });
    expect(Object.keys(conflict)).not.toContain('detail');

    const shared = { connectionId, expectedGeneration: 0, runId: a.runId, ownershipToken: a.ownershipToken };
    const published = await syncCalls.publishSnapshot(ctx, { ...shared, snapshotId: randomUUID(), level: 'account',
      fetchedAt: started.startedAt.toISOString(), pages: 1, durationMs: 5, payload: EMPTY }, { workerApi: client! });
    expect(published).toEqual({ snapshotId: expect.any(String), level: 'account', complete: true });

    const failed = await syncCalls.failSyncRun(ctx, { ...shared, snapshotId: randomUUID(), level: 'campaign',
      fetchedAt: started.startedAt.toISOString(), pages: 0, durationMs: 5, payload: EMPTY, validatedPages: 0,
      failureReason: 'own_error', errorClass: 'own_error', errorMessage: 'Fallo sintético.', stopRemaining: true },
    { workerApi: client! });
    expect(failed).toEqual({ runId: a.runId, level: 'campaign', status: 'partial', snapshotResult: 'failed' });

    const lost = await syncCalls.publishSnapshot(ctx, { ...shared, ownershipToken: randomBytes(32).toString('hex'),
      snapshotId: randomUUID(), level: 'adset', fetchedAt: started.startedAt.toISOString(), pages: 1, durationMs: 5,
      payload: EMPTY }, { workerApi: client! }).catch((error) => error);
    expect(lost).toMatchObject({ code: 'sync_ownership_lost',
      message: 'La sincronización venció o fue reemplazada. Volvé a sincronizar.' });

    expect(await syncCalls.recordConnectionError(ctx, { connectionId, expectedGeneration: 0, errorClass: 'unknown',
      message: 'Error de Meta sin detalle.' }, { workerApi: client! }))
      .toEqual({ connectionId, status: 'active', credentialGeneration: 0 });
    await expect(pool!.query('select * from public.meta_sync_runs limit 1')).rejects.toMatchObject({ code: '42501' });
  });

  it('M16c-T-26 el adaptador rechaza nombres arbitrarios y los envoltorios validan entrada y respuesta', async () => {
    await expect(client!.call('select_anything' as never, [])).rejects.toMatchObject({ code: 'invalid_argument' });
    await expect(client!.call('publish_snapshot', [])).rejects.toMatchObject({ code: 'invalid_argument' });

    const ctx: TenantContext = { user_id: randomUUID(), company_id: randomUUID(), role: 'owner', request_id: randomUUID() };
    const connectionId = randomUUID();
    const silent: WorkerApi = { call: vi.fn(async () => { throw new Error('no debe llamarse'); }) };
    await expect(syncCalls.recordConnectionError(ctx, { connectionId, expectedGeneration: -1, errorClass: 'unknown',
      message: 'x' }, { workerApi: silent })).rejects.toThrow('Respuesta de sincronización inválida.');
    await expect(syncCalls.recordConnectionError(ctx, { connectionId, expectedGeneration: 0, errorClass: 'authentication',
      message: 'x' }, { workerApi: silent })).rejects.toThrow('Respuesta de sincronización inválida.');
    await expect(syncCalls.startSyncRun(ctx, { ...run(connectionId), ownershipToken: 'corto' },
      { workerApi: silent })).rejects.toThrow('Respuesta de sincronización inválida.');
    await expect(syncCalls.startSyncRun({ ...ctx, user_id: 'sin-uuid' }, run(connectionId),
      { workerApi: silent })).rejects.toThrow('Respuesta de sincronización inválida.');
    expect(silent.call).not.toHaveBeenCalled();

    const answering = (row: unknown): WorkerApi => ({ call: (async () => [row]) as WorkerApi['call'] });
    const base = { connection_id: connectionId, status: 'active', credential_generation: 0 };
    const send = (row: unknown) => syncCalls.recordConnectionError(ctx, { connectionId, expectedGeneration: 0,
      errorClass: 'unknown', message: 'x' }, { workerApi: answering(row) });
    await expect(send(base)).resolves.toEqual({ connectionId, status: 'active', credentialGeneration: 0 });
    for (const row of [{ ...base, extra: 1 }, { ...base, credential_generation: '0' }, { ...base, status: 'otro' },
      { ...base, connection_id: randomUUID() }]) {
      await expect(send(row)).rejects.toThrow('Respuesta de sincronización inválida.');
    }
  });

  it('M16c-T-04 dos inicios concurrentes dejan una sola ejecución vigente', async () => {
    const { ctx, connectionId } = await activeConnection('sync-concurrent');
    const results = await Promise.allSettled([run(connectionId), run(connectionId), run(connectionId)]
      .map((attempt) => syncCalls.startSyncRun(ctx, attempt, { workerApi: client! })));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    for (const result of results) {
      if (result.status === 'rejected') expect(result.reason).toMatchObject({ code: 'sync_in_progress' });
    }
  });

  it('M16c-T-04 una escritura que espera el bloqueo hasta vencer el lease se rechaza con el reloj real', async () => {
    const { ctx, connectionId } = await activeConnection('sync-lock');
    const a = run(connectionId, SHORT_LEASE);
    const started = await syncCalls.startSyncRun(ctx, a, { workerApi: client! });
    const shared = { connectionId, expectedGeneration: 0, runId: a.runId, ownershipToken: a.ownershipToken };
    const holder = await pool!.connect();
    try {
      // La transacción abierta conserva el cerrojo de empresa que toma la función.
      await holder.query('begin');
      await holder.query('select * from worker_api.record_connection_error($1::uuid, $2::uuid, $3::uuid, $4::integer, $5::text, $6::text)',
        [ctx.user_id, ctx.company_id, connectionId, 0, 'unknown', 'Fallo sintético.']);
      const late = syncCalls.publishSnapshot(ctx, { ...shared, snapshotId: randomUUID(), level: 'account',
        fetchedAt: started.startedAt.toISOString(), pages: 1, durationMs: 5, payload: EMPTY }, { workerApi: client! })
        .catch((error) => error);
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await holder.query('rollback');
      expect(await late).toMatchObject({ code: 'sync_ownership_lost' });
    } finally {
      holder.release();
    }
  });
});
