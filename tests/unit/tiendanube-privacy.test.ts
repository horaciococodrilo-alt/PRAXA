import { createHmac } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * M16e-T-06, parte unitaria (paso 6): webhooks de privacidad de Tiendanube contra una base
 * simulada. La firma se arma con un secreto sintético.
 */

vi.mock('server-only', () => ({}));

const SECRET = 'secreto-sint-tn';
const STORE = '98765';
const config = await import('@/modules/integrations/tiendanube/config');
const privacy = await import('@/modules/integrations/tiendanube/privacy');

type WorkerApi = import('@/modules/integrations/db/worker-api').WorkerApi;
type PrivacyDeps = import('@/modules/integrations/tiendanube/privacy').PrivacyDeps;

const CONFIG = config.readTiendanubeConfig({ TIENDANUBE_APP_ID: '4321', TIENDANUBE_CLIENT_SECRET: SECRET,
  TIENDANUBE_SUPPORT_CONTACT: 'soporte@praxa.test',
  TIENDANUBE_REDIRECT_URI: 'https://praxa.test/api/integraciones/tiendanube/callback' } as unknown as NodeJS.ProcessEnv);

const sign = (body: string, secret = SECRET) => createHmac('sha256', secret).update(body).digest('hex');

const PII = { email: 'persona@ejemplo.test', phone: '+5491100000000', identification: '20123456789' };
const customerBody = JSON.stringify({ store_id: Number(STORE), customer: { id: 501, ...PII },
  orders_to_redact: [9001, '9002', 9001] });
const storeBody = JSON.stringify({ store_id: Number(STORE) });

function request(body: string, signature: string | null = sign(body), headers: Record<string, string> = {}) {
  const init: Record<string, string> = { 'content-type': 'application/json', ...headers };
  if (signature !== null) init[privacy.SIGNATURE_HEADER] = signature;
  return new Request('https://praxa.test/api/integraciones/tiendanube/privacidad/x', { method: 'POST', body,
    headers: init });
}

let clock = 0;
let logs: unknown[] = [];

function fakeWorker(phases: Record<string, Array<string | Error>>) {
  const calls: Array<{ fn: string; args: readonly unknown[] }> = [];
  const workerApi: WorkerApi = {
    call: (async (fn: string, args: readonly unknown[]) => {
      calls.push({ fn, args });
      clock += 100;
      const next = phases[fn]?.shift();
      if (next === undefined) throw new Error(`no esperada: ${fn}`);
      if (next instanceof Error) throw next;
      return [{ [fn]: next }];
    }) as WorkerApi['call'],
  };
  return { workerApi, calls };
}

function deps(worker: ReturnType<typeof fakeWorker>, over: Partial<PrivacyDeps> = {}): Partial<PrivacyDeps> {
  return { config: () => CONFIG, workerApi: () => worker.workerApi, now: () => clock,
    log: (event) => logs.push(event), ...over };
}

beforeEach(() => {
  clock = 0;
  logs = [];
});

/** Nada del cuerpo llega al registro. */
function expectRedactedLogs() {
  const text = JSON.stringify(logs);
  for (const value of [STORE, '501', '9001', PII.email, PII.phone, PII.identification]) expect(text).not.toContain(value);
}

describe('M16e-T-06: autenticación y forma del webhook', () => {
  it('firma ausente, de otro secreto, mal formada o de otro cuerpo → 401 sin tocar la base', async () => {
    for (const signature of [null, sign(storeBody, 'otro'), 'zz', sign(`${storeBody} `)]) {
      const worker = fakeWorker({});
      const response = await privacy.handlePrivacyWebhook('store_redact', request(storeBody, signature), deps(worker));
      expect(response.status).toBe(401);
      expect(worker.calls).toEqual([]);
    }
    expect(logs.every((event) => (event as { firma_valida?: boolean }).firma_valida === false)).toBe(true);
  });

  it('acepta la firma en mayúsculas (hexadecimal) y compara el cuerpo crudo, no el JSON reparseado', async () => {
    const body = `{ "store_id" : ${STORE} }`;
    const worker = fakeWorker({ tn_privacy_store_redact: ['done'] });
    const response = await privacy.handlePrivacyWebhook('store_redact', request(body, sign(body).toUpperCase()),
      deps(worker));
    expect(response.status).toBe(200);
  });

  it('un cuerpo de más de 64 KB se rechaza antes de verificar o parsear', async () => {
    const big = JSON.stringify({ store_id: Number(STORE), relleno: 'x'.repeat(65 * 1024) });
    const worker = fakeWorker({});
    expect((await privacy.handlePrivacyWebhook('store_redact', request(big), deps(worker))).status).toBe(413);
    // Aunque mienta el content-length.
    const lying = request(big, sign(big), { 'content-length': '10' });
    expect((await privacy.handlePrivacyWebhook('store_redact', lying, deps(worker))).status).toBe(413);
    expect(worker.calls).toEqual([]);
  });

  it('firma válida con cuerpo inválido → 400 sin escribir', async () => {
    for (const body of ['no-json', JSON.stringify({ store_id: 'abc' }), JSON.stringify([1]),
      JSON.stringify({ store_id: 1, customer: {}, orders_to_redact: [] })]) {
      const worker = fakeWorker({});
      expect((await privacy.handlePrivacyWebhook('customer_redact', request(body), deps(worker))).status).toBe(400);
      expect(worker.calls).toEqual([]);
    }
  });

  it('data_request válido → 200 sin escribir ni registrar el cuerpo', async () => {
    const worker = fakeWorker({});
    const body = JSON.stringify({ store_id: Number(STORE), customer: { id: 501, ...PII }, orders_requested: [1],
      data_request: { id: 7 } });
    expect((await privacy.handlePrivacyWebhook('data_request', request(body), deps(worker))).status).toBe(200);
    expect(worker.calls).toEqual([]);
    expectRedactedLogs();
  });
});

