# Praxa Company Brain v0 — plan de construcción

**Fuente técnica:** `docs/architecture/company-brain-spec.md`.

**Decisiones aplicables:** ADR-011, ADR-012 y ADR-013.

**Regla:** este plan ordena la implementación, pero no puede modificar la especificación.

## Estrategia

Company Brain v0 se construye como un **único corte vertical** de divergencia y riesgo de sobreventa de inventario, no como una plataforma horizontal. Al final de cada fase debe existir una demostración integrada, aunque sea pequeña. No terminar todos los subsistemas por separado antes de integrarlos.

Regla rectora:

> Future-compatible, no future-built.

## Fases

| Fase | Resultado demostrable | Horas humanas |
|---|---|---:|
| R0 | Fuentes de verdad, ADR, roadmap y CI alineados | 10–16 |
| VS-01 | PostgreSQL, extensiones, tenancy, membership, roles y RLS verificables | 20–30 |
| VS-02 | Fuentes y documentos se ingieren con evidencia, chunks, embeddings y ACL sin duplicar | 30–45 |
| VS-03 | Variante, observaciones, política aprobada y detector determinístico funcionan | 28–42 |
| VS-04 | Retrieval autorizado y Context Compiler producen un ContextPacket citado y reproducible | 35–50 |
| VS-05 | API, agente y skill investigan y registran una propuesta sin ejecutar | 28–42 |
| VS-06 | Una persona revisa el expediente y deja una decisión auditada | 25–38 |
| VS-07 | El flujo completo pasa evaluación, hardening y demo reproducible | 25–35 |
| **Subtotal** | | **201–298** |
| **Con contingencia del 20%** | | **241–358** |

Para planificación se usa un punto realista de **aproximadamente 300 horas humanas**, incluida contingencia.

### Calendario por disponibilidad

| Disponibilidad | Optimista (241 h) | Realista (300 h) | Pesimista (358 h) | Veredicto |
|---:|---:|---:|---:|---|
| 8 h/semana | 30,1 semanas | 37,5 semanas | 44,8 semanas | No entra en seis meses |
| 10 h/semana | 24,1 semanas | 30 semanas | 35,8 semanas | Solo entra en el extremo optimista |
| 20 h/semana | 12,1 semanas | 15 semanas | 17,9 semanas | Entra con margen razonable |
| 30 h/semana | 8,0 semanas | 10 semanas | 11,9 semanas | Entra, sujeto a revisión y disponibilidad sostenida |

> Con 8–10 horas semanales, el alcance completo no debe prometerse como entrega de 24 semanas. Para sostener seis meses se necesitan unas 13 horas semanales en el escenario realista, o un recorte explícito posterior basado en evidencia.

Las estimaciones no son compromisos. Se recalibran al terminar R0, VS-02, VS-04 y VS-05 usando horas humanas reales. El tiempo autónomo de un agente no cuenta como hora humana; revisión, corrección, QA, integración y decisiones sí.

## Camino crítico y paralelización

```text
R0 → VS-01 → VS-02 → VS-03 → VS-04 → VS-05 → VS-06 → VS-07
```

Paralelización segura:

- los fixtures y casos de evaluación pueden diseñarse junto con VS-02 y VS-03;
- la interfaz de VS-06 puede comenzar contra un `ContextPacket` mockeado cuando VS-04 congele el schema;
- la revisión independiente puede correr en cada fase.

No debe paralelizarse:

- dos agentes editando la misma rama;
- VS-03 antes de que VS-02 fije identidad y evidencia;
- VS-04 antes de que la política efectiva tenga selección determinística;
- VS-05 antes de que ContextPacket y autorización estén probados.

---

## R0 — Reconciliación de la fuente de verdad

**Objetivo:** lograr que spec, ADR, ticket, roadmap, README, ownership y reglas de agentes describan el mismo MVP vertical.

**Dependencias:** aprobación humana de los borradores de ADR y del contenido de `current.md`; working tree local inspeccionado.

