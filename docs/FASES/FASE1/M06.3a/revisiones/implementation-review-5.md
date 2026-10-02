# Revisión de implementación M06.3a — 5

## Estado revisado

- Fecha: 2026-10-02. Rama: `mf/M06.3a`.
- Commit revisado (`git rev-parse HEAD`): `4b6568a1c75fcf4f780072273cd6fe4e7242ea77`.
- Base fija (`git merge-base main HEAD`): `80e5bf33c344da08f3648c0af10f7cfdbee2605e`.
- Precondiciones:
  - Rama correcta.
  - `docs/PROJECT_STATE.md`, líneas 23–24, y la sesión, línea 380, dicen `VERIFICADO — PENDIENTE DE APROBACIÓN`.
  - El comando de árbol limpio no devolvió nada.
  - La spec está APROBADA, con hash `73916504c73990df7a2d38ff18b7ea7f3c592375`, y el plan está APROBADO, con hash `9dba61e69272a17d27479c56cd526405a2c44fe2`. Los dos hashes coinciden con `spec-audit-5` y `plan-audit-3`.
- Este informe es independiente de la revisión 3, que se hizo sobre otro manifiesto: un commit más un diff sin commitear. Respecto de `e328bc7`, el commit actual incorpora los ocho archivos que la revisión 4 encontró sin commitear.

## Veredicto

**REQUIERE CAMBIOS.** Hay dos hallazgos que se corrigen dentro de la microfase:

- `R-01` (alta): el recorrido T-25 falla siempre en Linux, y la CI corre en `ubuntu-latest`, así que `npm run verify` queda rojo en la PR.
- `R-02` (media): ninguna prueba cubre la clasificación `failureKind` del cliente, que es la base de C-23. Una rotura deliberada pasó inadvertida.

`G-CRYPTO` sigue pendiente. Este informe no lo aprueba.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Alcance | PASS | `git diff -M --stat 80e5bf3 HEAD` muestra 26 archivos. Hay 21 de implementación y seguimiento, todos dentro de la tabla "Archivos" del plan y de "Archivos previstos" de la spec. Los otros 4 son informes del pipeline en `revisiones/`. No hay migraciones, rutas OAuth, workers ni cambios en `vitest.config.mts` o `src/lib/env.ts`. La implementación requerida de la ficha está completa: llavero, AES-256-GCM con IV y AAD, rotación, cliente del rol, `pg` en `dependencies`, invariantes, `SECURITY.md` y `ARCHITECTURE.md`. Los documentos transversales pasan de "previsto" a "vigente" solo en lo implementado y no incorporan estado ni conteos. `PROJECT_STATE.md` registra solo estado. |
| 2 | Criterios | FAIL (`R-02`) | Matriz siguiente. Leí T-01–T-53 y todos verifican su criterio, salvo uno: en C-23, la parte "errores explícitos (autenticación DB) conservan su tratamiento" se prueba solo con `WorkerApiError` construidos a mano (T-46, `credential-crypto.test.ts:414-429`). T-17 comprueba `code` pero no `failureKind` (`:602-624`). |
| 3 | Las pruebas detectan roturas | FAIL (`R-02`) | Dos de las tres roturas se detectaron. La tercera, clasificar `28xxx` como `transport`, dejó verdes 182/182 en todo el proyecto `unit`. |
| 4 | Reejecución | PASS (local) | `test:unit` 182/182, `db:check:test` verificado, `test:app` 37 pasadas y 7 omitidas (la suite del rol pasó 8/8 sin omisiones), `verify` exit 0 con 191/191 y build completo. Coincide con la sesión, paso 14. `R-01` no se manifiesta en Windows: ver ítem 6. |
| 5 | Seguridad y reglas | PASS | Sin coincidencias de patrones de secretos ni de `act_[0-9]{6,}` en el diff. Ninguna lectura de `.env.local`: solo aparece en la aserción negativa de T-26. Sin cambios ni archivos nuevos en `supabase/`. K01 se valida con `strictObject` antes de acceder a la base, y el AAD usa `ctx.company_id`. Errores con mensajes fijos y sin `cause`. Ningún `service_role` en el código nuevo. Los cuatro módulos empiezan con `import 'server-only';`. |
| 6 | Calidad funcional | FAIL (`R-01`) | Los caminos de error de la spec están implementados: material inválido antes de descifrar, versión desconocida, `PX006`/`PX008`, respuestas SQL inválidas, guardas de URL, TLS y destino, y operaciones preparadas. No hay `any`, TODO ni código muerto. Pero `tests/unit/no-secrets-in-tree.test.ts:94` compara contra el separador de Windows, así que la prueba solo funciona en Windows. |
| 7 | Evidencia | PASS | La sesión registra RED y GREEN por paso, fallos de arranque y de autenticación, la repetición permitida del pool, el diagnóstico limitado del rol y los comandos finales. `H-E1-42` tiene ID y asignación. `G-CRYPTO` no figura como aprobado, y los gates previos aprobados son legítimos. |
| 8 | Contradicciones | PASS | No encontré contradicciones entre la Parte I, II.6, la spec, el plan, `AGENTS.md` y el código. |

