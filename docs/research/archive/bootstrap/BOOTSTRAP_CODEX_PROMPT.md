> **ARCHIVADO Y NO NORMATIVO.** Este prompt corresponde al arranque original del repositorio y
> su primera tarea era `CB-001`, ya fusionado. Se conserva como material histórico. No define
> alcance, no autoriza trabajo y contiene referencias rotas, incluido el Lean Canvas eliminado.
> El alcance vigente está en `docs/architecture/company-brain-spec.md` y `docs/plans/current.md`.

# Prompt maestro para iniciar Praxa con Codex

Copiar desde «Inicio del prompt» hasta «Fin del prompt» y pegarlo en Codex abierto desde la raíz del repositorio.

---

## Inicio del prompt

Estás comenzando a trabajar en el repositorio de **Praxa**, anteriormente llamado AGECI.

Praxa investiga una capa operacional para ecommerce multicanal: convertir datos y conocimiento dispersos en contexto gobernado y, en una etapa futura, permitir trabajo de agentes bajo permisos, aprobaciones y verificación.

El proyecto tiene dos objetivos separados:

1. **Objetivo académico actual:** construir durante seis meses un Company Brain v0 funcional, read-only y demostrable con datos sintéticos.
2. **Hipótesis comercial:** descubrir mediante entrevistas qué excepción operacional recurrente, costosa y cross-system podría comprar un ecommerce. Esta hipótesis sigue sin validar y el código no debe responderla inventando features.

### Reglas de esta primera sesión

- No modifiques archivos todavía.
- No instales dependencias.
- No ejecutes migraciones.
- No hagas commit, push o deploy.
- No conectes servicios externos.
- No conviertas la visión futura en backlog actual.

### Lee en este orden

1. `AGENTS.md`.
2. `README.md`.
3. `docs/product/project-brief.md`.
4. `docs/product/lean-canvas-v6.1.md`.
5. `docs/product/future-vision.md`, tratándolo como no normativo.
6. `docs/product/ageci-to-praxa-context.md`.
7. `docs/architecture/company-brain-spec.md` completo. Si el contexto no alcanza, leé como mínimo las secciones 0–7, 17, 19–25, 27–30 y luego las secciones específicas cuando comience cada ticket.
8. `docs/architecture/adr/README.md` y ADR-001 a ADR-010.
9. `docs/plans/company-brain-build-plan.md`.
10. `docs/plans/current.md`.
11. `docs/team/ownership.md`.
12. La estructura, estado Git y contenido real del repositorio.

### Jerarquía de autoridad

1. Seguridad e invariantes.
2. Especificación maestra.
3. ADR aprobados y reflejados en la especificación.
4. Ticket actual.
5. Build plan.
6. Brief y Lean Canvas como hipótesis.
7. Visión futura y archivo histórico como contexto no normativo.

Si encontrás una contradicción, no la resuelvas silenciosamente: mostrala y proponé opciones.

### Alcance autorizado

El alcance técnico actual es Company Brain v0:

- ingesta y evidencia original inmutable;
- modelo canónico de ecommerce;
- resolución de entidades;
- observaciones separadas de hechos y políticas;
- conocimiento versionado, temporal y gobernado;
- contradicciones y gaps;
- revisión humana;
- retrieval híbrido con ACL;
- ContextPacket citado y answerability;
- coverage, búsqueda, revisión y auditoría;
- tenancy y RLS.

No están autorizados ahora:

- runtime de agentes productivo;
- skills ejecutables;
- Tool Gateway con escrituras reales;
- credenciales dentro del LLM;
- facturación, refunds, stock o ARCA reales;
- multiagentes;
- MCP antes de REST estable;
- microservicios, Redis, Neo4j, vector DB dedicada, Kafka, Temporal o Kubernetes;
- benchmarks entre clientes;
- datos reales de una PyME.

### Arquitectura obligatoria

- Monolito modular.
- Python 3.12+, FastAPI, Pydantic v2.
- SQLAlchemy 2 y Alembic.
- PostgreSQL 16+ con pgvector, FTS y RLS.
- Jobs en PostgreSQL inicialmente.
- React, TypeScript y Vite.
- Lógica determinística para normalización, joins, cálculos, validación, permisos y publicación.
- LLM solamente para extracción o propuestas estructuradas desde texto; nunca publica verdad.
- Evidencia append-only, procedencia y bitemporalidad donde corresponda.
- Tests y documentación dentro de cada cambio.

### Caso canónico

Dos canales reportan stock diferente para la misma variante. Una política aprobada define fuente autoritativa y stock de seguridad. Praxa preserva las observaciones, resuelve la entidad, recupera la política vigente, calcula stock vendible de forma determinística y devuelve contexto citado, sin escribir en sistemas externos.

### Tu primera entrega

Realizá una revisión de preparación y devolvé:

1. Tu comprensión de Praxa en diez puntos como máximo.
2. La diferencia entre visión comercial, Company Brain v0 y ticket actual.
3. Alcance y no-scope exactos.
4. Invariantes que no pueden romperse.
5. Contradicciones, archivos faltantes o decisiones no cerradas.
6. Estado real del repositorio y cambios ajenos que deban preservarse.
7. Plan detallado para `CB-001`, con archivos, dependencias, comandos y tests.
8. Decisiones de CB-001 que requieren confirmación humana.
9. Riesgos de sobreconstrucción, seguridad o bloqueo del equipo.
10. Criterios que usarás para declarar terminado CB-001.

No implementes hasta que yo responda explícitamente que apruebo el plan. Cuando lo apruebe, implementá solamente CB-001, ejecutá la verificación disponible y entregá un reporte; no hagas commit o push salvo que te lo pida.

## Fin del prompt
