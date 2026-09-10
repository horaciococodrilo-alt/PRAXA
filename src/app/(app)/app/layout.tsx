import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppNav } from '@/components/app-nav';
import { ConfigurationMissing } from '@/components/configuration-missing';
import { Button } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/env';
import { getCurrentCompany } from '@/modules/company/service';
import { requireUser } from '@/modules/identity/session';

// Todo lo que cuelga de /app depende de la sesión y de la empresa del usuario.
// Nunca debe prerenderizarse ni cachearse de forma compartida.
export const dynamic = 'force-dynamic';

/**
 * Shell de la aplicación protegida.
 *
 * Vuelve a verificar la identidad con `getClaims()` aunque el proxy ya haya redirigido:
 * el proxy es conveniencia, no autorización.
 */
export default async function AppLayout({ children }: LayoutProps<'/app'>) {
  // Sin configuración no hay sesión que verificar. Se dice qué falta en vez de estallar
  // con un error de servidor opaco.
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-20">
        <ConfigurationMissing />
      </main>
    );
  }

  const user = await requireUser('/app');
  const company = await getCurrentCompany();

  // Sin empresa todavía no hay aplicación que mostrar: el onboarding la crea.
  if (!company) redirect('/onboarding');

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-baseline gap-3">
            <Link href="/app" className="text-lg font-semibold tracking-tight">
              PRAXA
            </Link>
            <span className="text-sm text-muted">{company.name}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{user.email}</span>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6">
          <AppNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
