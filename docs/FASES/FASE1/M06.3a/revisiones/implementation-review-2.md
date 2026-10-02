# Revisión de implementación M06.3a — 2 (anticipada)

## Estado revisado

- Fecha: 2026-10-02. Rama: `mf/M06.3a`. Commit: `e328bc7fa562ac663641134e123cdfb1065284ee`.
- Hash del estado, excluyendo informes de revisión: `aee0e44acb083517b5450b186a544cda8674b1ee`. Calculado con los bytes de `git diff main -- . ':(exclude)docs/FASES/FASE1/*/revisiones/*' ':(exclude)docs/FASES/FASE1/meta_first/sesiones/*-review-*'` y el contenido de los archivos nuevos incluidos, enviados a `git hash-object --stdin`. No había archivos nuevos incluidos.
- Foto inicial de `git status --porcelain`: cuatro archivos modificados (`sesiones/M06.3a.md`, `credentials.ts`, `integrations-worker-api-client.test.ts`, `credential-crypto.test.ts`) y `implementation-review-1.md` sin seguimiento. `git diff main...HEAD` abarca 19 archivos; `git diff` agrega las correcciones registradas tras la primera revisión. Se preservó todo.
- **Excepción solicitada por el usuario en esta conversación:** revisión anticipada antes del paso 11, aunque la skill requiere «VERIFICADO — PENDIENTE DE APROBACIÓN». `PROJECT_STATE.md` registra **BLOQUEADO en el paso 11**. Esta revisión no acredita `G-CRYPTO` ni sustituye la revisión tras completar la implementación.

## Veredicto

**BLOQUEADO.** El código y las pruebas locales revisados pasan `npm run verify`, y las correcciones de R-01, R-03, R-04 y R-05 de la primera revisión quedaron comprobadas. El paso 11 requiere intervención del usuario; después faltan la suite real, el cierre documental y la evidencia final. Hay además un hueco de cobertura en T-36 (R-06). `G-CRYPTO` sigue pendiente.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Alcance | FAIL | Los 19 archivos del diff están previstos en el plan y no se observó funcionalidad ajena. Aún faltan `SECURITY.md`, `ARCHITECTURE.md` y seguimiento final de los pasos 13–15. |
| 2 | Criterios | FAIL | Las aserciones unitarias T-01–23, T-25–26, T-37, T-42, T-45–53 pasan dentro de `verify`; T-24 manual aún falla, C-16/C-22 no están terminados y C-18/parte de C-25 esperan la suite real. T-36 no verifica de manera directa la versión persistida. Matriz abajo. |
| 3 | Las pruebas detectan roturas | PASS | Tres mutaciones mínimas (IV constante, recifrado en `disconnected`, aridad ignorada) hicieron fallar T-04, T-14 y T-18 respectivamente. Cada archivo se restauró byte por byte. |
| 4 | Reejecución | FAIL | `npm run verify`: exit 0, 10 archivos y 191/191 pruebas más build. `db:check:test`: exit 0, destino administrativo verificado, URL del rol ausente (`FALTA`), por lo que T-27 positivo no pasa. `test:app` depende del paso 11 y no se ejecutó; una omisión no acredita CB-06. |
| 5 | Seguridad y reglas | FAIL | Scanner y búsqueda por patrón sin hallazgos; diff de `supabase/` vacío; sin `service_role` ni `any` injustificado en módulos nuevos; cuatro módulos `server-only`, contexto K01 y errores redactados. Acceso real y aislamiento del rol sin verificar; `SECURITY.md` conserva la excepción antigua. |
| 6 | Calidad funcional | PASS local | Se leyeron los caminos de error de cifrado, cliente, repositorio y guardas. No se encontró código muerto ni TODO de alcance pendiente en los módulos nuevos. Los casos reales de SQL y TLS requieren el paso 12. |
| 7 | Evidencia | PASS parcial | La sesión registra comandos, resultados, fallos, correcciones y bloqueo sin secretos; `PROJECT_STATE.md` no aprueba el gate. Falta evidencia de pasos 12–15. |
| 8 | Contradicciones | FAIL | No se halló contradicción entre ruta, spec y plan aprobados. `SECURITY.md` y `ARCHITECTURE.md` aún describen controles/componentes como previstos y `SECURITY.md` conserva la excepción; su actualización está prevista en el paso 13. |

## Matriz de criterios

