import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NoCompanyError } from '@/modules/company/service';
import { integrationConnectionRecordSchema, type IntegrationConnectionRecord } from '@/modules/integrations/contract';
import { requireTenantContext, type TenantContext } from '@/modules/tenant/context';
import { readConnectionRecord } from '../repository/connections';
import { addDays, localDay } from './sync';

/**
 * Lo que muestra la pantalla de Tiendanube (M16e §5, etapa .4). Todo se lee con el JWT del
 * usuario y bajo RLS, solo con las funciones `get_tn_*`: ningún ID de tienda, pedido o
 * cliente llega a la pantalla.
 *
 * Los períodos se calculan en la zona de la tienda. Sin `TN_COLLECTED_AMOUNT_ENABLED` no se
 * muestra ningún importe: la pantalla cuenta pedidos y unidades.
 */

export type TiendanubeCardState =
  | Readonly<{ kind: 'sin_empresa' }>
  | Readonly<{ kind: 'sin_conexion' }>
  | Readonly<{ kind: 'pendiente' }>
  | Readonly<{ kind: 'activa'; dominio: string | null; moneda: string; zona: string; aviso: string | null }>
  | Readonly<{ kind: 'requiere_reauth'; dominio: string | null; moneda: string; zona: string; aviso: string | null }>
  | Readonly<{ kind: 'error' }>;

export type TiendanubeEstado = Readonly<{
  fase: 'backfill' | 'incremental';
  backfillTerminado: boolean;
  /** Último día local con datos completos; `null` mientras no hay cobertura. */
  cubiertoHasta: string | null;
  ultimaEjecucion: Readonly<{ inicio: string; fin: string | null; estado: string }> | null;
  ultimaExtraccion: string | null;
  catalogoCompleto: string | null;
  zona: string;
}>;

export type VentaPeriodo = Readonly<{
  periodo: string;
  /** `null` en un período cubierto sin ventas: es un cero real, no ausencia. */
  moneda: string | null;
  pagados: number;
  sinCliente: number;
  parciales: number;
  cubierto: boolean;
}>;

export type ProductoVendido = Readonly<{
  puesto: number;
  nombre: string;
  sku: string | null;
  eliminado: boolean;
  unidades: number;
}>;

export type CeldaCohorte = Readonly<{
  desplazamiento: number;
  /** `null` cuando la celda tiene menos de cinco activos. */
  retencion: number | null;
  oculta: boolean;
  parcial: boolean;
}>;

export type FilaCohorte = Readonly<{
  mes: string;
  /** `null` cuando la cohorte tiene menos de cinco clientes. */
  tamano: number | null;
  oculta: boolean;
  celdas: readonly CeldaCohorte[];
}>;

export type TiendanubeDatos = Readonly<{
  estado: TiendanubeEstado | null;
  ventas: Readonly<{ desde: string; hasta: string; filas: readonly VentaPeriodo[] }>;
  productos: Readonly<{ desde: string; hasta: string; cubierto: boolean; filas: readonly ProductoVendido[] }>;
  cohortes: Readonly<{ desde: string; hasta: string; filas: readonly FilaCohorte[] }>;
}>;

export type TiendanubeVista = Readonly<{ tarjeta: TiendanubeCardState; datos: TiendanubeDatos | null; error: boolean }>;

export const VENTAS_MESES = 12;
export const PRODUCTOS_DIAS = 28;
export const PRODUCTOS_LIMITE = 10;
export const COHORTES_MESES = 12;
export const COHORTES_DESPLAZAMIENTO = 6;
export const DOMINIO_MAX = 32;

/** Dominio de la tienda acortado para la tarjeta (CA-52). */
export function truncarDominio(dominio: string | null): string | null {
  if (!dominio) return null;
  return dominio.length <= DOMINIO_MAX ? dominio : `${dominio.slice(0, DOMINIO_MAX - 1)}…`;
}

export type AnalysisDeps = {
  tenant: () => Promise<TenantContext>;
  supabase: () => Promise<SupabaseClient>;
  readConnection: (ctx: TenantContext, supabase: SupabaseClient) => Promise<IntegrationConnectionRecord | null>;
  now: () => Date;
};

function resolveDeps(partial: Partial<AnalysisDeps> = {}): AnalysisDeps {
  return {
    tenant: partial.tenant ?? requireTenantContext,
    supabase: partial.supabase ?? (() => createSupabaseServerClient()),
    readConnection: partial.readConnection ?? ((ctx, supabase) => readConnectionRecord(ctx, { supabase }, 'tiendanube')),
    now: partial.now ?? (() => new Date()),
  };
}

type Row = Record<string, unknown>;

function rows(data: unknown): Row[] {
  if (!Array.isArray(data)) throw new Error('lectura inválida');
  return data as Row[];
}

const text = (value: unknown) => (typeof value === 'string' ? value : null);
const int = (value: unknown) => {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error('lectura inválida');
  return n;
};
const iso = (value: unknown) => (typeof value === 'string' ? new Date(value).toISOString() : null);

async function rpc(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<Row[]> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error('lectura inválida');
  return rows(data);
}

function monthStart(day: string, monthsBack: number): string {
  const [y, m] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 - monthsBack, 1)).toISOString().slice(0, 10);
}

