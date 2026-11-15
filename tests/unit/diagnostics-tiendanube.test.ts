import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { composeDocument, documentTexts, parseStoredReport } from '@/modules/diagnostics/compose';
import { attachStoreSection, prepareStoreSection, type StoreSalesRead } from '@/modules/diagnostics/evidence';
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
 * M16e-T-12 (unit): sección «Ventas de la tienda» del diagnóstico. Agregados de Tiendanube para
 * las mismas fechas de calendario que la ventana de Meta y la anterior, sin datos individuales,
 * con parcialidad, dos zonas visibles y versión 2 solo cuando hay sección.
 */

const STORE = 'dd000000-0000-4000-8000-0000000000e5';
const NOW = Date.parse('2026-11-13T12:00:00Z');
const FETCHED = '2026-11-13T03:00:00.123456+00:00';
const TZ = 'America/Argentina/Buenos_Aires';

const status = (over: Record<string, unknown> = {}) => ({
  phase: 'incremental', backfill_done: true, coverage_until: '2026-11-13T03:00:00+00:00',
  covered_through: '2026-11-12', timezone: TZ, currency: 'ARS', store_domain: 'tienda.mitiendanube.com',
  last_run_started_at: FETCHED, last_run_finished_at: FETCHED, last_run_status: 'complete',
  last_error_kind: null, last_fetched_at: FETCHED, catalog_complete_at: FETCHED, ...over,
});
const day = (period_start: string, currency: string | null, paid: number, partial: number, covered = true,
  amount = 0, refunded = 0) => ({ period_start, currency, paid_orders: paid, paid_orders_without_customer: 0,
  partially_paid_orders: partial, paid_amount: amount, refunded_amount: refunded, covered, fetched_at: FETCHED,
  timezone: TZ, definition: 'tn_sales_v1' });

const CURRENT = [day('2026-10-20', 'ARS', 3, 1, true, 900), day('2026-10-21', 'USD', 1, 0, true, 30),
  day('2026-10-22', null, 0, 0), day('2026-11-02', 'ARS', 2, 0, true, 200, 50)];
const PREVIOUS = [day('2026-09-20', 'ARS', 4, 0, true, 400)];

function read(over: Partial<StoreSalesRead> = {}): StoreSalesRead {
  return { status: status(), current: CURRENT, previous: PREVIOUS, ...over };
}

