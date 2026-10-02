import 'server-only';

import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import {
  clientBusinessIdSchema,
  secretCredentialSchema,
  tokenTypeSchema,
  type SecretCredential,
  type TokenType,
} from '@/modules/integrations/contract';
import { isoDateTimeSchema, uuidSchema } from '@/modules/integrations/contract/primitives';
import type { TenantContext } from '@/modules/tenant/context';
import { getCredentialKeyring, type CredentialKeyring } from '../crypto/keyring';
import { openCredential, sealCredential, type SecretValue } from '../crypto/seal';
import { getWorkerApi, WorkerApiError, type WorkerApi } from '../db/worker-api';

export type CredentialWriteInput = {
  token: string;
  tokenType: TokenType;
  issuedForAppId: string;
  grantedScopes: readonly string[];
  expiresAt: string | null;
};
export type PendingCredentialInput = CredentialWriteInput & { clientBusinessId: string };
export type ReplaceCredentialInput = CredentialWriteInput & { connectionId: string; attemptId: string };
export type CredentialRepositoryDeps = { workerApi?: WorkerApi; keyring?: CredentialKeyring };
declare const preparedCredentialBrand: unique symbol;
export type PreparedCredentialOperation = Readonly<{ [preparedCredentialBrand]: true }>;

export type CredentialRewrapResult =
  | { status: 'not_attempted' }
  | { status: 'confirmed' }
  | { status: 'version_conflict' }
  | { status: 'unconfirmed'; reason: 'transport' | 'timeout' };

type RepositoryCode = 'invalid_input' | 'invalid_prepared_operation' | 'prepared_context_mismatch' | 'invalid_response';
const ERROR_MESSAGES: Record<RepositoryCode, string> = {
  invalid_input: 'Entrada de credenciales inválida.',
  invalid_prepared_operation: 'Operación de credenciales preparada inválida.',
  prepared_context_mismatch: 'La operación preparada no corresponde al contexto actual.',
  invalid_response: 'Respuesta de credenciales inválida.',
};

export class CredentialRepositoryError extends Error {
  readonly code: RepositoryCode;
  constructor(code: RepositoryCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'CredentialRepositoryError';
    this.code = code;
  }
}

export class CredentialNotFoundError extends Error {
  readonly code = 'credential_not_found';
  constructor() { super('Credencial no encontrada.'); this.name = 'CredentialNotFoundError'; }
}

export class CredentialChangedError extends Error {
  readonly code = 'credential_changed';
  constructor() { super('La credencial cambió; volvé a empezar.'); this.name = 'CredentialChangedError'; }
}

const contextSchema = z.strictObject({
  user_id: uuidSchema,
  company_id: uuidSchema,
  role: z.literal('owner'),
  request_id: uuidSchema,
});

const writeSchema = z.strictObject({
  token: z.string().min(1),
  tokenType: tokenTypeSchema,
  issuedForAppId: secretCredentialSchema.shape.issued_for_app_id,
  grantedScopes: secretCredentialSchema.shape.granted_scopes,
  expiresAt: isoDateTimeSchema.nullable(),
});
const pendingSchema = writeSchema.extend({ clientBusinessId: clientBusinessIdSchema });
const replaceSchema = writeSchema.extend({ connectionId: uuidSchema, attemptId: uuidSchema });
const MAX_VERSION = 2_147_483_647;
const READ_STATUSES = new Set(['pending_selection', 'active', 'needs_reauth', 'disconnected']);
const REWRAP_STATUSES = new Set(['pending_selection', 'active', 'needs_reauth']);

type PreparedPayload = Readonly<{
  actorId: string;
  companyId: string;
  kind: 'create' | 'replace';
  connectionId: string;
  args: readonly unknown[];
}>;
const prepared = new WeakMap<object, PreparedPayload>();

function invalidInput(): never { throw new CredentialRepositoryError('invalid_input'); }
function invalidResponse(): never { throw new CredentialRepositoryError('invalid_response'); }
function unexpectedResponse(): never { throw new WorkerApiError('unexpected', 'other', 'Respuesta de base de datos inválida.'); }

function context(input: TenantContext): TenantContext {
  const parsed = contextSchema.safeParse(input);
  if (!parsed.success) invalidInput();
  return parsed.data;
}

function connectionId(input: string): string {
  const parsed = uuidSchema.safeParse(input);
  if (!parsed.success) invalidInput();
  return parsed.data;
}

function validVersion(version: number): number {
  if (!Number.isInteger(version) || version < 1 || version > MAX_VERSION) invalidInput();
  return version;
}

function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key))) {
    invalidResponse();
  }
  return value as Record<string, unknown>;
}

function one(rows: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!Array.isArray(rows) || rows.length !== 1) invalidResponse();
  return record(rows[0], keys);
}

function generation(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > MAX_VERSION) invalidResponse();
  return value as number;
}

function status(value: unknown): string {
  if (typeof value !== 'string' || !READ_STATUSES.has(value)) invalidResponse();
  return value;
}

function dateIso(value: unknown): string | null {
  if (value === null) return null;
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) invalidResponse();
  return value.toISOString();
}

