# Auditoría de la spec de M25a — ronda 14

- **Fecha:** 2026-11-09 (America/Buenos_Aires).
- **Commit:** `3eaf561` (`docs/m25a-spec`); base `main@b0c854d`. Los cambios documentales y los informes anteriores sin seguimiento se preservaron. `git diff --quiet main -- src supabase tests scripts package.json package-lock.json vitest.config.mts` dio exit 0: el código ejecutado coincide con la base.
- **Hash de contenido de `spec.md` sin la línea `**Estado:**`:** `f99c64a50aae827062f399bee50cfa3ae9362d5f` (filtro de la línea de estado y `git hash-object --stdin`).
- **Precondición:** `spec.md:3` dice `BORRADOR`; el informe previo más alto era `spec-audit-13.md`.

## Veredicto

**APROBABLE: 18 PASS, 0 FAIL.** Los hallazgos A-88 a A-90 de la ronda 13 están resueltos en esta versión. La auditoría no cambia el estado de la spec ni inicia M25a.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | La ficha `meta_first/plan.md:342` exige CA-48 a CA-55, CA-61 a CA-66, CA-69 a CA-73 y VR-02. Están en «Heredados» (`spec.md:696-729`), junto con CA-38c, CA-44b, CA-67/68, DEC-23/24 y CB-01 a CB-06. |
| 2 | Alcance | PASS | Las tres etapas y exclusiones (`spec.md:28-65`) siguen la ficha y II.12/13/13b (`plan.md:333-356,710-770`). Los criterios operativos (`spec.md:734-818`) trazan a CA, DEC o trampas. |
| 3 | Coherencia con la spec general | PASS | El registro, la guarda, los límites y la presentación siguen `meta_first/spec.md` §§11-12 y CA-38c, CA-48 a CA-55 y CA-61 a CA-73. La cobertura por fila y su aviso (`spec.md:223-226,258-261,462`) satisfacen CA-51b (`meta_first/spec.md:469`). M28.3a consume respuestas, voto y registro (`plan.md:778-785`). |
| 4 | Decisiones | PASS | D-M25a-01 a -24 figuran con «Usuario» (`spec.md:978-1005`). D-M25a-24 está **retirada** y confirma el criterio de 18 PASS (`:1005`); no contradice ya la skill. Las precisiones de CA-62 y §11 constan en la spec de la ruta (`meta_first/spec.md:349,491`). |
| 5 | Trampas | PASS | La de II.12 y las cinco de II.13 (`plan.md:727,748-756`) están reflejadas en `spec.md:953-976`, incluidos cifras sin dígitos, fidelidad no garantizada y cambio de host. |
| 6 | Intervenciones y acciones reservadas | PASS | `spec.md:936-951`, ficha `plan.md:346` y III.2 `:852-853`: ambos `db:push`, push, despliegue y gate corresponden al usuario, con comprobación posterior; el asistente no los ejecuta. |
| 7 | Verificación | PASS | `spec.md:924-934` incluye controles de las tres etapas, suite adversaria, pgTAP, `test:app`, VR-02, evaluación ampliada y recorrido. Declara CB-06 de `meta_first/spec.md` §14. |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:25-29` registra `G-SYNC` aprobado y M25a habilitada. `main` contiene K01, `0016`, `0017` y M16c; evidencia en `meta_first/sesiones/M05.1.1.md`, `M06.1a-M06.2a.md`, `M06.3a.md`, `M16.1.md`, `M16.2.md` y `M16c.md`. |
| 9 | Lo entregado de verdad | PASS | `spec.md:66-114` refleja el tope real de 28 días de `0016:1843-1845`, atribución con `adset_ref` de `0016:1021-1043`, `NoCompanyError` de `company/service.ts:85-90`, máscara de `connection.ts:150` y `known=false` de `M16c.md:500`. |
| 10 | Pendientes y hallazgos | PASS | `spec.md:1011-1043` resuelve o difiere explícitamente `H-E1-185`, -187, -189, -190, -194 y -202. La primera sincronización con filas sigue siendo el punto de validación de campos (`HALLAZGOS.md:204-205`). |
| 11 | Contexto real | PASS | Se contrastaron las referencias de `spec.md:66-114` y las de diseño afectadas con el código de chat, tenant, conexiones, Insights, `0016`, `0017`, pgTAP `09/10/13/14`, `.env.example`, `package.json`, `M16c.md`, `SECURITY.md` y `ARCHITECTURE.md`. Existen y sostienen lo afirmado; el código coincide con `main`. |
| 12 | Archivos previstos | PASS | `spec.md:662-692` traza archivos a II.12/13/13b y D-M25a-01, -10, -14 y -16. Los documentos transversales están previstos porque cambian las propiedades indicadas en `spec.md:652-660`. |
| 13 | Diseño suficiente | PASS | Las funciones, firmas, errores y formas SQL figuran en `spec.md:125-291`; herramientas y DTO en `:292-529`. `barras_apiladas` fija métrica, nivel, período, tipo, fuente repetida y alineación por día (`:480`), cerrando A-90. |
| 14 | Verificable | PASS | Hay 84 criterios operativos y 95 casos; un cruce por ID no encontró criterios sin caso (`spec.md:734-922`). T-27, T-44 y T-87 cubren composición y resultado parciales; T-79 prueba compatibilidad y casos negativos de barras apiladas (`:852,869,904,912`). Los casos técnicos usan los scripts de `package.json`; `test:eval` está previsto para la etapa .2 y los gates documentales tienen comprobación manual explícita. |
| 15 | Sin nada abierto | PASS | «Preguntas abiertas» dice «Sin preguntas abiertas» (`spec.md:1026-1028`). H-01 a H-12 (`:1007-1022`) indican cómo y cuándo se comprueban; ninguna requiere inventar un paso antes de implementarla. |
| 16 | Ejecutable ahora | PASS | `npm run verify` terminó con **exit 0** en el código idéntico a `main`: lint, typegen, typecheck, 28 archivos y 765 pruebas, y build de 13 páginas. Se ejecutó con permisos suficientes tras el `EPERM` de la ronda 13. Scripts actuales en `package.json`; los nuevos `test:eval` y `DEEPINFRA_API_KEY` se crean en la etapa .2 (`spec.md:624,688-689`). La intervención previa a cada etapa está asignada (`:936-951`). No se leyó `.env.local`. |
| 17 | Consistencia interna | PASS | `answered_partial_coverage` usa la composición de cada valor mostrado (`spec.md:140,261,813`); el pie y aviso muestran las filas parciales (`:447,462`); T-44 y T-87 prueban el caso de días disjuntos. D-M25a-24 ya no intenta cambiar el veredicto. Alcance, exclusiones, diseño, criterios y casos coinciden. |
| 18 | Reglas no negociables | PASS | K01 se crea en servidor; `0018` es migración nueva; lecturas usan JWT y RLS, escrituras `worker_api`; fixtures y suites van al desechable; errores se redactan (`spec.md:125-180,327-358,553-615,628-639`). |

**Límite de 8 horas:** la ruta aprobó expresamente la excepción de M25a y la dividió en tres etapas (`meta_first/plan.md:337,348-354`). No corresponde proponer otro corte.

## Contradicciones

Ninguna.

## Hallazgos

Ninguno nuevo. Los anteriores quedaron cerrados así:

| ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-88 (cerrado) | Alta | Decisiones | D-M25a-24 pretendía cambiar la regla de la skill | `spec.md:1005`: retirada explícita; §4 de la skill sigue exigiendo 18 PASS | Ninguno | No |
| A-89 (cerrado) | Alta | Cobertura | Las filas parciales podían presentarse como completas | `spec.md:140,223-226,261,462,813,852,869,912`: composición por fila, aviso y casos de días disjuntos | Ninguno | No |
| A-90 (cerrado) | Media | Barras apiladas | Series incompatibles podían sumarse | `spec.md:480,807,904`: misma métrica, nivel, período y tipo; rechazo de duplicadas y casos negativos | Ninguno | No |

## Verificaciones y límites

- `git status --short --branch`, `git rev-parse --short HEAD`, `git diff --quiet main -- src supabase tests scripts package.json package-lock.json vitest.config.mts`: estado y equivalencia del código con la base verificados. Los cambios preexistentes quedaron intactos.
- Hash de la spec: lectura del archivo, exclusión de la línea de estado y `git hash-object --stdin`, resultado del encabezado.
- `npm run verify`: **exit 0**. Lint, typegen, typecheck, 28 archivos y 765 pruebas de Vitest, build de Next con 13 páginas. Se ejecutó fuera de la restricción que había causado `EPERM` en `.next` en la ronda 13; no se alteró código ni configuración.
- No se ejecutaron `db:push`, `db:push:test`, `test:policies`, `test:app` ni VR-02: la implementación de M25a aún no existe y esta auditoría no los exige.
- Solo se agregó este informe; `spec.md` sigue en `BORRADOR` y `G-CHAT` no cambia.

## Siguiente paso

El usuario puede aprobar esta versión de la spec y pasarla a `APROBADA`. Después se sigue con el plan de M25a; esta auditoría no inicia la microfase.
