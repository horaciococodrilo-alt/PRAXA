# Contrato de verificacion de Praxa.
#
# `make ci-full` es la UNICA receta canonica. GitHub Actions la invoca una sola vez y no
# duplica ningun paso: no levanta PostgreSQL por su cuenta, no corre bootstrap ni migraciones
# aparte, y no ejecuta suites fuera de esta receta.
#
# Los targets granulares existen para el trabajo diario. No constituyen el contrato.

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.ONESHELL:

.PHONY: ci-full install backend-install frontend-install \
	backend-lint backend-format backend-typecheck backend-test-unit backend-guards \
	backend-test-integration backend-test-security \
	frontend-lint frontend-typecheck frontend-test frontend-build \
	verify-db diff-check \
	db-up db-down db-bootstrap db-psql migrate

# =========================================================================================
# Contrato canonico
# =========================================================================================
#
# El orden es deliberado: primero lo que falla rapido y sin servicios, despues lo que
# necesita PostgreSQL, y al final la verificacion del arbol de trabajo.
#
# `verify-db` limpia sus propios contenedores y redes mediante un trap, de modo que la
# limpieza ocurre tambien cuando un gate falla, sin enmascarar el codigo de salida.

ci-full: install backend-lint backend-format backend-typecheck backend-test-unit \
	frontend-lint frontend-typecheck frontend-test frontend-build \
	backend-guards verify-db diff-check
	@echo "ci-full: contrato completo verificado"

# =========================================================================================
# 1. Instalacion desde lockfiles
# =========================================================================================

install: backend-install frontend-install

backend-install:
	cd backend && uv sync --locked --all-groups

frontend-install:
	cd frontend && npm ci

# =========================================================================================
# 2-4. Backend: lint, formato, tipos, unit
# =========================================================================================

backend-lint:
	cd backend && uv run ruff check .

backend-format:
	cd backend && uv run ruff format --check .

backend-typecheck:
	cd backend && uv run mypy .

backend-test-unit:
	cd backend && uv run pytest -q -m "not integration and not security"

# =========================================================================================
# 5. Frontend
# =========================================================================================

frontend-lint:
	cd frontend && npm run lint

frontend-typecheck:
	cd frontend && npm run typecheck

frontend-test:
	cd frontend && npm test

frontend-build:
	cd frontend && npm run build

# =========================================================================================
# 6. Guards de seguridad
# =========================================================================================
#
# Gate explicito y rapido: prohibe SQLite, contexto de tenant a nivel de sesion y sentencias
# sueltas que fijen las variables de aplicacion. La suite unitaria tambien lo ejecuta; aca es
# un gate propio para que la violacion de una regla de seguridad se lea como tal en el log.

backend-guards:
	cd backend && uv run pytest -q tests/unit/test_no_forbidden_patterns.py

# =========================================================================================
# 7-14. PostgreSQL real: arranque healthy, bootstrap, migraciones y suites
# =========================================================================================
#
# `--wait` deja que Compose espere el healthcheck y devuelva un codigo distinto de cero si el
# servicio no llega a healthy. El trap desmonta contenedores y redes creados por esta corrida;
# `down` sin `--volumes` conserva el volumen de datos y no toca recursos de otros proyectos.

verify-db:
	trap 'docker compose down --remove-orphans' EXIT
	docker compose up -d --wait postgres
	cd backend
	uv run python scripts/bootstrap_db.py
	uv run python scripts/bootstrap_db.py
	uv run alembic upgrade head
	uv run alembic downgrade base
	uv run alembic upgrade head
	uv run alembic check
	uv run pytest -q -m integration
	uv run pytest -q -m security

# =========================================================================================
# 15. Arbol de trabajo
# =========================================================================================

diff-check:
	git diff --check

# =========================================================================================
# Utilidades de desarrollo. No forman parte del contrato.
# =========================================================================================

db-up:
	docker compose up -d --wait postgres

db-down:
	docker compose down --remove-orphans

# Reaplica el bootstrap sobre una base ya creada: los scripts de initdb solo corren en la
# inicializacion de un volumen vacio. Es idempotente.
db-bootstrap:
	cd backend && uv run python scripts/bootstrap_db.py

db-psql:
	docker compose exec postgres psql -U postgres -d praxa

migrate:
	cd backend && uv run alembic upgrade head

backend-test-integration:
	cd backend && uv run pytest -q -m integration

backend-test-security:
	cd backend && uv run pytest -q -m security
