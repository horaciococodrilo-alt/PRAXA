import { appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { anthropicModelSteps, runModelSteps, type ModelRun, type ModelSteps,
  type StructuredRequest } from '@/modules/diagnostics/orchestrator';
import { DIAGNOSTIC_MODEL_ID, DiagnosticProviderError, requestStructured,
  requestWebSearch } from '@/modules/diagnostics/provider';
import { hasFreeNumerals } from '@/modules/diagnostics/validate';
import { ALLOWED_WEB_DOMAINS, extractWebContext, webPrompt, webQueryFor } from '@/modules/diagnostics/web';
import { loadEnv } from '../../scripts/lib/env.mjs';
import { categoryInput, EVAL_CATEGORIES, readyPackage, type EvalCategory } from './fixtures/diagnostics';

vi.mock('server-only', () => ({}));

/**
 * M26a .2, paso 14: evaluación sintética inicial con Anthropic real (T-19 y parte de T-20).
 * Fixtures congelados y sintéticos; nunca datos reales. Se registran solo metadatos (modelo,
 * pasos, tokens, latencia, conteos): ningún texto de entrada ni de salida. Falla si falta la
 * clave (CB-06). El corpus completo de 13 casos × 3 corridas es del paso 20 (.3).
 */

const CASE_TIMEOUT_MS = 270_000;
const NO_WEB = { country: 'Argentina', industry: 'Otro' } as const;
const WITH_WEB = { country: 'Argentina', industry: 'Hogar y decoración' } as const;
// Precios de lista de claude-sonnet-5-5 por millón de tokens y por mil búsquedas (USD).
const PRICE = { input: 2, output: 10, search: 10 };
// Solo metadatos, fuera del repositorio: Vitest no muestra la consola de las pruebas que pasan.
const METRICS_FILE = join(tmpdir(), `praxa-m26a-eval-${Date.now()}.jsonl`);

function record(label: string, data: unknown) {
  const line = `M26a eval ${label}: ${JSON.stringify(data)}`;
  console.info(line);
  appendFileSync(METRICS_FILE, `${line}
`);
}

beforeAll(() => {
  const configured = loadEnv();
  if (!configured.ANTHROPIC_API_KEY) throw new Error('Falta la clave local del modelo del diagnóstico.');
  process.env.ANTHROPIC_API_KEY = configured.ANTHROPIC_API_KEY;
  console.info('M26a eval: métricas en', METRICS_FILE);
  appendFileSync(METRICS_FILE, '');
});

type Trace = { steps: string[]; reported: (string | null)[]; latencies: number[] };

function traced(trace: Trace): ModelSteps {
  const real = anthropicModelSteps();
  return {
    web: async (prompt, signal) => {
      const t = performance.now();
      const result = await real.web(prompt, signal);
      trace.steps.push('web'); trace.reported.push(result.reportedModel);
      trace.latencies.push(Math.round(performance.now() - t));
      return result;
    },
    structured: async (request: StructuredRequest) => {
      const t = performance.now();
      const result = await real.structured(request);
      trace.steps.push(request.step); trace.reported.push(result.reportedModel);
      trace.latencies.push(Math.round(performance.now() - t));
      return result;
    },
  };
}

function cost(run: ModelRun): number {
  const tokens = run.usage.reduce((acc, u) => ({ input: acc.input + u.input_tokens, output: acc.output + u.output_tokens,
    searches: acc.searches + u.web_searches }), { input: 0, output: 0, searches: 0 });
  return tokens.input / 1e6 * PRICE.input + tokens.output / 1e6 * PRICE.output + tokens.searches / 1e3 * PRICE.search;
}

function texts(run: ModelRun): string[] {
  const o = run.rawOutput;
  return [o.executive_summary.text, o.overall_performance.text, ...o.top_entities.map((e) => e.note),
    ...o.breakdowns.map((b) => b.text), ...o.opportunities.flatMap((x) => [x.title, x.rationale, x.action,
      x.check_plan, x.uncertainty]), ...o.web_notes.map((n) => n.note)];
}

function summary(label: string, run: ModelRun, trace: Trace, ms: number, validations: string[]) {
  record(label, {
    validaciones: validations,
    pasos: trace.steps, modelo_informado: [...new Set(trace.reported)], latencia_total_ms: ms,
    latencias_ms: trace.latencies,
    tokens: run.usage.map((u) => ({ paso: u.step, entrada: u.input_tokens, salida: u.output_tokens,
      busquedas: u.web_searches })),
    costo_usd: Number(cost(run).toFixed(4)), fuentes_web: run.web.sources.length,
    dominios: [...new Set(run.web.sources.map((s) => s.domain))],
    oportunidades: run.rawOutput.opportunities.length, entidades: run.rawOutput.top_entities.length,
    desgloses: run.rawOutput.breakdowns.map((b) => b.dimension),
    reparaciones: trace.steps.filter((s) => s === 'repair').length,
  });
}

async function generate(category: EvalCategory, profile: typeof NO_WEB | typeof WITH_WEB) {
  const trace: Trace = { steps: [], reported: [], latencies: [] };
  const validations: string[] = [];
  const prepared = readyPackage(categoryInput(category));
  const started = performance.now();
  try {
    const run = await runModelSteps({ prepared, profile, model: traced(trace),
      deadlineAt: Date.now() + 240_000, now: Date.now,
      observe: (event) => validations.push(`${event.step}:${event.outcome}`) });
    const ms = Math.round(performance.now() - started);
    return { run, trace, ms, prepared, validations };
  } catch (error) {
    record(`${category} RECHAZADO`, { pasos: trace.steps, validaciones: validations,
      latencia_total_ms: Math.round(performance.now() - started), clase: (error as Error).message,
      http: (error as { httpStatus?: number | null }).httpStatus ?? null });
    throw error;
  }
}

function assertAccepted(run: ModelRun, trace: Trace) {
  // Modelo informado igual al solicitado en todas las llamadas (C-17 umbral 7).
  for (const reported of trace.reported) expect(reported).toBe(DIAGNOSTIC_MODEL_ID);
  // Cero cifras libres y a lo sumo una reparación (umbrales 1 y 3).
  for (const text of texts(run)) expect(hasFreeNumerals(text)).toBe(false);
  expect(trace.steps.filter((s) => s === 'repair').length).toBeLessThanOrEqual(1);
  // Toda oportunidad con plan de comprobación y evidencia (umbral 4).
  for (const o of run.rawOutput.opportunities) {
    expect(o.check_plan.length).toBeGreaterThan(0);
    expect(o.evidence_ids.length).toBeGreaterThan(0);
  }
}

describe('M26a-T-19: Anthropic real, pasos separados', () => {
  it('paso web: dominios aprobados, errores internos contados y fuentes validadas', async () => {
    const query = webQueryFor(WITH_WEB, 'purchase')!;
    const started = performance.now();
    const result = await requestWebSearch({ prompt: webPrompt(query) });
    const context = extractWebContext(result.blocks, new Date());
    const errors = result.blocks.filter((b) => typeof b === 'object' && b !== null
      && (b as { type?: string }).type === 'web_search_tool_result'
      && !Array.isArray((b as { content?: unknown }).content)).length;
    const raw = result.blocks.flatMap((b) => {
      const block = b as { type?: string; content?: unknown };
      return block.type === 'web_search_tool_result' && Array.isArray(block.content) ? block.content : [];
    }) as { url?: string; page_age?: unknown }[];
    record('web', { modelo_informado: result.reportedModel,
      latencia_ms: Math.round(performance.now() - started), uso: result.usage, errores_herramienta: errors,
      resultados_crudos: raw.length, con_page_age: raw.filter((r) => typeof r.page_age === 'string').length,
      hosts_crudos: [...new Set(raw.map((r) => { try { return new URL(String(r.url)).hostname; } catch { return '?'; } }))],
      fuentes_aceptadas: context.sources.length, extractos: context.excerpts.length });
    expect(result.reportedModel).toBe(DIAGNOSTIC_MODEL_ID);
    for (const source of context.sources) {
      expect(ALLOWED_WEB_DOMAINS as readonly string[]).toContain(source.domain);
      expect(source.url.startsWith('https://')).toBe(true);
    }
  }, CASE_TIMEOUT_MS);

  it('H-07(c): búsqueda web y salida estructurada en la misma llamada', async () => {
    // Se agrega la herramienta a una petición de informe sin tocar el adaptador: se registra
    // el estado HTTP. La implementación ya las separa; esto solo verifica la hipótesis.
    const withTool: typeof fetch = async (input, init) => {
      const body = JSON.parse(String(init?.body));
      body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1,
        allowed_domains: [...ALLOWED_WEB_DOMAINS] }];
      return fetch(input, { ...init, body: JSON.stringify(body) });
    };
    const outcome = await requestStructured({ system: 'Respondé en JSON conforme al esquema.',
      user: 'Prueba sintética: devolvé ok verdadero.', maxTokens: 512,
      schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
      fetchImpl: withTool }).then(() => 'aceptada', (e: unknown) => e instanceof DiagnosticProviderError
      ? `${e.failureClass}:${e.httpStatus ?? '-'}` : 'error');
    record('H-07(c) web + output_config', { resultado: outcome });
    expect(typeof outcome).toBe('string');
  }, CASE_TIMEOUT_MS);

  it('informe sin web: esquema estricto aceptado, cero cifras libres, modelo informado', async () => {
    const { run, trace, ms, validations } = await generate('winners', NO_WEB);
    summary('winners sin web', run, trace, ms, validations);
    assertAccepted(run, trace);
    expect(trace.steps).not.toContain('web');
    expect(run.web.sources).toEqual([]);
    expect(run.rawOutput.web_notes).toEqual([]);
  }, CASE_TIMEOUT_MS);

  it('informe con web: dos llamadas separadas y notas web solo de fuentes validadas', async () => {
    const { run, trace, ms, validations } = await generate('winners', WITH_WEB);
    summary('winners con web', run, trace, ms, validations);
    assertAccepted(run, trace);
    expect(trace.steps[0]).toBe('web');
    expect(trace.steps.slice(1).every((s) => s === 'report' || s === 'repair')).toBe(true);
    for (const note of run.rawOutput.web_notes) expect(note.source_index).toBeLessThanOrEqual(run.web.sources.length);
  }, CASE_TIMEOUT_MS);
});

describe('M26a-T-20 (inicial): las siete categorías, una corrida cada una', () => {
  it.each(EVAL_CATEGORIES)('categoría %s', async (category) => {
    const { run, trace, ms, prepared, validations } = await generate(category, NO_WEB);
    summary(category, run, trace, ms, validations);
    assertAccepted(run, trace);
    // Desgloses: exactamente los que el servidor marcó evaluables.
    const evaluable = Object.entries(prepared.sectionPlan.breakdowns)
      .filter(([, p]) => p.status === 'evaluable').map(([d]) => d).sort();
    expect(run.rawOutput.breakdowns.map((b) => b.dimension).sort()).toEqual(evaluable);
    expect(ms).toBeLessThanOrEqual(240_000);
  }, CASE_TIMEOUT_MS);
});
