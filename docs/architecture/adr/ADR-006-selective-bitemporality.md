# ADR-006 — Bitemporalidad selectiva

**Status:** Accepted  
**Date:** 2026-08-05

## Context

Praxa debe responder qué regla era válida y qué versión conocía el sistema en un momento dado.

## Decision

Facts y policies usan `valid_time` y `transaction_time`. No aplicar bitemporalidad completa a todas las tablas sin necesidad.

## Consequences

- Consultas históricas correctas para conocimiento gobernado.
- Mayor complejidad concentrada en servicios y constraints específicos.

## Revisit when

No se elimina para facts/policies; puede ampliarse a otras entidades por un caso aprobado.
