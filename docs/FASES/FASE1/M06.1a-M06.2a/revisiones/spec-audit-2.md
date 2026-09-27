# Auditoría de spec — M06.1a-M06.2a (2)

- **Fecha:** 2026-09-26
- **Commit auditado:** `b9d067e`
- **Hash de contenido de la spec:** `64ca0bd386554ec308759372560b2c44bbde6f35`
- **Spec:** `docs/FASES/FASE1/M06.1a-M06.2a/spec.md`
- **Precondición:** cumplida; la spec existe y figura en `BORRADOR` (`spec.md:3`).

## Veredicto

**REQUIERE CAMBIOS.** Hay ocho hallazgos: ninguno alto, tres medios y cinco bajos. Ninguno requiere decisión del usuario. Las siete observaciones de `spec-audit-1` quedaron resueltas: K04 exacto, comparador `<` y borde de 10 minutos, `db:push:test` del usuario ya alineado con Parte I y III.2, comandos que incluyen archivos sin seguimiento, excepción de cerrojo, semántica única de `purge_connection` y cita de `H-E1-19`. Los hallazgos nuevos son de traducción de errores, de una prueba no sembrable y de redacción. La base está en verde (ver "Verificaciones ejecutadas"): el veredicto se debe a defectos de la spec, no a un bloqueo.

## Checklist

