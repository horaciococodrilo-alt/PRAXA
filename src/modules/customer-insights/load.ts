import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NoCompanyError } from '@/modules/company/service';
import { integrationConnectionRecordSchema, type IntegrationConnectionRecord } from '@/modules/integrations/contract';
import { readConnectionRecord } from '@/modules/integrations/repository/connections';
import { addDays } from '@/modules/integrations/tiendanube/sync';
import { requireTenantContext, type TenantContext } from '@/modules/tenant/context';

import {
  customerInsightsViewSchema,
  dataViewKind,
  insightsDataSchema,
  parseCurrencyParam,
  type CustomerInsightsView,
  type ViewContext,
} from './contract';
import { viewMonetaryDefinition, type MonetaryDefinition } from './monetary';
import { buildAudienceProposals } from './proposals';
import { freshnessOf } from './rules';

/**
 * Vista de `/app/clientes` (spec §1.1 y §8). Server-only: el tenant sale de la membresía, la
 * conexión de Tiendanube se resuelve en el servidor y todo se lee con el JWT del usuario, bajo
 * RLS. La única entrada del navegador es `?currency=`; nunca una empresa ni una conexión.
 *
 * Los estados se resuelven en el orden de la spec y un error nunca lleva texto del proveedor.
 */

export type CustomerInsightsDeps = {
  tenant: () => Promise<TenantContext>;
  supabase: () => Promise<SupabaseClient>;
  readConnection: (ctx: TenantContext, supabase: SupabaseClient) => Promise<IntegrationConnectionRecord | null>;
  now: () => Date;
  /** Definición acreditada por T-04; la vista exige que coincida con la del payload. */
  monetaryDefinition: MonetaryDefinition | null;
};

function resolveDeps(partial: Partial<CustomerInsightsDeps>): CustomerInsightsDeps {
  return {
    tenant: partial.tenant ?? requireTenantContext,
    supabase: partial.supabase ?? (() => createSupabaseServerClient()),
    readConnection: partial.readConnection ?? ((ctx, supabase) => readConnectionRecord(ctx, { supabase }, 'tiendanube')),
    now: partial.now ?? (() => new Date()),
    monetaryDefinition: partial.monetaryDefinition === undefined ? viewMonetaryDefinition() : partial.monetaryDefinition,
  };
}

const NONE = Object.freeze({ availableCurrencies: [] as string[], selectedCurrency: null });
const ACTION = '/app/integraciones' as const;

class ReadError extends Error {
  constructor() { super('Lectura inválida.'); this.name = 'ReadError'; }
}

function rowsOf(result: { data: unknown; error: unknown }): Array<Record<string, unknown>> {
  if (result.error || !Array.isArray(result.data)) throw new ReadError();
  return result.data as Array<Record<string, unknown>>;
}

const text = (value: unknown) => (typeof value === 'string' ? value : null);
const isoOrNull = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

function context(status: Record<string, unknown> | null, timezone: string): ViewContext {
  return { source: 'tiendanube', asOfDay: text(status?.covered_through) ?? null, fetchedAt: isoOrNull(status?.last_fetched_at),
    timezone, currency: null, rfmFrom: null };
}

/** Error genérico conservando, si ya se conocen, las monedas visibles. */
function failure(available: readonly string[] = []): CustomerInsightsView {
  return { kind: 'error', availableCurrencies: [...available], selectedCurrency: null };
}

/**
 * La página usa el mismo instante para la frescura que muestra y para bloquear propuestas
 * (D-M27a-08): nunca dos relojes distintos en una respuesta.
 */
export async function loadCustomerInsightsPage(requestedCurrency: unknown):
Promise<{ view: CustomerInsightsView; nowMs: number }> {
  const now = new Date();
  return { view: await loadCustomerInsightsView(requestedCurrency, { now: () => now }), nowMs: now.getTime() };
}

/**
 * Prepara la pantalla Clientes: lee el análisis de Tiendanube ya calculado (RFM, cohortes) y arma la vista
 * con las propuestas de audiencias.
 */
export async function loadCustomerInsightsView(requestedCurrency: unknown = null,
  partial: Partial<CustomerInsightsDeps> = {}): Promise<CustomerInsightsView> {
  const requested = parseCurrencyParam(requestedCurrency);
  if (!requested.ok) return failure();
  const deps = resolveDeps(partial);

  let ctx: TenantContext;
  try { ctx = await deps.tenant(); }
  catch (error) {
    return error instanceof NoCompanyError ? { kind: 'sin_empresa', ...NONE } : failure();
  }

  let available: string[] = [];
  try {
    const supabase = await deps.supabase();
    const raw = await deps.readConnection(ctx, supabase);
    if (!raw) return { kind: 'sin_conexion', actionHref: ACTION, ...NONE };
    const parsed = integrationConnectionRecordSchema.safeParse(raw);
    if (!parsed.success || parsed.data.provider !== 'tiendanube') return failure();
    const connection = parsed.data;
    if (connection.status === 'needs_reauth') return { kind: 'requiere_reauth', actionHref: ACTION, ...NONE };
    if (connection.status !== 'active' || !connection.timezone) return { kind: 'sin_conexion', actionHref: ACTION, ...NONE };
    const id = connection.id;

    const status = rowsOf(await supabase.rpc('get_tn_sync_status', { p_connection_id: id }))[0] ?? null;
    if (status?.last_run_status === 'running') return { kind: 'actualizando', ...NONE };
    const through = text(status?.covered_through);
    if (!status || status.coverage_until === null || status.coverage_until === undefined || !through ||
        status.last_run_status !== 'complete') {
      return { kind: 'sin_cobertura', context: context(status, connection.timezone), actionHref: ACTION, ...NONE };
    }

    available = rowsOf(await supabase.from('tn_customer_insights').select('currency').eq('connection_id', id)
      .order('currency', { ascending: true }))
      .map((row) => text(row.currency))
      .filter((currency): currency is string => currency !== null && /^[A-Z]{3}$/.test(currency));
    available = [...new Set(available)].sort();

    if (available.length === 0) {
      const sales = rowsOf(await supabase.from('tn_sales_daily').select('day').eq('connection_id', id)
        .gte('day', addDays(through, -364)).lte('day', through).gt('paid_orders', 0).limit(1));
      const ctxView = context(status, connection.timezone);
      return sales.length === 0
        ? { kind: 'sin_compras', context: ctxView, ...NONE }
        : { kind: 'sin_cobertura', context: ctxView, actionHref: ACTION, ...NONE };
    }

    const selected = requested.currency ?? available[0];
    if (!available.includes(selected)) return failure(available);

    const snapshot = rowsOf(await supabase.rpc('get_tn_customer_insights', { p_connection_id: id, p_currency: selected }));
    if (snapshot.length !== 1) return failure(available);
    const data = insightsDataSchema.safeParse(snapshot[0].payload);
    if (!data.success || data.data.currency !== selected) return failure(available);

    // Un payload verificado solo vale con la definición acreditada por T-04 (§1.1).
    const monetary = data.data.quality.monetary;
    if (monetary.status === 'verified' && monetary.definition !== deps.monetaryDefinition) return failure(available);

    const blocked = freshnessOf(data.data.fetchedAt, deps.now().getTime()) === 'vencido';
    const view = {
      kind: dataViewKind(data.data),
      data: data.data,
      proposals: blocked ? [] : buildAudienceProposals(data.data),
      availableCurrencies: available,
      selectedCurrency: selected,
    };
    const checked = customerInsightsViewSchema.safeParse(view);
    return checked.success ? checked.data : failure(available);
  } catch {
    return failure(available);
  }
}
