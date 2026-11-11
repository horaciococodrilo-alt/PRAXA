import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Anomalias } from '@/components/app/anomalias';
import { AppShell } from '@/components/app/shell';
import { detectMetaAnomalies, type MetaAnomalyObservation, type MetaAnomalyView } from '@/modules/anomalies';

let pathname = '/app/anomalias';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/components/landing/fonts', () => ({ manrope: { variable: '' }, jetbrainsMono: { variable: '' } }));

const START = new Date('2026-10-01T00:00:00.000Z');

function observations(): MetaAnomalyObservation[] {
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(START);
    date.setUTCDate(date.getUTCDate() + index);
    return {
      day: date.toISOString().slice(0, 10),
      level: 'account',
      entityRef: 'internal-scope',
      entityName: 'Cuenta principal',
      presence: 'con_datos',
      temporalStatus: 'cerrado',
      capturedBeforeDayEnd: false,
      spend: index < 7 ? '100' : '150',
      impressions: '1000',
      clicks: index < 7 ? '100' : '60',
      purchases: '10',
      purchaseAttributionKey: 'known:test',
      currency: 'ARS',
      timezone: 'America/Argentina/Buenos_Aires',
      fetchedAt: '2026-10-15T12:00:00.000Z',
    };
  });
}

function ready(mode: 'real' | 'synthetic_demo' = 'real'): MetaAnomalyView {
  return {
    state: 'ready',
    lastSyncedAt: '2026-10-15T12:00:00.000Z',
    result: detectMetaAnomalies({ mode, generatedAt: '2026-10-15T13:00:00.000Z', observations: observations() }),
  };
}

describe('pantalla de anomalías', () => {
  it('sin conexión explica el paso siguiente', () => {
    render(<Anomalias view={{ state: 'not_connected', reason: 'missing' }} />);
    expect(screen.getByRole('heading', { name: 'Conectá Meta Ads' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver integraciones' })).toHaveAttribute('href', '/app/integraciones');
  });

  it('sin sincronización enlaza a Integraciones', () => {
    render(<Anomalias view={{ state: 'never_synced' }} />);
    expect(screen.getByRole('heading', { name: 'Sincronizá tus datos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a Integraciones' })).toHaveAttribute('href', '/app/integraciones');
  });

  it('con datos insuficientes ofrece el demo sin presentar resultados reales', () => {
    render(<Anomalias view={{
      state: 'insufficient_data',
      lastSyncedAt: '2026-10-15T12:00:00.000Z',
      result: detectMetaAnomalies({ mode: 'real', generatedAt: '2026-10-15T13:00:00.000Z', observations: [] }),
    }} />);
    expect(screen.getByRole('heading', { name: 'Todavía no hay datos suficientes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver demostración' })).toHaveAttribute('href', '/app/anomalias?ejemplo=1');
    expect(screen.queryByText('Datos simulados')).not.toBeInTheDocument();
  });

  it('el demo se identifica antes de las alertas y permite volver', () => {
    render(<Anomalias view={ready('synthetic_demo')} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Datos simulados');
    expect(status).toHaveTextContent('no corresponde a tu cuenta');
    const alerts = screen.getByRole('list', { name: 'Alertas detectadas' });
    expect(status.compareDocumentPosition(alerts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver a mis datos' })).toHaveAttribute('href', '/app/anomalias');
  });

  it('muestra métrica, alcance, severidad, comparación, períodos y evidencia', () => {
    render(<Anomalias view={ready()} />);
    const alerts = screen.getByRole('list', { name: 'Alertas detectadas' });
    const ctr = within(alerts).getByRole('article', { name: /CTR.*Cuenta principal/ });
    expect(within(ctr).getByText('Crítica')).toBeInTheDocument();
    expect(within(ctr).getByText('10,00 %')).toBeInTheDocument();
    expect(within(ctr).getByText('6,00 %')).toBeInTheDocument();
    expect(within(ctr).getByText('-40,0 %')).toBeInTheDocument();
    expect(within(ctr).getByText(/1 de oct de 2026.*7 de oct de 2026/i)).toBeInTheDocument();
    expect(within(ctr).getByText(/8 de oct de 2026.*14 de oct de 2026/i)).toBeInTheDocument();
    expect(within(ctr).getByText(/14 observaciones/)).toBeInTheDocument();
    expect(within(ctr).getByText(/CTR baja: atención desde 20 %, crítica desde 40 %/)).toBeInTheDocument();
    expect(screen.queryByText('internal-scope')).not.toBeInTheDocument();
  });

  it('sin alertas no afirma que todo funciona bien', () => {
    const stable = observations().map((item) => ({ ...item, spend: '100', clicks: '100' }));
    render(<Anomalias view={{
      state: 'ready',
      lastSyncedAt: '2026-10-15T12:00:00.000Z',
      result: detectMetaAnomalies({ mode: 'real', generatedAt: '2026-10-15T13:00:00.000Z', observations: stable }),
    }} />);
    expect(screen.getByRole('heading', { name: 'No detectamos cambios fuera de los umbrales' })).toBeInTheDocument();
    expect(screen.getByText(/no garantiza que todas las campañas estén funcionando bien/i)).toBeInTheDocument();
  });

  it('un error de lectura se muestra sin detalles internos', () => {
    render(<Anomalias view={{ state: 'unavailable' }} />);
    expect(screen.getByRole('heading', { name: 'No pudimos analizar tus datos' })).toBeInTheDocument();
    expect(screen.queryByText(/stack|supabase|postgres/i)).not.toBeInTheDocument();
  });
});

describe('navegación de anomalías', () => {
  it('agrega la sección y la marca como activa', () => {
    pathname = '/app/anomalias';
    render(
      <AppShell nombre="Persona" iniciales="P" foto={null} conectada="Meta Ads" configPendiente={false}>
        <h1>Contenido</h1>
      </AppShell>,
    );
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(within(nav).getByRole('link', { name: 'Anomalías' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Diagnóstico' })).not.toHaveAttribute('aria-current');
  });
});
