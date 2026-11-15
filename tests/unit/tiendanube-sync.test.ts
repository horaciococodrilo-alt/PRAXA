import { randomBytes, randomUUID } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TenantContext } from '@/modules/tenant/context';
import type { IntegrationConnectionRecord } from '@/modules/integrations/contract';

/**
 * M16e etapa .3 (paso 5): extracción y publicación de Tiendanube contra Tiendanube y una base
 * simuladas (T-04, T-10 y T-14, parte unitaria). La base simulada reproduce lo que importa de
 * `0023`: posesión, checkpoint del backfill, cambio de fase y cobertura.
 *
 * Tienda, pedidos y clientes son sintéticos.
 */

vi.mock('server-only', () => ({}));

const STORE = '98765';
const TOKEN = 'token-sint-tn';
const TZ = 'America/Argentina/Buenos_Aires';
const START = Date.parse('2026-04-01T12:00:00.000Z');

const CTX: TenantContext = Object.freeze({
  user_id: '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d',
  company_id: '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f',
  role: 'owner',
  request_id: '7c6b5a49-3827-4165-a4b3-c2d1e0f9a8b7',
});
const CONNECTION_ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';

const sync = await import('@/modules/integrations/tiendanube/sync');
const projection = await import('@/modules/integrations/tiendanube/projection');
const config = await import('@/modules/integrations/tiendanube/config');
const client = await import('@/modules/integrations/tiendanube/client');
const limitsModule = await import('@/modules/integrations/tiendanube/limits');
const { WorkerApiError } = await import('@/modules/integrations/db/worker-api');
const { parseCredentialKeyring } = await import('@/modules/integrations/crypto/keyring');
const { sealCredential } = await import('@/modules/integrations/crypto/seal');

type WorkerApi = import('@/modules/integrations/db/worker-api').WorkerApi;
type TiendanubeFetch = import('@/modules/integrations/tiendanube/client').TiendanubeFetch;
type SyncDeps = import('@/modules/integrations/tiendanube/sync').TiendanubeSyncDeps;
type Limits = import('@/modules/integrations/tiendanube/limits').TiendanubeSyncLimits;

const KEYRING = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');
const CONFIG = config.readTiendanubeConfig({ TIENDANUBE_APP_ID: '4321', TIENDANUBE_CLIENT_SECRET: 'secreto-sint',
  TIENDANUBE_SUPPORT_CONTACT: 'soporte@praxa.test',
  TIENDANUBE_REDIRECT_URI: 'https://praxa.test/api/integraciones/tiendanube/callback' } as unknown as NodeJS.ProcessEnv);

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

// ---------------------------------------------------------------------------
// Reloj, Tiendanube y base simulados
// ---------------------------------------------------------------------------

let clock = START;
const now = () => clock;
const sleep = async (ms: number) => { clock += ms; };

type RawOrder = Record<string, unknown> & { id: number; created_at: string; updated_at: string };

function rawOrder(id: number, createdAt: string, over: Record<string, unknown> = {}): RawOrder {
  return {
    id, number: 1000 + id, token: 'tok-pedido', contact_email: `c${id}@ejemplo.test`, contact_phone: '+5491100000000',
    contact_identification: '20123456789', billing_name: 'Nombre', billing_address: 'Calle 123', shipping_address: {},
    note: 'nota', owner_note: 'nota interna', client_details: { browser_ip: '10.0.0.1' }, gateway_link: 'https://x.test',
    customer: { id: 500 + (id % 7), name: 'Persona', email: `p${id}@ejemplo.test`, phone: '+54', identification: '1' },
    status: 'closed', payment_status: 'paid', created_at: createdAt, updated_at: createdAt, paid_at: createdAt,
    closed_at: null, cancelled_at: null, currency: 'ARS', subtotal: '100.00', discount: '0.00', total: '100.00',
    total_paid_by_customer: '100.00', storefront: 'store', cancel_reason: null, is_subscription: false,
    is_subscription_initial: false,
    products: [{ id: 1, product_id: 70, variant_id: 700, name: 'Remera', price: '100.00', quantity: 1,
      weight: '0.2', properties: [] }],
    ...over,
  } as RawOrder;
}

type Hook = (url: URL) => Response | null;

