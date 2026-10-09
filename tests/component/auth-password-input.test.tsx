import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PasswordInput } from '@/components/auth/password-input';

describe('PasswordInput', () => {
  it.each(['icono', 'texto'] as const)('muestra y oculta la contraseña (variante %s)', async (toggle) => {
    const user = userEvent.setup();
    render(
      <label>
        Contraseña
        <PasswordInput toggle={toggle} defaultValue="secreta123" />
      </label>,
    );

    const input = screen.getByLabelText('Contraseña');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});
