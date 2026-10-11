/**
 * Contrato de datos de las pantallas de la app (`/app`).
 *
 * Las pantallas dependen solo de estos tipos. Hoy los llena `mock.ts`; cuando exista el
 * backend, se reemplazan las funciones de `index.ts` sin tocar los componentes.
 */

export type IntegracionId = 'meta_ads' | 'google_analytics' | 'tiendanube';

export type Integracion = {
  id: IntegracionId;
  nombre: string;
  /** Dos líneas, como en el diseño. */
  descripcion: [string, string];
  conectada: boolean;
};

export type Empresa = {
  nombre: string;
  /** `null` = el usuario todavía no lo definió. Nunca se completa con un valor supuesto. */
  rubro: string | null;
  pais: string | null;
  moneda: string | null;
};

export type Usuario = {
  id: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  /** Fecha ISO de alta de la cuenta. */
  miembroDesde: string | null;
  /** URL firmada (vida corta) de la foto de perfil, o `null` si no subió ninguna. */
  fotoUrl: string | null;
};

/** Uso de la IA de Praxa. Los importes son costo de la IA en dólares, no datos del negocio. */
export type ResumenUso = {
  costoMesUsd: number;
  consultas: number;
  latenciaPromedioS: number;
  costoPorConsultaUsd: number;
  /** Variación contra el mes anterior, en puntos porcentuales. */
  variacionCostoPct: number;
  variacionConsultasPct: number;
};

export type RendimientoIA = {
  latenciaPromedioS: number;
  latenciaP95S: number;
  procesadasPct: number;
  erroresPct: number;
};

/** Un día de costo de la IA. `fecha` es `AAAA-MM-DD` en la zona horaria de Argentina. */
export type CostoDia = { fecha: string; usd: number };

export type Uso = {
  resumen: ResumenUso;
  rendimiento: RendimientoIA;
  /** Últimos 90 días, del más viejo al más nuevo; el último es hoy. */
  costoDiario: CostoDia[];
};

export type IconoOportunidad = 'personas' | 'producto' | 'barras';

export type BloqueAnalisis =
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'lista'; items: string[] };

export type Diagnostico = {
  titular: { inicio: string; destacado: string };
  parrafos: string[];
  oportunidades: { titulo: string; detalle: string; icono: IconoOportunidad }[];
  analisis: { titulo: string; bloques: BloqueAnalisis[] };
};
