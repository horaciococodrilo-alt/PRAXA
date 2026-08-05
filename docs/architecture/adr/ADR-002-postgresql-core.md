# ADR-002 — PostgreSQL como núcleo

**Status:** Accepted  
**Date:** 2026-08-05

## Context

El Brain necesita transacciones, relaciones, temporalidad, RLS, full-text search y búsqueda vectorial.

## Decision

Usar PostgreSQL 16+ como sistema principal y pgvector para embeddings.

## Consequences

- Una única frontera transaccional en v0.
- Menos servicios y sincronización derivada.
- Los índices y consultas deben medirse antes de agregar otra base.

## Revisit when

Volumen, calidad o latencia medidos incumplan un SLO y no puedan resolverse con PostgreSQL.