## Matriz de criterios

| Criterio | Prueba | Aserción verifica el criterio (sí/no) | Resultado |
|---|---|---|---|
| CA-21 | T-31, T-32, T-33 (app) | Sí: el rol real se autentica, las tres tablas dan `42501` y la lectura es solo por función | PASS |
| CA-23 | T-03, T-04 | Sí: IV distinto de 12 bytes y etiqueta de 16 | PASS |
| CA-24 | T-06–T-09, T-34 | Sí: clave, texto, etiqueta, IV y AAD alterados fallan de forma explícita; el traslado real entre empresas falla | PASS |
| CA-25 | T-10–T-16, T-35, T-36, T-44 | Sí | PASS |
| CA-26 | T-17, T-20, T-25, T-26, T-51–T-53 | Sí. T-25 falla en Linux (`R-01`) | PASS en Windows; FAIL en la CI |
| CA-27 reescrita | T-21 (cinco `it`) | Sí: URL del rol, `server-only`, URL de pruebas, `pg` y llavero | PASS |
| CA-11b | T-08, T-19, T-34 | Sí | PASS |
| CB-01–CB-06 | T-24, T-27–T-40 | Sí. CB-01 (`verify` verde) no se cumple en la CI Linux (`R-01`) | Parcial |
| C-01 | T-01, T-02 | Sí | PASS |
| C-02 | T-03–T-05 | Sí | PASS |
| C-03 | T-06–T-09 | Sí: T-09 espía `createDecipheriv` | PASS |
| C-04 | T-10, T-11 | Sí: `not.toBeInstanceOf(CredentialDecryptionError)` | PASS |
| C-05 | T-11–T-13, T-16, T-35 | Sí | PASS |
| C-06 | T-14, T-15, T-36, T-41 | Sí: T-41 obtiene un `PX006` real con una barrera | PASS |
| C-07 | T-18, T-21 | Sí: mapa, aridad, sin `name`, `on('error')` y `config_missing` | PASS |
| C-08 | T-17, T-53 | Sí para `code` y redacción. `failureKind` no se comprueba (`R-02`) | PASS con hueco |
| C-09 | T-12, T-19, T-51 | Sí | PASS |
| C-10 | T-20 | Sí | PASS |
| C-11 | T-28, T-40 | Sí: `true false true`, `npm ci --dry-run` y build | PASS |
| C-12 | T-21 | Sí | PASS |
| C-13 | T-22, T-27, T-49 | Sí | PASS |
| C-14 | T-23, T-24 | Sí: el literal aparece solo en T-23 | PASS |
| C-15 | T-25, T-26 | Sí | PASS en Windows; FAIL en Linux (`R-01`) |
| C-16 | T-29 | Sí: revisé el diff de SECURITY y ARCHITECTURE | PASS |
| C-17 | T-30 | Sí: 13 variables y las 4 nuevas sin valor | PASS |
| C-18 | T-31–T-37, T-41, T-43 | Sí | PASS |
| C-19 | T-38 | Sí: `vi.mock('server-only')` por suite, sin alias | PASS |
| C-20 | T-39 y scanner | Sí | PASS |
| C-21 | T-42, T-43, T-51 | Sí | PASS |
| C-22 | T-44 | Sí: SECURITY exige writers detenidos, operaciones terminadas y conteo cero | PASS |
| C-23 | T-45, T-46, T-52 | **Parcial:** el repositorio se prueba con un `failureKind` inyectado; la traducción real del cliente (`28xxx` → `other`, `Query read timeout` → `timeout`) no se prueba | FAIL (`R-02`) |
| C-24 | T-47 | Sí | PASS |
| C-25 | T-48, T-50, T-31 | Sí | PASS |
| C-26 | T-22, T-49 | Sí: el parser `pg` instalado se compara con los valores validados | PASS |
| C-27 | T-51–T-53 | Sí | PASS |

