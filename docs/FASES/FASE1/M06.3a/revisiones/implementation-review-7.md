# Revisión de implementación M06.3a — 7

## Estado revisado

- Fecha: 2026-10-02. Rama: `mf/M06.3a`.
- Commit revisado (`git rev-parse HEAD`): `83bfdd3b4ebd4562bbd228761e80997788b98141`.
- Base fija (`git merge-base main HEAD`): `80e5bf33c344da08f3648c0af10f7cfdbee2605e`.
- Precondiciones:
  - Rama correcta.
  - `docs/PROJECT_STATE.md`, líneas 24–25, y la sesión, línea 391, dicen `VERIFICADO — PENDIENTE DE APROBACIÓN`.
  - El comando de árbol limpio no devolvió nada, al inicio y al final.
  - Hashes de contenido sin línea de estado: spec `73916504c73990df7a2d38ff18b7ea7f3c592375` (APROBADA) y plan `9dba61e69272a17d27479c56cd526405a2c44fe2` (APROBADO). Coinciden con `spec-audit-5` y `plan-audit-3`. Ni la spec, ni el plan, ni la spec y el plan de la ruta cambiaron entre la base y HEAD.
- Este informe revisa el commit completo respecto de la base. Respecto de `4b6568a`, que revisó `implementation-review-5`, el commit `83bfdd3` cambia solo `tests/unit/no-secrets-in-tree.test.ts`, `tests/unit/credential-crypto.test.ts`, la sesión, `PROJECT_STATE.md` y tres informes de `revisiones/`. No toca código de producción.

## Veredicto

**APROBABLE.** Los 8 ítems del checklist están en PASS. Las correcciones de R-01 y R-02 de `implementation-review-5` se comprobaron de forma independiente:

- La rotura `28xxx → transport` ahora la detectan dos pruebas.
- La simulación POSIX del recorrido de T-25 acepta los 192 archivos del árbol; la comprobación anterior aceptaba 0.

Quedan dos observaciones de severidad baja (R-01 y R-02 de este informe). Ninguna viola un criterio de la spec aprobada ni exige cambios para aprobar.

`G-CRYPTO` sigue pendiente de aprobación visible del usuario. Este informe no lo aprueba.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Alcance | PASS | `git diff -M --name-only 80e5bf3 HEAD`: 29 archivos. 19 son de implementación y están en la tabla "Archivos" del plan. Hay 3 de seguimiento y 7 informes del pipeline. No hay archivos fuera del plan. `vitest.config.mts`, `src/lib/env.ts` y `supabase/` sin cambios. La implementación requerida de la ficha está completa: llavero, AES-256-GCM con IV aleatorio y AAD, rotación, cliente `pg` del rol, `pg` en `dependencies`, invariantes de `no-privileged-credentials`, `SECURITY.md` y `ARCHITECTURE.md`. No hay funcionalidad de más: no hay rutas, OAuth, workers ni recifrado masivo. Los documentos transversales pasan a "vigente" solo lo implementado y mantienen OAuth, ciclo de vida y sincronización como previstos. No incorporan conteos, estado ni gates. `PROJECT_STATE.md` registra solo estado. |
| 2 | Criterios | PASS | Matriz siguiente. Leí T-01–T-53: cada aserción verifica su criterio. El hueco de C-23 señalado en la revisión 5 está cerrado. T-17 afirma `failureKind` por origen, incluido `Error('Query read timeout')` sin `code`. El caso nuevo T-17/T-46 recorre pool simulado → `createWorkerApi` → `readCredential` real. |
| 3 | Las pruebas detectan roturas | PASS | Tres roturas, las tres detectadas. Ver la tabla "Roturas". |
| 4 | Reejecución | PASS | `test:unit` 9 archivos 184/184. `db:check:test` exit 0. `test:app` 37 pasadas y 7 omitidas en la segunda corrida; la primera falló por red en la limpieza de `onboarding.test.ts`, ver abajo. Suite del rol 8/8 sin omisiones. `verify` exit 0 con 10 archivos 193/193 y build completo. Coincide con la sesión, línea 388–389: incluso la sesión registró un primer `test:app` con fallos de red y un segundo verde. La diferencia de la primera corrida viene del entorno, no del código. |
| 5 | Seguridad y reglas | PASS | 0 coincidencias de `act_[0-9]{6,}` y de patrones de tokens, JWT, `sb_secret_`, claves privadas, pares del llavero y parámetros OAuth en las líneas agregadas del diff. Las contraseñas en URLs agregadas son solo `secreta`, `clave` y `%5BYOUR-PASSWORD%5D`, que están en la lista sintética. `.env.local` aparece solo en la aserción negativa de T-26. `supabase/`: sin cambios, renombres ni archivos nuevos. K01 se valida con `strictObject` (`credentials.ts:66-71`) y la empresa sale solo del contexto. Errores con mensaje fijo, sin `cause`. Ningún `service_role` ni `SECRET_KEY` agregado en `src/` o `scripts/`. Los cuatro módulos empiezan con `import 'server-only';`. |
| 6 | Calidad funcional | PASS | Los caminos de error de la spec están implementados:<br>- material inválido antes de descifrar;<br>- versión desconocida separada de autenticación fallida;<br>- `PX006`/`PX008`;<br>- respuestas SQL inválidas;<br>- guardas de URI, destino y TLS antes de `pg`;<br>- operaciones preparadas opacas.<br>Sin `any`, TODO, `ts-ignore` ni `eslint-disable` en los módulos nuevos. La comprobación de contención de T-25 ya es portable: `relative`/`isAbsolute`/`sep`, con autoprueba `posix`/`win32`. Observaciones R-01 y R-02, de severidad baja. |
| 7 | Evidencia | PASS | La sesión registra los RED y GREEN de las correcciones, un primer foco fallido por setup de la prueba que no se acredita como RED, el `test:app` fallido inicial con su repetición, y la limitación de que la CI Linux no se ejecutó. `H-E1-42` tiene ID y asignación. `G-CRYPTO` no figura como aprobado, M28.2a no está habilitada y los gates previos son legítimos. |
| 8 | Contradicciones | PASS | No encontré contradicciones entre la Parte I, II.6, III.3, la spec, el plan, `AGENTS.md` y el código. La lectura de "referencia ambigua" de Diseño §7 se discute en R-02. |

