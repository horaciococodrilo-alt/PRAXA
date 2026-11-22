/**
 * Propuestas de audiencias (spec §7, D-M27a-07). Reglas cerradas sobre agregados ya
 * sanitizados: no calculan cifras nuevas, no leen la base ni llaman a Meta o a un LLM.
 *
 * Una propuesta sin evidencia visible no se produce: nunca hay una audiencia vacía ficticia.
 */

import type { AudienceProposal, CriterionCode, EvidenceRef, InsightsData, Metric, ProposalId, SegmentCode, SegmentMetricKey } from './contract';
import { AUDIENCE_RULES_VERSION, PROPOSAL_CATALOG } from './rules';

type Absence = AudienceProposal['identifiedCustomersAbsence'];

function identified(value: Metric): Metric {
  return { value: value.value, absence: null, unit: 'customers', definition: 'proposal_identified_customers_v1' };
}

function make(id: ProposalId, parts: {
  segmentRefs: readonly SegmentCode[];
  count: Metric | null;
  absence: Absence;
  evidenceRefs: readonly EvidenceRef[];
  inclusion?: readonly CriterionCode[];
  exclusion?: readonly CriterionCode[];
}): AudienceProposal {
  const fixed = PROPOSAL_CATALOG[id];
  return {
    id,
    ruleVersion: AUDIENCE_RULES_VERSION,
    name: fixed.name,
    objective: fixed.objective,
    segmentRefs: [...parts.segmentRefs],
    identifiedCustomers: parts.count === null ? null : identified(parts.count),
    identifiedCustomersAbsence: parts.count === null ? parts.absence : null,
    inclusion: [...(parts.inclusion ?? fixed.inclusion)],
    exclusion: [...(parts.exclusion ?? fixed.exclusion)],
    evidenceRefs: [...parts.evidenceRefs],
    justification: fixed.justification,
    suggestedStrategy: fixed.suggestedStrategy,
    limitations: [...fixed.limitations],
  };
}

/** Cohortes visibles con un indicador dado, de la más reciente a la más antigua. */
function cohortRefs(data: InsightsData, key: 'activeCustomers' | 'repeatPurchaseCumulative', limit: number,
  fromMonth: string | null = null): EvidenceRef[] {
  if (data.cohorts.status !== 'available') return [];
  const refs: EvidenceRef[] = [];
  for (const row of data.cohorts.rows) {
    for (const cell of [...row.cells].reverse()) {
      if (refs.length >= limit) return refs;
      if (cell[key].value === null || (fromMonth !== null && cell.calendarMonth < fromMonth)) continue;
      refs.push(`cohorts.${row.cohortMonth}.${cell.offset}.${key}`);
      break;
    }
  }
  return refs;
}

/**
 * Arma las propuestas de audiencias («reactivar inactivos», etc.) a partir de los segmentos. Son solo
 * sugerencias: no crea ni exporta nada a Meta.
 */
export function buildAudienceProposals(data: InsightsData): readonly AudienceProposal[] {
  const proposals: AudienceProposal[] = [];
  const identityComplete = data.quality.identity === 'completa';
  const segments = data.segments.status === 'available' ? data.segments : null;
  const row = (code: SegmentCode) => {
    const found = segments?.rows.find((r) => r.code === code);
    return found && found.customers.value !== null && found.customers.value !== '0' ? found : null;
  };
  const ref = (code: SegmentCode, key: SegmentMetricKey): EvidenceRef => `segments.${code}.${key}`;
  const count = (value: Metric) => (identityComplete ? value : null);

  const bySegment = (id: ProposalId, code: SegmentCode, keys: readonly SegmentMetricKey[], extra: EvidenceRef[] = []) => {
    const r = row(code);
    if (!r) return;
    proposals.push(make(id, {
      segmentRefs: [code], count: count(r.customers), absence: 'dato_incompleto',
      evidenceRefs: [...keys.map((key) => ref(code, key)), ...extra],
    }));
  };

  bySegment('fidelizacion_v1', 'alto_valor', ['monetaryPerCustomer', 'frequencyMean']);
  bySegment('remarketing_v1', 'potencial', ['recencyMedianDays', 'frequencyMean'],
    cohortRefs(data, 'repeatPurchaseCumulative', 1));
  bySegment('reactivacion_riesgo_v1', 'riesgo', ['recencyMedianDays', 'orders']);
  bySegment('reactivacion_inactivos_v1', 'inactivos', ['recencyMedianDays', 'orders']);

  if (segments) {
    const present = segments.rows.filter((r) => r.customers.value !== null && r.customers.value !== '0');
    if (present.length > 0) {
      proposals.push(make('exclusion_adquisicion_v1', {
        segmentRefs: present.map((r) => r.code), count: count(segments.totalCustomers), absence: 'dato_incompleto',
        evidenceRefs: present.map((r) => ref(r.code, 'customers')),
      }));
    }
  } else if (data.segments.status === 'unavailable') {
    // Sin partición publicable, la evidencia de compradores existentes son las cohortes visibles
    // de la ventana; la cantidad queda ausente con el motivo de la partición.
    const refs = cohortRefs(data, 'activeCustomers', 3, data.rfmFrom.slice(0, 7));
    if (refs.length > 0) {
      proposals.push(make('exclusion_adquisicion_v1', {
        segmentRefs: [], count: null, absence: data.segments.absence, evidenceRefs: refs,
      }));
    }
  }

  bySegment('similares_alto_valor_v1', 'alto_valor', ['customers', 'monetaryPerCustomer']);

  const cross = data.productEvidence.crossSell;
  if (cross.status === 'available' && row(cross.sourceSegment)) {
    proposals.push(make('venta_cruzada_v1', {
      segmentRefs: [cross.sourceSegment], count: null, absence: 'privacidad',
      evidenceRefs: ['productEvidence.crossSell', ref(cross.sourceSegment, 'customers')],
      inclusion: [`segment_${cross.sourceSegment}`, 'compro_producto_a'],
      exclusion: ['no_compro_producto_b'],
    }));
  }
  return proposals;
}
