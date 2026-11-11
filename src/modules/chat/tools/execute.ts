import type { SupabaseClient } from '@supabase/supabase-js';

import { maskExternalAccountId } from '@/modules/integrations/contract';
import type { MetaCapturedEntity, MetaSyncStatus } from '@/modules/integrations/meta/insights';

import { CHAT_LIMITS } from '../limits';
import { parseToolResult, type ToolResult } from './results';
import { projectToolArgs, ToolArgumentError, ToolEntityNotFoundError, TOOL_NAMES,
  type ProjectedToolCall,
  type ToolName } from './schema';

type Period = { from: string; to: string };

/** Solo lo arma el orquestador en el servidor, después de resolver K01. */
export type TurnContext = Readonly<{
  connection: Readonly<{
    id: string;
    status: 'pending_selection' | 'active' | 'needs_reauth';
    external_account_id: string | null;
    currency: string | null;
    timezone: string | null;
  }> | null;
}>;

type ToolDeps = {
  supabase?: SupabaseClient;
  rpc?: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  listEntities?: (connectionId: string, level: 'account' | 'campaign' | 'adset' | 'ad') => Promise<MetaCapturedEntity[]>;
  readStatus?: (connectionId: string) => Promise<MetaSyncStatus | null>;
};

export class ToolExecutionError extends Error {
  constructor() { super('No se pudo ejecutar la herramienta.'); }
}

async function client(deps: ToolDeps): Promise<SupabaseClient> {
  if (deps.supabase) return deps.supabase;
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  return createSupabaseServerClient();
}

async function entities(connectionId: string, level: 'account' | 'campaign' | 'adset' | 'ad', deps: ToolDeps) {
  if (deps.listEntities) return deps.listEntities(connectionId, level);
  const { listCapturedEntities } = await import('@/modules/integrations/meta/insights');
  return listCapturedEntities(connectionId, level, { supabase: await client(deps) });
}

async function status(connectionId: string, deps: ToolDeps) {
  if (deps.readStatus) return deps.readStatus(connectionId);
  const { readMetaSyncStatus } = await import('@/modules/integrations/meta/insights');
  return readMetaSyncStatus(connectionId, { supabase: await client(deps) });
}

const DEFAULT_ENTITY_TOOLS = new Set<ToolName>([
  'action_types', 'daily_series', 'total', 'compare_periods', 'daily_average',
  'cost_per_result', 'percent_change',
]);

/** Resolver asincrónico de la entidad de cuenta, con lectura paginada completa bajo RLS. */
export async function resolveToolCall(name: string, flat: Record<string, unknown>,
  ctx: TurnContext, period: Period, deps: ToolDeps = {}): Promise<ProjectedToolCall> {
  let accountEntityRef: string | null = null;
  if ((TOOL_NAMES as readonly string[]).includes(name) && DEFAULT_ENTITY_TOOLS.has(name as ToolName) &&
      (flat.entity_ref === null || flat.entity_ref === undefined)) {
    if (!ctx.connection) throw new ToolEntityNotFoundError();
    let account: MetaCapturedEntity[];
    try { account = await entities(ctx.connection.id, 'account', deps); }
    catch { throw new ToolExecutionError(); }
    accountEntityRef = account[0]?.entity_ref ?? null;
  }
  return projectToolArgs(name, flat, { period, accountEntityRef });
}

const SYNTHETIC_ENTITY_REF = '00000000-0000-4000-8000-000000000000';

/** La cuenta sin entidad capturada se informa al modelo sin consultar métricas ni inventar ceros. */
export function missingAccountEntityResult(name: string, flat: Record<string, unknown>,
  ctx: TurnContext, defaultPeriod: Period, toolCallId: string): ToolResult {
  const projected = projectToolArgs(name, flat, { period: defaultPeriod,
    accountEntityRef: SYNTHETIC_ENTITY_REF });
  if (!projected.entityDefaulted) throw new ToolArgumentError();
  const args = projected.args;
  const single = args.period as Period | undefined;
  const first = args.period_a as Period | undefined;
  const second = args.period_b as Period | undefined;
  return parseToolResult({ status: 'not_found', reason: 'entity_not_found',
    scope: { level: 'account', entity_ref: null, entity_name: null,
      period: single ?? null, period_a: first ?? null, period_b: second ?? null,
      period_defaulted: projected.periodDefaulted, entity_defaulted: true,
      timezone: ctx.connection?.timezone ?? null,
      currency: ctx.connection?.currency ?? null },
    values: [], composition: null, extra: {} }, toolCallId,
  ctx.connection?.external_account_id ?
    maskExternalAccountId(ctx.connection.external_account_id) : null, projected.name);
}

