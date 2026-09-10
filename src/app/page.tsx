import Link from 'next/link';

import { ButtonLink, Callout, Card } from '@/components/ui';

const FLOW = [
  {
    step: '01',
    title: 'Contás tu contexto',
    body: 'Objetivos, prioridades, horizontes, problemas actuales y restricciones. Si todavía no tenés un objetivo definido, se registra así y el análisis lo tiene en cuenta.',
  },
  {
    step: '02',
    title: 'Conectás tus sistemas',
    body: 'PRAXA consulta por API la tienda, los marketplaces, la analítica y la publicidad. Solo lectura: nunca modifica nada en tus sistemas.',
  },
  {
    step: '03',
    title: 'Se normalizan y relacionan los datos',
    body: 'Se guarda el contexto y la evidencia necesarios para el análisis, no una copia indiscriminada de todo lo que tenés.',
  },
  {
    step: '04',
    title: 'Se calculan las métricas',
    body: 'Las métricas y las relaciones verificables las calcula el software, de forma determinística y reproducible. No las estima un modelo.',
  },
  {
    step: '05',
    title: 'Recibís un diagnóstico y un plan',
    body: 'Hallazgos con la evidencia que los respalda, mejoras priorizadas y un plan por etapas con indicadores para evaluar el resultado.',
  },
];

const PRINCIPLES = [
  {
    title: 'Los números los calcula el código',
    body: 'El modelo de lenguaje interpreta evidencia ya calculada. No inventa métricas ni completa huecos con estimaciones.',
  },
  {
    title: 'Lo que falta se dice',
    body: 'Si no alcanza la información para sostener una conclusión, el reporte lo declara explícitamente en lugar de rellenar la plantilla.',
  },
  {
    title: 'Analiza, no ejecuta',
    body: 'PRAXA entrega recomendaciones. No aplica cambios sobre los sistemas conectados ni tiene permisos para hacerlo.',
  },
  {
    title: 'Cada empresa, aislada',
    body: 'Los datos de una empresa no son alcanzables desde otra. El aislamiento se aplica en la base de datos, no solo en la interfaz.',
  },
];

export default function LandingPage() {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">PRAXA</span>
          <nav className="flex items-center gap-2">
            <ButtonLink href="/login" variant="ghost">
              Ingresar
            </ButtonLink>
            <ButtonLink href="/signup">Crear cuenta</ButtonLink>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
          <p className="text-sm font-medium text-accent">Diagnóstico de operación para ecommerce</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Entendé qué está frenando tu ecommerce, con evidencia y no con corazonadas.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            PRAXA parte de tus objetivos, consulta tus sistemas por API, calcula las métricas con
            código y devuelve un diagnóstico y un plan de optimización priorizado. Cada hallazgo
            queda atado a la evidencia que lo sostiene.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/signup">Empezar</ButtonLink>
            <ButtonLink href="/login" variant="secondary">
              Ya tengo cuenta
            </ButtonLink>
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">Cómo funciona</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FLOW.map((item) => (
                <li key={item.step}>
                  <Card className="h-full">
                    <span className="font-mono text-xs text-accent">{item.step}</span>
                    <h3 className="mt-2 text-base font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted">{item.body}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">Cómo trabaja PRAXA</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {PRINCIPLES.map((item) => (
              <Card key={item.title} className="h-full">
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted">{item.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-20">
          <Callout tone="warning" title="En qué estado está el producto">
            <p>
              Hoy funcionan el registro con verificación de correo, el espacio privado de la
              empresa y el onboarding de objetivos y contexto, que podés guardar y retomar.
            </p>
            <p>
              La conexión de sistemas y la generación del diagnóstico con IA{' '}
              <strong>todavía no están implementadas</strong>. Las secciones de Integraciones y
              Reportes lo dicen abiertamente en lugar de mostrar datos de ejemplo.
            </p>
          </Callout>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-muted">
          <span>PRAXA</span>
          <Link href="/login" className="hover:text-foreground">
            Ingresar
          </Link>
        </div>
      </footer>
    </>
  );
}
