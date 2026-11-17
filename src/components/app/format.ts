/**
 * Formatos de números de la app, en castellano de Argentina (coma decimal, punto de miles).
 * Un dato ausente nunca se muestra como cero: eso lo decide quien llama, no estas funciones.
 */

// `useGrouping: 'always'`: en castellano ICU no agrupa números de 4 cifras ("1284").
const nf = (min: number, max: number) =>
  new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
    useGrouping: 'always',
  });

const hastaUnDecimal = nf(0, 1);
const entero = nf(0, 0);

/** `0%`, `99,7%`. */
export const porcentaje = (valor: number) => `${hastaUnDecimal.format(valor)}%`;

/** Variación con signo: `+18%`, `-12%`, `0%`. */
export const variacion = (valor: number) =>
  `${valor > 0 ? '+' : ''}${hastaUnDecimal.format(valor)}%`;

/** `1.284`. */
export const cantidad = (valor: number) => entero.format(valor);

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Fecha ISO → `ago. 2024`. */
export function mesAnio(iso: string): string {
  const fecha = new Date(iso);
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(fecha);
  const anio = partes.find((p) => p.type === 'year')?.value;
  const mes = Number(partes.find((p) => p.type === 'month')?.value);
  return `${MESES[mes - 1]}. ${anio}`;
}

/**
 * Iniciales para el avatar: de nombre y apellido si están; si no, del correo
 * (`gonzalo.mayer@…` → `GM`, `gonzalo@…` → `G`).
 */
export function iniciales(nombre: string | null, apellido: string | null, email: string): string {
  const n = nombre?.trim() ?? '';
  const a = apellido?.trim() ?? '';
  if (n || a) return `${n.charAt(0)}${a.charAt(0)}`.toUpperCase();
  const partes = email.split('@')[0].split(/[._\-+]+/).filter(Boolean);
  return partes
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase();
}

/** Nombre corto para la barra lateral: el nombre, o la parte local del correo. */
export function nombreCorto(nombre: string | null, email: string): string {
  const n = nombre?.trim();
  if (n) return n;
  const local = email.split('@')[0].split(/[._\-+]+/)[0] ?? '';
  return local.charAt(0).toUpperCase() + local.slice(1);
}
