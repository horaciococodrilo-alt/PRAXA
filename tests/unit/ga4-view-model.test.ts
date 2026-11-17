import { describe, expect, it } from 'vitest';

import { compareGa4Campaigns, groupGa4Items, qualityFlags, readingState } from
  '@/modules/integrations/ga4/view-model';

describe('M16f paso 9: presentación sin mezclar fuentes', () => {
  it('distingue cero observado, ausencia, parcial, provisional, restricción y no disponible', () => {
    const clean = { row_count: 0 };
    expect(readingState({ value: 0, quality: clean })).toBe('cero_medido');
    expect(readingState({ value: null, quality: clean })).toBe('cero_medido');
    expect(readingState({ value: null, quality: { row_count: 2 } })).toBe('ausencia');
    expect(readingState({ value: 3, quality: null })).toBe('parcial');
    expect(readingState({ value: 3, quality: clean, provisional: true })).toBe('provisional');
    expect(readingState({ value: 3, quality: { restricted_metrics: ['x'] } })).toBe('restringido');
    expect(readingState({ value: 3, quality: clean, available: false })).toBe('no_disponible');
    expect(qualityFlags({ subject_to_thresholding: true, zona_distinta: true }))
      .toEqual(['umbral', 'zona_distinta']);
  });

  it('agrupa por producto interno y conserva separados dos IDs con el mismo nombre', () => {
    const rows = [
      { itemRef: 'a', productKey: null, name: 'Mismo', views: 2, carts: 1, purchases: 0, tnUnits: null },
      { itemRef: 'b', productKey: null, name: 'Mismo', views: 3, carts: 0, purchases: 0, tnUnits: null },
      { itemRef: 'c', productKey: 'producto', name: 'Producto', views: 4, carts: 1, purchases: 1, tnUnits: 2 },
      { itemRef: 'd', productKey: 'producto', name: 'Producto', views: 5, carts: 2, purchases: 0, tnUnits: 3 },
    ];
    const grouped = groupGa4Items(rows);
    expect(grouped).toHaveLength(3);
    expect(grouped[0]).toMatchObject({ key: 'product:producto', views: 9, tnUnits: 5 });
    expect(grouped.filter((row) => row.name === 'Mismo').map((row) => row.views)).toEqual([3, 2]);
  });

  it('compara solo campañas con referencia interna y día coincidente', () => {
    const ga4 = [
      { day: '2026-11-01', entityRef: 'ref', sessions: 4, quality: { row_count: 1 } },
      { day: '2026-11-01', entityRef: null, sessions: 3, quality: { row_count: 1 } },
      { day: '2026-11-02', entityRef: 'ref', sessions: 2, quality: { row_count: 1 } },
    ];
    const meta = [{ day: '2026-11-01', entityRef: 'ref', name: 'Campaña',
      spend: '12.50', currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires' }];
    expect(compareGa4Campaigns(ga4, meta)).toEqual({
      matched: [{ day: '2026-11-01', name: 'Campaña', sessions: 4, spend: '12.50',
        currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires', qualityFlags: [],
        ga4FetchedAt: null, metaFetchedAt: null }],
      unmatchedSessions: 5, unmatchedQualityFlags: [],
    });
  });
});
