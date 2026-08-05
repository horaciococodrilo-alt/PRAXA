# ADR-009 — MCP después de REST estable

**Status:** Accepted  
**Date:** 2026-08-05

## Context

MCP puede permitir consumo por agentes, pero agregarlo antes de estabilizar auth y contratos duplicaría superficies y decisiones.

## Decision

Definir y probar primero REST y autorización. MCP es opcional v0.2 y read-only antes de cualquier capacidad de escritura.

## Consequences

- Un solo contrato estable durante v0.
- Menor superficie de seguridad.
- El agente futuro consumirá el Brain mediante un gateway, no acceso directo a DB.

## Revisit when

REST, tenancy, ACL y ContextPacket estén probados.
