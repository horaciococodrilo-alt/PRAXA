'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/components/ui';

const LINKS = [
  { href: '/app', label: 'Inicio' },
  { href: '/app/contexto', label: 'Objetivos y contexto' },
  { href: '/app/integraciones', label: 'Integraciones' },
  { href: '/app/reportes', label: 'Reportes' },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones" className="-mb-px flex gap-1 overflow-x-auto">
      {LINKS.map((link) => {
        const active = link.href === '/app' ? pathname === '/app' : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors',
              active
                ? 'border-accent font-medium text-accent'
                : 'border-transparent text-muted hover:text-foreground',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
