import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { GA4_SCOPE, authorizationUrl, parseTokenExchange, parseRefreshResponse,
  classifyGa4Error, normalizeSiteHost, propertyIdFromName } from '@/modules/integrations/ga4/google';

const config = { clientId: '123-example.apps.googleusercontent.com', clientSecret: 'example',
  redirectUri: 'https://example.test/api/integraciones/ga4/callback', appId: '123' };

describe('GA4 OAuth contract', () => {
  it('pide solo lectura y consentimiento offline', () => {
    const url = authorizationUrl(config, 'state');
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('scope')).toBe(GA4_SCOPE);
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.has('include_granted_scopes')).toBe(false);
  });

  it('rechaza canje sin refresh o con scopes extra', () => {
    const valid = { access_token: 'a', refresh_token: 'r', scope: GA4_SCOPE,
      token_type: 'Bearer', expires_in: 3600 };
    expect(parseTokenExchange(valid).refreshToken.reveal()).toBe('r');
    expect(() => parseTokenExchange({ ...valid, refresh_token: undefined })).toThrow();
    expect(() => parseTokenExchange({ ...valid, scope: `${GA4_SCOPE} email` })).toThrow();
  });

  it('descarta la rotación del refresh token y solo registra un indicador', () => {
    const result = parseRefreshResponse({ access_token: 'new', token_type: 'Bearer',
      expires_in: 3600, scope: GA4_SCOPE, refresh_token: 'rotated-secret' });
    expect(result.rotated).toBe(true);
    expect(JSON.stringify(result)).not.toContain('rotated-secret');
  });

  it.each([
    [400, 'consulta_invalida', 'own_error'], [403, 'sin_acceso_propiedad', 'permission'],
    [429, 'cuota', 'rate_limit'], [500, 'transitorio', 'temporary'],
    [503, 'transitorio', 'temporary'], [401, 'autorizacion_perdida', 'authentication'],
  ] as const)('clasifica HTTP %i', (status, kind, errorClass) => {
    expect(classifyGa4Error(status)).toEqual({ kind, errorClass });
  });

  it('valida IDs y normaliza hosts', () => {
    expect(propertyIdFromName('properties/12345')).toBe('12345');
    expect(propertyIdFromName('properties/0')).toBeNull();
    expect(normalizeSiteHost('https://WWW.Example.test/shop')).toBe('example.test');
  });
});
