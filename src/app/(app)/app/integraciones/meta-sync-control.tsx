'use client';

import { useFormStatus } from 'react-dom';

import i from '@/components/app/integraciones.module.css';
import { Button } from '@/components/app/ui';
import { sincronizarMeta } from '@/modules/integrations/actions';
import type { MetaCoverageRow, MetaSyncStatus, MetaSyncView } from '@/modules/integrations/meta/insights';

const MANUAL = 'La sincronización es manual. Los datos se actualizan cuando pulsás Sincronizar ahora; no se recolectan automáticamente.';
const NO_INFO = 'No informado';

const LEVELS = [['account', 'Cuenta'], ['campaign', 'Campañas'], ['adset', 'Conjuntos'], ['ad', 'Anuncios']] as const;
const EFFECTIVE: Record<MetaSyncStatus['effective_status'], string> = {
  never: 'Todavía no sincronizaste.',
  running: 'Hay una sincronización en curso.',
  completed: 'El último intento se completó en los cuatro niveles.',
  partial: 'El último intento quedó parcial: revisá cada nivel.',
  failed: 'El último intento no pudo actualizar ningún nivel.',
  expired: 'El último intento no terminó y no tiene un resultado confirmado.',
  connection_changed: 'La conexión cambió durante el último intento.',
};
const REASONS: Record<string, string> = {
  page_limit: 'alcanzó un límite de páginas o de tamaño',
  duration_limit: 'alcanzó el límite de duración',
  invalid_response: 'Meta devolvió una respuesta inválida',
  meta_error: 'Meta devolvió un error',
  own_error: 'error interno',
};
const PRESENCE: Record<MetaCoverageRow['presence'], string> = {
  no_observado: 'No observado', sin_fila_reportada: 'Sin fila reportada', con_datos: 'Con datos',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="small" className={i.act} disabled={pending}>
      {pending ? 'Sincronizando…' : 'Sincronizar ahora'}
    </Button>
  );
}

export function MetaSyncButton() {
  return (
    <form action={sincronizarMeta} className={i.actForm}>
      <SubmitButton />
    </form>
  );
}

function levelText(status: string, effective: MetaSyncStatus['effective_status']): string {
  if (status === 'pending') {
    // Una llamada pudo quedar en vuelo: no se presenta como no intentado.
    return effective === 'running' ? 'En curso' : 'Sin resultado confirmado';
  }
  return { complete: 'Completo', incomplete: 'Incompleto', failed: 'Falló', not_attempted: 'No se intentó' }[status] ?? status;
}

function Metric({ row, value, prefix = '' }: { row: MetaCoverageRow; value: string | null; prefix?: string }) {
  if (row.presence !== 'con_datos') return <td>—</td>;
  return <td>{value === null ? NO_INFO : `${prefix}${value}`}</td>;
}

function CoverageRow({ row }: { row: MetaCoverageRow }) {
  return (
    <tr>
      <td>{row.day}</td>
      <td>{PRESENCE[row.presence]}</td>
      <td>
        {row.entity_ref === null ? '—' : (
          <>
            <div>{row.name ?? 'Sin nombre'}</div>
            {row.effective_status ? <div>Estado al capturar: {row.effective_status}</div> : null}
            {row.objective ? <div>Objetivo: {row.objective}</div> : null}
          </>
        )}
      </td>
      <Metric row={row} value={row.spend} prefix={row.currency ? `${row.currency} ` : ''} />
      <Metric row={row} value={row.impressions} />
      <Metric row={row} value={row.reach} />
      <Metric row={row} value={row.clicks} />
      <Metric row={row} value={row.inline_link_clicks} />
      <Metric row={row} value={row.ctr} />
      <Metric row={row} value={row.cpc} prefix={row.currency ? `${row.currency} ` : ''} />
      <Metric row={row} value={row.cpm} prefix={row.currency ? `${row.currency} ` : ''} />
      <Metric row={row} value={row.frequency} />
      <td>
        {row.actions && row.actions.length > 0 ? (
          <ul>
            {row.actions.map((action) => (
              <li key={`${action.action_type}:${action.variant}`}>
                {action.action_type} ({action.variant}):
                {action.count === null ? '' : ` conteo ${action.count}`}
                {action.value === null ? '' : ` valor ${action.value}`}
              </li>
            ))}
          </ul>
        ) : '—'}
      </td>
      <td>
        {row.attribution === null ? '—' : row.attribution.known
          ? `Atribución del conjunto (${row.attribution.settings.length} configuración/es)`
          : <span>Atribución desconocida</span>}
      </td>
      <td>
        <div>{row.temporal_status === 'abierto' ? 'Día abierto' : 'Día cerrado'}</div>
        {row.captured_before_day_end ? <div>Captura parcial</div> : null}
        {row.fetched_at ? <div>Capturado {row.fetched_at}</div> : null}
        {row.timezone ? <div>Zona {row.timezone}</div> : null}
      </td>
    </tr>
  );
}

export function MetaSyncPanel({ view, notice }: {
  view: MetaSyncView;
  notice: Readonly<{ tone: 'ok' | 'info' | 'error'; text: string }> | null;
}) {
  const { status, entities, coverage } = view;
  const summary = status.summary;
  return (
    <section className={i.sec} aria-labelledby="integraciones-meta-sync">
      <h2 id="integraciones-meta-sync">Datos de Meta Ads</h2>
      <p>{MANUAL}</p>
      {notice ? <p role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p> : null}
      {view.connectionStatus === 'needs_reauth' ? (
        <p>Estos datos pueden estar desactualizados hasta que vuelvas a autorizar a Praxa.</p>
      ) : null}
      <p>{EFFECTIVE[status.effective_status]}</p>

      {summary ? (
        <ul aria-label="Resultado por nivel">
          {LEVELS.map(([key, label]) => {
            const level = summary.levels[key];
            return (
              <li key={key}>
                {label}: {levelText(level.status, status.effective_status)}
                {level.reason && level.reason !== 'complete' ? ` (${REASONS[level.reason]})` : ''}
                {level.fetched_at ? ` · capturado ${level.fetched_at}` : ''}
              </li>
            );
          })}
        </ul>
      ) : null}

      {summary ? (
        <form method="get" action="/app/integraciones" aria-label="Elegir nivel y entidad">
          <label>
            Nivel{' '}
            <select name="nivel" defaultValue={view.level}>
              {LEVELS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>{' '}
          <label>
            Entidad{' '}
            <select name="entidad" defaultValue={view.entityRef ?? ''}>
              <option value="">Todas</option>
              {entities.map((entity) => (
                <option key={entity.entity_ref} value={entity.entity_ref}>{entity.name ?? 'Sin nombre'}</option>
              ))}
            </select>
          </label>{' '}
          <Button type="submit" variant="small">Ver</Button>
        </form>
      ) : null}

      {coverage.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>Presencia</th><th>Entidad</th><th>Gasto</th><th>Impresiones</th><th>Alcance</th>
                <th>Clics</th><th>Clics en enlace</th><th>CTR</th><th>CPC</th><th>CPM</th><th>Frecuencia</th>
                <th>Acciones</th><th>Atribución</th><th>Captura</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((row) => <CoverageRow key={`${row.day}:${row.entity_ref ?? 'sin-entidad'}`} row={row} />)}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
