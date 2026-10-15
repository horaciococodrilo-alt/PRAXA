# M16.1 — Revisión de implementación 1

- **Fecha:** 2026-10-14
- **Commit revisado:** `72ab9227fc6a22d498ed85ad4aac46be18026afd` (`mf/M16.1`)
- **Base (merge-base con `main`):** `609ea2989403682bc6772f5c2401213f0474b37c`
- **Commits en el rango:** `e92c620` (spec, plan, auditorías y Enmienda M16.1 de la ruta) y `72ab922` (implementación)
- **Revisor:** asistente, en modo independiente. No se corrigió código ni documentación, no se hicieron commits ni push y no se ejecutó ningún `db:push`.

## Veredicto

**APROBABLE.** Los 8 ítems están en PASS. No hay hallazgos de severidad alta ni media. Quedan tres observaciones de severidad baja, que no bloquean (ver "Hallazgos").

## Precondiciones

| Precondición | Resultado |
|---|---|
| Rama `mf/M16.1` | Sí |
| Estado `VERIFICADO — PENDIENTE DE APROBACIÓN` | Sí, en `sesiones/M16.1.md` (última línea). `PROJECT_STATE.md` no lo registra, como manda el plan (solo después de `G-OAUTH`) |
| Árbol limpio, salvo informes de revisión | Sí: el comando del paso 1 no devolvió nada, ni al inicio ni al final |

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Alcance | PASS | `git diff --stat -M BASE HEAD`: 32 archivos. Los 19 de implementación y configuración figuran en la tabla "Archivos" del plan de M16.1 (II.9 enmendado). Los de seguimiento (`HALLAZGOS.md`, la sesión) y los del pipeline (spec, plan, `revisiones/`) están autorizados por las precondiciones 8 y 9. Los encabezados de `meta_first/plan.md` y `spec.md` (aprobación visible de la Enmienda M16.1) entraron en el commit de pipeline `e92c620`, por pedido expreso del usuario registrado en la sesión (ver O-01). Ningún archivo de la lista "No se modifican" de la spec cambió: ni `supabase/`, ni `contract/`, ni `worker-api.ts`, ni `credentials.ts`, ni `crypto/`, ni `proxy.ts`, ni las dos guardas, ni `package.json`. No hay funcionalidad de más: no hay selección de cuenta, purga, revocación, `replace_credential` desde el callback, ni "Conectar" habilitado. No falta nada de la "Implementación requerida" de la ficha. **Documentos transversales:** `SECURITY.md` refleja INV-06 acotada, las filas de §4 que pasan a vigentes, §7 vigente/previsto y el límite de §12. `ARCHITECTURE.md` refleja la estructura, la tabla de módulos, el camino B y la sección C. Ninguno incorpora TTL, conteos ni estado de microfases. `PROJECT_STATE.md` no se tocó |
| 2 | Criterios | PASS | Cada criterio heredado y operativo tiene al menos una prueba. Leí las aserciones y verifican el criterio. Todas pasan (ver la matriz) |
| 3 | Las pruebas detectan roturas | PASS | 3 roturas en un worktree aislado del commit revisado. Las 3 fueron detectadas (ver "Roturas") |
| 4 | Reejecución | PASS | `npm run verify`: exit 0, 23 archivos y 510 pruebas. `db:check:test`: destino verificado. `test:app`: exit 0, 8 archivos, 48 pasadas y 7 omitidas, mismo detalle por archivo que la sesión. `meta-oauth.test.ts`: 10/10, ninguna omitida |
| 5 | Seguridad y reglas | PASS | Ver "Seguridad" |
| 6 | Calidad funcional | PASS | Los caminos de error del Diseño §6.1, §6.2 y §6.3 están implementados y probados. No hay `any`, `TODO` ni `FIXME` en el diff de `src/` y `tests/`. Se siguen los patrones existentes (Route Handler que delega, errores con mensaje fijo, repositorio que valida K01 y la respuesta) |
| 7 | Evidencia | PASS | La sesión registra comandos, resultados reales, desvíos (1 a 4) y omisiones por archivo con su motivo. Hallazgos nuevos con ID estable: `H-E1-115` a `H-E1-117`. `G-OAUTH` no figura como aprobado |
| 8 | Contradicciones | PASS | No encontré ninguna entre el código, la spec de M16.1, el plan, la ficha y II.9 enmendado, ni `AGENTS.md` |

## Matriz de criterios

Todas las pruebas unitarias están en `tests/unit/meta-oauth.test.ts`, salvo indicación. "Unit" y "component" corrieron dentro de `npm run verify`; "app" corrió en `npm run test:app`.