«Sí» significa que la aserción leída comprueba el criterio; «parcial» identifica el resultado esperado que aún falta. «Local» no acredita integración con la base.

| Criterio | Prueba | Aserción verifica el criterio | Resultado |
|---|---|---|---|
| CA-21 | T-32/T-33 y pgTAP previo de `G-DB-META` | Parcial: la denegación directa se comprueba en la suite real | Pendiente paso 12 |
| CA-23 | T-03/T-04 | Sí: GCM, IV distinto, tamaños | PASS local |
| CA-24 | T-06–09/T-34 | Sí local; T-34 comprueba AAD entre filas reales | PASS local; T-34 pendiente |
| CA-25 | T-10–16/T-35/T-36/T-44 | Parcial: recifrado y conteo locales; falta integración, documentación de retiro y aserción directa de versión en T-36 | Pendiente |
| CA-26 | T-17/T-20/T-25/T-26/T-46/T-51–53 | Sí para los patrones, redacción y negativos locales | PASS local |
| CA-27 | T-21 | Sí: confinamiento de URL/`pg`/llavero y reglas previas | PASS local |
| CA-11b | T-08/T-19/T-34 | Sí local; T-34 comprueba material tras traslado real | PASS local; T-34 pendiente |
| CB-01–06 | T-24/T-27/T-31–40 y revisión de diff | Parcial: `verify` y diff pasan; suite real no ejecutada | Pendiente |
| C-01 | T-01/T-02 | Sí: formato, rangos, copias y errores | PASS local |
| C-02 | T-03–05 | Sí: sellado, IV y texto vacío | PASS local |
| C-03 | T-03/T-06–09 | Sí: clave, material y AAD alterados | PASS local |
| C-04 | T-10/T-11 | Sí: versión ausente distinguible | PASS local |
| C-05 | T-11–13/T-16/T-35 | Sí local; rotación real pendiente | PASS local; T-35 pendiente |
| C-06 | T-14/T-15/T-36/T-41 | Sí local; carrera y persistencia reales pendientes | PASS local; app pendiente |
| C-07 | T-18/T-21 | Sí: SQL cerrado, aridad, `server-only`, listener y configuración | PASS local |
| C-08 | T-17/T-53 | Sí: traducción/redacción y envelopes inválidos | PASS local |
| C-09 | T-12/T-19/T-51 | Sí: K01, UUID y AAD | PASS local |
| C-10 | T-20 | Sí: serialización e inspección redactadas | PASS local |
| C-11 | T-28/T-40 | Sí: dependencias, lockfile y build | PASS local |
| C-12 | T-21 | Sí: cinco reglas nuevas y dos pruebas previas | PASS local |
| C-13 | T-22/T-27/T-49 | Parcial: parser y negativos pasan; T-27 positivo requiere URL del rol | Pendiente |
| C-14 | T-23/T-24 | Parcial: código y helper ya rechazan app; T-24 aún encuentra literal en `SECURITY.md` | FAIL actual |
| C-15 | T-25/T-26 | Sí: ocho patrones, listado Git y exclusión de `.env.local` | PASS local |
| C-16 | T-29 | No: diff documental vacío | FAIL actual |
| C-17 | T-30 | Sí: variables vacías, conteo y diff | PASS local |
| C-18 | T-31–37/T-41/T-43 | Parcial: T-37 negativo pasa; T-31–36/T-41/T-43 no ejecutados | Pendiente |
| C-19 | T-38 | Sí: mocks explícitos en las dos suites nuevas, sin dependencia/alias adicional | PASS local |
| C-20 | T-39 y scanner | Sí: diff de migraciones vacío y árbol sin hallazgos | PASS local |
| C-21 | T-42/T-43/T-51 | Sí local; idempotencia SQL real pendiente | PASS local; T-43 pendiente |
| C-22 | T-44 | No: procedimiento de retiro sin actualizar en `SECURITY.md` | FAIL actual |
| C-23 | T-45/T-46/T-52 | Sí: transporte/timeout antes y después, sin retry, errores explícitos | PASS local |
| C-24 | T-47 | Sí para los parámetros de URL y rechazo previo al Pool; integración pendiente | PASS local |
| C-25 | T-48/T-50/T-31 | Sí para huella y opciones de `pg`; TLS real espera T-31 | PASS local; app pendiente |
| C-26 | T-22/T-49 | Sí: URL, host/puerto e identidad efectivos sin red | PASS local |
| C-27 | T-51–53 | Sí: validación y errores de repositorio/cliente | PASS local |

