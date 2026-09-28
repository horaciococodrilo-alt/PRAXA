# Revisión de implementación 2 — M06.1a-M06.2a

- **Fecha:** 2026-09-27.
- **Commit revisado:** `917899199e2a192197e68b66f7cd5ee9ab99a37c`.
- **Base fija:** `45fc760335a9eabcac4c5ea67eca04c02d9ab90c` (`git merge-base main HEAD`).
- **Veredicto:** **BLOQUEADO** para esta revisión. Las suites requeridas pasan y no encontré una falla funcional nueva, pero no repetí la comprobación de roturas en un worktree aislado que exige el paso 3.3 del skill. El usuario prohibió comandos destructivos; crear el worktree obligaría a ejecutar después `git worktree remove`. No se creó ningún worktree ni se alteró código o documentación.
- **Gate:** `G-DB-META` sigue sin aprobarse. Este informe no cierra la microfase.

## Estado revisado y alcance

Las precondiciones pasan: rama `mf/M06.1a-M06.2a`; `docs/PROJECT_STATE.md:14` dice `VERIFICADO — PENDIENTE DE APROBACIÓN`; el comando de árbol limpio del skill no devolvió líneas. `G-K02-K04` ya figura aprobado. El único archivo sin seguimiento al comenzar era `implementation-review-1.md`, excluido por el comando. El diff `git diff -M --stat BASE HEAD` comprende nueve archivos, 3824 inserciones y ocho eliminaciones: sesión, `HALLAZGOS`, `PROJECT_STATE`, la migración `0012`, las suites `08`, `09`, `09b`, `10` y la prueba de Data API. `git diff -M --name-status BASE HEAD -- supabase/migrations` muestra solo `A supabase/migrations/0012_integrations.sql`; no hay migraciones existentes modificadas ni renombradas. Los nueve archivos pertenecen a II.4, II.5 o al seguimiento previsto. `git diff -M --check BASE HEAD` pasa.

Leí `AGENTS.md`, las fichas I.4, II.4, II.5, III.3 y III.9 de la ruta, los CA/DEC/CB citados de la spec de ruta, la spec y el plan aprobados del grupo, la sesión y los hallazgos asignados. Contrasté el diff y el código nuevo con las aserciones de las pruebas. La matriz siguiente registra esa revisión. La lectura del diff completo en una sola salida quedó truncada por el límite de la herramienta; se inspeccionaron por separado los archivos y las secciones críticas. Esta limitación no se interpreta como una prueba adicional.

## Checklist

| # | Ítem | PASS/FAIL/BLOQUEO | Evidencia |
|---:|---|---|---|
| 1 | Alcance | PASS | Nueve archivos dentro de II.4/II.5 y seguimiento; única migración nueva `0012`; doce funciones, tres tablas y suites previstas. No aparecen cambios netos en `.claude/` ni en los archivos diferidos a M06.3a. |
| 2 | Criterios | PASS | La matriz identifica pruebas y aserciones concretas. `test:policies` pasó 362/362, `test:app` ejecutó las seis aserciones nuevas, `verify` pasó 145/145. Las tres pruebas opt-in de correo siguen omitidas según la decisión registrada del usuario y `H-E1-23`; no se cuentan como ejecutadas. |
| 3 | Las pruebas detectan roturas | BLOQUEO | La sesión documenta seis mutaciones en memoria y la revisión 1 documenta un worktree del mismo commit, pero este revisor no repitió roturas. La instrucción actual prohíbe comandos destructivos y el skill exige eliminar el worktree temporal. Las tres roturas críticas elegidas requieren además la base de pruebas; ver matriz de roturas. |
| 4 | Reejecución | PASS | `db:check:test` y 11 archivos pgTAP pasan; `test:app`: 5 archivos, 29 pasadas y 7 omitidas; `verify`: 8 archivos, 145 pruebas y build. Coinciden con la sesión. Los primeros intentos de Vitest en sandbox fallaron antes de cargar suites con `spawn EPERM`; fuera del sandbox pasaron. |
| 5 | Seguridad y reglas | PASS | Búsqueda por patrones en los nueve archivos sin coincidencias; no se leyó `.env.local`. RLS habilitada y forzada; lectura de conexiones mediante `private.is_company_member(company_id)`; rol de C sin lectura directa; ACL de tablas y funciones probadas en `09`; sin uso aplicativo de `service_role`. Errores fijos y sin `DETAIL`/`HINT` en T-45 a T-48. La futura resolución de K01 en Node corresponde a M06.3a. |
| 6 | Calidad funcional | PASS | Se revisaron restricciones, caminos `PX001`–`PX008` y `22023`, purga idempotente, transición de estados, cierre y lectura efectiva por HTTP. No hay `any` injustificado ni TODO de alcance pendiente en el código nuevo. |
| 7 | Evidencia | PASS | La sesión registra rojo TDD, ensayo con rollback, `db:push:test` del usuario, verificaciones finales, desvíos y `H-E1-23`. El gate actual no figura aprobado. |
| 8 | Contradicciones | PASS | La decisión visible del usuario sobre los tres casos de correo opt-in está registrada en sesión y `H-E1-23`; los criterios exigidos para esta microfase sí se ejecutaron. No detecté otra contradicción con la jerarquía de fuentes. |

