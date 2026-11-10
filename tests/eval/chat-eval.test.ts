import { beforeAll, describe, expect, it, vi } from 'vitest';

import { CHAT_MODEL_ID, requestChatModel } from '@/modules/chat/llm';
import { runChatTurn, type ChatDependencies, type RecordPayload } from '@/modules/chat/orchestrator';
import { findNumericCandidates } from '@/modules/chat/numeric-candidates';
import { parseToolResult, type ToolResult } from '@/modules/chat/tools/results';
import { projectToolArgs, type ProjectedToolCall } from '@/modules/chat/tools/schema';
import type { TenantContext } from '@/modules/tenant/context';
import { baseCases, type BaseCase } from './fixtures/base';
import { loadEnv } from '../../scripts/lib/env.mjs';

vi.mock('server-only', () => ({}));

const diagnosticFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  console.info('DeepInfra HTTP:', response.status);
  if (process.env.VR02_CASE && response.ok) {
    const metadata = await response.clone().json() as { choices?: { finish_reason?: string }[];
      usage?: { completion_tokens?: number } };
    console.info('VR-02 diagnóstico metadatos', metadata.choices?.[0]?.finish_reason ?? null,
      metadata.usage?.completion_tokens ?? null);
  }
  return response;
};

beforeAll(() => {
  const configured = loadEnv();
  if (!configured.DEEPINFRA_API_KEY) throw new Error('Falta la clave local del modelo.');
  process.env.DEEPINFRA_API_KEY = configured.DEEPINFRA_API_KEY;
});

describe('M25a.2 paso 9: esquema real con entradas sintéticas', () => {
  it('acepta elección estricta y devuelve modelo informado', async () => {
    const started = performance.now();
    const result = await requestChatModel({ phase: 'choice', fetchImpl: diagnosticFetch, messages: [
      { role: 'system', content: 'Responde en JSON conforme al esquema. La consulta sintética está fuera del catálogo publicitario. Devuelve action abstain, calls vacío, clarification_text nulo y abstain_reason out_of_scope.' },
      { role: 'user', content: '¿Cuál es la capital de Marte?' },
    ] });
    expect(result.requestedModelId).toBe(CHAT_MODEL_ID);
    expect(result.reportedModelId).toBe(CHAT_MODEL_ID);
    expect(result.output.action).toBe('abstain');
    expect(result.output.abstain_reason).toBe('out_of_scope');
    console.info('VR-02 esquema elección: modelo', result.reportedModelId,
      'latencia_ms', Math.round(performance.now() - started),
      'tokens', result.usage?.totalTokens ?? null);
  });

  it('acepta redacción estricta sin cifras ni herramientas', async () => {
    const started = performance.now();
    const result = await requestChatModel({ phase: 'answer', fetchImpl: diagnosticFetch, messages: [
      { role: 'system', content: 'Responde en JSON conforme al esquema. Es una prueba sintética sin datos empresariales. Escribe un texto corto sin cifras, claims vacío y blocks vacío.' },
      { role: 'user', content: 'Explica que no hay datos para responder.' },
    ] });
    expect(result.requestedModelId).toBe(CHAT_MODEL_ID);
    expect(result.reportedModelId).toBe(CHAT_MODEL_ID);
    expect(result.output.claims).toEqual([]);
    expect(result.output.blocks).toEqual([]);
    console.info('VR-02 esquema respuesta: modelo', result.reportedModelId,
      'latencia_ms', Math.round(performance.now() - started),
      'tokens', result.usage?.totalTokens ?? null);
  });

  it('rechaza una respuesta truncada sin exponer su contenido', async () => {
    let finishReason: string | null = null;
    const inspectFinish: typeof fetch = async (input, init) => {
      const response = await diagnosticFetch(input, init);
      if (response.ok) {
        const body = await response.clone().json() as { choices?: { finish_reason?: string | null }[] };
        finishReason = body.choices?.[0]?.finish_reason ?? null;
      }
      return response;
    };
    await expect(requestChatModel({ phase: 'answer', fetchImpl: inspectFinish,
      maxTokens: 1, messages: [
        { role: 'user', content: 'Prueba sintética: redacta una respuesta breve con claims y blocks vacíos.' },
      ] })).rejects.toMatchObject({ reason: 'bad_output' });
    expect(finishReason).toBe('length');
    console.info('VR-02 truncado: finish_reason', finishReason);
  });
});

