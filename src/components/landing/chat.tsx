import { cn } from '@/components/ui';

import { Arranque } from './arranque';
import { Eyebrow } from './eyebrow';
import { Img, ThemedImg } from './img';
import shared from './landing.module.css';
import s from './chat.module.css';

const LINEA_IZQ = ['M0 52 C 30 52, 46 96, 76 96', 'M0 52 C 32 52, 46 60, 76 64', 'M0 52 C 30 52, 46 10, 76 8'];
const LINEA_DER = ['M76 52 C 46 52, 30 96, 0 96', 'M76 52 C 44 52, 30 60, 0 64', 'M76 52 C 46 52, 30 10, 0 8'];

// Las seis preguntas. En escritorio van tres a cada lado del chat; en móvil, en columna
// debajo y en el orden de `mov`.
const IZQ = [
  { icon: 'q-ventas', alt: 'Icono de ventas', text: '¿Por qué bajaron mis ventas?', off: s.offA, mov: s.orden1 },
  { icon: 'q-recompra', alt: 'Icono de recompra', text: '¿Qué productos generan más recompra?', mov: s.orden3 },
  { icon: 'p3-clientes', alt: 'Icono de clientes', text: '¿Qué clientes tienen mayor valor?', off: s.offB, mov: s.orden5 },
];
const DER = [
  { icon: 'q-campana', alt: 'Icono de campaña', text: '¿Qué campaña funcionó mejor?', off: s.offA, mov: s.orden2 },
  { icon: 'p3-stock', alt: 'Icono de stock', text: '¿Hay riesgo de quiebre de stock?', mov: s.orden4 },
  { icon: 'q-crecimiento', alt: 'Icono de crecimiento', text: '¿Cómo viene el crecimiento de este mes?', off: s.offB, mov: s.orden6 },
];

function Preguntas({ items, lineas, lado }: { items: typeof IZQ; lineas: string[]; lado: 'izq' | 'der' }) {
  const punto = lado === 'izq' ? 2.5 : 73.5;
  return (
    <div className={cn(s.lado, lado === 'izq' ? s.izq : s.der)}>
      {items.map((q, i) => (
        <div key={q.text} className={cn(s.qa, q.off, q.mov)}>
          <ThemedImg light={`${q.icon}.svg`} dark={`${q.icon}-osc.svg`} alt={q.alt} />
          <span>{q.text}</span>
          <svg className={s.linea} width="76" height="104" viewBox="0 0 76 104" fill="none" aria-hidden="true" focusable="false">
            <path d={lineas[i]} stroke="var(--lp-mint)" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx={punto} cy="52" r="2.5" fill="var(--lp-mint)" />
          </svg>
        </div>
      ))}
    </div>
  );
}

function Avatar() {
  return (
    <span className={s.avatar}>
      <ThemedImg light="chat-avatar.png" dark="chat-avatar-menta.png" width={225} height={225} alt="Asistente Praxa" />
    </span>
  );
}

function Pensando({ className }: { className: string }) {
  return (
    <span className={cn(s.think, className)} aria-hidden="true">
      <ThemedImg light="chat-pensando.svg" dark="chat-pensando-osc.svg" alt="La IA esta pensando" className={s.pensando} />
    </span>
  );
}

const BARRAS = [
  { label: 'Remarketing', value: '27%', h: 101, color: 'var(--lp-accent-ink)', delay: '2.7s' },
  { label: 'Prospecting', value: '18%', h: 68, color: '#2A9B88', delay: '2.82s' },
  { label: 'Lookalike', value: '14%', h: 53, color: '#58BFAC', delay: '2.94s' },
  { label: 'Conversiones', value: '9%', h: 34, color: '#92DECD', delay: '3.06s' },
];

const FUENTES = [
  { logo: 'logo-meta-ads.png', w: 527, h: 356, name: 'Meta Ads', alt: 'Fuente Meta Ads', sub: 'Campañas' },
  { logo: 'logo-ga4.png', w: 398, h: 438, name: 'Analytics 4', alt: 'Fuente Google Analytics 4', sub: 'Eventos' },
  { logo: 'logo-tiendanube.png', dark: 'logo-tiendanube-claro.png', w: 448, h: 324, name: 'Tiendanube', alt: 'Fuente Tiendanube', sub: 'Pedidos' },
];

