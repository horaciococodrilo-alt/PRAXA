import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type {
  AccountMetricsRow,
  BreakdownMetricsRow,
  EntityMetricsRow,
} from '@/modules/diagnostics/contract';
import { METRIC_LABELS } from '@/modules/diagnostics/contract';
import {
  estimateTokens,
  isLowSample,
  prepareDiagnostic,
  windowsFor,
  type PrepareInput,
} from '@/modules/diagnostics/evidence';
import { extractAttributionWindows, readAllEntities, readBreakdowns } from '@/modules/diagnostics/repository';

const W = windowsFor('2026-11-12');

function account(over: Partial<AccountMetricsRow> = {}): AccountMetricsRow {
  return {
    period: 'current', spend: '294.00', impressions: '28000', clicks: '560', link_clicks: '420',
    result_count: '56', result_value: '840.00', ctr: '2.000000', cpc: '0.525000', cpm: '10.500000',
    cost_per_result: '5.250000', attributed_return: '2.857143', currency: 'USD', attribution: 'unknown',
    days_with_data: 28, days_no_row: 0, days_not_observed: 0, days_open: 0, days_partial: 0,
    activity_status: 'active', fetched_at_min: '2026-11-13T01:00:00.000000Z',
    fetched_at_max: '2026-11-13T01:00:00.000000Z', open_dates: [], partial_dates: [], ...over,
  };
}

function entity(n: number, over: Partial<EntityMetricsRow> = {}): EntityMetricsRow {
  return {
    entity_ref: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    name: `Campaña ${n}`, parent_ref: null, effective_status: 'ACTIVE', objective: 'OUTCOME_SALES',
    currency: 'USD', attribution: 'unknown',
    cur_spend: String(1000 - n), cur_impressions: '5000', cur_clicks: '200', cur_result_count: '40',
    cur_result_value: '400', cur_ctr: '4.000000', cur_cpc: '1.000000', cur_cpm: '40.000000',
    cur_cost_per_result: '5.000000', cur_attributed_return: '2.000000',
    prev_spend: null, prev_impressions: null, prev_clicks: null, prev_result_count: null,
    prev_result_value: null, prev_ctr: null, prev_cpc: null, prev_cpm: null,
    prev_cost_per_result: null, prev_attributed_return: null,
    var_spend: null, var_ctr: null, var_cost_per_result: null, var_attributed_return: null,
    days_with_row: 28, days_open: 0, ...over,
  };
}

function segment(key: string, over: Partial<BreakdownMetricsRow> = {}): BreakdownMetricsRow {
  return {
    dimension: 'country', segment_key: key, segment_label: key, spend: '50', impressions: '5000',
    clicks: '150', result_count: '40', ctr: '3.000000', cpc: '0.333333', cost_per_result: '1.250000',
    currency: 'USD', attribution: 'unknown', last_attempt_status: 'complete', segments_total: 1, ...over,
  };
}

function input(over: Partial<PrepareInput> = {}): PrepareInput {
  return {
    settings: { goal_kind: 'purchase', metric_ref: 'actions:purchase' },
    window: W,
    account: { current: account(), previous: account({ period: 'previous', spend: '140' }) },
    entities: { campaign: [entity(1)], adset: [], ad: [] },
    breakdowns: { age_gender: [], country: [segment('AR')], region: [] },
    levelStatus: { account: 'complete', campaign: 'complete', adset: 'complete', ad: 'complete' },
    pagesRead: 3,
    ...over,
  };
}

describe('M26a: ventana', () => {
  it('28 días que terminan en window_to y los 28 anteriores', () => {
    expect(W).toEqual({ from: '2026-10-16', to: '2026-11-12', prev_from: '2026-09-18', prev_to: '2026-10-15' });
    expect(windowsFor('2026-03-01')).toEqual({ from: '2026-02-02', to: '2026-03-01',
      prev_from: '2026-01-05', prev_to: '2026-02-01' });
    expect(() => windowsFor('2026-13-01')).toThrow();
  });
});

