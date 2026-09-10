import { z } from 'zod';

import { evidenceSchema } from './evidence';
import {
  currentSituationSchema,
  findingSchema,
  improvementSchema,
  measurementAndReviewSchema,
} from './findings';
import {
  implementationPlanSchema,
  PLAN_STAGE_LABELS,
  type PlanStageKey,
} from './methodology';
import {
  isoDateTimeSchema,
  nonEmptyText,
  objectiveIdSchema,
} from './primitives';
import { METHODOLOGY_VERSION, REPORT_SCHEMA_VERSION } from './versions';

/**
 * Sección 1 — Objetivos y contexto.
 *
 * Es una copia del contexto declarado por el usuario en la versión concreta con la que
 * se generó el reporte, no una relectura al momento de leerlo. Un reporte tiene que
 * seguir siendo interpretable aunque el contexto haya cambiado después.
 */
export const objectivesAndContextSchema = z
  .object({
    context_version_id: z.uuid(),
    context_schema_version: nonEmptyText(40),
    context_version_number: z.int().positive(),
    company_name: nonEmptyText(200),

    /** El usuario puede declarar que todavía no tiene un objetivo definido. */
    has_defined_objective: z.boolean(),

    objectives: z.array(
      z.object({
        id: objectiveIdSchema,
        kind: z.enum(['primary', 'secondary']),
        title: nonEmptyText(300),
        priority: z.enum(['high', 'medium', 'low']).nullable(),
        horizon: z.enum(['short', 'medium', 'long']).nullable(),
        indicator_name: nonEmptyText(200).nullable(),
        target_value: z.number().finite().nullable(),
        target_unit: nonEmptyText(40).nullable(),
      }),
    ),

    systems: z.array(
      z.object({
        system_key: nonEmptyText(64),
        label: nonEmptyText(200).nullable(),
      }),
    ),

    problems: z.array(nonEmptyText(1000)),
    constraints: z.array(nonEmptyText(1000)),
    additional_context: nonEmptyText(5000).nullable(),
  })
  .superRefine((section, ctx) => {
    // Mismo invariante que la base de datos, verificado también en el documento.
    const primaries = section.objectives.filter((o) => o.kind === 'primary').length;

    if (section.has_defined_objective) {
      if (section.objectives.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['objectives'],
          message: 'un contexto con objetivo definido debe incluir al menos un objetivo',
        });
      }
      if (section.objectives.length > 0 && primaries !== 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['objectives'],
          message: `se requiere exactamente un objetivo principal (hay ${primaries})`,
        });
      }
    } else if (section.objectives.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['objectives'],
        message: '"sin objetivo definido" no puede convivir con objetivos declarados',
      });
    }
  });

export const analysisSchema = z.object({
  summary: nonEmptyText(3000),
  findings: z.array(findingSchema),
});

export const prioritizedImprovementsSchema = z.object({
  prioritization_criteria: nonEmptyText(1000),
  improvements: z.array(improvementSchema),
});

/** Las seis secciones siempre están presentes. */
const reportShape = z.object({
  report_schema_version: z.literal(REPORT_SCHEMA_VERSION),
  methodology_version: z.literal(METHODOLOGY_VERSION),
  company_id: z.uuid(),
  generated_at: isoDateTimeSchema,

  /** Depósito de evidencia. Todo lo demás la referencia por id. */
  evidence: z.array(evidenceSchema),

  objectives_and_context: objectivesAndContextSchema,
  current_situation: currentSituationSchema,
  analysis: analysisSchema,
  prioritized_improvements: prioritizedImprovementsSchema,
  implementation_plan: implementationPlanSchema,
  measurement_and_review: measurementAndReviewSchema,
});

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

/**
 * Integridad referencial del documento.
 *
 * Esto es lo que convierte al contrato en algo más que una plantilla: una conclusión que
 * no se apoya en evidencia registrada, o una etapa que planifica una mejora inexistente,
 * no valida. Una afirmación sin respaldo deja de ser un problema de criterio para pasar a
 * ser un error estructural detectable.
 */
