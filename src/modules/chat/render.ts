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
  answer?: { text: string; blocks: Record<string, unknown>[] }; text?: string; results: ToolResult[];
  accountRef: string | null; recordId: string | null; reason?: string;
  connectionStatus?: string | null }>;

const UNKNOWN = 'Meta no informa con qué atribución contó estos resultados: pueden mezclar ventanas distintas.';
const INCOMPATIBLE = 'No puedo sumar estos resultados: Meta los contó con configuraciones de atribución distintas. Puedo mostrarlos día por día.';
const MIXED = 'Estos resultados usan ventanas de atribución distintas: la comparación es orientativa.';
const BREAKDOWN = 'Los desgloses son estimados por Meta y no se reconcilian con los totales.';
const FAILED_BREAKDOWN = 'El último intento de actualizar este desglose falló: estos datos pueden estar desactualizados.';
const OPINION = 'El texto es una lectura del asistente y no está verificado; los números y gráficos salen de tus datos.';
const PARTIAL = 'Algunas filas no tienen datos todos los días del período: sus totales son parciales.';

const FIXED: Record<string, string> = {
  guard_rejected: 'No pude verificar esta respuesta, así que prefiero no mostrarla. Probá reformulando la pregunta.',
  tool_error: 'No pude leer tus datos. Probá de nuevo.',
  model_unavailable: 'El asistente no está disponible. Tu pregunta sigue en el cuadro: probá de nuevo.',
  out_of_scope: 'Con eso no te puedo ayudar: PRAXA solo lee tus datos de Meta y no responde temas ajenos a tu publicidad. Sí puedo mostrarte y comentar cómo van tus campañas: gasto, impresiones, clics y resultados, por día o período, y desgloses por edad, género o lugar.',
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
  resumen_variacion: 'Variación', periodo_contra_periodo: 'Períodos comparados',
  barras_apiladas: 'Barras apiladas', ranking: 'Ranking',
  tabla_tendencia: 'Tendencia del ranking', tabla_desplegable: 'Detalle por nivel',
  embudo: 'Embudo', calendario_calor: 'Calendario de datos',
  desglose_tipo_resultado: 'Tipos de resultado', estado_datos: 'Estado de los datos',
  conclusiones: 'Conclusiones', fuentes_metodologia: 'Fuentes y metodología',
  preguntas_sugeridas: 'Preguntas sugeridas',
};
const ROWS: Record<string, readonly string[]> = {
  lineas: ['day'], barras: ['day', 'entity', 'segment'],
  barras_agrupadas: ['a', 'b', 'segment'], dona: ['segment'],
  ranking: ['entity'], tabla_tendencia: ['entity'],
  tabla_desplegable: ['entity'],
  resumen_variacion: ['change'], periodo_contra_periodo: ['a', 'b', 'difference'],
  barras_apiladas: ['day'], embudo: ['total'], calendario_calor: ['day'],
  desglose_tipo_resultado: ['action_count', 'action_value'],
  estado_datos: [], fuentes_metodologia: [], conclusiones: [],
  preguntas_sugeridas: [],
};
const SUGGESTIONS: Record<string, string> = {
  ver_por_conjunto: 'Ver por conjunto', comparar_periodo_anterior: 'Comparar con el período anterior',
  ver_en_tabla: 'Ver en tabla', ver_por_edad_y_genero: 'Ver por edad y género',
  ver_por_pais: 'Ver por país', ver_estado_de_los_datos: 'Ver estado de los datos',
};
const TOOL_LABELS: Record<string, string> = {
  entities: 'Entidades', action_types: 'Tipos de resultado', coverage: 'Cobertura',
  daily_series: 'Serie diaria', total: 'Total',
  connection_status: 'Estado de conexión', compare_periods: 'Comparación de períodos',
  daily_average: 'Promedio diario', ranking: 'Ranking',
  cost_per_result: 'Costo por resultado', share: 'Participación',
  percent_change: 'Variación porcentual', breakdown: 'Desglose',
};
const METRIC_METHODS: Record<string, string> = {
  ctr: 'CTR = 100 × clics / impresiones; solo días con ambas bases informadas.',
  cpc: 'CPC = gasto / clics; solo días con ambas bases informadas.',
  cpm: 'CPM = 1000 × gasto / impresiones; solo días con ambas bases informadas.',
  cost_per_result: 'Costo por resultado = gasto informado / resultados informados.',
  share: 'Participación = 100 × parte informada / total informado del padre.',
  daily_average: 'Promedio diario = total informado / días con valor.',
  change: 'Variación = 100 × (período B − período A) / período A.',
};

