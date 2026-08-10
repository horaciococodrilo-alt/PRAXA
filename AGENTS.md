# Praxa Repository Instructions

## Mission

Build Praxa incrementally. The current authorized product scope is **Company Brain v0**, implemented as a **single vertical slice** of inventory divergence and oversell risk (ADR-011): an evidence-grounded operational knowledge system for multichannel ecommerce.

The vertical includes one controlled agent and one versioned product skill, `investigate_inventory_divergence`. The system performs **no external writes**; it does perform a closed set of internal, append-only, audited writes for agent proposals, human decisions and audit events.

The full Praxa vision includes a generic agent runtime, autonomy, multi-agent systems and real external actions. Those are future context, not current implementation scope.

## Sources of truth

Use these sources in this order:

1. Security and non-negotiable invariants in this file and the master specification.
2. `docs/architecture/company-brain-spec.md`.
3. Approved ADRs that are also reflected in the master specification.
4. `docs/plans/current.md`.
5. `docs/plans/company-brain-build-plan.md`.
6. `docs/product/project-brief.md` as the single active source of product hypotheses.

`docs/product/future-vision.md` is non-normative. `docs/research/archive/` contains superseded material and must not be used as requirements unless a human explicitly requests it.

If sources conflict, stop and report the contradiction. Do not silently choose an interpretation.

## Required reading

Before the first implementation:

- Read this file.
- Read `docs/product/project-brief.md`.
- Read sections 0 through 7 of the master specification.
- Read the phase, repository, standards and testing sections relevant to the current work.
- Read `docs/plans/current.md`.

Before each ticket, read only the current ticket and relevant specification sections. Inspect existing code and tests before proposing changes.

## Non-negotiable invariants

- Every business record has a non-null `tenant_id`.
- Tenant isolation is enforced in PostgreSQL with RLS and security tests.
- Raw source versions and evidence are append-only.
- Source objects, observations, facts, policies, chunks and candidates are different concepts.
- Derived knowledge retains provenance and temporal validity.
- Current operational state and historical knowledge remain distinguishable.
- Deterministic logic owns normalization, joins, calculation, validation, authorization and publication state.
- LLMs may extract or propose structured candidates; they never publish approved knowledge or decide permissions.
- An LLM may **communicate** values returned by deterministic tools, but never compute, originate, adjust or become the authoritative source for them.
- The effective policy is selected by deterministic code from an approved, in-force version. FTS and vector retrieve the passage that supports it; they never decide which rule governs a calculation.
- No global RRF in v0: ranking, limits and deduplication happen **within** each retrieval channel.
- The `ContextPacket` separates a deterministic, hashable payload from an operational execution envelope. Reproducibility tests compare the normalized payload.
- Authorization is applied before retrieval, and citations are re-authorized before serializing a response. Unauthorized content must not influence ranking, answerability or the answer.
- `unknown`, `partial` and `conflicted` are valid outcomes.
- Verified facts included in context have citations.
- Company Brain v0 performs no external writes. Internal append-only, audited writes for proposals, decisions and audit events are permitted; a proposal is never presented as an executed action.
- Secrets and production customer data never enter the repository, frontend bundle, prompts or logs.

## Current non-goals

Do not add unless an approved future ticket and ADR require them:

- Production agent runtime, generic skill registry or multi-agent system.
- Agent autonomy, persistent agent memory across runs, or autonomous learning from corrections.
- Any second skill beyond `investigate_inventory_divergence`.
- Tool Gateway with real writes.
- Real refunds, invoices, stock changes or ARCA actions.
- Microservices, Redis, Kafka, Temporal or Kubernetes.
- Neo4j or a dedicated vector database.
- MCP before stable REST/auth; MCP is read-only first.
- Full public OAuth for multiple providers.
- Cross-customer benchmarks.
- Fine-tuning with customer data.

## Architecture

Use a modular monolith with separate API and worker processes, one PostgreSQL database and an interchangeable evidence object store.

Approved stack:

- Python 3.12+
- FastAPI and Pydantic v2
- SQLAlchemy 2 and Alembic
- PostgreSQL 16+ with pgvector, full-text search and RLS
- PostgreSQL-backed jobs initially
- React, TypeScript and Vite
- pytest, Hypothesis, Vitest, Testing Library and Playwright as introduced by authorized tickets
- OpenTelemetry and JSON logs
- Docker Compose and GitHub Actions

Code identifiers, database fields and API contracts use English. Product documentation and initial UI copy may use Spanish.

## Module boundaries

Prefer `routes -> service -> domain/repository`. Domain code must not import FastAPI or frontend code. Do not create empty future modules merely to match an aspirational tree.

## Workflow

For every ticket:

1. Inspect repository state and unrelated user changes.
2. Restate the outcome, scope and explicit non-scope.
3. Identify relevant specification sections and ADRs.
4. List expected files, migrations, dependencies and tests.
5. Ask before changing architecture, scope or production dependencies.
6. Make the smallest cohesive change.
7. Run relevant verification.
8. Report changes, tests, deviations, risks and remaining work.

Do not broaden a ticket because a future feature appears useful.

## Expected commands

Each phase must establish or document equivalent commands as it introduces them.

Available today:

- `uv sync --all-groups`
- `uv run ruff check .`
- `uv run ruff format --check .`
- `uv run mypy .`
- `uv run pytest`
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

Introduced in `VS-01`, not available yet:

- `docker compose up -d postgres`
- `uv run alembic upgrade head`

Do not claim success without running the relevant available commands.

## Git and safety

- Use one short-lived branch per coherent ticket.
- Preserve unrelated work.
- Never run destructive reset, clean, restore, force-push or broad deletion commands.
- Do not commit, push, deploy or mutate external systems unless explicitly requested.
- Never commit credentials, `.env`, real customer exports or production payloads.
- Use synthetic fixtures until security, consent and deletion controls are complete.

## Architecture decisions

Create an ADR before changing the central data model, temporal semantics, tenant isolation, trust lifecycle, connector contract, retrieval architecture, public API or major infrastructure dependency.

An ADR is not approved merely because an agent wrote it. Human approval is required. When approved, update the master specification in the same change.

## Definition of done

A ticket is done only when acceptance criteria are met, tests and checks pass, security and tenant implications were reviewed, documentation reflects intentional changes, no unrelated scope was introduced and remaining deviations are explicit.
