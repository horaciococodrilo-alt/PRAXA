# M27a — RFM, cohortes y propuestas de audiencias

**Estado:** APROBADA

Estados: BORRADOR → APROBADA. Solo el usuario aprueba después de una auditoría APROBABLE. Una única microfase, una spec, un plan y un gate: `G-SEGMENTOS-AUDIENCIAS`. Ningún control interno es un gate adicional.

**Hash de contenido.** Excluir únicamente la línea de estado:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M27a/spec.md | git hash-object --stdin
```

## Fuentes

- Ruta: `docs/FASES/FASE1/meta_first/plan.md`, ficha de M27a en I.4, II.14d, III.3 y III.9; `meta_first/spec.md` §18 (enmienda M27a del 2026-11-17).
- Estado de referencia: la spec se redactó en un fork sobre el commit `d349b98`, que no llegó a este repositorio. Se integró el 2026-11-17 sobre el commit `7d14ca9` (rama `chore/demo-y-sin-uso`, con M16f y M25b cerrados), rama de trabajo `mf/M27a`; la enmienda de la ruta se volvió a escribir aquí ([enmienda](../meta_first/revisiones/enmienda-rfm-cohortes-audiencias-2026-11-17.md)). Las citas de código de abajo se reverificaron sobre `7d14ca9`.
- `AGENTS.md`, `docs/PIPELINE.md`, plantilla `docs/_templates/mf-spec.md`, SECURITY, ARCHITECTURE, PROJECT_STATE, HALLAZGOS y enmienda `meta_first/revisiones/enmienda-rfm-cohortes-audiencias-2026-11-17.md`.
- Dependencia: M16e, `G-TIENDA` aprobado con excepciones; evidencia `meta_first/sesiones/M16e.md`, cierre del paso 14. La excepción monetaria de M16e no permite cerrar M27a. M16f ya está cerrado (`G-GA4-FUSION`, 2026-11-17); no es dependencia.
- Código y migraciones citados abajo; `M16e/spec.md` §§3–6 y M16e-H-06; `scripts/lib/demo-seed-sources.mjs` (empresa demo, `H-E1-273`), que publica pedidos con `worker_api.tn_publish_orders`.
- [Order, API 2025-03](https://tiendanube.github.io/api-documentation/resources/order), consultado el 2026-11-17: propiedades e historial de valores. Se consultó documentación pública; no hubo acceso a la tienda, respuestas reales ni experimentos.
- IDs cubiertos: únicamente M27a (#18 + #32). M26b sigue reservado para estrategias publicitarias #13.

## Objetivo

Convertir comportamiento comercial verificable de Tiendanube en segmentos, cohortes y propuestas publicitarias accionables, sin crear ni transferir audiencias.

## Alcance

RFM completo, incluida una definición monetaria validada; análisis de cohortes cuya validez esté acreditada; pantalla independiente integrada en `/app/clientes`; motor de reglas determinístico y versionado para propuestas. Distribución y métricas económicas por segmento, matriz de retención, evolución temporal y fichas de propuestas forman un único producto.

La validación monetaria, TDD, privilegios, aislamiento, calidad, privacidad, disponibilidad y borrado son obligatorios. El grill cerró Q-01 a Q-08. Para Monetary se aprobó un diseño condicional A/B/C: la implementación comienza con Monetary indisponible, ejecuta T-04 en un entorno autorizado y solo habilita la definición A o B si la evidencia es concluyente; C bloquea el gate. No se presenta RF como RFM ni se divide la microfase.

## Fuera de alcance

Crear, exportar o sincronizar audiencias, descargar listas o identificadores; modificar campañas; APIs de audiencias, nuevos scopes, escrituras externas; LLM, chat, diagnóstico, reporting o recomendaciones publicitarias generales de #13. Sin GA4 individual, resolución de personas por PII, atribución de ventas, causalidad, rentabilidad, ganancia, LTV predictivo, notificaciones, programación automática ni perfiles individuales visibles.

Sin nuevas dependencias o cambios de package/lockfile. No activar `TN_COLLECTED_AMOUNT_ENABLED` ni habilitar montos en consumidores anteriores. No sumar monedas ni sustituir cobrado por precio del pedido. No heredar la excepción de pruebas en app de M16e como autorización nueva: toda validación M27a usa entornos de prueba autorizados.

## Contexto verificado en el código

| Qué | Dónde (archivo:línea) | Implicación |
|---|---|---|
| Tenant construido sin argumentos en servidor; getClaims, membresía y rol owner | src/modules/tenant/context.ts:11 y :39 | Reutilizar requireTenantContext; cliente no elige empresa. |
| Lectura de conexión por proveedor bajo JWT | src/modules/integrations/repository/connections.ts:77 | Resolver Tiendanube en servidor; ninguna necesidad de Meta activa. |
| Solo estado vigente por pedido, importes numeric e ID opaco | supabase/migrations/0023_tiendanube.sql:249 | No existe historial de snapshots de cliente para reconstrucción histórica. |
| Elegible: paid/partially_refunded, no cancelled | supabase/migrations/0023_tiendanube.sql:298 | Heredar exactamente; partially_paid va aparte. |
| Líneas referencian pedido, cliente compuesto por empresa/conexión | supabase/migrations/0023_tiendanube.sql:280 y :308 | Calcular pertenencia dentro de la misma conexión; no unir por ID externo global. |
| Cobertura y estado | supabase/migrations/0023_tiendanube.sql:399 y :629 | Corte de días completos: fecha local de coverage_until menos un día; backfill solo no basta. |
| Sumas de ventas usan coalesce de montos y reembolsos | supabase/migrations/0023_tiendanube.sql:640 | No reutilizar esos totales para probar completitud monetaria ni M por cliente. |
| Cohortes privadas se calculan antes de supresión | supabase/migrations/0023_tiendanube.sql:688 | Los conteos ya ocultos del getter no permiten reconstruir RF/M. |
| Getter existente | supabase/migrations/0023_tiendanube.sql:2604 | get_tn_cohorts(uuid,date,date,integer): meses, offset, tamaño/activos/retención, ocultamiento, parcial, fetched_at, zona y definition; INVOKER. |
| Tablas privadas sin grants y públicas con RLS | supabase/migrations/0023_tiendanube.sql:522 y :578 | Agregar salida agregada propia; no abrir lectura privada. |
| Monto global deshabilitado | src/modules/integrations/tiendanube/limits.ts:11 | Mantener false; validación propia no habilita chat/diagnóstico. |
| Proyección cerrada de pedidos | src/modules/integrations/tiendanube/projection.ts:36-38 y :142-143 | Extender solo campos de calidad estrictamente necesarios; nunca payload bruto ni PII. |
| El transporte decodifica JSON con `JSON.parse`; la proyección decimal heredada acepta `number` y lo convierte a texto | src/modules/integrations/tiendanube/client.ts:127; src/modules/integrations/tiendanube/projection.ts:94-99 | El flujo monetario de M27a no reutiliza esa conversión: rechaza tokens numéricos JSON antes de declarar un importe exacto. |
| Historia de reembolsos reconoce varias formas y convierte números con toFixed(2) | src/modules/integrations/tiendanube/projection.ts:240 | No acreditar contrato, precisión ni completitud por esta función; validación cerrada para M27a. |
| Historial se lee solo para refunded/partially_refunded; presupuesto/error deja nulo | src/modules/integrations/tiendanube/sync.ts:315 | No tratar nulo como cero ni inferir que paid nunca tuvo una edición. |
| Publicación con actor, empresa, generación, run y lease | src/modules/integrations/tiendanube/repository.ts:56 y :98 | Preservar ownership y compatibilidad de publicación. |
| Privacy marca supresiones antes del borrado; recalcula después | supabase/migrations/0023_tiendanube.sql:2344; private.tn_drop_suppressed en :814 | Invalidar derivado al marcar, sin esperar la siguiente sincronización. |
| allowlist SQL y aridades del cliente privilegiado | src/modules/integrations/db/worker-api.ts:9 y :86 | No usar SQL arbitrario ni crear otro cliente; no hace falta ampliar rol para el diseño recomendado. |
| Pantalla Tiendanube solo lee agregados | src/modules/integrations/tiendanube/analysis.ts:138 y :205 | Mantener sus contratos; no reutilizar su DTO sin importes como RFM. |
| Navegación central | src/components/app/shell.tsx:24, :26 y :37 | Añadir Clientes al tipo `Pagina`, al mapa `PAGINAS` y a `NAV`, con icono existente, sin modificar estado de fuentes. Ruta /app/clientes no existe en la inspección. |
| Página protegida verifica sesión independientemente | src/app/(app)/app/anomalias/page.tsx:13; src/modules/app-data/index.ts:34 | Seguir el patrón de sesión; no confiar solo en layout/proxy. |
| RPC públicas invoker y definer solo no expuestos | docs/ARCHITECTURE.md:146; docs/SECURITY.md:159 | Mantener separación, search_path vacío, grants mínimos y chequeos por capa. |
| Proyectos unit/component/app y suites remotas secuenciales | vitest.config.mts:26 y :67 | Tests nuevos entran sin modificar configuración. |
| Scripts de verificación disponibles | package.json:8 | Usar comandos existentes, no inventar scripts. |
| Fixtures app con backend real y cleanup por RUN_ID | tests/app/tiendanube-data-api.test.ts:21 | Reutilizar helpers; aserciones con JWT, no service_role. |
| Gate de entrada cerrado y paralelismo autorizado | docs/PROJECT_STATE.md:28 y :45 | G-TIENDA aprobado; M27a habilitada como trabajo paralelo. G-GA4-FUSION ya está aprobado. |
| Monetaria pendiente estable | docs/HALLAZGOS.md:863 | H-E1-274 bloquea M y cierre; no bloquea redactar esta spec. |
| Empresa demo publica pedidos ya proyectados | scripts/lib/demo-seed-sources.mjs:137 | Consumidor de `tn_publish_orders`: debe seguir funcionando y emitir los campos nuevos con montos como string decimal. |

## Diseño concreto

### 1. Contratos, nombres y separación de responsabilidades

Los nombres de esta sección son **previstos**, salvo los citados como existentes arriba.

- `src/modules/customer-insights/contract.ts`: esquemas Zod estrictos para DTO público, reglas y ausencias; ninguna clave de empresa, tienda, cliente, pedido o conexión en el DTO que cruza a componentes.
- `rules.ts`: definiciones versionadas, textos fijos, códigos de segmento y propuesta; sin red ni acceso a entorno.
- `proposals.ts`: `buildAudienceProposals(view: InsightsData): readonly AudienceProposal[]`; recibe solo agregados sanitizados y evidencia tipada. No produce cifras nuevas salvo formateo; elige plantillas por reglas.
- `load.ts`: `loadCustomerInsightsView(requestedCurrency: unknown = null): Promise<CustomerInsightsView>`, server-only, requireTenantContext + conexión por proveedor + cliente Supabase del servidor. El único dato de entrada es `currency` de searchParams; nunca se aceptan argumentos de tenant, empresa o conexión. Error de autorización se trata sin revelar existencia de otra empresa.
- `page.tsx`: requireAppSession('/app/clientes'), loader, PageHeader y componente. Sin filtros arbitrarios, consultas de personas, demo de producción ni efectos de escritura en GET.
- SQL hace agrupación, RF/M y cohortes con numeric exacto. TypeScript selecciona propuestas sobre agregados; pruebas usan oráculos de fixtures escritos a mano, no copias del SQL.
- Strings decimales para dinero, tasas y medias; contadores enteros seguros. Sin parseFloat/sumas binarias de moneda. El formato visual redondea solo al final y conserva la precisión de cálculo. JSON de entrada/salida validado, límites y versiones cerrados.

#### 1.1 Contrato público exacto

Todos los objetos son `strict` en Zod: claves desconocidas fallan. Días y meses usan `YYYY-MM-DD` y `YYYY-MM`; instantes, ISO 8601 con zona; moneda, `[A-Z]{3}`. Ninguna forma contiene IDs de empresa, conexión, tienda, cliente, pedido, producto o variante.

```ts
type Absence =
  | 'sin_cobertura'
  | 'periodo_abierto'
  | 'monetario_no_validado'
  | 'dato_incompleto'
  | 'privacidad'
  | 'sin_denominador';

