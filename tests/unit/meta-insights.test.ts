import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { parseCredentialKeyring } from '@/modules/integrations/crypto/keyring';
import { SecretValue, sealCredential } from '@/modules/integrations/crypto/seal';
import { WorkerApiError, type WorkerApi } from '@/modules/integrations/db/worker-api';
import { createMetaHttpClient, META_HTTP_TIMEOUT_MS, type MetaFetch } from '@/modules/integrations/meta/client';
import type { SyncLevel } from '@/modules/integrations/meta/entities';
import { MetadataStore, normalizeAccountId } from '@/modules/integrations/meta/entities';
import { DECIMAL_PATTERN, DEFAULT_SYNC_LIMITS, extractMetaLevel, listCapturedEntities, loadMetaSyncView, localSyncWindow, META_SYNC_MESSAGES,
  META_SYNC_RESULTS, MetaSyncReadError, outcomeForWriteError, parseInsightRow, parseMetaSyncResult, pickSyncResult, syncMetaInsights, syncNotice,
  type ExtractDeps, type LevelExtraction, type SyncDeps } from '@/modules/integrations/meta/insights';
import type { IntegrationConnectionRecord } from '@/modules/integrations/contract';
import type { SyncLimits } from '@/modules/integrations/repository/sync-calls';
import type { TenantContext } from '@/modules/tenant/context';

const ROOT = 'act_1001';
const WINDOW = { from: '2026-10-01', to: '2026-10-03' };
const TOKEN = new SecretValue('token-sint');
const LIMITS: SyncLimits = { lookbackDays: 3, maxWindowDays: 28, maxPagesPerLevel: 3, maxMetadataPages: 3,
  maxEntities: 50, maxPayloadBytes: 200_000, maxDurationMs: 100_000, finalizationReserveMs: 10_000,
  leaseSeconds: 110, maxRetries: 2, retryDelayMs: 500 };
const STARTED = new Date('2026-10-03T12:00:00.000Z');

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const graphError = (code: number, subcode?: number) => json({ error: { code, error_subcode: subcode } }, 400);
const row = (level: SyncLevel, id: string, date: string, extra: Record<string, unknown> = {}) => ({
  date_start: date, date_stop: date, account_id: '1001', account_name: 'Cuenta sint',
  ...(level === 'account' ? {} : { [`${level}_id`]: id }), ...extra });

type Route = (url: URL, call: number) => Response | Promise<Response>;

/** Meta simulada: por defecto, todo edge vacío. Registra URLs y timeouts de cada petición. */
function meta(routes: Record<string, Route> = {}) {
  const seen: URL[] = [];
  const timeouts: number[] = [];
  const counts = new Map<string, number>();
  const fetch: MetaFetch = async (url) => {
    seen.push(url);
    const key = url.pathname.replace('/v26.0/', '');
    const call = counts.get(key) ?? 0;
    counts.set(key, call + 1);
    const route = routes[key];
    return route ? route(url, call) : json({ data: [] });
  };
  return { seen, timeouts, http: (timeoutMs: number) => { timeouts.push(timeoutMs); return createMetaHttpClient({ fetch, timeoutMs }); } };
}

function extractDeps(graph: ReturnType<typeof meta>, over: Partial<ExtractDeps> = {}): ExtractDeps {
  let clock = 0;
  return { http: graph.http, monotonicNow: () => clock, wallNow: () => new Date('2026-10-03T12:00:01.000Z'),
    sleep: async (ms) => { clock += ms; }, startedAt: STARTED, deadline: LIMITS.maxDurationMs, beforeCall: async () => {},
    ...over };
}

const extract = (level: SyncLevel, graph: ReturnType<typeof meta>, over: Partial<ExtractDeps> = {}, limits = LIMITS) =>
  extractMetaLevel(level, TOKEN, ROOT, WINDOW, limits, extractDeps(graph, over));

const insights = (level: SyncLevel, rows: unknown[]) => ({ [`${ROOT}/insights`]: () => json({ data: rows }) });

describe('M16c-T-14: patrón decimal y métricas', () => {
  const parse = (metrics: Record<string, unknown>) =>
    parseInsightRow(row('account', '', '2026-10-01', metrics), 'account', ROOT, WINDOW);

  it('acepta las cadenas sintéticas y conserva sus dígitos', () => {
    for (const value of ['0', '12.34', '00.50']) expect(parse({ spend: value }).spend).toBe(value);
    expect(parse({ impressions: '9007199254740993' }).impressions).toBe('9007199254740993');
    expect(DECIMAL_PATTERN.source).toBe('^[0-9]+([.][0-9]+)?$');
  });

  it.each(['', '12x34', '12\\34', '1.', '.5', '-1', '+1', ' 1', '1 ', '1e5', 'NaN', 'Infinity', '1'.repeat(129)])(
    'rechaza %j', (value) => { expect(() => parse({ spend: value })).toThrow(); });

  it('rechaza número JSON, decimal en conteo base y desborde de bigint', () => {
    expect(() => parse({ spend: 1.5 })).toThrow();
    expect(() => parse({ impressions: '1.5' })).toThrow();
    expect(() => parse({ impressions: '9223372036854775808' })).toThrow();
    expect(parse({ impressions: '9223372036854775807' }).impressions).toBe('9223372036854775807');
  });

  it('distingue ausente y null de cero explícito', () => {
    const parsed = parse({ spend: '0', reach: null });
    expect(parsed).toMatchObject({ spend: '0', reach: null, clicks: null });
  });
});

describe('M16c-T-36: normalización de la cuenta', () => {
  it('acepta exactamente las dos representaciones y conserva los dígitos', () => {
    expect(normalizeAccountId('act_001')).toBe('act_001');
    expect(normalizeAccountId('001')).toBe('act_001');
    expect(normalizeAccountId(`act_${'7'.repeat(60)}`)).toBe(`act_${'7'.repeat(60)}`);
    expect(normalizeAccountId('7'.repeat(60))).toBe(`act_${'7'.repeat(60)}`);
  });

  it.each(['act_act_1', ' act_1', 'act_1 ', '1 ', 'act_', '', 'act_1a', 7, null, `act_${'7'.repeat(61)}`])(
    'rechaza %j', (value) => { expect(normalizeAccountId(value)).toBeNull(); });

  it('un account_id devuelto distinto de la raíz invalida la fila; act_ como conjunto también', () => {
    expect(() => parseInsightRow({ ...row('account', '', '2026-10-01'), account_id: '999' }, 'account', ROOT, WINDOW)).toThrow();
    expect(parseInsightRow(row('account', '', '2026-10-01'), 'account', ROOT, WINDOW).external_id).toBe(ROOT);
    expect(() => parseInsightRow(row('adset', ROOT, '2026-10-01'), 'adset', ROOT, WINDOW)).toThrow();
  });
});

