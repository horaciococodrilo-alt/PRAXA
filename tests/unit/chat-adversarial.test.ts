import { beforeEach, describe, expect, it, vi } from 'vitest';

import { preguntarChat, votarRespuesta } from '@/modules/chat/actions';
import { GuardRejected, validateAnswer } from '@/modules/chat/guard';
import { NoCompanyError } from '@/modules/company/service';
import { UnauthorizedError } from '@/modules/identity/session';
import type { FlatChatAnswer } from '@/modules/chat/output-schema';
import { parseToolResult } from '@/modules/chat/tools/results';

const worker = vi.hoisted(() => ({ call: vi.fn(async () => [{ set_feedback: true }]) }));
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => {
  throw new Error('redirect');
}) }));
vi.mock('@/modules/chat/orchestrator', () => ({
  createChatDependencies: vi.fn(() => ({ context: vi.fn() })),
  runChatTurn: vi.fn(async () => ({ kind: 'answer', record_id: null,
    can_vote: false, segments: [], blocks: [], footer: null,
    pending_clarification: null, retry_allowed: false,
    link_to_integrations: false })),
}));
vi.mock('@/modules/tenant/context', () => ({
  requireTenantContext: vi.fn(async () => ({ user_id: 'a0000000-0000-4000-8000-000000000001',
    company_id: 'c0000000-0000-4000-8000-000000000001', role: 'owner',
    request_id: 'e0000000-0000-4000-8000-000000000001' })),
}));
vi.mock('@/modules/integrations/db/worker-api', () => ({
  getWorkerApi: vi.fn(() => worker),
}));

const period = { from: '2026-01-01', to: '2026-01-02' };
const entity = 'a0000000-0000-4000-8000-000000000001';
const composition = { days_total: 2, days_with_value: 2, days_metric_missing: 0,
  days_no_row: 0, days_not_observed: 0, days_open: 0, days_captured_partial: 0,
  fetched_at_min: null, fetched_at_max: null, observed_from: period.from,
  observed_to: period.to, partial: false };
const observed = parseToolResult({ status: 'ok', reason: null,
  scope: { level: 'campaign', entity_ref: entity, entity_name: 'Promo 2x1 2026',
    period, period_a: null, period_b: null, period_defaulted: false,
    entity_defaulted: false, timezone: 'UTC', currency: 'USD' },
  values: [{ path_key: 'total', metric: 'spend', unit: 'money', currency: 'USD',
    action_type: null, attribution_ref: null, period, period_a: null, period_b: null,
    day: null, entity_ref: entity, entity_name: 'Promo 2x1 2026', parent_ref: null,
    segment_primary: null, segment_secondary: null, value: '1234.50', absence: null,
    presence: null, temporal_status: null, captured_partial: false, fetched_at: null,
    composition }], composition, extra: {} }, 't1', '…0151');

function claim(quote: string, overrides: Record<string, unknown> = {}) {
  return { span: { quote, occurrence: 1 }, kind: 'observed_value',
    tool_call_id: 't1', path: '/values/0', metric: 'spend', unit: 'money',
    currency: 'USD', account_ref: '…0151', level: 'campaign', entity_ref: entity,
    action_type: null, attribution_ref: null, period, period_a: null, period_b: null,
    bound: null, field: null, left_tool_call_id: null, left_path: null,
    right_tool_call_id: null, right_path: null, relation: null, ...overrides };
}
function answer(text: string, claims: ReturnType<typeof claim>[] = []): FlatChatAnswer {
  return { text, claims, blocks: [] } as FlatChatAnswer;
}

