# Revisión de implementación M06.3a — 3

## Estado revisado

- Fecha: 2026-10-02. Rama: `mf/M06.3a`. Commit: `e328bc7fa562ac663641134e123cdfb1065284ee`.
- Hash del estado, excluidos los informes de revisión: `503469b631a6ceeb553f48f4b4ebc7d35a58883b`. Calculado con `git diff main -- . ':(exclude)docs/FASES/FASE1/*/revisiones/*' ':(exclude)docs/FASES/FASE1/meta_first/sesiones/*-review-*'`, seguido del contenido de archivos nuevos no excluidos, enviado a `git hash-object --stdin`. No había archivos nuevos no excluidos.
- Foto inicial de `git status --porcelain`: ocho archivos modificados (`ARCHITECTURE.md`, sesión, `HALLAZGOS.md`, `PROJECT_STATE.md`, `SECURITY.md`, `credentials.ts`, suite app y suite unitaria) y los informes 1 y 2 sin seguimiento. Rama y estado `VERIFICADO — PENDIENTE DE APROBACIÓN` cumplen la precondición.
- Spec `APROBADA`, hash sin línea de estado `73916504c73990df7a2d38ff18b7ea7f3c592375`; plan `APROBADO`, hash `9dba61e69272a17d27479c56cd526405a2c44fe2`. Coinciden con los hashes auditados.

## Veredicto

**APROBABLE.** Los ocho ítems pasan. La verificación técnica no aprueba `G-CRYPTO`; sigue pendiente la aprobación visible del usuario.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Alcance | PASS | `git diff main...HEAD`, `git diff`, archivos nuevos y contenido revisados. Los 22 archivos cambiados están en la tabla del plan; los dos informes anteriores pertenecen al pipeline. No hay migración, ruta OAuth, worker ni cambio fuera del corte. |
| 2 | Criterios | PASS | Matriz siguiente. Se leyeron las aserciones T-01–T-53, los contratos K01/K04, las pruebas app y los diffs documentales. La suite real ejecutó 8/8 casos del rol; T-37 ejecutó su proceso negativo sin red. |
| 3 | Las pruebas detectan roturas | PASS | T-04, T-14 y T-18 fallaron con tres roturas mínimas independientes. Cada archivo fue respaldado fuera del repositorio y restaurado con igualdad de bytes. |
| 4 | Reejecución | PASS | `test:unit` 182/182; `db:check:test` destino desechable y URL del rol verificados; `test:app` 37 pasadas, 7 omitidas, con los 8 casos del rol ejecutados; `verify` 191/191, lint, typegen, typecheck y build. Los siete omitidos son tres de correo opt-in y cuatro avisos negativos `NO EJECUTADA` desactivados porque las suites remotas positivas corrieron. Coincide con la sesión. |
| 5 | Seguridad y reglas | PASS | Scanner T-25/T-26 y búsqueda de patrones sin hallazgos; ningún `act_` completo; diff y nuevos archivos de `supabase/` vacíos. K01 validado antes de acceder a la base; AAD usa empresa/conexión/proveedor; errores tipados y redactados; cuatro módulos comienzan con `server-only`. El código nuevo no usa `service_role`. No se leyó `.env.local`. |
| 6 | Calidad funcional | PASS | Se revisaron casos de material inválido, versión desconocida, carrera de desconexión, respuesta SQL inválida, transporte incierto, rechazo TLS/destino y operación preparada. Tipos estrictos, sin `any`, TODO ni código muerto que oculte alcance. |
| 7 | Evidencia | PASS | La sesión registra RED/GREEN, fallos de arranque/autenticación, reintentos permitidos, comandos finales y limpieza. `H-E1-42` tiene ID y asignación fuera de este corte. `PROJECT_STATE.md` mantiene `G-CRYPTO` pendiente. |
| 8 | Contradicciones | PASS | La ruta, la spec, el plan y el código son compatibles. `SECURITY.md` y `ARCHITECTURE.md` distinguen controles vigentes de OAuth/sincronización previstos; el límite SQL de `H-E1-37` está declarado. |

## Matriz de criterios

