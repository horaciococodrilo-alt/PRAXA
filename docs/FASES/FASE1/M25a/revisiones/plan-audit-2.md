# Auditoría del plan de M25a — ronda 2

- **Fecha:** 2026-11-09 (America/Buenos_Aires).
- **Commit:** `3eaf561` (`docs/m25a-spec`); base de código `main@b0c854d`. El árbol tenía cambios documentales sin commit (spec, plan, enmiendas de la ruta) e informes sin seguimiento; se preservaron.
- **Hash de contenido de la spec:** `f99c64a50aae827062f399bee50cfa3ae9362d5f`.
- **Hash de contenido del plan:** `493ddcd22731f637285e4144e8137dc8d23e4080`.
- Ambos hashes excluyen solo la línea `**Estado:**` (`grep -v '^\*\*Estado:\*\*' ARCHIVO | git hash-object --stdin`).
- **Estado auditado:** spec `APROBADA`; plan `BORRADOR`.
- **Relación con la ronda 1.** `plan-audit-1.md` ya existía al empezar (APROBABLE, 12 PASS, mismos hashes). Esta ronda se hizo de forma independiente: el cruce y los chequeos se rehicieron desde las fuentes, y el informe anterior se leyó después de formar este juicio. Coincide en el veredicto y no agrega hallazgos.

## Precondiciones

| Precondición | Resultado | Evidencia |
|---|---|---|
| Spec en `APROBADA` | PASS | `spec.md:3`. |
| Última `spec-audit-N` APROBABLE | PASS | `spec-audit-14.md`: 18 PASS, 0 FAIL. |
| Hash actual de la spec igual al auditado | PASS | `f99c64a5…` en el informe 14 y en el archivo actual. |
| `plan.md` existe y está en `BORRADOR` | PASS | `plan.md:3`. |

## Veredicto

**APROBABLE: 12 PASS, 0 FAIL, 0 NO APLICA.** No se modifica ni se aprueba el plan, no se inicia M25a y `G-CHAT` no cambia.

## Checklist

`plan.md` y `spec.md` son los de M25a; `ruta` es `docs/FASES/FASE1/meta_first/plan.md`.

