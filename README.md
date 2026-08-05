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

## Desarrollo local

Los comandos definitivos serán establecidos por `CB-001`. El objetivo de experiencia local es:

```bash
cp .env.example .env
docker compose up --build
make migrate
make seed-demo
make test
```

No conectar datos reales antes de completar aislamiento por tenant, threat model, política de borrado y consentimiento.
