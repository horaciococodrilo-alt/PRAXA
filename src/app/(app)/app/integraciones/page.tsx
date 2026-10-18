import { IconFlecha } from '@/components/app/icons';
import i from '@/components/app/integraciones.module.css';
import { IntegracionLogo } from '@/components/app/integracion-logo';
import { Badge, Button, ButtonLink, Card, Img, PageHeader } from '@/components/app/ui';
import { getIntegraciones, requireAppSession } from '@/modules/app-data';
import { META_OAUTH_MESSAGES, parseMetaOAuthOutcome } from '@/modules/integrations/meta/outcomes';
import { loadMetaCardState } from '@/modules/integrations/lifecycle';
import { MetaTarjeta } from './meta-tarjeta';

export const metadata = { title: 'Integraciones' };

/**
 * Meta tiene su propia tarjeta con selección, reautorización y desconexión. Las demás
 * integraciones siguen como tarjetas informativas; "Ver guía" aún está deshabilitado.
 *
 * El callback de Meta vuelve acá con `?meta=<resultado>` (D-M16.1-01). Solo se muestra el
 * texto de la lista cerrada: ningún otro parámetro de la URL llega a la pantalla. Las props
 * no se desestructuran en la firma: la sesión se verifica antes de leer `searchParams`.
 */
export default async function IntegracionesPage(props: PageProps<'/app/integraciones'>) {
  await requireAppSession('/app/integraciones');
  const searchParams = await props.searchParams;
  const resultado = parseMetaOAuthOutcome(searchParams.meta);
  const aviso = resultado === null ? null : META_OAUTH_MESSAGES[resultado];
  const metaState = await loadMetaCardState();
  const integraciones = await getIntegraciones();

  return (
    <>
      <PageHeader
        className={i.head}
        title="Integraciones"
        subtitle="Conectá tus canales y sistemas para que Praxa analice tu operación en tiempo real."
      />

      {aviso ? (
        <Card as="div" role={aviso.tone === 'error' ? 'alert' : 'status'}>
          <p>{aviso.text}</p>
        </Card>
      ) : null}

      <section className={i.ban} aria-label="Guía de integraciones">
        <Img className={i.robot} src="/app/robot-praxa.png" alt="" width={44} height={44} />
        <div className={i.bt}>
          <h2>Conectá tus herramientas</h2>
          <p>
            Integrá tus canales de venta, sistemas y herramientas de marketing para tener una
            visión completa de tu negocio y detectar oportunidades automáticamente.
          </p>
        </div>
        <Button variant="secondary" disabled title="Todavía no disponible">
          <span>Ver guía de integraciones</span>
          <IconFlecha size={13} stroke={2.3} />
        </Button>
      </section>

      <section className={i.sec} aria-labelledby="integraciones-marketing">
        <h2 id="integraciones-marketing">Marketing y analítica</h2>
        <p>Conectá tus herramientas de marketing y analítica para medir el rendimiento.</p>
        <div className={i.cards}>
          <MetaTarjeta state={metaState} />
          {integraciones.filter((int) => int.id !== 'meta_ads').map((int) => (
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
    </>
  );
}
