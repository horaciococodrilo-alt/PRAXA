/**
 * MOCK — datos de la app mientras no existe el backend.
 *
 * Reflejan el estado real de hoy: ningún conector implementado y la IA sin uso (el
 * diagnóstico ya sale de `reports`). Por eso todo está en cero o desconectado, como en la
 * pantalla `AppUsoCostosCero` del diseño. No agregar números de ejemplo acá.
 */
import type { Integracion, Uso } from './types';

export const INTEGRACIONES_BASE: readonly Integracion[] = [
  {
    id: 'meta_ads',
    nombre: 'Meta Ads',
    descripcion: ['Campañas, métricas', 'y rendimiento.'],
    conectada: false,
  },
  {
    id: 'google_analytics',
    nombre: 'Google Analytics',
    descripcion: ['Tráfico, conversiones', 'y comportamiento.'],
    conectada: false,
  },
  {
    id: 'tiendanube',
    nombre: 'Tiendanube',
    descripcion: ['Ventas, productos', 'y clientes.'],
    conectada: false,
  },
];

const DIAS_DE_HISTORIA = 90;

/** `AAAA-MM-DD` de hoy menos `diasAtras`, en la zona horaria de Argentina. */
export function fechaArgentina(hoy: Date, diasAtras: number): string {
  const dia = new Date(hoy.getTime() - diasAtras * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(dia);
}

export function usoEnCero(hoy: Date): Uso {
  return {
    resumen: {
      costoMesUsd: 0,
      consultas: 0,
      latenciaPromedioS: 0,
      costoPorConsultaUsd: 0,
      variacionCostoPct: 0,
      variacionConsultasPct: 0,
    },
    rendimiento: { latenciaPromedioS: 0, latenciaP95S: 0, procesadasPct: 0, erroresPct: 0 },
    costoDiario: Array.from({ length: DIAS_DE_HISTORIA }, (_, i) => ({
      fecha: fechaArgentina(hoy, DIAS_DE_HISTORIA - 1 - i),
      usd: 0,
    })),
  };
}
