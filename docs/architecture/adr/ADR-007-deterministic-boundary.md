# ADR-007 — LLM solo para no determinismo necesario

**Status:** Accepted  
**Date:** 2026-08-05

## Context

Los LLM son útiles para interpretar texto, pero no son una base segura para permisos, cálculos, joins o publicación de verdad.

## Decision

Usar LLM únicamente para extracción o propuestas estructuradas desde información no estructurada. Código determinístico valida, autoriza, versiona y publica.

## Consequences

- Mayor testabilidad, control de costo y reproducibilidad.
- Se requieren schemas, citas, provider adapters y evals.
- Una confianza alta no equivale a aprobación.

## Revisit when

Un caso concreto y evaluado demuestre una mejora neta sin romper seguridad o reproducibilidad.
