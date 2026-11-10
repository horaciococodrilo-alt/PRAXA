import { compareDecimal, parseSqlDecimal } from './decimal';
import { relativeToMax, shareOfTotal } from './scale';
import { modelMarkers, type ToolResult } from './tools/results';

export type Segment = Readonly<{ type: 'plain' | 'observed' | 'entity' | 'label' |
  'user_provided'; text: string }>;
export type BlockView = Readonly<{ type: string; title: string;
  series: { label: string; points: { x: string; text: string | null;
    ratio: number | null; absence: string | null }[] }[];
  table: { headers: string[]; rows: string[][] }; notes: string[];
  aria_label: string; items?: { segments: Segment[]; provenance: string }[];
  suggestions?: { id: string; text: string }[];
  children?: { parent: string; rows: string[][] }[]; stack_ratios?: number[] }>;
export type Footer = Readonly<{ account: string | null; period: string | null;
  defaulted: boolean; entity_defaulted: boolean; timezone: string | null;
  coverage: string | null; freshness: string | null;
  no_account_text: string | null; data_limits: string[] }>;
export type ChatTurnView = Readonly<{ kind: 'answer' | 'clarification' | 'abstention' | 'notice';
  record_id: string | null; can_vote: boolean; segments: Segment[];
  blocks: BlockView[]; footer: Footer | null; pending_clarification: string | null;
  retry_allowed: boolean; link_to_integrations: boolean }>;

export type RenderInput = Readonly<{ kind: ChatTurnView['kind'];
  answer?: { text: string; claims: Record<string, unknown>[];
    blocks: Record<string, unknown>[] }; text?: string; results: ToolResult[];
  accountRef: string | null; recordId: string | null; reason?: string;
  connectionStatus?: string | null }>;

const UNKNOWN = 'Meta no informa con qué atribución contó estos resultados: pueden mezclar ventanas distintas.';
const INCOMPATIBLE = 'No puedo sumar estos resultados: Meta los contó con configuraciones de atribución distintas. Puedo mostrarlos día por día.';
const MIXED = 'Estos resultados usan ventanas de atribución distintas: la comparación es orientativa.';
const BREAKDOWN = 'Los desgloses son estimados por Meta y no se reconcilian con los totales.';
const FAILED_BREAKDOWN = 'El último intento de actualizar este desglose falló: estos datos pueden estar desactualizados.';
const PARTIAL = 'Algunas filas no tienen datos todos los días del período: sus totales son parciales.';

const FIXED: Record<string, string> = {
  guard_rejected: 'No pude verificar esta respuesta, así que prefiero no mostrarla. Probá reformulando la pregunta.',
  tool_error: 'No pude leer tus datos. Probá de nuevo.',
  model_unavailable: 'El asistente no está disponible. Tu pregunta sigue en el cuadro: probá de nuevo.',
  out_of_scope: 'Eso no lo puedo responder con estos datos. Puedo mostrarte gasto, impresiones, clics y resultados de tus campañas, por día o por período, y desgloses por edad, género o lugar.',
  connection_not_active: 'Todavía no hay una cuenta conectada.',
  record_failed: 'No pudimos completar la consulta. Probá de nuevo.',
  connection_changed: 'La conexión cambió mientras respondíamos.',
  chat_turn_in_progress: 'Ya hay una consulta en curso.',
  invalid_input: 'No pudimos procesar la consulta.',
  no_coverage: 'No tengo datos de ese período.',
};
const TITLES: Record<string, string> = {
  tarjeta: 'Dato', lineas: 'Evolución diaria', barras: 'Barras',
  barras_agrupadas: 'Comparación', dona: 'Participación', tabla: 'Datos',
};
const ROWS: Record<string, readonly string[]> = {
  lineas: ['day'], barras: ['day', 'entity', 'segment'],
  barras_agrupadas: ['a', 'b', 'segment'], dona: ['segment'],
  ranking: ['entity'], tabla_tendencia: ['entity'],
  tabla_desplegable: ['entity'],
};

function dateDisplay(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function maskedAccount(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith('…')) return `…${value.slice(-4)}`;
  return `…${value.slice(-4)}`;
}

function unique(items: string[]): string[] { return [...new Set(items)]; }

