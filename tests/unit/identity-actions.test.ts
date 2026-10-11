import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Guardar nombre y apellido desde Mi perfil. Van a los metadatos de Auth del propio usuario
 * (solo para mostrar) y nunca tocan el correo. Supabase y la sesión se simulan.
 */

const updateUser = vi.fn();
const getUser = vi.fn();
const remove = vi.fn();
const download = vi.fn();
const requireUserForAction = vi.fn();
const revalidatePath = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock('@/modules/identity/session', () => ({ requireUserForAction: () => requireUserForAction() }));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { updateUser: (v: unknown) => updateUser(v), getUser: () => getUser() },
    storage: { from: () => ({ remove: (v: unknown) => remove(v), download: (v: unknown) => download(v) }) },
  }),
}));

const { eliminarFotoPerfil, guardarFotoPerfil, guardarNombreUsuario } = await import(
  '@/modules/identity/actions'
);

describe('guardarNombreUsuario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserForAction.mockResolvedValue({ id: 'u-1' });
    updateUser.mockResolvedValue({ error: null });
  });

  it('guarda nombre y apellido en los metadatos, sin tocar el correo', async () => {
    const r = await guardarNombreUsuario({ nombre: '  Ana ', apellido: 'Ruiz', email: 'otro@ejemplo.com' });
    expect(r).toEqual({ ok: true, message: 'Cambios guardados.' });
    expect(updateUser).toHaveBeenCalledWith({ data: { first_name: 'Ana', last_name: 'Ruiz' } });
    expect(revalidatePath).toHaveBeenCalledWith('/app', 'layout');
  });

  it('vacío borra el dato', async () => {
    await guardarNombreUsuario({ nombre: '', apellido: '   ' });
    expect(updateUser).toHaveBeenCalledWith({ data: { first_name: null, last_name: null } });
  });

  it.each([
    [{ nombre: 'a'.repeat(81), apellido: '' }],
    [{ nombre: 'Ana\u0000', apellido: '' }],
    [{ nombre: 3, apellido: '' }],
  ])('rechaza datos inválidos sin llamar a Auth: %j', async (input) => {
    const r = await guardarNombreUsuario(input);
    expect(r.ok).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('sin sesión no guarda nada', async () => {
    requireUserForAction.mockRejectedValue(new Error('sin sesión'));
    const r = await guardarNombreUsuario({ nombre: 'Ana', apellido: '' });
    expect(r.ok).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('un error de Auth se informa sin detalles internos', async () => {
    updateUser.mockResolvedValue({ error: { message: 'internal' } });
    const r = await guardarNombreUsuario({ nombre: 'Ana', apellido: '' });
    expect(r).toEqual({ ok: false, message: 'No se pudieron guardar los cambios. Probá de nuevo.' });
  });
});

describe('foto de perfil', () => {
  const ID = '00000000-0000-4000-8000-000000000001';
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];
  const JPG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46];
  const archivo = (bytes: number[]) => new Blob([new Uint8Array(bytes)]);

  beforeEach(() => {
    vi.clearAllMocks();
    requireUserForAction.mockResolvedValue({ id: ID });
    updateUser.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { user_metadata: { avatar_path: `${ID}/vieja.jpg` } } } });
    remove.mockResolvedValue({ error: null });
    download.mockResolvedValue({ data: archivo(PNG), error: null });
  });

  it('registra la foto nueva y borra la anterior', async () => {
    const r = await guardarFotoPerfil(`${ID}/nueva.png`);
    expect(r).toEqual({ ok: true, message: 'Foto actualizada.' });
    expect(updateUser).toHaveBeenCalledWith({ data: { avatar_path: `${ID}/nueva.png` } });
    expect(remove).toHaveBeenCalledWith([`${ID}/vieja.jpg`]);
    expect(revalidatePath).toHaveBeenCalledWith('/app', 'layout');
  });

  it.each([
    '11111111-0000-4000-8000-000000000002/ajena.png',
    `${ID}/../otra/foto.png`,
    `${ID}/foto.gif`,
    `${ID}/foto.png?x=1`,
    42,
  ])('rechaza una ruta fuera de la carpeta propia o inválida: %j', async (ruta) => {
    const r = await guardarFotoPerfil(ruta);
    expect(r.ok).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  // Storage confía en el tipo declarado: el servidor mira los primeros bytes del archivo.
  it('acepta un JPG por su contenido', async () => {
    download.mockResolvedValue({ data: archivo(JPG), error: null });
    const r = await guardarFotoPerfil(`${ID}/nueva.jpg`);
    expect(r.ok).toBe(true);
    expect(download).toHaveBeenCalledWith(`${ID}/nueva.jpg`);
  });

  it.each([
    ['texto', Array.from(new TextEncoder().encode('<script>alert(1)</script>'))],
    ['un ejecutable', [0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]],
    ['un archivo vacío', []],
    ['un GIF', Array.from(new TextEncoder().encode('GIF89a..'))],
  ])('rechaza %s declarado como foto, sin registrarlo, y borra la subida', async (_, bytes) => {
    download.mockResolvedValue({ data: archivo(bytes), error: null });
    const r = await guardarFotoPerfil(`${ID}/nueva.png`);
    expect(r).toEqual({ ok: false, message: 'El archivo no es una foto JPG o PNG válida.' });
    expect(updateUser).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith([`${ID}/nueva.png`]);
  });

  it('si no puede leer el archivo, no lo registra ni lo borra', async () => {
    download.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const r = await guardarFotoPerfil(`${ID}/nueva.png`);
    expect(r.ok).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  // `avatar_path` lo puede escribir el propio usuario: una ruta ajena nunca se borra.
  it('al reemplazar, no borra una foto anterior fuera de la carpeta propia', async () => {
    getUser.mockResolvedValue({
      data: { user: { user_metadata: { avatar_path: '11111111-0000-4000-8000-000000000002/ajena.png' } } },
    });
    const r = await guardarFotoPerfil(`${ID}/nueva.png`);
    expect(r.ok).toBe(true);
    expect(remove).not.toHaveBeenCalled();
  });

  it('al eliminar, quita la referencia pero no borra un archivo fuera de la carpeta propia', async () => {
    getUser.mockResolvedValue({
      data: { user: { user_metadata: { avatar_path: '11111111-0000-4000-8000-000000000002/ajena.png' } } },
    });
    const r = await eliminarFotoPerfil();
    expect(r).toEqual({ ok: true, message: 'Foto eliminada.' });
    expect(updateUser).toHaveBeenCalledWith({ data: { avatar_path: null } });
    expect(remove).not.toHaveBeenCalled();
  });

  it('eliminar quita la referencia antes de borrar el archivo', async () => {
    const r = await eliminarFotoPerfil();
    expect(r).toEqual({ ok: true, message: 'Foto eliminada.' });
    expect(remove).toHaveBeenCalledWith([`${ID}/vieja.jpg`]);
    expect(updateUser).toHaveBeenCalledWith({ data: { avatar_path: null } });
    expect(updateUser.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
  });

  it('si Auth falla, conserva el archivo y la referencia', async () => {
    updateUser.mockResolvedValue({ error: { message: 'x' } });
    const r = await eliminarFotoPerfil();
    expect(r.ok).toBe(false);
    expect(remove).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('si Storage no confirma el borrado, informa que la foto ya salió del perfil', async () => {
    remove.mockResolvedValue({ error: { message: 'x' } });
    const r = await eliminarFotoPerfil();
    expect(r).toMatchObject({ ok: false, fotoQuitada: true });
    expect(updateUser).toHaveBeenCalledWith({ data: { avatar_path: null } });
    expect(revalidatePath).toHaveBeenCalledWith('/app', 'layout');
  });

  it('si se pierde la respuesta de Storage, tampoco restaura una referencia incierta', async () => {
    remove.mockRejectedValue(new Error('respuesta perdida'));
    const r = await eliminarFotoPerfil();
    expect(r).toMatchObject({ ok: false, fotoQuitada: true });
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/app', 'layout');
  });
});
