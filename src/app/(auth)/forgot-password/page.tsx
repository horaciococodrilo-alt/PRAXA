'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ConfigurationMissing } from '@/components/configuration-missing';
import { Button, Callout, Card, Field, Input } from '@/components/ui';
import { getSiteUrl, isSupabaseConfigured } from '@/lib/env';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!isSupabaseConfigured()) return <ConfigurationMissing />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <Card>
        <h1 className="text-xl font-semibold tracking-tight">Revisá tu correo</h1>
        <p className="mt-3 text-sm text-muted">
          Si <strong className="text-foreground">{email}</strong> corresponde a una cuenta,
          enviamos un enlace para elegir una contraseña nueva.
        </p>
        <p className="mt-4 text-sm text-muted">
          <Link href="/login" className="font-medium text-accent hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold tracking-tight">Recuperar acceso</h1>
      <p className="mt-2 text-sm text-muted">
        Te enviamos un enlace para elegir una contraseña nueva.
      </p>

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

        {error ? <Callout tone="danger">{error}</Callout> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Enviando…' : 'Enviar enlace'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        <Link href="/login" className="font-medium text-accent hover:underline">
          Volver
        </Link>
      </p>
    </Card>
  );
}
