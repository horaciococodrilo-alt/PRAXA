import { Callout, Card, EmptyState } from '@/components/ui';
import { requireUser } from '@/modules/identity/session';
import { getActiveContext } from '@/modules/onboarding/repository';

export const metadata = { title: 'Integraciones' };

/**
 * Estado vacío honesto: no hay ningún conector implementado. La página no muestra
 * tarjetas de "conectar" que no hagan nada ni datos de ejemplo.
 */
export default async function IntegrationsPage() {
  await requireUser('/app/integraciones');
  const active = await getActiveContext();
  const declared = active?.systems ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integraciones</h1>
        <p className="mt-2 text-sm text-muted">
          Conexión por API a los sistemas de tu empresa, solo de lectura.
        </p>
      </div>

      <EmptyState
        title="Todavía no hay conectores disponibles"
        reason="Ningún conector está implementado en esta versión. Cuando el primero esté listo vas a poder autorizar el acceso desde acá, y PRAXA va a consultar información sin modificar nada en tus sistemas."
      />

      {declared.length > 0 ? (
        <Card>
          <h2 className="text-base font-semibold">Sistemas que declaraste usar</h2>
          <p className="mt-1 text-sm text-muted">
            Esto es lo que cargaste en el onboarding. Es una declaración tuya:{' '}
            <strong>no implica ninguna conexión</strong> ni acceso a datos.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {declared.map((system) => (
              <li
                key={system.id}
                className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm"
              >
                {system.label ?? system.system_key}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Callout title="Qué falta para habilitar esto">
        <p>
          Definir con qué sistema empieza el primer conector y con qué cuenta autorizada se va a
          probar. Esa decisión está pendiente y está registrada en el roadmap del repositorio.
        </p>
      </Callout>
    </div>
  );
}
