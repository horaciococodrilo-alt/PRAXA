'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { cn } from '@/components/ui';
import type { DiagnosticoVista } from '@/modules/app-data/types';
import { generarDiagnostico, guardarObjetivoDiagnostico } from '@/modules/diagnostics/actions';
import type { DocBlock, Resultado } from '@/modules/diagnostics/compose';

import d from './diagnostico.module.css';
import { IconArchivo, IconChevronAbajo, IconChispas, IconFoco } from './icons';

/**
 * Pantalla del diagnóstico de Meta Ads (M26a). Muestra el estado que calcula la base, el objetivo,
 * la generación y el informe vigente compuesto en el servidor (el mismo modelo que imprime el
 * PDF). Los formularios no llevan identificadores: la empresa y la conexión las resuelve el
 * servidor. Un error de lectura se muestra como error, nunca como vacío.
 */

const MENSAJES: Readonly<Record<Resultado, string>> = {
  objetivo_guardado: 'Guardamos el objetivo del diagnóstico.',
  objetivo_invalido: 'Ese objetivo no es válido: elegí una opción de la lista.',
  generado: 'Listo: el diagnóstico fue generado y reemplazó al anterior.',
  en_curso: 'Ya hay un diagnóstico generándose. Esperá a que termine.',
  sin_actividad: 'La cuenta no tuvo actividad en el período: no hay nada que diagnosticar. Se conserva el informe anterior, si había.',
  sin_cobertura: 'Faltan datos de Meta en el período: sincronizá de nuevo antes de generar.',
  no_elegible: 'Todavía no se puede generar un diagnóstico: revisá el estado de abajo.',
  fallo_generacion: 'No se pudo generar el diagnóstico. Se conserva el informe anterior, si había.',
  conexion_cambiada: 'La conexión con Meta cambió durante la generación: no se publicó nada.',
};

