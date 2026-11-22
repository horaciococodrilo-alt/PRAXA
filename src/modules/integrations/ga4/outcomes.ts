/** Listas cerradas para los resultados de la URL de Integraciones. */
export const GA4_MESSAGES = {
  pendiente: { text: 'Autorización recibida. Elegí y verificá la propiedad.', tone: 'info' },
  reautorizado: { text: 'Google Analytics volvió a autorizarse.', tone: 'info' },
  reintentar: { text: 'La autorización venció. Volvé a intentarlo.', tone: 'error' },
  cancelado: { text: 'Cancelaste la autorización.', tone: 'info' },
  rechazado: { text: 'Google no autorizó la conexión.', tone: 'error' },
  otra_propiedad: { text: 'La propiedad es distinta de la conectada. Volvé a elegir.', tone: 'error' },
  propiedad_no_disponible: { text: 'Esa propiedad ya no está disponible.', tone: 'error' },
  conexion_existente: { text: 'Ya hay una conexión de Google Analytics.', tone: 'error' },
  conexion_en_curso: { text: 'Hay una conexión en curso. Probá de nuevo en unos minutos.', tone: 'info' },
  credencial_cambio: { text: 'La autorización cambió mientras procesábamos la solicitud.', tone: 'error' },
  sin_empresa: { text: 'Completá primero los datos de la empresa.', tone: 'error' },
  desconectado: { text: 'Google Analytics se desconectó y se borraron sus datos activos.', tone: 'info' },
  desconexion_en_curso: { text: 'La desconexión sigue en curso.', tone: 'info' },
  conectado: { text: 'Propiedad de Google Analytics verificada y conectada.', tone: 'info' },
  confirmacion_requerida: { text: 'Confirmá que esta propiedad mide tu sitio.', tone: 'error' },
  sin_flujo_web: { text: 'La propiedad no tiene un flujo web verificable.', tone: 'error' },
  informe_base_no_disponible: { text: 'La propiedad no permite los informes básicos.', tone: 'error' },
  error: { text: 'No pudimos completar la operación de Google Analytics.', tone: 'error' },
} as const;

export const GA4_SYNC_MESSAGES = {
  completa: { text: 'La sincronización de Google Analytics terminó.', tone: 'info' },
  parcial: { text: 'La sincronización quedó incompleta. Podés continuarla.', tone: 'info' },
  cuota: { text: 'Google limitó las solicitudes. Continuá más tarde.', tone: 'info' },
  en_curso: { text: 'Ya hay una sincronización en curso.', tone: 'info' },
  requiere_reauth: { text: 'Google requiere volver a autorizar la conexión.', tone: 'error' },
  conexion_cambio: { text: 'La conexión cambió. No se publicaron los datos en vuelo.', tone: 'error' },
  sin_conexion: { text: 'Conectá una propiedad antes de sincronizar.', tone: 'error' },
  error: { text: 'No pudimos completar la sincronización.', tone: 'error' },
} as const;

/** Texto del aviso de conexión de GA4 según el código de la URL. */
export function ga4Notice(value: unknown): { text: string; tone: 'info' | 'error' } | null {
  return typeof value === 'string' && Object.hasOwn(GA4_MESSAGES, value)
    ? GA4_MESSAGES[value as keyof typeof GA4_MESSAGES] : null;
}
/** Texto del aviso de sincronización de GA4 según el código de la URL. */
export function ga4SyncNotice(value: unknown): { text: string; tone: 'info' | 'error' } | null {
  return typeof value === 'string' && Object.hasOwn(GA4_SYNC_MESSAGES, value)
    ? GA4_SYNC_MESSAGES[value as keyof typeof GA4_SYNC_MESSAGES] : null;
}
