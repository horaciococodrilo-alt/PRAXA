import { describe, expect, it, vi } from 'vitest';

import { projectToolArgs, TOOL_NAMES, ToolArgumentError } from '@/modules/chat/tools/schema';
import { toModelView } from '@/modules/chat/tools/results';
import {
  executeTiendanubeTool,
  isTiendanubeTool,
  TN_TOOL_NAMES,
  type StoreConnection,
} from '@/modules/chat/tools/tiendanube';
import { renderTurn } from '@/modules/chat/render';

vi.mock('server-only', () => ({}));

/**
 * M16e-T-11 y T-13 (unit): las cuatro herramientas de Tiendanube del chat. Las filas simulan
 * exactamente lo que devuelven las funciones `get_tn_*` de 0023; las cifras del resultado
 * tienen que ser las mismas, sin sumar monedas ni exponer claves.
 */

const PRODUCT_KEY = 'f1000000-0000-4000-8000-000000000001';
const VARIANT_KEY = 'f2000000-0000-4000-8000-000000000002';
const DELETED_KEY = 'f3000000-0000-4000-8000-000000000003';
const CONNECTION_ID = 'd0000000-0000-4000-8000-0000000000e5';
const DOMAIN = 'tienda-sintetica-de-prueba-larga.mitiendanube.com';
const FETCHED = '2026-03-01T03:00:04.123456+00:00';
const TZ = 'America/Argentina/Buenos_Aires';

const store: StoreConnection = { id: CONNECTION_ID, status: 'active', currency: 'ARS', timezone: TZ };

const statusRow = {
  phase: 'incremental', backfill_done: true, coverage_until: '2026-03-01T03:00:00+00:00',
  covered_through: '2026-02-28', timezone: TZ, currency: 'ARS', store_domain: DOMAIN,
  last_run_started_at: '2026-03-01T03:00:00+00:00', last_run_finished_at: '2026-03-01T03:00:05+00:00',
  last_run_status: 'complete', last_error_kind: null, last_fetched_at: FETCHED,
  catalog_complete_at: '2026-03-01T03:00:05+00:00',
};
const sale = (period_start: string, currency: string | null, paid: number, partial: number,
  covered: boolean, amount = 0, refunded = 0) => ({
  period_start, currency, paid_orders: paid, paid_orders_without_customer: 0,
  partially_paid_orders: partial, paid_amount: amount, refunded_amount: refunded, covered,
  fetched_at: FETCHED, timezone: TZ, definition: 'tn_sales_v1',
});
const dailySales = [
  sale('2026-02-27', 'ARS', 3, 1, true, 1500.5, 100),
  sale('2026-02-27', 'USD', 1, 0, true, 20),
  sale('2026-02-28', null, 0, 0, true),
  sale('2026-03-01', 'ARS', 2, 0, false, 300),
  sale('2026-03-02', null, 0, 0, false),
];
const products = [
  { rank: 1, product_key: PRODUCT_KEY, variant_key: VARIANT_KEY, name: 'Remera sintética', sku: 'REM-1',
    deleted: false, units: 7, covered: true, fetched_at: FETCHED, timezone: TZ, definition: 'tn_product_units_v1' },
  { rank: 2, product_key: DELETED_KEY, variant_key: null, name: 'Gorra sintética', sku: null,
    deleted: true, units: 2, covered: true, fetched_at: FETCHED, timezone: TZ, definition: 'tn_product_units_v1' },
];
const cell = (cohort_month: string, month_offset: number, cohort_size: number | null, active: number | null,
  retention: number | null, size_hidden: boolean, active_hidden: boolean, partial: boolean) => ({
  cohort_month, month_offset, cohort_size, active, retention, size_hidden, active_hidden, partial,
  fetched_at: FETCHED, timezone: TZ, definition: 'tn_cohorts_v1',
});
const cohorts = [
  cell('2025-12-01', 0, 8, 8, 1, false, false, false),
  cell('2025-12-01', 1, 8, null, null, false, true, false),
  cell('2025-12-01', 2, 8, 5, 0.625, false, false, true),
  cell('2026-01-01', 0, null, null, null, true, true, false),
  cell('2026-01-01', 1, null, null, null, true, true, false),
];

