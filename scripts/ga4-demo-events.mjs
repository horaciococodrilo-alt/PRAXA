// Carga datos sintéticos en una propiedad GA4 DE PRUEBA del usuario, por el Measurement
// Protocol de Google. Herramienta aparte, fuera de M16f: no aprueba G-GA4-FUSION.
//
// Nunca usar con la propiedad del dueño ni con una propiedad real de la tienda.
//
// Uso (las variables van en .env.local, nunca en el chat):
//   GA4_TEST_MEASUREMENT_ID=G-...   (ID de medición del flujo web de la propiedad de prueba)
//   GA4_TEST_API_SECRET=...          (secreto del Measurement Protocol de ese flujo)
//
//   node --env-file=.env.local scripts/ga4-demo-events.mjs --validar   # valida 1 lote, no guarda nada
//   node --env-file=.env.local scripts/ga4-demo-events.mjs             # envía unos 3 días de visitas
//
// Google acepta eventos con hasta 72 horas de antigüedad: para tener historia, correrlo una vez
// por día. Los datos tardan entre unas horas y 48 h en aparecer en los informes de GA4.
// El script nunca imprime el ID de medición ni el secreto.

const MEASUREMENT_ID = process.env.GA4_TEST_MEASUREMENT_ID ?? '';
const API_SECRET = process.env.GA4_TEST_API_SECRET ?? '';
const VALIDATE = process.argv.includes('--validar');

if (!/^G-[A-Z0-9]{4,20}$/.test(MEASUREMENT_ID) || API_SECRET.length < 8) {
  console.error(JSON.stringify({ ok: false,
    GA4_TEST_MEASUREMENT_ID: !MEASUREMENT_ID ? 'falta' :
      /^G-[A-Z0-9]{4,20}$/.test(MEASUREMENT_ID) ? 'ok' : 'forma_invalida',
    GA4_TEST_API_SECRET: API_SECRET ? (API_SECRET.length < 8 ? 'forma_invalida' : 'ok') : 'falta' }));
  process.exit(1);
}

const ENDPOINT = `https://www.google-analytics.com/${VALIDATE ? 'debug/' : ''}mp/collect`;
const HOST = 'https://tienda-de-prueba.example';
const PRODUCTS = [
  { item_id: 'PRUEBA-REM-01', item_name: 'Remera de prueba', price: 12000, item_category: 'Remeras' },
  { item_id: 'PRUEBA-REM-02', item_name: 'Remera estampada de prueba', price: 15000, item_category: 'Remeras' },
  { item_id: 'PRUEBA-BUZ-01', item_name: 'Buzo de prueba', price: 32000, item_category: 'Buzos' },
  { item_id: 'PRUEBA-PAN-01', item_name: 'Pantalón de prueba', price: 28000, item_category: 'Pantalones' },
  { item_id: 'PRUEBA-GOR-01', item_name: 'Gorra de prueba', price: 9000, item_category: 'Accesorios' },
  { item_id: 'PRUEBA-MED-01', item_name: 'Medias de prueba', price: 4000, item_category: 'Accesorios' },
];
// Orígenes variados; las campañas usan el evento campaign_details. Un ID de campaña numérico
// no coincide con campañas reales de Meta: la comparación por utm_id va a quedar sin correspondencia.
const SOURCES = [
  { weight: 30 },
  { weight: 25, source: 'google', medium: 'organic' },
  { weight: 20, source: 'facebook', medium: 'paid', campaign: 'prueba_invierno', campaign_id: '900000000001' },
  { weight: 10, source: 'instagram', medium: 'paid', campaign: 'prueba_reels', campaign_id: '900000000002' },
  { weight: 10, source: 'newsletter', medium: 'email', campaign: 'prueba_novedades' },
  { weight: 5, source: 'tiktok', medium: 'referral' },
];

// Generador determinista por corrida (semilla = día), para no depender de Math.random.
let seed = Number(new Date().toISOString().slice(0, 10).replaceAll('-', ''));
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (list) => list[Math.floor(rand() * list.length)];
const weighted = (list) => {
  let r = rand() * list.reduce((t, x) => t + x.weight, 0);
  for (const x of list) { r -= x.weight; if (r <= 0) return x; }
  return list[0];
};

