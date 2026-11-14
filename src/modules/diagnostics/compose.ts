import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { actionLabel } from '@/modules/chat/tools/action-labels';

import {
  BREAKDOWN_DIMENSIONS,
  CAUSES,
  ENTITY_LEVELS,
  evidenceSchema,
  GOAL_KINDS,
  manifestSchema,
  METHODOLOGY_VERSION,
  METRIC_LABELS,
  type BreakdownDimension,
  type Cause,
  type DiagnosticSettings,
  type EntityLevel,
  type Evidence,
  type Metric,
} from './contract';
import { DiagnosticReadError } from './repository';
import { formatEvidenceValue } from './validate';

/**
 * Composición del informe guardado (M26a, Diseño §4 y §5). Produce un único modelo de documento
 * de datos planos que consumen la pantalla y el PDF, sin recalcular nada: las cifras salen de la
 * evidencia persistida con el formato es-AR del servidor, y los textos del modelo ya llegan con
 * los marcadores sustituidos. Los bloques «no evaluable», los límites y la metodología los
 * compone el servidor con textos fijos.
 */

// ---------------------------------------------------------------------------
// Lectura del informe guardado (bajo RLS: la política ya exige una conexión vigente).
// ---------------------------------------------------------------------------

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const instant = z.string().regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/);
const sectionStatusSchema = z.union([
  z.strictObject({ status: z.literal('evaluable') }),
  z.strictObject({ status: z.literal('not_evaluable'), cause: z.enum(CAUSES) }),
]);
const metricMapSchema = z.record(z.string(), z.object({ id: z.string(), value: z.string().nullable() }));
const ids = z.array(z.string());

const storedOutputSchema = z.object({
  executive_summary: z.object({ text: z.string(), evidence_ids: ids }),
  overall_performance: z.object({ text: z.string(), evidence_ids: ids }),
  top_entities: z.array(z.object({ alias: z.string(), level: z.enum(ENTITY_LEVELS), note: z.string(), evidence_ids: ids })),
  breakdowns: z.array(z.object({ dimension: z.enum(BREAKDOWN_DIMENSIONS), text: z.string(), evidence_ids: ids })),
  opportunities: z.array(z.object({
    title: z.string(), priority: z.enum(['high', 'medium', 'low']), kind: z.enum(['fact', 'hypothesis']),
    rationale: z.string(), action: z.string(), check_plan: z.string(), uncertainty: z.string(), evidence_ids: ids,
  })),
  web_notes: z.array(z.object({ source_index: z.number().int(), note: z.string() })),
});

const totalsSchema = z.object({
  current: metricMapSchema,
  previous: metricMapSchema.nullable(),
  currency: z.string().nullable(),
  comparison: z.boolean(),
  level_coverage: z.record(z.string(), z.string()),
  limits: z.array(z.enum(CAUSES)),
  section_plan: z.object({
    comparison: sectionStatusSchema,
    breakdowns: z.record(z.string(), sectionStatusSchema),
    web: sectionStatusSchema,
  }),
  entities: z.record(z.string(), z.object({ level: z.enum(ENTITY_LEVELS), name: z.string(),
    status: z.string().nullable(), low_sample: z.boolean() })),
});

export const storedReportSchema = z.object({
  generated_at: instant,
  window_from: isoDate,
  window_to: isoDate,
  prev_from: isoDate.nullable(),
  prev_to: isoDate.nullable(),
  sync_finished_at: instant,
  settings: z.object({ goal_kind: z.enum(GOAL_KINDS), metric_ref: z.string() }),
  evidence: z.object({ items: z.array(evidenceSchema), totals: totalsSchema, manifest: manifestSchema }),
  output: storedOutputSchema,
  web_sources: z.array(z.object({ index: z.number().int(), url: z.string(), title: z.string(),
    page_age: z.string(), domain: z.string() })),
  model_requested: z.string(),
  model_reported: z.string().nullable(),
  usage: z.object({ calls: z.number().int(), batches: z.number().int(), steps: z.array(z.unknown()) }),
});
export type StoredReport = z.infer<typeof storedReportSchema>;

