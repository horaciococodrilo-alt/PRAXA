import 'server-only';

import { NoCompanyError } from '@/modules/company/service';
import { UnauthorizedError } from '@/modules/identity/session';
import { getWorkerApi, WorkerApiError } from '@/modules/integrations/db/worker-api';
import { readConnectionRecord } from '@/modules/integrations/repository/connections';
import type { TenantContext } from '@/modules/tenant/context';
import { requireTenantContext } from '@/modules/tenant/context';

import { CHAT_DEFAULT_PERIOD_DAYS, CHAT_LIMITS } from './limits';
import { CHAT_MODEL_ID, ChatModelError, requestChatModel,
  type ChatMessage } from './llm';
import { choiceMessages, answerMessages } from './prompt';
import { redactQuestion } from './redaction';
import { renderTurn, type ChatTurnView } from './render';
import { projectOutput, type FlatChatAnswer, type ChatChoice } from './output-schema';
import type { ToolResult } from './tools/results';
import { ToolEntityNotFoundError, type ProjectedToolCall } from './tools/schema';
import { executeTool, missingAccountEntityResult, resolveToolCall,
  type TurnContext } from './tools/execute';
import { maskExternalAccountId } from '@/modules/integrations/contract';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type ChatConnection = NonNullable<TurnContext['connection']> & {
  credential_generation: number;
};
export type ChatInput = Readonly<{ question: string; previous?: string[];
  pendingClarification?: string }>;
export type RecordPayload = Readonly<{ recordId: string; connectionId: string | null;
  generation: number | null; question: string; toolNames: string[];
  outcome: 'answered' | 'answered_partial_coverage' | 'not_answered';
  reason: string | null; latencyMs: number; requestedModelId: string;
  reportedModelId: string | null; correctionCount: number }>;
type ModelReply<T> = { output: T; reportedModelId: string | null };

export type ChatDependencies = Readonly<{
  context: () => Promise<TenantContext>;
  begin: (ctx: TenantContext, turnId: string) => Promise<void>;
  end: (ctx: TenantContext, turnId: string) => Promise<boolean>;
  connection: (ctx: TenantContext) => Promise<ChatConnection | null>;
  readCoverage?: (connectionId: string, level: 'account' | 'campaign' | 'adset' | 'ad',
    period: { from: string; to: string }, signal: AbortSignal) =>
    Promise<{ history_from?: string | null; history_to?: string | null;
      nearest_before?: string | null; nearest_after?: string | null }>;
  choose: (messages: ChatMessage[], timeoutMs: number,
    signal: AbortSignal) => Promise<ModelReply<ChatChoice>>;
  answer: (messages: ChatMessage[], timeoutMs: number,
    signal: AbortSignal) => Promise<ModelReply<FlatChatAnswer>>;
  resolve: (name: string, args: Record<string, unknown>, ctx: TurnContext,
    period: { from: string; to: string }, signal: AbortSignal) => Promise<ProjectedToolCall>;
  execute: (call: ProjectedToolCall, ctx: TurnContext,
    toolCallId: string, signal: AbortSignal) => Promise<ToolResult>;
  record: (ctx: TenantContext, payload: RecordPayload) => Promise<boolean>;
  now: () => number;
  wallTime: () => Date;
  uuid: () => string;
  log: (entry: { request_id: string; outcome: string; reason: string | null;
    latency_ms: number; tool_count: number; correction_count: number;
    lease_released: boolean; detail: string | null }) => void;
}>;

