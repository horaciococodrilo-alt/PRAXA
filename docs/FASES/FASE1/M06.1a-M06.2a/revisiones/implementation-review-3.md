# Revisión de implementación 3 — M06.1a-M06.2a

- **Fecha:** 2026-09-27.
- **Rama:** `mf/M06.1a-M06.2a`.
- **Commit revisado:** `9ce95e373d7adc24e60b39bcdb3ab055de96c52f`.
- **Base fija (`git merge-base main HEAD`):** `45fc760335a9eabcac4c5ea67eca04c02d9ab90c`.
- **Estado de la microfase al revisar:** `VERIFICADO — PENDIENTE DE APROBACIÓN` (`docs/PROJECT_STATE.md:14`; sesión, línea 6). `G-DB-META` sin aprobar.
- **Árbol:** limpio al empezar y al terminar (comando del paso 1, sin salida, excluyendo `revisiones/` y `sesiones/*-review-*`).

## Veredicto

**APROBABLE.** Los ocho ítems del checklist están en PASS. No encontré hallazgos nuevos de severidad alta ni media. Esta revisión reemplaza a `implementation-review-2.md` (BLOQUEADA solo por una restricción de entorno de esa sesión, que impedía crear el worktree del paso 3.3); en esta sesión el worktree se creó, se usó y se eliminó sin inconvenientes.

## Contexto: qué cambió desde `implementation-review-1.md`

`implementation-review-1.md` revisó el commit `9178991` (APROBABLE, con cuatro hallazgos bajos R-01 a R-04) y `implementation-review-2.md` revisó el mismo commit pero quedó BLOQUEADA por no poder repetir el paso 3.3. Desde entonces, el usuario autorizó dos rondas de corrección para alinear la migración con `AGENTS.md:48` ("Toda escritura es idempotente"), documentadas como `D-M06.1a-M06.2a-11` a `-21` en dos enmiendas de la spec (sin nueva auditoría, decisión explícita del usuario), y commiteadas en `d797957` y `9ce95e3`. El diff `9178991..HEAD` toca 11 archivos (+1120/−71): `plan.md` (nota de hash), `spec.md` (dos enmiendas), la sesión, `HALLAZGOS.md` (`H-E1-24` a `-27`), `0012_integrations.sql`, `09` y `09b` (nuevas aserciones) y `integrations-data-api.test.ts` (timeouts). Los informes `implementation-review-1.md` e `implementation-review-2.md` se agregaron al árbol como evidencia y no son código de producto.

## Fuentes leídas

