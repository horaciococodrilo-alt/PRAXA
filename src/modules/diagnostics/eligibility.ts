import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { readLiveConnection, type LiveConnection } from '@/modules/integrations/repository/connections';
import type { TenantContext } from '@/modules/tenant/context';

import { diagnosticSettingsSchema, type DiagnosticSettings, type Eligibility } from './contract';
import { DiagnosticReadError, readEligibility, type Rpc } from './repository';

/**
 * Estado del diagnóstico de la empresa de K01: conexión viva, objetivo guardado y elegibilidad.
 * La regla de elegibilidad y el reloj son de la base (`meta_diagnostic_eligibility`); este
 * módulo no decide nada por su cuenta. La conexión y la empresa salen del servidor (CA-00).
 */

export type DiagnosticStatus = Readonly<{
  connection: LiveConnection | null;
  settings: DiagnosticSettings | null;
  eligibility: Eligibility | null;
}>;

export function supabaseRpc(supabase: SupabaseClient): Rpc {
  return (fn, args) => supabase.rpc(fn, args);
}

export async function readDiagnosticSettings(supabase: SupabaseClient, companyId: string):
  Promise<DiagnosticSettings | null> {
  const { data, error } = await supabase.from('diagnostic_settings')
    .select('goal_kind, metric_ref').eq('company_id', companyId).maybeSingle();
  if (error) throw new DiagnosticReadError();
  if (data === null) return null;
  const parsed = diagnosticSettingsSchema.safeParse(data);
  if (!parsed.success) throw new DiagnosticReadError();
  return parsed.data;
}

export async function readDiagnosticStatus(ctx: TenantContext, deps: { supabase?: SupabaseClient } = {}):
  Promise<DiagnosticStatus> {
  const supabase = deps.supabase ?? (await createSupabaseServerClient());
  const [connection, settings] = await Promise.all([
    readLiveConnection(ctx, { supabase }),
    readDiagnosticSettings(supabase, ctx.company_id),
  ]);
  const eligibility = connection ? await readEligibility(supabaseRpc(supabase), connection.id) : null;
  return Object.freeze({ connection, settings, eligibility });
}
