import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

import { CHAT_MODEL_ID, requestChatModel } from '@/modules/chat/llm';
import { CHAT_LIMITS } from '@/modules/chat/limits';
import { answerSchema, choiceSchema, projectOutput } from '@/modules/chat/output-schema';
import { defaultPeriod, runChatTurn, type ChatDependencies, type RecordPayload } from '@/modules/chat/orchestrator';
import { choiceMessages } from '@/modules/chat/prompt';
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
    const metadata = await response.clone().json() as { choices?: { finish_reason?: string;
      message?: { content?: string } }[];
      usage?: { completion_tokens?: number } };
    console.info('VR-02 diagnóstico metadatos', metadata.choices?.[0]?.finish_reason ?? null,
      metadata.usage?.completion_tokens ?? null);
    const content = metadata.choices?.[0]?.message?.content;
    if (content) {
      try {
        const parsed = JSON.parse(content) as Record<string, unknown>;
        if ('action' in parsed) {
          const checked = choiceSchema.safeParse(parsed);
          console.info('VR-02 diagnóstico esquema elección', parsed.action,
            Array.isArray(parsed.calls) ? parsed.calls.length : null,
            checked.success ? 'válido' : checked.error.issues.map((issue) =>
              `${issue.path.join('.')}:${issue.code}`).join(','));
        }
      } catch { console.info('VR-02 diagnóstico JSON inválido'); }
    }
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
      { role: 'system', content: 'Responde en JSON conforme al esquema. Es una prueba sintética sin datos empresariales. Escribe un texto corto sin cifras y blocks vacío.' },
      { role: 'user', content: 'Explica que no hay datos para responder.' },
    ] });
    expect(result.requestedModelId).toBe(CHAT_MODEL_ID);
    expect(result.reportedModelId).toBe(CHAT_MODEL_ID);
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
        { role: 'user', content: 'Prueba sintética: redacta una respuesta breve con blocks vacío.' },
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
  reported: boolean; totalTokens: number; toolNames: string[];
  diagnostic: string | null; phase: 'choice' | 'answer' | null };

async function modelResponseCheck(response: Response, phase: 'choice' | 'answer') {
  if (!response.ok) return `http:${response.status}`;
  let body: { choices?: { finish_reason?: string | null;
    message?: { content?: string | null } }[] };
  try { body = await response.clone().json() as typeof body; }
  catch { return 'response_json'; }
  const choice = body.choices?.[0];
  if (!choice) return 'envelope_schema:choices';
  if (choice.finish_reason !== 'stop') return `finish_reason:${choice.finish_reason ?? 'missing'}`;
  if (typeof choice.message?.content !== 'string') return 'envelope_schema:content';
  let output: unknown;
  try { output = JSON.parse(choice.message.content); }
  catch { return 'content_json'; }
  const parsed = phase === 'choice' ? choiceSchema.safeParse(output) :
    answerSchema.safeParse(output);
  if (parsed.success) return 'valid';
  if (phase === 'choice' && output && typeof output === 'object' &&
      !Array.isArray(output)) {
    const raw = output as Record<string, unknown>;
    const action = raw.action;
    const calls = raw.calls;
    if (typeof action !== 'string' ||
        !['call_tools', 'answer', 'clarify', 'abstain'].includes(action)) {
      return 'unknown_action_schema';
    }
    if (Array.isArray(calls)) {
      if (calls.length > CHAT_LIMITS.maxToolCallsPerTurn) return 'excess_calls_schema';
      if (action !== 'call_tools' && calls.length > 0) {
        return `choice_incoherent:${action}_with_calls`;
      }
    }
    if ((action === 'clarify') !== (raw.clarification_text !== null)) {
      return 'choice_incoherent:clarification_text';
    }
    if ((action === 'abstain') !== (raw.abstain_reason !== null)) {
      return 'choice_incoherent:abstain_reason';
    }
  }
  return `schema:${parsed.error.issues.map((issue) =>
    `${issue.path.join('.') || 'root'}:${issue.code}`).join(',')}`;
}

function isCorrectAbstention(kind: string, actualReason: string | null,
  expectedReason: string | undefined): boolean {
  return kind === 'abstention' && actualReason === expectedReason;
}

