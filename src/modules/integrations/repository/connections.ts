import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { uuidSchema } from '@/modules/integrations/contract/primitives';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { tenantContextSchema, type TenantContext } from '@/modules/tenant/context';

/**
 * Lectura de la conexión viva de la empresa, con el JWT del usuario y bajo RLS (camino A,
 * DEC-04). `worker_api` no tiene una función de lectura de estado: la base sigue siendo la
 * autoridad, porque `create_oauth_attempt` vuelve a verificar el propósito.
 */

export type LiveConnection = Readonly<{
  id: string;
  status: 'pending_selection' | 'active' | 'needs_reauth';
  credentialGeneration: number;
}>;

const LIVE_STATUSES = ['pending_selection', 'active', 'needs_reauth'] as const;

export class ConnectionReadError extends Error {
  constructor() {
    super('No se pudo leer la conexión con Meta.');
    this.name = 'ConnectionReadError';
  }
}

export async function readLiveConnection(
  ctx: TenantContext,
  deps: { supabase?: SupabaseClient } = {},
): Promise<LiveConnection | null> {
  const parsedContext = tenantContextSchema.safeParse(ctx);
  if (!parsedContext.success) throw new ConnectionReadError();
  const actor = parsedContext.data;
  const supabase = deps.supabase ?? (await createSupabaseServerClient());

  // El filtro por empresa sale de K01, resuelto en el servidor.
  const { data, error } = await supabase
    .from('integration_connections')
    .select('id, status, credential_generation, company_id')
    .eq('company_id', actor.company_id)
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
    !uuidSchema.safeParse(row.id).success ||
    status === undefined ||
    !Number.isInteger(generation) ||
    (generation as number) < 0
  ) {
    throw new ConnectionReadError();
  }
  return Object.freeze({ id: row.id as string, status, credentialGeneration: generation as number });
}
