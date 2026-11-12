import { describe, expect, it } from 'vitest';

import { shareOfTotal, relativeToMax } from '@/modules/chat/scale';
import { renderTurn } from '@/modules/chat/render';
import { parseToolResult } from '@/modules/chat/tools/results';
import type { ToolName } from '@/modules/chat/tools/schema';

const period = { from: '2026-01-01', to: '2026-01-02' };
const otherPeriod = { from: '2026-02-01', to: '2026-02-02' };
const entity = 'a0000000-0000-4000-8000-000000000001';
const composition = { days_total: 2, days_with_value: 1, days_metric_missing: 0,
  days_no_row: 1, days_not_observed: 0, days_open: 0, days_captured_partial: 0,
  fetched_at_min: '2026-01-03T00:00:00Z',
  fetched_at_max: '2026-01-04T00:00:00Z', observed_from: period.from,
  observed_to: period.to, partial: true };
const rawValue = { path_key: 'total', metric: 'spend', unit: 'money', currency: 'USD',
  action_type: null, attribution_ref: null, period, period_a: null, period_b: null,
  day: null, entity_ref: entity, entity_name: 'Campaña sintética', parent_ref: null,
  segment_primary: null, segment_secondary: null, value: '1234.50', absence: null,
  presence: null, temporal_status: null, captured_partial: false, fetched_at: null,
  composition };
const scope = { level: 'campaign', entity_ref: entity,
  entity_name: 'Campaña sintética', period, period_a: null, period_b: null,
  period_defaulted: false, entity_defaulted: false,
  timezone: 'America/Argentina/Buenos_Aires', currency: 'USD' };
const recordId = 'b0000000-0000-4000-8000-000000000001';

function result(tool: ToolName, values: Record<string, unknown>[] = [rawValue],
  overrides: Record<string, unknown> = {}, id = 't1') {
  const { scope: scopeOverrides, extra, composition: comp, ...rest } = overrides;
  return parseToolResult({ status: 'ok', reason: null,
    scope: { ...scope, ...((scopeOverrides as object) ?? {}) }, values,
    composition: comp === undefined ? composition : comp,
    extra: extra ?? {}, ...rest }, id, '…0151', tool);
}

function answer(text: string, blocks: Record<string, unknown>[] = []) {
  return { text, blocks };
}
function block(type: string, pathPrefix = '/values') {
  return { type, sources: [{ tool_call_id: 't1', path_prefix: pathPrefix }],
    options: type === 'barras' ? { ordering: 'source' } : undefined };
}

