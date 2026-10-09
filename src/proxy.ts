import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { readSupabaseEnv } from '@/lib/env';

/**
 * Proxy de Next.js 16 (antes `middleware.ts`).
 *
 * ESTO NO ES LA AUTORIZACIÓN FINAL. Hace dos cosas y nada más:
 *   1. refresca el token de sesión y reescribe las cookies, porque los Server Components
 *      no pueden escribirlas;
 *   2. redirige de entrada para que un visitante sin sesión no vea el esqueleto de la
 *      aplicación.
 *
 * La documentación de Next.js es explícita: las Server Functions son POST a la ruta donde
 * se usan, y un cambio de `matcher` o mover una acción de ruta puede quitarles cobertura
 * en silencio. Por eso cada página protegida y cada Server Action revalida la identidad
 * con `getClaims()` y la pertenencia a la empresa por su cuenta. Ver docs/SECURITY.md.
 */

const PROTECTED_PREFIXES = ['/app', '/onboarding'];
const AUTH_ONLY_PREFIXES = ['/login', '/signup'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = readSupabaseEnv();
  // Sin configuración no hay sesión que refrescar. Las páginas protegidas muestran el
  // error de configuración por su cuenta, con un mensaje entendible.
  if (!env) return response;

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims() valida la firma del JWT; getSession() no garantiza revalidación.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);

  const { pathname } = request.nextUrl;

  if (!isAuthenticated && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && AUTH_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = '/app';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
