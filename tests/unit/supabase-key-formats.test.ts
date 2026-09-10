import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

/**
 * Compatibilidad de formatos de clave con el SDK instalado.
 *
 * Supabase convive con dos generaciones de claves:
 *
 *   - heredadas: JWT (`eyJ...`) — `anon` y `service_role`;
 *   - actuales:  `sb_publishable_...` y `sb_secret_...`.
 *
 * El proyecto usa los nombres de variable `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y
 * `SUPABASE_TEST_SECRET_KEY`, y acepta cualquiera de las dos generaciones. Estas pruebas
 * verifican esa promesa contra el SDK que está realmente instalado, no contra la
 * documentación: si una futura actualización empezara a rechazar un formato, fallan acá.
 *
 * Ninguna hace red: `createClient` no contacta al servidor.
 */

const URL = 'https://abcdefghijklmnopqrst.supabase.co';

// Un JWT de forma válida pero sin firma real. No es una credencial: no abre nada.
const LEGACY_SHAPED_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.no-es-una-firma-real';

describe('formatos de clave admitidos por @supabase/supabase-js', () => {
  it('acepta una clave publishable del formato actual', () => {
    expect(() => createClient(URL, 'sb_publishable_ejemplo-no-real')).not.toThrow();
  });

  it('acepta una clave secreta del formato actual', () => {
    expect(() => createClient(URL, 'sb_secret_ejemplo-no-real')).not.toThrow();
  });

  it('sigue aceptando el formato JWT heredado', () => {
    expect(() => createClient(URL, LEGACY_SHAPED_KEY)).not.toThrow();
  });

  it('rechaza una clave vacía en lugar de fallar más tarde contra el servidor', () => {
    expect(() => createClient(URL, '')).toThrow();
  });

  it('no advierte por los formatos que este proyecto usa', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      createClient(URL, 'sb_publishable_ejemplo-no-real');
      createClient(URL, 'sb_secret_ejemplo-no-real');
      createClient(URL, LEGACY_SHAPED_KEY);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
