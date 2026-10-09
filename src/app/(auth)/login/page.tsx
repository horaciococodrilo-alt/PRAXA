'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import s from '@/components/auth/auth.module.css';
import { authErrorMessage } from '@/components/auth/errors';
import { MailIcon } from '@/components/auth/icons';
import {
  AltAction,
  AuthCard,
  AuthField,
  AuthForm,
  AuthLink,
  AuthSplit,
  LoginAside,
  Notice,
  SubmitButton,
  TextInput,
} from '@/components/auth/parts';
import { PasswordInput } from '@/components/auth/password-input';
import { ConfigurationMissing } from '@/components/configuration-missing';
import { isSupabaseConfigured } from '@/lib/env';
import { safeNextPath } from '@/lib/safe-next';
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
          authErrorMessage(
            {
              // Versiones viejas de Supabase no mandan el código de "correo sin confirmar".
              code:
                signInError.code ??
                (signInError.message === 'Email not confirmed' ? 'email_not_confirmed' : undefined),
              status: signInError.status,
            },
            'No pudimos iniciar sesión. Revisá el correo y la contraseña.',
          ),
        );
        return;
      }

      // El servidor tiene que volver a leer la sesión desde las cookies.
      router.replace(safeNextPath(next));
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthSplit aside={<LoginAside />}>
      <AuthCard
        title="Iniciá sesión"
        subtitle="Bienvenido de vuelta a Praxa"
        footer={<AltAction text="¿No tenés una cuenta?" href="/signup" action="Creá tu cuenta" />}
      >
        <AuthForm onSubmit={handleSubmit}>
          {notice === 'password-updated' ? (
            <Notice>Tu contraseña se actualizó. Ya podés ingresar.</Notice>
          ) : null}

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

          <AuthField label="Contraseña">
            {(field) => (
              <PasswordInput
                {...field}
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </AuthField>

          <div className={s.derecha}>
            <AuthLink href="/forgot-password">¿Olvidaste tu contraseña?</AuthLink>
          </div>

          {error ? <Notice tone="danger">{error}</Notice> : null}

          <SubmitButton pending={pending} pendingLabel="Ingresando…">
            Iniciar sesión
          </SubmitButton>
        </AuthForm>
      </AuthCard>
    </AuthSplit>
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
