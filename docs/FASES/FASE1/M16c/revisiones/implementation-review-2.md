# M16c — Revisión de implementación 2

Fecha: 2026-11-08, America/Argentina/Buenos_Aires.

## Estado revisado

- Solicitud: `$implementation-review M16c`. El usuario autorizó expresamente usar **a27f727** porque la implementación ya está integrada en main.
- Rama: `mf/M16c`.
- HEAD: `cd752622f7a906d3c464720a45a2fc2d4f2dd4ea`.
- Main local: `718970a4a0623fa3c45c6c79aa44452bc6c1abc7`.
- Base autorizada: `a27f7270310034cc3e64346684b1f5c5e5a20ae3`.
- Foto inicial de `git status --porcelain`: **vacía**.
- Precondiciones: PROJECT_STATE y la última sección de la sesión indican **VERIFICADO — PENDIENTE DE APROBACIÓN**; G-VR01 aprobado y G-SYNC pendiente.
- Hash del estado según el comando de la skill, con main: **`556426d9104555caaaea8909689e81fe1587f6da`**.
- Hash adicional del cambio integral con la base autorizada: **`e8ac557e825e90f37a32131f21599b4be8c25e0a`**.

Ambos hashes usan los bytes de `git diff <base>` y el contenido de archivos no rastreados en orden Git, excluyendo `docs/FASES/FASE1/*/revisiones/*` y `docs/FASES/FASE1/meta_first/sesiones/*-review-*`, pasados a `git hash-object --stdin`. Se calcularon mediante `spawnSync` y `Buffer.concat`, sin alterar saltos de línea. El primero conserva el algoritmo literal de la skill; el segundo identifica la implementación aunque main ya la contenga.

Se obtuvieron `git diff main...HEAD`, `git diff`, `git status --porcelain` y **`git diff a27f727 HEAD`**. El primero contiene solo seguimiento documental; el segundo estaba vacío. Se revisó el alcance integral de M16c, utilizando también la revisión anterior de este mismo chat para el contenido que no cambió. Se leyeron completos los cuatro archivos de código/pruebas modificados desde `235e5c1`: entities.ts, insights.ts, meta-insights.test.ts y meta-sync.test.ts. Se contrastaron las fuentes vigentes, la sesión y los hallazgos; no se tomó la declaración de corrección como prueba suficiente.

Spec, plan, SQL y pruebas SQL no cambiaron desde la revisión anterior. La comparación de esos archivos con `235e5c1` dio exit 0. La autorización de base no se interpretó como permiso para corregir código, publicar ni aprobar gates.

## Veredicto

**APROBABLE.** Los ocho ítems del checklist pasan. R-01, R-02 y R-03 están subsanados y verificados. No se identificaron hallazgos nuevos que requieran corrección dentro de M16c.

Este veredicto habilita solicitar **`$qa-review M16c`**. No aprueba G-SYNC, no cierra la microfase y no habilita M25a.1.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Alcance | PASS | Implementación dentro de F01–F32/II.11 y seguimiento autorizado. Las correcciones tocan F12–F15; sin SQL nuevo, chat, workers ni escrituras publicitarias. |
| 2 | Criterios | PASS | Matrices abajo; se leyeron las aserciones. Las suites completas y las regresiones de los tres hallazgos pasan. |
| 3 | Las pruebas detectan roturas | PASS | Tres mutaciones: precisión, duplicados entre páginas y retorno prematuro de lectura. Cada una produjo fallo de aserción, con restauración binaria comprobada. |
| 4 | Reejecución | PASS | verify: 726; pgTAP: 727; app: 75 pasan/7 omitidas. Coinciden con el último control de la sesión; se capturó el conteo SQL que allí faltaba. |
| 5 | Seguridad y reglas | PASS | K01 servidor, RLS/ACL, errores redactados y módulos server-only. Sin secretos encontrados ni service_role en runtime modificado. Únicamente 0016 nueva frente a la base; ninguna migración aplicada modificada. |
| 6 | Calidad funcional | PASS | Lecturas paginadas hasta total exacto, rechazo ante errores/inconsistencia/cota, duplicados rechazados antes de incorporar página, reemplazo real en vuelo cubierto. Tipos estrictos; sin any/TODO en runtime cambiado. |
| 7 | Evidencia | PASS | Sesión registra RED/GREEN, corrección de un fixture, límites y segunda sincronización real. H-E1-198/199/200 enlazan los hallazgos originales. G-SYNC permanece sin aprobar. |
| 8 | Contradicciones | PASS | Sin contradicciones operativas nuevas con Parte I, spec, plan o AGENTS. Se conserva la posibilidad de reutilizar metadata del mismo run con su instante original, expresamente prevista por la spec. |