describe('M16e-T-12: preparación de la sección de la tienda', () => {
  it('suma por moneda los días de cada ventana, nunca mezcla monedas y deja la evidencia agregada', () => {
    const section = prepareStoreSection({ read: read(), window: W, storeTimezone: TZ, metaTimezone: 'UTC', now: NOW })!;
    expect(section.summary).toMatchObject({ source: 'tiendanube', timezone: TZ, meta_timezone: 'UTC',
      window: { from: W.from, to: W.to, prev_from: W.prev_from, prev_to: W.prev_to }, partial: false,
      partial_reasons: [], covered_through: '2026-11-12' });
    const byId = Object.fromEntries(section.evidence.map((e) => [e.id, e.value]));
    expect(byId).toEqual({
      ev_tn_cur_paid_orders_ars: '5', ev_tn_cur_partially_paid_orders_ars: '1',
      ev_tn_prev_paid_orders_ars: '4', ev_tn_prev_partially_paid_orders_ars: '0',
      ev_tn_cur_paid_orders_usd: '1', ev_tn_cur_partially_paid_orders_usd: '0',
      ev_tn_prev_paid_orders_usd: '0', ev_tn_prev_partially_paid_orders_usd: '0',
    });
    for (const e of section.evidence) {
      expect(e).toMatchObject({ level: 'store', entity_alias: null, segment: null, attribution: 'unknown',
        unit: 'count', kind: 'system_fact', sample: 'ok' });
      expect(e.provenance.fn).toBe('get_tn_sales');
    }
    expect(section.evidence.find((e) => e.id === 'ev_tn_cur_paid_orders_ars')!.period).toEqual({ from: W.from, to: W.to });
    expect(section.evidence.some((e) => e.metric === 'tn_collected_amount')).toBe(false);
  });

  it('el monto cobrado solo aparece con la constante activa, por moneda', () => {
    const section = prepareStoreSection({ read: read(), window: W, storeTimezone: TZ, metaTimezone: null, now: NOW,
      collectedAmountEnabled: true })!;
    const amounts = section.evidence.filter((e) => e.metric === 'tn_collected_amount')
      .map((e) => [e.id, e.currency, e.unit, e.value]);
    expect(amounts).toEqual([
      ['ev_tn_cur_collected_amount_ars', 'ARS', 'money', '1050'],
      ['ev_tn_prev_collected_amount_ars', 'ARS', 'money', '400'],
      ['ev_tn_cur_collected_amount_usd', 'USD', 'money', '30'],
      ['ev_tn_prev_collected_amount_usd', 'USD', 'money', '0'],
    ]);
  });

  it('marca parcial una sincronización de más de 24 horas o una ventana sin cobertura completa', () => {
    const stale = prepareStoreSection({ read: read({ status: status({ last_fetched_at: '2026-11-12T11:00:00+00:00' }) }),
      window: W, storeTimezone: TZ, metaTimezone: 'UTC', now: NOW })!;
    expect(stale.summary).toMatchObject({ partial: true, partial_reasons: ['sync_stale'] });
    const uncovered = prepareStoreSection({ read: read({ status: status({ covered_through: '2026-11-10' }),
      current: [...CURRENT, day('2026-11-11', null, 0, 0, false)] }), window: W, storeTimezone: TZ,
    metaTimezone: 'UTC', now: NOW })!;
    expect(uncovered.summary).toMatchObject({ partial: true, partial_reasons: ['window_not_covered'] });
  });

  it('sin una ventana cubierta o sin estado no hay sección (el informe queda en v1)', () => {
    expect(prepareStoreSection({ read: read({ status: status({ covered_through: null }) }), window: W,
      storeTimezone: TZ, metaTimezone: 'UTC', now: NOW })).toBeNull();
    expect(prepareStoreSection({ read: read({ status: null }), window: W, storeTimezone: TZ, metaTimezone: 'UTC',
      now: NOW })).toBeNull();
  });

  it('sin ventas en un período cubierto informa cero real, no ausencia', () => {
    const section = prepareStoreSection({ read: read({ current: [day('2026-10-20', null, 0, 0)], previous: [] }),
      window: W, storeTimezone: TZ, metaTimezone: 'UTC', now: NOW })!;
    expect(section.evidence.map((e) => [e.id, e.value])).toEqual([
      ['ev_tn_cur_paid_orders_sin_moneda', '0'], ['ev_tn_cur_partially_paid_orders_sin_moneda', '0'],
      ['ev_tn_prev_paid_orders_sin_moneda', '0'], ['ev_tn_prev_partially_paid_orders_sin_moneda', '0'],
    ]);
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

function harness(store: GenerationContext['store'], opts: { tnRows?: unknown; tnError?: boolean } = {}) {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const workerCalls: { fn: string; args: readonly unknown[] }[] = [];
  const structured: StructuredRequest[] = [];
  const base = prepareInput();
  const deps: DiagnosticDeps = {
    ctx: CTX,
    loadContext: async () => ({ connection: { id: META, status: 'active', credentialGeneration: 4 },
      settings: { goal_kind: 'purchase', metric_ref: 'actions:purchase' }, profile: { country: null, industry: null },
      levelStatus: { account: 'complete', campaign: 'complete', adset: 'complete', ad: 'complete' },
      syncFinishedAt: SYNC_AT, metaTimezone: 'UTC', store }),
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
        case 'get_tn_sync_status': return opts.tnError ? { data: null, error: { message: 'x' } }
          : { data: (opts.tnRows as unknown[]) ?? [status()], error: null };
        case 'get_tn_sales': return { data: args.p_from === W.from ? CURRENT : PREVIOUS, error: null };
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
  return { deps, rpcCalls, workerCalls, structured, published };
}

describe('M16e-T-12: publicación por el cliente real de worker_api', () => {
  it('envía la conexión de la tienda como séptimo argumento tipado, y null para v1', async () => {
    const { createWorkerApi } = await import('@/modules/integrations/db/worker-api');
    const { publishDiagnostic } = await import('@/modules/diagnostics/repository');
    const sent: { text: string; values: unknown[] }[] = [];
    const worker = createWorkerApi({ pool: {
      query: async (config: { text: string; values: unknown[] }) => {
        sent.push(config);
        return { rows: [{ publish_diagnostic: 'published' }] as never[] };
      },
      on: () => undefined, end: async () => undefined,
    } });
    for (const storeConnectionId of [STORE, null]) {
      expect(await publishDiagnostic(worker, CTX, { connectionId: META, generation: 4, report: {},
        storeConnectionId })).toBe('published');
    }
    expect(sent[0].text).toBe('select * from worker_api.publish_diagnostic($1::uuid, $2::uuid, $3::uuid, '
      + '$4::uuid, $5::integer, $6::jsonb, $7::uuid)');
    expect(sent.map((s) => s.values[6])).toEqual([STORE, null]);
  });
});

describe('M16e-T-12: generación con y sin Tiendanube', () => {
  it('con Tiendanube activa y cubierta publica v2 con la sección y la conexión de la tienda', async () => {
    const h = harness({ id: STORE, status: 'active', timezone: TZ });
    expect(await generateDiagnostic(h.deps)).toEqual({ code: 'generado' });
    const tn = h.rpcCalls.filter((c) => c.fn.startsWith('get_tn_'));
    expect(tn).toEqual([
      { fn: 'get_tn_sync_status', args: { p_connection_id: STORE } },
      { fn: 'get_tn_sales', args: { p_connection_id: STORE, p_from: W.from, p_to: W.to, p_grain: 'day' } },
      { fn: 'get_tn_sales', args: { p_connection_id: STORE, p_from: W.prev_from, p_to: W.prev_to, p_grain: 'day' } },
    ]);
    const { args, report: stored } = h.published();
    expect(args).toHaveLength(7);
    expect(args[6]).toBe(STORE);
    expect(stored).toMatchObject({ schema_version: 2, methodology_version: 'meta-tn-diag-1' });
    expect(Object.keys(stored.evidence).sort()).toEqual(['items', 'manifest', 'store', 'totals']);
    expect(stored.evidence.store).toMatchObject({ source: 'tiendanube', timezone: TZ, meta_timezone: 'UTC' });
    expect(stored.evidence.items.filter((e: { level: string }) => e.level === 'store')).toHaveLength(8);
    // El modelo recibe solo agregados con su regla de no atribución; ningún dato individual ni el dominio.
    const user = h.structured[0].user;
    expect(user).toContain('ev_tn_cur_paid_orders_ars');
    expect(user).not.toContain('tienda.mitiendanube.com');
    expect(user).not.toMatch(/customer|order_id|external_|product_key|email/iu);
    expect(h.structured[0].system).toMatch(/no las atribuyas a Meta/u);
  });

  it('sin Tiendanube el informe no cambia: v1, sin lecturas de la tienda y sin séptimo argumento con valor', async () => {
    for (const store of [null, { id: STORE, status: 'needs_reauth', timezone: TZ }] as const) {
      const h = harness(store);
      expect(await generateDiagnostic(h.deps)).toEqual({ code: 'generado' });
      expect(h.rpcCalls.some((c) => c.fn.startsWith('get_tn_'))).toBe(false);
      const { args, report: stored } = h.published();
      expect(args[6]).toBeNull();
      expect(stored).toMatchObject({ schema_version: 1, methodology_version: 'meta-diag-1' });
      expect(Object.keys(stored.evidence).sort()).toEqual(['items', 'manifest', 'totals']);
      expect(h.structured[0].system).not.toMatch(/Tiendanube/u);
    }
  });

  it('una lectura fallida o sin cobertura de la tienda no bloquea: se publica v1', async () => {
    const failing = harness({ id: STORE, status: 'active', timezone: TZ }, { tnError: true });
    expect(await generateDiagnostic(failing.deps)).toEqual({ code: 'generado' });
    expect(failing.published().report.schema_version).toBe(1);
    const empty = harness({ id: STORE, status: 'active', timezone: TZ }, { tnRows: [status({ covered_through: null })] });
    expect(await generateDiagnostic(empty.deps)).toEqual({ code: 'generado' });
    expect(empty.published().args[6]).toBeNull();
  });
});

async function v2Stored() {
  const prepared = attachStoreSection(readyPackage(), prepareStoreSection({ read: read({
    status: status({ covered_through: '2026-11-10' }) }), window: W, storeTimezone: TZ, metaTimezone: 'UTC', now: NOW })!);
  // Salida sintética que cita la evidencia de la tienda y respeta los desgloses evaluables del fixture.
  const evaluable = Object.entries(prepared.sectionPlan.breakdowns)
    .filter(([, plan]) => plan.status === 'evaluable').map(([dimension]) => dimension);
  const output = {
    executive_summary: { text: 'El gasto fue [[ev_acct_cur_spend]] y la tienda tuvo [[ev_tn_cur_paid_orders_ars]].',
      evidence_ids: ['ev_acct_cur_spend', 'ev_tn_cur_paid_orders_ars'] },
    overall_performance: { text: 'Rendimiento estable.', evidence_ids: ['ev_acct_cur_spend'] },
    top_entities: [], opportunities: [], web_notes: [],
    breakdowns: evaluable.map((dimension) => ({ dimension, text: 'Estimación de Meta.',
      evidence_ids: [prepared.evidence.find((e) => e.segment?.dimension === dimension)!.id] })),
  };
  const run = await runModelSteps({ prepared, profile: { country: null, industry: null }, deadlineAt: NOW + 60_000,
    now: () => NOW, model: { web: async () => { throw new Error('sin web'); },
      structured: async () => ({ json: output, usage: { input_tokens: 1, output_tokens: 1, web_searches: 0 },
        reportedModel: DIAGNOSTIC_MODEL_ID }) } });
  expect(run.output.executive_summary.text).toContain('5');
  const built = buildReport({ prepared, run, syncFinishedAt: SYNC_AT });
  return { built, row: {
    generated_at: '2026-11-13T15:30:00.000000+00:00', window_from: built.window.from, window_to: built.window.to,
    prev_from: built.window.prev_from, prev_to: built.window.prev_to, sync_finished_at: '2026-11-13T01:02:03.123456+00:00',
    schema_version: built.schema_version, methodology_version: built.methodology_version,
    settings: built.settings, evidence: built.evidence, output: built.output, web_sources: built.web_sources,
    model_requested: built.model_requested, model_reported: built.model_reported, usage: built.usage } };
}

describe('M16e-T-12: pantalla y PDF con la sección de la tienda', () => {
  it('la sección va al lado del rendimiento de Meta, con dos zonas, definiciones, extracción y parcialidad', async () => {
    const { row } = await v2Stored();
    const doc = composeDocument(parseStoredReport(row));
    const titles = doc.sections.map((s) => s.title);
    expect(titles.indexOf('Ventas de la tienda')).toBe(titles.indexOf('Rendimiento general') + 1);
    const section = doc.sections.find((s) => s.title === 'Ventas de la tienda')!;
    const texts = section.blocks.flatMap((b) => b.kind === 'table' ? [...b.columns, ...b.rows.flat()]
      : b.kind === 'list' ? [...b.items] : [b.text]);
    expect(texts).toContain('Pedidos pagados');
    expect(texts).toContain('5');
    expect(texts.join(' ')).toContain(`Zona horaria de Meta: UTC. Zona horaria de la tienda: ${TZ}.`);
    expect(texts.join(' ')).toMatch(/no se atribuyen a Meta/u);
    expect(texts.join(' ')).toMatch(/Última extracción de Tiendanube: 13\/11\/2026/u);
    expect(texts.join(' ')).toMatch(/Sección parcial: .*cobertura completa/u);
    expect(texts.join(' ')).not.toMatch(/ingreso neto|cobrado/iu);
    expect(doc.meta).toContainEqual({ label: 'Fuentes', value: 'Meta Ads y Tiendanube (dos series distintas)' });
    expect(doc.footer).toContain('meta-tn-diag-1');
    expect(documentTexts(doc)).toContain('Ventas de la tienda');
  });

  it('un informe v1 se sigue leyendo igual, sin la sección', async () => {
    const { built } = await v2Stored();
    const legacy = { generated_at: '2026-11-13T15:30:00.000000+00:00', window_from: built.window.from,
      window_to: built.window.to, prev_from: built.window.prev_from, prev_to: built.window.prev_to,
      sync_finished_at: '2026-11-13T01:02:03.123456+00:00', settings: built.settings,
      evidence: { items: built.evidence.items.filter((e) => e.level !== 'store'), totals: built.evidence.totals,
        manifest: built.evidence.manifest }, output: built.output, web_sources: built.web_sources,
      model_requested: built.model_requested, model_reported: built.model_reported, usage: built.usage };
    const doc = composeDocument(parseStoredReport(legacy));
    expect(doc.sections.map((s) => s.title)).not.toContain('Ventas de la tienda');
    expect(doc.footer).toContain('meta-diag-1');
    expect(doc.meta.some((m) => m.label === 'Fuentes')).toBe(false);
  });
});