**Entregables:** ADR-011, ADR-012 y ADR-013; índice ADR actualizado; enmiendas focalizadas de spec, brief, `AGENTS.md`, ownership y README; build plan vertical; `current.md` actualizado; bootstrap obsoleto archivado; CI endurecida; registro de horas humanas.

**Migraciones:** ninguna.

**Verificaciones:** búsqueda de referencias rotas y frases contradictorias; `git diff --check`; verificación funcional equivalente a `make ci`; validación de que un PR genera una sola corrida por commit; revisión independiente de documentos y workflow.

**Criterios de aceptación:** no quedan dos definiciones activas del MVP; no se reescribe ninguna ADR aceptada; VS-01 no queda autorizado automáticamente; CI y documentación dicen la verdad sobre los comandos ejecutados.

**Exclusiones:** código funcional, dependencias, servicios y datos.

**Estimación:** 10–16 horas humanas.

---

## VS-01 — Fundación de datos, seguridad y contratos

**Objetivo:** demostrar aislamiento de datos desde la primera tabla y fijar la frontera de persistencia.

**Dependencias:** R0 fusionado y VS-01 autorizado; ADR corta sobre SQLAlchemy sync o async aprobada antes de crear la sesión.

**Entregables:** Docker Compose con PostgreSQL 16+; extensiones `vector` y `pg_trgm`; FTS nativo; SQLAlchemy 2 y Alembic; configuración tipada; roles SQL separados (owner/migración, y aplicación sin ownership ni `BYPASSRLS`); tablas mínimas `tenant`, `principal`, `tenant_membership` y roles; contexto transaccional derivado del usuario autenticado; `ENABLE`/`FORCE ROW LEVEL SECURITY`; esqueleto versionado de contratos de evidencia y ContextPacket; PostgreSQL como servicio en CI.

**Migraciones:** extensiones; tenancy, principals, memberships y roles; funciones/contexto RLS y policies mínimas.

**Pruebas:** tenant A no lee, inserta ni actualiza filas de B; sin tenant/principal se deniega por defecto; membership inexistente se deniega; rol restringido del mismo tenant no accede al recurso protegido de fixture; la suite afirma que usa el rol de aplicación, no el owner; migración desde base vacía.

**Criterios de aceptación:** el rol de aplicación no es owner ni tiene `BYPASSRLS`; todas las pruebas de aislamiento pasan sobre PostgreSQL real; SQLite no sustituye pruebas de integración o seguridad; configuración ausente falla con error claro y sin imprimir secretos.

**Exclusiones:** evidencia, ingesta, entidades, retrieval, agente, UI y cola.

**Estimación:** 20–30 horas humanas.

---

## VS-02 — Ingesta, evidencia, chunks, embeddings y ACL

**Objetivo:** importar dos fuentes estructuradas y documentos de política conservando identidad, versiones, procedencia, permisos y citas.

**Dependencias:** VS-01; proveedor de embeddings elegido detrás de una interfaz pequeña y fake offline disponible.

**Entregables:** protocolo de fuente y `normalize()` pura; dos adaptadores sintéticos estructurados; importador de documentos sintéticos; `evidence_source`, `source_object`, `evidence_version`, `evidence_chunk`, `import_run`; identidad de origen según ADR-012; tombstones; localizadores citables por documento, sección y offset o JSON pointer; chunking determinístico; embeddings versionados y fake offline; índices FTS y vector; ACL de fuente/evidencia con herencia a chunks; rol de aplicación sin UPDATE/DELETE de evidencia; ingesta síncrona sin cola.

**Pruebas:** reimportar mismo objeto/hash no crea versión; mismo contenido en dos objetos conserva dos identidades; cambio real crea versión nueva; tombstone no reaparece; reconstrucción completa produce estado derivado equivalente; `normalize()` no usa red, DB, reloj ni aleatoriedad; cada chunk conserva un localizador válido; la ACL de evidencia se hereda al chunk; el rol de aplicación no actualiza ni elimina evidencia; fixtures sin datos reales.

