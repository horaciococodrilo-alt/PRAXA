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
  /** Tiempo (Diseño §3): plazo total con reserva para publicar; cada paso con su propio tope. */
  maxDurationSeconds: 300,
  totalDeadlineMs: 240_000,
  publishReserveMs: 30_000,
  webTimeoutMs: 45_000,
  reportTimeoutMs: 120_000,
  reportMaxTokens: 12_000,
  webMaxTokens: 4_000,
  webMaxUses: 3,
  /** Contexto web: fuentes y extractos aceptados, ya validados. */
  webMaxSources: 5,
  webExcerptsPerSource: 3,
  webExcerptChars: 400,
  /** Salida del modelo (aplicados en Zod, no en el esquema enviado: H-09). */
  output: Object.freeze({
    summaryChars: 1_200, noteChars: 400, breakdownChars: 600, titleChars: 120, rationaleChars: 600,
    actionChars: 400, checkPlanChars: 400, uncertaintyChars: 300, webNoteChars: 300,
    topEntities: 10, opportunities: 3, webNotes: 3, batchNotes: 10, evidenceIdsPerItem: 20,
  }),
});
