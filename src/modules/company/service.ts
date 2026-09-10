import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUserForAction, UnauthorizedError } from '@/modules/identity/session';

/**
 * Resolución y alta de la empresa del usuario.
 *
 * Regla central: el identificador de empresa NUNCA llega desde el navegador. Se resuelve
 * en el servidor a partir de la identidad verificada, consultando la membresía. Aunque
 * alguien enviara un `company_id` en un formulario, no se usaría; y aunque se usara, RLS
 * lo rechazaría.
 */

export type Company = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export class NoCompanyError extends Error {
  constructor() {
    super('El usuario todavía no tiene un espacio de empresa.');
    this.name = 'NoCompanyError';
  }
}

/** Devuelve la empresa del usuario autenticado, o null si todavía no creó ninguna. */
export async function getCurrentCompany(): Promise<Company | null> {
  const supabase = await createSupabaseServerClient();

  // Sin filtro por id: RLS solo deja ver las empresas donde el usuario es miembro.
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, owner_id, created_at, updated_at')
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer la empresa: ${error.message}`);
  return data;
}

/**
 * Crea la empresa del usuario de forma idempotente.
 *
 * Delega en la RPC `create_company_for_current_user`, que es SECURITY INVOKER y opera
 * bajo RLS: deriva el dueño de `auth.uid()` y, ante un reintento o dos pestañas
 * simultáneas, devuelve la empresa existente sin duplicarla ni pisarle el nombre.
 */
export async function ensureCompany(name: string): Promise<Company> {
  await requireUserForAction();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc('create_company_for_current_user', { p_name: name })
    .single<Company>();

  if (error) throw new Error(`No se pudo crear la empresa: ${error.message}`);
  return data;
}

/** Cambia el nombre de la empresa. La pertenencia la verifica RLS, no el cliente. */
export async function renameCompany(name: string): Promise<Company> {
  const user = await requireUserForAction();
  const company = await getCurrentCompany();
  if (!company) throw new NoCompanyError();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('companies')
    .update({ name })
    .eq('id', company.id)
    .select('id, name, owner_id, created_at, updated_at')
    .single();

  if (error) throw new Error(`No se pudo actualizar la empresa: ${error.message}`);
  if (data.owner_id !== user.id) throw new UnauthorizedError();
  return data;
}

/**
 * Verifica que el usuario pertenece a una empresa y devuelve su identificador.
 * Toda operación con datos de empresa pasa por acá.
 */
export async function requireCompanyMembership(): Promise<{ userId: string; companyId: string }> {
  const user = await requireUserForAction();
  const company = await getCurrentCompany();
  if (!company) throw new NoCompanyError();
  return { userId: user.id, companyId: company.id };
}
