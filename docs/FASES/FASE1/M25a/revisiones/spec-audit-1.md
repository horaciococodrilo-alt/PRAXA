# Auditoría de la spec de M25a — ronda 1

- Fecha: 2026-11-08 (America/Argentina/Buenos_Aires).
- Base: `main`, commit `b0c854d`.
- Spec auditada: `docs/FASES/FASE1/M25a/spec.md`, 743 líneas, estado `BORRADOR`.
- Hash de contenido, excluyendo únicamente la línea que empieza por `**Estado:**`: `e2d2fce9cf8d6fa538cee54775c901529ac18769`.
- Hash del archivo completo: `c8836b74972828879048dc957663dfd6ee10de0b`.
- Alcance: auditoría documental y contraste con el código; no implementación ni corrección de la spec.
- Cambios preexistentes preservados: `docs/PIPELINE.md` modificado y `M25a/spec.md` sin seguimiento. El árbol no estaba limpio al comenzar esta auditoría; la afirmación de la spec sobre el árbol limpio corresponde a su expansión histórica.

## Veredicto

**REQUIERE CAMBIOS.** La cobertura temática y la dependencia `G-SYNC` son correctas, pero la spec todavía no puede ejecutarse sin decisiones ni interpretaciones del implementador. Se registran **9 hallazgos vigentes: 5 altos y 4 medios**. El checklist termina con 11 PASS y 7 FAIL. La versión recibida durante la auditoría ya incorpora D-M25a-01 a D-M25a-11 y las enmiendas coordinadas de la ruta. Se revisa esa versión, no el borrador inicial con preguntas abiertas.

No se aprueba la spec, no se inicia M25a y no se modifica ningún gate. Todos los hallazgos A-NN de este informe quedan asignados a la preparación de la spec de M25a, antes de aprobarla; no autorizan cambios de implementación ni de alcance.

Durante esta auditoría hubo ediciones externas en la spec y en meta_first/plan.md y spec.md. Se preservaron y releyeron. Hash de contenido final del plan de la ruta: `c225abe802338cdf533a0fc149377d309802ce39`; de su spec: `819031f33f56e595a021e881b55b0497238c8de4`. Este informe es el único archivo escrito por el auditor.

## Fuentes contrastadas

