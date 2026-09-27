# M06.1a-M06.2a — Revisión de implementación 1

- **Fecha:** 2026-09-27
- **Rama:** `mf/M06.1a-M06.2a`
- **Commit revisado:** `917899199e2a192197e68b66f7cd5ee9ab99a37c`
- **Base fija (`git merge-base main HEAD`):** `45fc760335a9eabcac4c5ea67eca04c02d9ab90c`
- **Estado de la microfase al revisar:** `VERIFICADO — PENDIENTE DE APROBACIÓN` (`docs/PROJECT_STATE.md:14` y la sesión, línea 6). `G-DB-META` sin aprobar.
- **Árbol:** limpio al empezar y al terminar (comando del paso 1 de la skill, sin salida).

## Veredicto

**APROBABLE.** Los ocho ítems están en PASS. Hay cuatro hallazgos de severidad baja, ninguno bloqueante. Una limitación: las roturas del ítem 3 dependen de la base de datos y, como indica la skill, no se ejecutaron en el worktree (ver "Roturas").

## Manifiesto revisado

`git diff -M --name-status 45fc760 9178991`:

```text
A  docs/FASES/FASE1/meta_first/sesiones/M06.1a-M06.2a.md
M  docs/HALLAZGOS.md
M  docs/PROJECT_STATE.md
A  supabase/migrations/0012_integrations.sql
A  supabase/tests/08_integration_isolation.test.sql
A  supabase/tests/09_integration_privileges.test.sql
A  supabase/tests/09b_integration_lifecycle.test.sql
A  supabase/tests/10_demo_closure.test.sql
A  tests/app/integrations-data-api.test.ts
```

Commits de `main..HEAD`: `0b50888`, `bd2e24a`, `9398dcf` y `9178991`. `bd2e24a` tocaba `.claude/skills/…` y `9178991` lo revierte: `git diff 45fc760 HEAD -- .claude` no tiene salida. La spec y el plan de la microfase no cambiaron. Sus hashes recalculados coinciden con los aprobados: spec `e57d8a7f…`, plan `be9885c3…`.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Alcance | PASS | Los nueve archivos están en la tabla de archivos del plan (`plan.md:27-39`) o son de seguimiento. T-41 (`scripts/lib/target.mjs`, `tests/app/helpers.ts`, `docs/SECURITY.md`, `vitest.config.mts` y `supabase/config.toml`) sin salida. No hay funcionalidad de más: ni RPC pública ni trigger de transiciones, y `reports`/`0003` no se tocan (H-E1-07 falsa). Todo lo que exige "Implementación requerida" está: esquema, rol sin contraseña, enums, tres tablas con RLS forzada, revokes, restricciones por estado, propósito, marca de purga, doce funciones con chequeo de pertenencia y matriz en el encabezado (M06.1a); pgTAP `08`, `09`, `09b` y `10`, y `test:app` de la Data API (M06.2a) |
| 2 | Criterios | PASS | Cada criterio heredado y operativo tiene una prueba cuya aserción lo verifica (ver la matriz). Todas pasan en la reejecución |
| 3 | Las pruebas detectan roturas | PASS (limitado) | Worktree del commit revisado, `npm ci` y tres roturas críticas aplicadas. Las tres dependen de la base: el worktree no tiene `.env.local` ni variables `SUPABASE_*`/`PRAXA_*`. `run-pgtap.mjs` se niega a correr ("Falta SUPABASE_TEST_DB_URL") y la suite de la Data API se omite (1 pasada, 6 omitidas). Por eso quedan **no probadas**, como pide la skill. Por la lectura de cada aserción, las tres serían detectadas; la sesión registra además seis mutaciones en memoria (M1 a M6) detectadas en el ensayo. Worktree restaurado y eliminado |
| 4 | Reejecución | PASS | `db:check:test` verificado. `test:policies` 11 archivos / 362 aserciones / 0 problemas. `test:app` 5 archivos, 29 pasadas y 7 omitidas, con las 6 de la Data API pasadas. `verify` exit 0: 8 archivos, 145 pruebas y build correcto. Todo coincide con la sesión. Desde Git Bash, `test:app` y `verify` fallaron al cargar las suites (H-E1-20, entorno); con PowerShell pasaron (R-01) |
| 5 | Seguridad y reglas | PASS | T-38 y un patrón ampliado sin coincidencias en los nueve archivos. La referencia del proyecto de pruebas no aparece en ellos. No se leyó `.env.local`. Única migración nueva `0012`, sin `M`, `D` ni `R` (T-01). Sin `password` en `0012`. `service_role` solo aparece en los `revoke` y en las aserciones que prueban su ausencia; el código no lo usa. Tenant: la política usa `private.is_company_member(company_id)`, y `worker_api` verifica actor y empresa en `company_members` (K01 llega en M06.3a). Mensajes fijos `praxa:` sin identificadores, y la clase `23` se traduce sin `DETAIL`/`HINT`. `server-only`: no aplica, no hay módulos de servidor nuevos |
| 6 | Calidad funcional | PASS | Los caminos de error del catálogo (`PX001`–`PX008` y `22023`) están implementados en el orden de la spec §8: actor → argumentos → cerrojo → conexión por `id` y `company_id` → chequeos propios. `consume_oauth_attempt` es un único `update … returning`, sin cerrojo. Las otras ocho funciones de escritura toman `private.lock_company` (8 llamadas, líneas 430–1195). Columnas con alias y `on conflict on constraint`. La prueba TS no usa `any` ni `@ts-`. `ssl: { rejectUnauthorized: false }` sigue el patrón existente (`scripts/run-pgtap.mjs:176`, `tests/app/concurrency.test.ts:56`). La única coincidencia de "TODO" es la palabra "todos" (`0012:55`) |
| 7 | Evidencia | PASS | La sesión registra comandos y salidas reales redactadas: rojo TDD, parte 1 de `10` sola, ensayo con rollback, push del usuario, `test:policies`, `test:app` y `verify`. También registra los desvíos: la colación en `09`, el helper de T-14, el `id` sin default y la decisión sobre `email-flows`. Hallazgo nuevo con ID: `H-E1-23`. `G-DB-META` figura "sin aprobar"; los gates anteriores están aprobados legítimamente |
| 8 | Contradicciones | PASS | Sin contradicciones con la spec, el plan ni `AGENTS.md`. La spec (Verificación, paso 4) pide `test:app` "ninguna omitida", y quedaron omitidas las 3 pruebas opt-in de `email-flows`, ajenas al corte. El desvío se llevó al usuario, que lo decidió (sesión, línea 226), y quedó registrado como `H-E1-23`. Ver "Pendientes del usuario" |

