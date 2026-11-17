import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { resolveIntegrationsTestTarget } from '../../scripts/lib/sql-target.mjs';

vi.mock('server-only', () => ({}));

describe('M16f-T-01: cliente acotado y funciones GA4', () => {
  let api: ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi>;

  beforeAll(async () => {
    const target = resolveIntegrationsTestTarget(process.env);
    if (!target.ok) throw new Error('Destino del rol de pruebas no verificado.');
    const { createWorkerApi } = await import('@/modules/integrations/db/worker-api');
    api = createWorkerApi({ connectionString: target.connectionString });
  });

  afterAll(async () => { await api?.end(); });

  it('la función GA4 existe, pero rechaza a un actor sin empresa', async () => {
    await expect(api.call('ga4_start_sync', [
      randomUUID(), randomUUID(), randomUUID(), 0, randomUUID(), randomUUID(),
      new Date(Date.now() + 4 * 60_000).toISOString(), 'backfill',
    ])).rejects.toMatchObject({ code: 'not_authorized' });
  });
});