export function createChatDependencies(): ChatDependencies {
  return {
    context: requireTenantContext,
    begin: async (ctx, turnId) => {
      const rows = await getWorkerApi().call<{ begin_chat_turn: string }>('begin_chat_turn',
        [ctx.user_id, ctx.company_id, turnId, CHAT_LIMITS.turnLeaseSeconds]);
      if (rows[0]?.begin_chat_turn !== turnId) throw new WorkerApiError('unexpected');
    },
    end: async (ctx, turnId) => {
      const rows = await getWorkerApi().call<{ end_chat_turn: boolean }>('end_chat_turn',
        [ctx.user_id, ctx.company_id, turnId]);
      return rows[0]?.end_chat_turn === true;
    },
    connection: async (ctx) => {
      const found = await readConnectionRecord(ctx);
      if (found?.status === 'disconnected') throw new WorkerApiError('unexpected');
      return found ? { id: found.id, status: found.status,
        credential_generation: found.credential_generation,
        external_account_id: found.external_account_id,
        currency: found.currency, timezone: found.timezone } : null;
    },
    readCoverage: async (connectionId, level, period, signal) => {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.rpc('chat_coverage', {
        p_connection_id: connectionId, p_level: level,
        p_from: period.from, p_to: period.to,
      }).abortSignal(signal);
      if (error || !data || typeof data !== 'object' || Array.isArray(data) ||
          !('extra' in data) || !data.extra || typeof data.extra !== 'object' ||
          Array.isArray(data.extra)) throw new Error('coverage_read_failed');
      return data.extra as { history_from?: string | null; history_to?: string | null;
        nearest_before?: string | null; nearest_after?: string | null };
    },
    choose: async (messages, timeoutMs, signal) => requestChatModel({ phase: 'choice',
      messages, timeoutMs, signal }),
    answer: async (messages, timeoutMs, signal) => requestChatModel({ phase: 'answer',
      messages, timeoutMs, signal }),
    resolve: (name, args, ctx, period) => resolveToolCall(name, args, ctx, period),
    execute: (call, ctx, id, signal) => executeTool(call, ctx, id, {}, signal),
    record: async (ctx, payload) => {
      const rows = await getWorkerApi().call<{ record_id: string; written: boolean }>(
        'record_query', [ctx.user_id, ctx.company_id, payload.recordId,
          payload.connectionId, payload.generation, payload.question,
          payload.toolNames, payload.outcome, payload.reason,
          payload.latencyMs, payload.requestedModelId, payload.reportedModelId]);
      if (rows[0]?.record_id !== payload.recordId) throw new WorkerApiError('unexpected');
      return rows[0].written === true;
    },
    now: () => performance.now(), wallTime: () => new Date(),
    uuid: () => crypto.randomUUID(),
    log: (entry) => { console.info(JSON.stringify(entry)); },
  };
}

class DeadlineError extends Error {}

async function within<T>(task: (signal: AbortSignal) => Promise<T>, deadline: number,
  now: () => number): Promise<T> {
  const remaining = Math.floor(deadline - now());
  if (remaining <= 0) throw new DeadlineError();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new DeadlineError()); }, remaining);
  });
  try {
    const value = await Promise.race([task(controller.signal), timeout]);
    if (now() >= deadline) throw new DeadlineError();
    return value;
  } finally { if (timer) clearTimeout(timer); }
}

export function defaultPeriod(now: Date, timezone: string): { from: string; to: string } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = new Date(Date.UTC(Number(fields.year), Number(fields.month) - 1,
    Number(fields.day)));
  const iso = (offset: number) => new Date(today.getTime() + offset * 86_400_000)
    .toISOString().slice(0, 10);
  return { from: iso(-CHAT_DEFAULT_PERIOD_DAYS), to: iso(-1) };
}

export function prepareHistory(previous: string[] = [],
  pendingClarification?: string): { previous: string[]; pendingClarification: string | null } {
  const questions = previous.slice(-CHAT_LIMITS.previousQuestions)
    .filter((item) => typeof item === 'string');
  const pending = typeof pendingClarification === 'string' &&
    pendingClarification.length <= CHAT_LIMITS.maxClarificationChars ?
      pendingClarification : null;
  return { previous: questions, pendingClarification: pending };
}

