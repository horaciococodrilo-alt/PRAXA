# Auditoría de spec — M06.1a-M06.2a (3)

- **Fecha:** 2026-09-26
- **Commit auditado:** `b9d067e`
- **Hash de contenido de la spec:** `512350f97431ca4d991782e1156a314ea3de8f33`
- **Spec:** `docs/FASES/FASE1/M06.1a-M06.2a/spec.md`
- **Precondición:** cumplida. La spec existe y figura en `BORRADOR` (`spec.md:3`).

## Veredicto

**REQUIERE CAMBIOS.** Hay cuatro hallazgos: ninguno alto, dos medios y dos bajos. Ninguno requiere decisión del usuario.

Las ocho observaciones de `spec-audit-2` (A-01 a A-08) quedaron resueltas:

- traducción de la clase `23` sin `DETAIL` (`spec.md:293-305`, T-45 a T-47);
- `PX001` ante un choque de `p_connection_id` (`:311`, C-16, T-47 y T-48);
- T-26 en pasos secuenciales (`:528`);
- citas de `credential.ts` (T-44 sin salida);
- fila de CA-38b (`:443`);
- motivo de `D-09` (`:623`);
- T-43 sin upstream (`:545`);
- `H-E1-22` registrado (`HALLAZGOS.md:39`, `:78`).

Los hallazgos nuevos son estos:

- una sentencia que la spec prescribe y que falla en PL/pgSQL;
- un caso de prueba que no puede fallar porque apunta a un archivo inexistente;
- una regla común de funciones que no encaja con dos de ellas;
- un riesgo de interfaz para `M16.1`.

La base está en verde (ver "Verificaciones ejecutadas").

## Checklist

