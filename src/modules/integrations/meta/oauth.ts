import 'server-only';

import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

import {
  BROWSER_BINDING_COOKIE,
  OAuthAttemptRejectedError,
  RETURN_PATH_ALLOWLIST,
  oauthStateSchema,
  returnPathSchema,
  type IntegrationErrorClass,
  type ReturnPath,
} from '@/modules/integrations/contract';
import { NoCompanyError } from '@/modules/company/service';
import { UnauthorizedError } from '@/modules/identity/session';
import { requireTenantContext, type TenantContext } from '@/modules/tenant/context';
import { getCredentialKeyring, type CredentialKeyring } from '../crypto/keyring';
import { SecretValue } from '../crypto/seal';
import { getWorkerApi, WorkerApiError, type WorkerApi } from '../db/worker-api';
import { consumeOAuthAttempt, createOAuthAttempt, LiveConnectionExistsError } from '../repository/attempts';
import { readLiveConnection, type LiveConnection } from '../repository/connections';
import {
  executePreparedCredentialOperation,
  preparePendingConnectionWithCredential,
} from '../repository/credentials';
import { MetaConfigError, dialogUrl, getMetaOAuthConfig, graphUrl, type MetaOAuthConfig } from './api';
import { createMetaHttpClient, type MetaHttpClient } from './client';
import { MetaApiError } from './errors';
import type { MetaOAuthOutcome } from './outcomes';
import { TokenRejectedError, fetchClientBusinessId, inspectToken } from './tokens';

/**
 * Orquestación del inicio y del callback OAuth con Meta (II.9, pasos 3 a 7).
 *
 * Las dos rutas construyen K01 adentro: nunca reciben actor ni empresa del navegador. El
 * callback consume el intento en una sola llamada antes de cualquier otra cosa, y en el
 * camino `initial` el orden es consumo → canje → inspección → `/me` → pendiente: no hay
 * camino a `create_pending_connection` sin un consumo `initial` exitoso en la misma petición
 * (`H-E1-24`, D-M16.1-05).
 *
 * Nada de lo que llega en la URL (código, `state`, errores de Meta) se registra ni se
 * reenvía: cada respuesta es una redirección a una URL armada acá.
 */

/** Menor que la vida máxima de K02, con margen para el reloj de la base. */
export const OAUTH_START_TTL_MS = 9 * 60 * 1000;

const LOGIN_PATH = '/login';
const DEFAULT_RETURN_PATH: ReturnPath = RETURN_PATH_ALLOWLIST[0];

export type MetaOAuthLogEvent = {
  evento: 'meta_oauth';
  etapa: 'inicio' | 'configuracion' | 'consumo' | 'canje' | 'inspeccion' | 'negocio' | 'pendiente' | 'reauth';
  resultado: MetaOAuthOutcome | 'ok';
  clase?: IntegrationErrorClass;
  request_id?: string;
};

export type MetaOAuthDeps = {
  tenant: () => Promise<TenantContext>;
  config: () => MetaOAuthConfig;
  http: MetaHttpClient;
  workerApi?: WorkerApi;
  keyring?: CredentialKeyring;
  readLiveConnection: (ctx: TenantContext) => Promise<LiveConnection | null>;
  now: () => Date;
  randomBytes: (size: number) => Buffer;
  log: (event: MetaOAuthLogEvent) => void;
};

/** Una línea de formato fijo: solo etapa, resultado, clase y `request_id`. */
function defaultLog(event: MetaOAuthLogEvent): void {
  console.info(JSON.stringify(event));
}

function resolveDeps(partial: Partial<MetaOAuthDeps> = {}) {
  let workerApi = partial.workerApi;
  let keyring = partial.keyring;
  return {
    tenant: partial.tenant ?? requireTenantContext,
    config: partial.config ?? getMetaOAuthConfig,
    http: partial.http ?? createMetaHttpClient(),
    readLiveConnection: partial.readLiveConnection ?? ((ctx: TenantContext) => readLiveConnection(ctx)),
    now: partial.now ?? (() => new Date()),
    randomBytes: partial.randomBytes ?? nodeRandomBytes,
    log: partial.log ?? defaultLog,
    // Perezosos: un rechazo temprano no necesita la base ni el llavero.
    workerApi: () => (workerApi ??= getWorkerApi()),
    keyring: () => (keyring ??= getCredentialKeyring()),
  };
}

