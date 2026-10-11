import { ThemedImg } from './img';
import s from './diagnostico.module.css';

/** Captura del diagnóstico. "Leer completo →" forma parte de la imagen, no es un botón. */
export function Diagnostico() {
  return (
    <section aria-labelledby="p3-t" className={s.section}>
      <div className={s.container}>
        <h2 id="p3-t" className={s.title}>
          El diagnóstico que tu negocio necesita
        </h2>
        <figure className={s.figure}>
          <ThemedImg
            light="diagnostico.webp"
            dark="diagnostico-oscuro.webp"
            width={1555}
            height={1063}
            decoding="async"
            alt="Pantalla de diagnóstico de Praxa con resumen, oportunidades destacadas y análisis completo"
          />
        </figure>
      </div>
    </section>
  );
}
