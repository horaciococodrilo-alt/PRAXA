import { describe, expect, it } from 'vitest';

import {
  METHODOLOGY_VERSION,
  PLAN_STAGES,
  REPORT_SCHEMA_VERSION,
  validateReport,
  type PraxaReport,
} from '@/modules/reporting/contract';

/**
 * Estos datos NO son datos del producto: son un caso de prueba construido a mano para
 * ejercitar el contrato. Ningún reporte real se genera todavía.
 */

const CONTEXT_VERSION_ID = '4f1a7c2e-1b2c-4d5e-8f90-0a1b2c3d4e5f';
const OBJECTIVE_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const COMPANY_ID = '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f';

function buildReport(): PraxaReport {
  return {
    report_schema_version: REPORT_SCHEMA_VERSION,
    methodology_version: METHODOLOGY_VERSION,
    company_id: COMPANY_ID,
    generated_at: '2026-09-09T12:00:00.000Z',

    evidence: [
      {
        kind: 'user_statement',
        id: 'ev_objetivo_declarado',
        statement: 'El dueño declaró querer aumentar la conversión del checkout.',
        source_field: 'objective.title',
        stated_at: '2026-09-01T10:00:00.000Z',
        context_version_id: CONTEXT_VERSION_ID,
      },
      {
        kind: 'calculated_metric',
        id: 'ev_conversion_checkout',
        statement: 'La conversión del checkout fue de 1,8% en el período analizado.',
        metric_id: 'me_conversion_checkout',
        metric_key: 'checkout.conversion_rate',
        value: 1.8,
        unit: '%',
        period: { from: '2026-08-01', to: '2026-08-31' },
        computed_at: '2026-09-09T11:55:00.000Z',
        computation: {
          method_id: 'checkout_conversion_rate',
          method_version: '1.0.0',
          inputs: ['orders.completed', 'checkout.sessions'],
        },
        coverage: {
          records_considered: 12_430,
          records_expected: 12_500,
          notes: 'Se excluyeron 70 sesiones sin identificador de canal.',
        },
      },
      {
        kind: 'inference',
        id: 'ev_friccion_checkout',
        statement: 'La caída se concentra en el paso de pago.',
        derived_from: ['ev_conversion_checkout'],
        confidence: 'medium',
        reasoning:
          'La conversión cae bruscamente entre el paso de envío y el de pago, no antes.',
      },
    ],

    objectives_and_context: {
      context_version_id: CONTEXT_VERSION_ID,
      context_schema_version: '1.0.0',
      context_version_number: 1,
      company_name: 'Tienda de prueba',
      has_defined_objective: true,
      objectives: [
        {
          id: OBJECTIVE_ID,
          kind: 'primary',
          title: 'Aumentar la conversión del checkout',
          priority: 'high',
          horizon: 'short',
          indicator_name: 'Tasa de conversión de checkout',
          target_value: 3,
          target_unit: '%',
        },
      ],
      systems: [{ system_key: 'shopify', label: 'Shopify' }],
      problems: ['Muchos carritos abandonados en el paso de pago.'],
      constraints: ['Equipo de tres personas.'],
      additional_context: null,
    },

    current_situation: {
      period: { from: '2026-08-01', to: '2026-08-31' },
      metric_refs: ['ev_conversion_checkout'],
      coverage: {
        summary: 'Un mes completo de sesiones de checkout.',
        connected_systems: ['shopify'],
        gaps: ['No hay datos de publicidad: ninguna cuenta conectada.'],
      },
    },

    analysis: {
      summary: 'La conversión cae de forma marcada en el paso de pago.',
      findings: [
        {
          id: 'fi_caida_en_pago',
          title: 'Caída de conversión en el paso de pago',
          description: 'De cada 100 sesiones que llegan a pago, menos de 2 completan.',
          evidence_refs: ['ev_conversion_checkout', 'ev_friccion_checkout'],
          relates_to_objectives: [OBJECTIVE_ID],
          severity: 'high',
        },
      ],
    },

    prioritized_improvements: {
      prioritization_criteria: 'Impacto sobre el objetivo principal y esfuerzo estimado.',
      improvements: [
        {
          id: 'im_simplificar_pago',
          contributes_to: { known: true, value: OBJECTIVE_ID },
          problem_or_opportunity: 'El paso de pago pide datos que no son necesarios.',
          finding_refs: ['fi_caida_en_pago'],
          evidence_refs: ['ev_conversion_checkout'],
          proposed_action: 'Reducir los campos obligatorios del formulario de pago.',
          steps: [
            { order: 1, description: 'Relevar qué campos son obligatorios hoy.' },
            { order: 2, description: 'Quitar los que no se usan para facturar ni enviar.' },
          ],
          priority: 'high',
          priority_rationale: 'Ataca directamente el punto donde se pierde la mayoría.',
          depends_on: [],
          suggested_owner: 'Responsable de la tienda',
          estimated_timeframe: { known: true, value: { value: 2, unit: 'weeks' } },
          success_indicator: {
            name: 'Tasa de conversión de checkout',
            definition: 'Pedidos completados sobre sesiones que llegaron al checkout.',
            unit: '%',
            baseline: { known: true, value: 1.8 },
            target: { known: false, reason: 'no_reliable_basis' },
          },
          expected_impact: {
            known: false,
            reason: 'insufficient_history',
            detail: 'Un solo mes de datos no alcanza para estimar el efecto.',
          },
          assumptions: [],
          uncertainties: ['No sabemos qué proporción abandona por el medio de pago.'],
          missing_information: ['Desglose de abandono por medio de pago.'],
        },
      ],
    },

    implementation_plan: {
      methodology_version: METHODOLOGY_VERSION,
      stages: [
        {
          stage: 'prepare_data',
          state: 'insufficient_information',
          explanation: 'No hay ninguna integración conectada todavía.',
          missing_information: ['Acceso de solo lectura a la plataforma de ecommerce.'],
        },
        {
          stage: 'initial_improvements',
          state: 'planned',
          summary: 'Simplificar el formulario de pago.',
          improvement_refs: ['im_simplificar_pago'],
          sequencing_notes: null,
        },
        {
          stage: 'broader_improvements',
          state: 'not_applicable',
          explanation: 'No hay evidencia suficiente para justificar cambios de mayor alcance.',
        },
        {
          stage: 'evaluate_and_adjust',
          state: 'planned',
          summary: 'Medir la conversión un mes después del cambio.',
          improvement_refs: ['im_simplificar_pago'],
          sequencing_notes: 'Requiere que la etapa anterior esté aplicada.',
        },
      ],
    },

    measurement_and_review: {
      indicators: [
        {
          improvement_ref: 'im_simplificar_pago',
          indicator_name: 'Tasa de conversión de checkout',
          measurement_method: 'Recalcular la métrica sobre el mes posterior al cambio.',
          first_measurement_at: { known: false, reason: 'integration_missing' },
        },
      ],
      review_cadence: 'monthly',
      next_review_at: { known: false, reason: 'integration_missing' },
      notes: null,
    },
  };
}

