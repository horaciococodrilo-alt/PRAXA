import { describe, expect, it, vi } from 'vitest';

import { CHOICE_FORMAT } from '@/modules/chat/output-schema';
import { createAlternateModelFetch } from './alternate-model';

describe('M25a.3: modelo alternativo aislado en VR-02', () => {
  it('sustituye solo model y conserva el esquema estricto y los límites', async () => {
    const sent: Record<string, unknown>[] = [];
    const transport = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response('{}', { status: 200 });
    });
    const fetchImpl = createAlternateModelFetch('deepseek-ai/DeepSeek-V4-Pro', transport);
    const original = { model: 'deepseek-ai/DeepSeek-V4.1-Flash',
      messages: [{ role: 'user', content: 'Caso sintético' }],
      response_format: CHOICE_FORMAT, max_tokens: 2400,
      temperature: 0, stream: false };
    await fetchImpl('https://api.deepinfra.com/v1/openai/chat/completions', {
      method: 'POST', headers: { Authorization: 'Bearer valor-sintetico' },
      body: JSON.stringify(original) });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({ ...original, model: 'deepseek-ai/DeepSeek-V4-Pro' });
    expect(sent[0].response_format).toEqual(CHOICE_FORMAT);
    expect(original.model).toBe('deepseek-ai/DeepSeek-V4.1-Flash');
  });
});
