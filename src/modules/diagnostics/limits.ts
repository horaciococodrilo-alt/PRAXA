/**
 * Límites del diagnóstico de Meta Ads (M26a). Los marcados *(inicial)* en la spec se confirman
 * midiendo (H-03); no se relajan para que algo «alcance».
 */
export const DIAGNOSTIC_LIMITS = Object.freeze({
  windowDays: 28,
  /** TTL de la reserva, del mismo orden que el maxDuration de la página. */
  reservationTtlSeconds: 300,
  /** Página de entidades por clave; el servidor sigue hasta agotar el conjunto. */
  entityPageSize: 200,
  entityPageMax: 500,
  /** Tope de páginas por nivel, solo como defensa contra un bucle (500 × 50 = 25 000). */
  entityPagesPerLevelMax: 50,
  breakdownSegments: 50,
  /** Presupuesto de entrada estimado por llamada: ceil(caracteres del JSON / 3). */
  tokenBudget: 150_000,
  maxBatches: 3,
  entityNameMax: 120,
  lowSample: Object.freeze({ impressions: 1_000, clicks: 100, results: 30 }),
  /** Candidatos por categoría y nivel en el paquete. */
  candidatesPerLevel: 5,
});
