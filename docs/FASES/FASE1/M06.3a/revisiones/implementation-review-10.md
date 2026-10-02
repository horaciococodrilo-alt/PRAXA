# Revisión de implementación M06.3a — 10

Fecha: 2026-10-02
Rama: `mf/M06.3a`
HEAD al cierre: `0327ad647381a8c22737dc0899e18717f57e18fe`
`git merge-base main HEAD`: `80e5bf33c344da08f3648c0af10f7cfdbee2605e`

## Nota de proceso concurrente (leer antes del resto)

Esta revisión empezó con HEAD `56f71b7a81e72371f7e9e20f2619d5dfdf7f2923` (árbol limpio,
precondiciones todas PASS) y evaluó ese commit de punta a punta: lectura de fuentes, diff
completo contra la base, roturas controladas en un worktree aislado y reejecución de todas
las verificaciones de III.3. **A mitad de la revisión, otro proceso** (commit
`0327ad6`, mensaje "codex implementation review aprodado") **agregó
`implementation-review-9.md`** con el mismo veredicto APROBABLE sobre el mismo commit
`56f71b7`, sin tocar ningún archivo de código ni de prueba. Además, mientras esta revisión
corría, aparecieron en el árbol de trabajo `docs/FASES/FASE1/M06.3a/revisiones/pr.md` y
`qa-review-5.md`, sin commitear — evidencia de que un QA está corriendo en paralelo sobre la
misma rama, exactamente el problema que `qa-review-4.md` pidió evitar ("Pendientes del
usuario", punto 4).

No se tocó ninguno de esos archivos. El commit `0327ad6` no cambia código: `git diff --stat
56f71b7 0327ad6` solo agrega el informe 9. Por eso esta revisión evalúa el mismo contenido
funcional que `implementation-review-9.md`, con comandos y roturas propios e
independientes, y se registra como el informe 10 (el número más alto existente, +1), sin
sobrescribir el 9. El veredicto de ambos coincide; las secciones siguientes son evidencia
propia, no una transcripción de la revisión 9.

## 1. Precondiciones

| Precondición | Resultado | Evidencia |
|---|---|---|
| Rama `mf/M06.3a` | PASS | `git branch --show-current` → `mf/M06.3a` |
| Microfase verificada/pendiente | PASS | `docs/PROJECT_STATE.md:24-25`: "VERIFICADO — PENDIENTE DE NUEVA REVISIÓN Y QA tras la corrección de Q-02." Coincide con la sesión. |
| Árbol limpio (excluidas `revisiones/*` y `sesiones/*-review-*`) | PASS al iniciar y al cerrar | El comando de la skill no devolvió nada en ninguno de los dos momentos. `pr.md` y `qa-review-5.md` caen dentro de la exclusión de `revisiones/*`, así que no rompen la precondición formal, aunque sí son la señal de un proceso concurrente (ver nota arriba). |

## 2. Fuentes leídas

`AGENTS.md`; `docs/FASES/FASE1/meta_first/plan.md` (ficha Parte I de M06.3a, Parte II.6,
III.3, III.9); CA/DEC/CB citados en `docs/FASES/FASE1/meta_first/spec.md`;
`docs/FASES/FASE1/M06.3a/spec.md` y `plan.md`; `sesiones/M06.3a.md` completa (416 líneas);
`qa-review-4.md` completo (907 líneas, hallazgos Q-01–Q-05); `implementation-review-7.md`
(APROBABLE sobre `83bfdd3`) e `implementation-review-8.md` (BLOQUEADO por árbol sucio sobre
`c89d67a`); `docs/HALLAZGOS.md` (entradas `H-E1-44`–`H-E1-47`); `git diff --stat 80e5bf3
56f71b7`, `git diff -M 80e5bf3 56f71b7` completo y `git diff c89d67a 56f71b7` (la corrección
puntual de esta ronda).

## 3. Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1. Alcance | PASS | `git diff --stat 80e5bf3 56f71b7`: 34 archivos, todos en la tabla de `plan.md` (módulos de II.6.1–II.6.12, `docs/HALLAZGOS.md`/`PROJECT_STATE.md`/sesión por Precondición 8, informes de pipeline por Precondición 9). La corrección puntual (`c89d67a` → `56f71b7`) toca exactamente los cuatro archivos que `qa-review-4.md` señaló para Q-01/Q-02/Q-04/Q-05 (`tests/unit/credential-crypto.test.ts`, `src/modules/integrations/db/worker-api.ts`, `scripts/lib/sql-target.mjs`, `tests/unit/sql-test-target.test.ts`) más seguimiento. No hay rutas OAuth, cliente HTTP de Meta, ni cambio de migración. Documentos transversales: `SECURITY.md`/`ARCHITECTURE.md` no cambiaron en esta corrección puntual (solo en el commit anterior, ya aprobado en revisión 7); `PROJECT_STATE.md` no declara el gate aprobado. |
| 2. Criterios | PASS | Verificado con foco en los cuatro hallazgos corregidos (ver matriz §4); el resto de C-01–C-27 ya estaba cubierto por `implementation-review-7` (APROBABLE) y las ~100 pruebas exploratorias de `qa-review-4`, que solo encontraron estos cuatro defectos puntuales más la observación Q-05. No se repitió la lectura línea por línea de las ~886 líneas de `credential-crypto.test.ts` ajenas a la corrección; sí se leyó el diff completo y las aserciones nuevas. |
| 3. Pruebas detectan roturas (worktree aislado) | PASS | Tres roturas, las tres sobre el código nuevo de esta corrección (ver §5). Las tres fueron detectadas por la prueba correspondiente y restauradas con `git checkout --`. |
| 4. Reejecución | PASS | `npm run test:unit` (9 archivos/188), `npm run verify` (lint+typegen+typecheck+10 archivos/197+build), `npm run db:check:test` ("Destino verificado."), `npm run test:app` (6 archivos, 37 pasadas/7 omitidas) y la suite del rol sola (8/8) — ver §6. Coinciden con la sesión en archivos y conteos; no hubo que repetir en PowerShell porque Git Bash cargó Vitest sin problema esta vez. |
| 5. Seguridad y reglas | PASS | `grep` de `act_[0-9]{6,}`, `sb_secret_`, `service_role` y cabeceras de clave privada en `src`, `tests`, `scripts`, `docs/SECURITY.md`, `docs/ARCHITECTURE.md`, `.env.example`, `README.md`: solo nombres de rol, patrones del scanner y placeholders de ejemplo, ninguna coincidencia real. No se leyó `.env.local`. `git diff --name-only main -- supabase/` vacío; `git ls-files -o --exclude-standard -- supabase/` vacío. Los cuatro módulos nuevos empiezan con `import 'server-only';` (verificado con `head -1` de cada uno). `service_role` solo aparece en fixtures de prueba, documentado como tal. |
| 6. Calidad funcional | PASS | Las dos guardas nuevas (`AMBIGUOUS_ENCODING`, `literalAuthorityPort`) están duplicadas con comentario idéntico en `worker-api.ts` y `sql-target.mjs` — es la duplicación mínima que exige tener la regla en cliente y resolvedor por separado (misma decisión que ya existía para el resto de las reglas de Diseño §5/§7); no hay código muerto nuevo ni `TODO`. Tipos estrictos: `literalAuthorityPort` tipa `string \| null`; no hay `any` nuevo. |
| 7. Evidencia | PASS | La sesión (`## Continuación 2026-10-02 — corrección de Q-01, Q-02, Q-04 y Q-05`) registra RED/GREEN, comandos y resultados reales, incluidos los exit codes. `H-E1-44`–`H-E1-47` tienen ID, impacto, evidencia y resolución en `docs/HALLAZGOS.md`. `PROJECT_STATE.md` no declara `G-CRYPTO` aprobado. |
| 8. Contradicciones | PASS | Las dos decisiones de usuario citadas en la sesión (rechazar `06543`; acotar el rechazo TLS a la URL del rol) están en los dos archivos de código de forma consistente entre sí y con `scripts/lib/sql-target.mjs`/`worker-api.ts`. No hay contradicción con la ficha, el plan ni `AGENTS.md`. |

## 4. Matriz de criterios (foco en la corrección de esta ronda)

| Criterio | Prueba | ¿La aserción verifica el criterio? | Resultado |
|---|---|---|---|
| C-18/CB-06, Diseño §12 (Q-01/H-E1-44) | T-37 control positivo (`credential-crypto.test.ts`) | Sí: exige `state.pool > 0` y ausencia de `ENOTFOUND`/`getaddrinfo` cuando el `beforeAll` real llega a `createWorkerApi`, probando que el alias intercepta antes de salir a la red | PASS |
| C-18/CB-06 (regresión negativa) | T-37 original | Sí: sigue exigiendo `Test Files 1 failed`, el mensaje de variable ausente y contadores en cero, ahora sin depender de un mock que no interceptaba | PASS |
| C-26, A-02 (Q-02/H-E1-45) | T-49 (`credential-crypto.test.ts`), equivalente en T-22 (`sql-test-target.test.ts`) | Sí: las tres variantes de re-codificación ambigua (espacio en la contraseña, `%zz` en la ruta, `%zz` en la query, todas con `praxa%5Fintegrations.<ref>`) deben lanzar antes de construir `Pool`/aceptarse | PASS |
| C-13 regla 7 / C-26 (Q-04/H-E1-46) | T-49, T-22 | Sí: el caso `:06543` debe rechazarse aunque `new URL().port` lo normalice a `6543` | PASS |
| C-13/Diseño §7 (Q-05/H-E1-47) | T-22 "acepta sslmode en la referencia de pruebas" | Sí: exige `ok: true` con `?sslmode=require` en `SUPABASE_TEST_DB_URL` y, en el mismo caso, que la URL del rol con el mismo parámetro siga dando `ok: false` | PASS |

## 5. Roturas controladas (worktree `../praxa-review-M06.3a`, detached en `56f71b7`)

Instalado con `npm ci --offline` (471 paquetes, 0 vulnerabilidades). Las tres apuntan a
código introducido por esta corrección puntual, no al resto ya probado en revisiones
anteriores.

| Criterio | Rotura | Prueba que la detectó | Resultado | Restaurado |
|---|---|---|---|---|
| C-26/Q-02 (H-E1-45) | Comentar `if (AMBIGUOUS_ENCODING.test(connectionString)) configInvalid();` en `worker-api.ts` (línea 142) | T-49 | FAIL: "expected function to throw an error, but it didn't" | `git checkout -- src/modules/integrations/db/worker-api.ts`, confirmado por `git diff --stat` vacío |
| C-13 regla 7/Q-04 (H-E1-46) | En `sql-target.mjs` línea 110, quitar `\|\| literalAuthorityPort(roleUrl) !== '6543'` de la condición | T-22/T-49 (el caso combinado) | FAIL: `expected true to be false` | `git checkout -- scripts/lib/sql-target.mjs` |
| C-18/Q-01 (H-E1-44) | En el arnés de T-37, quitar el alias `pg: stubPath` de `resolve.alias` del proyecto `app` (simula que el mecanismo de intercepción no está wireado) | T-37 control positivo | FAIL: `expected true to be false` sobre `/ENOTFOUND\|getaddrinfo/.test(report)` (el `beforeAll` real intentó resolver el host sintético) | `git checkout -- tests/unit/credential-crypto.test.ts` |

Worktree eliminado con `git worktree remove ../praxa-review-M06.3a` (sin `--force`);
`git worktree list` solo muestra el directorio principal.

Una rotura que necesitaría la base de datos real (por ejemplo, revertir la comprobación
`PX006`/`PX008` en `credentials.ts`) no se probó aquí: ya fue cubierta con el rol real en
revisiones anteriores (`implementation-review-1`, paso 12) y no cambió en esta corrección.

## 6. Reejecución (directorio del usuario, sin modificar nada)

| Comando | Resultado |
|---|---|
| `npm run test:unit -- tests/unit/credential-crypto.test.ts tests/unit/sql-test-target.test.ts tests/unit/no-privileged-credentials.test.ts tests/unit/no-secrets-in-tree.test.ts` (repetido 11 veces) | 10/11 veces: 4 archivos, 63/63. **1/11 veces: T-49 falló solo** ("expected function to throw an error, but it didn't") sin tocar nada entre corridas. No reprodujo en 10 repeticiones inmediatas posteriores de la misma línea exacta. Ver hallazgo R-01 abajo. |
| `npm run test:unit` (comando canónico, sin argumentos de archivo) | Exit 0, 9 archivos, **188/188**, repetido limpio |
| `npm run verify` | Exit 0: lint, typegen, typecheck, 10 archivos/**197/197**, build Next completo |
| `npm run db:check:test` | Exit 0, "Destino verificado." (proyecto desechable y URL del rol con la misma referencia; valores no reproducidos en este informe) |
| `npm run test:app -- tests/app/integrations-worker-api-client.test.ts --reporter=verbose` | Exit 0, **8/8** (T-31–T-36, T-41, T-43), sin omisiones, login real como `praxa_integrations` |
| `npm run test:app` completo | Exit 0, 6 archivos, **37 pasadas, 7 omitidas** (3 de `email-flows` opt-in + 4 avisos "NO EJECUTADA" ajenos) |
| `rg -n SUPABASE_TEST_ALLOW_APP_PROJECT scripts tests src .github docs/SECURITY.md .env.example README.md` | 3 coincidencias, las tres en `tests/unit/sql-test-target.test.ts:204,209,213` (dentro de T-23) |
| `node -e "…pg deps…"` | `true false true` |
| `npm ci --dry-run` | Exit 0 (aviso informativo de `allow-scripts`, no bloqueante) |
| `git diff main -- docs/SECURITY.md docs/ARCHITECTURE.md` | Revisado íntegro: pasa cuatro componentes de previsto a vigente con el límite de recifrado/retiro documentado; no duplica grants/TTL/nombres de función; OAuth y ciclo de vida siguen previstos |
| `git diff main -- .env.example` | Cuatro variables nuevas vacías, conteo corregido a "Trece variables" |
| `git diff main -- package.json` | Solo mueve `pg` de `devDependencies` a `dependencies`, mismo rango |
| `git diff --name-only main -- supabase/`; `git ls-files -o --exclude-standard -- supabase/` | Ambos vacíos |
| `git diff --check` | Exit 0, sin salida |
| `git status --short` | Solo los dos archivos de proceso concurrente ajenos (`pr.md`, `qa-review-5.md`), excluidos por el patrón de la skill |

## 7. Hallazgo nuevo de esta revisión

| ID (R-NN) | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-01 | baja | `tests/unit/credential-crypto.test.ts` (T-49) | Al ejecutar exactamente ese subconjunto de 4 archivos (y solo ese, no el comando canónico `npm run test:unit` ni el archivo aislado), T-49 falló una vez en 11 intentos con "expected function to throw an error, but it didn't", sin que ningún archivo cambiara entre corridas. No se identificó la causa (probablemente una condición de carrera de scheduling del *pool* de hilos de Vitest con ese subconjunto puntual de archivos, no reproducida con el archivo solo ni con la suite completa). | 11 ejecuciones de `npm run test:unit -- tests/unit/credential-crypto.test.ts tests/unit/sql-test-target.test.ts tests/unit/no-privileged-credentials.test.ts tests/unit/no-secrets-in-tree.test.ts`: 1 FAIL, 10 PASS. `npm run test:unit` (canónico) y `credential-crypto.test.ts` aislado: 100% verde en todas las repeticiones (más de 10 corridas combinadas). | No bloquea esta microfase: el comando exigido por III.3/el plan es `npm run test:unit` sin argumentos, que no mostró la intermitencia. Registrar y, si vuelve a aparecer en CI, investigar si `fileParallelism`/aislamiento de `pgState` entre archivos necesita un `beforeEach` que limpie estado compartido. |

Ningún otro hallazgo nuevo. `H-E1-44`–`H-E1-47` quedaron verificados en código, pruebas y
tres roturas independientes (§5); su registro en `docs/HALLAZGOS.md` es correcto y completo.

## 8. Veredicto

**APROBABLE.** Los 8 ítems del checklist pasan. `G-CRYPTO` sigue pendiente de aprobación
visible del usuario; `PROJECT_STATE.md` no lo declara aprobado y M28.2a sigue sin habilitar.
El hallazgo R-01 es de severidad baja y no afecta el resultado del comando canónico de
verificación; no bloquea el avance a QA.

**Importante antes de avanzar:** hay evidencia de un QA corriendo en paralelo sobre esta
misma rama en este momento (`pr.md` y `qa-review-5.md` sin commitear, aparecidos durante
esta revisión). Conviene confirmar con el usuario qué proceso es la referencia antes de
decidir cuál de los informes 9/10 (ambos APROBABLE sobre el mismo commit `56f71b7`, con
evidencia independiente) y cuál QA posterior se toma como el vigente, para no terminar con
dos cadenas de revisión divergentes sobre `mf/M06.3a`.

## 9. Confirmaciones finales

- `git rev-parse HEAD`: `0327ad647381a8c22737dc0899e18717f57e18fe` — igual que al empezar a
  escribir este informe (el commit que agregó la revisión 9 ya estaba hecho antes de que
  esta sección se redactara; no cambió durante la redacción).
- Comando de árbol limpio del paso 1: sigue sin devolver nada (los dos archivos nuevos caen
  en la exclusión de `revisiones/*`).
- `git worktree list`: solo `C:/Users/Simon/dev/PRAXA`. El worktree temporal
  `../praxa-review-M06.3a` fue eliminado.

## 10. Siguiente paso

APROBABLE → correspondería `/qa-review M06.3a`, pero ya hay señales de un QA en curso en
paralelo sobre la misma rama (sección 8). Antes de lanzar otro, el usuario debería confirmar
que no hay dos procesos de QA corriendo a la vez, por la misma razón que `qa-review-3.md` y
`qa-review-4.md` ya documentaron: un QA que corre mientras el árbol cambia por fuera no
produce un manifiesto estable.
