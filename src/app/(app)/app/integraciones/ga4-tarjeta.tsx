'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { cantidad, porcentaje } from '@/components/app/format';
import { IconFlecha } from '@/components/app/icons';
import { IntegracionLogo } from '@/components/app/integracion-logo';
import i from '@/components/app/integraciones.module.css';
import { Badge, Button, DisclosureButton } from '@/components/app/ui';
import { confirmarPropiedadGa4, desconectarGa4, pasoSincronizacionGa4,
  previsualizarPropiedadGa4 } from '@/modules/integrations/actions';
import type { Ga4CardState, Ga4Data } from '@/modules/integrations/ga4/analysis';
import type { Ga4PropertyPreview } from '@/modules/integrations/ga4/selection';
import { qualityFetchedAt, qualityFlags, readingState, type Ga4Quality } from
  '@/modules/integrations/ga4/view-model';
import t from './tiendanube-tarjeta.module.css';

const START = '/api/integraciones/ga4/iniciar';
const SYNC_URL = '/app/integraciones?ga4_sync=';
const LOGIN = '/login?next=%2Fapp%2Fintegraciones';
const MAX_STEPS = 20;
const RETENTION = 'Al desconectar se borran la credencial y los datos de Google Analytics de la base activa. No se pueden restaurar desde Praxa; para volver a usarlos hay que reconectar y sincronizar de nuevo. Si el proyecto usa Supabase Pro, las copias nocturnas pueden conservarlos hasta 7 días.';

function StartControl({ label }: { label: string }) {
  return <form method="post" action={START} className={i.actForm}>
    <Button type="submit" variant="small" className={i.act}>
      <span>{label}</span><IconFlecha size={13} stroke={2.1} />
    </Button>
  </form>;
}

function PendingProperty({ options, listError }: Extract<Ga4CardState, { kind: 'pendiente' }>) {
  const [selected, setSelected] = useState('');
  const [preview, setPreview] = useState<Ga4PropertyPreview | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  async function inspectSelected() {
    setLoading(true); setError(false); setPreview(null);
    const form = new FormData(); form.set('propiedad', selected);
    try { const result = await previsualizarPropiedadGa4(form);
      if (result) setPreview(result); else setError(true); }
    catch { setError(true); }
    setLoading(false);
  }
  if (listError) return <p role="alert">No pudimos listar las propiedades. Probá de nuevo más tarde.</p>;
  if (options.length === 0) return <p>Google no compartió propiedades web disponibles.</p>;
  return <div>
    <fieldset>
      <legend>Elegí la propiedad que mide tu sitio</legend>
      {options.map((option) => <label key={option.selectionKey}>
        <input type="radio" name="ga4_property" value={option.selectionKey}
          checked={selected === option.selectionKey} onChange={() => {
            setSelected(option.selectionKey); setPreview(null); setError(false);
          }} />
        {option.name ?? 'Propiedad sin nombre'} ({option.maskedId})
      </label>)}
    </fieldset>
    <Button type="button" variant="small" className={i.act} disabled={!selected || loading}
      onClick={() => { void inspectSelected(); }}>
      {loading ? 'Verificando…' : 'Verificar propiedad'}
    </Button>
    {error ? <p role="alert">No pudimos verificar esa propiedad. Elegí otra o probá de nuevo.</p> : null}
    {preview ? <div>
      <p>Propiedad: {preview.name ?? 'Sin nombre'} ({preview.maskedId})</p>
      <p>Flujo web: {preview.hosts.join(', ')}.</p>
      {preview.storeHost ? <p>Sitio de la tienda: {preview.storeHost}. {preview.matchesStore
        ? 'Coincide con el flujo web.' : 'No coincide automáticamente con el flujo web.'}</p> : null}
      <form action={confirmarPropiedadGa4} className={i.actForm}>
        <input type="hidden" name="propiedad" value={selected} />
        <label><input type="checkbox" name="sitio_confirmado" required />
          Confirmo que esta propiedad mide mi sitio y autorizo su lectura.</label>
        <Button type="submit" variant="small" className={i.act}>Conectar propiedad</Button>
      </form>
    </div> : null}
  </div>;
}

