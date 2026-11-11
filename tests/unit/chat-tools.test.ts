import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';

import { CHAT_LIMITS } from '@/modules/chat/limits';
import { projectToolArgs, TOOL_NAMES, ToolArgumentError, ToolEntityNotFoundError } from '@/modules/chat/tools/schema';
import { parseToolResult, toModelView, ToolResultError } from '@/modules/chat/tools/results';
import { actionLabel } from '@/modules/chat/tools/action-labels';
import { executeTool, missingAccountEntityResult, resolveToolCall,
  ToolExecutionError } from '@/modules/chat/tools/execute';

vi.mock('server-only', () => ({}));

const period = { from: '2026-01-01', to: '2026-01-07' };
const previous = { from: '2025-12-25', to: '2025-12-31' };
const entity = 'a0000000-0000-4000-8000-000000000001';
const defaults = { period, accountEntityRef: entity };

describe('M25a — catálogo de herramientas', () => {
  const valid: Record<string, Record<string, unknown>> = {
    entities: { level: 'campaign' },
    action_types: { entity_ref: entity, period },
    coverage: { level: 'account', period },
    daily_series: { entity_ref: entity, metric: 'spend', period },
    total: { entity_ref: entity, metric: 'spend', period },
    connection_status: {},
    compare_periods: { entity_ref: entity, metric: 'spend', period_a: previous, period_b: period },
    daily_average: { entity_ref: entity, metric: 'spend', period },
    ranking: { level: 'campaign', metric: 'spend', period, order: 'desc' },
    cost_per_result: { entity_ref: entity, action_type: 'purchase', period },
    share: { entity_ref: entity, metric: 'spend', period },
    percent_change: { entity_ref: entity, metric: 'spend', period_a: previous, period_b: period },
    breakdown: { level: 'campaign', dimension: 'country', metric: 'spend', period, entity_ref: entity },
  };

  it('fija los trece nombres exactos y proyecta una llamada válida de cada uno', () => {
    expect(TOOL_NAMES).toHaveLength(13);
    expect(Object.keys(valid)).toEqual([...TOOL_NAMES]);
    for (const name of TOOL_NAMES) {
      expect(projectToolArgs(name, valid[name], defaults).name).toBe(name);
    }
  });

  it('rechaza argumentos ajenos en cada herramienta, también company_id y SQL', () => {
    for (const name of TOOL_NAMES) {
      expect(() => projectToolArgs(name, { ...valid[name], company_id: entity }, defaults))
        .toThrow(ToolArgumentError);
      expect(() => projectToolArgs(name, { ...valid[name], sql: 'select 1' }, defaults))
        .toThrow(ToolArgumentError);
    }
    expect(() => projectToolArgs('inventada', {}, defaults)).toThrow(ToolArgumentError);
  });

  it('rechaza campos extra dentro del período y períodos de 94 días', () => {
    expect(() => projectToolArgs('total', {
      entity_ref: entity, metric: 'spend', period: { ...period, company_id: entity },
    }, defaults)).toThrow(ToolArgumentError);
    expect(() => projectToolArgs('total', {
      entity_ref: entity, metric: 'spend', period: { from: '2026-01-01', to: '2026-04-04' },
    }, defaults)).toThrow(ToolArgumentError);
    expect(CHAT_LIMITS.maxPeriodDays).toBe(93);
  });

  it('exige tipo de acción exactamente para métricas de acción', () => {
    expect(() => projectToolArgs('total', { entity_ref: entity, metric: 'action_count', period }, defaults))
      .toThrow(ToolArgumentError);
    expect(() => projectToolArgs('total', {
      entity_ref: entity, metric: 'spend', period, action_type: 'purchase',
    }, defaults)).toThrow(ToolArgumentError);
    expect(projectToolArgs('total', {
      entity_ref: entity, metric: 'action_value', action_type: 'purchase', period,
    }, defaults).args.action_type).toBe('purchase');
  });

  it('resuelve período y entidad de cuenta antes de Zod y marca ambos defaults', () => {
    const call = projectToolArgs('total', { entity_ref: null, metric: 'spend', period: null }, defaults);
    expect(call.args).toMatchObject({ entity_ref: entity, period });
    expect(call.periodDefaulted).toBe(true);
    expect(call.entityDefaulted).toBe(true);
    expect(projectToolArgs('total', { entity_ref: entity, metric: 'spend', period }, defaults)
      .periodDefaulted).toBe(false);
    expect(() => projectToolArgs('compare_periods', {
      entity_ref: entity, metric: 'spend', period_a: null, period_b: null,
    }, defaults)).toThrow(ToolArgumentError);
    expect(() => projectToolArgs('total', { metric: 'spend' }, { period, accountEntityRef: null }))
      .toThrow(ToolEntityNotFoundError);
  });

  it('las siete herramientas de entidad admiten cuenta por defecto; share no', () => {
    const calls = {
      action_types: { period }, daily_series: { metric: 'spend', period },
      total: { metric: 'spend', period },
      compare_periods: { metric: 'spend', period_a: previous, period_b: period },
      daily_average: { metric: 'spend', period },
      cost_per_result: { action_type: 'purchase', period },
      percent_change: { metric: 'spend', period_a: previous, period_b: period },
    };
    for (const [name, args] of Object.entries(calls)) {
      const call = projectToolArgs(name, { ...args, entity_ref: null }, defaults);
      expect(call.entityDefaulted).toBe(true);
      expect(call.args.entity_ref).toBe(entity);
      expect(() => projectToolArgs(name, { ...args, entity_ref: null },
        { period, accountEntityRef: null })).toThrow(ToolEntityNotFoundError);
    }
    expect(() => projectToolArgs('share', { ...valid.share, entity_ref: null }, defaults))
      .toThrow(ToolArgumentError);
  });

  it('T-92 entidad de cuenta ausente da not_found validado sin RPC de métricas', async () => {
    const ctx = { connection: { id: entity, status: 'active' as const,
      external_account_id: 'act_0000000000151', timezone: 'UTC', currency: 'USD' } };
    const listEntities = vi.fn(async () => []);
    const rpc = vi.fn();
    const args = { entity_ref: null, metric: 'spend', period: null };
    await expect(resolveToolCall('total', args, ctx, period, { listEntities, rpc }))
      .rejects.toThrow(ToolEntityNotFoundError);
    expect(listEntities).toHaveBeenCalledWith(entity, 'account');
    expect(rpc).not.toHaveBeenCalled();
    const missing = missingAccountEntityResult('total', args, ctx, period, 't1');
    expect(missing).toMatchObject({ status: 'not_found', reason: 'entity_not_found',
      values: [], scope: { level: 'account', period, period_defaulted: true,
        entity_defaulted: true } });
    expect(() => missingAccountEntityResult('total', { ...args, sql: 'select 1' },
      ctx, period, 't1')).toThrow(ToolArgumentError);
  });

  it('el límite de período coincide con la migración y no existe ROAS en el catálogo', () => {
    const sql = readFileSync('supabase/migrations/0018_chat_queries.sql', 'utf8');
    expect(sql).toMatch(/chat_max_period_days\(\)[\s\S]*?select 93/);
    expect(CHAT_LIMITS.maxPeriodDays).toBe(93);
    expect(TOOL_NAMES).not.toContain('roas');
    expect(() => projectToolArgs('cost_per_result', { entity_ref: entity, period }, defaults))
      .toThrow(ToolArgumentError);
  });

  it('execute usa el cliente JWT y toma la conexión del contexto del servidor', () => {
    const source = readFileSync('src/modules/chat/tools/execute.ts', 'utf8');
    expect(source).not.toMatch(/getWorkerApi|service_role/);
    expect(source).toContain('createSupabaseServerClient');
    expect(source).toContain('ctx.connection.id');
    expect(source).not.toMatch(/Number\(|parseFloat\(|parseInt\(/);
  });

  it('no inventa períodos de comparación ni entidad de campaña para un desglose', () => {
    expect(() => projectToolArgs('compare_periods', {
      entity_ref: entity, metric: 'spend', period_a: previous, period_b: null,
    }, defaults)).toThrow(ToolArgumentError);
    expect(() => projectToolArgs('breakdown', {
      level: 'campaign', dimension: 'country', metric: 'spend', period, entity_ref: null,
    }, defaults)).toThrow(ToolArgumentError);
    expect(projectToolArgs('breakdown', {
      level: 'account', dimension: 'country', metric: 'spend', period, entity_ref: null,
    }, defaults).args.entity_ref).toBeNull();
    expect(() => projectToolArgs('breakdown', {
      level: 'account', dimension: 'country', metric: 'spend', period, entity_ref: entity,
    }, defaults)).toThrow(ToolArgumentError);
  });

  const composition = { days_total: 2, days_with_value: 1, days_metric_missing: 0,
    days_no_row: 0, days_not_observed: 1, days_open: 0, days_captured_partial: 0,
    fetched_at_min: null, fetched_at_max: null, observed_from: '2026-01-01',
    observed_to: '2026-01-01', partial: true };
  const scope = { level: 'account', entity_ref: entity, entity_name: 'Cuenta sintética',
    period, period_a: null, period_b: null, period_defaulted: false,
    entity_defaulted: false, timezone: 'UTC', currency: 'USD' };
  const value = { path_key: 'total', metric: 'spend', unit: 'money', currency: 'USD',
    action_type: null, attribution_ref: null, period, period_a: null, period_b: null,
    day: null, entity_ref: entity, entity_name: 'Cuenta sintética', parent_ref: null,
    segment_primary: null, segment_secondary: null, value: '9007199254740993.125',
    absence: null, presence: null, temporal_status: null, captured_partial: false,
    fetched_at: null, composition };
  const result = { status: 'ok', reason: null, scope, values: [value], composition,
    extra: { trends: { [entity]: [] }, nearest_before: '2025-12-31' } };

  it('valida la forma común completa y conserva decimales fuera de number', () => {
    const parsed = parseToolResult(result, 't1', '…0151');
    expect(parsed.values[0].value).toBe('9007199254740993.125');
    expect(parsed.values[0].path).toBe('/values/0');
    expect(parsed.values[0].tool_call_id).toBe('t1');
    expect(parsed.values[0].account_ref).toBe('…0151');
    expect(toModelView(parsed).values[0].value).toBe('9007199254740993.125');
    expect(toModelView(parsed).extra).not.toHaveProperty('trends');
    expect(toModelView(parsed).extra).not.toHaveProperty('nearest_before');
    expect(toModelView(parsed).values[0]).not.toHaveProperty('fetched_at');
  });

  it('minimiza también las composiciones de los dos períodos en extra', () => {
    const parsed = parseToolResult({ ...result, extra: {
      composition_a: composition, composition_b: composition,
      period_lengths_differ: false,
    } }, 't1', null);
    const extra = toModelView(parsed).extra as Record<string, unknown>;
    for (const key of ['composition_a', 'composition_b']) {
      expect(extra[key]).toMatchObject({ days_total: 2, partial: true });
      expect(extra[key]).not.toHaveProperty('fetched_at_min');
      expect(extra[key]).not.toHaveProperty('fetched_at_max');
      expect(extra[key]).not.toHaveProperty('observed_from');
      expect(extra[key]).not.toHaveProperty('observed_to');
    }
    expect(extra.period_lengths_differ).toBe(false);
  });

  it('admite identificadores de hasta seis llamadas y rechaza la séptima', () => {
    expect(parseToolResult(result, 't5', null).tool_call_id).toBe('t5');
    expect(parseToolResult(result, 't6', null).tool_call_id).toBe('t6');
    expect(() => parseToolResult(result, 't7', null)).toThrow(ToolResultError);
  });

  it('rechaza una cifra JSON, campo faltante, ausencias ambiguas y formas incoherentes', () => {
    for (const broken of [
      { ...value, value: 9007199254740992 },
      { ...value, unit: undefined },
      { ...value, value: null, absence: null },
      { ...value, value: '1', absence: 'no_informado' },
      { ...value, day: '2026-01-01', presence: null },
      { ...value, value: '-1e3' },
      { ...value, action_type: 'purchase' },
      { ...value, metric: 'action_count', unit: 'count', currency: null,
        action_type: null },
      { ...value, captured_partial: true },
    ]) expect(() => parseToolResult({ ...result, values: [broken] }, 't1', '…0151'))
      .toThrow(ToolResultError);
    expect(() => parseToolResult({ ...result, status: 'not_calculable', reason: 'data_absent' }, 't1', '…0151'))
      .toThrow(ToolResultError);
  });

  it('conserva día, presencia y segmentos, y valida ausencia diaria', () => {
    const daily = { ...value, path_key: 'day', day: '2026-01-02', value: null,
      absence: 'sin_fila_reportada', presence: 'sin_fila_reportada',
      segment_primary: '25-34', segment_secondary: 'female', composition: null };
    const parsed = parseToolResult({ ...result, values: [daily] }, 't2', null);
    expect(toModelView(parsed).values[0]).toMatchObject({ day: '2026-01-02',
      segment_primary: '25-34', segment_secondary: 'female',
      absence: 'sin_fila_reportada' });
  });

  it('valida los seis ejemplos de salida y rechaza combinaciones de períodos', () => {
    const cases = [
      { ...value, path_key: 'day', day: '2026-01-01', presence: 'con_datos',
        value: '12.50', composition: null },
      { ...value, path_key: 'day', day: '2026-01-02', presence: 'sin_fila_reportada',
        value: null, absence: 'sin_fila_reportada', composition: null },
      { ...value, path_key: 'entity', metric: 'clicks', unit: 'count',
        currency: null, value: '40' },
      { ...value, path_key: 'segment', segment_primary: '25-34',
        segment_secondary: 'female', value: '7.25' },
      { ...value, path_key: 'segment_share', metric: 'share', unit: 'percent',
        segment_primary: '25-34', segment_secondary: 'female', value: '40.000000', currency: null },
    ];
    for (const item of cases) expect(parseToolResult({ ...result, values: [item] }, 't1', null).values)
      .toHaveLength(1);
    const comparison = { ...result,
      scope: { ...scope, period: null, period_a: previous, period_b: period },
      values: [{ ...value, path_key: 'change', metric: 'spend', unit: 'percent',
        currency: null, value: '-12.500000', period: null,
        period_a: previous, period_b: period }],
    };
    expect(parseToolResult(comparison, 't1', null).values[0].value).toBe('-12.500000');
    expect(() => parseToolResult({ ...result,
      scope: { ...scope, period_a: previous } }, 't1', null)).toThrow(ToolResultError);
    expect(() => parseToolResult({ ...result, values: [{ ...value,
      period: null, period_a: previous }] }, 't1', null)).toThrow(ToolResultError);
  });

  it('mapea nombres de acción por igualdad exacta y conserva el identificador', () => {
    expect(actionLabel('purchase')).toContain('purchase');
    expect(actionLabel('purchase')).not.toBe(actionLabel('omni_purchase'));
    expect(actionLabel('omni_purchase')).toContain('omni_purchase');
    expect(actionLabel('lead')).toContain('lead');
    expect(actionLabel('link_click')).toContain('link_click');
    expect(actionLabel('landing_page_view')).toContain('landing_page_view');
  });

  it('resuelve cuenta paginada y ejecuta RPC con conexión del servidor', async () => {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const ctx = { connection: { id: 'cc000000-0000-4000-8000-000000000151', status: 'active' as const,
      external_account_id: 'act_90000151', currency: 'USD', timezone: 'UTC' } };
    const deps = {
      listEntities: async () => [{ entity_ref: entity, level: 'account' as const,
        parent_ref: null, name: 'Cuenta', effective_status: null, objective: null,
        metadata_fetched_at: '2026-01-01T00:00:00Z', captured_at: '2026-01-01T00:00:00Z' }],
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args }); return result;
      },
    };
    const projected = await resolveToolCall('total', { entity_ref: null, metric: 'spend', period: null },
      ctx, defaults.period, deps);
    expect(projected.entityDefaulted).toBe(true);
    const output = await executeTool(projected, ctx, 't1', deps);
    expect(output.values[0].value).toBe('9007199254740993.125');
    expect(calls).toEqual([{ fn: 'chat_total', args: {
      p_connection_id: ctx.connection.id, p_entity_ref: entity, p_metric: 'spend',
      p_from: period.from, p_to: period.to, p_action_type: null,
    } }]);
  });

  it('una RPC fallida no expone su mensaje', async () => {
    const ctx = { connection: { id: 'cc000000-0000-4000-8000-000000000151', status: 'active' as const,
      external_account_id: 'act_90000151', currency: 'USD', timezone: 'UTC' } };
    const call = projectToolArgs('total', valid.total, defaults);
    await expect(executeTool(call, ctx, 't1', { rpc: async () => {
      throw new Error('detalle sensible de PostgREST');
    } })).rejects.toThrow(ToolExecutionError);
  });

  it('lee todas las entidades y solo muestra cincuenta con total explícito', async () => {
    const ctx = { connection: { id: 'cc000000-0000-4000-8000-000000000151', status: 'active' as const,
      external_account_id: 'act_90000151', currency: 'USD', timezone: 'UTC' } };
    const entities = Array.from({ length: 1001 }, (_, n) => ({ entity_ref:
      `a0000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`,
      level: 'campaign' as const, parent_ref: null, name: `Campaña ${n + 1}`,
      effective_status: null, objective: null, metadata_fetched_at: '2026-01-01T00:00:00Z',
      captured_at: '2026-01-01T00:00:00Z' }));
    const call = projectToolArgs('entities', { level: 'campaign' }, defaults);
    const output = await executeTool(call, ctx, 't1', { listEntities: async () => entities });
    expect(output.values[0].value).toBe('1001');
    expect(output.extra.total).toBe(1001);
    expect(output.extra.truncated).toBe(true);
    expect(output.extra.entities).toHaveLength(50);
    expect(toModelView(output).extra.entities).toHaveLength(50);
    const pages: number[] = [];
    const supabase = { rpc: () => ({ range: async (start: number, end: number) => {
      pages.push(start);
      return { data: entities.slice(start, end + 1), count: entities.length, error: null };
    } }) } as unknown as SupabaseClient;
    const complete = await executeTool(call, ctx, 't1', { supabase });
    expect(pages).toEqual([0, 1000]);
    expect(complete.values[0].value).toBe('1001');
    const broken = { rpc: () => ({ range: async (start: number, end: number) =>
      start === 0 ? { data: entities.slice(start, end + 1), count: entities.length, error: null }
        : { data: null, count: null, error: { message: 'falló la segunda página' } },
    }) } as unknown as SupabaseClient;
    await expect(executeTool(call, ctx, 't1', { supabase: broken }))
      .rejects.toThrow(ToolExecutionError);
  });
});
