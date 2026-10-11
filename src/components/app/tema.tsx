'use client';

import { useSyncExternalStore } from 'react';

/**
 * Tema de la app: oscuro por defecto (como el diseño) o claro, elegido en Configuración y
 * guardado en este navegador. No sigue al sistema operativo.
 */
export type Tema = 'dark' | 'light';

export const TEMA_KEY = 'praxa-app-tema';
const EVENTO = 'praxa-app-tema';

// Corre antes de pintar: aplica el tema guardado para que no parpadee el oscuro.
export const TEMA_PRIMER_PINTADO = `(function(){var r=document.currentScript&&document.currentScript.parentElement;if(!r)return;try{if(localStorage.getItem('${TEMA_KEY}')==='light')r.setAttribute('data-theme','light')}catch(e){}})()`;

// Respaldo en memoria por si el navegador bloquea localStorage.
let enMemoria: Tema = 'dark';

function leer(): Tema {
  try {
    return localStorage.getItem(TEMA_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return enMemoria;
  }
}

function suscribir(cambio: () => void) {
  window.addEventListener(EVENTO, cambio);
  window.addEventListener('storage', cambio);
  return () => {
    window.removeEventListener(EVENTO, cambio);
    window.removeEventListener('storage', cambio);
  };
}

function aplicar(tema: Tema) {
  enMemoria = tema;
  try {
    if (tema === 'light') localStorage.setItem(TEMA_KEY, 'light');
    else localStorage.removeItem(TEMA_KEY);
  } catch {
    // Sin localStorage el tema vale solo hasta recargar.
  }
  // El atributo se cambia ya, en el DOM, para que la transición capture el estado nuevo;
  // React después lo deja con el mismo valor.
  document.querySelector('[data-pagina]')?.setAttribute('data-theme', tema);
  window.dispatchEvent(new Event(EVENTO));
}

/**
 * Cambia el tema con un fundido cruzado de toda la pantalla (View Transitions: también
 * funde los fondos con degradé, que CSS no puede animar). La duración está en
 * globals.css. Sin soporte del navegador, o con "reducir movimiento", es instantáneo.
 */
export function guardarTema(tema: Tema) {
  const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (quieto || typeof document.startViewTransition !== 'function') {
    aplicar(tema);
    return;
  }
  document.startViewTransition(() => aplicar(tema));
}

/** Tema actual; en el servidor y durante la hidratación es siempre el oscuro. */
export function useTemaGuardado(): Tema {
  return useSyncExternalStore(suscribir, leer, () => 'dark');
}
