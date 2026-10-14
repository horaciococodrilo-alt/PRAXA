# M16.1 — Auditoría de la spec, ronda 4

- **Fecha:** 2026-10-14
- **Commit:** `609ea29` (`main`), con la Enmienda M16.1 de la ruta sin comitear en `docs/FASES/FASE1/meta_first/plan.md` y `spec.md`, y `H-E1-114` y la actualización de `H-E1-23` sin comitear en `docs/HALLAZGOS.md`. Esos tres archivos y la carpeta `docs/FASES/FASE1/M16.1/` son los únicos cambios del árbol.
- **Hash de contenido de la spec** (sin la línea de estado): `5617217350930db2d1a54c8a26269b4220efe59f`
- **Estado de la spec al auditar:** `BORRADOR`
- **Alcance:** la spec de M16.1 (687 líneas, ya con A-18 a A-21 aplicadas) y, porque depende de ella, la Enmienda M16.1 de la ruta (ficha, II.9, nota de II.10 paso 6, III.2, III.3; CA-26, CA-29b, CA-30, CB-06 y fila OAuth de la sección 14). Se releyeron las fuentes completas de la lista del skill y se contrastó el código real. La ronda 3 (`spec-audit-3.md`) se tomó como punto de partida, no como evidencia.
- **Nota de ruta:** la carpeta real es `docs/FASES/FASE1/M16.1/` (el skill dice `MF16.1`).

## Veredicto

**APROBABLE.**

Los 18 ítems están en PASS. No hay contradicciones con la ruta, con el código ni con las microfases siguientes. Las cuatro correcciones de la ronda 3 (A-18 a A-21) están aplicadas; la de A-21(2) quedó incompleta en un borde extremo (A-22). Hay cuatro observaciones de severidad baja (A-22 a A-25): ninguna bloquea ni obliga a rediseñar. Si el usuario decide aplicarlas, el hash cambia y la aprobación se toma sobre el hash nuevo.

## Verificación de la ronda 3

