# M16.2 — Auditoría del plan, ronda 3

- **Fecha:** 2026-10-16 (America/Buenos_Aires).
- **Commit inspeccionado:** `65404aa100788a4eab5e98dbcfa6c116c8fa0bc1`, rama `main` (el plan se audita antes de crear `mf/M16.2`).
- **Spec base:** `docs/FASES/FASE1/M16.2/spec.md`, estado `APROBADA`.
- **Última auditoría de spec:** `revisiones/spec-audit-4.md`, **APROBABLE**.
- **Hash de contenido de la spec:** `0b92d68f3042983fb37fd0339d9715071758cc7b` (coincide con `spec-audit-4` y con el que cita el plan).
- **Plan auditado:** `docs/FASES/FASE1/M16.2/plan.md`, estado `BORRADOR`.
- **Hash de contenido del plan:** `46136991124b81cbe8b83fb577cc847c9b6c6755`.

Los hashes se calcularon con `grep -v '^\*\*Estado:\*\*' <archivo> | git hash-object --stdin`.

**Límite de independencia.** Esta auditoría la ejecutó la misma sesión que redactó la corrección del plan tras la ronda 2. Se verificó cada afirmación contra los archivos y el código, no contra la memoria de la redacción, pero conviene repetir la próxima ronda en una sesión nueva si se quiere una revisión sin ese sesgo.

## Veredicto

**REQUIERE CAMBIOS.**

La reestructuración en dos fases resuelve el defecto de orden de la ronda 2 y se sostiene frente al pipeline. Las cuatro precondiciones se cumplen, la cobertura es completa y los archivos están contenidos en II.10. Quedan tres defectos del plan:

- **P-05 (media).** El paso 4 usa símbolos que el plan define recién en pasos posteriores: los resultados `desconectado` y `desconexion_en_curso`, y el tipo de `log` de `MetaOAuthDeps`. El paso 4 no compila hasta el paso 5 o 6.
- **P-06 (media).** La comprobación «la versión desplegada es la revisada» (paso 14) compara una lista cerrada de rutas y deja fuera archivos que afectan el despliegue.
- **P-07 (baja).** El plan no resuelve la contradicción entre la ficha (que lista `G-ACTA-META` como dependencia) y el skill `/microfase` (que frena ante una dependencia sin aprobar), por lo que la fase A podría quedar bloqueada sin motivo.

## Verificación de la ronda 2

| Hallazgo anterior | Estado | Evidencia |
|---|---|---|
| P-01 (orden de despliegue y revisiones) | Resuelto | El plan separa la fase A (pasos 0 a 13), la entrega E1 a E5 y la fase B (14 a 17). Define la versión desplegada **D** idéntica a la revisada **R**, los requisitos por etapa del PR, del merge y del gate, y un procedimiento si VR-01 exige cambios de código. La tabla «Cómo se resuelve cada regla del pipeline» se contrastó con `microfase` §4 y §7, `implementation-review` §1 y `qa-review` §1 y §5. Sigue una salvedad de lectura del skill, en la sección de observaciones |
| P-02 (trampa 7) | Resuelto | Paso 16: declaración en la sesión de que el id de la cuenta puede verse en las subpeticiones de Insights; también en «Riesgos» |
| P-03 (`M03a`) | Resuelto | Paso 14 (c) y tabla de intervenciones («En paralelo, antes de 14: solicitar y cerrar `M03a`»); «Riesgos» describe el bloqueo del paso 14 sin afectar la fase A |
| P-04 (texto desactualizado y rutas) | Resuelto | Cero rutas absolutas en el plan; el encabezado ya no menciona `BORRADOR` de la spec; el comando del preflight es el de la spec (`node --env-file=.env.local scripts/meta-preflight.mjs`) |

## Comprobaciones mecánicas

| Comprobación | Resultado |
|---|---|
| Criterios operativos | 45 (C-01 a C-46, sin C-43). Los 45 aparecen en la tabla de pasos, expandiendo rangos. Ninguno citado es inexistente |
| Casos de prueba | 51 (T-01 a T-52, sin T-49). Los 51 aparecen en la tabla de pasos. Ninguno citado es inexistente |
| Pasos | 18 filas, numeradas 0 a 17 |
| Archivos del plan | 31 (F01 a F31). La única diferencia con «Archivos previstos» de la spec es `tests/unit/__qa__/*`, temporal y autorizado por la precondición 9 |
| Archivos frente a II.10 | Ningún archivo de código o pruebas del plan queda fuera de II.10 enmendada. F29 a F31 son los tres archivos de seguimiento (precondición 8) |
| Migraciones | `supabase/migrations/` termina en `0014_profile_photos.sql`. El plan no crea ninguna |
| Scripts | `test:unit`, `test:component`, `test:app`, `test:policies`, `db:check:test` y `verify` existen en `package.json` |
| Comandos de Git y de Node | `git switch`, `git merge main`, `git diff --stat R D -- <rutas>`, `git diff --name-only main...mf/M16.2`, `git diff --check` y `node --env-file=.env.local scripts/meta-preflight.mjs` tienen sintaxis válida; `engines` exige Node ≥ 24, que admite `--env-file` |

