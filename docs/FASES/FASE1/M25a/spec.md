# M25a — Spec de la microfase

**Estado:** BORRADOR

Estados posibles: `BORRADOR` → `APROBADA`. Solo el usuario pasa una spec a `APROBADA`, y solo después de una auditoría APROBABLE.

**Hash de contenido.** Se calcula sin la línea de estado:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M25a/spec.md | git hash-object --stdin
```

M25a es una microfase única en tres etapas (`M25a.1`, `M25a.2` y `M25a.3`), con esta spec, un plan y una corrida de `/microfase M25a` en la rama `mf/M25a`. No hay specs ni planes por etapa. Aprobar esta spec no inicia M25a.

## Fuentes

- Ruta: `docs/FASES/FASE1/meta_first/plan.md`: encabezado (enmiendas 0017, del chat y de esta spec), ficha de M25a, I.5, II.12, II.13, II.13b, III.2, III.3, III.5, III.6 y III.9. `docs/FASES/FASE1/meta_first/spec.md`: §2, §3 (DEC-06, 09 a 16, 19, 21 a 24), §5, §7, CA-38, CA-38c, CA-67, CA-68, §11, §12 completo y §14. [Propuesta de la enmienda del chat](../meta_first/revisiones/propuesta-enmienda-chat-visual-1.md), incluidos sus «riesgos que la spec tiene que resolver».
- Commit base: `b0c854d` (`main`, árbol limpio al expandir).
- Microfases previas en las que se apoya: M05.1.1 (K01), M06.1a-M06.2a, M06.3a, M16.1, M16.2, M16c y los desgloses de `H-E1-202`. `G-SYNC` aprobado el 2026-11-08 (`docs/PROJECT_STATE.md:25`, `:29`).
- IDs cubiertos: `M25a.1`, `M25a.2` y `M25a.3`. II.12, II.13 y II.13b son las etapas de esta microfase.
- Hallazgos: `H-E1-189`, `H-E1-190`, `H-E1-187`, `H-E1-194`, `H-E1-202`, `H-E1-185`. Documentos: `docs/SECURITY.md` §§1-5, 8 y 9; `docs/ARCHITECTURE.md`; `docs/FASES/FASE1/M03a/acta-meta.md`. Evidencia: `meta_first/sesiones/M16c.md:592-594`.
- Código contrastado: migraciones `0007`, `0012`, `0016`, `0017`; pgTAP `09`, `10`, `13`, `14`; `src/modules/integrations/db/worker-api.ts`, `repository/connections.ts`, `meta/insights.ts`, `contract/connection.ts`; `src/modules/tenant/context.ts`; `src/modules/reporting/contract/`; `src/app/(app)/app/chat/page.tsx`; `src/components/app/{chat,bar-chart,shell,desplegable}.tsx`; `src/modules/app-data/`; `.env.example`; `package.json`; `vitest.config.mts`; `scripts/run-pgtap.mjs`. Next 16.4.2: `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` y `.../route-segment-config/maxDuration.md`.
- Documentación oficial consultada el 2026-11-08: [salida estructurada](https://docs.deepinfra.com/chat/structured-outputs), [ficha del modelo](https://deepinfra.com/deepseek-ai/DeepSeek-V4.1-Flash) y [privacidad](https://docs.deepinfra.com/account/data-privacy) de DeepInfra.

## Objetivo

Que el dueño pregunte en lenguaje natural y reciba respuestas con cálculos y bloques visuales, con cifras vinculadas y verificadas contra resultados de herramientas (DEC-19, DEC-24).

## Alcance

**Etapa `M25a.1` (II.12).**

1. Migración `0018`: `chat_query_records`, `worker_api.record_query`, `worker_api.set_feedback`, reemplazo de `purge_connection`, lecturas SQL con el límite de período y seis cálculos.
2. pgTAP `15` y extensión de `10_demo_closure`.
3. Función única de redacción y sus pruebas.
4. Catálogo cerrado de herramientas, ejecución con el JWT y bajo RLS, tipos de resultado y herramienta de desgloses.

**Etapa `M25a.2` (II.13).**

5. Esquema de salida, adaptador de DeepInfra y orquestador.
6. Detector de candidatos numéricos, guarda y presentación.
7. Server Action, límites del turno, registro y pantalla del chat con los seis bloques básicos.
8. Pruebas obligatorias de CA-50b, suite adversaria y VR-02. Es una parada obligatoria: la etapa `.3` no empieza sin VR-02 aprobada.

**Etapa `M25a.3` (II.13b).**

9. Antes de que el modelo reciba datos reales: actualizar acta, `SECURITY.md` y `ARCHITECTURE.md`.
10. Los 19 bloques, con teléfono y lector de pantalla; casos dudosos e historia acumulada.
11. Medición de CA-70 con varios bloques y evaluación ampliada.
12. Cierre: revisiones, `0018` en `app` por el usuario, publicación, recorrido manual y `G-CHAT`.

## Fuera de alcance

- ROAS, rentabilidad, causas, recomendaciones, benchmarks y calificar un gasto como «estable» (spec de la ruta §2, CA-55, CA-73).
- Que el modelo escriba o ejecute código, o elija valores (opción B de `H-E1-190`, descartada).
- Cruzar edad o género con lugar, reconciliar desgloses con totales, y alcance o frecuencia de varios días o entidades (§11).
- Consultar Meta desde el chat, sincronizar desde el chat, carga histórica, cambios en la extracción o en `0016`/`0017`.
- Historial persistente, listado de conversaciones, búsqueda, memoria entre sesiones y texto libre en el voto (CA-61, CA-69).
- Búsqueda en internet y adjuntos (DEC-06, D-M25a-05).
- Base vectorial, RAG, workers, colas, respuesta por streaming y API de chat pública.
- Mostrar desgloses o datos de Meta fuera de la pantalla del chat.
- Medir consumo real en «Uso y costos»: solo muestra un aviso (D-M25a-10).
- Cambiar de host o de modelo. Si VR-02 falla, primero se diagnostica y se frena (ficha de M25a).
- La validación de campos y tipos con filas reales (`H-E1-189`, `H-E1-194`): sigue en la primera sincronización con filas.
- La demo con el dueño y CA-67 (`M28.3a`).

## Contexto verificado en el código

| Qué | Dónde (archivo:línea) | Qué implica para esta microfase |
|---|---|---|
| El chat actual no tiene backend; el historial vive en el componente | `src/components/app/chat.tsx:31-33`, `:47` | Se conecta a la Server Action; el estado en memoria ya cumple CA-61 |
| Sugerencias con ROAS y causas | `src/components/app/chat.tsx:13-18` | Contradicen §2 y CA-55: se reemplazan |
| Botones «Adjuntar» y «Buscar en internet» sin acción; estado «Buscando en internet...» | `src/components/app/chat.tsx:121-134`, `:103` | No corresponden al catálogo cerrado; D-M25a-05 |
| Pruebas que fijan ese comportamiento | `tests/component/app-pantallas.test.tsx:260-335` | Hay que actualizarlas; D-M25a-01 |
| La página ya existe, con sesión | `src/app/(app)/app/chat/page.tsx:7-16` | Solo suma `maxDuration` y el contexto de conexión |
| La navegación ya enlaza al chat; `src/components/app-nav.tsx` no existe | `src/components/app/shell.tsx:39`; II.13 paso 8 | El acceso de II.13 paso 8 ya está cumplido. No se crea ni se toca ese archivo |
| Solo hay un gráfico de barras, de costos, con CSS y `role="img"` | `src/components/app/bar-chart.tsx:33-68` | Patrón a seguir; no sirve tal cual; D-M25a-06 |
| Desplegable accesible existente | `src/components/app/desplegable.tsx:21` | No se usa para los bloques: es un selector |
| Adaptador con lista cerrada de funciones y casts | `src/modules/integrations/db/worker-api.ts:9-14`, `:67-86` | `record_query` y demás exigen editarlo; D-M25a-01 |
| Traducción de SQLSTATE; último usado `PX010`; timeout de consulta 15 s | `worker-api.ts:134-140`, `:166`; `0016_meta_insights.sql:38-44` | `PX011` es el código libre para el turno en curso; la reserva final del turno cuenta 15 s |
| Solo `worker-api.ts` importa `pg` y lee la URL del rol | `tests/unit/no-privileged-credentials.test.ts:97-114` | El chat usa `getWorkerApi()`; no abre otra conexión |
| K01 sin parámetros | `src/modules/tenant/context.ts:37` | La acción lo construye adentro |
| Lectura de la conexión bajo RLS, con generación | `src/modules/integrations/repository/connections.ts:31`, `:67-79` | Base del turno; da estado, generación, moneda, zona y cuenta |
| Máscara de cuenta | `src/modules/integrations/contract/connection.ts:150` | CA-52 y CA-66: se reutiliza |
| `get_meta_daily_coverage` rechaza más de `max_window_days` (28 por defecto) | `0016_meta_insights.sql:1843-1845` | **No alcanza para CA-70 (93 días).** `0018` lee `meta_daily_coverage` con funciones propias; `0016` no se toca |
| Cobertura legible bajo RLS, solo con conexión `active` o `needs_reauth` | `0016_meta_insights.sql:906-917` | Herramientas por camino A; aislamiento heredado |
| Cobertura con `entities` y `rows` en JSONB; métricas y acciones como texto | `0016_meta_insights.sql:773-793`, `:1154-1174` | Los cálculos convierten a `numeric` en SQL y salen como texto |
| Semántica de presencia y estado temporal | `0016_meta_insights.sql:1893-1895`, `:1912-1913` | Se replica sin el tope de 28 días |
| Atribución persistida con referencias internas y orden canónico | `0016_meta_insights.sql:1021-1043` | Base determinística de `attribution_ref` |
| `value` es el agregado informado; otras claves son variantes que no se suman | `src/modules/integrations/meta/insights.ts:91-94`; `0016_meta_insights.sql:748` | Los totales de acciones usan solo la variante `value` |
| `list_meta_entities` entrega referencias opacas sin tope de período | `0016_meta_insights.sql:1929-1977` | `entities` la lee completa con `listCapturedEntities` (`insights.ts`) |
| `get_meta_sync_status` entrega el último intento | `0016_meta_insights.sql:1982-2030` | Se reutiliza para `connection_status` |
| `get_meta_breakdown` ya limita a 93 días; día cubierto sin filas trae nulls | `0017_meta_breakdowns.sql:560`, `:519-520` | `chat_breakdown` se apoya en ella (II.12 paso 10) |
| Cada dimensión tiene tablas y estado propios; sin `reach` ni `frequency`; `region` sin acciones | `0017_meta_breakdowns.sql:22-27`, `:134-162`, `:185-204` | Reglas de la herramienta de desgloses |
| `purge_connection` vigente y su comportamiento | `0016_meta_insights.sql:1711-1774` | `0018` la reemplaza con misma firma y borra además los registros |
| Las tablas de desgloses caen por FK | `0017_meta_breakdowns.sql:27` | No se agregan al reemplazo |
| Catálogo exacto de 18 funciones de `worker_api` | `supabase/tests/09_integration_privileges.test.sql:391-403`, `:439` | Sube a 22 en T-12, T-13, T-15 y `M16c-T-25`; hay que editar `09`; D-M25a-01 |
| Cierre sembrando y contando tablas | `supabase/tests/10_demo_closure.test.sql:155-221` | Se extiende (II.12 paso 2) |
| El runner toma todo `*.test.sql` | `scripts/run-pgtap.mjs:247` | `15_chat_queries` entra solo; no se edita el runner |
| Helpers `private.assert_worker_actor` y `private.lock_company` | `0012_integrations.sql:226`; `0007_write_path_locking.sql:44` | Patrón de cada función de `worker_api` |
| `authenticated` tiene `USAGE` en `private`; `private` no está expuesto | `0001_schemas_and_identity.sql:17`; `entorno.md:79` | Helpers INVOKER del chat en `private`, con `EXECUTE` para `authenticated` |
| Convenciones de ACL de lecturas públicas | `0016_meta_insights.sql:2088-2098` | `revoke` y `grant` por función |
| `periodSchema` y `knownOr` reutilizables; `value` numérico en la evidencia calculada | `src/modules/reporting/contract/primitives.ts:34`, `:69`; `evidence.ts:41` | II.12 paso 7. `knownOr` se usa como patrón, con motivos propios |
| `maxDuration` a nivel de página rige las Server Actions | `.../route-segment-config/maxDuration.md`; `src/app/(app)/app/integraciones/page.tsx:15` | `chat/page.tsx` declara el suyo |
| Next despacha las Server Actions de a una por cliente; el servidor no las encola | `.../02-guides/server-actions.md:28-32` | Un voto durante un turno espera en ese cliente. El límite por usuario entre pestañas o instancias necesita estado en la base |
| Lectura con tope y paginación de la Data API | `src/modules/integrations/meta/insights.ts:847-857` | Las RPC `chat_*` devuelven un solo `jsonb`. `entities` usa esa lectura paginada |
| `DEEPINFRA_API_KEY` no está en `.env.example`; sí en la guarda de secretos | `.env.example:9`; `tests/unit/no-secrets-in-tree.test.ts:18` | Hay que agregarla y pasar «Diecisiete variables» a dieciocho; D-M25a-01 |
| La clave figura como diferida en el inventario | `docs/FASES/FASE1/meta_first/entorno.md:57` | Se actualiza por nombre y estado; D-M25a-01 |
| Scripts y proyectos de prueba | `package.json:14-17`, `:26`; `vitest.config.mts:24-58` | Comandos exactos; `verify` no incluye app ni pgTAP. No hay proyecto de evaluación |
| `SECURITY.md` declara que el modelo no recibe desgloses y que §8 es previsto | `docs/SECURITY.md:293`, `:308` | Hay que cambiarlo antes de datos reales |
| El acta dice lo mismo y nombra las etapas viejas | `M03a/acta-meta.md:22`, `:25`, `:45`, `:68` | Se corrige y el usuario la vuelve a aprobar |
| `ARCHITECTURE.md` declara el chat como previsto | `docs/ARCHITECTURE.md:66-69`, `:87`, `:173-174`, `:230-231`, `:292-305` | Pasa a existente al cerrar |

## Diseño concreto

Los nombres y rutas que siguen son **previstos**: los crea esta microfase. Las rutas de `src/modules/chat/` que no figuran en la Parte II son sugeridas dentro del mismo módulo (introducción de la Parte II de la ruta).

### 1. Forma de ejecución

- Corrida única en `mf/M25a`. Rigen las reglas de corrida única de M16c: no se pasa de etapa con pruebas en rojo, cada etapa termina con un commit del usuario, y se puede reanudar desde el último control registrado en `sesiones/M25a.md`.
- `G-CHAT` es el único gate; los controles de etapa no esperan aprobación del usuario.
- Las pausas por intervención están en «Intervenciones del usuario».

### 2. Persistencia en `0018_chat_queries.sql` (etapa .1)

Encabezado con la matriz de privilegios, como `0016:6-22`. Sin editar migraciones aplicadas (CB-03).

**`public.chat_query_records`**

| Columna | Tipo y regla |
|---|---|
| `id` | `uuid` PK, generado por el servidor antes de escribir: hace idempotente el reintento |
| `company_id` | `uuid not null`, FK a `companies` con `on delete cascade` |
| `connection_id` | `uuid` nulo. FK compuesta `(company_id, connection_id)` a `integration_connections (company_id, id)` con `on delete cascade` |
| `question_redacted` | `text not null`, 1 a 500 caracteres |
| `tool_names` | `text[] not null default '{}'`; cada elemento `^[a-z_]{1,40}$` y hasta 16 elementos. Solo nombres |
| `outcome` | `answered`, `answered_partial_coverage` o `not_answered` |
| `reason` | Lista cerrada de CA-62, con `needs_clarification` (D-M25a-03). Check: `(outcome = 'not_answered') = (reason is not null)` |
| `latency_ms` | `integer not null`, `>= 0` |
| `requested_model_id` | `text not null`, hasta 128 caracteres |
| `reported_model_id` | `text` nulo, hasta 128 caracteres |
| `feedback` | `text` nulo, `useful` o `not_useful` |
| `created_at` | `timestamptz not null default now()` |

`revoke all ... from public, anon, authenticated, service_role, praxa_integrations`, `enable` y `force row level security`, sin políticas ni grants. Índice por `(company_id, connection_id)`.

**`private.chat_turn_leases`.** La ruta exige un turno en curso por usuario (CA-70), pero no dice dónde vive ese estado. En Vercel varias instancias atienden al mismo usuario, así que un candado en memoria no lo garantiza, y las Server Actions solo se serializan por cliente. Por eso: tabla técnica de `company_id` (FK en cascada), `user_id` (FK a `auth.users`, en cascada), `turn_id` y `expires_at`; PK `(company_id, user_id)`; misma ACL y `force`. La fila se borra al terminar el turno, y un vencimiento libera un turno colgado. Va en `private` para que ninguna configuración de la Data API la alcance. Descartada una columna en `chat_query_records`: mezclaría estado efímero con el registro, que se escribe al final.

**Funciones de `worker_api`.** `SECURITY DEFINER`, `search_path = ''`, `revoke` y `grant execute` a `praxa_integrations` por función, `assert_worker_actor` primero y `lock_company` antes de filas. La clase 23 se traduce con `private.raise_worker_integrity_error`: las restricciones de `0018` no están en su lista, así que salen como `22023` sin detalle (`0016:64-65`), y eso alcanza.

| Función | Firma | Comportamiento |
|---|---|---|
| `begin_chat_turn` | `(p_actor_user_id uuid, p_company_id uuid, p_turn_id uuid, p_ttl_seconds integer) returns uuid` | Si hay un arriendo vigente de ese usuario, otro turno: `PX011`. Mismo `turn_id`: idempotente. Vencido: lo reemplaza. Reloj: `clock_timestamp()` después del cerrojo. TTL entre 1 y 300 |
| `end_chat_turn` | `(p_actor_user_id uuid, p_company_id uuid, p_turn_id uuid) returns boolean` | Borra solo si coincide `turn_id`. Repetir devuelve `false` |
| `record_query` | `(p_actor_user_id uuid, p_company_id uuid, p_record_id uuid, p_connection_id uuid, p_expected_generation integer, p_question_redacted text, p_tool_names text[], p_outcome text, p_reason text, p_latency_ms integer, p_requested_model_id text, p_reported_model_id text) returns table (record_id uuid, written boolean)` | Ver abajo |
| `set_feedback` | `(p_actor_user_id uuid, p_company_id uuid, p_record_id uuid, p_feedback text) returns boolean` | Actualiza solo si el registro es de esa empresa. Queda el último valor. Inexistente o ajeno: `false`, sin distinguirlos. Valor fuera de la lista: `22023` |
| `purge_connection` | Misma firma y retorno que `0016:1711` | Copia de `0016:1711-1774` más `delete from public.chat_query_records` de esa conexión antes de borrar la fila. No toca registros con conexión nula |

**`record_query` (CA-38c, CA-62).** En una sola transacción, después de los cerrojos:

1. Con `p_connection_id` nulo: solo admite `not_answered` con motivo `connection_not_active`, y exige que `p_expected_generation` sea nulo.
2. Con conexión: la bloquea con `FOR UPDATE` dentro de la empresa. Si no existe, `written = false`, sin error.
3. Exige estado `active` y generación igual a la esperada. Si no se cumple, `written = false` y no escribe. **Excepción (D-M25a-02):** con estado `needs_reauth` o `pending_selection` y la generación esperada, escribe solo `not_answered` con `connection_not_active`. `disconnected` o inexistente siempre dan `written = false`.
4. Inserta. Mismo `p_record_id` con contenido idéntico: `written = true`, sin duplicar. Con contenido distinto: `22023`.

`worker-api.ts` suma las cuatro funciones a la lista y a `SQL_CASTS`, `PX011: 'chat_turn_in_progress'` a `translated` y su mensaje fijo a `MESSAGES`.

### 3. Lecturas y cálculos SQL (etapa .1)

Todas son `public.chat_*`, `stable`, `SECURITY INVOKER`, `search_path = ''`, con `revoke` a `public, anon, authenticated, service_role, praxa_integrations` y `grant execute to authenticated`. Reciben `p_connection_id`, que el servidor resuelve, y RLS hace el resto: con otra empresa no hay filas.

Helpers en `private`, INVOKER y con `EXECUTE` para `authenticated`:

- `private.chat_max_period_days()` devuelve `93`. Cambiarlo exige una migración nueva: es la parte no configurable en caliente de CA-70, y `CHAT_LIMITS.maxPeriodDays` tiene que coincidir (`M25a-T-21`).
- `private.chat_assert_period(p_from date, p_to date)`: nulos, orden invertido o más de 93 días dan `22023`.
- `private.chat_entity_days(p_connection_id, p_entity_ref, p_from, p_to)`: una fila por día del período, con `level`, `presence`, la fila JSONB si existe, `currency`, `timezone`, `fetched_at`, `captured_before_day_end` y `temporal_status`, con la misma semántica de `0016:1893-1895` y `:1912-1913`. El nivel sale de la propia entidad. Referencia que ninguna cobertura visible conoce: cero filas.

**Forma común del resultado.** Cada función devuelve un `jsonb` donde todas las cifras son texto:

```json
{ "status": "ok|not_calculable|not_supported|not_found",
  "reason": "denominator_zero|data_absent|attribution_incompatible|metric_not_additive|currency_mixed|invalid_scope o null",
  "scope": { "level": "...", "entity_ref": "uuid o null", "entity_name": "... o null", "period": {"from":"...","to":"..."},
             "period_defaulted": false, "timezone": "...", "currency": "..." },
  "values": [ { "path_key": "...", "metric": "...", "unit": "money|count|percent|ratio",
                "currency": "... o null", "action_type": "... o null", "attribution_ref": "... o null",
                "period": {"from":"...","to":"..."}, "day": "fecha o null",
                "entity_ref": "uuid o null", "entity_name": "... o null", "parent_ref": "uuid o null",
                "segment_primary": "... o null", "segment_secondary": "... o null",
                "value": "texto con signo o null", "absence": "no_informado|sin_fila_reportada|no_observado|no_calculable o null",
                "temporal_status": "abierto|cerrado o null", "captured_partial": false, "fetched_at": "... o null",
                "composition": "objeto como el de abajo, o null" } ],
  "composition": { "days_total": 0, "days_with_value": 0, "days_metric_missing": 0, "days_no_row": 0,
                   "days_not_observed": 0, "days_open": 0, "days_captured_partial": 0,
                   "fetched_at_min": "... o null", "fetched_at_max": "... o null", "partial": false },
  "extra": {} }
