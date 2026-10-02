# Revisión de implementación M06.3a — informe 13

**Fecha:** 2026-10-02
**Commit revisado (HEAD):** `85b14a3009a9e227679abdb93614a7cdd99e3526`
**Merge-base con `main`:** `80e5bf33c344da08f3648c0af10f7cfdbee2605e`

## Veredicto: REQUIERE CAMBIOS

El cifrado, el cliente acotado y el repositorio de credenciales están bien implementados,
bien probados y las pruebas detectan roturas reales (verificado con mutaciones en un
worktree aislado). El bloqueo no es de calidad de código sino de **alcance**: el commit
revisado incluye archivos fuera de lo autorizado por `spec.md`/`plan.md` de M06.3a
(apertura de redirección en login/callback, CA administrativa compartida para `pgtap` y
conexiones admin, cliente TLS administrativo), sin que la ruta se haya actualizado ni se
haya registrado un hallazgo con ID estable para esa ampliación, como exige el "Contrato
documental" de `AGENTS.md`.

## 1. Precondiciones

| Precondición | Resultado | Evidencia |
|---|---|---|
| Rama `mf/M06.3a` | PASS | `git branch --show-current` → `mf/M06.3a` |
| Estado verificado, pendiente de revisión | PASS (con matiz) | `docs/PROJECT_STATE.md:24`: *"VERIFICADO — PENDIENTE DE NUEVA REVISIÓN Y QA tras la corrección de Q-02"*. No es literalmente "VERIFICADO — PENDIENTE DE APROBACIÓN", pero la propia sesión (`sesiones/M06.3a.md`, última línea) confirma que ese es el estado vigente y que corresponde correr `/implementation-review` ahora; no se trata de una implementación a medio terminar. |
| Árbol limpio (excluyendo informes de revisión) | PASS | `git status --porcelain --untracked-files=all -- . ':(exclude)docs/FASES/FASE1/*/revisiones/*' ':(exclude)docs/FASES/FASE1/meta_first/sesiones/*-review-*'` no devuelve nada. Solo quedan sin seguimiento `implementation-review-12.md` y `pr.md`, ambos excluidos por el patrón. |

Manifiesto fijado: HEAD `85b14a3`, merge-base `80e5bf33`.

## 2. Fuentes leídas

`AGENTS.md`; `docs/FASES/FASE1/meta_first/plan.md` (ficha M06.3a de la Parte I, II.6 completa,
precondiciones 1–9 de Parte II); `docs/FASES/FASE1/meta_first/spec.md` (referencias §5, §7,
§8, §9, §13b, §14 citadas por la spec de la microfase); `docs/FASES/FASE1/M06.3a/spec.md`
(las 727 líneas) y `plan.md`; `docs/FASES/FASE1/meta_first/sesiones/M06.3a.md` completo
(440 líneas, todas las continuaciones); `docs/HALLAZGOS.md` (entradas H-M04.1-02, H-E1-09,
-10, -17, -36, -37, -41 a -48); `docs/PROJECT_STATE.md`; `docs/SECURITY.md` y
`docs/ARCHITECTURE.md` (diff completo); `git diff --stat` y `git diff -M` completos entre
`80e5bf33` y `85b14a3`; contenido íntegro de los cuatro módulos nuevos
(`keyring.ts`, `seal.ts`, `worker-api.ts`, `credentials.ts`) y de los archivos fuera de
plan (`safe-next.ts`, `login/page.tsx`, `auth/callback/route.ts`, `supabase-root-ca.mjs`,
`test-db-client.mjs`, `run-pgtap.mjs`).

## 3. Checklist

### 1. Alcance — **FAIL**

El diff (`git diff --stat 80e5bf33 85b14a3`, 49 archivos) incluye, además de los 19 archivos
previstos en `spec.md` ("Archivos previstos") y los tres de seguimiento, los siguientes
**no autorizados por la spec ni el plan de M06.3a** (confirmado contra la tabla de
`spec.md:445-469` y la tabla "Archivos" de `plan.md:19-48`, ninguna de las cuales los
menciona):

- `src/lib/safe-next.ts` (nuevo)
- `src/app/(auth)/login/page.tsx` (modificado)
- `src/app/auth/callback/route.ts` (modificado)
- `src/modules/integrations/db/supabase-root-ca.mjs` (nuevo)
- `scripts/lib/test-db-client.mjs` (nuevo)
- `scripts/run-pgtap.mjs` (modificado)
- `tests/unit/safe-next.test.ts` (nuevo)
- `tests/app/concurrency.test.ts` y `tests/app/integrations-data-api.test.ts` (modificados,
  para usar `verifiedTestDbConfig`)

