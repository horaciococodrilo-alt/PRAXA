import { describe, expect, it, vi } from 'vitest';

/**
 * M27a-T-05 (parte unitaria) y C-04: lector monetario estricto de M27a.
 *
 * Todo importe es sintético. El caso clave es el transporte: `getJson` decodifica con
 * `JSON.parse`, así que un token numérico JSON llega como `number` y sus dígitos originales ya
 * no se pueden recuperar. M27a lo trata como `incomplete`, nunca como importe exacto.
 */

vi.mock('server-only', () => ({}));

const monetary = await import('@/modules/customer-insights/monetary');
const { createTiendanubeHttpClient } = await import('@/modules/integrations/tiendanube/client');
const { SecretValue } = await import('@/modules/integrations/crypto/seal');

const A = 'tn_paid_current_observed_v1' as const;
const B = 'tn_paid_current_less_verified_refunds_v1' as const;

/** Cuerpo JSON literal tal como lo mandaría Tiendanube, pasado por el cliente real. */
async function decoded(json: string): Promise<unknown> {
  const http = createTiendanubeHttpClient({
    userAgent: 'PRAXA prueba (sintetica@praxa.test)',
    fetch: async () => new Response(json, { status: 200, headers: { 'content-type': 'application/json' } }),
  });
  const { body } = await http.getJson('98765', 'orders', {}, new SecretValue('token-sint'), 'order');
  return body;
}

describe('M27A_MONETARY_DEFINITION', () => {
  it('empieza nula: T-04 no se ejecutó', () => {
    expect(monetary.M27A_MONETARY_DEFINITION).toBeNull();
  });
});

describe('parseStrictAmount', () => {
  it('acepta solo strings decimales no negativos y conserva sus dígitos', () => {
    expect(monetary.parseStrictAmount('1234.50')).toBe('1234.50');
    expect(monetary.parseStrictAmount('  0.000001 ')).toBe('0.000001');
    expect(monetary.parseStrictAmount('999999999999999.999999')).toBe('999999999999999.999999');
    expect(monetary.parseStrictAmount('0')).toBe('0');
  });

  it('rechaza números, exponentes, separadores, signo y precisión de más', () => {
    for (const value of [12.5, 0, '1e3', '1,5', '1.234,50', '-1', '+1', '1.1234567', '1234567890123456',
      '', ' ', null, undefined, true, {}, [], '.5', '5.']) {
      expect(monetary.parseStrictAmount(value)).toBeNull();
    }
  });
});

describe('transporte → parser (T-05)', () => {
  it('un token numérico de alta precisión llega como number y queda incomplete', async () => {
    const body = await decoded('[{"total_paid_by_customer": 1234567890.123456789}]') as Array<Record<string, unknown>>;
    expect(typeof body[0].total_paid_by_customer).toBe('number');
    expect(monetary.insightsMonetaryFields({ rawOrder: body[0], definition: A }))
      .toEqual({ insights_amount: null, insights_amount_status: 'incomplete', insights_amount_definition: null });
  });

  it('un string JSON decimal conserva exactamente sus dígitos', async () => {
    const body = await decoded('[{"total_paid_by_customer": "1234567890.123456"}]') as Array<Record<string, unknown>>;
    expect(monetary.insightsMonetaryFields({ rawOrder: body[0], definition: A }))
      .toEqual({ insights_amount: '1234567890.123456', insights_amount_status: 'verified', insights_amount_definition: A });
  });

  it('total_paid_diff numérico en el historial deja B incomplete', async () => {
    const history = await decoded('[{"event":"PAID","total_paid_diff": -10.123456789}]');
    expect(monetary.verifiedRefundSum(history)).toEqual({ status: 'invalid' });
    expect(monetary.insightsMonetaryFields({ rawOrder: { total_paid_by_customer: '100.00' }, definition: B, history }))
      .toEqual({ insights_amount: null, insights_amount_status: 'incomplete', insights_amount_definition: null });
  });

  it('total_paid_diff como string se descuenta exacto en B', async () => {
    const history = await decoded('[{"event":"PAID","total_paid_diff":"-10.25"},{"event":"OTHER","total_paid_diff":5}]');
    expect(monetary.verifiedRefundSum(history)).toEqual({ status: 'ok', sum: '10.25' });
    expect(monetary.insightsMonetaryFields({ rawOrder: { total_paid_by_customer: '100.00' }, definition: B, history }))
      .toEqual({ insights_amount: '89.75', insights_amount_status: 'verified', insights_amount_definition: B });
  });
});

