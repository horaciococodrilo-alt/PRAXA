/**
 * Contrato del reporte de diagnóstico y plan de optimización de PRAXA.
 *
 * ESTADO: el contrato está definido y validado. La GENERACIÓN con IA NO está
 * implementada — no hay ninguna llamada a un LLM en esta entrega. Este módulo existe
 * para que, cuando llegue, el modelo tenga que producir un documento que ya no admite
 * huecos disimulados: lo desconocido se declara como desconocido y toda conclusión
 * referencia evidencia registrada.
 */

export {
  evidenceSchema,
  type Evidence,
  type EvidenceKind,
  userStatementEvidenceSchema,
  calculatedMetricEvidenceSchema,
  systemFactEvidenceSchema,
  inferenceEvidenceSchema,
} from './evidence';

export {
  currentSituationSchema,
  findingSchema,
  improvementSchema,
  measurementAndReviewSchema,
  type Finding,
  type Improvement,
} from './findings';

export {
  implementationPlanSchema,
  planStageSchema,
  planStageKeySchema,
  PLAN_STAGES,
  PLAN_STAGE_LABELS,
  type ImplementationPlan,
  type PlanStage,
  type PlanStageKey,
} from './methodology';

export {
  knownOr,
  unknownReasonSchema,
  periodSchema,
  prioritySchema,
  evidenceIdSchema,
  findingIdSchema,
  improvementIdSchema,
  objectiveIdSchema,
  type Known,
  type KnownOr,
  type Period,
  type Priority,
  type Unknown,
  type UnknownReason,
} from './primitives';

export {
  analysisSchema,
  objectivesAndContextSchema,
  prioritizedImprovementsSchema,
  reportSchema,
  validateReport,
  type PraxaReport,
  type ReportValidationResult,
} from './report';

export {
  METHODOLOGY_VERSION,
  REPORT_SCHEMA_VERSION,
  type MethodologyVersion,
  type ReportSchemaVersion,
} from './versions';
