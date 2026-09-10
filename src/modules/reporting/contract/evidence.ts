import { z } from 'zod';

import {
  evidenceIdSchema,
  isoDateTimeSchema,
  metricIdSchema,
  nonEmptyText,
  periodSchema,
} from './primitives';

/**
 * Evidencia tipada por PROCEDENCIA.
 *
 * La distinción es el corazón del contrato: no es lo mismo un número calculado por
 * código sobre datos extraídos, que algo que el dueño declaró en el onboarding, que un
 * hecho leído de un sistema, que una interpretación. Las cuatro cosas pueden aparecer en
 * un reporte, pero nunca mezcladas ni presentadas con el mismo peso.
 *
 * Una inferencia además debe declarar de qué evidencia se deriva, y esa referencia se
 * valida: no puede apoyarse en nada.
 */

const evidenceBase = {
  id: evidenceIdSchema,
  /** Qué afirma esta evidencia, en una frase. */
  statement: nonEmptyText(1000),
};

/** Algo que el usuario declaró. No es un hecho verificado: es lo que nos dijo. */
export const userStatementEvidenceSchema = z.object({
  ...evidenceBase,
  kind: z.literal('user_statement'),
  /** Campo del onboarding del que proviene (p. ej. "objective.title", "problems[0]"). */
  source_field: nonEmptyText(200),
  stated_at: isoDateTimeSchema,
  /** Versión de contexto en la que se declaró. */
  context_version_id: z.uuid(),
});

/** Un número calculado por código. Nunca por el LLM. */
export const calculatedMetricEvidenceSchema = z.object({
  ...evidenceBase,
  kind: z.literal('calculated_metric'),
  metric_id: metricIdSchema,
  metric_key: nonEmptyText(120),
  value: z.number().finite(),
  unit: nonEmptyText(40).nullable(),
  period: periodSchema,
  computed_at: isoDateTimeSchema,
  computation: z.object({
    /** Identificador de la función de cálculo que produjo el valor. */
    method_id: nonEmptyText(120),
    method_version: nonEmptyText(40),
    /** Qué entradas se usaron, para poder rehacer el cálculo. */
    inputs: z.array(nonEmptyText(200)).min(1),
  }),
  /** Qué parte del universo cubre el cálculo. Un número sin cobertura no es interpretable. */
  coverage: z.object({
    records_considered: z.int().nonnegative(),
    records_expected: z.int().nonnegative().nullable(),
    notes: nonEmptyText(500).nullable(),
  }),
});

/** Un hecho leído de un sistema conectado, sin transformación. */
export const systemFactEvidenceSchema = z.object({
  ...evidenceBase,
  kind: z.literal('system_fact'),
  system_key: nonEmptyText(64),
  /** Recurso del que se leyó (p. ej. "orders", "products"). */
  resource: nonEmptyText(120),
  observed_at: isoDateTimeSchema,
  /** Identificador en el sistema de origen, si lo hay. */
  external_ref: nonEmptyText(200).nullable(),
});

/** Una interpretación. Siempre derivada de otra evidencia, nunca autónoma. */
export const inferenceEvidenceSchema = z.object({
  ...evidenceBase,
  kind: z.literal('inference'),
  derived_from: z.array(evidenceIdSchema).min(1),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: nonEmptyText(2000),
});

export const evidenceSchema = z.discriminatedUnion('kind', [
  userStatementEvidenceSchema,
  calculatedMetricEvidenceSchema,
  systemFactEvidenceSchema,
  inferenceEvidenceSchema,
]);

export type Evidence = z.infer<typeof evidenceSchema>;
export type EvidenceKind = Evidence['kind'];
