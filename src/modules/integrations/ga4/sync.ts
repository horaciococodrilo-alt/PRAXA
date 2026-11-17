import 'server-only';

import { randomUUID } from 'node:crypto';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { IntegrationConnectionRecord } from '@/modules/integrations/contract';
import { requireTenantContext, type TenantContext } from '@/modules/tenant/context';
import { getCredentialKeyring } from '../crypto/keyring';
import { SecretValue } from '../crypto/seal';
import { getWorkerApi, WorkerApiError, type WorkerApi } from '../db/worker-api';
import { readConnectionRecord } from '../repository/connections';
import { readCredential } from '../repository/credentials';
import { createGa4Http, Ga4ApiError, parseRefreshResponse, readGa4Config,
  type Ga4Config, type Ga4Http } from './google';
import { GA4_REPORT_CATALOG, GA4_REPORT_VERSION, runGa4Preflight,
  type Ga4Capability, type Ga4CapabilityResult, type Ga4ReportDefinition, type Ga4ReportId } from './reports';
import { applyGa4Failure } from './selection';
import { Ga4SyncDataError, ga4Checkpoint, ga4CohortMonths, ga4DailyWindows,
  ga4LocalDay, ga4PageQuality, ga4ProjectRows, ga4QuotaLow, ga4ReportRequest,
  mergeGa4Quality, type Ga4Window } from './sync-core';

export const GA4_SYNC_RESULTS = ['completa', 'parcial', 'cuota', 'en_curso',
  'requiere_reauth', 'conexion_cambio', 'sin_conexion', 'error'] as const;
export type Ga4SyncResult = (typeof GA4_SYNC_RESULTS)[number];

type SyncStatus = Readonly<{
  phase: 'backfill' | 'incremental' | null;
  coverage_from: string | null;
  coverage_through: string | null;
  last_step_status: string | null;
  preflight: Record<Ga4Capability, Ga4CapabilityResult> | null;
  preflight_at: string | null;
  time_zone: string | null;
  currency_code: string | null;
  display_name: string | null;
}>;
type QualityWindow = Readonly<{ report_id: Ga4ReportId; report_version: number;
  window_from: string; window_to: string; fetched_at: string }>;
export type Ga4SyncDeps = {
  tenant: () => Promise<TenantContext>;
  readConnection: (ctx: TenantContext) => Promise<IntegrationConnectionRecord | null>;
  readStatus: (ctx: TenantContext, connectionId: string) => Promise<SyncStatus | null>;
  readQuality: (ctx: TenantContext, connectionId: string, since: string) => Promise<readonly QualityWindow[]>;
  readToken: (ctx: TenantContext, connectionId: string) => Promise<SecretValue>;
  workerApi: () => WorkerApi;
  config: () => Ga4Config;
  http: Ga4Http;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  randomUUID: () => string;
  log: (event: { evento: 'ga4_sync'; resultado: Ga4SyncResult;
    llamadas: number; ventanas: number; cuota_observada: boolean }) => void;
};

async function defaultStatus(ctx: TenantContext, connectionId: string): Promise<SyncStatus | null> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from('ga4_sync_status')
    .select('phase,coverage_from,coverage_through,last_step_status,preflight,preflight_at,time_zone,currency_code,display_name')
    .eq('company_id', ctx.company_id).eq('connection_id', connectionId).maybeSingle();
  if (error) throw new Error('No se pudo leer el estado GA4.');
  return data as SyncStatus | null;
}
async function defaultQuality(ctx: TenantContext, connectionId: string, since: string):
Promise<readonly QualityWindow[]> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from('ga4_report_quality')
    .select('report_id,report_version,window_from,window_to,fetched_at')
    .eq('company_id', ctx.company_id).eq('connection_id', connectionId).gte('fetched_at', since);
  if (error || !data) throw new Error('No se pudo leer la cobertura GA4.');
  return data as QualityWindow[];
}
function depsOf(partial: Partial<Ga4SyncDeps>): Ga4SyncDeps {
  return {
    tenant: partial.tenant ?? requireTenantContext,
    readConnection: partial.readConnection ?? ((ctx) => readConnectionRecord(ctx, {}, 'ga4')),
    readStatus: partial.readStatus ?? defaultStatus,
    readQuality: partial.readQuality ?? defaultQuality,
    readToken: partial.readToken ?? (async (ctx, id) => (await readCredential(ctx, id,
      { provider: 'ga4', keyring: getCredentialKeyring() })).token),
    workerApi: partial.workerApi ?? getWorkerApi,
    config: partial.config ?? readGa4Config,
    http: partial.http ?? createGa4Http(),
    now: partial.now ?? Date.now,
    sleep: partial.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    randomUUID: partial.randomUUID ?? randomUUID,
    log: partial.log ?? ((event) => console.info(JSON.stringify(event))),
  };
}

