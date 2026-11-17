# Auditoría del plan de M16f — ronda 4

- **Fecha:** 2026-11-15
- **Commit:** `9af2139` (rama `docs/cierre-m16e`, con cambios sin commit preexistentes; no se tocaron)
- **Hash de contenido de la spec** (sin la línea `**Estado:**`): `219be9dbd53295bc1e0d16d5e0fe6c6b50f7d137`
- **Hash de contenido del plan** (sin la línea `**Estado:**`): `73fee8d649f124cfa7a3bcea0fe747fcda948b30`

## Precondiciones (con excepción del usuario)

La última auditoría de la spec (`spec-audit-6`) es REQUIERE CAMBIOS, y su hash no coincide con el actual (`219be9d…`). **El usuario lo exceptuó de forma expresa el 2026-11-15:** «no importa es una excepcion, audita M16f plan» (ver `plan-audit-2.md` y `plan-audit-3.md`, «Precondiciones (con excepción del usuario)»). Esta ronda audita el plan contra la spec actual, aprobada por el usuario. El riesgo aceptado sigue siendo el mismo: las correcciones de la spec posteriores a `spec-audit-6` no tienen auditoría propia. El plan registra la excepción (`plan.md:13`). El auditor no edita la spec.

Las otras dos precondiciones se cumplen: la spec está `APROBADA` (`spec.md:3`) y el plan existe en `BORRADOR` (`plan.md:3`). A-04 de `spec-audit-6` (`verify` sin exit 0 en la base) sigue abierto como condición previa al código (paso 0a, `plan.md:44`, `:50`; «Riesgos», `:98`), así que no afecta esta auditoría.

## Hallazgos de la ronda 3

| ID | Estado | Evidencia |
|---|---|---|
| P-01 (llamadas fuera de «Archivos» en el paso 0a) | Resuelto | Paso 0a (`plan.md:50`): la detención queda limitada a `publish_diagnostic`, la única firma que cambia. Sus llamadas actuales (`src/modules/diagnostics/repository.ts`, `src/modules/integrations/db/worker-api.ts`, pgTAP `09` y `17`, `tests/unit/diagnostics-orchestrator.test.ts` y `tests/unit/diagnostics-tiendanube.test.ts`) están todas dentro de la tabla (`:32`, `:33`, `:36`, `:37`). Las llamadas a `create_pending_connection`, `replace_credential` y `purge_connection` en pgTAP `13`, `14`, `16`, `18` y `scripts/chat-seed-test.mjs` se registran sin tocarse, y su regresión en verde se confirma en el paso 5 (`:58`) |
| P-02 (commit y push del cierre) | Resuelto | Paso 14 (`:67`) y tabla de intervenciones (`:87`): el usuario hace el commit y el push de los documentos del cierre, con el hash en la sesión, además de aprobar `G-GA4-FUSION` (`spec.md:370`) |
| P-03 (aprobación del dueño de las definiciones) | Resuelto | Paso 13 (`:66`): el dueño aprueba las definiciones fijas y el significado de sus eventos, redactado en la sesión antes de validar lo ecommerce y las comparaciones (`spec.md:170`; ficha, «definición de cada métrica acordada») |
| P-04 (dependencia nueva) | Resuelto | `:23`, `:38` y `:102` dicen lo mismo: la dependencia se registra en la sesión con su motivo antes de instalarla, sin detener la microfase (`spec.md:293`) |

## Veredicto

**APROBABLE.**

## Checklist