```

En cada elemento de `values`, exactamente uno de `value` y `absence` es no nulo. `reason` es nulo si `status` es `ok`. El servidor agrega `account_ref`, la cuenta enmascarada con `maskExternalAccountId`.

| Función | Qué trae `values` | Qué trae `extra` |
|---|---|---|
| `chat_daily_series` | Uno por día, con `day` y ausencia explícita | — |
| `chat_total`, `chat_daily_average`, `chat_cost_per_result`, `chat_share` | Uno | — |
| `chat_compare_periods` | `a`, `b` y `difference`, esta última con signo | `relation` (`a_greater`, `b_greater`, `equal`), `period_lengths_differ` |
| `chat_percent_change` | `change`, con signo y unidad `percent` | `period_lengths_differ` |
| `chat_ranking` | Uno por entidad, con `parent_ref` y `composition` propia | `excluded_no_data` y, si se pide, `trends`, una serie diaria por `entity_ref` |
| `chat_breakdown` | Uno por segmento, con su participación en `extra` | `segments_total`, `estimated: true`, `shares` y `last_result` |
| `chat_action_types` | Dos por tipo: `action_count` y `action_value`, con su `attribution_ref` | — |
| `chat_coverage` | Vacío: la respuesta es la composición | `history_from` |

Ejemplos sintéticos, resumidos a los campos que distinguen a cada uno:

```json
{ "path_key": "day", "metric": "spend", "unit": "money", "day": "2026-10-01", "value": "12.50", "absence": null }
{ "path_key": "day", "metric": "spend", "unit": "money", "day": "2026-10-02", "value": null, "absence": "sin_fila_reportada" }
{ "path_key": "entity", "metric": "clicks", "unit": "count", "entity_name": "Campaña sintética", "value": "40", "absence": null }
{ "path_key": "change", "metric": "spend", "unit": "percent", "value": "-12.500000", "absence": null }
{ "path_key": "segment", "metric": "spend", "unit": "money", "segment_primary": "25-34", "segment_secondary": "female", "value": "7.25", "absence": null }
```

**Unidad y redondeo por métrica.** Es lo que aplica la guarda de CA-50 punto 3.

| Métrica | Unidad | Formas aceptadas en el texto |
|---|---|---|
| `spend` | `money` | Exacta, o half-up a 0 o 2 decimales |
| `impressions`, `reach`, `clicks`, `inline_link_clicks` | `count` | Entero exacto, con o sin miles |
| `cpc`, `cpm`, `action_value`, costo por resultado, promedios y diferencias de dinero | `money` | Exacta, o half-up a 2 decimales. **Nunca a 0** |
| `action_count` | `count` | Exacta, o half-up a 2 decimales. No se fuerza a entero (§11) |
| `ctr`, participación, variación porcentual | `percent` | Exacta, o half-up a 2 decimales |
| `frequency` | `ratio` | Exacta, o half-up a 2 decimales |

Reglas comunes:

- **Ausencia nunca es cero.** `sin_fila_reportada`, `no_observado` y `no_informado` no entran a sumas ni a promedios.
- `partial` es verdadero si hay algún día sin valor de la métrica, sin fila, no observado, abierto o con captura parcial (CA-51b). `fetched_at_min` y `fetched_at_max` dan el rango (CA-51).
- **Tasas de período.** Se calculan solo con días donde numerador y denominador están informados, sumando bases: CTR `100 * clicks / impressions`, CPC `spend / clicks`, CPM `1000 * spend / impressions`. Los días excluidos cuentan en `days_metric_missing`. Sin días o denominador cero: `not_calculable`. Nunca se promedian tasas diarias.
- **Precisión.** `numeric` sin convertir a float. Las divisiones salen con `round(x, 6)`, redondeo half away from zero. Sumas exactas. `decimal.ts` redondea igual: «half-up» significa sobre el valor absoluto, así que `-0,125` da `-0,13`.
- **Alcance y frecuencia.** Solo en la serie diaria. En totales, promedios, cálculos y rankings dan `not_supported`.
- **Acciones.** Métricas `action_count` y `action_value`, siempre con un `action_type` exacto y solo la variante `value` (`insights.ts:91-94`). Sin mapeo que fusione tipos.
- **`attribution_ref`.** `'attr_' || md5(attribution::text)` sobre el JSON canónico, o `'unknown'` si `known` es falso. Es una comparación de igualdad, no un secreto. Sumar días con referencias distintas, o más de un día con `unknown`, da `not_calculable` por `attribution_incompatible`.
- **Moneda.** Sin conversión. Si los días tienen monedas distintas: `not_calculable`.

| Función | Parámetros (además de `p_connection_id`) | Salida |
|---|---|---|
| `chat_action_types` | `p_entity_ref, p_from, p_to` | Tipos presentes, con conteo y valor del período por tipo y su `attribution_ref` |
| `chat_coverage` | `p_level, p_from, p_to` | Composición del nivel, días por estado y `history_from`: primera fecha con cobertura de ese nivel (CA-73) |
| `chat_daily_series` | `p_entity_ref, p_metric, p_from, p_to, p_action_type` | Un valor por día, con ausencia explícita. Admite las nueve medidas de §11, `action_count` y `action_value` |
| `chat_total` | `p_entity_ref, p_metric, p_from, p_to, p_action_type` | Total aditivo o tasa recalculada |
| `chat_daily_average` | Iguales | Total dividido por `days_with_value`. Solo aditivas |
| `chat_compare_periods` | `p_entity_ref, p_metric, p_a_from, p_a_to, p_b_from, p_b_to, p_action_type` | Dos valores, diferencia, relación calculada y `period_lengths_differ` |
| `chat_percent_change` | Iguales | `100 * (b - a) / a`, con `a` como base. `a = 0`: `not_calculable` |
| `chat_ranking` | `p_level, p_metric, p_from, p_to, p_action_type, p_order, p_limit, p_include_trend` | Hasta 20 entidades, `parent_ref`, composición por entidad, desempate por `entity_ref`, cantidad excluida por no tener datos y, si se pide, tendencia diaria |
| `chat_cost_per_result` | `p_entity_ref, p_action_type, p_from, p_to` | `spend / action_count`, solo con días con ambas bases y una sola atribución |
| `chat_share` | `p_entity_ref, p_metric, p_from, p_to, p_action_type` | `100 * parte / total del padre`, con el total **de la extracción del nivel padre**, nunca sumando hijos. Solo aditivas, solo días con ambos. En la cuenta: `not_supported` |
| `chat_breakdown` | `p_level, p_dimension, p_metric, p_from, p_to, p_entity_ref, p_action_type, p_limit` | Agrega sobre `public.get_meta_breakdown`, por segmento y para **una sola entidad**. Con `campaign`, `p_entity_ref` es obligatorio; sin él, `22023` (§11 solo suma una misma entidad). Hasta 20 segmentos y una fila `otros` con el resto, `segments_total`, participación calculada sobre **todos** los segmentos para aditivas, `estimated: true` y último resultado de `get_meta_breakdown_status` |

**Desgloses.** Niveles `account` y `campaign`; dimensiones `age_gender`, `country`, `region`. Segmentos tal como llegan, incluidos los desconocidos. `reach`, `frequency` y acciones en `region`: `not_supported`. No hay parámetro que cruce dimensiones. Días sin cobertura de esa dimensión: `no_observado`.

**Atribución de los desgloses.** `0017` no guarda atribución por fila, así que su `attribution_ref` es siempre `unknown`. No se hereda la de otra cobertura ni se editan `0016` o `0017`. Por la regla de arriba, `action_count` y `action_value` de un desglose solo se pueden dar **de un día**: con más de un día dan `not_calculable` por `attribution_incompatible`. Gasto, impresiones y clics no tienen esa restricción. Ampliarlo exigiría cambiar la extracción, y eso es otra decisión.

**Rendimiento.** `meta_daily_coverage` guarda JSONB por día, así que `chat_ranking` en nivel `ad` con 93 días recorre mucho. Se mide en `test:app` con el peor caso sintético (`M25a-H-07`).

### 4. Herramientas en TypeScript (etapa .1)

`src/modules/chat/tools/schema.ts`: unión cerrada de trece herramientas, `z.strictObject` por herramienta, con `periodSchema` más el tope de 93.

| Herramienta | Argumentos | Función |
|---|---|---|
| `entities` | `level` | `listCapturedEntities` (lectura completa y paginada de `list_meta_entities`) |
| `action_types` | `entity_ref, period` | `chat_action_types`. II.12 paso 5 la nombra con `entity_ref`; suma el período para poder dar los valores de «desglose por tipo de resultado» |
| `coverage` | `level, period` | `chat_coverage` |
| `daily_series` | `entity_ref, metric, period, action_type?` | `chat_daily_series` |
| `total` | `entity_ref, metric, period, action_type?` | `chat_total` |
| `connection_status` | — | Conexión bajo RLS y `get_meta_sync_status` |
| `compare_periods` | `entity_ref, metric, period_a, period_b, action_type?` | `chat_compare_periods` |
| `daily_average` | `entity_ref, metric, period, action_type?` | `chat_daily_average` |
| `ranking` | `level, metric, period, order, limit?, action_type?, include_trend?` | `chat_ranking` |
| `cost_per_result` | `entity_ref, action_type, period` | `chat_cost_per_result` |
| `share` | `entity_ref, metric, period, action_type?` | `chat_share` |
| `percent_change` | `entity_ref, metric, period_a, period_b, action_type?` | `chat_percent_change` |
| `breakdown` | `level, dimension, metric, period, entity_ref, action_type?, limit?`; `entity_ref` obligatorio en `campaign` y nulo en `account` | `chat_breakdown` |

**`entities`.** Una lectura que no llega al total falla, igual que `H-E1-198`. El modelo ve como mucho `modelEntitiesLimit` (50), en orden estable, con `truncated` y `total` cuando el recorte aplica. Nunca se presenta recortada como si fuera el catálogo completo.

**Período por defecto.** En el paso de elección, `period` admite `null`. `resolveToolPeriod` lo reemplaza por el valor de D-M25a-09 **antes** de validar con Zod, y marca `scope.period_defaulted = true`. Así el servidor sabe que el valor fue por defecto, y no depende de que el modelo elija fechas. `period_a` y `period_b` no tienen valor por defecto: una comparación necesita los dos.

`entity_ref` es UUID y `action_type` cumple `^[A-Za-z0-9._]{1,128}$` (§11). Ninguna herramienta acepta SQL, tabla, `company_id` ni `connection_id`.

`src/modules/chat/tools/execute.ts`: `executeTool(call, ctx: TurnContext, deps)`. `TurnContext` guarda K01, la conexión y la generación, y solo lo arma el servidor. Usa `createSupabaseServerClient()`, nunca `getWorkerApi()`. Un error de la RPC se traduce a `tool_error` sin el texto de PostgREST.

`src/modules/chat/tools/results.ts`: esquemas Zod estrictos de la forma común. El servidor agrega a cada resultado `tool_call_id` (`t1`, `t2`, ...), `account_ref` y `path` (`/values/N`) en cada valor. Todo valor presente es cadena validada con `signedDecimalText` (`^-?[0-9]+([.][0-9]+)?$`), propio de este archivo: el `decimalText` de `insights.ts` es local, admite `null` y no admite negativos, y una caída daría `tool_error`. **Ningún módulo del chat convierte una métrica a `number`**. `knownOr` se aplica como patrón (`value` o `absence`), con motivos propios, porque `unknownReasonSchema` describe otra cosa. `calculatedMetricEvidenceSchema` no se usa (CA-44b).

`toModelView(result)` arma lo que ve el modelo. Conserva `tool_call_id`, `path`, métrica, unidad, moneda, valor o ausencia, período y atribución. Quita `snapshot_id`, `fetched_at` y la composición detallada, que usa la guarda y el pie. Junto a cada nombre de entidad agrega un alias sin dígitos, que es lo único con lo que el modelo puede mencionarla en el texto (§8). Los nombres de entidad viajan dentro de un campo de datos, nunca en las instrucciones.

**Mapeo de nombres.** §11 solo admite nombres de negocio con mapeo explícito y probado. `src/modules/chat/tools/action-labels.ts` mapea por igualdad exacta `purchase`, `lead`, `link_click` y `landing_page_view`, y muestra también el identificador. Los demás se muestran con su identificador. Nunca fusiona tipos. Con `H-E1-189` abierto, estos nombres no están validados con filas reales.

### 5. Redacción (etapa .1)

`src/modules/chat/redaction.ts`: `redactQuestion(raw: string): string`, pura y sin estado, aplicada una sola vez por turno antes de cualquier uso.

Orden: URL → email → `[SECRETO]` → CBU/CVU de 22 dígitos → tarjeta con Luhn de 13 a 19 dígitos, con espacios o guiones → CUIT/CUIL con guiones → teléfono internacional (`+` y de 8 a 15 dígitos) → `act_` con `maskExternalAccountId`. Después, recorte a `CHAT_LIMITS.maxQuestionChars` (500) por punto de código.

- Se redacta **antes** de recortar: recortar primero podría dejar medio secreto sin reconocer.
- `[SECRETO]`: 32 o más caracteres de alfabeto de token, o los prefijos `EAA`, `sb_secret_`, `sbp_`, `sk-` y `eyJ` seguidos de alfabeto de token, sin mirar montos ni fechas. `M25a-T-10` tiene un caso sintético por prefijo, sin valores con forma real.
- Única dependencia admitida: `maskExternalAccountId`, para que la máscara de cuenta sea la misma de CA-52.
- Idempotente sobre sus propios marcadores.
- El cuadro de texto también limita a 500 caracteres; el recorte del servidor cubre una petición armada a mano.

### 6. Adaptador del modelo (etapa .2)

`src/modules/chat/llm.ts` (`server-only`):

- `POST https://api.deepinfra.com/v1/openai/chat/completions` con `fetch` inyectable, `Authorization: Bearer` y `AbortSignal` por el presupuesto restante. Solo chat completions.
- Constante `CHAT_MODEL_ID = 'deepseek-ai/DeepSeek-V4.1-Flash'`. `process.env.DEEPINFRA_API_KEY` se lee solo acá.
- Cuerpo: `model`, `messages`, `response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } }`, `max_tokens`, `temperature: 0`, `stream: false`. `json_object` no se usa. `reasoning_effort` solo si se verifica (`M25a-H-03`).
- Respuesta: Zod sobre `choices[0].message.content`, `finish_reason` y `model`. `finish_reason = 'length'` o contenido que no valida: error `bad_output`, que el orquestador registra como `guard_rejected`. Transporte, 429, 5xx, timeout o falta de clave: `unavailable`, registrado como `model_unavailable`.
- Sin reintentos automáticos: el reintento lo decide el dueño (CA-53).
- Nunca registra cuerpo, prompt ni error del proveedor. Los errores son de texto fijo.

