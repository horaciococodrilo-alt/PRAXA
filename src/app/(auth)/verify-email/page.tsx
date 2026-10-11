import s from '@/components/auth/auth.module.css';
import { AuthCard, AuthLink, Notice } from '@/components/auth/parts';

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
    <AuthCard
      narrow
      title="Verificá tu correo"
      subtitle={message ? undefined : 'Abrí el enlace que te enviamos por correo para confirmar tu cuenta.'}
      footer={
        <div className={s.stack}>
          <AuthLink href="/login">Iniciá sesión</AuthLink>
          <AuthLink href="/signup">Creá una cuenta</AuthLink>
        </div>
      }
    >
      {message ? <Notice tone="danger">{message}</Notice> : null}
    </AuthCard>
  );
}