function wrapPrepared(payload: PreparedPayload): PreparedCredentialOperation {
  const operation = Object.freeze(Object.create(null)) as PreparedCredentialOperation;
  prepared.set(operation, Object.freeze({ ...payload, args: Object.freeze([...payload.args]) }));
  return operation;
}

function makeSealedArgs(ctx: TenantContext, id: string, input: CredentialWriteInput, ring: CredentialKeyring) {
  const sealed = sealCredential(input.token, { company_id: ctx.company_id, connection_id: id, provider: 'meta' }, ring);
  return [sealed.ciphertext, sealed.iv, sealed.auth_tag, sealed.key_version,
    input.tokenType, input.issuedForAppId, Object.freeze([...input.grantedScopes]), input.expiresAt] as const;
}

export function preparePendingConnectionWithCredential(
  ctx: TenantContext, input: PendingCredentialInput, deps: CredentialRepositoryDeps = {},
): PreparedCredentialOperation {
  const actor = context(ctx);
  const parsed = pendingSchema.safeParse(input);
  if (!parsed.success) invalidInput();
  const id = randomUUID();
  const ring = deps.keyring ?? getCredentialKeyring();
  const args = [actor.user_id, actor.company_id, id, parsed.data.clientBusinessId,
    ...makeSealedArgs(actor, id, parsed.data, ring)];
  return wrapPrepared({ actorId: actor.user_id, companyId: actor.company_id,
    kind: 'create', connectionId: id, args });
}

export function prepareReplaceCredential(
  ctx: TenantContext, input: ReplaceCredentialInput, deps: CredentialRepositoryDeps = {},
): PreparedCredentialOperation {
  const actor = context(ctx);
  const parsed = replaceSchema.safeParse(input);
  if (!parsed.success) invalidInput();
  const ring = deps.keyring ?? getCredentialKeyring();
  const args = [actor.user_id, actor.company_id, parsed.data.connectionId, parsed.data.attemptId,
    ...makeSealedArgs(actor, parsed.data.connectionId, parsed.data, ring)];
  return wrapPrepared({ actorId: actor.user_id, companyId: actor.company_id,
    kind: 'replace', connectionId: parsed.data.connectionId, args });
}

type Created = { connectionId: string; status: string; pendingExpiresAt: string; credentialGeneration: number };
type Replaced = { connectionId: string; status: string; credentialGeneration: number };

export async function executePreparedCredentialOperation(
  ctx: TenantContext, operation: PreparedCredentialOperation, deps: CredentialRepositoryDeps = {},
): Promise<Created | Replaced> {
  const actor = context(ctx);
  const payload = operation && typeof operation === 'object' ? prepared.get(operation) : undefined;
  if (!payload) throw new CredentialRepositoryError('invalid_prepared_operation');
  if (actor.user_id !== payload.actorId || actor.company_id !== payload.companyId) {
    throw new CredentialRepositoryError('prepared_context_mismatch');
  }
  const api = deps.workerApi ?? getWorkerApi();
  const rows = await api.call(payload.kind === 'create' ? 'create_pending_connection' : 'replace_credential', payload.args);
  const result = one(rows, payload.kind === 'create'
    ? ['connection_id', 'status', 'pending_expires_at', 'credential_generation']
    : ['connection_id', 'status', 'credential_generation']);
  if (result.connection_id !== payload.connectionId || !uuidSchema.safeParse(result.connection_id).success) invalidResponse();
  const resultStatus = status(result.status);
  const resultGeneration = generation(result.credential_generation);
  if (payload.kind === 'create') {
    if (resultStatus !== 'pending_selection') invalidResponse();
    const pendingExpiresAt = dateIso(result.pending_expires_at);
    if (pendingExpiresAt === null) invalidResponse();
    return { connectionId: payload.connectionId, status: resultStatus, pendingExpiresAt,
      credentialGeneration: resultGeneration };
  }
  return { connectionId: payload.connectionId, status: resultStatus, credentialGeneration: resultGeneration };
}

export async function createPendingConnectionWithCredential(
  ctx: TenantContext, input: PendingCredentialInput, deps: CredentialRepositoryDeps = {},
): Promise<Created> {
  const operation = preparePendingConnectionWithCredential(ctx, input, deps);
  return executePreparedCredentialOperation(ctx, operation, deps) as Promise<Created>;
}

export async function replaceCredential(
  ctx: TenantContext, input: ReplaceCredentialInput, deps: CredentialRepositoryDeps = {},
): Promise<Replaced> {
  const operation = prepareReplaceCredential(ctx, input, deps);
  return executePreparedCredentialOperation(ctx, operation, deps) as Promise<Replaced>;
}

const READ_COLUMNS = [
  'connection_id', 'company_id', 'provider', 'status', 'credential_generation',
  'ciphertext', 'iv', 'auth_tag', 'key_version', 'token_type',
  'issued_for_app_id', 'granted_scopes', 'expires_at',
] as const;
const CREDENTIAL_COLUMNS = [
  'connection_id', 'company_id', 'ciphertext', 'iv', 'auth_tag', 'key_version',
  'token_type', 'issued_for_app_id', 'granted_scopes', 'expires_at',
] as const;

