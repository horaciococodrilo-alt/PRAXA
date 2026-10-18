import 'server-only';

import { SecretValue } from '../crypto/seal';
import { graphUrl } from './api';
import type { MetaHttpClient } from './client';
import { MetaApiError } from './errors';

export const PROBE_MAX_PAGES = 5;
export const PROBE_FIELDS = ['date_start', 'date_stop', 'spend', 'impressions'] as const;
export type ProbeSummary = Readonly<{
  rows: number;
  fieldsPresent: readonly (typeof PROBE_FIELDS)[number][];
  pages: number;
  calls: number;
  complete: boolean;
  durationMs: number;
}>;

const unknownError = () => new MetaApiError({ errorClass: 'unknown', graphCode: null, graphSubcode: null });

export async function probeInsights(
  token: SecretValue,
  accountId: string,
  deps: { http: MetaHttpClient; now: () => number },
): Promise<ProbeSummary> {
  if (!/^act_[0-9]{1,60}$/.test(accountId)) throw unknownError();
  const started = deps.now();
  const fieldsPresent = new Set<(typeof PROBE_FIELDS)[number]>();
  let rows = 0;
  let pages = 0;
  let after: string | undefined;
  let complete = true;
  for (;;) {
    const body = await deps.http.getJson(graphUrl(`${accountId}/insights`, {
      level: 'account', fields: 'spend,impressions', time_increment: '1',
      date_preset: 'last_28d', limit: '100', ...(after === undefined ? {} : { after }),
    }), { bearer: token });
    pages += 1;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw unknownError();
    const response = body as Record<string, unknown>;
    if (!Array.isArray(response.data)) throw unknownError();
    for (const item of response.data) {
      rows += 1;
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      for (const field of PROBE_FIELDS) if (record[field] !== undefined && record[field] !== null) fieldsPresent.add(field);
    }
    const paging = response.paging && typeof response.paging === 'object' && !Array.isArray(response.paging)
      ? response.paging as Record<string, unknown> : null;
    if (!paging || !Object.hasOwn(paging, 'next')) break;
    if (pages >= PROBE_MAX_PAGES) {
      complete = false;
      break;
    }
    const cursors = paging.cursors && typeof paging.cursors === 'object' && !Array.isArray(paging.cursors)
      ? paging.cursors as Record<string, unknown> : null;
    if (typeof cursors?.after !== 'string' || cursors.after.length === 0 || cursors.after.length > 2048) throw unknownError();
    after = cursors.after;
  }
  return Object.freeze({ rows, fieldsPresent: Object.freeze(PROBE_FIELDS.filter((field) => fieldsPresent.has(field))),
    pages, calls: pages, complete, durationMs: Math.max(0, deps.now() - started) });
}
