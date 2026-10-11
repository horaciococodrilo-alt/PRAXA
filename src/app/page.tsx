import type { Metadata } from 'next';

import { Anuncios } from '@/components/landing/anuncios';
import { Chat } from '@/components/landing/chat';
import { CtaFinal } from '@/components/landing/cta-final';
import { Diagnostico } from '@/components/landing/diagnostico';
import { Footer } from '@/components/landing/footer';
import { Hero } from '@/components/landing/hero';
import shared from '@/components/landing/landing.module.css';
import { Herramientas } from '@/components/landing/herramientas';
import { Nav } from '@/components/landing/nav';
import { Seguridad } from '@/components/landing/seguridad';
import { LandingRoot } from '@/components/landing/theme';
import { TresPasos } from '@/components/landing/tres-pasos';

export const metadata: Metadata = {
  title: { absolute: 'PRAXA — Tu negocio en un solo lugar' },
  description:
    'PRAXA conecta Meta Ads, Google Analytics 4, Tiendanube y más para diagnosticar tu negocio y decirte qué hacer.',
};

export default function LandingPage() {
  return (
    <LandingRoot>
      <Nav />
      <main className={shared.main}>
        <Hero />
        <Anuncios />
        <Herramientas />
        <Chat />
        <Diagnostico />
        <TresPasos />
        <Seguridad />
        <CtaFinal />
      </main>
      <Footer />
    </LandingRoot>
  );
}
