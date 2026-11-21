import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const pasoSincronizacionTiendanube = vi.fn();
const navegar = vi.fn();
vi.mock('@/modules/integrations/actions', () => ({
  desconectarTiendanube: vi.fn(), sincronizarTiendanube: vi.fn(),
  pasoSincronizacionTiendanube: (...args: unknown[]) => pasoSincronizacionTiendanube(...args),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: navegar }) }));

import { GuiaIntegraciones, PASOS_CONECTAR, PASOS_DESCONECTAR, abrirGuiaIntegraciones } from
  '@/app/(app)/app/integraciones/guia-integraciones';
import { TN_RETENTION, TN_UNINSTALL, TiendanubeTarjeta } from
  '@/app/(app)/app/integraciones/tiendanube-tarjeta';
import { EstadoSincronizacion } from '@/app/(app)/app/integraciones/estado-sincronizacion';
import type { TiendanubeCardState, TiendanubeDatos } from '@/modules/integrations/tiendanube/analysis';

/**
 * M16e etapa .4 (paso 8): tarjeta y aviso de sincronización de Tiendanube (T-08, parte de componente) y guía de
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

describe('Integraciones: aviso de sincronización de Tiendanube (2026-11-21)', () => {
  const estado = (tiendanube: TiendanubeDatos | null, tiendanubeError = false) => (
    <EstadoSincronizacion meta={null} metaError={false} tiendanube={tiendanube} tiendanubeError={tiendanubeError}
      ga4={null} ga4Error={false} />
  );

  it('con los datos completos no avisa nada', () => {
    render(estado(datos()));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sin sincronizar, leyendo el histórico o confirmando lo reciente avisa qué falta', () => {
    const base = datos().estado!;
    const { rerender } = render(estado(datos({ estado: null })));
    expect(screen.getByRole('status')).toHaveTextContent('Tiendanube: todavía no sincronizaste la tienda.');
    rerender(estado(datos({ estado: { ...base, cubiertoHasta: null, backfillTerminado: false } })));
    expect(screen.getByRole('status')).toHaveTextContent('todavía se está leyendo el histórico');
    rerender(estado(datos({ estado: { ...base, cubiertoHasta: null, backfillTerminado: true } })));
    expect(screen.getByRole('status')).toHaveTextContent('el histórico ya está leído');
    rerender(estado(datos({ estado: { ...base, ultimaEjecucion: { ...base.ultimaEjecucion!, estado: 'incomplete' } } })));
    expect(screen.getByRole('status')).toHaveTextContent('la última sincronización no terminó');
  });

  it('un error de lectura se avisa como alerta', () => {
    render(estado(null, true));
    expect(screen.getByRole('alert')).toHaveTextContent('Tiendanube: no pudimos leer el estado');
  });

  it('ningún texto rotula una cifra como «ingreso neto» ni muestra importes cobrados', () => {
    render(<><TiendanubeTarjeta state={ACTIVA} />{estado(datos({ estado: null }))}<GuiaIntegraciones /></>);
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

describe('Sincronización que sigue sola hasta terminar (pedido del usuario, 2026-11-15)', () => {
  it('una pulsación encadena los pasos parciales, muestra el avance y termina en el resultado', async () => {
    pasoSincronizacionTiendanube.mockReset().mockResolvedValueOnce('parcial').mockResolvedValueOnce('parcial')
      .mockResolvedValueOnce('completa');
    navegar.mockReset();
    const user = userEvent.setup();
    render(<TiendanubeTarjeta state={ACTIVA} />);
    await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));
    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/app/integraciones?tn_sync=completa'));
    expect(pasoSincronizacionTiendanube).toHaveBeenCalledTimes(3);
  });

  it('muestra en qué paso va y se puede detener', async () => {
    let soltar: (v: string) => void = () => undefined;
    pasoSincronizacionTiendanube.mockReset().mockResolvedValueOnce('parcial')
      .mockImplementationOnce(() => new Promise((resolve) => { soltar = resolve; }));
    navegar.mockReset();
    const user = userEvent.setup();
    render(<TiendanubeTarjeta state={ACTIVA} />);
    await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));
    expect(await screen.findByRole('status', { name: 'Avance de la sincronización' })).toHaveTextContent('paso 2');
    await user.click(screen.getByRole('button', { name: 'Detener' }));
    await act(async () => { soltar('parcial'); });
    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/app/integraciones?tn_sync=parcial'));
    expect(pasoSincronizacionTiendanube).toHaveBeenCalledTimes(2);
  });

  it('un resultado que no es parcial corta enseguida (error, en curso o reautorización)', async () => {
    pasoSincronizacionTiendanube.mockReset().mockResolvedValueOnce('requiere_reauth');
    navegar.mockReset();
    const user = userEvent.setup();
    render(<TiendanubeTarjeta state={ACTIVA} />);
    await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));
    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/app/integraciones?tn_sync=requiere_reauth'));
    expect(pasoSincronizacionTiendanube).toHaveBeenCalledTimes(1);
  });

  it('sin sesión va al login', async () => {
    pasoSincronizacionTiendanube.mockReset().mockResolvedValueOnce('login');
    navegar.mockReset();
    const user = userEvent.setup();
    render(<TiendanubeTarjeta state={ACTIVA} />);
    await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }));
    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/login?next=%2Fapp%2Fintegraciones'));
  });
});
