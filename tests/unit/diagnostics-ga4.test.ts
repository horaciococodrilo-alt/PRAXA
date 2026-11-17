import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { composeDocument, documentTexts, parseStoredReport } from '@/modules/diagnostics/compose';
import { attachGa4Section, prepareGa4Section, type Ga4TrafficRead } from '@/modules/diagnostics/evidence';
import {
  buildReport,
  generateDiagnostic,
  runModelSteps,
  type DiagnosticDeps,
  type GenerationContext,
  type StructuredRequest,
} from '@/modules/diagnostics/orchestrator';
import { DIAGNOSTIC_MODEL_ID } from '@/modules/diagnostics/provider';
import type { TenantContext } from '@/modules/tenant/context';
import { entity, prepareInput, readyPackage, segment, W } from '../eval/fixtures/diagnostics';

/**
 * M16f-T-09 (unit): sección «Tráfico del sitio» del diagnóstico. Sesiones y visitas desde Meta
 * de GA4 para las mismas fechas de calendario que la ventana de Meta y la anterior, sin
 * atribución, con parcialidad y versión 3 solo cuando hay sección (M16f-C-12).
 */

const GA4 = 'dd000000-0000-4000-8000-0000000000f1';
const STORE = 'dd000000-0000-4000-8000-0000000000e5';
const NOW = Date.parse('2026-11-13T12:00:00Z');
const FETCHED = '2026-11-13T03:00:00.123456+00:00';
const TZ = 'Europe/Madrid';

const status = (over: Record<string, unknown> = {}) => ({
  display_name: 'Propiedad sintética', phase: 'incremental', coverage_from: '2025-11-13',
  coverage_through: '2026-11-12', last_step_at: FETCHED, last_step_status: 'complete', last_error_kind: null,
  last_fetched_at: FETCHED, time_zone: TZ, currency_code: 'EUR', preflight: {}, flags: {},
  item_mapping_rule: null, ...over,
});
const clean = { window_from: '2026-10-01', window_to: '2026-10-31', row_count: 3, subject_to_thresholding: false,
  data_loss_from_other_row: false, data_truncation_reasons: [], sampling_metadatas: [], restricted_metrics: [],
  empty_reason: null, zona_distinta: false, fetched_at: FETCHED };
const traffic = (day: string, sessions: number, meta: number | null, over: Record<string, unknown> = {}) => ({
  day, sessions, active_users: 1, new_users: 1, meta_visits: meta, provisional: false,
  traffic_quality: clean, source_quality: meta === null ? null : clean, ...over });
const CURRENT = [traffic('2026-10-20', 10, 4), traffic('2026-10-21', 5, 1), traffic('2026-11-02', 7, 0)];
const PREVIOUS = [traffic('2026-09-20', 12, 6)];

function read(over: Partial<Ga4TrafficRead> = {}): Ga4TrafficRead {
  return { status: status(), current: CURRENT, previous: PREVIOUS, ...over };
}

