/**
 * Reglas y textos fijos de M27a (spec §1, §4, §7 y §8). Sin red, sin entorno, sin texto de
 * Tiendanube: todo lo que la pantalla dice sale de este catálogo cerrado.
 */

import type { CriterionCode, CustomerInsightsView, DefinitionCode, ProposalId, SegmentCode } from './contract';

export const RULESET = 'rfm_v1' as const;
export const AUDIENCE_RULES_VERSION = 'audience_rules_v1' as const;

/** Orden de prioridad de la partición exclusiva (§4). */
export const SEGMENT_PRIORITY = ['inactivos', 'riesgo', 'nuevos', 'alto_valor', 'frecuentes', 'potencial'] as const;

export const SEGMENT_TEXT: Readonly<Record<SegmentCode, Readonly<{ label: string; rule: string }>>> = Object.freeze({
  inactivos: { label: 'Inactivos', rule: 'Su última compra fue hace más de 180 días (dentro de la ventana de 365).' },
  riesgo: { label: 'En riesgo', rule: 'Su última compra fue hace entre 91 y 180 días.' },
  nuevos: { label: 'Nuevos', rule: 'Una sola compra, en los últimos 30 días.' },
  alto_valor: { label: 'Alto valor', rule: 'Compraron en los últimos 90 días, al menos dos veces, y su valor está en el cuartil más alto de la tienda.' },
  frecuentes: { label: 'Frecuentes', rule: 'Compraron en los últimos 90 días, al menos tres veces.' },
  potencial: { label: 'Potencial', rule: 'El resto de los compradores identificados de la ventana.' },
});

export const DEFINITION_TEXT: Readonly<Record<DefinitionCode | 'segment_partition_v1' | 'cohorts_observed_v1' | 'cross_sell_pair_v1', string>> = Object.freeze({
  segment_total_customers_v1: 'Compradores identificados con al menos un pedido pagado en la ventana de 365 días.',
  excluded_before_window_v1: 'Compradores cuya última compra es anterior a la ventana; no se clasifican.',
  segment_customers_v1: 'Compradores identificados del segmento.',
  segment_orders_v1: 'Pedidos pagados del segmento dentro de la ventana.',
  segment_monetary_v1: 'Suma del valor monetario validado de esos pedidos.',
  segment_monetary_per_customer_v1: 'Valor monetario del segmento dividido por sus compradores.',
  segment_monetary_per_order_v1: 'Valor monetario del segmento dividido por sus pedidos.',
  segment_recency_median_days_v1: 'Mediana de días desde la última compra hasta el corte.',
  segment_frequency_mean_v1: 'Promedio de pedidos por comprador en la ventana.',
  cohort_size_observed_v1: 'Compradores cuya primera compra observada fue en ese mes.',
  cohort_active_v1: 'Compradores de la cohorte con al menos un pedido pagado en el mes.',
  cohort_retention_v1: 'Activos del mes divididos por el tamaño de la cohorte.',
  cohort_repeat_cumulative_v1: 'Compradores de la cohorte con dos o más pedidos hasta ese mes, sobre el tamaño de la cohorte.',
  cohort_observed_value_v1: 'Valor monetario validado de los pedidos de la cohorte en el mes. No es LTV.',
  cohort_ticket_v1: 'Valor observado del mes dividido por sus pedidos.',
  cohort_observed_value_per_customer_cumulative_v1: 'Valor observado acumulado hasta ese mes, sobre el tamaño de la cohorte. No es LTV.',
  cohort_mean_days_between_purchases_v1: 'Promedio de días entre compras consecutivas de quienes repiten; el denominador son los intervalos.',
  cohort_repeat_customers_v1: 'Compradores de la cohorte que repitieron hasta ese mes.',
  cohort_purchase_intervals_v1: 'Intervalos entre compras consecutivas usados en el promedio.',
  proposal_identified_customers_v1: 'Compradores identificados del grupo ya publicado. No es alcance publicitario.',
  segment_partition_v1: 'Partición exclusiva rfm_v1 de los compradores identificados de la ventana.',
  cohorts_observed_v1: 'Cohortes mensuales por primera compra observada, últimas 24, meses 0 a 12.',
  cross_sell_pair_v1: 'Par de productos con co-compra observada y muestra suficiente dentro del segmento.',
});

export const ABSENCE_TEXT = Object.freeze({
  sin_cobertura: 'Sin cobertura de sincronización',
  periodo_abierto: 'Mes en curso o futuro',
  monetario_no_validado: 'Monetario no validado',
  dato_incompleto: 'Datos incompletos',
  privacidad: 'Oculto para proteger grupos pequeños',
  sin_denominador: 'Sin base para calcular',
});

type ProposalText = Readonly<{
  name: string;
  objective: string;
  justification: string;
  suggestedStrategy: string;
  limitations: readonly string[];
  inclusion: readonly CriterionCode[];
  exclusion: readonly CriterionCode[];
}>;

