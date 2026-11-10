import { beforeAll, describe, expect, it, vi } from 'vitest';

import { CHAT_MODEL_ID, requestChatModel } from '@/modules/chat/llm';
import { projectOutput } from '@/modules/chat/output-schema';
import { runChatTurn, type ChatDependencies, type RecordPayload } from '@/modules/chat/orchestrator';
import type { ToolResult } from '@/modules/chat/tools/results';
import { projectToolArgs, type ProjectedToolCall } from '@/modules/chat/tools/schema';
import type { TenantContext } from '@/modules/tenant/context';
import { diagnoseProjection, modelResponseCheck } from './expanded-diagnostic';
import { expandedSyntheticResult } from './expanded-synthetic';
import { scoreExpandedCase } from './expanded-score';
import { createAlternateModelFetch, EVAL_ALTERNATE_MODEL } from './alternate-model';
import { baseCases, type BaseCase } from './fixtures/base';
import { expandedCases, type ExpandedCase } from './fixtures/expanded';

vi.mock('server-only', () => ({}));

const actor = 'a0000000-0000-4000-8000-000000000151';
const company = 'c0000000-0000-4000-8000-000000000151';
const account = 'b0000000-0000-4000-8000-000000000151';
const connectionId = 'd0000000-0000-4000-8000-000000000151';
const context: TenantContext = { user_id: actor, company_id: company,
  role: 'owner', request_id: 'e0000000-0000-4000-8000-000000000151' };
type EvalCase = BaseCase | ExpandedCase;
type Result = { id: string; group: 'base' | 'added'; expected: string; kind: string;
  reason: string | null; correct: boolean; latency: number; tokens: number;
  replies: number; reported: number; diagnostic: string | null;
  phase: 'choice' | 'tools' | 'answer' | null };

beforeAll(() => {
  const alternate = process.env.VR02_ALT_MODEL;
  const composedOnly = process.env.VR02_COMPOSED_ONLY === '1';
  if ((alternate !== undefined || composedOnly) &&
      (alternate !== EVAL_ALTERNATE_MODEL || !composedOnly ||
        process.env.VR02_EXPANDED_IDS || process.env.VR02_EXPANDED_CASE)) {
    throw new Error('El modelo alternativo exige solo E01–E33 sin otros filtros.');
  }
  if (!process.env.DEEPINFRA_API_KEY) {
    throw new Error('Falta DEEPINFRA_API_KEY inyectada en el proceso de evaluación.');
  }
});

function scoreBase(fixture: BaseCase, kind: string, reason: string | null,
  calls: ProjectedToolCall[], blocks: { type: string; cells: string[];
    rowCount: number }[],
  text: string): boolean {
  const wanted = fixture.expected;
  if (wanted.kind === 'abstention') return kind === 'abstention' &&
    reason === wanted.reason;
  const chosen = calls.some((call) => call.name === wanted.tool &&
    call.args.metric === wanted.metric &&
    JSON.stringify(call.args.period) === JSON.stringify(wanted.period));
  const cells = blocks.flatMap((block) => block.cells);
  const visible = `${text} ${cells.join(' ')}`;
  const value = wanted.tool === 'daily_series' ? blocks.some((block) =>
    ['lineas', 'tabla'].includes(block.type) && block.rowCount === 7 &&
    block.cells.some((cell) =>
      cell.includes('01/2026'))) : wanted.metric === 'spend' ?
        /12[,.]50/u.test(visible) :
        wanted.metric === 'impressions' ? /120/u.test(visible) :
          wanted.metric === 'clicks' ? /24/u.test(visible) : true;
  return kind === 'answer' && chosen && value;
}

