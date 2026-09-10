import { ConfigurationMissing } from '@/components/configuration-missing';
import { OnboardingWizard } from '@/components/onboarding-wizard';
import { isSupabaseConfigured } from '@/lib/env';
import { getCurrentCompany } from '@/modules/company/service';
import { requireUser } from '@/modules/identity/session';
import { getActiveContext, getDraft } from '@/modules/onboarding/repository';

export const metadata = { title: 'Configuración inicial' };

/**
 * El onboarding se puede guardar y retomar: el estado inicial sale del borrador
 * persistido, no de la memoria del navegador.
 */
export default async function OnboardingPage() {
  if (!isSupabaseConfigured()) return <ConfigurationMissing />;

  await requireUser('/onboarding');

  const company = await getCurrentCompany();

  // Sin empresa todavía no hay borrador posible: el primer paso la crea.
  if (!company) {
    return <OnboardingWizard initial={null} />;
  }

  const [draft, active] = await Promise.all([getDraft(), getActiveContext()]);
  const snapshot = draft ?? active;

  return (
    <OnboardingWizard
      initial={{
        companyName: company.name,
        hasDraft: Boolean(draft),
        hasActive: Boolean(active),
        // Identidad de lo que el servidor tiene guardado. Si cambia mientras el usuario
        // edita, el asistente avisa en vez de pisar sus cambios locales.
        draftSignature: draft ? `${draft.version.id}:${draft.version.updated_at}` : null,
        context: snapshot
          ? {
              hasDefinedObjective: snapshot.version.has_defined_objective,
              problems: snapshot.version.problems,
              constraints: snapshot.version.constraints,
              additionalContext: snapshot.version.additional_context ?? '',
              objectives: snapshot.objectives.map((objective) => ({
                kind: objective.kind,
                title: objective.title,
                description: objective.description,
                priority: objective.priority,
                horizon: objective.horizon,
                indicator_name: objective.indicator_name,
                target_value: objective.target_value,
                target_unit: objective.target_unit,
                position: objective.position,
              })),
              systems: snapshot.systems.map((system) => ({
                system_key: system.system_key,
                label: system.label,
                notes: system.notes,
              })),
            }
          : null,
      }}
    />
  );
}
