import 'server-only';

import { randomBytes, randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { UnauthorizedError } from '@/modules/identity/session';
import type { IntegrationConnectionRecord, IntegrationErrorClass } from '@/modules/integrations/contract';
import { isoDateTimeSchema, uuidSchema } from '@/modules/integrations/contract/primitives';
import { requireTenantContext, type TenantContext } from '@/modules/tenant/context';
import { getCredentialKeyring, type CredentialKeyring } from '../crypto/keyring';
import type { SecretValue } from '../crypto/seal';
import { getWorkerApi, WorkerApiError, type WorkerApi } from '../db/worker-api';
import { readConnectionRecord } from '../repository/connections';
import { CredentialChangedError, readCredential } from '../repository/credentials';
import { failSyncRun, publishSnapshot, startSyncRun, type SyncLimits } from '../repository/sync-calls';
import { graphUrl } from './api';
import { createMetaHttpClient, META_HTTP_TIMEOUT_MS, type MetaHttpClient } from './client';
import { InvalidMetaResponseError, isEntityId, LevelLimitError, MetadataStore, normalizeAccountId, pageOf, SYNC_LEVELS,
  type CapturedEntity, type MetadataKind, type MetadataReader, type SyncLevel } from './entities';
import { connectionEffectFor, MetaApiError } from './errors';

/**
 * Sincronización manual de Insights (M16c, §11 de la ruta).
 *
 * Las métricas viajan como `string | null` desde Graph hasta TypeScript: solo los contadores
 * técnicos y las duraciones son `number` (CA-44b). Ausente o null es `no_informado`; un valor
 * presente mal formado invalida la página entera y deja incompleto el nivel. No se suman
 * jerarquías, ventanas de atribución ni tasas.
 */

export type { SyncLevel } from './entities';

/** Mismo patrón que SQL (`meta_valid_decimal`): pgTAP 13 prueba el mismo conjunto. */
export const DECIMAL_PATTERN = /^[0-9]+([.][0-9]+)?$/;
const COUNT_PATTERN = /^[0-9]+$/;
const ACTION_TYPE = /^[A-Za-z0-9._]{1,128}$/;
const VARIANT = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const MAX_NUMERIC_TEXT = 128;
const BIGINT_MAX = BigInt('9223372036854775807');
const PAGE_SIZE = '100';

const DECIMAL_METRICS = ['spend', 'ctr', 'cpc', 'cpm', 'frequency'] as const;
const COUNT_METRICS = ['impressions', 'reach', 'clicks', 'inline_link_clicks'] as const;
export const INSIGHT_FIELDS = ['spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks', 'ctr', 'cpc', 'cpm',
  'frequency', 'actions', 'action_values'] as const;

export type DecimalText = string;
export type InsightAction = { action_type: string; variant: string; count: DecimalText | null; value: DecimalText | null };
export type InsightDay = { date: string; level: SyncLevel; external_id: string;
  spend: DecimalText | null; impressions: string | null; reach: string | null; clicks: string | null;
  inline_link_clicks: string | null; ctr: DecimalText | null; cpc: DecimalText | null; cpm: DecimalText | null;
  frequency: DecimalText | null; actions: InsightAction[] };
export type SyncWindow = { from: string; to: string };
export type LevelReason = 'complete' | 'page_limit' | 'duration_limit' | 'invalid_response' | 'meta_error' | 'own_error';
export type LevelExtraction = { level: SyncLevel; entities: CapturedEntity[]; days: InsightDay[]; pages: number;
  validatedPages: number; calls: number; fetchedAt: string; durationMs: number; complete: boolean;
  errorClass: IntegrationErrorClass | null; reason: LevelReason };

function decimal(value: unknown): DecimalText | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > MAX_NUMERIC_TEXT || !DECIMAL_PATTERN.test(value)) throw new InvalidMetaResponseError();
  return value;
}

function count(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > MAX_NUMERIC_TEXT || !COUNT_PATTERN.test(value) ||
      BigInt(value) > BIGINT_MAX) throw new InvalidMetaResponseError();
  return value;
}

type ActionSide = 'count' | 'value';

/** Une conteo y valor por tipo y variante, sin crear ceros para el lado ausente. */
function collectActions(source: unknown, side: ActionSide, into: Map<string, InsightAction>): void {
  if (source === undefined || source === null) return;
  if (!Array.isArray(source)) throw new InvalidMetaResponseError();
  const types = new Set<string>();
  for (const entry of source) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new InvalidMetaResponseError();
    const record = entry as Record<string, unknown>;
    const type = record.action_type;
    if (typeof type !== 'string' || !ACTION_TYPE.test(type) || types.has(type)) throw new InvalidMetaResponseError();
    types.add(type);
    let variants = 0;
    for (const [key, raw] of Object.entries(record)) {
      if (key === 'action_type') continue;
      // `value` es el agregado informado y se valida siempre. Otra clave es una variante de
      // atribución si cumple el contrato; lo demás es un campo extra y se proyecta fuera.
      if (key !== 'value' && !(VARIANT.test(key) && typeof raw === 'string' && DECIMAL_PATTERN.test(raw))) continue;
      const text = decimal(raw);
      if (text === null) throw new InvalidMetaResponseError();
      const id = `${type}\u0000${key}`;
      const action = into.get(id) ?? { action_type: type, variant: key, count: null, value: null };
      action[side] = text;
      into.set(id, action);
      variants += 1;
    }
    if (variants === 0) throw new InvalidMetaResponseError();
  }
}

