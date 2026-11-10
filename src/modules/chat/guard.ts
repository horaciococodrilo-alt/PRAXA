import { compareDecimal, decimalMatches, parseSpanishInteger,
  sameDisplayedDecimal } from './decimal';
import { findNumericCandidates } from './numeric-candidates';
import { projectOutput, OutputProjectionError, type FlatChatAnswer } from './output-schema';
import { modelMarkers, type ToolResult } from './tools/results';

export class GuardRejected extends Error {
  constructor() { super('Respuesta no verificable.'); }
}

type ProjectedClaim = Record<string, unknown>;
type Span = { start: number; end: number; quote: string };

function locateSpan(text: string, claim: ProjectedClaim): Span {
  const span = claim.span as { quote?: string; occurrence?: number };
  if (!span || typeof span.quote !== 'string' || !span.quote ||
      !Number.isInteger(span.occurrence) || !span.occurrence || span.occurrence < 1) {
    throw new GuardRejected();
  }
  let from = 0;
  let start = -1;
  for (let i = 0; i < span.occurrence; i += 1) {
    start = text.indexOf(span.quote, from);
    if (start < 0) throw new GuardRejected();
    from = start + span.quote.length;
  }
  return { start, end: start + span.quote.length, quote: span.quote };
}

function samePeriod(a: unknown, b: unknown): boolean {
  if (a === null || b === null) return a === b;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const first = a as { from?: string; to?: string };
  const second = b as { from?: string; to?: string };
  return first.from === second.from && first.to === second.to;
}

function resultFor(id: unknown, results: ToolResult[]): ToolResult {
  const result = results.find((item) => item.tool_call_id === id);
  if (!result) throw new GuardRejected();
  return result;
}

function valueFor(id: unknown, path: unknown, results: ToolResult[]) {
  const result = resultFor(id, results);
  if (typeof path !== 'string' || !/^\/values\/(0|[1-9]\d*)$/.test(path)) {
    throw new GuardRejected();
  }
  const value = result.values.find((item) => item.path === path);
  if (!value || value.value === null) throw new GuardRejected();
  return { result, value };
}

function policyFor(value: ToolResult['values'][number]): 'exact' | 'round2' | 'round0' {
  if (value.unit === 'count') {
    return value.path_key === 'daily_average' || value.path_key === 'action_count'
      ? 'round2' : 'exact';
  }
  if (value.unit === 'money') {
    return value.metric === 'spend' && value.path_key !== 'difference' &&
      value.path_key !== 'daily_average' ? 'round0' : 'round2';
  }
  return 'round2';
}

function numericPart(span: Span): { text: string; percent: boolean; variation: boolean } {
  const candidates = findNumericCandidates(span.quote);
  if (candidates.length === 2 && candidates.some((item) => item.kind === 'multiplier') &&
      candidates.some((item) => item.kind === 'percent')) {
    const verb = candidates.find((item) => item.kind === 'multiplier')!.text
      .toLocaleLowerCase('es');
    const amount = candidates.find((item) => item.kind === 'percent')!.text;
    return { text: /^(?:bajó|cayó|disminuyó)/u.test(verb) ? `-${amount}` : amount,
      percent: true, variation: true };
  }
  if (candidates.length !== 1) throw new GuardRejected();
  const candidate = candidates[0];
  if (candidate.kind === 'digit' || candidate.kind === 'percent') {
    if (/\b(?:mil|millones?|M)\b/iu.test(span.quote)) throw new GuardRejected();
    return { text: candidate.text, percent: candidate.kind === 'percent', variation: false };
  }
  if (candidate.kind === 'number_word') {
    const integer = parseSpanishInteger(candidate.text);
    if (integer !== null) return { text: integer, percent: false, variation: false };
    if (/^(?:mitad|medio|media)$/iu.test(candidate.text)) {
      return { text: '50', percent: true, variation: true };
    }
  }
  if (candidate.kind === 'multiplier') {
    const phrase = candidate.text.toLocaleLowerCase('es');
    const change = /(?:triple|triplicó)/u.test(phrase) ? '200' :
      /(?:mitad)/u.test(phrase) ? '-50' :
      /(?:doble|duplicó)/u.test(phrase) ? '100' : null;
    if (change !== null) return { text: change, percent: true, variation: true };
  }
  throw new GuardRejected();
}

