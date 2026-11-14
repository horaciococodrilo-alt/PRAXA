# Auditoría del plan de M16e — ronda 2

- **Fecha:** 2026-11-14
- **Commit:** `d823782` (rama `mf/M16e`), con el árbol limpio.
- **Hash de contenido de la spec:** `9a4eb6f7fa0540591aca327dda3430f1e0f6d153`
- **Hash de contenido del plan:** `c70e8b85262a8ec9093d49cee5b7ea8231829d26`

## Precondiciones

| Precondición | Resultado |
|---|---|
| Spec en `APROBADA` | Cumple. |
| Última `spec-audit-N` APROBABLE, con el hash actual | No cumple en sentido estricto: `spec-audit-4` dio REQUIERE CAMBIOS sobre `3dc84cb9…`. La sustituye la excepción expresa del usuario, registrada en el encabezado de la spec (aprobación sin auditoría APROBABLE), igual que en `plan-audit-1`. |
| Plan en `BORRADOR` | Cumple. |

## Veredicto

**APROBABLE: 12 PASS.** Los cinco hallazgos de `plan-audit-1` están corregidos. No hay hallazgos nuevos. No se ejecutaron suites: el plan no tiene código.

## Checklist

| # | Ítem | Resultado | Evidencia o justificación |
|---|---|---|---|
| 1 | Spec base | PASS | El plan cita el hash `9a4eb6f7…`, que coincide con el actual. |
| 2 | Cobertura | PASS | C-01 a C-15 y T-01 a T-15 aparecen en los pasos 1 a 14, igual que en la ronda 1. T-13 es opcional, como en la spec. Los heredados también están: CB, §17.1 a §17.10, CA-37c, CA-38, CA-38c, DEC-09, DEC-17, §12 y §16. C-03 se suma al paso 8 por la guía de desinstalación. |
| 3 | TDD | PASS | «Pruebas primero» en los pasos 1, 4, 5, 6, 8 y 11. El paso 8 define las pruebas de componente de la guía: abrir, cerrar con «Entendido» o Escape, cambiar de página, devolver el foco y abrir en «Desconectar». |
| 4 | Archivos | PASS | `lifecycle.ts` y `actions.ts` figuran en II.14b desde la enmienda P-01 (`meta_first/plan.md:915`), registrada en la sesión de la enmienda. `guia-integraciones.tsx` y su CSS están en `src/app/(app)/app/integraciones/`, que II.14b autoriza («pantalla en …»). El pgTAP `15` lo autoriza II.14b («sus pgTAP (`15`, `17`)»). El resto, como en la ronda 1. Los llamadores de firmas que cambian están dentro del alcance, y `crypto/` no cambia. |
| 5 | Pasos | PASS | El orden respeta las dependencias. El paso 7 tiene ahora control completo de .3 y commit (P-04). «Riesgos» coincide con el orden: H-05 se verifica en el paso 10 y frena la etapa .5 (P-05). |
| 6 | Migraciones | PASS | `0023` y `0024` son nuevas, y `18_tiendanube.test.sql` es el siguiente pgTAP. Ninguna existente se edita, y las reversiones van con una migración nueva. |
| 7 | Comandos | PASS | Los scripts existen en `package.json:17-27`. Los comandos de Git son válidos. Están las suites de III.3, y CB-06 aparece en «Verificación final» y en el paso 13. |
| 8 | Acciones reservadas | PASS | `db:push:test` en los pasos 2 y 12; publicaciones en los 9 y 13; commits de etapa en los pasos 2, 4, 7, 8 y 12; Portal y variables en el 3; acta en los pasos 0 y 14. Cada uno tiene su verificación. |
| 9 | Reglas | PASS | Sin secretos ni datos reales; tenant por K01; credenciales por `worker_api`; suites solo en el desechable. |
| 10 | Trampas | PASS | Las tres que faltaban tienen ahora verificación (P-03): `payment_status=any` en el paso 5, «ingreso neto» en el 8 y el recordatorio sobre la tienda del dueño en el 9. Las demás, como en la ronda 1. |
| 11 | Git | PASS | Todo en `mf/M16e`. Push, integración en `main` y despliegue los hace el usuario. |
| 12 | Fidelidad | PASS | La instrucción de desinstalación que exige la spec (§1, «Desconexión») está en el paso 8, por medio de la guía (P-02). La página «Conectar» de la guía y el modal en sí no los pide la spec, pero el usuario los decidió de forma expresa (DP-02), registrados en el plan y en la sesión de la enmienda. Su contenido se limita a describir el comportamiento real, sin funciones nuevas. |

## Hallazgos

Ninguno.

## Observación de tamaño (no afecta el veredicto)

Sin cambios respecto de la ronda 1: el plan no cabe en 8 horas, y la microfase está exceptuada. Si se quisiera un corte, el natural es cerrar en el paso 10 y llevar los pasos 11 a 13 (chat y diagnóstico) a una microfase propia.
