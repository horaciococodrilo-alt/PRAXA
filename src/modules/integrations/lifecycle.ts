import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

import { NoCompanyError } from '@/modules/company/service';
import { integrationConnectionRecordSchema, maskExternalAccountId, toConnectionDto,
  type IntegrationConnectionRecord, type IntegrationErrorClass, type ReauthErrorClass } from '@/modules/integrations/contract';
import { sha256HexSchema } from '@/modules/integrations/contract/primitives';
import { UnauthorizedError } from '@/modules/identity/session';
import { requireTenantContext, type TenantContext } from '@/modules/tenant/context';
import { getCredentialKeyring, type CredentialKeyring } from './crypto/keyring';
import { SecretValue } from './crypto/seal';
import { getWorkerApi, WorkerApiError, type WorkerApi } from './db/worker-api';
import { readConnectionRecord } from './repository/connections';
import { CredentialNotFoundError, executePreparedCredentialOperation, prepareReplaceCredential,
  readCredential } from './repository/credentials';
import type { ConsumedAttempt } from './repository/attempts';
import { beginDisconnect, confirmConnection, listPendingPurges, markNeedsReauth, purgeConnection } from
  './repository/lifecycle-calls';
import { getMetaOAuthConfig, type MetaOAuthConfig } from './meta/api';
import { createMetaHttpClient, type MetaHttpClient } from './meta/client';
import { MetaApiError, connectionEffectFor, rejectionOutcomeFor, type ConnectionEffect } from './meta/errors';
import { AccountListLimitError, listDelegatedAccounts } from './meta/accounts';
import { probeInsights } from './meta/probe';
import { revokeToken } from './meta/revoke';
import { exchangeCodeForToken, fetchSystemUser, inspectToken, TokenRejectedError,
  type TokenRejectionReason } from './meta/tokens';
import type { MetaOAuthOutcome } from './meta/outcomes';
import type { MetaOAuthLogEvent } from './meta/oauth';

export type MetaLifecycleLogEvent = {
  evento: 'meta_ciclo';
  etapa: 'purga' | 'revocacion' | 'listado' | 'prueba' | 'confirmacion' | 'desconexion' | 'reauth' | 'error_conexion' | 'estado';
  resultado: 'ok' | 'fallida' | 'sin_credencial' | 'sin_credencial_legible' | 'omitida' | MetaOAuthOutcome;
  clase?: IntegrationErrorClass;
  request_id?: string;
  filas?: number; campos?: string[]; paginas?: number; llamadas?: number; completa?: boolean; duracion_ms?: number;
  cuentas?: number; descartadas?: number;
};

export type LifecycleDeps = {
  tenant: () => Promise<TenantContext>;
  config: () => MetaOAuthConfig;
  http: MetaHttpClient;
  workerApi: () => WorkerApi;
  keyring: () => CredentialKeyring;
  readConnection: (ctx: TenantContext) => Promise<IntegrationConnectionRecord | null>;
  now: () => Date;
  log: (event: MetaLifecycleLogEvent) => void;
};

function resolveDeps(partial: Partial<LifecycleDeps> = {}): LifecycleDeps {
  return {
    tenant: partial.tenant ?? requireTenantContext,
    config: partial.config ?? getMetaOAuthConfig,
    http: partial.http ?? createMetaHttpClient(),
    workerApi: partial.workerApi ?? getWorkerApi,
    keyring: partial.keyring ?? getCredentialKeyring,
    readConnection: partial.readConnection ?? readConnectionRecord,
    now: partial.now ?? (() => new Date()),
    log: partial.log ?? ((event) => console.info(JSON.stringify(event))),
  };
}

export const PURGE_MAX_PER_RUN = 5;

function log(deps: LifecycleDeps, ctx: TenantContext, event: Omit<MetaLifecycleLogEvent, 'evento' | 'request_id'>) {
  deps.log({ evento: 'meta_ciclo', request_id: ctx.request_id, ...event });
}

function selectionKeyFor(connectionId: string, accountId: string): string {
  return createHash('sha256').update(`${connectionId}:${accountId}`, 'utf8').digest('hex');
}

