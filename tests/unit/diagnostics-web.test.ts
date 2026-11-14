import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  ALLOWED_WEB_DOMAINS,
  extractWebContext,
  webPrompt,
  webQueryFor,
  webTopicFor,
} from '@/modules/diagnostics/web';

const NOW = new Date('2026-11-13T12:00:00Z');

function result(url: string, over: Record<string, unknown> = {}) {
  return { type: 'web_search_result', url, title: 'Guía oficial', page_age: 'March 3, 2026',
    encrypted_content: 'x', ...over };
}

function cited(url: string, text: string) {
  return { type: 'web_search_result_location', url, title: 'Guía oficial', cited_text: text, encrypted_index: 'y' };
}

function blocks(results: unknown, citations: unknown[]) {
  return [
    { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'q' } },
    { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: results },
    { type: 'text', text: 'Resumen.', citations },
  ];
}

const FB = 'https://www.facebook.com/business/help/guia-anuncios';
const CACE = 'https://cace.org.ar/estudio-comercio';

describe('M26a-T-15: petición web genérica', () => {
  it('la lista de dominios es la aprobada por el usuario', () => {
    expect(ALLOWED_WEB_DOMAINS).toEqual(['www.facebook.com', 'cace.org.ar', 'www.indec.gob.ar']);
  });

  it('solo país, rubro de lista y tema fijo', () => {
    expect(webTopicFor('purchase')).toBe('seasonality');
    expect(webTopicFor('inquiry')).toBe('practices');
    expect(webTopicFor('traffic')).toBe('practices');
    expect(webQueryFor({ country: 'Argentina', industry: 'Hogar y decoración' }, 'purchase'))
      .toBe('fechas comerciales y estacionalidad del comercio electrónico Hogar y decoración Argentina');
    expect(webQueryFor({ country: 'Argentina', industry: 'Belleza y salud' }, 'traffic'))
      .toBe('buenas prácticas de anuncios de Meta para tiendas online Belleza y salud Argentina');
  });

  it('sin rubro de lista, con «Otro» o fuera de Argentina no hay paso web', () => {
    expect(webQueryFor({ country: 'Argentina', industry: 'Otro' }, 'purchase')).toBeNull();
    expect(webQueryFor({ country: 'Argentina', industry: null }, 'purchase')).toBeNull();
    expect(webQueryFor({ country: 'Argentina', industry: 'Rubro inventado' }, 'purchase')).toBeNull();
    expect(webQueryFor({ country: 'Chile', industry: 'Hogar y decoración' }, 'purchase')).toBeNull();
    expect(webQueryFor({ country: null, industry: 'Hogar y decoración' }, 'purchase')).toBeNull();
  });

  it('el texto enviado contiene la consulta y nada del paquete Meta', () => {
    const query = webQueryFor({ country: 'Argentina', industry: 'Hogar y decoración' }, 'purchase')!;
    const prompt = webPrompt(query);
    expect(prompt).toContain(query);
    expect(prompt).not.toMatch(/\d/);
    expect(prompt).not.toMatch(/act_|ev_|USD|ARS|campaña|empresa/i);
  });
});

describe('M26a-T-15: validación de fuentes', () => {
  it('acepta https de dominio permitido con título, fecha y extracto sin cifras', () => {
    const out = extractWebContext(blocks([result(FB), result(CACE)],
      [cited(FB, 'Probá distintos anuncios y medí resultados.'), cited(CACE, 'Las fechas comerciales concentran la demanda.')]), NOW);
    expect(out.sources).toEqual([
      { index: 1, url: FB, title: 'Guía oficial', page_age: 'March 3, 2026', domain: 'www.facebook.com' },
      { index: 2, url: CACE, title: 'Guía oficial', page_age: 'March 3, 2026', domain: 'cace.org.ar' },
    ]);
    expect(out.excerpts).toEqual([
      { source_index: 1, text: 'Probá distintos anuncios y medí resultados.' },
      { source_index: 2, text: 'Las fechas comerciales concentran la demanda.' },
    ]);
  });

  it.each([
    ['no https', 'http://cace.org.ar/x', {}],
    ['host fuera de la lista', 'https://ejemplo.com/x', {}],
    ['subdominio parecido', 'https://cace.org.ar.ejemplo.com/x', {}],
    ['facebook fuera de /business/help/', 'https://www.facebook.com/otra-pagina', {}],
    ['sin título', CACE, { title: '' }],
    ['sin fecha', CACE, { page_age: null }],
    ['fecha no interpretable', CACE, { page_age: 'hace un rato' }],
    ['fecha futura', CACE, { page_age: 'December 1, 2027' }],
  ])('descarta: %s', (_label, url, over) => {
    const out = extractWebContext(blocks([result(url, over)], [cited(url, 'Texto sin cifras.')]), NOW);
    expect(out.sources).toEqual([]);
    expect(out.excerpts).toEqual([]);
  });

  it.each(['120 days ago', '1 day ago', '3 weeks ago', '2 months ago', '1 year ago', '2026-03-03'])(
    'acepta la edad de página «%s»', (pageAge) => {
      const out = extractWebContext(blocks([result(CACE, { page_age: pageAge })], [cited(CACE, 'Texto sin cifras.')]), NOW);
      expect(out.sources).toHaveLength(1);
      expect(out.sources[0].page_age).toBe(pageAge);
    });

  it('descarta extractos con numerales y la fuente que queda sin extracto', () => {
    const out = extractWebContext(blocks([result(CACE)], [cited(CACE, 'Las ventas crecieron un 35% en 2025.')]), NOW);
    expect(out.sources).toEqual([]);
  });

  it('un error de la herramienta dentro de un 200 omite el contexto', () => {
    const out = extractWebContext(blocks({ type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' },
      [cited(CACE, 'Texto.')]), NOW);
    expect(out).toEqual({ sources: [], excerpts: [] });
    const mixed = extractWebContext([...blocks([result(CACE)], [cited(CACE, 'Texto.')]),
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_2',
        content: { type: 'web_search_tool_result_error', error_code: 'too_many_requests' } }], NOW);
    expect(mixed).toEqual({ sources: [], excerpts: [] });
  });

  it('una cita a una URL que no vino en los resultados no se acepta', () => {
    const out = extractWebContext(blocks([result(CACE)], [cited('https://cace.org.ar/otra', 'Texto.')]), NOW);
    expect(out.sources).toEqual([]);
  });

  it('bloques inesperados no rompen la extracción', () => {
    expect(extractWebContext([{ type: 'raro' }, null, 'texto'] as unknown[], NOW)).toEqual({ sources: [], excerpts: [] });
  });
});
