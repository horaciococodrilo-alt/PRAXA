import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAppSession = vi.fn();
const getUso = vi.fn();
const getEmpresa = vi.fn();
const getIntegraciones = vi.fn();

vi.mock('@/modules/app-data', () => ({
  requireAppSession: (path: string) => requireAppSession(path),
  getUso: () => getUso(),
  getEmpresa: () => getEmpresa(),
  getIntegraciones: () => getIntegraciones(),
}));

const { default: UsoCostosPage } = await import('@/app/(app)/app/uso-y-costos/page');
const { default: InicioPage } = await import('@/app/(app)/app/page');

describe('M25a-T-71: aviso de consumo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAppSession.mockResolvedValue(undefined);
    getUso.mockResolvedValue({ resumen: { costoMesUsd: 0, consultas: 0,
      latenciaPromedioS: 0, costoPorConsultaUsd: 0 },
    costoDiario: [], rendimiento: { latenciaPromedioS: 0,
      latenciaP95S: 0, procesadasPct: 0, erroresPct: 0 } });
    getEmpresa.mockResolvedValue(null);
    getIntegraciones.mockResolvedValue([]);
  });

  it('Uso y costos muestra solo el aviso, sin KPIs, latencia ni gráfico', async () => {
    render(await UsoCostosPage());
    expect(requireAppSession).toHaveBeenCalledWith('/app/uso-y-costos');
    expect(screen.getByRole('heading', { name: 'Uso y costos' })).toBeInTheDocument();
    expect(screen.getByText('Todavía no disponible')).toBeInTheDocument();
    expect(getUso).not.toHaveBeenCalled();
    for (const text of ['Costo total este mes', 'Consultas totales',
      'Latencia promedio', 'Costo por día', 'Rendimiento de la IA']) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('img', { name: /costo por día/iu }))
      .not.toBeInTheDocument();
  });

  it('Inicio muestra la tarjeta Uso de la IA sin conteos ni costos', async () => {
    render(await InicioPage());
    expect(requireAppSession).toHaveBeenCalledWith('/app');
    const card = screen.getByRole('article', { name: 'Uso de la IA' });
    expect(within(card).getByText('Todavía no disponible')).toBeInTheDocument();
    expect(within(card).queryByText(/consultas|latencia|costo/iu))
      .not.toBeInTheDocument();
    expect(getUso).not.toHaveBeenCalled();
  });

  it.each([
    ['/app/uso-y-costos', UsoCostosPage], ['/app', InicioPage],
  ] as const)('%s exige sesión antes de cualquier lectura', async (path, page) => {
    const denied = new Error('SIN_SESION');
    requireAppSession.mockRejectedValueOnce(denied);
    await expect(page()).rejects.toBe(denied);
    expect(requireAppSession).toHaveBeenCalledWith(path);
    expect(getUso).not.toHaveBeenCalled();
    expect(getEmpresa).not.toHaveBeenCalled();
    expect(getIntegraciones).not.toHaveBeenCalled();
  });
});
