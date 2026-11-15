import type { SupabaseClient } from '@supabase/supabase-js';

import { TN_COLLECTED_AMOUNT_ENABLED } from '@/modules/integrations/tiendanube/limits';

import { parseToolResult, type ToolResult } from './results';
import { isTiendanubeTool, TN_TOOL_NAMES, type ProjectedToolCall } from './schema';

export { isTiendanubeTool, TN_TOOL_NAMES };

/**
 * Herramientas de Tiendanube del chat (M16e §6, D-M16e-10). Leen solo con las funciones
 * `get_tn_*` de 0023, con el JWT del usuario y bajo RLS. Devuelven agregados con fuente,
 * período, zona, moneda, cobertura y fecha de extracción; nunca IDs de tienda, pedidos,
 * clientes ni las claves internas de producto. La regla de cinco ya viene aplicada desde SQL:
 * un conteo oculto llega nulo y se marca `menos_de_5`.
 */

export type StoreConnection = Readonly<{
  id: string;
  status: 'pending_selection' | 'active' | 'needs_reauth';
  currency: string | null;
  timezone: string | null;
}>;

export type StoreRpc = (fn: string, args: Record<string, unknown>) => Promise<unknown>;
export type StoreToolDeps = Readonly<{ rpc: StoreRpc; collectedAmountEnabled?: boolean }>;

export class StoreToolError extends Error {
  constructor() { super('No se pudo leer la tienda.'); }
}

/** Cliente de lectura del usuario: un error de PostgREST nunca llega con su mensaje. */
export function supabaseRpc(supabase: SupabaseClient, signal?: AbortSignal): StoreRpc {
  return async (fn, args) => {
    const request = supabase.rpc(fn, args);
    const { data, error } = await (signal ? request.abortSignal(signal) : request);
    if (error) throw new StoreToolError();
    return data;
  };
}

type Row = Record<string, unknown>;
type Period = { from: string; to: string };

function rows(data: unknown): Row[] {
  if (!Array.isArray(data) || data.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new StoreToolError();
  }
  return data as Row[];
}

const text = (value: unknown) => (typeof value === 'string' ? value : null);
const date = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) throw new StoreToolError();
  return value.slice(0, 10);
};

/** Número de SQL como texto decimal exacto (PostgREST entrega enteros y numeric como JSON). */
function decimal(value: unknown): string {
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const out = String(value);
    if (/^-?\d+(\.\d+)?$/.test(out)) return out;
  }
  throw new StoreToolError();
}

/** Multiplica un decimal por 100 corriendo la coma: exacto, sin pasar por coma flotante. */
function timesHundred(value: string): string {
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace('-', '').split('.');
  const digits = `${whole}${fraction.padEnd(2, '0')}`;
  const rest = fraction.slice(2);
  const integer = digits.slice(0, whole.length + 2).replace(/^0+(?=\d)/, '');
  return `${negative ? '-' : ''}${integer}${rest ? `.${rest}` : ''}`;
}

/** Resta exacta de dos decimales (monto cobrado = pagado − reembolsos verificados). */
function subtract(a: string, b: string): string {
  const scale = Math.max((a.split('.')[1] ?? '').length, (b.split('.')[1] ?? '').length);
  const toInt = (v: string) => {
    const negative = v.startsWith('-');
    const [whole, fraction = ''] = v.replace('-', '').split('.');
    const n = BigInt(`${whole}${fraction.padEnd(scale, '0')}`);
    return negative ? -n : n;
  };
  const diff = toInt(a) - toInt(b);
  const abs = (diff < BigInt(0) ? -diff : diff).toString().padStart(scale + 1, '0');
  const body = scale ? `${abs.slice(0, -scale)}.${abs.slice(-scale)}`.replace(/\.?0+$/, '') : abs;
  return `${diff < BigInt(0) ? '-' : ''}${body}`;
}

