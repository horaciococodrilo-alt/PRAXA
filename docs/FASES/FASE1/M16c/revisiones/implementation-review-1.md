# M16c — Revisión de implementación 1

Fecha: 2026-11-08, America/Argentina/Buenos_Aires. Revisión independiente solicitada mediante `$implementation-review M16c`.

## Estado revisado

- Rama: `mf/M16c`.
- HEAD: `235e5c1dd8ae762583950d2908ea7d2a1d325961`.
- `main`: `8e9e33fe0842adab3ad52a5138d038723683fb29`.
- Base anterior a la implementación: `a27f7270310034cc3e64346684b1f5c5e5a20ae3`.
- Foto inicial de `git status --porcelain`: salida vacía.
- Precondición documental: PROJECT_STATE y el cierre de la sesión indican **VERIFICADO — PENDIENTE DE APROBACIÓN**; G-VR01 está aprobado y G-SYNC pendiente.
- Hash inicial del estado: `207b3890fdadf6ae667cfa0879f7cce482074bad`.
- Hash del estado revisado, incluidos los dos cambios documentales concurrentes descritos abajo: `5e7c5e1d2239f2c0b849fa88b065285d01a5e16a`.

Se usó el algoritmo de la skill: bytes de `git diff main` más contenido de archivos no rastreados en orden Git, excluyendo `docs/FASES/FASE1/*/revisiones/*` y `docs/FASES/FASE1/meta_first/sesiones/*-review-*`, pasados a `git hash-object --stdin`. Se implementó con `spawnSync` y `Buffer.concat`, sin conversión de los saltos de línea del diff. El hash inicial se reconstruyó con `git diff main 235e5c1`, porque el árbol inicial estaba limpio.

`git diff main...HEAD` muestra únicamente tres documentos de seguimiento: 162 inserciones y una eliminación. La implementación ya está integrada en main. Para evitar una revisión limitada al seguimiento, se inspeccionó también `git diff a27f727 HEAD`, los archivos de implementación completos y las aserciones de sus pruebas. No se atribuyen a esta ejecución las enmiendas y auditorías documentales preexistentes que entraron en el primer commit de etapa.

Durante la revisión aparecieron cambios externos en `docs/HALLAZGOS.md` y `meta_first/sesiones/M16c.md`: agregan que el usuario no recuerda si desconectó Meta, en el seguimiento de H-E1-197. Se leyeron y preservaron. No modifican código, spec ni plan.

## Veredicto

**REQUIERE CAMBIOS.** Dos defectos de comportamiento reproducidos sobre el código intacto y un hueco de cobertura. Se pueden resolver dentro de los módulos y pruebas previstos para M16c. No se corrigió implementación ni documentación de seguimiento. No se aprueba G-SYNC ni se habilita M25a.1.

Las suites existentes pasan y sus conteos coinciden con la sesión. Eso no cubre los casos adicionales que reproducen R-01 y R-02.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Alcance | FAIL | Los archivos de implementación están en F01–F32/II.11; sin chat, workers ni escrituras publicitarias. Falta cumplir la lectura completa y el rechazo de metadata duplicada: R-01/R-02. |
| 2 | Criterios | FAIL | Matriz abajo. R-01 viola CA-46; R-02 contradice el paso 10 del plan. T-23 no prueba el reemplazo real de generación en vuelo, R-03. |
| 3 | Las pruebas detectan roturas | PASS | Tres mutaciones ejecutadas: precisión, resultado de reauth y guarda antes de Graph. Todas producen una aserción fallida; restauración binaria confirmada. |
| 4 | Reejecución | PASS | `verify`: 714; pgTAP: 727; app: 72 pasan/7 omitidas opt-in o centinelas. Coinciden con el paso 17 y el cierre de la sesión. Se distingue el bloqueo inicial de entorno. |
| 5 | Seguridad y reglas | PASS | K01 en el servidor; RLS/ACL y errores redactados probados; sin service_role en runtime modificado ni secretos encontrados; solo migración nueva 0016. Módulos nuevos `server-only`. |
| 6 | Calidad funcional | FAIL | Recorte silencioso de cobertura y aceptación de duplicados entre páginas: R-01/R-02. Sin `any` ni TODO en el runtime cambiado. |
| 7 | Evidencia | PASS | La sesión registra comandos, fallos, controles por etapa, compatibilidad de la base, publicación y evidencia real declarada por el usuario, con límites explícitos. G-SYNC sigue pendiente. Nuevos hallazgos identificados aquí como R-01 a R-03. |
| 8 | Contradicciones | FAIL | La implementación incumple la lectura de CA-46 y el rechazo de metadata duplicada del plan. Son correcciones dentro del alcance; no hace falta cambiar la ruta para resolverlas. |

