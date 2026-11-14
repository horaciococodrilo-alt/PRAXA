import 'server-only';

import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

import {
  BROWSER_BINDING_COOKIE,
  OAuthAttemptRejectedError,
  RETURN_PATH_ALLOWLIST,
  TIENDANUBE_SCOPES,
  currencyCodeSchema,
  isExactTiendanubeScopes,
  oauthStateSchema,
  returnPathSchema,
  tiendanubeStoreIdSchema,
  timeZoneSchema,
  type IntegrationConnectionRecord,
  type IntegrationErrorClass,
  type ReturnPath,
} from '@/modules/integrations/contract';
import { NoCompanyError } from '@/modules/company/service';
import { UnauthorizedError } from '@/modules/identity/session';
import { requireTenantContext, type TenantContext } from '@/modules/tenant/context';
import { getCredentialKeyring, type CredentialKeyring } from '../crypto/keyring';
import { SecretValue } from '../crypto/seal';
import { getWorkerApi, WorkerApiError, type WorkerApi } from '../db/worker-api';
import { runLazyPurge, type MetaLifecycleLogEvent } from '../lifecycle';
import { consumeOAuthAttempt, createOAuthAttempt, LiveConnectionExistsError,
  type ConsumedAttempt } from '../repository/attempts';
import { readConnectionRecord, readLiveConnection, type LiveConnection } from '../repository/connections';
import { executePreparedCredentialOperation, preparePendingConnectionWithCredential,
  prepareReplaceCredential, type PreparedCredentialOperation } from '../repository/credentials';
import { beginDisconnect, confirmConnection, purgeConnection } from '../repository/lifecycle-calls';
import { createTiendanubeHttpClient, type TiendanubeHttpClient } from './client';
import {
  TiendanubeConfigError,
  authorizationUrl,
  getTiendanubeConfig,
  userAgentFor,
  type TiendanubeConfig,
} from './config';
import { TiendanubeApiError } from './errors';

/**
 * OAuth de Tiendanube (M16e §1, etapa .2).
 *
 * Igual que Meta: las dos rutas construyen K01 adentro y nunca reciben actor ni empresa del
 * navegador; el inicio solo acepta `POST` desde el propio origen (DP-04); el callback consume
 * el intento antes de cualquier otra cosa y termina en una redirección limpia.
 *
 * Diferencias con Meta:
 * - No hay elección de cuenta. El canje devuelve la tienda y `GET /store` la confirma, con
 *   zona y moneda, antes de activar. La pendiente dura solo ese tramo; si la activación falla,
 *   se desconecta y se purga en el mismo pedido.
 * - No hay revocación remota: un token rechazado se descarta en memoria.
 * - La reautorización solo sustituye la credencial si la tienda es la misma (CA-37c).
 *
 * Ni el código, ni el `state`, ni el token, ni el ID de la tienda se registran.
 */

export const OAUTH_START_TTL_MS = 9 * 60 * 1000;

const LOGIN_PATH = '/login';
const DEFAULT_RETURN_PATH: ReturnPath = RETURN_PATH_ALLOWLIST[0];
const RESULT_PARAM = 'tiendanube';
const TOKEN_MAX_LENGTH = 2048;

// ---------------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------------

export const TIENDANUBE_OAUTH_OUTCOMES = [
  'conectado',
  'reautorizado',
  'cancelado',
  'rechazado',
  'iniciar_desde_praxa',
  'permisos_distintos',
  'tienda_incompleta',
  'tienda_suspendida',
  'otra_tienda',
  'conexion_existente',
  'conexion_en_curso',
  'credencial_cambio',
  'desconectado',
  'desconexion_en_curso',
  'sin_empresa',
  'tiendanube_no_disponible',
  'error',
] as const;

export type TiendanubeOAuthOutcome = (typeof TIENDANUBE_OAUTH_OUTCOMES)[number];

const UNINSTALL = 'Si llegaste a instalar la app, podés desinstalarla desde el administrador de tu tienda, en Aplicaciones.';

