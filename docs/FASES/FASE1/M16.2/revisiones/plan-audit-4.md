# M16.2 — Auditoría del plan, ronda 4

- **Fecha:** 2026-10-16 (America/Buenos_Aires).
- **Commit inspeccionado:** `65404aa100788a4eab5e98dbcfa6c116c8fa0bc1`, rama `main` (el plan se audita antes de crear `mf/M16.2`).
- **Spec base:** `docs/FASES/FASE1/M16.2/spec.md`, estado `APROBADA`.
- **Última auditoría de spec:** `revisiones/spec-audit-4.md`, **APROBABLE**.
- **Hash de contenido de la spec:** `0b92d68f3042983fb37fd0339d9715071758cc7b` (coincide con `spec-audit-4` y con el que cita el plan).
- **Plan auditado:** `docs/FASES/FASE1/M16.2/plan.md`, estado `BORRADOR`.
- **Hash de contenido del plan:** `1074e260242a0dd8184833047f7b6a7963c0a9fa`.

Los hashes se calcularon con `grep -v '^\*\*Estado:\*\*' <archivo> | git hash-object --stdin`.

**Límite de independencia.** Las correcciones de P-05, P-06 y P-07 las redactó la misma sesión que ejecutó esta auditoría, a pedido del usuario y justo antes de auditar. Se verificó cada afirmación releyendo el plan desde disco, recalculando las comprobaciones mecánicas y probando los comandos nuevos contra el repositorio, pero esta ronda no es una revisión independiente en el sentido estricto. Si se quiere esa garantía, conviene repetir la auditoría en una sesión nueva antes de aprobar el plan.

## Veredicto

**APROBABLE.** Los 12 ítems están en PASS, con el ítem 6 en NO APLICA justificado. No quedan hallazgos.

Las precondiciones se cumplen. Los tres hallazgos de la ronda 3 están resueltos en el texto del plan.

## Verificación de la ronda 3

| Hallazgo anterior | Estado | Evidencia |
|---|---|---|
| P-05 (el paso 4 usa símbolos de pasos posteriores) | Resuelto | F09 (`outcomes.ts`) pasa a los pasos «4–6, 8» (línea 70). El paso 4 (línea 114) escribe primero la parte de T-25 y T-50 que fija el texto de `desconectado` y `desconexion_en_curso`, agrega esos dos resultados, amplía `MetaOAuthDeps` con `readConnection` y con un `log` que acepta `MetaOAuthLogEvent` y `MetaLifecycleLogEvent`, y exige `npm run typecheck` sin errores en `src/`. Los pasos 5 y 6 agregan los demás resultados nuevos (cinco y dos) y el 6 retira `reautorizacion_no_disponible`; con eso quedan los nueve de la spec §14. La regla «Verificación por paso» (línea 102) exige `typecheck` al cerrar cada paso de código. Se confirmó que `tsconfig.json` incluye `**/*.ts`, de modo que el `typecheck` también cubre las pruebas, y la regla admite expresamente los errores de importación de F17 y F19, preparados en el paso 0 |
| P-06 (comprobación D = R con lista cerrada) | Resuelto | El paso 14 (a), línea 145, compara `git diff --stat R D -- . ':(exclude)docs' ':(exclude).claude'` y exige salida vacía, nombrando `public/`, `.github/`, `.nvmrc` y los archivos de configuración. Se probó el comando contra el repositorio: con el mismo commit no imprime nada y con commits distintos sí imprime diferencias, por lo que la comprobación discrimina |
| P-07 (dependencia `G-ACTA-META`) | Resuelto | El paso 0 (línea 110) aclara que `G-ACTA-META` y P-04 no se exigen en la fase A, con la fuente (II.10 y `PROJECT_STATE.md`). La tabla «Cómo se resuelve cada regla del pipeline» tiene una fila nueva para esta contradicción (línea 40). «Riesgos» (línea 233) dice que, sin `M03a`, quedan bloqueados los pasos 15 y 16 y que el despliegue y VD-01 pueden completarse |

