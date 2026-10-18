# Revisión de implementación de M16.2 — ronda 1

**Fecha:** 2026-10-17  
**Commit revisado:** `a0956629327bd4ab4771302ad777ef048eebb46f` (`mf/M16.2`)  
**Hash del estado revisado:** `c38e59371767dfd9aaa0022a6383470a5e09739a` (diff contra `main` y archivos nuevos, excluidos los informes de revisión según la skill).  
**Foto inicial:** `git status --porcelain` sin entradas; `git diff` sin cambios.  
**Veredicto:** **REQUIERE CAMBIOS**. La fase A funciona en las suites reejecutadas, pero C-29 tiene un hueco de cobertura demostrado por una rotura que sus pruebas no detectan. `G-VR01` permanece pendiente; esta revisión no habilita M16c.

## Checklist

| # | Ítem | Estado | Evidencia |
|---|---|---|---|
| 1 | Alcance | PASS | Los 31 archivos F01–F31 de implementación y seguimiento coinciden con el plan. Los otros cambios frente a `main` son spec, plan, enmiendas y revisiones aprobadas antes de implementar. No hay cambios sin commit ni archivos nuevos sin seguimiento. |
| 2 | Criterios | FAIL | C-01 a C-35, C-38 a C-42 y C-44 a C-46 tienen pruebas o comprobaciones y las suites pasan; C-29 carece de una aserción que cubra el registro del probe exitoso (R-01). C-36 y C-37, y la parte de acta de C-44, están expresamente en fase B. |
| 3 | Las pruebas detectan roturas | FAIL | T-07 detectó una clave cruzada aceptada y T-11 detectó la omisión de `begin_disconnect`. Una fuga sintética del id completo de cuenta en la línea `prueba ok` pasó T-06, T-21/T-22 y T-23. Los tres archivos mutados fueron restaurados con igualdad de hash byte a byte. |
| 4 | Reejecución | PASS | `npm run verify` terminó con 579/579 pruebas, lint, tipos y build en verde; pgTAP, 482/482; `test:app`, 57 pasadas y 7 omitidas opt-in ajenas a Meta. Los resultados coinciden con la sesión. La primera corrida de `verify` dentro del sandbox falló al importar seis suites por `ENOENT` de caché temporal de Vitest, también en suites anteriores a M16.2; la repetición fuera de ese sandbox pasó sin cambios de código. |
| 5 | Seguridad y reglas | PASS | Búsqueda por patrones de token, JWT, clave y `act_` de seis o más dígitos en el código y pruebas revisados: sin coincidencias. No se leyó `.env.local`. `git diff main...HEAD -- supabase/migrations/` vacío. K01 se resuelve en servidor; la conexión se lee con RLS; `worker_api` recibe el actor validado; no hay `service_role` en los módulos nuevos. Errores de Meta usan textos fijos y los módulos de servidor declaran `server-only`. |
| 6 | Calidad funcional | PASS | Se revisaron los caminos de error, las carreras de confirmación y reautorización, la purga reanudable, los adaptadores y los mensajes cerrados. No se encontraron `any`, `TODO` o código muerto en los módulos nuevos. La prueba de cobertura de registros queda en R-01, sin defecto observado en la implementación original. |
| 7 | Evidencia | PASS | La sesión registra comandos, conteos, skips, preflight del usuario, limitaciones y el desvío de orden TDD. `H-E1-118` tiene ID y asignación. `PROJECT_STATE.md` deja `G-VR01` sin aprobar. |
| 8 | Contradicciones | PASS | Spec y plan tienen los hashes aprobados (`0b92d68f3042983fb37fd0339d9715071758cc7b` y `1074e260242a0dd8184833047f7b6a7963c0a9fa`). Fase A y fase B siguen la clasificación aprobada; no se detectó contradicción nueva con la ruta o `AGENTS.md`. |

## Matriz de criterios

`Sí` indica que la aserción comprueba el criterio en el alcance de fase A. Las pruebas manuales de fase B aún no tienen resultado.

