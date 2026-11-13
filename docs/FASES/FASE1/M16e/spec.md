# M16e — Conector Tiendanube y cohortes de compradores

**Estado:** BORRADOR

**Bloqueo de entrada — REQUIERE CAMBIO EN LA RUTA.** La Parte I de `meta_first/plan.md` y §2 de `meta_first/spec.md` excluyen Tiendanube y más de un proveedor. No existe ficha `M16e` en Parte I, sección en Parte II, CA heredados ni gate `G-TIENDA` aprobados. Este documento convierte la [propuesta del 2026-11-12](../meta_first/revisiones/propuesta-conectores-tiendanube-ga4-2026-11-12.md) en una spec técnica **condicional** para revisión. No habilita implementación, captura real ni cambios de la ruta. El usuario exceptuó expresamente a estas dos microfases del límite de ocho horas; el resto del contrato de `AGENTS.md` permanece vigente.

**Entrada propuesta:** `G-DIAG` de `M26a` y una enmienda aprobada de la ruta; antes de cualquier dato real, acta M03a ampliada, aprobada y comunicada al dueño. `PROJECT_STATE.md` aún informa que el plan de M26a está pendiente, por lo que esa dependencia no está cerrada. **Salida propuesta:** un único `G-TIENDA`, que habilitaría M16f. No hay aprobación de ese gate.

**Hash de contenido:** al solicitar auditoría, excluir solamente la línea `**Estado:**` y pasar los bytes restantes a `git hash-object --stdin`, como indica `docs/_templates/mf-spec.md`.

## Fuentes

