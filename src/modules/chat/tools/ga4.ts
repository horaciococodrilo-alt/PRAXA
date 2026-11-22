import { GA4_PROVISIONAL_DAYS } from '@/modules/integrations/ga4/reports';
import { groupGa4Items, qualityFlags, type Ga4Quality } from '@/modules/integrations/ga4/view-model';

import { parseToolResult, type ToolResult } from './results';
import { GA4_TOOL_NAMES, isGa4Tool, type ProjectedToolCall } from './schema';
import { decimal, timesHundred, type StoreRpc } from './tiendanube';

export { GA4_TOOL_NAMES, isGa4Tool };

/**
 * Herramientas de GA4 del chat (M16f §6, D-M16f-03). Leen solo las funciones `get_ga4_*` de
 * 0027/0029 con el JWT del usuario y bajo RLS; el gasto de Meta de `ga4_campanias` sale de la
 * misma lectura pública que usan las herramientas de Meta. Devuelven agregados con fuente,
 * período, zona, calidad y fecha de extracción; nunca el número de propiedad, `itemId`,
 * `utm_id` ni las claves internas de ítem o producto. Una fila ausente es cero solo si una
 * ventana completa y sin banderas la cubre; si no, es «desconocido» o «no observado».
 */

export type Ga4Connection = Readonly<{
  id: string;
  status: 'pending_selection' | 'active' | 'needs_reauth';
  currency: string | null;
  timezone: string | null;
}>;

export type MetaSpendRow = Readonly<{ day: string; entity_ref: string | null; name: string | null;
  presence: string; spend: string | null; currency: string | null; fetched_at: string | null }>;

export type Ga4ToolDeps = Readonly<{
  rpc: StoreRpc;
  /** Conexión de Meta activa del turno; sin ella, ninguna campaña tiene correspondencia. */
  metaConnectionId?: string | null;
  metaCampaignSpend?: (connectionId: string, from: string, to: string) => Promise<readonly MetaSpendRow[]>;
  /** Día local de la propiedad; lo fija el orquestador. */
  today: string;
}>;

/** Error que se lanza cuando una herramienta de GA4 no pudo leer los datos. */
export class Ga4ToolError extends Error {
  constructor() { super('No se pudo leer GA4.'); }
}

type Row = Record<string, unknown>;
type Period = { from: string; to: string };

function rows(data: unknown): Row[] {
  if (!Array.isArray(data) || data.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new Ga4ToolError();
  }
  return data as Row[];
}

const text = (value: unknown) => (typeof value === 'string' ? value : null);
const date = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) throw new Ga4ToolError();
  return value.slice(0, 10);
};
const quality = (value: unknown): Ga4Quality =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;

function count(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) throw new Ga4ToolError();
  return n;
}

