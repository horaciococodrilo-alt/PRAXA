import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/modules/integrations/actions', () => ({ sincronizarMeta: vi.fn(), confirmarCuentaMeta: vi.fn(), desconectarMeta: vi.fn() }));
const formStatus = vi.hoisted(() => ({ pending: false }));
vi.mock('react-dom', async (original) => ({ ...(await original<typeof import('react-dom')>()), useFormStatus: () => formStatus }));

import { MetaSyncButton, MetaSyncPanel } from '@/app/(app)/app/integraciones/meta-sync-control';
import { MetaTarjeta } from '@/app/(app)/app/integraciones/meta-tarjeta';
import type { MetaCoverageRow, MetaSyncStatus, MetaSyncView } from '@/modules/integrations/meta/insights';

const MANUAL = 'La sincronización es manual. Los datos se actualizan cuando pulsás Sincronizar ahora; no se recolectan automáticamente.';
const REF = '11111111-1111-4111-8111-111111111111';
const OTHER_REF = '22222222-2222-4222-8222-222222222222';

const level = (status: string, reason: string | null = null, stamp = true) => ({ status, reason,
  fetched_at: stamp ? '2026-10-03T12:00:00.000000Z' : null, finished_at: stamp ? '2026-10-03T12:00:05.000000Z' : null });

function status(over: Partial<MetaSyncStatus> = {}, levels: Record<string, unknown> = {}): MetaSyncStatus {
  return { has_attempt: true, effective_status: 'completed', connection_changed: false,
    summary: { version: 1, credential_generation: 0, window_from: '2026-10-01', window_to: '2026-10-03', max_window_days: 28,
      started_at: '2026-10-03T12:00:00.000Z', lease_expires_at: '2026-10-03T12:05:00.000Z', finished_at: '2026-10-03T12:00:06.000Z',
      status: 'completed', levels: { account: level('complete', 'complete'), campaign: level('complete', 'complete'),
        adset: level('complete', 'complete'), ad: level('complete', 'complete'), ...levels } as never }, ...over };
}

function cell(over: Partial<MetaCoverageRow> = {}): MetaCoverageRow {
  return { day: '2026-10-02', level: 'campaign', entity_ref: REF, parent_ref: null, name: 'Campaña <b>uno</b>', effective_status: 'PAUSED',
    objective: 'OUTCOME_SALES', metadata_fetched_at: '2026-10-03T12:00:00.000Z', presence: 'con_datos', spend: '0', impressions: null,
    reach: '10', clicks: null, inline_link_clicks: null, ctr: '0.100', cpc: null, cpm: null, frequency: null,
    actions: [{ action_type: 'tipo.desconocido', variant: 'value', count: '1.5', value: null }],
    attribution: { known: false, report_time: 'impression', unified: true, settings: [] }, currency: 'USD', timezone: 'UTC',
    snapshot_id: REF, fetched_at: '2026-10-03T12:00:00.000Z', captured_before_day_end: false, temporal_status: 'cerrado', ...over };
}

function view(over: Partial<MetaSyncView> = {}): MetaSyncView {
  return { connectionStatus: 'active', canSync: true, status: status(), level: 'campaign', entityRef: null,
    entities: [{ entity_ref: REF, level: 'campaign', parent_ref: null, name: 'Campaña <b>uno</b>', effective_status: 'PAUSED',
      objective: 'OUTCOME_SALES', metadata_fetched_at: '2026-10-03T12:00:00.000Z', captured_at: '2026-10-03T12:00:00.000Z' }],
    coverage: [cell()], ...over };
}

beforeEach(() => { formStatus.pending = false; });

