import { describe, expect, it, vi } from 'vitest';

import { runChatTurn, type ChatDependencies } from '@/modules/chat/orchestrator';
import { choiceSchema, type ChatChoice, type FlatChatAnswer } from '@/modules/chat/output-schema';
import { renderTurn } from '@/modules/chat/render';
import { executeGa4Tool, type Ga4Connection, type MetaSpendRow } from '@/modules/chat/tools/ga4';
import { parseToolResult, toModelView } from '@/modules/chat/tools/results';
import { GA4_TOOL_NAMES, isGa4Tool, projectToolArgs, TOOL_NAMES, ToolArgumentError } from '@/modules/chat/tools/schema';

vi.mock('server-only', () => ({}));

/**
 * M16f-T-09 (unit): las seis herramientas de GA4 del chat. Las filas simulan lo que devuelven
 * las funciones `get_ga4_*` de 0027/0029; las cifras del resultado tienen que ser las mismas,
 * sin IDs externos, sin claves internas para el modelo, sin convertir ausencias en cero y con
 * la regla de cinco en cohortes. También la abstención y el registro con tres fuentes (§6).
 */

const GA4_ID = 'd0000000-0000-4000-8000-0000000000f1';
const PRODUCT_KEY = 'f1000000-0000-4000-8000-000000000001';
const ITEM_A = 'f2000000-0000-4000-8000-000000000002';
const ITEM_B = 'f3000000-0000-4000-8000-000000000003';
const CAMPAIGN_REF = 'f4000000-0000-4000-8000-000000000004';
const FETCHED = '2026-03-01T03:00:04.123456+00:00';
const TZ = 'UTC';

const conn: Ga4Connection = { id: GA4_ID, status: 'active', currency: 'USD', timezone: TZ };
const quality = (from: string, to: string, extra: Record<string, unknown> = {}) => ({
  quality_id: 'q', report_id: 'ga4_trafico_dia', report_version: 1, window_from: from, window_to: to,
  fetched_at: FETCHED, row_count: 5, sampling_metadatas: [], subject_to_thresholding: false,
  data_loss_from_other_row: false, data_truncation_reasons: [], restricted_metrics: [], empty_reason: null,
  currency_code: 'USD', time_zone: TZ, zona_distinta: false, ...extra,
});
const clean = quality('2026-02-01', '2026-02-28');
const flagged = quality('2026-02-24', '2026-02-24', { subject_to_thresholding: true });
const capability = (status: string) => ({ status, reason: status === 'disponible' ? null : 'sintético' });
const statusRow = (campanias = 'disponible') => ({ display_name: 'Propiedad sintética', phase: 'incremental',
  coverage_from: '2025-03-01', coverage_through: '2026-02-28', last_step_at: '2026-03-01T03:00:05+00:00',
  last_step_status: 'complete', last_error_kind: null, last_fetched_at: FETCHED, time_zone: TZ,
  currency_code: 'USD', preflight: { trafico: capability('disponible'), cohortes: capability('disponible'),
    campanias: capability(campanias), embudo: capability('disponible'), productos: capability('disponible') },
  flags: {}, item_mapping_rule: 'variant' });
const traffic = (day: string, sessions: number, meta: number | null, provisional = false,
  q: unknown = clean, sq: unknown = clean) => ({ day, sessions, active_users: sessions - 1, new_users: 1,
  meta_visits: meta, provisional, traffic_quality: q, source_quality: sq });
const trafficRows = [
  traffic('2026-02-22', 10, 3),
  traffic('2026-02-24', 7, 2, false, flagged, flagged),
  traffic('2026-02-25', 6, null, false, clean, null),
  traffic('2026-02-26', 5, 1, true),
  traffic('2026-02-28', 4, 0, true),
];
const item = (day: string, item_ref: string | null, product_key: string | null, name: string, views: number,
  carts: number, purchases: number, tn_units: number | null) => ({ day, item_ref, product_key, item_name: name,
  views, add_to_carts: carts, purchases, tn_units, quality: clean });