function checkObserved(claim: ProjectedClaim, span: Span, results: ToolResult[]): void {
  const { result, value } = valueFor(claim.tool_call_id, claim.path, results);
  const expected = {
    metric: value.metric, unit: value.unit, currency: value.currency,
    account_ref: result.account_ref, level: result.scope.level,
    entity_ref: value.entity_ref, action_type: value.action_type,
    attribution_ref: value.attribution_ref,
  };
  for (const [key, target] of Object.entries(expected)) {
    if (claim[key] !== target) throw new GuardRejected();
  }
  if (!samePeriod(claim.period, value.period) ||
      !samePeriod(claim.period_a, value.period_a) ||
      !samePeriod(claim.period_b, value.period_b)) throw new GuardRejected();
  const numeric = numericPart(span);
  if ((value.unit === 'percent') !== numeric.percent ||
      (numeric.variation && value.path_key !== 'change') ||
      (value.unit === 'percent' && !['ctr', 'share'].includes(value.metric) &&
        value.path_key !== 'change' && value.path_key !== 'segment_share')) {
    throw new GuardRejected();
  }
  const policy = policyFor(value);
  if (!decimalMatches(numeric.text, value.value!, policy) &&
      !(policy === 'round0' && decimalMatches(numeric.text, value.value!, 'round2'))) {
    throw new GuardRejected();
  }
}

function checkPeriodBound(claim: ProjectedClaim, span: Span, results: ToolResult[]): void {
  const result = resultFor(claim.tool_call_id, results);
  const bound = claim.bound;
  if (typeof bound !== 'string' ||
      !['from', 'to', 'a_from', 'a_to', 'b_from', 'b_to'].includes(bound)) {
    throw new GuardRejected();
  }
  const period = bound.startsWith('a_') ? result.scope.period_a :
    bound.startsWith('b_') ? result.scope.period_b : result.scope.period;
  const edge = bound.endsWith('from') ? 'from' : bound.endsWith('to') ? 'to' : null;
  if (!period || !edge) throw new GuardRejected();
  const iso = period[edge];
  const [year, month, day] = iso.split('-');
  if (span.quote !== iso && span.quote !== `${day}/${month}/${year}`) throw new GuardRejected();
}

function checkCoverage(claim: ProjectedClaim, span: Span, results: ToolResult[]): void {
  const result = resultFor(claim.tool_call_id, results);
  if (typeof claim.field !== 'string') throw new GuardRejected();
  const field = claim.field;
  const prefix = field.startsWith('a.') ? 'composition_a' :
    field.startsWith('b.') ? 'composition_b' : null;
  const key = prefix ? field.slice(2) : field;
  const composition = prefix ? result.extra[prefix] : result.composition;
  if (!composition || typeof composition !== 'object' ||
      !/^days_(total|with_value|metric_missing|no_row|not_observed|open|captured_partial)$/.test(key)) {
    throw new GuardRejected();
  }
  const expected = (composition as Record<string, unknown>)[key];
  if (typeof expected !== 'number' ||
      !decimalMatches(numericPart(span).text, String(expected), 'exact')) {
    throw new GuardRejected();
  }
}

