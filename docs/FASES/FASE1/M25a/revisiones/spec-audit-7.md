# Auditoría de la spec de M25a — ronda 7

- **Fecha:** 2026-11-09 (America/Buenos_Aires).
- **Commit:** `e51f140` (`docs/m25a-spec`). El árbol ya tenía cambios del usuario en `M25a/spec.md` y el informe `spec-audit-6.md` sin seguimiento; se preservaron.
- **Hash de contenido de `M25a/spec.md` sin la línea `**Estado:**`:** `e7006664aca7c33fd3f0f126484371f6db6a692d` (bytes UTF-8 y saltos originales pasados a `git hash-object --stdin`).
- **Precondición:** `spec.md:3` sigue en `BORRADOR`. La auditoría anterior más alta es `spec-audit-6.md`; este informe es la ronda 7.

## Veredicto

**REQUIERE CAMBIOS:** **17 PASS y 1 FAIL**. Hay **un hallazgo alto**, A-53, por una diferencia aún no coordinada con la ruta. A-51 y A-52 de la ronda 6 están resueltos en el borrador actual. `npm run verify` pasó completo.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | Los CA de la ficha (`meta_first/plan.md:342`) figuran en «Heredados» (`spec.md:633-665`), incluidos CA-50, CA-51/52, CA-72/73, CA-38c y CB-06. Los resúmenes coinciden con los CA vigentes. |
| 2 | Alcance | PASS | `spec.md:29-65`, `:597-627` sigue la ficha (`meta_first/plan.md:333-356`) y II.12, II.13 y II.13b. Los archivos adicionales tienen D-M25a-01, -10, -14 o -16 y la enmienda de `plan.md:20`. |
| 3 | Coherencia con la spec general | **FAIL** | `spec.md:377-387`, `:395`, `:706` y `:798` permiten y exigen `user_provided` con `period` nulo. CA-50 de la ruta dice que un claim contiene `period` (`meta_first/spec.md:415-423`, en particular `:417`), y II.13 paso 1 también lo exige (`meta_first/plan.md:735`), sin excepción aprobada para ese `kind`: A-53. |
| 4 | Decisiones | PASS | D-M25a-01 a -17 constan como decisiones del usuario (`spec.md:902-922`); las enmiendas que modifican la ruta figuran en `meta_first/plan.md:18-20`. La excepción de A-53 no figura entre esas decisiones y se trata en el ítem 3. |
| 5 | Trampas | PASS | `spec.md:881-900` recoge las trampas de II.12/13: pregunta fuera de logs, cifras por fuente, 28 frente a 93 días, nombres inyectados, cuenta vacía y timeout. |
| 6 | Intervenciones y acciones reservadas | PASS | `spec.md:864-879` asigna al usuario y comprueba después cuenta/clave, acta, `db:push:test`, `db:push` en `app`, commits, push, despliegue, recorrido y gate; coincide con la ficha y III.2. |
| 7 | Verificación | PASS | `spec.md:852-862` incluye `verify`, `db:check:test`, `test:policies`, `test:app`, adversarias, VR-02, evaluación ampliada y recorrido; ficha `meta_first/plan.md:350-354`, III.3 y CB-06. |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:25`, `:29` registra `G-SYNC` aprobado y M25a habilitada. La rama contiene K01, `0016`, `0017` y el trabajo de M16c; el cambio actual no altera código. |
| 9 | Lo entregado de verdad | PASS | `spec.md:67-112` refleja `worker-api.ts`, `connections.ts`, `insights.ts`, `0016` y `0017`; `chat_coverage` no reutiliza el límite de 28 días. La cobertura por nivel y dimensión de `0017:165-177` está reconocida en `spec.md:250`, `:538`. |
| 10 | Pendientes y hallazgos | PASS | `spec.md:924-958`, `PROJECT_STATE.md` y `HALLAZGOS.md` sitúan H-E1-187, -189, -190, -194, -202 y -185. La comprobación de campos con filas reales sigue diferida con paso y motivo. |
| 11 | Contexto real | PASS | Las referencias `archivo:línea` de `spec.md:67-112` y las nuevas de `:539` existen y corresponden al código: `0016` limita la lectura anterior a 28 días, `0017` guarda cobertura por nivel/dimensión/día y `get_meta_breakdown` la expone bajo RLS. |
| 12 | Archivos previstos | PASS | `spec.md:597-627` coincide con los archivos de II.12, II.13 y II.13b y las autorizaciones de `meta_first/plan.md:20`; los demás son de seguimiento o del pipeline. |
| 13 | Diseño suficiente | PASS | La proyección por `kind` y bloque, la nulabilidad de `user_provided`, los cuatro límites de `period_bound`, los estados de `no_coverage` y el alcance de fechas están concretados en `spec.md:361-398`, `:490-542`. A-53 es una contradicción con la fuente superior, no una elección técnica que falte dentro de este borrador. |
| 14 | Verificable | PASS | C-01 a C-81 tienen caso T-01 a T-91 (comprobación de IDs: ninguno sin prueba), con comandos y resultados (`spec.md:752-850`). T-91 cubre la falsa abstención `no_coverage`; T-41 cubre la salida plana de `user_provided`, aunque este último resultado esperado contradice CA-50 de la ruta. |
| 15 | Sin nada abierto | PASS | `spec.md:942-944` declara cero preguntas abiertas. H-01 a H-11 (`:924-938`) indican comprobación y momento; H-07 se mide antes del push con rollback. |
| 16 | Ejecutable ahora | PASS | `npm run verify` en este árbol: exit 0; lint, typegen, typecheck, 28 archivos/765 pruebas y build de Next con 13 páginas. Los scripts actuales están en `package.json`; `test:eval` y `DEEPINFRA_API_KEY` se agregan en archivos previstos de M25a. No se leyó `.env.local`. |
| 17 | Consistencia interna | PASS | `spec.md:377-398`, C-37 (`:706`) y T-41 (`:798`) coinciden entre sí sobre `user_provided`. `no_coverage` solo lo declara el servidor (`:363`, `:371`, C-81/T-91) y las fechas distinguen nivel/dimensión de entidad (`:250`, `:492`, `:538-540`). |
| 18 | Reglas no negociables | PASS | `spec.md:126-172`, `:311-340`, `:361-371`, `:506-542`, `:852-879` conserva K01 interno, migración nueva, fixtures en desechable, escrituras por `worker_api`, secretos fuera del árbol y errores redactados. El modelo ya no puede declarar `no_coverage`. |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| `user_provided` no usa `period` y T-41 rechaza `period` no nulo (`M25a/spec.md:387`, `:798`) | CA-50 de `meta_first/spec.md:417` y paso 1 de II.13 en `meta_first/plan.md:735` describen `period` como parte del claim sin excepción por `kind` | El borrador hace que el valor nulo sea obligatorio, mientras la ruta exige el campo. La ruta sí distingue la validación especial de `user_provided` en CA-50 punto 6 (`meta_first/spec.md:442`), pero no retira `period` de su estructura. | Coordinar una precisión explícita en la ruta aprobada sobre campos aplicables por `kind` —incluido `user_provided`— o ajustar la spec de M25a para suministrar y validar un `period` coherente. A-53. |

## Hallazgos

| ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-53 | **Alta** | CA-50 / salida plana | La corrección de la ronda 6 decidió que `user_provided` carece de período y prueba que cualquier período no nulo se rechace. Esa excepción no está en la ruta vigente, donde `period` forma parte del claim. El implementador tendría que escoger qué contrato prevalece, y la jerarquía obliga a seguir la ruta. | `M25a/spec.md:377-387`, `:395`, `:706`, `:798`; `meta_first/spec.md:415-423`, `:442`; `meta_first/plan.md:735`, `:739`; enmienda vigente `meta_first/plan.md:20` solo precisa `span` en CA-50 | Definir con el usuario la excepción de campos por `kind` y enmendar coordinadamente CA-50/II.13 si se conserva `period` nulo, o hacer que M25a declare y compruebe el período sin cambiar la ruta. Luego alinear C-37 y T-41 y auditar otra vez. | **Sí**, si se cambia el contrato de la ruta. |

## Verificaciones y límites

- Estado inicial: `M25a/spec.md` modificado y `spec-audit-6.md` sin seguimiento; se preservaron. Solo se añadió este informe. `git diff --check` no detectó espacios problemáticos en los cambios existentes.
- `npm run verify`: **exit 0**. Lint, typegen, typecheck, 28 archivos/765 pruebas y build de 13 páginas pasaron. No se ejecutaron `test:policies`, `test:app`, VR-02 ni consultas a `app`; M25a aún no se implementó.
- Se revisaron `AGENTS.md`, el borrador completo y sus cambios desde la ronda 6, la ficha y etapas de la ruta, su spec general, `PROJECT_STATE.md`, `HALLAZGOS.md`, la evidencia de M16c, `SECURITY.md`, el código citado y los contratos que consumiría M28.3a. Las rondas anteriores sirvieron para comprobar correcciones, no para heredar el veredicto.
- La ficha y DEC-24 exceptúan M25a del límite de 8 horas; no corresponde sugerir otro corte sin reabrir esa decisión.

## Siguiente paso

Resolver A-53 con el contrato de la ruta, ajustar la spec y T-41 según esa decisión y auditar de nuevo. Esta auditoría no aprueba la spec, no inicia M25a y no cambia `G-CHAT`.