const items = [
  item('2026-02-22', null, PRODUCT_KEY, 'Remera sintética', 5, 2, 1, 3),
  item('2026-02-23', null, PRODUCT_KEY, 'Remera sintética', 4, 0, 0, 1),
  item('2026-02-22', ITEM_A, null, 'Gorra sintética', 7, 1, 0, null),
  item('2026-02-22', ITEM_B, null, 'Gorra sintética', 2, 0, 0, null),
];
const cohort = (month: string, n: number, size: number | null, active: number | null, retention: number | null,
  sizeHidden: boolean, activeHidden: boolean, provisional: boolean, absence: string | null) => ({
  cohort_month: month, month_offset: n, cohort_size: size, active, size_hidden: sizeHidden,
  active_hidden: activeHidden, provisional, retention, absence, quality: clean });
const cohorts = [
  cohort('2025-12-01', 0, 8, 8, 1, false, false, false, null),
  cohort('2025-12-01', 1, 8, null, null, false, true, false, 'menos_de_5'),
  cohort('2026-01-01', 0, null, null, null, true, true, false, 'menos_de_5'),
  cohort('2026-01-01', 1, null, null, null, true, true, false, 'menos_de_5'),
  cohort('2026-02-01', 0, 6, 6, 1, false, false, true, null),
  cohort('2026-02-01', 1, 6, null, null, false, false, false, 'aun_no_disponible'),
];
const funnel = [
  { day: '2026-02-22', event_name: 'view_item', event_count: 20, quality: clean },
  { day: '2026-02-23', event_name: 'view_item', event_count: 5, quality: clean },
  { day: '2026-02-22', event_name: 'purchase', event_count: 1, quality: clean },
];

function fakeRpc(overrides: Record<string, unknown[]> = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const rows: Record<string, unknown[]> = { get_ga4_sync_status: [statusRow()], get_ga4_traffic: trafficRows,
    get_ga4_items: items, get_ga4_cohorts: cohorts, get_ga4_funnel: funnel,
    get_ga4_campaigns: [{ day: '2026-02-22', entity_ref: CAMPAIGN_REF, sessions: 5, quality: clean },
      { day: '2026-02-23', entity_ref: null, sessions: 3, quality: clean }], ...overrides };
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    if (!(fn in rows)) throw new Error(`rpc inesperada ${fn}`);
    return rows[fn];
  });
  return { rpc, calls };
}

const defaults = { period: { from: '2026-02-22', to: '2026-02-28' }, accountEntityRef: null, month: '2026-02' };
const flatNulls = { level: null, entity_ref: null, metric: null, period: null, period_a: null, period_b: null,
  action_type: null, order: null, limit: null, include_trend: null, dimension: null, granularity: null,
  from_month: null, to_month: null, max_offset: null };
const project = (name: string, flat: Record<string, unknown> = {}) =>
  projectToolArgs(name, { ...flatNulls, ...flat }, defaults);
const run = (name: string, flat: Record<string, unknown> = {}, rpc = fakeRpc().rpc,
  extra: { metaConnectionId?: string | null; metaCampaignSpend?: () => Promise<MetaSpendRow[]> } = {}) =>
  executeGa4Tool(project(name, flat), conn, 't1', { rpc, today: '2026-03-01', ...extra });
const pick = (result: Awaited<ReturnType<typeof run>>, metric: string) =>
  result.values.filter((v) => v.metric === metric);

