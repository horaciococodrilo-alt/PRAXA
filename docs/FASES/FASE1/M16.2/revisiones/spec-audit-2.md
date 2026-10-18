# M16.2 — Auditoría de la spec, ronda 2

- **Fecha:** 2026-10-16
- **Commit base:** `65404aa` (`main`)
- **Spec auditada:** `docs/FASES/FASE1/M16.2/spec.md`, `BORRADOR`
- **Hash de contenido de la spec, sin la línea de estado:** `f29d2e3e0c263e87533b6837edc167a274cd2f1e`
- **Alcance de la auditoría:** lectura de la ruta, su spec general, estado, hallazgos, sesiones de dependencias, documentos transversales y código; `npm run verify` sobre el código de base. No se modificó la spec.

## Veredicto

**REQUIERE CAMBIOS.** La base pasa `npm run verify`, pero la spec todavía contradice CA-39, omite CA-38b y prevé archivos que la ruta vigente no autoriza. Hay además interfaces y pruebas que un implementador tendría que interpretar.

La ronda 1 dejó corregidos A-02 (T-36 y la segunda confirmación) y A-08 (D-M16.2-09 ya no figura). Siguen vigentes A-01, A-03 a A-07, A-09 y A-10. Esta ronda agrega A-11 y A-12. La referencia de la propia spec a la ronda 1 debe corregirse según el informe que está actualmente en disco.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | **FAIL** | La ficha exige CA-35 a CA-40 (`meta_first/plan.md:281`); «Heredados» de la spec (`:569-595`) salta CA-38b, que incluye la declaración de copias en UI y acta (`meta_first/spec.md:281-286`). A-04. |
| 2 | Alcance | **FAIL** | La spec difiere a M16c la prueba de revocación y desconexión durante sincronización (`:436`) que la spec de la ruta asigna al corte de ciclo de vida (`meta_first/spec.md:537`). La reasignación aún no figura en la ruta. A-09. |
| 3 | Coherencia con la spec general | **FAIL** | §2b y T-47 asignan respuesta ilegible a `unknown` y `[null]` a `temporary` (`:157`, `:698`); CA-39 asigna respuesta ilegible a transporte y temporal a códigos 1/2 (`meta_first/spec.md:296-299`). A-01. |
| 4 | Decisiones | PASS | D-M16.2-01 a -08 figuran como decisiones del usuario (`spec.md`, «Decisiones de la microfase»); D-M16.2-09 se retiró. Su incorporación a la ruta sigue pendiente, como indica la propia spec (`:704`, `:726`). |
| 5 | Trampas | PASS | La spec trata la revocación antes de purgar, clasifica por código de Graph y reserva la apertura del registro al alta del dueño (`:741-760`; `meta_first/plan.md:645-649`). |
| 6 | Intervenciones y acciones reservadas | PASS | La tabla `:722-737` reserva al usuario aprobación, preflight, merge/push/despliegue, P-04, registro y coordinación de VR-01, con comprobaciones. `db:push` y `db:push:test` no aplican porque no hay migración (`:717`, `:736`). |
| 7 | Verificación | PASS | `:702-720` exige `verify`, `test:policies`, `test:app`, alta y VR-01 según III.3 (`meta_first/plan.md:828`); CB-06 impide acreditar casos omitidos por falta de configuración (`:718`). |
| 8 | Dependencias | PASS | `PROJECT_STATE.md` registra M16.1/G-OAUTH cerrados y M16.2 habilitada. `G-ACTA-META` y P-04 se limitan a los pasos 10-12 (`spec.md:18`, `meta_first/plan.md:626`); M16.1 existe en `main@65404aa`. |
| 9 | Lo entregado de verdad | **FAIL** | §9.5 pide `ResolvedOAuthDeps` (`:383`), pero `meta/oauth.ts:95` solo define `Resolved` privado. El contrato de `completeReauth` no se puede implementar literalmente. A-05. |
| 10 | Pendientes y hallazgos | **FAIL** | La spec reasigna la persistencia de H-E1-22 a M16c (`:411`, `:559`, `:704`), pero la ficha vigente de M16c todavía no la incorpora (`meta_first/plan.md:287-302`). A-11. Los demás H-E1 asignados tienen tratamiento en `spec.md:806-818`. |
| 11 | Contexto real | **FAIL** | §20 dice que `getIntegraciones` «sigue envuelta en `cache`» (`:520`); hoy es `async function` sin `cache` (`src/modules/app-data/index.ts:86-89`). A-03. |
| 12 | Archivos previstos | **FAIL** | II.10 solo autoriza los archivos de `meta_first/plan.md:630-638`. Once archivos de la tabla de la spec (`:547-557`) dicen **REQUIERE CAMBIO EN LA RUTA**; la enmienda no existe. También faltan archivos existentes del módulo que la spec pretende modificar (`:534-538`, `:541-542`). A-10/A-11. |
| 13 | Diseño suficiente | **FAIL** | Faltan un tipo exportado para `completeReauth`, firma/retorno de `disconnect`, mapeo de errores de tenant en las acciones y resultado de `AccountListLimitError` durante reautorización (`:370-425`). A-05. |
| 14 | Verificable | **FAIL** | Los 43 criterios C-01 a C-43 tienen al menos un caso T-01 a T-49 con comando o recorrido manual, pero T-30 invoca `desconectarMeta` desde un `deps` de `test:app` (`:681`) aunque esa Server Action no recibe dependencias ni sesión sintética (`:417-425`). A-07. |
| 15 | Sin nada abierto | PASS | «Preguntas abiertas» dice «Ninguna» (`:802-804`). Las hipótesis de batch, revocación y navegador tienen momento, resultado y parada previstos (`:787-800`, `:490-516`). La aprobación de la enmienda figura como intervención, no como hipótesis implícita. |
| 16 | Ejecutable ahora | PASS | `npm run verify` terminó con exit 0: 23 archivos y 512 pruebas aprobados; lint, typegen, typecheck y build aprobaron. Los comandos están en `package.json:14-26` y los nombres requeridos en `.env.example:71,79,100,102`. La aprobación de la ruta tiene paso previo asignado (`spec.md:704`, `:726`); no habilita implementar antes de esa aprobación. |
| 17 | Consistencia interna | **FAIL** | C-28 dice que `META_APP_SECRET` sigue solo en `meta/api.ts` (`:629`), pero el preflight lo lee en `scripts/meta-preflight.mjs` (`:511`). «Auditorías» afirma que A-02 a A-05 de ronda 1 están corregidos (`:824`), mientras A-03, A-04 y A-05 del informe actual siguen presentes. A-06/A-12. |
| 18 | Reglas no negociables | PASS | Selección y tenant se resuelven en servidor (`:361-367`, `:422`); fixtures sintéticos (`:479`); no hay migración; `test:app` usa destino desechable (`:711-718`); credenciales por `worker_api` (§8) y errores/logs redactados (§§2b, 9.1). |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| §2b y T-47: `body` ilegible → `unknown`; `[null]` → `temporary` | CA-39 (`meta_first/spec.md:296-299`) y el cliente vigente (`meta/client.ts:61-78`) | La primera es una respuesta ilegible; la segunda carece de código Graph 1/2 | A-01: clasificar la respuesta ilegible como `transport`; para `[null]`, elegir una clase que no atribuya un código temporal inexistente y alinear diseño, C-40 y T-47. |
| §20: `getIntegraciones` «sigue envuelta en `cache`» | Código `src/modules/app-data/index.ts:86-89` | Hoy no está envuelta | A-03: describir el estado real y fijar si se añade `cache`. |
| C-28: `META_APP_SECRET` solo en `meta/api.ts` | §19 de la misma spec (`:511-515`) | El script nuevo lee la variable | A-06: acotar C-28 al runtime `src/` y documentar el uso operativo del secreto. |
| Aplazar a M16c la revocación durante sincronización | Spec de la ruta §14 (`meta_first/spec.md:537`) | II.11 todavía no nombra la revocación en ese caso | A-09: incluir la reasignación exacta en la enmienda de la ruta. |
| Archivos marcados «REQUIERE CAMBIO EN LA RUTA» como implementación prevista | Tabla vigente de II.10 (`meta_first/plan.md:628-638`) | La enmienda aún no aparece en el encabezado ni en II.10 | A-10/A-11: preparar y aprobar visiblemente la enmienda antes de implementar. |
| «A-02 a A-05 corregidos» en la fila de auditorías | `revisiones/spec-audit-1.md`, hallazgos A-03 a A-05; estado actual de la spec | A-03 a A-05 siguen sin resolver | A-12: actualizar la fila con el estado real de los IDs. |

