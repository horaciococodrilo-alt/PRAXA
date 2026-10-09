'use client';

import { useState } from 'react';

import {
  AltAction,
  AuthCard,
  AuthField,
  AuthForm,
  AuthLink,
  AuthSplit,
  Notice,
  SignupAside,
  SubmitButton,
  TextInput,
} from '@/components/auth/parts';
import { PasswordInput } from '@/components/auth/password-input';
import { ConfigurationMissing } from '@/components/configuration-missing';
import { getSiteUrl, isSupabaseConfigured } from '@/lib/env';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  if (!isSupabaseConfigured()) return <ConfigurationMissing />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRegistered(false);

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent('/onboarding')}`,
        },
      });

      // Avisar que el correo ya tiene cuenta revela qué correos están registrados: es un
      // riesgo aceptado por el usuario (H-E1-73, SECURITY.md §12). Supabase lo señala de
      // dos formas: con la confirmación por correo activa no da error, pero devuelve un
      // usuario sin identidades y no envía nada; sin confirmación, responde
      // user_already_exists.
      if (signUpError?.code === 'user_already_exists' || data.user?.identities?.length === 0) {
        setRegistered(true);
        return;
      }
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
      <AuthCard
        narrow
        title="Revisá tu correo"
        subtitle={
          <>
            Enviamos un enlace de verificación a <strong>{email}</strong>. Abrilo para confirmar tu
            cuenta y continuar con la configuración de tu empresa.
          </>
        }
        footer={<AltAction text="¿Ya lo confirmaste?" href="/login" action="Iniciá sesión" />}
      />
    );
  }

  return (
    <AuthSplit aside={<SignupAside />}>
      <AuthCard
        title="Creá tu cuenta"
        footer={<AltAction text="¿Ya tenés una cuenta?" href="/login" action="Iniciá sesión" />}
      >
        <AuthForm onSubmit={handleSubmit}>
          <AuthField label="Email">
            {(field) => (
              <TextInput
                {...field}
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

          <AuthField label="Contraseña" hint="Mínimo 8 caracteres.">
            {(field) => (
              <PasswordInput
                {...field}
                toggle="texto"
                name="password"
                autoComplete="new-password"
                placeholder="Creá una contraseña"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </AuthField>

          {registered ? (
            <Notice tone="danger">
              Ese correo ya tiene una cuenta. <AuthLink href="/login">Iniciá sesión</AuthLink> o{' '}
              <AuthLink href="/forgot-password">recuperá tu contraseña</AuthLink>.
            </Notice>
          ) : null}
          {error ? <Notice tone="danger">{error}</Notice> : null}

          <SubmitButton pending={pending} pendingLabel="Creando cuenta…">
            Crear cuenta
          </SubmitButton>
        </AuthForm>
      </AuthCard>
    </AuthSplit>
  );
}
