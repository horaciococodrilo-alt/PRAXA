# Auditoría del plan de M26a — ronda 1

- **Fecha:** 2026-11-13.
- **Commit:** `0e871be` (rama `docs/m26a-spec`). El árbol tiene cambios documentales preexistentes sin commit (`M26a/spec.md`, `HALLAZGOS.md`, `PROJECT_STATE.md` modificados; `M26a/plan.md`, `spec-audit-2.md` a `-6.md`, `M16e/`, `M16f/` y una propuesta de `meta_first/revisiones/` sin seguimiento). No se tocaron.
- **Hash de contenido de `spec.md` sin la línea `**Estado:**`:** `6c2f2f65999ffd4c9904861aeaa43932a56aa2cb`.
- **Hash de contenido de `plan.md` sin la línea `**Estado:**`:** `2409d0c86033c3ef2f8980170cc724c8da64c3fd`.

## Veredicto

**BLOQUEADO.** Fallan dos precondiciones de la auditoría; el checklist no se evaluó.

## Precondiciones

| Precondición | Resultado | Evidencia |
|---|---|---|
| `spec.md` en estado `APROBADA` | Cumple | `spec.md:3` dice `**Estado:** APROBADA`. |
| La última `spec-audit-N.md` es APROBABLE | **No cumple** | La última es `spec-audit-6.md` (2026-11-12 21:08), con veredicto **REQUIERE CAMBIOS: 15 PASS, 3 FAIL** (`spec-audit-6.md:10`). No existe `spec-audit-7.md`. |
| El hash actual de la spec coincide con el que registra esa auditoría | **No cumple** | `spec-audit-6.md:5` registra `ca6db6ad6a0ad58cdd4fcb8b59194350ab9f9a3b`; el actual es `6c2f2f65999ffd4c9904861aeaa43932a56aa2cb`. La spec se modificó después de la auditoría (archivo con fecha 2026-11-12 21:31) para aplicar sus correcciones. |
| `plan.md` existe y está en `BORRADOR` | Cumple | `plan.md:3` dice `**Estado:** BORRADOR`. |

La spec documenta la situación en «Auditorías» (`spec.md:389`): el usuario aprobó expresamente esta versión el 2026-11-12 sin `spec-audit-7`, como excepción al paso 4 del pipeline, en el mismo sentido que `H-E1-217`; `PROJECT_STATE.md:30` registra el mismo hash `6c2f2f…`. Este auditor no tiene facultad para dispensar una precondición por su cuenta: la excepción decidida para la aprobación de la spec no se extiende, según el texto de esta auditoría, a la precondición de la auditoría del plan.

## Checklist

No evaluado por el bloqueo.

## Hallazgos

| ID | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| P-01 | Bloqueante | Precondición | No hay veredicto APROBABLE sobre la versión de la spec que el plan toma como base (`plan.md:7`, hash `6c2f2f…`). | `spec-audit-6.md:5,10`; hash actual calculado arriba; `spec.md:389`. | Opción A: correr una auditoría de la spec (`spec-audit-7`) sobre la versión actual y, si es APROBABLE, repetir esta auditoría. Opción B: que el usuario extienda expresamente la excepción de `spec.md:389` a la auditoría del plan, la registre (spec «Auditorías» o `PROJECT_STATE.md`) y vuelva a pedir la auditoría citando esa decisión. |

## Observación (no afecta el veredicto)

- `PROJECT_STATE.md:30` dice que «el borrador existente cita el hash de la versión anterior», pero `plan.md:7` ya cita `6c2f2f…`, que coincide con el actual. La frase quedó desactualizada; corresponde corregirla cuando se actualice el estado.
