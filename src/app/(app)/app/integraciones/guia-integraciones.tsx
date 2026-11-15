'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { IconAlerta, IconBarras, IconCandado, IconCheck, IconDocumento, IconFlecha, IconPapelera, IconPersona,
  IconPlano } from '@/components/app/icons';
import { Button } from '@/components/app/ui';
import g from './guia-integraciones.module.css';

/**
 * Guía de integraciones (M16e, DP-02): un modal con dos páginas que se eligen arriba,
 * «Conectar» y «Desconectar». Los textos describen lo que Praxa hace de verdad: la
 * sincronización es manual, desde la tarjeta, y desconectar no desinstala la app de
 * Tiendanube ni quita a Praxa de Meta.
 *
 * La guía se abre con su botón o con `abrirGuiaIntegraciones('desconectar')`, que usa la
 * tarjeta de Tiendanube. Se cierra con «Entendido», con la X o con Escape, y el foco vuelve
 * a quien la abrió.
 */

export type PaginaGuia = 'conectar' | 'desconectar';

export const EVENTO_GUIA = 'praxa:guia-integraciones';

export function abrirGuiaIntegraciones(pagina: PaginaGuia): void {
  window.dispatchEvent(new CustomEvent<PaginaGuia>(EVENTO_GUIA, { detail: pagina }));
}

type Paso = { icono: ReactNode; titulo: string; texto: ReactNode };

const ICONO = { size: 24, stroke: 1.8 };

export const PASOS_CONECTAR: readonly Paso[] = [
  {
    icono: <IconPlano {...ICONO} />,
    titulo: 'Elegí una integración',
    texto: 'En Integraciones, buscá la tarjeta de Meta Ads o de Tiendanube y pulsá Conectar. Siempre empezá desde Praxa: una instalación iniciada desde Tiendanube no se puede asociar a tu empresa.',
  },
  {
    icono: <IconPersona {...ICONO} />,
    titulo: 'Iniciá sesión y autorizá permisos',
    texto: 'Praxa te lleva a la plataforma para que inicies sesión. En Meta, elegí el portfolio y marcá la cuenta publicitaria; Praxa pide solo lectura de anuncios. En Tiendanube, aceptá los permisos de solo lectura de pedidos, clientes y productos.',
  },
  {
    icono: <IconCheck {...ICONO} />,
    titulo: 'Verificá la conexión',
    texto: 'De vuelta en Praxa, en Meta confirmá la cuenta publicitaria. En Tiendanube, Praxa confirma la tienda, su zona horaria y su moneda. La tarjeta queda en «Conectado».',
  },
  {
    icono: <IconBarras {...ICONO} />,
    titulo: 'Sincronizá los datos',
    texto: 'La sincronización es manual: los datos se actualizan cuando pulsás Sincronizar en la tarjeta, no se recolectan solos. La primera sincronización de Tiendanube lee todo el histórico y puede llevar varios pasos; seguí sincronizando hasta que diga que la tienda quedó sincronizada.',
  },
];

export const PASOS_DESCONECTAR: readonly Paso[] = [
  {
    icono: <IconPapelera {...ICONO} />,
    titulo: 'Qué borra Praxa al desconectar',
    texto: 'Praxa deja de leer y borra de la base activa la credencial y los datos de esa conexión. No se puede deshacer: para volver a usarla hay que conectar y sincronizar de nuevo. Desconectar una integración no toca la otra. Si el proyecto usa Supabase Pro, las copias nocturnas pueden conservar los datos hasta 7 días.',
  },
  {
    icono: <IconCandado {...ICONO} />,
    titulo: 'Desinstalá Praxa de tu tienda',
    texto: 'Desconectar no desinstala la app: el acceso sigue habilitado en Tiendanube hasta que la desinstales. Entrá al administrador de tu tienda, abrí la sección de aplicaciones, buscá Praxa y desinstalala. Cuando la desinstalás, Tiendanube avisa a Praxa y se borra lo que quede de la tienda.',
  },
  {
    icono: <IconAlerta {...ICONO} />,
    titulo: 'Quitá el acceso en Meta',
    texto: 'Desconectar no quita a Praxa de tu negocio en Meta. Para hacerlo, entrá a la configuración de tu negocio en Meta, a las integraciones o apps conectadas, y quitá a Praxa.',
  },
];