export const STORED_REPORT_COLUMNS = 'generated_at, window_from, window_to, prev_from, prev_to, sync_finished_at, '
  + 'settings, evidence, output, web_sources, model_requested, model_reported, usage';

export function parseStoredReport(raw: unknown): StoredReport {
  const parsed = storedReportSchema.safeParse(raw);
  if (!parsed.success) throw new DiagnosticReadError();
  return parsed.data;
}

/** El informe vigente de la empresa, o null. Un error de lectura nunca se disfraza de vacío. */
export async function readStoredReport(supabase: SupabaseClient, companyId: string): Promise<StoredReport | null> {
  const { data, error } = await supabase.from('diagnostic_reports').select(STORED_REPORT_COLUMNS)
    .eq('company_id', companyId).maybeSingle();
  if (error) throw new DiagnosticReadError();
  return data === null ? null : parseStoredReport(data);
}

// ---------------------------------------------------------------------------
// Códigos de resultado de las acciones (lista cerrada; cualquier otro valor se ignora).
// ---------------------------------------------------------------------------

export const RESULTADOS = ['objetivo_guardado', 'objetivo_invalido', 'generado', 'en_curso', 'sin_actividad',
  'sin_cobertura', 'no_elegible', 'fallo_generacion', 'conexion_cambiada'] as const;
export type Resultado = (typeof RESULTADOS)[number];

export function parseResultado(value: unknown): Resultado | null {
  return typeof value === 'string' && (RESULTADOS as readonly string[]).includes(value) ? value as Resultado : null;
}

// ---------------------------------------------------------------------------
// Modelo de documento.
// ---------------------------------------------------------------------------

export type DocBlock =
  | Readonly<{ kind: 'paragraph'; text: string; label?: string }>
  | Readonly<{ kind: 'subheading'; text: string }>
  | Readonly<{ kind: 'list'; items: readonly string[] }>
  | Readonly<{ kind: 'notice'; text: string }>
  | Readonly<{ kind: 'table'; columns: readonly string[]; rows: readonly (readonly string[])[] }>;

export type DocSection = Readonly<{ id: string; title: string; blocks: readonly DocBlock[] }>;

export type DiagnosticDocument = Readonly<{
  title: string;
  subtitle: string;
  meta: readonly Readonly<{ label: string; value: string }>[];
  /** Solo para la cabecera de la pantalla: repite textos que también están en las secciones. */
  summary: string;
  opportunities: readonly Readonly<{ title: string; priority: string }>[];
  sections: readonly DocSection[];
  footer: string;
}>;

const CLAUDE = 'Interpretación de Claude';
/** Mismo texto fijo que el chat (`chat/render.ts`) para la atribución no informada. */
const UNKNOWN_ATTRIBUTION = 'Meta no informa con qué atribución contó estos resultados: pueden mezclar ventanas distintas.';

const CAUSE_TEXT: Readonly<Record<Cause, string>> = {
  no_activity: 'no hubo actividad en los días cubiertos.',
  no_coverage: 'faltan datos: hay días sin cobertura y ninguna actividad en los días cubiertos.',
  no_goal_action: 'el tipo de acción del objetivo no aparece en el período, así que los resultados del objetivo no son calculables.',
  no_comparison: 'el período anterior no tiene cobertura completa o usa otra configuración de atribución.',
  low_sample: 'todos los segmentos tienen baja muestra.',
  breakdown_unavailable: 'la última captura del desglose falló o no trajo segmentos.',
  web_unavailable: 'no hubo fuentes web válidas para este informe.',
  partial_coverage: 'la cobertura del período es parcial.',
};