type MetricUnit =
  | 'customers'
  | 'orders'
  | 'currency'
  | 'days'
  | 'ratio'
  | 'orders_per_customer'
  | 'intervals';

type Metric = Readonly<{
  value: string | null;
  absence: Absence | null;
  unit: MetricUnit;
  definition: DefinitionCode;
}>;
```

`value` y `absence` son XOR. Conteos e intervalos son enteros decimales seguros `>=0`; dinero y medias son decimales exactos `>=0`; `ratio` está entre `0` y `1`. No hay `number` para dinero, tasas o medias. Cada campo fija su unidad y definición mediante esta tabla; no se aceptan otras combinaciones:

| Ruta de métrica | `unit` | `definition` | `absence` permitidas |
|---|---|---|---|
| `segments.totalCustomers` | `customers` | `segment_total_customers_v1` | ninguna si la sección está disponible |
| `segments.excludedBeforeWindow` | `customers` | `excluded_before_window_v1` | `privacidad` |
| `segments.rows[].customers` | `customers` | `segment_customers_v1` | ninguna si la sección está disponible |
| `segments.rows[].orders` | `orders` | `segment_orders_v1` | ninguna si la sección está disponible |
| `segments.rows[].monetary` | `currency` | `segment_monetary_v1` | ninguna si la sección está disponible |
| `segments.rows[].monetaryPerCustomer` | `currency` | `segment_monetary_per_customer_v1` | `sin_denominador` solo para fila vacía |
| `segments.rows[].monetaryPerOrder` | `currency` | `segment_monetary_per_order_v1` | `sin_denominador` solo para fila vacía |
| `segments.rows[].recencyMedianDays` | `days` | `segment_recency_median_days_v1` | `sin_denominador` solo para fila vacía |
| `segments.rows[].frequencyMean` | `orders_per_customer` | `segment_frequency_mean_v1` | `sin_denominador` solo para fila vacía |
| `cohorts.rows[].size` | `customers` | `cohort_size_observed_v1` | ninguna; una cohorte protegida se omite completa |
| `cohorts.rows[].cells[].activeCustomers` | `customers` | `cohort_active_v1` | `sin_cobertura`, `periodo_abierto`, `privacidad` |
| `cohorts.rows[].cells[].retention` | `ratio` | `cohort_retention_v1` | las anteriores, `sin_denominador` |
| `cohorts.rows[].cells[].repeatPurchaseCumulative` | `ratio` | `cohort_repeat_cumulative_v1` | `sin_cobertura`, `periodo_abierto`, `privacidad`, `sin_denominador` |
| `cohorts.rows[].cells[].observedValue` | `currency` | `cohort_observed_value_v1` | `sin_cobertura`, `periodo_abierto`, `monetario_no_validado`, `dato_incompleto`, `privacidad` |
| `cohorts.rows[].cells[].ticket` | `currency` | `cohort_ticket_v1` | las anteriores, `sin_denominador` |
| `cohorts.rows[].cells[].observedValuePerCustomerCumulative` | `currency` | `cohort_observed_value_per_customer_cumulative_v1` | las anteriores, `sin_denominador` |
| `cohorts.rows[].cells[].meanDaysBetweenPurchases` | `days` | `cohort_mean_days_between_purchases_v1` | `sin_cobertura`, `periodo_abierto`, `dato_incompleto`, `privacidad`, `sin_denominador` |
| `cohorts.rows[].cells[].repeatCustomers` | `customers` | `cohort_repeat_customers_v1` | `sin_cobertura`, `periodo_abierto`, `dato_incompleto`, `privacidad` |
| `cohorts.rows[].cells[].purchaseIntervals` | `intervals` | `cohort_purchase_intervals_v1` | `sin_cobertura`, `periodo_abierto`, `dato_incompleto`, `privacidad` |
| `proposals[].identifiedCustomers` | `customers` | `proposal_identified_customers_v1` | ninguna cuando existe; si es nula rige `identifiedCustomersAbsence` |

`DefinitionCode` es exactamente la unión de los valores de la columna `definition` (tercera columna) de la tabla anterior. El texto visible de cada definición vive en el catálogo cerrado de `rules.ts`, indexado por ese código.

```ts
type MonetaryDefinition =
  | 'tn_paid_current_observed_v1'
  | 'tn_paid_current_less_verified_refunds_v1';

type InsightQuality = Readonly<{
  coverage: Readonly<{
    fromDay: string | null;
    throughDay: string | null;
    complete: boolean;
  }>;
  identity: 'completa' | 'incompleta' | 'no_evaluable';
  monetary: Readonly<{
    status: 'verified' | 'unverified' | 'incomplete' | 'inconsistent';
    definition: MonetaryDefinition | null;
  }>;
  catalog: 'completo' | 'incompleto';
  orderLines: 'completas' | 'incompletas';
}>;

type SegmentCode =
  | 'inactivos'
  | 'riesgo'
  | 'nuevos'
  | 'alto_valor'
  | 'frecuentes'
  | 'potencial';

type SegmentRow = Readonly<{
  code: SegmentCode;
  customers: Metric;
  orders: Metric;
  monetary: Metric;
  monetaryPerCustomer: Metric;
  monetaryPerOrder: Metric;
  recencyMedianDays: Metric;
  frequencyMean: Metric;
}>;

type SegmentSection =
  | Readonly<{
      status: 'available';
      totalCustomers: Metric;
      excludedBeforeWindow: Metric;
      rows: readonly [SegmentRow, SegmentRow, SegmentRow, SegmentRow, SegmentRow, SegmentRow];
    }>
  | Readonly<{
      status: 'unavailable';
      absence: 'monetario_no_validado' | 'dato_incompleto' | 'privacidad';
      definition: 'segment_partition_v1';
    }>;

type CohortCell = Readonly<{
  offset: number;
  calendarMonth: string;
  activeCustomers: Metric;
  retention: Metric;
  repeatPurchaseCumulative: Metric;
  observedValue: Metric;
  ticket: Metric;
  observedValuePerCustomerCumulative: Metric;
  meanDaysBetweenPurchases: Metric;
  repeatCustomers: Metric;
  purchaseIntervals: Metric;
}>;

type CohortRow = Readonly<{
  cohortMonth: string;
  size: Metric;
  cells: readonly CohortCell[];
}>;

type CohortSection =
  | Readonly<{ status: 'available'; rows: readonly CohortRow[] }>
  | Readonly<{
      status: 'unavailable';
      absence: 'sin_cobertura' | 'dato_incompleto' | 'privacidad';
      definition: 'cohorts_observed_v1';
    }>;

type CrossSellEvidence =
  | Readonly<{
      status: 'available';
      sourceSegment: 'frecuentes' | 'alto_valor';
      productAName: string;
      productBName: string;
      coPurchaseSufficient: true;
      targetSufficient: true;
      identifiedCustomers: null;
      identifiedCustomersAbsence: 'privacidad';
      definition: 'cross_sell_pair_v1';
    }>
  | Readonly<{
      status: 'unavailable';
      absence: 'dato_incompleto' | 'privacidad' | 'monetario_no_validado';
      definition: 'cross_sell_pair_v1';
    }>;

type ProductEvidenceSection = Readonly<{
  catalogComplete: boolean;
  linesComplete: boolean;
  crossSell: CrossSellEvidence;
}>;

type InsightsData = Readonly<{
  ruleset: 'rfm_v1';
  source: 'tiendanube';
  asOfDay: string;
  fetchedAt: string;
  timezone: string;
  currency: string;
  rfmFrom: string;
  firstPurchaseBasis: 'observada';
  quality: InsightQuality;
  segments: SegmentSection;
  cohorts: CohortSection;
  productEvidence: ProductEvidenceSection;
}>;
```

Procedencia persistida de calidad, evaluada para la generación actual y antes de sanitizar el snapshot:

- Nueva columna privada `tn_orders.insights_identity_status`: `verified | absent | invalid | unverified`. En `projectOrder`, customer ausente/nulo o `customer.id` ausente/nulo produce `absent`; objeto customer no válido o un ID presente con forma inválida produce `invalid`; un ID válido produce `verified`. Las filas existentes reciben `unverified` en la migración y solo se vuelven a evaluar mediante una relectura autorizada del historial, nunca por inferencia retrospectiva.
- Nueva columna privada `tn_orders.insights_lines_status`: `complete | source_omitted | source_invalid | line_omitted | unverified`. `products` ausente produce `source_omitted`; presente pero no-array produce `source_invalid`; una línea descartada por forma inválida, falta de `product_id` válido o límite de líneas produce `line_omitted`; solo un array completo cuyos elementos cumplen el contrato y tienen `product_id` válido produce `complete`. Las filas existentes reciben `unverified` hasta su relectura.
- Nuevos campos de estado en `public.tn_sync_status`: `insights_catalog_status` (`unknown | cycle_incomplete | omitted_items | complete`) e `insights_catalog_has_omissions boolean`. Al iniciar un recorrido nuevo se reinicia la marca de omisiones; cada página la acumula, y solo la última página fija `complete` si no hubo elementos omitidos, o `omitted_items` si los hubo. Un corte, error o presupuesto agotado antes de la última página deja `cycle_incomplete`. Un cambio de generación vuelve el estado a `unknown`. No se persisten ni exponen conteos de omisiones.
- Cada llamada existente a `tn_publish_catalog` envía en `p_state` `new_traversal` (true solo en la página 1) y `has_omitted_products` (resultado booleano de esa página). La base reinicia el acumulador solo con `new_traversal`, conserva el OR de omisiones de páginas previas y usa el argumento existente `complete` para cerrar el recorrido; no se cambia la aridad ni se agregan casts.
- `quality.identity='completa'` solo si existe cobertura completa y todos los pedidos elegibles, no suprimidos y dentro de la ventana tienen estado `verified`; es `incompleta` si cualquiera tiene `absent`, `invalid` o `unverified`; es `no_evaluable` si no hay pedidos elegibles para evaluar. No se divulgan cantidades de casos por estado.
- `quality.orderLines='completas'` solo si todos esos pedidos tienen `insights_lines_status='complete'`; cualquier otro estado la hace `incompletas`. `quality.catalog='completo'` solo si el estado persistido es `complete`. La interrupción de ciclo, la omisión de productos o los estados iniciales no se convierten en completitud por el hecho de que exista un catálogo anterior.
- `productEvidence.catalogComplete` y `linesComplete` son exactamente esos dos resultados. `crossSell` se abstiene con `dato_incompleto` si cualquiera es falso o si las líneas candidatas no enlazan a productos vigentes del mismo catálogo/conexión. Aun con ambas calidades completas, solo está disponible cuando se cumplen los dos umbrales k=5 de §7; no persiste ni devuelve conteos o claves del par. La calidad incompleta no bloquea propuestas que no dependan de productos.

Reglas de cardinalidad: `segments.rows` contiene los seis códigos exactamente una vez y en el orden de prioridad de §4; si un grupo de 1–4 obliga supresión, se usa la variante `unavailable`, nunca filas parciales. `cohorts.rows` tiene como máximo 24 meses únicos y descendentes; cada fila tiene offsets enteros únicos `0..12`, ordenados. La evolución se deriva exclusivamente de esas celdas y no se duplica en `payload`. Los nombres de producto tienen 1–255 caracteres, son texto no confiable escapado por React y nunca incluyen IDs.

`productEvidence.catalogComplete` equivale a `quality.catalog==='completo'` y `linesComplete` a `quality.orderLines==='completas'`; `crossSell.status='available'` exige ambos verdaderos. Una contradicción entre esos campos invalida todo el payload.

El `payload jsonb` de `public.tn_customer_insights` es exactamente `InsightsData`, sin envoltorio ni propuestas. SQL lo produce; `contract.ts` lo valida al leer. Las propuestas se construyen después, en servidor, y se agregan solo a la vista:

```ts
type ViewContext = Readonly<{
  source: 'tiendanube';
  asOfDay: string | null;
  fetchedAt: string | null;
  timezone: string | null;
  currency: string | null;
  rfmFrom: string | null;
}>;

