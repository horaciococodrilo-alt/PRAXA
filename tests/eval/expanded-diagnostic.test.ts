import { describe, expect, it } from 'vitest';

import { diagnoseProjection, modelResponseCheck } from './expanded-diagnostic';

describe('M25a.3 paso 21: ramas del diagnóstico', () => {
  it('clasifica truncado, JSON inválido y esquema sin revelar el contenido', async () => {
    const response = (finish_reason: string, content: string) =>
      new Response(JSON.stringify({ choices: [{ finish_reason,
        message: { content } }] }), { status: 200 });
    expect(await modelResponseCheck(response('length', '{}'), 'answer'))
      .toBe('finish_reason:length');
    expect(await modelResponseCheck(response('stop', '{'), 'answer'))
      .toBe('content_json');
    expect(await modelResponseCheck(response('stop', JSON.stringify({
      action: 'invented' })), 'choice')).toBe('choice_action_invalid');
  });
  it('distingue una combinación inválida de bloque', () => {
    const block = { type: 'tabla' as const, sources: [{ tool_call_id: 't1',
      path_prefix: '/values' }], options: { ordering: 'source' as const }, items: null,
      ids: null };
    expect(diagnoseProjection({ text: '', blocks: [block] }))
      .toBe('projection:block:tabla:variant_fields');
  });
});