| Criterio | Prueba | ¿La aserción verifica el criterio? | Resultado |
|---|---|---|---|
| C-01 (II.9.1) | T-01 | Sí: recorre `src/` y exige `v26.0` solo en `meta/api.ts`; URLs de Graph y del diálogo con `/v26.0/` | Pasa |
| C-02 (CA-28) | T-02 | Sí: conjunto exacto de 6 parámetros, sin `scope`, origen `www.facebook.com` | Pasa |
| C-03 | T-03 | Sí: cada `META_*` ausente o inválida nombra la variable sin el valor; rechaza consulta, fragmento, otra ruta, `http` no local, credenciales y URI relativa; acepta `localhost` y `127.0.0.1` | Pasa |
| C-04 (CA-30) | T-04, T-36 | Sí: `META_APP_SECRET` solo en `api.ts`; sin `NEXT_PUBLIC_META`; los seis módulos empiezan con `import 'server-only';` | Pasa |
| C-05 (CA-39) | T-05 | Sí: tabla caso por caso; estados 200, 403 y 500 dan la misma clase; `asset_access` nunca (barrido de 0 a 3999) | Pasa |
| C-06 (CA-39) | T-06 | Sí: red, timeout de 5 ms y `<html>` dan `transport`; 500 con `{}` da `unknown`; `redirect: 'error'`, `cache: 'no-store'` y `signal` en el `init` | Pasa |
| C-07 (CA-09, CA-26) | T-07 | Sí: texto libre con URL, `clave=valor`, `Bearer` y valores sueltos; ni `message`, `redactedMessage`, `String`, `JSON.stringify` ni `Object.values` los contienen; plantilla exacta; sin `cause` | Pasa |
| C-08 (CA-28, CA-02c) | T-08, T-09, T-25, T-32 (app) | Sí: `initial` sin conexión; `reauth` con `active` o `needs_reauth` y su `id`; `initial` directo con conexión viva da `LiveConnectionExistsError` | Pasa |
| C-09 (CA-01, CA-02b) | T-08, T-25 | Sí: atributos exactos de la cookie, `Max-Age=540`, sin `Domain`; `state` distinto del nonce, 43 caracteres; a la base solo llegan los SHA-256 | Pasa |
| C-10 (CA-04) | T-08 | Sí: `return_path` `/app/integraciones` y vencimiento ≤ 540 s. La validación previa a la base está en `oauth.ts:224` y `attempts.ts` | Pasa |
| C-11 | T-11 | Sí: 403 sin `Origin` o con otro origen, sin llamar a `tenant`; login, `sin_empresa` y `error` sin crear intento; el `route.ts` no exporta `GET`. El 405 y el 403 en producción quedan para el paso 14 (usuario) | Pasa |
| C-12 (CA-30) | T-12, T-15, T-35 (app) | Sí: 303, `Location` exacta sin `code`, `state` ni `error`, `no-referrer`, `no-store` y cookie con `Max-Age=0`, incluido el login | Pasa |
| C-13 (CA-29, CA-03) | T-12, T-13, T-26 a T-31 (app) | Sí: mal formados no llaman a la base ni a Meta; desconocido, vencido, consumido, otro actor, otra empresa y otro nonce dan `rechazado` sin llamar a Meta | Pasa |
| C-14 (CA-34) | T-14 | Sí: con `state` válido consume y da `cancelado`; sin `state` no consume; si el consumo falla, igual da `cancelado`; nunca llama a Meta | Pasa |
| C-15 (`H-E1-24`) | T-16 | Sí: secuencia exacta consumo → canje → `debug_token` → `/me` → `create_pending_connection`; si el consumo falla, nada más | Pasa |
| C-16 (CA-30, CA-33) | T-07, T-19, T-28 (app) | Sí: `client_secret` solo hacia `graph.facebook.com`; un canje por callback | Pasa |
| C-17 (CA-31, CA-32) | T-17, T-34 (app) | Sí: sin `ads_read`, inválido, otra app, `USER`, tipo ausente y `/me` sin negocio no llaman a `create_pending_connection`; la empresa queda sin conexión | Pasa |
| C-18 (CA-31) | T-18, T-20, T-25 | Sí: `expires_at` 0, ausente, `NaN`, `Infinity`, cadena, `1e20`, negativo y fuera de rango dan `null`; epoch exacto; `system_user`, `issued_for_app_id` y permisos | Pasa |
| C-19 (CA-35, CA-10) | T-25 (app) | Sí: `pending_selection`, metadatos nulos, 30 ± 2 min; descifra al token simulado; el cifrado no lo contiene | Pasa |
| C-20 (CA-33) | T-28 (app) | Sí: segundo callback `rechazado`, un solo canje y una sola conexión | Pasa |
| C-21 (CA-29b enmendada) | T-21, T-33 (app) | Sí: sin conexión, otra conexión u otra generación dan `credencial_cambio`; la misma da `reautorizacion_no_disponible`; sin Meta ni `replace_credential`; la credencial no cambia | Pasa |
| C-22 (`H-E1-21`) | T-10, T-32 (app) | Sí: `pendiente_vigente`, sin intento ni llamadas, y la pendiente queda intacta | Pasa |
| C-23 (CA-26) | T-15 | Sí: con el registro por defecto (consola), ninguna línea tiene token, código, `state`, nonce, hashes, secreto ni negocio; solo las claves permitidas | Pasa |
| C-24 | T-20 | Sí: un reintento con argumentos idénticos ante `transport` o `timeout`; dos fallos dan `error`; `PX003` no se reintenta | Pasa |
| C-25 (CA-29, CA-34) | T-22, T-23 (component) | Sí: lista cerrada; `status` y `alert`; desconocido, repetido o ausente no muestran aviso; ningún otro parámetro llega a la página; "Conectar" deshabilitado; sin sesión, rechaza antes de leer `searchParams` | Pasa |
| C-26 (CB-06) | T-24 | Sí. **Comprobado por ejecución en esta revisión:** con `PRAXA_INTEGRATIONS_TEST_DB_URL` inválida, `beforeAll` lanza, el archivo falla y la corrida sale con exit 1. Sin contacto con la base | Pasa |
| C-27 (CA-12) | T-36, T-38 | Sí: `no-secrets-in-tree` y `no-privileged-credentials` en verde; los fixtures tienen menos de 20 caracteres | Pasa |
| C-28 (CB-01, CB-06) | T-37, T-43 | Sí: `verify` en verde con `app-paginas-sesion` sin cambios; `test:app` con exit 0 y `meta-oauth` sin omitidas | Pasa |
| C-29 | T-39 (manual) | Sí: revisé el diff de los cinco archivos. Se limitan al Diseño §11, sin TTL, conteos ni valores; `.env.example` declara 17 variables y tiene 17, y las `META_*` no tienen valores | Pasa |
| C-30 | T-41 | Sí: solo `meta/api.ts` lee `META_*` y empieza con `server-only`. La evidencia no registra ninguna autorización real | Pasa |
| C-31 (INV-06, D-M16.1-08) | T-40, T-42 | Sí: canje y `debug_token` por `POST` de formulario sin consulta; `/me` con `Bearer` y solo `fields`; ningún `GET` a esos endpoints; las barreras rechazan antes de `fetch` | Pasa |
| CB-02 a CB-05 | Revisión del diff y de la sesión | Sí | Pasa |

