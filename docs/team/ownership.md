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
- Retrieval segmentado por canales: selección, ranking y deduplicación dentro de cada canal, sin RRF global en v0 (ADR-013).
- Autorización previa al retrieval y reautorización de citas.
- Answerability y evaluaciones por gates separados.
- Prompt injection y provider adapters.

## Matías Guiter — frontend y diseño

- Sistema visual y experiencia no técnica.
- Coverage, sources, entity explorer y search.
- Review queue, citations, conflicts y audit.
- Accesibilidad, estados vacíos/error y QA visual.

## Regla de ownership

El owner define la interfaz y mantiene el ticket, pero no trabaja sin revisión. Cambios en RLS, knowledge state, ContextPacket o policy schema requieren revisión cruzada de al menos dos áreas.

## Agentes de IA

Los agentes de código son **asistentes o revisores**, nunca propietarios.

- No figuran como owner de un área, un ticket ni un contrato.
- No aprueban su propio trabajo ni sustituyen la revisión cruzada humana.
- No deciden arquitectura, permisos, política activa, alcance ni el estado de una ADR.
- Una ADR no queda aprobada porque un agente la haya escrito: la aprobación es humana.

Cuando un agente actúa como revisor independiente, su salida es un insumo para una persona, no un veredicto.

> Nota pendiente de decisión humana: la propuesta de R0 supone un desarrollador principal con asistencia de IA. Este archivo conserva las cuatro personas registradas porque el repositorio no aporta evidencia de un cambio en el equipo. Si la composición real cambió, corresponde actualizar esta sección en un cambio posterior y explícito.
