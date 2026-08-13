# Praxa

Praxa es una iniciativa para convertir datos y conocimiento operativo dispersos de una empresa en contexto gobernado, verificable y reutilizable por personas y sistemas de IA.

## Estado

- Entrega académica actual: Company Brain v0 como corte vertical de divergencia de inventario.
- Alcance técnico actual: ingesta, evidencia, estado canónico, conocimiento gobernado, retrieval autorizado por canales, ContextPacket, un agente controlado, la skill `investigate_inventory_divergence`, propuestas internas, revisión humana y auditoría.
- Fuera del alcance actual: autonomía, multiagente, runtime genérico de skills, memoria persistente del agente y escrituras en sistemas empresariales externos.

## Documentos principales

| Documento | Propósito |
|---|---|
| `AGENTS.md` | Reglas comunes de trabajo para agentes de código |
| `CLAUDE.md` | Adaptación de las reglas para Claude Code |
| `docs/product/project-brief.md` | Qué es Praxa, qué problema investiga y única fuente activa de hipótesis de producto |
| `docs/product/future-vision.md` | Visión de largo plazo, no normativa |
| `docs/architecture/company-brain-spec.md` | Contrato técnico del Company Brain v0 |
| `docs/architecture/adr/` | Decisiones arquitectónicas registradas (ADR-001 a ADR-013) |
| `docs/plans/company-brain-build-plan.md` | Secuencia de fases R0 y VS-01 a VS-07 |
| `docs/plans/current.md` | Único ticket autorizado actualmente |

## Primer objetivo

Completar `R0`: alinear especificación, ADR, roadmap, ticket, README, ownership, reglas de agentes y CI con el MVP vertical, sin implementar nada funcional. Ninguna fase posterior queda autorizada automáticamente.

## Caso de demostración canónico

Dos canales reportan inventario diferente para una misma variante. Praxa conserva ambas observaciones, resuelve la entidad canónica, recupera una política aprobada de fuente autoritativa y stock de seguridad, calcula el stock vendible de forma determinística y devuelve un contexto citado.

Sobre ese contexto, un agente controlado investiga el caso mediante la skill `investigate_inventory_divergence` y registra una propuesta interna marcada como no ejecutada. Una persona revisa el expediente y deja una decisión auditada. Ningún sistema externo se modifica en ningún punto del flujo.

## Cómo levantar el entorno

### Prerrequisitos

- Python 3.12 o superior. El entorno reproducible de desarrollo y CI está fijado actualmente en Python 3.12 mediante `backend/.python-version`.
- [uv](https://docs.astral.sh/uv/) para dependencias y entorno del backend.
- Node.js LTS (24) y npm para el frontend.
- Make, opcional: es solo una interfaz de conveniencia. Todos los comandos directos de `uv` y `npm` están documentados abajo y funcionan sin Make.

### Backend

```bash
cd backend
uv sync --all-groups
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run pytest
uv run uvicorn praxa.app:app --reload
```

Con el servidor levantado, `GET http://localhost:8000/health/live` responde `{"status": "ok"}`.

### Frontend

```bash
cd frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run dev
```

`npm test` ejecuta la suite una sola vez y termina; no abre watch mode.

### El contrato de verificación

```bash
make ci-full
```

**`make ci-full` es la única receta canónica.** GitHub Actions la invoca una sola vez y no duplica ninguno de sus pasos: el workflow prepara checkout, uv/Python y Node, y nada más. Si el contrato cambia, cambia en el `Makefile` y CI lo hereda sin editarse.

La receta ejecuta, en este orden y en serie:

| # | Paso | Comando |
|---:|---|---|
| 1 | Instalación desde lockfiles | `uv sync --locked --all-groups`, `npm ci` |
| 2 | Ruff lint | `uv run ruff check .` |
| 3 | Ruff formato | `uv run ruff format --check .` |
| 4 | Tipos | `uv run mypy .` |
| 5 | Unit | `uv run pytest -m "not integration and not security"` |
| 6 | Frontend lint | `npm run lint` |
| 7 | Frontend tipos | `npm run typecheck` |
| 8 | Frontend test | `npm test` |
| 9 | Frontend build | `npm run build` |
| 10 | Guards de seguridad | `uv run pytest tests/unit/test_no_forbidden_patterns.py` |
| 11 | PostgreSQL real y **healthy** | `docker compose up -d --wait postgres` |
| 12 | Bootstrap, dos veces (idempotencia) | `uv run python scripts/bootstrap_db.py` ×2 |
| 13 | Migración desde vacío, ida y vuelta | `alembic upgrade head`, `downgrade base`, `upgrade head` |
| 14 | Deriva entre modelos y schema | `alembic check` |
| 15 | Integración | `uv run pytest -m integration` |
| 16 | Seguridad | `uv run pytest -m security` |
| 17 | Árbol de trabajo | `git diff --check` |
| 18 | Limpieza | `docker compose down --remove-orphans` |

La limpieza corre desde un `trap` del shell, así que ocurre también cuando un gate falla, sin alterar el código de salida. `down` va **sin** `--volumes`: conserva el volumen de datos y no toca recursos de otros proyectos.

Requiere Docker. Los targets granulares del `Makefile` (`backend-lint`, `frontend-test`, `db-up`, `migrate`, …) existen para el trabajo diario y **no** constituyen el contrato. Make es opcional en el sentido de que cada target es un comando directo de `uv`, `npm` o `docker compose`, y la tabla de arriba los enumera todos.

### Base de datos

```bash
cp .env.example .env      # completar las tres contraseñas
docker compose up -d postgres
cd backend && uv run alembic upgrade head
```

El contenedor usa `pgvector/pgvector:0.8.6-pg16` fijada por digest inmutable, la misma imagen que CI. En el primer arranque de un volumen vacío, `infra/docker/postgres/initdb/01-bootstrap.sh` crea los roles, el ownership y la extensión `vector`. Para reaplicar el bootstrap sobre una base ya creada —los scripts de initdb no vuelven a correr— el camino es `make db-bootstrap`, que es idempotente.

Tres credenciales, una por contexto, que **no se comparten**:

| Variable | Rol | Quién la usa |
|---|---|---|
| `DATABASE_URL` | `praxa_app` | El proceso de API. En VS-01 es de solo lectura sobre todas las tablas. |
| `MIGRATION_DATABASE_URL` | `praxa_owner` | Alembic y CI. Ausente del entorno de la API. |
| `SEED_DATABASE_URL` | superusuario | Bootstrap y semilla de fixtures. Solo desarrollo y CI. |

Si la máquina ya tiene un PostgreSQL propio en 5432, definir `POSTGRES_HOST_PORT` en el `.env` y ajustar el puerto de las tres URLs.

### Pruebas

```bash
cd backend
uv run pytest -m "not integration and not security"   # sin base de datos
uv run pytest -m "integration or security"            # requiere PostgreSQL
```

Las pruebas de integración y seguridad **nunca** usan SQLite: se corren contra PostgreSQL real porque RLS y `FORCE ROW LEVEL SECURITY` no existen en SQLite. Sin base disponible hacen skip en local, pero fallan en CI.

No conectar datos reales antes de completar aislamiento por tenant, threat model, política de borrado y consentimiento.
