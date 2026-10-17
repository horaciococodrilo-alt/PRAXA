import 'server-only';

import type { IntegrationErrorClass } from '@/modules/integrations/contract';
import { SecretValue } from '../crypto/seal';
import type { MetaOAuthConfig } from './api';
import type { MetaHttpClient } from './client';
import { MetaApiError } from './errors';

export type RevokeResult = Readonly<{ status: 'revoked' } | { status: 'failed'; errorClass: IntegrationErrorClass }>;

export async function revokeToken(
  token: SecretValue,
  deps: { http: MetaHttpClient; config: MetaOAuthConfig },
): Promise<RevokeResult> {
  try {
    const body = await deps.http.postBatchGetJson('oauth/revoke', {
      client_id: deps.config.appId,
      client_secret: deps.config.appSecret,
      revoke_token: token,
    }, token);
    if (body && typeof body === 'object' && !Array.isArray(body) &&
        ((body as { success?: unknown }).success === true || (body as { success?: unknown }).success === 'true')) {
      return { status: 'revoked' };
    }
    return { status: 'failed', errorClass: 'unknown' };
  } catch (error) {
    return { status: 'failed', errorClass: error instanceof MetaApiError ? error.errorClass : 'unknown' };
  }
}
