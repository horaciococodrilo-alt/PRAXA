import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Capa de datos de `/app` (`src/modules/app-data`). Supabase y la sesión se simulan: acá se
 * prueba qué se consulta y cómo se interpreta, no la base (eso es pgTAP).
 */

const ID = '00000000-0000-4000-8000-000000000001';

const from = vi.fn();
const eq = vi.fn();
const limit = vi.fn();
const getUser = vi.fn();
const createSignedUrl = vi.fn();
const requireUser = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/modules/identity/session', () => ({ requireUser: (p?: string) => requireUser(p) }));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    from: (t: string) => (from(t), { select: () => ({ eq: (...a: unknown[]) => (eq(...a), { limit: (n: number) => limit(n) }) }) }),
    auth: { getUser: () => getUser() },
    storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => createSignedUrl(...a) }) },
  }),
}));

const { configuracionPendiente, getDiagnostico, getIntegraciones, getUsuario } = await import('@/modules/app-data');

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: ID, email: 'ana@praxa.test' });
});

describe('getDiagnostico', () => {
  it('sin reportes listos devuelve null (estado vacío)', async () => {
    limit.mockResolvedValue({ data: [], error: null });
    await expect(getDiagnostico()).resolves.toBeNull();
    expect(from).toHaveBeenCalledWith('reports');
    expect(eq).toHaveBeenCalledWith('status', 'ready');
  });

  it('un error de lectura no se disfraza de estado vacío', async () => {
    limit.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    await expect(getDiagnostico()).rejects.toThrow(/No se pudo leer el diagnóstico/);
  });

  it('con un reporte listo no dice que no hay diagnóstico', async () => {
    limit.mockResolvedValue({ data: [{ id: 'r-1' }], error: null });
    await expect(getDiagnostico()).rejects.toThrow(/todavía no sabe mostrarlo/);
  });
});

describe('getUsuario', () => {
  const conFoto = (avatar_path: string) =>
    getUser.mockResolvedValue({
      data: { user: { created_at: '2026-10-01T12:00:00Z', user_metadata: { first_name: ' Ana ', avatar_path } } },
    });

  it('firma la foto de la carpeta propia', async () => {
    conFoto(`${ID}/foto.png`);
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://firmada/foto' } });

    const usuario = await getUsuario();

    expect(createSignedUrl).toHaveBeenCalledWith(`${ID}/foto.png`, 3600);
    expect(usuario).toEqual({
      id: ID,
      email: 'ana@praxa.test',
      nombre: 'Ana',
      apellido: null,
      miembroDesde: '2026-10-01T12:00:00Z',
      fotoUrl: 'https://firmada/foto',
    });
  });

  // `avatar_path` lo puede escribir el propio usuario: nunca se firma una ruta ajena.
  it.each(['11111111-0000-4000-8000-000000000002/ajena.png', `x${ID}/foto.png`])(
    'no firma una ruta fuera de la carpeta propia: %s',
    async (ruta) => {
      conFoto(ruta);
      const usuario = await getUsuario();
      expect(createSignedUrl).not.toHaveBeenCalled();
      expect(usuario.fotoUrl).toBeNull();
    },
  );
});

describe('configuracionPendiente (punto rojo de Configuración)', () => {
  const completa = { nombre: 'Mi Tienda', rubro: 'Otro', pais: 'Argentina', moneda: 'Pesos' };

  it.each([
    ['sin empresa', null],
    ['sin rubro', { ...completa, rubro: null }],
    ['sin país', { ...completa, pais: null }],
    ['sin moneda', { ...completa, moneda: null }],
  ])('queda pendiente %s', (_, empresa) => {
    expect(configuracionPendiente(empresa)).toBe(true);
  });

  it('con la empresa completa no queda pendiente', () => {
    expect(configuracionPendiente(completa)).toBe(false);
  });
});

describe('getIntegraciones', () => {
  it('ninguna está conectada: Meta Ads, Google Analytics y Tiendanube, en ese orden', async () => {
    const integraciones = await getIntegraciones();
    expect(integraciones.map((i) => [i.id, i.conectada])).toEqual([
      ['meta_ads', false],
      ['google_analytics', false],
      ['tiendanube', false],
    ]);
  });

  it('devuelve copias: una pantalla no puede alterar el mock compartido', async () => {
    const [primera] = await getIntegraciones();
    primera.conectada = true;
    expect((await getIntegraciones())[0].conectada).toBe(false);
  });
});

describe('redirecciones de next.config', () => {
  it('/onboarding lleva a Mi perfil, de forma temporal (H-E1-102)', async () => {
    const { default: nextConfig } = await import('../../next.config');
    await expect(nextConfig.redirects?.()).resolves.toContainEqual({
      source: '/onboarding',
      destination: '/app/perfil',
      permanent: false,
    });
  });
});
