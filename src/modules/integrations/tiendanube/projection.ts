import 'server-only';

/**
 * Proyección en memoria de Tiendanube (M16e «Campos extraídos y descartados», C-10).
 *
 * Es obligatoria aunque la petición use `fields`: los subcampos de `customer` no están
 * verificados (M16e-H-07) y el servidor puede devolver de más. Cada función construye un
 * objeto nuevo solo con la lista cerrada; nada del objeto original se copia por referencia,
 * así `contact_*`, `billing_*`, direcciones, notas y el resto de `customer` nunca salen de acá.
 *
 * Las formas coinciden exactamente con las claves que validan `tn_publish_orders` y
 * `tn_publish_catalog` en `0023`.
 */

/** Error que se lanza cuando Tiendanube devuelve un recurso con forma inesperada. */
export class TiendanubeProjectionError extends Error {
  constructor() {
    super('Tiendanube devolvió un recurso con una forma inesperada.');
    this.name = 'TiendanubeProjectionError';
  }
}

const ID = /^[1-9][0-9]{0,19}$/;
const DECIMAL = /^[0-9]{1,15}(?:\.[0-9]{1,6})?$/;
const CURRENCY = /^[A-Z]{3}$/;
const STOREFRONT = /^[A-Za-z0-9_-]{1,32}$/;
const CANCEL_REASON = /^[A-Za-z0-9_ -]{1,64}$/;
const DOMAIN = /^[A-Za-z0-9.-]{1,253}$/;
const COUNTRY = /^[A-Z]{2}$/;

export const ORDER_STATUSES = ['open', 'closed', 'cancelled'] as const;
export const PAYMENT_STATUSES = ['authorized', 'pending', 'paid', 'partially_paid', 'abandoned', 'refunded',
  'partially_refunded', 'voided'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Campos que se piden con `fields`; la proyección no depende de que el servidor los respete. */
export const ORDER_FIELDS = ['id', 'customer', 'status', 'payment_status', 'created_at', 'updated_at', 'paid_at',
  'closed_at', 'cancelled_at', 'currency', 'subtotal', 'discount', 'total', 'total_paid_by_customer', 'storefront',
  'cancel_reason', 'is_subscription', 'is_subscription_initial', 'products'].join(',');
export const PRODUCT_FIELDS = ['id', 'name', 'visibility', 'published', 'variants'].join(',');
export const STORE_SYNC_FIELDS = ['id', 'original_domain', 'country'].join(',');

/** Procedencia de identidad y líneas de M27a (spec §2); nunca payload ni PII. */
export const INSIGHTS_IDENTITY_STATUSES = ['verified', 'absent', 'invalid'] as const;
export type InsightsIdentityStatus = (typeof INSIGHTS_IDENTITY_STATUSES)[number];
export const INSIGHTS_LINES_STATUSES = ['complete', 'source_omitted', 'source_invalid', 'line_omitted'] as const;
export type InsightsLinesStatus = (typeof INSIGHTS_LINES_STATUSES)[number];

export type ProjectedOrder = {
  id: string;
  customer_id: string | null;
  status: (typeof ORDER_STATUSES)[number];
  payment_status: PaymentStatus;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  currency: string;
  subtotal: string | null;
  discount: string | null;
  total: string;
  total_paid_by_customer: string | null;
  storefront: string | null;
  cancel_reason: string | null;
  is_subscription: boolean | null;
  is_subscription_initial: boolean | null;
  refunded_amount: string | null;
  /** M27a §3: los fija la sincronización con el lector estricto; acá, sin validar. */
  insights_amount: string | null;
  insights_amount_status: 'verified' | 'unverified' | 'incomplete' | 'inconsistent';
  insights_amount_definition: 'tn_paid_current_observed_v1' | 'tn_paid_current_less_verified_refunds_v1' | null;
  insights_identity_status: InsightsIdentityStatus;
  insights_lines_status: InsightsLinesStatus;
};

export type ProjectedLine = {
  order_id: string;
  line_no: number;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  price: string;
  quantity: number;
};

export type ProjectedProduct = {
  id: string;
  name: string;
  visibility: 'visible' | 'unlisted' | 'hidden' | null;
  variants: Array<{ id: string; sku: string | null }>;
};

export type ProjectedStore = { original_domain: string; country: string } | null;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Los IDs llegan como número o como texto; se guardan como texto decimal. */
export function externalId(value: unknown): string | null {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  return typeof text === 'string' && ID.test(text) ? text : null;
}

/** Montos como texto decimal no negativo, sin pasar por `number` (sin pérdida de precisión). */
function decimal(value: unknown): string | null {
  const text = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? String(value) : value;
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  return DECIMAL.test(trimmed) ? trimmed : null;
}

/** ISO 8601 con zona; Tiendanube usa `+0000`, que se normaliza a UTC con milisegundos. */
export function instant(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40) return null;
  const normalized = value.trim().replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)) return null;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function pattern(value: unknown, regex: RegExp): string | null {
  return typeof value === 'string' && regex.test(value) ? value : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : null;
}