## Roturas

Worktree temporal `../praxa-review-M16.1`, desacoplado en el commit revisado, con `npm ci`. Cada rotura se restauró con `git checkout -- <archivo>`, y el worktree se eliminó con `git worktree remove`.

| Criterio | Rotura | Prueba que la detectó | ¿Probada en el worktree? |
|---|---|---|---|
| C-13 / CA-29 (aislamiento y replay) | `oauth.ts`: ante `OAuthAttemptRejectedError` en el consumo, el callback sigue como si hubiera consumido un intento `initial` | T-13 (`attempt_rejected` y `not_authorized`) y T-16 ("si el consumo falla no sigue nada"): 3 fallos, 150 pasan | Sí |
| C-31 / A2x-02 (token en URL de salida) | `client.ts`: se anula el chequeo del valor del token bearer en la ruta, la consulta y el fragmento | T-42: 4 fallos (consulta, codificación porcentual, ruta y fragmento), 149 pasan | Sí |
| C-07 / CA-09 (redacción de errores) | `client.ts`: el `MetaApiError` lleva una propiedad propia con `error.message` del proveedor | T-07: 2 fallos (texto libre y código igual al token), 151 pasan | Sí |

No probé ninguna rotura que dependa de la base o de `.env.local`. C-26 se comprobó por ejecución, sin rotura de código (ver la matriz).

## Comandos reejecutados

En el directorio del usuario, sin modificar archivos rastreados:

| Comando | Resultado | Sesión |
|---|---|---|
| `npm run verify` | exit 0: lint, typegen, typecheck, 23 archivos y 510 pruebas (`unit` y `component`), build con `ƒ /api/integraciones/meta/callback` y `ƒ /api/integraciones/meta/iniciar` | Igual (3.ª corrida) |
| `npm run db:check:test` | `Destino verificado.`; los refs coinciden y la confirmación de desechable está presente. El ref no se copia acá | Igual |
| `npx vitest run --project app --reporter=verbose` | exit 0, 8 archivos, 48 pasadas y 7 omitidas | Igual |
| Detalle por archivo | `closure-storage` 1/0; `concurrency` 6/1; `email-flows` 1/3; `integrations-data-api` 6/1; `integrations-worker-api-client` 8/0; `isolation` 9/1; `meta-oauth` 10/0; `onboarding` 7/1 | Igual |
| `PRAXA_INTEGRATIONS_TEST_DB_URL=<inválida> npx vitest run --project app tests/app/meta-oauth.test.ts` | exit 1; `beforeAll` lanza "La URL de conexión no es válida"; el archivo falla | No figura en la sesión (verificación adicional de T-24) |
| `npx vitest run --project unit tests/unit/meta-oauth.test.ts` (worktree, sin roturas entre corridas) | 153/153 de base; fallos esperados con cada rotura | 153/153 |

