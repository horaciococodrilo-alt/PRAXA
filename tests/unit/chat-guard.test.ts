import { describe, expect, it } from 'vitest';

import { findNumericCandidates } from '@/modules/chat/numeric-candidates';
import { compareDecimal, decimalMatches } from '@/modules/chat/decimal';
import { projectOutput, OutputProjectionError, type FlatChatAnswer } from '@/modules/chat/output-schema';
import { validateAnswer, GuardRejected } from '@/modules/chat/guard';
import { modelMarkers, parseToolResult, toModelView } from '@/modules/chat/tools/results';
import type { ToolName } from '@/modules/chat/tools/schema';

const period = { from: '2026-01-01', to: '2026-01-02' };
const otherPeriod = { from: '2026-02-01', to: '2026-02-02' };
const entity = 'a0000000-0000-4000-8000-000000000001';
const composition = { days_total: 2, days_with_value: 2, days_metric_missing: 0,
  days_no_row: 0, days_not_observed: 0, days_open: 0, days_captured_partial: 0,
  fetched_at_min: null, fetched_at_max: null, observed_from: period.from,
  observed_to: period.to, partial: false };
const rawValue = { path_key: 'total', metric: 'spend', unit: 'money', currency: 'USD',
  action_type: null, attribution_ref: null, period, period_a: null, period_b: null,
  day: null, entity_ref: entity, entity_name: 'Campaña sintética', parent_ref: null,
  segment_primary: null, segment_secondary: null, value: '1234.50', absence: null,
  presence: null, temporal_status: null, captured_partial: false, fetched_at: null,
  composition };
const result = parseToolResult({ status: 'ok', reason: null,
  scope: { level: 'campaign', entity_ref: entity, entity_name: 'Campaña sintética',
    period, period_a: null, period_b: null, period_defaulted: false,
    entity_defaulted: false, timezone: 'UTC', currency: 'USD' },
  values: [rawValue], composition, extra: {} }, 't1', '…0151');

function claim(quote: string, overrides: Record<string, unknown> = {}) {
  return { span: { quote, occurrence: 1 }, kind: 'observed_value',
    tool_call_id: 't1', path: '/values/0', metric: 'spend', unit: 'money',
    currency: 'USD', account_ref: '…0151', level: 'campaign', entity_ref: entity,
    action_type: null, attribution_ref: null, period, period_a: null, period_b: null,
    bound: null, field: null, left_tool_call_id: null, left_path: null,
    right_tool_call_id: null, right_path: null, relation: null, ...overrides };
}
function answer(text: string, claims: unknown[] = []): FlatChatAnswer {
  return { text, claims, blocks: [] } as FlatChatAnswer;
}

function variantResult(valueOverrides: Record<string, unknown> = {},
  resultOverrides: Record<string, unknown> = {}, id = 't1', toolName: ToolName = 'total') {
  const { scope: scopeOverrides, extra: extraOverrides, ...rest } = resultOverrides;
  return parseToolResult({ status: 'ok', reason: null,
    scope: { ...result.scope, ...((scopeOverrides as object) ?? {}) },
    values: [{ ...rawValue, ...valueOverrides }], composition,
    extra: extraOverrides ?? {}, ...rest }, id, '…0151', toolName);
}

function flatClaim(kind: string, quote: string, fields: Record<string, unknown> = {}) {
  return claim(quote, { kind, tool_call_id: null, path: null, metric: null,
    unit: null, currency: null, account_ref: null, level: null, entity_ref: null,
    action_type: null, attribution_ref: null, period: null, period_a: null,
    period_b: null, ...fields });
}

function block(type: string, sources: { tool_call_id: string; path_prefix: string }[],
  overrides: Record<string, unknown> = {}) {
  return { type, sources, options: type === 'barras' ? { ordering: 'source' } : null,
    items: null, ids: null, ...overrides };
}

