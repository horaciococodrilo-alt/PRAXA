import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  batchNotesSchema,
  reportJsonSchema,
  reportOutputSchema,
  BATCH_NOTES_JSON_SCHEMA,
} from '@/modules/diagnostics/contract';
import {
  ANTHROPIC_MESSAGES_URL,
  ANTHROPIC_VERSION,
  DIAGNOSTIC_MODEL_ID,
  DiagnosticProviderError,
  requestStructured,
  requestWebSearch,
} from '@/modules/diagnostics/provider';
import {
  formatEvidenceValue,
  hasFreeNumerals,
  substituteMarkers,
  validateBatchNotes,
  validateReportOutput,
  validationContext,
} from '@/modules/diagnostics/validate';
import { ADVERSARIAL_NAMES, entity, prepareInput, readyPackage } from '../eval/fixtures/diagnostics';

// ---------------------------------------------------------------------------
// M26a-T-16: adaptador Anthropic con fetch simulado.
// ---------------------------------------------------------------------------

type Captured = { url: string; init: RequestInit };

function fakeFetch(body: unknown, status = 200, captured: Captured[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

const okReport = {
  model: DIAGNOSTIC_MODEL_ID, stop_reason: 'end_turn',
  content: [{ type: 'text', text: '{"ok":true}' }],
  usage: { input_tokens: 120, output_tokens: 30 },
};

describe('M26a-T-16: petición exacta a Anthropic', () => {
  it('paso de informe: URL, cabeceras y cuerpo con salida estructurada, sin web ni muestreo', async () => {
    const captured: Captured[] = [];
    const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'],
      additionalProperties: false };
    const result = await requestStructured({ system: 'S', user: 'U', schema, maxTokens: 12_000,
      apiKey: 'clave-de-prueba', fetchImpl: fakeFetch(okReport, 200, captured) });
    expect(result.json).toEqual({ ok: true });
    expect(result.reportedModel).toBe(DIAGNOSTIC_MODEL_ID);
    expect(result.usage).toEqual({ input_tokens: 120, output_tokens: 30, web_searches: 0 });
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe(ANTHROPIC_MESSAGES_URL);
    expect(ANTHROPIC_MESSAGES_URL).toBe('https://api.anthropic.com/v1/messages');
    expect(captured[0].init.method).toBe('POST');
    expect(captured[0].init.headers).toEqual({ 'x-api-key': 'clave-de-prueba',
      'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' });
    const body = JSON.parse(String(captured[0].init.body));
    expect(body).toEqual({ model: 'claude-sonnet-5-5', max_tokens: 12_000, system: 'S',
      messages: [{ role: 'user', content: 'U' }],
      output_config: { format: { type: 'json_schema', schema } } });
    for (const forbidden of ['temperature', 'top_p', 'top_k', 'tools', 'stream']) expect(body).not.toHaveProperty(forbidden);
  });

  it('paso web: herramienta básica con max_uses y dominios, sin salida estructurada', async () => {
    const captured: Captured[] = [];
    await requestWebSearch({ prompt: 'consulta genérica', apiKey: 'k',
      fetchImpl: fakeFetch({ ...okReport, content: [], usage: { input_tokens: 5, output_tokens: 1,
        server_tool_use: { web_search_requests: 2 } } }, 200, captured) });
    const body = JSON.parse(String(captured[0].init.body));
    expect(body.tools).toEqual([{ type: 'web_search_20250305', name: 'web_search', max_uses: 3,
      allowed_domains: ['www.facebook.com', 'cace.org.ar', 'www.indec.gob.ar'] }]);
    expect(body).not.toHaveProperty('output_config');
    expect(body).not.toHaveProperty('blocked_domains');
    expect(body.messages).toEqual([{ role: 'user', content: 'consulta genérica' }]);
    for (const forbidden of ['temperature', 'top_p', 'top_k']) expect(body).not.toHaveProperty(forbidden);
  });

  it('informa las búsquedas web en el uso', async () => {
    const result = await requestWebSearch({ prompt: 'q', apiKey: 'k', fetchImpl: fakeFetch({ ...okReport,
      content: [], usage: { input_tokens: 5, output_tokens: 1, server_tool_use: { web_search_requests: 2 } } }) });
    expect(result.usage).toEqual({ input_tokens: 5, output_tokens: 1, web_searches: 2 });
  });

  it.each(['max_tokens', 'refusal', 'pause_turn'])('rechaza stop_reason %s en el informe', async (stop) => {
    await expect(requestStructured({ system: 'S', user: 'U', schema: {}, apiKey: 'k',
      fetchImpl: fakeFetch({ ...okReport, stop_reason: stop }) }))
      .rejects.toMatchObject({ failureClass: 'invalid_output' });
  });

  it('rechaza JSON inválido como salida inválida', async () => {
    await expect(requestStructured({ system: 'S', user: 'U', schema: {}, apiKey: 'k',
      fetchImpl: fakeFetch({ ...okReport, content: [{ type: 'text', text: '{no es json' }] }) }))
      .rejects.toMatchObject({ failureClass: 'invalid_output' });
  });

  it('errores HTTP y de red con clase fija, sin contenido de la respuesta', async () => {
    const secretBody = { error: { message: 'texto interno con datos sensibles 12345' } };
    const http = await requestStructured({ system: 'S', user: 'U', schema: {}, apiKey: 'k',
      fetchImpl: fakeFetch(secretBody, 529) }).catch((e: unknown) => e);
    expect(http).toBeInstanceOf(DiagnosticProviderError);
    expect(http).toMatchObject({ failureClass: 'http', httpStatus: 529 });
    expect(String((http as Error).message)).not.toContain('sensibles');

    const network = await requestStructured({ system: 'S', user: 'U', schema: {}, apiKey: 'k',
      fetchImpl: (async () => { throw new TypeError('ECONNRESET datos'); }) as typeof fetch }).catch((e: unknown) => e);
    expect(network).toMatchObject({ failureClass: 'unavailable', httpStatus: null });
    expect(String((network as Error).message)).not.toContain('datos');

    const timeout = await requestStructured({ system: 'S', user: 'U', schema: {}, apiKey: 'k',
      fetchImpl: (async () => { throw new DOMException('expiró', 'TimeoutError'); }) as typeof fetch })
      .catch((e: unknown) => e);
    expect(timeout).toMatchObject({ failureClass: 'timeout' });
  });

  it('sin clave no llama y falla como no disponible', async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const captured: Captured[] = [];
    try {
      await expect(requestStructured({ system: 'S', user: 'U', schema: {},
        fetchImpl: fakeFetch(okReport, 200, captured) })).rejects.toMatchObject({ failureClass: 'unavailable' });
      expect(captured).toHaveLength(0);
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });
});

describe('M26a: esquema enviado al modelo (H-09)', () => {
  it('no usa restricciones no admitidas y cierra todos los objetos', () => {
    const text = JSON.stringify(reportJsonSchema(['country']));
    for (const banned of ['minimum', 'maximum', 'minLength', 'maxLength', 'maxItems', 'minItems', 'multipleOf']) {
      expect(text).not.toContain(`"${banned}"`);
    }
    expect(text).not.toContain('"status"');
    expect(text).not.toContain('"cause"');
    expect(JSON.stringify(BATCH_NOTES_JSON_SCHEMA)).not.toContain('maxLength');
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const o = node as Record<string, unknown>;
      if (o.type === 'object') expect(o.additionalProperties).toBe(false);
      Object.values(o).forEach(walk);
    };
    walk(reportJsonSchema(['age_gender', 'country']));
    walk(BATCH_NOTES_JSON_SCHEMA);
  });

  it('las dimensiones pedidas son solo las evaluables', () => {
    const schema = reportJsonSchema(['country']) as { properties: { breakdowns: { items:
      { properties: { dimension: { enum: string[] } } } } } };
    expect(schema.properties.breakdowns.items.properties.dimension.enum).toEqual(['country']);
  });
});