describe('M16f-T-09: preparación de la sección de GA4', () => {
  it('suma sesiones y visitas desde Meta de cada ventana y deja la evidencia agregada del sitio', () => {
    const section = prepareGa4Section({ read: read(), window: W, ga4Timezone: TZ, metaTimezone: 'UTC', now: NOW })!;
    expect(section.summary).toMatchObject({ source: 'ga4', timezone: TZ, meta_timezone: 'UTC', partial: false,
      partial_reasons: [], covered_from: '2025-11-13', covered_through: '2026-11-12',
      window: { from: W.from, to: W.to, prev_from: W.prev_from, prev_to: W.prev_to } });
    expect(Object.fromEntries(section.evidence.map((e) => [e.id, e.value]))).toEqual({
      ev_ga4_cur_sessions: '22', ev_ga4_cur_meta_visits: '5', ev_ga4_prev_sessions: '12', ev_ga4_prev_meta_visits: '6',
    });
    for (const e of section.evidence) {
      expect(e).toMatchObject({ level: 'site', entity_alias: null, segment: null, attribution: 'unknown',
        unit: 'count', currency: null, kind: 'system_fact' });
      expect(e.provenance.fn).toBe('get_ga4_traffic');
    }
    // Nunca el número de propiedad ni su nombre en la sección persistida.
    expect(JSON.stringify(section)).not.toContain('Propiedad sintética');
  });

  it('marca parcial: extracción vieja, ventana sin cubrir, banderas de calidad y días provisionales', () => {
    const stale = prepareGa4Section({ read: read({ status: status({ last_fetched_at: '2026-11-12T11:00:00+00:00' }) }),
      window: W, ga4Timezone: TZ, metaTimezone: null, now: NOW })!;
    expect(stale.summary.partial_reasons).toEqual(['sync_stale']);
    const uncovered = prepareGa4Section({ read: read({ status: status({ coverage_through: '2026-11-10' }) }),
      window: W, ga4Timezone: TZ, metaTimezone: null, now: NOW })!;
    expect(uncovered.summary.partial_reasons).toEqual(['window_not_covered']);
    const flagged = prepareGa4Section({ read: read({ current: [traffic('2026-10-20', 10, 4,
      { traffic_quality: { ...clean, subject_to_thresholding: true }, provisional: true })] }),
    window: W, ga4Timezone: TZ, metaTimezone: null, now: NOW })!;
    expect(flagged.summary.partial_reasons).toEqual(['quality_flags', 'provisional']);
  });

  it('visitas desde Meta desconocidas si falta el informe de fuentes de algún día; sin cobertura no hay sección', () => {
    const unknown = prepareGa4Section({ read: read({ current: [...CURRENT, traffic('2026-11-03', 2, null)] }),
      window: W, ga4Timezone: TZ, metaTimezone: null, now: NOW })!;
    expect(unknown.evidence.find((e) => e.id === 'ev_ga4_cur_meta_visits')!.value).toBeNull();
    expect(unknown.evidence.find((e) => e.id === 'ev_ga4_cur_sessions')!.value).toBe('24');
    expect(prepareGa4Section({ read: read({ status: status({ coverage_through: null }) }), window: W,
      ga4Timezone: TZ, metaTimezone: null, now: NOW })).toBeNull();
    expect(prepareGa4Section({ read: read({ status: null }), window: W, ga4Timezone: TZ, metaTimezone: null,
      now: NOW })).toBeNull();
  });

  it('una ventana cubierta sin filas es cero; una sin cubrir y sin filas no se inventa', () => {
    const zero = prepareGa4Section({ read: read({ current: [], previous: [] }), window: W, ga4Timezone: TZ,
      metaTimezone: null, now: NOW })!;
    expect(zero.evidence.map((e) => [e.id, e.value])).toEqual([['ev_ga4_cur_sessions', '0'],
      ['ev_ga4_cur_meta_visits', '0'], ['ev_ga4_prev_sessions', '0'], ['ev_ga4_prev_meta_visits', '0']]);
    const missing = prepareGa4Section({ read: read({ status: status({ coverage_from: W.from }), previous: [] }),
      window: W, ga4Timezone: TZ, metaTimezone: null, now: NOW })!;
    expect(missing.evidence.find((e) => e.id === 'ev_ga4_prev_sessions')!.value).toBeNull();
  });
});

const CTX = { user_id: 'aaaaaaaa-0000-4000-8000-000000000001', company_id: 'c0000000-0000-4000-8000-000000000001',
  role: 'owner', request_id: 'e0000000-0000-4000-8000-000000000001' } as unknown as TenantContext;
const META = 'cc000000-0000-4000-8000-000000000001';
const SYNC_AT = '2026-11-13T01:02:03.123456Z';