## Matriz de criterios

### Heredados

| Criterio | Prueba | ¿La aserción verifica el criterio? | Resultado |
|---|---|---|---|
| CA-01 (solo hash del `state`) | T-17 `state_hash` no hex → 23514; T-07 columnas sin `state` plano | sí | PASS |
| CA-02 (vencimiento corto; vencido no consumible) | T-17 (11 min, `now()`), T-18 (11 min, pasado), T-19 vencido → PX002 | sí | PASS |
| CA-02b (vínculo actor, empresa, navegador) | T-19: otro actor, otra empresa con actor miembro de ambas, otro hash de vinculación → PX002 | sí | PASS |
| CA-02c (propósito) | T-17 forma del propósito; T-18 reauth guarda conexión y generación leída | sí | PASS |
| CA-03 (consumo único y atómico) | T-19 primer consumo devuelve propósito, segundo → PX002; revisión: una sola sentencia (`0012:521-530`) | sí | PASS |
| CA-04 (retorno en allowlist) | T-17 `/otra` → 23514 | sí | PASS |
| CA-05 (enum `meta`) | T-06 `enum_has_labels` | sí | PASS |
| CA-07 (estados y transiciones) | T-06; T-29 seis transiciones no declaradas → PX004; T-18 reauth sobre pendiente/desconectada → PX004; T-25 purga de activa → PX004 | sí | PASS |
| CA-08 (metadatos por estado) | T-17 (parciales, activa sin metadatos); T-24 pendiente → desconectada sin metadatos | sí | PASS |
| CA-09, CA-09b (error y cuenta/negocio) | T-17 par clase-mensaje, 501 caracteres; T-20 negocio guardado; T-21 cuenta guardada | sí | PASS |
| CA-10 a CA-13 (credencial cifrada) | T-07 columnas exactas, sin texto plano; T-17 IV, etiqueta, versión y permisos; T-11 FK en cascada; T-38 sin tokens | sí | PASS |
| CA-14 (RLS forzada) | T-08 `relrowsecurity` y `relforcerowsecurity`; T-15 dueño con `bypassrls` | sí | PASS |
| CA-15 (credenciales sin grants) | T-09 ACL explícita y sin más titular que el dueño | sí | PASS |
| CA-16 (matriz en el encabezado) | T-02 (lectura): `0012:8-28` coincide con la sección 7 de la ruta, con la columna `service_role` | sí | PASS |
| CA-17 (`revoke all` antes de cada grant) | T-03/T-40 (lectura): esquema 102→107, conexiones 349→366, doce funciones 1253–1311 de a pares, helpers 167–170 | sí | PASS |
| CA-18 (una viva; cuenta única; reconexión) | T-17 23505 ×2; T-27 PX007 y reconexión en fila nueva | sí | PASS |
| CA-19 (aislamiento) | `08` (T-16): A ve solo su conexión; cero filas de B; escrituras con 42501; `worker_api` cruzado → PX001 | sí | PASS |
| CA-20 (política con `is_company_member`) | T-10 | sí | PASS |
| CA-21 (nadie lee credenciales) | T-16 42501; T-12 sin EXECUTE; T-13; T-14; T-33 aserción 6 | sí | PASS |
| CA-22 (anon, authenticated y rol de C) | T-13: rol de C ejecuta 3 funciones y no lee ninguna tabla; anon y authenticated → 42501 en las 12 | sí | PASS |
| CA-25 (rotación) | T-28 conteo global = consulta directa, versiones 1 y 2, rewrap PX008/PX006, conteos −1/+1 | sí | PASS |
| CA-28 (intento initial/reauth) | T-18 PX003, PX004 | sí | PASS |
| CA-29 (un solo error) | T-19 todas las causas → PX002 con el mismo mensaje | sí | PASS |
| CA-32 (permisos) | T-17 permisos inválidos, repetidos, nulos, sin `ads_read` | sí | PASS |
| CA-35 (pendiente) | T-20 | sí | PASS |
| CA-37 (confirmación vencida) | T-21 PX005 sin purga | sí | PASS |
| CA-37b / CA-38 (purga) | T-24, T-25 (idempotente, sin credencial ni intentos), T-26 | sí | PASS |
| CA-37c (reauth con generación) | T-22 PX006, PX002 ×3, caso válido | sí | PASS |
| CA-38b (purga de intentos) | T-39 con el borde exacto de 10 minutos y otra empresa | sí | PASS |
| CA-39 (clases de `needs_reauth`) | T-17 `unknown` y clase nula; T-23 `unknown` → 22023 | sí | PASS |
| CA-67 (cierre) | T-32 parte 1 (8/8) y parte 2: usuario primero → 23503, empresa → cero filas en 9 tablas, usuario después → cero | sí | PASS |
| CA-68 (cascada desde `companies`) | T-11; T-32 parte 2 | sí | PASS |
| Ficha M06.1a (pertenencia de actor y conexión) | T-30 (33 llamadas → PX001); T-16; T-42; T-48 | sí | PASS |
| Ficha M06.2a (rol de C no lee; authenticated no ejecuta; cierre en cero) | T-13; T-32 | sí | PASS |
| Sección 5b (Data API) | T-33, 6 aserciones con el cliente autenticado | sí | PASS |
| CB-01 a CB-06 | `verify`, T-38, T-01, `db:check:test` y conteos reales. Omitidas en `test:app`: 3 opt-in de correo, por decisión del usuario (`H-E1-23`) | sí | PASS (con la decisión registrada) |

