# M16e — Conector Tiendanube y cohortes de compradores

**Estado:** BORRADOR

**Entrada:** la ruta incluye `M16e` desde la [enmienda de conectores](../meta_first/sesiones/enmienda-conectores-2026-11-14.md), aprobada por el usuario el 2026-11-14 (ficha en Parte I y II.14b de `meta_first/plan.md`; §17 de `meta_first/spec.md`). `G-DIAG` está aprobado (2026-11-14). Como exige la ficha, **spec, plan y acta M03a ampliada se aprueban antes de la primera línea de código**, y el acta se comunica al dueño antes del primer dato real. El usuario exceptuó esta microfase del límite de ocho horas; el resto del contrato de `AGENTS.md` sigue vigente. **Salida:** un único `G-TIENDA`, que habilita M16f.

**Revisión del 2026-11-14:** se integraron la enmienda de ruta, las decisiones D-M16e-04 a D-M16e-20 del usuario y las correcciones de [spec-audit-1](revisiones/spec-audit-1.md) (A-01 a A-23). Después se integraron las correcciones de [spec-audit-2](revisiones/spec-audit-2.md) (A-01 a A-10) y de [spec-audit-3](revisiones/spec-audit-3.md) (A-01 a A-06), con las decisiones D-M16e-21 a D-M16e-28 y sus enmiendas de ruta. La spec sigue en borrador hasta una nueva auditoría y su aprobación.

**Hash de contenido:** al solicitar auditoría, excluir solamente la línea `**Estado:**` y pasar los bytes restantes a `git hash-object --stdin`, como indica `docs/_templates/mf-spec.md`.

## Fuentes

