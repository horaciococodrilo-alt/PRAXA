'use client';

import { createBrowserClient } from '@supabase/ssr';

import { requireSupabaseEnv } from '@/lib/env';

/** Cliente de Supabase para Client Components. Solo la clave publishable, nunca una credencial privilegiada. */
export function createSupabaseBrowserClient() {
  const env = requireSupabaseEnv();
  return createBrowserClient(env.url, env.publishableKey);
}