const NOT_OPERATIVE = 'PRAXA no crea, exporta ni sincroniza esta audiencia: es una propuesta para revisar.';
const NOT_REACH = 'La cantidad identificada no es alcance publicitario ni predice resultados.';
const OBSERVED = 'Se basa en compras observadas de los últimos 365 días; no predice comportamiento.';

const others = (keep: SegmentCode): CriterionCode[] =>
  SEGMENT_PRIORITY.filter((code) => code !== keep).map((code) => `segment_${code}` as CriterionCode);

export const PROPOSAL_CATALOG: Readonly<Record<ProposalId, ProposalText>> = Object.freeze({
  fidelizacion_v1: {
    name: 'Fidelización de alto valor',
    objective: 'Sostener la relación con quienes más compran y más valor aportan.',
    justification: 'El segmento de alto valor reúne compradores recientes, recurrentes y con valor en el cuartil superior de la tienda.',
    suggestedStrategy: 'Considerar un mensaje de agradecimiento o beneficio exclusivo. No implica presupuesto ni eficiencia esperada.',
    limitations: [NOT_OPERATIVE, NOT_REACH, OBSERVED],
    inclusion: ['segment_alto_valor'],
    exclusion: others('alto_valor'),
  },
  remarketing_v1: {
    name: 'Remarketing a compradores con potencial',
    objective: 'Recordar la propuesta de valor a compradores que todavía no repiten con frecuencia.',
    justification: 'El segmento potencial tiene compras recientes o pocas compras; la recompra observada de las cohortes da contexto.',
    suggestedStrategy: 'Probar un recordatorio de reposición o de la propuesta de valor, como hipótesis comercial a validar.',
    limitations: [NOT_OPERATIVE, NOT_REACH, OBSERVED],
    inclusion: ['segment_potencial'],
    exclusion: others('potencial'),
  },
  reactivacion_riesgo_v1: {
    name: 'Reactivación de compradores en riesgo',
    objective: 'Invitar a volver a quienes hace entre 91 y 180 días que no compran.',
    justification: 'La recencia del segmento muestra que pasó tiempo desde su última compra.',
    suggestedStrategy: 'Considerar un mensaje de regreso. No afirma que hayan abandonado la tienda.',
    limitations: [NOT_OPERATIVE, NOT_REACH, OBSERVED],
    inclusion: ['segment_riesgo'],
    exclusion: others('riesgo'),
  },
  reactivacion_inactivos_v1: {
    name: 'Reactivación de inactivos de la ventana',
    objective: 'Recuperar compradores de la ventana cuya última compra fue hace más de 180 días.',
    justification: 'La recencia del segmento supera los 180 días dentro de los 365 analizados.',
    suggestedStrategy: 'Considerar un mensaje de regreso con un motivo concreto. No incluye compradores fuera de la cobertura.',
    limitations: [NOT_OPERATIVE, NOT_REACH, OBSERVED, 'Quienes compraron antes de la ventana no forman parte de este grupo.'],
    inclusion: ['segment_inactivos'],
    exclusion: others('inactivos'),
  },
  exclusion_adquisicion_v1: {
    name: 'Exclusión de clientes actuales en adquisición',
    objective: 'Evitar mostrar campañas de adquisición a quienes ya compraron.',
    justification: 'Hay compradores identificados con al menos un pedido pagado en la ventana.',
    suggestedStrategy: 'Considerar a estos compradores como exclusión en campañas de adquisición. PRAXA no aplica la exclusión.',
    limitations: [NOT_OPERATIVE, NOT_REACH, 'Los pedidos sin comprador identificado no forman parte del grupo.'],
    inclusion: ['comprador_identificado_365d'],
    exclusion: [],
  },
  similares_alto_valor_v1: {
    name: 'Semilla para públicos similares',
    objective: 'Usar el grupo de alto valor como posible semilla de públicos similares.',
    justification: 'El segmento de alto valor describe a los compradores que más aportan a la tienda.',
    suggestedStrategy: 'Evaluar el grupo como semilla. PRAXA no valida requisitos, coincidencias ni tamaño utilizable en Meta.',
    limitations: [NOT_OPERATIVE, NOT_REACH, 'El tamaño utilizable lo determina la plataforma publicitaria, no PRAXA.'],
    inclusion: ['segment_alto_valor'],
    exclusion: others('alto_valor'),
  },
  venta_cruzada_v1: {
    name: 'Venta cruzada observada',
    objective: 'Revisar si quienes compraron un producto podrían interesarse en otro que suele comprarse junto.',
    justification: 'Dentro del segmento hay co-compra observada de los dos productos, con muestra suficiente.',
    suggestedStrategy: 'Revisar la complementariedad observada antes de cualquier campaña. No afirma intención ni rentabilidad.',
    limitations: [NOT_OPERATIVE, 'No se publica cuántos compradores forman el grupo para proteger grupos pequeños.', OBSERVED],
    inclusion: ['segment_frecuentes', 'compro_producto_a'],
    exclusion: ['no_compro_producto_b'],
  },
});

