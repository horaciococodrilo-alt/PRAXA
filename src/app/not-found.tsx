import type { Metadata } from 'next';
import Link from 'next/link';

import s from '@/components/auth/auth.module.css';
import { AuthCard, AuthLink } from '@/components/auth/parts';
import { ThemedImg } from '@/components/landing/img';
import { LandingRoot } from '@/components/landing/theme';

export const metadata: Metadata = {
  title: 'Página no encontrada',
};

// Rutas inexistentes: mismo marco que las pantallas de acceso (logo, fondo liso, tarjeta).
export default function NotFound() {
  return (
    <LandingRoot>
      <div className={s.shell}>
        <header className={s.header}>
          <Link href="/" aria-label="Praxa, ir al inicio">
            <ThemedImg
              light="logo-praxa-tinta.png"
              dark="logo-praxa-blanco.png"
              width={551}
              height={145}
              alt=""
              loading="eager"
            />
          </Link>
        </header>
        <main className={s.main}>
          <AuthCard
            narrow
            title="No encontramos esta página"
            subtitle="Puede que el enlace esté mal escrito o que la página ya no exista."
            footer={
              <div className={s.stack}>
                <AuthLink href="/">Ir al inicio</AuthLink>
                <AuthLink href="/login">Iniciá sesión</AuthLink>
              </div>
            }
          />
        </main>
      </div>
    </LandingRoot>
  );
}
