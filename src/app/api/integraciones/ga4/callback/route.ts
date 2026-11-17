import type { NextRequest } from 'next/server';

import { handleGa4Callback } from '@/modules/integrations/ga4/oauth';

export async function GET(request: NextRequest) {
  return handleGa4Callback(request);
}