describe('M25a-T-44/79/93: presentación básica y escala', () => {
  it('calcula proporciones exactas con BigInt, restos, ceros y ausencias', () => {
    const shares = shareOfTotal(['1', '1', '1', null]);
    expect(shares).toEqual([3334, 3333, 3333, null]);
    expect(shares.filter((value): value is number => value !== null)
      .reduce((sum, value) => sum + value, 0)).toBe(10000);
    expect(shareOfTotal(['0', '0', null])).toEqual([0, 0, null]);
    expect(relativeToMax(['9007199254740993', '9007199254740993', null]))
      .toEqual([10000, 10000, null]);
  });

  it('arma pie completo y cuenta enmascarada para una respuesta con datos', () => {
    const view = renderTurn({ kind: 'answer', answer: answer('Gastaste 1.234,50.'),
      results: [result('total')], accountRef: '1234567890151', recordId });
    expect(view).toMatchObject({ kind: 'answer', record_id: recordId, can_vote: true,
      footer: { account: '…0151', timezone: 'America/Argentina/Buenos_Aires',
        defaulted: false, entity_defaulted: false } });
    expect(view.footer?.period).toContain('01/01/2026');
    expect(view.footer?.coverage).toContain('1 de 2');
    expect(view.footer?.freshness).toContain('04/01/2026 00:00 UTC');
    expect(JSON.stringify(view)).not.toContain('1234567890151');
  });

  it('separa dos períodos y omite período y composición cuando solo hay catálogo o estado', () => {
    const first = result('total');
    const second = result('total', [{ ...rawValue, period: otherPeriod }],
      { scope: { period: otherPeriod } }, 't2');
    const two = renderTurn({ kind: 'answer', answer: answer('Datos'),
      results: [first, second], accountRef: '…0151', recordId });
    expect(two.footer?.period).toContain('01/02/2026');
    expect(two.footer?.coverage).toContain('01/01/2026');
    for (const tool of ['entities', 'connection_status'] as const) {
      const only = renderTurn({ kind: 'answer', answer: answer('Datos'),
        results: [result(tool, [], { scope: { period: null }, composition: null,
          extra: tool === 'connection_status' ?
            { last_finished_at: '2026-01-03T00:00:00Z' } : {} })],
        accountRef: '…0151', recordId });
      expect(only.footer?.period).toBeNull();
      expect(only.footer?.coverage).toBeNull();
      if (tool === 'connection_status') expect(only.footer?.freshness)
        .toContain('03/01/2026 00:00 UTC');
    }
  });

  it('incluye la composición de a y b y no muestra datos de período en una abstención', () => {
    const compared = result('compare_periods', [{ ...rawValue, path_key: 'a',
      period: null, period_a: period, period_b: otherPeriod }],
    { scope: { period: null, period_a: period, period_b: otherPeriod },
      extra: { composition_a: composition, composition_b: { ...composition,
        observed_from: otherPeriod.from, observed_to: otherPeriod.to } } });
    const shown = renderTurn({ kind: 'answer', answer: answer('Comparación'),
      results: [compared], accountRef: '…0151', recordId });
    expect(shown.footer?.coverage).toContain('01/01/2026');
    expect(shown.footer?.coverage).toContain('01/02/2026');
    const withheld = renderTurn({ kind: 'abstention', reason: 'no_coverage',
      results: [compared], accountRef: '…0151', recordId });
    expect(withheld.footer?.period).toBeNull();
    expect(withheld.segments[0].text).toContain('esos períodos');
  });

  it('da los pies correctos para aclaración, abstención y aviso sin conexión', () => {
    for (const kind of ['clarification', 'abstention'] as const) {
      const view = renderTurn({ kind, reason: kind === 'abstention' ?
        'out_of_scope' : undefined, text: kind === 'clarification' ?
        '¿Qué campaña?' : undefined, results: [result('total')],
        accountRef: '…0151', recordId });
      expect(view.footer?.account).toBe('…0151');
      expect(view.footer?.period).toBeNull();
      expect(view.footer?.coverage).toBeNull();
    }
    const noConnection = renderTurn({ kind: 'abstention',
      reason: 'connection_not_active', connectionStatus: null, accountRef: null,
      results: [], recordId });
    expect(noConnection.footer).toBeNull();
    expect(noConnection.link_to_integrations).toBe(true);
    expect(noConnection.segments[0].text).toContain('Todavía no hay una cuenta');
    const notice = renderTurn({ kind: 'notice', reason: 'invalid_input',
      results: [], accountRef: null, recordId: null });
    expect(notice.footer).toBeNull();
    expect(notice.can_vote).toBe(false);
    const noCoverage = renderTurn({ kind: 'abstention', reason: 'no_coverage',
      results: [result('coverage', [], { extra: { nearest_before: '2025-12-31' } })],
      accountRef: '…0151', recordId });
    expect(noCoverage.segments[0].text).toContain('01/01/2026');
    expect(noCoverage.segments[0].text).toContain('de las campañas');
    expect(noCoverage.footer?.period).toBeNull();
    const reauth = renderTurn({ kind: 'abstention',
      reason: 'connection_not_active', connectionStatus: 'needs_reauth',
      accountRef: '…0151', results: [], recordId });
    expect(reauth.segments[0].text).toContain('volver a autorizar');
    expect(reauth.footer?.account).toBe('…0151');
    const forgedNotice = renderTurn({ kind: 'notice', reason: 'invalid_input',
      accountRef: '…0151', results: [], recordId });
    expect(forgedNotice.can_vote).toBe(false);
    expect(forgedNotice.record_id).toBeNull();
  });

  it('segmenta marcadores y deja el resto del texto del modelo como texto plano', () => {
    const named = result('total', [{ ...rawValue, entity_name: 'Promo 2x1 2026' }],
      { scope: { entity_name: 'Promo 2x1 2026' } });
    const view = renderTurn({ kind: 'answer', answer: answer('⟦ENTIDAD_A⟧: 30'),
    results: [named], accountRef: '…0151', recordId });
    expect(view.segments.map((segment) => segment.type))
      .toEqual(['entity', 'plain']);
    expect(view.segments[0].text).toBe('Promo 2x1 2026');
    expect(view.segments[1].text).toBe(': 30');
    expect(JSON.stringify(view)).not.toContain('⟦ENTIDAD_A⟧');
  });

  it('selecciona filas básicas y conserva ausencia como null, con marca parcial', () => {
    const daily = result('daily_series', [
      { ...rawValue, path_key: 'day', day: '2026-01-01',
        presence: 'con_datos', composition: null, value: '2' },
      { ...rawValue, path_key: 'day', day: '2026-01-02',
        presence: 'sin_fila_reportada', composition: null, value: null,
        absence: 'sin_fila_reportada' },
    ]);
    const view = renderTurn({ kind: 'answer', answer: answer('Serie',
      [block('lineas')]), results: [daily], accountRef: '…0151', recordId });
    expect(view.blocks[0].series[0].points.map((point) => point.text))
      .toEqual(['2', null]);
    expect(view.blocks[0].series[0].points[1].ratio).toBeNull();
    expect(view.blocks[0].table.rows[1].join(' ')).toContain('Sin fila reportada');
    expect(JSON.stringify(view)).not.toContain('act_');
  });

  it('muestra solo entidades del ranking y marca cada fila parcial', () => {
    const partial = { ...composition, days_with_value: 1, days_no_row: 1,
      partial: true };
    const complete = { ...composition, days_with_value: 2, days_no_row: 0,
      partial: false };
    const ranked = result('ranking', [
      { ...rawValue, path_key: 'entity', value: '10', composition: partial },
      { ...rawValue, path_key: 'entity', value: '5', composition: complete,
        entity_name: 'Otra campaña' },
      { ...rawValue, path_key: 'excluded_count', metric: 'excluded_count',
        unit: 'count', currency: null, value: '1', entity_ref: null,
        entity_name: null, composition: null },
    ]);
    const view = renderTurn({ kind: 'answer', answer: answer('Ranking',
      [block('ranking')]), results: [ranked], accountRef: '…0151', recordId });
    expect(view.blocks[0].table.rows).toHaveLength(2);
    expect(view.blocks[0].table.rows[0].join(' ')).toContain('parcial: 1 de 2');
    expect(view.blocks[0].table.rows[1].join(' ')).not.toContain('parcial:');
    expect(view.blocks[0].notes.join(' ')).toContain('Algunas filas');
  });

  it('agrega advertencias fijas por atribución y datos estimados', () => {
    const unknown = result('total', [{ ...rawValue, attribution_ref: 'unknown' }]);
    const view = renderTurn({ kind: 'answer', answer: answer('Dato',
      [block('tarjeta', '/values/0')]), results: [unknown],
      accountRef: '…0151', recordId });
    expect(view.footer?.data_limits.join(' ')).toContain('Meta no informa');
    expect(view.blocks[0].notes.join(' ')).toContain('Meta no informa');
    const clean = renderTurn({ kind: 'answer', answer: answer('Dato'),
      results: [result('total')], accountRef: '…0151', recordId });
    expect(clean.footer?.data_limits).not.toEqual(expect.arrayContaining([
      expect.stringContaining('Meta no informa')]));
    const incompatible = renderTurn({ kind: 'answer', answer: answer('Dato'),
      results: [result('total', [], { status: 'not_calculable',
        reason: 'attribution_incompatible' })], accountRef: '…0151', recordId });
    expect(incompatible.footer?.data_limits.join(' ')).toContain('No puedo sumar');
    const mixed = result('total', [rawValue], { extra: { attribution_mixed: true } });
    expect(renderTurn({ kind: 'answer', answer: answer('Dato'), results: [mixed],
      accountRef: '…0151', recordId }).footer?.data_limits.join(' '))
      .toContain('ventanas de atribución distintas');
    const breakdown = result('breakdown', [{ ...rawValue, path_key: 'segment',
      metric: 'clicks', unit: 'count', currency: null, value: '2' }],
    { extra: { last_result: { result: 'failed' } } });
    const estimated = renderTurn({ kind: 'answer', answer: answer('Dato',
      [block('barras')]), results: [breakdown], accountRef: '…0151', recordId });
    expect(estimated.footer?.data_limits.join(' ')).toContain('estimados');
    expect(estimated.footer?.data_limits.join(' ')).toContain('desactualizados');
  });

  it('muestra la participación devuelta por la herramienta en la dona', () => {
    const pieces = result('breakdown', [
      { ...rawValue, path_key: 'segment', metric: 'clicks', unit: 'count',
        currency: null, value: '2', segment_primary: 'A' },
      { ...rawValue, path_key: 'segment_share', metric: 'share', unit: 'percent',
        currency: null, value: '66.67', segment_primary: 'A' },
      { ...rawValue, path_key: 'segment', metric: 'clicks', unit: 'count',
        currency: null, value: '1', segment_primary: 'B' },
      { ...rawValue, path_key: 'segment_share', metric: 'share', unit: 'percent',
        currency: null, value: '33.33', segment_primary: 'B' },
    ]);
    const view = renderTurn({ kind: 'answer', answer: answer('Partes',
      [block('dona')]), results: [pieces], accountRef: '…0151', recordId });
    expect(view.blocks[0].table.rows[0][2]).toBe('66.67%');
    expect(view.blocks[0].table.rows[1][2]).toBe('33.33%');
  });

  it('declara los dos límites de historia parcial del alcance citado', () => {
    const longer = { from: '2026-01-01', to: '2026-01-03' };
    const shortened = { ...composition, days_total: 3,
      observed_from: '2026-01-02', observed_to: '2026-01-02',
      days_with_value: 1, days_no_row: 2,
      partial: true };
    const shown = renderTurn({ kind: 'answer', answer: answer('Dato',
      [block('tarjeta')]), results: [result('total', [{ ...rawValue,
        period: longer, composition: shortened }], { composition: shortened,
          scope: { period: longer } })],
    accountRef: '…0151', recordId });
    expect(shown.footer?.data_limits.join(' ')).toContain('de las campañas, tengo datos desde el 02/01/2026');
    expect(shown.footer?.data_limits.join(' ')).toContain('de las campañas, tengo datos hasta el 02/01/2026');
  });
});