type Resolved = ReturnType<typeof resolveDeps>;

const sha256Hex = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

function randomToken(deps: Resolved): string {
  const value = deps.randomBytes(32).toString('base64url');
  return oauthStateSchema.parse(value);
}

// ---------------------------------------------------------------------------
// Respuestas
// ---------------------------------------------------------------------------

function redirect(target: URL): NextResponse {
  const response = NextResponse.redirect(target, 303);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

function resultUrl(request: NextRequest, outcome: MetaOAuthOutcome, returnPath: ReturnPath = DEFAULT_RETURN_PATH): URL {
  const url = new URL(returnPath, request.nextUrl.origin);
  url.searchParams.set('meta', outcome);
  return url;
}

function loginUrl(request: NextRequest): URL {
  const url = new URL(LOGIN_PATH, request.nextUrl.origin);
  url.searchParams.set('next', DEFAULT_RETURN_PATH);
  return url;
}

const cookieAttributes = {
  httpOnly: BROWSER_BINDING_COOKIE.httpOnly,
  secure: BROWSER_BINDING_COOKIE.secure,
  sameSite: BROWSER_BINDING_COOKIE.sameSite,
  path: BROWSER_BINDING_COOKIE.path,
} as const;

/** El callback siempre borra la cookie de vinculación. */
function withClearedCookie(response: NextResponse): NextResponse {
  response.cookies.set({ name: BROWSER_BINDING_COOKIE.name, value: '', ...cookieAttributes, maxAge: 0 });
  return response;
}

// ---------------------------------------------------------------------------
// Diálogo y canje
// ---------------------------------------------------------------------------

export function buildAuthorizationUrl(config: MetaOAuthConfig, state: string): URL {
  return dialogUrl({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    state,
    response_type: 'code',
    config_id: config.configId,
    override_default_response_type: 'true',
  });
}

/** Canje por `POST` con todo en el cuerpo (D-M16.1-08). No reintenta: el código es de un solo uso. */
export async function exchangeCodeForToken(
  code: string,
  deps: { http: MetaHttpClient; config: MetaOAuthConfig },
): Promise<SecretValue> {
  const body = await deps.http.postFormJson(graphUrl('oauth/access_token'), {
    client_id: deps.config.appId,
    redirect_uri: deps.config.redirectUri,
    client_secret: deps.config.appSecret,
    code: new SecretValue(code),
  });
  const token =
    body && typeof body === 'object' && !Array.isArray(body) ? (body as { access_token?: unknown }).access_token : undefined;
  if (typeof token !== 'string' || token === '') {
    throw new MetaApiError({ errorClass: 'unknown', graphCode: null, graphSubcode: null });
  }
  return new SecretValue(token);
}

/** CA-39: las clases que indican una autorización inválida se muestran como rechazo. */
const REJECTING_CLASSES = new Set<IntegrationErrorClass>(['own_error', 'authentication', 'user_action', 'permission']);

function metaOutcome(error: MetaApiError): MetaOAuthOutcome {
  return REJECTING_CLASSES.has(error.errorClass) ? 'rechazado' : 'meta_no_disponible';
}

// ---------------------------------------------------------------------------
// POST /api/integraciones/meta/iniciar
// ---------------------------------------------------------------------------

export async function handleMetaStart(request: NextRequest, partial?: Partial<MetaOAuthDeps>): Promise<NextResponse> {
  // D-M16.1-06: solo desde el propio origen, antes de leer la sesión.
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return new NextResponse('Solicitud no permitida.', {
      status: 403,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const deps = resolveDeps(partial);
  const finish = (outcome: MetaOAuthOutcome, etapa: MetaOAuthLogEvent['etapa'], requestId?: string) => {
    deps.log({ evento: 'meta_oauth', etapa, resultado: outcome, ...(requestId ? { request_id: requestId } : {}) });
    return redirect(resultUrl(request, outcome));
  };

  let ctx: TenantContext;
  try {
    ctx = await deps.tenant();
  } catch (error) {
    if (error instanceof UnauthorizedError) return redirect(loginUrl(request));
    return finish(error instanceof NoCompanyError ? 'sin_empresa' : 'error', 'inicio');
  }

  try {
    let config: MetaOAuthConfig;
    try {
      config = deps.config();
    } catch (error) {
      if (error instanceof MetaConfigError) return finish('error', 'configuracion', ctx.request_id);
      throw error;
    }

    const live = await deps.readLiveConnection(ctx);
    // D-M16.1-04: con una pendiente no se inicia nada; su purga y revocación son de M16.2.
    if (live?.status === 'pending_selection') return finish('pendiente_vigente', 'inicio', ctx.request_id);
    const purpose = live === null ? 'initial' : 'reauth';
    const expectedConnectionId = live === null ? null : live.id;

    // CA-04: el retorno se valida antes de tocar la base.
    const returnPath = returnPathSchema.parse(DEFAULT_RETURN_PATH);
    const state = randomToken(deps);
    const nonce = randomToken(deps);
    const expiresAt = new Date(deps.now().getTime() + OAUTH_START_TTL_MS);

    try {
      await createOAuthAttempt(
        ctx,
        {
          purpose,
          stateHash: sha256Hex(state),
          bindingHash: sha256Hex(nonce),
          returnPath,
          expiresAt,
          expectedConnectionId,
        },
        { workerApi: deps.workerApi() },
      );
    } catch (error) {
      if (error instanceof LiveConnectionExistsError) return finish('conexion_existente', 'inicio', ctx.request_id);
      throw error;
    }

    deps.log({ evento: 'meta_oauth', etapa: 'inicio', resultado: 'ok', request_id: ctx.request_id });
    const response = redirect(buildAuthorizationUrl(config, state));
    response.cookies.set({
      name: BROWSER_BINDING_COOKIE.name,
      value: nonce,
      ...cookieAttributes,
      maxAge: OAUTH_START_TTL_MS / 1000,
    });
    return response;
  } catch {
    return finish('error', 'inicio', ctx.request_id);
  }
}

// ---------------------------------------------------------------------------
// GET /api/integraciones/meta/callback
// ---------------------------------------------------------------------------

export async function handleMetaCallback(request: NextRequest, partial?: Partial<MetaOAuthDeps>): Promise<NextResponse> {
  const deps = resolveDeps(partial);
  const params = request.nextUrl.searchParams;
  const state = params.get('state');
  const code = params.get('code');
  const providerError = params.get('error');
  const nonce = request.cookies.get(BROWSER_BINDING_COOKIE.name)?.value ?? null;

  // Se completa cuando K01 existe; los rechazos previos se registran sin `request_id`.
  const logContext: { requestId?: string } = {};
  const finish = (
    outcome: MetaOAuthOutcome,
    etapa: MetaOAuthLogEvent['etapa'],
    options: { clase?: IntegrationErrorClass; returnPath?: ReturnPath } = {},
  ) => {
    deps.log({
      evento: 'meta_oauth',
      etapa,
      resultado: outcome,
      ...(options.clase ? { clase: options.clase } : {}),
      ...(logContext.requestId ? { request_id: logContext.requestId } : {}),
    });
    return withClearedCookie(redirect(resultUrl(request, outcome, options.returnPath)));
  };

  let ctx: TenantContext;
  try {
    ctx = await deps.tenant();
  } catch (error) {
    // El código se descarta y el intento vence solo.
    if (error instanceof UnauthorizedError) return withClearedCookie(redirect(loginUrl(request)));
    return finish(error instanceof NoCompanyError ? 'sin_empresa' : 'error', 'consumo');
  }
  logContext.requestId = ctx.request_id;

  const validState = state !== null && oauthStateSchema.safeParse(state).success ? state : null;
  const validNonce = nonce !== null && oauthStateSchema.safeParse(nonce).success ? nonce : null;

  try {
    // CA-34: la cancelación se muestra aunque el `state` no sirva; si sirve, se consume.
    if (providerError !== null) {
      if (validState !== null && validNonce !== null) {
        try {
          await consumeOAuthAttempt(
            ctx,
            { stateHash: sha256Hex(validState), bindingHash: sha256Hex(validNonce) },
            { workerApi: deps.workerApi() },
          );
        } catch {
          // Mejor esfuerzo: mostrar la cancelación no cambia ningún estado.
        }
      }
      return finish('cancelado', 'consumo');
    }

    // CA-29: `state` o cookie ausentes o mal formados, o sin código: sin base ni Meta.
    if (validState === null || validNonce === null || code === null || code === '') {
      return finish('rechazado', 'consumo');
    }

    let attempt: Awaited<ReturnType<typeof consumeOAuthAttempt>>;
    try {
      attempt = await consumeOAuthAttempt(
        ctx,
        { stateHash: sha256Hex(validState), bindingHash: sha256Hex(validNonce) },
        { workerApi: deps.workerApi() },
      );
    } catch (error) {
      if (error instanceof OAuthAttemptRejectedError) return finish('rechazado', 'consumo');
      throw error;
    }
    const returnPath = attempt.returnPath;

    // D-M16.1-03: en M16.1 `reauth` valida la conexión y la generación, sin canjear el código.
    if (attempt.purpose === 'reauth') {
      const live = await deps.readLiveConnection(ctx);
      const unchanged =
        live !== null && live.id === attempt.expectedConnectionId && live.credentialGeneration === attempt.expectedGeneration;
      return finish(unchanged ? 'reautorizacion_no_disponible' : 'credencial_cambio', 'reauth', { returnPath });
    }

    let config: MetaOAuthConfig;
    try {
      config = deps.config();
    } catch (error) {
      if (error instanceof MetaConfigError) return finish('error', 'configuracion', { returnPath });
      throw error;
    }

    let etapa: MetaOAuthLogEvent['etapa'] = 'canje';
    try {
      const token = await exchangeCodeForToken(code, { http: deps.http, config });
      etapa = 'inspeccion';
      const validated = await inspectToken(token, { http: deps.http, config });
      etapa = 'negocio';
      const clientBusinessId = await fetchClientBusinessId(token, { http: deps.http });

      etapa = 'pendiente';
      const keyring = deps.keyring();
      const workerApi = deps.workerApi();
      const operation = preparePendingConnectionWithCredential(
        ctx,
        {
          token: token.reveal(),
          tokenType: validated.tokenType,
          issuedForAppId: validated.issuedForAppId,
          grantedScopes: validated.grantedScopes,
          expiresAt: validated.expiresAt,
          clientBusinessId,
        },
        { keyring },
      );
      try {
        await executePreparedCredentialOperation(ctx, operation, { workerApi, keyring });
      } catch (error) {
        // Transporte o timeout: una sola vez, con la misma operación preparada (idempotente).
        if (!(error instanceof WorkerApiError && error.code === 'unavailable' &&
              (error.failureKind === 'transport' || error.failureKind === 'timeout'))) {
          throw error;
        }
        await executePreparedCredentialOperation(ctx, operation, { workerApi, keyring });
      }
      return finish('pendiente', 'pendiente', { returnPath });
    } catch (error) {
      if (error instanceof MetaApiError) return finish(metaOutcome(error), etapa, { clase: error.errorClass, returnPath });
      if (error instanceof TokenRejectedError) {
        return finish(error.reason === 'missing_ads_read' ? 'permiso_faltante' : 'token_no_valido', etapa, { returnPath });
      }
      if (error instanceof WorkerApiError && error.code === 'live_connection_exists') {
        return finish('conexion_existente', etapa, { returnPath });
      }
      return finish('error', etapa, { returnPath });
    }
  } catch {
    return finish('error', 'consumo');
  }
}
