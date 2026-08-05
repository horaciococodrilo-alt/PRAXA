# Trabajo actual

**Última actualización:** 2026-08-05  
**Milestone:** M0 — Fundación  
**Ticket autorizado:** CB-001 — Crear monorepo y tooling  
**Estado:** planificado

## Resultado esperado

Crear la estructura mínima y ejecutable del repositorio de Praxa con backend, frontend, tooling y CI. El objetivo es una base reproducible, no implementar dominios del Company Brain todavía.

## Incluye

- `pyproject.toml` y estructura mínima del backend.
- FastAPI con `/health/live`.
- React + TypeScript + Vite con una pantalla shell mínima.
- Ruff y typecheck inicial del backend.
- pytest con al menos una prueba.
- lint/typecheck/test/build del frontend.
- GitHub Actions para checks mínimos.
- Documentación de comandos locales.
- Dockerfile o Compose únicamente si es necesario para demostrar el arranque mínimo de CB-001; PostgreSQL pertenece a CB-002.

## No incluye

- Modelo de dominio.
- Migraciones empresariales.
- PostgreSQL/pgvector funcional completo.
- Tenancy y RLS.
- Conectores.
- Evidencia, entidades, facts o policies.
- Embeddings o LLM.
- Agentes, skills, MCP o escrituras externas.
- Deploy productivo.

## Especificación relevante

- Sección 0: uso por agentes de código.
- Sección 3: alcance y no-scope.
- Sección 4: invariantes.
- Sección 7.6: stack aprobado.
- Sección 22: estructura del repositorio.
- Sección 23: estándares.
- Sección 24: entorno y CI.
- Sección 25.2: CB-001.
- Sección 27: Definition of Ready/Done.

## Criterios de aceptación

- El backend puede instalarse y ejecutar un endpoint de salud.
- El frontend puede instalarse, ejecutarse y compilar.
- Existe al menos una prueba automatizada por aplicación.
- Los comandos documentados funcionan desde un checkout limpio.
- CI ejecuta lint, typecheck, pruebas y build relevantes.
- No se agregan módulos futuros vacíos ni dependencias sin uso.
- No hay secretos ni datos reales.

## Decisiones que deben confirmarse antes de implementar

- Gestor de paquetes frontend: npm por defecto.
- Typechecker backend: mypy o pyright; elegir uno y documentarlo.
- Estilos frontend: CSS Modules o Tailwind; no es necesario decidir en CB-001 si la shell usa CSS mínimo.
- Task runner: Makefile u otro equivalente simple.

## Pruebas esperadas

- Test de `/health/live`.
- Test de render del shell frontend.
- Ejecución de lint/typecheck.
- Build del frontend.
- Workflow CI validado sintácticamente.

## Bloqueos

Ninguno conocido. Si el repositorio ya contiene código o cambios no relacionados, detenerse y reportarlos antes de modificar.

## Próximo ticket al terminar

CB-002 — Docker Compose con PostgreSQL 16 y pgvector.

## Handoff

Actualizar esta sección al cerrar cada sesión con archivos modificados, comandos ejecutados, resultados, decisiones, desviaciones y siguiente paso.