## Comprobaciones mecánicas

| Comprobación | Resultado |
|---|---|
| Criterios operativos | 45 (C-01 a C-46, sin C-43). Los 45 aparecen en la tabla de pasos, expandiendo rangos. Ninguno citado es inexistente |
| Casos de prueba | 51 (T-01 a T-52, sin T-49). Los 51 aparecen en la tabla de pasos. Ninguno citado es inexistente |
| Pasos | 18 filas numeradas 0 a 17, cada una con cinco celdas |
| Archivos del plan | 31 (F01 a F31). La única diferencia con «Archivos previstos» de la spec es `tests/unit/__qa__/*`, temporal y autorizado por la precondición 9 de la ruta |
| Archivos frente a II.10 | Ningún archivo de código o pruebas del plan queda fuera de II.10 enmendada. F29 a F31 son los tres archivos de seguimiento (precondición 8) |
| Rutas y estado | Cero rutas absolutas en el plan. Ninguna mención de `BORRADOR` fuera de la línea de estado |
| Migraciones | `supabase/migrations/` termina en `0014_profile_photos.sql`. El plan no crea ninguna |
| Scripts | `test:unit`, `test:component`, `test:app`, `test:policies`, `db:check:test`, `typecheck` y `verify` existen en `package.json` |
| Comandos de Git y de Node | `git diff --stat R D -- . ':(exclude)docs' ':(exclude).claude'`, `git diff --name-only main...<rama>`, `git switch`, `git merge main`, `git diff --check` y `node --env-file=.env.local scripts/meta-preflight.mjs` tienen sintaxis válida. Se ejecutaron los dos primeros contra el repositorio (Git 2.52 y Node 24.18.1; `engines` exige Node ≥ 24) |

## Checklist

| # | Ítem | Resultado | Evidencia |
|---:|---|---|---|
| 1 | Spec base | PASS | El plan cita la spec y `0b92d68f…`; el hash recalculado coincide con el del plan y con `spec-audit-4` |
| 2 | Cobertura | PASS | 45/45 criterios y 51/51 casos con destino (comprobación mecánica). C-36 y C-37 quedan en la fase B y así lo dice «Requisitos por etapa». Los criterios heredados se cubren por los pasos que cita el plan |
| 3 | TDD | PASS | La regla anterior a la tabla exige rojo antes del código. T-30 a T-38 se preparan en el paso 0; los pasos 1 a 8 y 10 escriben primero sus pruebas, incluida ahora la parte de texto de T-25 y T-50 en el paso 4. Los pasos de usuario, documentación, verificación y la fase B no requieren rojo, y «Verificación final» lo justifica. El procedimiento de corrección de la fase B exige una prueba en rojo antes del arreglo |
| 4 | Archivos | PASS | Contenidos en II.10 enmendada y en el seguimiento (comprobación mecánica). Las enmiendas de la ruta ya están aplicadas y aprobadas. F09 en el paso 4 sigue dentro de II.10 (pasos 2 y 6) |
| 5 | Pasos | PASS | El orden respeta las dependencias: transporte (1), cuentas y probe (2), adaptadores (3), purga con los resultados que necesita (4), selección (5), reautorización (6), efectos (7), UI (8), integración (9), preflight (10 y 11), documentación (12), verificación (13), entrega E1 a E5 y fase B (14 a 17). Cada paso tiene verificación propia, y los pasos de código suman `typecheck`. Se revisaron los símbolos que cada paso importa de los anteriores sin encontrar uno definido después |
| 6 | Migraciones | NO APLICA | M16.2 no crea migraciones, y el plan lo declara con motivo. Prohíbe modificar las existentes y exige una migración nueva para cualquier reversión. `0014` es la última; `0015` queda para M16c |
| 7 | Comandos | PASS | Todos los scripts existen y la sintaxis de los comandos de Git y de Node es válida (comprobación mecánica). Están las suites de III.3 y CB-06 en «Verificación final», en «Requisitos por etapa» y en el paso 13. El preflight usa `node` directo, como exige la spec |
| 8 | Acciones reservadas | PASS | Preflight real (11), commit, `/implementation-review`, `/qa-review`, push, PR, Codex, CI y merge (E1 a E5), actualización de la rama con `main`, `M03a` y `G-ACTA-META`, despliegue (14), VD-01, alta (15), VR-01 (16), PR de cierre y aprobación de `G-VR01` (17) están en el paso correcto, cada uno con su verificación posterior. La verificación de que lo desplegado es lo revisado compara todo salvo documentación y configuración del asistente. `db:push` y `db:push:test` se declaran no aplicables, con la verificación de que no hay migraciones |
| 9 | Reglas | PASS | K01 construido y validado en el servidor (pasos 3 y 5); credenciales y escrituras solo por `worker_api`; pruebas solo contra el proyecto desechable (`db:check:test` en 0 y 9; «Ninguna suite automatizada ni fixture se ejecuta contra `app`»); sin secretos ni datos reales; el preflight real lo corre el usuario sin que el asistente lea `.env.local` |
| 10 | Trampas | PASS | Las 22 trampas de la spec y las cuatro de II.10 tienen paso o verificación, incluidas la trampa 7 (paso 16 y «Riesgos») y la 22 (paso 6, T-52) |
| 11 | Git | PASS | Todo el trabajo de implementación ocurre en `mf/M16.2`. La fase B vuelve a esa rama actualizada con `git merge main`, sin `rebase`, `--force`, `reset --hard` ni `branch -D`. Push, PR y merge los hace el usuario |
| 12 | Fidelidad | PASS | El plan implementa lo que pide la spec y no agrega funcionalidad, dependencias, variables ni esquema. Lo agregado en esta ronda (resultados nuevos en el paso 4, ampliación de `MetaOAuthDeps`, regla de `typecheck`) sale de la spec §13 y §14 o es verificación. La estructura en dos fases y la entrega son proceso del pipeline |

