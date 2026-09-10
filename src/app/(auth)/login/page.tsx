'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { ConfigurationMissing } from '@/components/configuration-missing';
import { Button, Callout, Card, Field, Input } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/env';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const notice = searchParams.get('notice');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(
          signInError.message === 'Email not confirmed'
            ? 'Todavía no confirmaste tu correo. Abrí el enlace que te enviamos.'
            : 'No pudimos iniciar sesión. Revisá el correo y la contraseña.',
        );
        return;
      }

      // El servidor tiene que volver a leer la sesión desde las cookies.
      router.replace(next && next.startsWith('/') ? next : '/app');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold tracking-tight">Iniciar sesión</h1>

      {notice === 'password-updated' ? (
        <div className="mt-4">
          <Callout>Tu contraseña se actualizó. Ya podés ingresar.</Callout>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Correo electrónico" required>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field label="Contraseña" required>
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {error ? <Callout tone="danger">{error}</Callout> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>

      <div className="mt-6 space-y-2 text-sm text-muted">
        <p>
          <Link href="/forgot-password" className="font-medium text-accent hover:underline">
            Olvidé mi contraseña
          </Link>
        </p>
        <p>
          ¿No tenés cuenta?{' '}
          <Link href="/signup" className="font-medium text-accent hover:underline">
            Crear cuenta
          </Link>
        </p>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  if (!isSupabaseConfigured()) return <ConfigurationMissing />;

  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
