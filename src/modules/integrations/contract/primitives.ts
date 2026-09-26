import { z } from 'zod';

/**
 * Primitivas compartidas por los contratos K02 a K04 del conector.
 *
 * Estos esquemas validan lo que produce el código de la aplicación. No reemplazan a la
 * base: las transiciones de estado y el consumo único de un intento los hace cumplir
 * `worker_api` (M06.1a), porque a la base se puede llegar por otras vías.
 */

export const uuidSchema = z.uuid();
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

/** SHA-256 en hexadecimal, en minúsculas. Lo único que se persiste de un secreto de un solo uso. */
export const sha256HexSchema = z.string().regex(/^[0-9a-f]{64}$/, 'debe ser un SHA-256 en hex');

/** Material binario codificado en base64 estándar, con relleno. */
export const base64Schema = z
  .string()
  .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, 'debe ser base64');

export function base64OfBytes(bytes: number) {
  return base64Schema.refine((value) => Buffer.from(value, 'base64').length === bytes, {
    message: `debe decodificar a ${bytes} bytes`,
  });
}

// ---------------------------------------------------------------------------
// Proveedor y estados
// ---------------------------------------------------------------------------

/** CA-05: enum cerrado. Agregar un proveedor es una decisión, no un valor nuevo. */
export const integrationProviderSchema = z.enum(['meta']);
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;

/** CA-07. `disconnected` significa "borrado en curso": la purga elimina la fila. */
export const CONNECTION_STATUSES = [
  'pending_selection',
  'active',
  'needs_reauth',
  'disconnected',
] as const;

export const connectionStatusSchema = z.enum(CONNECTION_STATUSES);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

/** Transiciones declaradas en CA-07. Cualquier otra, incluida la identidad, se rechaza. */
export const CONNECTION_TRANSITIONS: Readonly<Record<ConnectionStatus, readonly ConnectionStatus[]>> =
  Object.freeze({
    pending_selection: Object.freeze(['active', 'disconnected'] as const),
    active: Object.freeze(['needs_reauth', 'disconnected'] as const),
    needs_reauth: Object.freeze(['active', 'disconnected'] as const),
    disconnected: Object.freeze([] as const),
  });

export function isDeclaredTransition(from: ConnectionStatus, to: ConnectionStatus): boolean {
  if (!Object.hasOwn(CONNECTION_TRANSITIONS, from)) return false;
  return CONNECTION_TRANSITIONS[from].includes(to);
}

export class ConnectionTransitionError extends Error {
  constructor(
    readonly from: ConnectionStatus,
    readonly to: ConnectionStatus,
  ) {
    super(`Transición no declarada: ${from} → ${to}.`);
    this.name = 'ConnectionTransitionError';
  }
}

export function assertConnectionTransition(from: ConnectionStatus, to: ConnectionStatus): void {
  if (!isDeclaredTransition(from, to)) throw new ConnectionTransitionError(from, to);
}

// ---------------------------------------------------------------------------
// Retorno después de OAuth
// ---------------------------------------------------------------------------

/**
 * CA-04: rutas internas a las que puede volver el callback. Es una lista de valores
 * exactos, no un prefijo ni un patrón: una URL absoluta, una ruta con consulta o una
 * ruta que no está en la lista no valida.
 */
export const RETURN_PATH_ALLOWLIST = ['/app/integraciones'] as const;

export const returnPathSchema = z.enum(RETURN_PATH_ALLOWLIST);
export type ReturnPath = z.infer<typeof returnPathSchema>;

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

/** Clases de error de CA-39 (spec, sección 10). La clasificación la hace M16. */
export const integrationErrorClassSchema = z.enum([
  'authentication',
  'user_action',
  'permission',
  'asset_access',
  'rate_limit',
  'temporary',
  'own_error',
  'transport',
  'unknown',
]);
export type IntegrationErrorClass = z.infer<typeof integrationErrorClassSchema>;

/**
 * Las únicas clases que, según CA-39, llevan la conexión a `needs_reauth`. Las demás la
 * dejan como estaba; `unknown` nunca pasa automáticamente a `needs_reauth`.
 */
