# Auditoría de la spec de M25a — ronda 6

- **Fecha:** 2026-11-09 (America/Buenos_Aires).
- **Commit:** `e51f140` (`docs/m25a-spec`); árbol limpio al comenzar.
- **Hash de contenido de `M25a/spec.md` sin la línea `**Estado:**`:** `fef6a34ecb0469f601343988cf068b5ecd1f9093` (bytes UTF-8 y saltos originales, `git hash-object --stdin`).
- **Precondición:** `spec.md:3` sigue en `BORRADOR`. La auditoría más alta anterior era `spec-audit-5.md`.

## Veredicto

**REQUIERE CAMBIOS.** Hay **13 PASS y 5 FAIL**, con **3 hallazgos**: uno alto y dos medios. Las correcciones de la ronda 5 resuelven A-08, A-33, A-34, A-39, A-45, A-47 y A-50; A-31 también quedó resuelto porque `npm run verify` terminó con exit 0 en este árbol. La nueva presentación de `no_coverage` aún permite afirmar que faltan datos sin evidencia de una herramienta.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | Los CA de la ficha (`meta_first/plan.md:342`) están resumidos en `spec.md:631-662`; CA-51, CA-52 y CA-73 reflejan el texto vigente (`:638-640`, `:655`; `meta_first/spec.md:468-470`, `:411`). |
| 2 | Alcance | PASS | `spec.md:29-65`, `:595-625`; ficha y etapas de `meta_first/plan.md:333-356`, II.12, II.13 y II.13b. D-M25a-17 precisa CA-73 dentro del chat. |
| 3 | Coherencia con la spec general | FAIL | `spec.md:371`, `:536-538` acepta el motivo `no_coverage` sin consultar y muestra una ausencia como hecho. La ruta distingue ausencia de cobertura de ausencia de filas y no permite inferir actividad (`meta_first/spec.md:356`, CA-43), mientras CA-72/73 exige informar lo que se tiene (`:410-411`): A-51. |
| 4 | Decisiones | PASS | D-M25a-01 a -17 figuran como decisiones del usuario (`spec.md:898-918`), con enmiendas de la ruta (`meta_first/plan.md:18-20`). D-17 amplía el texto de CA-73; el defecto A-51 está en su implementación propuesta. |
| 5 | Trampas | PASS | `spec.md:877-896` recoge las trampas de II.12/13, la guarda de cifras, el límite de 28 días, nombres inyectados y la cuenta sin actividad. |
| 6 | Intervenciones y acciones reservadas | PASS | `spec.md:860-875` asigna al usuario `db:push:test`, `db:push` en `app`, cuenta y clave, acta, commits, push, publicación y gate, con comprobación posterior; coincide con ficha e III.2. |
| 7 | Verificación | PASS | `spec.md:848-858` incluye `verify`, `db:check:test`, pgTAP, `test:app`, adversarias, VR-02 y recorrido, según la ficha (`meta_first/plan.md:350-354`), III.3 y CB-06. |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:25`, `:29` registra `G-SYNC` aprobado y M25a habilitada; la rama contiene K01, `0016`, `0017` y M16c. El commit actual solo cambió documentación. |
| 9 | Lo entregado de verdad | PASS | `spec.md:67-112` contrasta las interfaces de `worker-api.ts`, `connections.ts`, `insights.ts`, `0016` y `0017`; la lectura de desgloses de `0017:521-581` y sus tablas se usan según lo entregado. |
| 10 | Pendientes y hallazgos | PASS | `spec.md:920-954`, `PROJECT_STATE.md` y `HALLAZGOS.md` tratan H-E1-187, -189, -190, -194, -202 y -185; la comprobación con filas reales queda diferida con paso y motivo. |
| 11 | Contexto real | PASS | Se comprobaron las referencias de `spec.md:67-112` frente a los archivos citados, incluidos el tope de 28 días de `0016`, el de 93 de `0017`, el contrato de `worker_api`, las pantallas y las guías de Next locales. |
| 12 | Archivos previstos | PASS | `spec.md:595-625` coincide con la tabla de Parte II y las autorizaciones de D-M25a-01, -10, -14 y -16 en `meta_first/plan.md:20`. |
| 13 | Diseño suficiente | FAIL | `spec.md:371`, `:536-538` no define una comprobación del estado antes del texto de `no_coverage` sin herramienta (A-51). `chat_coverage` solo admite nivel (`:261`), aunque §11 lo usa para contestar consultas por entidad (A-52). La proyección de `user_provided` no determina su período obligatorio (`:377`, `:387`, `:395`; A-53). |
| 14 | Verificable | FAIL | Los criterios C-01 a C-80 tienen casos T-01 a T-90 y comandos. Pero T-89 (`spec.md:843`) da por válido el caso de abstención sin consulta y no exige verificar cobertura antes de afirmar que falta; T-41 (`:795`) no define un caso válido con período para `user_provided`: A-51, A-53. |
| 15 | Sin nada abierto | PASS | `spec.md:938-940` no tiene preguntas abiertas. H-01 a H-11 (`:920-934`) indican cómo y cuándo se verifican, incluida la medición SQL antes del push de H-07. |
| 16 | Ejecutable ahora | PASS | `npm run verify` en esta rama: exit 0; lint, typegen, typecheck, 28 archivos/765 pruebas y build de Next con 13 páginas. Scripts actuales en `package.json`; la clave prevista se agrega por nombre a `.env.example` en M25a. No se leyó `.env.local`. |
| 17 | Consistencia interna | FAIL | `user_provided` se declara «sin referencia», pero el esquema común le exige `period` y solo deja nulo ese campo para dos períodos (`spec.md:377-395`), sin fuente ni validación para ese valor (A-53). El texto de §11 usa cobertura por nivel para una consulta por entidad sin rotular el alcance (A-52). |
| 18 | Reglas no negociables | FAIL | `AGENTS.md:70` prohíbe que el LLM produzca estados autoritativos. `spec.md:371`, `:536-538` permite que `abstain_reason = no_coverage` del modelo se convierta en «No tengo datos de ese período» aun sin consulta; la lectura auxiliar se describe para fechas, no como condición para declarar ausencia (A-51). K01, migración nueva, desechable, `worker_api`, secretos y errores redactados sí están contemplados. |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| Abstención `no_coverage` sin consultar (`spec.md:371`, `:536-538`, `:843`) | `AGENTS.md:70`; semántica de ausencia de CA-43 (`meta_first/spec.md:356`) | El modelo puede elegir el estado; el servidor genera «No tengo datos» aunque no haya probado el período pedido. La consulta auxiliar usa incluso el período por defecto cuando no hay resultados. | Exigir un resultado de cobertura pertinente y comprobarlo en el servidor antes de emitir `no_coverage`. Sin período o alcance verificable, aclarar o usar una abstención que no afirme ausencia. A-51. |

## Hallazgos

| ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-51 | Alta | Elección, `no_coverage` y T-89 | Una salida del modelo `abstain(no_coverage)` sin herramientas se presenta como estado comprobado. Si la pregunta pide un período histórico, el fallback consulta el período por defecto, que no prueba nada sobre el pedido. | `spec.md:363`, `:371`, `:527-538`, `:843`; `AGENTS.md:70`; `meta_first/spec.md:356` | Aceptar `no_coverage` solo con una lectura de cobertura del período y alcance pedidos cuya composición confirme la ausencia; si faltan datos para comprobarlo, repreguntar o usar texto fijo sin afirmar falta de datos. Probar también el caso con cobertura existente y abstención falsa del modelo. | No; es una corrección de la regla vigente. |
| A-52 | Media | Fechas cercanas de `no_coverage` | La lectura auxiliar `chat_coverage` recibe `level` y período, no `entity_ref`. Para una campaña o anuncio sin datos puede usar días cubiertos de otras entidades y decir «Tengo datos hasta...», sin aclarar que la fecha corresponde al nivel. En `breakdown`, la cobertura es por nivel y dimensión, no por entidad. | `spec.md:261`, `:527-538`, `:843-844`; `0017_meta_breakdowns.sql:165-177`, `:572-580`; CA-43 (`meta_first/spec.md:356`) | Definir el alcance de cada fecha. Si el texto habla de la entidad pedida, obtener fechas para esa entidad; si usa cobertura del nivel o dimensión, nombrarla explícitamente. Añadir un caso con dos entidades de coberturas distintas. | No. |
| A-53 | Media | `projectOutput` y `user_provided` | El esquema exige `period` en todo claim y solo admite nulo cuando hay `period_a` y `period_b`, pero `user_provided` no refiere una herramienta ni se indica de dónde sale un período verificable. El implementador debe inventar un valor o rechazar una cifra del dueño que CA-50 permite. | `spec.md:377`, `:379-395`, `:414`, `:704`, `:795`; CA-50 (`meta_first/spec.md:415-423`, `:442`) | Precisar la procedencia y validación de `period` para `user_provided`, incluida una pregunta con dos períodos o sin consulta de herramienta; si se decide permitir nulo, coordinar la precisión con CA-50 de la ruta. Probar una salida plana válida. | No si se conserva el contrato de la ruta; sí si se cambia CA-50. |

## Verificaciones y límites

- `git status --short --branch` estaba limpio al comenzar; `HEAD=e51f140`. Solo se agregó este informe; no se editó la spec ni la ruta.
- Se contrastaron `AGENTS.md`, la spec de M25a, la ficha y etapas de M25a y M28.3a, III.2/3/9, la spec general, `PROJECT_STATE.md`, `HALLAZGOS.md`, evidencia de M16c, `SECURITY.md`, `ARCHITECTURE.md` y el código citado. Las auditorías anteriores sirvieron para revisar correcciones, no para heredar el veredicto.
- `npm run verify`: **exit 0**. Pasaron lint, typegen, typecheck, 28 archivos/765 pruebas y build. No se corrieron `test:policies`, `test:app`, evaluaciones pagas ni pruebas contra `app`; M25a no está implementada.
- La excepción de DEC-24 y la ficha de M25a la eximen del límite de 8 horas; no se recomienda otro corte sin reabrir esa decisión.

## Siguiente paso

Corregir A-51, A-52 y A-53 en la spec, agregar los casos indicados y volver a auditar. Este informe no aprueba la spec, no inicia M25a y no cambia `G-CHAT`.
