import { describe, expect, it, vi } from 'vitest';

import { CHAT_MODEL_ID, ChatModelError, requestChatModel } from '@/modules/chat/llm';
import { choiceSchema } from '@/modules/chat/output-schema';

vi.mock('server-only', () => ({}));

function completion(content: unknown, finishReason = 'stop', model: unknown = CHAT_MODEL_ID) {
  return { model, choices: [{ finish_reason: finishReason, message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 } };
}

const choice = { action: 'abstain', calls: [], clarification_text: null,
  abstain_reason: 'out_of_scope' };
const answer = { text: 'No puedo responder esa consulta.', blocks: [] };
const toolCall = { name: 'total', args: { level: null, entity_ref: null,
  metric: 'spend', period: { from: '2026-02-01', to: '2026-02-02' },
  period_a: null, period_b: null, action_type: null, order: null,
  limit: null, include_trend: null, dimension: null } };
const flatChoice = (action: string, fields: Record<string, unknown> = {}) => ({
  action, calls: [], clarification_text: null, abstain_reason: null, ...fields,
});

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

  it('normaliza answer con llamadas válidas sin inventarlas ni admitir llamadas vacías', async () => {
    const args = { level: null, entity_ref: null, metric: 'spend',
      period: { from: '2026-02-01', to: '2026-02-02' },
      period_a: null, period_b: null, action_type: null, order: null,
      limit: null, include_trend: null, dimension: null };
    const raw = { action: 'answer', calls: [{ name: 'total', args }],
      clarification_text: null, abstain_reason: null };
    const selected = await requestChatModel({ phase: 'choice', messages: [],
      apiKey: 'clave-falsa', fetchImpl: vi.fn(async () =>
        Response.json(completion(JSON.stringify(raw)))) });
    expect(selected.output).toEqual({ ...raw, action: 'call_tools' });
    expect(choiceSchema.parse({ ...raw, calls: [] }).action).toBe('answer');
    expect(choiceSchema.safeParse({ ...raw, action: 'call_tools', calls: [] }).success)
      .toBe(false);
    expect(choiceSchema.safeParse({ ...raw, calls: [{ name: 'total',
      args: { ...args, metric: 7 } }] }).success).toBe(false);
  });

  it.each([
    ['answer con aclaración sobrante', flatChoice('answer', {
      clarification_text: 'Aclaración sobrante' }), flatChoice('answer')],
    ['answer con motivo sobrante', flatChoice('answer', {
      abstain_reason: 'out_of_scope' }), flatChoice('answer')],
    ['answer con llamadas y otros campos sobrantes', flatChoice('answer', {
      calls: [toolCall], clarification_text: 'Aclaración sobrante',
      abstain_reason: 'out_of_scope' }), flatChoice('call_tools', { calls: [toolCall] })],
    ['call_tools con aclaración y motivo sobrantes', flatChoice('call_tools', {
      calls: [toolCall], clarification_text: 'Aclaración sobrante',
      abstain_reason: 'out_of_scope' }), flatChoice('call_tools', { calls: [toolCall] })],
    ['clarify con llamadas y motivo sobrantes', flatChoice('clarify', {
      calls: [toolCall], clarification_text: '¿Qué dimensión?',
      abstain_reason: 'out_of_scope' }), flatChoice('clarify', {
      clarification_text: '¿Qué dimensión?' })],
    ['abstain con llamadas y aclaración sobrantes', flatChoice('abstain', {
      calls: [toolCall], clarification_text: 'Aclaración sobrante',
      abstain_reason: 'out_of_scope' }), flatChoice('abstain', {
      abstain_reason: 'out_of_scope' })],
    ['clarify con motivo sobrante', flatChoice('clarify', {
      clarification_text: '¿Qué dimensión?', abstain_reason: 'out_of_scope' }),
    flatChoice('clarify', { clarification_text: '¿Qué dimensión?' })],
    ['abstain con aclaración sobrante', flatChoice('abstain', {
      clarification_text: 'Aclaración sobrante', abstain_reason: 'out_of_scope' }),
    flatChoice('abstain', { abstain_reason: 'out_of_scope' })],
  ])('normaliza %s', (_name, raw, expected) => {
    expect(choiceSchema.parse(raw)).toEqual(expected);
  });

  it.each([
    ['clarify sin texto', flatChoice('clarify', { calls: [toolCall] })],
    ['call_tools sin llamadas', flatChoice('call_tools', {
      clarification_text: 'Aclaración sobrante' })],
    ['abstain sin motivo', flatChoice('abstain')],
    ['acción fuera del enum', flatChoice('desconocida')],
    ['motivo fuera del enum', flatChoice('answer', { abstain_reason: 'otro' })],
    ['herramienta fuera del enum', flatChoice('call_tools', { calls: [{
      ...toolCall, name: 'desconocida' }] })],
    ['más de seis llamadas', flatChoice('call_tools', {
      calls: Array.from({ length: 7 }, () => toolCall) })],
    ['propiedad extra', { ...flatChoice('answer'), extra: true }],
    ['argumento extra', flatChoice('call_tools', { calls: [{ ...toolCall,
      args: { ...toolCall.args, extra: true } }] })],
  ])('mantiene rechazo de %s', (_name, raw) => {
    expect(choiceSchema.safeParse(raw).success).toBe(false);
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

  it('normaliza el modelo informado vacío o largo para que record_query lo acepte', async () => {
    const run = (model: unknown) => requestChatModel({ phase: 'choice', messages: [],
      apiKey: 'clave-falsa', fetchImpl: vi.fn(async () =>
        Response.json(completion(JSON.stringify(choice), 'stop', model))) });
    expect((await run('')).reportedModelId).toBeNull();
    expect((await run('m'.repeat(300))).reportedModelId).toBe('m'.repeat(128));
  });
});
