# M16.1 — Auditoría de la spec, ronda 3

- **Fecha:** 2026-10-14
- **Commit:** `609ea29` (`main`), con la Enmienda M16.1 de la ruta sin comitear en `docs/FASES/FASE1/meta_first/plan.md` y `spec.md`, y `H-E1-114` y la actualización de `H-E1-23` sin comitear en `docs/HALLAZGOS.md`
- **Hash de contenido de la spec** (sin la línea de estado): `160a305ca3a5c71d69885fede08d99dbe41839b9`
- **Estado de la spec al auditar:** `BORRADOR`
- **Alcance:** la spec de M16.1 y, porque la spec depende de ella, la Enmienda M16.1 de la ruta (ficha, II.9, nota de II.10 paso 6, III.2, III.3; CA-26, CA-29b, CA-30, CB-06 y la fila OAuth de la sección 14). Incluye los dos puntos `A2x-01` y `A2x-02`, que se agregaron a la spec después de `spec-audit-2.md` y no tenían informe.
- **Nota de ruta:** la carpeta real es `docs/FASES/FASE1/M16.1/` (el skill dice `MF16.1`).

## Veredicto

**APROBABLE.**

Los 18 ítems están en PASS. Las cinco correcciones de la ronda 2 (A-13 a A-17) están aplicadas, y `A2x-01` y `A2x-02` son consistentes con el resto de la spec y con el código. Quedan cuatro observaciones de severidad baja (A-18 a A-21): ninguna obliga a inventar nada importante ni bloquea la implementación. Si el usuario decide aplicarlas, el hash de la spec cambia y la aprobación tiene que tomarse sobre el hash nuevo.

## Verificación de la ronda 2