describe('M25a-T-38–43: guarda determinística', () => {
  it('detecta cinco familias con posiciones; un clic sí, una campaña no', () => {
    const text = 'Hubo un clic y una campaña; 1.234,50 y 25 %; se duplicó, más que antes y la mitad.';
    const candidates = findNumericCandidates(text);
    expect(candidates.map((item) => item.text)).toEqual(expect.arrayContaining([
      'un', '1.234,50', '25 %', 'se duplicó', 'más que', 'mitad',
    ]));
    expect(candidates.some((item) => item.text === 'una')).toBe(false);
    for (const item of candidates) expect(text.slice(item.start, item.end)).toBe(item.text);
    expect(findNumericCandidates('veintidós clics y doscientos mil impresiones')
      .map((item) => item.text)).toEqual(['veintidós', 'doscientos mil']);
  });

  it('acepta cantidades en palabras y una variación respaldada, sin aceptar una inventada', () => {
    const clicks = variantResult({ metric: 'clicks', unit: 'count', currency: null,
      value: '2' });
    expect(validateAnswer(answer('Hubo dos clics.', [claim('dos', { metric: 'clicks',
      unit: 'count', currency: null })]), [clicks], 'consulta')).toBeDefined();
    const change = variantResult({ path_key: 'change', metric: 'spend',
      unit: 'percent', currency: null, value: '100', period: null,
      period_a: period, period_b: otherPeriod },
    { scope: { period: null, period_a: period, period_b: otherPeriod } });
    const changed = claim('se duplicó', { unit: 'percent', currency: null,
      period: null, period_a: period, period_b: otherPeriod });
    expect(validateAnswer(answer('El gasto se duplicó.', [changed]),
      [change], 'consulta')).toBeDefined();
    expect(() => validateAnswer(answer('El gasto se duplicó.', [changed]),
      [result], 'consulta')).toThrow(GuardRejected);
    const change20 = variantResult({ path_key: 'change', metric: 'spend',
      unit: 'percent', currency: null, value: '20', period: null,
      period_a: period, period_b: otherPeriod },
    { scope: { period: null, period_a: period, period_b: otherPeriod } });
    const changeClaim = claim('Subió 20 %', { unit: 'percent', currency: null,
      period: null, period_a: period, period_b: otherPeriod });
    expect(validateAnswer(answer('Subió 20 %.', [changeClaim]),
      [change20], 'consulta')).toBeDefined();
    const ctr20 = variantResult({ metric: 'ctr', unit: 'percent', currency: null,
      value: '20' });
    expect(() => validateAnswer(answer('Subió 20 %.', [claim('20 %', {
      metric: 'ctr', unit: 'percent', currency: null,
    })]), [ctr20], 'consulta')).toThrow(GuardRejected);
  });

  it('compara decimales grandes y redondeo half-up sin number', () => {
    expect(compareDecimal('9007199254740993.125', '9007199254740992.125')).toBe(1);
    expect(decimalMatches('1.234,50', '1234.50', 'exact')).toBe(true);
    expect(decimalMatches('-0,13', '-0.125', 'round2')).toBe(true);
    expect(decimalMatches('1.235', '1234.50', 'exact')).toBe(false);
  });

  it('acepta cifra observada exacta y rechaza inventada, métrica y período ajenos', () => {
    expect(validateAnswer(answer('Gastaste 1.234,50.', [claim('1.234,50')]), [result], 'consulta'))
      .toMatchObject({ text: 'Gastaste 1.234,50.' });
    for (const invalid of [
      answer('Gastaste 9.999.', [claim('9.999')]),
      answer('Gastaste 1.234,50.', [claim('1.234,50', { metric: 'clicks' })]),
      answer('Gastaste 1.234,50.', [claim('1.234,50', { period: otherPeriod })]),
      answer('Gastaste 1.234,50.', []),
    ]) expect(() => validateAnswer(invalid, [result], 'consulta')).toThrow(GuardRejected);
  });

  it('rechaza aparición inexistente, comparativo y cantidad en palabras sin respaldo', () => {
    expect(() => validateAnswer(answer('Gastaste 1.234,50.', [claim('1.234,50', {
      span: { quote: '1.234,50', occurrence: 2 },
    })]), [result], 'consulta')).toThrow(GuardRejected);
    for (const text of ['Hubo dos clics.', 'Fue más que antes.', 'Se duplicó.']) {
      expect(() => validateAnswer(answer(text), [result], 'consulta')).toThrow(GuardRejected);
    }
  });

  it('proyecta variantes planas y rechaza campos ajenos no nulos', () => {
    const valid = answer('Gastaste 1.234,50.', [claim('1.234,50')]);
    expect(projectOutput(valid).claims[0]).not.toHaveProperty('bound');
    expect(() => projectOutput(answer('texto', [claim('texto', { bound: 'from' })])))
      .toThrow(OutputProjectionError);
  });

  it('rechaza cada campo de procedencia alterado aunque la cifra exista', () => {
    for (const [key, value] of Object.entries({ unit: 'count', currency: 'ARS',
      account_ref: '…9999', level: 'ad', entity_ref: null,
      action_type: 'purchase', attribution_ref: 'other' })) {
      expect(() => validateAnswer(answer('1.234,50', [claim('1.234,50', { [key]: value })]),
        [result], 'consulta'), key).toThrow(GuardRejected);
    }
  });

  it('admite gasto redondeado a cero y rechaza CPC redondeado a cero', () => {
    expect(validateAnswer(answer('$1.235', [claim('$1.235')]), [result], 'consulta')).toBeDefined();
    const cpc = variantResult({ metric: 'cpc', value: '0.37', path_key: 'total' });
    expect(() => validateAnswer(answer('$0', [claim('$0', { metric: 'cpc' })]),
      [cpc], 'consulta')).toThrow(GuardRejected);
  });

  it('exige período doble exacto y diferencia de dinero sin redondeo entero', () => {
    const comparison = variantResult({ path_key: 'difference', value: '12.37',
      period: null, period_a: period, period_b: otherPeriod },
    { scope: { period: null, period_a: period, period_b: otherPeriod } });
    const base = claim('12,37', { period: null, period_a: period, period_b: otherPeriod });
    expect(validateAnswer(answer('12,37', [base]), [comparison], 'consulta')).toBeDefined();
    for (const changed of [{ period_a: otherPeriod }, { period_b: period },
      { period, period_a: null, period_b: null }]) {
      expect(() => validateAnswer(answer('12,37', [{ ...base, ...changed }]),
        [comparison], 'consulta')).toThrow(GuardRejected);
    }
    expect(() => validateAnswer(answer('12', [claim('12', {
      period: null, period_a: period, period_b: otherPeriod,
    })]), [comparison], 'consulta')).toThrow(GuardRejected);
  });

  it('valida fechas de ambos períodos y conteos de cobertura de a y b', () => {
    const compared = variantResult({ period: null, period_a: period,
      period_b: otherPeriod }, { scope: { period: null, period_a: period,
        period_b: otherPeriod }, extra: { composition_a: composition,
        composition_b: composition } });
    for (const [bound, date] of [['a_from', '01/01/2026'], ['a_to', '02/01/2026'],
      ['b_from', '01/02/2026'], ['b_to', '02/02/2026']]) {
      expect(validateAnswer(answer(date, [flatClaim('period_bound', date,
        { tool_call_id: 't1', bound })]), [compared], 'consulta')).toBeDefined();
    }
    expect(() => validateAnswer(answer('03/02/2026', [flatClaim('period_bound',
      '03/02/2026', { tool_call_id: 't1', bound: 'b_to' })]),
    [compared], 'consulta')).toThrow(GuardRejected);
    expect(validateAnswer(answer('2 días', [flatClaim('coverage_count', '2',
      { tool_call_id: 't1', field: 'a.days_total' })]), [compared], 'consulta'))
      .toBeDefined();
    expect(() => validateAnswer(answer('01/01/2026', [flatClaim('period_bound',
      '01/01/2026', { tool_call_id: 't1', bound: 'inventado_from' })]),
    [result], 'consulta')).toThrow(GuardRejected);
  });

  it('compara exactamente y rechaza relación falsa o atribución incompatible de la misma entidad', () => {
    const lower = variantResult({ value: '10', attribution_ref: 'known-a' }, {}, 't2');
    const higher = variantResult({ value: '20', attribution_ref: 'known-b' });
    const comparison = flatClaim('qualitative_comparison', 'más que', {
      left_tool_call_id: 't1', left_path: '/values/0', right_tool_call_id: 't2',
      right_path: '/values/0', relation: 'greater',
    });
    expect(() => validateAnswer(answer('más que', [comparison]),
      [higher, lower], 'consulta')).toThrow(GuardRejected);
    const otherEntity = variantResult({ value: '10', attribution_ref: 'known-b',
      entity_ref: 'a0000000-0000-4000-8000-000000000002' }, {}, 't2');
    expect(validateAnswer(answer('más que', [comparison]),
      [higher, otherEntity], 'consulta')).toBeDefined();
    expect(() => validateAnswer(answer('menos que', [{ ...comparison,
      span: { quote: 'menos que', occurrence: 1 }, relation: 'greater' }]),
    [higher, otherEntity], 'consulta')).toThrow(GuardRejected);
    expect(() => validateAnswer(answer('más que', [comparison]),
      [higher, { ...otherEntity, account_ref: '…9999' }], 'consulta'))
      .toThrow(GuardRejected);
  });

  it('acepta cifras del dueño solo en la pregunta actual, sin referencia ni período', () => {
    const user = flatClaim('user_provided', '30');
    expect(validateAnswer(answer('30', [user]), [], 'últimos 30 días')).toBeDefined();
    expect(() => validateAnswer(answer('30', [user]), [], 'últimos 20 días'))
      .toThrow(GuardRejected);
    expect(() => validateAnswer(answer('30', [{ ...user, period }]), [],
      'últimos 30 días')).toThrow(GuardRejected);
    expect(validateAnswer(answer('1.234,50', [flatClaim('user_provided', '1.234,50')]),
      [], 'Mencioné 1.234,50')).toBeDefined();
  });

  it('rechaza lenguaje excluido en el texto y en conclusiones, salvo nombres por marcador', () => {
    for (const phrase of ['porque', 'debido a', 'se debe a', 'a causa de',
      'gracias a', 'ROAS', 'estable', 'rentabilidad', 'rentable']) {
      expect(() => validateAnswer(answer(`Es ${phrase}.`), [], 'consulta'))
        .toThrow(GuardRejected);
      const withItem = { ...answer('Resumen'), blocks: [block('conclusiones', [], {
        items: [{ text: `Es ${phrase}.`, claims: [], provenance: 'inference' }],
      })] } as FlatChatAnswer;
      expect(() => validateAnswer(withItem, [], 'consulta')).toThrow(GuardRejected);
    }
    const named = variantResult({ entity_name: 'ROAS rentable' },
      { scope: { entity_name: 'ROAS rentable' } });
    expect(validateAnswer(answer('⟦ENTIDAD_A⟧'), [named], 'consulta')).toBeDefined();
  });

  it('exige claim de list_count sin períodos, y valida marcadores de rótulos del turno', () => {
    const countResult = variantResult({ path_key: 'list_count', metric: 'list_count',
      unit: 'count', currency: null, value: '3', period: null, entity_ref: null },
    { scope: { period: null, entity_ref: null, entity_name: null },
      extra: { history_from: '2026-01-01', last_finished_at: '2026-02-02T12:00:00Z' } });
    const countClaim = claim('3', { metric: 'list_count', unit: 'count',
      currency: null, entity_ref: null, period: null });
    expect(validateAnswer(answer('3 campañas', [countClaim]), [countResult],
      'consulta')).toBeDefined();
    expect(() => validateAnswer(answer('3 campañas'), [countResult], 'consulta'))
      .toThrow(GuardRejected);
    expect(() => validateAnswer(answer('3 campañas', [{ ...countClaim, period }]),
      [countResult], 'consulta')).toThrow(GuardRejected);
    expect(validateAnswer(answer('⟦FECHA_A⟧', []), [countResult], 'consulta')).toBeDefined();
    expect(() => validateAnswer(answer('01/01/2026'), [countResult], 'consulta'))
      .toThrow(GuardRejected);
  });

  it('emite alias del catálogo de entidades y fechas como rótulos del servidor', () => {
    const listed = variantResult({ path_key: 'list_count', metric: 'list_count',
      unit: 'count', currency: null, value: '1', period: null,
      entity_ref: null, entity_name: null }, { scope: { period: null, entity_ref: null,
        entity_name: null }, extra: { entities: [{ entity_ref: entity,
          name: 'Promo 2x1 2026' }], history_from: '2026-01-01' } }, 't1', 'entities');
    const markers = modelMarkers([listed]);
    const view = toModelView(listed, markers);
    expect((view.extra.entities as { entity_alias: string }[])[0].entity_alias)
      .toBe('⟦ENTIDAD_A⟧');
    expect(markers.get('⟦ENTIDAD_A⟧')?.text).toBe('Promo 2x1 2026');
    expect(markers.get('⟦FECHA_A⟧')?.text).toBe('01/01/2026');
    expect(validateAnswer(answer('⟦ENTIDAD_A⟧: ⟦FECHA_A⟧'),
      [listed], 'consulta')).toBeDefined();
  });

  it('solo muestra segmentos, acciones y días con dígitos mediante marcador del turno', () => {
    const labeled = variantResult({ path_key: 'day', metric: 'action_count',
      unit: 'count', currency: null, action_type: 'purchase_7d', value: '2',
      day: '2026-01-01', presence: 'con_datos', composition: null,
      segment_primary: '25-34', segment_secondary: '65+' }, {}, 't1', 'daily_series');
    const markers = modelMarkers([labeled]);
    const view = toModelView(labeled, markers).values[0];
    expect(view).toMatchObject({ segment_primary_alias: '⟦SEGMENTO_A⟧',
      segment_secondary_alias: '⟦SEGMENTO_B⟧', action_alias: '⟦ACCION_A⟧',
      day_alias: '⟦DIA_A⟧' });
    expect(validateAnswer(answer('⟦SEGMENTO_A⟧ ⟦SEGMENTO_B⟧ ⟦ACCION_A⟧ ⟦DIA_A⟧'),
      [labeled], 'consulta')).toBeDefined();
    for (const raw of ['25-34', '65+', 'purchase_7d', '01/01/2026']) {
      expect(() => validateAnswer(answer(raw), [labeled], 'consulta'))
        .toThrow(GuardRejected);
    }
  });

  it('proyecta todos los kinds y las familias de bloques, y rechaza una obligatoria nula', () => {
    const kinds = [
      claim('1'),
      flatClaim('period_bound', '01/01/2026', { tool_call_id: 't1', bound: 'from' }),
      flatClaim('coverage_count', '2', { tool_call_id: 't1', field: 'days_total' }),
      flatClaim('qualitative_comparison', 'más que', { left_tool_call_id: 't1',
        left_path: '/values/0', right_tool_call_id: 't2', right_path: '/values/0',
        relation: 'greater' }),
      flatClaim('user_provided', '30'),
    ];
    for (const item of kinds) expect(projectOutput(answer('texto', [item])).claims)
      .toHaveLength(1);
    expect(() => projectOutput(answer('texto', [flatClaim('period_bound', 'fecha',
      { tool_call_id: 't1', bound: null })]))).toThrow(OutputProjectionError);
    for (const extra of [{ value: '123' }, { title: 'Inventado' },
      { code: 'alert(1)' }]) {
      expect(() => projectOutput({ ...answer('texto'), blocks: [
        { ...block('tabla', [{ tool_call_id: 't1', path_prefix: '/values' }]),
          ...extra }] } as FlatChatAnswer)).toThrow(OutputProjectionError);
    }
    const types = ['tarjeta', 'lineas', 'barras', 'barras_agrupadas', 'dona',
      'tabla', 'resumen_variacion', 'periodo_contra_periodo', 'barras_apiladas',
      'ranking', 'tabla_tendencia', 'tabla_desplegable', 'embudo',
      'calendario_calor', 'desglose_tipo_resultado', 'estado_datos',
      'conclusiones', 'fuentes_metodologia', 'preguntas_sugeridas'];
    for (const type of types) {
      const options = type === 'conclusiones' ? { items: [] } :
        type === 'preguntas_sugeridas' ? { ids: [] } : {};
      const sources = ['conclusiones', 'preguntas_sugeridas'].includes(type) ? [] :
        [{ tool_call_id: 't1', path_prefix: '/values' }];
      const projected = projectOutput({ ...answer('texto'),
        blocks: [block(type, sources, options)] } as FlatChatAnswer);
      expect(projected.blocks[0].type).toBe(type);
    }
  });

  it('resuelve cada aparición de una cita repetida y rechaza una cita ausente', () => {
    const repeated = answer('1.234,50 y 1.234,50', [claim('1.234,50'),
      claim('1.234,50', { span: { quote: '1.234,50', occurrence: 2 } })]);
    expect(validateAnswer(repeated, [result], 'consulta')).toBeDefined();
    expect(() => validateAnswer(answer('1.234,50', [claim('9.999')]),
      [result], 'consulta')).toThrow(GuardRejected);
  });

  it('selecciona filas compatibles en bloques mixtos y admite estado sin valores', () => {
    const mixed = parseToolResult({ status: 'ok', reason: null, scope: result.scope,
      values: [{ ...rawValue, path_key: 'segment', metric: 'clicks', unit: 'count',
        currency: null, value: '2', segment_primary: '25-34' },
      { ...rawValue, path_key: 'segment_share', metric: 'share', unit: 'percent',
        currency: null, value: '50', segment_primary: '25-34' }],
      composition, extra: {} }, 't1', '…0151', 'breakdown');
    expect(validateAnswer({ ...answer('Datos'), blocks: [block('dona',
      [{ tool_call_id: 't1', path_prefix: '/values' }])] } as FlatChatAnswer,
    [mixed], 'consulta')).toBeDefined();
    expect(() => validateAnswer({ ...answer('Datos'), blocks: [block('dona',
      [{ tool_call_id: 't1', path_prefix: '/values/1' }])] } as FlatChatAnswer,
    [mixed], 'consulta')).toThrow(GuardRejected);
    const withoutShare = variantResult({ path_key: 'segment', metric: 'clicks',
      unit: 'count', currency: null, value: '2', segment_primary: '25-34' },
    {}, 't1', 'breakdown');
    expect(() => validateAnswer({ ...answer('Datos'), blocks: [block('dona',
      [{ tool_call_id: 't1', path_prefix: '/values' }])] } as FlatChatAnswer,
    [withoutShare], 'consulta')).toThrow(GuardRejected);
    const empty = parseToolResult({ status: 'ok', reason: null, scope: result.scope,
      values: [], composition, extra: {} }, 't1', '…0151', 'coverage');
    expect(validateAnswer({ ...answer('Datos'), blocks: [block('estado_datos',
      [{ tool_call_id: 't1', path_prefix: '/values' }])] } as FlatChatAnswer,
    [empty], 'consulta')).toBeDefined();
  });

  it('rechaza bloques incompatibles y referencias a filas ajenas a la variante', () => {
    const byDay = variantResult({ path_key: 'day', day: '2026-01-01',
      presence: 'con_datos', composition: null }, {}, 't1', 'total');
    for (const bad of [block('lineas', [{ tool_call_id: 't1', path_prefix: '/values' }]),
      block('tarjeta', [{ tool_call_id: 't1', path_prefix: '/values' }]),
      block('dona', [{ tool_call_id: 't1', path_prefix: '/values' }])]) {
      expect(() => validateAnswer({ ...answer('Datos'), blocks: [bad] } as FlatChatAnswer,
        [byDay], 'consulta')).toThrow(GuardRejected);
    }
    expect(validateAnswer({ ...answer('Datos'), blocks: [block('tabla',
      [{ tool_call_id: 't1', path_prefix: '/values/0' }])] } as FlatChatAnswer,
    [byDay], 'consulta')).toBeDefined();
  });

  it('resuelve citas dentro de cada conclusión y rotula hechos sin claims como interpretación', () => {
    const item = { text: 'Gastaste 1.234,50.', claims: [claim('1.234,50')],
      provenance: 'calculated_metric' };
    const output = { ...answer('Resumen.'), blocks: [block('conclusiones', [],
      { items: [item] })] } as FlatChatAnswer;
    expect(validateAnswer(output, [result], 'consulta')).toBeDefined();
    expect(() => validateAnswer({ ...output, blocks: [block('conclusiones', [],
      { items: [{ ...item, claims: [] }] })] } as FlatChatAnswer,
    [result], 'consulta')).toThrow(GuardRejected);
    const withoutClaim = { ...output, blocks: [block('conclusiones', [],
      { items: [{ text: 'La lectura es orientativa.', claims: [],
        provenance: 'system_fact' }] })] } as FlatChatAnswer;
    expect((validateAnswer(withoutClaim, [result], 'consulta').blocks[0].items as
      { provenance: string }[])[0].provenance).toBe('inference');
  });
});