`AGENTS.md`; ficha de `M06.1a-M06.2a` en Parte I (roadmap y contrato de ejecución); Parte II del plan de la ruta (`II.4`, `II.5`); `III.3` y `III.9`; los CA/DEC/CB citados de la spec de ruta; `docs/FASES/FASE1/M06.1a-M06.2a/spec.md` (con sus dos enmiendas) y `plan.md`; `sesiones/M06.1a-M06.2a.md` completa, incluidas las dos secciones de corrección y "Aplicación final"; `implementation-review-1.md` e `implementation-review-2.md`; `docs/HALLAZGOS.md` (`H-E1-23` a `-27`); el diff completo `BASE..HEAD` con `-M` y el contenido íntegro de cada archivo nuevo o modificado.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Alcance | PASS | `git diff -M --name-status BASE HEAD` (13 archivos): `plan.md`, `spec.md`, la sesión, `HALLAZGOS.md`, `PROJECT_STATE.md`, `0012_integrations.sql`, `08`/`09`/`09b`/`10` (pgTAP), `integrations-data-api.test.ts` y los dos informes de revisión anteriores. Todos están en la tabla de `II.4`/`II.5` o son seguimiento previsto (spec, hallazgos, sesión, `PROJECT_STATE`) o evidencia de revisión (excluida por la skill). Ningún archivo de `src/` (M06.3a no empezó). Ninguna migración existente tocada: `git diff -M --name-status BASE HEAD -- supabase/migrations` da un único `A supabase/migrations/0012_integrations.sql`. Todo lo que exige "Implementación requerida" de `M06.1a` y `M06.2a` está presente, ahora con las 12 funciones de `worker_api` idempotentes ante un reintento exacto (`AGENTS.md:48`) |
| 2 | Criterios | PASS | Cada criterio heredado y las nuevas decisiones `D-M06.1a-M06.2a-11` a `-21` tienen al menos una prueba pgTAP cuya aserción verifica exactamente ese efecto (ver matriz). Las 390 aserciones de `test:policies` pasan |
| 3 | Las pruebas detectan roturas, en worktree aislado | PASS (limitado, ver "Roturas") | Worktree del commit revisado (`../praxa-review-M06.1a-M06.2a`), `npm ci`, tres mutaciones aplicadas y razonadas contra las aserciones. Las tres exigen la base de pruebas; el worktree no tiene `.env.local` ni `SUPABASE_TEST_DB_URL` (no se copian, por regla de seguridad), así que `run-pgtap.mjs` se niega a correr y quedan **no probadas** en el sentido de "no ejecutadas", tal como prevé la skill. Restaurado con `git checkout --` y worktree eliminado |
| 4 | Reejecución | PASS | En `C:/Users/Simon/dev/PRAXA`, sin tocar nada: `db:check:test` verificado; `test:policies` 11 archivos / 390 aserciones / 0 problemas; `npx vitest run --project app` (Git Bash) 5 archivos, 29 pasadas, 7 omitidas (Data API 6/6); `npm run verify` (Git Bash) exit 0, 8 archivos, 145 pruebas, build con 11 páginas. Todo coincide exactamente con "Aplicación final" de la sesión. A diferencia de `implementation-review-1.md` (R-01), en esta sesión Git Bash no tuvo el problema de carga de Vitest (H-E1-20 no se reprodujo aquí; es variabilidad de entorno, no de código) |
| 5 | Seguridad y reglas | PASS | Búsqueda de patrones (`act_[0-9]{6,}`, claves privadas, `password\s*[:=]`, tokens tipo `sk-`/`AIza`) en los archivos del diff: sin coincidencias. No se leyó `.env.local` (solo se usó su carga automática por los scripts npm, igual que en las revisiones previas). Única migración nueva. `service_role` solo aparece en comentarios y en 17 sentencias `revoke all … from public, anon, authenticated, service_role` (schema, tablas y funciones); ningún `grant` a `service_role`. Tenant resuelto por parámetro explícito verificado contra `company_members` (`private.assert_worker_actor`) en las once funciones que lo reciben, incluidos los nuevos bloques de reintento (todos con `and c.company_id = p_company_id` antes de comparar el resto). Mensajes de error fijos, sin `DETAIL`/`HINT` (T-45 a T-47). No hay módulos `server-only` nuevos (no aplica: sin código de servidor en este corte) |
| 6 | Calidad funcional | PASS | Los doce reintentos nuevos siguen el mismo patrón (`return query … ; if found then return; end if;`) colocado siempre después del chequeo de pertenencia y antes de los chequeos de negocio, sin bypasear ninguna verificación de aislamiento. `rewrap_credential` valida `p_key_version` posterior a la guardada. Sin `any` injustificado en la prueba TS ni TODO/FIXME que escondan alcance (las únicas coincidencias de "any" son el operador SQL `= any(...)`, no el tipo de TypeScript) |
| 7 | Evidencia | PASS | La sesión registra, para las dos rondas de corrección: rojo TDD con arnés temporal, ensayo con rollback, mutaciones de deriva (rol y T-13), aplicación final con `db:push:test` del usuario, y las cuatro suites completas. Hallazgos nuevos con ID (`H-E1-24` a `-27`), todos con severidad/impacto y microfase de destino explícitos, sin ampliar el alcance de este corte. `G-DB-META` sigue sin aprobar en `PROJECT_STATE.md` |
| 8 | Contradicciones | PASS | La única tensión real (spec aprobada vs. `AGENTS.md:48`) se manejó como exige el protocolo: se detectó, se reportó como bloqueo antes de tocar código, y el usuario decidió enmendar la spec en el mismo cambio, dejando registro en la sección "Auditorías" de la spec y en `plan.md` (nota de hash). No hay otra contradicción con `AGENTS.md`, la spec ni el plan |

