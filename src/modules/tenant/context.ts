import 'server-only';

import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCompanyMembership } from '@/modules/company/service';
import { requireUserForAction } from '@/modules/identity/session';

/**
 * K01 `TenantContext`: identidad de tenant que consumen las operaciones del conector.
 *
 * Solo se construye en el servidor, con `requireTenantContext()`. El usuario sale de
 * `getClaims()`, la empresa de la membresía y el rol de la fila de `company_members`,
 * leída bajo RLS. El constructor no recibe parámetros: una Server Action que necesite el
 * contexto lo construye adentro y nunca lo acepta como argumento, así que un
 * `company_id` enviado por el navegador no tiene por dónde entrar (CA-00).
 */

export const tenantRoleSchema = z.literal('owner');

export const tenantContextSchema = z.strictObject({
  user_id: z.uuid(),
  company_id: z.uuid(),
  role: tenantRoleSchema,
  request_id: z.uuid(),
});

export type TenantContext = Readonly<z.infer<typeof tenantContextSchema>>;

export class TenantContextError extends Error {
  constructor(message = 'No se pudo establecer el contexto de empresa.') {
    super(message);
    this.name = 'TenantContextError';
  }
}

export async function requireTenantContext(): Promise<TenantContext> {
  const user = await requireUserForAction();
  const { userId, companyId } = await requireCompanyMembership();
  if (userId !== user.id) throw new TenantContextError();

  const supabase = await createSupabaseServerClient();
  const { data: membership, error } = await supabase
    .from('company_members')
    .select('company_id, user_id, role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .maybeSingle();

  // Error tipado sin el detalle de la base (spec, sección 7).
  if (error) throw new TenantContextError('No se pudo verificar la membresía.');
  if (!membership) throw new TenantContextError('El usuario no es miembro de la empresa.');
  if (membership.company_id !== companyId || membership.user_id !== user.id) {
    throw new TenantContextError();
  }

  const parsed = tenantContextSchema.safeParse({
    user_id: user.id,
    company_id: companyId,
    role: membership.role,
    request_id: crypto.randomUUID(),
  });
  if (!parsed.success) throw new TenantContextError();

  return Object.freeze(parsed.data);
}
