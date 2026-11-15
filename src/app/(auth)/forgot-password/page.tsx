'use client';

import { useState } from 'react';

import { MailIcon } from '@/components/auth/icons';
import {
  AltAction,
  AuthCard,
  AuthField,
  AuthForm,
  AuthLink,
  Notice,
  SubmitButton,
  TextInput,
} from '@/components/auth/parts';
import { enviarEnlaceDeContrasena } from '@/components/auth/recovery';
import { ConfigurationMissing } from '@/components/configuration-missing';
import { isSupabaseConfigured } from '@/lib/env';
import { correoTieneCuenta } from '@/modules/identity/recovery';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Riesgo aceptado H-E1-259: un correo sin cuenta se avisa en vez de responder neutro.
  const [sinCuenta, setSinCuenta] = useState(false);
  const [pending, setPending] = useState(false);

  if (!isSupabaseConfigured()) return <ConfigurationMissing />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSinCuenta(false);
    setPending(true);

    try {
      // Si la comprobación falla («desconocido»), se envía igual: nunca bloquea la recuperación.
      if ((await correoTieneCuenta(email)) === 'no_existe') {
        setSinCuenta(true);
        return;
      }
      const problema = await enviarEnlaceDeContrasena(email);
      if (problema) {
        setError(problema);
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
              onChange={(event) => { setEmail(event.target.value); setSinCuenta(false); }}
            />
          )}
        </AuthField>

        {sinCuenta ? (
          <Notice tone="danger">
            No hay ninguna cuenta con ese correo. Revisá cómo lo escribiste o{' '}
            <AuthLink href="/signup">Creá una cuenta</AuthLink>.
          </Notice>
        ) : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}

        <SubmitButton pending={pending} pendingLabel="Enviando…">
          Enviar enlace
        </SubmitButton>
      </AuthForm>
    </AuthCard>
  );
}