function SyncControl() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const stop = useRef(false);
  async function start() {
    stop.current = false;
    let result: Awaited<ReturnType<typeof pasoSincronizacionGa4>> = 'error';
    for (let n = 1; n <= MAX_STEPS; n += 1) {
      setStep(n);
      try { result = await pasoSincronizacionGa4(); }
      catch { result = 'error'; }
      if (result !== 'parcial' || stop.current) break;
    }
    setStep(0);
    router.replace(result === 'login' ? LOGIN : `${SYNC_URL}${result}`);
  }
  return <div className={i.actForm}>
    <Button type="button" variant="small" className={i.act} disabled={step > 0}
      onClick={() => { void start(); }}>{step ? 'Sincronizando…' : 'Sincronizar ahora'}</Button>
    {step ? <>
      <p role="status">Sincronizando, paso {step} de hasta {MAX_STEPS}. No cierres esta página.</p>
      <Button type="button" variant="small" className={i.act}
        onClick={() => { stop.current = true; }}>Detener</Button>
    </> : null}
  </div>;
}

function DisconnectControl({ pending = false }: { pending?: boolean }) {
  return <details>
    <DisclosureButton className={i.act}>{pending ? 'Cancelar conexión' : 'Desconectar'}</DisclosureButton>
    <p>{RETENTION}</p>
    <p>La desconexión es local. Para quitar el acceso en Google, hacelo desde tu cuenta de Google.</p>
    <form action={desconectarGa4} className={i.actForm}>
      <Button type="submit" variant="danger" className={i.act}>
        {pending ? 'Sí, cancelar conexión' : 'Sí, desconectar'}
      </Button>
    </form>
  </details>;
}

export function Ga4Tarjeta({ state }: { state: Ga4CardState }) {
  const active = state.kind === 'activa';
  return <article className={i.card}>
    <div className={i.cardTop}>
      <span className={i.logo}><IntegracionLogo id="google_analytics" size={30} /></span>
      <div className={i.nm}><h3>Google Analytics</h3>
        <p>Tráfico y comportamiento<br />de tu sitio</p></div>
    </div>
    <Badge on={active} className={i.estado}>
      {state.kind === 'requiere_reauth' ? 'Requiere autorización' : active ? 'Conectado' : 'No conectado'}
    </Badge>
    {state.kind === 'sin_empresa' ? <p>Completá los datos de tu empresa en Configuración.</p> : null}
    {state.kind === 'sin_conexion' ? <StartControl label="Conectar" /> : null}
    {state.kind === 'pendiente' ? <><PendingProperty {...state} /><DisconnectControl pending /></> : null}
    {state.kind === 'activa' || state.kind === 'requiere_reauth' ? <>
      <p>{state.name ?? 'Propiedad conectada'} · {state.timezone} · {state.currency}</p>
      {state.notice ? <p role={active ? 'status' : 'alert'}>{state.notice}</p> : null}
      {active ? <SyncControl /> : <StartControl label="Volver a autorizar" />}
      <DisconnectControl />
    </> : null}
    {state.kind === 'error' ? <p role="alert">No pudimos leer Google Analytics. Probá de nuevo más tarde.</p> : null}
    <p>En el piloto, Google puede pedir volver a conectar cada 7 días.</p>
  </article>;
}

const STATE_LABEL: Record<ReturnType<typeof readingState>, string> = {
  disponible: 'Medido', cero_medido: 'Cero medido', ausencia: 'Sin dato',
  parcial: 'Parcial', provisional: 'Provisional', restringido: 'Restringido',
  no_disponible: 'No disponible',
};
function valueText(value: number | null, q: Ga4Quality, provisional = false): string {
  const state = readingState({ value, quality: q, provisional });
  if (state === 'cero_medido') return '0 · Cero medido';
  if (value === null) return STATE_LABEL[state];
  return `${cantidad(value)} · ${STATE_LABEL[state]}${provisional && state !== 'provisional'
    ? ', provisional' : ''}`;
}
function flagsText(q: Ga4Quality): string {
  const flags = qualityFlags(q);
  return flags.length ? flags.join(', ') : 'sin banderas';
}
function dayText(day: string | null): string { return day ? day.split('-').reverse().join('/') : 'Ventana completa'; }

