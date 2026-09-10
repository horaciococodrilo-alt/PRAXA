'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ConfigurationMissing } from '@/components/configuration-missing';
import { Button, Callout, Card, Field, Input } from '@/components/ui';
import { getSiteUrl, isSupabaseConfigured } from '@/lib/env';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  if (!isSupabaseConfigured()) return <ConfigurationMissing />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent('/onboarding')}`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
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
          Enviamos un enlace de verificación a <strong className="text-foreground">{email}</strong>.
          Abrilo para confirmar tu cuenta y continuar con la configuración de tu empresa.
        </p>
        <p className="mt-4 text-sm text-muted">
          ¿Ya lo confirmaste?{' '}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold tracking-tight">Crear cuenta</h1>
      <p className="mt-2 text-sm text-muted">
        Vas a ser el administrador del espacio de tu empresa.
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

        <Field label="Contraseña" required hint="Mínimo 8 caracteres.">
          <Input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {error ? <Callout tone="danger">{error}</Callout> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </Card>
  );
}
