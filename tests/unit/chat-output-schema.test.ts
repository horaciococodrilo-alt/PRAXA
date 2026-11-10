import { describe, expect, it } from 'vitest';

import { projectOutput, OutputProjectionError, type FlatChatAnswer } from '@/modules/chat/output-schema';

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