export async function runLazyPurge(ctx: TenantContext, partial: Partial<LifecycleDeps> = {}):
Promise<{ purged: number; revokeFailed: number; remaining: boolean }> {
  const deps = resolveDeps(partial);
  const pending = await listPendingPurges(ctx, { workerApi: deps.workerApi() });
  let purged = 0;
  let revokeFailed = 0;
  let remaining = pending.length > PURGE_MAX_PER_RUN;
  for (const entry of pending.slice(0, PURGE_MAX_PER_RUN)) {
    try {
      if (entry.status === 'pending_selection') await beginDisconnect(ctx, entry.connectionId, { workerApi: deps.workerApi() });
      if (entry.hasCredential) {
        let token: Awaited<ReturnType<typeof readCredential>>['token'] | null = null;
        try {
          token = (await readCredential(ctx, entry.connectionId,
            { workerApi: deps.workerApi(), keyring: deps.keyring() })).token;
        } catch (error) {
          log(deps, ctx, { etapa: 'revocacion', resultado: error instanceof CredentialNotFoundError
            ? 'sin_credencial' : 'sin_credencial_legible' });
        }
        if (token) {
          try {
            const result = await revokeToken(token, { http: deps.http, config: deps.config() });
            if (result.status === 'revoked') log(deps, ctx, { etapa: 'revocacion', resultado: 'ok' });
            else {
              revokeFailed += 1;
              log(deps, ctx, { etapa: 'revocacion', resultado: 'fallida', clase: result.errorClass });
            }
          } catch {
            revokeFailed += 1;
            log(deps, ctx, { etapa: 'revocacion', resultado: 'fallida', clase: 'own_error' });
          }
        }
      }
      await purgeConnection(ctx, entry.connectionId, { workerApi: deps.workerApi() });
      purged += 1;
      log(deps, ctx, { etapa: 'purga', resultado: 'ok' });
    } catch {
      remaining = true;
      log(deps, ctx, { etapa: 'purga', resultado: 'fallida' });
    }
  }
  return { purged, revokeFailed, remaining };
}

export type DisconnectOutcome = Extract<MetaOAuthOutcome, 'desconectado' | 'desconexion_en_curso' | 'sin_empresa' | 'error'>;

export async function disconnect(partial: Partial<LifecycleDeps> = {}): Promise<DisconnectOutcome> {
  const deps = resolveDeps(partial);
  let ctx: TenantContext;
  try { ctx = await deps.tenant(); }
  catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    return error instanceof NoCompanyError ? 'sin_empresa' : 'error';
  }
  try {
    const connection = await deps.readConnection(ctx);
    if (connection) await beginDisconnect(ctx, connection.id, { workerApi: deps.workerApi() });
  } catch {
    log(deps, ctx, { etapa: 'desconexion', resultado: 'fallida' });
    return 'error';
  }
  try {
    const result = await runLazyPurge(ctx, deps);
    const outcome = result.remaining ? 'desconexion_en_curso' : 'desconectado';
    log(deps, ctx, { etapa: 'desconexion', resultado: outcome });
    return outcome;
  } catch {
    log(deps, ctx, { etapa: 'desconexion', resultado: 'fallida' });
    return 'desconexion_en_curso';
  }
}

export type AccountOption = Readonly<{ selectionKey: string; name: string | null; maskedId: string;
  currency: string; timezone: string }>;
export type MetaCardState =
  | { kind: 'sin_empresa' }
  | { kind: 'sin_conexion' }
  | { kind: 'pendiente'; pendingExpiresAt: string; accounts: readonly AccountOption[];
      discarded: number; listError: MetaOAuthOutcome | null }
  | { kind: 'activa'; maskedId: string; currency: string; timezone: string }
  | { kind: 'requiere_reauth'; maskedId: string; currency: string; timezone: string; errorClass: ReauthErrorClass }
  | { kind: 'error' };

const rejecting = new Set<IntegrationErrorClass>(['own_error', 'authentication', 'user_action', 'permission', 'asset_access']);
function listOutcome(error: unknown): MetaOAuthOutcome {
  if (error instanceof TokenRejectedError) return 'token_no_valido';
  if (error instanceof AccountListLimitError) return 'meta_no_disponible';
  if (error instanceof MetaApiError) return rejecting.has(error.errorClass) ? 'token_no_valido' : 'meta_no_disponible';
  return 'error';
}

