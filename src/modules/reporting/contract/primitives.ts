import { z } from 'zod';

/**
 * Primitivas del contrato del reporte.
 *
 * Nota importante sobre `knownOr`: este esquema NO impide que un modelo invente
 * información. Nada en una validación estructural puede impedirlo. Lo que hace es
 * obligar a que lo conocido y lo desconocido se representen explícitamente, de modo que
 * "no lo sé" sea un valor de primera clase con un motivo declarado, y no un hueco que se
 * rellena con una estimación inventada para completar la plantilla. La detección de
 * afirmaciones sin respaldo la aporta la integridad referencial de `report.ts`: una
 * conclusión que no se apoya en evidencia registrada no valida.
 */

const slug = (prefix: string) =>
  z
    .string()
    .regex(
      new RegExp(`^${prefix}_[a-z0-9][a-z0-9_-]{0,62}$`),
      `debe tener el formato ${prefix}_<slug>`,
    );

export const evidenceIdSchema = slug('ev');
export const findingIdSchema = slug('fi');
export const improvementIdSchema = slug('im');
export const metricIdSchema = slug('me');

/** Los objetivos son filas reales de `company_objectives`. */
export const objectiveIdSchema = z.uuid();

export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const isoDateSchema = z.iso.date();

export const periodSchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
  })
  .refine((p) => p.from <= p.to, {
    message: 'el período no puede terminar antes de empezar',
    path: ['to'],
  });

export type Period = z.infer<typeof periodSchema>;

/**
 * Por qué un dato no se conoce. La lista es cerrada a propósito: obliga a clasificar la
 * ausencia en vez de justificarla con texto libre.
 */
export const unknownReasonSchema = z.enum([
  /** El dato no se mide en ninguno de los sistemas conectados. */
  'not_measured',
  /** Se mide, pero no hay historia suficiente para el período pedido. */
  'insufficient_history',
  /** Depende de una declaración que el usuario no hizo en el onboarding. */
  'not_declared_by_user',
  /** Requiere un sistema que todavía no está conectado. */
  'integration_missing',
  /** Hay datos, pero no alcanzan para estimar esto con fundamento. */
  'no_reliable_basis',
]);

export type UnknownReason = z.infer<typeof unknownReasonSchema>;

/**
 * Un valor que puede no conocerse. Si no se conoce, hay que decir por qué.
 * No admite un tercer estado: o hay valor, o hay motivo.
 */
export function knownOr<T extends z.ZodType>(schema: T) {
  return z.discriminatedUnion('known', [
    z.object({ known: z.literal(true), value: schema }),
    z.object({
      known: z.literal(false),
      reason: unknownReasonSchema,
      detail: z.string().min(1).max(500).optional(),
    }),
  ]);
}

export type Known<T> = { known: true; value: T };
export type Unknown = { known: false; reason: UnknownReason; detail?: string };
export type KnownOr<T> = Known<T> | Unknown;

export const nonEmptyText = (max = 2000) => z.string().trim().min(1).max(max);

export const prioritySchema = z.enum(['high', 'medium', 'low']);
export type Priority = z.infer<typeof prioritySchema>;