describe('M16c-T-30: acciones y variantes', () => {
  const parse = (extra: Record<string, unknown>) =>
    parseInsightRow(row('account', '', '2026-10-01', extra), 'account', ROOT, WINDOW);

  it('conserva un tipo desconocido, separa variantes y une conteo con valor sin crear ceros', () => {
    const parsed = parse({
      actions: [{ action_type: 'tipo.desconocido_1', value: '1.5', click_window: '0.5', campo_extra: 'texto' }],
      action_values: [{ action_type: 'tipo.desconocido_1', value: '2.75' }, { action_type: 'purchase', value: '9' }],
    });
    expect(parsed.actions).toEqual([
      { action_type: 'purchase', variant: 'value', count: null, value: '9' },
      { action_type: 'tipo.desconocido_1', variant: 'click_window', count: '0.5', value: null },
      { action_type: 'tipo.desconocido_1', variant: 'value', count: '1.5', value: '2.75' },
    ]);
  });

  it('una clave fuera del patrón se proyecta fuera', () => {
    expect(parse({ actions: [{ action_type: 'purchase', value: '1', '7d_click': '1' }] }).actions).toHaveLength(1);
  });

  it('rechaza duplicados del mismo arreglo, tipos mal formados y valores numéricos', () => {
    expect(() => parse({ actions: [{ action_type: 'a', value: '1' }, { action_type: 'a', value: '2' }] })).toThrow();
    expect(() => parse({ actions: [{ action_type: 'con espacio', value: '1' }] })).toThrow();
    expect(() => parse({ actions: [{ action_type: 'a', value: 1 }] })).toThrow();
    expect(() => parse({ actions: 'no' })).toThrow();
    expect(() => parse({ actions: [{ value: '1' }] })).toThrow();
    expect(() => parse({ actions: [{ action_type: 'a' }] })).toThrow();
  });
});

describe('M16c-T-16: ventana local', () => {
  it('usa 28 fechas de calendario en la zona de la cuenta, con hoy incluido', () => {
    expect(localSyncWindow(new Date('2026-10-03T02:00:00Z'), 'America/Argentina/Buenos_Aires', 28))
      .toEqual({ from: '2026-09-05', to: '2026-10-02' });
    expect(localSyncWindow(new Date('2026-10-03T02:00:00Z'), 'UTC', 28)).toEqual({ from: '2026-09-06', to: '2026-10-03' });
  });

  it('cruza DST sin restar 24 horas a un instante', () => {
    expect(localSyncWindow(new Date('2026-03-08T12:00:00Z'), 'America/New_York', 2)).toEqual({ from: '2026-03-07', to: '2026-03-08' });
    expect(localSyncWindow(new Date('2026-11-01T12:00:00Z'), 'America/New_York', 2)).toEqual({ from: '2026-10-31', to: '2026-11-01' });
    expect(localSyncWindow(new Date('2026-03-09T04:30:00Z'), 'America/New_York', 1)).toEqual({ from: '2026-03-09', to: '2026-03-09' });
  });

  it.each(['account', 'campaign', 'adset', 'ad'] as const)('pide %s con los parámetros exactos, sin date_preset ni breakdown', async (level) => {
    const graph = meta();
    await extract(level, graph);
    const url = graph.seen.find((entry) => entry.pathname.endsWith('/insights'))!;
    const params = Object.fromEntries(url.searchParams);
    expect(params).toMatchObject({ level, time_increment: '1', action_report_time: 'impression',
      use_unified_attribution_setting: 'true', time_range: JSON.stringify({ since: WINDOW.from, until: WINDOW.to }) });
    expect(params).not.toHaveProperty('date_preset');
    expect(params).not.toHaveProperty('breakdowns');
    expect(params.fields.split(',')).toEqual(expect.arrayContaining(['spend', 'impressions', 'reach', 'clicks',
      'inline_link_clicks', 'ctr', 'cpc', 'cpm', 'frequency', 'actions', 'action_values', 'date_start', 'date_stop']));
    if (level !== 'account') expect(params.fields.split(',')).toEqual(expect.arrayContaining([`${level}_id`, `${level}_name`]));
  });
});

