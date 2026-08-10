# ADR-013 — Retrieval segmentado autorizado y autoridad determinística de políticas

**Status:** Accepted<br>
**Date:** 2026-08-10<br>
**Related:** ADR-008 — Retrieval híbrido

## Context

ADR-008 acepta retrieval híbrido con exactitud, FTS, vector, relaciones, temporalidad,
fusión reproducible, deduplicación, ACL y answerability.

Para el vertical de inventario, una fusión global obligaría a hacer competir objetos con
roles distintos: una observación de stock, una política aprobada, un conflicto y un
pasaje documental. Además, permitir que similitud textual o vectorial determine la
política efectiva convertiría retrieval en autoridad normativa.

Sin embargo, afirmar que un ContextPacket tipado elimina todo ranking también es
incorrecto: FTS y vector producen candidatos que deben ordenarse, limitarse y
deduplicarse.

## Decision

ADR-008 permanece Accepted. Esta ADR define cómo se implementa su alcance en el
vertical v0.

### Canales

El Context Compiler utiliza canales separados:

1. exacto para SKU e identificadores;
2. SQL estructurado para entidades, observaciones, casos y política efectiva;
3. FTS para términos y pasajes explícitos;
4. vector para significado y redacción alternativa de evidencia documental.

Los resultados llenan campos tipados del ContextPacket. No existe una lista global de
documentos, hechos y policies ordenada por un único score.

### Ranking

- No hay RRF global en v0.
- FTS conserva su ranking dentro del canal FTS.
- Vector conserva distancia/similitud dentro del canal vectorial.
- Cada canal aplica límites, deduplicación y criterios de frescura.
- La combinación de pasajes FTS/vector se resuelve de forma determinística y
  reproducible.
- Los parámetros son hipótesis evaluables, no verdades arquitectónicas.

### Autoridad de políticas

La política efectiva se selecciona por código desde `inventory_policy_version`.

La selección considera como mínimo:

- `tenant_id`;
- estado aprobado/activo;
- dominio y alcance;
- variante, producto o categoría aplicable;
- `valid_from` y `valid_to`;
- prioridad o excepción explícita;
- ausencia de solapamientos inválidos.

FTS y vector recuperan el pasaje documental que explica y respalda la versión ya
seleccionada. No eligen qué regla gobierna el cálculo.

El flujo documental es:

```text
documento
→ evidencia y chunks
→ candidato estructurado
→ revisión o fixture aprobado
→ inventory_policy_version activa
→ cita exacta a la evidencia
```

Un LLM puede proponer extracción estructurada. Nunca aprueba o activa la política.

### Autorización

- Tenant, principal, membership, rol y scope se derivan del contexto autenticado.
- Los filtros se aplican dentro de cada consulta, antes de recuperar candidatos.
- Los chunks heredan el permiso más restrictivo de su evidencia.
- Contenido no autorizado no puede influir en ranking, answerability o respuesta.
- Toda cita se reautoriza antes de serializar el resultado.
- El endpoint no revela la existencia o cantidad de resultados ocultos.

### Evaluación

La evaluación separa:

- resolución exacta;
- selección de política;
- recall/precision de pasajes FTS/vector;
- deduplicación;
- citas;
- ausencia de influencia de contenido no autorizado;
- answerability.

## Consequences

### Positivas

- La autoridad permanece en datos aprobados y código determinístico.
- Menos pesos globales sin calibrar.
- Mejor explicación por tipo de información.
- Menor riesgo de que un chunk relevante pero no autoritativo gobierne el cálculo.

### Negativas

- El Context Compiler contiene lógica explícita por dominio.
- El vertical no prueba todavía un retrieval multidominio.
- La ausencia de RRF puede reducir calidad si los canales están mal delimitados.

## Alternatives considered

### RRF global obligatorio

Descartado para v0 por falta de dataset que justifique pesos y porque mezcla roles
semánticos distintos.

### Solo vector search

Descartado: SKU, vigencia, permisos y autoridad exigen exactitud y filtros estructurados.

### Sin ranking

Descartado: FTS y vector requieren ordenar candidatos dentro de su canal.

### Policy seleccionada por LLM

Descartado por falta de autoridad, reproducibilidad y seguridad.

## v0 scope

- Un dominio y una familia de policies.
- Cuatro canales.
- Sin RRF global.
- Selección de policy determinística.
- ACL antes del retrieval y reautorización de citas.

## Deferred

- Fusionador multidominio.
- Reranker aprendido.
- Clasificador general de intención.
- Calibración de pesos entre canales.
- Explicación pública de scores internos.

## Revisit when

- El dataset versionado demuestra que una fusión mejora calidad sin romper seguridad.
- Un segundo dominio exige combinar tipos de candidatos comparables.
- Los canales segmentados incumplen los gates medidos.
