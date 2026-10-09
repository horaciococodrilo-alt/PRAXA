import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { proxy } from '@/proxy';

const auth = vi.hoisted(() => ({ authenticated: true }));

vi.mock('@/lib/env', () => ({
  readSupabaseEnv: () => ({ url: 'https://supabase.example', publishableKey: 'public-test-key' }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookies: {
        setAll: (
          cookies: {
            name: string;
            value: string;
            options: { path: string; httpOnly: boolean; maxAge?: number };
          }[],
          headers: Record<string, string>,
        ) => void;
      };
    },
  ) => ({
    auth: {
      getClaims: async () => {
        options.cookies.setAll(
          [
            {
              name: 'sb-test-auth-token',
              value: auth.authenticated ? 'renewed' : '',
              options: { path: '/', httpOnly: true, ...(!auth.authenticated && { maxAge: 0 }) },
            },
          ],
          { 'Cache-Control': 'private, no-store', Expires: '0', Pragma: 'no-cache' },
        );
        return { data: { claims: auth.authenticated ? { sub: 'test-user' } : null } };
      },
    },
  }),
}));

describe('proxy: cookies renovadas al redirigir', () => {
  beforeEach(() => {
    auth.authenticated = true;
  });

  it('las entrega al navegador cuando una sesión renovada sale de /login', async () => {
    const response = await proxy(new NextRequest('https://praxa.example/login'));

    expect(response.headers.get('location')).toBe('https://praxa.example/app');
    expect(response.cookies.get('sb-test-auth-token')).toMatchObject({
      value: 'renewed',
      httpOnly: true,
    });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('expires')).toBe('0');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });

  it('también entrega las cookies de limpieza al redirigir una sesión inválida', async () => {
    auth.authenticated = false;
    const response = await proxy(new NextRequest('https://praxa.example/app/integraciones'));

    expect(response.headers.get('location')).toBe(
      'https://praxa.example/login?next=%2Fapp%2Fintegraciones',
    );
    expect(response.cookies.get('sb-test-auth-token')).toMatchObject({ value: '', maxAge: 0 });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
