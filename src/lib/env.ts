/**
 * Configuración pública de Supabase.
 *
 * Se lee de forma perezosa a propósito: la landing y las páginas informativas tienen que
 * poder renderizarse en un entorno sin configurar, y las páginas que sí necesitan
 * Supabase deben fallar con un mensaje comprensible en vez de romper el proceso durante
 * el build.
 *
 * Acá NO hay claves privilegiadas. La aplicación no usa ninguna credencial de servicio:
 * todo el acceso a datos ocurre con la clave publishable, bajo la sesión del usuario y
 * sujeto a RLS. Una prueba automática verifica esta invariante
 * (tests/unit/no-privileged-credentials.test.ts). Ver docs/SECURITY.md.
 */

export class MissingSupabaseConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(
      `Falta configuración de Supabase: ${missing.join(', ')}. ` +
        'Copiá .env.example a .env.local y completá los valores (ver README.md).',
    );
    this.name = 'MissingSupabaseConfigError';
    this.missing = missing;
  }
}

export type SupabaseEnv = {
  url: string;
  publishableKey: string;
};

export function readSupabaseEnv(): SupabaseEnv | null {
  // Referencias estáticas: Next.js reemplaza estas expresiones en tiempo de build.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function requireSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();
  if (env) return env;

  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }
  throw new MissingSupabaseConfigError(missing);
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseEnv() !== null;
}

/** URL pública del sitio, usada para los enlaces de confirmación y recuperación. */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}