function checkComparison(claim: ProjectedClaim, span: Span, results: ToolResult[]): void {
  const leftResolved = valueFor(claim.left_tool_call_id, claim.left_path, results);
  const rightResolved = valueFor(claim.right_tool_call_id, claim.right_path, results);
  const left = leftResolved.value;
  const right = rightResolved.value;
  if (leftResolved.result.account_ref !== rightResolved.result.account_ref) {
    throw new GuardRejected();
  }
  if (left.metric !== right.metric || left.unit !== right.unit ||
      left.currency !== right.currency || left.action_type !== right.action_type ||
      (left.entity_ref === right.entity_ref && left.attribution_ref !== right.attribution_ref &&
        left.attribution_ref !== 'unknown' && right.attribution_ref !== 'unknown')) {
    throw new GuardRejected();
  }
  const relation = compareDecimal(left.value!, right.value!);
  const named = relation > 0 ? 'greater' : relation < 0 ? 'less' : 'equal';
  if (claim.relation !== named ||
      (span.quote.toLocaleLowerCase('es').includes('más que') && named !== 'greater') ||
      (span.quote.toLocaleLowerCase('es').includes('menos que') && named !== 'less') ||
      (span.quote.toLocaleLowerCase('es').includes('igual que') && named !== 'equal')) {
    throw new GuardRejected();
  }
}

function checkUserProvided(span: Span, question: string): void {
  const claimed = numericPart(span);
  const exists = findNumericCandidates(question).some((candidate) =>
    candidate.kind === (claimed.percent ? 'percent' : 'digit') &&
    sameDisplayedDecimal(candidate.text, claimed.text));
  if (!exists) throw new GuardRejected();
}

const ROWS: Record<string, readonly string[]> = {
  tarjeta: ['day', 'total', 'daily_average', 'cost_per_result', 'share', 'a', 'b',
    'difference', 'change', 'entity', 'segment', 'segment_share', 'action_count',
    'action_value', 'list_count', 'excluded_count'],
  lineas: ['day'], barras: ['day', 'entity', 'segment'],
  barras_agrupadas: ['a', 'b', 'segment'], dona: ['segment'],
  tabla: ['day', 'total', 'daily_average', 'cost_per_result', 'share', 'a', 'b',
    'difference', 'change', 'entity', 'segment', 'segment_share', 'action_count',
    'action_value', 'list_count', 'excluded_count'],
  resumen_variacion: ['change'], periodo_contra_periodo: ['a', 'b', 'difference'],
  barras_apiladas: ['day'], ranking: ['entity'], tabla_tendencia: ['entity'],
  tabla_desplegable: ['entity'], embudo: ['total'], calendario_calor: ['day'],
  desglose_tipo_resultado: ['action_count', 'action_value'],
  estado_datos: [], fuentes_metodologia: [], preguntas_sugeridas: [], conclusiones: [],
};
const SOURCES: Record<string, readonly string[]> = {
  lineas: ['daily_series'], barras: ['daily_series', 'ranking', 'breakdown'],
  barras_agrupadas: ['compare_periods', 'breakdown'], dona: ['breakdown'],
  resumen_variacion: ['percent_change'], periodo_contra_periodo: ['compare_periods'],
  barras_apiladas: ['daily_series'], ranking: ['ranking'],
  tabla_tendencia: ['ranking'], tabla_desplegable: ['ranking'],
  embudo: ['total'], calendario_calor: ['daily_series'],
  desglose_tipo_resultado: ['action_types'],
  estado_datos: ['coverage', 'connection_status'],
};