### 7. Orquestador y límites del turno (etapa .2)

`src/modules/chat/limits.ts`:

```ts
export const CHAT_LIMITS = { maxPeriodDays: 93, maxToolCallsPerTurn: 4, maxOutputTokensPerCall: 800,
  turnDeadlineMs: 60_000, finalizationReserveMs: 10_000, modelCallTimeoutMs: 20_000, turnLeaseSeconds: 90,
  maxQuestionChars: 500, maxBlocksPerAnswer: 4, previousQuestions: 3, modelEntitiesLimit: 50,
  maxClarificationChars: 300 } as const;
```

**Reloj del turno (CA-70).** Los 60 s son la duración total, medida con un reloj monotónico. Arranca al entrar a `preguntarChat` y termina al devolver el DTO: incluye arriendo, modelo, herramientas, registro y liberación. El trabajo termina a los 50 s, y los últimos 10 (`finalizationReserveMs`) quedan para registrar y liberar. Toda espera se limita a lo que queda: el modelo con `AbortSignal`, cada herramienta con `abortSignal` del cliente, y cada escritura de `worker_api` compitiendo contra el tiempo restante, porque su `query_timeout` es fijo.

`chat/page.tsx` declara `export const maxDuration = 75`. **No implementa los 60 s:** es el corte de la plataforma, con margen para una consulta que no se pudo cancelar. Está por debajo de los 300 s de Vercel (spec de la ruta §5b).

**Flujo de un turno** (`src/modules/chat/orchestrator.ts`, con dependencias inyectables):

1. Arranca el reloj, construye K01 y redacta la pregunta.
2. `begin_chat_turn`. `PX011`: aviso de consulta en curso (§11). Otro error: fallo de registro (§11), sin llamar al modelo.
3. Lee la conexión con `readConnectionRecord`. Sin conexión `active`, no llama al modelo: `not_answered` con `connection_not_active`.
4. Paso de elección, en bucle: el modelo devuelve `call_tools`, `answer`, `clarify` o `abstain`. El bucle hace falta porque `daily_series` necesita una referencia que `entities` da recién en la llamada anterior. Cada respuesta puede pedir varias llamadas, sin pasar el tope del turno. Si llega al tope, solo admite `answer`, `clarify` o `abstain`.
5. El servidor ejecuta cada llamada con Zod. Un argumento inválido o una herramienta inexistente: `tool_error`, nunca se ejecuta. Si todos los resultados son `no_observado`: `no_coverage`, sin redactar respuesta.
6. Paso de redacción: el modelo devuelve `text`, `claims` y `blocks` con los resultados del turno.
7. La guarda valida. La presentación arma el DTO, que todavía no se devuelve.
8. Registra. Se agotó el trabajo durante el modelo: `model_unavailable`; durante una herramienta: `tool_error`. En ambos casos se registra dentro de la reserva.
9. Libera el arriendo en `finally`. Si la liberación falla, no cambia la respuesta: el arriendo vence por TTL y queda una línea de log.

Si el registro agota la reserva, se trata como fallo de registro. Como `p_record_id` es idempotente, una escritura que igual termina tarde no duplica nada: puede quedar un registro de una consulta que el dueño vio como fallida, y se declara.

**Esquema de elección.** Objeto plano, con `action`, `calls`, `clarification_text` y `abstain_reason` (`out_of_scope` o `no_coverage`), donde los argumentos de cada llamada son un objeto con todas las claves posibles en nulo. No se usan uniones, porque DeepInfra no documenta qué subconjunto de JSON Schema admite su modo estricto (`M25a-H-02`). Zod por herramienta valida después.

**Prompt.** `src/modules/chat/prompt.ts`, sin datos de la empresa ni del dueño. Contexto: fecha de hoy en la zona de la cuenta, zona, moneda, `account_ref`, período por defecto, catálogo, reglas de §11, CA-55 y CA-72. Los nombres de entidad y la pregunta se presentan como datos no confiables.

### 8. Salida y guarda (etapas .2 y .3)

`src/modules/chat/output-schema.ts`. Respuesta: `text` (hasta 1500 caracteres), `claims`, `blocks`. Cada claim lleva `span`, `kind`, `tool_call_id`, `path`, `metric`, `unit`, `currency`, `account_ref`, `level`, `entity_ref`, `action_type`, `attribution_ref` y `period`. `span` es `{ quote, occurrence }` (D-M25a-04): el fragmento citado y su número de aparición en `text`. El servidor obtiene la posición exacta y rechaza si no aparece; con esa posición comprueba que cada candidato quede cubierto.

Campos según `kind`:

| `kind` | Campos propios |
|---|---|
| `observed_value` | `tool_call_id`, `path` y los declarados |
| `period_bound` | `tool_call_id` y `bound` (`from` o `to`). La fecha se escribe `DD/MM/AAAA` o `AAAA-MM-DD` |
| `coverage_count` | `tool_call_id` y `field`, un campo numérico de `composition` |
| `qualitative_comparison` | `left_path`, `right_path`, ambos `tool_call_id` y `relation` (`greater`, `less`, `equal`) |
| `user_provided` | Sin referencia |

`blocks` es una lista de hasta `maxBlocksPerAnswer` objetos `{ type, sources: [{ tool_call_id, path_prefix }], options }`. `options` es cerrado por tipo (por ejemplo, `ordering` en `ranking`) y nunca contiene valores, títulos ni texto. `conclusiones` es la excepción: `items: [{ text, claims, provenance }]`, donde cada `span` se resuelve dentro del `text` de su ítem. `preguntas_sugeridas` usa `ids`, de un catálogo cerrado con texto fijo en `render.ts`: `ver_por_conjunto`, `comparar_periodo_anterior`, `ver_en_tabla`, `ver_por_edad_y_genero`, `ver_por_pais` y `ver_estado_de_los_datos`.

`src/modules/chat/numeric-candidates.ts`: `findNumericCandidates(text)`, con posición y categoría, para las cinco familias de CA-50 punto 1. **Artículos.** `un`, `una`, `uno` y `primer`/`primera` son candidatos **por defecto**, porque «Hubo un clic» es una cifra. Solo dejan de serlo delante de un sustantivo de una lista cerrada que no se cuenta como métrica (`campaña`, `anuncio`, `conjunto`, `cuenta`, `período`, `gráfico`, `tabla`, `respuesta`), y nunca después de `solo`, `solamente` o `exactamente`. La lista se ajusta con casos sintéticos, nunca relajando la validación de valores (riesgo 13 de III.5).

**Nombres de entidad.** Un nombre como «Promo 2x1 2026» tiene dígitos que no son cifras, y otro podría decir «Gastaste 999 pesos». Por eso ningún nombre se excluye de la detección por coincidir con un dato. `toModelView` le da a cada entidad un alias sin dígitos, como `ENTIDAD_A`, y el modelo escribe `⟦ENTIDAD_A⟧` en el texto. La guarda valida con el marcador. Un alias desconocido rechaza la respuesta, y una cifra escrita fuera de un marcador necesita su claim como cualquier otra. **Después** de la guarda, el servidor reemplaza el marcador por un segmento `entity`, con el nombre como dato del proveedor: nunca como afirmación del modelo.