| # | Ítem | PASS/FAIL/BLOQUEO | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | Los CA de las fichas (`plan.md:189`: CA-02c, CA-03, CA-07, CA-08, CA-14 a CA-18, CA-68; `plan.md:204`: CA-19 a CA-22) y los de II.4/II.5 están en Heredados (`spec.md:404-438`). La fila de CA-38b pierde precisión (A-05, baja), sin omitir el CA. |
| 2 | Alcance | PASS | Alcance y Fuera de alcance (`spec.md:27-57`) corresponden a las fichas y a II.4–II.5 (`plan.md:180-208`, `:429-497`); cada C-NN traza a CA, DEC, trampa o decisión (`spec.md:442-481`). |
| 3 | Coherencia con la spec general | FAIL | La sección 7, paso 3, de la spec de la ruta exige que una `connection_id` ajena dé "un error tipado sin detalles" (`meta_first/spec.md:150`). `create_pending_connection` recibe `p_connection_id`, y con el de otra empresa el diseño no da `PX001`: da `PX003` o un `23505` crudo de la PK, cuyo DETAIL expone el identificador (A-02). |
| 4 | Decisiones | PASS | `D-M06.1a-M06.2a-01` a `-10` figuran como decisiones del usuario o de la ruta (`spec.md:595-606`) y no contradicen ningún DEC ni CA. El motivo de `-09` cita una evidencia que no coincide con `spec-audit-1` (A-06, baja); la decisión no cambia. |
| 5 | Trampas | PASS | Las tres de II.4 y las tres de II.5, más la hipótesis de PostgreSQL 16+ (`plan.md:470-497`), están en `spec.md:563-571` y H-S-02. |
| 6 | Intervenciones y acciones reservadas | PASS | `db:push:test` a cargo del usuario coincide ahora con las fichas (`plan.md:193`, `:208`) y con III.2 (`plan.md:766`). Push, despliegue y `db:push` al proyecto `app` quedan reservados al usuario, cada uno con su verificación (`spec.md:549-559`). |
| 7 | Verificación | PASS | `db:check:test`, `db:push:test`, `test:policies`, `test:app` y `verify` (`spec.md:534-545`), como exige III.3 (`plan.md:787-788`); CB-06 explícito (`spec.md:541`, C-36). |
| 8 | Dependencias | PASS | `G-K01` y `G-K02-K04` aprobados (`PROJECT_STATE.md:12-13`); `M06.1a` figura como siguiente (`:14`). `main@b9d067e` contiene `src/modules/integrations/contract/` y `src/modules/tenant/context.ts`. |
| 9 | Lo entregado de verdad | PASS | Columnas, nulabilidad y `check` coinciden con K02 (`oauth-attempt.ts:57-96`), K03 (`connection.ts:26-138`, `primitives.ts:33-119`) y K04 (`credential.ts:21-60`, `primitives.ts:15-26`). Los regex de IV (16 caracteres sin relleno) y etiqueta (22 + `==`) equivalen a `base64OfBytes(12)` y `(16)`. `valid_granted_scopes` reproduce mínimo 1, sin nulos, sin repetidos, forma de `scopeSchema` y `ads_read`. Los pendientes de `sesiones/M05.1.2-M05.1.4.md:148-151` están cubiertos. |
| 10 | Pendientes y hallazgos | PASS | `H-E1-05`, `-06`, `-07`, `-11`, `-12`, `-19`, `-20`, `-21` y `H-M04.1-02` resueltos o diferidos con motivo; `H-E1-18`, asignado a M06.1a (`HALLAZGOS.md:35`), queda diferido con `D-M06.1a-M06.2a-09` (`spec.md:54`, `:605`). |
| 11 | Contexto real | FAIL | Las citas a `credential.ts` de `spec.md:205-207`, `:211`, `:277` y `:462` apuntan a líneas equivocadas: `:37` no es `scopeSchema` (está en `:35`); `:45`, `:46` y `:47` no son `ciphertext`, `iv` y `auth_tag` (están en `:42-44`); `granted_scopes` está en `:49-57`, no en `:48-56` (A-04). El resto de las referencias verificadas (`0001`, `0002`, `0003`, `0004`, `0007`, `0008`, `0011`, `01`, `03`, `05`, `run-pgtap.mjs`, `sql-target.mjs`, `db-push.mjs`, `check-target.mjs`, `package.json`, `vitest.config.mts`, `setup.ts`, `helpers.ts`, `target.mjs`, `config.toml`, `context.ts`, `primitives.ts`, `oauth-attempt.ts`, `SECURITY.md`, `HALLAZGOS.md`, `plan.md`) existen y dicen lo que la spec afirma. T-44 da salida vacía. |
| 12 | Archivos previstos | PASS | Todo archivo de `spec.md:388-399` está autorizado por II.4–II.5, la ficha de M06.2a o las precondiciones 8 y 9 (`plan.md:370-371`). El script del ensayo vive fuera del repositorio. |
| 13 | Diseño suficiente | FAIL | Sin traducción definida para `23502` ni para los `23505` que no son la cuenta ni la conexión viva, así que el implementador tiene que elegir códigos (A-01). Tampoco está definido el resultado de `create_pending_connection` con un `p_connection_id` ajeno o ya existente (A-02). |
| 14 | Verificable | FAIL | T-26 no se puede sembrar: una pendiente y una activa en la misma empresa violan `integration_connections_one_live_per_company` (A-03). T-43 usa `@{u}`, que falla en una rama nueva sin upstream (A-07). |
| 15 | Sin nada abierto | PASS | Preguntas abiertas está vacía (`spec.md:622-624`). Cada hipótesis H-S-01 a H-S-10 dice cómo y cuándo se verifica y tiene condición de parada o alternativa. El supuesto externo decisivo (grants por defecto y `42501` de Supabase) tiene fuente oficial citada. |
| 16 | Ejecutable ahora | PASS | Scripts `test:app`, `test:policies`, `db:check:test`, `db:push:test` y `verify` en `package.json:17-26`; variables `SUPABASE_TEST_*` por nombre en `.env.example:57-74`; `pg` en `package.json:49`; `pendingCleanupCount` en `helpers.ts:203`. Ninguna intervención previa al primer paso. `npm run verify` en un worktree limpio de `b9d067e`: ver "Verificaciones ejecutadas". |
| 17 | Consistencia interna | FAIL | C-16 (`spec.md:459`) dice que *cada* función que recibe `p_connection_id` da `PX001` con una conexión ajena, pero la fila de `create_pending_connection` (`spec.md:298`) no lo cumple (A-02). La fila de CA-38b (`spec.md:429`) dice "los intentos vencidos", en contra de C-37 y `D-M06.1a-M06.2a-07` (`spec.md:461`, `:603`) (A-05). |
| 18 | Reglas no negociables | FAIL | Tenant por membresía, sin secretos ni datos reales, solo migración nueva, pruebas solo contra el proyecto desechable y credenciales solo por `worker_api`: PASS. Errores redactados: FAIL. Un `23502` o un `23505` no traducido sale de `worker_api` con un DETAIL que contiene la fila o la clave (hashes, identificadores), en contra de C-35 y CB-02 (A-01, A-02). |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| `create_pending_connection` con un `p_connection_id` que ya existe en otra empresa: `PX003` si la empresa tiene una viva; si no, `23505` de la PK sin traducir (`spec.md:292`, `:298`) | Spec de la ruta, sección 7, paso 3 (`meta_first/spec.md:150`: una `connection_id` ajena da "un error tipado sin detalles"), y C-16 de la propia spec (`spec.md:459`) | El DETAIL de `23505` es `Key (id)=(<uuid>) already exists`: confirma que el identificador existe en otra empresa | Traducir la violación de la PK de `integration_connections` (y de `integration_credentials`) a `PX001`, y agregar el caso a T-16 o T-30 (A-02) |
| Heredados, CA-38b: "purga … los intentos vencidos y los consumidos hace más de 10 minutos" (`spec.md:429`) | `plan.md:456` ("los intentos no consumidos ya vencidos") y la propia spec, C-37 y `D-M06.1a-M06.2a-07` (`spec.md:461`, `:603`) | Leída a la letra, la fila borraría el intento consumido hace 2 minutos y ya vencido que T-39 exige conservar | Reescribir la fila con "no consumidos ya vencidos" (A-05) |