describe('M25a.3 T-79/93: catálogo completo', () => {
  it('alinea pilas por día, reparte cada total y escala su altura', () => {
    const otherEntity = 'a0000000-0000-4000-8000-000000000002';
    const day = (date: string, value: string | null, ref: string, name: string) => ({
      ...rawValue, path_key: 'day', day: date, presence: value === null ?
        'sin_fila_reportada' : 'con_datos', composition: null, value,
      absence: value === null ? 'sin_fila_reportada' : null,
      entity_ref: ref, entity_name: name });
    const first = result('daily_series', [day(period.from, '1', entity, 'Primera'),
      day(period.to, '4', entity, 'Primera')]);
    const second = result('daily_series', [day(period.from, '2', otherEntity, 'Segunda'),
      day(period.to, null, otherEntity, 'Segunda')],
    { scope: { entity_ref: otherEntity, entity_name: 'Segunda' } }, 't2');
    const stacked = { type: 'barras_apiladas', sources: [
      { tool_call_id: 't1', path_prefix: '/values' },
      { tool_call_id: 't2', path_prefix: '/values' }] };
    const view = renderTurn({ kind: 'answer', answer: answer('Pila', [stacked]),
      results: [first, second], accountRef: '…0151', recordId });
    expect(view.blocks[0].stack_ratios).toEqual([7500, 10000]);
    expect(view.blocks[0].series[0].points[0].ratio).toBe(3333);
    expect(view.blocks[0].series[1].points[0].ratio).toBe(6667);
    expect(view.blocks[0].series[1].points[1]).toMatchObject({
      text: null, ratio: null, absence: 'sin_fila_reportada' });
    expect(view.blocks[0].table.rows[0].at(-1)).toBe('3');
    expect(view.blocks[0].table.rows[1].at(-1)).toBe('4');
  });

  it('no apila series de otra métrica y respeta la fila citada', () => {
    const otherEntity = 'a0000000-0000-4000-8000-000000000002';
    const day = (date: string, value: string, ref: string, extra = {}) => ({
      ...rawValue, path_key: 'day', day: date, presence: 'con_datos', composition: null,
      value, absence: null, entity_ref: ref, ...extra });
    const spend = result('daily_series', [day(period.from, '1', entity),
      day(period.to, '4', entity)]);
    const clicks = result('daily_series', [day(period.from, '2', otherEntity,
      { metric: 'clicks', unit: 'count', currency: null })],
    { scope: { entity_ref: otherEntity } }, 't2');
    const stacked = { type: 'barras_apiladas', sources: [
      { tool_call_id: 't1', path_prefix: '/values' },
      { tool_call_id: 't2', path_prefix: '/values' }] };
    expect(() => renderTurn({ kind: 'answer', answer: answer('Pila', [stacked]),
      results: [spend, clicks], accountRef: '…0151', recordId })).toThrow();
    const compatible = result('daily_series', [day(period.from, '2', otherEntity)],
      { scope: { entity_ref: otherEntity } }, 't2');
    const onlyFirstDay = { type: 'barras_apiladas', sources: [
      { tool_call_id: 't1', path_prefix: '/values/0' },
      { tool_call_id: 't2', path_prefix: '/values' }] };
    const view = renderTurn({ kind: 'answer', answer: answer('Pila', [onlyFirstDay]),
      results: [spend, compatible], accountRef: '…0151', recordId });
    expect(view.blocks[0].table.rows).toHaveLength(1);
  });

  it('lleva la tendencia con huecos al DTO y deja al padre sin sumar hijos', () => {
    const childRef = 'a0000000-0000-4000-8000-000000000002';
    const ranked = result('ranking', [{ ...rawValue, path_key: 'entity',
      value: '10' }], { extra: { trends: { [entity]: [
        { day: period.from, value: '2', absence: null },
        { day: period.to, value: null, absence: 'no_observado' }] } } });
    const trend = renderTurn({ kind: 'answer', answer: answer('Tendencia',
      [block('tabla_tendencia')]), results: [ranked], accountRef: '…0151', recordId });
    expect(trend.blocks[0].series[0].points.map((point) => point.text))
      .toEqual(['2', null]);
    expect(trend.blocks[0].series[0].points[1].ratio).toBeNull();

    const children = result('ranking', [{ ...rawValue, path_key: 'entity',
      entity_ref: childRef, entity_name: 'Conjunto', parent_ref: entity,
      value: '7' }], { scope: { level: 'adset' } }, 't2');
    const drill = { type: 'tabla_desplegable', sources: [
      { tool_call_id: 't1', path_prefix: '/values' },
      { tool_call_id: 't2', path_prefix: '/values' }] };
    const view = renderTurn({ kind: 'answer', answer: answer('Detalle', [drill]),
      results: [ranked, children], accountRef: '…0151', recordId });
    expect(view.blocks[0].table.rows[0][1]).toContain('10');
    expect(view.blocks[0].table.rows[0][1]).not.toContain('17');
    expect(view.blocks[0].children?.[0].parent).toBe('Campaña sintética');
    expect(view.blocks[0].children?.[0].rows[0]).toEqual([
      'Conjunto', expect.stringContaining('7')]);
  });

  it('presenta variación, estado, fuentes y sugerencias con datos y texto del servidor', () => {
    const change = result('percent_change', [{ ...rawValue, path_key: 'change',
      unit: 'percent', currency: null, period: null, period_a: period,
      period_b: otherPeriod, composition: null, value: '-12.50' }],
    { scope: { period: null, period_a: period, period_b: otherPeriod } });
    const variation = renderTurn({ kind: 'answer', answer: answer('Variación',
      [block('resumen_variacion')]), results: [change], accountRef: '…0151', recordId });
    expect(variation.blocks[0].title).toBe('Variación');
    expect(variation.blocks[0].table.rows[0]).toContain('-12.50');
    expect(variation.blocks[0].notes.join(' ')).not.toMatch(/estable|bien|mal/iu);

    const coverage = result('coverage', [], { extra: { history_from: period.from,
      history_to: period.to } });
    const state = renderTurn({ kind: 'answer', answer: answer('Estado',
      [block('estado_datos')]), results: [coverage], accountRef: '…0151', recordId });
    expect(JSON.stringify(state.blocks[0])).toContain('01/01/2026');
    const sources = renderTurn({ kind: 'answer', answer: answer('Fuentes',
      [block('fuentes_metodologia')]), results: [change], accountRef: '…0151', recordId });
    expect(sources.blocks[0].table.rows.length).toBeGreaterThan(0);
    const suggestions = renderTurn({ kind: 'answer', answer: answer('Sugerencias',
      [{ type: 'preguntas_sugeridas', sources: [], ids: ['ver_en_tabla'] }]),
      results: [], accountRef: '…0151', recordId });
    expect(suggestions.blocks[0].suggestions?.[0].text).toMatch(/tabla/iu);
  });

  it('muestra las conclusiones del modelo siempre como interpretación', () => {
    const view = renderTurn({ kind: 'answer', answer: answer('Resumen', [{
      type: 'conclusiones', sources: [], items: [{ text: 'Lectura orientativa.' }],
    }]), results: [], accountRef: '…0151', recordId });
    expect(view.blocks[0].items?.[0].provenance).toBe('Interpretación');
    expect(view.blocks[0].items?.[0].segments.map((item) => item.text).join(''))
      .toBe('Lectura orientativa.');
  });

  it('muestra fórmulas fijas y estado de conexión sin IDs internos', () => {
    const measure = result('total', [{ ...rawValue, metric: 'ctr', unit: 'percent',
      currency: null, value: '2.5' }]);
    const method = renderTurn({ kind: 'answer', answer: answer('Método',
      [block('fuentes_metodologia')]), results: [measure],
      accountRef: '…0151', recordId });
    const text = JSON.stringify(method.blocks[0]);
    expect(text).toContain('clics');
    expect(text).toContain('impresiones');
    expect(text).not.toContain('tool_call_id');
    expect(text).not.toContain('t1');

    const connection = result('connection_status', [], { scope: { period: null },
      composition: null, extra: { connection_status: 'active',
        last_finished_at: '2026-01-03T00:00:00Z' } });
    const state = renderTurn({ kind: 'answer', answer: answer('Estado',
      [block('estado_datos')]), results: [connection],
      accountRef: '…0151', recordId });
    expect(JSON.stringify(state.blocks[0])).toContain('03/01/2026');
  });

  it('identifica cada tipo de acción y avisa la duración desigual', () => {
    const typeRows = result('action_types', [{ ...rawValue, path_key: 'action_count',
      metric: 'action_count', unit: 'count', currency: null,
      action_type: 'purchase', value: '2' },
    { ...rawValue, path_key: 'action_value', metric: 'action_value',
      action_type: 'purchase', value: '8' }]);
    const breakdown = renderTurn({ kind: 'answer', answer: answer('Tipos',
      [block('desglose_tipo_resultado')]), results: [typeRows],
      accountRef: '…0151', recordId });
    expect(breakdown.blocks[0].table.rows).toEqual([
      ['purchase · Cantidad', expect.stringContaining('2')],
      ['purchase · Valor', expect.stringContaining('8')],
    ]);
    const shorter = { from: '2026-02-01', to: '2026-02-01' };
    const compared = result('compare_periods', [{ ...rawValue, path_key: 'a',
      period: period, composition: null }], { scope: { period: null,
        period_a: period, period_b: shorter } });
    const comparison = renderTurn({ kind: 'answer', answer: answer('Períodos',
      [block('periodo_contra_periodo')]), results: [compared],
      accountRef: '…0151', recordId });
    expect(comparison.blocks[0].notes.join(' ')).toContain('distinta duración');
  });

  it('incluye en pie y bloque una cifra con atribución desconocida citada en un bloque', () => {
    const unknown = result('total', [{ ...rawValue, attribution_ref: 'unknown' }]);
    const view = renderTurn({ kind: 'answer', answer: answer('Resumen',
      [block('tarjeta', '/values/0')]), results: [unknown], accountRef: '…0151', recordId });
    expect(view.footer?.data_limits.join(' ')).toContain('Meta no informa');
    expect(view.blocks[0].notes.join(' ')).toContain('Meta no informa');
  });

  it('advierte una comparación visual de entidades con ventanas conocidas distintas', () => {
    const otherEntity = 'a0000000-0000-4000-8000-000000000002';
    const ranked = result('ranking', [
      { ...rawValue, path_key: 'entity', value: '10', attribution_ref: 'a' },
      { ...rawValue, path_key: 'entity', value: '8', entity_ref: otherEntity,
        entity_name: 'Otra campaña', attribution_ref: 'b' },
    ]);
    const view = renderTurn({ kind: 'answer', answer: answer('Ranking',
      [block('ranking')]), results: [ranked], accountRef: '…0151', recordId });
    expect(view.footer?.data_limits.join(' ')).toContain('ventanas de atribución distintas');
    expect(view.blocks[0].notes.join(' ')).toContain('ventanas de atribución distintas');
  });
});

