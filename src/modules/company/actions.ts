'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUserForAction } from '@/modules/identity/session';

import { MONEDAS, PAISES, RUBROS } from './profile-options';
import { ensureCompany, getCurrentCompany, renameCompany } from './service';

export type ProfileResult = { ok: true; message: string } | { ok: false; message: string };

const ELEGI_DE_LA_LISTA = 'Elegí una opción de la lista.';

// La pertenencia a la lista se comprueba después (ver `fueraDeLista`): las listas todavía
// no están aprobadas y un valor ya guardado puede dejar de figurar en ellas.
const opcional = z
  .string(ELEGI_DE_LA_LISTA)
  .trim()
  .max(80, ELEGI_DE_LA_LISTA)
  .transform((v) => (v === '' ? null : v));

const perfilSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'Escribí el nombre de la empresa.')
    .max(200, 'El nombre puede tener hasta 200 caracteres.'),
  rubro: opcional,
  pais: opcional,
  moneda: opcional,
});

const CAMPOS = [
  { campo: 'rubro', columna: 'industry', lista: RUBROS },
  { campo: 'pais', columna: 'country', lista: PAISES },
  { campo: 'moneda', columna: 'currency', lista: MONEDAS },
] as const;

type Perfil = z.infer<typeof perfilSchema>;

/** Campos con un valor que no está en su lista de opciones. */
const fueraDeLista = (perfil: Perfil) =>
  CAMPOS.filter(({ campo, lista }) => {
    const valor = perfil[campo];
    return valor !== null && !(lista as readonly string[]).includes(valor);
  });

/** Columnas de 0013 todavía no aplicadas: PostgREST (PGRST204) o PostgreSQL (42703). */
const faltaMigracion = (code: string | undefined) => code === 'PGRST204' || code === '42703';

/**
 * Guarda la empresa desde Configuración: la crea si todavía no existe (reemplaza al
 * onboarding) y guarda nombre, rubro, país y moneda.
 *
 * Revalida la identidad por su cuenta: una Server Action es un POST que el proxy puede no
 * cubrir. El identificador de la empresa nunca llega del cliente: se resuelve por la
 * membresía del usuario y RLS solo deja modificar la propia.
 */
export async function guardarPerfilEmpresa(input: unknown): Promise<ProfileResult> {
  let empresaCreada = false;
  try {
    await requireUserForAction();

    const parsed = perfilSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisá los datos.' };
    }
    const { nombre, rubro, pais, moneda } = parsed.data;

    // El alta sigue siendo idempotente; para una empresa existente, todos los campos se
    // actualizan en una sola sentencia, de modo que un error no deje solo el nombre cambiado.
    const existente = await getCurrentCompany();
    const supabase = await createSupabaseServerClient();

    // Un valor fuera de la lista solo se acepta si es el que la empresa ya tiene guardado:
    // si la lista cambia, la empresa puede seguir guardando sin perder ni cambiar ese dato.
    const fuera = fueraDeLista(parsed.data);
    if (fuera.length > 0) {
      const { data: guardado } = existente
        ? await supabase.from('companies').select('*').eq('id', existente.id).maybeSingle()
        : { data: null };
      if (fuera.some(({ campo, columna }) => guardado?.[columna] !== parsed.data[campo])) {
        return { ok: false, message: ELEGI_DE_LA_LISTA };
      }
    }

    const empresa = existente ?? (await ensureCompany(nombre));
    empresaCreada = !existente;

    const { data, error } = await supabase
      .from('companies')
      .update({ name: nombre, industry: rubro, country: pais, currency: moneda })
      .eq('id', empresa.id)
      .select('id')
      .single();

    if (error && faltaMigracion(error.code)) {
      // Antes de 0013 solo puede guardarse el nombre. Este guardado parcial se comunica
      // expresamente; no se intenta para ningún otro error de la base.
      if (empresa.name !== nombre) await renameCompany(nombre);
      revalidatePath('/app', 'layout');
      return {
        ok: true,
        message:
          'Se guardó el nombre. Rubro, país y moneda se van a poder guardar cuando se aplique la actualización 0013 de la base.',
      };
    }
    if (error || data?.id !== empresa.id) {
      if (!existente) {
        // ensureCompany ya creó la fila en otra operación: no ocultar ese resultado.
        revalidatePath('/app', 'layout');
        return {
          ok: false,
          message: 'Se guardó el nombre de la empresa, pero no los demás datos. Probá de nuevo.',
        };
      }
      return { ok: false, message: 'No se pudieron guardar los cambios. Probá de nuevo.' };
    }

    revalidatePath('/app', 'layout');
    return { ok: true, message: 'Cambios guardados.' };
  } catch {
    if (empresaCreada) {
      return {
        ok: false,
        message: 'Se guardó el nombre de la empresa, pero no se pudo confirmar el resto. Recargá la página antes de reintentar.',
      };
    }
    return { ok: false, message: 'No se pudieron guardar los cambios. Probá de nuevo.' };
  }
}
