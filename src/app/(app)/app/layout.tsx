import { iniciales, nombreCorto } from '@/components/app/format';
import { AppShell } from '@/components/app/shell';
import { ConfigurationMissing } from '@/components/configuration-missing';
import { isSupabaseConfigured } from '@/lib/env';
import {
  configuracionPendiente,
  getEmpresa,
  getIntegraciones,
  getUsuario,
} from '@/modules/app-data';
import { requireUser } from '@/modules/identity/session';

// Todo lo que cuelga de /app depende de la sesión y de la empresa del usuario.
// Nunca debe prerenderizarse ni cachearse de forma compartida.
export const dynamic = 'force-dynamic';

/**
 * Shell de la aplicación protegida.
 *
 * Vuelve a verificar la identidad con `getClaims()` aunque el proxy ya haya redirigido:
 * el proxy es conveniencia, no autorización.
 */
export default async function AppLayout({ children }: LayoutProps<'/app'>) {
  // Sin configuración no hay sesión que verificar. Se dice qué falta en vez de estallar
  // con un error de servidor opaco.
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-20">
        <ConfigurationMissing />
      </main>
    );
  }
  await requireUser('/app');

  const [usuario, empresa, integraciones] = await Promise.all([
    getUsuario(),
    getEmpresa(),
    getIntegraciones(),
  ]);

  // Sin empresa la app se muestra igual: se crea al guardar Configuración, que mientras
  // tanto lleva el punto rojo de datos pendientes.
  return (
    <AppShell
      nombre={nombreCorto(usuario.nombre, usuario.email)}
      iniciales={iniciales(usuario.nombre, usuario.apellido, usuario.email)}
      foto={usuario.fotoUrl}
      conectada={integraciones.find((i) => i.conectada)?.nombre ?? null}
      configPendiente={configuracionPendiente(empresa)}
    >
      {children}
    </AppShell>
  );
}