## Hallazgos

| ID | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | media | Diseño §6 y §8 (regla de traducción); C-35; T-31 | La regla de traducción solo cubre `23514`, `23505` de la cuenta (`PX007`) y `23505` de la conexión viva (`PX003`). Faltan `23502` (por ejemplo, `p_state_hash`, `p_return_path` o `p_ciphertext` nulos; un `p_expires_at` nulo pasa la comparación, porque `null` no es verdadero, y termina en `23502`) y los demás `23505` (`state_hash` único, PK de conexión y de credencial). Postgres adjunta a esos errores un DETAIL con la fila fallida o la clave, que incluye hashes y material cifrado, y así violan C-35 y CB-02. El implementador tiene que inventar el código | `spec.md:250`, `:292`, `:480`, `:519`; `create_oauth_attempt` en `:296` (sin chequeo de nulos para `p_expires_at`) | Declarar en §8: `23502` → `22023`; cualquier otro `23505` → `22023`, salvo la PK de conexión, que da `PX001` (A-02); y "ningún SQLSTATE `23xxx` sale sin traducir". Agregar a T-31, o a un caso nuevo de `09b`, al menos un parámetro obligatorio nulo → `22023` con el mensaje fijo, y un `state_hash` repetido por `create_oauth_attempt` → `22023` | No |
| A-02 | media | Diseño §8 (`create_pending_connection`); C-16; T-16 | C-16 exige `PX001` en toda función que recibe `p_connection_id` con una conexión ajena. `create_pending_connection` recibe `p_connection_id` y, con uno ajeno, da `PX003` o un `23505` crudo que revela la existencia de la fila en otra empresa. Sección 7, paso 3, de la ruta | `spec.md:298`, `:351`, `:459`, `:504`; `meta_first/spec.md:150` | Especificar que una colisión de `p_connection_id` con cualquier fila existente, propia o ajena, da `PX001`, indistinguible, y cubrirlo en `08` (con A sin conexión viva, para que no gane `PX003`); o excluir expresamente `create_pending_connection` de C-16 y definir su resultado | No |
| A-03 | media | Casos, T-26 (C-25) | T-26 siembra "una pendiente vencida, una desconectada y una activa" en la misma empresa. La pendiente, aunque esté vencida, sigue en `pending_selection`, y junto con la activa viola el índice único parcial de conexión viva. El caso no se puede sembrar tal como está escrito | `spec.md:177`, `:470`, `:514` | Sembrar la pendiente vencida y la desconectada en la empresa A, y la activa en otra empresa (o en A, en un segundo paso, después de purgar la pendiente), y afirmar que `list_pending_purges(A)` no devuelve la activa ni filas de otra empresa | No |
| A-04 | baja | Diseño §5.3, §7; C-38 | Referencias `archivo:línea` falsas a `credential.ts`: `:37` (es `:35`), `:45`/`:46`/`:47` (son `:42`/`:43`/`:44`), `:48-56` (es `:49-57`) y `:45-56` (es `:42-57`) | `grep -n` sobre `credential.ts`: `scopeSchema` en 35, `ciphertext` en 42, `iv` en 43, `auth_tag` en 44, `granted_scopes` en 49 | Corregir las seis citas (o citar por símbolo) y sumar el patrón a T-44 | No |
| A-05 | baja | Heredados, fila CA-38b | El resumen no es fiel a `plan.md:456` y contradice C-37 y `D-M06.1a-M06.2a-07` | `spec.md:429`, `:461`, `:603` | "purga, de esa empresa, los intentos no consumidos ya vencidos y los consumidos hace más de 10 minutos" | No |
| A-06 | baja | Decisiones, `D-M06.1a-M06.2a-09` (motivo) | Dice que `H-E1-18` "se repitió en la auditoría de esta spec", pero `spec-audit-1` registró otra falla: `spawn EPERM` del sandbox, que es de entorno y no el timeout del worker de `H-E1-18` | `spec.md:605`; `revisiones/spec-audit-1.md:71` | Quitar esa frase o citar la evidencia real. La decisión de diferir no cambia | No |
| A-07 | baja | Casos, T-43 | `git log --oneline @{u}..HEAD` termina en error (`no upstream configured`) en `mf/M06.1a-M06.2a` recién creada sin push, y el resultado esperado no contempla ese caso | `spec.md:531`; secuencia, paso 1 (`spec.md:376`) | Usar `git status -sb` y `git branch -vv`, con este resultado esperado: sin upstream o sin commits por delante hechos por el asistente sin pedido | No |
| A-08 | baja | Fuera de alcance (CA-39) | La spec identifica un hueco nuevo, sin registrarlo con ID: ninguna función de `worker_api` puede guardar una clase de error que no lleve a `needs_reauth` (CA-39: "se registra la clase"), y `authenticated` no escribe. `M16.1`/`M16.2` no tienen migración en la ruta. El protocolo (`AGENTS.md`, regla 9) exige un ID estable | `spec.md:52`; `plan.md:255-283` (sin migración en M16.1/M16.2); `meta_first/spec.md:293` | Registrar un hallazgo nuevo (por ejemplo, `H-E1-22`, asignado a `M16.1`/`M16.2`) en el paso 8 de la secuencia y en "Hallazgos relacionados" | No |

