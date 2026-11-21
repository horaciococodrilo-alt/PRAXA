/* eslint-disable @typescript-eslint/no-explicit-any -- los fixtures se mutan a mano para probar estados */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Clientes } from '@/components/customer-insights/clientes';
import { customerInsightsViewSchema, type CustomerInsightsView } from '@/modules/customer-insights/contract';
import { buildAudienceProposals } from '@/modules/customer-insights/proposals';

/**
 * M27a-T-10, T-14, T-15 y la parte automatizable de T-18: pantalla `/app/clientes` por estado,
 * moneda, frescura, privacidad visible y propuestas. Datos sintéticos.
 */

vi.mock('server-only', () => ({}));

const NOW = Date.parse('2026-11-16T12:00:00.000Z');
const SEGMENTS = ['inactivos', 'riesgo', 'nuevos', 'alto_valor', 'frecuentes', 'potencial'] as const;

function m(value: string | null, unit: string, definition: string, absence: string | null = null) {
  return { value, absence: value === null ? absence : null, unit, definition };
}

function data(opts: { money?: boolean; fetchedAt?: string; privacy?: boolean; productA?: string } = {}) {
  const money = opts.money ?? true;
  const cells = (month: string) => Array.from({ length: 13 }, (_, k) => {
    const [y, mo] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, mo - 1 + k, 1));
    const state = k < 2 ? 'value' : k < 4 ? 'privacidad' : 'periodo_abierto';
    const v = (value: string, unit: string, def: string, isMoney = false) => state !== 'value' ? m(null, unit, def, state)
      : isMoney && !money ? m(null, unit, def, 'monetario_no_validado') : m(value, unit, def);
    return { offset: k, calendarMonth: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      activeCustomers: v(k === 0 ? '12' : '7', 'customers', 'cohort_active_v1'),
      retention: v(k === 0 ? '1' : '0.583333', 'ratio', 'cohort_retention_v1'),
      repeatPurchaseCumulative: v('0.416667', 'ratio', 'cohort_repeat_cumulative_v1'),
      observedValue: v('1234.5', 'currency', 'cohort_observed_value_v1', true),
      ticket: v('77.15625', 'currency', 'cohort_ticket_v1', true),
      observedValuePerCustomerCumulative: v('102.875', 'currency', 'cohort_observed_value_per_customer_cumulative_v1', true),
      meanDaysBetweenPurchases: v('21.5', 'days', 'cohort_mean_days_between_purchases_v1'),
      repeatCustomers: v('5', 'customers', 'cohort_repeat_customers_v1'),
      purchaseIntervals: v('6', 'intervals', 'cohort_purchase_intervals_v1') };
  });
  const segments = !money ? { status: 'unavailable', absence: 'monetario_no_validado', definition: 'segment_partition_v1' }
    : opts.privacy ? { status: 'unavailable', absence: 'privacidad', definition: 'segment_partition_v1' }
      : {
        status: 'available', totalCustomers: m('41', 'customers', 'segment_total_customers_v1'),
        excludedBeforeWindow: m(null, 'customers', 'excluded_before_window_v1', 'privacidad'),
        rows: SEGMENTS.map((code, i) => {
          const n = ['8', '6', '0', '5', '9', '13'][i];
          const empty = n === '0';
          const per = (value: string, unit: string, def: string) => empty ? m(null, unit, def, 'sin_denominador') : m(value, unit, def);
          return { code, customers: m(n, 'customers', 'segment_customers_v1'), orders: m(empty ? '0' : '20', 'orders', 'segment_orders_v1'),
            monetary: m(empty ? '0' : '15000.5', 'currency', 'segment_monetary_v1'),
            monetaryPerCustomer: per('1875.0625', 'currency', 'segment_monetary_per_customer_v1'),
            monetaryPerOrder: per('750.025', 'currency', 'segment_monetary_per_order_v1'),
            recencyMedianDays: per('44.5', 'days', 'segment_recency_median_days_v1'),
            frequencyMean: per('2.5', 'orders_per_customer', 'segment_frequency_mean_v1') };
        }),
      };
  const crossSell = money && !opts.privacy ? {
    status: 'available', sourceSegment: 'frecuentes', productAName: opts.productA ?? 'Taza sintética',
    productBName: 'Plato sintético', coPurchaseSufficient: true, targetSufficient: true, identifiedCustomers: null,
    identifiedCustomersAbsence: 'privacidad', definition: 'cross_sell_pair_v1',
  } : { status: 'unavailable', absence: money ? 'privacidad' : 'monetario_no_validado', definition: 'cross_sell_pair_v1' };
  return {
    ruleset: 'rfm_v1', source: 'tiendanube', asOfDay: '2026-11-15', fetchedAt: opts.fetchedAt ?? '2026-11-16T10:00:00.000Z',
    timezone: 'America/Argentina/Buenos_Aires', currency: 'ARS', rfmFrom: '2025-11-16', firstPurchaseBasis: 'observada',
    quality: { coverage: { fromDay: null, throughDay: '2026-11-15', complete: true }, identity: 'completa',
      monetary: money ? { status: 'verified', definition: 'tn_paid_current_observed_v1' } : { status: 'unverified', definition: null },
      catalog: 'completo', orderLines: 'completas' },
    segments,
    cohorts: { status: 'available', rows: [
      { cohortMonth: '2026-09', size: m('12', 'customers', 'cohort_size_observed_v1'), cells: cells('2026-09') },
      { cohortMonth: '2026-08', size: m('12', 'customers', 'cohort_size_observed_v1'), cells: cells('2026-08') },
    ] },
    productEvidence: { catalogComplete: true, linesComplete: true, crossSell },
  } as any;
}

