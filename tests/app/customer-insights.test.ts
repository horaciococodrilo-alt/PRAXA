import { randomBytes, randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { TenantContext } from '@/modules/tenant/context';
import { resolveIntegrationsTestTarget, resolveSqlTestTarget } from '../../scripts/lib/sql-target.mjs';
import { verifiedTestDbConfig } from '../../scripts/lib/test-db-client.mjs';
import {
  blockedReason,
  cleanupRun,
  createConfirmedUser,
  pendingCleanupCount,
  remoteProjectReachable,
  RUN_ID,
  type TestUser,
} from './helpers';

/**
 * M27a contra el proyecto desechable (pasos 5 y 7): loader y Data API bajo JWT (T-01, T-03,
 * T-15), invalidación en vivo (T-13, T-14), frontera de credenciales (T-16) y tamaño (T-17).
 *
 * El volumen de T-17 (10.000 pedidos, 2.000 compradores, 24 meses) se siembra con la conexión
 * administrativa directamente en las tablas privadas, en una sola transacción: es un fixture de
 * tamaño, sin estadísticas (peor caso). Lo que se mide pasa por los caminos reales: el cierre
 * por `worker_api` con el rol acotado y su límite de 15 s, y la lectura con el JWT del dueño.
 * Todo es sintético. Sin destino desechable válido, el primer `beforeAll` lanza (CB-06).
 */

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const TZ = 'America/Argentina/Buenos_Aires';
const A = 'tn_paid_current_observed_v1' as const;
const storeId = () => String(700_000_000 + Math.floor(Math.random() * 99_000_000));

type Company = { user: TestUser; ctx: TenantContext };

describe('M27a: clientes contra la base real', { timeout: 300_000 }, () => {
  let sql: pg.Client | undefined;
  let workerApi: ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi> | undefined;
  let load: typeof import('@/modules/customer-insights/load');
  let repository: typeof import('@/modules/integrations/tiendanube/repository');
  let connections: typeof import('@/modules/integrations/repository/connections');
  let credentials: typeof import('@/modules/integrations/repository/credentials');
  let lifecycleCalls: typeof import('@/modules/integrations/repository/lifecycle-calls');
  let keyringModule: typeof import('@/modules/integrations/crypto/keyring');

  beforeAll(async () => {
    const roleTarget = resolveIntegrationsTestTarget(process.env);
    if (!roleTarget.ok) throw new Error(roleTarget.problems?.join(' ') ?? 'Destino del rol no verificado.');
    const sqlTarget = resolveSqlTestTarget(process.env);
    if (!sqlTarget.ok) throw new Error(`Destino SQL de pruebas inválido: ${sqlTarget.problems.join(' ')}`);
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);
    if (!(await remoteProjectReachable())) throw new Error('El proyecto de pruebas no responde.');
    let workerApiModule: typeof import('@/modules/integrations/db/worker-api');
    [load, repository, connections, credentials, lifecycleCalls, keyringModule, workerApiModule] = await Promise.all([
      import('@/modules/customer-insights/load'),
      import('@/modules/integrations/tiendanube/repository'),
      import('@/modules/integrations/repository/connections'),
      import('@/modules/integrations/repository/credentials'),
      import('@/modules/integrations/repository/lifecycle-calls'),
      import('@/modules/integrations/crypto/keyring'),
      import('@/modules/integrations/db/worker-api'),
    ]);
    workerApi = workerApiModule.createWorkerApi({ connectionString: roleTarget.connectionString });
    sql = new pg.Client(verifiedTestDbConfig(sqlTarget.connectionString, 'praxa-customer-insights'));
    await sql.connect();
    await sql.query('set statement_timeout = 120000');
  });

  afterAll(async () => {
    try {
      await workerApi?.end();
      await sql?.end();
    } finally {
      await cleanupRun();
      expect(pendingCleanupCount()).toBe(0);
    }
  });

  async function company(prefix: string): Promise<Company> {
    const user = await createConfirmedUser(prefix);
    const { data, error } = await user.client
      .rpc('create_company_for_current_user', { p_name: `Empresa sintética ${RUN_ID} ${prefix}` })
      .single<{ id: string }>();
    if (error || !data) throw new Error('No se pudo crear la empresa sintética.');
    return { user, ctx: { user_id: user.id, company_id: data.id, role: 'owner', request_id: randomUUID() } };
  }

  async function connectStore(owner: Company, store: string): Promise<string> {
    const created = await credentials.createPendingConnectionWithCredential(owner.ctx, {
      provider: 'tiendanube', token: `tok-${randomBytes(6).toString('hex')}`, tokenType: 'store_app_token',
      issuedForAppId: '4321', grantedScopes: ['read_customers', 'read_orders', 'read_products'], expiresAt: null,
      clientBusinessId: null }, { workerApi: workerApi!, keyring: keyringModule.getCredentialKeyring() });
    await lifecycleCalls.confirmConnection(owner.ctx, { connectionId: created.connectionId, externalAccountId: store,
      currency: 'ARS', timezone: TZ }, { workerApi: workerApi! });
    return created.connectionId;
  }

  /**
   * Fixture de tamaño: `orders` pedidos, `customers` compradores, primeras compras repartidas en
   * 24 meses, 2 líneas por pedido y catálogo de 40 productos completo. Monetary verificado con A,
   * como quedaría tras un T-04 concluyente.
   */
  async function seed(owner: Company, connectionId: string, orders: number, customers: number, currency = 'ARS') {
    const { rows: [{ c }] } = await sql!.query<{ c: string }>(
      `select ((clock_timestamp() at time zone $1)::date - 1)::text as c`, [TZ]);
    await sql!.query('begin');
    try {
      await sql!.query(`insert into private.tn_customers (company_id, connection_id, external_customer_id)
        select $1, $2, (1000 + g)::text from generate_series(0, $3 - 1) g on conflict do nothing`,
      [owner.ctx.company_id, connectionId, customers]);
      await sql!.query(`insert into private.tn_orders (company_id, connection_id, external_order_id, external_customer_id,
          status, payment_status, created_at, source_updated_at, paid_at, currency, total, total_paid_by_customer,
          local_day, eligible, partially_paid, insights_amount, insights_amount_status, insights_amount_definition,
          insights_identity_status, insights_lines_status)
        select $1, $2, ($6 + i)::text, (1000 + i % $4)::text, 'closed', 'paid', now(), now(), now(), $5, 10,
               ((i % 97) + 1) + 0.25,
               least($3::date, greatest($3::date - ((i % $4) * 7 % 720) + (i / $4) * 35, $3::date - 719)),
               true, false, ((i % 97) + 1) + 0.25, 'verified', $7, 'verified', 'complete'
          from generate_series(0, $8 - 1) i`,
      [owner.ctx.company_id, connectionId, c, customers, currency, currency === 'ARS' ? 100_000 : 900_000, A, orders]);
      await sql!.query(`insert into private.tn_products (company_id, connection_id, external_product_id, name, visibility,
          deleted, last_seen_at)
        select $1, $2, (500 + g)::text, 'Producto sintético ' || g, 'visible', false, now() from generate_series(0, 39) g
        on conflict do nothing`, [owner.ctx.company_id, connectionId]);
      await sql!.query(`insert into private.tn_order_lines (company_id, connection_id, external_order_id, line_no,
          external_product_id, external_variant_id, name, price, quantity)
        select $1, $2, ($3 + i)::text, l, (500 + (i + l) % 40)::text, null, 'Producto sintético', 10, 1
          from generate_series(0, $4 - 1) i, generate_series(1, 2) l`,
      [owner.ctx.company_id, connectionId, currency === 'ARS' ? 100_000 : 900_000, orders]);
      await sql!.query(`insert into public.tn_sync_status (connection_id, company_id, phase, watermark, backfill_done_at,
          incremental_checkpoint, insights_catalog_status, last_run_status)
        values ($2, $1, 'incremental', now(), now(), now(), 'complete', 'complete')
        on conflict (connection_id) do nothing`, [owner.ctx.company_id, connectionId]);
      await sql!.query('commit');
    } catch (error) {
      await sql!.query('rollback');
      throw error;
    }
  }

  async function own(connectionId: string) {
    const { rows: [{ g }] } = await sql!.query<{ g: number }>(
      'select credential_generation as g from public.integration_connections where id = $1', [connectionId]);
    return { connectionId, expectedGeneration: g, runId: randomUUID(), leaseToken: randomUUID() };
  }

  /** Abre un paso por el camino real; `fetchedAt` es el inicio que fijó la base. */
  async function start(owner: Company, connectionId: string) {
    const o = await own(connectionId);
    const run = await repository.startSync(owner.ctx, { ...o, leaseExpiresAt: new Date(Date.now() + 120_000) },
      { workerApi: workerApi! });
    return { o, fetchedAt: run.startedAt };
  }

  /** Un paso incremental vacío y completo: publica el snapshot. Devuelve la duración del cierre. */
  async function incremental(owner: Company, connectionId: string): Promise<number> {
    const { o, fetchedAt } = await start(owner, connectionId);
    const started = Date.now();
    await repository.finishSync(owner.ctx, { ...o, fetchedAt, complete: true }, { workerApi: workerApi! });
    return Date.now() - started;
  }

  function loaderDeps(owner: Company, over: Record<string, unknown> = {}) {
    return {
      tenant: async () => owner.ctx,
      supabase: async () => owner.user.client,
      readConnection: (ctx: TenantContext, supabase: typeof owner.user.client) =>
        connections.readConnectionRecord(ctx, { supabase }, 'tiendanube'),
      ...over,
    };
  }

  it('M27a-T-17: 10.000 pedidos, 2.000 compradores, 24 meses, multiempresa: refresh y lectura bajo presupuesto', async () => {
    const owner = await company('m27a-tamano');
    const other = await company('m27a-otra');
    const connectionId = await connectStore(owner, storeId());
    const otherConnection = await connectStore(other, storeId());
    await seed(owner, connectionId, 10_000, 2_000);
    await seed(other, otherConnection, 300, 60);

    const refreshMs = await incremental(owner, connectionId);
    const readStarted = Date.now();
    const view = await load.loadCustomerInsightsView('ARS', loaderDeps(owner, { monetaryDefinition: A }));
    const readMs = Date.now() - readStarted;
    console.info(JSON.stringify({ evento: 'm27a_t17', refresh_ms: refreshMs, lectura_ms: readMs }));

    expect(refreshMs).toBeLessThan(15_000);
    expect(readMs).toBeLessThan(15_000);
    expect(['listo', 'privacidad']).toContain(view.kind);
    if (!('data' in view)) throw new Error('sin datos');
    const { rows: [{ n, classified }] } = await sql!.query<{ n: string; classified: string }>(
      `select (select count(distinct external_customer_id) from private.tn_orders
                where connection_id = $1 and local_day between $2::date - 364 and $2::date)::text as n,
              (select count(*) from private.tn_insights_customer_segments($1, 'ARS', $2::date))::text as classified`,
      [connectionId, view.data.asOfDay]);
    // Conteo exacto, sin truncar: cada comprador de la ventana queda clasificado una vez.
    expect(classified).toBe(n);
    if (view.data.segments.status === 'available') {
      expect(view.data.segments.totalCustomers.value).toBe(n);
      expect(view.data.productEvidence.crossSell.status).toBe('available');
    }
    expect(view.data.cohorts.status === 'available' ? view.data.cohorts.rows.length : 0).toBe(24);
    expect(view.proposals.length).toBeGreaterThan(0);

    // Aislamiento: la otra empresa no ve ni por la tabla ni por el getter; su loader solo ve lo suyo.
    const foreignRows = await other.user.client.from('tn_customer_insights').select('currency')
      .eq('connection_id', connectionId);
    expect(foreignRows.error).toBeNull();
    expect(foreignRows.data).toEqual([]);
    const foreignGetter = await other.user.client.rpc('get_tn_customer_insights',
      { p_connection_id: connectionId, p_currency: 'ARS' });
    expect(foreignGetter.data).toEqual([]);
    await incremental(other, otherConnection);
    const otherView = await load.loadCustomerInsightsView(null, loaderDeps(other, { monetaryDefinition: A }));
    const { rows: [{ payload }] } = await sql!.query<{ payload: unknown }>(
      `select payload from public.tn_customer_insights where connection_id = $1 and currency = 'ARS'`, [otherConnection]);
    expect('data' in otherView ? otherView.data : null).toEqual(payload);
  });

  it('M27a-T-03/T-15: moneda por ?currency=, error genérico y Monetary sin acreditar', async () => {
    const owner = await company('m27a-moneda');
    const connectionId = await connectStore(owner, storeId());
    await seed(owner, connectionId, 400, 80);
    await seed(owner, connectionId, 200, 40, 'USD');
    await incremental(owner, connectionId);

    const first = await load.loadCustomerInsightsView(undefined, loaderDeps(owner, { monetaryDefinition: A }));
    expect(first).toMatchObject({ availableCurrencies: ['ARS', 'USD'], selectedCurrency: 'ARS' });
    const usd = await load.loadCustomerInsightsView('USD', loaderDeps(owner, { monetaryDefinition: A }));
    expect('data' in usd ? usd.data.currency : null).toBe('USD');
    expect(await load.loadCustomerInsightsView('EUR', loaderDeps(owner, { monetaryDefinition: A })))
      .toEqual({ kind: 'error', availableCurrencies: ['ARS', 'USD'], selectedCurrency: null });
    expect((await load.loadCustomerInsightsView(['ARS', 'USD'], loaderDeps(owner))).kind).toBe('error');
    // Con la constante real (nula), un payload verificado no se publica como RFM: error genérico.
    expect((await load.loadCustomerInsightsView('ARS', loaderDeps(owner))).kind).toBe('error');
  });

  it('M27a-T-13/T-14: iniciar una sincronización y marcar una supresión invalidan en vivo', async () => {
    const owner = await company('m27a-invalida');
    const store = storeId();
    const connectionId = await connectStore(owner, store);
    await seed(owner, connectionId, 300, 60);
    await incremental(owner, connectionId);
    expect((await load.loadCustomerInsightsView(null, loaderDeps(owner, { monetaryDefinition: A }))).kind).not.toBe('error');

    const { o, fetchedAt } = await start(owner, connectionId);
    expect((await load.loadCustomerInsightsView(null, loaderDeps(owner, { monetaryDefinition: A }))).kind).toBe('actualizando');
    const during = await owner.user.client.from('tn_customer_insights').select('currency').eq('connection_id', connectionId);
    expect(during.data).toEqual([]);
    await repository.finishSync(owner.ctx, { ...o, fetchedAt, complete: false }, { workerApi: workerApi! });

    await incremental(owner, connectionId);
    expect((await owner.user.client.from('tn_customer_insights').select('currency').eq('connection_id', connectionId)).data)
      .toHaveLength(1);
    expect(await repository.privacyCustomerRedact(store, '1001', [], { workerApi: workerApi! })).toBe('marked');
    expect((await owner.user.client.from('tn_customer_insights').select('currency').eq('connection_id', connectionId)).data)
      .toEqual([]);
  });

  it('M27a-T-16: el snapshot no expone IDs ni montos privados, y no hay escritura por HTTP', async () => {
    const owner = await company('m27a-frontera');
    const connectionId = await connectStore(owner, storeId());
    await seed(owner, connectionId, 300, 60);
    await incremental(owner, connectionId);
    const { data } = await owner.user.client.from('tn_customer_insights').select('*');
    const text = JSON.stringify(data);
    for (const id of ['1001', '100001', '501']) expect(text).not.toContain(`"${id}"`);
    const write = await owner.user.client.from('tn_customer_insights').update({ payload: {} }).eq('connection_id', connectionId);
    expect(write.error ?? (write.data as unknown[] | null)?.length === 0).toBeTruthy();
    const { rows } = await sql!.query<{ n: string }>(
      `select count(*)::text as n from public.tn_customer_insights where connection_id = $1 and payload <> '{}'::jsonb`,
      [connectionId]);
    expect(rows[0].n).toBe('1');
    const privateRead = await owner.user.client.schema('private').from('tn_orders').select('insights_amount');
    expect(privateRead.error).not.toBeNull();
  });
});
