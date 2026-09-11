import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireCompanyMembership } from '@/modules/company/service';

import { CONTEXT_SCHEMA_VERSION, type ObjectiveInput, type SystemInput } from './schema';

/**
 * Acceso a datos del contexto de empresa.
 *
 * Todas las lecturas y escrituras pasan por RLS con la sesión del usuario. Ninguna
 * función recibe un `companyId` desde afuera: se resuelve en el servidor.
 */

export type ContextStatus = 'draft' | 'active' | 'superseded';

export type ContextVersion = {
  id: string;
  company_id: string;
  version: number | null;
  status: ContextStatus;
  context_schema_version: string;
  has_defined_objective: boolean;
  problems: string[];
  constraints: string[];
  additional_context: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
  superseded_at: string | null;
};

export type ObjectiveRow = {
  id: string;
  company_id: string;
  context_version_id: string;
  kind: 'primary' | 'secondary';
  title: string;
  description: string | null;
  priority: 'high' | 'medium' | 'low' | null;
  horizon: 'short' | 'medium' | 'long' | null;
  indicator_name: string | null;
  target_value: number | null;
  target_unit: string | null;
  position: number;
};

export type SystemRow = {
  id: string;
  company_id: string;
  context_version_id: string;
  system_key: string;
  label: string | null;
  notes: string | null;
};

export type ContextSnapshot = {
  version: ContextVersion;
  objectives: ObjectiveRow[];
  systems: SystemRow[];
  /**
   * Huella de todo el contexto: la fila y sus dos listas.
   *
   * La calcula la base. Es lo que la confirmación tiene que devolver para demostrar qué
   * versión del contenido revisó el usuario. `updated_at` no sirve: cambiar solo
   * objetivos o sistemas no toca la fila de contexto.
   */
  revision: string;
};

const VERSION_COLUMNS =
  'id, company_id, version, status, context_schema_version, has_defined_objective, problems, constraints, additional_context, created_by, created_at, updated_at, activated_at, superseded_at';

const OBJECTIVE_COLUMNS =
  'id, company_id, context_version_id, kind, title, description, priority, horizon, indicator_name, target_value, target_unit, position';

const SYSTEM_COLUMNS = 'id, company_id, context_version_id, system_key, label, notes';

async function loadChildren(versionId: string) {
  const supabase = await createSupabaseServerClient();

  const [objectives, systems] = await Promise.all([
    supabase
      .from('company_objectives')
      .select(OBJECTIVE_COLUMNS)
      .eq('context_version_id', versionId)
      .order('position', { ascending: true }),
    supabase
      .from('company_systems')
      .select(SYSTEM_COLUMNS)
      .eq('context_version_id', versionId)
      .order('system_key', { ascending: true }),
  ]);

  if (objectives.error) throw new Error(`No se pudieron leer los objetivos: ${objectives.error.message}`);
  if (systems.error) throw new Error(`No se pudieron leer los sistemas: ${systems.error.message}`);

  return {
    objectives: (objectives.data ?? []) as ObjectiveRow[],
    systems: (systems.data ?? []) as SystemRow[],
  };
}

async function loadVersionByStatus(status: ContextStatus): Promise<ContextSnapshot | null> {
  await requireCompanyMembership();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('company_context_versions')
    .select(VERSION_COLUMNS)
    .eq('status', status)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer el contexto: ${error.message}`);
  if (!data) return null;

  const version = data as ContextVersion;
  const [children, revision] = await Promise.all([
    loadChildren(version.id),
    readRevision(version.id),
  ]);

  return { version, ...children, revision };
}

/** Revisión calculada por la base, sujeta a RLS como cualquier otra consulta. */
async function readRevision(versionId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('context_revision', { p_version_id: versionId });

  if (error) throw new Error(`No se pudo leer la revisión del contexto: ${error.message}`);
  return data as string;
}

/** El borrador en curso, si existe. Es lo que permite retomar el onboarding. */
export async function getDraft(): Promise<ContextSnapshot | null> {
  return loadVersionByStatus('draft');
}

/** El contexto vigente, si el onboarding ya se confirmó alguna vez. */
export async function getActiveContext(): Promise<ContextSnapshot | null> {
  return loadVersionByStatus('active');
}

/**
 * Devuelve el borrador en curso o lo crea.
 *
 * Si ya existe un contexto activo, lo CLONA: editar nunca modifica una versión activa.
 * Es idempotente: dos pestañas terminan sobre el mismo borrador.
 */
export async function startOrResumeDraft(): Promise<ContextSnapshot> {
  await requireCompanyMembership();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .rpc('start_context_draft', { p_context_schema_version: CONTEXT_SCHEMA_VERSION })
    .single<ContextVersion>();

  if (error) throw new Error(`No se pudo abrir el borrador: ${error.message}`);

  const [children, revision] = await Promise.all([
    loadChildren(data.id),
    readRevision(data.id),
  ]);

  return { version: data, ...children, revision };
}

export async function saveDraftContextFields(
  versionId: string,
  fields: {
    has_defined_objective?: boolean;
    problems?: string[];
    constraints?: string[];
    additional_context?: string | null;
  },
): Promise<ContextVersion> {
  await requireCompanyMembership();
  const supabase = await createSupabaseServerClient();

  // Sin filtro por company_id: RLS ya restringe el universo. Filtrar por un id enviado
  // desde el navegador daría una falsa sensación de control.
  const { data, error } = await supabase
    .from('company_context_versions')
    .update(fields)
    .eq('id', versionId)
    .eq('status', 'draft')
    .select(VERSION_COLUMNS)
    .single();

  if (error) throw new Error(`No se pudo guardar el borrador: ${error.message}`);
  return data as ContextVersion;
}

export async function replaceDraftObjectives(
  versionId: string,
  objectives: ObjectiveInput[],
): Promise<ObjectiveRow[]> {
  await requireCompanyMembership();
  const supabase = await createSupabaseServerClient();

  const payload = objectives.map((objective, index) => ({
    kind: objective.kind,
    title: objective.title,
    description: objective.description,
    priority: objective.priority,
    horizon: objective.horizon,
    indicator_name: objective.indicator_name,
    target_value: objective.target_value,
    target_unit: objective.target_unit,
    position: index,
  }));

  const { data, error } = await supabase.rpc('replace_draft_objectives', {
    p_version_id: versionId,
    p_objectives: payload,
  });

  if (error) throw new Error(`No se pudieron guardar los objetivos: ${error.message}`);
  return (data ?? []) as ObjectiveRow[];
}

export async function replaceDraftSystems(
  versionId: string,
  systems: SystemInput[],
): Promise<SystemRow[]> {
  await requireCompanyMembership();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc('replace_draft_systems', {
    p_version_id: versionId,
    p_systems: systems,
  });

  if (error) throw new Error(`No se pudieron guardar los sistemas: ${error.message}`);
  return (data ?? []) as SystemRow[];
}

/**
 * Confirma el borrador.
 *
 * `expectedRevision` es la huella del contenido que el usuario revisó. La base la vuelve
 * a calcular con el cerrojo tomado y dentro de la misma transacción que activa, así que
 * no queda ventana entre comprobar y activar.
 */
export async function activateDraft(
  versionId: string,
  expectedRevision: string,
): Promise<ContextVersion> {
  await requireCompanyMembership();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .rpc('activate_context_draft', {
      p_version_id: versionId,
      p_expected_revision: expectedRevision,
    })
    .single<ContextVersion>();

  if (error) throw new Error(error.message.replace(/^praxa:\s*/, ''));
  return data;
}
