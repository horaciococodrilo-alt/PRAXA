# Auditoría de spec M16c — 3

**Fecha:** 2026-11-07  
**Commit base:** `a27f727`  
**Hash de contenido de la spec, excluyendo solo la línea de estado:** `3110e93c4645e0726fe9c9cbd7a9f0d51bfd96a9`  
**Estado auditado:** BORRADOR.

Se revisa M16c por continuidad del pedido y del trabajo sobre esta spec. Se toma como fuente la ruta ampliada autorizada por el usuario que está en el árbol de trabajo, todavía sin commit; no se sustituye por la versión anterior de HEAD. Los cambios preexistentes se preservan.

## Veredicto

**APROBABLE — 18 PASS, 0 FAIL.** No se detectaron contradicciones ni hallazgos que requieran corrección en el contrato común auditado. Los cinco puntos técnicos de la auditoría 2 están resueltos en la spec y `npm run verify` completó con exit 0 en esta auditoría.

La aprobación corresponde al **conjunto M16c**. No aprueba las specs/planes futuros de M16c.1/.2/.3, no demuestra sus implementaciones y no cierra G-SYNC. La ruta exige revisar y aprobar cada corte antes de ejecutarlo.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | Ficha `meta_first/plan.md:294-307`; `M16c/spec.md:209-230`: los 16 CA heredados están incluidos, contando CA-44b una vez. |
| 2 | Alcance | PASS | `meta_first/plan.md:310-319,681-699`; `M16c/spec.md:30-40,236-257`: los tres cortes cubren el catálogo ampliado, con el chat como consumidor posterior. Los criterios operativos trazan a CA, DEC o trampas. |
| 3 | Coherencia con spec general | PASS | Matriz de §7 y §11/§12 de `meta_first/spec.md`; `M16c/spec.md:98-102,136-152`: resumen seguro en la conexión ya legible; RPC invoker sin acceso a runs ni snapshots ocultos. No amplía grants internos. El consumidor recibe precisión, entidades, atribución y procedencia. |
| 4 | Decisiones | PASS | Sección «Decisiones de la microfase»: D-M16c-01 atribuye al usuario el alcance aprobado y remite a DEC-22. No convierte aprobación de alcance en aprobación técnica de esta spec. |
| 5 | Trampas | PASS | II.11 de la ruta y `M16c/spec.md:326-339`: ausencia/cero, no usar next, completitud independiente, posesión/lease, exactitud textual, no sumar jerarquías/tasas/atribuciones y metadata capturada. |
| 6 | Intervenciones y acciones reservadas | PASS | Parte I y III.2 de la ruta; `M16c/spec.md:314-324`: db:push:test, push, despliegue y db:push en app al usuario, cada uno con comprobación posterior; comunicación ampliada antes del ensayo real. |
| 7 | Verificación | PASS | III.3 de la ruta; `M16c/spec.md:306-312`: verify, policies y app por corte, CB-06 y declaración de no ejecutadas; filtros TDD no sustituyen suites completas. |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:24,28-34`; sesión `meta_first/sesiones/M16.2.md:314,341-343`: G-VR01 aprobado y trabajo de dependencia presente en la base. Gates .1/.2 asignados antes de sus sucesores; no se exige que estén aprobados para auditar el conjunto. |
| 9 | Lo entregado de verdad | PASS | `M16c/spec.md:47-64,72,144`; código de accounts/probe conserva act_ con hasta 60 dígitos; select cerrado de readConnectionRecord no cambia. Allowlist, lifecycle y pgTAP se adaptan en los archivos autorizados, sin inventar una API existente. |
| 10 | Pendientes y hallazgos | PASS | `M16c/spec.md:132-134,347-365`: H-E1-22/27/35/36 tienen solución y corte; campos reales/Q-04, actividad y comunicación con dueño tienen verificación posterior; H-E1-187 resuelto documentalmente; H-E1-188 explícitamente fuera de alcance. |
| 11 | Contexto real | PASS | Referencias archivo:línea de `M16c/spec.md:47-64` verificadas: existen y respaldan las afirmaciones sobre puntero, adaptador, ciclo de vida, repositorios, cliente, cuentas, acciones, pgTAP, runner y evidencia de VR-01. Ninguna referencia falsa detectada. |
| 12 | Archivos previstos | PASS | `M16c/spec.md:178-205` contra Parte I/II.11: siete tablas y columna de resumen dentro de la migración nueva autorizada, funciones, adaptador, lifecycle/pruebas, 09/10/13/runner, extractor/entities, UI/component y transversales. Specs/planes/sesiones/revisiones de cortes autorizados por pipeline y seguimiento. |
| 13 | Diseño suficiente | PASS | `M16c/spec.md:68-176`: normalización, esquema, summary, firmas/casts propuestos, resultados, errores, transacciones, lecturas y orquestación concretados. La clasificación por progreso, el inicio de captura y las fuentes legibles de estado/límites ya son determinísticos. Los detalles propios de cada corte se formalizan en sus specs según la división obligatoria de la ruta. |
| 14 | Verificable | PASS | `M16c/spec.md:265-304`: los 22 criterios tienen casos entre las 38 T, scripts reales y resultados esperados, negativos y bordes. T-35 a T-38 cubren las correcciones, y T-14 especifica aceptación decimal equivalente en Zod y SQL. |
| 15 | Sin nada abierto | PASS | `M16c/spec.md:347-361`: ninguna decisión de alcance pendiente; hipótesis con método/momento de verificación y salida definida. Q-04 se mide en .3 según la ruta, sin fabricar valores ni reducir el gate si la cuenta sigue vacía. |
| 16 | Ejecutable ahora | PASS | `npm run verify` con permisos ampliados de red: **exit 0**, lint/typegen/typecheck, 26 archivos con **595 pruebas pasadas**, build completo y **13 páginas estáticas generadas**. Scripts y variables necesarias por nombre existen en package.json/.env.example; no se abrió .env.local. Intervenciones previas tienen paso asignado. |
| 17 | Consistencia interna | PASS | `M16c/spec.md:98-102,124-150,158,172,299-304`: lectura desde proyección permitida, capture timestamp por nivel, result por validated_pages y UI basada en resumen coinciden con criterios/casos. Fuera de alcance no excluye obligaciones. |
| 18 | Reglas no negociables | PASS | `M16c/spec.md:40,72-74,86,112-134,162,176,306-324`: tenant del servidor, migración nueva, pruebas desechables y datos sintéticos, credencial por worker_api, secretos fuera de DTO/logs y errores redactados. |

## Contradicciones

Ninguna.

## Hallazgos

| ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| — | — | — | Ninguno | Checklist y comprobación de los puntos de auditoría 2 | — | No |

## Comprobación de la auditoría anterior

| Hallazgo de spec-audit-2 | Resultado de esta revisión | Evidencia |
|---|---|---|
| A-01, lectura sin fuente autorizada | Resuelto en el contrato | `M16c/spec.md:98-102,140-144,172`: meta_sync_summary en conexión, máximo legible y resultados por nivel; sin leer runs ni agregar grants. T-35 incluye primer fallo sin cobertura, parcial, no intentados y vencimiento. |
| A-02, ID de cuenta | Resuelto en el contrato | `M16c/spec.md:72`: forma canónica act_, límite de 60 dígitos, normalización de bare account_id, comparación SQL y distinción de IDs de otros niveles; T-36. Compatible con `accounts.ts:47` y `probe.ts:26`. |
| A-03, patrón decimal | Resuelto en el contrato | `M16c/spec.md:74`: `[.]` sin escape ambiguo, literales TS/SQL y casos positivos/negativos. Comprobación local del patrón de la spec con los ejemplos sintéticos: aceptación/rechazo esperados; T-14 y réplica pgTAP. |
| A-04, instante de captura | Resuelto en el contrato | `M16c/spec.md:148-150`: inicio por nivel conservado en páginas/retries, validación SQL y reloj monotónico separado; T-37 cruza medianoche y comprueba fechas fuera de intervalo, con fixtures desechables. |
| A-05, incomplete frente a failed | Resuelto en el contrato | `M16c/spec.md:124-130`: contadores explícitos, regla por páginas validadas, página vacía válida y guardas de razón/stop; T-38 exige los estados de snapshot/run/summary y no inventar snapshots de niveles no intentados. |
| A-06, verify incompleto | Verificación completada ahora | Comando npm run verify con exit 0, incluidos build y generación de 13 páginas estáticas. La anotación de A-06 en `M16c/spec.md:312` describe el resultado anterior a esta auditoría; la evidencia presente lo supera sin editar la spec. No se afirma un diagnóstico retrospectivo del motivo exacto de las interrupciones previas. |

## Evidencia de ejecución y límites

- Se verificó BORRADOR y que el siguiente número disponible era 3. El hash se calculó con los bytes de la spec excluyendo su línea de estado, por git hash-object --stdin.
- Ruta, estado, hallazgos, seguridad y arquitectura mantienen el mismo contenido que en la revisión anterior; se comprobaron sus huellas y se recontrastaron los contratos relevantes con la spec corregida. La evidencia de la dependencia confirma G-VR01 cerrado con validación de campos/Q-04 diferida, no resuelta.
- `npm run verify` se ejecutó una vez con permisos ampliados de red, después de dos auditorías con build sin resultado. No se editaron fuentes, no se sustituyó el build por un mock y no se omitieron pasos. Resultado final exit 0. El aviso de jsdom sobre navegación no produjo fallo de pruebas.
- Los comandos de los 38 casos futuros existen como scripts; todos los 22 criterios tienen referencia a pruebas. Las referencias de archivos existentes y los destinos de los enlaces locales nuevos son válidos. Las suites y módulos nuevos se reconocen como entregables futuros, no como implementación presente.
- No se ejecutaron policies ni app en esta auditoría: se evalúa la spec y se verifica la base con verify. Su ejecución íntegra sigue siendo obligatoria en cada corte. No se accedió a la cuenta de Meta ni se validaron campos reales, atribución, actividad, configuración de Vercel o Q-04; están correctamente asignados a pasos de implementación.
- Solo se escribe este informe. La spec y los informes anteriores conservan su contenido. Ningún gate ni estado de aprobación se actualiza en nombre del usuario.

## Observación de tamaño

La división M16c.1/.2/.3 ya forma parte de la ruta. M16c.1 concentra siete tablas, columna de resumen, funciones, ACL, adapter/lifecycle y pgTAP histórico: su plan debe comprobar el límite de ocho horas y, si hace falta, aplicar la subdivisión que la ruta ya permite antes de ejecutar. Esta observación no altera el veredicto ni autoriza iniciar más de un corte.

## Siguiente paso

El usuario puede aprobar esta spec común y pasar su estado a APROBADA. Después se continúa la preparación y planificación del primer corte: spec propia de M16c.1, auditoría y plan aprobado según la ruta. La aprobación del conjunto no sustituye ese paso ni permite implementar M16c.2 o M16c.3 antes de sus dependencias.