describe('M16f-T-09: contrato de las seis herramientas de GA4', () => {
  it('suma exactamente seis herramientas al final del catálogo', () => {
    expect([...GA4_TOOL_NAMES]).toEqual(['ga4_trafico', 'ga4_embudo', 'ga4_productos', 'ga4_campanias',
      'ga4_cohortes', 'ga4_cobertura']);
    expect(TOOL_NAMES).toHaveLength(23);
    expect(TOOL_NAMES.slice(17)).toEqual([...GA4_TOOL_NAMES]);
    for (const name of GA4_TOOL_NAMES) expect(isGa4Tool(name)).toBe(true);
    expect(isGa4Tool('tn_ventas')).toBe(false);
  });

  it('rechaza 94 días en todas salvo ga4_cohortes, que acepta 12 cohortes y rechaza 13', () => {
    const long = { from: '2025-11-27', to: '2026-02-28' };
    for (const name of ['ga4_trafico', 'ga4_embudo', 'ga4_productos', 'ga4_campanias']) {
      expect(() => project(name, { period: long })).toThrow(ToolArgumentError);
      expect(project(name, { period: { from: '2025-11-28', to: '2026-02-28' } }).name).toBe(name);
    }
    expect(project('ga4_cohortes', { from_month: '2025-03', to_month: '2026-02' }).args)
      .toMatchObject({ from_month: '2025-03', to_month: '2026-02', max_offset: 6 });
    expect(() => project('ga4_cohortes', { from_month: '2025-02', to_month: '2026-02' })).toThrow(ToolArgumentError);
    expect(project('ga4_cohortes').args).toMatchObject({ from_month: '2025-03', to_month: '2026-02' });
    expect(project('ga4_trafico').args).toMatchObject({ period: defaults.period, granularity: 'day' });
    expect(() => project('ga4_cobertura', { period: defaults.period })).toThrow(ToolArgumentError);
  });
});

