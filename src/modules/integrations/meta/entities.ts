import 'server-only';

import { graphUrl } from './api';

/**
 * Metadata de entidades de Meta (M16c, §11 de la ruta).
 *
 * Inventario y ancestros se leen paginando los edges de la cuenta, sin filtrar por estado.
 * Una referencia que el inventario no trae se pide por la raíz de Graph con `ids`: los IDs de
 * campaña, conjunto y anuncio nunca van en la ruta. Lo capturado pertenece a esta captura; no
 * describe el estado de un día medido. Todo es texto de proveedor no confiable.
 */

export const SYNC_LEVELS = ['account', 'campaign', 'adset', 'ad'] as const;
export type SyncLevel = (typeof SYNC_LEVELS)[number];
export type MetadataKind = Exclude<SyncLevel, 'account'>;

/** Hasta 50 por petición (M16c-H-08). */
export const METADATA_IDS_BATCH = 50;
const PAGE_SIZE = '100';
const MAX_CURSOR = 2048;
const ENTITY_ID = /^[0-9]{1,32}$/;
const EVENT_TYPE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

export class InvalidMetaResponseError extends Error {
  constructor() { super('Respuesta de Meta inválida.'); this.name = 'InvalidMetaResponseError'; }
}

export class LevelLimitError extends Error {
  readonly reason: 'page_limit' | 'duration_limit';
  constructor(reason: 'page_limit' | 'duration_limit') {
    super('Se alcanzó un límite de la sincronización.');
    this.name = 'LevelLimitError';
    this.reason = reason;
  }
}

/** Únicas dos representaciones admitidas; conserva los dígitos y no recorta espacios. */
export function normalizeAccountId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (/^act_[0-9]{1,60}$/.test(value)) return value;
  return /^[0-9]{1,60}$/.test(value) ? `act_${value}` : null;
}

export function isEntityId(value: unknown): value is string {
  return typeof value === 'string' && ENTITY_ID.test(value);
}

export type AttributionWindow = { event_type: string; days: number };
export type AttributionSetting = { adset_external_id: string; windows: AttributionWindow[] };
export type Attribution = { known: boolean; report_time: 'impression'; unified: true; settings: AttributionSetting[] };

const UNKNOWN_ATTRIBUTION: Attribution = Object.freeze({ known: false, report_time: 'impression', unified: true, settings: [] }) as Attribution;

export type CapturedEntity = {
  level: SyncLevel;
  external_id: string;
  parent_external_id: string | null;
  name: string | null;
  effective_status: string | null;
  objective: string | null;
  metadata_fetched_at: string;
  attribution: Attribution;
};

type RawEntity = Omit<CapturedEntity, 'level' | 'attribution'> & { windows: AttributionWindow[] | null };

const EDGES: Record<MetadataKind, { path: string; fields: string; parent: string | null }> = {
  campaign: { path: 'campaigns', fields: 'id,name,effective_status,objective', parent: null },
  adset: { path: 'adsets', fields: 'id,name,effective_status,campaign_id,attribution_spec', parent: 'campaign_id' },
  ad: { path: 'ads', fields: 'id,name,effective_status,adset_id', parent: 'adset_id' },
};

function optionalText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > max) throw new InvalidMetaResponseError();
  return value;
}

function attributionWindows(value: unknown): AttributionWindow[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length === 0) throw new InvalidMetaResponseError();
  const windows = value.map((entry) => {
    const record = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry as Record<string, unknown> : {};
    const days = record.window_days;
    if (typeof record.event_type !== 'string' || !EVENT_TYPE.test(record.event_type) ||
        !Number.isInteger(days) || (days as number) < 1 || (days as number) > 365) throw new InvalidMetaResponseError();
    return { event_type: record.event_type, days: days as number };
  });
  const keys = windows.map((window) => `${window.event_type}:${window.days}`);
  if (new Set(keys).size !== keys.length) throw new InvalidMetaResponseError();
  return windows.sort((a, b) => (a.event_type < b.event_type ? -1 : a.event_type > b.event_type ? 1 : a.days - b.days));
}

function parseRaw(kind: MetadataKind, item: unknown, root: string, at: string): RawEntity {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new InvalidMetaResponseError();
  const record = item as Record<string, unknown>;
  if (!isEntityId(record.id)) throw new InvalidMetaResponseError();
  const parentField = EDGES[kind].parent;
  const parent = parentField === null ? root : record[parentField];
  if (parentField !== null && !isEntityId(parent)) throw new InvalidMetaResponseError();
  return {
    external_id: record.id,
    parent_external_id: parent as string,
    name: optionalText(record.name, 1024),
    effective_status: optionalText(record.effective_status, 128),
    objective: kind === 'campaign' ? optionalText(record.objective, 128) : null,
    metadata_fetched_at: at,
    windows: kind === 'adset' ? attributionWindows(record.attribution_spec) : null,
  };
}

/** Lo que el extractor necesita para leer: reintentos, presupuesto y conteo van por fuera. */
export type MetadataReader = {
  accountId: string;
  maxPages: number;
  /** Devuelve el cuerpo y cuenta la llamada. */
  get(url: URL): Promise<unknown>;
  /** Instante de inicio de la petición, acotado por el inicio del run. */
  instant(): string;
  /** Una página con envoltorio de datos recibido. */
  pageReceived(): void;
  /** Una página validada entera; recién entonces se incorpora. */
  pageValidated(): void;
  metadataPages(): number;
};

/**
 * Metadata del run. Cada edge se guarda solo si se consumió entero; otro nivel del mismo run
 * lo reutiliza conservando su instante. Nunca sobrevive de un run a otro.
 */
