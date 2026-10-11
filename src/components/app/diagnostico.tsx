'use client';

import { useId, useState, type ReactElement } from 'react';

import { cn } from '@/components/ui';
import type { BloqueAnalisis, Diagnostico as DatosDiagnostico, IconoOportunidad } from '@/modules/app-data/types';

import d from './diagnostico.module.css';
import {
  IconArchivo,
  IconBarras,
  IconCaja,
  IconChevronAbajo,
  IconChevronDerecha,
  IconChispas,
  IconFoco,
  IconPersonas,
} from './icons';

const ICONOS: Record<IconoOportunidad, ReactElement> = {
  personas: <IconPersonas size={24} stroke={1.6} />,
  producto: <IconCaja size={24} stroke={1.6} />,
  barras: <IconBarras size={24} stroke={1.6} barStroke={3.2} />,
};

function Bloques({ bloques }: { bloques: BloqueAnalisis[] }) {
  return bloques.map((b, i) => {
    if (b.tipo === 'subtitulo') return <h4 key={i}>{b.texto}</h4>;
    if (b.tipo === 'parrafo') return <p key={i}>{b.texto}</p>;
    return (
      <ol key={i}>
        {b.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    );
  });
}

/** Resumen, oportunidades y análisis completo colapsable (abierto al entrar). */
export function Diagnostico({ datos }: { datos: DatosDiagnostico }) {
  const [abierto, setAbierto] = useState(true);
  const docId = useId();

  return (
    <>
      <section className={cn(d.card, d.hero)} aria-label="Resumen del diagnóstico">
        <div>
          <div className={d.lh}>
            <span className={cn(d.tile, d.tileLg)}>
              <IconChispas size={30} stroke={1.4} />
            </span>
            <h2 className={d.h}>
              {datos.titular.inicio}
              <br />
              <em>{datos.titular.destacado}</em>
            </h2>
          </div>
          {datos.parrafos.map((p) => (
            <p key={p} className={d.p}>
              {p}
            </p>
          ))}
        </div>
        <div className={d.vr} aria-hidden="true" />
        <aside aria-labelledby={`${docId}-o`}>
          <div className={d.oh}>
            <IconFoco size={26} stroke={1.5} />
            <h2 id={`${docId}-o`}>Oportunidades destacadas</h2>
          </div>
          <ul className={d.ol}>
            {datos.oportunidades.map((o) => (
              <li key={o.titulo}>
                <span className={cn(d.tile, d.tileSm)}>{ICONOS[o.icono]}</span>
                {/* Sin acción todavía: el diseño no define a dónde lleva. */}
                <button type="button" className={d.oi}>
                  <span>
                    <strong>{o.titulo}</strong>
                    <small>{o.detalle}</small>
                  </span>
                  <IconChevronDerecha size={18} />
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section className={cn(d.card, d.full)} aria-label="Análisis completo">
        <div className={d.fh}>
          <span className={cn(d.tile, d.tileMd)}>
            <IconArchivo size={26} stroke={1.5} />
          </span>
          <div>
            <h2>
              <button
                type="button"
                className={d.fhBtn}
                aria-expanded={abierto}
                aria-controls={docId}
                onClick={() => setAbierto((a) => !a)}
              >
                Análisis completo del diagnóstico
                <IconChevronAbajo size={18} stroke={2} />
              </button>
            </h2>
            <p>Explorá el análisis detallado, metodología y recomendaciones.</p>
          </div>
        </div>
        {abierto ? (
          <>
            <div className={d.sep} />
            <div className={d.doc} id={docId}>
              <h3>{datos.analisis.titulo}</h3>
              <Bloques bloques={datos.analisis.bloques} />
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}
