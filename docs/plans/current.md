# Trabajo actual

**Última actualización:** 2026-08-13

**Fase:** VS-01 — Fundación de datos, seguridad y contratos

**Rama:** `feat/vs-01-data-security-foundation`

**Ticket autorizado:** completar la fundación PostgreSQL, tenancy, roles, RLS,
configuración y contexto transaccional; verificarla en CI y dejar un draft PR listo para
auditoría.

**Estado:** autorizado

**Siguiente gate:** auditoría independiente del draft PR de VS-01 sobre el mismo SHA que
pasó CI. VS-02 permanece no autorizada.

## Resultado esperado

Una base PostgreSQL 16 con pgvector demuestra aislamiento entre tenants usando el rol de
aplicación, con credenciales separadas, migraciones reproducibles, RLS habilitada y forzada,
policies explícitas para `praxa_app`, contexto transaccional fail-closed y limpieza real del
pool.

## Principio

La arquitectura completa del Company Brain es el norte. VS-01 implementa únicamente la
fundación necesaria para el vertical de divergencia de inventario.

> Future-compatible, no future-built.

## Incluye

- Docker Compose con PostgreSQL 16 y pgvector fijado por digest.
- Extensión `vector`; FTS nativo no requiere extensión adicional.
- SQLAlchemy 2 síncrono con `psycopg` y Alembic.
- Configuración separada por proceso:
  - API: `DATABASE_URL`;
  - migraciones: `MIGRATION_DATABASE_URL`;
  - bootstrap/seed de CI y tests: `SEED_DATABASE_URL`.
- `APP_ENV` obligatorio y limitado a `development`, `test` o `ci` para bootstrap.
- Roles SQL separados para bootstrap, ownership/migraciones y aplicación.
- Tablas mínimas de tenant, principal, membership, roles, permisos y relaciones.
- RLS habilitada y forzada en las tablas de negocio de la fase.
- Policies explícitas `TO praxa_app`; ninguna policy destinada a `{public}`.
- Membership no recursiva, fail-closed y self-only cuando no puede verificarse de forma
  segura desde PostgreSQL.
- Contexto con `SET LOCAL` dentro de una transacción.
- Limpieza de contexto al devolver conexiones al pool y control negativo del riesgo sin
  listener.
- Bootstrap idempotente.
- Guard estático contra patrones de seguridad prohibidos.
- Un único contrato ejecutable de integración y seguridad, `make ci-full`, compartido con
  GitHub Actions.
- ADR-014 como decisión aceptada sobre sesiones síncronas.

## No incluye

- Evidencia, ingesta, source objects, versiones, chunks o embeddings.
- Recursos de inventario o restricción por rol sobre un recurso de negocio; ese gate se
  introduce en VS-02.
- Retrieval, Context Compiler o ContextPacket implementados.
- API de dominio, agente, skill o UI.
- `pg_trgm`.
- Datos reales, conectores productivos o escrituras externas.
- Infraestructura de doble auditoría automatizada; VS-01 usa el proceso manual aprobado.
- Merge o inicio de VS-02.

## Decisiones aplicables

- ADR-001: monolito modular.
- ADR-002: PostgreSQL como núcleo.
- ADR-011: vertical de inventario.
- ADR-014: SQLAlchemy 2 síncrono con `psycopg`.
- Imagen: `pgvector/pgvector:0.8.6-pg16@sha256:a36250871de0833b8757561c72f2477ef1ddd1101afa4e617fb552e0de514c6b`.
- Un GUC manipulable no es autenticación.
- `app.role` no participa en policies ni amplía acceso.
- La aplicación no posee tablas y no tiene `BYPASSRLS`.
- PostgreSQL real es obligatorio para integración y seguridad; SQLite no es sustituto.

## Archivos y módulos previstos

- `docker-compose.yml`
- `.env.example`
- `Makefile`
- `.github/workflows/ci.yml`
- `backend/pyproject.toml` y `backend/uv.lock`
- configuración y DB compartida bajo `backend/src/praxa/`
- Alembic y migraciones bajo `backend/migrations/`
- bootstrap y guards bajo `scripts/`
- tests unitarios, de integración y seguridad bajo `backend/tests/`
- `docs/architecture/adr/ADR-014-sqlalchemy-sync-sessions.md`
- índice ADR, spec, build plan, decision log y documentación operativa afectada.

No se crean módulos futuros vacíos.

## Pruebas obligatorias

- Tenant A no lee datos de B.
- Tenant A no inserta `tenant_id` de B.
- Tenant A no actualiza ni elimina datos de B.
- Sin contexto se deniega por defecto.
- Principal o membership inexistentes no obtienen acceso.
- Principal inactivo no obtiene acceso al tenant.
- UUID inválido en GUC no rompe la transacción ni habilita acceso.
- `app.role` no influye en policies.
- Las pruebas usan `praxa_app`, no el owner.
- Ninguna policy aplica a `{public}`.
- El pool reutiliza backend sin filtrar contexto.
- Un control negativo demuestra el riesgo cuando falta la limpieza.
- Bootstrap shell/Python puede ejecutarse dos veces.
- Migraciones pasan upgrade/downgrade/upgrade y `alembic check` después del upgrade final.
- IDs de Alembic caben en `version_num`.
- No hay SQLite en integración o seguridad.

## Criterios de aceptación

1. Roles y grants cumplen mínimo privilegio.
2. RLS aísla tenants y falla cerrado con el rol de aplicación.
3. Configuración ausente o inválida falla antes de conectar y no imprime secretos.
4. Las credenciales de app, migración y seed no se mezclan.
5. `make ci-full` espera health, ejecuta bootstrap dos veces, prueba el ciclo completo de
   migraciones, ejecuta `alembic check` y corre integración/seguridad.
6. GitHub Actions invoca el mismo contrato sin duplicar PostgreSQL ni la receta.
7. La limitación self-only de membership queda documentada con precisión.
8. El gate por rol sobre recurso de negocio queda explícitamente pendiente para VS-02.
9. La suite local disponible y CI del SHA exacto están verdes.
10. El draft PR queda listo para auditoría independiente, sin merge.

## Verificación obligatoria

```bash
uv sync --locked --all-groups
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run pytest backend/tests/unit
docker compose config
make ci-full
git diff --check
```

Si Docker no está disponible en el host de implementación, debe declararse la limitación y
los mismos gates PostgreSQL deben ejecutarse en GitHub Actions sobre el SHA exacto. No se
reemplazan con SQLite ni se declaran ejecutados localmente.

## Condiciones de parada

Detenerse ante:

- cambio no aprobado de arquitectura o contrato público;
- dependencia productiva nueva;
- migración destructiva;
- bypass de RLS o autenticación basada sólo en GUC;
- necesidad de implementar evidencia, inventario, retrieval, agente o UI;
- imposibilidad de ejecutar un gate obligatorio tanto localmente como en CI.

## Definition of Done de la fase

- Implementación y documentación alineadas.
- Controles rápidos de rama, base, diff, untracked, secretos, guards y
  `git diff --check` ejecutados antes del primer push.
- Draft PR abierto contra `main`.
- CI verde sobre el SHA candidato.
- Auditoría independiente y segunda verificación ejecutadas sobre ese mismo SHA.
- Hallazgos P0/P1 resueltos.
- Merge únicamente con autorización humana explícita.

```text
ESTADO: VS-01 AUTORIZADA — VS-02 NO AUTORIZADA
```
