# Enmienda de la ruta: G-SYNC con cuenta sin actividad — 2026-11-07

Base inspeccionada: `a27f727`. Al inicio había cambios documentales sin commit de la enmienda de Insights del 2026-11-06 y el directorio M16c sin rastrear; se preservaron.

## Autorización

A-01 de [spec-audit-4](../../M16c/revisiones/spec-audit-4.md) detectó que la decisión del usuario del 2026-11-06 (fijar Q-04 sin datos representativos y no buscar otra cuenta) no estaba registrada y chocaba con la ruta. El usuario la ratificó en el chat («para la decisión 1) a») y quedó registrada como D-M16c-02 en la spec de M16c. La propuesta se revisó el mismo día: se coordinaron todos los textos de Q-04, la validación de campos se separó de `H-E1-117` en `H-E1-189` y se precisó qué detecta el extractor. A-01 de [spec-audit-5](../../M16c/revisiones/spec-audit-5.md) dejó pendiente la aprobación. El usuario eligió «Aprobar e integrar» y, sobre `H-E1-117`, «Separar y revisar con VR-01» (D-M16c-04).

## Cambios realizados

Según la [propuesta aprobada](../../M16c/revisiones/propuesta-enmienda-gsync-1.md):

- `meta_first/spec.md`: línea 23 y fila Q-04 de la tabla de preguntas, con el origen de cada límite (cambios 1 y 2).
- `meta_first/plan.md`: Base, ficha M16c (procedimiento y evidencia de cierre), II.11 (acción y verificación de M16c.3, párrafo de cierre) y fila Q-04 de III.4 (cambios 3 a 9).
- `docs/HALLAZGOS.md`: `H-E1-189` con su estado condicional (cambio 10). `H-E1-117` conserva solo las hipótesis de OAuth y pasa a M16c.3, que las contrasta con la evidencia registrada de VR-01 (D-M16c-04).
- `docs/PROJECT_STATE.md`: condición de G-SYNC con cuenta sin actividad.
- `M16c/spec.md`: M16c-Q-01 resuelta.

No cambian §11, CA-56, CA-44b ni otros CA o DEC, ni `SECURITY.md` y `ARCHITECTURE.md`. La enmienda no aprueba la spec de M16c ni ningún gate.

## Verificación

- Cada reemplazo se aplicó sobre una única coincidencia del texto vigente citado en la propuesta.
- `git diff --check` sobre los archivos de la ruta y HALLAZGOS: sin errores.
- No se corrieron pruebas: el cambio es documental. No hubo commit, push ni acceso a `.env.local`.
