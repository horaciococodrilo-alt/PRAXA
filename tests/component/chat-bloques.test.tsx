import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

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

describe('M25a.3 T-56/57: catálogo completo', () => {
  it.each(['resumen_variacion', 'periodo_contra_periodo', 'barras_apiladas',
    'ranking', 'tabla_tendencia', 'tabla_desplegable', 'embudo',
    'calendario_calor', 'desglose_tipo_resultado', 'estado_datos',
    'conclusiones', 'fuentes_metodologia', 'preguntas_sugeridas'])(
    '%s identifica su variante y conserva tabla equivalente', async (type) => {
      const { container } = render(<BasicBlock block={block(type)} />);
      expect(container.querySelector(`[data-block-type="${type}"]`)).toBeInTheDocument();
      if (['barras_apiladas', 'tabla_tendencia', 'calendario_calor',
        'ranking', 'embudo'].includes(type)) {
        expect(screen.getByRole('img', { name: 'Gráfico sintético' })).toBeInTheDocument();
        const toggle = screen.getByRole('button', { name: 'Ver datos' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await userEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
      }
      expect(screen.getByRole('table')).toHaveTextContent('No observado');
    },
  );

  it('despliega los hijos por teclado y conserva el valor del padre', async () => {
    const parent = { ...block('tabla_desplegable'), children: [{ parent: 'Campaña',
      rows: [['Conjunto', '7']] }] };
    render(<BasicBlock block={parent} />);
    const toggle = screen.getByRole('button', { name: 'Ver detalle' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    toggle.focus();
    await userEvent.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Conjunto · 7/)).toBeInTheDocument();
  });

  it('copia una sugerencia fija y rotula una interpretación', async () => {
    const copy = vi.fn();
    render(<BasicBlock block={{ ...block('preguntas_sugeridas'),
      suggestions: [{ id: 'ver_en_tabla', text: 'Ver en tabla' }] }}
    onSuggestion={copy} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ver en tabla' }));
    expect(copy).toHaveBeenCalledWith('Ver en tabla');
    render(<BasicBlock block={{ ...block('conclusiones'), items: [{
      segments: [{ type: 'plain', text: 'Lectura orientativa.' }],
      provenance: 'Interpretación' }] }} />);
    expect(screen.getByText(/Interpretación:/)).toBeInTheDocument();
  });

  it('escala la altura de la pila y deja un hueco en la mini tendencia', () => {
    const stacked = { ...block('barras_apiladas'), stack_ratios: [7500, 0],
      series: [{ label: 'A', points: [
        { x: '01/01/2026', text: '1', ratio: 3333, absence: null },
        { x: '02/01/2026', text: null, ratio: null, absence: 'no_observado' }] },
      { label: 'B', points: [
        { x: '01/01/2026', text: '2', ratio: 6667, absence: null },
        { x: '02/01/2026', text: null, ratio: null, absence: 'no_observado' }] }] };
    const { container, rerender } = render(<BasicBlock block={stacked} />);
    const tracks = container.querySelectorAll('[data-chart-type="barras_apiladas"] [data-stack-height]');
    expect(tracks[0]).toHaveAttribute('data-stack-height', '7500');
    expect(tracks[1]).toHaveAttribute('data-stack-height', '0');
    expect(tracks[1]?.querySelectorAll('span')).toHaveLength(0);
    expect(container.querySelector('[data-chart-type="barras_apiladas"]'))
      .toHaveTextContent('Sin dato');
    rerender(<BasicBlock block={{ ...block('tabla_tendencia'), series: [{
      label: 'Campaña', points: [
        { x: '01/01/2026', text: '2', ratio: 10000, absence: null },
        { x: '02/01/2026', text: null, ratio: null, absence: 'no_observado' },
        { x: '03/01/2026', text: '1', ratio: 5000, absence: null }] }] }} />);
    expect(container.querySelectorAll('[data-chart-type="tabla_tendencia"] svg circle'))
      .toHaveLength(2);
    expect(container.querySelectorAll('[data-chart-type="tabla_tendencia"] svg polyline'))
      .toHaveLength(2);
  });

  it('distingue día ausente de valor bajo en calendario y muestra aviso del embudo', () => {
    const { container, rerender } = render(<BasicBlock block={block('calendario_calor')} />);
    const cells = container.querySelectorAll('[data-chart-type="calendario_calor"] span');
    expect(cells[0]).toHaveAttribute('data-intensity', '10000');
    expect(cells[1]).toHaveAttribute('data-intensity', 'missing');
    rerender(<BasicBlock block={{ ...block('embudo'),
      notes: ['Los pasos son conteos separados; no son tasas de paso.'] }} />);
    expect(screen.getByText(/conteos separados/)).toBeInTheDocument();
  });
});