// ---------------------------------------------------------------------------
// Salida válida de referencia sobre el paquete sintético.
// ---------------------------------------------------------------------------

const prepared = readyPackage();
const ctx = validationContext(prepared, { webSources: 1 });

function validOutput(over: Record<string, unknown> = {}) {
  return {
    executive_summary: { text: 'El gasto de [[periodo:actual]] fue [[ev_acct_cur_spend]].',
      evidence_ids: ['ev_acct_cur_spend'] },
    overall_performance: { text: 'El costo por resultado fue [[ev_acct_cur_cost_per_result]].',
      evidence_ids: ['ev_acct_cur_cost_per_result'] },
    top_entities: [{ alias: 'e1', level: 'campaign', note: '[[e1]] concentró el gasto.',
      evidence_ids: ['ev_e1_spend'] }],
    breakdowns: [
      { dimension: 'age_gender', text: 'Estimación de Meta por edad y género.', evidence_ids: ['ev_bd_age_gender_1_spend'] },
      { dimension: 'country', text: 'Estimación de Meta por país.', evidence_ids: ['ev_bd_country_1_spend'] },
      { dimension: 'region', text: 'Estimación de Meta por región.', evidence_ids: ['ev_bd_region_1_spend'] },
    ],
    opportunities: [{ title: 'Revisar la campaña principal', priority: 'high', kind: 'fact',
      rationale: '[[e1]] tuvo el mayor gasto con [[ev_e1_spend]].', action: 'Sugerencia: revisar sus anuncios.',
      check_plan: 'Comparar el costo por resultado en la próxima sincronización.',
      uncertainty: 'La atribución de Meta puede mezclar ventanas.', evidence_ids: ['ev_e1_spend'] }],
    web_notes: [{ source_index: 1, note: 'Contexto general de la fuente oficial.' }],
    ...over,
  };
}

