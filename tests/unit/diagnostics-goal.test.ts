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

  it('el catálogo muestra nombres para el dueño, sin el código de Meta ni inferir compras de tipos desconocidos', () => {
    expect(catalog.map((option) => [option.action_type, option.label, option.fit])).toEqual([
      ['purchase', 'Compras', 'purchase'],
      ['lead', 'Clientes potenciales', 'inquiry'],
    ]);
    const unknown = actionTypeOptions([{ action_type: 'offsite_conversion.fb_pixel_custom_thing',
      observed_days: 1, total_count: '1' }])[0];
    expect(unknown).toMatchObject({ label: 'Otra acción: custom thing', fit: null });
    for (const option of catalog) expect(option.label).not.toContain(option.action_type);
  });

  it('las acciones recomendadas van primero y dos con el mismo nombre se distinguen sin código', () => {
    const options = actionTypeOptions([
      { action_type: 'add_to_cart', observed_days: 5, total_count: '9' },
      { action_type: 'offsite_conversion.fb_pixel_purchase', observed_days: 5, total_count: '9' },
      { action_type: 'omni_purchase', observed_days: 5, total_count: '9' },
      { action_type: 'leadgen_grouped', observed_days: 5, total_count: '9' },
      { action_type: 'onsite_conversion.lead_grouped', observed_days: 5, total_count: '9' },
      { action_type: 'offsite_conversion.custom.123456', observed_days: 5, total_count: '9' },
    ]);
    expect(options.map((o) => o.label)).toEqual([
      'Compras en todos los canales (web, app y tienda)',
      'Compras en tu sitio web',
      'Formularios completados en Facebook o Instagram',
      'Formularios completados en Facebook o Instagram (variante 2)',
      'Productos agregados al carrito',
      'Conversión personalizada',
    ]);
    expect(options.map((o) => o.label).join(' ')).not.toMatch(/[._]|\d{3,}/);
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