### Operativos

| Criterio | Prueba | ¿La aserción verifica el criterio? | Resultado |
|---|---|---|---|
| C-01 | T-01 (`git diff -M` contra la base y contra `main`) | sí | PASS |
| C-02 | T-02 (lectura del encabezado: matriz, reglas, excepción y catálogo) | sí | PASS |
| C-03 | T-03, T-40 y T-12 (helpers con ACL explícita) | sí | PASS |
| C-04 | T-04 (5 aserciones) | sí | PASS |
| C-05 | T-05; `grep password` sin salida | sí | PASS |
| C-06 | T-06 | sí | PASS |
| C-07 | T-07 (`columns_are` y tipos/nulabilidad de las tres tablas) | sí | PASS |
| C-08 | T-07 (`company_id` no nulo) y T-08 | sí | PASS |
| C-09 | T-09 (7 privilegios × 4 roles, ACL de credenciales) | sí | PASS |
| C-10 | T-10 | sí | PASS |
| C-11 | T-17 (8 casos de estado) | sí | PASS |
| C-12 | T-17 (23505 ×2) | sí | PASS |
| C-13 | T-11 (5 FK con `confdeltype = 'c'`) | sí | PASS |
| C-14 | T-17 (hashes, propósito, retorno, vencimiento, `state_hash` único) | sí | PASS |
| C-15 | T-12 (12 funciones, `prosecdef`, `search_path`, ACL no nula, sin PUBLIC, roles, firmas) | sí | PASS |
| C-16 | T-30, T-16, T-42, T-47, T-48 | sí | PASS |
| C-17 | T-18 | sí | PASS |
| C-18 | T-19 y la revisión del cuerpo | sí | PASS |
| C-19 | T-20 | sí | PASS |
| C-20 | T-21 | sí | PASS |
| C-21 | T-22 | sí | PASS |
| C-22 | T-23 | sí | PASS |
| C-23 | T-24 | sí | PASS |
| C-24 | T-25 y T-42 | sí | PASS |
| C-25 | T-26 (dos pasos, con B) | sí | PASS |
| C-26 | T-27 | sí | PASS |
| C-27 | T-28 | sí | PASS |
| C-28 | T-29 y T-18 | sí | PASS |
| C-29 | T-16 (capa 1) | sí | PASS |
| C-30 | T-13 | sí | PASS |
| C-31 | T-14 | sí (regresión declarada) | PASS |
| C-32 | T-15 | sí | PASS |
| C-33 | T-32 (parte 1 sola en el rojo, 8/8; archivo completo, 21/21) | sí | PASS |
| C-34 | T-33 | sí | PASS |
| C-35 | T-31 (mensajes exactos de PX001–PX008), T-45, T-46 y T-47 (`DETAIL`/`HINT` vacíos; el hash no aparece) | sí; ver R-03 | PASS |
| C-36 | T-35 a T-37 y reejecución | sí | PASS (con la decisión de `H-E1-23`) |
| C-37 | T-39 | sí | PASS |
| C-38 | T-17 (IV de 10/11 bytes, etiqueta, `ciphertext`, permisos y control positivo) | sí | PASS |