function lastDayOfMonth(day: string): string {
  const [y, m] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

const base = {
  action_type: null, attribution_ref: null, period_a: null, period_b: null, day: null,
  entity_ref: null, entity_name: null, parent_ref: null, segment_primary: null,
  segment_secondary: null, presence: null, temporal_status: null, composition: null,
  cohort_month: null, month_offset: null,
} as const;

function scope(store: StoreConnection, call: ProjectedToolCall, period: Period | null) {
  return { level: null, entity_ref: null, entity_name: null, period, period_a: null, period_b: null,
    period_defaulted: call.periodDefaulted, entity_defaulted: false,
    timezone: store.timezone, currency: store.currency };
}

type Status = { coveredThrough: string | null; backfillDone: boolean; fetchedAt: string | null;
  extra: Record<string, unknown> };

async function readStatus(store: StoreConnection, deps: StoreToolDeps): Promise<Status> {
  const [row] = rows(await deps.rpc('get_tn_sync_status', { p_connection_id: store.id }));
  if (!row) return { coveredThrough: null, backfillDone: false, fetchedAt: null, extra: {} };
  const coveredThrough = row.covered_through === null ? null : date(row.covered_through);
  const fetchedAt = text(row.last_fetched_at);
  return { coveredThrough, backfillDone: row.backfill_done === true, fetchedAt, extra: {
    phase: text(row.phase), last_finished_at: text(row.last_run_finished_at),
    last_run_status: text(row.last_run_status), last_fetched_at: fetchedAt,
    catalog_complete_at: text(row.catalog_complete_at), store_domain: text(row.store_domain) } };
}

function common(status: Status) {
  return { source: 'tiendanube', covered_through: status.coveredThrough, backfill_done: status.backfillDone };
}

async function ventas(call: ProjectedToolCall, store: StoreConnection, id: string, deps: StoreToolDeps) {
  const period = call.args.period as Period;
  const grain = call.args.granularity as 'day' | 'month';
  const status = await readStatus(store, deps);
  const data = rows(await deps.rpc('get_tn_sales', { p_connection_id: store.id, p_from: period.from,
    p_to: period.to, p_grain: grain }));
  const collected = deps.collectedAmountEnabled ?? TN_COLLECTED_AMOUNT_ENABLED;
  const values = data.flatMap((row) => {
    const start = date(row.period_start);
    const currency = text(row.currency);
    const covered = row.covered === true;
    const fetchedAt = text(row.fetched_at);
    const daily = grain === 'day';
    const span = daily ? { from: start, to: start } : {
      from: start < period.from ? period.from : start,
      to: lastDayOfMonth(start) > period.to ? period.to : lastDayOfMonth(start) };
    // Un período sin ventas y no cubierto es ausencia; cubierto, es un cero real.
    const absent = currency === null && !covered;
    const point = (metric: 'tn_paid_orders' | 'tn_partially_paid_orders' | 'tn_collected_amount',
      value: string | null) => ({ ...base, path_key: daily ? 'day' : 'total', metric,
      unit: metric === 'tn_collected_amount' ? 'money' : 'count', currency, period: span,
      day: daily ? start : null, presence: daily ? (absent ? 'no_observado' : 'con_datos') : null,
      value, absence: value === null ? 'no_observado' : null,
      captured_partial: !absent && !covered, fetched_at: fetchedAt });
    return [
      point('tn_paid_orders', absent ? null : decimal(row.paid_orders)),
      point('tn_partially_paid_orders', absent ? null : decimal(row.partially_paid_orders)),
      ...(collected && currency !== null ? [point('tn_collected_amount',
        subtract(decimal(row.paid_amount), decimal(row.refunded_amount)))] : []),
    ];
  });
  return parseToolResult({ status: 'ok', reason: null, scope: scope(store, call, period), values,
    composition: null, extra: { ...common(status), ...status.extra, granularity: grain } },
  id, null, call.name);
}

async function productos(call: ProjectedToolCall, store: StoreConnection, id: string, deps: StoreToolDeps) {
  const period = call.args.period as Period;
  const status = await readStatus(store, deps);
  const data = rows(await deps.rpc('get_tn_product_units', { p_connection_id: store.id, p_from: period.from,
    p_to: period.to, p_limit: call.args.limit }));
  // Las claves internas de producto y variante se descartan acá: no llegan al modelo ni a la pantalla.
  const values = data.map((row) => ({ ...base, path_key: 'product', metric: 'tn_units', unit: 'count',
    currency: null, period, entity_name: text(row.name) ?? 'Producto sin nombre',
    segment_primary: text(row.sku), segment_secondary: row.deleted === true ? 'producto eliminado' : null,
    value: decimal(row.units), absence: null, captured_partial: row.covered !== true,
    fetched_at: text(row.fetched_at) }));
  return parseToolResult({ status: 'ok', reason: null, scope: scope(store, call, period), values,
    composition: null, extra: { ...common(status), ...status.extra } }, id, null, call.name);
}

async function cohortes(call: ProjectedToolCall, store: StoreConnection, id: string, deps: StoreToolDeps) {
  const fromMonth = call.args.from_month as string;
  const toMonth = call.args.to_month as string;
  const status = await readStatus(store, deps);
  const data = rows(await deps.rpc('get_tn_cohorts', { p_connection_id: store.id,
    p_from_month: `${fromMonth}-01`, p_to_month: `${toMonth}-01`, p_max_offset: call.args.max_offset }));
  const seen = new Set<string>();
  const values: Record<string, unknown>[] = [];
  for (const row of data) {
    const month = date(row.cohort_month).slice(0, 7);
    const offset = Number(row.month_offset);
    if (!Number.isInteger(offset) || offset < 0) throw new StoreToolError();
    const sizeHidden = row.size_hidden === true;
    const cell = { ...base, path_key: 'cohort_cell', currency: null, period: null, cohort_month: month,
      fetched_at: text(row.fetched_at) };
    if (!seen.has(month)) {
      seen.add(month);
      values.push({ ...cell, metric: 'tn_cohort_size', unit: 'count',
        value: sizeHidden ? null : decimal(row.cohort_size), absence: sizeHidden ? 'menos_de_5' : null,
        captured_partial: false });
    }
    // Una cohorte de menos de cinco no lleva celdas (D-M16e-11).
    if (sizeHidden) continue;
    const hidden = row.active_hidden === true || row.active === null || row.retention === null;
    const partial = row.partial === true;
    values.push({ ...cell, month_offset: offset, metric: 'tn_cohort_active', unit: 'count',
      value: hidden ? null : decimal(row.active), absence: hidden ? 'menos_de_5' : null,
      captured_partial: partial });
    values.push({ ...cell, month_offset: offset, metric: 'tn_cohort_retention', unit: 'percent',
      value: hidden ? null : timesHundred(decimal(row.retention)), absence: hidden ? 'menos_de_5' : null,
      captured_partial: partial });
  }
  return parseToolResult({ status: 'ok', reason: null, scope: scope(store, call, null), values,
    composition: null, extra: { ...common(status), ...status.extra, from_month: fromMonth, to_month: toMonth,
      max_offset: call.args.max_offset } }, id, null, call.name);
}

async function cobertura(call: ProjectedToolCall, store: StoreConnection, id: string, deps: StoreToolDeps) {
  const status = await readStatus(store, deps);
  return parseToolResult({ status: 'ok', reason: null, scope: scope(store, call, null), values: [],
    composition: null, extra: { ...common(status), ...status.extra } }, id, null, call.name);
}

export async function executeTiendanubeTool(call: ProjectedToolCall, store: StoreConnection | null | undefined,
  toolCallId: string, deps: StoreToolDeps): Promise<ToolResult> {
  if (!isTiendanubeTool(call.name) || !store || !['active', 'needs_reauth'].includes(store.status)) {
    throw new StoreToolError();
  }
  try {
    switch (call.name) {
      case 'tn_ventas': return await ventas(call, store, toolCallId, deps);
      case 'tn_productos': return await productos(call, store, toolCallId, deps);
      case 'tn_cohortes': return await cohortes(call, store, toolCallId, deps);
      case 'tn_cobertura': return await cobertura(call, store, toolCallId, deps);
      default: throw new StoreToolError();
    }
  } catch {
    throw new StoreToolError();
  }
}

/** Dominio de la tienda para la página del chat (CA-52). Nunca se manda al modelo. */
export async function readStoreDomain(connectionId: string, supabase?: SupabaseClient): Promise<string | null> {
  const client = supabase ?? await (await import('@/lib/supabase/server')).createSupabaseServerClient();
  const [row] = rows(await supabaseRpc(client)('get_tn_sync_status', { p_connection_id: connectionId }));
  return row ? text(row.store_domain) : null;
}