describe('insightsMonetaryFields', () => {
  it('sin definición publica siempre null, unverified, null', () => {
    expect(monetary.insightsMonetaryFields({ rawOrder: { total_paid_by_customer: '100.00' }, definition: null }))
      .toEqual({ insights_amount: null, insights_amount_status: 'unverified', insights_amount_definition: null });
    expect(monetary.insightsMonetaryFields({ rawOrder: null, definition: null }))
      .toEqual({ insights_amount: null, insights_amount_status: 'unverified', insights_amount_definition: null });
  });

  it('A: campo ausente o malformado es incomplete, nunca cero', () => {
    for (const rawOrder of [{}, { total_paid_by_customer: null }, { total_paid_by_customer: 'abc' }, null, 'x']) {
      expect(monetary.insightsMonetaryFields({ rawOrder, definition: A }).insights_amount_status).toBe('incomplete');
      expect(monetary.insightsMonetaryFields({ rawOrder, definition: A }).insights_amount).toBeNull();
    }
  });

  it('A: cero verificado es un cero, no una ausencia', () => {
    expect(monetary.insightsMonetaryFields({ rawOrder: { total_paid_by_customer: '0.00' }, definition: A }))
      .toEqual({ insights_amount: '0.00', insights_amount_status: 'verified', insights_amount_definition: A });
  });

  it('B: historial no leído, ilegible o con una diferencia inválida es incomplete', () => {
    const raw = { total_paid_by_customer: '50' };
    expect(monetary.insightsMonetaryFields({ rawOrder: raw, definition: B }).insights_amount_status).toBe('incomplete');
    for (const history of [null, 'x', { values: 'x' }, [{ event: 'PAID', total_paid_diff: 'abc' }],
      [{ event: 'PAID' }], [{ event: 'PAID', total_paid_diff: '1e2' }]]) {
      expect(monetary.insightsMonetaryFields({ rawOrder: raw, definition: B, history }).insights_amount_status)
        .toBe('incomplete');
    }
  });

  it('B: sin reembolsos el monto es el pagado; varias devoluciones se suman una sola vez', () => {
    expect(monetary.insightsMonetaryFields({ rawOrder: { total_paid_by_customer: '50' }, definition: B, history: [] }))
      .toEqual({ insights_amount: '50', insights_amount_status: 'verified', insights_amount_definition: B });
    const history = { values: [
      { event: 'PAID', total_paid_diff: '-5.5' },
      { event: 'PAID', total_paid_diff: '20' },
      { type: 'paid', total_paid_diff: '-4.500000' },
    ] };
    expect(monetary.verifiedRefundSum(history)).toEqual({ status: 'ok', sum: '10' });
    expect(monetary.insightsMonetaryFields({ rawOrder: { total_paid_by_customer: '50' }, definition: B, history }).insights_amount)
      .toBe('40');
  });

  it('B: devolución mayor que la base es inconsistent, nunca se recorta a cero', () => {
    const history = [{ event: 'PAID', total_paid_diff: '-60' }];
    expect(monetary.insightsMonetaryFields({ rawOrder: { total_paid_by_customer: '50' }, definition: B, history }))
      .toEqual({ insights_amount: null, insights_amount_status: 'inconsistent', insights_amount_definition: null });
  });

  it('no reutiliza la conversión heredada: un number nunca se vuelve texto', () => {
    expect(monetary.insightsMonetaryFields({ rawOrder: { total_paid_by_customer: 10 }, definition: A }).insights_amount)
      .toBeNull();
  });
});

describe('modo demo local (H-E1-278)', () => {
  it('solo con la variable exacta y fuera de producción', () => {
    expect(monetary.demoMonetaryDefinition({})).toBeNull();
    expect(monetary.demoMonetaryDefinition({ PRAXA_DEMO_MONETARY_DEFINITION: 'tn_paid_current_observed_v1', NODE_ENV: 'development' }))
      .toBe('tn_paid_current_observed_v1');
    expect(monetary.demoMonetaryDefinition({ PRAXA_DEMO_MONETARY_DEFINITION: 'tn_paid_current_observed_v1', NODE_ENV: 'production' }))
      .toBeNull();
    expect(monetary.demoMonetaryDefinition({ PRAXA_DEMO_MONETARY_DEFINITION: 'tn_paid_current_less_verified_refunds_v1' }))
      .toBeNull();
  });

  it('la sincronización real no usa la demo: la constante sigue nula', () => {
    expect(monetary.M27A_MONETARY_DEFINITION).toBeNull();
    expect(monetary.viewMonetaryDefinition({ PRAXA_DEMO_MONETARY_DEFINITION: 'tn_paid_current_observed_v1', NODE_ENV: 'production' }))
      .toBeNull();
  });
});
