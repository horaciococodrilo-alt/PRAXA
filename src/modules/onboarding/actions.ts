'use server';

import { revalidatePath } from 'next/cache';

import { ensureCompany, getCurrentCompany, renameCompany } from '@/modules/company/service';
import { requireUserForAction } from '@/modules/identity/session';

import {
  activateDraft,
  getActiveContext,
  getDraft,
  replaceDraftObjectives,
  replaceDraftSystems,
  saveDraftContextFields,
  startOrResumeDraft,
  type ContextSnapshot,
} from './repository';
import {
  checkReadyForActivation,
  companyStepSchema,
  contextStepSchema,
  objectivesStepSchema,
  systemsStepSchema,
} from './schema';

/**
 * Server Actions del onboarding.
 *
 * Cada una revalida la identidad por su cuenta. La documentación de Next.js es explícita
 * en que una Server Action es un POST a la ruta donde se usa y puede quedar fuera del
 * `matcher` del proxy sin que nada lo advierta, así que el proxy no se usa como prueba de
 * autorización en ningún punto.
 */

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function fail(error: unknown): ActionResult {
  if (error instanceof Error) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: 'Ocurrió un error inesperado.' };
}


function zodErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

/** Paso 1: nombre de la empresa. Crea el espacio privado si todavía no existe. */
export async function saveCompanyStep(input: unknown): Promise<ActionResult> {
  try {
    await requireUserForAction();

    const parsed = companyStepSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: 'Revisá los datos del formulario.',
        fieldErrors: zodErrors(parsed.error.issues),
      };
    }

    const existing = await getCurrentCompany();
    if (existing) {
      if (existing.name !== parsed.data.name) await renameCompany(parsed.data.name);
    } else {
      // Idempotente: un reintento no duplica la empresa ni pisa el nombre original.
      await ensureCompany(parsed.data.name);
    }

    await startOrResumeDraft();

    revalidatePath('/onboarding');
    revalidatePath('/app');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Paso 2: sistemas que la empresa declara usar. No implica ninguna conexión. */
export async function saveSystemsStep(input: unknown): Promise<ActionResult> {
  try {
    await requireUserForAction();

    const parsed = systemsStepSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: 'Revisá los sistemas seleccionados.',
        fieldErrors: zodErrors(parsed.error.issues),
      };
    }

    const draft = await startOrResumeDraft();
    await replaceDraftSystems(draft.version.id, parsed.data.systems);

    revalidatePath('/onboarding');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Paso 3: objetivos. Admite explícitamente "todavía no tengo un objetivo definido". */
export async function saveObjectivesStep(input: unknown): Promise<ActionResult> {
  try {
    await requireUserForAction();

    const parsed = objectivesStepSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: 'Revisá los objetivos cargados.',
        fieldErrors: zodErrors(parsed.error.issues),
      };
    }

    const draft = await startOrResumeDraft();

    // El orden importa: primero se vacía la lista si el usuario declaró no tener
    // objetivos, para que el flag y los hijos nunca queden en un estado contradictorio.
    if (!parsed.data.has_defined_objective) {
      await replaceDraftObjectives(draft.version.id, []);
      await saveDraftContextFields(draft.version.id, { has_defined_objective: false });
    } else {
      await saveDraftContextFields(draft.version.id, { has_defined_objective: true });
      await replaceDraftObjectives(draft.version.id, parsed.data.objectives);
    }

    revalidatePath('/onboarding');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Paso 4: problemas, restricciones y contexto adicional. */
export async function saveContextStep(input: unknown): Promise<ActionResult> {
  try {
    await requireUserForAction();

    const parsed = contextStepSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: 'Revisá el contexto declarado.',
        fieldErrors: zodErrors(parsed.error.issues),
      };
    }

    const draft = await startOrResumeDraft();
    await saveDraftContextFields(draft.version.id, {
      problems: parsed.data.problems,
      constraints: parsed.data.constraints,
      additional_context: parsed.data.additional_context,
    });

    revalidatePath('/onboarding');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Confirma el borrador y lo convierte en el contexto vigente.
 *
 * Recibe QUÉ se está confirmando: el identificador del borrador y la revisión que el
 * usuario tenía a la vista. El identificador no autoriza nada —la pertenencia la resuelve
 * RLS a partir de la sesión—; sirve para que no se active un borrador distinto del que se
 * revisó. La revisión la vuelve a comprobar la base dentro de la transacción que activa.
 */
export async function confirmContext(input: {
  versionId: string;
  expectedRevision: string;
}): Promise<ActionResult> {
  try {
    await requireUserForAction();

    if (!input?.versionId || !input?.expectedRevision) {
      return {
        ok: false,
        message: 'Falta indicar qué borrador y qué revisión se están confirmando.',
      };
    }

    const draft = await getDraft();
    if (!draft) {
      return { ok: false, message: 'No hay un borrador abierto para confirmar.' };
    }

    if (draft.version.id !== input.versionId) {
      return {
        ok: false,
        message:
          'El borrador abierto no es el que estabas revisando. Recargá la página antes de confirmar.',
      };
    }

    // Chequeo previo solo para dar un mensaje útil: la validación que manda es la de
    // activate_context_draft() en la base.
    const readiness = checkReadyForActivation({
      has_defined_objective: draft.version.has_defined_objective,
      objectives: draft.objectives,
    });
    if (!readiness.ready) {
      return { ok: false, message: readiness.reason };
    }

    await activateDraft(input.versionId, input.expectedRevision);

    revalidatePath('/app');
    revalidatePath('/app/contexto');
    revalidatePath('/onboarding');
    return { ok: true, message: 'Contexto confirmado.' };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Abre la edición del contexto vigente.
 * No lo modifica: lo clona a un borrador nuevo, que es lo único editable.
 */
export async function startContextEdit(): Promise<ActionResult> {
  try {
    await requireUserForAction();
    await startOrResumeDraft();

    revalidatePath('/app/contexto');
    revalidatePath('/onboarding');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Estado del onboarding para decidir qué mostrar. */
export async function loadOnboardingState(): Promise<{
  companyName: string | null;
  draft: ContextSnapshot | null;
  active: ContextSnapshot | null;
}> {
  await requireUserForAction();

  const company = await getCurrentCompany();
  if (!company) return { companyName: null, draft: null, active: null };

  const [draft, active] = await Promise.all([getDraft(), getActiveContext()]);
  return { companyName: company.name, draft, active };
}
