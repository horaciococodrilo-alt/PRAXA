import { Card } from '@/components/ui';

/**
 * Se muestra cuando faltan las variables públicas de Supabase.
 * Nombra exactamente qué falta en lugar de romper con un error opaco.
 */
export function ConfigurationMissing() {
  return (
    <Card>
      <h1 className="text-xl font-semibold tracking-tight">Falta configurar Supabase</h1>
      <p className="mt-3 text-sm text-muted">
        Copiá <code className="font-mono">.env.example</code> a{' '}
        <code className="font-mono">.env.local</code> y completá{' '}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> y{' '}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>. Las instrucciones
        completas están en el README.
      </p>
    </Card>
  );
}
