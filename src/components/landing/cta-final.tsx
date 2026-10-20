import Link from 'next/link';

import { cn } from '@/components/ui';

import shared from './landing.module.css';
import s from './cta-final.module.css';

export function CtaFinal() {
  return (
    <section aria-labelledby="cta-t" className={s.section}>
      <div className={s.container}>
        <h2 id="cta-t" className={s.title}>
          Dejá de adivinar con cuál <span className={shared.soloEsc}>de los tres números</span>
          <span className={shared.soloMov}>número</span> quedarte
        </h2>
        <p className={cn(s.lead, shared.soloMov)}>
          Creá tu cuenta y empezá a ver tus números en un solo lugar.
        </p>
        <Link href="/signup" className={cn(s.button, shared.btn)}>
          Crear cuenta
        </Link>
      </div>
    </section>
  );
}
