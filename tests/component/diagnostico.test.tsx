import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * M26a-T-26 y T-27: estados visibles de la pantalla del diagnóstico y Server Actions sin IDs
 * del cliente. Las acciones se simulan para la pantalla y se prueban reales, con sus
 * dependencias simuladas, en el último bloque. Ninguna llamada paga.
 */

const guardarObjetivoDiagnostico = vi.fn();
const generarDiagnostico = vi.fn();
vi.mock('server-only', () => ({}));
vi.mock('@/modules/diagnostics/actions', () => ({
  guardarObjetivoDiagnostico: (fd: FormData) => guardarObjetivoDiagnostico(fd),
  generarDiagnostico: () => generarDiagnostico(),
}));

const { Diagnostico } = await import('@/components/app/diagnostico');
type Vista = import('@/modules/app-data/types').DiagnosticoVista;
type Doc = NonNullable<Vista['informe']>;

// Documentos literales: la composición real desde el informe guardado la cubre T-24 (unit).
function documento(limites: string[] = []): Doc {
  return {
    title: 'Diagnóstico de Meta Ads', subtitle: 'Informe de 28 días.',
    meta: [{ label: 'Generado', value: '13/11/2026 12:30 (hora de Argentina)' }],
    summary: 'El gasto fue USD 294,00.', opportunities: [{ title: 'Revisar anuncios', priority: 'Prioridad media' }],
    sections: [
      { id: 'summary', title: 'Resumen ejecutivo', blocks: [
        { kind: 'paragraph', label: 'Interpretación de Claude', text: 'El gasto fue USD 294,00.' }] },
      { id: 'limits', title: 'Límites de los datos', blocks: [{ kind: 'list', items: [...limites,
        'Las cifras son de Meta Ads y las calcula PRAXA.'] }] },
    ],
    footer: 'PRAXA.',
  };
}

const informe = documento();
const parcial = documento(['Cobertura parcial: hay días sin observar.']);

function vista(over: Partial<Vista> = {}): Vista {
  return { estado: 'listo', motivo: null, disponibleDesde: null,
    objetivo: { goal_kind: 'purchase', metric_ref: 'actions:purchase', etiqueta: 'Compras' },
    opcionesObjetivo: [{ action_type: 'purchase', label: 'Compras', fit: 'purchase' }], informe: null, ...over };
}

beforeEach(() => {
  guardarObjetivoDiagnostico.mockReset();
  generarDiagnostico.mockReset();
});

