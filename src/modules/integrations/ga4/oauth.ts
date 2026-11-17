import 'server-only';

import { createHash, randomBytes as nodeRandomBytes, timingSafeEqual } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

import { BROWSER_BINDING_COOKIE, OAuthAttemptRejectedError, RETURN_PATH_ALLOWLIST,
  oauthStateSchema, type IntegrationConnectionRecord, type ReturnPath } from '../contract';
import { NoCompanyError } from '@/modules/company/service';
import { UnauthorizedError } from '@/modules/identity/session';
import { requireTenantContext, type TenantContext } from '@/modules/tenant/context';
import { getCredentialKeyring, type CredentialKeyring } from '../crypto/keyring';
import { SecretValue } from '../crypto/seal';
import { getWorkerApi, WorkerApiError, type WorkerApi } from '../db/worker-api';
import { consumeOAuthAttempt, createOAuthAttempt, LiveConnectionExistsError } from '../repository/attempts';
import { readConnectionRecord, readLiveConnection, type LiveConnection } from '../repository/connections';
import { executePreparedCredentialOperation, preparePendingConnectionWithCredential,
  prepareReplaceCredential, readCredential, type PreparedCredentialOperation } from '../repository/credentials';
import { runLazyPurge } from '../lifecycle';
import { GA4_SCOPE, authorizationUrl, createGa4Http, Ga4ApiError, Ga4TokenRejectedError,
  parseProperty, parseTokenExchange, propertyIdFromName, readGa4Config, type Ga4Config, type Ga4Http } from './google';

export const GA4_OAUTH_TTL_MS = 9 * 60 * 1000;
export const GA4_OAUTH_OUTCOMES = ['pendiente', 'reautorizado', 'reintentar', 'cancelado', 'rechazado',
  'otra_propiedad', 'propiedad_no_disponible', 'conexion_existente', 'conexion_en_curso',
  'credencial_cambio', 'sin_empresa', 'desconectado', 'desconexion_en_curso', 'error'] as const;
export type Ga4OAuthOutcome = typeof GA4_OAUTH_OUTCOMES[number];

export type Ga4OAuthDeps = {
  tenant: () => Promise<TenantContext>;
  config: () => Ga4Config;
  http: Ga4Http;
  workerApi: () => WorkerApi;
  keyring: () => CredentialKeyring;
  readLive: (ctx: TenantContext) => Promise<LiveConnection | null>;
  readConnection: (ctx: TenantContext) => Promise<IntegrationConnectionRecord | null>;
  now: () => Date;
  randomBytes: (size: number) => Buffer;
  log: (event: { evento: 'ga4_oauth'; etapa: string; resultado: Ga4OAuthOutcome | 'ok';
    clase?: string; request_id?: string }) => void;
};

function depsOf(partial: Partial<Ga4OAuthDeps> = {}): Ga4OAuthDeps {
  return {
    tenant: partial.tenant ?? requireTenantContext,
    config: partial.config ?? readGa4Config,
    http: partial.http ?? createGa4Http(),
    workerApi: partial.workerApi ?? getWorkerApi,
    keyring: partial.keyring ?? getCredentialKeyring,
    readLive: partial.readLive ?? ((ctx) => readLiveConnection(ctx, 'ga4')),
    readConnection: partial.readConnection ?? ((ctx) => readConnectionRecord(ctx, {}, 'ga4')),
    now: partial.now ?? (() => new Date()),
    randomBytes: partial.randomBytes ?? nodeRandomBytes,
    log: partial.log ?? ((event) => console.info(JSON.stringify(event))),
  };
}

