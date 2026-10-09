import { AuthShell } from '@/components/auth/parts';
import { LandingRoot } from '@/components/landing/theme';

// Las pantallas de acceso comparten la raíz de la landing: tokens, tipografías y tema.
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <LandingRoot>
      <AuthShell>{children}</AuthShell>
    </LandingRoot>
  );
}