describe('M16c-T-12 y T-17: metadata, jerarquía y cuatro niveles', () => {
  const inventory: Record<string, Route> = {
    [`${ROOT}/campaigns`]: () => json({ data: [{ id: '10', name: 'Campaña', effective_status: 'PAUSED', objective: 'OUTCOME_SALES' }] }),
    [`${ROOT}/adsets`]: () => json({ data: [{ id: '20', name: 'Conjunto', effective_status: 'ACTIVE', campaign_id: '10',
      attribution_spec: [{ event_type: 'VIEW_THROUGH', window_days: 1 }, { event_type: 'CLICK_THROUGH', window_days: 7 }] }] }),
    [`${ROOT}/ads`]: () => json({ data: [{ id: '30', name: 'Anuncio', effective_status: 'DELETED', adset_id: '20' }] }),
  };

  it('construye la jerarquía con ancestros, sin filtrar activos', async () => {
    const graph = meta({ ...inventory, ...insights('ad', [row('ad', '30', '2026-10-01', { spend: '1.00' })]) });
    const result = await extract('ad', graph);
    expect(result).toMatchObject({ complete: true, reason: 'complete', errorClass: null });
    expect(result.entities.map((entity) => [entity.level, entity.external_id, entity.parent_external_id])).toEqual([
      ['account', ROOT, null], ['campaign', '10', ROOT], ['adset', '20', '10'], ['ad', '30', '20']]);
    expect(result.entities.find((entity) => entity.level === 'ad')?.effective_status).toBe('DELETED');
    for (const url of graph.seen) expect(url.searchParams.has('filtering')).toBe(false);
  });

  it('propaga la atribución efectiva: propia, heredada y como conjunto en los ancestros', async () => {
    const result = await extract('ad', meta(inventory));
    const settings = [{ adset_external_id: '20', windows: [{ event_type: 'CLICK_THROUGH', days: 7 }, { event_type: 'VIEW_THROUGH', days: 1 }] }];
    for (const entity of result.entities) {
      expect(entity.attribution).toEqual({ known: true, report_time: 'impression', unified: true, settings });
    }
  });

  it('sin configuración acreditable declara known=false y no inventa ventanas', async () => {
    const graph = meta({ [`${ROOT}/adsets`]: () => json({ data: [{ id: '20', name: 'C', campaign_id: '10' }] }),
      [`${ROOT}/campaigns`]: inventory[`${ROOT}/campaigns`] });
    const result = await extract('adset', graph);
    expect(result.complete).toBe(true);
    for (const entity of result.entities) expect(entity.attribution).toEqual({ known: false, report_time: 'impression', unified: true, settings: [] });
  });

  it('un cambio de nombre o estado se captura en cada corrida, sin atribuirlo al día medido', async () => {
    const first = await extract('campaign', meta(inventory));
    const second = await extract('campaign', meta({ [`${ROOT}/campaigns`]: () => json({ data: [{ id: '10', name: 'Otro', effective_status: 'ACTIVE' }] }) }));
    expect(first.entities[1]).toMatchObject({ name: 'Campaña', effective_status: 'PAUSED', objective: 'OUTCOME_SALES' });
    expect(second.entities[1]).toMatchObject({ name: 'Otro', effective_status: 'ACTIVE', objective: null });
    expect(first.days).toEqual([]);
  });

  it('una referencia fuera del inventario se pide por la raíz con ids, sin ID en la ruta', async () => {
    const graph = meta({ ...insights('adset', [row('adset', '21', '2026-10-01')]),
      '': (url) => {
        const ids = url.searchParams.get('ids')!.split(',');
        if (ids.includes('21')) return json({ 21: { id: '21', name: 'Viejo', effective_status: 'ARCHIVED', campaign_id: '11' } });
        return json({ 11: { id: '11', name: 'Camp vieja', effective_status: 'ARCHIVED' } });
      } });
    const result = await extract('adset', graph, {}, { ...LIMITS, maxMetadataPages: 5 });
    expect(result.complete).toBe(true);
    expect(result.entities.map((entity) => entity.external_id)).toEqual([ROOT, '11', '21']);
    for (const url of graph.seen) expect(url.pathname).not.toMatch(/\/(11|21)(\/|$)/);
  });

  it('el nivel account no pide por ids los padres de los conjuntos que usa para la atribución', async () => {
    const graph = meta({ [`${ROOT}/adsets`]: () => json({ data: [{ id: '20', name: 'C', campaign_id: '10',
      attribution_spec: [{ event_type: 'CLICK_THROUGH', window_days: 7 }] }] }) });
    const result = await extract('account', graph);
    expect(result.complete).toBe(true);
    expect(graph.seen.some((url) => url.searchParams.has('ids'))).toBe(false);
    expect(result.entities.map((entity) => entity.external_id)).toEqual([ROOT]);
    expect(result.entities[0].attribution.known).toBe(true);
  });

  it('un edge de conjuntos a medias no acredita la atribución de un ancestro', async () => {
    const graph = meta({ [`${ROOT}/insights`]: () => json({ data: [] }),
      [`${ROOT}/adsets`]: (_url, call) => call === 0
        ? json({ data: [{ id: '20', campaign_id: '10', attribution_spec: [{ event_type: 'CLICK_THROUGH', window_days: 7 }] }],
          paging: { next: 'x', cursors: { after: 'c1' } } })
        : graphError(100) });
    const result = await extract('account', graph);
    expect(result).toMatchObject({ complete: false, reason: 'meta_error', validatedPages: 1 });
    expect(result.entities.map((entity) => entity.attribution.known)).toEqual([false]);
  });

  it('agrupa las referencias faltantes de a 50', async () => {
    const rows = Array.from({ length: 51 }, (_, index) => row('campaign', String(100 + index), '2026-10-01'));
    const batches: number[] = [];
    const graph = meta({ ...insights('campaign', rows), '': (url) => {
      const ids = url.searchParams.get('ids')!.split(',');
      batches.push(ids.length);
      return json(Object.fromEntries(ids.map((id) => [id, { id, name: 'N' }])));
    } });
    const result = await extract('campaign', graph, {}, { ...LIMITS, maxEntities: 60, maxMetadataPages: 5 });
    expect(batches).toEqual([50, 1]);
    expect(result.complete).toBe(true);
  });

  it.each([
    ['metadata faltante', { ...insights('campaign', [row('campaign', '10', '2026-10-01')]), '': () => json({}) }],
    ['metadata 404', { ...insights('campaign', [row('campaign', '10', '2026-10-01')]), '': () => graphError(803) }],
    ['día duplicado entre páginas', { [`${ROOT}/campaigns`]: inventory[`${ROOT}/campaigns`],
      [`${ROOT}/insights`]: (_url: URL, call: number) => json({ data: [row('campaign', '10', '2026-10-01')],
        ...(call === 0 ? { paging: { next: 'https://graph.facebook.com/x', cursors: { after: 'c1' } } } : {}) }) }],
    ['fecha abierta en dos días', insights('campaign', [{ ...row('campaign', '10', '2026-10-01'), date_stop: '2026-10-02' }])],
    ['fecha fuera de la ventana', insights('campaign', [row('campaign', '10', '2026-09-01')])],
    ['padre ausente', { [`${ROOT}/adsets`]: () => json({ data: [{ id: '20', name: 'C' }] }) }],
    ['objetivo mal tipado', { [`${ROOT}/campaigns`]: () => json({ data: [{ id: '10', objective: 7 }] }) }],
    ['atribución malformada', { [`${ROOT}/adsets`]: () => json({ data: [{ id: '20', campaign_id: '10', attribution_spec: [{ event_type: 'X', window_days: 0 }] }] }) }],
  ] as [string, Record<string, Route>][])('%s deja el nivel incompleto', async (_label, routes) => {
    const level = _label === 'padre ausente' || _label === 'atribución malformada' ? 'adset' : 'campaign';
    const result = await extract(level, meta(routes));
    expect(result.complete).toBe(false);
    expect(result.reason).not.toBe('complete');
  });

  it.each([['idéntica', 'Primera'], ['distinta', 'Segunda']])('metadata %s repetida entre páginas deja el nivel incompleto', async (_label, name) => {
    const graph = meta({ [`${ROOT}/campaigns`]: (_url, call) => call === 0
      ? json({ data: [{ id: '10', name: 'Primera' }], paging: { next: 'x', cursors: { after: 'c1' } } })
      : json({ data: [{ id: '10', name }] }) });
    expect(await extract('campaign', graph)).toMatchObject({ complete: false, reason: 'invalid_response', errorClass: 'own_error' });
  });

  it('releer en otro nivel un edge que falló a medias no cuenta como repetición', async () => {
    const adset = (id: string) => ({ id, campaign_id: '10', name: 'C' });
    const graph = meta({ [`${ROOT}/campaigns`]: () => json({ data: [{ id: '10', name: 'N' }] }),
      [`${ROOT}/adsets`]: (_url, call) => {
        if (call === 0 || call === 2) return json({ data: [adset('20')], paging: { next: 'x', cursors: { after: `c${call}` } } });
        return call === 1 ? json({ data: [{ id: 7 }] }) : json({ data: [adset('21')] });
      } });
    const metadata = new MetadataStore();
    expect(await extract('account', graph, { metadata })).toMatchObject({ complete: false, reason: 'invalid_response' });
    expect(await extract('campaign', graph, { metadata })).toMatchObject({ complete: true, reason: 'complete' });
  });

  it('una respuesta vacía completa sin inventar entidades', async () => {
    for (const level of ['account', 'campaign', 'adset', 'ad'] as const) {
      expect(await extract(level, meta())).toMatchObject({ complete: true, entities: [], days: [] });
    }
  });

  it('de una página inválida no se conserva ninguna fila; los acumulados válidos sí', async () => {
    const graph = meta({ [`${ROOT}/campaigns`]: inventory[`${ROOT}/campaigns`],
      [`${ROOT}/insights`]: (_url, call) => call === 0
        ? json({ data: [row('campaign', '10', '2026-10-01', { spend: '1' })], paging: { next: 'x', cursors: { after: 'c1' } } })
        : json({ data: [row('campaign', '10', '2026-10-02', { spend: '2' }), row('campaign', '10', '2026-10-03', { spend: 'mal' })] }) });
    const result = await extract('campaign', graph);
    expect(result).toMatchObject({ complete: false, reason: 'invalid_response', errorClass: 'own_error' });
    expect(result.days.map((day) => day.date)).toEqual(['2026-10-01']);
    expect(result.pages).toBe(4);
    expect(result.validatedPages).toBe(3);
  });
});