## Matriz de criterios

| Criterio | Prueba | Aserción verifica el criterio (sí/no) | Resultado |
|---|---|---|---|
| CA-21 | T-31, T-32, T-33 (app) | Sí: `current_user` del pool real, `42501` en las tres tablas y lectura solo por función | PASS |
| CA-23 | T-03, T-04 | Sí: IV distinto entre sellos, 12 bytes, etiqueta de 16 | PASS |
| CA-24 | T-06–T-09, T-34 | Sí: clave, texto, etiqueta, IV y AAD alterados dan `CredentialDecryptionError`; material real movido a otra empresa no descifra | PASS |
| CA-25 | T-10–T-16, T-35, T-36, T-44 | Sí | PASS |
| CA-26 | T-17, T-20, T-25, T-26, T-51–T-53 | Sí; T-25 ya es portable a Linux | PASS |
| CA-27 reescrita | T-21 (cinco `it` nuevos; los dos originales intactos) | Sí | PASS |
| CA-11b | T-08, T-19, T-34 | Sí | PASS |
| CB-01–CB-06 | T-24, T-27–T-40 | Sí. CB-01 se verificó en Windows; la CI Linux no se ejecutó (ver Pendientes) | PASS |
| C-01 | T-01, T-02 | Sí: código, posición y ausencia de la clave en el mensaje | PASS |
| C-02 | T-03–T-05 | Sí | PASS |
| C-03 | T-06–T-09 | Sí; T-09 espía `createDecipheriv` | PASS |
| C-04 | T-10, T-11 | Sí: `not.toBeInstanceOf(CredentialDecryptionError)` | PASS |
| C-05 | T-11–T-13, T-16, T-35 | Sí: argumentos de `rewrap_credential` `[actor, empresa, conexión, 3, 1, …, 2]` | PASS |
| C-06 | T-14, T-15, T-36, T-41 | Sí; T-41 obtiene un `PX006` real con una barrera | PASS |
| C-07 | T-18, T-21 | Sí: SQL del mapa, aridad, sin `name`, `on('error')`, `config_missing` | PASS |
| C-08 | T-17, T-53 | Sí: `code` y `failureKind` por origen; redacción de `message`, JSON y propiedades | PASS |
| C-09 | T-12, T-19, T-51 | Sí | PASS |
| C-10 | T-20 | Sí | PASS |
| C-11 | T-28, T-40 | Sí: `true false true`, `npm ci --dry-run` y build | PASS |
| C-12 | T-21 | Sí | PASS |
| C-13 | T-22, T-27, T-49 | Sí para las siete reglas; ver la observación R-02 | PASS |
| C-14 | T-23, T-24 | Sí: el literal aparece solo en T-23 (tres líneas) | PASS |
| C-15 | T-25, T-26 | Sí | PASS |
| C-16 | T-29 | Sí: revisé el diff de SECURITY y ARCHITECTURE | PASS |
| C-17 | T-30 | Sí: 13 variables y las 4 nuevas sin valor | PASS |
| C-18 | T-31–T-37, T-41, T-43 | Sí; T-37 exige fallo por variable ausente, sin skip y con contadores en cero | PASS |
| C-19 | T-38 | Sí: `vi.mock('server-only')` por suite, sin alias | PASS |
| C-20 | T-39 y scanner | Sí | PASS |
| C-21 | T-42, T-43, T-51 | Sí | PASS |
| C-22 | T-44 | Sí: SECURITY exige escritores detenidos, operaciones terminadas y conteo cero, y aclara que `disconnected` cuenta | PASS |
| C-23 | T-45, T-46, T-17/T-46 nuevo, T-52 | Sí: `28P01` real del pool se propaga con `failureKind=other`; `Query read timeout` da `unconfirmed`/`timeout` con la versión leída y exactamente dos consultas | PASS |
| C-24 | T-47 | Sí | PASS |
| C-25 | T-48, T-50, T-31 | Sí | PASS |
| C-26 | T-22, T-49 | Sí: el parser `pg` instalado se compara con los valores validados | PASS |
| C-27 | T-51–T-53 | Sí | PASS |

