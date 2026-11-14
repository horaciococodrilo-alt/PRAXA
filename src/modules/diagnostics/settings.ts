import { z } from 'zod';

import { actionLabel } from '@/modules/chat/tools/action-labels';

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

export type ActionTypeOption = Readonly<{ action_type: string; label: string; observed_days: number }>;

export function actionTypeOptions(rows: readonly ActionTypeRow[]): ActionTypeOption[] {
  return rows
    .filter((row) => ACTION_TYPE_PATTERN.test(row.action_type) && row.observed_days > 0)
    .map((row) => ({ action_type: row.action_type, label: actionLabel(row.action_type),
      observed_days: row.observed_days }))
    .sort((a, b) => (a.action_type < b.action_type ? -1 : a.action_type > b.action_type ? 1 : 0));
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