describe('M16e-T-06: store_redact y customer_redact', () => {
  it('store_redact llama hasta terminar: marca, tandas y fin → 200', async () => {
    const worker = fakeWorker({ tn_privacy_store_redact: ['marked', 'more', 'more', 'done'] });
    const response = await privacy.handlePrivacyWebhook('store_redact', request(storeBody), deps(worker));
    expect(response.status).toBe(200);
    expect(worker.calls.map((call) => call.args)).toEqual(Array(4).fill([STORE, 5000]));
    expectRedactedLogs();
  });

  it('si se agota el presupuesto de 2 s queda pendiente → 503, y el reintento sigue desde ahí', async () => {
    const worker = fakeWorker({ tn_privacy_store_redact: Array(30).fill('more') });
    const response = await privacy.handlePrivacyWebhook('store_redact', request(storeBody),
      deps(worker, { now: () => clock }));
    expect(response.status).toBe(503);
    expect(worker.calls.length).toBe(20);
    const retry = fakeWorker({ tn_privacy_store_redact: ['done'] });
    expect((await privacy.handlePrivacyWebhook('store_redact', request(storeBody), deps(retry))).status).toBe(200);
  });

  it('una falla de la base → 500 (Tiendanube reintenta)', async () => {
    const worker = fakeWorker({ tn_privacy_store_redact: ['marked', new Error('caída')] });
    expect((await privacy.handlePrivacyWebhook('store_redact', request(storeBody), deps(worker))).status).toBe(500);
  });

  it('tienda sin conexiones: la base responde done sin escribir y el handler 200', async () => {
    const worker = fakeWorker({ tn_privacy_store_redact: ['done'] });
    expect((await privacy.handlePrivacyWebhook('store_redact', request(storeBody), deps(worker))).status).toBe(200);
  });

  it('customer_redact pasa solo IDs (sin repetir) y descarta email, teléfono y documento', async () => {
    const worker = fakeWorker({ tn_privacy_customer_redact: ['marked', 'done'] });
    const response = await privacy.handlePrivacyWebhook('customer_redact', request(customerBody), deps(worker));
    expect(response.status).toBe(200);
    expect(worker.calls.map((call) => call.args)).toEqual(Array(2).fill([STORE, '501', ['9001', '9002']]));
    const text = JSON.stringify(worker.calls);
    for (const value of Object.values(PII)) expect(text).not.toContain(value);
    expectRedactedLogs();
  });

  it('customer_redact sin lista de pedidos usa una lista vacía (la base suma los locales del cliente)', async () => {
    const body = JSON.stringify({ store_id: Number(STORE), customer: { id: 501 } });
    const worker = fakeWorker({ tn_privacy_customer_redact: ['done'] });
    expect((await privacy.handlePrivacyWebhook('customer_redact', request(body), deps(worker))).status).toBe(200);
    expect(worker.calls[0].args).toEqual([STORE, '501', []]);
  });

  it('customer_redact con el paso 2 fallido → 500; el duplicado no repite efectos (la base devuelve done)', async () => {
    const failing = fakeWorker({ tn_privacy_customer_redact: ['marked', new Error('caída')] });
    expect((await privacy.handlePrivacyWebhook('customer_redact', request(customerBody), deps(failing))).status).toBe(500);
    const duplicate = fakeWorker({ tn_privacy_customer_redact: ['done'] });
    expect((await privacy.handlePrivacyWebhook('customer_redact', request(customerBody), deps(duplicate))).status).toBe(200);
    expect(duplicate.calls).toHaveLength(1);
  });

  it('las tres rutas exportan solo POST y fijan su tipo de evento', async () => {
    const { readFile } = await import('node:fs/promises');
    const routes = {
      'store-redact': await import('@/app/api/integraciones/tiendanube/privacidad/store-redact/route'),
      'customer-redact': await import('@/app/api/integraciones/tiendanube/privacidad/customer-redact/route'),
      'data-request': await import('@/app/api/integraciones/tiendanube/privacidad/data-request/route'),
    };
    for (const [dir, event] of [['store-redact', 'store_redact'], ['customer-redact', 'customer_redact'],
      ['data-request', 'data_request']] as const) {
      expect(Object.keys(routes[dir])).toEqual(['POST']);
      const source = await readFile(`src/app/api/integraciones/tiendanube/privacidad/${dir}/route.ts`, 'utf8');
      expect(source).toContain(`handlePrivacyWebhook('${event}', request)`);
    }
  });
});
