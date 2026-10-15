import type { NextRequest } from 'next/server';

import { handleMetaStart } from '@/modules/integrations/meta/oauth';

/**
 * Inicio del OAuth con Meta. Solo `POST` desde el propio origen (D-M16.1-06): un `GET` con
 * efectos quedaría expuesto a cualquier enlace o imagen de otro sitio. Sin `GET` exportado,
 * Next responde 405.
 */
export async function POST(request: NextRequest) {
  return handleMetaStart(request);
}