export type ReadCredentialResult = {
  connectionId: string;
  status: string;
  credentialGeneration: number;
  keyVersion: number;
  tokenType: TokenType;
  issuedForAppId: string;
  grantedScopes: string[];
  expiresAt: string | null;
  token: SecretValue;
  rewrap: CredentialRewrapResult;
};

export async function readCredential(
  ctx: TenantContext, id: string, deps: CredentialRepositoryDeps = {},
): Promise<ReadCredentialResult> {
  const actor = context(ctx);
  const requestedId = connectionId(id);
  const api = deps.workerApi ?? getWorkerApi();
  const ring = deps.keyring ?? getCredentialKeyring();
  const rows = await api.call('get_credential', [actor.user_id, actor.company_id, requestedId]);
  if (!Array.isArray(rows)) invalidResponse();
  if (rows.length === 0) throw new CredentialNotFoundError();
  const row = one(rows, READ_COLUMNS);
  if (!uuidSchema.safeParse(row.connection_id).success || row.connection_id !== requestedId ||
      !uuidSchema.safeParse(row.company_id).success || row.company_id !== actor.company_id || row.provider !== 'meta') {
    invalidResponse();
  }
  const readStatus = status(row.status);
  const readGeneration = generation(row.credential_generation);
  const projected = Object.fromEntries(CREDENTIAL_COLUMNS.map((column) => [
    column, column === 'expires_at' ? dateIso(row[column]) : row[column],
  ])) as SecretCredential;
  const parsed = secretCredentialSchema.safeParse(projected);
  if (!parsed.success) invalidResponse();
  const token = openCredential(parsed.data, {
    company_id: actor.company_id, connection_id: requestedId, provider: 'meta',
  }, ring);

  let rewrap: CredentialRewrapResult = { status: 'not_attempted' };
  if (parsed.data.key_version < ring.currentVersion && REWRAP_STATUSES.has(readStatus)) {
    const sealed = sealCredential(token.reveal(), {
      company_id: actor.company_id, connection_id: requestedId, provider: 'meta',
    }, ring);
    let rewrapped: unknown;
    try {
      rewrapped = await api.call('rewrap_credential', [
        actor.user_id, actor.company_id, requestedId, readGeneration, parsed.data.key_version,
        sealed.ciphertext, sealed.iv, sealed.auth_tag, sealed.key_version,
      ]);
    } catch (error) {
      if (error instanceof WorkerApiError && error.code === 'generation_mismatch') throw new CredentialChangedError();
      if (error instanceof WorkerApiError && error.code === 'key_version_mismatch') {
        rewrap = { status: 'version_conflict' };
      } else if (error instanceof WorkerApiError && error.code === 'unavailable' &&
                 (error.failureKind === 'transport' || error.failureKind === 'timeout')) {
        rewrap = { status: 'unconfirmed', reason: error.failureKind };
      } else {
        throw error;
      }
    }
    if (rewrapped !== undefined) {
      const confirmation = one(rewrapped, ['connection_id', 'key_version']);
      if (confirmation.connection_id !== requestedId || confirmation.key_version !== sealed.key_version) invalidResponse();
      rewrap = { status: 'confirmed' };
    }
  }

  return {
    connectionId: requestedId, status: readStatus, credentialGeneration: readGeneration,
    keyVersion: parsed.data.key_version, tokenType: parsed.data.token_type,
    issuedForAppId: parsed.data.issued_for_app_id, grantedScopes: [...parsed.data.granted_scopes],
    expiresAt: parsed.data.expires_at, token, rewrap,
  };
}

export type CredentialVersionCount = { keyVersion: number; credentialCount: number };

export async function countCredentialsByKeyVersion(
  deps: CredentialRepositoryDeps = {},
): Promise<CredentialVersionCount[]> {
  const api = deps.workerApi ?? getWorkerApi();
  const rows = await api.call('count_credentials_by_key_version', []);
  if (!Array.isArray(rows)) unexpectedResponse();
  const seen = new Set<number>();
  return rows.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).length !== 2 || !Object.hasOwn(value, 'key_version') || !Object.hasOwn(value, 'credential_count')) {
      unexpectedResponse();
    }
    const row = value as Record<string, unknown>;
    const version = row.key_version;
    if (!Number.isInteger(version) || (version as number) < 1 || (version as number) > MAX_VERSION || seen.has(version as number)) {
      unexpectedResponse();
    }
    seen.add(version as number);
    const raw = row.credential_count;
    if (!(typeof raw === 'bigint' || (typeof raw === 'string' && /^\d+$/.test(raw)))) unexpectedResponse();
    const count = Number(raw);
    if (!Number.isSafeInteger(count) || count < 0) unexpectedResponse();
    return { keyVersion: version as number, credentialCount: count };
  });
}

export async function canRetireKeyVersion(version: number, deps: CredentialRepositoryDeps = {}): Promise<boolean> {
  const requested = validVersion(version);
  const counts = await countCredentialsByKeyVersion(deps);
  return !counts.some((row) => row.keyVersion === requested && row.credentialCount > 0);
}