## Comprobación de los hallazgos anteriores

| ID anterior | Comprobación independiente | Resultado |
|---|---|---|
| R-01 / H-E1-198 | `rpcAllRows` usa count exact y range, avanza por filas efectivamente recibidas y solo devuelve al alcanzar el total. Las pruebas verifican 2500 entidades simuladas, servidor con corte menor, cero filas, total cambiante/ausente, error posterior, fila inválida y cota de 20000. T-02 real lee **1120 filas únicas**, incluida la última fecha, después de una sincronización completa. | **Subsanado.** |
| R-02 / H-E1-199 | `loadEdge` conserva IDs vistos durante toda esa lectura; detecta repetición antes de validar/incorporar la página. Dos casos prueban metadata idéntica y distinta. Otro prueba que releer un edge fallido en otro nivel no es, por sí solo, duplicación dentro de una lectura. La mutación que quita la guarda hace fallar ambos negativos. | **Subsanado en su caso original.** |
| R-03 / H-E1-200 | T-23 crea y consume un intento OAuth de reauth y ejecuta `replaceCredential` con el rol real durante adsets y durante Insights. Afirma conexion_cambio, ausencia de llamadas siguientes, generación nueva, token nuevo conservado, resumen sin publicación tardía y cobertura sin filas nuevas. Ambos casos pasan contra el desechable. No simula el reemplazo mediante UPDATE administrativo. | **Subsanado.** El caso prueba el reemplazo real de persistencia; el transporte OAuth completo conserva sus pruebas propias. |

## Matriz de criterios operativos

En cada fila se comprobó la aserción, no solo el nombre del caso. Los grupos T-NN corresponden a la tabla de la spec.

| Criterio | Prueba | Aserción verifica el criterio (sí/no) | Resultado |
|---|---|---|---|
| C-01 | T-01/02/35/36; vista JWT | Sí: ajena sin datos, refs adulteradas y tenant servidor | PASS |
| C-02 | T-01/31; pgTAP 09/13 | Sí: siete tablas, ACL/RLS, FKs y lecturas invoker | PASS |
| C-03 | T-03/04 | Sí: único inicio, conflicto, reintento sin renovar y desplazamiento | PASS |
| C-04 | T-04/05/22 | Sí: locks, reloj real, lease y posesión/generación | PASS |
| C-05 | T-06/20/38 | Sí: rollback y comparación de petición idempotente | PASS |
| C-06 | T-07/08/35/38 | Sí: snapshots/resultados por nivel, parcial y not_attempted | PASS |
| C-07 | T-02/08/09/10/27 | Sí: ausencia/null/cero; lectura de 1120 filas únicas | PASS |
| C-08 | T-10/11/12 | Sí: inmutabilidad y metadata histórica preservada | PASS |
| C-09 | T-13/14 | Sí: exactitud Graph → SQL → Data API → Zod y negativos numéricos | PASS |
| C-10 | T-15/16/37 | Sí: DST, flag persistido, reloj y captura congelada | PASS |
| C-11 | T-16/17/36/37 | Sí: cuatro niveles, fechas locales y parámetros | PASS |
| C-12 | T-17/18 y regresiones de metadata | Sí: agotamiento, límites/cursor, faltantes y duplicados entre páginas | PASS |
| C-13 | T-19/20/33/34 | Sí: retry, timeout de fetch/body, reserva y Q-04; límite desplegado acreditado en la sesión | PASS con límites externos declarados |
| C-14 | T-21/22/38 | Sí: errores persistidos, reauth guardado y limpieza solo completed | PASS |
| C-15 | T-03/05/23 | Sí: desconexión/purga y reemplazo real durante dos tipos de petición | PASS |
| C-16 | T-11/23/24; pgTAP 10 | Sí: purga repetible y cascada completa | PASS |
| C-17 | T-25/26; pgTAP 09 | Sí: catálogo de 16 operaciones, ACL aislada, atributos y errores redactados | PASS |
| C-18 | T-27/28/35; lectura paginada | Sí: acción, pendiente, selección validada, estado fiel y lectura completa | PASS |
| C-19 | T-18/27/29; búsqueda por patrón | Sí: logs cerrados, DTO opaco, escape y descarte de next | PASS |
| C-20 | T-12/14/30/31/36 | Sí: precisión, tipos/variantes separados y atribución conforme al contrato | PASS; H-E1-194 conserva su límite externo |
| C-21 | T-32, meta-lifecycle | Sí: listado paginado conserva sus límites | PASS |
| C-22 | T-33/34 y controles de sesión | Sí: controles por etapa, compatibilidad y ensayo real documentados | PASS de revisión; G-SYNC pendiente |

