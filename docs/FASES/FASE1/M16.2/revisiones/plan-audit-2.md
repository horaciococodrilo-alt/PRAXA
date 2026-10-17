# M16.2 — Auditoría del plan, ronda 2

- **Fecha:** 2026-10-16 (America/Buenos_Aires).
- **Commit inspeccionado:** `65404aa100788a4eab5e98dbcfa6c116c8fa0bc1`, rama `main` (el plan se audita antes de crear `mf/M16.2`).
- **Spec base:** `docs/FASES/FASE1/M16.2/spec.md`, estado `APROBADA`.
- **Última auditoría de spec:** `revisiones/spec-audit-4.md`, **APROBABLE**.
- **Hash de contenido de la spec:** `0b92d68f3042983fb37fd0339d9715071758cc7b` (coincide con `spec-audit-4` y con el que cita el plan).
- **Plan auditado:** `docs/FASES/FASE1/M16.2/plan.md`, estado `BORRADOR`.
- **Hash de contenido del plan:** `48dfdd92552fb1adda653887755d097b067a7710`.

Los hashes se calcularon con `grep -v '^\*\*Estado:\*\*' <archivo> | git hash-object --stdin`.

Existe `plan-audit-1.md`, escrito sobre este mismo hash del plan, con veredicto APROBABLE. Esta ronda es una auditoría independiente del mismo texto y **llega a otra conclusión** en los ítems 5, 8 y 10, por los motivos que siguen.

## Veredicto

**REQUIERE CAMBIOS.**

Las cuatro precondiciones se cumplen. La cobertura de criterios y casos, la lista de archivos, los comandos y las migraciones están bien. Hay dos defectos del plan:

- **P-01 (alta).** El plan ubica el merge y el despliegue (paso 14) y el recorrido con datos reales (pasos 15 y 16) **antes** de las revisiones independientes (paso 17). El pipeline del repositorio las exige en el orden contrario, y con el orden del plan las revisiones no se pueden ejecutar. Detalle abajo.
- **P-02 (media).** La trampa 7 de la spec exige declarar en la evidencia que el id de la cuenta viaja en la ruta de las peticiones de Insights. Ningún paso ni verificación del plan lo cubre.

Hay además dos observaciones de severidad baja (P-03 y P-04).

## Fuentes y alcance

Se leyeron el plan y la spec de M16.2 completos; `AGENTS.md`; de `meta_first/plan.md`, la ficha de M16.2, II.10 enmendada (pasos 1 a 12 y 9a a 9d), las "Precondiciones de toda la ruta" (1 a 9), III.3 y III.9; `package.json`; `supabase/migrations/`; y los skills `microfase`, `implementation-review` y `qa-review`, que definen el pipeline. Se contrastó como precedente el plan de M28.2a.

No se ejecutaron suites, el preflight, llamadas a Meta, migraciones ni pruebas contra bases de datos: esta es una auditoría documental del plan.

## Comprobaciones mecánicas

| Comprobación | Resultado |
|---|---|
| Criterios operativos de la spec | 45 (C-01 a C-46, sin C-43). Los 45 aparecen en al menos una fila de la tabla de pasos, expandiendo los rangos "C-NN a C-MM". Ningún criterio citado por el plan es inexistente |
| Casos de prueba de la spec | 51 (T-01 a T-52, sin T-49). Los 51 aparecen en la tabla de pasos. Ninguno citado es inexistente |
| Archivos del plan | 31 (F01 a F31). Los 27 archivos de código y pruebas de "Archivos previstos" de la spec están en el plan; la única diferencia es `tests/unit/__qa__/*`, temporal y autorizado por la precondición 9 de la ruta. Ningún archivo del plan falta en la spec |
| Archivos de código y pruebas frente a II.10 enmendada | Los 28 archivos F01 a F28 figuran en los pasos 1 a 9b de II.10. F23 y F24 están en 9c. F29 a F31 son los tres archivos de seguimiento de la precondición 8 |
| Migraciones | `supabase/migrations/` termina en `0014_profile_photos.sql`. El plan no crea ninguna y reserva `0015` para M16c |
| Scripts npm | `test:unit`, `test:component`, `test:app`, `test:policies`, `db:check:test` y `verify` existen en `package.json` |

## Checklist