## Roturas

| Criterio | Rotura (en el worktree, sobre `0012`) | Prueba que la detectaría | ¿Probada en el worktree? |
|---|---|---|---|
| CA-19 / C-16 (aislamiento) | `get_credential` sin `and c.company_id = p_company_id` en la verificación de la conexión | `08`, T-16 "get_credential con conexión de B → PX001": con la rotura, el primer chequeo pasa y la consulta final devuelve cero filas; `throws_ok` falla | **No:** necesita la base. `run-pgtap.mjs` en el worktree termina con "Falta SUPABASE_TEST_DB_URL" |
| CA-21 / C-15 (privilegios) | Sin `revoke all` sobre `count_credentials_by_key_version()` | `09`, T-12 (EXECUTE de anon/authenticated/service_role). La sesión registra la misma mutación (M6): `not ok 33` y `not ok 34` | **No:** necesita la base |
| CA-02b / CA-03 (consumo vinculado y único) | `consume_oauth_attempt` sin el predicado `browser_binding_hash` | `09b`, T-19 "otro hash de vinculación → PX002": el consumo pasaría. La sesión registra la misma mutación (M1) | **No:** necesita la base. La suite de la Data API, en el worktree, se omite (1 pasada, 6 omitidas; confirma el riesgo de CB-06) |

Después de las pruebas se restauró con `git checkout -- supabase/migrations/0012_integrations.sql` (árbol del worktree limpio) y se eliminó con `git worktree remove` (sin `--force`). `git worktree list` muestra solo el directorio del usuario.

## Comandos reejecutados

Todos en `C:/Users/Simon/dev/PRAXA`, sin modificar el árbol:

| Comando | Resultado | Comparación con la sesión |
|---|---|---|
| `npm run db:check:test` | "Destino verificado."; `SUPABASE_TEST_URL` y `SUPABASE_TEST_DB_URL` apuntan al mismo proyecto desechable (`<ref de pruebas>`), con la confirmación presente | Igual |
| `npm run test:policies` | 11 archivos, 362 aserciones, 0 problemas: `08` 26/26, `09` 49/49, `09b` 121/121, `10` 21/21; `01`–`07` en verde | Igual |
| `npx vitest run --project app --reporter=verbose` (Git Bash) | 5 archivos fallan al cargar: `TypeError: Cannot read properties of undefined (reading 'config')` en `describe.skipIf` | Diferencia de entorno (H-E1-20; R-01) |
| `powershell -NoProfile -Command "npx vitest run --project app --reporter=verbose"` | 5 archivos pasan: 29 pasadas y 7 omitidas (36). Data API 6/6. Omitidas: 4 avisos "NO EJECUTADA" de suites que sí corrieron y 3 casos opt-in de `email-flows`. `afterAll` sin error | Igual |
| `npm run verify` (Git Bash) | Lint y typegen pasan; `npm run test` falla al cargar los 8 archivos (misma causa); exit 1 | Diferencia de entorno (H-E1-20; R-01) |
| `powershell -NoProfile -Command "npm run verify"` | exit 0: lint, typegen, typecheck, 8 archivos y 145 pruebas, "Compiled successfully" y 11 páginas estáticas | Igual |
| Controles estáticos: T-01, T-38 (y el patrón ampliado), T-41, `password`, `revoke`/`grant`, `lock_company` | Sin hallazgos (ver checklist) | Igual |

