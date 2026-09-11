import { z } from 'zod';

/**
 * Contexto declarado por el usuario. Se versiona por separado del esquema del reporte y
 * de la metodología: cambia cuando cambia lo que le preguntamos, no cuando cambia cómo
 * analizamos.
 */
export const CONTEXT_SCHEMA_VERSION = '1.0.0';

/**
 * Catálogo de sistemas para elegir en el onboarding.
 *
 * IMPORTANTE: esto es una DECLARACIÓN del usuario sobre qué usa su empresa. No implica
 * ninguna conexión, ni credenciales, ni extracción de datos. Ningún conector está
 * implementado en esta entrega.
 */
export const SYSTEM_CATALOG = [
  { key: 'tiendanube', label: 'Tiendanube', group: 'Ecommerce' },
  { key: 'shopify', label: 'Shopify', group: 'Ecommerce' },
  { key: 'woocommerce', label: 'WooCommerce', group: 'Ecommerce' },
  { key: 'vtex', label: 'VTEX', group: 'Ecommerce' },
  { key: 'mercadolibre', label: 'Mercado Libre', group: 'Marketplace' },
  { key: 'amazon', label: 'Amazon', group: 'Marketplace' },
  { key: 'google-analytics', label: 'Google Analytics', group: 'Analítica' },
  { key: 'google-ads', label: 'Google Ads', group: 'Publicidad' },
  { key: 'meta-ads', label: 'Meta Ads', group: 'Publicidad' },
  { key: 'klaviyo', label: 'Klaviyo', group: 'Email marketing' },
  { key: 'mailchimp', label: 'Mailchimp', group: 'Email marketing' },
  { key: 'tango', label: 'Tango Gestión', group: 'ERP / Gestión' },
  { key: 'sap', label: 'SAP', group: 'ERP / Gestión' },
  { key: 'other', label: 'Otro', group: 'Otros' },
] as const;

export const systemKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, 'identificador de sistema inválido');

export const prioritySchema = z.enum(['high', 'medium', 'low']);
export const horizonSchema = z.enum(['short', 'medium', 'long']);
export const objectiveKindSchema = z.enum(['primary', 'secondary']);

export const PRIORITY_LABELS: Record<z.infer<typeof prioritySchema>, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export const HORIZON_LABELS: Record<z.infer<typeof horizonSchema>, string> = {
  short: 'Corto plazo (hasta 3 meses)',
  medium: 'Mediano plazo (3 a 12 meses)',
  long: 'Largo plazo (más de 12 meses)',
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .default(null);

/**
 * Un objetivo declarado.
 *
 * Indicador y meta son opcionales a propósito: si el usuario no los conoce, quedan
 * vacíos y así se registran. No se completan con supuestos. Una meta sin indicador se
 * rechaza porque no sería interpretable.
 */
export const objectiveInputSchema = z
  .object({
    id: z.uuid().optional(),
    kind: objectiveKindSchema,
    title: z.string().trim().min(3, 'describí el objetivo').max(300),
    description: optionalText(2000),
    priority: prioritySchema.nullable().default(null),
    horizon: horizonSchema.nullable().default(null),
    indicator_name: optionalText(200),
    target_value: z.number().finite().nullable().default(null),
    target_unit: optionalText(40),
    position: z.int().nonnegative().default(0),
  })
  .refine((o) => o.target_value === null || o.indicator_name !== null, {
    message: 'una meta necesita un indicador que la haga interpretable',
    path: ['indicator_name'],
  });

export type ObjectiveInput = z.infer<typeof objectiveInputSchema>;

export const systemInputSchema = z.object({
  system_key: systemKeySchema,
  label: optionalText(200),
  notes: optionalText(1000),
});

export type SystemInput = z.infer<typeof systemInputSchema>;

// --- Pasos del onboarding -----------------------------------------------------
// Cada paso se valida por separado para poder guardar y retomar. Un borrador
// incompleto es un estado legítimo: la integridad total se exige recién al confirmar.

export const companyStepSchema = z.object({
  name: z.string().trim().min(2, 'ingresá el nombre de la empresa').max(200),
});

export const systemsStepSchema = z.object({
  systems: z.array(systemInputSchema).max(50),
});

export const objectivesStepSchema = z
  .object({
    has_defined_objective: z.boolean(),
    objectives: z.array(objectiveInputSchema).max(20),
  })
  .superRefine((step, ctx) => {
    if (!step.has_defined_objective && step.objectives.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['objectives'],
        message:
          'marcaste que todavía no tenés un objetivo definido: quitá los objetivos cargados o desmarcá la opción',
      });
      return;
    }

    const primaries = step.objectives.filter((o) => o.kind === 'primary').length;
    if (primaries > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['objectives'],
        message: 'solo puede haber un objetivo principal',
      });
    }
  });

export const contextStepSchema = z.object({
  problems: z.array(z.string().trim().min(1).max(1000)).max(30),
  constraints: z.array(z.string().trim().min(1).max(1000)).max(30),
  additional_context: optionalText(5000),
});

export type CompanyStepInput = z.input<typeof companyStepSchema>;
export type SystemsStepInput = z.input<typeof systemsStepSchema>;
export type ObjectivesStepInput = z.input<typeof objectivesStepSchema>;
export type ContextStepInput = z.input<typeof contextStepSchema>;

export const ONBOARDING_STEPS = ['company', 'systems', 'objectives', 'context', 'review'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const ONBOARDING_STEP_LABELS: Record<OnboardingStep, string> = {
  company: 'Empresa',
  systems: 'Sistemas',
  objectives: 'Objetivos',
  context: 'Problemas y restricciones',
  review: 'Revisión',
};

/**
 * Espejo en TypeScript del invariante que la base de datos aplica al activar.
 * Existe para dar un mensaje útil ANTES de intentar confirmar; la validación que manda
 * sigue siendo la de `activate_context_draft()`.
 */
export function checkReadyForActivation(input: {
  has_defined_objective: boolean;
  objectives: { kind: 'primary' | 'secondary' }[];
}): { ready: true } | { ready: false; reason: string } {
  const primaries = input.objectives.filter((o) => o.kind === 'primary').length;

  if (input.has_defined_objective) {
    if (input.objectives.length === 0) {
      return { ready: false, reason: 'Cargá al menos un objetivo o indicá que todavía no tenés uno definido.' };
    }
    if (primaries !== 1) {
      return {
        ready: false,
        reason:
          primaries === 0
            ? 'Marcá cuál de los objetivos es el principal.'
            : 'Solo puede haber un objetivo principal.',
      };
    }
    return { ready: true };
  }

  if (input.objectives.length > 0) {
    return {
      ready: false,
      reason: '"Todavía no tengo un objetivo definido" no puede convivir con objetivos cargados.',
    };
  }

  return { ready: true };
}
