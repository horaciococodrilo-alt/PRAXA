import { cn } from '@/components/ui';

import { ThemedImg } from './img';
import shared from './landing.module.css';
import s from './footer.module.css';

// Las páginas de producto, seguridad y legales todavía no existen: solo queda Contacto.
export function Footer() {
  return (
    <footer className={s.footer}>
      <div className={s.container}>
        <div className={s.top}>
          <div className={s.brand}>
            <span className={s.logo}>
              <ThemedImg light="logo-praxa-tinta.png" dark="logo-praxa-blanco.png" width={551} height={145} alt="Praxa" />
            </span>
            <p className={cn(s.about, shared.soloEsc)}>
              Meta Ads, Google Analytics 4 y Tiendanube en un solo lugar, con cifras que se pueden rastrear. Buenos
              Aires, Argentina.
            </p>
          </div>
        </div>
        <nav aria-label="Pie de página" className={cn(s.links, shared.soloMov)}>
          <a href="mailto:hola@praxa.com.ar">Contacto</a>
        </nav>
        <p className={s.legal}>
          <span className={shared.soloEsc}>© 2026 Praxa. Todos los datos que se muestran en esta página son de ejemplo.</span>
          <span className={shared.soloMov}>© 2026 Praxa. Datos de ejemplo.</span>
        </p>
      </div>
    </footer>
  );
}
