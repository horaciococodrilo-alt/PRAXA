# Auditoría de la spec de M16f — ronda 4

- **Fecha:** 2026-11-15
- **Commit:** `9af2139` (rama `docs/cierre-m16e`). El árbol tiene cambios sin commit en `AGENTS.md`, `M16f/spec.md`, `meta_first/{plan,spec}.md` y `HALLAZGOS.md`, y `M16f/revisiones/` sin seguimiento.
- **Hash de contenido de la spec** (sin la línea `**Estado:**`): `31a9bfcb47466198402167d6c6f79cdab4c06cfc`
- **Estado de la spec al auditar:** `BORRADOR` (precondición cumplida)
- **Base:** `npm run verify` en un worktree temporal de `9af2139` (`npm ci`, PowerShell): exit 0, 60 archivos y 1417 pruebas, build correcto. El worktree se eliminó después.

## Veredicto

**REQUIERE CAMBIOS.**

La revisión integró bien A-01 y A-03 a A-11 de la ronda 3:

- el valor del enum va en una migración propia con `add value`, y se verifica con H-12;
- la tabla de errores tiene su `last_error_class`, y cada clase es válida para `needs_reauth` (`0012:314-316`, `:340-345`);
- `displayName` está en `ga4_sync_status`;
- T-04 ya no se contradice;
- el mapeo se recalcula en `ga4_finish_sync` y reescribe todas las filas;
- el `check` de versiones exige `ga4_connection_id` nulo en v1 y v2;
- las herramientas leen las funciones públicas de las otras fuentes;
- la salvedad de H-E1-241 está rotulada como CB-01 y alcanza a T-11;
- se agregaron los detalles de A-10 y la línea de cierre para M28.3a.

A-02 lo resolvió el usuario (H-E1-261), y el `AGENTS.md` del árbol ahora coincide con lo que dice la spec. Todas las referencias al código existen y dicen lo que la spec afirma. No hay hallazgos de severidad alta. Quedan dos huecos de severidad media que obligan al implementador a inventar:

