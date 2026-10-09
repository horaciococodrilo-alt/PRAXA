import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SignupPage from '@/app/(auth)/signup/page';

/**
 * Crear cuenta con un correo ya registrado. Supabase no envía correo en ese caso: la
 * pantalla tiene que avisarlo en vez de decir "Revisá tu correo" (riesgo aceptado H-E1-73).
 * El cliente de Supabase se simula: acá se prueba la pantalla, no la autenticación.
 */

const signUp = vi.fn();

vi.mock('@/lib/env', () => ({
  isSupabaseConfigured: () => true,
  getSiteUrl: () => 'http://localhost:3000',
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signUp: (...args: unknown[]) => signUp(...args) } }),
}));

async function completar() {
  const user = userEvent.setup();
  render(<SignupPage />);
  await user.type(screen.getByLabelText('Email'), 'persona@ejemplo.com');
  await user.type(screen.getByLabelText('Contraseña'), 'una-clave-larga');
  await user.click(screen.getByRole('button', { name: /Crear cuenta/ }));
}

describe('Crear cuenta', () => {
  beforeEach(() => signUp.mockReset());

  it('con un correo nuevo pide revisar el correo', async () => {
    signUp.mockResolvedValue({ data: { user: { identities: [{ id: 'x' }] } }, error: null });
    await completar();
    expect(await screen.findByRole('heading', { name: 'Revisá tu correo' })).toBeInTheDocument();
  });

  it('avisa que el correo ya tiene cuenta cuando Supabase devuelve un usuario sin identidades', async () => {
    signUp.mockResolvedValue({ data: { user: { identities: [] } }, error: null });
    await completar();
    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('Ese correo ya tiene una cuenta.');
    expect(within(aviso).getByRole('link', { name: 'Iniciá sesión' })).toHaveAttribute('href', '/login');
    expect(within(aviso).getByRole('link', { name: 'recuperá tu contraseña' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.queryByRole('heading', { name: 'Revisá tu correo' })).not.toBeInTheDocument();
  });

  it('avisa lo mismo cuando Supabase responde user_already_exists', async () => {
    signUp.mockResolvedValue({
      data: { user: null },
      error: { code: 'user_already_exists', message: 'User already registered' },
    });
    await completar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Ese correo ya tiene una cuenta.');
  });
});
