# M16f — Conector GA4 y comparación entre fuentes

**Estado:** APROBADA por el usuario el 2026-11-15, **con excepción expresa: sin una `spec-audit` APROBABLE**. La última, `spec-audit-6`, dio REQUIERE CAMBIOS, y sus correcciones A-01 a A-03 no se volvieron a auditar (el hash de la spec ya no coincide con el de esa auditoría). El usuario lo exceptuó dos veces el 2026-11-15: al aprobar la spec y al pedir la auditoría del plan («no importa es una excepcion, audita M16f plan»; `revisiones/plan-audit-2.md` a `plan-audit-4.md`). Igual que en M16e, esta excepción reemplaza la regla de `docs/_templates/mf-spec.md` y la precondición de `/microfase` que exige una `spec-audit` APROBABLE con hash coincidente: **no bloquea el inicio de M16f**. El hash de la spec antes de la enmienda correctiva es `219be9dbd53295bc1e0d16d5e0fe6c6b50f7d137`, el que cita `plan-audit-4` APROBABLE; la enmienda de numeraci?n H-E1-262 fue aprobada expresamente por el usuario el 2026-11-16. Riesgo aceptado: un error introducido al corregir puede aparecer recién al implementar; si pasa, se registra como hallazgo y se corrige la spec antes de seguir. Sigue pendiente A-04 de `spec-audit-6` (`npm run verify` con exit 0), como control previo al código en el paso 0a del plan.

**Entrada:** la ruta incluye `M16f` desde la [enmienda de conectores](../meta_first/sesiones/enmienda-conectores-2026-11-14.md), aprobada por el usuario el 2026-11-14 (ficha en la Parte I y II.14c de `meta_first/plan.md`; §17 de `meta_first/spec.md`). `G-TIENDA` está aprobado (2026-11-15) y `PROJECT_STATE.md` habilita `M16f`. Como exige la ficha, **spec, plan y acta M03a ampliada se aprueban antes de la primera línea de código**, y el acta se comunica al dueño antes del primer dato real de GA4. La ficha exceptúa esta microfase del límite de ocho horas, que además el usuario retiró de `AGENTS.md` el 2026-11-15 (H-E1-261); el resto del contrato de `AGENTS.md` sigue vigente. **Salida:** un único `G-GA4-FUSION`, que habilita `M28.3a` junto con `G-CHAT`, `G-ANOMALIES`, `G-DIAG` y `G-TIENDA`.

**Revisión del 2026-11-15:** reescrita contra la ruta enmendada y el código entregado por M16e, con las correcciones de [spec-audit-1](revisiones/spec-audit-1.md) (A-01 a A-14) y las decisiones D-M16f-02 a D-M16f-11 del usuario. Las decisiones que cambian la ruta (D-M16f-06, D-M16f-09 y D-M16f-10) se aplicaron en `meta_first/plan.md` (ficha e II.14c), `meta_first/spec.md` (§17.11) y `AGENTS.md`. Después se integraron las correcciones de [spec-audit-2](revisiones/spec-audit-2.md) (A-01 a A-14), con las decisiones D-M16f-12 (excepción de CA-70 para `ga4_cohortes`, agregada a §17.11) y D-M16f-13 (H-E1-241 en los controles). Después, las de [spec-audit-3](revisiones/spec-audit-3.md) (A-01 y A-03 a A-11); A-02 lo resolvió el usuario (H-E1-261). Por último, las de [spec-audit-4](revisiones/spec-audit-4.md) (A-01 a A-05). Tras [spec-audit-5](revisiones/spec-audit-5.md), el usuario pidió corregir A-05 a A-01. **Tras [spec-audit-6](revisiones/spec-audit-6.md), pidió corregir A-01 a A-03; A-04 (`verify` sin exit 0) sigue pendiente.**

**Hash de contenido:** al solicitar auditoría, excluir solamente la línea `**Estado:**` y pasar los bytes restantes a `git hash-object --stdin`, como indica `docs/_templates/mf-spec.md`.

## Fuentes

- `AGENTS.md`; plantilla `docs/_templates/mf-spec.md`. Primera redacción sobre HEAD `0e871be` (2026-11-12); esta revisión, sobre `9af2139` (rama `docs/cierre-m16e`).
- Ruta vigente: `docs/FASES/FASE1/meta_first/plan.md` I.1–I.4 (ficha `M16f`), II.14b, II.14c, III.2, III.3 y III.9; `meta_first/spec.md` §§1–2, 7–12, 14, 16 y 17 (incluida §17.11, CA enmendados para GA4 por esta microfase).
- `docs/PROJECT_STATE.md`: `G-TIENDA` aprobado el 2026-11-15; `M16f` es la siguiente habilitada. `docs/HALLAZGOS.md`: H-E1-236 y H-E1-237 (resueltos para Tiendanube, pendientes para GA4), H-E1-238 (alcance decidido por D-M16f-02), H-E1-234 (resuelto en la ruta) y H-E1-228.
- `docs/FASES/FASE1/M16e/spec.md` (APROBADA): patrón de proveedor, OAuth, purga, chat, diagnóstico y excepciones expresas que esta spec reutiliza.
- `docs/SECURITY.md` §§1–9 y 12; `docs/ARCHITECTURE.md` §§«Módulos y responsabilidades», «Base de datos», «Los dos caminos de una operación», «Concurrencia» y «Ausencia de workers»; `docs/FASES/FASE1/M03a/acta-meta.md`.
- Código contrastado en `9af2139`: ver «Contexto verificado en el código».
- Documentación oficial de Google consultada el 2026-11-12 (OAuth web, modo Testing, Admin API v1beta, Data API v1beta, cohortes, metadatos, compatibilidad, cuotas, errores, calidad, ecommerce, retención, PII y verificación de scopes sensibles). Los enlaces están en «Referencia de API verificada». Lo que la documentación no declara se marca como hipótesis.

## Objetivo

Conectar la propiedad GA4 de la tienda en modo lectura. Extraer informes agregados reproducibles de tráfico, ecommerce, productos y cohortes de **primera sesión**. Mostrarlos en Integraciones, en el chat y en el diagnóstico, y compararlos con Meta y Tiendanube solo cuando la clave esté verificada. Cada cifra muestra su fuente, período, zona, moneda, cobertura y calidad.

## Alcance

1. OAuth web de Google con `analytics.readonly`, `state` de un uso vinculado (K02), acceso offline, `prompt=consent` y refresh token cifrado. Selección, con la Admin API, de una propiedad accesible y verificación del sitio.
2. Catálogo cerrado de informes de la Data API (`getMetadata`, `checkCompatibility`, `runReport`, `cohortSpec`) y preflight de instrumentación por capacidad.
3. Sincronización manual reanudable, serial, con cuotas, checkpoints, frescura y metadatos de calidad.
4. Agregados con fuente, zona, moneda, propiedad, informe y versión, ventana, cobertura y banderas de calidad. RLS, `worker_api` acotada y purga al desconectar.
5. Tres comparaciones (D-M16f-09): visitas GA4 frente a gasto de Meta; productos vistos frente a vendidos; campañas de Meta frente a tráfico GA4 por `utm_id`.
6. UI en Integraciones (D-M16f-10), herramientas cerradas en el chat y sección en el diagnóstico (D-M16f-03).
7. Desconexión con revocación **local** (D-M16f-05), reautorización al perder acceso y purga.

## Fuera de alcance

- Escribir en GA4, Google Tag Manager, Measurement Protocol, Meta o Tiendanube, incluida la revocación remota del token (D-M16f-05). PRAXA no instrumenta la tienda.
- Unir visitantes o eventos individuales con compradores de Tiendanube, BigQuery Export y User-ID (D-M16f-02, H-E1-238).
- La comparación de ventas cobradas de Tiendanube con compras medidas por GA4 y cualquier conciliación por `transaction_id` (D-M16f-09).
- Atribución causal, ROAS unificado o «ventas traídas por Meta».
- Publicar o verificar la app de Google para uso público (D-M16f-07); queda para una microfase como `M16d`.
- Agregar campos a Tiendanube (`domains`, `url_with_protocol`): la verificación del sitio usa solo `original_domain` (A-15 de M16e).
- Conversión de moneda, operaciones automáticas, reportes exportables y la API `v1alpha`.
- Pruebas en `app` con propiedades ajenas al dueño (D-M16f-11).

## Contexto verificado en el código

| Qué | Dónde (archivo:línea) | Implicación |
|---|---|---|
| El enum SQL admite `meta` y `tiendanube`; `0023` lo recreó entero porque entonces solo lo usaban dos columnas | `supabase/migrations/0023_tiendanube.sql:48-70` | Ese patrón ya no sirve: desde `0023` el tipo lo usan tres columnas (`integration_connections.provider`, `oauth_attempts.provider` y `private.integration_credentials.provider`, `0023:127`), dos FK que incluyen el proveedor (`0023:96`, `:144`, contra la clave única de `:80`) y las firmas de `create_oauth_attempt`, `consume_oauth_attempt` y `create_pending_connection` (`0023:923`, `:1041`, `:1095`). M16f agrega el valor con `add value` en una migración propia (§3) |
| Una conexión viva por empresa **y proveedor** | `0023:73-76` | GA4 entra sin cambiar el índice |
| Forma por proveedor: Tiendanube sin negocio ni estado de Meta y con cuenta numérica | `0023:85-93` | La restricción se recrea con una rama `ga4` |
| Scopes y tipo de token por proveedor | `0023:105-122`, `:147-152`; `src/modules/integrations/contract/credential.ts:42-45`, `:60-71` | Se agregan `ga4` y `google_refresh_token`. `scopeSchema` (`credential.ts:47`) rechaza la URL del scope de Google: se amplía solo para ese literal |
| Enum Zod de proveedor | `src/modules/integrations/contract/primitives.ts:43` | Se agrega `ga4` |
| `external_account_id` acepta `^[A-Za-z0-9_-]{1,64}$` | `src/modules/integrations/contract/connection.ts:51` | La propiedad se guarda como su número, sin `properties/` |
| `issued_for_app_id` exige `^[A-Za-z0-9_-]{1,64}$` en la base y en el contrato | `supabase/migrations/0012_integrations.sql:438-439`; `0023:1388-1390`; `credential.ts:87` | El client ID de Google tiene puntos: se guarda solo su prefijo numérico (§1) |
| `create_pending_connection` y `replace_credential` validan proveedor, forma y tipo de token con listas de Meta y Tiendanube | `0023:1095`, `:1132-1140`; `:1353-1390` | Se reemplazan con la misma firma, agregando la rama `ga4` |
| `replace_credential` exige un intento OAuth consumido; `rewrap_credential` solo recifra con una clave posterior | `0023:1353-1366`; `0012:1401-1410` | Ninguna sirve para guardar un refresh token rotado: la rotación se descarta (§1) |
| `publish_diagnostic` recibe hoy la conexión de la tienda como último argumento | `0024:146-148`; `src/modules/integrations/db/worker-api.ts:101`; `src/modules/diagnostics/repository.ts:215` | La migración de diagnóstico `0031` la recrea con `p_ga4_connection_id` (§6) |
| `create_oauth_attempt` ya recibe `p_provider` | `0023:923-933` | No cambia ninguna firma: los pgTAP `13`, `14`, `16` y `scripts/chat-seed-test.mjs` no se tocan (H-E1-254 no se repite) |
| `readLiveConnection(ctx, provider)` filtra por proveedor | `src/modules/integrations/repository/connections.ts:34-52` | Reutilizable para GA4 |
| La purga vigente es la de `0023` | `0023:1494-1544` | La migración de M16f la reemplaza agregando las tablas de GA4 |
| `runLazyPurge` omite la revocación de todo proveedor que no sea Meta | `src/modules/integrations/lifecycle.ts:88` | Con D-M16f-05, GA4 cae en esa rama sin cambios; hace falta `disconnectGa4` como `disconnectTiendanube` (`:158`) |
| Acciones de servidor de Meta y Tiendanube | `src/modules/integrations/actions.ts:7-16` | Se agregan las de GA4 con su propio parámetro de resultado |
| La pantalla trata a Google Analytics como tarjeta informativa | `src/app/(app)/app/integraciones/page.tsx:22-30` | Se reemplaza por una tarjeta funcional |
| Inicio dice que GA4 no tiene conector | `src/modules/app-data/index.ts:97` | Se lee el estado real |
| Dominio de la tienda: solo `original_domain`, en `tn_sync_status.store_domain` | `0023:411`, `:2026` | Única fuente para la verificación del sitio |
| Herramientas del chat por proveedor | `src/modules/chat/tools/schema.ts:7-14` | Se agrega `GA4_TOOL_NAMES` |
| Abstención por fuente no conectada | `src/modules/chat/orchestrator.ts:339` | Se extiende a tres fuentes |
| Versiones del informe del diagnóstico | `supabase/migrations/0024_tiendanube_diag.sql:29-42` | Se agrega una versión con la sección de GA4 |
| K01 obtiene la empresa en el servidor | `src/modules/tenant/context.ts:37-46` | Ninguna propiedad, empresa ni conexión llega del navegador como autoridad |
| `verify` no corre pgTAP ni `test:app` | `package.json` (scripts) y III.3 | Se corren aparte |