function scopePhrase(result: ToolResult): string {
  const level = result.scope.level;
  if (result.tool_name === 'breakdown') {
    const dimension = result.extra.dimension;
    const part = dimension === 'age_gender' ? 'de edad y género' :
      dimension === 'country' ? 'de los países' :
        dimension === 'region' ? 'de las regiones' : null;
    if (part) return level === 'campaign' ? `${part} por campaña` : part;
  }
  return level === 'account' ? 'de la cuenta' : level === 'campaign' ?
    'de las campañas' : level === 'adset' ? 'de los conjuntos' :
      level === 'ad' ? 'de los anuncios' : 'de la cuenta';
}

function segments(text: string, claims: Record<string, unknown>[],
  results: ToolResult[]): Segment[] {
  const markers = modelMarkers(results);
  const tokens: { start: number; end: number; type: Segment['type']; text: string }[] = [];
  for (const match of text.matchAll(/⟦[^⟦⟧]+⟧/gu)) {
    const item = markers.get(match[0]);
    if (!item) continue;
    tokens.push({ start: match.index, end: match.index + match[0].length,
      type: item.kind === 'ENTIDAD' ? 'entity' : 'label', text: item.text });
  }
  for (const claim of claims) {
    const span = claim.span as { quote: string; occurrence: number };
    let start = -1;
    let cursor = 0;
    for (let index = 0; index < span.occurrence; index += 1) {
      start = text.indexOf(span.quote, cursor);
      cursor = start + span.quote.length;
    }
    if (start < 0) continue;
    tokens.push({ start, end: start + span.quote.length,
      type: claim.kind === 'user_provided' ? 'user_provided' : 'observed',
      text: claim.kind === 'user_provided' ?
        `${span.quote} (según lo que mencionaste)` : span.quote });
  }
  tokens.sort((a, b) => a.start - b.start || b.end - a.end);
  const parts: Segment[] = [];
  let offset = 0;
  for (const token of tokens) {
    if (token.start < offset) continue;
    if (offset < token.start) parts.push({ type: 'plain', text: text.slice(offset, token.start) });
    parts.push({ type: token.type, text: token.text });
    offset = token.end;
  }
  if (offset < text.length) parts.push({ type: 'plain', text: text.slice(offset) });
  return parts;
}

function citedResults(input: RenderInput): ToolResult[] {
  const ids = new Set<string>();
  for (const claim of input.answer?.claims ?? []) {
    for (const key of ['tool_call_id', 'left_tool_call_id', 'right_tool_call_id']) {
      if (typeof claim[key] === 'string') ids.add(claim[key]);
    }
  }
  for (const block of input.answer?.blocks ?? []) {
    for (const source of (block.sources ?? []) as { tool_call_id: string }[]) {
      ids.add(source.tool_call_id);
    }
  }
  return ids.size ? input.results.filter((result) => ids.has(result.tool_call_id)) : input.results;
}

function formatComposition(result: ToolResult): string | null {
  const comp = result.composition;
  if (!comp) return null;
  return `${comp.days_with_value} de ${comp.days_total} días con valor` +
    (comp.partial ? ' (parcial)' : '');
}

function extraComposition(value: unknown): { days_with_value: number;
  days_total: number; partial: boolean; observed_from?: string | null;
  observed_to?: string | null } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  return typeof object.days_with_value === 'number' &&
    typeof object.days_total === 'number' && typeof object.partial === 'boolean' ?
      object as { days_with_value: number; days_total: number; partial: boolean;
        observed_from?: string | null; observed_to?: string | null } : null;
}