async function evaluateOne(fixture: EvalCase): Promise<Result> {
  const calls: ProjectedToolCall[] = [];
  const toolResults: ToolResult[] = [];
  const records: RecordPayload[] = [];
  const diagnose = process.env.VR02_DIAG === 'branches';
  const alternate = process.env.VR02_ALT_MODEL === EVAL_ALTERNATE_MODEL;
  const expectedModel = alternate ? EVAL_ALTERNATE_MODEL : CHAT_MODEL_ID;
  let tokens = 0; let replies = 0; let reported = 0;
  let latency = 60_001; let diagnostic: string | null = null;
  let phaseOfFailure: Result['phase'] = null;
  const model = async (phase: 'choice' | 'answer',
    messages: Parameters<typeof requestChatModel>[0]['messages'],
    timeoutMs: number, signal: AbortSignal) => {
    let responseCheck = 'no_response';
    const inspectFetch: typeof fetch = async (input, init) => {
      const response = await fetch(input, init);
      responseCheck = await modelResponseCheck(response, phase);
      return response;
    };
    try {
      const fetchImpl = alternate ?
        createAlternateModelFetch(EVAL_ALTERNATE_MODEL, diagnose ? inspectFetch : fetch) :
        diagnose ? inspectFetch : undefined;
      const reply = phase === 'choice' ?
        await requestChatModel({ phase, messages, timeoutMs, signal,
          fetchImpl }) :
        await requestChatModel({ phase, messages, timeoutMs, signal,
          fetchImpl });
      replies += 1;
      tokens += reply.usage?.totalTokens ?? 0;
      if (reply.reportedModelId === expectedModel) reported += 1;
      if (diagnose && phase === 'choice' && 'action' in reply.output) {
        phaseOfFailure = 'choice';
        if (reply.output.action === 'clarify') {
          diagnostic = 'choice:clarify';
        } else if (reply.output.action === 'abstain') {
          diagnostic = `choice:abstain:${reply.output.abstain_reason ?? 'null'}`;
        } else if (reply.output.action === 'answer') {
          diagnostic = calls.length ? 'choice:answer_after_tools' :
            'choice:answer_without_tools';
        } else diagnostic = 'choice:call_tools';
      }
      if (diagnose && phase === 'answer' && 'text' in reply.output) {
        phaseOfFailure = 'answer';
        try { projectOutput(reply.output); diagnostic = 'answer:valid'; }
        catch { diagnostic = diagnoseProjection(reply.output); }
      }
      return reply;
    } catch (error) {
      phaseOfFailure = phase;
      const reason = error instanceof Error && 'reason' in error ?
        String(error.reason) : 'error';
      diagnostic = reason === 'bad_output' ?
        `bad_output:${responseCheck}` : `${reason}:${responseCheck}`;
      throw error;
    }
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
      try {
        return projectToolArgs(name, args, { period, accountEntityRef: account });
      } catch (error) {
        phaseOfFailure = 'tools';
        diagnostic = `tools:resolve:${name}:${error instanceof Error ?
          error.name : 'error'}:keys=${Object.entries(args).filter(([, value]) =>
          value !== null).map(([key]) => key).join(',')}:values=${['order', 'limit',
          'include_trend', 'metric', 'level'].filter((key) => args[key] !== null &&
          args[key] !== undefined).map((key) => `${key}=${String(args[key])}`).join(',')}`;
        throw error;
      }
    },
    execute: async (call, _ctx, id) => {
      calls.push(call);
      try {
        const result = expandedSyntheticResult(call, id, fixture.id);
        toolResults.push(result);
        return result;
      } catch (error) {
        phaseOfFailure = 'tools';
        diagnostic = `tools:execute:${call.name}:${error instanceof Error ?
          error.name : 'error'}`;
        throw error;
      }
    },
    record: async (_ctx, payload) => { records.push(payload); return true; },
    now: () => performance.now(),
    wallTime: () => new Date('2026-01-15T12:00:00Z'),
    uuid: () => crypto.randomUUID(),
    log: (entry) => { latency = entry.latency_ms; },
  };
  const view = await runChatTurn({ question: fixture.question,
    previous: 'previous' in fixture ? [...(fixture.previous ?? [])] : undefined,
    pendingClarification: 'pendingClarification' in fixture ?
      fixture.pendingClarification : undefined }, deps);
  const reason = records[0]?.reason ?? null;
  const blocks = view.blocks.map((block) => ({ type: block.type,
    cells: block.table.rows.flat(), rowCount: block.table.rows.length }));
  const correct = 'block' in fixture.expected ?
    scoreExpandedCase(fixture.expected, { kind: view.kind, reason, calls, blocks,
      defaulted: view.footer?.defaulted ?? false }) :
    scoreBase(fixture as BaseCase, view.kind, reason, calls, blocks,
      view.segments.map((segment) => segment.text).join(' '));
  console.info('VR-02 ampliada caso', fixture.id, view.kind, reason,
    records[0]?.toolNames?.join(',') ?? '', view.blocks.map((block) => block.type).join(','),
    latency, correct ? 'OK' : 'FALLÓ', phaseOfFailure ?? 'none',
    diagnostic ?? 'none');
  return { id: fixture.id, group: 'block' in fixture.expected ? 'added' : 'base',
    expected: fixture.expected.kind, kind: view.kind, reason, correct, latency,
    tokens, replies, reported, diagnostic, phase: phaseOfFailure };
}

