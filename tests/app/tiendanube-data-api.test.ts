import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { TenantContext } from '@/modules/tenant/context';
import { resolveSqlTestTarget } from '../../scripts/lib/sql-target.mjs';
import { verifiedTestDbConfig } from '../../scripts/lib/test-db-client.mjs';
import {
  anonClient,
  blockedReason,
  cleanupRun,
  createConfirmedUser,
  pendingCleanupCount,
  RUN_ID,
  type TestUser,
} from './helpers';

vi.mock('server-only', () => ({}));

/**
 * M16e-T-01 y T-07 por HTTP (etapa .1): lo que pgTAP prueba en SQL, visto desde la Data API
 * que usa el navegador. Una empresa con Meta y Tiendanube vivas a la vez; otra empresa con
 * la misma tienda; anon. Todo sintético: tienda, pedidos y clientes con IDs inventados.
 *
 * La siembra usa una conexión SQL directa al proyecto desechable, como `postgres`, dueño de
 * las funciones de worker_api, igual que `integrations-data-api.test.ts`. Ninguna aserción
 * la usa. La limpieza es `cleanupRun()`: la cascada desde `companies` arrastra todo.
 */

const STATEMENT_TIMEOUT_MS = 15_000;
const TZ = 'America/Argentina/Buenos_Aires';
const STORE = String(700_000_000 + Math.floor(Math.random() * 99_000_000));

type Company = { user: TestUser; companyId: string; ctx: TenantContext };

function order(id: string, customer: string | null, at: string, payment = 'paid') {
  return {
    id, customer_id: customer, status: 'closed', payment_status: payment,
    created_at: at, updated_at: at, paid_at: payment === 'paid' ? at : null,
    closed_at: null, cancelled_at: null, currency: 'ARS', subtotal: '100', discount: '0',
    total: '100', total_paid_by_customer: '100', storefront: 'store', cancel_reason: null,
    is_subscription: false, is_subscription_initial: false, refunded_amount: null,
  };
}

