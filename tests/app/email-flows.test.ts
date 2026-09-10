import { afterAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  blockedReason,
  cleanupRun,
  remoteProjectReachable,
  testEmail,
  trackUserId,
} from './helpers';

/**
 * Registro, verificación de correo y recuperación de acceso contra el proyecto remoto.
 *
 * Alcance real de lo que se puede automatizar acá: que el proyecto EXIJA la confirmación
 * y que acepte el pedido de recuperación. **Abrir el enlace del correo no se verifica
 * automáticamente**: la casilla está fuera del alcance de la suite. Ese paso queda como
 * comprobación manual descrita en el README.
 *
 * Son opt-in porque consumen la cuota de correo del proyecto: el SMTP que Supabase
 * provee por defecto tiene un límite bajo por hora, y agotarlo dejaría al proyecto sin
 * poder enviar confirmaciones reales durante un rato.
 */

const blocked = blockedReason();
const optedIn = process.env.SUPABASE_TEST_EMAIL_FLOWS === 'true';
const reachable = blocked || !optedIn ? false : await remoteProjectReachable();
const canRun = !blocked && optedIn && reachable;

const skipReason = blocked
  ? blocked
  : !optedIn
    ? 'Definí SUPABASE_TEST_EMAIL_FLOWS=true para ejecutarlas (consumen la cuota de correo del proyecto).'
    : 'El proyecto remoto de Supabase no respondió.';

/** El límite de envíos del proveedor no es un fallo del producto: se informa distinto. */
function isRateLimit(message: string | undefined): boolean {
  return /rate limit|too many requests|429/i.test(message ?? '');
}

describe.skipIf(!canRun)('flujos de correo (proyecto remoto)', () => {
  afterAll(async () => {
    await cleanupRun();
  });

  it('el registro exige confirmación: no devuelve sesión iniciada', async () => {
    const email = testEmail('signup');
    const { data, error } = await anonClient().auth.signUp({
      email,
      password: 'praxa-test-password-123',
      options: { emailRedirectTo: 'http://localhost:3000/auth/callback?next=%2Fonboarding' },
    });

    if (error && isRateLimit(error.message)) {
      console.warn(
        `[praxa] NO VERIFICADO: el proveedor de correo limitó el envío (${error.message}).`,
      );
      return;
    }

    expect(error).toBeNull();
    trackUserId(data.user?.id);

    // Con la confirmación activada, el registro NO inicia sesión.
    expect(data.session).toBeNull();
    expect(data.user).not.toBeNull();
    expect(data.user!.email_confirmed_at ?? null).toBeNull();
  });

  it('sin confirmar el correo no se puede iniciar sesión', async () => {
    const email = testEmail('unconfirmed');
    const password = 'praxa-test-password-123';

    const { data, error: signUpError } = await anonClient().auth.signUp({ email, password });

    if (signUpError && isRateLimit(signUpError.message)) {
      console.warn('[praxa] NO VERIFICADO: el proveedor de correo limitó el envío.');
      return;
    }
    trackUserId(data.user?.id);

    const { error } = await anonClient().auth.signInWithPassword({ email, password });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/confirm/i);
  });

  it('la recuperación de acceso se acepta sin revelar si la cuenta existe', async () => {
    const { error } = await anonClient().auth.resetPasswordForEmail(testEmail('recovery'), {
      redirectTo: 'http://localhost:3000/auth/callback?next=%2Freset-password',
    });

    if (error && isRateLimit(error.message)) {
      console.warn('[praxa] NO VERIFICADO: el proveedor de correo limitó el envío.');
      return;
    }

    expect(error).toBeNull();
  });
});

describe.skipIf(canRun)('flujos de correo', () => {
  it('NO EJECUTADA: requiere proyecto remoto y activación explícita', () => {
    console.warn(`[praxa] pruebas de correo omitidas: ${skipReason}`);
    expect(canRun).toBe(false);
  });
});
