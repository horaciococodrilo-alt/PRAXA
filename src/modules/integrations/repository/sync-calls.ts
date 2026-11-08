import 'server-only';

import { z } from 'zod';

import { PG_INT4_MAX, integrationErrorClassSchema, isoDateTimeSchema, redactedErrorMessageSchema, uuidSchema } from
  '@/modules/integrations/contract/primitives';
import { tenantContextSchema, type TenantContext } from '@/modules/tenant/context';
import { getWorkerApi, type WorkerApi } from '../db/worker-api';

type Deps = { workerApi?: WorkerApi };

/** Texto fijo: una entrada o una respuesta inválida no dice qué campo ni qué valor falló. */
export class SyncResponseError extends Error {
  constructor() { super('Respuesta de sincronización inválida.'); this.name = 'SyncResponseError'; }
}

const generationSchema = z.number().int().min(0).max(PG_INT4_MAX);
const counterSchema = z.number().int().min(0).max(PG_INT4_MAX);
const positiveSchema = z.number().int().min(1).max(PG_INT4_MAX);
const tokenSchema = z.string().regex(/^[0-9a-f]{64}$/);
const levelSchema = z.enum(['account', 'campaign', 'adset', 'ad']);
const generalErrorClassSchema = z.enum(['rate_limit', 'temporary', 'transport', 'own_error', 'unknown']);
const failureReasonSchema = z.enum(['page_limit', 'duration_limit', 'invalid_response', 'meta_error', 'own_error']);

export const syncLimitsSchema = z.strictObject({
  lookbackDays: positiveSchema, maxWindowDays: positiveSchema, maxPagesPerLevel: positiveSchema,
  maxMetadataPages: positiveSchema, maxEntities: positiveSchema, maxPayloadBytes: positiveSchema,
  maxDurationMs: positiveSchema, finalizationReserveMs: positiveSchema, leaseSeconds: positiveSchema,
  maxRetries: counterSchema, retryDelayMs: counterSchema,
});
export type SyncLimits = z.infer<typeof syncLimitsSchema>;

/** Solo el envoltorio: `publish_snapshot` y `fail_sync_run` revalidan cada elemento en SQL. */
const payloadSchema = z.strictObject({ entities: z.array(z.unknown()), days: z.array(z.unknown()) });

const ownershipSchema = z.strictObject({
  connectionId: uuidSchema, expectedGeneration: generationSchema, runId: uuidSchema, ownershipToken: tokenSchema,
});

const snapshotInputSchema = ownershipSchema.extend({
  snapshotId: uuidSchema, level: levelSchema, fetchedAt: isoDateTimeSchema, pages: counterSchema,
  durationMs: counterSchema, payload: payloadSchema,
});

const startInputSchema = ownershipSchema.extend({
  windowFrom: z.iso.date(), windowTo: z.iso.date(), limits: syncLimitsSchema,
});

const failInputSchema = snapshotInputSchema.extend({
  validatedPages: counterSchema, failureReason: failureReasonSchema, errorClass: integrationErrorClassSchema,
  errorMessage: redactedErrorMessageSchema, stopRemaining: z.boolean(),
});

const recordInputSchema = z.strictObject({
  connectionId: uuidSchema, expectedGeneration: generationSchema, errorClass: generalErrorClassSchema,
  message: redactedErrorMessageSchema,
});

const dateSchema = z.date().refine((value) => Number.isFinite(value.getTime()));

const startRowSchema = z.strictObject({
  run_id: uuidSchema, credential_generation: generationSchema, started_at: dateSchema, lease_expires_at: dateSchema,
});
const publishRowSchema = z.strictObject({ snapshot_id: uuidSchema, level: levelSchema, complete: z.literal(true) });
const failRowSchema = z.strictObject({
  run_id: uuidSchema, level: levelSchema, status: z.enum(['running', 'completed', 'partial', 'failed']),
  snapshot_result: z.enum(['incomplete', 'failed']),
});
const recordRowSchema = z.strictObject({
  connection_id: uuidSchema, status: z.literal('active'), credential_generation: generationSchema,
});

function parsed<Schema extends z.ZodType>(schema: Schema, value: unknown): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) throw new SyncResponseError();
  return result.data;
}

