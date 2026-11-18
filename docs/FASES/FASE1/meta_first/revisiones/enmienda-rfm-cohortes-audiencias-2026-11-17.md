# Enmienda de la ruta: M27a — RFM, cohortes y propuestas de audiencias

**Estado:** APROBADA por el usuario el 2026-11-17, en el chat («corregí las cosas necesarias»; elige redactar la enmienda en este repositorio).

## Por qué existe este documento

La spec y el plan de `M27a` se redactaron y aprobaron en un fork, sobre un commit (`d349b98`) que contenía esta enmienda y que no llegó a este repositorio. El usuario acredita la validación de esos documentos, hecha en el fork, sin repetir sus auditorías aquí. Esta enmienda vuelve a escribir en la ruta únicamente lo que la spec de `M27a` ya cita: la ficha, II.14d, el gate y la §18 de la spec de la ruta. No cambia el diseño de `M27a`.

## Qué agrega

- **Plan de la ruta:** el párrafo de enmienda, el mapa (I.2), la fila del gate `G-SEGMENTOS-AUDIENCIAS` (I.3), la ficha de `M27a` (I.4), la sección II.14d y las filas de `M27a` en III.2, III.3 y III.8.
- **Spec de la ruta:** el párrafo de enmienda y la nueva §18, con los criterios §18.1 a §18.10 que la spec de `M27a` hereda (resumen fiel de su tabla «Heredados de la ruta»).
- **Estado:** `M27a` como trabajo paralelo autorizado en `PROJECT_STATE.md`, con dependencia de `G-TIENDA` (aprobado el 2026-11-15).
- **Hallazgo:** `H-E1-274` registra la validación monetaria pendiente. En el fork se llamaba `H-E1-270`; ese ID ya lo usa aquí un hallazgo de M16f.

## Qué no cambia

- `M28.3a` no pasa a depender de `G-SEGMENTOS-AUDIENCIAS`: `M27a` es trabajo paralelo y la demo puede hacerse sin él.
- No aprueba `G-SEGMENTOS-AUDIENCIAS`, el acta ampliada, T-04 ni ningún uso de datos reales.
- No modifica migraciones existentes, scopes, OAuth, `worker-api.ts`, `limits.ts`, `analysis.ts`, `package.json` ni el lockfile.
- `SECURITY.md`, `ARCHITECTURE.md` y el acta `M03a` se actualizan dentro de `M27a`, que los lista como archivos previstos.

## Ajustes de integración aplicados a la spec y al plan de M27a

Respecto de las versiones del fork, por diferencias con el `main` actual:

1. `H-E1-270` pasa a `H-E1-274`.
2. M16f y M25b ya están cerrados: la coordinación con M16f se reduce a reconfirmar numeración; la base integrada del paso 8 es la rama de integración vigente.
3. Se agrega a los archivos `scripts/lib/demo-seed-sources.mjs`, porque la empresa demo (`H-E1-273`) publica pedidos con `worker_api.tn_publish_orders`, que `M27a` reemplaza.
4. Referencias de línea actualizadas (`shell.tsx`, `repository.ts`, `PROJECT_STATE.md`, `HALLAZGOS.md`) y base de referencia en el commit `7d14ca9`.
