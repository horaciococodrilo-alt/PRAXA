# Auditoría de spec — M06.1a-M06.2a (4)

- **Fecha:** 2026-09-27
- **Commit auditado:** `b9d067e`
- **Hash de contenido de la spec:** `e57d8a7fefc5c45575343d9c045c9e096b97b063`
- **Spec:** `docs/FASES/FASE1/M06.1a-M06.2a/spec.md`
- **Precondición:** cumplida. La spec existe y figura en `BORRADOR` (`spec.md:3`).

## Veredicto

**APROBABLE.** Los 18 ítems están en PASS. Quedan dos observaciones de severidad baja, que no bloquean la implementación ni exigen que el implementador invente nada. Ninguna requiere decisión del usuario.

Las cuatro observaciones de `spec-audit-3` (A-01 a A-04) quedaron resueltas:

- **A-01.** `replace_credential` usa `on conflict on constraint integration_credentials_pkey` (`spec.md:316`), y la convención general figura en el Diseño §1 (`:109`).
- **A-02.** Fuera de alcance, T-41 y `D-09` citan `vitest.config.mts` (`:54`, `:545`, `:626`). `HALLAZGOS.md:68` también se corrigió en el árbol de trabajo.
- **A-03.** La regla de "Lectura de la conexión existente" enumera las funciones a las que aplica y las que excluye, y fija el orden: pertenencia, nulos, cerrojo, lectura y, recién después, los chequeos propios (`:287`). En `replace_credential`, `PX001` va antes que `PX002` (`:316`).
- **A-04.** El riesgo de diferencia de relojes para `M16.1` figura en Riesgos (`:611`).

## Checklist