const actor = 'a0000000-0000-4000-8000-000000000151';
const company = 'c0000000-0000-4000-8000-000000000151';
const account = 'b0000000-0000-4000-8000-000000000151';
const connectionId = 'd0000000-0000-4000-8000-000000000151';
const context: TenantContext = { user_id: actor, company_id: company,
  role: 'owner', request_id: 'e0000000-0000-4000-8000-000000000151' };

function days(period: { from: string; to: string }): number {
  return Math.round((Date.parse(period.to) - Date.parse(period.from)) / 86_400_000) + 1;
}

function syntheticResult(call: ProjectedToolCall, id: string): ToolResult {
  const args = call.args;
  const period = (args.period ?? null) as { from: string; to: string } | null;
  const empty = period?.from.startsWith('2024') ?? false;
  const count = period ? days(period) : 0;
  const metric = String(args.metric ?? 'spend');
  const money = ['spend', 'cpc', 'cpm', 'action_value'].includes(metric);
  const unit = money ? 'money' : metric === 'ctr' ? 'percent' : 'count';
  const total = metric === 'spend' ? '12.50' : metric === 'impressions' ?
    '120' : metric === 'clicks' ? '24' : '10';
  const composition = period ? { days_total: count, days_with_value: empty ? 0 : count,
    days_metric_missing: 0, days_no_row: 0, days_not_observed: empty ? count : 0,
    days_open: 0, days_captured_partial: 0,
    fetched_at_min: empty ? null : '2026-01-15T00:00:00Z',
    fetched_at_max: empty ? null : '2026-01-15T00:00:00Z',
    observed_from: empty ? null : period.from,
    observed_to: empty ? null : period.to, partial: empty } : null;
  const scope = { level: args.level ?? 'account', entity_ref: args.entity_ref ?? account,
    entity_name: 'Cuenta sintética', period, period_a: null, period_b: null,
    period_defaulted: call.periodDefaulted, entity_defaulted: call.entityDefaulted,
    timezone: 'UTC', currency: 'USD' };
  const value = (path_key: string, amount: string, day: string | null = null) => ({
    path_key, metric, unit, currency: money ? 'USD' : null,
    action_type: ['action_count', 'action_value'].includes(metric) ?
      String(args.action_type ?? 'purchase') : null,
    attribution_ref: null, period, period_a: null, period_b: null,
    day, entity_ref: account, entity_name: 'Cuenta sintética', parent_ref: null,
    segment_primary: null, segment_secondary: null, value: amount, absence: null,
    presence: day ? 'con_datos' : null, temporal_status: null,
    captured_partial: false, fetched_at: null, composition: day ? null : composition,
  });
  if (call.name === 'entities') {
    return parseToolResult({ status: 'ok', reason: null,
      scope: { ...scope, period: null, level: args.level ?? 'account' },
      values: [{ ...value('list_count', '1'), metric: 'list_count', unit: 'count',
        currency: null, period: null, entity_ref: null, entity_name: null,
        composition: null }], composition: null,
      extra: { entities: [{ entity_ref: account, level: 'account',
        name: 'Cuenta sintética', parent_ref: null }], total: 1 } },
    id, '…0151', call.name);
  }
  if (call.name === 'connection_status') {
    return parseToolResult({ status: 'ok', reason: null,
      scope: { ...scope, period: null }, values: [], composition: null,
      extra: { connection_status: 'active' } }, id, '…0151', call.name);
  }
  let values: ReturnType<typeof value>[] = [];
  if (!empty && call.name === 'total') values = [value('total', total)];
  if (!empty && call.name === 'daily_series' && period) {
    values = Array.from({ length: count }, (_, index) => {
      const date = new Date(Date.parse(period.from) + index * 86_400_000)
        .toISOString().slice(0, 10);
      const amount = index === count - 1 ? metric === 'spend' ? '6.50' :
        metric === 'impressions' ? '60' : '12' :
        metric === 'spend' ? '1.00' : metric === 'impressions' ? '10' : '2';
      return value('day', amount, date);
    });
  }
  const supported = ['total', 'daily_series', 'coverage'].includes(call.name);
  return parseToolResult({ status: supported ? 'ok' : 'not_supported',
    reason: supported ? null : 'metric_not_additive',
    scope, values, composition, extra: empty ? { history_from: '2026-01-01',
      history_to: '2026-01-14' } : {} }, id, '…0151', call.name);
}

