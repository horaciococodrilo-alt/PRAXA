import 'server-only';

import type { IntegrationErrorClass } from '@/modules/integrations/contract';

/**
 * Clasificación de errores de Tiendanube (M16e, «Clasificación de errores», patrón CA-39).
 *
 * Cada tipo se guarda con una clase existente de `last_error_class`, así el `check` de la
 * conexión no cambia. Clasifica por estado HTTP: el cuerpo de la respuesta no se lee ni se
 * copia al error, porque puede traer datos de la tienda.
 */

export type TiendanubeErrorKind =
  | 'credencial_invalida'
  | 'permiso_faltante'
  | 'tienda_suspendida'
  | 'solicitud_invalida'
  | 'campo_invalido'
  | 'cuota'
  | 'transitorio'
  | 'transporte'
  | 'no_encontrado'
  | 'desconocido';

/** El recurso decide el 404: un producto borrado no es un error de conexión. */
export type TiendanubeResource = 'token' | 'store' | 'order' | 'product';

export type TiendanubeFailure = Readonly<{ kind: TiendanubeErrorKind; errorClass: IntegrationErrorClass | null }>;

const MESSAGES: Readonly<Record<TiendanubeErrorKind, string>> = Object.freeze({
  credencial_invalida: 'Tiendanube rechazó la credencial.',
  permiso_faltante: 'Falta un permiso de lectura en Tiendanube.',
  tienda_suspendida: 'La tienda está suspendida en Tiendanube.',
  solicitud_invalida: 'Tiendanube rechazó la solicitud.',
  campo_invalido: 'Tiendanube rechazó un campo de la solicitud.',
  cuota: 'Se alcanzó la cuota de Tiendanube.',
  transitorio: 'Tiendanube no respondió a tiempo.',
  transporte: 'No se pudo conectar con Tiendanube.',
  no_encontrado: 'Tiendanube no encontró el recurso.',
  desconocido: 'Tiendanube respondió de forma inesperada.',
});

/** Traduce un código HTTP de Tiendanube (401, 403, 429…) a un tipo de error. */
export function classifyTiendanubeStatus(status: number, resource: TiendanubeResource): TiendanubeFailure {
  if (status === 401) return { kind: 'credencial_invalida', errorClass: 'authentication' };
  if (status === 403) return { kind: 'permiso_faltante', errorClass: 'permission' };
  if (status === 402) return { kind: 'tienda_suspendida', errorClass: 'user_action' };
  if (status === 400) return { kind: 'solicitud_invalida', errorClass: 'own_error' };
  if (status === 422) return { kind: 'campo_invalido', errorClass: 'own_error' };
  if (status === 429) return { kind: 'cuota', errorClass: 'rate_limit' };
  if (status >= 500 && status <= 599) return { kind: 'transitorio', errorClass: 'temporary' };
  if (status === 404) return { kind: 'no_encontrado', errorClass: resource === 'product' ? null : 'unknown' };
  return { kind: 'desconocido', errorClass: 'unknown' };
}

/** Error de una llamada a Tiendanube, con su tipo, código HTTP y espera sugerida. */
export class TiendanubeApiError extends Error {
  readonly kind: TiendanubeErrorKind;
  readonly errorClass: IntegrationErrorClass | null;
  readonly status: number | null;
  /** Solo en `429`: espera indicada por `x-rate-limit-reset`. */
  readonly retryAfterMs: number | null;

  constructor(failure: TiendanubeFailure, status: number | null = null, retryAfterMs: number | null = null) {
    super(MESSAGES[failure.kind]);
    this.name = 'TiendanubeApiError';
    this.kind = failure.kind;
    this.errorClass = failure.errorClass;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }

  /** Texto fijo, apto para `last_error_message`. */
  get redactedMessage(): string {
    return MESSAGES[this.kind];
  }
}

/** Crea el error de «no se pudo conectar» con Tiendanube. */
export function tiendanubeTransportError(): TiendanubeApiError {
  return new TiendanubeApiError({ kind: 'transporte', errorClass: 'transport' });
}

/** Crea el error de «Tiendanube tardó demasiado». */
export function tiendanubeTimeoutError(): TiendanubeApiError {
  return new TiendanubeApiError({ kind: 'transitorio', errorClass: 'temporary' });
}

/** `401` y `403` llevan la conexión a `needs_reauth`; el resto no cambia su estado. */
export function tiendanubeConnectionEffect(error: TiendanubeApiError): 'needs_reauth' | 'unchanged' {
  return error.kind === 'credencial_invalida' || error.kind === 'permiso_faltante' ? 'needs_reauth' : 'unchanged';
}