describe('M16c-T-18: paginación', () => {
  const page = (rows: unknown[], after?: unknown, next: unknown = 'https://evil.test/next?access_token=x') =>
    json({ data: rows, paging: { next, cursors: { after } } });

  it('reconstruye cada petición y descarta paging.next', async () => {
    const graph = meta({ [`${ROOT}/insights`]: (_url, call) => call === 0 ? page([row('account', '', '2026-10-01')], 'cursor-1')
      : json({ data: [row('account', '', '2026-10-02')] }) });
    const result = await extract('account', graph);
    expect(result.complete).toBe(true);
    const urls = graph.seen.filter((url) => url.pathname.endsWith('/insights'));
    expect(urls).toHaveLength(2);
    expect(urls[1].origin).toBe('https://graph.facebook.com');
    expect(urls[1].searchParams.get('after')).toBe('cursor-1');
    for (const url of graph.seen) expect(url.href).not.toContain('evil.test');
    expect(JSON.stringify(result)).not.toContain('cursor-1');
  });

  it.each([['ausente', undefined], ['vacío', ''], ['demasiado largo', 'x'.repeat(2049)], ['numérico', 7]])(
    'after %s deja el nivel incompleto', async (_label, after) => {
      const result = await extract('account', meta({ [`${ROOT}/insights`]: () => page([], after) }));
      expect(result).toMatchObject({ complete: false, reason: 'invalid_response' });
    });

  it('un after repetido deja el nivel incompleto', async () => {
    const result = await extract('account', meta({ [`${ROOT}/insights`]: () => page([], 'igual') }));
    expect(result).toMatchObject({ complete: false, reason: 'invalid_response' });
  });

  it('el tope sin siguiente completa y con siguiente deja incompleto', async () => {
    const limits = { ...LIMITS, maxPagesPerLevel: 2 };
    const pages = (lastHasNext: boolean): Route => (_url, call) => call === 0 || lastHasNext
      ? page([], `c${call}`) : json({ data: [] });
    expect((await extract('account', meta({ [`${ROOT}/insights`]: pages(false) }), {}, limits)).complete).toBe(true);
    expect(await extract('account', meta({ [`${ROOT}/insights`]: pages(true) }), {}, limits))
      .toMatchObject({ complete: false, reason: 'page_limit', errorClass: 'own_error' });
  });

  it('el tope de metadata y el de entidades también dejan incompleto', async () => {
    const limits = { ...LIMITS, maxMetadataPages: 1 };
    expect(await extract('campaign', meta({ [`${ROOT}/campaigns`]: () => page([], 'c1') }), {}, limits))
      .toMatchObject({ complete: false, reason: 'page_limit' });
    const many = { [`${ROOT}/campaigns`]: () => json({ data: Array.from({ length: 5 }, (_, i) => ({ id: String(i + 1), name: 'N' })) }) };
    expect(await extract('campaign', meta(many), {}, { ...LIMITS, maxEntities: 2 }))
      .toMatchObject({ complete: false, reason: 'page_limit', entities: [], days: [] });
  });
});

describe('M16c-T-19 y T-20: reintentos y presupuesto', () => {
  it('temporary y transporte reintentan dos veces con espera de 500 y 1000 ms', async () => {
    for (const failure of [() => graphError(2), () => new Response('{', { status: 200 })]) {
      const sleeps: number[] = [];
      const graph = meta({ [`${ROOT}/insights`]: (_url, call) => call < 2 ? failure() : json({ data: [] }) });
      const result = await extract('account', graph, { sleep: async (ms) => { sleeps.push(ms); } });
      expect(result.complete).toBe(true);
      expect(sleeps).toEqual([500, 1000]);
      expect(result.pages).toBe(2);
      expect(result.calls).toBe(4);
    }
  });

  it('agotados los reintentos queda meta_error con su clase', async () => {
    const result = await extract('account', meta({ [`${ROOT}/insights`]: () => graphError(2) }));
    expect(result).toMatchObject({ complete: false, reason: 'meta_error', errorClass: 'temporary', calls: 4 });
  });

  it.each([[4, 'rate_limit'], [190, 'authentication'], [100, 'own_error'], [999, 'unknown']])(
    'el código %i (%s) no reintenta', async (code, errorClass) => {
      const graph = meta({ [`${ROOT}/insights`]: () => graphError(code) });
      const result = await extract('account', graph);
      expect(result).toMatchObject({ complete: false, reason: 'meta_error', errorClass });
      expect(graph.seen.filter((url) => url.pathname.endsWith('/insights'))).toHaveLength(1);
    });

  it('recorta el timeout al presupuesto menos la reserva y sin presupuesto no llama', async () => {
    const graph = meta();
    let clock = 80_000;
    const limits = { ...LIMITS, maxDurationMs: 100_000, finalizationReserveMs: 15_000 };
    await extract('account', graph, { monotonicNow: () => clock, deadline: 100_000 }, limits);
    expect(graph.timeouts[0]).toBe(5_000);
    const roomy = meta();
    clock = 0;
    await extract('account', roomy, { monotonicNow: () => clock, deadline: 100_000 }, limits);
    expect(roomy.timeouts[0]).toBe(META_HTTP_TIMEOUT_MS);
    const spent = meta();
    clock = 85_000;
    const result = await extract('account', spent, { monotonicNow: () => clock, deadline: 100_000 }, limits);
    expect(spent.seen).toEqual([]);
    expect(result).toMatchObject({ complete: false, reason: 'duration_limit', errorClass: 'own_error' });
  });

  it('un reintento que no cabe en el presupuesto no se espera', async () => {
    const sleeps: number[] = [];
    let clock = 89_700;
    const graph = meta({ [`${ROOT}/insights`]: () => graphError(2) });
    const result = await extract('account', graph, { monotonicNow: () => clock, deadline: 100_000,
      sleep: async (ms) => { sleeps.push(ms); clock += ms; } });
    expect(sleeps).toEqual([]);
    expect(result).toMatchObject({ reason: 'meta_error', errorClass: 'temporary' });
  });

  it('el fetch lento y el consumo lento del cuerpo se cortan con el mismo presupuesto', async () => {
    const slowFetch: MetaFetch = (_url, init) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('abort')));
    });
    const slowBody: MetaFetch = async (_url, init) => new Response(new ReadableStream({ start(controller) {
      init.signal?.addEventListener('abort', () => controller.error(new Error('abort')));
    } }));
    for (const fetch of [slowFetch, slowBody]) {
      const started = performance.now();
      const limits = { ...LIMITS, maxDurationMs: 300, finalizationReserveMs: 100, maxRetries: 0 };
      const result = await extractMetaLevel('account', TOKEN, ROOT, WINDOW, limits, {
        http: (timeoutMs) => createMetaHttpClient({ fetch, timeoutMs }), monotonicNow: () => performance.now(),
        wallNow: () => new Date('2026-10-03T12:00:01.000Z'), sleep: async () => {}, startedAt: STARTED,
        deadline: performance.now() + 300, beforeCall: async () => {},
      });
      expect(result).toMatchObject({ complete: false, reason: 'meta_error', errorClass: 'transport' });
      expect(performance.now() - started).toBeLessThan(2_000);
    }
  });
});

