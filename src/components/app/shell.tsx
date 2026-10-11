'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';

import { cn } from '@/components/ui';
import { jetbrainsMono, manrope } from '@/components/landing/fonts';

import s from './app.module.css';
import {
  IconBarras,
  IconBase,
  IconChat,
  IconChevronDerecha,
  IconEnlace,
  IconEngranaje,
  IconInicio,
  IconMenu,
} from './icons';
import { TEMA_PRIMER_PINTADO, useTemaGuardado } from './tema';
import { Avatar, Img, StatusChip } from './ui';

type Pagina = 'inicio' | 'chat' | 'diagnostico' | 'uso' | 'integraciones' | 'configuracion' | 'perfil';

const PAGINAS: Record<string, Pagina> = {
  '/app': 'inicio',
  '/app/chat': 'chat',
  '/app/diagnostico': 'diagnostico',
  '/app/uso-y-costos': 'uso',
  '/app/integraciones': 'integraciones',
  '/app/configuracion': 'configuracion',
  '/app/perfil': 'perfil',
};


const NAV = [
  { href: '/app', label: 'Inicio', icon: <IconInicio /> },
  { href: '/app/chat', label: 'Chat', icon: <IconChat /> },
  { href: '/app/diagnostico', label: 'Diagnóstico', icon: <IconBarras /> },
  { href: '/app/uso-y-costos', label: 'Uso y costos', icon: <IconBase /> },
  { href: '/app/integraciones', label: 'Integraciones', icon: <IconEnlace /> },
] as const;