| # | Ítem | PASS/FAIL/BLOQUEO | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | Los CA de la ficha de M06.1a (`plan.md:189`: CA-02c, CA-03, CA-07, CA-08, CA-14 a CA-18 y CA-68) y los de M06.2a (`plan.md:204`: CA-19 a CA-22) figuran en Heredados (`spec.md:422-454`), con resúmenes fieles a `meta_first/spec.md` §8 a §10. |
| 2 | Alcance | PASS | Alcance y Fuera de alcance (`spec.md:27-57`) coinciden con las fichas (`plan.md:180-208`) y con II.4 y II.5 (`plan.md:429-497`). Cada C-NN traza a un CA, un DEC, una trampa o una decisión (`spec.md:460-497`). |
| 3 | Coherencia con la spec general | PASS | Ningún elemento contradice la matriz de la §7 (`meta_first/spec.md:157-178`), CA-07, CA-08, CA-14 a CA-22, CA-25, CA-37 a CA-39, CA-67 o CA-68. Las interfaces que consumen `M06.3a` y `M16.x` están definidas con su firma, su retorno y sus códigos. Ver la observación A-01 sobre `p_client_business_id`. |
| 4 | Decisiones | PASS | `D-01` a `D-10` figuran con quién decidió y la fecha (`spec.md:616-627`). No contradicen ningún DEC ni CA. |
| 5 | Trampas | PASS | Las tres trampas de II.4, las tres de II.5 y la hipótesis de PostgreSQL 16 o posterior (`plan.md:470-497`) figuran en `spec.md:585-591` y en H-S-02. |
| 6 | Intervenciones y acciones reservadas | PASS | `db:push:test` queda a cargo del usuario, como en la ficha y en III.2 (`plan.md:193`, `:208` y `:766`), con su verificación posterior (`spec.md:572`). El push, el despliegue y el `db:push` al proyecto `app` quedan reservados al usuario, con verificación (`spec.md:575-577`, T-43). |
| 7 | Verificación | PASS | Incluye `db:check:test`, `db:push:test`, `test:policies`, `test:app` y `verify` (`spec.md:556-565`), como exige III.3 (`plan.md:787-788`). CB-06 figura en el paso 4 y en C-36. |
| 8 | Dependencias | PASS | `PROJECT_STATE.md` registra aprobados `G-K01` (2026-09-25) y `G-K02-K04` (2026-09-26), y `M06.1a` como siguiente. `main@b9d067e` contiene `src/modules/integrations/contract/` y `src/modules/tenant/context.ts`. |
| 9 | Lo entregado de verdad | PASS | Columnas, nulabilidad y `check` coinciden con K02 (`oauth-attempt.ts:26`, `:57-96`), K03 (`primitives.ts:15-20`, `:33-54`, `:84`, `:94-119`; `connection.ts:26-138`) y K04 (`credential.ts:21-60`, `:83-86`). Se revisaron uno por uno el regex base64, el del IV (16 caracteres sin relleno), el de la etiqueta (22 más `==`), `valid_granted_scopes` (incluidos los casos de array vacío y de elemento nulo), la zona IANA y la clase obligatoria en `needs_reauth`. |
| 10 | Pendientes y hallazgos | PASS | `H-E1-05`, `-06`, `-07`, `-11`, `-12`, `-18`, `-19`, `-20`, `-21`, `-22` y `H-M04.1-02` quedan resueltos o diferidos con motivo (`spec.md:649-660`). Los pendientes de `sesiones/M05.1.2-M05.1.4.md:148-151` están cubiertos (C-07, C-14 y `D-10`). |
| 11 | Contexto real | PASS | Se volvieron a verificar las referencias de la tabla de contexto y del diseño: `0001:13-17`, `:26`, `:45`, `:62-88`, `:123-133` y `:226-234`; `0002:43`; `0003:31-33`; `0004`; `0007:44-62`; `0008:27-41`; `0011`; los tests `03:185-220` y `05:96-98` y `:160-183`; `run-pgtap.mjs:27`, `:74-99` y `:150-163`; `sql-target.mjs:28-106`; `db-push.mjs:27-41`; `check-target.mjs`; `package.json:17-26` y `:49`; `vitest.config.mts:47-58`; `setup.ts:12-15`; `helpers.ts`; `target.mjs:182-188`; `config.toml:24` y `:52`; `context.ts:21-26`; `SECURITY.md:68-71`, `:121-133` y `:184-205`; `HALLAZGOS.md:8` y `:35`; y `plan.md:90`, `:191`, `:193`, `:208`, `:370-371`, `:431`, `:450-456`, `:513`, `:581`, `:766` y `:787-788`. Todas existen y dicen lo que afirma la spec. La única FK hacia `company_context_versions` con `restrict` es `reports_context_fkey`, así que el `23503` de la parte 1 de `10` no puede venir de otra restricción. |
| 12 | Archivos previstos | PASS | Cada archivo de `spec.md:404-416` está autorizado por II.4 y II.5, por la ficha de M06.2a o por las precondiciones 8 y 9 (`plan.md:370-371`). |
| 13 | Diseño suficiente | PASS | Nombres, tipos, restricciones con nombre, firmas, retornos, catálogo de errores, traducción de la clase `23`, orden de chequeos y helpers de prueba están definidos. La regla del `on conflict` por nombre de restricción evita la ambigüedad con los parámetros de salida. |
| 14 | Verificable | PASS | Cada C-NN tiene al menos un caso T-NN con un comando real de `package.json` y un resultado concreto. Hay casos negativos y de borde: el borde exacto de 10 minutos en T-39, el IV de 10 y 11 bytes, `purge_connection` cruzada, la ausencia de `DETAIL` y `HINT`, y un choque de `p_connection_id`. T-41 apunta al archivo real. |
| 15 | Sin nada abierto | PASS | "Preguntas abiertas" está vacía (`spec.md:643-645`). H-S-01 a H-S-10 dicen cómo y cuándo se verifican, y tienen una condición de parada o una alternativa. El supuesto externo decisivo (grants por defecto y `42501` en Supabase) cita la documentación oficial. |
| 16 | Ejecutable ahora | PASS | Existen los scripts `test:app`, `test:policies`, `db:check:test`, `db:push:test` y `verify`; `pg` y `@types/pg`; `resolveSqlTestTarget`, que ya importa un test en TS (`tests/unit/sql-test-target.test.ts:3`, con `allowJs`); y los helpers `createConfirmedUser`, `blockedReason`, `remoteProjectReachable`, `cleanupRun` y `pendingCleanupCount`, además de `create_company_for_current_user`. La única intervención del usuario, `db:push:test`, tiene su paso asignado. `npm run verify` terminó con exit 0 en un worktree limpio de `b9d067e`. |
| 17 | Consistencia interna | PASS | Alcance, diseño, criterios, casos y archivos coinciden entre sí. La regla de lectura de la conexión ya no choca con `create_pending_connection` ni con `create_oauth_attempt` `initial`. Ver la observación A-02, de redacción. |
| 18 | Reglas no negociables | PASS | El tenant se verifica por membresía en cada función (salvo la excepción de la ruta). Los datos son sintéticos (T-38). Hay una sola migración nueva (C-01, T-01). Las pruebas corren solo contra el proyecto desechable (`resolveSqlTestTarget`; el ensayo nunca usa `SUPABASE_DB_URL`). Las credenciales solo pasan por `worker_api` (C-09, C-31). Los errores salen redactados y sin `DETAIL` (C-35, T-45 a T-48). |