## Referencia de API verificada (2026-11-12)

Fuente: documentación oficial de Google leída el 2026-11-12. Los nombres que solo se leyeron en resúmenes se validan con `getMetadata` en el preflight, que es la fuente autoritativa de nombres para cada propiedad.

| Tema | Valor documentado | Implicación |
|---|---|---|
| Autorización | `GET https://accounts.google.com/o/oauth2/v2/auth` con `client_id`, `redirect_uri` (coincidencia exacta), `response_type=code`, `scope`, `access_type=offline`, `state` y `prompt`. [OAuth web](https://developers.google.com/identity/protocols/oauth2/web-server) | Una URI por entorno |
| Canje y refresh | `POST https://oauth2.googleapis.com/token`. Respuesta: `access_token`, `expires_in`, `scope`, `token_type: "Bearer"` y `refresh_token` solo en el canje | El access token vive en memoria; el refresh token se cifra (H-09) |
| Refresh token solo la primera vez | Con `access_type=offline`, el refresh token se entrega en la primera autorización; para otro hay que pedir `prompt=consent` | Todo intento `initial` y `reauth` envía `prompt=consent` |
| Vida del refresh token | Se invalida si el usuario revoca, a los 6 meses sin uso, al superar 100 tokens vivos por cuenta y cliente, o por política de Workspace. En modo `Testing`, a los **7 días**. [OAuth](https://developers.google.com/identity/protocols/oauth2/) | `invalid_grant` → `needs_reauth`. Con D-M16f-07, reautorización semanal esperada |
| Scope | `https://www.googleapis.com/auth/analytics.readonly`; no figura entre los restringidos. [Verificación](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) | La categoría se confirma en la consola (H-07) |
| Admin API v1beta | `accountSummaries.list` (`pageSize` hasta 200, `nextPageToken`); `propertySummaries[]{property, displayName, propertyType}`. `GET properties/{id}`: `timeZone`, `currencyCode`, `deleteTime`, `propertyType`. `GET properties/{id}/dataStreams`: `type`, `webStreamData.defaultUri`. [accountSummaries](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/accountSummaries/list), [Property](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties#Property), [DataStream](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.dataStreams#DataStream) | Solo `PROPERTY_TYPE_ORDINARY` sin `deleteTime` |
| Data API v1beta | `POST properties/{id}:runReport` con `dimensions`, `metrics`, `dateRanges`, filtros, `limit` (máx. 250.000), `offset`, `keepEmptyRows`, `returnPropertyQuota`, `cohortSpec`. [runReport](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport) | Sin `keepEmptyRows`, las filas con todas las métricas en cero no vuelven. Solo `runReport` entre los métodos del catálogo acepta `returnPropertyQuota`; [getMetadata](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/getMetadata), [checkCompatibility](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/checkCompatibility) y Admin API no lo aceptan |
| Metadatos de calidad | `samplingMetadatas`, `dataLossFromOtherRow`, `subjectToThresholding`, `schemaRestrictionResponse` (`REVENUE_DATA`, `COST_DATA`), `currencyCode`, `timeZone`, `emptyReason`, `dataTruncationReasons` (desde 2026-09). [ResponseMetaData](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData) | Se guardan por informe y ventana |
| Compatibilidad | `checkCompatibility` y `getMetadata`. Las combinaciones incompatibles consumen la cuota de errores de cliente. [checkCompatibility](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/checkCompatibility) | Se valida antes de ejecutar |
| Cuotas Standard | `Core`: 200.000 tokens/día y 40.000/hora por propiedad; 14.000/hora por proyecto y propiedad; 10 solicitudes concurrentes; 10 errores de servidor por hora; `429 RESOURCE_EXHAUSTED`. [Cuotas](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas) | Topes de §3 |
| Cohortes | `cohortSpec`: dimensión solo `firstSessionDate`; `dateRanges` del informe vacío; dimensión `cohort` obligatoria; granularidad `DAILY`/`WEEKLY`/`MONTHLY` con `endOffset`; métricas `cohortActiveUsers`, `cohortTotalUsers`. [Cohortes](https://developers.google.com/analytics/devguides/reporting/data/v1/advanced) | Retención = cociente calculado en SQL |
| Nombres | Documentados: `date`, `eventName`, `firstSessionDate`, `itemId`, `itemName`, `sessionSource`, `sessionMedium`, `sessionManualCampaignId` (el valor de `utm_id`; `sessionCampaignId` mezcla además campañas de Google Ads y no se usa), `activeUsers`, `ecommercePurchases`. Por validar con `getMetadata`: `sessions`, `newUsers`, `eventCount`, `itemsViewed`, `itemsAddedToCart`, `itemsPurchased`. `conversions` está deprecada | El preflight deshabilita lo que no confirme |
| Errores | `400`, `401`, `403`, `429`, `500`, `503`. [Errores](https://developers.google.com/analytics/devguides/reporting/data/v1/errors) | Clasificación siguiente |
| Cambios 2026 | Sin deprecaciones relevantes; solo novedades en `v1alpha` | Se reverifican los changelogs antes del código |

### Clasificación de errores (patrón CA-39 de Meta)

Como en M16e, cada tipo se guarda con una clase existente de `last_error_class`, así no cambia el `check` de la conexión (`0012_integrations.sql:314-316`).

| Señal | Tipo | `last_error_class` | Efecto |
|---|---|---|---|
| `invalid_grant` en el refresh, o `401` después de un refresh correcto | `autorizacion_perdida` | `authentication` | `needs_reauth` (ver nota) |
| `403` en Admin o Data API | `sin_acceso_propiedad` | `permission` | `needs_reauth` (ver nota); no purga |
| `429` o cuota de §3 alcanzada | `cuota` | `rate_limit` | Paso cerrado como incompleto; se reanuda después |
| `500`, `503` o timeout | `transitorio` | `temporary` | Hasta 2 reintentos por solicitud (1 s y 4 s); con 3 en el paso, el paso se cierra incompleto |
| Red o DNS | `transporte` | `transport` | Igual que `transitorio` |
| `400` | `consulta_invalida` | `own_error` | La capacidad del informe pasa a `incompatible` con esa causa; la conexión no cambia |
| Metadatos de calidad ausentes o incompatibles entre páginas del mismo informe/ventana | `calidad_inconsistente` | `unknown` | Paso incompleto, sin publicar ni confirmar checkpoint de esa ventana; los datos publicados antes quedan intactos y la conexión no cambia |
| Propiedad con `deleteTime` o fuera de `accountSummaries` | `propiedad_no_disponible` | `asset_access` | No se activa; si estaba activa, `needs_reauth` (ver nota) |
| Cualquier otro | `desconocido` | `unknown` | La conexión no cambia |

**Nota: `needs_reauth` depende del estado (CA-07).** Solo una conexión `active` pasa a `needs_reauth`, y lo escribe la función existente `worker_api.mark_needs_reauth`, con la generación esperada (`0012:1165-1180`). Vale igual dentro de un paso de sincronización, en el preflight o al leer la lista de propiedades. Con la conexión en `pending_selection`, el error no cambia su estado: la pantalla muestra el error, el dueño puede reintentar o desconectar, y la pendiente vence por DEC-17. En `needs_reauth`, la función no hace nada, como hoy.

### Alta en Google Cloud (acción del usuario, sin secretos en el chat)

1. Crear un proyecto de Google Cloud para PRAXA y habilitar **Google Analytics Data API** y **Google Analytics Admin API**.
2. Pantalla de consentimiento: audiencia **Externa**, estado **Testing** (D-M16f-07). Registrar el dominio del piloto como **dominio autorizado**. Agregar como usuario de prueba la cuenta de Google del dueño que tiene acceso a la propiedad. Anotar en la sesión la categoría que la consola muestra para `analytics.readonly` (H-07).
3. Cliente OAuth de tipo **Aplicación web** con la URI `https://<dominio del piloto>/api/integraciones/ga4/callback`, exacta.
4. Cargar `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` y `GOOGLE_OAUTH_REDIRECT_URI` en `.env.local` y en Vercel, nunca en el chat. Correr `node --env-file=.env.local scripts/ga4-preflight.mjs`, que solo dice qué variables están y si la URI tiene la forma esperada, sin imprimir valores.
5. Con el dueño: confirmar que su cuenta tiene al menos lectura sobre la propiedad y qué flujo web corresponde a la tienda, y revisar cómo mide el sitio: si hay banner de cookies y modo de consentimiento (reducen lo medido y activan umbrales) y qué eventos ecommerce y UTMs usa. Se anota en la sesión, sin datos de la cuenta.

## Diseño concreto

### 0. Etapas

Una microfase, un gate y las cuatro etapas de la ficha; la tercera se parte en dos controles, como las etapas 4 y 5 de M16e. Rigen las reglas de corrida única de `M25a`: no se pasa de etapa con pruebas en rojo, y cada etapa termina con un commit del usuario. Única salvedad (D-M16f-13): un control pasa si en `test:app` fallan solo casos de `tests/app/meta-sync.test.ts` y `tests/app/meta-precision.test.ts` con la causa de H-E1-241 (`publish_snapshot` rechaza un `p_fetched_at` futuro); la sesión registra los casos y la causa. Cualquier otra falla detiene el control.

| Etapa | Contenido | Control |
|---|---|---|
| `.1` OAuth y propiedad | Migración 0 (`<n>_ga4_enum.sql`, solo el valor `ga4`) y migración 1 (`<n+1>_ga4.sql`): credencial, forma, tablas, agregados, funciones de lectura, `worker_api` y purga. Contratos K02–K04. OAuth, selección y verificación de la propiedad, desconexión | `verify`, `db:check:test`, `test:policies`, `test:app` |
| `.2` Catálogo y persistencia | Cliente HTTP, catálogo, preflight, sincronización, calidad y publicación de agregados | Los mismos |
| `.3a` Comparación y UI | Tarjeta de GA4 y comparaciones en Integraciones; Inicio y menú | Los mismos |
| `.3b` Chat y diagnóstico | Migración de diagnóstico `0031_ga4_diag.sql` (`diagnostic_reports`, `publish_diagnostic` y su guarda, §6), después de las correctivas `0028`, `0029` y `0030` por H-E1-262, H-E1-266 y H-E1-268; herramientas del chat y sección del diagnóstico. Al pasar el control, publicación única en `app` | Los mismos; `test:eval` solo con OK previo (T-12) |
| `.4` Pruebas reales | Acta comunicada; el dueño conecta su propiedad; preflight, sincronización, comparaciones, chat, diagnóstico y desconexión reales | Recorrido redactado (T-10) |

`<n>` es el siguiente número libre al implementar (hoy el último es `0025`, con pgTAP `19`). Cada migración pasa primero por el desechable (`db:push:test`). Una migración aplicada en `app` no se edita.

**Publicación (acción del usuario).** Al terminar el control `.3b`: commit, integración en `main`, `db:push` de las migraciones 0, 1 y 2 en `app`, en orden, y despliegue. Antes de la publicación no hay OAuth real: la URI registrada es la de producción, y por D-M16f-11 no se usa ninguna propiedad ajena al dueño. La publicación no aprueba el gate. El dueño no conecta GA4 hasta que se le comunique el acta.

### 1. Identidad, OAuth y propiedad

- **Proveedor** `ga4`. Tipo de token `google_refresh_token`, con `expires_at` nulo (el vencimiento de Google no es fijo). `issued_for_app_id` es el prefijo numérico del client ID (los dígitos antes del primer `-`, que identifican el proyecto de Google Cloud); si el client ID no tiene esa forma, el preflight de variables falla. `create_pending_connection` y `replace_credential` se reemplazan con la misma firma, agregando la rama `ga4` (forma de §1, `google_refresh_token`, `expires_at` nulo). Scopes guardados: exactamente `['https://www.googleapis.com/auth/analytics.readonly']`. `scopeSchema` admite ese literal además de la forma actual; `credentialProviderIssues` y `private.valid_provider_scopes` agregan la rama `ga4`. Meta y Tiendanube no cambian.
- **Forma de la conexión `ga4`:** `client_business_id`, `meta_sync_summary` y `current_sync_run_id` nulos; `external_account_id` nulo o `^[1-9][0-9]{0,19}$` (el número de la propiedad). Moneda y zona (K03) salen de `properties/{id}`.
- **Inicio** (`POST /api/integraciones/ga4/iniciar`, con la comprobación de `Origin` y la respuesta `303` del patrón de Meta). K01 por `requireTenantContext()`; K02 con `p_provider = 'ga4'` y propósito `initial` (sin conexión viva de GA4) o `reauth`. `state` de 32 bytes, de un uso, ligado a actor, empresa, navegador, vencimiento y generación esperada. La URL pide solo el scope, `access_type=offline`, `prompt=consent`, y no envía `include_granted_scopes`.
- **PKCE:** no se usa. Es un cliente web confidencial con `client_secret` y K02 vinculado al navegador, igual que Meta y Tiendanube. Agregarlo exigiría guardar un verificador en K02, sin una amenaza que no cubra ya el `state` ligado.
- **Callback** (`GET /api/integraciones/ga4/callback`): consume K02, canjea el `code` y redirige a `/app/integraciones?ga4=<resultado>` con `Referrer-Policy: no-referrer`. No guarda ni registra `code`, tokens ni la respuesta. Si la respuesta no trae `refresh_token`, o su `scope` no es exactamente el pedido, no se activa nada y el resultado es `reintentar` (H-10). La denegación, un `state` vencido o reutilizado y otro navegador cierran sin conexión.
- **Credencial:** el refresh token se cifra con el llavero AES-GCM existente y el AAD de empresa, conexión y proveedor. **Rotación descartada:** en este flujo Google no rota el refresh token (H-11). Si una respuesta de refresh trae uno nuevo, no se guarda y se registra `rotacion_descartada`, sin el valor. Si el guardado deja de servir (`invalid_grant`), la conexión pasa a `needs_reauth` y el dueño reconecta. Así no hace falta otra función de `worker_api`.
- **Pendiente:** una conexión `pending_selection` de GA4 vence y se purga como las de Meta (DEC-17, CA-37b).
- **Propiedad.** La conexión queda `pending_selection` con la lista de `accountSummaries` del token, filtrada a `PROPERTY_TYPE_ORDINARY`. El navegador elige con una clave opaca (hash de conexión y propiedad, como `selectionKeyFor`). El servidor vuelve a leer la propiedad con el token y comprueba que esté en la lista, sin `deleteTime`, con zona IANA válida y moneda ISO. Un número escrito a mano nunca da acceso.
- **Verificación del sitio.** Se comparan los hosts de `webStreamData.defaultUri` de los flujos web con `tn_sync_status.store_domain` de la conexión de Tiendanube viva, sin `www.` y sin distinguir mayúsculas:
  - si alguno coincide, la pantalla dice «el sitio coincide con tu tienda» y el dueño confirma;
  - si no coincide, muestra los dos hosts y el dueño tiene que marcar «esta propiedad es la de mi tienda». Una tienda con dominio propio casi nunca coincide con `original_domain`, por eso la falta de coincidencia no bloquea;
  - sin Tiendanube conectada, muestra solo el host del flujo y pide la misma marca;
  - sin ningún flujo web, la propiedad no se puede activar.
- **Reautorización** con otra propiedad: se rechaza como en CA-37c; para cambiar de propiedad hay que desconectar.
- **Desconexión** (D-M16f-05). `disconnectGa4` marca `disconnected`, incrementa la generación y deja la purga a `runLazyPurge`, que no llama a Google. El refresh token sigue válido en Google hasta que vence (7 días en Testing) o el dueño lo quita en su cuenta; la guía de Integraciones lo explica. Meta y Tiendanube no se tocan.

### 2. Catálogo, preflight e instrumentación

El catálogo es una constante versionada del servidor. Cada informe tiene ID, versión, dimensiones, métricas, filtros fijos, ventana y capacidad.

| ID (versión 1) | Dimensiones | Métricas | Ventana | Capacidad |
|---|---|---|---|---|
| `ga4_trafico_dia` | `date` | `sessions`, `activeUsers`, `newUsers` | Por ventana de 31 días | Tráfico (base) |
| `ga4_trafico_fuente` | `date`, `sessionSource`, `sessionMedium` | `sessions` | Igual | Tráfico (base) y comparación 1 |
| `ga4_campanias` | `date`, `sessionManualCampaignId` | `sessions` | Igual; filtro: no vacío y distinto de `(not set)` | Comparación 3 |
| `ga4_embudo` | `date`, `eventName` | `eventCount` | Igual; filtro `eventName` en `view_item`, `add_to_cart`, `begin_checkout`, `purchase` | Embudo (ecommerce) |
| `ga4_productos` | `date`, `itemId`, `itemName` | `itemsViewed`, `itemsAddedToCart`, `itemsPurchased` | Igual | Productos (ecommerce) y comparación 2 |
| `ga4_cohortes` | `cohort`, `cohortNthMonth` | `cohortTotalUsers`, `cohortActiveUsers` | 12 cohortes mensuales por `firstSessionDate`, `endOffset` 11 | Cohortes de visitantes (base) |

**Preflight**, al activar y antes de cada sincronización: `getMetadata` confirma cada nombre; `checkCompatibility` confirma cada combinación. Para las capacidades ecommerce, un informe `ga4_embudo` de los últimos 28 días debe tener al menos un `view_item` y un `purchase`; `ga4_productos` debe tener al menos un `itemId` no vacío. **Preflight de UTMs:** la comparación 3 queda `sin_instrumentacion` si en los últimos 28 días no hay ninguna sesión con `sessionManualCampaignId` no vacío y distinto de `(not set)`. El resultado por capacidad es `disponible`, `sin_instrumentacion` (eventos ausentes), `incompatible` o `restringida` (`schemaRestrictionResponse`), y se guarda con fecha. Una capacidad no disponible no se ejecuta y se rotula «no disponible», nunca cero. `ga4_trafico_dia`, `ga4_trafico_fuente` y `ga4_cohortes` son informes base obligatorios: si cualquiera no pasa el preflight, no se inicia ni se declara completa una sincronización y el gate queda abierto. `ga4_campanias`, `ga4_embudo` y `ga4_productos` son opcionales según sus capacidades; sus estados no disponibles se conservan con el motivo, sin crear cobertura ni ceros. La matriz `checkCompatibility` real es evidencia de cierre. El dueño aprueba en la etapa 4 que los eventos significan lo que dicen (ficha: «definición de cada métrica acordada»).

**Definiciones fijas** (texto del servidor, visible en pantalla, chat y diagnóstico): sesiones, usuarios activos y nuevos según GA4; «visitas desde Meta» = sesiones cuyo `sessionSource`, en minúsculas, está en {`facebook`, `fb`, `instagram`, `ig`, `facebook.com`, `m.facebook.com`, `l.facebook.com`, `lm.facebook.com`, `instagram.com`, `l.instagram.com`}; compras de GA4 = eventos `purchase` medidos, nunca «ventas»; cohorte = visitantes agrupados por el mes de su primera sesión, en la zona de la propiedad.

### 3. Extracción, calidad y publicación

- **Ventanas.** Backfill de 365 días en ventanas de 31 días, de la más reciente a la más vieja. Incremental: relee desde el último día completo menos `GA4_PROVISIONAL_DAYS`, una constante de código en `src/modules/integrations/ga4/` (inicial 3; H-06 lo mide, y un cambio de valor es un cambio de código registrado en la sesión, no una variable de entorno). Los días dentro de ese margen se publican con la bandera `provisional`. Las cohortes se recalculan enteras en cada sincronización.
- **Sincronización y paso.** Una **sincronización** lleva toda la cobertura objetivo (el backfill pendiente o el incremental) a completa. Al terminar el preflight de su primer paso, fija como objetivo los tres informes base y solo los informes opcionales cuya capacidad quedó `disponible`; esa lista y los estados y motivos de los omitidos se guardan en `private.ga4_sync_runs` para todos los pasos de la misma sincronización. Los informes omitidos no tienen checkpoint pendiente ni cobertura, y sus getters devuelven «no disponible» con el motivo del preflight. `ga4_finish_sync` se llama únicamente cuando **todos los informes del objetivo** completaron todas sus ventanas; si un informe base no pasa el preflight, el paso termina en error sin llamar a `ga4_finish_sync`. Una nueva sincronización repite el preflight y puede cambiar el objetivo, sin reinterpretar como cero las ventanas antes omitidas. Se compone de uno o más **pasos**, cada uno una llamada propia acotada por `maxDuration`. Como Tiendanube desde `25ca650`, la tarjeta encadena los pasos sola con una pulsación (`pasoSincronizacionGa4`, sin redirigir): sigue mientras el resultado sea `parcial`, se detiene en completa, `cuota`, error o un tope de 20 pasos por pulsación, y no hay trabajo en segundo plano. El backfill de 365 días con todas las capacidades disponibles pide unas 60 solicitudes, o sea 3 o 4 pasos.
- **Preflight en la sincronización.** Corre en el primer paso de cada sincronización, y al activar. Gasta hasta 12 de las 25 solicitudes de ese paso (propiedad, flujos, `getMetadata`, `checkCompatibility` por informe y los tres informes de 28 días). Los pasos siguientes usan el preflight guardado.
- **Cierre.** Solo el paso que completa la sincronización llama a `ga4_finish_sync`, que guarda la fecha de fin y recalcula el mapeo (§3, «Referencias a otras fuentes»). «Última sincronización» es esa fecha de fin, y es la que usa la regla de 24 horas del diagnóstico.
- **Paso.** Lo inicia el dueño o el encadenado de la tarjeta. Toma lease y generación de la conexión, como Tiendanube, y dura como máximo 240 s en total, de los cuales los últimos 30 s se reservan para publicar y cerrar; queda por debajo de `maxDuration = 300`. Topes por paso: 25 solicitudes a Google **en total** (Admin API, `getMetadata`, `checkCompatibility` y `runReport`, incluidos los reintentos), **una en vuelo** por propiedad, `limit` de 10.000 filas por página con `offset`. Solo cada `runReport` pide `returnPropertyQuota` y aporta `propertyQuota`; los otros métodos no envían ese campo y también descuentan del tope de 25 llamadas. Antes del primer `runReport` no hay saldo observado: no se inventa ni se aplica el umbral del 10 %. Después de cada `runReport`, si llega `propertyQuota`, el paso se cierra como `cuota` y se reanuda más tarde si queda menos del 10 % de `tokensPerHour` (40.000 por propiedad), `tokensPerProjectPerHour` (14.000 por proyecto y propiedad) o `tokensPerDay` (200.000), es decir, menos de 4.000, 1.400 o 20.000 tokens restantes. Si `propertyQuota` falta, se registra «cuota no observada» sin fabricar un saldo, y siguen rigiendo el límite de 25 solicitudes, el tiempo del paso y el `429` como condición de parada.
- **Checkpoint.** Se confirma tras cada informe y ventana completos. Un paso cortado no publica cobertura de páginas parciales. Un paso desplazado por desconexión o reautorización no escribe.
- **Cero frente a ausencia.** Una fila ausente es cero solo si el informe de esa ventana terminó completo, sin `subjectToThresholding`, `dataLossFromOtherRow` ni `dataTruncationReasons`; si no, es «desconocido».
- **Mes N de cohortes.** Cada cohorte se selecciona con `firstSessionDate` entre el primer y el último día de su mes `C`, en la zona de la propiedad. `cohortNthMonth = N` es el desplazamiento de GA4; para decidir **solo la disponibilidad de una celda ausente**, se usan los límites conservadores que [CohortsRange](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/CohortSpec#CohortsRange) documenta para `MONTHLY`: inicio `cohort.startDate + 30 × N` días y fin `cohort.endDate + 30 × N` días, ambos inclusivos, calculados como fechas locales. No se toma `C + N` meses de calendario como límite ni se reinterpretan las filas devueltas por GA4. Si el día local actual precede al inicio, no se escribe una celda ausente ni se infiere cero: la variante de `get_ga4_cohorts` de seis argumentos recibe del servidor la fecha local, el N máximo y `GA4_PROVISIONAL_DAYS`, y sintetiza el N solicitado con `active` y `retention` nulos y `absence = 'aun_no_disponible'`; el tamaño conocido de la cohorte conserva su regla de cinco. Desde el inicio hasta `fin + GA4_PROVISIONAL_DAYS`, las filas recibidas se marcan `provisional` y una fila ausente queda «desconocido», nunca cero. Solo después de ese límite se permite cero para una fila ausente si el informe y su ventana terminaron completos y sin banderas de calidad que impidan inferirlo. La pantalla y el chat rotulan «mes N de GA4», sin atribuirle el mes calendario `C + N`, y distinguen futuro, provisional, desconocido y cero observado.
- **Regla de cinco en cohortes.** Se aplica antes de escribir: si `cohort_size < 5`, `cohort_size` y `active` se guardan nulos, con `size_hidden = active_hidden = true`; si el tamaño es visible pero `active < 5`, solo `active` se guarda nulo con `active_hidden = true`. `get_ga4_cohorts` calcula `retention = round(active::numeric / cohort_size, 4)` únicamente si ambos conteos son visibles y el tamaño es mayor que cero; en cualquier otro caso devuelve `retention = null`. La pantalla, el chat y el diagnóstico no calculan otro porcentaje a partir de celdas ocultas ni envían al modelo el conteo subyacente.
- **Calidad.** Por informe, versión y ventana se guardan en `public.ga4_report_quality` muestreo, umbral, `(other)`, truncamiento, métricas restringidas, `emptyReason`, `currencyCode`, `timeZone` y fecha de extracción. Los agregados de esa ventana apuntan a su registro de calidad; los getters `SECURITY INVOKER` leen esa proyección pública bajo la misma RLS, sin acceder a tablas privadas. Si falta el registro de calidad, la cifra no sale como completa: se marca parcial y se explica la ausencia. Si `timeZone` cambia entre extracciones, las ventanas anteriores quedan marcadas `zona_distinta` y no se comparan.
- **Usuarios no se suman.** `activeUsers` y `newUsers` se muestran por día; nunca se suman entre días ni entre filas.

**Valor del enum (migración 0).** `<n>_ga4_enum.sql` contiene solo `alter type public.integration_provider add value 'ga4'`. Va en un archivo propio porque un valor agregado no se puede usar en la misma transacción; así, las columnas, las FK y las firmas de las funciones no se tocan. La migración 1 usa el valor ya confirmado (H-12).

**Esquema** (migración 1; los nombres de columna exactos los fija el plan sin cambiar el contenido):

| Objeto | Contenido | Acceso |
|---|---|---|
| `private.ga4_sync_runs` | Ejecución: conexión, lease, generación, informe y ventana en curso, estado, tipo de error, páginas, cuota restante | Nadie directo |
| `private.ga4_item_keys` | Por conexión, `itemId` externo no vacío y `item_ref uuid` aleatorio, único y estable hasta la purga | Nadie directo |
| `private.ga4_item_rows` | `itemId` externo, `item_ref` interno, `itemName`, día y métricas, para el mapeo | Nadie directo |
| `private.ga4_campaign_rows` | `sessionManualCampaignId` externo, día y sesiones, para el mapeo | Nadie directo |
| `public.ga4_sync_status` | Nombre visible de la propiedad (`displayName`, hasta 100 caracteres, se actualiza en cada preflight), cobertura, último paso, zona, moneda, preflight por capacidad, banderas, reglas de mapeo; sin ID de propiedad | `SELECT` por RLS |
| `public.ga4_report_quality` | Un registro normalizado por informe, versión y ventana, con `quality_id uuid` interno, banderas y metadatos de calidad; sin respuesta bruta ni ID de propiedad | `SELECT` por RLS |
| `public.ga4_traffic_daily` | Día local, sesiones, usuarios activos, nuevos, visitas desde Meta, `provisional`, calidad | `SELECT` por RLS |
| `public.ga4_source_daily` | Día local, fuente, medio (hasta 200 caracteres) y sesiones | `SELECT` por RLS |
| `public.ga4_funnel_daily` | Día local, evento de la lista fija y conteo | `SELECT` por RLS |
| `public.ga4_item_daily` | Día local, `item_ref uuid` interno o nulo si falta `itemId`, producto interno de Tiendanube o nulo, nombre del ítem y métricas; nunca el `itemId` externo | `SELECT` por RLS |
| `public.ga4_campaign_daily` | Día local, `entity_ref` de la campaña de Meta o nulo, sesiones | `SELECT` por RLS |
| `public.ga4_visitor_cohorts` | Mes de cohorte, mes N, tamaño y activos nulos cuando estén ocultos, y marcas `size_hidden` y `active_hidden`, con la regla de cinco anterior y el patrón de `tn_cohort_cells` (`0023:497-511`); no guarda retención calculada ni celdas de meses N futuros | `SELECT` por RLS |
| `public.get_ga4_*` (estado, tráfico, fuentes, embudo, productos, campañas, cohortes) | Lectura `SECURITY INVOKER` por conexión | `EXECUTE` a `authenticated` |
| `worker_api.ga4_start_sync`, `ga4_publish_report`, `ga4_finish_sync`, `ga4_fail_sync`, `ga4_set_preflight` | Escrituras con actor, empresa, conexión, proveedor `ga4`, lease y generación verificados en SQL | `EXECUTE` solo al rol de integraciones |

**Proyección de calidad.** `public.ga4_report_quality` tiene `quality_id uuid` como clave, `company_id uuid`, `connection_id uuid`, `report_id text` del catálogo cerrado, `report_version integer`, `window_from date`, `window_to date` y `fetched_at timestamptz`; son únicas tanto `(company_id, connection_id, quality_id)` como `(connection_id, report_id, report_version, window_from, window_to)`. Guarda `sampling_metadatas jsonb` como lista cerrada de pares `samples_read_count`/`sampling_space_size` con enteros decimales no negativos (vacía si no hubo muestreo), `subject_to_thresholding boolean`, `data_loss_from_other_row boolean`, la lista validada de `dataTruncationReasons`, las parejas validadas `metricName`/`restrictedMetricTypes` de `schemaRestrictionResponse`, `empty_reason text` nulo si no existe, `currency_code text` y `time_zone text`. Solo se copian esos campos conocidos; nunca el cuerpo bruto de Google ni un identificador externo. Se inserta un registro de calidad **solo al terminar todas las páginas** del informe y ventana, incluso si devolvió cero filas: ese registro acredita la cobertura necesaria para distinguir cero de ausencia. Cada fila de `ga4_source_daily`, `ga4_funnel_daily`, `ga4_item_daily`, `ga4_campaign_daily` y `ga4_visitor_cohorts` tiene un `quality_id` no nulo de su informe y ventana, con FK compuesta `(company_id, connection_id, quality_id)` a la tabla de calidad. `ga4_traffic_daily` tiene `traffic_quality_id` no nulo para `ga4_trafico_dia` y `source_quality_id` nullable para las visitas desde Meta derivadas de `ga4_trafico_fuente`; si el segundo informe falta, esas visitas quedan desconocidas. Si el informe de fuente termina con cero filas, se enlaza igualmente su calidad y solo se infiere cero si sus banderas lo permiten. La republicación hace `UPSERT` de calidad por `(connection_id, report_id, report_version, window_from, window_to)`, conserva su `quality_id` y reemplaza las filas agregadas de la misma ventana en una transacción; una ventana completa de cero filas conserva su registro de calidad hasta que se reemplace o purgue. Los getters unen por esos IDs y devuelven las banderas de **cada** serie; cuando un informe completo tiene cero filas, consultan su calidad para distinguir ese cero de un informe ausente. `ga4_sync_status` solo resume el estado y no reemplaza la calidad por ventana.

**Calidad de páginas.** Antes de publicar un informe/ventana se normaliza el objeto `metadata` de **cada** respuesta de `runReport`, incluso si esa respuesta tiene cero filas. La ausencia del objeto entero es `calidad_inconsistente`; un objeto `{}` sí es válido: los booleanos omitidos se toman como `false`, las listas omitidas como vacías, `emptyReason` omitido como nulo y `currencyCode`/`timeZone` omitidos se completan con la moneda y la zona verificadas de la propiedad al comenzar la sincronización. Entre páginas, `subjectToThresholding` y `dataLossFromOtherRow` se combinan con OR; `dataTruncationReasons` y las parejas de `schemaRestrictionResponse` se unen sin duplicados. Los pares de `samplingMetadatas` se normalizan por índice de rango y deben coincidir en todas las páginas, igual que `emptyReason`, `currencyCode` y `timeZone`. Si difieren, la ventana termina con `calidad_inconsistente`, sin publicación ni checkpoint y sin alterar la calidad o los agregados anteriores. Solo tras validar todas las páginas se escribe la fila única de calidad con las banderas combinadas. Un umbral, `(other)` o truncamiento presente en **cualquier** página impide convertir una fila ausente en cero. T-06 prueba respuestas paginadas con banderas distintas, metadatos ausentes y diferencias en los campos que deben coincidir.

**Referencias a otras fuentes.** El producto interno de Tiendanube de `ga4_item_daily` y el `entity_ref` de Meta de `ga4_campaign_daily` **no tienen FK**, para no bloquear ni depender de la purga de esas conexiones. `ga4_sync_status` guarda la regla adoptada y la conexión de Tiendanube y la de Meta contra las que se calculó cada mapeo, también sin FK. **Cuándo se calcula:** solo `worker_api.ga4_finish_sync`, al cerrar una sincronización completa (no en cada paso), en la misma transacción. Recalcula la regla de productos (§4.2) y la correspondencia de campañas (§4.3) contra las conexiones vivas de la misma empresa, y **reescribe la referencia de todas las filas** de `ga4_item_daily` y `ga4_campaign_daily` de la conexión, haya cambiado la regla o no. Un paso incompleto no toca el mapeo. `get_ga4_items` y `get_ga4_campaigns` devuelven una fila como mapeada solo si esa conexión sigue `active` o `needs_reauth`; si no, todo sale «sin correspondencia» y la regla no se muestra. La siguiente sincronización de GA4 recalcula el mapeo contra la conexión viva.

**Identidad interna de ítems.** `worker_api.ga4_publish_report` busca en `private.ga4_item_keys` por `(connection_id, itemId)` no vacío; si falta, crea un `item_ref` con `gen_random_uuid()`, y lo reutiliza en todas las ventanas y republicaciones. `private.ga4_item_rows` y `public.ga4_item_daily` conservan esa referencia. Un `itemId` vacío se agrega en una sola fila «sin ID», con `item_ref` nulo y sin correspondencia. Sin regla de mapeo, `get_ga4_items` agrupa el ranking de GA4 por `item_ref`, nunca por `itemName`; con regla, agrupa los ítems mapeados por producto interno. Para cada ítem sin mapeo usa el último nombre no vacío por día descendente y, ante empate, el menor nombre en orden lexicográfico. Sin nombre usa «Ítem sin nombre». El ranking de GA4 mantiene separados dos `item_ref` aunque tengan el mismo nombre, y el ranking de Tiendanube se lee por producto. La UI puede usar `item_ref` como clave interna de renderizado, pero no lo imprime; la herramienta lo quita antes de enviar resultados al modelo. Ningún `itemId` externo sale de `private`. La purga borra también `ga4_item_keys`.

Todas las tablas tienen FK compuesta por empresa y conexión con `ON DELETE CASCADE`, RLS habilitada y forzada, y `REVOKE ALL` explícito para `anon`, `authenticated`, `PUBLIC`, `service_role` y el rol de integraciones, salvo los `SELECT` de la tabla. La política de lectura exige membresía y conexión de GA4 `active` o `needs_reauth`. Ninguna proyección pública guarda IDs externos. La matriz exacta va en el encabezado de la migración y la prueba el pgTAP nuevo. `purge_connection` se reemplaza, con la misma firma, agregando las tablas de GA4.

### 4. Comparaciones (D-M16f-09)

Ninguna tabla guarda la comparación: el servidor la arma leyendo las funciones de cada fuente. Cada serie conserva fuente, zona, moneda, período, cobertura y fecha de extracción, y las dos zonas se muestran si difieren. Nunca se calcula un cociente entre fuentes ni se rotula una cifra de GA4 o de Meta como venta.

1. **Visitas GA4 frente a gasto de Meta** (capacidad base). Por día local de cada fuente: sesiones totales y visitas desde Meta (GA4) al lado del gasto diario de la cuenta (Meta, en su moneda). Rótulo fijo: «asociación débil, sin causalidad» (§17.5). Disponible con GA4 y Meta activas. GA4 no aporta montos a esta comparación: el gasto va en la moneda de Meta, aunque difiera de la de la propiedad, sin conversión.
2. **Productos vistos frente a vendidos** (ecommerce). El mapeo se calcula al publicar, dentro de `worker_api`, contra la conexión de Tiendanube viva de la misma empresa. Se prueban, en orden, tres reglas: `itemId` no vacío igual a `external_variant_id`, a `external_product_id` o a `sku`. Al terminar cada sincronización completa se toman todos los `itemId` distintos no vacíos guardados de la conexión (los 365 días de cobertura) y se adopta la primera regla con la que al menos el 80 % coincide con un único producto, y ningún `itemId` coincide con dos. Con regla adoptada, todo se agrupa **por producto**: una regla por variante o SKU se resuelve a su producto, las métricas de GA4 de los `itemId` del mismo producto se suman, y las unidades vendidas son la suma de todas las variantes del producto en el mismo período, que `get_ga4_items` lee de `public.tn_product_units_daily` bajo RLS (no de `get_tn_product_units`, que devuelve solo las 50 filas más vendidas por variante). Se muestran por producto vistas, carritos y compras de GA4 al lado de las unidades de Tiendanube, y el porcentaje sin mapeo, que también cuenta las vistas sin `itemId`. Un producto sin ventas en el período muestra 0 unidades si la cobertura de Tiendanube del período está completa y «desconocido» si no. Sin regla: dos rankings separados y el rótulo «los IDs de producto no coinciden»; el de GA4 agrupa por `item_ref` según §3. La regla elegida se guarda en `ga4_sync_status`.
3. **Campañas de Meta frente a tráfico GA4 por `utm_id`** (requiere el preflight de UTMs). `sessionManualCampaignId` se compara por igualdad exacta de texto con `meta_entities.external_id` de nivel campaña de la conexión de Meta viva. Una campaña se muestra solo si su `utm_id` coincide con exactamente una campaña. Por campaña: gasto de Meta y sesiones de GA4 con ese `utm_id`, además del conteo de sesiones con `utm_id` sin correspondencia. Sin ninguna coincidencia: «tus anuncios no tienen el ID de campaña en el UTM», sin comparación.

### 5. UI en Integraciones (D-M16f-10)

`src/app/(app)/app/integraciones/`: la tarjeta informativa se reemplaza por una tarjeta de GA4 con conexión, selección y verificación de propiedad, reautorización, sincronización, preflight por capacidad, tráfico, embudo, productos, cohortes de visitantes y las tres comparaciones. Resultados en la URL con `?ga4=` y `?ga4_sync=`, cada uno de una lista cerrada. Cada vista distingue cero medido, ausencia, parcial, provisional, restringido, «no disponible» y error o cuota, y muestra fuente, propiedad (nombre, sin número), ventana, zona, moneda, fecha y banderas. Las cohortes de visitantes llevan el rótulo «visitantes por primera visita» y se muestran aparte de las cohortes de compradores de Tiendanube. La pantalla explica que en el piloto Google pide reconectar cada 7 días (D-M16f-07). Inicio y el menú leen el estado real (`app-data`).

### 6. Chat y diagnóstico (D-M16f-03)

- **Herramientas** en `src/modules/chat/tools/`, con el contrato de §12 de la ruta. Leen las funciones `get_ga4_*` y, para las columnas de otras fuentes, solo las funciones públicas de lectura que ya usan las herramientas de esas fuentes, bajo la misma RLS: el gasto de Meta en `ga4_campanias`. Las unidades de Tiendanube de `ga4_productos` vienen ya sumadas por producto en `get_ga4_items` (§4.2). Ninguna lee tablas privadas. `GA4_TOOL_NAMES`:

  | Herramienta | Parámetros | Devuelve |
  |---|---|---|
  | `ga4_trafico` | `period` (máx. 93 días, CA-70), `granularity` (`day` o `month`) | Sesiones y visitas desde Meta; usuarios activos y nuevos solo con `day`. Con `month`, los usuarios van nulos con `absence = 'no_aditivo'` |
  | `ga4_embudo` | `period` (máx. 93 días) | Conteo por evento de la lista fija |
  | `ga4_productos` | `period` (máx. 93 días), `limit` (hasta 20) | Ranking por vistas: por producto interno si hay regla y por `item_ref` interno si no, sin exponer la clave; carritos, compras y unidades de Tiendanube solo para productos con correspondencia |
  | `ga4_campanias` | `period` (máx. 93 días) | Sesiones y gasto por campaña con correspondencia, y sesiones sin correspondencia |
  | `ga4_cohortes` | `from_month`, `to_month`, `max_offset` (excepción de CA-70 de §17.11, D-M16f-12: hasta 12 cohortes y 12 meses N) | Tamaños y retenciones con la regla de cinco: retención nula si un conteo está oculto; N futuros `aun_no_disponible` e intervalo N abierto provisional |
  | `ga4_cobertura` | — | Último paso, cobertura, días provisionales y preflight |

  Un período mayor de 93 días se rechaza en todas, salvo `ga4_cohortes`. Una herramienta de una capacidad no disponible devuelve la ausencia con su motivo. Resultados con fuente `ga4`, definición fija y `fetched_at`; ningún ID externo; regla de cinco en cohortes (§17.4). Se reutilizan los bloques del catálogo de CA-71; si hiciera falta un componente nuevo en `src/components/chat/`, la microfase se detiene y vuelve a la ruta.
- **Verificación de cifras:** rige la nota «Enmienda H-E1-228» de §12, igual que para Tiendanube.
- **Fuentes y abstención:** el orquestador ofrece solo las herramientas de las conexiones `active`; una pregunta sobre una fuente no conectada termina con `connection_not_active`.
- **Registro** (CA-62, ampliado en §17.11): Meta si el turno usó alguna herramienta de Meta; si no, Tiendanube si usó alguna de Tiendanube; si no, GA4. Sin herramientas: la primera activa en ese orden. Un registro que quedó en la conexión de Meta o Tiendanube no se borra al desconectar GA4 (riesgo aceptado heredado del patrón de M16e: contiene solo agregados).
- **Página del chat:** con cualquier conexión activa, habilita el chat y lista las fuentes.
- **Diagnóstico.** Con GA4 `active`, el informe suma «Tráfico del sitio»: sesiones totales y visitas desde Meta en las mismas fechas de calendario de los 28 días del informe y los 28 anteriores, en la zona de la propiedad, al lado del gasto de Meta, sin atribución. Si la última sincronización tiene más de 24 horas o la ventana no está cubierta, la sección se marca parcial. Persistencia (migración de diagnóstico `0031`, renumerada por H-E1-262, H-E1-266 y H-E1-268):
  - columna `ga4_connection_id` nula, con FK compuesta a la conexión y `ON DELETE CASCADE`, y su índice;
  - un trigger, como `diagnostic_reports_store_only` de `0024`, que exige que `ga4_connection_id` sea de proveedor `ga4` y de la misma empresa;
  - el `check` de versiones: v1 y v2 como hoy y además con `ga4_connection_id` nulo, y `schema_version = 3` con `methodology_version = 'meta-fuentes-diag-1'`, `store_connection_id` nulo o no y `ga4_connection_id` no nulo;
  - la política de lectura, reemplazada para ocultar también el informe si la conexión de GA4 no está `active` o `needs_reauth`;
  - `worker_api.publish_diagnostic` recreada con un argumento final `p_ga4_connection_id uuid default null`: la firma vieja se borra con sus grants y la nueva concede `EXECUTE` solo al rol de integraciones. Valida la conexión de GA4 como hoy valida la de la tienda, y que v3 vaya si y solo si llega ese argumento.

  Los informes v1 y v2 siguen válidos y legibles. Los objetos nuevos entran en la matriz del encabezado y en `17_meta_diagnostics`. El plan busca todas las llamadas a `publish_diagnostic` antes de cambiarla; una fuera de «Archivos previstos» detiene la microfase (lección de H-E1-254).
- **Proveedores de modelo:** los agregados de GA4 van a DeepInfra (chat) y a Anthropic (diagnóstico). El acta ampliada lo declara.

### 7. Excepciones expresas (§17.6 de la ruta)

Aprobadas por el usuario el 2026-11-15 (D-M16f-06), según el modelo de CA-67. `AGENTS.md` las admite por la línea agregada con esta revisión.

| Escritura | Irreversibilidad | Cómo se recupera |
|---|---|---|
| Purga al desconectar GA4 | Borra credencial, ejecuciones, filas privadas, agregados, preflight e informe del diagnóstico con sección de GA4 | Reconectar y resincronizar: GA4 es la fuente, salvo los días que GA4 ya no conserve |
| Republicación de una ventana o de las cohortes | Reemplaza los agregados anteriores de esa ventana | Resincronizar |

No hay borrados por solicitud de privacidad: GA4 no envía webhooks a PRAXA y PRAXA no guarda datos de personas.

## Archivos previstos

Los autoriza II.14c de la ruta, ampliada por D-M16f-06 y D-M16f-10. El plan enumera los archivos exactos.

| Archivo o grupo | Nuevo o modificado | Para qué | Autorizado por |
|---|---|---|---|
| `docs/FASES/FASE1/meta_first/{plan,spec}.md` | Modificados | Ficha, II.14c y §17.11 (ya aplicados con esta revisión) | II.14c (documentos de II.14b) |
| `docs/FASES/FASE1/meta_first/entorno.md` | Modificado | Variables de Google | II.14c (D-M16f-10) |
| `docs/FASES/FASE1/M16f/{spec,plan}.md`; `M16f/revisiones/`; `meta_first/sesiones/M16f.md` | Nuevos/modificados | Contrato, plan, auditorías y evidencia | II.14c |
| `AGENTS.md` | Modificado | Una línea de excepción de reversibilidad para GA4 (ya agregada). El retiro de la regla de 8 horas en el mismo archivo es una decisión aparte del usuario, fuera de M16f (H-E1-261) | II.14c (D-M16f-06) |
| `docs/FASES/FASE1/M03a/acta-meta.md`; `docs/SECURITY.md`; `docs/ARCHITECTURE.md`; `docs/PROJECT_STATE.md`; `docs/HALLAZGOS.md`; `.env.example` | Modificados | Acta, frontera OAuth con Google y riesgos aceptados (D-M16f-05, -07), componentes, estado, hallazgos y variables vacías | II.14c (documentos de II.14b) |
| `supabase/migrations/0026_ga4_enum.sql`, `0027_ga4.sql`, `0028_ga4_text_fix.sql`, `0029_ga4_sync_getters.sql`, `0030_ga4_expired_lease.sql`, `0031_ga4_diag.sql`; `supabase/tests/20_ga4.test.sql` | Nuevos | Valor del enum, esquema, grants, agregados, purga, correcciones H-E1-262, H-E1-266 y H-E1-268 y diagnóstico | II.14c |
| `supabase/tests/{08_integration_isolation,09_integration_privileges,09b_integration_lifecycle,10_demo_closure,15_chat_queries,17_meta_diagnostics}.test.sql` | Modificados | Tres proveedores, conteos de funciones, ciclo de vida, cierre, registro del chat y versión 3 del informe | II.14c (D-M16f-10) |
| `src/modules/integrations/{contract,repository,db,crypto}/` (`crypto/` solo si el AAD lo exige); `src/modules/integrations/ga4/` | Modificados/nuevos | Contrato `ga4`, cliente, OAuth, catálogo, sync y mapeo | II.14c |
| `src/app/api/integraciones/ga4/{iniciar,callback}/` | Nuevos | OAuth | II.14c |
| `src/modules/integrations/{lifecycle,actions}.ts` | Modificados | `disconnectGa4` y acciones de GA4 | II.14c (D-M16f-10) |
| `src/app/(app)/app/integraciones/` | Modificados/nuevos | Tarjeta de GA4 y comparaciones | II.14c |
| `src/modules/chat/` | Modificados/nuevos | Herramientas, orquestador, prompt, salida y registro | II.14c (chat «si se amplía», D-M16f-03) |
| `src/modules/diagnostics/`; `src/components/app/{diagnostico.tsx,diagnostico.module.css}` | Modificados | Sección de tráfico del sitio | II.14c (D-M16f-10) |
| `src/app/(app)/app/chat/page.tsx`; `src/components/app/chat.tsx` | Modificados | Chat con tres fuentes | II.14c (D-M16f-10) |
| `src/modules/app-data/{index,types}.ts` | Modificados | Estado real de GA4 en Inicio y en el menú | II.14c (D-M16f-10) |
| `scripts/ga4-preflight.mjs` | Nuevo | Preflight de variables sin imprimir valores | II.14c (D-M16f-10) |
| `tests/{unit,app,component,eval}/` | Modificados/nuevos | Pruebas con fixtures sintéticos | II.14c |
| `package.json` y lockfile | Modificados solo si hay dependencia | — | II.14c |

Una necesidad adicional durante la implementación detiene la microfase y vuelve a la ruta.

## Criterios de aceptación

### Heredados de la ruta

| ID de la ruta | Qué exige |
|---|---|
| Ficha `M16f`, criterio de aceptación | Propiedad correcta conectada, con refresh y pérdida de acceso probados; informes reproducibles sin mezclar zonas, monedas ni identidades; cohortes de visitantes distintas de las de compradores; comparación solo por claves verificadas; ninguna cifra autoritativa del modelo; la desconexión purga agregados y credencial; sin eventos ecommerce reales, el gate no acredita lo ecommerce |
| Ficha `M16f`, condición para avanzar | Acta y controles; propiedad y lectura reales; preflight de eventos; al menos una comparación validada; lo no instrumentado, «no disponible» |
| CB-01 a CB-06 | Transversales de §14, sin excepciones a CB-04 (D-M16f-11); CB-01 con la salvedad de H-E1-241 en los controles de etapa y en la corrida integral T-11 (D-M16f-13) |
| §17.1 a §17.5 | Tres hechos distintos, lectura únicamente, datos mínimos, el LLM no calcula y regla de cinco, uniones con clave verificada |
| §17.6 | Excepciones de borrado: sección 7 |
| §17.7 | Acta ampliada antes del primer dato real; por la ficha, antes del código |
| §17.8 | Decisiones 4 y 5 de la propuesta, cerradas por D-M16f-08 y D-M16f-09 |
| §17.11 | CA-05, CA-11c, CA-38, CA-62, CA-70 y §16 enmendados para GA4 |
| CA-37b, CA-37c, CA-38c, DEC-09, DEC-17 | Vencimiento de la pendiente, reautorización sin cambiar de propiedad, escrituras en vuelo y borrado al desconectar, aplicados a GA4 |
| CA-70 | Tope de 93 días en las herramientas de GA4, con la excepción de `ga4_cohortes` de §17.11 (D-M16f-12) |
| §12 y §16 | Contrato del chat con la nota «Enmienda H-E1-228» y contrato del diagnóstico |

### Operativos de esta microfase

| ID | Criterio verificable | Traza |
|---|---|---|
| M16f-C-01 | Meta, Tiendanube y GA4 coexisten en una empresa; dos GA4 vivas no; SQL y K02–K04 coinciden en proveedor, scope exacto, tipo de token y forma, sin degradar Meta ni Tiendanube | H-E1-236; §17.11 |
| M16f-C-02 | OAuth de un uso vinculado a dueño, empresa y navegador, con `access_type=offline` y `prompt=consent`; `code` y tokens no persisten ni aparecen en URL final ni logs; sin refresh token o con otro scope no se activa; denegación, replay y otro navegador cierran sin conexión; la pendiente vence y se purga | K01/K02; OAuth oficial; DEC-17 |
| M16f-C-03 | Solo se activa una propiedad ordinaria, sin `deleteTime`, presente en `accountSummaries` del token y confirmada por el dueño; la verificación del sitio sigue las tres reglas de §1; reautorizar con otra propiedad se rechaza | Ficha (1); CA-37c |
| M16f-C-04 | Refresh correcto, refresh con rotación descartada, `invalid_grant` y `403` dan el estado de la tabla de errores; la desconexión no llama a Google y purga | Ficha (7); D-M16f-05 |
| M16f-C-05 | El preflight, incluido el de UTMs, deja cada capacidad en uno de sus cuatro estados; un informe opcional no disponible no se ejecuta ni se muestra como cero, y un informe base no disponible impide iniciar y cerrar la sincronización | Ficha (5); D-M16f-08 |
| M16f-C-06 | La extracción respeta los topes de §3, cuenta Admin, metadatos, compatibilidad, informes y reintentos entre las 25 llamadas, pide `returnPropertyQuota` solo en `runReport`, pagina sin duplicar ni perder filas, se reanuda desde el checkpoint y cierra solo cuando los informes del objetivo fijado por el preflight completan sus ventanas; nunca declara cobertura con un paso incompleto ni con un informe omitido | Ficha (2)(3); API oficial |
| M16f-C-07 | Cada cifra muestra fuente, propiedad, ventana, zona, moneda, fecha y banderas de su informe desde `public.ga4_report_quality` bajo RLS; las banderas se combinan entre todas las páginas antes de publicar y metadatos faltantes o incompatibles dejan la ventana incompleta. Un informe completo de cero filas conserva su calidad, y si esta falta la cifra es parcial. Cero, ausencia, parcial, provisional, restringido y «no disponible» se distinguen; usuarios nunca se suman entre días | Ficha (4); §17.1 |
| M16f-C-08 | Las cohortes de visitantes se calculan por primera sesión: un tamaño o activo oculto nunca se reconstruye por retención; N futuros no se convierten en cero y la disponibilidad de una celda ausente usa los desplazamientos de 30 días de `CohortsRange`, no `C + N` meses calendario; el intervalo abierto es provisional; se muestran aparte de las cohortes de compradores | D-M16f-02; H-E1-238; §17.4 |
| M16f-C-09 | Las tres comparaciones siguen las reglas de §4: umbral del 80 % y unicidad para productos, igualdad exacta y unicidad para campañas, y ningún cociente entre fuentes; dos `itemId` distintos con el mismo nombre conservan `item_ref` distintos y el ranking no los fusiona; con la otra fuente desconectada, todo sale «sin correspondencia» | D-M16f-09; §17.5 |
| M16f-C-10 | `anon`, otra empresa y el rol acotado no leen directo; `public.ga4_report_quality` solo se lee por membresía y conexión viva; la purga y el cierre dejan cero filas de GA4, incluidas calidad, claves de ítem e informe con sección de GA4, y Meta y Tiendanube intactas | INV-01/04; DEC-09; D-M16f-06 |
| M16f-C-11 | El chat responde sobre GA4 solo con las seis herramientas, sin IDs externos ni conteos o retenciones deducibles de celdas de menos de cinco, con el tope de 93 días salvo `ga4_cohortes`; abstención con `connection_not_active` y registro según §6 con tres fuentes | D-M16f-03; §17.11 |
| M16f-C-12 | Con GA4 activa, el diagnóstico suma la sección de tráfico del sitio sin atribuir; sin ella, el informe no cambia; los informes v1 y v2 siguen legibles; desconectar GA4 borra el informe con sección | D-M16f-03 |
| M16f-C-13 | Inicio, el menú y la página del chat reflejan el estado real de GA4 | D-M16f-10 |
| M16f-C-14 | Recorrido real con la propiedad del dueño: OAuth, preflight, sincronización, tráfico, cohortes y la comparación 1 validadas contra GA4 y Meta; las capacidades ecommerce validadas o rotuladas «no disponible»; evidencia redactada | Ficha; CB-05/06; D-M16f-08 |

## Casos de prueba

| ID | Criterios | Tipo | Comando | Resultado esperado | ¿Falla sin implementación? |
|---|---|---|---|---|---|
| M16f-T-01 | C-01, C-10 | pgTAP + app | `npm run db:check:test`; `npm run test:policies`; `npm run test:app` | La matriz de grants coincide con el encabezado de la migración; tres proveedores en una empresa; segunda GA4 viva rechazada; credencial `ga4` con otro scope o token rechazada; otra empresa aislada; `anon`, otra empresa y el rol acotado no leen `public.ga4_report_quality`, mientras el miembro de la empresa sí la lee por RLS; `issued_for_app_id` con puntos rechazado; pendiente vencida purgada; purga repetida deja cero filas de GA4, incluidas `ga4_report_quality` y `ga4_item_keys`, y Meta y Tiendanube intactas; purgar Tiendanube o Meta no falla por filas de GA4 | Sí |
| M16f-T-02 | C-02 | unit + app | `npm run verify`; `npm run test:app` | URL con scope exacto, `access_type=offline`, `prompt=consent` y sin `include_granted_scopes`; replay, vencido, otro navegador, denegación, sin `refresh_token` y scope extra no activan; logs y URL final sin `code` ni tokens | Sí |
| M16f-T-03 | C-03 | unit + app | `npm run verify`; `npm run test:app` | Subpropiedad, rollup, `deleteTime`, número fuera de la lista y reautorización con otra propiedad rechazados; host igual con y sin `www.`, host distinto y sin Tiendanube piden la confirmación correspondiente; sin flujo web no se activa | Sí |
| M16f-T-04 | C-04 | unit + app | `npm run verify`; `npm run test:app` | Cada fila de la tabla de errores produce su tipo, su `last_error_class` y su efecto; refresh con `refresh_token` nuevo no cambia la credencial y registra `rotacion_descartada` sin el valor; `runLazyPurge` con credencial `ga4` no hace llamadas de red; `403` o `invalid_grant` con la conexión `pending_selection` no cambian su estado, y con `active` la pasan a `needs_reauth` por `mark_needs_reauth` | Sí |
| M16f-T-05 | C-05 | unit | `npm run verify` | Metadata sin una métrica, combinación `INCOMPATIBLE`, embudo sin `purchase`, `REVENUE_DATA` restringido y 28 días sin `sessionManualCampaignId` útil (solo vacío o `(not set)`) dejan solo la capacidad afectada en su estado; sin ecommerce ni UTMs los informes base siguen disponibles, pero un informe base incompatible impide iniciar la sincronización; las solicitudes a Admin API, `getMetadata` y `checkCompatibility` no incluyen `returnPropertyQuota` | Sí |
| M16f-T-06 | C-05, C-06, C-07 | unit + app | `npm run verify`; `npm run test:app` | Backfill de 365 días en varios pasos encadenados: preflight solo en el primero y dentro de sus 25 solicitudes, contando Admin, metadatos, compatibilidad, informes y reintentos; el objetivo guarda solo los tres informes base y los opcionales disponibles; con ecommerce y UTMs no disponibles se omiten sus informes con motivo y sin cobertura, y `ga4_finish_sync` cierra tras los base, mientras un base no disponible impide iniciar o completar la sincronización y no llama a ga4_finish_sync; solo `runReport` lleva `returnPropertyQuota`, antes de su primera respuesta no se inventa saldo, y una respuesta sin `propertyQuota` deja «cuota no observada» sin saltarse el tope; `ga4_finish_sync` y el mapeo solo en el último paso, tope de 20 pasos por pulsación; `rowCount` de 25.000 con páginas de 10.000, `429`, cuota bajo el 10 %, `5xx` con reintentos, timeout y reinicio desde checkpoint: sin duplicados ni pérdidas y sin cobertura falsa; páginas con umbral, `(other)`, truncamiento y restricciones distintos combinan OR/unión y no permiten cero; `metadata: {}` se acepta con valores por omisión; `metadata` ausente, muestreo, `emptyReason`, moneda o zona discordantes dejan la ventana incompleta sin publicación ni checkpoint, y la calidad anterior intacta; informe completo con cero filas conserva su fila en `public.ga4_report_quality` y permite cero solo sin banderas, falta de calidad da parcial; `samplingMetadatas`, umbral, `(other)`, truncamiento, restricción, moneda, zona y `emptyReason` se proyectan por informe y ventana a las lecturas públicas de tráfico, fuente, embudo, producto, campaña y cohorte, también tras republicar; los últimos `GA4_PROVISIONAL_DAYS` días salen `provisional` y el incremental los reemplaza; cambio de zona marca `zona_distinta` | Sí |
| M16f-T-07 | C-07, C-08, C-13 | component + unit | `npm run verify` | La tarjeta distingue los siete estados; usuarios no sumados; tamaño 5 y activos 1 o 0 dejan activos y retención nulos, con «menos de 5», sin porcentaje recuperable; para una cohorte de enero, N=1 usa los límites del rango de adquisición +30 días y el 1 de marzo no se trata como febrero cerrado si el fin cae el 2 de marzo; casos de cohortes de febrero, abril y mayo cubren meses de 28, 30 y 31 días; N antes del inicio muestra «aún no disponible», el intervalo hasta fin + `GA4_PROVISIONAL_DAYS` es provisional y su fila ausente no es cero, mientras uno posterior, cubierto y sin banderas puede dar cero; rótulo «mes N de GA4» separado del de compradores; `getIntegraciones()` marca GA4 conectada solo con `active` | Sí |
| M16f-T-08 | C-09 | unit + pgTAP | `npm run verify`; `npm run test:policies` | Fixture con 85 % de `itemId` no vacíos iguales a variantes → regla adoptada; 70 % → rankings separados; un `itemId` con dos productos → regla rechazada; dos `itemId` distintos con el mismo `itemName` crean `item_ref` internos distintos, conservados al republicar y separados en el ranking sin regla; `itemId` vacío va a «sin ID» sin correspondencia; ni la UI ni la herramienta muestran el ID externo; `utm_id` exacto y único → campaña mostrada; parecido o duplicado → sin correspondencia; el 80 % se calcula sobre todos los `itemId` no vacíos guardados; un cambio de regla entre dos sincronizaciones reescribe todas las filas, y un paso incompleto no las toca; dos variantes del mismo producto se suman, y un producto muy visto fuera de los 50 más vendidos tiene sus unidades; Tiendanube o Meta desconectadas → todo «sin correspondencia» y regla oculta; monedas distintas de Meta y de la propiedad → gasto en la suya, sin conversión; ninguna salida con cociente entre fuentes | Sí |
| M16f-T-09 | C-08, C-11, C-12 | unit + app + pgTAP | `npm run verify`; `npm run test:app`; `npm run test:policies` | Seis herramientas con cifras iguales a SQL y sin IDs; `ga4_cohortes` no envía al modelo un conteo oculto ni su retención calculada, y diferencia N futuro de cero observado; 94 días rechazados salvo en `ga4_cohortes`, que acepta 12 cohortes y rechaza 13; `ga4_trafico` con `month` devuelve usuarios nulos con `no_aditivo`; capacidad no disponible devuelve ausencia; solo GA4 activa → habilita el chat y Meta y Tiendanube se abstienen; registro con tres fuentes según §6; diagnóstico con y sin GA4, parcial con sincronización vieja, v1 y v2 previos legibles, v3 sin `ga4_connection_id` o con una conexión de otro proveedor rechazado, v1 o v2 con `ga4_connection_id` rechazados, firma vieja de `publish_diagnostic` inexistente, desconectar GA4 borra el informe | Sí |
| M16f-T-10 | C-14 | manual en `app` | Recorrido redactado | Con la propiedad del dueño, después del acta: OAuth, selección, preflight con la matriz `checkCompatibility`, sincronización, conciliación de cada informe del catálogo con la interfaz de GA4 en siete días (o «no disponible»), gasto igual al de Meta en PRAXA, cohortes, capacidades ecommerce validadas o «no disponible», chat y diagnóstico; desconexión con purga verificada si el dueño lo acepta | No |
| M16f-T-11 | C-01–C-13 | integración | `npm run db:check:test`; `npm run verify`; `npm run test:policies`; `npm run test:app`; `git diff --check` | Todo verde, sin omisiones requeridas ni migraciones antiguas editadas, con la única salvedad de D-M16f-13 | Sí |
| M16f-T-12 | C-11, C-12 | eval con proveedor | `npm run test:eval` (chat y diagnóstico) | Respuestas sobre fixtures de GA4 | **No requerida para el gate**: solo con OK previo del usuario y costo estimado |

## Verificación

- `npm run db:check:test` antes de tocar el desechable. `npm run db:push:test` es acción del usuario.
- En cada etapa: `npm run verify`, `npm run test:policies` y `npm run test:app`. `verify` corre lint, typegen, typecheck, unit, component y build, pero no las otras dos.
- Revisión de diff, esquema expuesto y ausencia de secretos, IDs de propiedad, tokens y montos.
- Las suites usan solo el desechable y datos sintéticos. En `app` solo se hace el recorrido real (T-10), después del acta.
- Toda prueba requerida omitida cuenta como no ejecutada (CB-06). T-12 no es requerida.
- Evidencia en `meta_first/sesiones/M16f.md`, sin cifras reales ni IDs: comandos y resultados; matriz `checkCompatibility`; una respuesta sintética y una real redactada por informe del catálogo; conciliación por informe (o «no disponible»); cuotas consumidas; cobertura y ausencias; calidad; y la comparación validada.

## Intervenciones del usuario y acciones reservadas

| Paso | Qué hace el usuario | Cómo se verifica después |
|---|---|---|
| Antes del código | Aprobar spec, plan y acta ampliada (GA4, DeepInfra y Anthropic) | Textos aprobados y `PROJECT_STATE.md` actualizado |
| Antes de la etapa 1 | Seguir «Alta en Google Cloud», pasos 1 a 4, incluido el dominio autorizado | Línea del preflight de variables copiada a la sesión; categoría del scope y dominio autorizado anotados (H-07) |
| Cada migración | `npm run db:push:test` cuando el plan lo pida | `db:check:test` y suites con la migración aplicada |
| Antes de la publicación | Revisar en Supabase el historial de migraciones de `app` y confirmar que `0025` está aplicada; si no, aplicarla y publicar su código por separado | Historial de `app` con `0025` antes de las migraciones de GA4 |
| Fin del control `.3b` | Commit, integración en `main`, `db:push` de las migraciones 0, 1 y 2 en `app`, en orden, y despliegue | Historial de migraciones de `app` y versión publicada en la URL de producción |
| Etapa 4 | Comunicar el acta al dueño; revisar con él la medición y el consentimiento, y que conecte su propiedad y confirme el sitio (paso 5 del alta) | Acta comunicada y recorrido T-10 redactado |
| Cierre | Commit, push y aprobación de `G-GA4-FUSION` | Estado del gate en `PROJECT_STATE.md` |
| Opcional | OK para T-12, con costo estimado | Resultado registrado |
| Fin del piloto (`M28.3a`, CA-67) | Desconectar GA4 en PRAXA; en Google Cloud, quitar al dueño de los usuarios de prueba; pedirle al dueño que quite el acceso de PRAXA en su cuenta de Google | Purga verificada; usuario de prueba quitado y pedido al dueño anotados en la sesión de M28.3a |

El asistente nunca pide pegar secretos en el chat ni ejecuta acciones reservadas.

## Trampas y riesgos

- No se reutiliza el esquema de Meta con `default 'meta'` (II.14c): todo flujo nombra su proveedor.
- `analytics.readonly` lee todas las propiedades de la cuenta: la selección exige confirmación del dueño.
- Sin `prompt=consent`, reconectar no devuelve refresh token.
- Sin revocación remota (D-M16f-05), un refresh token desconectado sigue válido en Google hasta que vence; en Testing, 7 días. Riesgo aceptado, registrado en `SECURITY.md`.
- Modo Testing: reautorización semanal (D-M16f-07). No es un defecto de sincronización.
- `runReport` omite las filas en cero; las combinaciones incompatibles gastan cuota de errores; los usuarios no son aditivos.
- Cambiar la zona de la propiedad no es retroactivo.
- La moneda de GA4 puede diferir de la de Meta: nunca se suman ni se dividen.
- `itemId`, `utm_id` y los eventos ecommerce dependen de cómo se instrumentó la tienda; casi nunca hay `utm_id` igual al ID de campaña.
- La cuenta de Meta del piloto no tuvo actividad en M16c: la comparación 1 puede validarse con gasto cero, que no prueba el cruce con valores; se registra como limitación.
- Sin cuenta demo (D-M16f-11), el primer uso real del conector es con la propiedad del dueño.
- Al implementar una API de Next, leer antes `node_modules/next/dist/docs/`. No editar migraciones antiguas ni usar `service_role` fuera del contrato.

## Decisiones de la microfase

| ID | Decisión | Motivo | Decidió | Fecha |
|---|---|---|---|---|
| D-M16f-01 | Redactar la spec de GA4 como borrador antes de la enmienda | Convertir la investigación en spec | Usuario (pedido) | 2026-11-12 |
| D-M16f-02 | Solo agregados por día y por cohorte; ninguna unión de visitantes con compradores; cohortes de primera sesión separadas de las de Tiendanube. Cierra H-E1-238 por alcance | La Data API entrega agregados | Usuario | 2026-11-15 |
| D-M16f-03 | GA4 entra al chat con herramientas cerradas y al diagnóstico con una sección, como Tiendanube (antes: chat fuera) | Pedido del usuario | Usuario | 2026-11-15 |
| D-M16f-04 | Completar la spec con la referencia de API, la clasificación de errores, `prompt=consent` y el alta en Google Cloud | Pedido del usuario | Usuario (pedido) | 2026-11-12 |
| D-M16f-05 | Desconexión con revocación solo local: PRAXA no llama a Google | Coincide con la ficha; el MVP no escribe en sistemas externos | Usuario | 2026-11-15 |
| D-M16f-06 | Se autoriza la excepción de borrado de la sección 7 y la línea en `AGENTS.md` | §17.6 | Usuario | 2026-11-15 |
| D-M16f-07 | App de Google en modo Testing para el piloto; reautorización cada 7 días aceptada; publicación y verificación, fuera | Sin costo ni revisión de Google | Usuario | 2026-11-15 |
| D-M16f-08 | Gate: obligatorios conexión, tráfico, cohortes de visitantes y una comparación real; lo ecommerce, solo si hay eventos, y si no, «no disponible» con la excepción anotada (decisión 4 de §17.8) | Ficha, condición para avanzar | Usuario | 2026-11-15 |
| D-M16f-09 | Comparaciones: visitas frente a gasto de Meta, productos vistos frente a vendidos y campañas por `utm_id`. Sin ventas de Tiendanube frente a compras de GA4; la ficha deja de pedir el mapeo de pedido (decisión 5 de §17.8) | Elección del usuario | Usuario | 2026-11-15 |
| D-M16f-10 | UI dentro de Integraciones; enmienda puntual de II.14c para `lifecycle.ts`, `actions.ts`, `app-data`, diagnóstico, página y componente del chat, pgTAP existentes, `entorno.md` y el preflight | Mínimo de archivos fuera de la ruta | Usuario | 2026-11-15 |
| D-M16f-11 | Sin pruebas con la cuenta demo de GA4: el primer uso real es con la propiedad del dueño; sin excepción a CB-04 | Elección del usuario | Usuario | 2026-11-15 |
| D-M16f-12 | Excepción de CA-70 para `ga4_cohortes`: hasta 12 cohortes y 12 meses N, como `tn_cohortes`. Agregada a §17.11 de la ruta | Mirar retención de visitantes y de compradores lado a lado | Usuario | 2026-11-15 |
| D-M16f-13 | Los controles de etapa, incluida la corrida integral T-11, admiten las fallas de `meta-sync` y `meta-precision` causadas por H-E1-241, igual que en M26a y M16e | El desfase es del reloj del equipo, no de M16f | Usuario | 2026-11-15 |

Decisiones técnicas del asistente, sin elección de negocio: valor `ga4` y tipo `google_refresh_token`; propiedad guardada como número; `issued_for_app_id` como prefijo numérico del client ID; rotación del refresh token descartada; sin PKCE (§1); `sessionManualCampaignId` como clave de campaña; referencias sin FK a otras fuentes (§3); verificación del sitio solo con `original_domain`; catálogo, topes y umbral del 80 % (§2–§4). La auditoría puede objetarlas.

## Supuestos e hipótesis

- **M16f-H-01:** el dueño tiene una propiedad GA4 de la tienda, con lectura y un flujo web. Se verifica en la etapa 4.
- **M16f-H-02:** existen `view_item`, `add_to_cart`, `begin_checkout` y `purchase` con `item_id`. Lo verifica el preflight; si falta, D-M16f-08.
- **M16f-H-03:** `item_id` corresponde a una variante, un producto o un SKU de Tiendanube. Lo decide la regla del 80 % de §4.
- **M16f-H-04:** los topes de §3 alcanzan para el volumen del piloto. Se mide en la etapa 4; un cambio de tope se registra en la sesión.
- **M16f-H-05:** la propiedad tiene datos suficientes para validar la comparación 1. Sin ellos, el gate queda abierto.
- **M16f-H-06:** los últimos días son provisionales. Se mide qué días cambian entre dos extracciones y se ajusta `GA4_PROVISIONAL_DAYS`.
- **M16f-H-07:** `analytics.readonly` es sensible y el modo Testing alcanza para el piloto. Se verifica en la consola antes de la etapa 1.
- **M16f-H-08:** `itemId` es compatible con las métricas de ítem del catálogo. Lo verifica `checkCompatibility`.
- **M16f-H-09:** los cuerpos del canje y del refresh son los de la referencia. Se verifican contra la página oficial antes del código y en T-10.
- **M16f-H-10:** sin `include_granted_scopes`, Google devuelve exactamente el scope pedido. Si devuelve otro, la conexión no se activa y la hipótesis se reabre como hallazgo.
- **M16f-H-11:** la respuesta del refresh no trae un refresh token nuevo. Se verifica en T-10. Si Google rotara e invalidara el anterior, la conexión pasaría a `needs_reauth` y se registra un hallazgo para guardar la rotación.
- **M16f-H-12:** la CLI de Supabase aplica cada archivo de migración en su propia transacción, así que `ga4` queda confirmado antes de la migración 1. Se verifica con `db:push:test` en la etapa 1. Si fallara, la microfase se detiene y la spec se corrige para recrear el tipo completo (FK, columnas y las tres funciones con sus grants) antes de escribir la migración.

## Preguntas abiertas

Ninguna. Las Q-01 a Q-08 de la versión del 2026-11-12 quedan resueltas: Q-01 por la enmienda (orden `G-TIENDA` → `M16f` → `M28.3a`); Q-02 por D-M16f-08; Q-03 y Q-04 por D-M16f-09 y §4; Q-05 por D-M16f-07; Q-06 por D-M16f-03; Q-07 por D-M16f-05; Q-08 por §1 (sin PKCE).

## Hallazgos relacionados

| Hallazgo | Estado actual | Cómo lo cierra M16f para GA4 |
|---|---|---|
| H-E1-236 | Resuelto para Tiendanube; pendiente para GA4 | C-01 y T-01: tres proveedores con una conexión viva por proveedor |
| H-E1-237 | Resuelto para Tiendanube; pendiente para GA4 | Acta ampliada para GA4 aprobada y comunicada antes del primer dato real |
| H-E1-238 | Alcance decidido por D-M16f-02 | Se cierra al aprobar `G-GA4-FUSION` con C-08 cumplido |
| H-E1-234 | Resuelto en la ruta | Rige la nota «Enmienda H-E1-228» también para las herramientas de GA4 |
| H-E1-228 | Abierto (remedición de VR-02) | M16f no lo cierra; las herramientas de GA4 heredan su régimen |
| H-E1-241 | Abierto (reloj del equipo ~0,5 s adelantado) | M16f no lo cierra; salvedad acotada en los controles (D-M16f-13) |
| H-E1-259 (migración `0025`) | `db:push` en `app` sin confirmar (el usuario no sabe si se aplicó, 2026-11-15) | Antes de la publicación de M16f, el usuario revisa el historial de migraciones de `app`. Si `0025` falta, se aplica y se publica su código por separado, antes de las migraciones de GA4, para no mezclar cambios |

## Auditorías

- [spec-audit-1](revisiones/spec-audit-1.md) (2026-11-15): REQUIERE CAMBIOS; A-01 a A-14 integrados.
- [spec-audit-2](revisiones/spec-audit-2.md) (2026-11-15): REQUIERE CAMBIOS; A-01 a A-14 integrados (A-01 y A-14 por D-M16f-12 y D-M16f-13).
- [spec-audit-3](revisiones/spec-audit-3.md) (2026-11-15): REQUIERE CAMBIOS; A-01 y A-03 a A-11 integrados; A-02 resuelto por decisión del usuario (H-E1-261).
- [spec-audit-4](revisiones/spec-audit-4.md) (2026-11-15): REQUIERE CAMBIOS; A-01 a A-05 integrados; A-06 es una observación sobre `0025`, ver «Hallazgos relacionados».
- [spec-audit-5](revisiones/spec-audit-5.md) (2026-11-15): REQUIERE CAMBIOS; A-01 a A-05 corregidos por pedido del usuario en este borrador. A-06 (exit 0 de `verify` en la base) sigue pendiente; las correcciones necesitan nueva auditoría.
- [spec-audit-6](revisiones/spec-audit-6.md) (2026-11-15): REQUIERE CAMBIOS; A-01 a A-03 corregidos por pedido del usuario; el usuario aprobó esta spec el 2026-11-15. A-04 (exit 0 de `verify` en la base) sigue pendiente como control previo al código; falta una nueva auditoría de las correcciones.
