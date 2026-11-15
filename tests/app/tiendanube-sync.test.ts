import { createHmac, randomBytes, randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { TiendanubeFetch } from '@/modules/integrations/tiendanube/client';
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
 * M16e etapa .3 contra el proyecto desechable: extracción, publicación, privacidad y medición
 * de presupuestos (T-04, T-05, T-06, T-07 y T-14, parte de app; paso 7).
 *
 * La base es real: `worker_api` con el rol de pruebas, RLS con el cliente del usuario y el
 * llavero de `.env.local`. Tiendanube es simulada. Tiendas, pedidos y clientes son sintéticos.
 * La conexión SQL directa (`postgres`) solo cuenta filas de las tablas privadas: ninguna
 * escritura de la prueba pasa por ella.
 *
 * Sin destino desechable válido, el primer `beforeAll` lanza (CB-06).
 */

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const SECRET = 'secreto-sint-tn';
const TZ = 'America/Argentina/Buenos_Aires';
const storeId = () => String(700_000_000 + Math.floor(Math.random() * 99_000_000));
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

type Company = { user: TestUser; ctx: TenantContext };
type RawOrder = Record<string, unknown> & { id: number; created_at: string; updated_at: string };

function rawOrder(id: number, at: string, over: Record<string, unknown> = {}): RawOrder {
  return {
    id, contact_email: `c${id}@ejemplo.test`, billing_name: 'Nombre', customer: { id: 501, email: 'p@ejemplo.test' },
    status: 'closed', payment_status: 'paid', created_at: at, updated_at: at, paid_at: at, closed_at: null,
    cancelled_at: null, currency: 'ARS', subtotal: '100', discount: '0', total: '100', total_paid_by_customer: '100',
    storefront: 'store', cancel_reason: null, is_subscription: false, is_subscription_initial: false,
    products: [{ product_id: 70, variant_id: 700, name: 'Remera', price: '100', quantity: 1 }],
    ...over,
  } as RawOrder;
}

/** Fixture de T-05/T-14: valores esperados escritos a mano. */
function fixture(): RawOrder[] {
  return [
    rawOrder(1001, '2026-01-10T15:00:00+0000', { customer: { id: 501 }, total_paid_by_customer: '100' }),
    rawOrder(1002, '2026-01-10T16:00:00+0000', { customer: null, total_paid_by_customer: '50', total: '50' }),
    rawOrder(1003, '2026-01-10T17:00:00+0000', { customer: { id: 502 }, currency: 'USD', total: '20',
      total_paid_by_customer: '20' }),
    rawOrder(1004, '2026-01-11T15:00:00+0000', { payment_status: 'pending', paid_at: null }),
    rawOrder(1005, '2026-01-11T16:00:00+0000', { payment_status: 'partially_paid', paid_at: null }),
    // 23:30 del 31 de enero en la zona de la tienda (02:30 UTC del 1 de febrero).
    rawOrder(1006, '2026-02-01T02:30:00+0000', { customer: { id: 503 } }),
  ];
}

describe('M16e .3: extracción y privacidad de Tiendanube contra la base real', { timeout: 300_000 }, () => {
  let sql: pg.Client | undefined;
  let workerApi: ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi> | undefined;
  let sync: typeof import('@/modules/integrations/tiendanube/sync');
  let privacy: typeof import('@/modules/integrations/tiendanube/privacy');
  let repository: typeof import('@/modules/integrations/tiendanube/repository');
  let config: typeof import('@/modules/integrations/tiendanube/config');
  let clientModule: typeof import('@/modules/integrations/tiendanube/client');
  let limits: typeof import('@/modules/integrations/tiendanube/limits');
  let lifecycle: typeof import('@/modules/integrations/lifecycle');
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
    [sync, privacy, repository, config, clientModule, limits, lifecycle, connections, credentials, lifecycleCalls,
      keyringModule, workerApiModule] = await Promise.all([
      import('@/modules/integrations/tiendanube/sync'),
      import('@/modules/integrations/tiendanube/privacy'),
      import('@/modules/integrations/tiendanube/repository'),
      import('@/modules/integrations/tiendanube/config'),
      import('@/modules/integrations/tiendanube/client'),
      import('@/modules/integrations/tiendanube/limits'),
      import('@/modules/integrations/lifecycle'),
      import('@/modules/integrations/repository/connections'),
      import('@/modules/integrations/repository/credentials'),
      import('@/modules/integrations/repository/lifecycle-calls'),
      import('@/modules/integrations/crypto/keyring'),
      import('@/modules/integrations/db/worker-api'),
    ]);
    workerApi = workerApiModule.createWorkerApi({ connectionString: roleTarget.connectionString });
    sql = new pg.Client(verifiedTestDbConfig(sqlTarget.connectionString, 'praxa-tiendanube-sync'));
    await sql.connect();
    await sql.query('set statement_timeout = 30000');
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

  // -------------------------------------------------------------------------
  // Fixtures
  // -------------------------------------------------------------------------

  const cfg = () => config.readTiendanubeConfig({ TIENDANUBE_APP_ID: '4321', TIENDANUBE_CLIENT_SECRET: SECRET,
    TIENDANUBE_SUPPORT_CONTACT: 'soporte@praxa.test',
    TIENDANUBE_REDIRECT_URI: 'https://praxa.test/api/integraciones/tiendanube/callback' } as unknown as NodeJS.ProcessEnv);

  async function company(prefix: string): Promise<Company> {
    const user = await createConfirmedUser(prefix);
    const { data, error } = await user.client
      .rpc('create_company_for_current_user', { p_name: `Empresa sintética ${RUN_ID} ${prefix}` })
      .single<{ id: string }>();
    if (error || !data) throw new Error('No se pudo crear la empresa sintética.');
    return { user, ctx: { user_id: user.id, company_id: data.id, role: 'owner', request_id: randomUUID() } };
  }

  async function connectStore(owner: Company, store: string): Promise<string> {
    const keyring = keyringModule.getCredentialKeyring();
    const created = await credentials.createPendingConnectionWithCredential(owner.ctx, {
      provider: 'tiendanube', token: `tok-${randomBytes(6).toString('hex')}`, tokenType: 'store_app_token',
      issuedForAppId: '4321', grantedScopes: ['read_customers', 'read_orders', 'read_products'], expiresAt: null,
      clientBusinessId: null }, { workerApi: workerApi!, keyring });
    await lifecycleCalls.confirmConnection(owner.ctx, { connectionId: created.connectionId, externalAccountId: store,
      currency: 'ARS', timezone: TZ }, { workerApi: workerApi! });
    return created.connectionId;
  }

  async function connectMeta(owner: Company): Promise<string> {
    const id = randomUUID();
    await workerApi!.call('create_pending_connection', [owner.ctx.user_id, owner.ctx.company_id, id, 'meta',
      'negocio_sintetico', 'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', 'app_sintetica',
      ['ads_read'], null]);
    await workerApi!.call('confirm_connection', [owner.ctx.user_id, owner.ctx.company_id, id, `act_${Date.now()}`,
      'USD', 'UTC', true]);
    return id;
  }

  function fakeTiendanube(store: string, orders: RawOrder[], hook: (url: URL) => Promise<Response | null> | null = () => null) {
    const calls: URL[] = [];
    const fetch: TiendanubeFetch = async (input) => {
      const url = new URL(input);
      calls.push(url);
      const hooked = await hook(url);
      if (hooked) return hooked;
      const path = url.pathname.slice(`/2025-03/${store}/`.length);
      if (path === 'store') return json({ id: Number(store), original_domain: 'tienda.test', country: 'AR' });
      if (path === 'products') return json([{ id: 70, name: { es: 'Remera' }, variants: [{ id: 700, sku: 'R-1' }] }]);
      if (path !== 'orders') return json([]);
      const p = url.searchParams;
      const within = (value: string, min: string | null, max: string | null) =>
        (min === null || Date.parse(value) >= Date.parse(min)) && (max === null || Date.parse(value) <= Date.parse(max));
      const list = orders.filter((o) => within(o.created_at, p.get('created_at_min'), p.get('created_at_max')) &&
        within(o.updated_at, p.get('updated_at_min'), p.get('updated_at_max'))).sort((a, b) => a.id - b.id);
      const perPage = Number(p.get('per_page'));
      const page = Number(p.get('page'));
      const headers: Record<string, string> = { 'x-total-count': String(list.length) };
      if (page * perPage < list.length) {
        const next = new URL(url);
        next.searchParams.set('page', String(page + 1));
        headers.link = `<${next.href}>; rel="next"`;
      }
      return json(list.slice((page - 1) * perPage, page * perPage), 200, headers);
    };
    return { calls, fetch };
  }

  function syncDeps(owner: Company, tn: ReturnType<typeof fakeTiendanube>, over: Record<string, number> = {}) {
    return {
      tenant: async () => owner.ctx,
      readConnection: (ctx: TenantContext) => connections.readConnectionRecord(ctx, { supabase: owner.user.client }, 'tiendanube'),
      config: cfg,
      http: (c: ReturnType<typeof cfg>) => clientModule.createTiendanubeHttpClient({ fetch: tn.fetch, userAgent: config.userAgentFor(c) }),
      workerApi: () => workerApi!,
      keyring: () => keyringModule.getCredentialKeyring(),
      limits: { ...limits.DEFAULT_TN_SYNC_LIMITS, maxPages: 40, ...over },
      log: () => {},
    };
  }

  /** Pasos hasta `completa` (backfill + primer incremental), con tope. */
  async function syncUntilComplete(owner: Company, tn: ReturnType<typeof fakeTiendanube>, over: Record<string, number> = {}) {
    const results: string[] = [];
    for (let step = 0; step < 8; step += 1) {
      const result = await sync.syncTiendanube(syncDeps(owner, tn, over));
      results.push(result);
      if (result === 'completa') return results;
      if (result !== 'parcial') throw new Error(`Paso inesperado: ${result}`);
    }
    throw new Error('La sincronización no terminó en 8 pasos.');
  }

  async function sales(owner: Company, connectionId: string, from = '2026-01-01', to = '2026-02-28', grain = 'day') {
    const { data, error } = await owner.user.client.rpc('get_tn_sales', {
      p_connection_id: connectionId, p_from: from, p_to: to, p_grain: grain });
    if (error) throw new Error('get_tn_sales falló.');
    return (data as Array<Record<string, unknown>>).map((row) => [row.period_start, row.currency, row.paid_orders,
      row.paid_orders_without_customer, row.partially_paid_orders, Number(row.paid_amount), row.covered]);
  }

  async function privateOrders(connectionId: string): Promise<string[]> {
    const { rows } = await sql!.query<{ id: string }>(
      'select external_order_id as id from private.tn_orders where connection_id = $1 order by 1', [connectionId]);
    return rows.map((row) => row.id);
  }

  /** Todas las filas de una conexión, en tablas públicas y privadas. */
  async function rowsOf(connectionIds: string[]): Promise<number> {
    const tables = ['private.tn_orders', 'private.tn_order_lines', 'private.tn_customers', 'private.tn_products',
      'private.tn_product_variants', 'private.tn_redaction_suppressions', 'private.tn_sync_runs',
      'private.integration_credentials', 'public.tn_sync_status', 'public.tn_sales_daily',
      'public.tn_product_units_daily', 'public.tn_cohort_cells', 'public.chat_query_records'];
    let total = 0;
    for (const table of tables) {
      const { rows } = await sql!.query<{ n: string }>(
        `select count(*)::text as n from ${table} where connection_id = any($1::uuid[])`, [connectionIds]);
      total += Number(rows[0].n);
    }
    const { rows } = await sql!.query<{ n: string }>(
      'select count(*)::text as n from public.integration_connections where id = any($1::uuid[])', [connectionIds]);
    return total + Number(rows[0].n);
  }

  /** Hora de la base menos un margen: el reloj local puede ir adelantado respecto del de la base. */
  async function dbNowMinus(ms: number): Promise<string> {
    const { rows } = await sql!.query<{ now: Date }>('select clock_timestamp() as now');
    return new Date(rows[0].now.getTime() - ms).toISOString();
  }

  function webhook(event: 'store_redact' | 'customer_redact' | 'data_request', body: unknown, secret = SECRET) {
    const raw = JSON.stringify(body);
    const signature = createHmac('sha256', secret).update(raw).digest('hex');
    const request = new Request('https://praxa.test/api/integraciones/tiendanube/privacidad/x', {
      method: 'POST', body: raw, headers: { 'content-type': 'application/json', 'x-linkedstore-hmac-sha256': signature } });
    return privacy.handlePrivacyWebhook(event, request, { config: cfg, workerApi: () => workerApi!, log: () => {} });
  }

  // -------------------------------------------------------------------------
  // T-04 / T-05 / T-14
  // -------------------------------------------------------------------------

  it('T-04/T-05/T-14: backfill e incremental publican el fixture; cobertura parcial hasta el primer incremental', async () => {
    const owner = await company('m16e-sync');
    const store = storeId();
    const connectionId = await connectStore(owner, store);
    const tn = fakeTiendanube(store, fixture());

    expect(await sync.syncTiendanube(syncDeps(owner, tn))).toBe('parcial');
    // Backfill terminado, primer incremental pendiente: todo período es parcial.
    expect((await sales(owner, connectionId)).every((row) => row[6] === false)).toBe(true);

    expect(await sync.syncTiendanube(syncDeps(owner, tn))).toBe('completa');
    const daily = await sales(owner, connectionId);
    // Cero real: un día cubierto sin ventas tiene su fila, sin moneda; no es ausencia.
    expect(daily.find((row) => row[0] === '2026-01-05')).toEqual(['2026-01-05', null, 0, 0, 0, 0, true]);
    expect(daily.filter((row) => row[1] !== null)).toEqual([
      ['2026-01-10', 'ARS', 2, 1, 0, 150, true],
      ['2026-01-10', 'USD', 1, 0, 0, 20, true],
      ['2026-01-11', 'ARS', 0, 0, 1, 0, true],
      ['2026-01-31', 'ARS', 1, 0, 0, 100, true],
    ]);
    // Por mes: el pedido de las 23:30 del 31 queda en enero y las monedas no se suman.
    expect((await sales(owner, connectionId, '2026-01-01', '2026-02-28', 'month')).filter((row) => row[1] !== null)).toEqual([
      ['2026-01-01', 'ARS', 3, 1, 1, 250, true],
      ['2026-01-01', 'USD', 1, 0, 0, 20, true],
    ]);
    expect(await privateOrders(connectionId)).toEqual(['1001', '1002', '1003', '1004', '1005', '1006']);
    const { rows } = await sql!.query('select * from private.tn_customers where connection_id = $1', [connectionId]);
    expect(Object.keys(rows[0]).sort()).toEqual(['company_id', 'connection_id', 'external_customer_id']);
  });

  it('T-04: con pocas páginas por paso, cada paso sigue desde el checkpoint sin duplicar ni perder', async () => {
    const owner = await company('m16e-checkpoint');
    const store = storeId();
    const connectionId = await connectStore(owner, store);
    const orders = Array.from({ length: 24 }, (_, i) =>
      rawOrder(2000 + i, `2026-0${1 + (i % 3)}-${String(2 + i).padStart(2, '0')}T15:00:00+0000`));
    const results = await syncUntilComplete(owner, fakeTiendanube(store, orders), { maxPages: 14, perPage: 5 });
    expect(results.length).toBeGreaterThan(2);
    expect(await privateOrders(connectionId)).toHaveLength(24);
  });

  it('T-04: un cambio durante el backfill a un pedido ya leído lo recupera el primer incremental', async () => {
    const owner = await company('m16e-cambio');
    const store = storeId();
    const connectionId = await connectStore(owner, store);
    const orders = fixture();
    const tn = fakeTiendanube(store, orders);
    expect(await sync.syncTiendanube(syncDeps(owner, tn))).toBe('parcial');
    const changed = orders.find((o) => o.id === 1001)!;
    changed.status = 'cancelled';
    changed.updated_at = await dbNowMinus(1_000);
    expect(await sync.syncTiendanube(syncDeps(owner, tn))).toBe('completa');
    expect((await sales(owner, connectionId, '2026-01-10', '2026-01-10')).filter((row) => row[1] === 'ARS')[0]).toEqual(
      ['2026-01-10', 'ARS', 1, 1, 0, 50, true]);
  });

  // -------------------------------------------------------------------------
  // T-06
  // -------------------------------------------------------------------------

  it('T-06: customer/redact durante una sincronización en vuelo; la compra posterior se importa', async () => {
    const owner = await company('m16e-redact-vuelo');
    const store = storeId();
    const connectionId = await connectStore(owner, store);
    const orders = fixture();
    let fired = false;
    const tn = fakeTiendanube(store, orders, async (url) => {
      if (!fired && url.pathname.endsWith('/orders') && url.searchParams.get('per_page') !== '1') {
        fired = true;
        expect(await repository.privacyCustomerRedact(store, '501', ['1001'], { workerApi: workerApi! })).toBe('marked');
      }
      return null;
    });
    await syncUntilComplete(owner, tn);
    expect(fired).toBe(true);
    expect(await privateOrders(connectionId)).not.toContain('1001');

    orders.push(rawOrder(1010, await dbNowMinus(1_000), { customer: { id: 501 } }));
    expect(await sync.syncTiendanube(syncDeps(owner, tn))).toBe('completa');
    expect(await privateOrders(connectionId)).toContain('1010');
  });

  it('T-06: customer/redact con el paso 2 fallido → el siguiente paso de sincronización borra antes de leer', async () => {
    const owner = await company('m16e-redact-paso2');
    const store = storeId();
    const connectionId = await connectStore(owner, store);
    const tn = fakeTiendanube(store, fixture());
    await syncUntilComplete(owner, tn);
    // Un pedido local del cliente que no viene en la lista también se marca (D-M16e-30).
    expect(await repository.privacyCustomerRedact(store, '502', [], { workerApi: workerApi! })).toBe('marked');
    expect(await privateOrders(connectionId)).toContain('1003');
    await sync.syncTiendanube(syncDeps(owner, tn));
    expect(await privateOrders(connectionId)).not.toContain('1003');
    expect((await sales(owner, connectionId, '2026-01-10', '2026-01-10')).filter((row) => row[1] !== null))
      .toEqual([['2026-01-10', 'ARS', 2, 1, 0, 150, true]]);
  });

  it('T-06: store_redact firmado sobre una tienda activa en dos empresas → cero filas, sin actor; Meta y otra tienda intactas', async () => {
    const a = await company('m16e-store-a');
    const b = await company('m16e-store-b');
    const store = storeId();
    const other = storeId();
    const metaId = await connectMeta(a);
    const ca = await connectStore(a, store);
    const cb = await connectStore(b, store);
    const cOther = await connectStore(await company('m16e-store-c'), other);
    await syncUntilComplete(a, fakeTiendanube(store, fixture()));
    await syncUntilComplete(b, fakeTiendanube(store, fixture()));
    expect(await rowsOf([ca, cb])).toBeGreaterThan(20);

    expect((await webhook('store_redact', { store_id: Number(store) })).status).toBe(200);
    expect(await rowsOf([ca, cb])).toBe(0);
    expect(await rowsOf([cOther])).toBeGreaterThan(0);
    const { rows } = await sql!.query('select status from public.integration_connections where id = $1', [metaId]);
    expect(rows).toEqual([{ status: 'active' }]);

    // Duplicado y tienda desconocida: 200 sin efectos.
    expect((await webhook('store_redact', { store_id: Number(store) })).status).toBe(200);
    expect((await webhook('store_redact', { store_id: 123 })).status).toBe(200);
    expect(await rowsOf([cOther])).toBeGreaterThan(0);
  });

  it('T-06: corte después de la marca → oculto y sin credencial; el reintento termina; los reintentos agotados los completa runLazyPurge', async () => {
    const owner = await company('m16e-corte');
    const store = storeId();
    const connectionId = await connectStore(owner, store);
    await syncUntilComplete(owner, fakeTiendanube(store, fixture()));
    expect(await repository.privacyStoreRedact(store, 3, { workerApi: workerApi! })).toBe('marked');
    expect(await sales(owner, connectionId)).toEqual([]);
    const { rows } = await sql!.query(
      'select count(*)::int as n from private.integration_credentials where connection_id = $1', [connectionId]);
    expect(rows[0].n).toBe(0);
    expect(await repository.privacyStoreRedact(store, 3, { workerApi: workerApi! })).toBe('more');
    expect(await rowsOf([connectionId])).toBeGreaterThan(0);

    // Reintentos agotados: la purga perezosa del dueño termina sin revocación.
    const purged = await lifecycle.runLazyPurge(owner.ctx, { workerApi: () => workerApi!,
      keyring: () => keyringModule.getCredentialKeyring(), log: () => {} });
    expect(purged).toMatchObject({ purged: 1, revokeFailed: 0 });
    expect(await rowsOf([connectionId])).toBe(0);
  });

  it('T-06: una conexión nueva de la misma tienda creada después de la marca la borra el reintento (D-M16e-28)', async () => {
    const owner = await company('m16e-reinstala');
    const store = storeId();
    const metaId = await connectMeta(owner);
    const first = await connectStore(owner, store);
    expect(await repository.privacyStoreRedact(store, 5000, { workerApi: workerApi! })).toBe('marked');
    // El dueño reinstala: el inicio del OAuth corre antes la purga perezosa, que completa la marcada.
    await lifecycle.runLazyPurge(owner.ctx, { workerApi: () => workerApi!,
      keyring: () => keyringModule.getCredentialKeyring(), log: () => {} });
    const second = await connectStore(owner, store);
    expect(await rowsOf([second])).toBeGreaterThan(0);
    expect((await webhook('store_redact', { store_id: Number(store) })).status).toBe(200);
    expect(await rowsOf([first, second])).toBe(0);
    const { rows } = await sql!.query('select status from public.integration_connections where id = $1', [metaId]);
    expect(rows).toEqual([{ status: 'active' }]);
  });

  it('T-06: data_request firmado → 200 sin escribir; firma de otro secreto → 401', async () => {
    const owner = await company('m16e-data-request');
    const store = storeId();
    const connectionId = await connectStore(owner, store);
    await syncUntilComplete(owner, fakeTiendanube(store, fixture()));
    const before = await rowsOf([connectionId]);
    const body = { store_id: Number(store), customer: { id: 501, email: 'p@ejemplo.test' }, orders_requested: [1001],
      data_request: { id: 1 } };
    expect((await webhook('data_request', body)).status).toBe(200);
    expect((await webhook('store_redact', { store_id: Number(store) }, 'otro-secreto')).status).toBe(401);
    expect(await rowsOf([connectionId])).toBe(before);
  });

  // -------------------------------------------------------------------------
  // T-07
  // -------------------------------------------------------------------------

  it('T-07: get_tn_* con otra empresa devuelve vacío; tn_cohort_cells no guarda conteos menores que cinco', async () => {
    const owner = await company('m16e-aislamiento');
    const intruder = await company('m16e-intruso');
    const store = storeId();
    const connectionId = await connectStore(owner, store);
    await syncUntilComplete(owner, fakeTiendanube(store, fixture()));
    for (const [fn, args] of [
      ['get_tn_sales', { p_connection_id: connectionId, p_from: '2026-01-01', p_to: '2026-02-28', p_grain: 'day' }],
      ['get_tn_product_units', { p_connection_id: connectionId, p_from: '2026-01-01', p_to: '2026-02-28', p_limit: 10 }],
      ['get_tn_cohorts', { p_connection_id: connectionId, p_from_month: '2026-01-01', p_to_month: '2026-02-01',
        p_max_offset: 3 }],
      ['get_tn_sync_status', { p_connection_id: connectionId }],
    ] as const) {
      const { data, error } = await intruder.user.client.rpc(fn, args);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
    const { rows } = await sql!.query(
      `select count(*)::int as n from public.tn_cohort_cells
        where connection_id = $1 and (cohort_size < 5 or active < 5)`, [connectionId]);
    expect(rows[0].n).toBe(0);
  });

  it('M16e-T-08 (etapa .4): la vista de Integraciones lee los agregados reales con el cliente del usuario', async () => {
    const owner = await company('m16e-vista');
    const store = storeId();
    await connectStore(owner, store);
    await syncUntilComplete(owner, fakeTiendanube(store, fixture()));
    const analysis = await import('@/modules/integrations/tiendanube/analysis');
    const vista = await analysis.loadTiendanubeView({ tenant: async () => owner.ctx,
      supabase: async () => owner.user.client, now: () => new Date('2026-11-14T15:00:00.000Z') });
    expect(vista.error).toBe(false);
    expect(vista.tarjeta).toMatchObject({ kind: 'activa', dominio: 'tienda.test', moneda: 'ARS', zona: TZ });
    const enero = vista.datos!.ventas.filas.filter((fila) => fila.periodo === '2026-01-01');
    expect(enero.map((fila) => [fila.moneda, fila.pagados, fila.sinCliente, fila.parciales, fila.cubierto])).toEqual([
      ['ARS', 3, 1, 1, true], ['USD', 1, 0, 0, true]]);
    expect(vista.datos!.estado).toMatchObject({ fase: 'incremental', backfillTerminado: true });
    // Tres clientes: la cohorte de enero queda oculta, sin celdas.
    expect(vista.datos!.cohortes.filas.find((fila) => fila.mes === '2026-01-01')).toEqual(
      { mes: '2026-01-01', tamano: null, oculta: true, celdas: [] });
    expect(JSON.stringify(vista)).not.toContain(store);
  });

  // -------------------------------------------------------------------------
  // Paso 7: medición de presupuestos
  // -------------------------------------------------------------------------

  it('paso 7: páginas de 200 pedidos y tandas de borrado de 5.000 filas, medidas contra los presupuestos', async () => {
    const owner = await company('m16e-medicion');
    const store = storeId();
    const connectionId = await connectStore(owner, store);
    const orders = Array.from({ length: 2400 }, (_, i) => rawOrder(10_000 + i,
      new Date(Date.UTC(2026, 0, 1 + (i % 28), 12, i % 60)).toISOString(), {
        customer: { id: 600 + (i % 300) },
        products: [{ product_id: 70, variant_id: 700, name: 'Remera', price: '100', quantity: 1 },
          { product_id: 71, variant_id: 710, name: 'Gorra', price: '50', quantity: 2 }] }));
    const startedSync = performance.now();
    const results = await syncUntilComplete(owner, fakeTiendanube(store, orders), { maxPages: 25 });
    const syncMs = performance.now() - startedSync;
    expect(await privateOrders(connectionId)).toHaveLength(2400);

    const calls: number[] = [];
    let phase = '';
    while (phase !== 'done') {
      const started = performance.now();
      phase = await repository.privacyStoreRedact(store, 5000, { workerApi: workerApi! });
      calls.push(Math.round(performance.now() - started));
    }
    // Evidencia del paso 7: solo conteos y duraciones, en un archivo temporal fuera del repositorio.
    const { writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    await writeFile(join(tmpdir(), 'praxa-m16e-paso7.json'), JSON.stringify({ pedidos: 2400, lineas: 4800,
      pasos: results.length, resultados: results, sync_total_ms: Math.round(syncMs),
      sync_ms_por_paso: Math.round(syncMs / results.length), redact_llamadas_ms: calls }));
    expect(await rowsOf([connectionId])).toBe(0);
    for (const ms of calls) expect(ms).toBeLessThan(2000);
    expect(syncMs / results.length).toBeLessThan(240_000);
  });
});