function fakeRpc(overrides: Record<string, unknown[]> = {}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const rows: Record<string, unknown[]> = { get_tn_sync_status: [statusRow], get_tn_sales: dailySales,
    get_tn_product_units: products, get_tn_cohorts: cohorts, ...overrides };
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    if (!(fn in rows)) throw new Error(`rpc inesperada ${fn}`);
    return rows[fn];
  });
  return { rpc, calls };
}

const defaults = { period: { from: '2026-02-22', to: '2026-02-28' }, accountEntityRef: null, month: '2026-03' };

function project(name: string, flat: Record<string, unknown>) {
  return projectToolArgs(name, flat, defaults);
}

describe('M16e-T-11: contrato de las cuatro herramientas', () => {
  it('suma exactamente cuatro herramientas cerradas al catálogo, sin tocar las trece de Meta', () => {
    expect([...TN_TOOL_NAMES]).toEqual(['tn_ventas', 'tn_cohortes', 'tn_productos', 'tn_cobertura']);
    expect(TOOL_NAMES).toHaveLength(17);
    expect(TOOL_NAMES.slice(13)).toEqual([...TN_TOOL_NAMES]);
    for (const name of TN_TOOL_NAMES) expect(isTiendanubeTool(name)).toBe(true);
    expect(isTiendanubeTool('total')).toBe(false);
  });

  it('valida los argumentos nuevos y exige nulos los que cada herramienta no usa', () => {
    expect(project('tn_ventas', { period: { from: '2026-02-01', to: '2026-02-28' }, granularity: 'day' }).args)
      .toEqual({ period: { from: '2026-02-01', to: '2026-02-28' }, granularity: 'day' });
    expect(() => project('tn_ventas', { period: defaults.period, granularity: 'week' })).toThrow(ToolArgumentError);
    expect(() => project('tn_ventas', { period: defaults.period, metric: 'spend' })).toThrow(ToolArgumentError);
    expect(() => project('tn_ventas', { period: defaults.period, max_offset: 3 })).toThrow(ToolArgumentError);
    expect(() => project('total', { metric: 'spend', period: defaults.period, granularity: 'day',
      entity_ref: PRODUCT_KEY })).toThrow(ToolArgumentError);
    expect(() => project('tn_cohortes', { from_month: '2026-13', to_month: '2026-12' })).toThrow(ToolArgumentError);
    expect(() => project('tn_cohortes', { from_month: '2026-01', to_month: '2026-03', max_offset: 12 }))
      .toThrow(ToolArgumentError);
    expect(() => project('tn_cohortes', { from_month: '2026-03', to_month: '2026-01' })).toThrow(ToolArgumentError);
    expect(() => project('tn_productos', { period: defaults.period, limit: 21 })).toThrow(ToolArgumentError);
    expect(() => project('tn_cobertura', { period: defaults.period })).toThrow(ToolArgumentError);
    // Las claves nulas que la herramienta no usa se aceptan, como en Meta.
    expect(project('tn_cobertura', { period: null, granularity: null, from_month: null }).args).toEqual({});
  });

  it('rechaza períodos de más de 93 días salvo en tn_cohortes, que admite hasta 24 cohortes', () => {
    const long = { from: '2026-01-01', to: '2026-04-04' };
    expect(() => project('tn_ventas', { period: long })).toThrow(ToolArgumentError);
    expect(() => project('tn_productos', { period: long })).toThrow(ToolArgumentError);
    expect(project('tn_cohortes', { from_month: '2024-04', to_month: '2026-03', max_offset: 11 }).args)
      .toEqual({ from_month: '2024-04', to_month: '2026-03', max_offset: 11 });
    expect(() => project('tn_cohortes', { from_month: '2024-03', to_month: '2026-03' })).toThrow(ToolArgumentError);
  });

  it('aplica los defaults del servidor: período, granularidad, meses, desplazamiento y límite', () => {
    const ventas = project('tn_ventas', {});
    expect(ventas.periodDefaulted).toBe(true);
    expect(ventas.args).toEqual({ period: defaults.period, granularity: 'day' });
    expect(project('tn_ventas', { period: { from: '2026-01-01', to: '2026-03-01' } }).args.granularity).toBe('month');
    expect(project('tn_cohortes', {}).args).toEqual({ from_month: '2025-04', to_month: '2026-03', max_offset: 6 });
    expect(project('tn_productos', { period: defaults.period }).args).toEqual({ period: defaults.period, limit: 10 });
  });
});

