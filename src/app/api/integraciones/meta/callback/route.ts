import type { NextRequest } from 'next/server';

import { handleMetaCallback } from '@/modules/integrations/meta/oauth';

/**
 * Callback del OAuth con Meta. Termina siempre en una redirección limpia, sin `code` ni
 * `state`, con `Referrer-Policy: no-referrer` (CA-30).
 */
export async function GET(request: NextRequest) {
  return handleMetaCallback(request);
}
