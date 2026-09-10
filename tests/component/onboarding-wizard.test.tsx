import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  OnboardingWizard,
  type OnboardingInitialState,
} from '@/components/onboarding-wizard';

/**
 * Comportamiento del asistente de onboarding.
 *
 * El error que reproducen estas pruebas: cada Server Action persiste UN paso, pero el
 * seguimiento de "cambios sin guardar" era global. Guardar Sistemas marcaba como
 * guardado también un objetivo editado y nunca persistido, y entonces Revisión mostraba
 * el objetivo nuevo mientras Confirmar activaba el viejo.
 *
 * Las Server Actions se simulan: acá se prueba la pantalla, no la base.
 */

const saveCompanyStep = vi.fn();
const saveSystemsStep = vi.fn();
const saveObjectivesStep = vi.fn();
const saveContextStep = vi.fn();
const confirmContext = vi.fn();

vi.mock('@/modules/onboarding/actions', () => ({
  saveCompanyStep: (...args: unknown[]) => saveCompanyStep(...args),
  saveSystemsStep: (...args: unknown[]) => saveSystemsStep(...args),
  saveObjectivesStep: (...args: unknown[]) => saveObjectivesStep(...args),
  saveContextStep: (...args: unknown[]) => saveContextStep(...args),
  confirmContext: (...args: unknown[]) => confirmContext(...args),
}));

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh, replace: vi.fn() }),
}));

/** Borrador ya persistido, con un objetivo guardado. */
function initialState(): OnboardingInitialState {
  return {
    companyName: 'Mi Tienda',
    hasDraft: true,
    hasActive: false,
    draftSignature: 'draft-1:2026-09-10T00:00:00Z',
    context: {
      hasDefinedObjective: true,
      problems: [],
      constraints: [],
      additionalContext: '',
      objectives: [
        {
          kind: 'primary',
          title: 'Aumentar ventas',
          description: null,
          priority: null,
          horizon: null,
          indicator_name: null,
          target_value: null,
          target_unit: null,
          position: 0,
        },
      ],
      systems: [],
    },
  };
}

const ok = { ok: true as const };

function stepButton(label: string) {
  return screen.getByRole('button', { name: new RegExp(label, 'i') });
}

async function goToStep(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(stepButton(label));
}

function unsavedWarning() {
  return screen.queryByText(/tienen cambios que todavía no están en el borrador/i);
}

function confirmButton() {
  return screen.getByRole('button', { name: /confirmar contexto/i });
}

beforeEach(() => {
  vi.clearAllMocks();
  saveCompanyStep.mockResolvedValue(ok);
  saveSystemsStep.mockResolvedValue(ok);
  saveObjectivesStep.mockResolvedValue(ok);
  saveContextStep.mockResolvedValue(ok);
  confirmContext.mockResolvedValue(ok);
});