| # | Ítem | PASS/FAIL/BLOQUEO | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | Los CA de la ficha de M06.1a (`plan.md:189`: CA-02c, CA-03, CA-07, CA-08, CA-14 a CA-18 y CA-68) y los de la ficha de M06.2a (`plan.md:204`: CA-19 a CA-22) figuran en Heredados (`spec.md:420-452`). También están los CA de II.4 y II.5, y la fila de CA-38b ya es fiel a `plan.md:456`. |
| 2 | Alcance | PASS | Alcance y Fuera de alcance (`spec.md:27-57`) coinciden con las fichas y con II.4–II.5 (`plan.md:180-208`, `:429-497`). Cada C-NN traza a un CA, un DEC, una trampa o una decisión (`spec.md:456-495`). |
| 3 | Coherencia con la spec general | PASS | Ningún elemento contradice un CA, DEC, CB o regla de `meta_first/spec.md`. La sección 7, paso 3 (error tipado sin detalles ante una conexión ajena), queda cubierta por C-16, C-35 y T-47/T-48. Las interfaces que consumen `M06.3a` y `M16.x` están definidas; ver la observación A-04 (baja) sobre `p_expires_at`. |
| 4 | Decisiones | PASS | `D-01` a `D-10` figuran como decisiones del usuario o de la ruta, con fecha (`spec.md:613-624`). No contradicen ningún DEC ni CA. El motivo de `D-09` ya cita la evidencia real (`spec-audit-1.md:71`, `spawn EPERM`). |
| 5 | Trampas | PASS | Las tres trampas de II.4, las tres de II.5 y la hipótesis de PostgreSQL 16+ (`plan.md:470-497`) están en `spec.md:583-589` y en H-S-02. |
| 6 | Intervenciones y acciones reservadas | PASS | `db:push:test` queda a cargo del usuario, con verificación posterior, como en la ficha y en III.2 (`plan.md:193`, `:208`, `:766`; `spec.md:570`). Push, despliegue y `db:push` al proyecto `app` quedan reservados al usuario, con su verificación (`spec.md:573-575`). |
| 7 | Verificación | PASS | Incluye `db:check:test`, `db:push:test`, `test:policies`, `test:app` y `verify` (`spec.md:556-563`), como exige III.3 (`plan.md:787-788`). CB-06 aparece explícito en el paso 4 y en C-36. |
| 8 | Dependencias | PASS | `G-K01` y `G-K02-K04` están aprobados (`PROJECT_STATE.md`); `M06.1a` figura como siguiente. `main@b9d067e` contiene `src/modules/integrations/contract/` y `src/modules/tenant/context.ts`. |
| 9 | Lo entregado de verdad | PASS | Columnas, nulabilidad y `check` coinciden con K02 (`oauth-attempt.ts:57-96`), K03 (`connection.ts:26-138`, `primitives.ts:33-119`) y K04 (`credential.ts:21-60`). Coinciden los regex de IV (16 caracteres sin relleno) y de etiqueta (22 más `==`), la zona IANA y `valid_granted_scopes`, que replica `:49-57`. Los pendientes de `sesiones/M05.1.2-M05.1.4.md:148-151` están cubiertos. |
| 10 | Pendientes y hallazgos | PASS | `H-E1-05`, `-06`, `-07`, `-11`, `-12`, `-19`, `-20`, `-21`, `-22` y `H-M04.1-02` quedan resueltos o diferidos con motivo. `H-E1-18`, asignado a M06.1a (`HALLAZGOS.md:35`), queda diferido por `D-09`. |
| 11 | Contexto real | PASS | Se verificaron todas las referencias `archivo:línea` de la tabla de contexto y del diseño (`0001`, `0002`, `0003`, `0004`, `0007`, `0008`, `0011`, los tests `01`, `03` y `05`, `run-pgtap.mjs`, `sql-target.mjs`, `db-push.mjs`, `check-target.mjs`, `package.json`, `vitest.config.mts`, `setup.ts`, `helpers.ts`, `target.mjs`, `config.toml:24` y `:52`, `context.ts`, `primitives.ts`, `oauth-attempt.ts`, `connection.ts`, `credential.ts`, `SECURITY.md`, `HALLAZGOS.md:7-16` y `plan.md:90`, `:191`, `:193`, `:208`, `:431`, `:450-456`, `:513`, `:581` y `:766`). Todas existen y dicen lo que la spec afirma. T-44 da salida vacía. El nombre de archivo erróneo fuera de esta tabla se trata en el ítem 14. |
| 12 | Archivos previstos | PASS | Cada archivo de `spec.md:402-414` está autorizado por II.4–II.5, por la ficha de M06.2a o por las precondiciones 8 y 9 (`plan.md:370-371`). |
| 13 | Diseño suficiente | FAIL | La spec prescribe `insert … on conflict (connection_id) do update` en `replace_credential` (`spec.md:314`), una función que devuelve `table (connection_id …)`. En PL/pgSQL, esa referencia es ambigua y falla en tiempo de ejecución; además, contradice la convención de calificar columnas, que no admite alias en el destino del conflicto (A-01). La regla común de lectura de la conexión no encaja con `create_pending_connection` ni con `create_oauth_attempt` (A-03). |
| 14 | Verificable | FAIL | T-41 verifica `vitest.config.ts`, un archivo que no existe; el real es `vitest.config.mts`. `git diff --name-only main -- vitest.config.ts` nunca da salida, así que el caso no detecta un cambio en la configuración de Vitest (A-02). |
| 15 | Sin nada abierto | PASS | Preguntas abiertas está vacía (`spec.md:640-642`). H-S-01 a H-S-10 dicen cómo y cuándo se verifican y tienen una condición de parada o una alternativa. El supuesto externo decisivo (grants por defecto y `42501` de Supabase) cita la fuente oficial. |
| 16 | Ejecutable ahora | PASS | Los scripts `test:app`, `test:policies`, `db:check:test`, `db:push:test` y `verify` están en `package.json:17-26`. Las variables `SUPABASE_TEST_*` figuran por nombre en `.env.example:57-74`. `pg` está en `package.json:49`. Existen `create_company_for_current_user` y `pendingCleanupCount`. La única intervención del usuario, `db:push:test`, tiene su paso asignado. `npm run verify` terminó en verde en un worktree limpio de `b9d067e`. |
| 17 | Consistencia interna | FAIL | La tabla de contexto cita `vitest.config.mts` (`spec.md:84`), pero Fuera de alcance, `D-09` y T-41 citan `vitest.config.ts` (`:54`, `:623`, `:543`) (A-02). La regla común de `spec.md:285` ("si no hay fila: `PX001`") contradice la fila de `create_pending_connection` (`:311`), donde la ausencia de fila es el caso válido (A-03). |
| 18 | Reglas no negociables | PASS | Tenant verificado por membresía en cada función, sin secretos ni datos reales (datos sintéticos, T-38), solo una migración nueva (C-01), pruebas solo contra el proyecto desechable (`resolveSqlTestTarget`; el ensayo nunca usa `SUPABASE_DB_URL`), credenciales solo por `worker_api` (C-09, C-31) y errores redactados (C-35, T-45 a T-48). |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| `replace_credential`: `insert … on conflict (connection_id) do update` (`spec.md:314`) | La propia spec, Diseño §1 (`spec.md:108`: toda columna con alias, por el choque con los parámetros de salida), y el comportamiento de PL/pgSQL (`plpgsql.variable_conflict = error`, el valor por defecto) | La función devuelve `table (connection_id uuid, …)`. El destino de `on conflict (col)` se resuelve como referencia de columna, no admite alias de tabla y choca con la variable de salida `connection_id`. Resultado: "column reference "connection_id" is ambiguous" en la primera ejecución | Usar `on conflict on constraint integration_credentials_pkey do update …` (A-01) |
| Fuera de alcance, `D-09` y T-41: "no toca `vitest.config.ts`" (`spec.md:54`, `:623`, `:543`) | La tabla de contexto de la propia spec (`spec.md:84`: `vitest.config.mts`) y el árbol real | `ls vitest.config.*` → solo `vitest.config.mts`; `git diff --name-only main -- vitest.config.ts` → salida vacía y exit 0 aunque `.mts` cambie | Reemplazar por `vitest.config.mts` en las tres ubicaciones (A-02) |
| Regla común: "después leen la conexión con `for update` … Si no hay fila: `PX001`" (`spec.md:285`) | Filas de `create_pending_connection` (`:311`: la conexión todavía no existe; si existe da `PX001`) y de `create_oauth_attempt` `initial` (`:309`: no recibe conexión) | Leída a la letra, `create_pending_connection` daría siempre `PX001` | Acotar la regla a las funciones que operan sobre una conexión existente (A-03) |

