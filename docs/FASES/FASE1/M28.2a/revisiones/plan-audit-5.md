# Auditoría de plan — M28.2a — 2026-10-03 (quinta ronda)

- **Commit auditado:** `a24963a8374df4c83b9d6774b1f1d1eae59bcee8`.
- **Árbol de trabajo al comenzar:** rama `mf/M28.2a`; `plan.md` modificado y `plan-audit-4.md` sin seguimiento. Se preservaron ambos.
- **Spec aprobada, hash de contenido sin línea de estado:** `7517041448d9579977406bf7c8cd6d39a954e922`.
- **Plan auditado, hash de contenido sin línea de estado:** `32ed21e1968bd0aacb1b334195939ce9ffa06aa6`.
- **Precondición de auditoría de spec:** `spec-audit-3.md` es APROBABLE, pero su hash principal difiere del vigente. Su nota aclaratoria posterior identifica expresamente `spec-audit-2.md`, también APROBABLE, como auditoría del hash vigente y registra el desfase. Se aplica esa aclaración documentada, como en la ronda anterior.
- **Veredicto: REQUIERE CAMBIOS.** El ítem 12 falla. P-01 y P-02 de la cuarta ronda quedaron corregidos; se detectó P-03.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---:|---|---|---|
| 1 | Spec base | PASS | `plan.md:5` cita la spec aprobada y su hash vigente `751704…`, recalculado. `spec-audit-2.md` lo auditó con veredicto APROBABLE; ver aclaración de precondición. |
| 2 | Cobertura | PASS | Las tres aceptaciones de la ficha y C-01–C-10/T-01–T-11 de `spec.md:125-166` están trazados a los pasos 0–11 de `plan.md:44-59`; el paso 11 exige todos los casos. |
| 3 | TDD | PASS | `plan.md:40` justifica que no hay código ni pruebas automatizadas nuevas y ordena preparar la matriz antes de configurar. `spec.md:150-166` también declara la no aplicabilidad del ciclo RED–GREEN. |
| 4 | Archivos | PASS | `plan.md:24-32` limita los archivos modificables a `meta_first/entorno.md`, `meta_first/sesiones/M28.2a.md`, `PROJECT_STATE.md` y `HALLAZGOS.md`; coincide con II.7.9 y los archivos de seguimiento admitidos por la skill. Las capturas quedan fuera del repositorio; el paso 9 ya no modifica el plan. |
| 5 | Pasos | PASS | `plan.md:44-59` sigue dependencias de preparación, despliegue, migración, configuración, recorridos, documentación, `verify` y gate. Cada fila tiene verificación propia; 3R se declara excepcional. |
| 6 | Migraciones | PASS | `plan.md:139-145` no crea ni modifica migraciones y exige reversión mediante una nueva. `supabase/migrations/` termina en `0012_integrations.sql`; el siguiente número es `0013`. |
| 7 | Comandos | PASS | `package.json` define `verify`, `db:check`, `db:preview`, `db:push`, `db:check:test` y `db:push:test`. `plan.md:90-117` incluye `npm run verify`, checklist manual y registro externo de III.3; CB-06 figura en los pasos 9–11 y en la regla sobre casos omitidos. |
| 8 | Acciones reservadas | PASS | `plan.md:45-55,125-135` asigna al usuario push de `mf/M28.2a`, despliegue, `db:push` en `app`, `db:push:test` solo en 3R y acciones de cuenta; exige verificaciones posteriores. La aprobación de G-ENTORNO está en el paso 11. |
| 9 | Reglas | PASS | `plan.md:33-34,51-57,63-75,117,140-145` evita valores sensibles y credenciales administrativas, usa solo el rol acotado, y restringe suites y fixtures al proyecto desechable. El recorrido manual en `app` responde a la excepción expresa de II.7 y D-M28.2a-03. |
| 10 | Trampas | PASS | `plan.md:45-59,147-155` cubre correo externo real, callbacks, recuperación completa, redespliegue tras variables públicas, límites de `db:check`, pantalla vacía y riesgo Hobby. Un caso omitido mantiene el gate pendiente. |
| 11 | Git | PASS | `plan.md:44-45,90,98,127` exige `mf/M28.2a` al comienzo y al final, y comprueba rama/commit remoto antes del despliegue. No contempla operaciones destructivas ni push del asistente. |
| 12 | Fidelidad | **FAIL** | `spec.md:104` exige que las rutas concretas de las capturas se listen en el plan de implementación bajo el paso 9. El plan revisado (`plan.md:32,57`) dice que se registrarán solo en `entorno.md#capturas-redactadas` y ordena no editar el plan. Son instrucciones incompatibles sobre la evidencia de cierre. |

## Hallazgos

| ID | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| P-03 | Alta | 9 | La solución para mantener la tabla de archivos dentro del alcance contradice la spec aprobada sobre dónde listar las rutas de capturas. | `spec.md:104` frente a `plan.md:32,57`; la tabla de `spec.md:110-121` tampoco prevé modificar el plan. | Resolver la contradicción en la fuente superior mediante el proceso de aprobación que corresponda y después alinear el paso 9. Mantener las capturas redactadas, verificables y enlazadas; no tratarlas como aprobadas por una referencia inaccesible. |

## Observación de tamaño

El trabajo de implementación documental y verificación parece caber en ocho horas; las esperas externas son intervenciones del usuario. No se recomienda dividirlo.

## Siguiente paso

Volver a plan mode, resolver P-03 y repetir la auditoría. Esta ronda no aprueba el plan ni cambia `G-ENTORNO`.