describe('M26a-T-17: forma, secciones evaluables y referencias', () => {
  it('acepta la salida de referencia', () => {
    const out = validateReportOutput(validOutput(), ctx);
    expect(out.ok).toBe(true);
  });

  it('exige exactamente las secciones evaluables: faltante, sobrante o duplicada se rechaza', () => {
    const base = validOutput();
    const missing = validOutput({ breakdowns: base.breakdowns.slice(0, 2) });
    expect(validateReportOutput(missing, ctx)).toEqual({ ok: false, reason: 'shape' });
    const notEvaluable = validationContext(readyPackage({ breakdowns: { age_gender: [], country: [],
      region: [] } }), { webSources: 1 });
    expect(validateReportOutput(base, notEvaluable)).toEqual({ ok: false, reason: 'shape' });
    const dup = validOutput({ breakdowns: [...base.breakdowns, base.breakdowns[0]] });
    expect(validateReportOutput(dup, ctx)).toEqual({ ok: false, reason: 'shape' });
  });

  it('rechaza status o cause escritos por el modelo y campos extra', () => {
    const withStatus = validOutput({ executive_summary: { text: 'Resumen.', evidence_ids: ['ev_acct_cur_spend'],
      status: 'evaluable' } });
    expect(validateReportOutput(withStatus, ctx)).toEqual({ ok: false, reason: 'shape' });
    expect(validateReportOutput({ ...validOutput(), cause: 'no_activity' }, ctx)).toEqual({ ok: false, reason: 'shape' });
  });

  it('de cero a tres oportunidades', () => {
    const one = validOutput().opportunities[0];
    expect(validateReportOutput(validOutput({ opportunities: [] }), ctx).ok).toBe(true);
    expect(validateReportOutput(validOutput({ opportunities: [one, one, one] }), ctx).ok).toBe(true);
    expect(validateReportOutput(validOutput({ opportunities: [one, one, one, one] }), ctx))
      .toEqual({ ok: false, reason: 'shape' });
  });

  it('cada oportunidad trae acción, plan de comprobación y evidencia', () => {
    const one = validOutput().opportunities[0];
    expect(validateReportOutput(validOutput({ opportunities: [{ ...one, check_plan: '' }] }), ctx).ok).toBe(false);
    expect(validateReportOutput(validOutput({ opportunities: [{ ...one, evidence_ids: [] }] }), ctx).ok).toBe(false);
  });

  it('referencias inventadas: evidencia, alias e índice web', () => {
    expect(validateReportOutput(validOutput({ overall_performance: { text: 'Bien.',
      evidence_ids: ['ev_inventada_1'] } }), ctx)).toEqual({ ok: false, reason: 'references' });
    expect(validateReportOutput(validOutput({ top_entities: [{ alias: 'e99', level: 'campaign',
      note: 'Sin datos.', evidence_ids: ['ev_e1_spend'] }] }), ctx)).toEqual({ ok: false, reason: 'references' });
    expect(validateReportOutput(validOutput({ top_entities: [{ alias: 'e1', level: 'ad',
      note: 'Nivel equivocado.', evidence_ids: ['ev_e1_spend'] }] }), ctx)).toEqual({ ok: false, reason: 'references' });
    expect(validateReportOutput(validOutput({ web_notes: [{ source_index: 2, note: 'Otra.' }] }), ctx))
      .toEqual({ ok: false, reason: 'references' });
    const noWeb = validationContext(prepared, { webSources: 0 });
    expect(validateReportOutput(validOutput(), noWeb)).toEqual({ ok: false, reason: 'references' });
    expect(validateReportOutput(validOutput({ web_notes: [] }), noWeb).ok).toBe(true);
  });

  it('un marcador mal formado o inexistente se rechaza', () => {
    for (const text of ['Gasto [[ev_inventada_1]].', 'Gasto [[EV_acct]].', 'Gasto [[periodo:otro]].',
      'Gasto [[e99]].', 'Gasto [[ev_acct_cur_spend].', 'Gasto [[cualquier cosa]].']) {
      const out = validateReportOutput(validOutput({ overall_performance: { text,
        evidence_ids: ['ev_acct_cur_spend'] } }), ctx);
      expect(out.ok, text).toBe(false);
    }
  });

  it('sin comparación, el marcador del período previo no existe', () => {
    const noComparison = validationContext(readyPackage({ account: { current: prepareInput().account.current,
      previous: null } }), { webSources: 0 });
    const out = validateReportOutput(validOutput({ web_notes: [], executive_summary: { text: 'Antes: [[periodo:previo]].',
      evidence_ids: ['ev_acct_cur_spend'] } }), noComparison);
    expect(out).toEqual({ ok: false, reason: 'references' });
  });

  it('notas de lote: forma, alias del lote y evidencia; sin reparación', () => {
    const batch = ['e1', 'e2'];
    expect(validateBatchNotes({ notes: [{ alias: 'e1', note: 'Concentra gasto.', evidence_ids: ['ev_e1_spend'] }] },
      ctx, batch).ok).toBe(true);
    expect(validateBatchNotes({ notes: [{ alias: 'e3', note: 'Fuera del lote.', evidence_ids: ['ev_e3_spend'] }] },
      ctx, batch)).toEqual({ ok: false, reason: 'references' });
    expect(validateBatchNotes({ notes: [{ alias: 'e1', note: 'Gastó 300.', evidence_ids: ['ev_e1_spend'] }] },
      ctx, batch)).toEqual({ ok: false, reason: 'numerals' });
    expect(validateBatchNotes({ notes: [], extra: true }, ctx, batch)).toEqual({ ok: false, reason: 'shape' });
    expect(batchNotesSchema.safeParse({ notes: Array.from({ length: 11 }, () =>
      ({ alias: 'e1', note: 'x', evidence_ids: ['ev_e1_spend'] })) }).success).toBe(false);
  });
});