function report(req: StructuredRequest): unknown {
  if (req.step === 'batch') return { notes: [] };
  return {
    executive_summary: { text: 'El gasto fue [[ev_acct_cur_spend]].', evidence_ids: ['ev_acct_cur_spend'] },
    overall_performance: { text: 'Rendimiento estable.', evidence_ids: ['ev_acct_cur_ctr'] },
    top_entities: [], breakdowns: [{ dimension: 'country', text: 'Estimación de Meta.',
      evidence_ids: ['ev_bd_country_1_spend'] }], opportunities: [], web_notes: [],
  };
}

function harness(ga4: GenerationContext['ga4'], opts: { store?: GenerationContext['store']; ga4Error?: boolean } = {}) {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const workerCalls: { fn: string; args: readonly unknown[] }[] = [];
  const structured: StructuredRequest[] = [];
  const base = prepareInput();
  const deps: DiagnosticDeps = {
    ctx: CTX,
    loadContext: async () => ({ connection: { id: META, status: 'active', credentialGeneration: 4 },
      settings: { goal_kind: 'purchase', metric_ref: 'actions:purchase' }, profile: { country: null, industry: null },
      levelStatus: { account: 'complete', campaign: 'complete', adset: 'complete', ad: 'complete' },
      syncFinishedAt: SYNC_AT, metaTimezone: 'UTC', store: opts.store ?? null, ga4 }),
    loadAttributionWindows: async () => [],
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args });
      switch (fn) {
        case 'meta_diagnostic_eligibility': return { data: [{ eligible: true, reason: null, available_at: null,
          sync_finished_at: SYNC_AT, window_to: '2026-11-12' }], error: null };
        case 'meta_diagnostic_account_metrics': return { data: [base.account.current, base.account.previous], error: null };
        case 'meta_diagnostic_entity_metrics':
          return { data: args.p_level === 'campaign' && args.p_after_ref === null ? [entity('campaign', 1)] : [], error: null };
        case 'meta_diagnostic_breakdown_metrics':
          return { data: args.p_dimension === 'country' ? [segment('country', 'AR')] : [], error: null };
        case 'get_ga4_sync_status': return opts.ga4Error ? { data: null, error: { message: 'x' } }
          : { data: [status()], error: null };
        case 'get_ga4_traffic': return { data: args.p_from === W.from ? CURRENT : PREVIOUS, error: null };
        case 'get_tn_sync_status': return { data: [{ covered_through: '2026-11-12', last_fetched_at: FETCHED }], error: null };
        case 'get_tn_sales': return { data: [], error: null };
        default: return { data: null, error: { message: 'inesperado' } };
      }
    },
    worker: { call: async (fn: string, args: readonly unknown[]) => {
      workerCalls.push({ fn, args });
      if (fn === 'reserve_diagnostic') return [{ reserve_diagnostic: 'reserved' }];
      if (fn === 'publish_diagnostic') return [{ publish_diagnostic: 'published' }];
      return [{ release_diagnostic: true }];
    } } as DiagnosticDeps['worker'],
    model: {
      web: async () => ({ blocks: [], usage: { input_tokens: 1, output_tokens: 1, web_searches: 0 },
        reportedModel: DIAGNOSTIC_MODEL_ID }),
      structured: async (req) => { structured.push(req); return { json: report(req),
        usage: { input_tokens: 1, output_tokens: 1, web_searches: 0 }, reportedModel: DIAGNOSTIC_MODEL_ID }; },
    },
    log: () => undefined,
    now: () => NOW,
  };
  const published = () => {
    const call = workerCalls.find((c) => c.fn === 'publish_diagnostic')!;
    return { args: call.args, report: JSON.parse(call.args[5] as string) };
  };
  return { deps, rpcCalls, structured, published };
}

