import { cn } from '@/components/ui';

import { ThemedImg } from './img';
import shared from './landing.module.css';
import s from './seguridad.module.css';

const PUNTOS = [
  {
    icon: 'seg-solo-lectura',
    alt: 'Icono de solo lectura',
    title: 'Solo lectura, siempre',
    body: 'PRAXA no crea, pausa ni edita campañas; no cambia presupuestos; no modifica tu tienda ni tu analítica. El permiso que pide no se lo permite.',
  },
  {
    icon: 'seg-cifrado',
    alt: 'Icono de credenciales cifradas',
    title: 'Credenciales cifradas',
    body: 'Los tokens de acceso se guardan cifrados y nunca se muestran enteros en la interfaz. Los identificadores de cuenta aparecen siempre truncados.',
  },
  {
    icon: 'seg-aislamiento',
    alt: 'Icono de aislamiento',
    title: 'Aislamiento entre empresas',
    body: 'Los datos de cada empresa viven separados de los del resto. Ninguna consulta puede alcanzar los datos de otra.',
  },
  {
    icon: 'seg-borrado',
    alt: 'Icono de borrado al desconectar',
    title: 'Desconectás y se borra',
    body: 'Al desconectar una herramienta se eliminan la credencial y todos los datos que se habían sincronizado de ella, y te explicamos cómo quitar la app desde el proveedor.',
  },
];

/** "Lee tus datos. No toca nada." La referencia móvil no tiene esta sección. */
export function Seguridad() {
  return (
    <section aria-labelledby="seg-t" className={cn(s.section, shared.soloEsc)}>
      <div className={s.container}>
        <div className={s.head}>
          <h2 id="seg-t" className={s.title}>
            Lee tus datos. No toca nada.
          </h2>
        </div>
        <div className={s.grid}>
          {PUNTOS.map((p) => (
            <article key={p.title} className={cn(s.punto, shared.card)}>
              <ThemedImg light={`${p.icon}.svg`} dark={`${p.icon}-osc.svg`} alt={p.alt} />
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
