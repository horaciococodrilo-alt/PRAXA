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

vi.mock('@/modules/app-data', () => ({
  requireAppSession: (ruta: string) => requireAppSession(ruta),
  getUsuario: lectura('getUsuario'),
  getEmpresa: lectura('getEmpresa'),
  getIntegraciones: lectura('getIntegraciones'),
  getUso: lectura('getUso'),
  getDiagnostico: lectura('getDiagnostico'),
  configuracionPendiente: () => false,
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/app' }));
vi.mock('@/components/landing/fonts', () => ({ manrope: { variable: '' }, jetbrainsMono: { variable: '' } }));
vi.mock('@/components/auth/recovery', () => ({ enviarEnlaceDeContrasena: vi.fn() }));
vi.mock('@/modules/identity/actions', () => ({
  guardarNombreUsuario: vi.fn(),
  guardarFotoPerfil: vi.fn(),
  eliminarFotoPerfil: vi.fn(),
}));
vi.mock('@/modules/company/actions', () => ({ guardarPerfilEmpresa: vi.fn() }));
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

  it('encuentra las siete pantallas', () => {
    expect(PAGINAS.map(([r]) => r).sort()).toEqual([
      '/app',
      '/app/chat',
      '/app/configuracion',
      '/app/diagnostico',
      '/app/integraciones',
      '/app/perfil',
      '/app/uso-y-costos',
    ]);
  });

  it.each(PAGINAS)('%s verifica la sesión con su ruta antes de leer datos', async (r, archivo) => {
    const { default: Pagina } = (await import(/* @vite-ignore */ archivo)) as { default: () => Promise<unknown> };

    await expect(Pagina()).rejects.toBe(SIN_SESION);
    expect(requireAppSession).toHaveBeenCalledWith(r);
    expect(lecturas).not.toHaveBeenCalled();
  });
});