export const reportSchema = reportShape.superRefine((report, ctx) => {
  const evidenceIds = new Set(report.evidence.map((e) => e.id));
  const findingIds = new Set(report.analysis.findings.map((f) => f.id));
  const improvementIds = new Set(
    report.prioritized_improvements.improvements.map((i) => i.id),
  );
  const objectiveIds = new Set(report.objectives_and_context.objectives.map((o) => o.id));

  const duplicate = (label: string, values: string[], path: (string | number)[]) => {
    const dupes = findDuplicates(values);
    if (dupes.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path,
        message: `${label} duplicado(s): ${dupes.join(', ')}`,
      });
    }
  };

  duplicate('identificador de evidencia', report.evidence.map((e) => e.id), ['evidence']);
  duplicate('identificador de hallazgo', report.analysis.findings.map((f) => f.id), [
    'analysis',
    'findings',
  ]);
  duplicate(
    'identificador de mejora',
    report.prioritized_improvements.improvements.map((i) => i.id),
    ['prioritized_improvements', 'improvements'],
  );

  const requireRefs = (
    refs: readonly string[],
    pool: Set<string>,
    label: string,
    path: (string | number)[],
  ) => {
    refs.forEach((ref, index) => {
      if (!pool.has(ref)) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, index],
          message: `${label} inexistente: ${ref}`,
        });
      }
    });
  };

  // Una inferencia no puede sostenerse en el vacío ni en sí misma.
  report.evidence.forEach((item, index) => {
    if (item.kind !== 'inference') return;
    requireRefs(item.derived_from, evidenceIds, 'evidencia', ['evidence', index, 'derived_from']);
    if (item.derived_from.includes(item.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['evidence', index, 'derived_from'],
        message: 'una inferencia no puede derivarse de sí misma',
      });
    }
  });

  // Las métricas de la situación actual deben ser métricas calculadas, no declaraciones.
  const calculatedIds = new Set(
    report.evidence.filter((e) => e.kind === 'calculated_metric').map((e) => e.id),
  );
  report.current_situation.metric_refs.forEach((ref, index) => {
    if (!evidenceIds.has(ref)) {
      ctx.addIssue({
        code: 'custom',
        path: ['current_situation', 'metric_refs', index],
        message: `evidencia inexistente: ${ref}`,
      });
    } else if (!calculatedIds.has(ref)) {
      ctx.addIssue({
        code: 'custom',
        path: ['current_situation', 'metric_refs', index],
        message: `${ref} no es una métrica calculada; la situación actual solo admite métricas calculadas por código`,
      });
    }
  });

  report.analysis.findings.forEach((finding, index) => {
    requireRefs(finding.evidence_refs, evidenceIds, 'evidencia', [
      'analysis',
      'findings',
      index,
      'evidence_refs',
    ]);
    requireRefs(finding.relates_to_objectives, objectiveIds, 'objetivo', [
      'analysis',
      'findings',
      index,
      'relates_to_objectives',
    ]);
  });

  report.prioritized_improvements.improvements.forEach((improvement, index) => {
    const base = ['prioritized_improvements', 'improvements', index];

    requireRefs(improvement.finding_refs, findingIds, 'hallazgo', [...base, 'finding_refs']);
    requireRefs(improvement.evidence_refs, evidenceIds, 'evidencia', [...base, 'evidence_refs']);
    requireRefs(improvement.depends_on, improvementIds, 'mejora', [...base, 'depends_on']);

    if (improvement.depends_on.includes(improvement.id)) {
      ctx.addIssue({
        code: 'custom',
        path: [...base, 'depends_on'],
        message: 'una mejora no puede depender de sí misma',
      });
    }

    if (improvement.contributes_to.known && !objectiveIds.has(improvement.contributes_to.value)) {
      ctx.addIssue({
        code: 'custom',
        path: [...base, 'contributes_to', 'value'],
        message: `objetivo inexistente: ${improvement.contributes_to.value}`,
      });
    }
  });

  // Dependencias circulares entre mejoras.
  const graph = new Map(
    report.prioritized_improvements.improvements.map((i) => [i.id, i.depends_on]),
  );
  const state = new Map<string, 'visiting' | 'done'>();
  const hasCycle = (node: string): boolean => {
    const current = state.get(node);
    if (current === 'done') return false;
    if (current === 'visiting') return true;
    state.set(node, 'visiting');
    for (const next of graph.get(node) ?? []) {
      if (graph.has(next) && hasCycle(next)) return true;
    }
    state.set(node, 'done');
    return false;
  };
  for (const id of graph.keys()) {
    if (hasCycle(id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['prioritized_improvements', 'improvements'],
        message: `dependencias circulares entre mejoras, detectadas en ${id}`,
      });
      break;
    }
  }

  // El plan no puede planificar mejoras inexistentes.
  report.implementation_plan.stages.forEach((stage, index) => {
    if (stage.state !== 'planned') return;
    requireRefs(stage.improvement_refs, improvementIds, 'mejora', [
      'implementation_plan',
      'stages',
      index,
      'improvement_refs',
    ]);
  });

  // Una mejora se IMPLEMENTA en una sola etapa: repetirla en dos deja ambiguo cuándo se
  // hace y permite contar dos veces el mismo trabajo.
  const scheduled = new Map<string, PlanStageKey>();
  report.implementation_plan.stages.forEach((stage, index) => {
    if (stage.state !== 'planned' || stage.stage === 'evaluate_and_adjust') return;

    stage.improvement_refs.forEach((ref, refIndex) => {
      const previous = scheduled.get(ref);
      if (previous) {
        ctx.addIssue({
          code: 'custom',
          path: ['implementation_plan', 'stages', index, 'improvement_refs', refIndex],
          message: `la mejora ${ref} ya está planificada en la etapa "${PLAN_STAGE_LABELS[previous]}"`,
        });
      } else {
        scheduled.set(ref, stage.stage);
      }
    });
  });

  // "Evaluar y ajustar" sí vuelve sobre lo aplicado antes: es su razón de ser. Lo que no
  // puede hacer es evaluar una mejora que ninguna etapa se comprometió a implementar.
  report.implementation_plan.stages.forEach((stage, index) => {
    if (stage.state !== 'planned' || stage.stage !== 'evaluate_and_adjust') return;

    stage.improvement_refs.forEach((ref, refIndex) => {
      if (improvementIds.has(ref) && !scheduled.has(ref)) {
        ctx.addIssue({
          code: 'custom',
          path: ['implementation_plan', 'stages', index, 'improvement_refs', refIndex],
          message: `no se puede evaluar la mejora ${ref}: ninguna etapa anterior la implementa`,
        });
      }
    });
  });

  report.measurement_and_review.indicators.forEach((indicator, index) => {
    if (!improvementIds.has(indicator.improvement_ref)) {
      ctx.addIssue({
        code: 'custom',
        path: ['measurement_and_review', 'indicators', index, 'improvement_ref'],
        message: `mejora inexistente: ${indicator.improvement_ref}`,
      });
    }
  });

  // Lo que el usuario declaró tiene que provenir de la versión de contexto del reporte.
  report.evidence.forEach((item, index) => {
    if (item.kind !== 'user_statement') return;
    if (item.context_version_id !== report.objectives_and_context.context_version_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['evidence', index, 'context_version_id'],
        message:
          'la declaración proviene de una versión de contexto distinta a la del reporte',
      });
    }
  });
});

export type PraxaReport = z.infer<typeof reportSchema>;

export type ReportValidationResult =
  | { ok: true; report: PraxaReport }
  | { ok: false; issues: { path: string; message: string }[] };

/** Valida un reporte completo, forma e integridad referencial. */
export function validateReport(input: unknown): ReportValidationResult {
  const parsed = reportSchema.safeParse(input);
  if (parsed.success) {
    return { ok: true, report: parsed.data };
  }
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}