/** Aplica una mutación sobre una copia profunda del reporte válido. */
function mutate(change: (report: PraxaReport) => void): unknown {
  const draft = structuredClone(buildReport());
  change(draft);
  return draft;
}

function expectRejected(input: unknown) {
  const result = validateReport(input);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('se esperaba un rechazo');
  return result.issues;
}

describe('contrato del reporte', () => {
  it('acepta un reporte completo y coherente', () => {
    const result = validateReport(buildReport());
    if (!result.ok) {
      throw new Error(`debería validar, pero falló: ${JSON.stringify(result.issues, null, 2)}`);
    }
    expect(result.report.report_schema_version).toBe(REPORT_SCHEMA_VERSION);
  });

  it('exige las seis secciones', () => {
    const sections = [
      'objectives_and_context',
      'current_situation',
      'analysis',
      'prioritized_improvements',
      'implementation_plan',
      'measurement_and_review',
    ] as const;

    for (const section of sections) {
      const issues = expectRejected(
        mutate((report) => {
          delete (report as Record<string, unknown>)[section];
        }),
      );
      expect(issues.some((issue) => issue.path.startsWith(section))).toBe(true);
    }
  });

  it('exige las cuatro etapas de la metodología, en orden', () => {
    expectRejected(
      mutate((report) => {
        report.implementation_plan.stages = report.implementation_plan.stages.slice(0, 3);
      }),
    );

    const issues = expectRejected(
      mutate((report) => {
        report.implementation_plan.stages.reverse();
      }),
    );
    expect(issues.some((issue) => issue.message.includes('metodología'))).toBe(true);

    expect(PLAN_STAGES).toHaveLength(4);
  });

  it('rechaza una etapa "no aplica" sin explicación', () => {
    expectRejected(
      mutate((report) => {
        report.implementation_plan.stages[2] = {
          stage: 'broader_improvements',
          state: 'not_applicable',
        } as never;
      }),
    );
  });

  it('rechaza una etapa "falta información" sin decir qué falta', () => {
    expectRejected(
      mutate((report) => {
        report.implementation_plan.stages[0] = {
          stage: 'prepare_data',
          state: 'insufficient_information',
          explanation: 'Falta información.',
          missing_information: [],
        } as never;
      }),
    );
  });

  it('rechaza una mejora sin evidencias', () => {
    expectRejected(
      mutate((report) => {
        report.prioritized_improvements.improvements[0].evidence_refs = [];
      }),
    );
    expectRejected(
      mutate((report) => {
        report.prioritized_improvements.improvements[0].finding_refs = [];
      }),
    );
  });

  it('rechaza un hallazgo sin evidencia que lo respalde', () => {
    expectRejected(
      mutate((report) => {
        report.analysis.findings[0].evidence_refs = [];
      }),
    );
  });

  it('rechaza un dato desconocido sin motivo declarado', () => {
    const issues = expectRejected(
      mutate((report) => {
        report.prioritized_improvements.improvements[0].estimated_timeframe = {
          known: false,
        } as never;
      }),
    );
    expect(issues.some((issue) => issue.path.includes('estimated_timeframe'))).toBe(true);
  });

  describe('integridad referencial', () => {
    it('rechaza una referencia colgante a evidencia', () => {
      const issues = expectRejected(
        mutate((report) => {
          report.analysis.findings[0].evidence_refs = ['ev_no_existe'];
        }),
      );
      expect(issues.some((issue) => issue.message.includes('ev_no_existe'))).toBe(true);
    });

    it('rechaza una referencia colgante a un hallazgo', () => {
      const issues = expectRejected(
        mutate((report) => {
          report.prioritized_improvements.improvements[0].finding_refs = ['fi_no_existe'];
        }),
      );
      expect(issues.some((issue) => issue.message.includes('fi_no_existe'))).toBe(true);
    });

    it('rechaza una mejora que contribuye a un objetivo inexistente', () => {
      expectRejected(
        mutate((report) => {
          report.prioritized_improvements.improvements[0].contributes_to = {
            known: true,
            value: '11111111-2222-4333-8444-555555555555',
          };
        }),
      );
    });

    it('rechaza una inferencia que no se deriva de nada registrado', () => {
      expectRejected(
        mutate((report) => {
          const inference = report.evidence[2];
          if (inference.kind !== 'inference') throw new Error('caso de prueba inválido');
          inference.derived_from = ['ev_inexistente'];
        }),
      );
    });

    it('rechaza una inferencia que se deriva de sí misma', () => {
      const issues = expectRejected(
        mutate((report) => {
          const inference = report.evidence[2];
          if (inference.kind !== 'inference') throw new Error('caso de prueba inválido');
          inference.derived_from = [inference.id];
        }),
      );
      expect(issues.some((issue) => issue.message.includes('sí misma'))).toBe(true);
    });

    it('exige que la situación actual use métricas calculadas, no declaraciones', () => {
      const issues = expectRejected(
        mutate((report) => {
          report.current_situation.metric_refs = ['ev_objetivo_declarado'];
        }),
      );
      expect(issues.some((issue) => issue.message.includes('no es una métrica calculada'))).toBe(
        true,
      );
    });

    it('rechaza el plan que programa una mejora inexistente', () => {
      expectRejected(
        mutate((report) => {
          const stage = report.implementation_plan.stages[1];
          if (stage.state !== 'planned') throw new Error('caso de prueba inválido');
          stage.improvement_refs = ['im_inexistente'];
        }),
      );
    });

    it('rechaza implementar la misma mejora en dos etapas', () => {
      const issues = expectRejected(
        mutate((report) => {
          const stage = report.implementation_plan.stages[2];
          if (stage.state !== 'not_applicable') throw new Error('caso de prueba inválido');
          report.implementation_plan.stages[2] = {
            stage: 'broader_improvements',
            state: 'planned',
            summary: 'Repite la misma mejora que la etapa anterior.',
            improvement_refs: ['im_simplificar_pago'],
            sequencing_notes: null,
          };
        }),
      );
      expect(issues.some((issue) => issue.message.includes('ya está planificada'))).toBe(true);
    });

    it('permite que "evaluar y ajustar" vuelva sobre una mejora ya planificada', () => {
      // Es su razón de ser: la etapa final mide lo que se aplicó antes.
      const result = validateReport(buildReport());
      expect(result.ok).toBe(true);
    });

    it('rechaza evaluar una mejora que ninguna etapa implementa', () => {
      const issues = expectRejected(
        mutate((report) => {
          const applied = report.implementation_plan.stages[1];
          if (applied.state !== 'planned') throw new Error('caso de prueba inválido');
          report.implementation_plan.stages[1] = {
            stage: 'initial_improvements',
            state: 'not_applicable',
            explanation: 'Nadie se compromete a implementarla.',
          };
        }),
      );
      expect(issues.some((issue) => issue.message.includes('ninguna etapa anterior'))).toBe(true);
    });

    it('rechaza dependencias circulares entre mejoras', () => {
      const issues = expectRejected(
        mutate((report) => {
          report.prioritized_improvements.improvements[0].depends_on = ['im_simplificar_pago'];
        }),
      );
      expect(issues.some((issue) => issue.message.includes('sí misma'))).toBe(true);
    });

    it('rechaza evidencia declarada por el usuario de otra versión de contexto', () => {
      const issues = expectRejected(
        mutate((report) => {
          const statement = report.evidence[0];
          if (statement.kind !== 'user_statement') throw new Error('caso de prueba inválido');
          statement.context_version_id = '00000000-1111-4222-8333-444444444444';
        }),
      );
      expect(issues.some((issue) => issue.message.includes('versión de contexto'))).toBe(true);
    });
  });

  describe('coherencia de objetivos', () => {
    it('rechaza "sin objetivo definido" junto con objetivos declarados', () => {
      expectRejected(
        mutate((report) => {
          report.objectives_and_context.has_defined_objective = false;
        }),
      );
    });

    it('rechaza un contexto con objetivo definido y ningún objetivo', () => {
      expectRejected(
        mutate((report) => {
          report.objectives_and_context.objectives = [];
          report.analysis.findings[0].relates_to_objectives = [];
          report.prioritized_improvements.improvements[0].contributes_to = {
            known: false,
            reason: 'not_declared_by_user',
          };
        }),
      );
    });

    it('rechaza dos objetivos principales', () => {
      expectRejected(
        mutate((report) => {
          report.objectives_and_context.objectives.push({
            ...report.objectives_and_context.objectives[0],
            id: '22222222-3333-4444-8555-666666666666',
          });
        }),
      );
    });
  });
});
