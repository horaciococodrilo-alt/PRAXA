'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import {
  Button,
  Callout,
  Card,
  Field,
  Input,
  Select,
  StatusPill,
  Textarea,
  cn,
} from '@/components/ui';
import {
  confirmContext,
  saveCompanyStep,
  saveContextStep,
  saveObjectivesStep,
  saveSystemsStep,
  type ActionResult,
} from '@/modules/onboarding/actions';
import {
  HORIZON_LABELS,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_LABELS,
  PRIORITY_LABELS,
  SYSTEM_CATALOG,
  checkReadyForActivation,
  type OnboardingStep,
} from '@/modules/onboarding/schema';

type DraftObjective = {
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

type DraftSystem = { system_key: string; label: string | null; notes: string | null };

export type OnboardingInitialState = {
  companyName: string;
  hasDraft: boolean;
  hasActive: boolean;
  /** Identidad del borrador persistido, para detectar cambios hechos en otra pestaña. */
  draftSignature: string | null;
  context: {
    hasDefinedObjective: boolean;
    problems: string[];
    constraints: string[];
    additionalContext: string;
    objectives: DraftObjective[];
    systems: DraftSystem[];
  } | null;
};

/** Separador de las listas que se editan como texto multilínea. */
const NEWLINE = String.fromCharCode(10);

const linesToList = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

function emptyObjective(position: number, kind: 'primary' | 'secondary'): DraftObjective {
  return {
    kind,
    title: '',
    description: null,
    priority: null,
    horizon: null,
    indicator_name: null,
    target_value: null,
    target_unit: null,
    position,
  };
}

/**
 * Huella del contenido de UN paso.
 *
 * Es por paso, no global, porque cada Server Action persiste solamente su paso. Con una
 * huella global, guardar Sistemas marcaba como guardado también un objetivo editado y sin
 * persistir: Revisión mostraba el objetivo nuevo y Confirmar activaba el viejo.
 *
 * Cada rama incluye exactamente los campos que su acción escribe, y nada más.
 */
export function stepFingerprint(step: OnboardingStep, state: WizardState): string {
  switch (step) {
    case 'company':
      return JSON.stringify({ companyName: state.companyName.trim() });

    case 'systems':
      return JSON.stringify(
        [...state.systems]
          .map((system) => ({ k: system.system_key, l: system.label, n: system.notes }))
          .sort((a, b) => a.k.localeCompare(b.k)),
      );

    case 'objectives':
      return JSON.stringify({
        hasDefinedObjective: state.hasDefinedObjective,
        // Con "sin objetivo definido" la acción persiste una lista vacía, así que lo que
        // haya quedado escrito en pantalla no cuenta como cambio pendiente.
        objectives: state.hasDefinedObjective
          ? state.objectives
              .filter((objective) => objective.title.trim().length > 0)
              .map((objective) => ({
                kind: objective.kind,
                title: objective.title.trim(),
                description: objective.description,
                priority: objective.priority,
                horizon: objective.horizon,
                indicator_name: objective.indicator_name,
                target_value: objective.target_value,
                target_unit: objective.target_unit,
              }))
          : [],
      });

    case 'context':
      return JSON.stringify({
        problems: linesToList(state.problems),
        constraints: linesToList(state.constraints),
        additionalContext: state.additionalContext.trim(),
      });

    // Revisión no persiste nada propio: su contenido sale de los otros pasos.
    case 'review':
      return '';
  }
}

/** Pasos que efectivamente guardan datos. Revisión no. */
export const PERSISTING_STEPS = ['company', 'systems', 'objectives', 'context'] as const;
export type PersistingStep = (typeof PERSISTING_STEPS)[number];

export type WizardState = {
  companyName: string;
  systems: DraftSystem[];
  hasDefinedObjective: boolean;
  objectives: DraftObjective[];
  problems: string;
  constraints: string;
  additionalContext: string;
};

export function pendingSteps(
  state: WizardState,
  saved: Record<PersistingStep, string>,
): PersistingStep[] {
  return PERSISTING_STEPS.filter((step) => stepFingerprint(step, state) !== saved[step]);
}

export function OnboardingWizard({ initial }: { initial: OnboardingInitialState | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<OnboardingStep>('company');
  const [result, setResult] = useState<ActionResult | null>(null);

  const [companyName, setCompanyName] = useState(initial?.companyName ?? '');
  const [systems, setSystems] = useState<DraftSystem[]>(initial?.context?.systems ?? []);
  const [hasDefinedObjective, setHasDefinedObjective] = useState(
    initial?.context?.hasDefinedObjective ?? true,
  );
  const [objectives, setObjectives] = useState<DraftObjective[]>(
    initial?.context?.objectives ?? [emptyObjective(0, 'primary')],
  );
  const [problems, setProblems] = useState((initial?.context?.problems ?? []).join('\n'));
  const [constraints, setConstraints] = useState((initial?.context?.constraints ?? []).join('\n'));
  const [additionalContext, setAdditionalContext] = useState(
    initial?.context?.additionalContext ?? '',
  );

  const stepIndex = ONBOARDING_STEPS.indexOf(step);

  const currentState: WizardState = {
    companyName,
    systems,
    hasDefinedObjective,
    objectives,
    problems,
    constraints,
    additionalContext,
  };

  // Huella de lo persistido, POR PASO. Cada Server Action escribe solo su paso, así que
  // un guardado exitoso solo puede limpiar la referencia de ese paso.
  const [savedByStep, setSavedByStep] = useState<Record<PersistingStep, string>>(() => {
    const initialState: WizardState = {
      companyName: initial?.companyName ?? '',
      systems: initial?.context?.systems ?? [],
      hasDefinedObjective: initial?.context?.hasDefinedObjective ?? true,
      objectives: initial?.context?.objectives ?? [],
      problems: (initial?.context?.problems ?? []).join(NEWLINE),
      constraints: (initial?.context?.constraints ?? []).join(NEWLINE),
      additionalContext: initial?.context?.additionalContext ?? '',
    };
    return {
      company: stepFingerprint('company', initialState),
      systems: stepFingerprint('systems', initialState),
      objectives: stepFingerprint('objectives', initialState),
      context: stepFingerprint('context', initialState),
    };
  });

  const pending_ = pendingSteps(currentState, savedByStep);
  const hasUnsavedChanges = pending_.length > 0;

  // El servidor puede haber cambiado bajo nuestros pies (otra pestaña confirmó, por
  // ejemplo). No se pisan los cambios locales en silencio: se avisa y se deja decidir.
  //
  // Ojo con el falso positivo: nuestros propios guardados también cambian la firma —el
  // primero incluso crea el borrador, pasando de null a un id—. Por eso, tras un guardado
  // exitoso se acepta la firma que traiga el servidor a continuación, y solo se avisa
  // cuando cambia SIN que hubiera un guardado nuestro en curso.
  const serverSignature = initial?.draftSignature ?? null;
  const [acceptedSignature, setAcceptedSignature] = useState(serverSignature);
  const expectingOwnUpdate = useRef(false);

  useEffect(() => {
    if (serverSignature === acceptedSignature) return;
    if (expectingOwnUpdate.current) {
      expectingOwnUpdate.current = false;
      setAcceptedSignature(serverSignature);
    }
  }, [serverSignature, acceptedSignature]);

  const serverChangedElsewhere = serverSignature !== acceptedSignature;

  /**
   * @param persists  qué paso persiste esta acción. Solo ese se marca como guardado.
   */
  function run(
    persists: PersistingStep,
    action: () => Promise<ActionResult>,
    onSuccess?: () => void,
  ) {
    setResult(null);
    // Instantánea al momento de disparar: si el usuario sigue editando mientras se
    // guarda, esos cambios posteriores quedan pendientes, como corresponde.
    const snapshot = stepFingerprint(persists, currentState);

    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);

      // Un guardado fallido no marca nada como persistido.
      if (!outcome.ok) return;

      setSavedByStep((previous) => ({ ...previous, [persists]: snapshot }));
      // Lo que el servidor devuelva a continuación es consecuencia de ESTE guardado.
      expectingOwnUpdate.current = true;
      // refresh() vuelve a renderizar el Server Component, pero no remonta este cliente:
      // el estado local del formulario se conserva a propósito.
      router.refresh();
      onSuccess?.();
    });
  }

  /** Confirmar no persiste campos: activa lo que ya está guardado. */
  function runConfirm() {
    setResult(null);
    startTransition(async () => {
      const outcome = await confirmContext();
      setResult(outcome);
      if (outcome.ok) {
        expectingOwnUpdate.current = true;
        router.refresh();
        router.push('/app');
      }
    });
  }

  function goTo(next: OnboardingStep) {
    setResult(null);
    setStep(next);
  }

  const objectivesForCheck = hasDefinedObjective ? objectives : [];
  const readiness = checkReadyForActivation({
    has_defined_objective: hasDefinedObjective,
    objectives: objectivesForCheck,
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {initial?.hasActive ? 'Editar objetivos y contexto' : 'Configurá tu empresa'}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Podés guardar y volver cuando quieras: lo que completes queda como borrador.
          {initial?.hasActive
            ? ' La versión vigente no cambia hasta que confirmes.'
            : ''}
        </p>
      </header>

      <ol className="flex flex-wrap gap-2" aria-label="Pasos">
        {ONBOARDING_STEPS.map((item, index) => (
          <li key={item}>
            <button
              type="button"
              onClick={() => goTo(item)}
              title={
                item !== 'review' && pending_.includes(item as PersistingStep)
                  ? 'Este paso tiene cambios sin guardar'
                  : undefined
              }
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                item === step
                  ? 'border-accent bg-accent-soft font-medium text-accent'
                  : index < stepIndex
                    ? 'border-border text-foreground'
                    : 'border-border text-muted',
              )}
            >
              {index + 1}. {ONBOARDING_STEP_LABELS[item]}
            </button>
          </li>
        ))}
      </ol>

      {result && !result.ok ? <Callout tone="danger">{result.message}</Callout> : null}
      {result?.ok && result.message ? <Callout>{result.message}</Callout> : null}

      {serverChangedElsewhere ? (
        <Callout tone="warning" title="El borrador cambió fuera de esta pestaña">
          <p>
            Alguien —o vos, en otra pestaña— modificó este contexto mientras lo editabas.
            Lo que ves acá sigue siendo tu versión local: no se pisó nada.
          </p>
          <p>
            <Button
              variant="secondary"
              className="mt-2"
              onClick={() => window.location.reload()}
            >
              Recargar y descartar mis cambios locales
            </Button>
          </p>
        </Callout>
      ) : null}

      {hasUnsavedChanges ? (
        <Callout tone="warning" title="Tenés cambios sin guardar">
          <p>
            Estos pasos tienen cambios que todavía no están en el borrador:{' '}
            <strong>
              {pending_.map((item) => ONBOARDING_STEP_LABELS[item]).join(', ')}
            </strong>
            . Usá &ldquo;Guardar y continuar&rdquo; en cada uno antes de confirmar.
          </p>
        </Callout>
      ) : null}

      {step === 'company' ? (
        <Card className="space-y-5">
          <Field label="Nombre de la empresa" required>
            <Input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Mi tienda"
              required
            />
          </Field>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() =>
                run('company', () => saveCompanyStep({ name: companyName }), () => goTo('systems'))
              }
              disabled={pending || companyName.trim().length < 2}
            >
              {pending ? 'Guardando…' : 'Guardar y continuar'}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 'systems' ? (
        <Card className="space-y-5">
          <div>
            <h2 className="text-base font-semibold">¿Qué sistemas usa tu empresa?</h2>
            <p className="mt-1 text-sm text-muted">
              Es una declaración para orientar el análisis. <strong>No conecta nada</strong> ni
              pide credenciales.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {SYSTEM_CATALOG.map((entry) => {
              const checked = systems.some((system) => system.system_key === entry.key);
              return (
                <label
                  key={entry.key}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      setSystems((current) =>
                        event.target.checked
                          ? [
                              ...current,
                              { system_key: entry.key, label: entry.label, notes: null },
                            ]
                          : current.filter((system) => system.system_key !== entry.key),
                      );
                    }}
                  />
                  <span>{entry.label}</span>
                  <span className="ml-auto text-xs text-muted">{entry.group}</span>
                </label>
              );
            })}
          </div>

          {systems.some((system) => system.system_key === 'other') ? (
            <Field label="¿Cuál otro sistema?">
              <Input
                value={systems.find((system) => system.system_key === 'other')?.notes ?? ''}
                onChange={(event) =>
                  setSystems((current) =>
                    current.map((system) =>
                      system.system_key === 'other'
                        ? { ...system, notes: event.target.value || null }
                        : system,
                    ),
                  )
                }
                placeholder="Nombre del sistema"
              />
            </Field>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => goTo('company')} disabled={pending}>
              Volver
            </Button>
            <Button
              onClick={() => run('systems', () => saveSystemsStep({ systems }), () => goTo('objectives'))}
              disabled={pending}
            >
              {pending ? 'Guardando…' : 'Guardar y continuar'}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 'objectives' ? (
        <Card className="space-y-5">
          <div>
            <h2 className="text-base font-semibold">¿Qué querés lograr?</h2>
            <p className="mt-1 text-sm text-muted">
              Cargá indicador y meta solo si los conocés. Si no, dejalos vacíos: PRAXA no
              inventa métricas que no declaraste.
            </p>
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-border bg-surface-muted px-3 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={!hasDefinedObjective}
              onChange={(event) => setHasDefinedObjective(!event.target.checked)}
            />
            <span>
              Todavía no tengo un objetivo definido.
              <span className="mt-1 block text-xs text-muted">
                El análisis va a partir de tus problemas y tu contexto, sin suponer objetivos.
              </span>
            </span>
          </label>

          {hasDefinedObjective ? (
            <div className="space-y-4">
              {objectives.map((objective, index) => (
                <div key={index} className="space-y-4 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="primary-objective"
                        checked={objective.kind === 'primary'}
                        onChange={() =>
                          setObjectives((current) =>
                            current.map((item, itemIndex) => ({
                              ...item,
                              kind: itemIndex === index ? 'primary' : 'secondary',
                            })),
                          )
                        }
                      />
                      <span>Objetivo principal</span>
                    </label>

                    {objectives.length > 1 ? (
                      <Button
                        variant="danger"
                        className="px-3 py-1 text-xs"
                        onClick={() =>
                          setObjectives((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                      >
                        Quitar
                      </Button>
                    ) : null}
                  </div>

                  <Field label="Objetivo" required>
                    <Input
                      value={objective.title}
                      onChange={(event) =>
                        setObjectives((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, title: event.target.value } : item,
                          ),
                        )
                      }
                      placeholder="Aumentar la tasa de conversión del checkout"
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Prioridad">
                      <Select
                        value={objective.priority ?? ''}
                        onChange={(event) =>
                          setObjectives((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    priority: (event.target.value ||
                                      null) as DraftObjective['priority'],
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="">Sin definir</option>
                        {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Horizonte">
                      <Select
                        value={objective.horizon ?? ''}
                        onChange={(event) =>
                          setObjectives((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    horizon: (event.target.value ||
                                      null) as DraftObjective['horizon'],
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="">Sin definir</option>
                        {Object.entries(HORIZON_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Indicador" hint="Solo si ya lo medís.">
                      <Input
                        value={objective.indicator_name ?? ''}
                        onChange={(event) =>
                          setObjectives((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, indicator_name: event.target.value || null }
                                : item,
                            ),
                          )
                        }
                        placeholder="Tasa de conversión"
                      />
                    </Field>

                    <Field label="Meta" hint="Necesita un indicador para ser interpretable.">
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="any"
                          value={objective.target_value ?? ''}
                          onChange={(event) =>
                            setObjectives((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      target_value:
                                        event.target.value === ''
                                          ? null
                                          : Number(event.target.value),
                                    }
                                  : item,
                              ),
                            )
                          }
                          placeholder="3.5"
                        />
                        <Input
                          value={objective.target_unit ?? ''}
                          onChange={(event) =>
                            setObjectives((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, target_unit: event.target.value || null }
                                  : item,
                              ),
                            )
                          }
                          placeholder="%"
                          className="max-w-24"
                        />
                      </div>
                    </Field>
                  </div>
                </div>
              ))}

              <Button
                variant="secondary"
                onClick={() =>
                  setObjectives((current) => [
                    ...current,
                    emptyObjective(current.length, current.length === 0 ? 'primary' : 'secondary'),
                  ])
                }
              >
                Agregar otro objetivo
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => goTo('systems')} disabled={pending}>
              Volver
            </Button>
            <Button
              onClick={() =>
                run(
                  'objectives',
                  () =>
                    saveObjectivesStep({
                      has_defined_objective: hasDefinedObjective,
                      objectives: hasDefinedObjective
                        ? objectives.filter((objective) => objective.title.trim().length > 0)
                        : [],
                    }),
                  () => goTo('context'),
                )
              }
              disabled={pending}
            >
              {pending ? 'Guardando…' : 'Guardar y continuar'}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 'context' ? (
        <Card className="space-y-5">
          <Field
            label="Problemas o preocupaciones actuales"
            hint="Uno por línea."
          >
            <Textarea
              value={problems}
              onChange={(event) => setProblems(event.target.value)}
              placeholder={'Muchos carritos abandonados\nDemoras en la preparación de pedidos'}
            />
          </Field>

          <Field label="Restricciones relevantes" hint="Uno por línea.">
            <Textarea
              value={constraints}
              onChange={(event) => setConstraints(event.target.value)}
              placeholder={'Equipo de 3 personas\nNo podemos cambiar la plataforma este año'}
            />
          </Field>

          <Field label="Contexto adicional">
            <Textarea
              value={additionalContext}
              onChange={(event) => setAdditionalContext(event.target.value)}
              placeholder="Cualquier cosa que ayude a entender tu operación."
            />
          </Field>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => goTo('objectives')} disabled={pending}>
              Volver
            </Button>
            <Button
              onClick={() =>
                run(
                  'context',
                  () =>
                    saveContextStep({
                      problems: linesToList(problems),
                      constraints: linesToList(constraints),
                      additional_context: additionalContext,
                    }),
                  () => goTo('review'),
                )
              }
              disabled={pending}
            >
              {pending ? 'Guardando…' : 'Guardar y continuar'}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 'review' ? (
        <Card className="space-y-5">
          <h2 className="text-base font-semibold">Revisión</h2>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Empresa</dt>
              <dd>{companyName || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Sistemas declarados</dt>
              <dd>
                {systems.length === 0
                  ? 'Ninguno'
                  : systems.map((system) => system.label ?? system.system_key).join(', ')}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Objetivos</dt>
              <dd>
                {!hasDefinedObjective ? (
                  <StatusPill>Todavía sin objetivo definido</StatusPill>
                ) : (
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {objectives
                      .filter((objective) => objective.title.trim().length > 0)
                      .map((objective, index) => (
                        <li key={index}>
                          {objective.title}
                          {objective.kind === 'primary' ? ' (principal)' : ''}
                        </li>
                      ))}
                  </ul>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Problemas</dt>
              <dd>{linesToList(problems).length} declarado(s)</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Restricciones</dt>
              <dd>{linesToList(constraints).length} declarada(s)</dd>
            </div>
          </dl>

          {!readiness.ready ? <Callout tone="warning">{readiness.reason}</Callout> : null}

          {hasUnsavedChanges ? (
            <Callout tone="danger" title="No se puede confirmar todavía">
              <p>
                Confirmar activa lo que está guardado en el borrador, no lo que ves acá.
                Falta guardar:{' '}
                <strong>
                  {pending_.map((item) => ONBOARDING_STEP_LABELS[item]).join(', ')}
                </strong>
                .
              </p>
            </Callout>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => goTo('context')} disabled={pending}>
              Volver
            </Button>
            <Button
              onClick={() => runConfirm()}
              disabled={pending || !readiness.ready || hasUnsavedChanges}
            >
              {pending ? 'Confirmando…' : 'Confirmar contexto'}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
