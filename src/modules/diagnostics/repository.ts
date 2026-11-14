import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { WorkerApi } from '@/modules/integrations/db/worker-api';
import type { TenantContext } from '@/modules/tenant/context';

import {
  accountMetricsRowSchema,
  attributionWindowSchema,
  actionTypeRowSchema,
  BREAKDOWN_DIMENSIONS,
  breakdownMetricsRowSchema,
  ELIGIBILITY_REASONS,
  eligibilitySchema,
  entityMetricsRowSchema,
  type AccountMetricsRow,
  type AttributionWindow,
  type ActionTypeRow,
  type BreakdownDimension,
  type BreakdownMetricsRow,
  type DiagnosticSettings,
  type DiagnosticWindow,
  type Eligibility,
  type EntityLevel,
  type EntityMetricsRow,
} from './contract';
import { DIAGNOSTIC_LIMITS } from './limits';

/**
 * Acceso a la base del diagnóstico. Las lecturas van por la Data API con el JWT del dueño y
 * bajo RLS (camino A); las escrituras, por `worker_api` con el rol acotado (camino C). Ningún
 * parámetro de empresa sale del navegador: la empresa es la de K01 y la conexión, la viva.
 */

export type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

export class DiagnosticReadError extends Error {
  constructor() {
    super('No se pudo leer el diagnóstico.');
    this.name = 'DiagnosticReadError';
  }
}

async function rows<T>(rpc: Rpc, fn: string, args: Record<string, unknown>, schema: z.ZodType<T>): Promise<T[]> {
  const { data, error } = await rpc(fn, args);
  // Error fijo, sin el mensaje de PostgREST.
  if (error || !Array.isArray(data)) throw new DiagnosticReadError();
  const parsed = z.array(schema).safeParse(data);
  if (!parsed.success) throw new DiagnosticReadError();
  return parsed.data;
}

export async function readEligibility(rpc: Rpc, connectionId: string): Promise<Eligibility> {
  const [row] = await rows(rpc, 'meta_diagnostic_eligibility', { p_connection_id: connectionId }, eligibilitySchema);
  if (!row) throw new DiagnosticReadError();
  return row;
}

export async function readActionTypes(rpc: Rpc, connectionId: string, window: DiagnosticWindow): Promise<ActionTypeRow[]> {
  return rows(rpc, 'meta_diagnostic_action_types',
    { p_connection_id: connectionId, p_from: window.from, p_to: window.to }, actionTypeRowSchema);
}

export async function readAccountMetrics(rpc: Rpc, args: { connectionId: string; window: DiagnosticWindow;
  metricRef: string }): Promise<{ current: AccountMetricsRow; previous: AccountMetricsRow | null }> {
  const found = await rows(rpc, 'meta_diagnostic_account_metrics', {
    p_connection_id: args.connectionId, p_from: args.window.from, p_to: args.window.to,
    p_prev_from: args.window.prev_from, p_prev_to: args.window.prev_to, p_metric_ref: args.metricRef,
  }, accountMetricsRowSchema);
  const current = found.find((row) => row.period === 'current');
  if (!current || found.length > 2) throw new DiagnosticReadError();
  return { current, previous: found.find((row) => row.period === 'previous') ?? null };
}

const attributionCoverageSchema = z.array(z.object({ rows: z.array(z.object({
  inline_link_clicks: z.string().nullable(),
  actions: z.array(z.object({ action_type: z.string(), variant: z.string(),
    count: z.string().nullable(), value: z.string().nullable() })),
  attribution: z.object({ known: z.boolean(), settings: z.array(z.object({
    windows: z.array(attributionWindowSchema),
  })) }).nullable(),
})) }));

/** Solo ventanas de filas que aportaron resultados del objetivo; nunca conserva adset_ref. */
export function extractAttributionWindows(raw: unknown, metricRef: string): AttributionWindow[] {
  const parsed = attributionCoverageSchema.safeParse(raw);
  if (!parsed.success) throw new DiagnosticReadError();
  const windows = new Map<string, AttributionWindow>();
  const actionType = metricRef.startsWith('actions:') ? metricRef.slice('actions:'.length) : null;
  for (const coverage of parsed.data) for (const row of coverage.rows) {
    const contributes = actionType === null ? row.inline_link_clicks !== null
      : row.actions.some((action) => action.action_type === actionType && action.variant === 'value'
        && (action.count !== null || action.value !== null));
    if (!contributes || !row.attribution?.known) continue;
    for (const setting of row.attribution.settings) for (const window of setting.windows) {
      windows.set(`${window.event_type}:${window.days}`, window);
    }
  }
  return [...windows.values()].sort((a, b) => a.event_type.localeCompare(b.event_type, 'en') || a.days - b.days);
}

/** Lectura de la proyección de cuenta bajo RLS; se guarda solo el resumen sin IDs. */
export async function readAccountAttributionWindows(supabase: SupabaseClient, connectionId: string,
  window: DiagnosticWindow, metricRef: string): Promise<AttributionWindow[]> {
  const { data, error } = await supabase.from('meta_daily_coverage').select('rows')
    .eq('connection_id', connectionId).eq('level', 'account')
    .gte('date', window.from).lte('date', window.to).order('date', { ascending: true });
  if (error || !data) throw new DiagnosticReadError();
  return extractAttributionWindows(data, metricRef);
}

