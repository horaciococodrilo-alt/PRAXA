# Auditoría de la spec M16c — 8

**Fecha:** 2026-11-07  
**Commit base:** `a27f727`  
**Hash de contenido de la spec, excluyendo solo la línea de estado:** `f4cf962dedc75e64e023134402db972a604b19e3`  
**Estado auditado:** BORRADOR.

Se auditó la versión nueva de `M16c/spec.md`, no la versión de `spec-audit-7.md`. La ruta vigente incluye las enmiendas documentales aprobadas que siguen sin commit en el árbol de trabajo. Los cambios preexistentes se preservaron.

## Veredicto

**REQUIERE CAMBIOS: 15 PASS y 3 FAIL.** Los siete hallazgos de `spec-audit-7.md` están corregidos en la spec vigente. Queda una contradicción nueva en el manejo de un `fetched_at` futuro, con un caso negativo sin prueba. No se aprueba la spec ni se habilita un corte por esta auditoría.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | Los 16 CA de la ficha (`meta_first/plan.md:303`) constan en Heredados, con resúmenes fieles (`M16c/spec.md:235-254`; `meta_first/spec.md:296-371`). |
| 2 | Alcance | PASS | Los tres cortes y sus archivos siguen la ficha y II.11 (`M16c/spec.md:30-40,201-229`; `meta_first/plan.md:315-319,687-694`); C-01 a C-22 tienen traza (`M16c/spec.md:258-281`). |
| 3 | Coherencia con la spec general y sucesoras | PASS | §11 exige cobertura, precisión, cuatro niveles y posesión; M25a consume refs opacas y cifras como texto (`meta_first/spec.md:330-370,377-395`; `meta_first/plan.md:321-349`). No se halló contradicción con CA, DEC o CB de la ruta. |
| 4 | Decisiones | PASS | D-M16c-01 a -04 identifican decisión del usuario y fecha (`M16c/spec.md:378-381`); la enmienda de Q-04 está integrada en la ruta (`meta_first/sesiones/enmienda-gsync-2026-11-07.md`). |
| 5 | Trampas | PASS | Ausencia, `paging.next`, posesión, precision exacta, agregación y metadata histórica se reflejan en `M16c/spec.md:358-372`, frente a `meta_first/plan.md:698`. |
| 6 | Intervenciones y acciones reservadas | PASS | Usuario: `db:push:test`, `db:push` de app, push/despliegue, comunicación, ensayo y gates, con verificaciones posteriores (`M16c/spec.md:338-356`; `meta_first/plan.md:307,315-317,827`). |
| 7 | Verificación | PASS | Cada corte exige `verify`, `db:check:test`, `test:policies` y `test:app` completos; CB-06 se aplica a omitidas (`M16c/spec.md:330-334`; `meta_first/plan.md:835-856`). |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:24,28,32` registra G-VR01 aprobado y M16c.1 como siguiente; la base contiene el trabajo de M16.2. G-SYNC-DB y G-SYNC-EXTRACT siguen pendientes para sus sucesores. |
| 9 | Lo entregado de verdad | PASS | La spec usa las firmas vigentes de repositorios, `purge_connection`, cliente y `graphUrl` (`M16c/spec.md:46-56,72,140,170`; `0012_integrations.sql:1277-1311`; `meta/api.ts:35-41`; `meta/client.ts:85-110`). |
| 10 | Pendientes y hallazgos | PASS | H-E1-22/27/35/36 van a .1; H-E1-117/189 a .3; H-E1-188 se difiere con motivo; H-E1-190 no afecta M16c (`M16c/spec.md:403-405`; `HALLAZGOS.md:39,44,52-53,129,191-194,741,745`; `PROJECT_STATE.md:64`). |
| 11 | Contexto real | PASS | Las referencias `archivo:línea` de `M16c/spec.md:44-64`, `:140` y `:399` existen y sostienen las afirmaciones; se contrastaron migración 0012, pgTAP 09/10, adaptador, repositorios, cliente Meta, runner, tests, package y sesión M16.2. |
| 12 | Archivos previstos | PASS | `M16c/spec.md:205-227` corresponde a II.11 o a seguimiento (`meta_first/plan.md:687-694`). La tarjeta conserva el contrato de su prueba existente sin pedir editar un archivo no autorizado (`M16c/spec.md:220`). |
| 13 | Diseño suficiente | FAIL | Si SQL rechaza `p_fetched_at` por estar en el futuro, la spec ordena llamar a `fail_sync_run` con el mismo instante congelado y dice que SQL lo valida con el mismo límite (`M16c/spec.md:118,158-160`). No define una ruta ejecutable para cerrar el nivel. A-01. |
| 14 | Verificable | FAIL | T-37 prueba reloj atrasado y rechazo de timestamp futuro, pero no prueba que el rechazo futuro pueda cerrarse como `own_error` mediante `fail_sync_run` ni su resultado persistido (`M16c/spec.md:325,393`). A-01. Los comandos de la tabla existen en `package.json`. |
| 15 | Sin nada abierto | PASS | «Preguntas abiertas» está vacía (`M16c/spec.md:397-401`); H-01 a H-08 y Ruta H-04 tienen método y momento de verificación (`:383-395`). La inconsistencia del fallback de H-07 se registra en A-01. |
| 16 | Ejecutable ahora | PASS | `npm run verify` sobre `main@a27f727`: exit 0; lint, typegen, typecheck, 26 archivos/595 pruebas y build completo de 13 páginas estáticas. Scripts en `package.json` y nombres de variables en `.env.example` existen; la intervención de .1 está asignada (`M16c/spec.md:342-344`). No se inspeccionó `.env.local`. |
| 17 | Consistencia interna | FAIL | `fetched_at` se congela para publicación **y fallo** (`M16c/spec.md:158`); SQL rechaza el futuro para esas llamadas (`:160`), pero el mismo párrafo afirma que tras ese rechazo `fail_sync_run` registra `own_error`. Ambas reglas no pueden cumplirse con la firma de `:118`. A-01. |
| 18 | Reglas no negociables | PASS | K01 servidor, migración nueva, desechable, acceso a credenciales solo por `worker_api`, errores redactados y ausencia de secretos/datos reales están expresos (`M16c/spec.md:32,40,112,140,166,174,199,332-356`; `SECURITY.md` §§3, 5, 6 y 11). |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| Ante `p_fetched_at` futuro, cerrar el nivel con `fail_sync_run` y registrar `own_error` | La misma spec congela ese `fetched_at` también para el fallo y exige que SQL rechace un instante posterior a `clock_timestamp()` | `M16c/spec.md:118,158-160`; H-07 en `:393` | Definir un mecanismo de fallo que SQL pueda aceptar sin falsear la captura ni modificar cobertura, y agregar la prueba del reloj adelantado y la persistencia del resultado. |

## Hallazgos

| ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | alta | Instante de captura / H-07 / T-37 | El fallback ante reloj local adelantado usa la misma firma y el mismo `p_fetched_at` que SQL acaba de rechazar; no puede persistir `own_error` tal como está escrito. | `M16c/spec.md:118,158-160,325,393` | Fijar la semántica SQL de ese fallo y el instante que conserva, sin cobertura nueva ni éxito ficticio; probar con reloj adelantado que el nivel y el resumen quedan en estado cerrado esperado, y que no se pierde el error original. | No |

## Seguimiento de la auditoría 7

Los siete puntos anteriores sí se corrigieron: `pending_selection` (`M16c/spec.md:152,323`), ACL del helper (`:140`), errores posteriores al inicio (`:188-195,311,316`), cambio de generación (`:116,291`), definición del extremo de la ventana (`:170,304`), contrato de la tarjeta (`:220`) y lectura de metadata/actualización del acta prevista (`:170,393-394`). La corrección del reloj atrasado está en `:158,325`; la ruta del reloj adelantado origina A-01 de esta auditoría.

## Evidencia y límites

- `git status --short --branch`: los cambios documentales y el directorio M16c ya existían; esta auditoría solo añadió este informe. `git rev-parse --short HEAD`: `a27f727`. Hash calculado sobre los bytes de la spec sin la línea `**Estado:**`, conservando sus saltos de línea.
- Se leyeron la spec M16c completa, `AGENTS.md`, la ficha y transversales de la ruta, la spec general, `PROJECT_STATE.md`, los hallazgos pertinentes, las sesiones de dependencias y enmiendas, `SECURITY.md`, el acta y el código citado. El informe 7 se usó solo para verificar sus correcciones, no como sustituto del checklist.
- `npm run verify`: exit 0. No se aplicó 0016 ni se corrieron `test:policies` o `test:app`: son verificaciones de implementación de los cortes, no de esta auditoría documental. El build usó su carga normal de configuración; el asistente no abrió ni imprimió `.env.local`.
- No hubo commit, push, despliegue, acceso a producción ni modificación de la spec u otros archivos.

## Tamaño del corte

M16c.1 concentra siete tablas, funciones y RPC, purga, normalización del rol, adaptador, lifecycle y pgTAP. Al preparar su plan, evaluar si debe dividirse en persistencia/ACL/purga y funciones/lecturas/adaptador/carreras para respetar el límite de ocho horas. Esto no modifica la ruta ni inicia un corte.

## Siguiente paso

Corregir A-01 en la spec y auditar de nuevo. Es una corrección técnica, sin decisión de negocio nueva. La aprobación de esta ficha, las specs y planes propios y los gates de M16c.1/.2/.3 siguen pendientes.
