# ADR-014 — Sesiones síncronas de SQLAlchemy

**Status:** Accepted<br>
**Date:** 2026-08-11

## Context

VS-01 debe fijar una única estrategia de conexión antes de implementar el contexto
transaccional, la limpieza del pool y las pruebas de RLS. Mantener variantes sync y async
duplicaría configuración, listeners, fixtures y caminos de seguridad sin aportar valor al
vertical del MVP.

La carga prevista no exige concurrencia de base de datos asíncrona y las operaciones críticas
son transacciones cortas y explícitas. Los conectores y proveedores externos futuros pueden
seguir usando interfaces asíncronas sin determinar la estrategia del ORM.

## Decision

La persistencia del monolito usa SQLAlchemy 2 síncrono con el driver `psycopg`.

- La API recibe únicamente `DATABASE_URL` con esquema `postgresql+psycopg`.
- Alembic recibe únicamente `MIGRATION_DATABASE_URL`.
- Bootstrap y seed de CI/tests reciben únicamente `SEED_DATABASE_URL`.
- Las transacciones son explícitas y el contexto RLS se instala con `SET LOCAL` dentro de la
  transacción.
- La limpieza al devolver conexiones al pool se implementa y prueba sobre el engine síncrono.
- No se mantiene un segundo engine o suite paralela asíncrona.

## Consequences

### Positivas

- Un solo camino de configuración, transacción, pool y pruebas de seguridad.
- Menor superficie para fugas de contexto entre conexiones reutilizadas.
- Alembic y los tests de integración usan el mismo driver que la aplicación.

### Negativas

- Las operaciones de base bloquean el thread que las ejecuta.
- Si una carga medida exige mayor concurrencia, la aplicación deberá usar workers/threads o
  reconsiderar la decisión con evidencia.

## Alternatives considered

### SQLAlchemy async con `asyncpg`

Descartado para VS-01 porque agrega complejidad a sesiones, listeners y fixtures sin un cuello de
botella medido.

### Soportar sync y async simultáneamente

Descartado porque crea dos recetas divergentes para la frontera de seguridad.

## Revisit when

Métricas de carga y latencia demuestren que el acceso síncrono incumple un objetivo operativo y
el problema no pueda resolverse con el diseño actual del monolito.
