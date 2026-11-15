import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/modules/integrations/actions', () => ({
  desconectarTiendanube: vi.fn(), sincronizarTiendanube: vi.fn(),
}));

import { GuiaIntegraciones, PASOS_CONECTAR, PASOS_DESCONECTAR, abrirGuiaIntegraciones } from
  '@/app/(app)/app/integraciones/guia-integraciones';
import { MENOS_DE_5, TN_RETENTION, TN_UNINSTALL, TiendanubePanel, TiendanubeTarjeta } from
  '@/app/(app)/app/integraciones/tiendanube-tarjeta';
import type { TiendanubeCardState, TiendanubeDatos } from '@/modules/integrations/tiendanube/analysis';

/**
 * M16e etapa .4 (paso 8): tarjeta y panel de Tiendanube (T-08, parte de componente) y guía de
 * integraciones (DP-02, P-02). Datos sintéticos.
 */

const ACTIVA: TiendanubeCardState = { kind: 'activa', dominio: 'tienda-sintetica.test', moneda: 'ARS',
  zona: 'America/Argentina/Buenos_Aires', aviso: null };

function datos(over: Partial<TiendanubeDatos> = {}): TiendanubeDatos {
  return {
    estado: { fase: 'incremental', backfillTerminado: true, cubiertoHasta: '2026-11-12',
      ultimaEjecucion: { inicio: '2026-11-13T15:00:00.000Z', fin: '2026-11-13T15:01:00.000Z', estado: 'complete' },
      ultimaExtraccion: '2026-11-13T15:01:00.000Z', catalogoCompleto: '2026-11-13T15:01:00.000Z',
      zona: 'America/Argentina/Buenos_Aires' },
    ventas: { desde: '2026-10-01', hasta: '2026-11-13', filas: [
      { periodo: '2026-09-01', moneda: null, pagados: 0, sinCliente: 0, parciales: 0, cubierto: true },
      { periodo: '2026-10-01', moneda: 'ARS', pagados: 12, sinCliente: 3, parciales: 1, cubierto: true },
      { periodo: '2026-10-01', moneda: 'USD', pagados: 2, sinCliente: 0, parciales: 0, cubierto: true },
      { periodo: '2026-11-01', moneda: null, pagados: 0, sinCliente: 0, parciales: 0, cubierto: false },
    ] },
    productos: { desde: '2026-10-17', hasta: '2026-11-13', cubierto: true, filas: [
      { puesto: 1, nombre: 'Remera', sku: 'R-1', eliminado: false, unidades: 9 },
      { puesto: 2, nombre: 'Gorra', sku: null, eliminado: true, unidades: 4 },
    ] },
    cohortes: { desde: '2025-12-01', hasta: '2026-11-01', filas: [
      { mes: '2026-08-01', tamano: null, oculta: true, celdas: [] },
      { mes: '2026-09-01', tamano: 12, oculta: false, celdas: [
        { desplazamiento: 0, retencion: 1, oculta: false, parcial: false },
        { desplazamiento: 1, retencion: null, oculta: true, parcial: false },
        { desplazamiento: 2, retencion: 0.4167, oculta: false, parcial: true },
      ] },
    ] },
    ...over,
  };
}

