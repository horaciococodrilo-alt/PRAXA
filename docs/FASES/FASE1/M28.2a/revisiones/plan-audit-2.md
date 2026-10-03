# Auditoría de plan — M28.2a — 2026-10-03 (segunda ronda)

- **Commit base:** `8cc58eb` (HEAD de `mf/M28.2a`). Árbol de trabajo con `docs/FASES/FASE1/M28.2a/spec.md` modificado sin comitear (solo la línea de estado, `APROBADO` → `APROBADA`) y con `plan.md` y `revisiones/plan-audit-1.md` sin seguimiento. Se preservan.
- **Hash de contenido de la spec, sin la línea de estado:** `7517041448d9579977406bf7c8cd6d39a954e922` (sin cambios respecto de la ronda anterior: la corrección del literal de estado no afecta el hash, porque esa línea se excluye del cálculo).
- **Hash de contenido del plan, sin la línea de estado:** `78a06808c0cf4205ad34316ffd9f6dbe58b78803` (sin cambios).
- **Veredicto: BLOQUEADO.** Persiste la misma precondición fallida que en `plan-audit-1.md`.

## Precondiciones

| Precondición | Resultado | Evidencia |
|---|---|---|
| `spec.md` en estado `APROBADA` | **PASS** (corregido desde la ronda anterior) | `spec.md:3` dice ahora `**Estado:** APROBADA`. |
| La última `spec-audit-N.md` es APROBABLE | PASS | `revisiones/spec-audit-3.md` sigue siendo la de número más alto; veredicto APROBABLE (`spec-audit-3.md:7`). |
| El hash de contenido actual de la spec coincide con el que registra esa auditoría | **FAIL (sin cambios)** | `spec-audit-3.md:5` registra `cb4ab933b0bcdf480a5ef699c278f7b96dbf55ec`. El hash recalculado ahora es `7517041448d9579977406bf7c8cd6d39a954e922` — sigue sin coincidir, y sigue siendo el que registra `spec-audit-2.md:9`, no la última ronda. La corrección aplicada (`APROBADO`→`APROBADA`) fue a la línea de estado, que el propio cálculo excluye; no podía resolver esta discrepancia porque el defecto está en el cuerpo de la spec, no en esa línea. |
| `plan.md` existe y está en `BORRADOR` | PASS | Sin cambios. |

## Qué sigue fallando y por qué no lo puedo pasar por alto

La precondición 3 exige que el hash actual coincida con el de **la auditoría de número más alto**. Hoy esa auditoría es `spec-audit-3.md`, y su hash no es el del `spec.md` que hay en el árbol. Esto no se resuelve corrigiendo el estado: hace falta una de estas dos acciones, y la decide quien tiene el contexto de qué pasó entre la ronda 2 y la ronda 3 del grill de spec:

1. Si el contenido vigente es el actual (hash `7517041...`), falta correr una auditoría de spec nueva (`spec-audit-4.md`) que lo audite y quede como la de número más alto con ese hash.
2. Si el contenido vigente es el que auditó `spec-audit-3.md` (hash `cb4ab933...`), hay que restaurarlo en `spec.md` antes de poder aprobar el plan sobre esa base.

No es una decisión que me corresponda tomar como auditor de plan ni resolver editando la spec yo mismo — el veredicto BLOQUEADO es exactamente para frenar y reportarlo, no para improvisar cuál de las dos versiones "gana".

No se completó el resto del checklist (ítems 1–12) por la misma razón que en la ronda anterior.

## Siguiente paso

Resolver la discrepancia de hash entre `spec.md` y `spec-audit-3.md` (opción 1 o 2 arriba). Después, repetir `/plan-auditor M28.2a`.
