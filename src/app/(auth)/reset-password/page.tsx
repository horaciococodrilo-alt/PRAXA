'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfigurationMissing } from '@/components/configuration-missing';
import { Button, Callout, Card, Field, Input } from '@/components/ui';
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

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
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
          'No pudimos actualizar la contraseña. Puede que el enlace haya expirado; pedí uno nuevo.',
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
    <Card>
      <h1 className="text-xl font-semibold tracking-tight">Elegir contraseña nueva</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Contraseña nueva" required hint="Mínimo 8 caracteres.">
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Field label="Repetir contraseña" required>
          <Input
            type="password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </Field>

        {error ? <Callout tone="danger">{error}</Callout> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
      </form>
    </Card>
  );
}