export class MetadataStore {
  private readonly entries: Record<MetadataKind, Map<string, RawEntity>> = { campaign: new Map(), adset: new Map(), ad: new Map() };
  private readonly loaded = new Set<MetadataKind>();

  all(kind: MetadataKind): RawEntity[] { return [...this.entries[kind].values()]; }
  get(kind: MetadataKind, id: string): RawEntity | undefined { return this.entries[kind].get(id); }
  put(kind: MetadataKind, entity: RawEntity): void { this.entries[kind].set(entity.external_id, entity); }

  async loadEdge(kind: MetadataKind, reader: MetadataReader): Promise<void> {
    if (this.loaded.has(kind)) return;
    const seen = new Set<string>();
    let after: string | undefined;
    for (;;) {
      if (reader.metadataPages() >= reader.maxPages) throw new LevelLimitError('page_limit');
      const at = reader.instant();
      const body = await reader.get(graphUrl(`${reader.accountId}/${EDGES[kind].path}`,
        { fields: EDGES[kind].fields, limit: PAGE_SIZE, ...(after === undefined ? {} : { after }) }));
      const { data, next } = pageOf(body, seen);
      reader.pageReceived();
      const parsed = data.map((item) => parseRaw(kind, item, reader.accountId, at));
      assertNoDuplicates(parsed);
      reader.pageValidated();
      for (const entity of parsed) this.put(kind, entity);
      if (next.done) break;
      if (reader.metadataPages() >= reader.maxPages) throw new LevelLimitError('page_limit');
      after = next.after;
    }
    this.loaded.add(kind);
  }

  async loadMissing(kind: MetadataKind, ids: readonly string[], reader: MetadataReader): Promise<void> {
    const missing = [...new Set(ids)].filter((id) => !this.entries[kind].has(id));
    for (let start = 0; start < missing.length; start += METADATA_IDS_BATCH) {
      if (reader.metadataPages() >= reader.maxPages) throw new LevelLimitError('page_limit');
      const batch = missing.slice(start, start + METADATA_IDS_BATCH);
      const at = reader.instant();
      const body = await reader.get(graphUrl('', { ids: batch.join(','), fields: EDGES[kind].fields }));
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InvalidMetaResponseError();
      reader.pageReceived();
      const record = body as Record<string, unknown>;
      const parsed = batch.map((id) => {
        const entity = parseRaw(kind, record[id], reader.accountId, at);
        if (entity.external_id !== id) throw new InvalidMetaResponseError();
        return entity;
      });
      reader.pageValidated();
      for (const entity of parsed) this.put(kind, entity);
    }
  }

  private settings(adsets: RawEntity[]): Attribution {
    if (adsets.length === 0 || adsets.some((adset) => adset.windows === null)) return UNKNOWN_ATTRIBUTION;
    const settings = adsets.map((adset) => ({ adset_external_id: adset.external_id, windows: adset.windows! }))
      .sort((a, b) => (a.adset_external_id < b.adset_external_id ? -1 : 1));
    return { known: true, report_time: 'impression', unified: true, settings };
  }

  /**
   * Propia en el conjunto, heredada en el anuncio; en los ancestros, el conjunto completo. Con
   * el edge de conjuntos sin consumir entero, ese conjunto no se puede acreditar.
   */
  attributionFor(level: SyncLevel, entity: { external_id: string; parent_external_id: string | null } | null): Attribution {
    if (level === 'account' || level === 'campaign') {
      if (!this.loaded.has('adset')) return UNKNOWN_ATTRIBUTION;
      const adsets = this.all('adset');
      return this.settings(level === 'account' ? adsets : adsets.filter((adset) => adset.parent_external_id === entity!.external_id));
    }
    const adsetId = level === 'adset' ? entity!.external_id : entity!.parent_external_id!;
    const adset = this.get('adset', adsetId);
    return adset ? this.settings([adset]) : UNKNOWN_ATTRIBUTION;
  }

  captured(kind: MetadataKind, raw: RawEntity): CapturedEntity {
    return { level: kind, external_id: raw.external_id, parent_external_id: raw.parent_external_id, name: raw.name,
      effective_status: raw.effective_status, objective: raw.objective, metadata_fetched_at: raw.metadata_fetched_at,
      attribution: this.attributionFor(kind, raw) };
  }
}

function assertNoDuplicates(entities: RawEntity[]): void {
  if (new Set(entities.map((entity) => entity.external_id)).size !== entities.length) throw new InvalidMetaResponseError();
}

/**
 * Envoltorio de una página. `paging.next` solo indica que hay más y se descarta: la petición
 * siguiente se reconstruye con `after`, una cadena no vacía, acotada y sin repetir.
 */
export function pageOf(body: unknown, seen: Set<string>):
{ data: unknown[]; next: { done: true } | { done: false; after: string } } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InvalidMetaResponseError();
  const response = body as Record<string, unknown>;
  if (!Array.isArray(response.data)) throw new InvalidMetaResponseError();
  const paging = response.paging && typeof response.paging === 'object' && !Array.isArray(response.paging)
    ? response.paging as Record<string, unknown> : null;
  if (!paging || !Object.hasOwn(paging, 'next')) return { data: response.data, next: { done: true } };
  const cursors = paging.cursors && typeof paging.cursors === 'object' && !Array.isArray(paging.cursors)
    ? paging.cursors as Record<string, unknown> : null;
  const after = cursors?.after;
  if (typeof after !== 'string' || after.length === 0 || after.length > MAX_CURSOR || seen.has(after)) {
    throw new InvalidMetaResponseError();
  }
  seen.add(after);
  return { data: response.data, next: { done: false, after } };
}