describe('M26a-T-08: cero, falta de cobertura y ausencia', () => {
  it('cero en días cubiertos es estado insuficiente sin paquete', () => {
    const out = prepareDiagnostic(input({ account: {
      current: account({ activity_status: 'zero', spend: '0', impressions: '0' }), previous: null } }));
    expect(out).toEqual({ status: 'insufficient', cause: 'no_activity' });
  });

  it('una ventana entera sin filas también es cero (cuenta vacía, H-E1-185)', () => {
    const out = prepareDiagnostic(input({ account: { current: account({ activity_status: 'zero',
      spend: null, impressions: null, clicks: null, days_with_data: 0, days_no_row: 28 }), previous: null } }));
    expect(out).toEqual({ status: 'insufficient', cause: 'no_activity' });
  });

  it('sin cobertura es «faltan datos», distinto de cero', () => {
    const out = prepareDiagnostic(input({ account: { current: account({ activity_status: 'no_coverage',
      spend: null, days_with_data: 0, days_no_row: 4, days_not_observed: 24 }), previous: null } }));
    expect(out).toEqual({ status: 'insufficient', cause: 'no_coverage' });
  });

  it('un dato ausente queda null en la evidencia, nunca cero', () => {
    const out = prepareDiagnostic(input({ account: { current: account({ result_count: null,
      result_value: null, cost_per_result: null, attributed_return: null }), previous: null } }));
    if (out.status !== 'ready') throw new Error('se esperaba paquete');
    const result = out.evidence.find((item) => item.id === 'ev_acct_cur_result_count');
    expect(result?.value).toBeNull();
    expect(out.limits).toContain('no_goal_action');
  });
});

describe('M26a-T-09: entidades, días abiertos y comparación', () => {
  it('conserva todas las entidades que SQL calificó, incluidas pausadas y con otra acción', () => {
    const paused = entity(2, { effective_status: 'PAUSED' });
    // SQL incluye esta fila por una acción observada distinta de la elegida como objetivo.
    const otherAction = entity(3, { cur_spend: '0', cur_impressions: '0', cur_clicks: '0',
      cur_result_count: null });
    const out = prepareDiagnostic(input({ entities: { campaign: [entity(1), paused, otherAction],
      adset: [], ad: [] } }));
    if (out.status !== 'ready') throw new Error('se esperaba paquete');
    expect(out.package.entities.map((e) => e.status)).toEqual(['ACTIVE', 'PAUSED', 'ACTIVE']);
    expect(out.manifest.entities_examined).toEqual({ campaign: 3, adset: 0, ad: 0 });
  });

  it('marca días abiertos, captura parcial y parcialidad por nivel', () => {
    const out = prepareDiagnostic(input({
      account: { current: account({ days_open: 1, open_dates: ['2026-11-12'], days_partial: 1,
        partial_dates: ['2026-11-12'] }), previous: account({ period: 'previous' }) },
      levelStatus: { account: 'complete', campaign: 'complete', adset: 'incomplete', ad: 'complete' },
    }));
    if (out.status !== 'ready') throw new Error('se esperaba paquete');
    expect(out.manifest.open_days).toEqual(['2026-11-12']);
    expect(out.manifest.partial_capture_days).toEqual(['2026-11-12']);
    expect(out.limits).toContain('partial_coverage');
    expect(out.package.level_coverage.adset).toBe('incomplete');
  });

  it('omite la comparación con cobertura previa incompleta o atribuciones distintas', () => {
    const gap = prepareDiagnostic(input({ account: { current: account(),
      previous: account({ period: 'previous', days_not_observed: 3 }) } }));
    const attr = prepareDiagnostic(input({ account: { current: account({ attribution: 'attr_a' }),
      previous: account({ period: 'previous', attribution: 'attr_b' }) } }));
    const mixed = prepareDiagnostic(input({ account: { current: account({ attribution: 'mixed' }),
      previous: account({ period: 'previous' }) } }));
    const ok = prepareDiagnostic(input());
    for (const out of [gap, attr, mixed]) {
      if (out.status !== 'ready') throw new Error('se esperaba paquete');
      expect(out.sectionPlan.comparison).toEqual({ status: 'not_evaluable', cause: 'no_comparison' });
      expect(out.evidence.some((item) => item.id.startsWith('ev_acct_prev_'))).toBe(false);
    }
    if (ok.status !== 'ready') throw new Error('se esperaba paquete');
    expect(ok.sectionPlan.comparison).toEqual({ status: 'evaluable' });
    expect(ok.evidence.find((item) => item.id === 'ev_acct_prev_spend')?.value).toBe('140');
  });
});

