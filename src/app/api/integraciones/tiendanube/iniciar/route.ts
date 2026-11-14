import type { NextRequest } from 'next/server';

import { handleTiendanubeStart } from '@/modules/integrations/tiendanube/oauth';

/**
 * Inicio del OAuth con Tiendanube. Solo `POST` desde el propio origen, como Meta (DP-04): un
 * `GET` con efectos quedaría expuesto a cualquier enlace o imagen de otro sitio. Sin `GET`
 * exportado, Next responde 405.
 */
export async function POST(request: NextRequest) {
  return handleTiendanubeStart(request);
}