## Matriz de criterios

`09` y `09b` son pgTAP; `08` comprueba aislamiento; `10` comprueba cierre. Todos estos archivos pasaron en `test:policies`. La columna «sí» significa que leí la aserción y comprobé que observa el efecto indicado; no se basa solo en el nombre del test.

| Criterio | Prueba | Aserción verifica el criterio (sí/no) | Resultado |
|---|---|---|---|
| CA-01 | `09b` T-17, formato y ausencia de columna de estado plano en `09` T-07 | sí | PASS |
| CA-02 | `09b` T-17/T-18/T-19, ventana y consumo vencido | sí | PASS |
| CA-02b | `09b` T-19, actor, empresa y vínculo del navegador | sí | PASS |
| CA-02c | `09b` T-17/T-18, forma y generación de `reauth` | sí | PASS |
| CA-03 | `09b` T-19, primer y segundo consumo; una sentencia `update … returning` en `0012:521-530` | sí | PASS |
| CA-05 | `09` T-06, etiquetas exactas del enum | sí | PASS |
| CA-07 | `09` T-06 y `09b` T-29, estados y transiciones no declaradas | sí | PASS |
| CA-08 | `09b` T-17/T-23, metadatos obligatorios y desconexión de pendiente | sí | PASS |
| CA-09/09b | `09b` T-17/T-20/T-21, par clase/mensaje y datos de cuenta | sí | PASS |
| CA-10 a CA-13 | `09` T-07/T-11 y `09b` T-17; columnas, formato y FK | sí | PASS dentro del alcance de persistencia; AAD de cifrado corresponde a M06.3a |
| CA-14 | `09` T-08/T-15, RLS forzada y dueño `bypassrls` | sí | PASS |
| CA-15 | `09` T-09, ACL de credenciales | sí | PASS |
| CA-16 | Lectura de encabezado `0012:8-58`, contra spec de ruta §7 | sí | PASS |
| CA-17 | Lectura de `revoke`/`grant` en `0012`; `09` T-12 y control T-40 | sí | PASS |
| CA-18 | `09b` T-17/T-27, índices y reconexión tras purga | sí | PASS |
| CA-19 | `08` T-16/T-42/T-48, dos empresas y ausencia de efectos cruzados | sí | PASS |
| CA-20 | `09` T-10 y política `0012:362-366` | sí | PASS |
| CA-21 | `08` T-16, `09` T-12/T-14, Data API T-33 | sí | PASS |
| CA-22 | `09` T-13, llamadas y lectura como tres roles | sí | PASS |
| CA-25 | `09b` T-28, conteo global y recifrado condicionado | sí | PASS |
| CA-28 | `09b` T-18, `initial` y `reauth` | sí | PASS |
| CA-37 | `09b` T-21, pendiente vencida sin purga previa | sí | PASS |
| CA-37c | `09b` T-22, generación vieja e intento válido | sí | PASS |
| CA-38/38b | `09b` T-23 a T-25 y T-39; idempotencia y borde de diez minutos | sí | PASS |
| CA-67/68 | `10` T-32; empresa con reporte, integración, usuario y cero filas | sí | PASS |
| Fichas M06.1a/M06.2a | `08` T-16/T-48, `09` T-13, `09b` T-30, `10` T-32 | sí | PASS |
| Sección 5b | `tests/app/integrations-data-api.test.ts`, seis `expect` de lectura y rechazo | sí | PASS |
| CB-01 a CB-06 | Comandos reejecutados, diff, guarda de destino y decisión sobre opt-in | sí | PASS para pruebas exigidas; tres de correo no ejecutadas |
| C-01 | `git diff -M --name-status BASE HEAD -- supabase/migrations` | sí | PASS |
| C-02 | Lectura del encabezado de `0012`, matriz y catálogo | sí | PASS |
| C-03 | Lectura de `revoke`/`grant`, T-40 | sí | PASS |
| C-04 | `09` T-04, USAGE de esquema por rol | sí | PASS |
| C-05 | `09` T-05 y búsqueda de `password` en migración | sí | PASS |
| C-06 | `09` T-06, enum exacto | sí | PASS |
| C-07 | `09` T-07, columnas y nulabilidad | sí | PASS |
| C-08 | `09` T-08, tres tablas con RLS/force | sí | PASS |
| C-09 | `09` T-09, siete privilegios por rol y ACL | sí | PASS |
| C-10 | `09` T-10, política única | sí | PASS |
| C-11 | `09b` T-17, ocho inserciones inválidas | sí | PASS |
| C-12 | `09b` T-17, dos violaciones de unicidad | sí | PASS |
| C-13 | `09` T-11, FK con `confdeltype = 'c'` | sí | PASS |
| C-14 | `09b` T-17, hashes, propósito, retorno y vencimiento | sí | PASS |
| C-15 | `09` T-12, doce funciones, ACL, `prosecdef` y `search_path` | sí | PASS |
| C-16 | `09b` T-30 (33 casos), `08` T-16/T-48 y `09b` T-47 | sí | PASS |
| C-17 | `09b` T-18, propósito, estados y vencimiento | sí | PASS |
| C-18 | `09b` T-19 y `0012:521-530` | sí | PASS |
| C-19 | `09b` T-20, pendiente y credencial | sí | PASS |
| C-20 | `09b` T-21, expiración, probe, zona y activo | sí | PASS |
| C-21 | `09b` T-22, generación e intento | sí | PASS |
| C-22 | `09b` T-23, clase y estado | sí | PASS |
| C-23 | `09b` T-24, desconexión repetida | sí | PASS |
| C-24 | `09b` T-25 y `08` T-42, purga propia/ajena | sí | PASS |
| C-25 | `09b` T-26, pendientes de dos empresas | sí | PASS |
| C-26 | `09b` T-27, cuenta antes y después de purga | sí | PASS |
| C-27 | `09b` T-28, conteo de ambas empresas y cambio de versión | sí | PASS |
| C-28 | `09b` T-29, seis transiciones prohibidas | sí | PASS |
| C-29 | `08` T-16, lectura y DML como autenticado | sí | PASS |
| C-30 | `09` T-13, ejecución como rol de C y denegaciones | sí | PASS |
| C-31 | `09` T-14, catálogo de funciones fuera de `worker_api` | sí | PASS |
| C-32 | `09` T-15, `rolbypassrls` del dueño | sí | PASS |
| C-33 | `10` T-32, parte 1 y parte 2 | sí | PASS |
| C-34 | Data API T-33, seis aserciones y limpieza | sí | PASS |
| C-35 | `09b` T-31/T-45 a T-47; `08` T-48 | sí | PASS |
| C-36 | `db:check:test`, `test:policies`, `test:app`, `verify`; push previo del usuario documentado | sí, con decisión registrada para correo opt-in | PASS para el corte |
| C-37 | `09b` T-39, purga, borde y otra empresa | sí | PASS |
| C-38 | `09b` T-17, IV, etiqueta, texto y permisos | sí | PASS |