## Matriz de criterios operativos

“Sí, parcial” significa que las aserciones existentes sí comprueban el comportamiento indicado, pero no todo el criterio. No se presenta esa cobertura parcial como PASS del criterio.

| Criterio | Prueba | Aserción verifica el criterio (sí/no) | Resultado |
|---|---|---|---|
| C-01 | T-01/02/35/36; unit vista JWT | Sí | PASS: ajena sin filas, refs adulteradas, tenant en servidor. |
| C-02 | T-01/31; pgTAP 09 y 13 | Sí | PASS: siete tablas, ACL, RLS forzada, claves compuestas y lectores invoker. |
| C-03 | T-03/04 | Sí | PASS: concurrencia real, conflicto, lease sin renovar y desplazamiento. |
| C-04 | T-04/05/22 | Sí | PASS: rechazo tras espera de lock, lease/generación/token y ejecución desplazada. |
| C-05 | T-06/20/38 | Sí | PASS: rollback, petición idéntica, rechazo de contenido distinto y reintento SQL. |
| C-06 | T-07/08/35/38 | Sí | PASS: cuatro resultados, parcial, primer fallo, not_attempted y clasificación por páginas válidas. |
| C-07 | T-02/08/09/10/27 | Sí, parcial | Casos existentes PASS; FAIL de lectura completa en R-01. |
| C-08 | T-10/11/12 | Sí | PASS: metadata histórica y snapshot anterior conservados, UPDATE rechazado. |
| C-09 | T-13/14 | Sí | PASS: Graph simulado → SQL → Data API → Zod exactos, positivos y negativos decimales. |
| C-10 | T-15/16/37 | Sí | PASS: DST, instante congelado, flag persistido, reloj atrasado/adelantado. |
| C-11 | T-16/17/36/37 | Sí | PASS: cuatro niveles, fechas locales, parámetros y normalización exacta de raíz. |
| C-12 | T-17/18 | Sí, parcial | Casos existentes PASS; FAIL: metadata duplicada entre páginas aceptada, R-02. |
| C-13 | T-19/20/33/34 | Sí | PASS automatizado: retry, timeout de fetch/body, reserva y perfil Q-04. Límite desplegado acreditado históricamente por declaración del usuario. |
| C-14 | T-21/22/38 | Sí | PASS: persistencia general y de sync, errores fijos, no clobber y limpieza solo completed. |
| C-15 | T-03/05/23; unit guarda antes de Graph | Sí, parcial | Desconexión/purga/needs_reauth y generación ya cambiada PASS; falta el reemplazo real de generación durante la extracción: R-03. |
| C-16 | T-11/23/24; pgTAP 10 | Sí | PASS: purga repetible y cascada de las siete tablas nuevas. |
| C-17 | T-25/26; pgTAP 09 | Sí | PASS: catálogo de 16 operaciones, grant aislado, atributos, wrappers estrictos y errores sin DETAIL/HINT. La conservación de contraseña se acredita por conexión real posterior a 0016. |
| C-18 | T-27/28/35 | Sí, parcial | Botón, pendiente, estados y validación de selectores PASS; tabla pierde filas por R-01. |
| C-19 | T-18/27/29 | Sí | PASS: logs cerrados, DTO sin IDs/posesión, escape de metadata y URLs reconstruidas. |
| C-20 | T-12/14/30/31/36 | Sí | PASS del contrato aprobado: cadenas, acciones/variantes separadas y atribución sin agregar. H-E1-194 permanece como limitación ya registrada. |
| C-21 | T-32, suite meta-lifecycle | Sí | PASS: regresión de listado paginado y sus límites. |
| C-22 | T-33/34, sesión de tres etapas | Sí | Controles y ensayo real constan con sus límites. PASS de procedimiento/evidencia; gate sigue pendiente por esta revisión. |

