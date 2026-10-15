import 'server-only';

import {
  OAuthAttemptRejectedError,
  oauthPurposeSchema,
  returnPathSchema,
  sha256HexSchema,
  type OAuthPurpose,
  type ReturnPath,
} from '@/modules/integrations/contract';
import { PG_INT4_MAX, uuidSchema } from '@/modules/integrations/contract/primitives';
import { tenantContextSchema, type TenantContext } from '@/modules/tenant/context';
import { getWorkerApi, WorkerApiError, type WorkerApi } from '../db/worker-api';

/**
 * K02 sobre `worker_api`: crear y consumir un intento OAuth.
 *
 * La base recibe solo hashes. El consumo es una sola llamada que valida `state`, nonce,
 * actor, empresa, vigencia y no consumido en la misma sentencia (CA-03): acá no se lee el
 * intento antes de consumirlo. Cualquier rechazo es el mismo error, sin decir qué falló
 * (CA-29).
 */

export type CreatedAttempt = { attemptId: string; purpose: OAuthPurpose; expiresAt: string };
export type ConsumedAttempt = {
  attemptId: string;
  purpose: OAuthPurpose;
  expectedConnectionId: string | null;
  expectedGeneration: number | null;
  returnPath: ReturnPath;
};

export class LiveConnectionExistsError extends Error {
  constructor() {
    super('La empresa ya tiene una conexión con Meta.');
    this.name = 'LiveConnectionExistsError';
  }
}

export class AttemptRepositoryError extends Error {
  readonly code: 'invalid_input' | 'invalid_response';

  constructor(code: 'invalid_input' | 'invalid_response') {
    super(code === 'invalid_input' ? 'Entrada de intento OAuth inválida.' : 'Respuesta de intento OAuth inválida.');
    this.name = 'AttemptRepositoryError';
    this.code = code;
  }
}

function invalidInput(): never {
  throw new AttemptRepositoryError('invalid_input');
}

function invalidResponse(): never {
  throw new AttemptRepositoryError('invalid_response');
}

function context(input: TenantContext): TenantContext {
  const parsed = tenantContextSchema.safeParse(input);
  if (!parsed.success) invalidInput();
  return parsed.data;
}

/** Exactamente una fila, con exactamente estas columnas. */
function one(rows: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!Array.isArray(rows) || rows.length !== 1) invalidResponse();
  const row = rows[0] as unknown;
  if (!row || typeof row !== 'object' || Array.isArray(row)) invalidResponse();
  const own = Object.keys(row);
  if (own.length !== keys.length || !own.every((key) => keys.includes(key))) invalidResponse();
  return row as Record<string, unknown>;
}

/** Coherencia propósito / conexión esperada, como en K02. */
function expectation(row: Record<string, unknown>) {
  const purpose = oauthPurposeSchema.safeParse(row.purpose);
  if (!purpose.success) invalidResponse();
  if (purpose.data === 'initial') {
    if (row.expected_connection_id !== null || row.expected_generation !== null) invalidResponse();
    return { purpose: purpose.data, expectedConnectionId: null, expectedGeneration: null };
  }
  const connection = uuidSchema.safeParse(row.expected_connection_id);
  const generation = row.expected_generation;
  if (!connection.success || !Number.isInteger(generation) || (generation as number) < 0 || (generation as number) > PG_INT4_MAX) {
    invalidResponse();
  }
  return { purpose: purpose.data, expectedConnectionId: connection.data, expectedGeneration: generation as number };
}

function translated(error: unknown): unknown {
  if (error instanceof WorkerApiError) {
    if (error.code === 'attempt_rejected' || error.code === 'not_authorized') return new OAuthAttemptRejectedError();
    if (error.code === 'live_connection_exists') return new LiveConnectionExistsError();
  }
  return error;
}

export async function createOAuthAttempt(
  ctx: TenantContext,
  input: {
    purpose: OAuthPurpose;
    stateHash: string;
    bindingHash: string;
    returnPath: ReturnPath;
    expiresAt: Date;
    expectedConnectionId: string | null;
  },
  deps: { workerApi?: WorkerApi } = {},
): Promise<CreatedAttempt> {
  const actor = context(ctx);
  const purpose = oauthPurposeSchema.safeParse(input.purpose);
  const returnPath = returnPathSchema.safeParse(input.returnPath);
  if (!purpose.success || !returnPath.success) invalidInput();
  if (!sha256HexSchema.safeParse(input.stateHash).success || !sha256HexSchema.safeParse(input.bindingHash).success) {
    invalidInput();
  }
  if (!(input.expiresAt instanceof Date) || !Number.isFinite(input.expiresAt.getTime())) invalidInput();
  const expected =
    purpose.data === 'initial' ? input.expectedConnectionId === null : uuidSchema.safeParse(input.expectedConnectionId).success;
  if (!expected) invalidInput();

  const api = deps.workerApi ?? getWorkerApi();
  let rows: unknown;
  try {
    rows = await api.call('create_oauth_attempt', [
      actor.user_id,
      actor.company_id,
      purpose.data,
      input.stateHash,
      input.bindingHash,
      returnPath.data,
      input.expiresAt.toISOString(),
      input.expectedConnectionId,
    ]);
  } catch (error) {
    throw translated(error);
  }
  const row = one(rows, ['attempt_id', 'purpose', 'expected_connection_id', 'expected_generation', 'created_at', 'expires_at']);
  const attemptId = uuidSchema.safeParse(row.attempt_id);
  const shape = expectation(row);
  if (!attemptId.success || shape.purpose !== purpose.data || shape.expectedConnectionId !== input.expectedConnectionId) {
    invalidResponse();
  }
  if (!(row.expires_at instanceof Date) || !Number.isFinite(row.expires_at.getTime())) invalidResponse();
  return { attemptId: attemptId.data, purpose: shape.purpose, expiresAt: row.expires_at.toISOString() };
}

export async function consumeOAuthAttempt(
  ctx: TenantContext,
  input: { stateHash: string; bindingHash: string },
  deps: { workerApi?: WorkerApi } = {},
): Promise<ConsumedAttempt> {
  const actor = context(ctx);
  if (!sha256HexSchema.safeParse(input.stateHash).success || !sha256HexSchema.safeParse(input.bindingHash).success) {
    invalidInput();
  }
  const api = deps.workerApi ?? getWorkerApi();
  let rows: unknown;
  try {
    rows = await api.call('consume_oauth_attempt', [actor.user_id, actor.company_id, input.stateHash, input.bindingHash]);
  } catch (error) {
    throw translated(error);
  }
  const row = one(rows, ['attempt_id', 'purpose', 'expected_connection_id', 'expected_generation', 'return_path']);
  const attemptId = uuidSchema.safeParse(row.attempt_id);
  const returnPath = returnPathSchema.safeParse(row.return_path);
  if (!attemptId.success || !returnPath.success) invalidResponse();
  return { attemptId: attemptId.data, ...expectation(row), returnPath: returnPath.data };
}
