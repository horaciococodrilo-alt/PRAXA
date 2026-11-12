// Datos sintéticos «ricos» para probar el chat a mano: 60 días, cuatro campañas con objetivos
// distintos, tendencias, estacionalidad semanal, una promo, pausas y desgloses. Todo es inventado
// y determinista (misma salida para las mismas fechas); nada sale de una cuenta real.

export const RICH_DAYS = 60;

const CAMPAIGNS = [
  { id: '201', name: 'Ventas | Catálogo prospecting', objective: 'OUTCOME_SALES' },
  { id: '202', name: 'Ventas | Retargeting 30 días', objective: 'OUTCOME_SALES' },
  { id: '203', name: 'Marca | Reconocimiento AR', objective: 'OUTCOME_AWARENESS' },
  { id: '204', name: 'Tráfico | Blog y guías', objective: 'OUTCOME_TRAFFIC' },
];

const ADSETS = [
  { id: '301', parent: '201', name: 'Intereses amplios 25-44' },
  { id: '302', parent: '201', name: 'Lookalike 1% compradores' },
  { id: '303', parent: '202', name: 'Visitantes web 30 días' },
  { id: '304', parent: '203', name: 'Cobertura Argentina' },
  { id: '305', parent: '204', name: 'Lectores y suscriptores' },
];

// spend: gasto diario inicial; growth: factor diario; cpm/ctr/cvr/aov: nivel base; freq: frecuencia
// inicial; fatigue: el anuncio se desgasta; pause: [desde, hasta] (índice de día) sin filas;
// start: primer día con filas.
const ADS = [
  { id: '401', parent: '301', name: 'Video unboxing 15s', kind: 'sales', spend: 34, growth: 1.004, cpm: 7.8, ctr: 0.019, cvr: 0.034, aov: 46, freq: 1.25, fatigue: false },
  { id: '402', parent: '301', name: 'Carrusel de catálogo', kind: 'sales', spend: 26, growth: 0.996, cpm: 8.6, ctr: 0.016, cvr: 0.029, aov: 52, freq: 1.3, fatigue: true },
  { id: '403', parent: '302', name: 'Testimonios de clientes', kind: 'sales', spend: 30, growth: 1.007, cpm: 9.4, ctr: 0.017, cvr: 0.041, aov: 58, freq: 1.2, fatigue: false },
  { id: '404', parent: '303', name: 'Recordatorio de carrito', kind: 'sales', spend: 16, growth: 1.001, cpm: 12.5, ctr: 0.026, cvr: 0.071, aov: 49, freq: 1.9, fatigue: true },
  { id: '405', parent: '303', name: 'Oferta 10% primera compra', kind: 'sales', spend: 12, growth: 0.999, cpm: 13.2, ctr: 0.023, cvr: 0.064, aov: 44, freq: 1.8, fatigue: false, pause: [22, 25] },
  { id: '406', parent: '304', name: 'Video de marca 30s', kind: 'awareness', spend: 22, growth: 1.002, cpm: 3.1, ctr: 0.006, freq: 1.4, fatigue: false, start: 18 },
  { id: '407', parent: '305', name: 'Guía de uso', kind: 'traffic', spend: 14, growth: 1.003, cpm: 5.2, ctr: 0.031, freq: 1.3, fatigue: false },
  { id: '408', parent: '305', name: 'Nota del blog', kind: 'traffic', spend: 9, growth: 0.998, cpm: 5.9, ctr: 0.027, freq: 1.35, fatigue: true },
];

const SPEND_DOW = [1.1, 0.95, 1, 1.02, 1, 1.05, 1.12];
const CVR_DOW = [1.12, 0.97, 0.98, 1, 1, 1.02, 1.1];
const PROMO = { from: 40, to: 43, adsets: ['301', '302'] };
const ATTRIBUTION_WINDOWS = [{ event_type: 'click', days: 7 }, { event_type: 'view', days: 1 }];

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

const money = (cents) => (cents / 100).toFixed(2);

function newTotals() {
  return { spendC: 0, impressions: 0, reach: 0, clicks: 0, inline: 0, actions: new Map() };
}

function addAction(map, type, count, valueC) {
  const current = map.get(type) ?? { count: 0, valueC: null };
  current.count += count;
  if (valueC !== null) current.valueC = (current.valueC ?? 0) + valueC;
  map.set(type, current);
}

