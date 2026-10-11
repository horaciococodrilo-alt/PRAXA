import Link from 'next/link';

import { cantidad, segundos, usd } from '@/components/app/format';
import { IconBase, IconEdificio } from '@/components/app/icons';
import s from '@/components/app/inicio.module.css';
import { IntegracionLogo } from '@/components/app/integracion-logo';
import { Badge, Button, Card, PageHeader, TileIcon } from '@/components/app/ui';
import { getEmpresa, getIntegraciones, getUso, requireAppSession } from '@/modules/app-data';

export const metadata = { title: 'Inicio' };

function Dato({ valor }: { valor: string | null }) {
  return valor ? <dd>{valor}</dd> : <dd className={s.pendiente}>Sin definir</dd>;
}

export default async function InicioPage() {
  await requireAppSession('/app');
  const [empresa, integraciones, uso] = await Promise.all([getEmpresa(), getIntegraciones(), getUso()]);
  const { resumen } = uso;

  return (
    <>
      <PageHeader title="Inicio" subtitle="El estado de tu cuenta y qué conviene hacer ahora." />

      <section className={s.grid} aria-label="Estado de la cuenta">
        <Card as="article" className={s.card}>
          <h2 className={s.eyebrow}>Empresa</h2>
          <div className={s.id}>
            <TileIcon>
              <IconEdificio size={20} />
            </TileIcon>
            {empresa ? (
              <span className={s.big}>{empresa.nombre}</span>
            ) : (
              <Link className={s.big} href="/app/configuracion">
                Completá tu empresa
              </Link>
            )}
          </div>
          <dl className={s.dl}>
            <dt>Rubro</dt>
            <Dato valor={empresa?.rubro ?? null} />
            <dt>País</dt>
            <Dato valor={empresa?.pais ?? null} />
            <dt>Moneda</dt>
            <Dato valor={empresa?.moneda ?? null} />
          </dl>
        </Card>

        <Card as="article" className={s.card}>
          <h2 className={s.eyebrow}>Integraciones</h2>
          <ul className={s.list}>
            {integraciones.map((i) => (
              <li key={i.id}>
                <span className={s.logo}>
                  <IntegracionLogo id={i.id} size={20} />
                </span>
                {i.nombre}
                <Badge on={i.conectada} className={s.estado}>
                  {i.conectada ? 'Conectado' : 'No conectado'}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card as="article" className={s.card}>
          <h2 className={s.eyebrow}>Uso de la IA</h2>
          <div className={s.id}>
            <TileIcon>
              <IconBase size={20} />
            </TileIcon>
            <span className={s.big}>{usd(resumen.costoMesUsd)}</span>
          </div>
          <dl className={s.dl}>
            <dt>Consultas</dt>
            <dd>{cantidad(resumen.consultas)}</dd>
            <dt>Latencia promedio</dt>
            <dd>{segundos(resumen.latenciaPromedioS)}</dd>
            <dt>Costo por consulta</dt>
            <dd>{usd(resumen.costoPorConsultaUsd)}</dd>
          </dl>
        </Card>
      </section>

      <Card className={s.next} aria-label="Próximo paso">
        <div>
          <span className={s.eyebrow}>Próximo paso</span>
          <h2>Sincronizá tus datos</h2>
          <p>
            Traé la información de tus integraciones para que Praxa pueda responder con datos al
            día.
          </p>
        </div>
        {/* Todavía no hay nada que sincronizar: deshabilitado hasta que exista el backend. */}
        <Button disabled title="Todavía no disponible">
          Sincronizar
        </Button>
      </Card>
    </>
  );
}
