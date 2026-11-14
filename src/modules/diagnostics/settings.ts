import { z } from 'zod';

import {
  ACTION_TYPE_PATTERN,
  GOAL_KINDS,
  type ActionTypeRow,
  type DiagnosticSettings,
} from './contract';

/**
 * Objetivo del diagnóstico: el dueño elige de la lista que arma el servidor con el catálogo
 * observado. No hay texto libre que se convierta en métrica ni se infiere una compra de un tipo
 * desconocido (§16.2). El formulario no lleva company_id ni connection_id (CA-00).
 */

export class GoalInputError extends Error {
  constructor() {
    super('El objetivo elegido no es válido.');
    this.name = 'GoalInputError';
  }
}

/** Objetivo para el que una acción es la opción natural; `null` si no encaja en ninguno. */
export type GoalFit = 'purchase' | 'inquiry' | null;

export type ActionTypeOption = Readonly<{ action_type: string; label: string; observed_days: number; fit: GoalFit }>;

/**
 * Nombres en castellano llano para el dueño, sin el código técnico de Meta. El orden dentro de
 * cada objetivo es el de preferencia: la primera observada se sugiere por defecto.
 */
const FRIENDLY: ReadonlyArray<readonly [string, string, GoalFit]> = [
  ['purchase', 'Compras', 'purchase'],
  ['omni_purchase', 'Compras en todos los canales (web, app y tienda)', 'purchase'],
  ['offsite_conversion.fb_pixel_purchase', 'Compras en tu sitio web', 'purchase'],
  ['onsite_web_purchase', 'Compras en tu sitio web registradas por Meta', 'purchase'],
  ['onsite_conversion.purchase', 'Compras dentro de Facebook o Instagram', 'purchase'],
  ['web_in_store_purchase', 'Compras en tu local', 'purchase'],
  ['app_custom_event.fb_mobile_purchase', 'Compras en tu app', 'purchase'],
  ['onsite_conversion.messaging_conversation_started_7d', 'Conversaciones iniciadas por mensaje', 'inquiry'],
  ['lead', 'Clientes potenciales', 'inquiry'],
  ['onsite_conversion.lead_grouped', 'Formularios completados en Facebook o Instagram', 'inquiry'],
  ['leadgen_grouped', 'Formularios completados en Facebook o Instagram', 'inquiry'],
  ['offsite_conversion.fb_pixel_lead', 'Formularios completados en tu sitio web', 'inquiry'],
  ['onsite_conversion.total_messaging_connection', 'Contactos por mensaje', 'inquiry'],
  ['onsite_conversion.messaging_first_reply', 'Primeras respuestas por mensaje', 'inquiry'],
  ['contact_total', 'Contactos', 'inquiry'],
  ['contact_website', 'Contactos desde tu sitio web', 'inquiry'],
  ['offsite_conversion.fb_pixel_contact', 'Contactos desde tu sitio web', 'inquiry'],
  ['schedule_total', 'Citas agendadas', 'inquiry'],
  ['submit_application_total', 'Solicitudes enviadas', 'inquiry'],
  ['complete_registration', 'Registros completados', 'inquiry'],
  ['offsite_conversion.fb_pixel_complete_registration', 'Registros completados en tu sitio web', 'inquiry'],
  ['add_to_cart', 'Productos agregados al carrito', null],
  ['omni_add_to_cart', 'Productos agregados al carrito (todos los canales)', null],
  ['offsite_conversion.fb_pixel_add_to_cart', 'Productos agregados al carrito en tu sitio web', null],
  ['initiate_checkout', 'Pagos iniciados', null],
  ['omni_initiated_checkout', 'Pagos iniciados (todos los canales)', null],
  ['offsite_conversion.fb_pixel_initiate_checkout', 'Pagos iniciados en tu sitio web', null],
  ['add_payment_info', 'Datos de pago cargados', null],
  ['offsite_conversion.fb_pixel_add_payment_info', 'Datos de pago cargados en tu sitio web', null],
  ['view_content', 'Vistas de producto', null],
  ['omni_view_content', 'Vistas de producto (todos los canales)', null],
  ['offsite_conversion.fb_pixel_view_content', 'Vistas de producto en tu sitio web', null],
  ['search', 'Búsquedas', null],
  ['offsite_conversion.fb_pixel_search', 'Búsquedas en tu sitio web', null],
  ['add_to_wishlist', 'Productos guardados en favoritos', null],
  ['offsite_conversion.fb_pixel_custom', 'Conversiones personalizadas', null],
  ['link_click', 'Clics en el enlace', null],
  ['landing_page_view', 'Visitas a tu página', null],
  ['page_engagement', 'Interacciones con tu página', null],
  ['post_engagement', 'Interacciones con tus publicaciones', null],
  ['post_reaction', 'Reacciones', null],
  ['comment', 'Comentarios', null],
  ['post', 'Veces que se compartió', null],
  ['onsite_conversion.post_save', 'Publicaciones guardadas', null],
  ['like', 'Nuevos seguidores de tu página', null],
  ['video_view', 'Reproducciones de video', null],
  ['photo_view', 'Vistas de fotos', null],
];
const FRIENDLY_BY_TYPE = new Map(FRIENDLY.map(([type, label, fit], rank) => [type, { label, fit, rank }]));

