import type { MetaAnomalyObservation, MetaAnomalyView } from './contract';
import { detectMetaAnomalies } from './detect';

const DEMO_START = new Date('2026-10-01T00:00:00.000Z');

function demoDay(offset: number): string {
  const date = new Date(DEMO_START);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function demoScope(
  level: 'account' | 'campaign',
  entityRef: string,
  entityName: string,
  baseline: { spend: string; impressions: string; clicks: string; purchases: string },
  current: { spend: string; impressions: string; clicks: string; purchases: string },
): MetaAnomalyObservation[] {
  return Array.from({ length: 14 }, (_, index) => {
    const values = index < 7 ? baseline : current;
    return {
      day: demoDay(index),
      level,
      entityRef,
      entityName,
      presence: 'con_datos',
      temporalStatus: 'cerrado',
      capturedBeforeDayEnd: false,
      spend: values.spend,
      impressions: values.impressions,
      clicks: values.clicks,
      purchases: values.purchases,
      purchaseAttributionKey: 'demo-attribution-compatible',
      currency: 'ARS',
      timezone: 'America/Argentina/Buenos_Aires',
      fetchedAt: '2026-10-15T12:00:00.000Z',
    };
  });
}

const DEMO_OBSERVATIONS = Object.freeze([
  ...demoScope('account', 'demo-account', 'Cuenta de demostración',
    { spend: '1000', impressions: '20000', clicks: '800', purchases: '20' },
    { spend: '1500', impressions: '18000', clicks: '500', purchases: '16' }),
  ...demoScope('campaign', 'demo-campaign-catalog', 'Campaña Catálogo — demostración',
    { spend: '420', impressions: '9000', clicks: '390', purchases: '12' },
    { spend: '690', impressions: '8800', clicks: '240', purchases: '7' }),
]);

export function createMetaAnomalyDemo(): MetaAnomalyView {
  return {
    state: 'ready',
    lastSyncedAt: '2026-10-15T12:00:00.000Z',
    result: detectMetaAnomalies({
      mode: 'synthetic_demo',
      generatedAt: '2026-10-15T13:00:00.000Z',
      observations: DEMO_OBSERVATIONS,
    }),
  };
}
