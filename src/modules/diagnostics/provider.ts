import 'server-only';

import { z } from 'zod';

import type { UsageStep } from './contract';
import { DIAGNOSTIC_LIMITS } from './limits';
import { ALLOWED_WEB_DOMAINS } from './web';

/**
 * Adaptador de Anthropic para el diagnóstico (M26a, Diseño §3): `fetch` directo a la Messages
 * API, sin SDK, igual que el chat. Es el único lugar de `src/` que lee la clave (C-18). No envía
 * `temperature`, `top_p` ni `top_k`. Los errores llevan una clase fija y nunca el contenido de la
 * petición ni de la respuesta.
 */

export const DIAGNOSTIC_MODEL_ID = 'claude-sonnet-5-5' as const;
export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2026-10-21';

export type ProviderFailureClass = 'unavailable' | 'timeout' | 'http' | 'invalid_output';

export class DiagnosticProviderError extends Error {
  readonly failureClass: ProviderFailureClass;
  readonly httpStatus: number | null;
  /** Uso facturado de una respuesta recibida pero inválida (`max_tokens`, `refusal`, JSON roto). */
  readonly usage: ProviderUsage | null;
  readonly reportedModel: string | null;

  constructor(failureClass: ProviderFailureClass, httpStatus: number | null = null,
    billed: Readonly<{ usage: ProviderUsage; reportedModel: string | null }> | null = null) {
    super(`praxa: proveedor del diagnóstico (${failureClass})`);
    this.name = 'DiagnosticProviderError';
    this.failureClass = failureClass;
    this.httpStatus = httpStatus;
    this.usage = billed?.usage ?? null;
    this.reportedModel = billed?.reportedModel ?? null;
  }
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type CallOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  /** Solo se inyecta en pruebas; en producción se lee la variable del servidor. */
  apiKey?: string;
};

export type ProviderUsage = Omit<UsageStep, 'step'>;

const envelopeSchema = z.object({
  model: z.string().nullable().optional(),
  stop_reason: z.string().nullable(),
  content: z.array(z.unknown()),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    server_tool_use: z.object({ web_search_requests: z.number().int().nonnegative().optional() })
      .nullable().optional(),
  }),
});
type Envelope = z.infer<typeof envelopeSchema>;

function usageOf(envelope: Envelope): ProviderUsage {
  return { input_tokens: envelope.usage.input_tokens, output_tokens: envelope.usage.output_tokens,
    web_searches: envelope.usage.server_tool_use?.web_search_requests ?? 0 };
}

function reportedModel(envelope: Envelope): string | null {
  return envelope.model ? envelope.model.slice(0, 128) : null;
}

async function post(body: Record<string, unknown>, options: CallOptions, maxTimeoutMs: number): Promise<Envelope> {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new DiagnosticProviderError('unavailable');
  const timeoutMs = Math.max(1, Math.min(options.timeoutMs ?? maxTimeoutMs, maxTimeoutMs));
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    const name = error instanceof Error || error instanceof DOMException ? error.name : '';
    throw new DiagnosticProviderError(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'unavailable');
  }
  if (!response.ok) {
    // El cuerpo del error no se lee: puede repetir contenido de la petición.
    await response.body?.cancel().catch(() => undefined);
    throw new DiagnosticProviderError('http', response.status);
  }
  let raw: unknown;
  try { raw = await response.json(); } catch { throw new DiagnosticProviderError('invalid_output'); }
  const parsed = envelopeSchema.safeParse(raw);
  if (!parsed.success) throw new DiagnosticProviderError('invalid_output');
  return parsed.data;
}

export type StructuredResult = Readonly<{ json: unknown; usage: ProviderUsage; reportedModel: string | null }>;

/** Paso de informe, lote o síntesis: salida estructurada, sin herramientas. */
export async function requestStructured(options: CallOptions & {
  system: string; user: string; schema: Record<string, unknown>; maxTokens?: number;
}): Promise<StructuredResult> {
  const envelope = await post({
    model: DIAGNOSTIC_MODEL_ID,
    max_tokens: Math.min(options.maxTokens ?? DIAGNOSTIC_LIMITS.reportMaxTokens, DIAGNOSTIC_LIMITS.reportMaxTokens),
    system: options.system,
    messages: [{ role: 'user', content: options.user }],
    output_config: { format: { type: 'json_schema', schema: options.schema } },
  }, options, DIAGNOSTIC_LIMITS.reportTimeoutMs);
  const billed = { usage: usageOf(envelope), reportedModel: reportedModel(envelope) };
  // max_tokens, refusal o pause_turn pueden no cumplir el esquema: se rechazan, con su uso.
  if (envelope.stop_reason !== 'end_turn') throw new DiagnosticProviderError('invalid_output', null, billed);
  const text = envelope.content
    .filter((block): block is { type: 'text'; text: string } => typeof block === 'object' && block !== null
      && (block as { type?: unknown }).type === 'text' && typeof (block as { text?: unknown }).text === 'string')
    .map((block) => block.text).join('');
  let json: unknown;
  try { json = JSON.parse(text); } catch { throw new DiagnosticProviderError('invalid_output', null, billed); }
  return { json, ...billed };
}

export type WebResult = Readonly<{ blocks: readonly unknown[]; usage: ProviderUsage; reportedModel: string | null }>;

/** Paso web, separado: solo la consulta genérica, con la lista de dominios aprobada. */
export async function requestWebSearch(options: CallOptions & { prompt: string }): Promise<WebResult> {
  const envelope = await post({
    model: DIAGNOSTIC_MODEL_ID,
    max_tokens: DIAGNOSTIC_LIMITS.webMaxTokens,
    messages: [{ role: 'user', content: options.prompt }],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: DIAGNOSTIC_LIMITS.webMaxUses,
      allowed_domains: [...ALLOWED_WEB_DOMAINS] }],
  }, options, DIAGNOSTIC_LIMITS.webTimeoutMs);
  const billed = { usage: usageOf(envelope), reportedModel: reportedModel(envelope) };
  if (envelope.stop_reason !== 'end_turn') throw new DiagnosticProviderError('invalid_output', null, billed);
  return { blocks: envelope.content, ...billed };
}
