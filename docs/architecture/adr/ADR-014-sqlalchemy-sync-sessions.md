# ADR-014 — Sesiones síncronas de SQLAlchemy

**Status:** Accepted<br>
**Date:** 2026-08-11<br>
**Related:** ADR-002 — PostgreSQL como núcleo

## Context

`company-brain-spec.md` §29.2 registra «SQLAlchemy sync o async» como decisión abierta con gate
«antes de VS-01». VS-01 crea la sesión de base de datos, así que la decisión no puede posponerse.

La especificación asume hoy el camino async en dos lugares: §23.5 declara
`DATABASE_URL=postgresql+asyncpg://...` y §7.6 lista `pytest-asyncio` entre las herramientas de
prueba del backend. Ninguna de las dos líneas proviene de una medición; son un supuesto por defecto
anterior a que existiera código de persistencia.

## Decision

Company Brain v0 usa **SQLAlchemy 2 síncrono** con `psycopg` 3 (`postgresql+psycopg://`) para
aplicación, worker, migraciones y pruebas.

Los endpoints FastAPI que tocan la base se declaran `def`, no `async def`, delegando en el
threadpool de Starlette.

## Rationale

- v0 no tiene carga concurrente medida: monolito modular, cola de trabajos en PostgreSQL
  (ADR-004) y sin I/O externa en el camino crítico salvo el proveedor de LLM en VS-05, que es
  aislable.
- El contexto de RLS exige que `SET LOCAL` y las consultas ocurran en la **misma** conexión física
  dentro de la **misma** transacción. En código síncrono eso es verificable por inspección; en
  async, una sesión compartida entre tareas rompe el invariante sin producir un error visible. El
  aislamiento por tenant es el criterio dominante de VS-01.
- Alembic y las suites adversariales resultan más simples y deterministas en sync.
- Evitar `pytest-asyncio` reduce modos de fallo en la primera fase que usa base de datos.

## Consequences

### Positivas

- Un solo modelo de ejecución para API, worker, migraciones y tests.
- La disciplina de contexto transaccional queda auditable leyendo el código.
- Menos dependencias y menos superficie de configuración en la fase fundacional.

### Negativas

- Un endpoint con I/O concurrente intensiva dependerá del threadpool de Starlette.
- Migrar a async más adelante exigirá revisar la disciplina de contexto, no sólo cambiar el driver.

### Cambios en la especificación

Esta ADR se aplica junto con las enmiendas correspondientes de `company-brain-spec.md`:

- §7.6 pasa a declarar sesiones síncronas y `psycopg` 3, y retira `pytest-asyncio`.
- §23.5 pasa a `DATABASE_URL=postgresql+psycopg://...` y agrega `MIGRATION_DATABASE_URL`.
- §29.2 marca la decisión como resuelta.

## Alternatives considered

### Async desde el inicio

Descartada. Aporta un riesgo concreto sobre el invariante de contexto por transacción sin un
beneficio medido en v0.

### Sync ahora y migración planificada a async en VS-05

Descartada como plan por defecto. Una migración sin un cuello de botella medido contradice los
gates de sobreconstrucción de §28.

### Abstracción que soporte ambos modos

Descartada. Duplica la superficie de prueba de la parte más sensible del sistema.

## v0 scope

- Un único engine síncrono para la aplicación y otro para migraciones, con credenciales separadas.
- `psycopg` 3 como driver.
- Sin `asyncpg` y sin `pytest-asyncio` en el lockfile.

## Deferred

- Módulos async aislados para I/O externa, si una medición los justifica.
- Pool asíncrono y `AsyncSession`.

## Revisit when

Una medición muestre que la API o el worker incumplen un SLO interno y el perfil demuestre que el
bloqueo es por I/O.
