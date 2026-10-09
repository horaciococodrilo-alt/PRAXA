import Link from 'next/link';
import { useId, type ComponentProps, type ReactNode } from 'react';

import { cn } from '@/components/ui';

import s from './auth.module.css';
import { ArrowRightIcon, BrainIcon, LockIcon, ShieldCheckIcon, ZapIcon } from './icons';

/** Formulario a la derecha y panel de presentación a la izquierda (oculto en móvil). */
export function AuthSplit({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className={s.split}>
      {/* El formulario va primero en el DOM: es lo que importa leer. El CSS lo pone a la derecha. */}
      <div className={s.splitForm}>{children}</div>
      <aside className={s.splitAside}>{aside}</aside>
    </div>
  );
}

/** Tarjeta de las pantallas de acceso. El título es el único <h1> de la página. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  narrow = false,
}: {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  narrow?: boolean;
}) {
  return (
    <section className={cn(s.card, narrow && s.cardNarrow)}>
      <h1 className={s.title}>{title}</h1>
      {subtitle ? <p className={s.subtitle}>{subtitle}</p> : null}
      {children ? <div className={s.cardBody}>{children}</div> : null}
      {footer ? <div className={s.cardFooter}>{footer}</div> : null}
    </section>
  );
}

export function AuthForm(props: ComponentProps<'form'>) {
  return <form className={s.form} {...props} />;
}

type FieldProps = { id: string; 'aria-describedby'?: string };

/**
 * Etiqueta + control + ayuda. La etiqueta no envuelve el control: si lo hiciera, el botón
 * "Mostrar" y la ayuda pasarían a formar parte del nombre accesible del campo.
 */
export function AuthField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (field: FieldProps) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-ayuda`;
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>
        {label}
      </label>
      {children({ id, 'aria-describedby': hint ? hintId : undefined })}
      {hint ? (
        <span id={hintId} className={s.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function TextInput({ icon, ...props }: Omit<ComponentProps<'input'>, 'className'> & { icon?: ReactNode }) {
  return (
    <span className={cn(s.control, icon ? s.conIcono : undefined)}>
      {icon ? <span className={s.icono}>{icon}</span> : null}
      <input className={s.input} {...props} />
    </span>
  );
}

export function SubmitButton({ pending, pendingLabel, children }: { pending: boolean; pendingLabel: string; children: string }) {
  return (
    <button type="submit" className={s.submit} disabled={pending}>
      <span>{pending ? pendingLabel : children}</span>
      <ArrowRightIcon />
    </button>
  );
}

/** Aviso: los errores se anuncian enseguida (alert), lo informativo espera (status). */
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'danger'; children: ReactNode }) {
  return (
    <div className={cn(s.notice, tone === 'danger' ? s.noticeDanger : s.noticeInfo)} role={tone === 'danger' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={s.link}>
      {children}
    </Link>
  );
}

/** Texto de pie: "¿No tenés una cuenta? Creá tu cuenta". */
export function AltAction({ text, href, action }: { text: string; href: string; action: string }) {
  return (
    <p className={s.alt}>
      {text} <AuthLink href={href}>{action}</AuthLink>
    </p>
  );
}

const VIRTUDES = [
  { icon: <ShieldCheckIcon />, title: 'Confiable', text: 'Cada dato tiene evidencia y puede rastrearse a su origen.' },
  { icon: <BrainIcon />, title: 'Inteligente', text: 'Detectamos patrones y conflictos que otros no ven.' },
  { icon: <ZapIcon />, title: 'Ágil', text: 'Menos búsqueda, más claridad para actuar más rápido.' },
  { icon: <LockIcon size={22} />, title: 'Seguro', text: 'Protegemos tu información con los más altos estándares.' },
];

export function LoginAside() {
  return (
    <div className={s.aside}>
      <p className={s.headline}>
        Tu información.
        <br />
        Tus mejores <span className={s.acento}>decisiones.</span>
      </p>
      <p className={s.lead}>
        Praxa unifica los datos de tu empresa, los organiza y los convierte en conocimiento confiable.
      </p>
      <ul className={s.virtudes}>
        {VIRTUDES.map((v) => (
          <li key={v.title}>
            <span className={s.virtudIcono}>{v.icon}</span>
            <span>
              <span className={s.virtudTitulo}>{v.title}</span>
              <span className={s.virtudTexto}>{v.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PASOS = [
  { title: 'Conectá tus sistemas', text: 'Todo en un mismo lugar.' },
  { title: 'Organizá tu información', text: 'Datos claros y trazables.' },
  { title: 'Decidí con evidencia', text: 'Cada decisión con respaldo.' },
];

export function SignupAside() {
  return (
    <div className={cn(s.aside, s.asideCard)}>
      <p className={s.headline}>
        Unificá tus datos.
        <br />
        <span className={s.acento}>Tomá mejores decisiones.</span>
      </p>
      <p className={s.lead}>
        Creá tu cuenta y empezá a transformar la información de tu empresa en conocimiento confiable.
      </p>
      <ol className={s.pasos}>
        {PASOS.map((p, i) => (
          <li key={p.title}>
            <span className={s.pasoNum} aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span>
              <span className={s.pasoTitulo}>{p.title}</span>
              <span className={s.pasoTexto}>{p.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
