'use client';

import { useState } from 'react';

import { authErrorMessage } from '@/components/auth/errors';
import { MailIcon } from '@/components/auth/icons';
import {
  AltAction,
  AuthCard,
  AuthField,
  AuthForm,
  Notice,
  SubmitButton,
  TextInput,
} from '@/components/auth/parts';
import { ConfigurationMissing } from '@/components/configuration-missing';
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
        setError(
          authErrorMessage(resetError, 'No pudimos enviar el enlace. Intentá de nuevo en unos minutos.'),
        );
        return;
      }
      setSent(true);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <AuthCard
        narrow
        title="Revisá tu correo"
        subtitle={
          <>
            Si <strong>{email}</strong> corresponde a una cuenta, enviamos un enlace para elegir una
            contraseña nueva.
          </>
        }
        footer={<AltAction text="¿Ya la cambiaste?" href="/login" action="Iniciá sesión" />}
      />
    );
  }

  return (
    <AuthCard
      narrow
      title="Recuperá tu acceso"
      subtitle="Te enviamos un enlace para elegir una contraseña nueva."
      footer={<AltAction text="¿La recordaste?" href="/login" action="Iniciá sesión" />}
    >
      <AuthForm onSubmit={handleSubmit}>
        <AuthField label="Email">
          {(field) => (
            <TextInput
              {...field}
              icon={<MailIcon />}
              type="email"
              name="email"
              autoComplete="email"
              placeholder="tu@email.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </AuthField>

        {error ? <Notice tone="danger">{error}</Notice> : null}

        <SubmitButton pending={pending} pendingLabel="Enviando…">
          Enviar enlace
        </SubmitButton>
      </AuthForm>
    </AuthCard>
  );
}
