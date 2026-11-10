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

function answer(text: string, blocks: Record<string, unknown>[] = [],
  claims: Record<string, unknown>[] = []) {
  return { text, claims, blocks };
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
    expect(view.footer?.freshness).toContain('2026-01-04');
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
        .toContain('2026-01-03');
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

  it('segmenta marcadores y cifra del dueño sin mostrar alias técnicos', () => {
    const named = result('total', [{ ...rawValue, entity_name: 'Promo 2x1 2026' }],
      { scope: { entity_name: 'Promo 2x1 2026' } });
    const view = renderTurn({ kind: 'answer', answer: answer('⟦ENTIDAD_A⟧: 30', [],
      [{ kind: 'user_provided', span: { quote: '30', occurrence: 1 } }]),
    results: [named], accountRef: '…0151', recordId });
    expect(view.segments.map((segment) => segment.type))
      .toEqual(['entity', 'plain', 'user_provided']);
    expect(view.segments[0].text).toBe('Promo 2x1 2026');
    expect(view.segments[2].text).toContain('según lo que mencionaste');
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
    const other = result('total', [{ ...rawValue, attribution_ref: 'known-b',
      entity_ref: 'a0000000-0000-4000-8000-000000000002' }], {}, 't2');
    const known = result('total', [{ ...rawValue,
      attribution_ref: 'known-a' }]);
    const comparison = renderTurn({ kind: 'answer', answer: answer('más que', [],
      [{ span: { quote: 'más que', occurrence: 1 },
        kind: 'qualitative_comparison', left_tool_call_id: 't1',
        left_path: '/values/0', right_tool_call_id: 't2',
        right_path: '/values/0', relation: 'greater' }]),
    results: [known, other], accountRef: '…0151', recordId });
    expect(comparison.footer?.data_limits.join(' ')).toContain('ventanas de atribución distintas');
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
