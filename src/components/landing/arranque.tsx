'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Deja las animaciones de su contenido en pausa (vía CSS, mientras falte `data-play`)
 * hasta que alguno de los elementos marcados con `data-arranque` entra en pantalla.
 * Sin IntersectionObserver arranca de inmediato, como la referencia.
 */
export function Arranque({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (!('IntersectionObserver' in window)) {
      setPlay(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPlay(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    root.querySelectorAll('[data-arranque]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className} data-play={play || undefined}>
      {children}
    </div>
  );
}
