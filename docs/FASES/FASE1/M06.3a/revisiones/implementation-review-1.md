# Revisión de implementación M06.3a — 1

## Estado revisado

- Fecha: 2026-10-02. Rama: `mf/M06.3a`. Commit: `e328bc7fa562ac663641134e123cdfb1065284ee`.
- Hash del estado, excluyendo informes de revisión: `79a6b1d8b14316fdbbf6dc7886df3a824a1a8aa5`. Se calculó sobre los bytes de `git diff main -- . ':(exclude)docs/FASES/FASE1/*/revisiones/*' ':(exclude)docs/FASES/FASE1/meta_first/sesiones/*-review-*'`, concatenados con el contenido de los archivos nuevos incluidos, y enviados a `git hash-object --stdin`. `git ls-files --others --exclude-standard` no devolvió archivos incluidos. En PowerShell, canalizar el texto del diff directamente produjo otro hash por la conversión de la tubería; se descartó ese resultado.
- Foto inicial: `git status --porcelain` vacío; `git diff` vacío. El diff `main...HEAD` contiene 19 archivos, todos previstos en el plan. No hay diff bajo `supabase/`.
- **Excepción solicitada por el usuario:** se realizó esta revisión anticipada aunque la precondición de la skill exige «VERIFICADO — PENDIENTE DE APROBACIÓN». `PROJECT_STATE.md` y la sesión registran **BLOQUEADO en el paso 11**. Este informe no aprueba `G-CRYPTO`.

## Veredicto

**BLOQUEADO, con cambios requeridos dentro de M06.3a.** Falta la intervención del usuario del paso 11 para ejecutar la suite real. Además, `npm run verify` falla por lint y los pasos 13–15 aún no están realizados. La cobertura de varios casos prometidos por la spec es incompleta.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Alcance | FAIL | Los 19 archivos tocados están previstos y no se observó funcionalidad ajena; faltan `SECURITY.md`, `ARCHITECTURE.md` y seguimiento final exigidos en pasos 13–15. |
| 2 | Criterios | FAIL | C-16/C-22 no están implementados; C-18 y parte de C-25 requieren la suite real; C-11/T-40 fallan por lint. T-42, T-49/T-50 y T-53 no verifican todos sus resultados esperados. |
| 3 | Detección de roturas | PASS | Tres mutaciones focalizadas fallaron como se esperaba; cada archivo quedó idéntico a su copia SHA-256. Tabla abajo. |
| 4 | Reejecución | FAIL | `test:unit` 181/181 y `test` 190/190; `verify` exit 1 en lint. `db:check:test` y `test:app` positivos dependen del paso 11 y no se ejecutaron. |
| 5 | Seguridad y reglas | FAIL | Búsqueda de patrones sin hallazgos; sin migración modificada, sin `service_role` ni `any` injustificado en módulos nuevos; `server-only` presente. No se verificó acceso real/aislamiento del rol y SECURITY todavía describe controles como previstos y conserva la excepción antigua. |
| 6 | Calidad funcional | FAIL | El código local cubre los caminos principales, pero hay función muerta `positiveDbVersion` y huecos de pruebas detallados en R-03 a R-05. |
| 7 | Evidencia | PASS | La sesión registra RED/GREEN, comandos, fallos, intervención y limitaciones; `PROJECT_STATE.md` no aprueba `G-CRYPTO`. Hallazgos de esta revisión reciben ID R-NN aquí. |
| 8 | Contradicciones | FAIL | SECURITY/ARCHITECTURE aún presentan el cliente Node y el cifrado como previstos pese a que ya existen en código; el paso 13 debe alinear esos documentos. No se detectó contradicción entre ruta, spec y plan aprobados. |

## Matriz de criterios

«Sí» indica que la aserción leída comprueba el criterio indicado; «parcial» señala un resultado esperado de la spec que falta. «Local» significa que la prueba pasó en `test:unit` o `test`, sin acreditar integración.

