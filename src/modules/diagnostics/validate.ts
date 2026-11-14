import { parseSqlDecimal, roundDecimal } from '@/modules/chat/decimal';

import {
  batchNotesSchema,
  reportOutputSchema,
  type BatchNotes,
  type BreakdownDimension,
  type DiagnosticWindow,
  type EntityLevel,
  type Evidence,
  type ReportOutput,
} from './contract';
import type { PreparedDiagnostic } from './evidence';

/**
 * Validación de la salida del modelo y sustitución de marcadores (M26a, Diseño §4). Se valida
 * en orden y se rechaza ante el primer fallo: forma, referencias, numerales libres y
 * aserciones. Las cifras entran al texto solo por sustitución del servidor, después de validar.
 */

type Ready = Extract<PreparedDiagnostic, { status: 'ready' }>;

export type ValidationFailure = 'shape' | 'references' | 'numerals' | 'assertions';
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; reason: ValidationFailure };

export type ValidationContext = Readonly<{
  evidence: ReadonlyMap<string, Evidence>;
  entities: ReadonlyMap<string, Readonly<{ level: EntityLevel; name: string }>>;
  evaluableBreakdowns: readonly BreakdownDimension[];
  webSources: number;
  window: DiagnosticWindow;
  comparison: boolean;
}>;

export function validationContext(prepared: Ready, options: { webSources: number }): ValidationContext {
  const evaluable = (Object.entries(prepared.sectionPlan.breakdowns) as [BreakdownDimension, { status: string }][])
    .filter(([, plan]) => plan.status === 'evaluable').map(([dimension]) => dimension);
  return Object.freeze({
    evidence: new Map(prepared.evidence.map((item) => [item.id, item])),
    entities: new Map(prepared.package.entities.map((e) => [e.alias, { level: e.level, name: e.name }])),
    evaluableBreakdowns: evaluable,
    webSources: options.webSources,
    window: prepared.package.window,
    comparison: prepared.package.comparison,
  });
}

// ---------------------------------------------------------------------------
// Marcadores: [[ev_…]], [[e<n>]] y [[periodo:actual|previo]]. Cualquier otro se rechaza.
// ---------------------------------------------------------------------------

const MARKER = /\[\[([^[\]]*)\]\]/g;
const EVIDENCE_TOKEN = /^ev_[a-z0-9][a-z0-9_-]{0,62}$/;
const ENTITY_TOKEN = /^e[1-9]\d{0,5}$/;

function markerValid(token: string, ctx: ValidationContext): boolean {
  if (EVIDENCE_TOKEN.test(token)) return ctx.evidence.has(token);
  if (ENTITY_TOKEN.test(token)) return ctx.entities.has(token);
  if (token === 'periodo:actual') return true;
  if (token === 'periodo:previo') return ctx.comparison;
  return false;
}

function markersValid(text: string, ctx: ValidationContext): boolean {
  for (const match of text.matchAll(MARKER)) if (!markerValid(match[1], ctx)) return false;
  const rest = text.replace(MARKER, ' ');
  return !rest.includes('[[') && !rest.includes(']]');
}

function citedEvidence(text: string): string[] {
  return [...text.matchAll(MARKER)].map((m) => m[1]).filter((t) => EVIDENCE_TOKEN.test(t));
}

// ---------------------------------------------------------------------------
// Numerales libres (lista cerrada de §4.3; lección de H-E1-228: no rechazar de más).
// ---------------------------------------------------------------------------

const NUMBER_WORDS = new Set([
  'cero', 'ceros', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once',
  'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
  'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa', 'cien', 'ciento',
  'cientos', 'cientas', 'mil', 'miles', 'millon', 'millones', 'billon', 'billones', 'decena', 'decenas',
  'docena', 'docenas', 'centena', 'centenas', 'centenar', 'centenares', 'millar', 'millares', 'par', 'pares',
  'tercer', 'doble', 'dobles', 'triple', 'triples', 'cuadruple', 'cuadruples', 'quintuple', 'quintuples',
  'sextuple', 'sextuples', 'septuple', 'septuples', 'octuple', 'octuples', 'multiplo', 'multiplos',
  'mitad', 'mitades', 'tercio', 'tercios',
]);
const HUNDREDS = /^((dos|tres|cuatro|seis|sete|ocho|nove)cient|quinient)(os|as)$/;
const ORDINALS = /^(segund|tercer|cuart|quint|sext|septim|setim|octav|noven|decim)(o|a|os|as)$/;
const PREFIXES = ['veinti', 'vigesi', 'trigesi', 'cuadragesi', 'quincuagesi', 'sexagesi', 'septuagesi',
  'octogesi', 'nonagesi', 'centesi', 'milesi', 'duplic', 'triplic', 'cuadruplic', 'quintuplic'];

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function numberWord(word: string): boolean {
  if (NUMBER_WORDS.has(word) || ORDINALS.test(word) || HUNDREDS.test(word)) return true;
  return PREFIXES.some((prefix) => word.startsWith(prefix));
}

