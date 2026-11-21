import 'server-only';

/**
 * Monetary de M27a (spec §3, D-M27a-02 y D-M27a-09).
 *
 * Contrato cerrado A/B/C. T-04 elige la definición con evidencia de una tienda de prueba; hasta
 * entonces la constante es nula y toda la sincronización publica `null`, `unverified`, `null`.
 *
 * Exactitud: el transporte decodifica con `JSON.parse`, así que un token numérico JSON ya llegó
 * como `number` y perdió sus dígitos originales. Este lector acepta solo strings JSON decimales;
 * cualquier otra cosa es `incomplete`, nunca una aproximación ni un cero. No reutiliza la
 * conversión heredada de `projection.ts` ni `refundedFromHistory`.
 */

export const MONETARY_DEFINITIONS = ['tn_paid_current_observed_v1', 'tn_paid_current_less_verified_refunds_v1'] as const;
export type MonetaryDefinition = (typeof MONETARY_DEFINITIONS)[number];

/** Solo cambia tras evidencia concluyente de T-04 registrada en la sesión de M27a. */
export const M27A_MONETARY_DEFINITION: MonetaryDefinition | null = null;

/**
 * Modo demo local (decisión del usuario del 2026-11-17, `H-E1-278`). Solo para mostrar la
 * pantalla completa con la empresa demo sintética: el script `chat-seed-test.mjs --serve --demo`
 * siembra montos verificados con la definición A y levanta Next con esta variable. Se ignora en
 * producción. No cambia la sincronización real, que sigue usando `M27A_MONETARY_DEFINITION`.
 */
export const DEMO_MONETARY_ENV = 'PRAXA_DEMO_MONETARY_DEFINITION';

export function demoMonetaryDefinition(env: Record<string, string | undefined> = process.env): MonetaryDefinition | null {
  if (env.NODE_ENV === 'production') return null;
  return env[DEMO_MONETARY_ENV] === 'tn_paid_current_observed_v1' ? 'tn_paid_current_observed_v1' : null;
}

/** Definición que acepta la pantalla: la acreditada por T-04 o, solo en la demo local, la de la demo. */
export function viewMonetaryDefinition(env: Record<string, string | undefined> = process.env): MonetaryDefinition | null {
  return M27A_MONETARY_DEFINITION ?? demoMonetaryDefinition(env);
}

export const INSIGHTS_AMOUNT_STATUSES = ['verified', 'unverified', 'incomplete', 'inconsistent'] as const;
export type InsightsAmountStatus = (typeof INSIGHTS_AMOUNT_STATUSES)[number];

export type InsightsMonetaryFields = Readonly<{
  insights_amount: string | null;
  insights_amount_status: InsightsAmountStatus;
  insights_amount_definition: MonetaryDefinition | null;
}>;

const AMOUNT = /^[0-9]{1,15}(?:\.[0-9]{1,6})?$/;
const SIGNED = /^-?[0-9]{1,15}(?:\.[0-9]{1,6})?$/;
const SCALE = 6;
const MICRO = BigInt(10) ** BigInt(SCALE);

const UNVERIFIED: InsightsMonetaryFields = Object.freeze({
  insights_amount: null, insights_amount_status: 'unverified', insights_amount_definition: null,
});
const INCOMPLETE: InsightsMonetaryFields = Object.freeze({
  insights_amount: null, insights_amount_status: 'incomplete', insights_amount_definition: null,
});
const INCONSISTENT: InsightsMonetaryFields = Object.freeze({
  insights_amount: null, insights_amount_status: 'inconsistent', insights_amount_definition: null,
});

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** String JSON decimal no negativo; conserva los dígitos (sin el espacio exterior). */
export function parseStrictAmount(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return AMOUNT.test(trimmed) ? trimmed : null;
}

function toMicro(text: string): bigint {
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = (negative ? text.slice(1) : text).split('.');
  const value = BigInt(whole) * MICRO + BigInt((fraction + '0'.repeat(SCALE)).slice(0, SCALE));
  return negative ? -value : value;
}

function fromMicro(value: bigint): string {
  const whole = value / MICRO;
  const fraction = (value % MICRO).toString().padStart(SCALE, '0').replace(/0+$/, '');
  return fraction === '' ? whole.toString() : `${whole}.${fraction}`;
}

function historyEntries(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body;
  const values = record(body)?.values;
  return Array.isArray(values) ? values : null;
}

/**
 * Suma de devoluciones verificadas (valor absoluto de los `total_paid_diff` negativos de las
 * entradas `PAID`). Una entrada `PAID` cuya diferencia no sea un string decimal estricto
 * invalida todo: no se omite ni se lee como cero.
 */
export function verifiedRefundSum(body: unknown): { status: 'ok'; sum: string } | { status: 'invalid' } {
  const entries = historyEntries(body);
  if (!entries) return { status: 'invalid' };
  let refunds = BigInt(0);
  for (const item of entries) {
    const entry = record(item);
    if (!entry) return { status: 'invalid' };
    const label = [entry.event, entry.type, entry.name, entry.status].find((value) => typeof value === 'string');
    if (typeof label !== 'string' || label.toUpperCase() !== 'PAID') continue;
    const diff = entry.total_paid_diff ?? record(entry.values)?.total_paid_diff ?? record(entry.data)?.total_paid_diff;
    if (typeof diff !== 'string' || !SIGNED.test(diff.trim())) return { status: 'invalid' };
    const value = toMicro(diff.trim());
    if (value < BigInt(0)) refunds -= value;
  }
  return { status: 'ok', sum: fromMicro(refunds) };
}

/**
 * Campos monetarios privados de un pedido, desde el objeto JSON decodificado (no desde
 * `ProjectedOrder`). `history` es el cuerpo de `history/values`; `undefined` = no se leyó.
 */
export function insightsMonetaryFields(input: {
  rawOrder: unknown; definition: MonetaryDefinition | null; history?: unknown;
}): InsightsMonetaryFields {
  if (input.definition === null) return UNVERIFIED;
  const paid = parseStrictAmount(record(input.rawOrder)?.total_paid_by_customer);
  if (paid === null) return INCOMPLETE;
  if (input.definition === 'tn_paid_current_observed_v1') {
    return { insights_amount: paid, insights_amount_status: 'verified', insights_amount_definition: input.definition };
  }
  if (input.history === undefined) return INCOMPLETE;
  const refunds = verifiedRefundSum(input.history);
  if (refunds.status !== 'ok') return INCOMPLETE;
  const net = toMicro(paid) - toMicro(refunds.sum);
  if (net < BigInt(0)) return INCONSISTENT;
  return { insights_amount: fromMicro(net), insights_amount_status: 'verified', insights_amount_definition: input.definition };
}
