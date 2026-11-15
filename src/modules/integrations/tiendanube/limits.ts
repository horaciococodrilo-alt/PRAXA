/**
 * Presupuestos de Tiendanube (M16e §3 y §4). Son los valores iniciales de la spec; el paso 7
 * los mide en el desechable y registra los finales en la sesión. Sin datos ni red.
 */

/**
 * Monto cobrado ajustado (`total_paid_by_customer` menos reembolsos verificados). Empieza en
 * `false` y solo pasa a `true` después de verificar M16e-H-06 en T-15. Con `false`, ninguna
 * pantalla, herramienta ni informe publica una métrica de «cobrado».
 */
export const TN_COLLECTED_AMOUNT_ENABLED = false;

export type TiendanubeSyncLimits = Readonly<{
  /** Duración de un paso, por debajo de `maxDuration = 300` de Integraciones. */
  stepMs: number;
  /** Margen que se reserva al final del paso para publicar y cerrar. */
  finalizationReserveMs: number;
  /** Páginas por paso, sumando pedidos y catálogo. */
  maxPages: number;
  perPage: number;
  /** Espera acumulada por `429` en un paso. */
  max429WaitMs: number;
  /** Reintentos ante `5xx`, timeout o red. */
  maxTransientRetries: number;
  transientDelayMs: number;
  /** Llamadas a `orders/{id}/history/values` por paso. */
  maxHistoryCalls: number;
  /** Tope documentado de resultados por consulta de `GET /orders`. */
  maxResultsPerQuery: number;
  /** Lease de un paso; la base no admite más de 5 minutos. */
  leaseMs: number;
  /** Solapamiento del incremental sobre `updated_at` (lo aplica la base al devolver el desde). */
  incrementalOverlapMs: number;
  /** Ventana incremental mínima: por debajo de una hora no se subdivide. */
  minIncrementalWindowMs: number;
  /** Primer día del histórico. Tiendanube no tiene pedidos anteriores. */
  historyStart: string;
}>;

export const DEFAULT_TN_SYNC_LIMITS: TiendanubeSyncLimits = Object.freeze({
  stepMs: 240_000,
  finalizationReserveMs: 15_000,
  // 25 → 30 (2026-11-15): con la tienda real, 25 páginas tardaron hasta 171 s; 30 quedan bajo 240 s.
  maxPages: 30,
  perPage: 200,
  max429WaitMs: 30_000,
  maxTransientRetries: 2,
  transientDelayMs: 1_000,
  maxHistoryCalls: 100,
  maxResultsPerQuery: 10_000,
  leaseMs: 280_000,
  incrementalOverlapMs: 60 * 60 * 1000,
  minIncrementalWindowMs: 60 * 60 * 1000,
  historyStart: '2010-01-01',
});

export type TiendanubePrivacyLimits = Readonly<{
  /** Filas por llamada a `tn_privacy_store_redact`. */
  maxRowsPerCall: number;
  /** Presupuesto del handler: Tiendanube espera la respuesta en 3 s. */
  budgetMs: number;
  /** Cuerpo máximo de un webhook. */
  maxBodyBytes: number;
}>;

export const DEFAULT_TN_PRIVACY_LIMITS: TiendanubePrivacyLimits = Object.freeze({
  maxRowsPerCall: 5_000,
  budgetMs: 2_000,
  maxBodyBytes: 64 * 1024,
});
