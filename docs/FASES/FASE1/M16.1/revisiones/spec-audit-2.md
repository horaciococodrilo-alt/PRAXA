# M16.1 — Auditoría de la spec, ronda 2

- **Fecha:** 2026-10-14
- **Commit:** `609ea29` (`main`), con la Enmienda M16.1 de la ruta sin comitear en `docs/FASES/FASE1/meta_first/plan.md` y `spec.md`, y `H-E1-114` y la actualización de `H-E1-23` sin comitear en `docs/HALLAZGOS.md`
- **Hash de contenido de la spec** (sin la línea de estado): `6d99251d73316ec91dfdac288ffee55478ed650b`
- **Estado de la spec al auditar:** `BORRADOR`
- **Alcance:** la spec de M16.1 y, porque la spec depende de ella, la Enmienda M16.1 de la ruta (ficha, II.9, nota de II.10 paso 6, III.2, III.3; CA-26, CA-29b, CA-30, CB-06 y la fila OAuth de la sección 14)
- **Nota de ruta:** la carpeta real de la microfase es `docs/FASES/FASE1/M16.1/` (el skill dice `MF16.1`). El informe vive junto a `spec-audit-1.md`.

## Veredicto

**REQUIERE CAMBIOS.**

La base está en verde y las ocho correcciones técnicas de la ronda 1 (A-01 a A-12) quedaron bien resueltas. Queda un defecto que impide aprobar y cuatro de redacción:

- un supuesto externo decisivo sin evidencia ni validación prevista: `/me` con el token solo en `Authorization: Bearer` (A-13, media);
- cuatro puntos de redacción o de gating (A-14 a A-17, baja).

## Verificación de la ronda 1