function fakeTiendanube(orders: RawOrder[], products: Array<Record<string, unknown>> = [], hook: Hook = () => null) {
  const calls: URL[] = [];
  const fetch: TiendanubeFetch = async (input, init) => {
    const url = new URL(input);
    calls.push(url);
    expect(new Headers(init.headers).get('user-agent')).toBe('PRAXA (soporte@praxa.test)');
    expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${TOKEN}`);
    const hooked = hook(url);
    if (hooked) return hooked;
    const base = `/2025-03/${STORE}/`;
    const path = url.pathname.slice(base.length);
    if (path === 'store') return json({ id: Number(STORE), original_domain: 'tienda.test', country: 'AR', name: 'X' });
    if (/^orders\/\d+\/history\/values$/.test(path)) {
      return json([{ event: 'PAID', total_paid_diff: '100.00' }, { event: 'PAID', total_paid_diff: '-30.00' }]);
    }
    const perPage = Number(url.searchParams.get('per_page') ?? '30');
    const page = Number(url.searchParams.get('page') ?? '1');
    let list: Array<Record<string, unknown>>;
    if (path === 'orders') {
      const p = url.searchParams;
      const within = (value: string, min: string | null, max: string | null) =>
        (min === null || Date.parse(value) >= Date.parse(min)) && (max === null || Date.parse(value) <= Date.parse(max));
      list = orders.filter((o) => within(o.created_at, p.get('created_at_min'), p.get('created_at_max')) &&
        within(o.updated_at, p.get('updated_at_min'), p.get('updated_at_max'))).sort((a, b) => a.id - b.id);
    } else if (path === 'products') {
      list = products;
    } else {
      return json({}, 404);
    }
    const slice = list.slice((page - 1) * perPage, page * perPage);
    const headers: Record<string, string> = { 'x-total-count': String(list.length) };
    if (page * perPage < list.length) {
      const next = new URL(url);
      next.searchParams.set('page', String(page + 1));
      headers.link = `<${next.href}>; rel="next"`;
    }
    return json(slice, 200, headers);
  };
  return { calls, fetch };
}

type Status = { phase: 'backfill' | 'incremental'; watermark: Date | null; backfillNext: string | null;
  checkpoint: Date | null; coverage: Date | null; catalogNextPage: number | null };

function fakeDb(over: Partial<Record<string, (args: readonly unknown[]) => unknown[]>> = {}, startLatencyMs = 0) {
  const status: Status = { phase: 'backfill', watermark: null, backfillNext: null, checkpoint: null, coverage: null,
    catalogNextPage: null };
  const orders = new Map<string, Record<string, unknown>>();
  const lines = new Map<string, unknown[]>();
  const products = new Map<string, Record<string, unknown>>();
  const published: Array<{ window: Record<string, unknown>; ids: string[] }> = [];
  const failures: Array<{ kind: unknown; errorClass: unknown }> = [];
  const finishes: Array<{ complete: boolean }> = [];
  const fetchedChecks: Array<{ fetched: number; startedAt: number; dbNow: number }> = [];
  let run: { id: string; lease: string; startedAt: Date; phase: Status['phase'] } | null = null;
  const sealed = sealCredential(TOKEN, { company_id: CTX.company_id, connection_id: CONNECTION_ID, provider: 'tiendanube' }, KEYRING);
  const handlers: Record<string, (args: readonly unknown[]) => unknown[]> = {
    get_credential: () => [{ ...sealed, connection_id: CONNECTION_ID, company_id: CTX.company_id, provider: 'tiendanube',
      status: 'active', credential_generation: 0, token_type: 'store_app_token', issued_for_app_id: '4321',
      granted_scopes: ['read_customers', 'read_orders', 'read_products'], expires_at: null }],
    tn_start_sync: (args) => {
      // Latencia de ida: la base fija `started_at` recién cuando le llega la llamada.
      clock += startLatencyMs;
      const startedAt = new Date(clock);
      status.watermark ??= startedAt;
      run = { id: args[4] as string, lease: args[5] as string, startedAt, phase: status.phase };
      return [{ run_id: run.id, phase: status.phase, started_at: startedAt, lease_expires_at: new Date(String(args[6])),
        watermark: status.watermark, backfill_next: status.backfillNext,
        incremental_from: status.checkpoint ? new Date(status.checkpoint.getTime() - 3_600_000) : null,
        catalog_next_page: status.catalogNextPage }];
    },
    tn_publish_orders: (args) => {
      expect(args[4]).toBe(run?.id);
      const window = JSON.parse(String(args[6]));
      const batch = JSON.parse(String(args[7])) as Array<Record<string, unknown>>;
      const batchLines = JSON.parse(String(args[8])) as Array<Record<string, unknown>>;
      expect(window.kind).toBe(run?.phase);
      if (window.kind === 'backfill' && status.backfillNext !== null) expect(window.window_from).toBe(status.backfillNext);
      expect(new Set(batch.map((o) => o.id)).size).toBe(batch.length);
      for (const order of batch) {
        orders.set(String(order.id), order);
        lines.set(String(order.id), batchLines.filter((line) => line.order_id === order.id));
      }
      published.push({ window, ids: batch.map((o) => String(o.id)) });
      if (window.kind === 'backfill' && window.last_page) status.backfillNext = sync.addDays(window.window_to, 1);
      return [{ orders_written: batch.length, orders_suppressed: 0, backfill_next: status.backfillNext }];
    },
    tn_publish_catalog: (args) => {
      const batch = JSON.parse(String(args[6])) as Array<Record<string, unknown>>;
      const state = JSON.parse(String(args[7]));
      for (const product of batch) products.set(String(product.id), product);
      status.catalogNextPage = state.next_page;
      return [{ products_written: batch.length, products_deleted: 0, catalog_next_page: state.next_page }];
    },
    tn_finish_sync: (args) => {
      const complete = args[7] as boolean;
      finishes.push({ complete });
      fetchedChecks.push({ fetched: new Date(String(args[6])).getTime(), startedAt: run!.startedAt.getTime(), dbNow: clock });
      if (complete && run!.phase === 'backfill') { status.phase = 'incremental'; status.checkpoint = status.watermark; }
      else if (complete) { status.checkpoint = run!.startedAt; status.coverage = run!.startedAt; }
      run = null;
      return [{ phase: status.phase, coverage_until: status.coverage, run_status: complete ? 'complete' : 'incomplete' }];
    },
    tn_fail_sync: (args) => {
      failures.push({ kind: args[6], errorClass: args[7] });
      run = null;
      return [{ connection_status: ['authentication', 'permission'].includes(String(args[7])) ? 'needs_reauth' : 'active',
        run_status: 'failed' }];
    },
    ...over,
  };
  const calls: string[] = [];
  const workerApi: WorkerApi = {
    call: (async (fn: string, args: readonly unknown[]) => {
      calls.push(fn);
      const handler = handlers[fn];
      if (!handler) throw new Error(`worker_api simulado: ${fn} no esperada`);
      return handler(args);
    }) as WorkerApi['call'],
  };
  return { workerApi, status, orders, lines, products, published, failures, finishes, fetchedChecks, calls };
}

function connection(over: Partial<IntegrationConnectionRecord> = {}): IntegrationConnectionRecord {
  return {
    id: CONNECTION_ID, company_id: CTX.company_id, provider: 'tiendanube', client_business_id: null,
    credential_generation: 0, current_sync_run_id: null, last_error_class: null, last_error_message: null,
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z', external_account_id: STORE,
    currency: 'ARS', timezone: TZ, status: 'active', pending_expires_at: null, purge_requested_at: null, ...over,
  } as IntegrationConnectionRecord;
}

let logs: unknown[] = [];

function deps(tn: ReturnType<typeof fakeTiendanube>, db: ReturnType<typeof fakeDb>, over: Partial<SyncDeps> = {},
  limits: Partial<Limits> = {}): Partial<SyncDeps> {
  return {
    tenant: async () => CTX,
    readConnection: async () => connection(),
    config: () => CONFIG,
    http: (cfg) => client.createTiendanubeHttpClient({ fetch: tn.fetch, userAgent: config.userAgentFor(cfg) }),
    workerApi: () => db.workerApi,
    keyring: () => KEYRING,
    now, sleep,
    randomUUID,
    limits: { ...limitsModule.DEFAULT_TN_SYNC_LIMITS, transientDelayMs: 10, ...limits },
    log: (event) => logs.push(event),
    ...over,
  };
}

beforeEach(() => {
  clock = START;
  logs = [];
});

function janToMar(count: number): RawOrder[] {
  return Array.from({ length: count }, (_, index) => {
    const day = 1 + (index % 28);
    const month = 1 + (index % 3);
    return rawOrder(index + 1, `2026-0${month}-${String(day).padStart(2, '0')}T15:00:00+0000`);
  });
}

// ---------------------------------------------------------------------------
// T-04
// ---------------------------------------------------------------------------

describe('M16e-T-04: backfill, incremental y presupuesto', () => {
  it('backfill completo en un paso: páginas de 200 + 1, cada pedido una vez; después el incremental completa', async () => {
    const orders = janToMar(201).map((o) => ({ ...o, created_at: '2026-02-10T15:00:00+0000',
      updated_at: '2026-02-10T15:00:00+0000', paid_at: '2026-02-10T15:00:00+0000' }));
    const tn = fakeTiendanube(orders, [{ id: 70, name: { es: 'Remera' }, variants: [{ id: 700, sku: 'R-1', price: '1' }] }]);
    const db = fakeDb();
    expect(await sync.syncTiendanube(deps(tn, db))).toBe('parcial');
    expect(db.orders.size).toBe(201);
    expect(db.status.phase).toBe('incremental');
    expect(db.finishes).toEqual([{ complete: true }]);
    const febPages = db.published.filter((p) => p.window.window_from === '2026-02-01');
    expect(febPages.map((p) => [p.ids.length, p.window.last_page])).toEqual([[200, false], [1, true]]);
    expect(db.products.get('70')).toEqual({ id: '70', name: 'Remera', visibility: null, variants: [{ id: '700', sku: 'R-1' }] });

    clock += 60_000;
    expect(await sync.syncTiendanube(deps(tn, db))).toBe('completa');
    expect(db.status.coverage).not.toBeNull();
  });

  it('el histórico vacío anterior a la tienda cuesta pocas páginas y sale en una ventana', async () => {
    const tn = fakeTiendanube(janToMar(6));
    const db = fakeDb();
    await sync.syncTiendanube(deps(tn, db));
    const first = db.published[0];
    expect(first.window.window_from).toBe('2010-01-01');
    expect(first.ids).toEqual([]);
    expect(String(first.window.window_to) >= '2025-12-01').toBe(true);
    expect(tn.calls.length).toBeLessThan(25);
    expect(db.status.phase).toBe('incremental');
  });

  it('una ventana con el tope de resultados o más se divide; un día que no entra deja el paso incompleto', async () => {
    const orders = Array.from({ length: 12 }, (_, i) =>
      rawOrder(i + 1, `2026-03-${String(1 + (i % 2) * 14).padStart(2, '0')}T15:00:00+0000`));
    const tn = fakeTiendanube(orders);
    const db = fakeDb();
    const limits = { maxResultsPerQuery: 10, perPage: 5 };
    await sync.syncTiendanube(deps(tn, db, {}, limits));
    const march = db.published.filter((p) => String(p.window.window_from).startsWith('2026-03'));
    expect(march.length).toBeGreaterThan(1);
    expect(new Set(march.map((p) => p.window.window_from)).size).toBeGreaterThan(1);
    expect(db.orders.size).toBe(12);

    const crowded = Array.from({ length: 11 }, (_, i) => rawOrder(i + 1, '2026-03-05T15:00:00+0000'));
    const db2 = fakeDb();
    expect(await sync.syncTiendanube(deps(fakeTiendanube(crowded), db2, {}, limits))).toBe('parcial');
    expect(db2.finishes).toEqual([{ complete: false }]);
    expect(db2.status.phase).toBe('backfill');
    expect(db2.status.coverage).toBeNull();
  });

  it('sin páginas en el paso queda incompleto y el siguiente sigue desde el checkpoint, sin duplicar', async () => {
    const tn = fakeTiendanube(janToMar(30));
    const db = fakeDb();
    const limits = { maxPages: 12, perPage: 5 };
    expect(await sync.syncTiendanube(deps(tn, db, {}, limits))).toBe('parcial');
    expect(db.finishes.at(-1)).toEqual({ complete: false });
    const checkpoint = db.status.backfillNext;
    expect(checkpoint).not.toBeNull();
    let steps = 1;
    while (db.status.phase === 'backfill' && steps < 10) {
      clock += 60_000;
      await sync.syncTiendanube(deps(tn, db, {}, limits));
      steps += 1;
    }
    expect(db.status.phase).toBe('incremental');
    expect(db.orders.size).toBe(30);
    const windows = db.published.filter((p) => p.window.last_page).map((p) => p.window.window_from);
    expect(new Set(windows).size).toBe(windows.length);
  });

  it('un cambio durante el backfill a un pedido de una ventana ya leída lo recupera el primer incremental', async () => {
    const orders = janToMar(9);
    const tn = fakeTiendanube(orders);
    const db = fakeDb();
    await sync.syncTiendanube(deps(tn, db, {}, { maxPages: 30 }));
    expect(db.status.phase).toBe('incremental');
    // Durante el backfill (antes de la marca de agua + 1 s), el pedido 1 de enero se canceló.
    const changed = orders.find((o) => o.id === 1)!;
    changed.status = 'cancelled';
    changed.updated_at = new Date(START + 1_000).toISOString();
    clock += 120_000;
    expect(await sync.syncTiendanube(deps(tn, db))).toBe('completa');
    expect(db.orders.get('1')!.status).toBe('cancelled');
  });

  it('el incremental que no entra se divide por updated_at; una hora que no entra queda incompleta', async () => {
    const tn = fakeTiendanube(janToMar(3));
    const db = fakeDb();
    await sync.syncTiendanube(deps(tn, db));
    const changes = Array.from({ length: 12 }, (_, i) =>
      rawOrder(100 + i, '2026-01-05T15:00:00+0000', { updated_at: new Date(START - 3_000_000 + i * 200_000).toISOString() }));
    const busy = fakeTiendanube([...janToMar(3), ...changes]);
    clock += 60_000;
    expect(await sync.syncTiendanube(deps(busy, db, {}, { maxResultsPerQuery: 10, perPage: 5 }))).toBe('completa');
    expect([...db.orders.keys()].filter((id) => Number(id) >= 100)).toHaveLength(12);

    const burst = Array.from({ length: 11 }, (_, i) =>
      rawOrder(200 + i, '2026-01-05T15:00:00+0000', { updated_at: new Date(START + 100_000 + i).toISOString() }));
    clock += 60_000;
    const coverage = db.status.coverage;
    expect(await sync.syncTiendanube(deps(fakeTiendanube(burst), db, {}, { maxResultsPerQuery: 10, perPage: 5 })))
      .toBe('parcial');
    expect(db.status.coverage).toEqual(coverage);
  });

  it('un pedido repetido en la misma página se publica una vez, con su versión más nueva', async () => {
    const old = rawOrder(1, '2026-01-05T15:00:00+0000');
    const fresh = { ...old, status: 'cancelled', updated_at: '2026-01-06T15:00:00+0000' };
    const tn = fakeTiendanube([old, fresh]);
    const db = fakeDb();
    await sync.syncTiendanube(deps(tn, db));
    expect(db.orders.get('1')!.status).toBe('cancelled');
  });

  it('429 espera lo que indica x-rate-limit-reset; pasado el tope de 30 s el paso falla con cuota', async () => {
    let limited = 2;
    const tn = fakeTiendanube(janToMar(3), [], (url) => url.pathname.endsWith('/orders') && limited-- > 0
      ? json({}, 429, { 'x-rate-limit-reset': '1500' }) : null);
    const db = fakeDb();
    const before = clock;
    await sync.syncTiendanube(deps(tn, db));
    expect(clock - before).toBeGreaterThanOrEqual(3_000);
    expect(db.failures).toEqual([]);

    const always = fakeTiendanube(janToMar(3), [], (url) => url.pathname.endsWith('/orders')
      ? json({}, 429, { 'x-rate-limit-reset': '20000' }) : null);
    const db2 = fakeDb();
    expect(await sync.syncTiendanube(deps(always, db2))).toBe('parcial');
    expect(db2.failures).toEqual([{ kind: 'cuota', errorClass: 'rate_limit' }]);
  });

  it('5xx: dos reintentos y sigue; con un tercero el paso falla como transitorio, sin cambiar la conexión', async () => {
    let failing = 2;
    const tn = fakeTiendanube(janToMar(3), [], (url) => url.pathname.endsWith('/orders') && failing-- > 0
      ? json({}, 503) : null);
    const db = fakeDb();
    await sync.syncTiendanube(deps(tn, db));
    expect(db.failures).toEqual([]);
    const down = fakeTiendanube(janToMar(3), [], (url) => url.pathname.endsWith('/orders') ? json({}, 502) : null);
    const db2 = fakeDb();
    expect(await sync.syncTiendanube(deps(down, db2))).toBe('parcial');
    expect(db2.failures).toEqual([{ kind: 'transitorio', errorClass: 'temporary' }]);
  });

  it('401 → requiere_reauth; 402 → tienda_suspendida', async () => {
    const db = fakeDb();
    expect(await sync.syncTiendanube(deps(fakeTiendanube([], [], () => json({}, 401)), db))).toBe('requiere_reauth');
    expect(db.failures).toEqual([{ kind: 'credencial_invalida', errorClass: 'authentication' }]);
    const db2 = fakeDb();
    expect(await sync.syncTiendanube(deps(fakeTiendanube([], [], () => json({}, 402)), db2))).toBe('tienda_suspendida');
  });

  it('una ejecución desplazada (PX010) no sigue escribiendo', async () => {
    const db = fakeDb({ tn_publish_orders: () => { throw new WorkerApiError('sync_ownership_lost'); } });
    expect(await sync.syncTiendanube(deps(fakeTiendanube(janToMar(3)), db))).toBe('conexion_cambio');
    expect(db.calls.filter((fn) => fn === 'tn_publish_orders')).toHaveLength(1);
    expect(db.calls).not.toContain('tn_finish_sync');
  });

  it('otra ejecución en curso → en_curso; sin conexión activa → sin_conexion o requiere_reauth', async () => {
    const busy = fakeDb({ tn_start_sync: () => { throw new WorkerApiError('sync_in_progress'); } });
    expect(await sync.syncTiendanube(deps(fakeTiendanube([]), busy))).toBe('en_curso');
    const db = fakeDb();
    expect(await sync.syncTiendanube(deps(fakeTiendanube([]), db, { readConnection: async () => null })))
      .toBe('sin_conexion');
    expect(await sync.syncTiendanube(deps(fakeTiendanube([]), db,
      { readConnection: async () => connection({ status: 'needs_reauth' }) }))).toBe('requiere_reauth');
    expect(db.calls).toEqual([]);
  });

  it('fetched_at no suma la latencia de abrir la ejecución: nunca queda adelantado al reloj de la base', async () => {
    const db = fakeDb({}, 3_000);
    const tn = fakeTiendanube(janToMar(3));
    expect(await sync.syncTiendanube(deps(tn, db))).toBe('parcial');
    clock += 60_000;
    expect(await sync.syncTiendanube(deps(tn, db))).toBe('completa');
    expect(db.fetchedChecks).toHaveLength(2);
    for (const check of db.fetchedChecks) {
      expect(check.fetched).toBeGreaterThanOrEqual(check.startedAt);
      expect(check.fetched).toBeLessThanOrEqual(check.dbNow);
    }
  });

  it('H-E1-256: Tiendanube responde 404 a un listado sin resultados; se toma como vacío y el backfill avanza', async () => {
    // Como en `app` (T-15): sin pedidos en el rango o pasada la última página, `GET /orders` y
    // `GET /products` responden 404 en lugar de una lista vacía.
    const orders = janToMar(4);
    const tn = fakeTiendanube(orders, [], (url) => {
      const path = url.pathname.split('/').pop();
      if (path !== 'orders' && path !== 'products') return null;
      const p = url.searchParams;
      const within = (value: string, min: string | null, max: string | null) =>
        (min === null || Date.parse(value) >= Date.parse(min)) && (max === null || Date.parse(value) <= Date.parse(max));
      const matches = path === 'products' ? 0 : orders.filter((o) =>
        within(o.created_at, p.get('created_at_min'), p.get('created_at_max')) &&
        within(o.updated_at, p.get('updated_at_min'), p.get('updated_at_max'))).length;
      return matches === 0 ? json({ code: 404, message: 'Not Found', description: 'Last page is 0' }, 404) : null;
    });
    const db = fakeDb();
    expect(await sync.syncTiendanube(deps(tn, db))).toBe('parcial');
    expect(db.failures).toEqual([]);
    expect(db.status.phase).toBe('incremental');
    expect(db.orders.size).toBe(4);
    clock += 60_000;
    expect(await sync.syncTiendanube(deps(tn, db))).toBe('completa');
  });

  it('H-E1-256: un 404 en la tienda o en el historial de un pedido sigue siendo error, no vacío', async () => {
    const client404 = client.createTiendanubeHttpClient({ userAgent: 'PRAXA (x)', fetch: async () => json({}, 404) });
    const { SecretValue } = await import('@/modules/integrations/crypto/seal');
    const token = new SecretValue(TOKEN);
    for (const path of ['store', 'orders/1/history/values']) {
      const failure = await client404.getJson(STORE, path, {}, token, path === 'store' ? 'store' : 'order').catch((e) => e);
      expect(failure.kind).toBe('no_encontrado');
    }
    expect((await client404.getJson(STORE, 'orders', {}, token, 'order')).body).toEqual([]);
    expect((await client404.getJson(STORE, 'products', {}, token, 'product')).body).toEqual([]);
    const next = await client404.getNext(STORE, 'orders', `https://api.tiendanube.com/2025-03/${STORE}/orders?page=9`,
      token, 'order');
    expect([next.body, client.totalCount(next.headers), client.nextLink(next.headers)]).toEqual([[], 0, null]);
  });

  it('un producto sin ID válido se omite y se cuenta, sin frenar el catálogo', async () => {
    const db = fakeDb();
    await sync.syncTiendanube(deps(fakeTiendanube(janToMar(2), [{ id: 'x', name: 'Roto' },
      { id: 71, name: 'Gorra', variants: [] }]), db));
    expect([...db.products.keys()]).toEqual(['71']);
    expect(logs.at(-1)).toMatchObject({ productos_omitidos: 1 });
  });

  it('los registros llevan solo conteos: sin IDs, montos, nombres ni token', async () => {
    await sync.syncTiendanube(deps(fakeTiendanube(janToMar(5), [{ id: 70, name: 'Remera', variants: [] }]), fakeDb()));
    const text = JSON.stringify(logs);
    for (const value of [STORE, TOKEN, 'Remera', '100.00', 'ejemplo.test', 'tienda.test']) expect(text).not.toContain(value);
  });
});

