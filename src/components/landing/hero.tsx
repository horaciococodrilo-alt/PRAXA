import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/components/ui';

import { Img, ThemedImg } from './img';
import shared from './landing.module.css';
import s from './hero.module.css';

const SOURCES = [
  { logo: 'logo-meta-ads.png', w: 527, h: 356, alt: 'Icono de Meta Ads', label: 'Meta Ads', delay: shared.d2 },
  { logo: 'logo-ga4.png', w: 398, h: 438, alt: 'Icono de Google Analytics 4', label: 'Analytics 4', delay: shared.d3 },
  { logo: 'logo-tiendanube.png', logoDark: 'logo-tiendanube-claro.png', w: 448, h: 324, alt: 'Icono de Tiendanube', label: 'Tiendanube', delay: shared.d4 },
];

// Curvas de las fuentes al resultado: escritorio (horizontal) y móvil (vertical).
const DESK_PATHS = [
  'M0 36 C 46 36, 46 142, 86 142',
  'M0 106 C 46 106, 46 142, 86 142',
  'M0 176 C 46 176, 46 142, 86 142',
  'M0 246 C 46 246, 46 142, 86 142',
];
const DESK_FLOW_DELAYS = [shared.d4, shared.d5, shared.d6, shared.d7];
const MOB_PATHS = ['M34 0 C 34 26, 100 16, 100 34', 'M100 0 V 34', 'M166 0 C 166 26, 100 16, 100 34'];
const CABLE_DELAYS = [undefined, shared.cable2, shared.cable3, shared.cable4];

function CableGradient({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7DFFED" />
        <stop offset="45%" stopColor="#19C9AE" />
        <stop offset="100%" stopColor="#04564A" />
      </linearGradient>
    </defs>
  );
}

function Cables({ paths, gradient }: { paths: string[]; gradient: string }) {
  return paths.map((d, i) => (
    <path
      key={d}
      className={cn(shared.cable, CABLE_DELAYS[i])}
      d={d}
      pathLength={100}
      stroke={`url(#${gradient})`}
      strokeWidth="4"
      strokeLinecap="round"
      fill="none"
    />
  ));
}

function Dato({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn(s.dato, className)}>
      <dt>{label}</dt>
      {children}
    </div>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-t" className={s.hero}>
      <picture>
        <source media="(min-width: 768px)" srcSet="/landing/hero-campo-ancho.svg" />
        <Img src="hero-campo-angosto.svg" alt="" className={s.campo} />
      </picture>

      <div className={s.inner}>
        <h1 id="hero-t" className={cn(s.title, shared.rise, s.titleDelay)}>
          Todo tu negocio en<span className={shared.soloEsc}>&nbsp;</span>
          <span className={shared.soloMov}>{' '}</span>
          <br className={shared.soloEsc} />
          <i className={s.lugar}>
            <b className={shared.mark}>un solo lugar</b>
          </i>
        </h1>

        <p className={cn(s.lead, shared.rise, shared.d2)}>
          Meta dice una cosa, Tiendanube otra. Preguntá cuál es la verdadera.
        </p>

        <div className={cn(s.flow, shared.rise, shared.d3)}>
          <div className={s.sources}>
            <span className={cn(s.sourcesLabel, shared.soloEsc)}>Tus fuentes</span>
            {SOURCES.map((src) => (
              <div key={src.label} className={cn(s.source, shared.left, src.delay)}>
                {src.logoDark ? (
                  <ThemedImg light={src.logo} dark={src.logoDark} width={src.w} height={src.h} alt={src.alt} loading="eager" />
                ) : (
                  <Img src={src.logo} width={src.w} height={src.h} alt={src.alt} />
                )}
                <span>{src.label}</span>
              </div>
            ))}
            <div className={cn(s.source, s.sourceMore, shared.left, shared.d5, shared.soloEsc)}>
              <ThemedImg light="fuente-mas.svg" dark="fuente-mas-osc.svg" alt="Icono de mas integraciones" loading="eager" />
              <span>Y más</span>
            </div>
          </div>

          <div className={cn(s.conector, shared.soloEsc)}>
            <svg width="92" height="266" viewBox="0 0 92 266" fill="none" aria-hidden="true">
              <CableGradient id="lp-cable-esc" />
              {DESK_PATHS.map((d, i) => (
                <path
                  key={d}
                  className={cn(s.linea, shared.flow, DESK_FLOW_DELAYS[i])}
                  d={d}
                  strokeOpacity={i === 3 ? 0.35 : 0.9}
                  strokeWidth="2"
                  strokeDasharray={i === 3 ? '6 6' : undefined}
                />
              ))}
              <Cables paths={DESK_PATHS} gradient="lp-cable-esc" />
            </svg>
          </div>

          <div className={cn(s.conectorMov, shared.soloMov)}>
            <svg width="200" height="42" viewBox="0 0 200 42" fill="none" aria-hidden="true">
              <CableGradient id="lp-cable-mov" />
              {MOB_PATHS.map((d) => (
                <path key={d} className={s.linea} d={d} strokeOpacity="0.9" strokeWidth="2" />
              ))}
              <Cables paths={MOB_PATHS} gradient="lp-cable-mov" />
            </svg>
          </div>

          <div className={cn(s.result, shared.pop, shared.d7)}>
            <div className={s.resultHead}>
              <ThemedImg
                light="logo-praxa-tinta.png"
                dark="logo-praxa-blanco.png"
                width={551}
                height={145}
                alt="Praxa"
                loading="eager"
              />
              <span>Resultado</span>
            </div>
            <p className={s.resultText}>
              Gastaste <strong className={shared.mark}>$ 1.428.900</strong> y Tiendanube cobró{' '}
              <strong className={shared.mark}>$ 4.182.600</strong> en 41 pedidos.
            </p>
            <dl className={s.datos}>
              <Dato label="Período">
                <dd className={s.mono}>29 sep – 5 oct</dd>
              </Dato>
              <Dato label="Zona" className={shared.soloEsc}>
                <dd className={s.mono}>AR/Buenos_Aires</dd>
              </Dato>
              <Dato label="Cobertura">
                <dd className={s.cobertura}>
                  <span aria-hidden="true" className={s.cuadro} />
                  <span>
                    7 de 7<span className={shared.soloEsc}> días</span>
                  </span>
                </dd>
              </Dato>
              <Dato label="Frescura" className={shared.soloEsc}>
                <dd className={s.mono}>6 oct, 14:20</dd>
              </Dato>
            </dl>
          </div>
        </div>

        <div className={cn(s.actions, shared.rise, s.actionsDelay)}>
          <Link href="/signup" className={cn(s.primary, shared.btn)}>
            Crear cuenta
          </Link>
          <Link href="/login" className={cn(s.secondary, shared.ghost)}>
            Iniciar sesión
          </Link>
        </div>
      </div>
    </section>
  );
}
