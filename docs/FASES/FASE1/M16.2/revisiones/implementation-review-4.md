# Revisión de implementación de M16.2 — ronda 4

**Fecha:** 2026-10-17
**Rama y commit revisado:** `mf/M16.2`, `2e6c82a644a61a4ffa6023409098a9ccec05775b`
**Base (merge-base con `main`):** `65404aa100788a4eab5e98dbcfa6c116c8fa0bc1`
**Precondiciones:** rama correcta; `VERIFICADO — PENDIENTE DE APROBACIÓN` en `PROJECT_STATE.md` y en la sesión; el comando de árbol limpio no devuelve nada (el commit incluye la corrección de R-01 de la ronda 1 y los informes 1 a 3).
**Veredicto:** **REQUIERE CAMBIOS** (dos hallazgos de cobertura de pruebas, uno de severidad alta). El código de producción no tiene un defecto funcional demostrado; el problema es que criterios de seguridad quedan sin una prueba que falle cuando se rompen.
**Alcance:** fase A. C-36, C-37, el acta de C-44 y la revocación real de C-41 pertenecen a la fase B y no se evalúan.

## Checklist

| # | Ítem | Estado | Evidencia |
|---|---|---|---|
| 1 | Alcance | PASS | Los 35 archivos no-informe del diff contra la base son exactamente F01–F31 más spec, plan y enmiendas aprobadas de la ruta. Sin funcionalidad extra ni faltante frente a «Implementación requerida». `SECURITY.md` y `ARCHITECTURE.md` cambian solo propiedades y componentes que pasan de previstos a vigentes (sin TTL, nombres de funciones ni conteos). `PROJECT_STATE.md` solo registra estado. |
| 2 | Criterios | **FAIL** | C-03 y C-27 (CA-40, el id completo no llega al HTML) no tienen una aserción que verifique el criterio: ver R-01. C-19 (caso B) y C-09 (un error de la purga no corta el inicio) están cubiertos solo en parte: ver R-02 y R-03. El resto de C-01 a C-46 aplicables tiene aserción pertinente y pasa. |
| 3 | Las pruebas detectan roturas | **FAIL** | De cinco roturas en un worktree aislado, tres fueron detectadas y dos no (R-01, R-02). Ver «Roturas». |
| 4 | Reejecución | PASS | Coincide con la sesión tras la corrección de R-01: `verify` 580/580 y build; pgTAP 482/482; `test:app` 57 pasadas y 7 omitidas ajenas a Meta; `db:check:test` exit 0. Ver «Comandos». |
| 5 | Seguridad y reglas | PASS | Cero coincidencias de token de Meta, JWT, `sb_secret_`, clave privada o `act_` de 6 o más dígitos en los 35 archivos. No se leyó `.env.local`. `git diff 65404aa HEAD -- supabase/migrations supabase/tests` vacío. `META_APP_SECRET` solo en `meta/api.ts` y `scripts/meta-preflight.mjs`. Sin `service_role` en código. K01 se construye en el servidor, la lectura va por RLS, los textos de error son cerrados y los módulos nuevos llevan `server-only`. |
| 6 | Calidad funcional | PASS | Caminos de error de la spec implementados (purga, selección, probe, reautorización A/B, escritura ambigua, desconexión). Sin `any`, `@ts-ignore`, `eslint-disable` ni TODO. Notas menores en R-04. |
| 7 | Evidencia | PASS | La sesión registra comandos, desvíos, omitidas con su motivo, preflight del usuario y la corrección de R-01. `H-E1-118` y `H-E1-119` tienen ID, impacto y asignación. `G-VR01` no figura aprobado. |
| 8 | Contradicciones | PASS | Ninguna con la spec, el plan, la ruta ni `AGENTS.md`. |

## Matriz de criterios

Leí completos `tests/unit/meta-lifecycle.test.ts`, `tests/app/meta-lifecycle.test.ts`, `tests/component/integraciones-meta-tarjeta.test.tsx`, el diff de `tests/unit/meta-oauth.test.ts` y las partes pertinentes de `meta-preflight.test.ts` y `app-data.test.ts`. Las aserciones de `tests/app/meta-oauth.test.ts` y de los componentes modificados las confirmé por el diff y por la corrida, no una a una.