/** Nombre de un producto: texto, o un objeto por idioma (se prefiere español). */
export function displayName(value: unknown): string | null {
  let text: unknown = value;
  const byLanguage = record(value);
  if (byLanguage) {
    text = ['es', 'es_AR', 'pt', 'en'].map((key) => byLanguage[key]).find((v) => typeof v === 'string' && v.trim() !== '')
      ?? Object.values(byLanguage).find((v) => typeof v === 'string' && v.trim() !== '');
  }
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed.slice(0, 500);
}

const MAX_LINES = 1000;

/**
 * Un pedido y sus líneas. Lo indispensable que falte o venga mal (ID, estados, fechas,
 * moneda, total) invalida el pedido: la página entera se trata como respuesta inválida. Una
 * línea que no entra en la forma de la base se omite (y se cuenta), sin invalidar el pedido.
 */
export function projectOrder(raw: unknown): { order: ProjectedOrder; lines: ProjectedLine[]; skippedLines: number } {
  const source = record(raw);
  if (!source) throw new TiendanubeProjectionError();
  const id = externalId(source.id);
  const status = oneOf(source.status, ORDER_STATUSES);
  const paymentStatus = oneOf(source.payment_status, PAYMENT_STATUSES);
  const createdAt = instant(source.created_at);
  const updatedAt = instant(source.updated_at);
  const currency = pattern(source.currency, CURRENCY);
  const total = decimal(source.total);
  if (!id || !status || !paymentStatus || !createdAt || !updatedAt || !currency || total === null) {
    throw new TiendanubeProjectionError();
  }
  const customer = record(source.customer);
  // M27a §2: comprador ausente/nulo o sin ID → `absent`; objeto o ID con forma inválida →
  // `invalid`; solo un ID válido es `verified`. El `customer_id` heredado no cambia.
  const customerId = customer ? externalId(customer.id) : null;
  const identity: InsightsIdentityStatus = source.customer === undefined || source.customer === null ? 'absent'
    : !customer ? 'invalid'
      : customer.id === undefined || customer.id === null ? 'absent'
        : customerId ? 'verified' : 'invalid';

  const order: ProjectedOrder = {
    id,
    customer_id: customerId,
    status,
    payment_status: paymentStatus,
    created_at: createdAt,
    updated_at: updatedAt,
    paid_at: instant(source.paid_at),
    closed_at: instant(source.closed_at),
    cancelled_at: instant(source.cancelled_at),
    currency,
    subtotal: decimal(source.subtotal),
    discount: decimal(source.discount),
    total,
    total_paid_by_customer: decimal(source.total_paid_by_customer),
    storefront: pattern(source.storefront, STOREFRONT),
    cancel_reason: pattern(source.cancel_reason, CANCEL_REASON),
    is_subscription: bool(source.is_subscription),
    is_subscription_initial: bool(source.is_subscription_initial),
    refunded_amount: null,
    insights_amount: null,
    insights_amount_status: 'unverified',
    insights_amount_definition: null,
    insights_identity_status: identity,
    insights_lines_status: source.products === undefined ? 'source_omitted'
      : Array.isArray(source.products) ? 'complete' : 'source_invalid',
  };

  const lines: ProjectedLine[] = [];
  let skippedLines = 0;
  const products = Array.isArray(source.products) ? source.products : [];
  for (const [index, item] of products.entries()) {
    const line = record(item);
    const name = line ? displayName(line.name) : null;
    const price = line ? decimal(line.price) : null;
    const quantity = line ? Number(line.quantity) : NaN;
    if (!line || index >= MAX_LINES || !name || price === null || !Number.isInteger(quantity) ||
        quantity < 1 || quantity > 1_000_000) {
      skippedLines += 1;
      order.insights_lines_status = 'line_omitted';
      continue;
    }
    // Una línea sin `product_id` válido se guarda como antes, pero no completa la evidencia.
    if (!externalId(line.product_id)) order.insights_lines_status = 'line_omitted';
    lines.push({
      order_id: id,
      line_no: index + 1,
      product_id: externalId(line.product_id),
      variant_id: externalId(line.variant_id),
      name,
      price,
      quantity,
    });
  }
  return { order, lines, skippedLines };
}