## Roturas

Todas se hicieron en el worktree `../praxa-review-M06.3a`, creado desde `4b6568a` con `npm ci --offline`. La base del worktree dio 32/32 en `credential-crypto.test.ts`. Restauré cada rotura con `git checkout --`, confirmé un `git status --porcelain` vacío después de cada una y eliminé el worktree al terminar.

| Criterio | Rotura | Prueba que la detectó | Probada en worktree (sí/no, motivo) |
|---|---|---|---|
| C-24 (seguridad: TLS) | Quitar `'sslmode'` de `TLS_QUERY` en `worker-api.ts` | T-47/T-49: `expected undefined to be an instance of WorkerApiError` | Sí |
| C-27/C-09 (aislamiento) | Quitar `row.company_id !== actor.company_id` en `readCredential` | T-52: `La operación debía fallar.` | Sí |
| C-23 (estados) | `translated()`: `28xxx` pasa a `WorkerApiError('unavailable', 'transport')` | **Ninguna:** la suite dio 32/32 y todo el proyecto `unit` 182/182 | Sí. Esta rotura hace que un rechazo de autenticación durante el rewrap devuelva `unconfirmed` en lugar de propagarse, contra Diseño §6 |

## Comandos reejecutados

Desde Git Bash, `npm run test:unit` no cargó ninguna suite: 9 archivos fallaron con "Vitest failed to find the runner" (`H-E1-20`). Lo repetí con PowerShell, según el procedimiento. Todos los comandos siguientes se corrieron con `powershell -NoProfile -Command`.

| Comando | Resultado | Sesión |
|---|---|---|
| `npm run test:unit` | Exit 0: 9 archivos, 182/182 | Igual |
| `npm run db:check:test` | Exit 0: proyecto desechable confirmado, URL del rol presente con la misma referencia, `Destino verificado.` | Igual |
| `npm run test:app` | Exit 0: 6 archivos, 37 pasadas y 7 omitidas. Las omitidas son bloques `skipIf` opuestos o de correo opt-in | Igual |
| `npx vitest run --project app tests/app/integrations-worker-api-client.test.ts --reporter=verbose` | 8/8: T-31–T-36, T-41 y T-43, sin omisiones | Igual |
| `npm run verify` | Exit 0: lint, typegen, typecheck, 10 archivos con 191/191 y build Next completo | Igual |
| `npm ci --dry-run --offline` | Exit 0; solo un aviso informativo de `allow-scripts` | Igual |
| Comprobación de `package.json` (T-28) | `true false true` | Igual |
| `rg -n SUPABASE_TEST_ALLOW_APP_PROJECT scripts tests src .github docs/SECURITY.md .env.example README.md` (T-24) | 3 coincidencias, todas en T-23 (`sql-test-target.test.ts:161,166,170`) | Igual |
| `git diff -M --name-status 80e5bf3 HEAD -- supabase/` y `git ls-files -o --exclude-standard -- supabase/` (T-39) | Sin salida | Igual |
| `git diff --check 80e5bf3 HEAD` | Exit 0 | — |
| Búsqueda de patrones de secretos y `act_[0-9]{6,}` en `git diff 80e5bf3 HEAD` | 0 coincidencias en ambos | — |
| Simulación de la línea 94 con `path.posix` y `path.win32` en el scratchpad | posix: `false`; win32: `true` | — |

