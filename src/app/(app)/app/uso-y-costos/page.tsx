import { Card, PageHeader } from '@/components/app/ui';
import u from '@/components/app/uso.module.css';
import { requireAppSession } from '@/modules/app-data';

export const metadata = { title: 'Uso y costos' };

export default async function UsoCostosPage() {
  await requireAppSession('/app/uso-y-costos');

  return (
    <>
      <PageHeader title="Uso y costos" subtitle="Información sobre el consumo de la IA." />
      <Card className={u.panel}>
        <p>Todavía no disponible</p>
      </Card>
    </>
  );
}
