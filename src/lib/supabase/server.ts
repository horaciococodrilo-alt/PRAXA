import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { requireSupabaseEnv } from '@/lib/env';

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * Usa exclusivamente la clave publishable y la sesión del usuario en cookies: toda
 * consulta queda sujeta a RLS. No existe un cliente privilegiado en la aplicación.
 */
export async function createSupabaseServerClient() {
  // El orden importa: leer cookies primero marca la ruta como dinámica antes de que la
  // validación de entorno pueda lanzar. Si no, Next intenta prerenderizar en el build y
  // falla con el error de configuración en vez de tratarla como ruta dinámica.
  const cookieStore = await cookies();
  const env = requireSupabaseEnv();

  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Los Server Components no pueden escribir cookies. El refresco de sesión lo
          // hace `proxy.ts`, así que ignorar esto acá es correcto y esperado.
        }
      },
    },
  });
}