describe('M16c-T-27: sincronización en la tarjeta y el panel', () => {
  it('el botón existe solo en una conexión activa, y las props siguen siendo opcionales', () => {
    const activa = { kind: 'activa' as const, maskedId: '…0001', currency: 'USD', timezone: 'UTC' };
    const { rerender } = render(<MetaTarjeta state={activa} syncControl={<MetaSyncButton />} />);
    expect(screen.getByRole('button', { name: 'Sincronizar ahora' })).toBeEnabled();
    rerender(<MetaTarjeta state={activa} />);
    expect(screen.queryByRole('button', { name: 'Sincronizar ahora' })).toBeNull();
    rerender(<MetaTarjeta state={{ kind: 'requiere_reauth', maskedId: '…0001', currency: 'USD', timezone: 'UTC', errorClass: 'authentication' }}
      syncControl={<MetaSyncButton />} />);
    expect(screen.queryByRole('button', { name: 'Sincronizar ahora' })).toBeNull();
  });

  it('muestra el pendiente con el estado del formulario', () => {
    formStatus.pending = true;
    render(<MetaSyncButton />);
    const button = screen.getByRole('button', { name: 'Sincronizando…' });
    expect(button).toBeDisabled();
  });

  it('muestra siempre el aviso manual y cuatro resultados por nivel', () => {
    render(<MetaSyncPanel view={view()} notice={null} />);
    expect(screen.getByText(MANUAL)).toBeInTheDocument();
    const levels = screen.getByRole('list', { name: 'Resultado por nivel' });
    expect(within(levels).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Cuenta'), expect.stringContaining('Campañas'), expect.stringContaining('Conjuntos'), expect.stringContaining('Anuncios')]);
    expect(levels).toHaveTextContent('Completo');
  });

  it('un run parcial no se presenta como completo y distingue fallido de no intentado', () => {
    const partial = status({ effective_status: 'partial' }, { campaign: level('failed', 'meta_error'), adset: level('incomplete', 'page_limit'), ad: level('not_attempted', null, false) });
    render(<MetaSyncPanel view={view({ status: partial })} notice={null} />);
    const levels = screen.getByRole('list', { name: 'Resultado por nivel' });
    expect(levels).toHaveTextContent('Cuenta: Completo');
    expect(levels).toHaveTextContent('Campañas: Falló');
    expect(levels).toHaveTextContent('Conjuntos: Incompleto');
    expect(levels).toHaveTextContent('Anuncios: No se intentó');
    expect(screen.getByText(/último intento quedó parcial/i)).toBeInTheDocument();
    expect(screen.queryByText(/último intento se completó/i)).toBeNull();
  });

  it.each([['expired'], ['connection_changed']] as const)('en %s los pendientes quedan sin resultado confirmado', (effective) => {
    const stale = status({ effective_status: effective }, { ad: level('pending', null, false) });
    render(<MetaSyncPanel view={view({ status: stale })} notice={null} />);
    expect(screen.getByRole('list', { name: 'Resultado por nivel' })).toHaveTextContent('Anuncios: Sin resultado confirmado');
  });

  it('un run vigente muestra sus niveles en curso', () => {
    const running = status({ effective_status: 'running' }, { ad: level('pending', null, false) });
    render(<MetaSyncPanel view={view({ status: running })} notice={null} />);
    expect(screen.getByRole('list', { name: 'Resultado por nivel' })).toHaveTextContent('Anuncios: En curso');
  });

  it('sin intentos lo dice, sin inventar resultados ni tabla', () => {
    render(<MetaSyncPanel view={view({ status: { has_attempt: false, summary: null, effective_status: 'never', connection_changed: false }, coverage: [], entities: [] })} notice={null} />);
    expect(screen.getByText('Todavía no sincronizaste.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Resultado por nivel' })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('el primer fallo muestra el resultado aunque no haya cobertura', () => {
    const failed = status({ effective_status: 'failed' }, { account: level('failed', 'meta_error'), campaign: level('not_attempted', null, false),
      adset: level('not_attempted', null, false), ad: level('not_attempted', null, false) });
    render(<MetaSyncPanel view={view({ status: failed, coverage: [cell({ presence: 'no_observado', entity_ref: null, name: null, spend: null, reach: null, ctr: null, actions: null, attribution: null, currency: null, timezone: null, snapshot_id: null, fetched_at: null, captured_before_day_end: null, metadata_fetched_at: null })] })} notice={null} />);
    expect(screen.getByRole('list', { name: 'Resultado por nivel' })).toHaveTextContent('Cuenta: Falló');
    expect(within(screen.getByRole('table')).getByText('No observado')).toBeInTheDocument();
  });

  it('distingue cero explícito, no informado, sin fila y no observado', () => {
    render(<MetaSyncPanel view={view({ coverage: [cell(),
      cell({ day: '2026-10-01', presence: 'sin_fila_reportada', spend: null, reach: null, ctr: null, actions: null }),
      cell({ day: '2026-09-30', presence: 'no_observado', entity_ref: null, name: null, spend: null, reach: null, ctr: null, actions: null, attribution: null, fetched_at: null, captured_before_day_end: null }),
    ] })} notice={null} />);
    const [, withData, withoutRow, unobserved] = screen.getAllByRole('row');
    expect(within(withData).getByText('Con datos')).toBeInTheDocument();
    expect(within(withData).getByText('USD 0')).toBeInTheDocument();
    expect(within(withData).getAllByText('No informado').length).toBeGreaterThan(0);
    expect(within(withoutRow).getByText('Sin fila reportada')).toBeInTheDocument();
    expect(within(withoutRow).queryByText('USD 0')).toBeNull();
    expect(within(unobserved).getByText('No observado')).toBeInTheDocument();
  });

  it('conserva el tipo de acción como identificador y no lo traduce', () => {
    render(<MetaSyncPanel view={view()} notice={null} />);
    expect(screen.getByText(/tipo\.desconocido.*conteo 1\.5/)).toBeInTheDocument();
    expect(screen.queryByText(/compra/i)).toBeNull();
  });

  it('la metadata del proveedor se escapa, y la presenta como capturada', () => {
    const { container } = render(<MetaSyncPanel view={view()} notice={null} />);
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getAllByText(/Campaña <b>uno<\/b>/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Estado al capturar: PAUSED/)).toBeInTheDocument();
  });

  it('declara atribución desconocida y captura parcial', () => {
    render(<MetaSyncPanel view={view({ coverage: [cell({ captured_before_day_end: true, temporal_status: 'abierto' })] })} notice={null} />);
    expect(screen.getByText('Atribución desconocida')).toBeInTheDocument();
    expect(screen.getByText(/Captura parcial/)).toBeInTheDocument();
    expect(screen.getByText(/Día abierto/)).toBeInTheDocument();
  });

  it('los selectores usan referencias opacas y GET, sin IDs externos', () => {
    const { container } = render(<MetaSyncPanel view={view({ entityRef: REF, entities: [...view().entities, { ...view().entities[0], entity_ref: OTHER_REF, name: 'Otra' }] })} notice={null} />);
    const form = screen.getByRole('form', { name: 'Elegir nivel y entidad' });
    expect(form).toHaveAttribute('method', 'get');
    const select = screen.getByLabelText('Entidad') as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toEqual(['', REF, OTHER_REF]);
    expect(select.value).toBe(REF);
    expect((screen.getByLabelText('Nivel') as HTMLSelectElement).value).toBe('campaign');
    expect(container.innerHTML).not.toContain('act_');
    expect(container.innerHTML).not.toContain('external');
    expect(container.innerHTML).not.toContain('ownership');
  });

  it('needs_reauth lee la cobertura con aviso de antigüedad, sin botón', () => {
    render(<MetaSyncPanel view={view({ connectionStatus: 'needs_reauth', canSync: false })} notice={null} />);
    expect(screen.getByText(/pueden estar desactualizados/)).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sincronizar ahora' })).toBeNull();
  });

  it('muestra el aviso recibido con su tono, y nada si es null', () => {
    const { rerender } = render(<MetaSyncPanel view={view()} notice={{ tone: 'error', text: 'Texto fijo de error.' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Texto fijo de error.');
    rerender(<MetaSyncPanel view={view()} notice={{ tone: 'ok', text: 'Texto fijo correcto.' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Texto fijo correcto.');
    rerender(<MetaSyncPanel view={view()} notice={null} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
