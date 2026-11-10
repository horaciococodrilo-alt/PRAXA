import 'server-only';

import { z } from 'zod';

import { CHAT_LIMITS } from './limits';
import { ANSWER_FORMAT, answerSchema, CHOICE_FORMAT, choiceSchema,
  type ChatChoice, type FlatChatAnswer } from './output-schema';

export const CHAT_MODEL_ID = 'deepseek-ai/DeepSeek-V4.1-Flash';
const CHAT_COMPLETIONS_URL = 'https://api.deepinfra.com/v1/openai/chat/completions';

export class ChatModelError extends Error {
  readonly reason: 'unavailable' | 'bad_output';

  constructor(reason: 'unavailable' | 'bad_output') {
    super(reason === 'unavailable' ? 'Modelo no disponible.' : 'Salida del modelo inválida.');
    this.reason = reason;
  }
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type RequestOptions = {
  phase: 'choice' | 'answer';
  messages: ChatMessage[];
  signal?: AbortSignal;
  timeoutMs?: number;
  maxTokens?: number;
  fetchImpl?: FetchLike;
  /** Solo se inyecta en pruebas; en producción se lee la variable del servidor. */
  apiKey?: string;
};
type ModelResponse<T> = {
  output: T;
  requestedModelId: typeof CHAT_MODEL_ID;
  reportedModelId: string | null;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
};

const envelopeSchema = z.object({
  model: z.string().nullable().optional(),
  choices: z.array(z.object({
    finish_reason: z.string().nullable(),
    message: z.object({ content: z.string().nullable() }),
  })).min(1),
  usage: z.object({ prompt_tokens: z.number().int().min(0),
    completion_tokens: z.number().int().min(0), total_tokens: z.number().int().min(0) }).optional(),
});

export function requestChatModel(options: RequestOptions & { phase: 'choice' }): Promise<ModelResponse<ChatChoice>>;
export function requestChatModel(options: RequestOptions & { phase: 'answer' }): Promise<ModelResponse<FlatChatAnswer>>;
export async function requestChatModel(options: RequestOptions): Promise<ModelResponse<ChatChoice | FlatChatAnswer>> {
  const apiKey = options.apiKey ?? process.env.DEEPINFRA_API_KEY;
  if (!apiKey) throw new ChatModelError('unavailable');
  const timeoutMs = Math.max(1, Math.min(options.timeoutMs ?? CHAT_LIMITS.modelCallTimeoutMs,
    CHAT_LIMITS.modelCallTimeoutMs));
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const format = options.phase === 'choice' ? CHOICE_FORMAT : ANSWER_FORMAT;
  const body = {
    model: CHAT_MODEL_ID,
    messages: options.messages,
    response_format: format,
    max_tokens: Math.min(options.maxTokens ?? CHAT_LIMITS.maxOutputTokensPerCall,
      CHAT_LIMITS.maxOutputTokensPerCall),
    temperature: 0,
    stream: false,
  };

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(CHAT_COMPLETIONS_URL, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
    });
  } catch {
    throw new ChatModelError('unavailable');
  }
  if (!response.ok) throw new ChatModelError('unavailable');

  let raw: unknown;
  try { raw = await response.json(); } catch { throw new ChatModelError('bad_output'); }
  const parsed = envelopeSchema.safeParse(raw);
  if (!parsed.success || parsed.data.choices[0].finish_reason !== 'stop' ||
      parsed.data.choices[0].message.content === null) {
    throw new ChatModelError('bad_output');
  }

  let content: unknown;
  try { content = JSON.parse(parsed.data.choices[0].message.content); }
  catch { throw new ChatModelError('bad_output'); }
  const validated = options.phase === 'choice'
    ? choiceSchema.safeParse(content) : answerSchema.safeParse(content);
  if (!validated.success) throw new ChatModelError('bad_output');

  const usage = parsed.data.usage;
  return {
    output: validated.data, requestedModelId: CHAT_MODEL_ID,
    reportedModelId: parsed.data.model ?? null,
    usage: usage ? { promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens, totalTokens: usage.total_tokens } : null,
  };
}
