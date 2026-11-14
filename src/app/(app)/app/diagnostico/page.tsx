import { Diagnostico } from '@/components/app/diagnostico';
import d from '@/components/app/diagnostico.module.css';
import { PageHeader } from '@/components/app/ui';
import { getDiagnostico, requireAppSession, type DiagnosticoVista } from '@/modules/app-data';
import { parseResultado } from '@/modules/diagnostics/compose';

export const metadata = { title: 'Diagnóstico' };

/** La Server Action de generación corre con el plazo de la página (Diseño §3: 300 s). */
export const maxDuration = 300;

export default async function DiagnosticoPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAppSession('/app/diagnostico');
  const params = await searchParams;
  let vista: DiagnosticoVista | null = null;
  let error = false;
  try { vista = await getDiagnostico(); } catch { error = true; }

  return (
    <div className={d.page}>
      <PageHeader
        title="Diagnóstico"
        subtitle="Un análisis claro de tus campañas de Meta Ads, con cifras calculadas por PRAXA."
      />
      <Diagnostico vista={vista} error={error} resultado={parseResultado(params.resultado)} />
    </div>
  );
}
