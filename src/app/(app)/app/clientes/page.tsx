import { PageHeader } from '@/components/app/ui';
import { Clientes } from '@/components/customer-insights/clientes';
import { requireAppSession } from '@/modules/app-data';
import { loadCustomerInsightsPage } from '@/modules/customer-insights/load';

export const metadata = { title: 'Clientes' };

/**
 * M27a: segmentos RFM, cohortes y propuestas de audiencias. La sesión se verifica acá, sin
 * confiar solo en el layout. La única entrada que se acepta es `?currency=`; la empresa y la
 * conexión se resuelven en el servidor. Un GET nunca escribe ni sincroniza.
 */
export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAppSession('/app/clientes');
  const query = await searchParams;
  const { view, nowMs } = await loadCustomerInsightsPage(query.currency ?? null);

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Segmentos RFM, cohortes por primera compra y propuestas de audiencias con reglas fijas, a partir de Tiendanube."
      />
      <Clientes view={view} nowMs={nowMs} />
    </>
  );
}
