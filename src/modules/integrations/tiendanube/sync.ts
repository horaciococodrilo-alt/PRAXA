import 'server-only';

import { randomUUID } from 'node:crypto';

import { insightsMonetaryFields, M27A_MONETARY_DEFINITION, type MonetaryDefinition } from '@/modules/customer-insights/monetary';
import type { IntegrationConnectionRecord } from '@/modules/integrations/contract';
import { NoCompanyError } from '@/modules/company/service';
import { requireTenantContext, type TenantContext } from '@/modules/tenant/context';
import { getCredentialKeyring, type CredentialKeyring } from '../crypto/keyring';
import type { SecretValue } from '../crypto/seal';
import { getWorkerApi, WorkerApiError, type WorkerApi } from '../db/worker-api';
import { readConnectionRecord } from '../repository/connections';
import { readCredential } from '../repository/credentials';
import { createTiendanubeHttpClient, nextLink, totalCount, type TiendanubeHttpClient, type TiendanubeJson } from './client';
import { getTiendanubeConfig, userAgentFor, type TiendanubeConfig } from './config';
import { TiendanubeApiError } from './errors';
import { DEFAULT_TN_SYNC_LIMITS, type TiendanubeSyncLimits } from './limits';
import {
  ORDER_FIELDS,
  PRODUCT_FIELDS,
  STORE_SYNC_FIELDS,
  TiendanubeProjectionError,
  projectOrder,
  projectProduct,
  projectStore,
  refundedFromHistory,
  type ProjectedLine,
  type ProjectedOrder,
  type ProjectedProduct,
  type ProjectedStore,
} from './projection';
import { failSync, finishSync, publishCatalog, publishOrders, startSync, type Ownership, type StartedRun } from './repository';

/**
 * Un paso de sincronización de Tiendanube (M16e §3). El dueño lo dispara con «Sincronizar»
 * hasta terminar; no hay cron.
 *
 * - Posesión: cada paso abre una ejecución con lease y token ligados a conexión y generación.
 *   Si la conexión se desconecta o se reautoriza, la base rechaza la escritura (PX006/PX010).
 * - Backfill: ventanas mensuales de `created_at`, de la más antigua a la marca de agua. Un mes
 *   vacío se publica junto con el tramo vacío que lo sigue, buscado por mitades. Con
 *   `x-total-count` de 10.000 o más, o más páginas de las que entran en un paso, la ventana se
 *   divide a la mitad hasta un día. El checkpoint avanza solo con la última página publicada.
 * - Incremental: `updated_at` desde el checkpoint menos 1 hora hasta el inicio del paso. Si
 *   no entra, se divide a la mitad hasta una hora.
 * - Catálogo: con el presupuesto que queda; al cerrar un recorrido completo, la base marca
 *   eliminados los productos que faltan.
 * - Una ejecución que no termina su fase cierra incompleta: nunca extiende la cobertura.
 *
 * Los registros llevan conteos y clases cerradas; nunca IDs, montos ni nombres.
 */

// ---------------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------------

export const TN_SYNC_RESULTS = ['completa', 'parcial', 'en_curso', 'requiere_reauth', 'tienda_suspendida',
  'conexion_cambio', 'sin_conexion', 'error'] as const;
export type TiendanubeSyncResult = (typeof TN_SYNC_RESULTS)[number];

export const TN_SYNC_MESSAGES: Readonly<Record<TiendanubeSyncResult,
  Readonly<{ tone: 'ok' | 'info' | 'error'; text: string }>>> = Object.freeze({
  completa: { tone: 'ok', text: 'La tienda quedó sincronizada.' },
  parcial: { tone: 'info', text: 'La sincronización avanzó, pero todavía no terminó. Volvé a sincronizar para continuar.' },
  en_curso: { tone: 'info', text: 'Ya hay una sincronización en curso. Probá de nuevo en unos minutos.' },
  requiere_reauth: { tone: 'error', text: 'Tiendanube rechazó el acceso. Volvé a conectar la tienda.' },
  tienda_suspendida: { tone: 'error', text: 'Tiendanube informa que la tienda está suspendida. La sincronización queda detenida.' },
  conexion_cambio: { tone: 'error', text: 'La conexión cambió durante la sincronización. Revisá su estado y volvé a sincronizar.' },
  sin_conexion: { tone: 'info', text: 'No hay una tienda conectada para sincronizar.' },
  error: { tone: 'error', text: 'No pudimos sincronizar la tienda. Probá de nuevo más tarde.' },
});

