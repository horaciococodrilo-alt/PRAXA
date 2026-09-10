import { describe, expect, it } from 'vitest';

import {
  CONTEXT_SCHEMA_VERSION,
  checkReadyForActivation,
  companyStepSchema,
  contextStepSchema,
  objectiveInputSchema,
  objectivesStepSchema,
  systemsStepSchema,
} from '@/modules/onboarding/schema';

describe('esquemas del onboarding', () => {
  it('versiona el contexto por separado del reporte', () => {
    expect(CONTEXT_SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('exige un nombre de empresa razonable', () => {
    expect(companyStepSchema.safeParse({ name: 'Mi Tienda' }).success).toBe(true);
    expect(companyStepSchema.safeParse({ name: ' ' }).success).toBe(false);
    expect(companyStepSchema.safeParse({ name: 'a' }).success).toBe(false);
  });

  it('acepta un objetivo sin indicador ni meta', () => {
    const parsed = objectiveInputSchema.safeParse({
      kind: 'primary',
      title: 'Vender más los fines de semana',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.indicator_name).toBeNull();
    expect(parsed.data.target_value).toBeNull();
  });

  it('rechaza una meta sin indicador que la haga interpretable', () => {
    const parsed = objectiveInputSchema.safeParse({
      kind: 'primary',
      title: 'Mejorar la conversión',
      target_value: 3,
    });

    expect(parsed.success).toBe(false);
  });

  it('permite declarar que todavía no hay un objetivo definido', () => {
    const parsed = objectivesStepSchema.safeParse({
      has_defined_objective: false,
      objectives: [],
    });

    expect(parsed.success).toBe(true);
  });

  it('rechaza "sin objetivo definido" con objetivos cargados', () => {
    const parsed = objectivesStepSchema.safeParse({
      has_defined_objective: false,
      objectives: [{ kind: 'primary', title: 'Un objetivo cualquiera' }],
    });

    expect(parsed.success).toBe(false);
  });

  it('rechaza dos objetivos principales', () => {
    const parsed = objectivesStepSchema.safeParse({
      has_defined_objective: true,
      objectives: [
        { kind: 'primary', title: 'Primero' },
        { kind: 'primary', title: 'Segundo' },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it('acepta un borrador incompleto: un objetivo declarado y ninguno cargado todavía', () => {
    // Guardar no exige integridad total. La completitud se valida al confirmar.
    const parsed = objectivesStepSchema.safeParse({
      has_defined_objective: true,
      objectives: [],
    });

    expect(parsed.success).toBe(true);
  });

  it('valida el identificador de sistema', () => {
    expect(systemsStepSchema.safeParse({ systems: [{ system_key: 'shopify' }] }).success).toBe(
      true,
    );
    expect(systemsStepSchema.safeParse({ systems: [{ system_key: 'Shopify!' }] }).success).toBe(
      false,
    );
  });

  it('normaliza texto vacío a null en lugar de guardar cadenas en blanco', () => {
    const parsed = contextStepSchema.safeParse({
      problems: [],
      constraints: [],
      additional_context: '   ',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.additional_context).toBeNull();
  });
});

describe('checkReadyForActivation', () => {
  it('acepta "sin objetivo definido" sin objetivos', () => {
    expect(checkReadyForActivation({ has_defined_objective: false, objectives: [] })).toEqual({
      ready: true,
    });
  });

  it('acepta exactamente un principal', () => {
    expect(
      checkReadyForActivation({
        has_defined_objective: true,
        objectives: [{ kind: 'primary' }, { kind: 'secondary' }],
      }),
    ).toEqual({ ready: true });
  });

  it('rechaza objetivo declarado sin ningún objetivo', () => {
    const result = checkReadyForActivation({ has_defined_objective: true, objectives: [] });
    expect(result.ready).toBe(false);
  });

  it('rechaza objetivos sin ninguno marcado como principal', () => {
    const result = checkReadyForActivation({
      has_defined_objective: true,
      objectives: [{ kind: 'secondary' }],
    });
    expect(result.ready).toBe(false);
  });

  it('rechaza "sin objetivo definido" con objetivos', () => {
    const result = checkReadyForActivation({
      has_defined_objective: false,
      objectives: [{ kind: 'primary' }],
    });
    expect(result.ready).toBe(false);
  });
});