/** Conversación de escritorio: una pregunta con gráfico y fuentes. */
function ConversacionEsc() {
  return (
    <div className={cn(s.cuerpo, shared.soloEsc)}>
      <p className={cn(s.msg, s.anim, s.dMsg1)} data-arranque="">
        ¿Qué campañas de Meta Ads trajeron los clientes que más recompraron este mes?
      </p>
      <div className={s.fila}>
        <Avatar />
        <Pensando className={cn(s.anim, s.dThink1)} />
        <div className={cn(s.respuesta, s.anim, s.dAns1)}>
          <div className={s.burbuja}>
            <p className={s.texto}>
              Las <strong className={s.destacado}>campañas de remarketing</strong> generaron los clientes con
              mayor recurrencia.
            </p>
            <p className={s.textoSec}>Tuvieron un 27% de recompra, frente al 16% del promedio de la cuenta.</p>
          </div>

          <figure className={s.grafico}>
            <figcaption>Tasa de recompra por campaña</figcaption>
            <div className={s.plot}>
              {['40%', '30%', '20%', '10%', '0%'].map((y, i) => (
                <span key={y} className={s.eje} style={{ top: i * 37.5 }}>
                  {y}
                </span>
              ))}
              <div className={s.area}>
                {[0, 37.5, 75, 112.5].map((top) => (
                  <span key={top} aria-hidden="true" className={s.grilla} style={{ top }} />
                ))}
                <div className={s.barras}>
                  {BARRAS.map((b) => (
                    <span key={b.label} className={s.columna}>
                      <span className={s.valor}>{b.value}</span>
                      <span
                        className={cn(s.barra, shared.grow, s.anim)}
                        style={{ height: b.h, background: b.color, animationDelay: b.delay }}
                      />
                    </span>
                  ))}
                </div>
              </div>
              <div className={s.etiquetas}>
                {BARRAS.map((b) => (
                  <span key={b.label}>{b.label}</span>
                ))}
              </div>
            </div>
          </figure>

          <div className={s.fuentes}>
            <span className={s.fuentesTitulo}>Fuentes utilizadas</span>
            <div className={s.fuentesLista}>
              {FUENTES.map((f) => (
                <span key={f.name} className={s.fuente}>
                  {f.dark ? (
                    <ThemedImg light={f.logo} dark={f.dark} width={f.w} height={f.h} alt={f.alt} />
                  ) : (
                    <Img src={f.logo} width={f.w} height={f.h} alt={f.alt} />
                  )}
                  <span>
                    <span className={s.fuenteNombre}>{f.name}</span>
                    <span className={s.fuenteSub}>{f.sub}</span>
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Conversación móvil: dos preguntas, la segunda sin datos para responder. */
function ConversacionMov() {
  return (
    <div className={cn(s.cuerpo, shared.soloMov)}>
      <p className={cn(s.msg, s.anim, s.mMsg1)} data-arranque="">
        ¿Por qué bajaron las ventas esta semana?
      </p>
      <div className={s.fila}>
        <Avatar />
        <Pensando className={cn(s.anim, s.mThink1)} />
        <div className={cn(s.respuesta, s.burbuja, s.anim, s.mAns1)}>
          <p className={s.texto}>
            Cayeron <strong className={s.num}>18%</strong>: <strong className={s.num}>$ 3.429.700</strong> contra $
            4.182.600.
          </p>
          <p className={s.textoSec}>
            No fue el tráfico: las sesiones subieron 4%. Cayó la conversión en mobile, del 1,9% al 1,4%, en el
            paso de envío.
          </p>
          <div className={s.chips}>
            <span>GA4 · Tiendanube</span>
            <span>
              <span aria-hidden="true" className={s.cuadro} />7 de 7
            </span>
            <span className={s.mono}>6 oct 14:20</span>
          </div>
        </div>
      </div>
      <p className={cn(s.msg, s.anim, s.mMsg2)}>¿Y cómo nos fue en agosto?</p>
      <div className={s.fila}>
        <Avatar />
        <Pensando className={cn(s.anim, s.mThink2)} />
        <div className={cn(s.respuesta, s.burbuja, s.anim, s.mAns2)}>
          <span className={s.sinRespuesta}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M8.5 12h7" />
            </svg>
            No puedo responder esto
          </span>
          <p className={s.texto}>
            No tengo ningún día de agosto. Los datos arrancan el 7 de septiembre, así que cualquier número de ese
            mes sería inventado.
          </p>
        </div>
      </div>
    </div>
  );
}

/** "Decisiones inteligentes": el chat con las seis preguntas. */
export function Chat() {
  return (
    <section aria-label="Decisiones inteligentes: preguntale a Praxa" className={s.section}>
      <Eyebrow n={1} className={shared.soloMov}>
        Decisiones inteligentes
      </Eyebrow>
      <div className={s.marco}>
        <Preguntas items={IZQ} lineas={LINEA_IZQ} lado="izq" />
        <Arranque className={s.chatCol}>
          <div className={s.chat}>
            <div className={s.cabecera}>
              <ThemedImg
                light="logo-praxa-tinta.png"
                dark="logo-praxa-blanco.png"
                width={551}
                height={145}
                alt="Praxa"
                className={s.logo}
              />
              <span aria-hidden="true" className={cn(s.iniciales, shared.soloEsc)}>
                GM
              </span>
              <span className={cn(s.cuenta, shared.soloMov)}>act_…4821</span>
            </div>
            <ConversacionEsc />
            <ConversacionMov />
            <div className={s.pie}>
              <div className={s.entrada}>
                <Img src="chat-adjuntar.png" width={38} height={49} alt="Adjuntar" className={s.adjuntar} />
                <span>Preguntá lo que quieras...</span>
                <Img src="chat-enviar.png" width={61} height={61} alt="Enviar mensaje" className={s.enviar} />
              </div>
            </div>
          </div>
        </Arranque>
        <Preguntas items={DER} lineas={LINEA_DER} lado="der" />
      </div>
    </section>
  );
}
