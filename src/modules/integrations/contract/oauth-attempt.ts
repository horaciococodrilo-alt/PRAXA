import { z } from 'zod';

import {
  integrationProviderSchema,
  isoDateTimeSchema,
  returnPathSchema,
  sha256HexSchema,
  uuidSchema,
} from './primitives';

/**
 * K02 `OAuthAttempt`: intento de autorización de un solo uso (CA-01 a CA-05).
 *
 * El registro no tiene ningún campo para el `state` ni para el nonce en claro: solo sus
 * hashes. El consumo único y atómico (CA-03) lo hace `worker_api.consume_oauth_attempt`
 * en una sola sentencia; acá están el tipo, el criterio de vencimiento y el error tipado.
 */

/** CA-01: bytes aleatorios mínimos del `state`, y también del nonce de la cookie. */
export const OAUTH_STATE_MIN_BYTES = 32;

/**
 * CA-02: vida máxima de un intento. La spec pide un vencimiento "explícito y corto" sin
 * fijar el valor; diez minutos alcanzan para completar el diálogo de Meta.
 */
export const OAUTH_ATTEMPT_MAX_TTL_MS = 10 * 60 * 1000;

const MIN_BASE64URL_LENGTH = Math.ceil((OAUTH_STATE_MIN_BYTES * 4) / 3);

/**
 * Forma del `state` y del nonce en tránsito: base64url sin relleno, de 32 bytes o más.
 * Sirve para validar lo que llega al callback antes de calcular su hash; nunca se guarda.
 */
export const oauthStateSchema = z
  .string()
  .regex(
    new RegExp(`^[A-Za-z0-9_-]{${MIN_BASE64URL_LENGTH},256}$`),
    `debe ser base64url de ${OAUTH_STATE_MIN_BYTES} bytes o más`,
  );

/**
 * CA-02b: la cookie que guarda el nonce de vinculación al navegador. El prefijo
 * `__Host-` obliga al navegador a exigir `Secure`, `Path=/` y ningún `Domain`.
 */
export const BROWSER_BINDING_COOKIE = Object.freeze({
  name: '__Host-praxa_oauth_binding',
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
} as const);

/** CA-02c. */
export const oauthPurposeSchema = z.enum(['initial', 'reauth']);
export type OAuthPurpose = z.infer<typeof oauthPurposeSchema>;

const commonShape = {
  id: uuidSchema,
  provider: integrationProviderSchema,
  /** CA-02b: empresa y actor salen del K01 del servidor que inició el intento. */
  company_id: uuidSchema,
  actor_user_id: uuidSchema,
  state_hash: sha256HexSchema,
  browser_binding_hash: sha256HexSchema,
  return_path: returnPathSchema,
  created_at: isoDateTimeSchema,
  expires_at: isoDateTimeSchema,
  consumed_at: isoDateTimeSchema.nullable(),
};

const initialAttemptSchema = z.strictObject({
  ...commonShape,
  purpose: z.literal('initial'),
  expected_connection_id: z.null(),
  expected_generation: z.null(),
});

const reauthAttemptSchema = z.strictObject({
  ...commonShape,
  purpose: z.literal('reauth'),
  expected_connection_id: uuidSchema,
  expected_generation: z.int().nonnegative(),
});

export const oauthAttemptSchema = z
  .discriminatedUnion('purpose', [initialAttemptSchema, reauthAttemptSchema])
  .superRefine((attempt, ctx) => {
    const ttl = Date.parse(attempt.expires_at) - Date.parse(attempt.created_at);
    if (!(ttl > 0 && ttl <= OAUTH_ATTEMPT_MAX_TTL_MS)) {
      ctx.addIssue({
        code: 'custom',
        path: ['expires_at'],
        message: `el vencimiento debe ser posterior a la creación y de ${OAUTH_ATTEMPT_MAX_TTL_MS / 60000} minutos o menos`,
      });
    }
  });

export type OAuthAttempt = z.infer<typeof oauthAttemptSchema>;

/**
 * CA-02 y CA-03, del lado de la aplicación: un intento consumido o vencido no se
 * consume. La base repite este chequeo en la misma sentencia que marca el consumo.
 */
export function isOAuthAttemptConsumable(
  attempt: Pick<OAuthAttempt, 'expires_at' | 'consumed_at'>,
  now: Date,
): boolean {
  return attempt.consumed_at === null && now.getTime() < Date.parse(attempt.expires_at);
}

/**
 * CA-03 y CA-29: el rechazo de un intento es un único error tipado, sin decir cuál de
 * las condiciones falló. El mensaje es comprensible y no tiene detalles internos.
 */
export class OAuthAttemptRejectedError extends Error {
  constructor() {
    super('La autorización no es válida o ya se usó. Volvé a iniciar la conexión.');
    this.name = 'OAuthAttemptRejectedError';
  }
}