`src/modules/chat/guard.ts`: `validateAnswer(answer, turnResults, redactedQuestion)`, pura.

- CA-50 puntos 1 a 7, en orden, sin atajos.
- `observed_value`: `path` resuelve a un valor presente del turno, y todos los campos declarados coinciden. Una ausencia no se puede citar como cifra.
- **Normalización.** `src/modules/chat/decimal.ts`, con `BigInt`, sin `number`. Acepta es-AR, cifra sin separador de miles y signo negativo. La tabla de unidad y redondeo de §3 dice qué se acepta por métrica. Sin abreviaturas.
- **Porcentaje:** solo CTR, participación y variación devueltos por una herramienta, con `unit = percent`.
- `period_bound`: la fecha es el límite indicado del período del resultado citado. `coverage_count`: coincide con el campo indicado de `composition`.
- `qualitative_comparison`: referencia dos `observed_value`, y el servidor calcula la relación comparando decimales exactos.
- `user_provided`: la cifra normalizada aparece en la pregunta redactada **del turno actual**. Nunca en preguntas anteriores.
- **Lenguaje no admitido.** Búsqueda sobre `text` y conclusiones de `porque`, `debido a`, `se debe a`, `a causa de`, `gracias a`, `ROAS`, `rentab` y `estable`, con límites de palabra. Corre con los marcadores puestos, así que un nombre de entidad no la dispara ni la esquiva. Coincidencia: `guard_rejected`. Es una ayuda: CA-50b declara que el texto sin cifras no está garantizado, y esto lo sigue midiendo VR-02.
- **Bloques.** Tipo del catálogo, referencias del turno y resultado compatible según la tabla de abajo. Cualquier fallo rechaza la respuesta entera (CA-50 punto 7).
- Todo rechazo: `guard_rejected`. El texto rechazado no llega al navegador.

### 9. Presentación y bloques (etapas .2 y .3)

`src/modules/chat/render.ts`: `renderTurn(...)` devuelve `ChatTurnView`, un DTO estricto, con `kind` (`answer`, `clarification`, `abstention` o `notice`), `record_id` (`uuid` o `null`), `can_vote`, `blocks` y texto en segmentos: `plain`, `observed`, `entity` y `user_provided`, este último con la marca «según lo que mencionaste» (CA-50 punto 6). `can_vote` y `record_id` van juntos: solo un registro confirmado se puede votar, y un `record_id` no persistido nunca llega al navegador. Cada componente de bloque recibe como prop solo su parte del DTO. Un pie agregado siempre por el servidor lleva período, zona, composición de cobertura, rango de `fetched_at` y cuenta enmascarada (CA-51, CA-52). Los totales parciales muestran la composición (CA-51b). `action_values` y resultados nunca se presentan como rentabilidad.

`src/components/chat/`: un componente por bloque, recibe solo datos del DTO. **El modelo elige tipo y referencias; no manda valores, títulos ni código.** Títulos y rótulos los arma el servidor.

| Bloque | Etapa | Resultado de origen admitido | Regla propia |
|---|---|---|---|
| `tarjeta` | .2 | Un valor de cualquier herramienta | Con unidad y composición |
| `lineas` | .2 | `daily_series`, hasta 4 | Día ausente: hueco en la línea y marca, nunca cero |
| `barras` | .2 | `daily_series`, `ranking`, `breakdown` | Día ausente: marca propia, sin barra en cero |
| `barras_agrupadas` | .2 | `compare_periods`, `breakdown` de `age_gender` | Una sola métrica y unidad |
| `dona` | .2 | `breakdown` con aditivas | Una sola métrica; sin alcance ni frecuencia. Hasta 5 porciones y «Otros» con el resto. Muestra la participación que devolvió la herramienta. No admite `ranking`: es un recorte y no reparte un todo |
| `tabla` | .2 | Cualquier resultado con valores | Texto exacto, ausencias con su nombre |
| `resumen_variacion` | .3 | `percent_change` | No califica: sin «estable», «bien» ni «mal» |
| `periodo_contra_periodo` | .3 | `compare_periods` | Avisa si los períodos tienen distinto largo |
| `barras_apiladas` | .3 | Varias `daily_series` aditivas, misma unidad | Nunca apila niveles de la jerarquía ni tipos de acción superpuestos sin avisarlo |
| `ranking` | .3 | `ranking` | Muestra excluidas por no tener datos |
| `tabla_tendencia` | .3 | `ranking` con tendencia | Mini tendencia con huecos |
| `tabla_desplegable` | .3 | `ranking` de dos niveles, unidos por `parent_ref` | Sin sumar hijos para obtener al padre; botón con `aria-expanded` |
| `embudo` | .3 | `total` de un mismo `entity_ref` y período | Avisa que los pasos son conteos separados; un solo `action_type`; sin tasas de paso inventadas |
| `calendario_calor` | .3 | `daily_series` | Día ausente con estilo propio, distinto del valor más bajo |
| `desglose_tipo_resultado` | .3 | `action_types` con período | Identificador visible; sin fusionar tipos; no suma atribuciones distintas |
| `estado_datos` | .3 | `coverage`, `connection_status` | Incluye `history_from` |
| `conclusiones` | .3 | Ítems de texto con sus claims, misma guarda | Sin causas. Procedencia por ítem (`system_fact`, `calculated_metric`, `inference`); `inference` se rotula «Interpretación» (CA-55) |
| `fuentes_metodologia` | .3 | Resultados del turno | Texto fijo con fórmulas de §11, herramientas y frescura. Sin referencias internas |
| `preguntas_sugeridas` | .3 | Plantillas cerradas del servidor, elegidas por ID | El modelo no escribe el texto, así que no hay cifras que validar. Un clic copia al cuadro, como hoy (`chat.tsx:147-150`) |

**Escala de los gráficos.** Un gráfico necesita geometría, y CA-44b prohíbe convertir métricas a `number`. `src/modules/chat/scale.ts` calcula en el servidor, con `BigInt`, una proporción entera de 0 a 10000, con dos modos: `relative_to_max` para barras, líneas, ranking y calendario, y `share_of_total` para dona y para cada pila de `barras_apiladas`, cuyas proporciones suman exactamente 10000 por mayor resto. En `barras_apiladas`, la altura de cada pila usa `relative_to_max` sobre el total de la pila. Esa proporción sí es `number`, viaja en el DTO junto al texto exacto y **no se muestra nunca como cifra**. Lo que se lee en pantalla es siempre la cadena del servidor. Los negativos solo aparecen en variaciones, que no se grafican como barras.

**Accesibilidad y teléfono.** Cada gráfico tiene `role="img"`, `aria-label` armado por el servidor sin texto del modelo, y un botón «Ver datos» que abre una tabla con los mismos valores. El color nunca es el único canal: ausencias y series se distinguen también por marca o trazo. Foco visible y navegación con teclado. A 360 px no hay desplazamiento horizontal de la página: las tablas se desplazan dentro de su contenedor. Tokens de color del tema claro y oscuro de `app.module.css`. Los nombres de entidad son texto de React, sin HTML ni Markdown.

### 10. Casos dudosos e historia (etapa .3)

| Situación (CA-72) | Comportamiento |
|---|---|
| Falta el período u otro dato | El servidor usa el valor por defecto (§4) y el pie lo muestra. Período por defecto: **los últimos 7 días cerrados en la zona de la cuenta** (`CHAT_DEFAULT_PERIOD_DAYS`). Elegido así porque evita el día abierto, que volvería parcial toda respuesta, y porque es corto y se puede pedir otro. Se ajusta en `limits.ts` |
| La pregunta admite sentidos muy distintos | Acción `clarify`, con una pregunta sin cifras que pasa por la guarda. Se registra `not_answered` con `needs_clarification` (D-M25a-03) |
| Pide otro formato | Elige otro bloque si la tabla de §9 lo admite. Si no sirve para esos datos, lo dice y usa uno compatible |
| Pide algo que no tiene | `abstain`, con motivo `out_of_scope`, y **texto fijo del servidor** que dice qué no puede hacer y ofrece lo que sí puede mostrar |

**Historia (CA-73).** `chat_coverage.history_from`. Si el período pedido arranca antes, la respuesta avisa desde qué fecha hay datos, sin carga histórica. Un período sin nada: `no_coverage`.

**Contexto entre turnos.** CA-72 obliga a preguntar y a entender la respuesta del dueño, y CA-50c prohíbe que un historial introduzca cifras. El modelo recibe hasta 3 preguntas anteriores de la sesión (D-M25a-07; `previous` en `preguntarChat` y `previousQuestions` en `CHAT_LIMITS`), y además la última aclaración pendiente, si la hubo (D-M25a-13; `pendingClarification`). Así entiende «la segunda». Las dos vienen del navegador: el servidor las redacta otra vez, las trata como no confiables y no las persiste. La aclaración se descarta si pasa de `maxClarificationChars` o si contiene un candidato numérico. No se envían respuestas ni cifras. Las cifras de un turno se validan solo contra resultados de ese turno.

### 11. Server Actions y pantalla (etapas .2 y .3)

`src/modules/chat/actions.ts` (`'use server'`):

- `preguntarChat(input: { question: string; previous?: string[]; pendingClarification?: string }): Promise<ChatTurnView>`.
- `votarRespuesta(input: { recordId: string; feedback: 'useful' | 'not_useful' }): Promise<{ ok: boolean }>`.

Ambas construyen K01 adentro y validan con `z.strictObject`: un campo extra, como `company_id`, se rechaza. Sin sesión redirigen a login, como `integrations/actions.ts:11`. No llaman a `revalidatePath`, para no volver a renderizar la página en cada turno. Devuelven solo el DTO.

**Registro y voto (D-M25a-12).** Toda salida es una de estas cuatro:

| Caso | Qué ve el dueño | `kind` | Registro | Voto |
|---|---|---|---|---|
| Registro confirmado (`written = true`) | La respuesta, aclaración o abstención | `answer`, `clarification` o `abstention` | Sí | Sí |
| Escritura descartada (`written = false`) | Mensaje fijo: «La conexión cambió mientras respondíamos». La respuesta no se muestra, porque es de una conexión que se está borrando | `abstention` | No (CA-38c) | No |
| Fallo de registro: la base falla, se agota la reserva o falla el arriendo | Mensaje fijo: «No pudimos completar la consulta. Probá de nuevo». La pregunta queda en el cuadro. La respuesta no se muestra | `abstention` | No | No |
| Turno rechazado (`PX011`) | «Ya hay una consulta en curso» | `notice` | No: no llegó a ser una consulta | No |

Una respuesta mostrada siempre tiene su registro. Estas son las únicas excepciones a CA-62 y CA-69, y la spec de la ruta las declara.

**Logs (CA-63).** Una sola línea estructurada por turno: `request_id`, `outcome`, `reason`, `latency_ms` y cantidad de herramientas. Ningún otro `console.*` en `src/modules/chat/`. Nunca el error original.

`src/components/app/chat.tsx` (según D-M25a-01):

- Estado solo en memoria del componente. Se pierde al navegar o recargar, como hoy (`chat.tsx:31-33`). Nada en `localStorage`, `sessionStorage` ni cookies. Motivo: cumple CA-61, que fija un máximo, y evita dejar cifras en disco o a la vista de quien inicie sesión después en la misma pestaña.
- Aviso permanente: «Registramos tus preguntas, sin las respuestas, para saber qué se pregunta y si te sirvió» (CA-65).
- «Útil» y «No útil» en cada respuesta, con el último valor marcado (CA-69).
- Con el modelo caído: mensaje claro, la pregunta queda en el cuadro y hay un botón para reintentar (CA-53). Cada reintento es un registro aparte (CA-62).
- Durante el turno: estado «Consultando tus datos...», sin mencionar internet. Por el despacho secuencial, un voto hecho durante un turno espera a que termine; el botón lo muestra como pendiente.
- Sugerencias nuevas, sin ROAS ni causas.
- Sin conexión activa: el mensaje fijo enlaza a Integraciones.

### 12. Evaluación (etapas .2 y .3)

`docs/FASES/FASE1/meta_first/vr-02.md`: conjuntos congelados, con el hash de cada uno registrado **antes** de correrlo, e informe contra cada criterio de DEC-21, con identificador y precisión. Sin datos reales.

- **Conjunto base (.2).** Al menos 30 respondibles (herramienta, métrica, período y respuesta esperados) y 20 de abstención (fuera de alcance, sin cobertura, variación sin herramienta, otra empresa). Con menos de 20, una sola falla ya rompería el 95 %.
- **Conjunto ampliado (.3).** Suma al menos 40: cada cálculo, cada dimensión, cada uno de los 19 bloques y los cuatro casos dudosos. La exactitud incluye el bloque elegido. Mismos criterios.
- **Motor.** Proyecto `eval` de Vitest y script `test:eval` (D-M25a-01), que corren el orquestador real contra DeepInfra y **resultados de herramientas sintéticos inyectados**, sin base. No entra en `verify`. Usa la clave de `.env.local` sin imprimirla.
- **Transcripciones reproducibles** (ficha, «Pruebas»): fixtures sintéticos de salidas del modelo, reproducidos sin red en `tests/unit/chat-orchestrator.test.ts`.
- **Diagnóstico si falla.** Prompt, esquema, herramientas, razonamiento o modelo, en ese orden, sin relajar la guarda. Dos iteraciones sin converger: frena (III.9).

**Recorrido manual (etapa .3).** Tiene dos partes, porque en `app` no pueden entrar fixtures (CB-04) y la cuenta real no tiene actividad:

1. **Sintético.** `next dev` local apuntando al proyecto desechable, con una cuenta sintética y datos cargados por `scripts/chat-seed-test.mjs` (D-M25a-01), que ejecuta la guarda de `check-target` antes de escribir. Cubre los 19 bloques, teléfono, teclado y los dos temas. El modelo es el real, con datos sintéticos.
2. **Real.** Con `0018` y la publicación hechas por el usuario: una pregunta en la aplicación sobre la cuenta conectada. Con 0 filas no valida valores ni tipos (DEC-24, `H-E1-189`).

### 13. CA-70: medición y ajuste (etapa .3)

La ruta pide medir si las llamadas y los tokens alcanzan para varios bloques, y ajustarlos si no. Los valores de la spec de la ruta son iniciales, y este ajuste no exige enmienda.

