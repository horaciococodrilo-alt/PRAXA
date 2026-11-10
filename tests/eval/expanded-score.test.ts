import { describe, expect, it } from 'vitest';

import { scoreExpandedCase } from './expanded-score';
import { expandedSyntheticResult } from './expanded-synthetic';
import { expandedCases } from './fixtures/expanded';
import { projectToolArgs, type ToolName } from '@/modules/chat/tools/schema';

const expected = { kind: 'answer' as const, tool: 'ranking', metric: 'spend',
  period: { from: '2026-01-01', to: '2026-01-07' }, block: 'ranking',
  answer: 'ranking', value: '16' };
const actual = { kind: 'answer', reason: null, calls: [{ name: 'ranking',
  args: { metric: 'spend', period: expected.period } }],
  blocks: [{ type: 'ranking', cells: ['Campaña sintética A', '16'] }] };

describe('M25a.3 paso 21: puntuación ampliada', () => {
  it('valida resultados sintéticos para las trece herramientas y límites de atribución', () => {
    const period = expected.period;
    const earlier = { from: '2026-01-08', to: '2026-01-14' };
    const account = 'b0000000-0000-4000-8000-000000000151';
    const specs: [ToolName, Record<string, unknown>][] = [
      ['entities', { level: 'campaign' }],
      ['action_types', { entity_ref: account, period }],
      ['coverage', { level: 'account', period }],
      ['daily_series', { entity_ref: account, metric: 'spend', period }],
      ['total', { entity_ref: account, metric: 'spend', period }],
      ['connection_status', {}],
      ['compare_periods', { entity_ref: account, metric: 'spend',
        period_a: period, period_b: earlier }],
      ['daily_average', { entity_ref: account, metric: 'clicks', period }],
      ['ranking', { level: 'campaign', metric: 'spend', period, order: 'desc',
        limit: 10, include_trend: true }],
      ['cost_per_result', { entity_ref: account, action_type: 'purchase', period }],
      ['share', { entity_ref: account, metric: 'spend', period }],
      ['percent_change', { entity_ref: account, metric: 'spend',
        period_a: period, period_b: earlier }],
      ['breakdown', { level: 'account', dimension: 'country', metric: 'spend',
        period, limit: 20 }],
    ];
    for (const [name, args] of specs) {
      const call = projectToolArgs(name, args, { period, accountEntityRef: account });
      expect(expandedSyntheticResult(call, 't1', 'E01').tool_name).toBe(name);
    }
    const action = projectToolArgs('total', { entity_ref: account,
      metric: 'action_count', action_type: 'purchase', period },
    { period, accountEntityRef: account });
    expect(expandedSyntheticResult(action, 't1', 'E26').values[0].attribution_ref)
      .toBe('unknown');
    expect(expandedSyntheticResult(action, 't1', 'E27')).toMatchObject({
      status: 'not_calculable', reason: 'attribution_incompatible', values: [] });
    const ranking = projectToolArgs('ranking', { level: 'campaign',
      metric: 'action_count', action_type: 'purchase', period,
      order: 'desc', limit: 10, include_trend: false },
    { period, accountEntityRef: account });
    const differentWindows = expandedSyntheticResult(ranking, 't1', 'E28');
    expect(differentWindows.extra.attribution_mixed).toBe(true);
    expect(new Set(differentWindows.values.filter((value) =>
      value.path_key === 'entity').map((value) => value.attribution_ref)).size).toBe(2);
  });
  it('cubre cuarenta IDs nuevos, seis cálculos, tres dimensiones y diecinueve bloques', () => {
    expect(expandedCases).toHaveLength(40);
    expect(new Set(expandedCases.map((item) => item.id)).size).toBe(40);
    expect(new Set(expandedCases.map((item) => item.expected.block)
      .filter((item) => item !== null)).size).toBe(19);
    const tools = new Set(expandedCases.map((item) => item.expected.tool));
    for (const tool of ['compare_periods', 'daily_average', 'ranking',
      'cost_per_result', 'share', 'percent_change']) expect(tools.has(tool)).toBe(true);
    for (const dimension of ['edad y género', 'país', 'región']) {
      expect(expandedCases.some((item) => item.question.includes(dimension))).toBe(true);
    }
    expect(expandedCases.some((item) => (item.previous?.length ?? 0) > 0)).toBe(true);
    expect(expandedCases.some((item) => item.pendingClarification)).toBe(true);
    expect(expandedCases.filter((item) => item.expected.kind === 'clarification'))
      .toHaveLength(2);
  });
  it('exige el bloque pedido además de herramienta, métrica, período y valor', () => {
    expect(scoreExpandedCase(expected, actual)).toBe(true);
    expect(scoreExpandedCase(expected, { ...actual,
      blocks: [{ type: 'tabla', cells: ['Campaña sintética A', '16'] }] })).toBe(false);
    expect(scoreExpandedCase(expected, { ...actual,
      calls: [{ name: 'ranking', args: { metric: 'clicks', period: expected.period } }] })).toBe(false);
    expect(scoreExpandedCase(expected, { ...actual,
      blocks: [{ type: 'ranking', cells: ['Campaña sintética A', '8'] }] })).toBe(false);
  });

  it('distingue aclaración debida de abstención con motivo y de respuesta directa', () => {
    const clarify = { ...expected, kind: 'clarification' as const, tool: null,
      metric: null, period: null, block: null, value: undefined };
    expect(scoreExpandedCase(clarify, { ...actual, kind: 'clarification' })).toBe(true);
    expect(scoreExpandedCase(clarify, actual)).toBe(false);
    const abstain = { ...clarify, kind: 'abstention' as const, reason: 'out_of_scope' };
    expect(scoreExpandedCase(abstain, { ...actual, kind: 'abstention',
      reason: 'guard_rejected' })).toBe(false);
    expect(scoreExpandedCase(abstain, { ...actual, kind: 'abstention',
      reason: 'out_of_scope' })).toBe(true);
  });
  it('acepta historia sin fechas solo con aclaración o default visible del servidor', () => {
    const history = expandedCases.find((item) => item.id === 'E29')!.expected;
    const current = { kind: 'answer', reason: null,
      calls: [{ name: 'daily_series', args: { metric: 'spend',
        period: { from: '2026-01-08', to: '2026-01-14' } } }],
      blocks: [{ type: 'lineas', cells: ['08/01/2026', '1.00'] }],
      defaulted: true };
    expect(scoreExpandedCase(history, current)).toBe(true);
    expect(scoreExpandedCase(history, { ...current, defaulted: false })).toBe(false);
    expect(scoreExpandedCase(history, { ...current, kind: 'clarification' })).toBe(true);
    expect(scoreExpandedCase(history, { ...current, calls: [{ name: 'daily_series',
      args: { metric: 'spend', period: { from: '2026-01-01', to: '2026-01-07' } } }] }))
      .toBe(false);
  });
});