function dataLimits(results: ToolResult[], claims: Record<string, unknown>[],
  blocks: Record<string, unknown>[]): string[] {
  const warnings: string[] = [];
  const usedPaths = new Set(claims.filter((claim) => claim.kind === 'observed_value')
    .map((claim) => `${claim.tool_call_id}:${claim.path}`));
  for (const block of blocks) {
    for (const source of (block.sources ?? []) as { tool_call_id: string; path_prefix: string }[]) {
      const result = results.find((item) => item.tool_call_id === source.tool_call_id);
      if (!result) continue;
      for (const value of result.values) {
        if (source.path_prefix === '/values' || source.path_prefix === value.path) {
          usedPaths.add(`${result.tool_call_id}:${value.path}`);
        }
      }
    }
  }
  if (results.some((result) => result.values.some((value) =>
    value.attribution_ref === 'unknown' &&
    usedPaths.has(`${result.tool_call_id}:${value.path}`)))) warnings.push(UNKNOWN);
  if (results.some((result) => result.reason === 'attribution_incompatible')) {
    warnings.push(INCOMPATIBLE);
  }
  if (results.some((result) => result.extra.attribution_mixed === true)) warnings.push(MIXED);
  for (const claim of claims) {
    if (claim.kind !== 'qualitative_comparison') continue;
    const left = results.find((result) => result.tool_call_id === claim.left_tool_call_id)
      ?.values.find((value) => value.path === claim.left_path);
    const right = results.find((result) => result.tool_call_id === claim.right_tool_call_id)
      ?.values.find((value) => value.path === claim.right_path);
    if (left && right && left.entity_ref !== right.entity_ref &&
        left.attribution_ref && right.attribution_ref &&
        left.attribution_ref !== 'unknown' && right.attribution_ref !== 'unknown' &&
        left.attribution_ref !== right.attribution_ref) warnings.push(MIXED);
  }
  if (results.some((result) => result.tool_name === 'breakdown')) {
    warnings.push(BREAKDOWN);
    const failed = results.some((result) => result.tool_name === 'breakdown' &&
      typeof result.extra.last_result === 'object' && result.extra.last_result !== null &&
      'result' in result.extra.last_result && result.extra.last_result.result === 'failed');
    if (failed) warnings.push(FAILED_BREAKDOWN);
  }
  for (const result of results) {
    if (result.tool_name === 'daily_average' && result.composition) {
      warnings.push(`Promedio sobre ${result.composition.days_with_value} de ${result.composition.days_total} días con dato.`);
    }
  }
  if (results.some((result) => result.values.some((value) =>
    value.composition?.partial === true))) warnings.push(PARTIAL);
  for (const result of results) {
    const pairs = [[result.scope.period, result.composition],
      [result.scope.period_a, extraComposition(result.extra.composition_a)],
      [result.scope.period_b, extraComposition(result.extra.composition_b)]] as const;
    for (const [period, comp] of pairs) {
      if (!period || !comp) continue;
      const observedFrom = 'observed_from' in comp ? comp.observed_from : null;
      const observedTo = 'observed_to' in comp ? comp.observed_to : null;
      const scope = scopePhrase(result);
      if (typeof observedFrom === 'string' && observedFrom > period.from) {
        warnings.push(`${scope}, tengo datos desde el ${dateDisplay(observedFrom)}.`);
      }
      if (typeof observedTo === 'string' && observedTo < period.to) {
        warnings.push(`${scope}, tengo datos hasta el ${dateDisplay(observedTo)}.`);
      }
    }
  }
  return unique(warnings);
}

function footer(input: RenderInput): Footer | null {
  if (input.kind === 'notice' || (input.reason === 'connection_not_active' &&
      input.connectionStatus !== 'needs_reauth')) return null;
  const account = maskedAccount(input.accountRef ?? input.results[0]?.account_ref ?? null);
  if (!account) return null;
  const full = input.kind === 'answer';
  const selected = full ? citedResults(input) : [];
  const periods: string[] = [];
  const coverage: string[] = [];
  const fetched: string[] = [];
  for (const result of selected) {
    for (const p of [result.scope.period, result.scope.period_a, result.scope.period_b]) {
      if (p) periods.push(`${dateDisplay(p.from)} al ${dateDisplay(p.to)}`);
    }
    const comp = formatComposition(result);
    if (comp && result.scope.period) coverage.push(`${dateDisplay(result.scope.period.from)}: ${comp}`);
    for (const [key, p] of [['composition_a', result.scope.period_a],
      ['composition_b', result.scope.period_b]] as const) {
      const part = extraComposition(result.extra[key]);
      if (part && p) coverage.push(`${dateDisplay(p.from)}: ` +
        `${part.days_with_value} de ${part.days_total} días con valor` +
        (part.partial ? ' (parcial)' : ''));
    }
    if (result.composition?.fetched_at_min) fetched.push(result.composition.fetched_at_min);
    if (result.composition?.fetched_at_max) fetched.push(result.composition.fetched_at_max);
    if (typeof result.extra.last_finished_at === 'string') {
      fetched.push(result.extra.last_finished_at);
    }
  }
  const limits = full ? dataLimits(selected, input.answer?.claims ?? [],
    input.answer?.blocks ?? []) : [];
  const defaulted = selected.some((result) => result.scope.period_defaulted);
  const entityDefaulted = selected.some((result) => result.scope.entity_defaulted);
  let coverageText = coverage.length ? unique(coverage).join('; ') : null;
  if (entityDefaulted) coverageText = coverageText ?
    `${coverageText}; toda la cuenta` : 'toda la cuenta';
  fetched.sort();
  return { account, period: periods.length ? unique(periods).join('; ') : null,
    defaulted, entity_defaulted: entityDefaulted,
    timezone: periods.length ? selected.find((result) => result.scope.timezone)?.scope.timezone ?? null : null,
    coverage: coverageText,
    freshness: fetched.length ? fetched.length === 1 ? fetched[0] :
      `${fetched[0]} a ${fetched.at(-1)}` : null,
    no_account_text: null, data_limits: limits };
}