/** Producto del catálogo con sus variantes; sin precios, stock, imágenes ni descripción. */
export function projectProduct(raw: unknown): ProjectedProduct {
  const source = record(raw);
  const id = source ? externalId(source.id) : null;
  if (!source || !id) throw new TiendanubeProjectionError();
  const visibility = oneOf(source.visibility, ['visible', 'unlisted', 'hidden'] as const)
    ?? (typeof source.published === 'boolean' ? (source.published ? 'visible' : 'hidden') : null);
  const variants: ProjectedProduct['variants'] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(source.variants) ? source.variants : []) {
    const variant = record(item);
    const variantId = variant ? externalId(variant.id) : null;
    if (!variant || !variantId || seen.has(variantId)) continue;
    seen.add(variantId);
    const sku = typeof variant.sku === 'string' && variant.sku.trim() !== '' && variant.sku.trim().length <= 100
      ? variant.sku.trim() : null;
    variants.push({ id: variantId, sku });
  }
  return { id, name: displayName(source.name) ?? `Producto ${id}`, visibility, variants };
}

/** Dominio y país de la tienda, o nada: la base exige los dos con forma válida. */
export function projectStore(raw: unknown): ProjectedStore {
  const source = record(raw);
  if (!source) return null;
  const domain = pattern(source.original_domain, DOMAIN);
  const country = pattern(source.country, COUNTRY);
  return domain && country ? { original_domain: domain, country } : null;
}

/**
 * Reembolsos verificados de un pedido (`history/values`, M16e-H-06): suma de los
 * `total_paid_diff` negativos de las entradas `PAID`. Si la forma no se reconoce, `null`
 * («no verificado»), nunca cero.
 */
export function refundedFromHistory(body: unknown): string | null {
  const entries = Array.isArray(body) ? body : Array.isArray(record(body)?.values) ? record(body)!.values as unknown[] : null;
  if (!entries) return null;
  const MICRO = BigInt(1_000_000);
  let cents = BigInt(0);
  let recognized = false;
  for (const item of entries) {
    const entry = record(item);
    if (!entry) continue;
    const label = [entry.event, entry.type, entry.name, entry.status]
      .find((value) => typeof value === 'string');
    if (typeof label !== 'string' || label.toUpperCase() !== 'PAID') continue;
    const diffSource = entry.total_paid_diff ?? record(entry.values)?.total_paid_diff ?? record(entry.data)?.total_paid_diff;
    const text = typeof diffSource === 'number' && Number.isFinite(diffSource) ? diffSource.toFixed(2) : diffSource;
    if (typeof text !== 'string' || !/^-?[0-9]{1,15}(?:\.[0-9]{1,6})?$/.test(text.trim())) continue;
    recognized = true;
    const [whole, fraction = ''] = text.trim().replace('-', '').split('.');
    const value = BigInt(whole) * MICRO + BigInt((fraction + '000000').slice(0, 6));
    if (text.trim().startsWith('-')) cents += value;
  }
  if (!recognized) return null;
  const whole = cents / MICRO;
  const fraction = (cents % MICRO).toString().padStart(6, '0').replace(/0+$/, '');
  return fraction === '' ? whole.toString() : `${whole}.${fraction}`;
}