- `AGENTS.md`; plantilla `docs/_templates/mf-spec.md`. Primera redacción sobre HEAD `0e871be`; revisiones del 2026-11-14 sobre `mf/M16e@929deba`.
- Ruta vigente: `docs/FASES/FASE1/meta_first/plan.md` I.1–I.4 (ficha `M16e`), I.5, II.4, II.10–II.11, II.14b, III.2–III.3 y III.9; `meta_first/spec.md` §§1–2, 7–12, 14, 16 y 17 (incluida §17.10, CA y CB enmendados por esta microfase).
- `docs/PROJECT_STATE.md`: `G-CHAT` y `G-DIAG` cerrados; `M16e` es la siguiente habilitada. `docs/HALLAZGOS.md`: H-E1-236 (esquema de un proveedor), H-E1-237 (acta insuficiente), H-E1-228 (texto libre del chat sin verificar) y H-E1-234 (resuelto en la ruta por D-M16e-21).
- `docs/SECURITY.md` §§1–9 y 12; `docs/ARCHITECTURE.md` §§«Módulos y responsabilidades», «Base de datos», «Los dos caminos de una operación», «Concurrencia» y «Ausencia de workers»; `docs/FASES/FASE1/M03a/acta-meta.md`.
- Evidencia previa: `meta_first/sesiones/M06.1a-M06.2a.md` (rol, RLS y cierre), `M06.3a.md` (cifrado), `M16.2.md` (OAuth/ciclo de vida), `M16c.md` (sync), `M25a.md` (chat) y `M26a.md` (diagnóstico). Sus gates no prueban Tiendanube.
- Código contrastado: `supabase/migrations/0012_integrations.sql`, `0016_meta_insights.sql`, `0018_chat_queries.sql`, `0022_meta_diagnostics.sql`; `src/modules/integrations/{contract,crypto,db,repository,meta}/`, `lifecycle.ts`, `actions.ts`; `src/modules/chat/`; `src/modules/diagnostics/`; `src/modules/tenant/context.ts`; `src/app/(app)/app/integraciones/page.tsx`; `src/app/api/integraciones/meta/`; `src/components/app/{diagnostico,chat}.tsx`; `src/app/(app)/app/{page,layout}.tsx` y `chat/page.tsx`; `src/modules/app-data/index.ts`; `tests/{unit,app,component,eval}/`, `supabase/tests/08_integration_isolation.test.sql`, `09_integration_privileges.test.sql`, `09b_integration_lifecycle.test.sql`, `10_demo_closure.test.sql`, `15_chat_queries.test.sql` y `17_meta_diagnostics.test.sql`; `package.json`, `.env.example` y `vitest.config.mts`.
- Documentación oficial consultada el 2026-11-12: [autenticación y scopes](https://tiendanube.dev/docs-api/authentication), [Admin API y límites](https://tiendanube.dev/docs-api/getting-started), [pedido](https://tiendanube.dev/es-AR/api/resources/2025-03/order), [cliente](https://tiendanube.dev/es-AR/api/resources/2025-03/customer), [producto](https://tiendanube.dev/es-AR/api/resources/2025-03/product), [webhooks y privacidad](https://tiendanube.dev/es-AR/api/resources/2025-03/webhook), [homologación](https://tiendanube.dev/apps/publish/homologation/overview).
- Segunda lectura oficial del 2026-11-12: [versionado](https://tiendanube.dev/api/versioning), [changelog 2025-03](https://tiendanube.dev/api/resources/2025-03/CHANGELOG), [Store](https://tiendanube.dev/es-AR/api/resources/2025-03/store), [FAQ](https://tiendanube.dev/api/faq). Las páginas de variante de producto y de Transaction no cargaron (404): lo que dependa de ellas queda como hipótesis.

## Objetivo

Permitir que el dueño autorice **una tienda Tiendanube por empresa** y que PRAXA lea pedidos, líneas, identificadores mínimos de clientes y catálogo, con sincronización reanudable y borrado verificable. A partir de pedidos efectivamente pagados, mostrar cohortes de compradores y productos vendidos con definiciones, cobertura y procedencia explícitas. El chat y el diagnóstico también consumen esos agregados, nunca datos de compradores individuales (D-M16e-10).

## Alcance

1. Generalizar los contratos y la persistencia de integraciones para que Meta y Tiendanube coexistan sin alterar los datos de Meta; una conexión viva **por empresa y proveedor**. Toda migración es nueva. Se enmiendan CA-05, CA-11c, CA-18 y CA-28 de la ruta (§17.10).
2. Instalar y reautorizar la app mediante OAuth de código, confirmar tienda y scopes, guardar la credencial cifrada, gestionar desconexión y purga.
3. Leer `Store`, `Order` (con `customer.id` como único dato del cliente) y `Product`/variantes con la Admin API `2025-03` y los scopes `read_orders`, `read_customers` y `read_products`. No persistir respuestas crudas ni PII de contacto.
4. Backfill de todo el histórico de pedidos y productos, incremental por `updated_at` con solapamiento, checkpoint durable, paginación y presupuestos; conciliar pagos, cancelaciones, cambios de líneas, reembolsos y borrado de catálogo. Solo se guarda el estado vigente de cada pedido (D-M16e-16).
5. Atender los tres webhooks de privacidad con firma verificada. `app/store_redact` y `customer/redact` borran (D-M16e-04, D-M16e-14); `customers/data_request` solo se acusa con `2xx` (D-M16e-07).
6. Pantalla de Tiendanube: estado de conexión y sincronización, cobertura, cohortes de compradores y productos vendidos por unidades. Toda cifra se calcula en SQL o en el servidor y lleva su definición.
7. Herramientas cerradas de Tiendanube en el chat y sección de ventas de la tienda en el diagnóstico (D-M16e-10). Al modelo solo llegan agregados.
8. Pruebas sintéticas de aislamiento, permisos, precisión, ciclo de vida y privacidad; pruebas manuales acotadas con la tienda de demostración en `app` (D-M16e-12); recorrido real redactado con la tienda del dueño **solo después** del acta.

## Fuera de alcance

Escritura de pedidos, productos, clientes, inventario, precios, scripts o webhooks operativos en Tiendanube; checkout, carrito abandonado, pagos, envíos y ERP; worker, cron, colas o sincronización programada; más de una tienda por empresa; distribución pública y homologación; atribuir ventas a Meta; cohortes de sesiones GA4; unión individual entre compradores y visitas; enviar al modelo datos de compradores individuales (IDs, pedidos sueltos o celdas de cohorte de menos de cinco clientes); exportar datos ante `customers/data_request` (D-M16e-07); ranking por importe (D-M16e-19); frecuencia de compra y valor por cliente; historial de versiones de pedidos (D-M16e-16); restablecer la verificación de cifras del texto libre del chat (D-M16e-13). La app sí recibe webhooks de privacidad obligatorios: son solicitudes entrantes, no escritura de negocio en Tiendanube.

## Contexto verificado en el código

| Qué | Dónde (archivo:línea) | Implicación |
|---|---|---|
| `integration_provider` solo contiene `meta` | `supabase/migrations/0012_integrations.sql:213` | Migración nueva agrega `tiendanube`; no editar `0012` |
| Índice único de conexión viva usa solo `company_id` | `0012_integrations.sql:349` | Reemplazar por índice por `(company_id, provider)` y probar coexistencia (CA-18 enmendado) |
| Conexión e intentos tienen `default 'meta'`; K03 exige moneda/zona para activas | `0012_integrations.sql:277-349`, `:359-402`; `contract/connection.ts:64-97` | Generalizar sin que un flujo nuevo se guarde como Meta; moneda y zona salen de `GET /store` |
| `valid_granted_scopes` exige `ads_read` | `0012_integrations.sql:250-264` | Función nueva por proveedor: Meta exige `ads_read`; Tiendanube, exactamente los tres `read_*` |
| `token_type` solo admite `system_user` | `0012_integrations.sql:436-437` | Agregar `store_app_token` solo para `tiendanube` (CA-11c enmendado) |
| `last_error_class` tiene clases de Meta; `needs_reauth` exige `authentication`, `user_action`, `permission` o `asset_access` | `0012_integrations.sql:314-317`, `:337-342` | Se reutilizan las clases existentes; ver tabla de clasificación de errores |
| `create_oauth_attempt` no recibe proveedor | `0012_integrations.sql:490-499`; lo llama `meta/oauth.ts:222` | Firma nueva con proveedor; el OAuth de Meta pasa `meta` explícito |
| Proveedor Zod y tipo de token cerrados para Meta | `contract/primitives.ts:40`; `contract/credential.ts:28-60` | K02–K04 discriminan por proveedor, preservando el contrato de Meta |
| `readLiveConnection` usa `.maybeSingle()` sin filtro de proveedor; `readConnectionRecord` filtra Meta | `repository/connections.ts:31-62`, `:67-83` | Con dos conexiones vivas la primera falla: recibe proveedor obligatorio |
| `runLazyPurge` revoca en Meta toda credencial pendiente de purga, sin mirar proveedor | `lifecycle.ts:76-116` | Debe distinguir proveedor: un token de Tiendanube nunca llega a Meta (A-13) |
| `worker_api` tiene lista cerrada de funciones, casts y errores | `db/worker-api.ts:9-16`, `:70-98`, `:146-167` | Nuevas RPC requieren entradas tipadas, grants exactos y error redactado |
| Códigos de error SQL `PX001`–`PX011` en uso | `0012_integrations.sql:80-91` y migraciones posteriores | Los nuevos empiezan en `PX012` |
| K01 deriva actor y empresa en servidor | `tenant/context.ts:37-43` | No aceptar `company_id` ni tienda desde el navegador |
| `purge_connection` se reemplazó al agregar chat; borra los registros del chat de la conexión y al final la fila de la conexión | `0018_chat_queries.sql:196-230` | La migración nueva conserva firma y semántica y borra los hijos de Tiendanube. Como se borra la fila, una FK con cascada a la conexión alcanza al informe del diagnóstico |
| Lecturas de Meta por funciones `public` `SECURITY INVOKER` bajo RLS | `0016_meta_insights.sql:1784`, `:1929`, `:1982` | Los agregados de Tiendanube siguen el mismo patrón (A-06) |
| `chat_valid_tool_names` fija la lista cerrada de herramientas; `record_query` admite `not_answered/connection_not_active` sobre una conexión `active` | `0018_chat_queries.sql:5`, `:111-147` | La segunda migración amplía la lista; el registro de una abstención por fuente no conectada no cambia de firma |
| El orquestador corta con `connection_not_active` si Meta no está `active`; `abstain_reason` solo admite `out_of_scope` | `src/modules/chat/orchestrator.ts:298-301`; `src/modules/chat/output-schema.ts:31`, `:52` | Mecanismo por fuente de §6 (A-07) |
| La página del chat solo habilita el chat con Meta `active` y lista solo Meta | `src/app/(app)/app/chat/page.tsx:18`, `:25-27` | Se generaliza en la etapa 5 (D-M16e-22) |
| `getIntegraciones()` fija Tiendanube como no conectada; la usan Inicio y el menú | `src/modules/app-data/index.ts:96-104`; `src/app/(app)/app/page.tsx:17`; `layout.tsx:38`, `:48` | Lee el estado real de Tiendanube en la etapa 4 (D-M16e-22) |
| El pgTAP de privilegios fija el enum a `meta` | `supabase/tests/09_integration_privileges.test.sql:181` | Se modifica en la etapa 1 (D-M16e-22) |
| `diagnostic_reports` fija `schema_version = 1` y `methodology_version = 'meta-diag-1'` y no tiene FK a la conexión | `0022_meta_diagnostics.sql:60-99` | La migración nueva versiona el contrato y agrega la referencia a la conexión de Tiendanube (D-M16e-15) |
| Ciclo de vida y UI acoplados a Meta | `lifecycle.ts:122-150`, `:167-215`; `integraciones/page.tsx:25-38`, `:74-110` | Flujo por proveedor sin reinterpretar `desconectarMeta` ni su tarjeta |
| Rutas OAuth de Meta | `src/app/api/integraciones/meta/{iniciar,callback}/route.ts` | Las de Tiendanube replican la forma |
| `maxDuration` de Integraciones es 300 s | `integraciones/page.tsx:15` | Presupuesto de un paso de sincronización por debajo |
| Scripts de verificación | `package.json:17-27` | `verify` no ejecuta pgTAP ni `test:app`: se corren aparte |

## Referencia de API verificada (2026-11-12)

Fuente: documentación oficial de Tiendanube leída el 2026-11-12 (páginas «Actualizado» entre 2026-10-27 y 2026-11-12). Es el contrato de partida; cada etapa lo contrasta con respuestas reales. **«No documentado» significa que no figura en las páginas leídas y pasa a hipótesis, no a hecho.**

### Contrato HTTP y OAuth

| Tema | Valor documentado | Implicación |
|---|---|---|
| Versión | Base `https://api.tiendanube.com/2025-03/{store_id}` (equivalente `api.nuvemshop.com.br`; solo SSL). `2025-03` es «la versión estable actual y la predeterminada»; existen `v1` (legacy) y `unstable`. **No existe versión posterior.** | Constante única, verificada al implementar. Allowlist de host: solo `api.tiendanube.com`. Nunca `unstable` ni `v1` |
| Autorización | `GET https://www.tiendanube.com/apps/{app_id}/authorize?state=<state>`. **No lleva `scope` ni `redirect_uri` en la URL**: ambos se fijan en el Portal de Socios. Si el comerciante ya autorizó, el paso de permisos se omite | La app no puede pedir un subconjunto de scopes en runtime; el control es el Portal más la verificación del `scope` devuelto |
| Redirección | Redirige a la URL de redirección del Portal con `?code=…&state=…`. `code` vence a los 5 minutos. **La redirección por defecto del Portal es una URL de socios, no el callback de PRAXA** | Sin cambiarla, el comerciante cae en un login de socio. Una sola URL por app: hay una sola app, apuntada a `app` (D-M16e-09) |
| Canje | `POST https://www.tiendanube.com/apps/authorize/token`, `Content-Type: application/json`, cuerpo `{client_id, client_secret, grant_type:"authorization_code", code}`. Mandarlos como parámetros de URL es «un error común» | Respuesta: `access_token`, `token_type:"bearer"`, `scope` (separado por comas), `user_id` (string; en algunas respuestas `store_id`) = ID de tienda. Aceptar ambos nombres y validar que sea numérico. No documentado: si el `code` es de un solo uso (se trata como tal) ni los errores del endpoint |
| Scopes | Pares `read_*`/`write_*`; un `write_*` implica el `read_*`. **No existe `read_store`** | Portal solo con `read_orders`, `read_customers`, `read_products`. Cambiar scopes obliga a reinstalar |
| Token | No expira por tiempo. Se invalida al obtener otro para la misma app y tienda, o al desinstalar. Pertenece al par app+tienda | Reinstalar rota el token (generación). La desinstalación solo se detecta por `401` o por `app/store_redact` |
| Autenticación HTTP | `Authorization: Bearer <token>` (no `Authentication`). **`User-Agent` obligatorio**: nombre de la app + enlace o email de contacto; sin él, `400 Bad Request` | `User-Agent` = `PRAXA (<TIENDANUBE_SUPPORT_CONTACT>)`, con el contacto de soporte que carga el usuario (D-M16e-08) |
| Cuota | Leaky bucket por app+tienda: 40 solicitudes, fuga 2/s. Headers `x-rate-limit-limit`, `x-rate-limit-remaining`, `x-rate-limit-reset` (ms hasta vaciar). `429` al excederlo. Tiendas Next/Evolution ×10. **No hay `Retry-After`** | Espera calculada con `x-rate-limit-reset`, presupuesto finito |
| Paginación | `per_page` por defecto 30, máximo 200; `page` desde 1; header `x-total-count`; header `Link` con `rel` next/prev/first/last, «usar las URLs de Link» | Seguir `Link rel="next"`; usar `x-total-count` para decidir subdivisión |
| Estado de cuenta | Tienda suspendida por falta de pago: **toda llamada devuelve `402`** y los webhooks no se disparan | `402` no es revocación: sin purgar |
| Errores | `400` (JSON inválido o falta `User-Agent`), `402`, `415`, `422` (p. ej. `fields` desconocido), `429`, `5xx`. **No documentados**: cuerpo de `401`, `403` y `404`, y el error al exceder 10.000 pedidos | Clasificación por estado HTTP; «desconocido no cambia el estado de la conexión» |

### Datos que entrega la API

| Recurso | Hechos documentados | Consecuencia |
|---|---|---|
| `GET /store` | Campos: `id`, `main_currency` (ISO 4217), `languages{código:{currency,active}}`, `country`, `original_domain`, `url_with_protocol`, `domains[]`, `plan_name`, y **`timezone_id` (zona IANA)**. No hay campo `timezone` a secas | Zona y moneda de K03 sin inventarlas. El scope que habilita `GET /store` no está documentado: M16e-H-05 |
| `GET /orders` | Filtros: `since_id`, `status` (`any`, `open`, `closed`, `cancelled`), `payment_status` (`any`, `pending`, `authorized`, `paid`, `abandoned`, `refunded`, `voided`), `created_at_min/max`, `updated_at_min/max`, `customer_ids`, `fields`, `page`, `per_page`. **Tope de 10.000 por consulta** con un error sin código documentado | **`payment_status` no admite `partially_paid` ni `partially_refunded` como filtro**: se pide `payment_status=any` y se clasifica localmente. Tope: M16e-H-08 |
| Objeto `Order` | `id` (distinto de `number`), `status` (`open`/`closed`/`cancelled`), `payment_status` (`authorized`, `pending`, `paid`, `partially_paid`, `abandoned`, `refunded`, `partially_refunded`, `voided`), `created_at`/`updated_at`/`paid_at`/`closed_at`/`cancelled_at` (ISO 8601), `currency`, `subtotal`, `discount`, `discount_coupon`, `discount_gateway`, `promotional_discount`, `total`, `total_paid_by_customer`, `storefront`, `cancel_reason`, `is_subscription`, `is_subscription_initial`. `customer` solo con `read_customers` | `total_paid_by_customer` «puede no coincidir con `total`» y no es neto de reembolsos. Las fechas se llevan a `timezone_id` de la tienda para cohortes y períodos |
| Línea (`products[]`) | `id` (de la línea), `product_id`, `variant_id`, `name`, `price`, `quantity`, y datos de envío/kit. **No figura `sku` ni descuento por línea** | SKU por la variante. El descuento solo existe por pedido: el ranking es por unidades (D-M16e-19) |
| Reembolsos | No hay endpoint de refunds. `GET /orders/{id}/history/values`: en una entrada `PAID`, `total_paid_diff` negativo es un reembolso. «Un historial vacío no confirma que no hubo reembolsos» | Una solicitud por pedido; solo para pedidos cuyo `payment_status` cambió a `refunded` o `partially_refunded`. Campos leídos de un resumen: M16e-H-06 |
| `Customer` | Solo hace falta `customer.id`, dentro del pedido; no se llama a `GET /customers`. PII: nombre, email, teléfono, `identification`, direcciones, `billing_*`, `note`, `extra` | Subcampos en `fields` no verificados: M16e-H-07 |
| `Product`/variante | Producto: `id`, `name` (por idioma), `visibility` (`visible`/`unlisted`/`hidden`; `published` por compatibilidad), `created_at`/`updated_at`. Variante (de ejemplos): `id`, `product_id`, `sku`, `price`, `stock`. `fields` admite puntos; un campo desconocido da `422`. `GET /products` pagina hasta 200 y filtra `updated_at_min/max` | Campos de variante: hipótesis hasta la prueba manual. Producto borrado = ausencia en el catálogo; la línea histórica sobrevive |
| Webhooks de privacidad | Se configuran **en el Portal**. Firma: header `x-linkedstore-hmac-sha256`, HMAC-SHA256 del **cuerpo crudo** con el `client_secret`. Esperan `2xx` en **3 s**; hasta 16 reintentos en 48 h; sin orden garantizado y con duplicados | Handler corto. Codificación de la firma: M16e-H-09 |
| `app/store_redact` | Tras la desinstalación. Payload `{store_id}` (sin campo `event`) | El tipo de evento se deduce de la **URL** de cada endpoint |
| `customer/redact` | Payload `{store_id, customer:{id,email,phone,identification}, orders_to_redact:[ids]}`. Sin compras en 6 meses, se envía a los 5 días; con compras, **Tiendanube retiene el pedido hasta cumplir 6 meses** | El cuerpo trae PII: se descarta en memoria |
| `customers/data_request` | Payload `{store_id, customer, orders_requested, checkouts_requested, drafts_orders_requested, data_request:{id}}`. «Es responsabilidad de la aplicación enviar la información directamente al comerciante» | D-M16e-07: firma verificada y `2xx`, sin persistir ni exportar. Riesgo aceptado |
| Cambios 2026 | Sin cambios de autenticación, scopes, cuota, paginación ni `GET /store`. Relevantes: `visibility` (2026-07); reintentos 16 y timeout 3 s (2026-02/07) | Reverificar el changelog al implementar |

### Clasificación de errores (patrón CA-39 de Meta)

Cada tipo se guarda con una clase existente de `last_error_class`, así no cambia el `check` de la conexión.

| Señal | Tipo | `last_error_class` | Efecto sobre la conexión |
|---|---|---|---|
| `401` | `credencial_invalida` | `authentication` | `needs_reauth` |
| `403` | `permiso_faltante` | `permission` | `needs_reauth` (falta un scope o la app perdió acceso) |
| `402` | `tienda_suspendida` | `user_action` | Sigue `active`; sincronización detenida con mensaje al dueño; no purga |
| `400` | `solicitud_invalida` | `own_error` | Sin cambio de estado; error visible (defecto de PRAXA) |
| `422` | `campo_invalido` | `own_error` | Sin cambio de estado |
| `429` | `cuota` | `rate_limit` | Espera por `x-rate-limit-reset`; agotado el presupuesto, ejecución incompleta |
| `5xx`, timeout | `transitorio` | `temporary` | Hasta 2 reintentos; después, ejecución incompleta |
| Red o DNS | `transporte` | `transport` | Igual que `transitorio` |
| `404` en un producto | `no_encontrado` | — | El producto queda como «eliminado»; no es error de conexión |
| `404` en tienda o pedido | `no_encontrado` | `unknown` | Sin cambio de estado; ejecución incompleta |
| Cualquier otro | `desconocido` | `unknown` | Sin cambio de estado |

### Campos extraídos y descartados (lista cerrada, tabla de evidencia de cierre)

| Recurso | Se proyecta y persiste | Se descarta siempre |
|---|---|---|
| Store | `id`, `timezone_id`, `main_currency`, `country`, `original_domain` | Nombre, email, contacto, `business_*`, direcciones, redes, plan, tema, `url_with_protocol`, `domains` |
| Order | `id`, `status`, `payment_status`, `created_at`, `updated_at`, `paid_at`, `closed_at`, `cancelled_at`, `currency`, `subtotal`, `discount`, `total`, `total_paid_by_customer`, `storefront`, `cancel_reason`, `is_subscription`, `is_subscription_initial`. `number` **no** se persiste | `number`, `contact_*`, `billing_*`, `shipping_address`, `client_details`, `note`, `owner_note`, `extra`, `attributes`, `token`, `gateway_link`, `payment_details` |
| Línea | `product_id`, `variant_id`, `name`, `price`, `quantity` | Dimensiones, peso, `properties`, `issues` |
| Cliente | `customer.id` opaco | Todo lo demás del objeto `customer` |
| Producto/variante | `id`, `name`, `visibility`/`published`, `variants[].id`, `variants[].sku` | Descripción HTML, imágenes, SEO, categorías, precios, stock |
| Historial de valores | Suma de `total_paid_diff` negativos por pedido | El resto de cada entrada |

La petición pide el subconjunto con `fields`, pero como `fields` y los subcampos de `customer` no están verificados (M16e-H-07), **la proyección en memoria es obligatoria** aunque el servidor devuelva de más.

### Alta de la app en el Portal de Socios (acción del usuario, sin secretos en el chat)

Se hace **antes de la etapa 2**, porque confirma M16e-H-04 (instalar sin homologación). Si la app no se puede instalar en una tienda propia sin homologación, la microfase se detiene.

1. Registrarse como socio en `partners.tiendanube.com`, sección Apps, y crear la app. Confirmar en pantalla qué tipo corresponde a una tienda propia (la documentación menciona «Para Tus Clientes», sin homologación; la página no cargó).
2. En «Datos básicos», marcar **solo** `read_orders`, `read_customers`, `read_products`. Ningún `write_*`.
3. URL de redirección: `https://<dominio de app>/api/integraciones/tiendanube/callback`. Webhooks de privacidad: `…/api/integraciones/tiendanube/privacidad/store-redact`, `…/customer-redact` y `…/data-request`. Soporte: el contacto de D-M16e-08. Completar las demás URL obligatorias (panel, preferencias, política de privacidad) con las páginas existentes del sitio.
4. Crear una tienda de demostración en el Portal, cargarle pedidos sintéticos e instalar la app (D-M16e-12).
5. Cargar las cuatro variables de §1 (`TIENDANUBE_APP_ID`, `TIENDANUBE_CLIENT_SECRET`, `TIENDANUBE_SUPPORT_CONTACT` y `TIENDANUBE_REDIRECT_URI`), más `TIENDANUBE_CLIENT_ID` si M16e-H-10 falla, solo en `.env.local` y en Vercel (producción). Correr `node --env-file=.env.local scripts/tiendanube-preflight.mjs`, que informa presencia y forma de cada una sin imprimir valores: ID numérico, secreto no vacío, contacto con forma de email o URL, y `TIENDANUBE_REDIRECT_URI` en HTTPS y terminada en `/api/integraciones/tiendanube/callback`.

## Diseño concreto

### 0. Etapas

Una microfase, un gate (`G-TIENDA`), cinco etapas con control técnico propio (D-M16e-18). Rigen las reglas de corrida única de `M25a`: no se pasa de etapa con pruebas en rojo y cada etapa termina con un commit del usuario.

| Etapa | Contenido | Control |
|---|---|---|
| `.1` | Migración 1 (`<n>_tiendanube.sql`): proveedor, índices, scopes y token por proveedor, tablas, agregados, funciones de lectura, RPC, privacidad y purga; contratos K02–K04; pgTAP nuevo y `08`, `09`, `09b` y `10` | `verify`, `db:check:test`, `test:policies`, `test:app` |
| `.2` | OAuth, ciclo de vida, purga perezosa por proveedor | Los mismos |
| `.3` | Cliente HTTP, extracción, conciliación y webhooks de privacidad | Los mismos |
| `.4` | Pantalla de Tiendanube; Inicio y menú con el estado real (`app-data`). Al pasar el control: primera publicación y pruebas manuales con la tienda de demostración (T-15, D-M16e-12) | Los mismos, publicación verificada y T-15 |
| `.5` | Migración 2 (`<n+1>_tiendanube_chat_diag.sql`): lista de herramientas del chat y versión 2 de `diagnostic_reports`. Página del chat, orquestador, herramientas y diagnóstico. Al pasar el control: segunda publicación | Los mismos; `test:eval` solo con OK previo (T-13) |

**Publicación antes del gate (D-M16e-25).** El OAuth y los webhooks reales solo llegan a `app`, así que el código se publica antes de `G-TIENDA`, en dos momentos:

1. **Al terminar la etapa 4:** el usuario hace el commit de la etapa en `mf/M16e`, integra en `main` las etapas 1 a 4, corre `db:push` de la migración 1 en `app` y despliega producción desde ese commit. Después se hace T-15.
2. **Al terminar la etapa 5:** lo mismo con la migración 2.

Cada migración se aplica primero al desechable (`db:push:test`). Una migración ya aplicada en `app` no se edita: una corrección posterior va en otra migración nueva, que se agrega a «Archivos previstos» antes de escribirla. Entre las dos publicaciones, la pantalla de Tiendanube e Inicio quedan en producción, y el chat sigue exigiendo Meta. El dueño no conecta su tienda hasta que se le comunique el acta. El recorrido real (C-09) se hace después de la segunda publicación. Ninguna publicación aprueba el gate.

### 1. Identidad, conexión y OAuth

- **Variables.**
  - `TIENDANUBE_APP_ID`: el ID de la app. Se usa en la URL de autorización y como `client_id` del canje (M16e-H-10).
  - `TIENDANUBE_CLIENT_SECRET`: canje y firma de webhooks.
  - `TIENDANUBE_SUPPORT_CONTACT`: contacto del `User-Agent`.
  - `TIENDANUBE_REDIRECT_URI`: URL del callback, que se compara con la del Portal.

  Las cuatro van en `.env.example` sin valor y en `meta_first/entorno.md`.
- **Rutas.**
  - `GET /api/integraciones/tiendanube/iniciar`: autenticado y solo el dueño.
  - `GET /api/integraciones/tiendanube/callback`.
  - `POST /api/integraciones/tiendanube/privacidad/{store-redact,customer-redact,data-request}`.
- **Inicio.** Construye K01 con `requireTenantContext()`, exige rol dueño y crea un K02 con proveedor `tiendanube` y propósito `initial` (sin conexión viva de Tiendanube en la empresa) o `reauth`. Usa la nueva firma de `create_oauth_attempt`, que recibe el proveedor; Meta pasa `meta`. `state` y nonce tienen 32 bytes aleatorios; se guardan solo sus hashes, y el intento se consume una sola vez. Redirige a `https://www.tiendanube.com/apps/{TIENDANUBE_APP_ID}/authorize?state=<state>`.
- **Callback.**
  - Recibe `code` y `state` y redirige enseguida a una ruta limpia, con `Referrer-Policy: no-referrer`. PRAXA no guarda ni registra `code`.
  - Sin `state`, por una instalación iniciada desde Tiendanube: se rechaza con el aviso «iniciá la conexión desde PRAXA».
  - Sin `code`, porque el usuario canceló: se consume el intento y vuelve a Integraciones con «conexión cancelada».
  - El canje es `POST` con cuerpo JSON. El `scope` devuelto debe ser **exactamente** `read_customers,read_orders,read_products`, en cualquier orden. Cualquier otro valor rechaza la conexión y destruye el token en memoria.
  - Confirma la tienda con `GET /store`, comparando `id` con `user_id`, y toma `timezone_id` y `main_currency` para K03. Si falta alguno, la conexión no se activa (M16e-H-02).
- **Credencial.** Se cifra con el llavero AES-GCM existente. El AAD incluye empresa, conexión y proveedor. `token_type = 'store_app_token'`, `issued_for_app_id = TIENDANUBE_APP_ID` y `expires_at = null` (CA-11c enmendado).
- **Estados.** `pending_selection` dura solo mientras se confirma la tienda y vence a los 30 minutos, como en DEC-17. Se activa después de `GET /store`, sin pedir que se elija un recurso. Reinstalar o reautorizar sustituye la credencial solo si se cumplen dos condiciones (CA-37c): la generación coincide y el `store_id` del canje es igual al `external_account_id` de la conexión. Si la tienda es otra, el intento se rechaza con el aviso «para cambiar de tienda, desconectá primero» y el token se destruye en memoria; el historial nunca se reasigna a otra tienda. Una extracción en vuelo pierde posesión.
- **Desconexión.**
  - El dueño desconecta Tiendanube sin afectar Meta. PRAXA deja de leer, destruye la credencial y purga.
  - No hay revocación remota. `runLazyPurge` distingue proveedor: solo las credenciales de Meta llaman a `revokeToken` de Meta. Las de Tiendanube se destruyen sin llamada externa (A-13).

### 2. Esquema y privilegios

- **Tablas nuevas.** En `private`: `tn_sync_runs`, `tn_orders`, `tn_order_lines`, `tn_customers`, `tn_products`, `tn_product_variants` y `tn_redaction_suppressions`. En `public`, agregados que solo escribe `worker_api`: `tn_sync_status`, `tn_sales_daily`, `tn_product_units_daily` y `tn_cohort_cells`.
- **Reglas comunes.** Cada fila tiene `company_id`, `connection_id` y la clave externa de la tienda en columnas tipadas, con FK compuesta `(company_id, connection_id)` a su conexión y `ON DELETE CASCADE`. RLS habilitada y forzada; `REVOKE ALL` explícito.
- **Lectura.** `authenticated` lee solo los agregados, por RLS de membresía y con la conexión de Tiendanube `active` o `needs_reauth`. Lo hace mediante funciones `public` `SECURITY INVOKER`, como las de Meta (`get_meta_daily_coverage`): `get_tn_sync_status`, `get_tn_sales`, `get_tn_product_units` y `get_tn_cohorts`. La pantalla, el chat y el diagnóstico usan solo esas funciones. `anon`, `PUBLIC`, `service_role` y `praxa_integrations` no tienen lectura directa.
- **Escritura.** `praxa_integrations` solo ejecuta RPC de `worker_api`. Cada una verifica actor, empresa, conexión y proveedor, salvo las dos funciones de privacidad de D-M16e-14.
- **Matriz y pruebas.** La matriz exacta de grants va en el encabezado de la migración y se prueba en su pgTAP. Las firmas SQL las fija el plan.
- **Contenido.**
  - `tn_orders`: ID de pedido, `customer.id` opcional (referencia a `tn_customers`), fechas, estados de pedido y de pago, moneda, importes `numeric`, suma de reembolsos verificados y `source_updated_at`.
  - `tn_order_lines`: producto y variante, nombre, cantidad y precio unitario al momento del pedido.
  - `tn_products` y variantes: nombre, SKU opcional y visibilidad.
  - `tn_customers`: solo el identificador opaco.
  - No se guarda JSON bruto. Los agregados no exponen IDs externos ni filas de comprador.
- **Agregados** (A-06). Se recalculan dentro de la transacción que publica una ventana, en el paso de borrado de `tn_privacy_customer_redact` y en el borrado previo de pedidos marcados que hace el primer paso de sincronización (§4):
  - **`tn_sales_daily`**, un registro por conexión, día local y moneda. El día local sigue la regla de fechas de §3. Columnas: pedidos pagados elegibles, pedidos elegibles sin `customer.id`, pagos parciales, suma de `total_paid_by_customer` de los elegibles y suma de reembolsos verificados. `get_tn_sales(p_connection_id, p_from, p_to, p_grain)` agrupa por día o por mes y nunca suma monedas distintas.
  - **`tn_product_units_daily`**, un registro por conexión, día local, producto y variante. Producto y variante se identifican con claves internas, nunca con el ID de Tiendanube. Columnas: nombre, SKU, marca de eliminado y unidades. `get_tn_product_units(p_connection_id, p_from, p_to, p_limit)` ordena por unidades, con desempate por nombre.
  - **`tn_cohort_cells`**, un registro por conexión, mes de cohorte y desplazamiento N. Columnas: tamaño de la cohorte, activos y marca de parcial. Se recalcula completa para la conexión. **La regla de cinco se aplica en SQL al escribir:** un tamaño menor que cinco se guarda nulo, con todas las celdas de esa cohorte, y un activo menor que cinco también se guarda nulo, cada uno con su marca de ocultamiento. Ningún rol puede leer un conteo menor que cinco. `get_tn_cohorts(p_connection_id, p_from_month, p_to_month, p_max_offset)` los devuelve con esas marcas.
- **Estado vigente únicamente** (D-M16e-16). Un pedido se sobrescribe por upsert `(connection_id, external_order_id)` y sus líneas se reemplazan enteras. No hay historial de versiones. Si un dato se pierde, se recupera con una resincronización completa.
- **Supresión** (D-M16e-17). `tn_redaction_suppressions` guarda `(connection_id, external_customer_id, external_order_id)`, sin PII, y cae en cascada con la purga de la conexión. Riesgo aceptado: si la tienda se desconecta y se reconecta, un dato suprimido podría reimportarse.

### 3. Extracción y publicación

- **Cliente HTTP.**
  - Solo `GET` a `api.tiendanube.com/2025-03/{store_id}/…` y a los paths `store`, `orders`, `orders/{id}/history/values` y `products`.
  - Headers fijos: `Authorization: Bearer` y `User-Agent`. El token no va en URL, logs ni errores.
  - `per_page=200` y paginación por `Link rel="next"`. Se valida estructura, unicidad de ID entre páginas y coherencia de `store_id`.
- **Presupuestos iniciales**, configurables. Se miden en el desechable con fixtures y en la tienda de demostración, y se registran como Q-04 en M16c:
  - duración de un paso: 240 s, por debajo de `maxDuration = 300`;
  - hasta 25 páginas por paso;
  - espera por `429`: hasta 30 s acumulados por paso;
  - `5xx`: 2 reintentos;
  - hasta 100 llamadas a `history/values` por paso;
  - borrado de privacidad: hasta 5.000 filas en total por llamada a `tn_privacy_store_redact` y 2 s de presupuesto por petición. El plan confirma el tope midiendo en el desechable que una llamada tarde bastante menos de 2 s;
  - lease de 5 minutos;
  - solapamiento incremental de 1 hora sobre `updated_at`, con desempate por ID.
- **Backfill de todo el histórico** (D-M16e-06), en ventanas mensuales de `created_at`. Antes de paginar, se lee `x-total-count` de la primera página. Si es 10.000 o más, la ventana se divide a la mitad hasta que entre o hasta llegar a un día. Si un día solo supera el tope, la ejecución termina incompleta sin publicar cobertura completa. Cada paso continúa desde el checkpoint de la ejecución anterior; el dueño lo dispara con «Sincronizar» hasta terminar, sin cron.
- **Incremental.** `updated_at_min` = último checkpoint menos 1 hora. El catálogo se recorre completo en cada sincronización: el producto que falta queda como «eliminado».
- **Publicación.** Cada paso obtiene lease y token de posesión ligados a conexión y generación. Guarda el checkpoint solo después de publicar en una transacción los pedidos y líneas de la ventana. Repetir una ventana no duplica. Una ejecución desplazada por desconexión o reautorización no escribe. Cero real, ausencia de pedido y ventana no cubierta son tres resultados distintos.
- **Elegibilidad** (D-M16e-05):
  - **Pedido pagado elegible:** `payment_status` en `paid` o `partially_refunded`, y `status` distinto de `cancelled`. No cuentan `pending`, `authorized`, `abandoned`, `voided` ni `refunded`. `partially_paid` se informa aparte como «pago parcial».
  - **Monto cobrado ajustado:** `total_paid_by_customer` menos la suma de reembolsos verificados por `history/values`. Lo habilita una constante versionada en código, `TN_COLLECTED_AMOUNT_ENABLED`, que empieza en `false` y solo pasa a `true` después de verificar M16e-H-06. Con `false`, no se publica ninguna métrica de «cobrado» en pantalla, chat ni diagnóstico.
  - **Monedas:** nunca se suman monedas distintas. Toda cifra lleva su moneda.
  - **Fechas:** un pedido cae en el día y el mes de `paid_at` en la zona de la tienda; si `paid_at` es nulo, en el de `created_at`.

### 4. Privacidad, borrado y seguridad de webhooks

- **Handler.**
  - Acepta cuerpos de hasta 64 KB.
  - Verifica `x-linkedstore-hmac-sha256` con `TIENDANUBE_CLIENT_SECRET` **antes** de parsear, comparando en tiempo constante. Firma inválida → `401`.
  - Nunca registra cuerpo ni PII; el tipo de evento sale de la URL.
  - Descarta en memoria email, teléfono y documento.
- **Identidad sin sesión** (D-M16e-14). Excepción acotada a INV-01: el webhook no tiene actor ni membresía. Con la firma verificada, dos funciones de `worker_api` sin actor resuelven por `(provider='tiendanube', external_account_id = store_id)` **todas** las conexiones de esa tienda, en cualquier empresa y en cualquier estado, y aplican el borrado:
  - `tn_privacy_store_redact(p_store_id, p_max_rows)`;
  - `tn_privacy_customer_redact(p_store_id, p_customer_id, p_order_ids)`.

  Cada llamada es una transacción corta. El handler llama a la misma función varias veces: según el estado que encuentra, cada llamada hace la fase que corresponde y devuelve `marked`, `more` o `done`.

  Solo pueden marcar conexiones como desconectadas y borrar; nunca activan una conexión y devuelven el estado de la fase, nunca datos (§17.9 de la ruta, ampliado por D-M16e-27). Las ejecuta solo `praxa_integrations`. Toman el mismo bloqueo de empresa que la publicación. Sin conexiones de esa tienda, no hacen nada y el handler responde `2xx`, sin revelar si existía. La excepción se registra en `SECURITY.md`.
- **`app/store_redact`** (A-04, D-M16e-26). Se hace en dos fases, con llamadas sucesivas a `tn_privacy_store_redact`, cada una en una transacción corta que se confirma por separado. Así, un corte de la función en cualquier punto deja un estado consistente, y la llamada siguiente continúa desde ahí:
  1. **Marca.** Si la tienda tiene conexiones sin marcar, la llamada solo lleva cada conexión de la tienda a `disconnected` con `purge_requested_at`, incrementa la generación y borra la credencial. Deja el estado de `begin_disconnect`, pero sin credencial: `runLazyPurge` lo completa sin revocación, porque ya maneja la ausencia de credencial. Desde ahí, los datos no se leen (la política exige `active` o `needs_reauth`), no hay token, y una sincronización en vuelo pierde posesión y no escribe. Devuelve `marked`.
  2. **Borrado por tandas.** Con todas las conexiones marcadas, cada llamada borra hasta `p_max_rows` filas de las conexiones marcadas de esa tienda. Sigue un orden fijo de hijos a padre: registros del chat de la conexión, agregados, líneas, pedidos, clientes, variantes, productos, supresiones y sincronizaciones. Al final borra la fila de la conexión, y el informe del diagnóstico con sección de tienda cae por la cascada (D-M16e-15). Devuelve `more` si quedan filas y `done` si no. El handler llama hasta terminar o hasta agotar un presupuesto de 2 s: si terminó, responde `2xx`; si no, `5xx`, y el reintento de Tiendanube sigue desde donde quedó.

  Ninguna de las dos fases exige actor. Si se agotan los reintentos, el estado queda igual al de una desconexión pendiente de purga, y lo completa `runLazyPurge` cuando el dueño abre Integraciones o el cierre del piloto (CA-67).
- **`customer/redact`** (D-M16e-04, D-M16e-26). También en dos pasos:
  1. La primera llamada a `tn_privacy_customer_redact` inserta, en una transacción corta, las marcas de supresión de ese cliente y de sus pedidos, y devuelve `marked`. Desde ahí, la publicación de una ventana las filtra dentro de su propia transacción, así que una sincronización en vuelo o un backfill no reimportan esos pedidos.
  2. Con las marcas presentes, la llamada siguiente borra, en una transacción, el cliente y los pedidos y líneas indicados, recalcula los agregados y devuelve `done`. Su tamaño lo acota un solo cliente.

  Si el paso 2 falla, el handler responde `5xx` y el reintento lo repite. Si se agotan los reintentos, el primer paso de sincronización de esa conexión borra, antes de leer, los pedidos que siguen presentes con marca de supresión, y recalcula. No toca el informe del diagnóstico, que solo tiene totales.
- **Idempotencia y reintentos.** Las funciones son idempotentes: un duplicado o un reintento no produce efectos adicionales, porque marcar lo ya marcado o borrar lo ya borrado no cambia nada y la supresión se inserta sin duplicar. No hay tabla de solicitudes. Un corte de la función antes de confirmar una transacción la deshace entera, y lo ya confirmado se conserva. Cada fallo deja un log redactado con tipo de evento, fase, clase de error y cantidad de conexiones, sin IDs ni cuerpo.
- **Reinstalación dentro de las 48 horas** (D-M16e-28, riesgo aceptado). Un aviso de desinstalación no trae fecha, y Tiendanube puede repetirlo hasta 48 horas. Si el dueño reinstala la app en ese lapso, un reintento o duplicado atrasado marca y borra también la conexión nueva, y el dueño tiene que volver a conectar y resincronizar. No afecta a otra tienda ni a otra fuente. Por eso, «sin efectos adicionales» vale solo mientras no haya una conexión nueva de la tienda.
- **Riesgo aceptado** (D-M16e-26). Si fallan los 16 reintentos en 48 horas y nadie dispara la recuperación, los datos de la tienda quedan ocultos y sin credencial, pero no borrados, hasta que el dueño abra Integraciones o hasta el cierre del piloto. En `customer/redact`, los pedidos marcados quedan hasta la próxima sincronización. No hay cron ni worker (§2 de la ruta). El riesgo se registra en `SECURITY.md`.
- **`customers/data_request`** (D-M16e-07). Firma verificada y `2xx`. No persiste, no deduplica, no exporta y no avisa. **Riesgo aceptado por el usuario**, registrado en `SECURITY.md` dentro de esta microfase.

### 5. Análisis y UI

- **Ventas por período** (`tn_sales_daily`, `get_tn_sales`). Pedidos pagados elegibles por día o mes, en la zona de la tienda, separados por moneda; pagos parciales aparte. Con `TN_COLLECTED_AMOUNT_ENABLED`, el servidor presenta el monto cobrado ajustado: suma de `total_paid_by_customer` menos reembolsos verificados.
- **Cohortes** (`tn_cohort_cells`, `get_tn_cohorts`). Para cada cliente con `customer.id`:
  - **Mes de cohorte** `c`: mes de su primer pedido pagado elegible. **Tamaño** `n_c`: clientes de esa cohorte.
  - **Activos** `a_c,N`, para N ≥ 0: clientes de la cohorte con al menos un pedido pagado elegible en el mes `c+N`. **Retención** `r_c,N = a_c,N / n_c`. En N = 0 vale 100 % por definición y se muestra igual.
  - **Exclusiones.** Los pedidos sin `customer.id` se excluyen y se informa su proporción sobre los pedidos elegibles, a partir de `tn_sales_daily`. Las celdas de meses sin cobertura completa se marcan como parciales.
- **Mínimo de cinco** (D-M16e-11, D-M16e-20).
  - Una cohorte con `n_c < 5` se muestra como «menos de 5», sin celdas.
  - Una celda con `a_c,N < 5` se muestra como «menos de 5».
  - Como las celdas no forman una partición de la cohorte, ocultar una no se puede deducir restando.
  - Se aplica en SQL al escribir `tn_cohort_cells`, así que vale igual en la pantalla, el chat y el diagnóstico.
  - Las ventas por período y el ranking son totales de la tienda y se muestran completos.
- **Productos vendidos** (`tn_product_units_daily`, `get_tn_product_units`, D-M16e-19). Ranking por **unidades** de líneas de pedidos pagados elegibles en el período, por producto y variante. El producto eliminado se conserva como «producto eliminado». No hay ranking por importe.
- **Pantalla.** Separa conexión, estado de extracción, cobertura, ventas, cohortes y ranking. Un vacío no se presenta como cero. Muestra la tienda por su dominio truncado (`original_domain`).
- **Inicio y menú** (D-M16e-22). `getIntegraciones()` lee el estado real de Tiendanube bajo RLS, como el de Meta: `active` se ve conectada; cualquier otro estado o un error de lectura, no conectada.

### 6. Chat y diagnóstico (D-M16e-10)

- **Herramientas del chat.** Nuevas en `src/modules/chat/tools/`, con el contrato de §12 de la ruta. Leen solo con las funciones `get_tn_*` de §2. Devuelven agregados con fuente `tiendanube`, período, zona, moneda y cobertura, y nunca IDs de clientes o pedidos.

  | Herramienta | Parámetros | Devuelve |
  |---|---|---|
  | `tn_ventas` | período (máx. 93 días, CA-70), granularidad día o mes | Pedidos pagados elegibles y pagos parciales por moneda; monto cobrado solo con la constante activa |
  | `tn_cohortes` | desde-hasta en meses (todo el histórico, por la excepción de CA-70 de §17.10), hasta 24 cohortes y 12 meses N | Tamaños y retenciones con la regla de cinco |
  | `tn_productos` | período (máx. 93 días), hasta 20 filas | Ranking por unidades |
  | `tn_cobertura` | — | Última sincronización, ventanas cubiertas y pendientes |
- **Verificación de cifras** (D-M16e-13, D-M16e-21). Rige la nota «Enmienda H-E1-228» de §12 de la ruta, que vale para todo el chat: las cifras de bloques y tablas salen de SQL; el texto libre del modelo no se verifica y se rotula como tal; la pregunta llega al modelo sin redactar y se guarda redactada.
- **Fuentes y abstención** (A-07).
  - El orquestador lee las dos conexiones y ofrece al modelo solo las herramientas de las que están `active`. Sin ninguna activa, corta antes del modelo con `connection_not_active`, como hoy.
  - El prompt nombra las fuentes conectadas. `abstain_reason` admite `connection_not_active`, además de `out_of_scope`. Así, con solo Tiendanube conectada, una pregunta sobre Meta termina `not_answered` con `connection_not_active`, y al revés.
  - Una llamada a una herramienta que no se ofreció se rechaza como herramienta inválida, por el camino que ya existe.
- **Registro** (CA-62 completado, D-M16e-24). La conexión del registro es:
  - la de Meta, si el turno usó alguna herramienta de Meta, incluido un turno que usó ambas;
  - la de Tiendanube, si solo usó herramientas de Tiendanube;
  - sin herramientas, la de Meta si está activa y, si no, la de Tiendanube.

  `record_query` ya admite `connection_not_active` sobre una conexión `active` (`0018:141-147`).
- **Página del chat** (D-M16e-22). Con cualquiera de las dos conexiones activa, habilita el chat y lista las fuentes conectadas. Con ninguna, muestra el texto fijo actual. CA-52 muestra también la tienda conectada, por su dominio truncado.
- **Diagnóstico.**
  - **Sección.** Con Tiendanube `active`, el informe suma «Ventas de la tienda» para los mismos 28 días y los 28 anteriores: pedidos pagados elegibles, pagos parciales y, solo con la constante activa, monto cobrado. Va al lado del gasto de Meta, como dos series distintas, sin atribuir ventas ni inferir causalidad.
  - **Parcialidad.** Si la última sincronización de Tiendanube tiene más de 24 horas o la ventana no está cubierta completa, la sección se marca parcial con su motivo. La generación no se bloquea por Tiendanube; la sección se agrega si la conexión está `active` y tiene al menos una ventana cubierta.
  - **Versiones.** `schema_version = 2` y `methodology_version = 'meta-tn-diag-1'`.
  - **Persistencia** (D-M16e-15; nota «Enmienda D-M16e-15» de §16 de la ruta). Columna nueva `store_connection_id`, nula cuando no hay sección de tienda, con FK compuesta a la conexión de Tiendanube y `ON DELETE CASCADE`. La política de lectura oculta el informe si esa conexión no está `active` o `needs_reauth`. La purga y `store_redact` borran la fila de la conexión, y el informe cae por cascada. Va en la migración 2.
  - **Presentación.** En `diagnostico.tsx` y en el PDF.
- **Proveedores.** Los agregados de Tiendanube van a DeepInfra (chat) y a Anthropic (diagnóstico). El acta ampliada lo declara.

### 7. Excepciones expresas (§17.6 de la ruta)

Las aprobó el usuario el 2026-11-14 y siguen el modelo de CA-67:

| Escritura | Irreversibilidad | Cómo se recupera | Decisión |
|---|---|---|---|
| Purga al desconectar Tiendanube | Borra credencial, pedidos, catálogo, supresiones e informe con sección de tienda | Reconectar y resincronizar | D-M16e-16 |
| `app/store_redact` | Igual que la purga | Reinstalar y resincronizar | D-M16e-16 |
| Upsert de pedidos y reemplazo de líneas | Se pierde el estado anterior del pedido | Resincronizar: Tiendanube es la fuente | D-M16e-16 |
| `customer/redact` | Borra los pedidos del cliente | No se recupera, por diseño | D-M16e-04 |
| Pruebas manuales en `app` con la tienda de demostración | Excepción a CB-04 e INV-10 | Desconectar y purgar al terminar | D-M16e-12 |

## Archivos previstos

Los autoriza II.14b de la ruta, ampliada por las decisiones del 2026-11-14 (D-M16e-10, D-M16e-20 y D-M16e-22). El plan enumera los archivos exactos. El número de migración se comprueba al implementar (hoy el último es `0022`, con pgTAP `17`).

| Archivo o grupo exacto | Nuevo o modificado | Para qué | Autorizado por |
|---|---|---|---|
| `docs/FASES/FASE1/meta_first/{plan,spec,entorno}.md` | Modificados | Ruta, CA enmendados y variables nuevas | II.14b |
| `docs/FASES/FASE1/M16e/{spec,plan}.md`; `docs/FASES/FASE1/M16e/revisiones/`; `docs/FASES/FASE1/meta_first/sesiones/M16e.md` | Nuevos/modificados | Contrato, plan, auditorías y evidencia | II.14b |
| `docs/FASES/FASE1/M03a/acta-meta.md`; `docs/SECURITY.md`; `docs/ARCHITECTURE.md`; `docs/PROJECT_STATE.md`; `docs/HALLAZGOS.md` | Modificados | Acta, fronteras y riesgos aceptados (D-M16e-07, -12, -14, -17, -26, -27, -28), estructura, estado y hallazgos | II.14b |
| `supabase/migrations/<n>_tiendanube.sql` (etapa 1) y `<n+1>_tiendanube_chat_diag.sql` (etapa 5); `supabase/tests/<n>_tiendanube.test.sql` | Nuevos | Esquema, grants, agregados, privacidad, chat y diagnóstico (D-M16e-25) | II.14b |
| `supabase/tests/{08_integration_isolation,09_integration_privileges,09b_integration_lifecycle,10_demo_closure}.test.sql` | Modificados | Aislamiento, enum y privilegios, ciclo de vida y cierre con dos proveedores | II.14b (D-M16e-22) |
| `supabase/tests/{15_chat_queries,17_meta_diagnostics}.test.sql` | Modificados | Herramientas del chat y versión 2 del informe | II.14b |
| `src/modules/integrations/contract/{primitives,oauth-attempt,connection,credential}.ts`; `src/modules/integrations/db/worker-api.ts`; `src/modules/integrations/repository/{connections,credentials,attempts,lifecycle-calls}.ts`; `src/modules/integrations/meta/oauth.ts` | Modificados | Contratos por proveedor y firma nueva de `create_oauth_attempt` | II.14b |
| `src/modules/integrations/tiendanube/`; `src/app/api/integraciones/tiendanube/` | Nuevos | Cliente, OAuth, extractor y handlers de privacidad | II.14b |
| `src/modules/integrations/{lifecycle,actions}.ts`; `src/app/(app)/app/integraciones/` | Modificados/nuevos | Ciclo de vida, purga por proveedor y pantalla | II.14b |
| `src/modules/chat/` (`tools/`, `prompt.ts`, `orchestrator.ts`, `output-schema.ts`, `render.ts`, `limits.ts`) | Modificados/nuevos | Herramientas de Tiendanube | II.14b (D-M16e-10) |
| `src/modules/diagnostics/` (`evidence.ts`, `contract.ts`, `compose.ts`, `pdf.ts`, `validate.ts`, `repository.ts`); `src/components/app/diagnostico.tsx` y `diagnostico.module.css` | Modificados | Sección de ventas de la tienda | II.14b (D-M16e-10) |
| `src/app/(app)/app/chat/page.tsx`; `src/components/app/chat.tsx` | Modificados | Chat con cualquiera de las dos fuentes y lista de fuentes conectadas | II.14b (D-M16e-22) |
| `src/modules/app-data/{index,types}.ts` | Modificados | Estado real de Tiendanube en Inicio y en el menú | II.14b (D-M16e-22) |
| `scripts/tiendanube-preflight.mjs` | Nuevo | Preflight de variables sin imprimir valores | II.14b |
| `.env.example`; `tests/{unit,app,component,eval}/`; `package.json` y lockfile **solo si hay dependencia** | Modificados/nuevos | Variables vacías y pruebas con fixtures sintéticos | II.14b |

Una necesidad adicional durante la implementación detiene la microfase y vuelve a la ruta.

## Criterios de aceptación

### Heredados de la ruta

| ID de la ruta | Qué exige |
|---|---|
| CB-01 a CB-06 | Transversales de `meta_first/spec.md` §14; CB-04 con la excepción de D-M16e-12 (§17.10) |
| §17.1 a §17.5 | Tres hechos distintos, lectura únicamente, datos mínimos, el LLM no calcula, uniones con clave verificada |
| §17.6 | Excepciones de borrado autorizadas en esta spec: sección «Excepciones expresas» |
| §17.7 | Acta ampliada antes del primer dato real; por la ficha, antes del código |
| §17.8 y §17.9 | Decisiones de la propuesta cerradas para Tiendanube; excepciones a CB-04 e INV-10 (D-M16e-12) y a INV-01 (D-M16e-14) |
| §17.10 | CA-05, CA-11c, CA-18, CA-28, CA-52, CA-62 (completado por D-M16e-24) y CA-70 enmendados para Tiendanube; remisiones a las notas de §12 y §16 |
| CA-37c | Reautorización sin cambiar de tienda; el historial nunca se reasigna |
| CA-38, CA-38c, DEC-09 y DEC-17 | Desconexión, escrituras en vuelo, borrado al desconectar y vencimiento de la pendiente, aplicados a Tiendanube |
| §12 | Contrato de herramientas del chat, con la nota «Enmienda H-E1-228» (D-M16e-21): bloques y tablas desde SQL; texto libre sin verificar y rotulado; pregunta sin redactar hacia el modelo y redactada al guardar |
| §16 | Contrato del diagnóstico, ampliado por D-M16e-10, con la nota «Enmienda D-M16e-15» sobre la retención del informe con sección de tienda (D-M16e-23) |

### Operativos de esta microfase

| ID | Criterio verificable | Traza |
|---|---|---|
| M16e-C-01 | Meta y Tiendanube coexisten en una empresa; dos conexiones vivas de Tiendanube no. SQL y K02–K04 coinciden en proveedor, scopes y tipo de token, y no degradan Meta | H-E1-236; CA-05/11c/18/28 enmendados |
| M16e-C-02 | OAuth de un uso vinculado a dueño, empresa y navegador; `code` no persiste; tienda, scopes, zona y moneda se comprueban antes de activar; cancelado y sin `state` se manejan; la reautorización con otra tienda se rechaza | K01/K02; CA-37c; OAuth oficial |
| M16e-C-03 | Credencial cifrada con AAD de Tiendanube; reinstalación, reautorización y desconexión preservan la generación y purgan sin filtrar el token; un token de Tiendanube nunca llega a Meta | K04; DEC-09; A-13 |
| M16e-C-04 | Backfill e incremental recorren todas las páginas y ventanas dentro del presupuesto, sin duplicar, perder cambios ni declarar cobertura ante fallo | Admin API; CA-56/58/59 como patrón |
| M16e-C-05 | Pedidos y líneas reflejan pagos, ediciones, reembolsos y cancelaciones en su estado vigente; moneda, zona y procedencia visibles; sin PII aparte del ID mínimo | D-M16e-05/16; H-E1-237 |
| M16e-C-06 | `store_redact` y `customer/redact` se autentican, son idempotentes y producen un borrado comprobable en todas las conexiones de la tienda; un corte después de confirmar la marca de `store_redact` deja los datos ocultos y sin credencial, y la llamada siguiente continúa el borrado; en `customer/redact`, los pedidos marcados no se reimportan y se borran en el paso 2 o en la siguiente sincronización; `store_redact` deja cero datos sin intervención del dueño mientras duren los reintentos; el backfill y una sincronización en vuelo no reimportan lo suprimido mientras la conexión exista; `data_request` responde `2xx` sin escribir | D-M16e-04/07/14/17 |
| M16e-C-07 | Cohortes y ranking se reproducen con las fórmulas de §5; muestran exclusiones y cobertura; cero y ausencia son distintos | D-M16e-05/19 |
| M16e-C-08 | `anon` y otra empresa no acceden; el rol acotado no lee directo; la purga y el cierre dejan cero datos de la tienda, incluido el informe con sección de tienda | INV-01/04; CA-67/68; D-M16e-15 |
| M16e-C-09 | Recorrido real con la tienda del dueño: al menos un pedido pagado y un cambio posterior de estado, documentado sin valores ni IDs. Sin él no se acredita funcionamiento real | CB-05/06 |
| M16e-C-10 | El cliente HTTP envía siempre `Authorization: Bearer` y `User-Agent`, solo a `api.tiendanube.com` y `2025-03`; clasifica cada error según la tabla; pide solo campos de la lista cerrada y descarta el resto en memoria | Referencia de API |
| M16e-C-11 | El chat responde sobre ventas, cohortes, productos y cobertura solo con las cuatro herramientas; las cifras de bloques salen de SQL; ninguna respuesta expone IDs ni celdas de cohorte de menos de cinco; con una sola fuente conectada, la otra se abstiene con `connection_not_active` y el registro sigue la regla de §6 | D-M16e-10/11/13/20/21/24 |
| M16e-C-12 | Con Tiendanube activa, el diagnóstico agrega la sección de 28 días sin atribuir ventas a Meta; sin ella, el informe no cambia; la evidencia enviada a Anthropic no incluye datos individuales; desconectar Tiendanube borra el informe con sección | D-M16e-10/15 |
| M16e-C-13 | La regla de cinco se aplica por cohorte y por celda en la pantalla, el chat y el diagnóstico | D-M16e-11/20 |
| M16e-C-14 | Las pruebas manuales en `app` usan solo la tienda de demostración, se hacen después de la primera publicación y terminan con desconexión y purga verificadas | D-M16e-12/25 |
| M16e-C-15 | Inicio, el menú y la página del chat reflejan el estado real de cada conexión; con solo Tiendanube activa, el chat queda habilitado | D-M16e-22 |

## Casos de prueba

| ID | Criterios | Tipo | Comando | Resultado esperado | ¿Falla sin implementación? |
|---|---|---|---|---|---|
| M16e-T-01 | C-01/C-08 | pgTAP + app | `npm run test:policies`; `npm run test:app` | La matriz de grants del encabezado de la migración coincide exactamente; dos empresas y dos proveedores aislados; una segunda conexión viva de Tiendanube se rechaza; Meta sigue pasando sus pruebas | Sí |
| M16e-T-02 | C-02 | unit + app | `npm run verify`; `npm run test:app` | Replay, vencido, navegador, actor o empresa ajenos, scopes distintos de los tres `read_*`, callback sin `state`, cancelado y reautorización con otra tienda: rechazados o cerrados como dice §1, sin reemplazar la credencial; callback limpio | Sí |
| M16e-T-03 | C-03 | unit + app | `npm run verify`; `npm run test:app` | Token alterado no descifra; reinstalación cambia generación; sincronización vieja no escribe; purga repetida segura; `runLazyPurge` con una credencial de Tiendanube no llama a la revocación de Meta | Sí |
| M16e-T-04 | C-04 | unit + app | `npm run verify`; `npm run test:app` | Páginas de 200/201, `429`, `5xx`, ventana con 10.000 o más que se subdivide, empate de `updated_at`, ID repetido y reinicio desde checkpoint: sin pérdidas ni duplicados | Sí |
| M16e-T-05 | C-05/C-07 | pgTAP + app | `npm run test:policies`; `npm run test:app` | Fixture con valores esperados escritos: pendiente → pagado → reembolsado parcial → cancelado; línea editada; invitado sin ID; producto borrado. Las cohortes y el ranking dan exactamente los valores del fixture | Sí |
| M16e-T-06 | C-06 | unit + app + pgTAP | `npm run verify`; `npm run test:app`; `npm run test:policies` | Firma inválida → `401`; cuerpo de más de 64 KB rechazado; duplicado sin doble efecto; tienda desconocida → `2xx` sin escribir; tienda en dos empresas → ambas borradas; `store_redact` sobre una conexión `active` deja cero filas de la tienda e informe borrado, sin actor; interrupción simulada después de la marca, entre dos tandas y antes de confirmar una tanda → datos ya ocultos y sin credencial, `5xx`, y la llamada siguiente termina el borrado sin errores; reintentos agotados → `runLazyPurge` completa la purga; conexión nueva de la misma tienda creada después de la marca → el reintento la marca y la borra, y no toca conexiones de otras tiendas ni la de Meta (D-M16e-28); `customer/redact` con el paso 2 fallido → el siguiente paso de sincronización borra los pedidos marcados antes de leer; `customer/redact` durante una sincronización en vuelo → la publicación no reimporta; `data_request` válido → `2xx` sin escribir | Sí |
| M16e-T-07 | C-08/C-13 | pgTAP + app | `npm run test:policies`; `npm run test:app` | Conexión ajena, Data API, cascada y cierre sin filas huérfanas; `tn_cohort_cells` no guarda ningún conteo menor que cinco; `get_tn_*` con otra empresa devuelve vacío | Sí |
| M16e-T-08 | C-07/C-09/C-13/C-15 | component + unit + manual | `npm run verify`; recorrido manual | La pantalla distingue cobertura, vacío y cero; muestra «menos de 5» en cohortes y celdas; `getIntegraciones()` marca Tiendanube conectada solo con `active`; recorrido real redactado | Sí para componente y unit; no para recorrido |
| M16e-T-09 | C-01–C-14 | integración | `npm run db:check:test`; `npm run verify`; `npm run test:policies`; `npm run test:app`; `git diff --check` | Todo verde, sin omisiones requeridas ni migraciones antiguas editadas | Sí |
| M16e-T-10 | C-10 | unit | `npm run verify` | Falta de `User-Agent` imposible por construcción; host o versión fuera de la allowlist rechazados; cada fila de la tabla de errores produce su tipo, clase y efecto; un pedido con `contact_*`, `billing_*` y `customer` completo se proyecta sin esos campos | Sí |
| M16e-T-11 | C-11/C-13 | unit + app | `npm run verify`; `npm run test:app` | Las cuatro herramientas con fixtures: cifras iguales a SQL; celdas de menos de cinco ocultas; sin IDs; período de más de 93 días rechazado salvo `tn_cohortes`; solo Tiendanube conectada → página habilitada, solo herramientas de la tienda, Meta se abstiene con `connection_not_active` y el registro apunta a la tienda; solo Meta conectada → una pregunta sobre la tienda se abstiene y el registro apunta a Meta; ambas: turno mixto → Meta, turno sin herramientas → Meta, turno solo con herramientas de la tienda → Tiendanube; una herramienta no ofrecida se rechaza | Sí |
| M16e-T-12 | C-12/C-13 | unit + app + pgTAP | `npm run verify`; `npm run test:app`; `npm run test:policies` | Evidencia con y sin Tiendanube; ningún dato individual en la petición; sección parcial con sincronización vieja; desconectar Tiendanube borra el informe; PDF con la sección | Sí |
| M16e-T-13 | C-11/C-12 | eval con proveedor | `npm run test:eval` (chat y diagnóstico) | Respuestas sobre fixtures de Tiendanube | **No requerida para el gate**: se corre solo con OK previo del usuario y costo estimado |
| M16e-T-14 | C-05 | unit | `npm run verify` | Dos monedas en el mismo período: nunca sumadas. Pedido pagado a las 23:30 del último día del mes, en una zona con cambio de horario: cae en el mes correcto de la tienda | Sí |
| M16e-T-15 | C-06/C-14 | manual en `app` (D-M16e-12) | Recorrido redactado | Con la tienda de demostración: OAuth real, `GET /store` con los tres scopes (H-05), sincronización, pedido reembolsado (H-06) y desinstalación con `store_redact` real, que verifica la firma (H-09) y deja cero datos | No |

## Verificación

- `npm run db:check:test` antes de tocar el desechable. `npm run db:push:test` es acción del usuario.
- En cada etapa: `npm run verify`, `npm run test:policies` y `npm run test:app` completos. `verify` incluye lint, typegen, typecheck, unit/component y build, pero no las otras dos suites.
- Revisión de diff, esquema expuesto, ausencia de secretos y de PII, e integridad del cierre.
- Las suites automatizadas usan solo el desechable y datos sintéticos.
- En `app`, solo:
  - las pruebas manuales de T-15 con la tienda de demostración (D-M16e-12);
  - el recorrido real de C-09, después del acta.
- Toda prueba requerida omitida cuenta como no ejecutada (CB-06). T-13 no es requerida.
- Una prueba real sin filas no valida el mapeo de campos.

## Intervenciones del usuario y acciones reservadas

| Paso | Qué hace el usuario | Cómo se verifica después |
|---|---|---|
| Antes del código | Aprobar la spec, el plan y el acta ampliada (Tiendanube, DeepInfra y Anthropic) | Textos coordinados y `PROJECT_STATE.md` actualizado |
| Antes de la etapa 2 | Seguir «Alta de la app en el Portal de Socios»: una sola app, solo lectura, redirección y webhooks de PRAXA. Confirmar que se instala sin homologación (H-04). Cargar las cuatro variables (y `TIENDANUBE_CLIENT_ID` si H-10 falla) en `.env.local` y Vercel | Preflight redactado; H-04 y H-10 registradas |
| Fin de la etapa 4 | Primera publicación (D-M16e-25): commit, integración en `main` de las etapas 1 a 4, `db:push` de la migración 1 en `app` y despliegue | Historial de migraciones de `app` y versión publicada |
| Después de la primera publicación | Crear la tienda de demostración con pedidos sintéticos, instalarla en `app` y, al terminar, desinstalarla | T-15 y desconexión verificada |
| Fin de la etapa 5 | Segunda publicación, con la migración 2 | Historial de migraciones de `app` y versión publicada |
| Datos reales | Comunicar el acta al dueño; que el dueño autorice su tienda | Acta comunicada y recorrido redactado |
| Base | `db:push:test` de cada migración cuando el plan lo pida, antes de su `db:push` en `app` | Historial de migraciones y suites |
| Publicación | Commit por etapa, push y aprobación de `G-TIENDA` después del recorrido real | Versión publicada y recorrido real |
| Opcional | OK para T-13, con costo estimado | Resultado registrado |

## Trampas y riesgos

- El índice global y `.maybeSingle()` sin proveedor fallan con dos conexiones, aunque se amplíe solo el enum.
- `token_type='system_user'`, `ads_read` obligatorio, moneda y zona obligatorias y las ramas de `lifecycle.ts` están hechos para Meta; generalizarlos sin discriminante debilitaría ambos flujos.
- `runLazyPurge` hoy enviaría un token de Tiendanube al endpoint de revocación de Meta.
- El orquestador y la página del chat cortan sin Meta activa: sin generalizarlos, el chat no responde sobre la tienda.
- Después de desinstalar, el dueño puede no volver a PRAXA: `store_redact` no depende de la purga perezosa salvo con los reintentos agotados (riesgo aceptado, D-M16e-26).
- Una función de Vercel cortada antes de confirmar deshace su transacción: por eso los borrados de privacidad se confirman por tandas y se reanudan.
- Entre las dos publicaciones, «Conectar Tiendanube» está en producción antes del gate y antes de comunicar el acta al dueño.
- El callback recibe el código en la URL; Vercel puede registrar la consulta entrante. La app no registra ni reemite código ni `state`.
- `order/created` incluye pedidos impagos; la lectura incremental, no un webhook operativo, es la autoridad del estado.
- 10.000 resultados, cuotas y el límite de Vercel exigen reanudación; un timeout no es cobertura completa.
- El payload de Order contiene documentos y direcciones: proyección en memoria y pruebas de no persistencia obligatorias.
- Reconectar una tienda puede reimportar datos suprimidos, porque la supresión cae con la purga (riesgo aceptado, D-M16e-17).
- `data_request` queda sin circuito de respuesta (riesgo aceptado, D-M16e-07).
- La redirección por defecto del Portal no es el callback de PRAXA.
- Con una sola app, el OAuth real solo existe en `app`; las pruebas manuales en producción son la excepción de D-M16e-12, nunca suites automatizadas.
- Filtrar por `payment_status=paid` perdería los estados `partially_*`: se trae todo y se clasifica localmente.
- Sin `User-Agent` hay `400`, que parece un fallo de credenciales.
- Reinstalar la app invalida el token anterior sin aviso: la próxima llamada da `401`.
- Una tienda suspendida responde `402` a todo: no es una desinstalación y no purga.
- Los webhooks de privacidad expiran a los 3 s y llegan duplicados y desordenados.
- El precio de línea no incluye descuentos y `total_paid_by_customer` no es neto de reembolsos: nada se rotula «ingreso neto».

## Decisiones de la microfase

| ID | Decisión | Motivo | Decidió | Fecha |
|---|---|---|---|---|
| D-M16e-01 | Preparar una spec `BORRADOR` para Tiendanube, sin límite de ocho horas | Pedido expreso | Usuario | 2026-11-12 |
| D-M16e-02 | Solo lectura sobre Tiendanube; los webhooks de privacidad se modelan como solicitudes entrantes obligatorias | Non-negotiables de `AGENTS.md` y documentación oficial | Usuario (ratificada el 2026-11-14, A-21) | 2026-11-12 |
| D-M16e-03 | La spec usa la referencia de API verificada, la lista cerrada de campos, la clasificación de errores y el alta en el Portal | Pedido del usuario de investigar el proceso completo | Usuario (ratificada el 2026-11-14, A-21) | 2026-11-12 |
| D-M16e-04 | `customer/redact`: borrar los pedidos y líneas del cliente, recalcular y dejar una marca de supresión sin PII | Opción recomendada (Q-02) | Usuario | 2026-11-14 |
| D-M16e-05 | Venta = pedido pagado elegible (`paid` o `partially_refunded`, no cancelado). Monto cobrado ajustado solo tras verificar reembolsos. Monedas nunca sumadas | Opción recomendada (Q-03) | Usuario | 2026-11-14 |
| D-M16e-06 | Backfill de todo el histórico, en pasos reanudables y sin cron | Opción recomendada (Q-04) | Usuario | 2026-11-14 |
| D-M16e-07 | `customers/data_request`: verificar la firma y responder `2xx`; no persistir, no exportar ni avisar. Riesgo aceptado | «tomemos como que no va a pasar» (Q-05) | Usuario | 2026-11-14 |
| D-M16e-08 | `User-Agent` con un contacto de soporte de PRAXA, cargado por el usuario | Opción recomendada (Q-06) | Usuario | 2026-11-14 |
| D-M16e-09 | Una sola app en el Portal de Socios, apuntada a `app`. Las suites del desechable usan Tiendanube simulada | Menos trámite (Q-06) | Usuario | 2026-11-14 |
| D-M16e-10 | El chat y el diagnóstico usan los agregados de Tiendanube dentro de M16e | Decisión expresa | Usuario | 2026-11-14 |
| D-M16e-11 | Mínimo de cinco clientes por grupo visible de cohorte | Opción recomendada | Usuario | 2026-11-14 |
| D-M16e-12 | Excepción acotada a CB-04 e INV-10: pruebas **manuales** en `app` solo con la tienda de demostración y pedidos sintéticos, sin suites automatizadas, con desconexión y purga verificadas al terminar | El usuario prefirió la excepción a una segunda app (A-04) | Usuario | 2026-11-14 |
| D-M16e-13 | El chat trata las cifras de Tiendanube con el criterio de Meta: bloques desde SQL; texto libre sin verificar y rotulado. Se acepta H-E1-228 para la fuente nueva | Opción recomendada (A-01) | Usuario | 2026-11-14 |
| D-M16e-14 | Excepción acotada a INV-01 para los webhooks de privacidad: funciones sin actor que resuelven por ID de tienda verificado por firma, solo borran y no devuelven datos. Ampliada por D-M16e-27 | Opción recomendada (A-02) | Usuario | 2026-11-14 |
| D-M16e-15 | Desconectar o desinstalar Tiendanube borra el informe del diagnóstico que tiene sección de tienda; `customer/redact` no lo toca | Opción recomendada (A-05) | Usuario | 2026-11-14 |
| D-M16e-16 | Se autorizan la purga al desconectar, `store_redact` y el upsert con reemplazo de líneas. Solo estado vigente, sin historial; la recuperación es resincronizar | Opción recomendada (A-06) | Usuario | 2026-11-14 |
| D-M16e-17 | La supresión cuelga de la conexión y cae con la purga. Riesgo aceptado de reimportar al reconectar | «no importa, no va a ocurrir» (A-07) | Usuario | 2026-11-14 |
| D-M16e-18 | Cinco etapas: chat y diagnóstico en una etapa propia, con un único `G-TIENDA` | Opción recomendada | Usuario | 2026-11-14 |
| D-M16e-19 | Ranking de productos solo por unidades | Opción recomendada (A-15) | Usuario | 2026-11-14 |
| D-M16e-20 | La regla de cinco aplica solo a cohortes (por cohorte y por celda). La herramienta de cohortes del chat puede usar todo el histórico (excepción a CA-70). Se suman a la ruta `meta/oauth.ts`, el preflight, `entorno.md` y la pantalla del diagnóstico | Opciones recomendadas (A-14, A-16, A-17/A-18) | Usuario | 2026-11-14 |
| D-M16e-21 | La ruta se actualiza para todo el chat, Meta y Tiendanube: nota «Enmienda H-E1-228» en §12, que prevalece sobre DEC-11, DEC-19, CA-50, CA-50b, CA-50c y CA-66. Resuelve H-E1-234 | Opción recomendada (spec-audit-2, A-01) | Usuario | 2026-11-14 |
| D-M16e-22 | Se suman a II.14b la página y el componente del chat, `app-data` y los pgTAP `08`, `09`, `09b` y `10` | Opción recomendada (spec-audit-2, A-02) | Usuario | 2026-11-14 |
| D-M16e-23 | La ruta incorpora D-M16e-15: nota «Enmienda D-M16e-15» en §16, con salvedades en el punto 6 y en «Retención» | Opción recomendada (spec-audit-2, A-03) | Usuario | 2026-11-14 |
| D-M16e-24 | Regla completa de CA-62: Meta si el turno usó Meta; Tiendanube si solo usó la tienda; sin herramientas, Meta si está activa y, si no, Tiendanube. El modelo recibe solo las herramientas de las fuentes activas | Opción recomendada (spec-audit-2, A-07) | Usuario | 2026-11-14 |
| D-M16e-25 | Dos publicaciones en `app` antes de `G-TIENDA`: al terminar la etapa 4, con la migración 1 y antes de T-15; al terminar la etapa 5, con la migración 2 | Opción recomendada (spec-audit-2, A-08) | Usuario | 2026-11-14 |
| D-M16e-26 | Los dos `redact` marcan primero y borran después, en transacciones cortas y reanudables; `store_redact` borra por tandas. Se acepta, sin cron, el riesgo de que con los reintentos agotados los datos queden ocultos y sin credencial hasta que el dueño abra Integraciones o hasta el cierre del piloto | Opción recomendada (observación sobre la purga por webhook) | Usuario | 2026-11-14 |
| D-M16e-27 | Las funciones de privacidad sin sesión pueden marcar conexiones como desconectadas (estado, generación y credencial) y borrar; nunca activan ni devuelven datos. Amplía §17.9 de la ruta y D-M16e-14 | Opción recomendada (spec-audit-3, A-01) | Usuario | 2026-11-14 |
| D-M16e-28 | Riesgo aceptado: un aviso de desinstalación atrasado puede borrar una conexión reinstalada dentro de las 48 horas; el dueño reconecta y resincroniza | Opción recomendada (spec-audit-3, A-02) | Usuario | 2026-11-14 |

## Supuestos e hipótesis

| ID | Hipótesis y verificación |
|---|---|
| M16e-H-01 | **HIPÓTESIS:** la tienda del dueño tiene pedidos pagados, cambios posteriores e ID de cliente suficientes. Se verifica en el recorrido real (C-09), sin copiar valores. |
| M16e-H-02 | `GET /store` documenta `timezone_id` y `main_currency`. Falta verificar que vienen poblados; si falta alguno, la conexión no se activa y se informa al dueño. |
| M16e-H-03 | **HIPÓTESIS:** el incremental con 1 hora de solapamiento recupera todas las correcciones. Si la conciliación real muestra pérdidas, se registra un hallazgo y el dueño corre una resincronización completa, que ya está en el alcance (D-M16e-06). La spec no cambia. |
| M16e-H-04 | **HIPÓTESIS DECISIVA:** la app se instala en una tienda propia sin homologación. Se verifica **antes de la etapa 2**, al crear la app. Si falla, la microfase se detiene. |
| M16e-H-05 | **HIPÓTESIS:** `GET /store` responde con los tres `read_*`. Se verifica en T-15. Si responde `403`, la etapa 4 se bloquea y se decide con el usuario, sin pedir scopes de escritura. |
| M16e-H-06 | **HIPÓTESIS:** `history/values` devuelve `total_paid_diff` negativo para reembolsos. Se verifica en T-15 con un pedido reembolsado de la tienda de demostración. Hasta entonces `TN_COLLECTED_AMOUNT_ENABLED = false`. |
| M16e-H-07 | **HIPÓTESIS:** `fields` admite `customer.id`. El diseño no depende de ello: la proyección en memoria es obligatoria. |
| M16e-H-08 | **HIPÓTESIS:** pasar 10.000 pedidos da un error distinguible. El diseño no depende de ello: decide por `x-total-count`. |
| M16e-H-09 | **HIPÓTESIS:** la firma es HMAC-SHA256 en **hexadecimal**. Evidencia documental: el ejemplo oficial usa `hash_hmac` de PHP, que devuelve hexadecimal por defecto. Se implementa solo hexadecimal. **Procedimiento:** en T-15, la desinstalación de la tienda de demostración produce un `store_redact` real. El handler registra solo el booleano «firma válida». Si da falso con un webhook auténtico, se registra un hallazgo y se corrige la codificación, sin aceptar ambas. |
| M16e-H-10 | **HIPÓTESIS:** el `client_id` del canje es el mismo ID de la app que va en la URL de autorización. Se confirma en el Portal al crear la app. Si son distintos, se agrega una variable `TIENDANUBE_CLIENT_ID` antes de la etapa 2. |

## Preguntas abiertas

Ninguna. Las preguntas M16e-Q-01 a Q-06 y las decisiones que pidieron `spec-audit-1`, `spec-audit-2` y `spec-audit-3` se resolvieron el 2026-11-14 (D-M16e-04 a D-M16e-28).

## Hallazgos relacionados

- `H-E1-236` y `H-E1-237`: se resuelven en esta microfase.
- `H-E1-228`: aceptado para Tiendanube (D-M16e-13). Sigue abierto por la remedición de VR-02, que no es parte de esta microfase.
- `H-E1-234`: resuelto en la ruta por la nota «Enmienda H-E1-228» de §12 (D-M16e-21), aprobada junto con esta revisión.

Esta spec no declara resuelto ningún otro hallazgo.

## Auditorías

- [spec-audit-1](revisiones/spec-audit-1.md) (2026-11-14): REQUIERE CAMBIOS, 5 PASS y 13 FAIL. Hash auditado `3bb500bfab68632807afe45b9cb9b3ee08aa41be`. Correcciones integradas en esta revisión.

- [spec-audit-2](revisiones/spec-audit-2.md) (2026-11-14): REQUIERE CAMBIOS, 9 PASS y 9 FAIL. Hash auditado `0156a70e445d7e44558a909dd7bbbadbf1cc564f`. Correcciones integradas en esta revisión.

- [spec-audit-3](revisiones/spec-audit-3.md) (2026-11-14): REQUIERE CAMBIOS, 14 PASS y 4 FAIL. Hash auditado `51b053ce05a12137a976e312eca2c0274eaf135d`. Correcciones integradas en esta revisión.

Corresponde una cuarta auditoría sobre el hash nuevo.