## Hallazgos

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| — | — | — | Ningún hallazgo del checklist | Los doce ítems están en PASS o en NO APLICA justificado | — |

## Observaciones (no afectan el veredicto)

- **Salvedad de lectura de `/qa-review`.** Su §5 dice que, para abrir el PR, no se posterga «ninguna verificación que el plan exige antes del gate», y III.3 de la ruta incluye «alta del dueño y VR-01» para M16.2. El plan resuelve la ambigüedad con una clasificación expresa por etapa, que es lo que el skill pide, pero una lectura literal podría exigir esas verificaciones antes del PR y dar BLOQUEADO. Los skills no se modifican en esta microfase; conviene que el usuario lo sepa al correr `/qa-review`.
- **Falso positivo posible en el paso 14 (a).** La comparación estricta incluye archivos de la raíz como `README.md`. Si `main` avanza con un cambio ajeno en uno de ellos entre el commit revisado y el desplegado, el paso queda `BLOQUEADO` y el usuario decide. Es el lado seguro.
- **Tamaño.** M16.2 excede ocho horas por decisión expresa del usuario (D-M16.2-11). Las dos fases con revisión independiente en el medio son un corte razonable dentro de esa decisión. Dentro de la fase A: transporte y adaptadores (1 a 3), ciclo de vida y recuperación (4 a 7), UI e integración (8 a 10) y cierre técnico (11 a 13).

## Siguiente paso

El usuario aprueba el plan identificado por el hash de este informe (`1074e260…`) con «Apruebo el plan de M16.2: pasá el estado a APROBADO». Después elige modelo y esfuerzo, abre una sesión nueva y corre `/microfase M16.2`.

Cualquier cambio posterior en el plan cambia su hash e invalida esta auditoría. `G-ACTA-META`, P-04, el preflight real, el despliegue, VD-01 y VR-01 conservan sus bloqueos en los pasos correspondientes: esta auditoría no los acredita ni acredita la implementación.