## Matriz de criterios heredados

| Criterio | Prueba | Aserción verifica el criterio (sí/no) | Resultado |
|---|---|---|---|
| CA-39 | T-21/22/38 | Sí | PASS, clases persistidas sin transición indebida. |
| CA-41 | T-01/11/12/17/31 | Sí, parcial | Inmutabilidad/proyección PASS; duplicados del inventario: R-02. |
| CA-42 | T-07/08/17/38 | Sí, parcial | Cuatro completos y fallos parciales PASS; validación de metadata incompleta por R-02. |
| CA-43 | T-08/09/10/27 | Sí | PASS en SQL: ausencia/null/cero y sustitución completa. El lector recortado se registra contra CA-46. |
| CA-43b | T-15/16/37 | Sí | PASS. |
| CA-44 | T-12/13/31 | Sí | PASS de conservación y proyección de procedencia, unidades y atribución. |
| CA-44b | T-13/14/31 | Sí | PASS, incluida prueba real SQL/Data API con precisión mayor a number. |
| CA-45 | T-06/07/10/20 | Sí | PASS. |
| CA-46 | T-02/09/27/35 + prueba temporal REVIEW cobertura | Sí, parcial | FAIL: 1000 filas recibidas de 1120 esperadas, R-01. Aislamiento PASS. |
| CA-47 | T-17/18 | Sí, parcial | Paginación/cursor/topes PASS; duplicados entre páginas no se rechazan, R-02. |
| CA-47b | T-16/34 | Sí | PASS: ventana de 28 días; no se promete congelamiento. |
| CA-56 | T-18/19/20/34 | Sí | PASS de cotas técnicas y presupuesto probado. Lecturas JWT sin timeout propio: límite ya declarado en Q-04. |
| CA-57 | T-19/20 | Sí | PASS, dos retry temporales/transporte, backoff y sin retry de rate/auth. |
| CA-58 | T-03/04/35 | Sí | PASS. |
| CA-59 | T-04/05/22/23 | Sí, parcial | Guardas SQL PASS; hueco del caso completo de reautorización en vuelo, R-03. |
| CA-60 | T-32 | Sí | PASS de regresión existente. |
| CA-14/17/19–22; DEC-03/04 | T-01/02/25/26/31, pgTAP 09 | Sí | PASS: privilegios, aislamiento y frontera servidor/base. |
| CA-26/40; CB-02 | T-18/27/29 y búsqueda por patrones | Sí | PASS; coincidencias de IDs numéricos solo en fixtures SQL sintéticos. |
| CA-38/38c/67/68; DEC-09 | T-11/23/24 y pgTAP 10 | Sí, parcial | Purga/cascadas PASS; R-03 limita la prueba completa de cambio de credencial. |
| DEC-05/22 | T-07 a T-20, T-27/30/31 | Sí, parcial | Contratos de catálogo, precisión y cobertura existentes PASS; R-01/R-02. |
| CB-01 | Tres suites completas | Sí | PASS de suites existentes; no cubren las dos regresiones adicionales reproducidas. |
| CB-03/04 | Diff migraciones y guardas del desechable | Sí | PASS: 0016 nueva; ninguna suite contra app. |
| CB-05/06 | Sesión y salida independiente | Sí | PASS: omisiones identificadas y fallos de entorno no contados como pruebas aprobadas. |

