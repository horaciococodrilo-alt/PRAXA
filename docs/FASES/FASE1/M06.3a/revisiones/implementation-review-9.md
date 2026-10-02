# Revisión de implementación M06.3a — 9

## Estado revisado

- Fecha: 2026-10-02. Rama: `mf/M06.3a`.
- Al iniciar: HEAD `c89d67a699e8359e1fd84f911e41342385409be1`, con seis archivos modificados (sesión, hallazgos, dos módulos y dos suites). La skill exige fotografiar y preservar el estado; no exige un árbol limpio. `docs/PROJECT_STATE.md` indica **VERIFICADO — PENDIENTE DE NUEVA REVISIÓN Y QA** y la sesión registra **VERIFICADO — PENDIENTE DE APROBACIÓN**. `G-DB-META` está aprobado.
- Durante las verificaciones, un proceso ajeno creó `56f71b7a81e72371f7e9e20f2619d5dfdf7f2923` e incorporó esos seis archivos y `implementation-review-8.md`. El árbol quedó limpio. La revisión 8 se detuvo antes de probar; esta revisión analiza el estado completo ya fijado en `56f71b7`.
- Base (`git merge-base main HEAD`): `80e5bf33c344da08f3648c0af10f7cfdbee2605e`. Hash del estado, excluidos los informes de revisión con el comando de la skill: `dd9b8e6d4abb82049c11105d5d3988210bc51a5f`. Era idéntico antes y después del commit externo. `git diff main...HEAD`, `git diff`, `git status --porcelain` y el contenido de los archivos nuevos o modificados fueron inspeccionados. Al cierre solo se agrega este informe.

## Veredicto

**APROBABLE.** Los ocho puntos del checklist pasan. `G-CRYPTO` continúa pendiente de aprobación visible; M28.2a no está habilitada. Las siete omisiones de `test:app` corresponden a tres pruebas de correo opt-in y cuatro avisos negativos ajenos a M06.3a; la suite del rol fue ejecutada.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Alcance | PASS | Los archivos funcionales y documentales de `git diff main...HEAD` están en la tabla de archivos de `plan.md` (incluido README), además de seguimiento y revisiones. Las seis correcciones recientes cubren Q-01, Q-02, Q-04 y Q-05 de `qa-review-4.md`; no hay rutas OAuth, worker ni migración nueva. |
| 2 | Criterios | PASS | Matriz siguiente: los T-01–T-53 y las aserciones nuevas se contrastaron con C-01–C-27, CA heredados y CB. T-37 ahora usa alias de `pg` y control positivo de construcción de Pool; T-49/T-22 cubren identidad efectiva y puerto literal. |
| 3 | Pruebas detectan roturas | PASS | Tres roturas funcionales controladas produjeron fallos de aserción (T-22, T-49 y T-08), no meros fallos de arranque. Cada archivo fue copiado fuera del repositorio, restaurado en `finally` y comparado por hash; ver tabla. Un primer intento de mutación AAD dio error sintáctico y un segundo no encontró el patrón; ninguno se contó como prueba funcional. Ambos terminaron restaurados. |
| 4 | Reejecución | PASS | `db:check:test` exit 0; `test:app` exit 0, 37 pasadas/7 omitidas; `verify` exit 0, 197/197 y build. Coincide con la sesión de implementación. Los primeros `verify` y `test:app` fallaron al iniciar Vitest por `spawn EPERM` del sandbox; se repitieron fuera de él y pasaron. |
| 5 | Seguridad y reglas | PASS | Búsqueda en código y pruebas de `act_[0-9]{6,}`, `sb_secret_`, clave privada y `service_role`: sin coincidencias. T-25 recorre el árbol y pasa dentro de `verify`. Ninguna lectura de `.env.local`. `git diff --name-only main -- supabase/` y archivos nuevos en `supabase/`: sin salida. K01 aporta empresa y actor; los cuatro módulos nuevos empiezan con `import 'server-only'`; errores tipados con mensajes fijos, sin `cause`. |
| 6 | Calidad funcional | PASS | Errores de material/llavero/SQL, conflictos de generación y versión, transporte/timeout, respuestas inválidas, URL y TLS tienen rutas explícitas. Las guardas se ejecutan antes de construir `Pool`. Sin `any`, TODO o supresiones de tipos en los módulos nuevos. Las pruebas nuevas comprueban el comportamiento efectivo del parser instalado. |
| 7 | Evidencia | PASS | La sesión registra comandos, conteos, fallos y repeticiones; `H-E1-44`–`H-E1-47` tienen ID, impacto, evidencia, asignación y resolución. `PROJECT_STATE.md` no aprueba `G-CRYPTO`. |
| 8 | Contradicciones | PASS | No se encontró contradicción con ficha Parte I, II.6, III.3, III.9, spec/plan aprobados y `AGENTS.md`. La aceptación de TLS en URL administrativa de referencia, y el rechazo en URL del rol, concuerdan con la decisión del usuario documentada en la sesión. |

## Matriz de criterios

