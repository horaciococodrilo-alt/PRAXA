// Tiendanube y GA4 sintéticos para la empresa demo (fuera de microfase, a pedido del usuario,
// 2026-11-17). Se cargan con las mismas funciones de worker_api que usan los conectores, en el
// proyecto DE PRUEBA. Todo es inventado y determinista; nada sale de una cuenta real.

import { randomUUID } from 'node:crypto';

export const DEMO_TIMEZONE = 'America/Argentina/Buenos_Aires';
const DAYS = 365;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function localDay(now = new Date(), timeZone = DEMO_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit',
    day: '2-digit' }).format(now);
  return parts;
}
export function shiftDay(day, delta) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
function monthEnd(monthStart) {
  const d = new Date(`${monthStart}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}
function shiftMonth(monthStart, months) {
  const d = new Date(`${monthStart}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Catálogo: los ID de variante se usan también como itemId de GA4 (regla de productos por variante).
export const DEMO_PRODUCTS = [
  ['Remera básica algodón', 12900, ['S', 'M', 'L']],
  ['Remera estampada', 15900, ['M', 'L']],
  ['Buzo canguro', 34900, ['S', 'M', 'L']],
  ['Campera rompeviento', 52900, ['M', 'L']],
  ['Jean recto', 39900, ['38', '40', '42']],
  ['Jogger frisa', 27900, ['M', 'L']],
  ['Short deportivo', 16900, ['M']],
  ['Medias pack x3', 7900, ['Único']],
  ['Gorra bordada', 11900, ['Único']],
  ['Mochila urbana', 45900, ['Único']],
  ['Vestido lino', 42900, ['S', 'M']],
  ['Camisa oxford', 31900, ['M', 'L']],
].map(([name, price, sizes], p) => ({
  id: String(1001 + p), name, price, popularity: 1 / (1 + p * 0.35),
  variants: sizes.map((size, v) => ({ id: String(2001 + p * 10 + v), sku: `DEMO-${p + 1}-${size}` })),
}));

const WEEKDAY = [0.8, 1.15, 1.05, 1.0, 1.05, 1.1, 0.85];
const season = (t) => 1 + 0.25 * Math.sin((t / 365) * 2 * Math.PI - 1.2);

function pickWeighted(r, list, weight) {
  const total = list.reduce((s, x) => s + weight(x), 0);
  let x = r() * total;
  for (const item of list) { x -= weight(item); if (x <= 0) return item; }
  return list.at(-1);
}

/** Pedidos de un año con compradores que vuelven, estacionalidad semanal y anual. */
export function buildStoreOrders(today) {
  const r = rng(20261117);
  const orders = [];
  const lines = [];
  const buyers = [];
  let nextOrder = 900001;
  let nextCustomer = 500001;
  for (let t = 0; t < DAYS; t += 1) {
    // Hasta ayer: ningún pedido queda después del corte de la sincronización.
    const day = shiftDay(today, t - DAYS);
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    const count = Math.max(1, Math.round(9 * WEEKDAY[dow] * season(t) * (0.75 + r() * 0.5)));
    for (let n = 0; n < count; n += 1) {
      const id = String(nextOrder++);
      const returning = buyers.length > 20 && r() < 0.32;
      const customer = returning ? buyers[Math.floor(r() * buyers.length)] : String(nextCustomer++);
      if (!returning) buyers.push(customer);
      const hour = 9 + Math.floor(r() * 13);
      const minute = Math.floor(r() * 60);
      const at = `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-03:00`;
      const items = 1 + Math.floor(r() * (r() < 0.3 ? 3 : 1.5));
      let total = 0;
      for (let line = 1; line <= items; line += 1) {
        const product = pickWeighted(r, DEMO_PRODUCTS, (p) => p.popularity);
        const variant = product.variants[Math.floor(r() * product.variants.length)];
        const quantity = r() < 0.85 ? 1 : 2;
        total += product.price * quantity;
        lines.push({ order_id: id, line_no: line, product_id: product.id, variant_id: variant.id,
          name: product.name, price: (product.price / 100).toFixed(2), quantity });
      }
      const roll = r();
      const payment = roll < 0.9 ? 'paid' : roll < 0.94 ? 'partially_paid' : roll < 0.97 ? 'pending' : 'refunded';
      const amount = (total / 100).toFixed(2);
      orders.push({ id, customer_id: r() < 0.97 ? customer : null, status: payment === 'refunded' ? 'cancelled' : 'closed',
        payment_status: payment, created_at: at, updated_at: at, paid_at: payment === 'pending' ? null : at,
        closed_at: payment === 'paid' ? at : null, cancelled_at: payment === 'refunded' ? at : null,
        currency: 'ARS', subtotal: amount, discount: '0', total: amount,
        total_paid_by_customer: payment === 'paid' ? amount : '0', storefront: 'store',
        cancel_reason: payment === 'refunded' ? 'customer' : null, is_subscription: false,
        is_subscription_initial: false, refunded_amount: payment === 'refunded' ? amount : '0' });
    }
  }
  return { orders, lines };
}

/** Siembra Tiendanube: backfill completo + un paso incremental vacío, para dejar cobertura. */
export async function seedStore(query, actor, company) {
  const connection = randomUUID();
  await query(`select * from worker_api.create_pending_connection(
    $1::uuid,$2::uuid,$3::uuid,'tiendanube',null,$4::text,$5::text,$6::text,1,'store_app_token','12345',
    '{read_orders,read_customers,read_products}'::text[],null)`,
  [actor, company, connection, 'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==']);
  await query(`select * from worker_api.confirm_connection($1::uuid,$2::uuid,$3::uuid,'7770001','ARS',$4::text,true)`,
    [actor, company, connection, DEMO_TIMEZONE]);
  const step = async (work) => {
    const run = randomUUID();
    const lease = randomUUID();
    const args = [actor, company, connection, 0, run, lease];
    const started = await query(`select * from worker_api.tn_start_sync($1::uuid,$2::uuid,$3::uuid,$4::integer,
      $5::uuid,$6::uuid,clock_timestamp() + interval '4 minutes')`, args);
    await work(args, started.rows[0]);
    await query(`select * from worker_api.tn_finish_sync($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::uuid,
      clock_timestamp(), true)`, args);
  };
  const publishOrders = (args, window, orders, lines) => query(`select * from worker_api.tn_publish_orders(
    $1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::uuid,$7::jsonb,$8::jsonb,$9::jsonb)`,
  [...args, JSON.stringify(window), JSON.stringify(orders), JSON.stringify(lines)]);
  let total = 0;
  await step(async (args, started) => {
    const today = localDay(new Date(started.watermark), DEMO_TIMEZONE);
    const { orders, lines } = buildStoreOrders(today);
    total = orders.length;
    const window = { kind: 'backfill', window_from: shiftDay(today, -DAYS), window_to: today };
    for (let i = 0; i < orders.length; i += 1000) {
      const page = orders.slice(i, i + 1000);
      const ids = new Set(page.map((o) => o.id));
      await publishOrders(args, { ...window, last_page: i + 1000 >= orders.length }, page,
        lines.filter((l) => ids.has(l.order_id)));
    }
    await query(`select * from worker_api.tn_publish_catalog($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,
      $6::uuid,$7::jsonb,$8::jsonb,true)`, [...args, JSON.stringify(DEMO_PRODUCTS.map((p) => ({ id: p.id,
      name: p.name, visibility: 'visible', variants: p.variants }))),
    JSON.stringify({ next_page: null, store: { original_domain: 'tienda-demo.mitiendanube.com', country: 'AR' } })]);
  });
  await step((args) => publishOrders(args, { kind: 'incremental', last_page: true }, [], []));
  return { connection, orders: total };
}

const QUALITY = (timeZone) => ({ sampling_metadatas: [], subject_to_thresholding: false,
  data_loss_from_other_row: false, data_truncation_reasons: [], restricted_metrics: [],
  empty_reason: null, currency_code: 'ARS', time_zone: timeZone });
const SOURCES = [
  ['(direct)', '(none)', 0.28], ['google', 'organic', 0.27], ['facebook', 'cpc', 0.13],
  ['instagram', 'cpc', 0.09], ['l.instagram.com', 'referral', 0.05], ['newsletter', 'email', 0.08],
  ['google', 'cpc', 0.07], ['tiktok.com', 'referral', 0.03],
];
const FUNNEL = [['view_item', 1.9], ['add_to_cart', 0.21], ['begin_checkout', 0.09], ['purchase', 0.035]];

/** Filas de los seis informes, con la forma que publica la sincronización real. */
export function buildGa4Reports(today, campaignIds) {
  const r = rng(424242);
  const end = shiftDay(today, -1);
  const start = shiftDay(today, -DAYS);
  const traffic = [];
  const sources = [];
  const campaigns = [];
  const funnel = [];
  const items = [];
  for (let t = 0; t < DAYS; t += 1) {
    const day = shiftDay(start, t);
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    const sessions = Math.round(420 * WEEKDAY[dow] * season(t) * (0.85 + r() * 0.3));
    traffic.push({ day, sessions, active_users: Math.round(sessions * 0.82),
      new_users: Math.round(sessions * 0.55), provisional: day >= shiftDay(today, -3) });
    let left = sessions;
    SOURCES.forEach(([source, medium, share], i) => {
      const value = i === SOURCES.length - 1 ? left : Math.min(left, Math.round(sessions * share * (0.9 + r() * 0.2)));
      left -= value;
      if (value > 0) sources.push({ day, source, medium, sessions: value });
    });
    const meta = sources.filter((s) => s.day === day && ['facebook', 'instagram'].includes(s.source))
      .reduce((s, x) => s + x.sessions, 0);
    // Una parte de las visitas de Meta llega con el ID de campaña en el UTM; otra con un ID ajeno.
    campaignIds.forEach((id, i) => campaigns.push({ day, campaign_id: id,
      sessions: Math.max(1, Math.round(meta * (i === 0 ? 0.35 : 0.2))) }));
    campaigns.push({ day, campaign_id: '9900000000001', sessions: Math.max(1, Math.round(meta * 0.05)) });
    for (const [event, rate] of FUNNEL) {
      funnel.push({ day, event_name: event, event_count: Math.max(0, Math.round(sessions * rate * (0.85 + r() * 0.3))) });
    }
    for (const product of DEMO_PRODUCTS) for (const variant of product.variants) {
      const views = Math.round(sessions * 0.06 * product.popularity / product.variants.length * (0.7 + r() * 0.6));
      if (views === 0) continue;
      const carts = Math.round(views * 0.11 * (0.7 + r() * 0.6));
      items.push({ day, item_id: variant.id, item_name: product.name, views, add_to_carts: carts,
        purchases: Math.round(carts * 0.4 * (0.6 + r() * 0.8)) });
    }
    // Un ítem que no existe en Tiendanube: queda sin correspondencia (menos del 20 % de los ID).
    items.push({ day, item_id: 'GIFTCARD-01', item_name: 'Gift card', views: Math.round(5 + r() * 6),
      add_to_carts: 1, purchases: r() < 0.3 ? 1 : 0 });
  }
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(`${today.slice(0, 7)}-01`, i - 11));
  const cohorts = [];
  for (const month of months) {
    const size = Math.round(2600 + r() * 900);
    for (let n = 0; n <= 11; n += 1) {
      const startN = shiftDay(month, 30 * n);
      const endN = shiftDay(monthEnd(month), 30 * n);
      if (today < startN) continue;
      const active = n === 0 ? size : Math.round(size * 0.14 * Math.pow(0.82, n - 1) * (0.85 + r() * 0.3));
      cohorts.push({ cohort_month: month, month_offset: n, cohort_size: size, active,
        provisional: today <= shiftDay(endN, 3) });
    }
  }
  return { start, end, months, reports: { ga4_trafico_dia: traffic, ga4_trafico_fuente: sources,
    ga4_campanias: campaigns, ga4_embudo: funnel, ga4_productos: items, ga4_cohortes: cohorts } };
}

/** Siembra GA4 con un backfill completo. Al cerrar, la base calcula los mapeos con Tiendanube y Meta. */
export async function seedGa4(query, actor, company, campaignIds) {
  const connection = randomUUID();
  await query(`select * from worker_api.create_pending_connection(
    $1::uuid,$2::uuid,$3::uuid,'ga4',null,$4::text,$5::text,$6::text,1,'google_refresh_token','123456789',
    array['https://www.googleapis.com/auth/analytics.readonly'],null)`,
  [actor, company, connection, 'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==']);
  await query(`select * from worker_api.confirm_connection($1::uuid,$2::uuid,$3::uuid,'123456789','ARS',$4::text,true)`,
    [actor, company, connection, DEMO_TIMEZONE]);
  const args = [actor, company, connection, 0, randomUUID(), randomUUID()];
  await query(`select worker_api.ga4_start_sync($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::uuid,
    clock_timestamp() + interval '4 minutes','backfill')`, args);
  const ok = { status: 'disponible', reason: null };
  const targets = ['ga4_trafico_dia', 'ga4_trafico_fuente', 'ga4_campanias', 'ga4_embudo', 'ga4_productos', 'ga4_cohortes'];
  await query(`select worker_api.ga4_set_preflight($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::uuid,
    'Tienda Demo — sitio web',$7::text,'ARS',$8::jsonb,$9::text[])`,
  [...args, DEMO_TIMEZONE, JSON.stringify({ trafico: ok, cohortes: ok, campanias: ok, embudo: ok, productos: ok }), targets]);
  const today = localDay(new Date(), DEMO_TIMEZONE);
  const built = buildGa4Reports(today, campaignIds);
  const done = [];
  for (const id of targets) {
    const rows = built.reports[id];
    const window = id === 'ga4_cohortes' ? { from: built.months[0], to: monthEnd(built.months.at(-1)) }
      : { from: built.start, to: built.end };
    done.push(id);
    await query(`select worker_api.ga4_publish_report($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::uuid,
      $7::text,1,$8::date,$9::date,$10::jsonb,$11::jsonb,$12::jsonb)`,
    [...args, id, window.from, window.to, JSON.stringify(QUALITY(DEMO_TIMEZONE)), JSON.stringify(rows),
      JSON.stringify({ completed_reports: [...done], version: 1 })]);
  }
  await query(`select worker_api.ga4_finish_sync($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::uuid,
    $7::date,$8::date)`, [...args, built.start, built.end]);
  return { connection, days: DAYS };
}
