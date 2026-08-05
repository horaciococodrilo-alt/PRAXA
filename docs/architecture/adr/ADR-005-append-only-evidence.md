# ADR-005 — Evidencia append-only

**Status:** Accepted  
**Date:** 2026-08-05

## Context

Praxa debe reconstruir qué recibió, cuándo lo recibió y qué interpretación se derivó.

## Decision

Payloads y versiones de evidencia son append-only, content-addressed y citables. Las correcciones crean nuevas versiones o estados; no reescriben historia.

## Consequences

- Auditoría y reproducibilidad.
- Mayor necesidad de retención, tombstones y borrado gobernado.
- Los resúmenes nunca reemplazan el original.

## Revisit when

No se revisa el principio; solo políticas de retención y borrado.