describe('M26a-T-10: recorrido completo, lotes y manifiesto', () => {
  it('recorre todas las páginas por clave sin depender del tope de filas', async () => {
    const all = Array.from({ length: 1205 }, (_, i) => entity(i + 1));
    const calls: Record<string, unknown>[] = [];
    const rpc = async (fn: string, args: Record<string, unknown>) => {
      calls.push(args);
      expect(fn).toBe('meta_diagnostic_entity_metrics');
      const start = args.p_after_ref
        ? all.findIndex((e) => e.entity_ref === args.p_after_ref) + 1 : 0;
      return { data: all.slice(start, start + (args.p_limit as number)), error: null };
    };
    const read = await readAllEntities(rpc, { connectionId: '00000000-0000-4000-8000-0000000000aa',
      level: 'ad', window: W, comparison: true, metricRef: 'actions:purchase', pageSize: 500 });
    expect(read.rows).toHaveLength(1205);
    expect(read.pages).toBe(3);
    expect(calls[1]).toMatchObject({ p_after_spend: all[499].cur_spend, p_after_ref: all[499].entity_ref });
    expect(new Set(read.rows.map((r) => r.entity_ref)).size).toBe(1205);
  });

  it('una página que repite la clave detiene el recorrido en vez de entrar en bucle', async () => {
    const rpc = async () => ({ data: [entity(1)], error: null });
    await expect(readAllEntities(rpc, { connectionId: '00000000-0000-4000-8000-0000000000aa',
      level: 'ad', window: W, comparison: false, metricRef: 'actions:purchase', pageSize: 1 }))
      .rejects.toThrow();
  });

  it('parte el conjunto en lotes por orden determinístico y registra el manifiesto', () => {
    const many = Array.from({ length: 600 }, (_, i) => entity(i + 1));
    const out = prepareDiagnostic(input({ entities: { campaign: many, adset: [], ad: [] }, budgetTokens: 100_000 }));
    if (out.status !== 'ready') throw new Error('se esperaba paquete');
    expect(out.batches.length).toBeGreaterThan(1);
    expect(out.batches.length).toBeLessThanOrEqual(3);
    expect(out.batches.flat()).toEqual(out.package.entities.map((e) => e.alias));
    expect(out.manifest.batches).toBe(out.batches.length);
    expect(out.manifest.pages_read).toBe(3);
    expect(out.package.entities[0].alias).toBe('e1');
    for (const batch of out.batches) {
      const slice = out.package.entities.filter((e) => batch.includes(e.alias));
      expect(estimateTokens(slice)).toBeLessThanOrEqual(100_000);
    }
  });

  it('si no alcanzan tres lotes, la preparación falla con too_large (no trunca)', () => {
    const many = Array.from({ length: 600 }, (_, i) => entity(i + 1));
    expect(() => prepareDiagnostic(input({ entities: { campaign: many, adset: [], ad: [] }, budgetTokens: 5_000 })))
      .toThrow(/too_large/);
  });

  it('un solo lote cuando entra en el presupuesto', () => {
    const out = prepareDiagnostic(input());
    if (out.status !== 'ready') throw new Error('se esperaba paquete');
    expect(out.batches).toEqual([['e1']]);
  });

  it('el nombre viaja truncado a 120 caracteres y sin entity_ref real', () => {
    const out = prepareDiagnostic(input({ entities: { campaign: [entity(1, { name: 'x'.repeat(300) })],
      adset: [], ad: [] } }));
    if (out.status !== 'ready') throw new Error('se esperaba paquete');
    expect(out.package.entities[0].name).toHaveLength(120);
    expect(JSON.stringify(out.package)).not.toContain(entity(1).entity_ref);
  });
});

