import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/modules/integrations/actions', () => ({ sincronizarMeta: vi.fn(), confirmarCuentaMeta: vi.fn(), desconectarMeta: vi.fn() }));
const formStatus = vi.hoisted(() => ({ pending: false }));
vi.mock('react-dom', async (original) => ({ ...(await original<typeof import('react-dom')>()), useFormStatus: () => formStatus }));

import { EstadoSincronizacion } from '@/app/(app)/app/integraciones/estado-sincronizacion';
import { MetaSyncButton } from '@/app/(app)/app/integraciones/meta-sync-control';
import { MetaTarjeta } from '@/app/(app)/app/integraciones/meta-tarjeta';
import type { MetaCoverageRow, MetaSyncStatus, MetaSyncView } from '@/modules/integrations/meta/insights';

const REF = '11111111-1111-4111-8111-111111111111';

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

const base = { meta: null, metaError: false, tiendanube: null, tiendanubeError: false, ga4: null, ga4Error: false };

beforeEach(() => { formStatus.pending = false; });

describe('M16c-T-27: sincronización en la tarjeta y aviso arriba', () => {
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

  it('arriba avisa solo mientras Meta no terminó de sincronizar', () => {
    const props = (meta: MetaSyncView | null) => ({ ...base, meta });
    const { rerender } = render(<EstadoSincronizacion {...props(view())} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<EstadoSincronizacion {...props(view({ status: status({ effective_status: 'partial' }) }))} />);
    expect(screen.getByRole('status')).toHaveTextContent('Meta Ads: la última sincronización quedó incompleta.');
    rerender(<EstadoSincronizacion {...props(view({ status: status({ effective_status: 'never', has_attempt: false, summary: null }) }))} />);
    expect(screen.getByRole('status')).toHaveTextContent('Meta Ads: todavía no sincronizaste.');
    rerender(<EstadoSincronizacion {...props(view({ status: status({ effective_status: 'failed' }) }))} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Meta Ads: la última sincronización no pudo traer datos.');
    rerender(<EstadoSincronizacion {...props(null)} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('una reautorización pendiente o un error de lectura se avisan como alerta', () => {
    const { rerender } = render(<EstadoSincronizacion {...base} meta={view({ connectionStatus: 'needs_reauth', canSync: false })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('vuelvas a autorizar');
    rerender(<EstadoSincronizacion {...base} metaError />);
    expect(screen.getByRole('alert')).toHaveTextContent('Meta Ads: no pudimos leer el estado');
  });
});
