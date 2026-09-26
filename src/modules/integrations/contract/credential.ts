import { z } from 'zod';

import {
  base64OfBytes,
  base64Schema,
  integrationProviderSchema,
  isoDateTimeSchema,
  uuidSchema,
  type IntegrationProvider,
} from './primitives';

/**
 * K04 `SecretCredential` (CA-10 a CA-13): la credencial cifrada, tal como la guarda
 * `private.integration_credentials`.
 *
 * No hay ningún campo para el token en claro. El cifrado y el descifrado (AES-256-GCM,
 * CA-23 a CA-25) son de M06.3a; este contrato fija la forma del material cifrado y los
 * datos autenticados.
 */

/** AES-256-GCM: IV de 96 bits y etiqueta de autenticación de 128 bits. */
export const GCM_IV_BYTES = 12;
export const GCM_AUTH_TAG_BYTES = 16;

/** CA-32: sin `ads_read` no hay credencial que sirva. */
export const REQUIRED_SCOPE = 'ads_read';

/**
 * CA-11c: tipo de token. DEC-02 fija el token de system user de integración. La forma
 * en que `debug_token` lo informa es H-02; M16.1 traduce esa respuesta a este valor.
 */
export const tokenTypeSchema = z.enum(['system_user']);
export type TokenType = z.infer<typeof tokenTypeSchema>;

const scopeSchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);

export const secretCredentialSchema = z.strictObject({
  /** CA-13: toda credencial referencia una conexión. */
  connection_id: uuidSchema,
  company_id: uuidSchema,
  /** CA-10 y CA-11: solo material cifrado, con su IV, etiqueta y versión de clave. */
  ciphertext: base64Schema.min(1),
  iv: base64OfBytes(GCM_IV_BYTES),
  auth_tag: base64OfBytes(GCM_AUTH_TAG_BYTES),
  key_version: z.int().positive(),
  /** CA-11c. */
  token_type: tokenTypeSchema,
  issued_for_app_id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  granted_scopes: z
    .array(scopeSchema)
    .min(1)
    .refine((scopes) => new Set(scopes).size === scopes.length, {
      message: 'los permisos no se repiten',
    })
    .refine((scopes) => scopes.includes(REQUIRED_SCOPE), {
      message: `falta el permiso ${REQUIRED_SCOPE}`,
    }),
  /** Expiración real informada por Meta, o `null` si no la informa (CA-31). */
  expires_at: isoDateTimeSchema.nullable(),
});

export type SecretCredential = z.infer<typeof secretCredentialSchema>;

export const credentialAadInputSchema = z.strictObject({
  company_id: uuidSchema,
  connection_id: uuidSchema,
  provider: integrationProviderSchema,
});

export type CredentialAadInput = {
  company_id: string;
  connection_id: string;
  provider: IntegrationProvider;
};

const AAD_VERSION = 'praxa.credential.v1';

/**
 * CA-11b: datos autenticados del cifrado. Un texto cifrado movido a otra empresa, otra
 * conexión u otro proveedor no descifra, porque su AAD ya no coincide. Los componentes
 * se validan antes de unirlos, así que el separador no puede aparecer dentro de uno.
 */
export function buildCredentialAad(input: CredentialAadInput): string {
  const { company_id, connection_id, provider } = credentialAadInputSchema.parse(input);
  return [AAD_VERSION, provider, company_id, connection_id].join('|');
}
