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
  'desconectado',
  'desconexion_en_curso',
  'conectado',
  'reautorizado',
  'cuenta_no_delegada',
  'cuenta_invalida',
  'prueba_fallida',
  'pendiente_vencida',
  'conexion_cambio',
  'credencial_cambio',
  'sin_empresa',
  'meta_no_disponible',
  'error',
] as const;

export type MetaOAuthOutcome = (typeof META_OAUTH_OUTCOMES)[number];

export type MetaOAuthMessage = Readonly<{ tone: 'ok' | 'info' | 'error'; text: string }>;

export const META_OAUTH_MESSAGES: Readonly<Record<MetaOAuthOutcome, MetaOAuthMessage>> = Object.freeze({
  pendiente: { tone: 'ok', text: 'Autorizaste a Praxa en Meta. Elegí la cuenta publicitaria y confirmala.' },
  cancelado: {
    tone: 'info',
    text: 'Cancelaste la conexión con Meta. No se guardó nada. Podés intentarlo de nuevo cuando quieras.',
  },
  // Mismo texto que `OAuthAttemptRejectedError` (K02).
  rechazado: { tone: 'error', text: 'La autorización no es válida o ya se usó. Volvé a iniciar la conexión. Si llegaste a autorizar en Meta, podés quitar a Praxa desde la configuración de tu negocio, en las integraciones o apps conectadas.' },
  permiso_faltante: {
    tone: 'error',
    text: 'Meta no concedió el permiso de lectura de anuncios (ads_read). No se creó la conexión.',
  },
  token_no_valido: {
    tone: 'error',
    text: 'Meta devolvió una autorización que Praxa no puede usar. No se creó la conexión.',
  },
  conexion_existente: { tone: 'info', text: 'Tu empresa ya tiene una conexión con Meta.' },
  pendiente_vigente: { tone: 'info', text: 'Tenés una conexión con Meta pendiente de confirmar. Elegí la cuenta o cancelá la conexión.' },
  desconectado: { tone: 'ok', text: 'Desconectaste Meta. Se borraron la credencial y los datos de la conexión de la base activa. Si el proyecto usa Supabase Pro, las copias nocturnas pueden conservarlos hasta 7 días.' },
  desconexion_en_curso: { tone: 'info', text: 'La desconexión no terminó. Se va a completar la próxima vez que abras esta página.' },
  conectado: { tone: 'ok', text: 'Conectaste tu cuenta publicitaria de Meta.' },
  reautorizado: { tone: 'ok', text: 'Volviste a autorizar a Praxa en Meta.' },
  cuenta_no_delegada: { tone: 'error', text: 'La cuenta conectada ya no está entre las que compartiste con Praxa. Para usar otra cuenta, desconectá primero.' },
  cuenta_invalida: { tone: 'error', text: 'No pudimos usar esa cuenta. Elegí otra o volvé a intentarlo.' },
  prueba_fallida: { tone: 'error', text: 'Meta no dejó leer esa cuenta. La conexión no se activó.' },
  pendiente_vencida: { tone: 'error', text: 'La conexión pendiente venció. Volvé a conectar Meta.' },
  conexion_cambio: { tone: 'error', text: 'La conexión cambió mientras la confirmabas. Revisá su estado.' },
  credencial_cambio: {
    tone: 'error',
    text: 'La conexión cambió mientras autorizabas. Volvé a iniciar la reconexión.',
  },
  sin_empresa: { tone: 'error', text: 'Primero completá los datos de tu empresa en Configuración.' },
  meta_no_disponible: { tone: 'error', text: 'Meta no respondió como esperábamos. Probá de nuevo en unos minutos. Si llegaste a autorizar en Meta, podés quitar a Praxa desde la configuración de tu negocio, en las integraciones o apps conectadas.' },
  error: { tone: 'error', text: 'No pudimos completar la conexión. Probá de nuevo más tarde.' },
});

const KNOWN = new Set<string>(META_OAUTH_OUTCOMES);

/** Ante la duda, `null`: un valor repetido, vacío o desconocido no muestra nada. */
export function parseMetaOAuthOutcome(value: string | string[] | undefined): MetaOAuthOutcome | null {
  return typeof value === 'string' && KNOWN.has(value) ? (value as MetaOAuthOutcome) : null;
}
