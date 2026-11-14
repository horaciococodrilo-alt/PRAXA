import type { DiagnosticDocument } from '@/modules/diagnostics/compose';

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

export type EstadoDiagnostico = 'sin_empresa' | 'sin_conexion' | 'sin_objetivo' | 'sincronizacion_requerida'
  | 'sincronizacion_en_curso' | 'espera' | 'listo';

/**
 * Diagnóstico de Meta Ads (M26a): estado que calcula la base, objetivo guardado, opciones del
 * catálogo observado y el informe vigente ya compuesto (el mismo modelo que imprime el PDF).
 */
export type DiagnosticoVista = {
  estado: EstadoDiagnostico;
  /** Motivo de elegibilidad de la base, cuando no se puede generar. */
  motivo: string | null;
  /** Instante ISO desde el que se puede generar (espera de 24 h), calculado por la base. */
  disponibleDesde: string | null;
  objetivo: { goal_kind: 'purchase' | 'inquiry' | 'traffic'; metric_ref: string; etiqueta: string } | null;
  /** `fit`: objetivo para el que la acción es la opción natural (se sugiere primero). */
  opcionesObjetivo: { action_type: string; label: string; fit: 'purchase' | 'inquiry' | null }[];
  informe: DiagnosticDocument | null;
};