function view(kind: CustomerInsightsView['kind'], d = data(), proposals?: unknown[]): CustomerInsightsView {
  const v = { kind, data: d, proposals: proposals ?? buildAudienceProposals(d), availableCurrencies: ['ARS', 'USD'],
    selectedCurrency: 'ARS' };
  const parsed = customerInsightsViewSchema.safeParse(v);
  if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues.slice(0, 3)));
  return parsed.data;
}

const empty = { availableCurrencies: [], selectedCurrency: null };
const ctx = { source: 'tiendanube', asOfDay: null, fetchedAt: null, timezone: null, currency: null, rfmFrom: null } as const;

describe('Clientes: estados sin datos (T-15)', () => {
  it.each([
    [{ kind: 'sin_empresa', ...empty }, 'Creá tu empresa para analizar tus clientes.', false],
    [{ kind: 'sin_conexion', actionHref: '/app/integraciones', ...empty }, 'Conectá Tiendanube para analizar tus clientes', true],
    [{ kind: 'requiere_reauth', actionHref: '/app/integraciones', ...empty }, 'Tiendanube rechazó el acceso. Volvé a conectar la tienda para analizar tus clientes.', true],
    [{ kind: 'actualizando', ...empty }, 'El análisis se está actualizando', false],
    [{ kind: 'sin_cobertura', context: ctx, actionHref: '/app/integraciones', ...empty }, 'Completá la sincronización para obtener cobertura', true],
    [{ kind: 'sin_compras', context: ctx, ...empty }, 'No hay compras elegibles en el período', false],
    [{ kind: 'error', ...empty }, 'No pudimos cargar el análisis', false],
  ] as Array<[CustomerInsightsView, string, boolean]>)('%s.kind muestra su mensaje fijo', (v, text, link) => {
    render(<Clientes view={v} nowMs={NOW} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    const action = screen.queryByRole('link', { name: /Integraciones/ });
    expect(action !== null).toBe(link);
    if (action) expect(action).toHaveAttribute('href', '/app/integraciones');
    expect(screen.queryByRole('button', { name: /Sincronizar/ })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('Clientes: análisis listo (T-14)', () => {
  it('fuente, período, corte, zona, moneda, frescura y calidad visibles', () => {
    render(<Clientes view={view('listo')} nowMs={NOW} />);
    const context = screen.getByRole('region', { name: 'Fuente y período' });
    for (const text of ['Tiendanube', '16 nov 2025', '15 nov 2026', 'America/Argentina/Buenos_Aires', 'ARS',
      'Primera compra observada']) {
      expect(within(context).getAllByText(new RegExp(text)).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/actividad de los últimos 365 días/)).toBeInTheDocument();
    expect(screen.queryByText(/más de 24 horas/)).toBeNull();
  });

  it('distribución de segmentos en una tabla con sus métricas y definiciones', () => {
    render(<Clientes view={view('listo')} nowMs={NOW} />);
    const table = screen.getByRole('table', { name: /Segmentos/ });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(7);
    expect(within(rows[1]).getByRole('rowheader')).toHaveTextContent('Inactivos');
    expect(within(table).getAllByText('15.000,50')).toHaveLength(5);
    expect(within(table).getAllByText('44,5')).toHaveLength(5);
    expect(within(rows[3]).getAllByText('Sin base para calcular').length).toBeGreaterThan(0);
  });

  it('matriz de cohortes accesible: celdas ocultas sin valor ni atributos que lo reconstruyan', () => {
    const { container } = render(<Clientes view={view('listo')} nowMs={NOW} />);
    const matrix = screen.getByRole('table', { name: /Retención por cohorte/ });
    expect(within(matrix).getAllByRole('columnheader').length).toBe(14);
    expect(within(matrix).getAllByText('Oculto').length).toBeGreaterThan(0);
    expect(within(matrix).getAllByText('Mes abierto').length).toBeGreaterThan(0);
    expect(within(matrix).getAllByText('58,3 %').length).toBe(2);
    expect(container.querySelectorAll('[title]')).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/data-value|aria-valuenow/);
  });

  it('el detalle de cada cohorte muestra todas las métricas válidas', () => {
    render(<Clientes view={view('listo')} nowMs={NOW} />);
    const detail = screen.getByRole('table', { name: /Cohorte sep 2026/ });
    for (const text of ['1.234,50', '77,16', '102,88', '21,5', '41,7 %']) {
      expect(within(detail).getAllByText(text).length).toBeGreaterThan(0);
    }
  });

  it('propuestas con todos sus campos, sin acción externa', () => {
    render(<Clientes view={view('listo')} nowMs={NOW} />);
    const list = screen.getByRole('region', { name: 'Propuestas de audiencias' });
    const cards = within(list).getAllByRole('article');
    expect(cards.length).toBe(7);
    const cross = cards.find((card) => within(card).queryByText('Venta cruzada observada'))!;
    expect(within(cross).getByText(/Taza sintética/)).toBeInTheDocument();
    expect(within(cross).getByText(/No se publica cuántos compradores/)).toBeInTheDocument();
    expect(within(cross).getByText('Oculto para proteger grupos pequeños')).toBeInTheDocument();
    for (const card of cards) {
      expect(within(card).getByText('Objetivo')).toBeInTheDocument();
      expect(within(card).getByText('Evidencia')).toBeInTheDocument();
      expect(within(card).getByText('Limitaciones')).toBeInTheDocument();
    }
    expect(within(list).queryByRole('button')).toBeNull();
    expect(within(list).queryByRole('link')).toBeNull();
  });

  it('un nombre de producto con HTML se muestra como texto', () => {
    const d = data({ productA: '<img src=x onerror=alert(1)>' });
    const { container } = render(<Clientes view={view('listo', d)} nowMs={NOW} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
  });
});

describe('Clientes: selector de moneda (T-03, T-15)', () => {
  it('formulario GET con ?currency=, etiquetado y operable con teclado', () => {
    render(<Clientes view={view('listo')} nowMs={NOW} />);
    const select = screen.getByLabelText('Moneda');
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveAttribute('name', 'currency');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['ARS', 'USD']);
    expect((select as HTMLSelectElement).value).toBe('ARS');
    const form = select.closest('form')!;
    expect(form).toHaveAttribute('method', 'get');
    expect(within(form).getByRole('button', { name: 'Ver' })).toBeInTheDocument();
    expect(form.innerHTML).not.toMatch(/company|connection/);
  });
});

describe('Clientes: frescura, Monetary y privacidad (T-15, D-M27a-08)', () => {
  it('más de 24 horas avisa; más de 7 días bloquea propuestas y conserva lo histórico', () => {
    const { unmount } = render(<Clientes view={view('listo', data({ fetchedAt: '2026-11-13T12:00:00.000Z' }))} nowMs={NOW} />);
    expect(screen.getByText(/más de 24 horas/)).toBeInTheDocument();
    expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
    unmount();
    const old = data({ fetchedAt: '2026-11-01T12:00:00.000Z' });
    render(<Clientes view={view('listo', old, [])} nowMs={NOW} />);
    expect(screen.getByText(/más de 7 días/)).toBeInTheDocument();
    expect(screen.getByText(/Las propuestas no se muestran/)).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /Segmentos/ })).toBeInTheDocument();
  });

  it('monetario no validado: mensaje, sin segmentos ni dinero, cohortes no monetarias visibles', () => {
    const d = data({ money: false });
    render(<Clientes view={view('monetario_no_validado', d)} nowMs={NOW} />);
    expect(screen.getByText('El componente monetario todavía no está validado')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /Segmentos/ })).toBeNull();
    const detail = screen.getByRole('table', { name: /Cohorte sep 2026/ });
    expect(within(detail).getAllByText('Monetario no validado').length).toBeGreaterThan(0);
    expect(within(detail).queryByText('1.234,50')).toBeNull();
    expect(within(detail).getAllByText('21,5').length).toBeGreaterThan(0);
  });

  it('privacidad: explica la ocultación sin total, porcentajes ni conteos', () => {
    const d = data({ privacy: true });
    render(<Clientes view={view('privacidad', d)} nowMs={NOW} />);
    expect(screen.getAllByText('No se muestran estos agregados para proteger grupos pequeños').length).toBeGreaterThan(0);
    expect(screen.queryByRole('table', { name: /Segmentos/ })).toBeNull();
    expect(screen.queryByText('41')).toBeNull();
  });
});
