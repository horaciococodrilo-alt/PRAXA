# Enmienda de la ruta: M16c en una sola corrida — 2026-11-07

Base inspeccionada: `a27f727`. Al inicio había cambios documentales sin commit de las enmiendas de Insights (2026-11-06) y G-SYNC (2026-11-07), y el directorio M16c sin rastrear; se preservaron.

## Autorización

Con la spec de M16c aprobada (auditoría 9, APROBABLE sobre el hash `a31ed49…`), el usuario pidió no escribir specs por corte y ejecutar todo con un plan completo, en una corrida de microfase. Se le presentó el conflicto con la ruta («Cada corte requiere spec y plan propios aprobados») y con el límite de 8 horas de `AGENTS.md`, junto con tres opciones. El usuario eligió «Una spec, un plan, una corrida». Se preparó la [propuesta](../../M16c/revisiones/propuesta-enmienda-corrida-unica-1.md) y el usuario respondió «apruebo». Queda registrada como D-M16c-05.

La excepción al límite de 8 horas sigue el precedente de M16.2 (`meta_first/plan.md`, ficha de M16.2): se declara en la ficha de la ruta y `AGENTS.md` no se modifica.

## Cambios realizados

- `meta_first/plan.md`:
  - encabezado, con esta enmienda y con la de G-SYNC del 2026-11-07, que faltaba (observación de la auditoría 6);
  - ID de la ficha de M16c;
  - sección «Etapas obligatorias de M16c»: controles de etapa, pausas, reanudación, revisiones y gate único;
  - tabla de etapas (evidencia y dependencias);
  - II.11 (fila de M16c.3 y párrafo de cierre);
  - filas de M16c en III.2 y III.3.
- `docs/PROJECT_STATE.md`: siguiente habilitada (M16c, con la spec por volver a auditar y el plan único), estado de las etapas, secuencia y «fijación» de Q-04 en lugar de «medición» (observación de la auditoría 6).
- `M16c/spec.md`: vuelve a BORRADOR. Se registra D-M16c-05 y se adaptan la descripción, la entrada, los archivos previstos (plan y sesión únicos), C-22, T-33, la verificación (control de etapa), las intervenciones, el punto 1 de D-M16c-03 y la trampa de subdividir planes. Se actualizan las referencias de línea al plan de la ruta que se corrieron con esta enmienda.

No cambian el contenido técnico de la spec (datos, tablas, funciones, reglas, criterios y casos), G-SYNC y su condición, D-M16c-02, D-M16c-03 en lo sustancial, `AGENTS.md`, `SECURITY.md`, `ARCHITECTURE.md` ni el acta. La enmienda no aprueba la spec ni el plan.

## Verificación

- Cada reemplazo se aplicó sobre una única coincidencia del texto vigente.
- `git diff --check` sobre los archivos tocados: sin errores.
- No se corrieron pruebas: el cambio es documental. No hubo commit, push ni acceso a `.env.local`.
