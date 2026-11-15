import { describe, expect, it } from 'vitest';

import { CHOICE_FORMAT, choiceFormat, choiceSchema, projectOutput, OutputProjectionError,
  type FlatChatAnswer } from '@/modules/chat/output-schema';

const block = (type: string, sources: { tool_call_id: string; path_prefix: string }[],
  extra: Record<string, unknown> = {}) => ({ type, sources, options: null, items: null,
  ids: null, ...extra });
const answer = (text: string, blocks: unknown[] = []) => ({ text, blocks }) as FlatChatAnswer;

describe('forma de la salida del modelo (sin verificación de contenido)', () => {
  it('acepta el texto tal cual lo escribe el modelo, con cifras incluidas', () => {
    expect(projectOutput(answer('Gastaste 1.234,50 el 01/01/2026.')).text)
      .toBe('Gastaste 1.234,50 el 01/01/2026.');
  });

  it('rechaza campos ajenos al contrato y combinaciones de variante inválidas', () => {
    for (const extra of [{ value: '123' }, { title: 'Inventado' }, { code: 'alert(1)' }]) {
      expect(() => projectOutput({ ...answer('texto'), blocks: [
        { ...block('tabla', [{ tool_call_id: 't1', path_prefix: '/values' }]), ...extra }],
      } as FlatChatAnswer)).toThrow(OutputProjectionError);
    }
    expect(() => projectOutput(answer('texto', [block('tabla', [])])))
      .toThrow(OutputProjectionError);
    expect(() => projectOutput(answer('texto', [block('barras',
      [{ tool_call_id: 't1', path_prefix: '/values' }])]))).toThrow(OutputProjectionError);
  });

  it('proyecta cada uno de los 19 tipos de bloque', () => {
    const types = ['tarjeta', 'lineas', 'barras', 'barras_agrupadas', 'dona', 'tabla',
      'resumen_variacion', 'periodo_contra_periodo', 'barras_apiladas', 'ranking',
      'tabla_tendencia', 'tabla_desplegable', 'embudo', 'calendario_calor',
      'desglose_tipo_resultado', 'estado_datos', 'conclusiones', 'fuentes_metodologia',
      'preguntas_sugeridas'];
    for (const type of types) {
      const extra = type === 'barras' ? { options: { ordering: 'source' } } :
        type === 'conclusiones' ? { items: [{ text: 'Dato' }] } :
          type === 'preguntas_sugeridas' ? { ids: ['ver_en_tabla'] } : {};
      const sources = ['conclusiones', 'preguntas_sugeridas'].includes(type) ? [] :
        [{ tool_call_id: 't1', path_prefix: '/values' }];
      expect(projectOutput(answer('texto', [block(type, sources, extra)])).blocks[0].type)
        .toBe(type);
    }
  });
});

describe('M16e-T-11: elección con las herramientas de Tiendanube', () => {
  const flat = { level: null, entity_ref: null, metric: null, period: null, period_a: null,
    period_b: null, action_type: null, order: null, limit: null, include_trend: null, dimension: null };

  it('el formato estricto suma cuatro claves anulables y limita el catálogo a lo ofrecido', () => {
    const format = choiceFormat(['tn_ventas', 'tn_cobertura']);
    const schema = format.json_schema.schema as unknown as { properties: { calls: { items: {
      properties: { name: { enum: string[] }; args: { properties: Record<string, unknown>; required: string[] } } } } } };
    const item = schema.properties.calls.items.properties;
    expect(item.name.enum).toEqual(['tn_ventas', 'tn_cobertura']);
    for (const key of ['granularity', 'from_month', 'to_month', 'max_offset']) {
      expect(item.args.required).toContain(key);
    }
    const all = CHOICE_FORMAT.json_schema.schema as unknown as typeof schema;
    expect(all.properties.calls.items.properties.name.enum).toHaveLength(17);
  });

  it('acepta abstain con connection_not_active y los argumentos nuevos, y sigue aceptando la forma vieja', () => {
    expect(choiceSchema.parse({ action: 'abstain', calls: [], clarification_text: null,
      abstain_reason: 'connection_not_active' }).abstain_reason).toBe('connection_not_active');
    const parsed = choiceSchema.parse({ action: 'call_tools', clarification_text: null, abstain_reason: null,
      calls: [{ name: 'tn_cohortes', args: { ...flat, granularity: null, from_month: '2026-01',
        to_month: '2026-03', max_offset: 2 } }] });
    expect(parsed.calls[0].args).toMatchObject({ from_month: '2026-01', to_month: '2026-03', max_offset: 2 });
    const legacy = choiceSchema.parse({ action: 'call_tools', clarification_text: null, abstain_reason: null,
      calls: [{ name: 'total', args: flat }] });
    expect(legacy.calls[0].args).toMatchObject({ granularity: null, from_month: null, to_month: null,
      max_offset: null });
    expect(() => choiceSchema.parse({ action: 'abstain', calls: [], clarification_text: null,
      abstain_reason: 'no_coverage' })).toThrow();
  });
});
