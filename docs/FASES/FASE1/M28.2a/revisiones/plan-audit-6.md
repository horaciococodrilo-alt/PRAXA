# Auditoría de plan — M28.2a — 2026-10-03 (sexta ronda)

- **Commit auditado:** `a24963a8374df4c83b9d6774b1f1d1eae59bcee8`.
- **Árbol de trabajo al comenzar:** rama `mf/M28.2a`; `plan.md` modificado y `plan-audit-4.md` y `plan-audit-5.md` sin seguimiento. Se preservaron.
- **Spec aprobada, hash de contenido sin línea de estado:** `7517041448d9579977406bf7c8cd6d39a954e922`.
- **Plan auditado, hash de contenido sin línea de estado:** `a7d7e92b76057ca43512fa216f69d62848bcfba8`.
- **Precondición de auditoría de spec:** `spec-audit-3.md` es APROBABLE pero su hash principal difiere del contenido vigente. Su nota aclaratoria posterior registra el hash vigente y designa `spec-audit-2.md`, también APROBABLE, como la auditoría correspondiente. Se usa esa aclaración documentada.
- **Veredicto: REQUIERE CAMBIOS.** El ítem 12 sigue en FAIL: P-03 se reconoce y bloquea la ejecución, pero no está resuelto en la spec aprobada.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---:|---|---|---|
| 1 | Spec base | PASS | `plan.md:5` cita la spec aprobada y el hash vigente `751704…`, recalculado y registrado por `spec-audit-2.md`. |
| 2 | Cobertura | PASS | Los pasos 0–11 de `plan.md:44-59` trazan las tres aceptaciones de la ficha y C-01–C-10/T-01–T-11 de `spec.md:125-166`; el paso 11 exige todos los casos. |
| 3 | TDD | PASS | `plan.md:40` explica por qué no aplica RED–GREEN a este corte sin código ni pruebas nuevas y prepara la matriz antes de configurar. La spec también marca la no aplicabilidad para cada caso (`spec.md:150-166`). |
| 4 | Archivos | PASS | `plan.md:24-30` limita los archivos a `meta_first/entorno.md` y los tres archivos de seguimiento admitidos. El paso 9 no agrega anexos versionados ni modifica el plan; las capturas quedarían fuera del repositorio. |
| 5 | Pasos | PASS | `plan.md:44-59` ordena las dependencias y da verificación a cada paso. El paso 0 detiene la ejecución si P-03 sigue abierto; 3R es excepcional y no permite continuar al paso 3 con la dependencia sin resolver. |
| 6 | Migraciones | PASS | `plan.md:139-145` no modifica migraciones existentes ni crea otra en este corte; prevé reversión con una migración nueva. El directorio termina en `0012_integrations.sql`; el siguiente número es `0013`. |
| 7 | Comandos | PASS | `package.json` define todos los comandos del plan: `verify`, `db:check`, `db:preview`, `db:push`, `db:check:test` y `db:push:test`. `plan.md:90-119` incluye `npm run verify` y el checklist manual/registro externo de III.3; CB-06 impide contar omitidos como aprobados. |
| 8 | Acciones reservadas | PASS | `plan.md:45-55,125-135` asigna al usuario push, despliegue, `db:push` sobre `app`, `db:push:test` en 3R y las acciones de cuentas, cada una con verificación posterior. El gate requiere aprobación visible en el paso 11. |
| 9 | Reglas | PASS | `plan.md:33-34,51-57,63-75,117,140-145` evita valores sensibles, credenciales administrativas, suites/fixtures en `app` y rutas de credenciales distintas de `worker_api`. El recorrido manual en `app` sigue la excepción aprobada de II.7. |
| 10 | Trampas | PASS | `plan.md:45-59,147-155` exige correo externo recibido y abierto, recuperación completa, redespliegue tras cambios públicos y comprobación remota de Auth/Data API; reconoce límites de `db:check`, pantalla vacía y Hobby. |
| 11 | Git | PASS | `plan.md:44-45,92,102,129` exige `mf/M28.2a` al inicio y al final, y comprueba rama y commit remoto antes del despliegue. No prevé operaciones destructivas ni push del asistente. |
| 12 | Fidelidad | **FAIL** | La spec aprobada exige listar las rutas concretas de las capturas en el plan durante el paso 9 (`spec.md:104`). El plan vigente exige registrarlas en `entorno.md` conforme a una spec futura, todavía no aprobada (`plan.md:32,44,57`). Reconocer la contradicción y detener la ejecución no convierte ese cambio propuesto en el contrato vigente. |

## Hallazgos

| ID | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| P-03 | Alta | 0; 9 | Persiste la incompatibilidad entre la ubicación de las rutas de capturas exigida por la spec vigente y la indicada por el plan. El paso 0 la convierte correctamente en condición de parada, pero el plan aún no puede aprobarse frente a la spec actual. | `spec.md:104`; `plan.md:32,44,57`; la spec conserva hash `751704…`. | Si se mantiene la solución propuesta en el plan, enmendar la spec, auditarla y aprobarla; después actualizar el hash citado por el plan y repetir esta auditoría. Hasta entonces conservar P-03 abierto y M28.2a sin ejecutar. |

## Observación de tamaño

El trabajo documental y de verificación parece caber en ocho horas de implementación; las esperas de cuentas, DNS y correo corresponden a intervenciones del usuario. No se recomienda dividir el corte.

## Siguiente paso

Volver a plan mode para resolver P-03 en la fuente superior y auditar de nuevo. Esta ronda no aprueba el plan ni cambia `G-ENTORNO`.
