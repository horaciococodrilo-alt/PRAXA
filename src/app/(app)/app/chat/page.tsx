import { Chat } from '@/components/app/chat';
import { iniciales } from '@/components/app/format';
import { getUsuario, requireAppSession } from '@/modules/app-data';
import { readConnectionRecord } from '@/modules/integrations/repository/connections';
import { requireTenantContext } from '@/modules/tenant/context';

export const metadata = { title: 'Chat' };
export const maxDuration = 75;

export default async function ChatPage() {
  await requireAppSession('/app/chat');
  const usuario = await getUsuario();
  let tieneEmpresa = false;
  let conexionActiva = false;
  try {
    const ctx = await requireTenantContext();
    tieneEmpresa = true;
    try { conexionActiva = (await readConnectionRecord(ctx))?.status === 'active'; }
    catch { conexionActiva = false; }
  } catch { tieneEmpresa = false; }

  return (
    <Chat
      iniciales={iniciales(usuario.nombre, usuario.apellido, usuario.email)}
      conectadas={conexionActiva ? [{ id: 'meta_ads', nombre: 'Meta Ads' }] : []}
      tieneEmpresa={tieneEmpresa}
      conexionActiva={conexionActiva}
    />
  );
}
