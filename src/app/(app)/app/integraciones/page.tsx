import { IconFlecha } from '@/components/app/icons';
import i from '@/components/app/integraciones.module.css';
import { IntegracionLogo } from '@/components/app/integracion-logo';
import { Badge, Button, ButtonLink, Card, Img, PageHeader } from '@/components/app/ui';
import { getIntegraciones, requireAppSession } from '@/modules/app-data';
import { META_OAUTH_MESSAGES, parseMetaOAuthOutcome } from '@/modules/integrations/meta/outcomes';
import { loadMetaSyncView, parseMetaSyncResult, syncNotice, type MetaSyncView } from '@/modules/integrations/meta/insights';
import { loadMetaCardState } from '@/modules/integrations/lifecycle';
import { loadTiendanubeView } from '@/modules/integrations/tiendanube/analysis';
import { TIENDANUBE_OAUTH_MESSAGES, parseTiendanubeOAuthOutcome } from '@/modules/integrations/tiendanube/oauth';
import { TN_SYNC_MESSAGES, parseTiendanubeSyncResult } from '@/modules/integrations/tiendanube/sync';
import { GuiaIntegraciones } from './guia-integraciones';
import { MetaSyncButton, MetaSyncPanel } from './meta-sync-control';
import { MetaTarjeta } from './meta-tarjeta';
import { TiendanubePanel, TiendanubeTarjeta } from './tiendanube-tarjeta';

export const metadata = { title: 'Integraciones' };

// Duración efectiva de Vercel. También cubre la Server Action de la página (Q-04, M16c/spec.md).
export const maxDuration = 300;

/**
 * Meta y Tiendanube tienen tarjetas propias con conexión, reautorización, sincronización y
 * desconexión; Google Analytics sigue como tarjeta informativa. La guía de integraciones
 * explica cómo conectar y desconectar (M16e, DP-02).
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
  const integraciones = await getIntegraciones();
  const tiendanube = await loadTiendanubeView();
  const tnResultado = parseTiendanubeOAuthOutcome(searchParams.tiendanube);
  const tnSync = parseTiendanubeSyncResult(searchParams.tn_sync);
  const avisosTiendanube = [tnResultado === null ? null : TIENDANUBE_OAUTH_MESSAGES[tnResultado],
    tnSync === null ? null : TN_SYNC_MESSAGES[tnSync]].filter((a) => a !== null);

  return (
    <>
      <PageHeader
        className={i.head}
        title="Integraciones"
        subtitle="Conectá tus canales y sistemas para que Praxa analice tu operación."
      />

      {aviso ? (
        <Card as="div" role={aviso.tone === 'error' ? 'alert' : 'status'}>
          <p>{aviso.text}</p>
        </Card>
      ) : null}
      {avisosTiendanube.map((a) => (
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
          {integraciones.filter((int) => int.id !== 'meta_ads' && int.id !== 'tiendanube').map((int) => (
            <article key={int.id} className={i.card}>
              <div className={i.cardTop}>
                <span className={i.logo}>
                  <IntegracionLogo id={int.id} size={30} />
                </span>
                <div className={i.nm}>
                  <h3>{int.nombre}</h3>
                  <p>
                    {int.descripcion[0]}
                    <br />
                    {int.descripcion[1]}
                  </p>
                </div>
              </div>
              <Badge on={int.conectada} className={i.estado}>
                {int.conectada ? 'Conectado' : 'No conectado'}
              </Badge>
              {int.conectada ? (
                <ButtonLink href="/app/configuracion" variant="small" className={i.act}>
                  <span>Configurar</span>
                  <IconFlecha size={13} stroke={2.1} />
                </ButtonLink>
              ) : (
                <Button variant="small" className={i.act} disabled title="Todavía no disponible">
                  <span>Conectar</span>
                  <IconFlecha size={13} stroke={2.1} />
                </Button>
              )}
            </article>
          ))}
        </div>
      </section>

      {syncView ? <MetaSyncPanel view={syncView} notice={notice} /> : null}
      {syncError ? <Card as="div" role="alert"><p>No pudimos leer los datos de Meta. Probá de nuevo más tarde.</p></Card> : null}
      <TiendanubePanel datos={tiendanube.datos} error={tiendanube.error} />
    </>
  );
}