## Hallazgos

| ID (R-NN) | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-01 | alta | `tests/unit/no-secrets-in-tree.test.ts:94` | La comprobación de contención `resolve(absolute).startsWith(root + '\\')` depende del separador de Windows. En Linux ningún archivo cumple la condición, así que T-25 lanza `Ruta fuera del repositorio.` en el primer archivo. | `.github/workflows/verify.yml` corre `npm run verify` en `ubuntu-latest`. Simulé la misma expresión: `path.posix` devuelve `false` y `path.win32` devuelve `true`. En Linux T-25 falla de forma determinista, la CI de la PR queda roja y no se cumplen CB-01 ni T-40. No hay Node sobre Linux en esta máquina (Docker detenido; WSL solo tiene `docker-desktop`), así que la confirmación es por simulación. | Usar un chequeo portable, por ejemplo `const rel = relative(root, resolve(absolute)); if (rel.startsWith('..') \|\| isAbsolute(rel)) throw …`, o comparar con `root + sep`. Volver a correr `test:unit` y `verify`. Conviene correr también la suite en Linux (la CI de la PR) antes de aprobar. |
| R-02 | media | `tests/unit/credential-crypto.test.ts:602-624` y `:414-429`; código en `src/modules/integrations/db/worker-api.ts:158-166` | Ninguna prueba comprueba el `failureKind` que asigna `translated()`. T-17 solo verifica `code`, y T-46 construye los `WorkerApiError` a mano. El mapeo real del timeout de `pg` (`new Error('Query read timeout')`, sin `code`, en `node_modules/pg/lib/client.js:707`) tampoco se ejercita, porque T-17 usa `ETIMEDOUT`. | Rotura 3: con `28xxx` clasificado como `transport`, el proyecto `unit` siguió en 182/182. Diseño §6 exige que los rechazos de autenticación y otros errores del servidor mantengan `failureKind = other` y se propaguen. | En T-17, afirmar `failureKind` por origen: `28P01` y `42501` dan `other`, `ECONNREFUSED`/`ECONNRESET`/`08006` dan `transport`, y `ETIMEDOUT` y `Error('Query read timeout')` dan `timeout`. Agregar un caso de extremo a extremo, pool simulado → `createWorkerApi` → `readCredential`, donde un `28P01` en el rewrap se propague y un `Query read timeout` produzca `unconfirmed`/`timeout`. |

## Pendientes del usuario

1. Volver a `/microfase M06.3a` con `R-01` y `R-02`, corregir dentro de los archivos previstos (`no-secrets-in-tree.test.ts` y `credential-crypto.test.ts`; no hace falta cambiar código de producción), actualizar la sesión y commitear en `mf/M06.3a`.
2. Pedir otra vez `/implementation-review M06.3a` sobre el commit nuevo. Antes de aprobar, conviene tener un `verify` verde en Linux, por ejemplo la CI de la PR.
3. `G-CRYPTO` sigue pendiente de aprobación visible y M28.2a no se habilita.

## Comprobaciones finales

- `git rev-parse HEAD` sigue en `4b6568a1c75fcf4f780072273cd6fe4e7242ea77`.
- El comando de árbol limpio del paso 1 sigue sin devolver nada; esta revisión solo agregó este informe, que está excluido.
- `git worktree list` muestra solo el directorio principal: `../praxa-review-M06.3a` se eliminó con `git worktree remove`, sin `--force`.