/** Lee el resultado de la sincronización de la URL solo si es uno de los conocidos. */
export function parseTiendanubeSyncResult(value: string | string[] | undefined): TiendanubeSyncResult | null {
  return typeof value === 'string' && (TN_SYNC_RESULTS as readonly string[]).includes(value)
    ? value as TiendanubeSyncResult : null;
}

export type TiendanubeSyncLogEvent = {
  evento: 'tiendanube_sync';
  resultado: TiendanubeSyncResult;
  fase?: 'backfill' | 'incremental';
  tipo_error?: string;
  paginas?: number;
  pedidos?: number;
  ventanas?: number;
  productos?: number;
  historiales?: number;
  lineas_omitidas?: number;
  productos_omitidos?: number;
  espera_429_ms?: number;
  duracion_ms?: number;
  request_id?: string;
};

// ---------------------------------------------------------------------------
// Fechas en la zona de la tienda
// ---------------------------------------------------------------------------

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parts(instant: number, timeZone: string) {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(formatted.find((part) => part.type === type)?.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute'), s: get('second') };
}

function offsetMs(instant: number, timeZone: string): number {
  const p = parts(instant, timeZone);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(instant / 1000) * 1000;
}

/** Día local (`AAAA-MM-DD`) de un instante en la zona de la tienda. */
export function localDay(instant: Date, timeZone: string): string {
  const p = parts(instant.getTime(), timeZone);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** Instante de las 00:00 locales de un día, también en días con cambio de horario. */
export function zonedDayStart(day: string, timeZone: string): Date {
  if (!DAY.test(day)) throw new RangeError('día inválido');
  const [y, m, d] = day.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let instant = guess - offsetMs(guess, timeZone);
  const second = offsetMs(instant, timeZone);
  if (guess - second !== instant) instant = guess - second;
  return new Date(instant);
}

/** Suma días a una fecha "AAAA-MM-DD". */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function endOfMonth(day: string): string {
  const [y, m] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const minDay = (a: string, b: string) => (a <= b ? a : b);

/** Formato de los filtros de fecha: ISO 8601 en UTC, sin milisegundos. */
function apiInstant(value: Date): string {
  return value.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

// ---------------------------------------------------------------------------
// Dependencias y presupuesto
// ---------------------------------------------------------------------------

export type TiendanubeSyncDeps = {
  tenant: () => Promise<TenantContext>;
  readConnection: (ctx: TenantContext) => Promise<IntegrationConnectionRecord | null>;
  config: () => TiendanubeConfig;
  http: (config: TiendanubeConfig) => TiendanubeHttpClient;
  workerApi: () => WorkerApi;
  keyring: () => CredentialKeyring;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  randomUUID: () => string;
  limits: TiendanubeSyncLimits;
  log: (event: TiendanubeSyncLogEvent) => void;
  /** M27a §3: definición monetaria acreditada por T-04; nula hasta entonces. */
  monetaryDefinition: MonetaryDefinition | null;
};

function resolveDeps(partial: Partial<TiendanubeSyncDeps> = {}): TiendanubeSyncDeps {
  return {
    tenant: partial.tenant ?? requireTenantContext,
    readConnection: partial.readConnection ?? ((ctx) => readConnectionRecord(ctx, {}, 'tiendanube')),
    config: partial.config ?? getTiendanubeConfig,
    http: partial.http ?? ((config) => createTiendanubeHttpClient({ userAgent: userAgentFor(config) })),
    workerApi: partial.workerApi ?? getWorkerApi,
    keyring: partial.keyring ?? getCredentialKeyring,
    now: partial.now ?? Date.now,
    sleep: partial.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    randomUUID: partial.randomUUID ?? randomUUID,
    limits: partial.limits ?? DEFAULT_TN_SYNC_LIMITS,
    log: partial.log ?? ((event) => console.info(JSON.stringify(event))),
    monetaryDefinition: partial.monetaryDefinition === undefined ? M27A_MONETARY_DEFINITION : partial.monetaryDefinition,
  };
}

/** Se agotó un presupuesto del paso: la fase queda incompleta y sigue en el próximo paso. */
class BudgetExhausted extends Error {
  constructor() { super('Presupuesto del paso agotado.'); this.name = 'BudgetExhausted'; }
}

/** Una ventana que no entra ni dividida hasta el mínimo (un día o una hora). */
class WindowTooLarge extends Error {
  constructor() { super('Ventana demasiado grande.'); this.name = 'WindowTooLarge'; }
}

class Step {
  pages = 0;
  orders = 0;
  windows = 0;
  products = 0;
  historyCalls = 0;
  skippedLines = 0;
  skippedProducts = 0;
  waited429 = 0;
  private readonly started: number;

  constructor(private readonly deps: TiendanubeSyncDeps) {
    this.started = deps.now();
  }

  get elapsed(): number { return this.deps.now() - this.started; }

  /** Tiempo para seguir pidiendo páginas, dejando la reserva de cierre. */
  timeLeft(): number {
    return this.deps.limits.stepMs - this.deps.limits.finalizationReserveMs - this.elapsed;
  }

  pagesLeft(): number { return this.deps.limits.maxPages - this.pages; }

  /** Antes de cada página: hay páginas y tiempo, o el paso termina incompleto. */
  reservePage(): void {
    if (this.pagesLeft() <= 0 || this.timeLeft() <= 0) throw new BudgetExhausted();
    this.pages += 1;
  }

  /** Reintentos ante `5xx`, timeout o red, y espera por `429` con su tope acumulado. */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    const { limits } = this.deps;
    let transient = 0;
    for (;;) {
      try {
        return await fn();
      } catch (error) {
        if (!(error instanceof TiendanubeApiError)) throw error;
        if (error.kind === 'cuota') {
          const wait = Math.max(error.retryAfterMs ?? 1_000, 100);
          if (this.waited429 + wait > limits.max429WaitMs || wait > this.timeLeft()) throw error;
          this.waited429 += wait;
          await this.deps.sleep(wait);
          continue;
        }
        if ((error.kind === 'transitorio' || error.kind === 'transporte') && transient < limits.maxTransientRetries) {
          const wait = limits.transientDelayMs * 2 ** transient;
          transient += 1;
          if (wait > this.timeLeft()) throw error;
          await this.deps.sleep(wait);
          continue;
        }
        throw error;
      }
    }
  }
}

type Context = {
  ctx: TenantContext;
  deps: TiendanubeSyncDeps;
  http: TiendanubeHttpClient;
  token: SecretValue;
  storeId: string;
  timezone: string;
  own: Ownership;
  step: Step;
};

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

type Range = { field: 'created_at'; from: string; to: string } | { field: 'updated_at'; from: Date; to: Date };

function rangeQuery(range: Range, timezone: string): Record<string, string> {
  if (range.field === 'created_at') {
    const min = zonedDayStart(range.from, timezone);
    const max = new Date(zonedDayStart(addDays(range.to, 1), timezone).getTime() - 1_000);
    return { created_at_min: apiInstant(min), created_at_max: apiInstant(max) };
  }
  return { updated_at_min: apiInstant(range.from), updated_at_max: apiInstant(range.to) };
}

async function fetchOrdersPage(c: Context, range: Range, perPage: number): Promise<TiendanubeJson> {
  c.step.reservePage();
  return c.step.call(() => c.http.getJson(c.storeId, 'orders', {
    ...rangeQuery(range, c.timezone), status: 'any', payment_status: 'any', per_page: String(perPage),
    page: '1', fields: ORDER_FIELDS,
  }, c.token, 'order'));
}

function totalOf(page: TiendanubeJson): number {
  const total = totalCount(page.headers);
  if (total !== null) return total;
  // Sin el header, una sola página sin siguiente se cuenta por su largo.
  if (Array.isArray(page.body) && nextLink(page.headers) === null) return page.body.length;
  throw new TiendanubeApiError({ kind: 'desconocido', errorClass: 'unknown' });
}

/** ¿Entra en una consulta y en las páginas que quedan del paso? */
function fits(c: Context, total: number, pagesLeft: number): 'fits' | 'later' | 'split' {
  const { maxResultsPerQuery, maxPages, perPage } = c.deps.limits;
  const pagesNeeded = Math.max(1, Math.ceil(total / perPage));
  if (total >= maxResultsPerQuery || pagesNeeded > maxPages) return 'split';
  return pagesNeeded <= pagesLeft + 1 ? 'fits' : 'later';
}

/**
 * Proyección de una página: sin duplicados (gana el `updated_at` más nuevo) y con reembolsos.
 * Los campos monetarios de M27a salen del objeto JSON decodificado con el lector estricto, no
 * de `ProjectedOrder`; sin definición acreditada quedan `null`, `unverified`, `null`.
 */
async function projectPage(c: Context, body: unknown): Promise<{ orders: ProjectedOrder[]; lines: ProjectedLine[] }> {
  if (!Array.isArray(body)) throw new TiendanubeProjectionError();
  const byId = new Map<string, { order: ProjectedOrder; lines: ProjectedLine[]; raw: unknown }>();
  for (const raw of body) {
    const projected = projectOrder(raw);
    c.step.skippedLines += projected.skippedLines;
    const seen = byId.get(projected.order.id);
    if (!seen || seen.order.updated_at < projected.order.updated_at) byId.set(projected.order.id, { ...projected, raw });
  }
  const definition = c.deps.monetaryDefinition;
  for (const entry of byId.values()) {
    const { order } = entry;
    const refunded = order.payment_status === 'refunded' || order.payment_status === 'partially_refunded';
    // La definición B necesita el historial de todo pedido: no se infiere que uno pagado nunca
    // tuvo una edición. Sin leerlo, el pedido queda `incomplete` (nunca cero).
    const needsHistory = refunded || definition === 'tn_paid_current_less_verified_refunds_v1';
    let history: unknown;
    if (needsHistory && c.step.historyCalls < c.deps.limits.maxHistoryCalls && c.step.timeLeft() > 0) {
      c.step.historyCalls += 1;
      try {
        history = (await c.step.call(() => c.http.getJson(c.storeId, `orders/${order.id}/history/values`, {},
          c.token, 'order'))).body;
        if (refunded) order.refunded_amount = refundedFromHistory(history);
      } catch (error) {
        // Un historial que no se puede leer deja el reembolso sin verificar (nulo), no en cero.
        if (!(error instanceof TiendanubeApiError) || error.kind === 'credencial_invalida' ||
            error.kind === 'permiso_faltante' || error.kind === 'tienda_suspendida') throw error;
        history = undefined;
      }
    }
    Object.assign(order, insightsMonetaryFields({ rawOrder: entry.raw, definition, history }));
  }
  const values = [...byId.values()];
  return { orders: values.map((v) => v.order), lines: values.flatMap((v) => v.lines) };
}

/** Publica todas las páginas de una ventana que ya entra, empezando por la primera ya leída. */
async function publishWindow(c: Context, first: TiendanubeJson,
  window: (last: boolean) => Parameters<typeof publishOrders>[1]['window']): Promise<void> {
  let page = first;
  for (;;) {
    const next = nextLink(page.headers);
    const { orders, lines } = await projectPage(c, page.body);
    // Publicar sin `last_page` no mueve el checkpoint: si el paso se corta, la ventana se repite.
    await publishOrders(c.ctx, { ...c.own, window: window(next === null), orders, lines },
      { workerApi: c.deps.workerApi() });
    c.step.orders += orders.length;
    if (next === null) break;
    c.step.reservePage();
    page = await c.step.call(() => c.http.getNext(c.storeId, 'orders', next, c.token, 'order'));
  }
  c.step.windows += 1;
}

/**
 * Último día `X` tal que `[from, X]` no tiene pedidos, sabiendo que `[from, knownEmpty]` está
 * vacío. Busca por mitades con consultas de una fila, hasta quedar a menos de un mes del primer
 * tramo con pedidos: el histórico vacío anterior a la tienda cuesta unas pocas páginas.
 */
async function emptyThrough(c: Context, from: string, knownEmpty: string, end: string): Promise<string> {
  const isEmpty = async (to: string) => totalOf(await fetchOrdersPage(c, { field: 'created_at', from, to }, 1)) === 0;
  if (await isEmpty(end)) return end;
  let empty = knownEmpty;
  let busy = end;
  while (daysBetween(empty, busy) > 31) {
    const mid = addDays(empty, Math.floor(daysBetween(empty, busy) / 2));
    if (await isEmpty(mid)) empty = mid; else busy = mid;
  }
  return empty;
}

/** Backfill desde `backfill_next` hasta el día local de la marca de agua. `true` si terminó. */
async function runBackfill(c: Context, run: StartedRun): Promise<boolean> {
  if (run.watermark === null) throw new TiendanubeApiError({ kind: 'desconocido', errorClass: 'unknown' });
  const end = localDay(run.watermark, c.timezone);
  let from = run.backfillNext ?? c.deps.limits.historyStart;
  const { perPage } = c.deps.limits;
  while (from <= end) {
    const monthEnd = minDay(endOfMonth(from), end);
    let to = monthEnd;
    let page = await fetchOrdersPage(c, { field: 'created_at', from, to }, perPage);
    let total = totalOf(page);
    if (total === 0 && monthEnd < end) {
      // Mes vacío: el tramo vacío que sigue se salta en una sola ventana (§3, ventanas sin pedidos).
      to = await emptyThrough(c, from, monthEnd, end);
      page = { body: [], headers: new Headers() };
    }
    for (;;) {
      const verdict = fits(c, total, c.step.pagesLeft());
      if (verdict === 'fits') break;
      if (verdict === 'later') throw new BudgetExhausted();
      if (from === to) throw new WindowTooLarge();
      to = addDays(from, Math.floor(daysBetween(from, to) / 2));
      page = await fetchOrdersPage(c, { field: 'created_at', from, to }, perPage);
      total = totalOf(page);
    }
    const windowTo = to;
    await publishWindow(c, page, (last) => ({ kind: 'backfill', window_from: from, window_to: windowTo, last_page: last }));
    from = addDays(to, 1);
  }
  return true;
}

/** Incremental desde el checkpoint menos 1 hora hasta el inicio del paso. `true` si terminó. */
async function runIncremental(c: Context, run: StartedRun): Promise<boolean> {
  const fromBase = run.incrementalFrom ?? (run.watermark
    ? new Date(run.watermark.getTime() - c.deps.limits.incrementalOverlapMs) : null);
  if (fromBase === null) throw new TiendanubeApiError({ kind: 'desconocido', errorClass: 'unknown' });
  const pending: Array<{ from: Date; to: Date }> = [{ from: fromBase, to: run.startedAt }];
  const { perPage, minIncrementalWindowMs } = c.deps.limits;
  while (pending.length > 0) {
    const range = pending.shift()!;
    const page = await fetchOrdersPage(c, { field: 'updated_at', ...range }, perPage);
    const verdict = fits(c, totalOf(page), c.step.pagesLeft());
    if (verdict === 'later') throw new BudgetExhausted();
    if (verdict === 'split') {
      const span = range.to.getTime() - range.from.getTime();
      if (span <= minIncrementalWindowMs) throw new WindowTooLarge();
      const mid = new Date(range.from.getTime() + Math.floor(span / 2));
      pending.unshift({ from: range.from, to: mid }, { from: mid, to: range.to });
      continue;
    }
    await publishWindow(c, page, (last) => ({ kind: 'incremental', last_page: last }));
  }
  return true;
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

/** Con el presupuesto que queda. Un error transitorio corta el recorrido sin fallar el paso. */
async function runCatalog(c: Context, run: StartedRun): Promise<void> {
  let page = run.catalogNextPage ?? 1;
  let store: ProjectedStore = null;
  try {
    if (page === 1) {
      c.step.reservePage();
      const response = await c.step.call(() => c.http.getJson(c.storeId, 'store', { fields: STORE_SYNC_FIELDS },
        c.token, 'store'));
      store = projectStore(response.body);
    }
    for (;;) {
      c.step.reservePage();
      const response = await c.step.call(() => c.http.getJson(c.storeId, 'products', {
        per_page: String(c.deps.limits.perPage), page: String(page), fields: PRODUCT_FIELDS,
      }, c.token, 'product'));
      if (!Array.isArray(response.body)) throw new TiendanubeProjectionError();
      const byId = new Map<string, ProjectedProduct>();
      const skippedBefore = c.step.skippedProducts;
      for (const raw of response.body) {
        // Un producto sin ID válido se omite y se cuenta: no frena el recorrido. Un pedido
        // inválido, en cambio, falla la página, porque omitirlo perdería ventas sin aviso.
        try {
          const product = projectProduct(raw);
          byId.set(product.id, product);
        } catch {
          c.step.skippedProducts += 1;
        }
      }
      const hasNext = nextLink(response.headers) !== null && response.body.length > 0;
      const nextPage = hasNext ? page + 1 : null;
      await publishCatalog(c.ctx, { ...c.own, products: [...byId.values()], nextPage, store, complete: !hasNext,
        newTraversal: page === 1, hasOmittedProducts: c.step.skippedProducts > skippedBefore },
      { workerApi: c.deps.workerApi() });
      store = null;
      c.step.products += byId.size;
      if (!hasNext) return;
      page += 1;
    }
  } catch (error) {
    if (error instanceof BudgetExhausted) return;
    if (error instanceof TiendanubeApiError && error.errorClass !== null &&
        !['authentication', 'permission', 'user_action'].includes(error.errorClass)) return;
    if (error instanceof TiendanubeApiError && error.errorClass === null) return;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Paso
// ---------------------------------------------------------------------------

const OWNERSHIP_CODES = new Set(['sync_ownership_lost', 'generation_mismatch', 'invalid_transition', 'not_authorized']);

function resultForApiError(error: TiendanubeApiError): TiendanubeSyncResult {
  if (error.kind === 'credencial_invalida' || error.kind === 'permiso_faltante') return 'requiere_reauth';
  if (error.kind === 'tienda_suspendida') return 'tienda_suspendida';
  return 'parcial';
}

/**
 * UN PASO DE SINCRONIZACIÓN DE TIENDANUBE: sigue desde el checkpoint, trae pedidos y productos, les quita
 * los datos personales y los guarda.
 */
export async function syncTiendanube(partial: Partial<TiendanubeSyncDeps> = {}): Promise<TiendanubeSyncResult> {
  const deps = resolveDeps(partial);
  let ctx: TenantContext;
  try { ctx = await deps.tenant(); }
  catch (error) {
    if (error instanceof NoCompanyError) return 'sin_conexion';
    throw error;
  }
  const finish = (resultado: TiendanubeSyncResult, extra: Partial<TiendanubeSyncLogEvent> = {}) => {
    deps.log({ evento: 'tiendanube_sync', resultado, request_id: ctx.request_id, ...extra });
    return resultado;
  };

  let connection: IntegrationConnectionRecord | null;
  try { connection = await deps.readConnection(ctx); }
  catch { return finish('error'); }
  if (!connection || connection.provider !== 'tiendanube') return finish('sin_conexion');
  if (connection.status === 'needs_reauth') return finish('requiere_reauth');
  if (connection.status !== 'active' || connection.external_account_id === null || connection.timezone === null) {
    return finish('sin_conexion');
  }

  let token: SecretValue;
  let http: TiendanubeHttpClient;
  try {
    token = (await readCredential(ctx, connection.id,
      { workerApi: deps.workerApi(), keyring: deps.keyring(), provider: 'tiendanube' })).token;
    http = deps.http(deps.config());
  } catch { return finish('error'); }

  const own: Ownership = { connectionId: connection.id, expectedGeneration: connection.credential_generation,
    runId: deps.randomUUID(), leaseToken: deps.randomUUID() };
  const step = new Step(deps);
  let run: StartedRun;
  try {
    run = await startSync(ctx, { ...own, leaseExpiresAt: new Date(deps.now() + deps.limits.leaseMs) },
      { workerApi: deps.workerApi() });
  } catch (error) {
    if (error instanceof WorkerApiError && error.code === 'sync_in_progress') return finish('en_curso');
    if (error instanceof WorkerApiError && OWNERSHIP_CODES.has(error.code)) return finish('conexion_cambio');
    return finish('error');
  }

  const c: Context = { ctx, deps, http, token, storeId: connection.external_account_id, timezone: connection.timezone,
    own, step };
  const counts = () => ({ fase: run.phase, paginas: step.pages, pedidos: step.orders, ventanas: step.windows,
    productos: step.products, historiales: step.historyCalls, lineas_omitidas: step.skippedLines, productos_omitidos: step.skippedProducts,
    espera_429_ms: step.waited429, duracion_ms: step.elapsed });
  // `started_at` lo fija la base durante `tn_start_sync`: el tiempo local medido desde que la
  // llamada volvió nunca supera el que pasó en la base. Medirlo desde antes de la llamada sumaba
  // su latencia y podía dejar `fetched_at` adelantado al reloj de la base (22023).
  const openedAt = deps.now();
  /** No puede ser anterior al inicio de la ejecución ni posterior al reloj de la base. */
  const fetchedAt = () => new Date(run.startedAt.getTime() + Math.max(0, deps.now() - openedAt - 500));

  try {
    let phaseDone = false;
    try {
      phaseDone = run.phase === 'backfill' ? await runBackfill(c, run) : await runIncremental(c, run);
    } catch (error) {
      if (!(error instanceof BudgetExhausted) && !(error instanceof WindowTooLarge)) throw error;
    }
    await runCatalog(c, run);
    const closed = await finishSync(ctx, { ...own, fetchedAt: fetchedAt(), complete: phaseDone },
      { workerApi: deps.workerApi() });
    const result = phaseDone && run.phase === 'incremental' && closed.status === 'complete' ? 'completa' : 'parcial';
    return finish(result, counts());
  } catch (error) {
    if (error instanceof WorkerApiError && OWNERSHIP_CODES.has(error.code)) {
      return finish('conexion_cambio', counts());
    }
    const apiError = error instanceof TiendanubeApiError ? error
      : new TiendanubeApiError({ kind: 'desconocido', errorClass: 'unknown' });
    const kind = apiError.kind;
    const errorClass = apiError.errorClass ?? 'unknown';
    try {
      await failSync(ctx, { ...own, kind, errorClass }, { workerApi: deps.workerApi() });
    } catch (cause) {
      if (cause instanceof WorkerApiError && OWNERSHIP_CODES.has(cause.code)) {
        return finish('conexion_cambio', counts());
      }
      return finish('error', { ...counts(), tipo_error: kind });
    }
    const result = error instanceof TiendanubeApiError ? resultForApiError(error) : 'error';
    return finish(result, { ...counts(), tipo_error: kind });
  }
}
