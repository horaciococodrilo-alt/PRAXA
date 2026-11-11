# Auditoría de la spec de M25a — ronda 13

- **Fecha:** 2026-11-09 (America/Buenos_Aires).
- **Commit:** `3eaf561` (`docs/m25a-spec`); base `main@b0c854d`. El código de `src/`, `supabase/`, `tests/`, `scripts/`, `package.json`, `package-lock.json` y `vitest.config.mts` coincide con `main` (`git diff --quiet main -- ...`, exit 0). Había cambios documentales y auditorías 8 a 12 sin seguimiento; se preservaron.
- **Hash de contenido de `spec.md` sin la línea `**Estado:**`:** `35e6e1ff733beeb796a6658be7f6b3357ae1e3b1` (filtro de la línea de estado y `git hash-object --stdin`).
- **Precondición:** `spec.md:3` dice `BORRADOR`; el informe previo más alto es `spec-audit-12.md`.

## Veredicto

**REQUIERE CAMBIOS.** Hay dos hallazgos altos (A-88 y A-89) y uno medio (A-90). A-89 afecta directamente la presentación de cifras parciales. La corrida actual de `npm run verify` tampoco terminó: lint, typegen, typecheck y 765 pruebas pasaron, pero el build con Turbopack quedó sin avance visible y se interrumpió. Como diagnóstico, `npm run build -- --webpack` terminó con `EPERM` al crear un directorio en `.next/static/chunks/app/(app)/app`; esto no demuestra un defecto del código, pero el ítem 16 no está acreditado en esta ronda. El informe de la ronda 12 sí registra `verify` exitoso sobre la misma base `main@b0c854d`, lo cual no convierte la corrida actual en exit 0.

