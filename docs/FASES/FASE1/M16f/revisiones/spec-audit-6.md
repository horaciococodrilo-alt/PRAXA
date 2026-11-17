# Auditoría de la spec de M16f — ronda 6

- **Fecha:** 2026-11-15.
- **Commit y rama:** `9af2139`, `docs/cierre-m16e`. Se preservaron los cambios preexistentes de `AGENTS.md`, `M16f/spec.md`, `meta_first/{plan,spec}.md`, `HALLAZGOS.md` y las cinco auditorías sin seguimiento.
- **Precondición:** `M16f/spec.md:3` sigue en `BORRADOR`; `PROJECT_STATE.md`, «Cerradas» y «Siguiente habilitada», registra `G-TIENDA` aprobado y M16f habilitada.
- **Hash de contenido de la spec:** `cbf04a4fc6e9ec3239c406168cb6d2d458ba2622` (bytes UTF-8 salvo la línea que comienza `**Estado:**`, enviados a `git hash-object --stdin`).

## Veredicto

**REQUIERE CAMBIOS.** Las correcciones A-01 a A-05 de la ronda 5 están incorporadas: cuota solo en `runReport`, celda futura sin cero, retención nula si un conteo se oculta, identidad opaca del ítem y calidad pública por informe/ventana (`M16f/spec.md:179-212`, T-05–T-09). Quedan dos contradicciones ejecutables, una regla de calidad sin definir y la condición de entrada `verify` sin exit 0 en esta sesión (hallazgos A-01 a A-04 abajo).

