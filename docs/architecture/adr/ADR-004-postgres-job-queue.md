# ADR-004 — Job queue en PostgreSQL

**Status:** Accepted  
**Date:** 2026-08-05

## Context

Sync, parsing, embeddings y coverage requieren trabajo asíncrono, pero el volumen inicial es limitado.

## Decision

Usar una tabla de jobs con claim transaccional mediante `FOR UPDATE SKIP LOCKED`, retries limitados y dead-letter visible.

## Consequences

- Sin Redis o broker adicional en v0.
- Enqueue y metadata pueden participar de la misma transacción.
- Los handlers deben ser idempotentes.

## Revisit when

Throughput, queue age o latencia incumplan SLO medido.