| # | Ítem | PASS/FAIL/NO APLICA | Evidencia o justificación |
|---|---|---|---|
| 1 | Spec base | PASS | `plan.md:7` cita la spec y su hash completo, igual al actual y al de la auditoría 14. |
| 2 | Cobertura | PASS | Cruce por script de la columna «Criterios y casos que cubre» de los 29 pasos, con intervalos inclusivos (`plan.md:61`): los 84 criterios operativos (`M25a-C-01` a `-84`) y los 95 casos (`M25a-T-01` a `-95`) aparecen en algún paso, y ningún paso cita un ID inexistente. Por tipo: los 21 casos pgTAP están en el paso 1, los 9 casos `app` en el 6 y los manuales en sus pasos (T-52 en 14, T-53 en 15, T-54 en 16, T-58 en 23, T-60 en 20, T-61 en 21, T-62 en 27, T-63 en 16 y 24, T-84 en 4, T-85 en 22). Los heredados (CA-38c, CA-44/44b, CA-48 a CA-55, CA-61 a CA-66, CA-67/68, CA-69 a CA-73, VR-02/DEC-21, DEC-23, DEC-24 y CB-01 a CB-06) tienen pasos en `plan.md:119-130`. |
| 3 | TDD | PASS | `plan.md:63` exige escribir y ejecutar los casos completos antes de implementar, registrar el fallo esperado y comprobar que las aserciones detectan el comportamiento incorrecto. Los pasos 1-3, 9-13 y 17-19 la aplican; los de Data API se preparan en el 3 y corren en el 6, después de aplicar la migración. `plan.md:65` exceptúa con motivo las pruebas manuales, las mediciones, los controles documentales y las regresiones T-48 y T-64. |
| 4 | Archivos | PASS | Las llaves de `plan.md:27-53` se expandieron y se compararon con «Archivos previstos» de la spec: el conjunto es el mismo (las diferencias de la comparación son solo nombres que la spec abrevia dentro de una celda). Cada archivo está en II.12, II.13 o II.13b de la ruta, en la enmienda de la ruta (D-M25a-01, -10, -14 y -16), en la regla de rutas sugeridas dentro del módulo, o es de seguimiento o pipeline (precondiciones 8 y 9). No figuran `app-nav.tsx`, `app-data`, `reporting/contract`, `shell.tsx`, el runner pgTAP ni `PIPELINE.md`. Los archivos existentes que el plan modifica existen en el árbol; los nuevos (`src/modules/chat/`, `tests/eval/`) no existen todavía, como corresponde. |
| 5 | Pasos | PASS | Los 29 pasos tienen verificación propia. El orden respeta las dependencias: pruebas y SQL (1) → herramientas (3) → ensayo con rollback y medición (4) → `db:push:test` del usuario (5) → Data API real (6) → control y commit de `.1` (7). En `.2`: clave de DeepInfra (8) → adaptador y prueba del esquema antes de la guarda (9) → guarda (10) → presentación (11) → turno y acciones (12) → pantalla (13) → conjunto base congelado y VR-02 (14) → control y commit (15). En `.3`: acta y comunicación (16) → catálogo completo (17) → casos dudosos (18) → avisos (19) → medición (20) → ampliado congelado (21) → recorrido sintético (22-23) → control y revisiones (24) → publicación (25-28). |
| 6 | Migraciones | PASS | La última migración es `0017_meta_breakdowns.sql`; corresponde `0018_chat_queries.sql`. `plan.md:194-200`: se ensaya con rollback antes del primer `db:push:test`, no se edita después de aplicada, un defecto posterior frena la corrida sin crear `0019`, y una reversión persistente exige una migración nueva con autorización previa. T-82 comprueba que el diff solo añade `0018`. |
| 7 | Comandos | PASS | Todos los `npm run` del plan existen en `package.json` (`verify`, `db:check:test`, `test:policies`, `test:app`, `test:unit`, `test:component`, `db:preview`), salvo `test:eval`, que la spec declara previsto y el paso 9 crea. `node scripts/chat-seed-test.mjs` es un archivo nuevo de la spec. Las suites de III.3 están en `plan.md:136-151`: `.1` con `test:policies` y `test:app`; `.2` con la suite adversaria y VR-02; `.3` con `test:policies`, `test:app`, evaluación ampliada y recorrido. `db:check:test` precede a cada suite de base, y `plan.md:165` fija CB-06 y el tratamiento de las omitidas opt-in ajenas. |
| 8 | Acciones reservadas | PASS | `db:push:test` en el paso 5; commits de etapa en 7, 15 y 24; `db:push` a `app` en el 25, con `db:preview` antes y la comprobación del historial después, y antes de integrar en `main`; clave en Vercel, push, PR, integración y despliegue en el 26, con despliegue `READY`; recorrido, acta y `G-CHAT` en 16, 23, 27 y 28. Cada una tiene su verificación posterior (`plan.md:176-192`). `.claude/settings.json` deniega `npm run db:push*` y `git push*`. |
| 9 | Reglas | PASS | K01 y la conexión salen del servidor, con entrada estricta y firmas públicas sin tenant (`plan.md:95`; pasos 3 y 12). Credenciales solo por `worker_api`: el paso 1 amplía el cliente existente y el 3 usa el JWT bajo RLS. Pruebas solo contra el desechable: guardas en los pasos 0, 4, 6 y 22, y `plan.md:219` prohíbe suites o fixtures contra `app`. Sin secretos: la clave se carga fuera del chat (paso 8) y el diff se revisa para datos reales (`plan.md:174`). |
| 10 | Trampas | PASS | Se contrastaron las de II.12 y II.13 y las 21 de «Trampas y riesgos» de la spec. Pregunta en logs: pasos 2 y 12 (T-46). Cifras atadas a métrica, período y fuente, y cifras sin dígitos: paso 10 (T-38 a T-43). Guarda que no garantiza fidelidad, identificador sin fecha y proveedor: paso 14 y Riesgos. Tope de 28 días: paso 1 (T-19) y paso 6 (T-20). Volumen y rollback: pasos 4 a 6. Concurrencia, turno colgado y registro tardío: pasos 1, 6 y 12. Atribución desconocida y ventanas distintas: pasos 1, 11 y 17 y Riesgos. Sin empresa: pasos 12 y 13 (T-94, T-95). Truncado: paso 9. Costo: paso 8, `M25a-H-08`. Migración antes del código: paso 25. El helper de la validación de `09` queda cubierto porque el ensayo y `test:policies` incluyen `09` (pasos 4 y 5). |
| 11 | Git | PASS | `plan.md:13`: una sola corrida en `mf/M25a`. El paso 0 prepara esa rama conservando los cambios ajenos; los commits son del usuario (7, 15, 24) y el push, del usuario en el 26 (`plan.md:192` lo prohíbe al asistente). No hay operaciones destructivas. |
| 12 | Fidelidad | PASS | Las tres etapas siguen la ficha y II.12, II.13 y II.13b: 13 herramientas, seis cálculos, 6 y 19 bloques, cuatro salidas de registro, contexto acotado, avisos de consumo en las dos pantallas, dos evaluaciones y los dos recorridos. Los 8 hallazgos «a registrar» de la spec están en el paso 0. Los límites solo se ajustan dentro de §13, y los 60 s no cambian. «Qué no se hace» (`plan.md:215-219`) repite las exclusiones de la spec sin sumar capacidades. Los nombres de código que el plan usa (`listCapturedEntities`, `readConnectionRecord`, `getWorkerApi`, `createSupabaseServerClient`, `maskExternalAccountId`) existen. |

