import { describe, expect, it } from 'vitest';

import { authErrorMessage, passwordProblem } from '@/components/auth/errors';

/** Los errores de Supabase llegan en inglés: a la pantalla va siempre un mensaje propio. */
describe('authErrorMessage', () => {
  const fallback = 'Mensaje por defecto.';

  it.each([
    ['over_email_send_rate_limit', 'Enviamos demasiados correos'],
    ['over_request_rate_limit', 'Hiciste demasiados intentos'],
    ['weak_password', 'demasiado débil'],
    ['email_address_invalid', 'No podemos usar ese correo'],
    ['same_password', 'tiene que ser distinta'],
    ['email_not_confirmed', 'Todavía no confirmaste tu correo'],
  ])('traduce %s', (code, fragmento) => {
    expect(authErrorMessage({ code, message: 'english text' }, fallback)).toContain(fragmento);
  });

  it('un 429 sin código conocido pide esperar', () => {
    expect(authErrorMessage({ status: 429 }, fallback)).toContain('Esperá unos minutos');
  });

  it('lo desconocido usa el mensaje por defecto, nunca el texto de Supabase', () => {
    expect(authErrorMessage({ code: 'otro_codigo', status: 500, message: 'Database error' }, fallback)).toBe(
      fallback,
    );
  });
});

describe('passwordProblem', () => {
  it.each([
    ['1234567', 'al menos 8 caracteres'],
    ['        ', 'solo espacios'],
  ])('rechaza %j', (password, fragmento) => {
    expect(passwordProblem(password)).toContain(fragmento);
  });

  it.each(['12345678', '  con espacios  ', 'Contraseña Ñ 😀'])('acepta %j', (password) => {
    expect(passwordProblem(password)).toBeNull();
  });
});