| # | Ítem | Resultado | Evidencia |
|---:|---|---|---|
| 1 | Spec base | PASS | El plan cita la spec y `0b92d68f…`; el hash recalculado coincide. El paso 0 vuelve a comprobar estado, auditorías y hashes. Observación de forma en P-04 |
| 2 | Cobertura | PASS | 45/45 criterios y 51/51 casos con destino (tabla de arriba). Los criterios heredados se cubren por los pasos que cita el plan |
| 3 | TDD | PASS | La regla anterior a la tabla exige pruebas y rojo antes del código. T-30 a T-38 se preparan en el paso 0. Los pasos 1 a 8 y 10 escriben primero sus pruebas. Los casos de guarda, regresión, documentación y recorridos manuales están justificados en "Verificación final" |
| 4 | Archivos | PASS | Contenidos en II.10 enmendada y en el seguimiento de la precondición 8 (comprobación mecánica). Las enmiendas de la ruta ya están aplicadas y aprobadas |
| 5 | Pasos | **FAIL** | El orden de los pasos 14 a 17 contradice el pipeline. Ver P-01 |
| 6 | Migraciones | NO APLICA | M16.2 no crea migraciones, y el plan lo declara con su motivo. Aun así prohíbe modificar las existentes y exige una migración nueva para cualquier reversión de esquema. `0014` es la última; `0015` queda para M16c |
| 7 | Comandos | PASS | Todos los scripts existen. Están las suites de III.3 (`test:policies`, `test:app`, alta y VR-01), CB-06 y `git diff --check`/`--stat`. El preflight usa `node` directo, como exige la spec |
| 8 | Acciones reservadas | **FAIL** | Cada acción reservada tiene verificación posterior, pero el merge, el push y el despliegue (paso 14) están en un orden que el pipeline no permite. Misma causa que P-01 |
| 9 | Reglas | PASS | K01 construido y validado en el servidor (pasos 3 y 5), credenciales y escrituras solo por `worker_api`, pruebas solo contra el proyecto desechable (`db:check:test` en 0 y 9), sin secretos ni datos reales, y el preflight real lo corre el usuario sin que el asistente lea `.env.local` |
| 10 | Trampas | **FAIL** | La trampa 7 de la spec no tiene paso ni verificación. Ver P-02. Las trampas 1 a 6 y 8 a 22 están cubiertas |
| 11 | Git | PASS | El paso 0 crea o retoma `mf/M16.2` sin stash ni operaciones destructivas. Push, merge y despliegue se reservan al usuario. El problema de orden del merge es de P-01 y no de las operaciones Git en sí |
| 12 | Fidelidad | PASS | El plan implementa lo que pide la spec (listado, selección, probe, purga, reautorización, casos A y B, escritura ambigua, CA-39, estado compartido, preflight, documentación y VR-01) y no agrega funcionalidad, dependencias, variables ni cambios de esquema. Respeta la reasignación a M16c |

