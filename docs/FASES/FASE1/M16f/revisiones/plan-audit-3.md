# Auditoría del plan de M16f — ronda 3

- **Fecha:** 2026-11-15
- **Commit:** `9af2139` (rama `docs/cierre-m16e`, con cambios sin commit preexistentes; no se tocaron)
- **Hash de contenido de la spec** (sin la línea `**Estado:**`): `219be9dbd53295bc1e0d16d5e0fe6c6b50f7d137`
- **Hash de contenido del plan** (sin la línea `**Estado:**`): `e3162986e75d2d4c3ce633e8fbf408eecaac4954`

## Precondiciones (con excepción del usuario)

La última auditoría de la spec (`spec-audit-6`) es REQUIERE CAMBIOS, y su hash no coincide con el actual (`219be9d…`). **El usuario lo exceptuó de forma expresa el 2026-11-15:** «no importa es una excepcion, audita M16f plan» (ver `plan-audit-2.md`, «Precondiciones (con excepción del usuario)»). Esta ronda audita el plan contra la spec actual, aprobada por el usuario. El riesgo aceptado sigue siendo el mismo: las correcciones de la spec posteriores a `spec-audit-6` no tienen auditoría propia. El plan registra la excepción (`plan.md:13`). El auditor no edita la spec.

Las otras dos precondiciones se cumplen: la spec está `APROBADA` (`spec.md:3`) y el plan existe en `BORRADOR` (`plan.md:3`). A-04 de `spec-audit-6` (`verify` sin exit 0 en la base) sigue abierto como condición previa al código (paso 0a, `plan.md:44`, `:50`), así que no afecta esta auditoría.

## Hallazgos de la ronda 2

| ID | Estado | Evidencia |
|---|---|---|
| P-01 (rama y Git) | Resuelto | `plan.md:11` (rama `mf/M16f`, sin operaciones destructivas, commits y push del usuario); paso 0a (`:50`) |
| P-02 (redacción del acta) | Resuelto | Paso 0c (`:52`) redacta la ampliación con finalidad, datos, DeepInfra y Anthropic, retención y purga, y revocación local; el paso 0d (`:53`) la aprueba |
| P-03 (historial de `app`) | Resuelto | Paso 12 (`:65`) y tabla de intervenciones (`:85`): el usuario aporta el historial y el asistente lo registra sin consultar `app` |
| P-04 (verificaciones antes del push) | Resuelto | Pasos 4 y 10 (`:57`, `:63`): rojo y revisión estática; el verde, en los pasos 5 y 11 (`:58`, `:64`) |
| P-05 (CA-38c) | Resuelto | Paso 8 (`:61`) |
| P-06 (prueba del preflight) | Resuelto | Paso 1 (`:54`): prueba unitaria previa en `tests/unit/`, en rojo |
| P-07 (`default 'meta'`) | Resuelto | Paso 4 (`:57`): búsqueda de `default 'meta'` y `default 'ga4'` sin resultados en `0027` |
| P-08 (API vigente y lockfile) | Resuelto, con una contradicción nueva | Paso 0b (`:51`) relee las páginas y los changelogs; `:23` y `:38` autorizan `package.json` y lockfile solo con dependencia. Pero `:102` manda detenerse ante una dependencia nueva: ver P-04 de esta ronda |

## Veredicto

**REQUIERE CAMBIOS.**

## Checklist