describe('M26a-T-13: resultado del objetivo y retorno atribuido', () => {
  it('congela solo las ventanas que aportaron el resultado, sin referencias de conjuntos', () => {
    const rows = [{ rows: [
      { inline_link_clicks: '3', actions: [{ action_type: 'purchase', variant: 'value', count: '2', value: null }],
        attribution: { known: true, settings: [{ adset_ref: entity(1).entity_ref,
          windows: [{ event_type: 'click', days: 7 }, { event_type: 'view', days: 1 }] }] } },
      { inline_link_clicks: '1', actions: [{ action_type: 'lead', variant: 'value', count: '1', value: null }],
        attribution: { known: true, settings: [{ adset_ref: entity(2).entity_ref,
          windows: [{ event_type: 'click', days: 28 }] }] } },
    ] }];
    const windows = extractAttributionWindows(rows, 'actions:purchase');
    expect(windows).toEqual([{ event_type: 'click', days: 7 }, { event_type: 'view', days: 1 }]);
    expect(JSON.stringify(windows)).not.toContain(entity(1).entity_ref);
  });

  it('retorno solo con valor del tipo elegido; rótulo atribuido por Meta, nunca ganancia', () => {
    const out = prepareDiagnostic(input());
    if (out.status !== 'ready') throw new Error('se esperaba paquete');
    const ret = out.evidence.find((item) => item.id === 'ev_acct_cur_attributed_return');
    expect(ret).toMatchObject({ value: '2.857143', unit: 'ratio', kind: 'calculated_metric' });
    expect(METRIC_LABELS.attributed_return).toMatch(/atribuido por Meta/);
    expect(Object.values(METRIC_LABELS).join(' ').toLowerCase()).not.toMatch(/ganancia|roas/);
  });

  it('tráfico no produce evidencia de retorno', () => {
    const out = prepareDiagnostic(input({ settings: { goal_kind: 'traffic', metric_ref: 'inline_link_clicks' },
      account: { current: account({ result_count: '420', result_value: null, attributed_return: null }),
        previous: null } }));
    if (out.status !== 'ready') throw new Error('se esperaba paquete');
    expect(out.evidence.some((item) => item.metric === 'attributed_return')).toBe(false);
    expect(out.evidence.find((item) => item.id === 'ev_acct_cur_result_count')?.value).toBe('420');
  });

  it('atribución desconocida queda rotulada en la evidencia de resultado', () => {
    const out = prepareDiagnostic(input());
    if (out.status !== 'ready') throw new Error('se esperaba paquete');
    expect(out.evidence.find((item) => item.id === 'ev_acct_cur_result_count')?.attribution).toBe('unknown');
  });

  it('baja muestra la calcula el servidor', () => {
    expect(isLowSample({ impressions: '999', clicks: '500', results: '100' })).toBe(true);
    expect(isLowSample({ impressions: '5000', clicks: '99', results: '100' })).toBe(true);
    expect(isLowSample({ impressions: '5000', clicks: '500', results: null })).toBe(true);
    expect(isLowSample({ impressions: '1000', clicks: '100', results: '30' })).toBe(false);
    const out = prepareDiagnostic(input({ entities: { campaign: [entity(1, { cur_impressions: '10' })],
      adset: [], ad: [] } }));
    if (out.status !== 'ready') throw new Error('se esperaba paquete');
    expect(out.package.entities[0].low_sample).toBe(true);
    expect(out.evidence.filter((item) => item.entity_alias === 'e1').every((item) => item.sample === 'low_sample'))
      .toBe(true);
  });

  it('las cifras viajan como texto decimal exacto, sin pasar por number', () => {
    const big = '9007199254740993.125';
    const out = prepareDiagnostic(input({ account: { current: account({ spend: big }), previous: null } }));
    if (out.status !== 'ready') throw new Error('se esperaba paquete');
    expect(out.evidence.find((item) => item.id === 'ev_acct_cur_spend')?.value).toBe(big);
  });
});

