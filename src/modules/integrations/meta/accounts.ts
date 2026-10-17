import 'server-only';

import { currencyCodeSchema, timeZoneSchema } from '@/modules/integrations/contract';
import { SecretValue } from '../crypto/seal';
import { graphUrl } from './api';
import type { MetaHttpClient } from './client';
import { MetaApiError } from './errors';

export const ACCOUNTS_PAGE_LIMIT = 100;
export const ACCOUNTS_MAX_PAGES = 10;
export type DelegatedAccount = Readonly<{ id: string; name: string | null; currency: string; timezone: string }>;
export type DelegatedAccounts = Readonly<{ accounts: readonly DelegatedAccount[]; discarded: number; pages: number }>;

export class AccountListLimitError extends Error {
  constructor() {
    super('No se pudo completar el listado de cuentas.');
    this.name = 'AccountListLimitError';
  }
}

const unknownError = () => new MetaApiError({ errorClass: 'unknown', graphCode: null, graphSubcode: null });

export async function listDelegatedAccounts(
  token: SecretValue,
  systemUserId: string,
  deps: { http: MetaHttpClient },
): Promise<DelegatedAccounts> {
  if (!/^[0-9]{1,32}$/.test(systemUserId)) throw unknownError();
  const accounts: DelegatedAccount[] = [];
  const seen = new Set<string>();
  let discarded = 0;
  let pages = 0;
  let after: string | undefined;
  for (;;) {
    const body = await deps.http.getJson(graphUrl(`${systemUserId}/assigned_ad_accounts`, {
      fields: 'id,name,currency,timezone_name', limit: String(ACCOUNTS_PAGE_LIMIT),
      ...(after === undefined ? {} : { after }),
    }), { bearer: token });
    pages += 1;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw unknownError();
    const fields = body as Record<string, unknown>;
    if (!Array.isArray(fields.data)) throw unknownError();
    for (const item of fields.data) {
      const row = item && typeof item === 'object' && !Array.isArray(item)
        ? item as Record<string, unknown> : {};
      const id = row.id;
      if (typeof id !== 'string' || !/^act_[0-9]{1,60}$/.test(id) ||
          !currencyCodeSchema.safeParse(row.currency).success ||
          !timeZoneSchema.safeParse(row.timezone_name).success) {
        discarded += 1;
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      const name = typeof row.name === 'string' ? row.name.trim().slice(0, 200) : null;
      accounts.push(Object.freeze({ id, name, currency: row.currency as string, timezone: row.timezone_name as string }));
    }
    const paging = fields.paging && typeof fields.paging === 'object' && !Array.isArray(fields.paging)
      ? fields.paging as Record<string, unknown> : null;
    if (!paging || !Object.hasOwn(paging, 'next')) break;
    const cursors = paging.cursors && typeof paging.cursors === 'object' && !Array.isArray(paging.cursors)
      ? paging.cursors as Record<string, unknown> : null;
    if (typeof cursors?.after !== 'string' || cursors.after.length === 0 || cursors.after.length > 2048 ||
        pages >= ACCOUNTS_MAX_PAGES) throw new AccountListLimitError();
    after = cursors.after;
  }
  return Object.freeze({ accounts: Object.freeze(accounts), discarded, pages });
}