type CaseResult = { id: string; expected: BaseCase['expected'];
  kind: string; reason: string | null; correct: boolean; latencyMs: number;
  reported: boolean; totalTokens: number; toolNames: string[]; unbacked: boolean };

function isCorrectAbstention(kind: string, actualReason: string | null,
  expectedReason: string | undefined): boolean {
  return kind === 'abstention' && actualReason === expectedReason;
}

async function evaluateOne(fixture: BaseCase): Promise<CaseResult> {
  const calls: ProjectedToolCall[] = [];
  const records: RecordPayload[] = [];
  let totalTokens = 0;
  let reported = true;
  let loggedLatency = 60_001;
  const model = async (phase: 'choice' | 'answer', messages: Parameters<typeof requestChatModel>[0]['messages'],
    timeoutMs: number, signal: AbortSignal) => {
    const reply = phase === 'choice' ?
      await requestChatModel({ phase, messages, timeoutMs, signal,
        fetchImpl: process.env.VR02_CASE ? diagnosticFetch : undefined }) :
      await requestChatModel({ phase, messages, timeoutMs, signal,
        fetchImpl: process.env.VR02_CASE ? diagnosticFetch : undefined });
    totalTokens += reply.usage?.totalTokens ?? 0;
    if (reply.reportedModelId !== CHAT_MODEL_ID) reported = false;
    if (process.env.VR02_CASE) console.info('VR-02 diagnóstico modelo', fixture.id,
      phase, JSON.stringify(reply.output));
    return reply;
  };
  const deps: ChatDependencies = {
    context: async () => context,
    begin: async () => {}, end: async () => true,
    connection: async () => ({ id: connectionId, status: 'active',
      credential_generation: 1, external_account_id: 'act_synthetic0151',
      currency: 'USD', timezone: 'UTC' }),
    readCoverage: async () => ({ history_from: '2026-01-01',
      history_to: '2026-01-14', nearest_before: null, nearest_after: null }),
    choose: (messages, timeoutMs, signal) => model('choice', messages,
      timeoutMs, signal) as ReturnType<ChatDependencies['choose']>,
    answer: (messages, timeoutMs, signal) => model('answer', messages,
      timeoutMs, signal) as ReturnType<ChatDependencies['answer']>,
    resolve: async (name, args, _ctx, period) => {
      try { return projectToolArgs(name, args, { period, accountEntityRef: account }); }
      catch (error) {
        if (process.env.VR02_CASE) console.info('VR-02 diagnóstico resolución', fixture.id,
          name, JSON.stringify(args), error instanceof Error ? error.name : 'error');
        throw error;
      }
    },
    execute: async (call, _ctx, id) => {
      calls.push(call);
      try { return syntheticResult(call, id); }
      catch (error) {
        if (process.env.VR02_CASE) console.info('VR-02 diagnóstico herramienta',
          fixture.id, call.name, JSON.stringify(call.args),
          error instanceof Error ? error.name : 'error');
        throw error;
      }
    },
    record: async (_ctx, payload) => { records.push(payload); return true; },
    now: () => performance.now(), wallTime: () => new Date('2026-01-15T12:00:00Z'),
    uuid: () => crypto.randomUUID(),
    log: (entry) => { loggedLatency = entry.latency_ms; },
  };
  const view = await runChatTurn({ question: fixture.question }, deps);
  const record = records[0];
  const wanted = fixture.expected;
  const business = calls.filter((call) => !['entities', 'connection_status'].includes(call.name));
  const chosen = business.some((call) => call.name === wanted.tool &&
    (wanted.metric === null || call.args.metric === wanted.metric) &&
    (wanted.period === null || JSON.stringify(call.args.period) === JSON.stringify(wanted.period)));
  const visible = view.segments.map((segment) => segment.text).join(' ') +
    view.blocks.map((block) => block.table.rows.flat().join(' ')).join(' ');
  const answerValue = wanted.tool === 'daily_series' ? view.blocks.some((block) =>
    ['lineas', 'tabla'].includes(block.type) && block.table.rows.length === 7 &&
    block.table.rows.some((row) => row.some((cell) => cell.includes('01/2026')))) :
    wanted.metric === 'spend' ? /12[,.]50/u.test(visible) :
      wanted.metric === 'impressions' ? /120/u.test(visible) :
        wanted.metric === 'clicks' ? /24/u.test(visible) : true;
  const correct = wanted.kind === 'answer' ? view.kind === 'answer' && chosen &&
    answerValue : isCorrectAbstention(view.kind, record?.reason ?? null, wanted.reason);
  const unbacked = view.kind === 'answer' && view.segments.some((segment) =>
    segment.type === 'plain' && findNumericCandidates(segment.text).length > 0);
  return { id: fixture.id, expected: wanted, kind: view.kind,
    reason: record?.reason ?? null, correct,
    latencyMs: loggedLatency,
    reported, totalTokens, toolNames: record?.toolNames ?? [], unbacked };
}

