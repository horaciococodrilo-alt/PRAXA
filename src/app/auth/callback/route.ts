import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Punto de aterrizaje de los enlaces de correo: confirmación de cuenta y recuperación
 * de acceso.
 *
 * Acepta las dos formas con las que Supabase puede volver, según el flujo configurado:
 *   - `code`                → intercambio PKCE por sesión.
 *   - `token_hash` + `type` → verificación de OTP por enlace.
 *
 * `next` se valida como ruta interna: un `next` absoluto convertiría esto en un redirect
 * abierto hacia un dominio de terceros.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  const requestedNext = searchParams.get('next');
  const next =
    requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : '/app';

  const failure = (reason: string) =>
    NextResponse.redirect(`${origin}/verify-email?error=${encodeURIComponent(reason)}`);

  try {
    const supabase = await createSupabaseServerClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return failure('link-invalid');
      return NextResponse.redirect(`${origin}${next}`);
    }

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) return failure('link-invalid');
      return NextResponse.redirect(`${origin}${next}`);
    }

    return failure('link-missing-params');
  } catch {
    // Configuración ausente u otro fallo del servidor: no se filtra el detalle.
    return failure('server-error');
  }
}
