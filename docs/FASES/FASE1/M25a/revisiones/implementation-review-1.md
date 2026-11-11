# Revisión de implementación M25a — 1

## Estado revisado

- Fecha: 2026-11-10 (America/Buenos_Aires).
- Rama: `mf/M25a`; commit: `0fd0189084241fa3014a552506992ce6f16a6297`.
- Estado inicial (`git status --porcelain=v1`): ` M docs/PROJECT_STATE.md`. Es un cambio preexistente del usuario y se preservó.
- Hash del estado sin informes de revisión: `b3e2c661b0fa75c1f6b82d4fdc3895be86596cc1`. Se calculó con `git diff main -- . ':(exclude)docs/FASES/FASE1/*/revisiones/*' ':(exclude)docs/FASES/FASE1/meta_first/sesiones/*-review-*' | git hash-object --stdin` mediante `subprocess` para conservar los bytes de Git; no había archivos sin seguimiento.
- Entrada excepcional: el usuario pidió iniciar la revisión tras marcar M25a «TERMINADA», pese a que no figura el estado literal `VERIFICADO — PENDIENTE DE APROBACIÓN` exigido por la skill. La revisión se inició por esa instrucción expresa. No se interpreta «TERMINADA» como aprobación de `G-CHAT`.

## Veredicto: BLOQUEADO

**Revisión temprana detenida por contradicción con la fuente de mayor jerarquía.** La Parte I de la ruta exige cifras verificadas y VR-02 aprobada (`meta_first/plan.md:343-346`); la spec de la ruta exige validación determinística de cada cifra, redacción antes de enviar la pregunta al modelo y los umbrales de DEC-21 (`meta_first/spec.md:431-460,492,520-534`). La enmienda H-E1-228 del plan M25a retira la guarda, envía la pregunta sin redactar y declara sin vigencia esas obligaciones solo en el plan de menor jerarquía (`M25a/plan.md:11`). La Parte I y la spec de la ruta no se enmendaron para esa decisión. `AGENTS.md` ordena frenar y reportar ante una contradicción entre ruta, spec, plan o código. No se siguió con pruebas ni roturas después de constatarla.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Alcance | FAIL | La excepción H-E1-228 altera propiedades exigidas por Parte I y spec de la ruta sin enmendarlas; la revisión completa de los 84 archivos del diff se detuvo. |
| 2 | Criterios | FAIL | CA-50b y CA-66 se contradicen con el comportamiento actual; VR-02 vigente no fue aprobada ni repetida después de H-E1-228. |
| 3 | Las pruebas detectan roturas | FAIL | No se ejecutaron mutaciones: parada obligatoria por contradicción antes de modificar temporalmente archivos. |
| 4 | Reejecución | FAIL | No se ejecutaron `npm run verify` ni suites de III.3 por la misma parada; los resultados históricos no acreditan el estado actual. |
| 5 | Seguridad y reglas | FAIL | La pregunta viaja sin redacción al modelo (`orchestrator.ts:222,316-326`), contra CA-66/DEC-11. La búsqueda acotada no encontró `service_role` en `src/modules/chat`; no se leyó `.env.local`. Las migraciones `0018` y `0019` son nuevas en el diff; no se modificó una existente. No se completó el resto del checklist de seguridad. |
| 6 | Calidad funcional | FAIL | El texto del modelo se muestra tal cual, incluidas cifras sin cotejo (`chat-output-schema.test.ts:11-14`, `chat-orchestrator.test.ts:297-309`), contra CA-50b. |
| 7 | Evidencia | FAIL | `sesiones/M25a.md:501-509` declara que no se corrió `test:eval` tras retirar la guarda y cambiar el prompt; `vr-02.md:75` exige repetir ambas evaluaciones. `PROJECT_STATE.md:29` dice «TERMINADA» pero `G-CHAT` pendiente. |
| 8 | Contradicciones | FAIL | Contradicción documentada entre Parte I, spec de la ruta, plan M25a y código. |

## Matriz de criterios (parcial por parada obligatoria)

| Criterio | Prueba | Aserción verifica el criterio (sí/no) | Resultado |
|---|---|---|---|
| CA-50b: ninguna cifra sin claim válido | `tests/unit/chat-output-schema.test.ts:11-14`; `tests/unit/chat-orchestrator.test.ts:297-309` | No: las aserciones exigen aceptar y mostrar cifras textuales sin verificación | Contradice el criterio; no reejecutada |
| CA-66/DEC-11: redactar antes de enviar al modelo | `tests/unit/chat-orchestrator.test.ts:415` | No: fija el envío literal, contrario a la spec vigente | Contradice el criterio; no reejecutada |
| VR-02/DEC-21: base y ampliada aprobadas | `tests/eval/chat-eval.test.ts`; `tests/eval/expanded-eval.test.ts` | No se comprobó para la versión actual | Sin corrida posterior a H-E1-228; resultados anteriores inválidos para el diseño actual |
| CA-71: bloques con valores del servidor | `tests/component/chat-bloques.test.tsx` | No evaluada en esta revisión | No reejecutada |