La prueba completa de que un chunk oculto no aparece por FTS/vector pertenece a VS-04. En VS-02 solo se prueba almacenamiento, RLS, ACL e índices.

**Exclusiones:** conectores reales, OAuth, webhooks, jobs, retrieval, agente y UI.

**Estimación:** 30–45 horas humanas.

---

## VS-03 — Memoria canónica, política y detector determinístico

**Objetivo:** resolver la variante, conservar observaciones, activar una policy aprobada y detectar riesgo de sobreventa sin LLM.

**Dependencias:** VS-02.

**Entregables:** normalizadores puros por fuente; `canonical_variant`; `external_entity_ref`; `inventory_observation`; matching exacto por SKU normalizado; cola de revisión para match ambiguo; `inventory_policy_candidate`; `inventory_policy_version`; `valid_time` y `transaction_time` concentrados en las versiones de policy conforme ADR-006; flujo documento → candidato → aprobación → versión activa; vínculo exacto entre policy y evidencia; selección determinística de policy; función tipada de stock vendible; detector de divergencia/riesgo; `detected_conflict`, `knowledge_gap` y `case`; estados `unknown`, `zero`, `not_received`, `stale` y `conflicted` diferenciados.

**Pruebas:** normalización de SKU con ceros, símbolos y mayúsculas; la ambigüedad nunca produce auto-match; policy seleccionada por tenant, aprobación, alcance y fecha; consulta `as_of`/`known_at` respeta ambas dimensiones temporales; policy superseded responde correctamente para una fecha histórica; solapamiento inválido se rechaza o queda explícitamente conflicted; cálculo de stock con property tests; `unknown` no se convierte en cero; el detector encuentra todos los casos sembrados; LLM ausente del camino de cálculo y autoridad.

**Criterios de aceptación:** la policy efectiva nunca se elige por FTS, vector o LLM; cada policy activa tiene reviewer o fixture aprobado y cita; la salida determinística explica las dependencias del cálculo.

**Exclusiones:** matching probabilístico, facts universales, policy DSL, motor de reglas, segunda familia de casos y agente.

**Estimación:** 28–42 horas humanas.

---

## VS-04 — Retrieval autorizado, Context Compiler y ContextPacket

**Objetivo:** producir el payload de contexto mínimo, autorizado, citado y reproducible para la investigación de inventario.

**Dependencias:** VS-03 y ADR-013 aceptada.

**Entregables:** exact match por SKU/ID; consultas SQL de estado y policy; canal FTS; canal vectorial; ranking, límites y dedupe dentro de canales; filtros por tenant, principal, membership, rol, scope, entidad y vigencia antes del retrieval; reautorización de citas; detección de stale, conflicts y gaps; `InventoryContextPayloadV1`; `ContextExecutionEnvelopeV1`; hash canónico del payload; Context Compiler como orquestador determinístico; dataset inicial de retrieval y citas.

**Payload mínimo:** pregunta normalizada; entidad resuelta; observaciones por fuente y fecha; policy efectiva con versión, vigencia y cita; resultados determinísticos; conflictos y gaps; evidencia autorizada; answerability; capacidades permitidas y límites.

**Envelope mínimo:** request ID; trace ID; timestamps; versión de compiler; modelo/prompt/skill cuando aplique; métricas operativas.

**Pruebas:** un principal no autorizado no recupera chunk por exacto, SQL, FTS ni vector; un chunk oculto no cambia ranking, answerability ni payload; toda cita abre versión y localizador correctos; la policy estructurada elegida coincide con la cita documental; mismo estado produce mismo payload/hash; el envelope cambia sin invalidar la reproducibilidad del payload; `partial`, `conflicted` y `unknown` se generan con fixtures separados; el presupuesto de contexto nunca elimina todas las citas de una afirmación incluida.

