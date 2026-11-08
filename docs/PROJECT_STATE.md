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
| M06.3a — Cifrado, cliente acotado y documentación de la excepción | `G-CRYPTO` | 2026-10-02 (decisión del usuario; sin `/implementation-review` ni `/qa-review` con veredicto final sobre el HEAD cerrado — detalle en la sesión) | [sesiones/M06.3a.md](FASES/FASE1/meta_first/sesiones/M06.3a.md) |
| M28.2a — Entorno del piloto | `G-ENTORNO` | 2026-10-11 (pasos manuales acreditados por declaración del usuario, sin capturas; detalle en la sesión) | [sesiones/M28.2a.md](FASES/FASE1/meta_first/sesiones/M28.2a.md) |
| M16.1 — OAuth con Meta | `G-OAUTH` | 2026-10-14 (PR #23; despliegue y comprobaciones en producción acreditados por declaración del usuario, sin capturas; sin `/implementation-review` sobre las correcciones posteriores a la revisión; detalle en la sesión) | [sesiones/M16.1.md](FASES/FASE1/meta_first/sesiones/M16.1.md) |
| M03a — Acta de datos reales de Meta y del chat | `G-ACTA-META` | 2026-10-18 (versión vigente aprobada explícitamente por el usuario; ampliación de M16c aprobada el 2026-11-08; blob Git `33d8cec71fa117e35a0cb9e180dcb4f0a4728180`) | [sesiones/M03a.md](FASES/FASE1/meta_first/sesiones/M03a.md) |
| M16.2 — Selección de cuenta, ciclo de vida, alta del dueño y VR-01 | `G-VR01` | 2026-11-05 (pasos con el dueño acreditados por declaración del usuario; la confirmación final sin logs; cuenta sin actividad, con la validación de campos y Q-04 diferidas a `M16c`; detalle en la sesión) | [sesiones/M16.2.md](FASES/FASE1/meta_first/sesiones/M16.2.md) |

## Siguiente habilitada

**M16c — VERIFICADO — PENDIENTE DE APROBACIÓN (2026-11-08): sincronización real completa en los cuatro niveles, con 0 filas (D-M16c-02), sobre `8e9e33f`. Faltan el commit del seguimiento, `/implementation-review M16c`, `/qa-review M16c` y la decisión del usuario sobre `G-SYNC`.** Spec y plan únicos aprobados, con hashes coincidentes con las últimas auditorías APROBABLE. Dependencia `G-VR01` aprobada (2026-11-05). Rama `mf/M16c`. Controles de base en verde; bloqueo de conectividad resuelto. Evidencia: [sesiones/M16c.md](FASES/FASE1/meta_first/sesiones/M16c.md). La conexión del dueño
quedó activa; la cuenta no tiene actividad reciente, así que la validación de los campos de
Insights y la fijación de Q-04 se hacen en `M16c` (ver [HALLAZGOS.md](HALLAZGOS.md)).

La enmienda documental de alcance y del acta fue autorizada por el usuario el 2026-11-06 e integrada (`H-E1-187`). Las etapas .1, .2 y .3 de M16c están pendientes de implementación; su único gate es `G-SYNC` ([enmienda de corrida única](FASES/FASE1/meta_first/sesiones/enmienda-corrida-unica-2026-11-07.md), 2026-11-07). La comunicación al dueño fue declarada por el usuario el 2026-11-08. `G-SYNC` sigue pendiente. Evidencia: [enmienda](FASES/FASE1/meta_first/sesiones/enmienda-insights-2026-11-06.md). El 2026-11-07 el usuario aprobó que, con la cuenta sin actividad, `G-SYNC` pueda cerrarse con la sincronización real de los cuatro niveles con 0 filas ([enmienda G-SYNC](FASES/FASE1/meta_first/sesiones/enmienda-gsync-2026-11-07.md)).

Hallazgos asignados a M06.3a (cerrada): `H-M04.1-02`, `H-E1-09`, `H-E1-10`, `H-E1-17`, `H-E1-37`,
`H-E1-43` a `H-E1-70` y la comprobación de acceso real del rol de `H-E1-36`. Detalle en
[HALLAZGOS.md](HALLAZGOS.md).

Secuencia pendiente: M16c (etapas .1 → .2 → .3, una corrida) → M25a.1 → M25a.2 → M28.3a. Cada microfase se solicita y aprueba por separado.

## Fuera de la ruta o pospuesto

- **M16d — App Review y Business Verification:** depende de trámites del usuario ante Meta.
  Hasta su cierre, solo pueden conectarse cuentas de personas con rol en la app (`H-E1-01`).
  Pausada por decisión del usuario (2026-10-20): Business Verification exige una entidad
  legal y PRAXA es por ahora un proyecto; no bloquea el piloto. También espera a
  `H-E1-176`.
- M03 completa, el resto de M05.1, M05.2 y las fuentes Tiendanube y GA4: pospuestas.
- **MF_FRONTEND — Frontend público (landing y pantallas de acceso):** cerrada el 2026-10-09 por
  decisión del usuario, sin gate de la ruta, e integrada en `mf/M28.2a`. Desde esa integración
  el proxy se ejecuta (`src/proxy.ts`). Evidencia en
  [MF_FRONTEND/ficha.md](FASES/FASE1/MF_FRONTEND/ficha.md).
- **MF_APP — App web (pantallas de `/app`):** cerrada el 2026-10-11 por decisión del usuario,
  sin gate de la ruta ni `/implementation-review` aprobada, e integrada en `mf/M28.2a`. Evidencia
  en [MF_APP/ficha.md](FASES/FASE1/MF_APP/ficha.md).

## Decisiones pendientes del usuario

La ampliación y su actualización documental fueron autorizadas el 2026-11-06 (`H-E1-187`). La spec y el plan únicos de M16c figuran aprobados; `G-SYNC` continúa pendiente. Las specs, planes y gates de las sucesoras siguen pendientes; no se aprueban por esa autorización. El 2026-11-05 el usuario aprobó la
enmienda de `avatars` del PR #20 y ratificó los cambios de Resend en `SECURITY.md` (`H-E1-179`).

Las decisiones sobre `H-E1-04`, `H-E1-40`, `H-E1-76`, `H-E1-78`, `H-E1-81` y `H-E1-82` se
tomaron el 2026-10-20; el detalle está en [HALLAZGOS.md](HALLAZGOS.md).

Antes de expandir la spec de `M25a.1`, el usuario decide qué cuentas adicionales y qué gráficos tendrá el chat (`H-E1-190`). No bloquea M16c.

## Regla de actualización

Este archivo cambia solo cuando cambia el estado o el gate de una microfase, la siguiente
habilitada o un bloqueo operativo. Los comandos, conteos de pruebas y resultados viven en la
evidencia de cada microfase; los hallazgos, en [HALLAZGOS.md](HALLAZGOS.md).