export function Ga4Panel({ data, error }: { data: Ga4Data | null; error: boolean }) {
  if (error) return <section role="alert"><p>No pudimos leer los datos de Google Analytics. Probá de nuevo más tarde.</p></section>;
  if (!data) return null;
  const spendByDay = new Map(data.metaSpend.map((row) => [row.day, row]));
  const preflight = Object.entries(data.preflight ?? {});
  return <section aria-label="Datos de Google Analytics">
    <h2>Google Analytics: {data.propertyName ?? 'propiedad conectada'}</h2>
    <p>Fuente: GA4 · Ventana: {dayText(data.from)} al {dayText(data.to)} · Zona: {data.timezone} · Moneda de la propiedad: {data.currency}.</p>
    <p>Cobertura: {data.coverageFrom && data.coverageThrough
      ? `${dayText(data.coverageFrom)} al ${dayText(data.coverageThrough)}` : 'todavía no disponible'}.
      Última extracción: {data.fetchedAt ?? 'aún no disponible'}.
      Último paso: {data.lastStep ?? 'sin sincronizar'}{data.lastError ? ` (${data.lastError})` : ''}.</p>
    <p className={t.nota}>Los últimos 3 días son provisionales. Las banderas de calidad se muestran por informe y ventana.</p>

    <section className={t.bloque} aria-label="Capacidades GA4">
      <h3>Disponibilidad de informes</h3>
      {preflight.length ? <ul>{preflight.map(([name, raw]) => {
        const capability = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        return <li key={name}>{name}: {capability.status === 'disponible' ? 'disponible'
          : `no disponible (${String(capability.reason ?? 'sin motivo')})`}</li>;
      })}</ul> : <p>Todavía no hay preflight. Sincronizá para verificar los informes.</p>}
    </section>

    <section className={t.bloque} aria-label="Tráfico GA4">
      <h3>Tráfico del sitio</h3>
      {data.traffic.length ? <div className={t.tablaWrap}><table className={t.tabla}>
        <thead><tr><th>Día GA4</th><th>Sesiones</th><th>Visitas desde Meta</th>
          <th>Usuarios activos</th><th>Usuarios nuevos</th><th>Calidad</th></tr></thead>
        <tbody>{data.traffic.map((row, n) => <tr key={`${row.day ?? 'vacio'}-${n}`}>
          <td>{dayText(row.day)}</td><td>{valueText(row.sessions, row.quality, row.provisional)}</td>
          <td>{valueText(row.metaVisits, row.sourceQuality, row.provisional)}</td>
          <td>{valueText(row.activeUsers, row.quality, row.provisional)}</td>
          <td>{valueText(row.newUsers, row.quality, row.provisional)}</td>
          <td>{flagsText(row.quality)} · {qualityFetchedAt(row.quality) ?? 'sin fecha'}</td>
        </tr>)}</tbody>
      </table></div> : <p>Sin cobertura de tráfico todavía; no se muestra cero.</p>}
      <p className={t.nota}>Los usuarios activos y nuevos son cifras diarias; no se suman entre días.</p>
    </section>

    <section className={t.bloque} aria-label="Fuentes GA4">
      <h3>Fuentes de tráfico</h3>
      {data.sources.length ? <div className={t.tablaWrap}><table className={t.tabla}>
        <thead><tr><th>Día</th><th>Fuente</th><th>Medio</th><th>Sesiones</th><th>Calidad</th></tr></thead>
        <tbody>{data.sources.slice(0, 20).map((row, n) => <tr key={`${row.day}-${row.source}-${n}`}>
          <td>{dayText(row.day)}</td><td>{row.source ?? 'Sin fuente'}</td><td>{row.medium ?? 'Sin medio'}</td>
          <td>{valueText(row.sessions, row.quality)}</td>
          <td>{flagsText(row.quality)} · {qualityFetchedAt(row.quality) ?? 'sin fecha'}</td>
        </tr>)}</tbody>
      </table></div> : <p>Sin fuentes disponibles.</p>}
      {data.sources.length > 20 ? <p>Se muestran las primeras 20 filas de la ventana.</p> : null}
    </section>

    <section className={t.bloque} aria-label="Embudo GA4">
      <h3>Embudo</h3>
      {data.funnel.length ? <div className={t.tablaWrap}><table className={t.tabla}>
        <thead><tr><th>Día</th><th>Evento</th><th>Conteo</th><th>Calidad</th></tr></thead>
        <tbody>{data.funnel.slice(0, 30).map((row, n) => <tr key={`${row.day}-${row.event}-${n}`}>
          <td>{dayText(row.day)}</td><td>{row.event ?? 'Sin evento'}</td>
          <td>{valueText(row.count, row.quality)}</td>
          <td>{flagsText(row.quality)} · {qualityFetchedAt(row.quality) ?? 'sin fecha'}</td>
        </tr>)}</tbody>
      </table></div> : <p>No disponible o sin cobertura; revisá el preflight.</p>}
    </section>

    <section className={t.bloque} aria-label="Productos GA4">
      <h3>Productos vistos frente a vendidos</h3>
      {!data.mappingRule ? <p>Los IDs de producto no coinciden. El ranking de GA4 y el de Tiendanube se muestran por separado.</p>
        : <p>Correspondencia por {data.mappingRule}. Las unidades son de Tiendanube; vistas, carritos y compras son de GA4.</p>}
      <p>Vistas observadas sin correspondencia: {data.unmappedViewPct === null ? 'sin datos'
        : porcentaje(data.unmappedViewPct)}. Incluye vistas sin ID de producto.</p>
      {data.products.length ? <div className={t.tablaWrap}><table className={t.tabla}>
        <thead><tr><th>Producto</th><th>Vistas GA4</th><th>Carritos GA4</th>
          <th>Compras GA4</th><th>Unidades Tiendanube</th><th>Calidad GA4</th></tr></thead>
        <tbody>{data.products.slice(0, 20).map((row) => <tr key={row.key}>
          <td>{row.name}</td><td>{cantidad(row.views)}</td><td>{cantidad(row.carts)}</td>
          <td>{cantidad(row.purchases)}</td><td>{row.tnUnits === null ? 'Desconocido' : cantidad(row.tnUnits)}</td>
          <td>{row.flags.length ? row.flags.join(', ') : 'sin banderas'} · {row.fetchedAt ?? 'sin fecha'}</td>
        </tr>)}</tbody>
      </table></div> : <p>No hay productos observados o el informe no está disponible.</p>}
    </section>

    <section className={t.bloque} aria-label="Cohortes de visitantes GA4">
      <h3>Visitantes por primera visita</h3>
      <p className={t.nota}>Mes N de GA4. Son visitantes del sitio, separados de las cohortes de compradores de Tiendanube.</p>
      {data.cohorts.length ? <div className={t.tablaWrap}><table className={t.tabla}>
        <thead><tr><th>Cohorte</th><th>Mes N</th><th>Tamaño</th><th>Activos</th>
          <th>Retención</th><th>Estado</th></tr></thead>
        <tbody>{data.cohorts.map((row) => <tr key={`${row.month}-${row.offset}`}>
          <td>{row.month}</td><td>{row.offset}</td>
          <td>{row.sizeHidden ? 'menos de 5' : row.size === null ? 'Sin dato' : cantidad(row.size)}</td>
          <td>{row.activeHidden ? 'menos de 5' : row.active === null ? 'Sin dato' : cantidad(row.active)}</td>
          <td>{row.sizeHidden || row.activeHidden || row.retention === null ? '—'
            : porcentaje(row.retention * 100)}</td>
          <td>{row.absence === 'aun_no_disponible' ? 'Aún no disponible'
            : row.absence ?? (row.provisional ? 'Provisional' : flagsText(row.quality))}
            {' · '}{qualityFetchedAt(row.quality) ?? 'sin fecha'}</td>
        </tr>)}</tbody>
      </table></div> : <p>Sin cobertura de cohortes todavía.</p>}
    </section>

    <section className={t.bloque} aria-label="Comparación tráfico y gasto">
      <h3>Visitas GA4 frente a gasto de Meta</h3>
      <p className={t.nota}>Asociación débil, sin causalidad. Cada fuente conserva su zona y moneda; no hay conversión ni cociente entre fuentes.</p>
      {!data.metaConnected ? <p>Conectá Meta para ver esta comparación.</p>
        : data.metaError ? <p role="alert">No pudimos leer el gasto de Meta.</p>
          : <div className={t.tablaWrap}><table className={t.tabla}>
            <thead><tr><th>Día GA4</th><th>Sesiones GA4</th><th>Visitas desde Meta GA4</th>
              <th>Gasto Meta</th><th>Zona Meta</th><th>Extracción Meta</th></tr></thead>
            <tbody>{data.traffic.filter((row) => row.day !== null).map((row) => {
              const meta = spendByDay.get(row.day!);
              return <tr key={row.day}>
                <td>{dayText(row.day)}</td><td>{valueText(row.sessions, row.quality, row.provisional)}</td>
                <td>{valueText(row.metaVisits, row.sourceQuality, row.provisional)}</td>
                {/* H-E1-270: un día que Meta observó sin fila no es falta de cobertura. */}
                <td>{!meta || meta.presence === 'no_observado' ? 'Sin cobertura'
                  : meta.spend === null ? (meta.presence === 'sin_fila_reportada'
                    ? 'Meta no reportó gasto' : 'Sin dato')
                    : `${meta.spend} ${meta.currency ?? 'moneda no disponible'}`}</td>
                <td>{meta?.timezone ?? 'Sin zona'}</td>
                <td>{meta?.fetchedAt ?? 'sin fecha'}</td>
              </tr>;
            })}</tbody>
          </table></div>}
    </section>

    <section className={t.bloque} aria-label="Comparación campañas">
      <h3>Campañas de Meta frente a tráfico GA4</h3>
      {!data.metaConnected ? <p>Sin correspondencia: Meta no está conectada.</p>
        : data.metaError ? <p role="alert">No pudimos leer las campañas de Meta.</p>
        : data.campaignMatches.length === 0 ? <p>Tus anuncios no tienen el ID de campaña en el UTM.</p>
          : <div className={t.tablaWrap}><table className={t.tabla}>
            <thead><tr><th>Día</th><th>Campaña</th><th>Sesiones GA4</th><th>Gasto Meta</th><th>Zona Meta</th><th>Calidad GA4</th><th>Extracción Meta</th></tr></thead>
            <tbody>{data.campaignMatches.slice(0, 20).map((row, n) => <tr key={`${row.day}-${row.name}-${n}`}>
              <td>{dayText(row.day)}</td><td>{row.name}</td><td>{cantidad(row.sessions)}</td>
              <td>{row.spend === null ? 'Sin cobertura' : `${row.spend} ${row.currency ?? ''}`}</td>
              <td>{row.timezone ?? 'Sin zona'}</td>
              <td>{row.qualityFlags.length ? row.qualityFlags.join(', ') : 'sin banderas'}
                {' · '}{row.ga4FetchedAt ?? 'sin fecha'}</td>
              <td>{row.metaFetchedAt ?? 'sin fecha'}</td>
            </tr>)}</tbody>
          </table></div>}
      {!data.metaError ? <p>Sesiones con UTM sin correspondencia: {cantidad(data.unmatchedCampaignSessions)}.
        Calidad GA4: {data.unmatchedCampaignQualityFlags.length
          ? data.unmatchedCampaignQualityFlags.join(', ') : 'sin banderas'}.</p> : null}
    </section>
  </section>;
}
