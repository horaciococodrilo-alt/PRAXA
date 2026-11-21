import type { ReactNode } from 'react';

import { ButtonLink, Card } from '@/components/app/ui';
import type { CustomerInsightsView, InsightsData, SegmentRow } from '@/modules/customer-insights/contract';
import {
  DEFINITION_TEXT,
  SEGMENT_TEXT,
  VIEW_MESSAGES,
  formatDay,
  formatMetric,
  freshnessOf,
} from '@/modules/customer-insights/rules';

import { AudienceProposals } from './audience-proposals';
import { CohortEvolution } from './cohort-evolution';
import { CohortMatrix } from './cohort-matrix';
import s from './clientes.module.css';

/**
 * Pantalla `/app/clientes` (M27a §8). Solo presenta la vista ya validada: los textos salen del
 * catálogo fijo, una ausencia muestra su motivo y un grupo oculto no deja valores en el DOM.
 * No hay acciones sobre Meta ni sincronización automática.
 */

function Notice({ title, children, action }: { title: string; children?: ReactNode; action?: boolean }) {
  return (
    <Card className={s.notice}>
      <h2>{title}</h2>
      {children}
      {action ? <div className={s.actions}><ButtonLink href="/app/integraciones" variant="secondary">Ir a Integraciones</ButtonLink></div> : null}
    </Card>
  );
}

const QUALITY_TEXT = {
  identity: { completa: 'Completa', incompleta: 'Incompleta: hay pedidos sin comprador identificado', no_evaluable: 'Sin pedidos para evaluar' },
  monetary: { verified: 'Validado', unverified: 'No validado', incomplete: 'Incompleto', inconsistent: 'Inconsistente' },
  catalog: { completo: 'Completo', incompleto: 'Incompleto' },
  orderLines: { completas: 'Completas', incompletas: 'Incompletas' },
} as const;

function Context({ data, nowMs }: { data: InsightsData; nowMs: number }) {
  const freshness = freshnessOf(data.fetchedAt, nowMs);
  const q = data.quality;
  return (
    <section className={s.context} aria-label="Fuente y período">
      <dl className={s.facts}>
        <div><dt>Fuente</dt><dd>Tiendanube</dd></div>
        <div><dt>Período</dt><dd>{formatDay(data.rfmFrom)} – {formatDay(data.asOfDay)}</dd></div>
        <div><dt>Zona</dt><dd>{data.timezone}</dd></div>
        <div><dt>Moneda</dt><dd>{data.currency}</dd></div>
        <div><dt>Base de cohortes</dt><dd>Primera compra observada</dd></div>
        <div><dt>Extracción</dt><dd>{data.fetchedAt.slice(0, 10).split('-').reverse().join('/')}</dd></div>
      </dl>
      <p className={s.note}>
        La segmentación describe la actividad de los últimos 365 días hasta el corte, no toda la base histórica. Las
        etiquetas son reglas sobre compras observadas, no predicciones. El valor monetario es el importe observado de
        pedidos pagados, no ingreso contable, ganancia ni LTV.
      </p>
      {freshness === 'advertencia' ? (
        <p className={s.warning} role="status">Los datos tienen más de 24 horas. Sincronizá la tienda para actualizarlos.</p>
      ) : null}
      {freshness === 'vencido' ? (
        <p className={s.warning} role="status">
          Los datos tienen más de 7 días: se muestran como observación histórica al corte, no como situación actual.
        </p>
      ) : null}
      <dl className={s.quality} aria-label="Calidad de los datos">
        <div><dt>Identidad</dt><dd>{QUALITY_TEXT.identity[q.identity]}</dd></div>
        <div><dt>Monetario</dt><dd>{QUALITY_TEXT.monetary[q.monetary.status]}</dd></div>
        <div><dt>Catálogo</dt><dd>{QUALITY_TEXT.catalog[q.catalog]}</dd></div>
        <div><dt>Líneas de pedido</dt><dd>{QUALITY_TEXT.orderLines[q.orderLines]}</dd></div>
      </dl>
    </section>
  );
}

