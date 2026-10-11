import { Diagnostico } from '@/components/app/diagnostico';
import d from '@/components/app/diagnostico.module.css';
import { IconChispas } from '@/components/app/icons';
import { ButtonLink, PageHeader } from '@/components/app/ui';
import { cn } from '@/components/ui';
import { getDiagnostico, requireAppSession } from '@/modules/app-data';

export const metadata = { title: 'Diagnóstico' };

export default async function DiagnosticoPage() {
  await requireAppSession('/app/diagnostico');
  const datos = await getDiagnostico();

  return (
    <div className={d.page}>
      <PageHeader
        title="Diagnóstico"
        subtitle="Un análisis claro de tu negocio, basado en tus datos de Meta Ads."
      />
      {datos ? (
        <Diagnostico datos={datos} />
      ) : (
        // El diseño no tiene estado vacío: misma tarjeta del resumen, sin datos inventados.
        <section className={cn(d.card, d.empty)} aria-label="Resumen del diagnóstico">
          <div className={d.lh}>
            <span className={cn(d.tile, d.tileLg)}>
              <IconChispas size={30} stroke={1.4} />
            </span>
            <h2 className={d.h}>Todavía no hay un diagnóstico.</h2>
          </div>
          <p className={d.p}>
            Se genera a partir de los datos de tus integraciones, cuando estén conectadas y
            sincronizadas.
          </p>
          <ButtonLink href="/app/integraciones" variant="secondary">
            Ver integraciones
          </ButtonLink>
        </section>
      )}
    </div>
  );
}