**Criterios de aceptación:** no existe RRF global; ningún contenido no autorizado influye; toda afirmación material tiene cita o dependencia determinística; el payload declara explícitamente lo que falta.

**Exclusiones:** clasificador general de intención, RRF, reranker aprendido, packet multidominio, agente y MCP.

**Estimación:** 35–50 horas humanas.

---

## VS-05 — Brain API, agente y skill versionada

**Objetivo:** demostrar que un agente puede investigar el caso usando solo capacidades autorizadas y registrar una propuesta estructurada.

**Dependencias:** VS-04; proveedor/modelo concreto aprobado; límites de costo y tiempo definidos.

**Entregables:** REST `/api/v1`; endpoints de entidad, contexto y propuesta; tool surface `resolve_inventory_entity`, `get_inventory_context` y `create_resolution_proposal`; autorización por llamada; un proveedor de modelo detrás de una interfaz pequeña; fake del modelo para tests; prompt, modelo y skill versionados; `investigate_inventory_divergence` v1; salida estructurada validada; límite de tool calls, tokens, tiempo y presupuesto; timeout y retry acotado; registro de fallos y abstenciones; `resolution_proposal` append-only; trazas de input, tools, payload hash, modelo, prompt, skill, respuesta y citas; suite de prompt injection.

**Pruebas:** el agente no tiene acceso a DB; un tool call no autorizado se rechaza; el límite de llamadas se respeta; timeout y retry terminan de forma segura; evidencia insuficiente produce abstención; un documento con prompt injection no cambia herramientas, permisos ni policy; los valores comunicados coinciden exactamente con los tool outputs; una respuesta estructurada inválida se rechaza; la propuesta queda marcada como no ejecutada; el fake hace la suite offline y determinística.

**Criterios de aceptación:** ninguna afirmación material carece de cita o salida determinística; el agente nunca decide policy ni permisos; costos y límites quedan trazados; no existe abstracción multivendor.

**Exclusiones:** MCP, segunda skill, memoria entre ejecuciones, autonomía, multiagente y escrituras externas.

**Estimación:** 28–42 horas humanas.

---

## VS-06 — Revisión humana, decisiones y auditoría

**Objetivo:** permitir que una persona entienda el expediente, acepte, corrija o descarte la propuesta y deje una decisión auditable.

**Dependencias:** VS-05; schema de ContextPacket estable.

**Entregables:** lista y detalle de casos; valores por fuente y fecha; policy con versión, vigencia y evidencia; cálculo y dependencias; respuesta y propuesta del agente; citas clicables al localizador; gaps e incertidumbre visibles; acciones internas de confirmar, corregir, descartar, marcar fuente incorrecta, marcar policy incorrecta y solicitar evidencia; `review_decision` append-only; audit timeline; estados `unknown`, `stale` y `conflicted`; accesibilidad básica del flujo crítico.

**Pruebas:** toda decisión registra actor, contenido, motivo y tiempo; dos reviewers no pisan una decisión silenciosamente; las citas abren la evidencia correcta; un principal no autorizado no ve caso ni evidencia; los estados especiales son distinguibles; una corrección no activa policy ni entrena modelos; el flujo crítico funciona por teclado y con etiquetas accesibles.

**Criterios de aceptación:** una persona ajena a la implementación comprende el expediente; propuesta y decisión se distinguen; la auditoría reconstruye consulta, respuesta y decisión.

**Exclusiones:** dashboard ejecutivo, exportaciones, búsqueda global, design system completo y aprendizaje desde feedback.

**Estimación:** 25–38 horas humanas.

---

## VS-07 — Evaluación, hardening y entrega reproducible

**Objetivo:** cerrar el MVP con evidencia cuantitativa, seguridad adversarial y una demo desde checkout limpio.

**Dependencias:** VS-06.

