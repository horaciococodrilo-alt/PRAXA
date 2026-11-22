import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NoCompanyError } from '@/modules/company/service';
import { integrationConnectionRecordSchema, type IntegrationConnectionRecord } from
  '@/modules/integrations/contract';
import { readMetaDailyCoverage, type MetaCoverageRow } from '@/modules/integrations/meta/insights';
import { requireTenantContext, type TenantContext } from '@/modules/tenant/context';
import { readConnectionRecord } from '../repository/connections';
import { GA4_PROVISIONAL_DAYS } from './reports';
import { listGa4Properties, type Ga4PropertyOption } from './selection';
import { ga4LocalDay, shiftGa4Day } from './sync-core';
import { compareGa4Campaigns, groupGa4Items, type Ga4CampaignComparison,
  type Ga4ProductRow, type Ga4Quality } from './view-model';

export type Ga4CardState =
  | Readonly<{ kind: 'sin_empresa' | 'sin_conexion' | 'error' }>
  | Readonly<{ kind: 'pendiente'; options: readonly Ga4PropertyOption[]; listError: boolean }>
  | Readonly<{ kind: 'activa' | 'requiere_reauth'; name: string | null;
      currency: string; timezone: string; notice: string | null }>;

export type Ga4TrafficRow = Readonly<{ day: string | null; sessions: number | null;
  activeUsers: number | null; newUsers: number | null; metaVisits: number | null;
  provisional: boolean; quality: Ga4Quality; sourceQuality: Ga4Quality }>;
export type Ga4FunnelRow = Readonly<{ day: string | null; event: string | null;
  count: number | null; quality: Ga4Quality }>;
export type Ga4SourceRow = Readonly<{ day: string | null; source: string | null;
  medium: string | null; sessions: number | null; quality: Ga4Quality }>;
export type Ga4CohortRow = Readonly<{ month: string; offset: number; size: number | null;
  active: number | null; retention: number | null; absence: string | null;
  sizeHidden: boolean; activeHidden: boolean; provisional: boolean; quality: Ga4Quality }>;
export type Ga4MetaSpendRow = Readonly<{ day: string; spend: string | null;
  currency: string | null; timezone: string | null; presence: string; fetchedAt: string | null }>;
export type Ga4Data = Readonly<{
  from: string; to: string; timezone: string; currency: string; propertyName: string | null;
  coverageFrom: string | null; coverageThrough: string | null;
  lastStep: string | null; lastError: string | null; fetchedAt: string | null;
  preflight: Record<string, unknown> | null; mappingRule: string | null;
  traffic: readonly Ga4TrafficRow[]; sources: readonly Ga4SourceRow[];
  funnel: readonly Ga4FunnelRow[];
  products: readonly Ga4ProductRow[]; cohorts: readonly Ga4CohortRow[];
  campaignMatches: readonly Ga4CampaignComparison[]; unmatchedCampaignSessions: number;
  unmatchedCampaignQualityFlags: readonly string[]; unmappedViewPct: number | null;
  metaSpend: readonly Ga4MetaSpendRow[]; metaConnected: boolean; metaError: boolean;
}>;
export type Ga4View = Readonly<{ card: Ga4CardState; data: Ga4Data | null; error: boolean }>;

