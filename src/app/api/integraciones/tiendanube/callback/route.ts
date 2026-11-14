import type { NextRequest } from 'next/server';

import { handleTiendanubeCallback } from '@/modules/integrations/tiendanube/oauth';

/**
 * Callback del OAuth con Tiendanube. Termina siempre en una redirección limpia, sin `code` ni
 * `state`, con `Referrer-Policy: no-referrer`. PRAXA no guarda ni registra el código.
 */
export async function GET(request: NextRequest) {
  return handleTiendanubeCallback(request);
}