async function evaluateOne(fixture: BaseCase): Promise<CaseResult> {
  const calls: ProjectedToolCall[] = [];
  const toolResults: ToolResult[] = [];
  const records: RecordPayload[] = [];
  const diagnose = process.env.VR02_DIAG === 'branches';
  let diagnostic: string | null = null;
  let failedPhase: 'choice' | 'answer' | null = null;
  let selectedToolCalls = 0;
  let totalTokens = 0;
  let reported = true;
  let loggedLatency = 60_001;
  const model = async (phase: 'choice' | 'answer', messages: Parameters<typeof requestChatModel>[0]['messages'],
    timeoutMs: number, signal: AbortSignal) => {
    let responseCheck = 'no_response';
    const inspectFetch: typeof fetch = async (input, init) => {
      const response = await fetch(input, init);
      responseCheck = await modelResponseCheck(response, phase);
      return response;
    };
    const reply = await (async () => { try {
      return phase === 'choice' ?
        await requestChatModel({ phase, messages, timeoutMs, signal,
          fetchImpl: diagnose ? inspectFetch : process.env.VR02_CASE ? diagnosticFetch : undefined }) :
        await requestChatModel({ phase, messages, timeoutMs, signal,
          fetchImpl: diagnose ? inspectFetch : process.env.VR02_CASE ? diagnosticFetch : undefined });
    } catch (error) {
      if (diagnose) {
        failedPhase = phase;
        diagnostic = error instanceof Error && 'reason' in error &&
          error.reason === 'bad_output' ? `bad_output:${responseCheck}` :
          `model_unavailable:${responseCheck}`;
      }
      throw error;
    } })();
    totalTokens += reply.usage?.totalTokens ?? 0;
    if (reply.reportedModelId !== CHAT_MODEL_ID) reported = false;
    if (diagnose && phase === 'choice' && 'action' in reply.output) {
      const choice = reply.output;
      failedPhase = 'choice';
      if (choice.action === 'call_tools') {
        diagnostic = !choice.calls.length ? 'empty_calls' :
          selectedToolCalls + choice.calls.length > CHAT_LIMITS.maxToolCallsPerTurn ?
            'excess_calls' : null;
        selectedToolCalls += choice.calls.length;
      } else if (choice.action === 'abstain') {
        diagnostic = choice.abstain_reason === 'out_of_scope' ? null :
          `abstain_reason:${choice.abstain_reason ?? 'null'}`;
      } else if (choice.action === 'clarify') {
        diagnostic = 'clarify';
      } else if (choice.action !== 'answer') diagnostic = 'unknown_action';
      else diagnostic = null;
    }
    if (diagnose && phase === 'answer' && 'text' in reply.output) {
      failedPhase = 'answer';
      try { projectOutput(reply.output); diagnostic = null; }
      catch { diagnostic = 'projection'; }
    }
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
      try { const result = syntheticResult(call, id);
        toolResults.push(result); return result; }
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
  if (diagnose && !correct) console.info('VR-02 rama', fixture.id,
    failedPhase, record?.reason ?? null, diagnostic ?? 'none');
  return { id: fixture.id, expected: wanted, kind: view.kind,
    reason: record?.reason ?? null, correct,
    latencyMs: loggedLatency,
    reported, totalTokens, toolNames: record?.toolNames ?? [],
    diagnostic, phase: failedPhase };
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
      totalTokens: results.reduce((sum, item) => sum + item.totalTokens, 0),
      failedIds: results.filter((item) => !item.correct).map((item) => item.id) };
    console.info('VR-02 base resumen', JSON.stringify(summary));
    if (diagnosticId) { expect(results[0].correct).toBe(true); return; }
    expect(summary.reported).toBe(true);
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
    expect(unjustified).toBeLessThanOrEqual(0.1);
    expect(abstentionRate).toBeGreaterThanOrEqual(0.95);
    expect(p95).toBeLessThanOrEqual(20_000);
  }, 900_000);
});

describe('M25a.3 paso 20: diagnóstico del proveedor', () => {
  it('repite diez veces una elección idéntica por ID', async () => {
    if (process.env.VR02_DIAG !== 'determinism') return;
    const caseId = process.env.VR02_CASE ?? 'A04';
    const fixture = baseCases.find((item) => item.id === caseId);
    expect(fixture).toBeDefined();
    const messages = choiceMessages({ question: fixture!.question,
      previous: [], pendingClarification: null, today: '2026-01-15',
      timezone: 'UTC', currency: 'USD', accountRef: '…0151',
      defaultPeriod: defaultPeriod(new Date('2026-01-15T12:00:00Z'), 'UTC') }, []);
    const signatures: string[] = [];
    const actions: string[] = [];
    for (let index = 0; index < 10; index += 1) {
      let rawCheck = 'no_response';
      let rawSignature: string | null = null;
      const inspectFetch: typeof fetch = async (input, init) => {
        const response = await fetch(input, init);
        rawCheck = await modelResponseCheck(response, 'choice');
        if (response.ok) {
          try {
            const envelope = await response.clone().json() as { choices?: {
              message?: { content?: string | null } }[] };
            const content = envelope.choices?.[0]?.message?.content;
            if (content) rawSignature = createHash('sha256')
              .update(JSON.stringify(JSON.parse(content))).digest('hex').slice(0, 12);
          } catch { /* La categoría de error queda en rawCheck. */ }
        }
        return response;
      };
      try {
        const reply = await requestChatModel({ phase: 'choice', messages,
          fetchImpl: inspectFetch });
        signatures.push(rawSignature ?? createHash('sha256')
          .update(JSON.stringify(reply.output)).digest('hex').slice(0, 12));
        actions.push(reply.output.action);
      } catch (error) {
        signatures.push(rawSignature ?? `error:${rawCheck}`);
        actions.push(error instanceof Error && 'reason' in error ?
          `${String(error.reason)}:${rawCheck}` : 'error');
      }
    }
    const frequencies = new Map<string, number>();
    for (const signature of signatures) frequencies.set(signature,
      (frequencies.get(signature) ?? 0) + 1);
    const modalCount = Math.max(...frequencies.values());
    console.info('VR-02 determinismo', JSON.stringify({ caseId, calls: 10,
      distinctExactChoices: frequencies.size, differingFromFirst: signatures.filter(
        (signature) => signature !== signatures[0]).length,
      differingFromModal: 10 - modalCount, actions }));
    expect(signatures).toHaveLength(10);
  }, 120_000);
});

