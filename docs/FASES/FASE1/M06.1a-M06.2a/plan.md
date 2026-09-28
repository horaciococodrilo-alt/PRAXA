# M06.1a-M06.2a — Plan de implementación

**Estado:** APROBADO

Estados posibles: `BORRADOR` → `APROBADO`. Solo el usuario aprueba el plan después de una auditoría APROBABLE.

**Spec base:** `docs/FASES/FASE1/M06.1a-M06.2a/spec.md`, APROBADA, con hash de contenido verificado `e57d8a7fefc5c45575343d9c045c9e096b97b063` al aprobar este plan. Entre el 2026-09-27 y el 2026-09-28, ya en implementación, el usuario enmendó la spec en tres rondas (la tercera, por la revisión del PR #12) para alinearla con `AGENTS.md:48` (`D-M06.1a-M06.2a-11` a `-22`), sin nueva auditoría por decisión explícita del usuario; ver la sección "Auditorías" de la spec. El hash de contenido actual de la spec ya no coincide con el citado arriba; este plan no se modifica por eso, porque sus pasos y su cobertura no cambian.

**Auditoría base:** `revisiones/spec-audit-5.md`, APROBABLE. Sus observaciones bajas A-01 y A-02 se incorporan en los pasos 5 y 13, sin modificar la spec.

**Estado inspeccionado:** `main@3eea43a`, árbol limpio; migraciones `0001` a `0011`; `G-DOCS`, `G-K01` y `G-K02-K04` aprobados. La rama de implementación todavía no existe.

**Objetivo:** entregar `0012`, comprobar aislamiento, privilegios, ciclo de vida y cierre administrativo en el proyecto desechable, y presentar evidencia para `G-DB-META`.

**Hash de contenido de este plan.** Se calcula sin la línea de estado:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M06.1a-M06.2a/plan.md | git hash-object --stdin
```

Este documento registra el plan presentado en conversación. Su guardado no inicia la implementación; no se ejecutaron pruebas remotas durante la planificación.

## Archivos

Los nombres abreviados usados en los pasos corresponden exclusivamente a estas rutas.

| Archivo | Nuevo o modificado | Paso | Autorizado por |
|---|---|---|---|
| `supabase/migrations/0012_integrations.sql` | Nuevo | 7–9 | Spec, Archivos previstos; II.4; corrección condicional autorizada por ficha M06.2a |
| `supabase/tests/08_integration_isolation.test.sql` | Nuevo | 4, 9 | Spec; II.5.1 |
| `supabase/tests/09_integration_privileges.test.sql` | Nuevo | 3, 9 | Spec; II.5.2 |
| `supabase/tests/09b_integration_lifecycle.test.sql` | Nuevo | 5, 9 | Spec; II.5.3 y 3b |
| `supabase/tests/10_demo_closure.test.sql` | Nuevo, construido en dos tiempos | 2, 6, 9 | Spec; II.5.4 |
| `tests/app/integrations-data-api.test.ts` | Nuevo | 6, 11 | Spec; II.5.5 |
| `docs/HALLAZGOS.md` | Modificado | 2, 9–13 | Spec; precondición 8 |
| `docs/PROJECT_STATE.md` | Modificado | 13–14 | Spec; precondición 8 |
| `docs/FASES/FASE1/meta_first/sesiones/M06.1a-M06.2a.md` | Nuevo | 1–14 | Spec; precondición 8 |
| `docs/FASES/FASE1/M06.1a-M06.2a/plan.md` | Nuevo; cambios posteriores solo para resolver revisión | Preparación del pipeline | Spec; precondición 9 |
| `docs/FASES/FASE1/M06.1a-M06.2a/revisiones/*.md` | Nuevos, exclusivamente por las revisiones invocadas | Preparación y 13 | Spec; precondición 9 |

La spec aprobada es de solo lectura. No se modifican scripts, configuración, contratos ni pruebas existentes. El script temporal del ensayo vive fuera del repositorio, como autoriza expresamente Diseño §12.5; no agrega archivos ni scripts npm al proyecto.

## Pasos

`C-NN` y `T-NN` abrevian los IDs completos `M06.1a-M06.2a-C-NN` y `M06.1a-M06.2a-T-NN`. Los intervalos incluyen todos sus IDs.

Las firmas, retornos, columnas, restricciones y mensajes se toman literalmente de Diseño §§1–11 de la spec. No se redefine la interfaz aprobada.

| # | Acción | Archivos | Criterios y casos que cubre | Verificación del paso |
|---|---|---|---|---|
| 1 | **Entrada y rama.** Revalidar instrucciones, hash, última auditoría, aprobación del plan y gates. Comprobar Git; preservar cambios ajenos y detenerse si impiden una base limpia. Crear desde `main` con `git switch -c mf/M06.1a-M06.2a main`; si ya existe al retomar, inspeccionarla y usar `git switch mf/M06.1a-M06.2a`. Ejecutar `npm run db:check:test` antes de cualquier prueba remota. | Sesión | C-01, C-36; T-35, T-43; CB-02, CB-03, CB-04, CB-05, CB-06 | `git status --short --branch`, `git rev-parse --short HEAD`, `git branch -vv`; rama correcta, base y gates registrados, siguiente migración libre `0012`. Destino desechable distinto de app; ninguna excepción de destino habilita pruebas contra app. |
| 2 | **Primero, escribir y ejecutar solo la parte 1 de `10`.** Crear usuario, empresa, contexto con objetivo, activarlo y agregar reporte como `postgres` sin claims. Probar que borrar únicamente el contexto falla con `23503`; borrar la empresa debe permitir comprobar cero filas en las seis tablas existentes. Todavía no escribir `0012`, `08`, `09`, `09b` ni la parte 2. Ejecutar `npm run test:policies`. | `10`; sesión; hallazgos | C-33; T-32, regresión T-34; CA-67; D-05; H-S-04 | `01`–`07` pasan. El archivo `10` contiene exclusivamente la parte 1 y un plan TAP completo. Si pasa, descartar H-E1-07; si falla específicamente por `reports_context_fkey` al borrar la empresa, confirmar la hipótesis. Otro fallo se diagnostica y no autoriza modificar la FK. Conservar esta salida antes de ampliar `10`. |
| 3 | **Escribir pruebas de estructura y privilegios.** Crear `09` con T-04–T-15 completos: esquema, atributos del rol, enums, columnas y nulabilidad, RLS forzada, ACL, política, cascadas, doce firmas y ejecución efectiva por rol. Incluir `proacl IS NOT NULL`, ausencia de `PUBLIC` y dueño con `rolbypassrls`. | `09` | C-04–C-10, C-13, C-15, C-30–C-32; T-04–T-15; CA-05, CA-14–CA-17, CA-20–CA-22, CA-68; ficha M06.2a | Revisar cada caso contra la matriz. `grant praxa_integrations to current_user;` solo dentro de la transacción de prueba. Las aserciones del rol C se evalúan como `postgres` mediante `pg_temp.sqlstate_as`; no conceder acceso a `extensions`. Se ejecutan en rojo en el paso 6. |
| 4 | **Escribir aislamiento y autorización cruzada.** Crear `08` con empresas A/B y empresa C para T-48. Configurar claims antes de lecturas autenticadas. Cubrir lectura propia, cero filas ajenas, escrituras prohibidas y llamadas cruzadas. Probar la excepción de purga: ID ajeno e inexistente devuelven `false`, sin alterar conexión, credencial ni intento de B. | `08` | C-16, C-24, C-29; T-16, T-42, T-48; CA-19, CA-21, CA-22; ficha M06.1a | Los casos distinguen `42501` de privilegios y `PX001` de autorización. T-48 usa empresa sin conexión viva para no quedar enmascarado por `PX003`. La conexión se autoriza antes de comprobar intento, estado o generación, especialmente en `replace_credential`. Ejecución en rojo en paso 6. |
| 5 | **Escribir ciclo de vida y errores.** Crear `09b` con todos los negativos, positivos y bordes especificados. Implementar helpers temporales `affected`, `sqlstate_as` y `error_of` solo donde se necesiten. Incluir nulos obligatorios, errores sin `DETAIL`/`HINT`, colisiones propias/ajenas, permisos K04, TTL, consumo único, reautorización, transiciones, desconexión, purga y rotación. Agregar a T-45 `p_client_business_id = null → 22023`, mensaje fijo y sin detalles, según A-01. | `09b`; helpers locales de `08`/`09` cuando correspondan | C-11, C-12, C-14, C-16–C-28, C-35, C-37, C-38; T-17–T-31, T-39, T-45–T-47; CA-01, CA-02, CA-02b, CA-02c, CA-03, CA-04, CA-07, CA-08, CA-09, CA-09b, CA-10–CA-13, CA-11b, CA-11c, CA-18, CA-25, CA-28, CA-29, CA-32, CA-35, CA-37, CA-37b, CA-37c, CA-38, CA-38b, CA-39 | Cada rechazo queda capturado. T-26 usa escenarios secuenciales compatibles con una sola conexión viva. T-39 conserva el consumido hace exactamente diez minutos y verifica rollback de la purga si la llamada falla. T-17 cubre IV de 10/11 bytes, etiqueta incorrecta y scopes inválidos junto con controles válidos. Ejecución en rojo en paso 6. |
| 6 | **Completar las pruebas antes de implementar.** Agregar parte 2 de `10` y actualizar su `plan(N)`. Escribir Data API con las seis aserciones de Diseño §11. Usar helpers existentes; exigir `blockedReason()` nulo, disponibilidad remota y `resolveSqlTestTarget(process.env).ok` antes de fixtures. Sembrar conexiones por `worker_api` mediante `pg.Client`, confirmar transacción y cerrar en `afterAll`; limpiar con `cleanupRun()` y comprobar `pendingCleanupCount() = 0`. Ejecutar `npm run test:policies` y `npm run test:app`. | `10`; prueba Data API; sesión | C-13, C-33, C-34, C-36; T-32, T-33, T-34; CA-13, CA-19, CA-21, CA-67, CA-68; sección 5b; CB-04–CB-06 | Rojo atribuible a objetos todavía inexistentes en `08`, `09`, `09b`, `10` y la prueba nueva de app; regresiones existentes en verde. Ningún skip cuenta como rojo TDD válido. Parte 2 prueba usuario primero → `23503`, empresa primero → nueve tablas vacías, usuario después → cero filas. Las seis aserciones Data API usan cliente autenticado. |
| 7 | **Implementar estructura de `0012`.** Seguir orden de Diseño §1: encabezado, esquema, rol, enums, helpers, tablas, índices, RLS y privilegios. Encabezado con matriz completa, columna `service_role`, objetos futuros identificados y catálogo de errores. Crear rol sin contraseña, helpers `assert_worker_actor` y `valid_granted_scopes`, tablas compatibles con K02–K04 y trigger de `updated_at` reutilizando `private.touch_updated_at()`. | `0012` | C-01–C-15, C-38; T-01–T-12, T-17, T-40; CA-01, CA-02, CA-02c, CA-05, CA-07–CA-18, CA-20, CA-68 | Revisión estática contra tablas y restricciones exactas de la spec. Solo `authenticated` recibe `SELECT` sobre conexiones; revocación explícita a `service_role` en tablas y funciones nuevas. `current_sync_run_id` queda sin FK. Validación ejecutable en paso 9 con pruebas ya escritas. |
| 8 | **Implementar las doce funciones de `worker_api`.** Respetar firmas y retornos de Diseño §8. Membresía por `company_members`, chequeos explícitos de nulos, cerrojo de empresa y lectura de conexión por ID y empresa antes de comprobaciones propias. Excepciones exactas: conteo global sin actor; consumo con un único `UPDATE … RETURNING`, sin cerrojo; purga ajena/inexistente → `false`. Aplicar catálogo y traducción de toda clase `23`. | `0012` | C-15–C-28, C-35, C-37; T-12, T-13, T-16, T-18–T-31, T-39, T-42, T-45–T-48; CA-02b, CA-03, CA-07–CA-09b, CA-18, CA-21, CA-25, CA-28, CA-37, CA-37c, CA-38, CA-38b; ficha M06.1a | Revisión T-19: todos los predicados en una sentencia de consumo; demás escrituras toman el cerrojo antes de filas. Columnas calificadas con alias y `ON CONFLICT ON CONSTRAINT integration_credentials_pkey`. Sin `private.is_company_member()` dentro de `worker_api`. Mensajes fijos, ningún `23xxx` expuesto crudo. Ejecución en paso 9. |
| 9 | **Resolver D-05 y ensayar con rollback antes del primer push.** Si paso 2 pasó, no tocar `reports`. Si confirmó H-E1-07, añadir al final de `0012` la variante `NO ACTION` no diferida de Diseño §9. Ejecutar siempre el ensayo temporal descrito abajo. Solo si T-32 demuestra que esa variante no alcanza, cambiarla antes de aplicar a `DEFERRABLE INITIALLY DEFERRED` y ajustar la aserción de protección. | `0012`; `10`; sesión; hallazgos; scratch externo | C-01, C-33, C-36; T-04–T-32, T-39, T-42, T-45–T-48; CA-67, CA-68; D-05; H-S-01–H-S-04, H-S-10 | Todos los archivos pgTAP pasan bajo la candidata, incluido `01`–`07`, con TAP completo. Registrar variante y resultado de ambas partes de `10`. Tras cada ensayo, rollback efectivo y ausencia de objetos persistentes de `0012`. Si ambas variantes fallan, o falla un supuesto de privilegios, detenerse. |
| 10 | **Aplicación al proyecto de pruebas, por el usuario.** Preparar candidata final, resultados del ensayo, revisión estática y salida nueva de `npm run db:check:test`. Detenerse para que el usuario ejecute `npm run db:push:test` y entregue salida redactada. Después ejecutar `npm run test:policies`. | Sesión; hallazgos si falla | C-36; T-35, T-36; CB-03–CB-05; D-08 | El push aplica `0012` sin error y `09` confirma esquema, rol y privilegios persistentes. Si falla, registrar diagnóstico y comprobar ausencia de `worker_api` mediante la suite antes de proponer otro intento; no dar por probada la atomicidad solo por la salida de la CLI. Objetos parciales o defecto posterior activan parada. |
| 11 | **Verificación final completa.** Tras la aplicación, ejecutar en orden `test:policies`, `test:app` y `verify`, sin filtros. Validar limpieza y contabilizar suites/aserciones realmente ejecutadas. | Sesión; pruebas nuevas solo si requieren corrección dentro de alcance | C-36; T-04–T-34, T-37, T-39, T-42, T-45–T-48; CB-01, CB-04, CB-05, CB-06 | Todo verde, incluidos `01`–`07` y todas las suites app. Aplicar únicamente la repetición prescrita para H-E1-18/H-E1-20. Un skip, worker sin arrancar, fallo de limpieza o prueba de seguridad fallida impide el cierre. No editar `0012` ya aplicada. |
| 12 | **Revisión final de archivos, seguridad y Git.** Ejecutar los controles estáticos detallados abajo, incluyendo archivos sin seguimiento. Revisar encabezado, revokes, ausencia de secretos, referencias corregidas y exclusiones. | Lectura del diff; sesión | C-01–C-03, C-05, C-15, C-18, C-35; T-01–T-03, T-19, T-38, T-40, T-41, T-43, T-44; CB-02, CB-03, CB-05 | Única migración nueva `0012`; ninguna existente modificada; ningún archivo fuera de la tabla. Sin coincidencias sensibles. Rama correcta, sin push ni despliegue del asistente. |
| 13 | **Evidencia y revisión.** Registrar comandos, resultados, rojos TDD, ensayo, push del usuario, conteos, limitaciones e hipótesis resueltas. Actualizar hallazgos y preparar estado “pendiente de aprobación”, sin aprobar gate. El usuario commitea antes de las revisiones; verificar commit y árbol antes de iniciarlas. | Sesión; hallazgos; estado; informes del pipeline | C-33, C-36; T-32, T-34–T-44; CB-05, CB-06 | Evidencia reproducible vinculada al commit revisado. H-E1-07 resuelto o descartado; H-E1-05, H-E1-06, H-E1-11 y H-E1-19 actualizados en el alcance demostrado. H-E1-18 diferido por D-09; H-E1-22 permanece asignado a M16.x. Registrar también la corrección previa a `vitest.config.mts`, observación A-02. |
| 14 | **Gate y reserva de publicación.** Presentar resultado completo al usuario. Solo después de su aprobación explícita registrar `G-DB-META` con fecha. Dejar push, despliegue y aplicación a app como acciones futuras reservadas; no ejecutarlas ni iniciar M06.3a. | Estado; sesión | C-36; T-43; CB-01–CB-06; condición para avanzar de ambas fichas | Gate aprobado únicamente con evidencia completa y aprobación visible. Verificar nuevamente Git; documentar que este corte no publica ni aplica al proyecto app. |

**Reglas comunes de las pruebas:** fixtures sintéticos de Diseño §10; transacción por archivo, `plan(N)`, `finish()` y `rollback`; errores esperados capturados con `throws_ok` o los helpers previstos; claims explícitos para `authenticated`. Los helpers de diagnóstico no imprimen parámetros ni material cifrado.

**Excepciones justificadas a rojo TDD:** T-14 es una regresión que puede pasar sin `0012`; `01`–`07` también. La parte 1 de T-32 es una comprobación de hipótesis y puede pasar. Las revisiones documentales, de Git, destino y aplicación no son código de producto con un rojo previo. Todos los comportamientos nuevos se prueban antes de escribir `0012`.

## Verificación final

### Suites obligatorias

Se conserva esta secuencia, aunque haya corridas previas de TDD o ensayo:

```text
npm run db:check:test
npm run db:push:test
npm run test:policies
npm run test:app
npm run verify
```

El segundo comando lo ejecuta exclusivamente el usuario. Todos existen en `package.json`.

`verify` incluye lint, typegen, typecheck, pruebas unit/component y build. No reemplaza pgTAP ni Data API. Registrar exit code, archivos y pruebas ejecutadas; no usar los conteos de auditorías anteriores como resultado de esta implementación.

**CB-06:** cualquier prueba requerida omitida cuenta como no ejecutada. Una suite con exit 0 pero casos requeridos omitidos no aprueba el gate. Distinguir los avisos alternativos de “NO EJECUTADA” de las pruebas reales de comportamiento.

Si aparece el problema de carga de Vitest desde Git Bash:

```powershell
powershell -NoProfile -Command "npm run verify"
```

Si falla el arranque del pool de workers, repetir una vez y registrar ambas corridas. Si persiste, detenerse; no modificar `vitest.config.mts` ni sustituir la suite completa por una corrida parcial.

### Controles estáticos

T-01, incluyendo nuevos sin seguimiento:

```bash
git diff --name-status main -- supabase/migrations
git ls-files -co --exclude-standard -- supabase/migrations
git ls-tree -r --name-only main -- supabase/migrations
```

Comparar los inventarios: la única ruta nueva debe ser `0012_integrations.sql`; ningún cambio, eliminación o renombrado de las once existentes.

T-02, T-03 y T-40: lectura completa del encabezado y revisión por objeto, apoyada por:

```bash
grep -n -i -E '^\s*(grant|revoke)|password' supabase/migrations/0012_integrations.sql
grep -n -E 'revoke all' supabase/migrations/0012_integrations.sql
```

La primera búsqueda debe mostrar grants/revokes, ninguna aparición de `password`; comprobar manualmente que cada grant tiene su revocación anterior correspondiente.

T-38: obtener la unión sin duplicados de:

```bash
git diff --name-only main
git ls-files -o --exclude-standard
```

Leer directamente cada archivo de esa lista y buscar el patrón exacto de T-38:

```text
act_[0-9]{6,}|eyJ[A-Za-z0-9_-]{10,}|EAA[A-Za-z0-9]{20,}|postgres(ql)?://
```

Aplicarlo con `grep -n -E -i`, pasando las rutas como argumentos correctamente entrecomillados. No inspeccionar `.env.local` ni copiar coincidencias sensibles a la evidencia.

T-41:

```bash
git diff --name-only main -- scripts/lib/target.mjs tests/app/helpers.ts docs/SECURITY.md vitest.config.mts
```

Debe quedar sin salida.

T-44:

```bash
grep -n -E 'HALLAZGOS\.md:68|plan\.md:578|plan\.md:192|sección 10\.1|de 10\.1|credential\.ts:(37|45|46|47|48-56|45-56)' docs/FASES/FASE1/M06.1a-M06.2a/spec.md | grep -v 'T-44'
```

Debe quedar sin coincidencias; no modificar la spec para obtenerlo.

T-43:

```bash
git status -sb
git branch -vv
git log --oneline main..HEAD
```

Estos comandos funcionan sin upstream. Complementar con el registro de acciones: el estado local por sí solo no demuestra la ausencia de despliegues externos.

### Autorrevisión contra plan-auditor

Esta es una revisión del plan, no una auditoría independiente ni evidencia de implementación.

| # | Ítem | Resultado | Cobertura |
|---|---|---|---|
| 1 | Spec base | PASS | Estado, auditoría y hash verificados |
| 2 | Cobertura | PASS | C-01–C-38, T-01–T-48 y criterios heredados asignados a pasos |
| 3 | TDD | PASS | Pasos 2–6 antes de 7–9; excepciones justificadas |
| 4 | Archivos | PASS | Lista limitada a spec, seguimiento y pipeline autorizados |
| 5 | Pasos | PASS | Dependencias y verificación individual |
| 6 | Migraciones | PASS | Solo `0012`; reversión nueva fuera de este corte |
| 7 | Comandos | PASS | Scripts existentes, sintaxis Git/SQL y ensayo previsto; III.3 y CB-06 |
| 8 | Acciones reservadas | PASS | Pasos 10, 13 y 14; preparación y verificación posterior |
| 9 | Reglas | PASS | Datos sintéticos, pertenencia, `worker_api`, destino desechable |
| 10 | Trampas | PASS | Cobertura explícita en pasos y tabla de riesgos |
| 11 | Git | PASS | Rama propia, commits del usuario, sin acciones destructivas ni push |
| 12 | Fidelidad | PASS | Diseño aprobado conservado; observaciones bajas incorporadas sin ampliación |

## Intervenciones del usuario y acciones reservadas

| Momento | Preparación del asistente | Acción reservada | Verificación posterior |
|---|---|---|---|
| Antes de la auditoría del plan | Plan BORRADOR guardado y hash calculado | El usuario commitea antes de la revisión; después aprueba solo si resulta APROBABLE | Commit, árbol limpio, hash auditado y aprobación visible |
| Paso 10 | Ensayo verde, candidata revisada, destino comprobado y evidencia redactada | Usuario: `npm run db:push:test` | Salida sin URL y `test:policies`, especialmente `09`, sobre objetos persistentes |
| Fallo posterior a aplicación | Diagnóstico, evidencia y alcance afectado; ninguna modificación de la migración aplicada | Usuario decide el tratamiento mediante una revisión explícita del alcance | No se reanuda hasta contar con procedimiento autorizado; después corresponde nueva aplicación por usuario y verificación completa |
| Paso 13 | Diff revisado, evidencia y pendientes concretos | Usuario commitea antes de cada revisión | `git status -sb`, `git log --oneline main..HEAD`; revisión ligada al commit |
| Paso 14 | Todas las verificaciones y revisiones requeridas completas | Usuario aprueba `G-DB-META` | Fecha y aprobación registradas en estado y sesión |
| Publicación futura, fuera del corte | Entregar referencia del commit probado y evidencia; no preparar una publicación automática | Push de rama, exclusivamente por el usuario cuando lo solicite | En esa tarea, comparar resultado y referencia remota con el commit autorizado |
| Despliegue futuro, fuera del corte | Entregar evidencia del corte; preparación específica corresponde a la fase de entorno | Despliegue/publicación por el usuario | En esa fase, verificar despliegue correspondiente al commit y sus comprobaciones; no declarar desplegado aquí |
| M28.2a, fuera del corte | Entregar `0012` probada; revalidación del destino según esa fase | Cualquier `db:push` al proyecto app por el usuario | Verificación posterior de M28.2a, sin ejecutar pruebas contra app |

**Permisos previstos:** `.claude/settings.json` deniega `npm run db:push*` y `git push*`; no se intentan desde el asistente. El ensayo temporal con Node puede solicitar permiso porque no tiene una regla de autorización específica. Las corridas remotas pueden requerir permiso de red, y Git Bash o `verify` pueden requerir ejecución fuera del sandbox ante errores de entorno. Solicitar ese permiso con el comando concreto; nunca usarlo para eludir acciones reservadas.

Durante esta planificación, Git Bash necesitó permiso para calcular el hash; la lectura autorizada terminó correctamente.

## Migraciones

Se crea únicamente `supabase/migrations/0012_integrations.sql`. La interfaz nueva comprende dos enums, tres tablas, dos helpers privados y las doce funciones de `worker_api` con las firmas y retornos de la spec. No se agrega ninguna RPC pública.

**Ensayo seleccionado:** se realiza siempre, incluso si H-E1-07 resulta falsa. El script temporal previsto en Diseño §12.5:

- Usa `pg`, el cargador existente y `resolveSqlTestTarget`; nunca usa la URL de app como destino alternativo.
- Ejecuta secuencialmente cada archivo pgTAP, incluyendo los existentes, en una transacción que contiene `0012` y el cuerpo de la prueba.
- Retira únicamente los delimitadores externos `begin`/`rollback` al componer el ensayo en memoria; conserva las aserciones y no modifica archivos de pruebas para ejecutarlo.
- Valida TAP completo: plan, cantidad de aserciones, ausencia de `not ok` y errores SQL.
- Ejecuta `ROLLBACK` también ante error, cierra la conexión y comprueba que no persistieron esquema, rol ni tablas nuevos.
- No confirma transacciones ni escribe el historial de migraciones. Registra ruta temporal efectiva, comando y resultados redactados. No sustituye las corridas posteriores a la aplicación.

Si D-05 exige corregir la FK, usar primero:

```sql
alter table public.reports drop constraint reports_context_fkey;
alter table public.reports add constraint reports_context_fkey
  foreign key (company_id, context_version_id)
  references public.company_context_versions (company_id, id)
  on delete no action;
```

Solo ante la evidencia prevista, cambiar la cláusula final a:

```sql
on delete no action deferrable initially deferred;
```

En esa variante, la protección contra borrar un contexto con reportes se prueba después de:

```sql
set constraints public.reports_context_fkey immediate;
```

**Reversión:** después de aplicar `0012`, no editarla, borrarla ni alterar su fila del historial. Cualquier reversión utiliza una migración nueva con el siguiente número libre, previa decisión explícita sobre alcance y numeración futura. Este plan no crea esa migración ni ejecuta el restablecimiento destructivo mencionado como alternativa en la spec.

## Riesgos

| Trampa o riesgo | Cobertura y respuesta |
|---|---|
| Trampas 1–3: dueño con bypass, ausencia de JWT y transiciones | Pasos 3–5 y 8; T-15, T-16, T-29, T-30. Membresía explícita; transiciones en SQL |
| Trampa 4: cierre previo sin reportes | Paso 2 y D-05 en paso 9; T-32 |
| Trampa 5: grants y RLS son capas distintas | Pasos 3, 4 y 6; T-09, T-10, T-16, T-33 |
| Trampas 6–7 y 10: rol C, membresía y pgTAP | Paso 3; `SET ROLE` dentro del helper y grant transaccional. Si no funciona, parar; no añadir grants permanentes silenciosamente |
| Trampa 8: `0012` aplicada no se reaplica por editarla | Ensayo previo, paso 9; parada después de aplicación y reversión mediante migración nueva |
| Trampa 9: ACL nula permite ejecución pública | T-12 exige ACL no nula antes de inspeccionar titulares |
| Trampa 11 y observación de auditoría previa: ambigüedad de columnas y `ON CONFLICT` | Paso 8: alias y nombre de restricción; ejecución real de reemplazo y recifrado |
| Trampas 12–13: error SQL invalida archivo y orden del runner | Pasos 2–6; rechazos capturados; parte 1 sola primero. Orden `08`, `09`, `09b`, `10` sin modificar runner |
| Trampa 14: `db:preview` apunta a app | No se utiliza; pasos 1 y 10 solo verifican destino de pruebas |
| Trampa 15: lecturas autenticadas sin claims | Pasos 3–4; claims explícitos antes de cada bloque |
| Trampa 16: datos reales o secretos | Fixtures de la spec y T-38; sin `.env.local` en lecturas o evidencia |
| Trampa 17: Vitest intermitente | Paso 11; repetición prescrita, sin cambiar configuración |
| Trampa 18: consumo dividido en lectura y escritura | T-19 y revisión de paso 8: único `UPDATE … RETURNING` |
| Ninguna variante de FK permite cierre | Paso 9: detenerse, conservar resultados y mantener gate bloqueado |
| Reautorización demorada más de diez minutos | T-39 verifica retención exacta; registrar el posible `PX002` tardío como límite del contrato |
| Diferencia entre reloj de servidor y base | T-17/T-18 mantienen el máximo aprobado; registrar para M16.1 el uso de margen menor a diez minutos |
| Pendiente vigente bloquea reinicio | T-18/T-29; conservar H-E1-21 para M16.1/M16.2 |
| A-01: negocio nulo admitido por K03 pero obligatorio en la función | T-45 ampliado sin cambiar la firma; registrar dependencia para M16.1 |
| A-02: trazabilidad incompleta del cambio documental previo | Paso 13 reconoce H-E1-22 y corrección a `vitest.config.mts` |
| Tamaño del grupo | Mantener TDD conjunto y gate único. Si un corte excede ocho horas de implementación, detenerse y proponer subdivisión explícita; no recortar pruebas ni cerrar parcialmente |

Se aplican todas las condiciones de parada de III.9 y AGENTS.md: contradicción, archivo no autorizado, migración existente, intervención pendiente, dependencia abierta, dato real, prerrequisito incumplido, prueba omitida, fallo de aislamiento/privilegios/guarda o dos iteraciones sin converger. Los rojos esperados y documentados de TDD no son evidencia de cierre.

Cada hallazgo nuevo tendrá ID estable, impacto, evidencia y microfase asignada.

## Qué no se hace

- Cifrado, cliente Node del rol C, contraseña, llavero ni cambios de dependencias: M06.3a.
- Cambiar guardas, helpers existentes, `SECURITY.md`, `ARCHITECTURE.md`, configuración de Vitest o esquemas expuestos.
- Resolver H-M04.1-02, H-E1-18, H-E1-21 o H-E1-22 dentro de este corte.
- OAuth, UI, llamadas a Meta, datos reales, sincronización, snapshots, chat o migraciones `0013`/`0014`.
- Añadir concurrencia real de dos conexiones para el consumo; la atomicidad se revisa por construcción y pruebas secuenciales aprobadas.
- Modificar migraciones existentes, hacer reset, borrar historial, commitear como asistente, hacer push o desplegar.
- Aprobar gates por la existencia de código, por un ensayo o por pruebas omitidas.
- Iniciar automáticamente M06.3a.

## Dudas para el auditor

No quedan decisiones funcionales abiertas. No se verificó el entorno remoto durante esta planificación:

- **H-S-01, H-S-02 y H-S-03:** bypass del dueño, membresía temporal y creación del rol; pasos 3, 9 y 10.
- **H-S-04 y H-S-10:** comportamiento efectivo de la FK; pasos 2 y 9, sin asumir de antemano el resultado.
- **H-S-05–H-S-08:** cascadas sin grants, errores y exposición de Data API, atomicidad de aplicación; pasos 10–11.
- **H-S-09:** equivalencia de zonas PostgreSQL/Intl con datos reales; permanece asignada a M16.2.
- La configuración y disponibilidad del proyecto desechable se comprobarán con las guardas y suites; no se presume que estén listas por existir los scripts.
- La auditoría formal del plan requiere que el usuario lo commitee en estado BORRADOR. Su hash se calcula con la fórmula del encabezado.