export const reauthErrorClassSchema = integrationErrorClassSchema.extract([
  'authentication',
  'user_action',
  'permission',
  'asset_access',
]);
export type ReauthErrorClass = z.infer<typeof reauthErrorClassSchema>;

export const REDACTED_ERROR_MESSAGE_MAX = 500;

const REDACTED = '[redactado]';
const URL_PATTERN = /\bhttps?:\/\/[^\s"'<>]+/gi;
// R-01: la Graph API lleva la cuenta en la ruta (`/act_.../insights`), no solo en la
// consulta. `\b` antes de `act_` no separa "contact_id" ni "react_native": ahí "act_" está
// pegado a una letra, sin transición entre caracteres de palabra.
const ACCOUNT_ID_PATTERN = /\bact_[A-Za-z0-9_-]+\b/gi;
const SENSITIVE_PAIR_PATTERN =
  /\b(access_token|input_token|fb_exchange_token|token|code|state|client_secret|app_secret|appsecret_proof|password)[=:]\s*([^&\s"'<>]+)/gi;
const SENSITIVE_JSON_PATTERN =
  /"(access_token|input_token|fb_exchange_token|token|code|state|client_secret|app_secret|appsecret_proof|password)"(\s*:\s*)"(?:[^"\\]|\\.)*"/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;

function maskAccountIds(text: string): string {
  return text.replace(ACCOUNT_ID_PATTERN, () => `act_${REDACTED}`);
}

function redactUrl(match: string): string {
  let url: URL;
  try {
    url = new URL(match);
  } catch {
    return '[url redactada]';
  }
  const maskedPathname = maskAccountIds(url.pathname);
  const pathHadAccountId = maskedPathname !== url.pathname;
  const hasSensitiveParts = url.search !== '' || url.hash !== '' || url.username !== '' || url.password !== '';
  if (!hasSensitiveParts && !pathHadAccountId) return match;
  if (!hasSensitiveParts) return `${url.origin}${maskedPathname}`;
  return `${url.origin}${maskedPathname}?${REDACTED}`;
}

/**
 * CA-09: quita de un mensaje de error lo que no puede persistirse ni mostrarse. Elimina
 * la consulta, el fragmento y las credenciales de cada URL, y enmascara la cuenta si va
 * en la ruta (R-01); los pares `clave=valor` y `clave: valor` (R-02), y `"clave": "valor"`
 * de nombres sensibles; y las credenciales `Bearer`. Es idempotente.
 *
 * No intenta reconocer tokens sueltos por su forma (CA-06): eso no garantiza nada y
 * puede romper textos legítimos. Lo que evita las fugas es no poner el token en el
 * mensaje; esta función cubre las formas en que un cliente HTTP suele filtrarlo.
 */
export function redactErrorMessage(message: string): string {
  const redacted = message
    .replace(URL_PATTERN, redactUrl)
    .replace(ACCOUNT_ID_PATTERN, () => `act_${REDACTED}`)
    .replace(SENSITIVE_PAIR_PATTERN, (_match, key: string) => `${key}=${REDACTED}`)
    .replace(
      SENSITIVE_JSON_PATTERN,
      (_match, key: string, colon: string) => `"${key}"${colon}"${REDACTED}"`,
    )
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`);
  // Cortar después de redactar no rompe la idempotencia: si el corte deja un marcador a
  // medias (`code=[redac`), la segunda pasada lo reexpande sin cambiar el prefijo y el
  // mismo corte devuelve el mismo texto.
  return redacted.slice(0, REDACTED_ERROR_MESSAGE_MAX);
}

/** Un mensaje que ya pasó por `redactErrorMessage`. Rechaza el que todavía tiene algo que quitar. */
export const redactedErrorMessageSchema = z
  .string()
  .trim()
  .min(1)
  .max(REDACTED_ERROR_MESSAGE_MAX)
  .refine((message) => redactErrorMessage(message) === message, {
    message: 'el mensaje de error no está redactado',
  });
