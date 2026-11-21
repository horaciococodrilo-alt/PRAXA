'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { IconFlecha } from '@/components/app/icons';
import { IntegracionLogo } from '@/components/app/integracion-logo';
import i from '@/components/app/integraciones.module.css';
import { Badge, Button, DisclosureButton } from '@/components/app/ui';
import { desconectarTiendanube, pasoSincronizacionTiendanube } from '@/modules/integrations/actions';
import type { TiendanubeCardState } from '@/modules/integrations/tiendanube/analysis';
import { abrirGuiaIntegraciones } from './guia-integraciones';
import t from './tiendanube-tarjeta.module.css';

/**
 * Tarjeta de Tiendanube (M16e §5, etapa .4): conexión, sincronización y desconexión. El estado
 * de la sincronización se avisa arriba de la página (`estado-sincronizacion.tsx`); los paneles
 * de ventas, productos y cohortes se quitaron el 2026-11-21 por decisión del usuario.
 */

const START = '/api/integraciones/tiendanube/iniciar';
export const TN_RETENTION = 'Se borran la credencial y los datos de la tienda de la base activa: pedidos, catálogo y cohortes. Esta acción no se puede deshacer; para volver a usar Tiendanube hay que conectar y sincronizar de nuevo. Si el proyecto usa Supabase Pro, las copias nocturnas pueden conservarlos hasta 7 días.';
export const TN_UNINSTALL = 'Desconectar no desinstala la app: el acceso sigue habilitado en Tiendanube hasta que desinstales Praxa desde el administrador de tu tienda.';

function StartControl({ label }: { label: string }) {
  return (
    <form method="post" action={START} className={i.actForm}>
      <Button type="submit" variant="small" className={i.act}>
        <span>{label}</span>
        <IconFlecha size={13} stroke={2.1} />
      </Button>
    </form>
  );
}

const SYNC_RESULT = '/app/integraciones?tn_sync=';
const SYNC_LOGIN = '/login?next=%2Fapp%2Fintegraciones';
/** Tope de pasos de una pulsación, por si una tienda no terminara nunca. */
const MAX_PASOS = 60;

/** Una pulsación encadena los pasos parciales hasta terminar, con avance visible y opción de detener. */
function SyncControl() {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const detener = useRef(false);
  const corriendo = paso > 0;

  async function sincronizar() {
    detener.current = false;
    let resultado: string = 'error';
    for (let n = 1; n <= MAX_PASOS; n += 1) {
      setPaso(n);
      resultado = await pasoSincronizacionTiendanube();
      if (resultado !== 'parcial' || detener.current) break;
    }
    setPaso(0);
    router.replace(resultado === 'login' ? SYNC_LOGIN : `${SYNC_RESULT}${resultado}`);
  }

  return (
    <div className={i.actForm}>
      <Button type="button" variant="small" className={i.act} disabled={corriendo}
        onClick={() => { void sincronizar(); }}>
        {corriendo ? 'Sincronizando…' : 'Sincronizar ahora'}
      </Button>
      {corriendo ? <>
        <p role="status" aria-label="Avance de la sincronización">
          Sincronizando, paso {paso}. Sigue sola hasta terminar; no cierres esta página.
        </p>
        <Button type="button" variant="small" className={i.act} onClick={() => { detener.current = true; }}>
          Detener
        </Button>
      </> : null}
    </div>
  );
}

function DisconnectControl() {
  return (
    <details>
      <DisclosureButton className={i.act}>Desconectar</DisclosureButton>
      <p>{TN_RETENTION}</p>
      <p>{TN_UNINSTALL}</p>
      <button type="button" className={t.enlace} onClick={() => abrirGuiaIntegraciones('desconectar')}>
        Ver cómo desinstalar Praxa de tu tienda
      </button>
      <form action={desconectarTiendanube} className={i.actForm}>
        <Button type="submit" variant="danger" className={i.act}>Sí, desconectar</Button>
      </form>
    </details>
  );
}

export function TiendanubeTarjeta({ state }: { state: TiendanubeCardState }) {
  const connected = state.kind === 'activa';
  return (
    <article className={i.card}>
      <div className={i.cardTop}>
        <span className={i.logo}><IntegracionLogo id="tiendanube" size={30} /></span>
        <div className={i.nm}>
          <h3>Tiendanube</h3>
          <p>Pedidos, productos<br />y clientes de tu tienda</p>
        </div>
      </div>
      <Badge on={connected} className={i.estado}>
        {state.kind === 'requiere_reauth' ? 'Requiere autorización' : connected ? 'Conectado' : 'No conectado'}
      </Badge>

      {state.kind === 'sin_empresa' ? (
        <p>Primero completá los datos de tu empresa en <a href="/app/configuracion">Configuración</a>.</p>
      ) : null}
      {state.kind === 'sin_conexion' ? <StartControl label="Conectar" /> : null}
      {state.kind === 'pendiente' ? (
        <p>Hay una conexión con Tiendanube en curso. Si no termina en unos minutos, se descarta sola y podés volver a conectar.</p>
      ) : null}
      {state.kind === 'activa' || state.kind === 'requiere_reauth' ? (
        <>
          <p>{state.dominio ? `Tienda ${state.dominio}` : 'Tienda conectada'} · {state.moneda} · {state.zona}</p>
          {state.aviso ? <p role={state.kind === 'requiere_reauth' ? 'alert' : 'status'}>{state.aviso}</p> : null}
          {state.kind === 'activa' ? (
            <SyncControl />
          ) : <StartControl label="Volver a autorizar" />}
          <DisconnectControl />
        </>
      ) : null}
      {state.kind === 'error' ? <p>No pudimos leer el estado de Tiendanube. Probá de nuevo más tarde.</p> : null}
    </article>
  );
}
