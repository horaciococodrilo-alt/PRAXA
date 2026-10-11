import { Perfil } from '@/components/app/perfil';
import p from '@/components/app/perfil.module.css';
import { PageHeader } from '@/components/app/ui';
import { getUsuario, requireAppSession } from '@/modules/app-data';

export const metadata = { title: 'Mi perfil' };

export default async function PerfilPage() {
  await requireAppSession('/app/perfil');
  const usuario = await getUsuario();

  return (
    <>
      <PageHeader
        className={p.head}
        title="Mi perfil"
        subtitle="Gestiona tu información personal, seguridad y preferencias."
      />
      <Perfil usuario={usuario} />
    </>
  );
}
