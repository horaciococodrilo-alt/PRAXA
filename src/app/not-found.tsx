import type { Metadata } from 'next';

import { AuthCard, AuthLink, AuthShell } from '@/components/auth/parts';
import s from '@/components/auth/auth.module.css';
import { LandingRoot } from '@/components/landing/theme';

export const metadata: Metadata = {
  title: 'Página no encontrada',
};

// Rutas inexistentes: mismo marco que las pantallas de acceso (logo, fondo liso, tarjeta).
export default function NotFound() {
  return (
    <LandingRoot>
      <AuthShell>
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
      </AuthShell>
    </LandingRoot>
  );
}
