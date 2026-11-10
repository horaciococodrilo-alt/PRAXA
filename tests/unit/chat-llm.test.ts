import { describe, expect, it, vi } from 'vitest';

import { CHAT_MODEL_ID, ChatModelError, requestChatModel } from '@/modules/chat/llm';

vi.mock('server-only', () => ({}));

function completion(content: unknown, finishReason = 'stop', model: unknown = CHAT_MODEL_ID) {
  return { model, choices: [{ finish_reason: finishReason, message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 } };
}

const choice = { action: 'abstain', calls: [], clarification_text: null,
  abstain_reason: 'out_of_scope' };
const answer = { text: 'No puedo responder esa consulta.', claims: [], blocks: [] };

describe('M25a-T-33/T-34: adaptador DeepInfra', () => {
  it('envía modelo fijo, esquema estricto y límite, y valida ambas salidas', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init ?? {} });
      const body = JSON.parse(String(init?.body));
      return Response.json(completion(JSON.stringify(body.response_format.json_schema.name === 'chat_choice'
        ? choice : answer)));
    });

    const selected = await requestChatModel({ phase: 'choice', messages: [
      { role: 'user', content: 'Pregunta sintética' }], fetchImpl, apiKey: 'clave-falsa' });
    const drafted = await requestChatModel({ phase: 'answer', messages: [
      { role: 'user', content: 'Respuesta sintética' }], fetchImpl, apiKey: 'clave-falsa' });

    expect(selected.output).toEqual(choice);
    expect(drafted.output).toEqual(answer);
    expect(selected.reportedModelId).toBe(CHAT_MODEL_ID);
    expect(selected.usage).toEqual({ promptTokens: 10, completionTokens: 8, totalTokens: 18 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const { url, init } of requests) {
      expect(url).toBe('https://api.deepinfra.com/v1/openai/chat/completions');
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({ Authorization: 'Bearer clave-falsa',
        'Content-Type': 'application/json' });
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({ model: CHAT_MODEL_ID, max_tokens: 2400,
        temperature: 0, stream: false,
        response_format: { type: 'json_schema', json_schema: { strict: true } } });
      expect(body).not.toHaveProperty('reasoning_effort');
      expect(body.response_format.json_schema.schema.additionalProperties).toBe(false);
      expect(body.response_format.json_schema.schema.required).toEqual(
        Object.keys(body.response_format.json_schema.schema.properties));
    }
  });

  it('clasifica truncado, JSON inválido y forma inválida como bad_output', async () => {
    for (const response of [completion(JSON.stringify(choice), 'length'),
      completion('{'), completion('{"action":"inventada"}')]) {
      await expect(requestChatModel({ phase: 'choice', messages: [], apiKey: 'clave-falsa',
        fetchImpl: vi.fn(async () => Response.json(response)) }))
        .rejects.toMatchObject({ reason: 'bad_output', message: 'Salida del modelo inválida.' });
    }
  });

  it('clasifica falta de clave, HTTP y aborto como unavailable sin filtrar contenido', async () => {
    const missingFetch = vi.fn();
    await expect(requestChatModel({ phase: 'choice', messages: [], apiKey: '',
      fetchImpl: missingFetch })).rejects.toMatchObject({ reason: 'unavailable' });
    expect(missingFetch).not.toHaveBeenCalled();
    await expect(requestChatModel({ phase: 'choice', messages: [], apiKey: 'clave-falsa',
      fetchImpl: vi.fn(async () => new Response('mensaje sensible', { status: 429 })) }))
      .rejects.toMatchObject({ reason: 'unavailable', message: 'Modelo no disponible.' });
    await expect(requestChatModel({ phase: 'choice', messages: [], apiKey: 'clave-falsa',
      fetchImpl: vi.fn(async () => { throw new Error('mensaje sensible'); }) }))
      .rejects.toMatchObject({ reason: 'unavailable', message: 'Modelo no disponible.' });
    expect(new ChatModelError('bad_output').message).toBe('Salida del modelo inválida.');
  });

  it('conserva modelo informado nulo para que VR-02 pueda detenerse', async () => {
    const result = await requestChatModel({ phase: 'choice', messages: [], apiKey: 'clave-falsa',
      fetchImpl: vi.fn(async () => Response.json(completion(JSON.stringify(choice), 'stop', null))) });
    expect(result.reportedModelId).toBeNull();
  });
});