/** Verdadero si el texto, sin sus marcadores, contiene una cifra libre. */
export function hasFreeNumerals(text: string): boolean {
  const plain = text.replace(MARKER, ' ');
  // Todo dígito, también los de ancho completo, superíndices y otros sistemas (\p{Nd}, \p{No}).
  if (/[\p{Nd}\p{No}]/u.test(plain) || plain.includes('%')) return true;
  const norm = normalize(plain);
  if (/\bpor\s+ciento\b/.test(norm)) return true;
  return norm.split(/[^a-z]+/).filter(Boolean).some(numberWord);
}

// ---------------------------------------------------------------------------
// Validación de la salida.
// ---------------------------------------------------------------------------

function texts(output: ReportOutput): string[] {
  return [
    output.executive_summary.text, output.overall_performance.text,
    ...output.top_entities.map((e) => e.note),
    ...output.breakdowns.map((b) => b.text),
    ...output.opportunities.flatMap((o) => [o.title, o.rationale, o.action, o.check_plan, o.uncertainty]),
    ...output.web_notes.map((n) => n.note),
  ];
}

function evidenceLists(output: ReportOutput): string[][] {
  return [output.executive_summary.evidence_ids, output.overall_performance.evidence_ids,
    ...output.top_entities.map((e) => e.evidence_ids), ...output.breakdowns.map((b) => b.evidence_ids),
    ...output.opportunities.map((o) => o.evidence_ids)];
}

export function validateReportOutput(raw: unknown, ctx: ValidationContext): ValidationResult<ReportOutput> {
  // 1. Forma y exactamente las secciones evaluables.
  const parsed = reportOutputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'shape' };
  const output = parsed.data;
  const dimensions = output.breakdowns.map((b) => b.dimension);
  if (new Set(dimensions).size !== dimensions.length || dimensions.length !== ctx.evaluableBreakdowns.length
    || dimensions.some((d) => !ctx.evaluableBreakdowns.includes(d))) {
    return { ok: false, reason: 'shape' };
  }

  // 2. Referencias: evidencia, alias con su nivel, índices web y marcadores.
  const refsOk = evidenceLists(output).every((list) => list.every((id) => ctx.evidence.has(id)))
    && output.top_entities.every((e) => ctx.entities.get(e.alias)?.level === e.level)
    && output.web_notes.every((n) => n.source_index <= ctx.webSources)
    && texts(output).every((t) => markersValid(t, ctx));
  if (!refsOk) return { ok: false, reason: 'references' };

  // 3. Sin numerales libres.
  if (texts(output).some(hasFreeNumerals)) return { ok: false, reason: 'numerals' };

  // 4. Aserciones: un hecho cita evidencia del sistema y nunca de baja muestra.
  for (const opportunity of output.opportunities) {
    const cited = [...opportunity.evidence_ids, ...[opportunity.title, opportunity.rationale, opportunity.action,
      opportunity.check_plan, opportunity.uncertainty].flatMap(citedEvidence)]
      .map((id) => ctx.evidence.get(id)).filter((e): e is Evidence => e !== undefined);
    if (opportunity.kind === 'fact' && (cited.length === 0
      || cited.some((e) => e.sample === 'low_sample')
      || !cited.some((e) => e.kind === 'system_fact' || e.kind === 'calculated_metric'))) {
      return { ok: false, reason: 'assertions' };
    }
  }
  return { ok: true, value: output };
}

/** Notas de lote: comprobaciones 1 a 3; no se reparan (Diseño §2). */
export function validateBatchNotes(raw: unknown, ctx: ValidationContext,
  batchAliases: readonly string[]): ValidationResult<BatchNotes> {
  const parsed = batchNotesSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'shape' };
  const batch = new Set(batchAliases);
  const refsOk = parsed.data.notes.every((n) => batch.has(n.alias)
    && n.evidence_ids.every((id) => ctx.evidence.has(id)) && markersValid(n.note, ctx));
  if (!refsOk) return { ok: false, reason: 'references' };
  if (parsed.data.notes.some((n) => hasFreeNumerals(n.note))) return { ok: false, reason: 'numerals' };
  return { ok: true, value: parsed.data };
}

// ---------------------------------------------------------------------------
// Formato es-AR exacto (sin pasar por number: CA-44b) y sustitución.
// ---------------------------------------------------------------------------

