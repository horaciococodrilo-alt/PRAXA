import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Identidad verificada en el servidor.
 *
 * Se usa `getClaims()`, que valida la firma del JWT, y nunca `getSession()`, que no
 * garantiza revalidación del token en contexto de servidor. El proxy redirige de entrada,
 * pero no alcanza como prueba de identidad: toda página protegida y toda Server Action
 * vuelve a verificar acá.
 */

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) return null;

  const claims = data.claims;
  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
  };
}

/** Para páginas: redirige al login si no hay identidad verificada. */
export async function requireUser(nextPath?: string): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (user) return user;

  const target = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';
  redirect(target);
}

export class UnauthorizedError extends Error {
  constructor(message = 'Se requiere una sesión autenticada.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/** Para Server Actions: lanza en vez de redirigir, para devolver un error manejable. */
export async function requireUserForAction(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