## Matriz de criterios heredados y transversales

| Criterio | Prueba | Aserción verifica el criterio (sí/no) | Resultado |
|---|---|---|---|
| CA-39 | T-21/22/38 | Sí: clases fijas, persistencia y transiciones autorizadas | PASS |
| CA-41 | T-01/11/12/17/31 | Sí: snapshots/metadata tipados e inmutables, sin crudo | PASS |
| CA-42 | T-07/08/17/38 | Sí: cuatro completos y resultado parcial independiente | PASS |
| CA-43 | T-08/09/10/27 | Sí: cobertura, ausencia/null/cero y sustitución completa | PASS |
| CA-43b | T-15/16/37 | Sí: tiempo local y captura parcial persistida | PASS |
| CA-44 | T-12/13/31 | Sí: unidad, moneda, atribución y procedencia capturadas | PASS |
| CA-44b | T-13/14/31 | Sí: cadenas exactas incluso fuera de precisión de number | PASS |
| CA-45 | T-06/07/10/20 | Sí: idempotencia y conservación de cobertura ante fallo | PASS |
| CA-46 | T-02/09/27/35 y paginación nueva | Sí: aislamiento, referencias opacas y serie completa | PASS |
| CA-47 | T-17/18 | Sí: completitud por agotamiento y metadata requerida | PASS |
| CA-47b | T-16/34 | Sí: 28 días y ausencia de promesa de congelamiento | PASS |
| CA-56 | T-18/19/20/34 | Sí: límites técnicos y duración bajo el hosting efectivo documentado | PASS |
| CA-57 | T-19/20 | Sí: dos retry temporales/transporte, espera y no retry de rate/auth | PASS |
| CA-58 | T-03/04/35 | Sí: ejecución única, lease y desplazamiento | PASS |
| CA-59 | T-04/05/22/23 | Sí: publicación/fallo/reauth bajo posesión y generación | PASS |
| CA-60 | T-32 | Sí: regresión de paginación de cuentas | PASS |
| CA-14/17/19–22; DEC-03/04 | T-01/02/25/26/31; pgTAP 09 | Sí: privilegios y fronteras servidor/base | PASS |
| CA-26/40; CB-02 | T-18/27/29 y patrones | Sí: errores/logs/DTO redactados y fixtures sintéticos | PASS |
| CA-38/38c/67/68; DEC-09 | T-11/23/24; pgTAP 10 | Sí: purga, cascadas y escrituras en vuelo rechazadas | PASS |
| DEC-05/22 | T-07 a T-20; T-27/30/31 | Sí: catálogo, cobertura, metadata y precisión | PASS |
| CB-01 | verify, policies y app completos | Sí | PASS |
| CB-03/04 | Diff migraciones y guardas del desechable | Sí: sin migraciones existentes modificadas ni suites contra app | PASS |
| CB-05/06 | Sesión, salidas y omisiones identificadas | Sí: resultados reales, sin omitir casos requeridos | PASS |

