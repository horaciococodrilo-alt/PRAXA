# Auditoría del plan de M16f — ronda 1

- **Fecha:** 2026-11-15
- **Commit:** `9af2139` (rama `docs/cierre-m16e`, con cambios sin commit en `AGENTS.md`, `M16f/spec.md`, `meta_first/{plan,spec}.md`, `HALLAZGOS.md` y `PROJECT_STATE.md`, y `M16f/plan.md` y `M16f/revisiones/` sin seguimiento; no se tocaron)
- **Hash de contenido de la spec** (sin la línea `**Estado:**`): `219be9dbd53295bc1e0d16d5e0fe6c6b50f7d137`
- **Hash de contenido del plan** (sin la línea `**Estado:**`): `0801f846c8a4d4570ad0ac2c4183cfbbc73edd0f`

## Veredicto

**BLOQUEADO.** Fallan dos de las cuatro precondiciones, así que no se evaluó el checklist.

## Precondiciones

| Precondición | Resultado | Evidencia |
|---|---|---|
| La spec está en `APROBADA` | PASS | `M16f/spec.md:3`: «APROBADA por el usuario el 2026-11-15 (con A-04 de `spec-audit-6` pendiente como control previo al código)» |
| La última `spec-audit-N.md` es APROBABLE | **FAIL** | La última es `spec-audit-6.md`, con veredicto **REQUIERE CAMBIOS** (`spec-audit-6.md:10`). La spec lo reconoce: «falta una nueva auditoría de las correcciones» (`spec.md:449`) |
| El hash actual de la spec coincide con el de esa auditoría | **FAIL** | `spec-audit-6.md:6` registra `cbf04a4fc6e9ec3239c406168cb6d2d458ba2622`, y el hash actual es `219be9dbd53295bc1e0d16d5e0fe6c6b50f7d137`. La spec cambió después de la auditoría, con las correcciones de A-01 a A-03 |
| `plan.md` existe y está en `BORRADOR` | PASS | `M16f/plan.md:3`. El plan cita el hash actual de la spec (`plan.md:7`) |

## Checklist

Sin evaluar: el veredicto es BLOQUEADO por las precondiciones.

## Hallazgos

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| P-01 | alta | Precondición | La spec se aprobó sin una auditoría APROBABLE, y la versión aprobada no está auditada: sus correcciones son posteriores a `spec-audit-6` | Tabla de precondiciones | Correr `/spec-auditor M16f` (`spec-audit-7`) sobre la spec actual hasta llegar a APROBABLE. La otra opción es que el usuario registre en la spec una excepción expresa a la regla de `docs/_templates/mf-spec.md`, como hizo M16e en su encabezado («Aprobación con excepción»), con el riesgo aceptado. El auditor no concede esa excepción |
| P-02 | alta | Condición de entrada | A-04 de `spec-audit-6` sigue abierto: `npm run verify` sin exit 0 acreditado en la base. La spec lo deja como control previo al código | `spec.md:3`, `:449`; `spec-audit-6.md:51` | Acreditar una corrida completa de `npm run verify` con exit 0, o registrar el diagnóstico del entorno como hallazgo, antes de `/microfase M16f`. No impide la auditoría del plan una vez resuelto P-01 |

## Siguiente paso

Resolver P-01, sea con `spec-audit-7` APROBABLE o con una excepción expresa registrada en la spec, y volver a correr `/plan-auditor M16f` (`plan-audit-2`).
