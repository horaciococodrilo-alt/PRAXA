import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import { getWorkerApi, type WorkerApi } from '../db/worker-api';
import { getTiendanubeConfig, type TiendanubeConfig } from './config';
import { DEFAULT_TN_PRIVACY_LIMITS, type TiendanubePrivacyLimits } from './limits';
import { externalId } from './projection';
import { privacyCustomerRedact, privacyStoreRedact } from './repository';

/**
 * Webhooks de privacidad de Tiendanube (M16e §4, D-M16e-14).
 *
 * - El cuerpo se lee crudo, con tope de 64 KB, y la firma `x-linkedstore-hmac-sha256`
 *   (HMAC-SHA256 en hexadecimal del cuerpo con el `client_secret`, M16e-H-09) se verifica
 *   **antes** de parsear, en tiempo constante. Firma inválida → `401`.
 * - El tipo de evento sale de la URL, no del cuerpo.
 * - Del cuerpo se usan solo el ID de la tienda, el ID del cliente y los IDs de pedidos. Email,
 *   teléfono y documento se descartan en memoria; nada del cuerpo se registra.
 * - Las funciones de `worker_api` no tienen actor: resuelven por tienda todas sus conexiones,
 *   solo marcan y borran, y devuelven la fase. El handler las llama hasta terminar o hasta
 *   agotar 2 s: si terminó, `200`; si no, `503`, y el reintento de Tiendanube sigue desde ahí.
 * - Sin conexiones de esa tienda, no se escribe nada y se responde `200`, sin revelar nada.
 */

export const PRIVACY_EVENTS = ['store_redact', 'customer_redact', 'data_request'] as const;
export type PrivacyEvent = (typeof PRIVACY_EVENTS)[number];

export const SIGNATURE_HEADER = 'x-linkedstore-hmac-sha256';

export type PrivacyLogEvent = {
  evento: 'tiendanube_privacidad';
  tipo: PrivacyEvent;
  resultado: 'ok' | 'pendiente' | 'firma_invalida' | 'cuerpo_excedido' | 'cuerpo_invalido' | 'configuracion' | 'error';
  firma_valida?: boolean;
  fase?: 'marked' | 'more' | 'done';
  llamadas?: number;
  duracion_ms?: number;
};

export type PrivacyDeps = {
  config: () => TiendanubeConfig;
  workerApi: () => WorkerApi;
  now: () => number;
  limits: TiendanubePrivacyLimits;
  log: (event: PrivacyLogEvent) => void;
};

function resolveDeps(partial: Partial<PrivacyDeps> = {}): PrivacyDeps {
  return {
    config: partial.config ?? getTiendanubeConfig,
    workerApi: partial.workerApi ?? getWorkerApi,
    now: partial.now ?? Date.now,
    limits: partial.limits ?? DEFAULT_TN_PRIVACY_LIMITS,
    log: partial.log ?? ((event) => console.info(JSON.stringify(event))),
  };
}

function empty(status: number): Response {
  return new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
}

class BodyTooLarge extends Error {}

/** Lee el cuerpo crudo sin pasar el tope; no confía en `content-length`. */
async function readRawBody(request: Request, maxBytes: number): Promise<Buffer> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLarge();
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      try { await reader.cancel(); } catch { /* sin efecto */ }
      throw new BodyTooLarge();
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, size);
}

/** HMAC-SHA256 en hexadecimal, comparado en tiempo constante (M16e-H-09). */
export function validSignature(raw: Buffer, header: string | null, secret: string): boolean {
  if (header === null || !/^[0-9a-fA-F]{64}$/.test(header.trim())) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  const received = Buffer.from(header.trim().toLowerCase(), 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

type Parsed =
  | { kind: 'store'; storeId: string }
  | { kind: 'customer'; storeId: string; customerId: string; orderIds: string[] };

/** Solo los IDs; el resto del cuerpo (PII incluida) no sale de esta función. */
function parseBody(event: PrivacyEvent, raw: Buffer): Parsed | null {
  let body: unknown;
  try { body = JSON.parse(raw.toString('utf8')); }
  catch { return null; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const fields = body as Record<string, unknown>;
  const storeId = externalId(fields.store_id);
  if (!storeId) return null;
  if (event !== 'customer_redact') return { kind: 'store', storeId };
  const customer = fields.customer && typeof fields.customer === 'object' && !Array.isArray(fields.customer)
    ? fields.customer as Record<string, unknown> : null;
  const customerId = customer ? externalId(customer.id) : null;
  const list = fields.orders_to_redact === undefined || fields.orders_to_redact === null ? [] : fields.orders_to_redact;
  if (!customerId || !Array.isArray(list) || list.length > 10_000) return null;
  const orderIds = list.map(externalId);
  if (orderIds.some((id) => id === null)) return null;
  return { kind: 'customer', storeId, customerId, orderIds: [...new Set(orderIds as string[])] };
}

/**
 * WEBHOOK DE PRIVACIDAD: verifica la firma de Tiendanube y borra los datos de un comprador o de toda la
 * tienda.
 */
export async function handlePrivacyWebhook(event: PrivacyEvent, request: Request, partial?: Partial<PrivacyDeps>):
Promise<Response> {
  const deps = resolveDeps(partial);
  const started = deps.now();
  const log = (entry: Omit<PrivacyLogEvent, 'evento' | 'tipo'>) =>
    deps.log({ evento: 'tiendanube_privacidad', tipo: event, ...entry, duracion_ms: deps.now() - started });

  let raw: Buffer;
  try {
    raw = await readRawBody(request, deps.limits.maxBodyBytes);
  } catch (error) {
    log({ resultado: error instanceof BodyTooLarge ? 'cuerpo_excedido' : 'cuerpo_invalido' });
    return empty(error instanceof BodyTooLarge ? 413 : 400);
  }

  let secret: string;
  try { secret = deps.config().clientSecret.reveal(); }
  catch {
    log({ resultado: 'configuracion' });
    return empty(500);
  }
  const signed = validSignature(raw, request.headers.get(SIGNATURE_HEADER), secret);
  if (!signed) {
    log({ resultado: 'firma_invalida', firma_valida: false });
    return empty(401);
  }

  const parsed = parseBody(event, raw);
  if (!parsed) {
    log({ resultado: 'cuerpo_invalido', firma_valida: true });
    return empty(400);
  }

  // D-M16e-07: se acusa sin persistir, deduplicar, exportar ni avisar.
  if (event === 'data_request') {
    log({ resultado: 'ok', firma_valida: true });
    return empty(200);
  }

  let calls = 0;
  let phase: 'marked' | 'more' | 'done' | undefined;
  const deadline = started + deps.limits.budgetMs;
  try {
    while (deps.now() < deadline) {
      calls += 1;
      phase = parsed.kind === 'customer'
        ? await privacyCustomerRedact(parsed.storeId, parsed.customerId, parsed.orderIds, { workerApi: deps.workerApi() })
        : await privacyStoreRedact(parsed.storeId, deps.limits.maxRowsPerCall, { workerApi: deps.workerApi() });
      if (phase === 'done') break;
    }
  } catch {
    log({ resultado: 'error', firma_valida: true, fase: phase, llamadas: calls });
    return empty(500);
  }
  if (phase !== 'done') {
    log({ resultado: 'pendiente', firma_valida: true, fase: phase, llamadas: calls });
    return empty(503);
  }
  log({ resultado: 'ok', firma_valida: true, fase: phase, llamadas: calls });
  return empty(200);
}