export function parseInsightRow(raw: unknown, level: SyncLevel, root: string, window: SyncWindow): InsightDay {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new InvalidMetaResponseError();
  const record = raw as Record<string, unknown>;
  const date = record.date_start;
  if (typeof date !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) || date !== record.date_stop ||
      Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || date < window.from || date > window.to) throw new InvalidMetaResponseError();

  const account = record.account_id;
  if (account !== undefined && account !== null && normalizeAccountId(account) !== root) throw new InvalidMetaResponseError();
  if (level === 'account' && (account === undefined || account === null)) throw new InvalidMetaResponseError();
  const id = level === 'account' ? root : record[`${level}_id`];
  if (level !== 'account' && !isEntityId(id)) throw new InvalidMetaResponseError();

  const actions = new Map<string, InsightAction>();
  collectActions(record.actions, 'count', actions);
  collectActions(record.action_values, 'value', actions);
  const day = { date, level, external_id: id as string } as InsightDay;
  for (const metric of DECIMAL_METRICS) day[metric] = decimal(record[metric]);
  for (const metric of COUNT_METRICS) day[metric] = count(record[metric]);
  day.actions = [...actions.values()].sort((a, b) => {
    const left = `${a.action_type}\u0000${a.variant}`;
    const right = `${b.action_type}\u0000${b.variant}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
  return day;
}

/** Fecha de hoy en la zona de la cuenta, incluido el día abierto (CA-43b). Calendario, no instantes. */
export function localSyncWindow(now: Date, timezone: string, lookbackDays: number): SyncWindow {
  const to = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - (lookbackDays - 1) * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}

// ---------------------------------------------------------------------------
// Extracción de un nivel
// ---------------------------------------------------------------------------

export class ConnectionChangedDuringSync extends Error {
  constructor() { super('La conexión cambió durante la sincronización.'); this.name = 'ConnectionChangedDuringSync'; }
}

export type ExtractDeps = {
  http: (timeoutMs: number) => MetaHttpClient;
  monotonicNow: () => number;
  wallNow: () => Date;
  sleep: (ms: number) => Promise<void>;
  /** `started_at` que devolvió `start_sync_run`: límite inferior de todo instante de captura. */
  startedAt: Date;
  /** Fin del presupuesto global, en el reloj monotónico. */
  deadline: number;
  /** Se ejecuta antes de cada llamada nueva a Meta; corta si la conexión cambió. */
  beforeCall: () => Promise<void>;
  metadata?: MetadataStore;
};

const LEVEL_KINDS: Record<SyncLevel, readonly MetadataKind[]> = {
  account: ['adset'], campaign: ['campaign', 'adset'], adset: ['campaign', 'adset'], ad: ['campaign', 'adset', 'ad'],
};
const PARENT_KIND: Partial<Record<MetadataKind, MetadataKind>> = { adset: 'campaign', ad: 'adset' };

/** jsonb agrega espacios al serializar, y SQL mide ese texto: se deja un margen. */
function payloadFits(entities: CapturedEntity[], days: InsightDay[], limits: SyncLimits): boolean {
  return Buffer.byteLength(JSON.stringify({ entities, days })) * 1.25 <= limits.maxPayloadBytes;
}

export async function extractMetaLevel(
  level: SyncLevel,
  token: SecretValue,
  accountId: string,
  window: SyncWindow,
  limits: SyncLimits,
  deps: ExtractDeps,
): Promise<LevelExtraction> {
  const started = deps.monotonicNow();
  const store = deps.metadata ?? new MetadataStore();
  const instant = () => new Date(Math.max(deps.wallNow().getTime(), deps.startedAt.getTime())).toISOString();
  // Congelado antes de la primera petición del nivel: páginas y reintentos no lo mueven.
  const fetchedAt = instant();
  let pages = 0;
  let validatedPages = 0;
  let metadataPages = 0;
  let calls = 0;
  let countingMetadata = false;
  let rootName: string | null = null;
  const days = new Map<string, InsightDay>();

  async function get(url: URL): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      await deps.beforeCall();
      const available = deps.deadline - deps.monotonicNow() - limits.finalizationReserveMs;
      if (available <= 0) throw new LevelLimitError('duration_limit');
      calls += 1;
      try {
        return await deps.http(Math.min(META_HTTP_TIMEOUT_MS, available)).getJson(url, { bearer: token });
      } catch (error) {
        if (!(error instanceof MetaApiError) || (error.errorClass !== 'temporary' && error.errorClass !== 'transport') ||
            attempt >= limits.maxRetries) throw error;
        const wait = limits.retryDelayMs * (attempt + 1);
        // Un reintento que no cabe no se espera: queda el error clasificado.
        const left = deps.deadline - deps.monotonicNow() - limits.finalizationReserveMs;
        if (wait >= left) throw error;
        await deps.sleep(wait);
      }
    }
  }

  const reader: MetadataReader = { accountId, maxPages: limits.maxMetadataPages, get, instant,
    pageReceived: () => { pages += 1; if (countingMetadata) metadataPages += 1; },
    pageValidated: () => { validatedPages += 1; },
    metadataPages: () => metadataPages };

  /** Solo entidades con toda su cadena hasta la raíz, y filas con metadata en el payload. */
  function closure(): { entities: CapturedEntity[]; days: InsightDay[] } {
    const entities: CapturedEntity[] = [];
    const kept = new Set<string>();
    const keep = (kind: MetadataKind, id: string): boolean => {
      const raw = store.get(kind, id);
      if (!raw) return false;
      const key = `${kind}:${id}`;
      if (kept.has(key)) return true;
      const parentKind = PARENT_KIND[kind];
      if (parentKind && !keep(parentKind, raw.parent_external_id!)) return false;
      kept.add(key);
      entities.push(store.captured(kind, raw));
      return true;
    };
    if (level !== 'account') for (const raw of store.all(level)) keep(level, raw.external_id);
    const rows = [...days.values()].filter((day) => level === 'account' || keep(level, day.external_id));
    const hasRoot = level === 'account' ? rows.length > 0 || store.all('adset').length > 0 : entities.length > 0;
    if (hasRoot) {
      entities.push({ level: 'account', external_id: accountId, parent_external_id: null, name: rootName,
        effective_status: null, objective: null, metadata_fetched_at: fetchedAt, attribution: store.attributionFor('account', null) });
    }
    const rank = (entity: CapturedEntity) => SYNC_LEVELS.indexOf(entity.level);
    entities.sort((a, b) => rank(a) - rank(b) || (a.external_id < b.external_id ? -1 : 1));
    return { entities, days: rows };
  }

  function finish(complete: boolean, errorClass: IntegrationErrorClass | null, reason: LevelReason): LevelExtraction {
    let built = closure();
    // Sin página válida no hay nada que conservar; un acumulado que excede los límites se
    // descarta entero, porque SQL lo rechazaría (spec, clasificación de snapshot y fallo).
    if (validatedPages === 0 || (!complete && (built.entities.length > limits.maxEntities || !payloadFits(built.entities, built.days, limits)))) {
      built = { entities: [], days: [] };
    }
    return { level, entities: built.entities, days: built.days, pages, validatedPages, calls, fetchedAt,
      durationMs: Math.max(0, Math.round(deps.monotonicNow() - started)), complete, errorClass, reason };
  }

  try {
    countingMetadata = true;
    for (const kind of LEVEL_KINDS[level]) await store.loadEdge(kind, reader);
    countingMetadata = false;

    const seen = new Set<string>();
    let after: string | undefined;
    let insightPages = 0;
    for (;;) {
      if (insightPages >= limits.maxPagesPerLevel) throw new LevelLimitError('page_limit');
      const body = await get(graphUrl(`${accountId}/insights`, { level, time_increment: '1',
        fields: ['date_start', 'date_stop', 'account_id', 'account_name',
          ...(level === 'account' ? [] : [`${level}_id`, `${level}_name`]), ...INSIGHT_FIELDS].join(','),
        time_range: JSON.stringify({ since: window.from, until: window.to }),
        action_report_time: 'impression', use_unified_attribution_setting: 'true', limit: PAGE_SIZE,
        ...(after === undefined ? {} : { after }) }));
      const { data, next } = pageOf(body, seen);
      pages += 1;
      insightPages += 1;
      // La página se valida entera antes de acumular: de una inválida no queda ninguna fila.
      const parsed = data.map((item) => parseInsightRow(item, level, accountId, window));
      const keys = parsed.map((day) => `${day.external_id}\u0000${day.date}`);
      if (new Set(keys).size !== keys.length || keys.some((key) => days.has(key))) throw new InvalidMetaResponseError();
      validatedPages += 1;
      parsed.forEach((day, index) => days.set(keys[index], day));
      for (const item of data) {
        const name = (item as Record<string, unknown>).account_name;
        if (rootName === null && typeof name === 'string' && name.length <= 1024) rootName = name;
      }
      if (next.done) break;
      if (insightPages >= limits.maxPagesPerLevel) throw new LevelLimitError('page_limit');
      after = next.after;
    }

    // Referencias que el inventario no trajo, de abajo hacia arriba.
    countingMetadata = true;
    if (level !== 'account') await store.loadMissing(level, [...days.values()].map((day) => day.external_id), reader);
    // Solo la cadena de este nivel: account y campaign usan los conjuntos para la atribución,
    // no para capturar sus padres.
    for (const kind of level === 'ad' ? ['ad', 'adset'] as const : level === 'adset' ? ['adset'] as const : []) {
      await store.loadMissing(PARENT_KIND[kind]!, store.all(kind).map((raw) => raw.parent_external_id!), reader);
    }
    countingMetadata = false;

    const built = closure();
    if (built.entities.length > limits.maxEntities || !payloadFits(built.entities, built.days, limits)) {
      throw new LevelLimitError('page_limit');
    }
    return finish(true, null, 'complete');
  } catch (error) {
    if (error instanceof ConnectionChangedDuringSync) throw error;
    if (error instanceof MetaApiError) return finish(false, error.errorClass, 'meta_error');
    if (error instanceof LevelLimitError) return finish(false, 'own_error', error.reason);
    if (error instanceof InvalidMetaResponseError) return finish(false, 'own_error', 'invalid_response');
    return finish(false, 'own_error', 'own_error');
  }
}

// ---------------------------------------------------------------------------
// Orquestación
// ---------------------------------------------------------------------------

/**
 * Q-04 (D-M16c-02): perfil único y su justificación en `M16c/spec.md`. Son cotas técnicas
 * contra los 300 s efectivos de Vercel, no volúmenes medidos. Las pruebas inyectan los suyos.
 */
export const DEFAULT_SYNC_LIMITS: SyncLimits = { lookbackDays: 28, maxWindowDays: 28, maxPagesPerLevel: 20, maxMetadataPages: 20,
  maxEntities: 500, maxPayloadBytes: 2_000_000, maxDurationMs: 240_000, finalizationReserveMs: 55_000, leaseSeconds: 295,
  maxRetries: 2, retryDelayMs: 500 };

export const META_SYNC_RESULTS = ['completa', 'parcial', 'incompleta', 'en_curso', 'requiere_reauth', 'conexion_cambio', 'error',
  'no_confirmada'] as const;
export type SyncResult = (typeof META_SYNC_RESULTS)[number];
export type SyncOutcome = Readonly<{ result: SyncResult }>;

/** Texto fijo por resultado: en la UI no se muestra ningún texto externo ni de `worker_api`. */
export const META_SYNC_MESSAGES: Readonly<Record<SyncResult, Readonly<{ tone: 'ok' | 'info' | 'error'; text: string }>>> = Object.freeze({
  completa: { tone: 'ok', text: 'Sincronización completa.' },
  parcial: { tone: 'info', text: 'Algunos niveles se actualizaron. Revisá la cobertura.' },
  incompleta: { tone: 'error', text: 'La sincronización quedó incompleta. Conservamos la cobertura anterior.' },
  en_curso: { tone: 'info', text: 'Ya hay una sincronización en curso.' },
  requiere_reauth: { tone: 'error', text: 'Meta pidió volver a autorizar a Praxa. La sincronización se detuvo; revisá la cobertura y volvé a autorizar.' },
  conexion_cambio: { tone: 'error', text: 'La conexión cambió durante la sincronización. Revisá su estado.' },
  error: { tone: 'error', text: 'No pudimos sincronizar. Probá de nuevo más tarde.' },
  no_confirmada: { tone: 'error', text: 'No pudimos confirmar el resultado de la sincronización. Revisá la cobertura antes de volver a sincronizar.' },
});

/** Ante la duda, `null`: un valor repetido, vacío o desconocido no muestra nada. */
export function parseMetaSyncResult(value: string | string[] | undefined): SyncResult | null {
  return typeof value === 'string' && (META_SYNC_RESULTS as readonly string[]).includes(value) ? value as SyncResult : null;
}

const RESULT_PRECEDENCE: readonly SyncResult[] = ['requiere_reauth', 'conexion_cambio', 'no_confirmada', 'en_curso'];

/** Si un caso encaja en varios resultados, gana esta precedencia; después, el estado del run. */
export function pickSyncResult(candidates: readonly SyncResult[]): SyncResult {
  return RESULT_PRECEDENCE.find((result) => candidates.includes(result)) ?? candidates[0];
}

/** La query no acredita un éxito: `completa` y `parcial` se muestran solo si el estado persistido coincide. */
export function syncNotice(result: SyncResult | null, effective: MetaSyncStatus['effective_status'] | null) {
  if (result === null) return null;
  if (result === 'completa' && effective !== 'completed') return null;
  if (result === 'parcial' && effective !== 'partial') return null;
  return META_SYNC_MESSAGES[result];
}

export type MetaSyncLogEvent = {
  evento: 'meta_sync';
  level?: SyncLevel;
  resultado: 'completo' | 'incompleto' | 'fallido' | SyncResult;
  clase?: IntegrationErrorClass;
  request_id: string;
  filas?: number;
  campos?: string[];
  paginas?: number;
  llamadas?: number;
  completa?: boolean;
  duracion_ms?: number;
  motivo?: LevelReason;
};

export type SyncDeps = {
  tenant: () => Promise<TenantContext>;
  readConnection: (ctx: TenantContext) => Promise<IntegrationConnectionRecord | null>;
  workerApi: () => WorkerApi;
  keyring: () => CredentialKeyring;
  http: (timeoutMs: number) => MetaHttpClient;
  monotonicNow: () => number;
  wallNow: () => Date;
  sleep: (ms: number) => Promise<void>;
  log: (event: MetaSyncLogEvent) => void;
  limits: SyncLimits;
};

function resolveDeps(partial: Partial<SyncDeps> = {}): SyncDeps {
  return {
    tenant: partial.tenant ?? requireTenantContext,
    readConnection: partial.readConnection ?? readConnectionRecord,
    workerApi: partial.workerApi ?? getWorkerApi,
    keyring: partial.keyring ?? getCredentialKeyring,
    http: partial.http ?? ((timeoutMs) => createMetaHttpClient({ timeoutMs })),
    monotonicNow: partial.monotonicNow ?? (() => performance.now()),
    wallNow: partial.wallNow ?? (() => new Date()),
    sleep: partial.sleep ?? ((ms) => new Promise((resolve) => { setTimeout(resolve, ms); })),
    log: partial.log ?? ((event) => console.info(JSON.stringify(event))),
    limits: partial.limits ?? DEFAULT_SYNC_LIMITS,
  };
}

/** Mensajes fijos por razón: nunca texto de Meta (spec, clasificación de snapshot y fallo). */
const FAILURE_MESSAGES: Record<Exclude<LevelReason, 'complete' | 'meta_error'>, string> = {
  page_limit: 'La sincronización alcanzó un límite de páginas o de tamaño.',
  duration_limit: 'La sincronización alcanzó su límite de duración.',
  invalid_response: 'Meta devolvió una respuesta inválida.',
  own_error: 'Error interno de la sincronización.',
};

function isAmbiguous(error: unknown): boolean {
  return error instanceof WorkerApiError && error.code === 'unavailable' &&
    (error.failureKind === 'transport' || error.failureKind === 'timeout');
}

/** Cómo se presenta un error de base después de iniciar el run (spec, tabla de resultados). */
export function outcomeForWriteError(error: unknown): SyncResult {
  if (isAmbiguous(error)) return 'no_confirmada';
  if (error instanceof WorkerApiError &&
      (error.code === 'not_authorized' || error.code === 'invalid_transition' || error.code === 'generation_mismatch')) {
    return 'conexion_cambio';
  }
  return 'incompleta';
}

function overallResult(complete: number): SyncResult {
  return complete === SYNC_LEVELS.length ? 'completa' : complete > 0 ? 'parcial' : 'incompleta';
}

export async function syncMetaInsights(partial: Partial<SyncDeps> = {}): Promise<SyncOutcome> {
  const deps = resolveDeps(partial);
  // El presupuesto incluye todo lo que corre desde la entrada, también las lecturas previas.
  const deadline = deps.monotonicNow() + deps.limits.maxDurationMs;
  let ctx: TenantContext;
  try { ctx = await deps.tenant(); }
  catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    return { result: 'error' };
  }

  const finish = (result: SyncResult): SyncOutcome => {
    deps.log({ evento: 'meta_sync', resultado: result, request_id: ctx.request_id });
    return { result };
  };

  let connection: IntegrationConnectionRecord | null;
  try { connection = await deps.readConnection(ctx); }
  catch { return finish('error'); }
  if (!connection || connection.status !== 'active') return finish('error');

  const accountId = normalizeAccountId(connection.external_account_id);
  if (accountId === null || accountId !== connection.external_account_id) return finish('error');

  const { id: connectionId, credential_generation: generation } = connection;
  const workerApi = deps.workerApi();
  const window = localSyncWindow(deps.wallNow(), connection.timezone, deps.limits.lookbackDays);
  const runId = randomUUID();
  const ownershipToken = randomBytes(32).toString('hex');
  const ownership = { connectionId, expectedGeneration: generation, runId, ownershipToken };

  /** Un único reintento idéntico si la escritura quedó ambigua; nunca otra extracción. */
  async function confirmed<Result>(write: () => Promise<Result>): Promise<Result> {
    try { return await write(); }
    catch (error) {
      if (!isAmbiguous(error) || deps.monotonicNow() >= deadline) throw error;
      return write();
    }
  }

  let startedAt: Date;
  try {
    const startInput = { ...ownership, windowFrom: window.from, windowTo: window.to, limits: deps.limits };
    ({ startedAt } = await confirmed(() => startSyncRun(ctx, startInput, { workerApi })));
  } catch (error) {
    return finish(error instanceof WorkerApiError && error.code === 'sync_in_progress' ? 'en_curso' : 'error');
  }

  const beforeCall = async () => {
    // Una lectura caída no prueba un cambio: sube como error propio del nivel.
    const current = await deps.readConnection(ctx);
    if (!current || current.id !== connectionId || current.status !== 'active' || current.credential_generation !== generation) {
      throw new ConnectionChangedDuringSync();
    }
  };

  /** Registra un fallo del nivel con posesión. Devuelve el resultado final si hay que parar. */
  async function failLevel(input: { level: SyncLevel; fetchedAt: string; pages: number; durationMs: number;
    payload: { entities: CapturedEntity[]; days: InsightDay[] }; validatedPages: number; reason: Exclude<LevelReason, 'complete'>;
    errorClass: IntegrationErrorClass; message: string; stop: boolean }): Promise<SyncResult | null> {
    const failure = { ...ownership, snapshotId: randomUUID(), level: input.level, fetchedAt: input.fetchedAt, pages: input.pages,
      durationMs: input.durationMs, payload: input.payload, validatedPages: input.validatedPages, failureReason: input.reason,
      errorClass: input.errorClass, errorMessage: input.message, stopRemaining: input.stop };
    try {
      await confirmed(() => failSyncRun(ctx, failure, { workerApi }));
    } catch (error) {
      return outcomeForWriteError(error);
    }
    return null;
  }

  const firstInstant = () => new Date(Math.max(deps.wallNow().getTime(), startedAt.getTime())).toISOString();

  let token: SecretValue;
  try {
    const credential = await readCredential(ctx, connectionId, { workerApi, keyring: deps.keyring() });
    if (credential.status !== 'active' || credential.credentialGeneration !== generation) return finish('conexion_cambio');
    token = credential.token;
  } catch (error) {
    if (error instanceof CredentialChangedError) return finish('conexion_cambio');
    const outcome = outcomeForWriteError(error);
    if (outcome === 'conexion_cambio') return finish(outcome);
    const stopped = await failLevel({ level: 'account', fetchedAt: firstInstant(), pages: 0, durationMs: 0,
      payload: { entities: [], days: [] }, validatedPages: 0, reason: 'own_error', errorClass: 'own_error',
      message: FAILURE_MESSAGES.own_error, stop: true });
    return finish(pickSyncResult(stopped ? [stopped, 'incompleta'] : ['incompleta']));
  }

  const metadata = new MetadataStore();
  let completed = 0;
  for (const level of SYNC_LEVELS) {
    let extraction: LevelExtraction;
    try {
      extraction = await extractMetaLevel(level, token, accountId, window, deps.limits, { http: deps.http,
        monotonicNow: deps.monotonicNow, wallNow: deps.wallNow, sleep: deps.sleep, startedAt, deadline, beforeCall, metadata });
    } catch {
      return finish('conexion_cambio');
    }

    deps.log({ evento: 'meta_sync', level, resultado: extraction.complete ? 'completo' : extraction.validatedPages > 0 ? 'incompleto' : 'fallido',
      ...(extraction.errorClass ? { clase: extraction.errorClass } : {}), request_id: ctx.request_id, filas: extraction.days.length,
      campos: [...DECIMAL_METRICS, ...COUNT_METRICS].filter((field) => extraction.days.some((day) => day[field] !== null)),
      paginas: extraction.pages, llamadas: extraction.calls, completa: extraction.complete,
      duracion_ms: extraction.durationMs, motivo: extraction.reason });

    const payload = { entities: extraction.entities, days: extraction.days };
    if (extraction.complete) {
      const snapshot = { ...ownership, snapshotId: randomUUID(), level, fetchedAt: extraction.fetchedAt, pages: extraction.pages,
        durationMs: extraction.durationMs, payload };
      try {
        await confirmed(() => publishSnapshot(ctx, snapshot, { workerApi }));
        completed += 1;
      } catch (error) {
        if (!(error instanceof WorkerApiError && error.code === 'invalid_argument')) return finish(outcomeForWriteError(error));
        // SQL rechazó lo publicado: puede ser el reloj o un dato. No se corrige el contenido ni
        // se repite. Se registra sin filas y se detiene, porque los siguientes fallarían igual.
        const stopped = await failLevel({ level, fetchedAt: extraction.fetchedAt, pages: extraction.pages,
          durationMs: extraction.durationMs, payload: { entities: [], days: [] }, validatedPages: 0, reason: 'own_error',
          errorClass: 'own_error', message: FAILURE_MESSAGES.own_error, stop: true });
        return finish(pickSyncResult(stopped ? [stopped, overallResult(completed)] : [overallResult(completed)]));
      }
      continue;
    }

    const errorClass = extraction.errorClass ?? 'own_error';
    const reauth = connectionEffectFor(errorClass) === 'needs_reauth';
    const stop = extraction.reason === 'duration_limit' || errorClass === 'rate_limit' || reauth;
    const reason = extraction.reason as Exclude<LevelReason, 'complete'>;
    const failed = await failLevel({ level, fetchedAt: extraction.fetchedAt, pages: extraction.pages, durationMs: extraction.durationMs,
      payload, validatedPages: extraction.validatedPages, reason, errorClass,
      message: reason === 'meta_error' ? new MetaApiError({ errorClass, graphCode: null, graphSubcode: null }).redactedMessage : FAILURE_MESSAGES[reason],
      stop });
    if (failed) return finish(failed);
    if (reauth) return finish('requiere_reauth');
    if (stop) return finish(overallResult(completed));
  }
  return finish(overallResult(completed));
}

// ---------------------------------------------------------------------------
// Lecturas con JWT
// ---------------------------------------------------------------------------

export class MetaSyncReadError extends Error {
  constructor() { super('No se pudo leer la sincronización.'); this.name = 'MetaSyncReadError'; }
}

const levelSummarySchema = z.strictObject({
  status: z.enum(['pending', 'complete', 'incomplete', 'failed', 'not_attempted']),
  reason: z.enum(['complete', 'page_limit', 'duration_limit', 'invalid_response', 'meta_error', 'own_error']).nullable(),
  fetched_at: isoDateTimeSchema.nullable(),
  finished_at: isoDateTimeSchema.nullable(),
});

const syncSummarySchema = z.strictObject({
  version: z.literal(1),
  credential_generation: z.number().int().min(0),
  window_from: z.iso.date(),
  window_to: z.iso.date(),
  max_window_days: z.number().int().positive(),
  started_at: isoDateTimeSchema,
  lease_expires_at: isoDateTimeSchema,
  finished_at: isoDateTimeSchema.nullable(),
  status: z.enum(['running', 'completed', 'partial', 'failed']),
  levels: z.strictObject({ account: levelSummarySchema, campaign: levelSummarySchema, adset: levelSummarySchema, ad: levelSummarySchema }),
});

const syncStatusSchema = z.strictObject({
  has_attempt: z.boolean(),
  summary: syncSummarySchema.nullable(),
  effective_status: z.enum(['never', 'running', 'completed', 'partial', 'failed', 'expired', 'connection_changed']),
  connection_changed: z.boolean(),
});
export type MetaSyncStatus = z.infer<typeof syncStatusSchema>;

const decimalText = z.string().regex(DECIMAL_PATTERN).nullable();
const levelSchema = z.enum(SYNC_LEVELS);
const attributionSchema = z.strictObject({
  known: z.boolean(),
  report_time: z.literal('impression'),
  unified: z.literal(true),
  settings: z.array(z.strictObject({
    adset_ref: uuidSchema,
    windows: z.array(z.strictObject({ event_type: z.string(), days: z.number().int().positive() })),
  })),
});

const coverageRowSchema = z.strictObject({
  day: z.iso.date(),
  level: levelSchema,
  entity_ref: uuidSchema.nullable(),
  parent_ref: uuidSchema.nullable(),
  name: z.string().nullable(),
  effective_status: z.string().nullable(),
  objective: z.string().nullable(),
  metadata_fetched_at: isoDateTimeSchema.nullable(),
  presence: z.enum(['no_observado', 'sin_fila_reportada', 'con_datos']),
  spend: decimalText, impressions: decimalText, reach: decimalText, clicks: decimalText, inline_link_clicks: decimalText,
  ctr: decimalText, cpc: decimalText, cpm: decimalText, frequency: decimalText,
  actions: z.array(z.strictObject({ action_type: z.string(), variant: z.string(), count: decimalText, value: decimalText })).nullable(),
  attribution: attributionSchema.nullable(),
  currency: z.string().nullable(),
  timezone: z.string().nullable(),
  snapshot_id: uuidSchema.nullable(),
  fetched_at: isoDateTimeSchema.nullable(),
  captured_before_day_end: z.boolean().nullable(),
  temporal_status: z.enum(['abierto', 'cerrado']),
});
export type MetaCoverageRow = z.infer<typeof coverageRowSchema>;

const capturedEntitySchema = z.strictObject({
  entity_ref: uuidSchema,
  level: levelSchema,
  parent_ref: uuidSchema.nullable(),
  name: z.string().nullable(),
  effective_status: z.string().nullable(),
  objective: z.string().nullable(),
  metadata_fetched_at: isoDateTimeSchema,
  captured_at: isoDateTimeSchema,
});
export type MetaCapturedEntity = z.infer<typeof capturedEntitySchema>;

type ReadDeps = { supabase?: SupabaseClient };

async function rpcRows<Schema extends z.ZodType>(fn: string, args: Record<string, unknown>, schema: Schema, deps: ReadDeps):
Promise<z.output<Schema>[]> {
  const supabase = deps.supabase ?? (await createSupabaseServerClient());
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new MetaSyncReadError();
  const parsed = z.array(schema).safeParse(data);
  if (!parsed.success) throw new MetaSyncReadError();
  return parsed.data;
}

/**
 * Una RPC devuelve como mucho el máximo de filas de la Data API, sin error ni aviso. Se pide hasta
 * agotar el total que informa la base, con el orden estable de cada función. Una lectura que no
 * llega a ese total falla: nunca se muestra recortada como si estuviera completa (CA-46). La cota
 * cubre `maxEntities` por 28 días de Q-04.
 */
const READ_PAGE_SIZE = 1000;
const MAX_READ_ROWS = 20_000;

async function rpcAllRows<Schema extends z.ZodType>(fn: string, args: Record<string, unknown>, schema: Schema, deps: ReadDeps):
Promise<z.output<Schema>[]> {
  const supabase = deps.supabase ?? (await createSupabaseServerClient());
  const rows: z.output<Schema>[] = [];
  let total: number | null = null;
  for (;;) {
    const { data, error, count } = await supabase.rpc(fn, args, { count: 'exact' }).range(rows.length, rows.length + READ_PAGE_SIZE - 1);
    if (error || count === null || count > MAX_READ_ROWS || (total !== null && count !== total)) throw new MetaSyncReadError();
    const parsed = z.array(schema).safeParse(data);
    if (!parsed.success) throw new MetaSyncReadError();
    total = count;
    rows.push(...parsed.data);
    if (rows.length === total) return rows;
    if (parsed.data.length === 0 || rows.length > total) throw new MetaSyncReadError();
  }
}

/** Null cuando la conexión no es visible o no está active ni needs_reauth. */
export async function readMetaSyncStatus(connectionId: string, deps: ReadDeps = {}): Promise<MetaSyncStatus | null> {
  const rows = await rpcRows('get_meta_sync_status', { p_connection_id: connectionId }, syncStatusSchema, deps);
  return rows[0] ?? null;
}

export function readMetaDailyCoverage(
  input: { connectionId: string; level: SyncLevel; from: string; to: string; entityRef?: string },
  deps: ReadDeps = {},
): Promise<MetaCoverageRow[]> {
  return rpcAllRows('get_meta_daily_coverage', { p_connection_id: input.connectionId, p_level: input.level, p_from: input.from,
    p_to: input.to, ...(input.entityRef ? { p_entity_ref: input.entityRef } : {}) }, coverageRowSchema, deps);
}

export function listCapturedEntities(connectionId: string, level: SyncLevel, deps: ReadDeps = {}): Promise<MetaCapturedEntity[]> {
  return rpcAllRows('list_meta_entities', { p_connection_id: connectionId, p_level: level }, capturedEntitySchema, deps);
}

export type MetaSyncView = {
  connectionStatus: 'active' | 'needs_reauth';
  canSync: boolean;
  status: MetaSyncStatus;
  level: SyncLevel;
  entityRef: string | null;
  entities: MetaCapturedEntity[];
  coverage: MetaCoverageRow[];
};

/**
 * Vista de la página, con JWT y RLS. Nivel y entidad se validan acá: una referencia que no
 * figura entre las entidades visibles de esa conexión se descarta. Null sin conexión legible.
 */
export async function loadMetaSyncView(
  query: { nivel?: string | string[]; entidad?: string | string[] },
  partial: Partial<Pick<SyncDeps, 'tenant' | 'readConnection'>> & ReadDeps = {},
): Promise<MetaSyncView | null> {
  const ctx = await (partial.tenant ?? requireTenantContext)();
  const connection = await (partial.readConnection ?? readConnectionRecord)(ctx);
  if (!connection || (connection.status !== 'active' && connection.status !== 'needs_reauth')) return null;
  const status = await readMetaSyncStatus(connection.id, partial);
  if (!status) return null;
  const level = levelSchema.safeParse(query.nivel).data ?? 'account';
  const entities = await listCapturedEntities(connection.id, level, partial);
  const entityRef = entities.find((entity) => entity.entity_ref === query.entidad)?.entity_ref ?? null;
  const coverage = status.summary === null ? [] : await readMetaDailyCoverage({ connectionId: connection.id, level,
    from: status.summary.window_from, to: status.summary.window_to, ...(entityRef ? { entityRef } : {}) }, partial);
  return { connectionStatus: connection.status, canSync: connection.status === 'active', status, level, entityRef, entities, coverage };
}