function checkBlocks(blocks: Record<string, unknown>[], results: ToolResult[]): void {
  for (const block of blocks) {
    const type = String(block.type);
    const rows = ROWS[type];
    if (!rows) throw new GuardRejected();
    const sources = block.sources as { tool_call_id: string; path_prefix: string }[];
    if (type === 'tarjeta' && sources.length !== 1) throw new GuardRejected();
    if (type === 'lineas' && sources.length > 4) throw new GuardRejected();
    if (['conclusiones', 'preguntas_sugeridas'].includes(type) && sources.length) {
      throw new GuardRejected();
    }
    for (const source of sources) {
      const result = resultFor(source.tool_call_id, results);
      if (SOURCES[type] && (!result.tool_name ||
          !SOURCES[type].includes(result.tool_name))) throw new GuardRejected();
      if (type === 'barras_agrupadas' && result.tool_name === 'breakdown' &&
          !result.values.some((value) => value.segment_secondary !== null)) {
        throw new GuardRejected();
      }
      if (type === 'dona' && result.values.some((value) =>
        !['spend', 'impressions', 'clicks', 'inline_link_clicks', 'action_count',
          'action_value'].includes(value.metric) && value.path_key === 'segment')) {
        throw new GuardRejected();
      }
      if (type === 'dona') {
        const segments = result.values.filter((value) => value.path_key === 'segment' &&
          (source.path_prefix === '/values' || source.path_prefix === value.path));
        if (!segments.length || segments.some((segment) => !result.values.some((share) =>
          share.path_key === 'segment_share' && share.metric === 'share' &&
          share.unit === 'percent' && share.value !== null &&
          share.segment_primary === segment.segment_primary &&
          share.segment_secondary === segment.segment_secondary))) {
          throw new GuardRejected();
        }
      }
      if (type === 'estado_datos' || type === 'fuentes_metodologia') {
        if (source.path_prefix !== '/values') throw new GuardRejected();
        continue;
      }
      if (source.path_prefix === '/values') {
        if (type === 'tarjeta' || !result.values.some((value) =>
          rows.includes(value.path_key))) throw new GuardRejected();
      } else if (/^\/values\/(0|[1-9]\d*)$/.test(source.path_prefix)) {
        if (!result.values.some((value) => value.path === source.path_prefix &&
            rows.includes(value.path_key))) throw new GuardRejected();
      } else throw new GuardRejected();
    }
  }
}

function checkText(text: string, claims: ProjectedClaim[], turnResults: ToolResult[],
  redactedQuestion: string, markers: ReturnType<typeof modelMarkers>): void {
  for (const marker of text.matchAll(/⟦[^⟦⟧]+⟧/gu)) {
    if (!markers.has(marker[0])) throw new GuardRejected();
  }
  if (/[⟦⟧]/u.test(text.replace(/⟦[^⟦⟧]+⟧/gu, ''))) {
    throw new GuardRejected();
  }
  if (/(?:\bporque\b|\bdebido a\b|\bse debe a\b|\ba causa de\b|\bgracias a\b|\bROAS\b|\bestable\b|\brentab\p{L}*)/iu.test(
    text)) throw new GuardRejected();
  const spans = claims.map((claim) => locateSpan(text, claim));
  for (const candidate of findNumericCandidates(text)) {
    if (!spans.some((span) => span.start <= candidate.start && span.end >= candidate.end)) {
      throw new GuardRejected();
    }
  }
  claims.forEach((claim, index) => {
    const span = spans[index];
    switch (claim.kind) {
      case 'observed_value': checkObserved(claim, span, turnResults); break;
      case 'period_bound': checkPeriodBound(claim, span, turnResults); break;
      case 'coverage_count': checkCoverage(claim, span, turnResults); break;
      case 'qualitative_comparison': checkComparison(claim, span, turnResults); break;
      case 'user_provided': checkUserProvided(span, redactedQuestion); break;
      default: throw new GuardRejected();
    }
  });
}

/** Devuelve solo una respuesta cuya evidencia numérica y referencias se verificaron. */
export function validateAnswer(answer: FlatChatAnswer, turnResults: ToolResult[],
  redactedQuestion: string) {
  let projected: ReturnType<typeof projectOutput>;
  try { projected = projectOutput(answer); }
  catch (error) {
    if (error instanceof OutputProjectionError) throw new GuardRejected();
    throw error;
  }
  const markers = modelMarkers(turnResults);
  checkText(projected.text, projected.claims, turnResults, redactedQuestion, markers);
  for (const block of projected.blocks) {
    if (block.type !== 'conclusiones') continue;
    const items = block.items as { text: string; claims: ProjectedClaim[];
      provenance: 'system_fact' | 'calculated_metric' | 'inference' }[];
    for (const item of items) {
      checkText(item.text, item.claims, turnResults, redactedQuestion, markers);
      if (item.claims.length === 0) item.provenance = 'inference';
    }
  }
  checkBlocks(projected.blocks, turnResults);
  return projected;
}