type CurrencySelection = Readonly<{
  availableCurrencies: readonly string[];
  selectedCurrency: string | null;
}>;

type CustomerInsightsView = CurrencySelection & (
  | Readonly<{ kind: 'sin_empresa' }>
  | Readonly<{ kind: 'sin_conexion'; actionHref: '/app/integraciones' }>
  | Readonly<{ kind: 'requiere_reauth'; actionHref: '/app/integraciones' }>
  | Readonly<{ kind: 'actualizando' }>
  | Readonly<{ kind: 'sin_cobertura'; context: ViewContext; actionHref: '/app/integraciones' }>
  | Readonly<{ kind: 'sin_compras'; context: ViewContext }>
  | Readonly<{ kind: 'monetario_no_validado'; data: InsightsData; proposals: readonly AudienceProposal[] }>
  | Readonly<{ kind: 'calidad_insuficiente'; data: InsightsData; proposals: readonly AudienceProposal[] }>
  | Readonly<{ kind: 'privacidad'; data: InsightsData; proposals: readonly AudienceProposal[] }>
  | Readonly<{ kind: 'listo'; data: InsightsData; proposals: readonly AudienceProposal[] }>
  | Readonly<{ kind: 'error' }>
);
```

La página pasa al loader solo `searchParams.currency`; el valor es no confiable y se valida como un único string `[A-Z]{3}` (una lista repetida también es inválida). El loader obtiene `availableCurrencies` de las filas de `public.tn_customer_insights` visibles mediante el JWT y RLS, para la conexión activa y generación actual, en orden ascendente. Si el parámetro falta o es nulo, elige la primera moneda disponible en ese orden; si no hay filas, `selectedCurrency=null`. Primero se rechaza una forma malformada; luego se resuelve tenant/conexión y `needs_reauth`; `last_run_status='running'` devuelve `actualizando` aun si el snapshot fue invalidado. Con cobertura incompleta o sin última ejecución completa devuelve `sin_cobertura`. Con cobertura completa y `last_run_status='complete'`, si no hay monedas ni pedidos elegibles en `tn_sales_daily` dentro de `[C-364,C]`, devuelve `sin_compras`; si hay pedidos elegibles pero todavía no existe snapshot, devuelve `sin_cobertura`, nunca `sin_compras`. Tras esos estados, un parámetro válido pero no disponible en estado idle con snapshot disponible devuelve `kind='error'` genérico con `selectedCurrency=null` y sin consultar el getter. Para una selección válida llama `get_tn_customer_insights` con esa moneda, y valida que `payload.currency` coincida; una discrepancia es error. El selector cambia la moneda mediante GET `?currency=XXX`; no se aceptan `company_id` ni `connection_id` en URL, formulario o loader. En estados sin empresa/conexión/monedas, `availableCurrencies=[]` y `selectedCurrency=null`. No se infieren monedas a partir de pedidos privados.

Los mensajes se eligen por `kind` desde texto fijo y no viajan en el DTO. El loader resuelve la primera coincidencia en este orden: error inesperado o currency con forma inválida → `error`; sin empresa; sin conexión; `needs_reauth`; sync en curso → `actualizando`; cobertura incompleta/sin ejecución completa → `sin_cobertura`; sin compras (incluido el caso sin moneda con cobertura completa definido arriba) → `sin_compras`; currency con forma válida pero no disponible → `error`; `monetary.status='unverified'`; calidad insuficiente según la tabla siguiente; supresión de privacidad que impide la sección principal; en otro caso, `listo`.

| Estado validado de calidad | `kind` de vista | `segments` | Efecto |
|---|---|---|---|
| Sync en curso y snapshot invalidado por start/publicación | `actualizando` | No hay `InsightsData` | La UI muestra «El análisis se está actualizando»; no conserva ni devuelve el snapshot anterior. |
| Cobertura completa y no hay pedidos elegibles ni moneda disponible | `sin_compras` | No hay `InsightsData` | `availableCurrencies=[]`; no se inventa una moneda o un cero de actividad. |
| `monetary.status='unverified'`, definición nula | `monetario_no_validado` | `unavailable`, ausencia `monetario_no_validado` | Monetary y métricas económicas indisponibles; se conservan cohortes no monetarias válidas y solo propuestas no dependientes de M. |
| `monetary.status='incomplete'` o `'inconsistent'`, definición nula | `calidad_insuficiente` | `unavailable`, ausencia `dato_incompleto` | No se publica M; no se habilitan alto valor ni propuestas dependientes de M. |
| Identidad incompleta, catálogo incompleto o líneas incompletas | `calidad_insuficiente` | Los segmentos solo cuentan IDs válidos; `quality.identity` señala que no representan todas las órdenes elegibles. No se divulga cantidad de invitados/error. | Las propuestas pueden usar evidencia disponible, pero `identifiedCustomers=null` con `dato_incompleto` si la identidad no es completa; venta cruzada se abstiene si falla catálogo/líneas. |
| `monetary.status='verified'` con definición A/B vigente, calidad suficiente y al menos una sección principal suprimida | `privacidad` | Ausencia `privacidad` donde corresponda | No se reconstruyen valores ni se publican grupos protegidos. |
| `monetary.status='verified'` con definición A/B vigente, calidad suficiente, sin supresión que impida la sección principal | `listo` | `available` o la forma permitida por privacidad de §6 | Solo incluye métricas y propuestas respaldadas y divulgables. |

`monetary.status='verified'` requiere que cada pedido elegible del universo tenga estado verificado, fórmula persistida igual a `M27A_MONETARY_DEFINITION` y evidencia T-04 registrada; un estado verificado sin definición o una definición discrepante invalida el payload y produce `error`. `unverified` con definición no nula también es inválido. `incomplete` e `inconsistent` nunca se traducen a `monetario_no_validado`: son `dato_incompleto`. `privacidad` exige al menos `segments`, `cohorts` o `productEvidence.crossSell` indisponible por privacidad. Un error no lleva texto del proveedor.

`AudienceProposal` tiene forma exacta:

```ts
type ProposalId =
  | 'fidelizacion_v1'
  | 'remarketing_v1'
  | 'reactivacion_riesgo_v1'
  | 'reactivacion_inactivos_v1'
  | 'exclusion_adquisicion_v1'
  | 'similares_alto_valor_v1'
  | 'venta_cruzada_v1';

type CriterionCode =
  | `segment_${SegmentCode}`
  | 'comprador_identificado_365d'
  | 'compro_producto_a'
  | 'no_compro_producto_b';

type SegmentMetricKey =
  | 'customers' | 'orders' | 'monetary' | 'monetaryPerCustomer'
  | 'monetaryPerOrder' | 'recencyMedianDays' | 'frequencyMean';
type CohortMetricKey =
  | 'activeCustomers' | 'retention' | 'repeatPurchaseCumulative'
  | 'observedValue' | 'ticket' | 'observedValuePerCustomerCumulative'
  | 'meanDaysBetweenPurchases' | 'repeatCustomers' | 'purchaseIntervals';
type EvidenceRef =
  | `segments.${SegmentCode}.${SegmentMetricKey}`
  | `cohorts.${string}.${number}.${CohortMetricKey}`
  | 'productEvidence.crossSell';