## Matriz de criterios (decisiones nuevas de esta corrección)

| Criterio / decisión | Prueba | ¿La aserción verifica el criterio? | Resultado |
|---|---|---|---|
| `D-11` (retry `create_pending_connection`) | `09b` T-20: reintento idéntico → misma fila, sin filas nuevas; otro material cifrado → `PX003`; otro id con viva → `PX003` (sin cambios) | sí (leí las tres aserciones y el cuerpo de la función: el filtro incluye `c.company_id = p_company_id` y todos los campos de la credencial) | PASS |
| `D-19` (retry no aplica a pendiente vencida) | `09b` T-20: `pending_expires_at` movido al pasado, reintento idéntico → `PX003`, no la fila vencida | sí | PASS |
| `D-12` (retry `confirm_connection`) | `09b` T-21: reintento idéntico → fila `active`; otra moneda → `PX004`; misma cuenta con generación 2 (tras reautorización) → `PX004` | sí | PASS |
| `D-13`/`D-21` (retry `mark_needs_reauth`, cualquier clase) | `09b` T-23: misma generación y clase → fila, mensaje intacto; misma generación y **otra clase** → también fila, mensaje sin cambiar; otra generación → `PX004`. T-29: `needs_reauth → needs_reauth` con la misma generación ya no es transición rechazada | sí (comprobé que el mensaje/clase guardados no se sobrescriben, tal como exige `D-13`) | PASS |
| `D-14` (borde de 10 min en `replace_credential`) | `09b` T-22: intento consumido hace 11 min → `PX002`; hace exactamente 10 min → válido | sí | PASS |
| `D-20` (retry `replace_credential`) | `09b` T-22: mismo intento consumido y mismo material → fila ya aplicada (generación no duplicada, `count = 1`); otro material → sigue `PX006` | sí | PASS |
| `D-15` (versión de clave posterior) | `09b` T-28: versión nueva igual o menor a la guardada → `22023` | sí | PASS |
| `D-20` (retry `rewrap_credential`) | `09b` T-28: mismo material y versión esperada → fila ya recifrada; otro material → sigue `PX008` | sí | PASS |
| `D-20` (retry `create_oauth_attempt`) | `09b` T-18: mismo `state`/actor/empresa/vinculación, sin consumir/vencer → fila ya creada, sin duplicar; T-46: otro `browser_binding_hash` con el mismo `state` sigue dando `22023` (no es un reintento) | sí (verifiqué que el reintento exige `browser_binding_hash` igual, evitando el falso positivo de T-46) | PASS |
| `D-16`/`D-18` (rol idempotente, sin membresías, se detiene si `SUPERUSER`) | `09` T-05: atributos completos incluida `rolreplication`; `count(*) = 0` en `pg_auth_members` con `praxa_integrations` como miembro | sí, sobre lo que es verificable en la base (el camino `raise exception` ante `SUPERUSER` no tiene una prueba pgTAP directa, porque exigiría manipular el rol a `SUPERUSER` antes del `db:push:test`; queda como revisión de código, consistente con que es una condición de arranque de la migración, no de tiempo de ejecución) | PASS (con la limitación anotada, no bloqueante: `SUPERUSER` en el rol de C sería un incidente de operación, no un camino alcanzable por la app) |
| `D-17` (T-13 con `USAGE` temporal) | `09` T-13: `grant`/aserción de `USAGE` concedido, doce funciones con `42501` para `anon`/`authenticated` **con** `USAGE`, `revoke` y aserción de que el `USAGE` temporal no sobrevive | sí | PASS |
| Resto de CA-01 a CA-68 y C-01 a C-38 heredados de la spec de ruta | Sin cambios de comportamiento en esta corrección; reconfirmados por la corrida completa de `test:policies` (390/390) y `test:app`/`verify` | sí (matriz completa ya construida en `implementation-review-1.md`, con las mismas líneas de código no tocadas en este diff) | PASS |

## Roturas (worktree `../praxa-review-M06.1a-M06.2a`, commit `9ce95e3`)

