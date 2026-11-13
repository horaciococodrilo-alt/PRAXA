# M16f — Conector GA4 y comparación entre fuentes

**Estado:** BORRADOR

**Bloqueo de entrada — REQUIERE CAMBIO EN LA RUTA.** `meta_first/plan.md` Parte I y `meta_first/spec.md` §2 excluyen GA4 y conexiones adicionales. No hay ficha `M16f`, Parte II, CA heredados ni gate `G-GA4-FUSION` aprobados. Esta spec desarrolla la [propuesta del 2026-11-12](../meta_first/revisiones/propuesta-conectores-tiendanube-ga4-2026-11-12.md) para revisión; no autoriza implementación ni captura real. El usuario exceptuó expresamente a M16e y M16f del límite de ocho horas; el resto de `AGENTS.md` sigue vigente.

**Entrada propuesta:** enmienda aprobada de la ruta, acta de datos ampliada y comunicada al dueño, `G-DIAG` y `G-TIENDA` cerrado con datos reales de Tiendanube; Meta debe conservar sus gates. Hoy M16e es solo borrador y `PROJECT_STATE.md` aún informa plan pendiente para M26a. **Salida propuesta:** `G-GA4-FUSION`; no habilita M28.3a hasta que la ruta lo establezca expresamente.

**Hash de contenido:** al auditar, excluir solo la línea `**Estado:**` y pasar los bytes restantes a `git hash-object --stdin`, según `docs/_templates/mf-spec.md`.

## Fuentes

