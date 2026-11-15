'use client';

import { useFormStatus } from 'react-dom';

import { cantidad, porcentaje } from '@/components/app/format';
import { IconFlecha } from '@/components/app/icons';
import { IntegracionLogo } from '@/components/app/integracion-logo';
import i from '@/components/app/integraciones.module.css';
import { Badge, Button, DisclosureButton } from '@/components/app/ui';
import { desconectarTiendanube, sincronizarTiendanube } from '@/modules/integrations/actions';
import type { TiendanubeCardState, TiendanubeDatos, VentaPeriodo } from '@/modules/integrations/tiendanube/analysis';
import { abrirGuiaIntegraciones } from './guia-integraciones';
import t from './tiendanube-tarjeta.module.css';

/**
 * Tarjeta y panel de Tiendanube (M16e §5, etapa .4).
 *
 * La pantalla separa conexión, estado de la extracción, cobertura, ventas, productos y
 * cohortes. Un vacío nunca se presenta como cero, un período sin cobertura completa se marca
 * parcial y lo que tiene menos de cinco clientes se muestra como «menos de 5». Sin la
 * constante de monto cobrado no hay importes: se cuentan pedidos y unidades.
 */

const START = '/api/integraciones/tiendanube/iniciar';
export const TN_RETENTION = 'Se borran la credencial y los datos de la tienda de la base activa: pedidos, catálogo y cohortes. Esta acción no se puede deshacer; para volver a usar Tiendanube hay que conectar y sincronizar de nuevo. Si el proyecto usa Supabase Pro, las copias nocturnas pueden conservarlos hasta 7 días.';
export const TN_UNINSTALL = 'Desconectar no desinstala la app: el acceso sigue habilitado en Tiendanube hasta que desinstales Praxa desde el administrador de tu tienda.';
export const TN_MANUAL = 'La sincronización es manual: los datos se actualizan cuando pulsás Sincronizar. La primera vez se lee todo el histórico y puede llevar varios pasos.';
export const MENOS_DE_5 = 'menos de 5';

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

function SyncSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="small" className={i.act} disabled={pending}>
      {pending ? 'Sincronizando…' : 'Sincronizar ahora'}
    </Button>
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
            <form action={sincronizarTiendanube} className={i.actForm}>
              <SyncSubmit />
            </form>
          ) : <StartControl label="Volver a autorizar" />}
          <DisconnectControl />
        </>
      ) : null}
      {state.kind === 'error' ? <p>No pudimos leer el estado de Tiendanube. Probá de nuevo más tarde.</p> : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function mes(dia: string): string {
  const [y, m] = dia.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}

export function fecha(dia: string): string {
  const [y, m, d] = dia.split('-');
  return `${d}/${m}/${y}`;
}

function instante(valor: string, zona: string): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: zona, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit' }).format(new Date(valor));
}

const ESTADO_EJECUCION: Record<string, string> = {
  running: 'en curso', complete: 'completa', incomplete: 'incompleta: falta seguir sincronizando',
  failed: 'con error', superseded: 'reemplazada',
};

function Estado({ datos }: { datos: TiendanubeDatos }) {
  const e = datos.estado;
  if (!e || !e.ultimaEjecucion) {
    return <p>Todavía no sincronizaste la tienda. {TN_MANUAL}</p>;
  }
  let cobertura: string;
  if (e.cubiertoHasta) cobertura = `Datos completos hasta el ${fecha(e.cubiertoHasta)} (zona ${e.zona}).`;
  else if (e.backfillTerminado) cobertura = 'El histórico ya está leído. Falta una sincronización más para confirmar los cambios recientes; hasta entonces, todo período se muestra como parcial.';
  else cobertura = 'Todavía se está leyendo el histórico de la tienda. Seguí sincronizando; hasta terminar, todo período se muestra como parcial.';
  return (
    <>
      <p>{cobertura}</p>
      <p>
        Última sincronización: {instante(e.ultimaEjecucion.inicio, e.zona)}, {ESTADO_EJECUCION[e.ultimaEjecucion.estado] ?? e.ultimaEjecucion.estado}.
      </p>
      <p className={t.nota}>{TN_MANUAL}</p>
    </>
  );
}

function filaVenta(fila: VentaPeriodo, index: number) {
  // Sin moneda: período sin ventas. Si está cubierto es un cero real; si no, no hay datos.
  const vacio = fila.moneda === null;
  const valor = (n: number) => (vacio && !fila.cubierto ? '—' : cantidad(n));
  return (
    <tr key={`${fila.periodo}-${fila.moneda ?? 'sin'}-${index}`}>
      <td>{mes(fila.periodo)}</td>
      <td>{fila.moneda ?? (fila.cubierto ? 'Sin ventas' : 'Sin datos')}</td>
      <td>{valor(fila.pagados)}</td>
      <td>{valor(fila.sinCliente)}</td>
      <td>{valor(fila.parciales)}</td>
      <td>{fila.cubierto ? 'Completo' : 'Parcial'}</td>
    </tr>
  );
}