describe('cambios sin guardar por paso', () => {
  it('guardar Sistemas NO limpia un objetivo editado y sin guardar', async () => {
    // Esta es la secuencia exacta del error reportado.
    const user = userEvent.setup();
    render(<OnboardingWizard initial={initialState()} />);

    // 1. Cambiar el objetivo en pantalla, sin guardarlo.
    await goToStep(user, '3. Objetivos');
    const objetivo = screen.getByDisplayValue('Aumentar ventas');
    await user.clear(objetivo);
    await user.type(objetivo, 'Reducir faltantes');

    expect(unsavedWarning()).toBeInTheDocument();

    // 2. Ir a Sistemas y guardar ESE paso.
    await goToStep(user, '2. Sistemas');
    await user.click(screen.getByRole('checkbox', { name: /shopify/i }));
    await user.click(screen.getByRole('button', { name: /guardar y continuar/i }));

    await waitFor(() => expect(saveSystemsStep).toHaveBeenCalledTimes(1));
    expect(saveObjectivesStep).not.toHaveBeenCalled();

    // 3. Ir a Revisión: el objetivo sigue sin persistirse.
    await goToStep(user, '5. Revisión');

    const warning = unsavedWarning();
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveTextContent(/objetivos/i);

    expect(confirmButton()).toBeDisabled();
    expect(confirmContext).not.toHaveBeenCalled();
  });

  it('guardar Objetivos limpia solo Objetivos, no la empresa editada', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard initial={initialState()} />);

    // Editar el nombre de la empresa sin guardarlo.
    const nombre = screen.getByDisplayValue('Mi Tienda');
    await user.clear(nombre);
    await user.type(nombre, 'Mi Tienda SRL');

    // Editar y guardar objetivos.
    await goToStep(user, '3. Objetivos');
    const objetivo = screen.getByDisplayValue('Aumentar ventas');
    await user.clear(objetivo);
    await user.type(objetivo, 'Reducir faltantes');
    await user.click(screen.getByRole('button', { name: /guardar y continuar/i }));

    await waitFor(() => expect(saveObjectivesStep).toHaveBeenCalledTimes(1));

    await goToStep(user, '5. Revisión');

    const warning = unsavedWarning();
    expect(warning).toBeInTheDocument();
    // Empresa sigue pendiente; Objetivos ya no.
    expect(warning).toHaveTextContent(/empresa/i);
    expect(warning).not.toHaveTextContent(/objetivos/i);
    expect(confirmButton()).toBeDisabled();
  });

  it('un guardado fallido no marca el paso como persistido', async () => {
    const user = userEvent.setup();
    saveObjectivesStep.mockResolvedValue({ ok: false, message: 'Falló a propósito' });

    render(<OnboardingWizard initial={initialState()} />);

    await goToStep(user, '3. Objetivos');
    const objetivo = screen.getByDisplayValue('Aumentar ventas');
    await user.clear(objetivo);
    await user.type(objetivo, 'Reducir faltantes');
    await user.click(screen.getByRole('button', { name: /guardar y continuar/i }));

    await screen.findByText('Falló a propósito');

    await goToStep(user, '5. Revisión');

    expect(unsavedWarning()).toHaveTextContent(/objetivos/i);
    expect(confirmButton()).toBeDisabled();
  });

  it('editar mientras se guarda deja esos cambios posteriores pendientes', async () => {
    const user = userEvent.setup();

    // El guardado queda en vuelo hasta que lo liberamos.
    let release: (value: typeof ok) => void = () => {};
    saveObjectivesStep.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    render(<OnboardingWizard initial={initialState()} />);

    await goToStep(user, '3. Objetivos');
    const objetivo = screen.getByDisplayValue('Aumentar ventas');
    await user.clear(objetivo);
    await user.type(objetivo, 'Reducir faltantes');

    await user.click(screen.getByRole('button', { name: /guardar y continuar/i }));
    await waitFor(() => expect(saveObjectivesStep).toHaveBeenCalledTimes(1));

    // Mientras el guardado está en vuelo, el usuario sigue escribiendo.
    await user.clear(objetivo);
    await user.type(objetivo, 'Otro objetivo distinto');

    release(ok);

    // Lo que se guardó fue la instantánea anterior: lo tipeado después sigue pendiente.
    await waitFor(() => {
      expect(unsavedWarning()).toHaveTextContent(/objetivos/i);
    });
  });

  it('sin cambios pendientes, se puede confirmar', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard initial={initialState()} />);

    await goToStep(user, '5. Revisión');

    expect(unsavedWarning()).not.toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();

    await user.click(confirmButton());
    await waitFor(() => expect(confirmContext).toHaveBeenCalledTimes(1));
  });

  it('la revisión muestra el contenido guardado, no el editado sin guardar', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard initial={initialState()} />);

    await goToStep(user, '3. Objetivos');
    const objetivo = screen.getByDisplayValue('Aumentar ventas');
    await user.clear(objetivo);
    await user.type(objetivo, 'Reducir faltantes');

    await goToStep(user, '5. Revisión');

    // Aunque en pantalla figure el texto nuevo, la confirmación está bloqueada y se
    // explica por qué: es lo que impide confirmar algo distinto de lo que se ve.
    const bloqueo = screen.getByText(/confirmar activa lo que está guardado en el borrador/i);
    expect(bloqueo).toBeInTheDocument();
    expect(within(bloqueo.closest('div')!).getByText(/objetivos/i)).toBeInTheDocument();
  });
});

describe('cambios del servidor durante la edición', () => {
  it('NO avisa cuando la firma cambia por nuestro propio guardado', async () => {
    // El primer guardado crea el borrador: la firma pasa de null a un id. Eso no es un
    // cambio ajeno y no debe alarmar. Se detectó probando en el navegador.
    const user = userEvent.setup();
    const sinBorrador = initialState();
    sinBorrador.draftSignature = null;
    sinBorrador.hasDraft = false;

    const { rerender } = render(<OnboardingWizard initial={sinBorrador} />);

    const nombre = screen.getByDisplayValue('Mi Tienda');
    await user.clear(nombre);
    await user.type(nombre, 'Tienda Nueva');
    await user.click(screen.getByRole('button', { name: /guardar y continuar/i }));

    await waitFor(() => expect(saveCompanyStep).toHaveBeenCalledTimes(1));

    // El servidor responde con el borrador ya creado.
    const conBorrador = initialState();
    conBorrador.companyName = 'Tienda Nueva';
    conBorrador.draftSignature = 'draft-1:2026-09-10T12:00:00Z';
    rerender(<OnboardingWizard initial={conBorrador} />);

    expect(
      screen.queryByText(/el borrador cambió fuera de esta pestaña/i),
    ).not.toBeInTheDocument();
  });

  it('avisa si el borrador cambió en otra pestaña, sin pisar lo local', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OnboardingWizard initial={initialState()} />);

    await goToStep(user, '3. Objetivos');
    const objetivo = screen.getByDisplayValue('Aumentar ventas');
    await user.clear(objetivo);
    await user.type(objetivo, 'Reducir faltantes');

    // El Server Component se re-renderiza con un borrador distinto.
    const cambiado = initialState();
    cambiado.draftSignature = 'draft-1:2026-09-10T11:00:00Z';
    rerender(<OnboardingWizard initial={cambiado} />);

    expect(screen.getByText(/el borrador cambió fuera de esta pestaña/i)).toBeInTheDocument();
    // Y lo que el usuario escribió sigue ahí: no se pisó.
    expect(screen.getByDisplayValue('Reducir faltantes')).toBeInTheDocument();
  });
});
