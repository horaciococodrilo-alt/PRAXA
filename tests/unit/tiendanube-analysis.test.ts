import { describe, expect, it, vi } from 'vitest';

import type { TenantContext } from '@/modules/tenant/context';
import type { IntegrationConnectionRecord } from '@/modules/integrations/contract';

/**
 * M16e etapa .4: `loadTiendanubeView` con Supabase simulado (T-08, parte unitaria). Las
 * funciones `get_tn_*` y sus argumentos se prueban contra la base en `tests/app`.
 */

vi.mock('server-only', () => ({}));

const analysis = await import('@/modules/integrations/tiendanube/analysis');
const { NoCompanyError } = await import('@/modules/company/service');

const CTX: TenantContext = { user_id: '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d',
  company_id: '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f', role: 'owner', request_id: '7c6b5a49-3827-4165-a4b3-c2d1e0f9a8b7' };
const ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';

function connection(over: Partial<IntegrationConnectionRecord> = {}): IntegrationConnectionRecord {
  return { id: ID, company_id: CTX.company_id, provider: 'tiendanube', client_business_id: null, credential_generation: 0,
    current_sync_run_id: null, last_error_class: null, last_error_message: null, created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z', external_account_id: '98765', currency: 'ARS',
    timezone: 'America/Argentina/Buenos_Aires', status: 'active', pending_expires_at: null, purge_requested_at: null,
    ...over } as IntegrationConnectionRecord;
}

const RESPUESTAS: Record<string, unknown[]> = {
  get_tn_sync_status: [{ phase: 'incremental', backfill_done: true, coverage_until: '2026-11-13T15:00:00+00:00',
    covered_through: '2026-11-12', store_domain: 'una-tienda-con-un-dominio-muy-largo.mitiendanube.com',
    last_run_started_at: '2026-11-13T15:00:00+00:00', last_run_finished_at: '2026-11-13T15:01:00+00:00',
    last_run_status: 'complete', last_fetched_at: '2026-11-13T15:01:00+00:00', catalog_complete_at: null }],
  get_tn_sales: [{ period_start: '2026-11-01', currency: 'ARS', paid_orders: 3, paid_orders_without_customer: 1,
    partially_paid_orders: 0, paid_amount: 300, refunded_amount: 0, covered: false }],
  get_tn_product_units: [{ rank: 1, name: 'Remera', sku: null, deleted: false, units: '7', covered: true }],
  get_tn_cohorts: [
    { cohort_month: '2026-09-01', month_offset: 0, cohort_size: null, active: null, retention: null, size_hidden: true,
      active_hidden: true, partial: false },
    { cohort_month: '2026-10-01', month_offset: 1, cohort_size: 6, active: null, retention: null, size_hidden: false,
      active_hidden: true, partial: true },
    { cohort_month: '2026-10-01', month_offset: 0, cohort_size: 6, active: 6, retention: 1, size_hidden: false,
      active_hidden: false, partial: false },
  ],
};

function supabase(fail: string | null = null) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return fn === fail ? { data: null, error: { message: 'x' } } : { data: RESPUESTAS[fn], error: null };
    },
  };
  return { calls, client: client as never };
}

const NOW = new Date('2026-11-14T02:00:00.000Z'); // 23:00 del 13 en Buenos Aires.

describe('M16e-T-08: vista de Tiendanube', () => {
  it('activa: estado, ventas, productos y cohortes; períodos en la zona de la tienda y dominio acortado', async () => {
    const db = supabase();
    const vista = await analysis.loadTiendanubeView({ tenant: async () => CTX, supabase: async () => db.client,
      readConnection: async () => connection(), now: () => NOW });
    expect(vista.error).toBe(false);
    expect(vista.tarjeta).toEqual({ kind: 'activa', dominio: 'una-tienda-con-un-dominio-muy-l…', moneda: 'ARS',
      zona: 'America/Argentina/Buenos_Aires', aviso: null });
    const args = Object.fromEntries(db.calls.map((call) => [call.fn, call.args]));
    expect(args.get_tn_sales).toEqual({ p_connection_id: ID, p_from: '2025-12-01', p_to: '2026-11-13', p_grain: 'month' });
    expect(args.get_tn_product_units).toEqual({ p_connection_id: ID, p_from: '2026-10-17', p_to: '2026-11-13', p_limit: 10 });
    expect(args.get_tn_cohorts).toEqual({ p_connection_id: ID, p_from_month: '2025-12-01', p_to_month: '2026-11-01',
      p_max_offset: 6 });
    expect(vista.datos?.estado).toMatchObject({ fase: 'incremental', cubiertoHasta: '2026-11-12' });
    expect(vista.datos?.productos.filas).toEqual([{ puesto: 1, nombre: 'Remera', sku: null, eliminado: false, unidades: 7 }]);
    expect(vista.datos?.cohortes.filas).toEqual([
      { mes: '2026-09-01', tamano: null, oculta: true, celdas: [] },
      { mes: '2026-10-01', tamano: 6, oculta: false, celdas: [
        { desplazamiento: 0, retencion: 1, oculta: false, parcial: false },
        { desplazamiento: 1, retencion: null, oculta: true, parcial: true },
      ] },
    ]);
    expect(JSON.stringify(vista)).not.toContain('98765');
  });

  it('requiere autorización muestra el aviso fijo de la conexión', async () => {
    const vista = await analysis.loadTiendanubeView({ tenant: async () => CTX, supabase: async () => supabase().client,
      readConnection: async () => connection({ status: 'needs_reauth', last_error_class: 'authentication',
        last_error_message: 'Tiendanube rechazó la autorización. Volvé a conectar la tienda.' }), now: () => NOW });
    expect(vista.tarjeta).toMatchObject({ kind: 'requiere_reauth', aviso: 'Tiendanube rechazó la autorización. Volvé a conectar la tienda.' });
  });

  it('sin empresa, sin conexión, pendiente y error de lectura', async () => {
    const base = { supabase: async () => supabase().client, now: () => NOW };
    expect((await analysis.loadTiendanubeView({ ...base, tenant: async () => { throw new NoCompanyError(); } })).tarjeta)
      .toEqual({ kind: 'sin_empresa' });
    expect((await analysis.loadTiendanubeView({ ...base, tenant: async () => CTX, readConnection: async () => null })).tarjeta)
      .toEqual({ kind: 'sin_conexion' });
    expect((await analysis.loadTiendanubeView({ ...base, tenant: async () => CTX,
      readConnection: async () => connection({ status: 'pending_selection', external_account_id: null, currency: null,
        timezone: null, pending_expires_at: '2026-11-14T03:00:00.000Z' }) })).tarjeta).toEqual({ kind: 'pendiente' });
    expect((await analysis.loadTiendanubeView({ ...base, tenant: async () => CTX,
      readConnection: async () => { throw new Error('caída'); } })).tarjeta).toEqual({ kind: 'error' });
    const failing = await analysis.loadTiendanubeView({ tenant: async () => CTX, supabase: async () => supabase('get_tn_sales').client,
      readConnection: async () => connection(), now: () => NOW });
    expect([failing.tarjeta.kind, failing.datos, failing.error]).toEqual(['activa', null, true]);
  });
});
