'use client';

import { useState } from 'react';

import type { BlockView } from '@/modules/chat/render';

import styles from './basic-block.module.css';

const GRAPH_TYPES = new Set(['lineas', 'barras', 'barras_agrupadas', 'dona',
  'barras_apiladas', 'calendario_calor', 'tabla_tendencia', 'ranking', 'embudo']);

type Point = BlockView['series'][number]['points'][number];

const BAR_TYPES = new Set(['barras', 'barras_agrupadas']);

function pointText(point: Point): string {
  return point.text ?? (point.absence === 'sin_fila_reportada' ? 'Sin fila reportada' :
    point.absence === 'no_informado' ? 'No informado' :
      point.absence === 'no_calculable' ? 'No calculable' : 'No observado');
}

function BarRow({ point, label, alt }: { point: Point; label: string; alt: boolean }) {
  return (
    <div className={styles.hbar}>
      <span className={styles.hbarLabel}>{label}</span>
      <span className={styles.hbarTrack} aria-hidden="true">
        {point.ratio !== null ? <span className={alt ? styles.hbarFillAlt : styles.hbarFill}
          style={{ width: `${point.ratio / 100}%` }} /> : null}
      </span>
      <span className={styles.hbarValue}>{pointText(point)}</span>
    </div>
  );
}

/** Barras horizontales: etiqueta, barra proporcional y valor. Las agrupadas llevan leyenda. */
function HorizontalBars({ points, grouped }: { points: Point[]; grouped: boolean }) {
  if (!grouped || !points.some((point) => point.member)) {
    return <div className={styles.hbars} data-chart-type="barras">
      {points.map((point, index) => <BarRow key={`${point.x}-${index}`} point={point}
        label={point.x} alt={false} />)}
    </div>;
  }
  const members = [...new Set(points.map((point) => point.member ?? point.x))];
  const groups = new Map<string, Point[]>();
  for (const point of points) {
    const key = point.group ?? '';
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }
  return (
    <div className={styles.hbars} data-chart-type="barras_agrupadas">
      {members.length > 1 ? <ul className={styles.legend}>
        {members.map((member, index) => <li key={member}>
          <span className={index % 2 ? styles.swatchAlt : styles.swatch} aria-hidden="true" />
          {member}</li>)}
      </ul> : null}
      {[...groups.entries()].map(([group, items]) => <div className={styles.hbarGroup} key={group}>
        {group ? <p className={styles.hbarGroupTitle}>{group}</p> : null}
        {items.map((point, index) => {
          const member = point.member ?? point.x;
          return <BarRow key={`${member}-${index}`} point={point} label={member}
            alt={members.indexOf(member) % 2 === 1} />;
        })}
      </div>)}
    </div>
  );
}

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

// Gráfico de líneas: lienzo fijo para que los puntos sigan redondos; los rótulos van en HTML.
const LINE_W = 600;
const LINE_H = 200;
const LINE_PAD = { left: 10, right: 10, top: 12, bottom: 12 };

function linePosition(index: number, count: number, ratio: number) {
  const width = LINE_W - LINE_PAD.left - LINE_PAD.right;
  const height = LINE_H - LINE_PAD.top - LINE_PAD.bottom;
  const x = LINE_PAD.left + (count === 1 ? width / 2 : index * width / (count - 1));
  const y = LINE_PAD.top + height - ratio * height / 10000;
  return { x, y };
}

/** Línea con área, eje con el máximo y el cero, fechas de los extremos y el valor de cada punto. */
function LineChart({ points }: { points: Point[] }) {
  const runs: { x: number; y: number; point: Point }[][] = [];
  let current: { x: number; y: number; point: Point }[] = [];
  points.forEach((point, index) => {
    if (point.ratio === null) { if (current.length) runs.push(current); current = []; return; }
    current.push({ ...linePosition(index, points.length, point.ratio), point });
  });
  if (current.length) runs.push(current);
  const top = points.find((point) => point.ratio === 10000)?.text ?? null;
  const missing = points.filter((point) => point.ratio === null);
  const base = LINE_H - LINE_PAD.bottom;
  const mid = points[Math.floor((points.length - 1) / 2)];
  return (
    <div className={styles.lineChart} data-chart-type="lineas">
      <div className={styles.lineAxisY} aria-hidden="true">
        <span data-axis="max">{top ? `Máx. ${top}` : ''}</span>
      </div>
      <svg aria-hidden="true" className={styles.line} viewBox={`0 0 ${LINE_W} ${LINE_H}`}>
        <line className={styles.lineGrid} x1={LINE_PAD.left} x2={LINE_W - LINE_PAD.right}
          y1={LINE_PAD.top} y2={LINE_PAD.top} />
        <line className={styles.lineGrid} x1={LINE_PAD.left} x2={LINE_W - LINE_PAD.right}
          y1={(LINE_PAD.top + base) / 2} y2={(LINE_PAD.top + base) / 2} />
        <line className={styles.lineBase} x1={LINE_PAD.left} x2={LINE_W - LINE_PAD.right} y1={base} y2={base} />
        {runs.map((run, index) => run.length > 1 ? <polygon key={`a${index}`} className={styles.lineArea}
          points={[`${run[0].x},${base}`, ...run.map((p) => `${p.x},${p.y}`),
            `${run[run.length - 1].x},${base}`].join(' ')} /> : null)}
        {runs.map((run, index) => <polyline key={`l${index}`} points={run.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}
        {runs.flat().map((p, index) => <circle key={index} cx={p.x} cy={p.y}
          r={points.length > 31 ? 2.5 : 4} fill="currentColor">
          <title>{`${p.point.x}: ${p.point.text ?? ''}`}</title>
        </circle>)}
      </svg>
      <div className={styles.lineAxisX} aria-hidden="true">
        <span data-axis="desde">{points[0]?.x ?? ''}</span>
        {points.length > 2 && mid ? <span>{mid.x}</span> : null}
        <span data-axis="hasta">{points.length > 1 ? points[points.length - 1].x : ''}</span>
      </div>
      {missing.length ? <ul className={styles.lineMissing}>
        <li><span>Sin dato:</span></li>
        {missing.map((point, index) => <li key={`${point.x}-${index}`}>
          <span>{point.x}</span> · <span>{pointText(point)}</span></li>)}
      </ul> : null}
    </div>
  );
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
          {block.type === 'lineas' ? <LineChart points={points} /> : null}
          {BAR_TYPES.has(block.type) ?
            <HorizontalBars points={points} grouped={block.type === 'barras_agrupadas'} /> : null}
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
          {!['lineas', 'barras', 'barras_agrupadas', 'barras_apiladas', 'tabla_tendencia',
            'calendario_calor'].includes(block.type) ?
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
