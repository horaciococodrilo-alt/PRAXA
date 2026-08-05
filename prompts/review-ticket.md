# Prompt — revisar un ticket

Revisá el cambio actual en modo de solo lectura. No edites, no formatees, no hagas commits ni amplíes scope.

Compará el diff contra:

- `AGENTS.md`;
- `docs/plans/current.md`;
- secciones relevantes de la especificación;
- ADR aplicables;
- criterios de aceptación y tests.

Buscá:

1. Scope creep.
2. Contradicciones de arquitectura.
3. Errores funcionales.
4. Fugas entre tenants o RLS incompleto.
5. Manejo incorrecto de evidencia, temporalidad o lifecycle.
6. Secretos o datos sensibles.
7. Dependencias innecesarias.
8. Tests faltantes o engañosos.
9. Comandos no reproducibles.
10. Código futuro prematuro.

Clasificá hallazgos como bloqueante, alto, medio o bajo. Para cada uno indicá archivo, ubicación, impacto, evidencia y corrección mínima.

Conclusión final: aprobable, aprobable con correcciones menores o no aprobable.
