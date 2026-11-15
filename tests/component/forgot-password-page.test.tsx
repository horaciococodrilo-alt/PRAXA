import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ForgotPasswordPage from '@/app/(auth)/forgot-password/page';

/**
 * Recuperar el acceso con un correo sin cuenta avisa que no existe, en lugar de «Revisá tu
 * correo» (decisión del usuario, riesgo aceptado H-E1-259, como H-E1-73 en el registro).
 * La consulta y el envío se simulan: acá se prueba la pantalla.
 */

const correoTieneCuenta = vi.fn();
const enviarEnlaceDeContrasena = vi.fn();

vi.mock('@/lib/env', () => ({ isSupabaseConfigured: () => true }));
vi.mock('@/modules/identity/recovery', () => ({
  correoTieneCuenta: (...args: unknown[]) => correoTieneCuenta(...args),
}));
vi.mock('@/components/auth/recovery', () => ({
  enviarEnlaceDeContrasena: (...args: unknown[]) => enviarEnlaceDeContrasena(...args),
}));

async function pedir(email: string) {
  const user = userEvent.setup();
  render(<ForgotPasswordPage />);
  await user.type(screen.getByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));
  return user;
}

describe('H-E1-259: recuperar el acceso avisa si el correo no tiene cuenta', () => {
  beforeEach(() => {
    correoTieneCuenta.mockReset();
    enviarEnlaceDeContrasena.mockReset().mockResolvedValue(null);
  });

  it('un correo sin cuenta muestra el aviso, no envía nada y deja corregirlo', async () => {
    correoTieneCuenta.mockResolvedValue('no_existe');
    const user = await pedir('persona@gmial.com');
    expect(await screen.findByText(/No hay ninguna cuenta con ese correo/)).toBeInTheDocument();
    expect(screen.queryByText('Revisá tu correo')).not.toBeInTheDocument();
    expect(enviarEnlaceDeContrasena).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Creá una cuenta' })).toHaveAttribute('href', '/signup');
    const campo = screen.getByLabelText('Email');
    expect(campo).toHaveValue('persona@gmial.com');
    await user.clear(campo);
    expect(screen.queryByText(/No hay ninguna cuenta con ese correo/)).not.toBeInTheDocument();
  });

  it('un correo con cuenta envía el enlace y muestra «Revisá tu correo»', async () => {
    correoTieneCuenta.mockResolvedValue('existe');
    await pedir('persona@ejemplo.com');
    expect(await screen.findByText('Revisá tu correo')).toBeInTheDocument();
    expect(correoTieneCuenta).toHaveBeenCalledWith('persona@ejemplo.com');
    expect(enviarEnlaceDeContrasena).toHaveBeenCalledWith('persona@ejemplo.com');
  });

  it('si la comprobación falla, no bloquea la recuperación: envía y responde como antes', async () => {
    correoTieneCuenta.mockResolvedValue('desconocido');
    await pedir('persona@ejemplo.com');
    expect(await screen.findByText('Revisá tu correo')).toBeInTheDocument();
    expect(enviarEnlaceDeContrasena).toHaveBeenCalledTimes(1);
  });

  it('un error del envío se muestra como antes', async () => {
    correoTieneCuenta.mockResolvedValue('existe');
    enviarEnlaceDeContrasena.mockResolvedValue('No pudimos enviar el enlace. Intentá de nuevo en unos minutos.');
    await pedir('persona@ejemplo.com');
    expect(await screen.findByText(/No pudimos enviar el enlace/)).toBeInTheDocument();
  });
});