## Hallazgos

| ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | alta | §2b; C-40; T-47 | Clasificación de batch incompatible con CA-39 | `spec.md:157,641,698`; `meta_first/spec.md:296-299` | Alinear las tres ubicaciones con CA-39. | No |
| A-11 | alta | Archivos previstos; Verificación | La ruta aún no autoriza once archivos indispensables ni la reasignación de H-E1-22; la spec sola no puede habilitar ese alcance | `spec.md:547-559,704,726`; `meta_first/plan.md:6,628-638,287-302` | Redactar en II.10 la enmienda completa, incluir la ficha de M16c y obtener aprobación visible del usuario antes de implementar. | **Sí: aprobación visible de la enmienda** |
| A-03 | media | §20 | Falsa descripción de `cache` en `getIntegraciones` | `spec.md:520`; `src/modules/app-data/index.ts:86-89` | Corregir al estado actual o especificar explícitamente la adición y su prueba. | No |
| A-04 | media | Heredados; UI de desconexión | CA-38b falta; su declaración de copias afecta la UI y el acta | `meta_first/plan.md:281`; `meta_first/spec.md:281-286`; `spec.md:569-595` | Trazar CA-38b y la declaración en la UI; verificar el acta de M03a antes de VR-01, o documentar una excepción aprobada. | Sí, solo si se pretende exceptuar el CA |
| A-05 | media | §§9.3-10 | `ResolvedOAuthDeps` no existe; falta la firma de `disconnect`, la propagación/mapeo de errores de tenant y la salida de `AccountListLimitError` en reauth; el cruce `oauth.ts`/`lifecycle.ts` no fija dueño de funciones compartidas | `spec.md:355,370-425`; `meta/oauth.ts:95`; `identity/session.ts:41-51`; `company/service.ts:21-24` | Fijar tipos exportados, firmas, resultados y dirección de dependencias; cubrir los resultados con casos. | No |
| A-06 | media | §17; §19; C-28 | La documentación prevista omite el nuevo uso local de `META_APP_SECRET`, el cambio de `debug_token` a lote y el script; C-28 es falso | `spec.md:481-486,509-515,629`; `SECURITY.md:165-197`; `ARCHITECTURE.md:59,217` | Añadir estos cambios concretos a §17 y corregir C-28. | No |
| A-12 | media | Auditorías | El estado de la ronda 1 dice resueltos A-03 a A-05 cuando persisten; dificulta saber qué queda por corregir | `spec.md:824`; `revisiones/spec-audit-1.md`, tabla de hallazgos | Actualizar el seguimiento con los IDs efectivamente resueltos y pendientes, sin reescribir el informe previo. | No |
| A-07 | baja | T-30 | El caso de concurrencia invoca una Server Action sin dependencias inyectables desde `test:app` | `spec.md:681,417-425` | Intercalar `disconnect` con K01 sintético y dependencias de prueba, o definir un mecanismo realizable. | No |
| A-09 | baja | §12; ruta §14 | Postergación de revocación durante sincronización sin reasignación documental completa | `spec.md:436`; `meta_first/spec.md:537`; `meta_first/plan.md`, II.11 paso 9 | Enmendar la verificación de M16c con la revocación y la desconexión durante sincronización. | **Sí: aprobación de la enmienda** |
| A-10 | baja | Archivos previstos | La excepción de «mismo módulo» se usa para modificar archivos existentes ausentes de II.10 | `spec.md:534-538,541-542`; preámbulo de Parte II y III.9 de `meta_first/plan.md` | Enumerarlos expresamente en la misma enmienda de II.10 de A-11. | **Sí: aprobación de la enmienda** |

## Observación de tamaño

No afecta el veredicto. El corte suma selección, probe, purga, reautorización, revocación, UI, preflight, documentación, 49 casos y VR-01 con el dueño; parece difícil de completar en ≤8 horas de implementación. Una división posible sería **M16.2a** para listado, confirmación, purga y desconexión, y **M16.2b** para reautorización, documentación y VR-01, con `G-VR01` solo al final. Requeriría actualizar la ruta antes de planificarla.

## Siguiente paso

Corregir en la spec A-01, A-03 a A-07 y A-12; preparar la enmienda de la ruta para A-09 a A-11 y obtener su aprobación visible. Resolver CA-38b conforme a la ficha, o pedir decisión explícita si se propone exceptuarlo. Luego repetir la auditoría. No pasar la spec a `APROBADA` todavía.
