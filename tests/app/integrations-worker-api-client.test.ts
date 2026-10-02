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
  let client: ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi> | undefined;
  let pool: pg.Pool | undefined;

  // Esta guarda es el primer beforeAll: sin destino seguro, no crea Pool, usuario ni fixture.
  beforeAll(async () => {
    const target = resolveIntegrationsTestTarget(process.env);
    if (!target.ok) throw new Error(target.problems?.join(' ') ?? 'Destino del rol no verificado.');
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);
    if (!(await remoteProjectReachable())) throw new Error('El proyecto de pruebas no responde.');

    [keyringApi, sealApi, workerApiModule, repository] = await Promise.all([
      vi.importActual<typeof keyringApi>('@/modules/integrations/crypto/keyring'),
      vi.importActual<typeof sealApi>('@/modules/integrations/crypto/seal'),
      vi.importActual<typeof workerApiModule>('@/modules/integrations/db/worker-api'),
      vi.importActual<typeof repository>('@/modules/integrations/repository/credentials'),
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
});