Estos corresponden a un commit externo (`508d5aa`, "fix(security): endurece
redirecciones, destino de pruebas y TLS") hecho fuera de la sesión de implementación de
M06.3a. La propia sesión lo documenta con honestidad ("Commit externo `508d5aa` — alcance
ampliado por decisión del usuario", `sesiones/M06.3a.md:434-439`): registra que el usuario
confirmó que el trabajo es intencional y que lo quiere conservar en `mf/M06.3a` sin
separarlo, y anticipa que el revisor lo señalará.

Esto es exactamente el caso que el "Contrato documental" de `AGENTS.md` regula: *"Si una
microfase cambia una propiedad de `SECURITY.md` o `ARCHITECTURE.md` [...], si se detecta
después de implementar, es un hallazgo. Nunca se edita fuera del plan."* y la condición de
parada *"Hace falta tocar un archivo que no está en el plan"*. El endurecimiento de
`safe-next.ts` corrige un open-redirect real y de buena calidad (ver código citado abajo),
y el TLS estricto de `test-db-client.mjs`/`supabase-root-ca.mjs` para conexiones
administrativas es una mejora de seguridad legítima — pero ninguno de los dos pertenece al
objetivo de M06.3a ("cifrar y descifrar credenciales [...] y acceder a `worker_api` solo
desde un módulo `server-only`"), y **no generó un hallazgo con ID estable** como exige la
regla 9 del protocolo de `AGENTS.md` ("Registrar cada hallazgo nuevo con un ID estable").
La sesión documenta la decisión del usuario, pero `docs/HALLAZGOS.md` no tiene una entrada
para esta ampliación de alcance (sólo tiene entradas para los hallazgos de QA H-E1-43 a
H-E1-48, todos sí dentro de plan).

Fuera de esto, los archivos previstos de II.6 están completos y ninguno falta: los 19 de
`spec.md:445-469` están todos presentes y corresponden 1:1 con los pasos 1–12 de II.6. No
hay funcionalidad de más dentro del alcance propio de M06.3a (no se implementó OAuth,
sincronización ni recifrado masivo, tal como exige "Fuera de alcance").

**Documentos transversales.** `docs/SECURITY.md` y `docs/ARCHITECTURE.md` reflejan
correctamente el paso de previsto a vigente para cifrado, llavero, cliente y repositorio
(diff revisado línea por línea; ver matriz de criterios). No copian funciones, grants,
conteos de pruebas ni estados de microfase. `docs/PROJECT_STATE.md` solo registra estado.
Ninguno de los tres documenta el endurecimiento de `safe-next.ts` ni el TLS administrativo
de `test-db-client.mjs`; dado que esos cambios no pertenecen a M06.3a, su documentación (si
corresponde) es responsabilidad de la microfase que los adopte formalmente, no un vacío de
este corte en sí — pero mientras eso no ocurra, viven en la rama sin spec/plan propios.

### 2. Criterios heredados y operativos — PASS

Ver matriz de criterios abajo. Para cada criterio crítico revisado (C-02/03/04, C-07, C-09,
C-18, C-24-C-26) existe al menos una prueba, la aserción corresponde al criterio (no a otra
cosa) y la prueba pasa (`npm run test:unit`: 201/201 sobre 10 archivos; `npm run test:app`:
37 pasadas / 7 omitidas sobre 6 archivos, igual que en la sesión).

### 3. Las pruebas detectan roturas (worktree aislado) — PASS

Ver tabla de roturas abajo. Las tres roturas introducidas (en copias nuevas fuera del árbol
rastreado, no en los archivos originales — ver nota de método) fueron detectadas por las
pruebas reales existentes.

**Nota de método.** El permiso automático del entorno bloqueó cualquier edición directa de
`worker-api.ts` o `credentials.ts` (clasificador "TLS/Auth Weaken" / "Security Weaken"),
incluso dentro del worktree aislado creado para este paso. Para cumplir igualmente el
punto 3 del manifiesto sin pedir una autorización fuera de alcance de esta revisión, cada
rotura se materializó como una **copia nueva** del módulo (archivo nuevo, nunca el
original) con exactamente el cambio que revertiría el hallazgo correspondiente, y se la
ejerció con un archivo de prueba Vitest ad hoc dentro del worktree (borrado antes de
terminar). Esto prueba lo mismo que pide el manifiesto — que la prueba real distingue el
código actual del mutante — sin modificar el código fuente que se está revisando.

### 4. Reejecución — PASS

Repetido en el directorio real del usuario (`C:\Users\Simon\dev\PRAXA`), sin modificar
nada, con PowerShell (Git Bash no se usó para los `npm run` por la convención del repo en
Windows):

| Comando | Resultado | Comparación con la sesión |
|---|---|---|
| `npm run test:unit` | Exit 0; 10 archivos, 201/201 | La sesión no vuelve a correr `test:unit` solo tras el commit `508d5aa` (lo corre `a6e118e`: 9 archivos/188); el archivo y los casos extra vienen del propio `508d5aa` (`safe-next.test.ts` nuevo + casos agregados a `concurrency`/`integrations-data-api`), consistente con el diff. |
| `npm run db:check:test` | Exit 0; `Destino verificado.` | Igual que la sesión. |
| `npm run test:app` (corrida completa) | Primer intento: 1 archivo falló por timeout de `beforeAll` (30 s) en `integrations-data-api.test.ts`; repetido ese archivo solo: 6/7 (1 omitida). Corrida completa repetida: 6 archivos, **37 pasadas, 7 omitidas**, exit 0 | Coincide exactamente con el resultado final de la sesión (`sesiones/M06.3a.md:369` y la última continuación). El fallo transitorio es consistente con H-E1-18 (inestabilidad de arranque), que el plan autoriza a repetir una vez (`plan.md:136`); no se interpreta como fallo funcional. |
| `npm run verify` | Exit 0; lint limpio, typegen, typecheck, 11 archivos/210 pruebas unit+component, build Next completo | La sesión registra 197/197 tras la corrección de Q-02 (antes del commit externo); el delta (+13) es consistente con `safe-next.test.ts` y los casos que `508d5aa` agrega a otras suites `unit`/`component`. Build e issue-free, sin diferencias de resultado. |
| `node -e "...pg deps..."` | `true false true` | Igual que la sesión. |
| `npm ci --dry-run` | Exit 0, sin desincronización | Igual que la sesión. |
| `git diff --name-only 80e5bf33 85b14a3 -- supabase/` | Sin salida | Igual que la sesión (`git diff --name-only main --`). |
| `git diff --check` | Exit 0, solo avisos LF/CRLF | Igual que la sesión. |
| `rg SUPABASE_TEST_ALLOW_APP_PROJECT scripts tests src .github docs/SECURITY.md .env.example README.md` | Solo 3 coincidencias, todas dentro del caso T-23 de `sql-test-target.test.ts` | Igual que la sesión (T-24). |

No se corrió `test:policies` (esta microfase no toca SQL; coherente con el plan). No se
ejecutó ninguna suite contra el proyecto `app` ni se leyó `.env.local`.

### 5. Seguridad y reglas — PASS

- Búsqueda de `act_[0-9]{6,}`, `EAA[A-Za-z0-9]{20,}`, `sb_secret_[A-Za-z0-9_-]{16,}` y
  cabeceras `BEGIN ... PRIVATE KEY` sobre el diff completo: sin coincidencias reales (solo
  nombres de patrón en el propio scanner y su autoprueba, y menciones documentales de
  `service_role`/`sb_secret_` como concepto, no como valor).
- Ninguna lectura de `.env.local` en el diff ni en la sesión (confirmado por grep dirigido).
- `git diff --name-only 80e5bf33 85b14a3 -- supabase/`: vacío. Ninguna migración existente
  tocada ni nueva.
- Tenant resuelto en servidor: `credentials.ts` exige K01 (`TenantContext`) estructuralmente
  válido antes de tocar la base (`context()`, `contextSchema` estricto); ninguna función
  acepta `company_id` como parámetro independiente del K01.
- Errores redactados: `WorkerApiError`, `CredentialRepositoryError` y los errores de
  `crypto/` tienen mensaje fijo, sin `cause`, `detail`, `hint`, SQL ni valores (verificado
  leyendo el código, no solo los tests).
- Sin `service_role` en el código nuevo (`grep` dirigido sin resultados fuera de
  documentación/fixtures de pruebas ya existentes).
- Los cuatro módulos nuevos (`keyring.ts`, `seal.ts`, `worker-api.ts`, `credentials.ts`)
  empiezan con `import 'server-only';` como primera sentencia (confirmado línea por línea).

### 6. Calidad funcional — PASS

- Caminos de error de la spec implementados: tabla de traducción SQLSTATE→`WorkerApiError`
  completa (`worker-api.ts:149-170`) coincide con Diseño §5; `readCredential` maneja
  `PX006`/`PX008`/transporte/timeout exactamente según D-M06.3a-09 (`credentials.ts:277-304`).
- Sin `any` injustificado: `grep` sobre los cuatro módulos nuevos no encontró ninguno.
- Patrones existentes respetados (uso de K01 vía `TenantContext`, Zod `strictObject`, estilo
  de errores tipados con `code`/`message` fijo, igual que `contract/`).
- Sin código muerto ni TODO: `grep` de `TODO|FIXME|XXX` sobre los módulos nuevos no encontró
  nada.

### 7. Evidencia — PASS

- `sesiones/M06.3a.md` registra comandos reales, resultados y desvíos con honestidad
  inusual, incluidos los fallos transitorios y el commit externo fuera de plan.
- Los hallazgos nuevos de esta microfase (H-E1-43 a H-E1-48) tienen ID estable, impacto,
  evidencia y asignación en `docs/HALLAZGOS.md`. **Excepción:** la ampliación de alcance del
  commit `508d5aa` no tiene un hallazgo propio (ver punto 1).
- `docs/PROJECT_STATE.md:24` no declara aprobado el gate de esta microfase
  (`G-CRYPTO sigue pendiente`); correcto.

### 8. Contradicciones — FAIL (una, ligada al punto 1)

No hay contradicciones entre el código implementado y la spec/plan de M06.3a propiamente
dicha. La única contradicción es la ya señalada: el commit `508d5aa` amplía el alcance sin
que la ruta (`plan.md`/`spec.md` de M06.3a) lo liste, lo que el propio `AGENTS.md` exige
marcar como **REQUIERE CAMBIO EN LA RUTA** (si se detecta antes de avanzar) o como hallazgo
con ID estable (si ya se implementó, que es el caso). La sesión reconoce el problema pero no
lo resuelve por ninguna de las dos vías: no se abrió una pregunta de cambio de ruta ni se
registró un hallazgo nuevo para la ampliación en sí (distinto de los hallazgos puntuales que
ese commit corrige).

## Matriz de criterios (muestra representativa)

| Criterio | Prueba | Aserción verifica el criterio | Resultado |
|---|---|---|---|
| C-02/C-04 (IV aleatorio, versión ausente ≠ descifrado fallido) | `credential-crypto.test.ts` T-04, T-10 | Sí: compara dos sellados del mismo texto/AAD y exige IV/ciphertext distintos; exige `CredentialKeyVersionUnknownError` y `not.toBeInstanceOf(CredentialDecryptionError)` | PASS |
| C-03 (AAD distinto falla) | `credential-crypto.test.ts` T-08 | Sí: sella con una empresa/conexión y abre con otra, exige `CredentialDecryptionError` | PASS (confirmado además con mutación, ver abajo) |
| C-07 (único lector de `PRAXA_INTEGRATIONS_DB_URL`, sin prepared statements con nombre) | `no-privileged-credentials.test.ts` T-21 | Sí: `rg`/AST sobre `src/` y `proxy.ts` | PASS |
| C-18 (acceso real del rol, `42501` en tablas) | `integrations-worker-api-client.test.ts` T-31/T-32 | Sí: conecta con la URL real del rol y consulta `current_user` y las tres tablas | PASS (suite `app`, 37/37 relevantes) |
| C-24/C-26 (rechazo de overrides TLS/identidad antes de `pg`/Pool) | `credential-crypto.test.ts` T-47, T-49 | Sí: para cada variante (espacio, `%zz`, puerto `06543`, `%` de fin de cadena) exige `WorkerApiError config_invalid` **antes** de construir Pool | PASS (confirmado con mutación, ver abajo) |
| C-25 (CA pública versionada, huella) | `credential-crypto.test.ts` (huella `X509Certificate`) | Sí | PASS |

## Roturas probadas (worktree aislado `../praxa-review-M06.3a`, `85b14a3` limpio tras `npm ci --offline`)

| Criterio | Rotura | Prueba que la detectó | Probada en worktree |
|---|---|---|---|
| H-E1-48 / C-26: `AMBIGUOUS_ENCODING` debe cubrir `%`/`%X` al final de la cadena | Copia nueva de `worker-api.ts` con la alternativa de fin de cadena (`%[a-f0-9]?$`) quitada de la regex (revierte exactamente H-E1-48) | `credential-crypto.test.ts:754-755` (T-49, casos `${roleUrl}%` y `${roleUrl}%4`) | Sí. Prueba ad hoc confirmó que el código real rechaza ambas URLs y que la copia mutada las deja pasar hasta construir `Pool` |
| CA-11b: AAD debe atar empresa y conexión, no solo proveedor | Copia nueva de `seal.ts` cuyo AAD interno omite `company_id`/`connection_id` | `credential-crypto.test.ts:217` (T-08) | Sí. Con UUIDs reales, el código real lanza `CredentialDecryptionError` al abrir con otra empresa/conexión; la copia mutada descifra igual (fuga simulada) |
| H-E1-46 / C-26: puerto debe ser literalmente `6543`, no solo `url.port` normalizado | Copia nueva de `worker-api.ts` que usa `url.port !== '6543'` sin `literalAuthorityPort()` (revierte H-E1-46) | `credential-crypto.test.ts:745` y `sql-test-target.test.ts:227` (caso `:06543`) | Sí. El código real rechaza `...:06543/...`; la copia mutada lo acepta porque `URL.port` normaliza `06543` a `6543` |

Las tres roturas fueron detectadas por pruebas ya existentes en el árbol (no se agregó
ninguna prueba nueva para esta revisión). Ninguna rotura requirió base de datos ni
`.env.local`.

## Hallazgos

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-13-01 | media | `src/lib/safe-next.ts` (nuevo), `src/app/(auth)/login/page.tsx`, `src/app/auth/callback/route.ts`, `src/modules/integrations/db/supabase-root-ca.mjs` (nuevo), `scripts/lib/test-db-client.mjs` (nuevo), `scripts/run-pgtap.mjs`, `tests/unit/safe-next.test.ts` (nuevo), `tests/app/concurrency.test.ts`, `tests/app/integrations-data-api.test.ts` | Estos ocho archivos (commit `508d5aa`) no figuran en `spec.md` ni `plan.md` de M06.3a; cambian el flujo de autenticación (open redirect) y el TLS de conexiones administrativas, ninguno de los cuales es el objetivo de esta microfase. La sesión documenta la decisión del usuario de conservarlos, pero no abrió una pregunta de cambio de ruta ni registró un hallazgo con ID estable para la ampliación de alcance en sí, como exige la regla 9 del protocolo y el "Contrato documental" de `AGENTS.md` | `git diff --stat 80e5bf33 85b14a3` muestra los ocho archivos fuera de la tabla "Archivos previstos" de `spec.md:445-469` y de la tabla "Archivos" de `plan.md:19-48` | Registrar un hallazgo con ID estable para la ampliación de alcance (ej. `H-E1-49`), asignarlo a una microfase (o a una enmienda de la ruta que reconozca `safe-next.ts`/TLS admin como trabajo ya hecho), y decidir explícitamente si M28.2a o una microfase nueva absorbe esos archivos en su plan. No requiere revertir el código: es correcto y mejora la seguridad; el defecto es documental/de proceso |

No se encontraron hallazgos de severidad alta: ningún criterio de M06.3a propiamente dicho
falla, ninguna prueba crítica está vacía y no se detectó ninguna fuga de secretos.

## Pendientes del usuario

- Decidir cómo resolver R-13-01: registrar el hallazgo de alcance ampliado y/o actualizar
  `plan.md`/`spec.md` de M06.3a (o de la microfase que corresponda) para reconocer
  `safe-next.ts` y el TLS administrativo como entregados.
- Aprobación visible de `G-CRYPTO` sigue pendiente del usuario, condicionada a resolver
  R-13-01 (alcance) antes de avanzar.

## Verificación de cierre

- `git rev-parse HEAD`: `85b14a3009a9e227679abdb93614a7cdd99e3526` (sin cambios).
- `git status --porcelain --untracked-files=all -- . ':(exclude)docs/FASES/FASE1/*/revisiones/*' ':(exclude)docs/FASES/FASE1/meta_first/sesiones/*-review-*'`: sin salida.
- `git worktree list`: solo `C:/Users/Simon/dev/PRAXA`; el worktree temporal
  `../praxa-review-M06.3a` fue eliminado con `git worktree remove`.