function CurrencySelector({ available, selected }: { available: readonly string[]; selected: string | null }) {
  if (available.length === 0) return null;
  return (
    <form method="get" className={s.currency}>
      <label htmlFor="clientes-moneda">Moneda</label>
      <select id="clientes-moneda" name="currency" defaultValue={selected ?? available[0]}>
        {available.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
      </select>
      <button type="submit" className={s.currencyButton}>Ver</button>
    </form>
  );
}

const SEGMENT_COLUMNS = [
  ['customers', 'Compradores'], ['orders', 'Pedidos'], ['monetary', 'Valor monetario'],
  ['monetaryPerCustomer', 'Por comprador'], ['monetaryPerOrder', 'Por pedido'],
  ['recencyMedianDays', 'Recencia mediana (días)'], ['frequencyMean', 'Pedidos por comprador'],
] as const satisfies ReadonlyArray<readonly [keyof Omit<SegmentRow, 'code'>, string]>;

function Segments({ data }: { data: InsightsData }) {
  const segments = data.segments;
  return (
    <Card className={s.section} aria-labelledby="clientes-segmentos">
      <h2 id="clientes-segmentos">Segmentos RFM</h2>
      {segments.status === 'unavailable' ? (
        <p className={s.muted}>
          {segments.absence === 'privacidad' ? VIEW_MESSAGES.privacidad
            : segments.absence === 'monetario_no_validado'
              ? 'Sin el componente monetario validado no se publican segmentos RFM, alto valor ni sus montos.'
              : 'Los datos de la tienda no alcanzan para segmentar sin aproximar.'}
        </p>
      ) : (
        <>
          <p className={s.muted}>
            {formatMetric(segments.totalCustomers)} compradores identificados en la ventana. {DEFINITION_TEXT.segment_partition_v1}
          </p>
          <div className={s.scroll} tabIndex={0} role="group" aria-label="Tabla de segmentos desplazable">
            <table className={s.table}>
              <caption>Segmentos de {data.currency}</caption>
              <thead>
                <tr>
                  <th scope="col">Segmento</th>
                  {SEGMENT_COLUMNS.map(([key, label]) => <th key={key} scope="col">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {segments.rows.map((row) => (
                  <tr key={row.code}>
                    <th scope="row">
                      <span className={s.segmentName}>{SEGMENT_TEXT[row.code].label}</span>
                      <span className={s.segmentRule}>{SEGMENT_TEXT[row.code].rule}</span>
                    </th>
                    {SEGMENT_COLUMNS.map(([key]) => <td key={key}>{formatMetric(row[key])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={s.footnote}>Montos en {data.currency}. {DEFINITION_TEXT.segment_recency_median_days_v1}</p>
        </>
      )}
    </Card>
  );
}

function Cohorts({ data }: { data: InsightsData }) {
  const cohorts = data.cohorts;
  return (
    <Card className={s.section} aria-labelledby="clientes-cohortes">
      <h2 id="clientes-cohortes">Cohortes por primera compra observada</h2>
      {cohorts.status === 'unavailable' ? (
        <p className={s.muted}>{cohorts.absence === 'privacidad' ? VIEW_MESSAGES.privacidad : 'No hay datos suficientes para las cohortes.'}</p>
      ) : cohorts.rows.length === 0 ? (
        <p className={s.muted}>Todavía no hay cohortes observadas.</p>
      ) : (
        <>
          <p className={s.muted}>{DEFINITION_TEXT.cohorts_observed_v1} La retención no explica causas.</p>
          <CohortMatrix rows={cohorts.rows} />
          <CohortEvolution rows={cohorts.rows} />
        </>
      )}
    </Card>
  );
}

export function Clientes({ view, nowMs }: { view: CustomerInsightsView; nowMs: number }) {
  if (!('data' in view)) {
    const message = VIEW_MESSAGES[view.kind] ?? VIEW_MESSAGES.error!;
    return (
      <div className={s.content}>
        <Notice title={message} action={'actionHref' in view} />
      </div>
    );
  }
  const { data } = view;
  const banner = VIEW_MESSAGES[view.kind];
  const blocked = freshnessOf(data.fetchedAt, nowMs) === 'vencido';
  return (
    <div className={s.content}>
      <div className={s.toolbar}>
        <CurrencySelector available={view.availableCurrencies} selected={view.selectedCurrency} />
      </div>
      {banner ? <p className={s.banner} role="status">{banner}</p> : null}
      <Context data={data} nowMs={nowMs} />
      <Segments data={data} />
      <Cohorts data={data} />
      <AudienceProposals data={data} proposals={view.proposals} blocked={blocked} />
    </div>
  );
}
