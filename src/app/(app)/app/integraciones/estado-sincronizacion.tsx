import { Card } from '@/components/app/ui';
import type { Ga4Data } from '@/modules/integrations/ga4/analysis';
import type { MetaSyncStatus, MetaSyncView } from '@/modules/integrations/meta/insights';
import type { TiendanubeDatos } from '@/modules/integrations/tiendanube/analysis';

/**
 * Avisos de sincronización arriba de Integraciones. Solo aparece una línea por cada fuente
 * conectada que todavía no tiene todos sus datos; con las tres completas no se muestra nada.
 * Reemplaza a los paneles de datos que había debajo de las tarjetas (decisión del usuario,
 * 2026-11-21): el dueño solo necesita saber si ya están todos los datos.
 */

type Aviso = Readonly<{ texto: string; error: boolean }>;

const META: Record<Exclude<MetaSyncStatus['effective_status'], 'completed'>, string> = {
  never: 'todavía no sincronizaste. Pulsá Sincronizar ahora en su tarjeta.',
  running: 'hay una sincronización en curso. Volvé cuando termine.',
  partial: 'la última sincronización quedó incompleta. Volvé a sincronizar para traer lo que falta.',
  failed: 'la última sincronización no pudo traer datos. Volvé a sincronizar.',
  expired: 'la última sincronización no terminó. Volvé a sincronizar.',
  connection_changed: 'la conexión cambió durante la última sincronización. Volvé a sincronizar.',
};

function avisoMeta(view: MetaSyncView | null, error: boolean): Aviso | null {
  if (error) return { texto: 'Meta Ads: no pudimos leer el estado de la sincronización. Probá de nuevo más tarde.', error: true };
  if (!view) return null;
  if (view.connectionStatus === 'needs_reauth') {
    return { texto: 'Meta Ads: los datos pueden estar desactualizados hasta que vuelvas a autorizar a Praxa.', error: true };
  }
  const estado = view.status.effective_status;
  return estado === 'completed' ? null : { texto: `Meta Ads: ${META[estado]}`, error: estado === 'failed' };
}

function avisoTiendanube(datos: TiendanubeDatos | null, error: boolean): Aviso | null {
  if (error) return { texto: 'Tiendanube: no pudimos leer el estado de la sincronización. Probá de nuevo más tarde.', error: true };
  const e = datos?.estado;
  if (!datos) return null;
  if (!e || !e.ultimaEjecucion) return { texto: 'Tiendanube: todavía no sincronizaste la tienda. Pulsá Sincronizar ahora en su tarjeta.', error: false };
  if (!e.cubiertoHasta && e.backfillTerminado) {
    return { texto: 'Tiendanube: el histórico ya está leído. Falta una sincronización más para confirmar los cambios recientes.', error: false };
  }
  if (!e.cubiertoHasta) return { texto: 'Tiendanube: todavía se está leyendo el histórico de la tienda. Seguí sincronizando hasta terminar.', error: false };
  if (e.ultimaEjecucion.estado === 'running') return { texto: 'Tiendanube: hay una sincronización en curso. Volvé cuando termine.', error: false };
  if (e.ultimaEjecucion.estado === 'incomplete' || e.ultimaEjecucion.estado === 'failed') {
    return { texto: 'Tiendanube: la última sincronización no terminó. Volvé a sincronizar para traer lo que falta.', error: e.ultimaEjecucion.estado === 'failed' };
  }
  return null;
}

function avisoGa4(data: Ga4Data | null, error: boolean): Aviso | null {
  if (error) return { texto: 'Google Analytics: no pudimos leer el estado de la sincronización. Probá de nuevo más tarde.', error: true };
  if (!data) return null;
  if (data.lastStep === null) return { texto: 'Google Analytics: todavía no sincronizaste. Pulsá Sincronizar ahora en su tarjeta.', error: false };
  if (data.lastStep === 'running') return { texto: 'Google Analytics: hay una sincronización en curso. Volvé cuando termine.', error: false };
  if (data.lastStep !== 'complete' || !data.coverageThrough) {
    return { texto: 'Google Analytics: la sincronización quedó incompleta. Volvé a sincronizar para traer lo que falta.', error: data.lastStep === 'failed' };
  }
  return null;
}

export function EstadoSincronizacion({ meta, metaError, tiendanube, tiendanubeError, ga4, ga4Error }: {
  meta: MetaSyncView | null; metaError: boolean;
  tiendanube: TiendanubeDatos | null; tiendanubeError: boolean;
  ga4: Ga4Data | null; ga4Error: boolean;
}) {
  const avisos = [avisoMeta(meta, metaError), avisoTiendanube(tiendanube, tiendanubeError), avisoGa4(ga4, ga4Error)]
    .filter((a): a is Aviso => a !== null);
  return avisos.map((a) => (
    <Card key={a.texto} as="div" role={a.error ? 'alert' : 'status'}>
      <p>{a.texto}</p>
    </Card>
  ));
}