## Checklist

| # | Ítem | Resultado | Evidencia |
|---:|---|---|---|
| 1 | Spec base | PASS | El plan cita la spec y `0b92d68f…`; el hash recalculado coincide con el del plan y con `spec-audit-4` |
| 2 | Cobertura | PASS | 45/45 criterios y 51/51 casos con destino (comprobación mecánica). C-36 y C-37 quedan en la fase B y así lo dice «Requisitos por etapa» |
| 3 | TDD | PASS | La regla anterior a la tabla exige rojo antes del código. T-30 a T-38 se preparan en el paso 0; los pasos 1 a 8 y 10 escriben primero sus pruebas. Los pasos de usuario, documentación, verificación y la fase B no requieren rojo, y «Verificación final» lo justifica. El procedimiento de corrección de la fase B exige una prueba en rojo antes del arreglo |
| 4 | Archivos | PASS | Contenidos en II.10 y en el seguimiento (comprobación mecánica). Las enmiendas de la ruta ya están aplicadas y aprobadas |
| 5 | Pasos | **FAIL** | El paso 4 depende de definiciones de pasos posteriores. Ver P-05. Además, la contradicción de dependencias de P-07 |
| 6 | Migraciones | NO APLICA | M16.2 no crea migraciones, y el plan lo declara con motivo. Prohíbe modificar las existentes y exige una migración nueva para cualquier reversión. `0014` es la última; `0015` queda para M16c |
| 7 | Comandos | PASS | Todos los scripts existen y la sintaxis de los comandos de Git y de Node es válida (comprobación mecánica). Están las suites de III.3 y CB-06 en «Verificación final», en el requisito de la etapa del PR y en el paso 13. El preflight usa `node` directo, como exige la spec |
| 8 | Acciones reservadas | **FAIL** | Push, PR, Codex, CI, merge, despliegue, preflight, VD-01, `G-ACTA-META`, alta y aprobación de `G-VR01` están en el paso correcto y con verificación posterior. `db:push` y `db:push:test` se declaran no aplicables. Pero la verificación posterior al despliegue (paso 14, a) es incompleta. Ver P-06 |
| 9 | Reglas | PASS | K01 construido y validado en el servidor (pasos 3 y 5); credenciales y escrituras solo por `worker_api`; pruebas solo contra el proyecto desechable (`db:check:test` en 0 y 9; «Ninguna suite automatizada ni fixture se ejecuta contra `app`»); sin secretos ni datos reales; el preflight real lo corre el usuario sin que el asistente lea `.env.local` |
| 10 | Trampas | PASS | Las 22 trampas de la spec y las cuatro de II.10 tienen paso o verificación. Se contrastó una por una, incluida la trampa 7 (paso 16 y «Riesgos») y la 22 (paso 6, T-52) |
| 11 | Git | PASS | Todo el trabajo de implementación ocurre en `mf/M16.2`; la fase B vuelve a esa rama actualizada con `main` por `git merge main`, sin `rebase`, `--force`, `reset --hard` ni `branch -D`. Push, PR y merge los hace el usuario |
| 12 | Fidelidad | PASS | El plan implementa lo que pide la spec y no agrega funcionalidad, dependencias, variables ni esquema. Lo nuevo (fase A/B, entrega, PR de cierre) es proceso del pipeline y no funcionalidad |

