# Auditoría de plan — M28.2a — 2026-10-03 (cuarta ronda)

- **Commit auditado:** `a24963a8374df4c83b9d6774b1f1d1eae59bcee8`.
- **Árbol de trabajo al comenzar:** limpio; rama `mf/M28.2a`.
- **Spec aprobada, hash de contenido sin línea de estado:** `7517041448d9579977406bf7c8cd6d39a954e922`.
- **Plan auditado, hash de contenido sin línea de estado:** `78a06808c0cf4205ad34316ffd9f6dbe58b78803`.
- **Precondición de auditoría de spec:** `spec-audit-3.md` tiene veredicto APROBABLE, pero su hash principal (`cb4ab933b0bcdf480a5ef699c278f7b96dbf55ec`) no corresponde al contenido vigente. La nota aclaratoria posterior del mismo informe documenta el desfase, registra el hash vigente e identifica `spec-audit-2.md` como la auditoría APROBABLE de ese contenido. El plan también cita `spec-audit-2.md`. Se aplica esa aclaración expresa para continuar esta ronda; la discrepancia histórica permanece visible.
- **Veredicto: REQUIERE CAMBIOS.** Los ítems 4 y 11 fallan.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---:|---|---|---|
| 1 | Spec base | PASS | `plan.md:5` cita la spec aprobada y el hash `751704…`, recalculado sobre el archivo actual. `spec-audit-2.md` lo registra como APROBABLE; ver aclaración de precondición. |
| 2 | Cobertura | PASS | Las tres aceptaciones de la ficha y C-01–C-10/T-01–T-11 de `spec.md:125-166` se trazan en `plan.md:45-61`. La matriz final exige estado y evidencia para cada caso. |
| 3 | TDD | PASS | `plan.md:42` razona que no hay código ni pruebas nuevas; prepara la matriz antes de configurar. La spec clasifica los casos manuales y `verify` como no aplicables a un ciclo RED–GREEN (`spec.md:150-166`). |
| 4 | Archivos | **FAIL** | La tabla de `plan.md:27-30` incorpora el propio `plan.md` y capturas nuevas; el paso 9 prevé modificarlos. II.7 solo nombra `meta_first/entorno.md` (`meta_first/plan.md:545`); la excepción de la skill permite `HALLAZGOS.md`, `PROJECT_STATE.md` y `sesiones/M28.2a.md`, pero no esos archivos adicionales. La ficha exige capturas redactadas (`meta_first/plan.md:234`), por lo que su ubicación debe resolverse sin ampliar silenciosamente la tabla autorizada. |
| 5 | Pasos | PASS | Los pasos 0–11 siguen preparación, despliegue, migración, configuración, recorridos manuales, evidencia, `verify` y aprobación (`plan.md:45-61`). Cada fila contiene verificación propia; 3R se declara excepcional y detiene el flujo normal. |
| 6 | Migraciones | PASS | `plan.md:141-147` no crea ni modifica migraciones, exige historial hasta `0012` y reversión mediante una nueva. El directorio `supabase/migrations/` termina en `0012_integrations.sql`; el siguiente número es `0013`. |
| 7 | Comandos | PASS | `package.json` define `verify`, `db:check`, `db:preview`, `db:push`, `db:check:test` y `db:push:test`. `plan.md:92-117` incluye `npm run verify`, checklist y registro externo de III.3; `plan.md:59,61,119` aplica CB-06 y no cuenta omitidos como aprobados. |
| 8 | Acciones reservadas | PASS | `plan.md:47-57,129-139` asigna al usuario push, despliegue, `db:push` en `app`, `db:push:test` solo en 3R y tareas de cuentas; cada una tiene verificación posterior. El gate requiere aprobación visible en el paso 11. |
| 9 | Reglas | PASS | `plan.md:35-36,53-59,65-77,119,142-147` prohíbe valores sensibles, credenciales administrativas en Vercel, suites/fixtures en `app` y uso de una vía distinta de `worker_api`. El recorrido manual en `app` reproduce la excepción expresa de II.7 y D-M28.2a-03; no agrega entrada de `company_id` desde cliente. |
| 10 | Trampas | PASS | `plan.md:47-59,149-157` comprueba correo externo real, callbacks, recuperación completa, re-despliegue por variables públicas, límites de `db:check`, pantalla vacía y riesgo Hobby; conserva DEC-08. La falta de infraestructura o de prueba no aprueba el gate. |
| 11 | Git | **FAIL** | El árbol está ahora en `mf/M28.2a`, pero el plan no exige trabajar en esa rama. `plan.md:46-47,131` habla de comprobar Git y de publicar a “la rama conectada”, sin fijar `mf/M28.2a` ni verificarla antes de ejecutar o del push reservado. No propone operaciones destructivas ni push del asistente. |
| 12 | Fidelidad | PASS | Configuración, recorridos y exclusiones de `plan.md:45-61,65-157` corresponden a `spec.md:33-48,74-108,139-166` y a II.7. Los casos negativos 8c y 8d ya están en T-09/T-01; no son funcionalidad añadida. |

## Hallazgos

| ID | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| P-01 | Alta | Archivos; 9 | El plan incluye archivos fuera de la lista permitida por el checklist, y el paso 9 modifica el propio plan aprobado para inventariar capturas. | `plan.md:27,30,59`; II.7.9 en `meta_first/plan.md:545`; ficha en `:234`; `spec.md:102-108,110-121`. | Ajustar el inventario y el paso 9 a los archivos autorizados. Resolver expresamente cómo conservar y referenciar las capturas requeridas dentro del alcance de la ruta; si se necesitan anexos versionados adicionales o modificar el plan durante la ejecución, autorizarlo en la fuente superior antes de repetir la auditoría. |
| P-02 | Media | 0; 1 | El plan no impone la rama `mf/M28.2a`; “rama conectada” permite otra. | `plan.md:46-47,131`; `git status --short --branch` muestra la rama correcta solo para esta auditoría. | Exigir en el paso 0 la comprobación de `mf/M28.2a` y, en el paso 1, que el commit desplegado y el eventual push del usuario correspondan a esa rama. |

## Observación de tamaño

El corte documental y de verificación parece caber en ocho horas de implementación; las esperas de cuentas, DNS y correo se registran como intervenciones del usuario. No se recomienda partirlo.

## Siguiente paso

Volver a plan mode, corregir el plan y auditarlo otra vez. Esta auditoría no aprueba el plan, no ejecuta M28.2a y no cambia `G-ENTORNO`.