describe('M16c-T-37: instante de captura por nivel', () => {
  it('congela fetched_at aunque las páginas y reintentos crucen medianoche', async () => {
    let now = new Date('2026-10-03T23:59:59.000Z');
    const graph = meta({ [`${ROOT}/insights`]: (_url, call) => {
      now = new Date('2026-10-04T00:00:05.000Z');
      return call === 0 ? json({ data: [], paging: { next: 'x', cursors: { after: 'c1' } } }) : json({ data: [] });
    } });
    const result = await extract('account', graph, { wallNow: () => now });
    expect(result.fetchedAt).toBe('2026-10-03T23:59:59.000Z');
  });

  it('con el reloj local atrasado toma started_at', async () => {
    const result = await extract('account', meta(), { wallNow: () => new Date('2026-10-03T11:00:00.000Z') });
    expect(result.fetchedAt).toBe(STARTED.toISOString());
  });
});

// ---------------------------------------------------------------------------
// Orquestación con repositorio real y base simulada
// ---------------------------------------------------------------------------

const CTX: TenantContext = { user_id: '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d', company_id: '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f',
  role: 'owner', request_id: '7c6b5a49-3827-4165-a4b3-c2d1e0f9a8b7' };
const CONNECTION_ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
const keyring = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');

function connectionRecord(over: Partial<Record<string, unknown>> = {}): IntegrationConnectionRecord {
  return { id: CONNECTION_ID, company_id: CTX.company_id, provider: 'meta', client_business_id: 'negocio_sint',
    credential_generation: 0, current_sync_run_id: null, last_error_class: null, last_error_message: null,
    created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z', status: 'active',
    external_account_id: ROOT, currency: 'USD', timezone: 'UTC', pending_expires_at: null, purge_requested_at: null,
    ...over } as IntegrationConnectionRecord;
}

function fakeDb(handlers: Partial<Record<string, (args: readonly unknown[]) => unknown>> = {}) {
  const calls: Array<{ fn: string; args: readonly unknown[] }> = [];
  const failed = new Set<string>();
  const workerApi: WorkerApi = { call: (async (fn: string, args: readonly unknown[]) => {
    calls.push({ fn, args });
    if (handlers[fn]) return handlers[fn]!(args);
    if (fn === 'start_sync_run') return [{ run_id: args[4], credential_generation: 0, started_at: new Date('2026-10-03T12:00:00.000Z'),
      lease_expires_at: new Date('2026-10-03T12:01:00.000Z') }];
    if (fn === 'get_credential') return [{ connection_id: CONNECTION_ID, company_id: CTX.company_id, provider: 'meta', status: 'active',
      credential_generation: 0, ...sealCredential('token-sint', { company_id: CTX.company_id, connection_id: CONNECTION_ID, provider: 'meta' }, keyring),
      token_type: 'system_user', issued_for_app_id: 'app_sint', granted_scopes: ['ads_read'], expires_at: null }];
    if (fn === 'publish_snapshot') return [{ snapshot_id: args[6], level: args[7], complete: true }];
    if (fn === 'fail_sync_run') { failed.add(String(args[7]));
      return [{ run_id: args[4], level: args[7], status: 'running', snapshot_result: Number(args[12]) > 0 ? 'incomplete' : 'failed' }]; }
    throw new Error(`inesperada ${fn}`);
  }) as WorkerApi['call'] };
  return { calls, workerApi };
}

function syncDeps(graph: ReturnType<typeof meta>, db: ReturnType<typeof fakeDb>, over: Partial<SyncDeps> = {}): Partial<SyncDeps> {
  let clock = 0;
  return { tenant: async () => CTX, readConnection: async () => connectionRecord(), workerApi: () => db.workerApi, keyring: () => keyring,
    http: graph.http, monotonicNow: () => clock, wallNow: () => new Date('2026-10-03T12:00:01.000Z'),
    sleep: async (ms) => { clock += ms; }, log: () => {}, limits: LIMITS, ...over };
}

const writes = (db: ReturnType<typeof fakeDb>) => db.calls.filter((call) => ['publish_snapshot', 'fail_sync_run'].includes(call.fn));