export function NavItem({
  href,
  icon,
  aviso,
  children,
}: {
  href: string;
  icon: ReactNode;
  /** Punto rojo sobre el ícono; el texto se anuncia como descripción del enlace. */
  aviso?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const avisoId = useId();
  const active = href === '/app' ? pathname === '/app' : pathname.startsWith(href);
  return (
    <>
      <Link
        href={href}
        className={s.nav}
        aria-current={active ? 'page' : undefined}
        aria-describedby={aviso ? avisoId : undefined}
      >
        <span className={s.navIcon}>
          {icon}
          {aviso ? <span className={s.alertDot} aria-hidden="true" /> : null}
        </span>
        <span>{children}</span>
      </Link>
      {/* Fuera del enlace: adentro se sumaría a su nombre accesible. */}
      {aviso ? (
        <span id={avisoId} className={s.srOnly}>
          {aviso}
        </span>
      ) : null}
    </>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <Link className={className} href="/app" aria-label="Praxa, inicio">
      <Img className={s.soloOscuro} src="/landing/logo-praxa-blanco.png" alt="" width={99} height={26} />
      <Img className={s.soloClaro} src="/landing/logo-praxa-tinta.png" alt="" width={99} height={26} />
    </Link>
  );
}

function AvatarPerfil({ foto, iniciales }: { foto: string | null; iniciales: string }) {
  return (
    <Link className={s.round} href="/app/perfil">
      {foto ? (
        <Img className={s.avatarFoto} src={foto} alt="" />
      ) : (
        <span aria-hidden="true">{iniciales}</span>
      )}
      <span className={s.srOnly}>Mi perfil</span>
    </Link>
  );
}

/**
 * Marco de la app: barra lateral (navegación, Configuración y fila de usuario) y barra
 * superior (chip de integración conectada + avatar). Sin campana de notificaciones: el
 * diseño la quitó a propósito.
 *
 * En móvil (< 768 px; el diseño no tiene esa versión) la barra lateral se vuelve un panel
 * que se abre con el botón ☰ de una barra superior fija con logo y avatar. Es la misma
 * navegación, no una copia. Con el panel abierto, el foco queda adentro; se cierra tocando
 * afuera, eligiendo una sección o con Esc.
 */
export function AppShell({
  nombre,
  iniciales,
  foto,
  conectada,
  configPendiente,
  children,
}: {
  /** Nombre corto para la fila de usuario. */
  nombre: string;
  iniciales: string;
  /** URL firmada de la foto de perfil; sin foto, se muestran las iniciales. */
  foto: string | null;
  /** Integración que muestra el chip "… conectado"; sin ninguna conectada, no hay chip. */
  conectada: string | null;
  /** Faltan datos de la empresa: Configuración lleva un punto rojo hasta completarlos. */
  configPendiente: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const pagina = PAGINAS[pathname] ?? 'inicio';
  const tema = useTemaGuardado();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuId = useId();
  const panel = useRef<HTMLElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  const cerrarMenu = (devolverFoco = true) => {
    setMenuAbierto(false);
    if (devolverFoco) boton.current?.focus();
  };

  useEffect(() => {
    if (!menuAbierto) return;
    const enfocables = () =>
      Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href], button') ?? []);
    enfocables()[0]?.focus();
    // Sin desplazar la página de atrás mientras el panel está abierto.
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';

    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenuAbierto(false);
        boton.current?.focus();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = enfocables();
      const primero = items[0];
      const ultimo = items[items.length - 1];
      if (!primero || !ultimo) return;
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', teclas);
    return () => {
      document.removeEventListener('keydown', teclas);
      html.style.overflow = overflow;
    };
  }, [menuAbierto]);

  // Elegir una sección cierra el panel (en escritorio no hace nada visible).
  const alNavegar = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a')) setMenuAbierto(false);
  };

  return (
    <div
      className={cn(s.root, manrope.variable, jetbrainsMono.variable)}
      data-theme={tema}
      data-pagina={pagina}
      // El script de primer pintado puede cambiar data-theme antes de hidratar.
      suppressHydrationWarning
    >
      <script
        // En el servidor se emite ejecutable; en el cliente React lo marca como texto
        // para no volver a ejecutarlo (mismo criterio que la landing).
        type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: TEMA_PRIMER_PINTADO }}
      />
      {/* Solo en móvil: ☰, logo y avatar. */}
      <header className={s.barraMovil}>
        <button
          ref={boton}
          type="button"
          className={s.menuBoton}
          aria-label="Abrir menú"
          aria-expanded={menuAbierto}
          aria-controls={menuId}
          onClick={() => setMenuAbierto(true)}
        >
          <IconMenu size={22} />
          {configPendiente ? <span className={s.alertDot} aria-hidden="true" /> : null}
        </button>
        <Logo className={s.logoMovil} />
        <AvatarPerfil foto={foto} iniciales={iniciales} />
      </header>
      {menuAbierto ? (
        <div className={s.fondoMenu} aria-hidden="true" onClick={() => cerrarMenu()} />
      ) : null}

      <nav
        ref={panel}
        id={menuId}
        className={s.side}
        aria-label="Navegación principal"
        data-abierto={menuAbierto}
        onClick={alNavegar}
      >
        <Logo className={s.logo} />
        <div className={s.navlist}>
          {NAV.map((item) => (
            <NavItem key={item.href} href={item.href} icon={item.icon}>
              {item.label}
            </NavItem>
          ))}
        </div>
        <div className={s.foot}>
          <NavItem
            href="/app/configuracion"
            icon={<IconEngranaje />}
            aviso={configPendiente ? 'Faltan datos de la empresa' : undefined}
          >
            Configuración
          </NavItem>
          {/* Sin aria-label: el nombre accesible empieza con el texto visible (WCAG 2.5.3). */}
          <Link className={s.user} href="/app/perfil">
            <Avatar foto={foto}>{iniciales}</Avatar>
            <span>
              {nombre}
              <span className={s.srOnly}>, mi perfil</span>
            </span>
            <IconChevronDerecha size={14} />
          </Link>
          <form action="/auth/signout" method="post">
            <button className={cn(s.nav, s.signout)} type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      </nav>

      <main className={s.main}>
        {/* En todas las pantallas (el diseño la omitía en Integraciones y Configuración). */}
        <header className={s.top}>
          {conectada ? <StatusChip>{conectada} conectado</StatusChip> : null}
          <AvatarPerfil foto={foto} iniciales={iniciales} />
        </header>
        {children}
      </main>
    </div>
  );
}
