# Auditoría de plan — M06.1a-M06.2a (1)

- **Fecha:** 2026-09-27
- **Commit:** `3eea43a` (`main`); `plan.md` sin seguimiento en el árbol de trabajo
- **Hash de contenido de la spec:** `e57d8a7fefc5c45575343d9c045c9e096b97b063`
- **Hash de contenido del plan:** `be9885c30f31a064aa35df51d4e11cee14043466`
- **Plan:** `docs/FASES/FASE1/M06.1a-M06.2a/plan.md`, estado `BORRADOR` (`plan.md:3`)

## Precondiciones

| Precondición | Resultado |
|---|---|
| Spec en `APROBADA` | Cumplida (`spec.md:3`) |
| Última auditoría de spec APROBABLE | Cumplida: `spec-audit-5.md`, APROBABLE |
| Hash actual de la spec igual al auditado | Cumplida: `e57d8a7…` en `spec-audit-5.md:5` y en el cálculo actual |
| Plan existe y está en `BORRADOR` | Cumplida |

## Veredicto

**APROBABLE.** Los 12 ítems del checklist están en PASS. Hay dos observaciones de severidad baja que no afectan el veredicto ni exigen cambiar el plan.

## Checklist

| # | Ítem | PASS/FAIL/NO APLICA | Evidencia o justificación |
|---:|---|---|---|
| 1 | Spec base | PASS | `plan.md:7` cita la spec APROBADA con hash `e57d8a7fefc5c45575343d9c045c9e096b97b063`, que coincide con el cálculo actual y con `spec-audit-5.md:5`. |
| 2 | Cobertura | PASS | Se revisaron uno por uno todos los IDs. C-01 a C-38 están en los pasos 1 a 14; por ejemplo, C-29 está en el paso 4, C-30 a C-32 en el 3, C-33 en los pasos 2, 6 y 9, C-34 en el 6 y C-37 en los pasos 5 y 8. T-01 a T-48 también están cubiertos: T-01 a T-03, T-38, T-40, T-41 y T-44 en el paso 12; T-04 a T-15 en el 3; T-16, T-42 y T-48 en el 4; T-17 a T-31, T-39 y T-45 a T-47 en el 5; T-32 en los pasos 2 y 9; T-33 y T-34 en el 6; T-35 y T-36 en el 10; T-37 en el 11; T-43 en los pasos 12 y 14. Los heredados CA-01 a CA-68, la sección 5b y CB-01 a CB-06 aparecen en las columnas de criterios. |
| 3 | TDD | PASS | Todas las pruebas se escriben en los pasos 2 a 6 y se ejecutan en rojo en el paso 6, antes de implementar `0012` en los pasos 7 a 9. Las excepciones están justificadas en `plan.md:68`: T-14 y `01` a `07` son regresiones, la parte 1 de T-32 es una hipótesis y los controles documentales no llevan rojo previo. Una suite omitida no cuenta como rojo (`plan.md:56`). |
| 4 | Archivos | PASS | `plan.md:27-39` solo lista `0012` (II.4), `08`, `09`, `09b`, `10` y la prueba Data API (II.5), además de los tres archivos de seguimiento (precondición 8) y `plan.md` y `revisiones/*.md` (precondición 9). El script del ensayo vive fuera del repositorio, como autoriza la spec (§12.5). No se usa ninguna ruta sugerida alternativa. |
| 5 | Pasos | PASS | El orden sigue la dependencia: rama y destino (1), parte 1 de `10` sola (2), pruebas (3 a 6), migración (7 y 8), ensayo y decisión D-05 (9), push del usuario (10), verificación (11), revisión estática (12), evidencia (13) y gate (14). Cada paso tiene su propia verificación. En los pasos 7 y 8 es una revisión estática, y el paso 9 lo ejecuta. |
| 6 | Migraciones | PASS | Hoy existen `0001` a `0011`, así que la siguiente es `0012` y es la única nueva (`plan.md:198`). La corrección de `reports_context_fkey` va dentro de `0012` y no toca `0003`. La reversión posterior al push se hace con una migración nueva y nunca editando `0012` (`plan.md:231`). |
| 7 | Comandos | PASS | Los cinco scripts están en `package.json:17-26`: `db:check:test`, `db:push:test`, `test:policies`, `test:app` y `verify`. Los comandos de Git (`switch -c`, `diff --name-status`, `ls-files -co --exclude-standard`, `ls-tree -r --name-only`, `status -sb`, `branch -vv`, `log main..HEAD`) tienen sintaxis válida. Para `grep`, se ejecutó T-44 sobre la spec actual y no devolvió coincidencias. El patrón de T-38 no encuentra nada en `HALLAZGOS.md`, `PROJECT_STATE.md` ni `plan.md`. Están todas las suites de III.3 para M06.1a y M06.2a, más `verify` (`plan.md:76-82`). CB-06 aparece en `plan.md:88`. |
| 8 | Acciones reservadas | PASS | `db:push:test` lo corre el usuario en el paso 10 y se verifica después con `test:policies`, sobre todo con `09` (`plan.md:60`, `:184`). El push de la rama, el despliegue y el `db:push` al proyecto `app` quedan como acciones futuras del usuario, cada una con su verificación (`plan.md:188-190`). Los commits antes de las revisiones y la aprobación de `G-DB-META` están en los pasos 13 y 14. `.claude/settings.json` deniega `db:push*` y `git push*`. |
| 9 | Reglas | PASS | Los fixtures son sintéticos (`plan.md:66`) y T-38 cubre el diff. El tenant se valida en el servidor, por membresía en `company_members` y lectura por `id` y `company_id` (paso 8). Las credenciales solo se leen y escriben por `worker_api`: la Data API siembra por `worker_api` y ninguna aserción usa esa conexión. Las pruebas corren solo contra el proyecto desechable: `db:check:test`, `resolveSqlTestTarget`, nunca la URL de `app`, y `db:preview` no se usa. |
| 10 | Trampas | PASS | Las tres trampas de II.4, las tres de II.5 y la hipótesis de PostgreSQL 16 o posterior están cubiertas en los pasos 2 a 5 y 8. Las trampas 8 a 18 de la spec tienen su fila en la tabla de riesgos (`plan.md:235-256`), igual que H-S-01 a H-S-10 (`plan.md:277-280`). |
| 11 | Git | PASS | Todo el trabajo va en la rama `mf/M06.1a-M06.2a`, creada desde `main` (`git switch -c mf/*` está permitido en la configuración). No hay reset, borrado del historial, commit del asistente ni push (`plan.md:269`). |
| 12 | Fidelidad | PASS | Las firmas y el diseño se toman literalmente de la spec (`plan.md:47`). El caso nulo de `p_client_business_id` que se agrega a T-45 (A-01) prueba un comportamiento que la spec ya exige: la regla de §8 hace obligatorio todo parámetro que no figure como opcional. No es funcionalidad nueva. Hacer siempre el ensayo es la opción que la spec recomienda (§12.5). No se omite nada de la secuencia de §12 ni de la Verificación. |