- Se registra en `sesiones/M25a.md` el uso real por llamada y por turno de los dos conjuntos.
- Se puede subir hasta **6 llamadas a herramientas** y **2400 tokens** por llamada, con la medición como motivo. Un embudo de una campaña ya pide 5 llamadas (`entities` y cuatro `total`), así que el primero probablemente suba.
- Más allá de esos topes, o si cambia el presupuesto de 60 s: frena y consulta, porque el costo y la latencia pasan a ser decisión del usuario.
- El valor final queda en `limits.ts` y en esta spec, como decisión registrada, antes de la evaluación ampliada.

### 14. Documentos transversales

**Etapa .3, paso 1, antes de datos reales:**

- `M03a/acta-meta.md`: §1 fila de desgloses y del registro; §2; §4 fila de DeepInfra (recibe desgloses minimizados por pregunta, preguntas anteriores y la aclaración pendiente, D-M25a-07 y D-M25a-13; conserva el riesgo de registro de porciones, D-M25a-11); §9, comunicación al dueño; fila técnica de turno en curso. Nombrar `M25a` en lugar de las etapas viejas.
- `docs/SECURITY.md`: §8, quitar «el modelo no los recibe» (`:308`) y declarar qué recibe y cómo se minimiza (solo dimensión, entidad, período y métrica pedidos, agregados por segmento y con tope; preguntas anteriores y aclaración pendiente). §6: suma, por categoría, el registro, el voto y el turno en curso a las capacidades de `praxa_integrations` (`:194-198`).
- `docs/ARCHITECTURE.md`: §Chat, flujo con los dos pasos del modelo, bloques y turno en curso; `:230`. Sistemas externos (`:21-22`): el proveedor del modelo deja de ser «previsto» al cerrar. «Esquemas» (`:93`): `private` suma una tabla técnica y helpers que `authenticated` ejecuta, y hay que explicar por qué ese rol tiene `USAGE`.

**Etapa .3, al cerrar, solo lo que quedó probado:** en `SECURITY.md`, §2 (frontera 5), §4 (`:123-124`) y §8 pasan de previsto a vigente. En `ARCHITECTURE.md`, `:66-69`, `:87`, `:173-174`, `:231` y `:292` pasan a existente. No se copian tablas, funciones, TTL ni conteos: quedan aquí, en la migración y en la evidencia.

## Archivos previstos

| Archivo | Nuevo o modificado | Para qué | Autorizado por |
|---|---|---|---|
| `supabase/migrations/0018_chat_queries.sql` | Nuevo | Tablas, `worker_api`, purga, lecturas y cálculos | II.12 pasos 1, 6 y 9; I.5 |
| `supabase/tests/15_chat_queries.test.sql` | Nuevo | Privilegios, aislamiento, CA-38c, límites y cálculos | II.12 paso 2 |
| `supabase/tests/10_demo_closure.test.sql` | Modificado | Cierre con registros y arriendos | II.12 paso 2 (texto de la acción) |
| `src/modules/chat/redaction.ts`; `tests/unit/chat-redaction.test.ts` | Nuevos | CA-66 | II.12 pasos 3 y 4 |
| `src/modules/chat/tools/schema.ts`, `execute.ts`, `results.ts`, `action-labels.ts` | Nuevos | Catálogo, ejecución y tipos | II.12 pasos 5 a 7, 9 y 10 |
| `tests/unit/chat-tools.test.ts`; `tests/app/chat-tools.test.ts` | Nuevos | Herramientas, cálculos, Data API, CA-38c | II.12 paso 8 |
| `src/modules/chat/output-schema.ts`, `llm.ts`, `orchestrator.ts`, `numeric-candidates.ts`, `guard.ts`, `render.ts`, `actions.ts` | Nuevos | Etapas .2 y .3 | II.13 pasos 1 a 7; II.13b pasos 2 y 4 |
| `src/modules/chat/limits.ts`, `prompt.ts`, `decimal.ts`, `scale.ts` | Nuevos | Apoyo dentro del módulo | Rutas sugeridas, introducción de la Parte II |
| `src/app/(app)/app/chat/page.tsx` | Modificado | `maxDuration` y contexto | II.13 paso 8 |
| `tests/unit/chat-guard.test.ts`; `tests/unit/chat-adversarial.test.ts` | Nuevos | CA-50b, CA-53 y CA-54 | II.13 paso 9 |
| `docs/FASES/FASE1/meta_first/vr-02.md` | Nuevo | Conjuntos e informes | II.13 paso 10; II.13b paso 5 |
| `src/components/chat/` | Nuevo | 19 bloques | II.13b paso 3 |
| `docs/FASES/FASE1/M03a/acta-meta.md` | Modificado | Propiedades nuevas; vuelve a aprobación | II.13b paso 1 |
| `docs/SECURITY.md` | Modificado | §2, §4, §6 y §8: el modelo recibe desgloses y contexto; capacidades del rol; previsto a vigente | II.13b paso 1; Contrato documental |
| `docs/ARCHITECTURE.md` | Modificado | Chat, módulo, sistemas externos y esquemas: previsto a existente | II.13b paso 1; Contrato documental |
| `docs/HALLAZGOS.md`, `docs/PROJECT_STATE.md`, `docs/FASES/FASE1/meta_first/sesiones/M25a.md` | Seguimiento | Evidencia, hallazgos y gate | Precondición 8 |
| `docs/FASES/FASE1/M25a/spec.md`, `plan.md`, `revisiones/*.md` | Pipeline | — | Precondición 9 |
| `src/modules/integrations/db/worker-api.ts` | Modificado | Lista, casts y `PX011` | **D-M25a-01** |
| `supabase/tests/09_integration_privileges.test.sql` | Modificado | T-12, T-13, T-15 y `M16c-T-25` pasan a 22 funciones; «las otras quince» pasa a «las otras diecinueve» | **D-M25a-01** |
| `src/components/app/chat.tsx`, `chat.module.css` | Modificados | La pantalla real del chat | **D-M25a-01** |
| `tests/component/app-pantallas.test.tsx` | Modificado | Fija sugerencias y botones viejos | **D-M25a-01** |
| `tests/component/chat-pantalla.test.tsx`, `tests/component/chat-bloques.test.tsx`, `tests/unit/chat-llm.test.ts`, `tests/unit/chat-orchestrator.test.ts`, `tests/unit/chat-render.test.ts` | Nuevos | Pruebas de lo que II.13 y II.13b construyen | **D-M25a-01** |
| `.env.example`, `docs/FASES/FASE1/meta_first/entorno.md` | Modificados | `DEEPINFRA_API_KEY`, por nombre; «Diecisiete variables» pasa a dieciocho | **D-M25a-01** |
| `package.json`, `vitest.config.mts`, `tests/eval/chat-eval.test.ts`, `tests/eval/fixtures/` | Modificados y nuevos | Motor de VR-02, sin base ni datos reales | **D-M25a-01** |
| `scripts/chat-seed-test.mjs` | Nuevo | Datos sintéticos en el desechable para el recorrido de los bloques, con la guarda de `check-target` | **D-M25a-01** |
| `src/app/(app)/app/uso-y-costos/page.tsx`, `tests/component/uso-costos-aviso.test.tsx` | Modificado y nuevo | Aviso en lugar de los ceros de ejemplo. La etapa `.3` lo hace | **D-M25a-10** |
| `tests/component/app-paginas-sesion.test.tsx` | Modificado | Importa todas las páginas reales: simula `@/modules/chat/actions`, sin cambiar lo que verifica sobre la sesión | **D-M25a-14** |

## Criterios de aceptación

### Heredados de la ruta

| ID de la ruta | Qué exige (resumen fiel) |
|---|---|
| CA-48 | Catálogo cerrado: entidades y tipos de acción, cobertura, serie diaria, total o tasa según §11, estado de conexión, seis cálculos en SQL y desgloses. Referencias opacas. El modelo no elige empresa, tabla ni SQL |
| CA-49 | Tenant y conexión resueltos en el servidor. Herramientas con JWT, bajo RLS |
| CA-50 | Salida `text` + `claims`, con detección de candidatos, `observed_value` exacto, normalización, comparaciones recalculadas, variaciones solo de herramienta, `user_provided` y rechazo con abstención |
| CA-50b | Garantías determinísticas, lo no garantizado y las ocho pruebas obligatorias |
| CA-50c | Los claims solo resuelven contra resultados del turno actual |
| CA-51 | Toda respuesta declara período, zona, cobertura y frescura, con rango de `fetched_at` |
| CA-51b | Totales con días sin fila, no observados, abiertos o de captura parcial se presentan como parciales, con la composición |
| CA-52 | La interfaz siempre muestra la cuenta truncada y el período |
| CA-53 | Identificador fijo; VR-02 se repite antes de la demo; con el modelo caído, mensaje claro, conserva la pregunta y permite reintentar |
| CA-53b | V4.1 Flash en DeepInfra; esquema estricto, no `json_object`; Zod es autoridad final; se guarda modelo solicitado e informado |
| CA-54 | Aislamiento frente a preguntas directas e instrucciones inyectadas |
| CA-55 | Describe el catálogo con sus restricciones; no explica causas ni evalúa rentabilidad; las interpretaciones se marcan |
| CA-61 | Conversación solo durante la sesión del navegador; sin listado, búsqueda ni memoria |
| CA-62 | Registro por consulta con los campos y listas cerradas; sin respuestas ni cifras de herramientas; cada reintento aparte; `record_query` cumple CA-38c |
| CA-63 | La pregunta nunca va a logs |
| CA-64 | Registro por `worker_api`; `authenticated` sin lectura |
| CA-65 | Borrado solo por DEC-09 y CA-67; la UI avisa que las preguntas se registran y para qué |
| CA-66 | Redacción única, determinística, antes de persistir y de enviar; patrones, conservación de montos y fechas, límites declarados |
| CA-69 | «Útil» y «no útil» en cada respuesta y abstención; sin texto libre; último valor; Server Action con K01 y verificación de empresa |
| CA-70 | Límites iniciales de período, llamadas, tokens, turno y duración, en el servidor y en SQL; `M25a` los mide y ajusta |
| CA-71 | 19 bloques cerrados; valores del servidor; faltante no es cero; reglas de embudo y conclusiones |
| CA-72 | Valor por defecto visible, pregunta si hay sentidos muy distintos, cambia formato si sirve, dice lo que no tiene y ofrece lo que sí |
| CA-73 | Historia acumulada sin carga histórica; avisa desde qué fecha hay datos; sin calificar «estable» |
| VR-02 (DEC-21) | Conjuntos congelados; cero cifras sin respaldo; exactitud ≥ 90 %; rechazos injustificados ≤ 10 %; abstención correcta ≥ 95 %; p95 ≤ 20 s; verificación de identificador, precisión, salida estricta y modelo informado; conjunto ampliado con los mismos criterios |
| CA-38c | Una operación en vuelo no reinserta datos: `record_query` verifica conexión, estado y generación en la misma transacción |
| CA-44 y CA-44b | Cada valor conserva su procedencia. Precisión exacta; sale de SQL como texto; TypeScript no convierte a `number` |
| CA-67 y CA-68 | El cierre deja cero filas; tablas nuevas en cascada desde `companies` |
| DEC-23 y §11 | Reglas de agregación, atribución y desgloses |
| DEC-24 | Con la cuenta sin actividad, `G-CHAT` se cierra con datos sintéticos y un recorrido real con 0 filas, como riesgo temporal |
| CB-01 a CB-06 | Suites en verde; sin secretos ni datos reales en diffs; sin modificar migraciones; nada contra producción; evidencia real; una prueba omitida cuenta como no ejecutada |

### Operativos de esta microfase