## Roturas

Todas se hicieron en el worktree `../praxa-review-M06.3a-r7`, creado desde `83bfdd3` con `npm ci --offline`. La base del worktree dio 33/33 en `credential-crypto.test.ts`. Restauré cada rotura con `git checkout --` y confirmé un `git status --porcelain` vacío después de cada una. Al terminar eliminé el worktree con `git worktree remove`, sin `--force`.

| Criterio | Rotura | Prueba que la detectó | Probada en worktree (sí/no, motivo) |
|---|---|---|---|
| C-23 (estados; regresión de R-02 anterior) | `translated()` en `worker-api.ts`: la rama `28xxx` pasa a `WorkerApiError('unavailable', 'transport')` | T-17 (`failureKind` esperado `other`, recibido `transport`) y T-17/T-46 (`readCredential` dejó de propagar el error); 2 fallidas de 33 | Sí |
| C-06 / `H-E1-37` (estados) | `REWRAP_STATUSES` en `credentials.ts` incluye `disconnected` | T-14 (`expected 'confirmed' to be 'not_attempted'`) y T-46; 2 fallidas de 33 | Sí |
| CA-23 / C-02 (seguridad: IV) | `sealCredential`: `randomBytes(12)` reemplazado por `Buffer.alloc(12)` | T-04 (`expected 'AAAAAAAAAAAAAAAA' not to be 'AAAAAAAAAAAAAAAA'`); 1 fallida de 33 | Sí |

Comprobación complementaria de la corrección de R-01 anterior, sin Linux disponible: Docker detenido y WSL solo con `docker-desktop`. Un script del scratchpad aplicó, dentro del worktree, el helper nuevo con `path.posix` sobre los 192 archivos de `git ls-files -co --exclude-standard`, con la raíz `/home/runner/work/PRAXA/PRAXA`. El helper nuevo aceptó 192 de 192 y la comprobación anterior aceptó 0. No se escribió nada en el worktree.

## Comandos reejecutados

Todos con `powershell -NoProfile -Command` (H-E1-20), en el directorio del usuario y sin modificar archivos.

| Comando | Resultado | Sesión |
|---|---|---|
| `npm run test:unit` | Exit 0: 9 archivos, 184/184 | Igual |
| `npm run db:check:test` | Exit 0: proyecto desechable confirmado, URL del rol presente con la misma referencia (enmascarada en la salida), `Destino verificado.` | Igual |
| `npm run test:app`, primera corrida | Exit 1: 37 pasadas y 7 omitidas, pero `tests/app/onboarding.test.ts` falló en `afterAll` → `cleanupRun` con `TypeError: fetch failed` al borrar las empresas de su corrida | Distinto en la suite, igual en el tipo: la sesión también registra un primer `test:app` con fallos de red |
| `npm run test:app`, segunda corrida | Exit 0: 6 archivos, 37 pasadas y 7 omitidas | Igual |
| `npx vitest run --project app tests/app/integrations-worker-api-client.test.ts --reporter=verbose` | Exit 0: 8/8 (T-31–T-36, T-41, T-43), sin omisiones | Igual |
| `npm run verify` (dos veces) | Exit 0: lint, typegen, typecheck, 10 archivos con 193/193 y build Next completo | Igual |
| `npx vitest run --project unit tests/unit/credential-crypto.test.ts` (worktree, base) | 33/33 | — |
| `node -e …` (T-28) | `true false true` | Igual |
| `npm ci --dry-run --offline` | Exit 0 | Igual |
| T-24: búsqueda de `SUPABASE_TEST_ALLOW_APP_PROJECT` en `scripts tests src .github docs/SECURITY.md .env.example README.md` | 3 coincidencias, todas en T-23 (`sql-test-target.test.ts:161,166,170`) | Igual |
| `git diff -M --name-status 80e5bf3 HEAD -- supabase/` y `git ls-files -o --exclude-standard -- supabase/` (T-39) | Sin salida | Igual |
| `git diff --check 80e5bf3 HEAD` | Exit 0 | Igual |
| Patrones de secretos y `act_[0-9]{6,}` sobre `git diff 80e5bf3 HEAD` | 0 coincidencias | — |
| Sondas puras de `resolveIntegrationsTestTarget` con variables sintéticas (R-02) | Ver R-02 | — |