const AR = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit',
  month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function fechaHora(iso: string): string {
  const p = Object.fromEntries(AR.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} a las ${p.hour}:${p.minute}`;
}

function BotonGenerar({ reemplaza }: { reemplaza: boolean }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button type="submit" className={d.primary} disabled={pending}>
        {pending ? 'Generando… puede tardar unos minutos' : 'Generar diagnóstico'}
      </button>
      {reemplaza ? <small className={d.hint}>Generar un diagnóstico nuevo reemplaza el informe actual.</small> : null}
    </>
  );
}

type TipoObjetivo = 'purchase' | 'inquiry' | 'traffic';

const OBJETIVOS: readonly { valor: TipoObjetivo; titulo: string; detalle: string }[] = [
  { valor: 'purchase', titulo: 'Ventas', detalle: 'Que más gente compre en tu tienda.' },
  { valor: 'inquiry', titulo: 'Consultas', detalle: 'Que más gente te escriba o deje sus datos.' },
  { valor: 'traffic', titulo: 'Tráfico', detalle: 'Que más gente entre a tu sitio desde los anuncios.' },
];

const PREGUNTA_ACCION: Readonly<Record<'purchase' | 'inquiry', string>> = {
  purchase: '¿Qué cuenta como una venta?',
  inquiry: '¿Qué cuenta como una consulta?',
};

function FormularioObjetivo({ vista }: { vista: DiagnosticoVista }) {
  const opciones = vista.opcionesObjetivo;
  const sugerida = (t: TipoObjetivo) => opciones.find((o) => o.fit === t)?.action_type ?? '';
  const guardada = vista.objetivo?.metric_ref.startsWith('actions:') ? vista.objetivo.metric_ref.slice('actions:'.length) : '';
  const inicial: TipoObjetivo = vista.objetivo?.goal_kind ?? 'purchase';
  const [tipo, setTipo] = useState<TipoObjetivo>(inicial);
  const [accion, setAccion] = useState(opciones.some((o) => o.action_type === guardada) ? guardada : sugerida(inicial));
  const elegirTipo = (t: TipoObjetivo) => {
    setTipo(t);
    // Al cambiar de objetivo se sugiere la acción natural, salvo que la elegida ya le corresponda.
    if (t !== 'traffic' && opciones.find((o) => o.action_type === accion)?.fit !== t) setAccion(sugerida(t));
  };
  const recomendadas = tipo === 'traffic' ? [] : opciones.filter((o) => o.fit === tipo);
  const otras = tipo === 'traffic' ? [] : opciones.filter((o) => o.fit !== tipo);
  const opcion = (o: (typeof opciones)[number]) => <option key={o.action_type} value={o.action_type}>{o.label}</option>;
  return (
    <form action={guardarObjetivoDiagnostico} className={d.form}>
      <fieldset className={d.choices}>
        <legend>¿Qué querés mejorar?</legend>
        {OBJETIVOS.map((o) => (
          <label key={o.valor} className={cn(d.choice, tipo === o.valor && d.choiceOn)}>
            <input type="radio" name="goal_kind" value={o.valor} checked={tipo === o.valor}
              onChange={() => elegirTipo(o.valor)} className={d.choiceInput} />
            <span className={d.choiceTitle}>{o.titulo}</span>
            <span className={d.choiceText}>{o.detalle}</span>
          </label>
        ))}
      </fieldset>
      {tipo !== 'traffic' ? (
        <label className={d.select}>
          <span className={d.selectTitle}>{PREGUNTA_ACCION[tipo]}</span>
          <select name="action_type" value={accion} onChange={(e) => setAccion(e.target.value)}>
            <option value="">Elegí una opción</option>
            {recomendadas.length > 0 && otras.length > 0 ? (
              <>
                <optgroup label="Recomendadas">{recomendadas.map(opcion)}</optgroup>
                <optgroup label="Otras acciones de tu cuenta">{otras.map(opcion)}</optgroup>
              </>
            ) : [...recomendadas, ...otras].map(opcion)}
          </select>
          {opciones.length === 0
            ? <small className={d.hint}>Todavía no hay acciones registradas en tu cuenta: podés elegir Tráfico o sincronizar Meta.</small>
            : recomendadas.length > 0
              ? <small className={d.hint}>Te sugerimos la más común. Cambiala solo si en tu cuenta se registran de otra forma.</small>
              : <small className={d.hint}>No encontramos una opción típica para este objetivo: elegí la que mejor lo represente.</small>}
        </label>
      ) : (
        <p className={d.hint}>Se mide con los clics en el enlace de tus anuncios.</p>
      )}
      <button type="submit" className={d.secondary}>Guardar objetivo</button>
    </form>
  );
}

function Estado({ vista }: { vista: DiagnosticoVista }) {
  switch (vista.estado) {
    case 'sin_empresa':
      return <p className={d.p}>Completá los datos de tu empresa en <Link href="/app/configuracion">Configuración</Link> para empezar.</p>;
    case 'sin_conexion':
      return (
        <p className={d.p}>
          Conectá tu cuenta de Meta Ads para generar un diagnóstico. <Link href="/app/integraciones">Ir a integraciones</Link>
        </p>
      );
    case 'sin_objetivo':
      return (
        <>
          <h2 className={d.h}>Elegí el objetivo del diagnóstico</h2>
          <FormularioObjetivo vista={vista} />
        </>
      );
    case 'sincronizacion_requerida':
      return (
        <p className={d.p}>
          Sincronizá Meta Ads: el diagnóstico necesita una sincronización completa de menos de 24 horas, posterior al
          último informe. <Link href="/app/integraciones">Ir a integraciones</Link>
        </p>
      );
    case 'sincronizacion_en_curso':
      return <p className={d.p}>Hay una sincronización de Meta en curso. Volvé cuando termine.</p>;
    case 'espera':
      return (
        <p className={d.p}>
          {vista.disponibleDesde
            ? `Vas a poder generar un diagnóstico nuevo desde el ${fechaHora(vista.disponibleDesde)} (hora de Argentina).`
            : 'Todavía no pasaron 24 horas desde el último diagnóstico.'}
        </p>
      );
    case 'listo':
      return (
        <form action={generarDiagnostico} className={d.form}>
          <BotonGenerar reemplaza={vista.informe !== null} />
        </form>
      );
  }
}

function Bloque({ b }: { b: DocBlock }) {
  switch (b.kind) {
    case 'paragraph':
      return <p>{b.label ? <span className={d.label}>{b.label}</span> : null}{b.text}</p>;
    case 'subheading':
      return <h4>{b.text}</h4>;
    case 'notice':
      return <p className={d.notice}>{b.text}</p>;
    case 'list':
      return <ul>{b.items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
    case 'table':
      return (
        <div className={d.tableWrap}>
          <table className={d.table}>
            <thead><tr>{b.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
            <tbody>{b.rows.map((row, r) => <tr key={r}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
  }
}

export function Diagnostico({ vista, error = false, resultado = null }: {
  vista: DiagnosticoVista | null;
  error?: boolean;
  resultado?: Resultado | null;
}) {
  const [abierto, setAbierto] = useState(true);
  const docId = useId();
  const informe = vista?.informe ?? null;

  return (
    <>
      {resultado ? <p role="status" className={d.status}>{MENSAJES[resultado]}</p> : null}
      {error || !vista ? (
        <section role="alert" className={cn(d.card, d.empty)}>
          <h2 className={d.h}>No se pudo leer el diagnóstico.</h2>
          <p className={d.p}>Probá de nuevo en unos minutos. Si sigue, avisanos.</p>
        </section>
      ) : (
        <>
          <section className={cn(d.card, d.controls)} aria-label="Estado del diagnóstico">
            {vista.objetivo && vista.estado !== 'sin_objetivo' ? (
              <p className={d.p}><strong>Objetivo:</strong> {vista.objetivo.etiqueta}</p>
            ) : null}
            <Estado vista={vista} />
            {vista.objetivo && vista.estado !== 'sin_objetivo' && vista.estado !== 'sin_conexion' && vista.estado !== 'sin_empresa' ? (
              <details className={d.details}>
                <summary>Cambiar objetivo</summary>
                <FormularioObjetivo vista={vista} />
              </details>
            ) : null}
          </section>

          {informe ? (
            <>
              <section className={cn(d.card, d.hero)} aria-label="Resumen del diagnóstico">
                <div>
                  <div className={d.lh}>
                    <span className={cn(d.tile, d.tileLg)}><IconChispas size={30} stroke={1.4} /></span>
                    <h2 className={d.h}>{informe.title}</h2>
                  </div>
                  {informe.meta.map((m) => <p key={m.label} className={d.meta}><strong>{m.label}:</strong> {m.value}</p>)}
                  <p className={d.p}><span className={d.label}>Interpretación de Claude</span>{informe.summary}</p>
                  <a className={d.secondary} href="/app/diagnostico/descargar">Descargar PDF</a>
                </div>
                <div className={d.vr} aria-hidden="true" />
                <aside aria-labelledby={`${docId}-o`}>
                  <div className={d.oh}>
                    <IconFoco size={26} stroke={1.5} />
                    <h2 id={`${docId}-o`}>Oportunidades destacadas</h2>
                  </div>
                  {informe.opportunities.length === 0 ? (
                    <p className={d.p}>Sin oportunidades con evidencia suficiente en este informe.</p>
                  ) : (
                    <ul className={d.ol}>
                      {informe.opportunities.map((o, i) => (
                        <li key={i}><span><strong>{o.title}</strong><small>{o.priority}</small></span></li>
                      ))}
                    </ul>
                  )}
                </aside>
              </section>

              <section className={cn(d.card, d.full)} aria-label="Análisis completo">
                <div className={d.fh}>
                  <span className={cn(d.tile, d.tileMd)}><IconArchivo size={26} stroke={1.5} /></span>
                  <div>
                    <h2>
                      <button type="button" className={d.fhBtn} aria-expanded={abierto} aria-controls={docId}
                        onClick={() => setAbierto((a) => !a)}>
                        Análisis completo del diagnóstico
                        <IconChevronAbajo size={18} stroke={2} />
                      </button>
                    </h2>
                    <p>{informe.subtitle}</p>
                  </div>
                </div>
                {abierto ? (
                  <>
                    <div className={d.sep} />
                    <div className={d.doc} id={docId}>
                      {informe.sections.map((s) => (
                        <section key={s.id} aria-label={s.title}>
                          <h3>{s.title}</h3>
                          {s.blocks.map((b, i) => <Bloque key={i} b={b} />)}
                        </section>
                      ))}
                      <p className={d.notice}>{informe.footer}</p>
                    </div>
                  </>
                ) : null}
              </section>
            </>
          ) : (
            <section className={cn(d.card, d.empty)} aria-label="Resumen del diagnóstico">
              <div className={d.lh}>
                <span className={cn(d.tile, d.tileLg)}><IconChispas size={30} stroke={1.4} /></span>
                <h2 className={d.h}>Todavía no hay un diagnóstico.</h2>
              </div>
              <p className={d.p}>
                Se genera con los datos sincronizados de Meta Ads de los últimos 28 días, cuando la cuenta está
                conectada y hay un objetivo elegido.
              </p>
            </section>
          )}
        </>
      )}
    </>
  );
}