describe('M16f-T-09/C-12: generación con y sin GA4', () => {
  it('con GA4 activa y cubierta publica v3 con la sección y la conexión de GA4 como octavo argumento', async () => {
    const h = harness({ id: GA4, status: 'active', timezone: TZ });
    expect(await generateDiagnostic(h.deps)).toEqual({ code: 'generado' });
    expect(h.rpcCalls.filter((c) => c.fn.startsWith('get_ga4_'))).toEqual([
      { fn: 'get_ga4_sync_status', args: { p_connection_id: GA4 } },
      { fn: 'get_ga4_traffic', args: { p_connection_id: GA4, p_from: W.from, p_to: W.to } },
      { fn: 'get_ga4_traffic', args: { p_connection_id: GA4, p_from: W.prev_from, p_to: W.prev_to } },
    ]);
    const { args, report: stored } = h.published();
    expect(args).toHaveLength(8);
    expect(args[6]).toBeNull();
    expect(args[7]).toBe(GA4);
    expect(stored).toMatchObject({ schema_version: 3, methodology_version: 'meta-fuentes-diag-1' });
    expect(Object.keys(stored.evidence).sort()).toEqual(['ga4', 'items', 'manifest', 'totals']);
    expect(stored.evidence.items.filter((e: { level: string }) => e.level === 'site')).toHaveLength(4);
    expect(h.structured[0].system).toMatch(/sin causalidad/u);
    expect(h.structured[0].user).toContain('ev_ga4_cur_sessions');
    expect(JSON.stringify(stored)).not.toContain('Propiedad sintética');
  });

  it('con GA4 y la tienda activas publica v3 con las dos secciones y las dos conexiones', async () => {
    const h = harness({ id: GA4, status: 'active', timezone: TZ },
      { store: { id: STORE, status: 'active', timezone: 'America/Argentina/Buenos_Aires' } });
    expect(await generateDiagnostic(h.deps)).toEqual({ code: 'generado' });
    const { args, report: stored } = h.published();
    expect([args[6], args[7]]).toEqual([STORE, GA4]);
    expect(stored.schema_version).toBe(3);
    expect(Object.keys(stored.evidence).sort()).toEqual(['ga4', 'items', 'manifest', 'store', 'totals']);
  });

  it('sin GA4 activa, con lectura fallida o sin cobertura, el informe no cambia', async () => {
    for (const ga4 of [null, { id: GA4, status: 'needs_reauth', timezone: TZ }] as const) {
      const h = harness(ga4);
      expect(await generateDiagnostic(h.deps)).toEqual({ code: 'generado' });
      expect(h.rpcCalls.some((c) => c.fn.startsWith('get_ga4_'))).toBe(false);
      const { args, report: stored } = h.published();
      expect(args[7]).toBeNull();
      expect(stored).toMatchObject({ schema_version: 1, methodology_version: 'meta-diag-1' });
      expect(h.structured[0].system).not.toMatch(/Google Analytics|ga4/u);
    }
    const failing = harness({ id: GA4, status: 'active', timezone: TZ }, { ga4Error: true });
    expect(await generateDiagnostic(failing.deps)).toEqual({ code: 'generado' });
    expect(failing.published().report.schema_version).toBe(1);
    expect(failing.published().args[7]).toBeNull();
  });
});