| Hallazgo anterior | Estado | Evidencia |
|---|---|---|
| A-01 (CB-06 y `test:app`) | Resuelto | D-M16.1-09; CB-06 precisada en `meta_first/spec.md` §14 (líneas 548-551) y III.3 de la ruta; C-28, T-43 y "Verificación" ya no dicen "cero omitidas". Las omitidas reales coinciden con `tests/app/*` (`skipIf(canRun)` en 5 archivos, opt-in de `email-flows`) |
| A-02 (login en el callback) | Resuelto | C-12 admite el `303` a `/login?next=%2Fapp%2Fintegraciones`; T-12 incluye el caso sin sesión |
| A-03 (`page.tsx` y `app-paginas-sesion`) | Resuelto | Diseño §8 (`props` sin desestructurar, `requireAppSession` primero); T-37; compatible con `tests/component/app-paginas-sesion.test.tsx:72-77` |
| A-04 (CA-26 y §7 de `SECURITY.md`) | Resuelto | D-M16.1-10; CA-26 enmendada en `meta_first/spec.md:253-255`; §11 ajusta el punto de §7 |
| A-05 (líneas de `plan.md`) | Resuelto | La spec cita por sección |
| A-06 (fixtures de 20 o más caracteres) | Resuelto | §10: `codigo-sint` (11), `token-sint-meta` (15), `secreto-sint` (12), `negocio_sintetico` (17); contrastado con `no-secrets-in-tree.test.ts:13` (`{20,}`) |
| A-07 (`company_id` en `readLiveConnection`) | Resuelto | §7: `.eq('company_id', ctx.company_id)` |
| A-08 (etapas del log y orden de casos) | Resuelto | §6 "Registro" enumera etapas; T-40, T-41 y T-42 en orden |
| A-09 (H-S-03, -05, -07 a VR-01) | Resuelto | Último punto de "Hallazgos relacionados" |
| A-11 (nota en II.10 paso 6) | Resuelto | D-M16.1-11; nota en `plan.md` II.10 paso 6 |
| A-12 (verificación posterior del despliegue) | Resuelto | Fila "Merge, push y despliegue" de la tabla de intervenciones |

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | La ficha (`plan.md`, M16.1: "CA-28 a CA-34, con CA-29b dividida") y II.9 (pasos 1 a 10) figuran en "Heredados" y "Alcance". CA-29b, CA-30, CA-26 y CB-06 se resumen con el texto enmendado de `meta_first/spec.md:128-134`, `:253-255` y `:548-551` |
| 2 | Alcance | PASS | Los 10 puntos del alcance = pasos 1 a 10 de II.9 enmendada. `override_default_response_type`, el reintento único y los códigos 80000/80003/80014 son decisiones no materiales marcadas, con fuente (H-S-02, `M06.3a/spec.md:280`, H-S-10) |
| 3 | Coherencia con la spec general | PASS | Sin contradicciones con CA/DEC/CB. La interfaz que consumirá `M16.2` (`MetaHttpClient`, `classifyGraphError`, `errors.ts` de II.10 paso 7, `postFormJson` para una revocación) es compatible; ver observación sobre cursores de paginación |
| 4 | Decisiones | PASS | D-M16.1-01 a D-M16.1-11 figuran como "Usuario" (2026-10-12 y 2026-10-14). Las que cambian criterios de la ruta (03, 07, 08, 09, 10, 11) están reflejadas en la enmienda |
| 5 | Trampas | PASS | Trampas 1 a 4 de II.9 = trampas 1 a 4 de la spec; la quinta y la sexta de II.9 (logs del hosting y exposición antes de `M16.2`) = trampas 8 y 18 |
| 6 | Intervenciones y acciones reservadas | PASS | P-01 a P-03 y "ninguna autorización real" coinciden con la ficha y con III.2. Merge, push y despliegue tienen verificación posterior sin datos reales. `db:push` y `db:push:test` quedan "no aplican" con motivo (no hay migración ni pgTAP) |
| 7 | Verificación | PASS | III.3 para `M16.1` (`test:app` más `verify`, sin autorización real) está en "Verificación"; suma `db:check:test`, `test:unit` y CB-06 precisada. Todos los comandos existen en `package.json` |
| 8 | Dependencias | PASS | `PROJECT_STATE.md`: `G-ENTORNO` aprobado el 2026-10-11 y M16.1 como siguiente habilitada. `main@609ea29` contiene el merge del PR #20 (`2b3e607`) |
| 9 | Lo entregado de verdad | PASS | Contrastado con el código: K01, `oauthStateSchema`, `BROWSER_BINDING_COOKIE`, `returnPathSchema`, `redactErrorMessage`, `WorkerApiError.failureKind`, `preparePendingConnectionWithCredential`/`executePreparedCredentialOperation`/`replaceCredential`/`readCredential`, `SecretValue`, `tokenTypeSchema`, `REQUIRED_SCOPE` y las firmas SQL de `0012` (`create_oauth_attempt`, `consume_oauth_attempt`, `create_pending_connection`) |
| 10 | Pendientes y hallazgos | PASS | `H-E1-13`, `-21`, `-22`, `-23`, `-24`, `-42`, `-100`, `-114` resueltos o diferidos con motivo. `H-E1-23` queda "pendiente de aprobación" en `HALLAZGOS.md:40`, coherente con D-M16.1-09 |
| 11 | Contexto real | PASS | Verificadas por archivo y línea las referencias a `src/`, `tests/`, `0012_integrations.sql` (490-498, 500-507, 519-530, 552-554, 581-590, 621-633, 713-716, 728-758, 777-778, 1022-1034, 1067-1069), `SECURITY.md` (108, 111, 253-254, 312-314), `ARCHITECTURE.md`, `.env.example`, `M06.3a/spec.md:50` y `:280`, y `route.md:669` de Next. Ninguna es falsa |
| 12 | Archivos previstos | PASS | Cada archivo está en la tabla de II.9 enmendada, en las rutas sugeridas dentro del módulo (preámbulo de la Parte II) o en las precondiciones 8 y 9. `SECURITY.md` y `ARCHITECTURE.md` figuran porque cambian controles vigentes, INV-06 y módulos existentes |
| 13 | Diseño suficiente | PASS | Nombres, tipos, errores, parámetros, cookie, TTL, mapeo de resultados y orden de llamadas están definidos. No hay objetos SQL nuevos |
| 14 | Verificable | PASS | Los 31 criterios operativos tienen al menos un caso (T-01 a T-43) con comando real y resultado concreto; hay casos negativos y de borde (ver A-17 por una redacción ambigua en C-13) |
| 15 | Sin nada abierto | **FAIL** | "Preguntas abiertas" está vacía y H-S-03, -04, -05, -07, -11, -13 dicen cómo y cuándo se verifican. Pero A-13: el uso de `Authorization: Bearer` en `/me` es un supuesto externo decisivo que no tiene evidencia oficial ni validación prevista |
| 16 | Ejecutable ahora | PASS | Ver "Base en verde". Los scripts que usa existen; las `META_*` y los archivos nuevos se declaran como lo que crea la microfase. P-01 a P-03 están declarados cumplidos por el usuario (H-S-12) y la aprobación de la enmienda figura como intervención |
| 17 | Consistencia interna | PASS | Alcance, diseño, criterios, casos y archivos coinciden. Sin contradicciones, salvo la ambigüedad de redacción de A-17 y el texto residual de A-15 |
| 18 | Reglas no negociables | PASS | K01 construido en el servidor, sin parámetros del navegador. Fixtures sintéticos de menos de 20 caracteres. Sin migraciones. `test:app` solo contra el proyecto desechable (`resolveIntegrationsTestTarget`), nunca con `PRAXA_INTEGRATIONS_DB_URL`. Credenciales solo por `worker_api`. Errores con mensaje fijo y redactado |

