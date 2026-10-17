import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { graphUrl, readMetaOAuthConfig } from '@/modules/integrations/meta/api';
import { createMetaHttpClient, MetaRequestRejectedError, type MetaFetch } from '@/modules/integrations/meta/client';
import { MetaApiError, connectionEffectFor, NEEDS_REAUTH_TEXTS } from '@/modules/integrations/meta/errors';
import { META_OAUTH_OUTCOMES, META_OAUTH_MESSAGES, parseMetaOAuthOutcome } from '@/modules/integrations/meta/outcomes';
import { SecretValue, sealCredential } from '@/modules/integrations/crypto/seal';
import { parseCredentialKeyring } from '@/modules/integrations/crypto/keyring';
import { inspectToken } from '@/modules/integrations/meta/tokens';
import { revokeToken } from '@/modules/integrations/meta/revoke';
import { listDelegatedAccounts, AccountListLimitError } from '@/modules/integrations/meta/accounts';
import { probeInsights } from '@/modules/integrations/meta/probe';
import { confirmConnection, markNeedsReauth, beginDisconnect, purgeConnection, listPendingPurges } from
  '@/modules/integrations/repository/lifecycle-calls';
import type { WorkerApi } from '@/modules/integrations/db/worker-api';
import type { TenantContext } from '@/modules/tenant/context';
import { applyConnectionFailure, confirmAccount, loadMetaCardState, resolveAmbiguousWrite,
  runLazyPurge, disconnect } from '@/modules/integrations/lifecycle';
import { NoCompanyError } from '@/modules/company/service';
import { UnauthorizedError } from '@/modules/identity/session';
import { WorkerApiError } from '@/modules/integrations/db/worker-api';
import type { IntegrationConnectionRecord } from '@/modules/integrations/contract';

const TOKEN = 'token-sint';
const SECRET = 'secret-sint';
const CONFIG = readMetaOAuthConfig({
  META_APP_ID: '1234567',
  META_APP_SECRET: SECRET,
  META_CONFIG_ID: '7654321',
  META_REDIRECT_URI: 'https://praxa.test/api/integraciones/meta/callback',
} as unknown as NodeJS.ProcessEnv);
const CTX: TenantContext = { user_id: '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d',
  company_id: '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f', role: 'owner',
  request_id: '7c6b5a49-3827-4165-a4b3-c2d1e0f9a8b7' };
const CONNECTION_ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
const ACCOUNT = 'act_1001';
const keyring = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');
const selectionKey = (id = CONNECTION_ID, account = ACCOUNT) =>
  createHash('sha256').update(`${id}:${account}`).digest('hex');

function pendingRecord(expires = '2030-10-17T00:00:00.000Z'): IntegrationConnectionRecord {
  return { id: CONNECTION_ID, company_id: CTX.company_id, provider: 'meta',
    client_business_id: 'negocio_sintetico', credential_generation: 0, current_sync_run_id: null,
    last_error_class: null, last_error_message: null, created_at: '2026-10-17T00:00:00.000Z',
    updated_at: '2026-10-17T00:00:00.000Z', status: 'pending_selection',
    external_account_id: null, currency: null, timezone: null, pending_expires_at: expires,
    purge_requested_at: null };
}

function credentialRow() {
  return { connection_id: CONNECTION_ID, company_id: CTX.company_id, provider: 'meta',
    status: 'pending_selection', credential_generation: 0,
    ...sealCredential(TOKEN, { company_id: CTX.company_id, connection_id: CONNECTION_ID, provider: 'meta' }, keyring),
    token_type: 'system_user', issued_for_app_id: CONFIG.appId, granted_scopes: ['ads_read'], expires_at: null };
}

function batchMeta(operation: unknown, status = 200) {
  const calls: Array<{ url: URL; init: RequestInit }> = [];
  const fetch: MetaFetch = async (url, init) => {
    calls.push({ url, init });
    if (url.pathname !== '/v26.0/' || init.method !== 'POST') throw new Error('Se recibió una forma directa.');
    return new Response(JSON.stringify(operation), { status });
  };
  return { calls, http: createMetaHttpClient({ fetch }) };
}

function operationBody(call: { url: URL; init: RequestInit }) {
  expect(call.url.href).toBe('https://graph.facebook.com/v26.0/');
  expect(new Headers(call.init.headers).get('content-type')).toBe('application/x-www-form-urlencoded');
  const form = new URLSearchParams(String(call.init.body));
  const batch = JSON.parse(form.get('batch') ?? 'null');
  expect(batch).toHaveLength(1);
  expect(batch[0].method).toBe('GET');
  return { form, relative: new URL(batch[0].relative_url, 'https://graph.facebook.com/') };
}

