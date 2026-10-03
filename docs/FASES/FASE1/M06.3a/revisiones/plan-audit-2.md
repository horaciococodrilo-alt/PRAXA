# M06.3a — Auditoría de plan 2

- Fecha: 2026-10-01.
- Commit base: `f96b3b3a0c49e6e67d132724fee7ba629e60170f` (`main`).
- Spec: `docs/FASES/FASE1/M06.3a/spec.md`, **APROBADA**; hash de contenido sin la línea `**Estado:**`: `73916504c73990df7a2d38ff18b7ea7f3c592375`.
- Plan: `docs/FASES/FASE1/M06.3a/plan.md`, **BORRADOR**; hash de contenido sin la línea `**Estado:**`: `9dba61e69272a17d27479c56cd526405a2c44fe2`.
- Alcance de esta ronda: corregir exclusivamente P-01 y P-02 de `plan-audit-1.md` y volver a auditar. La spec, los contratos, las decisiones Q1–Q11 y los archivos previstos no cambiaron.

## Precondiciones

Las cuatro precondiciones pasan: la spec está APROBADA; `spec-audit-5.md` es la última auditoría de spec y tiene veredicto APROBABLE; su hash de contenido coincide con el actual; el plan existe. Los hashes se calcularon como objetos Git `blob` sobre el contenido en bytes, excluida solo la línea de estado.

## Veredicto

**APROBABLE.** Los doce ítems del checklist pasan. P-01 y P-02 quedaron resueltos mediante cambios de orden en los pasos 8, 9, 13 y 14. La implementación de M06.3a no empezó y G-CRYPTO no está aprobado.

En esta tabla, **P** es `docs/FASES/FASE1/M06.3a/plan.md`, **S** su spec aprobada y **R** `docs/FASES/FASE1/meta_first/plan.md`.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Spec base | PASS | P:7 cita S con hash `73916504...`, coincidente con S actual y `spec-audit-5.md`. P sigue BORRADOR. |
| 2 | Cobertura | PASS | Expansión de rangos de P §Pasos: 27/27 criterios operativos y 53/53 casos T-01–T-53 con paso asignado. No se usó el global C-01–27 del paso 14 para acreditar cobertura de criterios. C-14/T-24 figura ahora también en 13; T-28 sigue en 8 y T-40 en 14. Los criterios heredados de S se conservan en los pasos 1–14 y en la verificación final. |
| 3 | TDD | PASS | P pasos 1–4 escriben pruebas y registran rojo antes de implementar en 5–9. T-23 se comprueba en 9; T-24 completo se comprueba tras actualizar SECURITY en 13. Los casos manuales/documentales se revisan mediante comandos o diff. |
| 4 | Archivos | PASS | P §Archivos conserva 24 entradas: las 22 entradas de S §Archivos previstos y los dos artefactos del pipeline autorizados por R precondición 9. Los archivos de seguimiento siguen bajo la precondición 8. No hay archivo nuevo de implementación ni cambio en la tabla. |
| 5 | Pasos | PASS | P:66, paso 8, comprueba solo T-28 (ubicación de pg y lockfile). P:67, paso 9, implementa el export real y prueba T-23/código/helpers, dejando T-24 completo para después. P:71, paso 13, actualiza SECURITY y ejecuta T-24 completo; P:72, paso 14, lo repite y exige por primera vez el build completo verde mediante verify. Se mantienen la intervención 11 antes de la suite remota 12 y la evidencia antes del gate 15. Cada paso tiene verificación. |
| 6 | Migraciones | PASS | P §Migraciones no crea ni modifica SQL. Último archivo real: `0012_integrations.sql`; `0013` permanece asignada a M16c. T-39 comprueba diff vacío; cualquier reversión futura requerirá una migración nueva. |
| 7 | Comandos | PASS | Los scripts citados existen en `package.json`: test:unit, db:check:test, test:app, verify, build, env:prepare y ambos db:push reservados. R III.3 y S §Verificación exigen db:check:test, test:app y verify; P los conserva. La suite nueva no puede omitirse por configuración (CB-06). `npm ci --dry-run` comprueba el lockfile en 8 sin exigir build temprano. |
| 8 | Acciones reservadas | PASS | P pasos 11/15/16 y §Intervenciones conservan contraseña, URL de pruebas y llavero a cargo del usuario antes del recorrido real; gate visible después de evidencia. Push, despliegue y db:push de app/pruebas están asignados al usuario con comprobación posterior y no se ejecutan en M06.3a. |
| 9 | Reglas | PASS | P exige material sintético, redacción y revisión del diff; K01 aporta actor/empresa en el servidor; el repositorio usa worker_api. Las pruebas reales pasan por el resolvedor del proyecto desechable y el rol acotado. No se prevé leer .env.local ni conectar al proyecto app. |
| 10 | Trampas | PASS | Se mantienen las comprobaciones de IV y etiqueta, versión ausente separada de texto alterado, TLS/URL y pooler, pg sin prepared statements con nombre, server-only en Vitest, bigint/Date, limpieza del árbol, conteo global de rotación, recifrado concurrente, reintento exacto, lockfile y configuración sin skip. El nuevo orden evita falsos fallos intermedios de T-24 y build, sin relajar sus resultados finales. |
| 11 | Git | PASS | P paso 0 prepara `mf/M06.3a` conservando cambios ajenos, sin reset ni limpieza. P paso 16 reserva push al usuario. La corrección documental actual permanece sin commit/push y no ejecuta la microfase. |
| 12 | Fidelidad | PASS | El cambio afecta solo cuándo se exige T-24 y build. P conserva nombres, contratos, archivos, pruebas, condiciones de gate, ausencia de migración y decisiones Q1–Q11 de S. No introduce stubs, ts-ignore, desactivación de typecheck ni funcionalidad adicional. |

