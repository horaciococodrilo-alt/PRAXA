/**
 * Resultados cerrados del flujo OAuth con Meta y sus mensajes (D-M16.1-01).
 *
 * El callback redirige a `/app/integraciones?meta=<resultado>` y la página muestra solo el
 * texto de esta lista: ningún otro parámetro de la URL ni texto del proveedor llega a la
 * pantalla. Sin datos: lógica pura, importable desde la página.
 */

export const META_OAUTH_OUTCOMES = [
  'pendiente',
  'cancelado',
  'rechazado',
  'permiso_faltante',
  'token_no_valido',
  'conexion_existente',
  'pendiente_vigente',
  'reautorizacion_no_disponible',
  'credencial_cambio',
  'sin_empresa',
  'meta_no_disponible',
  'error',
] as const;

export type MetaOAuthOutcome = (typeof META_OAUTH_OUTCOMES)[number];

export type MetaOAuthMessage = Readonly<{ tone: 'ok' | 'info' | 'error'; text: string }>;

export const META_OAUTH_MESSAGES: Readonly<Record<MetaOAuthOutcome, MetaOAuthMessage>> = Object.freeze({
  pendiente: { tone: 'ok', text: 'Autorizaste a Praxa en Meta. Falta elegir la cuenta publicitaria.' },
  cancelado: {
    tone: 'info',
    text: 'Cancelaste la conexión con Meta. No se guardó nada. Podés intentarlo de nuevo cuando quieras.',
  },
  // Mismo texto que `OAuthAttemptRejectedError` (K02).
  rechazado: { tone: 'error', text: 'La autorización no es válida o ya se usó. Volvé a iniciar la conexión.' },
  permiso_faltante: {
    tone: 'error',
    text: 'Meta no concedió el permiso de lectura de anuncios (ads_read). No se creó la conexión.',
  },
  token_no_valido: {
    tone: 'error',
    text: 'Meta devolvió una autorización que Praxa no puede usar. No se creó la conexión.',
  },
  conexion_existente: { tone: 'info', text: 'Tu empresa ya tiene una conexión con Meta.' },
  pendiente_vigente: { tone: 'info', text: 'Tenés una conexión con Meta pendiente de confirmar.' },
  reautorizacion_no_disponible: { tone: 'info', text: 'La reconexión con Meta todavía no está disponible.' },
  credencial_cambio: {
    tone: 'error',
    text: 'La conexión cambió mientras autorizabas. Volvé a iniciar la reconexión.',
  },
  sin_empresa: { tone: 'error', text: 'Primero completá los datos de tu empresa en Configuración.' },
  meta_no_disponible: { tone: 'error', text: 'Meta no respondió como esperábamos. Probá de nuevo en unos minutos.' },
  error: { tone: 'error', text: 'No pudimos completar la conexión. Probá de nuevo más tarde.' },
});

const KNOWN = new Set<string>(META_OAUTH_OUTCOMES);

/** Ante la duda, `null`: un valor repetido, vacío o desconocido no muestra nada. */
export function parseMetaOAuthOutcome(value: string | string[] | undefined): MetaOAuthOutcome | null {
  return typeof value === 'string' && KNOWN.has(value) ? (value as MetaOAuthOutcome) : null;
}