| # | Ítem | Resultado | Evidencia o justificación |
|---|---|---|---|
| 1 | Spec base | PASS | `plan.md:7` cita `219be9dbd53295bc1e0d16d5e0fe6c6b50f7d137`, igual al hash actual |
| 2 | Cobertura | PASS | C-01 a C-14 (pasos 1 a 14), T-01 a T-12 (T-10 en el 13, T-11 en el 11, T-12 en el 10) y CB-01 a CB-06 (0a, 11, 12, 14) aparecen en algún paso. Heredados: CA-05 (2), CA-11c y DEC-09 (4), CA-37b, CA-37c, CA-38 y DEC-17 (6), CA-38c (8), CA-62, CA-70, §12 y §16 (10), §17.7 (0c, 0d, 13), ficha y condición para avanzar (14). §17.1 a §17.5 entran por C-07 a C-09, que los trazan, y §17.6 por «Migraciones» (`:94`) |
| 3 | TDD | PASS | Los pasos 1, 2, 4 y 6 a 10 escriben la prueba primero y observan el rojo (`:46`, `:54`, `:57`). Los pasos 0a a 0d, 3, 5 y 11 a 14 no escriben código |
| 4 | Archivos | PASS | La tabla (`:25-38`) queda dentro de II.14c (incluidas las ampliaciones D-M16f-06 y D-M16f-10), de los documentos de II.14b y de los archivos de seguimiento y del pipeline (Precondiciones 8 y 9). El pgTAP `20` es el siguiente (último `19`) |
| 5 | Pasos | FAIL | El orden respeta las dependencias, y cada paso tiene su verificación. Pero la verificación del paso 0a no se puede cumplir: exige que **todas** las llamadas existentes a `create_pending_connection`, `replace_credential`, `purge_connection` y `publish_diagnostic` estén dentro de «Archivos», y que la microfase se detenga si una queda afuera. Hoy hay llamadas en `supabase/tests/13_meta_insights.test.sql:75`, `14_meta_breakdowns.test.sql:51`, `16_chat_entity_level.test.sql:12`, `18_tiendanube.test.sql:67` y `scripts/chat-seed-test.mjs:169`, que no figuran en la tabla ni en II.14c. Ver P-01 |
| 6 | Migraciones | PASS | `0026_ga4_enum.sql`, `0027_ga4.sql` y `0028_ga4_diag.sql` siguen a `0025`. No se modifica ninguna existente, y una corrección va en una migración nueva (`:94`) |
| 7 | Comandos | PASS | `verify`, `db:check:test`, `db:push:test`, `db:push`, `test:policies`, `test:app` y `test:eval` existen en `package.json`. `git switch -c`, `git diff --check`, `git hash-object` y `node --env-file=… scripts/ga4-preflight.mjs` (script previsto en la spec; Node 24) son válidos. Están las suites de III.3 para M16f, `checkCompatibility` y el preflight (7, 13), la lectura y comparación reales (13), y CB-06 (`:73`) |
| 8 | Acciones reservadas | FAIL | `db:push:test` (3, 5, 11), los commits de etapa (6, 8, 9, 11), el push, el `db:push` en `app` y el despliegue (12) son del usuario y tienen verificación. Falta el commit y el push del cierre: el paso 14 modifica `SECURITY.md`, `ARCHITECTURE.md`, `PROJECT_STATE.md`, `HALLAZGOS.md` y la sesión después de la publicación del paso 12, y la spec pide en «Cierre» «Commit, push y aprobación de `G-GA4-FUSION`» (`spec.md:370`). El paso 14 y la tabla de intervenciones (`:87`) solo piden la aprobación. Ver P-02 |
| 9 | Reglas | PASS | Sin secretos ni datos reales (`:71`, `:90`); credenciales solo por `worker_api` (paso 4) y el contrato K01–K04 de la spec, que el plan no altera; ninguna suite contra `app` (`:65`, `:71`) |
| 10 | Trampas | PASS | `default 'meta'` (4), selección con confirmación y `prompt=consent` (6), revocación solo local (6, «Qué no se hace»), modo Testing, gasto cero y cuenta sin demo (riesgos), filas omitidas e incompatibles (7, 8), zona (T-06 en el 8), moneda, `itemId` y `utm_id` (9), Next y migraciones (`:46`, `:94`), H-12 (3), H-E1-254 (0a) |
| 11 | Git | PASS | Rama `mf/M16f` creada en el paso 0a preservando los cambios sin commit; sin push, reset, rebase, clean ni commits del asistente (`:11`) |
| 12 | Fidelidad | FAIL | (a) La spec pide que el dueño apruebe en la etapa 4 «que los eventos significan lo que dicen (ficha: «definición de cada métrica acordada»)» (`spec.md:170`). El paso 13 (`:66`) solo comunica el acta y revisa medición y consentimiento, y ningún paso registra esa aprobación. Ver P-03. (b) El plan autoriza `package.json` y el lockfile si hace falta una dependencia, registrándola antes de instalarla (`:23`, `:38`), como la spec (`spec.md:293`). Pero «Riesgos» (`:102`) manda detenerse ante «una dependencia nueva con lockfile». Ver P-04 |