/** Recorre todas las entidades elegibles por clave (gasto desc, ref), sin el tope de PostgREST. */
export async function readAllEntities(rpc: Rpc, args: { connectionId: string; level: EntityLevel;
  window: DiagnosticWindow; comparison: boolean; metricRef: string; pageSize?: number }):
  Promise<{ rows: EntityMetricsRow[]; pages: number }> {
  const pageSize = args.pageSize ?? DIAGNOSTIC_LIMITS.entityPageSize;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > DIAGNOSTIC_LIMITS.entityPageMax) {
    throw new DiagnosticReadError();
  }
  const all: EntityMetricsRow[] = [];
  const seen = new Set<string>();
  let after: { spend: string | null; ref: string } | null = null;
  let pages = 0;
  for (;;) {
    if (pages >= DIAGNOSTIC_LIMITS.entityPagesPerLevelMax) throw new DiagnosticReadError();
    const page: EntityMetricsRow[] = await rows(rpc, 'meta_diagnostic_entity_metrics', {
      p_connection_id: args.connectionId, p_level: args.level,
      p_from: args.window.from, p_to: args.window.to,
      p_prev_from: args.comparison ? args.window.prev_from : null,
      p_prev_to: args.comparison ? args.window.prev_to : null,
      p_metric_ref: args.metricRef,
      p_after_spend: after?.spend ?? null, p_after_ref: after?.ref ?? null, p_limit: pageSize,
    }, entityMetricsRowSchema);
    pages += 1;
    for (const row of page) {
      // Una clave repetida indica una página que no avanza: se corta en vez de duplicar.
      if (seen.has(row.entity_ref)) throw new DiagnosticReadError();
      seen.add(row.entity_ref);
      all.push(row);
    }
    if (page.length < pageSize) break;
    const last = page[page.length - 1];
    after = { spend: last.cur_spend, ref: last.entity_ref };
  }
  return { rows: all, pages };
}

/** Desgloses, siempre de nivel cuenta (el informe no pide desgloses de campaña). */
export async function readBreakdowns(rpc: Rpc, args: { connectionId: string; window: DiagnosticWindow;
  metricRef: string }): Promise<Record<BreakdownDimension, BreakdownMetricsRow[]>> {
  const out = {} as Record<BreakdownDimension, BreakdownMetricsRow[]>;
  for (const dimension of BREAKDOWN_DIMENSIONS) {
    out[dimension] = await rows(rpc, 'meta_diagnostic_breakdown_metrics', {
      p_connection_id: args.connectionId, p_level: 'account', p_dimension: dimension,
      p_from: args.window.from, p_to: args.window.to, p_metric_ref: args.metricRef,
    }, breakdownMetricsRowSchema);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Escrituras por worker_api: devuelven un outcome de lista cerrada.
// ---------------------------------------------------------------------------

export const RESERVE_OUTCOMES = ['reserved', 'already_reserved', 'in_progress', 'sync_changed',
  'connection_changed', ...ELIGIBILITY_REASONS] as const;
export type ReserveOutcome = (typeof RESERVE_OUTCOMES)[number];
export const PUBLISH_OUTCOMES = ['published', 'already_published', 'reservation_lost',
  'connection_changed', 'sync_changed'] as const;
export type PublishOutcome = (typeof PUBLISH_OUTCOMES)[number];

export class DiagnosticWriteError extends Error {
  constructor() {
    super('No se pudo escribir el diagnóstico.');
    this.name = 'DiagnosticWriteError';
  }
}

function single<T extends string>(found: Record<string, unknown>[], column: string, allowed: readonly T[]): T {
  const value = found[0]?.[column];
  if (found.length !== 1 || typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new DiagnosticWriteError();
  }
  return value as T;
}

export async function saveSettings(worker: WorkerApi, ctx: TenantContext, settings: DiagnosticSettings): Promise<'saved'> {
  const found = await worker.call('save_diagnostic_settings',
    [ctx.user_id, ctx.company_id, settings.goal_kind, settings.metric_ref]);
  return single(found, 'save_diagnostic_settings', ['saved'] as const);
}

export async function reserveDiagnostic(worker: WorkerApi, ctx: TenantContext, args: {
  connectionId: string; generation: number; syncFinishedAt: string; ttlSeconds?: number }): Promise<ReserveOutcome> {
  const found = await worker.call('reserve_diagnostic', [ctx.user_id, ctx.company_id, ctx.request_id,
    args.connectionId, args.generation, args.syncFinishedAt,
    args.ttlSeconds ?? DIAGNOSTIC_LIMITS.reservationTtlSeconds]);
  return single(found, 'reserve_diagnostic', RESERVE_OUTCOMES);
}

export async function releaseDiagnostic(worker: WorkerApi, ctx: TenantContext): Promise<boolean> {
  const found = await worker.call('release_diagnostic', [ctx.user_id, ctx.company_id, ctx.request_id]);
  const value = found[0]?.release_diagnostic;
  if (found.length !== 1 || typeof value !== 'boolean') throw new DiagnosticWriteError();
  return value;
}

export async function publishDiagnostic(worker: WorkerApi, ctx: TenantContext, args: {
  connectionId: string; generation: number; report: unknown }): Promise<PublishOutcome> {
  const found = await worker.call('publish_diagnostic', [ctx.user_id, ctx.company_id, ctx.request_id,
    args.connectionId, args.generation, JSON.stringify(args.report)]);
  return single(found, 'publish_diagnostic', PUBLISH_OUTCOMES);
}