describe('M26a-T-26: estados visibles', () => {
  it('sin objetivo: formulario con la lista del servidor y sin IDs', () => {
    const { container } = render(<Diagnostico vista={vista({ estado: 'sin_objetivo', objetivo: null })} />);
    expect(screen.getByRole('heading', { name: 'Elegí el objetivo del diagnóstico' })).toBeInTheDocument();
    const names = [...container.querySelectorAll('input, select, textarea')].map((e) => e.getAttribute('name'));
    expect(new Set(names.filter(Boolean))).toEqual(new Set(['goal_kind', 'action_type']));
    expect(screen.getByRole('option', { name: 'Compras' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generar diagnóstico/ })).not.toBeInTheDocument();
  });

  it('objetivo en tarjetas; sugiere la acción del objetivo elegido y nunca muestra el código de Meta', () => {
    const { container } = render(<Diagnostico vista={vista({ estado: 'sin_objetivo', objetivo: null,
      opcionesObjetivo: [
        { action_type: 'omni_purchase', label: 'Compras en todos los canales (web, app y tienda)', fit: 'purchase' },
        { action_type: 'leadgen_grouped', label: 'Formularios completados en Facebook o Instagram', fit: 'inquiry' },
        { action_type: 'add_to_cart', label: 'Productos agregados al carrito', fit: null },
      ] })} />);
    const select = () => container.querySelector('select[name="action_type"]') as HTMLSelectElement;
    expect(screen.getByRole('radio', { name: /Ventas/ })).toBeChecked();
    expect(screen.getByText('¿Qué cuenta como una venta?')).toBeInTheDocument();
    expect(select().value).toBe('omni_purchase');
    expect(container.querySelector('optgroup[label="Recomendadas"]')).not.toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: /Consultas/ }));
    expect(screen.getByText('¿Qué cuenta como una consulta?')).toBeInTheDocument();
    expect(select().value).toBe('leadgen_grouped');

    fireEvent.click(screen.getByRole('radio', { name: /Tráfico/ }));
    expect(container.querySelector('select[name="action_type"]')).toBeNull();
    expect(container.textContent).not.toMatch(/omni_purchase|leadgen_grouped|add_to_cart/);
  });

  it('espera de 24 h con la fecha disponible', () => {
    render(<Diagnostico vista={vista({ estado: 'espera', motivo: 'too_soon',
      disponibleDesde: '2026-11-14T15:30:00.000000Z' })} />);
    expect(screen.getByText(/Vas a poder generar un diagnóstico nuevo desde el 14\/11\/2026/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generar diagnóstico/ })).not.toBeInTheDocument();
  });

  it('sincronización requerida lleva a integraciones', () => {
    render(<Diagnostico vista={vista({ estado: 'sincronizacion_requerida', motivo: 'sync_stale' })} />);
    expect(screen.getByText(/Sincronizá Meta Ads/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a integraciones' })).toHaveAttribute('href', '/app/integraciones');
  });

  it('sin conexión', () => {
    render(<Diagnostico vista={vista({ estado: 'sin_conexion', objetivo: null })} />);
    expect(screen.getByText(/Conectá tu cuenta de Meta Ads/)).toBeInTheDocument();
  });

  it('listo para generar y generando', async () => {
    generarDiagnostico.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<Diagnostico vista={vista()} />);
    const boton = screen.getByRole('button', { name: 'Generar diagnóstico' });
    await user.click(boton);
    expect(await screen.findByRole('button', { name: /Generando/ })).toBeDisabled();
    expect(generarDiagnostico).toHaveBeenCalledTimes(1);
  });

  it('cero actividad: aviso del resultado, sin informe ficticio', () => {
    render(<Diagnostico vista={vista()} resultado="sin_actividad" />);
    expect(screen.getByRole('status')).toHaveTextContent(/no tuvo actividad/);
    expect(screen.queryByRole('link', { name: 'Descargar PDF' })).not.toBeInTheDocument();
  });

  it('error de lectura visible, no un estado vacío', () => {
    render(<Diagnostico vista={null} error />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo leer el diagnóstico');
    expect(screen.queryByText(/Todavía no hay un diagnóstico/)).not.toBeInTheDocument();
  });

  it('informe vigente con descarga y aviso de reemplazo', () => {
    render(<Diagnostico vista={vista({ informe })} />);
    expect(screen.getByRole('link', { name: 'Descargar PDF' })).toHaveAttribute('href', '/app/diagnostico/descargar');
    expect(screen.getByText(/reemplaza el informe actual/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Resumen ejecutivo' })).toBeInTheDocument();
    expect(screen.getAllByText(/Interpretación de Claude/).length).toBeGreaterThan(0);
  });

  it('informe parcial muestra su límite', () => {
    render(<Diagnostico vista={vista({ informe: parcial })} />);
    const limites = screen.getByRole('region', { name: 'Límites de los datos' });
    expect(within(limites).getByText(/Cobertura parcial/)).toBeInTheDocument();
  });

  it('sin informe no hay descarga ni informe oculto', () => {
    render(<Diagnostico vista={vista({ estado: 'espera', informe: null, disponibleDesde: '2026-11-14T15:30:00.000000Z' })} />);
    expect(screen.queryByRole('link', { name: 'Descargar PDF' })).not.toBeInTheDocument();
    expect(screen.getByText(/Todavía no hay un diagnóstico/)).toBeInTheDocument();
  });

  it('códigos de resultado de lista cerrada', () => {
    const { rerender } = render(<Diagnostico vista={vista()} resultado="generado" />);
    expect(screen.getByRole('status')).toHaveTextContent(/generado/);
    rerender(<Diagnostico vista={vista()} resultado="conexion_cambiada" />);
    expect(screen.getByRole('status')).toHaveTextContent(/conexión con Meta cambió/);
    rerender(<Diagnostico vista={vista()} resultado="fallo_generacion" />);
    expect(screen.getByRole('status')).toHaveTextContent(/No se pudo generar/);
  });
});

// ---------------------------------------------------------------------------
// M26a-T-27: acciones reales con dependencias simuladas.
// ---------------------------------------------------------------------------

const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); });
const requireTenantContext = vi.fn();
const saveSettings = vi.fn();
const readActionTypes = vi.fn();
const readEligibility = vi.fn();
const generateDiagnostic = vi.fn();
const readLiveConnection = vi.fn();
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({ rpc: vi.fn() }) }));
vi.mock('@/modules/tenant/context', () => ({ requireTenantContext: () => requireTenantContext() }));
vi.mock('@/modules/diagnostics/eligibility', () => ({ supabaseRpc: () => vi.fn() }));
vi.mock('@/modules/integrations/db/worker-api', () => ({ getWorkerApi: () => ({ call: vi.fn() }) }));
vi.mock('@/modules/integrations/repository/connections', () => ({
  readLiveConnection: (...a: unknown[]) => readLiveConnection(...a) }));