class StopStep extends Error {
  constructor(readonly reason: 'budget' | 'quota') { super('Paso GA4 detenido.'); }
}
class StepBudget {
  calls = 0;
  quotaObserved = false;
  private readonly started: number;
  constructor(private readonly deps: Ga4SyncDeps) { this.started = deps.now(); }
  private reserve(): void {
    if (this.calls >= 25 || this.deps.now() - this.started >= 210_000) throw new StopStep('budget');
    this.calls += 1;
  }
  private async call<T>(fn: () => Promise<T>, report: boolean): Promise<T> {
    for (let retry = 0; ; retry += 1) {
      this.reserve();
      try {
        const result = await fn();
        if (report) {
          const low = ga4QuotaLow(result);
          if (low !== null) this.quotaObserved = true;
          if (low) throw new StopStep('quota');
        }
        return result;
      } catch (error) {
        if (error instanceof StopStep) throw error;
        if (!(error instanceof Ga4ApiError) ||
            !['transitorio', 'transporte'].includes(error.kind) || retry >= 2) throw error;
        const wait = retry === 0 ? 1000 : 4000;
        if (this.deps.now() - this.started + wait >= 210_000) throw new StopStep('budget');
        await this.deps.sleep(wait);
      }
    }
  }
  wrap(http: Ga4Http): Ga4Http {
    return { ...http,
      getAdmin: (path, token, query) => this.call(() => http.getAdmin(path, token, query), false),
      getMetadata: (id, token) => this.call(() => http.getMetadata(id, token), false),
      checkCompatibility: (id, token, body) => this.call(() => http.checkCompatibility(id, token, body), false),
      runReport: (id, token, body) => this.call(() => http.runReport(id, token, body), true),
    };
  }
}

function qualityKey(id: Ga4ReportId, window: Ga4Window): string {
  return `${id}:${window.from}:${window.to}`;
}
function targets(preflight: Record<Ga4Capability, Ga4CapabilityResult>): Ga4ReportDefinition[] {
  return GA4_REPORT_CATALOG.filter((report) => preflight[report.capability]?.status === 'disponible');
}
function windowsFor(report: Ga4ReportDefinition, today: string,
  phase: 'backfill' | 'incremental', coverageThrough: string | null): readonly Ga4Window[] {
  if (report.window.kind === 'daily') return ga4DailyWindows(today, phase, coverageThrough);
  const months = ga4CohortMonths(today);
  return [{ from: months[0].from, to: months.at(-1)!.to }];
}
function errorKind(error: unknown): string {
  if (error instanceof Ga4SyncDataError) return error.kind;
  if (error instanceof Ga4ApiError) {
    const kinds: Record<string, string> = {
      autorizacion_perdida: 'credencial_invalida', sin_acceso_propiedad: 'permiso_faltante',
      cuota: 'cuota', transitorio: 'transitorio', transporte: 'transporte',
      consulta_invalida: 'solicitud_invalida', propiedad_no_disponible: 'no_encontrado',
    };
    return kinds[error.kind] ?? 'desconocido';
  }
  return 'desconocido';
}
function responseRows(body: unknown, offset: number): { count: number; rows: unknown[] } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Ga4SyncDataError('campo_invalido');
  const response = body as Record<string, unknown>;
  const rows = response.rows ?? [];
  // H-E1-271: en JSON la API omite `rowCount` y `rows` cuando el informe no tiene filas. La
  // ausencia vale 0 solo si tampoco llegaron filas; con filas, `rowCount` es obligatorio.
  const count = response.rowCount === undefined && Array.isArray(rows) && rows.length === 0
    ? 0 : response.rowCount;
  if (!Number.isInteger(count) || (count as number) < 0 || (count as number) > 25_000 ||
      !Array.isArray(rows) || rows.length !== Math.min(10_000, (count as number) - offset)) {
    throw new Ga4SyncDataError('campo_invalido');
  }
  return { count: count as number, rows };
}
export async function fetchGa4Window(input: { report: Ga4ReportDefinition; window: Ga4Window;
  propertyId: string; token: SecretValue; today: string; currency: string; timezone: string;
  http: Ga4Http }): Promise<{ rows: Record<string, unknown>[]; quality: ReturnType<typeof mergeGa4Quality> }> {
  const pages: ReturnType<typeof ga4PageQuality>[] = [];
  const projected: Record<string, unknown>[] = [];
  let total: number | null = null;
  for (let offset = 0; total === null || offset < total; offset += 10_000) {
    const body = await input.http.runReport(input.propertyId, input.token,
      ga4ReportRequest(input.report, input.window, input.today, offset));
    const page = responseRows(body, offset);
    if (total !== null && page.count !== total) throw new Ga4SyncDataError('campo_invalido');
    total = page.count;
    const quality = ga4PageQuality(body, { currency: input.currency, timezone: input.timezone });
    if (quality.sampling_metadatas.length > 0 || quality.empty_reason !== null) {
      throw new Ga4SyncDataError('calidad_inconsistente');
    }
    pages.push(quality);
    projected.push(...ga4ProjectRows(input.report.id, { rows: page.rows }, input.window, input.today));
  }
  return { rows: projected, quality: mergeGa4Quality(pages) };
}

