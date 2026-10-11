import { cn } from '@/components/ui';
import type { CostoDia } from '@/modules/app-data/types';

import c from './bar-chart.module.css';
import { diaCorto, usd, usdEje } from './format';

const PASO_ETIQUETA: Record<number, number> = { 7: 1, 30: 3, 90: 9 };
const TICKS = [0, 0.25, 0.5, 0.75, 1];

/** Tope del eje Y: US$ 2,0 como en el diseño, o el múltiplo de 0,5 que cubra el máximo. */
export function topeEje(dias: CostoDia[]): number {
  const max = Math.max(0, ...dias.map((d) => d.usd));
  return Math.max(2, Math.ceil(max / 0.5) * 0.5);
}

/** Etiquetas del eje X: cada 1, 3 o 9 días según el rango, contando desde hoy hacia atrás. */
export function etiquetasX(dias: CostoDia[]): { left: string; texto: string }[] {
  const r = dias.length;
  const paso = PASO_ETIQUETA[r] ?? Math.max(1, Math.round(r / 10));
  return dias.flatMap((d, i) =>
    (r - 1 - i) % paso === 0 ? [{ left: `${(((i + 0.5) / r) * 100).toFixed(2)}%`, texto: diaCorto(d.fecha) }] : [],
  );
}

function descripcion(dias: CostoDia[]): string {
  const base = `Costo diario en dólares durante los últimos ${dias.length} días`;
  const pico = dias.reduce<CostoDia | null>((m, d) => (d.usd > (m?.usd ?? 0) ? d : m), null);
  if (!pico) return `${base}: sin consultas en el período, todo en cero`;
  return `${base}; el pico es de ${usd(pico.usd)} el ${diaCorto(pico.fecha)}`;
}

/** Gráfico de barras de costo por día. Un día en cero se dibuja como una línea fina. */
export function BarChart({ dias }: { dias: CostoDia[] }) {
  const tope = topeEje(dias);
  return (
    <>
      <div className={c.chart} role="img" aria-label={descripcion(dias)}>
        {TICKS.map((t) => (
          <i key={t} className={c.grid} style={{ bottom: `${t * 100}%` }} />
        ))}
        <div aria-hidden="true">
          {TICKS.map((t) => (
            <span key={t} className={c.yl} style={{ bottom: `${t * 100}%` }}>
              {usdEje(t * tope)}
            </span>
          ))}
        </div>
        <div className={c.bars} aria-hidden="true">
          {dias.map((d) => (
            <span key={d.fecha} className={c.slot}>
              <span
                className={cn(c.bar, d.usd === 0 && c.cero)}
                style={d.usd === 0 ? undefined : { height: `${(d.usd / tope) * 100}%` }}
              />
            </span>
          ))}
        </div>
      </div>
      <div className={c.xl} aria-hidden="true">
        {etiquetasX(dias).map((e) => (
          <span key={e.left} style={{ left: e.left }}>
            {e.texto}
          </span>
        ))}
      </div>
    </>
  );
}