function formatDecimal(text: string, scale: number): string | null {
  const parsed = parseSqlDecimal(text);
  if (!parsed) return null;
  const rounded = roundDecimal(parsed, scale);
  const negative = rounded.coefficient < BigInt(0);
  const digits = (negative ? -rounded.coefficient : rounded.coefficient).toString().padStart(scale + 1, '0');
  const whole = scale > 0 ? digits.slice(0, -scale) : digits;
  const fraction = scale > 0 ? digits.slice(-scale) : '';
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const zero = /^0*$/.test(whole + fraction);
  return `${negative && !zero ? '-' : ''}${grouped}${fraction ? `,${fraction}` : ''}`;
}

const ATTRIBUTED = ' (atribuido por Meta)';

export function formatEvidenceValue(evidence: Evidence): string {
  if (evidence.value === null) return 'no calculable';
  const scale = evidence.unit === 'count' ? 0 : evidence.unit === 'variation' ? 1 : 2;
  const number = formatDecimal(evidence.value, scale);
  if (number === null) return 'no calculable';
  switch (evidence.unit) {
    case 'money': {
      const prefix = evidence.currency && /^[A-Z]{3}$/.test(evidence.currency) ? `${evidence.currency} ` : '';
      return `${prefix}${number}${evidence.metric === 'result_value' ? ATTRIBUTED : ''}`;
    }
    case 'percent':
    case 'variation':
      return `${number} %`;
    case 'ratio':
      return `${number}${ATTRIBUTED}`;
    default:
      return number;
  }
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function substituteMarkers(text: string, ctx: ValidationContext): string {
  return text.replace(MARKER, (whole, token: string) => {
    if (EVIDENCE_TOKEN.test(token)) {
      const evidence = ctx.evidence.get(token);
      return evidence ? formatEvidenceValue(evidence) : whole;
    }
    if (ENTITY_TOKEN.test(token)) {
      const entity = ctx.entities.get(token);
      if (!entity) return whole;
      return entity.name.trim() === '' ? 'entidad sin nombre' : entity.name;
    }
    if (token === 'periodo:actual') {
      return `el período del ${formatDate(ctx.window.from)} al ${formatDate(ctx.window.to)}`;
    }
    if (token === 'periodo:previo') {
      return `el período del ${formatDate(ctx.window.prev_from)} al ${formatDate(ctx.window.prev_to)}`;
    }
    return whole;
  });
}

/**
 * Suma a `evidence_ids` de cada sección la evidencia citada solo por marcador en sus textos.
 * Después de sustituir, los marcadores desaparecen: sin esto, una cifra mostrada en el texto
 * no tendría fila en la tabla de evidencia citada.
 */
export function withMarkerEvidence(output: ReportOutput): ReportOutput {
  const merge = (ids: readonly string[], ...textsOf: string[]) =>
    [...new Set([...ids, ...textsOf.flatMap(citedEvidence)])];
  return {
    ...output,
    executive_summary: { ...output.executive_summary,
      evidence_ids: merge(output.executive_summary.evidence_ids, output.executive_summary.text) },
    overall_performance: { ...output.overall_performance,
      evidence_ids: merge(output.overall_performance.evidence_ids, output.overall_performance.text) },
    top_entities: output.top_entities.map((e) => ({ ...e, evidence_ids: merge(e.evidence_ids, e.note) })),
    breakdowns: output.breakdowns.map((b) => ({ ...b, evidence_ids: merge(b.evidence_ids, b.text) })),
    opportunities: output.opportunities.map((o) => ({ ...o, evidence_ids: merge(o.evidence_ids, o.title,
      o.rationale, o.action, o.check_plan, o.uncertainty) })),
  };
}

/** Salida validada con todos los marcadores reemplazados por texto plano. */
export function substituteOutput(output: ReportOutput, ctx: ValidationContext): ReportOutput {
  const s = (t: string) => substituteMarkers(t, ctx);
  return {
    executive_summary: { ...output.executive_summary, text: s(output.executive_summary.text) },
    overall_performance: { ...output.overall_performance, text: s(output.overall_performance.text) },
    top_entities: output.top_entities.map((e) => ({ ...e, note: s(e.note) })),
    breakdowns: output.breakdowns.map((b) => ({ ...b, text: s(b.text) })),
    opportunities: output.opportunities.map((o) => ({ ...o, title: s(o.title), rationale: s(o.rationale),
      action: s(o.action), check_plan: s(o.check_plan), uncertainty: s(o.uncertainty) })),
    web_notes: output.web_notes.map((n) => ({ ...n, note: s(n.note) })),
  };
}
