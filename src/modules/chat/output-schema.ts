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
  if ((choice.action === 'clarify') !== (choice.clarification_text !== null) ||
      (choice.action === 'abstain') !== (choice.abstain_reason !== null) ||
      (choice.action !== 'call_tools' && choice.calls.length > 0)) {
    ctx.addIssue({ code: 'custom', message: 'Elección incoherente.' });
  }
});

export type ChatChoice = z.infer<typeof choiceSchema>;

const spanProperties = { quote: { type: 'string' }, occurrence: { type: 'integer' } };
const claimProperties = {
  span: jsonObject(spanProperties),
  kind: { type: 'string', enum: ['observed_value', 'period_bound', 'coverage_count',
    'qualitative_comparison', 'user_provided'] },
  tool_call_id: nullableString, path: nullableString, metric: nullableString,
  unit: nullableString, currency: nullableString, account_ref: nullableString,
  level: nullableString, entity_ref: nullableString, action_type: nullableString,
  attribution_ref: nullableString, period: nullablePeriod,
  period_a: nullablePeriod, period_b: nullablePeriod,
  bound: nullableString, field: nullableString,
  left_tool_call_id: nullableString, left_path: nullableString,
  right_tool_call_id: nullableString, right_path: nullableString,
  relation: nullableString,
};
const claimJsonSchema = jsonObject(claimProperties);
const blockTypes = ['tarjeta', 'lineas', 'barras', 'barras_agrupadas', 'dona', 'tabla',
  'resumen_variacion', 'periodo_contra_periodo', 'barras_apiladas', 'ranking',
  'tabla_tendencia', 'tabla_desplegable', 'embudo', 'calendario_calor',
  'desglose_tipo_resultado', 'estado_datos', 'conclusiones', 'fuentes_metodologia',
  'preguntas_sugeridas'] as const;
export type ChatBlockType = typeof blockTypes[number];
const suggestedIds = ['ver_por_conjunto', 'comparar_periodo_anterior', 'ver_en_tabla',
  'ver_por_edad_y_genero', 'ver_por_pais', 'ver_estado_de_los_datos'] as const;
const provenance = ['system_fact', 'calculated_metric', 'inference'] as const;

export const ANSWER_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'chat_answer', strict: true,
    schema: jsonObject({
      text: { type: 'string', maxLength: 1500 },
      claims: { type: 'array', items: claimJsonSchema },
      blocks: { type: 'array', maxItems: CHAT_LIMITS.maxBlocksPerAnswer,
        items: jsonObject({
          type: { type: 'string', enum: [...blockTypes] },
          sources: { type: 'array', items: jsonObject({
            tool_call_id: { type: 'string' }, path_prefix: { type: 'string' },
          }) },
          options: { ...jsonObject({ ordering: { type: 'string',
            enum: ['value_desc', 'value_asc', 'source'] } }), type: ['object', 'null'] },
          items: { type: ['array', 'null'], items: jsonObject({
            text: { type: 'string' }, claims: { type: 'array', items: claimJsonSchema },
            provenance: { type: 'string', enum: [...provenance] },
          }) },
          ids: { type: ['array', 'null'], items: { type: 'string', enum: [...suggestedIds] } },
        }) },
    }),
  },
} as const;

const claimSchema = z.strictObject({
  span: z.strictObject({ quote: z.string().min(1), occurrence: z.number().int().min(1) }),
  kind: z.enum(['observed_value', 'period_bound', 'coverage_count',
    'qualitative_comparison', 'user_provided']),
  tool_call_id: z.string().nullable(), path: z.string().nullable(),
  metric: z.string().nullable(), unit: z.string().nullable(),
  currency: z.string().nullable(), account_ref: z.string().nullable(),
  level: z.string().nullable(), entity_ref: z.string().nullable(),
  action_type: z.string().nullable(), attribution_ref: z.string().nullable(),
  period: nullablePeriodSchema, period_a: nullablePeriodSchema,
  period_b: nullablePeriodSchema, bound: z.string().nullable(),
  field: z.string().nullable(), left_tool_call_id: z.string().nullable(),
  left_path: z.string().nullable(), right_tool_call_id: z.string().nullable(),
  right_path: z.string().nullable(), relation: z.string().nullable(),
});
const sourceSchema = z.strictObject({ tool_call_id: z.string(), path_prefix: z.string() });
const itemSchema = z.strictObject({
  text: z.string(), claims: z.array(claimSchema), provenance: z.enum(provenance),
});
const blockSchema = z.strictObject({
  type: z.enum(blockTypes), sources: z.array(sourceSchema),
  options: z.strictObject({ ordering: z.enum(['value_desc', 'value_asc', 'source']) }).nullable(),
  items: z.array(itemSchema).nullable(), ids: z.array(z.enum(suggestedIds)).nullable(),
});

export const answerSchema = z.strictObject({
  text: z.string().max(1500), claims: z.array(claimSchema),
  blocks: z.array(blockSchema).max(CHAT_LIMITS.maxBlocksPerAnswer),
});
export type FlatChatAnswer = z.infer<typeof answerSchema>;

export class OutputProjectionError extends Error {
  constructor() { super('Salida del modelo inválida.'); }
}

const claimFields: Record<FlatChatAnswer['claims'][number]['kind'], readonly string[]> = {
  observed_value: ['tool_call_id', 'path', 'metric', 'unit', 'currency', 'account_ref',
    'level', 'entity_ref', 'action_type', 'attribution_ref', 'period', 'period_a', 'period_b'],
  period_bound: ['tool_call_id', 'bound'],
  coverage_count: ['tool_call_id', 'field'],
  qualitative_comparison: ['left_tool_call_id', 'left_path', 'right_tool_call_id',
    'right_path', 'relation'],
  user_provided: [],
};
const requiredClaimFields: Record<FlatChatAnswer['claims'][number]['kind'], readonly string[]> = {
  observed_value: ['tool_call_id', 'path', 'metric', 'unit'],
  period_bound: ['tool_call_id', 'bound'],
  coverage_count: ['tool_call_id', 'field'],
  qualitative_comparison: ['left_tool_call_id', 'left_path', 'right_tool_call_id',
    'right_path', 'relation'],
  user_provided: [],
};

function projectClaim(claim: FlatChatAnswer['claims'][number]): Record<string, unknown> {
  const fields = new Set(claimFields[claim.kind]);
  const required = requiredClaimFields[claim.kind];
  const raw = claim as unknown as Record<string, unknown>;
  const projected: Record<string, unknown> = { span: claim.span, kind: claim.kind };
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'span' || key === 'kind') continue;
    if (!fields.has(key) && value !== null) throw new OutputProjectionError();
    if (fields.has(key)) projected[key] = value;
  }
  if (required.some((key) => projected[key] === null || projected[key] === undefined)) {
    throw new OutputProjectionError();
  }
  return projected;
}

export function projectOutput(flat: FlatChatAnswer): {
  text: string; claims: Record<string, unknown>[]; blocks: Record<string, unknown>[];
} {
  const parsed = answerSchema.safeParse(flat);
  if (!parsed.success) throw new OutputProjectionError();
  const claims = parsed.data.claims.map(projectClaim);
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
    if (isConclusion) projected.items = block.items?.map((item) => ({
      ...item, claims: item.claims.map(projectClaim),
    }));
    if (isSuggested) projected.ids = block.ids;
    return projected;
  });
  return { text: parsed.data.text, claims, blocks };
}
