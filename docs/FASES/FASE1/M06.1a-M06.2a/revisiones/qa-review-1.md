# QA y verificación final 1 — M06.1a-M06.2a

- **Fecha:** 2026-09-27.
- **Commit revisado:** `9ce95e373d7adc24e60b39bcdb3ab055de96c52f` (rama `mf/M06.1a-M06.2a`).
- **Base (`git merge-base main HEAD`):** `45fc760335a9eabcac4c5ea67eca04c02d9ab90c`, igual a la citada por `implementation-review-3.md`.
- **Precondiciones (sección 1 de la skill):** rama `mf/`, `implementation-review-3.md` APROBABLE, commit y base coincidentes, árbol limpio salvo `revisiones/` — todo verificado antes de empezar.

## Veredicto

**LISTO PARA PR.**

Se cumplen todos los criterios para abrir el PR: las cinco verificaciones que exige III.3 para este grupo (`db:check:test`, `db:push:test` ya ejecutado por el usuario, `test:policies`, `test:app`, `verify`) están en verde, reproducidas de forma independiente en esta sesión con resultados idénticos a los de la evidencia. Las dos mutaciones que `implementation-review-3.md` dejó sin poder ejecutar contra la base real (por falta de credenciales en su worktree) se repitieron acá contra el proyecto de pruebas persistente y confirman que las pruebas existentes detectarían esas roturas. No encontré hallazgos nuevos de severidad alta ni media.

## Fuentes leídas

`AGENTS.md`; `docs/FASES/FASE1/meta_first/plan.md` (Parte I, ficha del grupo; II.4, II.5; III.3; III.9); `docs/FASES/FASE1/M06.1a-M06.2a/spec.md` completa (con sus dos enmiendas, Diseño §§1–12, catálogo de errores, criterios heredados y operativos, casos de prueba); `docs/FASES/FASE1/M06.1a-M06.2a/plan.md`; `docs/FASES/FASE1/meta_first/sesiones/M06.1a-M06.2a.md` completa; `implementation-review-3.md`; `docs/HALLAZGOS.md` (`H-E1-23` a `H-E1-27`); `docs/PROJECT_STATE.md`; `.github/workflows/verify.yml`; `vitest.config.mts`; `package.json`; los archivos `supabase/tests/08_integration_isolation.test.sql`, `09_integration_privileges.test.sql` (fragmentos), `0012_integrations.sql` (fragmentos de `get_credential`, `create_pending_connection`, `count_credentials_by_key_version`) y `scripts/lib/sql-target.mjs`, `scripts/lib/env.mjs`, `scripts/run-pgtap.mjs`.

## 1. Matriz de criterios

La spec (`Casos de prueba`, T-01 a T-48) y la matriz de decisiones nuevas de `implementation-review-3.md` ya construyen, criterio por criterio, la correspondencia positivo/negativo/borde exigida por esta skill; no la reproduzco entera acá (108 filas entre CA-01–CA-68, C-01–C-38 y T-01–T-48) para no duplicar sin agregar información. En su lugar, agrupo por área de comportamiento, marco qué prueba cubre cada caso y qué verifiqué de forma independiente (lectura de la aserción real, no solo del nombre, más las dos mutaciones ejecutadas contra la base — sección 2).

