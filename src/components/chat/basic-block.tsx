'use client';

import { useState } from 'react';

import type { BlockView } from '@/modules/chat/render';

import styles from './basic-block.module.css';

const GRAPH_TYPES = new Set(['lineas', 'barras', 'barras_agrupadas', 'dona']);

function lineRuns(points: BlockView['series'][number]['points']) {
  const runs: string[] = [];
  let current: string[] = [];
  const flush = () => { if (current.length) runs.push(current.join(' ')); current = []; };
  points.forEach((point, index) => {
    if (point.ratio === null) { flush(); return; }
    const x = points.length === 1 ? 50 : 5 + index * 90 / (points.length - 1);
    const y = 95 - point.ratio * 90 / 10000;
    current.push(`${x},${y}`);
  });
  flush();
  return runs;
}

function donutFill(points: BlockView['series'][number]['points']) {
  const colors = ['var(--accent)', 'var(--accent-busy)', 'var(--focus)',
    'var(--accent-text)', 'var(--text-strong-muted)', 'var(--line-strong)'];
  let cursor = 0;
  const stops = points.filter((point) => point.ratio !== null).map((point, index) => {
    const start = cursor;
    cursor += point.ratio! / 100;
    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

export function BasicBlock({ block }: { block: BlockView }) {
  const [showData, setShowData] = useState(false);
  const graph = GRAPH_TYPES.has(block.type);
  const tableVisible = !graph || showData;
  const points = block.series.flatMap((series) => series.points);
  return (
    <section className={styles.block} aria-label={block.title}>
      <h3 className={styles.title}>{block.title}</h3>
      {block.type === 'tarjeta' ? (
        <p className={styles.cardValue}>{points[0]?.text ?? 'Sin dato'}</p>
      ) : graph ? (
        <div role="img" aria-label={block.aria_label} className={styles.graph}>
          {block.type === 'lineas' ? <svg aria-hidden="true" className={styles.line}
            viewBox="0 0 100 100" preserveAspectRatio="none">
            {lineRuns(points).map((run, index) => <polyline key={index} points={run}
              fill="none" stroke="currentColor" strokeWidth="2" />)}
            {points.map((point, index) => point.ratio === null ? null :
              <circle key={index} r="2" fill="currentColor"
                cx={points.length === 1 ? 50 : 5 + index * 90 / (points.length - 1)}
                cy={95 - point.ratio * 90 / 10000} />)}
          </svg> : null}
          {block.type === 'dona' ? <div data-chart-type="dona" aria-hidden="true"
            className={styles.donut} style={{ backgroundImage: donutFill(points) }} /> : null}
          {points.map((point, index) => (
            <div className={styles.point} key={`${point.x}-${index}`}>
              <span className={styles.value}>{point.text ??
                (point.absence === 'sin_fila_reportada' ? 'Sin fila reportada' :
                  point.absence === 'no_informado' ? 'No informado' :
                    point.absence === 'no_calculable' ? 'No calculable' : 'No observado')}</span>
              <span className={styles.track} aria-hidden="true">
                {point.ratio !== null ? <span className={styles.fill}
                  style={{ width: `${point.ratio / 100}%` }} /> : null}
              </span>
              <span className={styles.label}>{point.x}</span>
            </div>
          ))}
        </div>
      ) : null}
      {graph ? <button className={styles.toggle} type="button"
        onClick={() => setShowData((open) => !open)}
        aria-expanded={showData}>{showData ? 'Ocultar datos' : 'Ver datos'}</button> : null}
      {tableVisible ? <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>{block.table.headers.map((header, index) =>
            <th key={`${header}-${index}`} scope="col">{header}</th>)}</tr></thead>
          <tbody>{block.table.rows.map((row, index) =>
            <tr key={index}>{row.map((cell, cellIndex) =>
              cellIndex === 0 ? <th key={cellIndex} scope="row">{cell}</th> :
                <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div> : null}
      {block.notes.length ? <ul className={styles.notes}>
        {block.notes.map((note) => <li key={note}>{note}</li>)}
      </ul> : null}
    </section>
  );
}