## Base en verde

`npm run verify` con `powershell -NoProfile`, en el directorio actual (rama `main`, `609ea29`). El árbol no está limpio, pero los cambios sin comitear son solo de documentación (`plan.md`, `spec.md` y `HALLAZGOS.md` de la ruta, y la carpeta `M16.1/`); no se usó un worktree.

- `lint`, `typegen` y `typecheck`: sin errores.
- `test`: 21 archivos y 349 pruebas pasan.
- `build`: la primera corrida abortó con "Another next build process is already running" (un `.next/lock` residual): **BLOQUEO de entorno**, no del código. Repetido `npm run build` solo, termina bien y lista `/app/integraciones` y las demás rutas dinámicas.

No se corrió `test:app` ni `db:check:test`: esta auditoría no lee `.env.local`.

## Contradicciones

Ninguna.

## Hallazgos

| ID | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-13 | media | Diseño §5 (`fetchClientBusinessId`), C-31, T-40, Supuestos | La spec pone el token de `/me` solo en `Authorization: Bearer` (D-M16.1-08). Ningún H-S ni la documentación citada lo respaldan: la página oficial de Facebook Login for Business muestra `/me?fields=client_business_id&access_token=…` en la consulta y ningún ejemplo con encabezado. H-S-13 cubre solo el `POST` del canje y de `debug_token`. Si Meta rechazara el encabezado en VR-01, el token ya canjeado quedaría huérfano (caso B de la trampa 9) | https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business (consultada el 2026-10-14); spec, §5, C-31, H-S-13, trampa 9 | Agregar una hipótesis (por ejemplo, H-S-15): "Graph acepta `Authorization: Bearer` en `/me`". Decir cómo y cuándo se verifica (VR-01, `M16.2`), sumarla al hallazgo agrupado de "Hallazgos relacionados" y a la trampa 21 (si Meta la rechaza, se frena, sin `GET` con el token en la URL) | No: encaja en D-M16.1-08. Solo si el usuario prefiere otra salida para `/me` |
| A-14 | baja | Diseño §8 (`pendiente_vigente`), §6.1 paso 4 | El texto promete "Vence a los 30 minutos de creada; después vas a poder iniciar otra", pero `readLiveConnection` no lee `pending_expires_at` y la purga es de `M16.2`: una pendiente vencida sin purgar sigue dando `pendiente_vigente` y `create_oauth_attempt` seguiría rechazando con `PX003` | `0012_integrations.sql:581-590`; D-M16.1-04; spec §7 | Quitar la promesa del texto (por ejemplo, "Tenés una conexión con Meta pendiente de confirmar.") o decir en el diseño que el vencimiento sin purga es un límite de `M16.1` | No |
| A-15 | baja | "Auditorías", "Verificación" | "Auditorías" dice "Ninguna todavía", pero existe `spec-audit-1.md`. La "Verificación" no exige la aprobación de la enmienda y de la spec antes de modificar archivos, aunque la implementación depende del texto enmendado | `M16.1/revisiones/spec-audit-1.md`; plan.md línea 6 (enmienda pendiente) | Actualizar "Auditorías" con las rondas 1 y 2. En "Antes de modificar archivos", agregar: Enmienda M16.1 aprobada de forma visible y spec en `APROBADA` | No |
| A-16 | baja | Diseño §11 (INV-06 propuesto) | El texto propuesto dice "Ni tokens, ni códigos OAuth… aparecen en el navegador fuera de la redirección del flujo". Leído literalmente, deja entrar a los tokens en la redirección, y el token nunca llega al navegador (§7 de `SECURITY.md`) | Spec §11; `SECURITY.md:86-88` | Separar: el token nunca llega al navegador; el código y el `state` pasan por la redirección del proveedor al callback | No |
| A-17 | baja | C-13, §6.2 | C-13 dice que con `state` o cookie mal formados "no llama a la base ni a Meta", pero el paso 2 construye K01 antes (lee `company_members` por RLS). T-12 solo comprueba `consumeOAuthAttempt` y `fetch` | Spec §6.2 pasos 2 y 4; `src/modules/tenant/context.ts:37-66` | Escribir "no llama a `worker_api` ni a Meta" | No |