| # | Ítem | Resultado | Evidencia o justificación |
|---|---|---|---|
| 1 | Spec base | PASS | `plan.md:7` cita `219be9dbd53295bc1e0d16d5e0fe6c6b50f7d137`, igual al hash actual |
| 2 | Cobertura | PASS | C-01 a C-14 (pasos 1 a 14), T-01 a T-12 (T-10 en el 13, T-11 en el 11, T-12 en el 10, opcional) y CB-01 a CB-06 (0a, 11, 12, 14; CB-06 en `:73`) aparecen en algún paso. Heredados: CA-05 (2), CA-11c y DEC-09 (4), CA-37b, CA-37c, CA-38 y DEC-17 (6), CA-38c (8), CA-62, CA-70, §12 y §16 (10), §17.7 (0c, 0d, 13), ficha y condición para avanzar (14). §17.1 a §17.5 entran por C-07 a C-09, que los trazan, y §17.6 por «Migraciones» (`:94`). Las intervenciones de la spec (`spec.md:362-372`) tienen su paso: aprobación (0d), alta en Google Cloud (1), `db:push:test` (3, 5, 11), `0025` y publicación (12), acta y medición con el dueño (13), cierre (14) y fin del piloto remitido a M28.3a (`:90`) |
| 3 | TDD | PASS | Los pasos 1, 2, 4 y 6 a 10 escriben la prueba primero y observan el rojo (`:46`, `:54`, `:55`, `:57`, `:63`). Los pasos 0a a 0d, 3, 5 y 11 a 14 no escriben código |
| 4 | Archivos | PASS | La tabla (`:25-38`) queda dentro de II.14c (incluidas las ampliaciones D-M16f-06 y D-M16f-10), de los documentos de II.14b y de los archivos de seguimiento y del pipeline (Precondiciones 8 y 9). El pgTAP `20` es el siguiente (último `19_recovery_account`). No hay tipos generados de la base fuera de la tabla, y `getIntegraciones()` puede leer el estado de GA4 desde `app-data/index.ts` sin tocar `mock.ts` |
| 5 | Pasos | PASS | El orden respeta las dependencias: aprobaciones y A-04 (0a–0d) antes del código; `0026` aplicada (3) antes de `0027` (4–5); `0028` (10–11) antes de la publicación (12); acta comunicada y definiciones aprobadas (13) antes del recorrido real y del gate (14). Cada paso tiene su verificación, y la del 0a ahora se puede cumplir (P-01) |
| 6 | Migraciones | PASS | `0026_ga4_enum.sql`, `0027_ga4.sql` y `0028_ga4_diag.sql` siguen a `0025_recovery_account_check.sql`. No se modifica ninguna existente, y una corrección va en una migración nueva (`:94`) |
| 7 | Comandos | PASS | `verify`, `db:check:test`, `db:push:test`, `db:push`, `test:policies`, `test:app` y `test:eval` existen en `package.json`. `git switch -c`, `git diff --check`, `git hash-object` y `node --env-file=.env.local scripts/ga4-preflight.mjs` (script previsto en la spec y corrido por el usuario) son válidos. Están las suites de III.3 para M16f (`db:check:test`, `test:policies`, `test:app`; `checkCompatibility` y preflight en 7 y 13; lectura y comparación reales en 13), y CB-06 (`:73`) |
| 8 | Acciones reservadas | PASS | `db:push:test` (3, 5, 11), los commits de etapa (6, 8, 9, 11), el push, el `db:push` en `app` y el despliegue (12), y el commit y push del cierre (14) son del usuario y tienen su verificación (`:83-87`). El asistente registra el historial de `app` sin consultarlo (`:65`) |
| 9 | Reglas | PASS | Sin secretos ni datos reales (`:71`, `:90`); tenant y credenciales por K01–K04 y `worker_api` (paso 4), contrato de la spec que el plan no altera; ninguna suite ni fixture contra `app` (`:65`, `:71`) |
| 10 | Trampas | PASS | `default 'meta'` (4), selección con confirmación y `prompt=consent` (6, T-02, T-03), revocación solo local (6, «Qué no se hace»), modo Testing, gasto cero y cuenta sin demo (riesgos), filas omitidas e incompatibles (7, 8), zona (T-06 en el 8), moneda, `itemId` y `utm_id` (9), Next y migraciones (`:46`, `:94`), H-12 (3), H-E1-254 (0a), componente nuevo del chat fuera de alcance (`:102`) |
| 11 | Git | PASS | Rama `mf/M16f` creada en el paso 0a preservando los cambios sin commit; sin push, reset, rebase, clean ni commits del asistente (`:11`) |
| 12 | Fidelidad | PASS | El plan no agrega funcionalidad («Qué no se hace», `:106`) ni omite lo que pide la spec: la aprobación del dueño de las definiciones (P-03) y la regla de dependencias (P-04) quedan alineadas con `spec.md:170` y `:293` |

## Hallazgos

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| — | — | — | Sin hallazgos en esta ronda | — | — |

## Observación de tamaño (no afecta el veredicto)

Igual que en las rondas 2 y 3: la ficha exceptúa a M16f del límite de ocho horas y el usuario lo retiró de `AGENTS.md` (H-E1-261). Los cuatro controles de etapa (pasos 6, 8, 9 y 11), la publicación y el recorrido real son un corte grande. Conviene mantener un commit y una sesión por control, como en M16e, y no empezar la etapa `.3b` sin el commit de `.3a`.

## Siguiente paso

El usuario aprueba el plan («Apruebo el plan de M16f: pasá el estado a APROBADO»). Después elige modelo y esfuerzo, abre una sesión nueva y corre `/microfase M16f`. El código sigue bloqueado hasta cumplir el paso 0a (A-04 con `verify` en exit 0) y el 0d (plan y acta ampliada aprobados).