| Criterio | Prueba | ¿Aserción adecuada? | Resultado |
|---|---|---|---|
| CA-21 | T-32, T-33; pgTAP previo | Sí | Pendiente T-32/T-33 con rol real |
| CA-23 | T-03, T-04 | Sí | Pasa local |
| CA-24 | T-06 a T-10, T-34 | Sí | Negativos locales pasan; T-34 pendiente |
| CA-25 | T-11 a T-16, T-35/T-36, T-44 | Parcial | Local pasa; rotación real y documentación pendientes |
| CA-26 | T-17, T-25, T-46, T-48 | Parcial | Scanner pasa; TLS real y algunos negativos pendientes |
| CA-27 | T-21 | Sí | Pasa local |
| CA-11b | T-08, T-19, T-34 | Sí | Local pasa; T-34 pendiente |
| CB-01–CB-06 | T-24, T-27 a T-40, comandos finales | Parcial | `verify` falla; suite real pendiente; diff SQL vacío |
| C-01 | T-01, T-02 | Sí | Pasa local |
| C-02 | T-03 a T-05 | Sí | Pasa local |
| C-03 | T-03, T-06 a T-09 | Sí | Pasa local |
| C-04 | T-10, T-11 | Sí | Pasa local |
| C-05 | T-11 a T-13, T-16, T-35 | Sí | Local pasa; T-35 pendiente |
| C-06 | T-14, T-15, T-36, T-41 | Sí | Local pasa; T-36/T-41 pendientes |
| C-07 | T-18, T-21 | Sí | Pasa local |
| C-08 | T-17, T-53 | Parcial | Traducción pasa; T-53 incompleto |
| C-09 | T-12, T-19, T-51 | Sí | Pasa local |
| C-10 | T-20 | Sí | Pasa local |
| C-11 | T-28, T-40 | Sí | Dependencia/lock pasan; build no llegó a ejecutarse |
| C-12 | T-21 | Sí | Pasa local |
| C-13 | T-22, T-27, T-49 | Parcial | Unit pasa; comprobación positiva T-27 pendiente |
| C-14 | T-23, T-24 | Sí | T-23 pasa; T-24 falla por SECURITY |
| C-15 | T-25, T-26 | Sí | Pasa local |
| C-16 | T-29 | No aún | Documentos sin actualizar |
| C-17 | T-30 | Sí | Pasa local y diff revisado |
| C-18 | T-31 a T-37, T-41, T-43 | Sí | T-37 negativo pasa; positivos pendientes |
| C-19 | T-38 | Sí | Mocks por suite presentes; pasa local |
| C-20 | T-39 y scanner | Sí | Diff `supabase/` vacío; scanner local pasa |
| C-21 | T-42, T-43 | Parcial | T-42 pasa, pero no cambia la versión actual entre intentos; T-43 pendiente |
| C-22 | T-44 | No aún | Documentación de retiro pendiente |
| C-23 | T-45, T-46, T-52 | Parcial | Transporte local pasa; no se prueba timeout y faltan negativos de T-46/T-52 |
| C-24 | T-47 | Sí | Pasa local; mutación detectada |
| C-25 | T-48, T-50, T-31 | Parcial | Opciones/huella pasan; parser efectivo y TLS real pendientes |
| C-26 | T-49 | Parcial | Rechazos pasan; no se compara destino efectivo con el parser instalado |
| C-27 | T-51 a T-53 | Parcial | Validación principal pasa; faltan respuestas de create/replace/rewrap/conteo |

## Roturas controladas

Se copió cada implementación a un archivo temporal fuera del repositorio, se introdujo una sola rotura, se ejecutó solo la prueba indicada y se restauró en `finally`. La comparación de bytes se efectuó mediante SHA-256 de la copia y el archivo restaurado.

| Criterio | Rotura | Prueba que la detectó | Restaurado |
|---|---|---|---|
| CA-11b / C-02 | Omitir `cipher.setAAD` en `seal.ts` | T-03: exit 1, `CredentialDecryptionError` | Sí, SHA-256 igual |
| C-06 | Permitir recifrado de `disconnected` en `credentials.ts` | T-14: exit 1, recibió `confirmed` en vez de `not_attempted` | Sí, SHA-256 igual |
| C-24 | Desactivar `TLS_QUERY.has` en `worker-api.ts` | T-47/T-49: exit 1, no rechazó la URL | Sí, SHA-256 igual |