| ID | Criterio verificable | Traza a (CA, DEC o trampa de la ruta) |
|---|---|---|
| M25a-C-01 | `chat_query_records` y `chat_turn_leases` tienen las columnas y checks de Diseño §2, RLS y `force`, y ningún grant para `anon`, `authenticated`, `service_role` ni el rol de C | CA-14, CA-62, CA-64, §7 |
| M25a-C-02 | Las FK son en cascada desde `companies`, y `connection_id` nulo es válido | CA-62, CA-68 |
| M25a-C-03 | `record_query` escribe solo con conexión de la empresa, `active` y generación esperada, salvo la excepción de C-60; si no, `written = false`, sin fila | CA-38c |
| M25a-C-04 | `record_query` es idempotente por `p_record_id`, y un contenido distinto se rechaza | Non-negotiable de idempotencia |
| M25a-C-05 | Sin conexión se guarda con `connection_id` nulo, solo con `not_answered` y `connection_not_active` | CA-62 |
| M25a-C-06 | `set_feedback` solo actúa sobre registros de la empresa, conserva el último valor y rechaza otros valores | CA-69, DEC-13 |
| M25a-C-07 | `purge_connection` conserva firma, retorno y repetibilidad, borra los registros de la conexión y no toca los de conexión nula | DEC-09, CA-38 |
| M25a-C-08 | El cierre deja cero filas en las dos tablas nuevas, incluidos registros con conexión nula | CA-67, CA-68 |
| M25a-C-09 | `worker_api` tiene exactamente 22 funciones, todas `SECURITY DEFINER`, con `search_path` vacío y `EXECUTE` solo del rol de C | §7, CA-64 |
| M25a-C-10 | Las funciones `public.chat_*` son INVOKER, con `EXECUTE` solo para `authenticated`; `anon` y el rol de C fallan | CA-49, CA-54 |
| M25a-C-11 | Cada patrón de CA-66 se redacta con su marcador | CA-66 |
| M25a-C-12 | Montos con miles, fechas y tarjetas que no pasan Luhn quedan intactos; la función es idempotente | CA-66 |
| M25a-C-13 | Se redacta antes de recortar, y el resultado no pasa de 500 caracteres | CA-66, II.12 paso 1 |
| M25a-C-14 | El catálogo tiene exactamente las trece herramientas; todo campo extra, incluidos `company_id` y SQL, se rechaza | CA-48, CA-49 |
| M25a-C-15 | La conexión y la empresa solo salen del servidor; `execute.ts` no importa `getWorkerApi` | CA-49, DEC-04 |
| M25a-C-16 | Una referencia ajena o inexistente da `not_found`, sin datos | CA-48, CA-54 |
| M25a-C-17 | Ningún archivo de `src/modules/chat/` usa `Number(`, `parseFloat` ni `parseInt` sobre métricas; los valores se mantienen exactos fuera de la precisión de `number` | CA-44b |
| M25a-C-18 | Cada resultado cumple el contrato de Diseño §3, con exactamente uno de valor o ausencia. Cada valor trae referencia, métrica, unidad, moneda, cuenta, nivel, entidad, tipo de acción y atribución cuando corresponden, período, presencia, estado temporal, captura parcial y frescura | II.12 paso 6, CA-44 |
| M25a-C-19 | Más de 93 días, llamado directo por la API, falla en SQL en cada función; 93 días funcionan, también por encima de los 28 de `get_meta_daily_coverage` | CA-70 |
| M25a-C-20 | Sin fila, no observado y no informado nunca aparecen como cero ni entran a sumas | CA-43, CA-51b, trampa II.11 |
| M25a-C-21 | La composición y el rango de `fetched_at` son correctos con días de distintas extracciones y captura parcial | CA-51, CA-51b |
| M25a-C-22 | Los totales suman solo aditivas de la entidad pedida; el de la cuenta sale de `account`, no de sumar niveles | §11 |
| M25a-C-23 | CTR, CPC y CPM de período se recalculan de bases; alcance y frecuencia de período dan `not_supported` | §11, CA-48 |
| M25a-C-24 | Acciones: un solo tipo, solo variante `value`, y atribuciones distintas o desconocidas no se suman | §11 |
| M25a-C-25 | Los seis cálculos dan el valor exacto esperado con fixtures sintéticos; denominador cero o datos ausentes dan `not_calculable`; cobertura incompleta da `partial` | CA-48, II.12 paso 9 |
| M25a-C-26 | No existe herramienta de ROAS, y el costo por resultado exige un `action_type` | §2, CA-48 |
| M25a-C-27 | Desgloses: sin cruce de dimensiones, sin alcance ni frecuencia, `region` sin acciones, segmentos tal como llegan, `estimated: true`, sin reconciliar y con atribución `unknown`: acciones de más de un día dan `not_calculable` | DEC-23, §11 |
| M25a-C-28 | `authenticated` ejecuta las `chat_*` por la Data API real y recibe `42501` al leer el registro | Riesgo 11, CA-64 |
| M25a-C-29 | El adaptador envía identificador fijo, `json_schema` estricto, tope de tokens y timeout; guarda solicitado e informado; nunca usa `json_object` | CA-53, CA-53b |
| M25a-C-30 | `DEEPINFRA_API_KEY` solo aparece en `llm.ts`, y ningún error ni log contiene clave, prompt ni cuerpo | `SECURITY.md` §6, §8 |
| M25a-C-31 | Salida sin esquema, truncada o inválida en Zod termina en `guard_rejected` | CA-53b |
| M25a-C-32 | El orquestador no pasa de las llamadas por turno ni de los 60 s, y una herramienta inválida no se ejecuta | CA-50, CA-70 |
| M25a-C-33 | Dos turnos simultáneos del mismo usuario, desde instancias distintas: uno recibe `chat_turn_in_progress`, sin registro ni llamada al modelo; un arriendo vencido se libera | CA-70 |
| M25a-C-34 | El detector encuentra las cinco familias de CA-50, marca «Hubo un clic» y no marca «una campaña». Un nombre de entidad solo se muestra por su marcador, como segmento `entity`; una cifra fuera de un marcador necesita claim | CA-50, CA-50b, riesgo 13 |
| M25a-C-35 | `observed_value` exige coincidencia en todos los campos; la normalización sigue la tabla de Diseño §3: solo `spend` admite 0 decimales, y negativos y redondeo coinciden con SQL | CA-50 |
| M25a-C-36 | Comparaciones recalculadas; variación y participación solo si las devolvió una herramienta de CA-48 | CA-50 puntos 4 y 5 |
| M25a-C-37 | `user_provided` exige la cifra en la pregunta redactada del turno actual, y la UI la diferencia | CA-50 punto 6 |
| M25a-C-38 | Un historial manipulado no agrega cifras: nada resuelve fuera de los resultados del turno | CA-50c |
| M25a-C-39 | Una respuesta rechazada se registra como `guard_rejected`, y el texto rechazado no está en el DTO | CA-50 punto 7 |
| M25a-C-40 | Toda respuesta incluye período, zona, cobertura, frescura y cuenta enmascarada, y nunca la cuenta completa | CA-51, CA-52, CA-40 |
| M25a-C-41 | La acción construye K01 adentro, rechaza campos extra, redacta antes de todo uso y registra cada intento con listas cerradas, sin respuestas ni cifras | CA-61 a CA-65 |
| M25a-C-42 | La pregunta sin redactar no aparece en logs, errores, registro ni en lo enviado al modelo | CA-63, CA-66 |
| M25a-C-43 | La pantalla avisa del registro; ofrece voto en respuestas y abstenciones con registro confirmado; conserva la pregunta y permite reintentar | CA-53, CA-65, CA-69 |
| M25a-C-44 | Nada de la conversación se escribe en el almacenamiento del navegador | CA-61 |
| M25a-C-45 | Instrucciones en la pregunta o en un nombre de entidad no cambian empresa, herramientas ni acceso | CA-54, `SECURITY.md` §8 |
| M25a-C-46 | Causas, ROAS, rentabilidad y «estable» terminan en abstención o rechazo; las sugerencias no los mencionan; las interpretaciones se rotulan | CA-55, CA-73 |
| M25a-C-47 | VR-02 sobre el conjunto congelado cumple cada criterio de DEC-21, con identificador, fp8, salida estricta y modelo informado verificados; el hash del conjunto es anterior a la corrida | VR-02, DEC-21 |
| M25a-C-48 | La etapa .3 no empieza sin VR-02 aprobada en la sesión | Ficha de M25a |
| M25a-C-49 | Antes de cualquier dato real al modelo, acta y documentos están actualizados, el usuario aprobó el acta (blob registrado) y declaró la comunicación al dueño | II.13b paso 1, DEC-23 |
| M25a-C-50 | El esquema del modelo no admite valores, títulos ni código en un bloque; tipo o referencia inválidos rechazan la respuesta | CA-71, DEC-24 |
| M25a-C-51 | Los 19 componentes muestran valores del servidor y distinguen faltante de cero | CA-71 |
| M25a-C-52 | El embudo avisa y usa un solo tipo; las conclusiones pasan la guarda y no dan causas | CA-71 |
| M25a-C-53 | Cada gráfico tiene descripción y tabla equivalente, y no depende solo del color; a 360 px la página no se desborda | II.13b paso 3 |
| M25a-C-54 | Los cuatro casos dudosos se comportan como en Diseño §10, y el valor por defecto se muestra | CA-72 |
| M25a-C-55 | El chat avisa desde qué fecha tiene datos | CA-73 |
| M25a-C-56 | CA-70 quedó medido, con el valor final y su motivo registrados antes de la evaluación ampliada | CA-70 |
| M25a-C-57 | La evaluación ampliada cumple DEC-21, incluido el bloque elegido, sobre su conjunto congelado | VR-02 |
| M25a-C-58 | El recorrido manual cubre los 19 bloques con datos sintéticos en el desechable, y una pregunta real sobre `app` sin mostrar ceros inventados; con 0 filas queda declarado como riesgo temporal | DEC-24, `H-E1-189` |
| M25a-C-59 | `SECURITY.md` y `ARCHITECTURE.md` pasan a vigente o existente solo lo probado, sin detalles volátiles | Contrato documental |
| M25a-C-60 | Con `needs_reauth` o `pending_selection`, `record_query` escribe solo `not_answered` con `connection_not_active` y la generación esperada; otro resultado, otra generación, `disconnected` o inexistente no escriben | CA-38c, CA-62; D-M25a-02 |
| M25a-C-61 | Una aclaración se registra como `not_answered` con `needs_clarification` | CA-62, CA-72; D-M25a-03 |
| M25a-C-62 | `span` llega como `quote` y `occurrence`; el servidor fija la posición, y una cita que no aparece, una aparición inexistente o un candidato sin cubrir rechazan la respuesta | CA-50; D-M25a-04 |
| M25a-C-63 | La pantalla no tiene «Adjuntar», «Buscar en internet» ni «Buscando en internet...» | DEC-06; D-M25a-05 |
| M25a-C-64 | El modelo recibe como mucho 3 preguntas anteriores y la última aclaración pendiente, redactadas otra vez por el servidor, sin respuestas ni cifras, y no se persisten; una aclaración con cifras o demasiado larga se descarta, y nada de eso valida un claim del turno | CA-50c, CA-72; D-M25a-07, D-M25a-13 |
| M25a-C-65 | Con `period` nulo, el servidor usa los últimos 7 días cerrados en la zona de la cuenta, marca `period_defaulted` y el pie lo muestra | CA-72; D-M25a-09 |
| M25a-C-66 | «Uso y costos» no muestra ceros ni gráficos de ejemplo: muestra «Todavía no disponible» | D-M25a-10 |
| M25a-C-67 | `action-labels.ts` mapea por igualdad exacta, muestra siempre el identificador, no fusiona tipos y deja intactos los que no tiene | §11 |
| M25a-C-68 | El reloj de 60 s va de la entrada al DTO e incluye arriendo, modelo, herramientas, registro y liberación; cada espera se limita a lo que queda, y siempre queda reserva para registrar | CA-70 |
| M25a-C-69 | `entities` lee el catálogo completo o falla, y lo que ve el modelo tiene tope y declara el recorte | CA-48, `H-E1-198` |
| M25a-C-70 | Las cuatro salidas de Diseño §11 dan el `kind`, el registro y el voto de su fila; un `record_id` no confirmado no llega al navegador, y ninguna respuesta se muestra sin registro confirmado | CA-62, CA-69; D-M25a-12 |
| M25a-C-71 | Un valor negativo se conserva como texto exacto, pasa el esquema y la guarda, y no da `tool_error` | CA-44b, CA-48 |
| M25a-C-72 | `breakdown` en `campaign` sin `entity_ref` se rechaza en Zod y en SQL; la participación se calcula sobre todos los segmentos, y los que no entran van a `otros` | §11, DEC-23 |
| M25a-C-73 | Las proporciones de `share_of_total` suman exactamente 10000, y `dona` no acepta un `ranking` | CA-71, CA-44b |
| M25a-C-74 | Después de `clarify`, «la segunda» llega a la herramienta correcta en la secuencia completa | CA-72; D-M25a-13 |
| M25a-C-75 | `app-paginas-sesion.test.tsx` sigue verificando la sesión de todas las páginas, con `chat/page.tsx` incluida | CB-01; D-M25a-14 |

## Casos de prueba

Comandos de `package.json`. `test:eval` es **previsto** (D-M25a-01). En Windows, si Vitest no carga desde Git Bash, se repite con `powershell -NoProfile -Command "npm run ..."` (`H-E1-20`).