La regla D-M25a-24 no cambia el veredicto de esta auditoría: la skill `spec-auditor` que invocó el usuario exige **los 18 ítems en PASS** para `APROBABLE` (§4). El texto de la spec no modifica esa instrucción.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | Ficha `meta_first/plan.md:342`; heredados `spec.md:695-728`: CA-48 a CA-55, CA-61 a CA-66, CA-69 a CA-73 y VR-02. |
| 2 | Alcance | PASS | Las tres etapas de `spec.md:29-50` corresponden a II.12, II.13 y II.13b (`plan.md:710-770`); los criterios operativos `spec.md:734-817` trazan a CA, DEC o trampas. |
| 3 | Coherencia con la spec general | **FAIL** | La composición global de un ranking puede ocultar días sin valor de cada entidad (`spec.md:224,259,261`), contra la presentación parcial de CA-51b (`meta_first/spec.md:469`): A-89. |
| 4 | Decisiones | PASS | D-M25a-01 a -24 figuran como decisiones del usuario (`spec.md:977-1004`); las enmiendas de ruta constan en `meta_first/plan.md:20` y `meta_first/spec.md:349,491`. El conflicto de D-M25a-24 es con la skill invocada, no con un DEC o CA de la ruta: A-88. |
| 5 | Trampas | PASS | II.12 y II.13 (`plan.md:727,748-756`) están en `spec.md:952-975`. |
| 6 | Intervenciones y acciones reservadas | PASS | `spec.md:935-950`, ficha `plan.md:346` y III.2 `:852-853`: push, despliegue y ambos `db:push` son del usuario, con controles posteriores. |
| 7 | Verificación | PASS | `spec.md:923-933` incluye los controles de las tres etapas y CB-06 de `meta_first/spec.md:582-590`. |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:25-29` registra `G-SYNC` aprobado y M25a habilitada. `main` contiene las migraciones `0016` y `0017` y el código de M16c; la evidencia está en `meta_first/sesiones/M16c.md`. |
| 9 | Lo entregado de verdad | PASS | `spec.md:67-114` resuelve diferencias reales: tope de 28 días en `0016:1843-1845`, atribución con `adset_ref` en `0016:1021-1043`, K01 y `NoCompanyError` en `company/service.ts:85-90`, y `known=false` observado en `sesiones/M16c.md:500`. |
| 10 | Pendientes y hallazgos | PASS | `spec.md:1010-1042` asigna o difiere `H-E1-185`, -187, -189, -190, -194 y -202; el riesgo sin filas reales figura en `HALLAZGOS.md:204-205`. |
| 11 | Contexto real | PASS | Se cotejaron las referencias de `spec.md:67-114` y las afectadas por las correcciones actuales con `chat.tsx`, `chat/page.tsx`, `tenant/context.ts`, `company/service.ts`, `connections.ts`, `connection.ts`, `0016`, `0017`, `M16c.md`, `.env.example`, `package.json`, `SECURITY.md` y la ruta. No se halló una referencia falsa. |
| 12 | Archivos previstos | PASS | `spec.md:661-691` traza los archivos a II.12/13/13b y D-M25a-01, -10, -14 y -16; `SECURITY.md` y `ARCHITECTURE.md` están previstos porque cambian propiedades de ambos. |
| 13 | Diseño suficiente | **FAIL** | Para `barras_apiladas` faltan reglas de alineación por fecha y de series duplicadas o superpuestas; el implementador debe decidir qué suma dibuja (`spec.md:479,491-527`): A-90. |
| 14 | Verificable | **FAIL** | Hay casos para los criterios declarados, pero T-27/T-87 no cubren ranking con entidades parcialmente observadas y cobertura global completa (`spec.md:851,911`); T-79 tampoco prueba series desalineadas o repetidas (`:903`): A-89 y A-90. |
| 15 | Sin nada abierto | PASS | `spec.md:1025-1027` no tiene preguntas abiertas; H-01 a H-12 (`:1006-1021`) indican cuándo y cómo contrastarse. |
| 16 | Ejecutable ahora | **FAIL** | `npm run verify` llegó a 28 archivos y 765 pruebas aprobadas, pero el build con Turbopack no terminó y se interrumpió; el build alternativo con Webpack dio `EPERM` dentro de `.next`. `package.json:11-26` contiene los scripts vigentes; `test:eval` y `DEEPINFRA_API_KEY` están previstos para la etapa .2 (`spec.md:624,687-688`). No se leyó `.env.local`. |
| 17 | Consistencia interna | **FAIL** | `answered_partial_coverage` se decide por `result.composition.partial` (`spec.md:141,812`) mientras el ranking declara cobertura por algún valor de cualquier entidad y mantiene composición propia por entidad (`:224,261`): A-89. La regla de cierre de `:1061` contradice la skill invocada: A-88. |
| 18 | Reglas no negociables | PASS | K01 interno, migración nueva `0018`, SQL con RLS, rol de C solo por `worker_api`, fixtures en desechable, errores redactados (`spec.md:126-180,327-358,628-639,935-950`). |

**Límite de 8 horas:** la ficha vigente exceptúa expresamente M25a y la divide en tres etapas (`meta_first/plan.md:337,348-354`); no corresponde proponer otra partición.

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| D-M25a-24 y «Regla de cierre desde la ronda 13» (`spec.md:1004,1061`) | Skill `spec-auditor`, §4: `APROBABLE` requiere los 18 ítems en PASS | La spec intenta cambiar el criterio de la auditoría sin que cambie la skill invocada por el usuario | A-88: retirar o corregir la afirmación en la spec, o solicitar por separado un cambio explícito de la skill; esta ronda usa la skill vigente |
| `chat_ranking` declara cobertura global por «alguna entidad» y el estado `answered_partial_coverage` solo mira esa composición (`spec.md:141,261`) | CA-51b de `meta_first/spec.md:469` y `spec.md:259`: totales con días sin fila se presentan como parciales | Con dos campañas, una con fila solo el día 1 y otra solo el día 2, la cobertura del nivel puede estar completa los dos días, mientras cada total por campaña es parcial | A-89: incorporar la composición de cada valor efectivamente mostrado en el pie, los bloques y el resultado registrado |

## Hallazgos

| ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-88 | Alta | Decisiones; Auditorías | Una decisión de la spec se atribuye la facultad de cambiar el criterio de la skill invocada. Permitiría llamar `APROBABLE` a una spec con ítems FAIL, aunque el encargo actual exige 18 PASS | `spec.md:1004,1061`; skill `spec-auditor`, §4 | Quitar la regla de cierre de la spec o tramitar aparte la modificación de la skill. Mantener esta auditoría bajo la skill vigente | **Sí**, si se quiere cambiar la skill |
| A-89 | Alta | Diseño §§2, 3 y 9; C-21, C-79; T-27, T-87 | Un ranking puede mostrar sumas parciales como completas. La composición global usa el valor de *alguna* entidad por día, pero la respuesta y el `outcome` solo miran `result.composition.partial`. La misma ambigüedad afecta los tipos de acción y segmentos cuando cada fila cubre días diferentes | `spec.md:141,224,226-227,259,261,447,480,754,812,851,911`; `meta_first/spec.md:469` | Definir cómo la composición de cada fila mostrada determina `partial`, pie, avisos y `outcome`, sin convertir ausencias en cero. Añadir un fixture de dos entidades con días disjuntos y cobertura global completa a T-27, T-44 y T-87; aplicar lo mismo a tipos y segmentos | No: CA-51b ya lo exige |
| A-90 | Media | Diseño §9; C-51/C-73; T-79 | `barras_apiladas` permite varias `daily_series` de igual unidad, pero no exige el mismo período ni la misma métrica, y no define cómo alinear días ausentes o impedir la misma serie dos veces. Podría sumar gasto y valor de acción por ser ambos dinero, fechas distintas o un valor duplicado | `spec.md:479,491-527,784,806,903`; `meta_first/spec.md:404-409` | Fijar métrica y período compatibles, alineación por fecha y tratamiento de fuente repetida, niveles ancestro/descendiente y tipos superpuestos. Agregar positivos y negativos a T-79 | No: CA-71 exige valores del servidor sin sumar engañosamente |

## Verificaciones y límites

- `git status --short`, `git rev-parse --short HEAD`, `git diff --quiet main -- src supabase tests scripts package.json package-lock.json vitest.config.mts`: dependencias y cambios preexistentes inspeccionados; el código coincide con la base.
- `npm run verify`: lint, typegen, typecheck y Vitest en verde (28 archivos, 765 pruebas); el build de Turbopack quedó en «Creating an optimized production build ...» sin terminar y se interrumpió (exit 1 por interrupción).
- `npm run build -- --webpack`: exit 1, `EPERM: operation not permitted, mkdir 'C:\Users\Simon\dev\PRAXA\.next\static\chunks\app\(app)\app'`. Es un bloqueo de escritura en el directorio de build; no se usó como evidencia de un fallo de implementación de M25a.
- No se ejecutaron `db:push`, `db:push:test`, `test:policies`, `test:app`, VR-02 ni pruebas contra `app`: M25a no está implementada y la auditoría no las requiere.
- Solo se agregó este informe. La spec permanece en `BORRADOR`; `G-CHAT` no cambia.

## Siguiente paso

Corregir A-89 y A-90 en la spec, resolver la contradicción A-88 con la skill vigente, y repetir `npm run verify` en un entorno donde el build termine. Después, auditar la spec de nuevo. Esta ronda no la aprueba ni inicia M25a.
