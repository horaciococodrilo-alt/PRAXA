# Auditoría del plan de M26a — ronda 3

- **Fecha:** 2026-11-13.
- **Commit y rama:** `0e871be323597577c5e98f6f9bc4babb4ac3dd46`, `docs/m26a-spec`. El plan y las auditorías recientes están sin seguimiento; los demás cambios preexistentes se preservaron.
- **Hash de contenido de la spec** (sin la línea `**Estado:**`, con los finales de línea del árbol): `6c2f2f65999ffd4c9904861aeaa43932a56aa2cb`.
- **Hash de contenido del plan** (mismo método): `662daf4da9431da0d4d05022df68f5eafc96fcc1`.
- **Alcance:** revisión documental y estática; no se ejecutaron pruebas, migraciones ni código nuevo.

## Precondiciones y excepción

La spec está en `APROBADA` y `plan.md` existe. La última auditoría de la spec, `spec-audit-6.md`, dice **REQUIERE CAMBIOS** y registra el hash anterior `ca6db6ad6a0ad58cdd4fcb8b59194350ab9f9a3b`. El usuario dispensó expresamente estas dos precondiciones de la skill para esta auditoría con «no importa hace la auditoria igualmente haber si encotnras errores o bugs». Esta dispensa permite examinar el plan actual; no convierte `spec-audit-6` en APROBABLE ni aprueba el plan.

## Veredicto

**REQUIERE CAMBIOS: 7 PASS, 5 FAIL.** Fallan los ítems 2, 4, 5, 10 y 11. El informe evalúa el plan actual, cuyo hash difiere del `2409d0c8…` citado por `plan-audit-2.md`; las correcciones de aquella ronda en los pasos 11 y 21 ya están incorporadas.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Spec base | PASS | `plan.md:7` cita la spec APROBADA y `6c2f2f6…`; coincide con el hash actual calculado. Rige la excepción de precondiciones indicada arriba. |
| 2 | Cobertura | **FAIL** | C-01–C-19 y T-01–T-33 aparecen en la tabla de pasos (`plan.md:44-69`), pero varios criterios **heredados** de `spec.md:204-223` no aparecen en ningún paso: criterio de la ficha, §16.1–§16.6, DEC-09 y CA-40. `plan.md:75` los resume fuera de los pasos, y algunos se cubren por C-nn, pero el checklist exige trazarlos en al menos un paso. P-02. |
| 3 | TDD | PASS | Secuencias 3→4 (SQL), 6→7 (TypeScript), 12→13 (proveedor) y 17→18 (UI/PDF) escriben pruebas antes del código. Las revisiones documentales, la evaluación y la inspección visual no requieren un rojo artificial (`spec.md:249-287`). |
| 4 | Archivos | **FAIL** | Los grupos A–N de `plan.md:21-36` caben en II.14 y seguimiento, pero `plan.md:9,81` exige además editar `docs/FASES/FASE1/meta_first/spec.md`, que no figura en la tabla cerrada de II.14 (`meta_first/plan.md:812`). El usuario ya eligió enmendar la ruta, pero esa acción separada aún no consta ejecutada; el plan dice que debía preceder a esta auditoría. P-01. |
| 5 | Pasos | **FAIL** | En el paso 3 se modifica `09_integration_privileges.test.sql` para exigir 26 funciones y a la vez se exige que «tests previos» sigan verdes antes de crear/aplicar `0022` (pasos 4-5): las aserciones modificadas necesariamente fallarán. Además, la acción de actualizar «la lista cerrada» no identifica todas las aserciones de 22/21 funciones de `09`. P-03. El resto del orden respeta las dependencias. |
| 6 | Migraciones | PASS | `0022_meta_diagnostics.sql` y pgTAP `17` están libres tras `0021` y `16`; `plan.md:95` exige migración nueva autorizada para corregir o revertir una aplicada y prohíbe editar existentes. |
| 7 | Comandos | PASS | `verify`, `db:check:test`, `test:policies`, `test:app`, `test:eval`, `test:unit`, `test:component` y ambos `db:push` están en `package.json`. Los controles de `plan.md:51,58,65,73` incluyen III.3 y CB-06. |
| 8 | Acciones reservadas | PASS | `db:push:test` previo y de `0022` (pasos 2 y 5), dominios (10), cuenta/clave antes del trabajo de .2 (11), commits (9/16/24), acta y aviso antes de datos reales (21), `db:push` en `app`, push y despliegue (24), y decisión del gate (26) tienen verificación posterior (`plan.md:79-89`). |
| 9 | Reglas | PASS | Fixtures sintéticos y ausencia de secretos (`plan.md:40,56,91`); K01 y tenant dentro del servidor (paso 18), escrituras de base por `worker_api` (4/7), pruebas contra desechable (2/5/8/15/22) y ninguna prueba contra producción (24). |
| 10 | Trampas | **FAIL** | H-05 exige verificar PDF en vista previa (`spec.md`, «Supuestos e hipótesis»). El paso 24 promete comprobar «PDF en vista previa», mientras el paso 25 y `plan.md:106` prohíben sembrar informes sintéticos en `app` y la cuenta piloto está vacía. Sin informe visible, la ruta solo puede devolver 404; falta un escenario aislado que produzca un PDF en esa vista previa. P-04. Las demás trampas principales tienen controles. |
| 11 | Git | **FAIL** | La skill exige que la microfase se ejecute en `mf/M26a`. El árbol actual está en `docs/m26a-spec` y el preflight del paso 1 no incluye crear o retomar `mf/M26a` ni comprobar que los cambios preexistentes permitan el cambio de rama. P-05. Los commits y el push sí quedan reservados al usuario. |
| 12 | Fidelidad | PASS | El comportamiento de datos, Anthropic, pantalla, PDF y gate sigue la spec; la enmienda de §16.2 fue elegida expresamente por el usuario y se presenta como acción documental externa, no como funcionalidad de M26a. Sigue siendo un problema de autorización y orden (P-01). |