describe('M16c-T-28: orquestación y resultados cerrados', () => {
  it('cuatro niveles completos producen completa, en orden fijo', async () => {
    const db = fakeDb();
    const outcome = await syncMetaInsights(syncDeps(meta(), db));
    expect(outcome.result).toBe('completa');
    expect(writes(db).map((call) => [call.fn, call.args[7]])).toEqual([['publish_snapshot', 'account'],
      ['publish_snapshot', 'campaign'], ['publish_snapshot', 'adset'], ['publish_snapshot', 'ad']]);
    expect(db.calls[0].fn).toBe('start_sync_run');
    expect(db.calls[0].args.slice(6, 8)).toEqual(['2026-10-01', '2026-10-03']);
  });

  it('un nivel fallido no impide los siguientes y da parcial', async () => {
    const db = fakeDb();
    const graph = meta({ [`${ROOT}/insights`]: (url) => url.searchParams.get('level') === 'campaign' ? graphError(100) : json({ data: [] }) });
    const outcome = await syncMetaInsights(syncDeps(graph, db));
    expect(outcome.result).toBe('parcial');
    expect(writes(db).map((call) => call.fn)).toEqual(['publish_snapshot', 'fail_sync_run', 'publish_snapshot', 'publish_snapshot']);
  });

  it('rate limit detiene los niveles pendientes', async () => {
    const db = fakeDb();
    const outcome = await syncMetaInsights(syncDeps(meta({ [`${ROOT}/insights`]: () => graphError(4) }), db));
    expect(outcome.result).toBe('incompleta');
    expect(writes(db)).toHaveLength(1);
    expect(writes(db)[0].args.slice(13, 17)).toEqual(['meta_error', 'rate_limit', expect.any(String), true]);
  });

  it('una clase de reautorización da requiere_reauth y detiene', async () => {
    const db = fakeDb();
    const outcome = await syncMetaInsights(syncDeps(meta({ [`${ROOT}/insights`]: () => graphError(190) }), db));
    expect(outcome.result).toBe('requiere_reauth');
    expect(writes(db)).toHaveLength(1);
    expect(writes(db)[0].args[14]).toBe('authentication');
  });

  it('agotar la duración detiene con duration_limit', async () => {
    const db = fakeDb();
    let clock = 0;
    const graph = meta({ [`${ROOT}/insights`]: () => { clock = 95_000; return json({ data: [] }); } });
    const outcome = await syncMetaInsights(syncDeps(graph, db, { monotonicNow: () => clock }));
    expect(outcome.result).toBe('parcial');
    expect(writes(db).map((call) => call.fn)).toEqual(['publish_snapshot', 'fail_sync_run']);
    expect(writes(db)[1].args.slice(13, 17)).toEqual(['duration_limit', 'own_error', expect.any(String), true]);
  });

  it('PX009 al iniciar da en_curso, sin Meta ni credencial', async () => {
    const graph = meta();
    const db = fakeDb({ start_sync_run: () => { throw new WorkerApiError('sync_in_progress'); } });
    expect((await syncMetaInsights(syncDeps(graph, db))).result).toBe('en_curso');
    expect(graph.seen).toEqual([]);
    expect(db.calls.map((call) => call.fn)).toEqual(['start_sync_run']);
  });

  it('sin conexión activa da error sin iniciar', async () => {
    for (const record of [null, connectionRecord({ status: 'needs_reauth', last_error_class: 'authentication', last_error_message: 'x' })]) {
      const db = fakeDb();
      expect((await syncMetaInsights(syncDeps(meta(), db, { readConnection: async () => record }))).result).toBe('error');
      expect(db.calls).toEqual([]);
    }
  });

  it('una conexión que deja de estar activa antes de una llamada nueva corta Meta y no escribe', async () => {
    const db = fakeDb();
    const graph = meta();
    let reads = 0;
    const outcome = await syncMetaInsights(syncDeps(graph, db, { readConnection: async () => {
      reads += 1;
      return reads <= 2 ? connectionRecord() : connectionRecord({ credential_generation: 1 });
    } }));
    expect(outcome.result).toBe('conexion_cambio');
    expect(graph.seen.length).toBeLessThanOrEqual(1);
    expect(writes(db)).toEqual([]);
  });

  it('un fallo al releer la conexión no se presenta como cambio: los niveles quedan own_error', async () => {
    const db = fakeDb();
    const graph = meta();
    let reads = 0;
    const outcome = await syncMetaInsights(syncDeps(graph, db, { readConnection: async () => {
      reads += 1;
      if (reads > 1) throw new Error('lectura caída');
      return connectionRecord();
    } }));
    expect(outcome.result).toBe('incompleta');
    expect(graph.seen).toEqual([]);
    expect(writes(db).map((call) => call.args[13])).toEqual(['own_error', 'own_error', 'own_error', 'own_error']);
  });

  it('M16c-T-28 mapea los errores después de iniciar', () => {
    expect(outcomeForWriteError(new WorkerApiError('not_authorized'))).toBe('conexion_cambio');
    expect(outcomeForWriteError(new WorkerApiError('invalid_transition'))).toBe('conexion_cambio');
    expect(outcomeForWriteError(new WorkerApiError('generation_mismatch'))).toBe('conexion_cambio');
    expect(outcomeForWriteError(new WorkerApiError('sync_ownership_lost'))).toBe('incompleta');
    expect(outcomeForWriteError(new WorkerApiError('invalid_argument'))).toBe('incompleta');
    expect(outcomeForWriteError(new WorkerApiError('unexpected'))).toBe('incompleta');
    expect(outcomeForWriteError(new Error('otro'))).toBe('incompleta');
  });

  it('PX001 en una publicación da conexion_cambio; PX010, incompleta', async () => {
    for (const [code, expected] of [['not_authorized', 'conexion_cambio'], ['sync_ownership_lost', 'incompleta']] as const) {
      const db = fakeDb({ publish_snapshot: () => { throw new WorkerApiError(code); } });
      expect((await syncMetaInsights(syncDeps(meta(), db))).result).toBe(expected);
      expect(writes(db)).toHaveLength(1);
    }
  });

  it('un resultado SQL ambiguo se reintenta idéntico una vez y después da no_confirmada, sin otra extracción', async () => {
    const graph = meta();
    const db = fakeDb({ publish_snapshot: () => { throw new WorkerApiError('unavailable', 'timeout'); } });
    const outcome = await syncMetaInsights(syncDeps(graph, db));
    expect(outcome.result).toBe('no_confirmada');
    const published = writes(db);
    expect(published).toHaveLength(2);
    expect(published[1].args).toEqual(published[0].args);
    expect(graph.seen.filter((url) => url.pathname.endsWith('/insights'))).toHaveLength(1);
  });

  it('un reintento que confirma sigue con el nivel siguiente', async () => {
    let attempts = 0;
    const db = fakeDb({ publish_snapshot: (args) => {
      attempts += 1;
      if (attempts === 1) throw new WorkerApiError('unavailable', 'transport');
      return [{ snapshot_id: args[6], level: args[7], complete: true }];
    } });
    expect((await syncMetaInsights(syncDeps(meta(), db))).result).toBe('completa');
    expect(attempts).toBe(5);
  });

  it('T-37 un 22023 de publicación pasa a fail con payload vacío, own_error y detiene', async () => {
    const db = fakeDb({ publish_snapshot: () => { throw new WorkerApiError('invalid_argument'); } });
    const outcome = await syncMetaInsights(syncDeps(meta(), db));
    expect(outcome.result).toBe('incompleta');
    const [published, failed] = writes(db);
    expect(failed.fn).toBe('fail_sync_run');
    expect(failed.args[8]).toBe(published.args[8]);
    expect(failed.args[11]).toEqual({ entities: [], days: [] });
    expect(failed.args.slice(12, 15)).toEqual([0, 'own_error', 'own_error']);
    expect(failed.args[16]).toBe(true);
    expect(writes(db)).toHaveLength(2);
  });

  it('una credencial ilegible cierra el primer nivel como own_error', async () => {
    const db = fakeDb({ get_credential: () => { throw new WorkerApiError('unexpected'); } });
    const graph = meta();
    expect((await syncMetaInsights(syncDeps(graph, db))).result).toBe('incompleta');
    expect(graph.seen).toEqual([]);
    expect(writes(db)[0].args.slice(12, 17)).toEqual([0, 'own_error', 'own_error', expect.any(String), true]);
  });
});

