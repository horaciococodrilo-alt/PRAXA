/* eslint-disable @next/next/no-img-element --
 * La landing reproduce una referencia aprobada píxel a píxel: cada imagen ya viene
 * exportada al tamaño justo y varias son SVG. next/image no aporta optimización acá y
 * cambiaría el marcado, así que todas las imágenes de la landing pasan por este archivo.
 */
import type { ComponentProps } from 'react';

import { cn } from '@/components/ui';

import shared from './landing.module.css';

const BASE = '/landing/';

type ImgProps = Omit<ComponentProps<'img'>, 'src'> & { src: string; alt: string };

/** Imagen de `public/landing/`. */
export function Img({ src, alt, ...props }: ImgProps) {
  return <img src={BASE + src} alt={alt} {...props} />;
}

/**
 * Imagen con una versión para cada tema. Se renderizan las dos y el CSS muestra la que
 * corresponde a `data-theme`. Con carga diferida, el navegador no descarga la oculta.
 */
export function ThemedImg({
  light,
  dark,
  className,
  loading = 'lazy',
  ...props
}: Omit<ImgProps, 'src'> & { light: string; dark: string }) {
  return (
    <>
      <Img src={light} className={cn(className, shared.soloClaro)} loading={loading} {...props} />
      <Img src={dark} className={cn(className, shared.soloOscuro)} loading={loading} {...props} />
    </>
  );
}
