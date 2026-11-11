import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Cada página de `/app` verifica la sesión por su cuenta (`requireAppSession`) antes de leer
 * datos: las páginas se renderizan en paralelo con el layout, así que el chequeo del layout
 * no las protege. Las páginas se descubren del árbol, así que una página nueva sin el
 * chequeo hace fallar esta prueba.
 */

const SIN_SESION = new Error('SIN_SESION');
const requireAppSession = vi.fn();
const lecturas = vi.fn();
const lectura = (nombre: string) => () => (lecturas(nombre), Promise.resolve(null));
const tenant = vi.fn();
const connection = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/modules/app-data', () => ({
  requireAppSession: (ruta: string) => requireAppSession(ruta),
  getUsuario: () => { lecturas('getUsuario'); return Promise.resolve({
    nombre: 'Persona', apellido: null, email: 'synthetic@example.test',
  }); },
  getEmpresa: lectura('getEmpresa'),
  getIntegraciones: lectura('getIntegraciones'),
  getUso: lectura('getUso'),
  getDiagnostico: lectura('getDiagnostico'),
  configuracionPendiente: () => false,
}));
vi.mock('@/modules/integrations/lifecycle', () => ({ loadMetaCardState: lectura('loadMetaCardState') }));
vi.mock('@/modules/anomalies/load', () => ({ loadMetaAnomalyView: lectura('loadMetaAnomalyView') }));
vi.mock('@/modules/tenant/context', () => ({ requireTenantContext: () => tenant() }));
vi.mock('@/modules/integrations/repository/connections', () => ({
  readConnectionRecord: (...args: unknown[]) => connection(...args),
}));
vi.mock('@/modules/integrations/actions', () => ({ confirmarCuentaMeta: vi.fn(), desconectarMeta: vi.fn() }));
vi.mock('@/modules/integrations/meta/insights', () => ({ loadMetaSyncView: lectura('loadMetaSyncView'),
  parseMetaSyncResult: () => null, syncNotice: () => null }));
vi.mock('next/navigation', () => ({ usePathname: () => '/app' }));
vi.mock('@/components/landing/fonts', () => ({ manrope: { variable: '' }, jetbrainsMono: { variable: '' } }));
vi.mock('@/components/auth/recovery', () => ({ enviarEnlaceDeContrasena: vi.fn() }));
vi.mock('@/modules/identity/actions', () => ({
  guardarNombreUsuario: vi.fn(),
  guardarFotoPerfil: vi.fn(),
  eliminarFotoPerfil: vi.fn(),
}));
vi.mock('@/modules/company/actions', () => ({ guardarPerfilEmpresa: vi.fn() }));
vi.mock('@/modules/chat/actions', () => ({ preguntarChat: vi.fn(), votarRespuesta: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: vi.fn() }));

const RAIZ = join(process.cwd(), 'src', 'app', '(app)', 'app');

function paginas(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? paginas(join(dir, e.name)) : e.name === 'page.tsx' ? [join(dir, e.name)] : [],
  );
}

/** `src/app/(app)/app/uso-y-costos/page.tsx` → `/app/uso-y-costos`. */
const ruta = (archivo: string) => {
  const carpeta = relative(RAIZ, archivo).split(sep).slice(0, -1).join('/');
  return carpeta ? `/app/${carpeta}` : '/app';
};

const PAGINAS = paginas(RAIZ).map((archivo) => [ruta(archivo), archivo] as const);

describe('verificación de sesión en cada página de /app', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAppSession.mockRejectedValue(SIN_SESION);
  });

  it('encuentra las ocho pantallas', () => {
    expect(PAGINAS.map(([r]) => r).sort()).toEqual([
      '/app',
      '/app/anomalias',
      '/app/chat',
      '/app/configuracion',
      '/app/diagnostico',
      '/app/integraciones',
      '/app/perfil',
      '/app/uso-y-costos',
    ]);
  });

  it.each(PAGINAS)('%s verifica la sesión con su ruta antes de leer datos', async (r, archivo) => {
    const { default: Pagina } = (await import(/* @vite-ignore */ archivo)) as {
      default: (props: { searchParams: Promise<Record<string, string>> }) => Promise<unknown>;
    };

    await expect(Pagina({ searchParams: Promise.resolve({}) })).rejects.toBe(SIN_SESION);
    expect(requireAppSession).toHaveBeenCalledWith(r);
    expect(lecturas).not.toHaveBeenCalled();
  });

  it('chat resuelve empresa y conexión en el servidor después de la sesión', async () => {
    requireAppSession.mockResolvedValueOnce(undefined);
    const context = { user_id: 'a0000000-0000-4000-8000-000000000001',
      company_id: 'c0000000-0000-4000-8000-000000000001' };
    tenant.mockResolvedValueOnce(context);
    connection.mockResolvedValueOnce({ status: 'active' });
    const { default: ChatPage, maxDuration } = await import('@/app/(app)/app/chat/page');
    const element = await ChatPage();
    expect(maxDuration).toBe(75);
    expect(element.props).toMatchObject({ tieneEmpresa: true, conexionActiva: true });
    expect(connection).toHaveBeenCalledWith(context);
    expect(requireAppSession).toHaveBeenCalledWith('/app/chat');
  });

  it('chat degrada a flags falsos cuando falla K01 o la lectura de conexión', async () => {
    const { default: ChatPage } = await import('@/app/(app)/app/chat/page');
    requireAppSession.mockResolvedValue(undefined);
    tenant.mockRejectedValueOnce(new Error('synthetic'));
    const withoutCompany = await ChatPage();
    expect(withoutCompany.props).toMatchObject({ tieneEmpresa: false,
      conexionActiva: false });
    expect(connection).not.toHaveBeenCalled();
    tenant.mockResolvedValueOnce({ company_id: 'synthetic' });
    connection.mockRejectedValueOnce(new Error('synthetic'));
    const noConnection = await ChatPage();
    expect(noConnection.props).toMatchObject({ tieneEmpresa: true,
      conexionActiva: false });
  });
});
