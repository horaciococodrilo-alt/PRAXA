'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/components/ui';

import { jetbrainsMono, manrope } from './fonts';
import shared from './landing.module.css';

const STORAGE_KEY = 'praxa-tema';

declare global {
  interface Window {
    /** Fija el tema de la landing ('light' | 'dark'); sin argumento vuelve a seguir al sistema. */
    praxaTema?: (tema?: 'light' | 'dark') => void;
  }
}

// Corre mientras el navegador parsea el HTML, antes de pintar: fija el tema guardado o
// el del sistema y marca que hay JavaScript (para pausar el chat hasta que se vea).
// En navegaciones del lado del cliente no se ejecuta; ahí lo resuelve el efecto.
const FIRST_PAINT_SCRIPT = `(function(){var r=document.currentScript&&document.currentScript.parentElement;if(!r)return;var t=null;try{t=localStorage.getItem('${STORAGE_KEY}')}catch(e){}if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';r.setAttribute('data-theme',t);r.setAttribute('data-js','')})()`;

function savedTheme(): 'light' | 'dark' | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Raíz de la landing: aplica las tipografías, los tokens y el tema.
 *
 * El tema sigue a `prefers-color-scheme` salvo que se fije a mano con
 * `praxaTema('light' | 'dark')`, que lo guarda en localStorage; `praxaTema()` vuelve a
 * automático. Sin JavaScript se ve la versión clara.
 */
export function LandingRoot({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      root.setAttribute('data-theme', savedTheme() ?? (media.matches ? 'dark' : 'light'));
    };

    window.praxaTema = (tema) => {
      try {
        if (tema === 'light' || tema === 'dark') localStorage.setItem(STORAGE_KEY, tema);
        else localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Sin localStorage el tema sigue al sistema.
      }
      apply();
    };

    apply();
    root.setAttribute('data-js', '');
    media.addEventListener('change', apply);
    return () => {
      media.removeEventListener('change', apply);
      delete window.praxaTema;
    };
  }, []);

  return (
    // El script de primer pintado cambia data-theme y data-js antes de hidratar.
    <div
      ref={ref}
      className={cn(shared.root, manrope.variable, jetbrainsMono.variable)}
      data-theme="light"
      suppressHydrationWarning
    >
      <script
        // En el servidor se emite ejecutable; en el cliente React lo marca como texto
        // para no volver a ejecutarlo ni advertir por un <script> renderizado.
        type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: FIRST_PAINT_SCRIPT }}
      />
      {children}
    </div>
  );
}
