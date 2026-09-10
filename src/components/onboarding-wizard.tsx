'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

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
  context: {
    hasDefinedObjective: boolean;
    problems: string[];
    constraints: string[];
    additionalContext: string;
    objectives: DraftObjective[];
    systems: DraftSystem[];
  } | null;
};

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
 * Huella del contenido del formulario.
 *
 * Se compara contra la del último guardado para saber si hay cambios pendientes. Sin
 * esto, la pantalla de Revisión mostraba el estado local mientras "Confirmar contexto"
 * activaba lo que había en la base: podías ver un objetivo y confirmar otro.
 */
export function fingerprint(state: {
  companyName: string;
  systems: DraftSystem[];
  hasDefinedObjective: boolean;
  objectives: DraftObjective[];
  problems: string;
  constraints: string;
  additionalContext: string;
}): string {
  return JSON.stringify({
    companyName: state.companyName.trim(),
    systems: [...state.systems]
      .map((s) => ({ k: s.system_key, l: s.label, n: s.notes }))
      .sort((a, b) => a.k.localeCompare(b.k)),
    hasDefinedObjective: state.hasDefinedObjective,
    objectives: state.hasDefinedObjective
      ? state.objectives
          .filter((o) => o.title.trim().length > 0)
          .map((o) => ({
            kind: o.kind,
            title: o.title.trim(),
            description: o.description,
            priority: o.priority,
            horizon: o.horizon,
            indicator_name: o.indicator_name,
            target_value: o.target_value,
            target_unit: o.target_unit,
          }))
      : [],
    problems: linesToList(state.problems),
    constraints: linesToList(state.constraints),
    additionalContext: state.additionalContext.trim(),
  });
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

  const currentState = {
    companyName,
    systems,
    hasDefinedObjective,
    objectives,
    problems,
    constraints,
    additionalContext,
  };

  // Huella de lo que está guardado en la base. Arranca en el estado inicial, que viene
  // del borrador persistido, y se actualiza en cada guardado exitoso.
  const [savedFingerprint, setSavedFingerprint] = useState(() => fingerprint(currentState));
  const hasUnsavedChanges = fingerprint(currentState) !== savedFingerprint;

  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setResult(null);
    const snapshot = fingerprint(currentState);

    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) {
        setSavedFingerprint(snapshot);
        router.refresh();
        onSuccess?.();
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
                hasUnsavedChanges
                  ? 'Tenés cambios sin guardar en este paso'
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

      {hasUnsavedChanges ? (
        <Callout tone="warning" title="Tenés cambios sin guardar">
          <p>
            Lo que ves en pantalla todavía no está en el borrador. Usá &ldquo;Guardar y
            continuar&rdquo; en el paso correspondiente antes de confirmar.
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
                run(() => saveCompanyStep({ name: companyName }), () => goTo('systems'))
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
              onClick={() => run(() => saveSystemsStep({ systems }), () => goTo('objectives'))}
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
                Como hay cambios sin guardar, las dos cosas no coinciden: guardalos y
                volvé a esta pantalla.
              </p>
            </Callout>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => goTo('context')} disabled={pending}>
              Volver
            </Button>
            <Button
              onClick={() => run(confirmContext, () => router.push('/app'))}
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