## Hallazgos

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| P-05 | media | 4 (y 5, 6) | **El paso 4 usa símbolos que el plan define después.** (a) Implementa `disconnect`, cuyo tipo de retorno `DisconnectOutcome` es `Extract<MetaOAuthOutcome, 'desconectado' \| 'desconexion_en_curso' \| 'sin_empresa' \| 'error'>` (spec §9.4). `desconectado` y `desconexion_en_curso` son resultados nuevos de `outcomes.ts` (spec §14), y F09 figura en los pasos 5, 6 y 8, pero no en el 4. (b) Integra `runLazyPurge` en `handleMetaStart` pasándole `log`, `http`, `config`, `workerApi`, `keyring` y `now` de `MetaOAuthDeps`. `LifecycleDeps.log` recibe `MetaLifecycleLogEvent`, y hoy `MetaOAuthDeps.log` solo acepta `MetaOAuthLogEvent` (`oauth.ts:55-70`). La ampliación del tipo (spec §13) no está asignada a ningún paso, y haría falta en el 4. Las pruebas de Vitest no chequean tipos, así que los pasos 4 y 5 pasan en verde, y el error de `typecheck` aparece recién en el paso 13, con todo el código escrito | Plan, pasos 4, 5 y 6 y tabla de archivos (F09: «5–6, 8»; F08: «4, 6»); spec §9.4, §13 y §14; `src/modules/integrations/meta/oauth.ts:53-70` | Asignar F09 también al paso 4 y que agregue ahí al menos `desconectado` y `desconexion_en_curso`, o todos los resultados nuevos. Asignar al paso 4 la ampliación del tipo de `log` de `MetaOAuthDeps` y la entrada `readConnection`. Agregar `npm run typecheck` a la verificación de los pasos con código (1 a 8) para que el orden se detecte en el paso donde ocurre |
| P-06 | media | 14 (a) | **La comprobación «D tiene el mismo código que R» usa una lista cerrada.** Compara `src scripts tests supabase package.json package-lock.json next.config.ts`. Quedan fuera archivos versionados que cambian lo que se despliega o el entorno de construcción: `public/`, `.github/workflows/verify.yml`, `.nvmrc`, `eslint.config.mjs`, `postcss.config.mjs`, `.env.example` y cualquier archivo de configuración que se agregue. Esta es la única barrera que garantiza que no se despliega nada no revisado, así que no debería depender de una lista que puede quedar desactualizada | Plan, paso 14 (a); `git ls-files` (archivos fuera de `src`, `scripts`, `tests`, `supabase`, `docs`, `package*.json` y `next.config.ts`) | Comparar todo salvo documentación y configuración del asistente: `git diff --stat R D -- . ':(exclude)docs' ':(exclude).claude'`, y exigir salida vacía. Con diferencias, `BLOQUEADO` |
| P-07 | baja | 0 y 14 | **El plan no resuelve la contradicción de dependencias.** La ficha de M16.2 lista `G-OAUTH`, `G-ACTA-META` y P-04 como dependencias, mientras II.10 y la spec los exigen solo para los pasos 10 a 12 (alta y VR-01), y `PROJECT_STATE.md` declara M16.2 «habilitada por `G-OAUTH`». El skill `/microfase` §2 exige que `PROJECT_STATE.md` registre como aprobados «los gates de las dependencias» y frena si no. Con `M03a` sin empezar, una lectura literal bloquearía el paso 0 de la fase A. El paso 0 dice «Confirmar dependencias cerradas, incluidas `G-OAUTH` y `G-ENTORNO`» y no aclara que `G-ACTA-META` y P-04 quedan fuera de la fase A. «Riesgos» lo aclara para el paso 14, pero no el paso 0 ni la tabla de reglas del pipeline | Ficha de M16.2 (Dependencias); II.10 («Requiere para los pasos 10 a 12»); `PROJECT_STATE.md` («Siguiente habilitada»); `.claude/skills/microfase/SKILL.md` §1 y §2; plan, paso 0 | En el paso 0 y en la tabla de reglas del pipeline, decir que `G-ACTA-META` y P-04 se exigen desde el paso 15 (alta y VR-01), según II.10 y la spec, y no para la fase A. Que esa precisión figure como contradicción resuelta |

## Observaciones (no afectan el veredicto)

- **Salvedad de lectura de `/qa-review`.** Su §5 dice que, para abrir el PR, no se posterga «ninguna verificación que el plan exige antes del gate». III.3 de la ruta incluye «alta del dueño y VR-01» para M16.2. El plan resuelve la ambigüedad con una clasificación expresa por etapa, que es lo que el skill pide, pero una lectura literal del skill podría exigir esas verificaciones antes del PR y dar BLOQUEADO. No es un defecto del plan y los skills no se modifican en esta microfase; conviene que el usuario lo sepa al correr `/qa-review`.
- **Tamaño.** M16.2 excede ocho horas por decisión expresa del usuario (D-M16.2-11). Las dos fases con revisión independiente en el medio son un corte razonable dentro de esa decisión. Dentro de la fase A, las etapas son: transporte y adaptadores (1 a 3), ciclo de vida y recuperación (4 a 7), UI e integración (8 a 10) y cierre técnico (11 a 13).

## Siguiente paso

Volver a plan mode, corregir P-05, P-06 y P-07 y auditar de nuevo (ronda 4). Ninguno de los tres cambia el alcance ni requiere decisión del usuario: son precisiones de orden y de verificación. No se pasa el plan a `APROBADO`. Esta auditoría no acredita la implementación, el preflight real, el despliegue, VD-01 ni VR-01.
