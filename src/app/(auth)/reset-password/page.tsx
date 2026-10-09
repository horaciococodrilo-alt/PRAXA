'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { authErrorMessage, passwordProblem } from '@/components/auth/errors';
import { AuthCard, AuthField, AuthForm, Notice, SubmitButton } from '@/components/auth/parts';
import { PasswordInput } from '@/components/auth/password-input';
import { ConfigurationMissing } from '@/components/configuration-missing';
import { isSupabaseConfigured } from '@/lib/env';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Se llega acá desde el enlace de recuperación, ya con sesión establecida por
 * /auth/callback. Cambiar la contraseña requiere esa sesión: sin ella, Supabase rechaza
 * la operación.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!isSupabaseConfigured()) return <ConfigurationMissing />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(
          authErrorMessage(
            updateError,
            'No pudimos actualizar la contraseña. Puede que el enlace haya expirado; pedí uno nuevo.',
          ),
        );
        return;
      }

      await supabase.auth.signOut();
      router.replace('/login?notice=password-updated');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard narrow title="Elegí una contraseña nueva" subtitle="Vas a usarla para iniciar sesión.">
      <AuthForm onSubmit={handleSubmit}>
        <AuthField label="Contraseña nueva" hint="Mínimo 8 caracteres.">
          {(field) => (
            <PasswordInput
              {...field}
              autoComplete="new-password"
              placeholder="••••••••"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </AuthField>

        <AuthField label="Repetí la contraseña">
          {(field) => (
            <PasswordInput
              {...field}
              autoComplete="new-password"
              placeholder="••••••••"
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          )}
        </AuthField>

        {error ? <Notice tone="danger">{error}</Notice> : null}

        <SubmitButton pending={pending} pendingLabel="Guardando…">
          Guardar contraseña
        </SubmitButton>
      </AuthForm>
    </AuthCard>
  );
}
