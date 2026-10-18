# Revisión de implementación de M16.2 — ronda 5

**Fecha:** 2026-10-17
**Rama y commit revisado:** `mf/M16.2`, `89a41b193a7c56015bcaf5f8cbff15a24dfa0bfa`
**Base (merge-base con `main`):** `65404aa100788a4eab5e98dbcfa6c116c8fa0bc1`
**Precondiciones:** rama correcta; `VERIFICADO — PENDIENTE DE APROBACIÓN` en `PROJECT_STATE.md` y en la sesión; el comando de árbol limpio del paso 1 no devuelve nada.
**Veredicto:** **APROBABLE**. Los cuatro hallazgos de la ronda 4 (R-01 a R-04) están corregidos y ahora las pruebas detectan las roturas que antes pasaban en verde. No hay hallazgos nuevos de severidad alta ni media.
**Alcance:** fase A. C-36, C-37, el acta de C-44 y la revocación real de C-41 pertenecen a la fase B y no se evalúan.
**Orden de la ronda:** el diff de corrección es `2e6c82a..89a41b1`: 3 archivos de producción (`page.tsx` solo comentario, `lifecycle.ts` una línea de log, `oauth.ts` imports), 2 de pruebas y 4 de seguimiento. Revisé también el diff completo contra la base.

## Checklist

| # | Ítem | Estado | Evidencia |
|---|---|---|---|
| 1 | Alcance | PASS | Los archivos del diff contra la base son F01–F31 más spec, plan y enmiendas aprobadas de la ruta, más los informes de revisión. Sin funcionalidad extra. `SECURITY.md` y `ARCHITECTURE.md` reflejan controles y componentes que pasan de previstos a vigentes, sin TTL, nombres de funciones ni conteos. `PROJECT_STATE.md` solo registra estado. La corrección de la ronda 4 solo tocó F08, F10, F14, F16, F18 y seguimiento. |
| 2 | Criterios | PASS | Ver matriz. Los tres criterios con hueco en la ronda 4 (C-03/C-27, C-19, C-09) tienen ahora aserciones que verifican el criterio. |
| 3 | Las pruebas detectan roturas | PASS | 13 roturas en un worktree aislado del commit revisado: las 13 fueron detectadas por una prueba (ver «Roturas»). Una rotura inicial de C-10 resultó un mutante equivalente (la excepción la capturaba el `try` interno); la rehice y fue detectada. |
| 4 | Reejecución | PASS | Coincide con la sesión: `verify` 26 archivos y 589/589, pgTAP 482/482, `test:app` 57 pasadas y 7 omitidas ajenas a Meta, `db:check:test` exit 0. Ver «Comandos». |
| 5 | Seguridad y reglas | PASS | Cero coincidencias nuevas de token de Meta, JWT, `sb_secret_`, clave privada o `act_` de 6 o más dígitos en `src`, `scripts` y `tests` (las dos coincidencias son las guardas preexistentes `no-secrets-in-tree` y `supabase-key-formats`, que definen los patrones y no están en el diff). No se leyó `.env.local`. `git diff --name-status -M 65404aa HEAD -- supabase` vacío: ninguna migración creada, modificada ni renombrada. Cero `service_role`, `any`, `@ts-ignore`, `eslint-disable`, TODO o FIXME en las líneas agregadas de `src` y `scripts`. K01 se construye en el servidor (`actions.ts` solo lee el campo `cuenta`; `requireTenantContext` en los módulos), la lectura va por RLS, los textos de error son cerrados y los módulos nuevos llevan `server-only`. |
| 6 | Calidad funcional | PASS | Caminos de error de la spec implementados: purga que falla, probe fallido, vencimiento, reautorización A/B, escritura ambigua con relectura, desconexión intercalada, `NEXT_REDIRECT` fuera del `try`. Los imports duplicados y el comentario obsoleto de la ronda 4 están corregidos. La línea `meta_ciclo reauth ok` se emite ahora al resolverse como aplicada una escritura ambigua. |
| 7 | Evidencia | PASS | La sesión registra comandos, resultados, desvíos y omitidas con motivo, incluida la sección de correcciones de la ronda 4 y el rojo previo de T-52. `H-E1-120` a `H-E1-123` tienen ID, impacto, evidencia y asignación. `G-VR01` no figura aprobado; el gate de esta microfase no está aprobado en `PROJECT_STATE.md`. |
| 8 | Contradicciones | PASS | Ninguna con la spec, el plan, la ruta ni `AGENTS.md`. |

## Matriz de criterios

Leí completas las pruebas modificadas o agregadas en la corrección (T-27, T-13, T-19, T-51, T-52), y el resto por el diff y por las roturas. Para los demás criterios me apoyo en la matriz de la ronda 4, que no cambió (solo se agregaron pruebas), y en que toda la suite sigue en verde.

