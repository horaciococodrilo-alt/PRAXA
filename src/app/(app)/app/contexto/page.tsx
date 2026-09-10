import { EditContextButton } from '@/components/edit-context-button';
import { ButtonLink, Callout, Card, EmptyState, StatusPill } from '@/components/ui';
import { getCurrentCompany } from '@/modules/company/service';
import { requireUser } from '@/modules/identity/session';
import { getActiveContext, getDraft } from '@/modules/onboarding/repository';
import { HORIZON_LABELS, PRIORITY_LABELS } from '@/modules/onboarding/schema';

export const metadata = { title: 'Objetivos y contexto' };

function List({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export default async function ContextPage() {
  await requireUser('/app/contexto');

  const [company, active, draft] = await Promise.all([
    getCurrentCompany(),
    getActiveContext(),
    getDraft(),
  ]);

  if (!active) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight">Objetivos y contexto</h1>
        <EmptyState
          title="Todavía no confirmaste tu contexto"
          reason="El onboarding recoge tus objetivos, problemas y restricciones. Podés guardarlo y retomarlo cuando quieras; se confirma cuando esté completo."
        >
          <ButtonLink href="/onboarding">
            {draft ? 'Retomar el onboarding' : 'Completar el onboarding'}
          </ButtonLink>
        </EmptyState>
      </div>
    );
  }

  const { version, objectives, systems } = active;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Objetivos y contexto</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <StatusPill tone="active">Versión {version.version} vigente</StatusPill>
            <span>
              Confirmada el{' '}
              {version.activated_at
                ? new Date(version.activated_at).toLocaleDateString('es-AR')
                : '—'}
            </span>
          </p>
        </div>
        <EditContextButton hasDraft={Boolean(draft)} />
      </div>

      {draft ? (
        <Callout tone="warning" title="Tenés un borrador sin confirmar">
          <p>
            Los cambios que guardaste todavía no reemplazaron a la versión vigente. La versión{' '}
            {version.version} sigue siendo la que se usa hasta que confirmes.
          </p>
        </Callout>
      ) : null}

      <Card>
        <h2 className="text-base font-semibold">Empresa</h2>
        <p className="mt-2 text-sm">{company?.name}</p>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Objetivos</h2>
        {!version.has_defined_objective ? (
          <Callout>
            Declaraste que todavía no tenés un objetivo definido. El análisis lo va a tener en
            cuenta y no va a suponer objetivos que no declaraste.
          </Callout>
        ) : (
          <ul className="mt-4 space-y-4">
            {objectives.map((objective) => (
              <li key={objective.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={objective.kind === 'primary' ? 'active' : 'neutral'}>
                    {objective.kind === 'primary' ? 'Principal' : 'Adicional'}
                  </StatusPill>
                  <span className="font-medium">{objective.title}</span>
                </div>

                {objective.description ? (
                  <p className="mt-2 text-sm text-muted">{objective.description}</p>
                ) : null}

                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted">Prioridad</dt>
                    <dd>{objective.priority ? PRIORITY_LABELS[objective.priority] : 'Sin definir'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Horizonte</dt>
                    <dd>{objective.horizon ? HORIZON_LABELS[objective.horizon] : 'Sin definir'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Indicador</dt>
                    <dd>{objective.indicator_name ?? 'No declarado'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Meta</dt>
                    <dd>
                      {objective.target_value !== null
                        ? `${objective.target_value}${objective.target_unit ? ` ${objective.target_unit}` : ''}`
                        : 'No declarada'}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Sistemas declarados</h2>
        <p className="mt-1 text-xs text-muted">Declaración tuya. Ninguno está conectado.</p>
        <div className="mt-3">
          {systems.length === 0 ? (
            <p className="text-sm text-muted">No declaraste sistemas.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {systems.map((system) => (
                <li
                  key={system.id}
                  className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm"
                >
                  {system.label ?? system.system_key}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold">Problemas y preocupaciones</h2>
          <div className="mt-3">
            <List items={version.problems} empty="No declaraste problemas." />
          </div>
        </Card>
        <Card>
          <h2 className="text-base font-semibold">Restricciones</h2>
          <div className="mt-3">
            <List items={version.constraints} empty="No declaraste restricciones." />
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold">Contexto adicional</h2>
        <p className="mt-3 whitespace-pre-line text-sm">
          {version.additional_context ?? (
            <span className="text-muted">No agregaste contexto adicional.</span>
          )}
        </p>
      </Card>
    </div>
  );
}
