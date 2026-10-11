import { cn } from '@/components/ui';

import shared from './landing.module.css';
import s from './tres-pasos.module.css';

const PASOS = [
  {
    title: 'Conectás tus herramientas',
    body: 'Autorizás cada una en modo solo lectura y confirmás cuenta, moneda y zona horaria. Toma unos minutos y no hace falta nadie de sistemas.',
    delay: shared.d2,
  },
  {
    title: 'PRAXA unifica y diagnostica',
    body: 'Deja todo en la misma zona horaria y la misma moneda, marca qué días tiene de cada fuente y busca las diferencias que no cierran entre una y otra.',
    delay: shared.d4,
  },
  {
    title: 'Preguntás y decidís',
    body: 'En lenguaje natural, con la respuesta mostrando de dónde sale cada número y qué tan completo está el período que pediste.',
    delay: shared.d6,
  },
];

/** "Tres pasos". La referencia móvil no tiene esta sección. */
export function TresPasos() {
  return (
    <section aria-labelledby="como-t" className={cn(s.section, shared.soloEsc)}>
      <div className={s.container}>
        <div className={s.head}>
          <h2 id="como-t" className={s.title}>
            Tres pasos, y después solo preguntás
          </h2>
        </div>
        <div className={s.body}>
          <span aria-hidden="true" className={cn(s.linea, shared.draw, shared.d2)} />
          <ol className={s.pasos}>
            {PASOS.map((p, i) => (
              <li key={p.title} className={cn(s.paso, shared.card, shared.rise, p.delay)}>
                <span className={s.num}>{i + 1}</span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
