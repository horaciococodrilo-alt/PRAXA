# Auditoría de la spec de M25a — ronda 9

- **Fecha:** 2026-11-09 (America/Buenos_Aires).
- **Commit:** `3eaf561` (`docs/m25a-spec`). El árbol ya tenía `revisiones/spec-audit-8.md` sin seguimiento; se preservó. Base de la microfase: `main` en `b0c854d`.
- **Hash de contenido de `M25a/spec.md` sin la línea `**Estado:**`:** `e7006664aca7c33fd3f0f126484371f6db6a692d`, el mismo de las rondas 7 y 8.
- **Precondición:** `spec.md:3` está en `BORRADOR`. La auditoría anterior más alta es `spec-audit-8.md`.

## Veredicto

**REQUIERE CAMBIOS: 15 PASS y 3 FAIL.** Hay dos hallazgos altos, cuatro medios y dos bajos. Los ocho son defectos que las rondas anteriores no registraron. Este informe reemplaza al veredicto APROBABLE de la ronda 8 sobre el mismo texto. Coincido con la ronda 8 en retirar A-53 (ítem 3).

## Checklist

| # | Ítem | PASS/FAIL/BLOQUEO | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | La ficha (`meta_first/plan.md:342`) pide CA-48 a CA-55, CA-61 a CA-66, CA-69 a CA-73 y VR-02. Todos figuran en «Heredados» (`spec.md:631-664`), y los resúmenes de CA-38c, CA-50, CA-51, CA-52, CA-62 y CA-69 siguen el texto enmendado. |
| 2 | Alcance | PASS | Etapas y exclusiones (`spec.md:29-65`) siguen la ficha y II.12, II.13 y II.13b. `action_types` con `period` (`:285`) amplía II.12 paso 5 con motivo declarado, necesario para `desglose_tipo_resultado`. Los C-01 a C-81 tienen traza. |
| 3 | Coherencia con la spec general | PASS | Sin contradicción con un CA, DEC o CB, ni con lo que consume M28.3a (registros con `feedback`, conteos por motivo). A-53 sigue retirado: CA-50 punto 2 exige igualdad de período solo para `observed_value`, y el punto 6 da una regla propia a `user_provided` (`meta_first/spec.md:434`, `:442`). |
| 4 | Decisiones | PASS | D-M25a-01 a -17 constan como decisiones del usuario (`spec.md:902-922`). Las que tocan la ruta están en `plan.md:20` y en la sesión de enmienda. D-M25a-17 amplía CA-73 sin contradecirlo. |
| 5 | Trampas | PASS | Las cinco de II.13 y la de II.12 están en `spec.md:881-900`. |
| 6 | Intervenciones y acciones reservadas | PASS | `spec.md:864-879` coincide con la ficha y con III.2. Push, despliegue, `db:push` a `app` y `db:push:test` quedan en el usuario, con verificación posterior. `.claude/settings.json` deniega `db:push*` y `git push*`. |
| 7 | Verificación | PASS | `spec.md:852-862` incluye `verify`, `db:check:test`, `test:policies`, `test:app`, suite adversaria, VR-02, evaluación ampliada, recorrido y CB-06. Resuelve la diferencia entre la ficha y II.13 a favor de la ficha. |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:25`, `:29`: `G-SYNC` aprobado y M25a habilitada. `main` contiene K01, `0016`, `0017` y el trabajo de M16c. |
| 9 | Lo entregado de verdad | **FAIL** | Evita bien el tope de 28 días, la falta de atribución en `0017` y las lecturas sin señal. Pero `requireTenantContext` lanza `NoCompanyError` con sesión válida y sin empresa (`company/service.ts:85-90`), un estado real que `lifecycle.ts:171` ya trata como `sin_empresa`. La spec no le da salida: A-56. |
| 10 | Pendientes y hallazgos | PASS | H-E1-185, -187, -189, -190, -194 y -202 quedan resueltos o diferidos con motivo (`spec.md:64`, `:936-937`, `:948-958`). |
| 11 | Contexto real | PASS | Comprobé todas las filas de `spec.md:69-112` y las referencias de diseño (`0016`, `0017`, `09`, `10`, `worker-api.ts`, `insights.ts`, `chat.tsx`, `SECURITY.md`, `ARCHITECTURE.md`, acta, `PIPELINE.md`, documentación de Next). Existen y dicen lo que la spec afirma. |
| 12 | Archivos previstos | PASS | `spec.md:597-627` traza a II.12, II.13, II.13b, D-M25a-01, -10, -14, -16 y `plan.md:20`. Ninguna prueba existente fuera de la lista se rompe: `03` y `13` nombran funciones fijas, `09` y `10` están autorizadas, y `no-privileged-credentials` recorre `src` y `proxy`, no `scripts/`. `SECURITY.md` y `ARCHITECTURE.md` figuran porque cambian propiedades suyas. |
| 13 | Diseño suficiente | **FAIL** | Obliga a inventar en cuatro puntos: usuario sin empresa (A-56), composición por período (A-57), pie sin período (A-58) y `period` de un valor diario (A-59). Detalles menores en A-60. |
| 14 | Verificable | PASS | Script de cruce: C-01 a C-81 tienen caso entre T-01 y T-91, con comando real o `test:eval` previsto. Hay negativos y bordes. Los casos que faltan se proponen dentro de cada hallazgo. |
| 15 | Sin nada abierto | PASS | `spec.md:942-944` sin preguntas. H-01 a H-11 dicen cómo y cuándo se verifican. Los supuestos de DeepInfra se validan en la primera corrida y en VR-02; reutilicé esa evidencia. |
| 16 | Ejecutable ahora | PASS | `npm run verify` en un worktree temporal de `main` (`b0c854d`), con `npm ci` y PowerShell: **exit 0**. Lint, typegen, typecheck, 28 archivos con 765 pruebas y build de 13 páginas. Scripts y variables de prerrequisito existen por nombre en `package.json` y `.env.example`. No se leyó `.env.local`. |
| 17 | Consistencia interna | **FAIL** | `list_count` de `entities` no se puede citar con las reglas del propio esquema (A-54). §13 manda editar la spec durante la corrida, y el pipeline lo prohíbe (A-55). |
| 18 | Reglas no negociables | PASS | K01 interno, sin secretos, `0018` nueva, pruebas en el desechable con guarda, credenciales solo por `worker_api` y errores de texto fijo (`spec.md:126-172`, `:311`, `:340`, `:504`, `:568-572`). |

**Observación sobre las 8 horas.** DEC-24 y la ficha exceptúan a M25a del límite, así que no corresponde recomendar otro corte.

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| `projectOutput` exige `period`, o `period_a` y `period_b`, en todo `observed_value` (`spec.md:395`, `:409`) | La misma spec: `entities` devuelve un `list_count` sin período (`:220`, `:363`), y «3 campañas» necesita un `observed_value` sobre ese valor (`:404`, T-38 en `:795`) | `entities` recibe solo `level` (`:284`). Con `period` nulo falla la proyección. Con `period` no nulo falla la igualdad con el valor | A-54 |
| «El valor final queda en `limits.ts` y en esta spec» (`spec.md:585`) | `.claude/skills/microfase/SKILL.md:100`: «No modificás la spec ni el plan de la microfase». También `:39`: con otro hash, el estado es `BLOQUEADO` | §13 prevé el ajuste durante la corrida y dice que probablemente ocurra (`:582`, `:584`). Editar la spec cambia su hash, y al reanudar la corrida ya no coincide con el de la última auditoría | A-55 |

## Hallazgos

| ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-54 | **Alta** | §3, §8; C-18; T-38 | «¿Cuántas campañas tengo?» nunca puede pasar la guarda. El único `list_count` de `entities` no tiene período, y ninguna forma de claim lo admite: termina siempre en `guard_rejected`. C-18 también exige «período» en cada valor sin salvedad | `spec.md:220`, `:284`, `:363`, `:395`, `:404`, `:409`, `:687`, `:795`; CA-50 punto 2 (`meta_first/spec.md:434`) | En `observed_value`, admitir `period`, `period_a` y `period_b` todos nulos solo si el valor citado no tiene período, lo que hoy solo ocurre en ese `list_count`. Alinear C-18 con «cuando corresponde». Sumar a T-38 el caso válido sobre `entities`, y el rechazo de un período inventado | No |
| A-55 | **Alta** | §13; C-56 | §13 manda registrar el valor final en la spec durante la corrida. `/microfase` lo prohíbe, y una spec con otro hash deja la corrida en `BLOQUEADO` al reanudarla. También sería una «decisión registrada» que no tomó el usuario, y el ajuste se anticipa como probable. C-56 y T-60 ya miran solo la sesión y `limits.ts` | `spec.md:346-351`, `:582`, `:584-585`, `:725`, `:817`; `SKILL.md:39`, `:100`, `:102`; `PIPELINE.md`, «Hashes» | Dejar: «El valor final queda en `limits.ts` y en `sesiones/M25a.md`, con la medición como motivo, antes de la evaluación ampliada». Aclarar en §7 que esos son los valores iniciales de CA-70 y que los topes de §13 ya están autorizados | No |
| A-56 | Media | §7, §11; C-70; T-73, T-75 | Falta la salida de un usuario con sesión y sin empresa. Es un estado alcanzable: se entra a Mi perfil y la empresa se crea después en Configuración. K01 lanza `NoCompanyError`, no hay `company_id` para el arriendo ni para el registro, y la spec dice que hay cuatro salidas y que son «las únicas excepciones» a CA-62. Tampoco dice qué hace `chat/page.tsx` al leer `conexionActiva` en ese caso. El paso 3 no asigna salida a `ConnectionReadError`, y T-73 no lo prueba | `tenant/context.ts:39`; `company/service.ts:85-90`; `lifecycle.ts:171`; `app-data/index.ts:90-95`; `connections.ts:67-85`; `plan.md:389-392`; `spec.md:361`, `:504-515`, `:940`, `:830`, `:832` | Agregar una salida: `notice` con texto fijo y enlace a Configuración, sin modelo ni registro. Sumarla a las excepciones de CA-62 por enmienda, o declararla como consulta que no llegó a existir. La página trata el caso como `conexionActiva = false`, igual que `getIntegraciones`. Asignar `ConnectionReadError` a «fallo de registro». Sumar casos a T-73 y T-75 | **Sí**, porque toca la lista de excepciones de CA-62 |
| A-57 | Media | §3, §10; T-89, T-90 | Los resultados de dos períodos no tienen composición por período. `data_limits` se emite «una vez por período» comparando `observed_from` y `observed_to`, y CA-51b pide mostrar la composición, pero el contrato solo da una composición por resultado. No se define qué significa `observed_from` sobre dos períodos separados. Solo `chat_ranking` declara composición propia por valor, y `percent_change` solo devuelve `change`, sin `a` ni `b` donde llevarla | `spec.md:195-199`, `:214-216`, `:250`, `:492`, `:846-847` | Definir `extra.composition_a` y `extra.composition_b` en `chat_compare_periods` y `chat_percent_change`, o la composición en los valores `a` y `b` más una forma para `change`. Definir la composición global como suma de conteos, con fechas por período. Sumar casos a T-27, T-89 y T-90 | No |
| A-58 | Media | §7, §9; C-40; T-44 | La fila `answer` pide un pie completo, pero hay respuestas sin período ni cobertura: las que solo usan `entities` o `connection_status`, y un `answer` sin herramientas, que el paso 4 no excluye. La spec no dice qué muestra el pie, ni si un `answer` sin resultados es válido. T-44 no los cubre | `spec.md:220-221`, `:362-363`, `:425`, `:709`, `:801`; CA-51 y CA-52 (`meta_first/spec.md:468`, `:470`) | Agregar una fila: resultado sin período, solo la cuenta y lo que el resultado traiga. Decidir el `answer` sin herramientas: por ejemplo, permitido solo sin cifras y con ese mismo pie, o convertido en `out_of_scope`. Sumar los casos a T-44 y T-59 | No |
| A-59 | Media | §3, §4, §8; C-18; T-39 | Queda sin definir qué lleva `period` en un valor. El contrato lo declara como cadena nula en `values` y como objeto en `scope`, y solo fija la regla para dos períodos. En un valor de `daily_series`, el implementador tiene que elegir entre el período consultado o el día, y de eso depende la igualdad que exige la guarda y lo que significa «atribuida a otro período». Además, `toModelView` no menciona `day` ni los segmentos entre lo que conserva o quita, y el modelo los necesita | `spec.md:185`, `:189`, `:208`, `:226`, `:315`, `:409`, `:687`, `:796`; `primitives.ts:34` | Fijar `period` como `{ from, to }` en `values`, y decir que un valor diario lleva el período de la consulta más su `day`, o `{ day, day }`. Agregar `day`, `segment_primary`, `segment_secondary` y `entity_name` a lo que conserva `toModelView`. Cubrirlo en T-18 y T-39 | No |
| A-60 | Baja | §3, §4, §9 | Nombres y valores menores sin fijar: valores de `order` y `limit` por defecto en `ranking` y `breakdown`; `path_key` de los cálculos de un valor, de los que depende la fila de redondeo de un promedio; `reason` de `not_found`, sin valor en la lista; qué cuenta el `list_count` de `ranking`; y el modo de escala del `embudo` | `spec.md:184`, `:203`, `:213`, `:216`, `:241-242`, `:267`, `:270`, `:292`, `:296`, `:475` | Enumerarlos en §3 y §4 | No |
| A-61 | Baja | Auditorías | La tabla llega hasta la ronda 6 y faltan las rondas 7, 8 y 9. Se corrige junto con los cambios de arriba, antes de la próxima auditoría, para no cambiar el hash después | `spec.md:960-969`; `_templates/mf-spec.md:94-96` | Agregar las filas | No |

## Verificaciones y límites

- **Base.** `verify` corrió en `../praxa-review-m25a-audit9`, creado desde `main` y ya eliminado con `git worktree remove`. No toqué el worktree ajeno `praxa-fix-124`.
- **Sin ejecutar.** No corrí `test:policies`, `test:app`, VR-02 ni consultas a ningún proyecto: M25a no está implementada y este paso no las exige.
- **Cambios.** Solo agregué este informe. La spec sigue en `BORRADOR`.
- **Fuentes externas.** No volví a consultar DeepInfra: reutilicé la evidencia de la expansión, que tiene validación posterior en la primera corrida de la etapa .2 y en VR-02.
- **Observación fuera del veredicto.** La spec y la enmienda de la ruta están solo en `docs/m25a-spec`, no en `main`. `/microfase` crea `mf/M25a` desde la base, así que esa rama tiene que integrarse antes, o `mf/M25a` tiene que salir de ella. Conviene decirlo en el plan.

## Siguiente paso

1. Aplicar a la spec las correcciones técnicas de A-54, A-55, A-57, A-58, A-59, A-60 y A-61.
2. Pasar la parte de CA-62 de A-56 por `/grill-me`.
3. Auditar de nuevo.

Esta auditoría no aprueba la spec, no inicia M25a y no cambia `G-CHAT`.