/** Textos fijos que muestra Integraciones; ningún texto de Tiendanube llega a la pantalla. */
export const TIENDANUBE_OAUTH_MESSAGES: Readonly<Record<TiendanubeOAuthOutcome,
  Readonly<{ tone: 'ok' | 'info' | 'error'; text: string }>>> = Object.freeze({
  conectado: { tone: 'ok', text: 'Conectaste tu tienda de Tiendanube.' },
  reautorizado: { tone: 'ok', text: 'Volviste a autorizar a Praxa en Tiendanube.' },
  cancelado: { tone: 'info', text: 'Cancelaste la conexión con Tiendanube. No se guardó nada.' },
  rechazado: { tone: 'error', text: `La autorización no es válida o ya se usó. Volvé a iniciar la conexión. ${UNINSTALL}` },
  iniciar_desde_praxa: { tone: 'error', text: `Iniciá la conexión desde Praxa, en Integraciones. ${UNINSTALL}` },
  permisos_distintos: { tone: 'error', text: `Tiendanube concedió permisos distintos de los tres de lectura que usa Praxa. No se creó la conexión. ${UNINSTALL}` },
  tienda_incompleta: { tone: 'error', text: `Tiendanube no devolvió la tienda, su zona horaria o su moneda. La conexión no se activó. ${UNINSTALL}` },
  tienda_suspendida: { tone: 'error', text: 'La tienda está suspendida en Tiendanube. La conexión no se activó.' },
  otra_tienda: { tone: 'error', text: 'Autorizaste otra tienda. Para cambiar de tienda, desconectá primero.' },
  conexion_existente: { tone: 'info', text: 'Tu empresa ya tiene una tienda de Tiendanube conectada.' },
  conexion_en_curso: { tone: 'info', text: 'Hay una conexión con Tiendanube en curso. Probá de nuevo en unos minutos.' },
  credencial_cambio: { tone: 'error', text: 'La conexión cambió mientras autorizabas. Volvé a iniciar la reconexión.' },
  desconectado: { tone: 'ok', text: 'Desconectaste Tiendanube. Se borraron la credencial y los datos de la tienda de la base activa.' },
  desconexion_en_curso: { tone: 'info', text: 'La desconexión no terminó. Se va a completar la próxima vez que abras esta página.' },
  sin_empresa: { tone: 'error', text: 'Primero completá los datos de tu empresa en Configuración.' },
  tiendanube_no_disponible: { tone: 'error', text: `Tiendanube no respondió como esperábamos. Probá de nuevo en unos minutos. ${UNINSTALL}` },
  error: { tone: 'error', text: 'No pudimos completar la conexión. Probá de nuevo más tarde.' },
});

const KNOWN = new Set<string>(TIENDANUBE_OAUTH_OUTCOMES);

export function parseTiendanubeOAuthOutcome(value: string | string[] | undefined): TiendanubeOAuthOutcome | null {
  return typeof value === 'string' && KNOWN.has(value) ? (value as TiendanubeOAuthOutcome) : null;
}

// ---------------------------------------------------------------------------
// Dependencias
// ---------------------------------------------------------------------------

type Stage = 'inicio' | 'configuracion' | 'consumo' | 'canje' | 'tienda' | 'pendiente' | 'confirmacion' | 'reauth';

export type TiendanubeOAuthLogEvent = {
  evento: 'tiendanube_oauth';
  etapa: Stage;
  resultado: TiendanubeOAuthOutcome | 'ok';
  clase?: IntegrationErrorClass;
  request_id?: string;
};

export type TiendanubeOAuthDeps = {
  tenant: () => Promise<TenantContext>;
  config: () => TiendanubeConfig;
  http: (config: TiendanubeConfig) => TiendanubeHttpClient;
  workerApi?: WorkerApi;
  keyring?: CredentialKeyring;
  readLiveConnection: (ctx: TenantContext) => Promise<LiveConnection | null>;
  readConnection: (ctx: TenantContext) => Promise<IntegrationConnectionRecord | null>;
  now: () => Date;
  randomBytes: (size: number) => Buffer;
  log: (event: TiendanubeOAuthLogEvent | MetaLifecycleLogEvent) => void;
};

