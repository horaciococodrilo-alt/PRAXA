# Equipo y ownership

## Simón Alfandari — backend, arquitectura e IA

- Arquitectura modular y contratos.
- FastAPI, services y request context.
- Tenancy/RLS junto con Gonzalo.
- Job orchestration.
- Knowledge lifecycle y ContextPacket junto con Juan.
- Observabilidad, CI, integración y documentación.

## Gonzalo Mayer — backend, datos y conectores

- PostgreSQL, migraciones y repositories.
- BlobStore y connector SDK.
- Sync, jobs y manejo de fallos.
- Fixtures y adaptadores.
- Observations, retención, despliegue y backups.

## Juan Grimberg — IA, conocimiento y evaluación

- Taxonomía y schemas de extracción.
- Entity resolution y gold data.
- Facts, policies, contradictions y gaps.
- Retrieval, RRF, answerability y evaluaciones.
- Prompt injection y provider adapters.

## Matías Guiter — frontend y diseño

- Sistema visual y experiencia no técnica.
- Coverage, sources, entity explorer y search.
- Review queue, citations, conflicts y audit.
- Accesibilidad, estados vacíos/error y QA visual.

## Regla de ownership

El owner define la interfaz y mantiene el ticket, pero no trabaja sin revisión. Cambios en RLS, knowledge state, ContextPacket o policy schema requieren revisión cruzada de al menos dos áreas.
