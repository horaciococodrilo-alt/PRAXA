import { randomBytes, randomUUID } from 'node:crypto';

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { GA4_SCOPE, type Ga4Http } from '@/modules/integrations/ga4/google';
import { handleGa4Callback, handleGa4Start, type Ga4OAuthDeps } from '@/modules/integrations/ga4/oauth';
import { parseCredentialKeyring } from '@/modules/integrations/crypto/keyring';
import { OAuthAttemptRejectedError } from '@/modules/integrations/contract';
import type { IntegrationConnectionRecord } from '@/modules/integrations/contract';
import { disconnectGa4 } from '@/modules/integrations/lifecycle';
import type { WorkerApi } from '@/modules/integrations/db/worker-api';
import type { TenantContext } from '@/modules/tenant/context';

const origin = 'https://praxa.test';
const scope = GA4_SCOPE;
const ctx: TenantContext = { user_id: '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d',
  company_id: '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f', role: 'owner',
  request_id: '7c6b5a49-3827-4165-a4b3-c2d1e0f9a8b7' };
const config = { clientId: '123-example.apps.googleusercontent.com', clientSecret: 'synthetic',
  redirectUri: `${origin}/api/integraciones/ga4/callback`, appId: '123' };
const ring = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');

function harness(body: unknown = { access_token: 'access-synthetic', refresh_token: 'refresh-synthetic',
  scope, token_type: 'Bearer', expires_in: 3600 }) {
  const calls: string[] = [];
  const logs: unknown[] = [];
  let consumed = false;
  const workerApi: WorkerApi = { call: (async (fn: string, args: readonly unknown[]) => {
    calls.push(fn);
    if (fn === 'list_pending_purges') return [];
    if (fn === 'create_oauth_attempt') return [{ attempt_id: randomUUID(), purpose: args[3],
      expected_connection_id: null, expected_generation: null, created_at: new Date(),
      expires_at: new Date(String(args[7])) }];
    if (fn === 'consume_oauth_attempt') {
      if (consumed) throw new OAuthAttemptRejectedError();
      consumed = true;
      return [{ attempt_id: randomUUID(), purpose: 'initial', expected_connection_id: null,
        expected_generation: null, return_path: '/app/integraciones' }];
    }
    if (fn === 'create_pending_connection') return [{ connection_id: args[2], status: 'pending_selection',
      pending_expires_at: new Date(Date.now() + 1_800_000), credential_generation: 0 }];
    throw new Error('Llamada inesperada.');
  }) as WorkerApi['call'] };
  const http: Ga4Http = { exchangeCode: async () => body,
    refresh: async () => { throw new Error('No corresponde.'); },
    getAdmin: async () => { throw new Error('No corresponde.'); },
    getMetadata: async () => { throw new Error('No corresponde.'); },
    checkCompatibility: async () => { throw new Error('No corresponde.'); },
    runReport: async () => { throw new Error('No corresponde.'); } };
  const deps: Partial<Ga4OAuthDeps> = { tenant: async () => ctx, config: () => config,
    http, workerApi: () => workerApi, keyring: () => ring, readLive: async () => null,
    readConnection: async () => null, log: (event) => { logs.push(event); } };
  return { calls, logs, deps };
}

async function started(h: ReturnType<typeof harness>) {
  const start = await handleGa4Start(new NextRequest(`${origin}/api/integraciones/ga4/iniciar`,
    { method: 'POST', headers: { Origin: origin } }), h.deps);
  const auth = new URL(start.headers.get('location')!);
  const nonce = start.cookies.get('__Host-praxa_oauth_binding')?.value;
  return { start, auth, nonce };
}
function callback(state: string, nonce: string | undefined, extra = 'code=synthetic-code') {
  const url = `${origin}/api/integraciones/ga4/callback?state=${encodeURIComponent(state)}&${extra}`;
  return new NextRequest(url, { headers: nonce ? { Cookie: `__Host-praxa_oauth_binding=${nonce}` } : {} });
}