describe('M16c-T-29: logs cerrados', () => {
  const SENSITIVE = ['token-sint', 'act_1001', 'Nombre secreto', '77.77', 'cursor-secreto', '9090', 'https://'];
  const ALLOWED = new Set(['evento', 'level', 'resultado', 'clase', 'request_id', 'filas', 'campos', 'paginas', 'llamadas',
    'completa', 'duracion_ms', 'motivo']);

  it('solo registra claves permitidas y ningún dato sensible, ni en éxito ni en fallo', async () => {
    const lines: unknown[] = [];
    const rows = [row('campaign', '9090', '2026-10-01', { spend: '77.77', campaign_name: 'Nombre secreto' })];
    const routes: Record<string, Route> = {
      [`${ROOT}/campaigns`]: () => json({ data: [{ id: '9090', name: 'Nombre secreto' }] }),
      [`${ROOT}/insights`]: (url, call) => {
        if (url.searchParams.get('level') !== 'campaign') return json({ data: [] });
        return call < 2 ? json({ data: rows, paging: { next: 'https://x.test', cursors: { after: 'cursor-secreto' } } }) : graphError(100);
      },
    };
    const consoles = [vi.spyOn(console, 'info'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'log')];
    await syncMetaInsights(syncDeps(meta(routes), fakeDb(), { log: (line) => lines.push(line) }));
    expect(lines.length).toBeGreaterThanOrEqual(5);
    for (const line of lines) {
      for (const key of Object.keys(line as object)) expect(ALLOWED.has(key)).toBe(true);
      for (const value of SENSITIVE) expect(JSON.stringify(line)).not.toContain(value);
    }
    expect(lines).toContainEqual(expect.objectContaining({ evento: 'meta_sync', level: 'campaign', completa: false, clase: 'own_error', motivo: 'meta_error' }));
    expect(lines.at(-1)).toMatchObject({ evento: 'meta_sync', resultado: 'parcial' });
    for (const spy of consoles) { expect(spy).not.toHaveBeenCalled(); spy.mockRestore(); }
  });

  it('LevelExtraction no lleva cursor, URL ni token', async () => {
    const result: LevelExtraction = await extract('account', meta());
    expect(Object.keys(result).sort()).toEqual(['calls', 'complete', 'days', 'durationMs', 'entities', 'errorClass', 'fetchedAt',
      'level', 'pages', 'reason', 'validatedPages']);
  });
});

describe('M16c-T-28: parser, precedencia y textos de resultados', () => {
  it('conserva los ocho resultados y sus textos exactos', () => {
    expect(META_SYNC_MESSAGES).toEqual({
      completa: { tone: 'ok', text: 'Sincronización completa.' },
      parcial: { tone: 'info', text: 'Algunos niveles se actualizaron. Revisá la cobertura.' },
      incompleta: { tone: 'error', text: 'La sincronización quedó incompleta. Conservamos la cobertura anterior.' },
      en_curso: { tone: 'info', text: 'Ya hay una sincronización en curso.' },
      requiere_reauth: { tone: 'error', text: 'Meta pidió volver a autorizar a Praxa. La sincronización se detuvo; revisá la cobertura y volvé a autorizar.' },
      conexion_cambio: { tone: 'error', text: 'La conexión cambió durante la sincronización. Revisá su estado.' },
      error: { tone: 'error', text: 'No pudimos sincronizar. Probá de nuevo más tarde.' },
      no_confirmada: { tone: 'error', text: 'No pudimos confirmar el resultado de la sincronización. Revisá la cobertura antes de volver a sincronizar.' },
    });
    expect([...META_SYNC_RESULTS].sort()).toEqual(Object.keys(META_SYNC_MESSAGES).sort());
  });

  it('descarta valores repetidos, vacíos y desconocidos', () => {
    expect(parseMetaSyncResult('completa')).toBe('completa');
    for (const value of [undefined, '', 'COMPLETA', 'desconocido', ['completa'], ['completa', 'completa'], '<script>']) {
      expect(parseMetaSyncResult(value as never)).toBeNull();
    }
  });

  it('aplica la precedencia de la spec', () => {
    expect(pickSyncResult(['parcial', 'en_curso', 'no_confirmada', 'conexion_cambio', 'requiere_reauth'])).toBe('requiere_reauth');
    expect(pickSyncResult(['parcial', 'en_curso', 'no_confirmada', 'conexion_cambio'])).toBe('conexion_cambio');
    expect(pickSyncResult(['parcial', 'en_curso', 'no_confirmada'])).toBe('no_confirmada');
    expect(pickSyncResult(['parcial', 'en_curso'])).toBe('en_curso');
    expect(pickSyncResult(['incompleta'])).toBe('incompleta');
  });

  it('una query de éxito no reemplaza el estado persistido', () => {
    expect(syncNotice('completa', 'completed')).toEqual(META_SYNC_MESSAGES.completa);
    for (const status of ['partial', 'failed', 'never', 'running', 'expired', 'connection_changed', null] as const) {
      expect(syncNotice('completa', status)).toBeNull();
    }
    expect(syncNotice('parcial', 'partial')).toEqual(META_SYNC_MESSAGES.parcial);
    expect(syncNotice('parcial', 'completed')).toBeNull();
    expect(syncNotice('parcial', null)).toBeNull();
    expect(syncNotice('error', 'completed')).toEqual(META_SYNC_MESSAGES.error);
    expect(syncNotice(null, 'completed')).toBeNull();
  });
});

describe('M16c-T-34: Q-04, perfil único', () => {
  const VERCEL_SECONDS = 300;

  it('la duración de página es un literal igual al límite efectivo', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/app/(app)/app/integraciones/page.tsx'), 'utf8');
    expect(page).toMatch(new RegExp(`^export const maxDuration = ${VERCEL_SECONDS};$`, 'm'));
  });

  it('cumple la fórmula del lease y cabe en el límite también en el peor caso', () => {
    const limits = DEFAULT_SYNC_LIMITS;
    expect(limits.lookbackDays).toBe(28);
    expect(limits.maxWindowDays).toBeGreaterThanOrEqual(limits.lookbackDays);
    expect(limits.maxRetries).toBe(2);
    expect(limits.retryDelayMs).toBe(500);
    expect(limits.leaseSeconds).toBe(Math.ceil((limits.maxDurationMs + limits.finalizationReserveMs) / 1000));
    // La reserva cubre dos intentos SQL (10 s de conexión + 15 s de consulta) más la respuesta.
    const sqlAttempt = 25_000;
    const response = 5_000;
    expect(limits.finalizationReserveMs).toBeGreaterThanOrEqual(2 * sqlAttempt + response);
    // Peor caso: la última llamada a Meta termina al agotar el presupuesto utilizable, la
    // publicación usa dos intentos y el nivel siguiente registra su fallo con otros dos.
    const lastMetaCallEnds = limits.maxDurationMs - limits.finalizationReserveMs;
    const worst = lastMetaCallEnds + 2 * sqlAttempt + 2 * sqlAttempt + response;
    expect(worst).toBeLessThan(VERCEL_SECONDS * 1000);
    expect(limits.leaseSeconds).toBeLessThan(VERCEL_SECONDS);
  });

  it('el presupuesto empieza al entrar a la orquestación, antes de las lecturas previas', async () => {
    const db = fakeDb();
    const graph = meta();
    let clock = 0;
    const outcome = await syncMetaInsights(syncDeps(graph, db, { monotonicNow: () => clock, tenant: async () => { clock = 95_000; return CTX; } }));
    expect(graph.seen).toEqual([]);
    expect(outcome.result).toBe('incompleta');
    expect(writes(db)[0].args[13]).toBe('duration_limit');
  });
});

