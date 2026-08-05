# ADR-003 — Tablas de edges en vez de graph database

**Status:** Accepted  
**Date:** 2026-08-05

## Context

Las relaciones iniciales entre entidades, evidencia, hechos y políticas son acotadas y consultables mediante joins y CTEs.

## Decision

Representar relaciones con tablas tipadas de edges en PostgreSQL. No usar Neo4j en v0.

## Consequences

- Integridad y RLS permanecen en una base.
- Las traversals complejas requieren consultas explícitas y tests.

## Revisit when

Traversals reales y profundas constituyan un cuello medido que PostgreSQL no resuelva dentro del SLO.
