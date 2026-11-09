# Auditoría de la spec de M25a — ronda 8

- **Fecha:** 2026-11-09 (America/Buenos_Aires).
- **Commit:** `3eaf561` (`docs/m25a-spec`); árbol limpio al comenzar.
- **Hash de contenido de `M25a/spec.md` sin la línea `**Estado:**`:** `e7006664aca7c33fd3f0f126484371f6db6a692d` (bytes UTF-8 y saltos originales pasados a `git hash-object --stdin`).
- **Precondición:** `spec.md:3` está en `BORRADOR`; la auditoría anterior más alta es `spec-audit-7.md`.

## Veredicto

**APROBABLE: 18 PASS y 0 FAIL.** No quedan contradicciones ni hallazgos de esta auditoría. El texto de la spec coincide con el auditado en la ronda 7; esta revisión corrige la lectura de A-53, que fue un falso positivo. La ronda 7 interpretó «contiene `period`» como «exige un período no nulo en todos los tipos de claim». CA-50 solo exige igualdad de período con el resultado para `observed_value` (`meta_first/spec.md:434`); `user_provided` tiene su propia regla, que exige la cifra en la pregunta (`:442`). La forma plana de M25a **contiene** el campo `period` y `projectOutput` exige que sea nulo para esa variante (`M25a/spec.md:377-395`, T-41 en `:798`). No hace falta enmendar la ruta por ese motivo. A-51 y A-52 de la ronda 6 quedaron resueltos por los cambios del commit actual.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | La ficha (`meta_first/plan.md:342`) exige CA-48 a CA-55, CA-61 a CA-66, CA-69 a CA-73 y VR-02; figuran en «Heredados» (`M25a/spec.md:631-665`), junto a CA-38c, CA-44/44b, CA-67/68, DEC-23/24 y CB-01 a CB-06. |
| 2 | Alcance | PASS | Objetivo, tres etapas y exclusiones (`M25a/spec.md:25-65`) siguen la ficha (`meta_first/plan.md:333-356`) y II.12/13/13b. Los criterios operativos (`M25a/spec.md:666-750`) trazan a CA, DEC, trampa o decisión aprobada de la ruta. |
| 3 | Coherencia con la spec general | PASS | CA-50 de `meta_first/spec.md:415-443` admite `user_provided` con validación distinta a `observed_value`; el esquema plano incluye `period` y la variante lo proyecta como nulo (`M25a/spec.md:377-395`). CA-43, CA-51/52 y CA-72/73 se reflejan en cobertura, pie y casos dudosos (`:250-261`, `:421-429`, `:479-540`). Lo que consume M28.3a conserva `G-CHAT`, VR-02 y el recorrido real. |
| 4 | Decisiones | PASS | D-M25a-01 a -17 figuran como decisiones del usuario (`M25a/spec.md:902-922`) y las que ajustan la ruta están coordinadas por las enmiendas de `meta_first/plan.md:18-20`. Ninguna altera un CA o DEC vigente sin esa autorización. |
| 5 | Trampas | PASS | `M25a/spec.md:881-900` refleja las trampas de II.12/13: pregunta fuera de logs, cifras vinculadas, cantidades en palabras, tope anterior de 28 días, nombres inyectados, cuenta vacía y timeout. |
| 6 | Intervenciones y acciones reservadas | PASS | `M25a/spec.md:864-879` reserva al usuario `db:push:test`, `db:push` en `app`, commits, push, despliegue, cuenta/clave de DeepInfra, acta, recorrido y gate, con comprobación posterior; coincide con ficha e III.2. |
| 7 | Verificación | PASS | `M25a/spec.md:852-862` incluye `verify`, `db:check:test`, `test:policies`, `test:app`, adversarias, VR-02 y evaluación ampliada, de acuerdo con `meta_first/plan.md:350-354`, III.3 y CB-06. |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:25`, `:29` registra `G-SYNC` aprobado y M25a habilitada. La rama contiene K01, migraciones `0016` y `0017`, y el código y evidencia de M16c. |
| 9 | Lo entregado de verdad | PASS | `M25a/spec.md:67-112` contrasta `worker-api.ts`, `connections.ts`, `insights.ts`, `0016` y `0017`. Evita el límite de 28 días de `get_meta_daily_coverage` y reconoce que la cobertura de desglose es por nivel, dimensión y día (`0017_meta_breakdowns.sql:165-177`; `M25a/spec.md:250`, `:538`). |
| 10 | Pendientes y hallazgos | PASS | `M25a/spec.md:924-958` y `HALLAZGOS.md` sitúan H-E1-187, -189, -190, -194, -202 y -185. La validación de campos con filas reales sigue diferida por la cuenta sin actividad, con paso y motivo. `PROJECT_STATE.md` conserva ese riesgo temporal. |
| 11 | Contexto real | PASS | Las referencias de código de `M25a/spec.md:67-112` existen y sustentan las afirmaciones: K01, funciones de `worker_api`, RLS, `0016`, `0017`, pantalla y contratos de Next consultados localmente. La referencia nueva a `0017:165-177` es exacta. |
| 12 | Archivos previstos | PASS | `M25a/spec.md:597-627` coincide con II.12/13/13b y la enmienda de `meta_first/plan.md:20`; los demás son seguimiento o pipeline. |
| 13 | Diseño suficiente | PASS | `M25a/spec.md:124-317` fija tablas, firmas SQL, resultados y herramientas; `:319-417` fija redacción, esquema plano, proyección, errores y guarda; `:419-542` fija DTO, bloques y casos dudosos. La excepción de `user_provided` tiene forma y prueba concretas. |
| 14 | Verificable | PASS | C-01 a C-81 tienen casos T-01 a T-91 con comando y resultado (`M25a/spec.md:666-850`); comprobación de IDs: ninguno sin caso. T-41 prueba `user_provided` con referencias y período nulos; T-91 cubre la falsa declaración de `no_coverage`. Hay negativos y bordes de SQL, guardas y UI. |
| 15 | Sin nada abierto | PASS | `M25a/spec.md:942-944` declara cero preguntas abiertas. H-01 a H-11 (`:924-938`) tienen cómo y cuándo comprobarse; H-07 se mide antes del push en ensayo con rollback. |
| 16 | Ejecutable ahora | PASS | `npm run verify` en `3eaf561`: exit 0. Pasaron lint, typegen, typecheck, 28 archivos/765 pruebas y build de Next con 13 páginas. `package.json` tiene los scripts vigentes; `test:eval` y `DEEPINFRA_API_KEY` están previstos en los archivos autorizados de M25a. No se leyó `.env.local`. |
| 17 | Consistencia interna | PASS | `M25a/spec.md:377-398`, C-37 (`:706`) y T-41 (`:798`) coinciden para `user_provided`; `no_coverage` lo declara el servidor con composición comprobada (`:363`, `:371`, C-81/T-91). Las fechas distinguen nivel o dimensión de entidad (`:250`, `:492`, `:538-540`). |
| 18 | Reglas no negociables | PASS | `M25a/spec.md:126-172`, `:311-340`, `:361-371`, `:506-544`, `:852-879` conserva K01 interno, migración nueva, fixtures en desechable, escrituras con `worker_api`, sin secretos en árbol/logs y errores redactados. El modelo no puede declarar `no_coverage`. |

## Contradicciones

Ninguna.

## Hallazgos

| ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| — | — | — | Ninguno. A-53 de la ronda 7 se retira por lectura incorrecta del contrato de CA-50; la spec y T-41 ya fijan su comportamiento. | `meta_first/spec.md:417`, `:434`, `:442`; `M25a/spec.md:377-395`, `:798` | — | No |

## Verificaciones y límites

- `git status --short --branch` estaba limpio al empezar; solo se añadió este informe. La spec auditada sigue en `BORRADOR`; no se cambió ni se aprobó.
- `npm run verify`: **exit 0**. Lint, typegen, typecheck, 28 archivos/765 pruebas y build de 13 páginas pasaron. No se ejecutaron `test:policies`, `test:app`, VR-02 ni consultas a `app`; M25a aún no está implementada.
- Se contrastaron `AGENTS.md`, la spec de M25a, la ficha y etapas de la ruta, su spec general completa, `PROJECT_STATE.md`, `HALLAZGOS.md`, la evidencia de M16c, `SECURITY.md`, el código citado y lo que consumirá M28.3a. Los documentos y el código ajenos a M25a no cambiaron desde la ronda 7 (`git diff --name-only e51f140 HEAD`); se reevaluó A-53 desde las fuentes, sin heredar el veredicto anterior.
- DEC-24 y la ficha exceptúan M25a del límite de 8 horas; no corresponde sugerir otro corte sin reabrir esa decisión.

## Siguiente paso

El usuario puede aprobar esta spec; solo después pasa a `APROBADA` y se prepara el plan de M25a. Esta auditoría no la aprueba por sí misma, no inicia M25a ni cambia `G-CHAT`.
