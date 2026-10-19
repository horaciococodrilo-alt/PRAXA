/* eslint-disable @next/next/no-img-element --
 * Los logos de la app son PNG chicos ya exportados al tamaño del diseño; next/image no
 * aporta optimización y cambiaría el marcado. Todas las imágenes pasan por `Img`.
 */
import Link from 'next/link';
import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/components/ui';

import s from './app.module.css';
import { IconBajar, IconChevronAbajo, IconPlano, IconSubir } from './icons';
import { variacion } from './format';

/** Imagen de `public/`. */
export function Img({ alt, ...props }: ComponentProps<'img'> & { src: string; alt: string }) {
  return <img alt={alt} {...props} />;
}

type Variant = 'primary' | 'secondary' | 'small' | 'danger';

/** `danger` es el botón chico con los colores de peligro, para acciones que borran datos. */
const VARIANT: Record<Variant, string> = {
  primary: s.primary,
  secondary: s.secondary,
  small: s.small,
  danger: cn(s.small, s.danger),
};

function buttonClassName(variant: Variant, className?: string) {
  return cn(s.btn, VARIANT[variant], className);
}

/**
 * Botón del sistema. `disabled` aplica el estilo deshabilitado del diseño (borde suave,
 * texto apagado, `cursor: not-allowed`) sobre cualquier variante.
 */
export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return <button type={type} className={buttonClassName(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClassName(variant, className)} {...props} />;
}

/**
 * Resumen de un `<details>` con aspecto de botón del sistema. El `<summary>` solo envuelve
 * (bloque, sin marcador nativo) y el aspecto lo lleva un `<span>` interno en flex, así que
 * sirve con cualquier variante y no depende de que el navegador acepte un `<summary>` flex.
 * Mientras el detalle está abierto, el chevrón apunta hacia arriba.
 */
export function DisclosureButton({
  variant = 'small',
  className,
  children,
}: {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <summary className={s.disclosure}>
      <span className={buttonClassName(variant, className)}>
        <span>{children}</span>
        <IconChevronAbajo size={13} className={s.disclosureIcon} />
      </span>
    </summary>
  );
}

export function Card({
  className,
  as: As = 'section',
  ...props
}: HTMLAttributes<HTMLElement> & { as?: 'section' | 'article' | 'div' }) {
  return <As className={cn(s.card, className)} {...props} />;
}

/** Campo de texto con su `<label>` real. */
export function Field({
  label,
  id,
  className,
  ...props
}: ComponentProps<'input'> & { label: ReactNode; id: string }) {
  return (
    <div className={className}>
      <label className={s.label} htmlFor={id}>
        {label}
      </label>
      <input id={id} className={s.input} {...props} />
    </div>
  );
}

/** Input sin etiqueta visible propia (la etiqueta la pone quien lo usa, con `aria-labelledby`). */
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(s.input, className)} {...props} />;
}

/** `CONECTADO` con relleno menta; `NO CONECTADO` solo con contorno. */
export function Badge({ on, className, children }: { on: boolean; className?: string; children: ReactNode }) {
  return <span className={cn(s.badge, !on && s.badgeOff, className)}>{children}</span>;
}

/** Chip de estado de la barra superior: punto + texto. */
export function StatusChip({ children }: { children: ReactNode }) {
  return (
    <span className={s.chip}>
      <span className={s.dot} aria-hidden="true" />
      {children}
    </span>
  );
}

/** Avatar: la foto de perfil si hay, o las iniciales. Decorativo (el nombre está al lado). */
export function Avatar({
  className,
  foto,
  children,
}: {
  className?: string;
  foto?: string | null;
  children: ReactNode;
}) {
  return (
    <span className={cn(s.avatar, className)} aria-hidden="true">
      {foto ? <Img className={s.avatarFoto} src={foto} alt="" /> : children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  className,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(s.head, className)}>
      <h1 className={s.h1}>{title}</h1>
      <p className={s.sub}>{subtitle}</p>
    </div>
  );
}

export function TileIcon({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn(s.tileIcon, className)}>{children}</span>;
}

/**
 * Tarjeta de KPI: ícono, etiqueta, valor en JetBrains Mono y, abajo, la variación contra
 * el mes anterior o un texto de ayuda.
 */
export function KpiCard({
  icon,
  label,
  value,
  change,
  caption,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  change?: number;
  caption?: ReactNode;
}) {
  const Flecha = change === undefined || change === 0 ? IconPlano : change > 0 ? IconSubir : IconBajar;
  return (
    <Card as="article" className={s.kpi}>
      <TileIcon>{icon}</TileIcon>
      <div className={s.kpiBody}>
        <div className={s.kpiLabel}>{label}</div>
        <div className={s.kpiValue}>{value}</div>
        {change !== undefined ? (
          <div className={s.kpiDelta}>
            <span className={cn(s.kpiChange, change === 0 && s.kpiFlat)}>
              <Flecha size={12} stroke={change === 0 ? 2.4 : 2.2} />
              {variacion(change)}
            </span>
            <span className={s.kpiVs}>vs. mes anterior</span>
          </div>
        ) : null}
        {caption ? <div className={s.kpiCaption}>{caption}</div> : null}
      </div>
    </Card>
  );
}