| Criterio | Prueba | ¿La aserción verifica el criterio? | Resultado |
|---|---|---|---|
| C-01, C-02, C-06 | T-01 a T-05 | Sí | Pasa |
| C-03, C-27, C-42 | T-27 (`loadMetaCardState`, pendiente y activa), T-06, T-07 | Sí: compara el estado completo con `maskedId` truncado exacto y exige que la serialización no contenga el id completo, el system user ni el negocio. Detecta las dos roturas de la ronda 4 | Pasa |
| C-04, C-05, C-07, C-32 | T-06, T-08 a T-10, T-30, T-36 | Sí | Pasa |
| C-08, C-10, C-11, C-12 | T-11, T-12, T-33, T-34 | Sí | Pasa |
| C-09, C-45 | T-13 (con purga que lanza, sin conexión y con pendiente vigente; espía de `createMetaHttpClient`) | Sí: comprueba orden de llamadas, registro `purga fallida`, creación o no del intento, y que no se construye el cliente por defecto | Pasa |
| C-13, C-23, C-44 | T-28, T-50 | Sí | Pasa |
| C-14, C-39, C-40 | T-14, T-47 | Sí | Pasa |
| C-15 a C-18, C-20, C-24 | T-15 a T-18, T-20, T-31, T-32 | Sí | Pasa |
| C-19 | T-19 (cinco casos en `initial`: `debug_token` sin `ads_read`, `/me` sin negocio, `/me` con error de Graph, `PX003`, error inesperado de escritura), T-51 (reauth sin `ads_read`), T-18, T-52 | Sí: cada caso exige exactamente una revocación y el token ausente de los logs | Pasa |
| C-21, C-22, C-29 | T-21, T-22, T-23 | Sí | Pasa |
| C-46 | T-52 | Sí: exige la línea `meta_ciclo reauth ok` solo si la relectura confirma la escritura | Pasa |
| C-25, C-26, C-30, C-31, C-38 | T-25 a T-29, T-35, T-46 | Sí | Pasa |
| C-28, C-33, C-34, C-35, C-41 | T-24, T-38 a T-42, T-48 | Sí | Pasa |
| C-36, C-37 | T-44, T-45 | Fase B | Sin ejecutar |

## Roturas

Worktree `../praxa-review-M16.2` del commit revisado, `npm ci`, restauración con `git checkout --` tras cada rotura. Pruebas unitarias solamente, sin base ni variables de entorno. Eliminado al terminar.

| Criterio | Rotura | Prueba que la detectó | Probada en worktree |
|---|---|---|---|
| C-03/C-27/CA-40 | `loadMetaCardState` pendiente devuelve `maskedId: account.id` | T-27 | Sí |
| C-03/C-27/CA-40 | Estado `activa` con `maskedId` tomado del id completo | T-27 | Sí |
| C-19 | `initial`: sin revocar si el error es `PX003` | T-19 «tras PX003 al crear pendiente» | Sí |
| C-19 | `initial`: sin revocar si el error es `MetaApiError` posterior al canje | T-19 «tras /me con error de Graph» | Sí |
| C-19 | `reauth`: sin revocar ante `TokenRejectedError` de la inspección | T-51 «revoca el token nuevo si reauth no obtiene ads_read» | Sí |
| C-19 | `reauth`: sin revocar tras fallo de escritura | T-18 (5 casos) | Sí |
| C-46 | Quitar la línea `meta_ciclo reauth ok` de la escritura ambigua aplicada | T-52 | Sí |
| C-09 | Una purga que lanza corta el inicio (se relanza) | T-13 (sin conexión y pendiente vigente) | Sí |
| C-45 | La purga del inicio ignora el `http` inyectado | T-13 (3 pruebas) | Sí |
| C-42 | La clave de selección no incluye la conexión | T-27, T-06, T-23, T-07, T-08 | Sí |
| C-10 | Un fallo de revocación impide la purga local | T-12 | Sí (la primera versión fue un mutante equivalente; rehecha) |

No probé en el worktree las roturas que requieren la base desechable (T-30 a T-38): dependen de `.env.local` y de la base de pruebas, y se acreditan por su corrida real (`test:app`).

## Comandos reejecutados

| Comando | Resultado |
|---|---|
| `npm run verify` (dos corridas) | Exit 0 ambas; lint, typegen y typecheck sin errores; 26 archivos, 589/589; build de Next correcto. |
| `npm run db:check:test` | Exit 0, destino desechable verificado (no se copia el identificador). |
| `npm run test:policies` | Exit 0; 13 archivos, 14 ejecuciones, 482 aserciones, 0 problemas (pgTAP 08, 09, 09b, 10 en verde). |
| `npm run test:app` | Exit 0; 9 archivos, 57 pasadas, 7 omitidas opt-in ajenas a Meta. |
| `npx vitest run --project app tests/app/meta-lifecycle.test.ts tests/app/meta-oauth.test.ts` | 2 archivos, 19/19, sin omitidas (CB-06). |
| Búsquedas de patrones, `git diff` de migraciones, `git diff --check`, comando de árbol limpio | Sin coincidencias ni cambios; ver ítem 5. |

Vitest cargó las suites desde Git Bash sin el problema H-E1-20.

## Hallazgos

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-01 | baja | `docs/FASES/FASE1/meta_first/sesiones/M16.2.md:34` | La fila del paso 13 conserva las cifras de la corrida inicial (`verify` 579/579, `test:unit` 503/503) mientras la matriz y la sección de la ronda 4 ya registran 589/589. Es un registro histórico, pero un lector podría tomarlo por el estado final. | Lectura de la sesión. | Opcional: agregar «(corrida inicial)» a esa fila. No bloquea. |

No hay hallazgos de seguridad, aislamiento ni cobertura.

## Pendientes del usuario

- Commitear este informe si se quiere conservar en el historial y correr `/qa-review M16.2` sobre el commit `89a41b1`: las revisiones anteriores (`qa-review-1`) corresponden a otro estado y no valen para este commit.
- Fase B (`G-ACTA-META`, P-04, despliegue verificado, VD-01, alta del dueño, VR-01 y aprobación de `G-VR01`) sigue pendiente y no depende de esta revisión.

## Confirmaciones finales

- `git rev-parse HEAD` sigue en `89a41b193a7c56015bcaf5f8cbff15a24dfa0bfa`.
- El comando de árbol limpio del paso 1 sigue sin devolver nada.
- `git worktree list` muestra solo el directorio principal; el worktree temporal fue eliminado.
- No se modificó ningún archivo salvo este informe. Durante la revisión intenté un comando que mencionaba `.env.local`; fue denegado por el sistema de permisos y no se ejecutó ni se leyó ese archivo.