## Observaciones que no afectan el veredicto

- **Tamaño.** Probablemente sigue sin caber en 8 horas: ocho módulos nuevos, dos rutas, la página, tres archivos de prueba con unos 43 casos y cinco documentos. Corte natural, que decide el usuario porque cambia la ruta:
  - **M16.1a:** `api.ts`, `errors.ts`, `client.ts` y `tokens.ts` con sus pruebas unitarias (C-01 a C-07, C-17, C-18, C-31).
  - **M16.1b:** repositorios, `oauth.ts`, rutas, aviso, `test:app` y documentación.
- **Cursores de paginación (para `M16.2`).** Las URLs `paging.next` de Graph traen `access_token` en la consulta, y `getJson` las rechaza por D-M16.1-08. `M16.2` y `M16c` tendrán que reconstruir cada página con el cursor `after`. Es coherente con CA-41 y no obliga a cambiar esta spec.
- **`closure-storage.test.ts`.** Su `describe.skipIf(blocked || !reachable)` no tiene bloque `NO EJECUTADA`. La spec no lo lista entre las omisiones admitidas, así que, si se omitiera, T-43 correctamente lo trataría como falla.
- **`src/lib/supabase/server.ts:9-10`.** Mantiene la misma afirmación que `H-E1-42`; no está asignado a `M16.1`.
- **Evidencia externa.** `override_default_response_type=true`, `response_type=code` y `client_business_id` se confirmaron en la página oficial de Facebook Login for Business (2026-10-14).

## Siguiente paso

1. Aplicar a la spec las correcciones técnicas: A-13 a A-17.
2. No hay decisiones nuevas del usuario, salvo que quiera otra salida para `/me` (A-13) o partir la microfase.
3. Volver a auditar (ronda 3) la spec y la enmienda juntas.
