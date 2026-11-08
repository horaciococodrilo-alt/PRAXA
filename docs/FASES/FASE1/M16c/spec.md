# M16c — Sincronización manual ampliada de Meta Ads

**Estado:** APROBADA

Actualizada el 2026-11-07. M16c es una microfase única en tres etapas, M16c.1, M16c.2 y M16c.3, según la Parte I vigente (enmienda de corrida única, D-M16c-05). Esta spec es la spec única de las tres etapas de II.11: no hay specs ni planes por etapa. Se ejecuta con un plan único, `M16c/plan.md`, en una sola corrida de `/microfase M16c`. En esta spec, «corte» y «etapa» son sinónimos. Aprobar esta spec o su plan no inicia M16c: la corrida empieza solo cuando el usuario pide `/microfase M16c`. Una vez iniciada, avanza de .1 a .2 y de .2 a .3 después de cada control de etapa en verde y de las intervenciones del usuario que correspondan, sin pedir otra solicitud ni otro gate intermedio. La aprobación de alcance del 2026-11-06 no aprueba esta revisión técnica.

**Entrada:** G-VR01 aprobado. La etapa .2 empieza solo después del control de la etapa .1, y la .3 después del de la .2 (ver «Verificación»). G-SYNC, el único gate, sigue pendiente.

