import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El enlace para cambiar la contraseña (Recuperar acceso y Mi perfil) siempre vuelve por
 * /auth/callback a /reset-password, que guarda la nueva y cierra todas las sesiones.
 */

const resetPasswordForEmail = vi.fn();
vi.mock('@/lib/env', () => ({ getSiteUrl: () => 'https://praxa.example' }));
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { resetPasswordForEmail: (...a: unknown[]) => resetPasswordForEmail(...a) },
  }),
}));

const { enviarEnlaceDeContrasena } = await import('@/components/auth/recovery');

describe('enviarEnlaceDeContrasena', () => {
  beforeEach(() => resetPasswordForEmail.mockReset());

  it('pide el correo con destino /reset-password a través del callback', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    expect(await enviarEnlaceDeContrasena('persona@ejemplo.com')).toBeNull();
    expect(resetPasswordForEmail).toHaveBeenCalledWith('persona@ejemplo.com', {
      redirectTo: 'https://praxa.example/auth/callback?next=%2Freset-password',
    });
  });

  it('traduce el límite de envíos de Supabase', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { code: 'over_email_send_rate_limit', status: 429 } });
    expect(await enviarEnlaceDeContrasena('persona@ejemplo.com')).toMatch(/demasiados correos/);
  });
});