## Hallazgos

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| P-01 | media | 0a | La verificación exige que todas las llamadas existentes a las cuatro funciones estén dentro de «Archivos» y, si no, detiene la microfase. Hay llamadas fuera de la tabla que no necesitan cambio, porque la spec mantiene la firma de `create_pending_connection`, `replace_credential` y `purge_connection` (`spec.md:57`, `:217`). Así, el paso 0a se detendría siempre. La spec aplica la regla de H-E1-254 solo a `publish_diagnostic`, la única firma que cambia (`spec.md:256`) | `13_meta_insights.test.sql:75`, `14_meta_breakdowns.test.sql:51`, `16_chat_entity_level.test.sql:12`, `18_tiendanube.test.sql:67`, `scripts/chat-seed-test.mjs:169`; ninguno en `plan.md:25-38` ni en II.14c | Limitar la detención a las llamadas que deban cambiar: todas las de `publish_diagnostic` (hoy en `diagnostics/repository.ts`, `db/worker-api.ts`, pgTAP `09` y `17`, y `tests/unit/`, todas dentro de «Archivos») y cualquiera de las otras tres si su firma o su contrato cambiara. Para esas tres, registrar en la sesión las llamadas existentes y confirmar que no necesitan cambios, con la regresión de `13`, `14`, `16` y `18` en verde en el paso 5 |
| P-02 | baja | 14 y tabla de intervenciones | Falta el commit y el push del cierre que pide la spec, con su verificación. Las actualizaciones del paso 14 ocurren después de la publicación del paso 12 | `spec.md:370`; `plan.md:67`, `:87` | Agregar al paso 14 y a la tabla de intervenciones: **Usuario:** commit y push de los documentos del cierre, con el hash registrado en la sesión, además de la aprobación de `G-GA4-FUSION` |
| P-03 | baja | 13 | Ningún paso registra la aprobación del dueño de que los eventos y las métricas significan lo que dicen | `spec.md:170`; ficha M16f («definición de cada métrica acordada»); `plan.md:66` | En el paso 13, que el dueño apruebe las definiciones fijas y el significado de los eventos de su propiedad, y que esa aprobación quede redactada en la sesión antes de dar por validadas las capacidades ecommerce y la comparación |
| P-04 | baja | «Archivos» y «Riesgos» | El plan autoriza una dependencia registrada antes de instalarla, y a la vez manda detenerse ante una dependencia nueva con lockfile | `plan.md:23`, `:38` frente a `:102`; `spec.md:293` | Quitar «una dependencia nueva con lockfile» de `:102`, o decir en ambos lugares lo mismo: si hace falta una dependencia, se registra en la sesión con su motivo antes de instalarla, sin detener la microfase |

## Observación de tamaño (no afecta el veredicto)

Igual que en la ronda 2: la ficha exceptúa a M16f del límite de ocho horas y el usuario lo retiró de `AGENTS.md` (H-E1-261). Los cuatro controles de etapa (pasos 6, 8, 9 y 11), la publicación y el recorrido real son un corte grande. Conviene mantener un commit y una sesión por control, como en M16e, y no empezar la etapa `.3b` sin el commit de `.3a`.

## Siguiente paso

Corregir el plan (P-01 a P-04) en plan mode y volver a auditarlo con `plan-audit-4`.
