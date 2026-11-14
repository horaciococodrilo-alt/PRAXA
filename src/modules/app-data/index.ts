import 'server-only';

import { cache } from 'react';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/modules/identity/session';
import { requireTenantContext } from '@/modules/tenant/context';
import { readConnectionRecord } from '@/modules/integrations/repository/connections';
import { NoCompanyError } from '@/modules/company/service';
import { composeDocument, goalLabel, readStoredReport, type StoredReport } from '@/modules/diagnostics/compose';
import type { EligibilityReason } from '@/modules/diagnostics/contract';
import { readDiagnosticStatus, supabaseRpc } from '@/modules/diagnostics/eligibility';
import { windowsFor } from '@/modules/diagnostics/evidence';
import { DiagnosticReadError, readActionTypes } from '@/modules/diagnostics/repository';
import { actionTypeOptions, catalogWindowTo } from '@/modules/diagnostics/settings';

import { INTEGRACIONES_BASE, usoEnCero } from './mock';
import type { DiagnosticoVista, Empresa, EstadoDiagnostico, Integracion, Uso, Usuario } from './types';

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

const ESTADO_POR_MOTIVO: Readonly<Record<EligibilityReason, EstadoDiagnostico>> = {
  no_settings: 'sin_objetivo', connection_not_active: 'sin_conexion', sync_missing: 'sincronizacion_requerida',
  sync_running: 'sincronizacion_en_curso', sync_not_usable: 'sincronizacion_requerida',
  sync_stale: 'sincronizacion_requerida', sync_not_after_report: 'sincronizacion_requerida', too_soon: 'espera',
};

/**
 * Real (M26a): estado del diagnóstico que calcula la base, objetivo, opciones del catálogo
 * observado y el informe vigente de `diagnostic_reports` bajo RLS (nunca `reports`). Un error de
 * lectura no se disfraza de estado vacío: lanza y la página muestra el error.
 */
export async function getDiagnostico(): Promise<DiagnosticoVista> {
  let ctx;
  try { ctx = await requireTenantContext(); }
  catch (error) {
    if (error instanceof NoCompanyError) {
      return { estado: 'sin_empresa', motivo: null, disponibleDesde: null, objetivo: null, opcionesObjetivo: [],
        informe: null };
    }
    throw error;
  }
  try {
    const supabase = await createSupabaseServerClient();
    const [status, stored] = await Promise.all([readDiagnosticStatus(ctx, { supabase }),
      readStoredReport(supabase, ctx.company_id)]);
    const connection = status.connection;
    const active = connection?.status === 'active';
    const catalog = active && connection
      ? actionTypeOptions(await readActionTypes(supabaseRpc(supabase), connection.id,
        windowsFor(catalogWindowTo(status.eligibility?.window_to ?? null))))
      : [];
    let estado: EstadoDiagnostico;
    if (!active) estado = 'sin_conexion';
    else if (!status.settings) estado = 'sin_objetivo';
    else if (!status.eligibility) estado = 'sin_conexion';
    else estado = status.eligibility.eligible ? 'listo' : ESTADO_POR_MOTIVO[status.eligibility.reason ?? 'connection_not_active'];
    return {
      estado,
      motivo: status.eligibility?.reason ?? null,
      disponibleDesde: status.eligibility?.available_at ?? null,
      objetivo: status.settings ? { ...status.settings, etiqueta: goalLabel(status.settings) } : null,
      opcionesObjetivo: catalog.map((o) => ({ action_type: o.action_type, label: o.label })),
      informe: stored ? composeDocument(stored) : null,
    };
  } catch {
    throw new DiagnosticReadError();
  }
}

/** Informe vigente para la descarga del PDF (misma lectura que la pantalla, bajo RLS). */
export async function getDiagnosticReport(): Promise<StoredReport | null> {
  let ctx;
  try { ctx = await requireTenantContext(); }
  catch (error) {
    if (error instanceof NoCompanyError) return null;
    throw error;
  }
  const supabase = await createSupabaseServerClient();
  return readStoredReport(supabase, ctx.company_id);
}
