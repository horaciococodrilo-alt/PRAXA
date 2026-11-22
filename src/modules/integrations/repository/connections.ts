import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { integrationProviderSchema, uuidSchema, type IntegrationProvider } from '@/modules/integrations/contract/primitives';
import { integrationConnectionRecordSchema, type IntegrationConnectionRecord } from '@/modules/integrations/contract';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { tenantContextSchema, type TenantContext } from '@/modules/tenant/context';

/**
 * Lectura de la conexión viva de la empresa para UN proveedor, con el JWT del usuario y bajo
 * RLS (camino A, DEC-04). Desde M16e una empresa puede tener una viva de Meta y otra de
 * Tiendanube: el proveedor es obligatorio en `readLiveConnection`, porque sin él la segunda
 * fila haría fallar `.maybeSingle()`. `worker_api` no tiene una función de lectura de estado:
 * la base sigue siendo la autoridad, porque `create_oauth_attempt` vuelve a verificar el
 * propósito y el proveedor.
 */

export type LiveConnection = Readonly<{
  id: string;
  status: 'pending_selection' | 'active' | 'needs_reauth';
  credentialGeneration: number;
}>;

const LIVE_STATUSES = ['pending_selection', 'active', 'needs_reauth'] as const;

/** Error que se lanza cuando no se pudo leer la conexión. */
export class ConnectionReadError extends Error {
  constructor() {
    super('No se pudo leer la conexión.');
    this.name = 'ConnectionReadError';
  }
}

/** LEE la conexión vigente de un proveedor con tu sesión, y vuelve a verificar que sea de tu empresa. */
export async function readLiveConnection(
  ctx: TenantContext,
  provider: IntegrationProvider,
  deps: { supabase?: SupabaseClient } = {},
): Promise<LiveConnection | null> {
  const parsedContext = tenantContextSchema.safeParse(ctx);
  const parsedProvider = integrationProviderSchema.safeParse(provider);
  if (!parsedContext.success || !parsedProvider.success) throw new ConnectionReadError();
  const actor = parsedContext.data;
  const supabase = deps.supabase ?? (await createSupabaseServerClient());

  // El filtro por empresa sale de K01, resuelto en el servidor.
  const { data, error } = await supabase
    .from('integration_connections')
    .select('id, status, credential_generation, company_id, provider')
    .eq('company_id', actor.company_id)
    .eq('provider', parsedProvider.data)
    .in('status', [...LIVE_STATUSES])
    .maybeSingle();
  // Error fijo, sin el mensaje de PostgREST.
  if (error) throw new ConnectionReadError();
  if (data === null) return null;

  const row = data as Record<string, unknown>;
  const status = LIVE_STATUSES.find((value) => value === row.status);
  const generation = row.credential_generation;
  if (
    row.company_id !== actor.company_id ||
    row.provider !== parsedProvider.data ||
    !uuidSchema.safeParse(row.id).success ||
    status === undefined ||
    !Number.isInteger(generation) ||
    (generation as number) < 0
  ) {
    throw new ConnectionReadError();
  }
  return Object.freeze({ id: row.id as string, status, credentialGeneration: generation as number });
}

/**
 * Registro completo de la conexión viva de un proveedor, leído con el JWT del usuario y RLS.
 * Sin proveedor lee la de Meta, como antes de M16e: así no cambian sus llamadores.
 */
export async function readConnectionRecord(
  ctx: TenantContext,
  deps: { supabase?: SupabaseClient } = {},
  provider: IntegrationProvider = 'meta',
): Promise<IntegrationConnectionRecord | null> {
  const parsedContext = tenantContextSchema.safeParse(ctx);
  const parsedProvider = integrationProviderSchema.safeParse(provider);
  if (!parsedContext.success || !parsedProvider.success) throw new ConnectionReadError();
  const supabase = deps.supabase ?? (await createSupabaseServerClient());
  const { data, error } = await supabase.from('integration_connections')
    .select('id, company_id, provider, client_business_id, credential_generation, current_sync_run_id, last_error_class, last_error_message, created_at, updated_at, external_account_id, currency, timezone, status, pending_expires_at, purge_requested_at')
    .eq('company_id', parsedContext.data.company_id)
    .eq('provider', parsedProvider.data)
    .in('status', [...LIVE_STATUSES])
    .maybeSingle();
  if (error) throw new ConnectionReadError();
  if (data === null) return null;
  const parsed = integrationConnectionRecordSchema.safeParse(data);
  if (!parsed.success || parsed.data.company_id !== parsedContext.data.company_id ||
      parsed.data.provider !== parsedProvider.data) {
    throw new ConnectionReadError();
  }
  return parsed.data;
}
