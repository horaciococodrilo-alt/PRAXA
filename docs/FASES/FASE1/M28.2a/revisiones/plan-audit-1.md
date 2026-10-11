# Auditoría de plan — M28.2a — 2026-10-03 (primera ronda)

- **Commit auditado:** `8cc58eb` (HEAD de `mf/M28.2a`). `docs/FASES/FASE1/M28.2a/plan.md` está sin seguimiento (`??`) en el árbol de trabajo; el resto del árbol coincide con `8cc58eb`.
- **Hash de contenido de la spec, sin la línea de estado:** `7517041448d9579977406bf7c8cd6d39a954e922` (recalculado ahora sobre `docs/FASES/FASE1/M28.2a/spec.md`).
- **Hash de contenido del plan, sin la línea de estado:** `78a06808c0cf4205ad34316ffd9f6dbe58b78803`.
- **Veredicto: BLOQUEADO.** Dos precondiciones fallan antes de poder auditar el contenido del plan.

## Precondiciones

| Precondición | Resultado | Evidencia |
|---|---|---|
| `spec.md` en estado `APROBADA` | **FAIL** | `spec.md:3` dice `**Estado:** APROBADO`. La plantilla (`docs/_templates/mf-spec.md:5`) exige exactamente `APROBADA`: "Estados posibles: `BORRADOR` → `APROBADA`." El valor presente no es ese literal. |
| La última `spec-audit-N.md` es APROBABLE | PASS (parcial, ver siguiente fila) | `revisiones/spec-audit-3.md` es la de número más alto y su veredicto es "APROBABLE" (`spec-audit-3.md:7`). |
| El hash de contenido actual de la spec coincide con el que registra esa auditoría | **FAIL** | `spec-audit-3.md:5` registra el hash `cb4ab933b0bcdf480a5ef699c278f7b96dbf55ec`. El hash recalculado ahora sobre el `spec.md` del árbol de trabajo (idéntico a `8cc58eb`, sin cambios pendientes) es `7517041448d9579977406bf7c8cd6d39a954e922` — **no coincide**. Ese hash recalculado es, en cambio, el que registra `revisiones/spec-audit-2.md:9` ("segunda ronda"), cuyo veredicto también es APROBABLE pero que **no es la auditoría de número más alto**. El propio `plan.md:7` ya lo admite: *"Coincide con `revisiones/spec-audit-2.md`, APROBABLE. La tercera auditoría consigna un hash diferente; no se usa como referencia de identidad del contenido."* — es decir, el plan fue construido citando una auditoría anterior a la vigente por número, descartando por su cuenta la más reciente. Esa decisión de qué auditoría vale como identidad del contenido no le corresponde al plan ni al auditor: la precondición exige coincidencia con la última, y no la hay. |
| `plan.md` existe y está en `BORRADOR` | PASS | `plan.md:3` dice `**Estado:** BORRADOR`. Existe en `docs/FASES/FASE1/M28.2a/plan.md`. |

## Qué falta para destrabar

No corresponde a este auditor decidir cuál versión de la spec es la vigente ni editar `spec.md`, `plan.md` ni las auditorías. Hace falta una de estas dos cosas, decidida por quien implementó la expansión/corrección de la spec:

1. Si el contenido actual de `spec.md` (hash `7517041448d9579977406bf7c8cd6d39a954e922`) es el que se quiere dar por vigente, falta una auditoría de spec nueva (`spec-audit-4.md`) que la audite y registre ese hash como el de la ronda más alta — o bien, si `spec-audit-2.md` y `spec-audit-3.md` auditaron el mismo contenido declarado en distintos momentos del grill y hay una inconsistencia de redacción entre ambos informes, aclararla antes de continuar.
2. Si el contenido que corresponde aprobar es el auditado por `spec-audit-3.md` (hash `cb4ab933b0bcdf480a5ef699c278f7b96dbf55ec`), `spec.md` en el árbol de trabajo no tiene ese contenido actualmente y debe restaurarse antes de aprobar.

Además, independientemente de lo anterior, el campo `**Estado:**` de `spec.md` debe decir `APROBADA` (no `APROBADO`) para cumplir el literal de la plantilla y de la precondición 1 de este auditor.

No se completó el resto del checklist (ítems 1–12 de la sección 3) ni la observación de tamaño, porque la auditoría de plan no puede evaluar fidelidad, cobertura ni TDD de un plan cuya spec base no está identificada de forma inequívoca.

## Siguiente paso

Resolver la inconsistencia de hash entre `spec.md` y `spec-audit-3.md`, y corregir el literal de estado a `APROBADA`. Después, volver a auditar: si la spec requiere una nueva ronda, correr `/spec-auditor M28.2a` antes de reintentar `/plan-auditor M28.2a`; si solo hace falta restaurar contenido o corregir el estado, alcanza con volver a invocar `/plan-auditor M28.2a` una vez resuelto.
