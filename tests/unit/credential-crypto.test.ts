import { randomBytes, createDecipheriv } from 'node:crypto';
import { X509Certificate } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inspect } from 'node:util';
import { createRequire } from 'node:module';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { secretCredentialSchema, type CredentialAadInput } from '@/modules/integrations/contract';
import type { WorkerApi, Queryable } from '@/modules/integrations/db/worker-api';
import {
  CredentialKeyringError,
  CredentialKeyVersionUnknownError,
  parseCredentialKeyring,
} from '@/modules/integrations/crypto/keyring';
import {
  CredentialDecryptionError,
  CredentialMaterialError,
  openCredential,
  sealCredential,
} from '@/modules/integrations/crypto/seal';

vi.mock('server-only', () => ({}));
const pgState = vi.hoisted(() => ({ constructed: [] as unknown[], queries: [] as unknown[], ended: 0, listeners: [] as unknown[] }));
vi.mock('pg', () => ({
  default: { Pool: class {
    constructor(options: unknown) { pgState.constructed.push(options); }
    query(config: unknown) { pgState.queries.push(config); return Promise.resolve({ rows: [] }); }
    on(event: string, listener: unknown) { pgState.listeners.push([event, listener]); }
    end() { pgState.ended += 1; return Promise.resolve(); }
  } },
}));
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, createDecipheriv: vi.fn(actual.createDecipheriv) };
});

const companyId = '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f';
const otherCompanyId = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const connectionId = '4f1a7c2e-1b2c-4d5e-8f90-0a1b2c3d4e5f';
const otherConnectionId = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d';
const aad: CredentialAadInput = { company_id: companyId, connection_id: connectionId, provider: 'meta' };
const sample = 'token-sintetico-de-prueba';
const actorId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const attemptId = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e';
const ctx = Object.freeze({ user_id: actorId, company_id: companyId, role: 'owner' as const, request_id: '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f' });
const writeInput = Object.freeze({ token: sample, tokenType: 'system_user' as const, issuedForAppId: 'app_sintetica', grantedScopes: ['ads_read'], expiresAt: null });
const testRef = 'a'.repeat(20);
const roleUrl = `postgresql://praxa_integrations.${testRef}:clave@aws-0-us-west-2.pooler.supabase.com:6543/postgres`;
const ConnectionParameters = createRequire(import.meta.url)('pg/lib/connection-parameters') as new (options: Record<string, unknown>) => {
  user: string; host: string; port: number; sslnegotiation: string; ssl: { rejectUnauthorized: boolean; ca: string };
};

function expectRedacted(error: unknown, code: string, message: string) {
  expect(error).toMatchObject({ code, message });
  expect(error).not.toHaveProperty('cause');
  expect(error).not.toHaveProperty('issues');
  const serialized = JSON.stringify(error);
  for (const secret of [sample, roleUrl, actorId, companyId, 'marca-sintetica-confidencial']) {
    expect(serialized).not.toContain(secret);
    expect((error as Error).message).not.toContain(secret);
  }
}

async function rejection(task: Promise<unknown>): Promise<unknown> {
  try { await task; } catch (error) { return error; }
  throw new Error('La operación debía fallar.');
}

let createWorkerApi: (typeof import('@/modules/integrations/db/worker-api'))['createWorkerApi'];
let getWorkerApi: (typeof import('@/modules/integrations/db/worker-api'))['getWorkerApi'];
let SUPABASE_ROOT_CA: (typeof import('@/modules/integrations/db/worker-api'))['SUPABASE_ROOT_CA'];
let WorkerApiError: (typeof import('@/modules/integrations/db/worker-api'))['WorkerApiError'];
let CredentialChangedError: (typeof import('@/modules/integrations/repository/credentials'))['CredentialChangedError'];
let CredentialNotFoundError: (typeof import('@/modules/integrations/repository/credentials'))['CredentialNotFoundError'];
let CredentialRepositoryError: (typeof import('@/modules/integrations/repository/credentials'))['CredentialRepositoryError'];
let canRetireKeyVersion: (typeof import('@/modules/integrations/repository/credentials'))['canRetireKeyVersion'];
let countCredentialsByKeyVersion: (typeof import('@/modules/integrations/repository/credentials'))['countCredentialsByKeyVersion'];
let createPendingConnectionWithCredential: (typeof import('@/modules/integrations/repository/credentials'))['createPendingConnectionWithCredential'];
let executePreparedCredentialOperation: (typeof import('@/modules/integrations/repository/credentials'))['executePreparedCredentialOperation'];
let preparePendingConnectionWithCredential: (typeof import('@/modules/integrations/repository/credentials'))['preparePendingConnectionWithCredential'];
let prepareReplaceCredential: (typeof import('@/modules/integrations/repository/credentials'))['prepareReplaceCredential'];
let readCredential: (typeof import('@/modules/integrations/repository/credentials'))['readCredential'];

async function loadWorker() {
  const loadedWorker = await vi.importActual<typeof import('@/modules/integrations/db/worker-api')>('@/modules/integrations/db/worker-api');
  ({ createWorkerApi, getWorkerApi, SUPABASE_ROOT_CA, WorkerApiError } = loadedWorker);
}

async function loadRepository() {
  await loadWorker();
  const loadedRepository = await vi.importActual<typeof import('@/modules/integrations/repository/credentials')>('@/modules/integrations/repository/credentials');
  ({ CredentialChangedError, CredentialNotFoundError, CredentialRepositoryError,
    canRetireKeyVersion, countCredentialsByKeyVersion, createPendingConnectionWithCredential,
    executePreparedCredentialOperation, preparePendingConnectionWithCredential,
    prepareReplaceCredential, readCredential } = loadedRepository);
}

function material() {
  return [randomBytes(32).toString('base64'), randomBytes(32).toString('base64')] as const;
}

function keyring(current = 1) {
  const [first, second] = material();
  return parseCredentialKeyring(`1:${first}, 2:${second}`, String(current));
}

function flipByte(base64: string) {
  const bytes = Buffer.from(base64, 'base64');
  bytes[0] ^= 1;
  return bytes.toString('base64');
}

function api(handler: (fn: string, args: readonly unknown[]) => Promise<unknown[]>): WorkerApi & { call: ReturnType<typeof vi.fn> } {
  return { call: vi.fn(handler) } as unknown as WorkerApi & { call: ReturnType<typeof vi.fn> };
}

function credentialRow(ring: ReturnType<typeof keyring>, status = 'active', version = ring.currentVersion) {
  const keys = ring.versions.map((v) => `${v}:${ring.keyFor(v).toString('base64')}`).join(',');
  const old = parseCredentialKeyring(keys, String(version));
  return {
    connection_id: connectionId, company_id: companyId, provider: 'meta', status,
    credential_generation: 3, ...sealCredential(sample, aad, old),
    token_type: 'system_user', issued_for_app_id: 'app_sintetica',
    granted_scopes: ['ads_read'], expires_at: null,
  };
}