/** Un paso: sin trabajo en segundo plano y con publicación atómica por informe/ventana. */
export async function syncGa4(partial: Partial<Ga4SyncDeps> = {}): Promise<Ga4SyncResult> {
  const deps = depsOf(partial);
  const ctx = await deps.tenant();
  const connection = await deps.readConnection(ctx);
  if (connection?.status === 'needs_reauth') return 'requiere_reauth';
  if (!connection || connection.status !== 'active' || !connection.external_account_id ||
      !connection.currency || !connection.timezone) return 'sin_conexion';
  const old = await deps.readStatus(ctx, connection.id);
  const resume = (old?.last_step_status === 'incomplete' || old?.last_step_status === 'running') &&
    old.preflight_at !== null;
  const phase = resume && old?.phase ? old.phase : old?.coverage_from ? 'incremental' : 'backfill';
  // La fecha objetivo queda anclada al primer preflight: un paso que cruza
  // medianoche no cambia las ventanas ni invalida los checkpoints previos.
  let today = ga4LocalDay(new Date(resume ? old!.preflight_at! : deps.now()),
    resume && old?.time_zone ? old.time_zone : connection.timezone);
  const budget = new StepBudget(deps);
  const http = budget.wrap(deps.http);
  const worker = deps.workerApi();
  let token: SecretValue;
  try {
    const refresh = await deps.readToken(ctx, connection.id);
    const result = parseRefreshResponse(await deps.http.refresh(refresh, deps.config()));
    if (result.rotated) deps.log({ evento: 'ga4_sync', resultado: 'parcial', llamadas: 0,
      ventanas: 0, cuota_observada: false });
    token = result.accessToken;
  } catch (error) {
    if (error instanceof Ga4ApiError) await applyGa4Failure(ctx, connection, error, worker);
    return error instanceof Ga4ApiError && ['autorizacion_perdida', 'sin_acceso_propiedad'].includes(error.kind)
      ? 'requiere_reauth' : 'error';
  }
  const runId = deps.randomUUID();
  const lease = deps.randomUUID();
  const expires = new Date(deps.now() + 300_000).toISOString();
  const args = [ctx.user_id, ctx.company_id, connection.id, connection.credential_generation,
    runId, lease] as const;
  let started = false;
  let preflightReady = resume && old?.preflight !== null;
  let windows = 0;
  const emit = (result: Ga4SyncResult) => {
    deps.log({ evento: 'ga4_sync', resultado: result, llamadas: budget.calls,
      ventanas: windows, cuota_observada: budget.quotaObserved });
    return result;
  };
  const displaced = async (): Promise<Ga4SyncResult | null> => {
    try {
      const current = await deps.readConnection(ctx);
      if (current?.status === 'needs_reauth') return 'requiere_reauth';
      if (!current || current.status !== 'active' ||
          current.credential_generation !== connection.credential_generation) return 'conexion_cambio';
    } catch { /* Se reporta el fallo original sin leer datos ajenos. */ }
    return null;
  };
  try {
    await worker.call('ga4_start_sync', [...args, expires, phase]);
    started = true;
    let state = old;
    let preflight = resume ? old?.preflight : null;
    if (!preflight || !resume) {
      const result = await runGa4Preflight({ propertyId: connection.external_account_id,
        token, http, today, now: () => new Date(deps.now()) });
      if (!result.canSync || !result.property.name) throw new Ga4SyncDataError('campo_invalido');
      preflight = result.capabilities;
      await worker.call('ga4_set_preflight', [...args, result.property.name,
        result.property.timezone, result.property.currency, preflight, result.targetReports]);
      preflightReady = true;
      state = await deps.readStatus(ctx, connection.id);
      if (state?.preflight_at) {
        today = ga4LocalDay(new Date(state.preflight_at), result.property.timezone);
      }
    }
    if (!preflight || !state?.preflight_at) throw new Ga4SyncDataError('campo_invalido');
    const reports = targets(preflight);
    if (!reports.some((r) => r.id === 'ga4_trafico_dia') ||
        !reports.some((r) => r.id === 'ga4_trafico_fuente') ||
        !reports.some((r) => r.id === 'ga4_cohortes')) throw new Ga4SyncDataError('campo_invalido');
    const property = { currency: state.currency_code ?? connection.currency,
      timezone: state.time_zone ?? connection.timezone };
    const quality = await deps.readQuality(ctx, connection.id, state.preflight_at);
    const complete = new Set(quality.filter((row) => row.report_version === GA4_REPORT_VERSION)
      .map((row) => qualityKey(row.report_id,
        { from: row.window_from, to: row.window_to })));
    const reportWindows = new Map(reports.map((report) => [report.id,
      windowsFor(report, today, phase, old?.coverage_through ?? null)]));
    const completedReports = () => reports.filter((report) => reportWindows.get(report.id)!
      .every((window) => complete.has(qualityKey(report.id, window)))).map((report) => report.id);
    for (const report of reports) for (const window of reportWindows.get(report.id)!) {
      const key = qualityKey(report.id, window);
      if (complete.has(key)) continue;
      const fetched = await fetchGa4Window({ report, window,
        propertyId: connection.external_account_id, token, today, ...property, http });
      complete.add(key);
      await worker.call('ga4_publish_report', [...args, report.id, GA4_REPORT_VERSION,
        window.from, window.to, fetched.quality, JSON.stringify(fetched.rows),
        ga4Checkpoint(completedReports())]);
      windows += 1;
    }
    if (completedReports().length !== reports.length) throw new StopStep('budget');
    const all = ga4DailyWindows(today, phase, old?.coverage_through ?? null);
    await worker.call('ga4_finish_sync', [...args, all.at(-1)?.from ?? today,
      all[0]?.to ?? today]);
    return emit('completa');
  } catch (error) {
    if (error instanceof WorkerApiError && ['generation_mismatch', 'sync_ownership_lost',
      'invalid_transition', 'not_authorized'].includes(error.code)) {
      const changed = await displaced();
      if (changed) return emit(changed);
    }
    if (error instanceof WorkerApiError && ['sync_in_progress', 'live_connection_exists'].includes(error.code)) {
      return emit('en_curso');
    }
    const lowQuota = error instanceof StopStep && error.reason === 'quota' ||
      error instanceof Ga4ApiError && error.kind === 'cuota';
    const budgetStop = error instanceof StopStep;
    if (error instanceof Ga4ApiError) {
      try { await applyGa4Failure(ctx, connection, error, worker); }
      catch { /* la generación pudo cambiar; la escritura final está protegida en SQL */ }
    }
    if (started) {
      const transient = error instanceof Ga4ApiError &&
        ['transitorio', 'transporte'].includes(error.kind);
      const resumable = preflightReady && (budgetStop || lowQuota || transient);
      try { await worker.call('ga4_fail_sync', [...args, resumable ? 'incomplete' : 'failed',
        lowQuota ? 'cuota' : budgetStop && !resumable ? 'transitorio'
          : budgetStop ? null : errorKind(error)]); }
      catch (failure) {
        if (failure instanceof WorkerApiError && ['generation_mismatch', 'sync_ownership_lost',
          'invalid_transition', 'not_authorized'].includes(failure.code)) {
          const changed = await displaced();
          if (changed) return emit(changed);
        }
        return emit('error');
      }
    }
    return emit(lowQuota ? 'cuota' : budgetStop ? 'parcial'
      : error instanceof Ga4ApiError &&
        ['autorizacion_perdida', 'sin_acceso_propiedad'].includes(error.kind) ? 'requiere_reauth' : 'error');
  }
}
