# M25a — Plan de implementación

**Estado:** APROBADO

Estados posibles: `BORRADOR` → `APROBADO`. Solo el usuario pasa un plan a `APROBADO`; la regla general exige antes una auditoría APROBABLE. Para la enmienda H-E1-211, el usuario aprobó expresamente una excepción única sin nueva auditoría.

**Spec base:** `docs/FASES/FASE1/M25a/spec.md`, aprobada expresamente por el usuario con hash de contenido `290f5e264be8c963e915bd540bc2814a028f392b` después de la enmienda H-E1-211. La auditoría 14 corresponde al hash previo `f99c64a50aae827062f399bee50cfa3ae9362d5f`; no se realizó una auditoría de la versión enmendada.

**Enmienda H-E1-211:** el usuario aprobó el 2026-11-09 el alcance documental de `0019` ([propuesta](revisiones/propuesta-enmienda-0019.md)) y aprobó expresamente este plan enmendado sin `plan-audit-3`. La excepción se limita a esta enmienda mínima: `0019` reemplaza solo `public.chat_ranking`. No altera las auditorías de otras etapas ni autoriza `0020`. El usuario aplicó `0019` en el paso 6c y el control técnico de .1 quedó verde; el commit del paso 7 permanece a su cargo.

**Fuentes:** `AGENTS.md`; ficha M25a y enmiendas de la Parte I; II.12, II.13, II.13b y transversales de la ruta; spec enmendada aprobada por excepción expresa del usuario; plantilla `docs/_templates/mf-plan.md`; código actual.

**Base inspeccionada:** `3eaf561`, rama `docs/m25a-spec`. Hay cambios documentales e informes preexistentes que deben preservarse. La implementación del chat todavía no existe.

Una sola microfase en `mf/M25a`, con tres etapas, commits del usuario al terminar cada etapa y un único gate, `G-CHAT`. Rige la excepción aprobada al límite de ocho horas. Los controles intermedios no aprueban gates.