describe('M16.2: transporte por lote y revocación', () => {
  it('T-14 revoca en un único POST por lote sin secretos en la URL de salida', async () => {
    for (const success of [true, 'true']) {
      const meta = batchMeta([{ code: 200, body: JSON.stringify({ success }) }]);
      expect(await revokeToken(new SecretValue(TOKEN), { http: meta.http, config: CONFIG })).toEqual({ status: 'revoked' });
      expect(meta.calls).toHaveLength(1);
      const { form, relative } = operationBody(meta.calls[0]);
      expect(form.get('access_token')).toBe(TOKEN);
      expect(relative.pathname).toBe('/oauth/revoke');
      expect(relative.searchParams.get('client_id')).toBe(CONFIG.appId);
      expect(relative.searchParams.get('client_secret')).toBe(SECRET);
      expect(relative.searchParams.get('revoke_token')).toBe(TOKEN);
      expect(meta.calls[0].url.href).not.toContain(TOKEN);
      expect(meta.calls[0].url.href).not.toContain(SECRET);
    }
    expect(() => graphUrl('x', { revoke_token: 'y' })).toThrow();
    const meta = batchMeta([]);
    await expect(meta.http.getJson(new URL('https://graph.facebook.com/v26.0/x?revoke_token=y')))
      .rejects.toBeInstanceOf(MetaRequestRejectedError);
    expect(meta.calls).toHaveLength(0);
  });

  it('T-47 inspecciona el token por lote y conserva las validaciones', async () => {
    const meta = batchMeta([{ code: 200, body: JSON.stringify({ data: {
      is_valid: true, app_id: CONFIG.appId, type: 'SYSTEM_USER', scopes: ['ads_read'], expires_at: 0,
    } }) }]);
    expect((await inspectToken(new SecretValue(TOKEN), { http: meta.http, config: CONFIG })).tokenType)
      .toBe('system_user');
    expect(meta.calls).toHaveLength(1);
    const { form, relative } = operationBody(meta.calls[0]);
    expect(form.get('access_token')).toBe(`${CONFIG.appId}|${SECRET}`);
    expect(relative.pathname).toBe('/debug_token');
    expect(relative.searchParams.get('input_token')).toBe(TOKEN);
    await expect(meta.http.postBatchGetJson('me', {}, new SecretValue(TOKEN))).rejects
      .toBeInstanceOf(MetaRequestRejectedError);
    expect(meta.calls).toHaveLength(1);
  });

  it.each([
    ['no JSON externo', 'no-json', 200, 'transport'],
    ['objeto externo', {}, 200, 'unknown'],
    ['dos operaciones', [{ code: 200, body: '{}' }, { code: 200, body: '{}' }], 200, 'unknown'],
    ['operación nula', [null], 200, 'transport'],
    ['código 190', [{ code: 400, body: '{"error":{"code":190}}' }], 200, 'authentication'],
    ['sin error', [{ code: 500, body: '{}' }], 200, 'unknown'],
    ['código 2', [{ code: 400, body: '{"error":{"code":2}}' }], 200, 'temporary'],
    ['cuerpo ilegible', [{ code: 200, body: 'no-json' }], 200, 'transport'],
  ] as const)('T-47 clasifica %s', async (_label, result, status, errorClass) => {
    const calls: URL[] = [];
    const http = createMetaHttpClient({ fetch: async (url) => {
      calls.push(url);
      return new Response(typeof result === 'string' ? result : JSON.stringify(result), { status });
    } });
    try {
      await http.postBatchGetJson('debug_token', { input_token: new SecretValue(TOKEN) }, new SecretValue(SECRET));
      throw new Error('La forma inválida fue aceptada.');
    } catch (error) {
      expect(error).toBeInstanceOf(MetaApiError);
      expect((error as MetaApiError).errorClass).toBe(errorClass);
      expect(String(error)).not.toContain(TOKEN);
      expect(String(error)).not.toContain(SECRET);
      expect(String(error)).not.toContain('relative_url');
    }
    expect(calls).toHaveLength(1);
  });
});

