import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  actionTypeOptions,
  GoalInputError,
  parseGoalInput,
} from '@/modules/diagnostics/settings';
import { diagnosticSettingsSchema } from '@/modules/diagnostics/contract';

const catalog = actionTypeOptions([
  { action_type: 'purchase', observed_days: 20, total_count: '40' },
  { action_type: 'lead', observed_days: 3, total_count: '5' },
]);

describe('M26a-T-01: objetivo y métrica representativa', () => {
  it('compra y consulta exigen un tipo de acción del catálogo observado', () => {
    expect(parseGoalInput({ goal_kind: 'purchase', action_type: 'purchase' }, catalog))
      .toEqual({ goal_kind: 'purchase', metric_ref: 'actions:purchase' });
    expect(parseGoalInput({ goal_kind: 'inquiry', action_type: 'lead' }, catalog))
      .toEqual({ goal_kind: 'inquiry', metric_ref: 'actions:lead' });
  });

  it('tráfico usa clics al enlace y no admite acción', () => {
    expect(parseGoalInput({ goal_kind: 'traffic' }, catalog))
      .toEqual({ goal_kind: 'traffic', metric_ref: 'inline_link_clicks' });
    expect(() => parseGoalInput({ goal_kind: 'traffic', action_type: 'purchase' }, catalog))
      .toThrow(GoalInputError);
  });

  it('rechaza objetivo fuera de lista, tipo desconocido o ausente', () => {
    expect(() => parseGoalInput({ goal_kind: 'ventas', action_type: 'purchase' }, catalog))
      .toThrow(GoalInputError);
    expect(() => parseGoalInput({ goal_kind: 'purchase', action_type: 'add_to_cart' }, catalog))
      .toThrow(GoalInputError);
    expect(() => parseGoalInput({ goal_kind: 'purchase' }, catalog)).toThrow(GoalInputError);
    expect(() => parseGoalInput({ goal_kind: 'purchase', action_type: 'compra con espacio' }, catalog))
      .toThrow(GoalInputError);
  });

  it('rechaza campos extra, incluido un company_id o connection_id del cliente (CA-00)', () => {
    expect(() => parseGoalInput({ goal_kind: 'traffic', company_id: crypto.randomUUID() }, catalog))
      .toThrow(GoalInputError);
    expect(() => parseGoalInput({ goal_kind: 'purchase', action_type: 'purchase',
      connection_id: crypto.randomUUID() }, catalog)).toThrow(GoalInputError);
    expect(() => parseGoalInput(null, catalog)).toThrow(GoalInputError);
  });

  it('sin acciones observadas solo tráfico es elegible', () => {
    const empty = actionTypeOptions([]);
    expect(empty).toEqual([]);
    expect(() => parseGoalInput({ goal_kind: 'purchase', action_type: 'purchase' }, empty))
      .toThrow(GoalInputError);
    expect(parseGoalInput({ goal_kind: 'traffic' }, empty).metric_ref).toBe('inline_link_clicks');
  });

  it('el catálogo muestra etiquetas conocidas sin inferir compras de tipos desconocidos', () => {
    expect(catalog.map((option) => [option.action_type, option.label])).toEqual([
      ['lead', 'Cliente potencial (lead)'],
      ['purchase', 'Compra (purchase)'],
    ]);
    expect(actionTypeOptions([{ action_type: 'offsite_conversion.fb_pixel_custom',
      observed_days: 1, total_count: '1' }])[0].label).toBe('offsite_conversion.fb_pixel_custom');
  });

  it('el esquema persistido exige el par coherente', () => {
    expect(diagnosticSettingsSchema.safeParse({ goal_kind: 'traffic', metric_ref: 'actions:purchase' }).success)
      .toBe(false);
    expect(diagnosticSettingsSchema.safeParse({ goal_kind: 'purchase', metric_ref: 'inline_link_clicks' }).success)
      .toBe(false);
    expect(diagnosticSettingsSchema.safeParse({ goal_kind: 'purchase', metric_ref: 'actions:purchase', x: 1 }).success)
      .toBe(false);
  });
});
