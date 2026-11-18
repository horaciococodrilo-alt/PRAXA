import { Card } from '@/components/app/ui';
import type {
  CohortMetricKey,
  CriterionCode,
  InsightsData,
  Metric,
  SegmentCode,
  SegmentMetricKey,
  ViewProposal,
} from '@/modules/customer-insights/contract';
import { ABSENCE_TEXT, SEGMENT_TEXT, formatMetric, formatMonth } from '@/modules/customer-insights/rules';

import s from './clientes.module.css';

/**
 * Fichas de propuestas (§7). Cada campo sale del catálogo fijo o de una métrica ya publicada del
 * mismo corte; no hay botones ni enlaces que creen, exporten o sincronicen audiencias.
 */

const SEGMENT_METRIC_LABEL: Record<SegmentMetricKey, string> = {
  customers: 'Compradores', orders: 'Pedidos', monetary: 'Valor monetario', monetaryPerCustomer: 'Valor por comprador',
  monetaryPerOrder: 'Valor por pedido', recencyMedianDays: 'Recencia mediana (días)', frequencyMean: 'Pedidos por comprador',
};

const COHORT_METRIC_LABEL: Record<CohortMetricKey, string> = {
  activeCustomers: 'Activos', retention: 'Retención', repeatPurchaseCumulative: 'Recompra acumulada',
  observedValue: 'Valor observado', ticket: 'Ticket', observedValuePerCustomerCumulative: 'Valor acumulado por comprador',
  meanDaysBetweenPurchases: 'Días entre compras', repeatCustomers: 'Repetidores', purchaseIntervals: 'Intervalos',
};

function criterion(code: CriterionCode, data: InsightsData): string {
  if (code.startsWith('segment_')) return `Segmento ${SEGMENT_TEXT[code.slice(8) as SegmentCode].label.toLowerCase()}`;
  const cross = data.productEvidence.crossSell;
  if (code === 'compro_producto_a') return cross.status === 'available' ? `Compró «${cross.productAName}»` : 'Compró el producto A';
  if (code === 'no_compro_producto_b') return cross.status === 'available' ? `No compró «${cross.productBName}»` : 'No compró el producto B';
  return 'Comprador identificado con un pedido pagado en los últimos 365 días';
}

function evidence(ref: string, data: InsightsData): { label: string; value: string } | null {
  if (ref === 'productEvidence.crossSell') {
    return { label: 'Co-compra de productos', value: 'Observada con muestra suficiente (sin cifras del par)' };
  }
  const parts = ref.split('.');
  let metric: Metric | undefined;
  let label = '';
  if (parts[0] === 'segments' && data.segments.status === 'available') {
    const row = data.segments.rows.find((r) => r.code === parts[1]);
    metric = row?.[parts[2] as SegmentMetricKey];
    label = `${SEGMENT_METRIC_LABEL[parts[2] as SegmentMetricKey]} · ${SEGMENT_TEXT[parts[1] as SegmentCode].label.toLowerCase()}`;
  } else if (parts[0] === 'cohorts' && data.cohorts.status === 'available') {
    const row = data.cohorts.rows.find((r) => r.cohortMonth === parts[1]);
    metric = row?.cells.find((c) => c.offset === Number(parts[2]))?.[parts[3] as CohortMetricKey];
    label = `${COHORT_METRIC_LABEL[parts[3] as CohortMetricKey]} · cohorte ${formatMonth(parts[1])}, mes ${parts[2]}`;
  }
  return metric ? { label, value: formatMetric(metric) } : null;
}

function Proposal({ proposal, data }: { proposal: ViewProposal; data: InsightsData }) {
  const items = proposal.evidenceRefs.map((ref) => evidence(ref, data)).filter((item) => item !== null);
  return (
    <Card as="article" className={s.proposal} aria-labelledby={`propuesta-${proposal.id}`}>
      <h3 id={`propuesta-${proposal.id}`}>{proposal.name}</h3>
      <dl className={s.proposalFacts}>
        <div><dt>Objetivo</dt><dd>{proposal.objective}</dd></div>
        <div>
          <dt>Compradores identificados</dt>
          <dd>{proposal.identifiedCustomers ? formatMetric(proposal.identifiedCustomers)
            : ABSENCE_TEXT[proposal.identifiedCustomersAbsence ?? 'dato_incompleto']}</dd>
        </div>
        <div><dt>Incluye</dt><dd>{proposal.inclusion.map((code) => criterion(code, data)).join(' · ')}</dd></div>
        <div>
          <dt>Excluye</dt>
          <dd>{proposal.exclusion.length ? proposal.exclusion.map((code) => criterion(code, data)).join(' · ') : 'Sin exclusiones'}</dd>
        </div>
        <div>
          <dt>Evidencia</dt>
          <dd>
            <ul className={s.plainList}>
              {items.map((item) => <li key={item.label}>{item.label}: <strong>{item.value}</strong></li>)}
            </ul>
          </dd>
        </div>
        <div><dt>Justificación</dt><dd>{proposal.justification}</dd></div>
        <div><dt>Estrategia sugerida</dt><dd>{proposal.suggestedStrategy}</dd></div>
        <div>
          <dt>Limitaciones</dt>
          <dd><ul className={s.plainList}>{proposal.limitations.map((text) => <li key={text}>{text}</li>)}</ul></dd>
        </div>
      </dl>
      <p className={s.footnote}>Regla {proposal.ruleVersion}. Datos al {data.asOfDay.split('-').reverse().join('/')}.</p>
    </Card>
  );
}

export function AudienceProposals({ data, proposals, blocked }: {
  data: InsightsData; proposals: readonly ViewProposal[]; blocked: boolean;
}) {
  return (
    <section className={s.proposals} aria-label="Propuestas de audiencias">
      <h2>Propuestas de audiencias</h2>
      <p className={s.muted}>
        Ideas para revisar con reglas fijas sobre los grupos publicados. PRAXA no crea, exporta ni sincroniza audiencias, y una
        cantidad identificada no es alcance publicitario.
      </p>
      {blocked ? (
        <p className={s.muted}>Las propuestas no se muestran hasta una sincronización nueva.</p>
      ) : proposals.length === 0 ? (
        <p className={s.muted}>No hay propuestas con evidencia suficiente para este corte.</p>
      ) : (
        <div className={s.proposalGrid}>
          {proposals.map((proposal) => <Proposal key={proposal.id} proposal={proposal} data={data} />)}
        </div>
      )}
    </section>
  );
}
