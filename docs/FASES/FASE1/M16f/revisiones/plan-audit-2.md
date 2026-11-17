# Auditoría del plan de M16f — ronda 2

- **Fecha:** 2026-11-15
- **Commit:** `9af2139` (rama `docs/cierre-m16e`, con cambios sin commit preexistentes; no se tocaron)
- **Hash de contenido de la spec** (sin la línea `**Estado:**`): `219be9dbd53295bc1e0d16d5e0fe6c6b50f7d137`
- **Hash de contenido del plan** (sin la línea `**Estado:**`): `0801f846c8a4d4570ad0ac2c4183cfbbc73edd0f`

## Precondiciones (con excepción del usuario)

`plan-audit-1` quedó BLOQUEADO porque la última auditoría de la spec (`spec-audit-6`) no es APROBABLE y porque su hash (`cbf04a4…`) no coincide con el actual (`219be9d…`). **El usuario lo exceptuó de forma expresa el 2026-11-15:** «no importa es una excepcion, audita M16f plan». Esta ronda audita el plan contra la spec actual, aprobada por el usuario. Riesgo aceptado: las correcciones de la spec posteriores a `spec-audit-6` no tienen auditoría propia, y un defecto que hayan introducido puede aparecer recién al implementar. La excepción se registra solo en este informe; el auditor no edita la spec.

Las otras dos precondiciones se cumplen: la spec está `APROBADA` (`spec.md:3`) y el plan existe en `BORRADOR` (`plan.md:3`). A-04 de `spec-audit-6` (`verify` sin exit 0 en la base) sigue abierto: el plan lo pone como condición antes del código (paso 0), así que no afecta esta auditoría.

## Veredicto

**REQUIERE CAMBIOS.**

## Checklist

| # | Ítem | Resultado | Evidencia o justificación |
|---|---|---|---|
| 1 | Spec base | PASS | `plan.md:7` cita `219be9dbd53295bc1e0d16d5e0fe6c6b50f7d137`, igual al hash actual |
| 2 | Cobertura | FAIL | C-01 a C-14 y T-01 a T-12 aparecen en al menos un paso (pasos 2 a 13). Falta el heredado **CA-38c** (escrituras en vuelo durante la desconexión, `spec.md`, «Heredados»): no figura en ningún paso. Ver P-05 |
| 3 | TDD | FAIL | Los pasos 2, 4 y 6 a 10 escriben la prueba antes y observan el rojo (`plan.md:41`). El paso 1 crea `scripts/ga4-preflight.mjs` (código que se puede probar, porque informa presencia y forma de la URI sin imprimir valores) sin una prueba previa y sin decir por qué no aplica. Ver P-06 |
| 4 | Archivos | PASS | La tabla (`plan.md:21-33`) queda dentro de II.14c (`meta_first/plan.md`, II.14c, incluidas las ampliaciones D-M16f-06 y D-M16f-10) y de los archivos de seguimiento y del pipeline (Precondiciones de la ruta 8 y 9). El pgTAP `20` es el siguiente número (último `19`) |
| 5 | Pasos | FAIL | La verificación del paso 4 («la matriz del encabezado coincide con pgTAP; aislamiento, una GA4 viva, purga idempotente») necesita `0027` aplicada en el desechable, pero `db:push:test` de `0027` recién ocurre en el paso 5. Pasa lo mismo con el paso 10 («v3 validado») frente al `db:push:test` de `0028` en el paso 11. Ver P-04 |
| 6 | Migraciones | PASS | `0026_ga4_enum.sql`, `0027_ga4.sql` y `0028_ga4_diag.sql` siguen a `0025`. No se modifica ninguna existente, y una corrección posterior va en una migración nueva (`plan.md:86`) |
| 7 | Comandos | PASS | `verify`, `db:check:test`, `db:push:test`, `test:policies`, `test:app` y `test:eval` existen en `package.json`. `git diff --check` y `node --env-file=… scripts/ga4-preflight.mjs` (script previsto en la spec) son válidos. Están las suites de III.3 para M16f, incluidos `checkCompatibility`, el preflight y la lectura y comparación reales (pasos 7, 13), y CB-06 (`plan.md:65`) |
| 8 | Acciones reservadas | FAIL | `db:push:test` (pasos 3, 5, 11), los commits (6, 8, 9, 11), el push, el `db:push` en `app` y el despliegue (12) están asignados al usuario. Pero en el paso 12 «el asistente verifica historial y versión publicada»: leer el historial de migraciones de `app` es una operación contra producción, que `AGENTS.md` («No correr `db:push` ni nada contra producción») no le permite al asistente. Ver P-03 |
| 9 | Reglas | PASS | Sin secretos ni datos reales (`plan.md:63`, `:82`); tenant y credenciales por el contrato existente (paso 4); ninguna suite contra `app` (`plan.md:57`, `:63`) |
| 10 | Trampas | FAIL | Las trampas de la spec tienen paso o verificación: `prompt=consent` y la revocación (paso 6), filas omitidas y combinaciones incompatibles (7 y 8), moneda, `itemId` y `utm_id` (9), gasto cero (riesgos), Next y migraciones (`plan.md:41`, `:86`), H-12 (paso 3), llamadas a funciones que cambian, por la lección de H-E1-254 (paso 0). Falta la trampa de II.14c y de la spec «No se reutiliza el esquema de Meta mediante `default 'meta'`»: ningún paso ni verificación la menciona. Ver P-07 |
| 11 | Git | FAIL | El plan no nombra la rama `mf/M16f` ni dice que el asistente no hace operaciones destructivas. Sí deja el push al usuario (paso 12). La rama actual es `docs/cierre-m16e`. Ver P-01 |
| 12 | Fidelidad | FAIL | (a) Ningún paso redacta la ampliación del acta para GA4. El paso 0 solo la «aprueba», y hoy `M03a/acta-meta.md` no menciona GA4 (0 coincidencias), aunque la ficha y §17.7 exigen el acta antes del código y la spec la manda a cubrir GA4, DeepInfra y Anthropic. (b) Falta la verificación de la API vigente antes del código, que piden la ficha («Verificar la API vigente antes del código»), la spec («Se reverifican los changelogs antes del código») y H-09. (c) `plan.md:19` dice que el lockfile «no figura en la tabla vigente», cuando la spec lo autoriza si hay dependencia. Ver P-02 y P-08 |