- `AGENTS.md`, `docs/_templates/mf-spec.md`; HEAD leído `0e871be`, más cambios preexistentes de M26a y `PROJECT_STATE.md` que esta spec no modifica.
- Ruta actual: `docs/FASES/FASE1/meta_first/plan.md` I.1–I.4, II.4, II.10–II.11 y III.2–III.3/III.9; `meta_first/spec.md` §§1–2, 7–11, 14. **No hay ficha ni Parte II de M16f**: todos los archivos de ejecución exigen enmienda.
- `docs/PROJECT_STATE.md`; `docs/HALLAZGOS.md` H-E1-236, H-E1-237, H-E1-238, H-E1-234 y H-E1-228; `docs/FASES/FASE1/M03a/acta-meta.md`; `docs/FASES/FASE1/M16e/spec.md` (borrador, no dependencia aprobada).
- `docs/SECURITY.md` §§1–9, 12; `docs/ARCHITECTURE.md` §§«Módulos y responsabilidades», «Base de datos», «Los dos caminos de una operación», «Concurrencia» y «Ausencia de workers».
- Evidencia de `meta_first/sesiones/M06.1a-M06.2a.md`, `M06.3a.md`, `M16.2.md`, `M16c.md`, `M25a.md`: valida patrones de privilegio/cifrado/OAuth/sync/chat existentes, no una integración GA4.
- Código contrastado: `supabase/migrations/0012_integrations.sql`, `0016_meta_insights.sql`, `0018_chat_queries.sql`; `src/modules/integrations/{contract,crypto,db,repository,meta}/`, `lifecycle.ts`, `actions.ts`; `src/modules/tenant/context.ts`; `src/modules/chat/`; `src/app/(app)/app/integraciones/`; `tests/{unit,app,component}/`; `supabase/tests/09_integration_privileges.test.sql`, `10_demo_closure.test.sql`; `package.json` y `vitest.config.mts`.
- Documentación oficial consultada el 2026-11-12: [OAuth web de Google](https://developers.google.com/identity/protocols/oauth2/web-server), [OAuth y modo Testing](https://developers.google.com/identity/protocols/oauth2/), [accountSummaries](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/accountSummaries/list), [Data API schema](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema), [cohortSpec](https://developers.google.com/analytics/devguides/reporting/data/v1/advanced), [getMetadata](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/getMetadata), [checkCompatibility](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/checkCompatibility), [runReport](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport), [cuotas](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas), [calidad y frescura](https://developers.google.com/analytics/devguides/reporting/data/v1/reporting-data-expectations), [ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce), [BigQuery Export](https://support.google.com/analytics/answer/12675187), [prohibición de PII](https://support.google.com/analytics/answer/6366371) y [verificación pública de OAuth](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).
- Segunda lectura oficial del 2026-11-12 para completar el proceso de extremo a extremo: [CohortSpec](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/CohortSpec), [ResponseMetaData](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData), [errores](https://developers.google.com/analytics/devguides/reporting/data/v1/errors), [recurso Property](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties#Property), [DataStream](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.dataStreams#DataStream), [retención de datos](https://support.google.com/analytics/answer/7667196) y los changelogs de ambas APIs. Resultado en «Referencia de API verificada». Lo que la documentación no declara se marca como hipótesis.

## Objetivo

Conectar de forma acotada una propiedad GA4 de la tienda, extraer informes agregados reproducibles de tráfico y ecommerce, mostrar cohortes de **primera sesión** y comparar esos datos con Tiendanube y Meta solo cuando las claves, períodos, zonas y definiciones lo permitan. Cada resultado debe revelar su procedencia, cobertura y limitaciones de medición. El objetivo y `G-GA4-FUSION` son **propuestos**, sujetos a la enmienda de la ruta.

## Alcance

1. OAuth web de Google con `analytics.readonly`, estado de un uso vinculado a actor/empresa/navegador, refresh token cifrado y selección de una propiedad accesible mediante Admin API. Confirmar con el dueño que la propiedad corresponde al sitio conectado.
2. Preflight de stream/dominio e instrumentación ecommerce. Leer Data API con catálogo cerrado de informes, metadatos, compatibilidad, paginación y cuotas; registrar cobertura, fecha, zona y banderas de calidad. Sin instrumentación, la capacidad afectada queda indisponible.
3. Guardar exclusivamente agregados y metadatos mínimos por propiedad, consulta, ventana y versión. Lectura bajo RLS, escrituras por `worker_api` acotada, sincronización manual reanudable y purga idempotente al desconectar o perder autorización.
4. Cohortes de visitantes por `firstSessionDate`; vistas de tráfico, embudo y productos observados/comprados según datos disponibles. Cruce descriptivo con cohortes de compradores de Tiendanube, productos de la tienda y gasto de Meta solo cuando exista mapeo verificable y una definición aprobada.
5. UI de conexión, preflight, estados y comparaciones con ausencia, cero, frescura y calidad diferenciados; pruebas sintéticas, SQL y recorrido real redactado. El chat permanece fuera hasta decisión de ruta y acta específica.

## Fuera de alcance

- Instrumentar o modificar la tienda, Google Tag Manager, Measurement Protocol, Analytics, Meta o Tiendanube; el MVP es de lectura sobre esos sistemas.
- Unir eventos o usuarios individuales GA4 con clientes de Tiendanube; `runReport` entrega agregados. BigQuery Export, User-ID y cualquier solución de identidad de persona son otra decisión y otra microfase. Nunca enviar PII a Analytics.
- Afirmar atribución causal de Meta, ROAS unificado o coincidencia de compradores por fecha/campaña; si `utm_id` no identifica una campaña Meta de manera exacta, mostrar fuentes separadas.
- Publicación de una app Google para múltiples comerciantes, verificación OAuth pública, operaciones automáticas sin presupuesto, cambio de moneda sin tipo de cambio aprobado, escritura por LLM, reportes exportables o expansión del chat/M26a.
- Aplicar migraciones o desplegar en producción como parte de esta spec.

## Contexto verificado en el código

| Qué | Dónde (archivo:línea) | Implicación |
|---|---|---|
| Proveedor SQL enum solo `meta`; índice de una conexión viva por empresa | `supabase/migrations/0012_integrations.sql:213`, `:349` | M16e debe generalizar ambos y probar Meta+Tiendanube; M16f agrega GA4 sin recuperar el límite de una conexión |
| Contrato Zod solo `meta`; credencial exige `ads_read` y tipo `system_user` | `src/modules/integrations/contract/primitives.ts:40`; `src/modules/integrations/contract/credential.ts:28-60` | GA4 necesita discriminante, scope `analytics.readonly` y tipo OAuth de Google, sin aflojar Meta |
| K03 exige moneda/zona en conexión activa | `src/modules/integrations/contract/connection.ts:64-97` | La zona de la propiedad se valida; moneda GA4 no se interpreta como moneda de cada transacción |
| Lectura viva asume una conexión; lectura de Meta sí filtra | `src/modules/integrations/repository/connections.ts:31-62`, `:67-83` | Depende de M16e; el selector GA4 también debe filtrar proveedor y propiedad |
| RPC privilegiadas están enumeradas con casts y errores redactados | `src/modules/integrations/db/worker-api.ts:9-15`, `:61-101`, `:146-167` | Añadir únicamente funciones y errores tipados, sin lecturas directas del rol |
| K01 obtiene empresa del servidor | `src/modules/tenant/context.ts:37-43` | No aceptar `company_id`, propiedad o pertenencia de un parámetro de navegador |
| Purga de integración fue reemplazada por chat | `supabase/migrations/0018_chat_queries.sql:196-230` | Una migración nueva conserva firma/cadena de purga e incluye GA4 |
| UI y acciones de conexión son Meta específicas | `src/app/(app)/app/integraciones/page.tsx:25-38`, `:74-110`; `src/modules/integrations/actions.ts:11-13` | Crear entrada GA4 sin interpretar `?meta` como resultado GA4 |
| El chat usa catálogo/herramientas y la base bajo RLS | `src/modules/chat/orchestrator.ts:85`, `:291-295`; `docs/ARCHITECTURE.md:231-233` | No añadir GA4 al LLM por analogía; requerir ruta y acta |
| `verify` no incluye app ni pgTAP | `package.json:17-27` | Ejecutar `npm run test:app` y `npm run test:policies`/`npm run db:check:test` por separado |

## Referencia de API verificada (2026-11-12)

Fuente: documentación oficial de Google leída el 2026-11-12. Es el contrato de partida; cada etapa lo contrasta con respuestas reales. **«No documentado» significa que no figura en las páginas leídas y pasa a hipótesis.** Los nombres de dimensiones y métricas que solo se pudieron leer en resúmenes se validan contra `getMetadata` en el preflight, que es la fuente autoritativa de nombres de cada propiedad.

### OAuth, Admin API y Data API

| Tema | Valor documentado | Implicación |
|---|---|---|
| OAuth: autorización | `GET https://accounts.google.com/o/oauth2/v2/auth` con `client_id`, `redirect_uri` (coincidencia exacta con la URI autorizada: esquema, mayúsculas y barra final), `response_type=code`, `scope`, `access_type=offline`, `state`, opcionales `include_granted_scopes`, `login_hint` y `prompt` (`none`, `consent`, `select_account`) | Una sola URI por entorno, registrada tal cual en Google Cloud |
| OAuth: canje y refresh | `POST https://oauth2.googleapis.com/token`. Canje: `code`, `client_id`, `client_secret`, `redirect_uri`, `grant_type=authorization_code`. Refresh: `client_id`, `client_secret`, `grant_type=refresh_token`, `refresh_token`. Respuesta: `access_token`, `expires_in`, `scope`, `token_type:"Bearer"`, y `refresh_token` solo en el canje (detalle de los cuerpos leído de un resumen: confirmar al implementar) | El access token vive solo en memoria; el refresh token se cifra |
| **Refresh token: solo la primera vez** | Con `access_type=offline`, el `refresh_token` «solo se devuelve en la primera autorización». Para otro hay que revocar el acceso previo o pedir `prompt=consent` | **Corrige el borrador**: si se desconecta localmente sin revocar y se vuelve a conectar, Google no devuelve refresh token y la conexión queda inservible. Ver §1 |
| Revocación | `POST https://oauth2.googleapis.com/revoke` (leído de un resumen; verificar en la página al implementar) | Intento de revocación en la desconexión, como Meta (CA-38). M16f-Q-07 |
| Vida del refresh token | Se invalida si el usuario revoca, si no se usa en **6 meses**, si la cuenta supera el máximo de tokens vivos (**100 por cuenta y client ID**; el más viejo se invalida sin aviso), o por política del administrador de Workspace. En modo `Testing`, **7 días** salvo scopes de perfil básico. `invalid_grant`: «puede haber expirado o haber sido invalidado» | `invalid_grant` → `needs_reauth`. En el piloto, `Testing` implica reautorizar cada 7 días: no es un defecto de sincronización (M16f-Q-05) |
| Scope | `https://www.googleapis.com/auth/analytics.readonly`. No figura entre los scopes **restringidos**. La clasificación «sensible» no figura en las páginas leídas: la Consola de Google Cloud la indica en la pantalla de consentimiento. Los scopes sensibles requieren revisión de Google para uso público (hasta ~10 días) | Confirmar la categoría en pantalla. No hace falta verificación mientras se use `Testing` con usuarios de prueba; el tope de usuarios de prueba no figura en las páginas leídas |
| PKCE | `code_challenge` no aparece en las páginas leídas | M16f-Q-08 |
| Admin API | **v1beta** (no se encontró v1 estable). `GET https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200` (defecto 50, máx. 200, `nextPageToken`). `AccountSummary`: `account`, `displayName`, `propertySummaries[]{property, displayName, propertyType, parent, canEdit}`. Scope: `analytics.readonly` | Enumerar propiedades; filtrar `PROPERTY_TYPE_ORDINARY` (excluir `SUBPROPERTY` y `ROLLUP`) |
| Propiedad | `GET /v1beta/properties/{id}`: `timeZone` (IANA, obligatoria; cambiarla «no es retroactivo»), `currencyCode` (ISO 4217), `deleteTime` (si está en la papelera), `serviceLevel`, `propertyType` | Zona y moneda de reporte salen de aquí, nunca de la tienda. Una propiedad con `deleteTime` no se activa |
| Flujo de datos | `GET /v1beta/properties/{id}/dataStreams`: `type` (`WEB_DATA_STREAM`, …), `webStreamData{measurementId, defaultUri}` | **`defaultUri` permite comprobar el dominio contra el de la tienda Tiendanube** (`original_domain`, `domains`, `url_with_protocol`): una verificación automática de «es el sitio de la tienda», además de la confirmación del dueño |
| Data API | **v1beta**. `POST https://analyticsdata.googleapis.com/v1beta/properties/{id}:runReport` (la propiedad va en la ruta, no en el cuerpo). Cuerpo: `dimensions`, `metrics`, `dateRanges`, `dimensionFilter`, `metricFilter`, `offset`, `limit`, `orderBys`, `currencyCode`, `cohortSpec`, `keepEmptyRows`, `returnPropertyQuota`. `limit`: 10.000 por defecto, **máx. 250.000**; `offset` en base 0. `currencyCode` vacío = moneda de la propiedad | Los filtros de dimensión y de métrica no se mezclan. No hay v1 ni cambios incompatibles en 2026 |
| Filas vacías | `keepEmptyRows` falso o ausente: las filas con **todas las métricas en cero no se devuelven** | «Fila ausente» no equivale a «cero medido»: solo lo es si el informe fue completo y sin umbral ni `(other)` (ver §3) |
| Metadatos de calidad | `metadata`: `samplingMetadatas[]{samplesReadCount, samplingSpaceSize}`, `dataLossFromOtherRow`, `subjectToThresholding`, `schemaRestrictionResponse{activeMetricRestrictions}` (tipos `COST_DATA`, `REVENUE_DATA`), `currencyCode`, `timeZone`, `emptyReason`, y desde 2026-09 `dataTruncationReasons[]` (incluye truncamiento de métricas ecommerce de ítem y de evento) | Se persisten todos. `REVENUE_DATA` restringido por roles de la propiedad oculta ingresos: estado «restringido», no cero |
| Compatibilidad | `POST …:checkCompatibility` (mismo `dimensions`/`metrics`/filtros que `runReport`; respuesta `dimensionCompatibilities[]` y `metricCompatibilities[]` con `COMPATIBLE`/`INCOMPATIBLE`). `GET …/properties/{id}/metadata` lista dimensiones y métricas, incluidas las personalizadas (`customEvent:`, `customUser:`) | Las combinaciones incompatibles **cuentan contra una cuota de errores de cliente** (changelog 2024-06): validar con `checkCompatibility`, no por prueba y error |
| Cuotas (propiedad Standard) | Tokens `Core`: **200.000/día**, **40.000/hora** por propiedad y **14.000/hora** por proyecto y propiedad; **10 solicitudes concurrentes** por propiedad; **10 errores de servidor (500/503) por hora**. La mayoría de las solicitudes cuestan ≤ 10 tokens; el costo exacto se decide al ejecutar. `returnPropertyQuota:true` devuelve el consumo. Agotada: `429 RESOURCE_EXHAUSTED`. `batchRunReports`: hasta 5 informes, cada uno cuenta por separado | La sincronización es serial (≤ 1 solicitud en vuelo por propiedad) y registra `propertyQuota` por informe |
| Límites por solicitud | Nº máximo de dimensiones, métricas y `dateRanges` **no figura** en las páginas leídas | El catálogo fija topes propios conservadores y `checkCompatibility`/`getMetadata` los validan; no se afirma «9 dimensiones y 10 métricas» sin fuente |
| Cohortes | `cohortSpec{cohorts[], cohortsRange, cohortReportSettings}`. `cohorts[].dimension`: **solo `firstSessionDate`**. `dateRange` obligatorio en la cohorte y `dateRanges` del informe **debe quedar sin especificar**. Nombre de cohorte: no puede empezar por `cohort_` ni `RESERVED_`. `cohortsRange.granularity`: `DAILY`, `WEEKLY`, `MONTHLY` (obligatoria); `endOffset` obligatorio (el desplazamiento se multiplica por 1, 7 o 30 días); `startOffset` normalmente 0. `accumulate` **no se admite** en `runReport`. Con cohortes, la dimensión `cohort` es obligatoria. Dimensiones `cohortNthDay`/`Week`/`Month`; métricas `cohortActiveUsers` y `cohortTotalUsers` | La retención es el cociente `cohortActiveUsers/cohortTotalUsers` calculado en SQL/servidor, no una métrica nativa. No documentado: nº máximo de cohortes por solicitud |
| Dimensiones y métricas del catálogo | Documentadas literalmente: `date` (`YYYYMMDD`), `eventName`, `firstSessionDate`, `itemId`, `itemName`, `transactionId`, `sessionSourceMedium`, `sessionCampaignId`, `sessionManualCampaignId`, `activeUsers`, `ecommercePurchases`. Solo en resúmenes (validar con `getMetadata`): `itemsViewed`, `itemsAddedToCart`, `itemsPurchased`, `itemRevenue`, `purchaseRevenue`, `sessions`, `newUsers`, `totalUsers`, `keyEvents`. **`conversions` está deprecada (2024): se usa `keyEvents`** | El catálogo no fija nombres que `getMetadata` no confirme para la propiedad |
| Frescura y retención | Los datos «tardan en procesarse»; la página de frescura de la Data API no se pudo identificar. La retención configurable (2 o 14 meses) «solo afecta a exploraciones y a informes de embudo» | Los informes estándar no dependen de esa retención. La frescura no se asume: M16f-H-06 |
| Errores | `400 INVALID_ARGUMENT`, `401 UNAUTHENTICATED`, `403 PERMISSION_DENIED` (sin acceso a la propiedad), `429 RESOURCE_EXHAUSTED`, `500 INTERNAL` y `503 UNAVAILABLE` (reintento con espera exponencial). No hay código específico para dimensiones incompatibles | Ver clasificación siguiente |
| Cambios 2026 | Data API: `dataTruncationReasons` (2026-09-14), `properties.chat` y reportes de conversión en `v1alpha` (no se usan). Admin API: solo `v1alpha`. Sin deprecaciones relevantes en 2026 | Reverificar los changelogs al implementar; nunca `v1alpha` |

### Clasificación de errores propuesta (patrón CA-39 de Meta)

| Señal | Tipo | Efecto sobre la conexión |
|---|---|---|
| `invalid_grant` o `401` tras un refresh correcto | `autorizacion_perdida` | `needs_reauth` |
| `403` en Data API/Admin API | `sin_acceso_propiedad` | `needs_reauth`: el usuario perdió el acceso a la propiedad; no se purga |
| `429` (cuota diaria/horaria/concurrencia) | `cuota` | Informe incompleto; se registra `propertyQuota`; sin reintento en bucle |
| `500`/`503`, timeout, red | `transitorio` | Reintento con espera exponencial y presupuesto; más de 10 errores 5xx/hora detiene la ejecución |
| `400` | `consulta_invalida` | Defecto de PRAXA o incompatibilidad: capacidad deshabilitada con causa, sin cambio de estado |
| Propiedad con `deleteTime` | `propiedad_eliminada` | Conexión no activable; mensaje al dueño |
| Cualquier otro | `desconocido` | Sin cambio de estado de la conexión |

### Alta en Google Cloud (acción del usuario, sin secretos en el chat)

1. Crear un proyecto de Google Cloud dedicado a PRAXA y habilitar **Google Analytics Data API** y **Google Analytics Admin API**.
2. Configurar la pantalla de consentimiento: audiencia **Externa**, estado **Testing**; agregar como usuario de prueba la cuenta de Google que tiene acceso a la propiedad GA4 de la tienda. Confirmar en pantalla el scope `analytics.readonly` y su categoría.
3. Crear un cliente OAuth de tipo **Aplicación web** y registrar la URI de redireccionamiento exacta de PRAXA (una por entorno; coincidencia estricta de esquema, mayúsculas y barra final). La ruta la fija el plan.
4. Cargar `client_id` y `client_secret` solo en `.env.local` y Vercel.
5. Comprobar que esa cuenta tiene al menos permiso de lectura sobre la propiedad y que el flujo de datos web corresponde al dominio de la tienda.
6. Para un uso que no sea el piloto controlado (más cuentas o sin reautorizar cada 7 días) hace falta publicar la app y, si el scope es sensible, pasar la verificación de Google: otra decisión (M16f-Q-05).

## Diseño concreto propuesto

### 1. Identidad, OAuth y propiedad

El dueño inicia con K01 derivado de `requireTenantContext()`; se crea un K02 de propósito `initial` o `reauth` para proveedor `ga4`, ligado a actor, empresa, navegador, expiración y generación esperada. El `state` usa entropía de al menos 32 bytes y se consume atómicamente una vez. Callback y error redirigen a ruta limpia con `Referrer-Policy: no-referrer`; no se guardan ni registran `code`, tokens o respuesta OAuth. La solicitud pide solo `https://www.googleapis.com/auth/analytics.readonly`, con `access_type=offline` y **`prompt=consent` en todo intento `initial` o `reauth`**. Google solo entrega el refresh token en la primera autorización de una cuenta y un cliente; sin `prompt=consent`, volver a conectar después de una desconexión local devolvería un acceso sin refresh token e inservible. Como estos intentos son raros y los inicia el dueño, forzar el consentimiento no molesta al uso diario. La respuesta debe traer `scope` con `analytics.readonly` y un `refresh_token`; si falta cualquiera, la conexión no se activa y se pide repetir. [OAuth web](https://developers.google.com/identity/protocols/oauth2/web-server).

Se cifra el refresh token con AES-GCM existente y AAD de empresa/conexión/**ga4**; access tokens viven solo en memoria durante la solicitud. Si Google rota o devuelve un refresh nuevo, se sustituye bajo generación esperada; si no devuelve otro, se conserva el anterior. Al desconectar, tras bloquear la lectura y antes de destruir la credencial, se intenta revocar el refresh token en Google (secuencia análoga a CA-38 de Meta, resultado registrado sin valores); la purga local no depende de que Google responda. Una cuenta admite 100 refresh tokens por cliente: reconectar muchas veces invalida el más antiguo sin aviso, lo que es inocuo con una conexión viva por empresa. Un refresh inválido, ausencia de refresh token o pérdida de permiso dejan estado tipado de reautorización, sin filtrar detalles de Google. El modo OAuth `External/Testing` puede expirar el refresh a los siete días; el piloto lo comprueba en configuración y no interpreta esa expiración como un defecto de sincronización. [OAuth](https://developers.google.com/identity/protocols/oauth2/).

Admin API `accountSummaries.list` enumera solo propiedades accesibles con ese token. El navegador puede proponer una de esa lista, pero el servidor verifica de nuevo su pertenencia y datos antes de activar la conexión. Se almacena una única propiedad GA4 activa por empresa, enlazada a la tienda del M16e y con `property_id`, stream/dominio verificado, zona IANA y moneda de reporte leída. Un ID escrito arbitrariamente nunca concede acceso. Solo se ofrecen propiedades `PROPERTY_TYPE_ORDINARY` sin `deleteTime`. La verificación del sitio compara el host de `webStreamData.defaultUri` de un flujo web de la propiedad con los dominios de la tienda Tiendanube conectada (`original_domain`, `domains`, `url_with_protocol`); la coincidencia es una condición necesaria y el dueño la confirma, no la reemplaza. Si no se puede demostrar que es el sitio de la tienda, la conexión queda pendiente. Desconectar destruye credencial y agregados GA4, sin afectar las otras dos conexiones.

### 2. Catálogo de consultas e instrumentación

Un catálogo versionado del servidor describe cada informe con dimensiones, métricas, filtros, rango máximo, granularidad, costo admisible y claves publicables. Las familias iniciales son: tráfico diario por `date` + fuente/medio/campaña; embudo ecommerce por evento; productos por `itemId` con vistas, agregados al carrito y compras cuando sean compatibles; `cohortSpec` por `firstSessionDate`. Antes de ejecutar una combinación se consultan `getMetadata` y `checkCompatibility`; una dimensión/métrica incompatible queda deshabilitada con causa específica. No se inventan columnas ni se promedian ratios entre filas. [Esquema](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema), [compatibilidad](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/checkCompatibility), [cohortes](https://developers.google.com/analytics/devguides/reporting/data/v1/advanced).

El preflight comprueba propiedad/stream/dominio, zona, moneda, período, presencia verificable de `view_item`, `add_to_cart`, `begin_checkout`, `purchase`, `transaction_id`, `item_id` y `utm_id` cuando se pretenda usar el cruce correspondiente. Para eventos ausentes se registra «sin instrumentación comprobada», no cero. La medición pasada no se reconstruye. El dueño aprueba la definición de cada evento y el consentimiento aplicable antes de tratar una métrica como utilizable. `firstSessionDate` forma cohortes de visitantes, nunca cohortes de primera compra. En `runReport` la cohorte es una lista con `dimension: firstSessionDate` y su `dateRange`, `dateRanges` queda sin especificar, la dimensión `cohort` es obligatoria, la granularidad es `DAILY`, `WEEKLY` o `MONTHLY` con `endOffset` obligatorio y `accumulate` no se usa; la retención es `cohortActiveUsers/cohortTotalUsers` calculada en SQL/servidor. Se usa `keyEvents`, no la métrica deprecada `conversions`. [Ecommerce GA4](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce).

### 3. Extracción, calidad y publicación

`runReport` pagina con `limit` y `offset` usando `rowCount`; cada respuesta tiene hasta 250.000 filas según la referencia. Como `runReport` omite por defecto las filas con todas las métricas en cero, una fila ausente solo se interpreta como cero medido cuando el informe de esa ventana terminó completo, sin `subjectToThresholding`, sin `dataLossFromOtherRow` y sin `dataTruncationReasons`; en cualquier otro caso el valor es «desconocido». Las solicitudes son seriales (una en vuelo por propiedad, el tope de Google es 10) y cada una pide `returnPropertyQuota` para registrar el consumo. El catálogo impone un máximo menor medido para el runtime. Una ejecución manual toma lease y generación de conexión, guarda checkpoint tras cada página/ventana confirmada y puede reanudarse sin duplicar. Un `429`, cuota agotada, `5xx`, timeout o incompatibilidad deja el informe incompleto con error tipado y presupuesto finito; nunca publica una cobertura total a partir de páginas parciales. Si Google devuelve cuotas de propiedad, se registran solo contadores y límites; no se guarda el cuerpo bruto. Un run desplazado por desconexión o reauth no escribe. [runReport](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport), [cuotas](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas).

Los objetos SQL **propuestos, no existentes** son `private.ga4_sync_runs`, `private.ga4_report_rows`, `private.ga4_report_quality` y proyecciones `public.ga4_sync_status`, `public.ga4_traffic`, `public.ga4_item_funnel`, `public.ga4_visitor_cohorts`, `public.ga4_source_comparison`. Cada fila contiene `company_id`, `connection_id`, propiedad, ID y versión del informe, ventana, zona, moneda de reporte cuando corresponda, dato y fecha de extracción. Se guarda además la metadata de calidad de cada respuesta: `samplingMetadatas`, `subjectToThresholding`, `dataLossFromOtherRow`, `dataTruncationReasons`, `schemaRestrictionResponse` (una métrica de ingresos con `REVENUE_DATA` restringido se publica como «restringida», no como cero), `emptyReason`, `currencyCode` y `timeZone` devueltos, además de la frescura declarada. Los contadores de usuarios pueden ser aproximados; no se suman usuarios únicos entre desgloses. Un informe parcial o de calidad restringida no alimenta una comparación que presupone exactitud. [Expectativas de datos](https://developers.google.com/analytics/devguides/reporting/data/v1/reporting-data-expectations).

Cada tabla privada usa FK compuesta por empresa/conexión, RLS habilitada y forzada, `REVOKE ALL` explícito y ninguna lectura directa para `authenticated`, `anon`, `PUBLIC`, `service_role` o `praxa_integrations`. `authenticated` lee solo proyecciones/RPC bajo membresía y sin IDs externos. El rol `praxa_integrations` ejecuta exclusivamente RPC de `worker_api` que validan empresa, conexión y proveedor dentro de SQL. La matriz exacta de grants y firmas queda en la enmienda, la migración nueva y pgTAP; no se edita una migración antigua. La purga idempotente elimina agregados, checkpoints y credencial GA4 y deja Meta/Tiendanube intactos.

### 4. Cruces y presentación

Tiendanube es la fuente de pedidos, líneas, comprador repetido y producto vendido; GA4 es la fuente de sesiones/eventos medidos; Meta es la fuente de gasto/alcance de anuncios. La UI muestra cada serie con fuente, rango, zona, moneda, fecha de actualización, cobertura y calidad. Puede comparar tendencias por fecha tras alinear zona y ventana; no suma eventos GA4 a pedidos de tienda. `itemId` se cruza con producto/variante de Tiendanube solo tras comprobar una correspondencia estable y unicidad; de lo contrario se muestran rankings separados y porcentaje sin mapeo. `transactionId` se usa únicamente para una conciliación agregada de cobertura si el acta y la política de datos lo permiten; no se persisten identificadores externos en una proyección pública. `utm_id` puede compararse con un ID de campaña Meta solo si la instrumentación confirma igualdad exacta, unicidad y período; si falta, no hay atribución de ventas. Las métricas monetarias permanecen por moneda, sin conversión implícita.

La comparación presenta divergencias esperables por consentimiento, bloqueadores, zona, retraso de procesamiento, devoluciones y diferente definición de compra. Para cada vista se fijarán denominador y fórmula en M16f-Q-04; el código SQL/servidor produce los números y estados autoritativos, el LLM no. El chat solo podría recibir agregados cerrados mediante otra autorización documental; este corte muestra resultados en UI. Un informe vacío por falta de señal se diferencia de un cero medido y de un error/cuota.

## Archivos previstos

**Todos los archivos de ejecución son condicionales: la ruta no contiene Parte II de M16f.** La enmienda debe enumerarlos y aprobar su alcance antes de código. El número de migración se toma del árbol al implementarla.

| Archivo o grupo | Nuevo o modificado | Para qué | Autorizado por |
|---|---|---|---|
| `docs/FASES/FASE1/meta_first/{plan,spec}.md`; `docs/FASES/FASE1/M16f/{spec,plan}.md` | Modificados/nuevos | Ficha, CA, gates, plan y dependencias | REQUIERE CAMBIO EN LA RUTA |
| `docs/FASES/FASE1/M03a/acta-meta.md`; `docs/SECURITY.md`; `docs/ARCHITECTURE.md`; `docs/PROJECT_STATE.md`; `docs/HALLAZGOS.md` | Modificados según condición documental | Acta, nueva frontera OAuth/datos, componentes y estado | REQUIERE CAMBIO EN LA RUTA |
| `supabase/migrations/<siguiente>_ga4.sql`; `supabase/tests/<siguiente>_ga4.test.sql`; `supabase/tests/09_integration_privileges.test.sql`; `supabase/tests/10_demo_closure.test.sql` | Nuevos/modificados | Esquema, grants, RLS, purga y gates | REQUIERE CAMBIO EN LA RUTA |
| `src/modules/integrations/contract/{primitives,oauth-attempt,connection,credential}.ts`; `src/modules/integrations/db/worker-api.ts`; `src/modules/integrations/repository/{connections,credentials,attempts,lifecycle-calls}.ts` | Modificados | Contrato GA4 y acceso estrecho a SQL | REQUIERE CAMBIO EN LA RUTA |
| `src/modules/integrations/ga4/`; `src/app/api/integraciones/ga4/` | Nuevos | OAuth, Admin/Data API, catálogo, sync y calidad | REQUIERE CAMBIO EN LA RUTA |
| `src/modules/integrations/lifecycle.ts`; `src/modules/integrations/actions.ts`; `src/app/(app)/app/integraciones/`; `src/app/(app)/app/` | Modificados/nuevos | Conexión, preflight y vistas de comparación | REQUIERE CAMBIO EN LA RUTA |
| `.env.example`; `tests/unit/`; `tests/app/`; `tests/component/`; `package.json` y lockfile **solo si hay dependencia** | Modificados/nuevos | Configuración sin secretos y pruebas sintéticas | REQUIERE CAMBIO EN LA RUTA |
| `docs/FASES/FASE1/meta_first/sesiones/M16f.md`; `docs/FASES/FASE1/M16f/revisiones/` | Nuevos | Evidencia y auditorías | REQUIERE CAMBIO EN LA RUTA |

Los directorios no fijan nombres de archivos que aún no existen. El plan, tras la enmienda, enumerará cada archivo exacto. Cualquier archivo adicional necesario durante ejecución obliga a volver a la ruta.

## Criterios de aceptación

### Heredados de la ruta

| ID de la ruta | Qué exige |
|---|---|
| Ninguno | La ruta vigente excluye GA4 y no define CA para M16f. **REQUIERE CAMBIO EN LA RUTA**; los criterios siguientes son propuestos y no sustituyen CA aprobados. |

### Operativos de esta microfase

| ID | Criterio verificable | Traza a |
|---|---|---|
| M16f-C-01 | Meta, Tiendanube y una propiedad GA4 coexisten para una empresa; otra empresa no ve ni modifica la propiedad; dos GA4 vivas en la misma empresa se rechazan | H-E1-236; K01–K04; ruta por enmendar |
| M16f-C-02 | OAuth de un uso con scope mínimo, refresh cifrado y selección de propiedad accesible; denegación, replay y propiedad ajena no activan conexión | OAuth oficial; INV-01/06; ruta por enmendar |
| M16f-C-03 | Refresh, rotación, caducidad de Testing y pérdida de permiso producen reautorización tipada; una respuesta sin `refresh_token` o sin el scope exacto no activa la conexión; todo intento `initial`/`reauth` envía `prompt=consent`; la desconexión intenta revocar y purga aunque Google no responda; ningún token/código aparece en URL final, log o evidencia | OAuth oficial; K04/DEC-09; ruta por enmendar |
| M16f-C-04 | Preflight demuestra instrumentos requeridos por capacidad y deshabilita la capacidad ausente sin presentar ausencia como cero | Ecommerce oficial; H-E1-238; ruta por enmendar |
| M16f-C-05 | El catálogo rechaza combinaciones incompatibles; extracción pagina, respeta cuotas, reanuda y no publica cobertura completa ante error | Data API y cuotas; patrón DEC-05/CA-58/59; ruta por enmendar |
| M16f-C-06 | Cada resultado muestra fuente, propiedad, ventana, zona, moneda, fecha, cobertura y banderas de calidad; distingue cero, vacío, parcial y dato suprimido | Expectativas Data API; ruta por enmendar |
| M16f-C-07 | Cohortes GA4 son de primera sesión y nunca se confunden con cohortes de primera compra de Tiendanube; fórmulas y denominadores son reproducibles | `cohortSpec`; H-E1-238; ruta por enmendar |
| M16f-C-08 | Cruces producto/campaña/compra solo se muestran para mapeo y definiciones verificados; divergencias y exclusiones visibles; no se afirma causalidad | H-E1-238; M16f-Q-03/04; ruta por enmendar |
| M16f-C-09 | RLS, grants y purga impiden lectura cruzada y destruyen agregados/credencial GA4 sin afectar Meta/Tiendanube | INV-01/04; DEC-09; ruta por enmendar |
| M16f-C-10 | Recorrido real con propiedad del sitio, eventos ecommerce y al menos una comparación validada documenta resultados redactados; sin señal real el gate correspondiente queda abierto | CB-05/06; ruta por enmendar |

## Casos de prueba

| ID | Criterios | Tipo | Comando | Resultado esperado | ¿Falla sin la implementación? |
|---|---|---|---|---|---|
| M16f-T-01 | C-01, C-09 | pgTAP + app | `npm run db:check:test`; `npm run test:policies`; `npm run test:app` | Tres proveedores en una empresa, una GA4 viva, aislamiento de segunda empresa y Meta intacta | Sí |
| M16f-T-02 | C-02 | unit + app | `npm run verify`; `npm run test:app` | Scope exacto, `state` de un uso, denegación/replay/CSRF y propiedad no listada quedan sin conexión | Sí |
| M16f-T-03 | C-03 | unit + app | `npm run verify`; `npm run test:app` | Refresh presente/ausente/rotado/inválido, scope faltante y pérdida de permiso dejan estado correcto; la URL de autorización incluye `access_type=offline` y `prompt=consent`; revocación fallida no impide la purga; URL y logs sintéticos no filtran secretos | Sí |
| M16f-T-04 | C-04, C-10 | unit + manual | `npm run verify`; recorrido de preflight en propiedad real | Con eventos completos se habilita la capacidad; sin `purchase`, `item_id` o `utm_id` se deshabilita solo la capacidad dependiente | Sí para unit; manual requiere cuenta |
| M16f-T-05 | C-05 | unit + app | `npm run verify`; `npm run test:app` | `checkCompatibility` deniega pareja inválida; `rowCount` con múltiples páginas, 429, cuota, 5xx, timeout y reinicio no duplican ni omiten filas; fila ausente solo es cero con informe completo y sin umbral ni `(other)`; cada tipo de error de la clasificación produce su efecto y «desconocido» no cambia la conexión | Sí |
| M16f-T-06 | C-06 | unit + component | `npm run verify`; `npm run test:app` | Sampling, threshold, `(other)`, frescura, fila vacía, cero y parcial tienen rótulo/estado distinto y fuente visible | Sí |
| M16f-T-07 | C-07 | unit + app | `npm run verify`; `npm run test:app` | Primera sesión y primera compra divergen en fixture; nunca se suman usuarios únicos entre cortes ni se confunden cohortes | Sí |
| M16f-T-08 | C-08 | unit + app | `npm run verify`; `npm run test:app` | `itemId`/SKU ambiguo, `transactionId` ausente, `utm_id` no exacto, zona/moneda distintas impiden join y muestran cobertura excluida | Sí |
| M16f-T-09 | C-09 | pgTAP + app | `npm run db:check:test`; `npm run test:policies`; `npm run test:app` | `anon`, otra empresa y rol privilegiado sin lectura directa; desconexión/purga repetida dejan cero filas GA4 y otras fuentes intactas | Sí |
| M16f-T-10 | C-10 | manual | Recorrido redactado y comparación manual con GA4 UI/Tiendanube/Meta | Propiedad y señal reales, una comparación verificable, evidencia sin cifras/IDs/tokens; si falta, gate abierto | No aplica: exige cuenta real |

## Verificación

Tras aprobar la enmienda, spec y plan: usar proyecto Supabase desechable; ejecutar `npm run verify`, `npm run test:app`, `npm run test:policies` y `npm run db:check:test` con sus prerequisitos. `verify` no reemplaza los otros comandos. Ejecutar pruebas de componente si el plan final las incluye, usando el script exacto de `package.json` entonces vigente. Comprobar el recorrido real por OAuth, preflight, sincronización, calidad, comparación y desconexión, guardando en `meta_first/sesiones/M16f.md` comandos, conteos, matrices de compatibilidad, resultados redactados y límites. Una prueba omitida por falta de configuración es **no ejecutada** (CB-06), no aprobada. Nunca ejecutar contra producción desde pruebas; no leer `.env.local`. El gate requiere todas las capacidades que la ruta aprobada establezca; una capacidad ecommerce sin señal real no se declara validada.

## Intervenciones del usuario y acciones reservadas

| Paso | Qué hace el usuario | Cómo se verifica después |
|---|---|---|
| Ruta, decisiones y acta | Decide posición de M16f, mapeos/fórmulas, alcance de chat y límites de datos; aprueba enmienda, spec, plan y acta ampliada; comunica el acta al dueño | Documentos aprobados, gate de entrada y comunicación registrados sin datos reales |
| Google Cloud | Sigue «Alta en Google Cloud» (proyecto, pantalla de consentimiento Externa/Testing, usuario de prueba, cliente web, URI exacta, Data y Admin API); carga credenciales fuera del chat | Flujo OAuth en ambiente autorizado con scope exacto; no se copian secretos a evidencia |
| Propiedad y medición | Provee acceso de lectura a la propiedad correcta, confirma sitio/stream, eventos, consentimiento y mapeos con el dueño | Preflight y comparación real redactada; si falta señal, gate abierto o capacidad formalmente retirada de ruta |
| Cambios externos y publicación | Ejecuta `db:push:test`, `db:push` del proyecto `app`, push y despliegue solo si lo solicita y autoriza expresamente | Logs de comando y revisión de privilegios, sin secretos ni IDs de cuentas |

El asistente prepara código, migración nueva, pruebas y evidencia solo después de que la ruta lo autorice. Nunca pide pegar secretos en el chat ni realiza acciones reservadas por su cuenta.

## Trampas y riesgos

- **REQUIERE CAMBIO EN LA RUTA:** la exclusión expresa de GA4 y una conexión viva por empresa hacen inválida cualquier implementación directa de esta spec.
- `analytics.readonly` permite leer propiedades accesibles, no prueba por sí mismo que una propiedad sea la tienda del comerciante. La selección requiere verificación con el dueño; el dominio del flujo web (`defaultUri`) contra el de la tienda es un control adicional, no una prueba.
- Google entrega el refresh token solo en la primera autorización de la cuenta y el cliente. Sin `prompt=consent`, reconectar tras una desconexión local deja una conexión sin refresh token.
- `runReport` omite las filas con todas las métricas en cero: una fila ausente no es un cero medido salvo informe completo sin umbral ni `(other)`.
- Las combinaciones incompatibles de dimensiones y métricas gastan una cuota de errores de cliente: validar con `checkCompatibility`, no por prueba y error.
- Una cuenta Google admite 100 refresh tokens por cliente OAuth; el más viejo se invalida sin aviso al superar ese número.
- Cambiar la zona horaria de la propiedad no es retroactivo: una serie larga puede mezclar dos zonas. Se compara `metadata.timeZone` entre extracciones.
- La moneda de ingresos es la de la propiedad (`currencyCode`) y puede diferir de la de los pedidos de Tiendanube: ninguna suma ni cociente entre ambas.
- OAuth `External/Testing` puede caducar en siete días; un refresh ausente tras reautorización no debe sobrescribir uno válido. Los límites de verificación pública dependen de audiencia y configuración.
- `firstSessionDate` mide visitante, no comprador. Consentimiento, modelado, umbrales, sampling, `(other)` y frescura pueden sesgar o ocultar cifras.
- GA4 no garantiza `item_id`, `transaction_id` o `utm_id` en el histórico. Coincidencia de nombres o fechas no es clave de unión. H-E1-238 impide un join de persona con Data API agregada.
- Dimensión/métrica de item y sesión pueden ser incompatibles; validar cada pareja mediante `checkCompatibility`. Una cifra de usuarios únicos no es aditiva.
- Los runs parciales, un 429 o cuota agotada no son «sin ventas». Las ventanas y páginas deben conservar un estado de cobertura inequívoco.
- La ruta actual de chat y su tratamiento de texto tienen H-E1-234/H-E1-228; extenderla a GA4 sin aprobación del acta y de la ruta ampliaría la frontera con el LLM.
- Al implementar cualquier API de Next, leer primero la guía instalada `node_modules/next/dist/docs/`; verificar la versión de CLI Supabase antes de las pruebas. No modificar migraciones antiguas ni usar `service_role` fuera del contrato.

## Decisiones de la microfase

| ID | Decisión | Motivo | Decidió | Fecha |
|---|---|---|---|---|
| D-M16f-01 | Redactar una spec **BORRADOR** para GA4 con cruce descriptivo; ninguna capacidad queda aprobada hasta la enmienda | Pedido expreso de convertir la investigación en specs; la ruta vigente la excluye | Usuario (pedido de redacción); diseño condicional del asistente | 2026-11-12 |
| D-M16f-02 | Separar cohortes de primera sesión GA4 de cohortes de primera compra Tiendanube y excluir identidad individual | Semántica de `cohortSpec` y Data API agregada | Diseño propuesto, pendiente de aprobación | 2026-11-12 |
| D-M16f-03 | Dejar el chat fuera del corte hasta que ruta/acta lo autoricen | Evitar ampliar la frontera con el modelo y contradecir la ruta | Diseño propuesto, pendiente de aprobación | 2026-11-12 |
| D-M16f-04 | Completar la spec con la referencia de API verificada, la clasificación de errores, la corrección del refresh token (`prompt=consent`) y el alta en Google Cloud | Pedido del usuario de investigar el proceso completo para extraer datos por API, como se hizo con Meta | Usuario (pedido); contenido del asistente pendiente de aprobación | 2026-11-12 |

## Supuestos e hipótesis

- **HIPÓTESIS M16f-H-01:** la tienda piloto tiene una propiedad GA4 controlada por el dueño, con permiso de lectura y stream del dominio correcto. Verificar en selección OAuth y preflight real, antes de activar.
- **HIPÓTESIS M16f-H-02:** existen eventos `view_item`, `add_to_cart`, `begin_checkout` y `purchase` con `item_id` y `transaction_id` útiles. Verificar en Data API/GA4 UI por período; deshabilitar cada capacidad ausente.
- **HIPÓTESIS M16f-H-03:** `item_id` corresponde a producto/variante Tiendanube y `utm_id` a ID de campaña Meta. Verificar unicidad, formato y muestras con el dueño antes de un join; no inferir por etiqueta.
- **HIPÓTESIS M16f-H-04:** el runtime, cuotas y volumen del piloto permiten sync manual por ventanas. Medir en proyecto desechable y luego en propiedad autorizada, con presupuesto explícito, antes de fijar frecuencia/cobertura.
- **HIPÓTESIS M16f-H-05:** la propiedad permite datos suficientes para una comparación real. Verificar con la ventana de prueba acordada; sin señal, `G-GA4-FUSION` queda abierto o se cambia la ruta antes de evaluarlo.
- **HIPÓTESIS M16f-H-06:** los datos de los últimos días son provisionales. La página de frescura de la Data API no se pudo identificar. Medir en la propiedad real qué ventana final cambia entre dos extracciones y fijar con ese dato cuántos días recientes se excluyen de las comparaciones; no se supone 24 o 48 horas.
- **HIPÓTESIS M16f-H-07:** `analytics.readonly` es un scope sensible y el modo `Testing` alcanza para el piloto. La documentación leída no declara la categoría ni el tope de usuarios de prueba. Verificar en la pantalla de consentimiento de Google Cloud antes de planificar el piloto; si hay verificación obligatoria, el piloto queda condicionado a M16f-Q-05.
- **HIPÓTESIS M16f-H-08:** `itemId` es compatible con las métricas de sesión que se quieran comparar. El changelog de 2022 indica que las dimensiones de ítem se volvieron incompatibles con métricas de evento; no se pudo confirmar el estado actual para sesiones. Resolver con `checkCompatibility` sobre la propiedad real y registrar la matriz; no se asume ninguna pareja.
- **HIPÓTESIS M16f-H-09:** los cuerpos exactos del canje y del refresh de Google y la URL de revocación son los de la referencia. Se leyeron de un resumen. Verificar contra la página de OAuth web al implementar y con una conexión de prueba.

## Preguntas abiertas

| ID | Pregunta | Opciones | Recomendación | Evidencia |
|---|---|---|---|---|
| M16f-Q-01 | **REQUIERE CAMBIO EN LA RUTA:** ¿M16f precede a M28.3a y la demo depende de `G-GA4-FUSION`, o se ubica después de `G-DEMO`? | Antes / después | Si la demo requiere tres fuentes, antes y enmendar I–III, CA, M28.3a y `PROJECT_STATE.md`; de otro modo, después | Plan I.3; spec §2; estado M26a/M16e |
| M16f-Q-02 | ¿La propiedad piloto está instrumentada para ecommerce y qué capacidades son obligatorias para el gate? | Todas / subconjunto declarado / microfase separada de instrumentación | Preflight antes de aprobar el plan; si faltan eventos obligatorios, no aprobar gate ficticio | GA4 ecommerce; H-E1-238 |
| M16f-Q-03 | ¿Qué claves reales enlazan `item_id`, `transaction_id` y `utm_id` con tienda/Meta, y pueden persistirse bajo el acta? | Mapeo exacto / comparación agregada sin join / sin comparación | Exigir prueba de unicidad; si falla, mostrar fuentes separadas | Data API, Tiendanube y Meta; H-E1-237/238 |
| M16f-Q-04 | ¿Qué fórmula, denominador, zona, moneda y tolerancia usa cada comparación? | Definiciones por métrica / solo series independientes | Aprobar tabla de métricas antes de código; nunca denominar «ventas atribuidas» por fecha | Calidad GA4 y estados de pedidos Tiendanube |
| M16f-Q-05 | ¿Piloto con usuarios de prueba o app Google pública? | Testing / producción verificada | Testing para piloto controlado, documentando expiración; plan de verificación separado para público | OAuth Testing y verificación Google |
| M16f-Q-06 | ¿Qué agregados se pueden enviar a un LLM y por cuánto tiempo se guardan? | UI sin chat / catálogo cerrado con acta ampliada | UI sin chat en M16f; otra enmienda si se requiere chat | M03a; H-E1-234/228; `docs/SECURITY.md` |
| M16f-Q-07 | ¿Se revoca el refresh token en Google al desconectar? Es una escritura sobre el estado de autorización de la cuenta Google, no sobre Analytics | Revocar con intento registrado / solo destruir la copia local | Revocar con intento registrado, como en Meta (CA-38); sin revocar, reconectar exige `prompt=consent` y el token viejo sigue vivo en Google hasta 6 meses sin uso | OAuth oficial (vida del refresh token); `meta_first/spec.md` CA-38, H-03 |
| M16f-Q-08 | ¿Se agrega PKCE al flujo web de servidor? | Solo `state` y `client_secret` / `state` más PKCE | Evaluar PKCE al planificar: requiere guardar el verificador ligado al navegador y al intento K02, y la documentación leída no lo menciona para este flujo | OAuth web de Google; K02 de PRAXA |

## Hallazgos relacionados

H-E1-236 (conexiones de un proveedor), H-E1-237 (acta y política de compradores/GA4), H-E1-238 (Data API agregada no identifica compradores), H-E1-234/H-E1-228 (frontera y redacción del chat). Ninguno queda cerrado por redactar esta spec.

## Auditorías

Pendiente: `docs/FASES/FASE1/M16f/revisiones/spec-audit-1.md` después de enmendar la ruta y resolver las preguntas abiertas. No existe auditoría de esta spec ni estado APROBADA.
