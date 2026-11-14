'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { UnauthorizedError } from '@/modules/identity/session';
import { confirmAccount, disconnect, disconnectTiendanube } from './lifecycle';
import { syncMetaInsights, type SyncResult } from './meta/insights';
import type { MetaOAuthOutcome } from './meta/outcomes';

const LOGIN = '/login?next=%2Fapp%2Fintegraciones';
const RESULT = '/app/integraciones?meta=';
const SYNC_RESULT = '/app/integraciones?sync=';
const TIENDANUBE_RESULT = '/app/integraciones?tiendanube=';

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