function value(pathKey: 'list_count', metric: 'list_count', text: string) {
  return { path_key: pathKey, metric, unit: 'count', currency: null,
    action_type: null, attribution_ref: null, period: null, period_a: null, period_b: null,
    day: null, entity_ref: null, entity_name: null, parent_ref: null,
    segment_primary: null, segment_secondary: null, value: text, absence: null,
    presence: null, temporal_status: null, captured_partial: false,
    fetched_at: null, composition: null };
}

function baseScope(ctx: TurnContext, level: string | null, call: ProjectedToolCall) {
  return { level, entity_ref: null, entity_name: null, period: null, period_a: null,
    period_b: null, period_defaulted: call.periodDefaulted,
    entity_defaulted: call.entityDefaulted, timezone: ctx.connection?.timezone ?? null,
    currency: ctx.connection?.currency ?? null };
}

function rpcArgs(call: ProjectedToolCall, connectionId: string): Record<string, unknown> {
  const a = call.args;
  const args: Record<string, unknown> = { p_connection_id: connectionId };
  if ('entity_ref' in a) args.p_entity_ref = a.entity_ref;
  if ('level' in a) args.p_level = a.level;
  if ('dimension' in a) args.p_dimension = a.dimension;
  if ('metric' in a) args.p_metric = a.metric;
  if ('action_type' in a || ['total', 'daily_average', 'daily_series', 'compare_periods',
    'percent_change', 'ranking', 'share', 'breakdown'].includes(call.name)) {
    args.p_action_type = a.action_type ?? null;
  }
  if (a.period && typeof a.period === 'object') {
    args.p_from = (a.period as Period).from; args.p_to = (a.period as Period).to;
  }
  if (a.period_a && a.period_b) {
    args.p_a_from = (a.period_a as Period).from; args.p_a_to = (a.period_a as Period).to;
    args.p_b_from = (a.period_b as Period).from; args.p_b_to = (a.period_b as Period).to;
  }
  if ('order' in a) args.p_order = a.order;
  if ('limit' in a) args.p_limit = a.limit;
  if ('include_trend' in a) args.p_include_trend = a.include_trend;
  return args;
}

export async function executeTool(call: ProjectedToolCall, ctx: TurnContext, toolCallId: string,
  deps: ToolDeps = {}, signal?: AbortSignal): Promise<ToolResult> {
  const accountRef = ctx.connection?.external_account_id
    ? maskExternalAccountId(ctx.connection.external_account_id) : null;
  try {
    if (call.name === 'connection_status') {
      const sync = ctx.connection && ['active', 'needs_reauth'].includes(ctx.connection.status)
        ? await status(ctx.connection.id, deps) : null;
      return parseToolResult({ status: 'ok', reason: null, scope: baseScope(ctx, 'account', call),
        values: [], composition: null, extra: {
          connection_status: ctx.connection?.status ?? null,
          effective_sync_status: sync?.effective_status ?? null,
          last_finished_at: sync?.summary?.finished_at ?? null,
        } }, toolCallId, accountRef, call.name);
    }
    if (!ctx.connection || !['active', 'needs_reauth'].includes(ctx.connection.status)) {
      throw new ToolExecutionError();
    }
    if (call.name === 'entities') {
      const level = call.args.level as 'account' | 'campaign' | 'adset' | 'ad';
      const all = await entities(ctx.connection.id, level, deps);
      const visible = all.slice(0, CHAT_LIMITS.modelEntitiesLimit).map((entity) => ({
        entity_ref: entity.entity_ref, level: entity.level, parent_ref: entity.parent_ref,
        name: entity.name, effective_status: entity.effective_status,
        objective: entity.objective,
      }));
      return parseToolResult({ status: 'ok', reason: null, scope: baseScope(ctx, level, call),
        values: [value('list_count', 'list_count', String(all.length))], composition: null,
        extra: { entities: visible, total: all.length,
          truncated: all.length > CHAT_LIMITS.modelEntitiesLimit } }, toolCallId, accountRef, call.name);
    }
    const fn = `chat_${call.name}`;
    const args = rpcArgs(call, ctx.connection.id);
    let raw: unknown;
    if (deps.rpc) raw = await deps.rpc(fn, args);
    else {
      const request = (await client(deps)).rpc(fn, args);
      const { data, error } = await (signal ? request.abortSignal(signal) : request);
      if (error) throw new ToolExecutionError();
      raw = data;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ToolExecutionError();
    const record = raw as Record<string, unknown>;
    if (!record.scope || typeof record.scope !== 'object' || Array.isArray(record.scope)) {
      throw new ToolExecutionError();
    }
    return parseToolResult({ ...record,
      extra: call.name === 'breakdown' ? { ...(record.extra as object),
        dimension: call.args.dimension } : record.extra,
      scope: { ...(record.scope as object),
      period_defaulted: call.periodDefaulted, entity_defaulted: call.entityDefaulted } },
    toolCallId, accountRef, call.name);
  } catch (error) {
    if (error instanceof ToolExecutionError) throw error;
    throw new ToolExecutionError();
  }
}