| Área / criterio | Caso positivo | Caso negativo | Caso de borde | Cubierto por | Resultado |
|---|---|---|---|---|---|
| Aislamiento entre empresas (CA-19, CA-29, C-16, C-24, C-29) | A lee/opera sobre su propia conexión | Conexión de B da `PX001` (todas las funciones) o `false` (`purge_connection`) | `purge_connection` con id inexistente y con id de otra empresa dan el mismo `false`, indistinguible (T-42, T-48) | `08_integration_isolation.test.sql` T-16, T-42, T-48; **mutación Q1** (sección 2) | PASS. La mutación confirma que si se rompe el filtro de empresa en el chequeo de existencia, la prueba real (`throws_ok`) dejaría de detectar el error tipado |
| Privilegios de esquema/tablas/funciones (CA-14 a CA-17, CA-20 a CA-22, C-04 a C-10, C-13, C-15) | `praxa_integrations` ejecuta las doce funciones; `authenticated` lee `integration_connections` | `anon`/`authenticated`/`service_role` sin `USAGE`/`EXECUTE`; ninguna tabla con `service_role` | ACL no nula (T-12 exige `proacl is not null` antes de comprobar titulares), dueño con `bypassrls` bajo `force` (C-32) | `09_integration_privileges.test.sql` T-04 a T-15 (52/52) | PASS |
| Idempotencia de reintentos (`D-M06.1a-M06.2a-11` a `-21`, C-16, C-19 a C-22, C-27) | Reintento exacto devuelve la fila sin duplicar (`create_pending_connection`, `confirm_connection`, `mark_needs_reauth`, `replace_credential`, `rewrap_credential`, `create_oauth_attempt`) | Material o parámetros distintos siguen dando el error original (`PX003`/`PX004`/`PX006`/`PX008`/`22023`) | Pendiente vencida no cuenta como reintento (T-20); otro `browser_binding_hash` con el mismo `state_hash` no es reintento y sigue en `22023` (T-46) | `09b_integration_lifecycle.test.sql` T-18, T-20 a T-23, T-28, T-29 (146/146) | PASS |
| Transiciones de estado (CA-07, C-22, C-28) | Transiciones declaradas (activar, marcar `needs_reauth`, desconectar) | Cada transición no declarada da `PX004` | Reintento de una transición ya aplicada no es "otra" transición (D-12, D-13, D-21) | `09b` (mismo archivo) | PASS |
| Purga de intentos OAuth (CA-38b, C-37) | Intento vencido sin consumir se borra; consumido hace más de 10 min se borra | Intento vigente o de otra empresa no se toca | Borde exacto de 10 minutos consumido: se conserva (`<`, no `<=`) (T-39) | `09b` T-39 | PASS |
| Cifrado en reposo — forma de columnas (CA-10 a CA-13, C-38) | Fila válida con IV/etiqueta/versión correctos | IV de 10/11 bytes, etiqueta incorrecta, `ciphertext` no-base64 dan `23514` | `granted_scopes` sin `ads_read`, repetido o con nulo dan `23514` (T-17) | `09b` T-17 | PASS |
| Cierre administrativo (CA-67, CA-68, `H-E1-06`, `H-E1-07`) | Borrar la empresa deja cero filas en las 9 tablas del producto incluidas las de integración | Borrar el contexto con reportes antes que la empresa falla con `23503`; borrar el usuario antes que la empresa falla con `23503` | `H-E1-07` (hipótesis del `RESTRICT` de `reports`) se prueba antes de que exista `0012` (parte 1 sola) — descartada | `10_demo_closure.test.sql` (21/21) | PASS |
| Data API (sección 5b, CA-21, C-34) | A lee su propia conexión sin error | Filtrar por B da `[]`; `oauth_attempts`, `worker_api` por esquema, RPC homónima en `public` y `private.integration_credentials` dan error sin datos | No aplica borde adicional: la spec fija exactamente 6 aserciones, todas cubiertas | `tests/app/integrations-data-api.test.ts` (6/6) | PASS |
| Mensajes de error sin fugas (CA-09, C-35, CB-02) | Catálogo `PX001`–`PX008`/`22023` con mensaje fijo | Ningún `23xxx` sale crudo | `DETAIL`/`HINT` vacíos incluso cuando Postgres los llenaría por defecto (T-45 a T-47, con `pg_temp.error_of`) | `09b` T-45 a T-47 | PASS |
| Verificación completa (CB-01, CB-04, CB-06, C-36) | `db:check:test`, `db:push:test`, `test:policies`, `test:app`, `verify` en verde | Ninguna prueba exigida omitida | Las 3 pruebas de `email-flows.test.ts` (opt-in, `H-E1-23`) y los 4 avisos "NO EJECUTADA" no cuentan como omisión real | Ejecución independiente, sección 3 | PASS |

No encontré ningún caso previsto por la spec (positivo, negativo o de borde) sin una aserción real que lo verifique. El único punto sin una aserción pgTAP directa —el camino `SUPERUSER` de la creación idempotente del rol— ya está documentado como no bloqueante en `implementation-review-3.md` (R-06): no es alcanzable por ningún flujo de la aplicación, solo por manipulación manual del rol en la base, y `postgres` no tiene permiso para revertir ese atributo de todas formas.

## 2. Pruebas exploratorias (casos no cubiertos por una corrida automática)

