# Auditoría de spec M16c — 1

**Fecha:** 2026-11-06  
**Commit base:** `a27f727`  
**Hash de contenido de la spec (sin `**Estado:**`):** `88868c434a5c3fa6725ea0d73b38c79479a750b6`  
**Spec auditada:** `docs/FASES/FASE1/M16c/spec.md`, BORRADOR, sin modificar durante esta auditoría.

## Veredicto

**REQUIERE CAMBIOS.** La implementación no puede comenzar con esta spec como contrato aprobado: hay archivos necesarios fuera de II.11, cuatro preguntas abiertas y una ambigüedad sobre la persistencia de errores de conexiones existentes. `G-SYNC` continúa pendiente.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | `meta_first/plan.md:293-306`; `M16c/spec.md:242-263`: los 16 CA de la ficha, contando CA-44b una vez, están resumidos. |
| 2 | Alcance | FAIL | `M16c/spec.md:229-238` condiciona siete archivos de implementación/prueba/documentación no listados en `meta_first/plan.md:668-693`. Su necesidad está justificada, pero la ruta vigente aún no autoriza ese alcance de archivos. |
| 3 | Coherencia con spec general y sucesoras | PASS | `meta_first/spec.md` §11 y §14; `meta_first/plan.md:697-715`: presencia, precisión textual, procedencia y estado temporal quedan disponibles para M25a.1. No se halló conflicto adicional con CA/DEC/CB. |
| 4 | Decisiones | PASS | `M16c/spec.md:390-395`: no presenta ninguna `D-M16c-NN` como aprobada; las decisiones se dejan al usuario. |
| 5 | Trampas | PASS | `meta_first/plan.md:685-693`; `M16c/spec.md:372-389`: ausencia ≠ cero, no usar `paging.next`, completitud independiente, posesión con lease y precisión por texto. |
| 6 | Intervenciones y acciones reservadas | PASS | `meta_first/plan.md:387-397,808-848`; `M16c/spec.md:358-371`: push, despliegue, `db:push:test` y `db:push` de `app` quedan al usuario y tienen verificación posterior. |
| 7 | Verificación | PASS | `meta_first/plan.md:683,808-848`; `meta_first/spec.md` §14 CB-06; `M16c/spec.md:345-357`: verify, policies, app y prohibición de omitir pruebas requeridas. |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:24,28-30`: `G-VR01` aprobado y M16c habilitada; `meta_first/sesiones/M16.2.md:300-314,341-343` acredita el cierre. El código de M16.2 está en la base. |
| 9 | Lo entregado de verdad | PASS | `M16c/spec.md:55-85` reconoce el adaptador cerrado (`worker-api.ts:9,63,168`), el log sin persistencia (`lifecycle.ts:273-295`) y el catálogo pgTAP de doce funciones (`09_integration_privileges.test.sql:386-399`). Las diferencias están marcadas como preguntas. |
| 10 | Pendientes y hallazgos | PASS | `HALLAZGOS.md:39,44,52-53,486,502,511-512`; `M16c/spec.md:420-429`: H-E1-22/27/35/36 están asignados; campos reales y Q-04 permanecen explícitamente pendientes. |
| 11 | Contexto real | PASS | Referencias de `M16c/spec.md:55-85` contrastadas con los archivos citados; los puntos críticos de adaptador, ciclo de vida, migración `0012`, pgTAP `09` y runner coinciden con la base. |
| 12 | Archivos previstos | FAIL | `M16c/spec.md:229-238` y preguntas Q-01 a Q-03 (`:415-417`) declaran archivos necesarios sin autorización vigente en `meta_first/plan.md` II.11. El preámbulo de Parte II (`:385`) cubre cambios de ubicación de archivos nuevos dentro del módulo, no agrega estos cambios en archivos existentes y documentos transversales. |
| 13 | Diseño suficiente | FAIL | `M16c/spec.md:179,409-418`: Q-04 aún no fija ventana máxima, páginas máximas, duración y reserva efectivas; Q-01 a Q-03 impiden ejecutar los contratos de adaptador, pruebas históricas y documentación sin decisión/enmienda. |
| 14 | Verificable | FAIL | La tabla `M16c/spec.md:300-343` cubre los 30 criterios en general, pero C-17 (`:282`) y H-E1-22 no tienen caso que pruebe la rama `unchanged` de `applyConnectionFailure`. T-21/23/24 (`:325-328`) prueban extractor, SQL o sincronización; `tests/unit/meta-lifecycle.test.ts:622-626` y `tests/app/meta-lifecycle.test.ts:256-263` aún aceptan la rama que solo registra un log. |
| 15 | Sin nada abierto | FAIL | `M16c/spec.md:409-418`: M16c-Q-01 a Q-04 siguen abiertas. Las hipótesis `:396-407` sí tienen momento y método de verificación. |
| 16 | Ejecutable ahora | FAIL | `npm run verify` ejecutado sobre la base: lint, typegen, typecheck y 595 pruebas de 26 archivos terminaron; `next build` quedó en «Creating an optimized production build ...» sin salida final durante más de cinco minutos. Se interrumpió el proceso; exit 1 por interrupción, no por un fallo de código acreditado. La verificación completa no pasó, por lo que no puede declararse ejecutable ahora. Scripts y nombres de variables comprobados en `package.json` y `.env.example`; no se leyó `.env.local`. |
| 17 | Consistencia interna | FAIL | `M16c/spec.md:131` dice que la rama general `unchanged` *puede* usar `record_connection_error`, mientras C-17 (`:282`) exige persistencia y el alcance (`:38`) la presenta como obligatoria. La implementación y pruebas podrían dejar ese camino sin escritura. |
| 18 | Reglas no negociables | PASS | `M16c/spec.md:36-53,91-138,193-201,345-371`: K01 servidor, datos sintéticos, migración nueva, pruebas desechables, credenciales por `worker_api` y errores redactados. |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| La rama general `unchanged` *puede* llamar `record_connection_error` (`M16c/spec.md:131`) | Persistencia obligatoria de clases en conexiones existentes (`meta_first/plan.md:299,673`; `M16c/spec.md` C-17 y alcance) | `lifecycle.ts:280-284` solo escribe un log; ninguna T de M16c exige que el flujo general escriba en la conexión. | Hacer obligatoria la llamada de esa rama, con generación y mensaje fijo, y agregar una prueba de esa ruta en las suites existentes o previstas tras resolver Q-01. |

Los archivos condicionados están identificados correctamente como **REQUIERE CAMBIO EN LA RUTA**. No se los trata como autorización implícita ni como una contradicción ya resuelta.

## Hallazgos

| ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | alta | Archivos previstos / Q-01 | El adaptador cerrado impide llamar las RPC nuevas y el flujo general de errores no persiste H-E1-22; la prueba de componente propuesta tampoco figura en II.11. | `M16c/spec.md:231-233,415`; `worker-api.ts:9,63,168`; `lifecycle.ts:273-295`; `meta_first/plan.md:668-693`. | Resolver Q-01 y enmendar II.11 con archivos y alcance concretos, o dividir formalmente el corte; luego actualizar la spec. | Sí |
| A-02 | alta | Archivos previstos / Q-02 | El pgTAP histórico fallará al agregar funciones; H-E1-35/36 requiere probar el bloque real en un rol limpio mediante el runner. Los archivos necesarios no figuran en II.11. | `M16c/spec.md:234-235,416`; `09_integration_privileges.test.sql:386-399,519,554`; `run-pgtap.mjs:35-44,132-136`. | Resolver Q-02 y autorizar por enmienda el ajuste de `09` y el runner, conservando las pruebas de privilegios. | Sí |
| A-03 | alta | Archivos previstos / Q-03 | Pasar de sincronización prevista a vigente cambia flujo y controles de seguridad, pero II.11 no prevé `ARCHITECTURE.md` ni `SECURITY.md`. | `AGENTS.md` contrato documental; `ARCHITECTURE.md:87,276,285`; `M16c/spec.md:236,417`. | Resolver Q-03 y añadir ambos documentos a la ruta antes de implementarlos, o asignar su actualización mediante enmienda explícita. | Sí |
| A-04 | media | Funciones / C-17 / pruebas | La spec deja opcional la persistencia de errores de la rama general `unchanged`, y las T solo acreditan el nuevo camino de sincronización o la RPC aislada. | `M16c/spec.md:131,282,325-328`; `lifecycle.ts:280-284`; `tests/unit/meta-lifecycle.test.ts:622-626`. | Exigir la escritura en el flujo general y una prueba que observe `last_error_*` real tras esa llamada, además de sus casos de generación vieja y empresa ajena. | No, una vez autorizada Q-01 |
| A-05 | alta | Q-04 / diseño / gate | No están fijados los tres límites efectivos ni la reserva; la cuenta probada devolvió cero filas, por lo que no acredita los campos ni los límites de una extracción con datos. | `M16c/spec.md:179,418`; `meta_first/sesiones/M16.2.md:300-314`; `meta_first/plan.md:680-683`; `meta_first/spec.md` CA-44b/56. | Resolver Q-04 con validación real legítima; si continúa vacía, decidir explícitamente el diferimiento y enmendar criterios/gate antes de llamar aprobable a la spec. | Sí |
| A-06 | alta | Precondición de ejecución | `npm run verify` no concluyó en la base; la compilación de Next quedó sin progreso visible y se interrumpió. La causa aún no está diagnosticada. | Salida de `npm run verify` de esta auditoría: lint, tipos y 595/595 tests pasan; `next build` se detuvo después de «Creating an optimized production build ...». | Diagnosticar la compilación de la base y repetir `npm run verify` con exit 0 antes de aprobar/implementar. Registrar el problema de entorno o código en el seguimiento correspondiente, sin adjudicarlo a M16c por defecto. | No, salvo que el diagnóstico revele una intervención externa |

## Observación de tamaño

Cuatro tablas, nuevas funciones SQL, correcciones del adaptador y pgTAP histórico, extracción, UI, 38 casos y validación desplegada hacen probable que el corte supere las 8 horas de implementación de la ficha (`meta_first/plan.md:297`). Si al planificar se confirma, proponer una división de M16c en cortes de hasta 8 horas mediante decisión y enmienda de ruta, sin reducir CA ni adelantar M25a.1.

## Siguiente paso

Aplicar las correcciones técnicas a la spec después de resolver las decisiones Q-01 a Q-04 y sus enmiendas necesarias; volver a auditar. No se aprueba la spec ni se implementa M16c con este informe.
