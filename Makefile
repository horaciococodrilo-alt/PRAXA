.PHONY: install lint format typecheck test build ci \
	backend-install backend-lint backend-format backend-typecheck backend-test \
	frontend-install frontend-lint frontend-typecheck frontend-test frontend-build

backend-install:
	cd backend && uv sync --all-groups

backend-lint:
	cd backend && uv run ruff check .

backend-format:
	cd backend && uv run ruff format --check .

backend-typecheck:
	cd backend && uv run mypy .

backend-test:
	cd backend && uv run pytest

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