| Criterio | Prueba | ¿La aserción verifica el criterio? | Resultado |
|---|---|---|---|
| C-01, C-02, C-06 | T-01 a T-05 | Sí | Pasa |
| **C-03, C-27** | T-27 (componente) | **No.** Ver R-01 | Pasa, pero no detecta la rotura |
| C-04, C-42 | T-06, T-07 | Sí | Pasa |
| C-05, C-07, C-32 | T-06, T-08 a T-10, T-30, T-36 | Sí | Pasa |
| C-08, C-10, C-11, C-12 | T-11, T-12, T-33, T-34 | Sí | Pasa |
| **C-09** | T-13 | Parcial: orden e inyección sí; «la purga que lanza no corta el inicio» y el espía de `createMetaHttpClient` no. Ver R-03 | Pasa |
| C-13, C-23, C-44 | T-28, T-50 | Sí | Pasa |
| C-14, C-39, C-40 | T-14, T-47 | Sí | Pasa |
| C-15, C-16, C-17, C-18, C-24 | T-15 a T-18, T-31, T-32 | Sí | Pasa |
| **C-19** | T-19, T-52 | Parcial: `initial` solo cubre `debug_token` sin `ads_read`, y la escritura rechazada o ambigua. Faltan `/me` sin negocio, `PX003` y error inesperado; en `reauth`, falta `debug_token` sin `ads_read`. Ver R-02 | Pasa |
| C-20 | T-20 | Sí | Pasa |
| C-21, C-22, C-29 | T-21, T-22, T-23 | Sí (T-23 recorre prueba, confirmación y listado con claves exactas) | Pasa |
| C-25, C-26, C-30, C-31, C-38, C-45, C-46 | T-25 a T-29, T-35, T-46, T-51, T-52 | Sí | Pasa |
| C-28, C-33, C-34, C-35, C-41 | T-24, T-38 a T-42, T-48 | Sí | Pasa |
| C-36, C-37 | T-44, T-45 | Fase B | Sin ejecutar |

## Roturas

Worktree `../praxa-review-M16.2` del commit revisado, `npm ci` y restauración con `git checkout --` tras cada rotura. Eliminado al terminar.

| Criterio | Rotura | Prueba que la detectó | Probada en worktree |
|---|---|---|---|
| C-03/C-27/CA-40 | `loadMetaCardState` devuelve `maskedId: account.id` (id completo) en la lista de cuentas | **Ninguna.** Unit `meta-lifecycle`+`meta-oauth` 206/206 y componente 7/7 pasan | Sí (R-01) |
| C-27/CA-40 | Estado `activa` con `maskedId` tomado de `external_account_id` completo | **Ninguna.** 206/206 | Sí (R-01) |
| C-19 | Callback `initial`: la revocación solo si el error es `TokenRejectedError` | T-52 inicial (3 casos) | Sí |
| C-19 | Callback `initial`: sin revocación si el error es `PX003` (`live_connection_exists`) | **Ninguna.** 172/172 pasan | Sí (R-02) |
| C-19 | Callback `initial`: sin revocación si el error es `MetaApiError` posterior al canje | **Ninguna.** 172/172 pasan | Sí (R-02) |
| C-19 | Callback `initial`: sin ninguna revocación | T-19/T-20 y T-52 (4 fallos) | Sí |
| C-05 | `confirmAccount` ignora el fallo del probe y sigue a `confirm_connection` | T-08 | Sí |

No probé en el worktree el caso C-09 (purga que lanza en `handleMetaStart`); R-03 se basa en la lectura de las pruebas y en una búsqueda: ninguna prueba hace que `list_pending_purges` lance.

## Comandos reejecutados

| Comando | Resultado |
|---|---|
| `npm run db:check:test` | Exit 0, destino desechable verificado (no se copia el identificador). |
| `npm run verify` | Primera corrida: exit 1 por timeouts de workers de Vitest (`Timeout waiting for worker to respond`, 7 errores) mientras corría en paralelo `npm ci` y pruebas del worktree: contención del entorno causada por esta revisión. Repetida sin otra carga: exit 0, 26 archivos, 580/580, lint y typegen sin errores, build de Next correcto. |
| `npm run test:policies` | Exit 0; 13 archivos, 14 ejecuciones, 482/482 aserciones. |
| `npm run test:app` | Exit 0; 9 archivos, 57 pasadas, 7 omitidas opt-in ajenas a Meta (`email-flows` y las guardas inversas de otras suites); `meta-lifecycle` y `meta-oauth` sin omitidas. |
| Búsquedas de patrones, `git diff` de migraciones, comando de árbol limpio | Sin coincidencias ni cambios; ver ítem 5. |

