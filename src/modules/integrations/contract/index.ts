/**
 * Contratos del conector de integraciones: K02 `OAuthAttempt`, K03
 * `IntegrationConnection` y K04 `SecretCredential`. K01 `TenantContext` vive en
 * `@/modules/tenant/context`.
 *
 * Sin base de datos ni red. Las garantías que dependen de la base (consumo único,
 * transiciones, privilegios) las hace cumplir `worker_api` desde M06.1a.
 */

export {
  CONNECTION_STATUSES,
  CONNECTION_TRANSITIONS,
  ConnectionTransitionError,
  REDACTED_ERROR_MESSAGE_MAX,
  RETURN_PATH_ALLOWLIST,
  assertConnectionTransition,
  connectionStatusSchema,
  integrationErrorClassSchema,
  integrationProviderSchema,
  isDeclaredTransition,
  reauthErrorClassSchema,
  redactErrorMessage,
  redactedErrorMessageSchema,
  returnPathSchema,
  sha256HexSchema,
  type ConnectionStatus,
  type IntegrationErrorClass,
  type IntegrationProvider,
  type ReauthErrorClass,
  type ReturnPath,
} from './primitives';

export {
  BROWSER_BINDING_COOKIE,
  OAUTH_ATTEMPT_MAX_TTL_MS,
  OAUTH_STATE_MIN_BYTES,
  OAuthAttemptRejectedError,
  isOAuthAttemptConsumable,
  oauthAttemptSchema,
  oauthPurposeSchema,
  oauthStateSchema,
  type OAuthAttempt,
  type OAuthPurpose,
} from './oauth-attempt';

export {
  clientBusinessIdSchema,
  currencyCodeSchema,
  externalAccountIdSchema,
  integrationConnectionDtoSchema,
  integrationConnectionRecordSchema,
  maskExternalAccountId,
  timeZoneSchema,
  toConnectionDto,
  type IntegrationConnectionDto,
  type IntegrationConnectionRecord,
} from './connection';

export {
  GCM_AUTH_TAG_BYTES,
  GCM_IV_BYTES,
  REQUIRED_SCOPE,
  buildCredentialAad,
  credentialAadInputSchema,
  secretCredentialSchema,
  tokenTypeSchema,
  type CredentialAadInput,
  type SecretCredential,
  type TokenType,
} from './credential';
