'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { UnauthorizedError } from '@/modules/identity/session';
import { getWorkerApi } from '@/modules/integrations/db/worker-api';
import { requireTenantContext } from '@/modules/tenant/context';

import { CHAT_LIMITS } from './limits';
import { createChatDependencies, runChatTurn } from './orchestrator';
import { renderTurn, type ChatTurnView } from './render';

const LOGIN = '/login?next=%2Fapp%2Fchat';
const questionSchema = z.strictObject({
  question: z.string().trim().min(1).max(CHAT_LIMITS.maxQuestionChars),
  previous: z.array(z.string().max(CHAT_LIMITS.maxQuestionChars)).max(20).optional(),
  pendingClarification: z.string().max(CHAT_LIMITS.maxClarificationChars).optional(),
});
const voteSchema = z.strictObject({
  recordId: z.uuid(),
  feedback: z.enum(['useful', 'not_useful']),
});

export async function preguntarChat(input: {
  question: string; previous?: string[]; pendingClarification?: string;
}): Promise<ChatTurnView> {
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return renderTurn({ kind: 'notice', reason: 'invalid_input',
    results: [], accountRef: null, recordId: null });
  try { return await runChatTurn(parsed.data, createChatDependencies()); }
  catch (error) {
    if (error instanceof UnauthorizedError) redirect(LOGIN);
    return renderTurn({ kind: 'abstention', reason: 'record_failed',
      results: [], accountRef: null, recordId: null });
  }
}

export async function votarRespuesta(input: {
  recordId: string; feedback: 'useful' | 'not_useful';
}): Promise<{ ok: boolean }> {
  const parsed = voteSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  try {
    const ctx = await requireTenantContext();
    const rows = await getWorkerApi().call<{ set_feedback: boolean }>('set_feedback',
      [ctx.user_id, ctx.company_id, parsed.data.recordId, parsed.data.feedback]);
    return { ok: rows[0]?.set_feedback === true };
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect(LOGIN);
    return { ok: false };
  }
}
