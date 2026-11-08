# Auditoría del plan M16c — 2

**Fecha:** 2026-11-08  
**Commit base:** `a27f7270310034cc3e64346684b1f5c5e5a20ae3` (`main`), con los cambios documentales preexistentes sin commit y `docs/FASES/FASE1/M16c/` sin rastrear.  
**Hash de contenido de la spec, excluyendo solo la línea de estado:** `3c1db5b57f9ef68a54760841185cafdef50156db`  
**Hash de contenido del plan, excluyendo solo la línea de estado:** `f402a0bb4d4e7939aa0ae4999862e35c83f13877`

## Veredicto

**REQUIERE CAMBIOS: 9 PASS, 3 FAIL.** Los tres FAIL son defectos del plan (P-01 a P-03). Ninguno cambia el alcance ni exige tocar la spec o la ruta.

## Precondiciones

| Precondición | Resultado | Evidencia |
|---|---|---|
| Spec en `APROBADA` | Cumple | `M16c/spec.md:3` |
| Última `spec-audit-N.md` APROBABLE | Cumple | `spec-audit-11.md:12` |
| Hash actual de la spec = hash auditado | Cumple | `3c1db5b…` calculado = `spec-audit-11.md:5` |
| Plan existe en `BORRADOR` | Cumple | `M16c/plan.md:3` |

`plan-audit-1.md` quedó BLOQUEADO porque la spec todavía no estaba aprobada. El plan no cambió desde entonces: el hash es el mismo.

## Checklist

| # | Ítem | PASS/FAIL/NO APLICA | Evidencia o justificación |
|---:|---|---|---|
| 1 | Spec base | PASS | `plan.md:7` cita la spec y el hash `3c1db5b…`, que coincide con el actual. La frase «falta reflejar ese estado en el archivo» ya no es cierta, porque la spec está `APROBADA`, pero no altera la base citada. |
| 2 | Cobertura | PASS | Los pasos 0–20 cubren los 22 C (C-01 a C-22) y los 38 T (T-01 a T-38). Algunos ejemplos: T-01/03/05/06/10/11/14/15/24/25/31/36/37/38 en el paso 2; T-04/21/26 en el 3; T-12/16–20/28–30/32 en el 8; T-02/07–09/13/22/23/35 en el 9; T-27/28 en el 14; T-34 en los pasos 13, 16 y 19; T-33 en los 0, 7, 12 y 17. También están los 16 CA heredados: CA-39/41–46/58/59 en el paso 2 y CA-47/47b/56/57/60 en el 8. |
| 3 | TDD | PASS | Cada RED va antes de su GREEN: 2→4, 3→6, 8/9→10/11 y 14→15. El paso 13 prueba los bordes antes de adoptar los valores. `plan.md:144` justifica por qué no hay TDD en T-32 (regresión), T-33 (checklist) y T-34 (evidencia externa). |
| 4 | Archivos | PASS | F01–F06, F08–F24 corresponden a filas de II.11 (`meta_first/plan.md:695-702`). F25 es la fila Q-04 de II.11 .3. F26 es un artefacto del pipeline (precondición 9). F27–F29 son de seguimiento (precondición 8). F07 `repository/sync-calls.ts` es una ubicación nueva dentro del módulo `integrations`, registrada en el plan y en la spec aprobada (`spec.md:221`), así que es válida por la regla de rutas sugeridas (`meta_first/plan.md:406`). F18–F20 quedan dentro de `integraciones/`. No se modifican las pruebas existentes de la tarjeta ni `tests/app/helpers.ts` (`plan.md:191`). |
| 5 | Pasos | **FAIL** | Ver P-01. El resto del orden es correcto: 0016 se aplica al desechable (paso 5) antes de los GREEN que la necesitan (6, 9–11); Q-04 se fija (13) antes de la publicación; la comunicación (16) va antes de la captura (19), y `db:push` a `app` antes de integrar en `main` (18). Cada paso tiene su verificación. |
| 6 | Migraciones | PASS | Solo se crea `0016` nueva; la última existente es `0015_activation_row_lock.sql`. pgTAP 13. No se modifican 0001–0015. Una corrección posterior va en una migración nueva (`plan.md:165-171`). |
| 7 | Comandos | PASS | Todos los scripts citados existen en `package.json`: `verify`, `db:check:test`, `test:policies`, `test:app`, `test:unit`, `test:component`, `db:push:test`, `db:check`, `db:preview` y `db:push`. Los filtros `-- <archivo>` son sintaxis válida de Vitest. `git diff --check` y `git status --short --branch` son válidos. Están las suites de III.3 para las etapas .1/.2/.3 (`meta_first/plan.md:858-859`) y aparece CB-06 (`plan.md:140`). El mecanismo del checkout aislado se trata en P-02. |
| 8 | Acciones reservadas | **FAIL** | Ver P-02. Cada una tiene su paso y su verificación: `db:push:test` (5), commits (7/12/17/20), comunicación (16), `db:check`/`db:preview`/`db:push` en app, integración, push y despliegue (18), ensayo (19) y G-SYNC (20) (`plan.md:146-161`). Falta la intervención que necesita el control de compatibilidad del paso 7. |
| 9 | Reglas | PASS | Sin secretos ni datos reales; no se lee `.env.local` (pasos 0 y 19). K01 se resuelve en el servidor y la acción no recibe argumentos de negocio (pasos 11 y 15). La credencial se lee con `readCredential` del repositorio y las escrituras privilegiadas pasan por `worker_api`. Las pruebas corren solo en el desechable; en app no hay suites (paso 18). |
| 10 | Trampas | PASS | Las trampas de la ruta (`meta_first/plan.md:706`) quedan cubiertas: ausencia ≠ cero (paso 9/T-09, «Qué no se hace»); `paging.next` (10); completitud sin sumas (10/11); posesión y reloj después de los bloqueos (1, 2, 4); texto SQL (decisiones de 10/11); no sumar reach/tasas/niveles/atribuciones («Qué no se hace»); metadata histórica (2, 8). Las de la spec (`spec.md:367-381`) también: purga contra puntero e inmutabilidad (Migraciones), catálogo exacto de 09 (4), timeout del cliente (Riesgos), workers («Qué no se hace»), cuenta vacía (19). |
| 11 | Git | PASS | Todo ocurre en `mf/M16c`. El asistente no hace commit, push ni despliegue (`plan.md:161`). Actualizar la rama desde `main` (`plan.md:180`) requiere un commit de merge, que hace el usuario; nunca rebase. |
| 12 | Fidelidad | **FAIL** | Ver P-03. El resto coincide con la spec. `maxDuration` como literal de página (paso 13) concreta «Acreditar maxDuration efectivo» (`spec.md:355`) según `node_modules/next/dist/docs/.../maxDuration.md`, que lo indica para Server Actions a nivel de página. |

