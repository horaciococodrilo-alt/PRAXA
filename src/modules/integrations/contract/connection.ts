import { z } from 'zod';

import {
  connectionStatusSchema,
  integrationErrorClassSchema,
  integrationProviderSchema,
  isoDateTimeSchema,
  reauthErrorClassSchema,
  redactedErrorMessageSchema,
  uuidSchema,
} from './primitives';

/**
 * K03 `IntegrationConnection` (CA-06 a CA-09b).
 *
 * Hay dos tipos: el registro interno, que refleja la fila de
 * `public.integration_connections`, y el DTO público, que es lo único que llega a la UI.
 * El DTO es un esquema propio y `toConnectionDto` lo arma campo por campo. No es el
 * registro con campos omitidos: si el registro gana un campo, el DTO no lo expone hasta
 * que alguien lo agregue a propósito (CA-06).
 */

const SUPPORTED_CURRENCIES = new Set(Intl.supportedValuesOf('currency'));

/** CA-08: código ISO 4217 que el runtime reconoce. */
export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'debe ser un código ISO 4217')
  .refine((code) => SUPPORTED_CURRENCIES.has(code), { message: 'moneda desconocida' });

function isKnownTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * CA-08: nombre IANA (`Area/Location`) o `UTC`. La forma excluye los desplazamientos
 * fijos (`+03:00`) que el runtime también aceptaría, y `Intl` descarta los nombres que
 * no existen.
 */
export const timeZoneSchema = z
  .string()
  .regex(/^(?:UTC|[A-Z][A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/, 'debe ser una zona IANA')
  .refine(isKnownTimeZone, { message: 'zona horaria desconocida' });

/** Identificador opaco de Meta. Se guarda completo y se muestra truncado (CA-09b, CA-40). */
export const externalAccountIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
export const clientBusinessIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

const commonShape = {
  id: uuidSchema,
  company_id: uuidSchema,
  provider: integrationProviderSchema,
  client_business_id: clientBusinessIdSchema.nullable(),
  credential_generation: z.int().nonnegative(),
  current_sync_run_id: uuidSchema.nullable(),
  last_error_class: integrationErrorClassSchema.nullable(),
  last_error_message: redactedErrorMessageSchema.nullable(),
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
};

const optionalMetadata = {
  external_account_id: externalAccountIdSchema.nullable(),
  currency: currencyCodeSchema.nullable(),
  timezone: timeZoneSchema.nullable(),
};

const requiredMetadata = {
  external_account_id: externalAccountIdSchema,
  currency: currencyCodeSchema,
  timezone: timeZoneSchema,
};

const pendingSchema = z.strictObject({
  ...commonShape,
  ...optionalMetadata,
  status: z.literal('pending_selection'),
  /** DEC-17: vence a los 30 minutos. */
  pending_expires_at: isoDateTimeSchema,
  purge_requested_at: z.null(),
});

const activeSchema = z.strictObject({
  ...commonShape,
  ...requiredMetadata,
  status: z.literal('active'),
  pending_expires_at: isoDateTimeSchema.nullable(),
  purge_requested_at: z.null(),
});

const needsReauthSchema = z.strictObject({
  ...commonShape,
  ...requiredMetadata,
  status: z.literal('needs_reauth'),
  /** CA-39: solo autenticación, acción del usuario, permiso o acceso llevan a este estado. */
  last_error_class: reauthErrorClassSchema,
  pending_expires_at: isoDateTimeSchema.nullable(),
  purge_requested_at: z.null(),
});

const disconnectedSchema = z.strictObject({
  ...commonShape,
  ...optionalMetadata,
  status: z.literal('disconnected'),
  pending_expires_at: isoDateTimeSchema.nullable(),
  /** CA-38: marca persistente de la purga pendiente. */
  purge_requested_at: isoDateTimeSchema,
});

export const integrationConnectionRecordSchema = z
  .discriminatedUnion('status', [pendingSchema, activeSchema, needsReauthSchema, disconnectedSchema])
  .superRefine((record, ctx) => {
    // CA-08: ninguna transición inventa metadatos. Los tres vienen juntos de la
    // confirmación, así que están todos o no está ninguno.
    const present = [record.external_account_id, record.currency, record.timezone].filter(
      (value) => value !== null,
    ).length;
    if (present !== 0 && present !== 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['external_account_id'],
        message: 'cuenta, moneda y zona van juntas: todas o ninguna',
      });
    }
    // CA-09: el último error es una clase más un mensaje; uno sin el otro no sirve.
    if ((record.last_error_class === null) !== (record.last_error_message === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['last_error_class'],
        message: 'la clase y el mensaje del último error van juntos',
      });
    }
  });

export type IntegrationConnectionRecord = z.infer<typeof integrationConnectionRecordSchema>;

// ---------------------------------------------------------------------------
// DTO público
// ---------------------------------------------------------------------------

/**
 * CA-09b y CA-40: el identificador de la cuenta se muestra truncado. Nunca revela más de
 * cuatro caracteres, y ninguno si el identificador es corto.
 */
export function maskExternalAccountId(id: string): string {
  const visible = id.length > 8 ? id.slice(-4) : '';
  return `…${visible}`;
}

export const integrationConnectionDtoSchema = z.strictObject({
  id: uuidSchema,
  provider: integrationProviderSchema,
  status: connectionStatusSchema,
  external_account_id_masked: z.string().startsWith('…').max(5).nullable(),
  currency: currencyCodeSchema.nullable(),
  timezone: timeZoneSchema.nullable(),
  pending_expires_at: isoDateTimeSchema.nullable(),
  last_error: z
    .strictObject({
      class: integrationErrorClassSchema,
      message: redactedErrorMessageSchema,
    })
    .nullable(),
});

export type IntegrationConnectionDto = z.infer<typeof integrationConnectionDtoSchema>;

/** Arma el DTO a partir de un registro válido, campo por campo (CA-06). */
export function toConnectionDto(input: IntegrationConnectionRecord): IntegrationConnectionDto {
  const record = integrationConnectionRecordSchema.parse(input);
  return integrationConnectionDtoSchema.parse({
    id: record.id,
    provider: record.provider,
    status: record.status,
    external_account_id_masked:
      record.external_account_id === null ? null : maskExternalAccountId(record.external_account_id),
    currency: record.currency,
    timezone: record.timezone,
    pending_expires_at: record.pending_expires_at,
    last_error:
      record.last_error_class === null || record.last_error_message === null
        ? null
        : { class: record.last_error_class, message: record.last_error_message },
  });
}
