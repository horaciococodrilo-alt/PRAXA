import type { NextRequest } from 'next/server';

import { handleGa4Start } from '@/modules/integrations/ga4/oauth';

export async function POST(request: NextRequest) {
  return handleGa4Start(request);
}