describe('M25a-T-42–43: ocho casos adversarios de CA-50b', () => {
  const cases = [
    ['cifra inventada', answer('Gastaste 9.999.', [claim('9.999')])],
    ['métrica incorrecta', answer('Hubo 1.234,50 clics.', [claim('1.234,50', { metric: 'clicks' })])],
    ['período incorrecto', answer('Gastaste 1.234,50.', [claim('1.234,50', {
      period: { from: '2026-02-01', to: '2026-02-02' },
    })])],
    ['comparación sin respaldo', answer('Gastaste más que antes.')],
    ['variación inventada', answer('Se duplicó el gasto.')],
    ['cantidad en palabras', answer('Hubo dos clics.')],
    ['cifra del dueño como observada', answer('Gastaste 9.999.', [claim('9.999')])],
  ] as const;
  for (const [name, output] of cases) {
    it(`rechaza ${name} antes de cualquier DTO`, () => {
      expect(() => validateAnswer(output, [observed], 'Gasté 9.999')).toThrow(GuardRejected);
    });
  }
  it('una herramienta equivocada se mide en VR-02: la guarda valida solo evidencia', () => {
    expect(validateAnswer(answer('Gastaste 1.234,50.', [claim('1.234,50')]),
      [observed], '¿Cuántos clics hubo?').text).toBe('Gastaste 1.234,50.');
  });
  it('no resuelve resultados de otro turno ni del cliente', () => {
    const output = answer('Gastaste 1.234,50.', [claim('1.234,50')]);
    expect(() => validateAnswer(output, [], 'consulta')).toThrow(GuardRejected);
    expect(() => validateAnswer(answer('Gastaste 1.234,50.', [claim('1.234,50', {
      tool_call_id: 't2',
    })]), [observed], 'consulta')).toThrow(GuardRejected);
  });
  it('valida marcadores del turno y rechaza alias inventados', () => {
    expect(validateAnswer(answer('⟦ENTIDAD_A⟧ gastó 1.234,50.', [claim('1.234,50')]),
      [observed], 'consulta').text).toContain('⟦ENTIDAD_A⟧');
    expect(() => validateAnswer(answer('⟦ENTIDAD_Z⟧ gastó 1.234,50.',
      [claim('1.234,50')]), [observed], 'consulta')).toThrow(GuardRejected);
    expect(() => validateAnswer(answer('Promo 2x1 2026 gastó 1.234,50.',
      [claim('1.234,50')]), [observed], 'consulta')).toThrow(GuardRejected);
  });
});

describe('M25a-T-45/94: acciones estrictas del chat', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rechaza company_id y pregunta vacía antes de invocar el turno', async () => {
    const { runChatTurn } = await import('@/modules/chat/orchestrator');
    const forged = await preguntarChat({ question: 'Hola',
      company_id: 'c0000000-0000-4000-8000-000000000002' } as never);
    expect(forged.kind).toBe('notice');
    expect(runChatTurn).not.toHaveBeenCalled();
    expect((await preguntarChat({ question: '  ' })).kind).toBe('notice');
    expect(runChatTurn).not.toHaveBeenCalled();
  });

  it('solo pasa la entrada estricta; el contexto se construye adentro', async () => {
    const { runChatTurn, createChatDependencies } = await import('@/modules/chat/orchestrator');
    await preguntarChat({ question: 'Hola', previous: ['anterior'],
      pendingClarification: '¿Qué campaña?' });
    expect(createChatDependencies).toHaveBeenCalledTimes(1);
    expect(runChatTurn).toHaveBeenCalledWith({ question: 'Hola',
      previous: ['anterior'], pendingClarification: '¿Qué campaña?' },
    expect.any(Object));
  });

  it('vota solo con K01 y una entrada válida; fallos devuelven ok falso', async () => {
    const id = 'e0000000-0000-4000-8000-000000000001';
    expect(await votarRespuesta({ recordId: id, feedback: 'useful' }))
      .toEqual({ ok: true });
    expect(await votarRespuesta({ recordId: id, feedback: 'useful',
      company_id: 'forged' } as never)).toEqual({ ok: false });
    const { requireTenantContext } = await import('@/modules/tenant/context');
    vi.mocked(requireTenantContext).mockRejectedValueOnce(new NoCompanyError());
    expect(await votarRespuesta({ recordId: id, feedback: 'not_useful' }))
      .toEqual({ ok: false });
    expect(worker.call).toHaveBeenCalledWith('set_feedback', [
      'a0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000001', id, 'useful',
    ]);
    vi.mocked(requireTenantContext).mockRejectedValueOnce(new Error('synthetic'));
    expect(await votarRespuesta({ recordId: id, feedback: 'useful' }))
      .toEqual({ ok: false });
    vi.mocked(requireTenantContext).mockRejectedValueOnce(new UnauthorizedError());
    await expect(votarRespuesta({ recordId: id, feedback: 'useful' }))
      .rejects.toThrow('redirect');
  });
});
