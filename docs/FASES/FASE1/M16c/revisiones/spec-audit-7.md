# Auditoría de la spec M16c — 7

**Fecha:** 2026-11-07  
**Commit base:** `a27f727`  
**Hash de contenido de la spec, excluyendo solo la línea de estado:** `16fa232a3626e60b1a3aaf874a798ba5bc75d4ee`  
**Estado auditado:** BORRADOR.

La spec conserva el hash auditado en `spec-audit-6.md`. Esta revisión aplica literalmente la regla de la skill: una contradicción interna no puede recibir PASS en consistencia, y una conducta que el implementador debe elegir no puede recibir PASS en diseño suficiente. Se auditó el árbol de trabajo vigente, incluidas las enmiendas documentales todavía sin commit; los cambios preexistentes se preservaron.

## Veredicto

**REQUIERE CAMBIOS: 15 PASS y 3 FAIL.** Fallan los ítems 13, 14 y 17. La base pasó `npm run verify`. No se aprueba la spec ni se habilita ningún corte por esta auditoría.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | Los 16 CA de la ficha (`meta_first/plan.md:303`) figuran en Heredados (`M16c/spec.md:235-254`), incluidos CA-39 y CA-44b. |
| 2 | Alcance | PASS | Los tres cortes (`M16c/spec.md:32-36`) coinciden con Parte I y II.11 (`meta_first/plan.md:315-317,687-694`). Los C-01 a C-22 tienen traza (`M16c/spec.md:258-281`). |
| 3 | Coherencia con la spec general y sucesoras | PASS | Catálogo, precisión, cobertura y posesión coinciden con §11 (`meta_first/spec.md:330-370`); M25a consume refs opacas, atribución y texto exacto (`meta_first/spec.md:377-395`; `meta_first/plan.md:327`). No se halló contradicción con CA/DEC/CB de la ruta. |
| 4 | Decisiones | PASS | D-M16c-01 a -04 identifican al usuario y fecha (`M16c/spec.md:378-381`); la enmienda G-SYNC figura integrada en `meta_first/sesiones/enmienda-gsync-2026-11-07.md`. |
| 5 | Trampas | PASS | Las trampas obligatorias de II.11 (`meta_first/plan.md:698`) aparecen en `M16c/spec.md:358-372`, con pruebas de ausencia, paginación, posesión, precisión y metadata. |
| 6 | Intervenciones y acciones reservadas | PASS | `M16c/spec.md:340-356` asigna al usuario `db:push:test`, `db:push` en app, push/despliegue y ensayo real, con verificación posterior; coincide con `meta_first/plan.md:307,315-317,827`. |
| 7 | Verificación | PASS | Cada corte exige `verify`, `db:check:test`, `test:policies` y `test:app` completos, y CB-06 (`M16c/spec.md:330-335`; `meta_first/plan.md:850-856`). |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:24,28,32` registra G-VR01 aprobado y M16c.1 como siguiente. HEAD contiene el cierre de M16.2; los gates de .2/.3 siguen pendientes. |
| 9 | Lo entregado de verdad | PASS | La spec usa `readCredential`, `readConnectionRecord`, el cliente Graph y la firma actual de `purge_connection` (`M16c/spec.md:46-56`; `credentials.ts:234-247`; `0012_integrations.sql:1277-1311`). |
| 10 | Pendientes y hallazgos | PASS | H-E1-22/27/35/36 van a .1; H-E1-117/189 a .3; H-E1-188 está fuera por motivo explícito; H-E1-190 no cambia M16c (`M16c/spec.md:401-403`; `HALLAZGOS.md:39,44,52-53,129,191-194,745`). |
| 11 | Contexto real | PASS | Las citas de código de `M16c/spec.md:44-64` se contrastaron con migración 0012, adaptador, repositorios, cliente Meta, pgTAP 09/10, runner, tests y sesión M16.2. En particular, `probe.ts:26,34-36` y `client.ts:85-101` sostienen las diferencias señaladas abajo. |
| 12 | Archivos previstos | PASS | `M16c/spec.md:205-227` corresponde a II.11 (`meta_first/plan.md:687-694`) o a seguimiento autorizado. No se propone editar archivos fuera del plan. |
| 13 | Diseño suficiente | FAIL | Hay decisiones no fijadas sobre el run de otra generación, el reloj de captura, resultados de errores posteriores al inicio, ACL del helper y extremo de la ventana (`M16c/spec.md:116,140,158-160,170,176,182-195`). Hallazgos A-02 a A-05 y A-07. |
| 14 | Verificable | FAIL | T-35 no cubre `pending_selection` (`M16c/spec.md:323`); T-23 no exige resultado de la acción tras la purga en vuelo (`:311`); T-03 no cubre run vigente con generación cambiada (`:291`). A-01, A-03 y A-04. Los scripts citados sí existen en `package.json`. |
| 15 | Sin nada abierto | PASS | «Preguntas abiertas» dice ninguna y Q-01 está resuelta (`M16c/spec.md:395-399`). H-01 a H-06 y Ruta H-04 tienen momento y forma de verificación (`:383-393`). |
| 16 | Ejecutable ahora | PASS | `npm run verify` sobre `main@a27f727` fuera del sandbox: exit 0; lint, typegen, typecheck, 26 archivos/595 pruebas y build completo de 13 páginas estáticas. La primera corrida se interrumpió durante build tras quedar sin salida y no se cuenta como éxito. Scripts en `package.json` y nombres de variables en `.env.example` existen; no se inspeccionó el contenido de `.env.local`. Las intervenciones de .1 tienen paso asignado (`M16c/spec.md:340-345`). |
| 17 | Consistencia interna | FAIL | `get_meta_sync_status` promete una fila para toda conexión visible distinta de disconnected (`M16c/spec.md:152`), pero las tres RPC requieren active/needs_reauth (`:154`). `pending_selection` recibe dos resultados incompatibles. A-01. |
| 18 | Reglas no negociables | PASS | K01 servidor, migración nueva, desechable, credenciales por `worker_api` y errores redactados están expresos (`M16c/spec.md:32,40,112,140,166,174,199,332-356`). La ACL nueva sin definir se trata como falta de diseño en A-02, no como control ya implementado. |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| `get_meta_sync_status` devuelve una fila para `pending_selection` | La misma spec exige `active/needs_reauth` para las tres RPC | `M16c/spec.md:152,154` | Elegir una regla única y probar `pending_selection` en T-35. |
| Lecturas de metadata por edges y referencias con IDs en la ruta | El acta aprobada declara excepción para la ruta de Insights solamente | `M16c/spec.md:170`; `M03a/acta-meta.md:17,35,63` | Fijar la forma de petición y actualizar explícitamente el acta autorizada antes de la primera captura ampliada; incluirlo en la comunicación al dueño. |

## Hallazgos

| ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | alta | Lecturas públicas | La respuesta para `pending_selection` es contradictoria. | `M16c/spec.md:152,154,323` | Fijar cero filas o una fila de forma única y añadir el caso a T-35. | No |
| A-02 | media | API SQL | No se define seguridad, `search_path` ni revocación de EXECUTE del helper nuevo; PostgreSQL concede EXECUTE a PUBLIC por defecto. | `M16c/spec.md:140`; `0012_integrations.sql:223-230,266-269`; `09_integration_privileges.test.sql:453-467` | Declarar helper SECURITY INVOKER, `search_path` vacío y ACL explícita; probarlo con pgTAP 09/13. | No |
| A-03 | media | Acción | PX001 tras purga en vuelo y errores SQL no ambiguos después de iniciar no tienen resultado de acción definido. | `M16c/spec.md:188-195,311` | Asignar resultado cerrado a cada caso y afirmarlo en T-23 o T-28. | No |
| A-04 | media | Inicio y posesión | Un run `running` con lease vigente pero generación anterior puede bloquear el nuevo inicio o ser desplazado; la spec admite ambas lecturas. | `M16c/spec.md:116,363`; `meta_first/spec.md:364-370`; `M16c/spec.md:291` | Fijar transición y PX esperado, y agregar carrera a T-03. | No |
| A-05 | media | Captura | El reloj de Next fija `fetched_at`, pero SQL exige que quede entre tiempos de la base. Un desfase entre hosts puede rechazar la primera publicación. | `M16c/spec.md:158-160,325` | Definir una fuente o tolerancia coherente para el instante y probar desfases en ambos sentidos. | No |
| A-06 | alta | Extracción y acta | La petición de metadata puede llevar IDs de cuenta o entidad en la ruta, fuera de la excepción informada al dueño. | `M16c/spec.md:170`; `M03a/acta-meta.md:17,35,63` | Especificar el transporte de metadata, declarar exactamente qué IDs llegan a rutas visibles y corregir el acta antes de comunicarla y capturar datos reales. | No; la comunicación ya está asignada al usuario en .3 |
| A-07 | media | Ventana | Los 28 días no tienen extremo definido. El probe entregado usa `last_28d`, mientras el diseño introduce días abiertos y `time_range` local. | `M16c/spec.md:170,176,304`; `probe.ts:34-36`; `meta_first/spec.md:334,353,358` | Fijar `window_from/window_to` en la zona de la cuenta e incluir el caso del día abierto en T-16. | No |

## Evidencia y límite de ejecución

- `git status --short --branch`: cambios documentales preexistentes; solo este informe es nuevo en esta auditoría. `git rev-parse --short HEAD`: `a27f727`. El hash se calculó sobre los bytes de la spec excluyendo únicamente la línea `**Estado:**`, sin convertir saltos de línea.
- `npm run verify`: primera corrida interrumpida en build tras lint, typegen, typecheck y 595/595 pruebas; repetición fuera del sandbox, exit 0 con build completo. El build cargó la configuración de entorno por su mecanismo habitual; el asistente no abrió ni imprimió `.env.local`.
- Fuentes: `AGENTS.md`, spec M16c completa, Parte I/II.11/III.2/III.3/III.9 del plan, spec general completa, `PROJECT_STATE.md`, hallazgos pertinentes, sesiones de dependencias y de las enmiendas, `SECURITY.md`, acta M03a y código citado. Se usó `spec-audit-6.md` como antecedente, no como sustituto del checklist.
- No se ejecutaron `test:policies` ni `test:app`: corresponden a los cortes de implementación, y esta auditoría no aplica migraciones. No se inspeccionaron secretos ni se accedió a servicios externos o producción.

## Tamaño del corte

M16c.1 reúne siete tablas, funciones SQL y RPC, purga, normalización de rol, adaptador, lifecycle y pgTAP. Es dudoso que quepa en ocho horas. Al preparar su plan, evaluar subdividir .1 en persistencia/ACL/purga y funciones/lecturas/adaptador/carreras, preservando los gates de la ruta mediante una enmienda aprobada si corresponde.

## Siguiente paso

Corregir los hallazgos técnicos en la spec de conjunto y auditar de nuevo. Ninguno de los siete hallazgos exige una decisión de negocio nueva; la actualización del acta y su comunicación ya están dentro de II.11 y de las intervenciones de M16c.3. No se aprueba M16c ni se inicia M16c.1 automáticamente.
