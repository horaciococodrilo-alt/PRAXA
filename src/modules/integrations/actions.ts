'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { UnauthorizedError } from '@/modules/identity/session';
import { confirmAccount, disconnect, disconnectTiendanube, disconnectGa4 } from './lifecycle';
import { confirmGa4Property, previewGa4Property } from './ga4/selection';
import { syncGa4, type Ga4SyncResult } from './ga4/sync';
import { syncMetaInsights, type SyncResult } from './meta/insights';
import type { MetaOAuthOutcome } from './meta/outcomes';
import { syncTiendanube, type TiendanubeSyncResult } from './tiendanube/sync';

const LOGIN = '/login?next=%2Fapp%2Fintegraciones';
const RESULT = '/app/integraciones?meta=';
const SYNC_RESULT = '/app/integraciones?sync=';
const TIENDANUBE_RESULT = '/app/integraciones?tiendanube=';
const TIENDANUBE_SYNC_RESULT = '/app/integraciones?tn_sync=';
const GA4_RESULT = '/app/integraciones?ga4=';

export async function confirmarCuentaMeta(formData: FormData): Promise<never> {
  let result: MetaOAuthOutcome;
  let login = false;
  try {
    const value = formData.get('cuenta');
    result = await confirmAccount(typeof value === 'string' ? value : '');
  } catch (error) {
    login = error instanceof UnauthorizedError;
    result = 'error';
  }
  if (login) redirect(LOGIN);
  revalidatePath('/app', 'layout');
  redirect(`${RESULT}${result}`);
}

/** Sin argumentos de negocio: tenant, conexión y cuenta se resuelven en el servidor. */
export async function sincronizarMeta(): Promise<never> {
  let result: SyncResult;
  let login = false;
  try { ({ result } = await syncMetaInsights()); }
  catch (error) {
    login = error instanceof UnauthorizedError;
    result = 'error';
  }
  if (login) redirect(LOGIN);
  revalidatePath('/app', 'layout');
  redirect(`${SYNC_RESULT}${result}`);
}

export async function desconectarMeta(): Promise<never> {
  let result: MetaOAuthOutcome;
  let login = false;
  try { result = await disconnect(); }
  catch (error) {
    login = error instanceof UnauthorizedError;
    result = 'error';
  }
  if (login) redirect(LOGIN);
  revalidatePath('/app', 'layout');
  redirect(`${RESULT}${result}`);
}

/** M16e: desconecta solo Tiendanube; tenant y conexión se resuelven en el servidor. */
export async function desconectarTiendanube(): Promise<never> {
  let result: Awaited<ReturnType<typeof disconnectTiendanube>>;
  let login = false;
  try { result = await disconnectTiendanube(); }
  catch (error) {
    login = error instanceof UnauthorizedError;
    result = 'error';
  }
  if (login) redirect(LOGIN);
  revalidatePath('/app', 'layout');
  redirect(`${TIENDANUBE_RESULT}${result}`);
}

export async function desconectarGa4(): Promise<never> {
  let result: Awaited<ReturnType<typeof disconnectGa4>>;
  let login = false;
  try { result = await disconnectGa4(); }
  catch (error) { login = error instanceof UnauthorizedError; result = 'error'; }
  if (login) redirect(LOGIN);
  revalidatePath('/app', 'layout');
  redirect(`${GA4_RESULT}${result}`);
}

export async function confirmarPropiedadGa4(formData: FormData): Promise<never> {
  let result: Awaited<ReturnType<typeof confirmGa4Property>>;
  let login = false;
  try {
    const key = formData.get('propiedad');
    result = await confirmGa4Property(typeof key === 'string' ? key : '',
      formData.get('sitio_confirmado') === 'on');
  } catch (error) { login = error instanceof UnauthorizedError; result = 'error'; }
  if (login) redirect(LOGIN);
  revalidatePath('/app', 'layout');
  redirect(`${GA4_RESULT}${result}`);
}

export async function previsualizarPropiedadGa4(formData: FormData) {
  const key = formData.get('propiedad');
  return previewGa4Property(typeof key === 'string' ? key : '');
}

/** Un paso GA4 sin argumentos de tenant ni propiedad; la tarjeta encadena hasta veinte. */
export async function pasoSincronizacionGa4(): Promise<Ga4SyncResult | 'login'> {
  let result: Ga4SyncResult;
  try { result = await syncGa4(); }
  catch (error) {
    if (error instanceof UnauthorizedError) return 'login';
    result = 'error';
  }
  revalidatePath('/app', 'layout');
  return result;
}

/** M16e: un paso de sincronización de Tiendanube; tenant y conexión se resuelven en el servidor. */
/**
 * Un paso de sincronización sin redirigir, para que la tarjeta encadene los pasos hasta
 * terminar con una sola pulsación (pedido del usuario, 2026-11-15). Cada paso sigue siendo una
 * llamada propia, acotada por `maxDuration`; no hay trabajo en segundo plano.
 */
export async function pasoSincronizacionTiendanube(): Promise<TiendanubeSyncResult | 'login'> {
  let result: TiendanubeSyncResult;
  try { result = await syncTiendanube(); }
  catch (error) {
    if (error instanceof UnauthorizedError) return 'login';
    result = 'error';
  }
  revalidatePath('/app', 'layout');
  return result;
}

export async function sincronizarTiendanube(): Promise<never> {
  let result: TiendanubeSyncResult;
  let login = false;
  try { result = await syncTiendanube(); }
  catch (error) {
    login = error instanceof UnauthorizedError;
    result = 'error';
  }
  if (login) redirect(LOGIN);
  revalidatePath('/app', 'layout');
  redirect(`${TIENDANUBE_SYNC_RESULT}${result}`);
}