## Roturas críticas

No se atribuye a esta revisión el resultado de las mutaciones de la sesión ni el worktree de `implementation-review-1.md`. Se verificó que las aserciones indicadas apuntan al defecto, pero no se provocó el defecto en esta revisión.

| Criterio | Rotura mínima propuesta | Prueba que la detectaría | Probada en worktree (sí/no, motivo) |
|---|---|---|---|
| CA-19 / C-16 | Quitar la condición de empresa del chequeo de conexión en `get_credential` | `08` T-16, llamada con conexión de B debe dar `PX001` | **No**. Requiere la base de pruebas; tampoco se creó worktree por la prohibición de comandos destructivos. |
| CA-21 / C-15 | Quitar el `revoke all` de `count_credentials_by_key_version` | `09` T-12, anon/authenticated no deben tener `EXECUTE` | **No**. Requiere la base y un worktree que habría que eliminar. |
| CA-02b / C-18 | Quitar `browser_binding_hash` del predicado de consumo | `09b` T-19, hash ajeno debe dar `PX002` | **No**. Requiere la base y un worktree que habría que eliminar. |

## Comandos reejecutados

| Comando | Resultado | Comparación con la sesión |
|---|---|---|
| `git branch --show-current`; `git rev-parse HEAD`; `git merge-base main HEAD`; comando de árbol limpio del skill | Rama, commit y base indicados arriba; árbol limpio | Coincide |
| `git diff -M --stat BASE HEAD`; `git diff -M --name-status BASE HEAD`; `git diff -M --check BASE HEAD` | Nueve rutas; único `A` en migraciones; check sin salida | Coincide con el manifiesto de revisión 1 |
| `npm run db:check:test` | Exit 0; destino de pruebas desechable verificado | Coincide; referencia redactada aquí |
| `npm run test:policies` | Exit 0; 11 archivos, 362 aserciones, cero problemas. Nuevas: `08` 26, `09` 49, `09b` 121, `10` 21 | Coincide |
| `npm run test:app` (sandbox) | Exit 1 antes de cargar suites: `spawn EPERM` al cargar configuración de Vitest | Restricción de entorno de esta sesión, no diferencia de código |
| `npm run test:app` (ejecución autorizada fuera del sandbox) | Exit 0; 5 archivos, 29 pasadas, 7 omitidas | Coincide |
| `npm run verify` (sandbox) | Lint, typegen y typecheck pasan; Vitest no carga por `spawn EPERM` | Restricción de entorno de esta sesión |
| `npm run verify` (ejecución autorizada fuera del sandbox) | Exit 0; 8 archivos, 145 pruebas; build compilado y 11 páginas generadas | Coincide |
| Búsqueda por patrones de secretos/identificadores en nueve archivos; `git diff -M --check` | Sin coincidencias ni errores | Coincide |