## Hallazgos

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-01 | **alta** | `tests/component/integraciones-meta-tarjeta.test.tsx:24,35`; `src/modules/integrations/lifecycle.ts:181,185,206` | Ninguna prueba verifica que el estado de la tarjeta no lleve el id completo de la cuenta (C-03, C-27, CA-40, T-27). Las aserciones `not.toContain('act_90001')` del componente son vacías: el estado que se le pasa ya trae `maskedId: '…0001'`, así que el componente nunca recibe el id completo. El único lugar donde se enmascara es `loadMetaCardState`, y nada comprueba su salida. | Rotura 1 y 1b: `maskedId: account.id` (pendiente) y `maskedId` con el id completo (activa) → 206/206 y 7/7 en verde. | Agregar una prueba de `loadMetaCardState` (pendiente y activa) que serialice el estado y compruebe que no contiene `act_1001`, `5550001`, `negocio_sintetico` ni el nombre de la cuenta en campos no previstos, y que `maskedId` es el valor truncado. Para el flujo real, la prueba de componente puede alimentarse con la salida de `loadMetaCardState`. Repetir la rotura para confirmar que ahora falla. |
| R-02 | media | `src/modules/integrations/meta/oauth.ts:404`; `tests/unit/meta-oauth.test.ts` (T-19 y T-51) | T-19 exige una revocación en `initial` tras `/me` sin negocio, `PX003` y error inesperado, y T-51 exige otra en `reauth` con `debug_token` sin `ads_read`. Solo se prueba `debug_token` sin `ads_read` en `initial` y los fallos de escritura. Un token válido huérfano es justamente lo que C-19 quiere evitar. | Roturas 2c y 2d (sin revocar con `PX003`; sin revocar con `MetaApiError` posterior al canje) → 172/172 en verde. | Completar T-19 y T-51 con esos casos, con `revokeCalls` igual a 1 en cada uno. |
| R-03 | media | `tests/unit/meta-oauth.test.ts:1222` (T-13) | T-13 pide que, si la purga lanza, el inicio siga y cree el intento, y un espía que garantice que no se crea un cliente Meta real al inyectar dependencias. Ninguna prueba hace lanzar `list_pending_purges` y no hay espía (C-09, C-45). | Búsqueda: todas las respuestas de `list_pending_purges` en las pruebas son listas; ningún `spyOn` de `createMetaHttpClient`. | Agregar el caso de purga que lanza (con `pendiente_vigente` y con intento creado) y el espía del módulo. |
| R-04 | baja | `src/app/(app)/app/integraciones/page.tsx:12-17`; `src/modules/integrations/meta/oauth.ts:23-24,26,38` | El comentario de `page.tsx` sigue diciendo que «Conectar» está deshabilitado porque no hay conector, lo que ya no es cierto para Meta. `oauth.ts` importa dos veces de `../repository/connections` y dos veces de `../lifecycle`. En la escritura ambigua de `reauth` que resulta aplicada no se emite la línea `meta_ciclo reauth ok` que describe el Diseño §11.2; solo queda la línea `meta_oauth` del callback. | Lectura del código. | Actualizar el comentario, unificar los imports y, si se quiere seguir el §11.2 al pie de la letra, emitir esa línea o aclarar en la spec que basta con la de `meta_oauth`. |

## Pendientes del usuario

- Devolver a `/microfase M16.2` con R-01 a R-03 (R-04 opcional); solo se tocan pruebas, sin código de producción salvo que una prueba nueva revele un defecto.
- Commitear en `mf/M16.2` y repetir `/implementation-review M16.2` sobre el commit nuevo. Cualquier cambio posterior obliga también a repetir `/qa-review`; el `qa-review-1` actual no vale para el commit nuevo.
- Fase B (`G-ACTA-META`, P-04, despliegue, VD-01, alta, VR-01 y aprobación de `G-VR01`) sigue pendiente y no depende de esta revisión.

## Confirmaciones finales

- `git rev-parse HEAD` sigue en `2e6c82a644a61a4ffa6023409098a9ccec05775b`.
- El comando de árbol limpio del paso 1 sigue sin devolver nada.
- `git worktree list` muestra solo el directorio principal; el worktree temporal fue eliminado.
- No se modificó ningún archivo salvo este informe.
