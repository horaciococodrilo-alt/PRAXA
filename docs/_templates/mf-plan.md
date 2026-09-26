# [ID] — Plan de implementación

**Estado:** BORRADOR

Estados posibles: `BORRADOR` → `APROBADO`. Solo el usuario pasa un plan a `APROBADO`, y solo después de una auditoría APROBABLE.

**Spec base:** `docs/FASES/FASE1/[ID]/spec.md`, con hash de contenido `…`. Ver la fórmula en `docs/_templates/mf-spec.md`.

**Hash de contenido de este plan.** Se calcula sin la línea de estado:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/[ID]/plan.md | git hash-object --stdin
```

## Archivos

Esta lista es el alcance de archivos de la microfase. Tiene que estar contenida en la tabla de la Parte II de la ruta, más los archivos de seguimiento.

| Archivo | Nuevo o modificado | Paso | Autorizado por |
|---|---|---|---|

## Pasos

Cuando el código tiene comportamiento que se puede probar, las pruebas van antes de la implementación (TDD).

| # | Acción | Archivos | Criterios y casos que cubre | Verificación del paso |
|---|---|---|---|---|

## Verificación final

Comandos exactos de `package.json` y de III.3.

## Intervenciones del usuario y acciones reservadas

Push, despliegue, `db:push` al proyecto `app` y todo lo que los permisos nieguen, como `db:push:test`. Para cada una, en qué paso ocurre y cómo se verifica después.

## Migraciones

Si aplica: el número siguiente de la secuencia, y cómo se revierte. La reversión siempre es con una migración nueva; nunca se edita una existente.

## Riesgos

## Qué no se hace