describe('M26a-T-18: sin numerales libres y sustitución del servidor', () => {
  it.each([
    'Subió 3 veces', 'Creció un 20%', 'Creció veinte por ciento', 'Llegó a cien ventas', 'Bajó a la mitad',
    'El costo se duplicó', 'Superó mil clics', 'Hubo cero compras', 'Fue el segundo mejor', 'Quedó tercero',
    'Los dos anuncios', 'Fueron veintidós días', 'Treinta y cinco clics', 'Quinientos pesos', 'Una docena',
    'Un par de anuncios', 'Se triplicó el gasto', 'Tercer conjunto', 'Novecientas visitas', 'El vigésimo día',
    'Subió ５ veces', 'Alcance en m²', 'Fueron ٣ días',
  ])('rechaza «%s»', (text) => {
    expect(hasFreeNumerals(text)).toBe(true);
  });

  it.each(['Un anuncio concentra el gasto', 'Una campaña', 'El primer conjunto', 'Varios anuncios',
    'Ambos períodos', 'Algunos segmentos', 'Uno de ellos'])('admite «%s»', (text) => {
    expect(hasFreeNumerals(text)).toBe(false);
  });

  it('los marcadores con dígitos en el id no cuentan como numerales', () => {
    expect(hasFreeNumerals('El gasto fue [[ev_bd_country_1_spend]] en [[e12]] durante [[periodo:actual]].')).toBe(false);
  });

  it('el validador rechaza un numeral libre con la causa numerals', () => {
    expect(validateReportOutput(validOutput({ overall_performance: { text: 'Gastó 300 dólares.',
      evidence_ids: ['ev_acct_cur_spend'] } }), ctx)).toEqual({ ok: false, reason: 'numerals' });
  });

  it('sustituye evidencia, entidad y período con formato es-AR', () => {
    expect(substituteMarkers('Gasto [[ev_acct_cur_spend]] en [[periodo:actual]].', ctx))
      .toBe('Gasto USD 294,00 en el período del 16/10/2026 al 12/11/2026.');
    expect(substituteMarkers('[[e1]]', ctx)).toBe('Campaña sintético 1');
    expect(substituteMarkers('CTR [[ev_acct_cur_ctr]]', ctx)).toBe('CTR 2,00 %');
    expect(substituteMarkers('Retorno [[ev_acct_cur_attributed_return]]', ctx))
      .toBe('Retorno 2,86 (atribuido por Meta)');
    expect(substituteMarkers('Clics [[ev_acct_cur_impressions]]', ctx)).toBe('Clics 28.000');
  });

  it('un nombre con dígitos entra solo por sustitución', () => {
    const named = readyPackage({ entities: { campaign: [entity('campaign', 1, { name: 'Promo 2x1 de 2026' })],
      adset: [], ad: [] } });
    const c = validationContext(named, { webSources: 0 });
    expect(substituteMarkers('Destacó [[e1]].', c)).toBe('Destacó Promo 2x1 de 2026.');
    expect(hasFreeNumerals('Destacó [[e1]].')).toBe(false);
  });

  it('una evidencia no calculable se sustituye por texto fijo sin cifra ni unidad', () => {
    const missing = readyPackage({ account: { current: { ...prepareInput().account.current, ctr: null },
      previous: prepareInput().account.previous } });
    const c = validationContext(missing, { webSources: 0 });
    expect(substituteMarkers('CTR [[ev_acct_cur_ctr]]', c)).toBe('CTR no calculable');
    const out = validateReportOutput(validOutput({ web_notes: [], overall_performance: {
      text: 'El CTR resultó [[ev_acct_cur_ctr]].', evidence_ids: ['ev_acct_cur_ctr'] } }), c);
    expect(out.ok).toBe(true);
  });

  it('formatea cada unidad con redondeo exacto half-up', () => {
    const ev = prepared.evidence.find((e) => e.id === 'ev_acct_cur_spend')!;
    expect(formatEvidenceValue({ ...ev, value: '1234.505' })).toBe('USD 1.234,51');
    expect(formatEvidenceValue({ ...ev, value: '9007199254740993.995' })).toBe('USD 9.007.199.254.740.994,00');
    expect(formatEvidenceValue({ ...ev, unit: 'variation', metric: 'var_spend', currency: null, value: '-12.25' }))
      .toBe('-12,3 %');
    expect(formatEvidenceValue({ ...ev, unit: 'count', metric: 'clicks', currency: null, value: '1234567' }))
      .toBe('1.234.567');
    expect(formatEvidenceValue({ ...ev, value: null })).toBe('no calculable');
  });

  it('un hecho sin evidencia de sistema o con baja muestra se rechaza', () => {
    const low = readyPackage({ entities: { campaign: [entity('campaign', 1, { cur_impressions: '300',
      cur_clicks: '5', cur_result_count: '1' })], adset: [], ad: [] } });
    const c = validationContext(low, { webSources: 0 });
    const one = validOutput().opportunities[0];
    const base = validOutput({ web_notes: [], top_entities: [] });
    const fact = validateReportOutput({ ...base, opportunities: [{ ...one, kind: 'fact' }] }, c);
    expect(fact).toEqual({ ok: false, reason: 'assertions' });
    const hypothesis = validateReportOutput({ ...base, opportunities: [{ ...one, kind: 'hypothesis' }] }, c);
    expect(hypothesis.ok).toBe(true);
  });
});

