# Estado actual del proyecto

Solo estado: qué está cerrado, qué sigue y qué lo bloquea. La arquitectura, la seguridad, los
criterios y el detalle de los hallazgos viven en sus propias fuentes (ver "Contrato
documental" en [AGENTS.md](../AGENTS.md) y el orden de lectura en [README.md](README.md)).

Ruta vigente: `meta_first`, plan y spec v1.0 aprobados en `G-DOCS` (2026-09-24). Roadmap
vigente: Parte I de [FASES/FASE1/meta_first/plan.md](FASES/FASE1/meta_first/plan.md).

## Cerradas

| Microfase | Gate | Aprobado | Evidencia |
|---|---|---|---|
| M04.1 — Auditoría del repositorio | `G-AUDIT` | Sí | [m04-1-auditoria.md](FASES/FASE1/MF04/m04-1-auditoria.md) |
| M04.2 — Baseline reproducible | `G-BASELINE` | Sí | [m04-2-baseline.md](FASES/FASE1/MF04/m04-2-baseline.md) |
| M04a — Higiene documental | `G-DOCS` | 2026-09-24 | [sesiones/M04a.md](FASES/FASE1/meta_first/sesiones/M04a.md) |
| M05.1.1 — K01 `TenantContext` | `G-K01` | 2026-09-25 | [sesiones/M05.1.1.md](FASES/FASE1/meta_first/sesiones/M05.1.1.md) |
| M05.1.2 a M05.1.4 — K02 a K04 | `G-K02-K04` | 2026-09-26 | [sesiones/M05.1.2-M05.1.4.md](FASES/FASE1/meta_first/sesiones/M05.1.2-M05.1.4.md) |
| M06.1a y M06.2a — Migración `0012`, aislamiento y privilegios | `G-DB-META` | 2026-09-28 (PR #12) | [sesiones/M06.1a-M06.2a.md](FASES/FASE1/meta_first/sesiones/M06.1a-M06.2a.md) |
| M06.3a — Cifrado, cliente acotado y documentación de la excepción | `G-CRYPTO` | 2026-10-02 (decisión explícita del usuario; la última `/implementation-review` formal (`implementation-review-13.md`) seguía en REQUIERE CAMBIOS por `R-13-01`, analizado en la sesión como falso positivo — `H-E1-49` a `H-E1-51` ya cubrían el alcance ampliado — pero nunca se corrió una revisión de implementación ni un QA posteriores con veredicto APROBABLE/LISTO PARA PR formal) | [sesiones/M06.3a.md](FASES/FASE1/meta_first/sesiones/M06.3a.md) |

## En curso

**M28.2a — Entorno del piloto.** Habilitada por `G-CRYPTO`. Sin empezar.

Hallazgos asignados a M06.3a (cerrada): `H-M04.1-02`, `H-E1-09`, `H-E1-10`, `H-E1-17`, `H-E1-37`,
`H-E1-43` a `H-E1-51` y la comprobación de acceso real del rol de `H-E1-36`. Detalle en
[HALLAZGOS.md](HALLAZGOS.md).

Después de M28.2a, en este orden: M16.1, M16.2, M16c, M25a.1, M25a.2 y M28.3a.

## En paralelo

- **M03a — Acta de datos reales de Meta y del chat:** sin empezar. Su gate `G-ACTA-META`
  bloquea el primer dato real, en M16.2.

## Fuera de la ruta o pospuesto

- **M16d — App Review y Business Verification:** depende de trámites del usuario ante Meta.
  Hasta su cierre, solo pueden conectarse cuentas de personas con rol en la app (`H-E1-01`).
- M03 completa, el resto de M05.1, M05.2 y las fuentes Tiendanube y GA4: pospuestas.

## Decisiones pendientes del usuario

- Visibilidad del repositorio y reescritura del historial (`H-E1-04`).
- Referencias por número de línea a `SECURITY.md` en la ficha de M03a, el plan y la spec
  (`H-E1-40`).

## Regla de actualización

Este archivo cambia solo cuando cambia el estado o el gate de una microfase, la siguiente
habilitada o un bloqueo operativo. Los comandos, conteos de pruebas y resultados viven en la
evidencia de cada microfase; los hallazgos, en [HALLAZGOS.md](HALLAZGOS.md).
