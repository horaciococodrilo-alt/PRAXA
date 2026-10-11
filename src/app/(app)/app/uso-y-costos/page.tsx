import { cantidad, segundos, usd } from '@/components/app/format';
import { IconBase, IconChat, IconDocumento, IconRayo } from '@/components/app/icons';
import { KpiCard } from '@/components/app/ui';
import { UsoCostos } from '@/components/app/uso-costos';
import u from '@/components/app/uso.module.css';
import { getUso, requireAppSession } from '@/modules/app-data';

export const metadata = { title: 'Uso y costos' };

export default async function UsoCostosPage() {
  await requireAppSession('/app/uso-y-costos');
  const uso = await getUso();
  const { resumen } = uso;

  return (
    <UsoCostos
      uso={uso}
      kpis={
        <section className={u.kpis} aria-label="Resumen del período">
          <KpiCard
            icon={<IconBase size={20} />}
            label="Costo total este mes"
            value={usd(resumen.costoMesUsd)}
            change={resumen.variacionCostoPct}
          />
          <KpiCard
            icon={<IconChat size={20} />}
            label="Consultas totales"
            value={cantidad(resumen.consultas)}
            change={resumen.variacionConsultasPct}
          />
          <KpiCard
            icon={<IconRayo size={20} />}
            label="Latencia promedio"
            value={segundos(resumen.latenciaPromedioS)}
            caption={
              <>
                Tiempo promedio que tarda
                <br />
                Praxa en responder.
              </>
            }
          />
          <KpiCard
            icon={<IconDocumento size={20} />}
            label="Costo promedio"
            value={usd(resumen.costoPorConsultaUsd)}
            caption="Por consulta"
          />
        </section>
      }
    />
  );
}