const LIMIT_TEXT: Readonly<Record<Cause, string>> = {
  no_activity: 'Sin actividad: no hubo actividad en los días cubiertos.',
  no_coverage: 'Faltan datos: hay días sin cobertura.',
  no_goal_action: 'Sin acción del objetivo: los resultados del objetivo no son calculables en este período.',
  no_comparison: 'Sin comparación: el período anterior no tiene cobertura completa o usa otra atribución.',
  low_sample: 'Baja muestra: algunas conclusiones son hipótesis.',
  breakdown_unavailable: 'Algún desglose no está disponible.',
  web_unavailable: 'Sin contexto web válido.',
  partial_coverage: 'Cobertura parcial: hay días sin observar, días abiertos o capturados antes del fin del día, o niveles incompletos.',
};

const DIMENSION_LABEL: Readonly<Record<BreakdownDimension, string>> = {
  age_gender: 'Edad y género', country: 'País', region: 'Región',
};
const LEVEL_LABEL: Readonly<Record<'account' | EntityLevel, string>> = {
  account: 'Cuenta', campaign: 'Campaña', adset: 'Conjunto de anuncios', ad: 'Anuncio',
};
const PRIORITY_LABEL = { high: 'Prioridad alta', medium: 'Prioridad media', low: 'Prioridad baja' } as const;
const GOAL_LABEL = { purchase: 'Ventas', inquiry: 'Consultas', traffic: 'Tráfico' } as const;

