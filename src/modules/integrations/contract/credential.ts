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

/** CA-32: sin `ads_read` no hay credencial de Meta que sirva. */
export const REQUIRED_SCOPE = 'ads_read';

/**
 * M16e §1: Tiendanube recibe exactamente estos tres permisos de lectura, en cualquier
 * orden. Cualquier otro conjunto, con uno de más o de menos, se rechaza.
 */
export const TIENDANUBE_SCOPES = Object.freeze(['read_customers', 'read_orders', 'read_products'] as const);
export const GA4_READONLY_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

/**
 * CA-11c (enmendado por M16e): tipo de token por proveedor. DEC-02 fija el token de system
 * user de integración para Meta (H-02; M16.1 traduce `debug_token` a este valor); Tiendanube
 * entrega un token de la app para la tienda, sin vencimiento.
 */
export const tokenTypeSchema = z.enum(['system_user', 'store_app_token', 'google_refresh_token']);
export type TokenType = z.infer<typeof tokenTypeSchema>;

export const TOKEN_TYPE_BY_PROVIDER: Readonly<Record<IntegrationProvider, TokenType>> = Object.freeze({
  meta: 'system_user',
  tiendanube: 'store_app_token',
  ga4: 'google_refresh_token',
});

const scopeSchema = z.string().refine(
  (value) => /^[a-z][a-z0-9_]{0,63}$/.test(value) || value === GA4_READONLY_SCOPE,
);

/** Los permisos son exactamente los tres de Tiendanube, sin repetir. */
export function isExactTiendanubeScopes(scopes: readonly string[]): boolean {
  return scopes.length === TIENDANUBE_SCOPES.length && new Set(scopes).size === scopes.length &&
    scopes.every((scope) => (TIENDANUBE_SCOPES as readonly string[]).includes(scope));
}

/**
 * Reglas de K04 que dependen del proveedor, espejo de `integration_credentials_token_type` y
 * `private.valid_provider_scopes` (0023): Meta exige `system_user` y `ads_read`; Tiendanube,
 * `store_app_token`, los tres `read_*` exactos y ningún vencimiento.
 */
export function credentialProviderIssues(input: {
  provider: IntegrationProvider; token_type: TokenType; granted_scopes: readonly string[];
  expires_at: string | null; issued_for_app_id: string;
}): string[] {
  const issues: string[] = [];
  if (input.token_type !== TOKEN_TYPE_BY_PROVIDER[input.provider]) issues.push('token_type');
  if (input.provider === 'meta' &&
      (!input.granted_scopes.includes(REQUIRED_SCOPE) || input.granted_scopes.includes(GA4_READONLY_SCOPE))) {
    issues.push('granted_scopes');
  }
  if (input.provider === 'tiendanube') {
    if (!isExactTiendanubeScopes(input.granted_scopes)) issues.push('granted_scopes');
    if (input.expires_at !== null) issues.push('expires_at');
  }
  if (input.provider === 'ga4') {
    if (input.granted_scopes.length !== 1 || input.granted_scopes[0] !== GA4_READONLY_SCOPE) {
      issues.push('granted_scopes');
    }
    if (input.expires_at !== null) issues.push('expires_at');
    if (!/^[1-9][0-9]*$/.test(input.issued_for_app_id)) issues.push('issued_for_app_id');
  }
  return issues;
}

export const secretCredentialSchema = z.strictObject({
  /** CA-13: toda credencial referencia una conexión. */
  connection_id: uuidSchema,
  company_id: uuidSchema,
  /** M16e: la credencial guarda su proveedor, igual al de su conexión (FK compuesta). */
  provider: integrationProviderSchema,
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
    }),
  /** Expiración real informada por Meta, o `null` si no la informa (CA-31). Tiendanube: siempre `null`. */
  expires_at: isoDateTimeSchema.nullable(),
}).superRefine((credential, ctx) => {
  for (const field of credentialProviderIssues(credential)) {
    ctx.addIssue({ code: 'custom', path: [field], message: `${field} no corresponde a ${credential.provider}` });
  }
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
