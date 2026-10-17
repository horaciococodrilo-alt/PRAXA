import 'server-only';

import { currencyCodeSchema, externalAccountIdSchema, timeZoneSchema } from '@/modules/integrations/contract';
import { PG_INT4_MAX, reauthErrorClassSchema, redactedErrorMessageSchema, uuidSchema } from
  '@/modules/integrations/contract/primitives';
import { tenantContextSchema, type TenantContext } from '@/modules/tenant/context';
import { getWorkerApi, type WorkerApi } from '../db/worker-api';

type Deps = { workerApi?: WorkerApi };
type Row = Record<string, unknown>;

class LifecycleResponseError extends Error {
  constructor() { super('Respuesta de ciclo de vida inválida.'); this.name = 'LifecycleResponseError'; }
}

function actor(ctx: TenantContext): TenantContext {
  const parsed = tenantContextSchema.safeParse(ctx);
  if (!parsed.success) throw new LifecycleResponseError();
  return parsed.data;
}

function id(value: string): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) throw new LifecycleResponseError();
  return parsed.data;
}

function exact(value: unknown, keys: readonly string[]): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length ||
      Object.keys(value).some((key) => !keys.includes(key))) throw new LifecycleResponseError();
  return value as Row;
}

function one(rows: unknown, keys: readonly string[]): Row {
  if (!Array.isArray(rows) || rows.length !== 1) throw new LifecycleResponseError();
  return exact(rows[0], keys);
}

function generation(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > PG_INT4_MAX) {
    throw new LifecycleResponseError();
  }
  return value as number;
}

function dateOrNull(value: unknown): boolean {
  return value === null || (value instanceof Date && Number.isFinite(value.getTime()));
}

function api(deps: Deps): WorkerApi { return deps.workerApi ?? getWorkerApi(); }

export async function confirmConnection(ctx: TenantContext, input: {
  connectionId: string; externalAccountId: string; currency: string; timezone: string
}, deps: Deps = {}): Promise<{ connectionId: string; status: 'active'; credentialGeneration: number }> {
  const a = actor(ctx);
  const connectionId = id(input.connectionId);
  if (!externalAccountIdSchema.safeParse(input.externalAccountId).success ||
      !currencyCodeSchema.safeParse(input.currency).success || !timeZoneSchema.safeParse(input.timezone).success) {
    throw new LifecycleResponseError();
  }
  const row = one(await api(deps).call('confirm_connection', [a.user_id, a.company_id, connectionId,
    input.externalAccountId, input.currency, input.timezone, true]),
  ['connection_id', 'status', 'credential_generation']);
  if (row.connection_id !== connectionId || row.status !== 'active') throw new LifecycleResponseError();
  return { connectionId, status: 'active', credentialGeneration: generation(row.credential_generation) };
}

export async function markNeedsReauth(ctx: TenantContext, input: {
  connectionId: string; expectedGeneration: number; errorClass: string; message: string
}, deps: Deps = {}): Promise<{ connectionId: string; status: 'needs_reauth'; credentialGeneration: number }> {
  const a = actor(ctx);
  const connectionId = id(input.connectionId);
  if (!Number.isInteger(input.expectedGeneration) || input.expectedGeneration < 0 ||
      input.expectedGeneration > PG_INT4_MAX || !reauthErrorClassSchema.safeParse(input.errorClass).success ||
      !redactedErrorMessageSchema.safeParse(input.message).success) throw new LifecycleResponseError();
  const row = one(await api(deps).call('mark_needs_reauth', [a.user_id, a.company_id, connectionId,
    input.expectedGeneration, input.errorClass, input.message]),
  ['connection_id', 'status', 'credential_generation']);
  if (row.connection_id !== connectionId || row.status !== 'needs_reauth') throw new LifecycleResponseError();
  return { connectionId, status: 'needs_reauth', credentialGeneration: generation(row.credential_generation) };
}

export async function beginDisconnect(ctx: TenantContext, connectionId: string, deps: Deps = {}):
Promise<{ connectionId: string; credentialGeneration: number }> {
  const a = actor(ctx); const requested = id(connectionId);
  const row = one(await api(deps).call('begin_disconnect', [a.user_id, a.company_id, requested]),
    ['connection_id', 'status', 'credential_generation', 'purge_requested_at']);
  if (row.connection_id !== requested || row.status !== 'disconnected' || !dateOrNull(row.purge_requested_at) ||
      row.purge_requested_at === null) throw new LifecycleResponseError();
  return { connectionId: requested, credentialGeneration: generation(row.credential_generation) };
}

export async function purgeConnection(ctx: TenantContext, connectionId: string, deps: Deps = {}): Promise<boolean> {
  const a = actor(ctx); const requested = id(connectionId);
  const row = one(await api(deps).call('purge_connection', [a.user_id, a.company_id, requested]), ['purge_connection']);
  if (typeof row.purge_connection !== 'boolean') throw new LifecycleResponseError();
  return row.purge_connection;
}

export type PendingPurge = Readonly<{ connectionId: string; status: 'pending_selection' | 'disconnected';
  reason: 'pending_expired' | 'disconnect_requested'; hasCredential: boolean }>;

export async function listPendingPurges(ctx: TenantContext, deps: Deps = {}): Promise<readonly PendingPurge[]> {
  const a = actor(ctx);
  const rows = await api(deps).call('list_pending_purges', [a.user_id, a.company_id]);
  if (!Array.isArray(rows)) throw new LifecycleResponseError();
  return rows.map((value) => {
    const row = exact(value, ['connection_id', 'status', 'reason', 'has_credential',
      'pending_expires_at', 'purge_requested_at']);
    const connectionId = id(row.connection_id as string);
    if (typeof row.has_credential !== 'boolean' || !dateOrNull(row.pending_expires_at) ||
        !dateOrNull(row.purge_requested_at) ||
        !(row.status === 'pending_selection' && row.reason === 'pending_expired' && row.pending_expires_at instanceof Date ||
          row.status === 'disconnected' && row.reason === 'disconnect_requested' && row.purge_requested_at instanceof Date)) {
      throw new LifecycleResponseError();
    }
    return { connectionId, status: row.status as PendingPurge['status'], reason: row.reason as PendingPurge['reason'],
      hasCredential: row.has_credential };
  });
}