## Roturas controladas

Archivo: `src/modules/integrations/meta/insights.ts`. Antes de cada mutación se conservó una copia binaria fuera del repositorio. Cada restauración se realizó en `finally` desde esa copia y se comparó mediante `Buffer.equals`, equivalente binario de `cmp`. SHA-256 antes/después: `205fd3a333f4dc0d8bd3c7eddbe6741ff9a4ccc8cd9db2a88c20a09c24a4f516`.

| Criterio | Rotura | Prueba que la detectó | Restaurado (cmp) |
|---|---|---|---|
| C-09 / CA-44b | Devolver `String(Number(value))` en `decimal` | T-14 «acepta las cadenas sintéticas y conserva sus dígitos»: esperaba `00.50`, recibió `0.5`; exit 1; 1 falla/15 pasan | Sí, bytes idénticos. |
| C-14 / CA-39 | Sustituir el resultado requiere_reauth por incompleta | «una clase de reautorización da requiere_reauth y detiene»: esperaba requiere_reauth, recibió incompleta; exit 1; 1 falla | Sí, bytes idénticos. |
| C-15 / CA-38c | Omitir `await deps.beforeCall()` | «una conexión que deja de estar activa antes de una llamada nueva corta Meta y no escribe»: esperaba conexion_cambio, recibió completa; exit 1; 1 falla | Sí, bytes idénticos. |

Comandos efectivos:

```text
npm run test:unit -- tests/unit/meta-insights.test.ts -t M16c-T-14
npm run test:unit -- tests/unit/meta-insights.test.ts -t reautorizaci
npm run test:unit -- tests/unit/meta-insights.test.ts -t corta.Meta.y.no.escribe
npm run test:unit -- tests/unit/meta-insights.test.ts
```

La última ejecución, sin mutaciones, dio exit 0 y 102/102. Dos selecciones iniciales con filtros de varias palabras no ejecutaron casos (173 omitidos en otros archivos); no se acreditaron como ensayos de rotura y se repitieron con los filtros anteriores. Las omisiones de selecciones `-t` son deliberadas y no reemplazan las suites completas.

## Comandos reejecutados

