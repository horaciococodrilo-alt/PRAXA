# ADR-008 — Retrieval híbrido

**Status:** Accepted  
**Date:** 2026-08-05

## Context

IDs y SKU requieren exactitud; lenguaje natural requiere similitud; relaciones y vigencia requieren filtros estructurados.

## Decision

Combinar exact/FTS, vector, relaciones y temporalidad, con fusión reproducible, deduplicación, ACL y answerability.

## Consequences

- La base vectorial recupera candidatos; no decide verdad.
- La calidad se mide por datasets y gates separados.
- La explicación debe conservar contribuciones de ranking.

## Revisit when

Evaluaciones indiquen que otra combinación mejora los gates sin ampliar riesgo.
