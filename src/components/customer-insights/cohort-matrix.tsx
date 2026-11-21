import type { CohortRow } from '@/modules/customer-insights/contract';
import { DEFINITION_TEXT, formatMetric, formatMonth } from '@/modules/customer-insights/rules';

import s from './clientes.module.css';

/**
 * Matriz de retención por cohorte (meses 0 a 12) y, por cohorte, la tabla completa de sus
 * métricas. Son tablas reales, con encabezados de fila y columna; la vista angosta desplaza la
 * tabla dentro de su contenedor, no la página. Una celda oculta solo muestra su motivo: sin
 * `title`, sin atributos de datos y sin color proporcional a un valor que no se publica.
 */

const OFFSETS = Array.from({ length: 13 }, (_, k) => k);

const DETAIL_COLUMNS = [
  ['activeCustomers', 'Activos'], ['retention', 'Retención'], ['repeatPurchaseCumulative', 'Recompra acumulada'],
  ['observedValue', 'Valor observado'], ['ticket', 'Ticket'],
  ['observedValuePerCustomerCumulative', 'Valor acumulado por comprador'],
  ['meanDaysBetweenPurchases', 'Días entre compras'], ['repeatCustomers', 'Repetidores'],
  ['purchaseIntervals', 'Intervalos'],
] as const;

export function CohortMatrix({ rows }: { rows: readonly CohortRow[] }) {
  return (
    <div className={s.cohorts}>
      <div className={s.scroll} tabIndex={0} role="group" aria-label="Matriz de retención desplazable">
        <table className={`${s.table} ${s.matrix}`}>
          <caption>Retención por cohorte: compradores activos en cada mes sobre el tamaño de la cohorte</caption>
          <thead>
            <tr>
              <th scope="col">Cohorte</th>
              {OFFSETS.map((k) => <th key={k} scope="col">Mes {k}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cohortMonth}>
                <th scope="row">
                  <span className={s.segmentName}>{formatMonth(row.cohortMonth)}</span>
                  <span className={s.segmentRule}>{formatMetric(row.size)} compradores</span>
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.offset} className={cell.retention.value === null ? s.hiddenCell : s.valueCell}>
                    {formatMetric(cell.retention, 'short')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={s.footnote}>
        «Oculto» agrupa meses con 0 a 4 compradores activos: no se distingue un cero de un grupo chico. «Mes abierto» es un mes
        en curso o futuro.
      </p>

      {rows.map((row) => (
        <details key={row.cohortMonth} className={s.cohortDetail}>
          <summary>Detalle de la cohorte {formatMonth(row.cohortMonth)}</summary>
          <div className={s.scroll} tabIndex={0} role="group" aria-label={`Detalle desplazable de ${formatMonth(row.cohortMonth)}`}>
            <table className={s.table}>
              <caption>Cohorte {formatMonth(row.cohortMonth)}</caption>
              <thead>
                <tr>
                  <th scope="col">Mes</th>
                  {DETAIL_COLUMNS.map(([key, label]) => <th key={key} scope="col">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {row.cells.map((cell) => (
                  <tr key={cell.offset}>
                    <th scope="row">{cell.offset} · {formatMonth(cell.calendarMonth)}</th>
                    {DETAIL_COLUMNS.map(([key]) => <td key={key}>{formatMetric(cell[key])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={s.footnote}>{DEFINITION_TEXT.cohort_observed_value_v1} {DEFINITION_TEXT.cohort_mean_days_between_purchases_v1}</p>
        </details>
      ))}
    </div>
  );
}