vi.mock('@/modules/diagnostics/repository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/diagnostics/repository')>()),
  saveSettings: (...a: unknown[]) => saveSettings(...a),
  readActionTypes: (...a: unknown[]) => readActionTypes(...a),
  readEligibility: (...a: unknown[]) => readEligibility(...a),
}));
vi.mock('@/modules/diagnostics/orchestrator', () => ({
  generateDiagnostic: (...a: unknown[]) => generateDiagnostic(...a),
  loadGenerationContext: vi.fn(), anthropicModelSteps: () => ({}),
}));

const CTX = { user_id: 'a0000000-0000-4000-8000-000000000001', company_id: 'c0000000-0000-4000-8000-000000000001',
  role: 'owner', request_id: 'e0000000-0000-4000-8000-000000000001' };

describe('M26a-T-27: Server Actions sin IDs del cliente', () => {
  let actions: typeof import('@/modules/diagnostics/actions');
  beforeAll(async () => {
    actions = await vi.importActual<typeof import('@/modules/diagnostics/actions')>('@/modules/diagnostics/actions');
  });
  beforeEach(() => {
    redirect.mockClear();
    requireTenantContext.mockResolvedValue(CTX);
    readLiveConnection.mockResolvedValue({ id: 'cc000000-0000-4000-8000-000000000001', status: 'active',
      credentialGeneration: 0 });
    readActionTypes.mockResolvedValue([{ action_type: 'purchase', observed_days: 3, total_count: '9' }]);
    saveSettings.mockResolvedValue('saved');
    readEligibility.mockResolvedValue({ eligible: true, reason: null, available_at: null,
      sync_finished_at: '2026-11-13T01:02:03.123456Z', window_to: '2026-11-10' });
  });

  it('R-01: valida contra la misma ventana del catálogo que muestra la pantalla', async () => {
    const fd = new FormData();
    fd.set('goal_kind', 'purchase');
    fd.set('action_type', 'purchase');
    await expect(actions.guardarObjetivoDiagnostico(fd)).rejects.toThrow('REDIRECT');
    expect(readActionTypes.mock.calls[0][2]).toMatchObject({ from: '2026-10-14', to: '2026-11-10' });
  });

  it('guardar objetivo ignora company_id y connection_id del formulario', async () => {
    const fd = new FormData();
    fd.set('goal_kind', 'purchase');
    fd.set('action_type', 'purchase');
    fd.set('company_id', 'ffffffff-ffff-4fff-8fff-ffffffffffff');
    fd.set('connection_id', 'ffffffff-ffff-4fff-8fff-ffffffffffff');
    await expect(actions.guardarObjetivoDiagnostico(fd)).rejects.toThrow('REDIRECT /app/diagnostico?resultado=objetivo_guardado');
    expect(saveSettings).toHaveBeenCalledWith(expect.anything(), CTX,
      { goal_kind: 'purchase', metric_ref: 'actions:purchase' });
  });

  it('un tipo de acción fuera del catálogo es objetivo_invalido', async () => {
    const fd = new FormData();
    fd.set('goal_kind', 'purchase');
    fd.set('action_type', 'inventado');
    await expect(actions.guardarObjetivoDiagnostico(fd)).rejects.toThrow('REDIRECT /app/diagnostico?resultado=objetivo_invalido');
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('generar construye K01 en el servidor y traduce el resultado a un código cerrado', async () => {
    generateDiagnostic.mockResolvedValue({ code: 'no_elegible', reason: 'too_soon' });
    await expect(actions.generarDiagnostico()).rejects.toThrow('REDIRECT /app/diagnostico?resultado=no_elegible');
    const deps = generateDiagnostic.mock.calls[0][0] as { ctx: unknown };
    expect(deps.ctx).toBe(CTX);
  });

  it('sin sesión redirige al login', async () => {
    const { UnauthorizedError } = await import('@/modules/identity/session');
    requireTenantContext.mockRejectedValueOnce(new UnauthorizedError());
    await expect(actions.generarDiagnostico()).rejects.toThrow('REDIRECT /login?next=%2Fapp%2Fdiagnostico');
    requireTenantContext.mockRejectedValueOnce(new UnauthorizedError());
    await expect(actions.guardarObjetivoDiagnostico(new FormData())).rejects.toThrow('REDIRECT /login?next=%2Fapp%2Fdiagnostico');
  });

  it('un error inesperado no expone detalle', async () => {
    generateDiagnostic.mockRejectedValue(new Error('detalle interno'));
    await expect(actions.generarDiagnostico()).rejects.toThrow('REDIRECT /app/diagnostico?resultado=fallo_generacion');
  });
});
