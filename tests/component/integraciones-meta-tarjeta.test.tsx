import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/modules/integrations/actions', () => ({
  confirmarCuentaMeta: vi.fn(), desconectarMeta: vi.fn(),
}));

import { MetaTarjeta } from '@/app/(app)/app/integraciones/meta-tarjeta';
import type { MetaCardState } from '@/modules/integrations/lifecycle';

const base = { kind: 'pendiente' as const, pendingExpiresAt: '2026-10-17T10:00:00.000Z',
  accounts: [{ selectionKey: 'a'.repeat(64), name: 'Cuenta sintética', maskedId: '…0001',
    currency: 'USD', timezone: 'UTC' }], discarded: 0, listError: null };

describe('M16.2: tarjeta de Meta', () => {
  it('T-27 conecta solo sin conexión', () => {
    const { container } = render(<MetaTarjeta state={{ kind: 'sin_conexion' }} />);
    const button = screen.getByRole('button', { name: 'Conectar' });
    expect(button).toBeEnabled();
    const form = button.closest('form');
    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.getAttribute('action')).toBe('/api/integraciones/meta/iniciar');
    expect(container.innerHTML).not.toContain('act_90001');
  });

  it('T-27 exige selección explícita aun con una cuenta', () => {
    const { container } = render(<MetaTarjeta state={base} />);
    const radio = screen.getByRole('radio') as HTMLInputElement;
    expect(radio.name).toBe('cuenta');
    expect(radio.checked).toBe(false);
    expect(screen.getByRole('button', { name: 'Confirmar cuenta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar conexión' })).toBeInTheDocument();
    expect(container.innerHTML).toContain('…0001');
    for (const secret of ['act_90001', 'negocio_sintetico', '5550001']) expect(container.innerHTML).not.toContain(secret);
  });

  it.each([
    [{ kind: 'sin_empresa' } as MetaCardState, 'Primero completá los datos de tu empresa'],
    [{ kind: 'error' } as MetaCardState, 'No pudimos leer el estado de Meta'],
  ])('T-27 muestra estados sin conexión', (state, message) => {
    render(<MetaTarjeta state={state} />);
    expect(screen.getByText(new RegExp(message))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Conectar' })).not.toBeInTheDocument();
  });

  it('T-28 activa permite desconectar e informa la retención', () => {
    render(<MetaTarjeta state={{ kind: 'activa', maskedId: '…0001', currency: 'USD', timezone: 'UTC' }} />);
    expect(screen.getByText('Conectado')).toBeInTheDocument();
    expect(screen.getByText(/base activa/)).toBeInTheDocument();
    expect(screen.getByText(/Supabase Pro/)).toBeInTheDocument();
    expect(screen.getByText(/hasta 7 días/)).toBeInTheDocument();
    expect(screen.getByText(/apps conectadas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sí, desconectar' })).toBeInTheDocument();
  });

  it.each(['user_action', 'permission'] as const)('T-28 requiere reautorización por %s', (errorClass) => {
    render(<MetaTarjeta state={{ kind: 'requiere_reauth', maskedId: '…0001', currency: 'USD',
      timezone: 'UTC', errorClass }} />);
    const button = screen.getByRole('button', { name: 'Volver a autorizar' });
    expect(button.closest('form')?.getAttribute('action')).toBe('/api/integraciones/meta/iniciar');
    expect(screen.getByText('Requiere autorización')).toBeInTheDocument();
    expect(screen.getByText(/apps conectadas/)).toBeInTheDocument();
    expect(screen.getByText(/base activa/)).toBeInTheDocument();
    expect(screen.getByText(/Supabase Pro/)).toBeInTheDocument();
    expect(screen.getByText(/hasta 7 días/)).toBeInTheDocument();
  });
});