`db:push:test` no se ejecutó: está reservado al usuario. La sesión registra su salida ("Applying migration 0012_integrations.sql… Finished supabase db push."), y `09` en verde confirma los objetos persistentes.

## Hallazgos

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-01 | baja | `docs/HALLAZGOS.md` (fila `H-E1-20`); sesión, línea 228 | La sesión dice que `H-E1-20` "no se reprodujo". En esta revisión sí se reprodujo: desde Git Bash, `test:app` y `verify` no cargan ninguna suite; desde PowerShell pasan. Es una diferencia de entorno y no afecta al código | Salidas de la reejecución (tabla anterior) | Registrar en `H-E1-20` que se reprodujo en esta revisión (2026-09-27), con la repetición por PowerShell como mitigación. No bloquea |
| R-02 | baja | `supabase/migrations/0012_integrations.sql:22` y `:102`; `supabase/tests/09_integration_privileges.test.sql:68-78` | El encabezado declara `service_role` "—" sobre el esquema `worker_api`, pero el `revoke` del esquema no incluye `service_role` (así lo fija la spec §3) y ninguna prueba afirma que `service_role` no tenga `USAGE` sobre `worker_api`. El riesgo real es nulo, porque T-12 prueba que `service_role` no tiene `EXECUTE` sobre ninguna función. Pero esa celda del encabezado queda sin verificar | Lectura de `0012` y de T-04 | Agregar a `09` (T-04) `ok(not has_schema_privilege('service_role', 'worker_api', 'USAGE'))`, o dejar registrada la diferencia. No editar `0012`, que ya está aplicada |
| R-03 | baja | `supabase/migrations/0012_integrations.sql:482-483`, `:480-481` (repetido en las nueve funciones de escritura) | Las ramas de traducción `integration_connections_pkey`/`integration_credentials_pkey` → `PX001` y `integration_connections_one_live_per_company` → `PX003` no las ejercita ninguna prueba: los chequeos explícitos bajo el cerrojo de empresa (`:593-604`) se adelantan, así que solo se alcanzan en una carrera. La rama `else` (→ `22023`) sí está cubierta por T-46, y `account_key` → `PX007` por T-27 | Lectura de `09b` (T-46, T-47 y T-27) | Opcional. La spec no exige un caso de carrera (queda fuera de alcance por diseño) |
| R-04 | baja | Sesión, líneas 236-237 | La evidencia de T-43 lista dos commits de `main..HEAD`. El commit revisado tiene cuatro: `9398dcf` y `9178991` son posteriores a la redacción, y `9178991` revierte los cambios de `.claude/skills` observados. La nota es coherente con su momento, pero no refleja el manifiesto final | `git log --oneline 45fc760..HEAD`; `git diff 45fc760 HEAD -- .claude` sin salida | Al registrar el gate, anotar que `9178991` revirtió `bd2e24a` y que el diff neto no toca `.claude/` |

No hay hallazgos de severidad alta ni media.

## Pendientes del usuario

1. **Confirmar al aprobar `G-DB-META`** la decisión sobre las 3 pruebas opt-in de `tests/app/email-flows.test.ts`, omitidas en `test:app` (sesión, línea 226; `H-E1-23`). La spec aprobada pedía "ninguna omitida" (Verificación, paso 4). La decisión consta en la sesión, redactada por la implementación. Conviene que la aprobación visible del gate la mencione de forma expresa.
2. Ejecutar `/qa-review M06.1a-M06.2a`, que puede reproducir con la base las roturas que aquí quedaron no probadas.
3. Aprobar o no `G-DB-META` después de `qa-review`.

## Confirmaciones finales

- `git rev-parse HEAD` → `917899199e2a192197e68b66f7cd5ee9ab99a37c` (sin cambios).
- Comando de árbol limpio del paso 1: sin salida (este informe está excluido por la ruta `revisiones/`).
- `git worktree list` → solo `C:/Users/Simon/dev/PRAXA  9178991 [mf/M06.1a-M06.2a]`; el worktree temporal fue eliminado.
