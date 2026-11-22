/** Presentación determinista de lecturas GA4. Ningún ID externo entra en este modelo. */
export type Ga4ReadingState = 'disponible' | 'cero_medido' | 'ausencia' | 'parcial' |
  'provisional' | 'restringido' | 'no_disponible';

export type Ga4Quality = Record<string, unknown> | null;
/** Fecha en que se trajeron los datos, según la calidad guardada. */
export function qualityFetchedAt(quality: Ga4Quality): string | null {
  return typeof quality?.fetched_at === 'string' ? quality.fetched_at : null;
}

function nonEmpty(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

/** Lista las advertencias de calidad de un dato (umbral, truncamiento, etc.). */
export function qualityFlags(quality: Ga4Quality): string[] {
  if (!quality) return ['sin_calidad'];
  const flags: string[] = [];
  if (quality.subject_to_thresholding === true) flags.push('umbral');
  if (quality.data_loss_from_other_row === true) flags.push('otras_filas');
  if (nonEmpty(quality.data_truncation_reasons)) flags.push('truncamiento');
  if (nonEmpty(quality.sampling_metadatas)) flags.push('muestreo');
  if (nonEmpty(quality.restricted_metrics)) flags.push('restriccion');
  if (quality.zona_distinta === true) flags.push('zona_distinta');
  if (typeof quality.empty_reason === 'string' && quality.empty_reason) flags.push('motivo_vacio');
  return flags;
}

/** Decide cómo mostrar un dato: disponible, parcial, restringido, provisional o no disponible. */
export function readingState(input: { value: number | null; quality: Ga4Quality;
  provisional?: boolean; available?: boolean }): Ga4ReadingState {
  if (input.available === false) return 'no_disponible';
  if (!input.quality) return 'parcial';
  if (nonEmpty(input.quality.restricted_metrics)) return 'restringido';
  if (input.value === null) {
    return input.quality.row_count === 0 && qualityFlags(input.quality).length === 0
      ? 'cero_medido' : 'ausencia';
  }
  if (qualityFlags(input.quality).length > 0) return 'parcial';
  if (input.provisional) return 'provisional';
  return input.value === 0 ? 'cero_medido' : 'disponible';
}

export type Ga4ItemReading = Readonly<{ itemRef: string | null; productKey: string | null;
  name: string | null; views: number; carts: number; purchases: number; tnUnits: number | null;
  quality?: Ga4Quality }>;
export type Ga4ProductRow = Readonly<{ key: string; name: string; mapped: boolean;
  views: number; carts: number; purchases: number; tnUnits: number | null;
  flags: readonly string[]; fetchedAt: string | null }>;

/** Agrupa las filas de productos de GA4 por producto. */
export function groupGa4Items(rows: readonly Ga4ItemReading[]): Ga4ProductRow[] {
  const grouped = new Map<string, Ga4ProductRow>();
  for (const row of rows) {
    const key = row.productKey ? `product:${row.productKey}` :
      row.itemRef ? `item:${row.itemRef}` : 'sin_id';
    const old = grouped.get(key);
    grouped.set(key, {
      key, name: row.productKey ? (old?.name ?? row.name ?? 'Producto sin nombre') :
        row.itemRef ? (row.name ?? 'Producto sin nombre') : 'Sin ID de producto',
      mapped: row.productKey !== null,
      views: (old?.views ?? 0) + row.views,
      carts: (old?.carts ?? 0) + row.carts,
      purchases: (old?.purchases ?? 0) + row.purchases,
      tnUnits: row.productKey === null || old?.tnUnits === null || row.tnUnits === null
        ? null : (old?.tnUnits ?? 0) + row.tnUnits,
      flags: [...new Set([...(old?.flags ?? []), ...qualityFlags(row.quality ?? null)])],
      fetchedAt: [old?.fetchedAt, qualityFetchedAt(row.quality ?? null)]
        .filter((v): v is string => v !== null && v !== undefined).sort().at(-1) ?? null,
    });
  }
  return [...grouped.values()].sort((a, b) => b.views - a.views || a.key.localeCompare(b.key));
}

export type Ga4CampaignReading = Readonly<{ day: string; entityRef: string | null;
  sessions: number; quality?: Ga4Quality }>;
export type MetaCampaignReading = Readonly<{ day: string; entityRef: string | null;
  name: string | null; spend: string | null; currency: string | null;
  timezone: string | null; fetchedAt?: string | null }>;
export type Ga4CampaignComparison = Readonly<{ day: string; name: string;
  sessions: number; spend: string | null; currency: string | null; timezone: string | null;
  qualityFlags: readonly string[]; ga4FetchedAt: string | null; metaFetchedAt: string | null }>;

/** La coincidencia de UTM exacta y única la fija SQL; aquí solo se une su ref interna por día. */
export function compareGa4Campaigns(ga4: readonly Ga4CampaignReading[],
  meta: readonly MetaCampaignReading[]): { matched: Ga4CampaignComparison[];
    unmatchedSessions: number; unmatchedQualityFlags: string[] } {
  const byKey = new Map(meta.filter((row) => row.entityRef !== null)
    .map((row) => [`${row.day}:${row.entityRef}`, row]));
  const matched: Ga4CampaignComparison[] = [];
  let unmatchedSessions = 0;
  const unmatchedQualityFlags = new Set<string>();
  for (const row of ga4) {
    const peer = row.entityRef ? byKey.get(`${row.day}:${row.entityRef}`) : null;
    if (!peer) {
      unmatchedSessions += row.sessions;
      for (const flag of qualityFlags(row.quality ?? null)) unmatchedQualityFlags.add(flag);
      continue;
    }
    matched.push({ day: row.day, name: peer.name ?? 'Campaña sin nombre',
      sessions: row.sessions, spend: peer.spend, currency: peer.currency, timezone: peer.timezone,
      qualityFlags: qualityFlags(row.quality ?? null),
      ga4FetchedAt: qualityFetchedAt(row.quality ?? null), metaFetchedAt: peer.fetchedAt ?? null });
  }
  return { matched, unmatchedSessions, unmatchedQualityFlags: [...unmatchedQualityFlags] };
}