export async function loadMetaCardState(partial: Partial<LifecycleDeps> = {}): Promise<MetaCardState> {
  const deps = resolveDeps(partial);
  let ctx: TenantContext;
  try { ctx = await deps.tenant(); }
  catch (error) { return error instanceof NoCompanyError ? { kind: 'sin_empresa' } : { kind: 'error' }; }
  try { await runLazyPurge(ctx, deps); }
  catch { log(deps, ctx, { etapa: 'purga', resultado: 'fallida' }); }
  let connection: IntegrationConnectionRecord | null;
  try { connection = await deps.readConnection(ctx); }
  catch { return { kind: 'error' }; }
  if (!connection) return { kind: 'sin_conexion' };
  const record = integrationConnectionRecordSchema.safeParse(connection);
  if (!record.success) return { kind: 'error' };
  const dto = toConnectionDto(record.data);
  if (record.data.status === 'active') {
    return { kind: 'activa', maskedId: dto.external_account_id_masked!, currency: record.data.currency,
      timezone: record.data.timezone };
  }
  if (record.data.status === 'needs_reauth') {
    return { kind: 'requiere_reauth', maskedId: dto.external_account_id_masked!, currency: record.data.currency,
      timezone: record.data.timezone, errorClass: record.data.last_error_class };
  }
  if (record.data.status !== 'pending_selection') return { kind: 'error' };
  const base = { kind: 'pendiente' as const, pendingExpiresAt: record.data.pending_expires_at,
    accounts: [] as AccountOption[], discarded: 0, listError: null as MetaOAuthOutcome | null };
  if (Date.parse(record.data.pending_expires_at) <= deps.now().getTime()) {
    return { ...base, listError: 'pendiente_vencida' };
  }
  let token: Awaited<ReturnType<typeof readCredential>>['token'];
  try {
    token = (await readCredential(ctx, record.data.id,
      { workerApi: deps.workerApi(), keyring: deps.keyring() })).token;
  } catch { return { ...base, listError: 'error' }; }
  try {
    const systemUser = await fetchSystemUser(token, { http: deps.http });
    const listed = await listDelegatedAccounts(token, systemUser.id, { http: deps.http });
    log(deps, ctx, { etapa: 'listado', resultado: 'ok', cuentas: listed.accounts.length,
      descartadas: listed.discarded });
    return { ...base, discarded: listed.discarded, accounts: listed.accounts.map((account) => ({
      selectionKey: selectionKeyFor(record.data.id, account.id), name: account.name,
      maskedId: maskExternalAccountId(account.id), currency: account.currency, timezone: account.timezone,
    })) };
  } catch (error) {
    const outcome = listOutcome(error);
    log(deps, ctx, { etapa: 'listado', resultado: outcome,
      ...(error instanceof MetaApiError ? { clase: error.errorClass } : {}) });
    return { ...base, listError: outcome };
  }
}

export async function confirmAccount(selectionKey: string, partial: Partial<LifecycleDeps> = {}): Promise<MetaOAuthOutcome> {
  if (!sha256HexSchema.safeParse(selectionKey).success) return 'cuenta_invalida';
  const deps = resolveDeps(partial);
  let ctx: TenantContext;
  try { ctx = await deps.tenant(); }
  catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    return error instanceof NoCompanyError ? 'sin_empresa' : 'error';
  }
  let connection: IntegrationConnectionRecord | null;
  try { connection = await deps.readConnection(ctx); }
  catch { return 'error'; }
  if (!connection || connection.status !== 'pending_selection') return 'conexion_cambio';
  if (Date.parse(connection.pending_expires_at) <= deps.now().getTime()) return 'pendiente_vencida';
  let token: Awaited<ReturnType<typeof readCredential>>['token'];
  try { token = (await readCredential(ctx, connection.id,
    { workerApi: deps.workerApi(), keyring: deps.keyring() })).token; }
  catch { return 'error'; }
  let account: Awaited<ReturnType<typeof listDelegatedAccounts>>['accounts'][number] | undefined;
  try {
    const user = await fetchSystemUser(token, { http: deps.http });
    const listed = await listDelegatedAccounts(token, user.id, { http: deps.http });
    account = listed.accounts.find((candidate) => selectionKeyFor(connection.id, candidate.id) === selectionKey);
  } catch (error) { return listOutcome(error); }
  if (!account) return 'cuenta_invalida';
  let summary: Awaited<ReturnType<typeof probeInsights>>;
  try {
    summary = await probeInsights(token, account.id, { http: deps.http, now: Date.now });
  } catch (error) {
    const outcome = error instanceof MetaApiError && rejecting.has(error.errorClass) ? 'prueba_fallida' : 'meta_no_disponible';
    log(deps, ctx, { etapa: 'prueba', resultado: outcome,
      ...(error instanceof MetaApiError ? { clase: error.errorClass } : {}) });
    return outcome;
  }
  log(deps, ctx, { etapa: 'prueba', resultado: 'ok', filas: summary.rows, campos: [...summary.fieldsPresent],
    paginas: summary.pages, llamadas: summary.calls, completa: summary.complete, duracion_ms: summary.durationMs });
  const input = { connectionId: connection.id, externalAccountId: account.id,
    currency: account.currency, timezone: account.timezone };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await confirmConnection(ctx, input, { workerApi: deps.workerApi() });
      log(deps, ctx, { etapa: 'confirmacion', resultado: 'ok' });
      return 'conectado';
    } catch (error) {
      if (error instanceof WorkerApiError && error.code === 'unavailable' &&
          (error.failureKind === 'transport' || error.failureKind === 'timeout') && attempt === 0) continue;
      if (error instanceof WorkerApiError) {
        if (error.code === 'pending_expired') return 'pendiente_vencida';
        if (error.code === 'invalid_transition' || error.code === 'not_authorized') return 'conexion_cambio';
        if (error.code === 'account_conflict' || error.code === 'invalid_argument') return 'cuenta_invalida';
      }
      return 'error';
    }
  }
  return 'error';
}

