'use client';

import { useState } from 'react';

import type { BlockView } from '@/modules/chat/render';

import styles from './basic-block.module.css';

const GRAPH_TYPES = new Set(['lineas', 'barras', 'barras_agrupadas', 'dona',
  'barras_apiladas', 'calendario_calor', 'tabla_tendencia', 'ranking', 'embudo']);

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

export function BasicBlock({ block, onSuggestion }: { block: BlockView;
  onSuggestion?: (text: string) => void }) {
  const [showData, setShowData] = useState(false);
  const [showChildren, setShowChildren] = useState(false);
  const graph = GRAPH_TYPES.has(block.type);
  const tableVisible = !graph || showData;
  const points = block.series.flatMap((series) => series.points);
  return (
    <section className={styles.block} aria-label={block.title} data-block-type={block.type}>
      <h3 className={styles.title}>{block.title}</h3>
      {block.type === 'tarjeta' ? (
        <>
          {points[0]?.x ? <p className={styles.cardLabel}>{points[0].x}</p> : null}
          <p className={styles.cardValue}>{points[0]?.text ?? 'Sin dato'}</p>
        </>
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
          {block.type === 'barras_apiladas' ? <div data-chart-type="barras_apiladas"
            aria-hidden="true">
            {(block.series[0]?.points ?? []).map((day, index) =>
              <div className={styles.stackRow} key={day.x}>
                <span>{day.x}</span><div className={styles.stackTrack}
                  data-stack-height={block.stack_ratios?.[index] ?? 0}
                  style={{ width: `${(block.stack_ratios?.[index] ?? 0) / 100}%` }}>
                  {block.series.map((series, seriesIndex) =>
                    series.points[index]?.ratio === null ? null :
                      <span key={seriesIndex} className={styles.stackPart}
                        style={{ width: `${(series.points[index]?.ratio ?? 0) / 100}%` }} />)}
                </div>
                {block.series.some((series) => series.points[index]?.ratio === null) ?
                  <small className={styles.missingLabel}>Sin dato: {block.series.filter(
                    (series) => series.points[index]?.ratio === null)
                    .map((series) => series.label).join(', ')}</small> : null}
              </div>)}
          </div> : null}
          {block.type === 'tabla_tendencia' ? <div data-chart-type="tabla_tendencia">
            {block.series.map((series) => <div key={series.label}>
              <span>{series.label}</span>
              <svg aria-hidden="true" className={styles.miniLine}
                viewBox="0 0 100 100" preserveAspectRatio="none">
                {lineRuns(series.points).map((run, index) => <polyline key={index}
                  points={run} fill="none" stroke="currentColor" strokeWidth="2" />)}
                {series.points.map((point, index) => point.ratio === null ? null :
                  <circle key={index} r="2" fill="currentColor"
                    cx={series.points.length === 1 ? 50 :
                      5 + index * 90 / (series.points.length - 1)}
                    cy={95 - point.ratio * 90 / 10000} />)}
              </svg>
              {series.points.some((point) => point.ratio === null) ?
                <span>Sin dato en algunos días</span> : null}
            </div>)}
          </div> : null}
          {block.type === 'calendario_calor' ? <div className={styles.calendar}
            data-chart-type="calendario_calor" aria-hidden="true">
            {points.map((point) => <span key={point.x}
              className={point.ratio === null ? styles.calendarMissing : styles.calendarCell}
              data-intensity={point.ratio === null ? 'missing' : point.ratio}
              style={point.ratio === null ? undefined :
                { opacity: 0.2 + point.ratio * 0.8 / 10000 }}
              title={`${point.x}: ${point.text ?? 'No observado'}`} />)}
          </div> : null}
          {!['barras_apiladas', 'tabla_tendencia', 'calendario_calor'].includes(block.type) ?
          points.map((point, index) => (
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
          )) : null}
        </div>
      ) : null}
      {block.type === 'conclusiones' && block.items ?
        <ul className={styles.notes}>{block.items.map((item, index) =>
          <li key={index}><strong>{item.provenance}: </strong>
            {item.segments.map((segment, part) => <span key={part}>{segment.text}</span>)}</li>)}</ul> : null}
      {block.type === 'preguntas_sugeridas' && block.suggestions ?
        <ul className={styles.notes}>{block.suggestions.map((item) =>
          <li key={item.id}><button type="button" className={styles.toggle}
            onClick={() => onSuggestion?.(item.text)}>{item.text}</button></li>)}</ul> : null}
      {block.type === 'tabla_desplegable' && block.children?.length ?
        <div><button type="button" className={styles.toggle}
          aria-expanded={showChildren} onClick={() => setShowChildren((open) => !open)}>
          {showChildren ? 'Ocultar detalle' : 'Ver detalle'}</button>
          {showChildren ? block.children.map((child) => <div key={child.parent}>
            <h4>{child.parent}</h4><ul>{child.rows.map((row, index) =>
              <li key={index}>{row.join(' · ')}</li>)}</ul></div>) : null}
        </div> : null}
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
