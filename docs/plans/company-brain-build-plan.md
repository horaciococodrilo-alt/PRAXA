# Praxa Company Brain v0 — plan de construcción

**Horizonte:** 24 semanas.  
**Fuente técnica:** `docs/architecture/company-brain-spec.md`.  
**Regla:** este plan ordena la implementación, pero no puede modificar la especificación.

## Estrategia

Construir cortes verticales verificables. Al final de cada milestone debe existir una demostración integrada, aunque sea pequeña. No terminar todos los subsistemas por separado antes de integrarlos.

## Milestones

| Milestone | Semanas | Resultado verificable |
|---|---:|---|
| M0 — Fundación | 1–2 | Repo, Compose, CI, configuración, tenancy y RLS skeleton |
| M1 — Evidencia | 3–5 | Import, versiones crudas, sync runs y evidence store |
| M2 — Estado canónico | 6–8 | Normalizers, entities, refs y observations |
| M3 — Entity resolution | 9–10 | Exact matches, candidatos, merge y split reversible |
| M4 — Conocimiento | 11–14 | Facts, policies, bitemporalidad, review, conflicts y gaps |
| M5 — Retrieval y contexto | 15–18 | Exact/FTS/vector/relations/time, answerability y ContextPacket |
| M6 — UX y seguridad | 19–21 | Coverage, sources, entities, search, review, audit y RLS suite |
| M7 — Evaluación y entrega | 22–24 | Gold set, hard gates, documentación, deploy y demo final |

## M0 — tickets autorizables primero

### CB-001 — Monorepo y tooling

Aceptar cuando backend y frontend levantan, existen pruebas mínimas y lint/test/build corren en CI.

### CB-002 — PostgreSQL 16 + pgvector

Aceptar cuando Docker Compose tiene healthcheck y una migración habilita extensiones aprobadas.

### CB-003 — Configuración y secretos

Aceptar cuando `.env.example` funciona, faltantes fallan con mensajes claros y secret scanning está configurado.

### CB-004 — Tenants, principals y memberships

Aceptar cuando dos tenants y roles mínimos pueden crearse con datos sintéticos.

### CB-005 — Request context y RLS skeleton

Aceptar cuando pruebas demuestran default deny sin tenant y aislamiento entre dos tenants.

### CB-006 — Telemetría base

Aceptar cuando requests y jobs comparten `trace_id` en logs JSON.

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

## Desarrollo comercial paralelo

La validación de la startup ocurre en paralelo y no modifica el backlog sin decisión humana:

- entrevistas de problema;
- observación de flujos;
- recopilación de casos y artefactos;
- selección de una cuña;
- concierge o Wizard-of-Oz;
- compromisos de datos, tiempo y piloto.

El Company Brain académico puede terminar correctamente incluso si la hipótesis comercial cambia.