`npm ci` corrió sin errores (471 paquetes). El worktree no tiene `.env.local` (confirmado con `ls .env*` y con `node scripts/check-target.mjs test`, que reporta `SUPABASE_TEST_URL` y `SUPABASE_TEST_DB_URL` sin definir). Elegí tres criterios: aislamiento, privilegios e idempotencia (la decisión nueva de esta corrección).

| Criterio | Rotura aplicada | Prueba que la detectaría | Probada en worktree (sí/no, motivo) |
|---|---|---|---|
| CA-19/C-16 (aislamiento) | En `get_credential`, quité `and c.company_id = p_company_id` del `perform 1` de existencia (dejando el filtro por `company_id` solo en el `return query` final) | `08` T-16 "`get_credential` con conexión de B → `PX001`": con la rotura, el chequeo de existencia encuentra la fila de B (ya no filtra por empresa) y no lanza `PX001`; el `return query` final sigue filtrando por `p_company_id` y devuelve **cero filas** en silencio en vez de un error. `throws_ok(..., 'PX001', ...)` falla porque no hay excepción | **No.** `node scripts/run-pgtap.mjs` se niega con "Falta `SUPABASE_TEST_DB_URL`"; no se copió `.env.local` al worktree (regla de seguridad) |
| CA-21/C-15 (privilegios) | Agregué `grant execute on function worker_api.count_credentials_by_key_version() to authenticated;` después del grant normal a `praxa_integrations` (privilegio de más, no una simple omisión de `revoke`, para no caer en el caso ya señalado como no concluyente en `implementation-review-1.md`, R-02) | `09` T-12: `is_empty($$… has_function_privilege(r.name, p.oid, 'EXECUTE') …$$)` para `anon`/`authenticated`/`service_role` sobre las doce funciones deja de estar vacío: aparece `(count_credentials_by_key_version, authenticated)` | **No.** Misma razón: requiere la base de pruebas |
| `D-M06.1a-M06.2a-11`/`-20` (idempotencia, estado) | En `create_pending_connection`, borré el bloque completo de reintento (el `return query` con el `if found then return`), dejando el camino normal directo al chequeo de `PX003` | `09b` T-20 "el reintento idéntico devuelve la pendiente": `results_eq` esperaba `(kid(209), 'pending_selection', 0)`; sin el bloque, la llamada cae en el chequeo de conexión viva (la misma pendiente ya cuenta como viva) y lanza `PX003` en vez de devolver una fila, así que `results_eq` falla (la subconsulta izquierda termina en error) | **No.** Misma razón |

Las tres mutaciones se restauraron con `git checkout -- supabase/migrations/0012_integrations.sql` dentro del worktree (`git status --porcelain` del worktree, sin salida, antes de eliminarlo) y el worktree se eliminó con `git worktree remove ../praxa-review-M06.1a-M06.2a` (sin `--force`; no hubo objetos ignorados que lo impidieran). `git worktree list` al final muestra solo el directorio del usuario.

## Comandos reejecutados

Todos en `C:/Users/Simon/dev/PRAXA`, sin modificar el árbol:

| Comando | Resultado | Comparación con la sesión ("Aplicación final") |
|---|---|---|
| `git status --porcelain --untracked-files=all -- . ':(exclude)…'` | Sin salida, al empezar y al terminar | — |
| `npm run db:check:test` | "Destino verificado.", proyecto de pruebas desechable, `SUPABASE_TEST_URL`/`SUPABASE_TEST_DB_URL` apuntan al mismo proyecto | Igual |
| `npm run test:policies` | 11 archivos, 390 aserciones, 0 problemas: `08` 26/26, `09` 52/52, `09b` 146/146, `10` 21/21; `01`–`07` sin cambios | Igual (390/390) |
| `npx vitest run --project app --reporter=verbose` (Git Bash) | 5 archivos, 29 pasadas, 7 omitidas (36): Data API 6/6; 4 avisos "NO EJECUTADA" de suites que sí corrieron y 3 de `email-flows` opt-in (`H-E1-23`) | Igual (29/36) |
| `npm run verify` (Git Bash) | exit 0: lint, typegen, typecheck, `Test Files 8 passed`, `Tests 145 passed`, build "Compiled successfully", 11 páginas | Igual (145/145 + build) |
| Búsqueda de patrones de secretos/cuentas en los archivos del diff | Sin coincidencias | Igual |
| `git diff -M --name-status BASE HEAD -- supabase/migrations` | Único `A supabase/migrations/0012_integrations.sql` | Igual |
| Worktree: `git worktree add`, `npm ci`, 3 mutaciones, `run-pgtap.mjs`, restauración, `git worktree remove` | Worktree limpio al final; `run-pgtap.mjs` rechaza por falta de `SUPABASE_TEST_DB_URL` en las tres mutaciones | Coincide con el mismo límite documentado en `implementation-review-1.md` |