## Hallazgos

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| — | — | — | Ninguno | 12 ítems en PASS | — |

## Observaciones (no afectan el veredicto)

- **Tamaño.** M25a excede las 8 horas, pero DEC-24 y la ficha la exceptúan y la dividen en tres etapas. No corresponde proponer otro corte.
- **Cómo llegan los documentos a `mf/M25a`.** La spec, este plan, las enmiendas de la ruta y los informes están solo en `docs/m25a-spec`, y gran parte sin commit. `/microfase` crea `mf/M25a` desde la base (`git switch -c mf/*` está permitido) y, en modo con pipeline, exige que `M25a/spec.md` y `plan.md` existan. Si la rama sale de `main` sin esos archivos, entra en modo «sin pipeline» o queda `BLOQUEADO`. El paso 0 lo contempla de forma general («conservando los cambios ajenos»), y la decisión es del usuario.
- **Procedencia de la aprobación de la spec.** `spec.md:3` dice `APROBADA` y `plan.md:7` afirma que el usuario lo confirmó en el chat el 2026-11-09. Esa frase no consta en el repositorio y no se pudo comprobar desde esta sesión. El criterio de la skill se evalúa por el estado del archivo.

## Verificaciones y límites

- Se leyeron la skill, `AGENTS.md`, el plan y la spec de M25a, la ficha de M25a y las precondiciones de la ruta, II.12, II.13, II.13b, III.2, III.3 y III.9, `package.json`, `.claude/settings.json`, la lista de migraciones y los archivos de código que el plan modifica o nombra.
- Cruces por script: 84/84 criterios, 95/95 casos, 29 pasos con 4 columnas y equivalencia del conjunto de archivos entre plan y spec.
- Solo se auditó el plan. No se ejecutaron `verify`, pgTAP, `test:app`, evaluaciones, migraciones, commits, pushes ni despliegues, y ningún resultado futuro del plan se declara probado.
- Solo se agregó este informe; no se editó el plan, la spec ni el estado del proyecto.

## Siguiente paso

El usuario puede aprobar el plan: «Apruebo el plan de M25a: pasá el estado a APROBADO.». Después elige modelo y esfuerzo (alto para M25a), abre una sesión nueva y corre `/microfase M25a`.

Una auditoría APROBABLE no reemplaza la aprobación del usuario ni aprueba `G-CHAT`.