| Criterio | Prueba | Aserción verifica el criterio (sí/no) | Resultado |
|---|---|---|---|
| CA-21/CA-22 | T-31/T-32/T-33; pgTAP del gate `G-DB-META` | Sí: rol real, tres tablas denegadas, lectura solo por función | PASS |
| CA-23 | T-03/T-04 | Sí: AES-GCM, IV distinto y tamaños | PASS |
| CA-24 | T-06–09/T-34 | Sí: clave, material y AAD ajeno fallan | PASS |
| CA-25 | T-10–16/T-35/T-36/T-44 | Sí: versión, recifrado, conteo y límite de retiro | PASS |
| CA-26 | T-17/T-20/T-25/T-26/T-46/T-51–53 | Sí: scanner, envoltorio y errores redactados | PASS |
| CA-27 | T-21 | Sí: URL del rol, `pg`, llavero y reglas originales confinados | PASS |
| CA-11b | T-08/T-19/T-34 | Sí: AAD con empresa y conexión; traslado real falla | PASS |
| CB-01–06 | T-24/T-27–40, suites y revisión de diff | Sí: gates ejecutados, destino desechable, secretos/migraciones ausentes y evidencia real | PASS |
| C-01 | T-01/T-02 | Sí: formato/rangos, claves copiadas y errores sin material | PASS |
| C-02 | T-03–05 | Sí: sellado actual, IV/tag y texto vacío | PASS |
| C-03 | T-03/T-06–09 | Sí: fallos de autenticación y tag corto previo a descifrar | PASS |
| C-04 | T-10/T-11 | Sí: versión ausente distinta de fallo GCM | PASS |
| C-05 | T-11–13/T-16/T-35 | Sí: recifrado único y conteo real | PASS |
| C-06 | T-14/T-15/T-36/T-41 | Sí: desconectada sin recifrar y carrera SQL `PX006` | PASS |
| C-07 | T-18/T-21 | Sí: mapa SQL, aridad, parámetros, `server-only` y pool | PASS |
| C-08 | T-17/T-53 | Sí: errores traducidos y envelope sin datos originales | PASS |
| C-09 | T-12/T-19/T-51 | Sí: K01, UUID servidor y AAD del contexto | PASS |
| C-10 | T-20 | Sí: `SecretValue` redactado salvo `reveal()` | PASS |
| C-11 | T-28/T-40 | Sí: ubicación de `pg`, lockfile y build | PASS |
| C-12 | T-21 | Sí: cinco invariantes y dos `it` originales | PASS |
| C-13 | T-22/T-27/T-49 | Sí: resolvedor, URLs rechazadas y guarda positiva | PASS |
| C-14 | T-23/T-24 | Sí: vieja excepción activada no permite proyecto app; literal solo en T-23 | PASS |
| C-15 | T-25/T-26 | Sí: ocho patrones, informe redactado, listado Git sin `.env.local` | PASS |
| C-16 | T-29 | Sí: diff documental con capacidades por categoría y módulos vigentes | PASS |
| C-17 | T-30 | Sí: cuatro variables vacías, conteo 13 y prueba de valores | PASS |
| C-18 | T-31–37/T-41/T-43 | Sí: rol/ACL/cifrado/AAD/rotación/desconexión/carrera/reintento reales y negativo de configuración | PASS |
| C-19 | T-38 | Sí: mocks de `server-only` por suite, sin alias global ni dependencia nueva | PASS |
| C-20 | T-39 y scanner | Sí: sin migraciones ni secretos en el diff | PASS |
| C-21 | T-42/T-43/T-51 | Sí: argumentos reutilizados, contexto y SQL idempotente real | PASS |
| C-22 | T-44 | Sí: documento exige writers detenidos, operaciones terminadas y conteo cero | PASS |
| C-23 | T-45/T-46/T-52 | Sí: `unconfirmed` solo ante transporte/timeout de rewrap, sin relectura | PASS |
| C-24 | T-47 | Sí: overrides TLS rechazados antes de pool y lectura de CA | PASS |
| C-25 | T-48/T-50/T-31 | Sí: huella CA, TLS efectivo, negociación y conexión real | PASS |
| C-26 | T-22/T-49 | Sí: overrides de identidad/destino y parser efectivo validados | PASS |
| C-27 | T-51–53 | Sí: entradas, preparados, respuestas, proyección K04 y errores fijos | PASS |

## Roturas controladas

Se usó un respaldo temporal fuera del repositorio para cada archivo; la restauración ocurrió en `finally` y se compararon bytes con la copia. Los dos primeros intentos del harness terminaron por codificación de consola al capturar/imprimir Unicode; los archivos se restauraron y ninguno de esos intentos se contó como prueba. El tercer intento registró:

| Criterio | Rotura | Prueba que la detectó | Restaurado (cmp) |
|---|---|---|---|
| CA-23/C-02 | `randomBytes(12)` por IV constante en `seal.ts` | T-04: exit 1, 1 fallo | Sí, idéntico; SHA-256 `27a38195f5a3…` |
| C-06 | Agregar `disconnected` a estados de recifrado en `credentials.ts` | T-14: exit 1, 1 fallo | Sí, idéntico; SHA-256 `b623f6498cdb…` |
| C-07 | Suprimir comprobación de aridad en `worker-api.ts` | T-18: exit 1, 1 fallo | Sí, idéntico; SHA-256 `8247a10c4364…` |

## Comandos reejecutados

| Comando | Resultado |
|---|---|
| `npm run test:unit` | Exit 0; 9 archivos, 182/182 pruebas. |
| `npm run db:check:test` | Exit 0; `Destino verificado`, referencia administrativa/rol coincidente y proyecto desechable confirmado. Se omiten referencias y valores en este informe. |
| `npm run test:app` | Exit 0; 6 archivos, 37 pasadas y 7 omitidas ajenas a la suite requerida. La suite del rol ejecutó 8/8. |
| `npm run verify` | Exit 0; lint, typegen, typecheck, 10 archivos y 191/191 pruebas unitarias/de componentes, build Next completo. |
| `npm ci --dry-run --offline` | Exit 0; lockfile sincronizado. Advertencia informativa de `allow-scripts` para `unrs-resolver`. |
| Inspección de `package.json` | `true false true`: `pg` en producción, `@types/pg` en desarrollo. |
| T-24: `rg -n SUPABASE_TEST_ALLOW_APP_PROJECT scripts tests src .github docs/SECURITY.md .env.example README.md` | Tres coincidencias, todas dentro de T-23; ninguna operativa. |
| Búsqueda de patrones de secreto, token, clave privada y `act_[0-9]{6,}` en archivos del corte | Sin coincidencias. El scanner de árbol T-25/T-26 también pasa. |
| `git diff --name-only main -- supabase/`; `git ls-files --others --exclude-standard -- supabase/` | Ambos sin salida. |
| `git diff --check` | Exit 0; solo avisos LF/CRLF. |

## Hallazgos

No se encontraron hallazgos nuevos `R-NN`. R-02 y R-06 de los informes anteriores quedaron resueltos mediante los cambios documentales y las aserciones reales de T-36. `H-E1-42` está registrado y asignado a M16.1 según la spec; no se editó el archivo fuera de alcance.

## Pendientes del usuario

Revisión QA y, si corresponde, aprobación visible de `G-CRYPTO`. El gate sigue pendiente; M28.2a no queda habilitada por este informe.