describe('M26a-T-14: desgloses', () => {
  it('se piden solo de nivel cuenta', async () => {
    const seen: Record<string, unknown>[] = [];
    const rpc = async (_fn: string, args: Record<string, unknown>) => {
      seen.push(args);
      return { data: [], error: null };
    };
    await readBreakdowns(rpc, { connectionId: '00000000-0000-4000-8000-0000000000aa', window: W,
      metricRef: 'actions:purchase' });
    expect(seen.map((a) => [a.p_level, a.p_dimension])).toEqual([
      ['account', 'age_gender'], ['account', 'country'], ['account', 'region']]);
  });

  it('atribución unknown en resultado; región sin resultado; fallo o vacío no evaluable', () => {
    const out = prepareDiagnostic(input({ breakdowns: {
      age_gender: [],
      country: [segment('AR'), segment('UY', { segments_total: 60 })],
      region: [segment('Buenos Aires', { dimension: 'region', result_count: null, cost_per_result: null })],
    } }));
    if (out.status !== 'ready') throw new Error('se esperaba paquete');
    expect(out.sectionPlan.breakdowns.age_gender).toEqual({ status: 'not_evaluable', cause: 'breakdown_unavailable' });
    expect(out.sectionPlan.breakdowns.country).toEqual({ status: 'evaluable' });
    expect(out.package.breakdowns.region.result_unavailable).toBe(true);
    const countryResult = out.evidence.filter((item) => item.id.startsWith('ev_bd_country_') && item.metric === 'result_count');
    expect(countryResult.length).toBeGreaterThan(0);
    expect(countryResult.every((item) => item.attribution === 'unknown' && item.level === 'account')).toBe(true);
    expect(out.evidence.some((item) => item.id.startsWith('ev_bd_region_') && item.metric === 'result_count')).toBe(false);
    expect(out.manifest.segments_omitted).toEqual({ age_gender: 0, country: 58, region: 0 });
  });

  it('un último intento fallido marca la sección y no cambia los niveles', () => {
    const failed = prepareDiagnostic(input({ breakdowns: { age_gender: [], region: [],
      country: [segment('AR', { last_attempt_status: 'failed' })] } }));
    if (failed.status !== 'ready') throw new Error('se esperaba paquete');
    expect(failed.sectionPlan.breakdowns.country).toEqual({ status: 'not_evaluable', cause: 'breakdown_unavailable' });
    expect(failed.package.entities).toHaveLength(1);
  });

  it('todos los segmentos de baja muestra dan low_sample; moneda mixta deja el dinero null', () => {
    const out = prepareDiagnostic(input({ breakdowns: { age_gender: [], region: [], country: [
      segment('AR', { impressions: '10', currency: 'mixed', spend: null, cpc: null, cost_per_result: null })] } }));
    if (out.status !== 'ready') throw new Error('se esperaba paquete');
    expect(out.sectionPlan.breakdowns.country).toEqual({ status: 'not_evaluable', cause: 'low_sample' });
    expect(out.evidence.find((item) => item.id === 'ev_bd_country_1_spend')?.value ?? null).toBeNull();
  });
});
