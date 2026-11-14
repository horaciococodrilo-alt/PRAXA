import type { NextRequest } from 'next/server';

import { getDiagnosticReport } from '@/modules/app-data';
import { getAuthenticatedUser } from '@/modules/identity/session';
import { diagnosticDownload } from '@/modules/diagnostics/pdf';

/**
 * Descarga del informe vigente en PDF (M26a). Identidad con `getClaims()`, K01 en el servidor y
 * lectura bajo RLS; el PDF se arma en el momento y no se guarda. Sin IDs en la URL.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return diagnosticDownload({ requestUrl: request.url, getUser: getAuthenticatedUser, readReport: getDiagnosticReport });
}