- **Paso o sincronización.** La spec no separa un *paso* (240 s, 25 solicitudes) de una *sincronización*. De esa diferencia dependen cuatro cosas: cuándo corre el preflight y si consume las 25 solicitudes; qué es la «sincronización completa» que dispara el mapeo; qué cuenta como «última sincronización» para el diagnóstico; y si los pasos siguen solos, como Tiendanube desde `25ca650`.
- **Las unidades de Tiendanube por producto.** Para mostrarlas, la spec usa `get_tn_product_units`, pero esa función devuelve como máximo 50 filas, ordenadas por unidades y por variante. No puede dar las unidades de un producto que no esté en ese top.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | «Heredados» (spec:286-298) recoge el criterio de aceptación y la condición para avanzar de la ficha (`plan.md:444`, `:446`), CB-01 a CB-06, §17.1 a §17.8, §17.11, CA-37b, CA-37c, CA-38c, DEC-09, DEC-17, CA-70, §12 y §16, con resúmenes fieles |
| 2 | Alcance | PASS | El alcance (spec:27-33) cubre los puntos (1) a (7) de la ficha (`plan.md:441`), incluidos el preflight de UTMs y el mapeo de ítem y campaña sin pedido (D-M16f-09). La evidencia de cierre (`:443`) está en «Verificación» (spec:343). La partición `.3a` y `.3b` no cambia las cuatro etapas. Las pruebas de §5 de la propuesta (`propuesta-conectores…:63`) están en T-01 a T-10; las de pedido quedan fuera por D-M16f-09 |
| 3 | Coherencia con la spec general | PASS (observación) | §17.11 (`meta_first/spec.md:713-719`) cubre CA-05, CA-11c, CA-38, CA-62, CA-70 y §16 tal como los usa la spec. CA-18 y CA-28 ya son genéricos por proveedor (§17.10). CA-08 (metadatos obligatorios en `active`) se cumple con los datos de `properties/{id}` y `integration_connections_metadata_required` (`0012:323-325`). Se respetan §17.4 (regla de cinco), §17.5 («asociación débil, sin causalidad», spec:208) y CA-40 (propiedad sin número). Observación: la fila `403` de la tabla de errores choca con CA-07 cuando la conexión está pendiente (A-03) |
| 4 | Decisiones | PASS | D-M16f-02, -03 y -05 a -13 son decisiones del usuario del 2026-11-15; D-M16f-01 y -04 son pedidos. Ninguna contradice un DEC ni un CA: las que cambian la ruta (-06, -09, -10, -12) están aplicadas en `plan.md:936-937`, `spec.md:695`, `:697` y `:713-719` |
| 5 | Trampas | PASS | La regla de II.14c sobre `default 'meta'` (`plan.md:939`) está en spec:362. Las de §6 de la propuesta (PII, consentimiento, `node_modules/next/dist/docs/`) están en spec:116 y :373 |
| 6 | Intervenciones y acciones reservadas | PASS (observación) | Coinciden con la ficha (`plan.md:448`) y con III.2 (`:1029`, `:1031`): proyecto, consentimiento, APIs, URI, dominio, testers, credenciales, acceso, medición y aprobación (spec:110-116, :345-356). `db:push:test`, `db:push` a `app`, despliegue, commit, push y gate quedan asignados al usuario, cada uno con su verificación. Observación: ver A-06 |
| 7 | Verificación | PASS | `db:check:test`, `test:policies` y `test:app` en cada etapa; `checkCompatibility`, preflight, lectura y comparación reales (III.3, `plan.md:1059`; spec:336-343, T-10). CB-06 en spec:342 |
| 8 | Dependencias | PASS | `PROJECT_STATE.md` registra `G-TIENDA` aprobado el 2026-11-15 y habilita M16f. HEAD contiene los PR #41 a #46 |
| 9 | Lo entregado de verdad | FAIL | `public.get_tn_product_units(p_connection_id, p_from, p_to, p_limit)` exige `p_limit between 1 and 50`, ordena por unidades y agrupa por `(product_key, variant_key)` (`0023:2547-2600`). La spec la usa para poner «unidades de Tiendanube» al lado de un ranking por **vistas** de GA4 (spec:218, :224, §4.2, spec:209). Un producto con muchas vistas que no esté entre los 50 más vendidos queda sin dato, y la spec no dice cómo agrupar las variantes en el producto de `ga4_item_daily`. Ver A-01. Lo demás coincide con lo entregado: firmas de `0023`, `mark_needs_reauth` genérico (`0012:1119-1179`), `publish_diagnostic` de siete argumentos (`0024:146-148`) y sus únicos llamadores, `chat_total` por `entity_ref` para el gasto de Meta (`0018:533`) |
| 10 | Pendientes y hallazgos | PASS | H-E1-236, -237, -238, -234, -228 y -241 tienen fila (spec:418-423), coherente con `HALLAZGOS.md:18`, `:21-23`. H-E1-261 está registrado y reflejado (spec:5, :264). `PROJECT_STATE.md` no tiene pendientes que toquen M16f |
| 11 | Contexto real | PASS | Se verificaron todas las filas: `0023:48-70, 73-76, 80, 85-93, 96, 105-122, 127, 144, 147-152, 411, 923-933, 1041, 1095, 1132-1140, 1353-1390, 1494-1544, 2026`; `0012:314-316, 438-439, 1401-1410`; `0024:29-42, 146-148`; `credential.ts:42-45, 47, 60-71, 87`; `primitives.ts:43`; `connection.ts:51`; `connections.ts:34-52`; `lifecycle.ts:88, 158`; `actions.ts:7-16`; `page.tsx:22-30`; `app-data/index.ts:97`; `worker-api.ts:101`; `repository.ts:215`; `schema.ts:7-14`; `orchestrator.ts:339`; `context.ts:37-46`. Lo nuevo (migraciones 0, 1 y 2, `ga4/`, rutas, preflight) está declarado como previsto |
| 12 | Archivos previstos | PASS | Cada grupo traza a II.14c (`plan.md:930-937`) o a sus enmiendas D-M16f-06 y -10. `SECURITY.md` y `ARCHITECTURE.md` figuran con motivo: frontera OAuth con Google, riesgos aceptados de D-M16f-05 y -07, componentes nuevos. El diff de `AGENTS.md` (línea de GA4 y retiro de la regla de 8 horas) coincide con spec:264 y H-E1-261. El pgTAP `09` que fija las etiquetas del enum (`09:181`) está en la lista; el `18` solo comprueba el nombre del tipo en las firmas (`18:251-260`), que no cambia con `add value`. Todos los llamadores de `publish_diagnostic` están dentro de la lista. `src/components/chat/` no tiene nada específico de una fuente |
| 13 | Diseño suficiente | FAIL | Falta la frontera entre paso y sincronización (A-02) y la lectura de las unidades por producto (A-01). Menores: la fila `403` en estado pendiente y qué función escribe `needs_reauth` fuera de una sincronización (A-03); cómo se rotula «menos de 5» si esas celdas «no se escriben» (A-04) |
| 14 | Verificable | PASS | Los comandos existen en `package.json`: `verify`, `db:check:test`, `db:push:test`, `test:policies`, `test:app` y `test:eval`. Cada criterio C-01 a C-14 tiene casos, con negativos y bordes: replay, scope extra, `deleteTime`, 25.000 filas, 70 % y 85 %, 94 días, 13 cohortes, v1 y v2 con `ga4_connection_id` y firma vieja |
| 15 | Sin nada abierto | PASS | «Preguntas abiertas» está vacía. H-01 a H-12 dicen cómo y cuándo se verifican: H-07 antes de la etapa 1, H-09 antes del código y en T-10, H-12 con `db:push:test` en la etapa 1 y su plan de contingencia. Las APIs de Google tienen documentación oficial enlazada (2026-11-12), y los changelogs se reverifican antes del código (spec:93) |
| 16 | Ejecutable ahora | PASS | Lo que entregó M16e existe en HEAD. Los scripts que usa la spec existen. Las variables `GOOGLE_OAUTH_*`, `scripts/ga4-preflight.mjs` y los cambios de `entorno.md` los crea la microfase, y están declarados. La intervención previa a la etapa 1 tiene su paso. `verify` en la base: exit 0 |
| 17 | Consistencia interna | PASS (observación) | Alcance, diseño, criterios, casos y archivos coinciden. La única tensión es la del ítem 13: «preflight antes de cada sincronización» (spec:167), «Paso. Lo inicia el dueño» (spec:174) y «sincronización completa» (spec:200) usan términos sin definir |
| 18 | Reglas no negociables | PASS | K01 por `requireTenantContext()`, sin propiedad, empresa ni conexión del navegador (spec:71, :140, :145). Sin secretos en el chat (spec:115, :358). Migraciones nuevas (spec:132). Suites solo en el desechable (spec:341, D-M16f-11). Escrituras por `worker_api` con lease y generación (spec:198). Errores clasificados, sin `code` ni tokens (spec:95-108, :142). Excepciones de reversibilidad expresas (spec:244-253) |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| Tabla de errores: «`403` en Admin o Data API → `sin_acceso_propiedad` → `needs_reauth`» (spec:102) | CA-07 (`meta_first/spec.md:241-246`): desde `pending_selection` solo se pasa a `active` o a `disconnected`. `mark_needs_reauth` exige `active` (`0012:1173-1175`) | La Admin API se llama sobre todo durante la selección, con la conexión pendiente | Ver A-03: con la conexión pendiente, no se activa y se muestra el error, como ya dice la fila `propiedad_no_disponible` |

