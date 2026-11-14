import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Capa de datos de `/app` (`src/modules/app-data`). Supabase y la sesión se simulan: acá se
 * prueba qué se consulta y cómo se interpreta, no la base (eso es pgTAP).
 */

const ID = '00000000-0000-4000-8000-000000000001';

const from = vi.fn();
const eq = vi.fn();
const limit = vi.fn();
const maybeSingle = vi.fn();
const getUser = vi.fn();
const createSignedUrl = vi.fn();
const requireUser = vi.fn();
const requireTenantContext = vi.fn();
const readConnectionRecord = vi.fn();
const readDiagnosticStatus = vi.fn();
const readActionTypes = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/modules/identity/session', () => ({ requireUser: (p?: string) => requireUser(p) }));
vi.mock('@/modules/tenant/context', () => ({ requireTenantContext: () => requireTenantContext() }));
vi.mock('@/modules/diagnostics/eligibility', () => ({
  readDiagnosticStatus: (...args: unknown[]) => readDiagnosticStatus(...args),
  supabaseRpc: () => async () => ({ data: [], error: null }),
}));
vi.mock('@/modules/diagnostics/repository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/diagnostics/repository')>()),
  readActionTypes: (...args: unknown[]) => readActionTypes(...args),
}));
vi.mock('@/modules/integrations/repository/connections', () => ({
  readConnectionRecord: (...args: unknown[]) => readConnectionRecord(...args),
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    from: (t: string) => (from(t), { select: () => ({ eq: (...a: unknown[]) => (eq(...a), {
      limit: (n: number) => limit(n), maybeSingle: () => maybeSingle() }) }) }),
    auth: { getUser: () => getUser() },
    storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => createSignedUrl(...a) }) },
  }),
}));

const { configuracionPendiente, getDiagnostico, getIntegraciones, getUsuario } = await import('@/modules/app-data');

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: ID, email: 'ana@praxa.test' });
  requireTenantContext.mockResolvedValue({ user_id: ID, company_id: ID, role: 'owner', request_id: ID });
  readConnectionRecord.mockResolvedValue(null);
  readDiagnosticStatus.mockResolvedValue({ connection: null, settings: null, eligibility: null });
  readActionTypes.mockResolvedValue([]);
});

describe('getDiagnostico (M26a-T-29)', () => {
  const ACTIVE = { id: 'cc000000-0000-4000-8000-000000000001', status: 'active', credentialGeneration: 0 };

  it('lee la persistencia nueva bajo RLS y nunca consulta reports', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    readDiagnosticStatus.mockResolvedValue({ connection: ACTIVE, settings: null,
      eligibility: { eligible: false, reason: 'no_settings', available_at: null, sync_finished_at: null, window_to: null } });
    const vista = await getDiagnostico();
    expect(vista).toMatchObject({ estado: 'sin_objetivo', informe: null, objetivo: null });
    expect(from).toHaveBeenCalledWith('diagnostic_reports');
    expect(from).not.toHaveBeenCalledWith('reports');
    expect(eq).toHaveBeenCalledWith('company_id', ID);
  });

  it('sin conexión: estado sin_conexion y sin catálogo', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const vista = await getDiagnostico();
    expect(vista).toMatchObject({ estado: 'sin_conexion', opcionesObjetivo: [] });
    expect(readActionTypes).not.toHaveBeenCalled();
  });

  it('espera de 24 h con la fecha que calcula la base', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    readDiagnosticStatus.mockResolvedValue({ connection: ACTIVE,
      settings: { goal_kind: 'traffic', metric_ref: 'inline_link_clicks' },
      eligibility: { eligible: false, reason: 'too_soon', available_at: '2026-11-14T15:30:00.000000Z',
        sync_finished_at: null, window_to: null } });
    const vista = await getDiagnostico();
    expect(vista).toMatchObject({ estado: 'espera', motivo: 'too_soon', disponibleDesde: '2026-11-14T15:30:00.000000Z',
      objetivo: { goal_kind: 'traffic', metric_ref: 'inline_link_clicks' } });
  });

  it('un error de lectura no se disfraza de estado vacío', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    await expect(getDiagnostico()).rejects.toThrow(/No se pudo leer el diagnóstico/);
  });

  it('un informe ilegible tampoco se oculta como vacío', async () => {
    maybeSingle.mockResolvedValue({ data: { generated_at: 'x' }, error: null });
    await expect(getDiagnostico()).rejects.toThrow(/No se pudo leer el diagnóstico/);
  });

  it('sin empresa todavía: estado sin_empresa', async () => {
    const { NoCompanyError } = await import('@/modules/company/service');
    requireTenantContext.mockRejectedValueOnce(new NoCompanyError());
    await expect(getDiagnostico()).resolves.toMatchObject({ estado: 'sin_empresa', informe: null });
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

  it.each([
    ['active', true], ['pending_selection', false], ['needs_reauth', false],
  ])('T-46 Meta %s se proyecta como conectada=%s', async (status, connected) => {
    readConnectionRecord.mockResolvedValue({ status });
    expect((await getIntegraciones())[0].conectada).toBe(connected);
    expect((await getIntegraciones()).slice(1).map((item) => item.conectada)).toEqual([false, false]);
  });

  it('T-46 falla cerrado sin propagar errores de tenant ni lectura', async () => {
    requireTenantContext.mockRejectedValueOnce(new Error('sin empresa'));
    expect((await getIntegraciones())[0].conectada).toBe(false);
    readConnectionRecord.mockRejectedValueOnce(new Error('fallo sintético'));
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
