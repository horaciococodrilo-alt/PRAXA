import { ButtonLink, Callout, Card, StatusPill } from '@/components/ui';
import { getActiveContext, getDraft } from '@/modules/onboarding/repository';
import { requireUser } from '@/modules/identity/session';

export const metadata = { title: 'Inicio' };

export default async function AppHomePage() {
  await requireUser('/app');

  const [active, draft] = await Promise.all([getActiveContext(), getDraft()]);

  const objectiveCount = active?.objectives.length ?? 0;
  const systemCount = active?.systems.length ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inicio</h1>
        <p className="mt-2 text-sm text-muted">
          Estado de tu espacio y qué falta para llegar al primer diagnóstico.
        </p>
      </div>

      {!active ? (
        <Callout tone="warning" title="Todavía no confirmaste tu contexto">
          <p>
            El análisis parte de lo que declarás: objetivos, problemas y restricciones. Sin un
            contexto confirmado no hay nada sobre lo que analizar.
          </p>
          <p>
            <ButtonLink href="/onboarding" className="mt-2">
              {draft ? 'Retomar el onboarding' : 'Completar el onboarding'}
            </ButtonLink>
          </p>
        </Callout>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <h2 className="text-sm font-medium text-muted">Contexto</h2>
          <p className="mt-2 text-2xl font-semibold">
            {active ? `v${active.version.version}` : '—'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {active ? (
              <StatusPill tone="active">Vigente</StatusPill>
            ) : (
              <StatusPill>Sin confirmar</StatusPill>
            )}
            {draft ? (
              <span className="ml-2">
                <StatusPill tone="draft">Borrador en curso</StatusPill>
              </span>
            ) : null}
          </p>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-muted">Objetivos declarados</h2>
          <p className="mt-2 text-2xl font-semibold">
            {active ? objectiveCount : '—'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {active && !active.version.has_defined_objective
              ? 'Declaraste que todavía no tenés un objetivo definido.'
              : 'Orientan qué se analiza y con qué prioridad.'}
          </p>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-muted">Sistemas declarados</h2>
          <p className="mt-2 text-2xl font-semibold">{active ? systemCount : '—'}</p>
          <p className="mt-1 text-xs text-muted">
            Declarados en el onboarding. Ninguno está conectado todavía.
          </p>
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Qué sigue</h2>
        <ol className="mt-4 space-y-3">
          <li>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">Objetivos y contexto</p>
                <p className="text-sm text-muted">
                  {active
                    ? 'Confirmado. Podés editarlo cuando cambie tu situación.'
                    : 'Pendiente de confirmar.'}
                </p>
              </div>
              <ButtonLink
                href={active ? '/app/contexto' : '/onboarding'}
                variant={active ? 'secondary' : 'primary'}
              >
                {active ? 'Ver contexto' : 'Completar'}
              </ButtonLink>
            </Card>
          </li>
          <li>
            <Card>
              <p className="font-medium">Conectar sistemas</p>
              <p className="text-sm text-muted">
                No implementado todavía. Es el próximo incremento del producto.
              </p>
            </Card>
          </li>
          <li>
            <Card>
              <p className="font-medium">Diagnóstico y plan</p>
              <p className="text-sm text-muted">
                No implementado todavía. Requiere primero datos extraídos y métricas calculadas.
              </p>
            </Card>
          </li>
        </ol>
      </section>
    </div>
  );
}
