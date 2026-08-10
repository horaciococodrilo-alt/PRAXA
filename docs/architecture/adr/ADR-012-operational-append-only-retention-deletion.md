# ADR-012 — Append-only operacional, identidad de origen, retención y borrado

**Status:** Accepted<br>
**Date:** 2026-08-10

## Context

PRAXA debe reconstruir qué recibió, qué interpretación produjo y qué decisión tomó.
ADR-005 establece evidencia append-only. Sin una precisión adicional, “append-only”
puede confundirse con conservación eterna o puede implementarse usando solo el hash
de contenido como identidad.

Dos objetos de origen distintos pueden tener contenido idéntico. Además, retención,
revocación y solicitudes administrativas requieren un camino controlado que no otorgue
UPDATE o DELETE al rol normal de aplicación.

## Decision

Append-only significa inmutabilidad operacional para los roles comunes de aplicación.
No significa retención eterna ni impide un proceso administrativo gobernado.

### Identidad de ingesta

La identidad mínima considera:

```text
tenant_id
+ source_id
+ external_object_key
+ content_hash
```

- `external_object_key` identifica el objeto dentro de la fuente.
- `content_hash` identifica una versión de su contenido.
- El mismo contenido en dos objetos no colapsa sus identidades.
- Una modificación de contenido crea una versión nueva para el mismo objeto.

### Versiones

- `evidence_version` es append-only para el rol de aplicación.
- Las versiones se enlazan al objeto de origen y a su versión previa.
- Los resúmenes, chunks y embeddings son derivados reemplazables y conservan la
  referencia exacta a la versión de evidencia.
- Reprocesar la misma identidad y hash no crea una versión nueva.

### Tombstones

- Un tombstone se vincula al objeto de origen, no solo al contenido.
- Una sincronización posterior no resucita un objeto revocado sin una transición
  explícita y auditada.
- El estado derivado se puede reconstruir desde versiones y tombstones autorizados.

### Roles y borrado

- El rol de aplicación no tiene UPDATE o DELETE sobre evidencia ni audit log.
- Un rol administrativo separado puede ejecutar retención, supresión o corrección
  gobernada mediante un servicio explícito.
- Toda operación administrativa registra actor, motivo, alcance, momento y resultado.
- El proceso minimiza datos residuales en índices, chunks, embeddings, caches y copias
  derivadas.
- Las políticas exactas de retención se configuran por entorno y se documentan antes
  de usar datos reales.

### Corrección

La corrección normal crea una nueva versión o un nuevo estado. No reescribe historia.
Cuando una supresión administrativa impide conservar el contenido, se mantiene solo
la metadata mínima legal y operativamente permitida, sin conservar el dato eliminado
por conveniencia técnica.

## Consequences

### Positivas

- Idempotencia y linaje correctos por objeto.
- Reproducción de ingesta y estado derivado.
- Menor riesgo de resurrección accidental.
- Separación entre auditoría operacional y administración de datos.

### Negativas

- El borrado completo exige recorrer derivados e índices.
- Se necesitan pruebas de no reaparición.
- El proceso administrativo requiere controles más fuertes que una operación común.

## Alternatives considered

### Usar solo `content_hash`

Descartado porque fusiona objetos diferentes con bytes iguales.

### Permitir UPDATE/DELETE al rol de aplicación

Descartado porque rompe auditabilidad y amplía el impacto de un error.

### Conservar todo para siempre

Descartado porque la auditabilidad no justifica retención ilimitada.

## v0 scope

- Datos sintéticos.
- Identidad y versionado por objeto de origen.
- Tombstone y prueba de no reaparición.
- Roles separados y contrato administrativo.
- Sin interfaz completa de gestión de privacidad.

## Deferred

- Política productiva por jurisdicción y cliente.
- Flujos de identidad de titulares de datos.
- Retención multinivel por clase documental.
- Almacenamiento WORM o legal hold.

## Revisit when

- Se incorporen datos reales.
- Se defina la política de retención del entorno compartido.
- Se adopte un blob store externo con semántica de borrado distinta.