describe('M16e-T-08: tarjeta de Tiendanube', () => {
  it('sin conexión: conecta con POST al inicio, sin otros controles', () => {
    render(<TiendanubeTarjeta state={{ kind: 'sin_conexion' }} />);
    const button = screen.getByRole('button', { name: 'Conectar' });
    const form = button.closest('form')!;
    expect(form).toHaveAttribute('method', 'post');
    expect(form).toHaveAttribute('action', '/api/integraciones/tiendanube/iniciar');
    expect(screen.getByText('No conectado')).toBeInTheDocument();
    expect(screen.queryByText('Desconectar')).toBeNull();
  });

  it('activa: tienda por su dominio, moneda y zona, sincronización manual y desconexión con instrucción de desinstalar', () => {
    render(<TiendanubeTarjeta state={ACTIVA} />);
    expect(screen.getByText('Conectado')).toBeInTheDocument();
    expect(screen.getByText(/Tienda tienda-sintetica\.test · ARS · America\/Argentina\/Buenos_Aires/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sincronizar ahora' })).toBeInTheDocument();
    const details = screen.getByText('Desconectar', { selector: 'summary span' }).closest('details')!;
    expect(details).not.toHaveAttribute('open');
    expect(details).toHaveTextContent(TN_RETENTION);
    expect(details).toHaveTextContent(TN_UNINSTALL);
    expect(within(details).getByRole('button', { name: 'Sí, desconectar' })).toBeInTheDocument();
  });

  it('requiere autorización: muestra el aviso y reautoriza; sin sincronizar', () => {
    render(<TiendanubeTarjeta state={{ ...ACTIVA, kind: 'requiere_reauth',
      aviso: 'Tiendanube rechazó la autorización. Volvé a conectar la tienda.' }} />);
    expect(screen.getByText('Requiere autorización')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Volvé a conectar la tienda');
    expect(screen.getByRole('button', { name: 'Volver a autorizar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sincronizar ahora' })).toBeNull();
  });

  it('pendiente, sin empresa y error tienen texto propio', () => {
    const { rerender } = render(<TiendanubeTarjeta state={{ kind: 'pendiente' }} />);
    expect(screen.getByText(/conexión con Tiendanube en curso/)).toBeInTheDocument();
    rerender(<TiendanubeTarjeta state={{ kind: 'sin_empresa' }} />);
    expect(screen.getByRole('link', { name: 'Configuración' })).toBeInTheDocument();
    rerender(<TiendanubeTarjeta state={{ kind: 'error' }} />);
    expect(screen.getByText(/No pudimos leer el estado de Tiendanube/)).toBeInTheDocument();
  });
});

describe('M16e-T-08: panel de Tiendanube', () => {
  it('distingue cero real (período cubierto sin ventas) de ausencia (sin datos) y marca lo parcial', () => {
    render(<TiendanubePanel datos={datos()} error={false} />);
    const filas = within(screen.getAllByRole('table')[0]).getAllByRole('row').slice(1);
    expect(filas.map((fila) => [...fila.querySelectorAll('td')].map((td) => td.textContent))).toEqual([
      ['sep 2026', 'Sin ventas', '0', '0', '0', 'Completo'],
      ['oct 2026', 'ARS', '12', '3', '1', 'Completo'],
      ['oct 2026', 'USD', '2', '0', '0', 'Completo'],
      ['nov 2026', 'Sin datos', '—', '—', '—', 'Parcial'],
    ]);
    expect(screen.getByText(/Pedidos pagados sin cliente identificado: 3 de 14/)).toBeInTheDocument();
    expect(screen.getByText(/Datos completos hasta el 12\/11\/2026/)).toBeInTheDocument();
  });

  it('cohortes: tamaño y celda menores que cinco se muestran como «menos de 5»; la oculta no tiene celdas', () => {
    render(<TiendanubePanel datos={datos()} error={false} />);
    const tabla = screen.getAllByRole('table')[2];
    const filas = within(tabla).getAllByRole('row').slice(1).map((fila) =>
      [...fila.querySelectorAll('td')].map((td) => td.textContent));
    expect(filas).toEqual([
      ['ago 2026', MENOS_DE_5, '—', '—', '—'],
      ['sep 2026', '12', '100%', MENOS_DE_5, '41,7% *'],
    ]);
    expect(screen.getByText(/Mes sin cobertura completa/)).toBeInTheDocument();
  });

  it('ranking por unidades, con el producto eliminado rotulado', () => {
    render(<TiendanubePanel datos={datos()} error={false} />);
    const filas = within(screen.getAllByRole('table')[1]).getAllByRole('row').slice(1).map((fila) =>
      [...fila.querySelectorAll('td')].map((td) => td.textContent));
    expect(filas).toEqual([['1', 'Remera', 'R-1', '9'], ['2', 'Gorra (producto eliminado)', '—', '4']]);
  });

  it('vacíos: sin sincronizar, sin ventas, sin unidades y sin cohortes no se presentan como cero', () => {
    render(<TiendanubePanel error={false} datos={datos({ estado: null,
      ventas: { desde: '2026-10-01', hasta: '2026-11-13', filas: [] },
      productos: { desde: '2026-10-17', hasta: '2026-11-13', cubierto: false, filas: [] },
      cohortes: { desde: '2025-12-01', hasta: '2026-11-01', filas: [] } })} />);
    expect(screen.getByText(/Todavía no sincronizaste la tienda/)).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay ventas sincronizadas.')).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay datos de productos para el período.')).toBeInTheDocument();
    expect(screen.getByText(/Todavía no hay cohortes/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('un error de lectura se informa y no se muestra como vacío', () => {
    render(<TiendanubePanel datos={null} error />);
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos leer los datos de Tiendanube');
  });

  it('ningún texto rotula una cifra como «ingreso neto» ni muestra importes cobrados', () => {
    render(<><TiendanubeTarjeta state={ACTIVA} /><TiendanubePanel datos={datos()} error={false} /><GuiaIntegraciones /></>);
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/ingreso neto/i);
    expect(text).not.toMatch(/cobrad/i);
    const guia = [...PASOS_CONECTAR, ...PASOS_DESCONECTAR].map((p) => `${p.titulo} ${String(p.texto)}`).join(' ');
    expect(guia).not.toMatch(/ingreso neto|tiempo real|autom[aá]tic/i);
  });
});

describe('M16e (DP-02): guía de integraciones', () => {
  it('el botón abre el modal en «Conectar», con cuatro pasos numerados', async () => {
    const user = userEvent.setup();
    render(<GuiaIntegraciones />);
    await user.click(screen.getByRole('button', { name: 'Ver guía de integraciones' }));
    const dialog = screen.getByRole('dialog', { name: 'Guía de integraciones' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('tab', { name: 'Conectar' })).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(4);
    expect(dialog).toHaveTextContent('La sincronización es manual');
  });

  it('cambia de página a «Desconectar» con la instrucción de desinstalar de Tiendanube y quitar a Praxa de Meta', async () => {
    const user = userEvent.setup();
    render(<GuiaIntegraciones />);
    await user.click(screen.getByRole('button', { name: 'Ver guía de integraciones' }));
    await user.click(screen.getByRole('tab', { name: 'Desconectar' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('tab', { name: 'Desconectar' })).toHaveAttribute('aria-selected', 'true');
    expect(dialog).toHaveTextContent('Desinstalá Praxa de tu tienda');
    expect(dialog).toHaveTextContent('administrador de tu tienda');
    expect(dialog).toHaveTextContent('Quitá el acceso en Meta');
  });

  it('cierra con «Entendido» y devuelve el foco al botón', async () => {
    const user = userEvent.setup();
    render(<GuiaIntegraciones />);
    const trigger = screen.getByRole('button', { name: 'Ver guía de integraciones' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('cierra con Escape y con la X, y devuelve el foco', async () => {
    const user = userEvent.setup();
    render(<GuiaIntegraciones />);
    const trigger = screen.getByRole('button', { name: 'Ver guía de integraciones' });
    await user.click(trigger);
    expect(screen.getByRole('button', { name: 'Entendido' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('el foco no sale del modal con Tab', async () => {
    const user = userEvent.setup();
    render(<GuiaIntegraciones />);
    await user.click(screen.getByRole('button', { name: 'Ver guía de integraciones' }));
    const dialog = screen.getByRole('dialog');
    for (let n = 0; n < 6; n += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('la desconexión de Tiendanube abre la guía en «Desconectar» y al cerrar vuelve el foco a ese control', async () => {
    const user = userEvent.setup();
    render(<><GuiaIntegraciones /><TiendanubeTarjeta state={ACTIVA} /></>);
    await user.click(screen.getByText('Desconectar', { selector: 'summary span' }));
    const link = screen.getByRole('button', { name: 'Ver cómo desinstalar Praxa de tu tienda' });
    await user.click(link);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('tab', { name: 'Desconectar' })).toHaveAttribute('aria-selected', 'true');
    await user.click(within(dialog).getByRole('button', { name: 'Entendido' }));
    expect(link).toHaveFocus();
  });

  it('abrirGuiaIntegraciones abre la página pedida', () => {
    render(<GuiaIntegraciones />);
    act(() => abrirGuiaIntegraciones('desconectar'));
    expect(screen.getByRole('tab', { name: 'Desconectar' })).toHaveAttribute('aria-selected', 'true');
  });
});
