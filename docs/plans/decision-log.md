# Registro de decisiones de trabajo

Este archivo registra decisiones pequeñas que no justifican un ADR. No reemplaza la especificación ni autoriza cambios arquitectónicos.

| Fecha | Decisión | Motivo | Responsable | Revisitación |
|---|---|---|---|---|
| 2026-08-05 | Praxa es el nombre actual; AGECI queda como nombre histórico | Evitar identidades paralelas | Equipo | Solo ante cambio de marca explícito |
| 2026-08-05 | Company Brain v0 es el alcance académico actual | Evitar construir la plataforma completa | Equipo | Al completar definición de terminado v0 |
| 2026-08-05 | La validación comercial sigue separada del backlog técnico | No transformar hipótesis en features | Equipo | Después de cada lote de entrevistas |
| 2026-08-10 | Company Brain v0 se corrige a un corte vertical de inventario con un agente controlado y una skill versionada | Un reconciliador sin agente no demuestra la hipótesis del producto; una plataforma horizontal no entra en el tiempo disponible | Humano, sobre propuesta de R0 | Al completar VS-07 o si un segundo caso exige generalización |
| 2026-08-10 | `docs/product/project-brief.md` es la única fuente activa de hipótesis de producto | El Lean Canvas fue eliminado en `c11fc81` y varias fuentes activas seguían citándolo; no se restaura sin una decisión que explique por qué se eliminó | Humano, sobre propuesta de R0 | Si se decide reintroducir un documento de hipótesis comerciales |
| 2026-08-13 | El repositorio elimina el tracking de esfuerzo y tiempo de los tickets, PR y planes | GitHub aporta evidencia de cambios y CI, pero no una medición fiable del trabajo realizado; ese tracking no agrega valor a los gates técnicos | Humano | Sólo ante una necesidad operativa concreta y un método de medición acordado |
