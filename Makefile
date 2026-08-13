.PHONY: install lint format typecheck test build ci ci-full security-guard \
	backend-install backend-lint backend-format backend-typecheck backend-test \
	backend-test-unit backend-test-integration backend-test-security \
	frontend-install frontend-lint frontend-typecheck frontend-test frontend-build \
	postgres-up postgres-wait db-bootstrap db-migration-cycle db-test

backend-install:
	cd backend && uv sync --locked --all-groups

backend-lint:
	cd backend && uv run ruff check .

backend-format:
	cd backend && uv run ruff format --check .

backend-typecheck:
	cd backend && uv run mypy .

backend-test:
	cd backend && uv run pytest

backend-test-unit:
	cd backend && uv run pytest tests/unit

backend-test-integration:
	cd backend && uv run pytest -m integration tests/integration

backend-test-security:
	cd backend && uv run pytest -m security tests/security

frontend-install:
	cd frontend && npm ci

frontend-lint:
	cd frontend && npm run lint

frontend-typecheck:
	cd frontend && npm run typecheck

frontend-test:
	cd frontend && npm test

frontend-build:
	cd frontend && npm run build

install: backend-install frontend-install

lint: backend-lint frontend-lint

format: backend-format

typecheck: backend-typecheck frontend-typecheck

test: backend-test frontend-test

build: frontend-build

ci: install lint format typecheck test build

security-guard:
	cd backend && uv run python ../scripts/check_security_guards.py

postgres-up:
	docker compose up -d postgres

postgres-wait:
	@attempt=0; until docker compose exec -T postgres pg_isready -U postgres -d praxa >/dev/null 2>&1; do \
		attempt=$$((attempt + 1)); \
		if [ $$attempt -ge 30 ]; then echo "PostgreSQL did not become healthy"; exit 1; fi; \
		sleep 2; \
	done

db-bootstrap:
	cd backend && uv run python ../scripts/bootstrap_db.py
	cd backend && uv run python ../scripts/bootstrap_db.py

db-migration-cycle:
	cd backend && uv run alembic upgrade head
	cd backend && uv run alembic downgrade base
	cd backend && uv run alembic upgrade head
	cd backend && uv run alembic current
	cd backend && uv run alembic heads
	cd backend && uv run alembic check

db-test: backend-test-integration backend-test-security

ci-full: install lint format typecheck backend-test-unit frontend-test frontend-build security-guard postgres-up postgres-wait db-bootstrap db-migration-cycle db-test
	git diff --check