describe('M25a.3 T-89: historia y alcance del servidor', () => {
  it('declara por separado los límites de ambos períodos de una comparación', () => {
    const a = { ...composition, observed_from: period.to, observed_to: period.to };
    const b = { ...composition, observed_from: otherPeriod.from,
      observed_to: otherPeriod.from };
    const compared = result('compare_periods', [{ ...rawValue, path_key: 'a',
      composition: a }], { scope: { period: null, period_a: period,
      period_b: otherPeriod }, composition: { ...composition,
        observed_from: null, observed_to: null },
    extra: { composition_a: a, composition_b: b } });
    const view = renderTurn({ kind: 'answer', answer: answer('Comparación',
      [block('periodo_contra_periodo')]), results: [compared],
    accountRef: '…0151', recordId });
    expect(view.footer?.data_limits).toContain('de las campañas, tengo datos desde el 02/01/2026.');
    expect(view.footer?.data_limits).toContain('de las campañas, tengo datos hasta el 01/02/2026.');
  });

  it.each([
    [{ nearest_before: '2025-12-31' },
      'de las campañas, tengo datos hasta el 31/12/2025.'],
    [{ nearest_after: '2026-01-03' },
      'de las campañas, tengo datos desde el 03/01/2026.'],
    [{ nearest_before: '2025-12-31', nearest_after: '2026-01-03' },
      'de las campañas, tengo datos hasta el 31/12/2025 y de nuevo desde el 03/01/2026.'],
    [{}, 'Todavía no tengo datos de las campañas.'],
  ])('resuelve datos cercanos sin fechas del modelo', (extra, ending) => {
    const empty = result('coverage', [], { extra });
    const view = renderTurn({ kind: 'abstention', reason: 'no_coverage',
      results: [empty], accountRef: '…0151', recordId });
    expect(view.segments[0].text).toBe('No tengo datos del 01/01/2026 al 02/01/2026. ' + ending);
  });

  it.each([
    ['account', 'coverage', {}, 'de la cuenta'],
    ['campaign', 'coverage', {}, 'de las campañas'],
    ['adset', 'coverage', {}, 'de los conjuntos'],
    ['ad', 'coverage', {}, 'de los anuncios'],
    ['account', 'breakdown', { dimension: 'age_gender' }, 'de edad y género'],
    ['campaign', 'breakdown', { dimension: 'country' }, 'de los países por campaña'],
    ['account', 'breakdown', { dimension: 'region' }, 'de las regiones'],
  ] as const)('%s/%s usa el alcance correcto', (level, tool, extra, expected) => {
    const empty = result(tool, [], { scope: { level }, extra: {
      ...extra, nearest_before: '2025-12-31' } });
    const view = renderTurn({ kind: 'abstention', reason: 'no_coverage',
      results: [empty], accountRef: '…0151', recordId });
    expect(view.segments[0].text).toContain(expected);
    expect(view.segments[0].text).toContain('31/12/2025');
    expect(view.segments[0].text).not.toContain('2025-12-31');
  });

  it('ignora un not_found anterior al elegir período y alcance de cobertura', () => {
    const missing = result('total', [], { status: 'not_found',
      reason: 'entity_not_found', scope: { level: 'campaign',
        period: otherPeriod } }, 't1');
    const empty = result('coverage', [], { scope: { level: 'account' },
      extra: { nearest_before: '2025-12-31' } }, 't2');
    const view = renderTurn({ kind: 'abstention', reason: 'no_coverage',
      results: [missing, empty], accountRef: '…0151', recordId });
    expect(view.segments[0].text).toBe('No tengo datos del 01/01/2026 al 02/01/2026. ' +
      'de la cuenta, tengo datos hasta el 31/12/2025.');
  });

  it('dos períodos y varios alcances usan el texto fijo correcto', () => {
    const compared = result('compare_periods', [], { scope: { period: null,
      period_a: period, period_b: otherPeriod },
    extra: { history_from: '2025-12-01', history_to: '2026-03-01' } });
    const two = renderTurn({ kind: 'abstention', reason: 'no_coverage',
      results: [compared], accountRef: '…0151', recordId });
    expect(two.segments[0].text).toContain('mis datos van del 01/12/2025 al 01/03/2026');
    const adset = result('coverage', [], { scope: { level: 'adset' } }, 't2');
    const mixed = renderTurn({ kind: 'abstention', reason: 'no_coverage',
      results: [result('coverage', []), adset], accountRef: '…0151', recordId });
    expect(mixed.segments[0].text).toBe('No tengo datos del 01/01/2026 al 02/01/2026.');
  });
});

