import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BasicBlock } from '@/components/chat/basic-block';
import type { BlockView } from '@/modules/chat/render';

function block(type: string): BlockView {
  return { type, title: 'Dato sintético', aria_label: 'Gráfico sintético',
    notes: [], series: [{ label: 'Valores', points: [
      { x: 'Primero', text: '12', ratio: 10000, absence: null },
      { x: 'Segundo', text: null, ratio: null, absence: 'no_observado' },
    ] }], table: { headers: ['Elemento', 'Valor'],
      rows: [['Primero', '12'], ['Segundo', 'No observado']] } };
}

describe('M25a-T-56/57: seis bloques básicos', () => {
  it.each(['tarjeta', 'lineas', 'barras', 'barras_agrupadas', 'dona', 'tabla'])(
    '%s conserva faltantes y tabla equivalente', async (type) => {
      const user = (await import('@testing-library/user-event')).default.setup();
      render(<BasicBlock block={block(type)} />);
      expect(screen.getByText('Dato sintético')).toBeInTheDocument();
      expect(screen.getByText('No observado')).toBeInTheDocument();
      expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
      if (type !== 'tabla' && type !== 'tarjeta') {
        expect(screen.getByRole('img', { name: 'Gráfico sintético' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Ver datos' }));
        expect(screen.getByRole('table')).toHaveTextContent('Primero');
      } else {
        expect(screen.getByRole('table')).toHaveTextContent('Segundo');
      }
    },
  );

  it('líneas deja un hueco visual y dona usa proporciones del DTO', () => {
    const { container, rerender } = render(<BasicBlock block={block('lineas')} />);
    expect(container.querySelector('svg[aria-hidden="true"] polyline')).toBeInTheDocument();
    expect(container.querySelectorAll('svg circle')).toHaveLength(1);
    rerender(<BasicBlock block={block('dona')} />);
    expect(container.querySelector('[data-chart-type="dona"]')).toHaveStyle({
      backgroundImage: expect.stringContaining('conic-gradient'),
    });
  });
});
