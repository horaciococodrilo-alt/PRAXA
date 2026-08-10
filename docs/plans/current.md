# Trabajo actual

**Última actualización:** 2026-08-10

**Fase:** R0 — Reconciliación de la fuente de verdad

**Ticket autorizado:** R0 — Alinear PRAXA con el MVP vertical del Company Brain

**Estado:** autorizado después de aprobación humana de este contenido

**Siguiente gate:** ninguna fase funcional comienza sin una aprobación separada

## Resultado esperado

Todas las fuentes normativas y operativas del repositorio describen el mismo MVP:
un corte vertical de inventario que conserva evidencia, resuelve una variante,
selecciona una política aprobada y vigente, recupera evidencia autorizada, compila
un ContextPacket citado y permite que un agente controlado proponga una resolución
sin ejecutar escrituras externas.

R0 no implementa ese flujo. R0 deja contratos, decisiones, roadmap, CI y reglas de
trabajo coherentes para que VS-01 pueda comenzar sin contradicciones.

## Principio de producto

La arquitectura completa del Company Brain es el norte. El código del MVP implementa
solo el vertical de divergencia de inventario.

Regla:

> Future-compatible, no future-built.

## Incluye

- Registrar ADR-011: corte vertical del Company Brain de inventario.
- Registrar ADR-012: append-only operacional, identidad de origen, retención y borrado auditado.
- Registrar ADR-013: alcance v0 de retrieval híbrido, autoridad determinística de políticas y ranking por canal.
- Conservar sin cambios históricos ADR-002, ADR-008, ADR-009 y ADR-010.
- Actualizar el índice de ADR.
- Enmendar de forma focalizada `company-brain-spec.md`.
- Reescribir `company-brain-build-plan.md` como R0 + VS-01 a VS-07.
- Actualizar `AGENTS.md`, README, project brief, ownership y decision log.
- Eliminar referencias activas al Lean Canvas inexistente.
- Archivar el kit de bootstrap que describe un repositorio aún no creado.
- Corregir documentación de `make ci`.
- Fortalecer CI: push solo a `main`, PR, concurrency, actions por SHA,
  `persist-credentials: false`, timeouts y `uv sync --locked --all-groups`.
- Agregar registro de horas humanas reales al template de PR/ticket.
- Ejecutar `make ci` desde un checkout limpio y conservar salida real.

## No incluye

- Migraciones o tablas de dominio.
- PostgreSQL, pgvector o contenedores funcionales.
- Ingesta, chunks o embeddings.
- Retrieval funcional.
- Context Compiler o ContextPacket implementados.
- API de dominio.
- LLM, agente o skill implementados.
- Interfaz.
- Nuevas dependencias de producto.
- Conectores reales.
- MCP.
- Escrituras externas.
- Configuración web de rulesets, CodeQL, secret scanning, push protection o Dependabot.
- Commit, push o pull request sin autorización explícita.

## Decisiones normativas que R0 debe reflejar

1. El MVP sí incluye pgvector, FTS, retrieval autorizado, Context Compiler,
   ContextPacket, un agente y `investigate_inventory_divergence`.
2. El agente no tiene credenciales, no accede a PostgreSQL y no ejecuta acciones externas.
3. Se permiten escrituras internas append-only para propuestas y decisiones.
4. El LLM puede comunicar valores devueltos por herramientas determinísticas,
   pero no calcularlos, originarlos ni ser su fuente autoritativa.
5. La política efectiva se selecciona por código desde una versión aprobada y vigente.
6. FTS/vector recuperan evidencia de respaldo; no deciden autoridad.
7. No hay RRF global en v0; sí hay ranking, límites y deduplicación dentro de canales.
8. El ContextPacket separa payload determinístico de envelope operativo.
9. Autorización ocurre antes del retrieval y las citas se reautorizan antes de responder.
10. Ninguna ADR aceptada se reescribe retroactivamente.

## Fuente de verdad después de R0

1. Seguridad e invariantes de `AGENTS.md` y la especificación.
2. `docs/architecture/company-brain-spec.md`.
3. ADR aceptadas reflejadas en la especificación.
4. `docs/plans/current.md`.
5. `docs/plans/company-brain-build-plan.md`.
6. `docs/product/project-brief.md` como hipótesis de producto.
7. Visión futura y archivo histórico como contexto no normativo.

## Archivos previstos

### Nuevos

- `docs/architecture/adr/ADR-011-inventory-company-brain-vertical.md`
- `docs/architecture/adr/ADR-012-operational-append-only-retention-deletion.md`
- `docs/architecture/adr/ADR-013-authorized-segmented-retrieval.md`

### Modificados

- `docs/architecture/adr/README.md`
- `docs/architecture/company-brain-spec.md`
- `docs/plans/company-brain-build-plan.md`
- `docs/plans/current.md`
- `docs/plans/decision-log.md`
- `docs/product/project-brief.md`
- `docs/product/ageci-to-praxa-context.md`
- `docs/team/ownership.md`
- `docs/team/working-with-agents.md`
- `AGENTS.md`
- `README.md`
- `.github/workflows/ci.yml`
- `.github/ISSUE_TEMPLATE/ticket.yml`
- `.github/pull_request_template.md`
- `CONTRIBUTING.md` (desviación aprobada: reemplazo de los ejemplos de rama `cb-XXX` por
  ejemplos `vs-XX`, sin cambios al resto del flujo de contribución)