describe('M25a.3 paso 23: hallazgos del recorrido', () => {
  it('rotula el texto del asistente como no verificado y no muestra la nota sin texto', () => {
    const withText = renderTurn({ kind: 'answer', answer: answer('Una posible lectura es esta.'),
      results: [result('total')], accountRef: '…0151', recordId });
    expect(withText.footer?.data_limits.join(' ')).toContain('lectura del asistente');
    expect(withText.footer?.data_limits.join(' ')).toContain('puede incluir números que no vienen de tus datos');
    const withoutText = renderTurn({ kind: 'answer', answer: answer('  ', [block('tabla')]),
      results: [result('total')], accountRef: '…0151', recordId });
    expect(withoutText.footer?.data_limits.join(' ')).not.toContain('lectura del asistente');
  });

  it('el texto fijo de fuera de alcance no sugiere falta de datos', () => {
    const view = renderTurn({ kind: 'abstention', reason: 'out_of_scope', results: [],
      accountRef: null, recordId });
    const text = view.segments.map((segment) => segment.text).join('');
    expect(text).toContain('no responde temas ajenos');
    expect(text).not.toContain('con estos datos');
  });

  it('no repite filas si el modelo cita dos veces el mismo resultado', () => {
    const ranked = result('ranking', [
      { ...rawValue, path_key: 'entity', value: '10' },
      { ...rawValue, path_key: 'entity', value: '8', entity_ref: 'a0000000-0000-4000-8000-000000000002',
        entity_name: 'Otra campaña' },
    ]);
    const twice = { type: 'ranking', options: null, items: null, ids: null,
      sources: [{ tool_call_id: 't1', path_prefix: '/values' },
        { tool_call_id: 't1', path_prefix: '/values' }] };
    const view = renderTurn({ kind: 'answer', answer: answer('Ranking', [twice]),
      results: [ranked], accountRef: '…0151', recordId });
    expect(view.blocks[0].table.rows).toHaveLength(2);
  });

  it('un bloque sin filas lo dice en vez de mostrarse vacío', () => {
    const view = renderTurn({ kind: 'answer', answer: answer('Participación',
      [block('dona')]), results: [result('total', [rawValue])], accountRef: '…0151', recordId });
    expect(view.blocks[0].table.rows).toHaveLength(0);
    expect(view.blocks[0].notes.join(' ')).toContain('No hay datos para mostrar');
  });

  it('el embudo y la tarjeta rotulan cada paso con su métrica', () => {
    const steps = [['impressions', 'Impresiones', 't1'], ['clicks', 'Clics', 't2']].map(
      ([metric, , id]) => result('total', [{ ...rawValue, metric, unit: 'count',
        currency: null, value: '10' }], {}, id));
    const funnel = { type: 'embudo', options: null, items: null, ids: null,
      sources: [{ tool_call_id: 't1', path_prefix: '/values' },
        { tool_call_id: 't2', path_prefix: '/values' }] };
    const view = renderTurn({ kind: 'answer', answer: answer('Embudo', [funnel]),
      results: steps, accountRef: '…0151', recordId });
    expect(view.blocks[0].table.rows.map((row) => row[0])).toEqual(['Impresiones', 'Clics']);
  });

  it('una tendencia sin datos de tendencia muestra el ranking con un aviso', () => {
    const ranked = result('ranking', [{ ...rawValue, path_key: 'entity', value: '10' }]);
    const view = renderTurn({ kind: 'answer', answer: answer('Tendencia',
      [block('tabla_tendencia')]), results: [ranked], accountRef: '…0151', recordId });
    expect(view.blocks[0].table.rows).toHaveLength(1);
    expect(view.blocks[0].notes.join(' ')).toContain('No hay tendencia disponible');
  });
});

