import { PAISES, RUBROS } from '@/modules/company/profile-options';

import type { GoalKind, WebSource } from './contract';
import { DIAGNOSTIC_LIMITS } from './limits';
import { hasFreeNumerals } from './validate';

/**
 * Paso web del diagnóstico (M26a, Diseño §3), separado del informe. La consulta lleva solo país,
 * rubro de lista cerrada y un tema fijo: ninguna cifra, nombre ni identificador del paquete
 * Meta. Lo que vuelve es texto no confiable: se aceptan solo fuentes validadas y extractos sin
 * cifras; cualquier error u omisión deja la sección «no evaluable» sin bloquear el informe.
 */

/** Lista aprobada por el usuario dominio por dominio (paso 10 del plan, D-M26a-R2). */
export const ALLOWED_WEB_DOMAINS = ['www.facebook.com', 'cace.org.ar', 'www.indec.gob.ar'] as const;

/** Aceptación propia, más estricta que el filtro de la herramienta. */
const PATH_RESTRICTIONS: Readonly<Record<string, string>> = { 'www.facebook.com': '/business/help/' };

export const WEB_TOPICS = {
  practices: 'buenas prácticas de anuncios de Meta para tiendas online',
  seasonality: 'fechas comerciales y estacionalidad del comercio electrónico',
} as const;
export type WebTopic = keyof typeof WEB_TOPICS;

export function webTopicFor(goal: GoalKind): WebTopic {
  return goal === 'purchase' ? 'seasonality' : 'practices';
}

export type CompanyProfile = Readonly<{ country: string | null; industry: string | null }>;

/** Consulta «<frase> <rubro> <país>», o null si no corresponde paso web. */
export function webQueryFor(profile: CompanyProfile, goal: GoalKind): string | null {
  const { country, industry } = profile;
  if (country !== 'Argentina' || !(PAISES as readonly string[]).includes(country)) return null;
  if (!industry || industry === 'Otro' || !(RUBROS as readonly string[]).includes(industry)) return null;
  return `${WEB_TOPICS[webTopicFor(goal)]} ${industry} ${country}`;
}

/** Texto fijo de la petición web: la consulta y el pedido de citar fuentes, nada más. */
export function webPrompt(query: string): string {
  return 'Buscá en las fuentes disponibles información general y vigente sobre el siguiente tema y '
    + 'resumila en pocas oraciones citando las fuentes. Tema: ' + query;
}

type Excerpt = Readonly<{ source_index: number; text: string }>;
export type WebContext = Readonly<{ sources: readonly WebSource[]; excerpts: readonly Excerpt[] }>;

const EMPTY: WebContext = Object.freeze({ sources: [], excerpts: [] });

const MONTHS: Readonly<Record<string, number>> = { january: 0, february: 1, march: 2, april: 3, may: 4,
  june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };

const RELATIVE_UNITS: Readonly<Record<string, number>> = { day: 1, week: 7, month: 30, year: 365 };

/**
 * Fecha verificable: ISO, «Month D, YYYY» o edad relativa «N days|weeks|months|years ago» (la
 * forma que informa la herramienta); nunca futura. Otras formas no son interpretables.
 */
function pageDate(pageAge: unknown, now: Date): boolean {
  if (typeof pageAge !== 'string') return false;
  let time: number | null = null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(pageAge);
  const named = /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(pageAge.trim());
  const relative = /^(\d{1,5}) (day|week|month|year)s? ago$/.exec(pageAge.trim().toLowerCase());
  if (relative) {
    time = now.getTime() - Number(relative[1]) * RELATIVE_UNITS[relative[2]] * 86_400_000;
  } else if (iso) {
    const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    if (d.getUTCMonth() === +iso[2] - 1) time = d.getTime();
  } else if (named && named[1].toLowerCase() in MONTHS) {
    const month = MONTHS[named[1].toLowerCase()];
    const d = new Date(Date.UTC(+named[3], month, +named[2]));
    if (d.getUTCMonth() === month) time = d.getTime();
  }
  return time !== null && time <= now.getTime();
}

function allowedHost(raw: unknown): { url: string; domain: string } | null {
  if (typeof raw !== 'string') return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  const domain = ALLOWED_WEB_DOMAINS.find((d) => host === d || host.endsWith(`.${d}`));
  if (!domain) return null;
  const path = PATH_RESTRICTIONS[domain];
  if (path && (host !== domain || !url.pathname.startsWith(path))) return null;
  return { url: url.toString(), domain };
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Fuentes y extractos validados de la respuesta web. Ante un error de la herramienta: vacío. */
export function extractWebContext(blocks: readonly unknown[], now: Date): WebContext {
  const results = new Map<string, { title: string; page_age: string; domain: string }>();
  for (const raw of blocks) {
    const block = record(raw);
    if (!block || block.type !== 'web_search_tool_result') continue;
    // Error dentro de un 200: el contenido es un objeto, no una lista.
    if (!Array.isArray(block.content)) return EMPTY;
    for (const item of block.content) {
      const result = record(item);
      if (!result || result.type !== 'web_search_result') continue;
      const host = allowedHost(result.url);
      const title = typeof result.title === 'string' ? result.title.trim() : '';
      if (!host || !title || !pageDate(result.page_age, now)) continue;
      if (!results.has(host.url)) {
        results.set(host.url, { title: title.slice(0, 200), page_age: String(result.page_age), domain: host.domain });
      }
    }
  }

  const excerptsByUrl = new Map<string, string[]>();
  for (const raw of blocks) {
    const block = record(raw);
    if (!block || block.type !== 'text' || !Array.isArray(block.citations)) continue;
    for (const item of block.citations) {
      const citation = record(item);
      if (!citation || citation.type !== 'web_search_result_location') continue;
      const host = allowedHost(citation.url);
      if (!host || !results.has(host.url) || typeof citation.cited_text !== 'string') continue;
      const text = citation.cited_text.replace(/\s+/g, ' ').trim().slice(0, DIAGNOSTIC_LIMITS.webExcerptChars);
      if (!text || hasFreeNumerals(text) || /\[\[|\]\]/.test(text)) continue;
      const list = excerptsByUrl.get(host.url) ?? [];
      if (list.length < DIAGNOSTIC_LIMITS.webExcerptsPerSource && !list.includes(text)) list.push(text);
      excerptsByUrl.set(host.url, list);
    }
  }

  const sources: WebSource[] = [];
  const excerpts: Excerpt[] = [];
  for (const [url, meta] of results) {
    const list = excerptsByUrl.get(url);
    if (!list || list.length === 0 || sources.length >= DIAGNOSTIC_LIMITS.webMaxSources) continue;
    const index = sources.length + 1;
    sources.push({ index, url, title: meta.title, page_age: meta.page_age, domain: meta.domain });
    for (const text of list) excerpts.push({ source_index: index, text });
  }
  return { sources, excerpts };
}