| ID | Criterios | Tipo | Comando | Resultado esperado | ¿Falla sin la implementación? |
|---|---|---|---|---|---|
| M25a-T-01 | C-01, C-02 | pgTAP | `npm run test:policies` | Columnas, checks, RLS, `force`, ACL vacías y FK en cascada | Sí, TDD |
| M25a-T-02 | C-03 | pgTAP | `npm run test:policies` | Conexión ajena, `disconnected`, otra generación e inexistente: `written = false` y cero filas. La excepción la prueba `M25a-T-65` | Sí, TDD |
| M25a-T-03 | C-04 | pgTAP | `npm run test:policies` | Repetir no duplica; contenido distinto da `22023` | Sí, TDD |
| M25a-T-04 | C-05 | pgTAP | `npm run test:policies` | Nulo con otro resultado se rechaza; nulo correcto se guarda | Sí, TDD |
| M25a-T-05 | C-06 | pgTAP | `npm run test:policies` | Empresa ajena da `false`; dos votos dejan el último; valor inválido da `22023` | Sí, TDD |
| M25a-T-06 | C-07 | pgTAP | `npm run test:policies` | Borra registros de la conexión y conserva nulos; repetir da `false` | Sí, TDD |
| M25a-T-07 | C-08 | pgTAP | `npm run test:policies` | `10_demo_closure`: cero filas en ambas tablas | Sí, TDD |
| M25a-T-08 | C-09 | pgTAP | `npm run test:policies` | `09`, T-12: 22 funciones; rol de C con `EXECUTE`; los demás sin él | Sí: el conteo actual es 18 |
| M25a-T-09 | C-10 | pgTAP | `npm run test:policies` | `15`: INVOKER; `anon` y rol de C fallan; otra empresa: cero filas | Sí, TDD |
| M25a-T-10 | C-11 | unit | `npm run test:unit -- tests/unit/chat-redaction.test.ts` | Un caso sintético por patrón | Sí, TDD |
| M25a-T-11 | C-12 | unit | `npm run test:unit -- tests/unit/chat-redaction.test.ts` | Montos, fechas y tarjeta sin Luhn intactos; `f(f(x)) = f(x)` | Sí, TDD |
| M25a-T-12 | C-13 | unit | `npm run test:unit -- tests/unit/chat-redaction.test.ts` | Secreto cerca del límite no queda a medias; longitud máxima 500 | Sí, TDD |
| M25a-T-13 | C-14 | unit | `npm run test:unit -- tests/unit/chat-tools.test.ts` | Trece nombres exactos; campo extra rechazado en cada una | Sí, TDD |
| M25a-T-14 | C-15 | unit | `npm run test:unit -- tests/unit/chat-tools.test.ts` | Búsqueda en el árbol: `execute.ts` sin `getWorkerApi`; `connection_id` sale de `TurnContext` | Sí, TDD |
| M25a-T-15 | C-16, C-28 | app | `npm run test:app -- tests/app/chat-tools.test.ts` | Con JWT de otra empresa: `not_found`, sin cifras | Sí, TDD |
| M25a-T-16 | C-17 | unit | `npm run test:unit -- tests/unit/chat-tools.test.ts` | Búsqueda en `src/modules/chat/`, con `scale.ts` acotado; decimales fuera de precisión intactos | Sí, TDD |
| M25a-T-17 | C-17 | app | `npm run test:app -- tests/app/chat-tools.test.ts` | SQL → Data API → TypeScript con enteros y decimales fuera de precisión, exactos | Sí, TDD |
| M25a-T-18 | C-18 | unit | `npm run test:unit -- tests/unit/chat-tools.test.ts` | Esquema estricto exige cada campo y exactamente uno de valor o ausencia, con los cinco ejemplos sintéticos de Diseño §3; falta uno: `tool_error` | Sí, TDD |
| M25a-T-19 | C-19 | pgTAP | `npm run test:policies` | Cada `chat_*` con 94 días da `22023` | Sí, TDD |
| M25a-T-20 | C-19 | app | `npm run test:app -- tests/app/chat-tools.test.ts` | Período de 93 días con cobertura sintética de más de 28; 94 por la API fallan | Sí, TDD |
| M25a-T-21 | C-19 | unit | `npm run test:unit -- tests/unit/chat-tools.test.ts` | `CHAT_LIMITS.maxPeriodDays` coincide con el valor de `0018`, leído del archivo | Sí, TDD |
| M25a-T-22 | C-20, C-21 | pgTAP | `npm run test:policies` | Días sin fila, no observados, sin métrica, abiertos y parciales: composición exacta y nunca cero | Sí, TDD |
| M25a-T-23 | C-21 | app | `npm run test:app -- tests/app/chat-tools.test.ts` | Días de dos extracciones: rango de `fetched_at`; captura parcial vista al día siguiente | Sí, TDD |
| M25a-T-24 | C-22 | pgTAP | `npm run test:policies` | Total de cuenta distinto de la suma de campañas: gana `account` | Sí, TDD |
| M25a-T-25 | C-23 | pgTAP | `npm run test:policies` | Tasas sobre bases, días incompletos excluidos; denominador cero `not_calculable`; alcance y frecuencia `not_supported` | Sí, TDD |
| M25a-T-26 | C-24 | pgTAP | `npm run test:policies` | Otra variante no suma; dos atribuciones y dos `unknown` no combinan | Sí, TDD |
| M25a-T-27 | C-25 | pgTAP | `npm run test:policies` | Seis cálculos: valor exacto, cero, ausente y parcial | Sí, TDD |
| M25a-T-28 | C-25 | app | `npm run test:app -- tests/app/chat-tools.test.ts` | Ranking con el peor caso sintético termina bajo el `statement_timeout`; desempate estable | Sí, TDD |
| M25a-T-29 | C-26 | unit | `npm run test:unit -- tests/unit/chat-tools.test.ts` | Sin herramienta de ROAS; `cost_per_result` sin tipo se rechaza | Sí, TDD |
| M25a-T-30 | C-27 | pgTAP | `npm run test:policies` | Dimensiones, segmentos desconocidos, `region` sin acciones, sin alcance y `estimated`. Acciones de un día con `unknown`; de dos días, `not_calculable` | Sí, TDD |
| M25a-T-31 | C-28 | app | `npm run test:app -- tests/app/chat-tools.test.ts` | `authenticated` ejecuta por Data API; `select` del registro da `42501` | Sí, TDD |
| M25a-T-32 | C-03 | app | `npm run test:app -- tests/app/chat-tools.test.ts` | Cliente real del rol: registro que llega después de desconectar se descarta | Sí, TDD |
| M25a-T-33 | C-29, C-31 | unit | `npm run test:unit -- tests/unit/chat-llm.test.ts` | Cuerpo exacto con `fetch` simulado; `length` y JSON inválido son `bad_output`; informado nulo sin respuesta | Sí, TDD |
| M25a-T-34 | C-30 | unit | `npm run test:unit -- tests/unit/chat-llm.test.ts` | Recorrido de `src/`: clave solo en `llm.ts`; errores con texto fijo | Sí, TDD |
| M25a-T-35 | C-32 | unit | `npm run test:unit -- tests/unit/chat-orchestrator.test.ts` | Tope de llamadas, plazo con reloj simulado, herramienta inválida sin ejecución; transcripciones sintéticas reproducibles. El reloj lo prueba `M25a-T-73` | Sí, TDD |
| M25a-T-36 | C-33 | pgTAP | `npm run test:policies` | Segundo arriendo `PX011`; mismo `turn_id` idempotente; vencido reemplazado | Sí, TDD |
| M25a-T-37 | C-33 | app | `npm run test:app -- tests/app/chat-tools.test.ts` | Cliente real, dos llamadas concurrentes: un `chat_turn_in_progress`, y `end_chat_turn` libera | Sí, TDD |
| M25a-T-38 | C-34 | unit | `npm run test:unit -- tests/unit/chat-guard.test.ts` | Tabla de candidatos por familia; «una campaña» no es candidato; «Hubo un clic» y «solo una campaña» sí. «Promo 2x1 2026» por marcador pasa como `entity`. «Gastaste 999 pesos» escrito sin marcador se rechaza; por marcador se muestra como `entity`, nunca como afirmación. Alias desconocido rechazado | Sí, TDD |
| M25a-T-39 | C-35 | unit | `npm run test:unit -- tests/unit/chat-guard.test.ts` | Cada campo distinto rechaza; es-AR, sin miles, half-up, «1,2 M» y «30 mil» rechazados. CPC de 0,37 como «$0» rechazado y `spend` a 0 decimales admitido. `-0,125` da `-0,13`, igual que SQL | Sí, TDD |
| M25a-T-40 | C-36 | unit | `npm run test:unit -- tests/unit/chat-guard.test.ts` | Relación falsa rechazada; «se duplicó» sin herramienta rechazado y con `percent_change` admitido | Sí, TDD |
| M25a-T-41 | C-37 | unit | `npm run test:unit -- tests/unit/chat-guard.test.ts` | Cifra ausente de la pregunta rechazada; cifra del dueño como observada rechazada | Sí, TDD |
| M25a-T-42 | C-38, C-39 | unit | `npm run test:unit -- tests/unit/chat-adversarial.test.ts` | Las pruebas obligatorias de CA-50b. Ninguna cifra rechazada en el DTO | Sí, TDD |
| M25a-T-43 | C-38 | unit | `npm run test:unit -- tests/unit/chat-adversarial.test.ts` | Referencia a un resultado de otro turno o inyectado por el cliente: rechazada | Sí, TDD |
| M25a-T-44 | C-40 | unit | `npm run test:unit -- tests/unit/chat-render.test.ts` | Pie completo; parcial con composición; sin `act_` completo en el DTO serializado | Sí, TDD |
| M25a-T-45 | C-41 | unit | `npm run test:unit -- tests/unit/chat-adversarial.test.ts` | `company_id` en la acción rechazado; K01 interno; un registro por intento. Las cuatro salidas las prueba `M25a-T-75` | Sí, TDD |
| M25a-T-46 | C-42 | unit | `npm run test:unit -- tests/unit/chat-adversarial.test.ts` | Con espías de `console`, y sobre mensajes enviados y registro: un centinela sintético de la pregunta no aparece sin redactar | Sí, TDD |
| M25a-T-47 | C-43 | component | `npm run test:component -- tests/component/chat-pantalla.test.tsx` | Aviso, voto en respuesta y abstención, modelo caído conserva y reintenta | Sí, TDD |
| M25a-T-48 | C-44 | component | `npm run test:component -- tests/component/chat-pantalla.test.tsx` | Tras un turno, `localStorage` y `sessionStorage` vacíos | No: hoy tampoco escribe; es regresión |
| M25a-T-49 | C-45 | unit | `npm run test:unit -- tests/unit/chat-adversarial.test.ts` | Preguntas con SQL y órdenes, y nombre de entidad con instrucciones: mismo contexto, herramientas del catálogo, sin ampliar | Sí, TDD |
| M25a-T-50 | C-46 | unit | `npm run test:unit -- tests/unit/chat-guard.test.ts` | `porque`, ROAS y «estable» rechazados, también con un nombre de entidad que los contenga fuera de un marcador; por marcador, no los dispara | Sí, TDD |
| M25a-T-51 | C-46 | component | `npm run test:component -- tests/component/app-pantallas.test.tsx` | Sin ROAS ni «por qué» en las sugerencias; interpretación rotulada | Sí: hoy está en `chat.tsx:15` |
| M25a-T-52 | C-47 | manual (evaluación) | `npm run test:eval` | Informe en `vr-02.md` que cumple cada criterio, con hash previo | Sí: sin implementación no corre |
| M25a-T-53 | C-48 | manual | Revisión de `sesiones/M25a.md` | VR-02 aprobada antes del primer commit de la etapa .3 | No aplica: orden de la corrida |
| M25a-T-54 | C-49 | manual | `git hash-object docs/FASES/FASE1/M03a/acta-meta.md` | Blob registrado, aprobación del usuario y comunicación declarada, antes de `db:push` y publicación | No aplica: documental |
| M25a-T-55 | C-50 | unit | `npm run test:unit -- tests/unit/chat-guard.test.ts` | Bloque con `value`, título o tipo desconocido, `options` fuera de su tipo, referencia ajena o resultado incompatible: rechazado. `span` de un ítem de `conclusiones` resuelto dentro de ese ítem | Sí, TDD |
| M25a-T-56 | C-51, C-52 | component | `npm run test:component -- tests/component/chat-bloques.test.tsx` | Los 19, con faltantes en cada gráfico: marca propia, nunca «0». Aviso del embudo y conclusiones rotuladas | Sí, TDD |
| M25a-T-57 | C-53 | component | `npm run test:component -- tests/component/chat-bloques.test.tsx` | `role="img"`, `aria-label` y «Ver datos» con los mismos textos | Sí, TDD |
| M25a-T-58 | C-53, C-58 | manual | Recorrido en navegador a 360 px y con teclado, tema claro y oscuro | Sin desborde de página; foco visible; capturas redactadas | No aplica: visual |
| M25a-T-59 | C-54, C-55 | unit | `npm run test:unit -- tests/unit/chat-orchestrator.test.ts` | Por defecto visible; `clarify`; cambio de formato; abstención con oferta; `history_from` avisado | Sí, TDD |
| M25a-T-60 | C-56 | manual | Revisión de `sesiones/M25a.md` y `limits.ts` | Medición y valor final con motivo, antes de congelar el conjunto ampliado | No aplica: medición |
| M25a-T-61 | C-57 | manual (evaluación) | `npm run test:eval` | Conjunto ampliado cumple DEC-21 con el bloque | Sí: sin implementación no corre |
| M25a-T-62 | C-58 | manual | Con `0018` y publicación por el usuario: pregunta real en la aplicación | Con 0 filas, «sin filas reportadas» y sin ceros. Sin montos ni IDs en la evidencia | No aplica: recorrido real |
| M25a-T-63 | C-59 | manual | Revisión del diff contra el Contrato documental | Solo propiedades; ningún TTL, función ni conteo | No aplica: documental |
| M25a-T-64 | CB-01, CB-02 | unit | `npm run verify` y las suites de cada etapa | Exit 0, incluida `no-secrets-in-tree` | No: guarda de regresión |
| M25a-T-65 | C-60 | pgTAP | `npm run test:policies` | `15_chat_queries`: cada estado y resultado escribe o no según la excepción, y una desconexión descarta | Sí: sin la excepción no escribe |
| M25a-T-66 | C-61 | unit | `npm run test:unit -- tests/unit/chat-orchestrator.test.ts` | La acción `clarify` termina en `needs_clarification` | Sí: sin el motivo falla |
| M25a-T-67 | C-62 | unit | `npm run test:unit -- tests/unit/chat-guard.test.ts` | Cita inexistente, aparición inexistente y cifra fuera de una cita rechazan; una cita repetida se resuelve por `occurrence` | Sí: sin la resolución del servidor falla |
| M25a-T-68 | C-63 | component | `npm run test:component -- tests/component/chat-pantalla.test.tsx` | Ninguno de los tres textos aparece | Sí: hoy están |
| M25a-T-69 | C-64 | unit | `npm run test:unit -- tests/unit/chat-orchestrator.test.ts` | El cuarto anterior se descarta, cada pregunta pasa por la redacción, una aclaración con cifras o demasiado larga se descarta, y una cifra solo presente en una anterior rechaza el claim | Sí: sin el recorte y la validación falla |
| M25a-T-70 | C-65 | unit | `npm run test:unit -- tests/unit/chat-orchestrator.test.ts` | Con la hora y la zona fijadas, `period` nulo da 7 días que excluyen hoy, `period_defaulted` y pie visible; fechas pedidas no lo marcan; una comparación sin períodos se rechaza | Sí: sin el valor por defecto falla |
| M25a-T-71 | C-66 | component | `npm run test:component -- tests/component/uso-costos-aviso.test.tsx` | Muestra el aviso, sin KPIs ni gráfico | Sí: hoy muestra ceros |
| M25a-T-72 | C-67 | unit | `npm run test:unit -- tests/unit/chat-tools.test.ts` | Igualdad exacta: `purchase` sí, `omni_purchase` no; identificador visible; sin mapeo intacto; nunca fusiona | Sí, TDD |
| M25a-T-73 | C-68 | unit | `npm run test:unit -- tests/unit/chat-orchestrator.test.ts` | Con reloj simulado: un modelo y una herramienta que consumen el margen se cortan a los 50 s y registran; el total no pasa de 60 s; fallan arriendo, registro y liberación, cada uno con su salida | Sí, TDD |
| M25a-T-74 | C-69 | unit | `npm run test:unit -- tests/unit/chat-tools.test.ts` | Más de 1000 entidades se leen completas; una página que falla da `tool_error`; más de 50 van recortadas con `truncated` y `total` | Sí, TDD |
| M25a-T-75 | C-70 | unit | `npm run test:unit -- tests/unit/chat-orchestrator.test.ts` | Las cuatro salidas: `kind`, `can_vote`, `record_id` y respuesta oculta; el DTO serializado no trae texto de la respuesta descartada | Sí, TDD |
| M25a-T-76 | C-71 | app | `npm run test:app -- tests/app/chat-tools.test.ts` | Una caída da `percent_change` negativo exacto por la Data API, y pasa los esquemas | Sí, TDD |
| M25a-T-77 | C-72 | unit | `npm run test:unit -- tests/unit/chat-tools.test.ts` | `breakdown` en `campaign` sin `entity_ref` se rechaza antes de llamar a la base | Sí, TDD |
| M25a-T-78 | C-72 | pgTAP | `npm run test:policies` | `chat_breakdown` en `campaign` sin entidad da `22023`; con más de 20 segmentos, `otros` y participación sobre el total | Sí, TDD |
| M25a-T-79 | C-73 | unit | `npm run test:unit -- tests/unit/chat-render.test.ts` | `share_of_total` suma 10000 con restos; `dona` con `ranking` rechazado | Sí, TDD |
| M25a-T-80 | C-74 | unit | `npm run test:unit -- tests/unit/chat-orchestrator.test.ts` | Transcripción sintética de dos turnos: `clarify`, «la segunda», herramienta con la métrica ofrecida. El segundo turno recibe la aclaración | Sí, TDD |
| M25a-T-81 | C-75 | component | `npm run test:component -- tests/component/app-paginas-sesion.test.tsx` | Todas las páginas, con `chat/page.tsx`, siguen exigiendo sesión | Sí: sin la simulación no resuelve `server-only` |
| M25a-T-82 | CB-03 | manual | `git diff --name-status <base> -- supabase/migrations/` | Solo `A` de `0018`; ninguna modificada | No aplica: control del diff |
| M25a-T-83 | CB-04, CB-05, CB-06 | manual | Revisión de `sesiones/M25a.md` | `db:check:test` antes de cada suite, resultados reales y redactados, y ninguna suite requerida omitida | No aplica: evidencia |

Los criterios C-NN de la tabla remiten a `M25a-C-NN`.

## Verificación

Control de cada etapa, contra el desechable y sin omitir suites requeridas (CB-06):

| Etapa | Comandos |
|---|---|
| `.1` | `npm run verify`, `npm run db:check:test`, `npm run test:policies`, `npm run test:app`, con `0018` aplicada al desechable por el usuario |
| `.2` | Los mismos, `npm run test:unit -- tests/unit/chat-adversarial.test.ts` y VR-02 con `npm run test:eval` |
| `.3` | Los mismos, evaluación ampliada con `npm run test:eval` y recorrido manual |

