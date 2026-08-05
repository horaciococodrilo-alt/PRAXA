# ADR-010 — Escrituras externas fuera de v0

**Status:** Accepted  
**Date:** 2026-08-05

## Context

Escrituras reales requieren credenciales limitadas, idempotencia, aprobación, postcondiciones, compensación y responsabilidad operacional.

## Decision

Company Brain v0 no modifica sistemas externos. Puede producir propuestas o simular acciones con datos sintéticos.

## Consequences

- El proyecto demuestra fidelidad y utilidad de contexto sin asumir riesgo transaccional.
- Runtime, Tool Gateway, skills ejecutables y reversa quedan fuera.

## Revisit when

El Company Brain cumpla su definición de terminado y exista una acción comercial validada con postcondición verificable.