**Hash de contenido de este plan.** Se calcula sin la línea de estado:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M25a/plan.md | git hash-object --stdin
```

## Archivos

Esta lista es el alcance de archivos de la microfase. Está contenida en la tabla de la Parte II de la ruta y sus enmiendas, más los archivos de seguimiento y pipeline autorizados por sus precondiciones 8 y 9.

Todas las rutas de la tabla son relativas a la raíz del repositorio. Las agrupaciones con llaves enumeran archivos concretos; no autorizan otros archivos vecinos.

| Archivo | Nuevo o modificado | Paso | Autorizado por |
|---|---|---|---|
| `supabase/migrations/0018_chat_queries.sql` | Nuevo | 1, 4 | II.12.1, .6, .9; I.5 |
| `supabase/migrations/0019_chat_ranking_composition.sql` | Nuevo | 6b | Enmienda H-E1-211 de la ruta, II.12.11 y spec §2 |
| `supabase/tests/15_chat_queries.test.sql` | Nuevo | 1, 4 | II.12.2 |
| `supabase/tests/{09_integration_privileges,10_demo_closure}.test.sql` | Modificados | 1, 4 | II.12.2; D-M25a-01 |
| `src/modules/integrations/db/worker-api.ts` | Modificado | 1 | D-M25a-01 |
| `src/modules/chat/redaction.ts`; `tests/unit/chat-redaction.test.ts` | Nuevos | 2 | II.12.3–4 |
| `src/modules/chat/tools/{schema,execute,results,action-labels}.ts` | Nuevos | 3, 18 | II.12.5–10; D-M25a-01 |
| `tests/unit/chat-tools.test.ts`; `tests/app/chat-tools.test.ts` | Nuevos | 3, 6, 18 | II.12.8 |
| `src/modules/chat/{limits,prompt,decimal,scale}.ts` | Nuevos | 2–3, 9–12, 17–20 | Rutas sugeridas dentro del módulo, introducción de Parte II |
| `src/modules/chat/{output-schema,llm,numeric-candidates,guard,render,orchestrator,actions}.ts` | Nuevos | 9–12, 17–18 | II.13.1–7; II.13b.2, .4 |
| `tests/unit/chat-{llm,guard,adversarial,render,orchestrator}.test.ts` | Nuevos | 9–12, 17–18, 20 | II.13.9; D-M25a-01 |
| `src/app/(app)/app/chat/page.tsx` | Modificado | 13 | II.13.8 |
| `src/components/app/{chat.tsx,chat.module.css}` | Modificados | 13, 17–18 | D-M25a-01 |
| `src/components/chat/` | Nuevo: componentes y estilos de los 19 bloques | 13, 17 | II.13b.3 |
| `tests/component/chat-{pantalla,bloques}.test.tsx` | Nuevos | 13, 17–18 | D-M25a-01 |
| `tests/component/{app-pantallas,app-paginas-sesion}.test.tsx` | Modificados | 13 | D-M25a-01, D-M25a-14 |
| `src/app/(app)/app/uso-y-costos/page.tsx`; `src/app/(app)/app/page.tsx`; `tests/component/uso-costos-aviso.test.tsx` | Modificados y nuevo | 19 | D-M25a-10, D-M25a-16 |
| `package.json`; `vitest.config.mts` | Modificados | 9, 14 | D-M25a-01 |
| `tests/eval/chat-eval.test.ts`; `tests/eval/fixtures/` | Nuevos | 14, 21 | D-M25a-01 |
| `docs/FASES/FASE1/meta_first/vr-02.md` | Nuevo | 14, 21 | II.13.10; II.13b.5 |
| `.env.example`; `docs/FASES/FASE1/meta_first/entorno.md` | Modificados | 8–9, 26 | D-M25a-01 |
| `scripts/chat-seed-test.mjs` | Nuevo | 22–23 | D-M25a-01 |
| `docs/FASES/FASE1/M03a/acta-meta.md` | Modificado | 16 | II.13b.1 |
| `docs/SECURITY.md`; `docs/ARCHITECTURE.md` | Modificados | 16, 24, 28 | II.13b.1; contrato documental |
| `docs/HALLAZGOS.md`; `docs/PROJECT_STATE.md`; `docs/FASES/FASE1/meta_first/sesiones/M25a.md` | Seguimiento | 0–28, cuando corresponda | Precondición 8 de la ruta |
| `docs/FASES/FASE1/M25a/plan.md`; `revisiones/*.md` del mismo directorio | Pipeline | Antes de implementar; 24 | Precondición 9 de la ruta |

La enmienda H-E1-211 cambió el contenido de la spec y dejó obsoletos los hashes de las auditorías anteriores. El usuario aprobó directamente la spec y este plan enmendados, sin `spec-audit-15` ni `plan-audit-3`, como excepción única al pipeline. La decisión y los hashes antes y después constan en `sesiones/M25a.md` y `docs/HALLAZGOS.md`.

No se modifica el runner pgTAP, las migraciones anteriores, `reporting/contract`, `app-data`, `shell.tsx`, `docs/PIPELINE.md` ni otros archivos no listados. El acceso al chat ya existe en la navegación.

## Pasos

**Notación:** `C-NN` significa `M25a-C-NN` y `T-NN`, `M25a-T-NN`. Todos los intervalos son inclusivos.

En los pasos con comportamiento comprobable: escribir primero los casos completos de la spec, ejecutar y registrar el fallo esperado, implementar y repetir hasta verde. No basta con crear una prueba que falle por un error de importación: debe comprobarse también que sus aserciones detectan el comportamiento incorrecto.

Las pruebas manuales, mediciones y controles documentales no usan TDD. T-48 y T-64 son regresiones existentes: no se exige fabricarles un fallo.

### Etapa M25a.1 — Persistencia, redacción y herramientas

| # | Acción | Archivos | Criterios y casos que cubre | Verificación del paso |
|---|---|---|---|---|
| 0 | Revalidar estado Git, hash y aprobación de spec/plan, dependencias y `G-SYNC`. Preparar `mf/M25a` conservando los cambios ajenos; si hace falta ordenarlos o la creación de rama está denegada, interviene el usuario. Registrar inicio y los ocho hallazgos pendientes que enumera la spec, con IDs estables, impacto y asignación, sin corregir archivos ajenos al alcance. | Seguimiento | CB-01–06; dependencias; T-64, T-82–83 | `git status --short --branch`, `git rev-parse HEAD`, comparación de hashes y `npm run db:check:test`. Ninguna dependencia pendiente; diferencias preexistentes identificadas. |
| 1 | **TDD SQL y cliente acotado.** Escribir pgTAP de tablas, ACL, aislamiento, registro, voto, purga, arriendos, cálculos y cobertura. Luego crear `0018` con todo Diseño §§2–3: tablas, helpers INVOKER, lecturas públicas, cuatro funciones nuevas `worker_api` y reemplazo de `purge_connection`. Extender el cliente con firmas, casts y `PX011`; actualizar el catálogo pgTAP de 18 a 22 funciones y el cierre con ambas tablas. | Migración, pgTAP 09/10/15, `worker-api.ts` | C-01–10, C-19–25, C-27, C-33, C-55, C-60, C-72; T-01–09, T-19, T-22, T-24–27, T-30, T-36, T-65, T-78, T-90 | Fallos iniciales documentados; revisión de firmas y privilegios. La verificación verde de SQL se completa en el ensayo del paso 4 y en las suites posteriores al push. |
| 2 | **TDD de redacción.** Implementar la función pura única, con orden de patrones de §5, máscara existente, idempotencia y redacción antes del recorte por puntos de código. Crear los límites iniciales necesarios. | `redaction.ts`, `limits.ts`, prueba de redacción | C-11–13; T-10–12; CA-66 | `npm run test:unit -- tests/unit/chat-redaction.test.ts`: cada patrón, prefijos cortos, fechas, montos, Luhn, límite y doble aplicación. |
| 3 | **TDD de herramientas.** Escribir pruebas unitarias y los casos de integración antes de implementar. Crear las trece herramientas, proyección desde argumentos planos, resultados estrictos, referencias y vista minimizada para el modelo. Resolver período y entidad por defecto en servidor; usar JWT/RLS para lecturas y conservar decimales como texto. Implementar el mapeo exacto de acciones y lectura paginada completa. | Herramientas, `limits.ts`, pruebas unitarias y app | C-14–15, C-17–19, C-26, C-67, C-69, C-72, C-78, C-82; T-13–14, T-16, T-18, T-21, T-29, T-72, T-74, T-77, T-86, T-92. Preparar además todos los casos del paso 6. | `npm run test:unit -- tests/unit/chat-tools.test.ts`. Trece proyecciones válidas; argumentos ajenos rechazados; exactitud fuera de precisión de `number`; contraste de edad/género con `meta-sync.test.ts`. |
| 4 | **Ensayo SQL previo a aplicar.** Con las guardas actuales de destino, ensayar `0018` dentro de la transacción de cada archivo pgTAP y terminar siempre con rollback. Usar un procedimiento temporal fuera del árbol versionado, basado en el ensayo de M16c, sin modificar runners. Incluir 09/10/15 y regresiones existentes. Medir ranking de 93 días y 500 anuncios, con `ANALYZE`, JWT sintético, rol `authenticated` y `SET LOCAL statement_timeout` con el límite efectivo de ese rol. Corregir `0018` solo mientras no esté aplicada. | Migración y pruebas SQL; sesión | C-76; T-84; H-07; casos SQL del paso 1 | `npm run db:check:test` antes de conectar. Registrar comando completo, TAP, tiempos y rollback, sin modificar el historial de migraciones. No ejecutar T-28 por Data API dentro de esta transacción. |
| 5 | **Usuario:** aplicar `0018` al desechable mediante `npm run db:push:test`, únicamente después del ensayo satisfactorio. | Sin cambios adicionales | C-76; CB-03–04 | Repetir guarda de destino; comprobar versión `0018` en el historial y ejecutar `npm run test:policies`. Un defecto SQL posterior detiene la corrida. |
| 6 | Ejecutar los casos preparados contra la **Data API real y el cliente real del rol**. Comprobar RLS, `42501` al leer registros, 93/94 días, precisión, desconexión en vuelo, concurrencia, valores negativos y rendimiento del ranking. | `tests/app/chat-tools.test.ts`; sesión | C-03, C-16–17, C-19, C-21, C-25, C-28, C-33, C-71; T-15, T-17, T-20, T-23, T-28, T-31–32, T-37, T-76 | `npm run db:check:test` y `npm run test:app -- tests/app/chat-tools.test.ts`. Ningún caso omitido; fixtures etiquetados y limpiados. |
| 6b | **Corrección H-E1-211 tras aplicar `0018`.** Añadir pgTAP roja: campaña A con valor mayor y 1/2 días primero, B con 2/2 días última; comprobar `composition.partial` del resultado. Crear `0019` con solo `create or replace public.chat_ranking`, misma firma y grants, sin editar `0018`. Ensayar los 16 pgTAP con rollback por archivo, comparar tendencias y medir `include_trend=false/true` en 93 días × 500 anuncios bajo el timeout efectivo del rol. | `0019_chat_ranking_composition.sql`, pgTAP 15, prueba app T-28; sesión | C-25, C-76; T-27–28, T-82–84; H-E1-211 | `npm run db:check:test`; rojo contra `0018`; ensayo completo verde con `0019` y rollback; JSON de tendencias conservado y ambas mediciones registradas. `0019` permanece sin aplicar. |
| 6c | **Usuario:** ejecutar `npm run db:check:test` y `npm run db:push:test` para aplicar `0019` al desechable. El asistente comprueba el historial y repite pgTAP, T-28 con y sin tendencia por Data API y `npm run test:app`. Un defecto SQL nuevo detiene la corrida; no se edita `0018` ni se crea `0020` automáticamente. | Sin otro cambio SQL; sesión | C-25, C-76; T-28, T-84; CB-03–06 | Historial con `0018` y `0019`; `npm run test:policies` y `npm run test:app` verdes contra la migración aplicada. |
| 7 | Control completo `.1`; registrar resultados y limitaciones. **Usuario:** commit de la etapa en `mf/M25a` después de preservar o integrar ordenadamente los cambios documentales previos. | Seguimiento | T-64, T-82–83; CB-01–06 | Control común completo con `0019` aplicada; diff de migraciones con solo `0018` y `0019` añadidas, ninguna existente modificada; `git log` y árbol limpio tras el commit. No pasar a `.2` con fallos. |

En el paso 1 se aplican expresamente las reglas de atribución, composición por fila y bases de cálculo de la spec: ausencia nunca es cero; tasas recalculadas sobre bases compatibles; costo por resultado y participación usan todo lo informado en cada base; `unknown` se conserva; ventanas conocidas incompatibles de una entidad impiden sumar. El total de cuenta proviene del nivel cuenta.

### Etapa M25a.2 — Modelo, guarda y seis bloques básicos

| # | Acción | Archivos | Criterios y casos que cubre | Verificación del paso |
|---|---|---|---|---|
| 8 | **Usuario:** crear/configurar DeepInfra y cargar `DEEPINFRA_API_KEY` localmente, fuera del chat. Comprobar si ofrece tope de gasto. Actualizar el inventario por nombre y estado, sin leer valores. | `.env.example`, `entorno.md`; sesión | H-08; CA-53b; C-30 | Confirmación de presencia por nombre. La validez se comprueba con la llamada sintética del paso 9. |
| 9 | **TDD del adaptador y esquemas planos.** Implementar `llm.ts`, elección y salida estructurada, dependencias inyectables y errores fijos. Añadir el proyecto `eval` y `test:eval`. Antes de escribir la guarda, probar contra DeepInfra los esquemas de elección y redacción con datos sintéticos: `json_schema` estricto, modelo informado y truncado. Verificar H-01–04; no enviar `reasoning_effort` sin confirmación. | `llm.ts`, `output-schema.ts`, `prompt.ts`, `limits.ts`, prueba LLM, configuración de evaluación, entorno | C-29–31; T-33–34; CA-53, CA-53b | Pruebas unitarias de `fetch`, abortos, respuestas inválidas y errores; llamada sintética con el esquema real. Si falta el modelo informado, cambia la precisión o no funciona el esquema estricto, detenerse. |
| 10 | **TDD de la guarda.** Crear detector, decimales con `BigInt`, proyección por variante y validación pura en el orden de CA-50. Resolver citas y apariciones en servidor; verificar todos los campos y resultados del turno; controlar aliases, cantidades en palabras, comparaciones y lenguaje excluido. Cubrir los ocho casos obligatorios de CA-50b; la herramienta equivocada se puntúa en evaluación. | Detector, decimal, guarda, esquema; pruebas guard/adversarial | C-34–39, C-45–46, C-50, C-62; T-38–43, T-49–50, T-55, T-67 | Suites unitarias de guarda y adversaria. Ningún texto rechazado llega al DTO; ninguna cifra se acepta por aparecer solamente en algún resultado. |
| 11 | **TDD de presentación básica.** Construir DTO estricto, segmentos, pie por caso, avisos fijos, atribución y selección de filas de cada bloque. Implementar escalas exactas; solo la proporción geométrica puede convertirse a `number`. | `render.ts`, `scale.ts`; prueba render | C-40, C-73, C-83; T-44, T-79 —parte aplicable a básicos—, T-93 | Pruebas de pies, períodos múltiples, filas parciales, máscaras, dona y avisos. Ausencias conservadas como `null`, cifras visibles como cadenas exactas. |
| 12 | **TDD del turno y las acciones.** Implementar K01 interno, entrada estricta, redacción previa, arriendo, bucle de elección, ejecución secuencial, guarda, presentación, registro y liberación. Aplicar reloj monotónico de 60 s desde la entrada hasta el DTO, trabajo hasta 50 s y reserva final; limitar cada espera al tiempo restante. Implementar las cuatro salidas, voto, logs mínimos y transcripciones sintéticas. Incluir las bases de contexto, defaults e historia necesarias para que estos contratos ya funcionen. | `orchestrator.ts`, `actions.ts`, `prompt.ts`, límites; pruebas orchestrator/adversarial | C-32, C-41–42, C-54–55, C-61, C-64–65, C-68, C-70, C-74, C-79–81, C-84; T-35, T-45–46, T-59, T-66, T-69–70, T-73, T-75, T-80, T-87–89, T-91, T-94 | Pruebas con reloj y dependencias simuladas. Registro confirmado antes de mostrar; respuesta descartada ausente del DTO; `tool_error` corta el turno; `no_coverage` solo lo decide el servidor al recibir `answer`. |
| 13 | **TDD de la pantalla y básicos.** Conectar ambas acciones sin `revalidatePath`; declarar `maxDuration = 75` en página y resolver `tieneEmpresa`/`conexionActiva`. Implementar tarjeta, líneas, barras, barras agrupadas, dona y tabla. Añadir aviso, votos, pendientes y reintento; retirar adjuntos, internet y sugerencias excluidas. Actualizar mocks de sesión conservando sus aserciones. Sin empresa, enviar deja únicamente el mensaje local. | Página chat, componente y CSS, seis bloques; pruebas de pantalla, bloques, pantallas y sesión | C-43–44, C-46, C-51–53 —básicos—, C-63, C-75, C-84; T-47–48, T-51, T-56–57 —básicos—, T-68, T-81, T-95 | Pruebas component; sesión exigida antes de lecturas; almacenamiento del navegador vacío; votos fallidos sin marcar; tabla equivalente accesible para cada gráfico. |
| 14 | Congelar **antes de ejecutar** el conjunto base: al menos 30 respondibles y 20 abstenciones, con expectativas de herramienta, métrica, período y respuesta. Registrar hashes previos. Ejecutar orquestador real y DeepInfra con herramientas sintéticas inyectadas, sin base. Incluir selección errónea de herramienta y puntuación de aclaraciones. | Motor y fixtures eval; `vr-02.md`; sesión | C-47; T-52; VR-02, DEC-21; CA-50b | `npm run test:eval`; informe con cada umbral, modelo, fp8, esquema estricto, identificador informado, uso y latencia. Diagnosticar fallos sin relajar la guarda. |
| 15 | Control completo `.2`, incluida suite adversaria y `db:check:test`. Registrar VR-02 aprobada. **Usuario:** commit de la etapa. `.3` permanece bloqueada hasta cumplir ambos controles. | Seguimiento | C-48; T-53, T-64, T-82–83; CB-01–06 | Control común, adversaria y VR-02 verdes; sesión y `git log` acreditan el orden; árbol limpio. |

El contrato público nuevo queda fijado por Diseño §§9 y 11: `preguntarChat({ question, previous?, pendingClarification? }) → ChatTurnView` y `votarRespuesta({ recordId, feedback }) → { ok }`. El navegador nunca suministra tenant ni conexión.

### Etapa M25a.3 — Catálogo completo, evaluación y cierre

| # | Acción | Archivos | Criterios y casos que cubre | Verificación del paso |
|---|---|---|---|---|
| 16 | **Primera acción de `.3`:** actualizar acta y documentos según Diseño §14: datos minimizados, contexto previo, aclaración pendiente, registro/voto/arriendo, flujos y riesgos. Corregir en el acta la referencia pendiente de `avatars`. **Usuario:** aprobar nuevamente el acta y declarar comunicación al dueño. Registrar su blob. Ningún dato real llega antes al modelo. | Acta, SECURITY, ARCHITECTURE; seguimiento | C-49, C-59; T-54, T-63 | `git hash-object` del acta; aprobación del usuario y comunicación registradas; revisión del contrato documental. |
| 17 | **TDD del catálogo completo.** Extender esquema, guarda, DTO y componentes a los 19 bloques. Completar resumen de variación, comparación, barras apiladas, ranking, tendencia, desplegable, embudo, calendario, tipos de resultado y los cuatro bloques de contexto. Aplicar exactamente las compatibilidades de §9, incluida atribución y alineación por día en pilas. | Esquema, guarda, render, scale, componentes; pruebas guard/render/bloques | C-50–53, C-73, C-83; T-55–57, T-79, T-93 completos | Pruebas unitarias/component: cada bloque, fuentes incompatibles, faltantes, porcentajes, pila repetida, tabla equivalente, conclusiones con guarda y sugerencias de texto fijo. |
| 18 | **TDD de casos dudosos e historia completa.** Completar criterios de interpretación en prompt, sin clasificador por frases. Cubrir aclaración y continuación, defaults visibles, cambio de formato, historia parcial, huecos y textos por nivel/dimensión. Limitar contexto a tres preguntas redactadas con `[CIFRA]` y una aclaración admisible, sin respuestas previas. | Orquestador, prompt, render y herramientas; pruebas respectivas | C-54–55, C-64–65, C-74, C-81–82; T-59, T-69–70, T-80, T-89, T-91–92 | Transcripciones reproducibles de varios turnos; fechas del servidor; lectura auxiliar acotada y fuera de `tool_names`; claims aislados al turno actual. |
| 19 | **TDD de los avisos de consumo.** Reemplazar el contenido de ejemplo en Uso y costos y la tarjeta Uso de la IA de Inicio por «Todavía no disponible». Mantener la comprobación de sesión. | Dos páginas y prueba de aviso | C-66; T-71 | `npm run test:component -- tests/component/uso-costos-aviso.test.tsx`; sin KPIs, conteos, latencia ni gráficos de ejemplo. |
| 20 | Medir llamadas y tokens con respuestas de varios bloques. Ajustar solo si la medición lo exige, hasta seis herramientas y 2400 tokens por llamada; mantener 60 s. Registrar valor final y motivo **antes de congelar** el ampliado. Repetir regresiones y evaluación base si cambian límites o comportamiento. | `limits.ts`, pruebas afectadas; sesión | C-56; T-60; CA-70 | Medición reproducible por llamada/turno; límites de servidor comprobados; ningún umbral de guarda relajado. Superar los topes exige detenerse y consultar. |
| 21 | Congelar conjunto ampliado, añadiendo al menos 40 casos: seis cálculos, tres dimensiones, los 19 bloques, ambigüedad e historia, `unknown`, incompatibilidad dentro de una entidad y ventanas distintas entre entidades. Puntuar también el bloque elegido. | Fixtures y motor eval; `vr-02.md`; sesión | C-57; T-61; VR-02 | Hash registrado antes de `npm run test:eval`; mismos umbrales DEC-21 que en el conjunto base. |
| 22 | Preparar el recorrido sintético con `--serve` y `--clean <identificador>`. Validar primero destino desechable y coincidencia de las tres referencias de prueba. Crear cuenta, empresa, conexión y datos etiquetados; integraciones se siembran por `worker_api`. Arrancar Next con variables de proceso de pruebas; limpiar exclusivamente esa corrida. | `chat-seed-test.mjs`; sesión | C-77; T-85; CB-04 | URL discordante: aborta antes de escribir o iniciar Next. Corrida válida: limpieza verificable y otra cuenta intacta. Credenciales sintéticas solo en consola local, fuera de evidencia. |
| 23 | **Usuario:** recorrer los 19 bloques en el entorno sintético, a 360 px, con teclado, lector de pantalla y ambos temas. Asistente prepara escenarios y registra resultados redactados. | Sesión | C-53, C-58; T-58 | Sin desborde de página; tablas dentro de sus contenedores; foco visible, nombres accesibles, lectura equivalente y ausencias distinguibles sin depender del color. |
| 24 | Control final completo y revisión documental. Marcar vigentes/existentes solo propiedades probadas. **Usuario:** commit de `.3`. Ejecutar después `/implementation-review M25a` y `/qa-review M25a` sobre la microfase completa, con árbol limpio salvo informes. Corregir dentro del alcance y repetir ambas revisiones si cambia el commit. | Archivos previstos afectados; seguimiento y revisiones | C-59; T-63–64, T-82–83; CB-01–06 | Todas las suites exigidas ejecutadas; auditorías/revisiones favorables sobre el commit correcto. Evidencia y descripción del PR identifican acciones pendientes de publicación. |
| 25 | **Usuario:** comprobar destino `app`, revisar `npm run db:preview` y aplicar `npm run db:push` de `0018` y `0019` en orden, después de validarlas en pruebas y **antes de integrar código en `main`**. | Sin implementación adicional; sesión | C-58; requisito de publicación; CB-03–05 | Historial de `app` contiene ambas migraciones; vista previa posterior sin ninguna pendiente. No ejecutar suites ni fixtures contra `app`. |
| 26 | **Usuario:** cargar clave en Vercel, confirmar presencia por nombre, hacer push de `mf/M25a`, abrir PR, resolver CI/Codex, integrar y desplegar. Si aparecen cambios de código, repetir revisiones antes de integrar. | Inventario de entorno y evidencia, cuando corresponda | CA-53b; cierre de II.13b | Push y PR corresponden al commit revisado; CI verde, sin bloqueantes; migración ya aplicada; despliegue `READY` del commit integrado. |
| 27 | **Usuario:** hacer la pregunta real en la aplicación con su sesión. Verificar cuenta enmascarada, registro/voto y respuesta acorde a cobertura. Con cero filas, declarar el límite: no se validan valores ni tipos reales y no se inventan ceros. | Sesión | C-58; T-62; DEC-24 | Recorrido redactado sobre despliegue publicado; ninguna captura con secretos, montos reales o IDs completos. |
| 28 | Consolidar evidencia y pendientes. **Usuario:** aprobar expresamente `G-CHAT`. Solo entonces registrar M25a cerrada y M28.3a habilitada; no iniciarla. | PROJECT_STATE, HALLAZGOS, sesión; documentos transversales si falta completar estados probados | Condición para avanzar; C-59; CB-05–06 | Frase de aprobación registrada, enlaces a evidencia y riesgos temporales; ningún gate aprobado automáticamente. |

### Trazabilidad de criterios heredados

Esta tabla complementa los IDs operativos de cada paso.

| Criterios heredados | Pasos |
|---|---|
| CA-48, CA-49, CA-44, CA-44b, DEC-23 y §11 | 1, 3–6, 10–11, 17 |
| CA-50, CA-50b, CA-50c, CA-54, CA-55 | 9–14, 17–18, 21 |
| CA-51, CA-51b, CA-52 | 1, 3, 6, 11–13, 17–18, 27 |
| CA-53, CA-53b y VR-02/DEC-21 | 8–9, 12–15, 20–21, 26 |
| CA-61–66, CA-69 y CA-38c | 1–3, 6, 10–13, 16 |
| CA-70 | 1, 3–6, 9, 12–15, 20–21 |
| CA-71, CA-72, CA-73 | 3, 10–14, 17–18, 21–23 |
| CA-67 y CA-68 | 1, 4–7; se verifica el cierre con fixtures, sin ejecutar el cierre real del piloto |
| DEC-24 | 7, 15, 17, 23–28 |
| CB-01–06 | 0, 4–7, 15, 22, 24–28 |

Los pasos cubren los **84 criterios operativos y los 95 casos**. La repetición de algunos casos corresponde a su implementación básica en `.2` y su extensión completa en `.3`.

## Verificación final

Desde la raíz del repositorio, en **cada control de etapa**:

```powershell
npm run verify
npm run db:check:test
npm run test:policies
npm run db:check:test
npm run test:app
```

En `.2` y `.3`, además:

```powershell
npm run test:unit -- tests/unit/chat-adversarial.test.ts
npm run test:eval
```

`test:eval` se añadirá como `vitest run --project eval`; no formará parte de `verify`. Ejecutará el orquestador real con DeepInfra y resultados sintéticos inyectados, sin base.

Cada evaluación exige:

- Cero cifras sin respaldo mostradas.
- Exactitud ≥ 90 %.
- Rechazos injustificados ≤ 10 %.
- Abstención correcta ≥ 95 %.
- Latencia p95 del turno ≤ 20 s.
- Modelo, fp8, esquema estricto e identificador informado comprobados.
- Hash del conjunto registrado antes de ejecutar; puntuación de aclaraciones según §12.

Cada paso TDD usará el comando dirigido que fija su caso en la spec. La sesión conservará comandos, resultados reales, casos ejecutados, limitaciones y archivos opt-in ajenos omitidos con su motivo. **CB-06:** ninguna prueba requerida de M25a puede omitirse ni contarse como aprobada por falta de configuración.

Revisar también:

```powershell
git diff --name-status <base-registrada> -- supabase/migrations/
git status --short --branch
```

Antes del commit, `git status --short -- supabase/migrations/` debe mostrar solo `0018` y `0019` como nuevas; `git diff` no incluye archivos sin seguimiento. Después del commit, el diff contra la base debe mostrar únicamente la adición de esas dos migraciones, sin modificar ninguna anterior. El diff completo se inspecciona para datos reales e identificadores que la guarda automática de secretos no detecta.

## Intervenciones del usuario y acciones reservadas

| Paso | Acción reservada | Verificación posterior |
|---|---|---|
| Antes de ejecutar | Reflejar aprobación de spec y plan; para H-E1-211 rige la excepción única de aprobación directa del usuario sin nuevas auditorías | Estados y hashes correctos; otras auditorías siguen vigentes |
| 0 | Resolver orden documental previo o crear `mf/M25a` si está denegado | Rama y cambios preservados |
| 5 | `npm run db:push:test` | Historial, pgTAP y Data API reales |
| 6c | `npm run db:check:test` y `npm run db:push:test` de `0019` | Historial de `0018` y `0019`, pgTAP y Data API reales |
| 7, 15, 24 | Commits de cada etapa | Commit registrado y árbol limpio |
| 8 | Cuenta DeepInfra y clave local | Presencia por nombre y prueba sintética |
| 16 | Reaprobación del acta y comunicación al dueño | Blob y declaraciones registradas |
| 23 | Recorrido sintético | Matriz de 19 bloques y evidencia visual redactada |
| 25 | `db:preview` y `db:push` en `app` | `0018` y `0019` aplicadas en orden antes del código en `main` |
| 26 | Clave en Vercel, push, PR, integración y despliegue | CI/Codex satisfactorios y despliegue `READY` |
| 27 | Pregunta real con su sesión | Recorrido publicado, redactado |
| 28 | Aprobación de `G-CHAT` | Estado actualizado solo tras aprobación explícita |

El asistente prepara resultados concretos y verificables antes de cada intervención. No ejecuta commits, pushes, despliegues ni ninguno de los dos `db:push`, conforme a la spec y los permisos del proyecto.

## Migraciones

- `0018_chat_queries.sql` sigue siendo la migración base del chat; su predecesora es `0017_meta_breakdowns.sql`. `0018` se ensayó con rollback y el usuario la aplicó al desechable. No se edita.
- **`0019_chat_ranking_composition.sql`** es la única corrección excepcional de H-E1-211: reemplaza solo `public.chat_ranking` mediante `create or replace`, con la misma firma y grants. Se ensayó con rollback; el usuario la aplicó al desechable con `db:push:test` antes del control final de .1.
- Otro defecto SQL detiene la corrida; no se crea `0020` sin una decisión y autorización documental nuevas.
- Una reversión persistente requiere una migración nueva, con el siguiente número disponible y autorización documental previa. No se ejecuta un rollback destructivo ni se modifica el historial.
- La aplicación de `0018` y `0019` en orden en `app` ocurre después de pruebas y revisiones, antes de integrar el código en `main`.

## Riesgos

- **Compatibilidad del proveedor:** la documentación distingue `json_schema` de `json_object`, pero el esquema concreto debe probarse contra el modelo. H-01–04 se resuelven en el paso 9 y VR-02. [Salida estructurada de DeepInfra](https://docs.deepinfra.com/chat/structured-outputs).
- **Modelo variable:** la ficha consultada muestra fp8; no acredita un despliegue inmutable. Revalidar en las evaluaciones y repetir VR-02 antes de la demo si pasó tiempo. [Ficha del modelo](https://deepinfra.com/deepseek-ai/DeepSeek-V4.1-Flash).
- **Privacidad:** mantener el riesgo mayor acordado en el acta, aunque la página actual declare que no conserva contenido. Registrar fuente y fecha sin rebajar D-M25a-11. [Privacidad de DeepInfra](https://docs.deepinfra.com/account/data-privacy).
- **Latencia y truncado:** medir el bucle completo, razonamiento, tokens y finalización; ajustar solo dentro de §13. Dos iteraciones sin converger obligan a detenerse.
- **Volumen SQL:** el peor caso debe pasar tanto el ensayo como T-28 por Data API; no reducir período, nivel o entidades para conseguir un resultado verde.
- **Atribución y datos reales:** conservar advertencias de `unknown` y ventanas distintas. H-E1-189, H-E1-194 y H-09/10/12 siguen pendientes de la primera sincronización con filas.
- **Operaciones tardías:** una escritura que termina después del plazo puede dejar un registro sin respuesta mostrada; la idempotencia evita duplicados. Un arriendo no liberado vence por TTL.
- **Interpretación:** la guarda protege cifras y referencias; la elección semántica se mide mediante evaluación. No presentarla como garantía determinística.

Cualquier contradicción nueva, archivo fuera de alcance, dependencia pendiente, fallo de aislamiento o necesidad de intervención detiene el trabajo afectado y se registra conforme a III.9.

## Qué no se hace

No se implementan ROAS, causas, recomendaciones, rentabilidad, benchmarks, carga histórica, consultas directas a Meta desde el chat, memoria persistente, RAG, streaming, adjuntos, búsqueda en internet, workers ni medición real de consumo.

No se cambia de modelo o proveedor, no se modifican extracciones ni migraciones anteriores, no se añaden dependencias gráficas y no se ejecutan suites o fixtures contra `app`.

Guardar este documento en BORRADOR no inicia M25a ni aprueba el plan o el gate.

