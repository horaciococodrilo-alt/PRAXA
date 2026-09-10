import { z } from 'zod';

import { improvementIdSchema, nonEmptyText } from './primitives';
import { METHODOLOGY_VERSION } from './versions';

/**
 * La metodología del plan es fija y versionada. La ESTRUCTURA no se personaliza; los
 * hallazgos y las recomendaciones que la llenan, sí.
 *
 * Las cuatro etapas son siempre las mismas y siempre están presentes, en este orden. Una
 * etapa puede declarar que no aplica o que falta información, pero no puede desaparecer:
 * un plan al que le falta una etapa esconde el hueco en lugar de mostrarlo.
 */

export const PLAN_STAGES = [
  'prepare_data',
  'initial_improvements',
  'broader_improvements',
  'evaluate_and_adjust',
] as const;

export type PlanStageKey = (typeof PLAN_STAGES)[number];

export const PLAN_STAGE_LABELS: Record<PlanStageKey, string> = {
  prepare_data: 'Preparar datos, configuraciones y dependencias',
  initial_improvements: 'Aplicar mejoras iniciales',
  broader_improvements: 'Implementar mejoras de mayor alcance',
  evaluate_and_adjust: 'Evaluar y ajustar',
};

export const planStageKeySchema = z.enum(PLAN_STAGES);

const stagePlanned = z.object({
  stage: planStageKeySchema,
  state: z.literal('planned'),
  summary: nonEmptyText(1000),
  /** Qué mejoras se ejecutan en esta etapa. Se validan contra las mejoras del reporte. */
  improvement_refs: z.array(improvementIdSchema).min(1),
  sequencing_notes: nonEmptyText(1000).nullable(),
});

/** La etapa no corresponde para esta empresa. Hay que decir por qué. */
const stageNotApplicable = z.object({
  stage: planStageKeySchema,
  state: z.literal('not_applicable'),
  explanation: nonEmptyText(1000),
});

/** No hay información suficiente para planificar la etapa. Hay que decir qué falta. */
const stageInsufficientInformation = z.object({
  stage: planStageKeySchema,
  state: z.literal('insufficient_information'),
  explanation: nonEmptyText(1000),
  missing_information: z.array(nonEmptyText(300)).min(1),
});

export const planStageSchema = z.discriminatedUnion('state', [
  stagePlanned,
  stageNotApplicable,
  stageInsufficientInformation,
]);

export type PlanStage = z.infer<typeof planStageSchema>;

export const implementationPlanSchema = z
  .object({
    methodology_version: z.literal(METHODOLOGY_VERSION),
    stages: z.array(planStageSchema).length(PLAN_STAGES.length),
  })
  .superRefine((plan, ctx) => {
    const seen = plan.stages.map((s) => s.stage);

    PLAN_STAGES.forEach((expected, index) => {
      if (seen[index] !== expected) {
        ctx.addIssue({
          code: 'custom',
          path: ['stages', index, 'stage'],
          message: `la etapa ${index + 1} debe ser "${expected}" (metodología ${METHODOLOGY_VERSION})`,
        });
      }
    });
  });

export type ImplementationPlan = z.infer<typeof implementationPlanSchema>;