async function readDatos(supabase: SupabaseClient, connection: IntegrationConnectionRecord, now: Date):
Promise<{ datos: TiendanubeDatos; dominio: string | null }> {
  const zona = connection.timezone!;
  const hoy = localDay(now, zona);
  const id = connection.id;

  const [statusRows, ventasRows, productosRows, cohortesRows] = await Promise.all([
    rpc(supabase, 'get_tn_sync_status', { p_connection_id: id }),
    rpc(supabase, 'get_tn_sales', { p_connection_id: id, p_from: monthStart(hoy, VENTAS_MESES - 1), p_to: hoy,
      p_grain: 'month' }),
    rpc(supabase, 'get_tn_product_units', { p_connection_id: id, p_from: addDays(hoy, -(PRODUCTOS_DIAS - 1)), p_to: hoy,
      p_limit: PRODUCTOS_LIMITE }),
    rpc(supabase, 'get_tn_cohorts', { p_connection_id: id, p_from_month: monthStart(hoy, COHORTES_MESES - 1),
      p_to_month: monthStart(hoy, 0), p_max_offset: COHORTES_DESPLAZAMIENTO }),
  ]);

  const s = statusRows[0];
  const estado: TiendanubeEstado | null = s ? {
    fase: s.phase === 'incremental' ? 'incremental' : 'backfill',
    backfillTerminado: s.backfill_done === true,
    cubiertoHasta: text(s.covered_through),
    ultimaEjecucion: s.last_run_started_at ? { inicio: iso(s.last_run_started_at)!, fin: iso(s.last_run_finished_at),
      estado: text(s.last_run_status) ?? 'desconocido' } : null,
    ultimaExtraccion: iso(s.last_fetched_at),
    catalogoCompleto: iso(s.catalog_complete_at),
    zona,
  } : null;

  const ventas: VentaPeriodo[] = ventasRows.map((r) => ({
    periodo: text(r.period_start)!, moneda: text(r.currency), pagados: int(r.paid_orders),
    sinCliente: int(r.paid_orders_without_customer), parciales: int(r.partially_paid_orders), cubierto: r.covered === true,
  }));

  const productos: ProductoVendido[] = productosRows.map((r) => ({
    puesto: int(r.rank), nombre: text(r.name) ?? 'Producto sin nombre', sku: text(r.sku), eliminado: r.deleted === true,
    unidades: int(r.units),
  }));

  const porMes = new Map<string, { tamano: number | null; oculta: boolean; celdas: CeldaCohorte[] }>();
  for (const r of cohortesRows) {
    const mes = text(r.cohort_month)!;
    const fila = porMes.get(mes) ?? { tamano: r.cohort_size === null ? null : int(r.cohort_size),
      oculta: r.size_hidden === true, celdas: [] };
    fila.celdas.push({ desplazamiento: int(r.month_offset),
      retencion: r.retention === null || r.retention === undefined ? null : int(r.retention),
      oculta: r.active_hidden === true, parcial: r.partial === true });
    porMes.set(mes, fila);
  }
  const cohortes: FilaCohorte[] = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, fila]) => ({
    mes, tamano: fila.oculta ? null : fila.tamano, oculta: fila.oculta,
    // Con la cohorte oculta no se muestra ninguna celda (D-M16e-11).
    celdas: fila.oculta ? [] : fila.celdas.sort((a, b) => a.desplazamiento - b.desplazamiento),
  }));

  return {
    dominio: s ? text(s.store_domain) : null,
    datos: {
      estado,
      ventas: { desde: monthStart(hoy, VENTAS_MESES - 1), hasta: hoy, filas: ventas },
      productos: { desde: addDays(hoy, -(PRODUCTOS_DIAS - 1)), hasta: hoy,
        cubierto: productosRows.length === 0 ? (estado?.cubiertoHasta ?? '') >= hoy : productosRows.every((r) => r.covered === true),
        filas: productos },
      cohortes: { desde: monthStart(hoy, COHORTES_MESES - 1), hasta: monthStart(hoy, 0), filas: cohortes },
    },
  };
}

/** Prepara la tarjeta de Tiendanube: estado de la conexión y de la sincronización (lee con tu sesión). */
export async function loadTiendanubeView(partial: Partial<AnalysisDeps> = {}): Promise<TiendanubeVista> {
  const deps = resolveDeps(partial);
  let ctx: TenantContext;
  try { ctx = await deps.tenant(); }
  catch (error) {
    return { tarjeta: error instanceof NoCompanyError ? { kind: 'sin_empresa' } : { kind: 'error' }, datos: null, error: false };
  }
  let supabase: SupabaseClient;
  let connection: IntegrationConnectionRecord | null;
  try {
    supabase = await deps.supabase();
    connection = await deps.readConnection(ctx, supabase);
  } catch {
    return { tarjeta: { kind: 'error' }, datos: null, error: false };
  }
  if (!connection) return { tarjeta: { kind: 'sin_conexion' }, datos: null, error: false };
  const record = integrationConnectionRecordSchema.safeParse(connection);
  if (!record.success || record.data.provider !== 'tiendanube') return { tarjeta: { kind: 'error' }, datos: null, error: false };
  const c = record.data;
  if (c.status === 'pending_selection') return { tarjeta: { kind: 'pendiente' }, datos: null, error: false };
  if ((c.status !== 'active' && c.status !== 'needs_reauth') || !c.timezone || !c.currency) {
    return { tarjeta: { kind: 'error' }, datos: null, error: false };
  }

  let datos: TiendanubeDatos | null = null;
  let dominio: string | null = null;
  let error = false;
  try {
    ({ datos, dominio } = await readDatos(supabase, c, deps.now()));
  } catch {
    error = true;
  }
  const base = { dominio: truncarDominio(dominio), moneda: c.currency, zona: c.timezone,
    aviso: c.last_error_message ?? null };
  return {
    tarjeta: c.status === 'active' ? { kind: 'activa', ...base } : { kind: 'requiere_reauth', ...base },
    datos,
    error,
  };
}
