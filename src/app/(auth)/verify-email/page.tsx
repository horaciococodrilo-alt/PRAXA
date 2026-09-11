import Link from 'next/link';

import { Callout, Card } from '@/components/ui';

const MESSAGES: Record<string, string> = {
  'link-invalid':
    'El enlace no es válido o ya expiró. Pedí uno nuevo desde "Olvidé mi contraseña" o volvé a registrarte.',
  'link-missing-params': 'El enlace está incompleto. Abrilo directamente desde el correo.',
  'server-error': 'No pudimos completar la verificación. Intentá de nuevo en unos minutos.',
};

export default async function VerifyEmailPage({ searchParams }: PageProps<'/verify-email'>) {
  const params = await searchParams;
  const raw = typeof params.error === 'string' ? params.error : null;
  const message = raw ? (MESSAGES[raw] ?? MESSAGES['server-error']) : null;

  return (
    <Card>
      <h1 className="text-xl font-semibold tracking-tight">Verificación de correo</h1>

      {message ? (
        <div className="mt-4">
          <Callout tone="danger">{message}</Callout>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Abrí el enlace que te enviamos por correo para confirmar tu cuenta.
        </p>
      )}

      <div className="mt-6 space-y-2 text-sm text-muted">
        <p>
          <Link href="/login" className="font-medium text-accent hover:underline">
            Iniciar sesión
          </Link>
        </p>
        <p>
          <Link href="/signup" className="font-medium text-accent hover:underline">
            Crear una cuenta
          </Link>
        </p>
      </div>
    </Card>
  );
}
