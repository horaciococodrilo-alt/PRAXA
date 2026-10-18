'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { UnauthorizedError } from '@/modules/identity/session';
import { confirmAccount, disconnect } from './lifecycle';
import type { MetaOAuthOutcome } from './meta/outcomes';

const LOGIN = '/login?next=%2Fapp%2Fintegraciones';
const RESULT = '/app/integraciones?meta=';

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