## Comandos reejecutados

| Comando | Resultado |
|---|---|
| `npm run test:unit` | Exit 0 fuera del sandbox: 9 archivos, 181 pruebas. Un intento inicial en sandbox no cargó Vitest por `spawn EPERM`; no se contó como prueba. |
| `npm run test` | Exit 0: 10 archivos, 190 pruebas. |
| `npm run typecheck` | Exit 0. |
| `npm run verify` | Exit 1 en lint: 3 errores y 1 advertencia; typegen, typecheck, test y build de este comando no se ejecutaron. |
| `npm ci --dry-run --offline` | Exit 0, lockfile sincronizado. |
| Inspección de `package.json` | `true false true` para `pg` en dependencies, en devDependencies y `@types/pg` en devDependencies. |
| `git diff --check main...HEAD` | Exit 0. |
| `git diff main -- docs/SECURITY.md docs/ARCHITECTURE.md` | Vacío: paso 13 pendiente. |
| `git diff --name-only main -- supabase/` | Vacío. |
| `rg` de la excepción antigua en scripts/tests/src/.github/SECURITY/.env.example/README | Coincidencias en T-23 y SECURITY:293; T-24 todavía falla. |
| `rg -l` de tokens, claves privadas e identificadores de cuenta completos | Sin hallazgos en src/scripts/tests/docs/README/.env.example. |
| `npm run db:check:test`; `npm run test:app` | No reejecutados: dependen de la intervención del usuario del paso 11. La sesión registra que el primer chequeo informó URL del rol FALTA sin acreditar T-27. |

## Hallazgos

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-01 | alta | `tests/app/integrations-worker-api-client.test.ts:41`; `tests/unit/credential-crypto.test.ts:69,75` | `verify` no pasa. | Lint: `no-this-alias` y dos `no-assign-module-variable`; además advertencia por `positiveDbVersion` sin uso en `credentials.ts:139`. | Corregir los tres errores y quitar la función muerta dentro de los archivos previstos; repetir `verify`. |
| R-02 | alta | `docs/SECURITY.md:99,101,160,293`; `docs/ARCHITECTURE.md:98` | Falta el cierre documental C-16/C-22 y la eliminación documental de la excepción antigua. | Diff de ambos documentos vacío; todavía describen cliente/cifrado como previstos. | Completar paso 13 tras la suite real y repetir T-24/T-29/T-44. |
| R-03 | media | `tests/unit/credential-crypto.test.ts:338,359,377` | T-42/T-45/T-46 no cubren todos los escenarios que declaran. | T-42 compara argumentos repetidos sin cambiar la clave actual; T-45 simula solo transporte; T-46 no verifica todos los negativos ni la serialización. | Extender aserciones con cambio de versión, timeout y los errores/serialización especificados. |
| R-04 | media | `tests/unit/credential-crypto.test.ts:514,548` | T-49/T-50 prueban opciones entregadas al Pool simulado, pero no identidad/host/puerto/negociación efectivos del parser `pg` instalado. | No se instancia `ConnectionParameters` ni equivalente sin red; el plan y la spec lo exigen. | Agregar la inspección efectiva del parser con entorno sintético y sin conexiones. |
| R-05 | media | `tests/unit/credential-crypto.test.ts:391,414,506` | La cobertura de validación C-27/T-51–T-53 es parcial. | T-53 solo cubre envelopes; faltan respuestas inválidas de create/replace/rewrap/conteo. T-51/T-52 omiten varios límites y aserciones antes de sellar/descifrar. | Completar los casos de la matriz aprobada y comprobar clase/código/mensaje redactados. |

## Pendientes del usuario

Completar el paso 11 según `plan.md`: fijar la contraseña del rol `praxa_integrations` en el proyecto desechable de pruebas, ejecutar `npm run env:prepare`, cargar la URL exclusiva del rol y el llavero en `.env.local`. No compartir valores por chat. Después, la implementación debe continuar desde el paso 12, ejecutar `db:check:test`, `test:app`, actualizar documentos/seguimiento y repetir la verificación final. `G-CRYPTO` permanece pendiente.