## Hallazgos

| ID | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | media | Diseño §8, fila de `replace_credential` | La sentencia prescrita falla en tiempo de ejecución por ambigüedad entre la columna `connection_id` y el parámetro de salida homónimo. La regla de alias de §1 no se puede aplicar en el destino de `on conflict`. T-22 fallaría, y el implementador tendría que apartarse del texto de la spec | `spec.md:108`, `:314`; salida `table (connection_id uuid, status text, credential_generation integer)` | Escribir `insert into private.integration_credentials as cr (…) values (…) on conflict on constraint integration_credentials_pkey do update set …` y agregar a §1: "en `on conflict` se usa `on constraint <nombre>`, nunca la lista de columnas" | No |
| A-02 | media | Fuera de alcance; `D-09`; T-41 | Se cita `vitest.config.ts`, que no existe; el archivo real es `vitest.config.mts`. T-41 no puede detectar un cambio en la configuración de Vitest, así que la verificación de `D-09` es vacía | `spec.md:54`, `:543`, `:623` frente a `:84`; `ls vitest.config.*` | Cambiar las tres menciones a `vitest.config.mts` y ajustar el comando de T-41. `H-E1-18` en `HALLAZGOS.md:68` arrastra el mismo nombre: corregirlo en el paso 8 de la secuencia | No |
| A-03 | baja | Diseño §8, reglas comunes | "Leen la conexión … si no hay fila: `PX001`" no aplica a `create_pending_connection` ni a `create_oauth_attempt` `initial`. En `replace_credential`, la fila enumera primero el chequeo del intento (`PX002`); C-16 y T-16 exigen `PX001` con una conexión ajena. El orden se deduce de la regla común, pero no está escrito | `spec.md:285`, `:309`, `:311`, `:314`, `:473`, `:518` | Redactar así: "las funciones que reciben una conexión existente (todas las que tienen `p_connection_id`, salvo `create_pending_connection`) la leen con `for update`, filtrando por `id` y `company_id`, antes de cualquier chequeo propio de la función, incluido el del intento en `replace_credential`" | No |
| A-04 | baja | Diseño §8, `create_oauth_attempt`; Riesgos | La base rechaza `p_expires_at > now() + 10 minutos`, con el `now()` de la base. K02 admite exactamente 10 minutos (`OAUTH_ATTEMPT_MAX_TTL_MS`, `oauth-attempt.ts:26`). Si `M16.1` calcula el vencimiento en Node con el tope exacto, cualquier desfase de reloj a favor de Node produce un `22023` intermitente | `spec.md:309`, `:624`; `oauth-attempt.ts:26`, `:88-89` | Declararlo en Riesgos como condición para `M16.1`: vida del intento menor que el tope, con margen. Alternativa técnica equivalente: que la función reciba una duración y calcule `expires_at` con el reloj de la base | No |