## Roturas controladas

Las copias originales se guardaron fuera del repositorio, en `C:/Users/Simon/.codex/visualizations/2026/11/08/01a1bd1c-846b-7cd2-b41e-54d87b5a7062/m16c-review-2/`. Cada mutación fue aislada y la restauración se ejecutó en `finally`, desde esa copia, con comparación binaria `Buffer.equals` equivalente a cmp. No se alteró SQL ni se ejecutó una suite remota sobre código mutado.

| Criterio | Rotura | Prueba que la detectó | Restaurado (cmp) |
|---|---|---|---|
| C-09 / CA-44b | `decimal` devuelve String(Number(value)) | T-14 conserva dígitos: esperaba `00.50`, recibió `0.5`; exit 1; 1 falla/15 pasan | Sí |
| C-12 / CA-42 | Omitir rechazo de IDs repetidos entre páginas | Metadata idéntica y distinta repetida: ambos negativos fallan al recibir complete; exit 1; 2 fallan | Sí |
| C-18 / CA-46 | `rpcAllRows` retorna tras la primera página | Recorre todas las páginas: esperaba 2500 filas, recibió 1000; exit 1; 1 falla | Sí |

Comandos ejecutados para cada mutación, con el archivo restaurado entre ellos:

```text
node node_modules/vitest/vitest.mjs run --project unit tests/unit/meta-insights.test.ts -t M16c-T-14
node node_modules/vitest/vitest.mjs run --project unit tests/unit/meta-insights.test.ts -t repetida.entre.p.ginas
node node_modules/vitest/vitest.mjs run --project unit tests/unit/meta-insights.test.ts -t recorre.todas.las.p.ginas
```

SHA-256 antes/después de restaurar:

- insights.ts: `aa25913eac34e105114e86574cf26750e5c2eee2a348d61e8feb226030e7c3d2`.
- entities.ts: `cee95b33b84f456a4af05f1073160f1c737f0017d01449f2987a64fa38f3b627`.

Después se ejecutó `npm run test:unit -- tests/unit/meta-insights.test.ts` sin mutaciones: exit 0, **114/114**. Las omisiones deliberadas de filtros -t no se contaron como suites completas.

## Comandos reejecutados y comparación con la sesión

| Comando | Resultado real | Comparación |
|---|---|---|
| `npm run verify` | Exit 0; lint, typegen, typecheck, **28 archivos/726 pruebas**, build Turbopack completo, 13 páginas | Coincide con GREEN y control de las correcciones |
| `npm run db:check:test` | Exit 0; desechable y rol de C verificados | Coincide |
| `npm run test:policies` | Exit 0; **14 archivos/15 ejecuciones/727 aserciones**, 0 problemas. 09: 69 en cada ejecución; 10: 28; 13: 214 | Captura el conteo no registrado en el último control; coincide con la base SQL sin cambios |
| `npm run test:app -- --reporter=verbose` | Exit 0; **11 archivos, 75 pasan/7 omitidas (82)**; 439,46 s | Coincide con GREEN y control de las correcciones |
| `npm run test:unit -- tests/unit/meta-insights.test.ts`, restaurado | Exit 0; **114 pasan** | Coincide con el incremento registrado por las correcciones |
| `git diff --check` | Exit 0 | Sin errores de whitespace |
| Diff migraciones a27f727…HEAD | Solo A `0016_meta_insights.sql` | 0001–0015 intactas; 0016 sin cambios desde la revisión anterior |
| Diff de spec, plan, SQL y pruebas SQL frente a 235e5c1 | Exit 0 | Contratos y persistencia conservados |

