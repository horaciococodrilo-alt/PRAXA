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