describe('M26a-T-21 (unitaria): nombres con instrucciones', () => {
  it('el nombre no confiable no altera referencias ni valores', () => {
    const adversarial = readyPackage({ entities: { campaign: ADVERSARIAL_NAMES.map((name, i) =>
      entity('campaign', i + 1, { name })), adset: [], ad: [] } });
    const c = validationContext(adversarial, { webSources: 0 });
    // Un modelo que obedece al nombre e inventa evidencia u oportunidades queda rechazado.
    const one = validOutput().opportunities[0];
    expect(validateReportOutput(validOutput({ web_notes: [], top_entities: [], breakdowns: validOutput().breakdowns,
      opportunities: [one, one, one, one] }), c).ok).toBe(false);
    expect(validateReportOutput(validOutput({ web_notes: [], overall_performance: { text: 'Gasto ajustado.',
      evidence_ids: ['ev_inventada_1'] } }), c)).toEqual({ ok: false, reason: 'references' });
    // Sustituido, el nombre es texto plano: el valor citado sigue siendo el del servidor.
    expect(substituteMarkers('[[e1]] gastó [[ev_e1_spend]].', c))
      .toBe(`${ADVERSARIAL_NAMES[0]} gastó USD 999,00.`);
  });

  it('el esquema estricto de salida no admite claves ajenas', () => {
    expect(reportOutputSchema.safeParse({ ...validOutput(), sql: 'select 1' }).success).toBe(false);
  });
});
