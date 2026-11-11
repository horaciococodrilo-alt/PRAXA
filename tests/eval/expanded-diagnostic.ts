import { answerSchema, choiceSchema, projectOutput,
  type FlatChatAnswer } from '@/modules/chat/output-schema';

export function diagnoseProjection(answer: FlatChatAnswer): string {
  for (const block of answer.blocks) {
    try { projectOutput({ text: '', blocks: [block] }); }
    catch { return `projection:block:${block.type}:variant_fields`; }
  }
  return 'projection:unknown';
}

/** Inspecciona solo metadatos y validez estructural; nunca devuelve contenido del modelo. */
export async function modelResponseCheck(response: Response,
  phase: 'choice' | 'answer'): Promise<string> {
  if (!response.ok) return `http:${response.status}`;
  let body: { choices?: { finish_reason?: string | null;
    message?: { content?: string | null } }[] };
  try { body = await response.clone().json() as typeof body; }
  catch { return 'response_json'; }
  const choice = body.choices?.[0];
  if (!choice) return 'envelope_schema:choices';
  if (choice.finish_reason !== 'stop') {
    return `finish_reason:${choice.finish_reason ?? 'missing'}`;
  }
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
    if (!['call_tools', 'answer', 'clarify', 'abstain'].includes(String(raw.action))) {
      return 'choice_action_invalid';
    }
  }
  return `schema:${parsed.error.issues.map((issue) =>
    `${issue.path.join('.') || 'root'}:${issue.code}`).join(',')}`;
}