describe('M16f-T-09/C-07: cifras iguales a SQL, sin convertir ausencias en cero', () => {
  it('ga4_trafico por día distingue dato, cero cubierto, desconocido, parcial y provisional', async () => {
    const result = await run('ga4_trafico');
    const sessions = pick(result, 'ga4_sessions');
    expect(sessions.map((v) => [v.day, v.value, v.absence, v.captured_partial])).toEqual([
      ['2026-02-22', '10', null, false],
      // Día sin fila dentro de una ventana completa y sin banderas: cero medido.
      ['2026-02-23', '0', null, false],
      ['2026-02-24', '7', null, true],
      ['2026-02-25', '6', null, false],
      ['2026-02-26', '5', null, true],
      // Día sin fila dentro del margen provisional: desconocido, nunca cero.
      ['2026-02-27', null, 'desconocido', false],
      ['2026-02-28', '4', null, true],
    ]);
    const meta = pick(result, 'ga4_meta_visits');
    expect(meta.find((v) => v.day === '2026-02-25')).toMatchObject({ value: null, absence: 'desconocido' });
    expect(meta.find((v) => v.day === '2026-02-22')?.value).toBe('3');
    expect(pick(result, 'ga4_active_users').find((v) => v.day === '2026-02-22')?.value).toBe('9');
    expect(result.extra).toMatchObject({ source: 'ga4', covered_through: '2026-02-28', provisional_days: 3 });
  });

  it('ga4_trafico por mes suma sesiones y deja los usuarios nulos con no_aditivo', async () => {
    const result = await run('ga4_trafico', { period: { from: '2026-01-15', to: '2026-02-28' } });
    expect(result.extra.granularity).toBe('month');
    expect(pick(result, 'ga4_sessions').map((v) => [v.period?.from, v.value, v.absence, v.captured_partial]))
      .toEqual([['2026-01-15', null, 'no_observado', false], ['2026-02-01', '32', null, true]]);
    // Un día con visitas desde Meta desconocidas vuelve desconocido el total del mes.
    expect(pick(result, 'ga4_meta_visits')[1]).toMatchObject({ value: null, absence: 'desconocido' });
    for (const metric of ['ga4_active_users', 'ga4_new_users']) {
      expect(pick(result, metric).every((v) => v.value === null && v.absence === 'no_aditivo')).toBe(true);
    }
  });

  it('ga4_embudo suma cada evento de la lista fija; un evento sin fila en ventana limpia es cero', async () => {
    const result = await run('ga4_embudo', { period: { from: '2026-02-22', to: '2026-02-23' } });
    expect(result.values.map((v) => [v.segment_primary, v.value])).toEqual([
      ['view_item', '25'], ['add_to_cart', '0'], ['begin_checkout', '0'], ['purchase', '1']]);
  });

  it('ga4_productos agrupa por producto, separa item_ref con el mismo nombre y no expone claves', async () => {
    const result = await run('ga4_productos');
    const views = pick(result, 'ga4_item_views');
    expect(views.map((v) => [v.entity_name, v.value, v.segment_secondary])).toEqual([
      ['Remera sintética', '9', null],
      ['Gorra sintética', '7', 'sin correspondencia con Tiendanube'],
      ['Gorra sintética', '2', 'sin correspondencia con Tiendanube'],
    ]);
    expect(pick(result, 'tn_units')).toHaveLength(1);
    expect(pick(result, 'tn_units')[0].value).toBe('4');
    expect(pick(result, 'ga4_add_to_carts').map((v) => v.value)).toEqual(['2']);
    const model = JSON.stringify(toModelView(result));
    for (const key of [PRODUCT_KEY, ITEM_A, ITEM_B, GA4_ID, 'Propiedad sintética']) {
      expect(model).not.toContain(key);
    }
  });

  it('ga4_productos con unidades desconocidas en algún día no las convierte en cero', async () => {
    const { rpc } = fakeRpc({ get_ga4_items: [items[0], { ...items[1], tn_units: null }] });
    const result = await run('ga4_productos', {}, rpc);
    expect(pick(result, 'tn_units')[0]).toMatchObject({ value: null, absence: 'desconocido' });
  });

  it('ga4_campanias muestra sesiones y gasto por campaña con correspondencia, en la moneda de Meta', async () => {
    const days = ['2026-02-22', '2026-02-23', '2026-02-24', '2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28'];
    const spend = vi.fn(async () => days.map((day) => ({ day, entity_ref: CAMPAIGN_REF, name: 'Campaña A',
      presence: 'con_datos', spend: '1.5', currency: 'EUR', fetched_at: FETCHED })));
    const result = await run('ga4_campanias', {}, fakeRpc().rpc, { metaConnectionId: 'm1', metaCampaignSpend: spend });
    expect(result.values.map((v) => [v.metric, v.entity_name, v.value, v.currency])).toEqual([
      ['ga4_campaign_sessions', 'Campaña A', '5', null], ['spend', 'Campaña A', '10.5', 'EUR'],
      ['ga4_unmatched_sessions', null, '3', null]]);
    expect(JSON.stringify(toModelView(result))).not.toContain(CAMPAIGN_REF);
    // Sin Meta conectada, todo queda sin correspondencia y no se lee gasto.
    const alone = await run('ga4_campanias');
    expect(alone.values.map((v) => [v.metric, v.value])).toEqual([['ga4_unmatched_sessions', '8']]);
  });

  it('una capacidad no disponible devuelve la ausencia con su motivo, sin leer el informe', async () => {
    const { rpc, calls } = fakeRpc({ get_ga4_sync_status: [statusRow('sin_instrumentacion')] });
    const result = await run('ga4_campanias', {}, rpc);
    expect(result.values).toHaveLength(1);
    expect(result.values[0]).toMatchObject({ value: null, absence: 'no_disponible' });
    expect(result.extra.unavailable_reason).toBe('sin_instrumentacion');
    expect(calls.map((c) => c.fn)).toEqual(['get_ga4_sync_status']);
  });
});

