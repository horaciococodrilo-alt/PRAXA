# Estado actual del proyecto

Este es el primer documento que debe leer un agente. La fuente normativa del plan es [ROADMAP.md](ROADMAP.md). Este archivo resume solo el estado de los gates y enlaza al documento que contiene cada detalle.

## Estado

El 2026-09-22 el usuario aprobó la Enmienda 1 del roadmap, ruta crítica `meta_first`. El orden de ejecución vigente es el de esa enmienda, no el de las fases originales.

- M04.1, auditoría del repositorio: cerrada; `G-AUDIT` aprobado.
- M04.2, baseline reproducible: cerrada; `G-BASELINE` aprobado.
- M03a, acta mínima de datos y privacidad para Meta: siguiente corte; requiere aprobación del usuario y bloquea toda conexión Meta con datos reales.
- M05.1.2, M05.1.3 y M05.1.4, contratos K02-K04: habilitados por M03a, todavía no iniciados.
- M06.1a, M06.2a, M06.3a, M16.1, M16.2, M16c y M25a: pendientes en ese orden, según la Enmienda 1.
- M16d, habilitación multiempresa del acceso a Meta: pendiente, en paralelo y dependiente de trámites del usuario ante Meta. Hasta su cierre, sólo pueden conectarse cuentas de personas con rol en la app; ver `H-E1-01`.
- M03 completa, M05.1 restante, M05.2 y las fuentes Tiendanube y GA4: pospuestas sin cambio de contenido.

## Lectura dirigida

1. [ROADMAP.md](ROADMAP.md): plan operativo vigente y condiciones de avance. Leer primero la Enmienda 1, que fija el orden actual.
2. [HALLAZGOS.md](HALLAZGOS.md): registro único de hallazgos, estados y microfases asignadas.
3. [FASES/FASE1/MF04/m04-1-auditoria.md](FASES/FASE1/MF04/m04-1-auditoria.md): evidencia de la auditoría M04.1.
4. [FASES/FASE1/MF04/m04-2-baseline.md](FASES/FASE1/MF04/m04-2-baseline.md): evidencia del baseline M04.2.
5. [FASES/FASE1/MF04/m04-sesion.md](FASES/FASE1/MF04/m04-sesion.md): relato cronológico de la sesión M04.
6. [ARCHITECTURE.md](ARCHITECTURE.md) y [SECURITY.md](SECURITY.md): documentos de arquitectura y seguridad existentes.

## Regla de actualización

Los detalles, comandos y resultados reales viven en la evidencia de cada microfase. Los hallazgos viven únicamente en [HALLAZGOS.md](HALLAZGOS.md). Este archivo solo cambia cuando cambia el estado general o el orden de lectura.
