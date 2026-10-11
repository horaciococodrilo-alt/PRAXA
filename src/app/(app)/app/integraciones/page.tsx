import { IconFlecha } from '@/components/app/icons';
import i from '@/components/app/integraciones.module.css';
import { IntegracionLogo } from '@/components/app/integracion-logo';
import { Badge, Button, ButtonLink, Img, PageHeader } from '@/components/app/ui';
import { getIntegraciones, requireAppSession } from '@/modules/app-data';

export const metadata = { title: 'Integraciones' };

/**
 * Cada tarjeta muestra "Conectar" mientras el conector no está conectado y "Configurar"
 * (→ Configuración) cuando lo está. "Conectar" y "Ver guía" todavía no tienen acción: no hay
 * ningún conector implementado, así que se muestran deshabilitados (como "Sincronizar" en
 * Inicio) en lugar de parecer rotos.
 */
export default async function IntegracionesPage() {
  await requireAppSession('/app/integraciones');
  const integraciones = await getIntegraciones();

  return (
    <>
      <PageHeader
        className={i.head}
        title="Integraciones"
        subtitle="Conectá tus canales y sistemas para que Praxa analice tu operación en tiempo real."
      />

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
          {integraciones.map((int) => (
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
