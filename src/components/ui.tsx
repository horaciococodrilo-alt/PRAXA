import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

export function cn(...values: (string | false | null | undefined)[]) {
  return values.filter(Boolean).join(' ');
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60';

const buttonVariants = {
  primary: 'bg-accent text-white hover:bg-accent-strong',
  secondary: 'border border-border bg-surface text-foreground hover:bg-surface-muted',
  ghost: 'text-accent hover:bg-accent-soft',
  danger: 'border border-border bg-surface text-danger hover:bg-danger-soft',
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

export function Button({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant }) {
  return <button className={cn(buttonBase, buttonVariants[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={cn(buttonBase, buttonVariants[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-xl border border-border bg-surface p-6 shadow-sm', className)}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  required,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
        {!required ? <span className="ml-1 text-xs font-normal text-muted">(opcional)</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null}
      {error ? (
        <span role="alert" className="mt-1.5 block text-xs text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(inputClass, 'min-h-24 resize-y', className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(inputClass, className)} {...props} />;
}

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger';
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    info: 'border-border bg-surface-muted text-foreground',
    warning: 'border-warning-border bg-warning-soft text-warning-text',
    danger: 'border-border bg-danger-soft text-danger',
  } as const;

  return (
    <div className={cn('rounded-lg border px-4 py-3 text-sm', tones[tone])} role="status">
      {title ? <p className="mb-1 font-medium">{title}</p> : null}
      <div className="[&_p+p]:mt-2">{children}</div>
    </div>
  );
}

/**
 * Estado vacío honesto.
 *
 * `reason` explica por qué no hay nada que mostrar. Nunca se rellena una pantalla con
 * datos de ejemplo ni se sugiere que una capacidad está disponible cuando no lo está.
 */
export function EmptyState({
  title,
  reason,
  children,
}: {
  title: string;
  reason: string;
  children?: ReactNode;
}) {
  return (
    <Card className="border-dashed text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-prose text-sm text-muted">{reason}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </Card>
  );
}

export function StatusPill({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'active' | 'draft';
  children: ReactNode;
}) {
  const tones = {
    neutral: 'border-border bg-surface-muted text-muted',
    active: 'border-transparent bg-accent-soft text-accent',
    draft: 'border-warning-border bg-warning-soft text-warning-text',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
