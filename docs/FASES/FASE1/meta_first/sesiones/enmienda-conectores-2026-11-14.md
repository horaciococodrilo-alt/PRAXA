# Enmienda de conectores Tiendanube y GA4 — 2026-11-14

**Decisión del usuario.** El usuario escribió en el chat «apruebo la enmienda de ruta», después de que el asistente señalara que `M16e` y `M16f` requerían cambio en la ruta. Con eso aprobó la [propuesta del 2026-11-12](../revisiones/propuesta-conectores-tiendanube-ga4-2026-11-12.md). En el mismo mensaje pidió registrar `G-DIAG` como aprobado ([sesión M26a](M26a.md)).

## Qué se aprueba

- El orden de la propuesta: `G-DIAG` → `M16e` (`G-TIENDA`) → `M16f` (`G-GA4-FUSION`) → `M28.3a` ampliada.
- `M28.3a` espera `G-CHAT`, `G-ANOMALIES`, `G-DIAG`, `G-TIENDA` y `G-GA4-FUSION`. Esto cierra la decisión 1 de §7 de la propuesta, en el sentido del orden propuesto.
- Excepción al límite de 8 horas para `M16e` y `M16f`, ya decidida por el usuario el 2026-11-12.
- El piloto sigue siendo uno (DEC-01): una tienda y una propiedad del dueño. La distribución pública queda fuera, lo que cierra la decisión 7 en el sentido de la propuesta (separar el gate técnico de los trámites de publicación).

## Qué no se aprueba

- Las specs y los planes de `M16e` y `M16f`. Las specs son borradores anteriores a la enmienda: sus avisos de «Bloqueo de entrada — REQUIERE CAMBIO EN LA RUTA» quedan desactualizados y se corrigen en la revisión de cada spec.
- El acta de datos ampliada para pedidos, compradores y GA4 (`H-E1-237`).
- Las decisiones 2 a 6 de §7 de la propuesta, que quedan como preguntas abiertas de las specs.
- Que el dueño tenga una tienda y una propiedad GA4 con actividad real apta. No está verificado; si no las tiene, los gates no se pueden cerrar con datos reales.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `meta_first/plan.md` | Encabezado; I.1 (tabla y exclusiones); mapa I.2; gates I.3; fichas de `M26a`, `M16e`, `M16f` y `M28.3a`; II.14b, II.14c y paso 2 de II.15; III.2, III.3 y III.8 |
| `meta_first/spec.md` | Estado, §1, §2 y §17 nueva |
| `revisiones/propuesta-conectores-tiendanube-ga4-2026-11-12.md` | Línea de estado |
| `docs/PROJECT_STATE.md` | `G-DIAG` cerrado; `M16e` como siguiente habilitada |
| `docs/HALLAZGOS.md` | Estado de `H-E1-236` a `H-E1-238` |

`SECURITY.md`, `ARCHITECTURE.md` y el acta `M03a` no se tocan ahora: cambian dentro de `M16e` y `M16f`, que los listan como archivos previstos, cuando cambien la frontera o el control.

## Verificación

Revisión del diff y `git diff --check`. Es un cambio documental: no hay código ni pruebas.
