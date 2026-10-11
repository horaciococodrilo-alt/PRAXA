import { Chat } from '@/components/app/chat';
import { iniciales } from '@/components/app/format';
import { getIntegraciones, getUsuario, requireAppSession } from '@/modules/app-data';

export const metadata = { title: 'Chat' };

export default async function ChatPage() {
  await requireAppSession('/app/chat');
  const [usuario, integraciones] = await Promise.all([getUsuario(), getIntegraciones()]);

  return (
    <Chat
      iniciales={iniciales(usuario.nombre, usuario.apellido, usuario.email)}
      conectadas={integraciones.filter((i) => i.conectada).map(({ id, nombre }) => ({ id, nombre }))}
    />
  );
}
