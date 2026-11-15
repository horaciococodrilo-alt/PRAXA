import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Sincronización que sigue sola (pedido del usuario, 2026-11-15): la acción por paso corre un
 * paso y devuelve el resultado, sin redirigir, para que la tarjeta encadene los pasos. Sin
 * sesión devuelve «login». El tope de páginas por paso sube a 30, medido contra los 240 s.
 */

const syncTiendanube = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn();
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock('next/navigation', () => ({ redirect: (...a: unknown[]) => redirect(...a) }));
vi.mock('@/modules/integrations/tiendanube/sync', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  syncTiendanube: (...a: unknown[]) => syncTiendanube(...a),
}));

const { pasoSincronizacionTiendanube } = await import('@/modules/integrations/actions');
const { UnauthorizedError } = await import('@/modules/identity/session');
const { DEFAULT_TN_SYNC_LIMITS } = await import('@/modules/integrations/tiendanube/limits');

describe('pasoSincronizacionTiendanube', () => {
  beforeEach(() => { syncTiendanube.mockReset(); revalidatePath.mockReset(); redirect.mockReset(); });

  it('corre un paso, refresca las pantallas y devuelve el resultado sin redirigir', async () => {
    syncTiendanube.mockResolvedValueOnce('parcial');
    expect(await pasoSincronizacionTiendanube()).toBe('parcial');
    expect(revalidatePath).toHaveBeenCalledWith('/app', 'layout');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sin sesión devuelve login; otro fallo, error', async () => {
    syncTiendanube.mockRejectedValueOnce(new UnauthorizedError()).mockRejectedValueOnce(new Error('x'));
    expect(await pasoSincronizacionTiendanube()).toBe('login');
    expect(await pasoSincronizacionTiendanube()).toBe('error');
  });

  it('el tope de páginas por paso es 30 y el paso sigue acotado a 240 s', () => {
    expect(DEFAULT_TN_SYNC_LIMITS.maxPages).toBe(30);
    expect(DEFAULT_TN_SYNC_LIMITS.stepMs).toBe(240_000);
  });
});
