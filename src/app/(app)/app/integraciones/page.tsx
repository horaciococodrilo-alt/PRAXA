import i from '@/components/app/integraciones.module.css';
import { Card, Img, PageHeader } from '@/components/app/ui';
import { requireAppSession } from '@/modules/app-data';
import { META_OAUTH_MESSAGES, parseMetaOAuthOutcome } from '@/modules/integrations/meta/outcomes';
import { loadMetaSyncView, parseMetaSyncResult, syncNotice, type MetaSyncView } from '@/modules/integrations/meta/insights';
import { loadMetaCardState } from '@/modules/integrations/lifecycle';
import { loadTiendanubeView } from '@/modules/integrations/tiendanube/analysis';
import { loadGa4View } from '@/modules/integrations/ga4/analysis';
import { ga4Notice, ga4SyncNotice } from '@/modules/integrations/ga4/outcomes';
import { TIENDANUBE_OAUTH_MESSAGES, parseTiendanubeOAuthOutcome } from '@/modules/integrations/tiendanube/oauth';
import { TN_SYNC_MESSAGES, parseTiendanubeSyncResult } from '@/modules/integrations/tiendanube/sync';
import { GuiaIntegraciones } from './guia-integraciones';
import { EstadoSincronizacion } from './estado-sincronizacion';
import { MetaSyncButton } from './meta-sync-control';
import { MetaTarjeta } from './meta-tarjeta';
import { TiendanubeTarjeta } from './tiendanube-tarjeta';
import { Ga4Tarjeta } from './ga4-tarjeta';

export const metadata = { title: 'Integraciones' };

// Duración efectiva de Vercel. También cubre la Server Action de la página (Q-04, M16c/spec.md).
export const maxDuration = 300;

/**
 * Meta, Tiendanube y Google Analytics tienen tarjetas propias con conexión, reautorización,
 * sincronización y desconexión. La guía de integraciones
 * explica cómo conectar y desconectar (M16e, DP-02). Debajo de las tarjetas no hay paneles de
 * datos: arriba solo se avisa qué fuente no terminó de sincronizar (2026-11-21).
 *
 * Los callbacks vuelven acá con `?meta=<resultado>` o `?tiendanube=<resultado>`, y las
 * sincronizaciones con `?sync=` o `?tn_sync=`. Solo se muestra el texto de cada lista
 * cerrada: ningún otro parámetro de la URL llega a la pantalla. Las props no se
 * desestructuran en la firma: la sesión se verifica antes de leer `searchParams`.
 */
export default async function IntegracionesPage(props: PageProps<'/app/integraciones'>) {
  await requireAppSession('/app/integraciones');
  const searchParams = await props.searchParams;
  const resultado = parseMetaOAuthOutcome(searchParams.meta);
  const aviso = resultado === null ? null : META_OAUTH_MESSAGES[resultado];
  const metaState = await loadMetaCardState();
  let syncView: MetaSyncView | null = null;
  let syncError = false;
  try {
    syncView = await loadMetaSyncView({ nivel: searchParams.nivel, entidad: searchParams.entidad });
  } catch {
    syncError = metaState.kind === 'activa' || metaState.kind === 'requiere_reauth';
  }
  const notice = syncNotice(parseMetaSyncResult(searchParams.sync), syncView?.status.effective_status ?? null);
  const tiendanube = await loadTiendanubeView();
  const ga4 = await loadGa4View();
  const tnResultado = parseTiendanubeOAuthOutcome(searchParams.tiendanube);
  const tnSync = parseTiendanubeSyncResult(searchParams.tn_sync);
  const avisosTiendanube = [tnResultado === null ? null : TIENDANUBE_OAUTH_MESSAGES[tnResultado],
    tnSync === null ? null : TN_SYNC_MESSAGES[tnSync]].filter((a) => a !== null);
  const avisosGa4 = [ga4Notice(searchParams.ga4), ga4SyncNotice(searchParams.ga4_sync)]
    .filter((a) => a !== null);

  return (
    <>
      <PageHeader
        className={i.head}
        title="Integraciones"
        subtitle="Conectá tus canales y sistemas para que Praxa analice tu operación."
      />

      <EstadoSincronizacion meta={syncView} metaError={syncError} tiendanube={tiendanube.datos}
        tiendanubeError={tiendanube.error} ga4={ga4.data} ga4Error={ga4.error} />
      {aviso ? (
        <Card as="div" role={aviso.tone === 'error' ? 'alert' : 'status'}>
          <p>{aviso.text}</p>
        </Card>
      ) : null}
      {notice ? (
        <Card as="div" role={notice.tone === 'error' ? 'alert' : 'status'}>
          <p>{notice.text}</p>
        </Card>
      ) : null}
      {avisosTiendanube.map((a) => (
        <Card key={a.text} as="div" role={a.tone === 'error' ? 'alert' : 'status'}>
          <p>{a.text}</p>
        </Card>
      ))}
      {avisosGa4.map((a) => (
        <Card key={a.text} as="div" role={a.tone === 'error' ? 'alert' : 'status'}>
          <p>{a.text}</p>
        </Card>
      ))}

      <section className={i.ban} aria-label="Guía de integraciones">
        <Img className={i.robot} src="/app/robot-praxa.png" alt="" width={44} height={44} />
        <div className={i.bt}>
          <h2>Conectá tus herramientas</h2>
          <p>
            Integrá tus canales de venta, sistemas y herramientas de marketing para tener una
            visión completa de tu negocio y detectar oportunidades automáticamente.
          </p>
        </div>
        <GuiaIntegraciones />
      </section>

      <section className={i.sec} aria-labelledby="integraciones-marketing">
        <h2 id="integraciones-marketing">Marketing y analítica</h2>
        <p>Conectá tus herramientas de marketing y analítica para medir el rendimiento.</p>
        <div className={i.cards}>
          <MetaTarjeta state={metaState} syncControl={syncView?.canSync ? <MetaSyncButton /> : undefined} />
          <TiendanubeTarjeta state={tiendanube.tarjeta} />
          <Ga4Tarjeta state={ga4.card} />
        </div>
      </section>

    </>
  );
}
