# Estado actual del proyecto

Este es el primer documento que debe leer un agente. La fuente normativa vigente es la Parte I de [FASES/FASE1/meta_first/plan.md](FASES/FASE1/meta_first/plan.md) (Enmienda 1, ruta crítica `meta_first`), junto con el contrato de ejecución de [AGENTS.md](../AGENTS.md). `ROADMAP.md` v2.3 está archivado fuera del repositorio por decisión del usuario. Este archivo resume solo el estado de los gates y enlaza al documento que contiene cada detalle.

## Estado

El orden de ejecución vigente es el de la ruta `meta_first` (plan v1.0, 2026-09-24). El 2026-09-22 el usuario aprobó una versión anterior de la Enmienda 1. La versión 1.0 (plan y spec) quedó aprobada por el usuario el 2026-09-24, en `G-DOCS`.

- M04.1, auditoría del repositorio: cerrada; `G-AUDIT` aprobado.
- M04.2, baseline reproducible: cerrada; `G-BASELINE` aprobado.
- M04a, higiene documental previa: cerrada; `G-DOCS` aprobado por el usuario el 2026-09-24. Trabajo en la rama `mf/M04a`. Sigue pendiente del usuario decidir la visibilidad del repositorio y la reescritura del historial (`H-E1-04`). Evidencia: [sesiones/M04a.md](FASES/FASE1/meta_first/sesiones/M04a.md).
- M05.1.1, K01 `TenantContext`: cerrada; `G-K01` aprobado por el usuario el 2026-09-25. Trabajo en la rama `mf/M05.1.1`. Evidencia: [sesiones/M05.1.1.md](FASES/FASE1/meta_first/sesiones/M05.1.1.md).
- M05.1.2 a M05.1.4, K02 a K04: `VERIFICADO — PENDIENTE DE APROBACIÓN` (`G-K02-K04`) en la rama `mf/M05.1.2-M05.1.4`. Pendiente del usuario: aprobar el gate y ratificar el vencimiento máximo de 10 minutos del intento OAuth (`H-E1-19`). Evidencia: [sesiones/M05.1.2-M05.1.4.md](FASES/FASE1/meta_first/sesiones/M05.1.2-M05.1.4.md).
- M06.1a, M06.2a, M06.3a, M28.2a, M16.1, M16.2, M16c, M25a.1, M25a.2 y M28.3a: pendientes en ese orden, según la Parte I del plan.
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
