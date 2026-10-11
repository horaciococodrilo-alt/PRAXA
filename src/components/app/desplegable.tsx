'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '@/components/ui';

import d from './desplegable.module.css';
import { IconChevronAbajo } from './icons';

export type Opcion<T extends string | number> = { valor: T; texto: string };

/**
 * Desplegable del sistema: el selector "Últimos 30 días" del diseño, con su menú. Lo usan
 * Uso y costos y Configuración, para que todos los selectores se vean igual (el `<select>`
 * nativo abre la lista del sistema operativo, con otros colores y tipografía).
 *
 * Patrón de lista desplegable: botón con `aria-haspopup="listbox"` y una lista con
 * `role="listbox"`. Teclado: flechas, Inicio/Fin, Enter o Espacio para elegir, Esc o Tab
 * para cerrar. Con `name`, el valor viaja en el formulario en un campo oculto.
 */
export function Desplegable<T extends string | number>({
  id,
  name,
  valor,
  opciones,
  onChange,
  placeholder = 'Elegí una opción',
  icono,
  etiqueta,
  ancho = false,
  labelledBy,
}: {
  id?: string;
  name?: string;
  valor: T | null;
  opciones: readonly Opcion<T>[];
  onChange: (valor: T) => void;
  placeholder?: string;
  icono?: ReactNode;
  /** Texto del botón; por defecto, el de la opción elegida. */
  etiqueta?: string;
  /** Ocupa todo el ancho disponible (Configuración). */
  ancho?: boolean;
  /** Id de la etiqueta visible, para que el nombre del botón la incluya. */
  labelledBy?: string;
}) {
  const propio = useId();
  const botonId = id ?? `${propio}-boton`;
  const listaId = `${propio}-lista`;
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  const elegida = opciones.find((o) => o.valor === valor) ?? null;
  const texto = etiqueta ?? elegida?.texto ?? null;

  const abrir = () => {
    setActiva(Math.max(0, opciones.findIndex((o) => o.valor === valor)));
    setAbierto(true);
  };
  const cerrar = (devolverFoco = true) => {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  };
  const elegir = (i: number) => {
    const o = opciones[i];
    if (o) onChange(o.valor);
    cerrar();
  };

  useEffect(() => {
    if (!abierto) return;
    lista.current?.focus();
    const fuera = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [abierto]);

  const teclaBoton = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      abrir();
    }
  };

  const teclaLista = (e: KeyboardEvent) => {
    const ultima = opciones.length - 1;
    const mover: Record<string, () => number> = {
      ArrowDown: () => Math.min(ultima, activa + 1),
      ArrowUp: () => Math.max(0, activa - 1),
      Home: () => 0,
      End: () => ultima,
    };
    if (mover[e.key]) {
      e.preventDefault();
      setActiva(mover[e.key]());
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      elegir(activa);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cerrar();
    } else if (e.key === 'Tab') {
      cerrar(false);
    }
  };

  return (
    <div className={cn(d.wrap, ancho && d.full)} ref={wrap}>
      <button
        ref={boton}
        id={botonId}
        type="button"
        className={cn(d.trigger, ancho && d.full)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? listaId : undefined}
        aria-labelledby={labelledBy ? `${labelledBy} ${botonId}` : undefined}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={teclaBoton}
      >
        {icono}
        <span className={texto ? undefined : d.placeholder}>{texto ?? placeholder}</span>
        <IconChevronAbajo size={13} />
      </button>
      {name ? <input type="hidden" name={name} value={valor ?? ''} /> : null}
      {abierto ? (
        <ul
          ref={lista}
          id={listaId}
          className={d.menu}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelledBy ?? botonId}
          aria-activedescendant={`${listaId}-${activa}`}
          onKeyDown={teclaLista}
        >
          {opciones.map((o, i) => (
            <li
              key={String(o.valor)}
              id={`${listaId}-${i}`}
              role="option"
              aria-selected={o.valor === valor}
              className={cn(d.opt, i === activa && d.activa)}
              onPointerEnter={() => setActiva(i)}
              onClick={() => elegir(i)}
            >
              {o.texto}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