| Comando | Resultado real | Comparación con sesión |
|---|---|---|
| `git status --porcelain`; rama y SHA | Árbol limpio inicial; rama y HEAD indicados arriba | Precondiciones cumplidas. |
| `git diff main...HEAD`; `git diff`; diff adicional desde a27f727 | Seguimiento en main…HEAD; implementación desde la base; cambios externos documentales preservados | Base desplegada ya integrada. |
| `npm run db:check:test` | Exit 0, desechable y rol de C verificados; sin copiar referencias de proyecto | Coincide. |
| `npm run verify`, entorno restringido | Lint, typegen, typecheck y 714 pruebas PASS; build sin progreso durante varios minutos, interrumpido con Ctrl+C, exit 1 | No acredita build ni fallo funcional; patrón ya registrado en la sesión/H-E1-191. |
| `npm run verify`, repetición con acceso normal a procesos | **Exit 0**, 28 archivos, **714 pruebas**, build Turbopack completo y 13 páginas | Coincide con paso 17; confirma el conteo que faltó capturar en paso 20. |
| `npm run test:policies`, entorno restringido | Exit 1 por ENOTFOUND antes de pgTAP | Bloqueo de entorno, no resultado de aserciones. |
| `npm run test:policies`, con acceso de red | **Exit 0**, 14 archivos/15 ejecuciones/**727 aserciones**, 0 problemas | Coincide; 09: 69 en ambas ejecuciones; 10: 28; 13: 214. |
| `npm run test:app -- --reporter=verbose` | **Exit 0**, 11 archivos, **72 pasan/7 omitidas**, 422,69 s | Coincide con sesión. Limpieza de fixtures comprobada por sus afterAll. |
| `npm run test:unit -- tests/unit/meta-insights.test.ts`, después de restaurar | **Exit 0**, 102 pasan | Coincide. |
| `git diff --check` | Exit 0 | Coincide. |
| Diff `supabase/migrations/` desde la base | Únicamente A 0016_meta_insights.sql | Ninguna migración 0001–0015 modificada. |

Omisiones de app: tres opt-in de `tests/app/email-flows.test.ts` porque falta activación explícita de envío; cuatro centinelas de configuración en concurrency, onboarding, integrations-data-api e isolation que se omiten precisamente cuando sí corre la suite remota. Ninguna prueba requerida de M16c omitida en la suite completa.

Búsqueda por patrones sobre los archivos del cambio: `act_[0-9]{6,}`, cabeceras de clave privada, claves de proveedor y JWT. Solo el primer patrón tuvo coincidencias en `supabase/tests/10_demo_closure.test.sql` y `13_meta_insights.test.sql`: fixtures declarados sintéticos. Sin coincidencias de las otras categorías. Sin `service_role`, `any` o TODO en runtime cambiado. No se abrió ni mostró `.env.local`; Next y los arneses existentes cargan internamente su configuración al ejecutar los comandos prescritos.

No se ejecutó `db:push` de ningún tipo, ni se accedió a la base app, ni se hizo commit, push o despliegue.

## Reproducciones adicionales sobre código intacto

Se prepararon dos pruebas temporales fuera del repositorio, reutilizando los helpers y el código real. Directorio local: `C:/Users/Simon/.codex/visualizations/2026/11/08/01a1bd1c-846b-7cd2-b41e-54d87b5a7062/m16c-review/`. No son fixtures de producción ni archivos agregados a PRAXA.

```text
npx vitest run --config <directorio>/vitest.config.mts -t REVIEW --reporter=verbose
npx vitest run --config <directorio>/vitest.config.mts -t 'REVIEW cobertura' --reporter=dot
```

La primera ejecución detectó R-02 mediante aserción; el setup remoto de la otra prueba agotó el healthcheck, por lo que no se contó como reproducción de R-01. La repetición aislada sí ejecutó la sincronización y lectura reales del desechable y detectó R-01 mediante aserción. Hubo dos intentos previos de cargar la configuración temporal que fallaron antes de ejecutar casos; no acreditan comportamiento.

**R-01, cobertura:** en el arnés de `tests/app/meta-sync.test.ts`, crear 40 campañas sintéticas en una página de inventario; usar `lookbackDays=maxWindowDays=28`, el resto de LIMITS del arnés; devolver Insights vacío válido en los cuatro niveles. Afirmar primero que sync devuelve completa. Leer campaign desde hoy−27 hasta hoy y comprobar longitud 40×28=1120. El sync completó y la lectura devolvió **1000**; exit 1 por `expected ... length of 1120 but got 1000`. Se ejecutó la limpieza del arnés. No se imprimieron cuentas ni importes reales.

**R-02, metadata:** en el arnés unitario de Insights, el edge campaigns devuelve en la página 1 una campaña sintética con nombre Primera y cursor hacia página 2; la página 2 repite su ID con nombre Segunda y termina. Los otros edges e Insights devuelven arrays vacíos válidos. `extract('campaign', graph)` devuelve `complete=true`, aunque el plan exige invalid_response/incompleto ante duplicados. La aserción `expect(result.complete).toBe(false)` falló; exit 1. No se cambió la implementación para reproducirlo.

## Hallazgos

Todos se asignan a **M16c**, sin ampliación de alcance.

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-01 | **alta** | `src/modules/integrations/meta/insights.ts:660` | La lectura usa una sola petición RPC y acepta cualquier longitud como completa. PostgREST recorta el resultado al límite de filas; con Todas, la tabla omite días/entidades sin aviso. Incumple CA-46/C-07/C-18 aun cuando la sincronización terminó completa y está dentro de Q-04. | Reproducción real en desechable: 40 campañas × 28 días; sync completa, lector 1000/1120. `rpcRows` no pagina ni detecta el recorte. Las pruebas actuales usan volúmenes inferiores al límite. | Paginar las lecturas con orden estable y comprobar agotamiento; aplicar el tratamiento a los lectores que comparten `rpcRows`. Agregar prueba de integración que supere el máximo de la Data API y compruebe todos los días/entidades, sin reducir la ventana ni inventar completitud. |
| R-02 | **alta** | `src/modules/integrations/meta/entities.ts:152` | `assertNoDuplicates(parsed)` solo detecta repeticiones dentro de una página. `put` sobrescribe un ID de otra página y el nivel se publica completo. El paso 10 del plan exige que metadata duplicada impida completar. | Prueba temporal de dos páginas con el mismo ID: complete=true; aserción falla. El Map elimina la evidencia del duplicado antes de la validación SQL. | Mantener IDs vistos para todo el recorrido del edge, rechazar una repetición antes de incorporar esa página y conservar solo acumulados de páginas válidas. Agregar regresión entre páginas, con metadata idéntica y distinta. Tener en cuenta las relecturas de un edge que falló parcialmente, sin confundir caché previa con duplicación dentro de una nueva lectura. |
| R-03 | **media** | `tests/app/meta-sync.test.ts:262` | T-23 no ejercita el reemplazo de credencial/generación mientras una extracción está en vuelo. El segundo escenario invoca markNeedsReauth y luego publishSnapshot, sin ejecutar sync en vuelo ni reemplazar la credencial. No comprueba el caso exigido por C-15 y el paso 9 del plan. | `meta-sync.test.ts:275` marca needs_reauth; pgTAP 13:395 cambia credential_generation por UPDATE administrativo. La propia sesión reconoce el límite en :291 y :478. Es cobertura parcial, no prueba de ese recorrido completo. | Agregar una barrera durante la llamada de Graph de sync; ejecutar la reautorización/reemplazo real sobre el desechable, liberar y afirmar que no hay nuevas llamadas ni publicación tardía de A y que la generación/resultado vigente se conserva. Conservar los escenarios existentes. |

R-03 no afirma que el código de aislamiento falle: las guardas unitarias y SQL existentes pasan. El hallazgo es el caso de integración requerido que no se ejecutó.

## Evidencia externa y pendientes del usuario

Se contrastó la sesión, sin repetir una captura real ni operar Vercel o Meta: cuatro niveles completos con cero filas; consulta agregada posterior ejecutada por el usuario; duración efectiva de 300 s y logs sin consulta declarados por el usuario. La enmienda D-M16c-02 admite ese resultado vacío; no acredita campos/tipos ni valores cero. H-E1-189/H-E1-194 siguen pendientes de filas; H-08 no probó una petición ids real. H-E1-197 conserva causa sin confirmar. No se convierten esos límites aceptados en defectos nuevos.

No falta una acción externa del usuario para corregir R-01–R-03. Siguiente paso: **`$microfase M16c` con estos hallazgos**, después repetir implementación-review y solicitar QA sobre el estado corregido. La aprobación visible de G-SYNC corresponde al usuario al terminar las revisiones. No iniciar M25a.1.

## Preservación final

La foto inicial limpia no coincide literalmente con la final por los dos cambios documentales externos descritos. No se revirtieron para simular igualdad. Sus hashes SHA-256 al preservar el estado son:

- `meta_first/sesiones/M16c.md`: `7210b84efe40de9392eb752effd9240ffcc0ecd590e74d5067cf61998cb6ea86`.
- `docs/HALLAZGOS.md`: `442b581d6c03a460af60053d4a5eb6b7b7a2bbcc9f7b2c06d39aa67951fb33e2`.

La única adición persistente del revisor dentro del repositorio es este informe. Las mutaciones se restauraron exactamente y el diff de trabajo de `src`, `tests`, `supabase` y `scripts` frente a HEAD quedó vacío. Se verifican de nuevo status, hashes documentales y hash del estado después de escribir el informe; las exclusiones impiden que este cambie el hash revisado.
