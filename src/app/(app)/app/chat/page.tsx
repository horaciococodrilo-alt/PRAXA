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
  let metaActiva = false;
  let tiendaActiva = false;
  let ga4Activa = false;
  try {
    const ctx = await requireTenantContext();
    tieneEmpresa = true;
    // Cada fuente se lee por separado: un error en una no apaga la otra (D-M16e-22).
    try { metaActiva = (await readConnectionRecord(ctx))?.status === 'active'; }
    catch { metaActiva = false; }
    try {
      // Solo «Tiendanube», sin el nombre de la tienda (decisión del usuario, 2026-11-15).
      tiendaActiva = (await readConnectionRecord(ctx, {}, 'tiendanube'))?.status === 'active';
    } catch { tiendaActiva = false; }
    try {
      // Solo «Google Analytics», sin el nombre ni el número de la propiedad (M16f-C-13).
      ga4Activa = (await readConnectionRecord(ctx, {}, 'ga4'))?.status === 'active';
    } catch { ga4Activa = false; }
  } catch { tieneEmpresa = false; }

  const conectadas = [
    ...(metaActiva ? [{ id: 'meta_ads' as const, nombre: 'Meta Ads' }] : []),
    ...(tiendaActiva ? [{ id: 'tiendanube' as const, nombre: 'Tiendanube' }] : []),
    ...(ga4Activa ? [{ id: 'google_analytics' as const, nombre: 'Google Analytics' }] : []),
  ];

  return (
    <Chat
      iniciales={iniciales(usuario.nombre, usuario.apellido, usuario.email)}
      conectadas={conectadas}
      tieneEmpresa={tieneEmpresa}
      conexionActiva={conectadas.length > 0}
    />
  );
}