describe('OAuth GA4', () => {
  it('inicia con K02 y URL de solo lectura; rechaza origen ajeno', async () => {
    const h = harness();
    const forbidden = await handleGa4Start(new NextRequest(`${origin}/api/integraciones/ga4/iniciar`,
      { method: 'POST', headers: { Origin: 'https://other.test' } }), h.deps);
    expect(forbidden.status).toBe(403);
    expect(h.calls).toEqual([]);
    const { start, auth, nonce } = await started(h);
    expect(start.status).toBe(303);
    expect(auth.searchParams.get('scope')).toBe(scope);
    expect(auth.searchParams.get('access_type')).toBe('offline');
    expect(auth.searchParams.get('prompt')).toBe('consent');
    expect(nonce).toBeTruthy();
    expect(h.calls).toContain('create_oauth_attempt');
  });

  it('consume una vez, cifra refresh y redirige sin code ni token', async () => {
    const h = harness();
    const { auth, nonce } = await started(h);
    const request = callback(auth.searchParams.get('state')!, nonce);
    const first = await handleGa4Callback(request, h.deps);
    expect(new URL(first.headers.get('location')!).searchParams.get('ga4')).toBe('pendiente');
    expect(first.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(h.calls).toContain('create_pending_connection');
    expect(JSON.stringify(h.logs)).not.toContain('synthetic-code');
    expect(JSON.stringify(h.logs)).not.toContain('refresh-synthetic');
    expect(first.headers.get('location')).not.toContain('synthetic-code');
    const replay = await handleGa4Callback(request, h.deps);
    expect(new URL(replay.headers.get('location')!).searchParams.get('ga4')).toBe('rechazado');
    expect(h.calls.filter((call) => call === 'create_pending_connection')).toHaveLength(1);
  });

  it('otro navegador, denegación y token o scope incompletos no crean conexión', async () => {
    for (const bad of ['other_browser', { access_token: 'a', token_type: 'Bearer', scope,
      expires_in: 3600 }, { access_token: 'a', refresh_token: 'r', token_type: 'Bearer',
      scope: `${scope} email`, expires_in: 3600 }]) {
      const h = harness(bad === 'other_browser' ? undefined : bad);
      const { auth, nonce } = await started(h);
      const result = await handleGa4Callback(callback(auth.searchParams.get('state')!,
        bad === 'other_browser' ? undefined : nonce), h.deps);
      expect(new URL(result.headers.get('location')!).searchParams.get('ga4')).toBe(
        bad === 'other_browser' ? 'rechazado' : 'reintentar');
      expect(h.calls).not.toContain('create_pending_connection');
    }
    const h = harness();
    const { auth, nonce } = await started(h);
    const denied = await handleGa4Callback(callback(auth.searchParams.get('state')!, nonce,
      'error=access_denied'), h.deps);
    expect(new URL(denied.headers.get('location')!).searchParams.get('ga4')).toBe('cancelado');
    expect(h.calls).not.toContain('create_pending_connection');
  });

  it('desconecta y purga GA4 solo en la base local', async () => {
    const id = randomUUID();
    const calls: string[] = [];
    const workerApi: WorkerApi = { call: (async (fn: string, args: readonly unknown[]) => {
      calls.push(fn);
      if (fn === 'begin_disconnect') return [{ connection_id: args[2], status: 'disconnected',
        credential_generation: 1, purge_requested_at: new Date() }];
      if (fn === 'list_pending_purges') return [{ connection_id: id, provider: 'ga4',
        status: 'disconnected', reason: 'disconnect_requested', has_credential: true,
        pending_expires_at: null, purge_requested_at: new Date() }];
      if (fn === 'purge_connection') return [{ purge_connection: true }];
      throw new Error('Llamada inesperada.');
    }) as WorkerApi['call'] };
    const result = await disconnectGa4({ tenant: async () => ctx, workerApi: () => workerApi,
      readConnection: async () => ({ id } as IntegrationConnectionRecord), log: () => {} });
    expect(result).toBe('desconectado');
    expect(calls).toEqual(['begin_disconnect', 'list_pending_purges', 'purge_connection']);
  });
});
