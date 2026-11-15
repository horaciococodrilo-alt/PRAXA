import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * H-E1-259: la Server Action consulta por `worker_api` si un correo tiene cuenta. Devuelve
 * solo «existe», «no_existe» o «desconocido»; nunca el error ni datos de la cuenta.
 */

const call = vi.fn();
vi.mock('server-only', () => ({}));
vi.mock('@/modules/integrations/db/worker-api', () => ({ getWorkerApi: () => ({ call }) }));

const { correoTieneCuenta } = await import('@/modules/identity/recovery');

describe('H-E1-259: correoTieneCuenta', () => {
  beforeEach(() => call.mockReset());

  it('normaliza el correo y traduce el booleano de la base', async () => {
    call.mockResolvedValueOnce([{ email_has_account: true }]).mockResolvedValueOnce([{ email_has_account: false }]);
    expect(await correoTieneCuenta('  Persona@Ejemplo.com ')).toBe('existe');
    expect(call).toHaveBeenCalledWith('email_has_account', ['persona@ejemplo.com']);
    expect(await correoTieneCuenta('otra@ejemplo.com')).toBe('no_existe');
  });

  it('un correo mal formado o demasiado largo no consulta la base', async () => {
    for (const email of ['', 'sin-arroba', 'a@b', `${'a'.repeat(320)}@ejemplo.com`, 42 as unknown as string]) {
      expect(await correoTieneCuenta(email)).toBe('desconocido');
    }
    expect(call).not.toHaveBeenCalled();
  });

  it('un fallo o una respuesta rara de la base es «desconocido», sin propagar el error', async () => {
    call.mockRejectedValueOnce(new Error('detalle interno')).mockResolvedValueOnce([{ otra: 1 }]);
    expect(await correoTieneCuenta('persona@ejemplo.com')).toBe('desconocido');
    expect(await correoTieneCuenta('persona@ejemplo.com')).toBe('desconocido');
  });
});
