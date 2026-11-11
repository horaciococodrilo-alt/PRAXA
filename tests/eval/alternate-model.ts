/** Solo el arnés cambia model; la petición estricta y los demás campos quedan intactos. */
export const EVAL_ALTERNATE_MODEL = 'deepseek-ai/DeepSeek-V4-Pro';

export function createAlternateModelFetch(model: typeof EVAL_ALTERNATE_MODEL,
  transport: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    if (typeof init?.body !== 'string') throw new Error('eval_model_body_missing');
    const body = JSON.parse(init.body) as Record<string, unknown>;
    return transport(input, { ...init, body: JSON.stringify({ ...body, model }) });
  };
}