## Contradicciones

Ninguna.

## Hallazgos

| ID | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | baja | Diseño §8, reglas comunes; Riesgos | Por la regla general, `p_client_business_id` de `create_pending_connection` es obligatorio: "Solo son opcionales `p_expected_connection_id` … y `p_token_expires_at`", y un nulo da `22023`. Pero la columna es nullable (§5.1) y K03 la admite nula en todos los estados (`connection.ts:58`). Es una condición más estricta que el contrato, que va a consumir `M16.1` (`plan.md:575`: `/me?fields=id,client_business_id`), y no figura en Riesgos ni tiene un caso de prueba | `spec.md:156`, `:294`, `:313`; `connection.ts:58`; `plan.md:575` | Declararlo en Riesgos como condición para `M16.1` (si Meta no informa `client_business_id`, la creación de la pendiente da `22023`) y sumar ese caso a T-45. Alternativa equivalente: hacerlo opcional, como en K03 | No |
| A-02 | baja | Archivos previstos (nota final); Secuencia, paso 8 | La nota dice que `docs/HALLAZGOS.md` se modificó antes de implementar solo para registrar `H-E1-22`. Pero el diff actual también corrige, en `H-E1-18`, `vitest.config.ts` por `vitest.config.mts` (aplicación de `spec-audit-3`, A-02). La evidencia de cierre va a mostrar un cambio que la spec no declara | `spec.md:416`; `git diff docs/HALLAZGOS.md` (línea 68) | Agregar a la nota: "y para corregir el nombre de `vitest.config.mts` en `H-E1-18` (auditoría 3, A-02)" | No |

Ninguna de las dos afecta el veredicto. Si se aplican, cambia el hash de contenido y la aprobación tiene que referirse al hash nuevo.

## Observación de tamaño (no afecta el veredicto)

Se mantiene la de las auditorías anteriores. Si al planificar el grupo no cabe en dos cortes de 8 horas, conviene separarlo así, sin adelantar `G-DB-META`:

- `M06.1a`: esquema, rol, tablas, privilegios y funciones, con `09`;
- `M06.2a`: `08`, `09b`, `10` y la prueba de la Data API.

## Verificaciones ejecutadas

| Comando | Resultado |
|---|---|
| `git status --short` / `git rev-parse --short HEAD` | `main@b9d067e`. Cambios existentes: `docs/HALLAZGOS.md` (`H-E1-22` y el nombre de archivo en `H-E1-18`) y la carpeta `docs/FASES/FASE1/M06.1a-M06.2a/`, sin seguimiento |
| `grep -v '^\*\*Estado:\*\*' …/spec.md \| git hash-object --stdin` | `e57d8a7fefc5c45575343d9c045c9e096b97b063` |
| `grep -n vitest.config` sobre la spec y `HALLAZGOS.md`; `ls vitest.config.*` | La spec solo cita `vitest.config.mts`, el único archivo que existe |
| `sed -n` sobre las migraciones, los tests, los scripts, los contratos, `plan.md`, `SECURITY.md` y `HALLAZGOS.md` citados | Coinciden con lo que afirma la spec |
| `grep` de FK en `0002` y `0003` | Solo `reports_context_fkey` referencia `company_context_versions` con `restrict`; `company_objectives` y `company_systems` van en cascada |
| `grep` de aserciones globales en `supabase/tests/*.sql` | Ninguna prueba existente cuenta tablas ni funciones de todo un esquema; `03` cuenta solo funciones con nombre propio |
| `git worktree add --detach ../praxa-review-spec-audit-4 HEAD` | Worktree limpio de `b9d067e` |
| `npm ci` en el worktree | Exit 0 |
| `npm run verify` en el worktree (Git Bash) | **Exit 0**: lint, typegen, typecheck, pruebas y `next build` en verde |
| `git worktree remove --force ../praxa-review-spec-audit-4` | Worktree eliminado |

No se leyó `.env.local`, no se ejecutó nada contra ninguna base remota y no se expuso ningún secreto.

## Siguiente paso

El usuario aprueba la spec y la pasa a `APROBADA`, referida al hash `e57d8a7fefc5c45575343d9c045c9e096b97b063`. Después se sigue con plan mode. Si antes se aplican A-01 o A-02, que son correcciones de redacción y no requieren decisión, la aprobación se refiere al hash nuevo.
