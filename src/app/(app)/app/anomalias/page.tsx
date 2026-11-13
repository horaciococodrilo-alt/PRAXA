import { Anomalias } from '@/components/app/anomalias';
import { PageHeader } from '@/components/app/ui';
import { requireAppSession } from '@/modules/app-data';
import { loadMetaAnomalyView } from '@/modules/anomalies/load';

export const metadata = { title: 'Anomalías' };

export default async function AnomaliasPage({
  searchParams,
}: {
  searchParams: Promise<{ ejemplo?: string | string[] }>;
}) {
  await requireAppSession('/app/anomalias');
  const query = await searchParams;
  const mode = query.ejemplo === '1' ? 'synthetic_demo' : 'real';
  const view = await loadMetaAnomalyView({ mode });

  return (
    <>
      <PageHeader
        title="Anomalías de Meta Ads"
        subtitle="Cambios relevantes detectados con reglas transparentes y evidencia verificable."
      />
      <Anomalias view={view} />
    </>
  );
}