describe('M16f-T-09/C-08: cohortes de visitantes con la regla de cinco', () => {
  it('no envía conteos ocultos ni retenciones deducibles y distingue N futuro de cero', async () => {
    const { rpc, calls } = fakeRpc();
    const result = await run('ga4_cohortes', { from_month: '2025-12', to_month: '2026-02', max_offset: 1 }, rpc);
    expect(calls[1]).toEqual({ fn: 'get_ga4_cohorts', args: { p_connection_id: GA4_ID, p_from: '2025-12-01',
      p_to: '2026-02-01', p_today: '2026-03-01', p_max_offset: 1, p_provisional_days: 3 } });
    const rows = result.values.map((v) => [v.cohort_month, v.month_offset, v.metric, v.value, v.absence]);
    expect(rows).toEqual([
      ['2025-12', null, 'ga4_cohort_size', '8', null],
      ['2025-12', 0, 'ga4_cohort_active', '8', null],
      ['2025-12', 0, 'ga4_cohort_retention', '100', null],
      ['2025-12', 1, 'ga4_cohort_active', null, 'menos_de_5'],
      ['2025-12', 1, 'ga4_cohort_retention', null, 'menos_de_5'],
      // Cohorte de menos de cinco: solo su tamaño oculto, sin celdas.
      ['2026-01', null, 'ga4_cohort_size', null, 'menos_de_5'],
      ['2026-02', null, 'ga4_cohort_size', '6', null],
      ['2026-02', 0, 'ga4_cohort_active', '6', null],
      ['2026-02', 0, 'ga4_cohort_retention', '100', null],
      ['2026-02', 1, 'ga4_cohort_active', null, 'aun_no_disponible'],
      ['2026-02', 1, 'ga4_cohort_retention', null, 'aun_no_disponible'],
    ]);
    expect(result.values.find((v) => v.cohort_month === '2026-02' && v.month_offset === 0)?.captured_partial)
      .toBe(true);
  });
});

describe('M16f-T-09/C-11: presentación', () => {
  it('rotula la fuente sin la propiedad, marca lo parcial y no muestra ausencias como cero', async () => {
    const result = await run('ga4_trafico');
    const view = renderTurn({ kind: 'answer', results: [result], accountRef: null, recordId: 'r',
      answer: { text: '', blocks: [{ type: 'tabla', sources: [{ tool_call_id: 't1', path_prefix: '/values' }] }] } });
    expect(view.footer?.store).toBe('Google Analytics');
    expect(view.footer?.coverage).toContain('Google Analytics cubierto hasta el 28/02/2026');
    expect(view.footer?.data_limits.join(' ')).toContain('parciales o provisionales');
    expect(view.blocks[0].table.rows.some((row) => row[1] === 'Desconocido')).toBe(true);
    expect(JSON.stringify(view)).not.toContain(GA4_ID);
  });

  it('las cohortes se rotulan como visitantes y mes N de GA4, aparte de las de compradores', async () => {
    const result = await run('ga4_cohortes', { from_month: '2025-12', to_month: '2026-02', max_offset: 1 });
    const view = renderTurn({ kind: 'answer', results: [result], accountRef: null, recordId: 'r',
      answer: { text: '', blocks: [{ type: 'tabla', sources: [{ tool_call_id: 't1', path_prefix: '/values' }] }] } });
    expect(view.blocks[0].table.rows[1][0]).toBe('Cohorte de visitantes 12/2025 · mes 0 de GA4 · Visitantes activos');
    expect(view.footer?.data_limits.join(' ')).toContain('visitantes por primera visita');
    expect(view.footer?.data_limits.join(' ')).toContain('menos de 5 visitantes');
  });
});

// ---------------------------------------------------------------------------
// Orquestador: fuentes, abstención y registro con tres fuentes (§6, CA-62 ampliado).
// ---------------------------------------------------------------------------

type Conn = { id: string; status: 'active' | 'needs_reauth' | 'pending_selection'; credential_generation: number;
  external_account_id: string | null; timezone: string | null; currency: string | null };
const userId = 'a0000000-0000-4000-8000-000000000001';
const metaId = 'd0000000-0000-4000-8000-000000000001';
const storeId = 'd0000000-0000-4000-8000-0000000000e5';
const meta: Conn = { id: metaId, status: 'active', credential_generation: 1, external_account_id: 'act_0000000000151',
  timezone: 'UTC', currency: 'USD' };
