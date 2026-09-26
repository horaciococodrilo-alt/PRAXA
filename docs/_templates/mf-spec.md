# [ID] — Spec de la microfase

**Estado:** BORRADOR

Estados posibles: `BORRADOR` → `APROBADA`. Solo el usuario pasa una spec a `APROBADA`, y solo después de una auditoría APROBABLE.

**Hash de contenido.** Se calcula sin la línea de estado:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/[ID]/spec.md | git hash-object --stdin
```

## Fuentes

- Ruta: `docs/FASES/FASE1/meta_first/plan.md` (ficha de [ID] en la Parte I y su sección en la Parte II) y `docs/FASES/FASE1/meta_first/spec.md`.
- Commit base: `…`.
- Microfases previas en las que se apoya: `…`.
- IDs cubiertos, si la sección de la Parte II agrupa varias microfases: `…`.

## Objetivo

Tomado de la ficha de la Parte I, sin ampliarlo.

## Alcance

Lo que exigen "Implementación requerida" y "Procedimiento del asistente" de la ficha, más los pasos de la Parte II.

## Fuera de alcance

Nunca vacío. Incluye lo que la ruta excluye y que podría confundirse con esta microfase.

## Contexto verificado en el código

| Qué | Dónde (archivo:línea) | Qué implica para esta microfase |
|---|---|---|

## Diseño concreto

Nombres, firmas, tipos, esquemas, objetos SQL, errores tipados y su redacción. Tiene que alcanzar para implementar sin inventar nada.

## Archivos previstos

Todo archivo que se va a crear o modificar, cada uno con el paso de la Parte II de la ruta que lo autoriza. Además, los archivos de seguimiento.

| Archivo | Nuevo o modificado | Para qué | Autorizado por |
|---|---|---|---|

## Criterios de aceptación

### Heredados de la ruta

| ID de la ruta | Qué exige (resumen fiel) |
|---|---|

### Operativos de esta microfase

| ID | Criterio verificable | Traza a (CA, DEC o trampa de la ruta) |
|---|---|---|

## Casos de prueba

| ID | Criterios | Tipo (unit, component, app, pgTAP, manual) | Comando | Resultado esperado | ¿Falla sin la implementación? |
|---|---|---|---|---|---|

## Verificación

Comandos de III.3 para esta microfase y los propios de la spec. Una prueba omitida por falta de configuración cuenta como no ejecutada (CB-06).

## Intervenciones del usuario y acciones reservadas

| Paso | Qué hace el usuario | Cómo se verifica después |
|---|---|---|

## Trampas y riesgos

## Decisiones de la microfase

| ID | Decisión | Motivo | Decidió | Fecha |
|---|---|---|---|---|

## Supuestos e hipótesis

Cada HIPÓTESIS indica cómo y cuándo se verifica.

## Preguntas abiertas

| ID | Pregunta | Opciones | Recomendación | Evidencia |
|---|---|---|---|---|

## Hallazgos relacionados

IDs de `docs/HALLAZGOS.md`.

## Auditorías

Enlaces a `revisiones/spec-audit-N.md`.
