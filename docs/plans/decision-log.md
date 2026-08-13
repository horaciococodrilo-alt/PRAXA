# Registro de decisiones de trabajo

Este archivo registra decisiones pequeñas que no justifican un ADR. No reemplaza la especificación ni autoriza cambios arquitectónicos.

| Fecha | Decisión | Motivo | Responsable | Revisitación |
|---|---|---|---|---|
| 2026-08-05 | Praxa es el nombre actual; AGECI queda como nombre histórico | Evitar identidades paralelas | Equipo | Solo ante cambio de marca explícito |
| 2026-08-05 | Company Brain v0 es el alcance académico actual | Evitar construir la plataforma completa | Equipo | Al completar definición de terminado v0 |
| 2026-08-05 | La validación comercial sigue separada del backlog técnico | No transformar hipótesis en features | Equipo | Después de cada lote de entrevistas |
| 2026-08-10 | Company Brain v0 se corrige a un corte vertical de inventario con un agente controlado y una skill versionada | Un reconciliador sin agente no demuestra la hipótesis del producto; una plataforma horizontal no entra en el tiempo disponible | Humano, sobre propuesta de R0 | Al completar VS-07 o si un segundo caso exige generalización |
| 2026-08-10 | `docs/product/project-brief.md` es la única fuente activa de hipótesis de producto | El Lean Canvas fue eliminado en `c11fc81` y varias fuentes activas seguían citándolo; no se restaura sin una decisión que explique por qué se eliminó | Humano, sobre propuesta de R0 | Si se decide reintroducir un documento de hipótesis comerciales |
| 2026-08-11 | La imagen de base es `pgvector/pgvector:0.8.6-pg16`, fijada por digest inmutable `sha256:a3625087…14c6b` | Reproducibilidad idéntica entre desarrollo local y CI; un tag mutable permitiría que la base cambie sin que ningún cambio del repositorio lo registre. El digest se verificó contra el registro antes de fijarlo | Humano, sobre propuesta de VS-01 | Ante una actualización de pgvector o de PostgreSQL con CI verde |
| 2026-08-11 | `pg_trgm` no se instala en VS-01 | VS-01 no crea ninguna columna de texto buscable; instalarla ahora sería una extensión sin consumidor. Se difiere a la fase que introduzca matching difuso | Humano, sobre propuesta de VS-01 | Cuando una fase requiera similitud de texto |
| 2026-08-11 | El rol de aplicación es de sólo lectura en toda la base durante VS-01 | Un `UPDATE` acotado a la propia membership permitía reactivar un `status` inactivo o rotar de rol; VS-01 no tiene ninguna escritura de aplicación que justifique ese riesgo | Humano, sobre propuesta de VS-01 | Con la primera tabla escribible por la aplicación, en VS-02 |
| 2026-08-11 | `app.role` no aparece en ninguna policy de RLS | Es una variable de sesión que cualquier sesión con la credencial de aplicación puede modificar; usarla en una policy simularía un control sin ejercerlo. La autorización por rol vive en la capa de servicio | Humano, sobre propuesta de VS-01 | Cuando exista un rol verificado a partir de un token, en VS-05 |