function adDay(profile, t, date, r) {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const promo = profile.kind === 'sales' && PROMO.adsets.includes(profile.parent)
    && t >= PROMO.from && t <= PROMO.to;
  const spendC = Math.max(100, Math.round(profile.spend * profile.growth ** t * SPEND_DOW[dow]
    * (promo ? 1.7 : 1) * (0.85 + r() * 0.3) * 100));
  const cpm = profile.cpm * (profile.fatigue ? 1 + 0.004 * t : 1) * (0.94 + r() * 0.12) * (promo ? 1.1 : 1);
  const impressions = Math.max(1, Math.round(spendC / 100 / cpm * 1000));
  const freq = Math.min(4.5, profile.freq + (profile.fatigue ? 0.03 : 0.012) * t) * (0.97 + r() * 0.06);
  const reach = Math.max(1, Math.min(impressions, Math.round(impressions / freq)));
  const ctr = profile.ctr * (profile.fatigue ? Math.max(0.55, 1 - 0.008 * t) : 1) * (0.9 + r() * 0.2);
  const clicks = Math.min(impressions, Math.round(impressions * ctr));
  const inline = Math.round(clicks * 0.82);
  const totals = { ...newTotals(), spendC, impressions, reach, clicks, inline };
  addAction(totals.actions, 'link_click', inline, null);
  if (profile.kind === 'sales') {
    const cvr = profile.cvr * CVR_DOW[dow] * (promo ? 1.35 : 1) * (0.85 + r() * 0.3);
    const aov = profile.aov * (promo ? 0.9 : 1) * (0.9 + r() * 0.2);
    const purchases = Math.round(inline * cvr);
    const checkouts = Math.round(purchases * (1.8 + r() * 0.4));
    const carts = Math.round(checkouts * (1.6 + r() * 0.4));
    addAction(totals.actions, 'purchase', purchases, Math.round(purchases * aov * 100));
    addAction(totals.actions, 'add_to_cart', carts, Math.round(carts * aov * 95));
    addAction(totals.actions, 'initiate_checkout', checkouts, null);
    addAction(totals.actions, 'landing_page_view', Math.round(inline * (0.74 + r() * 0.08)), null);
  } else if (profile.kind === 'traffic') {
    addAction(totals.actions, 'landing_page_view', Math.round(inline * (0.7 + r() * 0.08)), null);
    addAction(totals.actions, 'post_engagement', Math.round(clicks * 1.5), null);
  } else {
    addAction(totals.actions, 'video_view', Math.round(impressions * (0.26 + r() * 0.06)), null);
    addAction(totals.actions, 'post_engagement', Math.round(clicks * 1.2), null);
  }
  return totals;
}

function sumTotals(children) {
  const total = newTotals();
  let reach = 0;
  for (const child of children) {
    total.spendC += child.spendC;
    total.impressions += child.impressions;
    reach += child.reach;
    total.clicks += child.clicks;
    total.inline += child.inline;
    for (const [type, item] of child.actions) addAction(total.actions, type, item.count, item.valueC);
  }
  // El alcance no es aditivo: entre conjuntos y campañas hay personas repetidas.
  total.reach = Math.max(1, Math.min(total.impressions, Math.round(reach * 0.88)));
  return total;
}

function toRow(level, externalId, date, t) {
  return {
    date, level, external_id: externalId,
    spend: money(t.spendC), impressions: String(t.impressions), reach: String(t.reach),
    clicks: String(t.clicks), inline_link_clicks: String(t.inline),
    ctr: (t.clicks / t.impressions * 100).toFixed(2),
    cpc: t.clicks > 0 ? (t.spendC / 100 / t.clicks).toFixed(2) : null,
    cpm: (t.spendC / 100 / t.impressions * 1000).toFixed(2),
    frequency: (t.impressions / t.reach).toFixed(2),
    actions: [...t.actions.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([action_type, item]) => ({ action_type, variant: 'value', count: String(item.count),
        value: item.valueC === null ? null : money(item.valueC) })),
  };
}

const cache = new Map();

function model(dates) {
  const key = dates.join(',');
  if (cache.has(key)) return cache.get(key);
  const adTotals = new Map();
  for (const profile of ADS) {
    const r = rng(9000 + Number(profile.id));
    dates.forEach((date, t) => {
      const draw = adDay(profile, t, date, r);
      const paused = profile.pause && t >= profile.pause[0] && t <= profile.pause[1];
      if (!paused && t >= (profile.start ?? 0)) adTotals.set(`${profile.id}|${date}`, draw);
    });
  }
  const group = (parents, childOf, childTotals) => {
    const out = new Map();
    for (const parent of parents) {
      for (const date of dates) {
        const kids = childOf(parent).map((child) => childTotals.get(`${child.id}|${date}`)).filter(Boolean);
        if (kids.length) out.set(`${parent.id}|${date}`, sumTotals(kids));
      }
    }
    return out;
  };
  const adsetTotals = group(ADSETS, (set) => ADS.filter((ad) => ad.parent === set.id), adTotals);
  const campaignTotals = group(CAMPAIGNS, (campaign) => ADSETS.filter((set) => set.parent === campaign.id), adsetTotals);
  const accountTotals = new Map();
  for (const date of dates) {
    const kids = CAMPAIGNS.map((campaign) => campaignTotals.get(`${campaign.id}|${date}`)).filter(Boolean);
    if (kids.length) accountTotals.set(`account|${date}`, sumTotals(kids));
  }
  const built = { ad: adTotals, adset: adsetTotals, campaign: campaignTotals, account: accountTotals };
  cache.set(key, built);
  return built;
}