`implementation-review-3.md` había diseñado y razonado tres mutaciones de control, pero no pudo ejecutarlas contra la base real: su worktree (`../praxa-review-M06.1a-M06.2a`) no tiene `.env.local` ni `SUPABASE_TEST_DB_URL` por regla de seguridad, así que `run-pgtap.mjs` se negó a correr. Repetí dos de esas tres (aislamiento y privilegios) directamente contra el proyecto de pruebas persistente, con la interfaz pública (llamadas a `worker_api.*`, `has_function_privilege`, y una redefinición transaccional de la función bajo prueba), cada una dentro de su propia transacción con `ROLLBACK` incondicional. No usé `test:policies` para esto porque agregar un archivo a `supabase/tests/` habría ensuciado el árbol; en su lugar usé un script Node temporal en `__qa__/`, con `resolveSqlTestTarget` (nunca `SUPABASE_DB_URL`), igual que el ensayo de la propia sesión de implementación.

Antes de correr: `npm run db:check:test` → "Destino verificado." (proyecto `yknuvgvnloppxkykhyrc`, desechable, confirmación presente). Después de correr: confirmé con una consulta aparte que no quedó ningún residuo (`select count(*) from auth.users where email like 'qa-q1-%@praxa.test'` → `0`; `has_function_privilege('authenticated', 'worker_api.count_credentials_by_key_version()', 'EXECUTE')` → `false`), y que el comando de árbol limpio del paso 1 sigue sin salida tras borrar `__qa__/`.

### Q1 — Aislamiento cruzado en `get_credential` (CA-19, C-16, T-16)

Hipótesis: si el chequeo de existencia de `get_credential` (`perform 1 from … where c.id = p_connection_id and c.company_id = p_company_id`) perdiera el filtro de empresa, la función dejaría de lanzar `PX001` ante una conexión ajena, aunque el `return query` final siga filtrando y no exponga datos. `throws_ok` de T-16 fallaría con esa mutación.

```js
// __qa__/explore-mutations.mjs (borrado al terminar)
await withRollback('Q1: get_credential — aislamiento cruzado (CA-19, C-16, T-16)', async () => {
  // ... siembra de company A (actor propio) y company B con una conexión + credencial ...

  // Paso 1: función real, dentro de un savepoint para poder seguir en la misma
  // transacción tras el error esperado.
  let baselineCode = null;
  await client.query('savepoint q1_baseline');
  try {
    await client.query(`select * from worker_api.get_credential($1, $2, $3)`,
      [actorA, companyA, connB]);
  } catch (error) {
    baselineCode = error.code;
    await client.query('rollback to savepoint q1_baseline');
  }

  // Paso 2: mutación — create or replace function sin "and c.company_id = p_company_id"
  // en el "perform 1" de existencia (se conserva el resto igual a 0012).
  await client.query(`create or replace function worker_api.get_credential(...) ... $body$
    begin
      perform private.assert_worker_actor(p_actor_user_id, p_company_id);
      if p_connection_id is null then raise exception 'praxa: argumento inválido' using errcode = '22023'; end if;
      perform 1 from public.integration_connections c where c.id = p_connection_id;  -- MUTADO
      if not found then raise exception 'praxa: operación no autorizada' using errcode = 'PX001'; end if;
      return query select ... where c.id = p_connection_id and c.company_id = p_company_id;
    end; $body$;`);

  let mutatedCode = null, mutatedRows = null;
  await client.query('savepoint q1_mutated');
  try {
    const result = await client.query(`select * from worker_api.get_credential($1, $2, $3)`,
      [actorA, companyA, connB]);
    mutatedRows = result.rowCount;
  } catch (error) { mutatedCode = error.code; }
  // ...
});
```

**Resultado real (salida del script):**

```text
=== Q1: get_credential — aislamiento cruzado (CA-19, C-16, T-16) ===
  Antes de mutar: sqlstate = PX001 (esperado PX001)
  Con la mutación: sqlstate = (sin error), filas = 0
  Veredicto: CONFIRMADO — la mutación suprime el PX001 (throws_ok de T-16 la detectaría:
  pasa de "throws" a "0 filas sin error")
```

Con la función real de `0012` (tal como está aplicada), la llamada de A sobre la conexión de B da `PX001`, como exige T-16. Con la mutación, la misma llamada no lanza ningún error y devuelve cero filas en silencio: el error tipado desaparece, aunque no se filtra ningún dato de B (el `return query` final sigue filtrando por `company_id`). Esto confirma, contra la base real, que T-16 (`throws_ok(..., 'PX001', ...)`) detectaría esta regresión: pasaría de "not ok" (no lanzó la excepción esperada) a fallar el archivo. Coincide exactamente con el razonamiento de `implementation-review-3.md`, que no había podido ejecutarlo.

### Q2 — Privilegio de más sobre `count_credentials_by_key_version` (CA-21, C-15, T-12)