describe('M25a.3 paso 21: VR-02 ampliada congelada', () => {
  it('puntúa DEC-21, el bloque y las aclaraciones sobre el conjunto ampliado', async () => {
    expect(baseCases).toHaveLength(50);
    expect(expandedCases).toHaveLength(40);
    const allCases = [...baseCases, ...expandedCases];
    const selectedIds = process.env.VR02_EXPANDED_IDS?.split(',').map((id) => id.trim())
      .filter(Boolean) ?? (process.env.VR02_EXPANDED_CASE ?
        [process.env.VR02_EXPANDED_CASE] : []);
    const alternate = process.env.VR02_ALT_MODEL === EVAL_ALTERNATE_MODEL;
    const selected = alternate ? expandedCases.filter((item) =>
      /^E(?:0[1-9]|[12][0-9]|3[0-3])$/u.test(item.id)) :
      selectedIds.length ? allCases.filter((item) =>
        selectedIds.includes(item.id)) : allCases;
    if (alternate) expect(selected).toHaveLength(33);
    if (selectedIds.length) expect(selected).toHaveLength(selectedIds.length);
    const results: Result[] = [];
    for (const fixture of selected) results.push(await evaluateOne(fixture));
    const answers = results.filter((item) => item.expected === 'answer');
    const abstentions = results.filter((item) => item.expected === 'abstention');
    const clarifications = results.filter((item) => item.expected === 'clarification');
    const accuracy = answers.filter((item) => item.correct).length / answers.length;
    const unjustified = answers.filter((item) => item.kind !== 'answer' &&
      !item.correct).length / answers.length;
    const abstentionRate = abstentions.filter((item) => item.correct).length /
      abstentions.length;
    const sorted = results.map((item) => item.latency).sort((a, b) => a - b);
    const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1];
    const summary = { cases: results.length, answerable: answers.length,
      answerableCorrect: answers.filter((item) => item.correct).length, accuracy,
      unjustifiedCount: answers.filter((item) => item.kind !== 'answer' &&
        !item.correct).length,
      unjustified, abstentions: abstentions.length,
      abstentionsCorrect: abstentions.filter((item) => item.correct).length,
      abstentionRate, clarifications: clarifications.length,
      clarificationsCorrect: clarifications.filter((item) => item.correct).length,
      p95,
      reported: results.reduce((sum, item) => sum + item.reported, 0),
      replies: results.reduce((sum, item) => sum + item.replies, 0),
      totalTokens: results.reduce((sum, item) => sum + item.tokens, 0),
      failedIds: results.filter((item) => !item.correct).map((item) => item.id) };
    console.info('VR-02 ampliada resumen', JSON.stringify(summary));
    if (selectedIds.length || alternate) return;
    expect(summary.reported).toBe(summary.replies);
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
    expect(unjustified).toBeLessThanOrEqual(0.1);
    expect(abstentionRate).toBeGreaterThanOrEqual(0.95);
    expect(p95).toBeLessThanOrEqual(20_000);
    expect(summary.clarificationsCorrect).toBe(summary.clarifications);
  }, 1_800_000);
});
