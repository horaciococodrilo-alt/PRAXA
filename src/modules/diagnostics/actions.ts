'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { UnauthorizedError } from '@/modules/identity/session';
import { getWorkerApi } from '@/modules/integrations/db/worker-api';
import { readLiveConnection } from '@/modules/integrations/repository/connections';
import { requireTenantContext } from '@/modules/tenant/context';

import type { Resultado } from './compose';
import { supabaseRpc } from './eligibility';
import { windowsFor } from './evidence';
import { anthropicModelSteps, generateDiagnostic, loadGenerationContext } from './orchestrator';
import { readActionTypes, readEligibility, saveSettings } from './repository';
import { actionTypeOptions, catalogWindowTo, GoalInputError, parseGoalInput } from './settings';

/**
 * Server Actions del diagnóstico (M26a, Diseño §6). Construyen K01 adentro y no reciben
 * `company_id`, `connection_id` ni métricas: del formulario se leen solo `goal_kind` y
 * `action_type`, validados contra el catálogo del servidor. Terminan con un código de lista
 * cerrada; `UnauthorizedError` va al login.
 */

const LOGIN = '/login?next=%2Fapp%2Fdiagnostico';
const RESULT = '/app/diagnostico?resultado=';

export async function guardarObjetivoDiagnostico(formData: FormData): Promise<never> {
  let code: Resultado;
  let login = false;
  try {
    const ctx = await requireTenantContext();
    const supabase = await createSupabaseServerClient();
    const connection = await readLiveConnection(ctx, { supabase });
    // Misma ventana que muestra la pantalla (`getDiagnostico`): la de la elegibilidad o, sin ella, ayer.
    const rpc = supabaseRpc(supabase);
    const catalog = connection?.status === 'active'
      ? actionTypeOptions(await readActionTypes(rpc, connection.id,
        windowsFor(catalogWindowTo((await readEligibility(rpc, connection.id)).window_to))))
      : [];
    const goal = formData.get('goal_kind');
    const action = formData.get('action_type');
    const raw = goal === 'traffic' ? { goal_kind: goal }
      : { goal_kind: typeof goal === 'string' ? goal : undefined,
        ...(typeof action === 'string' && action !== '' ? { action_type: action } : {}) };
    await saveSettings(getWorkerApi(), ctx, parseGoalInput(raw, catalog));
    code = 'objetivo_guardado';
  } catch (error) {
    login = error instanceof UnauthorizedError;
    code = error instanceof GoalInputError ? 'objetivo_invalido' : 'fallo_generacion';
  }
  if (login) redirect(LOGIN);
  revalidatePath('/app/diagnostico');
  redirect(`${RESULT}${code}`);
}

export async function generarDiagnostico(): Promise<never> {
  let code: Resultado;
  let login = false;
  try {
    const ctx = await requireTenantContext();
    const supabase = await createSupabaseServerClient();
    const result = await generateDiagnostic({ ctx, rpc: supabaseRpc(supabase), worker: getWorkerApi(),
      model: anthropicModelSteps(), loadContext: () => loadGenerationContext(ctx, supabase) });
    code = result.code;
  } catch (error) {
    login = error instanceof UnauthorizedError;
    code = 'fallo_generacion';
  }
  if (login) redirect(LOGIN);
  revalidatePath('/app/diagnostico');
  redirect(`${RESULT}${code}`);
}
