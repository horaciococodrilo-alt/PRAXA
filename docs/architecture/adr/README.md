# Architecture Decision Records

Los ADR documentan decisiones arquitectónicas importantes. No son ideas generadas libremente por un agente.

## Estados

- `Proposed`: propuesta pendiente de aprobación humana.
- `Accepted`: decisión aprobada y reflejada en la especificación.
- `Superseded`: reemplazada por otro ADR.
- `Rejected`: considerada y descartada.

## Regla

Si un ADR aceptado cambia el comportamiento de `company-brain-spec.md`, ambos deben actualizarse en el mismo cambio. Ante contradicción, detener implementación.

## ADR registrados

| ADR | Decisión | Estado |
|---|---|---|
| ADR-001 | Monolito modular | Accepted |
| ADR-002 | PostgreSQL como núcleo | Accepted |
| ADR-003 | Tablas de edges, no graph DB | Accepted |
| ADR-004 | Job queue en PostgreSQL | Accepted |
| ADR-005 | Evidencia append-only | Accepted |
| ADR-006 | Bitemporalidad selectiva | Accepted |
| ADR-007 | LLM solo para no determinismo necesario | Accepted |
| ADR-008 | Retrieval híbrido | Accepted |
| ADR-009 | MCP después de REST estable | Accepted |
| ADR-010 | Escrituras externas fuera de v0 | Accepted |
| ADR-011 | Corte vertical del Company Brain de inventario | Accepted |
| ADR-012 | Append-only operacional, identidad de origen, retención y borrado | Accepted |
| ADR-013 | Retrieval segmentado autorizado y autoridad determinística de políticas | Accepted |
| ADR-014 | Sesiones síncronas de SQLAlchemy con `psycopg` | Accepted |

ADR-013 refina el alcance v0 de ADR-008 sin enmendarla ni reescribir su historia.

ADR-011 precisa el alcance de ADR-010 sin enmendarla: «skills ejecutables» en ADR-010 designa el runtime genérico de skills con efectos sobre sistemas externos, no la skill de producto única `investigate_inventory_divergence`, que no produce ninguna escritura externa. La distinción está en el glosario de `company-brain-spec.md`. ADR-010 sigue vigente: Company Brain v0 no modifica sistemas externos.

## Plantilla

```markdown
# ADR-XXX — Título

Status: Proposed
Date: YYYY-MM-DD

## Context

## Decision

## Consequences

## Alternatives considered

## Revisit when
```