### Movidos al archivo histórico

- `START_HERE.md` → `docs/research/archive/bootstrap/START_HERE.md`
- `BOOTSTRAP_CODEX_PROMPT.md` → `docs/research/archive/bootstrap/BOOTSTRAP_CODEX_PROMPT.md`

## Criterios de aceptación

- `current.md` ya no presenta CB-001 como planificado.
- El índice contiene ADR-001 a ADR-013 sin huecos ficticios.
- ADR-002 y ADR-008 conservan su texto e historia.
- Ninguna fuente activa excluye el agente controlado o la skill del MVP.
- Ninguna fuente activa autoriza autonomía, multiagente o escrituras externas.
- La spec diferencia política autoritativa de evidencia recuperada.
- La spec diferencia payload y envelope del ContextPacket.
- La spec no exige RRF global en v0.
- Las referencias activas al Lean Canvas eliminado son cero.
- README describe con precisión lo que ejecuta `make ci`.
- CI usa actions críticas fijadas por SHA, permisos mínimos, credenciales no persistentes,
  timeouts, lockfile y concurrency.
- Un PR genera una sola ejecución de CI para su commit; el push a `main` genera la de integración.
- `make ci` pasa desde un checkout limpio.
- `git diff --check` pasa.
- El diff contiene solo los archivos previstos o una desviación aprobada.

## Verificación obligatoria

Antes de editar:

```bash
git status --short --branch
git diff --stat
git log -5 --oneline --decorate
```

Durante y después:

```bash
rg -n "lean-canvas-v6\.1" --glob '!docs/research/archive/**' .
rg -n "skills ejecutables.*fuera|Skill.*solo visión futura|CB-001.*planificado" \
  AGENTS.md README.md docs
git diff --check
make ci
git status --short
git diff --stat
```

La salida real debe incluirse en el handoff. No escribir “pasa” sin haber ejecutado el comando.

## Riesgos

- Una enmienda demasiado amplia de la spec puede introducir nuevas contradicciones.
- Archivar documentos puede romper enlaces no detectados.
- Fijar actions por un SHA incorrecto puede romper CI.
- El working tree local puede contener trabajo ajeno.
- Cambiar scope sin actualizar todas las fuentes puede dejar dos MVP simultáneos.

## Regla de edición

- Cambios focalizados.
- No reescribir ADR aceptadas.
- No agregar dependencias o servicios.
- No tocar código funcional.
- No convertir supuestos en hechos.
- Detenerse ante cambios locales ajenos o contradicciones nuevas.

## Definition of Done

R0 termina cuando:

1. todos los criterios de aceptación tienen evidencia;
2. `make ci` y `git diff --check` pasan;
3. un revisor distinto inspecciona el diff;
4. las observaciones bloqueantes se resuelven;
5. las horas humanas reales quedan registradas;
6. el cambio se fusiona solo con autorización humana;
7. `current.md` queda en estado de handoff y no autoriza VS-01 automáticamente.

## Punto de parada

Después del reporte y revisión de R0:

```text
ESTADO: R0 COMPLETADO — VS-01 NO AUTORIZADO
```

No comenzar VS-01 hasta recibir una instrucción humana explícita.

---

## Estado de la preparación local (2026-08-10)

Esta sección registra el estado real de la ejecución, sin sustituir los criterios de arriba.

La preparación local de R0 fue ejecutada en la rama `docs/r0-company-brain-alignment`, creada
desde `origin/main` (`69e6139`). Los criterios verificables sin red están cumplidos.

ADR-011, ADR-012 y ADR-013 fueron auditadas y aprobadas por revisión humana explícita, y quedan
`Accepted` mediante este gate. La jerarquía normativa ya no es transitoriamente incoherente.

`git diff --check` devuelve exit code 0, sin errores: los saltos de línea duros de Markdown que
antes producían avisos de *trailing whitespace* fueron eliminados sin alterar el texto aprobado.

**No** están cumplidos, y por lo tanto R0 **no está cerrado**:

- `make ci` literal, porque Make no está instalado en el entorno de ejecución; se corrieron sus
  targets equivalentes uno por uno, con exit code y duración registrados.
- Validación desde un checkout limpio.
- CI remoto en runner limpio y verificación de una sola corrida por commit de PR.
- Registro definitivo de horas humanas.
- Commit, push, Draft PR y merge.

Sobre el segundo comando del bloque «Durante y después»: al ejecutarse sobre `docs`, ese `rg`
también inspecciona este archivo y siempre devuelve al menos dos coincidencias propias —el texto
del criterio y el texto del comando—. El resultado esperado es cero coincidencias **fuera** de
`docs/plans/current.md` y fuera de `docs/research/archive/**`.

Estado de la ejecución local:

```text
ESTADO: R0 CORREGIDO Y PREPARADO PARA COMMIT LOCAL — COMMIT, PUSH, PR Y VS-01 NO AUTORIZADOS
```