function noCoverage(results: ToolResult[]): boolean {
  const queried = results.filter((result) => result.status !== 'not_found' &&
    !['entities', 'connection_status'].includes(result.tool_name ?? '') &&
    (result.scope.period || result.scope.period_a || result.scope.period_b));
  return queried.length > 0 && queried.every((result) => !!result.composition &&
    result.composition.days_total > 0 &&
    result.composition.days_not_observed === result.composition.days_total);
}

async function enrichNoCoverage(results: ToolResult[], connection: ChatConnection,
  deps: ChatDependencies, deadline: number): Promise<void> {
  const scoped = results.filter((result) => result.status !== 'not_found' &&
    !['entities', 'connection_status'].includes(result.tool_name ?? '') &&
    result.scope.level &&
    (result.scope.period || result.scope.period_a));
  const scopes = new Set(scoped.map((result) =>
    `${result.scope.level}:${result.tool_name === 'breakdown' ?
      String(result.extra.dimension ?? '') : ''}`));
  if (scopes.size !== 1) return;
  const target = scoped[0];
  if (!target || target.tool_name === 'breakdown') return;
  const period = target.scope.period ?? target.scope.period_a;
  const level = target.scope.level;
  if (!period || !level || !deps.readCoverage) {
    if (target) target.extra.coverage_lookup_failed = true;
    return;
  }
  try {
    const extra = await within((signal) => deps.readCoverage!(connection.id, level,
      period, signal), deadline, deps.now);
    Object.assign(target.extra, extra);
  } catch { target.extra.coverage_lookup_failed = true; }
}

function partialAnswer(answer: ReturnType<typeof projectOutput>,
  results: ToolResult[]): boolean {
  const paths = new Set<string>();
  for (const block of answer.blocks) {
    for (const source of (block.sources ?? []) as { tool_call_id: string; path_prefix: string }[]) {
      const result = results.find((item) => item.tool_call_id === source.tool_call_id);
      for (const value of result?.values ?? []) {
        if (source.path_prefix === '/values' || source.path_prefix === value.path) {
          paths.add(`${source.tool_call_id}:${value.path}`);
        }
      }
    }
  }
  if (paths.size) return results.some((result) => result.values.some((value) =>
    paths.has(`${result.tool_call_id}:${value.path}`) && value.composition?.partial));
  return false;
}

type Finish = { kind: ChatTurnView['kind']; reason?: string;
  answer?: ReturnType<typeof projectOutput>; text?: string };

