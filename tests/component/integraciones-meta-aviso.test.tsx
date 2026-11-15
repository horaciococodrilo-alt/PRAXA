import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * M16.1-T-23: el resultado del callback de Meta se muestra en `/app/integraciones` con un
 * texto de la lista cerrada (D-M16.1-01). La página verifica la sesión antes de leer
 * `searchParams`, como exige `app-paginas-sesion.test.tsx`.
 */

const requireAppSession = vi.fn();

vi.mock('@/modules/app-data', () => ({
  requireAppSession: (ruta: string) => requireAppSession(ruta),
  getIntegraciones: async () => [
    {
      id: 'meta_ads',
      nombre: 'Meta Ads',
      descripcion: ['Campañas de Facebook', 'e Instagram'],
      conectada: false,
    },
    { id: 'google_analytics', nombre: 'Google Analytics', descripcion: ['Analítica', 'web'], conectada: false },
    { id: 'tiendanube', nombre: 'Tiendanube', descripcion: ['Tienda', 'online'], conectada: false },
  ],
}));
vi.mock('@/modules/integrations/lifecycle', () => ({ loadMetaCardState: async () => ({ kind: 'sin_conexion' }) }));
vi.mock('@/modules/integrations/actions', () => ({ confirmarCuentaMeta: vi.fn(), desconectarMeta: vi.fn(),
  desconectarTiendanube: vi.fn(), sincronizarTiendanube: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/modules/integrations/tiendanube/analysis', () => ({
  loadTiendanubeView: async () => ({ tarjeta: { kind: 'sin_conexion' }, datos: null, error: false }) }));
vi.mock('@/modules/integrations/tiendanube/oauth', () => ({ TIENDANUBE_OAUTH_MESSAGES: {},
  parseTiendanubeOAuthOutcome: () => null }));
vi.mock('@/modules/integrations/tiendanube/sync', () => ({ TN_SYNC_MESSAGES: {}, parseTiendanubeSyncResult: () => null }));
vi.mock('@/modules/integrations/meta/insights', () => ({ loadMetaSyncView: async () => null,
  parseMetaSyncResult: () => null, syncNotice: () => null }));

const { default: IntegracionesPage } = await import('@/app/(app)/app/integraciones/page');
const { META_OAUTH_MESSAGES } = await import('@/modules/integrations/meta/outcomes');

type Params = Record<string, string | string[] | undefined>;

async function renderPage(searchParams: Params) {
  const ui = await IntegracionesPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  } as Parameters<typeof IntegracionesPage>[0]);
  return render(ui);
}

describe('aviso del resultado de Meta en /app/integraciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAppSession.mockResolvedValue(undefined);
  });

  it('cancelado se muestra como estado', async () => {
    await renderPage({ meta: 'cancelado' });
    expect(requireAppSession).toHaveBeenCalledWith('/app/integraciones');
    expect(screen.getByRole('status')).toHaveTextContent(META_OAUTH_MESSAGES.cancelado.text);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('error se muestra como alerta', async () => {
    await renderPage({ meta: 'error' });
    expect(screen.getByRole('alert')).toHaveTextContent(META_OAUTH_MESSAGES.error.text);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each([
    ['un valor desconocido', { meta: 'desconocido' }],
    ['meta repetido', { meta: ['pendiente', 'error'] }],
    ['sin meta', {}],
  ] as Array<[string, Params]>)('%s no muestra aviso', async (_name, params) => {
    await renderPage(params);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    for (const { text } of Object.values(META_OAUTH_MESSAGES)) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
  });

  it('ningún otro parámetro de la URL aparece en la página', async () => {
    const { container } = await renderPage({
      meta: 'cancelado',
      code: 'codigo-sint',
      state: 'estado-sint',
      error_description: 'texto-inyectado',
    });
    for (const valor of ['codigo-sint', 'estado-sint', 'texto-inyectado']) {
      expect(container.textContent).not.toContain(valor);
    }
  });

  it('Conectar Meta y Tiendanube están habilitados (M16e); Google Analytics sigue deshabilitado', async () => {
    await renderPage({ meta: 'pendiente' });
    const buttons = screen.getAllByRole('button', { name: 'Conectar' });
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toBeEnabled();
    expect(buttons[1]).toBeEnabled();
    expect(buttons[1].closest('form')).toHaveAttribute('action', '/api/integraciones/tiendanube/iniciar');
    expect(buttons[2]).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ver guía de integraciones' })).toBeEnabled();
  });

  it('sin sesión rechaza antes de leer searchParams', async () => {
    const sinSesion = new Error('SIN_SESION');
    requireAppSession.mockRejectedValue(sinSesion);
    const searchParams = vi.fn(async () => ({ meta: 'error' }));
    const props = {
      params: Promise.resolve({}),
      get searchParams() {
        return searchParams();
      },
    } as unknown as Parameters<typeof IntegracionesPage>[0];
    await expect(IntegracionesPage(props)).rejects.toBe(sinSesion);
    expect(searchParams).not.toHaveBeenCalled();
  });
});
