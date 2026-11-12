import { describe, expect, it, vi } from 'vitest';

import { runChatTurn, defaultPeriod, prepareHistory,
  type ChatDependencies, type RecordPayload } from '@/modules/chat/orchestrator';
import { NoCompanyError } from '@/modules/company/service';
import { UnauthorizedError } from '@/modules/identity/session';
import { WorkerApiError } from '@/modules/integrations/db/worker-api';
import { ToolEntityNotFoundError } from '@/modules/chat/tools/schema';
import { parseToolResult } from '@/modules/chat/tools/results';
import { ChatModelError } from '@/modules/chat/llm';
import { choiceSchema, type ChatChoice, type FlatChatAnswer } from '@/modules/chat/output-schema';
import type { TenantContext } from '@/modules/tenant/context';
import { answerMessages, choiceMessages } from '@/modules/chat/prompt';

vi.mock('server-only', () => ({}));

const userId = 'a0000000-0000-4000-8000-000000000001';
const companyId = 'c0000000-0000-4000-8000-000000000001';
const connectionId = 'd0000000-0000-4000-8000-000000000001';
const recordId = 'e0000000-0000-4000-8000-000000000001';
const period = { from: '2026-01-01', to: '2026-01-02' };
const composition = { days_total: 2, days_with_value: 2,
  days_metric_missing: 0, days_no_row: 0, days_not_observed: 0,
  days_open: 0, days_captured_partial: 0, fetched_at_min: null,
  fetched_at_max: null, observed_from: period.from,
  observed_to: period.to, partial: false };
const value = { path_key: 'total', metric: 'spend', unit: 'money',
  currency: 'USD', action_type: null, attribution_ref: null,
  period, period_a: null, period_b: null, day: null, entity_ref: userId,
  entity_name: 'Campaña sintética', parent_ref: null,
  segment_primary: null, segment_secondary: null, value: '10', absence: null,
  presence: null, temporal_status: null, captured_partial: false,
  fetched_at: null, composition };
const toolResult = parseToolResult({ status: 'ok', reason: null,
  scope: { level: 'campaign', entity_ref: userId,
    entity_name: 'Campaña sintética', period, period_a: null,
    period_b: null, period_defaulted: false, entity_defaulted: false,
    timezone: 'UTC', currency: 'USD' }, values: [value],
  composition, extra: {} }, 't1', '…0151', 'total');

function choice(action: 'answer' | 'call_tools' | 'clarify' | 'abstain',
  calls: unknown[] = []): ChatChoice {
  return { action, calls, clarification_text: action === 'clarify' ?
    '¿Qué campaña?' : null, abstain_reason: action === 'abstain' ?
    'out_of_scope' : null } as ChatChoice;
}
const output = { text: 'Dato', blocks: [] } as FlatChatAnswer;

function harness() {
  const events: string[] = [];
  const dep = {
    context: vi.fn(async () => ({ user_id: userId, company_id: companyId,
      role: 'owner' as const, request_id: recordId })),
    begin: vi.fn(async () => { events.push('begin'); }),
    end: vi.fn(async () => { events.push('end'); return true; }),
    connection: vi.fn(async () => ({ id: connectionId, status: 'active' as const,
      credential_generation: 1, external_account_id: 'act_0000000000151',
      timezone: 'UTC', currency: 'USD' })),
    readCoverage: vi.fn(async () => ({ nearest_before: '2025-12-31',
      nearest_after: '2026-01-03' })),
    choose: vi.fn(async () => ({ output: choice('answer'),
      reportedModelId: 'deepseek-ai/DeepSeek-V4.1-Flash' })),
    answer: vi.fn(async () => ({ output, reportedModelId: 'reported-final' })),
    resolve: vi.fn(async () => ({ name: 'total' as const, args: {},
      periodDefaulted: false, entityDefaulted: false })),
    execute: vi.fn(async () => toolResult),
    record: vi.fn(async (...args: [TenantContext, RecordPayload]) => {
      void args;
      events.push('record'); return true;
    }),
    now: vi.fn(() => 0),
    wallTime: vi.fn(() => new Date('2026-11-09T12:00:00Z')),
    uuid: vi.fn(() => recordId),
    log: vi.fn(),
  } satisfies ChatDependencies;
  return { dep, events };
}

