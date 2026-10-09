import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Nav } from '@/components/landing/nav';

/**
 * Menú móvil de la landing. En la referencia el botón no hacía nada: el menú tiene que
 * abrirse, anunciar su estado, cerrarse con Esc o con su botón y devolver el foco.
 */
describe('Nav de la landing', () => {
  it('abre el menú con las dos acciones y mueve el foco adentro', async () => {
    const user = userEvent.setup();
    render(<Nav />);

    const toggle = screen.getByRole('button', { name: 'Abrir menú' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('dialog', { name: 'Menú' });
    expect(toggle).toHaveAttribute('aria-controls', menu.id);
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toHaveFocus();
  });

  it('se cierra con Esc y devuelve el foco al botón', async () => {
    const user = userEvent.setup();
    render(<Nav />);
    const toggle = screen.getByRole('button', { name: 'Abrir menú' });

    await user.click(toggle);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('se cierra con su botón y devuelve el foco', async () => {
    const user = userEvent.setup();
    render(<Nav />);
    const toggle = screen.getByRole('button', { name: 'Abrir menú' });

    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Cerrar menú' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it('mantiene el foco dentro del menú con Tab y Shift+Tab', async () => {
    const user = userEvent.setup();
    render(<Nav />);
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));

    const cerrar = screen.getByRole('button', { name: 'Cerrar menú' });
    const crear = screen.getByRole('link', { name: 'Crear cuenta' });
    const iniciar = screen.getByRole('link', { name: 'Iniciar sesión' });

    await user.tab();
    expect(crear).toHaveFocus();
    await user.tab();
    expect(iniciar).toHaveFocus();
    await user.tab();
    expect(cerrar).toHaveFocus();
    await user.tab({ shift: true });
    expect(iniciar).toHaveFocus();
  });
});
