/**
 * Mensajes en castellano para los errores de Supabase Auth.
 *
 * Supabase devuelve textos en inglés ("email rate limit exceeded"); a la pantalla llega
 * siempre un mensaje propio. Se decide por `code` (estable) y, para los límites de
 * intentos, también por el estado 429. Lo que no se reconoce cae en `fallback`.
 */

type AuthErrorLike = { code?: string; status?: number; message?: string };

const MESSAGES: Record<string, string> = {
  over_email_send_rate_limit:
    'Enviamos demasiados correos en poco tiempo. Esperá unos minutos y volvé a intentar.',
  over_request_rate_limit: 'Hiciste demasiados intentos. Esperá unos minutos y volvé a intentar.',
  weak_password: 'La contraseña es demasiado débil. Probá con una más larga que combine letras y números.',
  email_address_invalid: 'No podemos usar ese correo. Revisá que esté bien escrito o probá con otro.',
  email_address_not_authorized: 'Por ahora no podemos enviar correos a esa dirección. Probá con otra.',
  signup_disabled: 'El registro de cuentas nuevas está cerrado por ahora.',
  same_password: 'La contraseña nueva tiene que ser distinta de la actual.',
  email_not_confirmed: 'Todavía no confirmaste tu correo. Abrí el enlace que te enviamos.',
};

export function authErrorMessage(error: AuthErrorLike, fallback: string): string {
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error.status === 429) return MESSAGES.over_request_rate_limit;
  return fallback;
}

export const MIN_PASSWORD_LENGTH = 8;

/** Contraseña aceptable para crear o cambiar: `MIN_PASSWORD_LENGTH` caracteres y no solo espacios. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password.trim() === '') return 'La contraseña no puede tener solo espacios.';
  return null;
}
