'use client';

import { useState, type ReactNode } from 'react';

import type { Uso } from '@/modules/app-data/types';

import { BarChart } from './bar-chart';
import { Desplegable, type Opcion } from './desplegable';
import { porcentaje, segundos } from './format';
import { IconAlerta, IconCalendario, IconCheck, IconRayo, IconReloj } from './icons';
import { Card, PageHeader } from './ui';
import u from './uso.module.css';

export type Rango = 7 | 30 | 90;

const SEGMENTOS: [Rango, string][] = [
  [7, '7 días'],
  [30, '30 días'],
  [90, '3 meses'],
];

const RANGOS: Opcion<Rango>[] = [7, 30, 90].map((n) => ({ valor: n as Rango, texto: `Últimos ${n} días` }));

/**
 * Encabezado, gráfico y rendimiento de Uso y costos. Los KPIs llegan ya renderizados
 * (`kpis`): no dependen del rango. El rango solo cambia el gráfico.
 */
export function UsoCostos({ uso, kpis }: { uso: Uso; kpis: ReactNode }) {
  const [rango, setRango] = useState<Rango>(30);
  const dias = uso.costoDiario.slice(-rango);
  const r = uso.rendimiento;

  return (
    <>
      <div className={u.top}>
        <PageHeader
          className={u.titles}
          title="Uso y costos"
          subtitle="Seguimiento del uso de la IA, costos y rendimiento de Praxa."
        />
        <Desplegable
          valor={rango}
          opciones={RANGOS}
          onChange={setRango}
          icono={<IconCalendario size={17} />}
        />
      </div>

      {kpis}

      <div className={u.row}>
        <Card className={u.panel} aria-labelledby="uso-costo-dia">
          <div className={u.ph}>
            <div>
              <h2 className={u.pt} id="uso-costo-dia">
                Costo por día
              </h2>
              <p className={u.ps}>Evolución del gasto en IA.</p>
            </div>
            <div className={u.seg} role="group" aria-label="Rango del gráfico">
              {SEGMENTOS.map(([n, label]) => (
                <button key={n} type="button" aria-pressed={n === rango} onClick={() => setRango(n)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <BarChart dias={dias} />
        </Card>

        <Card className={u.panel} aria-labelledby="uso-rendimiento">
          <h2 className={u.pt} id="uso-rendimiento">
            Rendimiento de la IA
          </h2>
          <p className={u.ps}>Métricas generales del sistema.</p>
          <div className={u.tiles}>
            <Metrica icon={<IconRayo size={17} stroke={1.9} />} valor={segundos(r.latenciaPromedioS)} label="Latencia promedio" nota="Tiempo promedio de respuesta." />
            <Metrica icon={<IconReloj size={17} stroke={1.9} />} valor={segundos(r.latenciaP95S)} label="P95 de latencia" nota="El 95% responde antes." />
            <Metrica icon={<IconCheck size={17} stroke={1.9} />} valor={porcentaje(r.procesadasPct)} label="Consultas procesadas" nota="Resueltas correctamente." />
            <Metrica icon={<IconAlerta size={17} stroke={1.9} />} valor={porcentaje(r.erroresPct)} label="Errores" nota="No pudieron procesarse." mala />
          </div>
        </Card>
      </div>
    </>
  );
}

function Metrica({
  icon,
  valor,
  label,
  nota,
  mala = false,
}: {
  icon: ReactNode;
  valor: string;
  label: string;
  nota: string;
  mala?: boolean;
}) {
  return (
    <div className={u.tile}>
      <div className={u.trow}>
        <span className={mala ? `${u.tic} ${u.ticBad}` : u.tic}>{icon}</span>
        <div>
          <div className={u.tv}>{valor}</div>
          <div className={u.tl}>{label}</div>
        </div>
      </div>
      <div className={u.tc}>{nota}</div>
    </div>
  );
}
