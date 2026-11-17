import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const sync = vi.fn();
const preview = vi.fn();
const navigate = vi.fn();
vi.mock('@/modules/integrations/actions', () => ({
  confirmarPropiedadGa4: vi.fn(), desconectarGa4: vi.fn(),
  previsualizarPropiedadGa4: (...args: unknown[]) => preview(...args),
  pasoSincronizacionGa4: (...args: unknown[]) => sync(...args),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: navigate }) }));

import { Ga4Panel, Ga4Tarjeta } from '@/app/(app)/app/integraciones/ga4-tarjeta';
import type { Ga4Data } from '@/modules/integrations/ga4/analysis';

const ACTIVE = { kind: 'activa' as const, name: 'Web sintética', currency: 'USD',
  timezone: 'UTC', notice: null };
function data(over: Partial<Ga4Data> = {}): Ga4Data {
  return {
    from: '2026-10-20', to: '2026-11-16', timezone: 'UTC', currency: 'USD',
    propertyName: 'Web sintética', coverageFrom: '2026-01-01', coverageThrough: '2026-11-16',
    lastStep: 'complete', lastError: null, fetchedAt: '2026-11-16T12:00:00Z',
    preflight: { trafico: { status: 'disponible', reason: null } }, mappingRule: null,
    traffic: [{ day: '2026-11-15', sessions: 0, activeUsers: 0, newUsers: 0,
      metaVisits: null, provisional: false, quality: { row_count: 0 }, sourceQuality: null }],
    sources: [], funnel: [], products: [], cohorts: [{ month: '2026-11-01', offset: 0,
      size: null, active: null, retention: null, absence: 'menos_de_5', sizeHidden: true,
      activeHidden: true, provisional: true, quality: { row_count: 1 } }],
    campaignMatches: [], unmatchedCampaignSessions: 0, unmatchedCampaignQualityFlags: [],
    unmappedViewPct: null, metaSpend: [], metaConnected: false, metaError: false,
    ...over,
  };
}

describe('M16f-T-07/T-08: Integraciones GA4', () => {
  it('muestra estados de conexión y encadena pasos parciales con tope', async () => {
    const { rerender } = render(<Ga4Tarjeta state={{ kind: 'sin_conexion' }} />);
    expect(screen.getByRole('button', { name: 'Conectar' }).closest('form'))
      .toHaveAttribute('action', '/api/integraciones/ga4/iniciar');
    rerender(<Ga4Tarjeta state={ACTIVE} />);
    sync.mockResolvedValueOnce('parcial').mockResolvedValueOnce('completa');
    await userEvent.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/integraciones?ga4_sync=completa'));
    expect(sync).toHaveBeenCalledTimes(2);
    const details = screen.getByText('Desconectar', { selector: 'summary span' }).closest('details')!;
    expect(within(details).getByRole('button', { name: 'Sí, desconectar' })).toBeInTheDocument();
    rerender(<Ga4Tarjeta state={{ ...ACTIVE, kind: 'requiere_reauth' }} />);
    expect(screen.getByRole('button', { name: 'Volver a autorizar' })).toBeInTheDocument();
  });

  it('separa cero medido, ausencia, cohortes ocultas y fuentes desconectadas', () => {
    render(<Ga4Panel data={data()} error={false} />);
    expect(screen.getAllByText(/0 · Cero medido/).length).toBeGreaterThan(0);
    expect(screen.getByText('Parcial')).toBeInTheDocument();
    expect(screen.getAllByText('menos de 5')).toHaveLength(2);
    expect(screen.getByText(/Conectá Meta para ver esta comparación/)).toBeInTheDocument();
    expect(screen.getByText(/separados de las cohortes de compradores/)).toBeInTheDocument();
  });

  it('H-E1-270: un día observado por Meta sin gasto no se rotula como falta de cobertura', () => {
    const traffic = ['2026-11-13', '2026-11-14', '2026-11-15'].map((day) => ({ day, sessions: 3, activeUsers: 2,
      newUsers: 1, metaVisits: 0, provisional: false, quality: { row_count: 3 }, sourceQuality: { row_count: 3 } }));
    const spend = (day: string, presence: string, value: string | null) => ({ day, spend: value,
      currency: value ? 'USD' : null, timezone: 'UTC', presence, fetchedAt: '2026-11-16T12:00:00Z' });
    render(<Ga4Panel data={data({ traffic, metaConnected: true, metaSpend: [
      spend('2026-11-13', 'sin_fila_reportada', null), spend('2026-11-14', 'con_datos', '12.5')] })} error={false} />);
    const table = screen.getByRole('region', { name: 'Comparación tráfico y gasto' });
    const rows = within(table).getAllByRole('row').slice(1).map((row) => row.textContent ?? '');
    expect(rows[0]).toContain('Meta no reportó gasto');
    expect(rows[0]).not.toContain('Sin cobertura');
    expect(rows[1]).toContain('12.5 USD');
    expect(rows[2]).toContain('Sin cobertura');
  });

  it('la selección pendiente exige vista previa y confirmación del sitio', async () => {
    preview.mockResolvedValueOnce({ name: 'Web sintética', maskedId: '***45',
      hosts: ['example.test'], storeHost: 'example.test', matchesStore: true });
    render(<Ga4Tarjeta state={{ kind: 'pendiente', listError: false,
      options: [{ selectionKey: 'clave-opaca', name: 'Web sintética', maskedId: '***45' }] }} />);
    await userEvent.click(screen.getByRole('radio', { name: /Web sintética/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Verificar propiedad' }));
    await vi.waitFor(() => expect(screen.getByText(/Flujo web: example\.test/)).toBeInTheDocument());
    expect(preview.mock.calls[0][0].get('propiedad')).toBe('clave-opaca');
    expect(screen.getByRole('checkbox', { name: /Confirmo que esta propiedad mide mi sitio/ }))
      .toBeRequired();
    expect(screen.getByText('Cancelar conexión', { selector: 'summary span' })).toBeInTheDocument();
  });
});
