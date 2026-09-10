import { Callout, EmptyState } from '@/components/ui';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCompanyMembership } from '@/modules/company/service';
import { METHODOLOGY_VERSION, REPORT_SCHEMA_VERSION } from '@/modules/reporting/contract';

export const metadata = { title: 'Reportes' };

/**
 * El estado vacío está respaldado por una consulta real contra `reports`, no por un
 * cartel fijo. Hoy siempre devuelve cero filas porque la generación no está implementada
 * y la tabla no admite escritura desde la aplicación.
 */
export default async function ReportsPage() {
  await requireCompanyMembership();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('reports')
    .select('id, status, created_at, report_schema_version, methodology_version')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <Callout tone="danger">No pudimos leer los reportes: {error.message}</Callout>
      </div>
    );
  }

  const reports = data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="mt-2 text-sm text-muted">
          Diagnóstico de la situación actual y plan de optimización priorizado.
        </p>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          title="Todavía no hay reportes"
          reason="La generación del diagnóstico con IA no está implementada en esta versión. Un reporte necesita antes datos extraídos de tus sistemas y métricas calculadas por código; ninguna de esas dos capacidades está disponible todavía."
        />
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li
              key={report.id}
              className="rounded-xl border border-border bg-surface px-5 py-4 text-sm"
            >
              <span className="font-medium">{report.status}</span>
              <span className="ml-3 text-muted">
                {new Date(report.created_at).toLocaleDateString('es-AR')}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Callout title="Qué va a contener un reporte">
        <p>
          El contrato del reporte ya está definido y versionado (esquema{' '}
          <code className="font-mono">{REPORT_SCHEMA_VERSION}</code>, metodología{' '}
          <code className="font-mono">{METHODOLOGY_VERSION}</code>): objetivos y contexto,
          situación actual con período y cobertura, hallazgos con la evidencia que los respalda,
          mejoras priorizadas, plan por etapas y medición propuesta.
        </p>
        <p>
          Cada afirmación tiene que apoyarse en evidencia registrada, y lo que no se pueda
          sostener con datos queda declarado como información faltante en lugar de completarse
          con una estimación.
        </p>
      </Callout>
    </div>
  );
}
