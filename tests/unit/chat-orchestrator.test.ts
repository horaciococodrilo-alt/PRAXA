import { describe, expect, it, vi } from 'vitest';

import { runChatTurn, defaultPeriod, prepareHistory,
  type ChatDependencies, type RecordPayload } from '@/modules/chat/orchestrator';
import { NoCompanyError } from '@/modules/company/service';
import { UnauthorizedError } from '@/modules/identity/session';
import { WorkerApiError } from '@/modules/integrations/db/worker-api';
import { parseToolResult } from '@/modules/chat/tools/results';
import { ChatModelError } from '@/modules/chat/llm';
import type { ChatChoice, FlatChatAnswer } from '@/modules/chat/output-schema';
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
const output = { text: 'Dato', claims: [], blocks: [] } as FlatChatAnswer;

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
    expect(answerPrompt[0].content).toContain('No repitas las fechas del período en text');
    expect(answerPrompt[0].content).toContain('Para daily_series no enumeres días ni valores en text');
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

  it('período por defecto cubre siete días cerrados y la historia no aporta cifras', () => {
    expect(defaultPeriod(new Date('2026-11-09T12:00:00Z'), 'UTC'))
      .toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(prepareHistory(['anterior 1', 'gasté $30 el 01/01/2026',
      'pregunta tres', 'pregunta cuatro'], '¿La segunda?'))
      .toMatchObject({ previous: ['gasté $[CIFRA] el [CIFRA]',
        'pregunta [CIFRA]', 'pregunta [CIFRA]'],
        pendingClarification: '¿La segunda?' });
    expect(prepareHistory([], '¿El 01/01/2026?').pendingClarification).toBeNull();
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

  it('rechaza la quinta herramienta sin ejecutarla y propaga not_found al modelo', async () => {
    const { dep } = harness();
    dep.choose.mockResolvedValueOnce({ output: choice('call_tools',
      Array.from({ length: 5 }, () => ({ name: 'total', args: {} }))),
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

  it('los logs y el registro excluyen un centinela redactable de la pregunta', async () => {
    const { dep } = harness();
    await runChatTurn({ question: 'Hola correo piloto@example.com' }, dep);
    expect(JSON.stringify(dep.choose.mock.calls)).not.toContain('piloto@example.com');
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
});