export async function applyConnectionFailure(
  ctx: TenantContext,
  connection: { id: string; credentialGeneration: number },
  error: MetaApiError,
  partial: Partial<LifecycleDeps> = {},
): Promise<ConnectionEffect> {
  const deps = resolveDeps(partial);
  const effect = connectionEffectFor(error.errorClass);
  if (effect === 'unchanged') {
    log(deps, ctx, { etapa: 'error_conexion', resultado: 'omitida', clase: error.errorClass });
    return 'unchanged';
  }
  try {
    await markNeedsReauth(ctx, { connectionId: connection.id, expectedGeneration: connection.credentialGeneration,
      errorClass: error.errorClass, message: error.redactedMessage }, { workerApi: deps.workerApi() });
    log(deps, ctx, { etapa: 'error_conexion', resultado: 'ok', clase: error.errorClass });
    return 'needs_reauth';
  } catch (cause) {
    if (cause instanceof WorkerApiError && (cause.code === 'generation_mismatch' || cause.code === 'invalid_transition')) {
      log(deps, ctx, { etapa: 'error_conexion', resultado: 'omitida', clase: error.errorClass });
      return 'unchanged';
    }
    throw cause;
  }
}

export type AmbiguousWriteExpectation =
  | Readonly<{ kind: 'initial' }>
  | Readonly<{ kind: 'reauth'; connectionId: string; expectedGeneration: number }>;
export type AmbiguousWriteResolution = 'applied' | 'not_applied' | 'unreadable';

export async function resolveAmbiguousWrite(
  ctx: TenantContext,
  token: SecretValue,
  expectation: AmbiguousWriteExpectation,
  deps: Pick<LifecycleDeps, 'readConnection' | 'workerApi' | 'keyring'>,
): Promise<AmbiguousWriteResolution> {
  try {
    const connection = await deps.readConnection(ctx);
    if (!connection || (expectation.kind === 'initial'
      ? connection.status !== 'pending_selection'
      : connection.id !== expectation.connectionId || connection.status !== 'active' ||
        connection.credential_generation !== expectation.expectedGeneration + 1)) return 'not_applied';
    const saved = await readCredential(ctx, connection.id,
      { workerApi: deps.workerApi(), keyring: deps.keyring() });
    const expected = createHash('sha256').update(token.reveal()).digest();
    const actual = createHash('sha256').update(saved.token.reveal()).digest();
    return timingSafeEqual(expected, actual) ? 'applied' : 'not_applied';
  } catch { return 'unreadable'; }
}

export type ReauthDeps = Readonly<{
  http: MetaHttpClient;
  config: () => MetaOAuthConfig;
  workerApi: () => WorkerApi;
  keyring: () => CredentialKeyring;
  readConnection: (ctx: TenantContext) => Promise<IntegrationConnectionRecord | null>;
  log: (event: MetaLifecycleLogEvent) => void;
}>;
export type ReauthResult = Readonly<{ outcome: MetaOAuthOutcome; etapa: MetaOAuthLogEvent['etapa'];
  clase?: IntegrationErrorClass; motivo?: TokenRejectionReason }>;

async function revokeNewToken(ctx: TenantContext, token: SecretValue, deps: ReauthDeps): Promise<void> {
  let result: Awaited<ReturnType<typeof revokeToken>>;
  try { result = await revokeToken(token, { http: deps.http, config: deps.config() }); }
  catch { result = { status: 'failed', errorClass: 'own_error' }; }
  deps.log({ evento: 'meta_ciclo', etapa: 'revocacion', resultado: result.status === 'revoked' ? 'ok' : 'fallida',
    ...(result.status === 'failed' ? { clase: result.errorClass } : {}), request_id: ctx.request_id });
}