## Observación de tamaño (no afecta el veredicto)

Se mantiene la de las auditorías anteriores. Si al planificar el grupo no cabe en dos cortes de 8 horas, conviene separarlo así, sin adelantar `G-DB-META`:

- `M06.1a`: esquema, rol, tablas, privilegios y funciones, con `09`;
- `M06.2a`: `08`, `09b`, `10` y la prueba de la Data API.

## Verificaciones ejecutadas

| Comando | Resultado |
|---|---|
| `git status --short` / `git rev-parse --short HEAD` | `main@b9d067e`. Cambios existentes: `docs/HALLAZGOS.md` (registro de `H-E1-22`) y la carpeta `docs/FASES/FASE1/M06.1a-M06.2a/` sin seguimiento |
| `grep -v '^\*\*Estado:\*\*' …/spec.md \| git hash-object --stdin` | `512350f97431ca4d991782e1156a314ea3de8f33` |
| T-44 (`grep` de referencias obsoletas) | Sin coincidencias |
| `sed -n` sobre los archivos y líneas citados (migraciones, tests, scripts, contratos, `plan.md`, `SECURITY.md`, `HALLAZGOS.md`) | Coinciden con lo que afirma la spec |
| `ls vitest.config.*`; `git diff --name-only main -- vitest.config.ts` | Solo existe `vitest.config.mts`; el `diff` da salida vacía y exit 0. Confirma A-02 |
| `git worktree add --detach ../praxa-review-spec-audit-3 HEAD` | Worktree limpio de `b9d067e` |
| `npm ci` en el worktree | Exit 0; 0 vulnerabilidades |
| `npm run verify` en el worktree (Git Bash) | **Exit 0**: lint, typegen y typecheck en verde; 8 archivos y 145 pruebas pasaron; `next build` compiló sin errores |
| `git worktree remove ../praxa-review-spec-audit-3` | Worktree eliminado |

No se leyó `.env.local`, no se ejecutó nada contra ninguna base remota y no se expuso ningún secreto.

## Siguiente paso

Aplicar A-01 a A-04 en la spec. Son correcciones técnicas y ninguna requiere decisión del usuario. Después, correr una cuarta auditoría. La spec no debe pasar a `APROBADA` todavía.