## Roturas controladas

Se copió cada archivo a un temporal fuera del repositorio, se introdujo una sola rotura, se corrió únicamente la prueba indicada y se restauró en `finally`. Comparación de bytes mediante SHA-256 de copia y archivo restaurado, equivalente a `cmp`.

| Criterio | Rotura | Prueba que la detectó | Restaurado (cmp) |
|---|---|---|---|
| CA-23/C-02 | `randomBytes(12)` por IV constante en `seal.ts` | T-04: exit 1, IV iguales | Sí, SHA-256 igual |
| C-06 | Agregar `disconnected` a estados de recifrado en `credentials.ts` | T-14: exit 1, `confirmed` frente a `not_attempted` | Sí, SHA-256 igual |
| C-07 | Suprimir comprobación de aridad en `worker-api.ts` | T-18: exit 1, consulta indebida | Sí, SHA-256 igual |

## Comandos reejecutados

| Comando | Resultado |
|---|---|
| `npm run verify` | Primer intento: lint, typegen y typecheck pasaron; Vitest no arrancó por `spawn EPERM` del sandbox. Repetido fuera del sandbox: exit 0, 10 archivos y 191/191 pruebas; build Next completo. Coincide con la sesión posterior a R-01. |
| `npm run db:check:test` | Exit 0; destino administrativo desechable verificado, URL del rol `FALTA`. No acredita T-27 positivo. Coincide con la sesión. Salida resumida sin referencias ni valores. |
| `npm ci --dry-run --offline` | Exit 0. |
| Inspección de `package.json` | `true false true` (`pg` en `dependencies`, no en `devDependencies`, `@types/pg` en `devDependencies`). |
| `rg` de secretos, tokens e `act_[0-9]{6,}` | Sin archivos coincidentes en el alcance buscado; `no-secrets-in-tree` también pasa en `verify`. Ningún valor se imprimió. |
| `rg` de la excepción antigua | Solo T-23 y `docs/SECURITY.md:293`; T-24 aún falla. |
| `git diff --name-only main -- supabase/`; `git diff --check` | Diff de migraciones vacío; diff sin errores de whitespace (avisos LF/CRLF). |
| `npm run test:app -- tests/app/integrations-worker-api-client.test.ts` | No ejecutado: requiere intervención del usuario del paso 11. T-37 sí ejecutó un subproceso negativo que falla por URL ausente sin crear Pool/Client ni conexión. |

## Hallazgos

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-02 (persiste de revisión 1) | alta | `docs/SECURITY.md:99,101,160,293`; `docs/ARCHITECTURE.md:98` | C-16/C-22 y T-24/T-29/T-44 siguen pendientes. | Diff de ambos documentos vacío; excepción antigua en SECURITY. | Completar el paso 13 tras la suite real y repetir T-24/T-29/T-44. |
| R-06 (nuevo) | media | `tests/app/integrations-worker-api-client.test.ts:124–134` | T-36 no consulta directamente `key_version` después de desconectar, aunque su resultado esperado exige que la versión guardada no cambie. | Comprueba `token`, `status`, `rewrap` y `canRetireKeyVersion`, pero no vuelve a leer el material crudo; el conteo puede no ser una aserción inequívoca de esta fila. | Leer `get_credential` tras `readCredential` y comparar `key_version` con la versión anterior; ejecutar T-36 en la suite real. |

R-01, R-03, R-04 y R-05 de la revisión 1 aparecen corregidos en los archivos de trabajo: `verify` pasa; T-42/T-45/T-46 agregan sus escenarios; T-49/T-50 inspeccionan `ConnectionParameters`; T-51–T-53 amplían validaciones. La suite real determinará si aparece otro hallazgo. No se editaron código ni documentos de implementación durante esta revisión.

## Pendientes del usuario

Completar el paso 11 de `plan.md`: fijar la contraseña del rol `praxa_integrations` en el proyecto desechable de pruebas, ejecutar `npm run env:prepare` y cargar en `.env.local` la URL exclusiva del rol desde Connect → Transaction pooler (puerto 6543) y un llavero nuevo de 32 bytes base64 con su versión actual. No compartir valores por chat. Después, el asistente debe repetir la guarda, ejecutar la suite real (paso 12), corregir R-06 y completar documentación, evidencia y verificación final (pasos 13–15). Solo entonces corresponde la revisión de cierre y eventual aprobación visible de `G-CRYPTO`.