Las siete omisiones de app son las mismas de la sesión: tres opt-in de `email-flows.test.ts`, sin activación explícita para consumir correo, y cuatro centinelas de configuración en concurrency, onboarding, integrations-data-api e isolation que se omiten cuando el desechable está disponible. Ningún caso requerido de M16c se omitió por falta de configuración. Los afterAll verifican limpieza de los fixtures creados.

Búsqueda por patrón sobre el cambio integral: `act_[0-9]{6,}`, cabeceras de clave privada, claves de proveedor y JWT. Solo el patrón de cuenta coincidió, en los fixtures explícitamente sintéticos de pgTAP 10 y 13. No se copiaron coincidencias ni valores. Sin service_role, any o TODO en el runtime cambiado. No se abrió ni mostró `.env.local`; los comandos prescritos usan sus cargadores existentes de configuración. No se ejecutó db:push de ningún tipo, ni se accedió a app, Meta o Vercel en esta revisión.

## Ensayo exploratorio que no constituye hallazgo

Se ejecutaron dos aserciones adicionales fuera del repositorio sobre la recuperación de un edge parcialmente fallido. Ambas fallaron: esperaban descartar metadata obtenida en una página válida anterior del mismo run y, en un caso, pasar a known=false después de un inventario posterior vacío.

Al contrastarlas con el contrato, **esa expectativa no está exigida**: la spec, en Instante de captura por nivel, permite reutilizar metadata de otro nivel del mismo run conservando su metadata_fetched_at original. En los escenarios se había obtenido y validado esa metadata; el código conserva su procedencia. La recuperación observada no demuestra por sí sola que la metadata sea inventada ni que deba descartarse. No se considera un fallo de C-12/C-20 ni se impone una política nueva de invalidación de caché. Tampoco se usa este ensayo para acreditar un criterio obligatorio.

Comando: `npx vitest run --config <directorio temporal>/vitest.config.mts -t REVIEW --reporter=dot`; exit 1, dos aserciones exploratorias fallidas y 114 casos no seleccionados. No se alteró el código de implementación para ejecutarlo. Se rectifica aquí la interpretación provisional comunicada durante la revisión.

## Hallazgos

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| — | — | — | **Ningún hallazgo nuevo accionable** | R-01/R-02/R-03 comprobados como subsanados; suites y mutaciones anteriores | No corresponde |

No se cierran H-E1-198/199/200 en HALLAZGOS desde esta revisión: ese documento mantiene su cierre asociado a G-SYNC. Este informe no lo modifica.

## Evidencia externa y pendientes

La segunda sincronización real está registrada sobre `718970a`, cuyo código coincide con la implementación revisada: cuatro niveles completos, cero filas y resultado general completa; 3683 ms sumando los niveles. El usuario informó que la vista Anuncios/Todas llega a la última fecha. No se volvió a contar el total de producción; el conteo exacto se verificó en el desechable. No se repitió una sincronización real desde el asistente.

Se conservan los límites de D-M16c-02: cero filas no valida campos/tipos ni acredita valores cero. H-E1-189/H-E1-194 siguen sin filas reales para contrastar; H-08 no acredita una consulta ids real. El límite efectivo de 300 s fue acreditado por el usuario en la sesión anterior; no se midió holgura con actividad. H-E1-197 mantiene causa sin confirmar. Ninguno se presenta como resuelto por esta revisión.

**Pendientes del usuario:** solicitar `$qa-review M16c` y, si corresponde después de QA, decidir visiblemente sobre G-SYNC. No se requiere nueva migración ni repetir pruebas de cuenta externa para emitir este veredicto. M25a.1 permanece sin habilitar.

## Preservación

La foto inicial estaba limpia. Ambos archivos mutados se restauraron byte por byte y la suite unitaria posterior pasó. La única escritura persistente dentro de PRAXA es este informe; sin correcciones, commit, push ni publicación. La comparación final de status dio únicamente `?? docs/FASES/FASE1/M16c/revisiones/implementation-review-2.md`; ambos cmp dieron true, el diff de trabajo de implementación quedó vacío y los hashes del estado excluyendo revisiones conservaron los valores de la cabecera.
