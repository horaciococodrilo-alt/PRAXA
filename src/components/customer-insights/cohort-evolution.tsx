import type { CohortRow } from '@/modules/customer-insights/contract';
import { formatMonth } from '@/modules/customer-insights/rules';

import s from './clientes.module.css';

/**
 * Evolución de la retención de las cohortes más recientes, derivada solo de las celdas
 * publicadas. Es un apoyo visual: la tabla equivalente es la matriz de retención, por eso el
 * SVG queda oculto a lectores de pantalla. Un valor oculto o abierto corta la línea; nunca se
 * dibuja ni se interpola.
 */

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { left: 40, right: 12, top: 12, bottom: 28 };
const MAX_LINES = 6;
const COLORS = ['var(--accent)', 'var(--warn)', 'var(--text-muted)', 'var(--danger-text)', 'var(--accent-text)', 'var(--text-faint)'];

const x = (offset: number) => PAD.left + (offset / 12) * (WIDTH - PAD.left - PAD.right);
const y = (ratio: number) => PAD.top + (1 - ratio) * (HEIGHT - PAD.top - PAD.bottom);

/** Tramos continuos de celdas con retención publicada. */
function segments(row: CohortRow): Array<Array<[number, number]>> {
  const result: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];
  for (const cell of row.cells) {
    if (cell.retention.value === null) {
      if (current.length) result.push(current);
      current = [];
      continue;
    }
    // Solo posición en pantalla: el valor exacto se lee en la matriz.
    current.push([x(cell.offset), y(Number(cell.retention.value))]);
  }
  if (current.length) result.push(current);
  return result;
}

export function CohortEvolution({ rows }: { rows: readonly CohortRow[] }) {
  const shown = rows.slice(0, MAX_LINES);
  return (
    <figure className={s.evolution}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="presentation" aria-hidden="true" focusable="false">
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} className={s.gridLine} />
            <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" className={s.axis}>{tick * 100} %</text>
          </g>
        ))}
        {[0, 3, 6, 9, 12].map((k) => (
          <text key={k} x={x(k)} y={HEIGHT - 8} textAnchor="middle" className={s.axis}>Mes {k}</text>
        ))}
        {shown.map((row, i) => segments(row).map((points, j) => (
          points.length === 1
            ? <circle key={`${row.cohortMonth}-${j}`} cx={points[0][0]} cy={points[0][1]} r={3} fill={COLORS[i]} />
            : <polyline key={`${row.cohortMonth}-${j}`} points={points.map((p) => p.join(',')).join(' ')} fill="none"
              stroke={COLORS[i]} strokeWidth={2} />
        )))}
      </svg>
      <figcaption className={s.footnote}>
        Evolución de la retención de las {shown.length} cohortes más recientes
        ({shown.map((row) => formatMonth(row.cohortMonth)).join(', ')}). Los valores exactos están en la matriz; los meses
        ocultos o abiertos no se dibujan.
      </figcaption>
      <ul className={s.legend} aria-hidden="true">
        {shown.map((row, i) => (
          <li key={row.cohortMonth}><span style={{ background: COLORS[i] }} />{formatMonth(row.cohortMonth)}</li>
        ))}
      </ul>
    </figure>
  );
}