// ---------------------------------------------------------------------------
// T-10: proyección cerrada
// ---------------------------------------------------------------------------

describe('M16e-T-10: proyección en memoria', () => {
  it('un pedido con contact_*, billing_* y customer completo se proyecta sin esos campos', () => {
    const { order, lines } = projection.projectOrder(rawOrder(42, '2026-01-05T15:00:00+0000'));
    expect(Object.keys(order).sort()).toEqual(['cancel_reason', 'cancelled_at', 'closed_at', 'created_at', 'currency',
      'customer_id', 'discount', 'id', 'is_subscription', 'is_subscription_initial', 'paid_at', 'payment_status',
      'refunded_amount', 'status', 'storefront', 'subtotal', 'total', 'total_paid_by_customer', 'updated_at']);
    expect(order.customer_id).toBe('500');
    expect(order.created_at).toBe('2026-01-05T15:00:00.000Z');
    const text = JSON.stringify({ order, lines });
    for (const value of ['ejemplo.test', '+549', '20123456789', 'Calle', 'nota', '10.0.0.1', 'tok-pedido', 'Persona', '1042']) {
      expect(text).not.toContain(value);
    }
    expect(lines).toEqual([{ order_id: '42', line_no: 1, product_id: '70', variant_id: '700', name: 'Remera',
      price: '100.00', quantity: 1 }]);
  });

  it('lo indispensable inválido rechaza el pedido; una línea inválida se omite', () => {
    expect(() => projection.projectOrder(rawOrder(1, 'ayer'))).toThrow(projection.TiendanubeProjectionError);
    expect(() => projection.projectOrder({ ...rawOrder(1, '2026-01-05T15:00:00+0000'), payment_status: 'raro' }))
      .toThrow(projection.TiendanubeProjectionError);
    const { lines, skippedLines } = projection.projectOrder(rawOrder(1, '2026-01-05T15:00:00+0000', {
      products: [{ product_id: 1, variant_id: 2, name: 'A', price: '1', quantity: 0 },
        { product_id: 'x', variant_id: null, name: 'B', price: '2', quantity: 2 }] }));
    expect(skippedLines).toBe(1);
    expect(lines).toEqual([{ order_id: '1', line_no: 2, product_id: null, variant_id: null, name: 'B', price: '2', quantity: 2 }]);
  });

  it('producto sin precios, stock, imágenes ni descripción; nombre por idioma; visibilidad por `published`', () => {
    expect(projection.projectProduct({ id: 9, name: { pt: 'Camisa', es: 'Camisa ES' }, published: false,
      description: '<p>x</p>', images: [{}], variants: [{ id: 90, sku: ' S-1 ', price: '10', stock: 3 }, { id: 90 }] }))
      .toEqual({ id: '9', name: 'Camisa ES', visibility: 'hidden', variants: [{ id: '90', sku: 'S-1' }] });
  });

  it('historial: suma de diferencias negativas de PAID; forma desconocida o vacía → sin verificar (null)', () => {
    expect(projection.refundedFromHistory([{ event: 'PAID', total_paid_diff: '100.00' },
      { event: 'PAID', total_paid_diff: '-30.50' }, { event: 'PAID', total_paid_diff: '-0.25' }])).toBe('30.75');
    expect(projection.refundedFromHistory([{ event: 'PAID', total_paid_diff: '100' }])).toBe('0');
    expect(projection.refundedFromHistory([])).toBeNull();
    expect(projection.refundedFromHistory({ otra: 1 })).toBeNull();
  });

  it('el cliente HTTP solo admite las rutas de la lista cerrada y sigue Link solo a la misma ruta', async () => {
    const calls: URL[] = [];
    const http = client.createTiendanubeHttpClient({ userAgent: 'PRAXA (x)', fetch: async (input) => {
      calls.push(new URL(input)); return json([]); } });
    const { SecretValue } = await import('@/modules/integrations/crypto/seal');
    const token = new SecretValue(TOKEN);
    await expect(http.getJson(STORE, 'customers', {}, token, 'order')).rejects.toThrow(client.TiendanubeRequestRejectedError);
    await expect(http.getNext(STORE, 'orders', `https://api.tiendanube.com/2025-03/${STORE}/products?page=2`, token, 'order'))
      .rejects.toThrow(client.TiendanubeRequestRejectedError);
    await expect(http.getNext(STORE, 'orders', `https://evil.test/2025-03/${STORE}/orders?page=2`, token, 'order'))
      .rejects.toThrow(client.TiendanubeRequestRejectedError);
    await expect(http.getNext(STORE, 'orders', `https://api.tiendanube.com/v1/${STORE}/orders?page=2`, token, 'order'))
      .rejects.toThrow(client.TiendanubeRequestRejectedError);
    await http.getNext(STORE, 'orders', `https://api.tiendanube.com/2025-03/${STORE}/orders?page=2`, token, 'order');
    expect(calls).toHaveLength(1);
    expect(client.nextLink(new Headers({ link: '<https://a.test/x?page=3>; rel="next", <https://a.test/x?page=1>; rel="first"' })))
      .toBe('https://a.test/x?page=3');
    expect(client.nextLink(new Headers({ link: '<https://a.test/x?page=1>; rel="prev"' }))).toBeNull();
    expect(client.totalCount(new Headers({ 'x-total-count': '201' }))).toBe(201);
  });

  it('`orders` pide payment_status=any y status=any: los parciales se clasifican en la base', async () => {
    const tn = fakeTiendanube(janToMar(2));
    await sync.syncTiendanube(deps(tn, fakeDb()));
    const ordersCalls = tn.calls.filter((url) => url.pathname.endsWith('/orders'));
    expect(ordersCalls.length).toBeGreaterThan(0);
    for (const url of ordersCalls) {
      expect(url.searchParams.get('payment_status')).toBe('any');
      expect(url.searchParams.get('status')).toBe('any');
    }
  });
});

