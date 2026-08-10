# ADR-011 — Corte vertical del Company Brain de inventario

**Status:** Accepted<br>
**Date:** 2026-08-10

## Context

La especificación actual describe un Company Brain amplio con evidencia, estado canónico,
facts, policies, retrieval, ContextPacket, UI y evaluación. Una interpretación posterior
propuso recortar pgvector, retrieval, ContextPacket y agente para reducir riesgo de entrega.

Ese recorte produciría un reconciliador de inventario auditable, pero no demostraría la
hipótesis central de PRAXA: compilar conocimiento empresarial gobernado para que una IA
pueda investigar y proponer con evidencia, permisos y límites.

Construir horizontalmente toda la arquitectura también excede el tiempo disponible.

## Decision

Company Brain v0 se implementará como un único corte vertical de divergencia y riesgo de
sobreventa de inventario.

El flujo obligatorio es:

```text
dos fuentes sintéticas estructuradas + documento sintético de política
→ evidencia y versiones
→ variante y observaciones canónicas
→ política estructurada aprobada y vigente
→ retrieval autorizado
→ Context Compiler
→ ContextPacket de inventario
→ API controlada
→ un agente
→ investigate_inventory_divergence v1
→ propuesta interna
→ revisión humana y auditoría
```

### Componentes obligatorios

- PostgreSQL con RLS, FTS y pgvector.
- Evidencia append-only, chunks, embeddings, procedencia y localizadores citables.
- Tablas específicas de inventario.
- Matching exacto por SKU; ambigüedad visible y revisable.
- Política estructurada versionada, aprobada y vinculada a evidencia.
- Cálculos de inventario determinísticos.
- ContextPacket tipado, versionado y específico del dominio.
- Un único agente detrás de una interfaz de herramientas pequeña.
- Una skill de producto versionada: `investigate_inventory_divergence`.
- Abstención, propuestas, revisión humana y auditoría.

### Interfaz del agente

La interfaz preferida tiene tres capacidades:

```text
resolve_inventory_entity
get_inventory_context
create_resolution_proposal
```

El Context Compiler orquesta internamente SQL, retrieval, autorización, selección de
política, cálculos y citas. El agente no accede a PostgreSQL.

### Límite determinístico

El LLM puede comunicar valores recibidos de herramientas determinísticas, pero no
calcularlos, originarlos ni convertirse en su fuente autoritativa.

El LLM no decide tenant, permisos, política activa, matches de identidad, publicación
de conocimiento ni acciones externas.

### Escrituras

No se realizan escrituras en sistemas empresariales externos.

Se permiten escrituras internas limitadas, append-only y auditadas para:

- propuestas del agente;
- decisiones humanas;
- trazas y eventos de auditoría.

Una propuesta nunca se presenta como una acción ejecutada.

### ContextPacket

El contrato separa:

- un payload determinístico y hasheable;
- un envelope de ejecución con request ID, trace ID, timestamps, modelo, prompt, skill
  y metadatos operativos.

Las pruebas de reproducibilidad comparan el payload normalizado.

## Consequences

### Positivas

- El MVP prueba la hipótesis del Company Brain, no solo conciliación.
- La arquitectura es demostrable de extremo a extremo.
- El alcance está limitado a un dominio, una pregunta y una skill.
- El límite determinístico reduce alucinación y facilita pruebas.
- REST permanece como contrato principal y MCP no bloquea.

### Negativas

- El camino crítico es más largo que el de un reconciliador sin agente.
- Embeddings, autorización de retrieval y citas agregan integración.
- La generalización futura requerirá extraer patrones de tablas específicas.
- La demo depende de un dataset sintético bien diseñado.

## Alternatives considered

### Reconciliador determinístico sin retrieval, ContextPacket ni agente

Descartado porque no demuestra el producto planteado.

### Arquitectura horizontal completa

Descartada porque facts universales, DSL, coverage completo, conectores reales y
multiagente no son necesarios para el vertical.

### Framework genérico de agentes

Descartado. Un agente y tres capacidades son suficientes.

### MCP obligatorio

Descartado conforme ADR-009. REST se estabiliza primero.

## v0 scope

- Dominio: inventario.
- Caso: divergencia y riesgo de sobreventa.
- Entidad canónica: variante.
- Dos fuentes estructuradas sintéticas.
- Una familia de políticas de inventario.
- Una skill y un agente.
- Propuesta interna, sin acción externa.

## Deferred

- Ontología empresarial universal.
- Facts genéricos para todos los dominios.
- Policy DSL universal.
- Runtime o registry genérico de skills.
- Multiagente.
- Memoria persistente del agente.
- Conectores productivos.
- OAuth productivo.
- MCP.
- Escrituras externas.
- Autonomía y aprendizaje automático desde correcciones.

## Revisit when

- El vertical cumple la definición de terminado y sus evaluaciones.
- Un segundo caso de uso exige generalización demostrable.
- Existe evidencia comercial que justifique una acción externa.
- La interfaz de tres herramientas impide una capacidad medida.