**Base ejecutada:** `npm run verify` pasó lint, typegen y typecheck, pero terminó con exit 1: 60 archivos de pruebas, 1415/1417 casos pasados. Los dos fallos son de `tests/unit/credential-crypto.test.ts`: el arnés no pudo importar `setup.mts` desde una ruta temporal `#!sandbox…`, por lo que no alcanzó el build. En una segunda corrida, solo `TEMP` y `TMP` apuntaron a `node_modules/.praxa-audit-temp`: 60/60 archivos y 1417/1417 casos pasaron. El build quedó en «Creating an optimized production build» sin más salida durante aproximadamente tres minutos y se interrumpió; esa corrida también terminó sin exit 0. No se leyó `.env.local` ni se ejecutaron suites contra una base.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | «Heredados» (`M16f/spec.md:297-310`) recoge aceptación, condición, CB-01–06 y §17 de la ficha (`meta_first/plan.md:435-448`). |
| 2 | Alcance | PASS | Alcance y fuera de alcance (`M16f/spec.md:25-44`), catálogo y tres comparaciones (`:156-223`) corresponden a la ficha (1)–(7) y II.14c (`meta_first/plan.md:441`, `:924-939`), con D-M16f-09 para excluir pedido. |
| 3 | Spec general y sucesoras | PASS | `meta_first/spec.md` §17.1–11 (`:683-720`) y la ficha de M28.3a (`meta_first/plan.md:450-461`) conservan las tres fuentes, el gate, la purga, el chat y el diagnóstico. La contradicción temporal con la API de cohortes se consigna en A-02, no nace de la ruta. |
| 4 | Decisiones | PASS | D-M16f-01–13 figuran como decisiones del usuario (`M16f/spec.md:390-404`); -06, -09, -10 y -12 están reflejadas en la ruta (`meta_first/plan.md:441`, `:936-939`; `meta_first/spec.md:713-720`). |
| 5 | Trampas | PASS | `M16f/spec.md:372-386` recoge la prohibición de `default 'meta'` de II.14c y los riesgos de instrumentación, moneda, zona y API. |
| 6 | Intervenciones reservadas | PASS | `M16f/spec.md:356-370` asigna aprobación, Google Cloud, `db:push:test`, `db:push` en `app`, publicación y push al usuario, con verificación posterior; coincide con la ficha y III.2 (`meta_first/plan.md:448`, `:1029-1031`). |
| 7 | Verificación prevista | PASS | T-01–T-11 y «Verificación» (`M16f/spec.md:333-354`) incluyen `verify`, `db:check:test`, `test:policies`, `test:app`, preflight, `checkCompatibility` y recorrido real, conforme a III.3 (`meta_first/plan.md:1059`) y CB-06 (`meta_first/spec.md:640-645`). |
| 8 | Dependencias | PASS | `PROJECT_STATE.md` aprueba `G-TIENDA` y habilita M16f; HEAD contiene `0023_tiendanube.sql`, `0024_tiendanube_diag.sql` y las interfaces entregadas por M16e. `G-ANOMALIES` es dependencia de M28.3a, no de M16f. |
| 9 | Entregado de verdad | PASS | `0023_tiendanube.sql:2547-2600` limita `get_tn_product_units` a 50 variantes, y §4.2 lee `tn_product_units_daily` por producto (`M16f/spec.md:221`); `0024_tiendanube_diag.sql:146-148` y `src/modules/diagnostics/repository.ts:215` confirman la firma actual de siete argumentos. |
| 10 | Pendientes y hallazgos | PASS | «Hallazgos relacionados» (`M16f/spec.md:429-437`) trata H-E1-236/237/238/234/228/241/259; `HALLAZGOS.md:18-31`, `:831-842` y `PROJECT_STATE.md`, «Pendientes abiertos», no añaden una dependencia de entrada oculta. |
| 11 | Contexto real | PASS | Se contrastaron las referencias de `M16f/spec.md:46-72` con `0023`, `0024`, `src/modules/integrations/{contract,repository,lifecycle}.ts`, `src/modules/chat/orchestrator.ts:339`, `src/modules/app-data/index.ts:97` y `src/modules/tenant/context.ts:37`. No cambió código en el árbol frente a la ronda 5. |
| 12 | Archivos previstos | PASS | La tabla `M16f/spec.md:260-282` se corresponde con II.14c y las enmiendas D-M16f-06/10 (`meta_first/plan.md:930-937`); esta auditoría es un archivo de seguimiento. |
| 13 | Diseño suficiente | **FAIL** | A-01: no se puede completar una sincronización que omite capacidades no disponibles; A-02: la cobertura temporal de N usa meses calendario frente a desplazamientos de 30 días de la API; A-03: falta la reducción de metadatos de varias páginas a una fila de calidad. |
| 14 | Verificable | **FAIL** | T-05–T-09 cubren las cinco correcciones de la ronda anterior, pero T-06/T-07 (`M16f/spec.md:340-341`) no prueban una sincronización completa con informes omitidos, límites mensuales de 28/30/31 días ni metadatos discordantes entre páginas (A-01–A-03). |
| 15 | Sin preguntas abiertas | PASS | «Preguntas abiertas» dice «Ninguna» (`M16f/spec.md:423-425`); H-01–12 (`:410-421`) tienen etapa y verificación o contingencia previstas. |
| 16 | Ejecutable ahora | **FAIL** | A-04: `npm run verify` no obtuvo exit 0. Los comandos están en `package.json`; las variables `GOOGLE_OAUTH_*` y el preflight son entregables previstos en `.env.example` y `scripts/`, con acción del usuario antes de etapa .1 (`M16f/spec.md:111-117`, `:267`, `:362`). |
| 17 | Consistencia interna | **FAIL** | `M16f/spec.md:169`, C-05 (`:320`) y D-M16f-08 (`:399`) permiten omitir capacidades no disponibles, mientras §3 (`:176`) exige completar todos los informes para cerrar (A-01). §3 (`:182`) trata `cohortNthMonth` como mes calendario sin reconciliarlo con `CohortsRange` (A-02). |
| 18 | Reglas no negociables | PASS | K01 del servidor (`M16f/spec.md:140-145`), credenciales por `worker_api` (`:204-214`), errores redactados (`:95-108`), migraciones nuevas (`:127-136`) y pruebas automatizadas solo en desechable (`:348-354`) coinciden con `AGENTS.md` y `SECURITY.md` §§3, 5 y 11. |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| «Todos los informes de todas sus ventanas están completos» para `ga4_finish_sync` (`M16f/spec.md:176`) | «Una capacidad no disponible no se ejecuta» (`:169`, C-05 `:320`) y D-M16f-08 (`:399`), que admite ecommerce no instrumentado | Si faltan eventos ecommerce o UTMs, sus informes no se ejecutan y tampoco pueden estar completos; el backfill no llega al estado completo exigido por §3 | Definir la cobertura objetivo solo sobre informes de capacidades disponibles y conservar el estado explícito de los omitidos; probar cierre con ecommerce y UTMs no disponibles. |
| `C + N` meses calendario determina si una celda de cohorte es futura, provisional o cerrada (`M16f/spec.md:182`) | [CohortSpec oficial](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/CohortSpec), `CohortsRange.startOffset/endOffset`: con `MONTHLY`, los límites se desplazan `offset × 30` días desde el rango de adquisición | Una cohorte de enero con `endOffset=1` extiende su consulta hasta el 2 de marzo, mientras la spec podría considerar febrero cerrado el 1 de marzo e inferir cero | Definir las fechas efectivas de observación de cada N según el contrato de la API, y usar esos límites para futuro/provisional/cero; probar febrero y meses de 30/31 días. |