const METRIC_LABELS: Record<string, string> = {
  spend: 'Gasto', impressions: 'Impresiones', reach: 'Alcance', clicks: 'Clics',
  inline_link_clicks: 'Clics en enlaces', ctr: 'CTR', cpc: 'CPC', cpm: 'CPM',
  frequency: 'Frecuencia', action_count: 'Resultados', action_value: 'Valor de resultados',
};

function metricLabel(value: ToolResult['values'][number]): string {
  const base = METRIC_LABELS[value.metric] ?? value.metric;
  return value.action_type ? `${base} (${value.action_type})` : base;
}

function freshnessDisplay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]} UTC` : iso;
}

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

function segments(text: string, results: ToolResult[]): Segment[] {
  const markers = modelMarkers(results);
  const tokens: { start: number; end: number; type: Segment['type']; text: string }[] = [];
  for (const match of text.matchAll(/⟦[^⟦⟧]+⟧/gu)) {
    const item = markers.get(match[0]);
    if (!item) continue;
    tokens.push({ start: match.index, end: match.index + match[0].length,
      type: item.kind === 'ENTIDAD' ? 'entity' : 'label', text: item.text });
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

function dataLimits(results: ToolResult[], blocks: Record<string, unknown>[]): string[] {
  const warnings: string[] = [];
  const usedPaths = new Set<string>();
  for (const block of blocks) {
    const blockValues: ToolResult['values'] = [];
    for (const source of (block.sources ?? []) as { tool_call_id: string; path_prefix: string }[]) {
      const result = results.find((item) => item.tool_call_id === source.tool_call_id);
      if (!result) continue;
      for (const value of result.values) {
        if (source.path_prefix === '/values' || source.path_prefix === value.path) {
          usedPaths.add(`${result.tool_call_id}:${value.path}`);
          blockValues.push(value);
        }
      }
    }
    const known = blockValues.filter((value) => value.entity_ref &&
      value.attribution_ref && value.attribution_ref !== 'unknown');
    if (known.some((left) => known.some((right) =>
      left.entity_ref !== right.entity_ref &&
      left.attribution_ref !== right.attribution_ref))) warnings.push(MIXED);
  }
  if (results.some((result) => result.values.some((value) =>
    value.attribution_ref === 'unknown' &&
    usedPaths.has(`${result.tool_call_id}:${value.path}`)))) warnings.push(UNKNOWN);
  if (results.some((result) => result.reason === 'attribution_incompatible')) {
    warnings.push(INCOMPATIBLE);
  }
  if (results.some((result) => result.extra.attribution_mixed === true)) warnings.push(MIXED);
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
  const limits = full ? [...dataLimits(selected, input.answer?.blocks ?? []),
    ...(input.answer?.text.trim() ? [OPINION] : [])] : [];
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
    freshness: fetched.length ? fetched.length === 1 ? freshnessDisplay(fetched[0]) :
      `${freshnessDisplay(fetched[0])} a ${freshnessDisplay(fetched.at(-1)!)}` : null,
    no_account_text: null, data_limits: limits };
}

function rowLabel(value: ToolResult['values'][number]): string {
  if (value.day) return dateDisplay(value.day);
  if (value.path_key === 'entity') return value.entity_name ?? 'Entidad';
  if (value.path_key === 'segment' || value.path_key === 'segment_share') {
    return [value.segment_primary, value.segment_secondary].filter(Boolean).join(' · ') || 'Segmento';
  }
  if (value.path_key === 'action_count' || value.path_key === 'action_value') {
    return `${value.action_type ?? 'Acción'} · ${value.path_key === 'action_count' ?
      'Cantidad' : 'Valor'}`;
  }
  if (value.path_key === 'a') return 'Período A';
  if (value.path_key === 'b') return 'Período B';
  if (value.path_key === 'difference') return 'Diferencia';
  if (value.path_key === 'total') return metricLabel(value);
  return value.entity_name ?? value.path_key;
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
  const queried = results.filter((result) => result.status !== 'not_found' &&
    !['entities', 'connection_status'].includes(result.tool_name ?? ''));
  const periods = queried.flatMap((result) => [result.scope.period, result.scope.period_a,
    result.scope.period_b]).filter((period): period is NonNullable<typeof period> => !!period);
  const uniquePeriods = unique(periods.map((period) => `${period.from}:${period.to}`));
  const first = queried.find((result) => result.scope.level !== null &&
    (result.scope.period || result.scope.period_a));
  const scope = first ? scopePhrase(first) : 'de la cuenta';
  const scopes = new Set(queried.filter((result) => result.scope.level !== null &&
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
  const selected = [...new Set(sources.map((source) => results.find((item) =>
    item.tool_call_id === source.tool_call_id)).filter((item): item is ToolResult => !!item))];
  const title = TITLES[type] ?? 'Datos';
  if (type === 'conclusiones') {
    const rawItems = block.items as { text: string }[];
    const items = rawItems.map((item) => ({
      segments: segments(item.text, results), provenance: 'Interpretación',
    }));
    return { type, title, items, series: [], table: { headers: ['Conclusión', 'Procedencia'],
      rows: items.map((item) => [item.segments.map((part) => part.text).join(''),
        item.provenance]) }, notes: [], aria_label: title };
  }
  if (type === 'preguntas_sugeridas') {
    const suggestions = (block.ids as string[]).map((id) => ({
      id, text: SUGGESTIONS[id] })).filter((item) => item.text);
    return { type, title, suggestions, series: [],
      table: { headers: ['Pregunta'], rows: suggestions.map((item) => [item.text]) },
      notes: [], aria_label: title };
  }
  if (type === 'estado_datos' || type === 'fuentes_metodologia') {
    const rows = selected.flatMap((result) => {
      if (type === 'fuentes_metodologia') return [[TOOL_LABELS[result.tool_name ?? ''] ?? 'Consulta',
        result.composition?.fetched_at_max ?
          dateDisplay(result.composition.fetched_at_max) : 'Sin fecha de captura']];
      const history = ['history_from', 'history_to'].flatMap((key) =>
        typeof result.extra[key] === 'string' ?
          [[key === 'history_from' ? 'Desde' : 'Hasta',
            dateDisplay(result.extra[key] as string)]] : []);
      const connection = result.tool_name === 'connection_status' ? [
        ...(typeof result.extra.connection_status === 'string' ?
          [['Conexión', result.extra.connection_status === 'active' ? 'Activa' :
            'Requiere atención']] : []),
        ...(typeof result.extra.last_finished_at === 'string' ?
          [['Última sincronización', dateDisplay(result.extra.last_finished_at)]] : []),
      ] : [];
      return [...history, ...connection, ...(result.composition ?
        [['Cobertura', `${result.composition.days_with_value} de ${result.composition.days_total} días con valor`]] : [])];
    });
    if (type === 'fuentes_metodologia') {
      const methods = unique(selected.flatMap((result) => result.values.flatMap((value) =>
        [value.metric, value.path_key].map((key) => METRIC_METHODS[key]).filter(
          (method): method is string => !!method))));
      rows.push(...methods.map((method) => ['Cálculo', method]));
    }
    return { type, title, series: [], table: { headers: ['Dato', 'Detalle'], rows },
      notes: dataLimits(selected, [block]), aria_label: title };
  }
  if (type === 'barras_apiladas') {
    const dayRows = selected.map((result) => selectedValues(block, result)
      .filter((value) => value.path_key === 'day'));
    const reference = dayRows.flat()[0];
    const entities = dayRows.map((rows, index) =>
      selected[index].scope.entity_ref ?? rows[0]?.entity_ref ?? null);
    const samePeriod = (a: ToolResult['scope']['period'], b: ToolResult['scope']['period']) =>
      a?.from === b?.from && a?.to === b?.to;
    const stackable = !!reference && selected.length >= 2 &&
      ['spend', 'impressions', 'clicks', 'inline_link_clicks', 'action_count',
        'action_value'].includes(reference.metric) &&
      new Set(entities).size === entities.length && !entities.includes(null) &&
      selected.every((result, index) => result.tool_name === 'daily_series' &&
        dayRows[index].length > 0 && result.account_ref === selected[0].account_ref &&
        result.scope.level === selected[0].scope.level &&
        samePeriod(result.scope.period, selected[0].scope.period)) &&
      dayRows.flat().every((value) => value.metric === reference.metric &&
        value.unit === reference.unit && value.currency === reference.currency &&
        value.action_type === reference.action_type &&
        (value.attribution_ref === reference.attribution_ref ||
          value.attribution_ref === 'unknown' || reference.attribution_ref === 'unknown'));
    if (!stackable) throw new Error('Las series no se pueden apilar.');
    const days = [...new Set(dayRows.flatMap((rows) => rows
      .filter((value) => value.day).map((value) => value.day!)))].sort();
    const bySeries = dayRows.map((rows) => days.map((day) => rows.find((value) =>
      value.day === day)));
    const totals = days.map((_, index) => {
      const present = bySeries.map((series) => series[index]?.value ?? null)
        .filter((value): value is string => value !== null);
      return present.length ? addDecimals(present) : null;
    });
    const ratios = relativeToMax(totals);
    const dayShares = days.map((_, index) => shareOfTotal(bySeries.map((item) =>
      item[index]?.value ?? null)));
    const series = selected.map((result, seriesIndex) => ({
      label: result.scope.entity_name ?? result.values[0]?.entity_name ?? 'Entidad',
      points: days.map((day, index) => ({ x: dateDisplay(day),
        text: bySeries[seriesIndex][index]?.value ?? null,
        ratio: dayShares[index][seriesIndex],
        absence: bySeries[seriesIndex][index]?.absence ?? 'sin_fila_reportada' })),
    }));
    const rows = days.map((day, index) => [dateDisplay(day),
      ...bySeries.map((item) => item[index] ? rowText(item[index]!) : 'Sin fila reportada'),
      totals[index] ?? 'No observado']);
    return { type, title, series, stack_ratios: ratios.map((ratio) => ratio ?? 0),
      table: { headers: ['Día', ...series.map((item) => item.label), 'Total'], rows },
      notes: dataLimits(selected, [block]), aria_label: `${title}: ${rows.length} días` };
  }
  let values = selected.flatMap((result) => selectedValues(block, result));
  if (type === 'tabla_tendencia') {
    const ranked = selected[0];
    const rawTrends = ranked.extra.trends;
    const hasTrends = !!rawTrends && typeof rawTrends === 'object' && !Array.isArray(rawTrends);
    const trends = (hasTrends ? rawTrends : {}) as Record<string, {
      day: string; value: string | null; absence: string | null }[]>;
    const series = values.map((value) => {
      const days = trends[value.entity_ref!] ?? [];
      const ratios = relativeToMax(days.map((day) => day.value));
      return { label: rowLabel(value), points: days.map((day, index) => ({
        x: dateDisplay(day.day), text: day.value,
        ratio: ratios[index], absence: day.absence })) };
    });
    const excluded = ranked.values.find((value) => value.path_key === 'excluded_count');
    return { type, title, series, table: { headers: ['Entidad', 'Valor'],
      rows: values.map((value) => [rowLabel(value), rowText(value)]) },
    notes: [...dataLimits(selected, [block]), ...(hasTrends ? [] :
      ['No hay tendencia disponible para esta consulta: se muestra solo el ranking.']),
    ...(excluded?.value ?
      [`${excluded.value} entidades excluidas por falta de datos.`] : [])],
    aria_label: `${title}: ${values.length} entidades` };
  }
  let children: BlockView['children'];
  if (type === 'tabla_desplegable') {
    const parentResult = selected[0];
    const childResult = selected[1];
    const parents = selectedValues(block, parentResult);
    const childValues = selectedValues(block, childResult);
    children = parents.filter((parent) => childValues.some((child) =>
      child.parent_ref === parent.entity_ref)).map((parent) => ({
        parent: rowLabel(parent), rows: childValues.filter((child) =>
          child.parent_ref === parent.entity_ref).map((child) =>
          [rowLabel(child), rowText(child)]) }));
    values = parents;
  }
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
  const notes = dataLimits(selected, [block]);
  if (type === 'embudo') notes.push('Los pasos son conteos separados; no son tasas de paso.');
  if (type === 'periodo_contra_periodo' && selected[0]?.scope.period_a &&
      selected[0]?.scope.period_b) {
    const a = selected[0].scope.period_a;
    const b = selected[0].scope.period_b;
    const lengthA = Date.parse(a.to) - Date.parse(a.from);
    const lengthB = Date.parse(b.to) - Date.parse(b.from);
    if (lengthA !== lengthB) notes.push('Los períodos tienen distinta duración.');
  }
  if (['ranking', 'tabla_tendencia', 'tabla_desplegable'].includes(type)) {
    const excluded = selected.flatMap((result) => result.values)
      .find((value) => value.path_key === 'excluded_count');
    if (excluded?.value) notes.push(`${excluded.value} entidades excluidas por falta de datos.`);
  }
  if (!rows.length) notes.push('No hay datos para mostrar en este bloque con esta consulta.');
  return { type, title, children,
    series: [{ label: type === 'dona' ? 'Participación' : 'Valores', points }],
    table: { headers: type === 'dona' ? ['Elemento', 'Valor', 'Participación'] :
      ['Elemento', 'Valor'], rows }, notes,
    aria_label: `${title}: ${rows.length} filas` };
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
    segments(text, input.results) :
    input.kind === 'clarification' ? segments(text, input.results) :
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
