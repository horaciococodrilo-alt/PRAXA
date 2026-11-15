import 'server-only';

import { z } from 'zod';

import { PG_INT4_MAX, uuidSchema } from '@/modules/integrations/contract/primitives';
import { tenantContextSchema, type TenantContext } from '@/modules/tenant/context';
import { getWorkerApi, type WorkerApi } from '../db/worker-api';
import type { TiendanubeErrorKind } from './errors';
import type { ProjectedLine, ProjectedOrder, ProjectedProduct, ProjectedStore } from './projection';

/**
 * Llamadas a `worker_api` de Tiendanube (`0023`). Cada respuesta se valida con su forma
 * exacta; los JSONB viajan serializados (node-pg convertiría un arreglo en un arreglo de
 * Postgres). La base revalida cada elemento.
 */

type Deps = { workerApi?: WorkerApi };

export class TiendanubeRepositoryError extends Error {
  constructor() { super('Respuesta de Tiendanube en la base inválida.'); this.name = 'TiendanubeRepositoryError'; }
}

function api(deps: Deps): WorkerApi { return deps.workerApi ?? getWorkerApi(); }

function actor(ctx: TenantContext): TenantContext {
  const parsed = tenantContextSchema.safeParse(ctx);
  if (!parsed.success) throw new TiendanubeRepositoryError();
  return parsed.data;
}

function one<T extends z.ZodTypeAny>(schema: T, rows: unknown): z.infer<T> {
  if (!Array.isArray(rows) || rows.length !== 1) throw new TiendanubeRepositoryError();
  const parsed = schema.safeParse(rows[0]);
  if (!parsed.success) throw new TiendanubeRepositoryError();
  return parsed.data;
}

const date = z.instanceof(Date).refine((value) => Number.isFinite(value.getTime()));
const dateOrNull = date.nullable();
const counter = z.number().int().min(0).max(PG_INT4_MAX);
const phase = z.enum(['backfill', 'incremental']);
/** `date` de Postgres llega como `Date` a medianoche local del proceso o como texto. */
const sqlDate = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), date]).nullable();

