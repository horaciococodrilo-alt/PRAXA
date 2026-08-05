# ADR-001 — Monolito modular

**Status:** Accepted  
**Date:** 2026-08-05

## Context

El equipo tiene cuatro integrantes y seis meses. Separar servicios desde el inicio agregaría despliegues, contratos distribuidos y fallos operativos sin evidencia de necesidad.

## Decision

Praxa Company Brain v0 será un monolito modular. API y workers pueden ejecutarse como procesos separados, pero comparten código desplegable y PostgreSQL.

## Consequences

- Menor costo operativo y de coordinación.
- Los módulos mantienen interfaces y dirección de dependencias explícitas.
- No se crean microservicios por anticipación.

## Revisit when

Un módulo necesite escalar, aislar fallos o desplegarse de forma independiente según mediciones reales.
