import type { IntegracionId } from '@/modules/app-data/types';

import s from './app.module.css';
import { LogoGoogleAnalytics } from './icons';
import { Img } from './ui';

/** Logo de cada integración. Tiendanube tiene una versión para cada tema, como en la landing. */
export function IntegracionLogo({ id, size }: { id: IntegracionId; size: number }) {
  if (id === 'meta_ads') return <Img src="/landing/logo-meta-ads.png" alt="" width={size} height={size} />;
  if (id === 'tiendanube') {
    return (
      <>
        <Img className={s.soloOscuro} src="/landing/logo-tiendanube-claro.png" alt="" width={size} height={size} />
        <Img className={s.soloClaro} src="/landing/logo-tiendanube.png" alt="" width={size} height={size} />
      </>
    );
  }
  // Tamaños del diseño: 18 en Inicio (caja de 32) y 26 en Integraciones (caja de 46).
  return <LogoGoogleAnalytics size={size === 20 ? 18 : size === 30 ? 26 : size} />;
}
