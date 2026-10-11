import { Configuracion } from '@/components/app/configuracion';
import c from '@/components/app/configuracion.module.css';
import { PageHeader } from '@/components/app/ui';
import { getEmpresa, requireAppSession } from '@/modules/app-data';

export const metadata = { title: 'Configuración' };

export default async function ConfiguracionPage() {
  await requireAppSession('/app/configuracion');
  // Sin empresa todavía: el formulario arranca vacío y la crea al guardar.
  const empresa = await getEmpresa();

  return (
    <>
      <PageHeader
        className={c.head}
        title="Configuración"
        subtitle="Gestioná la información de tu empresa y tus preferencias."
      />
      <Configuracion empresa={empresa} />
    </>
  );
}
