import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El estado vacío de Diagnóstico sale de una consulta real a `reports` (bajo RLS), no de
 * un dato fijo. Supabase se simula: acá se prueba la consulta y su interpretación.
 */

const from = vi.fn();
const eq = vi.fn();
const limit = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/modules/identity/session', () => ({ requireUser: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    from: (t: string) => (from(t), { select: () => ({ eq: (...a: unknown[]) => (eq(...a), { limit: (n: number) => limit(n) }) }) }),
  }),
}));

const { getDiagnostico } = await import('@/modules/app-data');

describe('getDiagnostico', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sin reportes listos devuelve null (estado vacío)', async () => {
    limit.mockResolvedValue({ data: [], error: null });
    await expect(getDiagnostico()).resolves.toBeNull();
    expect(from).toHaveBeenCalledWith('reports');
    expect(eq).toHaveBeenCalledWith('status', 'ready');
  });

  it('un error de lectura no se disfraza de estado vacío', async () => {
    limit.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    await expect(getDiagnostico()).rejects.toThrow(/No se pudo leer el diagnóstico/);
  });

  it('con un reporte listo no dice que no hay diagnóstico', async () => {
    limit.mockResolvedValue({ data: [{ id: 'r-1' }], error: null });
    await expect(getDiagnostico()).rejects.toThrow(/todavía no sabe mostrarlo/);
  });
});
