# Praxa — visión futura

> **ESTADO: NO NORMATIVO.** Este documento explica una dirección posible. No constituye alcance, backlog autorizado ni criterios de aceptación del Company Brain v0.

## Tesis de largo plazo

Los modelos pueden razonar, pero no conocen por sí solos el estado, las reglas, las excepciones, la historia ni los permisos de una empresa. Los sistemas empresariales conocen partes del estado, pero no coordinan el trabajo completo.

Praxa aspira a ser la capa entre ambos: conocimiento empresarial en formato gobernado y utilizable, con capacidad futura de actuar bajo límites determinísticos y supervisión humana.

## Modelo completo

### 1. Company Brain

- Estado canónico leído de sistemas de registro.
- Evidencia, hechos, políticas, precedentes y decisiones.
- Vigencia, procedencia, permisos, contradicciones y gaps.
- Contexto mínimo y citado para cada tarea.

### 2. Agent Runtime

- Autentica usuario y empresa.
- Resuelve identidad, roles, propósito y capabilities.
- Controla sesión, trazas, presupuesto, checkpoints y errores.
- El LLM razona; el runtime controla.

### 3. Skill Registry

- Procedimientos versionados con inputs, precondiciones y postcondiciones.
- Resúmenes pequeños para descubrimiento y carga completa bajo demanda.
- Tests, replay histórico, owner y estado de publicación.
- Una ejecución nunca se convierte automáticamente en una política.

### 4. Tool Gateway

- Guarda credenciales fuera del prompt.
- Expone capabilities limitadas en vez de APIs libres.
- Valida schemas e impacto.
- Usa idempotency keys, preview, apply, verificación y compensación cuando exista.

### 5. Control para personas no técnicas

- Timeline de decisiones y acciones.
- Aprobaciones según consecuencia y riesgo.
- Pausa global y límites.
- Métricas de resultado, revisión e incidentes.
- Explicaciones en lenguaje del negocio.

### 6. Capa de equipo

- Escalamiento a la persona que conoce el caso.
- Roles y permisos por área.
- Reparto de trabajo entre personas y agentes.
- Aprobaciones y visibilidad por responsabilidad.
- Captura controlada del conocimiento de cada área.

### 7. Mejora controlada

- Extraer hechos y excepciones candidatos.
- Detectar patrones repetidos.
- Proponer cambios de proceso o skills.
- Ejecutar tests y replay antes de publicación.
- Requerir revisión humana para cambios de autoridad.

### 8. Capa de red futura

- Benchmarks agregados y anonimizados.
- Patrones de incidentes por vertical.
- Recipes y controles reutilizables.
- Consentimiento, privacidad y aislamiento estrictos.

No se construirá hasta existir densidad, consentimiento y un producto repetible.

## Mapa posible de producto web

### Company Brain v0

- Dashboard de cobertura.
- Fuentes y sincronizaciones.
- Explorador de entidades.
- Evidencia, hechos y políticas.
- Search / Context Inspector.
- Contradicciones y gaps.
- Cola de revisión.
- Auditoría.

### Plataforma futura

- Agentes.
- Skills.
- Casos, tareas y ejecuciones.
- Aprobaciones.
- Herramientas e integraciones.
- Equipo y roles.
- Analíticas de resultados.
- Configuración de autonomía.

## Principio de alcance

Conocer la visión no autoriza construirla. Una función futura entra en desarrollo únicamente cuando:

1. resuelve un resultado observado;
2. existe un ticket aprobado;
3. cuenta con criterios verificables;
4. no rompe invariantes;
5. reemplaza o justifica el costo de otra prioridad.