La primera corrida de `test:app` falló por red, en una suite ajena a M06.3a. La segunda corrida, sin cambios, pasó. La clasifico como entorno, igual que el antecedente de la sesión, línea 388. Puede haber quedado sin borrar lo que creó esa corrida en el proyecto desechable (ver Pendientes).

## Hallazgos

| ID (R-NN) | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-01 | baja | `src/modules/integrations/db/worker-api.ts:147-168` | Hay fallos de transporte sin `code` que se clasifican como `unexpected`/`other`. Tres casos: `Connection terminated unexpectedly` (`pg/lib/client.js:204`), `timeout exceeded when trying to connect` y `Connection terminated due to connection timeout` (`pg-pool/index.js:224,276`). Si ocurren durante el rewrap, `readCredential` propaga el error en lugar de devolver `unconfirmed`. | El código coincide con la tabla literal de Diseño §5: enumera los códigos de red y "el timeout de consulta", y todo lo demás es `unexpected`. Por eso no es un incumplimiento. El efecto es conservador: no entrega la credencial, no escribe nada y no filtra datos. La sesión, línea 388, registra un `WorkerApiError unexpected` transitorio en T-41, compatible con esta clasificación. | No cambiar en M06.3a. Registrar un hallazgo con ID estable para la microfase que use el cliente en runtime (M16.1) o para una corrección de la spec, y decidir allí si estos mensajes cuentan como transporte o timeout. |
| R-02 | baja | `scripts/lib/sql-target.mjs:91-95` | Si `SUPABASE_DB_URL` está definida pero no permite deducir el proyecto (por ejemplo, un host que no es de Supabase), el resolvedor no compara contra `NEXT_PUBLIC_SUPABASE_URL` ni rechaza la referencia. En ese caso acepta una URL del rol del mismo proyecto que la aplicación. | Sonda pura con variables sintéticas: `SUPABASE_DB_URL` en `db.example.test`, `NEXT_PUBLIC_SUPABASE_URL` del proyecto de pruebas y sin `SUPABASE_TEST_URL` da `ok: true`. Con `SUPABASE_TEST_URL` igual a `NEXT_PUBLIC_SUPABASE_URL` da `ok: false`. El patrón se hereda de `resolveSqlTestTarget`, que la spec prohíbe modificar. En los caminos reales hay defensas adicionales: `blockedReason()` exige `SUPABASE_TEST_URL` distinta de la URL de la aplicación, y lo mismo hace `resolveTarget('test')` en `db:check:test`. Diseño §7 dice "una referencia ambigua se rechaza"; en el contexto de A-02 se lee como una referencia con overrides, y esos sí se rechazan. | No bloquea. Si el usuario interpreta la frase de §7 como "referencia no deducible", rechazar dentro de `resolveIntegrationsTestTarget` la `SUPABASE_DB_URL` de la que no se pueda deducir el proyecto y agregar el caso a T-22, en los mismos archivos previstos. Si no, registrar la aclaración como hallazgo. |

## Pendientes del usuario

1. Aprobar o no `G-CRYPTO` de forma visible, después de revisar la evidencia. Hasta entonces M28.2a sigue sin habilitar.
2. Antes del merge, conviene tener `npm run verify` en verde en Linux, por ejemplo la CI de la PR (`ubuntu-latest`). La corrección de la contención de T-25 está verificada por simulación POSIX, no por una ejecución real en Linux.
3. Opcional: revisar en el proyecto desechable de pruebas si quedaron usuarios o empresas de la corrida `mur6bhvm-4nn7ke`, cuya limpieza falló por `fetch failed` en `onboarding.test.ts`. Es un proyecto desechable; no afecta a la aplicación.
4. Decidir sobre R-01 y R-02: registrarlos como hallazgos o descartarlos.

## Comprobaciones finales

- `git rev-parse HEAD` sigue en `83bfdd3b4ebd4562bbd228761e80997788b98141`.
- El comando de árbol limpio del paso 1 sigue sin devolver nada. Esta revisión solo agregó este informe, que está excluido.
- `git worktree list` muestra solo el directorio principal: `../praxa-review-M06.3a-r7` se eliminó con `git worktree remove`, sin `--force`.