describe('M16.2: cuentas delegadas y probe', () => {
  it('T-01 pagina con after, deduplica y nunca pide paging.next', async () => {
    const calls: URL[] = [];
    const http = createMetaHttpClient({ fetch: async (url, init) => {
      calls.push(url);
      expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${TOKEN}`);
      const after = url.searchParams.get('after');
      const account = after === null ? 'act_1001' : after === 'cur-1' ? 'act_1002' : 'act_1003';
      const next = after === 'cur-2' ? undefined : `https://evil.test/?access_token=${TOKEN}`;
      const cursor = after === null ? 'cur-1' : 'cur-2';
      return new Response(JSON.stringify({ data: [{ id: account, name: 'Cuenta sintética', currency: 'USD',
        timezone_name: 'America/Argentina/Buenos_Aires' }], paging: { next, cursors: { after: cursor } } }));
    } });
    const listed = await listDelegatedAccounts(new SecretValue(TOKEN), '5550001', { http });
    expect(listed.accounts.map((a) => a.id)).toEqual(['act_1001', 'act_1002', 'act_1003']);
    expect(listed.pages).toBe(3);
    expect(calls).toHaveLength(3);
    expect(calls.map((url) => url.searchParams.get('after'))).toEqual([null, 'cur-1', 'cur-2']);
    for (const url of calls) {
      expect(url.pathname).toBe('/v26.0/5550001/assigned_ad_accounts');
      expect(url.searchParams.get('fields')).toBe('id,name,currency,timezone_name');
      expect(url.searchParams.get('limit')).toBe('100');
      expect(url.href).not.toContain(TOKEN);
    }
  });

  it('T-02 limita páginas y rechaza ids y respuestas inválidas', async () => {
    let calls = 0;
    const http = createMetaHttpClient({ fetch: async () => {
      calls += 1;
      return new Response(JSON.stringify({ data: [], paging: { next: 'x', cursors: { after: `c${calls}` } } }));
    } });
    await expect(listDelegatedAccounts(new SecretValue(TOKEN), '5550001', { http }))
      .rejects.toBeInstanceOf(AccountListLimitError);
    expect(calls).toBe(10);
    await expect(listDelegatedAccounts(new SecretValue(TOKEN), 'bad-id', { http })).rejects.toThrow();
    expect(calls).toBe(10);
    const invalid = createMetaHttpClient({ fetch: async () => new Response('{}') });
    await expect(listDelegatedAccounts(new SecretValue(TOKEN), '5550001', { http: invalid }))
      .rejects.toMatchObject({ errorClass: 'unknown' });
  });

  it('T-03 descarta cuentas inválidas y cuenta duplicados una vez', async () => {
    const rows = [
      { id: '123', name: 'a', currency: 'USD', timezone_name: 'UTC' },
      { id: 'act_x', name: 'b', currency: 'USD', timezone_name: 'UTC' },
      { id: 'act_2', name: 'c', currency: 'ZZZ', timezone_name: 'UTC' },
      { id: 'act_3', name: 'd', currency: 'USD', timezone_name: 'Mars/Base' },
      { id: 'act_1001', name: ' válida ', currency: 'USD', timezone_name: 'UTC' },
      { id: 'act_1001', name: 'duplicada', currency: 'USD', timezone_name: 'UTC' },
    ];
    const http = createMetaHttpClient({ fetch: async () => new Response(JSON.stringify({ data: rows })) });
    const listed = await listDelegatedAccounts(new SecretValue(TOKEN), '5550001', { http });
    expect(listed.accounts).toEqual([{ id: 'act_1001', name: 'válida', currency: 'USD', timezone: 'UTC' }]);
    expect(listed.discarded).toBe(4);
  });

  it('T-04 resume filas y campos sin conservar valores y acota páginas', async () => {
    const calls: URL[] = [];
    const http = createMetaHttpClient({ fetch: async (url, init) => {
      calls.push(url);
      expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${TOKEN}`);
      const page = calls.length;
      return new Response(JSON.stringify({ data: [{ date_start: '2026-10-01', spend: '1.23', impressions: '9' }],
        paging: page < 6 ? { next: 'ignored', cursors: { after: `p${page}` } } : undefined }));
    } });
    const summary = await probeInsights(new SecretValue(TOKEN), 'act_1001', { http, now: () => 1000 });
    expect(summary).toMatchObject({ rows: 5, pages: 5, calls: 5, complete: false,
      fieldsPresent: ['date_start', 'spend', 'impressions'] });
    expect(JSON.stringify(summary)).not.toContain('1.23');
    expect(calls).toHaveLength(5);
    expect(calls[0].searchParams.get('level')).toBe('account');
    expect(calls[0].searchParams.get('fields')).toBe('spend,impressions');
    expect(calls[0].searchParams.get('time_increment')).toBe('1');
    expect(calls[0].searchParams.get('date_preset')).toBe('last_28d');
    expect(calls[0].searchParams.get('limit')).toBe('100');
    const empty = createMetaHttpClient({ fetch: async () => new Response('{"data":[]}') });
    expect((await probeInsights(new SecretValue(TOKEN), 'act_1001', { http: empty, now: () => 1000 })).rows).toBe(0);
    let page = 0;
    const complete = createMetaHttpClient({ fetch: async () => {
      page += 1;
      return new Response(JSON.stringify({ data: [{ spend: '1.23' }],
        ...(page === 1 ? { paging: { next: 'ignorado', cursors: { after: 'cur-1' } } } : {}) }));
    } });
    expect(await probeInsights(new SecretValue(TOKEN), ACCOUNT, { http: complete, now: () => 1000 }))
      .toMatchObject({ rows: 2, pages: 2, calls: 2, complete: true, fieldsPresent: ['spend'] });
  });

  it('T-05 propaga la clase de error sin publicar la cuenta', async () => {
    for (const code of [100, 200, 4, 2]) {
      const http = createMetaHttpClient({ fetch: async () => new Response(JSON.stringify({ error: { code } }), { status: 400 }) });
      try {
        await probeInsights(new SecretValue(TOKEN), 'act_1001', { http, now: () => 1000 });
        throw new Error('Se aceptó un error de Meta.');
      } catch (error) {
        expect(error).toBeInstanceOf(MetaApiError);
        expect(String(error)).not.toContain('act_1001');
      }
    }
    for (const respond of [async () => { throw new TypeError('red caída'); },
      async () => new Response('respuesta ilegible')]) {
      const http = createMetaHttpClient({ fetch: respond });
      await expect(probeInsights(new SecretValue(TOKEN), ACCOUNT, { http, now: () => 1000 }))
        .rejects.toMatchObject({ errorClass: 'transport' });
    }
  });
});

describe('M16.2: adaptadores de ciclo de vida', () => {
  function worker(rows: unknown[]) {
    const calls: Array<{ fn: string; args: readonly unknown[] }> = [];
    const workerApi = { call: async (fn: string, args: readonly unknown[]) => {
      calls.push({ fn, args });
      return rows;
    } } as WorkerApi;
    return { calls, workerApi };
  }

  it('envía confirmación validada y exige respuesta exacta', async () => {
    const fake = worker([{ connection_id: CONNECTION_ID, status: 'active', credential_generation: 0 }]);
    const result = await confirmConnection(CTX, { connectionId: CONNECTION_ID, externalAccountId: 'act_1001',
      currency: 'USD', timezone: 'UTC' }, { workerApi: fake.workerApi });
    expect(result).toEqual({ connectionId: CONNECTION_ID, status: 'active', credentialGeneration: 0 });
    expect(fake.calls).toEqual([{ fn: 'confirm_connection',
      args: [CTX.user_id, CTX.company_id, CONNECTION_ID, 'act_1001', 'USD', 'UTC', true] }]);
    await expect(confirmConnection(CTX, { connectionId: CONNECTION_ID, externalAccountId: 'act_1001',
      currency: 'ZZZ', timezone: 'UTC' }, { workerApi: fake.workerApi })).rejects.toThrow();
    expect(fake.calls).toHaveLength(1);
    const malformed = worker([{ connection_id: CONNECTION_ID, status: 'active', credential_generation: 0,
      extra: 'no' }]);
    await expect(confirmConnection(CTX, { connectionId: CONNECTION_ID, externalAccountId: 'act_1001',
      currency: 'USD', timezone: 'UTC' }, { workerApi: malformed.workerApi })).rejects.toThrow();
  });

  it('valida marca, bloqueo, purga y listado', async () => {
    const marked = worker([{ connection_id: CONNECTION_ID, status: 'needs_reauth', credential_generation: 2 }]);
    expect(await markNeedsReauth(CTX, { connectionId: CONNECTION_ID, expectedGeneration: 2,
      errorClass: 'authentication', message: 'Meta rechazó la credencial.' }, { workerApi: marked.workerApi }))
      .toEqual({ connectionId: CONNECTION_ID, status: 'needs_reauth', credentialGeneration: 2 });
    expect(marked.calls[0].args).toEqual([CTX.user_id, CTX.company_id, CONNECTION_ID, 2,
      'authentication', 'Meta rechazó la credencial.']);
    const blocked = worker([{ connection_id: CONNECTION_ID, status: 'disconnected', credential_generation: 2,
      purge_requested_at: new Date('2026-10-17T00:00:00.000Z') }]);
    expect(await beginDisconnect(CTX, CONNECTION_ID, { workerApi: blocked.workerApi }))
      .toEqual({ connectionId: CONNECTION_ID, credentialGeneration: 2 });
    const purged = worker([{ purge_connection: true }]);
    expect(await purgeConnection(CTX, CONNECTION_ID, { workerApi: purged.workerApi })).toBe(true);
    const listed = worker([{ connection_id: CONNECTION_ID, status: 'pending_selection', reason: 'pending_expired',
      has_credential: true, pending_expires_at: new Date('2026-10-17T00:00:00.000Z'), purge_requested_at: null }]);
    expect(await listPendingPurges(CTX, { workerApi: listed.workerApi })).toEqual([{
      connectionId: CONNECTION_ID, status: 'pending_selection', reason: 'pending_expired', hasCredential: true,
    }]);
  });
});

describe('M16.2: purga reanudable', () => {
  it('T-11 bloquea una pendiente vencida, revoca, purga y limita el lote', async () => {
    const events: string[] = [];
    const meta = batchMeta([{ code: 200, body: '{"success":true}' }]);
    const logs: unknown[] = [];
    const workerApi = { call: (async (fn: string) => {
      events.push(fn);
      if (fn === 'list_pending_purges') return [
        { connection_id: CONNECTION_ID, status: 'pending_selection', reason: 'pending_expired',
          has_credential: true, pending_expires_at: new Date(), purge_requested_at: null },
        ...Array.from({ length: 6 }, () => ({ connection_id: randomUUID(), status: 'disconnected',
          reason: 'disconnect_requested', has_credential: false,
          pending_expires_at: null, purge_requested_at: new Date() })),
      ];
      if (fn === 'begin_disconnect') return [{ connection_id: CONNECTION_ID, status: 'disconnected',
        credential_generation: 1, purge_requested_at: new Date() }];
      if (fn === 'get_credential') return [{ ...credentialRow(), status: 'disconnected', credential_generation: 1 }];
      if (fn === 'purge_connection') return [{ purge_connection: true }];
      throw new Error('Llamada inesperada.');
    }) as WorkerApi['call'] };
    expect(await runLazyPurge(CTX, { http: meta.http, config: () => CONFIG, workerApi: () => workerApi,
      keyring: () => keyring, log: (line) => logs.push(line) }))
      .toEqual({ purged: 5, revokeFailed: 0, remaining: true });
    expect(events.slice(0, 5)).toEqual(['list_pending_purges', 'begin_disconnect', 'get_credential',
      'purge_connection', 'purge_connection']);
    expect(events.filter((event) => event === 'purge_connection')).toHaveLength(5);
    expect(meta.calls).toHaveLength(1);
    expect(logs).toContainEqual(expect.objectContaining({ etapa: 'revocacion', resultado: 'ok' }));
  });

  it('T-11 bloquea la pendiente antes de purgarla y omite revocación sin credencial', async () => {
    const events: string[] = [];
    const first = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
    const second = 'c5c4c3c2-1111-4111-8111-a5a4a3a2a1a0';
    const workerApi = { call: (async (fn: string, args: readonly unknown[]) => {
      events.push(fn);
      if (fn === 'list_pending_purges') return [
        { connection_id: first, status: 'pending_selection', reason: 'pending_expired',
          has_credential: false, pending_expires_at: new Date(), purge_requested_at: null },
        { connection_id: second, status: 'disconnected', reason: 'disconnect_requested',
          has_credential: false, pending_expires_at: null, purge_requested_at: new Date() },
      ];
      if (fn === 'begin_disconnect') return [{ connection_id: args[2], status: 'disconnected',
        credential_generation: 0, purge_requested_at: new Date() }];
      if (fn === 'purge_connection') return [{ purge_connection: true }];
      throw new Error('Llamada inesperada.');
    }) as WorkerApi['call'] };
    expect(await runLazyPurge(CTX, { workerApi: () => workerApi })).toEqual({
      purged: 2, revokeFailed: 0, remaining: false,
    });
    expect(events).toEqual(['list_pending_purges', 'begin_disconnect', 'purge_connection', 'purge_connection']);
  });

  it('T-12 una falla de bloqueo no purga y la repetición queda pendiente', async () => {
    const events: string[] = [];
    const workerApi = { call: (async (fn: string) => {
      events.push(fn);
      if (fn === 'list_pending_purges') return [{ connection_id: CONNECTION_ID,
        status: 'pending_selection', reason: 'pending_expired', has_credential: false,
        pending_expires_at: new Date(), purge_requested_at: null }];
      throw new Error('Fallo simulado.');
    }) as WorkerApi['call'] };
    expect(await runLazyPurge(CTX, { workerApi: () => workerApi, log: () => {} })).toEqual({
      purged: 0, revokeFailed: 0, remaining: true,
    });
    expect(events).toEqual(['list_pending_purges', 'begin_disconnect']);
  });

  it('T-12 purga aun si revocar falla o la credencial no puede leerse', async () => {
    for (const scenario of ['graph190', 'successFalse', 'missing', 'unreadable', 'configMissing'] as const) {
      const calls: string[] = [];
      const logs: unknown[] = [];
      const meta = batchMeta(scenario === 'graph190'
        ? [{ code: 400, body: '{"error":{"code":190}}' }]
        : [{ code: 200, body: '{"success":false}' }]);
      const workerApi = { call: (async (fn: string) => {
        calls.push(fn);
        if (fn === 'list_pending_purges') return [{ connection_id: CONNECTION_ID,
          status: 'disconnected', reason: 'disconnect_requested', has_credential: true,
          pending_expires_at: null, purge_requested_at: new Date() }];
        if (fn === 'get_credential') return scenario === 'missing' ? []
          : [{ ...credentialRow(), status: 'disconnected' }];
        if (fn === 'purge_connection') return [{ purge_connection: true }];
        throw new Error('Llamada inesperada.');
      }) as WorkerApi['call'] };
      const result = await runLazyPurge(CTX, { workerApi: () => workerApi, http: meta.http,
        config: () => { if (scenario === 'configMissing') throw new Error('Configuración inválida.'); return CONFIG; },
        keyring: () => {
          if (scenario === 'unreadable') throw new Error('Llavero ilegible.');
          return keyring;
        }, log: (line) => logs.push(line) });
      expect(result.purged).toBe(1);
      expect(calls.at(-1)).toBe('purge_connection');
      expect(meta.calls).toHaveLength(scenario === 'missing' || scenario === 'unreadable' ||
        scenario === 'configMissing' ? 0 : 1);
      expect(logs).toContainEqual(expect.objectContaining({ evento: 'meta_ciclo', etapa: 'revocacion',
        resultado: scenario === 'missing' ? 'sin_credencial'
          : scenario === 'unreadable' ? 'sin_credencial_legible' : 'fallida' }));
      expect(JSON.stringify(logs)).not.toContain(TOKEN);
    }
  });

  it('T-51 no purga si la lectura o el bloqueo inicial fallan', async () => {
    const workerApi = { call: (async (fn: string) => {
      if (fn === 'begin_disconnect') throw new Error('Fallo simulado.');
      throw new Error(`No se esperaba ${fn}`);
    }) as WorkerApi['call'] };
    const connection = { id: CONNECTION_ID, status: 'active' } as never;
    expect(await disconnect({ tenant: async () => CTX, readConnection: async () => connection,
      workerApi: () => workerApi, log: () => {} })).toBe('error');
  });
});

function confirmHarness(options: {
  record?: IntegrationConnectionRecord;
  probeStatus?: number;
  probeCode?: number;
  probeRows?: readonly Record<string, string>[];
  confirmErrors?: WorkerApiError[];
} = {}) {
  const events: string[] = [];
  const logs: unknown[] = [];
  let attempts = 0;
  const http = createMetaHttpClient({ fetch: async (url) => {
    events.push(`meta:${url.pathname}`);
    if (url.pathname === '/v26.0/me') return new Response('{"id":"5550001","client_business_id":"negocio_sintetico"}');
    if (url.pathname === '/v26.0/5550001/assigned_ad_accounts') return new Response(JSON.stringify({
      data: [{ id: ACCOUNT, name: 'Cuenta sintética', currency: 'USD', timezone_name: 'UTC' }],
    }));
    if (url.pathname === `/v26.0/${ACCOUNT}/insights`) return options.probeCode === undefined
      ? new Response(JSON.stringify({ data: options.probeRows ?? [] }), { status: options.probeStatus ?? 200 })
      : new Response(JSON.stringify({ error: { code: options.probeCode } }), { status: options.probeStatus ?? 400 });
    throw new Error('Petición inesperada.');
  } });
  const workerApi = { call: (async (fn: string, args: readonly unknown[]) => {
    events.push(`db:${fn}`);
    if (fn === 'get_credential') return [credentialRow()];
    if (fn === 'confirm_connection') {
      const error = options.confirmErrors?.[attempts];
      attempts += 1;
      if (error) throw error;
      expect(args).toEqual([CTX.user_id, CTX.company_id, CONNECTION_ID, ACCOUNT, 'USD', 'UTC', true]);
      return [{ connection_id: CONNECTION_ID, status: 'active', credential_generation: 0 }];
    }
    throw new Error(`Llamada inesperada: ${fn}`);
  }) as WorkerApi['call'] };
  const deps = { tenant: async () => CTX, config: () => CONFIG, http,
    workerApi: () => workerApi, keyring: () => keyring,
    readConnection: async () => { events.push('readConnection'); return options.record ?? pendingRecord(); },
    now: () => new Date('2026-10-17T12:00:00.000Z'), log: (line: unknown) => logs.push(line) };
  return { deps, events, logs };
}

describe('M16.2: selección y estado de la tarjeta', () => {
  it('T-27 entrega ids truncados desde loadMetaCardState en pendiente y activa', async () => {
    const accountId = 'act_90001';
    const pending = confirmHarness();
    pending.deps.http = createMetaHttpClient({ fetch: async (url) => {
      if (url.pathname === '/v26.0/me') {
        return new Response('{"id":"5550001","client_business_id":"negocio_sintetico"}');
      }
      if (url.pathname === '/v26.0/5550001/assigned_ad_accounts') {
        return new Response(JSON.stringify({ data: [{ id: accountId, name: 'Cuenta sintética',
          currency: 'USD', timezone_name: 'UTC' }] }));
      }
      throw new Error('Petición inesperada.');
    } });
    pending.deps.workerApi = () => ({ call: (async (fn: string) => {
      if (fn === 'list_pending_purges') return [];
      if (fn === 'get_credential') return [credentialRow()];
      throw new Error(`Llamada inesperada: ${fn}`);
    }) as WorkerApi['call'] });
    const pendingState = await loadMetaCardState(pending.deps);
    expect(pendingState).toEqual({ kind: 'pendiente', pendingExpiresAt: pendingRecord().pending_expires_at,
      accounts: [{ selectionKey: selectionKey(CONNECTION_ID, accountId), name: 'Cuenta sintética',
        maskedId: '…0001', currency: 'USD', timezone: 'UTC' }], discarded: 0, listError: null });

    const activeRecord: IntegrationConnectionRecord = { ...pendingRecord(), status: 'active',
      external_account_id: accountId, currency: 'USD', timezone: 'UTC', pending_expires_at: null,
      purge_requested_at: null };
    const activeState = await loadMetaCardState({ tenant: async () => CTX,
      workerApi: pending.deps.workerApi, readConnection: async () => activeRecord, log: () => {} });
    expect(activeState).toEqual({ kind: 'activa', maskedId: '…0001', currency: 'USD', timezone: 'UTC' });
    for (const state of [pendingState, activeState]) {
      const serialized = JSON.stringify(state);
      for (const forbidden of [accountId, '5550001', 'negocio_sintetico']) {
        expect(serialized).not.toContain(forbidden);
      }
    }
  });

  it('T-06 confirma solo después de releer, listar y probar la cuenta', async () => {
    const { deps, events } = confirmHarness();
    expect(await confirmAccount(selectionKey(), deps)).toBe('conectado');
    expect(events).toEqual(['readConnection', 'db:get_credential', 'meta:/v26.0/me',
      'meta:/v26.0/5550001/assigned_ad_accounts', `meta:/v26.0/${ACCOUNT}/insights`,
      'db:confirm_connection']);
  });

  it('T-23 registra solo el resumen del probe y los conteos del listado', async () => {
    const probe = confirmHarness({ probeRows: [{ date_start: '2026-10-01', spend: '1.23',
      impressions: '9' }] });
    expect(await confirmAccount(selectionKey(), probe.deps)).toBe('conectado');
    expect(probe.logs).toEqual([
      { evento: 'meta_ciclo', request_id: CTX.request_id, etapa: 'prueba', resultado: 'ok',
        filas: 1, campos: ['date_start', 'spend', 'impressions'], paginas: 1, llamadas: 1,
        completa: true, duracion_ms: expect.any(Number) },
      { evento: 'meta_ciclo', request_id: CTX.request_id, etapa: 'confirmacion', resultado: 'ok' },
    ]);

    const listing = confirmHarness();
    listing.deps.workerApi = () => ({ call: (async (fn: string) => fn === 'list_pending_purges'
      ? [] : [credentialRow()]) as WorkerApi['call'] });
    expect(await loadMetaCardState(listing.deps)).toMatchObject({ kind: 'pendiente' });
    expect(listing.logs).toEqual([{ evento: 'meta_ciclo', request_id: CTX.request_id,
      etapa: 'listado', resultado: 'ok', cuentas: 1, descartadas: 0 }]);

    const recorded = JSON.stringify([...probe.logs, ...listing.logs]);
    for (const forbidden of [TOKEN, ACCOUNT, '5550001', 'negocio_sintetico',
      'Cuenta sintética', '1.23']) expect(recorded).not.toContain(forbidden);
  });

  it('T-07 descarta claves inválidas y claves ligadas a otra conexión', async () => {
    const { deps, events } = confirmHarness();
    expect(await confirmAccount('invalida', deps)).toBe('cuenta_invalida');
    expect(events).toEqual([]);
    expect(await confirmAccount(createHash('sha256').update(ACCOUNT).digest('hex'), deps)).toBe('cuenta_invalida');
    expect(await confirmAccount(selectionKey('c5c4c3c2-1111-4111-8111-a5a4a3a2a1a0'), deps))
      .toBe('cuenta_invalida');
    expect(events).not.toContain('db:confirm_connection');
    expect(events).not.toContain(`meta:/v26.0/${ACCOUNT}/insights`);
  });

  it('T-08 no confirma ni marca reautorización si falla el probe', async () => {
    for (const [code, expected] of [[10, 'prueba_fallida'], [4, 'meta_no_disponible']] as const) {
      const { deps, events } = confirmHarness({ probeCode: code });
      expect(await confirmAccount(selectionKey(), deps)).toBe(expected);
      expect(events).not.toContain('db:confirm_connection');
      expect(events).not.toContain('db:mark_needs_reauth');
    }
  });

  it('T-09 vence en servidor sin usar Meta y traduce las carreras de base', async () => {
    const expired = confirmHarness({ record: pendingRecord('2026-10-17T00:00:00.000Z') });
    expect(await confirmAccount(selectionKey(), expired.deps)).toBe('pendiente_vencida');
    expect(expired.events).toEqual(['readConnection']);
    for (const [code, result] of [['pending_expired', 'pendiente_vencida'],
      ['invalid_transition', 'conexion_cambio'], ['invalid_argument', 'cuenta_invalida']] as const) {
      const h = confirmHarness({ confirmErrors: [new WorkerApiError(code)] });
      expect(await confirmAccount(selectionKey(), h.deps)).toBe(result);
    }
    const calls: string[] = [];
    const workerApi = { call: (async (fn: string) => {
      calls.push(fn);
      if (fn === 'list_pending_purges') return [{ connection_id: CONNECTION_ID,
        status: 'pending_selection', reason: 'pending_expired', has_credential: false,
        pending_expires_at: new Date('2026-10-17T00:00:00.000Z'), purge_requested_at: null }];
      if (fn === 'begin_disconnect') return [{ connection_id: CONNECTION_ID, status: 'disconnected',
        credential_generation: 1, purge_requested_at: new Date() }];
      if (fn === 'purge_connection') return [{ purge_connection: true }];
      throw new Error('Llamada inesperada.');
    }) as WorkerApi['call'] };
    expect(await loadMetaCardState({ tenant: async () => CTX, workerApi: () => workerApi,
      readConnection: async () => null, log: () => {} })).toEqual({ kind: 'sin_conexion' });
    expect(calls).toEqual(['list_pending_purges', 'begin_disconnect', 'purge_connection']);
  });

  it('T-10 repite una sola vez el mismo argumento tras transporte', async () => {
    const recovered = confirmHarness({ confirmErrors: [new WorkerApiError('unavailable', 'transport')] });
    expect(await confirmAccount(selectionKey(), recovered.deps)).toBe('conectado');
    expect(recovered.events.filter((event) => event === 'db:confirm_connection')).toHaveLength(2);
    const failed = confirmHarness({ confirmErrors: [new WorkerApiError('unavailable', 'transport'),
      new WorkerApiError('unavailable', 'timeout')] });
    expect(await confirmAccount(selectionKey(), failed.deps)).toBe('error');
    expect(failed.events.filter((event) => event === 'db:confirm_connection')).toHaveLength(2);
  });

  it('T-51 conserva cancelación si la credencial es ilegible y clasifica errores de listado', async () => {
    const h = confirmHarness();
    h.deps.workerApi = () => ({ call: (async (fn: string) => {
      if (fn === 'list_pending_purges') return [];
      throw new Error('Credencial ilegible.');
    }) as WorkerApi['call'] });
    const state = await loadMetaCardState(h.deps);
    expect(state).toMatchObject({ kind: 'pendiente', listError: 'error' });
    const rejected = confirmHarness();
    rejected.deps.http = createMetaHttpClient({ fetch: async () => new Response('{"error":{"code":190}}', { status: 400 }) });
    rejected.deps.workerApi = () => ({ call: (async (fn: string) => fn === 'list_pending_purges'
      ? [] : [credentialRow()]) as WorkerApi['call'] });
    expect(await loadMetaCardState(rejected.deps)).toMatchObject({ kind: 'pendiente', listError: 'token_no_valido' });
    const limited = confirmHarness();
    let pages = 0;
    limited.deps.http = createMetaHttpClient({ fetch: async (url) => {
      if (url.pathname === '/v26.0/me') return new Response('{"id":"5550001","client_business_id":"negocio_sintetico"}');
      pages += 1;
      return new Response(JSON.stringify({ data: [], paging: { next: 'ignorado',
        cursors: { after: `cur-${pages}` } } }));
    } });
    limited.deps.workerApi = rejected.deps.workerApi;
    expect(await loadMetaCardState(limited.deps)).toMatchObject({ kind: 'pendiente', listError: 'meta_no_disponible' });
    expect(pages).toBe(10);
  });
});

describe('M16.2: efectos, mensajes y desconexión', () => {
  it('T-21 y T-22 aplica solo las clases autorizadas y registra una línea cerrada', async () => {
    const expected = ['authentication', 'user_action', 'permission', 'asset_access'];
    for (const code of ['authentication', 'user_action', 'permission', 'asset_access',
      'rate_limit', 'temporary', 'own_error', 'transport', 'unknown'] as const) {
      expect(connectionEffectFor(code)).toBe(expected.includes(code) ? 'needs_reauth' : 'unchanged');
    }
    const calls: Array<{ fn: string; args: readonly unknown[] }> = [];
    const logs: unknown[] = [];
    const workerApi = { call: (async (fn: string, args: readonly unknown[]) => {
      calls.push({ fn, args });
      return [{ connection_id: CONNECTION_ID, status: 'needs_reauth', credential_generation: 2 }];
    }) as WorkerApi['call'] };
    const deps = { workerApi: () => workerApi, log: (line: unknown) => logs.push(line) };
    const connection = { id: CONNECTION_ID, credentialGeneration: 2 };
    const auth = new MetaApiError({ errorClass: 'authentication', graphCode: 190, graphSubcode: null });
    expect(await applyConnectionFailure(CTX, connection, auth, deps)).toBe('needs_reauth');
    expect(calls[0]).toEqual({ fn: 'mark_needs_reauth', args: [CTX.user_id, CTX.company_id,
      CONNECTION_ID, 2, 'authentication', auth.redactedMessage] });
    const unknown = new MetaApiError({ errorClass: 'unknown', graphCode: null, graphSubcode: null });
    expect(await applyConnectionFailure(CTX, connection, unknown, deps)).toBe('unchanged');
    expect(calls).toHaveLength(1);
    expect(logs[1]).toEqual({ evento: 'meta_ciclo', etapa: 'error_conexion', resultado: 'omitida',
      clase: 'unknown', request_id: CTX.request_id });
  });

  it('T-25 conserva resultados cerrados y textos de recuperación', () => {
    expect(META_OAUTH_OUTCOMES).not.toContain('reautorizacion_no_disponible');
    for (const outcome of ['desconectado', 'desconexion_en_curso', 'conectado', 'reautorizado',
      'cuenta_no_delegada', 'cuenta_invalida', 'prueba_fallida', 'pendiente_vencida',
      'conexion_cambio', 'credencial_cambio'] as const) {
      expect(parseMetaOAuthOutcome(outcome)).toBe(outcome);
      expect(META_OAUTH_MESSAGES[outcome].text.length).toBeGreaterThan(0);
    }
    expect(parseMetaOAuthOutcome('reautorizacion_no_disponible')).toBeNull();
    expect(META_OAUTH_MESSAGES.desconectado.text).toContain('hasta 7 días');
    expect(NEEDS_REAUTH_TEXTS.permission).toContain('ads_read');
  });

  it('T-51 exige identidad y detiene la purga si falla el bloqueo', async () => {
    await expect(disconnect({ tenant: async () => { throw new UnauthorizedError(); } }))
      .rejects.toBeInstanceOf(UnauthorizedError);
    expect(await disconnect({ tenant: async () => { throw new NoCompanyError(); } })).toBe('sin_empresa');
    const calls: string[] = [];
    const workerApi = { call: (async (fn: string) => {
      calls.push(fn);
      throw new WorkerApiError('invalid_argument');
    }) as WorkerApi['call'] };
    expect(await disconnect({ tenant: async () => CTX, readConnection: async () => pendingRecord(),
      workerApi: () => workerApi, log: () => {} })).toBe('error');
    expect(calls).toEqual(['begin_disconnect']);
  });
});

describe('M16.2: resolución de escritura inicial ambigua', () => {
  it('T-52 distingue token guardado, token distinto y relectura ilegible sin registrarlos', async () => {
    const logs: unknown[] = [];
    const connection = pendingRecord();
    const readConnection = async () => connection;
    const run = async (saved: string | null, readFails = false) => {
      const workerApi = { call: (async (fn: string) => {
        if (readFails) throw new WorkerApiError('unavailable', 'transport');
        if (fn !== 'get_credential') throw new Error('Llamada inesperada.');
        if (saved === null) return [];
        return [{ ...credentialRow(),
          ...sealCredential(saved, { company_id: CTX.company_id, connection_id: CONNECTION_ID,
            provider: 'meta' }, keyring) }];
      }) as WorkerApi['call'] };
      return resolveAmbiguousWrite(CTX, new SecretValue(TOKEN), { kind: 'initial' },
        { readConnection, workerApi: () => workerApi, keyring: () => keyring });
    };
    expect(await run(TOKEN)).toBe('applied');
    expect(await run('otro-token')).toBe('not_applied');
    expect(await run(null)).toBe('unreadable');
    expect(await run(TOKEN, true)).toBe('unreadable');
    expect(await resolveAmbiguousWrite(CTX, new SecretValue(TOKEN), { kind: 'initial' },
      { readConnection: async () => null, workerApi: () => ({ call: vi.fn() }) as unknown as WorkerApi,
        keyring: () => keyring })).toBe('not_applied');
    expect(JSON.stringify(logs)).not.toContain(TOKEN);
  });
});

describe('M16.2: Server Actions', () => {
  it('T-26 y T-51 redirige fuera del try y solo toma la clave de selección del formulario', async () => {
    vi.resetModules();
    const identity = await import('@/modules/identity/session');
    const confirm = vi.fn().mockRejectedValueOnce(new identity.UnauthorizedError()).mockResolvedValueOnce('sin_empresa');
    const disconnectAction = vi.fn().mockRejectedValueOnce(new identity.UnauthorizedError());
    const redirect = vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); });
    vi.doMock('@/modules/integrations/lifecycle', () => ({ confirmAccount: confirm, disconnect: disconnectAction }));
    vi.doMock('next/navigation', () => ({ redirect }));
    try {
      const actions = await import('@/modules/integrations/actions');
      const form = new FormData();
      form.set('cuenta', selectionKey());
      form.set('currency', 'ARS');
      form.set('timezone', 'Mars/Base');
      form.set('account', 'act_9999');
      await expect(actions.confirmarCuentaMeta(form)).rejects.toThrow(
        'NEXT_REDIRECT:/login?next=%2Fapp%2Fintegraciones');
      await expect(actions.confirmarCuentaMeta(form)).rejects.toThrow(
        'NEXT_REDIRECT:/app/integraciones?meta=sin_empresa');
      await expect(actions.desconectarMeta()).rejects.toThrow(
        'NEXT_REDIRECT:/login?next=%2Fapp%2Fintegraciones');
      expect(confirm).toHaveBeenCalledWith(selectionKey());
      expect(confirm).toHaveBeenCalledTimes(2);
      expect(disconnectAction).toHaveBeenCalledWith();
      expect(redirect).toHaveBeenCalledTimes(3);
    } finally {
      vi.doUnmock('@/modules/integrations/lifecycle');
      vi.doUnmock('next/navigation');
      vi.resetModules();
    }
  });
});
