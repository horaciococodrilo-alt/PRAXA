# Auditoría de plan — M28.2a — 2026-10-03 (séptima ronda)

- **Commit auditado:** `a24963a8374df4c83b9d6774b1f1d1eae59bcee8`.
- **Árbol de trabajo al comenzar:** rama `mf/M28.2a`; `spec.md` y `plan.md` modificados, `plan-audit-4.md` a `plan-audit-6.md` y `spec-audit-4.md` sin seguimiento. Se preservaron.
- **Spec aprobada, hash de contenido sin línea de estado:** `acda93738f93352154ef899cd72d561f9dc09604`. `spec-audit-4.md` registra ese hash y veredicto APROBABLE.
- **Plan auditado, hash de contenido sin línea de estado:** `c03e7221f50b01bb6252bbbc2040afe8a514ce31`.
- **Veredicto: REQUIERE CAMBIOS.** El ítem 1 falla por una descripción obsoleta de la spec base. P-03 quedó resuelto en la spec aprobada.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---:|---|---|---|
| 1 | Spec base | **FAIL** | El hash citado en `plan.md:7` coincide con el de la spec actual, pero ese mismo párrafo la declara `BORRADOR`, dice que la enmienda aún requiere auditoría y aprobación, y que el plan no puede auditarse todavía. `spec.md:3` dice `APROBADA` y `spec-audit-4.md:5-6` registra ese contenido con veredicto APROBABLE. `plan.md:32` repite que P-03 está pendiente de aprobación. La referencia a la base vigente es internamente falsa. |
| 2 | Cobertura | PASS | Las tres aceptaciones de la ficha y C-01–C-10/T-01–T-11 de `spec.md:125-166` aparecen en los pasos 0–11 de `plan.md:44-59`. El cierre exige todos los casos. |
| 3 | TDD | PASS | `plan.md:40` explica por qué no aplica RED–GREEN a un corte sin código ni pruebas nuevas y prepara la matriz antes de configurar. La spec identifica los casos manuales y el alcance de `verify` (`spec.md:150-166`). |
| 4 | Archivos | PASS | `plan.md:24-30` limita los archivos de implementación a `meta_first/entorno.md` y `sesiones/M28.2a.md`, `PROJECT_STATE.md` y `HALLAZGOS.md` como seguimiento. Las capturas quedan fuera del repositorio y se indexan en `entorno.md`, según `spec.md:104`. |
| 5 | Pasos | PASS | `plan.md:44-59` ordena preparación, despliegue, migración, configuración, recorridos, documentación, `verify` y aprobación. Cada fila tiene verificación propia; 3R es excepcional. |
| 6 | Migraciones | PASS | `plan.md:139-145` no crea ni modifica migraciones, exige historial hasta `0012` y reversión mediante migración nueva. `supabase/migrations/` termina en `0012_integrations.sql`; sigue `0013`. |
| 7 | Comandos | PASS | `package.json` define `verify`, `db:check`, `db:preview`, `db:push`, `db:check:test` y `db:push:test`. `plan.md:90-122` incluye `npm run verify`, checklist manual y correo externo de III.3, y aplica CB-06 a casos omitidos. |
| 8 | Acciones reservadas | PASS | `plan.md:45-55,125-135` reserva al usuario push, despliegue, `db:push` en `app`, `db:push:test` solo en 3R y acciones de cuenta, cada una con verificación posterior. G-ENTORNO requiere aprobación visible en el paso 11. |
| 9 | Reglas | PASS | `plan.md:33-34,51-57,63-75,117,140-145` evita valores sensibles, credenciales administrativas, suites y fixtures en `app` y vías ajenas a `worker_api`. El recorrido manual en `app` sigue la excepción expresa de II.7 y D-M28.2a-03. |
| 10 | Trampas | PASS | `plan.md:45-59,147-155` exige correo externo recibido, callbacks, recuperación completa, redespliegue tras cambios públicos y comprobación remota de Auth/Data API; reconoce los límites de `db:check`, Integraciones vacía y Hobby. |
| 11 | Git | PASS | `plan.md:44-45,92,102,129` exige `mf/M28.2a` y comprueba rama/commit remoto antes del despliegue. No prevé operaciones destructivas ni push del asistente. |
| 12 | Fidelidad | PASS | La solución de P-03 (`plan.md:32,57`) ya coincide con `spec.md:104` y no altera los criterios ni las pruebas. El resto del plan no agrega funcionalidad ni omite lo requerido por la ficha y II.7. |

## Hallazgos

| ID | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| P-04 | Media | Spec base; Archivos | El plan presenta como pendiente la auditoría y aprobación de la spec enmendada, aunque ambas ya constan. Esa descripción contradice la precondición vigente y afirma que esta misma auditoría no puede hacerse. | `plan.md:7,32`; `spec.md:3`; `spec-audit-4.md:5-6`; hash de spec `acda93738f93352154ef899cd72d561f9dc09604`. | Actualizar en el plan las referencias de estado y de P-03 para reflejar `APROBADA` y `spec-audit-4.md`, conservando el hash actual y la comprobación de aprobación del paso 0. Auditar de nuevo el plan resultante. |

## Observación de tamaño

El trabajo de configuración, verificación manual y documentación parece caber en ocho horas de implementación; las esperas de cuentas, DNS y correo corresponden a intervenciones del usuario. No se recomienda dividirlo.

## Siguiente paso

Volver a plan mode, corregir P-04 y repetir la auditoría. Esta ronda no aprueba el plan ni cambia `G-ENTORNO`.
