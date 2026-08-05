# Praxa — kit de arranque para Codex y Claude Code

Este paquete convierte la investigación y arquitectura de Praxa en un repositorio que un agente de código puede comprender sin depender del historial de un chat.

## Qué resuelve

- Separa la visión completa de Praxa del alcance actual.
- Declara una única especificación técnica como fuente de verdad.
- Conserva el contexto comercial como hipótesis, no como requisito confirmado.
- Define reglas de seguridad, arquitectura, testing y Git.
- Incluye prompts para preparación, implementación, revisión y handoff.
- Evita que Codex o Claude construyan agentes autónomos, conectores productivos o una plataforma completa antes de tiempo.

## Cómo usarlo

1. Crear un repositorio privado llamado `praxa`.
2. Extraer **el contenido** de este paquete en la raíz del repositorio. `AGENTS.md` debe quedar en la raíz, no dentro de otra carpeta.
3. Revisar `docs/product/project-brief.md` y reemplazar únicamente datos que hayan cambiado de verdad.
4. Confirmar que `docs/architecture/company-brain-spec.md` existe y está completo.
5. Abrir una terminal en la raíz y ejecutar Codex.
6. Pegar el contenido de `BOOTSTRAP_CODEX_PROMPT.md`.
7. No autorizar implementación hasta revisar el informe de preparación.
8. Autorizar después solamente `CB-001`.

## Orden de lectura humano

1. `docs/product/project-brief.md`
2. `docs/product/lean-canvas-v6.1.md`
3. `docs/product/future-vision.md`
4. `docs/architecture/company-brain-spec.md`
5. `docs/plans/company-brain-build-plan.md`
6. `docs/plans/current.md`
7. `AGENTS.md`

## Orden de autoridad

1. Seguridad e invariantes de `AGENTS.md` y la especificación.
2. `docs/architecture/company-brain-spec.md`.
3. ADR aprobados y reflejados en la especificación.
4. `docs/plans/current.md`.
5. Plan de construcción.
6. Brief y Lean Canvas, que contienen hipótesis de producto.
7. Visión futura y archivo histórico, que no autorizan implementación.

## Estado inicial correcto

El repositorio empieza con documentación y configuración. El primer cambio de código es `CB-001`: monorepo, backend/frontend mínimos, tooling y CI. No se empieza por el LLM, embeddings, conectores reales ni agentes.

## Uso con Claude Code

Claude Code leerá `CLAUDE.md`, que importa las reglas comunes de `AGENTS.md`. En la primera sesión se debe ejecutar `/context` y verificar que ambos fueron cargados.

## Lo que no debe copiarse a la raíz

- Cuadernos históricos completos.
- Lean Canvas anteriores.
- Documentos Word usados como investigación.
- Credenciales o `.env` reales.
- Datos reales de una empresa.
- Tokens de Mercado Libre, Tiendanube, modelos o servicios cloud.

Los materiales históricos pueden conservarse fuera del repositorio o bajo `docs/research/archive/`, siempre marcados como no normativos.
