'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { IconFlecha } from '@/components/app/icons';
import { IntegracionLogo } from '@/components/app/integracion-logo';
import i from '@/components/app/integraciones.module.css';
import { Badge, Button, DisclosureButton } from '@/components/app/ui';
import { confirmarPropiedadGa4, desconectarGa4, pasoSincronizacionGa4,
  previsualizarPropiedadGa4 } from '@/modules/integrations/actions';
import type { Ga4CardState } from '@/modules/integrations/ga4/analysis';
import type { Ga4PropertyPreview } from '@/modules/integrations/ga4/selection';

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