type Row = Record<string, unknown>;
function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) throw new Error('Lectura GA4 inválida.');
  return value as Row[];
}
function text(value: unknown): string | null { return typeof value === 'string' ? value : null; }
function number(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) throw new Error('Lectura GA4 inválida.');
  return n;
}
function requiredNumber(value: unknown): number {
  const n = number(value);
  if (n === null) throw new Error('Lectura GA4 inválida.');
  return n;
}
function decimal(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) throw new Error('Lectura GA4 inválida.');
  return n;
}
function quality(value: unknown): Ga4Quality {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
}
async function rpcAll(db: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<Row[]> {
  const output: Row[] = [];
  let total: number | null = null;
  for (;;) {
    const { data, error, count } = await db.rpc(fn, args, { count: 'exact' })
      .range(output.length, output.length + 999);
    if (error || count === null || count > 20_000 || total !== null && count !== total) {
      throw new Error('Lectura GA4 incompleta.');
    }
    const page = rows(data);
    total = count;
    output.push(...page);
    if (output.length === total) return output;
    if (page.length === 0 || output.length > total) throw new Error('Lectura GA4 incompleta.');
  }
}

export type Ga4AnalysisDeps = {
  tenant: () => Promise<TenantContext>;
  supabase: () => Promise<SupabaseClient>;
  readConnection: (ctx: TenantContext, db: SupabaseClient, provider: 'ga4' | 'meta') =>
    Promise<IntegrationConnectionRecord | null>;
  listProperties: () => Promise<readonly Ga4PropertyOption[]>;
  metaCoverage: (input: { connectionId: string; level: 'account' | 'campaign';
    from: string; to: string }, db: SupabaseClient) => Promise<MetaCoverageRow[]>;
  now: () => Date;
};
function depsOf(partial: Partial<Ga4AnalysisDeps>): Ga4AnalysisDeps {
  return {
    tenant: partial.tenant ?? requireTenantContext,
    supabase: partial.supabase ?? (() => createSupabaseServerClient()),
    readConnection: partial.readConnection ?? ((ctx, db, provider) =>
      readConnectionRecord(ctx, { supabase: db }, provider)),
    listProperties: partial.listProperties ?? (() => listGa4Properties()),
    metaCoverage: partial.metaCoverage ?? ((input, db) => readMetaDailyCoverage(input, { supabase: db })),
    now: partial.now ?? (() => new Date()),
  };
}

async function readData(ctx: TenantContext, db: SupabaseClient,
  connection: IntegrationConnectionRecord, deps: Ga4AnalysisDeps): Promise<Ga4Data> {
  const timezone = connection.timezone!;
  const to = ga4LocalDay(deps.now(), timezone);
  const from = shiftGa4Day(to, -27);
  const firstCohortMonth = new Date(`${to}T00:00:00Z`);
  firstCohortMonth.setUTCDate(1);
  firstCohortMonth.setUTCMonth(firstCohortMonth.getUTCMonth() - 11);
  const month = firstCohortMonth.toISOString().slice(0, 10);
  const id = connection.id;
  const dates = { p_connection_id: id, p_from: from, p_to: to };
  const [status, traffic, sources, funnel, items, campaigns, cohorts] = await Promise.all([
    rpcAll(db, 'get_ga4_sync_status', { p_connection_id: id }),
    rpcAll(db, 'get_ga4_traffic', dates),
    rpcAll(db, 'get_ga4_sources', dates),
    rpcAll(db, 'get_ga4_funnel', dates),
    rpcAll(db, 'get_ga4_items', dates),
    rpcAll(db, 'get_ga4_campaigns', dates),
    rpcAll(db, 'get_ga4_cohorts', { p_connection_id: id, p_from: month, p_to: to,
      p_today: to, p_max_offset: 5, p_provisional_days: GA4_PROVISIONAL_DAYS }),
  ]);
  const s = status[0] ?? {};

  const meta = await deps.readConnection(ctx, db, 'meta');
  const metaConnected = meta?.status === 'active' || meta?.status === 'needs_reauth';
  let metaAccount: MetaCoverageRow[] = [];
  let metaCampaign: MetaCoverageRow[] = [];
  let metaError = false;
  if (metaConnected && meta) {
    try {
      [metaAccount, metaCampaign] = await Promise.all([
        deps.metaCoverage({ connectionId: meta.id, level: 'account', from, to }, db),
        deps.metaCoverage({ connectionId: meta.id, level: 'campaign', from, to }, db),
      ]);
    } catch { metaError = true; }
  }
  const mappedCampaigns = campaigns.filter((r) => text(r.day) !== null).map((r) => ({
    day: text(r.day)!, entityRef: text(r.entity_ref), sessions: requiredNumber(r.sessions),
    quality: quality(r.quality),
  }));
  const campaignComparison = compareGa4Campaigns(mappedCampaigns,
    metaCampaign.map((r) => ({ day: r.day, entityRef: r.entity_ref, name: r.name,
      spend: r.spend, currency: r.currency, timezone: r.timezone, fetchedAt: r.fetched_at })));
  const products = groupGa4Items(items.filter((r) => text(r.day) !== null).map((r) => ({
    itemRef: text(r.item_ref), productKey: text(r.product_key), name: text(r.item_name),
    views: requiredNumber(r.views), carts: requiredNumber(r.add_to_carts),
    purchases: requiredNumber(r.purchases), tnUnits: number(r.tn_units),
    quality: quality(r.quality),
  })));
  const totalViews = products.reduce((total, row) => total + row.views, 0);
  const unmappedViews = products.filter((row) => !row.mapped)
    .reduce((total, row) => total + row.views, 0);

  return {
    from, to, timezone, currency: connection.currency!, propertyName: text(s.display_name),
    coverageFrom: text(s.coverage_from), coverageThrough: text(s.coverage_through),
    lastStep: text(s.last_step_status), lastError: text(s.last_error_kind),
    fetchedAt: text(s.last_fetched_at),
    preflight: quality(s.preflight), mappingRule: text(s.item_mapping_rule),
    traffic: traffic.map((r) => ({ day: text(r.day), sessions: number(r.sessions),
      activeUsers: number(r.active_users), newUsers: number(r.new_users),
      metaVisits: number(r.meta_visits), provisional: r.provisional === true,
      quality: quality(r.traffic_quality), sourceQuality: quality(r.source_quality) })),
    sources: sources.map((r) => ({ day: text(r.day), source: text(r.source),
      medium: text(r.medium), sessions: number(r.sessions), quality: quality(r.quality) })),
    funnel: funnel.map((r) => ({ day: text(r.day), event: text(r.event_name),
      count: number(r.event_count), quality: quality(r.quality) })),
    products,
    cohorts: cohorts.map((r) => ({ month: text(r.cohort_month)!, offset: number(r.month_offset)!,
      size: number(r.cohort_size), active: number(r.active), retention: decimal(r.retention),
      absence: text(r.absence), sizeHidden: r.size_hidden === true,
      activeHidden: r.active_hidden === true, provisional: r.provisional === true,
      quality: quality(r.quality) })),
    campaignMatches: campaignComparison.matched,
    unmatchedCampaignSessions: campaignComparison.unmatchedSessions,
    unmatchedCampaignQualityFlags: campaignComparison.unmatchedQualityFlags,
    unmappedViewPct: totalViews > 0 ? (unmappedViews / totalViews) * 100 : null,
    metaSpend: metaAccount.map((r) => ({ day: r.day,
      spend: r.presence === 'no_observado' ? null : r.spend,
      currency: r.currency, timezone: r.timezone, presence: r.presence,
      fetchedAt: r.fetched_at })),
    metaConnected, metaError,
  };
}

/**
 * Prepara la tarjeta de Google Analytics: estado de la conexión y de la sincronización (lee con tu
 * sesión).
 */
export async function loadGa4View(partial: Partial<Ga4AnalysisDeps> = {}): Promise<Ga4View> {
  const deps = depsOf(partial);
  let ctx: TenantContext;
  try { ctx = await deps.tenant(); }
  catch (error) {
    return { card: { kind: error instanceof NoCompanyError ? 'sin_empresa' : 'error' },
      data: null, error: false };
  }
  let db: SupabaseClient;
  let connection: IntegrationConnectionRecord | null;
  try {
    db = await deps.supabase();
    connection = await deps.readConnection(ctx, db, 'ga4');
  } catch { return { card: { kind: 'error' }, data: null, error: false }; }
  if (!connection) return { card: { kind: 'sin_conexion' }, data: null, error: false };
  const parsed = integrationConnectionRecordSchema.safeParse(connection);
  if (!parsed.success || parsed.data.provider !== 'ga4') {
    return { card: { kind: 'error' }, data: null, error: false };
  }
  const c = parsed.data;
  if (c.status === 'pending_selection') {
    try { return { card: { kind: 'pendiente', options: await deps.listProperties(), listError: false },
      data: null, error: false }; }
    catch { return { card: { kind: 'pendiente', options: [], listError: true }, data: null, error: false }; }
  }
  if ((c.status !== 'active' && c.status !== 'needs_reauth') || !c.timezone || !c.currency) {
    return { card: { kind: 'error' }, data: null, error: false };
  }
  let data: Ga4Data | null = null;
  let error = false;
  try { data = await readData(ctx, db, c, deps); }
  catch { error = true; }
  const card: Ga4CardState = { kind: c.status === 'active' ? 'activa' : 'requiere_reauth',
    name: data?.propertyName ?? null, currency: c.currency, timezone: c.timezone,
    notice: c.last_error_message ?? null };
  return { card, data, error };
}