Las omitidas son solo las que admite CB-06 precisada: el opt-in de correo de `email-flows` y los bloques `NO EJECUTADA`. Vitest no tuvo problemas de carga desde Git Bash (`H-E1-20` no se repitió).

## Seguridad

- **Secretos e identificadores:** la búsqueda por patrón en el diff (`act_` con 6 o más dígitos, `EAA…`, `sb_secret_`, `eyJ…`) encontró solo el fixture sintético `act_` de T-07, ya documentado en la sesión. No hay valores en `.env.example`: la única variable con valor es `NEXT_PUBLIC_SITE_URL`, local y previa a esta microfase.
- **`.env.local`:** ningún archivo nuevo de `src/` lo lee. La suite de aplicación lo carga a través del `setup.ts` existente, como M06.3a. Esta revisión no lo leyó.
- **Migraciones:** `git diff --name-status -M BASE HEAD -- supabase/` está vacío.
- **Tenant:** las dos rutas construyen K01 adentro (`requireTenantContext` por defecto). Ningún `company_id` llega del cliente. `readLiveConnection` filtra por el `company_id` de K01 y lo vuelve a comprobar en la fila.
- **Errores redactados:** `MetaApiError` usa textos fijos por clase; `MetaRequestRejectedError`, `ConnectionReadError`, `AttemptRepositoryError` y `TokenRejectedError` tienen mensajes fijos. El registro tiene formato fijo y solo lleva etapa, resultado, clase y `request_id`.
- **`service_role`:** no aparece en el diff de `src/` ni de `tests/`.
- **`server-only`:** `api.ts`, `client.ts`, `oauth.ts`, `tokens.ts`, `attempts.ts` y `connections.ts`. `errors.ts` y `outcomes.ts` son lógica pura, como dice la spec.

## Hallazgos

No hay hallazgos de severidad alta ni media. Las siguientes son observaciones de severidad baja. No exigen cambios para aprobar.

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-01 (O-01) | baja | `docs/FASES/FASE1/meta_first/plan.md:6`, `spec.md` (encabezado) | El plan de M16.1 (paso 1, "Intervenciones") dice que el usuario actualiza los encabezados de la ruta "previa y externa a los archivos de M16.1". Los actualizó el asistente, por pedido expreso del usuario en el chat | Sesión, paso 1 ("Bloqueo inicial y su resolución"); commit `e92c620` | Ninguna: la autorización del usuario está registrada. Que el usuario lo confirme al aprobar `G-OAUTH` |
| R-02 | baja | `docs/FASES/FASE1/meta_first/sesiones/M16.1.md` (pasos 2 a 4) | El rojo inicial de `tests/app/meta-oauth.test.ts` (TDD) no quedó observado: el clasificador de permisos bloqueó la corrida | La sesión lo declara | Ninguna: es un límite declarado, y la suite falla ante configuración inválida (comprobado en esta revisión) |
| R-03 | baja | `docs/FASES/FASE1/meta_first/sesiones/M16.1.md` (cobertura, C-26) | La sesión acredita T-24 solo por inspección | Esta revisión lo comprobó por ejecución: exit 1 con la URL del rol inválida | Opcional: registrar en la sesión la corrida de esta revisión |

## Pendientes del usuario

- **Paso 14:** merge, push y despliegue. Después, sin autorización real, verificar en producción que `GET /api/integraciones/meta/iniciar` responde 405, que un `POST` sin `Origin` responde 403 y que "Conectar" sigue deshabilitado.
- **Paso 15:** aprobación visible de `G-OAUTH`. Recién entonces se actualiza `PROJECT_STATE.md`.
- **Contención (D-M16.1-06):** ninguna autorización real en el piloto hasta `M16.2` y `G-ACTA-META`.
- `/qa-review M16.1`.

## Comprobaciones finales

- `git rev-parse HEAD`: `72ab9227fc6a22d498ed85ad4aac46be18026afd`, sin cambios.
- El comando de árbol limpio del paso 1 no devuelve nada (este informe queda excluido por ruta).
- `git worktree list`: solo `C:/Users/Simon/dev/PRAXA`. El directorio `../praxa-review-M16.1` no existe.