describe('M16c-T-27: vista de lectura por JWT', () => {
  const REF = '11111111-1111-4111-8111-111111111111';
  const entity = { entity_ref: REF, level: 'campaign', parent_ref: null, name: 'N', effective_status: null, objective: null,
    metadata_fetched_at: '2026-10-03T12:00:00.000Z', captured_at: '2026-10-03T12:00:00.000Z' };
  const never = { has_attempt: false, summary: null, effective_status: 'never', connection_changed: false };
  const summary = { version: 1, credential_generation: 0, window_from: '2026-10-01', window_to: '2026-10-03', max_window_days: 28,
    started_at: '2026-10-03T12:00:00.000Z', lease_expires_at: '2026-10-03T12:05:00.000Z', finished_at: null, status: 'completed',
    levels: Object.fromEntries(['account', 'campaign', 'adset', 'ad'].map((name) => [name,
      { status: 'complete', reason: 'complete', fetched_at: '2026-10-03T12:00:00.000Z', finished_at: '2026-10-03T12:00:01.000Z' }])) };

  function supabase(status: unknown = { has_attempt: true, summary, effective_status: 'completed', connection_changed: false }) {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    return { calls, client: { rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      const data = fn === 'get_meta_sync_status' ? [status] : fn === 'list_meta_entities' && args.p_level === 'campaign' ? [entity] : [];
      return { range: async () => ({ data, error: null, count: data.length }),
        then: (done: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(done) };
    } } as never };
  }

  const load = (fake: ReturnType<typeof supabase>, query: { nivel?: unknown; entidad?: unknown }, record: IntegrationConnectionRecord | null = connectionRecord()) =>
    loadMetaSyncView(query as never, { tenant: async () => CTX, readConnection: async () => record, supabase: fake.client });

  it('sin conexión viva o en pendiente no devuelve vista', async () => {
    expect(await load(supabase(), {}, null)).toBeNull();
    expect(await load(supabase(), {}, connectionRecord({ status: 'pending_selection', external_account_id: null, currency: null, timezone: null, pending_expires_at: '2030-01-01T00:00:00.000Z' }))).toBeNull();
  });

  it('solo una conexión activa puede sincronizar; needs_reauth lee', async () => {
    expect(await load(supabase(), {})).toMatchObject({ connectionStatus: 'active', canSync: true });
    expect(await load(supabase(), {}, connectionRecord({ status: 'needs_reauth', last_error_class: 'authentication', last_error_message: 'x' })))
      .toMatchObject({ connectionStatus: 'needs_reauth', canSync: false });
  });

  it('valida nivel y entidad en el servidor: una referencia ajena o adulterada no se usa', async () => {
    const adulterated = supabase();
    expect(await load(adulterated, { nivel: 'campaign', entidad: 'ffffffff-0000-4000-8000-000000000001' })).toMatchObject({ level: 'campaign', entityRef: null });
    expect(adulterated.calls.find((call) => call.fn === 'get_meta_daily_coverage')?.args).not.toHaveProperty('p_entity_ref');

    const valid = supabase();
    expect(await load(valid, { nivel: 'campaign', entidad: REF })).toMatchObject({ level: 'campaign', entityRef: REF });
    expect(valid.calls.find((call) => call.fn === 'get_meta_daily_coverage')?.args).toMatchObject({ p_entity_ref: REF, p_from: '2026-10-01', p_to: '2026-10-03' });

    for (const nivel of ['otro', ['campaign', 'ad'], undefined]) {
      expect(await load(supabase(), { nivel })).toMatchObject({ level: 'account', entityRef: null });
    }
  });

  describe('lectura hasta agotar el total (CA-46)', () => {
    /** La Data API corta cada petición en `serverMax` filas sin error e informa el total aparte. */
    function paged(total: number, serverMax: number, over: (call: number) => Record<string, unknown> = () => ({})) {
      const all = Array.from({ length: total }, (_, i) => ({ ...entity, entity_ref: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}` }));
      const ranges: Array<[number, number]> = [];
      const client = { rpc: (_fn: string, _args: unknown, options?: { count?: string }) => ({ range: async (from: number, to: number) => {
        const call = ranges.length;
        ranges.push([from, to]);
        return { data: all.slice(from, Math.min(to + 1, from + serverMax)), error: null, count: options?.count === 'exact' ? total : null, ...over(call) };
      } }) } as never;
      return { ranges, client };
    }
    const list = (fake: ReturnType<typeof paged>) => listCapturedEntities('ffffffff-0000-4000-8000-000000000001', 'campaign', { supabase: fake.client });

    it('recorre todas las páginas, sin repetir ni perder filas', async () => {
      const fake = paged(2500, 1000);
      const rows = await list(fake);
      expect(rows).toHaveLength(2500);
      expect(new Set(rows.map((item) => item.entity_ref)).size).toBe(2500);
      expect(fake.ranges.map(([from]) => from)).toEqual([0, 1000, 2000]);
    });

    it('un corte del servidor menor que el pedido no se confunde con el final', async () => {
      expect(await list(paged(250, 100))).toHaveLength(250);
    });

    it('sin filas hace una sola petición', async () => {
      const fake = paged(0, 1000);
      expect(await list(fake)).toEqual([]);
      expect(fake.ranges).toHaveLength(1);
    });

    it.each([
      ['el total cambia entre páginas', paged(1500, 1000, (call) => (call === 1 ? { count: 1600 } : {}))],
      ['una página viene vacía antes del total', paged(1500, 1000, (call) => (call === 1 ? { data: [] } : {}))],
      ['falla una página posterior', paged(1500, 1000, (call) => (call === 1 ? { data: null, error: { message: 'x' } } : {}))],
      ['no informa el total', paged(10, 1000, () => ({ count: null }))],
      ['una fila es inválida', paged(10, 1000, () => ({ data: [{ entity_ref: 'x' }] }))],
    ])('nunca devuelve una lectura incompleta: %s', async (_label, fake) => {
      await expect(list(fake)).rejects.toBeInstanceOf(MetaSyncReadError);
    });

    it('un total por encima de la cota falla sin recorrer las páginas', async () => {
      const fake = paged(20_001, 1000);
      await expect(list(fake)).rejects.toBeInstanceOf(MetaSyncReadError);
      expect(fake.ranges).toHaveLength(1);
    });
  });

  it('sin intento no consulta cobertura', async () => {
    const fake = supabase(never);
    expect(await load(fake, {})).toMatchObject({ coverage: [], status: never });
    expect(fake.calls.some((call) => call.fn === 'get_meta_daily_coverage')).toBe(false);
  });
});