| Hallazgo anterior | Estado | Evidencia |
|---|---|---|
| A-18 (frase "pasos 1 a 8") | Resuelto | Spec, línea 28: "pasos 1 a 10 de II.9 (enmendada)" |
| A-19 (H-S-11 sin cómo/cuándo) | Resuelto | H-S-11: "no se verifica en M16.1 ni en M16.2; es informativa, y ningún criterio ni caso de prueba la usa" |
| A-20 (textos fijos por clase) | Resuelto | §3: `META_FAILURE_TEXTS` exportada por `errors.ts`, tabla de nueve textos; T-07 compara con la constante y fija el literal `Graph 190/460: Meta rechazó la credencial.`. Ningún texto tiene la forma `clave:` ni `clave=` que `redactErrorMessage` reescribiría (`primitives.ts:134-135`) |
| A-21 (tres bordes) | Resuelto en parte | (1) 2xx sin `access_token` válido: §6 y T-19. (3) T-40 compara `searchParams.get('fields')`. (2) `expires_at` inválido: T-18 cubre `1e20`, pero queda un borde parecido (A-22) |

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | La ficha (`plan.md:266`: "CA-28 a CA-34, con CA-29b dividida") figura en "Heredados" con CA-28 a CA-34, CA-29b, CA-02b, CA-02c, CA-04, CA-09, CA-26, CA-35 (primera oración), CA-39 y CB-01 a CB-06. Los resúmenes coinciden con `meta_first/spec.md:126-138`, `:253-255`, `:287-299` y con el diff de la enmienda (CA-26, CA-29b, CA-30, CB-06) |
| 2 | Alcance | PASS | Los diez puntos corresponden a los pasos 1 a 10 de II.9 (`plan.md:595-604`). C-01 a C-31 trazan a un CA, DEC o trampa. "Fuera de alcance" coincide con II.10 pasos 1 a 8 y no excluye nada que la spec exija |
| 3 | Coherencia con la spec general | PASS | Sin contradicciones con CA/DEC/CB. La tabla de §3 coincide con CA-39 más 80000, 80003 y 80014, habilitados por "y los demás de la guía de límites" (`spec.md:295`). Interfaces consumibles por `M16.2` (`ConsumedAttempt.attemptId`, `readLiveConnection`, `exchangeCodeForToken`, `inspectToken`) y por `M16c` (`getJson`, `classifyGraphError`): compatibles con II.10 pasos 1 a 7 |
| 4 | Decisiones | PASS | D-M16.1-01 a D-M16.1-11 figuran con "Usuario" y fecha; las que cambian criterios están en la enmienda (`plan.md:6`, `:606`, `:635`; `meta_first/spec.md:7`) |
| 5 | Trampas | PASS | Las cuatro de II.9 más la quinta (logs del hosting) y la sexta (exposición antes de `M16.2`) = trampas 1 a 4, 8 y 18 de la spec (`plan.md:610-620`) |
| 6 | Intervenciones y acciones reservadas | PASS | P-01 a P-03, "ninguna autorización real" y aprobación de la enmienda coinciden con la ficha (`plan.md:270`) y con III.2 (`:802-803`). Merge, push y despliegue son del usuario, con verificación posterior sin datos reales (`GET` → 405, `POST` sin `Origin` → 403). `db:push` y `db:push:test` "no aplican" con motivo: no hay migración ni pgTAP |
| 7 | Verificación | PASS | III.3 para M16.1 (`plan.md:827`: `test:app` más `verify`, sin autorización real, CB-06 precisado) está en "Verificación"; suma `db:check:test` y `test:unit`. Los cuatro scripts existen en `package.json`. `test:component` (T-23) también existe |
| 8 | Dependencias | PASS | `PROJECT_STATE.md`: `G-ENTORNO` aprobado el 2026-10-11 y M16.1 como siguiente habilitada; M05.1.1 a M06.3a cerradas. `git log` de `main` contiene `2b3e607` (PR #20). `609ea29` solo toca `src/components/landing/herramientas.tsx` |
| 9 | Lo entregado de verdad | PASS | Contrastado con el código: `requireTenantContext` y `tenantContextSchema` (`context.ts:21-66`), `oauthStateSchema`, `BROWSER_BINDING_COOKIE`, `oauthPurposeSchema`, `OAuthAttemptRejectedError` (`oauth-attempt.ts`), `returnPathSchema`, `redactErrorMessage`, `redactedErrorMessageSchema`, `IntegrationErrorClass` (`primitives.ts`), `REQUIRED_SCOPE`, `tokenTypeSchema`, `clientBusinessIdSchema`, `PendingCredentialInput`, `preparePendingConnectionWithCredential`, `executePreparedCredentialOperation`, `replaceCredential`, `readCredential` (`credentials.ts`), `WorkerApiError.failureKind` y la traducción `PX001` a `PX008` (`worker-api.ts:120-142`), `SecretValue`, `getCredentialKeyring`, y las firmas SQL y columnas de retorno de `create_oauth_attempt`, `consume_oauth_attempt` y `create_pending_connection` en `0012` |
| 10 | Pendientes y hallazgos | PASS | `H-E1-13`, `-21`, `-22`, `-23`, `-24`, `-42` y `-114` resueltos o diferidos con motivo en "Hallazgos relacionados"; `H-E1-100` y `H-E1-82` diferidos. Ningún otro hallazgo de `HALLAZGOS.md` está asignado a M16.1. `PROJECT_STATE.md` no tiene pendientes que toquen la microfase |
| 11 | Contexto real | PASS | Verificadas por archivo y línea, sin falsas: `0012_integrations.sql` (389-392, 461-465, 490-507, 519-530, 552-554, 581-590, 621-633, 684-690, 713-716, 728-758, 777-778, 1022-1034, 1067-1069), `worker-api.ts` (9-13, 27-32, 63-76, 120-142, 185-191), `credentials.ts` (27, 153-165, 183-208, 210-215, 247-308), `primitives.ts` (91-94, 101-124, 169-193), `oauth-attempt.ts` (20, 26, 34-39, 45-51, 54, 115-120), `credential.ts:26,32`, `connection.ts:52`, `seal.ts:37-45`, `keyring.ts:90-95`, `app-data/index.ts:87-89`, `integraciones/page.tsx`, `.env.example` (9, 82-94, 104), `env.ts:9-12`, `SECURITY.md` (86-88, 108, 111, 253-254, 312-314), `ARCHITECTURE.md` (61-63, 73, 81, 188, 198-202), `vitest.config.mts:50-56`, `no-privileged-credentials.test.ts:84-121`, `no-secrets-in-tree.test.ts:11-20`, `@supabase/ssr` `constants.js:4-11`, `route.md:669` de Next. No hay `META_*` ni `v26` en `src/` hoy, como supone la spec |
| 12 | Archivos previstos | PASS | Cada archivo está en la tabla de II.9 enmendada, en las rutas sugeridas dentro del módulo, o en las precondiciones 8 y 9. `SECURITY.md` y `ARCHITECTURE.md` figuran porque la microfase cambia INV-06, los controles vigentes y los módulos existentes (contrato documental de `AGENTS.md`). `PROJECT_STATE.md` y `HALLAZGOS.md` son de seguimiento |
| 13 | Diseño suficiente | PASS | Nombres, tipos, errores, parámetros, cookie, TTL, mapeo de resultados y orden de llamadas están definidos; no hay objetos SQL nuevos. Quedan dos detalles sin fijar que el implementador resuelve sin alterar el diseño (A-23, A-24) |
| 14 | Verificable | PASS | Los 31 criterios operativos tienen al menos un caso (T-01 a T-43) con comando real y resultado concreto, con casos negativos y de borde. Faltan bordes menores sin caso (A-22, A-25) |
| 15 | Sin nada abierto | PASS | "Preguntas abiertas" dice "Ninguna" (conserva la fila de Q-08, marcada como resuelta). Cada HIPÓTESIS (H-S-03, -04, -05, -07, -11, -13, -15) dice cómo y cuándo se verifica; H-S-14 declara que la decisión no depende de ella. Los supuestos externos decisivos tienen evidencia oficial fechada (H-S-01, -02, -06, -09, -10) o validación explícita en VR-01 de `M16.2` |
| 16 | Ejecutable ahora | PASS | Ver "Base en verde". Los scripts que usa existen. Las `META_*`, `.env.example` y los archivos nuevos se declaran como lo que crea la microfase. P-01 a P-03 y las variables figuran como declaradas por el usuario (H-S-12); la aprobación de la enmienda y de la spec figuran como precondición. El entorno de `test:app` (proyecto desechable, rol y llavero) lo dejaron `M06.3a` y `G-ENTORNO`; esta auditoría no lo comprobó, porque no se lee `.env.local` |
| 17 | Consistencia interna | PASS | Alcance, diseño, criterios, casos y archivos coinciden. C-04 y T-04 (seis módulos `server-only`) coinciden con §1 (`errors.ts` y `outcomes.ts` puros). C-31, T-40 y T-42 coinciden con §4 a §6. T-18, T-19 y T-40 reflejan A-21 |
| 18 | Reglas no negociables | PASS | K01 construido en el servidor, sin parámetros del navegador (`context.ts:37`). Fixtures sintéticos de menos de 20 caracteres (`no-secrets-in-tree.test.ts:12-13`; `env_secret_assignment` no coincide con `META_APP_SECRET=` vacío). Sin migraciones. `test:app` solo contra el proyecto desechable (`resolveIntegrationsTestTarget`), sin `PRAXA_INTEGRATIONS_DB_URL`. Credenciales solo por `worker_api`; `pg` solo en `worker-api.ts`. Errores con mensaje fijo, sin texto del proveedor ni `cause` (A2x-01) y sin tokens, secretos ni códigos en ninguna URL de salida (A2x-02, D-M16.1-08) |

## Base en verde

`npm run verify` con `powershell -NoProfile`, en el directorio actual (rama `main`, `609ea29`). El árbol no está limpio, pero los cambios sin comitear son solo de documentación; no se usó un worktree.

- `lint`, `typegen`, `typecheck`: sin errores.
- `test`: 21 archivos y 349 pruebas pasan.
- `build`: termina bien (exit 0).

No se corrieron `test:app` ni `db:check:test`: esta auditoría no lee `.env.local`.

## Contradicciones

Ninguna.

## Hallazgos

| ID | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-22 | baja | Diseño §5 (`expiresAt`); T-18 | La regla "fecha válida → `toISOString()`" deja pasar una fecha posterior al año 9999 (por ejemplo `expires_at = 253402300800`). `toISOString()` da `+010000-01-01T00:00:00.000Z`, y `isoDateTimeSchema` (`z.iso.datetime({ offset: true })`, `primitives.ts:12`) la rechaza en `preparePendingConnectionWithCredential` (`credentials.ts:71`) con `CredentialRepositoryError`. El callback termina en `meta=error` con un token ya canjeado (caso B de la trampa 9). Comprobado con `node` y la versión instalada de zod | Spec §5, "`expiresAt`"; T-18 solo cubre `1e20`; `credentials.ts:66-72` | Acotar: `expiresAt` es `null` si el valor es mayor que `253402300799`, o si el resultado no valida con `isoDateTimeSchema`; agregar `253402300800` a T-18 | No |
| A-23 | baja | Diseño §3 | La tabla dice "190 sin subcódigo → `authentication`" y "190 con cualquier otro subcódigo → `unknown`", y A2x-01 dice que un subcódigo no entero da `null`. Un 190 con subcódigo malformado (cadena, negativo, decimal) queda en `null` y, leído literalmente, cae en "sin subcódigo" y da `authentication`, la clase que sí lleva a `needs_reauth`. T-05 no tiene ese caso | Spec §3 (tabla y párrafo A2x-01); T-05 | Aclarar que un subcódigo presente pero inválido da `unknown`, y agregar `190` con subcódigo `"460"` (cadena) a T-05 | No |
| A-24 | baja | Diseño §8 | `META_OAUTH_MESSAGES` tiene un campo `tone` (`'ok' \| 'info' \| 'error'`), pero la tabla de textos no asigna un `tone` a cada resultado, y la página dice `role="alert"` "para `error`" sin aclarar si es el resultado `error` o todo `tone: 'error'`. T-23 solo prueba `cancelado` (status) y `error` (alert) | Spec §8 (tipo y párrafo de `page.tsx`); T-23 | Agregar una columna `tone` a la tabla (por ejemplo `ok`: `pendiente`; `info`: `cancelado`, `conexion_existente`, `pendiente_vigente`, `reautorizacion_no_disponible`; `error`: el resto) y decir que `role="alert"` corresponde a `tone: 'error'` | No |
| A-25 | baja | Diseño §5; T-17 | Una respuesta 2xx de `debug_token` sin objeto `data`, o de `/me` que no es un objeto, no tiene caso ni resultado fijado. La regla "si no, `invalid`" lo cubre por lectura, pero un acceso a `data.is_valid` sobre `undefined` lanzaría `TypeError` y daría `meta=error` en vez de `token_no_valido` | Spec §5 (`inspectToken`, `fetchClientBusinessId`); T-17 | Un caso en T-17: `debug_token` sin `data` y `/me` con cuerpo `null` → `token_no_valido` | No |

## Observaciones que no afectan el veredicto

- **Tamaño.** Probablemente sigue sin caber en 8 horas: ocho módulos nuevos, dos rutas, la página, tres archivos de prueba con unos 43 casos y cinco documentos. Corte natural, que decide el usuario porque cambia la ruta:
  - **M16.1a:** `api.ts`, `errors.ts`, `client.ts` y `tokens.ts` con sus pruebas unitarias (C-01 a C-07, C-17, C-18, C-31).
  - **M16.1b:** repositorios, `oauth.ts`, rutas, aviso, `test:app` y documentación.
- **Tabla "Auditorías".** La fila 4 dice "Pendiente": hay que completarla con este informe. La fila "2 (segunda auditoría)" sigue sin informe propio, y está explicado en la misma fila.
- **Cursores de paginación (para `M16.2` y `M16c`).** Las URLs `paging.next` de Graph traen `access_token` y `getJson` las rechaza por D-M16.1-08: habrá que reconstruir cada página con el cursor `after`. Es coherente con CA-41.
- **Versión de Graph.** H-S-01 (v26.0 vigente) se verificó el 2026-10-12 y la spec manda volver a mirar el changelog al implementar; esta ronda no la volvió a consultar.
- **Reloj en T-27.** Un intervalo de 4 s depende de que el reloj del equipo de pruebas no atrase respecto del de la base más de ese margen. Es el riesgo de relojes ya conocido.
- **`test:app` no corrido.** Las suites omitidas que describe la spec coinciden con las de `tests/app/` (`email-flows` opt-in y bloques `NO EJECUTADA`); no se confirmó con una corrida.
- **Enmienda M16.1 de la ruta.** Sigue sin aprobación visible; la spec la declara como intervención y como precondición. Mientras tanto, `H-E1-23` queda "pendiente de aprobación" (`HALLAZGOS.md:40`).

## Siguiente paso

1. El usuario decide si aplica A-22 a A-25 (bordes menores de redacción y de casos de prueba) o aprueba la spec tal como está. Si aplica correcciones, el hash cambia y la aprobación se toma sobre el hash nuevo.
2. El usuario aprueba de forma visible la Enmienda M16.1 de la ruta y pasa la spec a `APROBADA`.
3. Se sigue con plan mode.