| Criterio | Prueba | ¿La aserción verifica el criterio? | Resultado |
|---|---|---|---|
| CA-21 | T-31–T-33 | Sí: rol real, `42501` en tablas y lectura por función | PASS |
| CA-23, CA-11b | T-03, T-04, T-08, T-19, T-34 | Sí: GCM, IV nuevo y AAD de empresa/conexión | PASS |
| CA-24 | T-06–T-09, T-34 | Sí: alteraciones y cambio de empresa fallan | PASS |
| CA-25 | T-10–T-16, T-35, T-36, T-44 | Sí: versión actual, recifrado y conteo para retiro | PASS |
| CA-26 | T-17, T-20, T-25, T-26, T-51–T-53 | Sí: errores redactados y recorrido del árbol | PASS |
| CA-27 | T-21 | Sí: cinco reglas nuevas, dos originales conservadas | PASS |
| CB-01–CB-06 | T-24, T-27–T-40; `verify`; `test:app` | Sí: suites, destino, secretos, migración y omisiones comprobadas | PASS |
| C-01 | T-01, T-02 | Sí: parseo y rechazos de llavero | PASS |
| C-02 | T-03–T-05 | Sí: sello, tamaños y texto inválido | PASS |
| C-03 | T-06–T-09 | Sí: autenticación y validación previa | PASS |
| C-04 | T-10, T-11 | Sí: versión ausente diferenciada | PASS |
| C-05 | T-11–T-13, T-16, T-35 | Sí: recifrado condicional y retiro | PASS |
| C-06 | T-14, T-15, T-36, T-41 | Sí: estados y carrera con `PX006` real | PASS |
| C-07 | T-18, T-21 | Sí: mapa SQL, aridad, pool y módulo acotado | PASS |
| C-08 | T-17, T-53 | Sí: SQLSTATE, transporte y redacción | PASS |
| C-09 | T-12, T-19, T-51 | Sí: contexto K01 y AAD del UUID nuevo | PASS |
| C-10 | T-20 | Sí: `SecretValue` no revela en serializaciones | PASS |
| C-11 | T-28, T-40 | Sí: `pg` en producción, lockfile y build | PASS |
| C-12 | T-21 | Sí: invariantes de privilegios | PASS |
| C-13 | T-22, T-27, T-49 | Sí: destino de rol, overrides, parser y puerto literal | PASS |
| C-14 | T-23, T-24 | Sí: excepción antigua inoperante y literal limitado a T-23 | PASS |
| C-15 | T-25, T-26 | Sí: patrones, autoprueba y exclusión sin lectura | PASS |
| C-16 | T-29 | Sí: diff documental inspeccionado | PASS |
| C-17 | T-30 | Sí: variables vacías y sección revisada | PASS |
| C-18 | T-31–T-37, T-41, T-43 | Sí: rol real, operaciones y fallo obligatorio sin variable | PASS |
| C-19 | T-38 | Sí: mocks por suite, sin alias global | PASS |
| C-20 | T-39 | Sí: sin cambios ni archivos nuevos en `supabase/` | PASS |
| C-21 | T-42, T-43, T-51 | Sí: reutilización exacta y rechazo de objeto forjado | PASS |
| C-22 | T-44, T-36 | Sí: retiro exige detener writers y conteo cero; desconexión cuenta | PASS |
| C-23 | T-45, T-46, T-52 | Sí: estado de rewrap confirmado/no confirmado/sin intento | PASS |
| C-24 | T-47 | Sí: TLS en URL del rol rechazado antes de Pool | PASS |
| C-25 | T-48, T-50, T-31 | Sí: CA, verificación y conexión TLS real | PASS |
| C-26 | T-22, T-49 | Sí: identidad efectiva, host y puerto del parser `pg` | PASS |
| C-27 | T-51–T-53 | Sí: entradas y respuestas inválidas sin fuga | PASS |

## Roturas controladas

| Criterio | Rotura | Prueba que la detectó | Restaurado (comparación) |
|---|---|---|---|
| C-13/C-26 | Desactivar rechazo de codificación ambigua en `scripts/lib/sql-target.mjs` | T-22/T-49: fallo de aserción, exit 1 | Sí, hash idéntico |
| C-26 | Desactivar rechazo de codificación ambigua en `worker-api.ts` | T-49: aceptó URL prohibida, exit 1 | Sí, hash idéntico |
| CA-11b/C-03 | Quitar AAD del sello y apertura en `seal.ts` | T-08: cambio de empresa dejó de fallar, exit 1 | Sí, hash idéntico |

## Comandos reejecutados

- `npm run db:check:test` → exit 0, `Destino verificado.` para la base desechable y URL del rol; sin valores de entorno en el informe.
- `npm run test:app` → exit 0, 6 archivos, 37 pasadas y 7 omitidas; suite del rol ejecutada. Primer intento: `spawn EPERM` del sandbox antes de cargar Vitest; repetición autorizada exit 0.
- `npm run verify` → exit 0: lint, typegen, typecheck, 10 archivos/197 pruebas y build Next. Primer intento: `spawn EPERM` antes de cargar Vitest; repetición autorizada exit 0.
- `rg -n SUPABASE_TEST_ALLOW_APP_PROJECT scripts tests src .github docs/SECURITY.md .env.example README.md` → tres líneas, todas en T-23.
- Inspección de dependencias → `true false true` para `pg` en producción, `pg` en desarrollo y `@types/pg` en desarrollo. `npm ci --dry-run --offline` → exit 0.
- `git diff --check` → exit 0; diff y archivos nuevos de `supabase/` → ninguno. Búsqueda de patrones de secreto/identificador en módulos y suites modificados → cero coincidencias.

## Hallazgos

Ningún hallazgo nuevo. Q-01/Q-02/Q-04/Q-05 de QA 4 quedaron corregidos y registrados como `H-E1-44`–`H-E1-47`; se verificó la corrección en código, pruebas y tres roturas. La CI Linux no se ejecutó localmente.

## Pendientes del usuario

Aprobación visible de `G-CRYPTO` después de QA. Esta revisión no modifica `PROJECT_STATE.md`, no habilita M28.2a y no hace commit, push ni despliegue.