## Hallazgos

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| P-01 | baja (observación) | 9; Migraciones | El plan no fija el comando concreto del ensayo. Además, un script ubicado en el scratchpad, fuera del repositorio, no resuelve `import pg from 'pg'` ni `./lib/env.mjs` desde el `node_modules` del proyecto. | `plan.md:200-207`; `scripts/run-pgtap.mjs:4-7` | Ningún cambio obligatorio. Al ejecutarlo, importar `pg`, `scripts/lib/env.mjs` y `scripts/lib/sql-target.mjs` con rutas absolutas del repositorio (`createRequire` o `file://`), y registrar el comando exacto en la sesión. |
| P-02 | baja (observación) | Intervenciones, "Antes de la auditoría del plan" | El plan pide que el usuario lo commitee en `BORRADOR` antes de auditarlo, pero se auditó sin seguimiento. La auditoría queda atada al hash `be9885c…`. | `git status`: `?? docs/FASES/FASE1/M06.1a-M06.2a/plan.md`; `plan.md:183`, `:282` | Commitear exactamente este contenido y verificar que el hash siga siendo `be9885c30f31a064aa35df51d4e11cee14043466` antes de aprobar. Si cambia, hay que volver a auditar. |

## Observación de tamaño

El grupo junta dos IDs de hasta 8 horas cada uno: doce funciones PL/pgSQL, cuatro archivos pgTAP con unos cuarenta casos, una prueba Data API, el ensayo y el push. Probablemente no entre en un solo corte de 8 horas. El plan ya prevé frenar y proponer una subdivisión (`plan.md:256`). Si hace falta, esta es la separación compatible con la ruta y con `spec-audit-5`:

- **Corte 1:** pasos 1 a 3 (rama, parte 1 de `10` y `09`), 7 y 8 (`0012` completa), y ensayo solo con `01` a `07`, `09` y la parte 1 de `10`.
- **Corte 2:** `08`, `09b`, parte 2 de `10` y la prueba Data API (pasos 4 a 6), ensayo completo (paso 9), push del usuario y verificación (pasos 10 a 14).

Hay un detalle a respetar si se corta así. Para mantener TDD sobre el grupo, el rojo de `08` y `09b` se registra antes de ajustar `0012` en el corte 2. Además, `0012` no se aplica con `db:push:test` hasta que termine el ensayo completo. `G-DB-META` sigue siendo un gate único al final.

## Verificaciones ejecutadas

| Comando | Resultado |
|---|---|
| `git status --short`, `git rev-parse HEAD`, `git branch` | `main@3eea43a`; solo `plan.md` sin seguimiento; la rama `mf/M06.1a-M06.2a` no existe |
| `grep -v '^\*\*Estado:\*\*' …/spec.md \| git hash-object --stdin` | `e57d8a7fefc5c45575343d9c045c9e096b97b063` |
| `grep -v '^\*\*Estado:\*\*' …/plan.md \| git hash-object --stdin` | `be9885c30f31a064aa35df51d4e11cee14043466` |
| `ls supabase/migrations/` | `0001` a `0011`; la siguiente libre es `0012` |
| T-44 (`grep … spec.md \| grep -v T-44`) | Sin coincidencias |
| Patrón de T-38 sobre `HALLAZGOS.md`, `PROJECT_STATE.md` y `plan.md` | 0 coincidencias en cada uno |
| Lectura de `package.json`, `.claude/settings.json`, `PROJECT_STATE.md`, `tests/app/helpers.ts` (exportaciones), `scripts/lib/sql-target.mjs`, `scripts/run-pgtap.mjs` y `0001` (`touch_updated_at`) | Existen los helpers, scripts y permisos que cita el plan |

No se leyó `.env.local` ni se ejecutó nada contra una base remota.

## Siguiente paso

Primero, el usuario commitea `plan.md` sin cambios y confirma que el hash sigue siendo `be9885c30f31a064aa35df51d4e11cee14043466`. Después lo aprueba: "Apruebo el plan de M06.1a-M06.2a: pasá el estado a APROBADO". Por último, elige modelo y esfuerzo, abre una sesión nueva y corre `/microfase M06.1a-M06.2a`.
