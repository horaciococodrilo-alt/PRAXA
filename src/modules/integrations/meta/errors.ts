import {
  redactErrorMessage,
  redactedErrorMessageSchema,
  type IntegrationErrorClass,
} from '@/modules/integrations/contract';
import { PG_INT4_MAX } from '@/modules/integrations/contract/primitives';

/**
 * Clasificación de errores de la Graph API (CA-39), por código y subcódigo de Graph y nunca
 * por estado HTTP.
 *
 * Ningún texto libre del proveedor entra en el error (A2x-01): `redactErrorMessage` no
 * reconoce un token escrito como texto suelto, así que no se puede confiar en él para
 * `error.message`, `error_user_msg`, `type` ni `fbtrace_id`. Del cuerpo se leen solo el
 * código y el subcódigo, validados como enteros; el mensaje sale de un texto fijo por clase.
 */

export const META_FAILURE_TEXTS: Readonly<Record<IntegrationErrorClass, string>> = Object.freeze({
  authentication: 'Meta rechazó la credencial.',
  user_action: 'Meta pide que la persona vuelva a autorizar.',
  permission: 'Meta denegó un permiso.',
  asset_access: 'Meta denegó el acceso al activo.',
  rate_limit: 'Meta limitó las llamadas.',
  temporary: 'Meta tuvo un error temporal.',
  own_error: 'Meta rechazó la petición de Praxa.',
  transport: 'Meta no respondió a tiempo.',
  unknown: 'Error de Meta sin detalle.',
});

export type MetaFailure = {
  errorClass: IntegrationErrorClass;
  graphCode: number | null;
  graphSubcode: number | null;
};

const AUTHENTICATION_SUBCODES = new Set([458, 460, 463, 467]);
const USER_ACTION_SUBCODES = new Set([459, 464]);
// Tabla de la ruta más los códigos de Business Use Case de la guía de límites (H-S-10).
const RATE_LIMIT_CODES = new Set([4, 17, 341, 613, 80000, 80003, 80004, 80014]);
const TEMPORARY_CODES = new Set([1, 2]);
const OWN_ERROR_CODES = new Set([3, 100, 3018]);

function graphInteger(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= PG_INT4_MAX ? (value as number) : null;
}

function classOf(code: number | null, subcode: number | null): IntegrationErrorClass {
  if (code === null) return 'unknown';
  if (code === 190) {
    if (subcode === null || AUTHENTICATION_SUBCODES.has(subcode)) return 'authentication';
    if (USER_ACTION_SUBCODES.has(subcode)) return 'user_action';
    // CA-39: cualquier otro código va a desconocido y nunca pasa solo a `needs_reauth`.
    return 'unknown';
  }
  if (code === 10 || (code >= 200 && code <= 299)) return 'permission';
  if (RATE_LIMIT_CODES.has(code)) return 'rate_limit';
  if (TEMPORARY_CODES.has(code)) return 'temporary';
  if (OWN_ERROR_CODES.has(code)) return 'own_error';
  // `asset_access` exige la evidencia de H-04: no se asigna en M16.1.
  return 'unknown';
}

/** Lee del cuerpo solo `error.code` y `error.error_subcode`. Nunca mira el estado HTTP. */
export function classifyGraphError(body: unknown): MetaFailure {
  const error =
    body && typeof body === 'object' && !Array.isArray(body) ? (body as { error?: unknown }).error : undefined;
  const fields = error && typeof error === 'object' && !Array.isArray(error) ? (error as Record<string, unknown>) : {};
  const graphCode = graphInteger(fields.code);
  const graphSubcode = graphCode === null ? null : graphInteger(fields.error_subcode);
  // Un subcódigo presente pero inválido no se lee como "sin subcódigo".
  const badSubcode = fields.error_subcode !== undefined && fields.error_subcode !== null && graphSubcode === null;
  return { errorClass: badSubcode ? 'unknown' : classOf(graphCode, graphSubcode), graphCode, graphSubcode };
}

function redactedMessageFor(failure: MetaFailure): string {
  const text = META_FAILURE_TEXTS[failure.errorClass];
  const prefix =
    failure.graphCode === null
      ? 'Graph sin código'
      : failure.graphSubcode === null
        ? `Graph ${failure.graphCode}`
        : `Graph ${failure.graphCode}/${failure.graphSubcode}`;
  const message = redactErrorMessage(`${prefix}: ${text}`);
  return redactedErrorMessageSchema.safeParse(message).success ? message : META_FAILURE_TEXTS.unknown;
}

/** Error de Meta: clase, código y subcódigo validados, y textos fijos. Sin `cause`. */
export class MetaApiError extends Error {
  readonly errorClass: IntegrationErrorClass;
  readonly graphCode: number | null;
  readonly graphSubcode: number | null;
  readonly redactedMessage: string;

  constructor(failure: MetaFailure) {
    super(META_FAILURE_TEXTS[failure.errorClass]);
    this.name = 'MetaApiError';
    this.errorClass = failure.errorClass;
    this.graphCode = failure.graphCode;
    this.graphSubcode = failure.graphSubcode;
    this.redactedMessage = redactedMessageFor(failure);
  }
}

/** Timeout, error de red o respuesta ilegible. */
export function transportError(): MetaApiError {
  return new MetaApiError({ errorClass: 'transport', graphCode: null, graphSubcode: null });
}