## Observación de tamaño (no afecta el veredicto)

Se mantiene la de `spec-audit-1`: el grupo abarca una migración con tres tablas, dos helpers y doce funciones, cuatro archivos pgTAP con más de cuarenta casos, una prueba remota, un ensayo con rollback y un procedimiento condicional. Si al planificar no cabe en dos cortes de 8 horas, conviene separar en `M06.1a` (esquema, rol, tablas, privilegios y funciones, con `09`) y `M06.2a` (`08`, `09b`, `10` y la Data API), sin adelantar `G-DB-META`. Además, el ensayo del paso 5 requiere ejecutar un script `node` que no está en la lista de permisos de `.claude/settings.json`: pedirá aprobación en el momento.

## Verificaciones ejecutadas

| Comando | Resultado |
|---|---|
| `git status --short` / `git rev-parse --short HEAD` | `main@b9d067e`; solo `docs/FASES/FASE1/M06.1a-M06.2a/` sin seguimiento |
| `grep -v '^\*\*Estado:\*\*' …/spec.md \| git hash-object --stdin` | `64ca0bd386554ec308759372560b2c44bbde6f35` |
| T-44 (`grep` de referencias obsoletas) | Sin coincidencias |
| `grep -n` de campos en `credential.ts` | Confirma A-04 |
| `git worktree add --detach ../praxa-review-spec-audit-2 HEAD` | Worktree limpio de `b9d067e` |
| `npm ci` en el worktree | Exit 0; 0 vulnerabilidades |
| `npm run verify` en el worktree | **Exit 0** en la primera corrida (Git Bash): lint, typegen y typecheck en verde; 8 archivos y 145 pruebas pasaron; `next build` compiló sin errores |
| `git worktree remove ../praxa-review-spec-audit-2` | Worktree eliminado |

No se leyó `.env.local`, no se ejecutó nada contra una base remota y no se expuso ningún secreto.

## Siguiente paso

Aplicar A-01 a A-08 en la spec. Son correcciones técnicas, sin decisiones del usuario. Después, correr una tercera auditoría. La spec no debe pasar a `APROBADA` todavía.
