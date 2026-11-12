# M26a — Spec de la microfase: diagnóstico de Meta Ads

**Estado:** BORRADOR

**Fecha:** 2026-11-11. **Base inspeccionada:** `mf/M25a@708fa0e`, con cambios preexistentes del usuario sin tocar. **Gate previsto:** `G-DIAG`.

> **REQUIERE CAMBIO EN LA RUTA.** La Parte I y la spec aprobadas de `meta_first` excluyen reportes, recomendaciones y rentabilidad, y pasan directamente de M25a a la demo. Esta spec no habilita implementación. La propuesta coordinada está en [propuesta-enmienda-m26a-diagnostico.md](../meta_first/revisiones/propuesta-enmienda-m26a-diagnostico.md). Debe aprobarse e integrarse en la ruta antes de aprobar esta spec y preparar el plan. `G-CHAT` figura pendiente en `docs/PROJECT_STATE.md:29`; es dependencia de ejecución aunque los pasos de M25a estén terminados.

El hash de contenido para la aprobación se calcula, sin la línea `**Estado:**`, con `Get-Content` preservando los finales de línea del árbol o el equivalente de `git hash-object --stdin`. No se fija un hash mientras esta spec sea borrador.

## Fuentes

- `AGENTS.md`: jerarquía, contrato, invariantes y excepciones decididas en el grill de esta microfase.
- Ruta vigente: `docs/FASES/FASE1/meta_first/plan.md` Parte I, II.11–II.14 y III.2, III.3, III.9; `docs/FASES/FASE1/meta_first/spec.md` §§2, 3, 10–14. La ruta aún no contiene ficha ni Parte II de M26a; la propuesta enlazada aporta el cambio requerido, sin vigencia hasta su aprobación.
- Estado: `docs/PROJECT_STATE.md:25-38`; `G-SYNC` cerrado y `G-CHAT` pendiente. Evidencia de la fuente de Meta: `docs/FASES/FASE1/meta_first/sesiones/M16c.md`; evidencia del chat: `sesiones/M25a.md`.
- Privacidad y arquitectura: `docs/SECURITY.md` §§2, 3, 8–10; `docs/ARCHITECTURE.md` §§2, 3 y «Contrato del reporte»; `docs/FASES/FASE1/M03a/acta-meta.md` §§4–5.
- Código: `supabase/migrations/{0003_reports,0012_integrations,0016_meta_insights,0017_meta_breakdowns,0018_chat_queries}.sql`; `src/modules/integrations/meta/insights.ts`; `src/modules/integrations/db/worker-api.ts`; `src/modules/tenant/context.ts`; `src/modules/app-data/{index,types}.ts`; `src/modules/reporting/contract/`; `src/app/(app)/app/diagnostico/page.tsx`; `src/components/app/diagnostico.tsx`; `package.json`; `vitest.config.mts`.
- Next instalado: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` y `01-app/02-guides/server-actions.md`, leídos para las rutas y acciones previstas. Documentación oficial de Anthropic: [modelo](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [salida estructurada](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [búsqueda web](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool), [retención](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data), consultadas el 2026-11-11.

## Objetivo

El dueño genera manualmente un diagnóstico de sus anuncios de Meta para un período de 28 días. PRAXA calcula y conserva los hechos; Claude redacta interpretaciones y recomendaciones basadas en evidencia. El dueño ve un único informe vigente y descarga su PDF. Con actividad ausente se explica por qué no hay informe. El funcionamiento técnico se valida aun si la cuenta piloto no tiene actividad; la utilidad comercial queda sin validar hasta contar con datos reales de una cuenta activa.

## Alcance

Una microfase excepcional en tres etapas, un gate final. `.1`: configuración, preparación de evidencia, cálculos y persistencia. `.2`: Anthropic, búsqueda web opcional, contrato de salida y validación. `.3`: pantalla, PDF, pruebas, evaluación, documentación y cierre. Los controles intermedios no aprueban gates.

El diagnóstico abarca la cuenta conectada y todas las campañas, conjuntos y anuncios con gasto, impresiones, clics o acciones observadas en el período, aunque hoy estén pausados; conserva por separado el estado capturado. Incluye edad/género, país y región donde exista desglose. Un objetivo principal y su métrica representativa se guardan por empresa. Se compara con los 28 días anteriores solo con cobertura suficiente y atribución compatible. Puede mostrar retorno *atribuido por Meta* cuando la acción y el valor estén verificados; nunca ganancia neta.

La plantilla fija contiene resumen ejecutivo, rendimiento general, campañas/conjuntos/anuncios destacados, desgloses disponibles, cero a tres oportunidades priorizadas, acciones con evidencia y plan de comprobación, contexto web opcional y límites de datos. Cada sección existe en la estructura; sin evidencia muestra «no evaluable» y su causa. El tono es español claro para un dueño argentino; los términos técnicos llevan explicación breve.

## Fuera de alcance

- Cohortes de compradores, ventas por producto, stock, costos de tienda, facturación real, rentabilidad y ganancia neta. Requieren Tiendanube y otras fuentes pospuestas (`PROJECT_STATE.md:38`). Los desgloses demográficos de Meta no son cohortes de clientes.
- Escrituras o cambios automáticos en Meta, en presupuestos o en cualquier sistema externo. El dueño decide si sigue una recomendación.
- Benchmarks numéricos de CTR/CPC/CPM/ROAS de ecommerce argentino obtenidos de la web, causas demostradas, predicciones de venta y promesas de mejora.
- Migrar el chat a Anthropic, cambiar sus guardas o su evaluación, editar migraciones existentes, habilitar más de una cuenta conectada, publicar reportes genéricos de `reporting/contract`.
- Historial visible o comparación automática entre diagnósticos. Solo existe un informe vigente; un PDF ya descargado no puede revocarse del dispositivo del dueño.
- Validar impacto comercial con la cuenta piloto sin actividad; `M16d` App Review, Tiendanube, GA4, workers, colas o sincronización programada.

## Contexto verificado en el código

| Hecho | Evidencia | Consecuencia |
|---|---|---|
| La ruta acaba M25a → M28.3a y excluye reportes y recomendaciones | `meta_first/plan.md:68-118,337-377`; `meta_first/spec.md:39-46` | Requiere enmienda aprobada antes de implementación. |
| `G-CHAT` no está aprobado | `PROJECT_STATE.md:29` | No se inicia M26a hasta cerrarlo. |
| La extracción diaria trae cuatro niveles, acciones/valores tipados, cobertura y desgloses | `meta_first/spec.md:330-349`; `src/modules/integrations/meta/insights.ts:45-55,339-355` | No pedir a Meta datos nuevos para este corte; distinguir faltante, cero, estimación y atribución. |
| `reports` exige `context_version_id` y solo admite SELECT del miembro | `supabase/migrations/0003_reports.sql:14-56`; `0004_grants.sql:34-48` | El contrato genérico no sirve para este diagnóstico Meta con configuración ligera; crear persistencia específica en migración nueva, sin ampliar escrituras de `reports`. |
| La pantalla de Diagnóstico solo muestra vacío; un `ready` en `reports` hoy lanza error | `src/app/(app)/app/diagnostico/page.tsx:10-38`; `src/modules/app-data/index.ts:106-118` | Conectar la vista a la persistencia nueva y conservar error visible ante lectura fallida. |
| El DTO visual ya tiene resumen y oportunidades | `src/modules/app-data/types.ts:72-77`; `src/components/app/diagnostico.tsx:35-95` | Adaptarlo a secciones Meta; no mostrar módulos de productos/clientes sin datos. |
| K01 resuelve empresa y dueño dentro del servidor | `src/modules/tenant/context.ts:12-64` | Ninguna acción acepta `company_id` ni `connection_id` del navegador. |
| La purga vigente borra cobertura y conexión | `supabase/migrations/0018_chat_queries.sql:196-223`; `meta_first/spec.md:285-296` | El diagnóstico retenido no debe tener FK en cascada a la conexión; la excepción necesita acta y SECURITY. |
| Existen proyectos Vitest `unit`, `component`, `eval`, `app` | `vitest.config.mts:16-67`; `package.json:8-24` | Reutilizar comandos existentes; la evaluación real del modelo no se omite por falta de clave. |

## Diseño concreto

### 1. Configuración, identidad y elegibilidad

- Una configuración vigente por `company_id`: `goal_kind` (`purchase`, `inquiry`, `traffic`), `metric_ref` (`actions:<action_type>` del catálogo observado o `inline_link_clicks` para tráfico), `updated_at` y actor. No hay texto libre que se convierta en métrica. La acción debe existir como tipo reconocido en la cuenta; no se infiere compra de un tipo desconocido. Al cambiar objetivo, queda en el informe la copia de configuración usada.
- Las acciones de guardar objetivo y generar construyen K01 en el servidor. La configuración y el informe se leen bajo RLS por membresía; su escritura pasa por funciones acotadas con `company_id` obtenido de K01. `anon` y otros tenants no leen ni escriben. No se otorgan INSERT/UPDATE/DELETE directos de informes a `authenticated`.
- `Generar` exige conexión `active`, objetivo configurado, sincronización completada hace menos de 24 horas en la zona de la cuenta y posterior a `generated_at` del informe vigente, y al menos 24 horas desde ese `generated_at`. Fallo de la generación no inicia el plazo. La prueba de elegibilidad ocurre también dentro de la operación de reserva en base, bajo cerrojo por empresa; no basta con el estado de un botón.
- Con cero actividad observada en días cubiertos, no se crea intento ni se llama a Anthropic; se explica «No hay actividad suficiente para generar un diagnóstico». Sin cobertura se informa que faltan datos, nunca cero. Con cobertura parcial se genera un informe parcial y cada sección afectada explica su límite.

### 2. Evidencia y cálculo

- La ventana principal son 28 días calendario de la zona de la cuenta hasta el último día disponible al sincronizar; los días aún abiertos se identifican. La comparación son los 28 días inmediatamente anteriores. Se guardan rango, hora de sincronización, monedas, ventanas de atribución, estado de cobertura por nivel/desglose y versión de metodología. Una lectura posterior de Meta no cambia un diagnóstico ya publicado.
- El servidor recorre todo el conjunto elegible y agrega en SQL `numeric`/`bigint` con salida decimal como texto. Cifras autoritativas: gasto, impresiones, clics, acciones y valores compatibles; CTR, CPC, CPM y retorno atribuido se calculan desde bases compatibles, con denominador mayor que cero. No suma `reach`, `frequency`, tasas ni niveles jerárquicos, ni mezcla atribuciones incompatibles. El retorno se etiqueta «valor atribuido por Meta / gasto» y se omite si la acción/valor o la moneda no están acreditados. No se llama «ganancia».
- Evidencia tipada `system_fact | calculated_metric | inference`, con `evidence_id` estable dentro del informe, nivel, entidad, período, unidad, moneda, atribución, cobertura y procedencia. Las comparaciones solo usan períodos de igual longitud y cobertura suficiente; si no hay datos previos se limita al período actual. Los desgloses son estimaciones de Meta, no reconcilian con totales, y no se cruzan edad/género con lugar.
- Todos los anuncios elegibles influyen en los agregados y selección. Para no truncar silenciosamente, el preparador pagina y produce un resumen verificable por entidad más candidatos ordenados de forma determinística; si no cabe en el presupuesto del modelo, hace lotes con IDs de evidencia y una síntesis final. El manifiesto del informe registra cantidad de entidades examinadas y de lotes. Fallar un lote deja la generación sin publicar, no un «análisis completo» ficticio.

### 3. Claude y contexto web

- Proveedor exclusivo del diagnóstico: Anthropic Messages API con ID fijo inicial `claude-sonnet-5-5`, sujeto a la evaluación. El chat mantiene DeepInfra. La clave `ANTHROPIC_API_KEY` solo se lee en servidor; no se registra ni se envía al navegador. La retención estándar declarada por Anthropic para entradas y salidas de la API es de hasta 30 días, salvo acuerdo específico; el usuario la aceptó para el piloto y se declara en el acta antes de datos reales. Registrar ID solicitado e informado, uso y clase de error sin contenido ni cifras del dueño. Timeout y límites de tokens/llamadas se fijan en el plan tras medir un fixture máximo, sin relajar completitud ni esconder truncados.
- Paso web opcional *separado*: Claude dispone de `web_search` con máximo de usos y `allowed_domains` de fuentes originales aprobadas. La petición contiene solo país, rubro categorizado y tema general; no contiene el paquete Meta, nombres de campañas, identificadores ni montos. Se aceptan solo resultados HTTPS con host permitido, título, URL y fecha verificable. Falta de fuente pertinente, error o límite de búsqueda omite la sección de contexto sin bloquear el diagnóstico. El texto obtenido es dato no confiable, nunca instrucción. No se usa como benchmark numérico del anuncio.
- Paso de informe estructurado: Claude recibe evidencia Meta acotada y, si existe, extractos web validados con referencias. Usa `output_config.format` estricto sin la herramienta web en esa llamada: la API no permite combinar citas de búsqueda con JSON estricto. La salida incluye `summary`, secciones fijas, `opportunities[0..3]`, `evidence_ids`, acción sugerida, hipótesis, incertidumbre, plan de comprobación y referencias web permitidas. El modelo no elige empresa, SQL, fuente de datos ni valores autoritativos.
- El servidor valida esquema, longitud, cobertura de secciones, existencia de cada `evidence_id`, pertenencia de las entidades al informe, que las referencias web provengan del paso web y que las cifras mostradas salgan exclusivamente del paquete calculado. Los bloques de cifras, tablas y pie de metodología los compone el servidor. Una afirmación numérica libre no respaldada, salida truncada, referencia falsa o sección obligatoria inválida rechaza la publicación y conserva el informe anterior. Las interpretaciones no numéricas pueden ser erróneas; se etiquetan como tales y se miden en la evaluación y revisión humana.

### 4. Persistencia, reemplazo, visibilidad y PDF

- Migración nueva `0022_meta_diagnostics.sql` (número provisional hasta integrar la cadena previa) crea una configuración por empresa, un único informe `ready` vigente por empresa y una reserva temporal de generación. No modifica `0003` ni `reports`. El informe contiene datos fuente mínimos para reproducir lo mostrado, versión de esquema/metodología, estado de cobertura, configuración congelada, IDs de evidencia, salida validada, metadatos de modelo y fuentes web. Tiene FK a `companies on delete cascade`, sin FK en cascada a `integration_connections`.
- La reserva es idempotente por `request_id` y serializa intentos del mismo tenant. La publicación verifica que la conexión, generación de credencial y sincronización sigan siendo las esperadas; en una transacción publica el nuevo y borra físicamente el anterior de la base activa. Si falla cualquier paso, el anterior conserva su estado y contenido. La eliminación definitiva del anterior es la excepción de reversibilidad autorizada solo para esta operación. Ninguna copia propia ni PDF persistente queda del anterior; las copias de seguridad del proveedor y PDFs ya descargados son límites declarados.
- Al desconectar Meta, el informe no se borra, pero la app no lo muestra ni permite descargarlo. La lectura y la ruta de descarga vuelven a comprobar conexión activa y que el informe corresponde a la conexión actual; reconectar exige generar un informe nuevo antes de mostrarlo. La baja de empresa/cierre del piloto borra el informe por cascada. Esto requiere el cambio de retención aprobado en ruta, SECURITY y acta antes de datos reales.
- El PDF se construye en el servidor desde el mismo informe validado que ve la pantalla, sin llamar otra vez al modelo y sin guardarlo en Storage. Ruta `GET /app/diagnostico/descargar`, autorizada de nuevo por membresía y conexión, sin ID de empresa en la URL, `Cache-Control: private, no-store` y descarga adjunta. Incluye fecha, ventana, objetivo, cobertura, cada sección, evidencia y fuentes/limitaciones; no incorpora tokens ni ID completo de cuenta. Una biblioteca PDF de Node se añade con lockfile y prueba de caracteres españoles, saltos de página, texto largo y descarga.

## Archivos previstos

**Todos los archivos de implementación de la tabla requieren autorización en la Parte II de la ruta antes de tocarse.** La [propuesta](../meta_first/revisiones/propuesta-enmienda-m26a-diagnostico.md) los enumera; esta spec no concede esa autorización por sí sola. Los nombres exactos de funciones SQL y la biblioteca PDF se fijarán en el plan auditado, sin cambiar el comportamiento aquí definido.

| Archivo o grupo | Cambio previsto | Para qué | Estado de autorización |
|---|---|---|---|
| `supabase/migrations/0022_meta_diagnostics.sql`; `supabase/tests/17_meta_diagnostics.test.sql`; `09_integration_privileges.test.sql`; `10_demo_closure.test.sql` | Nueva y modificados | Persistencia, privilegios, concurrencia, borrado y aislamiento | **REQUIERE CAMBIO EN LA RUTA** |
| `src/modules/diagnostics/`; `src/modules/integrations/db/worker-api.ts` | Nuevo y modificado | Configuración, cálculos, proveedor, búsqueda, orquestación, lectura, PDF y funciones permitidas | **REQUIERE CAMBIO EN LA RUTA** |
| `src/modules/app-data/{index,types}.ts`; `src/app/(app)/app/diagnostico/page.tsx`; `src/app/(app)/app/diagnostico/descargar/route.ts`; `src/components/app/{diagnostico.tsx,diagnostico.module.css}` | Modificados y nuevo | Estado, configuración, generación, informe y descarga | **REQUIERE CAMBIO EN LA RUTA** |
| `tests/unit/diagnostics*.test.ts`; `tests/component/diagnostico*.test.tsx`; `tests/app/meta-diagnostics.test.ts`; `tests/eval/diagnostics-eval.test.ts` y fixtures sintéticos | Nuevos | Contrato, cifras, seguridad, UI, PDF y calidad del modelo | **REQUIERE CAMBIO EN LA RUTA** |
| `package.json`, `package-lock.json`, `.env.example`, `docs/FASES/FASE1/meta_first/entorno.md` | Modificados | PDF, clave del servidor e instrucciones de entorno | **REQUIERE CAMBIO EN LA RUTA** |
| `docs/FASES/FASE1/M03a/acta-meta.md`, `docs/SECURITY.md`, `docs/ARCHITECTURE.md` | Modificados | Nuevo tercero, retención, frontera y módulo vigente | **REQUIERE CAMBIO EN LA RUTA** |
| `docs/FASES/FASE1/meta_first/{plan,spec}.md`; `docs/FASES/FASE1/M26a/{spec,plan}.md`; `docs/FASES/FASE1/meta_first/sesiones/M26a.md`; `docs/HALLAZGOS.md`; `docs/PROJECT_STATE.md` | Documentación y seguimiento | Enmienda aprobada, plan, evidencia y estado real | **REQUIERE CAMBIO EN LA RUTA** |

## Criterios de aceptación

### Heredados de la ruta vigente

No hay CA propio de `M26a` hasta aprobar la enmienda. Se heredan sin alterar para las fuentes reutilizadas: `CA-00/00b` (tenant servidor); `CA-38/38b` (purga, salvo excepción nueva del diagnóstico); `CA-40` (identificador de cuenta); `CA-41–43` (snapshot/cobertura); `CA-44b` (precisión); `CA-47b` (sincronización); catálogo y agregación de §11; `CA-67/68` (baja/cascadas); `CB-05/06` (evidencia y no omitir pruebas). La excepción a `CA-38` exige enmienda de ruta y acta, no se presume aprobada por este borrador.

### Operativos propuestos de M26a

| ID | Criterio verificable | Traza |
|---|---|---|
| M26a-C-01 | Objetivo y métrica elegidos por el dueño se guardan por empresa y se congelan en el informe; otro tenant no los lee ni cambia. | Q6, Q11, CA-00 |
| M26a-C-02 | Sin objetivo, conexión activa o sincronización reciente, la generación se bloquea con motivo específico sin llamar a Claude. | Q23, Q28, Q44 |
| M26a-C-03 | Una nueva generación exige 24 h desde el último informe y una sincronización posterior; fallo no consume plazo. Doble envío concurrente produce a lo sumo una publicación. | Q33, Q37 |
| M26a-C-04 | Cero actividad cubierta produce estado insuficiente sin PDF ni llamada LLM; no cobertura y dato ausente no se convierten en cero. | Q10, Q38, CA-43 |
| M26a-C-05 | Se examinan todos los anuncios con actividad en la ventana, incluidos los hoy pausados; se informa conteo y no se truncan entidades silenciosamente. | Q25, Q29 |
| M26a-C-06 | La ventana es de 28 días; comparación previa solo si hay cobertura y atribución compatibles; parcialidad y días abiertos constan en informe y PDF. | Q8, Q12, Q13 |
| M26a-C-07 | Todas las cifras autoritativas salen del cálculo exacto del servidor; tasas y retorno con denominador cero o base faltante son no calculables; retorno se etiqueta atribuido por Meta. | Q35, §11, AGENTS |
| M26a-C-08 | Desgloses no se cruzan ni reconcilian con totales y se rotulan estimados; no aparecen cohortes de compradores, productos ni ganancia real. | §11, Q1 |
| M26a-C-09 | Claude busca contexto en paso separado y sin datos privados; acepta solo fuentes originales HTTPS con fecha y enlace; su ausencia no bloquea el informe. | Q16, Q22, Q43, Q49 |
| M26a-C-10 | La salida de Claude valida estructura y referencias; sus interpretaciones con poca muestra son hipótesis; ninguna cifra no respaldada se publica como hecho. | Q2, Q24, Q26, Q39, AGENTS |
| M26a-C-11 | Plantilla con secciones fijas, hasta tres oportunidades y motivo «no evaluable» cuando falta evidencia; acciones sugieren pero nunca ejecutan cambios. | Q9, Q14, Q48, INV-07 |
| M26a-C-12 | La publicación reemplaza y borra el informe anterior atómicamente; un fallo o cero actividad conserva el anterior. No hay historial visible. | Q15, Q18, Q27, Q47 |
| M26a-C-13 | Desconexión conserva informe en base pero impide verlo/descargarlo; baja de empresa lo elimina. | Q42, Q46, CA-67 |
| M26a-C-14 | PDF y pantalla renderizan el mismo informe; PDF trae procedencia, cobertura y fuentes, nunca credenciales ni ID completo de cuenta. | Q19, CA-40 |
| M26a-C-15 | Solo el dueño autenticado de la empresa puede configurar, generar, leer y descargar; URL y argumentos no aceptan `company_id` del navegador. | CA-00/00b, AGENTS |
| M26a-C-16 | Acta, SECURITY y ARCHITECTURE declaran Anthropic, búsqueda, retención, excepción de borrado y control vigente antes del primer dato real. | Q32, contrato documental |
| M26a-C-17 | Evaluación real de Anthropic con fixtures congelados y revisión visible del usuario de PDFs sintéticos; sin actividad real, el gate no declara valor comercial validado. | Q30, Q34, CB-05/06 |

## Casos de prueba

Las pruebas de comportamiento se escriben en rojo antes del código; las documentales y la revisión visual no requieren rojo. Ningún fixture contiene datos reales.

| ID | Criterios | Tipo y comando | Resultado esperado | Rojo previo |
|---|---|---|---|---|
| M26a-T-01 | C-01, C-15 | unit `npm run test:unit -- tests/unit/diagnostics-goal.test.ts` | Objetivo tipado; acción desconocida y tenant del cliente rechazados. | Sí |
| M26a-T-02 | C-01, C-15 | pgTAP `npm run test:policies` | RLS, grants y RPC exactos; rol ajeno/anon no leen ni escriben. | Sí |
| M26a-T-03 | C-02, C-03 | app `npm run test:app` | Sin objetivo, conexión o sync fresca no crea reserva ni llama proveedor. | Sí |
| M26a-T-04 | C-03, C-12 | app `npm run test:app` | Dos generaciones concurrentes y reintento con mismo request ID dejan un solo vigente. | Sí |
| M26a-T-05 | C-03, C-12 | pgTAP `npm run test:policies` | Publicación y borrado atómicos; fallo mantiene informe anterior byte a byte. | Sí |
| M26a-T-06 | C-04, C-12 | unit `npm run test:unit -- tests/unit/diagnostics-evidence.test.ts` | Cero cubierto no llama LLM; sin cobertura se informa distinto. | Sí |
| M26a-T-07 | C-05, C-06 | unit `npm run test:unit -- tests/unit/diagnostics-evidence.test.ts` | Incluye pausados con actividad, días abiertos y parcialidad por nivel. | Sí |
| M26a-T-08 | C-05 | unit `npm run test:unit -- tests/unit/diagnostics-evidence.test.ts` | Con muchos anuncios hay lotes completos y manifiesto; fallo de lote no publica. | Sí |
| M26a-T-09 | C-06, C-07 | app `npm run test:app` | SQL→Data API→TS conserva decimal exacto y períodos de 28 días. | Sí |
| M26a-T-10 | C-07, C-08 | unit `npm run test:unit -- tests/unit/diagnostics-metrics.test.ts` | No suma reach/tasas/niveles ni atribuciones incompatibles; denominador cero no calcula. | Sí |
| M26a-T-11 | C-07 | unit `npm run test:unit -- tests/unit/diagnostics-metrics.test.ts` | Retorno solo con acción/valor y moneda válidos; se rotula Meta atribuido. | Sí |
| M26a-T-12 | C-08 | unit `npm run test:unit -- tests/unit/diagnostics-evidence.test.ts` | Desgloses estimados, sin cruce prohibido ni falso total. | Sí |
| M26a-T-13 | C-09 | unit `npm run test:unit -- tests/unit/diagnostics-web.test.ts` | Consulta genérica sin datos privados, dominios/URL/fecha validados; fallo omite contexto. | Sí |
| M26a-T-14 | C-09, C-10 | eval `npm run test:eval -- tests/eval/diagnostics-eval.test.ts` | Búsqueda con citas y generación JSON se ejecutan en llamadas separadas. | Sí |
| M26a-T-15 | C-10, C-11 | unit `npm run test:unit -- tests/unit/diagnostics-contract.test.ts` | Secciones, referencias y 0–3 oportunidades; cita inventada rechazada. | Sí |
| M26a-T-16 | C-10 | unit `npm run test:unit -- tests/unit/diagnostics-contract.test.ts` | Cifra libre sin soporte, salida truncada y hecho sin evidencia impiden publicación. | Sí |
| M26a-T-17 | C-11 | eval `npm run test:eval -- tests/eval/diagnostics-eval.test.ts` | Casos sintéticos de ganadores, baja muestra, sin acción objetivo, cobertura parcial y sin comparación. | Sí |
| M26a-T-18 | C-12, C-13 | pgTAP `npm run test:policies` | Desconexión conserva informe sin FK; borrado de empresa/cierre lo elimina. | Sí |
| M26a-T-19 | C-13, C-15 | app `npm run test:app` | Desconectado, ajeno y sin sesión no leen ni descargan PDF. | Sí |
| M26a-T-20 | C-14 | unit `npm run test:unit -- tests/unit/diagnostics-pdf.test.ts` | PDF válido, texto es-AR, páginas largas, cifras/fuentes iguales a pantalla. | Sí |
| M26a-T-21 | C-02, C-04, C-11, C-12 | component `npm run test:component -- tests/component/diagnostico.test.tsx` | Configuración, espera 24 h, parcial, cero, error y reemplazo visibles. | Sí |
| M26a-T-22 | C-15 | app `npm run test:app` | Empresa manipulada, actor ajeno y carrera de desconexión bloqueados. | Sí |
| M26a-T-23 | C-16 | documental, `rg` y diff | Acta, SECURITY y ARCHITECTURE solo cambian propiedades previstas; no hay secretos ni datos reales. | No aplica |
| M26a-T-24 | C-17 | eval `npm run test:eval -- tests/eval/diagnostics-eval.test.ts` | Modelo real, sin saltos por configuración; precisión de hechos y referencias documentada. | No aplica |
| M26a-T-25 | C-17, C-14 | manual | Usuario revisa PDFs sintéticos y recorrido real sin actividad; registra aprobación o defectos. | No aplica |

## Verificación

Por etapa: `npm run verify`, `npm run db:check:test`, `npm run test:policies` y `npm run test:app` cuando el esquema esté aplicado al proyecto desechable. Etapa .2 y final: `npm run test:eval -- tests/eval/diagnostics-eval.test.ts` con Anthropic real y fixtures sintéticos, sin omitir por ausencia de configuración. Al cierre: repetir suites completas, inspeccionar PDF y recorrido manual, revisar diff, documentar comandos y resultados en `sesiones/M26a.md`. `npm run verify` no incluye pgTAP, app ni eval (`meta_first/plan.md:866-888`). Nunca ejecutar pruebas contra producción ni `db:push` desde el asistente.

## Intervenciones del usuario y acciones reservadas

| Momento | Acción del usuario | Evidencia posterior |
|---|---|---|
| Antes de aprobar spec/plan | Aprobar enmienda de ruta, incluida la excepción al límite de 8 h, el borrado irreversible puntual y la retención tras desconexión; aprobar spec y plan tras auditorías | Estado y hash aprobados, sin inferir aprobación de silencio. |
| Antes de eval real | Crear/configurar cuenta de Anthropic y cargar `ANTHROPIC_API_KEY` localmente, sin pegar valor en chat | Presencia por nombre y `test:eval`, sin inspeccionar secreto. |
| Antes de datos reales a Anthropic | Aprobar acta M03a actualizada e informar al dueño nuevo destino, retención y búsqueda web | Registro redactado de comunicación y aprobación. |
| Migración | Ejecutar `npm run db:push:test` en desechable cuando el plan lo indique y, tras controles, `db:push` en `app`; no compartir URLs ni secretos | Versiones aplicadas y pruebas con destino guardado. |
| Publicación y gate | Publicar/desplegar según la ruta, revisar PDFs sintéticos, recorrer estados en app y aprobar o rechazar `G-DIAG` | Sesión con resultados y limitación de cuenta vacía. |

## Trampas y riesgos

- La cuenta piloto no tiene actividad; un PDF sintético no demuestra valor comercial. No se siembra un reporte ficticio en `app` como si fuera real.
- El `reports` genérico exige contexto versionado; reutilizarlo sin pantalla de contexto introduciría un bloqueo artificial. La persistencia Meta específica no debe crear una segunda autoridad para cifras ni dejar un reporte listo ilegible.
- La retención tras desconexión contradice el contrato vigente hasta enmendarlo. El informe retenido no puede tener FK en cascada a la conexión; aun así debe borrarse al cerrar la empresa.
- Una publicación concurrente o una desconexión durante la generación no puede mostrar el informe equivocado ni borrar el anterior. El borrado irreversible requiere transacción y evidencia.
- Claude puede formular una lectura equivocada con cifras correctas. Las cifras y referencias se validan estructuralmente; la calidad interpretativa requiere eval y revisión humana.
- Los nombres de entidades y páginas web son texto no confiable, potencialmente instrucciones. No se ejecutan ni pueden elegir SQL, herramientas o política. El buscador no recibe datos privados, aunque el dominio permitido sea oficial.
- La API de Anthropic no combina citas web con JSON estricto en una llamada. La búsqueda puede fallar con HTTP 200 y error interno; verificar el cuerpo y continuar sin contexto.
- El ID fijo del modelo puede cambiar de comportamiento; guardar ID reportado y repetir eval antes de la demo. Cambiar proveedor o relajar una guarda requiere nueva decisión y documentación.
- Un PDF descargado por el dueño subsiste fuera de PRAXA; borrar el informe de la base no lo revoca. Copias nocturnas de Supabase pueden retener el dato hasta su plazo declarado.

## Decisiones de la microfase

Decididas por el usuario en el grill de esta conversación el 2026-11-11; los Q remiten a esas rondas. Son decisiones de producto **propuestas**, pendientes de integración y aprobación formal de la ruta.

| IDs | Decisión |
|---|---|
| Q1–Q5 | Meta Ads solamente; recomendaciones concretas; generación manual/versionada; Anthropic; antes de demo. |
| Q6–Q10 | Objetivo confirmado por dueño; comparación propia y contexto web a evaluar; 28 días; plantilla fija; con cuenta vacía indicar insuficiencia. |
| Q11–Q15 | Objetivo por empresa, comparación anterior si hay cobertura, informe parcial, posibles sugerencias sobre inversión, un solo informe visible. |
| Q16–Q21 | Web original opcional; borrar viejo de base; conservar ante fallo; PDF; parcial sin acción; calidad del modelo. |
| Q22–Q26 | Fuentes originales, bloqueo por sync vieja, hipótesis de baja muestra, todos los anuncios activos en período aunque hoy pausados, plan de comprobación por recomendación. |
| Q27–Q30 | Excepción de borrado irreversible; sync <24 h; evidencia estructurada de todo el conjunto; gate técnico con cuenta vacía. |
| Q31–Q34 | Una microfase excepcional por etapas; retención estándar de Anthropic aceptada; nuevo diagnóstico solo con nueva sync y ≥24 h; revisión del usuario de PDFs. |
| Q35–Q39 | Retorno atribuido rotulado; etapas; 24 h completas y sync posterior; cero actividad sin informe; recomendaciones exploratorias etiquetadas. |
| Q40–Q49 | Después de `G-CHAT`; Claude solo para diagnóstico; el informe se conserva tras desconexión pero no se ve/descarga; búsqueda web por Claude; objetivo requerido; viejo permanece si nueva ventana está vacía; hasta tres oportunidades; consultas web genéricas elegidas por seguridad. |

## Supuestos e hipótesis

| ID | Hipótesis y prueba |
|---|---|
| M26a-H-01 | **HIPÓTESIS:** `0022` y pgTAP `17` siguen libres al cerrar `G-CHAT`; verificar `git status`, migraciones y pruebas antes de aprobar el plan. `0021` aparece en el árbol actual como cambio preexistente del usuario. |
| M26a-H-02 | **HIPÓTESIS:** el catálogo de acciones de la cuenta activa permite elegir y validar un tipo representativo de compras o consultas. La cuenta piloto sin actividad no lo demuestra; probar con fixtures y primera sincronización real con filas. |
| M26a-H-03 | **HIPÓTESIS:** la preparación y los lotes completos caben en tiempo/límites del hosting y la API en el tamaño objetivo. Medir antes de fijar timeout y topes; si no cabe, no truncar en silencio ni declarar gate aprobado. |
| M26a-H-04 | **HIPÓTESIS:** `claude-sonnet-5-5` satisface estructura y calidad del fixture congelado. Medir con Anthropic real antes del gate; un cambio de modelo exige actualizar la spec/acta si altera el destino o el tratamiento. |
| M26a-H-05 | **HIPÓTESIS:** la biblioteca PDF elegida renderiza acentos y párrafos largos sin corte en el runtime de Vercel. Probar PDF por contenido y vista visual antes de aprobar. |

## Preguntas abiertas

| ID | Pregunta | Opciones y recomendación | Evidencia |
|---|---|---|---|
| M26a-Q-01 — **REQUIERE CAMBIO EN LA RUTA** | ¿Se aprueba e integra la enmienda de M26a con archivos, gate, excepciones, retención y Anthropic? | Aprobar o revisar. Recomendación: revisar la propuesta, integrar solo el texto aprobado y después auditar esta spec contra la ruta vigente. | Ruta vigente `plan.md:68-118`; `spec.md:39-46,285-296`. |
| M26a-Q-02 — **BLOQUEO DE ENTRADA** | ¿Está aprobado `G-CHAT` con la evidencia exigida? | Cerrar conforme al plan o mantener M26a sin ejecutar. Recomendación: no iniciar con gate pendiente. | `PROJECT_STATE.md:29`. |

Las demás decisiones de producto del grill están cerradas. Las hipótesis son verificaciones, no decisiones pendientes del usuario.

## Hallazgos relacionados

- `H-E1-189`: validación de campos de Meta con filas reales diferida; limita la interpretación de acciones de una cuenta vacía.
- `H-E1-221`, `H-E1-224`, `H-E1-228`: VR-02 y cambios del chat; no se heredan como aprobación del diagnóstico. `G-CHAT` permanece pendiente hasta su cierre formal.
- `H-E1-93`: el contexto declarado de reportes quedó sin pantalla al quitar onboarding; por eso M26a configura un objetivo ligero y no usa el contrato genérico.

## Auditorías

Ninguna todavía. Ejecutar `$spec-auditor M26a` solo cuando la propuesta de ruta esté integrada y el texto de esta spec coincida con su ficha y Parte II aprobadas.
