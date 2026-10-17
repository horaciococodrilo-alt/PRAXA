# Revisión de implementación de M16.2 — ronda 2

**Fecha:** 2026-10-17  
**Rama y commit revisado:** `mf/M16.2`, `a0956629327bd4ab4771302ad777ef048eebb46f`  
**Hash del estado revisado:** `2e7405873e186415252032ab44ee08d7e3734487`. Calculado con el diff contra `main` y el contenido de los archivos nuevos, excluidos los informes de revisión según la skill; la tubería se ejecutó sobre bytes con Python para conservar los finales de línea.  
**Foto inicial (`git status --porcelain`):** modificados `docs/FASES/FASE1/meta_first/sesiones/M16.2.md`, `docs/HALLAZGOS.md` y `tests/unit/meta-lifecycle.test.ts`; sin seguimiento `docs/FASES/FASE1/M16.2/revisiones/implementation-review-1.md`. Todos eran preexistentes y se preservaron.  
**Veredicto:** **APROBABLE para la fase A**. `G-VR01` continúa sin aprobar; la fase B y M16c no quedan habilitadas por este informe.

## Checklist

| # | Ítem | Estado | Evidencia |
|---|---|---|---|
| 1 | Alcance | PASS | Los 31 archivos F01–F31 de implementación y seguimiento están en el plan. Los cambios adicionales frente a `main` son la spec, el plan, la ruta y las revisiones previas. El diff sin commit corrige R-01 solo en T-23 y su evidencia. No se modificaron archivos de producción en esta ronda. |
| 2 | Criterios | PASS | Se leyeron las aserciones de T-01 a T-52 y se cotejaron con C-01 a C-46 aplicables. T-23 ahora recorre el probe exitoso y el listado, compara las claves exactas de los registros y excluye los valores sensibles sintéticos. Las suites obligatorias pasaron. C-36, C-37, el acta de C-44 y la revocación real de C-41 pertenecen a la fase B, expresamente pendiente. |
| 3 | Las pruebas detectan roturas | PASS | Tres mutaciones temporales en `lifecycle.ts`: clave de selección cruzada aceptada, omisión de `begin_disconnect` y fuga del id completo en el log `prueba ok`. T-07, T-11 y T-23 fallaron respectivamente. Se restauró desde copia temporal fuera del repositorio y se comprobó igualdad binaria; los casos focalizados originales volvieron a pasar. |
| 4 | Reejecución | PASS | `npm run verify`: exit 0, 580/580 pruebas y build. `test:policies`: exit 0, 482/482. `test:app`: exit 0, 57 pasadas y 7 omitidas opt-in ajenas a Meta; las suites Meta no se omitieron. Coincide con la sesión tras la corrección. La primera corrida de `verify` en el sandbox falló por seis importaciones `ENOENT` de caché temporal; repetida fuera de él pasó sin cambiar código. `test:policies` requirió red fuera del sandbox después de un `ENOTFOUND`. |
| 5 | Seguridad y reglas | PASS | Se buscaron patrones de token de Meta, parámetros OAuth sensibles, secreto de Supabase, JWT, llavero, clave privada e identificador `act_` largo en los 35 archivos modificados o nuevos fuera de revisiones: cero coincidencias. No se leyó `.env.local`. `git diff main -- supabase/migrations` vacío. K01 se construye en servidor, la lectura usa RLS, no hay `service_role` en los módulos nuevos, los errores tienen texto cerrado y los módulos de servidor llevan `server-only`. |
| 6 | Calidad funcional | PASS | Se inspeccionaron purga, selección, probe, reautorización, revocación, adaptadores y UI; los caminos de error previstos siguen presentes. No se detectaron `any` injustificados, TODO que oculten alcance ni código muerto nuevo. |
| 7 | Evidencia | PASS | La sesión registra comandos, resultados, desvíos de entorno, skips, preflight del usuario y la corrección de R-01. `H-E1-119` tiene ID, impacto, evidencia y asignación. `PROJECT_STATE.md` mantiene `G-VR01` sin aprobar. |
| 8 | Contradicciones | PASS | La fase A, la fase B y los archivos autorizados concuerdan con la ruta, la spec, el plan y `AGENTS.md`. No se detectó contradicción nueva. |

## Matriz de criterios

`Sí` significa que se leyó una aserción que comprueba el criterio dentro del alcance de fase A. Los recorridos reales de fase B todavía no son resultados de prueba.