export function goalLabel(settings: DiagnosticSettings): string {
  if (settings.goal_kind === 'traffic') return 'Tráfico: clics al enlace';
  return `${GOAL_LABEL[settings.goal_kind]}: ${actionLabel(settings.metric_ref.replace(/^actions:/, ''))}`;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const AR_PARTS = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric',
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function argentinaParts(value: string): Record<string, string> {
  return Object.fromEntries(AR_PARTS.formatToParts(new Date(value)).map((p) => [p.type, p.value]));
}

/** Fecha y hora en la zona de Argentina: «13/11/2026 12:30». */
export function formatInstant(value: string): string {
  const p = argentinaParts(value);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export function pdfFileName(report: StoredReport): string {
  const p = argentinaParts(report.generated_at);
  return `diagnostico-meta-${p.year}-${p.month}-${p.day}.pdf`;
}

function attributionLabel(evidence: readonly Evidence[]): string {
  const values = new Set(evidence.filter((e) => e.level === 'account' && e.segment === null
    && (e.metric === 'result_count' || e.metric === 'result_value')).map((e) => e.attribution));
  if (values.has('mixed')) return 'configuraciones distintas (no se mezclan)';
  if ([...values].some((v) => v.startsWith('attr_'))) return 'configuración informada por Meta';
  return 'no informada por Meta';
}

export function composeDocument(report: StoredReport): DiagnosticDocument {
  const items = report.evidence.items;
  const byId = new Map(items.map((e) => [e.id, e]));
  const totals = report.evidence.totals;
  const plan = totals.section_plan;
  const out = report.output;
  const value = (id: string | undefined) => {
    const evidence = id ? byId.get(id) : undefined;
    return evidence ? formatEvidenceValue(evidence) : 'no calculable';
  };
  const unknownAttribution = items.some((e) => e.attribution === 'unknown'
    && (e.metric === 'result_count' || e.metric === 'result_value' || e.metric === 'attributed_return'));

  // 1. Resumen ejecutivo.
  const summary: DocSection = { id: 'summary', title: 'Resumen ejecutivo',
    blocks: [{ kind: 'paragraph', label: CLAUDE, text: out.executive_summary.text }] };

  // 2. Rendimiento general: cifras del servidor.
  const metrics = Object.keys(totals.current) as Metric[];
  const performanceRows = metrics.map((metric) => [METRIC_LABELS[metric], value(totals.current[metric]?.id),
    ...(totals.previous ? [value(totals.previous[metric]?.id)] : [])]);
  const performance: DocSection = { id: 'performance', title: 'Rendimiento general', blocks: [
    { kind: 'paragraph', label: CLAUDE, text: out.overall_performance.text },
    { kind: 'table', columns: ['Métrica', 'Período actual', ...(totals.previous ? ['Período anterior'] : [])],
      rows: performanceRows },
    ...(unknownAttribution ? [{ kind: 'notice' as const, text: UNKNOWN_ATTRIBUTION }] : []),
    { kind: 'notice', text: 'El retorno es atribuido por Meta (valor atribuido / gasto): no es ganancia ni el retorno de la tienda.' },
  ] };

  // 3. Comparación.
  const comparison: DocSection = { id: 'comparison', title: 'Comparación con el período anterior',
    blocks: plan.comparison.status === 'evaluable' && report.prev_from && report.prev_to
      ? [{ kind: 'paragraph', text: `La comparación usa los 28 días anteriores: del ${formatDate(report.prev_from)} al ${formatDate(report.prev_to)}. Las variaciones por entidad figuran en la evidencia citada.` }]
      : [{ kind: 'notice', text: `No evaluable: ${CAUSE_TEXT[plan.comparison.status === 'not_evaluable' ? plan.comparison.cause : 'no_comparison']}` }] };

  // 4. Entidades destacadas.
  const entityRows = out.top_entities.map((e) => {
    const info = totals.entities[e.alias];
    return [info?.name || 'entidad sin nombre', LEVEL_LABEL[e.level], info?.status ?? 'sin dato',
      value(`ev_${e.alias}_spend`), value(`ev_${e.alias}_result_count`), value(`ev_${e.alias}_cost_per_result`),
      info?.low_sample ? 'Baja muestra' : 'Suficiente'];
  });
  const entities: DocSection = { id: 'entities', title: 'Entidades destacadas', blocks: out.top_entities.length === 0
    ? [{ kind: 'notice', text: 'No se destacaron entidades en este informe.' }]
    : [{ kind: 'table', columns: ['Entidad', 'Nivel', 'Estado', 'Gasto', 'Resultados', 'Costo por resultado', 'Muestra'],
      rows: entityRows },
    ...out.top_entities.map((e) => ({ kind: 'paragraph' as const, label: CLAUDE, text: e.note }))] };

  // 5. Desgloses de nivel cuenta: estimaciones de Meta, sin cruzar dimensiones.
  const breakdownBlocks: DocBlock[] = [];
  for (const dimension of BREAKDOWN_DIMENSIONS) {
    breakdownBlocks.push({ kind: 'subheading', text: DIMENSION_LABEL[dimension] });
    const status = plan.breakdowns[dimension] ?? { status: 'not_evaluable', cause: 'breakdown_unavailable' };
    if (status.status !== 'evaluable') {
      breakdownBlocks.push({ kind: 'notice', text: `No evaluable: ${CAUSE_TEXT[status.cause]}` });
      continue;
    }
    const note = out.breakdowns.find((b) => b.dimension === dimension);
    if (note) breakdownBlocks.push({ kind: 'paragraph', label: CLAUDE, text: note.text });
    const segments = new Map<number, { label: string; values: Partial<Record<Metric, Evidence>> }>();
    for (const e of items) {
      const match = new RegExp(`^ev_bd_${dimension}_(\\d+)_`).exec(e.id);
      if (!match || !e.segment) continue;
      const index = Number(match[1]);
      const entry = segments.get(index) ?? { label: e.segment.label, values: {} };
      entry.values[e.metric] = e;
      segments.set(index, entry);
    }
    const resultUnavailable = dimension === 'region';
    breakdownBlocks.push({ kind: 'table',
      columns: ['Segmento', 'Gasto', 'Impresiones', 'Clics', 'CTR', 'Resultados', 'Costo por resultado'],
      rows: [...segments.entries()].sort(([a], [b]) => a - b).map(([, s]) => [s.label,
        ...(['spend', 'impressions', 'clicks', 'ctr'] as Metric[]).map((m) => s.values[m] ? formatEvidenceValue(s.values[m]) : 'no calculable'),
        ...(resultUnavailable ? ['no disponible', 'no disponible']
          : (['result_count', 'cost_per_result'] as Metric[]).map((m) => s.values[m] ? formatEvidenceValue(s.values[m]) : 'no calculable'))]) });
    const omitted = report.evidence.manifest.segments_omitted[dimension];
    if (omitted > 0) breakdownBlocks.push({ kind: 'notice', text: `Se muestran los segmentos de mayor gasto; se omitieron ${omitted}.` });
    breakdownBlocks.push({ kind: 'notice', text: `Estimación de Meta: no se reconcilia con los totales ni se cruza con otras dimensiones. ${UNKNOWN_ATTRIBUTION}`
      + (resultUnavailable ? ' En región, Meta no informa resultados del objetivo.' : '') });
  }
  const breakdowns: DocSection = { id: 'breakdowns', title: 'Desgloses (estimaciones de Meta)', blocks: breakdownBlocks };

  // 6. Oportunidades: sugerencias, nunca cambios ejecutados.
  const opportunities: DocSection = { id: 'opportunities', title: 'Oportunidades', blocks: out.opportunities.length === 0
    ? [{ kind: 'notice', text: 'No se propusieron oportunidades con evidencia suficiente.' }]
    : out.opportunities.flatMap((o) => [
      { kind: 'subheading' as const, text: o.title },
      { kind: 'paragraph' as const, label: CLAUDE,
        text: `${PRIORITY_LABEL[o.priority]} · ${o.kind === 'fact' ? 'Hecho respaldado por evidencia' : 'Hipótesis'}. ${o.rationale}` },
      { kind: 'list' as const, items: [`Acción sugerida (PRAXA no ejecuta cambios): ${o.action}`,
        `Cómo comprobarlo: ${o.check_plan}`, `Incertidumbre: ${o.uncertainty}`,
        `Evidencia: ${o.evidence_ids.join(', ')}`] },
    ]) };

  // 7. Contexto web.
  const web: DocSection = { id: 'web', title: 'Contexto web', blocks: plan.web.status === 'evaluable' && report.web_sources.length > 0
    ? [...out.web_notes.map((n) => ({ kind: 'paragraph' as const, label: CLAUDE, text: `Fuente ${n.source_index}: ${n.note}` })),
      { kind: 'list', items: report.web_sources.map((s) => `${s.index}. ${s.title} (${s.domain}), ${s.url}, publicada hace: ${s.page_age}`) },
      { kind: 'notice', text: 'El contexto web es general y no confiable como dato: no se usa como referencia numérica.' }]
    : [{ kind: 'notice', text: `No evaluable: ${CAUSE_TEXT[plan.web.status === 'not_evaluable' ? plan.web.cause : 'web_unavailable']}` }] };

  // 8. Límites de los datos.
  const manifest = report.evidence.manifest;
  const limitItems = [...totals.limits.map((c) => LIMIT_TEXT[c]),
    ...(manifest.open_days.length ? [`Días abiertos (pueden cambiar en una próxima sincronización): ${manifest.open_days.map(formatDate).join(', ')}.`] : []),
    ...(manifest.partial_capture_days.length ? [`Días capturados antes del fin del día: ${manifest.partial_capture_days.map(formatDate).join(', ')}.`] : []),
    'Las cifras son de Meta Ads y las calcula PRAXA; el retorno es atribuido por Meta y no es ganancia.',
    'Las interpretaciones de Claude pueden equivocarse: revisá la evidencia citada antes de actuar.'];
  const limits: DocSection = { id: 'limits', title: 'Límites de los datos', blocks: [{ kind: 'list', items: limitItems }] };

  // 9. Cobertura y metodología.
  const coverage = Object.entries(totals.level_coverage).map(([level, status]) =>
    `${LEVEL_LABEL[level as 'account']}: ${status === 'complete' ? 'completa' : `incompleta (${status})`}`).join('; ');
  const method: DocSection = { id: 'method', title: 'Cobertura y metodología', blocks: [{ kind: 'table', columns: ['Dato', 'Valor'], rows: [
    ['Entidades examinadas', `campañas ${manifest.entities_examined.campaign}, conjuntos ${manifest.entities_examined.adset}, anuncios ${manifest.entities_examined.ad}`],
    ['Cobertura por nivel', coverage],
    ['Lotes de análisis', String(report.usage.batches || 1)],
    ['Páginas leídas', String(manifest.pages_read)],
    ['Sincronización usada', `${formatInstant(report.sync_finished_at)} (hora de Argentina)`],
    ['Metodología', `${METHODOLOGY_VERSION} (la versión la exige la base al publicar)`],
    ['Modelo', `${report.model_requested}${report.model_reported && report.model_reported !== report.model_requested ? ` (informado: ${report.model_reported})` : ''}`],
  ] }] };

  // 10. Evidencia citada.
  const cited = new Set([out.executive_summary.evidence_ids, out.overall_performance.evidence_ids,
    ...out.top_entities.map((e) => e.evidence_ids), ...out.breakdowns.map((b) => b.evidence_ids),
    ...out.opportunities.map((o) => o.evidence_ids)].flat());
  const evidenceRows = items.filter((e) => cited.has(e.id)).map((e) => [e.id, METRIC_LABELS[e.metric],
    e.segment ? `${DIMENSION_LABEL[e.segment.dimension]}: ${e.segment.label}`
      : e.entity_alias ? (totals.entities[e.entity_alias]?.name || LEVEL_LABEL[e.level]) : LEVEL_LABEL[e.level],
    `${formatDate(e.period.from)} al ${formatDate(e.period.to)}`, formatEvidenceValue(e),
    e.sample === 'low_sample' ? 'Baja muestra' : 'Suficiente']);
  const evidence: DocSection = { id: 'evidence', title: 'Evidencia citada', blocks: evidenceRows.length === 0
    ? [{ kind: 'notice', text: 'Sin evidencia citada.' }]
    : [{ kind: 'table', columns: ['Id', 'Métrica', 'Nivel', 'Período', 'Valor', 'Muestra'], rows: evidenceRows }] };

  return {
    title: 'Diagnóstico de Meta Ads',
    subtitle: 'Informe de 28 días. Las cifras las calcula PRAXA a partir de Meta Ads; los textos marcados son interpretaciones de Claude.',
    meta: [
      { label: 'Generado', value: `${formatInstant(report.generated_at)} (hora de Argentina)` },
      { label: 'Ventana', value: `del ${formatDate(report.window_from)} al ${formatDate(report.window_to)} (28 días)` },
      { label: 'Período anterior', value: report.prev_from && report.prev_to
        ? `del ${formatDate(report.prev_from)} al ${formatDate(report.prev_to)}` : 'sin comparación' },
      { label: 'Objetivo', value: goalLabel(report.settings) },
      { label: 'Moneda', value: totals.currency && totals.currency !== 'mixed' ? totals.currency : 'sin moneda única' },
      { label: 'Atribución', value: attributionLabel(items) },
    ],
    summary: out.executive_summary.text,
    opportunities: out.opportunities.map((o) => ({ title: o.title, priority: PRIORITY_LABEL[o.priority] })),
    sections: [summary, performance, comparison, entities, breakdowns, opportunities, web, limits, method, evidence],
    footer: 'PRAXA · Diagnóstico de Meta Ads · metodología meta-diag-1. Las acciones son sugerencias: PRAXA no cambia nada en Meta.',
  };
}

/** Todos los textos del documento en el orden en que los imprime el PDF. */
export function documentTexts(doc: DiagnosticDocument): string[] {
  const block = (b: DocBlock): string[] => {
    switch (b.kind) {
      case 'paragraph': return b.label ? [b.label, b.text] : [b.text];
      case 'subheading':
      case 'notice': return [b.text];
      case 'list': return [...b.items];
      case 'table': return [...b.columns, ...b.rows.flat()];
    }
  };
  return [doc.title, doc.subtitle, ...doc.meta.map((m) => `${m.label}: ${m.value}`),
    ...doc.sections.flatMap((s) => [s.title, ...s.blocks.flatMap(block)]), doc.footer];
}