describe('M25a-T-35/59/66/69/70/73/75/80/87–89/91/94: turno', () => {
  it('explica argumentos permitidos y separa cuenta enmascarada de entity_ref', () => {
    const prompt = choiceMessages({ question: 'Gasto', previous: [],
      pendingClarification: null, today: '2026-01-15', timezone: 'UTC',
      currency: 'USD', accountRef: '…0151',
      defaultPeriod: { from: '2026-01-08', to: '2026-01-14' } }, []);
    expect(prompt[0].content).toContain('entity_ref: UUID');
    expect(prompt[0].content).toContain('nunca uses account_ref como entity_ref');
    expect(prompt[0].content).toContain('total: entity_ref, metric, period, action_type');
    expect(prompt[0].content).toContain('elegí answer para que el servidor declare no_coverage');
    const answerPrompt = answerMessages({ question: 'Gasto', previous: [],
      pendingClarification: null, today: '2026-01-15', timezone: 'UTC',
      currency: 'USD', accountRef: '…0151',
      defaultPeriod: { from: '2026-01-08', to: '2026-01-14' } }, []);
    expect(answerPrompt[0].content).toContain('Los valores, fechas, estados y límites completos los presentan los bloques');
    expect(answerPrompt[0].content).toContain('Para daily_series no enumeres días ni valores en text');
  });
  it('el prompt declara los valores válidos de order y limit de ranking', () => {
    const prompt = choiceMessages({ question: 'Ranking', previous: [],
      pendingClarification: null, today: '2026-01-15', timezone: 'UTC',
      currency: 'USD', accountRef: '…0151', defaultPeriod: period }, [])[0].content;
    expect(prompt).toContain('order es exactamente "asc" o "desc"');
    expect(prompt).toContain('limit es un entero de 1 a 20 o null');
  });
  it('las preguntas sobre origen y cálculo de los datos no son out_of_scope', () => {
    const prompt = choiceMessages({ question: 'Fuentes', previous: [],
      pendingClarification: null, today: '2026-01-15', timezone: 'UTC',
      currency: 'USD', accountRef: '…0151', defaultPeriod: period }, [])[0].content;
    expect(prompt).toContain('de dónde salen los datos');
    expect(prompt).toContain('fuentes_metodologia');
  });
  it('H-E1-230: opina con datos las preguntas de rendimiento y se abstiene de lo ajeno a Meta', () => {
    const ctx = { question: 'Consulta', previous: [], pendingClarification: null,
      today: '2026-01-15', timezone: 'UTC', currency: 'USD', accountRef: '…0151',
      defaultPeriod: period };
    const choosing = choiceMessages(ctx, [])[0].content;
    expect(choosing).toContain('por qué le va bien o mal');
    expect(choosing).toContain('no te abstengas');
    expect(choosing).toContain('clima, deportes, impuestos');
    expect(choosing).not.toMatch(/causas, ROAS, rentabilidad o pronósticos, abstain/u);
    expect(answerMessages(ctx, [])[0].content).toContain('tu interpretación y opinión');
  });
  it('T-59 da criterios de interpretación sin elegir por frases en el servidor', () => {
    const system = choiceMessages({ question: 'Consulta general', previous: [],
      pendingClarification: null, today: '2026-01-15', timezone: 'UTC',
      currency: 'USD', accountRef: '…0151', defaultPeriod: period }, [])[0].content;
    expect(system).toContain('pregunta general');
    expect(system).toContain('interpretaciones materialmente distintas');
    expect(system).toContain('cambio de formato');
    expect(system).toContain('días observados sin filas');
    expect(system).toContain('hueco');
  });
  it('el prompt distingue respuesta y aclaración', () => {
    const ctx = { question: 'Consulta sintética', previous: [],
      pendingClarification: null, today: '2026-02-03', timezone: 'UTC',
      currency: 'USD', accountRef: '…0151', defaultPeriod: period };
    const choosing = choiceMessages(ctx, [])[0].content;
    const drafting = answerMessages(ctx, [])[0].content;
    expect(choosing).toContain('Respondé sin aclarar');
    expect(choosing).toContain('Aclarar solo');
    expect(drafting).toContain('Redactá solo con los resultados de este turno');
  });
  it('permite escribir cifras copiadas de los resultados sin pedir claims', () => {
    const drafting = answerMessages({ question: 'Consulta sintética', previous: [],
      pendingClarification: null, today: '2026-02-03', timezone: 'UTC',
      currency: 'USD', accountRef: '…0151', defaultPeriod: period }, [])[0].content;
    expect(drafting).toContain('copiala tal cual de los resultados');
    expect(drafting).not.toMatch(/claim|span.quote/u);
  });
  it('paso 21 orienta redacción breve y aclaración acotada', () => {
    const ctx = { question: 'Consulta sintética', previous: [],
      pendingClarification: null, today: '2026-02-03', timezone: 'UTC',
      currency: 'USD', accountRef: '…0151', defaultPeriod: period };
    const choosing = choiceMessages(ctx, [])[0].content;
    const drafting = answerMessages(ctx, [])[0].content;
    expect(choosing).toContain('máximo 300 caracteres');
    expect(choosing).not.toContain('[CIFRA]');
    expect(drafting).toContain('en español y breve');
  });
  it('paso 21 explicita argumentos obligatorios y elección de familias de bloques', () => {
    const ctx = { question: 'Consulta sintética', previous: [],
      pendingClarification: null, today: '2026-02-03', timezone: 'UTC',
      currency: 'USD', accountRef: '…0151', defaultPeriod: period };
    const choosing = choiceMessages(ctx, [])[0].content;
    const drafting = answerMessages(ctx, [])[0].content;
    expect(choosing).toContain('breakdown exige dimension');
    expect(choosing).toContain('coverage exige level');
    expect(choosing).toContain('tabla_desplegable necesita dos ranking');
    expect(drafting).toContain('barras_apiladas varias daily_series');
    expect(drafting).toContain('barras simples muestran una serie');
  });
  it('ejecuta las llamadas normalizadas antes de redactar', async () => {
    const { dep } = harness();
    const args = { level: null, entity_ref: null, metric: 'spend', period,
      period_a: null, period_b: null, action_type: null, order: null,
      limit: null, include_trend: null, dimension: null };
    dep.choose.mockResolvedValueOnce({ output: choiceSchema.parse({
      action: 'answer', calls: [{ name: 'total', args }],
      clarification_text: null, abstain_reason: null }),
    reportedModelId: 'choice' }).mockResolvedValueOnce({
      output: choice('answer'), reportedModelId: 'choice' });
    const view = await runChatTurn({ question: 'Consulta sintética' }, dep);
    expect(view.kind).toBe('answer');
    expect(dep.execute).toHaveBeenCalledTimes(1);
    expect(dep.answer).toHaveBeenCalledTimes(1);
    expect(dep.record.mock.calls[0][1].toolNames).toEqual(['total']);
  });
  it('registra antes del DTO, libera arriendo y usa el último modelo informado', async () => {
    const { dep, events } = harness();
    const view = await runChatTurn({ question: 'Hola' }, dep);
    expect(view).toMatchObject({ kind: 'answer', record_id: recordId,
      can_vote: true });
    expect(events).toEqual(['begin', 'record', 'end']);
    expect(dep.record.mock.calls[0][1]).toMatchObject({
      outcome: 'answered', reportedModelId: 'reported-final', toolNames: [],
    });
  });

  it('corta en el segundo tool_error: no ejecuta el tercero ni vuelve al modelo', async () => {
    const { dep } = harness();
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools', [
      { name: 'total', args: {} }, { name: 'total', args: {} },
      { name: 'total', args: {} }]), reportedModelId: 'choice' });
    dep.execute.mockResolvedValueOnce(toolResult).mockRejectedValueOnce(new Error('synthetic'));
    const view = await runChatTurn({ question: 'Hola' }, dep);
    expect(view.kind).toBe('abstention');
    expect(view.retry_allowed).toBe(true);
    expect(dep.execute).toHaveBeenCalledTimes(2);
    expect(dep.choose).toHaveBeenCalledTimes(1);
    expect(dep.answer).not.toHaveBeenCalled();
    expect(dep.record.mock.calls[0][1].reason).toBe('tool_error');
  });

  it('rechaza calls vacío y no invoca herramientas', async () => {
    const { dep } = harness();
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools', []),
      reportedModelId: 'choice' });
    const view = await runChatTurn({ question: 'Hola' }, dep);
    expect(view.kind).toBe('abstention');
    expect(dep.execute).not.toHaveBeenCalled();
    expect(dep.record.mock.calls[0][1].reason).toBe('guard_rejected');
  });

  it('un resultado de otro turno no entra; no_coverage lo decide el servidor solo en answer', async () => {
    const { dep } = harness();
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools',
      [{ name: 'total', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    dep.execute.mockResolvedValueOnce({ ...toolResult,
      composition: { ...composition, days_with_value: 0,
        days_not_observed: 2 } });
    const view = await runChatTurn({ question: 'Hola' }, dep);
    expect(view.kind).toBe('abstention');
    expect(dep.answer).not.toHaveBeenCalled();
    expect(dep.record.mock.calls[0][1].reason).toBe('no_coverage');
  });

  it('oculta el contenido si record_query devuelve written=false', async () => {
    const { dep } = harness();
    dep.answer.mockResolvedValueOnce({ output: { ...output,
      text: 'Marcador privado sintético' }, reportedModelId: 'final' });
    dep.record.mockResolvedValueOnce(false);
    const view = await runChatTurn({ question: 'Hola' }, dep);
    expect(view.can_vote).toBe(false);
    expect(JSON.stringify(view)).not.toContain('Marcador privado sintético');
    expect(view.segments[0].text).toContain('conexión cambió');
    expect(dep.log.mock.calls[0][0]).toMatchObject({ outcome: 'not_answered',
      reason: 'connection_changed' });
  });

  it('PX011 es notice y un fallo de K01 no toma arriendo', async () => {
    const first = harness();
    first.dep.begin.mockRejectedValueOnce(new WorkerApiError('chat_turn_in_progress'));
    const notice = await runChatTurn({ question: 'Hola' }, first.dep);
    expect(notice.kind).toBe('notice');
    expect(first.dep.record).not.toHaveBeenCalled();
    const second = harness();
    second.dep.context.mockRejectedValueOnce(new NoCompanyError());
    const withoutCompany = await runChatTurn({ question: 'Hola' }, second.dep);
    expect(withoutCompany.kind).toBe('notice');
    expect(second.dep.begin).not.toHaveBeenCalled();
  });

  it('propaga falta de sesión para que la acción redirija al login', async () => {
    const { dep } = harness();
    dep.context.mockRejectedValueOnce(new UnauthorizedError());
    await expect(runChatTurn({ question: 'Hola' }, dep))
      .rejects.toBeInstanceOf(UnauthorizedError);
    expect(dep.begin).not.toHaveBeenCalled();
    expect(dep.record).not.toHaveBeenCalled();
  });

  it('período por defecto cubre siete días cerrados y la historia viaja tal cual', () => {
    expect(defaultPeriod(new Date('2026-11-09T12:00:00Z'), 'UTC'))
      .toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(defaultPeriod(new Date('2026-11-09T01:00:00Z'), 'America/Argentina/Buenos_Aires'))
      .toEqual({ from: '2026-11-01', to: '2026-11-07' });
    expect(prepareHistory(['anterior 1', 'gasté $30 el 01/01/2026',
      'pregunta tres', 'pregunta cuatro'], '¿La segunda?'))
      .toMatchObject({ previous: ['gasté $30 el 01/01/2026',
        'pregunta tres', 'pregunta cuatro'],
        pendingClarification: '¿La segunda?' });
    expect(prepareHistory([], '¿El 01/01/2026?').pendingClarification)
      .toBe('¿El 01/01/2026?');
  });

  it('bad_output da guard_rejected y transporte da model_unavailable', async () => {
    const bad = harness();
    bad.dep.choose.mockRejectedValueOnce(new ChatModelError('bad_output'));
    await runChatTurn({ question: 'Hola' }, bad.dep);
    expect(bad.dep.record.mock.calls[0][1].reason).toBe('guard_rejected');
    const unavailable = harness();
    unavailable.dep.choose.mockRejectedValueOnce(new ChatModelError('unavailable'));
    const view = await runChatTurn({ question: 'Hola' }, unavailable.dep);
    expect(unavailable.dep.record.mock.calls[0][1].reason).toBe('model_unavailable');
    expect(view.retry_allowed).toBe(true);
  });

  it('el texto del modelo se muestra tal cual, con una sola llamada de redacción', async () => {
    const { dep } = harness();
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools',
      [{ name: 'total', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    dep.answer.mockResolvedValueOnce({ output: { ...output, text: 'Fueron 10 el 01/01/2026.' },
      reportedModelId: 'first' });
    const view = await runChatTurn({ question: 'Consulta sintética' }, dep);
    expect(view.kind).toBe('answer');
    expect(view.segments.map((segment) => segment.text).join('')).toBe('Fueron 10 el 01/01/2026.');
    expect(dep.answer).toHaveBeenCalledTimes(1);
    expect(dep.record.mock.calls[0][1]).toMatchObject({
      reportedModelId: 'first', correctionCount: 0 });
  });

  it('el log distingue por qué se rechazó una redacción, sin incluir contenido', async () => {
    const { dep } = harness();
    dep.answer.mockRejectedValueOnce(new ChatModelError('bad_output'));
    await runChatTurn({ question: 'Consulta sintética' }, dep);
    expect(dep.log.mock.calls[0][0]).toMatchObject({ reason: 'guard_rejected',
      detail: 'answer_bad_output' });
  });

  it('transporte y salida fuera de esquema en redacción abstienen sin reintento', async () => {
    for (const reason of ['bad_output', 'unavailable'] as const) {
      const { dep } = harness();
      dep.answer.mockRejectedValueOnce(new ChatModelError(reason));
      const view = await runChatTurn({ question: 'Consulta sintética' }, dep);
      expect(view.kind).toBe('abstention');
      expect(dep.answer).toHaveBeenCalledTimes(1);
      expect(dep.record.mock.calls[0][1]).toMatchObject({ correctionCount: 0 });
    }
  });

  it('clarify resuelve el marcador del turno y guarda la pregunta visible', async () => {
    const { dep } = harness();
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools',
      [{ name: 'total', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: {
        ...choice('clarify'), clarification_text: '¿⟦ENTIDAD_A⟧ o la otra?',
      }, reportedModelId: 'choice' });
    const withName = { ...toolResult, scope: { ...toolResult.scope,
      entity_name: 'Promo 2x1 2026' } };
    dep.execute.mockResolvedValueOnce(withName);
    const view = await runChatTurn({ question: 'Hola' }, dep);
    expect(view.kind).toBe('clarification');
    expect(view.pending_clarification).toContain('Promo 2x1 2026');
    expect(JSON.stringify(view)).not.toContain('⟦ENTIDAD_A⟧');
    expect(dep.record.mock.calls[0][1].reason).toBe('needs_clarification');
  });

  it('marca answered_partial_coverage solo si usa una fila parcial', async () => {
    const { dep } = harness();
    const partial = { ...toolResult, values: [{ ...toolResult.values[0],
      composition: { ...composition, days_with_value: 1, days_no_row: 1,
        partial: true } }] };
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools',
      [{ name: 'total', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    dep.execute.mockResolvedValueOnce(partial);
    dep.answer.mockResolvedValueOnce({ output: { ...output,
      blocks: [{ type: 'tarjeta', sources: [{ tool_call_id: 't1',
        path_prefix: '/values/0' }], options: null, items: null, ids: null }] },
    reportedModelId: 'final' });
    await runChatTurn({ question: 'Hola' }, dep);
    expect(dep.record.mock.calls[0][1].outcome).toBe('answered_partial_coverage');
  });

  it('no marca parcial si la fila parcial no se usó', async () => {
    const { dep } = harness();
    const mixed = { ...toolResult, composition: { ...composition, partial: true },
      values: [{ ...toolResult.values[0], path: '/values/0' },
        { ...toolResult.values[0], path: '/values/1', value: '20',
          composition: { ...composition, days_with_value: 1, days_no_row: 1,
            partial: true } }] };
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools',
      [{ name: 'total', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    dep.execute.mockResolvedValueOnce(mixed);
    dep.answer.mockResolvedValueOnce({ output: { ...output }, reportedModelId: 'final' });
    await runChatTurn({ question: 'Hola' }, dep);
    expect(dep.record.mock.calls[0][1].outcome).toBe('answered');
  });

  it('rechaza la séptima herramienta sin ejecutarla y propaga not_found al modelo', async () => {
    const { dep } = harness();
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools',
      Array.from({ length: 7 }, () => ({ name: 'total', args: {} }))),
    reportedModelId: 'choice' });
    await runChatTurn({ question: 'Hola' }, dep);
    expect(dep.execute).not.toHaveBeenCalled();
    expect(dep.record.mock.calls[0][1].reason).toBe('guard_rejected');

    const second = harness();
    second.dep.choose.mockResolvedValueOnce({ output: choice('call_tools',
      [{ name: 'total', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    second.dep.execute.mockResolvedValueOnce({ ...toolResult, status: 'not_found' });
    await runChatTurn({ question: 'Hola' }, second.dep);
    expect(second.dep.choose).toHaveBeenCalledTimes(2);
    expect(second.dep.answer).toHaveBeenCalledTimes(1);
  });

  it('el modelo no puede declarar no_coverage; abstain y clarify conservan su motivo', async () => {
    const bad = harness();
    bad.dep.choose.mockResolvedValueOnce({ output: { ...choice('abstain'),
      abstain_reason: 'no_coverage' } as unknown as ChatChoice, reportedModelId: 'choice' });
    await runChatTurn({ question: 'Hola' }, bad.dep);
    expect(bad.dep.record.mock.calls[0][1].reason).toBe('guard_rejected');
    const abstain = harness();
    abstain.dep.choose.mockResolvedValueOnce({ output: choice('abstain'),
      reportedModelId: 'choice' });
    const view = await runChatTurn({ question: 'Hola' }, abstain.dep);
    expect(abstain.dep.record.mock.calls[0][1].reason).toBe('out_of_scope');
    expect(view.segments[0].text).toContain('gasto');
    expect(view.can_vote).toBe(true);
  });

  it('la pregunta viaja tal cual al modelo; el registro y los logs excluyen un centinela redactable', async () => {
    const { dep } = harness();
    await runChatTurn({ question: 'Hola correo piloto@example.com' }, dep);
    expect(JSON.stringify(dep.choose.mock.calls)).toContain('piloto@example.com');
    expect(JSON.stringify(dep.record.mock.calls)).not.toContain('piloto@example.com');
    expect(JSON.stringify(dep.log.mock.calls)).not.toContain('piloto@example.com');
    expect(dep.log.mock.calls[0][0]).toMatchObject({ outcome: 'answered',
      tool_count: 0, lease_released: true });
  });

  it('con presupuesto agotado corta el trabajo y registra dentro de la reserva', async () => {
    const { dep } = harness();
    let clock = 0;
    dep.now.mockImplementation(() => clock);
    dep.choose.mockImplementationOnce(async () => { clock = 50_001;
      return { output: choice('answer'), reportedModelId: 'choice' }; });
    const view = await runChatTurn({ question: 'Hola' }, dep);
    expect(view.kind).toBe('abstention');
    expect(dep.answer).not.toHaveBeenCalled();
    expect(dep.record.mock.calls[0][1].reason).toBe('model_unavailable');
    expect(dep.log.mock.calls[0][0].latency_ms).toBeLessThanOrEqual(60_000);
  });

  it('libera el arriendo aunque el turno haya agotado su plazo', async () => {
    const { dep } = harness();
    let clock = 0;
    dep.now.mockImplementation(() => clock);
    dep.choose.mockImplementationOnce(async () => { clock = 61_000;
      return { output: choice('answer'), reportedModelId: 'choice' }; });
    await runChatTurn({ question: 'Hola' }, dep);
    expect(dep.end).toHaveBeenCalledTimes(1);
    expect(dep.log.mock.calls[0][0].lease_released).toBe(true);
  });

  it('intenta liberar el arriendo si begin vence el plazo tras confirmarse', async () => {
    const { dep } = harness();
    let clock = 0;
    dep.now.mockImplementation(() => clock);
    dep.begin.mockImplementationOnce(async () => { clock = 51_000; });
    const view = await runChatTurn({ question: 'Hola' }, dep);
    expect(view.kind).toBe('abstention');
    expect(dep.end).toHaveBeenCalledTimes(1);
    expect(dep.choose).not.toHaveBeenCalled();
  });

  it('acota la aclaración expandida para que la próxima entrada no sea rechazada', async () => {
    const { dep } = harness();
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools',
      [{ name: 'total', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: {
        ...choice('clarify'), clarification_text: `${'a'.repeat(250)} ⟦ENTIDAD_A⟧`,
      }, reportedModelId: 'choice' });
    dep.execute.mockResolvedValueOnce({ ...toolResult, scope: { ...toolResult.scope,
      entity_name: 'Campaña '.repeat(20) } });
    const view = await runChatTurn({ question: 'Hola' }, dep);
    expect(view.kind).toBe('clarification');
    expect(view.pending_clarification!.length).toBeLessThanOrEqual(300);
    expect(view.pending_clarification!.endsWith('…')).toBe(true);
  });

  it('falla temprano sin modelo y libera el arriendo cuando corresponde', async () => {
    const k01 = harness();
    k01.dep.context.mockRejectedValueOnce(new Error('synthetic'));
    expect((await runChatTurn({ question: 'Hola' }, k01.dep)).kind).toBe('abstention');
    expect(k01.dep.begin).not.toHaveBeenCalled();
    expect(k01.dep.record).not.toHaveBeenCalled();
    const lease = harness();
    lease.dep.begin.mockRejectedValueOnce(new Error('synthetic'));
    expect((await runChatTurn({ question: 'Hola' }, lease.dep)).kind).toBe('abstention');
    expect(lease.dep.end).not.toHaveBeenCalled();
    expect(lease.dep.choose).not.toHaveBeenCalled();
    const read = harness();
    read.dep.connection.mockRejectedValueOnce(new Error('synthetic'));
    expect((await runChatTurn({ question: 'Hola' }, read.dep)).kind).toBe('abstention');
    expect(read.dep.record.mock.calls[0][1].reason).toBe('record_failed');
    expect(read.dep.end).toHaveBeenCalledTimes(1);
    expect(read.dep.choose).not.toHaveBeenCalled();
  });

  it('herramienta inexistente se rechaza sin ejecutar ni registrar su nombre', async () => {
    const { dep } = harness();
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools',
      [{ name: 'inventada', args: {} }]), reportedModelId: 'choice' });
    dep.resolve.mockRejectedValueOnce(new Error('synthetic'));
    await runChatTurn({ question: 'Hola' }, dep);
    expect(dep.execute).not.toHaveBeenCalled();
    expect(dep.record.mock.calls[0][1]).toMatchObject({ reason: 'tool_error',
      toolNames: [] });
  });

  it('registro fallido oculta respuesta, pero una liberación fallida no la cambia', async () => {
    const failure = harness();
    failure.dep.answer.mockResolvedValueOnce({ output: { ...output,
      text: 'Centinela privado sintético' }, reportedModelId: 'final' });
    failure.dep.record.mockRejectedValueOnce(new Error('synthetic'));
    const hidden = await runChatTurn({ question: 'Hola' }, failure.dep);
    expect(hidden.kind).toBe('abstention');
    expect(hidden.record_id).toBeNull();
    expect(JSON.stringify(hidden)).not.toContain('Centinela privado sintético');
    expect(failure.dep.log.mock.calls[0][0]).toMatchObject({
      outcome: 'not_answered', reason: 'record_failed' });
    expect(failure.dep.end).toHaveBeenCalledTimes(1);
    const release = harness();
    release.dep.end.mockRejectedValueOnce(new Error('synthetic'));
    const shown = await runChatTurn({ question: 'Hola' }, release.dep);
    expect(shown.kind).toBe('answer');
    expect(release.dep.log.mock.calls[0][0].lease_released).toBe(false);
  });

  it('conexión inactiva no llama al modelo y deja una abstención registrada', async () => {
    const { dep } = harness();
    dep.connection.mockImplementationOnce(async () => null as never);
    const view = await runChatTurn({ question: 'Hola' }, dep);
    expect(view).toMatchObject({ kind: 'abstention', can_vote: true,
      link_to_integrations: true });
    expect(dep.choose).not.toHaveBeenCalled();
    expect(dep.record.mock.calls[0][1]).toMatchObject({ outcome: 'not_answered',
      reason: 'connection_not_active' });
  });

  it('una herramienta lenta pierde el margen de trabajo y se registra tool_error', async () => {
    const { dep } = harness();
    let clock = 0;
    dep.now.mockImplementation(() => clock);
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools',
      [{ name: 'total', args: {} }]), reportedModelId: 'choice' });
    dep.execute.mockImplementationOnce(async () => { clock = 50_001; return toolResult; });
    const view = await runChatTurn({ question: 'Hola' }, dep);
    expect(view.kind).toBe('abstention');
    expect(dep.record.mock.calls[0][1].reason).toBe('tool_error');
    expect(dep.end).toHaveBeenCalledTimes(1);
    expect(dep.log.mock.calls[0][0].latency_ms).toBeLessThanOrEqual(60_000);
  });

  it('consulta cobertura auxiliar sin sumar herramienta y usa las fechas del servidor', async () => {
    const { dep } = harness();
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools',
      [{ name: 'total', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    dep.execute.mockResolvedValueOnce({ ...toolResult, values: [],
      composition: { ...composition, days_with_value: 0,
        days_not_observed: 2 } });
    const view = await runChatTurn({ question: 'Hola' }, dep);
    expect(dep.readCoverage).toHaveBeenCalledWith(connectionId, 'campaign', period,
      expect.any(AbortSignal));
    expect(view.segments[0].text).toContain('31/12/2025');
    expect(view.segments[0].text).toContain('03/01/2026');
    expect(dep.record.mock.calls[0][1].toolNames).toEqual(['total']);
  });

  it('lectura auxiliar fallida conserva solo la primera frase de no_coverage', async () => {
    const { dep } = harness();
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools',
      [{ name: 'total', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    dep.execute.mockResolvedValueOnce({ ...toolResult, values: [],
      composition: { ...composition, days_with_value: 0,
        days_not_observed: 2 } });
    dep.readCoverage.mockRejectedValueOnce(new Error('synthetic'));
    const view = await runChatTurn({ question: 'Hola' }, dep);
    expect(view.segments[0].text).toBe('No tengo datos del 01/01/2026 al 02/01/2026.');
    expect(dep.record.mock.calls[0][1].reason).toBe('no_coverage');
  });

  it('T-89 un desglose usa sus fechas propias sin lectura auxiliar', async () => {
    const { dep } = harness();
    dep.resolve.mockResolvedValueOnce({ name: 'breakdown', args: {},
      periodDefaulted: false, entityDefaulted: false } as never);
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools', [
      { name: 'breakdown', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    dep.execute.mockResolvedValueOnce({ ...toolResult, tool_name: 'breakdown',
      values: [], composition: { ...composition, days_with_value: 0,
        days_not_observed: 2 }, extra: { dimension: 'country',
        nearest_before: '2025-12-31', nearest_after: '2026-01-03' } });
    const view = await runChatTurn({ question: 'Países' }, dep);
    expect(view.segments[0].text).toContain('de los países por campaña');
    expect(view.segments[0].text).toContain('31/12/2025');
    expect(view.segments[0].text).toContain('03/01/2026');
    expect(dep.readCoverage).not.toHaveBeenCalled();
    expect(dep.record.mock.calls[0][1].toolNames).toEqual(['breakdown']);
  });

  it('con más de un alcance no agrega fechas auxiliares al no_coverage', async () => {
    const { dep } = harness();
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools',
      [{ name: 'total', args: {} }, { name: 'coverage', args: {} }]),
    reportedModelId: 'choice' }).mockResolvedValueOnce({
      output: choice('answer'), reportedModelId: 'choice' });
    const empty = { ...toolResult, values: [], composition: { ...composition,
      days_with_value: 0, days_not_observed: 2 } };
    dep.execute.mockResolvedValueOnce(empty).mockResolvedValueOnce({ ...empty,
      tool_call_id: 't2', scope: { ...empty.scope, level: 'adset' } });
    const view = await runChatTurn({ question: 'Hola' }, dep);
    expect(view.segments[0].text).toBe('No tengo datos del 01/01/2026 al 02/01/2026.');
    expect(dep.readCoverage).not.toHaveBeenCalled();
  });

  it('pasa el período por defecto a la herramienta y el pie lo identifica', async () => {
    const { dep } = harness();
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools',
      [{ name: 'total', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    dep.execute.mockResolvedValueOnce({ ...toolResult,
      scope: { ...toolResult.scope, period_defaulted: true } });
    const view = await runChatTurn({ question: 'Hola' }, dep);
    expect(dep.resolve).toHaveBeenCalledWith('total', {}, expect.any(Object),
      { from: '2026-11-02', to: '2026-11-08' }, expect.any(AbortSignal));
    expect(view.footer?.defaulted).toBe(true);
  });

  it('T-80 continúa una aclaración con la métrica elegida por el modelo', async () => {
    const first = harness();
    first.dep.choose.mockResolvedValueOnce({ output: { ...choice('clarify'),
      clarification_text: '¿Gasto o clics?' }, reportedModelId: 'choice' });
    const clarification = await runChatTurn({ question: '¿Cómo voy?' }, first.dep);
    expect(clarification).toMatchObject({ kind: 'clarification',
      pending_clarification: '¿Gasto o clics?' });
    const second = harness();
    second.dep.choose.mockResolvedValueOnce({ output: choice('call_tools', [
      { name: 'total', args: { metric: 'clicks', entity_ref: null, period: null } }]),
    reportedModelId: 'choice' }).mockResolvedValueOnce({
      output: choice('answer'), reportedModelId: 'choice' });
    const view = await runChatTurn({ question: 'La segunda',
      previous: ['¿Cómo voy?'],
      pendingClarification: clarification.pending_clarification! }, second.dep);
    expect(view.kind).toBe('answer');
    const sentMessages = (second.dep.choose.mock.calls as unknown as
      [Array<{ content: string }>][])[0][0];
    const sent = JSON.parse(sentMessages[1].content);
    expect(sent).toMatchObject({ question: 'La segunda',
      previous: ['¿Cómo voy?'], pending_clarification: '¿Gasto o clics?' });
    expect(sent).not.toHaveProperty('answers');
    expect(second.dep.resolve).toHaveBeenCalledWith('total',
      { metric: 'clicks', entity_ref: null, period: null },
      expect.any(Object), expect.any(Object), expect.any(AbortSignal));
  });

  it('T-69 la historia y la aclaración pendiente viajan tal cual y respetan el tope', async () => {
    expect(prepareHistory(['Gasté 30 ayer'], '¿Promo 2x1 o Campaña?'))
      .toEqual({ previous: ['Gasté 30 ayer'], pendingClarification: '¿Promo 2x1 o Campaña?' });
    expect(prepareHistory([], 'x'.repeat(301)).pendingClarification).toBeNull();
  });

  it('T-91 cuenta sin entidad continúa con cobertura y el servidor declara no_coverage', async () => {
    const { dep } = harness();
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools', [
      { name: 'total', args: { entity_ref: null, metric: 'spend', period } }]),
    reportedModelId: 'choice' }).mockResolvedValueOnce({
      output: choice('call_tools', [{ name: 'coverage', args: { level: 'account', period } }]),
      reportedModelId: 'choice' }).mockResolvedValueOnce({
      output: choice('answer'), reportedModelId: 'choice' });
    dep.resolve.mockRejectedValueOnce(new ToolEntityNotFoundError())
      .mockResolvedValueOnce({ name: 'coverage', args: { level: 'account', period },
        periodDefaulted: false, entityDefaulted: false } as never);
    dep.execute.mockResolvedValueOnce(parseToolResult({ status: 'ok', reason: null,
      scope: { ...toolResult.scope, level: 'account', entity_ref: null,
        entity_name: null }, values: [], composition: { ...composition,
        days_with_value: 0, days_not_observed: 2 }, extra: {} },
    't2', '…0151', 'coverage'));
    const view = await runChatTurn({ question: 'Gasto' }, dep);
    expect(view.kind).toBe('abstention');
    expect(dep.choose).toHaveBeenCalledTimes(3);
    expect(dep.execute).toHaveBeenCalledTimes(1);
    expect(dep.record.mock.calls[0][1]).toMatchObject({ reason: 'no_coverage',
      toolNames: ['total', 'coverage'] });
  });

  it('T-59 acepta respuesta sin herramientas, estado de conexión y cambio de formato', async () => {
    const direct = harness();
    expect((await runChatTurn({ question: 'Estado general' }, direct.dep)).kind)
      .toBe('answer');
    expect(direct.dep.execute).not.toHaveBeenCalled();

    const status = harness();
    status.dep.choose.mockResolvedValueOnce({ output: choice('call_tools', [
      { name: 'connection_status', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    status.dep.resolve.mockResolvedValueOnce({ name: 'connection_status', args: {},
      periodDefaulted: false, entityDefaulted: false } as never);
    status.dep.execute.mockResolvedValueOnce(parseToolResult({ status: 'ok',
      reason: null, scope: { ...toolResult.scope, period: null }, values: [],
      composition: null, extra: { connection_status: 'active' } },
    't1', '…0151', 'connection_status'));
    expect((await runChatTurn({ question: 'Conexión' }, status.dep)).kind).toBe('answer');

    const format = harness();
    format.dep.choose.mockResolvedValueOnce({ output: choice('call_tools', [
      { name: 'total', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    format.dep.answer.mockResolvedValueOnce({ output: { ...output,
      blocks: [{ type: 'tabla', sources: [{ tool_call_id: 't1',
        path_prefix: '/values' }], options: null, items: null, ids: null }] },
    reportedModelId: 'final' });
    const shown = await runChatTurn({ question: 'Mostralo en tabla' }, format.dep);
    expect(shown.blocks[0].type).toBe('tabla');
    expect(shown.blocks[0].table.rows[0][1]).toContain('10');
  });

  it('T-91 solo declara no_coverage si todas las consultas efectivas carecen de días', async () => {
    const observed = harness();
    observed.dep.choose.mockResolvedValueOnce({ output: choice('call_tools', [
      { name: 'total', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    observed.dep.execute.mockResolvedValueOnce({ ...toolResult, values: [],
      composition: { ...composition, days_with_value: 0, days_no_row: 1,
        days_not_observed: 1 } });
    expect((await runChatTurn({ question: 'Gasto' }, observed.dep)).kind).toBe('answer');
    expect(observed.dep.answer).toHaveBeenCalledTimes(1);

    const twoRounds = harness();
    twoRounds.dep.choose.mockResolvedValueOnce({ output: choice('call_tools', [
      { name: 'total', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('call_tools', [
        { name: 'total', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    twoRounds.dep.execute.mockResolvedValueOnce({ ...toolResult, values: [],
      composition: { ...composition, days_with_value: 0, days_not_observed: 2 } })
      .mockResolvedValueOnce({ ...toolResult, tool_call_id: 't2',
        scope: { ...toolResult.scope, period: { from: '2026-02-01', to: '2026-02-02' } } });
    expect((await runChatTurn({ question: 'Comparar' }, twoRounds.dep)).kind).toBe('answer');
    expect(twoRounds.dep.record.mock.calls[0][1].reason).toBeNull();
  });

  it('T-89 lectura auxiliar lenta deja solo la frase del período', async () => {
    const { dep } = harness();
    let clock = 0;
    dep.now.mockImplementation(() => clock);
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools', [
      { name: 'total', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    dep.execute.mockResolvedValueOnce({ ...toolResult, values: [],
      composition: { ...composition, days_with_value: 0, days_not_observed: 2 } });
    dep.readCoverage.mockImplementationOnce(async () => { clock = 50_001;
      return { nearest_before: '2025-12-31', nearest_after: '2026-01-03' }; });
    const view = await runChatTurn({ question: 'Gasto' }, dep);
    expect(view.segments[0].text).toBe('No tengo datos del 01/01/2026 al 02/01/2026.');
    expect(dep.record.mock.calls[0][1].reason).toBe('no_coverage');
    expect(dep.record.mock.calls[0][1].toolNames).toEqual(['total']);
  });

  it('T-89 dos períodos usan rango histórico del servidor', async () => {
    const { dep } = harness();
    const otherPeriod = { from: '2026-02-01', to: '2026-02-02' };
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools', [
      { name: 'compare_periods', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    dep.execute.mockResolvedValueOnce({ ...toolResult, values: [],
      tool_name: 'compare_periods', scope: { ...toolResult.scope,
        period: null, period_a: period, period_b: otherPeriod },
      extra: {},
      composition: { ...composition, days_with_value: 0, days_not_observed: 2 } });
    dep.readCoverage.mockResolvedValueOnce({ history_from: '2025-12-01',
      history_to: '2026-03-01' } as never);
    const shown = await runChatTurn({ question: 'Comparación' }, dep);
    expect(shown.segments[0].text).toContain('mis datos van del 01/12/2025 al 01/03/2026');
    expect(dep.readCoverage).toHaveBeenCalledWith(connectionId, 'campaign', period,
      expect.any(AbortSignal));
  });

  it('T-91 abstención o aclaración tras un período vacío conserva el motivo elegido', async () => {
    for (const final of ['clarify', 'abstain'] as const) {
      const { dep } = harness();
      dep.choose.mockResolvedValueOnce({ output: choice('call_tools', [
        { name: 'total', args: {} }]), reportedModelId: 'choice' })
        .mockResolvedValueOnce({ output: choice(final), reportedModelId: 'choice' });
      dep.execute.mockResolvedValueOnce({ ...toolResult, values: [],
        composition: { ...composition, days_with_value: 0, days_not_observed: 2 } });
      const shown = await runChatTurn({ question: 'Consulta' }, dep);
      expect(shown.kind).toBe(final === 'clarify' ? 'clarification' : 'abstention');
      expect(dep.record.mock.calls[0][1].reason).toBe(final === 'clarify' ?
        'needs_clarification' : 'out_of_scope');
      expect(dep.readCoverage).not.toHaveBeenCalled();
    }
  });

  it('T-91 catálogo previo no impide no_coverage y un not_supported sin días no lo provoca', async () => {
    const catalog = harness();
    catalog.dep.choose.mockResolvedValueOnce({ output: choice('call_tools', [
      { name: 'entities', args: {} }, { name: 'total', args: {} }]),
    reportedModelId: 'choice' }).mockResolvedValueOnce({
      output: choice('answer'), reportedModelId: 'choice' });
    catalog.dep.execute.mockResolvedValueOnce({ ...toolResult,
      tool_name: 'entities', scope: { ...toolResult.scope, period: null },
      values: [], composition: null, extra: {} })
      .mockResolvedValueOnce({ ...toolResult, tool_call_id: 't2',
        values: [], extra: {}, composition: { ...composition,
          days_with_value: 0, days_not_observed: 2 } });
    expect((await runChatTurn({ question: 'Gasto' }, catalog.dep)).kind)
      .toBe('abstention');
    expect(catalog.dep.record.mock.calls[0][1].reason).toBe('no_coverage');

    const unsupported = harness();
    unsupported.dep.choose.mockResolvedValueOnce({ output: choice('call_tools', [
      { name: 'total', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    unsupported.dep.execute.mockResolvedValueOnce({ ...toolResult,
      status: 'not_supported', reason: 'metric_not_additive', values: [], extra: {},
      composition: { ...composition, days_total: 0, days_with_value: 0,
        days_not_observed: 0, observed_from: null, observed_to: null } });
    expect((await runChatTurn({ question: 'Gasto' }, unsupported.dep)).kind).toBe('answer');
    expect(unsupported.dep.record.mock.calls[0][1].reason).toBeNull();
  });

  it('T-91 el modelo no puede declarar no_coverage aun con cobertura previa', async () => {
    const { dep } = harness();
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools', [
      { name: 'coverage', args: {} }]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: { ...choice('abstain'),
        abstain_reason: 'no_coverage' } as unknown as ChatChoice,
      reportedModelId: 'choice' });
    dep.execute.mockResolvedValueOnce({ ...toolResult, tool_name: 'coverage',
      values: [], extra: {} });
    const view = await runChatTurn({ question: 'Gasto' }, dep);
    expect(view.kind).toBe('abstention');
    expect(dep.record.mock.calls[0][1].reason).toBe('guard_rejected');
    expect(view.segments[0].text).not.toContain('No tengo datos');
  });

  it('T-60 permite cinco lecturas de un embudo dentro del máximo aprobado', async () => {
    const { dep } = harness();
    dep.resolve.mockResolvedValueOnce({ name: 'entities', args: {},
      periodDefaulted: false, entityDefaulted: false } as never);
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools', [
      { name: 'entities', args: {} },
      ...Array.from({ length: 4 }, () => ({ name: 'total', args: {} })),
    ]), reportedModelId: 'choice' })
      .mockResolvedValueOnce({ output: choice('answer'), reportedModelId: 'choice' });
    const view = await runChatTurn({ question: 'Embudo sintético' }, dep);
    expect(view.kind).toBe('answer');
    expect(dep.record.mock.calls[0][1].toolNames).toEqual([
      'entities', 'total', 'total', 'total', 'total']);
    expect(dep.log.mock.calls[0][0].tool_count).toBe(5);
  });
});