type AudienceProposal = Readonly<{
  id: ProposalId;
  ruleVersion: 'audience_rules_v1';
  name: string;
  objective: string;
  segmentRefs: readonly SegmentCode[];
  identifiedCustomers: Metric | null;
  identifiedCustomersAbsence: 'privacidad' | 'dato_incompleto' | 'monetario_no_validado' | null;
  inclusion: readonly CriterionCode[];
  exclusion: readonly CriterionCode[];
  evidenceRefs: readonly EvidenceRef[];
  justification: string;
  suggestedStrategy: string;
  limitations: readonly string[];
}>;
```

`identifiedCustomers` y `identifiedCustomersAbsence` son XOR; cuando existe la métrica, su unidad/definición son `customers`/`proposal_identified_customers_v1`. `EvidenceRef` debe resolver a una métrica visible del mismo `InsightsData`; mes y offset se validan contra las filas, no solo por regex. `name`, `objective`, `justification`, `suggestedStrategy` y `limitations` coinciden exactamente con el catálogo fijo de `rules.ts`; no son texto de Tiendanube ni reglas libres. No hay listas ni identificadores individuales.

### 2. Datos y publicación agregada (D-M27a-01)

Se aprueba **un snapshot agregado vigente por conexión y moneda**, no perfiles nuevos persistidos. Este diseño permite RLS de lectura sin otorgar SELECT privado a authenticated. Durante sincronización, invalidación o recálculo el análisis queda temporalmente indisponible y la interfaz lo informa con un estado claro; se prioriza consistencia sobre disponibilidad permanente.

Nueva `public.tn_customer_insights`: `company_id uuid not null`, `connection_id uuid not null`, `currency text not null`, `generation integer not null`, `ruleset text not null`, `as_of_day date not null`, `fetched_at timestamptz not null`, `payload jsonb not null`. PK (connection_id,currency); FK compuesta (company_id,connection_id) a integration_connections con cascada, company_id consistente. Solo datos públicos ya sanitizados dentro de payload; no IDs de personas ni conteos ocultos en JSON lateral, atributos, metadatos o errores.

La nueva migración agrega a `private.tn_orders` `insights_identity_status text not null default 'unverified' check (insights_identity_status in ('verified','absent','invalid','unverified'))` e `insights_lines_status text not null default 'unverified' check (insights_lines_status in ('complete','source_omitted','source_invalid','line_omitted','unverified'))`. En `public.tn_sync_status` agrega `insights_catalog_status text not null default 'unknown' check (insights_catalog_status in ('unknown','cycle_incomplete','omitted_items','complete'))`, `insights_catalog_has_omissions boolean not null default false`, `insights_rebuild_pending boolean not null default false` e `insights_rebuild_started boolean not null default false`. La migración no infiere estados históricos: las filas existentes quedan `unverified`/`unknown`; las conexiones con estado de sincronización existente quedan `insights_rebuild_pending=true`. También se limpia `catalog_next_page` para forzar un recorrido de catálogo nuevo desde página 1 y no heredar una parcialidad sin procedencia.

Para consumir `insights_rebuild_pending`, `tn_start_sync` conserva la firma actual y, si el indicador está activo, inicia una ejecución `backfill` desde `historyStart` aunque la sincronización ordinaria ya estuviera en `incremental`. En el primer inicio pone `insights_rebuild_started=true`, `backfill_next=null` y `watermark` al instante actual de base; ante un corte conserva watermark y checkpoint para reanudar. `tn_publish_orders` avanza ese checkpoint con su contrato existente. Un backfill completo en `tn_finish_sync` deja los indicadores en false y vuelve al flujo incremental normal; el snapshot M27a solo se publica después de un siguiente incremental completo. Un backfill interrumpido no publica snapshot y se reanuda en el siguiente sync manual. No se elimina `coverage_until` ni se borra el dataset que consumen pantallas anteriores. Conexiones nuevas siguen el backfill inicial existente y no necesitan el indicador.

RLS ENABLE + FORCE; SELECT authenticated solo por private.is_company_member(company_id), conexión Tiendanube activa, misma generación y sin snapshot invalidado. REVOKE ALL a public/anon/authenticated/service_role/praxa_integrations; luego solo SELECT authenticated. Ningún grant de escritura para usuarios o acceso directo para rol acotado. La conexión/política resuelve membresía bajo RLS; no acepta company_id del cliente.

Nueva `public.get_tn_customer_insights(p_connection_id uuid, p_currency text)` → TABLE(`as_of_day date, fetched_at timestamptz, ruleset text, payload jsonb`), STABLE, SECURITY INVOKER, search_path vacío. Entrada UUID no nula y moneda ISO de tres letras; error 22023 con mensaje fijo para sintaxis inválida. Conexión ajena/inactiva o snapshot ausente devuelve cero filas. EXECUTE solo authenticated; getter no calcula con acceso privilegiado a tablas privadas.

Nuevos helpers `private.tn_refresh_customer_insights(p_connection_id uuid)` y `private.tn_invalidate_customer_insights(p_connection_id uuid)`: sin grants a roles runtime, llamados desde operaciones privilegiadas ya autorizadas. INVOKER por defecto; no helper DEFINER accesible a authenticated. Refresh identifica empresa/proveedor/generación desde la conexión bloqueada; no recibe datos ni tenant del navegador. El único contexto de ejecución es la transacción de sincronización verificada con actor/empresa/run/lease. No expone personas al servidor Node ni devuelve filas de clientes.

La migración nueva reemplaza con mismas firmas/grants:
- `worker_api.tn_start_sync(uuid,uuid,uuid,integer,uuid,uuid,timestamptz)`: invalida snapshot al empezar, en la misma transacción, después de validar ownership. No sirve un snapshot con entradas reemplazadas parcialmente. Si `insights_rebuild_pending=true`, crea un run de fase `backfill` sin cambiar la aridad; en la primera ejecución establece watermark/checkpoint para releer desde `historyStart`, y ante un run incompleto lo reanuda desde `backfill_next`.
- `worker_api.tn_publish_orders(uuid,uuid,uuid,integer,uuid,uuid,jsonb,jsonb,jsonb)`: invalida antes de modificar pedidos, por defensa también ante llamadas a publicaciones con snapshot viejo. Guarda calidad monetaria, de identidad y de líneas en columnas privadas nuevas del pedido, no JSON bruto.
- `worker_api.tn_publish_catalog` conserva su firma/grants y su tercer argumento booleano; el JSON `p_state` añade solo `new_traversal` y `has_omitted_products` booleanos. La nueva migración conserva el estado de omisiones entre páginas y fija `insights_catalog_status` en `complete`/`omitted_items` al terminar, o `cycle_incomplete` si el recorrido se interrumpe. `worker-api.ts` y sus casts no cambian.
- `worker_api.tn_finish_sync(uuid,uuid,uuid,integer,uuid,uuid,timestamptz,boolean)`: tras finalizar incremental completo y cobertura válida, construye snapshot en la misma transacción; backfill/incomplete no publica listo. Al completar backfill de rebuild limpia `insights_rebuild_pending/started`; el snapshot espera el siguiente incremental completo. Error de cálculo revierte esa transacción y no publica falso completo.
- Trigger nuevo de INSERT en `private.tn_redaction_suppressions`: invalida agregados de conexiones afectadas en esa misma transacción. También al UPDATE de estado/generación/zona/moneda en integration_connections: invalida sin cambiar lifecycle ni grants existentes; al cambiar generación o zona marca `insights_rebuild_pending` para una relectura completa en el siguiente sync manual.
- En borrado de pedidos/líneas/cliente, invalidación por conexión; no reconstruir resultados mientras queden supresiones sin procesar. Recalcular en próximo incremental completo. Purga/store_redact no pueden dejar payload; eliminarlo desde las funciones de purga y privacy mediante reemplazos con mismas firmas, antes de terminar cada borrado de conexión. Cascade cubre borrar empresa/conexión.
- Los callbacks y APIs externas no cambian. `worker-api.ts` queda intacto: `tn_publish_orders` conserva sus nueve argumentos y sus casts actuales. Sí cambian la forma interna de cada elemento del segundo JSONB (`orders`) y su contrato TypeScript, no la aridad RPC:
  - `projection.ts` extiende `ProjectedOrder` con los tres campos monetarios de §3 y con `insights_identity_status` e `insights_lines_status`, usando los estados y reglas de procedencia definidos arriba; ninguna clave nueva contiene payload o PII;
  - `sync.ts` obtiene los campos monetarios del parser estricto y, mientras T-04 no seleccione A o B, publica siempre `null`, `unverified`, `null`; también persiste los estados de identidad/líneas y la omisión de productos por página;
  - `repository.ts` modifica el contrato de entrada de `publishOrders` para validar estrictamente esos cinco campos antes de `JSON.stringify`; sigue enviando `window`, `orders` y `lines` en los tres JSONB existentes, y valida el JSON de `publishCatalog` con los dos booleanos adicionales;
  - la nueva migración reemplaza `worker_api.tn_publish_orders` con la misma firma/grants y revalida las cinco claves nuevas de cada pedido antes de guardarlas en columnas privadas; reemplaza el cuerpo de `tn_publish_catalog` con la misma firma/grants para validar su estado de recorrido.
  No se agrega función a la allowlist ni se modifica `SQL_CASTS`. Una necesidad de cambiar nombre, cantidad u orden de argumentos exige parar y enmendar la spec antes de usarla.

Filtrar pedidos suprimidos incluso antes de su borrado efectivo. Lectura en un snapshot PostgreSQL coherente; publicaciones y privacidad usan los bloqueos existentes por empresa/conexión. La invalidación se confirma con la supresión. Una página ya entregada no es revocable: siguiente lectura no devuelve el dato; sin caché compartida ni persistencia de DTO en navegador, logs o analítica.

Refresh tiene presupuesto igual o inferior al timeout de 15 s del cliente existente y debe medirse con 10.000 pedidos/2.000 IDs sintéticos y 24 meses. Si no cabe o hace falta dividir trabajos/crear worker, parar y reabrir Q-01; no aumentar timeout ni degradar exactitud silenciosamente. No mantener snapshot anterior tras invalidación para ocultar un fallo.

### 3. Monetary: investigación y validación obligatoria (D-M27a-02 y D-M27a-09)

La [documentación oficial de Order](https://tiendanube.github.io/api-documentation/resources/order) distingue precio total e importe pagado; describe cambios liquidados con signo en el historial de ediciones. **No acredita** que ese historial incluya el pago original ni que la suma del historial sea saldo final. Por tanto no basta sumar diferencias ni restarlas automáticamente al importe pagado. La elección empírica queda diferida a T-04 dentro de la implementación, bajo el contrato cerrado de esta sección; no existe fallback.

Contrato de decisión y parada aprobado en D-M27a-02:

- **A — `tn_paid_current_observed_v1`**, fórmula `insights_amount = total_paid_by_customer`, rótulo «importe pagado vigente observado»; solo si T-04 demuestra que la API ya descuenta devoluciones.
- **B — `tn_paid_current_less_verified_refunds_v1`**, fórmula `insights_amount = total_paid_by_customer - verified_refund_sum`, rótulo «importe pagado observado menos devoluciones verificadas»; solo si T-04 demuestra que la API conserva una base bruta y permite descontar sin duplicaciones. Un resultado negativo o una devolución mayor que la base es `inconsistent`, nunca se recorta a cero.
- **C — sin definición monetaria**, obligatoria si la evidencia es ambigua, insuficiente o inconsistente. No se publica M, el gate queda bloqueado y se revisa el alcance sin dividir M27a.

A y B no están habilitadas ni acreditadas antes de T-04. No usar total del pedido.

El transporte actual decodifica el cuerpo con `JSON.parse`: los tokens numéricos JSON llegan a la proyección como `number` y sus dígitos originales ya no se pueden recuperar. Para M27a, `total_paid_by_customer` solo es exacto si llega como string JSON decimal no negativo que cumpla `^[0-9]{1,15}(?:\.[0-9]{1,6})?$`; los `total_paid_diff` de entradas `PAID` usados por B solo son exactos si llegan como strings JSON con signo opcional y la misma precisión. Se permite espacio exterior, que se elimina antes de validar; no se aceptan exponentes, separadores ni conversiones desde `number`. Cualquier token numérico, string malformado, campo requerido ausente o diferencia relevante no validable da `insights_amount=null`, estado `incomplete` y bloquea M para el universo/moneda. No convertir a texto con `String`, `toFixed` ni reutilizar el monto normalizado de `ProjectedOrder` o `refundedFromHistory`; la extracción exacta de M27a usa los valores del objeto JSON decodificado y no altera los campos heredados de consumidores anteriores. La lógica nueva de historial distingue una diferencia inválida de una ausencia de reembolso: no la omite ni la interpreta como cero.

T-04 se ejecuta durante la implementación con tienda de prueba autorizada, pedidos sintéticos preparados por el usuario y lecturas de PRAXA solamente. Casos empíricos: pago normal; parcial a pagado; devolución parcial y total; cancelación antes/después de pagar; edición al alza con saldo pendiente y pagado, a la baja, varias ediciones y devolución; pedido sin historial; moneda y precisión. Comparar monto esperado conocido de cada operación sintética, forma y tipos JSON documentados de respuesta y saldo según proveedor. Si un importe necesario aparece como token numérico JSON en cualquier caso que sustente A o B, la evidencia no es concluyente y se selecciona C; no inferir exactitud a partir del `number` ya decodificado. Registrar evidencia redactada sin cuerpos, IDs ni montos reales. Historial malformado/incompleto o nulo, lectura interrumpida, presupuesto agotado, duplicados y reintentos se cubren con fixtures en T-05: prueban el cierre seguro del motor, no la semántica externa.

El futuro plan debe poner T-04 en una etapa monetaria temprana, después de implementar el lector/parser estricto y antes de asignar a `M27A_MONETARY_DEFINITION` un valor distinto de `null`, publicar M, etiquetar `alto_valor` o generar propuestas dependientes de M. Esa etapa debe contener, sin valores secretos:

1. **Entrada y permisos:** usuario owner de una empresa sintética; tienda de prueba administrada por el usuario; scopes exactos `read_orders`, `read_customers` y `read_products`; autorización expresa del destino no productivo. PRAXA solo hace GET. El usuario crea, paga, edita, reembolsa y cancela los pedidos sintéticos desde Tiendanube.
2. **Entorno:** despliegue no productivo con callback OAuth autorizado y base desechable confirmada por las guardas; secretos cargados por el usuario fuera del chat; nunca el proyecto `app`. Si obtener ese entorno exige otra app, cambiar el callback de producción o ampliar permisos, el plan se detiene y pide autorización antes de actuar.
3. **Herramientas:** preflight existente para forma/presencia de configuración; OAuth y sincronización de PRAXA; lector estricto implementado aún con definición nula; inspección administrativa del usuario en el desechable de los campos cerrados y sintéticos necesarios para la conciliación. No persistir payload bruto ni imprimir token, IDs o cuerpos.
4. **Procedimiento:** preparar la matriz de casos; sincronizar después de cada transición; contrastar A y B contra el resultado sintético conocido; registrar por caso versión de API, forma/tipos observados y `A_coincide | B_coincide | inconsistente`, sin identificadores ni montos reales; desconectar, desinstalar y verificar purga al terminar.
5. **Salida:** evidencia concluyente común a todos los casos habilita exactamente A o B y su código/rótulo versionados; cualquier mezcla, ausencia o contradicción produce C. Registrar el resultado en `meta_first/sesiones/M27a.md`, mantener consumidores anteriores deshabilitados y ejecutar de nuevo las pruebas monetarias. T-04 no se considera ejecutado por esta decisión documental.

Columnas privadas previstas en tn_orders: `insights_amount numeric null`, `insights_amount_status text not null default 'unverified'`, `insights_amount_definition text null`. Estados `verified | unverified | incomplete | inconsistent`. Invariante: verified exige monto >=0 y versión validada; demás exigen monto nulo. Validar contra el estado y source_updated_at de ese pedido, sin reutilizar una verificación de versión anterior. Reintento no suma montos ni mantiene verified después de un cambio no reconciliado.

Nueva constante server-only `M27A_MONETARY_DEFINITION` en customer-insights/monetary.ts comienza nula; solo puede tomar `tn_paid_current_observed_v1` o `tn_paid_current_less_verified_refunds_v1` después de evidencia concluyente de T-04 registrada. La disponibilidad efectiva exige esa evidencia, cada pedido elegible del universo con estado verified, cobertura y moneda coherentes; una constante activa sola no prueba calidad. Pedidos existentes comienzan unverified: relectura mediante sincronización completa autorizada, no actualización ciega. No descartar clientes con importes desconocidos para hacer pasar el control.

Parser estricto para los strings decimales aceptados arriba, con precisión exacta y sin pasar por `number`. Un token numérico JSON ya convertido por el transporte, una diferencia relevante inválida o un campo requerido ausente produce `incomplete`, nunca un importe aproximado ni un cero; bloquea M del universo/moneda y no afecta los consumidores antiguos ni sus métricas. En ausencia de M se muestra motivo y RF puede ser diagnóstico parcial, sin rótulo de alto valor ni propuestas dependientes de M.

T-04 selecciona la fórmula y el rótulo condicionales ya aprobados; no crea una tercera alternativa. Aun validado, M es valor monetario observado de pedidos elegibles, no ingreso contable, beneficio ni saldo bancario; excluye pedidos totalmente reembolsados/cancelados según elegibilidad heredada. No atribuye devoluciones a su fecha de caja: refleja estado vigente de pedidos agrupados por su fecha comercial.

### 4. Universo y RFM (D-M27a-03 y D-M27a-04)

Corte `C` = último día local completo acreditado por coverage_until. Ventana fija inclusiva `[C-364,C]`; universo = IDs opacos con al menos un pedido elegible dentro. Estado actual de pedidos al terminar la extracción; nunca afirmar reconstrucción de estado pasado a C. Sin corte histórico elegible a elección del navegador ni filtros libres. La primera compra para cohortes se busca en todo el histórico cubierto, no en la ventana RFM. La interfaz declara que la segmentación representa actividad dentro de esos 365 días y no la totalidad de la base histórica. El cálculo solo cuenta `customer_id` válidos; cualquier estado `absent`, `invalid` o `unverified` se refleja en `quality.identity` y no se convierte en cliente ni en importe cero.

Por ID/conexión/moneda: R = C menos último local_day elegible, en días calendario; F = número de pedidos elegibles distintos; M = suma exacta de insights_amount verified en la ventana. Dos pedidos el mismo día cuentan dos; diferencias entre compras se resuelven como abajo. M puede ser cero verificado, nunca reemplaza ausencia. El mismo ID con compras en dos monedas se evalúa por moneda, sin sumarlo como dos personas en un total global.

Scoring determinístico `rfm_v1`: R_score 5 para R≤30; 4 para 31–60; 3 para 61–90; 2 para 91–180; 1 para 181–364. F_score 1 para F=1; 2 para F=2; 3 para 3–4; 4 para 5–9; 5 para ≥10. M_score por cuartiles de valores monetarios distintos de los clientes del universo/moneda: score 1–4 usando cortes de percentil discreto 25/50/75; igualdad queda en intervalo inferior, salvo que todos tengan mismo M, caso score común 1. No romper empates por ID ni ordenar personas arbitrariamente. Alto valor relativo exige variedad de M y score 4; no inferir alto valor de universo homogéneo. Mostrar distribución de segmentos, no tabla de personas o combinaciones R/F/M. La regla no es configurable por empresa en esta versión.

Partición exclusiva, evaluada en este orden y asignando la primera coincidencia: inactivos R>180; riesgo 91≤R≤180; nuevos F=1 y R≤30; alto_valor R≤90, F≥2 y M_score=4 con variedad; frecuentes R≤90 y F≥3; potencial resto. Cada cliente tiene exactamente un segmento. Las etiquetas son reglas comerciales relativas a la población analizada, no probabilidades predichas de abandono; la población fuera de 365 días no se llama inactiva de este análisis. Explicar esa exclusión.

Cada segmento publica solo agregados divulgables: clientes distintos, pedidos, M, M/cliente y M/pedido, mediana de R y media de F; denominadores explícitos. No confundir mediana con promedio. No publicar ranking individual ni extremos monetarios personales.

### 5. Cohortes y métricas (D-M27a-05)

Catálogo aprobado: últimas 24 cohortes mensuales observadas y offsets 0–12; meses completos para comparar. Primer pedido elegible actual de cada ID/moneda en histórico cubierto determina mes c. Se rotula siempre primera compra observada: backfill completo no garantiza compras previas a la plataforma ni fusiona identidades. Supresión o cancelación puede cambiar c; no reconstrucción histórica.

Por cohorte c y offset n:
- tamaño N_c: IDs distintos de la cohorte; activos A_c,n: IDs con ≥1 pedido elegible en ese mes; retención A/N. N=0 no genera porcentaje; n=0 es 100% solo si N visible.
- recompra acumulada: IDs con ≥2 pedidos elegibles desde primera compra hasta cierre de c+n, dividido N_c. Incluye dos pedidos en mes inicial; no igualar esta medida a retención mensual.
- valor observado de cohorte: suma de M validado de pedidos de esos IDs en el mes; ticket = valor/pedidos elegibles de la celda; valor acumulado/cliente = suma desde c hasta c+n / N_c. No llamar LTV.
- tiempo entre compras: media de días calendario entre pedidos consecutivos elegibles de IDs que repiten, usando local_day y desempate técnico por external_order_id dentro de SQL. Dos pedidos el mismo día producen intervalo 0. Denominador = número de intervalos, no todos los clientes; indicador acompañado por número de compradores repetidores divulgable.
- dinero separado por moneda; retención heredada de M16e se compara en fixture monomoneda y solo se reutiliza semánticamente. El getter actual no aporta economía, recompra ni intervalos y su cuadrícula termina en último mes con compras: construir cuadrícula explícita para meses transcurridos sin compras. Un mes futuro/abierto es `periodo_abierto`; un mes no cubierto es `sin_cobertura`; en un mes cubierto, todo conteo de contribuyentes 0–4 se suprime como `privacidad`, nunca se publica como cero. Por tanto el cero observado queda dentro del grupo protegido 0–4 y no se distingue de 1–4; sí se distingue de meses abiertos/no cubiertos sin inventar una métrica.
- privacidad se aplica a contribuyentes de cada métrica, no solo tamaño de cohorte; si activos/compradores que aportan intervalos son pocos, ocultar también dinero, medias y tasas que los revelarían.

Todas las métricas enumeradas forman el catálogo aprobado. Las que no puedan validarse quedan indisponibles con explicación, sin reemplazo, estimación ni métrica sustituta.

### 6. Privacidad y límites de interacción (D-M27a-06)

Se exige k=5 para cualquier grupo o contribuyentes de métrica visible. Mantener regla vigente de cohortes: tamaño <5 oculta fila; activos <5 oculta celda, incluidos ceros según contrato vigente. Un mes cubierto con cero activos y uno con 1–4 se codifican igual como `privacidad`; ninguno se presenta como cero ni se distingue entre sí. `sin_cobertura` y `periodo_abierto` siguen siendo estados diferentes. No reconstruir un conteo oculto usando tasa o monto.

En segmentos exclusivos: si alguno contiene entre 1 y 4 IDs, ocultar **toda la distribución de esa moneda**, sus totales y métricas económicas, no solo esa fila. No publicar total exacto, porcentajes, gráficos con tamaño proporcional ni conteos de exclusiones que permitan restar. Si todos los segmentos no vacíos tienen ≥5, los vacíos pueden mostrar cero. Una etiqueta de grupo oculto no revela el conteo exacto.

No filtros de período, producto, umbral, segmento cruzado ni selector de cortes históricos; la moneda se elige entre resultados independientes sin total conjunto. Propuestas referencian exactamente grupos ya divulgados; no publican nuevas intersecciones ni uniones con conteos calculados en cliente. Conteo total de clientes existentes solo si toda partición es divulgable y no permite inferir un grupo protegido.

La cobertura de identidad se muestra como calificación `completa | incompleta | no_evaluable`; no exponer conteos/porcentajes pequeños de invitados o errores como vía de resta. Las pruebas deben intentar reconstrucción por totales, tasas, tooltips, JSON, varias propuestas y vistas de cohortes. k-anonimato no impide inferencias con conocimiento externo ni diferencias entre snapshots sucesivos; D-M27a-06 acepta expresamente ese límite residual. La interfaz explica la indisponibilidad por privacidad sin revelar tamaño ni existencia precisa de los grupos ocultos. No prometer anonimización irreversible ni privacidad diferencial.

### 7. Propuestas y reglas (D-M27a-07)

Propuestas con texto fijo, nombre y objetivo claros; métricas refieren a definición/corte/segmento, no a cifras inventadas. Si no hay evidencia o privacidad, no producir recomendación accionable: mostrar razón de indisponibilidad, sin una audiencia vacía ficticia.

| Regla prevista | Inclusión/exclusión | Evidencia y estrategia sugerida |
|---|---|---|
| fidelizacion_v1 | alto_valor; excluir todos los demás segmentos | M/cliente y F del segmento; sugerir mensaje de fidelización, sin prometer eficiencia ni presupuesto. |
| remarketing_v1 | potencial; excluir nuevos, riesgo, inactivos, frecuentes, alto_valor | R/F y recompra observada; sugerir recordar propuesta de valor o reposición, solo como hipótesis comercial. |
| reactivacion_riesgo_v1 | riesgo; excluir otros segmentos | R y compras observadas; mensaje de regreso, no afirmación de abandono efectivo. |
| reactivacion_inactivos_v1 | inactivos dentro de ventana; excluir otros | Misma evidencia y límites de ventana; no incluir clientes fuera de cobertura. |
| exclusion_adquisicion_v1 | todos los IDs identificados con compra elegible en ventana; excluir sin ID | Evidencia de clientes existentes; sugerir considerarlos exclusión, sin lista ni capacidad de aplicarla desde PRAXA. |
| similares_alto_valor_v1 | mismo grupo alto_valor; excluye otros | Proponerlo como posible semilla; PRAXA no valida requisitos, coincidencias o tamaño utilizable de Meta. |
| venta_cruzada_v1 | grupo frecuente o alto_valor con evidencia válida de productos; sin lista individual | Recomendar revisar complementariedad observada, nunca inventar categorías ni afirmar intención. Caso específico definido abajo y aprobado en D-M27a-07. |

Venta cruzada conservadora: seleccionar solo un par de productos no eliminados A/B con mayor número de compradores distintos de ambos, dentro del grupo divulgado frecuente o alto_valor; desempate por claves técnicas, sin exponerlas. Exigir ≥5 compradores distintos para co-compra y para A sin B dentro de ese segmento, y catálogo completo/líneas no omitidas. La selección objetivo sería quienes compraron A y no B; **no publicar cantidad de esa intersección** ni sus métricas; identifiedCustomers=null con absence privacidad. Presentar respaldo cualitativo «co-compra observada con muestra suficiente» y referencia al agregado de calidad, sin cifras de par que permitan restas. Si no hay par seguro, propuesta no disponible. Las claves y conteos de par solo se usan dentro del SQL antes de sanitizar; DTO puede incluir nombres de productos tratados como texto no confiable y sin IDs. No afirmar causalidad, complementariedad ni rentabilidad garantizada.

Los nombres no permiten HTML ni instrucciones; escape normal de React. No llamadas a proveedores LLM ni a Meta. No métricas calculadas sobre personas externas al histórico; número identificado no es alcance publicitario.

### 8. UI, errores y frescura (D-M27a-08)

Página Clientes: fuente, período y corte, frescura, cobertura/identidad; distribución RFM y economía válida; matriz y gráfico de evolución con tabla accesible equivalente; fichas de propuestas con toda su evidencia y limitaciones. La matriz de hasta 24 cohortes por 13 offsets debe facilitar lectura e interpretación en móvil y escritorio sin eliminar métricas válidas. Diseño reutiliza tokens y componentes, CSS local, responsive, sin biblioteca nueva. Barras/tasas sin ceros de relleno; valores ocultos sin tooltips o atributos que los reconstruyan. Solo moneda es selector; nunca aceptar company_id o connection_id por searchParams.

Mensajes fijos: «Conectá Tiendanube para analizar tus clientes», «Completá la sincronización para obtener cobertura», «El análisis se está actualizando», «El componente monetario todavía no está validado», «No hay compras elegibles en el período», «No se muestran estos agregados para proteger grupos pequeños», «No pudimos cargar el análisis». Ofrecer enlace a Integraciones, sin disparar sincronización automática.

Política aprobada D-M27a-08, medida como tiempo transcurrido desde fetchedAt: hasta 24 horas inclusive, sin advertencia; más de 24 horas y hasta 7 días inclusive, advertencia visible y propuestas disponibles; más de 7 días, propuestas bloqueadas. RFM/cohortes pueden seguir visibles como observación histórica al corte con advertencia, nunca como actuales. Con needs_reauth se bloquean propuestas y solo se muestra aviso/enlace. Esta política no anula la indisponibilidad e invalidación de D-M27a-01. Sin caché compartida; ninguna respuesta con datos de otra sesión. No exponer error original SQL/HTTP, IDs, payloads o importes en logs. No se altera comportamiento de pantallas anteriores.

## Archivos previstos

Solo la spec se crea durante esta expansión. Esta tabla autoriza implementación futura exclusivamente tras el pipeline. II.14d no tiene pasos numerados: se cita el grupo concreto, sin inventar pasos.

| Archivo | Nuevo o modificado | Para qué | Autorizado por |
|---|---|---|---|
| src/modules/customer-insights/{contract,rules,proposals,load,monetary}.ts | Nuevos | Contratos, reglas, carga y disponibilidad monetaria | II.14d, customer-insights |
| src/app/(app)/app/clientes/page.tsx | Nuevo | Página protegida | II.14d, pantalla |
| src/components/customer-insights/{clientes.tsx,clientes.module.css,cohort-matrix.tsx,cohort-evolution.tsx,audience-proposals.tsx} | Nuevos | Vista integrada y accesible | II.14d, componentes propios |
| src/components/app/shell.tsx | Modificado | Entrada Clientes; icono existente | II.14d, navegación |
| scripts/lib/demo-seed-sources.mjs | Modificado solo para emitir los campos nuevos de calidad/identidad/líneas con montos string | Que la empresa demo (`H-E1-273`) siga cargando y muestre `/app/clientes` | II.14d, empresa demo |
| src/modules/integrations/tiendanube/{projection,sync,repository}.ts | Modificados para lectura estricta, campos de calidad y publicación; misma aridad RPC y sin cambios para consumidores externos previos | Extracción monetaria, T-04, calidad y publicación | II.14d, insumos monetarios |
| supabase/migrations/NNNN_customer_insights.sql | Nueva; NNNN se resuelve al planificar/implementar, no reservado | Snapshot, columnas privadas, helpers, invalidación y reemplazos con mismas firmas | II.14d, solo migraciones nuevas |
| supabase/tests/21_customer_insights.test.sql | Nueva; revalidar prefijo libre al implementar | Cálculo, privilegios, RLS y borrado | II.14d, suite SQL nueva |
| supabase/tests/{09_integration_privileges,10_demo_closure,18_tiendanube}.test.sql | Modificados | Matriz, cierre y compatibilidad | II.14d, regresiones SQL |
| tests/unit/{customer-insights-contract,customer-insights-proposals,customer-insights-load,customer-insights-monetary}.test.ts | Nuevos | Contrato, reglas, fronteras y dinero | II.14d, unit |
| tests/unit/{tiendanube-sync,tiendanube-analysis,chat-tiendanube,diagnostics-tiendanube,no-privileged-credentials}.test.ts | Modificados solo pruebas necesarias; sin código de consumidores | Regresiones de no activación y confinamiento | II.14d, regresiones |
| tests/component/customer-insights.test.tsx | Nuevo | Comportamiento, ocultamiento y accesibilidad | II.14d, component |
| tests/app/customer-insights.test.ts | Nuevo | JWT/Data API reales, concurrencia y tamaño | II.14d, app |
| tests/app/{tiendanube-sync,tiendanube-data-api}.test.ts | Modificados | Publicación y privacy integradas | II.14d, regresiones app |
| docs/SECURITY.md §§5,8,9,12 | Modificado | Capacidad agregada, no LLM, minimización/borrado y riesgo de inferencia | II.14d, documentos transversales |
| docs/ARCHITECTURE.md, módulos/base/flujos | Modificado | Módulo y publicación que pasan a existir | II.14d, documentos transversales |
| docs/FASES/FASE1/M03a/acta-meta.md | Modificado | Finalidad ampliada y límites, antes de uso real | II.14d, acta |
| docs/FASES/FASE1/M27a/spec.md, plan.md, revisiones/*.md | Nueva documentación según paso invocado | Pipeline; no se crea plan en esta expansión | II.14d y precondición 9 |
| docs/FASES/FASE1/meta_first/sesiones/M27a.md; docs/{HALLAZGOS,PROJECT_STATE}.md | Seguimiento futuro | Comandos/evidencia, hallazgos y estado sin duplicar técnica | Precondición 8 e II.14d |

No modificar migraciones existentes. La lista y firmas pueden refinarse dentro de estos módulos antes de aprobar el plan; fuera de ella exige enmienda. No se prevé modificar worker-api.ts, analysis.ts o limits.ts: están autorizados por ruta, pero el diseño conserva aridades y deshabilitación global. No tocar .env.local.

## Criterios de aceptación

### Heredados de la ruta

Los puntos de §18 no tienen IDs CA propios; se conservan referencias exactas por punto, sin inventar numeración normativa.

| ID de la ruta | Exigencia |
|---|---|
| §18.1 | RFM completo, determinístico, versionado, elegibilidad y Monetary obligatorio. |
| §18.2 | Fórmula validada y sin habilitación monetaria global. |
| §18.3 | Calidad, pagos/ediciones/devoluciones, ausencia y monedas; falla bloquea gate. |
| §18.4 | Cohortes y catálogo de métricas válidas, sin causalidad ni meses inventados. |
| §18.5 | Identidad opaca, invitados, no deduplicación personal, estado vigente y borrado. |
| §18.6 | Pantalla integrada, JWT/RLS y privacidad de grupos. |
| §18.7 | Propuestas con todos los campos y límites de alcance/eficacia. |
| §18.8 | Sin audiencias operativas, identificadores externos, LLM ni ampliación chat/diagnóstico. |
| §18.9 | Un gate, TDD, pruebas sintéticas y paralelismo condicionado. |
| §18.10 | Finalidad aprobada y comunicada antes del uso real. |
| CB-01 | verify y suites requeridas pasan. |
| CB-02 | Sin secretos, PII ni montos/IDs reales en diff/evidencia. |
| CB-03 | Migraciones existentes intactas. |
| CB-04 | Pruebas solo en destinos autorizados; no suites/fixtures contra app. |
| CB-05 | Evidencia de comandos y resultados reales. |
| CB-06 | Omisión de una prueba requerida no acredita gate. |

### Operativos de esta microfase

| ID | Criterio verificable | Traza |
|---|---|---|
| M27a-C-01 | Tenant/identidad se resuelven en servidor, entrada ajena no revela filas y roles no autorizados no leen/escriben. | §18.6 |
| M27a-C-02 | R/F/M dan valores exactos del fixture y misma entrada/corte/reglas producen misma salida; umbrales y empates aprobados. | §18.1 |
| M27a-C-03 | Universo, período, zona y moneda explícitos; selector limitado a monedas con snapshot visible por RLS, default determinístico y cambio por `?currency=`; invitados y múltiples IDs no se presentan como personas deduplicadas. | §18.1/5; D-M27a-03 |
| M27a-C-04 | T-04 selecciona A o B con conciliación concluyente en tienda sintética, o C ante cualquier ambigüedad; M nulo si falta validación/completitud y false global preservado. | §18.2/3; D-M27a-02/09 |
| M27a-C-05 | Cancelaciones, parciales, devoluciones, ediciones, nulos y reintentos respetan elegibilidad sin doble descuento. | §18.3 |
| M27a-C-06 | Cuadrícula distingue mes futuro/abierto, no cubierto y celda protegida 0–4 (`privacidad`, incluido cero no visible); retención/recompra tienen denominadores correctos sin revelar el cero. | §18.4/6; D-M27a-05/06 |
| M27a-C-07 | Economía, ticket, valor observado e intervalos son exactos solo con calidad/denominador; sin LTV predictivo. | §18.4 |
| M27a-C-08 | Supresión primaria/secundaria alcanza SQL, tabla, DTO y UI, sin deducción por totales/propuestas/celdas. | §18.6 |
| M27a-C-09 | Propuestas satisfacen contrato, evidencia del mismo corte y reglas cerradas; no prometen alcance o resultados. | §18.7 |
| M27a-C-10 | Venta cruzada necesita catálogo/líneas y muestra suficiente; sin evidencia se abstiene. | §18.7 |
| M27a-C-11 | Nada crea/exporta/sincroniza audiencias ni envía datos a Meta/LLM; consumidores previos no se amplían. | §18.8 |
| M27a-C-12 | Publicación agregada atómica/idempotente; entradas parciales invalidan, errores no producen snapshot listo; filas previas se revalidan con backfill resumible sin borrar cobertura ni el dataset de M16e. | §18.1/3; D-M27a-01 |
| M27a-C-13 | Privacy, desconexión, cambio de generación y purga impiden lecturas obsoletas y dejan sin derivados afectados. | §18.5 |
| M27a-C-14 | UI protege sesión y muestra distribución, matriz/evolución y propuestas con ausencias, procedencia, moneda seleccionable, estados de recálculo y accesibilidad. | §18.6; D-M27a-01/03 |
| M27a-C-15 | Sin caché entre tenants ni logs con contenido; frescura aprobada gobierna disponibilidad. | §18.3/6 |
| M27a-C-16 | Tamaño sintético medido sin truncar ni exceder presupuesto; no degrada sincronización vigente. | II.14d, trampas |
| M27a-C-17 | Rama/checkout, migraciones y desechable coordinados sin tocar archivos de M16f, package ni otros contratos; la empresa demo sigue cargando. | §18.9; CB-03/04 |
| M27a-C-18 | Acta ampliada aprobada/comunicada antes de datos reales; pipeline y evidencia exigidos completos, gate pendiente hasta aprobación. | §18.9/10; CB-01/02/05/06 |

## Casos de prueba

Todos los importes, IDs, pedidos y escenarios son sintéticos. Las aserciones de aislamiento se hacen con roles/JWT reales en el desechable, nunca con service_role.

| ID | Criterios | Tipo | Comando | Resultado esperado | ¿Falla sin implementación? |
|---|---|---|---|---|---|
| M27a-T-01 | C-01 | pgTAP + app | npm run test:policies; npm run test:app | Empresa A/B y anon, conexión ajena, company_id manipulado, raw private y escritura directa: sin acceso; tablas/functions con grants mínimos. | Sí |
| M27a-T-02 | C-02/03 | pgTAP | npm run test:policies | Fixture 20 IDs distintos y 60 pedidos escritos con expectativas manuales; repetir produce igualdad. Bordes R=30/31/60/61/90/91/180/181, F=1/2/3/4/5/9/10; empates M y todos iguales. | Sí |
| M27a-T-03 | C-03/05 | pgTAP + unit | npm run test:policies; npm run test:unit | Medianoche en zona, paid_at nulo fallback created_at, cambio de día, pedido repetido, dos compras mismo día; dos monedas sin suma; ID ausente, inválido y no fusionado; monedas disponibles ordenadas, default a la primera y selección exacta por `?currency=`; parámetro repetido, malformado o no disponible da error genérico sin consultar otra moneda. | Sí |
| M27a-T-04 | C-04 | manual durante implementación | Sin comando automatizado: procedimiento de §3 en tienda y entorno de prueba autorizados | Matriz concluyente selecciona A o B y demuestra ausencia de doble descuento; cualquier mezcla/ausencia selecciona C. Registrar fuente/versión y resultado por caso, no payload, IDs ni montos reales. | No: valida hipótesis externa; no ejecutado al aprobar la spec; obligatorio antes de M/gate |
| M27a-T-05 | C-04/05 | unit + app | npm run test:unit; npm run test:app | Prueba unitaria desde el cuerpo JSON simulado por `createTiendanubeHttpClient.getJson` hasta el parser monetario: un token numérico de alta precisión llega como `number` y produce `incomplete`/`null`, mientras un string JSON decimal conserva exactamente sus dígitos; repetir para `total_paid_diff` de B. Lecturas válidas/invalidas, historial ausente, presupuesto, decimales y cambios de versión: verified solo con prueba/forma completas, demás nulo; no reutilizar verificación obsoleta. `ProjectedOrder` y el JSON de `tn_publish_orders` llevan exactamente los tres campos monetarios y los dos estados de calidad de §2; forma inválida o clave extra se rechaza sin cambiar la aridad RPC. | Sí |
| M27a-T-06 | C-05/12 | pgTAP + app | npm run test:policies; npm run test:app | paid→partially_refunded→refunded/cancelled; edición pendiente/pagada; reintento de misma ventana: métricas esperadas, sin sumar dos veces ni conservar cliente fuera de universo. | Sí |
| M27a-T-07 | C-06 | pgTAP | npm run test:policies | Cohorte n=10; para celdas cubiertas, activos 0/1/4 son `privacidad` sin valor visible, 5/6 pueden divulgarse; mes futuro/abierto y sin cobertura tienen motivos distintos. Recompra con dos pedidos en N0 y denominadores correctos; cero nunca se devuelve ni se distingue de 1–4. | Sí |
| M27a-T-08 | C-07 | pgTAP | npm run test:policies | Sumas/ticket/valor acumulado e intervalos conocidos, día repetido=0, media sobre intervalos y moneda separada; denominador nulo/cero o monto desconocido abstiene; dinero no redondeado antes de sumar. | Sí |
| M27a-T-09 | C-08 | pgTAP + app | npm run test:policies; npm run test:app | Grupos 0/1/4/5/6; celda chica oculta dinero/tasa; partición con una fila chica oculta distribución/totales; inspección JSON y getter impide resta. | Sí |
| M27a-T-10 | C-08/09 | unit + component | npm run test:unit; npm run test:component | Zod acepta las formas exactas de `InsightsData`/`AudienceProposal`/`CurrencySelection` de §1.1 y rechaza claves extra, campos faltantes, unidad/definición/ausencia incompatibles, `DefinitionCode` ajeno a la tercera columna, moneda no disponible, segmento/cohorte duplicado y referencia inexistente u oculta. Conteos de propuestas son referencias a grupos divulgados; ni tooltip, aria-label, atributo, tabla o gráfico filtra valor oculto. | Sí |
| M27a-T-11 | C-09/11 | unit | npm run test:unit | Cada regla da todos los campos y evidencia; alto valor sin M/variedad no se recomienda; no conexión Meta requerida; cero llamadas externas. | Sí |
| M27a-T-12 | C-10 | pgTAP + unit | npm run test:policies; npm run test:unit | Procedencia conservada entre páginas: catálogo completo sin omisiones, omitido, interrumpido y estado inicial se distinguen; líneas completas, campo ausente/no-array, línea inválida/recortada y fila preexistente `unverified` dan la calidad esperada. Cruce seguro y desempate reproducible; cualquier calidad incompleta, catálogo borrado, enlace de producto no válido o intersección pequeña: no propuesta; no conteo de intersección en DTO. | Sí |
| M27a-T-13 | C-12/13 | app + pgTAP | npm run test:app; npm run test:policies | Snapshot viejo invalidado al start/publish; backfill pendiente relee desde historyStart, conserva cursor ante corte, no elimina coverage_until ni el dataset M16e, y el backfill completo solo permite snapshot tras el siguiente incremental completo. Error refresh y publicación parcial no muestran listo; rollback e idempotencia acreditados. | Sí |
| M27a-T-14 | C-13 | app + pgTAP | npm run test:app; npm run test:policies | customer/redact marcado y paso 2 fallido ya oculta; sync concurrente filtra supresión; store_redact, desconexión, generación, cambio de zona y borrar empresa no dejan payload visible/huérfano. | Sí |
| M27a-T-15 | C-14/15 | component + unit | npm run test:component; npm run test:unit | Las once variantes estrictas de `CustomerInsightsView` respetan las precondiciones de §1.1; todas llevan `availableCurrencies`/`selectedCurrency` y mensajes salen de `kind`, no del DTO. Frescura, selector de teclado accesible, sync en curso sin snapshot visible, sesión ausente, tenant de request no conservado entre usuarios y error fijo sin cuerpo. `unverified` mapea a `monetario_no_validado`; `incomplete/inconsistent` a `dato_incompleto`; definición faltante/incompatible produce error; no se colapsan estados. | Sí |
| M27a-T-16 | C-11/15 | unit + app | npm run test:unit; npm run test:app | Guardas de credenciales, spies de red y consumidores anteriores: global false, sin datos hacia LLM/Meta, sin endpoints de exportación; `worker-api.ts` y los nueve casts de `tn_publish_orders` quedan idénticos, mientras `repository.ts` valida el JSON extendido; firmas antiguas siguen operativas. | Sí para frontera nueva; regresiones existentes deben conservar verde |
| M27a-T-17 | C-16 | app | npm run test:app | 10.000 pedidos/2.000 IDs/24 meses, multiempresa; refresh y lectura bajo presupuesto, conteos exactos sin truncar; registrar duración real. | Sí |
| M27a-T-18 | C-14 | manual | Recorrido autorizado de /app/clientes con datos sintéticos | Móvil/escritorio, fuente/corte/frescura, gráficos/tablas, propuestas sin acción externa y límites económicos honestos. | No: inspección visual posterior |
| M27a-T-19 | C-17/18 | documental | git diff --check; git status --short; npm run db:check:test | Solo archivos autorizados, nueva numeración libre, destino desechable exclusivo, cambios ajenos intactos, acta y aprobaciones con evidencia. | No: control operativo |
| M27a-T-20 | C-18; CB-01/05/06 | integral | npm run verify; npm run db:check:test; npm run test:policies; npm run test:app | Suites requeridas completas, rojo/verde registrado, sin skips propios; informe de QA antes de aprobación de gate. | Sí para comportamiento nuevo |

## Verificación

En implementación: `npm run verify`; `npm run db:check:test` antes de cualquier control SQL/app; `npm run test:policies`; `npm run test:app`. Las suites nuevas entran por patrones de vitest.config.mts y run-pgtap existente, sin modificar scripts. Focalizadas por scripts existentes test:unit/component cuando se necesite demostrar rojo/verde; después corrida integral.

No ejecutar verify en paralelo con suites pesadas ni dos suites destructivas sobre el mismo proyecto. Skips obligatorios de M27a, falta de configuración, falta de tienda de prueba o fórmula inconciliable bloquean el gate; no se compensan con mocks. Omisiones opt-in ajenas quedan identificadas por archivo/motivo y no se confunden con pruebas requeridas.

Durante esta expansión solo se revisan documentos/código, fuentes oficiales y controles de integridad del archivo; no se corre una suite funcional sin implementación ni se acredita RFM. Antes de modificar código Next leer la guía pertinente vigente en node_modules/next/dist/docs/ según AGENTS.md.

## Intervenciones del usuario y acciones reservadas

| Momento | Acción del usuario | Verificación posterior |
|---|---|---|
| Grill | Q-01 a Q-08 resueltas; T-04 trasladado a implementación sin darlo por ejecutado | D-M27a-01 a D-M27a-09 y secciones afectadas actualizadas; preguntas abiertas vacías |
| Spec/plan | Aprobar cada artefacto después de APROBABLE | Estados explícitos y hashes de contenido |
| Etapa monetaria de implementación | Autorizar el destino no productivo y la tienda de prueba, configurar OAuth/secretos fuera del chat y preparar pagos/ediciones/devoluciones sintéticos | Precondiciones de §3 y del plan verificadas; luego T-04, conciliación sin datos reales ni secretos |
| Uso real | Aprobar finalidad ampliada y comunicarla al dueño | Acta y evidencia de comunicación; sin aprobación no usar datos reales nuevos |
| Migraciones | Ejecutar npm run db:push:test solo tras ensayo reversible y guarda del desechable | Historial, suites y matriz de privilegios; asistente no ejecuta push |
| Publicación | Commit, push, PR, migraciones en app y despliegue cuando se soliciten expresamente | Orden/esquema y despliegue verificados; ninguna suite/fixture en app |
| Gate | Aprobar G-SEGMENTOS-AUDIENCIAS después de revisiones/QA y Monetary validado | PROJECT_STATE registra gate solo por aprobación visible |

## Trampas y riesgos

- Importes existentes y flags no son evidencia de semántica ni de completitud. Coalesce de un agregado antiguo puede ocultar nulos.
- El historial de valores documenta modificaciones; no presumir pago inicial. Campos numéricos de API pueden perder precisión antes de convertirlos: validar contrato/transporte y dominio admitido, no inventar centavos.
- Primer pedido elegible actual puede cambiar tras cancelación/supresión; no presentar la cohorte como registro histórico inmutable.
- Invalidar al inicio y también al publicar: un paso parcial puede haber cambiado pedidos y dejar cobertura anterior. No conservar un análisis viejo mientras sus entradas ya cambiaron.
- La marca de privacidad debe invalidar antes del borrado; una lectura con SQL privilegiado podría saltarse RLS si no se evita por diseño.
- Suppression en particiones y cohortes cruzadas requiere pruebas de deducción; k=5 no es garantía general frente a conocimiento externo o comparación temporal.
- Snapshot agregado por moneda limita doble conteo e interacciones, pero el costo de recalcular no está medido. No introducir workers o cache compartida como salida silenciosa.
- M16f ya cerró, pero otro trabajo puede usar el mismo desechable o el siguiente número de migración: reconfirmar números y exclusividad del destino antes de código/pruebas. La empresa demo (`H-E1-273`) publica con `tn_publish_orders`: si sus pedidos no traen los campos nuevos, la demo rompe o muestra todo `incomplete`.
- Un gate de Tiendanube cerrado con excepciones no valida Monetary para esta funcionalidad.
- Sin dos ciclos convergentes, con archivo fuera de alcance o contradicción de ruta: parar. No resolver ampliando alcance ni dividiendo la microfase.

## Decisiones de la microfase

Las restricciones de alcance aprobadas pertenecen a §18 y se heredan, no se presentan como respuestas al grill. Las elecciones no materiales de esta expansión son nombres de módulos/DTO y uso de SQL numeric, patrones RLS y componentes existentes; se justifican arriba.

| ID | Decisión | Motivo | Decidió | Fecha |
|---|---|---|---|---|
| D-M27a-01 | Snapshot agregado vigente por conexión/moneda, publicado al cerrar un incremental válido e indisponible durante sincronización, invalidación o recálculo; estado claro en UI. Presupuesto máximo 15 s con 10.000 pedidos, 2.000 IDs y 24 meses; si no se cumple, reabrir Q-01. | Menor costo de consulta, consistencia entre RFM/cohortes/propuestas y menor complejidad de auditoría; confiabilidad por encima de disponibilidad permanente. | Usuario | 2026-11-17 |
| D-M27a-02 | Contrato cerrado A/B/C para Monetary: A=`tn_paid_current_observed_v1`; B=`tn_paid_current_less_verified_refunds_v1`; C=sin definición. T-04 selecciona obligatoriamente una salida por evidencia, nunca por preferencia. | Bloquear el gate antes que segmentar o recomendar con economía incorrecta; fórmulas y rótulos condicionales quedan definidos sin fingir validación. | Usuario | 2026-11-17 |
| D-M27a-03 | Corte en último día local completo y ventana inclusiva fija de 365 días; sin filtros temporales. Clientes anteriores quedan fuera y la UI aclara que no representa toda la base histórica. | Cubre ciclo anual y estacionalidad, prioriza actividad reciente, limita procesamiento y estandariza validación. | Usuario | 2026-11-17 |
| D-M27a-04 | `rfm_v1` adopta los umbrales, empates, cuartiles relativos, prioridad exclusiva y carácter no configurable de §4. Universo homogéneo no produce alto valor; etiquetas no son predicciones. | Clasificación reproducible, exclusiva y relativa a cada tienda/moneda, sin adjudicar alto valor arbitrario. | Usuario | 2026-11-17 |
| D-M27a-05 | Catálogo completo de hasta 24 cohortes mensuales, offsets 0–12 y todas las métricas de §5; ausencia explícita sin sustitutos por cobertura, dinero o privacidad. | Retención, recompra y evolución económica aportan evidencia; cero debe distinguirse de indisponibilidad y primera compra es observada. | Usuario | 2026-11-17 |
| D-M27a-06 | `k=5`, supresión de grupos/celdas pequeños y de toda la distribución por moneda si un segmento tiene 1–4; sin filtros o totales reconstructivos. Se aceptan límites residuales de inferencia. | Sacrificar disponibilidad antes que exponer información; no prometer anonimización completa. | Usuario | 2026-11-17 |
| D-M27a-07 | Aprobar las siete reglas de §7, alcance conceptual, privacidad, venta cruzada sin cantidad de intersección y abstención obligatoria sin evidencia/divulgación. | La evidencia observada aporta valor aun sin tamaño exacto; no afirmar causalidad, complementariedad ni rentabilidad. | Usuario | 2026-11-17 |
| D-M27a-08 | Frescura desde fetchedAt: ≤24 h sin advertencia; >24 h y ≤7 días con advertencia y propuestas; >7 días bloquea propuestas y conserva análisis histórico advertido. needs_reauth bloquea propuestas. | Diferenciar observación histórica de recomendación accionable sin anular publicación/invalidación de D-M27a-01. | Usuario | 2026-11-17 |
| D-M27a-09 | Trasladar T-04 a la implementación. Monetary comienza y permanece indisponible hasta evidencia concluyente; el futuro plan debe incluir permisos, entorno no productivo, procedimiento, evidencia y limpieza de §3. T-04 no se considera ejecutado por esta enmienda y C bloquea el gate sin dividir M27a. | Evitar una dependencia circular previa a la aprobación manteniendo la validación empírica como requisito obligatorio de implementación y cierre. | Usuario | 2026-11-17 |

## Supuestos e hipótesis

| ID | HIPÓTESIS | Cómo/cuándo se verifica |
|---|---|---|
| M27a-H-01 | Es posible definir un monto monetario observado fiable con los campos actuales y GET history/values autorizado. | T-04 durante implementación y antes de habilitar M; si no acredita A o B, rige C y el gate queda bloqueado. |
| M27a-H-02 | La tienda de prueba permite simular todos los estados requeridos sin datos reales. | Usuario confirma entorno y casos antes de T-04; falta bloquea validación, no se hereda tienda real del dueño. |
| M27a-H-03 | El refresh agregado cabe bajo 15 s con volumen propuesto. | T-17 en desechable; no cambiar timeout ni truncar como sustituto. |
| M27a-H-04 | Los períodos registrados permiten llamar al primer pedido «observado» con corte completo. | Fixture de backfill/incremental y T-03/07; nunca asegurar primera compra vitalicia. |
| M27a-H-05 | RFM/SQL monetario y publicación se pueden incorporar sin cambiar firmas/consumidores antiguos. | T-16 antes de implementación final; necesidad de otro archivo/contrato exige enmienda. |
| M27a-H-06 | Ramas, migraciones y destino remoto pueden coordinarse con otros trabajos en curso. | Verificar worktrees, reservas e intervalo de uso antes de código/pruebas; esperar para parte afectada si no está disponible. |

## Preguntas abiertas

Ninguna. Q-01 a Q-08 quedaron cerradas por D-M27a-01 a D-M27a-09. Cerrar Q-02 aprueba el contrato condicional y la secuencia de validación, no acredita A, B ni la ejecución de T-04. El grill no habilita API writes, PII, LLM, varias microfases ni montos globales.

## Hallazgos relacionados

`H-E1-274` (en el fork, `H-E1-270`), abierto y asignado a M27a: validación monetaria insuficiente; se resuelve únicamente con T-04 durante la implementación, no con esta enmienda. `M16e-H-06`, hipótesis previa no verificada. Los riesgos nuevos de esta expansión quedan en esta spec; la skill solo permite escribir este archivo, por lo que no se edita HALLAZGOS. Si una auditoría confirma un defecto nuevo, asignará ID estable en el paso autorizado correspondiente.

No se detectó dependencia de entrada sin cerrar. T-04 y su entorno son una precondición asignada dentro de la implementación, no un resultado acreditado ni un bloqueo para auditar la spec; sí bloquean habilitar M y cerrar el gate. También queda coordinación operativa futura. No hay autorización para reducir Monetary ni cambiar la ruta de otras microfases.

## Auditorías

`revisiones/spec-audit-1.md` a `revisiones/spec-audit-5.md` emitieron **REQUIERE CAMBIOS**; la ronda 4 encontró A-10 y la ronda 5 confirmó que una cita aún no estaba corregida. Esta versión incorpora las correcciones técnicas A-01 a A-10, mantiene las decisiones aprobadas D-M27a-01 a D-M27a-09 y no amplía ni divide M27a. La sexta auditoría (`spec-audit-6.md`) fue APROBABLE en el fork donde se redactó la spec; sus informes no se trajeron a este repositorio. Al integrarla el 2026-11-17, el usuario dio por válida esa aprobación y autorizó solo ajustes de integración sin nueva auditoría: base `7d14ca9`, citas de línea, `H-E1-274`, coordinación con M16f cerrada y la empresa demo en los archivos previstos.
