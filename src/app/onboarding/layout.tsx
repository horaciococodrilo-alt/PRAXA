import Link from 'next/link';

import { Button } from '@/components/ui';

// Depende de la sesión y del borrador persistido del usuario.
export const dynamic = 'force-dynamic';

export default function OnboardingLayout({ children }: LayoutProps<'/onboarding'>) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            PRAXA
          </Link>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
