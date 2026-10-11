'use client';

import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import type { Integracion } from '@/modules/app-data/types';

import s from './app.module.css';
import c from './chat.module.css';
import { IconEnviar, IconGlobo, IconMas, IconSubir, MarcaPraxa } from './icons';
import { IntegracionLogo } from './integracion-logo';
import { Avatar, Img } from './ui';

const SUGERENCIAS = [
  '¿Qué campañas están rindiendo mejor?',
  '¿Por qué bajó el ROAS esta semana?',
  '¿Qué anuncios generan más ventas?',
  '¿Cómo viene el rendimiento vs. el mes pasado?',
];

type Mensaje = { id: number; texto: string; hora: string };

const horaActual = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Chat. Se envía con el botón o con Enter (Shift+Enter agrega un salto de línea); el botón
 * solo se activa con texto. Una sugerencia se copia al cuadro, no se envía.
 *
 * Todavía no hay respuesta: el backend no existe. El historial vive solo en este
 * componente y se pierde al navegar. `pensando` muestra el estado "Buscando en internet…"
 * del diseño después de cada pregunta; hoy ninguna pantalla lo activa.
 */
export function Chat({
  iniciales,
  conectadas,
  pensando = false,
}: {
  iniciales: string;
  /** Conectores conectados, en el orden en que se muestran. */
  conectadas: Pick<Integracion, 'id' | 'nombre'>[];
  pensando?: boolean;
}) {
  const [texto, setTexto] = useState('');
  const [buscarEnInternet, setBuscarEnInternet] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const ta = useRef<HTMLTextAreaElement>(null);
  const vacio = !texto.trim();

  const enviar = (e?: FormEvent) => {
    e?.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setMensajes((m) => [...m, { id: m.length, texto: t, hora: horaActual() }]);
    setTexto('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      enviar();
    }
  };

  return (
    <div className={c.wrap}>
      <MarcaPraxa className={c.mark} />
      <h1 className={c.h1}>
        Tu marketing, en
        <br />
        <em>una sola conversación.</em>
      </h1>
      <p className={c.lead}>Preguntá, analizá y tomá decisiones con los datos de tu empresa.</p>
      {/* Una etiqueta por conector conectado; sin ninguno, no se muestra nada. */}
      {conectadas.length > 0 ? (
        <ul className={c.srcs} aria-label="Fuentes conectadas">
          {conectadas.map((i) => (
            <li key={i.id} className={c.src}>
              <IntegracionLogo id={i.id} size={24} />
              {i.nombre}
              <span className={s.dot} aria-hidden="true" />
            </li>
          ))}
        </ul>
      ) : null}

      {mensajes.length > 0 ? (
        <div className={c.log} role="log" aria-label="Conversación" aria-live="polite">
          {mensajes.map((m) => (
            <div key={m.id} className={c.user}>
              <div className={c.bubble}>
                <span>{m.texto}</span>
                <time dateTime={m.hora}>{m.hora}</time>
              </div>
              <Avatar className={c.avatar}>{iniciales}</Avatar>
            </div>
          ))}
          {pensando ? (
            <div className={c.think} role="status">
              <Img src="/app/robot-praxa.png" alt="" width={26} height={26} />
              <span className={c.pulse} aria-hidden="true" />
              <span>Buscando en internet...</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <form className={c.box} onSubmit={enviar}>
        <textarea
          ref={ta}
          className={c.ta}
          rows={2}
          placeholder="Escribí tu pregunta acá..."
          aria-label="Tu pregunta"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className={c.ctl}>
          {/* Adjuntar no tiene acción todavía. */}
          <button type="button" className={c.ib} aria-label="Adjuntar">
            <IconMas size={19} stroke={1.8} />
          </button>
          {/* Se activa y desactiva; todavía no cambia la respuesta (no hay backend). */}
          <button
            type="button"
            className={c.ib}
            aria-label="Buscar en internet"
            aria-pressed={buscarEnInternet}
            onClick={() => setBuscarEnInternet((b) => !b)}
          >
            <IconGlobo size={18} />
          </button>
          <button type="submit" className={c.send} aria-label="Enviar" disabled={vacio}>
            <IconEnviar size={18} stroke={2.2} />
          </button>
        </div>
      </form>

      <div className={c.sugs} role="group" aria-label="Preguntas sugeridas">
        {SUGERENCIAS.map((t) => (
          <button
            key={t}
            type="button"
            className={c.sug}
            onClick={() => {
              setTexto(t);
              ta.current?.focus();
            }}
          >
            <span>{t}</span>
            <IconSubir size={17} stroke={1.9} />
          </button>
        ))}
      </div>
    </div>
  );
}
