# Auditoría de plan — M28.2a — 2026-10-03 (octava ronda)

- **Commit auditado:** `b09c10e2ce58f8aeebb76b3cc4249916c388d72c`.
- **Árbol de trabajo al comenzar:** rama `mf/M28.2a`; `plan.md` corregido para resolver P-04 (hallazgo de `plan-audit-7.md`) y `revisiones/plan-audit-7.md` revertido a su veredicto original tras una edición manual indebida de su línea de veredicto. `revisiones/plan-audit-8.md` es nuevo. Working tree limpio salvo estos archivos; se preservaron.
- **Spec aprobada, hash de contenido sin línea de estado:** `acda93738f93352154ef899cd72d561f9dc09604`. `spec-audit-4.md` registra ese hash y veredicto APROBABLE.
- **Plan auditado, hash de contenido sin línea de estado:** `fcbbffc10f84c3bab7a6f2d10081515fdd6a150f`.
- **Veredicto: APROBABLE.** Los 12 ítems están en PASS o NO APLICA justificado. P-04 queda resuelto: el plan ya no describe la spec como `BORRADOR` ni se contradice a sí mismo sobre su propia auditabilidad.

## Precondiciones

| Precondición | Resultado |
|---|---|
| `spec.md` en `APROBADA` | Cumple (`spec.md:3`) |
| Última `spec-audit-N.md` APROBABLE | Cumple (`spec-audit-4.md:7`) |
| Hash de la spec coincide con el de esa auditoría | Cumple: `acda93738f93352154ef899cd72d561f9dc09604` en ambos |
| `plan.md` existe y está en `BORRADOR` | Cumple (`plan.md:3`, corregido de `APROBADA` a `BORRADOR` antes de esta auditoría, ya que su contenido había cambiado desde la última vez que se aprobó) |

## Checklist