## Hallazgos

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| P-01 | alta | 13, 14, 15, 16, 17 y su relación con 12 | **El plan no se puede ejecutar con el pipeline del repositorio.** El paso 14 pide al usuario "publicación/merge/push y despliegue", los pasos 15 y 16 hacen el alta y VR-01 con datos reales en producción, y recién el paso 17 dice "Entregar a revisión independiente de implementación y QA". Pero: (a) `/implementation-review` exige que la microfase figure como `VERIFICADO — PENDIENTE DE APROBACIÓN`, y el plan solo llega a ese estado en el paso 17, después de VR-01; (b) `/qa-review` clasifica "Para el merge" como revisión de Codex sin bloqueantes y CI en verde, y exige antes `implementation-review` APROBABLE sobre el mismo commit; el merge del paso 14 quedaría hecho antes de ambas; (c) `/qa-review` exige para abrir el PR "todas las verificaciones obligatorias de III.3 ejecutadas y en verde", y III.3 pide para M16.2 "alta del dueño y VR-01", que solo se pueden hacer después del merge y el despliegue: sin una indicación en el plan de que son acciones posteriores al merge, `qa-review` las exigiría antes del PR y daría BLOQUEADO; (d) el paso 13 es una intervención del usuario, así que una sola corrida de `/microfase` quedaría BLOQUEADA ahí y nunca produciría el estado `VERIFICADO` que necesitan las revisiones; (e) cualquier corrección que surja en los pasos 13 a 16 cambia el commit y obliga a repetir ambas revisiones, con datos reales ya cargados. El plan tampoco dice qué se despliega: el precedente de M28.2a despliega la rama `mf/M28.2a` conectada a Vercel, pero VR-01 necesita el dominio de producción registrado en Meta (P-02 de la ruta) | Plan, pasos 13 a 17 y tabla de intervenciones; `.claude/skills/microfase/SKILL.md` §4 y §7 ("Si falta una acción obligatoria… BLOQUEADO"; siguiente paso: el usuario commitea y corre `/implementation-review`); `.claude/skills/implementation-review/SKILL.md` §1 (precondiciones); `.claude/skills/qa-review/SKILL.md` §1 y §5 (etapas PR, merge y gate); `meta_first/plan.md` III.3 fila `M16.2`; spec, "Intervenciones" ("Merge, push y despliegue… antes de VR-01") | Reordenar en dos fases dentro de la misma microfase, sin dividirla. **Fase A, pasos 0 a 12:** termina en `VERIFICADO — PENDIENTE DE APROBACIÓN` con `verify`, `test:policies`, `test:app` y el script de preflight probado con Meta simulada. Después: el usuario commitea en `mf/M16.2`, `/implementation-review`, `/qa-review` (LISTO PARA PR), PR, Codex y CI, merge y despliegue. **Fase B, pasos 13 a 17:** acciones posteriores al merge, que `qa-review` clasifica en "Para cerrar el gate". El plan debe decir expresamente que el alta del dueño y VR-01 de III.3 pertenecen a esa etapa, que el paso 14 se limita a lo que queda tras el merge (acta, P-04, `Ready`, VD-01), que el paso 17 ya no entrega a revisión, y dónde se registra y commitea la evidencia posterior al merge. Si el usuario prefiere desplegar la rama antes de revisar, como en M28.2a, el plan debe decirlo, nombrar qué se despliega y aceptar que un cambio posterior obliga a repetir las revisiones |
| P-02 | media | 16 y 17 | **La trampa 7 de la spec no tiene cobertura.** La spec dice que el id completo de la cuenta viaja en la ruta de las peticiones de Insights, que el hosting puede mostrarlo en las subpeticiones, y que "se declara en la evidencia". El plan no contiene ninguna mención de esto (ninguna coincidencia por "subpeticiones", "Outgoing" ni "id… viaja"). `plan-audit-1` la daba por cubierta por "7, 12, 16 y Riesgos", pero esos pasos hablan de logs de la aplicación y de campos cerrados, no de esta declaración | Spec, trampas 7 y 14; plan, pasos 16 y 17 y "Riesgos" | En el paso 16 o 17, exigir que `sesiones/M16.2.md` declare que el id completo de la cuenta puede verse en las subpeticiones de Insights del hosting, sin montos, y que no figura en ninguna otra evidencia |
| P-03 | baja | 14 | **El plan no nombra la microfase que produce el acta.** El paso 14 verifica `G-ACTA-META` y que "el acta declare el límite de copias", y la tabla de intervenciones dice "Aprobar `G-ACTA-META`". Pero `PROJECT_STATE.md` registra `M03a` como "sin empezar", y "Qué no se hace" prohíbe implementar `M03a` dentro de esta microfase. Nada dice que alguien tiene que correr `/microfase M03a` antes, por lo que el usuario no sabe que el paso 14 depende de otra microfase | `PROJECT_STATE.md` (M03a sin empezar; `G-ACTA-META`); plan, paso 14 y "Qué no se hace"; spec, "Intervenciones" | En el paso 14 y en la tabla de intervenciones, nombrar `M03a` como la microfase que tiene que estar cerrada antes de aprobar `G-ACTA-META`, y aclarar que es una dependencia externa a esta |
| P-04 | baja | Encabezado, "Archivos" y paso 13 | **Texto desactualizado y rutas absolutas.** (a) El encabezado dice "El archivo todavía declara `BORRADOR`: su actualización documental debe estar resuelta antes de implementar", pero la spec ya figura `APROBADA`; el plan aprobado quedaría con una afirmación falsa. (b) La tabla de archivos, la fórmula del hash y el comando del preflight usan rutas absolutas de la máquina (`C:\Users\Simon\dev\PRAXA\…`), mientras la spec y la ruta usan rutas relativas. El comando del preflight del plan (`node --env-file=.env.local C:/Users/Simon/.../meta-preflight.mjs`) difiere del de la spec (`node --env-file=.env.local scripts/meta-preflight.mjs`) | Plan, líneas 7, 15, 20, 27 a 59 y 127; spec, "Intervenciones" | Reemplazar la frase por el estado vigente y usar rutas relativas a la raíz del repositorio, con el mismo comando que la spec |

## Observación de tamaño

M16.2 excede ocho horas. D-M16.2-11 y la ficha enmendada registran la decisión del usuario de conservar un único corte, y esta observación no la reabre. El cambio propuesto en P-01 no divide la microfase: ordena el trabajo en dos fases con una revisión independiente en el medio. Dentro de la fase A, las etapas del plan son razonables: transporte y adaptadores (1 a 3), ciclo de vida y recuperación (4 a 7), UI e integración (8 a 10), documentación y verificación (11 y 12).

## Siguiente paso

Volver a plan mode, corregir el plan (P-01 y P-02 son obligatorios; P-03 y P-04 conviene resolverlos en la misma pasada) y auditar de nuevo. Para P-01 hace falta que el usuario elija entre las dos alternativas: revisar antes de desplegar (recomendada, alineada con el pipeline) o desplegar la rama antes de revisar (como M28.2a).

No se pasa el plan a `APROBADO`. Esta auditoría tampoco acredita la implementación, el preflight real, el despliegue, VD-01 ni VR-01.