function resolveDeps(partial: Partial<TiendanubeOAuthDeps> = {}) {
  let workerApi = partial.workerApi;
  let keyring = partial.keyring;
  return {
    tenant: partial.tenant ?? requireTenantContext,
    config: partial.config ?? getTiendanubeConfig,
    http: partial.http ?? ((config: TiendanubeConfig) => createTiendanubeHttpClient({ userAgent: userAgentFor(config) })),
    readLiveConnection: partial.readLiveConnection ?? ((ctx: TenantContext) => readLiveConnection(ctx, 'tiendanube')),
    readConnection: partial.readConnection ?? ((ctx: TenantContext) => readConnectionRecord(ctx, {}, 'tiendanube')),
    now: partial.now ?? (() => new Date()),
    randomBytes: partial.randomBytes ?? nodeRandomBytes,
    log: partial.log ?? ((event: TiendanubeOAuthLogEvent | MetaLifecycleLogEvent) => console.info(JSON.stringify(event))),
    // Perezosos: un rechazo temprano no necesita la base ni el llavero.
    workerApi: () => (workerApi ??= getWorkerApi()),
    keyring: () => (keyring ??= getCredentialKeyring()),
  };
}

type Resolved = ReturnType<typeof resolveDeps>;

const sha256Hex = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