**Hash de contenido:** excluir únicamente la línea de estado, conservando bytes y saltos de línea, y ejecutar `git hash-object --stdin`. Equivalente POSIX:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M16c/spec.md | git hash-object --stdin
```

## Fuentes

- `AGENTS.md`; `docs/_templates/mf-spec.md`; commit base `a27f727`. Se preservan todos los cambios documentales preexistentes de la conversación. La fuente vigente incluye la enmienda sin commit, aprobada por el usuario; no se confunde con el contenido de HEAD.
- `docs/FASES/FASE1/meta_first/plan.md`: Parte I, ficha M16c y sus tres cortes (líneas 296-327), II.11 (689-707), III.2, III.3 y III.9. II.11 agrupa **M16c.1, M16c.2 y M16c.3**, todos cubiertos aquí. M25a.1/M25a.2 se consideran como consumidores, sin implementarlos.
- `docs/FASES/FASE1/meta_first/spec.md`: §7, K01/K03/K04, DEC-03/04/05/09/22, CA-14/17/19-22/26/38/38b/38c/39/40, §11 completo, CA-48/49/50/51/55/67/68/70 y §14 CB-01 a CB-06.
- `docs/PROJECT_STATE.md` entero: dependencia G-VR01, siguiente microfase M16c y orden de sus etapas. `docs/HALLAZGOS.md`: H-E1-22/27/35/36/117/185/187/188 y H-E1-189, registrado en esta revisión. Las numeraciones antiguas 0013 en hallazgos no prevalecen sobre I.5: migración **0016**, pgTAP **13**.
- `docs/SECURITY.md` §§3-9 y 12; `docs/ARCHITECTURE.md`: roles, caminos, orden de bloqueos, sincronización y chat previstos; `M03a/acta-meta.md`: alcance ampliado y comunicación al dueño.
- Evidencia: `meta_first/sesiones/M16.2.md:300-343`, cierre de VR-01 con cuenta vacía; `enmienda-insights-2026-11-06.md`; sesiones M06.1a-M06.2a y M06.3a para ACL/rol. Estos resultados históricos no prueban M16c.
- Código e infraestructura contrastados: migraciones 0001/0002/0004/0012 y existencia de 0013/0014/0015; pgTAP 09/10; tenant, adaptador, repositorios, lifecycle, cliente/URLs/clasificación/listado Meta; acciones y página/tarjeta de Integraciones; pruebas lifecycle y cliente real; runner, arnés app, package.json y proyectos Vitest.
- Consulta oficial del 2026-11-07: [colección de Meta](https://www.postman.com/meta/facebook-marketing-api/overview), [ejemplo de atribución y campos](https://www.postman.com/meta/facebook-marketing-api/request/5wdl62t/attributionsetting). Confirman ejemplos de campos y atribución unificada; no acreditan cada combinación de nivel, Graph v26 y cuenta piloto. La falta de prueba real queda como hipótesis verificable, sin sustituirla por ejemplos.

## Objetivo

Obtener el catálogo de §11 de la ruta en cuenta, campaña, conjunto y anuncio, con snapshots por nivel, cobertura explícita y publicación protegida por posesión, para la consulta posterior del chat sobre datos guardados.

## Alcance

1. M16c.1: migración nueva 0016, funciones/lecturas, esquema tipado, ACL/RLS/cascadas, adaptador, persistencia lifecycle y H-E1-22/27/35/36.
2. M16c.2: extractor de los cuatro niveles y metadata, validación/atribución, paginación, reintentos y publicación independiente por nivel, Meta simulada y precisión Graph → SQL → Data API → TypeScript.
3. M16c.3: acción manual, presentación por nivel/entidad, pruebas de UI, comunicación previa al dueño, validación desplegada y Q-04 real.
4. Conservar cuentas delegadas paginadas y ciclo de vida entregados por M16.2; extender purga sin modificar ninguna migración aplicada.
5. Declarar todo parcial o no informado con su procedencia. Solo cuatro niveles completos producen éxito global.

## Fuera de alcance

Workers/cron/colas, renovación del lease, extracción desde el chat, escrituras publicitarias, cambio de OAuth/cuenta por una vía alternativa, más cuentas/proveedores, ROAS, rentabilidad, causas, recomendaciones, variaciones porcentuales y chat M25a. No generar gasto para obtener datos de prueba. No producir reach/frecuencia multidiarios sumando filas ni totales de cuenta sumando niveles. No modificar migraciones existentes ni publicar desde el asistente.

## Contexto verificado en el código

| Qué | Dónde (archivo:línea) | Implicación |
|---|---|---|
| Puntero de ejecución ya existe, sin FK a Insights | `supabase/migrations/0012_integrations.sql:277`, `:290`, `:298` | Agregar FK compuesta en 0016 y anular puntero antes de purgar |
| Adaptador de doce operaciones y SQL estático | `src/modules/integrations/db/worker-api.ts:9`, `:63`, `:168` | Ampliar allowlist/casts; no aceptar SQL libre |
| Catálogo PX001–PX008 y timeout de base | `src/modules/integrations/db/worker-api.ts:125`, `:155` | Nuevos conflictos tipados y reserva que incluya conexión/consulta |
| Rama unchanged solo registra log | `src/modules/integrations/lifecycle.ts:273`, `:280` | H-E1-22 necesita escritura obligatoria y prueba del camino general |
| Reauth valida generación pero no posesión de sync | `supabase/migrations/0012_integrations.sql:1119`, `:1177` | El efecto de sync debe ejecutarse dentro de fail_sync_run tras su guarda |
| Purga devuelve booleano y exige disconnected | `supabase/migrations/0012_integrations.sql:1277`, `:1309` | Reemplazar preservando firma y repetibilidad |
| Credencial descifrada incluye estado y generación | `src/modules/integrations/repository/credentials.ts:234`, `:247` | Reutilizar readCredential, cotejar antes de Graph y al escribir |
| Conexión completa bajo JWT/RLS | `src/modules/integrations/repository/connections.ts:67`, `:75` | Reusar readConnectionRecord; no lectura privilegiada alternativa |
| La cuenta entregada conserva prefijo act_ y hasta 60 dígitos | `src/modules/integrations/meta/accounts.ts:47`; `src/modules/integrations/meta/probe.ts:26` | Mantener esa representación para la cuenta raíz; no tratarla como un ID numérico de entidad de 32 caracteres |
| Graph v26 centralizada; cliente Bearer/timeout | `src/modules/integrations/meta/api.ts:14`, `:35`; `src/modules/integrations/meta/client.ts:18`, `:85` | Reconstruir URL con graphUrl; timeout recortado por presupuesto |
| Listado ya pagina | `src/modules/integrations/meta/accounts.ts:9`, `:23` | CA-60 requiere regresión, no rehacer listado |
| Acciones revalidan antes de redirect | `src/modules/integrations/actions.ts:13`, `:28` | Mantener redirect fuera de catch; resultado sync separado de OAuth |
| Página/tarjeta no tienen sync | `src/app/(app)/app/integraciones/page.tsx:20`; `src/app/(app)/app/integraciones/meta-tarjeta.tsx:46` | Añadir controles en el directorio autorizado |
| pgTAP fija catálogo exacto de doce funciones | `supabase/tests/09_integration_privileges.test.sql:386`, `:397`, `:517`, `:550` | Actualizar catálogo, no omitir suite ni relajar conteos |
| Runner inyecta bloque de normalización histórico | `scripts/run-pgtap.mjs:35`, `:132` | Probar bloques reales para rol sintético limpio y atributos nuevos |
| Cierre prueba cascada empresa → usuario | `supabase/tests/10_demo_closure.test.sql:1-15`, `:155-221` | Sembrar todas las tablas nuevas y comprobar cero filas |
| Pruebas remotas verifican destino y limpieza | `tests/app/helpers.ts:41`; `vitest.config.mts:50` | Solo desechable, JWT para aserciones, sin skip requerido |
| verify no incluye app/pgTAP | `package.json:14`, `:17`, `:26` | Ejecutar tres suites por corte; scripts comprobados |
| VR-01 obtuvo cero filas y campos | `docs/FASES/FASE1/meta_first/sesiones/M16.2.md:300`, `:314`, `:341` | G-VR01 permanece cerrado; campos y Q-04 no acreditados |

## Diseño concreto

### Identidad, datos y precisión

El catálogo único es §11 de la ruta. Se implementan los cinco conteos/medidas base, las cuatro tasas y las acciones/valores por tipo allí definidos, separados por nivel. `level` es exactamente `account|campaign|adset|ad`. Referencias públicas de entidad: UUID aleatorio estable por conexión/nivel/ID externo canónico. Los IDs nunca pasan por `number` ni aparecen completos en el DTO.

La cuenta raíz usa la forma canónica `act_` seguida de 1 a 60 dígitos, compatible con M16.2. La normalización de cuenta acepta exclusivamente `^act_[0-9]{1,60}$` o `^[0-9]{1,60}$`: conserva la primera y antepone `act_` a la segunda. No recorta espacios, no cambia ceros iniciales ni convierte a entero. En las URLs de la cuenta se usa siempre esa forma con prefijo. `external_id` de nivel account y el padre de una campaign usan esa misma forma. Los IDs de campaign/adset/ad y los de conjuntos en atribución son exclusivamente cadenas de 1 a 32 dígitos. La normalización se aplica al construir el payload y SQL la valida de nuevo antes de resolver las referencias UUID. SQL compara la raíz canónica exactamente con `integration_connections.external_account_id`, sin modificar el registro existente; raíz distinta o formato inválido se rechazan. Un `account_id` numérico devuelto por Insights se normaliza con la regla de cuenta antes de compararlo. Un prefijo duplicado o un ID de cuenta usado como ID de adset son inválidos.

Una fila normalizada tiene `date`, identidad de entidad, métricas y acciones. Métrica omitida/nula → null con estado `no_informado`; cero explícito → cadena de cero. Presencia de fila es independiente. El patrón decimal, escrito como expresión sin escapes de cadena, es `^[0-9]+([.][0-9]+)?$`: el literal TypeScript es `/^[0-9]+([.][0-9]+)?$/` y el patrón SQL es `'^[0-9]+([.][0-9]+)?$'`. Ambos aceptan las cadenas sintéticas `0`, `12.34` y `00.50`; rechazan cadena vacía, `12x34`, `12\34`, `1.`, `.5`, signos, espacios, notación científica, NaN e infinito. Los conteos base usan además `^[0-9]+$` y deben caber en bigint. Acciones y action_values son numeric, incluso cuando el conteo es fraccionario. Acotar cada cadena numérica a 128 caracteres antes de SQL, sin redondearla; exceder el límite invalida la extracción. JSON numérico en lugar de cadena se rechaza, no se corrige con String.

Acción normalizada: `{action_type, variant, count:string|null, value:string|null}`. `action_type` sigue la expresión/longitud de §11; `variant` es `value` para el valor agregado informado o una clave de atribución del proveedor que cumple `^[A-Za-z][A-Za-z0-9_]{0,63}$`. Preservar variantes separadas, sin sumar sus valores. Unir actions y action_values por tipo/variante sin crear ceros para el lado ausente. Duplicados en el mismo array son error; el mismo tipo presente una vez en cada array es válido. Campos extra se proyectan fuera; estructura/campo conocido presente pero mal formado hace incompleto el nivel.

Metadata normalizada: `{level, external_id, parent_external_id:null|string, name:null|string, effective_status:null|string, objective:null|string, attribution}`. La cuenta raíz coincide con la conexión confirmada. Nombres/estados son texto de proveedor no confiable: escapar en UI, sin interpretarlo como instrucciones. Nombre ≤1024 caracteres, estado/objetivo ≤128; objetivo solo en campaign. No inventar estado histórico desde el día de métricas. Ausencia legítima de campo → null; metadata no recuperable para una entidad referida impide completar el nivel.

Atribución estructurada: `{known:boolean, report_time:'impression', unified:true, settings:[{adset_ref, windows:[{event_type,days}]}]}`, con tipos y límites positivos validados, referencias internas, orden canónico y sin claves/cuerpos libres. Campo no acreditable → known=false, no inventar ventana. Niveles account/campaign conservan el conjunto de configuraciones efectivas de sus descendientes referidos; la igualdad se compara por el conjunto completo, sin suponer una sola configuración. El conteo/valor bruto puede mostrarse con aviso de atribución desconocida; no se agrega con otras atribuciones como equivalente.

La entrada normalizada del extractor todavía usa IDs externos en identidad, parentesco y `settings[].adset_external_id`. `publish_snapshot` crea/reutiliza las referencias UUID en meta_entities y transforma esos IDs a entity_ref/parent_ref/adset_ref dentro de SQL. El extractor no necesita leer el registro oculto ni generar referencias públicas. La atribución anterior describe la forma persistida y visible; los IDs de entrada quedan únicamente en estructuras internas validadas. Conservar el vínculo capturado en meta_snapshot_entities aun si cambia el parentesco registrado en una captura posterior.

### Persistencia propuesta nueva en 0016 (M16c.1)

Los nombres de esta sección son **objetos nuevos a crear**, no existentes. Todas las tablas en public, con RLS habilitada/forzada, company_id no nulo, revocaciones explícitas a PUBLIC/anon/authenticated/service_role/rol C y FKs compuestas que impidan cruzar empresas/conexiones. Solo `meta_daily_coverage` concede SELECT a authenticated según la matriz de §7. Ningún grant directo al rol C. UUID sin secuencias.

| Tabla nueva | Contrato |
|---|---|
| meta_sync_runs | id uuid PK; company_id, connection_id, credential_generation int; ownership_token text de 64 hex aleatorios; started_at/lease_expires_at timestamptz; finished_at nullable; window_from/window_to date; status running/completed/partial/failed/superseded; límites congelados en jsonb tipado. FK a conexión, UNIQUE(company_id,connection_id,id), índice único connection_id WHERE status=running. Terminal con finished_at; lease posterior al inicio |
| meta_entities | entity_ref uuid PK; company_id/connection_id; level; external_id text; parent_ref nullable; UNIQUE(connection_id,level,external_id), UNIQUE(company_id,connection_id,entity_ref). Raíz account sin padre; campaign→account, adset→campaign, ad→adset de misma conexión. No guarda nombres actuales que reescriban historia |
| meta_insight_snapshots | id uuid PK; company_id/connection_id; sync_run_id; level; fetched_at; window; currency/timezone; pages; complete boolean; result complete/incomplete/failed; error_class nullable; parameters jsonb cerrado; duration_ms. UNIQUE(sync_run_id,level), FK compuesta a run con cascada. Complete exige error nulo; parámetros sin secretos |
| meta_snapshot_entities | PK(snapshot_id,entity_ref); company_id/connection_id; metadata capturada tipada: nombre, estado, objetivo, parent_ref, metadata_fetched_at, attribution jsonb validado. Incluye ancestros necesarios del nivel. FK snapshot y entidad en misma conexión. La metadata pertenece a la captura, no al día medido |
| meta_snapshot_days | PK(snapshot_id,entity_ref,date); company_id/connection_id; spend numeric nullable; impressions/reach/clicks/inline_link_clicks bigint nullable; ctr/cpc/cpm/frequency numeric nullable. FK compuesta a metadata de ese snapshot. Solo filas recibidas; fechas válidas dentro de ventana, métricas no negativas |
| meta_snapshot_actions | PK(snapshot_id,entity_ref,date,action_type,variant); company_id/connection_id; count numeric nullable, value numeric nullable; al menos uno no nulo. FK compuesta a fila diaria, atribución heredada de metadata del snapshot; nunca sumar variantes |
| meta_daily_coverage | PK(connection_id,level,date); company_id; snapshot_id; fetched_at; captured_before_day_end boolean; currency/timezone; entities jsonb; rows jsonb. FK compuesta al snapshot con cascada, mismo nivel y rango; solo snapshot completo. entities/rows son una **proyección pública cerrada** construida por SQL, no JSON crudo recibido |

La misma migración agrega `public.integration_connections.meta_sync_summary jsonb NULL`, con CHECK de forma cerrada. Es una proyección segura del último intento, legible mediante el SELECT/RLS ya autorizado para la conexión. No se agregan grants de lectura sobre runs, snapshots u otras tablas. Se construye exclusivamente en las funciones SQL de sync; no se copia ningún JSON recibido del cliente o de Meta.

Forma de `meta_sync_summary`: `{version:1, credential_generation:integer, window_from:date, window_to:date, max_window_days:integer, started_at:timestamptz, lease_expires_at:timestamptz, finished_at:timestamptz|null, status:'running'|'completed'|'partial'|'failed', levels:{account:LevelSummary,campaign:LevelSummary,adset:LevelSummary,ad:LevelSummary}}`. `max_window_days` es positivo y se copia desde `p_limits.maxWindowDays` validado al iniciar. `LevelSummary` es `{status:'pending'|'complete'|'incomplete'|'failed'|'not_attempted', reason:null|'complete'|'page_limit'|'duration_limit'|'invalid_response'|'meta_error'|'own_error', fetched_at:timestamptz|null, finished_at:timestamptz|null}`. No contiene payload, nombres, importes, IDs externos, run_id, token de posesión, errores libres ni cursores. Un NULL significa que no existe intento registrado.

`start_sync_run` reemplaza la proyección del último intento en la misma transacción: status=running, cuatro niveles pending y sus campos de resultado nulos. Cada publish/fail la actualiza atómicamente con snapshot, cobertura cuando corresponda y estado del run. Un fallo no modifica la cobertura anterior, pero sí el resultado visible de ese intento. Al detener la ejecución, los niveles que no llegaron a intentarse quedan not_attempted con razón/captura/fin nulos. Los resultados confirmados no cambian. Reintentos idempotentes no vuelven a actualizar la proyección; una ejecución desplazada no puede sobrescribir la del intento nuevo. El siguiente inicio puede reemplazar este resumen, mientras la historia permanece en los runs/snapshots ocultos. La purga elimina la columna junto con la conexión.

La proyección de cobertura resuelve la lectura sin abrir tablas internas: `entities` contiene entity_ref, level, parent_ref y metadata capturada **sin external_id**; `rows` contiene entity_ref, métricas como texto/null, acciones tipadas y atribución segura sin IDs externos. Incluir el catálogo de entidades conocidas para ese nivel en la captura aunque no haya filas de métricas; una respuesta vacía válida tiene rows=[] y puede tener catálogo vacío. Persistir los padres como referencias opacas. SQL construye la proyección desde filas validadas, convierte numeric/bigint con ::text y verifica forma/ausencia de claves extra; no copiar p_payload a cobertura.

La política de cobertura exige membresía con private.is_company_member y conexión visible active/needs_reauth. Una conexión disconnected no expone cobertura mientras se purga. La consulta no puede leer snapshots ni meta_entities directamente. Métricas no informadas no se rellenan. Para una entidad conocida por una captura visible de la conexión, buscarla en día cubierto sin fila → sin_fila_reportada, exista o no en el catálogo de ese día; el resultado no afirma que existiera entonces.

Snapshots/metadata/días/acciones inmutables con trigger que rechaza UPDATE, también desde funciones privilegiadas. El borrado se permite por purga legítima y cascada administrativa de empresa. FK de current_sync_run_id a run de misma conexión, nullable; anularla primero en purga. Conservar snapshots sustituidos mientras vive la conexión. Nunca borrar registro de entidad por pausa/eliminación de Meta.

### API SQL cerrada y orden transaccional

Funciones nuevas en worker_api SECURITY DEFINER, search_path vacío, actor/empresa primero con private.assert_worker_actor; ACL explícita. Orden: autorización → private.lock_company → conexión FOR UPDATE → run FOR UPDATE. Usar clock_timestamp() tras esperar bloqueos. No mantener bloqueos SQL durante llamadas a Meta.

| Función | Argumentos después de actor uuid, empresa uuid | Resultado |
|---|---|---|
| start_sync_run | p_connection_id uuid, p_expected_generation integer, p_run_id uuid, p_ownership_token text, p_window_from date, p_window_to date, p_limits jsonb | run_id uuid, credential_generation int, started_at/lease_expires_at timestamptz. Activa y misma generación. Si hay otro run running con lease vigente y la misma generación que la conexión, PX009. Si el run running venció o tiene otra generación (por ejemplo, hubo una reautorización durante la sincronización), se marca superseded en el acto y el puntero pasa al nuevo: ese run ya no puede escribir, porque la posesión exige la generación vigente. Reintento exacto no renueva lease |
| publish_snapshot | p_connection_id uuid, p_expected_generation integer, p_run_id uuid, p_ownership_token text, p_snapshot_id uuid, p_level text, p_fetched_at timestamptz, p_pages integer, p_duration_ms integer, p_payload jsonb | snapshot_id uuid, level text, complete boolean. Payload={entities:[metadata normalizada],days:[filas normalizadas]}; SQL valida otra vez tipos, raíz/jerarquía/rangos/duplicados/límites y construye claves/proyección. Atómicamente snapshot, filas, cobertura de TODOS los días del rango de ese nivel, resumen público y estado derivado del run |
| fail_sync_run | misma firma de publish_snapshot y, en este orden, p_validated_pages integer, p_failure_reason text, p_error_class text, p_error_message text, p_stop_remaining boolean | run_id uuid, level text, status text (del run), snapshot_result text. El resultado de snapshot se deriva con la regla de progreso siguiente; datos válidos acumulados del nivel y resumen público persisten, cobertura intacta. Clases reauth ejecutan mark_needs_reauth dentro de la transacción con posesión comprobada. Las demás (rate_limit/temporary/transport/own_error/unknown) escriben `integration_connections.last_error_class` y `last_error_message` en la misma transacción, también con posesión, conexión active y generación comprobadas, sin cambiar estado ni generación; ver «Registro de errores de la conexión». Un `p_fetched_at` futuro se acepta solo con la excepción de reloj de «Rechazo de una publicación con 22023» |
| record_connection_error | p_connection_id uuid, p_expected_generation integer, p_error_class text, p_error_message text | connection_id uuid, status text, credential_generation int. Para lifecycle general, nunca como salida alternativa de sync. Clases rate_limit/temporary/transport/own_error/unknown; conexión activa, generación igual; escribe last_error_class/last_error_message y no cambia estado ni generación. Sobre needs_reauth, pending_selection o disconnected rechaza con PX004 sin escribir, así needs_reauth conserva su error de autorización; generación distinta, PX006 |
| purge_connection (reemplazo) | p_connection_id uuid; conserva firma actual (uuid,uuid,uuid) | boolean; disconnected obligatorio, anula puntero y elimina cobertura, acciones, días, metadata, snapshots, runs y entidades, credencial y conexión; repetir devuelve false |

Un run sigue running mientras falte resultado para algún nivel. Al persistir los cuatro: completed si todos completos; partial si al menos uno completo; failed si ninguno. Un error de reauth o límite global deja los niveles sin intentar sin snapshot inventado y finaliza run como partial/failed; los resultados por nivel se derivan como `not_attempted`. Un proceso muerto deja run running hasta vencimiento; el siguiente inicio lo supersede. fail_sync_run con clase reauth finaliza ese run, por lo que ninguna publicación posterior de esa ejecución vuelve a activarlo.

**Clasificación determinística de snapshot y fallo:** `pages` cuenta páginas lógicas con un envelope de datos recibido, de metadata e Insights, una vez por página; llamadas/reintentos HTTP se cuentan aparte. `validated_pages` cuenta solo páginas cuya estructura y todos sus elementos pasaron la validación del catálogo, incluyendo una página vacía válida. Una página se incorpora a los acumulados solo después de validarla entera; de una página inválida no se conservan filas sueltas. Las respuestas Graph de error o un fallo de transporte no son páginas de datos. Toda llamada de fallo cumple `0 <= p_validated_pages <= p_pages`.

En `publish_snapshot`, todas las páginas son válidas: `validated_pages=pages`, `result=complete`, `failure_reason=NULL`. En `fail_sync_run`, `result=incomplete` si `p_validated_pages>0`, y `result=failed` si es cero; nunca se infiere por el número de filas, porque una página válida puede estar vacía. Agregar `validated_pages integer NOT NULL` y `failure_reason text NULL` al snapshot, con CHECK de esta relación entre result, complete, pages y validated_pages. `p_failure_reason` es exactamente page_limit/duration_limit/invalid_response/meta_error/own_error; no puede ser complete. SQL rechaza contadores/razones contradictorios con 22023. Payload sin progreso válido debe estar vacío; si contiene filas/metadata acumuladas exige progreso válido. La validación de filas/metadata acumuladas no exige completar inventario o metadata de entidades cuyas filas se descartaron al fallar.

page_limit, duration_limit, invalid_response y own_error usan clase own_error y mensaje fijo para esa razón. meta_error conserva la clase Graph o de transporte clasificada; temporary/transport solo llegan aquí tras agotar retry o no tener presupuesto para repetir. `p_stop_remaining=true` es obligatorio para duration_limit, rate_limit y clases reauth; SQL rechaza false en esos casos. page_limit de un nivel y los demás errores locales pueden usar false para continuar el siguiente nivel si aún hay presupuesto y conexión válida. Si se detiene con algún nivel completo, run/summary globales son partial; de lo contrario failed. Snapshot failed no implica por sí solo run failed si hay otros niveles completos o pendientes. No se crea snapshot para un nivel not_attempted.

**Registro de errores de la conexión (CA-39, H-E1-22).** La sincronización real nunca pasa por `applyConnectionFailure`, que hoy no tiene llamadores en producción. Por eso `fail_sync_run` es el camino que persiste en la conexión las clases que no llevan a reautorización:

- Con rate_limit, temporary, transport, own_error o unknown, después de las guardas de posesión, y con la conexión active y la misma generación, escribe `last_error_class = p_error_class` y `last_error_message = p_error_message` en `integration_connections`, sin cambiar estado, generación ni puntero. El mensaje es el fijo de esa razón o clase, de 1 a 500 caracteres, que cumple los CHECK de clase y par de 0012 (`0012:314-318`, `:337`).
- El snapshot guarda solo `error_class`; no tiene columna de mensaje. El mensaje fijo queda en la conexión y dentro de `request_payload`, que se usa para comparar reintentos.
- Varios fallos de la misma ejecución sobrescriben el registro: queda el último fallo confirmado. Un reintento idéntico ya confirmado no vuelve a escribir.
- Cuando `publish_snapshot` confirma el cuarto resultado y el run queda completed, en esa misma transacción pone `last_error_class` y `last_error_message` en NULL si la conexión sigue active. Un run partial o failed conserva el último error. Una conexión en needs_reauth nunca llega a ese punto, porque la reautorización finaliza el run.
- Una ejecución que perdió la posesión, una conexión que cambió de generación o una que no está active no escriben en la conexión: el rechazo es PX010, PX006 o PX004, igual que para el snapshot.

Cada llamada de publicación/fallo conserva snapshot_id y contenido preparado para un único reintento por error de transporte/timeout SQL. El snapshot guarda además request_payload jsonb: una representación cerrada de la petición normalizada (datos validados, nivel, páginas, captura, duración y, en fallo, validated_pages/razón/clase/mensaje fijo/stop_remaining), sin respuesta cruda ni secretos. Se compara por igualdad jsonb para acreditar idempotencia, sin depender de reconstruir formatos decimales desde numeric. Respuesta ya confirmada idéntica retorna sin escribir después de validar actor, conexión, generación, token y contenido persistido, aunque el run haya terminado. Un puntero sustituido, desconexión o generación distinta la rechaza. Reintento de snapshot con distinto payload se rechaza. No iniciar otra extracción por una respuesta ambigua de SQL.

PX009/sync_in_progress: «Ya hay una sincronización en curso.»; PX010/sync_ownership_lost: «La sincronización venció o fue reemplazada. Volvé a sincronizar.». Conservar PX001 no autorizado/ajeno indistinguibles, PX004 estado, PX006 generación, 22023 argumento inválido. Traducir sin DETAIL/HINT/valores. Nuevo private.raise_worker_integrity_error(p_constraint_name text) RETURNS void para funciones creadas/reemplazadas, sin reescribir 0012. Sigue el patrón de los helpers privados de 0012 (`0012:222-232`, `:266-268`): SECURITY INVOKER, `set search_path = ''` y `revoke all ... from public, anon, authenticated, service_role`. pgTAP 09 lo suma a las dos aserciones de T-12 sobre helpers privados (`09_integration_privileges.test.sql:453-467`): sin EXECUTE para otros roles, SECURITY INVOKER y ACL explícita. Mapea solo las restricciones de las tablas que escriben esas funciones y no menciona `integration_credentials` ni sus restricciones: el helper vive fuera de `worker_api` y T-14 de pgTAP 09 falla con cualquier función de otro esquema que nombre esa tabla (`09_integration_privileges.test.sql:537-543`). Ninguna función nueva o reemplazada de 0016 inserta credenciales; T-14 se conserva sin excepción. Normalizar CONNECTION LIMIT -1 y VALID UNTIL infinity del rol existente preservando contraseña/grants legítimos; no reejecutar sobre el rol vivo el bloque original que exige ACL vacía.

Lifecycle `applyConnectionFailure` mantiene firma: unchanged **debe** llamar record_connection_error y después registrar log fijo. Si SQL rechaza por cambio de generación/estado, devolver unchanged sin sobrescribir la conexión nueva; otra indisponibilidad se propaga como error fijo, no se declara persistido. La sincronización usa únicamente fail_sync_run para sus errores, con posesión.

**Capa de llamadas.** Como el resto de las operaciones privilegiadas, las funciones nuevas de `worker_api` se llaman solo desde `integrations/repository`, nunca directamente desde `lifecycle.ts` ni `insights.ts`. M16c.1 crea `src/modules/integrations/repository/sync-calls.ts` (nuevo, `server-only`) con cuatro envoltorios: `recordConnectionError`, `startSyncRun`, `publishSnapshot` y `failSyncRun`. Siguen el patrón de `repository/lifecycle-calls.ts`: validan el contexto de tenant y los argumentos con Zod, llaman al adaptador con la operación estática correspondiente y validan la respuesta con un esquema exacto, sin claves extra; una respuesta inválida produce un error fijo. `lifecycle.ts` consume `recordConnectionError`. La orquestación de `insights.ts` (M16c.2) consume los otros tres. `lifecycle-calls.ts` no se modifica. La responsabilidad de `integrations/repository` en ARCHITECTURE no cambia.

### Lecturas públicas y frontera con el chat

Nuevas RPC public SECURITY INVOKER, STABLE, search_path vacío y EXECUTE solo authenticated; leen exclusivamente la conexión y cobertura visibles bajo sus permisos existentes. No consultan runs, snapshots ni entidades ocultos.

`get_meta_daily_coverage(p_connection_id uuid,p_level text,p_from date,p_to date,p_entity_ref uuid default null)` devuelve día, level, entity_ref, metadata segura, presence, métricas text/null, acciones tipadas, currency/timezone, atribución, snapshot_id/fetched_at, captura parcial y temporal_status. `list_meta_entities(p_connection_id uuid,p_level text)` devuelve referencias/metadata de capturas visibles con su instante, no ID externo ni un estado supuesto histórico. Conexión/entidad ajenas devuelven cero filas sin calendario de otro tenant; fechas inválidas → 22023 fijo. El rango máximo se obtiene de `integration_connections.meta_sync_summary.max_window_days`; sin resumen, máximo inicial de 28 días. No se consulta un «run visible». Un fallo posterior puede actualizar el límite del intento pero no las fechas/valores/procedencia de la cobertura anterior. El límite de chat CA-70 se agrega por M25a.1, no se implementa aquí.

Nueva `get_meta_sync_status(p_connection_id uuid)` devuelve cero filas si la conexión no es visible o no está active ni needs_reauth (pending_selection o disconnected), igual que las otras dos RPC; en otro caso, una fila con `has_attempt boolean`, `summary jsonb nullable`, `effective_status text`, `connection_changed boolean`. Si no hay resumen: false, NULL, never y false. Con resumen: true, la proyección cerrada definida arriba y estado global guardado, salvo que siga running y haya cambiado generación/estado de conexión (effective_status=connection_changed), o que `lease_expires_at <= statement_timestamp()` (effective_status=expired); prioridad del cambio de conexión sobre vencimiento. `connection_changed` compara la generación del resumen con la actual o detecta conexión no activa durante un resumen running. En esos estados efectivos la UI deriva para los niveles pending la etiqueta «Sin resultado confirmado»; no cambia summary.levels ni los presenta como not_attempted porque una llamada pudo quedar en vuelo. La derivación al consultar no escribe ni renueva lease; un siguiente inicio reemplaza el resumen. Un resultado terminal confirmado mantiene su resultado aun si la conexión pasa después a needs_reauth, con el aviso de conexión correspondiente.

Las tres RPC consultan la conexión bajo RLS, requieren status active/needs_reauth y devuelven referencias seguras. La nueva columna no se incorpora al select cerrado de readConnectionRecord ni requiere cambiar su esquema de contrato: insights.ts agrega un lector de get_meta_sync_status con Zod, y la página usa ese DTO para resultados/límites. El select de la conexión existente y la proyección de cobertura mantienen sus ACL; esta solución no agrega privilegios a tablas internas.

`no_observado`: sin cobertura nivel/día; `sin_fila_reportada`: cubierto pero entidad sin fila; `con_datos`: fila presente, aun con métricas null. Calcular fin de día como ((date+1)::timestamp AT TIME ZONE timezone); captured_before_day_end se construye con fetched_at al publicar y no cambia al consultar. No sumar 24 horas a un instante.

**Instante de captura por nivel:** `fetched_at` es el timestamp UTC fijado por el servidor como el máximo entre su reloj y el `started_at` que devolvió `start_sync_run`, inmediatamente antes de iniciar la primera petición a Meta de ese nivel, incluida metadata si se pide primero, después de verificar conexión/credencial. Se congela para todas las páginas, reintentos y publicación/fallo de ese nivel; un nivel no intentado no tiene fetched_at. Es una referencia conservadora del inicio de captura: una página recibida después de medianoche no convierte en posterior al cierre una extracción que empezó antes. Cada nivel fija su propio instante; no reutiliza el del primer nivel de la ejecución.

SQL, bajo los locks y tras comprobar posesión, valida `run.started_at <= p_fetched_at <= clock_timestamp()` y timestamps UTC válidos. En `publish_snapshot`, un tiempo fuera de ese intervalo se rechaza con 22023; no se corrige silenciosamente ni altera cobertura. `fail_sync_run` aplica la misma validación, con la única excepción descrita abajo para un instante futuro. El límite inferior se cumple por construcción, con el máximo descrito arriba. El superior depende de que el reloj del servidor no adelante al de la base más que el tiempo entre el inicio del nivel y su publicación (M16c-H-07).

**Rechazo de una publicación con 22023.** Un 22023 de `publish_snapshot` no dice si la causa es el reloj o un dato que SQL considera inválido, así que la orquestación no reintenta con el mismo contenido:

1. Llama a `fail_sync_run` para ese nivel con payload vacío, `p_validated_pages=0`, las páginas recibidas en `p_pages`, el mismo `p_fetched_at`, `p_failure_reason=own_error`, clase own_error con su mensaje fijo y `p_stop_remaining=true`. No reenvía filas ni metadata de ese intento. Se detiene porque, si la causa es el reloj, los niveles siguientes fallarían igual.
2. **Excepción de reloj, solo en `fail_sync_run`:** si `p_fetched_at` es posterior a `clock_timestamp()`, no rechaza. Guarda como `fetched_at` del snapshot fallido el valor de `clock_timestamp()`, que es posterior al inicio del run, y deja el `p_fetched_at` original en `request_payload`. Así un reintento idéntico se reconoce por igualdad y no vuelve a escribir. El límite inferior sigue siendo estricto. La excepción nunca publica cobertura, no cambia `captured_before_day_end` de ninguna cobertura y el instante guardado no se presenta como frescura de datos: es solo la hora del fallo registrado. `publish_snapshot` mantiene la validación completa sin excepciones.
3. **Estado final:** el nivel queda failed, sin filas, porque `validated_pages=0`. Los niveles siguientes quedan not_attempted, sin snapshot. El run termina partial si ya había un nivel completo y failed si no. La clase own_error queda en la conexión según «Registro de errores de la conexión». La acción muestra parcial o incompleta según el estado del run.
4. Si `fail_sync_run` también falla, se aplica la regla de resultado SQL ambiguo (un reintento idéntico y después `no_confirmada`) o el mapeo de errores después de iniciar (incompleta). No se inicia otra extracción.
 `metadata_fetched_at` registra el inicio de la petición que produjo esa metadata, dentro del mismo intervalo del run; si se reutiliza metadata de un nivel previo del mismo run, conserva su timestamp original, aunque sea anterior al fetched_at del nivel nuevo. No se reutiliza metadata capturada en otro run como si fuera actual. La duración usa reloj monotónico independiente, no resta timestamps de pared. Un fallo local antes de llamar a Meta puede cerrar el nivel como failed con el instante de comienzo de su intento y cero páginas validadas; no se confunde con un nivel jamás intentado.

M16c devuelve tasas diarias informadas por Meta. Reglas de totales/CTR/CPC/CPM por período de §11 pertenecen a M25a.1, que debe preservar precisión y atribución. El contrato devuelve los campos necesarios y nunca agrega reach/frequency ni jerarquías para aparentar ese soporte.

### Extracción y orquestación (M16c.2)

`meta/entities.ts` y `meta/insights.ts` nuevos server-only. Tipos propuestos nuevos: SyncLevel; DecimalText; InsightDay; InsightAction; CapturedEntity; Attribution; LevelExtraction; SyncLimits; SyncOutcome. Zod valida entrada de Meta y respuesta SQL. Inyectar tenant, repositorio, worker, fábrica HTTP, reloj monotónico/fecha, sleep y log cerrado; nunca desde navegador.

Interfaz nueva `extractMetaLevel(level,token:SecretValue,accountId:string,window,limits,deps):Promise<LevelExtraction>`; `syncMetaInsights(partialDeps?):Promise<SyncOutcome>`. LevelExtraction={level,entities,days,pages,validatedPages,calls,fetchedAt,durationMs,complete,errorClass,reason}; razón cerrada complete/page_limit/duration_limit/invalid_response/meta_error/own_error. Los contadores pages/validatedPages siguen las reglas SQL; en complete deben ser iguales, y en fallo se pasan como p_pages/p_validated_pages sin recalcularlos desde el número de filas. Tipos de métricas conservan string/null; solo conteos técnicos y duración son number.

Orden fijo account→campaign→adset→ad. Metadata de inventario/ancestros requerida se recupera paginando edges campaigns/adsets/ads de la cuenta y referencias faltantes devueltas por Insights; no filtrar solo activos. Los IDs de campaign/adset/ad nunca van en la ruta de una petición: las referencias faltantes se piden con una lectura de varios IDs sobre la raíz de Graph, `graphUrl('', {ids, fields})` con `getJson`, con los IDs en la consulta y hasta 50 por petición (M16c-H-08). Así no hace falta modificar `client.ts`. Solo el ID de la cuenta va en la ruta, igual que en Insights: la revisión del acta de .3 amplía su excepción declarada de «peticiones a Insights» a «peticiones de lectura a Meta de la cuenta (Insights y edges de metadata)», y la comunicación al dueño lo incluye. No añadir campos creativos, audiencias ni datos personales ajenos al catálogo. Petición de Insights: level solicitado, time_increment=1, fields explícitos del catálogo más IDs/nombres de identidad necesarios, time_range local (`until` = hoy en la zona horaria de la cuenta, incluido el día abierto que exige CA-43b; `since` = `until` − (lookbackDays − 1), es decir 28 fechas con el valor inicial; `window_from`/`window_to` del run son esas mismas fechas), action_report_time=impression y use_unified_attribution_setting=true. Sin date_preset ni breakdown demográfico. Parámetro ausente o no soportado no se elimina silenciosamente para aparentar éxito.

Reconstruir cada petición con graphUrl. paging.next se usa solo como indicador y se descarta; seguir solo after, cadena no vacía ≤2048, sin repetición. Detectar fila duplicada por nivel/entidad/día entre páginas; no sumar duplicados. Página máxima sin siguiente puede completar; con siguiente deja incompleto. Metadata faltante/error/404 no se convierte en entidad con cero ni en nivel completo.

Resolver K01 → leer conexión activa → iniciar run/lease con `startSyncRun` → readCredential y cotejar generación/estado → extraer y publicar cada nivel completo con `publishSnapshot` o registrar su fallo con `failSyncRun`. Antes de cada llamada nueva a Meta, releer estado/generación con JWT. Llamada en vuelo puede terminar pero SQL rechaza su escritura si perdió posesión. Clases temporary/transport: dos reintentos máximo por página, esperas 500/1000 ms, sin duplicar datos y dentro del presupuesto; rate_limit termina ejecución incompleta sin retry. Error auth termina con reauth bajo posesión. Error propio/desconocido de un nivel puede dejarlo fallido y continuar siguiente si conexión, posesión y presupuesto lo permiten.

SyncLimits contiene lookbackDays=28 inicial, maxWindowDays, maxPagesPerLevel, maxMetadataPages, maxEntities, maxPayloadBytes, maxDurationMs, finalizationReserveMs y leaseSeconds, más maxRetries=2 y retryDelayMs=500. Los límites adicionales acotan las estructuras nuevas, no cambian datos solicitados. Q-04 fija los máximos efectivos en .3 antes de cerrar G-SYNC, según D-M16c-02: maxDurationMs y finalizationReserveMs, por debajo de la duración efectiva de Vercel con margen; lookbackDays=28 por CA-47b, con maxWindowDays no menor; maxPagesPerLevel, maxMetadataPages, maxEntities y maxPayloadBytes, como cotas técnicas conservadoras. Se contrastan con la duración medida en la sincronización real, que se registra como referencia aunque traiga 0 filas. No se presentan números sintéticos como medición ni volúmenes de una cuenta vacía como representativos. Las pruebas inyectan límites pequeños.

Presupuesto desde entrada a la orquestación incluye base/red/backoff/metadata y publicación. Timeout HTTP=min(timeout existente,restante-reserva). No iniciar otra llamada sin reserva. Reserva contempla dos intentos SQL de finalización con los timeouts reales del cliente; leaseSeconds=ceil((maxDurationMs+finalizationReserveMs)/1000), no se renueva. Ante resultado SQL ambiguo, un reintento idéntico si cabe; después `unconfirmed`, no otra extracción.

### Acción, UI y logs (M16c.3)

Nueva acción `sincronizarMeta():Promise<never>`, sin argumentos de negocio. Resultados cerrados por query sync, cada uno con su origen y un único texto fijo, sin texto externo:

| Resultado | Tono | Cuándo | Texto |
|---|---|---|---|
| completa | ok | Run completed: los cuatro niveles completos | «Sincronización completa.» |
| parcial | info | Run partial: al menos un nivel completo y otro no | «Algunos niveles se actualizaron. Revisá la cobertura.» |
| incompleta | error | Run failed sin otra causa de esta tabla; PX010 (posesión perdida) durante la ejecución; o cualquier otro error no ambiguo después de iniciar el run (22023, error propio o inesperado de SQL) | «La sincronización quedó incompleta. Conservamos la cobertura anterior.» |
| en_curso | info | PX009 al iniciar | «Ya hay una sincronización en curso.» |
| requiere_reauth | error | Clase reauth registrada por fail_sync_run | «Meta pidió volver a autorizar a Praxa. La sincronización se detuvo; revisá la cobertura y volvé a autorizar.» |
| conexion_cambio | error | PX004, PX006 o PX001 después de iniciar el run (por ejemplo, la purga terminó con una llamada en vuelo); o la conexión dejó de estar activa, cambió de generación o ya no es visible al releerla | «La conexión cambió durante la sincronización. Revisá su estado.» |
| error | error | Error propio, de base o desconocido antes de iniciar el run, incluida la falta de conexión activa | «No pudimos sincronizar. Probá de nuevo más tarde.» |
| no_confirmada | error | Resultado SQL ambiguo después del reintento idéntico (`unconfirmed`) | «No pudimos confirmar el resultado de la sincronización. Revisá la cobertura antes de volver a sincronizar.» |

Si un caso encaja en varios resultados, gana el primero que aparece en este orden: requiere_reauth, conexion_cambio, no_confirmada, en_curso y después el estado del run. Los textos de PX009 y PX010 del adaptador son mensajes de error tipados; en la UI solo se muestra el texto de la tabla. Parser descarta valores repetidos/desconocidos. Releer get_meta_sync_status y cobertura siempre: los resultados por nivel y el estado del último intento provienen del resumen SQL, incluso si es el primer fallo y aún no hay cobertura. La query sync no acredita éxito ni reemplaza ese estado persistido. Revalidar layout app y redirigir fuera de catch.

Botón solo active, pendiente visible con componente dentro de integraciones/ y estado de formulario; selectores de nivel/entidad con refs opacas verificadas en servidor y JWT. Tabla fecha/presencia/campos informados, moneda/unidad, metadata capturada, atribución, captura parcial/frescura y resultado por nivel. Needs_reauth puede leer cobertura autorizada con aviso de antigüedad, no iniciar sync. Conexión desconectada no muestra datos. Texto manual: «La sincronización es manual. Los datos se actualizan cuando pulsás Sincronizar ahora; no se recolectan automáticamente.». No alterar textos aprobados de desconexión.

Log cerrado evento=meta_sync; level, resultado, clase opcional, request_id, filas/campos (nombres)/páginas/llamadas, completa, duracion_ms, motivo enum. Nunca importes, nombres/estados libres de entidades, IDs externos, token/posesión/cursor/URL ni cuerpo. Cada nivel y el resultado global tienen resultado técnico separado. Evidencia real usa conteos/presencia de campos, no valores.

## Archivos previstos

Nuevos se identifican como tales. La expansión escribe esta spec, la propuesta de enmienda de M16c-Q-01 en `revisiones/` y, como seguimiento, el registro de H-E1-189 y la reasignación de H-E1-117 en HALLAZGOS. La integración de la enmienda en la ruta queda en su sesión propia. Las filas siguientes autorizan trabajo futuro según II.11; documentos de seguimiento según precondiciones de Parte II.

| Archivo | Nuevo o modificado | Para qué | Autorizado por |
|---|---|---|---|
| supabase/migrations/0016_meta_insights.sql | Nuevo | Siete tablas, columna meta_sync_summary en conexión, funciones/lecturas invoker, ACL, helpers, rol y purga | II.11 M16c.1 fila persistencia |
| supabase/tests/13_meta_insights.test.sql | Nuevo | ACL, transacciones, precisión, cobertura y carreras | II.11 .1 pgTAP |
| supabase/tests/09_integration_privileges.test.sql | Modificado | Catálogo exacto y rol sintético aislado | II.11 .1 pgTAP |
| supabase/tests/10_demo_closure.test.sql | Modificado | Todas las tablas nuevas en cierre | II.11 .1 pgTAP |
| scripts/run-pgtap.mjs | Modificado | Inyectar bloques reales, rollback | II.11 .1 pgTAP |
| src/modules/integrations/db/worker-api.ts | Modificado | Nuevas firmas/casts y errores fijos | II.11 .1 adaptador |
| src/modules/integrations/repository/sync-calls.ts | Nuevo | Envoltorios con Zod de record_connection_error y start/publish/fail_sync_run; los consumen lifecycle.ts (.1) e insights.ts (.2) | II.11 .1 adaptador y lifecycle; ruta sugerida dentro del módulo (`meta_first/plan.md:406`) |
| src/modules/integrations/lifecycle.ts | Modificado | H-E1-22 mandatory unchanged, por `recordConnectionError` | II.11 .1 lifecycle |
| tests/unit/meta-lifecycle.test.ts; tests/app/meta-lifecycle.test.ts | Modificados | Persistencia general y regresión CA-60 | II.11 .1/.2 |
| tests/app/integrations-worker-api-client.test.ts | Modificado | Operaciones nuevas y previas con rol real | II.11 .1 adaptador |
| src/modules/integrations/meta/insights.ts; entities.ts | Nuevos | Contratos, extractor, orquestación y lector seguro | II.11 .2 extracción |
| tests/unit/meta-insights.test.ts; tests/app/meta-sync.test.ts; tests/app/meta-precision.test.ts | Nuevos | Meta simulada, cuatro niveles, precisión y carreras | II.11 .2 pruebas |
| src/modules/integrations/actions.ts | Modificado | Acción sin tenant/cuenta del cliente | II.11 .3 |
| src/app/(app)/app/integraciones/page.tsx; meta-tarjeta.tsx | Modificados | Presentación y controles. `meta-tarjeta.tsx` conserva su contrato: cualquier prop nueva es opcional y se mantienen sus textos y estructura actuales, para que `tests/component/integraciones-meta-tarjeta.test.tsx` pase sin cambios. Si no es posible, parar y registrar REQUIERE CAMBIO EN LA RUTA, porque ese archivo de prueba no está autorizado | II.11 .3 directorio |
| src/app/(app)/app/integraciones/meta-sync-control.tsx | Nuevo propuesto | Pendiente/selección por referencia | II.11 .3 directorio |
| tests/component/integraciones-meta-sync.test.tsx | Nuevo | Estados, campos, redacción y cobertura | II.11 .3 pruebas |
| tests/unit/meta-oauth.test.ts; tests/component/integraciones-meta-aviso.test.tsx; tests/component/app-paginas-sesion.test.tsx | Modificados | T-24 con tres acciones y los módulos nuevos confinados al servidor; las dos suites de la página simulan `meta/insights`, con la lectura sujeta a la verificación de sesión | D-M16c-06; II.11 .3 |
| docs/SECURITY.md; docs/ARCHITECTURE.md; docs/FASES/FASE1/M03a/acta-meta.md | Modificados solo si cambia propiedad/contenido | Marcar vigente probado; comunicación al dueño | II.11 previo documental/.3 |
| docs/FASES/FASE1/M16c/spec.md | Actualizado ahora; Q-04 posterior | Spec única de las tres etapas | Ficha Parte I; II.11 .3 |
| docs/FASES/FASE1/M16c/plan.md | Nuevo en una solicitud posterior | Plan único de las tres etapas, con puntos de control y de reanudación | Parte I, etapas obligatorias |
| docs/FASES/FASE1/meta_first/sesiones/M16c.md | Nuevo al ejecutar | Evidencia de cada control de etapa y del gate | Seguimiento Parte II |
| docs/HALLAZGOS.md; docs/PROJECT_STATE.md; revisiones de cada corte | Seguimiento posterior | Hallazgos, gates y auditorías | Parte II precondiciones; pipeline |

Reutilizar cliente Meta/Graph, repo de credenciales/conexiones, `repository/lifecycle-calls.ts` y tenant sin editarlos. Si su implementación exige cambios fuera de esta tabla/II.11, parar y registrar REQUIERE CAMBIO EN LA RUTA en `M16c/spec.md`, la única spec; no habilitar SQL abierto ni service_role como atajo.

## Criterios de aceptación

### Heredados de la ruta

Los 16 CA de la ficha se incluyen sin contar CA-44b dos veces. Obligaciones transversales de seguridad/CB también aplican.

| ID de la ruta | Qué exige |
|---|---|
| CA-39 | Clases Graph determinísticas, reauth solo clases autorizadas, persistir otras sin transición |
| CA-41 | Snapshot inmutable por nivel, catálogo tipado y metadata, sin crudo/secretos |
| CA-42 | Todas las páginas y metadata del nivel; éxito global solo cuatro completos |
| CA-43 | Cobertura conexión/nivel/día; ausencia, no observado y no informado distintos; reemplazo completo |
| CA-43b | Estado temporal local consultado, captura parcial persistida y DST |
| CA-44 | Unidad, moneda, zona, entidad/nivel, atribución y procedencia histórica |
| CA-44b | Medidas/counts/rates/actions exactas como texto SQL → API → TS |
| CA-45 | Idempotencia; completo sustituye, parcial conserva cobertura |
| CA-46 | Lectura aislada con refs opacas y todos los estados/frescura |
| CA-47 | Completitud por agotamiento, no por sumas |
| CA-47b | Relectura 28 días inicial configurable; sin prometer congelamiento |
| CA-56 | Límites explícitos inferiores al hosting efectivo, chocar límite deja incompleto |
| CA-57 | Retry solo temporal/transporte, acotado y con espera; rate limit sin retry |
| CA-58 | Run único, posesión aleatoria y lease vencible; B desplaza A vencida |
| CA-59 | Publicación y efecto de fallo/reauth bajo posesión, active y generación transaccionales |
| CA-60 | Listado de cuentas también paginado |

### Operativos de esta microfase

| ID | Criterio verificable | Traza |
|---|---|---|
| M16c-C-01 | K01 servidor; ajena/anon no obtiene datos ni escribe; refs opacas validadas | CA-19/46; DEC-03/04 |
| M16c-C-02 | Siete tablas aisladas y cascadas; solo cobertura tiene SELECT nuevo; resumen en conexión ya legible bajo RLS, invoker no lee ocultas | §7; CA-68 |
| M16c-C-03 | Inicio único y recuperación A→B; repetir inicio no renueva lease | CA-58 |
| M16c-C-04 | A desplazada/vencida no publica/falla/reauth; reloj después de locks | CA-59/38c |
| M16c-C-05 | Publicación de nivel atómica, mismo payload idempotente, distinto rechazado | CA-45/59 |
| M16c-C-06 | Cuatro snapshots por run como máximo; resultado por nivel con regla validated_pages; resumen persiste primer fallo/not_attempted y parcial sin modificar cobertura previa | CA-41/42 |
| M16c-C-07 | No observado/sin fila/no informado/cero explícito distinguibles incluso captura vacía | CA-43/46 |
| M16c-C-08 | Metadata histórica inmutable; pausa/eliminación no borra procedencia | CA-41/44/47b |
| M16c-C-09 | Todas las medidas/acciones fraccionarias viajan exactas sin number | CA-44b |
| M16c-C-10 | fetched_at congelado al iniciar cada nivel, acotado por SQL; captura parcial persiste al cruzar medianoche durante páginas y al consultar después sin resincronizar, con DST | CA-43b |
| M16c-C-11 | Los cuatro niveles usan fechas locales y parámetros del catálogo; sin breakdown extra | DEC-22; CA-47b |
| M16c-C-12 | Metadata requerida y paginación completa; next nunca se sigue/guarda | CA-41/42/47 |
| M16c-C-13 | Retry y timeout respetan presupuesto global, SQL y finalización; Q-04 fijado según D-M16c-02, por debajo de la duración efectiva de Vercel | CA-56/57 |
| M16c-C-14 | Lifecycle unchanged persiste; sync usa fail guardado y persiste en la conexión las clases no reauth; run completed limpia el error; needs_reauth conserva el suyo; error ajeno/viejo no clobber | CA-39; H-E1-22 |
| M16c-C-15 | Desconexión/reauth en vuelo corta llamadas nuevas y escrituras tardías | CA-38c/59 |
| M16c-C-16 | Purga repetible y cierre empresa/usuario borran todas las tablas | CA-38/67/68 |
| M16c-C-17 | Integridad y catálogo redactados; rol connlimit/validez y negativos ACL reales | H-E1-27/35/36 |
| M16c-C-18 | Acción/UI por nivel/entidad, pendiente, resultado global fiel y declaración manual | D2; CA-46/58 |
| M16c-C-19 | Logs/DTO/evidencia sin secretos, nombres libres/IDs externos ni importes reales | CA-26/40; CB-02 |
| M16c-C-20 | Tipos/variantes/atribución se conservan sin rebautizar ni sumar jerarquías/tasas | DEC-22; CA-44/46 |
| M16c-C-21 | CA-60 existente conserva pages/límite sin regresión | CA-60 |
| M16c-C-22 | Tres etapas en orden, cada una cerrada por su control con las suites requeridas; gate único solo con prueba real válida | Parte I; CB-01 a CB-06 |

## Casos de prueba

Casos futuros, no resultados de esta expansión. Importes/cuentas de pruebas son sintéticos. Cada comando es script real de package.json. .1 usa pgTAP y suites existentes; .2 agrega las tres suites nuevas; .3 agrega componente y consolida.

| ID | Criterios | Tipo | Comando | Resultado esperado | ¿Falla sin implementación? |
|---|---|---|---|---|---|
| M16c-T-01 | C-01/02 | pgTAP | npm run test:policies | Dos empresas, todas las ACL/RLS/FK, anon/rol C/service_role sin SELECT nuevo, JWT sin write | Sí: objetos ausentes |
| M16c-T-02 | C-01/02/07 | app | npm run test:app -- tests/app/meta-sync.test.ts | RPC/Data API propio vs ajeno; refs adulteradas sin calendario ajeno; coverage strings | Sí |
| M16c-T-03 | C-03 | pgTAP | npm run test:policies | Inicio A, conflicto B, reintento A igual sin renovar, A vencida deja B; A vigente con generación anterior (reautorización) queda superseded al iniciar B y no escribe después | Sí |
| M16c-T-04 | C-03/04 | app | npm run test:app -- tests/app/integrations-worker-api-client.test.ts | Concurrencia real y bloqueo hasta vencer lease rechazan escritura tardía con clock_timestamp | Sí, casos nuevos .1 |
| M16c-T-05 | C-04/15 | pgTAP | npm run test:policies | A vence, B publica, A no publica/falla/reauth y no cambia B | Sí |
| M16c-T-06 | C-05 | pgTAP | npm run test:policies | Una fila inválida revierte todo; repetir mismo snapshot no duplica; distinto payload rechaza | Sí |
| M16c-T-07 | C-06 | app | npm run test:app -- tests/app/meta-sync.test.ts | account completo/campaign falla/adset y ad completos: run partial, tres niveles nuevos y cobertura vieja de campaign | Sí |
| M16c-T-08 | C-06/07 | app | npm run test:app -- tests/app/meta-sync.test.ts | Cuatro data=[] completos: éxito global y días cubiertos vacíos; cero entidades inventadas | Sí |
| M16c-T-09 | C-07 | app | npm run test:app -- tests/app/meta-sync.test.ts | Métrica omitida/null, fila ausente, cero explícito y día no observado distintos | Sí |
| M16c-T-10 | C-07/08 | pgTAP | npm run test:policies | Snapshot nuevo completo sin fila elimina valor vigente anterior; snapshot viejo permanece | Sí |
| M16c-T-11 | C-08/16 | pgTAP | npm run test:policies | UPDATE snapshot/metadata/días/acciones rechazado; purga y cascada permitidas | Sí |
| M16c-T-12 | C-08/20 | unit | npm run test:unit -- tests/unit/meta-insights.test.ts | Cambio de nombre/estado se captura sin reescribir historia ni atribuir estado al día pasado | Sí |
| M16c-T-13 | C-09 | app | npm run test:app -- tests/app/meta-precision.test.ts | Decimales/enteros mayores que precisión number y acción fraccionaria, Graph simulado→SQL→JSON→Zod exactos | Sí |
| M16c-T-14 | C-09/20 | unit | npm run test:unit -- tests/unit/meta-insights.test.ts | Patrón literal sin escapes ambiguos: acepta 0/12.34/00.50 como cadenas; rechaza número JSON, 12x34, barra intermedia, decimal sin parte entera/fraccionaria, signo, espacio, exponente, bigint overflow y >128 caracteres | Sí |
| M16c-T-15 | C-10 | pgTAP | npm run test:policies | Captura histórica antes/después de cierre, consulta actual conserva flag; no observado null | Sí |
| M16c-T-16 | C-10/11 | unit | npm run test:unit -- tests/unit/meta-insights.test.ts | 28 fechas UTC/Buenos Aires/DST, no restar 24h; `until` es hoy en la zona de la cuenta (incluye el día abierto) y `since` es 27 días antes; sin date_preset; parámetros por nivel exactos | Sí |
| M16c-T-17 | C-11/12 | unit | npm run test:unit -- tests/unit/meta-insights.test.ts | Cuatro niveles, IDs/nombres proyectados, metadata faltante/404 y día duplicado dejan incompleto | Sí |
| M16c-T-18 | C-12/19 | unit | npm run test:unit -- tests/unit/meta-insights.test.ts | after repetido/ausente, next externo, tope con/sin siguiente; ninguna URL next usada | Sí |
| M16c-T-19 | C-13 | unit | npm run test:unit -- tests/unit/meta-insights.test.ts | temporary/transporte dos retry con backoff; rate/auth no retry; límite global detiene niveles pendientes | Sí |
| M16c-T-20 | C-13/05 | unit | npm run test:unit -- tests/unit/meta-insights.test.ts | Base lenta/respuesta SQL ambigua conserva operación, timeout recortado y reserva; no inicia extracción nueva | Sí |
| M16c-T-21 | C-14 | app | npm run test:app -- tests/app/meta-lifecycle.test.ts | applyConnectionFailure unknown persiste last_error fijo, estado/generación iguales; ajena/vieja no cambian; sobre needs_reauth recibe PX004, devuelve unchanged y el error de autorización queda intacto | Sí, añadir aserción antes de código |
| M16c-T-22 | C-14/04 | app | npm run test:app -- tests/app/meta-sync.test.ts | auth de run vigente marca reauth y termina; auth viejo A no altera B; generic writer no usado por sync. rate_limit/unknown de run vigente escriben last_error_class y el mensaje fijo de la clase en la conexión, con estado/generación iguales; run partial lo conserva y run completed posterior lo limpia; A vencida no escribe; reintento idéntico no reescribe | Sí |
| M16c-T-23 | C-15/16 | app | npm run test:app -- tests/app/meta-sync.test.ts | Barrera en llamada, disconnect/reauth/purge, liberar: ninguna reinserción ni siguiente llamada; tras la purga en vuelo, la acción devuelve conexion_cambio | Sí |
| M16c-T-24 | C-16 | pgTAP | npm run test:policies | Purga dos veces y 10_demo_closure con todas las tablas: cero empresa, usuario se borra después | Sí para tablas nuevas |
| M16c-T-25 | C-17 | pgTAP | npm run test:policies | Bloque real sobre rol sintético limpio; grant único falla y sin grant pasa; connlimit/validez normalizados, password/grants intactos; rollback | Sí; control ACL debe fallar al mutarlo |
| M16c-T-26 | C-17 | app | npm run test:app -- tests/app/integrations-worker-api-client.test.ts | Nuevas firmas estáticas y anteriores operan con rol real, errores PX009/010 sin DETAIL; nombres arbitrarios rechazados; los envoltorios de `repository/sync-calls.ts` rechazan argumentos inválidos y respuestas con claves extra o tipos distintos | Parte nueva sí; anterior regresión |
| M16c-T-27 | C-18/19 | component | npm run test:component -- tests/component/integraciones-meta-sync.test.tsx | Botón active, pendiente, cuatro estados, parcial no completa, selects opacos, null/ausencia claros, metadata escapada, texto manual | Sí |
| M16c-T-28 | C-18 | unit | npm run test:unit -- tests/unit/meta-insights.test.ts | Parser query repetida/desconocida no muestra éxito; resultados cerrados sin causas libres; mapeo de errores después de iniciar: PX001 o conexión no visible → conexion_cambio, 22023 o error inesperado → incompleta | Sí |
| M16c-T-29 | C-19 | unit | npm run test:unit -- tests/unit/meta-insights.test.ts | Espías logs solo claves permitidas, datos sensibles sintéticos ausentes, DTO sin external_id/posesión | Sí |
| M16c-T-30 | C-20 | unit | npm run test:unit -- tests/unit/meta-insights.test.ts | Tipo desconocido conservado como identificador, variantes separadas, null vs cero, atribución desconocida no inventada; arrays duplicados rechazados | Sí |
| M16c-T-31 | C-20/02 | pgTAP | npm run test:policies | Proyección pública cerrada sin IDs; SQL null/text exactos; jerarquía/cross-tenant inválidos rechazados; snapshots ocultos | Sí |
| M16c-T-32 | C-21 | unit | npm run test:unit -- tests/unit/meta-lifecycle.test.ts | Listado conserva paginación y rechazo de tope existentes | No, regresión CA-60 |
| M16c-T-33 | C-22/13 | manual | npm run verify; npm run test:policies; npm run test:app | Tres suites en cada control de etapa, requeridas sin skip; evidencia de exit y limitaciones por etapa; ninguna etapa empieza sin el control de la anterior | No aplica TDD al checklist |
| M16c-T-34 | C-22/11/13/19 | manual | Sincronización desde UI tras npm run db:push por usuario | Cuatro niveles con resultado redactado (conteos, presencia de campos, páginas, llamadas y duración), límite efectivo de Vercel acreditado y Q-04 fijado según D-M16c-02. Con la cuenta sin actividad, los cuatro niveles completos con 0 filas bastan para G-SYNC (enmienda integrada el 2026-11-07); no validan campos ni tipos ni acreditan ceros, y H-E1-189 sigue abierto. Con filas: cada campo del catálogo se informa como presente con tipo válido, ausente o rechazado; un campo siempre ausente se registra como hallazgo | No aplica TDD a dato externo |
| M16c-T-35 | C-01/02/06/18 | app | npm run test:app -- tests/app/meta-sync.test.ts | JWT propio lee get_meta_sync_status: never sin intento, primer fallo sin cobertura, parcial con cobertura previa y not_attempted; límite de lectura usa max_window_days público y rechaza exceso; ajena, pending_selection y disconnected cero filas y sin acceso a runs; lease vencido muestra expired sin escribir | Sí |
| M16c-T-36 | C-01/11/20 | unit, pgTAP | npm run test:unit -- tests/unit/meta-insights.test.ts; npm run test:policies | Cuenta sintética entregada con act_ y bare account_id se normalizan igual, incluso prefijo más 60 dígitos; SQL compara raíz exacta con conexión. Prefijo duplicado, raíz distinta, espacios o usar act_ como adset se rechazan sin cambiar la conexión | Sí |
| M16c-T-37 | C-10/11 | unit, pgTAP | npm run test:unit -- tests/unit/meta-insights.test.ts; npm run test:policies | Nivel inicia antes de medianoche y termina después: fetched_at no cambia con página/retry y flag parcial permanece true; nivel siguiente iniciado después tiene su propio instante. SQL rechaza captura anterior al run o futura y conserva cobertura; con reloj local atrasado respecto de started_at, fetched_at toma started_at y SQL lo acepta. Reloj del servidor adelantado: publish_snapshot rechaza con 22023; la orquestación llama a fail_sync_run con payload vacío, validated_pages=0, own_error y stop_remaining=true; el snapshot queda failed, sin filas y con fetched_at igual a la hora de la base; request_payload conserva el instante original; la cobertura y captured_before_day_end no cambian; los niveles siguientes quedan not_attempted; el run termina partial o failed y la conexión registra own_error; un reintento idéntico del fallo no escribe. fail_sync_run con instante anterior al run sigue rechazado; UTC/Buenos Aires/DST | Sí |
| M16c-T-38 | C-05/06/14 | pgTAP | npm run test:policies | Cero páginas válidas produce snapshot failed; metadata o página vacía válida seguida de error produce incomplete aun con cero métricas; éxito vacío es complete. Página inválida no aporta filas. Reason/stop/contadores incoherentes rechazados; detener marca niveles no intentados sin snapshot y run/summary partial si ya había un nivel completo | Sí |

En T-37, los relojes del extractor se inyectan y SQL usa fixtures históricos de run/capturas preparados como administrador dentro del rollback desechable, con límites/lease sintéticos coherentes con el escenario y sin modificar su reloj desde una RPC pública. El cálculo de captured_before_day_end se ejecuta al publicar el fixture válido; no se inserta manualmente el booleano esperado como sustituto de la prueba. Las aserciones de lectura usan JWT. La prueba de decimales de T-14 se replica en pgTAP 13 para que Zod y SQL acepten/rechacen el mismo conjunto.

## Verificación

Durante la expansión solo revisión documental. No se ejecutaron casos nuevos ni se leyó .env.local. En implementación, cada etapa termina con un **control de etapa**: `npm run verify`, `npm run db:check:test`, `npm run test:policies` y `npm run test:app` completos y en verde, después de la aplicación por el usuario al desechable, con la evidencia en `meta_first/sesiones/M16c.md` y el commit de la etapa en `mf/M16c` hecho por el usuario. Si un control falla, la corrida se detiene y el fallo se diagnostica antes de seguir. La corrida puede reanudarse en otra sesión desde el último control registrado y el último commit. `/implementation-review` y `/qa-review` revisan M16c completa al final; una revisión parcial de etapa es opcional, a pedido del usuario. Los comandos filtrados de la tabla apoyan TDD, no reemplazan suites de cierre.

CB-06: setup fallido, skipped requerido o ensayo no ejecutado → NO EJECUTADO y gate pendiente. Omitidas opt-in ajenas solo con archivo/motivo; no proclamar cero omitidas globalmente sin comprobarlo. Registrar comandos, exit, casos, resultados y límites en la sesión de M16c, separados por etapa. Revisar git diff --check, diff y archivos no rastreados sin imprimir coincidencias de secretos.

Seguimiento de [spec-audit-2.md](revisiones/spec-audit-2.md): A-01 se corrige mediante meta_sync_summary y sus RPC invoker; A-02 mediante normalización específica de cuenta; A-03 mediante patrón decimal literal común; A-04 mediante instante de inicio de captura por nivel y límites SQL; A-05 mediante validated_pages/failure_reason y clasificación determinística. Son correcciones de contrato, no resultados de implementación. A-06 está superado: en las auditorías 3 y 4, `npm run verify` sobre `a27f727` dio exit 0 con 595 pruebas y build completo de 13 páginas estáticas. No se diagnosticó la causa de la interrupción anterior. Cada corte vuelve a correr la verificación de base antes de implementar.

## Intervenciones del usuario y acciones reservadas

| Paso | Qué hace el usuario | Verificación posterior |
|---|---|---|
| Antes de la corrida | Aprobar la spec auditada APROBABLE y el plan único | Estados visibles |
| Fin de cada etapa | Hacer el commit de la etapa en `mf/M16c` | Árbol limpio y control de etapa registrado antes de seguir |
| .1 pruebas | Reactivar/configurar desechable si la guarda falla; ejecutar db:push:test cuando migración preparada | db:check:test, historial de 0016 y suites policies/app |
| Configuración faltante | Cargar variables/contraseña fuera del chat; no compartir secretos | Cliente real de pruebas y guardas, nunca imprimir valores |
| .3 antes de datos ampliados | Comunicar acta ampliada al dueño y registrar conformidad redactada | Declaración/evidencia de comunicación antes de la captura |
| .3 publicación | En este orden, solo tras las pruebas en el desechable: db:push de 0016 en app; después, integrar la rama de M16c en `main` y hacer push, que despliega Vercel (D-M16c-03). Acreditar maxDuration efectivo | Historial de app con 0016 aplicada antes del despliegue, con ambos instantes registrados; versión desplegada y límite redactados |
| .3 ensayo | Coordinar la sincronización real con el acceso legítimo existente; no conseguir otra cuenta ni generar actividad (D-M16c-02) | Conteos/campos por nivel, aunque sean 0, y Q-04 fijado según D-M16c-02; sin valores reales ni IDs |
| Gate | Revisar la evidencia consolidada y aprobar G-SYNC | Estado actualizado por evidencia; no autoavanzar |

**Orden de publicación (D-M16c-03).** Ningún código que llame a funciones u objetos de 0016 llega a `main` antes de que 0016 esté aplicada en `app`, porque cada push a `main` despliega en Vercel (`meta_first/plan.md:415`). Si M16c.1 llegara antes, la rama unchanged de lifecycle pasaría de registrar un log a fallar.

1. Las tres etapas se trabajan en la rama única `mf/M16c`, con un commit por etapa. No se hace push a `main` de los commits de las etapas .1 y .2.
2. Si mientras tanto llegan cambios a `main`, la rama de M16c se actualiza desde `main`. Nunca al revés: ningún cambio que vaya a `main` antes de .3 arrastra commits de M16c.
3. Compatibilidad hacia atrás de 0016, que se prueba en .1: el código desplegado en `main` no usa objetos nuevos; el reemplazo de `purge_connection` conserva firma y resultado; la normalización del rol conserva contraseña y grants. Verificación: con 0016 aplicada al desechable, `npm run test:app` del commit base de `main` termina en verde. Se registra en la sesión de M16c, en el control de la etapa .1.
4. Limitación de la ventana: con 0016 aplicada al desechable, `npm run test:policies` de `main` falla, porque pgTAP 09 fija el catálogo exacto de funciones y las columnas de `integration_connections` (`09_integration_privileges.test.sql:218`, `:390-399`). Mientras la rama de M16c esté abierta, el trabajo sobre `main` que necesite `test:policies` se hace sobre la rama de M16c o espera a .3. No se revierte 0016 en el desechable para correrlo.
5. En .3, el usuario aplica 0016 en `app`, verifica el historial e integra y hace push. Después se comprueba la versión desplegada. Si el push ocurriera antes que la migración, se registra como hallazgo y se aplica la migración de inmediato; no se revierte 0016.

## Trampas y riesgos

- No transformar no informado/ausencia en cero ni existencia histórica. Snapshot vacío completo no prueba gasto cero.
- Matriz §7: solo coverage tiene SELECT nuevo para usuarios; la proyección cerrada permite leer metadata/acciones sin grants internos ni definer público.
- Snapshot por nivel: terminar el primero no finaliza run ni permite anunciar éxito global.
- Vigencia es token+puntero+lease+generación+estado, también al fallar o pedir reauth. Usar reloj real después de bloqueos.
- JSON de cobertura lleva números como cadenas; hacerlo String después de Number no recupera precisión.
- No sumar alcance, frecuencia, tasas, jerarquías o ventanas de atribución. Las reglas de agregación futuras pertenecen al chat y deben consumir este contrato.
- Metadata mutable de Meta se congela con captura; no se presenta como estado del día histórico.
- Purga y cascadas deben vencer el ciclo del puntero y triggers de inmutabilidad.
- pgTAP 09 debe conservar su catálogo exacto; rol sintético limpio debe aislar el privilegio que prueba.
- Cuenta sin actividad: Q-04 se fija según D-M16c-02, no con volúmenes medidos. Una sincronización real con 0 filas no valida campos ni tipos ni acredita ceros, y no se presenta como prueba de ellos; H-E1-189 sigue abierto.
- El extractor no detecta cualquier cambio de formato de Meta: rechaza un valor presente mal formado, pero guarda como no_informado un campo ausente y descarta uno extra. Un campo renombrado se vería como no informado sin error; por eso la primera sincronización con filas revisa la presencia de cada campo (H-E1-189). No reabrir G-VR01.
- No subsanar timeouts creando workers ni refrescos automáticos. La excepción al límite de ocho horas (D-M16c-05) no autoriza saltear controles: cada etapa cierra con su control y la corrida se detiene ante un fallo.
- La frontera actual del cliente usa timeout de fetch; probar además consumo del body y presupuesto de respuesta. Si no se puede satisfacer sin editar client.ts, elevarlo como REQUIERE CAMBIO EN LA RUTA en `M16c/spec.md`, indicando la etapa afectada, porque II.11 lo autoriza para reutilización, no modificación.

## Decisiones de la microfase

| ID | Decisión | Decidió | Fecha |
|---|---|---|---|
| D-M16c-01 | Adoptar el alcance ampliado por cuatro niveles y el contrato de DEC-22 de la ruta; integrar la enmienda antes de M16c | Usuario, aprobación explícita en este chat | 2026-11-06 |
| D-M16c-02 | Q-04 se fija sin datos representativos. La cuenta autorizada no tuvo actividad en 28 días (VR-01: 1 página, 1 llamada, alrededor de 1,1 s) y no se busca otra cuenta, porque las que tienen actividad no pertenecen al portfolio del dueño (H-E1-185). Origen de cada límite: la duración máxima y la reserva, de la duración efectiva configurada en Vercel con margen; la ventana, de los 28 días de CA-47b; páginas, metadata, entidades y payload, cotas técnicas conservadoras que hacen caber la ejecución en esa duración. Ninguno se presenta como volumen medido. La medición de VR-01 y la de la sincronización real de .3 se registran como referencia no representativa. Si la cuenta sigue sin actividad, G-SYNC puede cerrarse con la sincronización real redactada de los cuatro niveles completos con 0 filas. Esa evidencia no valida campos ni tipos ni acredita valores cero: H-E1-189 queda como riesgo aceptado temporal, con validación en la primera sincronización con filas. H-E1-117 (hipótesis de OAuth) no se modifica. Requería cambio en la ruta (M16c-Q-01); la enmienda se aprobó e integró el 2026-11-07, y desde entonces rige | Usuario: decisión del 2026-11-06, ratificada en este chat el 2026-11-07 | 2026-11-07 |
| D-M16c-03 | Orden de publicación: el código de M16c.1 y M16c.2 se integra en una rama propia y no llega a `main` hasta M16c.3, después de que el usuario aplique 0016 en `app`. Regla y verificación en «Intervenciones del usuario y acciones reservadas» | Usuario, elección explícita en este chat | 2026-11-07 |
| D-M16c-04 | H-E1-117 conserva solo las hipótesis de OAuth de M16.1. La validación de campos de Insights que la sesión de M16.2 le asoció al cerrar G-VR01 pasa a H-E1-189. En .3 se contrasta cada hipótesis de H-E1-117 con la evidencia ya registrada del OAuth real de VR-01, sin pruebas nuevas contra Meta | Usuario, elección explícita en este chat | 2026-11-07 |
| D-M16c-05 | M16c se ejecuta como microfase única en tres etapas: una spec, un plan, una corrida de `/microfase` y un solo gate, G-SYNC. G-SYNC-DB y G-SYNC-EXTRACT pasan a ser controles de etapa. Excepción puntual al límite de 8 horas de AGENTS.md, como en M16.2. Integrada en la ruta como enmienda | Usuario, elección y aprobación explícitas en este chat | 2026-11-07 |
| D-M16c-06 | Se autorizan tres archivos de prueba fuera de la tabla original (M16c-Q-02, H-E1-195): se actualizan, no se esquivan. Integrada en II.11 y en el plan único | Usuario, elección explícita en este chat | 2026-11-08 |

## Q-04 fijado

Registrado en la etapa .3 según D-M16c-02. Son cotas técnicas, no volúmenes medidos. Fuente: `DEFAULT_SYNC_LIMITS` en `meta/insights.ts`.

**Límite efectivo confirmado por el usuario el 2026-11-08:** 300 s, en plan Hobby con Fluid Compute activo; el campo «Default Max Duration» está vacío y muestra ese valor por defecto. El paso 18 comprueba además la duración de la versión desplegada, como exige el plan.

| Límite | Valor | Justificación |
|---|---|---|
| `maxDuration` de la página | 300 s | Literal igual al límite efectivo. Cubre la Server Action |
| `maxDurationMs` | 240 000 | Presupuesto total desde la entrada a la orquestación, con la reserva adentro |
| `finalizationReserveMs` | 55 000 | Dos intentos SQL de 25 s (10 s de conexión + 15 s de consulta) más 5 s de respuesta |
| `leaseSeconds` | 295 | `ceil((maxDurationMs + finalizationReserveMs) / 1000)` |
| `lookbackDays`, `maxWindowDays` | 28 | CA-47b |
| `maxPagesPerLevel`, `maxMetadataPages` | 20 cada uno | Con 100 filas por página, hasta 2000 filas y 2000 entidades leídas por nivel. Chocarlos deja incompleto el nivel (CA-56) |
| `maxEntities` | 500 | Cada día de cobertura repite el catálogo: con 28 días y 300 bytes por entidad son unos 4 MB de `jsonb`, dentro de los 15 s de consulta de una publicación |
| `maxPayloadBytes` | 2 000 000 | Acota la petición a `publish_snapshot`; se mide con margen del 25 %, porque SQL mide el texto de `jsonb` |
| `maxRetries`, `retryDelayMs` | 2, 500 | Contrato de la spec: esperas de 500 y 1000 ms |

**Peor caso calculado:** la última llamada a Meta termina a los 185 s (presupuesto menos reserva); la publicación usa dos intentos, hasta 235 s; el nivel siguiente registra su fallo con otros dos, hasta 285 s; la respuesta llega a los 290 s, por debajo de 300 s. La relectura de la conexión por JWT no tiene timeout propio: si se cuelga, la plataforma corta la función y el run queda sin resultado confirmado hasta vencer el lease.

La duración de la sincronización real se registra en la sesión como referencia. Una cuenta sin actividad no mide la holgura frente a una cuenta con datos (M16c-H-04).

## Supuestos e hipótesis

| ID | HIPÓTESIS | Cómo y cuándo se verifica |
|---|---|---|
| M16c-H-01 | Graph v26 admite todos los fields/metadata y devuelve cadenas para la cuenta autorizada | Revisar documentación oficial y mocks en .2; confirmar tipos/campos con filas reales en .3; vacío no verifica |
| M16c-H-02 | Unified attribution y report_time elegidos son compatibles en cuatro niveles; metadata expone configuración efectiva | Ensayo oficial/real en .3. Configuración no acreditada → known=false conforme ruta; error de parámetro no se oculta removiéndolo |
| M16c-H-03 | Inventario/ancestros de entidades referidas es recuperable sin filtros de activos | Mocks de eliminadas/404 en .2 y ensayo .3; si no se recupera metadata necesaria, nivel incompleto y diagnóstico |
| M16c-H-04 | Duración Vercel alcanza los cuatro niveles, escritura y reserva con 28 días | Usuario acredita límite efectivo; fijar Q-04 en .3 según D-M16c-02 y comprobar que la sincronización real termina dentro del límite. Con 0 filas, la holgura frente a una cuenta con actividad sigue sin medirse: si una sincronización posterior choca un límite, el nivel queda incompleto (CA-56) y se registra hallazgo. Si no alcanza, diagnosticar y mantener gate, no alterar ruta silenciosamente |
| M16c-H-05 | Proyecto desechable/rol siguen operativos y permiten alterar atributos sin rotar password | db:check:test, aplicación por usuario, pgTAP rollback y cliente real en .1 |
| M16c-H-06 | Cuenta autorizada sigue accesible; puede no tener actividad | Ensayo coordinado .3. Si está vacía, G-SYNC se cierra con 0 filas según D-M16c-02 y H-E1-189 queda como riesgo aceptado temporal, con validación en la primera sincronización con filas. Sin la sincronización real, G-SYNC queda pendiente |
| M16c-H-07 | El reloj del servidor de Vercel no adelanta al de Supabase más que el tiempo entre el inicio de un nivel y su publicación | Unit con reloj inyectado en .2 (T-37). En .3, la sesión registra la diferencia entre `started_at` y el reloj local de la ejecución real, sin valores sensibles. Si aparece un rechazo por 22023, hallazgo y nivel own_error; no se agrega tolerancia silenciosa |
| M16c-H-08 | Graph v26 acepta la lectura de varios IDs sobre la raíz (`?ids=`) con hasta 50 IDs, y los logs de Vercel muestran la ruta de las subpeticiones, no su consulta (`M03a/acta-meta.md:63`) | Documentación oficial y Meta simulada en .2; en .3, revisar en los Runtime Logs que no aparezcan IDs de entidad. Si Graph impone otro límite, se ajusta el lote; si los logs muestran la consulta, hallazgo antes de la sincronización real |
| Ruta H-04 | Código exacto de pérdida de delegación todavía depende de evidencia real | No ampliar asset_access sin prueba; unknown permanece unknown. No provocar retirada sin autorización |

## Preguntas abiertas

Ninguna pregunta abierta. **M16c-Q-01, resuelta el 2026-11-07:** requería cambio en la ruta. D-M16c-02 permite cerrar G-SYNC con 0 filas y fijar Q-04 sin volúmenes representativos. La ruta lo impedía: la spec de la ruta decía que Q-04 «se fija con mediciones» y «con lo medido en VR-01»; el plan repetía «con mediciones», pedía «fijar Q-04 con mediciones reales» y asignaba Q-04 «con datos de VR-01», y II.11 exigía validar campos reales y decía «G-SYNC pendiente si falta evidencia». Esos textos anteriores, con su ubicación, están en la tabla de cambios de la [propuesta](revisiones/propuesta-enmienda-gsync-1.md); las líneas actuales de la ruta ya tienen el texto corregido. El usuario aprobó la [propuesta de enmienda](revisiones/propuesta-enmienda-gsync-1.md) y quedó integrada en la ruta ([sesión](../meta_first/sesiones/enmienda-gsync-2026-11-07.md)). D-M16c-02 rige.

**M16c-Q-02, resuelta el 2026-11-08 (D-M16c-06):** implementar M16c.3 rompía tres pruebas existentes cuyos archivos no estaban autorizados: `tests/unit/meta-oauth.test.ts` (T-24 fijaba dos exportaciones en `actions.ts`), `tests/component/integraciones-meta-aviso.test.tsx` y `tests/component/app-paginas-sesion.test.tsx` (importan la página real sin simular `server-only`). El usuario eligió actualizarlas en lugar de esquivarlas con código que solo existiría para las pruebas.

Q-01/Q-02/Q-03 del borrador anterior están resueltas por la enmienda de II.11. Q-04 se fija en .3 según D-M16c-02, no con un número inventado ni una aprobación implícita. Las hipótesis anteriores tienen verificación y salida explícitas. Si aparece una contradicción nueva, registrar M16c-Q-NN con evidencia y opciones, detener el corte y no editar la ruta sin aprobación.

## Hallazgos relacionados

H-E1-22: persistencia obligatoria general y de sync separadas, .1. H-E1-27: helper en funciones nuevas/reemplazadas, .1. H-E1-35: prueba de ACL con rol limpio y bloque real, .1. H-E1-36: atributos y cliente real conservando contraseña, .1. H-E1-189/H-E1-185: campos y tipos de Insights sin validar con filas reales, .3; no atribuir su resolución a fixtures ni a una sincronización con 0 filas. Con D-M16c-02 y la enmienda integrada, H-E1-189 pasa a riesgo aceptado temporal al cerrar G-SYNC sin filas, con validación en la primera sincronización con filas. H-E1-117 agrupa hipótesis de OAuth de M16.1, no campos de Insights (D-M16c-04): en .3 se contrasta cada hipótesis con la evidencia ya registrada del OAuth real de VR-01 (`meta_first/sesiones/M16.2.md`), sin pruebas nuevas contra Meta ni cambios de OAuth. Cada hipótesis con evidencia se da por confirmada citándola; la que no la tenga queda como pendiente explícito en HALLAZGOS, con asignación. Es seguimiento documental, no amplía la implementación de .3. H-E1-187: enmienda resuelta documentalmente, comportamiento aún por implementar. H-E1-188: enlaces históricos de M06.3a fuera de este corte, no fabricar documentos para cerrarlos. El límite de revocación H-E1-183 permanece aceptado; no cambiar OAuth en M16c.

## Auditorías

- [spec-audit-1.md](revisiones/spec-audit-1.md) revisó el borrador anterior. Veredicto histórico REQUIERE CAMBIOS; no se altera ni se reutiliza como aprobación de esta ficha ni de sus cortes.
- [spec-audit-2.md](revisiones/spec-audit-2.md): REQUIERE CAMBIOS; A-01 a A-05 se corrigieron en el contrato y A-06 quedó superado por el verify con exit 0 de las auditorías 3 y 4.
- [spec-audit-3.md](revisiones/spec-audit-3.md): consideró aprobable el mismo contenido que revisó la auditoría 4.
- [spec-audit-4.md](revisiones/spec-audit-4.md): REQUIERE CAMBIOS, 14 PASS y 4 FAIL. A-01 se registró como D-M16c-02 y M16c-Q-01; A-02 a A-07 se corrigieron en esta revisión; A-03 se resolvió con D-M16c-03.
- [spec-audit-5.md](revisiones/spec-audit-5.md): REQUIERE CAMBIOS, 15 PASS y 3 FAIL. A-01 se resolvió con la enmienda aprobada e integrada; A-05, con D-M16c-04; A-02, A-03, A-04, A-06 y A-07 se corrigieron después de esa auditoría.
- [spec-audit-6.md](revisiones/spec-audit-6.md): APROBABLE, 18 PASS. Sus ocho hallazgos de severidad baja se corrigieron en esta revisión: estado de get_meta_sync_status en pending_selection, ACL del helper de integridad, mapeo de errores después de iniciar, desplazamiento de un run con otra generación, reloj de fetched_at (M16c-H-07), contrato de la tarjeta, IDs fuera de la ruta de las peticiones de metadata (M16c-H-08) y ventana que incluye el día de hoy. Como cambió el contenido, la aprobación necesita una auditoría de esta versión.
- [spec-audit-7.md](revisiones/spec-audit-7.md) y [spec-audit-8.md](revisiones/spec-audit-8.md): REQUIERE CAMBIOS; sus hallazgos, incluida la contradicción del `fetched_at` futuro, se corrigieron.
- [spec-audit-9.md](revisiones/spec-audit-9.md): APROBABLE, 18 PASS, sobre el hash `a31ed49…`. El usuario aprobó esa versión el 2026-11-07. La enmienda de corrida única (D-M16c-05) cambió el texto y la spec volvió a BORRADOR; los cambios son de organización de la ejecución y no del contenido técnico, y necesitan una auditoría nueva.
- [spec-audit-10.md](revisiones/spec-audit-10.md): REQUIERE CAMBIOS, 14 PASS y 4 FAIL, sobre `041e902…`. A-01 y A-02 se corrigieron: la corrida avanza sola entre etapas una vez pedida `/microfase M16c`, las paradas remiten a `M16c/spec.md` como única spec, la siguiente microfase es M16c y las citas de Q-04 remiten a la propuesta. A-03 era de entorno (H-E1-191): `npm run verify` volvió a terminar con exit 0 en la máquina del usuario sobre el mismo código. Esperan una auditoría nueva.