// ---------------------------------------------------------------------------
// T-14: fechas de la tienda
// ---------------------------------------------------------------------------

describe('M16e-T-14: días y meses en la zona de la tienda', () => {
  it('23:30 del último día del mes en una zona con cambio de horario cae en ese mes', () => {
    // Nueva York pasó a horario de verano el 2026-03-08: el 31 de marzo es UTC-4.
    const instant = new Date('2026-04-01T03:30:00.000Z');
    expect(sync.localDay(instant, 'America/New_York')).toBe('2026-03-31');
    expect(sync.localDay(instant, 'UTC')).toBe('2026-04-01');
  });

  it('las 00:00 locales son correctas a los dos lados del cambio de horario', () => {
    expect(sync.zonedDayStart('2026-03-08', 'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(sync.zonedDayStart('2026-03-09', 'America/New_York').toISOString()).toBe('2026-03-09T04:00:00.000Z');
    expect(sync.zonedDayStart('2026-01-01', TZ).toISOString()).toBe('2026-01-01T03:00:00.000Z');
  });

  it('la ventana de marzo incluye un pedido de las 23:30 del 31 y excluye uno de las 00:30 del 1 de abril', async () => {
    const orders = [rawOrder(1, '2026-04-01T03:30:00+0000'), rawOrder(2, '2026-04-01T04:30:00+0000')];
    const tn = fakeTiendanube(orders);
    const db = fakeDb();
    await sync.syncTiendanube(deps(tn, db, { readConnection: async () => connection({ timezone: 'America/New_York' }) }));
    const march = db.published.find((p) => p.ids.includes('1'));
    const april = db.published.find((p) => p.ids.includes('2'));
    expect(march?.ids).toEqual(['1']);
    expect(String(march?.window.window_to) <= '2026-03-31').toBe(true);
    expect(april?.ids).toEqual(['2']);
    expect(april?.window.window_from).toBe('2026-04-01');
  });
});