## Revisión de P-01 y P-02

| Hallazgo anterior | Resultado | Evidencia |
|---|---|---|
| P-01 | Resuelto | Paso 9 exige T-23 y ausencia de efecto operativo en código/helpers. Paso 13 quita de SECURITY la referencia operativa y recién entonces exige T-24 completo, con C-14/T-24 en su trazabilidad. Paso 14 lo repite. El literal no se oculta por concatenación. |
| P-02 | Resuelto | Paso 8 verifica T-28 sin exigir build. Paso 9 crea el export y contrato real de `resolveIntegrationsTestTarget` y ejecuta suites focalizadas. Paso 14 exige el primer build completo verde, dentro de `npm run verify`, con todos los imports ya previstos. |

## Hallazgos de esta auditoría

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| — | — | — | Ninguno. | Doce ítems PASS; P-01 y P-02 resueltos. | — |

## Verificación y límites

- Se contrastaron AGENTS, P, S, la ficha y II.6 de R, precondiciones 8–9, III.2/III.3/III.9, PROJECT_STATE, package.json, migraciones y los contratos/código que el plan prevé consumir. La spec aprobada y el informe `plan-audit-1.md` permanecen intactos.
- Un análisis en memoria expandió los rangos C/T de la columna de pasos. Resultado: **27/27 criterios** y **53/53 casos**; T-39 y T-40 se acreditan en el paso final 14, tal como los define S. Se comparó la tabla de archivos con S: 22 de la spec más 2 artefactos del pipeline, sin faltantes ni extras. Todos los nombres de scripts npm del plan existen.
- `git diff --check` terminó con exit 0. Git mostró avisos de normalización LF/CRLF de los tres documentos modificados con anterioridad; no son fallos del diff. Una revisión en memoria del plan nuevo confirmó ausencia de espacios al final de línea.
- No se ejecutaron test:unit, test:app, db:check:test ni verify: sus suites nuevas y el cliente todavía no existen. Tampoco se abrió .env.local ni se hizo conexión, npm install, migración, commit o push. Esta auditoría comprueba el plan, no el funcionamiento futuro.

## Observación sobre tamaño

La revisión documental no aporta evidencia nueva para afirmar que el corte excederá el límite de ocho horas ni para recomendar una división. No afecta el veredicto.

## Siguiente paso

Detenerse tras esta auditoría. El usuario puede revisar y, si corresponde, aprobar visiblemente el plan; después, en una sesión nueva, elegir modelo y esfuerzo y solicitar `$microfase M06.3a`. G-CRYPTO permanece pendiente hasta la implementación y sus pruebas reales.