| # | Ítem | PASS/FAIL/NO APLICA | Evidencia |
|---:|---|---|---|
| 1 | Spec base | PASS | `plan.md:7` cita el hash `acda93738f93352154ef899cd72d561f9dc09604`, que coincide con el hash actual de `spec.md` y con el registrado en `spec-audit-4.md:7`. Ya no afirma que la spec está en `BORRADOR` ni que este plan "no puede auditarse todavía": el hallazgo P-04 de `plan-audit-7.md` queda resuelto. |
| 2 | Cobertura | PASS | Las tres aceptaciones de la ficha (`meta_first/plan.md:234`) y C-01–C-10/T-01–T-11 de `spec.md:125-166` aparecen en los pasos 0–11 de `plan.md:42-59`: C-01/T-01 en 1, 2 y 8d; C-02 en 2; C-03 en 3 y 3R; C-04 en 4 (ambos esquemas, `worker_api` y `private`); C-05 en 5, 7 y 8b; C-06/C-07 en 6 y 7; C-08 en 8; C-09 en 8b; T-09 en 8c; C-10/T-11 en 9 y 10. El cierre en el paso 11 exige los tres criterios de la ficha. |
| 3 | TDD | PASS | `plan.md:40` explica por qué no corresponde un ciclo RED–GREEN (sin código ni pruebas automatizadas nuevas) y prepara la matriz de casos antes de configurar. Coincide con `spec.md:150-152`. |
| 4 | Archivos | PASS | `plan.md:19-32` limita la tabla a `meta_first/entorno.md` (autorizado por II.7.9, `meta_first/plan.md:545`) y a los tres archivos de seguimiento que autoriza la Precondición 8 de la ruta (`meta_first/plan.md:370`): `sesiones/M28.2a.md`, `PROJECT_STATE.md` y `HALLAZGOS.md`. Ningún archivo de producto. Las capturas quedan fuera del repositorio e indexadas en `entorno.md`, sin crear anexos versionados nuevos. |
| 5 | Pasos | PASS | `plan.md:42-59` ordena precondiciones (0), dominio/Vercel (1), variables (2), migración (3/3R), exposición de esquemas (4), Auth (5), SMTP (6), alta de prueba con registro abierto (7), cierre de registro (8), recuperación (8b), casos borde sin sesión (8c), verificación de Integraciones con empresa sintética (8d), documentación (9), `verify` y revisión de diff (10), y aprobación del gate (11). El orden respeta las dependencias (migración antes de revisar exposición; alta de prueba antes de cerrar registro; cierre de registro antes de probar recuperación). Cada fila tiene verificación propia. |
| 6 | Migraciones | NO APLICA, justificado | `plan.md:139-145` no crea ni modifica ninguna migración; aplica mediante el wrapper existente las pendientes hasta `0012_integrations.sql`, que es la última presente en `supabase/migrations/`. Fija que el siguiente número sería `0013` y que una reversión exigiría una migración nueva fuera de este corte. |
| 7 | Comandos | PASS | `npm run verify`, `db:check`, `db:preview`, `db:push`, `db:check:test` y `db:push:test` están definidos en `package.json:10-26`. `plan.md:90-122` incluye el checklist manual y el registro con dirección externa que exige III.3 (`meta_first/plan.md:798`), y aplica CB-06 a los casos omitidos (`plan.md:122`). Los comandos de Git del paso 0 y de "Verificación final" (`plan.md:92-99`) son de uso estándar. |
| 8 | Acciones reservadas | PASS | `plan.md:124-137` asigna al usuario el push de `mf/M28.2a` (si hiciera falta), el despliegue, `db:push` sobre `app`, `db:push:test` solo en la rama excepcional 3R, y las acciones de cuenta de los pasos 4 a 8d, cada una con su verificación posterior. La aprobación de `G-ENTORNO` queda reservada al paso 11. |
| 9 | Reglas | PASS | `plan.md:33-34,162-163` evita secretos, datos reales y lectura de `.env.local`. El contrato del rol (`plan.md:71-73`) mantiene `PRAXA_INTEGRATIONS_DB_URL` bajo `praxa_integrations.<ref>`, sin `service_role`. Las suites automatizadas quedan limitadas al proyecto desechable (`plan.md:161`); el recorrido manual en `app` sigue la excepción expresa de II.7 y D-M28.2a-03 (`meta_first/plan.md:551`), no una suite. |
| 10 | Trampas | PASS | `plan.md:147-156` cubre la trampa del SMTP por defecto (solo entrega al equipo, dos mensajes por hora) exigiendo una dirección externa en los pasos 6-7, y conserva DEC-08 (Vercel Hobby) sin reabrir esa decisión, igual que las trampas de `meta_first/plan.md:553-555`. |
| 11 | Git | PASS | `plan.md:44-45,92-102,129` exige la rama `mf/M28.2a` en el paso 0 y en la verificación final, sin operaciones destructivas ni push por parte del asistente; el push, si hace falta, queda reservado al usuario en el paso 1. |
| 12 | Fidelidad | PASS | El plan no agrega funcionalidad fuera de la ficha y la spec (sin código, `vercel.json` ni cambios de configuración versionada, `plan.md:160`) y cubre los diez criterios operativos y las tres aceptaciones heredadas sin omitir ninguno. |

## Hallazgos

Ninguno. El hallazgo P-04 de `plan-audit-7.md` queda resuelto: `plan.md:7` y `plan.md:32` ya reflejan que la spec está `APROBADA` (vía `spec-audit-4.md`) y que P-03 fue resuelto por ella, sin pendientes de auditoría sobre la spec que bloqueen auditar este plan.

## Observación de tamaño

El trabajo de configuración, verificación manual y documentación sigue pareciendo acotado a ocho horas de implementación; las esperas de cuentas, DNS, migraciones y correo externo son intervenciones del usuario. No se recomienda partirlo.

## Siguiente paso

El plan es APROBABLE. El usuario puede aprobarlo ("Apruebo el plan de M28.2a: pasá el estado a APROBADO"). Después, para ejecutar la microfase conviene abrir una sesión nueva y correr `/microfase M28.2a`, ya que esta sesión intervino como auditor y como correctora del plan y de la auditoría anterior.