| Criterio | Prueba | ¿Aserción verifica el criterio? | Resultado |
|---|---|---|---|
| C-01 | T-01, T-02 | Sí | Pasa |
| C-02 | T-03, T-36 | Sí | Pasa |
| C-03 | T-27 | Sí | Pasa |
| C-04 | T-06, T-07 | Sí | Pasa |
| C-05 | T-05, T-06, T-08, T-30, T-36 | Sí | Pasa |
| C-06 | T-04, T-05 | Sí | Pasa |
| C-07 | T-09, T-36 | Sí | Pasa |
| C-08 | T-11, T-33 | Sí | Pasa |
| C-09 | T-13, T-33 | Sí | Pasa |
| C-10 | T-12 | Sí | Pasa |
| C-11 | T-30, T-33 | Sí | Pasa |
| C-12 | T-34 | Sí | Pasa |
| C-13 | T-28 | Sí | Pasa |
| C-14 | T-14 | Sí | Pasa |
| C-15 | T-15, T-31 | Sí | Pasa |
| C-16 | T-16 | Sí | Pasa |
| C-17 | T-17, T-32 | Sí | Pasa |
| C-18 | T-18, T-31 | Sí | Pasa |
| C-19 | T-19, T-52 | Sí | Pasa |
| C-20 | T-20 | Sí | Pasa |
| C-21 | T-21, T-37 | Sí | Pasa |
| C-22 | T-22 | Sí | Pasa |
| C-23 | T-28 | Sí | Pasa |
| C-24 | T-18, T-30, T-31 | Sí | Pasa |
| C-25 | T-13, T-35 | Sí | Pasa |
| C-26 | T-27, T-29 | Sí | Pasa |
| C-27 | T-27 | Sí | Pasa |
| C-28 | T-24 y guardas existentes | Sí | Pasa |
| C-29 | T-22, T-23, T-43 | **No**, falta el registro `prueba ok` | **FAIL, R-01** |
| C-30 | T-25, T-29 | Sí | Pasa |
| C-31 | T-26 | Sí | Pasa |
| C-32 | T-10, T-52 | Sí | Pasa |
| C-33 | T-38 y `db:check:test` | Sí | Pasa |
| C-34 | T-39, T-40, T-41 | Sí | Pasa |
| C-35 | T-42, diff documental | Sí | Pasa |
| C-36 | T-44 | Pendiente, fase B | Sin ejecutar |
| C-37 | T-45 | Pendiente, fase B | Sin ejecutar |
| C-38 | T-46 | Sí | Pasa |
| C-39 | T-47 | Sí | Pasa |
| C-40 | T-47 | Sí | Pasa |
| C-41 | T-48 y preflight aportado por el usuario | Sí | Pasa en fase A; revocación real queda en VR-01 |
| C-42 | T-07 | Sí | Pasa |
| C-44 | T-50 | Sí para UI; acta pendiente de fase B | Pasa en fase A |
| C-45 | T-51 | Sí | Pasa |
| C-46 | T-52 | Sí | Pasa |

## Roturas controladas

Cada archivo se copió primero a un archivo temporal fuera del repositorio. La restauración desde esa copia se comprobó por igualdad de `Get-FileHash` sobre ambos archivos, equivalente binario a `cmp`.

| Criterio | Rotura mínima | Prueba correspondiente | Restaurado |
|---|---|---|---|
| C-04/C-42 | `confirmAccount` responde `conectado` ante una clave sin coincidencia | T-07 falló: esperaba `cuenta_invalida` | Sí |
| C-08 | `runLazyPurge` omite `beginDisconnect` para una pendiente vencida | Dos casos T-11 fallaron por el orden de llamadas | Sí |
| C-29 | La línea `meta_ciclo` de `prueba ok` agrega `leak: account.id` (id sintético completo) | T-06, T-21/T-22 y T-23 **pasaron**, 3/3 | Sí |

Después de restaurar, esos tres casos focalizados volvieron a pasar (3/3). `git status --porcelain` permaneció vacío antes de escribir este informe.

## Comandos reejecutados

| Comando | Resultado |
|---|---|
| `git status --short --branch`, `git status --porcelain`, `git diff main...HEAD`, `git diff` | Rama correcta, árbol inicial limpio; cambio completo inspeccionado. |
| `npm run verify` | Primera corrida: fallo de importación `ENOENT` temporal en seis suites. Segunda, fuera del sandbox: exit 0, 579/579 y build. |
| `npm run db:check:test` | Exit 0; destino desechable y rol de prueba verificados. No se registran aquí identificadores del proyecto. |
| `npm run test:policies` | Exit 0; 13 archivos, 14 ejecuciones, 482/482 aserciones. |
| `npm run test:app` | Exit 0; 9 archivos, 57 pasadas, 7 omitidas opt-in ajenas a Meta. Las suites `meta-lifecycle` y `meta-oauth` no se omitieron. |
| Búsquedas por patrones; `git diff main...HEAD -- supabase/migrations/` | Sin coincidencias sensibles ni migraciones modificadas. |
| `git diff main...HEAD --check` | Tres espacios finales en `qa-review-1.md`, informe previo a la implementación; no afectan el código ni se corrigieron por el alcance de esta skill. |

## Hallazgos

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-01 | Media | `tests/unit/meta-oauth.test.ts:1340`; camino en `src/modules/integrations/lifecycle.ts:251` | T-23 solo inspecciona los registros de un callback `initial` rechazado. No inspecciona la línea del probe exitoso, que puede contener el id completo de cuenta o valores de Insights si se amplía por error. | Con `leak: account.id` temporal en el log `prueba ok`, T-06, T-21/T-22 y T-23 pasaron; 3/3. El archivo original fue restaurado. | Capturar el recorrido exitoso de `confirmAccount` y comprobar en la línea `meta_ciclo` de `prueba` tanto el conjunto exacto de claves como la ausencia de id completo, nombre y valores. Ampliar T-23 a las demás líneas del ciclo de vida que declara cubrir. Repetir la rotura y exigir rojo. |

## Pendientes del usuario

No hay intervención nueva para corregir R-01: corresponde volver a `$microfase M16.2` y añadir la cobertura dentro de los archivos previstos. Después se repite esta revisión. La fase B sigue pendiente según el plan: aprobación de `G-ACTA-META` y P-04, merge y despliegue de la fase A, VD-01, alta del dueño, VR-01 y aprobación visible de `G-VR01`. Ninguna de esas acciones se ejecutó en esta revisión.
