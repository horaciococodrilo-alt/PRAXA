import { getSiteUrl } from '@/lib/env';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import { authErrorMessage } from './errors';

/**
 * Pide a Supabase el correo con el enlace para elegir una contraseña nueva. El enlace pasa
 * por /auth/callback y termina en /reset-password, que guarda la contraseña y cierra todas
 * las sesiones. Lo usan "Recuperar acceso" y "Cambiar contraseña" de Mi perfil.
 *
 * Devuelve el mensaje de error para mostrar, o `null` si el pedido se aceptó.
 */
export async function enviarEnlaceDeContrasena(email: string): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
  });
  return error
    ? authErrorMessage(error, 'No pudimos enviar el enlace. Intentá de nuevo en unos minutos.')
    : null;
}
