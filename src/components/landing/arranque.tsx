'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Deja las animaciones de su contenido en pausa (vía CSS, mientras falte `data-play`)
 * hasta que alguno de los elementos marcados con `data-arranque` entra en pantalla.
 * Sin IntersectionObserver arranca de inmediato, como la referencia.
 *
 * `data-play` se escribe directo en el DOM: React no lo renderiza, así que no hay
 * nada que reconciliar y no hace falta un re-render.
 */
export function Arranque({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const play = () => root.setAttribute('data-play', '');
    if (!('IntersectionObserver' in window)) {
      play();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          play();
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    root.querySelectorAll('[data-arranque]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