## Hallazgos

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| P-01 | media | Encabezado y paso 0 | El plan no fija la rama `mf/M16f` ni prohíbe al asistente las operaciones destructivas de Git | Ítem 11; `git branch --show-current` = `docs/cierre-m16e` | En el paso 0: crear o pasar a `mf/M16f` preservando los cambios sin commit, y declarar que el asistente no hace push, reset, rebase ni otra operación destructiva |
| P-02 | media | 0 | No hay un paso que redacte el acta ampliada de GA4. Solo se aprueba | `M03a/acta-meta.md` sin GA4; ficha M16f; §17.7; spec, «Intervenciones» («Aprobar spec, plan y acta ampliada (GA4, DeepInfra y Anthropic)») | Agregar antes de la aprobación un paso del asistente que redacte la ampliación del acta (finalidad, datos agregados de GA4, envío de agregados a DeepInfra y Anthropic, retención y purga, y la revocación solo local), con su verificación: revisión cruzada con la spec y aprobación del usuario registrada |
| P-03 | media | 12 | El asistente «verifica el historial» de migraciones de `app`, lo que exige consultar producción | `plan.md:57`; `AGENTS.md`, Seguridad operativa | Que el usuario aporte el historial de `app` (tomado del dashboard de Supabase o de su propia corrida) y la URL de la versión publicada, y que el asistente lo registre en la sesión, sin consultar `app` |
| P-04 | baja | 4 y 10 | Las verificaciones de los pasos 4 y 10 necesitan la migración aplicada, pero el `db:push:test` llega en el paso siguiente | Ítem 5 | Partir cada verificación: en el paso 4 (y 10), rojo previo y revisión estática de la migración; en el paso 5 (y 11), después del `db:push:test`, la matriz de pgTAP, el aislamiento y la purga (y v3), en verde |
| P-05 | baja | 6 | El heredado CA-38c (escrituras en vuelo durante la desconexión) no figura en ningún paso | Spec, «Heredados»; `plan.md:51` | Sumar CA-38c al paso 6 (o al 8), con su caso: un paso de sincronización en vuelo durante la desconexión no escribe |
| P-06 | baja | 1 | `scripts/ga4-preflight.mjs` no tiene prueba previa ni justificación | Ítem 3 | Agregar una prueba unitaria del preflight (variables faltantes, URI mal formada, client ID sin prefijo numérico, y que no imprima valores), o justificar por qué no aplica |
| P-07 | baja | 2 y 4 | La trampa `default 'meta'` no tiene verificación | II.14c; spec, «Trampas» | En el paso 4, verificar que ninguna columna o función nueva tenga `default 'meta'` y que todo flujo de GA4 pase el proveedor explícito |
| P-08 | baja | 0 y «Archivos» | Falta reverificar la API de Google antes del código (ficha, spec y H-09). Además, el lockfile se declara fuera de la tabla, al revés de lo que dice la spec | Ítem 12 (b) y (c); `plan.md:19` | En el paso 0, releer las páginas oficiales de OAuth y Data/Admin API y sus changelogs, y registrar el resultado en la sesión. Corregir `plan.md:19` para que `package.json` y el lockfile figuren como autorizados solo si hay dependencia, como en la spec |

## Observación de tamaño (no afecta el veredicto)

El usuario retiró de `AGENTS.md` el límite de 8 horas (H-E1-261), y la ficha ya exceptuaba a M16f. Aun así, los cuatro controles de etapa (pasos 6, 8, 9 y 11) más la publicación y el recorrido real son un corte grande. Conviene mantener un commit y una sesión por control, como en M16e, y no adelantar la etapa `.3b` sin el commit de `.3a`.

## Siguiente paso

Corregir el plan (P-01 a P-08) y volver a auditarlo con `plan-audit-3`.