export async function runChatTurn(input: ChatInput, deps: ChatDependencies): Promise<ChatTurnView> {
  const start = deps.now();
  const workDeadline = start + CHAT_LIMITS.turnDeadlineMs - CHAT_LIMITS.finalizationReserveMs;
  const deadline = start + CHAT_LIMITS.turnDeadlineMs;
  const turnId = deps.uuid();
  const recordId = deps.uuid();
  let ctx: TenantContext | null = null;
  let connection: ChatConnection | null = null;
  let leased = false;
  let leaseReleased = false;
  let outcome = 'not_answered';
  let reason: string | null = null;
  let reportedModelId: string | null = null;
  const correctionCount = 0;
  let detail: string | null = null;
  const results: ToolResult[] = [];
  const toolNames: string[] = [];
  // Al modelo viaja la pregunta tal cual; el registro persistido sigue redactado.
  const question = typeof input.question === 'string' ? input.question.trim() : '';
  const finish = async (result: Finish): Promise<ChatTurnView> => {
    reason = result.reason ?? null;
    outcome = result.kind === 'answer' ?
      partialAnswer(result.answer!, results) ? 'answered_partial_coverage' : 'answered' :
      'not_answered';
    if (!ctx || result.kind === 'notice') return renderTurn({ kind: result.kind,
      reason: result.reason, text: result.text, answer: result.answer,
      results, accountRef: connection?.external_account_id ?? null,
      connectionStatus: connection?.status ?? null, recordId: null });
    let prepared: ChatTurnView;
    try {
      prepared = renderTurn({ kind: result.kind, reason: result.reason,
        text: result.text, answer: result.answer, results,
        accountRef: connection?.external_account_id ?? null,
        connectionStatus: connection?.status ?? null, recordId });
    } catch {
      detail = 'render_failed';
      reason = 'guard_rejected';
      outcome = 'not_answered';
      prepared = renderTurn({ kind: 'abstention', reason, results: [],
        accountRef: connection?.external_account_id ?? null, recordId });
    }
    try {
      const written = await within(() => deps.record(ctx!, {
        recordId, connectionId: connection?.id ?? null,
        generation: connection?.credential_generation ?? null,
        question: redactQuestion(question), toolNames, outcome: outcome as RecordPayload['outcome'],
        reason, latencyMs: Math.max(0, Math.round(deps.now() - start)),
        requestedModelId: CHAT_MODEL_ID, reportedModelId, correctionCount,
      }), deadline, deps.now);
      if (!written) {
        reason = 'connection_changed';
        outcome = 'not_answered';
        return renderTurn({ kind: 'abstention', reason, results: [],
          accountRef: null, recordId: null });
      }
      return prepared;
    } catch {
      reason = 'record_failed';
      outcome = 'not_answered';
      return renderTurn({ kind: 'abstention', reason, results: [],
        accountRef: null, recordId: null });
    }
  };

  try {
    if (!question || Array.from(question).length > CHAT_LIMITS.maxQuestionChars) {
      return renderTurn({ kind: 'notice', reason: 'invalid_input',
        results: [], accountRef: null, recordId: null });
    }
    try { ctx = await within(() => deps.context(), workDeadline, deps.now); }
    catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      return renderTurn({ kind: error instanceof NoCompanyError ? 'notice' : 'abstention',
        reason: error instanceof NoCompanyError ? 'invalid_input' : 'record_failed',
        results: [], accountRef: null, recordId: null });
    }
    try {
      await within(() => deps.begin(ctx!, turnId), workDeadline, deps.now);
      leased = true;
    } catch (error) {
      // Si venció el plazo, begin pudo confirmarse en la base: se intenta liberar el lease
      // (end_chat_turn solo borra el lease de este turn_id, así que es inocuo si no existe).
      if (error instanceof DeadlineError) leased = true;
      const inProgress = (error as WorkerApiError)?.code === 'chat_turn_in_progress';
      return renderTurn({ kind: inProgress ? 'notice' : 'abstention',
        reason: inProgress ? 'chat_turn_in_progress' : 'record_failed',
        results: [], accountRef: null, recordId: null });
    }
    try { connection = await within(() => deps.connection(ctx!), workDeadline, deps.now); }
    catch { return finish({ kind: 'abstention', reason: 'record_failed' }); }
    if (connection?.status !== 'active') {
      return finish({ kind: 'abstention', reason: 'connection_not_active' });
    }
    const current = { connection };
    const timezone = connection.timezone ?? 'UTC';
    const date = deps.wallTime();
    const defaults = defaultPeriod(date, timezone);
    const history = prepareHistory(input.previous, input.pendingClarification);
    const promptContext = { question, ...history,
      today: new Intl.DateTimeFormat('en-CA', { timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit' }).format(date),
      timezone, currency: connection.currency,
      accountRef: connection.external_account_id ?
        maskExternalAccountId(connection.external_account_id) : null,
      defaultPeriod: defaults };
    for (;;) {
      let decision: ModelReply<ChatChoice>;
      try {
        const remaining = Math.min(CHAT_LIMITS.modelCallTimeoutMs,
          Math.max(1, workDeadline - deps.now()));
        decision = await within((signal) => deps.choose(
          choiceMessages(promptContext, results), remaining, signal),
        workDeadline, deps.now);
        reportedModelId = decision.reportedModelId;
      } catch (error) {
        if (error instanceof ChatModelError && error.reason === 'bad_output') detail = 'choice_bad_output';
        return finish({ kind: 'abstention', reason:
        error instanceof ChatModelError && error.reason === 'bad_output' ?
          'guard_rejected' : 'model_unavailable' }); }
      const selected = decision.output;
      if (selected.action === 'call_tools') {
        if (!selected.calls.length || toolNames.length + selected.calls.length >
            CHAT_LIMITS.maxToolCallsPerTurn) {
          return finish({ kind: 'abstention', reason: 'guard_rejected' });
        }
        for (const call of selected.calls) {
          let resolved: ProjectedToolCall;
          try {
            resolved = await within((signal) => deps.resolve(call.name,
              call.args, current, defaults, signal), workDeadline, deps.now);
          } catch (error) {
            if (error instanceof ToolEntityNotFoundError) {
              try {
                results.push(missingAccountEntityResult(call.name, call.args,
                  current, defaults, `t${toolNames.length + 1}`));
                toolNames.push(call.name);
                continue;
              } catch { /* Una llamada inválida no se presenta como entidad ausente. */ }
            }
            return finish({ kind: 'abstention', reason: 'tool_error' });
          }
          try {
            const value = await within((signal) => deps.execute(resolved, current,
              `t${toolNames.length + 1}`, signal), workDeadline, deps.now);
            toolNames.push(resolved.name);
            results.push(value);
          } catch { return finish({ kind: 'abstention', reason: 'tool_error' }); }
        }
        continue;
      }
      if (selected.action === 'abstain') {
        if (selected.abstain_reason !== 'out_of_scope') {
          return finish({ kind: 'abstention', reason: 'guard_rejected' });
        }
        return finish({ kind: 'abstention', reason: 'out_of_scope' });
      }
      if (selected.action === 'clarify') {
        return finish({ kind: 'clarification', reason: 'needs_clarification',
          text: selected.clarification_text ?? '' });
      }
      if (selected.action !== 'answer') {
        return finish({ kind: 'abstention', reason: 'guard_rejected' });
      }
      if (noCoverage(results)) {
        await enrichNoCoverage(results, connection, deps, workDeadline);
        return finish({ kind: 'abstention', reason: 'no_coverage' });
      }
      let drafted: ModelReply<FlatChatAnswer>;
      try {
        const remaining = Math.min(CHAT_LIMITS.modelCallTimeoutMs,
          Math.max(1, workDeadline - deps.now()));
        drafted = await within((signal) => deps.answer(
          answerMessages(promptContext, results), remaining, signal),
        workDeadline, deps.now);
        reportedModelId = drafted.reportedModelId;
      } catch (error) {
        if (error instanceof ChatModelError && error.reason === 'bad_output') detail = 'answer_bad_output';
        return finish({ kind: 'abstention', reason:
        error instanceof ChatModelError && error.reason === 'bad_output' ?
          'guard_rejected' : 'model_unavailable' }); }
      try { return finish({ kind: 'answer', answer: projectOutput(drafted.output) }); }
      catch { detail = 'projection_failed'; return finish({ kind: 'abstention', reason: 'guard_rejected' }); }
    }
  } finally {
    if (leased && ctx) {
      // Plazo propio: si el turno agotó el suyo, igual hay que liberar el lease.
      const releaseDeadline = deps.now() + CHAT_LIMITS.leaseReleaseTimeoutMs;
      try { leaseReleased = await within(() => deps.end(ctx!, turnId), releaseDeadline, deps.now); }
      catch { leaseReleased = false; }
    }
    deps.log({ request_id: ctx?.request_id ?? turnId, outcome, reason,
      latency_ms: Math.max(0, Math.round(deps.now() - start)),
      tool_count: toolNames.length, correction_count: correctionCount,
      lease_released: leaseReleased, detail });
  }
}