const store: Conn = { id: storeId, status: 'active', credential_generation: 4, external_account_id: null,
  timezone: 'America/Argentina/Buenos_Aires', currency: 'ARS' };
const ga4: Conn = { id: GA4_ID, status: 'active', credential_generation: 7, external_account_id: null,
  timezone: 'Europe/Madrid', currency: 'EUR' };
const empty = (name: string) => parseToolResult({ status: 'ok', reason: null,
  scope: { level: null, entity_ref: null, entity_name: null, period: null, period_a: null, period_b: null,
    period_defaulted: false, entity_defaulted: false, timezone: null, currency: null },
  values: [], composition: null, extra: {} }, 't1', null, name as never);
const choice = (action: 'answer' | 'call_tools', names: string[] = []): ChatChoice =>
  ({ action, calls: names.map((name) => ({ name, args: flatNulls })), clarification_text: null,
    abstain_reason: null }) as ChatChoice;

function sources(metaConn: Conn | null, storeConn: Conn | null, ga4Conn: Conn | null) {
  const dep = {
    context: vi.fn(async () => ({ user_id: userId, company_id: 'c0000000-0000-4000-8000-000000000001',
      role: 'owner' as const, request_id: 'e0000000-0000-4000-8000-000000000001' })),
    begin: vi.fn(async () => undefined),
    end: vi.fn(async () => true),
    connection: vi.fn(async () => metaConn as never),
    storeConnection: vi.fn(async () => storeConn as never),
    ga4Connection: vi.fn(async () => ga4Conn as never),
    choose: vi.fn(async () => ({ output: choice('answer'), reportedModelId: 'choice' })),
    answer: vi.fn(async () => ({ output: { text: 'Dato', blocks: [] } as FlatChatAnswer, reportedModelId: 'a' })),
    resolve: vi.fn(async (name: string) => ({ name: name as never, args: {}, periodDefaulted: false,
      entityDefaulted: false })),
    execute: vi.fn(async (call: { name: string }) => empty(call.name)),
    record: vi.fn(async () => true),
    now: vi.fn(() => 0),
    wallTime: vi.fn(() => new Date('2026-03-01T12:00:00Z')),
    uuid: vi.fn(() => 'e0000000-0000-4000-8000-000000000001'),
    log: vi.fn(),
  } satisfies ChatDependencies;
  return dep;
}
const sent = (dep: ReturnType<typeof sources>) => (dep.choose.mock.calls[0] as unknown[])[0] as { content: string }[];
const offered = (dep: ReturnType<typeof sources>) => JSON.parse(sent(dep)[1].content).catalog as string[];
const recorded = (dep: ReturnType<typeof sources>) => (dep.record.mock.calls[0] as unknown[])[1];
const answerWith = (dep: ReturnType<typeof sources>, names: string[]) => {
  dep.choose.mockResolvedValueOnce({ output: choice('call_tools', names), reportedModelId: 'c' })
    .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'c' });
};

