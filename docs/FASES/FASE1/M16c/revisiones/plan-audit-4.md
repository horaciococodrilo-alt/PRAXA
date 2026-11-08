# Auditoría del plan M16c — 4

**Fecha:** 2026-11-08  
**Commit base:** `a27f7270310034cc3e64346684b1f5c5e5a20ae3` (`main`), con los cambios documentales preexistentes sin commit y `docs/FASES/FASE1/M16c/` sin rastrear.  
**Hash de contenido de la spec, excluyendo solo la línea de estado:** `3c1db5b57f9ef68a54760841185cafdef50156db`  
**Hash de contenido del plan, excluyendo solo la línea de estado:** `89d59a82d7a3bf3c43e55e6b5f831edb3d5e9c0b`

## Veredicto

**APROBABLE: 12 PASS, 0 FAIL.** Llega al mismo veredicto que `plan-audit-3.md`, sobre el mismo hash.

**Límite de independencia.** Esta auditoría se hizo en la misma sesión que escribió las correcciones de P-01 a P-03 de `plan-audit-2.md`, así que no es independiente de ellas. `plan-audit-3.md`, hecha en otro contexto, es la referencia independiente para este hash. Este informe la complementa con la verificación de que las correcciones no introducen defectos nuevos.

## Precondiciones

| Precondición | Resultado | Evidencia |
|---|---|---|
| Spec en `APROBADA` | Cumple | `M16c/spec.md:3` |
| Última `spec-audit-N.md` APROBABLE | Cumple | `spec-audit-11.md:12` |
| Hash actual de la spec = hash auditado | Cumple | `3c1db5b…` = `spec-audit-11.md:5` |
| Plan existe en `BORRADOR` | Cumple | `M16c/plan.md:3` |

## Checklist

| # | Ítem | PASS/FAIL/NO APLICA | Evidencia o justificación |
|---:|---|---|---|
| 1 | Spec base | PASS | `plan.md:7` cita la spec y el hash `3c1db5b…`, que coincide con el actual. Ahora declara correctamente el estado `APROBADA`. |
| 2 | Cobertura | PASS | Los pasos cubren C-01 a C-22, T-01 a T-38 y los 16 CA heredados. La matriz es la de `plan-audit-2.md`, ítem 2, y las correcciones no quitaron ninguna referencia. El paso 19 suma ahora M16c-H-01/02/03/07. |
| 3 | TDD | PASS | Los pares RED→GREEN son 2→4, 3→6, 8/9→10/11 y 14→15. El RED del parser (paso 14, T-28) tiene su GREEN en F12 en el paso 15. `plan.md:144` justifica por qué T-32, T-33 y T-34 no siguen TDD. |
| 4 | Archivos | PASS | F01–F29 tienen la misma autorización que en `plan-audit-2.md`. F12 suma el paso 15 (`plan.md:38`), que sigue siendo un archivo de II.11. El checkout del paso 7 se crea fuera del repositorio y no agrega archivos al árbol. `.env*` está en `.gitignore:35`. |
| 5 | Pasos | PASS | P-01 está corregido: el paso 15 implementa el parser y la precedencia en F12 y prohíbe `meta/outcomes.ts` (`plan.md:104`). La suite unitaria puede importar F12 aunque sea `server-only`, porque las pruebas existentes simulan ese módulo (`tests/unit/meta-lifecycle.test.ts:4`). El resto del orden no cambia. |
| 6 | Migraciones | PASS | Solo se crea 0016; la última existente es `0015_activation_row_lock.sql`. Ninguna existente se modifica y la reversión va en una migración nueva (`plan.md:165-171`). |
| 7 | Comandos | PASS | Los scripts `npm run` citados existen en `package.json`. `git worktree add <ruta> <commit>`, `git worktree list`, `git worktree remove <ruta>` y `git -C <dir> rev-parse HEAD` son válidos en git 2.52.0, que es el instalado. `npm ci` es válido. Las suites de III.3 y CB-06 siguen presentes (`plan.md:115-140`). |
| 8 | Acciones reservadas | PASS | P-02 está corregido. El paso 7 se detiene para que el usuario aporte la configuración fuera del chat, la verifica con `db:check:test` antes de `test:app`, trata la falta de configuración como NO EJECUTADO y deja la limpieza a cargo del usuario. La tabla de intervenciones tiene la fila del paso 7 con su verificación posterior. El resto de las acciones reservadas no cambia. |
| 9 | Reglas | PASS | El asistente nunca lee, copia ni muestra la configuración del checkout (`plan.md:74,138`). Las demás reglas siguen como en `plan-audit-2.md`. |
| 10 | Trampas | PASS | Igual que en `plan-audit-2.md`. Además, el paso 19 registra un 22023 por reloj como hallazgo, sin tolerancia silenciosa (`spec.md:403`). |
| 11 | Git | PASS | Todo sigue en `mf/M16c` y el asistente no hace commit ni push. Las operaciones nuevas no son destructivas: `worktree add` crea una carpeta aparte con HEAD desacoplado, y `worktree remove` va sin `--force` y frena si git lo rechaza. |
| 12 | Fidelidad | PASS | P-03 está corregido. El paso 19 cubre las verificaciones de H-02, H-03 y H-07 que la spec asigna a .3 (`spec.md:398,399,403`), y el paso 20 registra el estado de H-01 a H-08 y de Ruta H-04. No se agrega funcionalidad nueva. |

## Hallazgos

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| — | — | — | Ninguno | — | — |

En la tabla de intervenciones, la fila del paso 7 quedó antes de la del paso 5. Es solo una cuestión de orden visual: no cambia ningún paso ni ninguna verificación.

## Evidencia y límites

- Hashes calculados con `grep -v '^\*\*Estado:\*\*' ARCHIVO | git hash-object --stdin`.
- Se contrastaron las líneas corregidas del plan (`:7,38,74,104,108-109,138,146-161`), `plan-audit-2.md`, `plan-audit-3.md`, `.gitignore`, `tests/unit/meta-lifecycle.test.ts`, `vitest.config.mts` y `git worktree -h`. El resto de las fuentes es el de `plan-audit-2.md`, sin cambios desde entonces: spec, ruta, `package.json` y migraciones.
- No se ejecutaron suites ni migraciones. No se leyó `.env.local`. No se modificó ningún archivo salvo este informe. Sin commit, push ni despliegue.

## Observación de tamaño

Supera las 8 horas, con la excepción que autoriza D-M16c-05 y los tres controles de etapa. No se recomienda partirlo.

## Siguiente paso

El usuario aprueba el plan («Apruebo el plan de M16c: pasá el estado a APROBADO»). Después elige modelo y esfuerzo, abre una sesión nueva y corre `/microfase M16c`.