Los demás criterios heredados y operativos quedan sin evaluar por la condición de parada. Esta matriz no acredita cobertura completa.

## Roturas

| Criterio | Rotura | Prueba que la detectó | Restaurado (cmp) |
|---|---|---|---|
| — | No se introdujeron roturas por la parada obligatoria | — | No se modificó implementación |

## Comandos reejecutados y resultados

- `git branch --show-current`: `mf/M25a`.
- `git rev-parse HEAD`: `0fd0189084241fa3014a552506992ce6f16a6297`.
- `git status --porcelain=v1`: un único cambio preexistente, `docs/PROJECT_STATE.md`.
- `git diff --stat main...HEAD`: 84 archivos, 12 704 inserciones y 271 eliminaciones.
- `git diff --stat`: solo `docs/PROJECT_STATE.md`.
- `git diff --name-status main...HEAD -- supabase/migrations`: dos altas (`0018`, `0019`), sin modificación de migraciones anteriores.
- `git ls-files --others --exclude-standard`: vacío.
- Se leyeron las instrucciones, la ficha de Parte I, III.3, el paso 24, CA-50b, CA-66, DEC-21, la enmienda H-E1-228, la sesión, VR-02 y el código/pruebas citados. La lectura del diff y del contenido completo de los 84 archivos se interrumpió al encontrar la contradicción; por ello este informe es una revisión temprana, no una auditoría completa.
- `npm run verify`, `test:policies`, `test:app`, suite adversaria, VR-02 y evaluación ampliada: **no ejecutados** en esta revisión.

## Hallazgos

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-01 | alta | `docs/FASES/FASE1/M25a/plan.md:11` | La excepción que retira la guarda contradice las cifras verificadas de Parte I y CA-50b de la spec superior. | El test `chat-output-schema.test.ts:11-14` acepta una cifra arbitraria y `chat-orchestrator.test.ts:297-309` exige mostrarla. | Conciliar expresamente la ruta y la spec con la decisión del usuario, o restaurar la verificación exigida. No tratar la enmienda del plan como cambio tácito de la fuente superior. |
| R-02 | alta | `src/modules/chat/orchestrator.ts:222` | La pregunta original viaja al modelo, contra CA-66/DEC-11 de la spec superior. | H-E1-228 lo ordena en el plan, pero la spec de la ruta sigue exigiendo redacción antes del envío. | Resolver la contradicción documental mediante decisión/enmienda de la ruta o restituir la redacción antes del modelo. |
| R-03 | alta | `docs/FASES/FASE1/meta_first/vr-02.md:75` | No hay VR-02 válida para el diseño actual. | La sesión declara `test:eval` no ejecutado tras H-E1-228; las corridas previas, además de no aprobar .3, corresponden al diseño anterior. | Tras resolver R-01, actualizar el criterio aplicable y correr base y ampliada con fixtures congelados; registrar resultados completos. |
| R-04 | media | `docs/PROJECT_STATE.md:29` | El estado «TERMINADA» puede leerse como cierre de M25a aunque `G-CHAT` permanece pendiente. | La misma línea declara el gate pendiente; el plan M25a paso 28 reserva el cierre para la aprobación expresa. | Usar un estado que distinga implementación terminada de microfase cerrada, conservando el cambio preexistente hasta que el usuario decida. |

## Pendientes del usuario

- Decidir y aprobar una enmienda de la ruta y de la spec que haga coherente H-E1-228 con sus criterios superiores, o pedir restaurar el comportamiento que esos criterios exigen. La decisión previa de retirar la guarda ya está registrada; falta conciliar las fuentes.
- Las suites dependientes del entorno de pruebas y DeepInfra quedan pendientes cuando se levante el bloqueo; no se requieren secretos en el chat.
- `G-CHAT` sigue pendiente y no se considera aprobado por esta revisión.

## Integridad del árbol

El informe es el único archivo agregado por esta revisión. El cambio preexistente en `docs/PROJECT_STATE.md` no se editó. Antes de cerrar, comparar `git status --porcelain=v1` con la foto inicial más este informe.