## Hallazgos

| ID | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| P-01 | Alta | Antes de 1 | La contradicción entre `traffic` sin `action_type` y §16.2 de la ruta sigue abierta en los documentos. El plan ordena editar un archivo fuera de II.14 **antes de auditarlo**, pero esa enmienda aún no ocurrió. | `plan.md:9,81`; `meta_first/spec.md:608`; `M26a/spec.md:343`; `meta_first/plan.md:812`; `AGENTS.md`, jerarquía y «REQUIERE CAMBIO EN LA RUTA». | Tramitar la decisión ya tomada como **REQUIERE CAMBIO EN LA RUTA** en una acción documental separada y autorizada; registrar el hallazgo y la enmienda. Después, convertir la precondición del plan en referencia a la ruta ya alineada y volver a auditar. |
| P-02 | Media | Tabla de pasos | La trazabilidad de criterios heredados queda implícita o fuera de la tabla de pasos, aunque la skill exige que cada uno aparezca en al menos un paso. | `M26a/spec.md:204-223` frente a `plan.md:44-69,75`; búsqueda en la tabla sin «CA-40», «DEC-09», «§16.1» a «§16.6» ni criterio de la ficha. | Añadir en la columna de cobertura de los pasos pertinentes las referencias heredadas exactas, sin crear trabajo nuevo. |
| P-03 | Media | 3–5 | La verificación «tests previos verdes» es imposible al cambiar `09` para esperar 26 funciones antes de aplicar `0022`. El plan tampoco precisa que hay que actualizar todos los conteos y textos relacionados, no solo `functions_are`. | `plan.md:46-48`; `supabase/tests/09_integration_privileges.test.sql:388-404,440,456,524,529,559,620`: lista y varias aserciones aún esperan 22 o 21. | En el paso 3 declarar rojos esperados tanto `17` como las aserciones modificadas de `09`; exigir verdes solo de pruebas anteriores **no modificadas**. Nombrar la actualización completa de lista, conteos y textos en `09`; comprobar todo verde después del paso 5. |
| P-04 | Media | 24–25 | La prueba de PDF en vista previa no tiene informe del cual descargar: la cuenta piloto está vacía y no se siembra en `app`. Una comprobación de 404 no verifica el render PDF en el runtime de vista previa. | `plan.md:67-68,106`; `M26a/spec.md` H-05 y T-25/T-32. | Definir en el plan una vista previa aislada, vinculada al desechable con datos sintéticos y destino comprobado, para probar la descarga PDF; mantener `app` sin datos sembrados. Separar de ella el humo de 404/estado vacío en `app`. |
| P-05 | Media | 1 | El plan puede empezar a modificar archivos desde la rama documental actual sin crear/retomar `mf/M26a`. | `git status --short --branch`: `docs/m26a-spec` con cambios preexistentes; `plan.md:44`; skill `plan-auditor`, ítem 11; `microfase/SKILL.md:21,80-85`. | Agregar al preflight la creación o reanudación segura de `mf/M26a` desde la base que contenga M25a, preservando cambios; si el árbol impide cambiar de rama, detenerse y reportar. |

## Observación sobre el tamaño

M26a tiene una excepción expresa al límite de ocho horas y tres etapas con un único gate (`meta_first/plan.md:367-381`). La etapa .1 por sí sola parece superar ocho horas por SQL, pgTAP, adaptador, fixtures y medición. Se recomienda reanudar la misma microfase desde el control registrado del paso 5 y luego del paso 14, sin crear una microfase o gate adicional.
