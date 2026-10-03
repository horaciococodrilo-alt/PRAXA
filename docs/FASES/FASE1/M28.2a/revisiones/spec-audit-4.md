# Auditoría de spec — M28.2a — 2026-10-03 (cuarta ronda)

- **Commit auditado:** `a24963a` (`a24963a8374df4c83b9d6774b1f1d1eae59bcee8`).
- **Árbol de trabajo:** rama `mf/M28.2a`; `spec.md` y `plan.md` modificados, `plan-audit-4.md` a `plan-audit-6.md` sin seguimiento. Se preservaron todos. Esta auditoría evalúa la spec del árbol de trabajo.
- **Estado de entrada:** `BORRADOR`.
- **Hash de contenido de la spec, sin la línea de estado:** `acda93738f93352154ef899cd72d561f9dc09604`.
- **Veredicto: APROBABLE.** Los 18 ítems están en PASS. La enmienda P-03 alinea la ubicación de las capturas con los archivos autorizados; no modifica criterios ni pruebas.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | Las tres aceptaciones sin CA numerado de la ficha (`meta_first/plan.md:234`) están resumidas fielmente en `spec.md:125-133`. |
| 2 | Alcance | PASS | `spec.md:33-48,74-108` conserva la ficha y II.7 (`meta_first/plan.md:225-238,530-556`). C-01–C-10 (`spec.md:139-148`) trazan a las aceptaciones, DEC-03/07/18, P-06, CB y trampas. P-03 solo cambia el índice de evidencia gráfica. |
| 3 | Coherencia con la spec general | PASS | DEC-03/07/08/18, P-06, la excepción manual de CB-04 y CB-06 en `meta_first/spec.md` son compatibles con `spec.md:33-48,74-108,139-166`. M16.1 consume G-ENTORNO y M16.2 conserva el alta del dueño (`meta_first/plan.md:255-283`). |
| 4 | Decisiones | PASS | D-M28.2a-01 a 03 permanecen atribuidas al usuario en `spec.md:205-213` y no cambiaron con P-03. Conservan DEC-07, DEC-08 y la excepción de DEC-18. |
| 5 | Trampas | PASS | `spec.md:193-203` y T-05–T-09 exigen correo externo recibido, callback y recuperación completos; tratan el build sin variables, `db:check`, Data API remota y la limitación Hobby de II.7 (`meta_first/plan.md:553-555`). |
| 6 | Intervenciones y acciones reservadas | PASS | `spec.md:178-191` asigna cuentas, push, despliegue y `db:push` de `app` al usuario con comprobaciones posteriores; `db:push:test` queda excepcional y también reservado. Coincide con ficha y III.2 (`meta_first/plan.md:237,768-780`). |
| 7 | Verificación | PASS | `spec.md:150-176` exige `npm run verify`, checklist manual y registro externo de III.3 (`meta_first/plan.md:787-807`). Aplica CB-06 a casos omitidos, sin contar suites opt-in ajenas como ejecutadas. |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:19-24` registra G-DB-META y G-CRYPTO aprobados y M28.2a habilitada. `git merge-base --is-ancestor d3db802017b8367edba40e0a6ca9641167edb771 HEAD` tuvo éxito. La sesión de M06.3a documenta el cierre de G-CRYPTO por decisión del usuario y su limitación (`sesiones/M06.3a.md:467-490`). |
| 9 | Lo entregado de verdad | PASS | Se contrastaron las firmas y rutas de `spec.md:50-70` con el código: callbacks Auth, shell con `getClaims` y empresa, pantalla vacía de Integraciones, `0012`, scripts de destino, cliente del rol y llavero. P-03 no altera interfaces ni presupone código nuevo. |
| 10 | Pendientes y hallazgos | PASS | H-E1-08 sigue asignado a M28.2a y requiere prueba externa real (`HALLAZGOS.md:25,357`; `spec.md:235-239`). H-E1-23 es antecedente diferido, no parte del corte (`HALLAZGOS.md:40,395`). Los pendientes de Meta del estado del proyecto pertenecen a pasos posteriores. |
| 11 | Contexto real | PASS | Se leyeron los archivos y líneas citados en `spec.md:50-70`; existen y respaldan las afirmaciones. El diff vigente solo modifica `spec.md` y `plan.md`, sin cambios de código desde las referencias ya corregidas en A-03. |
| 12 | Archivos previstos | PASS | `spec.md:110-121` prevé solo `entorno.md` de II.7.9 y los tres archivos de seguimiento. La enmienda `spec.md:104` coloca el índice de capturas en `entorno.md` y los enlaces por caso en la sesión; las capturas quedan fuera del repositorio, sin añadir un archivo de implementación. |
| 13 | Diseño suficiente | PASS | `spec.md:74-108` define variables, destinos, callbacks, esquemas, migración, SMTP, recorridos y evidencia. El índice de capturas se define antes de la implementación; cada ubicación se registra cuando exista y debe ser accesible y verificable. Si no puede conservarse así, el paso se detiene. |
| 14 | Verificable | PASS | C-01–C-10 tienen T-01–T-11 con resultados esperados y casos negativos (`spec.md:139-166`). `package.json` define los comandos citados; los casos de dashboard/navegador se identifican expresamente como manuales sin comando npm. |
| 15 | Sin nada abierto | PASS | Q-01 a Q-03 constan resueltas (`spec.md:223-233`). H-M28.2a-01 a 04 dicen cuándo y cómo verificar acceso, Auth, migraciones y condiciones comerciales (`spec.md:215-221`); ninguna obliga a inventar una decisión antes de ejecutar. |
| 16 | Ejecutable ahora | PASS | `npm run verify` terminó con exit 0: lint, typegen, typecheck, 11 archivos/222 pruebas unitarias y de componente y build. El primer intento en sandbox falló antes de cargar Vitest por `spawn EPERM`; repetido fuera del sandbox pasó completo. `package.json` define `verify`, `db:check`, `db:preview` y `db:push`; `.env.example` contiene por nombre las seis variables del gate (`:21,27,30,87,90,94`). Las acciones externas tienen pasos asignados. |
| 17 | Consistencia interna | PASS | La evidencia de `spec.md:104-108` coincide con la tabla de archivos (`:110-121`), C-10/T-11 (`:148,166`) y la exclusión de archivos de producto (`:43-48`). La enmienda P-03 elimina la exigencia anterior de editar el plan durante la implementación. |
| 18 | Reglas no negociables | PASS | `spec.md:43-48,74-108,168-203` no introduce `company_id` del cliente, secretos, datos reales, cambios de migración ni otra vía de credenciales. CB-04 y D-M28.2a-03 limitan la excepción en `app` al recorrido manual del usuario; las suites y fixtures siguen en el desechable. La evidencia y los errores se redactan. |

## Contradicciones

Ninguna. La contradicción P-03 de `plan-audit-5.md` y `plan-audit-6.md` se resuelve en esta spec enmendada: el índice de capturas va en `entorno.md`, que II.7.9 autoriza, y no exige modificar el plan durante la implementación.

## Hallazgos

Ninguno nuevo. H-E1-08 permanece pendiente hasta verificar la recepción del correo externo durante la implementación.

## Observación de tamaño

El trabajo de implementación es de configuración, verificación manual y documentación, con acciones externas asignadas al usuario. Parece caber en ocho horas de implementación; no se recomienda partirlo.

## Siguiente paso

La spec es APROBABLE. El usuario puede aprobar esta versión para pasarla a `APROBADA`; después corresponde repetir `$plan-auditor M28.2a`. Esta auditoría no cierra G-ENTORNO ni inicia la microfase.