/** Mensajes fijos por estado de vista (§8). `listo` no lleva mensaje. */
export const VIEW_MESSAGES: Readonly<Record<CustomerInsightsView['kind'], string | null>> = Object.freeze({
  sin_empresa: 'Creá tu empresa para analizar tus clientes.',
  sin_conexion: 'Conectá Tiendanube para analizar tus clientes',
  requiere_reauth: 'Tiendanube rechazó el acceso. Volvé a conectar la tienda para analizar tus clientes.',
  actualizando: 'El análisis se está actualizando',
  sin_cobertura: 'Completá la sincronización para obtener cobertura',
  sin_compras: 'No hay compras elegibles en el período',
  monetario_no_validado: 'El componente monetario todavía no está validado',
  calidad_insuficiente: 'Los datos de la tienda no alcanzan para el análisis completo.',
  privacidad: 'No se muestran estos agregados para proteger grupos pequeños',
  listo: null,
  error: 'No pudimos cargar el análisis',
});

export type Freshness = 'al_dia' | 'advertencia' | 'vencido';

const DAY_MS = 86_400_000;

/** D-M27a-08: ≤24 h sin aviso; ≤7 días con aviso; más, propuestas bloqueadas. */
export function freshnessOf(fetchedAt: string, nowMs: number): Freshness {
  const elapsed = nowMs - Date.parse(fetchedAt);
  if (!Number.isFinite(elapsed) || elapsed > 7 * DAY_MS) return 'vencido';
  return elapsed > DAY_MS ? 'advertencia' : 'al_dia';
}

// ---------------------------------------------------------------------------
// Presentación: el redondeo ocurre solo al mostrar, sobre el string exacto.
// ---------------------------------------------------------------------------

export const ABSENCE_SHORT = Object.freeze({
  sin_cobertura: 'Sin cobertura',
  periodo_abierto: 'Mes abierto',
  monetario_no_validado: 'Monetario no validado',
  dato_incompleto: 'Incompleto',
  privacidad: 'Oculto',
  sin_denominador: 'Sin base',
});

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

/** `AAAA-MM-DD` → «16 nov 2025». */
export function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** `AAAA-MM` → «sep 2026». */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Redondeo half-up de un decimal no negativo en string, con `places` decimales exactos. */
function roundDecimal(value: string, places: number): string {
  const [whole, fraction = ''] = value.split('.');
  const kept = (fraction + '0'.repeat(places + 1)).slice(0, places + 1);
  let scaled = BigInt(whole + kept.slice(0, places)) * BigInt(1);
  if (Number(kept[places]) >= 5) scaled += BigInt(1);
  const digits = scaled.toString().padStart(places + 1, '0');
  return places === 0 ? digits : `${digits.slice(0, -places)}.${digits.slice(-places)}`;
}

function grouped(text: string, trimZeros: boolean): string {
  let [whole, fraction = ''] = text.split('.');
  if (trimZeros) fraction = fraction.replace(/0+$/, '');
  whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return fraction === '' ? whole : `${whole},${fraction}`;
}

/** Ratio exacto (0..1) como porcentaje con un decimal: «58,3 %». */
export function formatPercent(ratio: string): string {
  const [whole, fraction = ''] = ratio.split('.');
  const shifted = `${whole}${fraction.padEnd(2, '0').slice(0, 2)}.${fraction.slice(2)}`.replace(/\.$/, '');
  return `${grouped(roundDecimal(shifted.replace(/^0+(?=\d)/, ''), 1), true)} %`;
}

export type DisplayMetric = Readonly<{ value: string | null; absence: keyof typeof ABSENCE_SHORT | null;
  unit: 'customers' | 'orders' | 'currency' | 'days' | 'ratio' | 'orders_per_customer' | 'intervals' }>;

/** Texto visible de una métrica; una ausencia muestra su motivo, nunca un cero. */
export function formatMetric(metric: DisplayMetric, length: 'long' | 'short' = 'long'): string {
  if (metric.value === null) {
    const absence = metric.absence ?? 'dato_incompleto';
    return length === 'short' ? ABSENCE_SHORT[absence] : ABSENCE_TEXT[absence];
  }
  switch (metric.unit) {
    case 'customers': case 'orders': case 'intervals': return grouped(metric.value, true);
    case 'currency': return grouped(roundDecimal(metric.value, 2), false);
    case 'ratio': return formatPercent(metric.value);
    default: return grouped(roundDecimal(metric.value, 1), true);
  }
}
