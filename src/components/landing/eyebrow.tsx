import { cn } from '@/components/ui';

import shared from './landing.module.css';

/** Antetítulo numerado; en la referencia solo aparece en móvil. */
export function Eyebrow({ n, children, className }: { n: number; children: string; className?: string }) {
  return (
    <span className={cn(shared.eyebrow, className)}>
      <span aria-hidden="true" className={shared.eyebrowNum}>
        {n}
      </span>
      <span className={shared.eyebrowLabel}>{children}</span>
    </span>
  );
}
