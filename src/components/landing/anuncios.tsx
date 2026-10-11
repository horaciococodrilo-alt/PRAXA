import { cn } from '@/components/ui';

import { Eyebrow } from './eyebrow';
import { Img } from './img';
import shared from './landing.module.css';
import s from './anuncios.module.css';

function Flecha({ size, down = false }: { size: number; down?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {down ? (
        <>
          <path d="M12 5v14" />
          <path d="m5 12 7 7 7-7" />
        </>
      ) : (
        <>
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </>
      )}
    </svg>
  );
}

const METRICAS = [
  { label: 'Gasto', value: '$ 180.000', delta: '16%', tone: s.warn },
  { label: 'Ventas en Tiendanube', value: '$ 96.200', delta: '38%', tone: s.danger, down: true },
  { label: 'Costo por cliente nuevo', value: '$ 22.500', delta: '31%', tone: s.warn },
];

const BENEFICIOS_ESC = [
  ['Creativos que venden', 'Medidos con ventas reales, con aviso de fatiga'],
  ['Clientes nuevos aparte', 'Su costo, separado del de las recompras'],
  ['Avisos sin stock', 'Detectados cruzando campañas con tu catálogo'],
  ['Cuándo vendés y cuándo gastás', 'Las dos curvas sobre el mismo eje de horas'],
];

const BENEFICIOS_MOV = [
  ['Creativos que venden', 'Medidos con ventas reales, con aviso de fatiga'],
  ['Costo de cliente nuevo', 'Separado de lo que gastás en recompras'],
  ['Cuándo vendés contra cuándo gastás', 'Las dos curvas sobre el mismo eje de horas'],
];

const CAMPANAS = [
  { name: 'Remeras verano', value: '+ $ 186.400' },
  { name: 'Buzos invierno', value: '− $ 141.900', alerta: 'Sin stock en M y L hace 4 días' },
  { name: 'Retargeting carrito', value: '+ $ 298.100' },
];

/** "Sabé qué anuncios te dejan plata". Escritorio y móvil muestran piezas distintas. */
export function Anuncios() {
  return (
    <section aria-labelledby="p2-t" className={s.section}>
      <div className={s.container}>
        <div className={s.header}>
          <Eyebrow n={2} className={shared.soloMov}>
            Publicidad que rinde
          </Eyebrow>
          <h2 id="p2-t" className={s.title}>
            Sabé qué anuncios te dejan plata, no solo clics
          </h2>
          <p className={cn(s.lead, shared.soloEsc)}>
            El panel de Meta te muestra retorno sobre la venta que él mismo se atribuye. PRAXA lo
            recalcula contra lo que cobró Tiendanube y le descuenta margen, comisiones, cuotas y envío.
          </p>
          <p className={cn(s.lead, shared.soloMov)}>
            PRAXA recalcula el retorno contra lo que cobró Tiendanube y le descuenta margen, comisiones,
            cuotas y envío.
          </p>
        </div>

        {/* Escritorio: el anuncio con tres tarjetas flotando alrededor. */}
        <div className={cn(s.stage, shared.soloEsc)}>
          <div className={s.ad}>
            <div className={s.adImage}>
              <Img src="anuncio-buzo.webp" width={600} height={800} alt="Buzo gris" loading="lazy" decoding="async" />
            </div>
            <div className={s.adBar}>
              <span className={s.adName}>Buzo gris</span>
              <span className={s.adCta}>Comprar</span>
            </div>
          </div>

          <div className={cn(s.float, s.floatRenta, shared.card)}>
            <span className={s.kicker}>Rentabilidad real · Remeras verano</span>
            <div className={s.rentaRow}>
              <span className={s.rentaValue}>+ $ 186.400</span>
              <span className={s.rentaDelta}>
                <Flecha size={11} />
                12%
              </span>
            </div>
            <Img src="anuncio-tendencia.svg" alt="Linea de tendencia de rentabilidad" className={s.tendencia} />
            <span className={s.note}>Después de margen, comisiones, cuotas y envío</span>
          </div>

          <div className={cn(s.float, s.floatAlerta)}>
            <span className={s.alertaKicker}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 8v5" />
                <path d="M12 17h.01" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              Plata tirada
            </span>
            <p className={s.alertaText}>Buzos invierno sigue con inversión y está sin stock en M y L hace 4 días</p>
            <div className={s.alertaStats}>
              <span>
                <span className={s.alertaLabel}>Esta semana</span>
                <span className={cn(s.alertaValue, s.danger)}>− $ 141.900</span>
              </span>
              <span>
                <span className={s.alertaLabel}>Gasto diario</span>
                <span className={s.alertaValue}>$ 6.400</span>
              </span>
            </div>
          </div>

          <div className={cn(s.float, s.floatDetalle, shared.card)}>
            <div className={s.detalleHead}>
              <span className={s.detalleName}>Buzos invierno</span>
              <span className={s.note}>14 anuncios · 29 sep al 5 oct</span>
            </div>
            <dl className={s.metricas}>
              {METRICAS.map((m) => (
                <div key={m.label}>
                  <dt>{m.label}</dt>
                  <dd className={s.metricaValue}>{m.value}</dd>
                  <dd className={cn(s.metricaDelta, m.tone)}>
                    <Flecha size={10} down={m.down} />
                    {m.delta}
                  </dd>
                </div>
              ))}
            </dl>
            <span className={s.detalleFoot}>Las ventas salen de Tiendanube, no de lo que se atribuye Meta.</span>
          </div>
        </div>

        {/* Móvil: tabla de campañas con la alerta. */}
        <div className={cn(s.tabla, shared.soloMov)}>
          <span className={s.tablaTitle}>Rentabilidad real por campaña</span>
          <div>
            {CAMPANAS.map((c) => (
              <div key={c.name} className={cn(s.fila, c.alerta && s.filaAlerta)}>
                {c.alerta ? (
                  <span className={s.filaName}>
                    <span>{c.name}</span>
                    <span className={s.filaSub}>{c.alerta}</span>
                  </span>
                ) : (
                  <span className={s.filaName}>{c.name}</span>
                )}
                <span className={cn(s.filaValue, c.alerta && s.danger)}>{c.value}</span>
              </div>
            ))}
          </div>
          <p className={s.tablaAlerta}>
            <span>La alerta que te llega:</span> «Estás gastando $45.000 por semana en anuncios del buzo
            gris, que se agotó hace 4 días.»
          </p>
        </div>

        <div className={cn(s.beneficios, shared.soloEsc)}>
          {BENEFICIOS_ESC.map(([t, d]) => (
            <div key={t} className={s.beneficio}>
              <span className={s.beneficioTitle}>{t}</span>
              <span className={s.beneficioText}>{d}</span>
            </div>
          ))}
        </div>
        <div className={cn(s.beneficiosMov, shared.soloMov)}>
          {BENEFICIOS_MOV.map(([t, d]) => (
            <div key={t} className={s.beneficioMov}>
              <span className={s.beneficioTitle}>{t}</span>
              <span className={s.beneficioText}>{d}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