describe('M16f-T-09/C-11: fuentes, abstención y registro con tres fuentes', () => {
  it('solo GA4 activa habilita el chat, ofrece solo sus herramientas y registra GA4', async () => {
    const dep = sources(null, null, ga4);
    answerWith(dep, ['ga4_trafico']);
    const view = await runChatTurn({ question: '¿Cuántas sesiones tuve?' }, dep);
    expect(view.kind).toBe('answer');
    expect(offered(dep)).toEqual([...GA4_TOOL_NAMES]);
    expect(JSON.parse(sent(dep)[1].content)).toMatchObject({ connected_sources: ['ga4'],
      ga4: { today: '2026-03-01', timezone: 'Europe/Madrid', default_period: { from: '2026-02-22', to: '2026-02-28' },
        current_month: '2026-03' } });
    expect(sent(dep)[0].content).toContain('ga4_trafico');
    expect(sent(dep)[0].content).not.toContain('tn_ventas');
    expect((dep.execute.mock.calls[0] as unknown[])[1]).toMatchObject({ ga4: { id: GA4_ID }, ga4Today: '2026-03-01',
      connection: null, store: null });
    expect(recorded(dep)).toMatchObject({ connectionId: GA4_ID, generation: 7, toolNames: ['ga4_trafico'] });
    expect(JSON.stringify(dep.choose.mock.calls)).not.toContain('123456789');
  });

  it('con tres fuentes: Meta si se usó Meta; si no, la tienda; si no, GA4; sin herramientas, Meta', async () => {
    const all = () => sources(meta, store, ga4);
    const mixed = all();
    answerWith(mixed, ['ga4_trafico', 'total']);
    await runChatTurn({ question: 'Visitas y gasto' }, mixed);
    expect(offered(mixed)).toHaveLength(23);
    expect(recorded(mixed)).toMatchObject({ connectionId: metaId });

    const shop = all();
    answerWith(shop, ['ga4_trafico', 'tn_ventas']);
    await runChatTurn({ question: 'Visitas y ventas' }, shop);
    expect(recorded(shop)).toMatchObject({ connectionId: storeId });

    const site = all();
    answerWith(site, ['ga4_cobertura']);
    await runChatTurn({ question: '¿Está al día GA4?' }, site);
    expect(recorded(site)).toMatchObject({ connectionId: GA4_ID, toolNames: ['ga4_cobertura'] });

    const none = all();
    none.choose.mockResolvedValueOnce({ output: choiceSchema.parse({ action: 'abstain', calls: [],
      clarification_text: null, abstain_reason: 'out_of_scope' }), reportedModelId: 'c' });
    const view = await runChatTurn({ question: '¿Qué tiempo hace?' }, none);
    expect(recorded(none)).toMatchObject({ connectionId: metaId, reason: 'out_of_scope' });
    expect(view.segments.map((s) => s.text).join('')).toContain('fuentes conectadas');

    const noMeta = sources(null, store, ga4);
    noMeta.choose.mockResolvedValueOnce({ output: choiceSchema.parse({ action: 'abstain', calls: [],
      clarification_text: null, abstain_reason: 'connection_not_active' }), reportedModelId: 'c' });
    await runChatTurn({ question: '¿Cuánto gasté?' }, noMeta);
    expect(recorded(noMeta)).toMatchObject({ connectionId: storeId, reason: 'connection_not_active' });
  });

  it('solo Meta y la tienda activas: GA4 se abstiene y sus herramientas no se ofrecen', async () => {
    const dep = sources(meta, store, { ...ga4, status: 'needs_reauth' });
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools', ['ga4_trafico']), reportedModelId: 'c' });
    const view = await runChatTurn({ question: '¿Cuántas visitas tuve?' }, dep);
    expect(offered(dep)).not.toContain('ga4_trafico');
    expect(view.kind).toBe('abstention');
    expect(dep.execute).not.toHaveBeenCalled();
  });

  it('sin ninguna activa corta antes del modelo; con solo GA4 por reautorizar lo nombra', async () => {
    const dep = sources(null, null, { ...ga4, status: 'needs_reauth' });
    const view = await runChatTurn({ question: 'Visitas' }, dep);
    expect(dep.choose).not.toHaveBeenCalled();
    expect(recorded(dep)).toMatchObject({ connectionId: GA4_ID, reason: 'connection_not_active' });
    expect(view.segments.map((s) => s.text).join('')).toContain('Google Analytics');
  });

  it('un fallo al leer GA4 no impide responder con las otras fuentes', async () => {
    const dep = sources(meta, null, null);
    dep.ga4Connection.mockRejectedValueOnce(new Error('lectura'));
    answerWith(dep, ['total']);
    const view = await runChatTurn({ question: 'Gasto' }, dep);
    expect(view.kind).toBe('answer');
    expect(offered(dep)).not.toContain('ga4_trafico');
  });
});