No ejecuté `db:push:test`, `db:push`, `git push`, comandos destructivos ni lectura explícita de `.env.local`. El push de `0012` al proyecto de pruebas figura como intervención ya realizada por el usuario en la sesión; las suites contra los objetos persistentes pasaron.

## Hallazgos

| ID (R-NN) | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-05 | media | `.claude/skills/implementation-review/SKILL.md`, paso 3.3 | Falta repetir en esta revisión la prueba de roturas en worktree. Es una limitación de evidencia de revisión, no un defecto demostrado del código. | La instrucción del usuario prohíbe comandos destructivos; el skill manda `git worktree remove`. No hay worktree nuevo en `git worktree list`. | Si se autoriza explícitamente otro procedimiento seguro, repetir las tres mutaciones en una copia aislada y actualizar el veredicto en una revisión nueva. No cambiar código ni migraciones por este hallazgo. |

Los hallazgos R-01 a R-04 de `implementation-review-1.md` siguen documentados allí; esta revisión no los convierte en fallas nuevas de la microfase. No encontré un hallazgo nuevo de severidad alta en la implementación.

## Pendientes del usuario y siguiente paso

- El gate `G-DB-META` necesita todavía `qa-review` y aprobación visible del usuario; la decisión sobre los tres casos opt-in de correo debe permanecer explícita al aprobarlo.
- Esta revisión queda **BLOQUEADA** por R-05. Para obtener un veredicto APROBABLE bajo este skill hace falta una revisión que pueda completar el paso 3.3 con un procedimiento autorizado. No corresponde habilitar M06.3a desde este informe.

## Confirmaciones finales

- `git rev-parse HEAD` permanece en `917899199e2a192197e68b66f7cd5ee9ab99a37c`.
- El comando de árbol limpio del paso 1 no devuelve líneas; los informes en `revisiones/` están excluidos.
- `git worktree list` muestra solo el directorio del usuario; no quedó worktree temporal.
