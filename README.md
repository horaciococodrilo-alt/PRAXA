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

`make ci` encadena, para backend y frontend, instalación, lint, format check del backend, typecheck y tests; y además el **build del frontend**. No existe un build del backend: `make build` equivale hoy a `frontend-build`.

### Todavía no disponible

`docker compose up -d postgres` y `uv run alembic upgrade head` no aplican todavía. PostgreSQL, Docker Compose y las migraciones se incorporan en `VS-01`.

`.env.example` está reservado para fases posteriores y no se utiliza todavía: el backend aún no lee configuración desde el entorno. Sus variables se irán incorporando a medida que las fases correspondientes las necesiten.

No conectar datos reales antes de completar aislamiento por tenant, threat model, política de borrado y consentimiento.