function rowLabel(value: ToolResult['values'][number]): string {
  if (value.day) return dateDisplay(value.day);
  return value.entity_name ?? value.segment_primary ?? value.action_type ?? value.path_key;
}
function rowText(value: ToolResult['values'][number]): string {
  if (value.value === null) return value.absence === 'sin_fila_reportada' ?
    'Sin fila reportada' : value.absence === 'no_observado' ? 'No observado' :
      value.absence === 'no_informado' ? 'No informado' : 'No calculable';
  const partial = value.composition?.partial ?
    ` (parcial: ${value.composition.days_with_value} de ${value.composition.days_total} días)` : '';
  return value.value + partial;
}
function addDecimals(values: string[]): string {
  const parsed = values.map((value) => parseSqlDecimal(value));
  if (parsed.some((value) => value === null)) throw new Error('Decimal inválido.');
  const decimals = parsed.filter((value): value is NonNullable<typeof value> => value !== null);
  const scale = Math.max(0, ...decimals.map((value) => value.scale));
  const sum = decimals.reduce((total, value) => total +
    value.coefficient * BigInt(10) ** BigInt(scale - value.scale), BigInt(0));
  const digits = (sum < BigInt(0) ? -sum : sum).toString().padStart(scale + 1, '0');
  return `${sum < BigInt(0) ? '-' : ''}${scale ?
    `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits}`;
}

function selectedValues(block: Record<string, unknown>, result: ToolResult) {
  const sources = block.sources as { tool_call_id: string; path_prefix: string }[];
  const paths = sources.filter((source) => source.tool_call_id === result.tool_call_id)
    .map((source) => source.path_prefix);
  const allowed = ROWS[String(block.type)];
  return result.values.filter((value) => (paths.includes('/values') || paths.includes(value.path)) &&
    (!allowed || allowed.includes(value.path_key)));
}

function noCoverageText(results: ToolResult[]): string {
  const periods = results.flatMap((result) => [result.scope.period, result.scope.period_a,
    result.scope.period_b]).filter((period): period is NonNullable<typeof period> => !!period);
  const uniquePeriods = unique(periods.map((period) => `${period.from}:${period.to}`));
  const first = results.find((result) => result.scope.level !== null &&
    (result.scope.period || result.scope.period_a));
  const scope = first ? scopePhrase(first) : 'de la cuenta';
  const scopes = new Set(results.filter((result) => result.scope.level !== null &&
    (result.scope.period || result.scope.period_a)).map((result) =>
    `${result.scope.level}:${result.tool_name === 'breakdown' ?
      String(result.extra.dimension ?? '') : ''}`));
  const manyScopes = scopes.size > 1;
  if (uniquePeriods.length > 1) {
    const historyFrom = first?.extra.history_from;
    const historyTo = first?.extra.history_to;
    if (manyScopes || first?.extra.coverage_lookup_failed) return 'No tengo datos de esos períodos.';
    return 'No tengo datos de esos períodos. ' +
      (typeof historyFrom === 'string' && typeof historyTo === 'string' ?
        `${scope}, mis datos van del ${dateDisplay(historyFrom)} al ${dateDisplay(historyTo)}.` :
        `Todavía no tengo datos ${scope}.`);
  }
  const period = periods[0];
  if (!period) return 'No tengo datos de ese período.';
  const before = first?.extra.nearest_before;
  const after = first?.extra.nearest_after;
  const head = `No tengo datos del ${dateDisplay(period.from)} al ${dateDisplay(period.to)}.`;
  if (manyScopes || first?.extra.coverage_lookup_failed) return head;
  if (typeof before === 'string' && typeof after === 'string') {
    return `${head} ${scope}, tengo datos hasta el ${dateDisplay(before)} y de nuevo desde el ${dateDisplay(after)}.`;
  }
  if (typeof before === 'string') return `${head} ${scope}, tengo datos hasta el ${dateDisplay(before)}.`;
  if (typeof after === 'string') return `${head} ${scope}, tengo datos desde el ${dateDisplay(after)}.`;
  return `${head} Todavía no tengo datos ${scope}.`;
}

function renderBlock(block: Record<string, unknown>, results: ToolResult[]): BlockView {
  const type = String(block.type);
  const sources = block.sources as { tool_call_id: string; path_prefix: string }[];
  const selected = sources.map((source) => results.find((item) =>
    item.tool_call_id === source.tool_call_id)).filter((item): item is ToolResult => !!item);
  let values = selected.flatMap((result) => selectedValues(block, result));
  let donutShares: string[] = [];
  if (type === 'dona') {
    values = values.filter((value) => value.path_key === 'segment' && value.value !== null)
      .sort((a, b) => compareDecimal(b.value!, a.value!));
    donutShares = values.map((segment) => {
      const parent = selected.find((result) => result.tool_call_id === segment.tool_call_id);
      const share = parent?.values.find((value) => value.path_key === 'segment_share' &&
        value.segment_primary === segment.segment_primary &&
        value.segment_secondary === segment.segment_secondary);
      if (share?.value === null || share?.value === undefined) {
        throw new Error('Participación no disponible.');
      }
      return share.value;
    });
    if (values.length > 5) {
      const other = values.slice(5);
      values = [...values.slice(0, 5), { ...other[0], segment_primary: 'Otros',
        segment_secondary: null, value: addDecimals(other.map((value) => value.value!)) }];
      donutShares = [...donutShares.slice(0, 5), addDecimals(donutShares.slice(5))];
    }
  }
  const ratios = type === 'dona' ? shareOfTotal(donutShares) :
    relativeToMax(values.map((value) => value.value));
  const points = values.map((value, index) => ({ x: rowLabel(value),
    text: value.value, ratio: ratios[index], absence: value.absence }));
  const rows = values.map((value, index) => type === 'dona' ?
    [rowLabel(value), rowText(value), `${donutShares[index]}%`] :
    [rowLabel(value), rowText(value)]);
  const notes = dataLimits(selected, [], [block]);
  return { type, title: TITLES[type] ?? 'Datos',
    series: [{ label: type === 'dona' ? 'Participación' : 'Valores', points }],
    table: { headers: type === 'dona' ? ['Elemento', 'Valor', 'Participación'] :
      ['Elemento', 'Valor'], rows }, notes,
    aria_label: `${TITLES[type] ?? 'Datos'}: ${rows.length} filas` };
}

export function renderTurn(input: RenderInput): ChatTurnView {
  const reason = input.reason ?? '';
  const text = input.kind === 'answer' ? input.answer?.text ?? '' :
    input.kind === 'clarification' ? input.text ?? '' :
      reason === 'connection_not_active' && input.connectionStatus === 'needs_reauth' ?
        'Meta pidió volver a autorizar a Praxa.' : reason === 'no_coverage' ?
          noCoverageText(input.results) : FIXED[reason] ?? 'No pudimos procesar la consulta.';
  const blocks = input.kind === 'answer' ? (input.answer?.blocks ?? []).map((block) =>
    renderBlock(block, input.results)) : [];
  const visibleSegments = input.kind === 'answer' ?
    segments(text, input.answer?.claims ?? [], input.results) :
    input.kind === 'clarification' ? segments(text, [], input.results) :
      [{ type: 'plain' as const, text }];
  const recordId = input.kind === 'notice' ? null : input.recordId;
  return { kind: input.kind, record_id: recordId,
    can_vote: recordId !== null,
    segments: visibleSegments, blocks, footer: footer(input),
    pending_clarification: input.kind === 'clarification' ?
      visibleSegments.map((segment) => segment.text).join('') : null,
    retry_allowed: ['model_unavailable', 'tool_error', 'record_failed'].includes(reason),
    link_to_integrations: reason === 'connection_not_active' };
}