No corrí `db:push:test`, `db:push`, `git push` ni ningún comando destructivo sobre el repositorio del usuario. El `db:push:test` de esta corrección ya lo ejecutó el usuario (sesión, "Aplicación final"), sobre un proyecto de pruebas recreado.

## Hallazgos

No encontré hallazgos nuevos de severidad alta ni media. Los hallazgos bajos de `implementation-review-1.md` (R-01 a R-04) son de un commit anterior (`9178991`); no los reproduzco aquí porque no corresponden al código de este commit sin volver a verificarlos punto por punto, y ninguno bloqueaba esa revisión. Un punto de severidad baja, informativo:

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-06 | baja | `supabase/migrations/0012_integrations.sql:740-779` (`get_credential`) | El camino "SUPERUSER" de la creación idempotente del rol (`D-M06.1a-M06.2a-18`) y el reintento de `get_credential` con conexión ajena no tienen una prueba pgTAP que ejercite exactamente esa rama; se validan por lectura de código y por la mutación de esta revisión (ver "Roturas"), no por una aserción existente | Lectura de `0012` y de `09`/`09b`; ninguna aserción manipula el rol a `SUPERUSER` antes de aplicar la migración, y `get_credential` no tiene un caso de reintento explícito (no lo necesita: es de solo lectura, sin escritura que idempotizar) | Ninguna acción requerida: `get_credential` no escribe, así que `D-M06.1a-M06.2a-20` no le aplica; el camino `SUPERUSER` es un chequeo de arranque de migración sobre un estado que ningún flujo de la app puede producir. Documentar la limitación es suficiente si se quiere dejar constancia |

No hay hallazgos de severidad alta ni media.

## Contradicciones

Ninguna con `AGENTS.md`, la spec (con sus dos enmiendas) ni el plan. La tensión entre la spec aprobada original y `AGENTS.md:48` se resolvió correctamente: se reportó como bloqueo antes de escribir código, y el usuario decidió enmendar la spec sin nueva auditoría, dejando el registro en la sección "Auditorías" de `spec.md` y en la nota de hash de `plan.md`. Esto es coherente con la jerarquía de fuentes de `AGENTS.md` (los "Non-negotiables", entre ellos la idempotencia, están por encima de cualquier spec de microfase).

## Pendientes del usuario

1. Ejecutar `/qa-review M06.1a-M06.2a`, que puede repetir con la base real las tres roturas que aquí quedaron no probadas por depender de `SUPABASE_TEST_DB_URL`.
2. Aprobar o no `G-DB-META` después de `qa-review`, incluyendo de forma expresa la decisión ya registrada sobre las tres pruebas opt-in de `email-flows` (`H-E1-23`, ajena a esta microfase) y sobre los hallazgos diferidos `H-E1-24` a `H-E1-27`.

## Confirmaciones finales

- `git rev-parse HEAD` → `9ce95e373d7adc24e60b39bcdb3ab055de96c52f` (sin cambios respecto del inicio de esta revisión).
- Comando de árbol limpio del paso 1: sin salida (este informe y los anteriores en `revisiones/` quedan excluidos).
- `git worktree list` → solo `C:/Users/Simon/dev/PRAXA  9ce95e3 [mf/M06.1a-M06.2a]`; el worktree temporal `../praxa-review-M06.1a-M06.2a` fue eliminado.
