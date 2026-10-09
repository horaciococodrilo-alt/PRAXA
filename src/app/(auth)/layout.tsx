import Link from 'next/link';

import s from '@/components/auth/auth.module.css';
import { ThemedImg } from '@/components/landing/img';
import { LandingRoot } from '@/components/landing/theme';

// Las pantallas de acceso comparten la raíz de la landing: tokens, tipografías y tema.
export default function AuthLayout({ children }: LayoutProps<'/'>) {
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
        <main className={s.main}>{children}</main>
      </div>
    </LandingRoot>
  );
}
