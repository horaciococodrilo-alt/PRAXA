import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/modules/integrations/actions', () => ({
  confirmarCuentaMeta: vi.fn(), desconectarMeta: vi.fn(),
}));

import { MetaTarjeta } from '@/app/(app)/app/integraciones/meta-tarjeta';
import buttonStyles from '@/components/app/app.module.css';
import cardStyles from '@/components/app/integraciones.module.css';
import type { MetaCardState } from '@/modules/integrations/lifecycle';

const base = { kind: 'pendiente' as const, pendingExpiresAt: '2026-10-17T10:00:00.000Z',
  accounts: [{ selectionKey: 'a'.repeat(64), name: 'Cuenta sintética', maskedId: '…0001',
    currency: 'USD', timezone: 'UTC' }], discarded: 0, listError: null };

// Textos fijados por la spec de M16.2 (§15) para `activa` y `requiere_reauth`.
const RETENTION = 'Se borran la credencial y los datos de esta conexión de la base activa. Esta acción no se puede deshacer. Si el proyecto usa Supabase Pro, las copias nocturnas pueden conservarlos hasta 7 días.';
const DISCONNECT_HELP = 'Desconectar no quita a Praxa de tu negocio en Meta. Para hacerlo, entrá a la configuración de tu negocio en Meta, a las integraciones o apps conectadas, y quitá a Praxa.';

/**
 * El control que purga la conexión: un `DisclosureButton` dentro de un detalle cerrado, y
 * adentro del mismo detalle los textos del estado y el único botón destructivo. Devuelve el
 * detalle para aserciones propias del estado.
 */
function expectConfirmedPurge(summaryText: string, confirmText: string, texts: (string | RegExp)[]) {
  const summary = screen.getByText(summaryText, { selector: 'summary span' }).closest('summary');
  expect(summary).toHaveClass(buttonStyles.disclosure);
  const face = summary?.firstElementChild;
  expect(face).toHaveClass(buttonStyles.btn, buttonStyles.small, cardStyles.act);
  expect(face?.querySelector(`svg.${buttonStyles.disclosureIcon}`)).not.toBeNull();
  const details = summary?.closest('details');
  expect(details).toBeTruthy();
  expect(details).not.toHaveAttribute('open');
  const destructive = screen.getByRole('button', { name: confirmText });
  expect(destructive.closest('details')).toBe(details);
  expect(destructive).toHaveClass(buttonStyles.small, buttonStyles.danger, cardStyles.act);
  for (const text of texts) expect(details).toHaveTextContent(text);
  expect(document.querySelectorAll(`.${buttonStyles.danger}`)).toHaveLength(1);
  return details as HTMLDetailsElement;
}

describe('M16.2: tarjeta de Meta', () => {
  it('T-27 conecta solo sin conexión', () => {
    const { container } = render(<MetaTarjeta state={{ kind: 'sin_conexion' }} />);
    const button = screen.getByRole('button', { name: 'Conectar' });
    expect(button).toBeEnabled();
    const form = button.closest('form');
    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.getAttribute('action')).toBe('/api/integraciones/meta/iniciar');
    expect(button).toHaveClass(buttonStyles.small, cardStyles.act);
    expect(form).toHaveClass(cardStyles.actForm);
    expect(container.innerHTML).not.toContain('act_90001');
  });

  it('T-27 exige selección explícita aun con una cuenta', () => {
    const { container } = render(<MetaTarjeta state={base} />);
    const radio = screen.getByRole('radio') as HTMLInputElement;
    expect(radio.name).toBe('cuenta');
    expect(radio.checked).toBe(false);
    const confirm = screen.getByRole('button', { name: 'Confirmar cuenta' });
    expect(confirm).toHaveClass(buttonStyles.small, cardStyles.act);
    expect(confirm.closest('form')).toHaveClass(cardStyles.actForm);
    expect(confirm).not.toHaveClass(buttonStyles.danger);
    const details = expectConfirmedPurge('Cancelar conexión', 'Sí, cancelar conexión', [
      /Se descarta la conexión pendiente/, /credencial/, /base activa/, /conectarla de nuevo/,
      /Supabase Pro/, /hasta 7 días/, /apps conectadas/,
    ]);
    expect(details).not.toHaveTextContent(/desconect/i);
    expect(details).not.toHaveTextContent(/no se puede deshacer/);
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
    const details = expectConfirmedPurge('Desconectar', 'Sí, desconectar', [RETENTION, DISCONNECT_HELP]);
    expect(details).not.toHaveTextContent(/conexión pendiente/);
  });

  it.each(['user_action', 'permission'] as const)('T-28 requiere reautorización por %s', (errorClass) => {
    render(<MetaTarjeta state={{ kind: 'requiere_reauth', maskedId: '…0001', currency: 'USD',
      timezone: 'UTC', errorClass }} />);
    const button = screen.getByRole('button', { name: 'Volver a autorizar' });
    expect(button.closest('form')?.getAttribute('action')).toBe('/api/integraciones/meta/iniciar');
    expect(button).toHaveClass(buttonStyles.small, cardStyles.act);
    expect(button.closest('form')).toHaveClass(cardStyles.actForm);
    expect(button).not.toHaveClass(buttonStyles.danger);
    expect(screen.getByText('Requiere autorización')).toBeInTheDocument();
    expect(expectConfirmedPurge('Desconectar', 'Sí, desconectar', [RETENTION, DISCONNECT_HELP]))
      .not.toContainElement(button);
  });

  // jsdom no aplica hojas de estilo: esta prueba fija que existan las reglas de las que
  // dependen el marcador oculto, el foco visible y los estados del botón destructivo.
  it('T-28 conserva las reglas de estilo del resumen y del botón destructivo', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/components/app/app.module.css'), 'utf8')
      .replace(/\s+/g, ' ');
    for (const rule of [
      '.root .btn:focus-visible,', '.root .disclosure:focus-visible {',
      '.disclosure { display: block; list-style: none;', '.disclosure::-webkit-details-marker { display: none; }',
      '.disclosure > .btn { display: flex; }', 'details[open] > .disclosure .disclosureIcon { transform: rotate(180deg); }',
      '.danger { border-color: var(--danger-text);', '@media (hover: hover) { .danger:hover {', '.danger:active {',
    ]) expect(css).toContain(rule);
  });
});