function shift(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function days(period: Period): string[] {
  const out: string[] = [];
  for (let day = period.from; day <= period.to; day = shift(day, 1)) out.push(day);
  return out;
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

function scope(conn: Ga4Connection, call: ProjectedToolCall, period: Period | null) {
  return { level: null, entity_ref: null, entity_name: null, period, period_a: null, period_b: null,
    period_defaulted: call.periodDefaulted, entity_defaulted: false,
    timezone: conn.timezone, currency: null };
}

type Status = Readonly<{ coverageFrom: string | null; coverageThrough: string | null;
  fetchedAt: string | null; preflight: Row | null; extra: Record<string, unknown> }>;

async function readStatus(conn: Ga4Connection, deps: Ga4ToolDeps): Promise<Status> {
  const [row] = rows(await deps.rpc('get_ga4_sync_status', { p_connection_id: conn.id }));
  if (!row) return { coverageFrom: null, coverageThrough: null, fetchedAt: null, preflight: null, extra: {} };
  const coverageFrom = row.coverage_from === null ? null : date(row.coverage_from);
  const coverageThrough = row.coverage_through === null ? null : date(row.coverage_through);
  const fetchedAt = text(row.last_fetched_at);
  const preflight = quality(row.preflight);
  return { coverageFrom, coverageThrough, fetchedAt, preflight, extra: {
    property_name: text(row.display_name), phase: text(row.phase),
    covered_from: coverageFrom, covered_through: coverageThrough,
    last_finished_at: text(row.last_step_at), last_step_status: text(row.last_step_status),
    last_error_kind: text(row.last_error_kind), last_fetched_at: fetchedAt,
    provisional_days: GA4_PROVISIONAL_DAYS,
    capabilities: capabilities(preflight), mapping_rule: text(row.item_mapping_rule) } };
}

function capabilities(preflight: Row | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ['trafico', 'cohortes', 'campanias', 'embudo', 'productos']) {
    const entry = preflight?.[key];
    const status = entry && typeof entry === 'object' && !Array.isArray(entry) ?
      text((entry as Row).status) : null;
    out[key] = status ?? 'sin_preflight';
  }
  return out;
}

function common(status: Status) {
  return { source: 'ga4', ...status.extra };
}

/** Capacidad del preflight: si no está disponible, la herramienta devuelve la ausencia con su motivo. */
function unavailable(status: Status, capability: string): string | null {
  const state = capabilities(status.preflight)[capability];
  return state === 'disponible' ? null : state;
}

function unavailableResult(call: ProjectedToolCall, conn: Ga4Connection, id: string, status: Status,
  period: Period | null, metric: string, reason: string): ToolResult {
  return parseToolResult({ status: 'ok', reason: null, scope: scope(conn, call, period),
    values: [{ ...base, path_key: 'total', metric, unit: 'count', currency: null, period,
      value: null, absence: 'no_disponible', captured_partial: false, fetched_at: status.fetchedAt }],
    composition: null, extra: { ...common(status), unavailable_reason: reason } }, id, null, call.name);
}

/** Ventanas de calidad completas y sin banderas: solo dentro de ellas una fila ausente es cero. */
function cleanWindows(qualities: Ga4Quality[]): Period[] {
  const seen = new Map<string, Period>();
  for (const q of qualities) {
    if (!q || qualityFlags(q).length > 0) continue;
    const from = text(q.window_from);
    const to = text(q.window_to);
    if (from && to) seen.set(`${from}:${to}`, { from: from.slice(0, 10), to: to.slice(0, 10) });
  }
  return [...seen.values()];
}

function provisionalFrom(status: Status): string | null {
  return status.coverageThrough ? shift(status.coverageThrough, -(GA4_PROVISIONAL_DAYS - 1)) : null;
}

type DayState = 'row' | 'zero' | 'provisional_gap' | 'not_observed';

function absentDay(day: string, clean: Period[], status: Status): DayState {
  if (!status.coverageFrom || !status.coverageThrough || day < status.coverageFrom ||
      day > status.coverageThrough) return 'not_observed';
  const provisional = provisionalFrom(status);
  if (provisional && day >= provisional) return 'provisional_gap';
  return clean.some((w) => w.from <= day && day <= w.to) ? 'zero' : 'not_observed';
}

async function trafico(call: ProjectedToolCall, conn: Ga4Connection, id: string, deps: Ga4ToolDeps) {
  const period = call.args.period as Period;
  const grain = call.args.granularity as 'day' | 'month';
  const status = await readStatus(conn, deps);
  const data = rows(await deps.rpc('get_ga4_traffic', { p_connection_id: conn.id, p_from: period.from,
    p_to: period.to }));
  const byDay = new Map<string, Row>();
  for (const row of data) if (row.day !== null) byDay.set(date(row.day), row);
  const clean = cleanWindows(data.map((row) => quality(row.traffic_quality)));
  const sourceClean = cleanWindows(data.map((row) => quality(row.source_quality)));
  type Day = { day: string; state: DayState; sessions: number | null; metaVisits: number | null;
    activeUsers: number | null; newUsers: number | null; partial: boolean; sourcePartial: boolean;
    fetchedAt: string | null };
  const daily: Day[] = days(period).map((day) => {
    const row = byDay.get(day);
    if (!row) {
      const state = absentDay(day, clean, status);
      const zero = state === 'zero' ? 0 : null;
      const sourceZero = state === 'zero' && sourceClean.some((w) => w.from <= day && day <= w.to) ? 0 : null;
      return { day, state, sessions: zero, metaVisits: sourceZero, activeUsers: zero, newUsers: zero,
        partial: false, sourcePartial: false, fetchedAt: null };
    }
    const q = quality(row.traffic_quality);
    const sq = quality(row.source_quality);
    return { day, state: 'row', sessions: count(row.sessions),
      // Sin el informe de fuentes, las visitas desde Meta quedan desconocidas (§3).
      metaVisits: row.meta_visits === null || !sq ? null : count(row.meta_visits),
      activeUsers: count(row.active_users), newUsers: count(row.new_users),
      partial: row.provisional === true || qualityFlags(q).length > 0,
      // La calidad del informe de fuentes solo afecta las visitas desde Meta.
      sourcePartial: row.provisional === true || (sq !== null && qualityFlags(sq).length > 0),
      fetchedAt: text(q?.fetched_at) };
  });
  const absenceOf = (d: Day) => d.state === 'provisional_gap' ? 'desconocido' :
    d.state === 'not_observed' ? 'no_observado' : 'desconocido';
  const values: Record<string, unknown>[] = [];
  if (grain === 'day') {
    for (const d of daily) {
      const point = (metric: string, value: number | null, partial = d.partial) => ({ ...base, path_key: 'day', metric,
        unit: 'count', currency: null, period: { from: d.day, to: d.day }, day: d.day,
        presence: d.state === 'row' ? 'con_datos' : d.state === 'zero' ? 'sin_fila_reportada' : 'no_observado',
        value: value === null ? null : String(value), absence: value === null ? absenceOf(d) : null,
        captured_partial: value !== null && partial, fetched_at: d.fetchedAt });
      values.push(point('ga4_sessions', d.sessions), point('ga4_meta_visits', d.metaVisits, d.sourcePartial),
        point('ga4_active_users', d.activeUsers), point('ga4_new_users', d.newUsers));
    }
  } else {
    const months = new Map<string, Day[]>();
    for (const d of daily) months.set(d.day.slice(0, 7), [...(months.get(d.day.slice(0, 7)) ?? []), d]);
    for (const [month, list] of months) {
      const span = { from: list[0].day < period.from ? period.from : list[0].day,
        to: lastDayOfMonth(`${month}-01`) > period.to ? period.to : lastDayOfMonth(`${month}-01`) };
      const known = list.filter((d) => d.sessions !== null);
      const partial = known.length < list.length || list.some((d) => d.partial || d.sourcePartial);
      const fetched = list.map((d) => d.fetchedAt).filter((v): v is string => !!v).sort().at(-1) ?? null;
      const sum = (pick: (d: Day) => number | null) => known.reduce((t, d) => t + (pick(d) ?? 0), 0);
      const total = (metric: string, value: number | null, absence: string | null) => ({ ...base,
        path_key: 'total', metric, unit: 'count', currency: null, period: span,
        value: value === null ? null : String(value), absence: value === null ? absence : null,
        captured_partial: value !== null && partial, fetched_at: fetched });
      values.push(total('ga4_sessions', known.length ? sum((d) => d.sessions) : null, 'no_observado'),
        total('ga4_meta_visits', known.length && known.every((d) => d.metaVisits !== null) ?
          sum((d) => d.metaVisits) : null, known.length ? 'desconocido' : 'no_observado'),
        // Los usuarios no se suman entre días (§3): por mes van nulos.
        total('ga4_active_users', null, 'no_aditivo'), total('ga4_new_users', null, 'no_aditivo'));
    }
  }
  return parseToolResult({ status: 'ok', reason: null, scope: scope(conn, call, period), values,
    composition: null, extra: { ...common(status), granularity: grain } }, id, null, call.name);
}

async function embudo(call: ProjectedToolCall, conn: Ga4Connection, id: string, deps: Ga4ToolDeps) {
  const period = call.args.period as Period;
  const status = await readStatus(conn, deps);
  const reason = unavailable(status, 'embudo');
  if (reason) return unavailableResult(call, conn, id, status, period, 'ga4_event_count', reason);
  const data = rows(await deps.rpc('get_ga4_funnel', { p_connection_id: conn.id, p_from: period.from,
    p_to: period.to }));
  const events = ['view_item', 'add_to_cart', 'begin_checkout', 'purchase'];
  const clean = cleanWindows(data.map((row) => quality(row.quality)));
  const coveredClean = days(period).every((day) => absentDay(day, clean, status) === 'zero' ||
    data.some((row) => row.day !== null && date(row.day) === day));
  const partial = !coveredClean || data.some((row) => qualityFlags(quality(row.quality)).length > 0);
  const fetched = data.map((row) => text(quality(row.quality)?.fetched_at)).filter((v): v is string => !!v)
    .sort().at(-1) ?? null;
  const values = events.map((event) => {
    const mine = data.filter((row) => row.event_name === event);
    const value = mine.length ? mine.reduce((t, row) => t + count(row.event_count), 0) :
      coveredClean ? 0 : null;
    return { ...base, path_key: 'segment', metric: 'ga4_event_count', unit: 'count', currency: null,
      period, segment_primary: event, value: value === null ? null : String(value),
      absence: value === null ? 'desconocido' : null, captured_partial: value !== null && partial,
      fetched_at: fetched };
  });
  return parseToolResult({ status: 'ok', reason: null, scope: scope(conn, call, period), values,
    composition: null, extra: { ...common(status) } }, id, null, call.name);
}

async function productos(call: ProjectedToolCall, conn: Ga4Connection, id: string, deps: Ga4ToolDeps) {
  const period = call.args.period as Period;
  const status = await readStatus(conn, deps);
  const reason = unavailable(status, 'productos');
  if (reason) return unavailableResult(call, conn, id, status, period, 'ga4_item_views', reason);
  const data = rows(await deps.rpc('get_ga4_items', { p_connection_id: conn.id, p_from: period.from,
    p_to: period.to })).filter((row) => row.day !== null);
  const grouped = groupGa4Items(data.map((row) => ({ itemRef: text(row.item_ref),
    productKey: text(row.product_key), name: text(row.item_name), views: count(row.views),
    carts: count(row.add_to_carts), purchases: count(row.purchases),
    tnUnits: row.tn_units === null ? null : count(row.tn_units), quality: quality(row.quality) })));
  // Las unidades de un producto son desconocidas si algún día del período no tiene cobertura.
  const unitsKnown = new Map<string, boolean>();
  for (const row of data) {
    const key = text(row.product_key);
    if (key) unitsKnown.set(key, (unitsKnown.get(key) ?? true) && row.tn_units !== null);
  }
  const totalViews = grouped.reduce((t, row) => t + row.views, 0);
  const unmappedViews = grouped.filter((row) => !row.mapped).reduce((t, row) => t + row.views, 0);
  const values: Record<string, unknown>[] = [];
  for (const row of grouped.slice(0, call.args.limit as number)) {
    // La clave interna (item_ref o producto) se descarta: no llega al modelo ni a la pantalla.
    const name = row.name;
    const partial = row.flags.length > 0;
    const point = (metric: string, value: number | null, absence: string | null) => ({ ...base,
      path_key: 'product', metric, unit: 'count', currency: null, period, entity_name: name,
      segment_secondary: row.mapped ? null : 'sin correspondencia con Tiendanube',
      value: value === null ? null : String(value), absence: value === null ? absence : null,
      captured_partial: value !== null && partial, fetched_at: row.fetchedAt });
    values.push(point('ga4_item_views', row.views, null));
    if (row.mapped) {
      const key = row.key.startsWith('product:') ? row.key.slice(8) : null;
      values.push(point('ga4_add_to_carts', row.carts, null), point('ga4_purchases', row.purchases, null),
        point('tn_units', key && unitsKnown.get(key) ? row.tnUnits : null, 'desconocido'));
    }
  }
  return parseToolResult({ status: 'ok', reason: null, scope: scope(conn, call, period), values,
    composition: null, extra: { ...common(status), products_total: grouped.length,
      unmapped_view_share: totalViews > 0 ? Math.round(unmappedViews * 10_000 / totalViews) / 100 : null,
      mapped: status.extra.mapping_rule !== null } }, id, null, call.name);
}

async function campanias(call: ProjectedToolCall, conn: Ga4Connection, id: string, deps: Ga4ToolDeps) {
  const period = call.args.period as Period;
  const status = await readStatus(conn, deps);
  const reason = unavailable(status, 'campanias');
  if (reason) return unavailableResult(call, conn, id, status, period, 'ga4_campaign_sessions', reason);
  const data = rows(await deps.rpc('get_ga4_campaigns', { p_connection_id: conn.id, p_from: period.from,
    p_to: period.to })).filter((row) => row.day !== null);
  const meta = deps.metaConnectionId && deps.metaCampaignSpend ?
    await deps.metaCampaignSpend(deps.metaConnectionId, period.from, period.to) : [];
  const sessions = new Map<string, number>();
  let unmatched = 0;
  const flags = new Set<string>();
  let fetched: string | null = null;
  for (const row of data) {
    const q = quality(row.quality);
    for (const flag of qualityFlags(q)) flags.add(flag);
    const at = text(q?.fetched_at);
    if (at && (!fetched || at > fetched)) fetched = at;
    const ref = text(row.entity_ref);
    // La correspondencia exacta y única por utm_id la fijó SQL; sin conexión de Meta viva no hay ref.
    if (ref && deps.metaConnectionId) sessions.set(ref, (sessions.get(ref) ?? 0) + count(row.sessions));
    else unmatched += count(row.sessions);
  }
  const values: Record<string, unknown>[] = [];
  for (const [ref, total] of [...sessions].sort((a, b) => b[1] - a[1])) {
    const mine = meta.filter((row) => row.entity_ref === ref);
    const name = mine.map((row) => row.name).find((n) => !!n) ?? 'Campaña sin nombre';
    const currencies = [...new Set(mine.map((row) => row.currency).filter((c): c is string => !!c))];
    const observed = mine.filter((row) => row.presence !== 'no_observado');
    const spendKnown = currencies.length === 1 && observed.length === days(period).length;
    const spend = spendKnown ? sumDecimals(observed.map((row) => row.spend ?? '0')) : null;
    const partial = flags.size > 0;
    values.push({ ...base, path_key: 'entity', metric: 'ga4_campaign_sessions', unit: 'count',
      currency: null, period, entity_name: name, value: String(total), absence: null,
      captured_partial: partial, fetched_at: fetched },
    { ...base, path_key: 'entity', metric: 'spend', unit: 'money', currency: currencies[0] ?? null,
      period, entity_name: name, value: spend, absence: spend === null ? 'no_observado' : null,
      captured_partial: false, fetched_at: mine.map((row) => row.fetched_at).filter((v): v is string => !!v)
        .sort().at(-1) ?? null });
  }
  values.push({ ...base, path_key: 'total', metric: 'ga4_unmatched_sessions', unit: 'count', currency: null,
    period, value: String(unmatched), absence: null, captured_partial: flags.size > 0, fetched_at: fetched });
  return parseToolResult({ status: 'ok', reason: null, scope: scope(conn, call, period), values,
    composition: null, extra: { ...common(status), matched_campaigns: sessions.size,
      meta_connected: !!deps.metaConnectionId } }, id, null, call.name);
}

function sumDecimals(values: readonly string[]): string {
  const scale = Math.max(0, ...values.map((v) => (v.split('.')[1] ?? '').length));
  const total = values.reduce((acc, v) => {
    const [whole, fraction = ''] = decimal(v).replace('-', '').split('.');
    const n = BigInt(`${whole}${fraction.padEnd(scale, '0')}`);
    return acc + (v.startsWith('-') ? -n : n);
  }, BigInt(0));
  const negative = total < BigInt(0);
  const abs = (negative ? -total : total).toString().padStart(scale + 1, '0');
  return `${negative ? '-' : ''}${scale ? `${abs.slice(0, -scale)}.${abs.slice(-scale)}` : abs}`;
}

async function cohortes(call: ProjectedToolCall, conn: Ga4Connection, id: string, deps: Ga4ToolDeps) {
  const fromMonth = call.args.from_month as string;
  const toMonth = call.args.to_month as string;
  const status = await readStatus(conn, deps);
  const data = rows(await deps.rpc('get_ga4_cohorts', { p_connection_id: conn.id,
    p_from: `${fromMonth}-01`, p_to: `${toMonth}-01`, p_today: deps.today,
    p_max_offset: call.args.max_offset, p_provisional_days: GA4_PROVISIONAL_DAYS }));
  const seen = new Set<string>();
  const values: Record<string, unknown>[] = [];
  for (const row of data) {
    const month = date(row.cohort_month).slice(0, 7);
    const offset = Number(row.month_offset);
    if (!Number.isInteger(offset) || offset < 0) throw new Ga4ToolError();
    const sizeHidden = row.size_hidden === true;
    const fetchedAt = text(quality(row.quality)?.fetched_at);
    const cell = { ...base, path_key: 'cohort_cell', currency: null, period: null, cohort_month: month,
      fetched_at: fetchedAt };
    if (!seen.has(month)) {
      seen.add(month);
      const size = sizeHidden || row.cohort_size === null ? null : decimal(row.cohort_size);
      values.push({ ...cell, metric: 'ga4_cohort_size', unit: 'count', value: size,
        absence: size !== null ? null : sizeHidden ? 'menos_de_5' : 'sin_cobertura', captured_partial: false });
    }
    // Una cohorte oculta no lleva celdas: ni conteos ni retenciones deducibles (§3, regla de cinco).
    if (sizeHidden) continue;
    const absence = text(row.absence);
    const hidden = row.active_hidden === true || absence === 'menos_de_5';
    const partial = row.provisional === true;
    const active = hidden || row.active === null ? null : decimal(row.active);
    const retention = hidden || row.retention === null ? null : timesHundred(decimal(row.retention));
    const reasonOf = (value: string | null) => value !== null ? null : hidden ? 'menos_de_5' :
      absence === 'aun_no_disponible' ? 'aun_no_disponible' : absence === 'sin_cobertura' ?
        'sin_cobertura' : 'desconocido';
    values.push({ ...cell, month_offset: offset, metric: 'ga4_cohort_active', unit: 'count',
      value: active, absence: reasonOf(active), captured_partial: active !== null && partial });
    values.push({ ...cell, month_offset: offset, metric: 'ga4_cohort_retention', unit: 'percent',
      value: retention, absence: reasonOf(retention), captured_partial: retention !== null && partial });
  }
  return parseToolResult({ status: 'ok', reason: null, scope: scope(conn, call, null), values,
    composition: null, extra: { ...common(status), from_month: fromMonth, to_month: toMonth,
      max_offset: call.args.max_offset } }, id, null, call.name);
}

async function cobertura(call: ProjectedToolCall, conn: Ga4Connection, id: string, deps: Ga4ToolDeps) {
  const status = await readStatus(conn, deps);
  return parseToolResult({ status: 'ok', reason: null, scope: scope(conn, call, null), values: [],
    composition: null, extra: { ...common(status) } }, id, null, call.name);
}

/**
 * Ejecuta una herramienta de Google Analytics (tráfico, embudo, productos, campañas, cohortes, cobertura)
 * leyendo la base.
 */
export async function executeGa4Tool(call: ProjectedToolCall, conn: Ga4Connection | null | undefined,
  toolCallId: string, deps: Ga4ToolDeps): Promise<ToolResult> {
  if (!isGa4Tool(call.name) || !conn || !['active', 'needs_reauth'].includes(conn.status)) {
    throw new Ga4ToolError();
  }
  try {
    switch (call.name) {
      case 'ga4_trafico': return await trafico(call, conn, toolCallId, deps);
      case 'ga4_embudo': return await embudo(call, conn, toolCallId, deps);
      case 'ga4_productos': return await productos(call, conn, toolCallId, deps);
      case 'ga4_campanias': return await campanias(call, conn, toolCallId, deps);
      case 'ga4_cohortes': return await cohortes(call, conn, toolCallId, deps);
      case 'ga4_cobertura': return await cobertura(call, conn, toolCallId, deps);
      default: throw new Ga4ToolError();
    }
  } catch {
    throw new Ga4ToolError();
  }
}
