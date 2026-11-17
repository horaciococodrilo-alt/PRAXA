/**
 * Base de las tarjetas de integraciones: `getIntegraciones()` le suma el estado real de cada
 * conexión. No agregar números de ejemplo acá.
 */
import type { Integracion } from './types';

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