- `AGENTS.md`; spec completa de M25a; spec completa de la ruta `meta_first`.
- Plan de la ruta: encabezado y enmiendas; ficha M25a y sus etapas; ficha sucesora M28.3a; I.5; precondiciones; II.12, II.13, II.13b y II.14; III.1 a III.6 y III.9. Propuesta aprobada de enmienda del chat y sus riesgos.
- `PROJECT_STATE.md` completo; registro y detalle pertinente de `HALLAZGOS.md`, especialmente H-E1-187/189/190/194/198/202; evidencia de K01, M06.1a-M06.2a, M06.3a, M16.1, M16.2 y cierre de M16c. Los estados históricos intermedios de las sesiones no sustituyen sus cierres ni `PROJECT_STATE.md`.
- `SECURITY.md` completo, `ARCHITECTURE.md`, acta M03a e inventario `entorno.md`.
- Contratos, adaptador `worker-api`, lectura de conexiones, K01, extractor/lecturas de Insights y desgloses, contratos de reporting, página y componentes del chat, navegación, gráfico y selector existentes, pruebas de pantalla y guardas de credenciales/secretos; secciones pertinentes de migraciones 0007/0012/0016/0017 y pgTAP 09/10/13/14; scripts de destino y pgTAP; `package.json`, `.env.example` y Vitest.
- Guías instaladas de Next 16.4.2: `server-actions.md` y `maxDuration.md`. Confirman la serialización por cliente y la configuración de duración en la página.
- Documentación oficial de DeepInfra consultada en esta auditoría: [salida estructurada](https://docs.deepinfra.com/chat/structured-outputs), [modelo](https://deepinfra.com/deepseek-ai/DeepSeek-V4.1-Flash), [privacidad](https://docs.deepinfra.com/account/data-privacy). La ficha anuncia fp8 y JSON; la guía documenta `json_schema` estricto. Esto no demuestra que el esquema concreto de M25a funcione: H-02 conserva su prueba prevista. La página de privacidad declara que no registra contenido; la diferencia con DEC-15 ya está reconocida en H-05 y queda resuelta documentalmente por D-M25a-11, que conserva el riesgo mayor y añade la fuente actual con fecha.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad de CA heredados | PASS | Sección «Heredados de la ruta»: cubre todos los CA de la ficha, VR-02 y transversales pertinentes. |
| 2 | Alcance conforme a ficha y Parte II | FAIL | H-07 autoriza reducir el alcance ante un problema de rendimiento; contradice el contrato de ejecución §4 y las condiciones de parada. A-06. |
| 3 | Coherencia con la spec general y sucesoras | FAIL | Excepciones numéricas y voto: A-04/A-05. C-03 aún contradice la excepción ya incorporada en CA-38c (A-02). M28.3a sigue dependiendo de G-CHAT. |
| 4 | Decisiones del usuario | PASS | D-M25a-01 a D-M25a-11 atribuidas al usuario y fechadas. La enmienda del plan y CA-38c/CA-50/CA-62 coordinan las decisiones que cambian la ruta. El diseño elegido para el contexto requiere una corrección técnica, A-10. |
| 5 | Trampas de la ruta | PASS | Sección «Trampas y riesgos»: logs, vinculación completa de cifras, cantidades sin dígitos, límites de la guarda, modelo sin despliegue inmutable y alternativa Fireworks. |
| 6 | Intervenciones y acciones reservadas | PASS | Sección «Intervenciones del usuario»: migraciones, commits, push y despliegue a cargo del usuario, con comprobación posterior; acta antes de datos reales. |
| 7 | Suites obligatorias y CB-06 | PASS | Sección «Verificación»: verify, db:check:test, policies y app en las tres etapas, adversarias y evaluaciones; identifica omitidas ajenas. Prevalece la ficha sobre las omisiones de III.3/II.13. |
| 8 | Dependencias cerradas y presentes | PASS | PROJECT_STATE:25-29 y cierre de sesiones/M16c; 0016/0017 y sus interfaces están en la base b0c854d. H-E1-189/194 son riesgos diferidos explícitos, no gates faltantes. |
| 9 | Interfaces realmente entregadas | FAIL | El diseño de atribución para desgloses no resuelve que get_meta_breakdown no entrega atribución. A-09. El resto del inventario reconoce correctamente los cambios de interfaz principales. |
| 10 | Pendientes y hallazgos pertinentes | PASS | Spec «Fuera de alcance», H-09/H-10 y «Hallazgos relacionados» conserva la validación real pendiente de H-E1-189/194 y la decisión DEC-24; reconoce el mock de uso y los desajustes documentales sin implementarlos silenciosamente. |
| 11 | Referencias archivo:línea verdaderas | PASS | Se contrastaron las referencias a las interfaces y al contexto. Los anclajes conjuntos de get_meta_breakdown apuntan al comentario de ausencias (0017:519-520) y al límite (0017:560); considerados conjuntamente respaldan la afirmación. |
| 12 | Archivos autorizados por la ruta | PASS | La enmienda de meta_first/plan.md:20 autoriza la lista D-M25a-01 y D-M25a-10, incluida la página de Uso y costos. Las rutas internas sugeridas siguen autorizadas por la Parte II. |
| 13 | Diseño suficiente | FAIL | Faltan contratos completos de resultados/bloques, atribución de desgloses, contexto conversacional y lectura completa del catálogo. A-08 a A-11. Span ya está resuelto por D-M25a-04. |
| 14 | Criterios verificables y resultados concretos | FAIL | Hay trazabilidad C→T, pero T-38 convierte una exclusión insegura en aceptación; faltan contratos que permitan fijar resultados inequívocos de ranking/series/comparaciones y casos de paginación y presupuesto total. A-04/A-08/A-11/A-12. |
| 15 | Sin preguntas abiertas ni hipótesis sin paso | PASS | «Preguntas abiertas»: vacía; decisiones registradas. H-02 tiene comprobación temprana; H-05 está resuelta por D-11; H-09/10 quedan explícitamente diferidas a la primera captura con filas. La salida incorrecta de H-07 se registra en A-06. |
| 16 | Ejecutable ahora | PASS | npm run verify completo terminó con exit 0 fuera del sandbox: 765 pruebas y build en verde. test:eval y DEEPINFRA_API_KEY son incorporaciones previstas, explícitamente autorizadas por D-M25a-01, con creación y carga asignadas antes de usarse. No se acreditan presentes ni operativas hoy. |
| 17 | Consistencia interna | FAIL | Excepciones de voto/registro y contrato obligatorio de record_id; límites de duración frente a finalización; contratos de resultados frente a sus consumidores. A-05/A-08/A-12. |
| 18 | Reglas no negociables | FAIL | La exclusión textual de nombres permite eludir la verificación de cifras (A-04). El resto del diseño conserva K01, RLS, worker_api para escrituras, migración nueva, pruebas desechables y errores redactados. |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| C-03 exige escribir solo con active | CA-38c enmendado, D-M25a-02, Diseño §2 y C-60 | La excepción para needs_reauth/pending_selection ya está aprobada y descrita, pero C-03 sigue prohibiéndola. | Propagar la excepción a C-03 y los casos de prueba. |
| Exclusiones generales de un/una/uno y entity_name | Spec de la ruta, CA-50.1/CA-50b; SECURITY INV-08 | Un texto numérico puede quedar sin candidatos y sin claims. | No eximir prosa por coincidencia con un nombre; presentación tipada de nombres y detección contextual de cantidades. |
| Abstención sin voto cuando written=false | Spec de la ruta, CA-69 y DEC-13 | M25a §11 y C-43 establecen una excepción que la ruta no autoriza. | Acordar un contrato compatible con la retención y con CA-69; no reinsertar registros tras la purga para resolverlo. |
| Reducir alcance al fallar H-07 | AGENTS, contrato §4 y condiciones de parada; plan III.9 | «Se reduce el alcance de la función» sin decisión previa. | Mantener alcance y optimizar dentro de lo autorizado, o frenar y pedir una decisión concreta. |
| 60 s de turno más registro/finalización | Spec de la ruta, CA-70: duración total del turno de 60 s | M25a:284 reserva el registro fuera del turno; §7 añade la liberación en finally. | Un presupuesto total que incluya la finalización; maxDuration es la cota de la plataforma. |

## Puntos resueltos durante la revisión

- A-01 del borrador de trabajo del informe: archivos adicionales, resuelto por D-M25a-01/10 y la enmienda del plan.
- A-03: motivo para aclaraciones, resuelto por D-M25a-03 y CA-62 enmendado.
- A-07: preguntas abiertas, span y elecciones de UI/host, resueltos por las decisiones registradas.

Estos IDs se conservan para no renumerar los hallazgos vigentes. No se cuentan como defectos pendientes ni requieren volver a decidirse.

## Hallazgos

Las ubicaciones `spec:N` de esta tabla corresponden a M25a/spec.md, con el hash del encabezado.

| ID | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-02 | Alta | C-03 frente a Diseño §2 y C-60 | La excepción para conexiones vivas no activas ya está resuelta en la ruta y el diseño, pero C-03 exige escribir solo con active. Cumplir C-60 viola literalmente C-03. | spec:163,497,554; D-M25a-02; CA-38c enmendado. | Actualizar C-03 y su trazabilidad de pruebas para incluir la excepción; mantener descarte por disconnected, inexistencia y generación cambiada. No reabrir la decisión tomada. | No. |
| A-04 | Alta | Diseño §8; C-34; T-38 | Las exclusiones de candidatos abren una vía para mostrar cantidades sin claims válidos. | spec:304-306; C-34; T-38; «Trampas y riesgos» frente a CA-50.1/CA-50b. «Hubo un clic» omite un; un entity_name sintético «Gastaste 999 pesos» excluye esa frase completa aunque aparezca como afirmación del modelo, sin distinción tipada de nombre. | Presentar nombres como datos identificados por el servidor, separados de afirmaciones del modelo; distinguir artículo y cantidad por contexto, sin excepción general. Añadir ambos negativos adversarios y no aceptar una regresión por mejorar la tasa de rechazo. | No para sostener la garantía vigente. Debilitarla requeriría enmienda explícita y no es la corrección propuesta. |
| A-05 | Alta | Diseño §9/§11; C-41/C-43; T-45 | Se crea una excepción no autorizada a CA-69 y queda indefinida la abstención cuando la base falla. El DTO exige record_id, pero no define cómo representa que ese ID no corresponde a un registro persistido cuando written=false. Si record_query lanza error, mostrar tool_error tampoco genera por sí solo un registro donde votar. | spec:323,375; C-43; ruta CA-62/CA-69. T-45 solo fija la excepción sin botones para written=false. | Definir DTO y comportamiento para los tres casos: registro confirmado, escritura descartada y fallo/no confirmación del registro. Resolver con la ruta la excepción necesaria, conservando CA-38c. No mostrar un ID de registro como persistido sin confirmarlo. | Sí para exceptuar CA-62/CA-69 por desaparición o fallo del registro. |
| A-06 | Alta | H-07 | La salida ante bajo rendimiento permite reducir alcance sin la decisión explícita que exige el contrato. | spec:715; AGENTS contrato §4 y condiciones de parada; plan III.9. | Sustituir esa salida por diagnóstico/optimización autorizada o parada con propuesta concreta al usuario. Si hace falta otro archivo o migración, aplicar la condición de parada correspondiente. | Solo si se propone reducir alcance o ampliar archivos; la corrección de la regla no necesita una decisión nueva. |
| A-08 | Media | Diseño §3/§4/§8/§9 | La forma común no alcanza para los resultados y consumidores exigidos. values no define identidad por elemento, la convención de período para cada punto diario, parent_ref, segmento ni composición por entidad; solo hay un scope y composition globales. Tampoco se define la pareja de referencias y relación de qualitative_comparison ni la estructura cerrada de blocks. | spec:178-190,211-216,246,302,314,328-347; C-18 y T-18 exigen campos que el ejemplo no incluye. Hay «...», reason abierto y tipos SQL sin cerrar. | Completar contratos por herramienta/bloque/claim, enumeraciones y tipos SQL; definir procedencia interna que toModelView elimina, y ejemplos sintéticos con valores esperados para series, ranking, comparación y desglose. El modelo sigue eligiendo referencias, sin valores autoritativos. | No, salvo que al concretarlo aparezca un cambio de alcance. |
| A-09 | Media | Diseño §3, acciones y desgloses | Falta la fuente de atribución de las acciones de desgloses. La regla de hash presupone attribution, pero la RPC reutilizada no la devuelve y las filas/snapshots de 0017 no conservan ese objeto. Copiar la de una cobertura de otro momento no acredita compatibilidad. | spec:201,216-218; 0017:113-201,521-588; insights.ts:886-903; 0016:1021-1043 solo resuelve la atribución de los niveles. | Explicitar el tratamiento conservador como desconocida y qué operaciones quedan no calculables, con pruebas; o proponer una fuente verificable y su autorización. No inventar atribución ni editar 0016/0017 aplicadas. | Solo si se necesita ampliar extracción, persistencia o alcance. |
| A-10 | Media | Diseño §10; D-M25a-07 | Enviar únicamente tres preguntas anteriores no basta para garantizar resolver aclaraciones. No conserva la pregunta aclaratoria emitida por el asistente ni el orden de alternativas. | spec:364,369,699; D-M25a-07. «Mostrame resultados» → asistente pregunta qué métrica/período → usuario «la segunda opción»: el host recibe preguntas del usuario pero no sabe qué opción se ofreció. | Definir contexto mínimo y verificable de la aclaración pendiente y probar la secuencia completa. Puede ser estado tipado en memoria del navegador, siempre no confiable y con referencias revalidadas en el turno actual. Si la corrección exige otro contexto enviado al host, proponer el ajuste de D-M25a-07 y del acta, sin incorporarlo silenciosamente. | Sí para lo enviado al host; el defecto técnico debe resolverse cualquiera sea la opción. |
| A-11 | Media | Diseño §4; contexto de Data API | La garantía de lecturas pequeñas no cubre entities, que reutiliza una RPC tabular sin límite de período. Falta exigir paginación/conteo o una respuesta acotada explícita: la historia acumulada puede superar el máximo de filas de PostgREST. | spec:91,106,228,244; 0016:1929-1977; insights.ts:841-866,882-883 ya resuelve esta clase de truncamiento con rpcAllRows. H-E1-198 registra el defecto previo. | Especificar lectura completa verificada para entities, aprovechando la lectura existente si corresponde, o una selección acotada que no se declare catálogo completo. Añadir más de 1000 entidades y fallo de página como casos de prueba. | No para evitar truncamiento; sí si la solución pretende cambiar el catálogo autorizado. |
| A-12 | Alta | Diseño §7/§11; CA-70 | El presupuesto de 60 s excluye explícitamente al registro final, aunque la ruta lo define como duración total. Además finally libera el arriendo con otra llamada a worker_api. La cota HTTP de 90 s no implementa el presupuesto de negocio de 60 s. | spec:280-284,294,375; worker-api.ts:163-166; ruta CA-70. Un trabajo de 59 s seguido de registro de 10 s ya excede 60 s antes de liberar el arriendo. | Definir origen y fin del reloj, reservar dentro de los 60 s tiempo para registro/liberación y limitar cada espera por el presupuesto restante. Precisar adquisición del arriendo y salida por timeout. Probar una llamada que consume el margen y fallos de registro/liberación, además del reloj simulado genérico de T-35. | No para cumplir 60 s; sí si se propone ampliar la duración total de CA-70. |

## Verificaciones y límites

- `git status --short --branch`: base `main...origin/main`; únicamente los cambios preexistentes indicados al inicio, antes de crear este informe.
- `git rev-parse --short HEAD`: `b0c854d`.
- Hash: Git Bash no pudo arrancar en el entorno (`Bash/E_ACCESSDENIED`). Se usó Node para leer la spec como UTF-8, conservar los finales de línea, excluir la línea de estado y pasar el contenido directamente como bytes a `git hash-object --stdin`. No se editó la spec ni se normalizaron saltos de línea.
- `git diff --check`: exit 0; aviso de conversión LF→CRLF sobre el cambio preexistente en PIPELINE.
- Primera corrida de `npm run verify`, dentro del sandbox: lint, typegen y typecheck completaron; 28 archivos y 765 pruebas unitarias/de componente pasaron. El build quedó sin salida después de «Creating an optimized production build» durante aproximadamente diez minutos; se interrumpió con Ctrl+C (exit 1). No se atribuye a un defecto de la spec.
- `npm run build` fuera del sandbox: exit 0; compilación en 3,5 s, TypeScript, generación de 13 páginas y finalización completas. Confirma la limitación de la primera corrida.
- Segunda corrida de `npm run verify` fuera del sandbox: **exit 0**. Lint, typegen, typecheck, 28 archivos y **765 pruebas** pasaron; build compilado, TypeScript y generación de 13 páginas completados. Aviso no fatal de jsdom: «Not implemented: navigation to another Document».
- No se ejecutaron `db:push`, `db:push:test`, pgTAP, test:app, evaluaciones pagas ni consultas al proyecto app. Esta auditoría no acredita funcionamiento de M25a, que todavía no existe.
- No se leyó `.env.local`. Next informa su carga automática durante el build; no se inspeccionaron ni mostraron sus valores.

## Observación de tamaño

El alcance excede una microfase ordinaria de ocho horas, pero DEC-24 y la ficha contienen la excepción explícitamente aprobada para M25a. No se exige partirla ni cambiar sus tres etapas: hacerlo reabriría una decisión vigente.

## Siguiente paso

Corregir los contratos técnicos y las contradicciones pendientes. Las decisiones D-M25a-01 a D-M25a-11 ya incorporadas se preservan. Los cambios que afecten la ruta requieren su enmienda coordinada; este informe no la aprueba. Después volver a auditar la spec completa con su nuevo hash. Solo un resultado APROBABLE habilita que el usuario la apruebe y se prepare el plan.