async function v3Stored() {
  const prepared = attachGa4Section(readyPackage(), prepareGa4Section({ read: read({
    status: status({ coverage_through: '2026-11-10' }) }), window: W, ga4Timezone: TZ, metaTimezone: 'UTC', now: NOW })!);
  const evaluable = Object.entries(prepared.sectionPlan.breakdowns)
    .filter(([, plan]) => plan.status === 'evaluable').map(([dimension]) => dimension);
  const output = {
    executive_summary: { text: 'El gasto fue [[ev_acct_cur_spend]] y el sitio tuvo [[ev_ga4_cur_sessions]] sesiones.',
      evidence_ids: ['ev_acct_cur_spend', 'ev_ga4_cur_sessions'] },
    overall_performance: { text: 'Rendimiento estable.', evidence_ids: ['ev_acct_cur_spend'] },
    top_entities: [], opportunities: [], web_notes: [],
    breakdowns: evaluable.map((dimension) => ({ dimension, text: 'Estimación de Meta.',
      evidence_ids: [prepared.evidence.find((e) => e.segment?.dimension === dimension)!.id] })),
  };
  const run = await runModelSteps({ prepared, profile: { country: null, industry: null }, deadlineAt: NOW + 60_000,
    now: () => NOW, model: { web: async () => { throw new Error('sin web'); },
      structured: async () => ({ json: output, usage: { input_tokens: 1, output_tokens: 1, web_searches: 0 },
        reportedModel: DIAGNOSTIC_MODEL_ID }) } });
  expect(run.output.executive_summary.text).toContain('22');
  const built = buildReport({ prepared, run, syncFinishedAt: SYNC_AT });
  return { generated_at: '2026-11-13T15:30:00.000000+00:00', window_from: built.window.from,
    window_to: built.window.to, prev_from: built.window.prev_from, prev_to: built.window.prev_to,
    sync_finished_at: '2026-11-13T01:02:03.123456+00:00', schema_version: built.schema_version,
    methodology_version: built.methodology_version, settings: built.settings, evidence: built.evidence,
    output: built.output, web_sources: built.web_sources, model_requested: built.model_requested,
    model_reported: built.model_reported, usage: built.usage };
}

describe('M16f-T-09/C-12: pantalla y PDF con la sección de GA4', () => {
  it('la sección muestra sesiones y visitas desde Meta, dos zonas, extracción y parcialidad, sin atribuir', async () => {
    const doc = composeDocument(parseStoredReport(await v3Stored()));
    const titles = doc.sections.map((s) => s.title);
    expect(titles.indexOf('Tráfico del sitio')).toBe(titles.indexOf('Rendimiento general') + 1);
    const section = doc.sections.find((s) => s.title === 'Tráfico del sitio')!;
    const texts = section.blocks.flatMap((b) => b.kind === 'table' ? [...b.columns, ...b.rows.flat()]
      : b.kind === 'list' ? [...b.items] : [b.text]).join(' ');
    expect(texts).toContain('Sesiones del sitio (GA4)');
    expect(texts).toContain('22');
    expect(texts).toContain(`Zona horaria de Meta: UTC. Zona horaria de la propiedad: ${TZ}.`);
    expect(texts).toMatch(/sin causalidad/u);
    expect(texts).toMatch(/Sección parcial: .*cobertura completa de Google Analytics/u);
    expect(texts).not.toMatch(/ROAS|costo por visita|ventas del sitio/iu);
    expect(texts).toContain('No son clics de Meta ni ventas.');
    expect(doc.meta).toContainEqual({ label: 'Fuentes', value: 'Meta Ads y Google Analytics (dos series distintas)' });
    expect(doc.footer).toContain('meta-fuentes-diag-1');
    expect(doc.footer).toContain('ni en Google Analytics');
    expect(documentTexts(doc)).toContain('Tráfico del sitio');
  });

  it('los informes v1 y v2 siguen leyéndose sin la sección de GA4', async () => {
    const row = await v3Stored();
    const evidence = { items: row.evidence.items.filter((e) => e.level !== 'site'), totals: row.evidence.totals,
      manifest: row.evidence.manifest };
    const v1 = composeDocument(parseStoredReport({ ...row, schema_version: 1, methodology_version: 'meta-diag-1',
      evidence }));
    expect(v1.sections.map((s) => s.title)).not.toContain('Tráfico del sitio');
    expect(v1.footer).toContain('meta-diag-1');
    const legacy = composeDocument(parseStoredReport({ ...row, schema_version: undefined,
      methodology_version: undefined, evidence }));
    expect(legacy.footer).toContain('meta-diag-1');
  });
});
