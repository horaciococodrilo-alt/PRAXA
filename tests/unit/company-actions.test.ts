import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Guardar Configuración (reemplaza al onboarding): crea la empresa si falta, nunca toma un
 * identificador del cliente y tolera que la migración 0013 todavía no esté aplicada.
 * Supabase y la sesión se simulan: acá se prueba la acción, no la base (eso es pgTAP 11).
 */

const update = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const single = vi.fn();
const getCurrentCompany = vi.fn();
const ensureCompany = vi.fn();
const renameCompany = vi.fn();
const requireUserForAction = vi.fn();

vi.mock('server-only', () => ({}));
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock('@/modules/identity/session', () => ({ requireUserForAction: () => requireUserForAction() }));
vi.mock('@/modules/company/service', () => ({
  getCurrentCompany: () => getCurrentCompany(),
  ensureCompany: (n: string) => ensureCompany(n),
  renameCompany: (n: string) => renameCompany(n),
}));
const guardado = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({
      update: (v: unknown) => (update(v), { eq: (...a: unknown[]) => (eq(...a), { select: (v: string) => (select(v), { single: () => single() }) }) }),
      select: () => ({ eq: () => ({ maybeSingle: () => guardado() }) }),
    }),
  }),
}));

const { guardarPerfilEmpresa } = await import('@/modules/company/actions');

const empresa = { id: 'c-1', name: 'Mi Tienda', owner_id: 'u-1' };
const valido = { nombre: 'Mi Tienda', rubro: 'Otro', pais: 'Argentina', moneda: 'Pesos' };

describe('guardarPerfilEmpresa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserForAction.mockResolvedValue({ id: 'u-1' });
    single.mockResolvedValue({ data: { id: 'c-1' }, error: null });
  });

  it('sin empresa la crea con el nombre y guarda rubro, país y moneda', async () => {
    getCurrentCompany.mockResolvedValue(null);
    ensureCompany.mockResolvedValue(empresa);

    const r = await guardarPerfilEmpresa(valido);

    expect(r).toEqual({ ok: true, message: 'Cambios guardados.' });
    expect(ensureCompany).toHaveBeenCalledWith('Mi Tienda');
    expect(update).toHaveBeenCalledWith({ name: 'Mi Tienda', industry: 'Otro', country: 'Argentina', currency: 'Pesos' });
    expect(eq).toHaveBeenCalledWith('id', 'c-1');
    expect(select).toHaveBeenCalledWith('id');
    // Refresca el layout de /app: así el punto rojo de Configuración se apaga solo.
    expect(revalidatePath).toHaveBeenCalledWith('/app', 'layout');
  });

  it('usa la empresa del usuario aunque el cliente mande otro id', async () => {
    getCurrentCompany.mockResolvedValue(empresa);
    await guardarPerfilEmpresa({ ...valido, id: 'otra-empresa', company_id: 'otra' });
    expect(eq).toHaveBeenCalledWith('id', 'c-1');
    expect(ensureCompany).not.toHaveBeenCalled();
  });

  it('guarda el nombre y los demás campos en una sola actualización', async () => {
    getCurrentCompany.mockResolvedValue(empresa);
    await guardarPerfilEmpresa({ nombre: '  Otra  ', rubro: '', pais: '', moneda: '' });
    expect(renameCompany).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ name: 'Otra', industry: null, country: null, currency: null });
  });

  it.each([
    [{ ...valido, nombre: '   ' }, 'Escribí el nombre de la empresa.'],
    [{ ...valido, rubro: 42 }, 'Elegí una opción de la lista.'],
    [{ ...valido, pais: 'x'.repeat(81) }, 'Elegí una opción de la lista.'],
  ])('rechaza datos inválidos sin tocar la base: %j', async (input, mensaje) => {
    const r = await guardarPerfilEmpresa(input);
    expect(r).toEqual({ ok: false, message: mensaje });
    expect(getCurrentCompany).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...valido, rubro: 'Inventado' }, empresa],
    [{ ...valido, moneda: 'Euros' }, empresa],
    [{ ...valido, moneda: 'Euros' }, null],
  ])('rechaza una opción que no está en la lista ni guardada: %j', async (input, actual) => {
    getCurrentCompany.mockResolvedValue(actual);
    guardado.mockResolvedValue({ data: { ...empresa, industry: 'Otro', country: null, currency: 'Pesos' }, error: null });
    const r = await guardarPerfilEmpresa(input);
    expect(r).toEqual({ ok: false, message: 'Elegí una opción de la lista.' });
    expect(ensureCompany).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('conserva un valor guardado que ya no figura en la lista', async () => {
    getCurrentCompany.mockResolvedValue(empresa);
    guardado.mockResolvedValue({ data: { ...empresa, industry: 'Ferretería', country: null, currency: null }, error: null });
    const r = await guardarPerfilEmpresa({ ...valido, rubro: 'Ferretería' });
    expect(r).toEqual({ ok: true, message: 'Cambios guardados.' });
    expect(update).toHaveBeenCalledWith({ name: 'Mi Tienda', industry: 'Ferretería', country: 'Argentina', currency: 'Pesos' });
  });

  it('sin sesión no guarda nada', async () => {
    requireUserForAction.mockRejectedValue(new Error('sin sesión'));
    const r = await guardarPerfilEmpresa(valido);
    expect(r.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('si 0013 todavía no está aplicada, guarda el nombre y lo avisa', async () => {
    getCurrentCompany.mockResolvedValue(empresa);
    single.mockResolvedValue({ data: null, error: { code: 'PGRST204', message: 'column not found' } });
    const r = await guardarPerfilEmpresa(valido);
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/Se guardó el nombre/);
  });

  it('otro error de la base se informa sin detalles internos', async () => {
    getCurrentCompany.mockResolvedValue(empresa);
    single.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied for table companies' } });
    const r = await guardarPerfilEmpresa({ ...valido, nombre: 'Otra' });
    expect(r).toEqual({ ok: false, message: 'No se pudieron guardar los cambios. Probá de nuevo.' });
    expect(renameCompany).not.toHaveBeenCalled();
  });

  it('si el alta se hizo pero falló el perfil, informa el guardado parcial', async () => {
    getCurrentCompany.mockResolvedValue(null);
    ensureCompany.mockResolvedValue(empresa);
    single.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });

    const r = await guardarPerfilEmpresa(valido);
    expect(r).toEqual({
      ok: false,
      message: 'Se guardó el nombre de la empresa, pero no los demás datos. Probá de nuevo.',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/app', 'layout');
  });

  it('si se pierde la respuesta después del alta, avisa que el resto no está confirmado', async () => {
    getCurrentCompany.mockResolvedValue(null);
    ensureCompany.mockResolvedValue(empresa);
    single.mockRejectedValue(new Error('respuesta perdida'));

    const r = await guardarPerfilEmpresa(valido);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Se guardó el nombre.*no se pudo confirmar el resto/);
  });
});
