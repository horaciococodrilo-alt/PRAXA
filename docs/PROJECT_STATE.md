# Estado actual del proyecto

Este es el primer documento que debe leer un agente. La fuente normativa vigente es la Parte I de [FASES/FASE1/meta_first/plan.md](FASES/FASE1/meta_first/plan.md) (Enmienda 1, ruta crítica `meta_first`), junto con el contrato de ejecución de [AGENTS.md](../AGENTS.md). `ROADMAP.md` v2.3 está archivado fuera del repositorio por decisión del usuario. Este archivo resume solo el estado de los gates y enlaza al documento que contiene cada detalle.

## Estado

El orden de ejecución vigente es el de la ruta `meta_first` (plan v1.0, 2026-09-24). El 2026-09-22 el usuario aprobó una versión anterior de la Enmienda 1. La versión 1.0 (plan y spec) quedó aprobada por el usuario el 2026-09-24, en `G-DOCS`.

- M04.1, auditoría del repositorio: cerrada; `G-AUDIT` aprobado.
- M04.2, baseline reproducible: cerrada; `G-BASELINE` aprobado.
- M04a, higiene documental previa: cerrada; `G-DOCS` aprobado por el usuario el 2026-09-24. Trabajo en la rama `mf/M04a`. Sigue pendiente del usuario decidir la visibilidad del repositorio y la reescritura del historial (`H-E1-04`). Evidencia: [sesiones/M04a.md](FASES/FASE1/meta_first/sesiones/M04a.md).
- M05.1.1, K01 `TenantContext`: cerrada; `G-K01` aprobado por el usuario el 2026-09-25. Trabajo en la rama `mf/M05.1.1`. Evidencia: [sesiones/M05.1.1.md](FASES/FASE1/meta_first/sesiones/M05.1.1.md).
- M05.1.2 a M05.1.4, K02 a K04: cerradas; `G-K02-K04` aprobado por el usuario el 2026-09-26. El usuario ratificó el vencimiento máximo de 10 minutos del intento OAuth (`H-E1-19`). Trabajo en la rama `mf/M05.1.2-M05.1.4`. Evidencia: [sesiones/M05.1.2-M05.1.4.md](FASES/FASE1/meta_first/sesiones/M05.1.2-M05.1.4.md).
- M06.1a y M06.2a, grupo `M06.1a-M06.2a`: `VERIFICADO — PENDIENTE DE APROBACIÓN` en la rama `mf/M06.1a-M06.2a` (PR #12), con gate `G-DB-META` sin aprobar. La quinta corrección (`H-E1-33` y `H-E1-34`, decisiones `D-M06.1a-M06.2a-26` y `-27`) quedó aplicada por el usuario en `praxa-test` recreado: hashes inválidos dan `22023` y el rol preexistente con propiedad, ACL, configuración o ACL predeterminada se rechaza antes de cualquier grant. `db:check:test` pasó; `test:policies` pasó 457/457 (incluidas dos ejecuciones de T-05), `test:app` pasó 29/29 exigidas y `verify` pasó 145/145 y build. `H-E1-35` (cobertura del grant sintético) y `H-E1-36` (restricciones de conexión de un rol reutilizado) quedan diferidos a M16c según la decisión del usuario sobre hallazgos nuevos no altos; el acceso real con el rol se comprobará en M06.3a. Faltan el commit con árbol limpio, las revisiones del pipeline sobre ese commit y la aprobación visible de `G-DB-META`. `H-E1-28` sigue diferido a M16.2, `H-E1-29` resuelto y `H-E1-07` descartado. Evidencia: [sesiones/M06.1a-M06.2a.md](FASES/FASE1/meta_first/sesiones/M06.1a-M06.2a.md).
- M06.3a, M28.2a, M16.1, M16.2, M16c, M25a.1, M25a.2 y M28.3a: pendientes en ese orden, después de `G-DB-META`.
- M03a, acta de datos reales de Meta y del chat: sin empezar; se puede redactar en paralelo. Su gate `G-ACTA-META` bloquea el primer dato real, en M16.2.
- M16d, App Review y Business Verification: fuera de la ruta y dependiente de trámites del usuario ante Meta. Hasta su cierre, sólo pueden conectarse cuentas de personas con rol en la app; ver `H-E1-01`.
- M03 completa, M05.1 restante, M05.2 y las fuentes Tiendanube y GA4: pospuestas sin cambio de contenido.

## Lectura dirigida

1. [FASES/FASE1/meta_first/plan.md](FASES/FASE1/meta_first/plan.md): roadmap vigente (Parte I), plan de ejecución (Parte II) y transversales (Parte III).
2. [FASES/FASE1/meta_first/spec.md](FASES/FASE1/meta_first/spec.md): spec de la ruta, con los CA, CB y DEC.
3. [HALLAZGOS.md](HALLAZGOS.md): registro único de hallazgos, estados y microfases asignadas.
4. [FASES/FASE1/MF04/m04-1-auditoria.md](FASES/FASE1/MF04/m04-1-auditoria.md): evidencia de la auditoría M04.1.
5. [FASES/FASE1/MF04/m04-2-baseline.md](FASES/FASE1/MF04/m04-2-baseline.md): evidencia del baseline M04.2.
6. [FASES/FASE1/MF04/m04-sesion.md](FASES/FASE1/MF04/m04-sesion.md): relato cronológico de la sesión M04.
7. [ARCHITECTURE.md](ARCHITECTURE.md) y [SECURITY.md](SECURITY.md): documentos de arquitectura y seguridad existentes.

## Regla de actualización

Los detalles, comandos y resultados reales viven en la evidencia de cada microfase. Los hallazgos viven únicamente en [HALLAZGOS.md](HALLAZGOS.md). Este archivo solo cambia cuando cambia el estado general o el orden de lectura.