describe('M25a.3 paso 20: medición multibloque', () => {
  it('registra llamadas, tokens y duración de un turno sintético completo', async () => {
    const usage: { phase: 'choice' | 'answer'; prompt: number;
      completion: number; total: number; elapsedMs: number }[] = [];
    const executed: string[] = [];
    const records: RecordPayload[] = [];
    let choiceRound = 0;
    let loggedLatency = 60_001;
    const model = async (phase: 'choice' | 'answer',
      messages: Parameters<typeof requestChatModel>[0]['messages'],
      timeoutMs: number, signal: AbortSignal) => {
      const start = performance.now();
      const reply = await (async () => {
        try {
          return phase === 'choice' ?
            await requestChatModel({ phase, messages, timeoutMs, signal }) :
            await requestChatModel({ phase, messages, timeoutMs, signal });
        } catch (error) {
          console.info('M25a paso 20 modelo', phase,
            error instanceof Error ? error.name : 'error');
          throw error;
        }
      })();
      usage.push({ phase, prompt: reply.usage?.promptTokens ?? -1,
        completion: reply.usage?.completionTokens ?? -1,
        total: reply.usage?.totalTokens ?? -1,
        elapsedMs: Math.round(performance.now() - start) });
      if (phase === 'choice' && 'action' in reply.output) console.info('M25a paso 20 elección',
        reply.output.action, reply.output.calls.map((call) => call.name).join(','));
      expect(reply.reportedModelId).toBe(CHAT_MODEL_ID);
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
      choose: async (messages, timeoutMs, signal) => {
        const reply = await model('choice', messages, timeoutMs, signal);
        // Se mide el costo real de cada elección; el escenario fija las lecturas
        // para aislar capacidad de varios bloques de la interpretación del modelo.
        const output = choiceRound++ === 0 ? { action: 'call_tools', calls: [
          { name: 'total', args: { entity_ref: account, metric: 'spend',
            period: { from: '2026-01-01', to: '2026-01-07' } } },
          { name: 'total', args: { entity_ref: account, metric: 'impressions',
            period: { from: '2026-01-01', to: '2026-01-07' } } },
          { name: 'total', args: { entity_ref: account, metric: 'clicks',
            period: { from: '2026-01-01', to: '2026-01-07' } } },
        ], clarification_text: null, abstain_reason: null } :
          { action: 'answer', calls: [], clarification_text: null,
            abstain_reason: null };
        return { ...reply, output } as unknown as Awaited<ReturnType<ChatDependencies['choose']>>;
      },
      answer: (messages, timeoutMs, signal) => model('answer', messages,
        timeoutMs, signal) as ReturnType<ChatDependencies['answer']>,
      resolve: async (name, args, _ctx, period) => {
        try { return projectToolArgs(name, args, { period, accountEntityRef: account }); }
        catch (error) {
          console.info('M25a paso 20 resolución', name,
            error instanceof Error ? error.name : 'error');
          throw error;
        }
      },
      execute: async (call, _ctx, id) => {
        executed.push(call.name);
        return syntheticResult(call, id);
      },
      record: async (_ctx, payload) => { records.push(payload); return true; },
      now: () => performance.now(), wallTime: () => new Date('2026-01-15T12:00:00Z'),
      uuid: () => crypto.randomUUID(),
      log: (entry) => { loggedLatency = entry.latency_ms; },
    };
    const question = 'Mostrame gasto, impresiones y clics del 1 al 7 de enero de 2026: '
      + 'una tarjeta para cada métrica y una tabla con los datos.';
    const view = await runChatTurn({ question }, deps);
    console.info('M25a paso 20 medición', JSON.stringify({
      calls: usage, toolCount: executed.length, toolNames: executed,
      blocks: view.blocks.map((block) => block.type),
      turnTokens: usage.reduce((sum, call) => sum + call.total, 0),
      turnLatencyMs: loggedLatency, kind: view.kind,
      reason: records[0]?.reason ?? null,
    }));
    expect(usage.length).toBeGreaterThanOrEqual(2);
    expect(usage.every((call) => call.prompt >= 0 && call.completion >= 0 &&
      call.total >= 0 && call.completion <= CHAT_LIMITS.maxOutputTokensPerCall)).toBe(true);
    expect(executed.length).toBeGreaterThanOrEqual(3);
    expect(executed.length).toBeLessThanOrEqual(CHAT_LIMITS.maxToolCallsPerTurn);
    expect(view.kind).toBe('answer');
    expect(view.blocks.length).toBeGreaterThanOrEqual(2);
    expect(loggedLatency).toBeLessThanOrEqual(CHAT_LIMITS.turnDeadlineMs);
  }, 120_000);
});