describe('M25a.2 paso 14: VR-02 base congelada', () => {
  it('puntúa el motivo esperado de la abstención y no confunde rechazo con alcance', () => {
    expect(isCorrectAbstention('abstention', 'guard_rejected', 'out_of_scope')).toBe(false);
    expect(isCorrectAbstention('abstention', 'out_of_scope', 'out_of_scope')).toBe(true);
    expect(isCorrectAbstention('abstention', 'no_coverage', 'no_coverage')).toBe(true);
    expect(isCorrectAbstention('answer', 'out_of_scope', 'out_of_scope')).toBe(false);
  });
  it('mide todos los umbrales DEC-21 con orquestador y DeepInfra reales', async () => {
    const diagnosticId = process.env.VR02_CASE;
    const selected = diagnosticId ? baseCases.filter((item) => item.id === diagnosticId) : baseCases;
    if (diagnosticId) expect(selected).toHaveLength(1);
    else {
      expect(baseCases.filter((item) => item.expected.kind === 'answer')).toHaveLength(30);
      expect(baseCases.filter((item) => item.expected.kind === 'abstention')).toHaveLength(20);
    }
    const results: CaseResult[] = [];
    for (const fixture of selected) {
      const result = await evaluateOne(fixture);
      results.push(result);
      console.info('VR-02 caso', result.id, result.kind, result.reason,
        result.toolNames.join(','), result.latencyMs, result.correct ? 'OK' : 'FALLÓ');
    }
    const answerable = results.filter((item) => item.expected.kind === 'answer');
    const abstention = results.filter((item) => item.expected.kind === 'abstention');
    const accuracy = answerable.filter((item) => item.correct).length / answerable.length;
    const unjustified = answerable.filter((item) => item.kind !== 'answer').length / answerable.length;
    const abstentionRate = abstention.filter((item) => item.correct).length / abstention.length;
    const sorted = results.map((item) => item.latencyMs).sort((x, y) => x - y);
    const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1];
    const summary = { cases: results.length, accuracy, unjustified,
      abstentionRate, p95, reported: results.every((item) => item.reported),
      unbacked: results.filter((item) => item.unbacked).length,
      totalTokens: results.reduce((sum, item) => sum + item.totalTokens, 0),
      failedIds: results.filter((item) => !item.correct).map((item) => item.id) };
    console.info('VR-02 base resumen', JSON.stringify(summary));
    if (diagnosticId) { expect(results[0].correct).toBe(true); return; }
    expect(summary.reported).toBe(true);
    expect(summary.unbacked).toBe(0);
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
    expect(unjustified).toBeLessThanOrEqual(0.1);
    expect(abstentionRate).toBeGreaterThanOrEqual(0.95);
    expect(p95).toBeLessThanOrEqual(20_000);
  }, 900_000);
});
