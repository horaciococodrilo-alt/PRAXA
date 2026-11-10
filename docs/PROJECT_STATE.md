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
| M03a — Acta de datos reales de Meta y del chat | `G-ACTA-META` | 2026-10-18 (versión vigente aprobada explícitamente por el usuario; ampliación de M16c aprobada el 2026-11-08 y desgloses aprobados el 2026-11-08; blob Git `c8140a161ddf97ae20d48efa9818446a6a92fe3d`) | [sesiones/M03a.md](FASES/FASE1/meta_first/sesiones/M03a.md) |
| M16.2 — Selección de cuenta, ciclo de vida, alta del dueño y VR-01 | `G-VR01` | 2026-11-05 (pasos con el dueño acreditados por declaración del usuario; la confirmación final sin logs; cuenta sin actividad, con la validación de campos y Q-04 diferidas a `M16c`; detalle en la sesión) | [sesiones/M16.2.md](FASES/FASE1/meta_first/sesiones/M16.2.md) |
| M16c — Sincronización manual ampliada de Meta Ads | `G-SYNC` | 2026-11-08 (aprobación explícita del usuario; cuatro niveles completos sobre la versión corregida; cuenta sin actividad, D-M16c-02) | [sesiones/M16c.md](FASES/FASE1/meta_first/sesiones/M16c.md) |

## Siguiente habilitada

**M25a — EN CURSO, etapa .3; paso 16 cumplido, paso 17 habilitado y no iniciado** en `mf/M25a`, por `G-SYNC` aprobado (2026-11-08). La etapa .1 quedó cerrada por el commit del usuario `a1102fc10a49e7e7dfff5f04f18b1aa0b1ccf412`; la .2, por el commit del usuario `6f60dcac5f2317e819495e45dc1d44ba2bbaa7d4` tras el control técnico y VR-02 base aprobados. El usuario aprobó la ampliación del acta de datos y declaró la comunicación al dueño; evidencia en [sesiones/M25a.md](FASES/FASE1/meta_first/sesiones/M25a.md). `G-CHAT` sigue pendiente. Secuencia restante: M25a → M28.3a.

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

La ampliación y su actualización documental fueron autorizadas el 2026-11-06 (`H-E1-187`). M16c y `G-SYNC` están cerrados. Las specs, planes y gates de las sucesoras siguen pendientes; no se aprueban por esta decisión. El 2026-11-05 el usuario aprobó la
enmienda de `avatars` del PR #20 y ratificó los cambios de Resend en `SECURITY.md` (`H-E1-179`).

Las decisiones sobre `H-E1-04`, `H-E1-40`, `H-E1-76`, `H-E1-78`, `H-E1-81` y `H-E1-82` se
tomaron el 2026-10-20; el detalle está en [HALLAZGOS.md](HALLAZGOS.md).

La decisión de `H-E1-190` se tomó el 2026-11-08 y la [enmienda del chat](FASES/FASE1/meta_first/revisiones/propuesta-enmienda-chat-visual-1.md) está integrada en la ruta.

## Regla de actualización

Este archivo cambia solo cuando cambia el estado o el gate de una microfase, la siguiente
habilitada o un bloqueo operativo. Los comandos, conteos de pruebas y resultados viven en la
evidencia de cada microfase; los hallazgos, en [HALLAZGOS.md](HALLAZGOS.md).