- `AGENTS.md`; plantilla `docs/_templates/mf-spec.md`; HEAD leído `0e871be` más cambios preexistentes del usuario en M26a y `PROJECT_STATE.md`, que esta spec no modifica.
- Ruta vigente: `docs/FASES/FASE1/meta_first/plan.md` I.1–I.4, I.5, II.4, II.10–II.11, III.2–III.3 y III.9; `meta_first/spec.md` §§1–2, 7–11 y 14. **No hay ficha ni Parte II de M16e**: cualquier archivo previsto abajo exige enmienda explícita.
- `docs/PROJECT_STATE.md`: `G-CHAT` cerrado, M26a con spec aprobada y plan pendiente, Tiendanube pospuesta. `docs/HALLAZGOS.md`: H-E1-236 (esquema de un proveedor) y H-E1-237 (acta insuficiente); H-E1-234/H-E1-228 afectan cualquier ampliación del chat.
- `docs/SECURITY.md` §§1–9 y 12; `docs/ARCHITECTURE.md` §§«Módulos y responsabilidades», «Base de datos», «Los dos caminos de una operación», «Concurrencia» y «Ausencia de workers»; `docs/FASES/FASE1/M03a/acta-meta.md`.
- Evidencia previa: `meta_first/sesiones/M06.1a-M06.2a.md` (rol, RLS y cierre), `M06.3a.md` (cifrado), `M16.2.md` (OAuth/ciclo de vida), `M16c.md` (sync) y `M25a.md` (chat). Sus gates no prueban Tiendanube.
- Código contrastado: `supabase/migrations/0012_integrations.sql`, `0016_meta_insights.sql`, `0018_chat_queries.sql`; `src/modules/integrations/{contract,crypto,db,repository,meta}/`, `lifecycle.ts`, `actions.ts`; `src/modules/tenant/context.ts`; `src/app/(app)/app/integraciones/page.tsx`; `tests/{unit,app,component}/`, `supabase/tests/09_integration_privileges.test.sql` y `10_demo_closure.test.sql`; `package.json` y `vitest.config.mts`.
- Documentación oficial consultada el 2026-11-12: [autenticación y scopes](https://tiendanube.dev/docs-api/authentication), [Admin API y límites](https://tiendanube.dev/docs-api/getting-started), [pedido](https://tiendanube.dev/es-AR/api/resources/2025-03/order), [cliente](https://tiendanube.dev/es-AR/api/resources/2025-03/customer), [producto](https://tiendanube.dev/es-AR/api/resources/2025-03/product), [webhooks y privacidad](https://tiendanube.dev/es-AR/api/resources/2025-03/webhook), [homologación](https://tiendanube.dev/apps/publish/homologation/overview).
- Segunda lectura oficial del 2026-11-12 para completar el proceso de extremo a extremo: [versionado](https://tiendanube.dev/api/versioning), [changelog 2025-03](https://tiendanube.dev/api/resources/2025-03/CHANGELOG), [Store](https://tiendanube.dev/es-AR/api/resources/2025-03/store), [FAQ](https://tiendanube.dev/api/faq). Resultado en «Referencia de API verificada». Las páginas de variante de producto y de Transaction no cargaron (404): lo que dependa de ellas queda como hipótesis.

## Objetivo

Permitir que el dueño autorice **una tienda Tiendanube por empresa** y que PRAXA lea pedidos, líneas, identificadores mínimos de clientes y catálogo, con sincronización reanudable y borrado verificable. A partir de pedidos efectivamente pagados, mostrar cohortes de compradores y productos vendidos con definiciones, cobertura y procedencia explícitas. Esta formulación proviene de la propuesta, no de una ficha aprobada.

## Alcance

1. Generalizar los contratos y la persistencia de integraciones para que Meta y Tiendanube coexistan sin alterar los datos de Meta; mantener una conexión viva **por empresa y proveedor**. Toda migración es nueva.
2. Instalar/reautorizar la app mediante OAuth de código, confirmar tienda y scopes, guardar la credencial cifrada, gestionar revocación de acceso, desconexión y purga.
3. Leer `Store`, `Order`, `Customer` solo en los campos mínimos y `Product`/variantes mediante Admin API estable `2025-03` con `read_orders`, `read_customers` y `read_products`. No persistir respuestas crudas ni PII de contacto.
4. Backfill de pedidos/productos, incremental por actualización con solapamiento, checkpoint durable, paginación y presupuestos de tiempo/cuota; reconciliar estados de pago, cancelaciones, cambios de líneas, devoluciones y borrado de catálogo.
5. Atender los tres webhooks de privacidad obligatorios, verificar HMAC antes de procesar, deduplicar y ejecutar borrado o reporte al comerciante según la política aprobada.
6. Publicar proyecciones autorizadas y controles de UI para estado de conexión/sync, cobertura, cohortes de compradores y productos vendidos. Toda cifra se calcula en SQL/servidor y se acompaña de su definición.
7. Ejecutar pruebas sintéticas de aislamiento, permisos, precisión, lifecycle y privacidad, más un recorrido real redactado con una tienda autorizada **solo después** del acta y de las acciones reservadas.

## Fuera de alcance

Escritura de pedidos, productos, clientes, inventario, precios, scripts o webhooks operativos en Tiendanube; checkout, carrito abandonado, pagos, envíos y ERP; worker, cron, colas o sincronización programada; más de una tienda Tiendanube por empresa; distribución pública sin homologación; atribuir ventas a Meta; cohortes de sesiones GA4; unión individual entre compradores y visitas; LLM sobre datos de compradores. La ampliación del chat/diagnóstico de Meta exige enmienda separada, con el riesgo H-E1-234 resuelto o aceptado explícitamente. La app sí recibe webhooks de privacidad obligatorios: son solicitudes entrantes, no escritura de negocio en Tiendanube.

## Contexto verificado en el código

| Qué | Dónde (archivo:línea) | Implicación |
|---|---|---|
| `integration_provider` solo contiene `meta` | `supabase/migrations/0012_integrations.sql:213` | Migración nueva agrega valor; no editar `0012` |
| Índice único de conexión viva usa solo `company_id` | `supabase/migrations/0012_integrations.sql:349` | Reemplazar por índice por `(company_id, provider)` y probar coexistencia |
| Conexión e intentos tienen `default 'meta'`; K03 exige moneda/zona para activas | `supabase/migrations/0012_integrations.sql:277-349`, `:359-402`; `src/modules/integrations/contract/connection.ts:64-97` | Generalizar sin que un flujo nuevo se guarde como Meta; no inventar moneda/zona de tienda |
| Proveedor Zod y token tipo están cerrados para Meta | `src/modules/integrations/contract/primitives.ts:40`; `src/modules/integrations/contract/credential.ts:28-60` | K02–K04 deben discriminar por proveedor, preservando el contrato Meta |
| `readLiveConnection` usa `.maybeSingle()` sin filtro de proveedor; `readConnectionRecord` sí filtra Meta | `src/modules/integrations/repository/connections.ts:31-62`, `:67-83` | Generalizar la primera lectura o crear lector acotado; no romper Meta al existir dos conexiones |
| `worker_api` tiene lista cerrada de funciones, casts y errores | `src/modules/integrations/db/worker-api.ts:9-13`, `:61-101`, `:146-167` | Nuevas RPC requieren entradas tipadas, grants exactos y error redactado |
| K01 deriva actor y empresa en servidor | `src/modules/tenant/context.ts:37-43` | No aceptar `company_id` ni tienda desde navegador como autoridad |
| La purga de conexión se reemplazó al agregar chat | `supabase/migrations/0018_chat_queries.sql:196-230` | La migración nueva debe conservar firma/semántica y eliminar hijos Tiendanube antes de la conexión |
| Lifecycle y UI están acoplados a Meta | `src/modules/integrations/lifecycle.ts:122-150`, `:167-215`; `src/app/(app)/app/integraciones/page.tsx:25-38`, `:74-110` | Añadir flujo por proveedor sin reinterpretar `desconectarMeta` ni su tarjeta |
| Scripts de verificación existentes | `package.json:17-27` | `verify` no ejecuta pgTAP ni `test:app`; correrlos por separado |

## Referencia de API verificada (2026-11-12)

Fuente: documentación oficial de Tiendanube leída el 2026-11-12 (páginas «Actualizado» entre 2026-10-27 y 2026-11-12). Es el contrato de partida; cada etapa lo contrasta con respuestas reales. **«No documentado» significa que no figura en las páginas leídas y pasa a hipótesis, no a hecho.**

### Contrato HTTP y OAuth

| Tema | Valor documentado | Implicación |
|---|---|---|
| Versión | Base `https://api.tiendanube.com/2025-03/{store_id}` (equivalente `api.nuvemshop.com.br`; solo SSL). `2025-03` es «la versión estable actual y la predeterminada»; existen `v1` (legacy) y `unstable`. **No existe versión posterior.** | Constante única (como Graph v26 en Meta), verificada al implementar. Allowlist de host: solo `api.tiendanube.com`. Nunca `unstable` ni `v1` |
| Autorización | `GET https://www.tiendanube.com/apps/{app_id}/authorize?state=<state>`. **No lleva `scope` ni `redirect_uri` en la URL**: ambos se fijan en el Portal de Socios. Si el comerciante ya autorizó, el paso de permisos se omite | La app no puede pedir un subconjunto de scopes en runtime; el control es la configuración del Portal más la verificación del `scope` devuelto |
| Redirección | Redirige a la URL de redirección del Portal con `?code=…&state=…`. `code` vence a los 5 minutos. **La redirección por defecto del Portal es una URL de socios, no el callback de PRAXA** | Sin cambiarla, el comerciante cae en un login de socio. Una sola URL por app: una app de desarrollo y otra de producción |
| Canje | `POST https://www.tiendanube.com/apps/authorize/token`, `Content-Type: application/json`, cuerpo `{client_id, client_secret, grant_type:"authorization_code", code}`. Mandarlos como parámetros de URL es «un error común» | Respuesta: `access_token`, `token_type:"bearer"`, `scope` (separado por comas), `user_id` (string; en algunas respuestas se llama `store_id`) = ID de tienda. Aceptar ambos nombres, validar que sea numérico. No documentado: si el `code` es de un solo uso (se trata como de un solo uso) ni los errores del endpoint |
| Scopes | Pares `read_*`/`write_*` (`read_orders`, `read_customers`, `read_products`, …); un `write_*` implica el `read_*`. **No existe `read_store`** | Portal solo con `read_orders`, `read_customers`, `read_products`. Cambiar scopes obliga a reinstalar en cada tienda |
| Token | No expira por tiempo. Se invalida al obtener otro para la misma app y tienda, o al desinstalar. Pertenece al par app+tienda | Reinstalar rota el token (generación). La desinstalación solo se detecta por `401` o por `app/store_redact` |
| Autenticación HTTP | `Authorization: Bearer <token>` (no `Authentication`). **`User-Agent` obligatorio**: nombre de la app + enlace o email de contacto; sin él, `400 Bad Request` | El valor lo define el usuario en una variable de entorno (M16e-Q-06); el asistente no inventa un contacto |
| Cuota | Leaky bucket por app+tienda: 40 solicitudes, fuga 2/s. Headers `x-rate-limit-limit`, `x-rate-limit-remaining`, `x-rate-limit-reset` (ms hasta vaciar). `429` al excederlo. Tiendas Next/Evolution ×10. **No hay `Retry-After` ni política de reintento** | Espera calculada con `x-rate-limit-reset`, presupuesto finito |
| Paginación | `per_page` por defecto 30, máximo 200; `page` desde 1; header `x-total-count`; header `Link` con `rel` next/prev/first/last, «usar las URLs de Link» | Seguir `Link rel="next"`; usar `x-total-count` para decidir subdivisión |
| Estado de cuenta | Tienda suspendida por falta de pago: **toda llamada devuelve `402`** y los webhooks no se disparan | `402` no es revocación: estado tipado «tienda suspendida», sin purgar |
| Errores | `400` (JSON inválido o falta `User-Agent`), `402`, `415`, `422` (campos inválidos, p. ej. `fields` desconocido), `429`, `5xx` (responsabilidad del integrador reintentar). **No documentados**: cuerpo de `401` y de `404`, y el error al exceder 10.000 en pedidos | Clasificación por estado HTTP con regla «desconocido no cambia el estado de la conexión» (patrón H-04 de Meta) |

### Datos que entrega la API

| Recurso | Hechos documentados | Consecuencia |
|---|---|---|
| `GET /store` | Campos: `id`, `main_currency` (ISO 4217), `languages{código:{currency,active}}`, `country`, `original_domain`, `url_with_protocol`, `domains[]`, `plan_name`, y **`timezone_id` (zona IANA, p. ej. `America/Sao_Paulo`)**. No hay campo `timezone` a secas | Resuelve de forma documental la zona y moneda que exige K03 (sin inventarlas). El scope que habilita `GET /store` no está documentado: M16e-H-05 |
| `GET /orders` | Filtros: `since_id`, `status` (`any` por defecto, `open`, `closed`, `cancelled`), `payment_status` (`any`, `pending`, `authorized`, `paid`, `abandoned`, `refunded`, `voided`), `created_at_min/max`, `updated_at_min/max`, `customer_ids`, `fields`, `page`, `per_page`. Sin filtros, 30 resultados. **Tope de 10.000 por consulta** con «error correspondiente» sin código documentado | **`payment_status` no admite `partially_paid` ni `partially_refunded` como filtro**, aunque son valores del objeto: la extracción pide `payment_status=any` y clasifica localmente. Ver M16e-H-08 para el tope |
| Objeto `Order` | `id` (distinto de `number`), `status` (`open`/`closed`/`cancelled`), `payment_status` (`authorized`, `pending`, `paid`, `partially_paid`, `abandoned`, `refunded`, `partially_refunded`, `voided`), `created_at`/`updated_at`/`paid_at`/`closed_at`/`cancelled_at` (ISO 8601), `currency`, `subtotal`, `discount`, `discount_coupon`, `discount_gateway`, `promotional_discount`, `total`, `total_paid_by_customer`, `storefront` (`store`, `meli`, `api`, `form`, `pos`), `cancel_reason`, `is_subscription`, `is_subscription_initial`. `customer` solo se devuelve con `read_customers` | `total_paid_by_customer` «puede no coincidir con `total`» y no es neto de reembolsos garantizado. La zona de los timestamps se normaliza a `timezone_id` de la tienda para cohortes |
| Línea (`products[]`) | `id` (de la línea), `product_id`, `variant_id`, `name`, `price`, `quantity`, y datos de envío/kit. **No figura `sku` ni descuento por línea** | El SKU se obtiene de la variante por `variant_id`. El descuento solo existe a nivel pedido: no se reparte entre líneas. Un ranking por importe es «importe de lista de líneas» (precio × cantidad), nunca «ingreso neto» salvo decisión en M16e-Q-03 |
| Reembolsos | No hay endpoint de refunds. `GET /orders/{id}/history/values`: en una entrada `PAID`, `total_paid_diff` positivo es un pago y **negativo un reembolso**. «Un historial vacío no confirma que no hubo reembolsos» | Costo: una solicitud por pedido. Se consulta solo para pedidos cuyo `payment_status`/`updated_at` cambió. Campos del historial leídos de un resumen, no del texto literal: M16e-H-06 |
| `Customer` | Solo hace falta `customer.id` (viene dentro del pedido; no se llama a `GET /customers`). PII: nombre, email, teléfono, `identification` (DNI/CUIT), direcciones, `billing_*`, `note`, `extra` | `read_customers` solo habilita el objeto `customer` del pedido. No documentado si `fields=customer.id` (subcampo) funciona: M16e-H-07 |
| `Product`/variante | Producto: `id`, `name` (por idioma), `visibility` (`visible`/`unlisted`/`hidden`; desde 2026-07, `published` sigue por compatibilidad), `created_at`/`updated_at`. Variante (de ejemplos del producto): `id`, `product_id`, `sku`, `price`, `stock`. `fields` admite puntos (`variants.sku`); un campo desconocido da `422`. `GET /products` pagina hasta 200 y filtra `updated_at_min/max`. `DELETE` no documenta efectos sobre pedidos | La página de variante no cargó: los campos de variante son hipótesis hasta la prueba real. Producto borrado = ausencia en el catálogo, la línea histórica sobrevive |
| Webhooks de privacidad | Se configuran **en el Portal**, no por `POST /webhooks`. Firma: header `x-linkedstore-hmac-sha256`, HMAC-SHA256 del **cuerpo crudo** con el `client_secret` de la app (el token no es la clave). Esperan `2xx` en **3 s**; reintentos: inmediato, ~5, 10 y 15 min, luego ×1,4 hasta 48 h, **máx. 16 intentos**; sin orden garantizado y con duplicados | El handler tiene que ser rápido y sin trabajo pesado antes del `2xx`. Codificación de la firma (hex o base64) no declarada: M16e-H-09 |
| `app/store_redact` | Se envía tras la desinstalación. Payload solo `{store_id}` (sin campo `event`) | El tipo de evento se deduce de la **URL** de cada endpoint, no del cuerpo |
| `customer/redact` | Payload `{store_id, customer:{id,email,phone,identification}, orders_to_redact:[ids]}`. Si el consumidor no compró en 6 meses, se envía a los 5 días; si compró, **Tiendanube retiene el pedido hasta cumplir 6 meses** | El cuerpo trae PII: se descarta en memoria. Q-02 considera la retención de 6 meses del propio proveedor |
| `customers/data_request` | Payload `{store_id, customer, orders_requested, checkouts_requested, drafts_orders_requested, data_request:{id}}`. «Es responsabilidad de la aplicación enviar la información directamente al comerciante». **No hay plazo ni formato de respuesta documentado** | Canal definido en M16e-Q-05 antes de implementar |
| Cambios 2026 | Sin cambios de autenticación, scopes, cuota, paginación ni `GET /store`. Relevantes: `visibility` en producto (2026-07); reintentos de webhooks 16 y timeout 3 s (2026-02/07); `aggregates=custom_fields` en pedidos | Reverificar el changelog al implementar |

### Clasificación de errores propuesta (patrón CA-39 de Meta)

| Señal | Tipo | Efecto sobre la conexión |
|---|---|---|
| `401` | `credencial_invalida` | `needs_reauth` (reinstalación o desinstalación; el cuerpo no está documentado, se decide por estado HTTP) |
| `402` | `tienda_suspendida` | Sin cambio de estado; sync detenida y mensaje al dueño; no purga |
| `400` | `solicitud_invalida` | Defecto de PRAXA (falta `User-Agent` o JSON): sin cambio de estado, error visible |
| `422` | `campo_invalido` | Sin cambio de estado; ocurre si `fields` pide un campo inexistente |
| `429` | `cuota` | Espera por `x-rate-limit-reset`, presupuesto finito; agotado → ejecución incompleta |
| `5xx`, timeout, red | `transitorio` | Reintento acotado; agotado → ejecución incompleta, nunca cobertura total |
| `404` en un recurso puntual | `no_encontrado` | Para producto: marca «eliminado»; para tienda/pedido: error, sin conclusión |
| Cualquier otro | `desconocido` | Sin cambio de estado de la conexión |

### Campos extraídos y descartados (lista cerrada, tabla de evidencia de cierre)

| Recurso | Se proyecta y persiste | Se descarta siempre |
|---|---|---|
| Store | `id`, `timezone_id`, `main_currency`, `country`, `original_domain`, `url_with_protocol`, `domains` | Nombre, email, contacto, `business_*`, direcciones, redes, plan, tema |
| Order | `id`, `status`, `payment_status`, `created_at`, `updated_at`, `paid_at`, `closed_at`, `cancelled_at`, `currency`, `subtotal`, `discount`, `total`, `total_paid_by_customer`, `storefront`, `cancel_reason`, `is_subscription`, `is_subscription_initial`; `number` **solo** si M16f-Q-03 lo aprueba | `contact_*`, `billing_*`, `shipping_address`, `client_details`, `note`, `owner_note`, `extra`, `attributes`, `token`, `gateway_link`, `payment_details` |
| Línea | `product_id`, `variant_id`, `name`, `price`, `quantity` | Dimensiones, peso, `properties`, `issues` |
| Cliente | `customer.id` opaco | Todo lo demás del objeto `customer` |
| Producto/variante | `id`, `name`, `visibility`/`published`, `variants[].id`, `variants[].sku` | Descripción HTML, imágenes, SEO, categorías, precios, stock |

La petición pide el subconjunto con `fields` para no recibir lo descartado; como `fields` y los subcampos de `customer` no están verificados en listados de pedidos (M16e-H-07), **la proyección en memoria sigue siendo obligatoria** aunque el servidor devuelva de más.

### Alta de la app en el Portal de Socios (acción del usuario, sin secretos en el chat)

1. Registrarse como socio y entrar al Portal (`partners.tiendanube.com`), sección Apps, y crear la app. Confirmar en pantalla qué tipo de app corresponde a una tienda propia: la documentación indica que las apps creadas con la opción «Para Tus Clientes» no pasan por homologación, pero esa página no cargó (M16e-H-04).
2. En «Datos básicos», marcar **solo** `read_orders`, `read_customers`, `read_products`. Ningún `write_*`.
3. Completar las URL que el Portal declara obligatorias: redirección (el callback de PRAXA, no el valor por defecto), panel de administración, preferencias, política de privacidad, los tres webhooks de privacidad (`store_redact`, `customer/redact`, `customers/data_request`) y soporte (URL o email). Las rutas exactas las fija el plan.
4. Crear una tienda de demostración en el Portal e instalar la app ahí para las pruebas (la FAQ lo indica; no documenta los pasos). Para la tienda real, el dueño instala con el mismo flujo OAuth: «ser propietario no evita la autorización».
5. Cargar `client_id`, `client_secret` y el valor de `User-Agent` solo en `.env.local` y Vercel. Una app y una redirección por entorno (desechable y `app`).

## Diseño concreto propuesto

### 1. Identidad, conexión y OAuth

El inicio autenticado construye K01 con `requireTenantContext()`, exige rol dueño y crea un K02 de propósito `initial` o `reauth`, vinculado a actor, empresa, navegador, proveedor y generación esperada. El `state` y nonce tienen al menos 32 bytes aleatorios, se guardan solo sus hashes y el intento se consume atómicamente una sola vez. La autorización es `GET https://www.tiendanube.com/apps/{app_id}/authorize?state=<state>`: sin `scope` ni `redirect_uri` en la URL (se fijan en el Portal). El callback de Tiendanube recibe `code` y `state` y redirige enseguida a ruta limpia con `Referrer-Policy: no-referrer`. El código vence a los 5 minutos según el proveedor; PRAXA no lo guarda ni lo registra. El canje es `POST https://www.tiendanube.com/apps/authorize/token` con cuerpo JSON, nunca en URL. `user_id` (o `store_id`) devuelto identifica la tienda. El servidor exige que `scope` sea **exactamente** `read_customers,read_orders,read_products` en cualquier orden: cualquier `write_*` o scope ajeno rechaza la conexión y destruye el token, porque el MVP es de lectura. Confirma la tienda con `GET /store` comparando `id` con `user_id`, sin fiarse de ningún dato del navegador, y toma de ahí `timezone_id` y `main_currency` para K03. El token no tiene expiración temporal informada; pasa a inválido por reinstalación/desinstalación. Se cifra con el llavero AES-GCM existente y AAD de empresa/conexión/**tiendanube**; el tipo de credencial se agrega mediante unión discriminada, sin debilitar `system_user` de Meta. [Contrato OAuth](https://tiendanube.dev/docs-api/authentication).

Una instalación produce `pending_selection` solo mientras se confirma la tienda y la configuración; se activa tras comprobarla, sin pedir seleccionar un recurso que OAuth ya identificó. Un intento vencido o un error posterior al canje no deja una credencial durable sin vía de purga. Una reinstalación o reautorización sustituye la credencial solo si la generación de la conexión aún coincide; cualquier extracción en vuelo pierde posesión. El dueño puede desconectar Tiendanube sin afectar Meta. La app deja de leer la tienda de inmediato, destruye la credencial y los datos de esa conexión mediante purga idempotente. No se presupone un endpoint remoto de revocación del token Tiendanube: la desinstalación la hace el dueño en el proveedor; PRAXA borra su copia local.

### 2. Esquema y privilegios previstos

Los nombres siguientes designan **objetos propuestos nuevos**, no existentes: `private.tn_sync_runs`, `private.tn_orders`, `private.tn_order_lines`, `private.tn_customers`, `private.tn_products`, `private.tn_product_variants`, `private.tn_privacy_requests` y `private.tn_redaction_suppressions`; `public.tn_sync_status`, `public.tn_buyer_cohorts` y `public.tn_product_sales` como proyecciones de lectura. Cada fila operacional tiene `company_id`, `connection_id` y clave externa de tienda en columnas tipadas, FK compuesta a su conexión, `ON DELETE CASCADE` donde corresponda, RLS habilitada y forzada, `REVOKE ALL` explícito. `authenticated` lee solo proyecciones cerradas por membresía, conexión visible y período; `anon`, `PUBLIC`, `service_role` y rol de integraciones no reciben lectura directa. `praxa_integrations` ejecuta exclusivamente RPC acotadas en `worker_api`; cada RPC verifica actor/empresa/conexión y proveedor dentro de SQL. La matriz exacta y firmas se fijarán en la enmienda y en el encabezado de la migración nueva con pgTAP correspondiente. **REQUIERE CAMBIO EN LA RUTA** antes de cualquier SQL.

`tn_orders` guarda ID de pedido, `customer.id` opcional, timestamps, estado del pedido y del pago, moneda, importes decimales como `numeric`, marcas de reembolso/cancelación y versión de origen. `tn_order_lines` guarda ID de producto/variante, nombre, cantidad y precio unitario de la línea en el momento del pedido; no se recalcula con el precio actual. La documentación no expone descuento por línea (solo a nivel pedido), así que no se inventa un reparto. `tn_products`/variantes guardan nombre comercial, SKU opcional, visibilidad y metadata mínima para enlazar líneas, sin descripción HTML ni imágenes si no son necesarias. `tn_customers` guarda únicamente el identificador opaco de Tiendanube para deduplicar compradores; no almacena email, nombre, teléfono, documento, direcciones, notas ni `extra`. No se guarda JSON bruto de Order/Customer/Store. Las proyecciones publicables usan referencias internas y **no** exponen IDs externos ni filas de comprador. La retención y la supresión tras `customer/redact` dependen de M16e-Q-02.

### 3. Extracción y publicación

La API se fija a `2025-03`. Solo se envían métodos `GET` al host `api.tiendanube.com` y a paths permitidos, con `Authorization: Bearer` y `User-Agent` obligatorio (sin él, `400`) en headers; no incluir token en URL, logs ni errores. Los errores se clasifican según la tabla de «Referencia de API verificada». Por defecto se piden páginas de hasta 200 elementos; se usa `per_page=200` y se sigue `Link rel="next"` en lugar de construir URLs, se valida estructura, unicidad de ID entre páginas y coherencia de `store_id`. El límite documentado es bucket 40, drenaje 2/s por pareja app/tienda; `429` se reintenta esperando según `x-rate-limit-reset` (no hay `Retry-After`) y con presupuesto finito. La lista de pedidos tiene tope de 10.000 por consulta con un error sin código documentado: el backfill divide por ventanas de `created_at` y **antes de paginar** lee `x-total-count` de la primera página; si es ≥ 10.000 subdivide la ventana sin esperar el error, hasta terminar o registrar fallo **sin** publicar cobertura completa. La lista se pide con `payment_status=any` y `status=any` porque el filtro de pago no admite los estados `partially_*`; la elegibilidad se decide localmente. El incremental usa `updated_at` con solapamiento y desempate por ID para no perder empates; se comprueba con fixtures de páginas reordenadas. [Límites](https://tiendanube.dev/docs-api/getting-started), [filtros de pedidos](https://tiendanube.dev/es-AR/api/resources/2025-03/order).

Cada ejecución manual obtiene lease y token de posesión ligados a conexión y generación de credencial. Un paso procesa una ventana acotada para no exceder el tiempo configurado de Vercel; guarda checkpoint solo tras publicar pedidos y líneas de la página/ventana en una transacción. Reintentar la misma ventana hace upsert por `(connection_id, external_order_id)` y reemplazo íntegro de líneas del pedido sin duplicados. Las capturas históricas de una corrida completa quedan distinguibles del estado actual; no se declara «sin pedidos» cuando hubo error o página faltante. Una corrida desplazada por desconexión/reautorización no escribe. El cierre de cada etapa documentará límites de páginas, tiempo, payload y número de ventanas medidos en el desechable y contrastados con la tienda real; no se inventa una cota de producción desde el escritorio.

`order/created` no acredita pago. El cálculo conserva por separado `status` y `payment_status`, y usa el estado corriente recuperado por GET, incluidos cambios a `paid`, `partially_paid`, `refunded`, `partially_refunded`, `voided` y `cancelled`. Una línea histórica sobrevive a la eliminación posterior del producto en el catálogo. Cero real, ausencia de pedido y ventana no cubierta son tres resultados distintos. Toda métrica monetaria incluye moneda; una conversión de divisas queda fuera hasta decisión de negocio. El orden y la fórmula exactos de elegibilidad, reembolsos y cohortes están en M16e-Q-03, no se ocultan bajo una etiqueta «ventas».

### 4. Privacidad, borrado y seguridad de webhooks

Las URLs `app/store_redact`, `customer/redact` y `customers/data_request` se configuran en el Portal de Socios por el usuario. El handler recibe un cuerpo acotado, verifica `x-linkedstore-hmac-sha256` con el secreto de app **antes** de parsear, comparar en tiempo constante, y nunca registra cuerpo ni PII. Tiendanube espera `2xx` en **3 s** y reintenta hasta 16 veces en 48 h, sin orden garantizado y con duplicados, por lo que el handler solo valida, registra de forma durable y responde; el efecto de borrado se aplica en la misma petición si cabe en el presupuesto y, si no, queda `pending` y **bloquea cualquier sincronización** de esa tienda hasta aplicarse. Cada endpoint corresponde a un único tipo de evento (`store_redact` no trae campo `event`). Deduplica por una clave derivada **sin PII** (tipo + `store_id` + `customer.id` + IDs de pedido ordenados, o `data_request.id`), nunca por un hash del cuerpo completo, que contiene email, teléfono y documento; esos campos se descartan en memoria. Para una tienda sin conexión viva responde `2xx` sin revelar su existencia. Responde 2xx solo después de registrar una orden durable o completar el efecto. Una solicitud de borrado prevalece sobre cualquier sincronización en vuelo y evita reimportar el dato suprimido. Se prueba la llegada repetida, fuera de orden, firma inválida, tienda no conectada y conexión reinstalada. [Contrato de webhooks](https://tiendanube.dev/es-AR/api/resources/2025-03/webhook).

`store_redact` destruye credencial y todos los datos de esa tienda. `customer/redact` elimina vínculo del cliente y los pedidos/lineas especificados o los desidentifica **solo según la política M16e-Q-02 aprobada**; actualiza cohortes y cobertura, y deja una marca mínima de supresión para que un backfill no los importe otra vez. `customers/data_request` arma un reporte limitado a lo que PRAXA conserva y lo entrega por un canal autenticado al comerciante, definido antes de implementar; nunca envía PII a una dirección del webhook sin verificar. La marca de supresión y su retención son también datos potencialmente personales y entran en el acta. Si no se puede cumplir este circuito, no se conecta una tienda real.

### 5. Análisis y UI

Los agregados se calculan en SQL/servidor con fuente `tiendanube`, ventana, zona de la tienda, moneda, versión de fórmula, cobertura y fecha de última sincronización. `tn_buyer_cohorts` agrupa por mes de **primera compra elegible** y mes N de repetición; excluye pedidos sin `customer.id` de la cohorte y muestra proporción excluida. `tn_product_sales` clasifica producto/variante por unidades de líneas elegibles y, solo cuando reembolsos/descuentos estén definidos, por importe; conserva «producto eliminado» como entidad histórica. Los conteos únicos y ratios usan denominadores explícitos y no mezclan monedas. Una UI separa conexión, estado de extracción, cobertura, cohortes y ranking; no presenta un vacío como cero. En esta microfase el chat y M26a no consumen todavía los nuevos agregados.

## Archivos previstos

**Todos los archivos de implementación de esta tabla son condicionales: la ruta actual no contiene Parte II de M16e y, por ello, la columna de autorización dice `REQUIERE CAMBIO EN LA RUTA`.** La enmienda deberá enumerarlos antes de aprobar esta spec. No se fija ahora el número de migración: el último número existente se comprueba al implementarla.

| Archivo o grupo exacto | Nuevo o modificado | Para qué | Autorizado por |
|---|---|---|---|
| `docs/FASES/FASE1/meta_first/{plan,spec}.md` | Modificados | Ficha, II, CA, gates, privacidad y dependencias | REQUIERE CAMBIO EN LA RUTA |
| `docs/FASES/FASE1/M16e/{spec,plan}.md` | Nuevo/por crear | Contrato y plan de ejecución | REQUIERE CAMBIO EN LA RUTA |
| `docs/FASES/FASE1/M03a/acta-meta.md`; `docs/SECURITY.md`; `docs/ARCHITECTURE.md`; `docs/PROJECT_STATE.md`; `docs/HALLAZGOS.md` | Modificados según condición documental | Datos reales, fronteras, estructura, estado y hallazgos | REQUIERE CAMBIO EN LA RUTA |
| `supabase/migrations/<siguiente>_tiendanube.sql`; `supabase/tests/<siguiente>_tiendanube.test.sql`; `supabase/tests/09_integration_privileges.test.sql`; `supabase/tests/10_demo_closure.test.sql` | Nuevos/modificados | Esquema, grants, aislamiento, cierre | REQUIERE CAMBIO EN LA RUTA |
| `src/modules/integrations/contract/{primitives,oauth-attempt,connection,credential}.ts`; `src/modules/integrations/db/worker-api.ts`; `src/modules/integrations/repository/{connections,credentials,attempts,lifecycle-calls}.ts` | Modificados | Contratos por proveedor, whitelist SQL y repositorios | REQUIERE CAMBIO EN LA RUTA |
| `src/modules/integrations/tiendanube/` ; `src/app/api/integraciones/tiendanube/` | Nuevos | Cliente, OAuth, extractor y handlers de privacidad | REQUIERE CAMBIO EN LA RUTA |
| `src/modules/integrations/lifecycle.ts`; `src/modules/integrations/actions.ts`; `src/app/(app)/app/integraciones/` | Modificados/nuevos | Lifecycle y UI Tiendanube sin romper Meta | REQUIERE CAMBIO EN LA RUTA |
| `.env.example`; `tests/unit/`; `tests/app/`; `tests/component/`; `package.json` y lockfile **solo si hay dependencia** | Modificados/nuevos | Variables vacías y pruebas con fixtures sintéticos | REQUIERE CAMBIO EN LA RUTA |
| `docs/FASES/FASE1/meta_first/sesiones/M16e.md`; `docs/FASES/FASE1/M16e/revisiones/` | Nuevos | Evidencia y auditorías | REQUIERE CAMBIO EN LA RUTA |

Las rutas de directorio anteriores no inventan archivos ya existentes: los archivos nuevos concretos se enumerarán en el plan, una vez aprobada la enmienda. Una necesidad adicional durante implementación detiene la microfase y vuelve a la ruta.

## Criterios de aceptación

### Heredados de la ruta

| ID de la ruta | Qué exige |
|---|---|
| — | **Ninguno aún para M16e.** La ruta vigente la excluye. Los criterios operativos de abajo son propuestas verificables y no reemplazan CA/DEC aprobados. Se aplican los transversales CB-01 a CB-06 de `meta_first/spec.md` §14 solo si la enmienda incorpora esta microfase. |

### Operativos de esta microfase

| ID | Criterio verificable propuesto | Traza |
|---|---|---|
| M16e-C-01 | Meta y Tiendanube coexisten en una empresa; dos tiendas Tiendanube vivas no; SQL y K02–K04 coinciden en proveedor y no degradan Meta | H-E1-236; DEC-03/04; ruta por enmendar |
| M16e-C-02 | OAuth de un uso vinculado a dueño/empresa/navegador; `code` no persiste; tienda y scopes se comprueban antes de activar | K01/K02; OAuth oficial; ruta por enmendar |
| M16e-C-03 | Credencial cifrada con AAD de Tiendanube; reinstalación, reauth y desconexión preservan generación y purgan sin filtrar token | K04; DEC-09; ruta por enmendar |
| M16e-C-04 | Backfill e incremental recorren todas las páginas/ventanas con presupuesto, sin duplicar, perder cambios o declarar cobertura ante fallo | Admin API; DEC-05/CA-58/59 como patrón; ruta por enmendar |
| M16e-C-05 | Pedidos y líneas reflejan pagos/ediciones/reembolsos/cancelaciones; moneda, zona y procedencia visibles; sin PII ajena al ID mínimo | Order/Customer; H-E1-237; ruta por enmendar |
| M16e-C-06 | Las tres solicitudes de privacidad se autentican, deduplican y producen borrado/exportación comprobable; no se reimporta un dato suprimido | Webhooks oficiales; H-E1-237; ruta por enmendar |
| M16e-C-07 | Cohortes de primera compra elegible y ranking de producto se reproducen desde pedidos y muestran exclusiones/cobertura; cero y ausencia son distintos | Objetivo propuesto; M16e-Q-03; ruta por enmendar |
| M16e-C-08 | `anon` y otra empresa no acceden; el rol acotado carece de lectura directa; purga y cierre dejan cero datos de la tienda | INV-01/04; CA-67/68 como patrón; ruta por enmendar |
| M16e-C-09 | Recorrido real con al menos un pedido pagado y un cambio posterior de estado queda documentado sin valores ni IDs; sin él no se acredita funcionamiento real | CB-05/06; ruta por enmendar |
| M16e-C-10 | El cliente HTTP envía siempre `Authorization: Bearer` y `User-Agent`, solo a `api.tiendanube.com` y versión `2025-03`; clasifica cada error según la tabla de la referencia (desconocido no cambia la conexión; `402` no purga); pide solo los campos de la lista cerrada y descarta el resto en memoria | Referencia de API verificada; H-04 de Meta como patrón; ruta por enmendar |

## Casos de prueba

| ID | Criterios | Tipo | Comando | Resultado esperado | ¿Falla sin implementación? |
|---|---|---|---|---|---|
| M16e-T-01 | C-01/C-08 | pgTAP + app | `npm run test:policies`; `npm run test:app` | Dos empresas y dos proveedores aislados; catálogo de grants exacto | Sí |
| M16e-T-02 | C-02 | unit + app | `npm run verify`; `npm run test:app` | Replay, vencido, navegador/actor/empresa ajenos y scopes faltantes rechazados; callback limpio | Sí |
| M16e-T-03 | C-03 | unit + app | `npm run verify`; `npm run test:app` | Token alterado no descifra; reinstalación cambia generación; sync viejo no escribe; purga repetida segura | Sí |
| M16e-T-04 | C-04 | unit + app | `npm run verify`; `npm run test:app` | Páginas con 200/201 elementos, 429, 5xx, ventana >10.000, empate `updated_at`, ID repetido y reinicio no pierden ni duplican | Sí |
| M16e-T-05 | C-05/C-07 | pgTAP + app | `npm run test:policies`; `npm run test:app` | Pendiente→pagado→reembolsado, líneas editadas, invitado y producto borrado cambian agregados según fórmula aprobada | Sí |
| M16e-T-06 | C-06 | unit + app | `npm run verify`; `npm run test:app` | HMAC inválido/replay/tienda ajena rechazados; redact y data_request idempotentes; backfill no reimporta | Sí |
| M16e-T-07 | C-08 | pgTAP + app | `npm run test:policies`; `npm run test:app` | Conexión ajena, acceso Data API, cascada y cierre sin filas huérfanas | Sí |
| M16e-T-08 | C-07/C-09 | component + manual | `npm run verify`; recorrido manual | UI distingue cobertura, vacío y cero; cohorte/ranking concuerdan con tienda real de forma redactada | No para recorrido real; sí para componente |
| M16e-T-09 | C-01–C-10 | integración | `npm run db:check:test`; `npm run verify`; `npm run test:policies`; `npm run test:app`; `git diff --check` | Controles completos, sin omisiones requeridas ni migraciones antiguas editadas | Según control |
| M16e-T-10 | C-10 | unit | `npm run verify` | Falta de `User-Agent` imposible por construcción; host o versión fuera de la allowlist rechazados; `401/402/422/429/5xx/404`/desconocido producen su tipo y efecto; un pedido con `contact_*`, `billing_*` y `customer` completo se proyecta sin esos campos y no se persiste ni se registra | Sí |

## Verificación

`npm run db:check:test` antes de tocar el desechable; `npm run db:push:test` es acción reservada al usuario; después `npm run verify`, `npm run test:policies` y `npm run test:app` completos en cada etapa con SQL o comportamiento nuevo. `npm run verify` incluye lint, typegen, typecheck, unit/component y build, pero no las dos suites restantes. Se revisan diff, esquema expuesto, ausencia de secretos/PII e integridad del cierre. Los ensayos automatizados usan solo el proyecto desechable y datos sintéticos; en `app` únicamente recorrido manual acotado después de aprobación. Toda prueba requerida omitida cuenta como no ejecutada (CB-06). Una prueba real sin filas no valida mapeo de campos. No se afirma que esta verificación ya haya ocurrido.

## Intervenciones del usuario y acciones reservadas

| Paso | Qué hace el usuario | Cómo se verifica después |
|---|---|---|
| Ruta | Decidir M16e-Q-01–Q-05 y aprobar enmienda, acta, spec y plan auditados | Textos coordinados y `PROJECT_STATE.md` actualizado solo tras la decisión |
| Portal Tiendanube | Seguir «Alta de la app en el Portal de Socios» (scopes solo de lectura, redirección propia, URLs de privacidad y soporte); cargar ID, secreto y `User-Agent` en `.env.local` y Vercel sin compartir valores | Preflight local de presencia y configuración redactado; callback simulado |
| Datos reales | Acordar y comunicar al dueño el tratamiento; autorizar instalación y prueba en su tienda | Acta aprobada y recorrido con evidencia sin valores reales |
| Base | Ejecutar guardas y `db:push:test` cuando el plan lo pida; después de pruebas, `db:push` en `app` | Historial de migraciones y suites en desechable; lectura efectiva en app |
| Publicación | Commit, push, despliegue y aprobación final de `G-TIENDA` si procede | Versión publicada y recorrido real redactado |

## Trampas y riesgos

- El índice global y `.maybeSingle()` sin proveedor fallan con dos conexiones, aunque se amplíe solo el enum.
- El `token_type='system_user'`, `REQUIRED_SCOPE='ads_read'`, metadata obligatoria de moneda/zona y ramas de `lifecycle.ts` están diseñados para Meta; generalizarlos sin discriminante debilitaría ambos flujos.
- El callback de Tiendanube entrega código a una URL de entrada; Vercel puede registrar la consulta entrante. La app no registra ni vuelve a emitir código o `state`.
- `order/created` incluye pedidos impagos. `order/updated` puede duplicar eventos específicos; aquí la lectura incremental, no el webhook operativo, es autoridad de estado.
- Páginas grandes, 10.000 resultados, cuotas y límite de ejecución de Vercel requieren reanudación; un timeout no equivale a cobertura completa.
- El payload Order/Customer contiene datos personales, incluidos documentos y direcciones. Proyección en memoria y pruebas de no persistencia son obligatorias.
- Un `customer/redact` posterior al backfill puede reimportarse si no hay supresión duradera. La forma y retención de esa supresión requieren el acta.
- La instalación en una sola tienda no prueba homologación ni disponibilidad pública.
- La redirección por defecto del Portal no es el callback de PRAXA; si no se cambia, el comerciante llega a un login de socio.
- Filtrar pedidos por `payment_status=paid` perdería `partially_paid` y `partially_refunded`, que la API no admite como filtro. Se trae todo y se clasifica localmente.
- Faltar el `User-Agent` produce `400` y parece un fallo de credenciales; el cliente lo agrega por construcción.
- Reinstalar la app (por cambio de scopes o por el dueño) genera otro token e invalida el anterior sin aviso: la próxima llamada da `401`.
- Una tienda suspendida por falta de pago responde `402` a todo: no es una desinstalación y no debe purgar datos.
- Los webhooks de privacidad no traen campo `event` en `store_redact`, tardan hasta 5 días en `customer/redact` y expiran a los 3 s: el handler debe ser corto y su efecto, idempotente.
- El importe de una línea no incluye descuentos (solo existen a nivel pedido) y `total_paid_by_customer` no es neto de reembolsos: ninguna etiqueta «ingreso neto» sin definición aprobada.

## Decisiones de la microfase

| ID | Decisión | Motivo | Decidió | Fecha |
|---|---|---|---|---|
| D-M16e-01 | Preparar una spec `BORRADOR` para Tiendanube, sin límite de ocho horas | Pedido expreso de investigar y convertir la propuesta en spec | Usuario | 2026-11-12 |
| D-M16e-02 | Mantener read-only para operaciones de negocio externas; modelar los webhooks de privacidad como solicitudes entrantes obligatorias | Non-negotiables de `AGENTS.md` y documentación oficial | Contrato vigente del proyecto; propuesta técnica del asistente pendiente de aprobación | 2026-11-12 |
| D-M16e-03 | Completar la spec con la referencia de API verificada contra la documentación oficial vigente, la lista cerrada de campos, la clasificación de errores y el alta en el Portal | Pedido del usuario de investigar el proceso completo para extraer datos por API, como se hizo con Meta | Usuario (pedido); contenido del asistente pendiente de aprobación | 2026-11-12 |

## Supuestos e hipótesis

| ID | Hipótesis y verificación |
|---|---|
| M16e-H-01 | **HIPÓTESIS:** la tienda del dueño tiene pedidos pagados, cambios posteriores e ID de cliente suficientes. Verificar con preflight/recorrido real, sin copiar valores a evidencia, antes de `G-TIENDA`. |
| M16e-H-02 | La documentación de Store **sí** define `timezone_id` (IANA) y `main_currency`. Falta verificar contra la tienda real que ambos vienen poblados y que `languages[].currency` no introduce una segunda moneda de venta; cada pedido trae su `currency`. Si falta alguno, pedir configuración explícita del dueño, no inventarla. |
| M16e-H-03 | **HIPÓTESIS:** las ventanas por fecha y `updated_at` recuperan todas las correcciones históricas necesarias. Verificar con fixtures adversarios y conciliación real; si la API no ofrece garantía suficiente, sumar reconciliación periódica manual en la spec aprobada. |
| M16e-H-04 | **HIPÓTESIS:** la app del piloto puede instalarse sin homologación pública. Confirmarlo en el Portal de Socios con el usuario antes del recorrido real; la documentación de homologación solo acredita el camino de publicación general. La misma página indica que las apps creadas con la opción «Para Tus Clientes» no pasan por homologación, pero el enlace a esa sección devuelve 404; no se sabe cómo se crea una tienda de demostración. |
| M16e-H-05 | **HIPÓTESIS:** `GET /store` responde con solo `read_orders`, `read_customers` y `read_products` (no existe `read_store` y la documentación no indica qué scope lo habilita). Verificar en la tienda de demostración antes de cerrar la etapa OAuth; si responde `403`, bloquear y decidir con el usuario, sin pedir scopes de escritura. |
| M16e-H-06 | **HIPÓTESIS:** `GET /orders/{id}/history/values` devuelve `status`, `total_paid_diff` y `happened_at` como describe el resumen leído (el texto literal de esa sección no se pudo leer). Verificar con un pedido reembolsado real o de demostración; hasta entonces el monto reembolsado no se usa en ninguna métrica monetaria. |
| M16e-H-07 | **HIPÓTESIS:** `fields` en `GET /orders` admite subcampos (`customer.id`) y omite `contact_*`, `billing_*` y `shipping_address`. Solo hay un ejemplo (`fields=id,number,price_usd`); el listado de productos sí admite puntos. Verificar con la tienda de demostración; el diseño no depende de ello porque la proyección en memoria es obligatoria. |
| M16e-H-08 | **HIPÓTESIS:** al exceder 10.000 pedidos la API devuelve un error distinguible y no una página truncada en silencio. El diseño evita depender de ello (decide por `x-total-count`); medirlo en la tienda de demostración o con ventanas sintéticas. |
| M16e-H-09 | **HIPÓTESIS:** la firma `x-linkedstore-hmac-sha256` es el HMAC-SHA256 en hexadecimal del cuerpo crudo con `client_secret`. La documentación da un ejemplo PHP sin declarar la codificación. Verificar con un webhook real de la tienda de demostración antes de aceptar una codificación; no aceptar ambas «por si acaso». |

## Preguntas abiertas

| ID | Pregunta | Opciones | Recomendación | Evidencia |
|---|---|---|---|---|
| M16e-Q-01 | **REQUIERE CAMBIO EN LA RUTA.** ¿Se inserta M16e tras `G-DIAG` y antes de la demo, con `G-TIENDA`, ficha, Parte II, CA y archivos previstos? | Ampliar piloto actual / ruta sucesora después de `G-DEMO` | Ampliar piloto si el dueño dispone de tienda real y acepta la nueva demo; de otro modo ruta sucesora | `meta_first/plan.md` I.1–I.3; `meta_first/spec.md` §2 |
| M16e-Q-02 | ¿Qué se conserva o elimina al recibir `customer/redact`, y por cuánto tiempo se conserva una marca mínima para evitar reimportación? | Borrar pedidos/líneas afectados y recalcular / desidentificar importes conservando venta; definir retención de supresión | Borrar datos afectados y marcar exclusión de cobertura hasta aprobar política más granular | Webhook oficial: `customer/redact` llega a los 5 días si no hubo pedido en 6 meses, y si lo hubo Tiendanube retiene el pedido hasta cumplir 6 meses; el cuerpo trae email, teléfono y documento; H-E1-237; acta M03a actual |
| M16e-Q-03 | ¿Qué pedido cuenta como venta y cómo se tratan pago parcial, reembolso, cancelación, suscripción, descuentos y moneda? | Solo pagado no reembolsado / importe efectivamente cobrado con ajustes / otras reglas explícitas | Definir dos métricas: pedidos pagados elegibles y monto cobrado ajustado solo si se valida; separar monedas | Order `payment_status` (ocho valores; el filtro de la API no admite `partially_*`), `total_paid_by_customer` (no neto garantizado), reembolso solo por historial de valores, descuento solo a nivel pedido, `storefront`, `is_subscription`; propuesta §3 |
| M16e-Q-04 | ¿Cuál es la ventana inicial de backfill y la cadencia manual de reconciliación? | Histórico completo en pasos / ventana fija con ampliación posterior | Histórico completo por pasos reanudables, con cotas medidas y sin cron | Tope 10.000 por consulta; ruta excluye workers |
| M16e-Q-05 | ¿Cómo se entrega `customers/data_request` al comerciante y qué mínimo de grupo se muestra en cohortes? | Descarga autenticada / envío controlado; umbral fijo o configurable | Descarga autenticada al dueño, sin correo con PII; ocultar grupos pequeños tras fijar umbral en acta | Webhook oficial: la app debe enviar la información «directamente al comerciante», sin plazo ni formato documentados; `SECURITY.md` modelo de datos |
| M16e-Q-06 | ¿Qué contacto va en el `User-Agent` obligatorio y cuántas apps del Portal se crean? | Buzón de soporte de la app / email personal; una app por entorno / una sola | Buzón de soporte dedicado (no un email personal); una app de desarrollo y otra de producción porque la URL de redirección es única por app | Getting-started oficial: `User-Agent` obligatorio con «email o enlace»; sin él, `400` |

## Hallazgos relacionados

`H-E1-236`, `H-E1-237`; `H-E1-234` y `H-E1-228` solo si se solicita exponer Tiendanube al chat/diagnóstico. Ninguno se declara resuelto por esta spec.

## Auditorías

No hay auditoría de esta spec. Ejecutar `$spec-auditor M16e` después de aprobar la enmienda de ruta y resolver las preguntas abiertas. La auditoría debe contrastar la versión exacta mediante el hash de contenido.