export function richIds() {
  return {
    account: [],
    campaign: CAMPAIGNS.map((item) => item.id),
    adset: ADSETS.map((item) => item.id),
    ad: ADS.map((item) => item.id),
  };
}

export function richAttribution() {
  return { known: true, report_time: 'impression', unified: true,
    settings: ADSETS.map((set) => ({ adset_external_id: set.id, windows: ATTRIBUTION_WINDOWS })) };
}

export function richEntities(account, instant) {
  const definitions = [
    ['account', account, null, 'Cuenta sintética', null],
    ...CAMPAIGNS.map((item) => ['campaign', item.id, account, item.name, item.objective]),
    ...ADSETS.map((item) => ['adset', item.id, item.parent, item.name, null]),
    ...ADS.map((item) => ['ad', item.id, item.parent, item.name, null]),
  ];
  return definitions.map(([level, external_id, parent_external_id, name, objective]) => ({
    level, external_id, parent_external_id, name, effective_status: 'ACTIVE', objective,
    metadata_fetched_at: instant, attribution: richAttribution(),
  }));
}

export function richDailyRows(level, account, dates) {
  const totals = model(dates)[level];
  const ids = level === 'account' ? [account] : richIds()[level];
  return dates.flatMap((date) => ids.flatMap((id) => {
    const day = totals.get(`${level === 'account' ? 'account' : id}|${date}`);
    return day ? [toRow(level, id, date, day)] : [];
  }));
}

const SEGMENTS = {
  age_gender: [
    ['18-24', 'female', 0.07, 0.8], ['18-24', 'male', 0.06, 0.7], ['25-34', 'female', 0.20, 1.05],
    ['25-34', 'male', 0.15, 0.95], ['35-44', 'female', 0.17, 1.25], ['35-44', 'male', 0.13, 1.1],
    ['45-54', 'female', 0.09, 1.1], ['45-54', 'male', 0.07, 0.9], ['55-64', 'female', 0.03, 0.8],
    ['55-64', 'male', 0.03, 0.7],
  ],
  country: [['AR', null, 0.72, 1.05], ['UY', null, 0.11, 0.95], ['CL', null, 0.10, 0.9], ['MX', null, 0.07, 0.8]],
  region: [
    ['Buenos Aires', null, 0.34, 1], ['Ciudad Autónoma de Buenos Aires', null, 0.22, 1],
    ['Córdoba', null, 0.12, 1], ['Santa Fe', null, 0.09, 1], ['Mendoza', null, 0.06, 1],
    ['Tucumán', null, 0.04, 1], ['Otras regiones', null, 0.13, 1],
  ],
};

export function richBreakdownRows(dimension, account, dates) {
  const day = model(dates).account;
  const r = rng(777 + dimension.length);
  const segments = SEGMENTS[dimension];
  return dates.flatMap((date) => {
    const total = day.get(`account|${date}`);
    if (!total) return [];
    const spread = (pick) => {
      const raw = segments.map((segment) => pick(segment) * (0.9 + r() * 0.2));
      const sum = raw.reduce((a, b) => a + b, 0);
      return raw.map((value) => value / sum);
    };
    const volume = spread(([, , share]) => share);
    const conversion = spread(([, , share, tilt]) => share * tilt);
    const purchase = total.actions.get('purchase');
    return segments.map(([segment_primary, segment_secondary], index) => {
      const spendC = Math.round(total.spendC * volume[index]);
      const impressions = Math.max(1, Math.round(total.impressions * volume[index]));
      const clicks = Math.min(impressions, Math.round(total.clicks * volume[index]));
      return {
        date, external_id: account, segment_primary, segment_secondary,
        spend: money(spendC), impressions: String(impressions), clicks: String(clicks),
        inline_link_clicks: String(Math.round(total.inline * volume[index])),
        ctr: (clicks / impressions * 100).toFixed(2),
        cpc: clicks > 0 ? (spendC / 100 / clicks).toFixed(2) : null,
        cpm: (spendC / 100 / impressions * 1000).toFixed(2),
        actions: dimension === 'region' || !purchase ? [] : [{ action_type: 'purchase', variant: 'value',
          count: String(Math.round(purchase.count * conversion[index])),
          value: money(Math.round(purchase.valueC * conversion[index])) }],
      };
    });
  });
}

export const RICH_PROFILE = { ADS, ADSETS, CAMPAIGNS, PROMO };
