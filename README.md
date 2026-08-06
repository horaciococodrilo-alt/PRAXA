# Praxa

Praxa es una iniciativa para convertir datos y conocimiento operativo dispersos de una empresa en contexto gobernado, verificable y reutilizable por personas y sistemas de IA.

## Estado

- Etapa comercial: hipótesis, prevalidación y sin product-market fit demostrado.
- Entrega académica actual: Company Brain v0 en seis meses.
- Alcance técnico actual: ingesta, evidencia, estado canónico, conocimiento gobernado, retrieval híbrido, ContextPacket, revisión y auditoría.
- Fuera del alcance actual: agentes autónomos, skills ejecutables y escrituras en sistemas empresariales.

## Documentos principales

| Documento | Propósito |
|---|---|
| `AGENTS.md` | Reglas comunes de trabajo para agentes de código |
| `CLAUDE.md` | Adaptación de las reglas para Claude Code |
| `docs/product/project-brief.md` | Qué es Praxa y qué problema investiga |
| `docs/product/lean-canvas-v6.1.md` | Hipótesis comerciales vigentes |
| `docs/product/future-vision.md` | Visión de largo plazo, no normativa |
| `docs/architecture/company-brain-spec.md` | Contrato técnico del Company Brain v0 |
| `docs/plans/company-brain-build-plan.md` | Secuencia de milestones |
| `docs/plans/current.md` | Único ticket autorizado actualmente |

## Primer objetivo

Completar `CB-001`: establecer estructura del monorepo, backend y frontend mínimos, linting, pruebas y CI reproducible.

## Caso de demostración canónico

Dos canales reportan inventario diferente para una misma variante. Praxa conserva ambas observaciones, resuelve la entidad canónica, recupera una política aprobada de fuente autoritativa y stock de seguridad, calcula el stock vendible de forma determinística y devuelve un contexto citado sin modificar ningún sistema externo.

## Cómo levantar el entorno (CB-001)

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

### Makefile (opcional)

Desde la raíz del repositorio:

```bash
make install
make lint
make format
make typecheck
make test
make build
make ci
```

`make ci` encadena instalación, lint, format check, typecheck, tests y build de ambas aplicaciones.

### Todavía no disponible

`docker compose up -d postgres` y `uv run alembic upgrade head` no aplican en `CB-001`. PostgreSQL, Docker Compose y las migraciones se incorporan a partir de `CB-002`.

`.env.example` está reservado para tickets posteriores y no se utiliza en `CB-001`: el backend todavía no lee configuración desde el entorno. Sus variables se irán incorporando a medida que los tickets correspondientes las necesiten.

No conectar datos reales antes de completar aislamiento por tenant, threat model, política de borrado y consentimiento.