Hipótesis: un `grant execute … to authenticated` de más sobre la función global (sin actor ni empresa) haría que la consulta de ACL de T-12 (`is_empty` sobre `anon`/`authenticated`/`service_role` con `EXECUTE` en las doce funciones) deje de estar vacía.

```js
await withRollback('Q2: privilegio de más — count_credentials_by_key_version (CA-21, T-12)', async () => {
  const before = await client.query(
    `select has_function_privilege('authenticated',
       'worker_api.count_credentials_by_key_version()', 'EXECUTE') as has_priv`);

  await client.query(
    `grant execute on function worker_api.count_credentials_by_key_version() to authenticated`);

  const after = await client.query(/* misma consulta */);

  // Reproduce la consulta de T-12 en 09_integration_privileges.test.sql:
  const acl = await client.query(`
    select p.proname, r.rolname
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    join pg_catalog.pg_roles r on has_function_privilege(r.oid, p.oid, 'EXECUTE')
    where n.nspname = 'worker_api' and r.rolname in ('anon', 'authenticated', 'service_role')`);
  // ...
});
```

**Resultado real (salida del script):**

```text
=== Q2: privilegio de más — count_credentials_by_key_version (CA-21, T-12) ===
  Antes de mutar: authenticated tiene EXECUTE = false (esperado false)
  Con la mutación: authenticated tiene EXECUTE = true (esperado true)
  Filas devueltas por la consulta de T-12 (esperado 0, mutado): 1
    [{"proname":"count_credentials_by_key_version","rolname":"authenticated"}]
  Veredicto: CONFIRMADO — T-12 (is_empty) fallaría con esta mutación
```

Confirmado contra la base real: la consulta que usa T-12 deja de estar vacía apenas se agrega el grant de más, así que `is_empty(...)` fallaría con esta mutación exactamente como predice `implementation-review-3.md` (mutación M6 de la sesión de implementación, ahí solo verificada en el ensayo con rollback, acá contra el proyecto persistente).

**Cantidad ejecutada:** 2 casos exploratorios (Q1, Q2), cada uno con su corrida "antes" y "después" de mutar (4 verificaciones en total), sobre el proyecto de pruebas `yknuvgvnloppxkykhyrc`. Ningún caso falló de forma inesperada.

**Limpieza:** `rm __qa__/explore-mutations.mjs && rmdir __qa__`. Verificado después: `git status --porcelain --untracked-files=all -- . ':(exclude)docs/FASES/FASE1/*/revisiones/*' ':(exclude)docs/FASES/FASE1/meta_first/sesiones/*-review-*'` sin salida, y `git rev-parse HEAD` sigue en `9ce95e3`.

No repetí la tercera mutación de `implementation-review-3.md` (reintento de `create_pending_connection`, D-11/D-19) porque exigiría reconstruir dentro del script el cuerpo completo de la función *anterior* a la corrección (sin el bloque de reintento), y esa rama de comportamiento ya está cubierta por 5 aserciones distintas de T-20 más el rojo TDD documentado en la sesión (con y sin `RED_SHIM`) contra objetos reales tras el push. Las dos mutaciones ejecutadas acá (aislamiento y privilegios) son las que representan el mayor riesgo si fallaran silenciosamente (fuga entre empresas y escalación de privilegios), y ambas quedan confirmadas contra la base real.

## 3. Guion manual (UI o recorridos que necesitan al usuario)

No aplica: la spec de esta microfase es explícitamente de base de datos, sin UI (`III.8`: "M04a a M06.3a: nada visible, es cimiento"). No hay pantallas, rutas ni flujos de usuario que revisar a mano en este corte.

## 4. Verificación completa

Todas las corridas de esta sección son de esta sesión de QA, independientes de las citadas en `implementation-review-3.md`, sobre el mismo commit (`9ce95e3`) y sin modificar el árbol.

| Comando | Resultado | Coincide con la evidencia previa |
|---|---|---|
| `npm run db:check:test` | "Destino verificado.", proyecto `yknuvgvnloppxkykhyrc`, desechable | Sí |
| `npm run test:policies` | 11 archivos, **390 aserciones, 0 problemas** (`08` 26/26, `09` 52/52, `09b` 146/146, `10` 21/21; `01`–`07` sin cambios) | Sí, idéntico |
| `npx vitest run --project app --reporter=verbose` (Git Bash) | 5 archivos, **29 pasadas, 7 omitidas** (36); Data API 6/6; 4 avisos "NO EJECUTADA" de suites que sí corrieron y 3 de `email-flows` opt-in (`H-E1-23`) | Sí, idéntico |
| `npm run verify` (Git Bash) | exit 0: lint, typegen, typecheck, `Test Files 8 passed (8)`, `Tests 145 passed (145)`, build "Compiled successfully", 11 páginas | Sí, idéntico |
| Exploración Q1/Q2 (sección 2) | Ambas mutaciones confirmadas contra la base real; sin residuos | Nuevo (no estaba en la evidencia previa) |

