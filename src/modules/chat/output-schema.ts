import { z } from 'zod';

import { CHAT_LIMITS } from './limits';
import { TOOL_NAMES } from './tools/schema';

const jsonObject = (properties: Record<string, unknown>) => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
});
const nullableString = { type: ['string', 'null'] };
const nullableInteger = { type: ['integer', 'null'] };
const periodProperties = { from: { type: 'string' }, to: { type: 'string' } };
const nullablePeriod = { ...jsonObject(periodProperties), type: ['object', 'null'] };

const toolArgsProperties = {
  level: nullableString, entity_ref: nullableString, metric: nullableString,
  period: nullablePeriod, period_a: nullablePeriod, period_b: nullablePeriod,
  action_type: nullableString, order: nullableString, limit: nullableInteger,
  include_trend: { type: ['boolean', 'null'] }, dimension: nullableString,
};

export const CHOICE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'chat_choice', strict: true,
    schema: jsonObject({
      action: { type: 'string', enum: ['call_tools', 'answer', 'clarify', 'abstain'] },
      calls: { type: 'array', maxItems: CHAT_LIMITS.maxToolCallsPerTurn,
        items: jsonObject({ name: { type: 'string', enum: [...TOOL_NAMES] },
          args: jsonObject(toolArgsProperties) }) },
      clarification_text: nullableString,
      abstain_reason: { type: ['string', 'null'], enum: ['out_of_scope', null] },
    }),
  },
} as const;

const periodSchema = z.strictObject({ from: z.iso.date(), to: z.iso.date() });
const nullablePeriodSchema = periodSchema.nullable();
const toolArgsSchema = z.strictObject({
  level: z.string().nullable(), entity_ref: z.string().nullable(),
  metric: z.string().nullable(), period: nullablePeriodSchema,
  period_a: nullablePeriodSchema, period_b: nullablePeriodSchema,
  action_type: z.string().nullable(), order: z.string().nullable(),
  limit: z.number().int().nullable(), include_trend: z.boolean().nullable(),
  dimension: z.string().nullable(),
});

export const choiceSchema = z.strictObject({
  action: z.enum(['call_tools', 'answer', 'clarify', 'abstain']),
  calls: z.array(z.strictObject({ name: z.enum(TOOL_NAMES), args: toolArgsSchema }))
    .max(CHAT_LIMITS.maxToolCallsPerTurn),
  clarification_text: z.string().max(CHAT_LIMITS.maxClarificationChars).nullable(),
  abstain_reason: z.enum(['out_of_scope']).nullable(),
}).superRefine((choice, ctx) => {
  if ((choice.action === 'clarify' && choice.clarification_text === null) ||
      (choice.action === 'abstain' && choice.abstain_reason === null) ||
      (choice.action === 'call_tools' && choice.calls.length === 0)) {
    ctx.addIssue({ code: 'custom', message: 'Elección incoherente.' });
  }
}).transform((choice) => {
  const action = choice.action === 'answer' && choice.calls.length > 0 ?
    'call_tools' as const : choice.action;
  return { action, calls: action === 'call_tools' ? choice.calls : [],
    clarification_text: action === 'clarify' ? choice.clarification_text : null,
    abstain_reason: action === 'abstain' ? choice.abstain_reason : null };
});

export type ChatChoice = z.infer<typeof choiceSchema>;

const blockTypes = ['tarjeta', 'lineas', 'barras', 'barras_agrupadas', 'dona', 'tabla',
  'resumen_variacion', 'periodo_contra_periodo', 'barras_apiladas', 'ranking',
  'tabla_tendencia', 'tabla_desplegable', 'embudo', 'calendario_calor',
  'desglose_tipo_resultado', 'estado_datos', 'conclusiones', 'fuentes_metodologia',
  'preguntas_sugeridas'] as const;
export type ChatBlockType = typeof blockTypes[number];
const suggestedIds = ['ver_por_conjunto', 'comparar_periodo_anterior', 'ver_en_tabla',
  'ver_por_edad_y_genero', 'ver_por_pais', 'ver_estado_de_los_datos'] as const;

export const ANSWER_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'chat_answer', strict: true,
    schema: jsonObject({
      text: { type: 'string', maxLength: 1500 },
      blocks: { type: 'array', maxItems: CHAT_LIMITS.maxBlocksPerAnswer,
        items: jsonObject({
          type: { type: 'string', enum: [...blockTypes] },
          sources: { type: 'array', items: jsonObject({
            tool_call_id: { type: 'string' }, path_prefix: { type: 'string' },
          }) },
          options: { ...jsonObject({ ordering: { type: 'string',
            enum: ['value_desc', 'value_asc', 'source'] } }), type: ['object', 'null'] },
          items: { type: ['array', 'null'], items: jsonObject({ text: { type: 'string' } }) },
          ids: { type: ['array', 'null'], items: { type: 'string', enum: [...suggestedIds] } },
        }) },
    }),
  },
} as const;

const sourceSchema = z.strictObject({ tool_call_id: z.string(), path_prefix: z.string() });
const itemSchema = z.strictObject({ text: z.string() });
const blockSchema = z.strictObject({
  type: z.enum(blockTypes), sources: z.array(sourceSchema),
  options: z.strictObject({ ordering: z.enum(['value_desc', 'value_asc', 'source']) }).nullable(),
  items: z.array(itemSchema).nullable(), ids: z.array(z.enum(suggestedIds)).nullable(),
});

export const answerSchema = z.strictObject({
  text: z.string().max(1500),
  blocks: z.array(blockSchema).max(CHAT_LIMITS.maxBlocksPerAnswer),
});
export type FlatChatAnswer = z.infer<typeof answerSchema>;

export class OutputProjectionError extends Error {
  constructor() { super('Salida del modelo inválida.'); }
}

/** Proyecta solo la forma de la salida: nada de lo que escribe el modelo se verifica. */
export function projectOutput(flat: FlatChatAnswer): {
  text: string; blocks: Record<string, unknown>[];
} {
  const parsed = answerSchema.safeParse(flat);
  if (!parsed.success) throw new OutputProjectionError();
  const blocks = parsed.data.blocks.map((block) => {
    const isBar = block.type === 'barras';
    const isConclusion = block.type === 'conclusiones';
    const isSuggested = block.type === 'preguntas_sugeridas';
    if ((!isBar && block.options !== null) || (isBar && block.options === null) ||
        (!isConclusion && block.items !== null) || (isConclusion && block.items === null) ||
        (!isSuggested && block.ids !== null) || (isSuggested && block.ids === null) ||
        (!isConclusion && !isSuggested && block.sources.length === 0)) {
      throw new OutputProjectionError();
    }
    const projected: Record<string, unknown> = { type: block.type, sources: block.sources };
    if (isBar) projected.options = block.options;
    if (isConclusion) projected.items = block.items;
    if (isSuggested) projected.ids = block.ids;
    return projected;
  });
  return { text: parsed.data.text, blocks };
}