| Hallazgo anterior | Estado | Evidencia |
|---|---|---|
| A-13 (`Authorization: Bearer` en `/me`) | Resuelto | H-S-15 (hipótesis, verificación en VR-01 de `M16.2`); sumada a la trampa 21, a D-M16.1-08 y al hallazgo agrupado de "Hallazgos relacionados" |
| A-14 (texto de `pendiente_vigente`) | Resuelto | §8: "Tenés una conexión con Meta pendiente de confirmar."; §6.1 paso 4 declara el límite de que `readLiveConnection` no lee `pending_expires_at` |
| A-15 ("Auditorías" y precondición de la enmienda) | Resuelto | Tabla "Auditorías" con las rondas 1 y 2; "Verificación" exige la enmienda aprobada y la spec en `APROBADA` |
| A-16 (INV-06 propuesto) | Resuelto | §11: el token nunca llega al navegador; solo el código y el `state` pasan por la redirección |
| A-17 (C-13) | Resuelto | C-13: "no llama a `worker_api` ni a Meta (K01 ya leyó la membresía por RLS)" |

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | La ficha (`plan.md`, M16.1: "CA-28 a CA-34, con CA-29b dividida") figura en "Heredados" con CA-28 a CA-34, CA-29b, CA-02b, CA-02c, CA-04, CA-09, CA-26, CA-35 (primera oración), CA-39 y CB-01 a CB-06; resúmenes fieles al texto de `meta_first/spec.md:126-138`, `:253-255`, `:287-299`, `:543-551` |
| 2 | Alcance | PASS | Los 10 puntos del alcance corresponden a los pasos 1 a 10 de II.9 enmendada. Cada C-01 a C-31 traza a un CA, DEC o trampa. Ver A-18 por el texto introductorio |
| 3 | Coherencia con la spec general | PASS | Sin contradicciones con CA/DEC/CB. La tabla de §3 coincide con CA-39 (más 80000, 80003 y 80014, habilitados por "y los demás de la guía de límites"). `MetaHttpClient`, `classifyGraphError` y `postFormJson` son compatibles con lo que consumirán `M16.2` y `M16c` (CA-41, CA-57) |
| 4 | Decisiones | PASS | D-M16.1-01 a D-M16.1-11 figuran con "Usuario" y fecha; las que cambian criterios (03, 07, 08, 09, 10, 11) están en la enmienda (`plan.md:6`, `:606`, II.10 paso 6; `meta_first/spec.md:7`) |
| 5 | Trampas | PASS | Las cuatro trampas de II.9 más la quinta (logs del hosting) y la sexta (exposición antes de `M16.2`) = trampas 1 a 4, 8 y 18 de la spec |
| 6 | Intervenciones y acciones reservadas | PASS | P-01 a P-03 y "ninguna autorización real" coinciden con la ficha y con III.2. Merge, push y despliegue son del usuario, con verificación posterior sin datos reales (`GET` → 405, `POST` sin `Origin` → 403). `db:push` y `db:push:test` "no aplican" con motivo: no hay migración ni pgTAP |
| 7 | Verificación | PASS | III.3 para M16.1 (`test:app` más `verify`, sin autorización real) está en "Verificación"; suma `db:check:test`, `test:unit` y la CB-06 precisada. Los cuatro scripts existen en `package.json` |
| 8 | Dependencias | PASS | `PROJECT_STATE.md`: `G-ENTORNO` aprobado el 2026-10-11 y M16.1 como siguiente habilitada. `git log` de `main` contiene `2b3e607` (PR #20) |
| 9 | Lo entregado de verdad | PASS | Contrastado con el código: `requireTenantContext`, `tenantContextSchema`, `oauthStateSchema`, `BROWSER_BINDING_COOKIE`, `oauthPurposeSchema`, `OAuthAttemptRejectedError`, `returnPathSchema`, `IntegrationErrorClass`, `redactErrorMessage`/`redactedErrorMessageSchema`, `REQUIRED_SCOPE`, `tokenTypeSchema`, `clientBusinessIdSchema`, `WorkerApiError.failureKind`, `preparePendingConnectionWithCredential`, `executePreparedCredentialOperation`, `replaceCredential`, `readCredential`, `SecretValue`, `getCredentialKeyring`, y las firmas SQL de `0012` |
| 10 | Pendientes y hallazgos | PASS | `H-E1-13`, `-21`, `-22`, `-23`, `-24`, `-42`, `-100` y `-114` resueltos o diferidos con motivo en "Hallazgos relacionados"; `H-E1-23` queda "pendiente de aprobación" en `HALLAZGOS.md:40`, coherente con D-M16.1-09 |
| 11 | Contexto real | PASS | Verificadas por archivo y línea: `0012_integrations.sql` (389-392, 461-465, 490-507, 519-530, 552-554, 581-590, 621-633, 713-716, 728-731, 777-778, 1022-1034, 1067-1069), `src/` (tenant, company, identity, contract, db, repository, crypto, proxy, `auth/callback`, `signout`, `verify-email`, página de integraciones, `app-data`, `env.ts`), `.env.example` (9, 82, 94, 104), `SECURITY.md` (86-88, 108, 111, 253-254, 312-314), `ARCHITECTURE.md` (61-63, 73, 81, 188, 198-202), `tests/` (`vitest.config.mts:50-56`, `helpers.ts`, suites de `no-secrets` y `no-privileged-credentials`), `M06.3a/spec.md:50` y `:280`, y `route.md:669` de Next. Ninguna es falsa. `next.config.ts` no configura `logging.fetches` (trampa 7) |
| 12 | Archivos previstos | PASS | Cada archivo está en la tabla de II.9 enmendada, en las rutas sugeridas dentro del módulo o en las precondiciones 8 y 9. `SECURITY.md` y `ARCHITECTURE.md` figuran porque la microfase cambia INV-06, controles vigentes y módulos existentes |
| 13 | Diseño suficiente | PASS | Nombres, tipos, errores, parámetros, cookie, TTL, mapeo de resultados y orden de llamadas están definidos; no hay objetos SQL nuevos. Quedan detalles menores sin fijar (A-20, A-21), que el implementador resuelve sin ambigüedad de diseño |
| 14 | Verificable | PASS | Los 31 criterios operativos tienen al menos un caso (T-01 a T-43) con comando real y resultado concreto, con casos negativos y de borde (carrera, otro actor, otra empresa, otro nonce, vencido, reutilizado, `reauth` con generación vieja, POST sin `Origin`). Ver A-21 por bordes sin caso |
| 15 | Sin nada abierto | PASS | "Preguntas abiertas" dice "Ninguna" (solo conserva la fila de Q-08, marcada como resuelta). H-S-03, -04, -05, -06, -07, -08, -13 y -15 dicen cómo y cuándo se verifican (VR-01 en `M16.2`). H-S-14 declara que la decisión no depende de ella. H-S-11 no dice cómo se verifica (A-19, baja: la spec afirma que CA-33 no depende de ella) |
| 16 | Ejecutable ahora | PASS | Ver "Base en verde". Los scripts que usa existen; las `META_*`, `.env.example` y los archivos nuevos se declaran como lo que crea la microfase. P-01 a P-03 y las variables están declarados cumplidos por el usuario (H-S-12); la aprobación de la enmienda figura como intervención |
| 17 | Consistencia interna | PASS | Alcance, diseño, criterios, casos y archivos coinciden. C-31, T-40 y T-42 coinciden con §4 y §5. "Fuera de alcance" no excluye nada que la spec exija. Ver A-18 por una frase introductoria |
| 18 | Reglas no negociables | PASS | K01 construido en el servidor, sin parámetros del navegador. Fixtures sintéticos de menos de 20 caracteres (`no-secrets-in-tree.test.ts:13`). Sin migraciones. `test:app` solo contra el proyecto desechable (`resolveIntegrationsTestTarget`), sin `PRAXA_INTEGRATIONS_DB_URL`. Credenciales solo por `worker_api`. Errores con mensaje fijo, sin texto del proveedor ni `cause` (A2x-01) y sin tokens, secretos ni códigos en ninguna URL de salida (A2x-02, D-M16.1-08) |

## Base en verde

`npm run verify` con `powershell -NoProfile`, en el directorio actual (rama `main`, `609ea29`). El árbol no está limpio, pero los cambios sin comitear son solo de documentación (`plan.md`, `spec.md` y `HALLAZGOS.md` de la ruta, y la carpeta `M16.1/`); no se usó un worktree.

- `lint`, `typegen`, `typecheck`: sin errores.
- `test`: 21 archivos y 349 pruebas pasan.
- `build`: termina bien (exit 0).

No se corrieron `test:app` ni `db:check:test`: esta auditoría no lee `.env.local`. Las suites omitidas de `tests/app/` coinciden con las que describe la spec (`skipIf`/`NO EJECUTADA` en `concurrency`, `email-flows`, `integrations-data-api`, `isolation` y `onboarding`; `closure-storage` con `skipIf(blocked || !reachable)`).

## Contradicciones

Ninguna.

## Hallazgos

| ID | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-18 | baja | Alcance (frase introductoria) | La frase dice "de los pasos 1 a 8 de II.9", pero la lista tiene diez puntos y los puntos 9 y 10 vienen de los pasos 9 y 10 | Spec, línea 28 y puntos 9 y 10; `plan.md` II.9 | Escribir "de los pasos 1 a 10 de II.9" | No |
| A-19 | baja | Supuestos (H-S-11) | Es la única HIPÓTESIS sin "cómo y cuándo se verifica" | Spec, H-S-11 | Agregar "No se verifica: informativa; CA-33 la garantiza el consumo único del intento", o "VR-01" | No |
| A-20 | baja | Diseño §3; C-07; T-07 | `redactedMessage` es "exactamente la plantilla fija de la clase", pero solo se dan dos textos de ejemplo; los nueve textos por `IntegrationErrorClass` quedan a criterio del implementador, y la prueba no puede fijar el valor esperado | Spec §3 ("textoFijoDeLaClase una constante por `IntegrationErrorClass`"); T-07 | Decir que los textos son una constante exportada por `errors.ts` y que T-07 la compara con esa constante, evitando `clave:` como `token:` o `code:` que `redactErrorMessage` reescribiría (`primitives.ts:131-134`) | No |
| A-21 | baja | Diseño §5 y §6; T-18; T-40 | Tres bordes sin definir: (1) un 2xx del canje sin `access_token` válido, cuyo error no es un `MetaApiError` y cae en "excepción no prevista" (`meta=error`) sin caso de prueba; (2) un `expires_at` fuera de rango hace lanzar `toISOString`; (3) T-40 dice "consulta exactamente `fields=id,client_business_id`", pero `URLSearchParams` codifica la coma como `%2C` | Spec §5 (`expiresAt`), §6 (`exchangeCodeForToken`), T-40 | Un caso en T-19 para el 2xx sin `access_token` (resultado `error` o `token_no_valido`, a elegir); acotar `expires_at` a un rango válido o a `null`; en T-40, comparar `searchParams.get('fields')` | No |

## Observaciones que no afectan el veredicto

- **Tamaño.** Probablemente sigue sin caber en 8 horas: ocho módulos nuevos, dos rutas, la página, tres archivos de prueba con unos 43 casos y cinco documentos. Corte natural, que decide el usuario porque cambia la ruta:
  - **M16.1a:** `api.ts`, `errors.ts`, `client.ts` y `tokens.ts` con sus pruebas unitarias (C-01 a C-07, C-17, C-18, C-31).
  - **M16.1b:** repositorios, `oauth.ts`, rutas, aviso, `test:app` y documentación.
- **Cursores de paginación (para `M16.2` y `M16c`).** Las URLs `paging.next` de Graph traen `access_token`, y `getJson` las rechaza por D-M16.1-08: habrá que reconstruir cada página con el cursor `after`. Es coherente con CA-41.
- **`closure-storage.test.ts`.** No tiene bloque `NO EJECUTADA`; la spec no lo lista entre las omisiones admitidas, así que, si se omitiera, T-43 correctamente lo trataría como falla.
- **"Preguntas abiertas".** Conserva la tabla de `M16.1-Q-08` ya resuelta; es inocua, pero puede moverse a "Decisiones".
- **"Auditorías".** La fila "2 (segunda auditoría)" no tiene informe propio; la fila 3 tiene que actualizarse con este informe.
- **Reloj en T-27.** Un intervalo de 4 s depende de que el reloj del equipo de pruebas no atrase respecto del de la base más de ese margen (`create_oauth_attempt` rechaza `expires_at <= now()`). Es el riesgo de relojes ya conocido.
- **Enmienda M16.1 de la ruta.** Sigue sin aprobación visible; la spec la declara como intervención y como precondición.

## Siguiente paso

1. El usuario decide si aplica A-18 a A-21 (solo redacción y bordes menores) o aprueba la spec tal como está. Si aplica correcciones, el hash cambia y la aprobación se toma sobre el hash nuevo.
2. El usuario aprueba de forma visible la Enmienda M16.1 de la ruta y pasa la spec a `APROBADA`.
3. Se sigue con plan mode.
