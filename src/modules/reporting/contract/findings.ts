import { z } from 'zod';

import { evidenceSchema } from './evidence';
import {
  evidenceIdSchema,
  findingIdSchema,
  improvementIdSchema,
  isoDateSchema,
  knownOr,
  nonEmptyText,
  objectiveIdSchema,
  periodSchema,
  prioritySchema,
} from './primitives';

/** Un hallazgo nunca se sostiene solo: siempre apunta a evidencia registrada. */
export const findingSchema = z.object({
  id: findingIdSchema,
  title: nonEmptyText(300),
  description: nonEmptyText(3000),
  evidence_refs: z.array(evidenceIdSchema).min(1),
  /** Objetivos declarados con los que se relaciona. Puede estar vacío. */
  relates_to_objectives: z.array(objectiveIdSchema),
  severity: prioritySchema,
});

export type Finding = z.infer<typeof findingSchema>;

const stepSchema = z.object({
  order: z.int().positive(),
  description: nonEmptyText(1000),
});

const successIndicatorSchema = z.object({
  name: nonEmptyText(200),
  definition: nonEmptyText(1000),
  unit: nonEmptyText(40).nullable(),
  /** Punto de partida. Si no se puede medir hoy, hay que decir por qué. */
  baseline: knownOr(z.number().finite()),
  /** Meta. Si no hay fundamento para fijarla, hay que decir por qué. */
  target: knownOr(z.number().finite()),
});

const expectedImpactSchema = z.object({
  description: nonEmptyText(1000),
  direction: z.enum(['increase', 'decrease', 'stabilize']),
  /** Magnitud estimada solo si hay base para estimarla. */
  magnitude: knownOr(
    z.object({
      value: z.number().finite(),
      unit: nonEmptyText(40),
    }),
  ),
});

/**
 * Una mejora priorizada, con los trece campos del contrato.
 * Todo lo que puede no saberse está modelado como `knownOr`, nunca como un campo
 * opcional que se pueda completar con una suposición.
 */
export const improvementSchema = z.object({
  /** 1. Identificador. */
  id: improvementIdSchema,

  /** 2. Objetivo al que contribuye. Si el usuario no declaró objetivos, se dice. */
  contributes_to: knownOr(objectiveIdSchema),

  /** 3. Problema u oportunidad. */
  problem_or_opportunity: nonEmptyText(2000),

  /** 4. Evidencias que la respaldan, directas y a través de hallazgos. */
  finding_refs: z.array(findingIdSchema).min(1),
  evidence_refs: z.array(evidenceIdSchema).min(1),

  /** 5. Acción concreta propuesta. */
  proposed_action: nonEmptyText(2000),

  /** 6. Pasos para implementarla. */
  steps: z.array(stepSchema).min(1),

  /** 7. Prioridad y justificación. */
  priority: prioritySchema,
  priority_rationale: nonEmptyText(1000),

  /** 8. Dependencias con otras mejoras. */
  depends_on: z.array(improvementIdSchema),

  /** 9. Responsable sugerido. */
  suggested_owner: nonEmptyText(200),

  /** 10. Plazo estimado, cuando exista fundamento. */
  estimated_timeframe: knownOr(
    z.object({
      value: z.number().positive(),
      unit: z.enum(['days', 'weeks', 'months']),
    }),
  ),

  /** 11. Indicador para evaluar el resultado. */
  success_indicator: successIndicatorSchema,

  /** 12. Impacto esperado y supuestos, cuando puedan estimarse. */
  expected_impact: knownOr(expectedImpactSchema),
  assumptions: z.array(nonEmptyText(500)),

  /** 13. Incertidumbres e información faltante. */
  uncertainties: z.array(nonEmptyText(500)),
  missing_information: z.array(nonEmptyText(500)),
});

export type Improvement = z.infer<typeof improvementSchema>;

/** Sección 2: situación actual. Un número sin período ni cobertura no se publica. */
export const currentSituationSchema = z.object({
  period: periodSchema,
  /** Métricas calculadas por código. Se referencian desde la evidencia. */
  metric_refs: z.array(evidenceIdSchema),
  coverage: z.object({
    summary: nonEmptyText(1000),
    connected_systems: z.array(nonEmptyText(64)),
    /** Qué quedó fuera del análisis y por qué. */
    gaps: z.array(nonEmptyText(500)),
  }),
});

/** Sección 6: medición y revisión propuestas. */
export const measurementAndReviewSchema = z.object({
  indicators: z
    .array(
      z.object({
        improvement_ref: improvementIdSchema,
        indicator_name: nonEmptyText(200),
        measurement_method: nonEmptyText(1000),
        first_measurement_at: knownOr(isoDateSchema),
      }),
    )
    .min(0),
  review_cadence: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly']),
  next_review_at: knownOr(isoDateSchema),
  notes: nonEmptyText(2000).nullable(),
});

export { evidenceSchema };