function randomToken(deps: Resolved): string {
  return oauthStateSchema.parse(deps.randomBytes(32).toString('base64url'));
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

function resultUrl(request: NextRequest, outcome: TiendanubeOAuthOutcome, returnPath: ReturnPath = DEFAULT_RETURN_PATH): URL {
  const url = new URL(returnPath, request.nextUrl.origin);
  url.searchParams.set(RESULT_PARAM, outcome);
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

function withClearedCookie(response: NextResponse): NextResponse {
  response.cookies.set({ name: BROWSER_BINDING_COOKIE.name, value: '', ...cookieAttributes, maxAge: 0 });
  return response;
}

// ---------------------------------------------------------------------------
// Canje y tienda
// ---------------------------------------------------------------------------

/** La respuesta del canje no sirve: falta el token, la tienda o no es `bearer`. */
export class TiendanubeTokenRejectedError extends Error {
  readonly reason: 'respuesta_invalida' | 'permisos_distintos';
  constructor(reason: 'respuesta_invalida' | 'permisos_distintos') {
    super('Tiendanube devolvió una autorización que Praxa no puede usar.');
    this.name = 'TiendanubeTokenRejectedError';
    this.reason = reason;
  }
}

/** `GET /store` no confirmó la tienda, su zona o su moneda (M16e-H-02). */
export class TiendanubeStoreIncompleteError extends Error {
  constructor() {
    super('Tiendanube no devolvió los datos de la tienda.');
    this.name = 'TiendanubeStoreIncompleteError';
  }
}

export type ExchangedToken = Readonly<{ token: SecretValue; storeId: string; scopes: readonly string[] }>;

function storeIdOf(value: unknown): string | null {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  return typeof text === 'string' && tiendanubeStoreIdSchema.safeParse(text).success ? text : null;
}

/**
 * `access_token`, `token_type: bearer`, `scope` separado por comas y la tienda en `user_id`
 * (o `store_id`). Los permisos tienen que ser exactamente los tres `read_*`.
 */
export function parseTokenResponse(body: unknown): ExchangedToken {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TiendanubeTokenRejectedError('respuesta_invalida');
  const fields = body as Record<string, unknown>;
  const token = fields.access_token;
  if (typeof token !== 'string' || token === '' || token.length > TOKEN_MAX_LENGTH || /\s/.test(token)) {
    throw new TiendanubeTokenRejectedError('respuesta_invalida');
  }
  if (typeof fields.token_type !== 'string' || fields.token_type.toLowerCase() !== 'bearer') {
    throw new TiendanubeTokenRejectedError('respuesta_invalida');
  }
  const fromUser = fields.user_id === undefined ? undefined : storeIdOf(fields.user_id);
  const fromStore = fields.store_id === undefined ? undefined : storeIdOf(fields.store_id);
  if (fromUser === null || fromStore === null || (fromUser === undefined && fromStore === undefined) ||
      (fromUser !== undefined && fromStore !== undefined && fromUser !== fromStore)) {
    throw new TiendanubeTokenRejectedError('respuesta_invalida');
  }
  const storeId = (fromUser ?? fromStore)!;
  if (typeof fields.scope !== 'string') throw new TiendanubeTokenRejectedError('permisos_distintos');
  const scopes = fields.scope.split(',').map((scope) => scope.trim()).filter((scope) => scope !== '');
  if (!isExactTiendanubeScopes(scopes)) throw new TiendanubeTokenRejectedError('permisos_distintos');
  return Object.freeze({ token: new SecretValue(token), storeId, scopes: Object.freeze([...TIENDANUBE_SCOPES]) });
}

export type ConfirmedStore = Readonly<{ currency: string; timezone: string }>;

/** `GET /store`: misma tienda que el canje, con `timezone_id` y `main_currency` válidas. */
export async function fetchConfirmedStore(http: TiendanubeHttpClient, exchanged: ExchangedToken): Promise<ConfirmedStore> {
  const { body } = await http.getJson(exchanged.storeId, 'store', { fields: 'id,main_currency,timezone_id' },
    exchanged.token, 'store');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TiendanubeStoreIncompleteError();
  const store = body as Record<string, unknown>;
  const timezone = timeZoneSchema.safeParse(store.timezone_id);
  const currency = currencyCodeSchema.safeParse(store.main_currency);
  if (storeIdOf(store.id) !== exchanged.storeId || !timezone.success || !currency.success) {
    throw new TiendanubeStoreIncompleteError();
  }
  return Object.freeze({ currency: currency.data, timezone: timezone.data });
}

function outcomeForApiError(error: TiendanubeApiError): TiendanubeOAuthOutcome {
  if (error.kind === 'tienda_suspendida') return 'tienda_suspendida';
  if (error.kind === 'cuota' || error.kind === 'transitorio' || error.kind === 'transporte' ||
      error.kind === 'desconocido') return 'tiendanube_no_disponible';
  return 'rechazado';
}

function isTransient(error: unknown): boolean {
  return error instanceof WorkerApiError && error.code === 'unavailable' &&
    (error.failureKind === 'transport' || error.failureKind === 'timeout');
}

/** Una sola repetición ante transporte o timeout, con la misma operación (idempotente). */
async function executeWithRetry(ctx: TenantContext, operation: PreparedCredentialOperation, deps: Resolved) {
  try {
    return await executePreparedCredentialOperation(ctx, operation, { workerApi: deps.workerApi(), keyring: deps.keyring() });
  } catch (error) {
    if (!isTransient(error)) throw error;
    return executePreparedCredentialOperation(ctx, operation, { workerApi: deps.workerApi(), keyring: deps.keyring() });
  }
}

// ---------------------------------------------------------------------------
// POST /api/integraciones/tiendanube/iniciar
// ---------------------------------------------------------------------------

export async function handleTiendanubeStart(request: NextRequest, partial?: Partial<TiendanubeOAuthDeps>):
Promise<NextResponse> {
  // DP-04: solo desde el propio origen, antes de leer la sesión.
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return new NextResponse('Solicitud no permitida.', {
      status: 403,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const deps = resolveDeps(partial);
  const finish = (outcome: TiendanubeOAuthOutcome, etapa: Stage, requestId?: string) => {
    deps.log({ evento: 'tiendanube_oauth', etapa, resultado: outcome, ...(requestId ? { request_id: requestId } : {}) });
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
    let config: TiendanubeConfig;
    try {
      config = deps.config();
    } catch (error) {
      if (error instanceof TiendanubeConfigError) return finish('error', 'configuracion', ctx.request_id);
      throw error;
    }
    // La cookie es `__Host-` y la sesión es del host: un callback en otro host fallaría
    // después de que la persona autorizó en Tiendanube.
    if (new URL(config.redirectUri).origin !== request.nextUrl.origin) {
      return finish('error', 'configuracion', ctx.request_id);
    }

    try {
      await runLazyPurge(ctx, { workerApi: deps.workerApi, keyring: deps.keyring, log: deps.log, now: deps.now,
        tenant: deps.tenant });
    } catch {
      deps.log({ evento: 'meta_ciclo', etapa: 'purga', resultado: 'fallida', request_id: ctx.request_id });
    }
    const live = await deps.readLiveConnection(ctx);
    if (live?.status === 'pending_selection') return finish('conexion_en_curso', 'inicio', ctx.request_id);
    const purpose = live === null ? 'initial' : 'reauth';

    const returnPath = returnPathSchema.parse(DEFAULT_RETURN_PATH);
    const state = randomToken(deps);
    const nonce = randomToken(deps);
    const expiresAt = new Date(deps.now().getTime() + OAUTH_START_TTL_MS);
    try {
      await createOAuthAttempt(ctx, {
        provider: 'tiendanube',
        purpose,
        stateHash: sha256Hex(state),
        bindingHash: sha256Hex(nonce),
        returnPath,
        expiresAt,
        expectedConnectionId: live === null ? null : live.id,
      }, { workerApi: deps.workerApi() });
    } catch (error) {
      if (error instanceof LiveConnectionExistsError) return finish('conexion_existente', 'inicio', ctx.request_id);
      throw error;
    }

    deps.log({ evento: 'tiendanube_oauth', etapa: 'inicio', resultado: 'ok', request_id: ctx.request_id });
    const response = redirect(authorizationUrl(config, state));
    response.cookies.set({ name: BROWSER_BINDING_COOKIE.name, value: nonce, ...cookieAttributes,
      maxAge: OAUTH_START_TTL_MS / 1000 });
    return response;
  } catch {
    return finish('error', 'inicio', ctx.request_id);
  }
}

// ---------------------------------------------------------------------------
// GET /api/integraciones/tiendanube/callback
// ---------------------------------------------------------------------------

type Finish = (outcome: TiendanubeOAuthOutcome, etapa: Stage, options?: { clase?: IntegrationErrorClass | null }) =>
  NextResponse;

export async function handleTiendanubeCallback(request: NextRequest, partial?: Partial<TiendanubeOAuthDeps>):
Promise<NextResponse> {
  const deps = resolveDeps(partial);
  const params = request.nextUrl.searchParams;
  const state = params.get('state');
  const code = params.get('code');
  const nonce = request.cookies.get(BROWSER_BINDING_COOKIE.name)?.value ?? null;

  const logContext: { requestId?: string; returnPath?: ReturnPath } = {};
  const finish: Finish = (outcome, etapa, options = {}) => {
    deps.log({
      evento: 'tiendanube_oauth', etapa, resultado: outcome,
      ...(options.clase ? { clase: options.clase } : {}),
      ...(logContext.requestId ? { request_id: logContext.requestId } : {}),
    });
    return withClearedCookie(redirect(resultUrl(request, outcome, logContext.returnPath)));
  };

  let ctx: TenantContext;
  try {
    ctx = await deps.tenant();
  } catch (error) {
    if (error instanceof UnauthorizedError) return withClearedCookie(redirect(loginUrl(request)));
    return finish(error instanceof NoCompanyError ? 'sin_empresa' : 'error', 'consumo');
  }
  logContext.requestId = ctx.request_id;

  // Una instalación iniciada desde Tiendanube llega sin `state`: no hay intento que la ate a
  // una persona y una empresa de PRAXA. El código se descarta sin canjear.
  if (state === null) return finish('iniciar_desde_praxa', 'consumo');

  const validState = oauthStateSchema.safeParse(state).success ? state : null;
  const validNonce = nonce !== null && oauthStateSchema.safeParse(nonce).success ? nonce : null;
  if (validState === null || validNonce === null) return finish('rechazado', 'consumo');

  let stage: Stage = 'consumo';
  try {
    let attempt: ConsumedAttempt;
    try {
      attempt = await consumeOAuthAttempt(ctx,
        { provider: 'tiendanube', stateHash: sha256Hex(validState), bindingHash: sha256Hex(validNonce) },
        { workerApi: deps.workerApi() });
    } catch (error) {
      // Sin código, la persona canceló: se muestra aunque el intento no sirva.
      if (code === null || code === '') return finish('cancelado', 'consumo');
      if (error instanceof OAuthAttemptRejectedError) return finish('rechazado', 'consumo');
      throw error;
    }
    logContext.returnPath = attempt.returnPath;
    if (code === null || code === '') return finish('cancelado', 'consumo');

    let connection: IntegrationConnectionRecord | null = null;
    if (attempt.purpose === 'reauth') {
      stage = 'reauth';
      connection = await deps.readConnection(ctx);
      if (!connection || connection.id !== attempt.expectedConnectionId ||
          connection.credential_generation !== attempt.expectedGeneration ||
          (connection.status !== 'active' && connection.status !== 'needs_reauth')) {
        return finish('credencial_cambio', 'reauth');
      }
    }

    stage = 'configuracion';
    let config: TiendanubeConfig;
    try {
      config = deps.config();
    } catch (error) {
      if (error instanceof TiendanubeConfigError) return finish('error', 'configuracion');
      throw error;
    }
    const http = deps.http(config);

    stage = 'canje';
    let exchanged: ExchangedToken;
    try {
      exchanged = parseTokenResponse(await http.exchangeCode({ clientId: config.clientId,
        clientSecret: config.clientSecret, code }));
    } catch (error) {
      if (error instanceof TiendanubeTokenRejectedError) {
        return finish(error.reason === 'permisos_distintos' ? 'permisos_distintos' : 'rechazado', 'canje');
      }
      if (error instanceof TiendanubeApiError) return finish(outcomeForApiError(error), 'canje', { clase: error.errorClass });
      throw error;
    }

    // A partir de acá el token solo vive en memoria; cada rechazo lo descarta sin guardarlo.
    if (attempt.purpose === 'reauth') {
      return await completeReauth(ctx, attempt, connection!, exchanged, config, deps, finish);
    }

    stage = 'tienda';
    let store: ConfirmedStore;
    try {
      store = await fetchConfirmedStore(http, exchanged);
    } catch (error) {
      if (error instanceof TiendanubeStoreIncompleteError) return finish('tienda_incompleta', 'tienda');
      if (error instanceof TiendanubeApiError) return finish(outcomeForApiError(error), 'tienda', { clase: error.errorClass });
      throw error;
    }

    stage = 'pendiente';
    const operation = preparePendingConnectionWithCredential(ctx, {
      provider: 'tiendanube', token: exchanged.token.reveal(), tokenType: 'store_app_token',
      issuedForAppId: config.appId, grantedScopes: exchanged.scopes, expiresAt: null, clientBusinessId: null,
    }, { keyring: deps.keyring() });
    let connectionId: string;
    try {
      connectionId = (await executeWithRetry(ctx, operation, deps)).connectionId;
    } catch (error) {
      if (error instanceof WorkerApiError && error.code === 'live_connection_exists') {
        return finish('conexion_existente', 'pendiente');
      }
      throw error;
    }

    stage = 'confirmacion';
    const input = { connectionId, externalAccountId: exchanged.storeId, currency: store.currency, timezone: store.timezone };
    try {
      try {
        await confirmConnection(ctx, input, { workerApi: deps.workerApi() });
      } catch (error) {
        if (!isTransient(error)) throw error;
        await confirmConnection(ctx, input, { workerApi: deps.workerApi() });
      }
    } catch {
      // La pendiente no se puede activar: se desconecta y se purga ya, sin esperar 30 minutos.
      try {
        await beginDisconnect(ctx, connectionId, { workerApi: deps.workerApi() });
        await purgeConnection(ctx, connectionId, { workerApi: deps.workerApi() });
      } catch {
        // La purga perezosa la completa al vencer la pendiente.
      }
      return finish('error', 'confirmacion');
    }
    return finish('conectado', 'confirmacion');
  } catch {
    return finish('error', stage);
  }
}

/** CA-37c: misma tienda y misma generación, o no se toca la credencial. */
async function completeReauth(
  ctx: TenantContext,
  attempt: ConsumedAttempt,
  connection: IntegrationConnectionRecord,
  exchanged: ExchangedToken,
  config: TiendanubeConfig,
  deps: Resolved,
  finish: Finish,
): Promise<NextResponse> {
  if (exchanged.storeId !== connection.external_account_id) return finish('otra_tienda', 'reauth');
  const operation = prepareReplaceCredential(ctx, {
    provider: 'tiendanube', connectionId: connection.id, attemptId: attempt.attemptId,
    token: exchanged.token.reveal(), tokenType: 'store_app_token', issuedForAppId: config.appId,
    grantedScopes: exchanged.scopes, expiresAt: null,
  }, { keyring: deps.keyring() });
  try {
    await executeWithRetry(ctx, operation, deps);
    return finish('reautorizado', 'reauth');
  } catch (error) {
    if (error instanceof WorkerApiError) {
      if (['generation_mismatch', 'invalid_transition', 'not_authorized'].includes(error.code)) {
        return finish('credencial_cambio', 'reauth');
      }
      if (error.code === 'attempt_rejected') return finish('rechazado', 'reauth');
    }
    return finish('error', 'reauth');
  }
}
