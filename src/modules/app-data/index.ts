import 'server-only';

import { cache } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/modules/identity/session';
import { requireTenantContext } from '@/modules/tenant/context';
import { readConnectionRecord } from '@/modules/integrations/repository/connections';

import { INTEGRACIONES_BASE, usoEnCero } from './mock';
import type { Diagnostico, Empresa, Integracion, Uso, Usuario } from './types';

export type * from './types';

/**
 * Capa de datos de las pantallas de `/app`.
 *
 * Lo que ya existe sale de Supabase: el correo y el alta del usuario, y la empresa
 * (nombre, rubro, país y moneda) y si hay un diagnóstico. Todo lo demás es MOCK (ver `mock.ts`) hasta que exista el backend; cada
 * función marcada así es el punto donde se enchufa.
 */

/**
 * Verificación de sesión de cada página de `/app`. Las páginas se renderizan en paralelo
 * con el layout, así que no pueden apoyarse en su chequeo.
 */
export async function requireAppSession(path: string): Promise<void> {
  await requireUser(path);
}

/**
 * Real: correo de la sesión, fecha de alta, nombre y apellido (metadatos de Auth que el
 * usuario carga en Mi perfil; ver `guardarNombreUsuario`) y foto de perfil (bucket privado
 * `avatars`, mostrada con una URL firmada que vence a la hora).
 */
export const getUsuario = cache(async (): Promise<Usuario> => {
  const sesion = await requireUser('/app');
  const supabase = await createSupabaseServerClient();
  // getUser() revalida contra Auth y trae created_at, que los claims no incluyen.
  const { data } = await supabase.auth.getUser();
  const meta = data.user?.user_metadata ?? {};
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  // Solo se firma una ruta dentro de la carpeta del propio usuario.
  const ruta = texto(meta.avatar_path);
  let fotoUrl: string | null = null;
  if (ruta && ruta.startsWith(`${sesion.id}/`)) {
    const { data: firmada } = await supabase.storage.from('avatars').createSignedUrl(ruta, 3600);
    fotoUrl = firmada?.signedUrl ?? null;
  }

  return {
    id: sesion.id,
    email: sesion.email ?? '',
    nombre: texto(meta.first_name),
    apellido: texto(meta.last_name),
    miembroDesde: data.user?.created_at ?? null,
    fotoUrl,
  };
});

/**
 * Real: nombre, rubro, país y moneda de la empresa. `null` si todavía no la creó: se crea
 * al guardar Configuración.
 *
 * `select('*')` a propósito: rubro, país y moneda llegan con 0013. Mientras esa migración no
 * esté aplicada, la lectura sigue funcionando y esos datos quedan vacíos.
 */
export const getEmpresa = cache(async (): Promise<Empresa | null> => {
  const supabase = await createSupabaseServerClient();
  // Sin filtro por id: RLS solo deja ver las empresas donde el usuario es miembro.
  const { data, error } = await supabase.from('companies').select('*').limit(1).maybeSingle();
  if (error) throw new Error(`No se pudo leer la empresa: ${error.message}`);
  if (!data) return null;
  return {
    nombre: data.name,
    rubro: data.industry ?? null,
    pais: data.country ?? null,
    moneda: data.currency ?? null,
  };
});

/** Falta completar la empresa en Configuración: el menú lo marca con un punto rojo. */
export function configuracionPendiente(empresa: Empresa | null): boolean {
  return !empresa || !empresa.rubro || !empresa.pais || !empresa.moneda;
}

/** Meta real bajo RLS; las otras integraciones todavía no tienen conector. */
export async function getIntegraciones(): Promise<Integracion[]> {
  let metaConnected = false;
  try {
    const ctx = await requireTenantContext();
    metaConnected = (await readConnectionRecord(ctx))?.status === 'active';
  } catch { metaConnected = false; }
  return INTEGRACIONES_BASE.map((item) => ({ ...item,
    conectada: item.id === 'meta_ads' ? metaConnected : false }));
}

/** MOCK: la IA todavía no se usa; todo en cero. */
export async function getUso(): Promise<Uso> {
  const hoy = new Date();
  return usoEnCero(hoy);
}

/**
 * Real: el estado vacío sale de una consulta a `reports` bajo RLS (solo los de la empresa
 * del usuario), no de un dato fijo. Hoy la tabla no admite escritura desde la aplicación,
 * así que no hay ninguno listo y devuelve `null`.
 *
 * Todavía no existe el mapeo del contenido de un reporte a esta pantalla. Si aparece uno
 * listo, falla a la vista en lugar de decir que no hay diagnóstico.
 */
export async function getDiagnostico(): Promise<Diagnostico | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('reports').select('id').eq('status', 'ready').limit(1);
  if (error) throw new Error(`No se pudo leer el diagnóstico: ${error.message}`);
  if (!data || data.length === 0) return null;
  throw new Error('Hay un diagnóstico generado, pero esta versión todavía no sabe mostrarlo.');
}