describe('M16e-T-11/T-13: resultados iguales a SQL, sin IDs y con la regla de cinco', () => {
  it('tn_ventas por día: cifras de SQL, una fila por moneda, cero real distinto de no cubierto', async () => {
    const { rpc, calls } = fakeRpc();
    const call = project('tn_ventas', { period: { from: '2026-02-27', to: '2026-03-02' }, granularity: 'day' });
    const result = await executeTiendanubeTool(call, store, 't1', { rpc });
    expect(calls.map((c) => c.fn)).toEqual(['get_tn_sync_status', 'get_tn_sales']);
    expect(calls[1].args).toEqual({ p_connection_id: CONNECTION_ID, p_from: '2026-02-27', p_to: '2026-03-02',
      p_grain: 'day' });
    const rows = result.values.map((v) => [v.day, v.currency, v.metric, v.value, v.absence, v.captured_partial]);
    expect(rows).toEqual([
      ['2026-02-27', 'ARS', 'tn_paid_orders', '3', null, false],
      ['2026-02-27', 'ARS', 'tn_partially_paid_orders', '1', null, false],
      ['2026-02-27', 'USD', 'tn_paid_orders', '1', null, false],
      ['2026-02-27', 'USD', 'tn_partially_paid_orders', '0', null, false],
      ['2026-02-28', null, 'tn_paid_orders', '0', null, false],
      ['2026-02-28', null, 'tn_partially_paid_orders', '0', null, false],
      ['2026-03-01', 'ARS', 'tn_paid_orders', '2', null, true],
      ['2026-03-01', 'ARS', 'tn_partially_paid_orders', '0', null, true],
      ['2026-03-02', null, 'tn_paid_orders', null, 'no_observado', false],
      ['2026-03-02', null, 'tn_partially_paid_orders', null, 'no_observado', false],
    ]);
    // Nunca se suman monedas: no hay ninguna fila del 27 sin moneda.
    expect(result.values.filter((v) => v.day === '2026-02-27' && v.currency === null)).toEqual([]);
    expect(result.values.every((v) => v.fetched_at === FETCHED)).toBe(true);
    expect(result.scope).toMatchObject({ timezone: TZ, currency: 'ARS', level: null,
      period: { from: '2026-02-27', to: '2026-03-02' } });
    expect(result.extra).toMatchObject({ source: 'tiendanube', covered_through: '2026-02-28', granularity: 'day' });
    // Sin la constante activa no hay monto cobrado.
    expect(result.values.some((v) => v.metric === 'tn_collected_amount')).toBe(false);
  });

  it('tn_ventas por mes usa el total del período recortado al pedido', async () => {
    const { rpc, calls } = fakeRpc({ get_tn_sales: [sale('2026-01-01', 'ARS', 10, 2, true),
      sale('2026-02-01', 'ARS', 4, 0, true), sale('2026-03-01', null, 0, 0, false)] });
    const call = project('tn_ventas', { period: { from: '2026-01-15', to: '2026-03-10' }, granularity: 'month' });
    const result = await executeTiendanubeTool(call, store, 't2', { rpc });
    expect(calls[1].args).toMatchObject({ p_grain: 'month' });
    expect(result.values.filter((v) => v.metric === 'tn_paid_orders')
      .map((v) => [v.path_key, v.period, v.value, v.absence])).toEqual([
      ['total', { from: '2026-01-15', to: '2026-01-31' }, '10', null],
      ['total', { from: '2026-02-01', to: '2026-02-28' }, '4', null],
      ['total', { from: '2026-03-01', to: '2026-03-10' }, null, 'no_observado'],
    ]);
  });

  it('el monto cobrado aparece solo con la constante activa y nunca suma monedas', async () => {
    const { rpc } = fakeRpc({ get_tn_sales: dailySales.filter((row) => row.period_start === '2026-02-27') });
    const call = project('tn_ventas', { period: { from: '2026-02-27', to: '2026-02-27' }, granularity: 'day' });
    const result = await executeTiendanubeTool(call, store, 't1', { rpc, collectedAmountEnabled: true });
    expect(result.values.filter((v) => v.metric === 'tn_collected_amount')
      .map((v) => [v.currency, v.unit, v.value])).toEqual([['ARS', 'money', '1400.5'], ['USD', 'money', '20']]);
  });

  it('tn_productos: ranking por unidades, eliminado rotulado, sin claves internas', async () => {
    const { rpc, calls } = fakeRpc();
    const call = project('tn_productos', { period: defaults.period, limit: 5 });
    const result = await executeTiendanubeTool(call, store, 't3', { rpc });
    expect(calls[1]).toEqual({ fn: 'get_tn_product_units', args: { p_connection_id: CONNECTION_ID,
      p_from: '2026-02-22', p_to: '2026-02-28', p_limit: 5 } });
    expect(result.values.map((v) => [v.path_key, v.metric, v.entity_name, v.segment_primary,
      v.segment_secondary, v.value, v.entity_ref])).toEqual([
      ['product', 'tn_units', 'Remera sintética', 'REM-1', null, '7', null],
      ['product', 'tn_units', 'Gorra sintética', null, 'producto eliminado', '2', null],
    ]);
    const serialized = JSON.stringify([result, toModelView(result)]);
    for (const key of [PRODUCT_KEY, VARIANT_KEY, DELETED_KEY, CONNECTION_ID]) {
      expect(serialized).not.toContain(key);
    }
  });

  it('tn_cohortes: tamaños y retención de SQL; menos de cinco oculto por cohorte y por celda', async () => {
    const { rpc, calls } = fakeRpc();
    const call = project('tn_cohortes', { from_month: '2025-12', to_month: '2026-01', max_offset: 2 });
    const result = await executeTiendanubeTool(call, store, 't4', { rpc });
    expect(calls[1]).toEqual({ fn: 'get_tn_cohorts', args: { p_connection_id: CONNECTION_ID,
      p_from_month: '2025-12-01', p_to_month: '2026-01-01', p_max_offset: 2 } });
    expect(result.values.map((v) => [v.cohort_month, v.month_offset, v.metric, v.value, v.absence,
      v.captured_partial])).toEqual([
      ['2025-12', null, 'tn_cohort_size', '8', null, false],
      ['2025-12', 0, 'tn_cohort_active', '8', null, false],
      ['2025-12', 0, 'tn_cohort_retention', '100', null, false],
      ['2025-12', 1, 'tn_cohort_active', null, 'menos_de_5', false],
      ['2025-12', 1, 'tn_cohort_retention', null, 'menos_de_5', false],
      ['2025-12', 2, 'tn_cohort_active', '5', null, true],
      ['2025-12', 2, 'tn_cohort_retention', '62.5', null, true],
      // La cohorte de menos de cinco no lleva celdas.
      ['2026-01', null, 'tn_cohort_size', null, 'menos_de_5', false],
    ]);
    expect(result.values.every((v) => v.path_key === 'cohort_cell')).toBe(true);
    expect(result.scope.period).toBeNull();
    // Ningún conteo menor que cinco, ni en el resultado ni en la vista del modelo.
    const counts = result.values.filter((v) => v.unit === 'count' && v.value !== null).map((v) => Number(v.value));
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(5);
  });

  it('tn_cobertura: última sincronización, cobertura y estado del histórico, sin el dominio para el modelo', async () => {
    const { rpc, calls } = fakeRpc();
    const result = await executeTiendanubeTool(project('tn_cobertura', {}), store, 't5', { rpc });
    expect(calls.map((c) => c.fn)).toEqual(['get_tn_sync_status']);
    expect(result.values).toEqual([]);
    expect(result.extra).toMatchObject({ source: 'tiendanube', backfill_done: true, covered_through: '2026-02-28',
      last_finished_at: '2026-03-01T03:00:05+00:00', last_run_status: 'complete', phase: 'incremental' });
    expect(result.extra.store_domain).toBe(DOMAIN);
    expect(JSON.stringify(toModelView(result))).not.toContain(DOMAIN);
  });

  it('sin estado de sincronización no inventa ceros', async () => {
    const { rpc } = fakeRpc({ get_tn_sync_status: [], get_tn_sales: [] });
    const result = await executeTiendanubeTool(project('tn_ventas', {}), store, 't1', { rpc });
    expect(result.values).toEqual([]);
    expect(result.extra).toMatchObject({ covered_through: null, backfill_done: false });
  });

  it('una conexión que no está activa o una lectura fallida no devuelven datos', async () => {
    const { rpc } = fakeRpc();
    await expect(executeTiendanubeTool(project('tn_cobertura', {}), { ...store, status: 'pending_selection' },
      't1', { rpc })).rejects.toThrow();
    const failing = vi.fn(async () => { throw new Error('fallo'); });
    await expect(executeTiendanubeTool(project('tn_cobertura', {}), store, 't1', { rpc: failing })).rejects.toThrow();
    const malformed = vi.fn(async () => ({ not: 'rows' }));
    await expect(executeTiendanubeTool(project('tn_cobertura', {}), store, 't1', { rpc: malformed })).rejects.toThrow();
  });
});

