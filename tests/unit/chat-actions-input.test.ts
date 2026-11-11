import { describe, expect, it, vi } from 'vitest';

const runChatTurn = vi.fn(async () => ({ kind: 'answer' }));
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/modules/chat/orchestrator', () => ({
  runChatTurn, createChatDependencies: vi.fn(() => ({})),
}));
vi.mock('@/modules/integrations/db/worker-api', () => ({ getWorkerApi: vi.fn() }));
vi.mock('@/modules/tenant/context', () => ({ requireTenantContext: vi.fn() }));
vi.mock('@/modules/identity/session', () => ({ UnauthorizedError: class extends Error {} }));

describe('M25a.3 H-E1-232: el historial que llega a la acción tiene tope', () => {
  it('rechaza un historial o una aclaración desmesurados sin llamar al orquestador', async () => {
    const { preguntarChat } = await import('@/modules/chat/actions');
    const long = 'x'.repeat(501);
    for (const input of [
      { question: 'Hola', previous: [long] },
      { question: 'Hola', previous: Array.from({ length: 21 }, () => 'a') },
      { question: 'Hola', pendingClarification: 'x'.repeat(301) },
    ]) {
      const view = await preguntarChat(input);
      expect(view).toMatchObject({ kind: 'notice' });
    }
    expect(runChatTurn).not.toHaveBeenCalled();
    await preguntarChat({ question: 'Hola', previous: ['a', 'b'], pendingClarification: '¿Cuál?' });
    expect(runChatTurn).toHaveBeenCalledTimes(1);
  });
});