export async function completeReauth(
  ctx: TenantContext,
  attempt: ConsumedAttempt,
  code: string,
  deps: ReauthDeps,
): Promise<ReauthResult> {
  let connection: IntegrationConnectionRecord | null;
  try { connection = await deps.readConnection(ctx); }
  catch { return { outcome: 'error', etapa: 'reauth' }; }
  if (attempt.purpose !== 'reauth' || !connection ||
      connection.id !== attempt.expectedConnectionId ||
      connection.credential_generation !== attempt.expectedGeneration ||
      (connection.status !== 'active' && connection.status !== 'needs_reauth')) {
    return { outcome: 'credencial_cambio', etapa: 'reauth' };
  }
  let config: MetaOAuthConfig;
  try { config = deps.config(); }
  catch { return { outcome: 'error', etapa: 'reauth' }; }
  let token: SecretValue;
  try { token = await exchangeCodeForToken(code, { http: deps.http, config }); }
  catch (error) {
    return error instanceof MetaApiError
      ? { outcome: rejectionOutcomeFor(error.errorClass), etapa: 'canje', clase: error.errorClass }
      : { outcome: 'error', etapa: 'canje' };
  }
  let validated: Awaited<ReturnType<typeof inspectToken>>;
  let etapa: MetaOAuthLogEvent['etapa'] = 'inspeccion';
  try {
    validated = await inspectToken(token, { http: deps.http, config });
    etapa = 'negocio';
    const user = await fetchSystemUser(token, { http: deps.http });
    etapa = 'reauth';
    const listed = await listDelegatedAccounts(token, user.id, { http: deps.http });
    if (!listed.accounts.some((account) => account.id === connection.external_account_id)) {
      await revokeNewToken(ctx, token, deps);
      return { outcome: 'cuenta_no_delegada', etapa: 'reauth' };
    }
  } catch (error) {
    await revokeNewToken(ctx, token, deps);
    if (error instanceof MetaApiError) {
      return { outcome: rejectionOutcomeFor(error.errorClass), etapa, clase: error.errorClass };
    }
    if (error instanceof TokenRejectedError) {
      return { outcome: error.reason === 'missing_ads_read' ? 'permiso_faltante' : 'token_no_valido',
        etapa, motivo: error.reason };
    }
    return { outcome: error instanceof AccountListLimitError ? 'meta_no_disponible' : 'error', etapa };
  }

  const write = () => {
    const keyring = deps.keyring();
    const operation = prepareReplaceCredential(ctx, {
      connectionId: connection.id, attemptId: attempt.attemptId, token: token.reveal(),
      tokenType: validated.tokenType, issuedForAppId: validated.issuedForAppId,
      grantedScopes: validated.grantedScopes, expiresAt: validated.expiresAt,
    }, { keyring });
    return { keyring, operation };
  };
  let prepared: ReturnType<typeof write>;
  try { prepared = write(); }
  catch { await revokeNewToken(ctx, token, deps); return { outcome: 'error', etapa: 'reauth' }; }
  for (let trial = 0; trial < 2; trial += 1) {
    try {
      await executePreparedCredentialOperation(ctx, prepared.operation,
        { workerApi: deps.workerApi(), keyring: prepared.keyring });
      return { outcome: 'reautorizado', etapa: 'reauth' };
    } catch (error) {
      if (error instanceof WorkerApiError && error.code === 'unavailable' &&
          (error.failureKind === 'transport' || error.failureKind === 'timeout')) {
        if (trial === 0) continue;
        const resolution = await resolveAmbiguousWrite(ctx, token,
          { kind: 'reauth', connectionId: connection.id, expectedGeneration: attempt.expectedGeneration! }, deps);
        if (resolution === 'applied') {
          deps.log({ evento: 'meta_ciclo', etapa: 'reauth', resultado: 'ok', request_id: ctx.request_id });
          return { outcome: 'reautorizado', etapa: 'reauth' };
        }
        await revokeNewToken(ctx, token, deps);
        return { outcome: 'error', etapa: 'reauth' };
      }
      await revokeNewToken(ctx, token, deps);
      if (error instanceof WorkerApiError) {
        if (['generation_mismatch', 'invalid_transition', 'not_authorized'].includes(error.code)) {
          return { outcome: 'credencial_cambio', etapa: 'reauth' };
        }
        if (error.code === 'attempt_rejected') return { outcome: 'rechazado', etapa: 'reauth' };
      }
      return { outcome: 'error', etapa: 'reauth' };
    }
  }
  return { outcome: 'error', etapa: 'reauth' };
}
