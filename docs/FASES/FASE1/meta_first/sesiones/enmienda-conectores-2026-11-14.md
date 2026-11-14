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

## Ampliación D-M16e-10 (mismo día)

El usuario decidió, al cerrar las preguntas de la spec de `M16e`, que el chat y el diagnóstico usen los datos de Tiendanube dentro de `M16e`. Confirmó la opción «Sí, ambos en M16e», que incluía la mini enmienda de la ruta. Cambian:

- la ficha de `M16e` (punto 8 de «Implementación requerida») y II.14b del plan;
- §16 (nota de la enmienda) y §17, puntos 4 y 8, de la spec de la ruta.

Las decisiones de la spec están en `M16e/spec.md` (D-M16e-04 a D-M16e-11).

## Correcciones de `spec-audit-1` de M16e (mismo día)

La [auditoría de la spec de M16e](../../M16e/revisiones/spec-audit-1.md) dio REQUIERE CAMBIOS. El usuario respondió las decisiones pendientes (D-M16e-12 a D-M16e-20 en `M16e/spec.md`). Las que tocan la ruta:

- **Spec de la ruta:**
  - §17.4: la regla de cinco aplica a cohortes;
  - §17.6: remite a las excepciones de la spec;
  - §17.9: excepciones acotadas a CB-04, INV-10 e INV-01;
  - §17.10: CA-05, CA-11c, CA-18, CA-28, CA-52, CA-62 y CA-70 enmendados para Tiendanube, con una referencia en cada CA y en CB-04.
- **Plan de la ruta:**
  - ficha de `M16e`: punto 6, sin exportación, y quinta etapa;
  - II.14b: quinta etapa y archivos `meta/oauth.ts`, preflight, `entorno.md` y pantalla del diagnóstico.
- **`PROJECT_STATE.md`:** el acta se aprueba antes del código.

## Correcciones de `spec-audit-2` de M16e (mismo día)

La [segunda auditoría](../../M16e/revisiones/spec-audit-2.md) dio REQUIERE CAMBIOS. El usuario aprobó en el chat estas enmiendas de ruta (D-M16e-21 a D-M16e-25 en `M16e/spec.md`):

- **Chat, para Meta y Tiendanube (D-M16e-21):** nota «Enmienda H-E1-228» en §12 de la spec de la ruta, con referencias en DEC-11, DEC-19, CA-50, CA-50b, CA-50c, CA-66 y la fila «Chat» de §14. Resuelve `H-E1-234`.
- **Archivos (D-M16e-22):** II.14b suma la página y el componente del chat, `app-data` y los pgTAP `08`, `09`, `09b` y `10`.
- **Informe del diagnóstico (D-M16e-23):** nota «Enmienda D-M16e-15» en §16, con salvedades en el punto 6 y en «Retención».
- **Registro del chat (D-M16e-24):** CA-62 completado en §17.10.
- **Publicación (D-M16e-25):** dos publicaciones en `app` antes del gate, al terminar las etapas 4 y 5, en la ficha y en II.14b.

Además, §17.10 remite a las dos notas nuevas y `HALLAZGOS.md` marca `H-E1-234` como resuelto en la ruta.

## Verificación

Revisión del diff y `git diff --check`. Es un cambio documental: no hay código ni pruebas.