describe('barras agrupadas: agrupación para el gráfico horizontal', () => {
  it('agrupa por métrica y distingue el período A del B', () => {
    const compared = result('compare_periods', [
      { ...rawValue, path_key: 'a', value: '10' },
      { ...rawValue, path_key: 'b', value: '5' },
    ]);
    const view = renderTurn({ kind: 'answer', answer: answer('Comparación',
      [block('barras_agrupadas')]), results: [compared], accountRef: '…0151', recordId });
    const points = view.blocks[0].series[0].points;
    expect(points.map((point) => [point.group, point.member])).toEqual([
      ['Gasto', 'Período A'], ['Gasto', 'Período B']]);
    expect(points.map((point) => point.ratio)).toEqual([10000, 5000]);
  });

  it('agrupa edad y género con el género como miembro', () => {
    const segments = result('breakdown', [
      { ...rawValue, path_key: 'segment', metric: 'clicks', unit: 'count', currency: null,
        value: '8', segment_primary: '25-34', segment_secondary: 'female' },
      { ...rawValue, path_key: 'segment', metric: 'clicks', unit: 'count', currency: null,
        value: '4', segment_primary: '25-34', segment_secondary: 'male' },
    ]);
    const view = renderTurn({ kind: 'answer', answer: answer('Edad',
      [block('barras_agrupadas')]), results: [segments], accountRef: '…0151', recordId });
    expect(view.blocks[0].series[0].points.map((point) => [point.group, point.member]))
      .toEqual([['25-34', 'female'], ['25-34', 'male']]);
  });

  it('sin segundo segmento no hay grupo y barras simples no llevan grupo', () => {
    const countries = result('breakdown', [
      { ...rawValue, path_key: 'segment', metric: 'clicks', unit: 'count', currency: null,
        value: '8', segment_primary: 'AR' },
    ]);
    const grouped = renderTurn({ kind: 'answer', answer: answer('País',
      [block('barras_agrupadas')]), results: [countries], accountRef: '…0151', recordId });
    expect(grouped.blocks[0].series[0].points[0]).toMatchObject({ group: null, member: 'AR' });
    const simple = renderTurn({ kind: 'answer', answer: answer('País',
      [block('barras')]), results: [countries], accountRef: '…0151', recordId });
    expect(simple.blocks[0].series[0].points[0]).not.toHaveProperty('group');
  });
});
