'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/components/ui';

import { ThemedImg } from './img';
import shared from './landing.module.css';
import s from './nav.module.css';

function MenuIcon({ path }: { path: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

/**
 * Barra superior. Solo existe en móvil: la referencia de escritorio no tiene barra.
 * El menú tiene únicamente las dos acciones; no hay secciones que navegar.
 */
export function Nav() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button') ?? []);

    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab') return;
      // El panel tapa la barra: el foco queda adentro mientras está abierto.
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  return (
    <>
      <header className={cn(s.bar, shared.soloMov)}>
        <Link href="/" className={s.brand}>
          <ThemedImg
            light="logo-praxa-tinta.png"
            dark="logo-praxa-blanco.png"
            alt="Praxa"
            width={551}
            height={145}
            loading="eager"
            className={s.brandLogo}
          />
        </Link>
        <button
          ref={toggleRef}
          type="button"
          className={s.iconButton}
          aria-label="Abrir menú"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(true)}
        >
          <MenuIcon path="M4 7h16M4 12h16M4 17h16" />
        </button>
      </header>

      {/* Fuera del header: su backdrop-filter haría que `position: fixed` se mida contra él. */}
      {open ? (
        <div className={shared.soloMov}>
          <div className={s.backdrop} aria-hidden="true" onClick={close} />
          <div
            ref={panelRef}
            id={panelId}
            className={s.panel}
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
          >
            <div className={s.panelTop}>
              <ThemedImg
                light="logo-praxa-tinta.png"
                dark="logo-praxa-blanco.png"
                alt="Praxa"
                width={551}
                height={145}
                loading="eager"
                className={s.panelLogo}
              />
              <button
                type="button"
                className={s.iconButton}
                aria-label="Cerrar menú"
                aria-expanded="true"
                aria-controls={panelId}
                onClick={close}
              >
                <MenuIcon path="M6 6l12 12M18 6 6 18" />
              </button>
            </div>
            <Link href="/signup" className={s.primary} onClick={() => setOpen(false)}>
              Crear cuenta
            </Link>
            <Link href="/login" className={s.secondary} onClick={() => setOpen(false)}>
              Iniciar sesión
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