function one<Schema extends z.ZodType>(schema: Schema, rows: unknown): z.output<Schema> {
  if (!Array.isArray(rows) || rows.length !== 1) throw new SyncResponseError();
  return parsed(schema, rows[0]);
}

function api(deps: Deps): WorkerApi { return deps.workerApi ?? getWorkerApi(); }

export type StartSyncRunInput = z.input<typeof startInputSchema>;
export type PublishSnapshotInput = z.input<typeof snapshotInputSchema>;
export type FailSyncRunInput = z.input<typeof failInputSchema>;
export type SyncLevel = z.infer<typeof levelSchema>;
export type SyncFailureReason = z.infer<typeof failureReasonSchema>;

export async function startSyncRun(ctx: TenantContext, input: StartSyncRunInput, deps: Deps = {}):
Promise<{ runId: string; credentialGeneration: number; startedAt: Date; leaseExpiresAt: Date }> {
  const a = parsed(tenantContextSchema, ctx);
  const i = parsed(startInputSchema, input);
  const row = one(startRowSchema, await api(deps).call('start_sync_run', [a.user_id, a.company_id, i.connectionId,
    i.expectedGeneration, i.runId, i.ownershipToken, i.windowFrom, i.windowTo, i.limits]));
  if (row.run_id !== i.runId || row.credential_generation !== i.expectedGeneration) throw new SyncResponseError();
  return { runId: row.run_id, credentialGeneration: row.credential_generation, startedAt: row.started_at,
    leaseExpiresAt: row.lease_expires_at };
}

export async function publishSnapshot(ctx: TenantContext, input: PublishSnapshotInput, deps: Deps = {}):
Promise<{ snapshotId: string; level: SyncLevel; complete: true }> {
  const a = parsed(tenantContextSchema, ctx);
  const i = parsed(snapshotInputSchema, input);
  const row = one(publishRowSchema, await api(deps).call('publish_snapshot', [a.user_id, a.company_id, i.connectionId,
    i.expectedGeneration, i.runId, i.ownershipToken, i.snapshotId, i.level, i.fetchedAt, i.pages, i.durationMs, i.payload]));
  if (row.snapshot_id !== i.snapshotId || row.level !== i.level) throw new SyncResponseError();
  return { snapshotId: row.snapshot_id, level: row.level, complete: row.complete };
}

export async function failSyncRun(ctx: TenantContext, input: FailSyncRunInput, deps: Deps = {}):
Promise<{ runId: string; level: SyncLevel; status: z.infer<typeof failRowSchema>['status'];
  snapshotResult: z.infer<typeof failRowSchema>['snapshot_result'] }> {
  const a = parsed(tenantContextSchema, ctx);
  const i = parsed(failInputSchema, input);
  const row = one(failRowSchema, await api(deps).call('fail_sync_run', [a.user_id, a.company_id, i.connectionId,
    i.expectedGeneration, i.runId, i.ownershipToken, i.snapshotId, i.level, i.fetchedAt, i.pages, i.durationMs, i.payload,
    i.validatedPages, i.failureReason, i.errorClass, i.errorMessage, i.stopRemaining]));
  if (row.run_id !== i.runId || row.level !== i.level) throw new SyncResponseError();
  return { runId: row.run_id, level: row.level, status: row.status, snapshotResult: row.snapshot_result };
}

export async function recordConnectionError(ctx: TenantContext, input: {
  connectionId: string; expectedGeneration: number; errorClass: string; message: string
}, deps: Deps = {}): Promise<{ connectionId: string; status: 'active'; credentialGeneration: number }> {
  const a = parsed(tenantContextSchema, ctx);
  const i = parsed(recordInputSchema, input);
  const row = one(recordRowSchema, await api(deps).call('record_connection_error', [a.user_id, a.company_id,
    i.connectionId, i.expectedGeneration, i.errorClass, i.message]));
  if (row.connection_id !== i.connectionId || row.credential_generation !== i.expectedGeneration) throw new SyncResponseError();
  return { connectionId: row.connection_id, status: row.status, credentialGeneration: row.credential_generation };
}