const NOW = Date.now();
const MAX_AGE_MS = 70 * 3_600_000; // dentro del límite de 72 h de Google
// Visitantes estables entre corridas: unos vuelven, así las cohortes muestran retención.
const VISITORS = Array.from({ length: VALIDATE ? 1 : 140 }, (_, i) => `${1_000_000 + i}.${2_000_000 + i}`);

function session(clientId, startMs) {
  const sessionId = String(Math.floor(startMs / 1000));
  const origin = weighted(SOURCES);
  const events = [];
  let t = startMs;
  const at = () => { t += 15_000 + Math.floor(rand() * 90_000); return t; };
  const base = (extra = {}) => ({ session_id: sessionId, engagement_time_msec: 10_000 + Math.floor(rand() * 50_000), ...extra });
  if (origin.source) {
    events.push({ name: 'campaign_details', timestamp_micros: at() * 1000, params: base({
      source: origin.source, medium: origin.medium, ...(origin.campaign ? { campaign: origin.campaign } : {}),
      ...(origin.campaign_id ? { campaign_id: origin.campaign_id } : {}) }) });
  }
  events.push({ name: 'page_view', timestamp_micros: at() * 1000, params: base({ page_location: `${HOST}/`, page_title: 'Inicio' }) });
  const viewed = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => pick(PRODUCTS));
  for (const product of viewed) {
    events.push({ name: 'page_view', timestamp_micros: at() * 1000,
      params: base({ page_location: `${HOST}/productos/${product.item_id.toLowerCase()}`, page_title: product.item_name }) });
    events.push({ name: 'view_item', timestamp_micros: at() * 1000,
      params: base({ currency: 'ARS', value: product.price, items: [{ ...product, quantity: 1 }] }) });
  }
  if (rand() < 0.35) {
    const product = viewed[0];
    const quantity = 1 + Math.floor(rand() * 2);
    const item = { ...product, quantity };
    events.push({ name: 'add_to_cart', timestamp_micros: at() * 1000,
      params: base({ currency: 'ARS', value: product.price * quantity, items: [item] }) });
    if (rand() < 0.6) {
      events.push({ name: 'begin_checkout', timestamp_micros: at() * 1000,
        params: base({ currency: 'ARS', value: product.price * quantity, items: [item] }) });
      if (rand() < 0.55) {
        events.push({ name: 'purchase', timestamp_micros: at() * 1000, params: base({ currency: 'ARS',
          transaction_id: `PRUEBA-${sessionId}-${clientId.split('.')[0]}`, value: product.price * quantity, items: [item] }) });
      }
    }
  }
  // Ningún evento puede quedar en el futuro ni pasar el límite de antigüedad.
  return events.filter((e) => e.timestamp_micros / 1000 <= NOW && NOW - e.timestamp_micros / 1000 <= MAX_AGE_MS);
}

const requests = [];
for (const clientId of VISITORS) {
  const visits = VALIDATE ? 1 : 1 + Math.floor(rand() * 3);
  for (let v = 0; v < visits; v += 1) {
    const start = NOW - Math.floor(rand() * (MAX_AGE_MS - 3_600_000)) - 3_600_000;
    const events = session(clientId, start);
    for (let i = 0; i < events.length; i += 25) {
      requests.push({ client_id: clientId, events: events.slice(i, i + 25) });
    }
  }
}

let sent = 0;
let failed = 0;
let events = 0;
for (const body of VALIDATE ? requests.slice(0, 1) : requests) {
  const url = `${ENDPOINT}?measurement_id=${encodeURIComponent(MEASUREMENT_ID)}&api_secret=${encodeURIComponent(API_SECRET)}`;
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body) });
    if (VALIDATE) {
      const result = await response.json().catch(() => null);
      const messages = (result?.validationMessages ?? []).map((m) => ({ campo: m.fieldPath, codigo: m.validationCode,
        detalle: m.description }));
      console.log(JSON.stringify({ ok: response.ok && messages.length === 0, estado: response.status, mensajes: messages }));
      process.exit(response.ok && messages.length === 0 ? 0 : 1);
    }
    if (response.ok) { sent += 1; events += body.events.length; } else { failed += 1; }
  } catch {
    failed += 1;
  }
}
// Solo conteos; nunca el ID de medición, el secreto ni la URL.
console.log(JSON.stringify({ ok: failed === 0, visitantes: VISITORS.length, solicitudes: sent, eventos: events,
  fallidas: failed }));
process.exit(failed === 0 ? 0 : 1);