describe('M16e etapa .1: Tiendanube por la Data API (proyecto desechable)', () => {
  let sql: pg.Client | undefined;
  let connections: typeof import('@/modules/integrations/repository/connections');
  let owner: Company;
  let other: Company;
  const metaId = randomUUID();
  const storeId = randomUUID();
  const otherStoreId = randomUUID();

  async function company(prefix: string): Promise<Company> {
    const user = await createConfirmedUser(prefix);
    const { data, error } = await user.client
      .rpc('create_company_for_current_user', { p_name: `Tienda ${prefix} ${RUN_ID}` })
      .single<{ id: string }>();
    expect(error).toBeNull();
    return { user, companyId: data!.id,
      ctx: { user_id: user.id, company_id: data!.id, role: 'owner', request_id: randomUUID() } };
  }

  async function connectStore(c: Company, connectionId: string) {
    await sql!.query(`select 1 from worker_api.create_pending_connection($1, $2, $3, 'tiendanube', null,
      'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'store_app_token', '12345',
      '{read_orders,read_customers,read_products}', null)`, [c.user.id, c.companyId, connectionId]);
    await sql!.query(`select 1 from worker_api.confirm_connection($1, $2, $3, $4, 'ARS', $5, true)`,
      [c.user.id, c.companyId, connectionId, STORE, TZ]);
  }

  // Sin destino desechable válido, la suite falla antes de crear fixtures (CB-06).
  beforeAll(async () => {
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);
    const target = resolveSqlTestTarget(process.env);
    if (!target.ok) throw new Error(`Destino SQL de pruebas inválido: ${target.problems.join(' ')}`);
    connections = await import('@/modules/integrations/repository/connections');

    sql = new pg.Client(verifiedTestDbConfig(target.connectionString, 'praxa-tiendanube-data-api'));
    await sql.connect();
    await sql.query(`set statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    await sql.query(`set lock_timeout = ${STATEMENT_TIMEOUT_MS}`);

    owner = await company('tienda-duena');
    other = await company('tienda-otra');

    await sql.query(`select 1 from worker_api.create_pending_connection($1, $2, $3, 'meta',
      'negocio_sintetico', 'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user',
      'app_sintetica', '{ads_read}', null)`, [owner.user.id, owner.companyId, metaId]);
    await sql.query(`select 1 from worker_api.confirm_connection($1, $2, $3, $4, 'USD', 'UTC', true)`,
      [owner.user.id, owner.companyId, metaId, `act_${Date.now()}`]);
    await connectStore(owner, storeId);
    await connectStore(other, otherStoreId);

    const run = randomUUID();
    const lease = randomUUID();
    await sql.query(`select 1 from worker_api.tn_start_sync($1, $2, $3, 0, $4, $5, clock_timestamp() + interval '4 minutes')`,
      [owner.user.id, owner.companyId, storeId, run, lease]);
    await sql.query(`select 1 from worker_api.tn_publish_orders($1, $2, $3, 0, $4, $5, $6, $7, '[]')`, [
      owner.user.id, owner.companyId, storeId, run, lease,
      JSON.stringify({ kind: 'backfill', window_from: '2026-01-01', window_to: '2026-01-31', last_page: false }),
      JSON.stringify([order('1001', '501', '2026-01-10T15:00:00Z'), order('1002', null, '2026-01-10T16:00:00Z'),
        order('1003', '502', '2026-01-11T15:00:00Z', 'pending')]),
    ]);
  });

  afterAll(async () => {
    await sql?.end();
    await cleanupRun();
    expect(pendingCleanupCount()).toBe(0);
  });

  it('T-01: Meta y Tiendanube vivas a la vez; cada lectura por proveedor devuelve la suya', async () => {
    const supabase = owner.user.client;
    const meta = await connections.readLiveConnection(owner.ctx, 'meta', { supabase });
    const store = await connections.readLiveConnection(owner.ctx, 'tiendanube', { supabase });
    expect(meta?.id).toBe(metaId);
    expect(store?.id).toBe(storeId);
    expect((await connections.readConnectionRecord(owner.ctx, { supabase }))?.id).toBe(metaId);
    expect((await connections.readConnectionRecord(owner.ctx, { supabase }, 'tiendanube'))?.provider)
      .toBe('tiendanube');
  });

  it('T-07: la dueña lee sus ventas agregadas; el pendiente no cuenta', async () => {
    const { data, error } = await owner.user.client.rpc('get_tn_sales', {
      p_connection_id: storeId, p_from: '2026-01-10', p_to: '2026-01-11', p_grain: 'day',
    });
    expect(error).toBeNull();
    expect((data as Array<Record<string, unknown>>).map((row) => [row.period_start, row.paid_orders,
      row.paid_orders_without_customer, row.covered])).toEqual([
      ['2026-01-10', 2, 1, false],
      ['2026-01-11', 0, 0, false],
    ]);
  });

  it('T-07: otra empresa con la misma tienda no lee los agregados de la primera', async () => {
    const { data, error } = await other.user.client.rpc('get_tn_sales', {
      p_connection_id: storeId, p_from: '2026-01-01', p_to: '2026-01-31', p_grain: 'month',
    });
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const direct = await other.user.client.from('tn_sales_daily').select('day');
    expect(direct.error).toBeNull();
    expect(direct.data).toEqual([]);
  });

  it('T-07: anon no ejecuta las lecturas', async () => {
    const { data, error } = await anonClient().rpc('get_tn_sales', {
      p_connection_id: storeId, p_from: '2026-01-01', p_to: '2026-01-31', p_grain: 'day',
    });
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it('T-07: los agregados no se escriben y las tablas privadas no se leen por HTTP', async () => {
    const insert = await owner.user.client.from('tn_sales_daily').insert({
      company_id: owner.companyId, connection_id: storeId, day: '2026-02-01', currency: 'ARS',
      paid_orders: 1, paid_orders_without_customer: 0, partially_paid_orders: 0, paid_amount: 1,
      refunded_amount: 0,
    });
    expect(insert.error).not.toBeNull();
    const orders = await owner.user.client.schema('private').from('tn_orders').select('external_order_id');
    expect(orders.error).not.toBeNull();
    expect(orders.data).toBeNull();
  });

  it('T-07: ninguna fila pública expone el ID de la tienda, del pedido o del cliente', async () => {
    const tables = ['tn_sync_status', 'tn_sales_daily', 'tn_product_units_daily', 'tn_cohort_cells'];
    for (const table of tables) {
      const { data, error } = await owner.user.client.from(table).select('*');
      expect(error).toBeNull();
      const text = JSON.stringify(data);
      for (const secret of [STORE, '1001', '1002', '501']) expect(text).not.toContain(`"${secret}"`);
    }
  });
});