function Ventas({ datos }: { datos: TiendanubeDatos }) {
  const filas = datos.ventas.filas;
  const pagados = filas.reduce((total, fila) => total + fila.pagados, 0);
  const sinCliente = filas.reduce((total, fila) => total + fila.sinCliente, 0);
  return (
    <section className={t.bloque} aria-labelledby="tn-ventas">
      <h3 id="tn-ventas">Ventas por mes</h3>
      <p className={t.nota}>
        Pedidos pagados: pagados o con reembolso parcial y no cancelados, por el mes del pago en la zona de la tienda.
        Los pagos parciales se cuentan aparte. Las monedas no se suman.
      </p>
      {filas.length === 0 ? <p>Todavía no hay ventas sincronizadas.</p> : (
        <div className={t.tablaWrap}>
          <table className={t.tabla}>
            <thead>
              <tr><th>Mes</th><th>Moneda</th><th>Pedidos pagados</th><th>Sin cliente identificado</th>
                <th>Pagos parciales</th><th>Cobertura</th></tr>
            </thead>
            <tbody>{filas.map(filaVenta)}</tbody>
          </table>
        </div>
      )}
      {pagados > 0 ? (
        <p className={t.nota}>
          Pedidos pagados sin cliente identificado: {cantidad(sinCliente)} de {cantidad(pagados)} ({porcentaje((sinCliente / pagados) * 100)}). No entran en las cohortes.
        </p>
      ) : null}
    </section>
  );
}

function Productos({ datos }: { datos: TiendanubeDatos }) {
  const { filas, desde, hasta, cubierto } = datos.productos;
  return (
    <section className={t.bloque} aria-labelledby="tn-productos">
      <h3 id="tn-productos">Productos más vendidos</h3>
      <p className={t.nota}>
        Unidades de pedidos pagados del {fecha(desde)} al {fecha(hasta)}. {cubierto ? '' : 'Período parcial: todavía no hay datos completos.'}
      </p>
      {filas.length === 0 ? (
        <p>{cubierto ? 'No hubo unidades vendidas en el período.' : 'Todavía no hay datos de productos para el período.'}</p>
      ) : (
        <div className={t.tablaWrap}>
          <table className={t.tabla}>
            <thead><tr><th>#</th><th>Producto</th><th>SKU</th><th>Unidades</th></tr></thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={`${fila.puesto}-${fila.nombre}`}>
                  <td>{fila.puesto}</td>
                  <td>{fila.nombre}{fila.eliminado ? ' (producto eliminado)' : ''}</td>
                  <td>{fila.sku ?? '—'}</td>
                  <td>{cantidad(fila.unidades)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Cohortes({ datos }: { datos: TiendanubeDatos }) {
  const { filas } = datos.cohortes;
  const maximo = Math.max(0, ...filas.flatMap((fila) => fila.celdas.map((celda) => celda.desplazamiento)));
  const columnas = Array.from({ length: maximo + 1 }, (_, n) => n);
  const hayParcial = filas.some((fila) => fila.celdas.some((celda) => celda.parcial));
  return (
    <section className={t.bloque} aria-labelledby="tn-cohortes">
      <h3 id="tn-cohortes">Cohortes de compradores</h3>
      <p className={t.nota}>
        Cada fila agrupa a los clientes por el mes de su primer pedido pagado. La retención del mes N es la parte de
        esos clientes que volvió a comprar N meses después. Lo que tiene menos de cinco clientes no se muestra.
      </p>
      {filas.length === 0 ? (
        <p>Todavía no hay cohortes: hacen falta pedidos pagados de clientes identificados.</p>
      ) : (
        <div className={t.tablaWrap}>
          <table className={t.tabla}>
            <thead>
              <tr><th>Cohorte</th><th>Clientes</th>{columnas.map((n) => <th key={n}>Mes {n}</th>)}</tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.mes}>
                  <td>{mes(fila.mes)}</td>
                  <td>{fila.oculta || fila.tamano === null ? MENOS_DE_5 : cantidad(fila.tamano)}</td>
                  {columnas.map((n) => {
                    if (fila.oculta) return <td key={n}>—</td>;
                    const celda = fila.celdas.find((c) => c.desplazamiento === n);
                    if (!celda) return <td key={n}>—</td>;
                    const texto = celda.oculta || celda.retencion === null ? MENOS_DE_5 : porcentaje(celda.retencion * 100);
                    return <td key={n}>{texto}{celda.parcial ? ' *' : ''}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hayParcial ? <p className={t.nota}>* Mes sin cobertura completa: la cifra puede cambiar.</p> : null}
    </section>
  );
}

export function TiendanubePanel({ datos, error }: { datos: TiendanubeDatos | null; error: boolean }) {
  if (error) {
    return <section className={t.panel} role="alert"><p>No pudimos leer los datos de Tiendanube. Probá de nuevo más tarde.</p></section>;
  }
  if (!datos) return null;
  return (
    <section className={t.panel} aria-labelledby="tn-panel">
      <h2 id="tn-panel">Tiendanube</h2>
      <Estado datos={datos} />
      <Ventas datos={datos} />
      <Productos datos={datos} />
      <Cohortes datos={datos} />
    </section>
  );
}
