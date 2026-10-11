'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { requireUserForAction } from './session';

export type NombreResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fotoQuitada?: true };

// Sin caracteres de control: el nombre se muestra en la interfaz.
const parte = z
  .string()
  .trim()
  .max(80, 'Nombre y apellido pueden tener hasta 80 caracteres cada uno.')
  .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), 'El nombre tiene caracteres no válidos.');

const nombreSchema = z.object({ nombre: parte, apellido: parte });

/**
 * Guarda nombre y apellido del usuario desde Mi perfil.
 *
 * Van en los metadatos del usuario de Supabase Auth (`first_name`, `last_name`), que el
 * propio usuario puede modificar: se usan solo para mostrar su nombre, nunca para decidir
 * permisos. El correo no se cambia desde acá.
 */
export async function guardarNombreUsuario(input: unknown): Promise<NombreResult> {
  try {
    await requireUserForAction();

    const parsed = nombreSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisá los datos.' };
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({
      data: { first_name: parsed.data.nombre || null, last_name: parsed.data.apellido || null },
    });
    if (error) return { ok: false, message: 'No se pudieron guardar los cambios. Probá de nuevo.' };

    // El nombre y las iniciales aparecen en la barra lateral y en el avatar de arriba.
    revalidatePath('/app', 'layout');
    return { ok: true, message: 'Cambios guardados.' };
  } catch {
    return { ok: false, message: 'No se pudieron guardar los cambios. Probá de nuevo.' };
  }
}

// `<uuid del usuario>/<nombre generado>.jpg|png`: el nombre lo arma la pantalla al subir.
const RUTA_FOTO = /^[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,64}\.(jpg|png)$/;

// Primeros bytes de un JPG y de un PNG. Storage confía en el tipo que declara quien sube; esto
// mira el contenido. Vale cualquiera de las dos: un PNG guardado como `.jpg` sigue siendo una
// imagen, y lo que se quiere descartar es lo que no lo es.
const FIRMAS = [
  [0xff, 0xd8, 0xff],
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
];

const esImagen = (cabecera: Uint8Array) =>
  FIRMAS.some((firma) => firma.every((byte, i) => cabecera[i] === byte));

async function rutaFotoActual(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const ruta = data.user?.user_metadata?.avatar_path;
  return typeof ruta === 'string' && ruta ? ruta : null;
}

/**
 * Registra la foto de perfil que la pantalla ya subió a Storage (bucket privado `avatars`,
 * 0014) y borra la anterior. La ruta tiene que estar en la carpeta del propio usuario: las
 * políticas de Storage ya lo exigen al subir, y acá se vuelve a comprobar.
 *
 * El archivo no pasa por acá: va directo del navegador a Storage, que aplica los límites
 * (JPG o PNG, hasta 5 MB). Una Server Action no admite cuerpos de ese tamaño. Como Storage
 * solo mira el tipo declarado, acá se leen los primeros bytes del archivo subido y, si no son
 * de una imagen JPG o PNG, no se registra y se borra.
 */
export async function guardarFotoPerfil(ruta: unknown): Promise<NombreResult> {
  try {
    const usuario = await requireUserForAction();
    if (typeof ruta !== 'string' || !RUTA_FOTO.test(ruta) || !ruta.startsWith(`${usuario.id}/`)) {
      return { ok: false, message: 'No se pudo guardar la foto.' };
    }

    const supabase = await createSupabaseServerClient();
    const fotos = supabase.storage.from('avatars');

    // Antes de registrarla se comprueba que el contenido sea de verdad una imagen.
    const { data: archivo, error: descarga } = await fotos.download(ruta);
    if (descarga || !archivo) return { ok: false, message: 'No se pudo guardar la foto. Probá de nuevo.' };
    if (!esImagen(new Uint8Array(await archivo.slice(0, 8).arrayBuffer()))) {
      // No se registra y se borra la subida: quedaría como un archivo sin uso.
      await fotos.remove([ruta]);
      return { ok: false, message: 'El archivo no es una foto JPG o PNG válida.' };
    }

    const anterior = await rutaFotoActual();
    const { error } = await supabase.auth.updateUser({ data: { avatar_path: ruta } });
    if (error) return { ok: false, message: 'No se pudo guardar la foto. Probá de nuevo.' };

    // La anterior ya no se usa: se borra (si falla, queda huérfana en la carpeta propia).
    // Sale de los metadatos, que el usuario puede escribir: solo se borra si es de su carpeta.
    if (anterior && anterior !== ruta && anterior.startsWith(`${usuario.id}/`)) {
      await fotos.remove([anterior]);
    }

    revalidatePath('/app', 'layout');
    return { ok: true, message: 'Foto actualizada.' };
  } catch {
    return { ok: false, message: 'No se pudo guardar la foto. Probá de nuevo.' };
  }
}

/** Quita primero la referencia y luego borra el archivo: Auth nunca apunta a una foto borrada. */
export async function eliminarFotoPerfil(): Promise<NombreResult> {
  try {
    const usuario = await requireUserForAction();
    const anterior = await rutaFotoActual();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.auth.updateUser({ data: { avatar_path: null } });
    if (error) return { ok: false, message: 'No se pudo eliminar la foto. Probá de nuevo.' };

    // Igual que al reemplazarla: solo se borra un archivo de la carpeta propia.
    if (anterior && anterior.startsWith(`${usuario.id}/`)) {
      try {
        const { error: borrado } = await supabase.storage.from('avatars').remove([anterior]);
        if (borrado) throw borrado;
      } catch {
        // La referencia ya se quitó. No restaurarla: la respuesta de Storage podría haberse
        // perdido después del borrado y volveríamos a apuntar a un archivo inexistente.
        revalidatePath('/app', 'layout');
        return {
          ok: false,
          fotoQuitada: true,
          message: 'La foto ya no aparece en tu perfil, pero no se pudo confirmar que el archivo se borró.',
        };
      }
    }

    revalidatePath('/app', 'layout');
    return { ok: true, message: 'Foto eliminada.' };
  } catch {
    return { ok: false, message: 'No se pudo eliminar la foto. Probá de nuevo.' };
  }
}