function isoDay(value: string | Date | null): string | null {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type Ownership = Readonly<{ connectionId: string; expectedGeneration: number; runId: string; leaseToken: string }>;

function ownershipArgs(ctx: TenantContext, o: Ownership) {
  const a = actor(ctx);
  if (!uuidSchema.safeParse(o.connectionId).success || !uuidSchema.safeParse(o.runId).success ||
      !uuidSchema.safeParse(o.leaseToken).success || !Number.isInteger(o.expectedGeneration) ||
      o.expectedGeneration < 0 || o.expectedGeneration > PG_INT4_MAX) throw new TiendanubeRepositoryError();
  return [a.user_id, a.company_id, o.connectionId, o.expectedGeneration, o.runId, o.leaseToken] as const;
}

export type StartedRun = Readonly<{
  runId: string;
  phase: 'backfill' | 'incremental';
  startedAt: Date;
  leaseExpiresAt: Date;
  watermark: Date | null;
  backfillNext: string | null;
  incrementalFrom: Date | null;
  catalogNextPage: number | null;
}>;

const startRow = z.strictObject({
  run_id: uuidSchema, phase, started_at: date, lease_expires_at: date, watermark: dateOrNull,
  backfill_next: sqlDate, incremental_from: dateOrNull, catalog_next_page: z.number().int().min(2).nullable(),
});

export async function startSync(ctx: TenantContext, input: Ownership & { leaseExpiresAt: Date }, deps: Deps = {}):
Promise<StartedRun> {
  const args = ownershipArgs(ctx, input);
  const row = one(startRow, await api(deps).call('tn_start_sync', [...args, input.leaseExpiresAt.toISOString()]));
  if (row.run_id !== input.runId) throw new TiendanubeRepositoryError();
  return {
    runId: row.run_id, phase: row.phase, startedAt: row.started_at, leaseExpiresAt: row.lease_expires_at,
    watermark: row.watermark, backfillNext: isoDay(row.backfill_next), incrementalFrom: row.incremental_from,
    catalogNextPage: row.catalog_next_page,
  };
}

export type OrdersWindow =
  | Readonly<{ kind: 'backfill'; window_from: string; window_to: string; last_page: boolean }>
  | Readonly<{ kind: 'incremental'; last_page: boolean }>;

const publishOrdersRow = z.strictObject({ orders_written: counter, orders_suppressed: counter, backfill_next: sqlDate });

export async function publishOrders(ctx: TenantContext, input: Ownership & {
  window: OrdersWindow; orders: readonly ProjectedOrder[]; lines: readonly ProjectedLine[];
}, deps: Deps = {}): Promise<{ written: number; suppressed: number; backfillNext: string | null }> {
  const args = ownershipArgs(ctx, input);
  const row = one(publishOrdersRow, await api(deps).call('tn_publish_orders', [...args,
    JSON.stringify(input.window), JSON.stringify(input.orders), JSON.stringify(input.lines)]));
  return { written: row.orders_written, suppressed: row.orders_suppressed, backfillNext: isoDay(row.backfill_next) };
}

const publishCatalogRow = z.strictObject({ products_written: counter, products_deleted: counter,
  catalog_next_page: z.number().int().min(2).nullable() });

export async function publishCatalog(ctx: TenantContext, input: Ownership & {
  products: readonly ProjectedProduct[]; nextPage: number | null; store: ProjectedStore; complete: boolean;
}, deps: Deps = {}): Promise<{ written: number; deleted: number; nextPage: number | null }> {
  const args = ownershipArgs(ctx, input);
  const row = one(publishCatalogRow, await api(deps).call('tn_publish_catalog', [...args,
    JSON.stringify(input.products), JSON.stringify({ next_page: input.nextPage, store: input.store }), input.complete]));
  return { written: row.products_written, deleted: row.products_deleted, nextPage: row.catalog_next_page };
}

const finishRow = z.strictObject({ phase, coverage_until: dateOrNull, run_status: z.enum(['complete', 'incomplete']) });

export async function finishSync(ctx: TenantContext, input: Ownership & { fetchedAt: Date; complete: boolean },
  deps: Deps = {}): Promise<{ phase: 'backfill' | 'incremental'; coverageUntil: Date | null; status: 'complete' | 'incomplete' }> {
  const args = ownershipArgs(ctx, input);
  const row = one(finishRow, await api(deps).call('tn_finish_sync', [...args, input.fetchedAt.toISOString(),
    input.complete]));
  return { phase: row.phase, coverageUntil: row.coverage_until, status: row.run_status };
}

const failRow = z.strictObject({
  connection_status: z.enum(['active', 'needs_reauth', 'pending_selection', 'disconnected']),
  run_status: z.literal('failed'),
});

export async function failSync(ctx: TenantContext, input: Ownership & {
  kind: TiendanubeErrorKind; errorClass: string;
}, deps: Deps = {}): Promise<{ connectionStatus: z.infer<typeof failRow>['connection_status'] }> {
  const args = ownershipArgs(ctx, input);
  const row = one(failRow, await api(deps).call('tn_fail_sync', [...args, input.kind, input.errorClass]));
  return { connectionStatus: row.connection_status };
}

// ---------------------------------------------------------------------------
// Privacidad sin sesión (D-M16e-14): sin actor; solo la fase como resultado.
// ---------------------------------------------------------------------------

const STORE_ID = /^[1-9][0-9]{0,19}$/;
const storeRedactRow = z.strictObject({ tn_privacy_store_redact: z.enum(['marked', 'more', 'done']) });
const customerRedactRow = z.strictObject({ tn_privacy_customer_redact: z.enum(['marked', 'done']) });

export async function privacyStoreRedact(storeId: string, maxRows: number, deps: Deps = {}):
Promise<'marked' | 'more' | 'done'> {
  if (!STORE_ID.test(storeId) || !Number.isInteger(maxRows) || maxRows < 1 || maxRows > 100_000) {
    throw new TiendanubeRepositoryError();
  }
  return one(storeRedactRow, await api(deps).call('tn_privacy_store_redact', [storeId, maxRows])).tn_privacy_store_redact;
}

export async function privacyCustomerRedact(storeId: string, customerId: string, orderIds: readonly string[],
  deps: Deps = {}): Promise<'marked' | 'done'> {
  if (!STORE_ID.test(storeId) || !STORE_ID.test(customerId) || orderIds.length > 10_000 ||
      orderIds.some((id) => !STORE_ID.test(id))) throw new TiendanubeRepositoryError();
  return one(customerRedactRow, await api(deps).call('tn_privacy_customer_redact',
    [storeId, customerId, [...orderIds]])).tn_privacy_customer_redact;
}
