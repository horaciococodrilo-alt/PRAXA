# Trabajar con Codex y Claude Code

## Regla operativa

Un agente escribe; otro revisa. No permitir que ambos editen la misma rama al mismo tiempo.

## Flujo recomendado

1. Una persona define y aprueba el ticket.
2. El implementador lee instrucciones y presenta un plan.
3. Una persona aprueba o corrige el plan.
4. El implementador realiza el cambio y ejecuta tests.
5. El segundo agente revisa el diff en modo read-only.
6. Una persona decide qué hallazgos corregir.
7. El implementador corrige.
8. El equipo revisa y hace merge.
9. Se actualiza `docs/plans/current.md`.

## Roles iniciales sugeridos

- Codex: implementador de la fase autorizada (R0 o VS-01 a VS-07).
- Claude Code: revisor independiente.
- En el ticket siguiente pueden invertirse.

La asignación no implica superioridad de un modelo; busca independencia entre creación y revisión. En ambos roles, el agente actúa como asistente o revisor bajo autoridad humana: no aprueba su propio trabajo, no decide arquitectura, permisos, política activa ni el estado de una ADR.

## No depender del chat

Las decisiones persistentes deben quedar en spec, ADR, ticket o decision log. La conversación ayuda a pensar, pero no es la fuente de verdad del repositorio.

## Cuándo usar Plan mode

- Cambios de schema.
- Dependencias nuevas.
- Arquitectura o contratos.
- Cambios multi-módulo.
- Seguridad, RLS o permisos.
- Cualquier modificación que pueda ampliar scope.

## Cuándo crear reglas anidadas

No crear `backend/AGENTS.md`, `frontend/AGENTS.md` o reglas path-scoped hasta que existan convenciones estables que realmente difieran. Las instrucciones duplicadas y contradictorias empeoran el comportamiento.

## Qué no automatizar inicialmente

- Commits y pushes.
- Merge de PR.
- Migraciones productivas.
- Deploy.
- Acceso a cuentas de clientes.
- Instalación de plugins o MCP.
- Decisiones de arquitectura.