La ficha de M25a exige «los mismos» en `.2`, incluido `db:check:test`, aunque II.13 no lo repite. Rige la ficha. `npm run test:app` puede listar omitidas opt-in ajenas, identificadas por archivo y motivo. Ninguna de `tests/app/chat-tools.test.ts` puede omitirse. El bloqueo de entorno se distingue del defecto (`H-E1-191`, `H-E1-193`). La evidencia vive en `sesiones/M25a.md`, con resultados reales y sin datos reales. Al final, `/implementation-review M25a` y `/qa-review M25a` revisan toda la microfase. VR-02 se repite antes de la demo si pasó tiempo (`M28.3a`, CA-53).

## Intervenciones del usuario y acciones reservadas

| Paso | Qué hace el usuario | Cómo se verifica después |
|---|---|---|
| Antes de la etapa .1 | Crea `mf/M25a` si la skill no puede | `git status --short --branch` |
| Etapa .1 | `npm run db:push:test` de `0018`, después de la guarda | `db:check:test` y `test:policies` en verde |
| Cierre de cada etapa | Commit de la etapa en `mf/M25a` | `git log`; árbol limpio |
| Etapa .2 | Crea la cuenta de DeepInfra y carga `DEEPINFRA_API_KEY` en `.env.local` y, antes de publicar, en Vercel. Nunca en el chat. Recomendado: fijar un tope de gasto si DeepInfra lo ofrece (`M25a-H-08`) | Presencia por nombre, sin leer el valor; `test:eval` |
| Etapa .3, paso 1 | Aprueba de nuevo el acta y comunica el cambio al dueño | Blob en `PROJECT_STATE.md`; declaración en la sesión |
| Cierre | `db:push` de `0018` en `app`, **antes** de que el código llegue a `main` | `db:preview` e historial; recorrido |
| Cierre | Push, integración y despliegue | Despliegue `READY` |
| Cierre | Hace la pregunta real del recorrido, con su sesión | Evidencia redactada |
| Cierre | Aprueba `G-CHAT` con la frase de `docs/PIPELINE.md` | `PROJECT_STATE.md` |

El asistente no ejecuta `db:push`, `db:push:test` (denegados en `.claude/settings.json`), commits, pushes ni despliegues.

## Trampas y riesgos

- **Lo de la ruta.** El texto de la pregunta nunca va a `console.log` (II.12). Que un número aparezca en algún resultado no alcanza: tiene que estar atado a su métrica, cuenta, período, unidad y fuente. «Se duplicó», «la mitad» o «doscientos mil» son cifras sin dígitos. La guarda no garantiza que el texto sin cifras sea fiel ni que la herramienta sea la correcta. El identificador del modelo no tiene fecha. Si se cambia a Fireworks, solo chat completions.
- **Tope de 28 días.** `get_meta_daily_coverage` rechaza más de 28 días por defecto (`0016:1843`). Reutilizarla rompería CA-70 solo con períodos largos, que las pruebas chicas no ejercitan. `M25a-T-20` lo cubre.
- **Spans.** Un modelo no cuenta bien caracteres, y un `span` corrido rechaza una respuesta correcta. Por eso el modelo cita el fragmento (D-M25a-04). Una cita inexacta igual rechaza la respuesta: VR-02 mide cuánto pasa.
- **Cuenta sin actividad.** Sin filas, `sin_fila_reportada` no puede mostrarse como «gastaste 0». `H-E1-189` y `H-E1-194`: nada de los tipos reales está validado, incluidos los nombres de acción.
- **Truncado.** DeepInfra advierte que `max_tokens` puede cortar el JSON, y la ficha del modelo recomienda valores muy superiores a 800. Si el razonamiento consume ese tope, 800 tokens pueden dar `guard_rejected` sistemático. Se mide en la primera corrida de VR-02.
- **Latencia.** El p95 de 20 s incluye varios pasos del modelo. Una respuesta con varias herramientas hace hasta cinco llamadas; el bucle de §7 es lo primero a revisar si no alcanza.
- **Registro tardío.** Una escritura que agota la reserva puede terminar igual: queda un registro de una consulta que el dueño vio como fallida. Es aceptable, porque la idempotencia evita duplicarlo.
- **Desgloses con acciones.** Sin atribución por fila, las compras por edad, género o país solo se dan de un día. Es el costo de no cambiar `0017`, y se revisa cuando haya filas reales.
- **Mismo turno, otra pestaña.** El despacho secuencial de Next es por cliente y el servidor no encola, por eso existe `chat_turn_leases`.
- **Turno colgado.** Si la función muere, el arriendo queda hasta 90 s: el dueño ve «consulta en curso» ese tiempo. Es aceptable y se declara.
- **Validación del helper.** `private.raise_worker_integrity_error` solo conoce restricciones de `0016`, y `09` prohíbe que funciones fuera de `worker_api` nombren credenciales (`09:546`, `:628`). `0018` no nombra credenciales fuera de `purge_connection`.
- **Nombres de entidad.** Son texto libre del anunciante: pueden traer instrucciones, dígitos y datos personales. No se ejecutan, viajan como datos y se minimizan. Una cifra en un nombre se muestra como dato del proveedor, en un segmento `entity`, nunca como afirmación del modelo (§8).
- **Registro después de desconectar.** Un voto o una respuesta en vuelo no puede resucitar datos (CA-38c). Los registros con conexión nula sobreviven a una desconexión hasta CA-67: el acta ya lo declara (`:81`).
- **Cifras en `question_redacted`.** Puede conservar montos que escribió el dueño (CA-62), incluso en preguntas de contexto.
- **Migración antes del código.** `0018` llega a `app` antes que el código a `main`. Al revés, la acción falla con `42883`.
- **Grandes volúmenes.** Las RPC `chat_*` corren bajo el `statement_timeout` de `authenticated`, con JSONB por día.
- **Costo.** No hay tope de gasto en la ruta. El turno está acotado por CA-70.
- **`preguntas_sugeridas` y `conclusiones` son las únicas vías de texto de un bloque.** La primera no admite texto del modelo; la segunda pasa la guarda.

## Decisiones de la microfase

| ID | Decisión | Motivo | Decidió | Fecha |
|---|---|---|---|---|
| D-M25a-01 | Autorizar todos los archivos de «Archivos previstos» que II.12, II.13 y II.13b no listaban, con una línea de enmienda en la ruta | Sin ellos la microfase no se implementa completa, y VR-02 y el recorrido de bloques no se pueden ejecutar | Usuario | 2026-11-08 |
| D-M25a-02 | `record_query` admite una conexión viva en `needs_reauth` o `pending_selection`, con la generación esperada, solo para `not_answered` y `connection_not_active`. `disconnected` o inexistente siguen descartados. CA-38c se precisa en la spec de la ruta | Registra lo que CA-62 pide sin reinsertar datos tras una desconexión, y el registro se borra con la conexión | Usuario | 2026-11-08 |
| D-M25a-03 | Motivo nuevo `needs_clarification`, con `not_answered`, en la lista de CA-62 | Cada consulta genera un registro sin falsear la medición, y mide cuánto repregunta el chat | Usuario | 2026-11-08 |
| D-M25a-04 | `span` es `quote` y `occurrence`: el modelo cita el fragmento y el servidor obtiene la posición exacta, y rechaza si no aparece. CA-50 se precisa en la spec de la ruta | Contar caracteres es el mayor riesgo de rechazos en VR-02; la garantía queda igual o mejor | Usuario | 2026-11-08 |
| D-M25a-05 | Se quitan «Adjuntar», «Buscar en internet» y «Buscando en internet...» | El chat tiene un catálogo cerrado y no promete lo que no hace. Se aparta del diseño de `docs/praxa-app-diseno` | Usuario | 2026-11-08 |
| D-M25a-06 | Sin librería de gráficos: SVG y CSS propios | Geometría simple desde una proporción ya calculada, sin convertir métricas ni sumar dependencias | Usuario | 2026-11-08 |
| D-M25a-07 | El modelo recibe hasta 3 preguntas anteriores de la sesión, redactadas otra vez por el servidor y tratadas como no confiables, sin respuestas ni cifras. No se persisten | Es lo mínimo que hace funcionar CA-72. El acta lo declara | Usuario | 2026-11-08 |
| D-M25a-08 | Sin umbral para grupos chicos: agregado por segmento, tope de 20 y solo lo pedido, con el límite declarado en el acta | Son agregados que el dueño ya ve en Meta. Sin filas reales no hay base para un número; se revisa en la primera sincronización con filas | Usuario | 2026-11-08 |
| D-M25a-09 | Período por defecto: los últimos 7 días cerrados en la zona de la cuenta | Evita el día abierto, que volvería parcial cada respuesta; es corto y se puede pedir otro | Usuario | 2026-11-08 |
| D-M25a-10 | «Uso y costos» reemplaza sus ceros de ejemplo por un aviso «Todavía no disponible», sin medir consumo. Entra en la enmienda de la ruta | Con el chat publicado, el cero sería falso. El consumo real se ve en DeepInfra; la pantalla real queda fuera de M25a | Usuario | 2026-11-08 |
| D-M25a-11 | El acta sigue declarando que DeepInfra se reserva registrar porciones, y agrega qué dice su página hoy con la fecha de consulta (`M25a-H-05`) | Es lo más prudente si sus condiciones cambian sin aviso | Usuario | 2026-11-08 |
| D-M25a-12 | Hay cuatro salidas posibles: registro confirmado, escritura descartada, fallo de registro y turno rechazado. Solo la primera muestra la respuesta y permite votar. Si falla el registro, la respuesta no se muestra. CA-62 y CA-69 declaran esas excepciones | Toda respuesta mostrada queda registrada, a cambio de perder una respuesta si la base falla en ese momento | Usuario | 2026-11-08 |
| D-M25a-13 | El modelo recibe además la última aclaración pendiente, sin cifras y tratada como no confiable. Ajusta D-M25a-07 y el acta | Sin eso, «la segunda» no se puede entender | Usuario | 2026-11-08 |
| D-M25a-14 | Se autoriza `tests/component/app-paginas-sesion.test.tsx`, como D-M16c-06 | La prueba importa todas las páginas y se rompería a mitad de la corrida | Usuario | 2026-11-08 |

## Supuestos e hipótesis

| ID | Hipótesis | Cómo y cuándo se verifica |
|---|---|---|
| M25a-H-01 | `deepseek-ai/DeepSeek-V4.1-Flash` sigue existiendo y en fp8. La ficha lo confirmaba el 2026-11-08 | VR-02 lo verifica contra CA-53b; si cambió, se frena |
| M25a-H-02 | El modo `json_schema` estricto funciona con este modelo y con nuestro esquema. La ficha muestra «JSON» y la guía lo declara soportado, pero sus ejemplos usan otro modelo y no publica el subconjunto admitido | Primera prueba de la etapa .2, antes de escribir la guarda; VR-02 |
| M25a-H-03 | `reasoning_effort` se acepta como parámetro de la API. La ficha describe un control de 1 a 100, sin ejemplo de solicitud. Tampoco se sabe si el razonamiento consume `max_tokens` | Primera corrida de la etapa .2. Si no se confirma, no se envía |
| M25a-H-04 | La respuesta informa `model`. La ficha no lo dice | VR-02 lo exige. Si falta, `reported_model_id` queda nulo y se frena: CA-53b lo pide |
| M25a-H-05 | La página de privacidad de DeepInfra dice ahora que no registra el contenido, solo metadatos, mientras que DEC-15 y el acta declaran que se reserva registrar porciones. También muestra «Zero retention». **El acta sigue declarando el riesgo mayor** y cita la fecha de consulta (D-M25a-11) | Resuelto por D-M25a-11; se escribe al reaprobar el acta |
| M25a-H-06 | Precio informado el 2026-11-08: USD 0,14 de entrada y 0,42 de salida por millón, con promoción. Con un dueño y CA-70, el costo es marginal | `sesiones/M25a.md` registra el uso real de las evaluaciones |
| M25a-H-07 | `chat_ranking` en nivel `ad` con 93 días y 500 entidades termina bajo el `statement_timeout` de `authenticated`. No se midió | `M25a-T-28`, etapa .1. Si no alcanza, se diagnostica y se optimiza dentro de `0018`. Si tampoco alcanza, se frena y se propone una opción al usuario: no se reduce el alcance sin su decisión |
| M25a-H-08 | DeepInfra ofrece tope de gasto | El usuario lo comprueba al crear la cuenta |
| M25a-H-09 | Los campos reales de Meta coinciden con los simulados (`H-E1-189`), y las variantes coinciden con su contrato (`H-E1-194`) | Primera sincronización con filas. Si difieren, hallazgo nuevo y repetir VR-02 |
| M25a-H-10 | La variante agregada `value` es la correcta para resultados con atribución unificada | Igual que `M25a-H-09` |
| M25a-H-11 | La edad y el género llegan en `segment_primary` y `segment_secondary`, en ese orden | Lectura de `tests/app/meta-sync.test.ts` en la etapa .1 |

Supuestos: un dueño y una empresa (spec de la ruta §1); `role = owner` (K01); conexión única viva (CA-18).

## Preguntas abiertas

Sin preguntas abiertas. Las respuestas están en «Decisiones de la microfase».

## Hallazgos relacionados

`H-E1-187`, `H-E1-189`, `H-E1-190`, `H-E1-194`, `H-E1-185`, `H-E1-202`. `H-E1-117` no aplica: es de OAuth.

**A registrar en `docs/HALLAZGOS.md` al iniciar la implementación.** Esta expansión solo escribe esta spec.

1. «Uso y costos» mostraba ceros de ejemplo aunque el chat consuma (`src/modules/app-data/mock.ts:4-6`, `index.ts:100-102`). Se resuelve con el aviso de D-M25a-10; medir el consumo real queda sin asignar.
2. `M03a/acta-meta.md:93` dice que la ampliación de CA-67 «sigue pendiente de aprobación», aunque se aprobó el 2026-11-05 (`plan.md:9`). Se corrige al reaprobar el acta.
3. `docs/PIPELINE.md:73` nombra `M25a.2`, que ya no es una microfase. M25a corre con esfuerzo alto.
4. III.3 y el control de II.13 omiten `db:check:test` en `.2`, a diferencia de la ficha (`:351`). Rige la ficha.
5. II.13 paso 8 nombra `src/components/app-nav.tsx`, que no existe; el enlace ya está en `shell.tsx:39`.
6. III.8 sigue describiendo M16c como gasto e impresiones.
7. Diferencia entre `M25a-H-05` y DEC-15 sobre el registro de contenido en DeepInfra, resuelta en el acta por D-M25a-11.

## Auditorías

Sin auditorías todavía.
