import { cn } from '@/components/ui';

import { Img, ThemedImg } from './img';
import shared from './landing.module.css';
import s from './herramientas.module.css';

const ACTIVAS = [
  { logo: 'logo-meta-ads.png', w: 527, h: 356, name: 'Meta Ads' },
  { logo: 'logo-ga4.png', w: 398, h: 438, name: 'Google Analytics 4' },
  { logo: 'logo-tiendanube.png', dark: 'logo-tiendanube-claro.png', w: 448, h: 324, name: 'Tiendanube' },
];

// Integraciones "Próximamente": en gris a propósito. Ancho de cada logo según la referencia.
const PROXIMAS = [
  { logo: 'logo-mercado-libre-gris', w: 357, h: 249, name: 'Mercado Libre', alt: 'Mercado Libre', size: s.logoCuadrado },
  { logo: 'logo-woocommerce-gris', w: 291, h: 172, name: 'WooCommerce', alt: 'WooCommerce', size: s.logoMedio },
  { logo: 'logo-tango-gris', w: 241, h: 138, name: 'Tango Gestión', alt: 'Tango Gestion', size: s.logoAncho },
  { logo: 'logo-odoo-gris', w: 620, h: 199, name: 'Odoo', alt: 'Odoo', size: s.logoMedio },
  { logo: 'logo-shopify-gris', w: 154, h: 176, name: 'Shopify', alt: 'Shopify', size: s.logoMedio },
];

function Grupo({ duplicado = false }: { duplicado?: boolean }) {
  return (
    <div className={s.grupo} aria-hidden={duplicado || undefined}>
      {ACTIVAS.map((t) => (
        <span key={t.name} className={s.activa}>
          {t.dark ? (
            <ThemedImg light={t.logo} dark={t.dark} width={t.w} height={t.h} alt={`Logo de ${t.name}`} />
          ) : (
            <Img src={t.logo} width={t.w} height={t.h} alt={`Logo de ${t.name}`} />
          )}
          <span>{t.name}</span>
        </span>
      ))}
      <span aria-hidden="true" className={cn(s.separador, shared.soloEsc)} />
      <div className={s.proximas}>
        <div className={s.proximasLista}>
          {PROXIMAS.map((t) => (
            <span key={t.name} className={s.proxima}>
              <ThemedImg
                light={`${t.logo}.png`}
                dark={`${t.logo}-osc.png`}
                width={t.w}
                height={t.h}
                alt={`Logo de ${t.alt}`}
                className={t.size}
              />
              <span>{t.name}</span>
            </span>
          ))}
        </div>
        <span className={s.etiqueta}>
          <span aria-hidden="true" />
          Próximamente
          <span aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

/** Franja de herramientas: carrusel infinito (el grupo se repite para el bucle). */
export function Herramientas() {
  return (
    <section aria-label="Herramientas conectadas" className={s.section}>
      <p className={cn(s.aviso, shared.soloMov)}>Meta Ads ya está disponible. Las demás llegan en este orden.</p>
      <div className={s.mascara}>
        <div className={s.marquee}>
          <Grupo />
          <Grupo duplicado />
        </div>
      </div>
    </section>
  );
}
