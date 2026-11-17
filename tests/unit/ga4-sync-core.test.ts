import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { GA4_REPORT_CATALOG } from '@/modules/integrations/ga4/reports';
import { ga4CohortCellAvailability, ga4DailyWindows, ga4PageQuality, ga4ProjectRows,
  ga4QuotaLow, ga4ReportRequest, mergeGa4Quality } from '@/modules/integrations/ga4/sync-core';

const property = { currency: 'USD', timezone: 'America/Argentina/Buenos_Aires' };

describe('GA4 sync core', () => {
  it('parte 365 días en ventanas de 31 descendentes y relee el margen incremental', () => {
    const windows = ga4DailyWindows('2026-11-16', 'backfill', null);
    expect(windows).toHaveLength(12);
    expect(windows[0]).toEqual({ from: '2026-10-16', to: '2026-11-15' });
    expect(windows.at(-1)).toEqual({ from: '2025-11-16', to: '2025-12-09' });
    expect(ga4DailyWindows('2026-11-16', 'incremental', '2026-11-15'))
      .toEqual([{ from: '2026-11-12', to: '2026-11-15' }]);
  });

  it('pide páginas de 10000,  conserva calidad combinada y aplica cuota observada', () => {
    const report = GA4_REPORT_CATALOG.find((item) => item.id === 'ga4_trafico_dia')!;
    expect(ga4ReportRequest(report, { from: '2026-11-01', to: '2026-11-15' }, '2026-11-16', 10000))
      .toMatchObject({ limit: '10000', offset: '10000', returnPropertyQuota: true });
    const a = ga4PageQuality({ metadata: {} }, property);
    const b = ga4PageQuality({ metadata: { subjectToThresholding: true,
      dataTruncationReasons: ['OTHER'] } }, property);
    expect(mergeGa4Quality([a, b])).toMatchObject({ subject_to_thresholding: true,
      data_truncation_reasons: ['OTHER'], currency_code: 'USD' });
    expect(ga4QuotaLow({ metadata: {} })).toBeNull();
    expect(ga4QuotaLow({ propertyQuota: { tokensPerHour: { remaining: 3999 } } })).toBe(true);
    expect(ga4QuotaLow({ propertyQuota: { tokensPerHour: { remaining: 4000 } } })).toBe(false);
    expect(() => mergeGa4Quality([a, ga4PageQuality({ metadata: { currencyCode: 'EUR' } },
      { ...property, currency: 'EUR' })])).toThrow();
  });

  it('oculta cohortes menores de cinco y usa los límites de treinta días', () => {
    const january = { from: '2026-01-01', to: '2026-01-31' };
    expect(ga4CohortCellAvailability(january, 1, '2026-03-01')).toBe('provisional');
    expect(ga4CohortCellAvailability(january, 1, '2026-03-06')).toBe('cerrada');
    expect(ga4CohortCellAvailability({ from: '2026-02-01', to: '2026-02-28' }, 1,
      '2026-04-02')).toBe('provisional');
    expect(ga4CohortCellAvailability({ from: '2026-04-01', to: '2026-04-30' }, 1,
      '2026-06-03')).toBe('cerrada');
    expect(ga4CohortCellAvailability({ from: '2026-05-01', to: '2026-05-31' }, 1,
      '2026-07-03')).toBe('provisional');
    expect(ga4CohortCellAvailability({ from: '2026-05-01', to: '2026-05-31' }, 1,
      '2026-05-15')).toBe('aun_no_disponible');
    const rows = ga4ProjectRows('ga4_cohortes', { rows: [{
      dimensionValues: [{ value: '2026-01' }, { value: '1' }],
      metricValues: [{ value: '5' }, { value: '1' }],
    }] }, january, '2026-03-01');
    expect(rows).toEqual([{ cohort_month: '2026-01-01', month_offset: 1,
      cohort_size: 5, active: null, provisional: true }]);
  });
});