| Criterio | Prueba | ¿Aserción verifica el criterio? | Resultado |
|---|---|---|---|
| C-01 | T-01, T-02 | Sí | Pasa |
| C-02 | T-03, T-36 | Sí | Pasa |
| C-03 | T-27 | Sí | Pasa |
| C-04 | T-06, T-07 | Sí | Pasa; mutación detectada |
| C-05 | T-05, T-06, T-08, T-30, T-36 | Sí | Pasa |
| C-06 | T-04, T-05 | Sí | Pasa |
| C-07 | T-09, T-36 | Sí | Pasa |
| C-08 | T-11, T-33 | Sí | Pasa; mutación detectada |
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
| C-29 | T-23, T-43 | Sí: probe exitoso, confirmación y listado con claves exactas y valores excluidos | Pasa; mutación de R-01 detectada |
| C-30 | T-25, T-29 | Sí | Pasa |
| C-31 | T-26 | Sí | Pasa |
| C-32 | T-10, T-52 | Sí | Pasa |
| C-33 | T-38, `db:check:test` | Sí | Pasa |
| C-34 | T-39, T-40, T-41 | Sí | Pasa |
| C-35 | T-42, diff documental | Sí | Pasa |
| C-36 | T-44 | Pendiente, fase B | Sin ejecutar |
| C-37 | T-45 | Pendiente, fase B | Sin ejecutar |
| C-38 | T-46 | Sí | Pasa |
| C-39 | T-47 | Sí | Pasa |
| C-40 | T-47 | Sí | Pasa |
| C-41 | T-48 y preflight real registrado | Sí para fase A | Pasa; revocación real pendiente de VR-01 |
| C-42 | T-07 | Sí | Pasa; mutación detectada |
| C-44 | T-50 | Sí para UI; acta pendiente de fase B | Pasa en fase A |
| C-45 | T-51 | Sí | Pasa |
| C-46 | T-52 | Sí | Pasa |

## Roturas controladas

Cada mutación empezó con una copia binaria de `src/modules/integrations/lifecycle.ts` en un directorio temporal fuera del repositorio. El `finally` restauró los bytes de la copia y la comparación binaria (`cmp`) devolvió `true` en los tres casos. El hash SHA-256 final del archivo fue `dd77d52cb91d71e7f96fbe3a237ca4358fe81b222b88166f9f6b5a7715923435` y `git diff --exit-code HEAD -- src/modules/integrations/lifecycle.ts` no mostró cambios.

| Criterio | Rotura | Prueba que la detectó | Restaurado (`cmp`) |
|---|---|---|---|
| C-04/C-42 | Una clave sin coincidencia devuelve `conectado` | T-07: exit 1 | Sí |
| C-08 | Se omite `begin_disconnect` para una pendiente vencida | T-11: exit 1 | Sí |
| C-29 | El registro `prueba ok` agrega `leak: account.id` | T-23: exit 1 por aserción, sin `ENOENT` | Sí |

Después de restaurar: T-23 pasó 1/1 y T-07/T-11 pasaron 3/3. La primera captura de salida de la mutación C-29 falló por decodificación `cp1252` de Python y no se contó; se confirmó la restauración por Git y se repitió capturando bytes UTF-8.

## Comandos reejecutados

| Comando | Resultado |
|---|---|
| `git status --porcelain`, `git diff main...HEAD`, `git diff`, lectura de archivos nuevos y modificados | Rama y estado previos documentados; cambio completo y corrección posterior inspeccionados. |
| `npm run db:check:test` | Exit 0; destino desechable y rol de pruebas confirmados. No se copia el identificador del proyecto. |
| `npm run verify` | Primera corrida: exit 1 por seis importaciones `ENOENT` temporales de Vitest en el sandbox. Repetición fuera del sandbox: exit 0, lint, typegen, typecheck, 580/580 pruebas y build. |
| `npm run test:policies` | Primera corrida: `ENOTFOUND` desde el sandbox. Repetición con red: exit 0, 13 archivos, 14 ejecuciones y 482/482 aserciones. |
| `npm run test:app` | Exit 0, 9 archivos, 57 pasadas y 7 omitidas opt-in ajenas a Meta. |
| Pruebas focalizadas de mutación y restauración | Tres roturas detectadas; igualdad binaria tras cada restauración; cuatro casos originales pasaron. |
| Búsqueda de patrones; `git diff main -- supabase/migrations` | Sin coincidencias sensibles ni migraciones modificadas. |
| `git diff main...HEAD --check`; `git diff --check` | Solo tres espacios finales en `qa-review-1.md`, informe previo y ajeno a esta implementación. |

## Hallazgos

No hay hallazgos nuevos en esta ronda. **R-01 / `H-E1-119` está corregido y verificado** por la mutación de C-29. No se modificaron `docs/HALLAZGOS.md`, código ni pruebas en esta revisión.

## Pendientes del usuario

La siguiente revisión del pipeline es `$qa-review M16.2` sobre este mismo estado. Para la fase B siguen pendientes `G-ACTA-META`, P-04, la entrega y el despliegue de la fase A, VD-01, el alta y cierre del registro, VR-01 y la aprobación visible de `G-VR01`, según el plan. Ninguna de esas acciones se atribuye a esta revisión.