function redirect(target: URL): NextResponse {
  const response = NextResponse.redirect(target, 303);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
function resultUrl(request: NextRequest, outcome: Ga4OAuthOutcome, path: ReturnPath = RETURN_PATH_ALLOWLIST[0]) {
  const url = new URL(path, request.nextUrl.origin);
  url.searchParams.set('ga4', outcome);
  return url;
}
function loginUrl(request: NextRequest) {
  const url = new URL('/login', request.nextUrl.origin);
  url.searchParams.set('next', RETURN_PATH_ALLOWLIST[0]);
  return url;
}
const cookieOptions = { httpOnly: BROWSER_BINDING_COOKIE.httpOnly, secure: BROWSER_BINDING_COOKIE.secure,
  sameSite: BROWSER_BINDING_COOKIE.sameSite, path: BROWSER_BINDING_COOKIE.path } as const;
function clearCookie(response: NextResponse): NextResponse {
  response.cookies.set({ name: BROWSER_BINDING_COOKIE.name, value: '', ...cookieOptions, maxAge: 0 });
  return response;
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function randomState(deps: Ga4OAuthDeps) {
  return oauthStateSchema.parse(deps.randomBytes(32).toString('base64url'));
}

function transient(error: unknown): boolean {
  return error instanceof WorkerApiError && error.code === 'unavailable' &&
    (error.failureKind === 'transport' || error.failureKind === 'timeout');
}

/** Reusa la misma operación cifrada; ante dos respuestas ambiguas verifica la escritura. */
async function executeCredentialWrite(ctx: TenantContext, operation: PreparedCredentialOperation,
  token: SecretValue, expected: { kind: 'initial' } | { kind: 'reauth'; id: string; generation: number },
  deps: Ga4OAuthDeps): Promise<void> {
  const execute = () => executePreparedCredentialOperation(ctx, operation,
    { workerApi: deps.workerApi(), keyring: deps.keyring() });
  try { await execute(); return; }
  catch (first) { if (!transient(first)) throw first; }
  try { await execute(); return; }
  catch (second) {
    if (!transient(second)) throw second;
    try {
      const connection = await deps.readConnection(ctx);
      if (connection && (expected.kind === 'initial'
        ? connection.status === 'pending_selection'
        : connection.id === expected.id && connection.status === 'active' &&
          connection.credential_generation === expected.generation + 1)) {
        const stored = await readCredential(ctx, connection.id,
          { workerApi: deps.workerApi(), keyring: deps.keyring(), provider: 'ga4' });
        const original = createHash('sha256').update(token.reveal()).digest();
        const saved = createHash('sha256').update(stored.token.reveal()).digest();
        if (timingSafeEqual(original, saved)) return;
      }
    } catch { /* La escritura queda sin acreditar; no se reintenta con otro ID. */ }
    throw second;
  }
}

export async function handleGa4Start(request: NextRequest, partial: Partial<Ga4OAuthDeps> = {}): Promise<NextResponse> {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return new NextResponse('Solicitud no permitida.', { status: 403,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const deps = depsOf(partial);
  const finish = (outcome: Ga4OAuthOutcome, requestId?: string) => {
    deps.log({ evento: 'ga4_oauth', etapa: 'inicio', resultado: outcome,
      ...(requestId ? { request_id: requestId } : {}) });
    return redirect(resultUrl(request, outcome));
  };
  let ctx: TenantContext;
  try { ctx = await deps.tenant(); }
  catch (error) {
    if (error instanceof UnauthorizedError) return redirect(loginUrl(request));
    return finish(error instanceof NoCompanyError ? 'sin_empresa' : 'error');
  }
  try {
    const config = deps.config();
    if (new URL(config.redirectUri).origin !== request.nextUrl.origin) return finish('error', ctx.request_id);
    try { await runLazyPurge(ctx, { workerApi: deps.workerApi, keyring: deps.keyring, now: deps.now }); }
    catch { /* La purga se reintenta; no cambia el intento OAuth. */ }
    const live = await deps.readLive(ctx);
    if (live?.status === 'pending_selection') return finish('conexion_en_curso', ctx.request_id);
    const state = randomState(deps);
    const nonce = randomState(deps);
    try {
      await createOAuthAttempt(ctx, { provider: 'ga4', purpose: live ? 'reauth' : 'initial',
        stateHash: hash(state), bindingHash: hash(nonce), returnPath: RETURN_PATH_ALLOWLIST[0],
        expiresAt: new Date(deps.now().getTime() + GA4_OAUTH_TTL_MS),
        expectedConnectionId: live?.id ?? null }, { workerApi: deps.workerApi() });
    } catch (error) {
      if (error instanceof LiveConnectionExistsError) return finish('conexion_existente', ctx.request_id);
      throw error;
    }
    deps.log({ evento: 'ga4_oauth', etapa: 'inicio', resultado: 'ok', request_id: ctx.request_id });
    const response = redirect(authorizationUrl(config, state));
    response.cookies.set({ name: BROWSER_BINDING_COOKIE.name, value: nonce, ...cookieOptions,
      maxAge: GA4_OAUTH_TTL_MS / 1000 });
    return response;
  } catch { return finish('error', ctx.request_id); }
}

async function listPropertyIds(http: Ga4Http, token: ReturnType<typeof parseTokenExchange>['accessToken']):
Promise<Set<string>> {
  const result = new Set<string>();
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const body = await http.getAdmin('accountSummaries', token,
      { pageSize: '200', ...(pageToken ? { pageToken } : {}) });
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Ga4ApiError('desconocido', 'unknown');
    const data = body as Record<string, unknown>;
    if (data.accountSummaries !== undefined && !Array.isArray(data.accountSummaries)) {
      throw new Ga4ApiError('desconocido', 'unknown');
    }
    for (const account of (data.accountSummaries ?? []) as unknown[]) {
      if (!account || typeof account !== 'object' || Array.isArray(account)) continue;
      const properties = (account as Record<string, unknown>).propertySummaries;
      if (!Array.isArray(properties)) continue;
      for (const property of properties) {
        if (!property || typeof property !== 'object' || Array.isArray(property)) continue;
        const row = property as Record<string, unknown>;
        const id = propertyIdFromName(row.property);
        if (id && row.propertyType === 'PROPERTY_TYPE_ORDINARY') result.add(id);
      }
    }
    if (typeof data.nextPageToken !== 'string' || data.nextPageToken === '') return result;
    pageToken = data.nextPageToken;
  }
  throw new Ga4ApiError('desconocido', 'unknown');
}

export async function handleGa4Callback(request: NextRequest, partial: Partial<Ga4OAuthDeps> = {}): Promise<NextResponse> {
  const deps = depsOf(partial);
  let returnPath: ReturnPath = RETURN_PATH_ALLOWLIST[0];
  const logContext: { requestId?: string } = {};
  let stage = 'consumo';
  const finish = (outcome: Ga4OAuthOutcome, clase?: string) => {
    deps.log({ evento: 'ga4_oauth', etapa: stage, resultado: outcome,
      ...(clase ? { clase } : {}), ...(logContext.requestId ? { request_id: logContext.requestId } : {}) });
    return clearCookie(redirect(resultUrl(request, outcome, returnPath)));
  };
  let ctx: TenantContext;
  try { ctx = await deps.tenant(); }
  catch (error) {
    if (error instanceof UnauthorizedError) return clearCookie(redirect(loginUrl(request)));
    return finish(error instanceof NoCompanyError ? 'sin_empresa' : 'error');
  }
  logContext.requestId = ctx.request_id;
  const state = request.nextUrl.searchParams.get('state');
  const nonce = request.cookies.get(BROWSER_BINDING_COOKIE.name)?.value;
  if (!state || !nonce || !oauthStateSchema.safeParse(state).success ||
      !oauthStateSchema.safeParse(nonce).success) return finish('rechazado');
  try {
    const attempt = await consumeOAuthAttempt(ctx, { provider: 'ga4', stateHash: hash(state),
      bindingHash: hash(nonce) }, { workerApi: deps.workerApi() });
    returnPath = attempt.returnPath;
    if (request.nextUrl.searchParams.has('error')) return finish('cancelado');
    const code = request.nextUrl.searchParams.get('code');
    if (!code) return finish('rechazado');
    stage = 'canje';
    const config = deps.config();
    const exchanged = parseTokenExchange(await deps.http.exchangeCode(code, config));
    if (attempt.purpose === 'initial') {
      stage = 'pendiente';
      const operation = preparePendingConnectionWithCredential(ctx, { provider: 'ga4',
        token: exchanged.refreshToken.reveal(), tokenType: 'google_refresh_token',
        issuedForAppId: config.appId, grantedScopes: [GA4_SCOPE], expiresAt: null,
        clientBusinessId: null }, { keyring: deps.keyring() });
      await executeCredentialWrite(ctx, operation, exchanged.refreshToken, { kind: 'initial' }, deps);
      return finish('pendiente');
    }
    stage = 'reauth';
    const connection = await deps.readConnection(ctx);
    if (!connection || connection.id !== attempt.expectedConnectionId ||
        connection.credential_generation !== attempt.expectedGeneration ||
        !['active', 'needs_reauth'].includes(connection.status)) return finish('credencial_cambio');
    const propertyId = connection.external_account_id;
    if (!propertyId || !(await listPropertyIds(deps.http, exchanged.accessToken)).has(propertyId)) {
      return finish('otra_propiedad');
    }
    if (!parseProperty(await deps.http.getAdmin(`properties/${propertyId}`, exchanged.accessToken), propertyId)) {
      return finish('propiedad_no_disponible');
    }
    const operation = prepareReplaceCredential(ctx, { provider: 'ga4', connectionId: connection.id,
      attemptId: attempt.attemptId, token: exchanged.refreshToken.reveal(),
      tokenType: 'google_refresh_token', issuedForAppId: config.appId,
      grantedScopes: [GA4_SCOPE], expiresAt: null }, { keyring: deps.keyring() });
    await executeCredentialWrite(ctx, operation, exchanged.refreshToken,
      { kind: 'reauth', id: connection.id, generation: connection.credential_generation }, deps);
    return finish('reautorizado');
  } catch (error) {
    if (error instanceof OAuthAttemptRejectedError) return finish('rechazado');
    if (error instanceof Ga4TokenRejectedError) return finish('reintentar');
    if (error instanceof Ga4ApiError) return finish('error', error.errorClass);
    if (error instanceof WorkerApiError && error.code === 'live_connection_exists') return finish('conexion_existente');
    if (error instanceof WorkerApiError && ['generation_mismatch', 'invalid_transition'].includes(error.code)) {
      return finish('credencial_cambio');
    }
    return finish('error');
  }
}

export { listPropertyIds };