No hubo que repetir en PowerShell: Git Bash cargó Vitest sin el problema H-E1-20 en esta sesión (tampoco lo tuvo `implementation-review-3.md`). No corrí `db:push:test` ni ningún comando destructivo: `0012` ya está aplicada al proyecto de pruebas por el usuario, y esta sesión solo leyó y mutó dentro de transacciones con `rollback`.

Ninguna prueba requerida por III.3 para este grupo (`db:check:test`, `test:policies`, `test:app`, `verify`; `db:push:test` ya ejecutado por el usuario) quedó omitida ni sin ejecutar.

## 5. Requisitos por etapa

### Para abrir el PR (cumplidos)

- Los ocho ítems del checklist de `implementation-review-3.md` en PASS, sin hallazgos altos ni medios.
- Las cinco verificaciones de III.3 para `M06.1a-M06.2a` (`db:check:test`, `db:push:test`, `test:policies`, `test:app`, `verify`) ejecutadas y en verde, reproducidas de forma independiente en esta sesión.
- Única migración nueva (`0012_integrations.sql`); ninguna existente modificada.
- Sin secretos, tokens ni datos reales en el diff (`T-38` repetido en `implementation-review-3.md`; no lo repetí yo misma porque no cambió el diff desde esa revisión).
- Las dos mutaciones más riesgosas (aislamiento, privilegios) confirmadas contra la base real en esta sesión.
- `docs/PROJECT_STATE.md` y la sesión son consistentes entre sí y con este resultado: ambos declaran `VERIFICADO — PENDIENTE DE APROBACIÓN`, gate `G-DB-META` sin aprobar, y listan exactamente `/implementation-review`, `/qa-review` y la aprobación del usuario como pendientes. `docs/HALLAZGOS.md` registra `H-E1-23` a `H-E1-27` con severidad, evidencia y microfase asignada, sin ampliar el alcance de este corte.

### Para el merge (pendiente, no verificable por mí)

- Revisión de Codex sobre el PR, sin bloqueantes.
- CI (`verify`) en verde sobre el PR — ya confirmé que `verify` pasa localmente sobre este commit; la CI solo corre `verify` (`.github/workflows/verify.yml`), así que no debería divergir salvo por entorno.

### Para cerrar el gate (pendiente, acción del usuario)

- Aprobación explícita de `G-DB-META` por el usuario, incluyendo de forma expresa la decisión ya registrada sobre las tres pruebas opt-in de `email-flows` (`H-E1-23`) y sobre los hallazgos diferidos `H-E1-24` a `H-E1-27` (ya estaba pedido así en `implementation-review-3.md`, "Pendientes del usuario").
- `db:push` al proyecto `app` es una acción reservada de `M28.2a`, explícitamente fuera de este corte (spec, "Fuera de alcance"; plan, tabla de intervenciones). No corresponde a este gate.

## 6. Hallazgos

Ninguno nuevo de severidad alta o media. No encontré nada que contradiga o amplíe lo ya registrado por `implementation-review-3.md` (R-06, baja, informativo, sin corrección requerida). Las dos mutaciones exploratorias de esta sesión no revelaron ningún caso no cubierto: en ambas, la prueba pgTAP existente (T-16, T-12) sí hubiera detectado la regresión simulada.

| ID | Severidad | Criterio | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| — | — | — | Sin hallazgos nuevos | Sección 2 (mutaciones confirmadas contra la base real); sección 1 (matriz sin huecos) | No aplica |

## 7. Pendientes del usuario

1. Hacer push de la rama `mf/M06.1a-M06.2a` y abrir el PR con el contenido de `pr.md`.
2. Esperar la revisión de Codex y la CI (`verify`) sobre el PR.
3. Aprobar el gate `G-DB-META`, incluyendo de forma expresa la decisión sobre `H-E1-23` (pruebas opt-in de `email-flows`) y el registro de `H-E1-24` a `H-E1-27` como diferidos.
4. Mergear y, en su momento (`M28.2a`), aplicar `0012` al proyecto `app` con su propia verificación — no antes, y no como parte de este gate.