## Hallazgos

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| P-01 | Baja | 14, 15 | El paso 14 deja en RED las pruebas del parser de la query `sync` y de la precedencia de resultados, que viven en la suite unitaria de Insights (T-28, `tests/unit/meta-insights.test.ts`). Pero el paso 15, que es el GREEN, solo lista F17–F20, y ningún paso posterior asigna dónde se implementa ese parser. El parser OAuth equivalente vive hoy en `meta/outcomes.ts`, que no está autorizado. Si el implementador sigue ese patrón, la corrida se detiene por tocar un archivo fuera de la tabla. | `plan.md:103-104`; `spec.md:324`; `src/app/(app)/app/integraciones/page.tsx:6,23` importa `parseMetaOAuthOutcome` desde `meta/outcomes` | Indicar en el paso 15 que el parser y la precedencia de resultados de sync se implementan en F12 `meta/insights.ts`, y agregar F12 a los archivos del paso 15 y a la columna «Paso» de la tabla de archivos. |
| P-02 | Media | 7 | El control de compatibilidad exige correr `npm run test:app` del SHA base en un checkout aislado, «sin copiar ni mostrar secretos». `tests/app/setup.ts` carga `.env.local` desde `process.cwd()`, así que un checkout nuevo no tiene configuración. El asistente no puede leer ni copiar ese archivo. El plan no dice cómo se crea el checkout ni quién aporta su configuración (y sus dependencias), y la tabla de intervenciones no prevé ninguna acción del usuario en el paso 7. Así, el control requerido por D-M16c-03 (`spec.md:363`) no se puede ejecutar como está escrito. | `plan.md:74,138,153`; `tests/app/setup.ts:12-15` | Detallar el procedimiento del paso 7: crear el checkout de forma no destructiva (por ejemplo, `git worktree add <dir-fuera-del-árbol> <SHA-base>`) e instalar dependencias. Agregar a la tabla de intervenciones una acción del usuario: que deje disponible la configuración del desechable en ese checkout sin compartirla por el chat, con su verificación posterior (`npm run db:check:test` en el checkout y después `test:app`). Incluir también la limpieza del checkout. |
| P-03 | Baja | 19, 20 | La spec asigna a la etapa .3 verificaciones de hipótesis que el plan no incluye en la evidencia del ensayo real ni en el cierre: H-07, registrar en la sesión la diferencia entre `started_at` y el reloj local de la ejecución real; H-02, compatibilidad de la atribución unificada y de `report_time` en el ensayo real; H-03, recuperabilidad de inventario y ancestros en el ensayo. El paso 20 solo enumera H-E1-22/27/35/36/117/189. | `spec.md:398,399,403`; `plan.md:108-109` | Agregar al paso 19 el registro redactado de la diferencia de reloj de H-07 y del resultado observado para H-02 y H-03. Con cero filas, dejar constancia de lo que queda sin verificar. Agregar al paso 20 el estado de M16c-H-01 a H-08. |

## Evidencia y límites

- Hashes calculados con `grep -v '^\*\*Estado:\*\*' ARCHIVO | git hash-object --stdin`.
- Fuentes contrastadas:
  - `M16c/plan.md` y `M16c/spec.md`, completos, y `AGENTS.md`;
  - `meta_first/plan.md`: la ficha y las etapas (`:296-327`), las precondiciones de Parte II (`:404-419`), II.11 (`:689-706`), III.3 (`:843-864`) y III.9 (`:957-970`);
  - `package.json` y `supabase/migrations/`;
  - `tests/app/setup.ts`, `scripts/run-pgtap.mjs` y `integraciones/page.tsx`;
  - la lista de archivos existentes de `repository/`, `integraciones/` y `tests/`;
  - la documentación local de `maxDuration` de Next.
- No se ejecutaron suites. Las corre la implementación. `spec-audit-11.md` registró `npm run verify` con exit 0 sobre el mismo commit.
- No se leyó `.env.local`. No se modificó ningún archivo salvo este informe. Sin commit, push ni despliegue.

## Observación de tamaño

El plan supera claramente las 8 horas. D-M16c-05 y la Parte I (`meta_first/plan.md:300`) autorizan esa excepción, con tres controles de etapa y puntos de reanudación (pasos 7, 12 y 17). No se recomienda partirlo, porque iría contra esa decisión.

## Siguiente paso

Volver a plan mode, corregir P-01 a P-03 en `M16c/plan.md` y auditar de nuevo (`plan-audit-3.md`). De paso, actualizar `plan.md:7`, que todavía dice que la spec no figura como aprobada.