**Entregables:** dataset versionado con seis clases (positivo, negativo, ambiguo, obsoleto, restringido e insuficiente); evaluaciones separadas de entity resolution, policy selection, cálculo, retrieval, citas, answerability, permisos e idempotencia; Playwright E2E; pruebas adversariales de RLS, ACL y prompt injection; instalación y seed desde checkout limpio; guion de demo; documentación operativa; límites, deuda y riesgos residuales; criterio go/no-go del MVP.

**Gates duros:**

1. cero fuga entre tenants;
2. denegación sin contexto;
3. contenido no autorizado no se recupera ni influye;
4. la reingesta no crea duplicados semánticos ni versiones falsas;
5. tombstone no reaparece;
6. policy correcta para fecha y scope;
7. cálculo reproducible sin LLM;
8. toda afirmación material tiene cita o salida determinística;
9. las citas abren la evidencia exacta;
10. evidencia insuficiente produce abstención;
11. prompt injection no cambia permisos, tools ni policy;
12. propuesta y decisión quedan trazadas;
13. la demo corre desde seed limpio.

Los umbrales de calidad son targets provisionales acompañados por dataset, baseline y método; no son garantías sin evidencia.

**Exclusiones:** despliegue productivo, datos reales, SLA comercial, conectores productivos y nuevas features.

**Estimación:** 25–35 horas humanas.

---

## Regla de recorte

Los recortes se deciden en un gate de planificación, nunca de forma silenciosa. Orden recomendado si el proyecto se atrasa:

1. pulido visual no esencial;
2. cantidad de casos del dataset, conservando todas las clases críticas;
3. detección sofisticada de stale, manteniendo al menos freshness explícita;
4. búsqueda FTS, solo si exacto + SQL + vector cumplen los casos y se documenta la pérdida;
5. permisos por rol dentro del tenant; si se quitan, el producto deja de llamarse permission-aware y se mantiene el aislamiento por tenant.

No se recorta nunca:

- aislamiento entre tenants;
- política seleccionada determinísticamente;
- evidencia y citas con localizadores;
- idempotencia por objeto de origen;
- cálculos determinísticos;
- abstención ante evidencia insuficiente;
- ausencia de influencia de contenido no autorizado;
- propuesta separada de acción;
- decisión humana auditada.

## Track de proceso opcional — skills de desarrollo

`praxa-deliver-ticket` y `praxa-review-ticket` pueden empaquetar los prompts existentes si el entorno real de Claude o Codex demuestra que eso reduce errores. No constituyen una fase del producto, no bloquean VS-01 y no deben confundirse con `investigate_inventory_divergence`.

Si se autorizan: estimar 3–5 horas humanas, mantener implementador y revisor distintos, y no duplicar reglas entre `AGENTS.md`, prompts y skills.

## Gates de alcance

Antes de agregar un componente opcional:

1. Identificar el criterio actual que no puede cumplirse.
2. Mostrar evidencia medida del cuello de botella.
3. Comprobar que PostgreSQL o el código existente no bastan.
4. Registrar operación, falla y superficie de seguridad añadidas.
5. Explicar qué se elimina o retrasa para compensar.

## Decisiones explícitas

- Redis solo ante un cuello medido de la queue.
- Neo4j solo si edges/CTEs fallan contra un caso real.
- Vector DB dedicada solo si pgvector falla contra evals/SLO.
- Temporal solo ante workflows largos reales.
- MCP solo después de REST y auth estables; read-only primero.
- Multiagente solo después de demostrar mejora neta.
- Aprendizaje autónomo de reglas nunca en v0.
- RRF global solo si una evaluación con dataset versionado demuestra mejora neta sin romper seguridad.

## Desarrollo comercial paralelo

La validación de la startup ocurre en paralelo y no modifica el backlog sin decisión humana:

- entrevistas de problema;
- observación de flujos;
- recopilación de casos y artefactos;
- selección de una cuña;
- concierge o Wizard-of-Oz;
- compromisos de datos, tiempo y piloto.

El Company Brain académico puede terminar correctamente incluso si la hipótesis comercial cambia.
