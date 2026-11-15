import { Chat } from '@/components/app/chat';
import { iniciales } from '@/components/app/format';
import { getUsuario, requireAppSession } from '@/modules/app-data';
import { readStoreDomain } from '@/modules/chat/tools/tiendanube';
import { readConnectionRecord } from '@/modules/integrations/repository/connections';
import { requireTenantContext } from '@/modules/tenant/context';

export const metadata = { title: 'Chat' };
export const maxDuration = 75;

const DOMINIO_MAX = 32;

/** Dominio de la tienda acortado (CA-52); nunca su ID. */
function dominioCorto(dominio: string | null): string | null {
  if (!dominio) return null;
  return dominio.length <= DOMINIO_MAX ? dominio : `${dominio.slice(0, DOMINIO_MAX - 1)}…`;
}

export default async function ChatPage() {
  await requireAppSession('/app/chat');
  const usuario = await getUsuario();
  let tieneEmpresa = false;
  let metaActiva = false;
  let tienda: { activa: boolean; dominio: string | null } = { activa: false, dominio: null };
  try {
    const ctx = await requireTenantContext();
    tieneEmpresa = true;
    // Cada fuente se lee por separado: un error en una no apaga la otra (D-M16e-22).
    try { metaActiva = (await readConnectionRecord(ctx))?.status === 'active'; }
    catch { metaActiva = false; }
    try {
      const conexion = await readConnectionRecord(ctx, {}, 'tiendanube');
      if (conexion?.status === 'active') {
        let dominio: string | null = null;
        try { dominio = dominioCorto(await readStoreDomain(conexion.id)); }
        catch { dominio = null; }
        tienda = { activa: true, dominio };
      }
    } catch { tienda = { activa: false, dominio: null }; }
  } catch { tieneEmpresa = false; }

  const conectadas = [
    ...(metaActiva ? [{ id: 'meta_ads' as const, nombre: 'Meta Ads' }] : []),
    ...(tienda.activa ? [{ id: 'tiendanube' as const,
      nombre: tienda.dominio ? `Tiendanube · ${tienda.dominio}` : 'Tiendanube' }] : []),
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