describe('M06.3a paso 1 RED: llavero y cifrado', () => {
  it('T-01 acepta dos versiones, ordena y entrega copias de 32 bytes', () => {
    const [first, second] = material();
    const ring = parseCredentialKeyring(` 2:${second} , 1:${first} `, '2');
    expect(ring.currentVersion).toBe(2);
    expect(ring.versions).toEqual([1, 2]);
    expect(ring.has(1)).toBe(true);
    expect(ring.has(3)).toBe(false);
    const copy = ring.keyFor(1);
    expect(copy).toHaveLength(32);
    copy.fill(0);
    expect(ring.keyFor(1).toString('base64')).toBe(first);
  });

  it('T-02 rechaza cada forma inválida sin exponer la clave', () => {
    const [first, second] = material();
    const invalid: Array<[string | undefined, string | undefined, string, number | null]> = [
      [undefined, '1', 'keyring_missing', null],
      ['', '1', 'keyring_missing', null],
      [`1${first}`, '1', 'keyring_invalid', 1],
      [`0:${first}`, '0', 'keyring_invalid', 1],
      [`-1:${first}`, '1', 'keyring_invalid', 1],
      [`01:${first}`, '1', 'keyring_invalid', 1],
      [`1.5:${first}`, '1', 'keyring_invalid', 1],
      [`2147483648:${first}`, '1', 'keyring_invalid', 1],
      [`1:${first},1:${second}`, '1', 'keyring_invalid', 2],
      ['1:not-base64', '1', 'keyring_invalid', 1],
      [`1:${randomBytes(31).toString('base64')}`, '1', 'keyring_invalid', 1],
      [`1:${randomBytes(33).toString('base64')}`, '1', 'keyring_invalid', 1],
      [`1:${first}`, undefined, 'current_invalid', null],
      [`1:${first}`, 'x', 'current_invalid', null],
      [`1:${first}`, '2', 'current_invalid', null],
    ];
    for (const [keys, current, code, position] of invalid) {
      let error: unknown;
      try { parseCredentialKeyring(keys, current); } catch (caught) { error = caught; }
      expect(error).toBeInstanceOf(CredentialKeyringError);
      expect((error as CredentialKeyringError).code).toBe(code);
      if (position !== null) expect((error as Error).message).toContain(String(position));
      expect((error as Error).message).not.toContain(first);
      expect((error as Error).message).not.toContain(second);
      expect(error).not.toHaveProperty('cause');
    }
  });

  it('T-03 sella y abre material conforme K04 usando la versión actual', () => {
    const ring = keyring(2);
    const sealed = sealCredential(sample, aad, ring);
    expect(sealed.key_version).toBe(2);
    expect(secretCredentialSchema.safeParse({
      ...sealed, company_id: companyId, connection_id: connectionId,
      token_type: 'system_user', issued_for_app_id: 'app_sintetica',
      granted_scopes: ['ads_read'], expires_at: null,
    }).success).toBe(true);
    expect(openCredential(sealed, aad, ring).reveal()).toBe(sample);
  });

  it('T-04 usa IV aleatorio nuevo de 12 bytes y etiqueta de 16 bytes', () => {
    const ring = keyring();
    const a = sealCredential(sample, aad, ring);
    const b = sealCredential(sample, aad, ring);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(Buffer.from(a.iv, 'base64')).toHaveLength(12);
    expect(Buffer.from(a.auth_tag, 'base64')).toHaveLength(16);
  });

  it('T-05 rechaza texto vacío', () => {
    expect(() => sealCredential('', aad, keyring())).toThrow(CredentialMaterialError);
  });

  it('T-06 distingue una clave errónea de material válido', () => {
    const sealed = sealCredential(sample, aad, keyring());
    expect(() => openCredential(sealed, aad, keyring())).toThrow(CredentialDecryptionError);
  });

  it('T-07 rechaza alteraciones de ciphertext, etiqueta e IV', () => {
    const ring = keyring();
    const sealed = sealCredential(sample, aad, ring);
    for (const field of ['ciphertext', 'auth_tag', 'iv'] as const) {
      expect(() => openCredential({ ...sealed, [field]: flipByte(sealed[field]) }, aad, ring))
        .toThrow(CredentialDecryptionError);
    }
  });

  it('T-08 autentica empresa y conexión como AAD', () => {
    const ring = keyring();
    const sealed = sealCredential(sample, aad, ring);
    expect(() => openCredential(sealed, { ...aad, company_id: otherCompanyId }, ring))
      .toThrow(CredentialDecryptionError);
    expect(() => openCredential(sealed, { ...aad, connection_id: otherConnectionId }, ring))
      .toThrow(CredentialDecryptionError);
  });

  it('T-09 valida etiqueta corta antes de llamar al descifrador', () => {
    const ring = keyring();
    const sealed = sealCredential(sample, aad, ring);
    vi.mocked(createDecipheriv).mockClear();
    expect(() => openCredential({ ...sealed, auth_tag: randomBytes(4).toString('base64') }, aad, ring))
      .toThrow(CredentialMaterialError);
    expect(createDecipheriv).not.toHaveBeenCalled();
  });

  it('T-10 informa versión ausente con error propio y sin material', () => {
    const ring = keyring();
    const sealed = { ...sealCredential(sample, aad, ring), key_version: 99 };
    let error: unknown;
    try { openCredential(sealed, aad, ring); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(CredentialKeyVersionUnknownError);
    expect(error).not.toBeInstanceOf(CredentialDecryptionError);
    expect((error as Error).message).toContain('99');
    expect((error as Error).message).not.toContain(sealed.ciphertext);
    expect(error).not.toHaveProperty('cause');
  });

  it('T-11 conserva la clave anterior para leer y usa la actual para escribir', () => {
    const [first, second] = material();
    const old = parseCredentialKeyring(`1:${first}`, '1');
    const both = parseCredentialKeyring(`1:${first},2:${second}`, '2');
    const next = parseCredentialKeyring(`2:${second}`, '2');
    const sealedOld = sealCredential(sample, aad, old);
    expect(openCredential(sealedOld, aad, both).reveal()).toBe(sample);
    expect(sealCredential(sample, aad, both).key_version).toBe(2);
    expect(() => openCredential(sealedOld, aad, next)).toThrow(CredentialKeyVersionUnknownError);
  });

  it('T-20 solo reveal expone el valor de SecretValue', () => {
    const ring = keyring();
    const secret = openCredential(sealCredential(sample, aad, ring), aad, ring);
    expect(String(secret)).toBe('[redactado]');
    expect(`${secret}`).toBe('[redactado]');
    expect(JSON.stringify({ t: secret })).toBe('{"t":"[redactado]"}');
    expect(inspect(secret)).toBe('[redactado]');
    expect(secret.reveal()).toBe(sample);
  });
});

describe('M06.3a paso 2 RED: repositorio', () => {
  beforeAll(loadRepository);

  it('T-12 recifra con generación y versión leídas; devuelve la versión leída', async () => {
    const ring = keyring(2);
    const row = credentialRow(ring, 'active', 1);
    const workerApi = api(async (fn) => fn === 'get_credential'
      ? [row]
      : [{ connection_id: connectionId, key_version: 2 }]);
    const result = await readCredential(ctx, connectionId, { workerApi, keyring: ring });
    expect(result.token.reveal()).toBe(sample);
    expect(result.keyVersion).toBe(1);
    expect(result.rewrap).toEqual({ status: 'confirmed' });
    expect(workerApi.call).toHaveBeenCalledTimes(2);
    const [fn, args] = workerApi.call.mock.calls[1] as [string, unknown[]];
    expect(fn).toBe('rewrap_credential');
    expect(args.slice(0, 5)).toEqual([actorId, companyId, connectionId, 3, 1]);
    expect(args[8]).toBe(2);
    expect(openCredential({ ciphertext: args[5], iv: args[6], auth_tag: args[7], key_version: args[8] } as ReturnType<typeof sealCredential>, aad, ring).reveal()).toBe(sample);
  });

  it('T-13 evita recifrar si la versión es igual o mayor', async () => {
    const ring = keyring(1);
    for (const version of [1, 2]) {
      const workerApi = api(async () => [credentialRow(ring, 'active', version)]);
      const result = await readCredential(ctx, connectionId, { workerApi, keyring: ring });
      expect(result.keyVersion).toBe(version);
      expect(result.rewrap).toEqual({ status: 'not_attempted' });
      expect(workerApi.call).toHaveBeenCalledTimes(1);
    }
  });

  it('T-14 descifra disconnected y recifra solo estados permitidos', async () => {
    const ring = keyring(2);
    for (const status of ['disconnected', 'pending_selection', 'needs_reauth']) {
      const workerApi = api(async (fn) => fn === 'get_credential'
        ? [credentialRow(ring, status, 1)]
        : [{ connection_id: connectionId, key_version: 2 }]);
      const result = await readCredential(ctx, connectionId, { workerApi, keyring: ring });
      expect(result.token.reveal()).toBe(sample);
      expect(result.rewrap.status).toBe(status === 'disconnected' ? 'not_attempted' : 'confirmed');
      expect(workerApi.call).toHaveBeenCalledTimes(status === 'disconnected' ? 1 : 2);
    }
  });

  it('T-15 distingue conflicto de generación y conflicto de versión', async () => {
    const ring = keyring(2);
    for (const [code, expected] of [['generation_mismatch', 'changed'], ['key_version_mismatch', 'version_conflict']] as const) {
      const workerApi = api(async (fn) => {
        if (fn === 'get_credential') return [credentialRow(ring, 'active', 1)];
        throw new WorkerApiError(code);
      });
      if (expected === 'changed') {
        await expect(readCredential(ctx, connectionId, { workerApi, keyring: ring })).rejects.toBeInstanceOf(CredentialChangedError);
      } else {
        const result = await readCredential(ctx, connectionId, { workerApi, keyring: ring });
        expect(result.keyVersion).toBe(1);
        expect(result.rewrap).toEqual({ status: 'version_conflict' });
      }
      expect(workerApi.call).toHaveBeenCalledTimes(2);
    }
  });

  it('T-16 convierte conteos y limita canRetireKeyVersion a la condición DB', async () => {
    const two = api(async () => [{ key_version: 1, credential_count: '2' }]);
    expect(await countCredentialsByKeyVersion({ workerApi: two })).toEqual([{ keyVersion: 1, credentialCount: 2 }]);
    expect(await canRetireKeyVersion(1, { workerApi: two })).toBe(false);
    expect(await canRetireKeyVersion(1, { workerApi: api(async () => []) })).toBe(true);
    expect(await canRetireKeyVersion(1, { workerApi: api(async () => [{ key_version: 1, credential_count: '0' }]) })).toBe(true);
    await expect(countCredentialsByKeyVersion({ workerApi: api(async () => [{ key_version: 1, credential_count: '1.5' }]) }))
      .rejects.toMatchObject({ code: 'unexpected' });
  });

  it('T-19 valida K01 antes de consultas y genera conexión nueva con AAD propio', async () => {
    const ring = keyring();
    const workerApi = api(async (_fn, args) => [{ connection_id: args[2], status: 'pending_selection', pending_expires_at: new Date(), credential_generation: 1 }]);
    await expect(createPendingConnectionWithCredential({ ...ctx, company_id: 'inválido' }, { ...writeInput, clientBusinessId: 'business_sintetico' }, { workerApi, keyring: ring }))
      .rejects.toMatchObject({ code: 'invalid_input' });
    expect(workerApi.call).not.toHaveBeenCalled();
    const created = await createPendingConnectionWithCredential(ctx, { ...writeInput, clientBusinessId: 'business_sintetico' }, { workerApi, keyring: ring });
    expect(created.connectionId).toMatch(/^[0-9a-f-]{36}$/);
    const args = workerApi.call.mock.calls[0][1] as unknown[];
    expect(args.slice(0, 3)).toEqual([actorId, companyId, created.connectionId]);
    const newAad = { ...aad, connection_id: created.connectionId };
    expect(openCredential({ ciphertext: args[4], iv: args[5], auth_tag: args[6], key_version: args[7] } as ReturnType<typeof sealCredential>, newAad, ring).reveal()).toBe(sample);
    expect(() => openCredential({ ciphertext: args[4], iv: args[5], auth_tag: args[6], key_version: args[7] } as ReturnType<typeof sealCredential>, aad, ring))
      .toThrow(CredentialDecryptionError);
  });

  it('T-42 prepara una vez y repite argumentos idénticos sin resellar', async () => {
    const originalRing = keyring();
    const ring = { ...originalRing, currentVersion: 1 };
    let loseResponse = true;
    const workerApi = api(async (fn, args) => {
      if (loseResponse) { loseResponse = false; throw new WorkerApiError('unavailable', 'transport'); }
      return fn === 'create_pending_connection'
        ? [{ connection_id: args[2], status: 'pending_selection', pending_expires_at: new Date(), credential_generation: 1 }]
        : [{ connection_id: args[2], status: 'active', credential_generation: 2 }];
    });
    const create = preparePendingConnectionWithCredential(ctx, { ...writeInput, clientBusinessId: 'business_sintetico' }, { keyring: ring });
    const replace = prepareReplaceCredential(ctx, { ...writeInput, connectionId, attemptId }, { keyring: ring });
    expect(JSON.stringify(create)).not.toContain(sample);
    expect(Object.isFrozen(create)).toBe(true);
    await expect(executePreparedCredentialOperation(ctx, create, { workerApi })).rejects.toMatchObject({ code: 'unavailable' });
    expect(workerApi.call).toHaveBeenCalledTimes(1);
    ring.currentVersion = 2;
    await executePreparedCredentialOperation(ctx, create, { workerApi });
    loseResponse = true;
    await expect(executePreparedCredentialOperation(ctx, replace, { workerApi })).rejects.toMatchObject({ code: 'unavailable' });
    expect(workerApi.call).toHaveBeenCalledTimes(3);
    await executePreparedCredentialOperation(ctx, replace, { workerApi });
    expect(workerApi.call.mock.calls[0]).toEqual(workerApi.call.mock.calls[1]);
    expect(workerApi.call.mock.calls[2]).toEqual(workerApi.call.mock.calls[3]);
    expect((workerApi.call.mock.calls[0][1] as unknown[])[7]).toBe(1);
    expect((workerApi.call.mock.calls[2][1] as unknown[])[7]).toBe(1);
    expect(workerApi.call).toHaveBeenCalledTimes(4);
    await expect(executePreparedCredentialOperation({ ...ctx, user_id: otherConnectionId }, replace, { workerApi }))
      .rejects.toMatchObject({ code: 'prepared_context_mismatch' });
    await expect(executePreparedCredentialOperation({ ...ctx, company_id: otherCompanyId }, create, { workerApi }))
      .rejects.toMatchObject({ code: 'prepared_context_mismatch' });
    expect(workerApi.call).toHaveBeenCalledTimes(4);
  });

  it('T-45 clasifica incertidumbre de rewrap antes o después de escritura sin retry', async () => {
    const ring = keyring(2);
    for (const [persisted, reason] of [[false, 'transport'], [true, 'transport'], [false, 'timeout'], [true, 'timeout']] as const) {
      let current = credentialRow(ring, 'active', 1);
      const workerApi = api(async (fn, args) => {
        if (fn === 'get_credential') return [current];
        if (persisted) current = { ...current, ciphertext: args[5] as string, iv: args[6] as string, auth_tag: args[7] as string, key_version: 2 };
        throw new WorkerApiError('unavailable', reason);
      });
      const first = await readCredential(ctx, connectionId, { workerApi, keyring: ring });
      expect(first.token.reveal()).toBe(sample);
      expect(first.keyVersion).toBe(1);
      expect(first.rewrap).toEqual({ status: 'unconfirmed', reason });
      expect(workerApi.call).toHaveBeenCalledTimes(2);
      expect(workerApi.call.mock.calls.map(([fn]) => fn)).toEqual(['get_credential', 'rewrap_credential']);
      const next = await readCredential(ctx, connectionId, { workerApi, keyring: ring });
      expect(next.keyVersion).toBe(persisted ? 2 : 1);
      expect(next.token.reveal()).toBe(sample);
      expect(workerApi.call).toHaveBeenCalledTimes(persisted ? 3 : 4);
    }
  });

  it('T-46 no trata errores explícitos como incertidumbre', async () => {
    const ring = keyring(2);
    for (const [code, kind] of [['privilege_missing', 'other'], ['unavailable', 'other'], ['generation_mismatch', 'other'], ['not_authorized', 'other'], ['invalid_argument', 'other']] as const) {
      const workerApi = api(async (fn) => {
        if (fn === 'get_credential') return [credentialRow(ring, 'active', 1)];
        throw new WorkerApiError(code, kind);
      });
      if (code === 'generation_mismatch') {
        await expect(readCredential(ctx, connectionId, { workerApi, keyring: ring }))
          .rejects.toMatchObject({ code: 'credential_changed', message: 'La credencial cambió; volvé a empezar.' });
      } else {
        await expect(readCredential(ctx, connectionId, { workerApi, keyring: ring }))
          .rejects.toMatchObject({ code, failureKind: 'other' });
      }
      expect(workerApi.call).toHaveBeenCalledTimes(2);
    }
    const failRead = api(async () => { throw new WorkerApiError('unavailable', 'transport'); });
    await expect(readCredential(ctx, connectionId, { workerApi: failRead, keyring: ring })).rejects.toMatchObject({ code: 'unavailable' });
    expect(failRead.call).toHaveBeenCalledTimes(1);
    const malformed = credentialRow(ring, 'active', 1);
    const invalid = api(async () => [{ ...malformed, auth_tag: 'malformed' }]);
    await expect(readCredential(ctx, connectionId, { workerApi: invalid, keyring: ring }))
      .rejects.toMatchObject({ code: 'invalid_response' });
    expect(invalid.call).toHaveBeenCalledTimes(1);
    const tampered = api(async () => [{ ...malformed, ciphertext: flipByte(malformed.ciphertext) }]);
    await expect(readCredential(ctx, connectionId, { workerApi: tampered, keyring: ring }))
      .rejects.toBeInstanceOf(CredentialDecryptionError);
    expect(tampered.call).toHaveBeenCalledTimes(1);
    const failedSealRing = { ...ring, keyFor: (version: number) => {
      if (version === 2) throw new CredentialKeyVersionUnknownError(version);
      return ring.keyFor(version);
    } };
    const failedSeal = api(async () => [malformed]);
    await expect(readCredential(ctx, connectionId, { workerApi: failedSeal, keyring: failedSealRing }))
      .rejects.toBeInstanceOf(CredentialKeyVersionUnknownError);
    expect(failedSeal.call).toHaveBeenCalledTimes(1);
    const conflict = api(async (fn) => fn === 'get_credential'
      ? [malformed] : Promise.reject(new WorkerApiError('key_version_mismatch')));
    const conflictResult = await readCredential(ctx, connectionId, { workerApi: conflict, keyring: ring });
    expect(conflictResult.rewrap).toEqual({ status: 'version_conflict' });
    expect(conflictResult.keyVersion).toBe(1);
    expect(conflict.call).toHaveBeenCalledTimes(2);
    const success = api(async (fn) => fn === 'get_credential'
      ? [malformed] : [{ connection_id: connectionId, key_version: 2 }]);
    expect((await readCredential(ctx, connectionId, { workerApi: success, keyring: ring })).rewrap)
      .toEqual({ status: 'confirmed' });
    const disconnected = api(async () => [credentialRow(ring, 'disconnected', 1)]);
    expect((await readCredential(ctx, connectionId, { workerApi: disconnected, keyring: ring })).rewrap)
      .toEqual({ status: 'not_attempted' });
    expect(disconnected.call).toHaveBeenCalledTimes(1);
    for (const signal of [conflictResult.rewrap, { status: 'unconfirmed', reason: 'timeout' }]) {
      const serialized = JSON.stringify(signal);
      expect(serialized).not.toContain(sample);
      expect(serialized).not.toContain(malformed.ciphertext);
    }
  });

  it('T-51 rechaza entradas y operaciones forjadas antes de DB', async () => {
    const originalRing = keyring();
    const ring = { ...originalRing, keyFor: vi.fn(originalRing.keyFor) };
    const workerApi = api(async () => []);
    const badContexts = [
      { ...ctx, user_id: 'bad' }, { ...ctx, company_id: 'bad' },
      { ...ctx, request_id: 'bad' }, { ...ctx, role: 'reader' }, { ...ctx, extra: true },
      { ...ctx, user_id: null }, { ...ctx, company_id: null },
      { ...ctx, request_id: null }, { ...ctx, role: null },
    ];
    for (const bad of badContexts) {
      const error = await rejection(readCredential(bad as typeof ctx, connectionId, { workerApi, keyring: ring }));
      expect(error).toBeInstanceOf(CredentialRepositoryError);
      expectRedacted(error, 'invalid_input', 'Entrada de credenciales inválida.');
    }
    for (const bad of [
      { ...writeInput, token: '' }, { ...writeInput, token: null }, { ...writeInput, tokenType: 'otro' },
      { ...writeInput, grantedScopes: ['otro'] }, { ...writeInput, expiresAt: 'bad' },
      { ...writeInput, issuedForAppId: '' }, { ...writeInput, extra: true },
    ]) {
      let error: unknown;
      try { preparePendingConnectionWithCredential(ctx, { ...bad, clientBusinessId: 'business_sintetico' } as never, { keyring: ring }); }
      catch (caught) { error = caught; }
      expect(error).toBeInstanceOf(CredentialRepositoryError);
      expectRedacted(error, 'invalid_input', 'Entrada de credenciales inválida.');
    }
    for (const bad of [
      { ...writeInput, clientBusinessId: '' }, { ...writeInput, clientBusinessId: 'business_sintetico', companyId },
      { ...writeInput, connectionId: 'bad', attemptId }, { ...writeInput, connectionId, attemptId: 'bad' },
    ]) {
      let error: unknown;
      try {
        if ('clientBusinessId' in bad) preparePendingConnectionWithCredential(ctx, bad as never, { keyring: ring });
        else prepareReplaceCredential(ctx, bad as never, { keyring: ring });
      } catch (caught) { error = caught; }
      expectRedacted(error, 'invalid_input', 'Entrada de credenciales inválida.');
    }
    expect(ring.keyFor).not.toHaveBeenCalled();
    for (const version of [0, -1, 1.5, 2_147_483_648, NaN]) {
      const error = await rejection(canRetireKeyVersion(version, { workerApi }));
      expect(error).toBeInstanceOf(CredentialRepositoryError);
      expectRedacted(error, 'invalid_input', 'Entrada de credenciales inválida.');
    }
    const forgedError = await rejection(executePreparedCredentialOperation(ctx, {} as never, { workerApi }));
    expect(forgedError).toBeInstanceOf(CredentialRepositoryError);
    expectRedacted(forgedError, 'invalid_prepared_operation', 'Operación de credenciales preparada inválida.');
    const authentic = preparePendingConnectionWithCredential(ctx, { ...writeInput, clientBusinessId: 'business_sintetico' }, { keyring: ring });
    for (const other of [{ ...ctx, user_id: otherConnectionId }, { ...ctx, company_id: otherCompanyId }]) {
      const error = await rejection(executePreparedCredentialOperation(other, authentic, { workerApi }));
      expect(error).toBeInstanceOf(CredentialRepositoryError);
      expectRedacted(error, 'prepared_context_mismatch', 'La operación preparada no corresponde al contexto actual.');
    }
    const clonedError = await rejection(executePreparedCredentialOperation(ctx, { ...authentic } as never, { workerApi }));
    expectRedacted(clonedError, 'invalid_prepared_operation', 'Operación de credenciales preparada inválida.');
    expect(workerApi.call).not.toHaveBeenCalled();
    expect(ring.keyFor).toHaveBeenCalledTimes(1);
  });

  it('T-52 valida get_credential antes de descifrar y proyecta K04', async () => {
    const ring = keyring();
    const valid = credentialRow(ring);
    await expect(readCredential(ctx, connectionId, { workerApi: api(async () => []), keyring: ring }))
      .rejects.toBeInstanceOf(CredentialNotFoundError);
    const badRows = [
      [valid, valid], [null], [{ ...valid, connection_id: otherConnectionId }], [{ ...valid, company_id: otherCompanyId }],
      [{ ...valid, provider: 'otro' }], [{ ...valid, status: 'otro' }],
      [{ ...valid, credential_generation: -1 }], [{ ...valid, credential_generation: 1.5 }],
      [{ ...valid, credential_generation: 2_147_483_648 }], [{ ...valid, credential_generation: null }],
      [{ ...valid, expires_at: new Date(NaN) }], [{ ...valid, ciphertext: 'bad' }],
      [{ ...valid, key_version: 0 }], [{ ...valid, token_type: 'otro' }],
      [{ ...valid, unexpected_column: 1 }],
    ];
    for (const rows of badRows) {
      const workerApi = api(async () => rows);
      vi.mocked(createDecipheriv).mockClear();
      const error = await rejection(readCredential(ctx, connectionId, { workerApi, keyring: ring }));
      expect(error).toBeInstanceOf(CredentialRepositoryError);
      expectRedacted(error, 'invalid_response', 'Respuesta de credenciales inválida.');
      expect(workerApi.call).toHaveBeenCalledTimes(1);
      expect(createDecipheriv).not.toHaveBeenCalled();
    }
    const result = await readCredential(ctx, connectionId, { workerApi: api(async () => [valid]), keyring: ring });
    expect(result.token.reveal()).toBe(sample);
    expect(Object.keys(result)).toEqual(expect.arrayContaining(['connectionId', 'status', 'credentialGeneration', 'keyVersion', 'tokenType', 'issuedForAppId', 'grantedScopes', 'expiresAt', 'token', 'rewrap']));
    const tampered = { ...valid, ciphertext: flipByte(valid.ciphertext) };
    await expect(readCredential(ctx, connectionId, { workerApi: api(async () => [tampered]), keyring: ring }))
      .rejects.toBeInstanceOf(CredentialDecryptionError);
  });
});

describe('M06.3a paso 2 RED: cliente worker_api', () => {
  beforeAll(loadWorker);

  it('T-18 usa SQL fijo, casts, aridad y valores copiados sin name', async () => {
    const calls: unknown[] = [];
    const pool = {
      query: vi.fn(async (config: unknown) => { calls.push(config); return { rows: [{ ok: true }] }; }),
      on: vi.fn(), end: vi.fn(async () => {}),
    } as unknown as Queryable & { on: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
    const client = createWorkerApi({ pool });
    const arities = {
      create_oauth_attempt: 8, consume_oauth_attempt: 4, create_pending_connection: 12,
      get_credential: 3, confirm_connection: 7, replace_credential: 12,
      mark_needs_reauth: 6, begin_disconnect: 3, purge_connection: 3,
      list_pending_purges: 2, count_credentials_by_key_version: 0, rewrap_credential: 9,
    } as const;
    for (const [fn, arity] of Object.entries(arities)) {
      const args = Array.from({ length: arity }, (_, i) => `arg${i}`);
      expect(await client.call(fn as keyof typeof arities, args)).toEqual([{ ok: true }]);
      const config = calls.at(-1) as { text: string; values: unknown[]; name?: string };
      expect(config.text).toMatch(new RegExp(`^select \\* from worker_api\\.${fn}\\(`));
      expect(config.values).toEqual(args);
      expect(config.values).not.toBe(args);
      expect(config).not.toHaveProperty('name');
      expect(config.text.match(/\$\d+::/g) ?? []).toHaveLength(arity);
      await expect(client.call(fn as keyof typeof arities, Array(arity + 1).fill(null))).rejects.toMatchObject({ code: 'invalid_argument' });
    }
    expect(calls).toHaveLength(Object.keys(arities).length);
    expect(pool.on).toHaveBeenCalledWith('error', expect.any(Function));
    await client.end();
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('T-18 no usa URL runtime como fallback en ausencia de la variable', () => {
    vi.stubEnv('PRAXA_INTEGRATIONS_DB_URL', undefined);
    try {
      expect(() => getWorkerApi()).toThrow(WorkerApiError);
      expect(() => getWorkerApi()).toThrow('Falta PRAXA_INTEGRATIONS_DB_URL.');
    } finally { vi.unstubAllEnvs(); }
  });

  it('T-17 traduce y redacta errores de pg sin cause ni propiedades originales', async () => {
    const mappings = [
      ...Object.entries({ PX001: 'not_authorized', PX002: 'attempt_rejected', PX003: 'live_connection_exists', PX004: 'invalid_transition', PX005: 'pending_expired', PX006: 'generation_mismatch', PX007: 'account_conflict', PX008: 'key_version_mismatch', '22023': 'invalid_argument', '42501': 'privilege_missing', '42883': 'privilege_missing' })
        .map(([source, code]) => ({ source, code, failureKind: 'other' })),
      ...['08006', 'ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET']
        .map((source) => ({ source, code: 'unavailable', failureKind: 'transport' })),
      ...['ETIMEDOUT', 'ETIMEOUT', 'QUERY_TIMEOUT']
        .map((source) => ({ source, code: 'unavailable', failureKind: 'timeout' })),
      ...['28P01', '53300', '57P01', '57P03']
        .map((source) => ({ source, code: 'unavailable', failureKind: 'other' })),
      { source: 'OTHER', code: 'unexpected', failureKind: 'other' },
      { source: null, code: 'unavailable', failureKind: 'timeout' },
    ];
    const marker = 'marca-sintetica-confidencial';
    for (const { source, code, failureKind } of mappings) {
      const pool: Queryable = {
        query: async () => { throw Object.assign(new Error(source === null ? 'Query read timeout' : marker), {
          ...(source === null ? {} : { code: source }), detail: marker, hint: marker, connectionString: roleUrl,
        }); },
        on: vi.fn(), end: vi.fn(async () => {}),
      };
      const error = await rejection(createWorkerApi({ pool }).call('get_credential', [actorId, companyId, connectionId]));
      expect(error).toBeInstanceOf(WorkerApiError);
      expect(error).toMatchObject({ code, failureKind });
      expect((error as Error).message).not.toContain(marker);
      expect(JSON.stringify(error)).not.toContain(marker);
      expect(JSON.stringify(error)).not.toContain(roleUrl);
      expect(error).not.toHaveProperty('cause');
      expect(error).not.toHaveProperty('detail');
      expect(error).not.toHaveProperty('hint');
    }
  });

  it('T-17/T-46 clasifica el error real del pool antes de decidir incertidumbre en readCredential', async () => {
    await loadRepository();
    const ring = keyring(2);
    for (const [origin, expected] of [
      [Object.assign(new Error('rechazo sintético'), { code: '28P01' }), 'other'],
      [new Error('Query read timeout'), 'timeout'],
    ] as const) {
      const query = vi.fn(async (config: { text: string }) => {
        if (config.text.includes('worker_api.get_credential(')) return { rows: [credentialRow(ring, 'active', 1)] };
        throw origin;
      });
      const pool: Queryable = { query: query as Queryable['query'], on: vi.fn(), end: vi.fn(async () => {}) };
      const workerApi = createWorkerApi({ pool });
      if (expected === 'other') {
        const error = await rejection(readCredential(ctx, connectionId, { workerApi, keyring: ring }));
        expect(error).toBeInstanceOf(WorkerApiError);
        expect(error).toMatchObject({ code: 'unavailable', failureKind: 'other' });
      } else {
        const read = await readCredential(ctx, connectionId, { workerApi, keyring: ring });
        expect(read.token.reveal()).toBe(sample);
        expect(read.keyVersion).toBe(1);
        expect(read.rewrap).toEqual({ status: 'unconfirmed', reason: 'timeout' });
      }
      expect(query).toHaveBeenCalledTimes(2);
    }
  });

  it('H-E1-54 clasifica la pérdida de conexión y los timeouts sin code de pg y pg-pool', async () => {
    const cases = [
      ...['Connection terminated unexpectedly', 'Client has encountered a connection error and is not queryable']
        .map((message) => ({ origin: new Error(message), failureKind: 'transport' })),
      ...['timeout expired', 'timeout exceeded when trying to connect', 'Connection terminated due to connection timeout']
        .map((message) => ({ origin: new Error(message), failureKind: 'timeout' })),
      ...['EPIPE', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN']
        .map((code) => ({ origin: Object.assign(new Error('sintético'), { code }), failureKind: 'transport' })),
    ] as const;
    for (const { origin, failureKind } of cases) {
      const pool: Queryable = { query: async () => { throw origin; }, on: vi.fn(), end: vi.fn(async () => {}) };
      const error = await rejection(createWorkerApi({ pool }).call('get_credential', [actorId, companyId, connectionId]));
      expect(error, origin.message).toMatchObject({ code: 'unavailable', failureKind });
    }
    // Un mensaje de transporte con code de otra clase conserva la clasificación del code.
    const coded = Object.assign(new Error('Connection terminated unexpectedly'), { code: '28P01' });
    const pool: Queryable = { query: async () => { throw coded; }, on: vi.fn(), end: vi.fn(async () => {}) };
    expect(await rejection(createWorkerApi({ pool }).call('get_credential', [actorId, companyId, connectionId])))
      .toMatchObject({ code: 'unavailable', failureKind: 'other' });
  });

  it('H-E1-54 readCredential devuelve unconfirmed si el pool pierde la conexión durante rewrap', async () => {
    await loadRepository();
    const ring = keyring(2);
    for (const [message, reason] of [
      ['Connection terminated unexpectedly', 'transport'],
      ['timeout exceeded when trying to connect', 'timeout'],
    ] as const) {
      const query = vi.fn(async (config: { text: string }) => {
        if (config.text.includes('worker_api.get_credential(')) return { rows: [credentialRow(ring, 'active', 1)] };
        throw new Error(message);
      });
      const pool: Queryable = { query: query as Queryable['query'], on: vi.fn(), end: vi.fn(async () => {}) };
      const read = await readCredential(ctx, connectionId, { workerApi: createWorkerApi({ pool }), keyring: ring });
      expect(read.token.reveal()).toBe(sample);
      expect(read.keyVersion).toBe(1);
      expect(read.rewrap).toEqual({ status: 'unconfirmed', reason });
      expect(query).toHaveBeenCalledTimes(2);
    }
  });

  it('T-53 rechaza envelopes y filas no objeto en la frontera del cliente', async () => {
    for (const result of [null, {}, { rows: null }, { rows: {} }, { rows: [null] }, { rows: [[]] }]) {
      const pool: Queryable = { query: vi.fn(async () => result as never), on: vi.fn(), end: vi.fn(async () => {}) };
      const error = await rejection(createWorkerApi({ pool }).call('get_credential', [actorId, companyId, connectionId]));
      expect(error).toBeInstanceOf(WorkerApiError);
      expectRedacted(error, 'unexpected', 'Respuesta de base de datos inválida.');
      expect(pool.query).toHaveBeenCalledTimes(1);
    }
  });

  it('T-53 valida respuestas create/replace/rewrap y conteos con errores redactados', async () => {
    const ring = keyring(2);
    const create = preparePendingConnectionWithCredential(ctx, { ...writeInput, clientBusinessId: 'business_sintetico' }, { keyring: ring });
    const replace = prepareReplaceCredential(ctx, { ...writeInput, connectionId, attemptId }, { keyring: ring });
    for (const operation of [create, replace]) {
      const variations: ((base: Record<string, unknown>) => unknown[])[] = [
        () => [], (base) => [base, base], () => [null],
        (base) => [{ ...base, connection_id: otherConnectionId }],
        (base) => [{ ...base, status: 'otro' }],
        (base) => [{ ...base, credential_generation: -1 }],
        (base) => [{ ...base, extra: 'marca-sintetica-confidencial' }],
      ];
      if (operation === create) variations.push((base) => [{ ...base, pending_expires_at: new Date(NaN) }]);
      for (const vary of variations) {
        const workerApi = api(async (_fn, args) => {
          const base = operation === create
            ? { connection_id: args[2], status: 'pending_selection', pending_expires_at: new Date(), credential_generation: 1 }
            : { connection_id: args[2], status: 'active', credential_generation: 2 };
          return vary(base);
        });
        const error = await rejection(executePreparedCredentialOperation(ctx, operation, { workerApi }));
        expect(error).toBeInstanceOf(CredentialRepositoryError);
        expectRedacted(error, 'invalid_response', 'Respuesta de credenciales inválida.');
      }
    }
    const old = credentialRow(ring, 'active', 1);
    for (const rows of [[], [null], [{ connection_id: otherConnectionId, key_version: 2 }],
      [{ connection_id: connectionId, key_version: 1 }], [{ connection_id: connectionId, key_version: 2, extra: true }]]) {
      const workerApi = api(async (fn) => fn === 'get_credential' ? [old] : rows);
      const error = await rejection(readCredential(ctx, connectionId, { workerApi, keyring: ring }));
      expect(error).toBeInstanceOf(CredentialRepositoryError);
      expectRedacted(error, 'invalid_response', 'Respuesta de credenciales inválida.');
    }
    for (const rows of [[null], [{ key_version: 0, credential_count: '1' }],
      [{ key_version: 1, credential_count: '-1' }], [{ key_version: 1, credential_count: '9007199254740992' }],
      [{ key_version: 1, credential_count: '1', extra: true }],
      [{ key_version: 1, credential_count: '1' }, { key_version: 1, credential_count: '2' }]]) {
      const error = await rejection(countCredentialsByKeyVersion({ workerApi: api(async () => rows) }));
      expect(error).toBeInstanceOf(WorkerApiError);
      expectRedacted(error, 'unexpected', 'Respuesta de base de datos inválida.');
    }
  });

  it('T-47/T-49 rechaza overrides de identidad y TLS antes de construir Pool', () => {
    const forbidden = [
      'user=x', 'host=x', 'port=5432', 'user=', 'host=', 'port=',
      'user=x&user=y', '%75ser=x', '%68ost=x', '%70ort=5432',
      'sslmode=disable', 'sslcert=', 'sslkey=x', 'sslrootcert=x',
      'ssl=', 'sslnegotiation=direct', 'uselibpqcompat=true', '%73slmode=disable',
    ];
    pgState.constructed.length = 0;
    for (const query of forbidden) {
      const url = `${roleUrl}?${query}`;
      let error: unknown;
      try { createWorkerApi({ connectionString: url }); } catch (caught) { error = caught; }
      expect(error).toBeInstanceOf(WorkerApiError);
      expect((error as InstanceType<typeof WorkerApiError>).code).toBe('config_invalid');
      expect((error as InstanceType<typeof WorkerApiError>).failureKind).toBe('other');
      expect(JSON.stringify(error)).not.toContain(url);
      expect(error).not.toHaveProperty('cause');
    }
    expect(pgState.constructed).toHaveLength(0);
  });

  it('rechaza parámetros de sesión de pg antes de construir Pool', () => {
    const forbidden = [
      'options=-c%20statement_timeout%3D1', 'statement_timeout=1', '%6Fptions=-c%20search_path%3Dpublic',
      'lock_timeout=1', 'idle_in_transaction_session_timeout=1', 'replication=database',
      'client_encoding=LATIN1', 'application_name=otro', 'fallback_application_name=otro',
      'query_timeout=1', 'options=', 'options=x&options=y', 'unknown=1',
    ];
    pgState.constructed.length = 0;
    for (const query of forbidden) {
      const url = `${roleUrl}?${query}`;
      let error: unknown;
      try { createWorkerApi({ connectionString: url }); } catch (caught) { error = caught; }
      expect(error).toBeInstanceOf(WorkerApiError);
      expect((error as InstanceType<typeof WorkerApiError>).code).toBe('config_invalid');
      expect(JSON.stringify(error)).not.toContain(url);
    }
    expect(pgState.constructed).toHaveLength(0);
  });

  it('T-49 rechaza endpoint que no sea shared transaction pooler 6543', () => {
    const bad = [
      roleUrl.replace(':6543/', ':5432/'), roleUrl.replace(':6543/', '/'),
      roleUrl.replace('aws-0-us-west-2.pooler.supabase.com', 'db.example.com'),
      roleUrl.replace('aws-0-us-west-2.pooler.supabase.com', 'aws-0-us-west-2.pooler.supabase.com.evil.test'),
      roleUrl.replace('aws-0-us-west-2.pooler.supabase.com', '127.0.0.1'),
      roleUrl.replace('aws-0-us-west-2.pooler.supabase.com', '%2Fvar%2Frun%2Fpostgresql'),
      roleUrl.replace('praxa_integrations.', 'postgres.'),
      // Q-04 de qa-review-4: puerto no canónico, aunque new URL() lo normalice a 6543.
      roleUrl.replace(':6543/', ':06543/'),
      // Q-02/Q-C26-c de qa-review-4: usuario codificado combinado con un espacio o un
      // `%` no hexadecimal en otra parte dispara la re-codificación de pg-connection-string,
      // que deja el usuario efectivo de pg distinto del validado por esta guarda.
      roleUrl.replace('praxa_integrations.', 'praxa%5Fintegrations.').replace(':clave@', ':cla ve@'),
      `${roleUrl.replace('praxa_integrations.', 'praxa%5Fintegrations.')}%zz`,
      `${roleUrl.replace('praxa_integrations.', 'praxa%5Fintegrations.')}?application_name=a%zz`,
      // Q-01/H-E1-48 de qa-review-6: el `%` ambiguo cae en el último o penúltimo
      // carácter de toda la cadena, donde no hay carácter siguiente que inspeccionar.
      `${roleUrl}%`,
      `${roleUrl}%4`,
    ];
    pgState.constructed.length = 0;
    for (const url of bad) expect(() => createWorkerApi({ connectionString: url })).toThrow(WorkerApiError);
    expect(pgState.constructed).toHaveLength(0);
    for (const host of ['aws-0-us-west-2.pooler.supabase.com', 'eu-1.pooler.supabase.com']) {
      const url = roleUrl.replace('aws-0-us-west-2.pooler.supabase.com', host);
      createWorkerApi({ connectionString: url });
      const effective = new ConnectionParameters(pgState.constructed.at(-1) as Record<string, unknown>);
      expect([effective.user, effective.host, effective.port]).toEqual([`praxa_integrations.${testRef}`, host, 6543]);
    }
  });

  it('T-48/T-50 versiona la CA y fija TLS y negociación postgres', async () => {
    const certificate = new X509Certificate(SUPABASE_ROOT_CA);
    expect(certificate.fingerprint256).toBe('80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA');
    vi.stubEnv('PGSSLNEGOTIATION', 'direct');
    try {
      pgState.constructed.length = 0;
      const client = createWorkerApi({ connectionString: roleUrl });
      expect(pgState.constructed).toHaveLength(1);
      const options = pgState.constructed[0] as Record<string, unknown>;
      expect(options).toMatchObject({
        max: 3, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000,
        query_timeout: 15_000, application_name: 'praxa-worker-api', allowExitOnIdle: true,
        sslnegotiation: 'postgres', ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true },
      });
      expect(options.ssl).not.toHaveProperty('checkServerIdentity');
      const effective = new ConnectionParameters(options);
      expect(effective.sslnegotiation).toBe('postgres');
      expect(effective.ssl).toMatchObject({ ca: SUPABASE_ROOT_CA, rejectUnauthorized: true });
      expect([effective.user, effective.host, effective.port]).toEqual([
        `praxa_integrations.${testRef}`, 'aws-0-us-west-2.pooler.supabase.com', 6543,
      ]);
      expect(pgState.listeners).toContainEqual(['error', expect.any(Function)]);
      await client.end();
    } finally { vi.unstubAllEnvs(); }
  });

  it('H-E1-61 el manejador del pool inactivo registra un mensaje fijo sin el error original', async () => {
    pgState.listeners.length = 0;
    const client = createWorkerApi({ connectionString: roleUrl });
    const entry = pgState.listeners.find((item) => Array.isArray(item) && item[0] === 'error');
    const [, listener] = entry as [string, (error: Error) => void];
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      listener(Object.assign(new Error('marca-sintetica-confidencial'), { host: 'host-secreto', code: 'ECONNRESET' }));
      expect(errorLog).toHaveBeenCalledTimes(1);
      const [message, ...rest] = errorLog.mock.calls[0] as unknown[];
      expect(rest).toEqual([]);
      expect(message).not.toContain('marca-sintetica-confidencial');
      expect(message).not.toContain('host-secreto');
      expect(message).not.toContain(roleUrl);
    } finally { errorLog.mockRestore(); await client.end(); }
  });
});

describe('M06.3a paso 4 RED: configuración obligatoria de la suite real', () => {
  const root = resolve(process.cwd());
  const suitePath = join(root, 'tests/app/integrations-worker-api-client.test.ts');

  /**
   * El arnés intercepta `pg` con un alias de `resolve.alias` de Vitest a un stub
   * temporal, no con `vi.mock('pg', …)`: Q-01 de `qa-review-4` mostró que ese mock,
   * registrado en un setup aparte, no intercepta el `pg` real de la suite (probablemente
   * por el alias de `vitest` a `dist/index.js` o la externalización de `pg`), así que la
   * aserción de contadores daba siempre cero sin probar nada. El alias sí intercepta.
   */
  async function runHarness(options: { missingRoleUrl?: boolean; healthOk?: boolean; extraEnv?: Record<string, string> }) {
    const temporary = mkdtempSync(join(tmpdir(), 'praxa-m063a-negative-'));
    const configPath = join(temporary, 'vitest.config.mts');
    const setupPath = join(temporary, 'setup.mts');
    const stubPath = join(temporary, 'pg-stub.mjs').replaceAll('\\', '/');
    try {
      writeFileSync(stubPath, [
        "const counters = (globalThis.__praxaPgStub ??= { pool: 0, client: 0 });",
        "class Pool { constructor() { counters.pool++; throw new Error('red bloqueada'); } on() {} }",
        "class Client { constructor() { counters.client++; throw new Error('red bloqueada'); } }",
        "export default { Pool, Client };",
        "",
      ].join('\n'), 'utf8');
      writeFileSync(configPath, `export default {
        root: ${JSON.stringify(root)}, envDir: false,
        resolve: { alias: { '@': ${JSON.stringify(join(root, 'src'))}, vitest: ${JSON.stringify(join(root, 'node_modules/vitest/dist/index.js'))} } },
        test: { projects: [{
          resolve: { alias: { '@': ${JSON.stringify(join(root, 'src'))}, vitest: ${JSON.stringify(join(root, 'node_modules/vitest/dist/index.js'))}, pg: ${JSON.stringify(stubPath)} } },
          test: { name: 'app', include: [${JSON.stringify(suitePath.replaceAll('\\', '/'))}], environment: 'node', setupFiles: [${JSON.stringify(setupPath)}], fileParallelism: false }
        }] }
      };`, 'utf8');
      writeFileSync(setupPath, `import { afterAll } from 'vitest';
        ${options.missingRoleUrl ? "delete process.env.PRAXA_INTEGRATIONS_TEST_DB_URL;" : ''}
        const counters = (globalThis.__praxaPgStub ??= { pool: 0, client: 0 });
        let fetchCount = 0;
        globalThis.fetch = async () => {
          fetchCount++;
          ${options.healthOk ? "return new Response('{}', { status: 200 });" : "throw new Error('red bloqueada');"}
        };
        afterAll(() => console.log('HARNESS_STATE ' + JSON.stringify({
          missing: !Object.hasOwn(process.env, 'PRAXA_INTEGRATIONS_TEST_DB_URL'),
          pool: counters.pool, client: counters.client, fetch: fetchCount,
        })));
      `, 'utf8');
      const base = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(PRAXA|SUPABASE|NEXT_PUBLIC_SUPABASE|PG)/i.test(name))) as NodeJS.ProcessEnv;
      const env = { ...base, ...options.extraEnv } as NodeJS.ProcessEnv;
      return await new Promise<{ code: number | null; report: string; timeout: boolean }>((done, reject) => {
        const child = spawn(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', configPath, '--project', 'app', suitePath], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
        let report = '';
        let timeout = false;
        const timer = setTimeout(() => { timeout = true; child.kill(); }, 110_000);
        child.stdout.on('data', (chunk: Buffer) => { report += chunk.toString(); });
        child.stderr.on('data', (chunk: Buffer) => { report += chunk.toString(); });
        child.on('error', reject);
        child.on('close', (code) => { clearTimeout(timer); done({ code, report, timeout }); });
      });
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }

  it('T-37 falla por URL de rol ausente antes de Pool, Client, conexión, fetch o fixtures', async () => {
    const { code, report, timeout } = await runHarness({
      missingRoleUrl: true,
      healthOk: false,
      extraEnv: { PRAXA_INTEGRATIONS_DB_URL: roleUrl },
    });
    expect(timeout).toBe(false);
    expect(code).not.toBe(0);
    expect(report).toMatch(/Test Files\s+1 failed/);
    expect(report).toContain('Falta PRAXA_INTEGRATIONS_TEST_DB_URL');
    expect(report).toContain('HARNESS_STATE {"missing":true,"pool":0,"client":0,"fetch":0}');
    expect(report).not.toMatch(/Test Files\s+1 skipped/);
  }, 120_000);

  it('T-37 control positivo: el alias de pg del arnés intercepta y registra la construcción del Pool (Q-01 de qa-review-4)', async () => {
    const positiveRef = 'c'.repeat(20);
    const appRef = 'd'.repeat(20);
    const extraEnv = {
      NEXT_PUBLIC_SUPABASE_URL: `https://${appRef}.supabase.co`,
      SUPABASE_DB_URL: `postgresql://postgres.${appRef}:secreta@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
      SUPABASE_TEST_URL: `https://${positiveRef}.supabase.co`,
      SUPABASE_TEST_DB_URL: `postgresql://postgres.${positiveRef}:secreta@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
      SUPABASE_TEST_IS_DISPOSABLE: 'yes-this-project-is-disposable',
      SUPABASE_TEST_PUBLISHABLE_KEY: 'sintetica',
      SUPABASE_TEST_SECRET_KEY: 'sintetica',
      PRAXA_INTEGRATIONS_TEST_DB_URL: `postgresql://praxa_integrations.${positiveRef}:clave@aws-0-us-west-2.pooler.supabase.com:6543/postgres`,
    };
    const { report, timeout } = await runHarness({ healthOk: true, extraEnv });
    expect(timeout).toBe(false);
    expect(/ENOTFOUND|getaddrinfo/.test(report)).toBe(false);
    const state = JSON.parse(report.match(/HARNESS_STATE (\{.*\})/)?.[1] ?? '{}');
    expect(state.pool).toBeGreaterThan(0);
  }, 120_000);
});