describe('M16e-T-11/C-13: presentación con bloques del catálogo', () => {
  it('ranking, tabla de cohortes, estado de datos y metodología, con «menos de 5» y sin IDs', async () => {
    const { rpc } = fakeRpc();
    const productos = await executeTiendanubeTool(project('tn_productos', { period: defaults.period }), store, 't1', { rpc });
    const cohortes = await executeTiendanubeTool(project('tn_cohortes', { from_month: '2025-12', to_month: '2026-01',
      max_offset: 2 }), store, 't2', { rpc });
    const cobertura = await executeTiendanubeTool(project('tn_cobertura', {}), store, 't3', { rpc });
    const view = renderTurn({ kind: 'answer', results: [productos, cohortes, cobertura], recordId: null,
      accountRef: null, answer: { text: 'Lectura sintética.', blocks: [
        { type: 'ranking', sources: [{ tool_call_id: 't1', path_prefix: '/values' }] },
        { type: 'tabla', sources: [{ tool_call_id: 't2', path_prefix: '/values' }] },
        { type: 'estado_datos', sources: [{ tool_call_id: 't3', path_prefix: '/values' }] },
        { type: 'fuentes_metodologia', sources: [{ tool_call_id: 't1', path_prefix: '/values' },
          { tool_call_id: 't2', path_prefix: '/values' }] },
      ] } });
    const [ranking, tabla, estado, metodo] = view.blocks;
    expect(ranking.table.rows).toEqual([['Remera sintética (REM-1)', '7'], ['Gorra sintética (producto eliminado)', '2']]);
    expect(tabla.table.rows).toContainEqual(['Cohorte 12/2025 · mes 1 · Clientes activos', 'menos de 5']);
    expect(tabla.table.rows).toContainEqual(['Cohorte 01/2026 · Clientes de la cohorte', 'menos de 5']);
    expect(tabla.table.rows).toContainEqual(['Cohorte 12/2025 · mes 2 · Retención', '62.5 % (parcial)']);
    expect(estado.table.rows).toContainEqual(['Fuente', 'Tiendanube']);
    expect(estado.table.rows).toContainEqual(['Cubierto hasta', '28/02/2026']);
    expect(metodo.table.rows.some(([kind, text]) => kind === 'Cálculo' && /Unidades/u.test(text))).toBe(true);
    expect(metodo.table.rows.some(([kind, text]) => kind === 'Cálculo' && /Retención/u.test(text))).toBe(true);
    expect(view.footer?.account).toBeNull();
    expect(view.footer?.store).toBe('tienda-sintetica-de-prueba-larg…');
    expect(view.footer?.timezone).toBe(TZ);
    const serialized = JSON.stringify(view);
    for (const key of [PRODUCT_KEY, VARIANT_KEY, DELETED_KEY, CONNECTION_ID]) expect(serialized).not.toContain(key);
    expect(serialized).not.toMatch(/ingreso neto/iu);
  });

  it('lineas de ventas muestra solo pedidos pagados y marca lo parcial', async () => {
    const { rpc } = fakeRpc({ get_tn_sales: [sale('2026-02-28', 'ARS', 3, 1, true), sale('2026-03-01', 'ARS', 2, 0, false)] });
    const ventas = await executeTiendanubeTool(project('tn_ventas', { period: { from: '2026-02-28', to: '2026-03-01' } }),
      store, 't1', { rpc });
    const view = renderTurn({ kind: 'answer', results: [ventas], recordId: null, accountRef: null,
      answer: { text: '', blocks: [{ type: 'lineas', sources: [{ tool_call_id: 't1', path_prefix: '/values' }] },
        { type: 'tabla', sources: [{ tool_call_id: 't1', path_prefix: '/values' }] }] } });
    expect(view.blocks[0].table.rows).toEqual([['28/02/2026 · ARS', '3'], ['01/03/2026 · ARS', '2 (parcial)']]);
    expect(view.blocks[1].table.rows).toHaveLength(4);
    expect(view.footer?.data_limits.some((text) => /parcial/u.test(text))).toBe(true);
  });
});