const PAGINAS: ReadonlyArray<{ id: PaginaGuia; titulo: string; pasos: readonly Paso[] }> = [
  { id: 'conectar', titulo: 'Conectar', pasos: PASOS_CONECTAR },
  { id: 'desconectar', titulo: 'Desconectar', pasos: PASOS_DESCONECTAR },
];

export function GuiaIntegraciones() {
  const [pagina, setPagina] = useState<PaginaGuia | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const origen = useRef<HTMLElement | null>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  const titulo = useId();

  const abrir = useCallback((destino: PaginaGuia) => {
    origen.current = document.activeElement instanceof HTMLElement ? document.activeElement : boton.current;
    setPagina(destino);
  }, []);

  const cerrar = useCallback(() => {
    setPagina(null);
    const destino = origen.current ?? boton.current;
    // Después de desmontar el modal.
    requestAnimationFrame(() => destino?.focus());
    destino?.focus();
  }, []);

  useEffect(() => {
    const onEvento = (event: Event) => {
      const detalle = (event as CustomEvent<PaginaGuia>).detail;
      abrir(detalle === 'desconectar' ? 'desconectar' : 'conectar');
    };
    window.addEventListener(EVENTO_GUIA, onEvento);
    return () => window.removeEventListener(EVENTO_GUIA, onEvento);
  }, [abrir]);

  const abierta = pagina !== null;
  useEffect(() => {
    if (!abierta) return;
    dialogo.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [abierta]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cerrar();
      return;
    }
    if (event.key !== 'Tab' || !dialogo.current) return;
    // El foco no sale del modal.
    const focusables = [...dialogo.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const actual = PAGINAS.find((p) => p.id === pagina);

  return (
    <>
      <Button ref={boton} variant="secondary" onClick={() => abrir('conectar')} aria-haspopup="dialog">
        <span>Ver guía de integraciones</span>
        <IconFlecha size={13} stroke={2.3} />
      </Button>
      {actual ? (
        <div className={g.fondo} onClick={(event) => { if (event.target === event.currentTarget) cerrar(); }}>
          <div ref={dialogo} className={g.modal} role="dialog" aria-modal="true" aria-labelledby={titulo}
            onKeyDown={onKeyDown}>
            <header className={g.cabecera}>
              <span className={g.iconoCabecera}><IconDocumento size={26} stroke={1.8} /></span>
              <div>
                <h2 id={titulo}>Guía de integraciones</h2>
                <p>Cómo conectar y desconectar tus herramientas de Praxa.</p>
              </div>
              <button type="button" className={g.cerrar} onClick={cerrar} aria-label="Cerrar">×</button>
            </header>
            <div className={g.pestanas} role="tablist" aria-label="Páginas de la guía">
              {PAGINAS.map((p) => (
                <button key={p.id} type="button" role="tab" aria-selected={p.id === actual.id}
                  className={p.id === actual.id ? `${g.pestana} ${g.activa}` : g.pestana}
                  onClick={() => setPagina(p.id)}>
                  {p.titulo}
                </button>
              ))}
            </div>
            <ol className={g.pasos} role="tabpanel" aria-label={actual.titulo}>
              {actual.pasos.map((paso, index) => (
                <li key={paso.titulo} className={g.paso}>
                  <span className={g.numero} aria-hidden="true">{index + 1}</span>
                  <span className={g.iconoPaso} aria-hidden="true">{paso.icono}</span>
                  <div>
                    <h3>{paso.titulo}</h3>
                    <p>{paso.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
            <footer className={g.pie}>
              <Button data-autofocus onClick={cerrar}>Entendido</Button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