## Hallazgos

| ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | alta | §2–3, sincronización | Una capacidad ausente se omite, pero el cierre exige completar todos los informes; el paso puede quedar perpetuamente parcial y no registrar la última sincronización. | `M16f/spec.md:169`, `:176`, C-05 `:320`, D-M16f-08 `:399`; ficha `meta_first/plan.md:444-446`. | Precisar qué informes integran la cobertura objetivo cuando el preflight los marca no disponibles y añadir a T-06 un cierre completo en ese caso. | No |
| A-02 | alta | §3, cohortes | La clasificación temporal de `cohortNthMonth` por `C + N` meses calendario no sigue los desplazamientos `MONTHLY` de 30 días documentados para `CohortsRange`; puede publicar un cero de un intervalo aún abierto. | `M16f/spec.md:167`, `:182`, `:323`, T-07 `:341`; [CohortSpec oficial](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/CohortSpec). | Fijar rango efectivo por N con la semántica de Google, aplicarlo a ausencia/provisional/cero y agregar casos de 28, 30 y 31 días. | No |
| A-03 | media | §3, calidad | Una ventana de 25.000 filas requiere tres respuestas paginadas, pero solo se guarda una fila de calidad por informe/ventana. No se define qué hacer si una página trae umbral, `(other)`, truncamiento, muestreo, restricciones, moneda o zona distintos de otra, o si omite metadatos. | `M16f/spec.md:179`, `:184`, `:208`, T-06 `:340`; [ResponseMetaData oficial](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData). | Especificar una reducción conservadora de metadatos por página o rechazar la ventana discordante; probar páginas con banderas distintas y ausencia de metadata. | No |
| A-04 | alta | Condición de entrada | `npm run verify` no terminó en verde en esta sesión. La ruta temporal del sandbox rompe dos pruebas del arnés; con `TEMP`/`TMP` alternativos las 1417 pruebas pasan, pero el build no concluyó. | Comandos y resultados en «Base ejecutada»; `package.json`, script `verify`; `tests/unit/credential-crypto.test.ts:949-971`. | Diagnosticar el bloqueo del build y acreditar una corrida completa de `npm run verify` con exit 0 sobre la base. Si el fallo del arnés depende solo de la ruta temporal, registrar el ajuste reproducible. | No |

## Observación de tamaño

M16f ya se divide en controles `.1`, `.2`, `.3a`, `.3b` y `.4` (`M16f/spec.md:120-135`). Esa partición permite revisar una microfase mayor a ocho horas; la excepción figura en la ficha y el usuario retiró el límite de `AGENTS.md` (H-E1-261).