/** Nombre para el dueño; una acción sin traducción se describe sin prefijos técnicos. */
export function goalActionLabel(actionType: string): string {
  const known = FRIENDLY_BY_TYPE.get(actionType);
  if (known) return known.label;
  if (actionType.startsWith('offsite_conversion.custom.')) return 'Conversión personalizada';
  const words = actionType
    .replace(/^(offsite_conversion\.fb_pixel_|offsite_conversion\.|onsite_conversion\.|onsite_web_|omni_|app_custom_event\.fb_mobile_)/, '')
    .replace(/[._]+/g, ' ').trim();
  return words ? `Otra acción: ${words}` : 'Otra acción';
}

export function actionTypeOptions(rows: readonly ActionTypeRow[]): ActionTypeOption[] {
  const options = rows
    .filter((row) => ACTION_TYPE_PATTERN.test(row.action_type) && row.observed_days > 0)
    .map((row) => ({ row, known: FRIENDLY_BY_TYPE.get(row.action_type) }))
    .sort((a, b) => (a.known?.rank ?? Infinity) - (b.known?.rank ?? Infinity)
      || (a.row.action_type < b.row.action_type ? -1 : a.row.action_type > b.row.action_type ? 1 : 0))
    .map(({ row, known }) => ({ action_type: row.action_type, label: goalActionLabel(row.action_type),
      observed_days: row.observed_days, fit: known?.fit ?? null }));
  // Dos acciones distintas con el mismo nombre se distinguen sin mostrar el código.
  const seen = new Map<string, number>();
  return options.map((option) => {
    const n = (seen.get(option.label) ?? 0) + 1;
    seen.set(option.label, n);
    return n === 1 ? option : { ...option, label: `${option.label} (variante ${n})` };
  });
}

const goalInputSchema = z.strictObject({
  goal_kind: z.enum(GOAL_KINDS),
  action_type: z.string().regex(ACTION_TYPE_PATTERN).optional(),
});

export function parseGoalInput(raw: unknown, catalog: readonly ActionTypeOption[]): DiagnosticSettings {
  const parsed = goalInputSchema.safeParse(raw);
  if (!parsed.success) throw new GoalInputError();
  const { goal_kind: goalKind, action_type: actionType } = parsed.data;
  if (goalKind === 'traffic') {
    if (actionType !== undefined) throw new GoalInputError();
    return { goal_kind: 'traffic', metric_ref: 'inline_link_clicks' };
  }
  if (actionType === undefined || !catalog.some((option) => option.action_type === actionType)) {
    throw new GoalInputError();
  }
  return { goal_kind: goalKind, metric_ref: `actions:${actionType}` };
}

/**
 * Último día de la ventana del catálogo de acciones: el `window_to` de la elegibilidad si existe;
 * si no, ayer en UTC. La lectura acota a 28 días (CA-41); la lista solo ofrece opciones.
 */
export function catalogWindowTo(windowTo: string | null, now: Date = new Date()): string {
  if (windowTo) return windowTo;
  return new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
}