## Hallazgos

| ID | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | media | §4.2; §6, `ga4_productos`; §5 | Las unidades de Tiendanube se leen con `get_tn_product_units`, que devuelve como máximo las 50 filas más vendidas por `(product_key, variant_key)`. El ranking de GA4 es por vistas, y `ga4_item_daily` guarda un producto, no una variante. No está definido qué pasa con un producto visto que no está en ese top, ni cómo se suman sus variantes | `0023:2547-2600` (`p_limit not between 1 and 50`, orden por `units`, `group by product_key, variant_key`); spec:194, :209, :218, :224 | Fijar una de dos opciones. (a) `get_ga4_items` devuelve, bajo RLS, las unidades del producto mapeado: suma `tn_product_units_daily` por `product_key` en el período, que es pública con `SELECT` por RLS. (b) La herramienta y la pantalla agrupan por producto el resultado de `get_tn_product_units(…, 50)` y rotulan «sin dato de ventas en el top 50» a lo que no aparezca. Agregar el caso a T-08 o T-09 | No |
| A-02 | media | §2 (preflight); §3 (paso, mapeo); §6 (diagnóstico) | La spec no define qué es una sincronización frente a un paso. Eso deja sin respuesta cuatro preguntas. (1) El preflight corre «antes de cada sincronización»: ¿también en cada paso, y descuenta sus solicitudes (unas 10) de las 25? (2) `ga4_finish_sync` recalcula el mapeo «al cerrar una sincronización completa»: ¿al final de cada paso sin error o solo cuando la cobertura pedida está completa? (3) ¿Qué es la «última sincronización» de las 24 horas del diagnóstico? (4) ¿Los pasos siguen solos? Tiendanube sí, desde `25ca650` | spec:167, :174-175, :200, :234; el backfill de 365 días son unas 60 solicitudes `runReport`, más cohortes y preflight, frente a 25 por paso; commit `25ca650` («sincronización que sigue sola hasta terminar») | Definir en §3 que una sincronización es la sucesión de pasos desde `ga4_start_sync` hasta cubrir el backfill o el incremental pedido. Fijar: el preflight corre en el primer paso y cuenta dentro de sus 25 solicitudes; `ga4_finish_sync` cierra con mapeo solo el paso que completa la cobertura; las 24 horas cuentan desde ese cierre; la pantalla encadena pasos como Tiendanube, o el dueño los inicia uno por uno. Agregar el caso a T-06 | No |
| A-03 | baja | Clasificación de errores | La fila `403` lleva a `needs_reauth` sin distinguir el estado. Con la conexión pendiente, esa transición no existe (CA-07). Tampoco se dice qué función escribe `needs_reauth` fuera de una sincronización. Puede ser, por ejemplo, un `invalid_grant` en el preflight de activación o en una lectura de la pantalla | spec:101-102, :107; `0012:1119-1179`; CA-07 | En `pending_selection`: no se activa y se muestra el error. En `active`: `mark_needs_reauth` fuera de una sincronización, y `ga4_fail_sync` dentro | No |
| A-04 | baja | §3, `ga4_visitor_cohorts`; T-07 | «Conteos menores que cinco no se escriben», pero T-07 exige mostrar «menos de 5». Sin una marca, una celda oculta no se distingue de una sin dato | spec:196, :329; `tn_cohort_cells` usa `size_hidden` y `active_hidden` (`0023:490-504`) | Guardar la celda con el valor nulo y una marca de oculta, como `tn_cohort_cells` | No |
| A-05 | baja | Supuestos e hipótesis | H-12 figura antes de H-11 | spec:407-408 | Reordenar | No |
| A-06 | baja (observación) | Intervenciones, publicación | `db:push` aplica todas las migraciones pendientes. `HALLAZGOS.md` registra todavía como pendiente el `db:push` de `0025` (H-E1-259). Si sigue pendiente en `app` o en el desechable, entra junto con las de M16f | `HALLAZGOS.md:837`; spec:134, :351-352 | En la verificación posterior, confirmar en el historial qué migraciones se aplicaron, incluida `0025` si estaba pendiente | No |

## Observación de tamaño (no afecta el veredicto)

El usuario exceptuó M16f del límite y además retiró la regla general (H-E1-261). La partición en `.1`, `.2`, `.3a`, `.3b` y `.4`, con la migración 2 en `.3b`, deja controles revisables. No hace falta otro corte.
