# Auditoría de spec M16c — 2

**Fecha:** 2026-11-07  
**Commit base:** `a27f727`  
**Hash de contenido de la spec, excluyendo solo la línea de estado:** `9275408996a12ed87741a70134d585529c31da89`  
**Estado auditado:** BORRADOR.

Se audita la enmienda vigente del árbol de trabajo, autorizada por el usuario, junto con el código de la base. La enmienda documental aún no está en HEAD. M16c es un conjunto de tres cortes; no se considera defecto que los gates futuros de .2/.3 estén pendientes, ya que la ruta asigna su aprobación antes de ejecutar cada corte.

## Veredicto

**REQUIERE CAMBIOS: 12 PASS y 6 FAIL.** El contrato de lectura requiere datos ocultos que no están en su proyección pública. Además, hay ambigüedades de normalización del ID de cuenta, expresión decimal, instante de captura y clasificación del resultado de fallo. La verificación completa de la base tampoco concluyó. Hallazgos: **2 de severidad alta y 4 de severidad media**. No se modifica la spec durante esta auditoría.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | Ficha `meta_first/plan.md:294-307`; heredados `M16c/spec.md:187-204`: incluye los 16 CA, sin duplicar CA-44b. |
| 2 | Alcance | PASS | `meta_first/plan.md:310-319,681-699`; `M16c/spec.md:30-40,209-232`: cuatro niveles y tres cortes; el chat se limita a su contrato consumidor. |
| 3 | Coherencia con spec general | FAIL | Matriz de §7 de `meta_first/spec.md:174-178` y CA-42/46 (`:351,356`) frente a `M16c/spec.md:93-97,123,147-149`: la lectura invoker solo puede ver cobertura, pero depende de límites de un run y debe presentar resultados por nivel no publicados allí. A-01. |
| 4 | Decisiones | PASS | D-M16c-01, sección «Decisiones de la microfase», registra al usuario y remite a DEC-22 de la ruta. La aprobación de alcance no se presenta como aprobación técnica de esta spec. |
| 5 | Trampas | PASS | `meta_first/plan.md:699`; `M16c/spec.md:299-311`: presencia/cero, next, completitud, lease/posesión, precisión, jerarquía, atribución y metadata temporal. |
| 6 | Intervenciones y acciones reservadas | PASS | Parte I y III.2 de la ruta; `M16c/spec.md:285-295`: migraciones de test/app, push y despliegue reservados, con verificación; comunicación al dueño antes de datos ampliados. |
| 7 | Verificación | PASS | III.3 de la ruta; `M16c/spec.md:275-281`: verify + policies + app por corte, CB-06 explícito; filtros TDD no sustituyen cierre. |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:24,28-34`; sesión `meta_first/sesiones/M16.2.md:314,341-343`: G-VR01 aprobado y código de OAuth/lifecycle en base. G-SYNC-DB/EXTRACT son dependencias futuras asignadas, no aprobaciones presumidas. |
| 9 | Lo entregado de verdad | FAIL | `M16c/spec.md:69,75` exige ID decimal y raíz coincidente; `meta/accounts.ts:47`, `meta/probe.ts:26` y confirmación de `0012_integrations.sql:933-936` usan/persisten cuenta `act_…`. No define transformación y comparación entre ambas formas. A-02. |
| 10 | Pendientes y hallazgos | PASS | `M16c/spec.md:117-119,317-329,333`: H-E1-22/27/35/36 concretados; campos/Q-04 y comunicación real con paso previsto; H-E1-187 resuelto documentalmente; H-E1-188 fuera de alcance. |
| 11 | Contexto real | PASS | Referencias de `M16c/spec.md:47-63` existen y concuerdan: allowlist/casts, rama unchanged, mark_needs_reauth, purga, repositorios, cliente, pgTAP y runner. La diferencia de formato de cuenta es un defecto de diseño, no una referencia falsa de la tabla. |
| 12 | Archivos previstos | PASS | `M16c/spec.md:159-177` contra II.11: adaptador, lifecycle/pruebas, 09/10/13, runner, extractor/entities, UI/component y transversales autorizados. Specs/planes/revisiones/sesiones de cortes autorizados por Parte I y seguimiento. No exige editar client.ts sin enmienda. |
| 13 | Diseño suficiente | FAIL | A-01 a A-05: fuente legible de límite/resultados, normalización de cuenta, representación de regex, captura temporal y regla incomplete/failed requieren decisiones de implementación que aún no están fijadas. |
| 14 | Verificable | FAIL | Los 22 C tienen referencia entre las 34 T y sus scripts existen; sin embargo T-15 no distingue captura al inicio frente al fin de una extracción que cruza medianoche, ni se exige una prueba del resultado público de una ejecución fallida sin cobertura nueva o de las reglas incomplete/failed. `M16c/spec.md:254,246-247,266,273`. A-01/A-04/A-05. |
| 15 | Sin nada abierto | PASS | «Preguntas abiertas» no deja decisiones de producto. H-01 a H-06 tienen paso/método de verificación. Q-04 se mide en .3 por mandato expreso de la ruta, no se exige retrospectivamente antes de .1. Las ambigüedades detectadas aquí son correcciones técnicas. |
| 16 | Ejecutable ahora | FAIL | `npm run verify`: lint, typegen, typecheck y 595/595 pruebas de 26 archivos pasaron. Next 16.4.2 quedó en «Creating an optimized production build ...» sin resultado durante aproximadamente cinco minutos; se interrumpió, exit 1 por interrupción. No se atribuye la causa a código ni a red sin diagnóstico. Scripts y nombres de variables comprobados en package.json y .env.example; no se leyó .env.local. A-06. |
| 17 | Consistencia interna | FAIL | `M16c/spec.md:95-97,123` prohíbe leer runs y luego usa el run como fuente del máximo. El patrón decimal de `:71` no acepta un decimal si se interpreta como expresión literal, aunque T-13/14 exige aceptarlos. Captura y resultado de fallo no tienen semántica única. |
| 18 | Reglas no negociables | PASS | `M16c/spec.md:40,83,101,117,139,151,275-295`: K01 servidor, migración nueva, datos sintéticos, solo desechable, credencial por worker_api, errores/logs redactados. No se ordena abrir grants internos para resolver A-01. |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| La RPC invoker obtiene el máximo desde el «run visible» (`M16c/spec.md:123`) | Matriz de la ruta `meta_first/spec.md:174-178` y diseño propio `M16c/spec.md:83,95-97` | El run no es legible para authenticated. La cobertura pública de `:93` no contiene maxWindowDays. | Persistir el límite necesario en una proyección pública autorizada o definir un límite de lectura que no dependa de tablas ocultas. Mantener invoker/RLS. |
| Mostrar resultado de la ejecución por nivel y releer base al volver (`M16c/spec.md:147-149`) | Solo cobertura completa legible, conservada intacta ante fallo (`M16c/spec.md:93,109`) y CA-42 de la ruta (`meta_first/spec.md:351`) | Un primer intento fallido no crea cobertura; después de cobertura previa, el fallo no la cambia. Las lecturas propuestas no permiten diferenciar fallo reciente, not_attempted y ausencia de intento. | Definir una proyección pública segura del último resultado por nivel y su consulta; podría usar columnas nuevas de la conexión ya legible, sin exponer run/token ni depender de query sync. Probar primer fallo y parcial con cobertura previa. |

## Hallazgos

| ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | alta | Lecturas, cobertura y UI | Falta una fuente legible para maxWindowDays y para el último resultado por nivel. El contrato se contradice con su propia matriz de lectura. | `M16c/spec.md:93-97,109,123,147-149`; `meta_first/spec.md:174-178,351`. | Concretar la proyección autorizada, columnas/tipos, actualización transaccional, RPC y casos de fallo inicial, nivel no intentado y parcial conservando cobertura. No conceder SELECT al run ni cambiar la matriz silenciosamente. | No si se resuelve dentro de los objetos y archivos autorizados; en caso contrario registrar cambio de ruta |
| A-02 | media | Identidad/metadata y payload | Se exige ID decimal de 1–32 caracteres y coincidencia de la raíz con la conexión, que guarda el formato act_… de hasta 60 dígitos. El implementador debe inventar normalización, longitud y comparación. | `M16c/spec.md:69,75,79`; `src/modules/integrations/meta/accounts.ts:47`; `meta/probe.ts:26`; `0012_integrations.sql:933-936`. | Especificar forma canónica de cuenta frente a IDs de entidades, dónde se quita/reincorpora prefijo y cómo valida SQL la raíz. Conservar compatibilidad con la conexión existente; prueba con cuenta entregada por M16.2. | No |
| A-03 | media | Validación decimal | El patrón escrito contiene dos barras antes del punto. Interpretado como regex directo no reconoce el decimal prometido por los tests; no se declara que sea una cadena escapada para constructor. | `M16c/spec.md:71,252-253`. Comprobación local: compilar literalmente el patrón del Markdown acepta `12` y rechaza el decimal sintético `12.34`. | Escribir el regex sin ambigüedad, indicando literal frente a cadena escapada, y mantener ejemplos positivos/negativos equivalentes en Zod y SQL. | No |
| A-04 | media | Captura temporal | No se fija qué instante representa fetched_at por nivel ni cómo lo valida la base. Se calcula captured_before_day_end con ese dato y se exige que sea un hecho persistido. | `M16c/spec.md:89,108,123-125,133`; T-15 en `:254`; CA-43b de la ruta. | Definir un instante único de captura por nivel, su relación con inicio de run/metadata/paginación y validación SQL. Agregar caso que cruce medianoche durante la extracción, sin resincronizar. | No |
| A-05 | media | Fallo SQL y estados | fail_sync_run guarda snapshot incomplete o failed sin una regla para elegir; no recibe resultado/razón diferenciadora y los tests no fijan las dos salidas. | `M16c/spec.md:89,109,113`; T-07/19/22 (`:246,258,261`). | Fijar el mapeo determinístico entre razón/progreso y result, validarlo en SQL y probarlo para fallo antes de obtener datos, página intermedia y límite global. Mantener cobertura previa y no crear snapshot de niveles no intentados. | No |
| A-06 | alta | Precondición de ejecución | La verificación de la base no obtuvo un resultado completo exitoso: la compilación de Next quedó sin salida final y se interrumpió. | Salida de npm run verify: lint/tipos y 26 archivos con 595 pruebas pasaron; build no concluyó en esta auditoría. | Diagnosticar la compilación y completar npm run verify con exit 0 antes de declarar la base ejecutable. No asignarlo como defecto del futuro código M16c sin evidencia. | No, salvo que el diagnóstico revele intervención externa necesaria |

## Evidencia y límites de la auditoría

- Spec BORRADOR existente; siguiente informe libre: spec-audit-2.md. Hash calculado con bytes de la spec excluyendo la línea de estado y `git hash-object --stdin`.
- Se contrastaron ruta, estado, seguridad, hallazgos, evidencia de dependencia y contratos existentes. No se consultó la cuenta real ni se hicieron pruebas SQL/app contra servicios externos.
- Scripts de los 34 casos presentes en package.json; cada uno de los 22 criterios aparece en casos. Las rutas de suites nuevas se tratan como entregables propuestos, no como archivos ya existentes.
- Variables necesarias identificadas por nombre en .env.example. La ejecución normal de Next anuncia que carga su entorno; el asistente no abre ni imprime .env.local.
- La prueba literal del patrón decimal es un diagnóstico documental, no una implementación ni una prueba añadida al repositorio.
- `npm run verify` se ejecutó una vez. La compilación se interrumpió tras aproximadamente cinco minutos sin resultado final; no se presenta como fallo de compilador acreditado ni como build aprobado. No se repitieron suites ni se modificó código para esta auditoría.

## Tamaño del corte (observación sin efecto en el veredicto)

La división en tres cortes ya es obligatoria. M16c.1 todavía reúne siete tablas, funciones, lectura, ACL, adapter, lifecycle y pgTAP histórico; su plan debe demostrar que cabe en ocho horas. Si no cabe, aplicar la subdivisión prevista en la ruta antes de ejecutar, manteniendo todos los CA y sin habilitar sucesores antes de sus gates.

## Siguiente paso

Corregir técnicamente la spec y auditarla de nuevo. A-01 debe resolverse dentro de la matriz y archivos autorizados; solo una solución que cambie esa frontera requiere decisión de ruta. No hace falta volver a aprobar el alcance de cuatro niveles ya autorizado. No se aprueba la spec ni se inicia M16c.1 con este informe.
